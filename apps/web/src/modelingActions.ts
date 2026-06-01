import type {
  BodyGeneratedReferencesQueryResponse,
  CadBodySnapshot,
  CadFeatureSummary,
  CadGeneratedEntityKind,
  CadGeneratedFaceReference,
  CadGeneratedReference,
  NamedGeneratedReferenceEntry,
  SketchConstraintEntry,
  SketchDimensionEntry,
  SketchEntityId,
  SketchEntityKind,
  SketchEntitySnapshot,
  SketchId,
  SketchSnapshot
} from "@web-cad/cad-protocol";
import {
  SELECTED_EDGE_FINISH_REFERENCE_VALUE,
  createEdgeFinishReferenceOptions,
  getEdgeFinishOperationStatus,
  selectEdgeFinishReferenceOption,
  type EdgeFinishOperation
} from "./edgeFinishUi";
import {
  canCreateSketchOnFace,
  formatSketchOnFaceAvailability,
  getSketchAttachableFaces
} from "./generatedReferenceUi";
import type { GeneratedReferenceSelectionState } from "./generatedReferenceSelection";
import {
  createAvailableSketchConstraintKindOptions,
  createAvailableSketchDimensionTargetOptions,
  createHoleTargetBodyOptions,
  createRevolveAxisOptions,
  getHoleOperationStatus,
  getRevolveOperationStatus,
  isExtrudableSketchEntity,
  type BooleanTargetBodyOption,
  type RevolveAxisOption,
  type SketchConstraintKindOption,
  type SketchDimensionTargetOption
} from "./sketchPanelUi";

const DEFAULT_HOLE_FORM = {
  depthMode: "throughAll" as const,
  depth: Number.NaN
};
const DEFAULT_REVOLVE_ANGLE_DEGREES = 360;
const DEFAULT_EDGE_FINISH_SCALAR = 0.2;
const SKETCH_ENTITY_ADD_ACTION_IDS = {
  point: "sketch.entity.add.point",
  line: "sketch.entity.add.line",
  rectangle: "sketch.entity.add.rectangle",
  circle: "sketch.entity.add.circle"
} as const satisfies Record<SketchEntityKind, ModelingActionId>;

export type ModelingActionId =
  | "sketch.create"
  | "sketch.entity.add.point"
  | "sketch.entity.add.line"
  | "sketch.entity.add.rectangle"
  | "sketch.entity.add.circle"
  | "sketch.entity.edit"
  | "sketch.dimension.add"
  | "sketch.constraint.add"
  | "sketch.revolveAxis.use"
  | "feature.extrude"
  | "feature.hole"
  | "feature.revolve"
  | "body.references.inspect"
  | "body.measureTopology"
  | "sketch.createOnFace"
  | "reference.name"
  | "feature.chamfer"
  | "feature.fillet";

export type ModelingActionKind = "command" | "editor" | "query" | "selection";

export type ModelingActionCategory =
  | "sketch"
  | "sketchEntity"
  | "feature"
  | "body"
  | "generatedReference";

export interface ModelingActionTargetMetadata {
  readonly sketchId?: SketchId;
  readonly addEntityKind?: SketchEntityKind;
  readonly sketchEntityId?: SketchEntityId;
  readonly sketchEntityKind?: SketchEntityKind;
  readonly dimensionTargets?: readonly SketchDimensionTargetOption[];
  readonly constraintKinds?: readonly SketchConstraintKindOption[];
  readonly revolveAxes?: readonly RevolveAxisOption[];
  readonly holeTargets?: readonly BooleanTargetBodyOption[];
  readonly bodyId?: string;
  readonly featureId?: string;
  readonly generatedReferenceStableId?: string;
  readonly generatedReferenceKind?: CadGeneratedEntityKind;
  readonly eligibleFaceStableIds?: readonly string[];
}

export type ModelingActionSelectionMetadata =
  | { readonly context: "none" }
  | { readonly context: "sketch"; readonly sketchId: SketchId }
  | {
      readonly context: "sketchEntity";
      readonly sketchId: SketchId;
      readonly entityId: SketchEntityId;
      readonly entityKind: SketchEntityKind;
    }
  | {
      readonly context: "body";
      readonly bodyId: string;
      readonly featureId?: string;
    }
  | {
      readonly context: "generatedReference";
      readonly bodyId: string;
      readonly stableId: string;
      readonly referenceKind: CadGeneratedEntityKind;
    };

export interface ModelingActionDescriptor {
  readonly id: ModelingActionId;
  readonly label: string;
  readonly kind: ModelingActionKind;
  readonly category: ModelingActionCategory;
  readonly available: boolean;
  readonly reason?: string;
  readonly target?: ModelingActionTargetMetadata;
  readonly selection?: ModelingActionSelectionMetadata;
}

