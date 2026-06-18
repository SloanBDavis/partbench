import type { CadGeneratedReference } from "@web-cad/cad-protocol";
import type { ViewportHoverState } from "./viewportHoverIntent";
import type {
  ViewportInspectOverlay,
  ViewportMeasurementOverlay
} from "./viewportMeasurementOverlay";
import type { ViewportReferenceAction } from "./viewportReferenceActions";
import type {
  ViewportSelectionDiagnostic,
  ViewportSelectionDisplay,
  ViewportSelectionKind,
  ViewportSelectionTone
} from "./viewportSelectionDisplay";
import { redactInternalViewportIds } from "./viewportVisibleText";

const DEFAULT_MAX_REFERENCE_ACTIONS = 6;
const DEFAULT_MAX_MEASUREMENT_ROWS = 5;

export interface ViewportInteractionDiagnostic {
  readonly code:
    | ViewportSelectionDiagnostic["code"]
    | ViewportInspectOverlay["diagnostics"][number]["code"];
  readonly status:
    | ViewportSelectionDiagnostic["status"]
    | ViewportInspectOverlay["diagnostics"][number]["status"];
  readonly message: string;
}

export interface ViewportInteractionMeasurementRow {
  readonly label: string;
  readonly value: string;
}

export interface ViewportInteractionMeasurementSection {
  readonly title: string;
  readonly detail: string;
  readonly source: ViewportMeasurementOverlay["source"];
  readonly authority: ViewportMeasurementOverlay["authority"];
  readonly authorityLabel: string;
  readonly tone: ViewportMeasurementOverlay["tone"];
  readonly rows: readonly ViewportInteractionMeasurementRow[];
  readonly overflowCount: number;
  readonly error?: string;
}

export interface ViewportInteractionInspectSection {
  readonly title: string;
  readonly detail: string;
  readonly authority: ViewportInspectOverlay["authority"];
  readonly authorityLabel: string;
  readonly rows: readonly ViewportInteractionMeasurementRow[];
  readonly commandOperationLabels: readonly string[];
  readonly diagnostics: readonly ViewportInteractionDiagnostic[];
}

export interface ViewportInteractionSelectionSummary {
  readonly selectionKind: ViewportSelectionKind;
  readonly title: string;
  readonly detail: string;
  readonly tone: ViewportSelectionTone;
  readonly geometryStatus: ViewportSelectionDisplay["geometryStatus"];
  readonly geometryDetail?: string;
  readonly referenceSummary?: string;
  readonly commandOperationLabels: readonly string[];
  readonly diagnostics: readonly ViewportInteractionDiagnostic[];
  readonly measurement?: ViewportInteractionMeasurementSection;
  readonly inspect?: ViewportInteractionInspectSection;
}

export interface ViewportInteractionHoverSummary {
  readonly kind: Exclude<ViewportHoverState["kind"], "empty">;
  readonly title: string;
  readonly detail: string;
  readonly tone: Exclude<
    ViewportHoverState,
    { readonly kind: "empty" }
  >["tone"];
  readonly referenceStatus?: Exclude<
    ViewportHoverState,
    { readonly kind: "empty" }
  >["referenceStatus"];
  readonly commandOperationLabels: readonly string[];
  readonly diagnostics: readonly ViewportInteractionDiagnostic[];
}

export interface ViewportInteractionReferenceAction {
  readonly id: string;
  readonly reference: CadGeneratedReference;
  readonly label: string;
  readonly kindLabel: string;
  readonly commandable: boolean;
  readonly selected: boolean;
  readonly commandOperationLabels: readonly string[];
  readonly diagnostic?: ViewportInteractionDiagnostic;
}

export interface ViewportInteractionReferenceKindGroup {
  readonly kindLabel: string;
  readonly totalCount: number;
  readonly visibleCount: number;
  readonly commandableCount: number;
  readonly blockedCount: number;
  readonly actions: readonly ViewportInteractionReferenceAction[];
}

export interface ViewportInteractionReferenceSection {
  readonly title: string;
  readonly summary: string;
  readonly totalCount: number;
  readonly visibleCount: number;
  readonly overflowCount: number;
  readonly commandableCount: number;
  readonly blockedCount: number;
  readonly selectedCount: number;
  readonly diagnosticCount: number;
  readonly groups: readonly ViewportInteractionReferenceKindGroup[];
}

export interface ViewportInteractionSurface {
  readonly selection: ViewportInteractionSelectionSummary;
  readonly hover?: ViewportInteractionHoverSummary;
  readonly referenceSection?: ViewportInteractionReferenceSection;
}

