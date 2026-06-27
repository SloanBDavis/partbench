import type {
  CadBodySnapshot,
  CadGeneratedReference,
  CadSelectionReferenceOperation,
  CadReferenceHealthEntry,
  NamedGeneratedReferenceEntry,
  SelectionReferenceCandidatesQueryResponse,
  SketchPlane
} from "@web-cad/cad-protocol";
import type {
  FeatureEdgeFinishForm,
  SketchCreateForm,
  SketchCreateOnFaceForm
} from "./cadCommands";
import {
  buildEdgeFinishForm,
  createEdgeFinishReferenceOptions,
  SELECTED_EDGE_FINISH_REFERENCE_VALUE,
  selectEdgeFinishReferenceOption,
  type EdgeFinishOperation
} from "./edgeFinishUi";
import {
  buildSketchOnFaceForm,
  createSketchOnFaceDefaultName,
  formatGeneratedReferenceKind
} from "./generatedReferenceUi";
import {
  formatSelectionReferenceOperationLabel,
  getPrimarySelectionReferenceCandidate,
  getSelectionReferenceOperationStatus,
  type GeneratedReferenceSelectionState,
  type SelectedGeneratedReference
} from "./generatedReferenceSelection";
import type {
  ModelingActionDescriptor,
  ModelingActionId
} from "./modelingActions";
import { createNamedReferenceRepairUiState } from "./namedReferenceRepairUi";
import type {
  ViewportSelectionDisplay,
  ViewportSelectionTone
} from "./viewportSelectionDisplay";

const DEFAULT_EDGE_FINISH_SCALAR = 0.2;

export type ViewportContextualCommandActionId =
  | "body.measureTopology"
  | "body.references.inspect"
  | "feature.chamfer"
  | "feature.fillet"
  | "feature.measureReference"
  | "feature.selectReference"
  | "reference.repairName"
  | "reference.name"
  | "sketch.createSideHole"
  | "sketch.createOnFace";

export type ViewportContextualCommandActionRoute =
  | "command"
  | "inspect"
  | "measure"
  | "modeling"
  | "name"
  | "repair"
  | "references";

export interface ViewportContextualCommandAction {
  readonly id: ViewportContextualCommandActionId;
  readonly label: string;
  readonly route: ViewportContextualCommandActionRoute;
  readonly disabled: boolean;
  readonly reason?: string;
  readonly operation?: CadSelectionReferenceOperation;
  readonly modelingActionId?: ModelingActionId;
  readonly referenceName?: string;
  readonly sideHoleSketchPlane?: SketchPlane;
  readonly sideHoleTargetBodyId?: string;
  readonly target?: SelectedGeneratedReference;
}

export interface ViewportContextualCommandSurfaceModel {
  readonly visible: boolean;
  readonly selectionKey: string;
  readonly title: string;
  readonly detail: string;
  readonly tone: ViewportSelectionTone;
  readonly actions: readonly ViewportContextualCommandAction[];
  readonly diagnostic?: string;
}

export interface CreateViewportContextualCommandSurfaceInput {
  readonly modelingActions: readonly ModelingActionDescriptor[];
  readonly namedReferences?: readonly NamedGeneratedReferenceEntry[];
  readonly namedReferenceHealthByName?: ReadonlyMap<
    string,
    CadReferenceHealthEntry
  >;
  readonly selectedNamedReferenceName?: string;
  readonly selectionDisplay: ViewportSelectionDisplay;
  readonly selectedGeneratedReferenceState: GeneratedReferenceSelectionState;
  readonly selectionReferenceCandidates?: SelectionReferenceCandidatesQueryResponse;
}

export interface RunViewportContextualCommandActionInput {
  readonly action: ViewportContextualCommandAction;
  readonly body?: CadBodySnapshot;
  readonly disabled?: boolean;
  readonly namedReferences?: readonly NamedGeneratedReferenceEntry[];
  readonly selectionReferenceCandidates?: SelectionReferenceCandidatesQueryResponse;
  readonly selectedGeneratedReferenceState: GeneratedReferenceSelectionState;
  readonly onContinueInModeling?: (
    action: ViewportContextualCommandAction
  ) => void;
  readonly onCreateEdgeFinish?: (
    operation: EdgeFinishOperation,
    form: FeatureEdgeFinishForm
  ) => void;
  readonly onCreateSideHoleSketch?: (
    form: SketchCreateForm,
    targetBodyId: string
  ) => void;
  readonly onCreateSketchOnFace?: (form: SketchCreateOnFaceForm) => void;
  readonly onRepairNamedReference?: (
    name: string,
    target: SelectedGeneratedReference
  ) => void;
}

