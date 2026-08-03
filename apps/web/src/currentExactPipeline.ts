import type { CadEngine } from "@web-cad/cad-core";
import type { WcadSourceIdentity } from "@web-cad/cad-protocol";
import type { GeometryKernelExactBodyArtifact } from "@web-cad/geometry-worker";
import { createRenderMeshFromSerializableMesh } from "@web-cad/renderer-mesh-bridge";

import {
  createCurrentExactBodyArtifactLeaf,
  getReadyRuntimeExactSources,
  resolveCurrentExactBodies,
  type CurrentExactBodyArtifactEvidence,
  type CurrentExactBodyResolverInput,
  type CurrentExactBodyResolution
} from "./currentExactBodyResolver";
import { createDerivedGeometryErrorDetails } from "./derivedGeometryRuntime";
import {
  createCurrentExactResultProjections,
  toCadCurrentExactResults
} from "./currentExactResultProjection";
import type {
  DerivedGeometryEntry,
  DerivedGeometryReadyEntry,
  DerivedGeometrySnapshot,
  DerivedGeometrySource,
  DerivedExactBodyGeometrySource
} from "./derivedGeometry";
import { createDerivedGeometryCacheKey } from "./derivedGeometry";
import type {
  DerivedExactMetadataEntry,
  DerivedExactMetadataReadyEntry,
  DerivedExactMetadataSnapshot,
  DerivedExactMetadataSource
} from "./derivedExactMetadata";
import { createDerivedExactMetadataCacheKey } from "./derivedExactMetadata";
import { createCurrentDerivedExactMetadataSnapshots } from "./projectExactExportQueries";

export type CurrentExactProjectionArtifact = CurrentExactBodyArtifactEvidence &
  Pick<GeometryKernelExactBodyArtifact, "metadata" | "displayMesh">;

export interface CurrentExactProjectionFailure {
  readonly bodyId: string;
  readonly sourceType: CurrentExactBodyResolution["sourceType"];
  readonly cacheKeySha256: string;
  readonly status: "cancelled" | "error";
  readonly error: unknown;
}

export function createCurrentExactSources(
  input: CurrentExactBodyResolverInput
) {
  const resolutions = resolveCurrentExactBodies(input);
  const metadataSources = getReadyRuntimeExactSources(resolutions);
  const displaySources = metadataSources.filter(
    (source) => source.kind === "exactBody"
  );
  const replacedIds = new Set([
    ...displaySources.map((source) => source.id),
    ...resolutions.flatMap((resolution) =>
      resolution.sourceType === "linearPatternFeature" ||
      resolution.sourceType === "circularPatternFeature" ||
      resolution.sourceType === "mirrorFeature" ||
      resolution.sourceType === "shellFeature"
        ? [resolution.bodyId]
        : []
    )
  ]);
  const derivedGeometrySources = [
    ...input.geometrySources.filter((source) => !replacedIds.has(source.id)),
    ...displaySources
  ];
  return {
    resolutions,
    metadataSources,
    displaySources,
    derivedGeometrySources
  };
}

