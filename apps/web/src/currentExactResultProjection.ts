import {
  CAD_DOWNSTREAM_BODY_OPERATIONS,
  createCadDownstreamBodyPolicyProjection
} from "@web-cad/cad-core";
import type {
  CadExactArtifactEvidence,
  CadExactBodyShapePolicy,
  CadCurrentExactResultStatus,
  CadCurrentExactResult,
  CadExactResultDiagnostic
} from "@web-cad/cad-protocol";

import type { CurrentExactBodyResolution } from "./currentExactBodyResolver";
import {
  createDerivedGeometryCacheKey,
  type DerivedGeometryEntry,
  type DerivedGeometrySnapshot,
  type DerivedGeometrySource
} from "./derivedGeometry";
import {
  createDerivedExactMetadataCacheKey,
  type DerivedExactMetadataEntry,
  type DerivedExactMetadataSnapshot,
  type DerivedExactMetadataSource
} from "./derivedExactMetadata";

export type CurrentExactResultConsumer =
  | "display"
  | "metadata"
  | "topology"
  | "checkpoint"
  | "export";

export interface CurrentExactResultConsumerEvidence {
  readonly consumer: CurrentExactResultConsumer;
  readonly required: boolean;
  readonly status: CadCurrentExactResultStatus;
  readonly sourceIdentitySignature?: string;
  readonly cacheKey?: string;
  readonly expectedCacheKey?: string;
  readonly diagnostics?: readonly CadExactResultDiagnostic[];
}

export interface CurrentExactResultConsumerProjection {
  readonly consumer: CurrentExactResultConsumer;
  readonly required: boolean;
  readonly status: CadCurrentExactResultStatus;
  readonly diagnostics: readonly CadExactResultDiagnostic[];
}

export interface CurrentExactResultProjection {
  readonly bodyId: string;
  readonly sourceType: CurrentExactBodyResolution["sourceType"];
  readonly sourceIdentitySignature?: string;
  readonly status: CadCurrentExactResultStatus;
  readonly ready: boolean;
  readonly diagnostics: readonly CadExactResultDiagnostic[];
  readonly consumers: readonly CurrentExactResultConsumerProjection[];
  readonly shapePolicy?: CadExactBodyShapePolicy;
  readonly artifactEvidence?: CadExactArtifactEvidence;
}

export function createCurrentExactResultProjection(input: {
  readonly resolution: CurrentExactBodyResolution;
  readonly sourceIdentitySignature?: string;
  readonly evidence: readonly CurrentExactResultConsumerEvidence[];
}): CurrentExactResultProjection {
  const sourceIdentitySignature =
    input.resolution.status === "ready"
      ? input.resolution.sourceIdentitySignature
      : input.sourceIdentitySignature;
  const consumers = input.evidence.map((evidence) =>
    projectConsumer(input.resolution, sourceIdentitySignature, evidence)
  );
  const status =
    input.resolution.status === "ready"
      ? selectStatus(consumers)
      : input.resolution.status;
  const diagnostics =
    input.resolution.status === "ready"
      ? consumers.flatMap((consumer) =>
          consumer.status === status ? consumer.diagnostics : []
        )
      : input.resolution.diagnostics;

  return {
    bodyId: input.resolution.bodyId,
    sourceType: input.resolution.sourceType,
    ...(sourceIdentitySignature ? { sourceIdentitySignature } : {}),
    status,
    ready: status === "ready",
    diagnostics,
    consumers
  };
}