export function createViewportContextualCommandSurface({
  modelingActions,
  namedReferences,
  namedReferenceHealthByName,
  selectedNamedReferenceName,
  selectionDisplay,
  selectedGeneratedReferenceState,
  selectionReferenceCandidates
}: CreateViewportContextualCommandSurfaceInput): ViewportContextualCommandSurfaceModel {
  const actions = dedupeActions([
    ...createActionsFromModeling(modelingActions, selectionDisplay),
    ...createActionsFromReferenceOperations(
      selectionDisplay,
      selectionReferenceCandidates
    ),
    ...createActionsFromNamedReferenceRepair({
      namedReferences,
      namedReferenceHealthByName,
      selectedNamedReferenceName,
      selectedGeneratedReferenceState,
      selectionReferenceCandidates
    })
  ]);
  const diagnostic = selectionDisplay.diagnostics[0]?.message;
  const visible =
    actions.length > 0 ||
    selectionDisplay.tone !== "idle" ||
    selectionDisplay.diagnostics.length > 0;

  return {
    visible,
    selectionKey: createSelectionKey(
      selectionDisplay,
      selectedGeneratedReferenceState
    ),
    title: selectionDisplay.title,
    detail: selectionDisplay.detail,
    tone: selectionDisplay.tone,
    actions,
    ...(diagnostic ? { diagnostic } : {})
  };
}

export function createViewportContextualSketchOnFaceForm(
  selectedGeneratedReferenceState: GeneratedReferenceSelectionState
): SketchCreateOnFaceForm | undefined {
  if (
    selectedGeneratedReferenceState.status !== "selected" ||
    selectedGeneratedReferenceState.reference.kind !== "face"
  ) {
    return undefined;
  }

  const face = selectedGeneratedReferenceState.reference;
  const topologyAnchorId =
    selectedGeneratedReferenceState.selection.topologyAnchorId;

  return buildSketchOnFaceForm(
    face.bodyId,
    face,
    {
      id: "",
      name: createSketchOnFaceDefaultName(face)
    },
    topologyAnchorId
  );
}

export function createViewportContextualEdgeFinishForm({
  body,
  namedReferences = [],
  operation,
  selectedGeneratedReferenceState,
  selectionReferenceCandidates
}: {
  readonly body?: CadBodySnapshot;
  readonly namedReferences?: readonly NamedGeneratedReferenceEntry[];
  readonly operation: EdgeFinishOperation;
  readonly selectedGeneratedReferenceState: GeneratedReferenceSelectionState;
  readonly selectionReferenceCandidates?: SelectionReferenceCandidatesQueryResponse;
}): FeatureEdgeFinishForm | undefined {
  if (
    selectedGeneratedReferenceState.status !== "selected" ||
    selectedGeneratedReferenceState.reference.kind !== "edge"
  ) {
    return undefined;
  }

  const referenceOptions = createEdgeFinishReferenceOptions(
    selectedGeneratedReferenceState,
    namedReferences,
    selectionReferenceCandidates
  );
  const referenceOption = selectEdgeFinishReferenceOption(
    referenceOptions,
    SELECTED_EDGE_FINISH_REFERENCE_VALUE
  );

  return buildEdgeFinishForm({
    draft: {
      id: "",
      bodyId: "",
      name: "",
      distance: DEFAULT_EDGE_FINISH_SCALAR,
      radius: DEFAULT_EDGE_FINISH_SCALAR
    },
    operation,
    referenceOption,
    targetBodyId: body?.id ?? selectedGeneratedReferenceState.reference.bodyId
  });
}

