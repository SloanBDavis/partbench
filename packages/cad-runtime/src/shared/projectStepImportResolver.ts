import {
  encodeWcadCanonicalCbor,
  assemblyTransformFromMatrix,
  type WcadTopologyCheckpointPayloadInput,
  type CadProjectImportStepPreviewBody,
  type CadProjectImportStepResolver,
  type CadProjectImportStepResolverInput,
  type CadProjectImportStepResolverResult
} from "@web-cad/cad-core";
import type {
  CadAxisAlignedBounds,
  CadOp,
  CadStepImportDiagnostic,
  CadStepImportTransientPayloadRef,
  Vec3,
  ProjectImportStepResolvedBody,
  WcadSourceIdentity
} from "@web-cad/cad-protocol";
import type { GeometryKernelStepImportDiagnostic } from "@web-cad/geometry-worker";
import type { DerivedStepImportInput } from "./derivedGeometryRuntime";
import type { GeometryKernelStepImportResult } from "@web-cad/geometry-kernel/protocol";

export interface ProjectStepImportRuntime {
  importStep(
    input: DerivedStepImportInput
  ): Promise<GeometryKernelStepImportResult>;
}
import type { ProjectStepImportPayloadStore } from "./projectStepImportPayloadStore";

export {
  createProjectStepImportPayloadStore,
  type ProjectStepImportPayloadStore
} from "./projectStepImportPayloadStore";

export interface ProjectStepImportResolverInput {
  readonly getRuntime: () => ProjectStepImportRuntime;
  readonly payloadStore: ProjectStepImportPayloadStore;
  readonly onPrepared?: (result: CadProjectImportStepResolverResult) => void;
}

export function createProjectStepImportResolver({
  getRuntime,
  payloadStore,
  onPrepared
}: ProjectStepImportResolverInput): CadProjectImportStepResolver {
  return {
    async resolveProjectImportStep(input) {
      const result = await resolveProjectImportStep({
        input,
        runtime: getRuntime(),
        payloadStore
      });
      onPrepared?.(result);
      return result;
    }
  };
}