export function createCurrentExactResultProjections(input: {
  readonly resolutions: readonly CurrentExactBodyResolution[];
  readonly sourceIdentitySignaturesByBodyId: ReadonlyMap<string, string>;
  readonly displaySources: readonly DerivedGeometrySource[];
  readonly display: DerivedGeometrySnapshot;
  readonly metadataSources: readonly DerivedExactMetadataSource[];
  readonly metadata: DerivedExactMetadataSnapshot;
}): readonly CurrentExactResultProjection[] {
  const displaySourcesByBodyId = new Map(
    input.displaySources.map((source) => [source.id, source] as const)
  );
  const displayEntriesByBodyId = new Map(
    input.display.entries.map(
      (entry) => [entry.sourceId ?? entry.objectId, entry] as const
    )
  );
  const metadataSourcesByBodyId = new Map(
    input.metadataSources.map((source) => [source.id, source] as const)
  );
  const metadataEntriesByBodyId = new Map(
    input.metadata.entries.map((entry) => [entry.bodyId, entry] as const)
  );

  return input.resolutions.map((resolution) => {
    const displaySourceId =
      resolution.status === "ready" && "object" in resolution.source
        ? resolution.source.object.id
        : resolution.bodyId;
    const displaySource = displaySourcesByBodyId.get(displaySourceId);
    const metadataSource = metadataSourcesByBodyId.get(resolution.bodyId);
    const metadataEvidence = projectMetadataEvidence(
      resolution,
      metadataSource,
      metadataEntriesByBodyId.get(resolution.bodyId)
    );
    const checkpointRequired =
      resolution.status === "ready" &&
      (resolution.source.kind === "importedBody" ||
        resolution.source.kind === "checkpointBoolean" ||
        resolution.source.kind === "checkpointHole" ||
        resolution.source.kind === "checkpointEdgeFinish");

    const projection = createCurrentExactResultProjection({
      resolution,
      sourceIdentitySignature: input.sourceIdentitySignaturesByBodyId.get(
        resolution.bodyId
      ),
      evidence: [
        projectDisplayEvidence(
          resolution,
          displaySource,
          displayEntriesByBodyId.get(displaySourceId)
        ),
        metadataEvidence,
        { ...metadataEvidence, consumer: "topology" },
        {
          consumer: "checkpoint",
          required: checkpointRequired,
          status: "ready",
          ...(resolution.status === "ready"
            ? {
                sourceIdentitySignature: resolution.sourceIdentitySignature
              }
            : {})
        },
        { consumer: "export", required: false, status: "ready" }
      ]
    });
    const exactShape = projectExactShapeEvidence(
      resolution,
      metadataSource,
      metadataEntriesByBodyId.get(resolution.bodyId)
    );
    return projection.status === "ready" && exactShape
      ? { ...projection, ...exactShape }
      : projection;
  });
}

export function toCadCurrentExactResults(
  projections: readonly CurrentExactResultProjection[]
): readonly CadCurrentExactResult[] {
  return projections.map((projection) => {
    if (projection.status === "ready" && projection.sourceIdentitySignature) {
      return {
        status: "ready",
        bodyId: projection.bodyId,
        sourceType: projection.sourceType,
        sourceIdentitySignature: projection.sourceIdentitySignature,
        ...(projection.artifactEvidence
          ? { artifactEvidence: projection.artifactEvidence }
          : {}),
        ...(projection.shapePolicy
          ? {
              downstreamReadiness: CAD_DOWNSTREAM_BODY_OPERATIONS.map(
                (operation) =>
                  createCadDownstreamBodyPolicyProjection({
                    bodyId: projection.bodyId,
                    sourceType: projection.sourceType,
                    operation,
                    lifecycle: "active",
                    dependencyStatus: "healthy",
                    dependencyCycle: false,
                    exactStatus: "ready",
                    shapePolicy: projection.shapePolicy,
                    diagnostics: projection.diagnostics
                  }).readiness
              )
            }
          : {}),
        diagnostics: projection.diagnostics
      };
    }
    return {
      status: projection.status === "ready" ? "blocked" : projection.status,
      bodyId: projection.bodyId,
      sourceType: projection.sourceType,
      diagnostics:
        projection.status === "ready"
          ? [
              {
                code: "EXPORT_EXACT_SOURCE_UNAVAILABLE",
                status: "blocked",
                message: `Exact result for body ${projection.bodyId} has no current source identity.`,
                bodyId: projection.bodyId,
                sourceType: projection.sourceType
              }
            ]
          : projection.diagnostics
    };
  });
}

function projectExactShapeEvidence(
  resolution: CurrentExactBodyResolution,
  source: DerivedExactMetadataSource | undefined,
  entry: DerivedExactMetadataEntry | undefined
):
  | {
      readonly shapePolicy: CadExactBodyShapePolicy;
      readonly artifactEvidence?: CadExactArtifactEvidence;
    }
  | undefined {
  if (resolution.status !== "ready" || entry?.status !== "ready") {
    return undefined;
  }
  const shapePolicy =
    entry.metadata.topologyCounts.solidCount === 1
      ? ("singleSolid" as const)
      : ("singleShapeOneOrMoreSolids" as const);
  if (source?.kind !== "exactBody" || source.source.kind !== "bodyArtifact") {
    return { shapePolicy };
  }
  const artifact = source.source;
  return {
    shapePolicy,
    artifactEvidence: {
      bodyId: resolution.bodyId,
      sourceType: resolution.sourceType,
      documentSourceIdentity: artifact.documentSourceIdentity,
      bodySourceIdentitySignature: artifact.bodySourceIdentitySignature,
      sourceGraphNodeCount: artifact.sourceGraphNodeCount,
      brepFormat: artifact.brepFormat,
      brepByteLength: artifact.brepByteLength,
      brepSha256: artifact.brepSha256,
      shapePolicy,
      topologySignature: artifact.topologySignature
    }
  };
}