export function runViewportContextualCommandAction({
  action,
  body,
  disabled = false,
  namedReferences,
  onContinueInModeling,
  onCreateEdgeFinish,
  onCreateSideHoleSketch,
  onCreateSketchOnFace,
  onRepairNamedReference,
  selectionReferenceCandidates,
  selectedGeneratedReferenceState
}: RunViewportContextualCommandActionInput): boolean {
  if (disabled || action.disabled) {
    return false;
  }

  if (action.route === "modeling") {
    onContinueInModeling?.(action);
    return Boolean(onContinueInModeling);
  }

  if (action.id === "sketch.createOnFace") {
    const form = createViewportContextualSketchOnFaceForm(
      selectedGeneratedReferenceState
    );

    if (!form) {
      return false;
    }

    onCreateSketchOnFace?.(form);
    return Boolean(onCreateSketchOnFace);
  }

  if (action.id === "sketch.createSideHole") {
    const targetBodyId =
      action.sideHoleTargetBodyId ??
      (selectedGeneratedReferenceState.status === "selected"
        ? selectedGeneratedReferenceState.reference.bodyId
        : undefined);

    if (!targetBodyId) {
      return false;
    }

    onCreateSideHoleSketch?.(
      {
        id: "",
        name: "Side-hole sketch",
        plane: action.sideHoleSketchPlane ?? "XZ"
      },
      targetBodyId
    );
    return Boolean(onCreateSideHoleSketch);
  }

  if (action.id === "feature.chamfer" || action.id === "feature.fillet") {
    const operation = action.id === "feature.chamfer" ? "chamfer" : "fillet";
    const form = createViewportContextualEdgeFinishForm({
      body,
      namedReferences,
      operation,
      selectionReferenceCandidates,
      selectedGeneratedReferenceState
    });

    if (!form) {
      return false;
    }

    onCreateEdgeFinish?.(operation, form);
    return Boolean(onCreateEdgeFinish);
  }

  if (action.id === "reference.repairName") {
    if (!action.referenceName || !action.target) {
      return false;
    }

    onRepairNamedReference?.(action.referenceName, action.target);
    return Boolean(onRepairNamedReference);
  }

  return false;
}

function createActionsFromModeling(
  actions: readonly ModelingActionDescriptor[],
  selectionDisplay: ViewportSelectionDisplay
): readonly ViewportContextualCommandAction[] {
  return actions.flatMap((action) => {
    switch (action.id) {
      case "body.measureTopology":
        return [
          createActionFromModeling(action, {
            label: "Measure",
            route: "measure"
          })
        ];
      case "body.references.inspect":
        return [
          createActionFromModeling(action, {
            label: "Inspect",
            route: "inspect"
          })
        ];
      case "feature.chamfer":
        return [
          createActionFromModeling(action, {
            label: "Chamfer",
            route: "command"
          })
        ];
      case "feature.fillet":
        return [
          createActionFromModeling(action, {
            label: "Fillet",
            route: "command"
          })
        ];
      case "reference.name":
        return [
          createActionFromModeling(action, {
            label: "Name",
            route: "name"
          })
        ];
      case "sketch.createOnFace":
        if (
          selectionDisplay.selectionKind !== "body" &&
          !action.available &&
          !isBlockingCommandReadinessReason(action.reason)
        ) {
          return [];
        }

        return [
          createActionFromModeling(action, {
            label:
              selectionDisplay.selectionKind === "body"
                ? "Choose face"
                : "Create sketch",
            route:
              selectionDisplay.selectionKind === "body" ? "modeling" : "command"
          })
        ];
      case "sketch.createSideHole":
        return [
          createActionFromModeling(action, {
            label: "Side hole",
            route: "command"
          })
        ];
      default:
        return [];
    }
  });
}

function isBlockingCommandReadinessReason(reason: string | undefined): boolean {
  const normalized = reason?.toLowerCase() ?? "";
  return (
    normalized.includes("consumed") || normalized.includes("downstream result")
  );
}

