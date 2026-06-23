import type {
  CadDocument,
  CadEngine,
  CadFeatureSummary,
  ExportCadProjectWcadOptions,
  SketchSnapshot,
  WcadPackageExportResult,
  WcadTopologyCheckpointPayloadInput
} from "@web-cad/cad-core";
import {
  encodeWcadCanonicalCbor,
  exportCadProjectWcad
} from "@web-cad/cad-core";
import type {
  CadBodyExactTopologySnapshot,
  CadBodyExactTopologyEntityDescriptor,
  CadBodyDerivedExactMetadataSnapshot,
  CadGeneratedFaceReference,
  CadGeneratedReference,
  CadTopologyGeneratedReferenceCandidate,
  CadTopologyAnchorSourceRecord,
  CadTopologyEntityKind,
  CadTopologyIdentityDiagnostic,
  TopologyAnchorCreationPlanQueryResponse,
  TopologyAnchorRepairPlanQueryResponse,
  WcadTopologyCheckpointSignaturePayload,
  WcadPackageValidationIssue
} from "@web-cad/cad-protocol";
import type { GeometryKernelExactTopologySnapshot } from "@web-cad/geometry-worker";
import {
  createExactMetadataRuntimeInput,
  type DerivedExactMetadataSource
} from "./derivedExactMetadata";
import type { DerivedExtrudeGeometrySource } from "./derivedGeometry";
import type { DerivedGeometryRuntime } from "./derivedGeometryRuntime";
import {
  createEdgeFinishDerivedGeometrySources,
  createExtrudeDerivedGeometrySources,
  createHoleDerivedGeometrySources,
  createRevolveDerivedGeometrySources
} from "./derivedGeometrySources";

export interface ProjectWcadTopologyCheckpointPayloadInput {
  readonly document: CadDocument;
  readonly features: readonly CadFeatureSummary[];
  readonly sketches: readonly SketchSnapshot[];
  readonly generatedFacesByKey?: ReadonlyMap<string, CadGeneratedFaceReference>;
  readonly runtime: Pick<
    DerivedGeometryRuntime,
    "exactTopologyCheckpointPayload"
  >;
}

export interface ProjectWcadTopologyCheckpointExportInput
  extends
    Omit<ProjectWcadTopologyCheckpointPayloadInput, "document">,
    Pick<
      ExportCadProjectWcadOptions,
      "createdAt" | "modifiedAt" | "appVersion"
    > {
  readonly engine: CadEngine;
}

export interface ProjectTopologyAnchorCreationPlanInput extends Omit<
  ProjectWcadTopologyCheckpointPayloadInput,
  "document"
> {
  readonly engine: CadEngine;
  readonly target: Pick<CadGeneratedReference, "bodyId" | "kind" | "stableId">;
}

export interface ProjectTopologyAnchorRepairPlanInput extends Omit<
  ProjectWcadTopologyCheckpointPayloadInput,
  "document"
> {
  readonly engine: CadEngine;
  readonly target: Pick<
    CadGeneratedReference,
    "bodyId" | "kind" | "stableId"
  > & {
    readonly topologyAnchorId?: string;
  };
}

export type ProjectTopologyAnchorCreationPlanResult =
  | {
      readonly ok: true;
      readonly plan: TopologyAnchorCreationPlanQueryResponse;
    }
  | {
      readonly ok: false;
      readonly status: TopologyAnchorCreationPlanQueryResponse["status"];
      readonly message: string;
      readonly diagnostics: readonly CadTopologyIdentityDiagnostic[];
      readonly plan?: TopologyAnchorCreationPlanQueryResponse;
    };

export type ProjectTopologyAnchorRepairPlanResult =
  | {
      readonly ok: true;
      readonly plan: TopologyAnchorRepairPlanQueryResponse;
    }
  | {
      readonly ok: false;
      readonly status: TopologyAnchorRepairPlanQueryResponse["status"];
      readonly message: string;
      readonly diagnostics: readonly CadTopologyIdentityDiagnostic[];
      readonly plan?: TopologyAnchorRepairPlanQueryResponse;
    };

export class ProjectWcadTopologyCheckpointPayloadError extends Error {
  readonly issues: readonly WcadPackageValidationIssue[];

  constructor(issues: readonly WcadPackageValidationIssue[]) {
    super(formatCheckpointPayloadIssues(issues));
    this.name = "ProjectWcadTopologyCheckpointPayloadError";
    this.issues = issues;
  }
}

export function isProjectWcadTopologyCheckpointPayloadError(
  error: unknown
): error is ProjectWcadTopologyCheckpointPayloadError {
  return error instanceof ProjectWcadTopologyCheckpointPayloadError;
}

