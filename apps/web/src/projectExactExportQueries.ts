import type { CadEngine } from "@web-cad/cad-core";
import type {
  CadBodyDerivedExactMetadataSnapshot,
  ProjectExactExportQueryResponse,
  ProjectExportReadinessQueryResponse
} from "@web-cad/cad-protocol";

import {
  createDerivedExactMetadataCacheKey,
  createProjectQueryDerivedExactMetadataSnapshots,
  type DerivedExactMetadataSource,
  type DerivedExactMetadataSnapshot
} from "./derivedExactMetadata";

export function readProjectExportReadiness(
  engine: CadEngine,
  exactMetadata: DerivedExactMetadataSnapshot,
  currentSources: readonly DerivedExactMetadataSource[]
): ProjectExportReadinessQueryResponse | undefined {
  const derivedExactMetadata = createCurrentDerivedExactMetadataSnapshots(
    engine,
    exactMetadata,
    currentSources
  );
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: {
      query: "project.exportReadiness",
      ...(derivedExactMetadata.length > 0 ? { derivedExactMetadata } : {})
    }
  });

  return response.ok && response.query === "project.exportReadiness"
    ? response
    : undefined;
}

export function readProjectExactStepExport(
  engine: CadEngine,
  exactMetadata: DerivedExactMetadataSnapshot,
  currentSources: readonly DerivedExactMetadataSource[]
): ProjectExactExportQueryResponse | undefined {
  const derivedExactMetadata = createCurrentDerivedExactMetadataSnapshots(
    engine,
    exactMetadata,
    currentSources
  );
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: {
      query: "project.exportExact",
      format: "step",
      ...(derivedExactMetadata.length > 0 ? { derivedExactMetadata } : {})
    }
  });

  return response.ok && response.query === "project.exportExact"
    ? response
    : undefined;
}

export function createCurrentDerivedExactMetadataSnapshots(
  engine: CadEngine,
  exactMetadata: DerivedExactMetadataSnapshot,
  currentSources: readonly DerivedExactMetadataSource[]
): readonly CadBodyDerivedExactMetadataSnapshot[] {
  if (exactMetadata.entries.length === 0) return [];
  const currentSourcesByBodyId = new Map(
    currentSources.map((source) => [source.id, source] as const)
  );
  const sourceIdentitySignaturesByBodyId = new Map<string, string>();

  for (const entry of exactMetadata.entries) {
    const currentSource = currentSourcesByBodyId.get(entry.bodyId);
    if (
      !currentSource ||
      entry.cacheKey !== createDerivedExactMetadataCacheKey(currentSource)
    ) {
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