function createActionFromModeling(
  action: ModelingActionDescriptor,
  override: {
    readonly label: string;
    readonly route: ViewportContextualCommandActionRoute;
  }
): ViewportContextualCommandAction {
  const target = createActionTargetFromModeling(action);
  const missingNameTarget = override.route === "name" && !target;
  const disabled = !action.available || missingNameTarget;

  return {
    id: action.id as ViewportContextualCommandActionId,
    label: override.label,
    route: override.route,
    disabled,
    ...(action.reason || missingNameTarget
      ? {
          reason:
            action.reason ?? "Select a generated reference before naming it."
        }
      : {}),
    modelingActionId: action.id,
    ...(target ? { target } : {}),
    ...(action.id === "sketch.createSideHole"
      ? {
          sideHoleSketchPlane: action.target?.sideHoleSketchPlanes?.[0],
          sideHoleTargetBodyId:
            action.target?.preferredHoleTargetBodyId ?? target?.bodyId
        }
      : {})
  };
}

function createActionsFromReferenceOperations(
  selectionDisplay: ViewportSelectionDisplay,
  selectionReferenceCandidates:
    | SelectionReferenceCandidatesQueryResponse
    | undefined
): readonly ViewportContextualCommandAction[] {
  if (selectionDisplay.selectionKind === "body") {
    return [];
  }

  const operations = getSelectionCommandOperations(
    selectionDisplay,
    selectionReferenceCandidates
  );
  const actions: ViewportContextualCommandAction[] = [];

  for (const operation of operations) {
    if (operation === "feature.measureReference") {
      actions.push(
        createActionFromOperation(
          operation,
          "Measure",
          "measure",
          selectionReferenceCandidates
        )
      );
    }

    if (operation === "feature.selectReference") {
      actions.push(
        createActionFromOperation(
          operation,
          "Inspect",
          "inspect",
          selectionReferenceCandidates
        )
      );
    }

    if (operation === "reference.nameGenerated") {
      actions.push(
        createActionFromOperation(
          operation,
          "Name",
          "name",
          selectionReferenceCandidates
        )
      );
    }
  }

  return actions;
}

function createActionsFromNamedReferenceRepair({
  namedReferences = [],
  namedReferenceHealthByName,
  selectedNamedReferenceName,
  selectedGeneratedReferenceState,
  selectionReferenceCandidates
}: {
  readonly namedReferences?: readonly NamedGeneratedReferenceEntry[];
  readonly namedReferenceHealthByName?: ReadonlyMap<
    string,
    CadReferenceHealthEntry
  >;
  readonly selectedNamedReferenceName?: string;
  readonly selectedGeneratedReferenceState: GeneratedReferenceSelectionState;
  readonly selectionReferenceCandidates?: SelectionReferenceCandidatesQueryResponse;
}): readonly ViewportContextualCommandAction[] {
  if (selectedGeneratedReferenceState.status !== "selected") {
    return [];
  }

  const repairState = createNamedReferenceRepairUiState({
    namedReferences,
    namedReferenceHealthByName,
    selectedNamedReferenceName,
    selectedGeneratedReference: selectedGeneratedReferenceState.selection,
    selectionReferenceCandidates
  });

  if (repairState.status === "none") {
    return [];
  }

  return [
    {
      id: "reference.repairName",
      label: "Repair",
      route: "repair",
      disabled: repairState.status !== "ready",
      referenceName: repairState.reference.name,
      ...(repairState.status === "ready"
        ? { target: repairState.target }
        : { reason: repairState.message })
    }
  ];
}

function createActionFromOperation(
  operation: CadSelectionReferenceOperation,
  label: string,
  route: ViewportContextualCommandActionRoute,
  selectionReferenceCandidates:
    | SelectionReferenceCandidatesQueryResponse
    | undefined
): ViewportContextualCommandAction {
  const status = getSelectionReferenceOperationStatus(
    selectionReferenceCandidates,
    operation
  );
  const target =
    operation === "reference.nameGenerated"
      ? createActionTargetFromReference(
          selectionReferenceCandidates
            ? getPrimarySelectionReferenceCandidate(
                selectionReferenceCandidates
              )?.reference
            : undefined
        )
      : undefined;
  const disabled =
    !status.available || (operation === "reference.nameGenerated" && !target);

  return {
    id: actionIdFromOperation(operation),
    label,
    route,
    disabled,
    operation,
    ...(disabled
      ? {
          reason:
            status.message ??
            `${formatSelectionReferenceOperationLabel(operation)} is unavailable.`
        }
      : {}),
    ...(target ? { target } : {})
  };
}

