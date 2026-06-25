import type { FeatureExtrudeForm } from "./cadCommands";
import type { BooleanTargetBodyOption } from "./sketchPanelUi";

export function getExtrudeTargetFields(
  operationMode: FeatureExtrudeForm["operationMode"],
  addTargetBodies: readonly BooleanTargetBodyOption[],
  cutTargetBodies: readonly BooleanTargetBodyOption[],
  targetBodyId?: string
): Pick<FeatureExtrudeForm, "targetBodyId" | "targetTopologyAnchorId"> {
  if (operationMode === "newBody") {
    return {
      targetBodyId: undefined,
      targetTopologyAnchorId: undefined
    };
  }

  const targetBodies =
    operationMode === "add" ? addTargetBodies : cutTargetBodies;
  const target =
    targetBodies.find((candidate) => candidate.bodyId === targetBodyId) ??
    targetBodies[0];

  return {
    targetBodyId: target?.bodyId,
    targetTopologyAnchorId: target?.targetTopologyAnchorId
  };
}
