import type { OpenCascadeInstance } from "opencascade.js";
declare const moduleConstructor: new (
  settings: Record<string, unknown>
) => Promise<OpenCascadeInstance>;
export default moduleConstructor;