export interface CreateViewportInteractionSurfaceInput {
  readonly selectionDisplay: ViewportSelectionDisplay;
  readonly hoverState?: ViewportHoverState;
  readonly measurementOverlay?: ViewportMeasurementOverlay;
  readonly referenceActions?: readonly ViewportReferenceAction[];
  readonly maxMeasurementRows?: number;
  readonly maxReferenceActions?: number;
}

export function createViewportInteractionSurface({
  hoverState,
  maxMeasurementRows = DEFAULT_MAX_MEASUREMENT_ROWS,
  maxReferenceActions = DEFAULT_MAX_REFERENCE_ACTIONS,
  measurementOverlay,
  referenceActions = [],
  selectionDisplay
}: CreateViewportInteractionSurfaceInput): ViewportInteractionSurface {
  return {
    selection: createSelectionSummary(
      selectionDisplay,
      measurementOverlay,
      maxMeasurementRows
    ),
    ...createHoverSurface(hoverState, selectionDisplay),
    ...createReferenceSection(referenceActions, maxReferenceActions)
  };
}

function createSelectionSummary(
  selectionDisplay: ViewportSelectionDisplay,
  measurementOverlay: ViewportMeasurementOverlay | undefined,
  maxMeasurementRows: number
): ViewportInteractionSelectionSummary {
  return {
    selectionKind: selectionDisplay.selectionKind,
    title: clean(selectionDisplay.title),
    detail: clean(selectionDisplay.detail),
    tone: selectionDisplay.tone,
    geometryStatus: selectionDisplay.geometryStatus,
    ...(selectionDisplay.geometryDetail
      ? { geometryDetail: clean(selectionDisplay.geometryDetail) }
      : {}),
    ...(selectionDisplay.referenceSummary
      ? { referenceSummary: clean(selectionDisplay.referenceSummary) }
      : {}),
    commandOperationLabels: selectionDisplay.commandOperationLabels.map(clean),
    diagnostics: cleanDiagnostics(selectionDisplay.diagnostics),
    ...(measurementOverlay
      ? {
          measurement: createMeasurementSection(
            measurementOverlay,
            maxMeasurementRows
          ),
          inspect: createInspectSection(measurementOverlay.inspect)
        }
      : {})
  };
}

function createMeasurementSection(
  overlay: ViewportMeasurementOverlay,
  maxRows: number
): ViewportInteractionMeasurementSection {
  const visibleRows = overlay.rows.slice(0, Math.max(0, maxRows));

  return {
    title: clean(overlay.title),
    detail: clean(overlay.detail),
    source: overlay.source,
    authority: overlay.authority,
    authorityLabel: clean(overlay.authorityLabel),
    tone: overlay.tone,
    rows: visibleRows.map((row) => ({
      label: clean(row.label),
      value: clean(row.value)
    })),
    overflowCount: Math.max(0, overlay.rows.length - visibleRows.length),
    ...(overlay.error ? { error: clean(overlay.error) } : {})
  };
}

function createInspectSection(
  inspect: ViewportInspectOverlay
): ViewportInteractionInspectSection {
  return {
    title: clean(inspect.title),
    detail: clean(inspect.detail),
    authority: inspect.authority,
    authorityLabel: clean(inspect.authorityLabel),
    rows: inspect.rows.map((row) => ({
      label: clean(row.label),
      value: clean(row.value)
    })),
    commandOperationLabels: inspect.commandOperationLabels.map(clean),
    diagnostics: cleanDiagnostics(inspect.diagnostics)
  };
}

function createHoverSurface(
  hoverState: ViewportHoverState | undefined,
  selectionDisplay: ViewportSelectionDisplay
): Pick<ViewportInteractionSurface, "hover"> {
  if (!hoverState || hoverState.kind === "empty") {
    return {};
  }

  if (
    hoverState.renderTargetId &&
    selectionDisplay.renderTargetId &&
    hoverState.renderTargetId === selectionDisplay.renderTargetId
  ) {
    return {};
  }

  return {
    hover: {
      kind: hoverState.kind,
      title: clean(hoverState.title),
      detail: clean(hoverState.detail),
      tone: hoverState.tone,
      ...(hoverState.referenceStatus
        ? { referenceStatus: hoverState.referenceStatus }
        : {}),
      commandOperationLabels: hoverState.commandOperationLabels.map(clean),
      diagnostics: cleanDiagnostics(hoverState.diagnostics)
    }
  };
}