export async function createProjectTopologyAnchorCreationPlanForGeneratedReference({
  engine,
  features,
  sketches,
  generatedFacesByKey = new Map(),
  runtime,
  target
}: ProjectTopologyAnchorCreationPlanInput): Promise<ProjectTopologyAnchorCreationPlanResult> {
  const document = engine.getDocument();
  const sourceIdentitySignature = readBodySourceIdentitySignature(
    engine,
    target.bodyId
  );

  if (!sourceIdentitySignature) {
    const diagnostic = createTopologyPlanDiagnostic(
      "TOPOLOGY_MATCH_LOW_CONFIDENCE",
      "warning",
      `Body ${target.bodyId} does not have source topology identity for stable reference creation.`,
      {
        bodyId: target.bodyId,
        expected: "source-backed body topology identity",
        received: target.bodyId
      }
    );

    return createTopologyPlanFailure("missing", [diagnostic]);
  }

  const source = createCheckpointExactSourcesByBodyId(
    features,
    sketches,
    generatedFacesByKey,
    document.namedReferences
  ).get(target.bodyId);

  if (!source) {
    const diagnostic = createTopologyPlanDiagnostic(
      "TOPOLOGY_MATCH_UNSUPPORTED",
      "warning",
      `Body ${target.bodyId} does not have a supported exact topology source for stable reference creation.`,
      {
        bodyId: target.bodyId,
        expected: "supported source-backed exact topology source",
        received: target.bodyId
      }
    );

    return createTopologyPlanFailure("unsupported", [diagnostic]);
  }

  const placementError = getSourcePlacementError(source);

  if (placementError) {
    const diagnostic = createTopologyPlanDiagnostic(
      "TOPOLOGY_MATCH_UNSUPPORTED",
      "warning",
      `Body ${target.bodyId} cannot create a stable reference yet: ${placementError}`,
      {
        bodyId: target.bodyId,
        expected: "resolved source placement",
        received: placementError
      }
    );

    return createTopologyPlanFailure("unsupported", [diagnostic]);
  }

  let topologySnapshot: CadBodyExactTopologySnapshot;
  try {
    const result = await runtime.exactTopologyCheckpointPayload({
      ...createExactMetadataRuntimeInput(source),
      checkpointId: createPreviewCheckpointId(target.bodyId, target.stableId),
      bodyId: target.bodyId
    });
    topologySnapshot = createCadTopologySnapshotPayload(
      result.checkpointPayload.topologySnapshot
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Exact topology checkpoint payload generation failed.";
    const diagnostic = createTopologyPlanDiagnostic(
      "TOPOLOGY_SNAPSHOT_EXTRACTION_DEFERRED",
      "warning",
      message,
      {
        bodyId: target.bodyId,
        expected: "derived exact topology snapshot",
        received: "unavailable"
      }
    );

    return createTopologyPlanFailure("missing", [diagnostic]);
  }

  const identity = engine.executeQuery({
    version: "cadops.v1",
    query: {
      query: "body.topologyIdentity",
      bodyId: target.bodyId
    }
  });

  if (!identity.ok || identity.query !== "body.topologyIdentity") {
    const diagnostic = createTopologyPlanDiagnostic(
      "TOPOLOGY_MATCH_LOW_CONFIDENCE",
      "warning",
      identity.ok
        ? `Body ${target.bodyId} topology identity query returned ${identity.query}.`
        : identity.error.message,
      {
        bodyId: target.bodyId,
        expected: "body.topologyIdentity response",
        received: identity.ok ? identity.query : identity.error.code
      }
    );

    return createTopologyPlanFailure("missing", [diagnostic]);
  }

  const candidate = identity.candidates.find(
    (entry) => entry.stableId === target.stableId
  );

  if (!candidate) {
    const diagnostic = createTopologyPlanDiagnostic(
      "TOPOLOGY_MATCH_LOW_CONFIDENCE",
      "warning",
      `Generated reference ${target.stableId} is not available on ${target.bodyId}.`,
      {
        bodyId: target.bodyId,
        expected: "available generated reference",
        received: target.stableId
      }
    );

    return createTopologyPlanFailure("missing", [diagnostic]);
  }

  if (candidate.kind !== target.kind) {
    const diagnostic = createTopologyPlanDiagnostic(
      "TOPOLOGY_MATCH_KIND_MISMATCH",
      "warning",
      `Generated reference ${target.stableId} is a ${candidate.kind}, not a ${target.kind}.`,
      {
        bodyId: target.bodyId,
        entityKind: candidate.kind,
        expected: target.kind,
        received: candidate.kind
      }
    );

    return createTopologyPlanFailure("unsupported", [
      ...candidate.diagnostics,
      diagnostic
    ]);
  }

  const normalized = normalizeTopologySnapshotForGeneratedReference({
    topologySnapshot,
    source,
    target,
    candidate
  });

  if (!normalized.ok) {
    return createTopologyPlanFailure(normalized.status, [
      ...candidate.diagnostics,
      ...normalized.diagnostics
    ]);
  }

  const derivedExactMetadata: CadBodyDerivedExactMetadataSnapshot = {
    bodyId: target.bodyId,
    sourceIdentitySignature,
    status: "ready",
    metadata: {
      source: "kernel-derived",
      confidence: "kernel-derived",
      topologySnapshot: normalized.topologySnapshot,
      diagnostics: normalized.topologySnapshot.diagnostics
    }
  };
  const plan = engine.executeQuery({
    version: "cadops.v1",
    query: {
      query: "topology.anchorCreationPlan",
      bodyId: target.bodyId,
      stableId: target.stableId,
      derivedExactMetadata
    }
  });

  if (!plan.ok || plan.query !== "topology.anchorCreationPlan") {
    const diagnostic = createTopologyPlanDiagnostic(
      "TOPOLOGY_ANCHOR_PERSISTENCE_DEFERRED",
      "warning",
      plan.ok
        ? `Topology anchor creation plan returned ${plan.query}.`
        : plan.error.message,
      {
        bodyId: target.bodyId,
        expected: "topology.anchorCreationPlan response",
        received: plan.ok ? plan.query : plan.error.code
      }
    );

    return createTopologyPlanFailure("unsupported", [diagnostic]);
  }

  if (plan.status !== "ready" && plan.status !== "alreadyExists") {
    return createTopologyPlanFailure(plan.status, plan.diagnostics, plan);
  }

  return { ok: true, plan };
}

export async function createProjectTopologyAnchorRepairPlanForGeneratedReference({
  engine,
  features,
  sketches,
  generatedFacesByKey = new Map(),
  runtime,
  target
}: ProjectTopologyAnchorRepairPlanInput): Promise<ProjectTopologyAnchorRepairPlanResult> {
  if (!target.topologyAnchorId) {
    const diagnostic = createTopologyPlanDiagnostic(
      "TOPOLOGY_REPAIR_COMMANDS_DEFERRED",
      "warning",
      "Stable topology reference repair requires a selected topology anchor.",
      {
        bodyId: target.bodyId,
        entityKind: target.kind,
        expected: "selected generated reference with topology anchor",
        received: target.stableId
      }
    );

    return createTopologyRepairPlanFailure("unsupported", [diagnostic]);
  }

  const creationEvidence =
    await createProjectTopologyAnchorCreationPlanForGeneratedReference({
      engine,
      features,
      sketches,
      generatedFacesByKey,
      runtime,
      target
    });

  if (!creationEvidence.ok) {
    return createTopologyRepairPlanFailure(
      mapTopologyPlanStatusToRepairStatus(creationEvidence.status),
      creationEvidence.diagnostics
    );
  }

  const document = engine.getDocument();
  const sourceIdentitySignature = readBodySourceIdentitySignature(
    engine,
    target.bodyId
  );
  const source = createCheckpointExactSourcesByBodyId(
    features,
    sketches,
    generatedFacesByKey,
    document.namedReferences
  ).get(target.bodyId);

  if (!sourceIdentitySignature || !source) {
    const diagnostic = createTopologyPlanDiagnostic(
      "TOPOLOGY_MATCH_UNSUPPORTED",
      "warning",
      `Body ${target.bodyId} does not have supported exact topology source evidence for stable reference repair.`,
      {
        bodyId: target.bodyId,
        entityKind: target.kind,
        expected: "supported exact topology source and source identity",
        received: target.bodyId
      }
    );

    return createTopologyRepairPlanFailure("unsupported", [diagnostic]);
  }

  const placementError = getSourcePlacementError(source);

  if (placementError) {
    const diagnostic = createTopologyPlanDiagnostic(
      "TOPOLOGY_MATCH_UNSUPPORTED",
      "warning",
      `Body ${target.bodyId} cannot repair a stable reference yet: ${placementError}`,
      {
        bodyId: target.bodyId,
        entityKind: target.kind,
        expected: "resolved source placement",
        received: placementError
      }
    );

    return createTopologyRepairPlanFailure("unsupported", [diagnostic]);
  }

  let topologySnapshot: CadBodyExactTopologySnapshot;
  try {
    const result = await runtime.exactTopologyCheckpointPayload({
      ...createExactMetadataRuntimeInput(source),
      checkpointId: createPreviewCheckpointId(target.bodyId, target.stableId),
      bodyId: target.bodyId
    });
    topologySnapshot = createCadTopologySnapshotPayload(
      result.checkpointPayload.topologySnapshot
    );
  } catch (error) {
    const diagnostic = createTopologyPlanDiagnostic(
      "TOPOLOGY_SNAPSHOT_EXTRACTION_DEFERRED",
      "warning",
      error instanceof Error
        ? error.message
        : "Exact topology checkpoint payload generation failed.",
      {
        bodyId: target.bodyId,
        entityKind: target.kind,
        expected: "derived exact topology snapshot",
        received: "unavailable"
      }
    );

    return createTopologyRepairPlanFailure("missing", [diagnostic]);
  }

  const identity = engine.executeQuery({
    version: "cadops.v1",
    query: {
      query: "body.topologyIdentity",
      bodyId: target.bodyId
    }
  });

  if (!identity.ok || identity.query !== "body.topologyIdentity") {
    const diagnostic = createTopologyPlanDiagnostic(
      "TOPOLOGY_MATCH_LOW_CONFIDENCE",
      "warning",
      identity.ok
        ? `Body ${target.bodyId} topology identity query returned ${identity.query}.`
        : identity.error.message,
      {
        bodyId: target.bodyId,
        entityKind: target.kind,
        expected: "body.topologyIdentity response",
        received: identity.ok ? identity.query : identity.error.code
      }
    );

    return createTopologyRepairPlanFailure("missing", [diagnostic]);
  }

  const candidate = identity.candidates.find(
    (entry) => entry.stableId === target.stableId
  );

  if (!candidate) {
    const diagnostic = createTopologyPlanDiagnostic(
      "TOPOLOGY_MATCH_LOW_CONFIDENCE",
      "warning",
      `Generated reference ${target.stableId} is not available on ${target.bodyId}.`,
      {
        bodyId: target.bodyId,
        entityKind: target.kind,
        expected: "available generated reference",
        received: target.stableId
      }
    );

    return createTopologyRepairPlanFailure("missing", [diagnostic]);
  }

  const normalized = normalizeTopologySnapshotForGeneratedReference({
    topologySnapshot,
    source,
    target,
    candidate
  });

  if (!normalized.ok) {
    return createTopologyRepairPlanFailure(
      mapTopologyPlanStatusToRepairStatus(normalized.status),
      [...candidate.diagnostics, ...normalized.diagnostics]
    );
  }

  const derivedExactMetadata: CadBodyDerivedExactMetadataSnapshot = {
    bodyId: target.bodyId,
    sourceIdentitySignature,
    status: "ready",
    metadata: {
      source: "kernel-derived",
      confidence: "kernel-derived",
      topologySnapshot: normalized.topologySnapshot,
      diagnostics: normalized.topologySnapshot.diagnostics
    }
  };
  const plan = engine.executeQuery({
    version: "cadops.v1",
    query: {
      query: "topology.anchorRepairPlan",
      anchorId: target.topologyAnchorId,
      createReplacementCheckpoint: true,
      derivedExactMetadata
    }
  });

  if (!plan.ok || plan.query !== "topology.anchorRepairPlan") {
    const diagnostic = createTopologyPlanDiagnostic(
      "TOPOLOGY_REPAIR_COMMANDS_DEFERRED",
      "warning",
      plan.ok
        ? `Topology anchor repair plan returned ${plan.query}.`
        : plan.error.message,
      {
        bodyId: target.bodyId,
        entityKind: target.kind,
        expected: "topology.anchorRepairPlan response",
        received: plan.ok ? plan.query : plan.error.code
      }
    );

    return createTopologyRepairPlanFailure("unsupported", [diagnostic]);
  }

  if (plan.status !== "ready" && plan.status !== "alreadyCurrent") {
    return createTopologyRepairPlanFailure(plan.status, plan.diagnostics, plan);
  }

  return { ok: true, plan };
}

export async function createProjectWcadTopologyCheckpointPayloadInputs({
  document,
  features,
  sketches,
  generatedFacesByKey = new Map(),
  runtime
}: ProjectWcadTopologyCheckpointPayloadInput): Promise<
  readonly WcadTopologyCheckpointPayloadInput[]
> {
  const checkpoints = document.topologyIdentity?.checkpoints ?? [];

  if (checkpoints.length === 0) {
    return [];
  }

  const sourcesByBodyId = createCheckpointExactSourcesByBodyId(
    features,
    sketches,
    generatedFacesByKey,
    document.namedReferences
  );
  const issues: WcadPackageValidationIssue[] = [];
  const payloads: WcadTopologyCheckpointPayloadInput[] = [];

  for (const checkpoint of checkpoints) {
    const source = sourcesByBodyId.get(checkpoint.bodyId);

    if (!source) {
      issues.push(
        createCheckpointIssue(
          checkpoint.checkpointId,
          checkpoint.brepEntryPath,
          `Topology checkpoint ${checkpoint.checkpointId} cannot be saved because body ${checkpoint.bodyId} does not have a supported exact source.`
        )
      );
      continue;
    }

    const placementError = getSourcePlacementError(source);

    if (placementError) {
      issues.push(
        createCheckpointIssue(
          checkpoint.checkpointId,
          checkpoint.brepEntryPath,
          `Topology checkpoint ${checkpoint.checkpointId} cannot be saved: ${placementError}`
        )
      );
      continue;
    }

    const exactInput = createExactMetadataRuntimeInput(source);

    try {
      const result = await runtime.exactTopologyCheckpointPayload({
        ...exactInput,
        checkpointId: checkpoint.checkpointId,
        bodyId: checkpoint.bodyId
      });
      const topologySnapshot = createCadTopologySnapshotPayload(
        result.checkpointPayload.topologySnapshot
      );
      const normalizedPayload = normalizeCheckpointPayloadForSourceAnchors({
        checkpointId: checkpoint.checkpointId,
        topologySnapshot,
        signaturePayload: result.checkpointPayload.signaturePayload,
        anchors:
          document.topologyIdentity?.anchors.filter(
            (anchor) => anchor.checkpointId === checkpoint.checkpointId
          ) ?? [],
        source
      });

      payloads.push({
        checkpointId: checkpoint.checkpointId,
        bodyId: checkpoint.bodyId,
        ...(checkpoint.sourceFeatureId
          ? { sourceFeatureId: checkpoint.sourceFeatureId }
          : {}),
        units: document.units,
        kernel: {
          boundary: "geometry-kernel",
          snapshotAlgorithm: "partbench-derived-topology-snapshot-v1"
        },
        tolerance: {
          linearTolerance: 0.001,
          angularToleranceDegrees: 0.01
        },
        brepBytes: result.checkpointPayload.brepBytes,
        topologyBytes: encodeWcadCanonicalCbor(
          normalizedPayload.topologySnapshot
        ),
        signatureBytes: encodeWcadCanonicalCbor(
          normalizedPayload.signaturePayload
        )
      });
    } catch (error) {
      issues.push(
        createCheckpointIssue(
          checkpoint.checkpointId,
          checkpoint.brepEntryPath,
          error instanceof Error
            ? error.message
            : `Topology checkpoint ${checkpoint.checkpointId} payload generation failed.`
        )
      );
    }
  }

  if (issues.length > 0) {
    throw new ProjectWcadTopologyCheckpointPayloadError(issues);
  }

  return payloads;
}

function normalizeCheckpointPayloadForSourceAnchors({
  checkpointId,
  topologySnapshot,
  signaturePayload,
  anchors,
  source
}: {
  readonly checkpointId: string;
  readonly topologySnapshot: CadBodyExactTopologySnapshot;
  readonly signaturePayload: WcadTopologyCheckpointSignaturePayload;
  readonly anchors: readonly CadTopologyAnchorSourceRecord[];
  readonly source: DerivedExactMetadataSource;
}): {
  readonly topologySnapshot: CadBodyExactTopologySnapshot;
  readonly signaturePayload: WcadTopologyCheckpointSignaturePayload;
} {
  if (anchors.length === 0) {
    return { topologySnapshot, signaturePayload };
  }

  const replacements = new Map<
    string,
    Pick<CadBodyExactTopologyEntityDescriptor, "localId" | "signature">
  >();
  const usedSnapshotEntityIds = new Set<string>();
  const usedCheckpointEntityIds = new Set<string>();

  for (const anchor of anchors) {
    const entity = findCheckpointAnchorEntity(anchor, topologySnapshot, source);

    if (!entity) {
      continue;
    }

    if (
      usedSnapshotEntityIds.has(entity.localId) ||
      usedCheckpointEntityIds.has(anchor.checkpointEntityId)
    ) {
      continue;
    }

    usedSnapshotEntityIds.add(entity.localId);
    usedCheckpointEntityIds.add(anchor.checkpointEntityId);
    replacements.set(entity.localId, {
      localId: anchor.checkpointEntityId,
      signature: anchor.signatureHash ?? entity.signature
    });
  }

  if (replacements.size === 0) {
    return { topologySnapshot, signaturePayload };
  }

  const entities = topologySnapshot.entities.map((entity) => {
    const replacement = replacements.get(entity.localId);

    return replacement ? { ...entity, ...replacement } : entity;
  });
  const signature = createNormalizedCheckpointSignature(checkpointId, entities);
  const nextTopologySnapshot: CadBodyExactTopologySnapshot = {
    ...topologySnapshot,
    signature,
    entities
  };
  const nextSignaturePayload: WcadTopologyCheckpointSignaturePayload = {
    ...signaturePayload,
    signature,
    entityCount: entities.length,
    entities: entities.map((entity) => ({
      localId: entity.localId,
      kind: entity.kind,
      signature: entity.signature
    }))
  };

  return {
    topologySnapshot: nextTopologySnapshot,
    signaturePayload: nextSignaturePayload
  };
}

function normalizeTopologySnapshotForGeneratedReference({
  topologySnapshot,
  source,
  target,
  candidate
}: {
  readonly topologySnapshot: CadBodyExactTopologySnapshot;
  readonly source: DerivedExactMetadataSource;
  readonly target: Pick<CadGeneratedReference, "bodyId" | "kind" | "stableId">;
  readonly candidate: CadTopologyGeneratedReferenceCandidate;
}):
  | {
      readonly ok: true;
      readonly topologySnapshot: CadBodyExactTopologySnapshot;
    }
  | {
      readonly ok: false;
      readonly status: TopologyAnchorCreationPlanQueryResponse["status"];
      readonly diagnostics: readonly CadTopologyIdentityDiagnostic[];
    } {
  if (
    target.kind !== "body" &&
    target.kind !== "face" &&
    target.kind !== "edge"
  ) {
    return {
      ok: false,
      status: "unsupported",
      diagnostics: [
        createTopologyPlanDiagnostic(
          "TOPOLOGY_MATCH_UNSUPPORTED",
          "warning",
          `Stable topology reference creation currently supports body, face, and edge references; ${target.kind} is not supported.`,
          {
            bodyId: target.bodyId,
            entityKind: target.kind,
            expected: "body, face, or edge generated reference",
            received: target.kind
          }
        )
      ]
    };
  }

  if (!candidate.geometrySignature) {
    return {
      ok: false,
      status: "unsupported",
      diagnostics: [
        createTopologyPlanDiagnostic(
          "TOPOLOGY_MATCH_UNSUPPORTED",
          "warning",
          `Generated reference ${target.stableId} does not have source geometry signature evidence.`,
          {
            bodyId: target.bodyId,
            entityKind: target.kind,
            expected: "generated-reference geometry signature",
            received: "missing"
          }
        )
      ]
    };
  }

  const geometrySignature = candidate.geometrySignature;
  const entity = findGeneratedReferenceSnapshotEntity(
    target,
    topologySnapshot,
    source
  );

  if (!entity.ok) {
    return entity;
  }

  const localId = createSourceOwnedCheckpointEntityId(target);
  const entities = topologySnapshot.entities.map((entry) =>
    entry.localId === entity.entity.localId
      ? {
          ...entry,
          localId,
          signature: geometrySignature
        }
      : entry
  );
  const nextSnapshot: CadBodyExactTopologySnapshot = {
    ...topologySnapshot,
    entities,
    signature: createNormalizedCheckpointSignature(
      createPreviewCheckpointId(target.bodyId, target.stableId),
      entities
    )
  };

  return {
    ok: true,
    topologySnapshot: nextSnapshot
  };
}

function findGeneratedReferenceSnapshotEntity(
  target: Pick<CadGeneratedReference, "bodyId" | "kind" | "stableId">,
  topologySnapshot: CadBodyExactTopologySnapshot,
  source: DerivedExactMetadataSource
):
  | {
      readonly ok: true;
      readonly entity: CadBodyExactTopologyEntityDescriptor;
    }
  | {
      readonly ok: false;
      readonly status: TopologyAnchorCreationPlanQueryResponse["status"];
      readonly diagnostics: readonly CadTopologyIdentityDiagnostic[];
    } {
  const candidates = topologySnapshot.entities.filter(
    (entity) => entity.kind === target.kind
  );

  if (candidates.length === 0) {
    return {
      ok: false,
      status: "missing",
      diagnostics: [
        createTopologyPlanDiagnostic(
          "TOPOLOGY_MATCH_LOW_CONFIDENCE",
          "warning",
          `Exact topology snapshot has no ${target.kind} entity for ${target.stableId}.`,
          {
            bodyId: target.bodyId,
            entityKind: target.kind,
            expected: `${target.kind} exact topology entity`,
            received: "none"
          }
        )
      ]
    };
  }

  if (target.kind === "body") {
    return chooseOnlySnapshotEntity(target, candidates);
  }

  if (target.kind === "face") {
    const stableFace = findStableExtrudeFaceEntity(
      target.stableId,
      candidates,
      source
    );

    if (stableFace) {
      return { ok: true, entity: stableFace };
    }
  }

  return chooseOnlySnapshotEntity(target, candidates);
}

function chooseOnlySnapshotEntity(
  target: Pick<CadGeneratedReference, "bodyId" | "kind" | "stableId">,
  candidates: readonly CadBodyExactTopologyEntityDescriptor[]
):
  | {
      readonly ok: true;
      readonly entity: CadBodyExactTopologyEntityDescriptor;
    }
  | {
      readonly ok: false;
      readonly status: TopologyAnchorCreationPlanQueryResponse["status"];
      readonly diagnostics: readonly CadTopologyIdentityDiagnostic[];
    } {
  if (candidates.length === 1) {
    return { ok: true, entity: candidates[0] };
  }

  return {
    ok: false,
    status: "ambiguous",
    diagnostics: [
      createTopologyPlanDiagnostic(
        "TOPOLOGY_MATCH_AMBIGUOUS",
        "warning",
        `Exact topology snapshot has ${candidates.length} ${target.kind} entities for ${target.stableId}; stable reference creation needs one source-backed match.`,
        {
          bodyId: target.bodyId,
          entityKind: target.kind,
          expected: "one exact topology entity",
          received: String(candidates.length)
        }
      )
    ]
  };
}

function findCheckpointAnchorEntity(
  anchor: CadTopologyAnchorSourceRecord,
  topologySnapshot: CadBodyExactTopologySnapshot,
  source: DerivedExactMetadataSource
): CadBodyExactTopologyEntityDescriptor | undefined {
  const candidates = topologySnapshot.entities.filter(
    (entity) => entity.kind === anchor.entityKind
  );

  if (anchor.entityKind === "body") {
    return candidates.length === 1 ? candidates[0] : undefined;
  }

  if (anchor.entityKind !== "face" || !anchor.stableId) {
    return candidates.length === 1 ? candidates[0] : undefined;
  }

  const stableFaceEntity = findStableExtrudeFaceEntity(
    anchor.stableId,
    candidates,
    source
  );

  return (
    stableFaceEntity ?? (candidates.length === 1 ? candidates[0] : undefined)
  );
}

function findStableExtrudeFaceEntity(
  stableId: string,
  candidates: readonly CadBodyExactTopologyEntityDescriptor[],
  source: DerivedExactMetadataSource
): CadBodyExactTopologyEntityDescriptor | undefined {
  if (
    source.kind !== "extrude" ||
    source.placementFrame ||
    source.profile.kind !== "rectangle"
  ) {
    return undefined;
  }

  const role = stableId.match(/^generated:face:[^:]+:(.+)$/)?.[1];

  if (!role) {
    return undefined;
  }

  const plane = getExtrudeFacePlane(source, role);

  if (!plane) {
    return undefined;
  }

  const matches = candidates.filter(
    (candidate) =>
      candidate.bounds &&
      nearlyEqual(candidate.bounds.min[plane.axis], plane.coordinate) &&
      nearlyEqual(candidate.bounds.max[plane.axis], plane.coordinate)
  );

  return matches.length === 1 ? matches[0] : undefined;
}

function getExtrudeFacePlane(
  source: DerivedExtrudeGeometrySource,
  role: string
): { readonly axis: 0 | 1 | 2; readonly coordinate: number } | undefined {
  if (role === "startCap" || role === "endCap") {
    return {
      axis: getSketchPlaneNormalAxis(source.sketchPlane),
      coordinate: getExtrudeCapPlaneCoordinate(source.side, source.depth, role)
    };
  }

  if (
    role !== "side:uMin" &&
    role !== "side:uMax" &&
    role !== "side:vMin" &&
    role !== "side:vMax"
  ) {
    return undefined;
  }

  const profile = source.profile;

  if (profile.kind !== "rectangle") {
    return undefined;
  }

  const [uCenter, vCenter] = profile.center;
  const uMin = uCenter - profile.width / 2;
  const uMax = uCenter + profile.width / 2;
  const vMin = vCenter - profile.height / 2;
  const vMax = vCenter + profile.height / 2;

  if (role === "side:uMin" || role === "side:uMax") {
    return {
      axis: getSketchPlaneUAxis(source.sketchPlane),
      coordinate: role === "side:uMin" ? uMin : uMax
    };
  }

  return {
    axis: getSketchPlaneVAxis(source.sketchPlane),
    coordinate: role === "side:vMin" ? vMin : vMax
  };
}

function getSketchPlaneNormalAxis(
  sketchPlane: DerivedExtrudeGeometrySource["sketchPlane"]
): 0 | 1 | 2 {
  if (sketchPlane === "YZ") {
    return 0;
  }

  if (sketchPlane === "XZ") {
    return 1;
  }

  return 2;
}

function getSketchPlaneUAxis(
  sketchPlane: DerivedExtrudeGeometrySource["sketchPlane"]
): 0 | 1 | 2 {
  if (sketchPlane === "YZ") {
    return 1;
  }

  return 0;
}

function getSketchPlaneVAxis(
  sketchPlane: DerivedExtrudeGeometrySource["sketchPlane"]
): 0 | 1 | 2 {
  if (sketchPlane === "XY") {
    return 1;
  }

  return 2;
}

function getExtrudeCapPlaneCoordinate(
  side: DerivedExtrudeGeometrySource["side"],
  depth: number,
  role: "startCap" | "endCap"
): number {
  if (role === "startCap") {
    return side === "symmetric" ? -depth / 2 : 0;
  }

  if (side === "negative") {
    return -depth;
  }

  return side === "symmetric" ? depth / 2 : depth;
}

function nearlyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= 1e-6;
}

