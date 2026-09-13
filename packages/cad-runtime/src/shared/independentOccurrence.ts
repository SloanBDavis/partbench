import {
  encodeWcadCanonicalCbor,
  sha256Hex,
  resolveAssemblyOccurrence,
  type CadEngine,
  type WcadTopologyCheckpointPayloadInput
} from "@web-cad/cad-core";
import type {
  CadOp,
  AssemblySnapshot,
  AssemblyMateSnapshot
} from "@web-cad/cad-protocol";
import type { CurrentExactBodyArtifactEvidence } from "./currentExactBodyResolver";

/** Copy a selected occurrence's current exact body and only its shared ancestry.
 * All changes remain ordinary commands in the caller's single transaction. */
export function prepareIndependentOccurrence(input: {
  readonly engine: CadEngine;
  readonly rootAssemblyId: string;
  readonly instancePath: readonly string[];
  readonly artifact: CurrentExactBodyArtifactEvidence;
}) {
  const { engine, rootAssemblyId, instancePath, artifact } = input;
  const snapshot = engine.createSnapshot();
  const assemblies = snapshot.assemblies ?? [];
  const selected = resolveAssemblyOccurrence(
    assemblies,
    rootAssemblyId,
    instancePath
  );
  if (
    !selected ||
    selected.instance.definition.kind !== "body" ||
    selected.instance.definition.bodyId !== artifact.bodyId
  )
    throw new Error(
      "Select an existing part occurrence with current exact geometry."
    );
  const sourceBodyId = artifact.bodyId;
  const bodyId = `body_${snapshot.nextBodyNumber}`;
  const featureId = `feat_${snapshot.nextFeatureNumber}`;
  const checkpointIds = new Set(
    snapshot.topologyIdentity?.checkpoints.map(
      (checkpoint) => checkpoint.checkpointId
    ) ?? []
  );
  const assemblyIds = new Set(assemblies.map((assembly) => assembly.id));
  const occupiedInstanceIds = new Set(
    assemblies.flatMap((assembly) =>
      assembly.instances.map((instance) => instance.id)
    )
  );
  const mateIds = new Set(
    assemblies.flatMap((assembly) =>
      (assembly.mates ?? []).map((mate) => mate.id)
    )
  );
  const checkpointId = reserveId(`checkpoint_${bodyId}`, checkpointIds);
  const sourceIdentity = {
    algorithm: "partbench-source-v1" as const,
    sha256: artifact.brepSha256
  };
  const structure = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "project.structure" }
  });
  if (!structure.ok || structure.query !== "project.structure")
    throw new Error("Document structure is unavailable.");
  const sourceFeatureId = structure.bodies.find(
    (b) => b.id === sourceBodyId
  )?.featureId;
  const sourceFeature = snapshot.features.find(
    (feature) => feature.id === sourceFeatureId
  );
  const activeCheckpoints = (
    snapshot.topologyIdentity?.checkpoints ?? []
  ).filter(
    (checkpoint) =>
      checkpoint.bodyId === sourceBodyId &&
      checkpoint.status === "active" &&
      (checkpoint.sourceFeatureId === undefined ||
        checkpoint.sourceFeatureId === sourceFeatureId)
  );
  const existingCheckpoint =
    sourceFeature?.kind === "importedBody"
      ? activeCheckpoints.find(
          (checkpoint) => checkpoint.checkpointId === sourceFeature.checkpointId
        )
      : activeCheckpoints.length === 1
        ? activeCheckpoints[0]
        : undefined;
  if (activeCheckpoints.length > 0 && !existingCheckpoint)
    throw new Error(
      "The selected body has ambiguous active checkpoints; repair its topology source before copying."
    );
  const sourceCheckpointId =
    existingCheckpoint?.checkpointId ??
    reserveId(`checkpoint_copy_source_${bodyId}`, checkpointIds);
  const sourcePayload = checkpointFromArtifact(
    artifact,
    sourceCheckpointId,
    sourceBodyId,
    sourceFeatureId
  );
  const payload = checkpointFromArtifact(
    artifact,
    checkpointId,
    bodyId,
    featureId
  );
  const ops: CadOp[] = [
    ...(!existingCheckpoint
      ? [
          {
            op: "topology.checkpoint.create",
            checkpointId: sourceCheckpointId,
            bodyId: sourceBodyId,
            sourceFeatureId,
            sourceIdentity,
            status: "active"
          } as const
        ]
      : []),
    {
      op: "feature.copyBody",
      id: featureId,
      bodyId,
      name: `${selected.instance.name} copy`,
      sourceBodyId,
      sourceCheckpointId,
      checkpointId
    }
  ];
  const byId = new Map(assemblies.map((a) => [a.id, a]));
  const referenceCounts = new Map<string, number>();
  for (const a of assemblies)
    for (const i of a.instances)
      if (i.definition.kind === "assembly")
        referenceCounts.set(
          i.definition.assemblyId,
          (referenceCounts.get(i.definition.assemblyId) ?? 0) + 1
        );
  let owner = byId.get(rootAssemblyId)!;
  let ownerId = rootAssemblyId;
  let clonedParent = false;
  let instanceIds = new Map(owner.instances.map((i) => [i.id, i.id]));
  const nextPath: string[] = [];
  for (const [depth, originalId] of instancePath.entries()) {
    const instance = owner.instances.find((i) => i.id === originalId);
    const instanceId = instanceIds.get(originalId);
    if (!instance || !instanceId)
      throw new Error("Occurrence path changed before copy.");
    nextPath.push(instanceId);
    if (instance.definition.kind === "body") {
      if (depth !== instancePath.length - 1)
        throw new Error("Occurrence path must end at the selected part.");
      ops.push({
        op: "assembly.instance.replace",
        assemblyId: ownerId,
        instanceId,
        definition: { kind: "body", bodyId }
      });
      return {
        ops,
        checkpointPayloads: [sourcePayload, payload],
        bodyId,
        featureId,
        rootAssemblyId,
        instancePath: nextPath
      };
    }
    const child = byId.get(instance.definition.assemblyId)!;
    const clone: boolean =
      clonedParent || (referenceCounts.get(child.id) ?? 0) > 1;
    if (clone) {
      const id = reserveId(`${bodyId}_assembly_${depth}`, assemblyIds);
      const remap = new Map(
        child.instances.map((i, n) => [
          i.id,
          reserveId(`${bodyId}_instance_${depth}_${n}`, occupiedInstanceIds)
        ])
      );
      ops.push(...cloneAssemblyOps(child, id, remap, mateIds));
      ops.push({
        op: "assembly.instance.replace",
        assemblyId: ownerId,
        instanceId,
        definition: { kind: "assembly", assemblyId: id }
      });
      ownerId = id;
      instanceIds = remap;
    } else {
      ownerId = child.id;
      instanceIds = new Map(child.instances.map((i) => [i.id, i.id]));
    }
    owner = child;
    clonedParent = clone;
  }
  throw new Error("Select a part occurrence to make independent.");
}