function projectDisplayEvidence(
  resolution: CurrentExactBodyResolution,
  source: DerivedGeometrySource | undefined,
  entry: DerivedGeometryEntry | undefined
): CurrentExactResultConsumerEvidence {
  return {
    consumer: "display",
    required: true,
    status: entry ? mapDerivedStatus(entry) : "pending",
    ...(resolution.status === "ready"
      ? { sourceIdentitySignature: resolution.sourceIdentitySignature }
      : {}),
    ...(entry ? { cacheKey: entry.cacheKey } : {}),
    ...(source
      ? { expectedCacheKey: createDerivedGeometryCacheKey(source) }
      : {})
  };
}

function projectMetadataEvidence(
  resolution: CurrentExactBodyResolution,
  source: DerivedExactMetadataSource | undefined,
  entry: DerivedExactMetadataEntry | undefined
): CurrentExactResultConsumerEvidence {
  return {
    consumer: "metadata",
    required: true,
    status: entry ? mapDerivedStatus(entry) : "pending",
    ...(resolution.status === "ready"
      ? { sourceIdentitySignature: resolution.sourceIdentitySignature }
      : {}),
    ...(entry ? { cacheKey: entry.cacheKey } : {}),
    ...(source
      ? { expectedCacheKey: createDerivedExactMetadataCacheKey(source) }
      : {})
  };
}

function mapDerivedStatus(
  entry: DerivedGeometryEntry | DerivedExactMetadataEntry
): CadCurrentExactResultStatus {
  if (entry.status === "error") {
    return entry.error.code === "UNAVAILABLE_BINDING" ? "blocked" : "failed";
  }
  return entry.status === "cancelled" ? "failed" : entry.status;
}

function projectConsumer(
  resolution: CurrentExactBodyResolution,
  sourceIdentitySignature: string | undefined,
  evidence: CurrentExactResultConsumerEvidence
): CurrentExactResultConsumerProjection {
  if (!evidence.required) {
    return {
      consumer: evidence.consumer,
      required: false,
      status: "ready",
      diagnostics: []
    };
  }
  if (resolution.status !== "ready") {
    return {
      consumer: evidence.consumer,
      required: true,
      status: resolution.status,
      diagnostics: resolution.diagnostics
    };
  }
  if (evidence.status === "pending") {
    return withDiagnostic(resolution, evidence, "pending");
  }
  if (
    (sourceIdentitySignature &&
      evidence.sourceIdentitySignature &&
      evidence.sourceIdentitySignature !== sourceIdentitySignature) ||
    (evidence.expectedCacheKey !== undefined &&
      evidence.cacheKey !== evidence.expectedCacheKey)
  ) {
    return withDiagnostic(resolution, evidence, "stale");
  }
  return withDiagnostic(resolution, evidence, evidence.status);
}

function withDiagnostic(
  resolution: Extract<CurrentExactBodyResolution, { readonly status: "ready" }>,
  evidence: CurrentExactResultConsumerEvidence,
  status: CadCurrentExactResultStatus
): CurrentExactResultConsumerProjection {
  return {
    consumer: evidence.consumer,
    required: evidence.required,
    status,
    diagnostics:
      evidence.diagnostics ??
      (status === "ready"
        ? []
        : [
            {
              code:
                status === "unsupported"
                  ? "EXPORT_BODY_SOURCE_UNSUPPORTED"
                  : status === "failed"
                    ? "EXPORT_EXACT_ARTIFACT_FAILED"
                    : status === "stale"
                      ? "EXPORT_EXACT_SOURCE_STALE"
                      : "EXPORT_EXACT_SOURCE_UNAVAILABLE",
              status,
              message: `${formatConsumer(evidence.consumer)} result for body ${resolution.bodyId} is ${status}.`,
              bodyId: resolution.bodyId,
              sourceType: resolution.sourceType
            }
          ])
  };
}

function selectStatus(
  consumers: readonly CurrentExactResultConsumerProjection[]
): CadCurrentExactResultStatus {
  for (const status of [
    "unsupported",
    "blocked",
    "pending",
    "failed",
    "stale"
  ] as const) {
    if (
      consumers.some(
        (consumer) => consumer.required && consumer.status === status
      )
    ) {
      return status;
    }
  }
  return "ready";
}

function formatConsumer(consumer: CurrentExactResultConsumer): string {
  return consumer === "metadata"
    ? "Exact properties"
    : consumer === "topology"
      ? "Body topology"
      : consumer === "checkpoint"
        ? "Saved shape evidence"
        : consumer === "export"
          ? "Exact export"
          : "Display";
}
