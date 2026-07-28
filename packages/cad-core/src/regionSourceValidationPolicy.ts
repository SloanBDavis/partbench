import { registerCadV19RegionSourceValidator } from "./v19RegionPolicyRegistry";
import { validateV22RegionSource } from "./v22RegionSourceValidation";

// Browser-main project import and health checks need bounded validation of an
// explicitly submitted region source. Candidate discovery and correlation are
// deliberately not registered here: browser discovery remains query-worker
// owned and cancellable.
registerCadV19RegionSourceValidator(validateV22RegionSource);