export function projectCurrentExactBodyArtifacts(input: {
  readonly artifacts: readonly CurrentExactProjectionArtifact[];
  readonly failures?: readonly CurrentExactProjectionFailure[];
  readonly current?: {
    readonly resolutions: readonly Extract<
      CurrentExactBodyResolution,
      { readonly status: "ready" }
    >[];
    readonly documentSourceIdentity?: WcadSourceIdentity;
  };
  readonly display: DerivedGeometrySnapshot;
  readonly metadata: DerivedExactMetadataSnapshot;
}): {
  readonly display: DerivedGeometrySnapshot;
  readonly metadata: DerivedExactMetadataSnapshot;
  readonly artifactSources: readonly DerivedExactBodyGeometrySource[];
} {
  const resolutions = input.current
    ? new Map(
        input.current.resolutions.map(
          (resolution) => [resolution.bodyId, resolution] as const
        )
      )
    : undefined;
  const currentIdentity = input.current?.documentSourceIdentity;
  const artifacts = input.artifacts.filter((artifact) => {
    if (!resolutions || !input.current) return true;
    const resolution = resolutions.get(artifact.bodyId);
    return (
      resolution?.status === "ready" &&
      resolution.sourceType === artifact.sourceType &&
      resolution.sourceIdentitySignature ===
        artifact.bodySourceIdentitySignature &&
      resolution.cacheKeySha256 === artifact.sourceCacheKeySha256 &&
      currentIdentity &&
      artifact.documentSourceIdentity.algorithm === currentIdentity.algorithm &&
      artifact.documentSourceIdentity.sha256 === currentIdentity.sha256
    );
  });
  const failures = input.failures?.filter((failure) => {
    if (!resolutions) return true;
    const resolution = resolutions.get(failure.bodyId);
    return (
      resolution?.sourceType === failure.sourceType &&
      resolution.cacheKeySha256 === failure.cacheKeySha256
    );
  });
  if (artifacts.length === 0 && !failures?.length) {
    return {
      display: input.display,
      metadata: input.metadata,
      artifactSources: []
    };
  }

  const artifactsByBodyId = new Map(
    artifacts.map((artifact) => [artifact.bodyId, artifact] as const)
  );
  const artifactSources = [...artifactsByBodyId.values()].map(
    createArtifactEvidenceSource
  );
  const failuresByBodyId = new Map(
    (failures ?? [])
      .filter((failure) => !artifactsByBodyId.has(failure.bodyId))
      .map((failure) => [failure.bodyId, failure] as const)
  );
  const displayEntries = replaceProjectionEntries(
    input.display.entries,
    artifactsByBodyId,
    failuresByBodyId,
    (entry) => entry.sourceId ?? entry.objectId,
    createArtifactDisplayEntry,
    createFailureDisplayEntry
  );
  const metadataEntries = replaceProjectionEntries(
    input.metadata.entries,
    artifactsByBodyId,
    failuresByBodyId,
    (entry) => entry.bodyId,
    createArtifactMetadataEntry,
    createFailureMetadataEntry
  );

  return {
    display: createDisplaySnapshot(displayEntries),
    metadata: createMetadataSnapshot(metadataEntries),
    artifactSources
  };
}

export function createCurrentExactEvidence(input: {
  readonly engine: CadEngine;
  readonly resolutions: ReturnType<typeof resolveCurrentExactBodies>;
  readonly sourceIdentitySignaturesByBodyId: ReadonlyMap<string, string>;
  readonly displaySources: readonly DerivedGeometrySource[];
  readonly display: DerivedGeometrySnapshot;
  readonly metadataSources: readonly DerivedExactMetadataSource[];
  readonly metadata: DerivedExactMetadataSnapshot;
}) {
  const projections = createCurrentExactResultProjections(input);
  return {
    projections,
    agent: {
      derivedExactMetadata: createCurrentDerivedExactMetadataSnapshots(
        input.engine,
        input.metadata,
        input.metadataSources,
        projections
      ),
      currentExactResults: toCadCurrentExactResults(projections)
    }
  };
}

function replaceProjectionEntries<T>(
  entries: readonly T[],
  artifactsByBodyId: ReadonlyMap<string, CurrentExactProjectionArtifact>,
  failuresByBodyId: ReadonlyMap<string, CurrentExactProjectionFailure>,
  getBodyId: (entry: T) => string,
  createArtifactEntry: (
    artifact: CurrentExactProjectionArtifact,
    entry?: T
  ) => T,
  createFailureEntry: (failure: CurrentExactProjectionFailure, entry?: T) => T
): readonly T[] {
  const projectedBodyIds = new Set<string>();
  const projected = entries.flatMap((entry) => {
    const bodyId = getBodyId(entry);
    const artifact = artifactsByBodyId.get(bodyId);
    const failure = failuresByBodyId.get(bodyId);
    if (!artifact && !failure) return [entry];
    if (projectedBodyIds.has(bodyId)) return [];
    projectedBodyIds.add(bodyId);
    return [
      artifact
        ? createArtifactEntry(artifact, entry)
        : createFailureEntry(failure!, entry)
    ];
  });

  for (const artifact of artifactsByBodyId.values()) {
    if (!projectedBodyIds.has(artifact.bodyId)) {
      projected.push(createArtifactEntry(artifact));
    }
  }
  for (const failure of failuresByBodyId.values()) {
    if (!projectedBodyIds.has(failure.bodyId)) {
      projected.push(createFailureEntry(failure));
    }
  }
  return projected;
}

function createFailureDisplayEntry(
  failure: CurrentExactProjectionFailure
): DerivedGeometryEntry {
  const base = {
    objectId: failure.bodyId,
    objectKind: "exactBody" as const,
    sourceId: failure.bodyId,
    sourceKind: "exactBody" as const,
    cacheKey: failure.cacheKeySha256
  };
  return failure.status === "cancelled"
    ? {
        ...base,
        status: "cancelled",
        message: "Current exact artifact build was cancelled."
      }
    : {
        ...base,
        status: "error",
        error: createDerivedGeometryErrorDetails(failure.error)
      };
}

