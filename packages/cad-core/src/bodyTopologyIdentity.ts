import type {
  BodyId,
  CadBodyDerivedExactMetadataSnapshot,
  CadBodyExactTopologyEntityDescriptor,
  CadBodyTopologyStatus,
  CadGeneratedReference,
  CadOpsVersion,
  CadQueryError,
  CadTopologyEntityKind,
  CadTopologyGeneratedReferenceCandidate,
  CadTopologyIdentityDiagnostic,
  CadTopologyIdentitySourceSnapshot,
  CadTopologyMatchSnapshotInput,
  CadTopologySnapshotDescriptor,
  DocumentUnits,
  PartId,
  BodyTopologyIdentityQueryResponse
} from "@web-cad/cad-protocol";

import { createBodyTopology } from "./bodyTopology";
import {
  createBodyGeneratedReferences,
  type GeneratedReferencesDocument
} from "./generatedReferences";
import { sha256Hex } from "./sha256";

export interface CreateBodyTopologyIdentityOptions {
  readonly cadOpsVersion: CadOpsVersion;
  readonly document: GeneratedReferencesDocument & {
    readonly topologyIdentity?: CadTopologyIdentitySourceSnapshot;
  };
  readonly bodyId: BodyId;
  readonly units: DocumentUnits;
  readonly ownerPartId: PartId;
  readonly bodyExists: (bodyId: BodyId) => boolean;
  readonly checkpointId?: string;
  readonly derivedExactMetadata?: CadBodyDerivedExactMetadataSnapshot;
}

export type BodyTopologyIdentityResult =
  | {
      readonly ok: true;
      readonly response: BodyTopologyIdentityQueryResponse;
    }
  | {
      readonly ok: false;
      readonly error: CadQueryError;
    };

const SOURCE_BOUNDARY_NOTE =
  "Body topology identity candidates are derived from authoritative document source, generated-reference contracts, optional topology checkpoint source records, and caller-provided exact topology snapshots.";
const DERIVED_BOUNDARY_NOTE =
  "Exact topology snapshot local ids are checkpoint-local evidence for matching; renderer, mesh, OCCT, GPU, selection-buffer, OPFS, file-handle, viewport, and export artifact identifiers are excluded from public topology identity.";

