import type { CadEngine } from "@web-cad/cad-core";

import {
  getReadyRuntimeExactSources,
  resolveCurrentExactBodies,
  type CurrentExactBodyResolverInput
} from "./currentExactBodyResolver";
import {
  createCurrentExactResultProjections,
  toCadCurrentExactResults
} from "./currentExactResultProjection";
import type {
  DerivedGeometrySnapshot,
  DerivedGeometrySource
} from "./derivedGeometry";
import type {
  DerivedExactMetadataSnapshot,
  DerivedExactMetadataSource
} from "./derivedExactMetadata";
import { createCurrentDerivedExactMetadataSnapshots } from "./projectExactExportQueries";

export function createCurrentExactSources(
  input: CurrentExactBodyResolverInput
) {
  const resolutions = resolveCurrentExactBodies(input);
  const metadataSources = getReadyRuntimeExactSources(resolutions);
  const displaySources = metadataSources.filter(
    (source) => source.kind === "exactBody"
  );
  const replacedIds = new Set(displaySources.map((source) => source.id));
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