function getSelectionCommandOperations(
  selectionDisplay: ViewportSelectionDisplay,
  selectionReferenceCandidates:
    | SelectionReferenceCandidatesQueryResponse
    | undefined
): readonly CadSelectionReferenceOperation[] {
  const primary = selectionReferenceCandidates
    ? getPrimarySelectionReferenceCandidate(selectionReferenceCandidates)
    : undefined;

  return primary?.commandOperations ?? selectionDisplay.commandOperations;
}

function actionIdFromOperation(
  operation: CadSelectionReferenceOperation
): ViewportContextualCommandActionId {
  switch (operation) {
    case "feature.extrudeCutTarget":
    case "feature.extrudeAddTarget":
    case "feature.holeTarget":
      return "body.references.inspect";
    case "feature.attachSketchPlane":
      return "sketch.createOnFace";
    case "feature.chamfer":
      return "feature.chamfer";
    case "feature.fillet":
      return "feature.fillet";
    case "feature.measureReference":
      return "feature.measureReference";
    case "feature.selectReference":
      return "feature.selectReference";
    case "reference.nameGenerated":
      return "reference.name";
  }
}

function createActionTargetFromModeling(
  action: ModelingActionDescriptor
): SelectedGeneratedReference | undefined {
  return action.selection?.context === "generatedReference"
    ? {
        bodyId: action.selection.bodyId,
        stableId: action.selection.stableId,
        kind: action.selection.referenceKind
      }
    : undefined;
}

function createActionTargetFromReference(
  reference: CadGeneratedReference | undefined
): SelectedGeneratedReference | undefined {
  return reference
    ? {
        bodyId: reference.bodyId,
        stableId: reference.stableId,
        kind: reference.kind
      }
    : undefined;
}

function createSelectionKey(
  selectionDisplay: ViewportSelectionDisplay,
  selectedGeneratedReferenceState: GeneratedReferenceSelectionState
): string {
  if (selectedGeneratedReferenceState.status === "selected") {
    return [
      "generated",
      selectedGeneratedReferenceState.selection.bodyId,
      selectedGeneratedReferenceState.selection.kind,
      selectedGeneratedReferenceState.selection.stableId
    ].join(":");
  }

  if (selectedGeneratedReferenceState.status === "stale") {
    return [
      "stale",
      selectedGeneratedReferenceState.selection.bodyId,
      selectedGeneratedReferenceState.selection.kind,
      selectedGeneratedReferenceState.selection.stableId
    ].join(":");
  }

  return [
    selectionDisplay.selectionKind,
    selectionDisplay.renderTargetId ?? "none",
    selectionDisplay.referenceStatus ?? "none",
    selectionDisplay.title
  ].join(":");
}

function dedupeActions(
  actions: readonly ViewportContextualCommandAction[]
): readonly ViewportContextualCommandAction[] {
  const deduped: ViewportContextualCommandAction[] = [];
  const seen = new Set<ViewportContextualCommandActionId>();

  for (const action of actions) {
    const previousIndex = deduped.findIndex(
      (candidate) => candidate.id === action.id
    );

    if (previousIndex >= 0) {
      const previous = deduped[previousIndex];
      deduped[previousIndex] =
        previous.disabled && !action.disabled ? action : previous;
      continue;
    }

    if (!seen.has(action.id)) {
      deduped.push(action);
      seen.add(action.id);
    }
  }

  return deduped.sort(
    (left, right) => getActionRank(left.id) - getActionRank(right.id)
  );
}

function getActionRank(id: ViewportContextualCommandActionId): number {
  switch (id) {
    case "sketch.createOnFace":
      return 0;
    case "sketch.createSideHole":
      return 0;
    case "reference.name":
      return 1;
    case "reference.repairName":
      return 2;
    case "feature.chamfer":
      return 3;
    case "feature.fillet":
      return 4;
    case "feature.measureReference":
    case "body.measureTopology":
      return 5;
    case "feature.selectReference":
    case "body.references.inspect":
      return 6;
  }
}

export function formatViewportContextualTarget(
  reference: CadGeneratedReference | undefined
): string {
  return reference
    ? `${formatGeneratedReferenceKind(reference.kind)}: ${reference.label}`
    : "Selected reference";
}
