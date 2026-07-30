import type {
  CadBatchValidationErrorCode,
  CadOpsVersion,
  SketchProfileRegionCandidatesQuery,
  SketchProfileRegionCandidatesQueryResponse,
  SketchProfileRegionValidateQueryResponse,
  SketchRegionsProfileRef
} from "@web-cad/cad-protocol";
import type {
  V22RegionSourceIssueCode,
  V22RegionSourceSketch,
  V22RegionSourceValidationResult
} from "./v22RegionSourceValidation";

export function mapRegionSourceIssueToBatchError(
  code: V22RegionSourceIssueCode | undefined
): CadBatchValidationErrorCode {
  switch (code) {
    case "SKETCH_REGION_PROFILE_EMPTY":
      return "SKETCH_PROFILE_EMPTY";
    case "SKETCH_REGION_SKETCH_MISMATCH":
      return "SCHEMA_V21_SOURCE_INVALID";
    case "SKETCH_REGION_ENTITY_MISSING":
      return "SKETCH_PROFILE_ENTITY_MISSING";
    case "SKETCH_REGION_ENTITY_UNSUPPORTED":
      return "SKETCH_PROFILE_ENTITY_UNSUPPORTED";
    case "SKETCH_REGION_CONSTRUCTION_ENTITY":
      return "SKETCH_PROFILE_CONSTRUCTION_ENTITY";
    case "SKETCH_REGION_ENTITY_REPEATED":
      return "SKETCH_PROFILE_ENTITY_REPEATED";
    case "SKETCH_REGION_LOOP_AREA_TOO_SMALL":
      return "SKETCH_PROFILE_AREA_TOO_SMALL";
    case "SKETCH_REGION_LOOP_OPEN":
    case "SKETCH_REGION_LOOP_INTERSECTION":
    case "SKETCH_REGION_BOUNDARY_TOUCHING":
    case "SKETCH_REGION_HOLE_OUTSIDE":
    case "SKETCH_REGION_HOLES_OVERLAP":
    case "SKETCH_REGION_MATERIAL_OVERLAP":
    case "SKETCH_REGION_NESTING_UNSUPPORTED":
    case "SKETCH_REGION_COMPLEXITY_LIMIT":
      return code;
    case undefined:
      return "SKETCH_REGION_CONSUMER_UNSUPPORTED";
  }
}

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
