import type {
  CadDocument,
  CadFeatureSummary,
  SketchSnapshot,
  WcadTopologyCheckpointPayloadInput
} from "@web-cad/cad-core";
import { encodeWcadCanonicalCbor } from "@web-cad/cad-core";
import type {
  CadBodyExactTopologySnapshot,
  CadGeneratedFaceReference,
  CadTopologyEntityKind,
  WcadPackageValidationIssue
} from "@web-cad/cad-protocol";
import type { GeometryKernelExactTopologySnapshot } from "@web-cad/geometry-worker";
import {
  createExactMetadataRuntimeInput,
  type DerivedExactMetadataSource
} from "./derivedExactMetadata";
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
        topologyBytes: encodeWcadCanonicalCbor(topologySnapshot),
        signatureBytes: encodeWcadCanonicalCbor(
          result.checkpointPayload.signaturePayload
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
