export interface SketchCurveEditOwnershipPolicy {
  readonly guardNavigation: boolean;
  readonly closeBeforeCleanNavigation: boolean;
  readonly suppressTreeSourceMutations: boolean;
  readonly suppressContextSourceMutations: boolean;
}

export function getSketchCurveEditOwnershipPolicy(input: {
  readonly active: boolean;
  readonly dirty: boolean;
}): SketchCurveEditOwnershipPolicy {
  return {
    guardNavigation: input.active && input.dirty,
    closeBeforeCleanNavigation: input.active && !input.dirty,
    suppressTreeSourceMutations: input.active && input.dirty,
    suppressContextSourceMutations: input.active
  };
}

export function getActiveCurveEditInvocationAction(input: {
  readonly curveEditorActive: boolean;
  readonly dirty: boolean;
  readonly activeActionId?: string;
  readonly invokedActionId: string;
}): "proceed" | "focus-existing" | "guard-navigation" {
  if (!input.curveEditorActive) return "proceed";
  if (input.activeActionId === input.invokedActionId) return "focus-existing";
  return input.dirty ? "guard-navigation" : "proceed";
}

export function getCurveEditSketchSelectionAction(input: {
  readonly curveEditorActive: boolean;
  readonly dirty: boolean;
  readonly currentSketchId?: string;
  readonly nextSketchId: string;
}): "select-in-place" | "close-and-select" | "guard-selection" {
  if (
    !input.curveEditorActive ||
    input.currentSketchId === input.nextSketchId
  ) {
    return "select-in-place";
  }
  return input.dirty ? "guard-selection" : "close-and-select";
}

export function getSketchEditorActionNotice(
  kind: "curve" | "intent",
  actionId?: string
): string {
  if (kind === "intent") {
    const tool = actionId
      ?.slice(actionId.indexOf(".") + 1)
      .replaceAll("-", " ");
    return `${
      tool ? `Set up ${tool}: choose` : "Choose"
    } targets and values, review measurement and solver state, then Apply.`;
  }
  return "Collect the exact edit choices, review geometry and constraint consequences, then Apply.";
}
