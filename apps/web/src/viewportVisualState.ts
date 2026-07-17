import type { RenderVisualStateInput } from "@web-cad/renderer";
import type { ViewportHoverState } from "./viewportHoverIntent";
import type { GeneratedReferenceSelectionState } from "./generatedReferenceSelection";
import type {
  ViewportSelectionDisplay,
  ViewportSelectionTone
} from "./viewportSelectionDisplay";
import { redactInternalViewportIds } from "./viewportVisibleText";

export type ViewportVisualStatusTone = ViewportSelectionTone | "failed";

export interface ViewportVisualStatus {
  readonly label: string;
  readonly detail: string;
  readonly tone: ViewportVisualStatusTone;
}

export interface ViewportVisualStateModel {
  readonly rendererVisualStates: readonly RenderVisualStateInput[];
  readonly selectedRenderTargetId?: string;
  readonly status?: ViewportVisualStatus;
}

export interface CreateViewportVisualStateModelInput {
  readonly hoverState?: ViewportHoverState;
  readonly selectionDisplay: ViewportSelectionDisplay;
  readonly selectedGeneratedReferenceState: GeneratedReferenceSelectionState;
}

type VisualTargetKind = RenderVisualStateInput["targetKind"];

export function createViewportVisualStateModel({
  hoverState,
  selectionDisplay,
  selectedGeneratedReferenceState
}: CreateViewportVisualStateModelInput): ViewportVisualStateModel {
  const visualStates: RenderVisualStateInput[] = [];
  const selectedTarget = selectionDisplay.renderTargetId;
  const selectedKind = getSelectedVisualTargetKind(
    selectionDisplay,
    selectedGeneratedReferenceState
  );

  if (selectedTarget) {
    visualStates.push({
      targetId: selectedTarget,
      targetKind: selectedKind,
      state: "selected"
    });

    for (const state of createSelectedTargetStateKinds(selectionDisplay)) {
      visualStates.push({
        targetId: selectedTarget,
        targetKind: selectedKind,
        state
      });
    }
  }

  if (
    hoverState?.kind !== undefined &&
    hoverState.kind !== "empty" &&
    hoverState.renderTargetId &&
    hoverState.renderTargetId !== selectedTarget
  ) {
    visualStates.push({
      targetId: hoverState.renderTargetId,
      targetKind: getHoverVisualTargetKind(hoverState),
      state: hoverState.tone === "blocked" ? "warning" : "preselection"
    });
  }

  return {
    rendererVisualStates: dedupeVisualStates(visualStates),
    ...(selectedTarget ? { selectedRenderTargetId: selectedTarget } : {}),
    ...createCompactStatus(selectionDisplay, selectedGeneratedReferenceState)
  };
}

function createSelectedTargetStateKinds(
  selectionDisplay: ViewportSelectionDisplay
): readonly RenderVisualStateInput["state"][] {
  const states: RenderVisualStateInput["state"][] = [];

  if (selectionDisplay.commandOperations.length > 0) {
    states.push("commandTarget");
  }

  if (
    selectionDisplay.tone === "warning" ||
    selectionDisplay.tone === "blocked"
  ) {
    states.push("warning");
  }

  if (selectionDisplay.geometryStatus === "pending") {
    states.push("pending");
  }

  if (selectionDisplay.geometryStatus === "error") {
    states.push("failed");
  }

  return states;
}

function getSelectedVisualTargetKind(
  selectionDisplay: ViewportSelectionDisplay,
  selectedGeneratedReferenceState: GeneratedReferenceSelectionState
): VisualTargetKind {
  if (
    selectedGeneratedReferenceState.status === "selected" ||
    selectedGeneratedReferenceState.status === "stale"
  ) {
    if (selectedGeneratedReferenceState.selection.kind === "axis") {
      return "body";
    }

    return selectedGeneratedReferenceState.selection.kind;
  }

  switch (selectionDisplay.selectionKind) {
    case "object":
      return "object";
    case "generatedReference":
      return "body";
    case "sketchEntity":
      return "sketchEntity";
    case "body":
    case "none":
      return "body";
  }
}

function getHoverVisualTargetKind(
  hoverState: Exclude<ViewportHoverState, { readonly kind: "empty" }>
): VisualTargetKind {
  switch (hoverState.kind) {
    case "object":
      return "object";
    case "sketchEntity":
      return "sketchEntity";
    case "body":
    case "missing":
    case "unsupported":
      return "body";
  }
}

function createCompactStatus(
  selectionDisplay: ViewportSelectionDisplay,
  selectedGeneratedReferenceState: GeneratedReferenceSelectionState
): Pick<ViewportVisualStateModel, "status"> {
  if (
    selectionDisplay.selectionKind === "none" &&
    selectionDisplay.tone === "idle"
  ) {
    return {};
  }

  const generatedReferenceStatus =
    selectedGeneratedReferenceState.status === "selected"
      ? {
          label: `${formatTargetKind(selectedGeneratedReferenceState.reference.kind === "axis" ? "body" : selectedGeneratedReferenceState.reference.kind)} selected`,
          detail:
            selectedGeneratedReferenceState.reference.kind === "body"
              ? selectionDisplay.detail
              : "Owning body highlighted; use the Inspector for exact face or edge details."
        }
      : selectedGeneratedReferenceState.status === "stale"
        ? {
            label: "Reference stale",
            detail: selectedGeneratedReferenceState.message
          }
        : undefined;

  return {
    status: {
      label: redactInternalViewportIds(
        generatedReferenceStatus?.label ?? selectionDisplay.title
      ),
      detail: redactInternalViewportIds(
        generatedReferenceStatus?.detail ?? selectionDisplay.detail
      ),
      tone:
        selectionDisplay.geometryStatus === "error"
          ? "failed"
          : selectionDisplay.tone
    }
  };
}

function formatTargetKind(kind: VisualTargetKind): string {
  switch (kind) {
    case "body":
      return "Body";
    case "face":
      return "Face";
    case "edge":
      return "Edge";
    case "vertex":
      return "Vertex";
    case "object":
      return "Object";
    case "sketchEntity":
      return "Sketch entity";
  }
}

function dedupeVisualStates(
  visualStates: readonly RenderVisualStateInput[]
): readonly RenderVisualStateInput[] {
  const deduped: RenderVisualStateInput[] = [];
  const seen = new Set<string>();

  for (const visualState of visualStates) {
    const key = `${visualState.targetId}:${visualState.targetKind}:${visualState.state}`;

    if (!seen.has(key)) {
      deduped.push(visualState);
      seen.add(key);
    }
  }

  return deduped;
}