function createFailureMetadataEntry(
  failure: CurrentExactProjectionFailure
): DerivedExactMetadataEntry {
  const base = {
    bodyId: failure.bodyId,
    sourceKind: "exactBody" as const,
    cacheKey: failure.cacheKeySha256
  };
  return failure.status === "cancelled"
    ? {
        ...base,
        status: "cancelled",
        message: "Current exact artifact build was cancelled."
      }
    : {
        ...base,
        status: "error",
        error: createDerivedGeometryErrorDetails(failure.error)
      };
}

function createArtifactDisplayEntry(
  artifact: CurrentExactProjectionArtifact
): DerivedGeometryReadyEntry {
  const bridge = createRenderMeshFromSerializableMesh(artifact.displayMesh, {
    id: artifact.bodyId,
    alignment: "source",
    label: `${artifact.bodyId} OCCT mesh`
  });
  const source = createArtifactEvidenceSource(artifact);
  const generatedReferences =
    artifact.topologySnapshot.generatedReferences ??
    bridge.generatedReferences ??
    artifact.metadata.generatedReferences;
  const warnings =
    artifact.metadata.topologyCounts.solidCount > 1 &&
    (artifact.sourceType === "linearPatternFeature" ||
      artifact.sourceType === "circularPatternFeature" ||
      artifact.sourceType === "mirrorFeature")
      ? (["PATTERN_MULTI_SOLID_RESULT"] as const)
      : undefined;

  return {
    objectId: artifact.bodyId,
    objectKind: "exactBody",
    sourceId: artifact.bodyId,
    sourceKind: "exactBody",
    cacheKey: createDerivedGeometryCacheKey(source),
    status: "ready",
    mesh: bridge.mesh,
    metrics: {
      objectId: artifact.bodyId,
      roundTripMs: 0,
      vertexCount: bridge.vertexCount,
      triangleCount: bridge.triangleCount
    },
    ...(warnings ? { warnings } : {}),
    ...(generatedReferences ? { generatedReferences } : {})
  };
}

function createArtifactMetadataEntry(
  artifact: CurrentExactProjectionArtifact
): DerivedExactMetadataReadyEntry {
  const source = createArtifactEvidenceSource(artifact);
  const generatedReferences =
    artifact.topologySnapshot.generatedReferences ??
    artifact.metadata.generatedReferences ??
    artifact.displayMesh.generatedReferences;

  return {
    bodyId: artifact.bodyId,
    sourceKind: "exactBody",
    cacheKey: createDerivedExactMetadataCacheKey(source),
    status: "ready",
    metadata: {
      ...artifact.metadata,
      topologySnapshot: artifact.topologySnapshot,
      ...(generatedReferences ? { generatedReferences } : {})
    },
    metrics: { objectId: artifact.bodyId, roundTripMs: 0 }
  };
}

function createDisplaySnapshot(
  entries: readonly DerivedGeometryEntry[]
): DerivedGeometrySnapshot {
  const meshes = entries.flatMap((entry) =>
    entry.status === "ready" ? [entry.mesh] : []
  );
  return {
    entries,
    meshes,
    supportedCount: entries.filter((entry) => entry.status !== "unsupported")
      .length,
    pendingCount: entries.filter((entry) => entry.status === "pending").length,
    readyCount: meshes.length,
    cancelledCount: entries.filter((entry) => entry.status === "cancelled")
      .length,
    errorCount: entries.filter((entry) => entry.status === "error").length
  };
}

function createMetadataSnapshot(
  entries: readonly DerivedExactMetadataEntry[]
): DerivedExactMetadataSnapshot {
  return {
    entries,
    supportedCount: entries.filter((entry) => entry.status !== "unsupported")
      .length,
    pendingCount: entries.filter((entry) => entry.status === "pending").length,
    readyCount: entries.filter((entry) => entry.status === "ready").length,
    cancelledCount: entries.filter((entry) => entry.status === "cancelled")
      .length,
    errorCount: entries.filter((entry) => entry.status === "error").length
  };
}

function createArtifactEvidenceSource(
  artifact: CurrentExactProjectionArtifact
): DerivedExactBodyGeometrySource {
  return {
    id: artifact.bodyId,
    kind: "exactBody",
    sourceIdentitySignature: artifact.bodySourceIdentitySignature,
    sourceCacheKeySha256: artifact.sourceCacheKeySha256,
    source: createCurrentExactBodyArtifactLeaf(artifact)
  };
}