export function createBodyTopologyIdentity(
  options: CreateBodyTopologyIdentityOptions
): BodyTopologyIdentityResult {
  const topology = createBodyTopology({
    document: options.document,
    bodyId: options.bodyId,
    units: options.units,
    ownerPartId: options.ownerPartId,
    bodyExists: options.bodyExists,
    derivedExactMetadata: options.derivedExactMetadata
  });

  if (!topology.ok) {
    return topology;
  }

  const checkpoint = options.checkpointId
    ? options.document.topologyIdentity?.checkpoints.find(
        (candidate) => candidate.checkpointId === options.checkpointId
      )
    : undefined;
  const diagnostics: CadTopologyIdentityDiagnostic[] = [
    ...createCheckpointDiagnostics(options, checkpoint)
  ];
  const exactTopologySnapshot =
    topology.topology.exactMetadata?.topologySnapshot;

  if (!exactTopologySnapshot) {
    diagnostics.push(
      createDiagnostic(
        "TOPOLOGY_SNAPSHOT_EXTRACTION_DEFERRED",
        "warning",
        `Body ${options.bodyId} does not have a derived exact topology snapshot for V13 generated-reference binding.`,
        {
          bodyId: options.bodyId,
          expected: "derived exact topology snapshot",
          received: topology.topology.status
        }
      )
    );
  } else if (exactTopologySnapshot.status !== "ready") {
    diagnostics.push(
      createDiagnostic(
        "TOPOLOGY_MATCH_UNSUPPORTED",
        "warning",
        `Body ${options.bodyId} topology snapshot is ${exactTopologySnapshot.status}; generated-reference bindings are candidate evidence only.`,
        {
          bodyId: options.bodyId,
          expected: "ready topology snapshot",
          received: exactTopologySnapshot.status
        }
      )
    );
  }

  const sourceFeatureId =
    checkpoint?.sourceFeatureId ?? topology.topology.sourceIdentity.featureId;
  const generatedReferences = createBodyGeneratedReferences(
    options.document,
    options.bodyId,
    options.ownerPartId
  );
  const candidates = generatedReferences
    ? createGeneratedReferenceCandidates({
        references: [
          generatedReferences.body,
          ...generatedReferences.faces,
          ...generatedReferences.edges,
          ...generatedReferences.vertices,
          ...generatedReferences.axes
        ],
        checkpointId: options.checkpointId,
        exactEntities: exactTopologySnapshot?.entities ?? []
      })
    : [];
  const snapshot =
    exactTopologySnapshot &&
    diagnostics.every((issue) => issue.severity !== "error")
      ? {
          snapshotId: createSnapshotId(
            options.bodyId,
            options.checkpointId,
            topology.topology.sourceIdentity.signature
          ),
          ...(options.checkpointId
            ? { checkpointId: options.checkpointId }
            : {}),
          bodyId: options.bodyId,
          ...(sourceFeatureId ? { sourceFeatureId } : {}),
          ...(checkpoint ? { sourceIdentity: checkpoint.sourceIdentity } : {}),
          topologySnapshot: exactTopologySnapshot
        }
      : undefined;
  const descriptor = createDescriptor({
    bodyId: options.bodyId,
    checkpointId: options.checkpointId,
    sourceFeatureId,
    sourceIdentity: checkpoint?.sourceIdentity,
    snapshot,
    status: chooseStatus({
      checkpointStatus: checkpoint?.status,
      topologyStatus: topology.topology.status,
      hasSnapshot: Boolean(exactTopologySnapshot),
      snapshotStatus: exactTopologySnapshot?.status,
      diagnostics
    }),
    diagnostics
  });

  return {
    ok: true,
    response: {
      ok: true,
      query: "body.topologyIdentity",
      cadOpsVersion: options.cadOpsVersion,
      bodyId: options.bodyId,
      status: descriptor.status,
      ...(options.checkpointId ? { checkpointId: options.checkpointId } : {}),
      ...(sourceFeatureId ? { sourceFeatureId } : {}),
      ...(checkpoint ? { sourceIdentity: checkpoint.sourceIdentity } : {}),
      ...(snapshot ? { snapshot } : {}),
      descriptor,
      candidateCount: candidates.length,
      candidates,
      diagnosticCount: diagnostics.length,
      diagnostics,
      sourceBoundaryNote: SOURCE_BOUNDARY_NOTE,
      derivedBoundaryNote: DERIVED_BOUNDARY_NOTE,
      mutatesSource: false
    }
  };
}

function createCheckpointDiagnostics(
  options: CreateBodyTopologyIdentityOptions,
  checkpoint:
    | CadTopologyIdentitySourceSnapshot["checkpoints"][number]
    | undefined
): readonly CadTopologyIdentityDiagnostic[] {
  if (!options.checkpointId) {
    return [];
  }

  if (!checkpoint) {
    return [
      createDiagnostic(
        "TOPOLOGY_PACKAGE_V2_CHECKPOINT_INVALID",
        "error",
        `Topology checkpoint source record does not exist: ${options.checkpointId}.`,
        {
          bodyId: options.bodyId,
          checkpointId: options.checkpointId,
          expected: "existing checkpoint source record",
          received: options.checkpointId
        }
      )
    ];
  }

  const diagnostics: CadTopologyIdentityDiagnostic[] = [];

  if (checkpoint.bodyId !== options.bodyId) {
    diagnostics.push(
      createDiagnostic(
        "TOPOLOGY_SOURCE_CONTRACT_INVALID",
        "error",
        `Topology checkpoint ${checkpoint.checkpointId} belongs to ${checkpoint.bodyId}, not ${options.bodyId}.`,
        {
          bodyId: options.bodyId,
          checkpointId: checkpoint.checkpointId,
          expected: checkpoint.bodyId,
          received: options.bodyId
        }
      )
    );
  }

  if (checkpoint.status !== "active") {
    diagnostics.push(
      createDiagnostic(
        checkpoint.status === "missing"
          ? "TOPOLOGY_PACKAGE_V2_CHECKPOINT_INVALID"
          : "TOPOLOGY_MATCH_UNSUPPORTED",
        checkpoint.status === "missing" ? "error" : "warning",
        `Topology checkpoint ${checkpoint.checkpointId} is ${checkpoint.status}.`,
        {
          bodyId: options.bodyId,
          checkpointId: checkpoint.checkpointId,
          expected: "active checkpoint",
          received: checkpoint.status
        }
      )
    );
  }

  return diagnostics;
}