export type ModelingSelectionContext =
  | { readonly selectionKind: "none" }
  | { readonly selectionKind: "sketch"; readonly sketch: SketchSnapshot }
  | {
      readonly selectionKind: "sketchEntity";
      readonly sketch: SketchSnapshot;
      readonly entity: SketchEntitySnapshot;
      readonly dimensions?: readonly SketchDimensionEntry[];
      readonly constraints?: readonly SketchConstraintEntry[];
    }
  | {
      readonly selectionKind: "body";
      readonly body: CadBodySnapshot;
      readonly feature?: CadFeatureSummary;
      readonly generatedReferences?: BodyGeneratedReferencesQueryResponse;
    }
  | {
      readonly selectionKind: "generatedReference";
      readonly reference: CadGeneratedReference;
      readonly body?: CadBodySnapshot;
      readonly feature?: CadFeatureSummary;
      readonly namedReferences?: readonly NamedGeneratedReferenceEntry[];
    };

export interface ModelingActionState {
  readonly context: ModelingSelectionContext;
  readonly bodies?: readonly CadBodySnapshot[];
  readonly features?: readonly CadFeatureSummary[];
  readonly preferredBodyId?: string;
}

export function deriveModelingActions(
  state: ModelingActionState
): readonly ModelingActionDescriptor[] {
  switch (state.context.selectionKind) {
    case "none":
      return createNoSelectionActions();
    case "sketch":
      return createSketchActions(state.context.sketch);
    case "sketchEntity":
      return createSketchEntityActions(state.context, state);
    case "body":
      return createBodyActions(state.context);
    case "generatedReference":
      return createGeneratedReferenceActions(state.context);
  }
}

function createNoSelectionActions(): readonly ModelingActionDescriptor[] {
  return [
    {
      id: "sketch.create",
      label: "Create sketch",
      kind: "command",
      category: "sketch",
      available: true,
      selection: { context: "none" }
    }
  ];
}

function createSketchActions(
  sketch: SketchSnapshot
): readonly ModelingActionDescriptor[] {
  return [
    createAddSketchEntityAction(sketch, "point", "Add point"),
    createAddSketchEntityAction(sketch, "line", "Add line"),
    createAddSketchEntityAction(sketch, "rectangle", "Add rectangle"),
    createAddSketchEntityAction(sketch, "circle", "Add circle")
  ];
}

function createAddSketchEntityAction(
  sketch: SketchSnapshot,
  entityKind: SketchEntityKind,
  label: string
): ModelingActionDescriptor {
  return {
    id: SKETCH_ENTITY_ADD_ACTION_IDS[entityKind],
    label,
    kind: "command",
    category: "sketch",
    available: true,
    target: {
      sketchId: sketch.id,
      addEntityKind: entityKind
    },
    selection: {
      context: "sketch",
      sketchId: sketch.id
    }
  };
}

function createSketchEntityActions(
  context: Extract<
    ModelingSelectionContext,
    { readonly selectionKind: "sketchEntity" }
  >,
  state: Pick<ModelingActionState, "bodies" | "features" | "preferredBodyId">
): readonly ModelingActionDescriptor[] {
  const { constraints = [], dimensions = [], entity, sketch } = context;
  const selection: ModelingActionSelectionMetadata = {
    context: "sketchEntity",
    sketchId: sketch.id,
    entityId: entity.id,
    entityKind: entity.kind
  };
  const entityTarget = createSketchEntityTarget(sketch, entity);
  const dimensionTargets = createAvailableSketchDimensionTargetOptions(
    entity,
    dimensions
  );
  const constraintKinds = createAvailableSketchConstraintKindOptions(
    entity,
    constraints,
    sketch.entities
  );
  const actions: ModelingActionDescriptor[] = [
    {
      id: "sketch.entity.edit",
      label: "Edit entity",
      kind: "editor",
      category: "sketchEntity",
      available: true,
      target: entityTarget,
      selection
    },
    {
      id: "sketch.dimension.add",
      label: "Add dimension",
      kind: "command",
      category: "sketchEntity",
      available: dimensionTargets.length > 0,
      reason:
        dimensionTargets.length > 0
          ? undefined
          : "No available dimension targets for selected entity.",
      target: {
        ...entityTarget,
        dimensionTargets
      },
      selection
    },
    {
      id: "sketch.constraint.add",
      label: "Add constraint",
      kind: "command",
      category: "sketchEntity",
      available: constraintKinds.length > 0,
      reason:
        constraintKinds.length > 0
          ? undefined
          : "No available constraints for selected entity.",
      target: {
        ...entityTarget,
        constraintKinds
      },
      selection
    }
  ];

  if (entity.kind === "line") {
    actions.push(createLineExtrudeAction(sketch, entity, selection));
    actions.push(createRevolveAxisAction(sketch, entity, selection));
    return actions;
  }

  if (isExtrudableSketchEntity(entity)) {
    actions.push(createExtrudeAction(sketch, entity, selection));
    if (entity.kind === "circle") {
      actions.push(createHoleAction(context, state, selection));
    }
    actions.push(createRevolveAction(sketch, entity, selection));
  }

  return actions;
}

