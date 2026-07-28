import type {
  CadOpsVersion,
  SketchProfileRegionCandidatesQuery,
  SketchProfileRegionCandidatesQueryResponse,
  SketchProfileRegionValidateQueryResponse,
  SketchRegionsProfileRef
} from "@web-cad/cad-protocol";
import type {
  V22RegionSourceSketch,
  V22RegionSourceValidationResult
} from "./v22RegionSourceValidation";

export interface CadV19RegionPolicy {
  readonly candidates: (
    sketch: V22RegionSourceSketch,
    query: SketchProfileRegionCandidatesQuery,
    cadOpsVersion: CadOpsVersion
  ) => SketchProfileRegionCandidatesQueryResponse;
  readonly validate: (
    profile: SketchRegionsProfileRef,
    sketch: V22RegionSourceSketch
  ) => V22RegionSourceValidationResult;
  readonly validateResponse: (
    profile: SketchRegionsProfileRef,
    sketch: V22RegionSourceSketch,
    cadOpsVersion: CadOpsVersion
  ) => SketchProfileRegionValidateQueryResponse;
  readonly correlations: (
    sketch: V22RegionSourceSketch
  ) => ReadonlyMap<string, string>;
}

let queryPolicy: CadV19RegionPolicy | undefined;
let regionSourceValidator: CadV19RegionPolicy["validate"] | undefined;

export function registerCadV19RegionPolicy(next: CadV19RegionPolicy): void {
  queryPolicy = next;
  regionSourceValidator = next.validate;
}

export function registerCadV19RegionSourceValidator(
  validate: CadV19RegionPolicy["validate"]
): void {
  regionSourceValidator = validate;
}

export function createRegisteredRegionCandidatesResponse(
  sketch: V22RegionSourceSketch,
  query: SketchProfileRegionCandidatesQuery,
  cadOpsVersion: CadOpsVersion
): SketchProfileRegionCandidatesQueryResponse | undefined {
  return queryPolicy?.candidates(sketch, query, cadOpsVersion);
}

export function createRegisteredRegionValidateResponse(
  profile: SketchRegionsProfileRef,
  sketch: V22RegionSourceSketch,
  cadOpsVersion: CadOpsVersion
): SketchProfileRegionValidateQueryResponse | undefined {
  return queryPolicy?.validateResponse(profile, sketch, cadOpsVersion);
}

export function createRegisteredRegionCandidateCorrelations(
  sketch: V22RegionSourceSketch
): ReadonlyMap<string, string> {
  return queryPolicy?.correlations(sketch) ?? new Map();
}

export function validateRegisteredV22RegionSource(
  profile: SketchRegionsProfileRef,
  sketch: V22RegionSourceSketch
): V22RegionSourceValidationResult {
  return (
    regionSourceValidator?.(profile, sketch) ?? {
      ok: false,
      complexity: {
        sketchEntityCount: sketch.entities.size,
        regionCount: profile.regions.length,
        loopCount: profile.regions.reduce(
          (count, region) => count + 1 + region.holes.length,
          0
        ),
        segmentReferenceCount: 0,
        predicateVisitCount: 0
      },
      issues: [
        {
          code: "SKETCH_REGION_COMPLEXITY_LIMIT",
          message:
            "The exact V19 region policy has not been loaded for this runtime."
        }
      ]
    }
  );
}