function cloneAssemblyOps(
  assembly: AssemblySnapshot,
  id: string,
  ids: ReadonlyMap<string, string>,
  mateIds: Set<string>
): CadOp[] {
  return [
    { op: "assembly.create", id, name: assembly.name },
    ...assembly.instances.map((i) => ({
      op: "assembly.instance.insert" as const,
      ...i,
      id: ids.get(i.id)!,
      assemblyId: id
    })),
    ...(assembly.mates ?? []).map((mate, index) =>
      cloneMate(mate, id, reserveId(`${id}_mate_${index}`, mateIds), ids)
    )
  ];
}

function reserveId(base: string, occupied: Set<string>): string {
  let id = base;
  let suffix = 2;
  while (occupied.has(id)) id = `${base}_${suffix++}`;
  occupied.add(id);
  return id;
}
function cloneMate(
  mate: AssemblyMateSnapshot,
  assemblyId: string,
  id: string,
  ids: ReadonlyMap<string, string>
): CadOp {
  const common = {
    op: "assembly.mate.create" as const,
    assemblyId,
    id,
    name: mate.name
  };
  switch (mate.kind) {
    case "fixed":
      return {
        ...common,
        kind: "fixed",
        instanceId: ids.get(mate.instanceId)!
      };
    case "coincident":
      return {
        ...mate,
        ...common,
        primary: {
          ...mate.primary,
          instanceId: ids.get(mate.primary.instanceId)!
        },
        secondary: {
          ...mate.secondary,
          instanceId: ids.get(mate.secondary.instanceId)!
        }
      };
    case "concentric":
      return {
        ...mate,
        ...common,
        primary: {
          ...mate.primary,
          instanceId: ids.get(mate.primary.instanceId)!
        },
        secondary: {
          ...mate.secondary,
          instanceId: ids.get(mate.secondary.instanceId)!
        }
      };
    // Snapshots include evaluated values; command inputs keep either the value
    // or its parameter binding, never both.
    case "distance":
      return {
        ...common,
        kind: "distance",
        primary: {
          ...mate.primary,
          instanceId: ids.get(mate.primary.instanceId)!
        },
        secondary: {
          ...mate.secondary,
          instanceId: ids.get(mate.secondary.instanceId)!
        },
        ...(mate.distanceParameterId
          ? { distanceParameterId: mate.distanceParameterId }
          : { distance: mate.distance })
      };
    case "revolute":
      return {
        ...common,
        kind: "revolute",
        primary: {
          ...mate.primary,
          instanceId: ids.get(mate.primary.instanceId)!
        },
        secondary: {
          ...mate.secondary,
          instanceId: ids.get(mate.secondary.instanceId)!
        },
        ...(mate.angleParameterId
          ? { angleParameterId: mate.angleParameterId }
          : { angleDegrees: mate.angleDegrees }),
        ...(mate.offsetParameterId
          ? { offsetParameterId: mate.offsetParameterId }
          : { offset: mate.offset })
      };
  }
}

export function checkpointFromArtifact(
  artifact: CurrentExactBodyArtifactEvidence,
  checkpointId: string,
  bodyId: string,
  sourceFeatureId?: string
): WcadTopologyCheckpointPayloadInput {
  if (sha256Hex(artifact.brepBytes) !== artifact.brepSha256)
    throw new Error("Exact copy artifact digest mismatch.");
  return {
    checkpointId,
    bodyId,
    sourceFeatureId,
    units: artifact.units,
    kernel: {
      boundary: "geometry-kernel",
      snapshotAlgorithm: "partbench-derived-topology-snapshot-v1"
    },
    tolerance: { linearTolerance: 0.001, angularToleranceDegrees: 0.01 },
    brepByteLength: artifact.brepByteLength,
    brepSha256: artifact.brepSha256,
    brepBytes: artifact.brepBytes,
    topologyBytes: encodeWcadCanonicalCbor(artifact.topologySnapshot),
    signatureBytes: encodeWcadCanonicalCbor({
      checkpointId,
      signatureAlgorithm: artifact.topologySnapshot.signatureAlgorithm,
      signature: artifact.topologySnapshot.signature,
      entityCount: artifact.topologySnapshot.entityCount,
      entities: artifact.topologySnapshot.entities.map((e) => ({
        localId: e.localId,
        kind: e.kind,
        signature: e.signature
      }))
    })
  };
}
