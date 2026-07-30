import { registerCadV19RegionSourceValidator } from "./v19RegionPolicyRegistry";
import { validateV22RegionSource } from "./v22RegionSourceValidation";

registerCadV19RegionSourceValidator(validateV22RegionSource);