function createNormalizedCheckpointSignature(
  checkpointId: string,
  entities: readonly CadBodyExactTopologyEntityDescriptor[]
): string {
  return `partbench-checkpoint-anchor-normalized-v1:${checkpointId}:${entities
    .map((entity) => `${entity.kind}:${entity.localId}:${entity.signature}`)
    .sort()
    .join("|")}`;
}

function createPreviewCheckpointId(bodyId: string, stableId: string): string {
  return `topology_anchor_preview_${sanitizeTopologyIdSegment(
    bodyId
  )}_${hashString(stableId).slice(0, 12)}`;
}

function createSourceOwnedCheckpointEntityId(
  target: Pick<CadGeneratedReference, "bodyId" | "kind" | "stableId">
): string {
  return `topology_entity_${sanitizeTopologyIdSegment(
    target.bodyId
  )}_${target.kind}_${hashString(target.stableId).slice(0, 12)}`;
}

function sanitizeTopologyIdSegment(value: string): string {
  const sanitized = value
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return sanitized.length > 0 ? sanitized : "entity";
}

function hashString(value: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

function readBodySourceIdentitySignature(
  engine: CadEngine,
  bodyId: string
): string | undefined {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: {
      query: "body.topology",
      bodyId
    }
  });

  return response.ok && response.query === "body.topology"
    ? response.topology.sourceIdentity.signature
    : undefined;
}

