import type { CadEngine } from "@web-cad/cad-core";
import type {
  CadBodyDerivedExactMetadataSnapshot,
  ProjectExactExportQueryResponse,
  ProjectExportReadinessQueryResponse,
  WcadSourceIdentity
} from "@web-cad/cad-protocol";

import {
  createDerivedExactMetadataCacheKey,
  createProjectQueryDerivedExactMetadataSnapshots,
  type DerivedExactMetadataSource,
  type DerivedExactMetadataSnapshot
} from "./derivedExactMetadata";
import {
  toCadCurrentExactResults,
  type CurrentExactResultProjection
} from "./currentExactResultProjection";

export function readProjectExportReadiness(
  engine: CadEngine,
  exactMetadata: DerivedExactMetadataSnapshot,
  currentSources: readonly DerivedExactMetadataSource[],
  projections?: readonly CurrentExactResultProjection[]
): ProjectExportReadinessQueryResponse | undefined {
  const derivedExactMetadata = createCurrentDerivedExactMetadataSnapshots(
    engine,
    exactMetadata,
    currentSources,
    projections
  );
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: {
      query: "project.exportReadiness",
      ...(derivedExactMetadata.length > 0 ? { derivedExactMetadata } : {}),
      ...(projections
        ? { currentExactResults: toCadCurrentExactResults(projections) }
        : {})
    }
  });

  return response.ok && response.query === "project.exportReadiness"
    ? response
    : undefined;
}

export function readProjectExactStepExport(
  engine: CadEngine,
  exactMetadata: DerivedExactMetadataSnapshot,
  currentSources: readonly DerivedExactMetadataSource[],
  projections?: readonly CurrentExactResultProjection[],
  bodyIds?: readonly string[],
  sourceIdentity?: WcadSourceIdentity
): ProjectExactExportQueryResponse | undefined {
  const derivedExactMetadata = createCurrentDerivedExactMetadataSnapshots(
    engine,
    exactMetadata,
    currentSources,
    projections
  );
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: {
      query: "project.exportExact",
      format: "step",
      ...(bodyIds ? { bodyIds } : {}),
      ...(sourceIdentity ? { sourceIdentity } : {}),
      ...(derivedExactMetadata.length > 0 ? { derivedExactMetadata } : {}),
      ...(projections
        ? { currentExactResults: toCadCurrentExactResults(projections) }
        : {})
    }
  });

  return response.ok && response.query === "project.exportExact"
    ? response
    : undefined;
}

export function createCurrentDerivedExactMetadataSnapshots(
  engine: CadEngine,
  exactMetadata: DerivedExactMetadataSnapshot,
  currentSources: readonly DerivedExactMetadataSource[],
  projections?: readonly CurrentExactResultProjection[]
): readonly CadBodyDerivedExactMetadataSnapshot[] {
  if (exactMetadata.entries.length === 0) return [];
  const currentSourcesByBodyId = new Map(
    currentSources.map((source) => [source.id, source] as const)
  );
  const sourceIdentitySignaturesByBodyId = new Map<string, string>();
  const projectionsByBodyId = new Map(
    projections?.map((projection) => [projection.bodyId, projection] as const)
  );

  for (const entry of exactMetadata.entries) {
    const projection = projectionsByBodyId.get(entry.bodyId);
    const currentSource = currentSourcesByBodyId.get(entry.bodyId);
    if (
      !currentSource ||
      entry.cacheKey !== createDerivedExactMetadataCacheKey(currentSource)
    ) {
      continue;
    }
    if (projection) {
      if (projection.ready && projection.sourceIdentitySignature) {
        sourceIdentitySignaturesByBodyId.set(
          entry.bodyId,
          projection.sourceIdentitySignature
        );
      }
      continue;
    }
    const response = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "body.topology", bodyId: entry.bodyId }
    });

    if (response.ok && response.query === "body.topology") {
      sourceIdentitySignaturesByBodyId.set(
        entry.bodyId,
        response.topology.sourceIdentity.signature
      );
    }
  }

  return createProjectQueryDerivedExactMetadataSnapshots(
    exactMetadata,
    sourceIdentitySignaturesByBodyId
  );
}