async function resolveProjectImportStep({
  input,
  runtime,
  payloadStore
}: {
  readonly input: CadProjectImportStepResolverInput;
  readonly runtime: ProjectStepImportRuntime;
  readonly payloadStore: ProjectStepImportPayloadStore;
}): Promise<CadProjectImportStepResolverResult> {
  const bytes = payloadStore.readPayload(input.op.payloadRef);

  if (!bytes) {
    throw new Error(
      `STEP import payload ${input.op.payloadRef.payloadId} is no longer available.`
    );
  }

  validatePayloadRef(input.op.payloadRef, bytes);
  await validatePayloadHash(input.op.payloadRef, bytes);

  const sourceIdentity = await createStepImportSourceIdentity(bytes);
  const prepared = await payloadStore.prepare(
    input.op.payloadRef.payloadId,
    JSON.stringify([
      sourceIdentity.sha256,
      input.document.units,
      input.op.maxBodyCount ?? "auto",
      input.op.sourceFileName
    ]),
    async () => {
      const result = await runtime.importStep({
        id: input.op.payloadRef.payloadId,
        sourceFileName: input.op.sourceFileName,
        bytes,
        units: input.document.units,
        ...(input.op.maxBodyCount !== undefined
          ? { maxBodyCount: input.op.maxBodyCount }
          : {})
      });
      if (!result.bodyCount || result.bodyCount !== result.bodies.length)
        throw new Error("STEP import returned inconsistent body definitions.");
      const encoded = await Promise.all(
        result.bodies.map(async (body) => ({
          topologyBytes: encodeWcadCanonicalCbor(body.topologySnapshot),
          brepSha256: await sha256Hex(body.checkpointPayload.brepBytes)
        }))
      );
      return { result, encoded };
    }
  );
  const { result, encoded } = prepared;
  const resolvedBodies: ProjectImportStepResolvedBody[] = [];
  const previewBodies: CadProjectImportStepPreviewBody[] = [];
  const checkpointPayloads: WcadTopologyCheckpointPayloadInput[] = [];
  const bodyIds = new Map<string, string>();
  const checkpointIds = new Set(
    (input.document.topologyIdentity?.checkpoints ?? []).map(
      (checkpoint) => checkpoint.checkpointId
    )
  );
  const occupiedAssemblyIds = new Set(
    (input.document.assemblies ?? []).map((assembly) => assembly.id)
  );
  const instanceIds = new Set(
    (input.document.assemblies ?? []).flatMap((assembly) =>
      assembly.instances.map((instance) => instance.id)
    )
  );
  const diagnostics = mapStepImportDiagnostics(result.diagnostics, input);
  for (const [index, body] of result.bodies.entries()) {
    const featureId = incrementImportId(input.featureId, index);
    const bodyId = incrementImportId(input.bodyId, index);
    const checkpointId = allocateImportId(
      index === 0 ? input.checkpointId : `checkpoint_${bodyId}`,
      checkpointIds
    );
    bodyIds.set(body.definitionId ?? `part_${index + 1}`, bodyId);
    const name =
      body.bodyName ?? input.op.sourceFileName.replace(/\.(step|stp)$/i, "");
    const detail = { ...input, featureId, bodyId, checkpointId };
    const bodyDiagnostics = mapStepImportDiagnostics(body.diagnostics, detail);
    resolvedBodies.push({
      featureId,
      bodyId,
      checkpointId,
      name,
      sourceIdentity,
      checkpointStatus: "active",
      healingApplied: body.healingApplied,
      ...(body.color ? { color: body.color } : {}),
      ...(bodyDiagnostics.length ? { diagnostics: bodyDiagnostics } : {})
    });
    previewBodies.push({
      featureId,
      bodyId,
      checkpointId,
      name,
      bounds: createStepImportPreviewBounds(body.bounds),
      ...(bodyDiagnostics.length ? { diagnostics: bodyDiagnostics } : {})
    });
    checkpointPayloads.push({
      checkpointId,
      bodyId,
      sourceFeatureId: featureId,
      units: input.document.units,
      kernel: {
        boundary: "geometry-kernel",
        snapshotAlgorithm: "partbench-derived-topology-snapshot-v1"
      },
      tolerance: { linearTolerance: 0.001, angularToleranceDegrees: 0.01 },
      brepByteLength: body.checkpointPayload.brepByteLength,
      brepBytes: body.checkpointPayload.brepBytes,
      brepSha256: encoded[index]!.brepSha256,
      topologyBytes: encoded[index]!.topologyBytes,
      signatureBytes: encodeWcadCanonicalCbor({
        ...body.checkpointPayload.signaturePayload,
        checkpointId
      })
    });
  }
  const assemblyOps: Extract<
    CadOp,
    { op: "assembly.create" | "assembly.instance.insert" }
  >[] = [];
  const assembly = result.assembly;
  const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
  const singleIdentityPart =
    assembly &&
    assembly.definitions.length === 0 &&
    assembly.roots.length === 1 &&
    result.bodyCount === 1 &&
    assembly.roots[0]!.transform.every(
      (v, i) => Math.abs(v - identity[i]!) < 1e-10
    );
  if (assembly && !singleIdentityPart) {
    const prefix = `step_${input.featureId}`;
    const rootId = allocateImportId(`${prefix}_root`, occupiedAssemblyIds);
    const assemblies = new Map(
      assembly.definitions.map((def, index) => [
        def.id,
        allocateImportId(`${prefix}_assembly_${index + 1}`, occupiedAssemblyIds)
      ])
    );
    const root = assembly.roots.length === 1 ? assembly.roots[0] : undefined;
    const adoptRoot =
      root &&
      assemblies.has(root.definitionId) &&
      root.transform.every((v, i) => Math.abs(v - identity[i]!) < 1e-10);
    if (!adoptRoot)
      assemblyOps.push({
        op: "assembly.create",
        id: rootId,
        name: input.op.sourceFileName.replace(/\.(step|stp)$/i, "")
      });
    for (const def of assembly.definitions)
      assemblyOps.push({
        op: "assembly.create",
        id: assemblies.get(def.id)!,
        name: adoptRoot && root.definitionId === def.id ? root.name : def.name
      });
    let nextInstance = 1;
    for (const group of [
      ...(adoptRoot ? [] : [{ id: rootId, components: assembly.roots }]),
      ...assembly.definitions.map((d) => ({
        id: assemblies.get(d.id)!,
        components: d.components
      }))
    ]) {
      for (const occurrence of group.components) {
        const bodyId = bodyIds.get(occurrence.definitionId),
          childId = assemblies.get(occurrence.definitionId);
        if (!bodyId && !childId)
          throw new Error(
            `STEP component ${occurrence.name} has a missing definition.`
          );
        const definitionColor =
          assembly.definitions.find((d) => d.id === occurrence.definitionId)
            ?.color ??
          result.bodies.find((b) => b.definitionId === occurrence.definitionId)
            ?.color;
        const color =
          occurrence.color ??
          definitionColor ??
          (adoptRoot && group.id === assemblies.get(root.definitionId)
            ? root.color
            : undefined);
        assemblyOps.push({
          op: "assembly.instance.insert",
          id: allocateImportId(
            `${prefix}_instance_${nextInstance++}`,
            instanceIds
          ),
          assemblyId: group.id,
          name: occurrence.name,
          definition: bodyId
            ? { kind: "body", bodyId }
            : { kind: "assembly", assemblyId: childId! },
          transform: assemblyTransformFromMatrix(occurrence.transform),
          ...(color ? { color } : {})
        });
      }
    }
  }
  return {
    resolvedBodies,
    previewBodies,
    checkpointPayloads,
    diagnostics,
    ...(assemblyOps.length ? { assemblyOps } : {})
  };
}