function createSketchEntityTarget(
  sketch: SketchSnapshot,
  entity: SketchEntitySnapshot
): ModelingActionTargetMetadata {
  return {
    sketchId: sketch.id,
    sketchEntityId: entity.id,
    sketchEntityKind: entity.kind
  };
}

function createLineExtrudeAction(
  sketch: SketchSnapshot,
  entity: Extract<SketchEntitySnapshot, { readonly kind: "line" }>,
  selection: ModelingActionSelectionMetadata
): ModelingActionDescriptor {
  return {
    id: "feature.extrude",
    label: "Extrude",
    kind: "command",
    category: "feature",
    available: false,
    reason: "Line entities cannot be extruded directly.",
    target: createSketchEntityTarget(sketch, entity),
    selection
  };
}

function createRevolveAxisAction(
  sketch: SketchSnapshot,
  entity: Extract<SketchEntitySnapshot, { readonly kind: "line" }>,
  selection: ModelingActionSelectionMetadata
): ModelingActionDescriptor {
  const axisOptions = createRevolveAxisOptions(sketch);
  const selectedAxis = axisOptions.find((axis) => axis.entityId === entity.id);

  return {
    id: "sketch.revolveAxis.use",
    label: "Use as revolve axis",
    kind: "selection",
    category: "sketchEntity",
    available: selectedAxis !== undefined,
    reason:
      selectedAxis === undefined
        ? "Edit the sketch line axis so it has non-zero length."
        : undefined,
    target: {
      ...createSketchEntityTarget(sketch, entity),
      revolveAxes: selectedAxis ? [selectedAxis] : []
    },
    selection
  };
}

function createExtrudeAction(
  sketch: SketchSnapshot,
  entity: Extract<
    SketchEntitySnapshot,
    { readonly kind: "rectangle" | "circle" }
  >,
  selection: ModelingActionSelectionMetadata
): ModelingActionDescriptor {
  return {
    id: "feature.extrude",
    label: "Extrude",
    kind: "command",
    category: "feature",
    available: true,
    target: createSketchEntityTarget(sketch, entity),
    selection
  };
}

function createHoleAction(
  context: Extract<
    ModelingSelectionContext,
    { readonly selectionKind: "sketchEntity" }
  >,
  state: Pick<ModelingActionState, "bodies" | "features" | "preferredBodyId">,
  selection: ModelingActionSelectionMetadata
): ModelingActionDescriptor {
  const { entity, sketch } = context;
  const targets = createHoleTargetBodyOptions(
    state.bodies ?? [],
    state.features ?? [],
    state.preferredBodyId
  );
  const status = getHoleOperationStatus(entity, targets, DEFAULT_HOLE_FORM);

  return {
    id: "feature.hole",
    label: "Hole",
    kind: "command",
    category: "feature",
    available: status.available,
    reason: status.available ? undefined : status.message,
    target: {
      ...createSketchEntityTarget(sketch, entity),
      holeTargets: targets
    },
    selection
  };
}

function createRevolveAction(
  sketch: SketchSnapshot,
  entity: Extract<
    SketchEntitySnapshot,
    { readonly kind: "rectangle" | "circle" }
  >,
  selection: ModelingActionSelectionMetadata
): ModelingActionDescriptor {
  const axisOptions = createRevolveAxisOptions(sketch);
  const sketchLineCount = sketch.entities.filter(
    (candidate) => candidate.kind === "line"
  ).length;
  const status = getRevolveOperationStatus(
    entity,
    axisOptions,
    DEFAULT_REVOLVE_ANGLE_DEGREES,
    sketchLineCount
  );

  return {
    id: "feature.revolve",
    label: "Revolve",
    kind: "command",
    category: "feature",
    available: status.available,
    reason: status.available ? undefined : status.message,
    target: {
      ...createSketchEntityTarget(sketch, entity),
      revolveAxes: axisOptions
    },
    selection
  };
}

