import type { FeatureHoleForm } from "./cadCommands";

export function createDefaultFeatureHoleForm(): FeatureHoleForm {
  return {
    id: "",
    bodyId: "",
    targetBodyId: "",
    name: "",
    depthMode: "throughAll",
    depth: 1,
    direction: "positive"
  };
}