function createTopologyPlanFailure(
  status: TopologyAnchorCreationPlanQueryResponse["status"],
  diagnostics: readonly CadTopologyIdentityDiagnostic[],
  plan?: TopologyAnchorCreationPlanQueryResponse
): ProjectTopologyAnchorCreationPlanResult {
  return {
    ok: false,
    status,
    message:
      diagnostics[0]?.message ??
      "Stable topology reference creation is unavailable for this selection.",
    diagnostics,
    ...(plan ? { plan } : {})
  };
}

function createTopologyRepairPlanFailure(
  status: TopologyAnchorRepairPlanQueryResponse["status"],
  diagnostics: readonly CadTopologyIdentityDiagnostic[],
  plan?: TopologyAnchorRepairPlanQueryResponse
): ProjectTopologyAnchorRepairPlanResult {
  return {
    ok: false,
    status,
    message:
      diagnostics[0]?.message ??
      "Stable topology reference repair is unavailable for this selection.",
    diagnostics,
    ...(plan ? { plan } : {})
  };
}

function mapTopologyPlanStatusToRepairStatus(
  status: TopologyAnchorCreationPlanQueryResponse["status"]
): TopologyAnchorRepairPlanQueryResponse["status"] {
  switch (status) {
    case "alreadyExists":
    case "ready":
      return "ready";
    case "ambiguous":
      return "ambiguous";
    case "unsupported":
      return "unsupported";
    case "missing":
      return "missing";
  }
}

