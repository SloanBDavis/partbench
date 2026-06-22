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
  CadGeneratedFaceReference,
  CadTopologyAnchorSourceRecord,
  CadTopologyEntityKind,
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
  if (source.kind !== "extrude" || source.placementFrame) {
    return undefined;
  }

  const role = stableId.match(/^generated:face:[^:]+:(.+)$/)?.[1];

  if (role !== "startCap" && role !== "endCap") {
    return undefined;
  }

  const axis = getSketchPlaneNormalAxis(source.sketchPlane);
  const planeCoordinate = getExtrudeCapPlaneCoordinate(
    source.side,
    source.depth,
    role
  );
  const matches = candidates.filter(
    (candidate) =>
      candidate.bounds &&
      nearlyEqual(candidate.bounds.min[axis], planeCoordinate) &&
      nearlyEqual(candidate.bounds.max[axis], planeCoordinate)
  );

  return matches.length === 1 ? matches[0] : undefined;
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