function createGeneratedReferenceCandidates(input: {
  readonly references: readonly CadGeneratedReference[];
  readonly checkpointId?: string;
  readonly exactEntities: readonly CadBodyExactTopologyEntityDescriptor[];
}): readonly CadTopologyGeneratedReferenceCandidate[] {
  return input.references.map((reference) => {
    const geometrySignature =
      createGeneratedReferenceTopologySignature(reference);
    const matchingEntities = input.exactEntities.filter(
      (entity) =>
        entity.kind === reference.kind && entity.signature === geometrySignature
    );
    const diagnostics = createCandidateDiagnostics(reference, matchingEntities);
    const matchedEntity =
      matchingEntities.length === 1 ? matchingEntities[0] : undefined;

    return {
      stableId: reference.stableId,
      kind: reference.kind,
      bodyId: reference.bodyId,
      sourceFeatureId: reference.sourceFeatureId,
      ...(input.checkpointId ? { checkpointId: input.checkpointId } : {}),
      ...(matchedEntity ? { checkpointEntityId: matchedEntity.localId } : {}),
      status:
        matchingEntities.length === 1
          ? "bound"
          : matchingEntities.length > 1
            ? "ambiguous"
            : input.exactEntities.length > 0
              ? "missing"
              : "candidate",
      confidence:
        matchingEntities.length === 1
          ? "exact"
          : matchingEntities.length > 1
            ? "low"
            : "none",
      sourceSemanticRole: extractGeneratedReferenceRole(reference),
      geometrySignature,
      diagnosticCount: diagnostics.length,
      diagnostics
    };
  });
}

function createCandidateDiagnostics(
  reference: CadGeneratedReference,
  matchingEntities: readonly CadBodyExactTopologyEntityDescriptor[]
): readonly CadTopologyIdentityDiagnostic[] {
  if (matchingEntities.length === 1) {
    return [
      createDiagnostic(
        "TOPOLOGY_MATCH_EXACT",
        "info",
        `Generated reference ${reference.stableId} is bound to one exact topology snapshot entity.`,
        {
          bodyId: reference.bodyId,
          received: reference.stableId
        }
      )
    ];
  }

  if (matchingEntities.length > 1) {
    return [
      createDiagnostic(
        "TOPOLOGY_MATCH_AMBIGUOUS",
        "warning",
        `Generated reference ${reference.stableId} has multiple exact topology snapshot candidates.`,
        {
          bodyId: reference.bodyId,
          expected: "one exact topology entity",
          received: String(matchingEntities.length)
        }
      )
    ];
  }

  return [
    createDiagnostic(
      "TOPOLOGY_MATCH_LOW_CONFIDENCE",
      "warning",
      `Generated reference ${reference.stableId} has no exact topology entity binding yet.`,
      {
        bodyId: reference.bodyId,
        expected: "matching exact topology entity signature",
        received: reference.stableId
      }
    )
  ];
}