function createTopologyPlanDiagnostic(
  code: CadTopologyIdentityDiagnostic["code"],
  severity: CadTopologyIdentityDiagnostic["severity"],
  message: string,
  details: Pick<
    CadTopologyIdentityDiagnostic,
    "bodyId" | "entityKind" | "expected" | "received"
  > = {}
): CadTopologyIdentityDiagnostic {
  return {
    code,
    severity,
    status: severity === "error" ? "unavailable" : "supported",
    message,
    ...details
  };
}

export async function exportProjectWcadWithTopologyCheckpoints({
  engine,
  features,
  sketches,
  generatedFacesByKey,
  runtime,
  createdAt,
  modifiedAt,
  appVersion
}: ProjectWcadTopologyCheckpointExportInput): Promise<WcadPackageExportResult> {
  const topologyCheckpoints =
    await createProjectWcadTopologyCheckpointPayloadInputs({
      document: engine.getDocument(),
      features,
      sketches,
      generatedFacesByKey,
      runtime
    });
  const options: ExportCadProjectWcadOptions = {
    ...(createdAt ? { createdAt } : {}),
    ...(modifiedAt ? { modifiedAt } : {}),
    ...(appVersion ? { appVersion } : {}),
    ...(topologyCheckpoints.length > 0 ? { topologyCheckpoints } : {})
  };

  return exportCadProjectWcad(engine, options);
}