function createReferenceSection(
  actions: readonly ViewportReferenceAction[],
  maxActions: number
): Pick<ViewportInteractionSurface, "referenceSection"> {
  if (actions.length === 0 || maxActions <= 0) {
    return {};
  }

  const sortedActions = sortReferenceActions(actions);
  const visibleActions = sortedActions.slice(0, maxActions);
  const commandableCount = actions.filter(
    (action) => action.commandable
  ).length;
  const blockedCount = actions.length - commandableCount;
  const selectedCount = actions.filter((action) => action.selected).length;
  const diagnosticCount = actions.filter((action) => action.diagnostic).length;
  const groups = createReferenceKindGroups(actions, visibleActions);

  return {
    referenceSection: {
      title: "Reference targets",
      summary:
        visibleActions.length === actions.length
          ? `${actions.length} targets`
          : `${visibleActions.length} of ${actions.length} targets`,
      totalCount: actions.length,
      visibleCount: visibleActions.length,
      overflowCount: actions.length - visibleActions.length,
      commandableCount,
      blockedCount,
      selectedCount,
      diagnosticCount,
      groups
    }
  };
}

function createReferenceKindGroups(
  allActions: readonly ViewportReferenceAction[],
  visibleActions: readonly ViewportReferenceAction[]
): readonly ViewportInteractionReferenceKindGroup[] {
  const kindLabels = Array.from(
    new Set(visibleActions.map((action) => action.kindLabel))
  );

  return kindLabels.map((kindLabel) => {
    const allGroupActions = allActions.filter(
      (action) => action.kindLabel === kindLabel
    );
    const visibleGroupActions = visibleActions.filter(
      (action) => action.kindLabel === kindLabel
    );
    const commandableCount = allGroupActions.filter(
      (action) => action.commandable
    ).length;

    return {
      kindLabel,
      totalCount: allGroupActions.length,
      visibleCount: visibleGroupActions.length,
      commandableCount,
      blockedCount: allGroupActions.length - commandableCount,
      actions: visibleGroupActions.map(cleanReferenceAction)
    };
  });
}

function sortReferenceActions(
  actions: readonly ViewportReferenceAction[]
): readonly ViewportReferenceAction[] {
  return actions
    .map((action, index) => ({ action, index }))
    .sort((left, right) => {
      const selectedRank =
        rankBoolean(right.action.selected) - rankBoolean(left.action.selected);

      if (selectedRank !== 0) {
        return selectedRank;
      }

      const commandableRank =
        rankBoolean(right.action.commandable) -
        rankBoolean(left.action.commandable);

      if (commandableRank !== 0) {
        return commandableRank;
      }

      const kindRank =
        getReferenceKindRank(left.action.reference.kind) -
        getReferenceKindRank(right.action.reference.kind);

      if (kindRank !== 0) {
        return kindRank;
      }

      const labelRank = left.action.label.localeCompare(right.action.label);

      return labelRank !== 0 ? labelRank : left.index - right.index;
    })
    .map(({ action }) => action);
}

function cleanReferenceAction(
  action: ViewportReferenceAction
): ViewportInteractionReferenceAction {
  return {
    id: action.id,
    reference: action.reference,
    label: clean(action.label),
    kindLabel: clean(action.kindLabel),
    commandable: action.commandable,
    selected: action.selected,
    commandOperationLabels: action.commandOperationLabels.map(clean),
    ...(action.diagnostic
      ? { diagnostic: cleanDiagnostic(action.diagnostic) }
      : {})
  };
}

function getReferenceKindRank(kind: CadGeneratedReference["kind"]): number {
  switch (kind) {
    case "face":
      return 0;
    case "edge":
      return 1;
    case "body":
      return 2;
    case "vertex":
      return 3;
    case "axis":
      return 4;
  }
}

function rankBoolean(value: boolean): number {
  return value ? 1 : 0;
}

function cleanDiagnostics(
  diagnostics: readonly (
    | ViewportSelectionDiagnostic
    | ViewportInspectOverlay["diagnostics"][number]
  )[]
): readonly ViewportInteractionDiagnostic[] {
  return diagnostics.map(cleanDiagnostic);
}

function cleanDiagnostic(
  diagnostic:
    | ViewportSelectionDiagnostic
    | ViewportInspectOverlay["diagnostics"][number]
): ViewportInteractionDiagnostic {
  return {
    code: diagnostic.code,
    status: diagnostic.status,
    message: clean(diagnostic.message)
  };
}

function clean(text: string): string {
  return redactInternalViewportIds(text);
}
