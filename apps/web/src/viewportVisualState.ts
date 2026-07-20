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
  const staleReferenceStatus =
    selectedGeneratedReferenceState.status === "stale"
      ? {
          label: "Reference stale",
          detail: selectedGeneratedReferenceState.message,
          tone: "blocked" as const
        }
      : undefined;
  const geometryStatus =
    selectionDisplay.geometryStatus === "pending"
      ? {
          label: "Building display geometry",
          detail:
            selectionDisplay.geometryDetail ?? "Display geometry is updating.",
          tone: "warning" as const
        }
      : selectionDisplay.geometryStatus === "error"
        ? {
            label: "Display geometry failed",
            detail:
              selectionDisplay.geometryDetail ??
              "Display geometry could not be built.",
            tone: "failed" as const
          }
        : undefined;
  const status = staleReferenceStatus ?? geometryStatus;

  if (!status) {
    return {};
  }

  return {
    status: {
      label: redactInternalViewportIds(status.label),
      detail: redactInternalViewportIds(status.detail),
      tone: status.tone
    }
  };
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