function createCheckpointExactSourcesByBodyId(
  features: readonly CadFeatureSummary[],
  sketches: readonly SketchSnapshot[],
  generatedFacesByKey: ReadonlyMap<string, CadGeneratedFaceReference>,
  namedReferences: CadDocument["namedReferences"]
): ReadonlyMap<string, DerivedExactMetadataSource> {
  const includeConsumedBodies = new Set<string>();
  const sources: readonly DerivedExactMetadataSource[] = [
    ...createExtrudeDerivedGeometrySources(
      features,
      sketches,
      generatedFacesByKey,
      includeConsumedBodies
    ),
    ...createRevolveDerivedGeometrySources(
      features,
      sketches,
      generatedFacesByKey,
      includeConsumedBodies
    ),
    ...createHoleDerivedGeometrySources(
      features,
      sketches,
      generatedFacesByKey,
      includeConsumedBodies
    ),
    ...createEdgeFinishDerivedGeometrySources(
      features,
      sketches,
      generatedFacesByKey,
      namedReferences,
      includeConsumedBodies
    )
  ];

  return new Map(sources.map((source) => [source.id, source]));
}

function createCadTopologySnapshotPayload(
  snapshot: GeometryKernelExactTopologySnapshot
): CadBodyExactTopologySnapshot {
  return {
    source: snapshot.source,
    status: snapshot.status,
    entityCounts: snapshot.entityCounts,
    entityCount: snapshot.entityCount,
    entities: snapshot.entities,
    unsupportedEntityKinds: snapshot.unsupportedEntityKinds.filter(
      isCadTopologyEntityKind
    ),
    adjacencyAvailable: snapshot.adjacencyAvailable,
    signatureAlgorithm: snapshot.signatureAlgorithm,
    signature: snapshot.signature,
    diagnostics: snapshot.diagnostics.map((diagnostic) => ({
      code: diagnostic.code,
      message: diagnostic.message
    }))
  };
}

function isCadTopologyEntityKind(
  kind: GeometryKernelExactTopologySnapshot["unsupportedEntityKinds"][number]
): kind is CadTopologyEntityKind {
  return kind !== "solid";
}

function getSourcePlacementError(
  source: DerivedExactMetadataSource
): string | undefined {
  return "placementError" in source ? source.placementError : undefined;
}

function createCheckpointIssue(
  checkpointId: string,
  entryPath: string,
  message: string
): WcadPackageValidationIssue {
  return {
    code: "WCAD_UNSUPPORTED_CHECKPOINT_ENTRY",
    severity: "error",
    message,
    entryPath,
    entryRole: "checkpoint-brep",
    expected: "supported source-backed exact topology checkpoint payload",
    received: checkpointId
  };
}

function formatCheckpointPayloadIssues(
  issues: readonly WcadPackageValidationIssue[]
): string {
  if (issues.length === 0) {
    return "Could not create topology checkpoint payloads.";
  }

  if (issues.length === 1) {
    return (
      issues[0]?.message ?? "Could not create topology checkpoint payload."
    );
  }

  return `Could not create ${issues.length} topology checkpoint payloads.`;
}
