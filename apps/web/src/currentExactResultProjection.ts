import type {
  CadCurrentExactResultStatus,
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
    const displaySource = displaySourcesByBodyId.get(resolution.bodyId);
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

    return createCurrentExactResultProjection({
      resolution,
      sourceIdentitySignature: input.sourceIdentitySignaturesByBodyId.get(
        resolution.bodyId
      ),
      evidence: [
        projectDisplayEvidence(
          resolution,
          displaySource,
          displayEntriesByBodyId.get(resolution.bodyId)
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
  });
}

function projectDisplayEvidence(
  resolution: CurrentExactBodyResolution,
  source: DerivedGeometrySource | undefined,
  entry: DerivedGeometryEntry | undefined
): CurrentExactResultConsumerEvidence {
  return {
    consumer: "display",
    required: true,
    status: entry ? mapDerivedStatus(entry.status) : "pending",
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
    status: entry ? mapDerivedStatus(entry.status) : "pending",
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
  status: DerivedGeometryEntry["status"] | DerivedExactMetadataEntry["status"]
): CadCurrentExactResultStatus {
  return status === "error" || status === "cancelled" ? "failed" : status;
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
