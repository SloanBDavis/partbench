import {
  createSketchProfileRegionCandidateCorrelations,
  createSketchProfileRegionCandidatesResponse
} from "./v19RegionDiscovery";
import { registerCadV19RegionPolicy } from "./v19RegionPolicyRegistry";
import {
  createSketchProfileRegionValidateResponse,
  validateV22RegionSource
} from "./v22RegionSourceValidation";

registerCadV19RegionPolicy({
  candidates: (sketch, query, cadOpsVersion) =>
    createSketchProfileRegionCandidatesResponse(sketch, query, cadOpsVersion),
  validate: (profile, sketch) => validateV22RegionSource(profile, sketch),
  validateResponse: (profile, sketch, cadOpsVersion) =>
    createSketchProfileRegionValidateResponse(profile, sketch, cadOpsVersion),
  correlations: (sketch) =>
    createSketchProfileRegionCandidateCorrelations(sketch)
});