function createDescriptor(input: {
  readonly bodyId: BodyId;
  readonly checkpointId?: string;
  readonly sourceFeatureId?: string;
  readonly sourceIdentity?: CadTopologySnapshotDescriptor["sourceIdentity"];
  readonly snapshot?: CadTopologyMatchSnapshotInput;
  readonly status: CadTopologySnapshotDescriptor["status"];
  readonly diagnostics: readonly CadTopologyIdentityDiagnostic[];
}): CadTopologySnapshotDescriptor {
  return {
    ...(input.snapshot?.snapshotId
      ? { snapshotId: input.snapshot.snapshotId }
      : {}),
    ...(input.checkpointId ? { checkpointId: input.checkpointId } : {}),
    bodyId: input.bodyId,
    ...(input.sourceFeatureId
      ? { sourceFeatureId: input.sourceFeatureId }
      : {}),
    ...(input.sourceIdentity ? { sourceIdentity: input.sourceIdentity } : {}),
    entityKinds:
      input.snapshot?.topologySnapshot.entities
        .filter(isPublicTopologyEntity)
        .map((entity) => entity.kind) ?? [],
    entityCount: input.snapshot?.topologySnapshot.entityCount ?? 0,
    status: input.status,
    diagnostics: input.diagnostics
  };
}

function chooseStatus(input: {
  readonly checkpointStatus?: CadTopologySnapshotDescriptor["status"];
  readonly topologyStatus: CadBodyTopologyStatus;
  readonly hasSnapshot: boolean;
  readonly snapshotStatus?: "ready" | "partial";
  readonly diagnostics: readonly CadTopologyIdentityDiagnostic[];
}): CadTopologySnapshotDescriptor["status"] {
  if (input.diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return "missing";
  }

  if (input.checkpointStatus && input.checkpointStatus !== "active") {
    return input.checkpointStatus;
  }

  if (input.topologyStatus === "stale") {
    return "stale";
  }

  if (
    input.topologyStatus === "kernel-failed" ||
    input.topologyStatus === "unavailable-binding"
  ) {
    return "failed";
  }

  if (!input.hasSnapshot) {
    return "missing";
  }

  return input.snapshotStatus === "ready" ? "active" : "unsupported";
}

function createGeneratedReferenceTopologySignature(
  reference: CadGeneratedReference
): string {
  return `generated-reference:v13:${sha256Hex(
    new TextEncoder().encode(
      JSON.stringify({
        stableId: reference.stableId,
        kind: reference.kind,
        bodyId: reference.bodyId,
        sourceFeatureId: reference.sourceFeatureId,
        role: extractGeneratedReferenceRole(reference),
        geometricSignature: reference.geometricSignature
      })
    )
  )}`;
}

function extractGeneratedReferenceRole(
  reference: CadGeneratedReference
): string | undefined {
  if ("role" in reference) {
    return reference.role;
  }

  return reference.kind;
}

function createDiagnostic(
  code: CadTopologyIdentityDiagnostic["code"],
  severity: CadTopologyIdentityDiagnostic["severity"],
  message: string,
  details: Pick<
    CadTopologyIdentityDiagnostic,
    "bodyId" | "checkpointId" | "expected" | "received"
  > = {}
): CadTopologyIdentityDiagnostic {
  return {
    code,
    status: severity === "error" ? "unavailable" : "supported",
    severity,
    message,
    ...details
  };
}

function createSnapshotId(
  bodyId: BodyId,
  checkpointId: string | undefined,
  sourceSignature: string
): string {
  return `body-topology-identity:${checkpointId ?? bodyId}:${sourceSignature}`;
}

function isPublicTopologyEntity(
  entity: CadBodyExactTopologyEntityDescriptor
): entity is CadBodyExactTopologyEntityDescriptor & {
  readonly kind: CadTopologyEntityKind;
} {
  return entity.kind !== "solid";
}