function createBodyActions(
  context: Extract<ModelingSelectionContext, { readonly selectionKind: "body" }>
): readonly ModelingActionDescriptor[] {
  const selection: ModelingActionSelectionMetadata = {
    context: "body",
    bodyId: context.body.id,
    featureId: context.feature?.id
  };
  const attachableFaces = getSketchAttachableFaces(
    context.generatedReferences?.faces ?? []
  );
  const sketchOnFaceReason = getBodySketchOnFaceReason(
    context.generatedReferences,
    attachableFaces
  );

  return [
    {
      id: "body.references.inspect",
      label: "Inspect references",
      kind: "query",
      category: "body",
      available: true,
      target: {
        bodyId: context.body.id,
        featureId: context.feature?.id
      },
      selection
    },
    {
      id: "body.measureTopology",
      label: "Measure/topology",
      kind: "query",
      category: "body",
      available: true,
      target: {
        bodyId: context.body.id,
        featureId: context.feature?.id
      },
      selection
    },
    {
      id: "sketch.createOnFace",
      label: "Create sketch on face",
      kind: "command",
      category: "sketch",
      available: attachableFaces.length > 0,
      reason: sketchOnFaceReason,
      target: {
        bodyId: context.body.id,
        featureId: context.feature?.id,
        eligibleFaceStableIds: attachableFaces.map((face) => face.stableId)
      },
      selection
    }
  ];
}

function getBodySketchOnFaceReason(
  references: BodyGeneratedReferencesQueryResponse | undefined,
  attachableFaces: readonly CadGeneratedFaceReference[]
): string | undefined {
  if (attachableFaces.length > 0) {
    return undefined;
  }

  if (!references) {
    return "Generated references are unavailable for the selected body.";
  }

  return "No planar generated faces are available for attached sketches.";
}

function createGeneratedReferenceActions(
  context: Extract<
    ModelingSelectionContext,
    { readonly selectionKind: "generatedReference" }
  >
): readonly ModelingActionDescriptor[] {
  const selection: ModelingActionSelectionMetadata = {
    context: "generatedReference",
    bodyId: context.reference.bodyId,
    stableId: context.reference.stableId,
    referenceKind: context.reference.kind
  };
  const nameAction: ModelingActionDescriptor = {
    id: "reference.name",
    label: "Name reference",
    kind: "command",
    category: "generatedReference",
    available: true,
    target: createGeneratedReferenceTarget(context.reference),
    selection
  };

  if (context.reference.kind === "face") {
    return [
      nameAction,
      createGeneratedFaceSketchAction(context.reference, selection)
    ];
  }

  if (context.reference.kind === "edge") {
    return [
      nameAction,
      createEdgeFinishAction(context, selection, "chamfer"),
      createEdgeFinishAction(context, selection, "fillet")
    ];
  }

  return [nameAction];
}

function createGeneratedFaceSketchAction(
  face: CadGeneratedFaceReference,
  selection: ModelingActionSelectionMetadata
): ModelingActionDescriptor {
  const available = canCreateSketchOnFace(face);

  return {
    id: "sketch.createOnFace",
    label: "Create sketch on face",
    kind: "command",
    category: "sketch",
    available,
    reason: available ? undefined : formatSketchOnFaceAvailability(face),
    target: {
      ...createGeneratedReferenceTarget(face),
      eligibleFaceStableIds: available ? [face.stableId] : []
    },
    selection
  };
}

function createEdgeFinishAction(
  context: Extract<
    ModelingSelectionContext,
    { readonly selectionKind: "generatedReference" }
  >,
  selection: ModelingActionSelectionMetadata,
  operation: EdgeFinishOperation
): ModelingActionDescriptor {
  const state = createGeneratedReferenceSelectionState(context.reference);
  const referenceOption = selectEdgeFinishReferenceOption(
    createEdgeFinishReferenceOptions(state, context.namedReferences ?? []),
    SELECTED_EDGE_FINISH_REFERENCE_VALUE
  );
  const status = getEdgeFinishOperationStatus({
    body: context.body,
    feature: context.feature,
    operation,
    referenceOption,
    scalar: DEFAULT_EDGE_FINISH_SCALAR,
    selectionState: state
  });

  return {
    id: operation === "chamfer" ? "feature.chamfer" : "feature.fillet",
    label: operation === "chamfer" ? "Chamfer" : "Fillet",
    kind: "command",
    category: "feature",
    available: status.available,
    reason: status.available ? undefined : status.message,
    target: createGeneratedReferenceTarget(context.reference),
    selection
  };
}

function createGeneratedReferenceSelectionState(
  reference: CadGeneratedReference
): GeneratedReferenceSelectionState {
  return {
    status: "selected",
    selection: {
      bodyId: reference.bodyId,
      stableId: reference.stableId,
      kind: reference.kind
    },
    reference,
    measurementRows: []
  };
}

function createGeneratedReferenceTarget(
  reference: CadGeneratedReference
): ModelingActionTargetMetadata {
  return {
    bodyId: reference.bodyId,
    featureId: reference.sourceFeatureId,
    generatedReferenceStableId: reference.stableId,
    generatedReferenceKind: reference.kind
  };
}