function allocateImportId(base: string, occupied: Set<string>): string {
  let id = base,
    suffix = 2;
  while (occupied.has(id)) id = `${base}_${suffix++}`;
  occupied.add(id);
  return id;
}

function incrementImportId(id: string, offset: number): string {
  if (offset === 0) return id;
  const match = /^(.*_)(\d+)$/.exec(id);
  return match
    ? `${match[1]}${Number(match[2]) + offset}`
    : `${id}_${offset + 1}`;
}

function createStepImportPreviewBounds(input: {
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
}): CadAxisAlignedBounds {
  const min = copyFiniteVec3(input.min, "minimum");
  const max = copyFiniteVec3(input.max, "maximum");
  const size: Vec3 = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  const center: Vec3 = [
    (min[0] + max[0]) / 2,
    (min[1] + max[1]) / 2,
    (min[2] + max[2]) / 2
  ];

  return { min, max, size, center };
}

function copyFiniteVec3(
  value: readonly [number, number, number],
  label: string
): Vec3 {
  if (!value.every(Number.isFinite)) {
    throw new Error(`STEP import body ${label} bounds are not finite.`);
  }

  return [value[0], value[1], value[2]];
}

function validatePayloadRef(
  payloadRef: CadStepImportTransientPayloadRef,
  bytes: Uint8Array
): void {
  if (bytes.byteLength !== payloadRef.byteLength) {
    throw new Error(
      `STEP import payload ${payloadRef.payloadId} byte length changed before commit.`
    );
  }
}

async function validatePayloadHash(
  payloadRef: CadStepImportTransientPayloadRef,
  bytes: Uint8Array
): Promise<void> {
  if (!payloadRef.sha256) {
    return;
  }

  const sha256 = await sha256Hex(bytes);

  if (sha256 !== payloadRef.sha256) {
    throw new Error(
      `STEP import payload ${payloadRef.payloadId} hash changed before commit.`
    );
  }
}

async function createStepImportSourceIdentity(
  bytes: Uint8Array
): Promise<WcadSourceIdentity> {
  return {
    algorithm: "partbench-source-v1",
    sha256: await sha256Hex(bytes)
  };
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digestInput = new Uint8Array(bytes);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", digestInput);

  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function mapStepImportDiagnostics(
  diagnostics: readonly GeometryKernelStepImportDiagnostic[],
  input: CadProjectImportStepResolverInput
): readonly CadStepImportDiagnostic[] {
  return diagnostics.map((diagnostic) => ({
    code: diagnostic.code,
    severity: diagnostic.severity,
    message: diagnostic.message,
    featureId: input.featureId,
    bodyId: input.bodyId,
    checkpointId: input.checkpointId
  }));
}
