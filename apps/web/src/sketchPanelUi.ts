import type {
  CadBodySnapshot,
  CadFeatureSummary,
  CadParameterSnapshot,
  CadSelectionReferenceOperation,
  CadTopologyIdentitySourceSnapshot,
  CurrentSketchConstraintKind,
  FeatureExtrudeOperationMode,
  FeatureExtrudeSide,
  SketchConstraintEntry,
  SketchConstraintKind,
  SketchDimensionEntry,
  SketchDimensionStatus,
  SketchDimensionTarget,
  SketchSolverStatusQueryResponse,
  SketchEvaluationIssue,
  SketchEvaluationQueryResponse,
  CadSketchSolverDiagnostic,
  CadSketchSolverStatus,
  SketchEntityId,
  SketchEntityKind,
  SketchId,
  SketchEntitySnapshot,
  SketchPointTarget,
  SketchPointTargetRole,
  SketchSnapshot,
  TopologyCommandTargetReadinessQueryResponse
} from "@web-cad/cad-protocol";
import type { CreatableSketchEntityKind } from "./cadCommands";
export {
  createSketchEntitySelectionId,
  createSketchSelectionId
} from "./sketchRenderIds";

export interface BooleanTargetBodyOption {
  readonly bodyId: string;
  readonly featureId: string;
  readonly targetTopologyAnchorId?: string;
  readonly profileKind: "rectangle" | "circle";
  readonly label: string;
  readonly detail: string;
}

export interface BooleanOperationStatus {
  readonly available: boolean;
  readonly message: string;
}

export function getExtrudeSideForOperationMode(
  sketch: SketchSnapshot,
  operationMode: FeatureExtrudeOperationMode,
  currentSide: FeatureExtrudeSide
): FeatureExtrudeSide {
  if (!sketch.attachment) {
    return currentSide;
  }

  if (operationMode === "cut") {
    return "negative";
  }

  return currentSide === "negative" ? "positive" : currentSide;
}

export function getPreferredBooleanTargetBodyId(
  targetBodies: readonly BooleanTargetBodyOption[],
  preferredBodyId: string | undefined
): string | undefined {
  return getPreferredBooleanTargetBodyOption(targetBodies, preferredBodyId)
    ?.bodyId;
}

export function getPreferredBooleanTargetBodyOption(
  targetBodies: readonly BooleanTargetBodyOption[],
  preferredBodyId: string | undefined
): BooleanTargetBodyOption | undefined {
  return (
    targetBodies.find((body) => body.bodyId === preferredBodyId) ??
    targetBodies[0]
  );
}

export function getInitialSketchExtrudeOperationMode(
  sketch: SketchSnapshot | undefined,
  entity: SketchEntitySnapshot | undefined,
  cutTargetBodies: readonly BooleanTargetBodyOption[]
): FeatureExtrudeOperationMode {
  if (
    sketch?.attachment &&
    isExtrudableSketchEntity(entity) &&
    cutTargetBodies.some((body) => body.bodyId === sketch.attachment?.bodyId)
  ) {
    return "cut";
  }

  return "newBody";
}

export function getAttachedSketchBooleanTargetHint(
  sketch: SketchSnapshot | undefined,
  entity: SketchEntitySnapshot | undefined,
  cutTargetBodies: readonly BooleanTargetBodyOption[]
): string | undefined {
  if (!sketch?.attachment || !isExtrudableSketchEntity(entity)) {
    return undefined;
  }

  if (
    cutTargetBodies.some((body) => body.bodyId === sketch.attachment?.bodyId)
  ) {
    return undefined;
  }

  return "This sketch is attached to a result body face that is not ready for Cut/Add. Create a new body or choose an eligible target.";
}

export interface RevolveAxisOption {
  readonly entityId: SketchEntityId;
  readonly label: string;
  readonly detail: string;
}

export interface RevolveOperationStatus {
  readonly available: boolean;
  readonly message: string;
}

export interface HoleOperationFormLike {
  readonly depthMode: "blind" | "throughAll";
  readonly depth: number;
}

export interface HoleTargetFormLike {
  readonly targetBodyId: string;
  readonly targetTopologyAnchorId?: string;
}

export interface HoleSketchDisplayStatusLike {
  readonly kind: "unattached" | "attached" | "unresolved";
}

export interface SketchDimensionTargetOption {
  readonly target: SketchDimensionTarget;
  readonly label: string;
  readonly currentValue: number;
}

export interface ParameterBindingOption {
  readonly parameterId: string;
  readonly label: string;
}

export interface DimensionStatusDisplay {
  readonly label: string;
  readonly detail: string;
  readonly tone: "healthy" | "warning" | "error";
}

export interface SketchConstraintKindOption {
  readonly kind: CurrentSketchConstraintKind;
  readonly label: string;
}

export interface SketchPointTargetOption {
  readonly target: SketchPointTarget;
  readonly label: string;
  readonly detail: string;
  readonly coordinate?: readonly [number, number];
}

export interface SketchLineTargetOption {
  readonly entityId: SketchEntityId;
  readonly label: string;
  readonly detail: string;
}

export interface SketchPanelSelectionContext {
  readonly sketchId: SketchId;
  readonly entityId?: SketchEntityId;
}

export interface SketchEntityListItem {
  readonly id: SketchEntityId;
  readonly kind: SketchEntityKind;
  readonly kindLabel: string;
  readonly detail: string;
  readonly selected: boolean;
}

export interface SketchEntityIntentSummary {
  readonly dimensionCount: number;
  readonly constraintCount: number;
  readonly label: string;
}

export function chooseSketchPanelSelection(
  sketches: readonly SketchSnapshot[],
  currentSketchId: SketchId | undefined,
  focusedSketchId: SketchId | undefined
): SketchId | undefined {
  if (
    currentSketchId &&
    sketches.some((sketch) => sketch.id === currentSketchId)
  ) {
    return currentSketchId;
  }

  if (
    focusedSketchId &&
    sketches.some((sketch) => sketch.id === focusedSketchId)
  ) {
    return focusedSketchId;
  }

  return sketches[0]?.id;
}

export function chooseInitialSketchPanelSelection(
  sketches: readonly SketchSnapshot[],
  focusedSketchId: SketchId | undefined
): SketchId | undefined {
  return focusedSketchId &&
    sketches.some((sketch) => sketch.id === focusedSketchId)
    ? focusedSketchId
    : sketches[0]?.id;
}

export function getDefaultSketchEntityKind(
  sketch: SketchSnapshot | undefined
): CreatableSketchEntityKind {
  return sketch?.attachment && sketch.entities.length === 0
    ? "rectangle"
    : "point";
}

export function chooseSketchEntitySelection(
  entities: readonly SketchEntitySnapshot[],
  currentEntityId: SketchEntityId | undefined,
  focusedEntityId?: SketchEntityId
): SketchEntityId | undefined {
  if (
    focusedEntityId &&
    entities.some((entity) => entity.id === focusedEntityId)
  ) {
    return focusedEntityId;
  }

  if (
    currentEntityId &&
    entities.some((entity) => entity.id === currentEntityId)
  ) {
    return currentEntityId;
  }

  return entities[0]?.id;
}

export function createSketchEntityListItems(
  entities: readonly SketchEntitySnapshot[],
  selectedEntityId: SketchEntityId | undefined
): readonly SketchEntityListItem[] {
  return entities.map((entity) => ({
    id: entity.id,
    kind: entity.kind,
    kindLabel: getSketchEntityKindLabel(entity.kind),
    detail: getSketchEntityListDetail(entity),
    selected: entity.id === selectedEntityId
  }));
}

export function createSketchEntityIntentSummary(
  entityId: SketchEntityId,
  dimensions: readonly SketchDimensionEntry[],
  constraints: readonly SketchConstraintEntry[]
): SketchEntityIntentSummary {
  const dimensionCount = dimensions.filter(
    (dimension) => dimension.entityId === entityId
  ).length;
  const constraintCount = constraints.filter((constraint) =>
    isSketchConstraintRelatedToEntity(constraint, entityId)
  ).length;
  const parts = [
    dimensionCount > 0
      ? `${dimensionCount} dim${dimensionCount === 1 ? "" : "s"}`
      : undefined,
    constraintCount > 0
      ? `${constraintCount} constraint${constraintCount === 1 ? "" : "s"}`
      : undefined
  ].filter((part): part is string => part !== undefined);

  return {
    dimensionCount,
    constraintCount,
    label: parts.length > 0 ? parts.join(" · ") : "No dimensions or constraints"
  };
}

export function getSketchEntityOptionLabel(
  entity: SketchEntitySnapshot
): string {
  switch (entity.kind) {
    case "point":
      return `${entity.id} / point`;
    case "line":
      return `${entity.id} / line`;
    case "rectangle":
      return `${entity.id} / rectangle ${entity.width} x ${entity.height}`;
    case "circle":
      return `${entity.id} / circle r ${entity.radius}`;
    case "arc":
      return `${entity.id} / arc r ${entity.radius} / ${entity.startAngleDegrees}° + ${entity.sweepAngleDegrees}°`;
  }
}

export function getSketchEntityKindLabel(kind: SketchEntityKind): string {
  switch (kind) {
    case "point":
      return "Point";
    case "line":
      return "Line";
    case "rectangle":
      return "Rectangle";
    case "circle":
      return "Circle";
    case "arc":
      return "Arc";
  }
}

function getSketchEntityListDetail(entity: SketchEntitySnapshot): string {
  switch (entity.kind) {
    case "point":
      return `Position ${formatSketchPointCoordinate(entity.point)}`;
    case "line":
      return `${formatSketchPointCoordinate(
        entity.start
      )} to ${formatSketchPointCoordinate(entity.end)}`;
    case "rectangle":
      return `Center ${formatSketchPointCoordinate(entity.center)} / ${
        entity.width
      } x ${entity.height}`;
    case "circle":
      return `Center ${formatSketchPointCoordinate(entity.center)} / radius ${
        entity.radius
      }`;
    case "arc":
      return `Center ${formatSketchPointCoordinate(entity.center)} / radius ${entity.radius} / start ${entity.startAngleDegrees}° / sweep ${entity.sweepAngleDegrees}°`;
  }
}

export function isExtrudableSketchEntity(
  entity: SketchEntitySnapshot | undefined
): entity is SketchEntitySnapshot & { kind: "rectangle" | "circle" } {
  return entity?.kind === "rectangle" || entity?.kind === "circle";
}

export const isRevolvableSketchEntity = isExtrudableSketchEntity;

export function isHoleSketchEntity(
  entity: SketchEntitySnapshot | undefined
): entity is SketchEntitySnapshot & { kind: "circle" } {
  return entity?.kind === "circle";
}

export function createRevolveAxisOptions(
  sketch: SketchSnapshot | undefined
): readonly RevolveAxisOption[] {
  return (sketch?.entities ?? [])
    .filter(
      (
        entity
      ): entity is Extract<SketchEntitySnapshot, { readonly kind: "line" }> =>
        entity.kind === "line" && getLineLength(entity) > 0
    )
    .map((entity, index) => ({
      entityId: entity.id,
      label: `Axis ${index + 1} / ${getLineLength(entity)} mm`,
      detail: `${formatSketchPointCoordinate(
        entity.start
      )} to ${formatSketchPointCoordinate(entity.end)}`
    }));
}

export function getRevolveOperationStatus(
  entity: SketchEntitySnapshot | undefined,
  axisOptions: readonly RevolveAxisOption[],
  angleDegrees: number,
  sketchLineCount = axisOptions.length
): RevolveOperationStatus {
  if (!isRevolvableSketchEntity(entity)) {
    return {
      available: false,
      message: "Select a rectangle or circle profile to revolve."
    };
  }

  if (
    !Number.isFinite(angleDegrees) ||
    angleDegrees <= 0 ||
    angleDegrees > 360
  ) {
    return {
      available: false,
      message: "Revolve angle must be a positive finite value <= 360."
    };
  }

  if (axisOptions.length === 0) {
    return {
      available: false,
      message:
        sketchLineCount > 0
          ? "Edit the sketch line axis so it has non-zero length."
          : "Add a non-zero line entity in this sketch to use as the revolve axis."
    };
  }

  return {
    available: true,
    message:
      axisOptions.length === 1
        ? "1 eligible revolve axis."
        : `${axisOptions.length} eligible revolve axes.`
  };
}

export function createSketchDimensionTargetOptions(
  entity: SketchEntitySnapshot | undefined
): readonly SketchDimensionTargetOption[] {
  if (!entity) {
    return [];
  }

  if (entity.kind === "rectangle") {
    return [
      {
        target: { entityKind: "rectangle", role: "width" },
        label: "Width",
        currentValue: entity.width
      },
      {
        target: { entityKind: "rectangle", role: "height" },
        label: "Height",
        currentValue: entity.height
      }
    ];
  }

  if (entity.kind === "circle") {
    return [
      {
        target: { entityKind: "circle", role: "radius" },
        label: "Radius",
        currentValue: entity.radius
      }
    ];
  }

  if (entity.kind === "line") {
    return [
      {
        target: { entityKind: "line", role: "length" },
        label: "Length",
        currentValue: getLineLength(entity)
      }
    ];
  }

  return [];
}

export function createAvailableSketchDimensionTargetOptions(
  entity: SketchEntitySnapshot | undefined,
  dimensions: readonly SketchDimensionEntry[]
): readonly SketchDimensionTargetOption[] {
  return createSketchDimensionTargetOptions(entity).filter(
    (option) =>
      !dimensions.some(
        (dimension) =>
          dimension.entityId === entity?.id &&
          sketchDimensionTargetsEqual(dimension.target, option.target)
      )
  );
}

export function createAvailableSketchConstraintKindOptions(
  entity: SketchEntitySnapshot | undefined,
  constraints: readonly SketchConstraintEntry[],
  sketchEntities: readonly SketchEntitySnapshot[] = entity ? [entity] : []
): readonly SketchConstraintKindOption[] {
  if (!entity) {
    return [];
  }

  const options: SketchConstraintKindOption[] = [];
  const entityConstraints = constraints.filter((constraint) =>
    isSketchConstraintRelatedToEntity(constraint, entity.id)
  );
  const usedKinds = new Set(
    entityConstraints.map((constraint) => constraint.kind)
  );

  if (
    entity.kind === "line" &&
    getLineLength(entity) > 0 &&
    !usedKinds.has("horizontal") &&
    !usedKinds.has("vertical")
  ) {
    options.push(
      { kind: "horizontal", label: "Horizontal" },
      { kind: "vertical", label: "Vertical" }
    );
  }

  if (createAvailableFixedPointTargetOptions(entity, constraints).length > 0) {
    options.push({ kind: "fixed", label: "Fixed point" });
  }

  const primaryTargets = createSketchPointTargetOptionsForEntity(entity);
  const hasCoincidentTarget = primaryTargets.some(
    (option) =>
      createAvailableCoincidentPointTargetOptions(
        option.target,
        sketchEntities,
        constraints
      ).length > 0
  );

  if (hasCoincidentTarget) {
    options.push({ kind: "coincident", label: "Coincident" });
  }

  if (
    entity.kind === "line" &&
    createAvailableMidpointTargetOptions(entity, sketchEntities, constraints)
      .length > 0
  ) {
    options.push({ kind: "midpoint", label: "Midpoint" });
  }

  if (
    entity.kind === "line" &&
    getLineLength(entity) > 0 &&
    createAvailableParallelLineTargetOptions(
      entity,
      sketchEntities,
      constraints
    ).length > 0
  ) {
    options.push(
      { kind: "parallel", label: "Parallel" },
      { kind: "perpendicular", label: "Perpendicular" }
    );
  }

  return options;
}

export function getSketchConstraintKindLabel(
  kind: SketchConstraintKind
): string {
  switch (kind) {
    case "horizontal":
      return "Horizontal";
    case "vertical":
      return "Vertical";
    case "fixed":
      return "Fixed point";
    case "coincident":
      return "Coincident";
    case "midpoint":
      return "Midpoint";
    case "parallel":
      return "Parallel";
    case "perpendicular":
      return "Perpendicular";
    case "tangent":
      return "Tangent";
    case "concentric":
      return "Concentric";
    case "equalLength":
      return "Equal length";
    case "equalRadius":
      return "Equal radius";
    case "angle":
      return "Angle";
    case "symmetry":
      return "Symmetry";
  }
}

export function formatSketchConstraintStatus(
  constraint: SketchConstraintEntry
): string {
  const summary = `${getSketchConstraintKindLabel(
    constraint.kind
  )} · ${formatSketchConstraintTargetSummary(constraint)}`;

  if (constraint.status === "healthy") {
    return `${summary} · Healthy`;
  }

  return `${summary} · ${
    constraint.issues[0]?.message ??
    getSketchDimensionStatusLabel(constraint.status)
  }`;
}

export function getSketchConstraintStatusDisplay(
  constraint: SketchConstraintEntry
): DimensionStatusDisplay {
  return {
    label: getSketchDimensionStatusLabel(constraint.status),
    detail: formatSketchConstraintStatus(constraint),
    tone: getSketchDimensionStatusTone(constraint.status)
  };
}

export function getSketchDimensionTargetLabel(
  target: SketchDimensionTarget
): string {
  switch (target.role) {
    case "width":
      return "Width";
    case "height":
      return "Height";
    case "radius":
      return "Radius";
    case "length":
      return "Length";
  }
}

export function createSketchPointTargetOptions(
  entities: readonly SketchEntitySnapshot[]
): readonly SketchPointTargetOption[] {
  return entities.flatMap((entity) =>
    createSketchPointTargetOptionsForEntity(entity)
  );
}

export function createSketchPointTargetOptionsForEntity(
  entity: SketchEntitySnapshot | undefined
): readonly SketchPointTargetOption[] {
  if (!entity) {
    return [];
  }

  if (entity.kind === "point") {
    return [
      {
        target: { entityId: entity.id, role: "position" },
        label: `${entity.id} position`,
        detail: "Point position",
        coordinate: entity.point
      }
    ];
  }

  if (entity.kind === "line") {
    return [
      {
        target: { entityId: entity.id, role: "start" },
        label: `${entity.id} start`,
        detail: "Line start",
        coordinate: entity.start
      },
      {
        target: { entityId: entity.id, role: "end" },
        label: `${entity.id} end`,
        detail: "Line end",
        coordinate: entity.end
      }
    ];
  }

  if (entity.kind === "rectangle") {
    return [
      {
        target: { entityId: entity.id, role: "center" },
        label: `${entity.id} center`,
        detail: "Rectangle center",
        coordinate: entity.center
      }
    ];
  }

  if (entity.kind === "circle") {
    return [
      {
        target: { entityId: entity.id, role: "center" },
        label: `${entity.id} center`,
        detail: "Circle center",
        coordinate: entity.center
      }
    ];
  }

  return [];
}

export function createAvailableFixedPointTargetOptions(
  entity: SketchEntitySnapshot | undefined,
  constraints: readonly SketchConstraintEntry[]
): readonly SketchPointTargetOption[] {
  return createSketchPointTargetOptionsForEntity(entity).filter(
    (option) =>
      !constraints.some(
        (constraint) =>
          constraint.kind === "fixed" &&
          sketchPointTargetsEqual(constraint.target, option.target)
      )
  );
}

export function createAvailableCoincidentPointTargetOptions(
  primaryTarget: SketchPointTarget | undefined,
  entities: readonly SketchEntitySnapshot[],
  constraints: readonly SketchConstraintEntry[]
): readonly SketchPointTargetOption[] {
  if (!primaryTarget) {
    return [];
  }

  return createSketchPointTargetOptions(entities).filter((option) => {
    if (sketchPointTargetsEqual(primaryTarget, option.target)) {
      return false;
    }

    return !constraints.some(
      (constraint) =>
        constraint.kind === "coincident" &&
        sketchPointTargetPairKey(
          constraint.primaryTarget,
          constraint.secondaryTarget
        ) === sketchPointTargetPairKey(primaryTarget, option.target)
    );
  });
}

export function createAvailableMidpointTargetOptions(
  lineEntity: SketchEntitySnapshot | undefined,
  entities: readonly SketchEntitySnapshot[],
  constraints: readonly SketchConstraintEntry[]
): readonly SketchPointTargetOption[] {
  if (lineEntity?.kind !== "line") {
    return [];
  }

  return createMidpointPointTargetOptions(entities).filter((option) => {
    if (option.target.entityId === lineEntity.id) {
      return false;
    }

    return !constraints.some(
      (constraint) =>
        constraint.kind === "midpoint" &&
        constraint.lineEntityId === lineEntity.id &&
        sketchPointTargetsEqual(constraint.target, option.target)
    );
  });
}

export function createAvailableParallelLineTargetOptions(
  primaryLine: SketchEntitySnapshot | undefined,
  entities: readonly SketchEntitySnapshot[],
  constraints: readonly SketchConstraintEntry[]
): readonly SketchLineTargetOption[] {
  if (primaryLine?.kind !== "line") {
    return [];
  }

  if (getLineLength(primaryLine) <= 0) {
    return [];
  }

  return entities
    .filter(
      (
        entity
      ): entity is Extract<SketchEntitySnapshot, { readonly kind: "line" }> =>
        entity.kind === "line" &&
        entity.id !== primaryLine.id &&
        getLineLength(entity) > 0
    )
    .filter(
      (entity) =>
        !constraints.some(
          (constraint) =>
            (constraint.kind === "parallel" ||
              constraint.kind === "perpendicular") &&
            constraint.primaryLineEntityId === primaryLine.id &&
            constraint.secondaryLineEntityId === entity.id
        )
    )
    .map((entity) => ({
      entityId: entity.id,
      label: entity.id,
      detail: `${formatSketchPointCoordinate(
        entity.start
      )} to ${formatSketchPointCoordinate(entity.end)}`
    }));
}

export function isSketchConstraintRelatedToEntity(
  constraint: SketchConstraintEntry,
  entityId: SketchEntityId
): boolean {
  if (constraint.kind === "fixed") {
    return constraint.target.entityId === entityId;
  }

  if (constraint.kind === "coincident") {
    return (
      constraint.primaryTarget.entityId === entityId ||
      constraint.secondaryTarget.entityId === entityId
    );
  }

  if (constraint.kind === "midpoint") {
    return (
      constraint.lineEntityId === entityId ||
      constraint.target.entityId === entityId
    );
  }

  if (constraint.kind === "parallel" || constraint.kind === "perpendicular") {
    return (
      constraint.primaryLineEntityId === entityId ||
      constraint.secondaryLineEntityId === entityId
    );
  }

  return constraint.entityId === entityId;
}

export function getDefaultSketchPointTargetRole(
  entity: SketchEntitySnapshot | undefined
): SketchPointTargetRole {
  if (entity?.kind === "line") {
    return "start";
  }

  if (entity?.kind === "point") {
    return "position";
  }

  return "center";
}

export function sketchPointTargetsEqual(
  left: SketchPointTarget,
  right: SketchPointTarget
): boolean {
  return left.entityId === right.entityId && left.role === right.role;
}

export function formatSketchPointTarget(target: SketchPointTarget): string {
  return `${target.entityId} ${target.role}`;
}

export function formatSketchPointCoordinate(
  coordinate: readonly [number, number] | undefined
): string {
  return coordinate ? `${coordinate[0]}, ${coordinate[1]}` : "current point";
}

function formatSketchConstraintTargetSummary(
  constraint: SketchConstraintEntry
): string {
  if (constraint.kind === "fixed") {
    return `${formatSketchPointTarget(
      constraint.target
    )} at ${formatSketchPointCoordinate(
      constraint.currentCoordinate ?? constraint.coordinate
    )}`;
  }

  if (constraint.kind === "coincident") {
    return `${formatSketchPointTarget(
      constraint.primaryTarget
    )} to ${formatSketchPointTarget(constraint.secondaryTarget)}`;
  }

  if (constraint.kind === "midpoint") {
    return `${formatSketchPointTarget(constraint.target)} at midpoint of ${
      constraint.lineEntityId
    }`;
  }

  if (constraint.kind === "parallel" || constraint.kind === "perpendicular") {
    return `${constraint.secondaryLineEntityId} ${constraint.kind} to ${constraint.primaryLineEntityId}`;
  }

  return constraint.entityId;
}

export function getSketchDimensionTargetValue(
  entity: SketchEntitySnapshot | undefined,
  target: SketchDimensionTarget | undefined
): number {
  if (!entity || !target) {
    return 1;
  }

  if (entity.kind === "rectangle" && target.entityKind === "rectangle") {
    return target.role === "width" ? entity.width : entity.height;
  }

  if (entity.kind === "circle" && target.entityKind === "circle") {
    return entity.radius;
  }

  if (entity.kind === "line" && target.entityKind === "line") {
    return getLineLength(entity);
  }

  return 1;
}

function getLineLength(
  entity: Extract<SketchEntitySnapshot, { readonly kind: "line" }>
): number {
  const length = Math.hypot(
    entity.end[0] - entity.start[0],
    entity.end[1] - entity.start[1]
  );
  const rounded = Math.round(length * 1e12) / 1e12;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function createMidpointPointTargetOptions(
  entities: readonly SketchEntitySnapshot[]
): readonly SketchPointTargetOption[] {
  return entities.flatMap((entity) => {
    if (entity.kind === "line") {
      return [];
    }

    return createSketchPointTargetOptionsForEntity(entity);
  });
}

function sketchPointTargetPairKey(
  left: SketchPointTarget,
  right: SketchPointTarget
): string {
  return [left, right]
    .map((target) => `${target.entityId}:${target.role}`)
    .sort()
    .join("|");
}

export function formatSketchDimensionValueSource(
  dimension: SketchDimensionEntry,
  parameters: readonly CadParameterSnapshot[]
): string {
  const valueSource = dimension.valueSource;

  if (valueSource.type === "literal") {
    return `${valueSource.value}`;
  }

  const parameter = parameters.find(
    (candidate) => candidate.id === valueSource.parameterId
  );

  return parameter
    ? `${parameter.name} = ${parameter.value}`
    : `Missing parameter ${valueSource.parameterId}`;
}

export function formatSketchDimensionEffectiveValue(
  dimension: SketchDimensionEntry
): string {
  return dimension.effectiveValue !== undefined
    ? `Effective ${dimension.effectiveValue}`
    : "No effective value";
}

export function formatSketchDimensionStatus(
  dimension: SketchDimensionEntry
): string {
  if (dimension.status === "healthy") {
    return dimension.effectiveValue !== undefined
      ? `Healthy · ${formatSketchDimensionEffectiveValue(dimension)}`
      : "Healthy";
  }

  return dimension.issues[0]?.message ?? dimension.status;
}

export function getSketchDimensionStatusDisplay(
  dimension: SketchDimensionEntry
): DimensionStatusDisplay {
  return {
    label: getSketchDimensionStatusLabel(dimension.status),
    detail: formatSketchDimensionStatus(dimension),
    tone: getSketchDimensionStatusTone(dimension.status)
  };
}

export function formatSketchEvaluationStatus(
  evaluation: SketchEvaluationQueryResponse | undefined
): string {
  if (!evaluation) {
    return "Evaluation unavailable";
  }

  if (evaluation.dimensionCount === 0 && evaluation.constraintCount === 0) {
    return "No driving dimensions or constraints";
  }

  if (evaluation.status === "healthy") {
    const drivers = [
      `${evaluation.dimensionCount} driving dimension${
        evaluation.dimensionCount === 1 ? "" : "s"
      }`,
      `${evaluation.constraintCount} constraint${
        evaluation.constraintCount === 1 ? "" : "s"
      }`
    ];

    return `${drivers.join(" · ")} · ${evaluation.drivenEntityCount} driven ${
      evaluation.drivenEntityCount === 1 ? "entity" : "entities"
    }`;
  }

  return `${getSketchDimensionStatusLabel(evaluation.status)} · ${
    evaluation.issueCount
  } issue${evaluation.issueCount === 1 ? "" : "s"}`;
}

export function getSketchEvaluationStatusDisplay(
  evaluation: SketchEvaluationQueryResponse | undefined
): DimensionStatusDisplay {
  const status = evaluation?.status ?? "unsupported";

  return {
    label: evaluation ? getSketchDimensionStatusLabel(status) : "Unavailable",
    detail: formatSketchEvaluationStatus(evaluation),
    tone: evaluation ? getSketchDimensionStatusTone(status) : "warning"
  };
}

export function formatSketchSolverStatus(
  status: SketchSolverStatusQueryResponse | undefined
): string {
  if (!status) {
    return "Solver status unavailable";
  }

  const profileText = formatSketchProfileValidity(status);
  const solverText = status.solver.solverRan
    ? `Numerical ${formatSketchNumericalSolverStatus(
        status.solver.numericalSolverStatus
      )}`
    : "Numerical solver not run";

  if (
    status.status === "solved" ||
    status.status === "fully-defined" ||
    status.status === "under-defined"
  ) {
    return `${solverText} · ${profileText}`;
  }

  return `${getSketchSolverStatusLabel(status.status)} · ${
    status.diagnosticCount
  } diagnostic${status.diagnosticCount === 1 ? "" : "s"} · ${profileText}`;
}

export function getSketchSolverStatusDisplay(
  status: SketchSolverStatusQueryResponse | undefined
): DimensionStatusDisplay {
  if (isFeatureReadyUnderDefinedSketch(status)) {
    return {
      label: "Feature-ready",
      detail: formatSketchSolverStatus(status),
      tone: "healthy"
    };
  }

  return {
    label: status ? getSketchSolverStatusLabel(status.status) : "Unavailable",
    detail: formatSketchSolverStatus(status),
    tone: status ? getSketchSolverStatusTone(status.status) : "warning"
  };
}

function isFeatureReadyUnderDefinedSketch(
  status: SketchSolverStatusQueryResponse | undefined
): boolean {
  return (
    status?.status === "under-defined" &&
    status.profileValidity.status === "valid" &&
    status.profileValidity.validProfileCount > 0
  );
}

export function formatSketchProfileValidity(
  status: SketchSolverStatusQueryResponse
): string {
  const profile = status.profileValidity;
  const profileLabel =
    profile.status === "valid"
      ? "feature-ready"
      : profile.status === "invalid"
        ? "invalid"
        : profile.status === "not-evaluated"
          ? "not evaluated"
          : "unsupported";

  return `${profile.validProfileCount}/${profile.profileCount} ${profileLabel} ${
    profile.profileCount === 1 ? "profile" : "profiles"
  }`;
}

export function formatSketchSolverDiagnostic(
  diagnostic: CadSketchSolverDiagnostic
): string {
  const subject =
    diagnostic.sketchConstraintId ??
    diagnostic.sketchDimensionId ??
    diagnostic.sketchEntityId ??
    diagnostic.sketchId;

  return subject ? `${subject}: ${diagnostic.message}` : diagnostic.message;
}

export function formatSketchEvaluationIssue(
  issue: SketchEvaluationIssue
): string {
  const subject =
    ("sketchConstraintId" in issue ? issue.sketchConstraintId : undefined) ??
    ("sketchDimensionId" in issue ? issue.sketchDimensionId : undefined) ??
    ("sketchEntityId" in issue ? issue.sketchEntityId : undefined) ??
    ("parameterId" in issue ? issue.parameterId : undefined) ??
    issue.sketchId;

  return subject ? `${subject}: ${issue.message}` : issue.message;
}

function getSketchSolverStatusLabel(status: CadSketchSolverStatus): string {
  switch (status) {
    case "not-run":
      return "Not run";
    case "solved":
      return "Solved";
    case "fully-defined":
      return "Fully defined";
    case "under-defined":
      return "Under-defined";
    case "over-defined":
      return "Over-defined";
    case "conflicting":
      return "Conflicting";
    case "redundant":
      return "Redundant";
    case "failed":
      return "Failed";
    case "unsupported":
      return "Unsupported";
    case "missing-target":
      return "Missing target";
  }
}

function getSketchSolverStatusTone(
  status: CadSketchSolverStatus
): DimensionStatusDisplay["tone"] {
  switch (status) {
    case "solved":
    case "fully-defined":
      return "healthy";
    case "not-run":
    case "under-defined":
    case "redundant":
    case "unsupported":
      return "warning";
    case "over-defined":
    case "conflicting":
    case "failed":
    case "missing-target":
      return "error";
  }
}

function formatSketchNumericalSolverStatus(
  status: SketchSolverStatusQueryResponse["solver"]["numericalSolverStatus"]
): string {
  switch (status) {
    case "converged":
      return "converged";
    case "under-defined":
      return "under-defined";
    case "over-defined":
      return "over-defined";
    case "conflicting":
      return "conflicting";
    case "failed":
      return "failed";
    case "unsupported":
      return "unsupported";
    case "deferred":
      return "not ready";
    case "not-run":
      return "not run";
  }
}

export function getSketchDimensionStatusLabel(
  status: SketchDimensionStatus
): string {
  switch (status) {
    case "healthy":
      return "Healthy";
    case "under-defined":
      return "Under-defined";
    case "over-defined":
      return "Over-defined";
    case "unsupported":
      return "Unsupported";
    case "missing-target":
      return "Missing target";
    case "invalid-value":
      return "Invalid value";
    case "inconsistent":
      return "Inconsistent";
  }
}

function getSketchDimensionStatusTone(
  status: SketchDimensionStatus
): DimensionStatusDisplay["tone"] {
  switch (status) {
    case "healthy":
      return "healthy";
    case "under-defined":
    case "over-defined":
      return "warning";
    case "unsupported":
      return "warning";
    case "missing-target":
    case "invalid-value":
    case "inconsistent":
      return "error";
  }
}

export function createParameterBindingOptions(
  parameters: readonly CadParameterSnapshot[]
): readonly ParameterBindingOption[] {
  return parameters.map((parameter) => ({
    parameterId: parameter.id,
    label: `${parameter.name} (${parameter.value})`
  }));
}

export function getParameterDimensionUsageCount(
  parameterId: string,
  dimensions: readonly SketchDimensionEntry[]
): number {
  return dimensions.filter(
    (dimension) =>
      dimension.valueSource.type === "parameter" &&
      dimension.valueSource.parameterId === parameterId
  ).length;
}

export function createAddTargetBodyOptions(
  bodies: readonly CadBodySnapshot[],
  features: readonly CadFeatureSummary[],
  preferredBodyId?: string,
  topologyAnchors?: CadTopologyIdentitySourceSnapshot["anchors"],
  readinessByTopologyAnchorId?: ReadonlyMap<
    string,
    TopologyCommandTargetReadinessQueryResponse
  >
): readonly BooleanTargetBodyOption[] {
  return createBooleanTargetBodyOptions(
    bodies,
    features,
    "add",
    preferredBodyId,
    topologyAnchors,
    readinessByTopologyAnchorId
  );
}

export function createCutTargetBodyOptions(
  bodies: readonly CadBodySnapshot[],
  features: readonly CadFeatureSummary[],
  preferredBodyId?: string,
  topologyAnchors?: CadTopologyIdentitySourceSnapshot["anchors"]
): readonly BooleanTargetBodyOption[] {
  return createBooleanTargetBodyOptions(
    bodies,
    features,
    "cut",
    preferredBodyId,
    topologyAnchors
  );
}

export function createHoleTargetBodyOptions(
  bodies: readonly CadBodySnapshot[],
  features: readonly CadFeatureSummary[],
  preferredBodyId?: string,
  topologyAnchors?: CadTopologyIdentitySourceSnapshot["anchors"],
  readinessByTopologyAnchorId?: ReadonlyMap<
    string,
    TopologyCommandTargetReadinessQueryResponse
  >
): readonly BooleanTargetBodyOption[] {
  return createBooleanTargetBodyOptions(
    bodies,
    features,
    "hole",
    preferredBodyId,
    topologyAnchors,
    readinessByTopologyAnchorId
  );
}

function createBooleanTargetBodyOptions(
  bodies: readonly CadBodySnapshot[],
  features: readonly CadFeatureSummary[],
  operationMode: "add" | "cut" | "hole",
  preferredBodyId?: string,
  topologyAnchors: CadTopologyIdentitySourceSnapshot["anchors"] = [],
  readinessByTopologyAnchorId?: ReadonlyMap<
    string,
    TopologyCommandTargetReadinessQueryResponse
  >
): readonly BooleanTargetBodyOption[] {
  const options = bodies
    .filter(
      (body) =>
        body.source.type === "sketchExtrudeFeature" &&
        body.consumedByFeatureId === undefined
    )
    .flatMap((body, index) => {
      const feature = features.find(
        (
          candidate
        ): candidate is Extract<CadFeatureSummary, { kind: "extrude" }> =>
          candidate.kind === "extrude" && candidate.id === body.featureId
      );
      const activeBodyAnchorId = findActiveBodyTopologyAnchorId(
        topologyAnchors,
        body.id
      );
      const targetProfileKind = feature
        ? resolveBooleanTargetProfileKind(
            features,
            feature,
            activeBodyAnchorId !== undefined
          )
        : undefined;
      const isTopologyResultTarget = feature?.operationMode !== "newBody";

      if (
        !feature ||
        targetProfileKind === undefined ||
        !isSupportedTargetProfileKind(
          operationMode,
          targetProfileKind,
          isTopologyResultTarget
        )
      ) {
        return [];
      }

      const targetTopologyAnchorId = isTopologyResultTarget
        ? (activeBodyAnchorId ?? feature.targetTopologyAnchorId)
        : undefined;

      if (
        isTopologyResultTarget &&
        operationMode === "add" &&
        !readinessByTopologyAnchorId
      ) {
        return [];
      }

      if (
        isTopologyResultTarget &&
        readinessByTopologyAnchorId &&
        !isCommandReadyTopologyAnchor(
          readinessByTopologyAnchorId,
          targetTopologyAnchorId,
          operationModeToReferenceOperation(operationMode)
        )
      ) {
        return [];
      }

      return [
        {
          bodyId: body.id,
          featureId: feature.id,
          ...(targetTopologyAnchorId ? { targetTopologyAnchorId } : {}),
          profileKind: targetProfileKind,
          label:
            body.name ??
            `${formatProfileKind(targetProfileKind)} ${
              isTopologyResultTarget ? "result" : "target"
            } ${index + 1} / ${feature.depth} mm`,
          detail: isTopologyResultTarget
            ? `${formatProfileKind(targetProfileKind)} result body / ${
                feature.operationMode
              }`
            : `${formatProfileKind(targetProfileKind)} new body / ${
                feature.depth
              } mm / ${feature.side}`
        }
      ];
    });

  if (!preferredBodyId) {
    return options;
  }

  return [...options].sort((left, right) => {
    if (left.bodyId === preferredBodyId) {
      return -1;
    }

    if (right.bodyId === preferredBodyId) {
      return 1;
    }

    return 0;
  });
}

function operationModeToReferenceOperation(
  operationMode: "add" | "cut" | "hole"
): CadSelectionReferenceOperation {
  switch (operationMode) {
    case "add":
      return "feature.extrudeAddTarget";
    case "cut":
      return "feature.extrudeCutTarget";
    case "hole":
      return "feature.holeTarget";
  }
}

function isCommandReadyTopologyAnchor(
  readinessByTopologyAnchorId: ReadonlyMap<
    string,
    TopologyCommandTargetReadinessQueryResponse
  >,
  topologyAnchorId: string | undefined,
  operation: CadSelectionReferenceOperation
): boolean {
  if (!topologyAnchorId) {
    return false;
  }

  const response = readinessByTopologyAnchorId.get(topologyAnchorId);

  return (
    response?.commandable === true &&
    response.supportedOperations.includes(operation)
  );
}

function findActiveBodyTopologyAnchorId(
  anchors: CadTopologyIdentitySourceSnapshot["anchors"],
  bodyId: string
): string | undefined {
  return anchors.find(
    (anchor) =>
      anchor.state === "active" &&
      anchor.entityKind === "body" &&
      anchor.bodyId === bodyId &&
      (anchor.stableId === undefined ||
        anchor.stableId === `generated:body:${bodyId}`)
  )?.anchorId;
}

function resolveBooleanTargetProfileKind(
  features: readonly CadFeatureSummary[],
  feature: Extract<CadFeatureSummary, { kind: "extrude" }>,
  allowActiveResultBodyAnchor = false
): Extract<CadFeatureSummary, { kind: "extrude" }>["profileKind"] | undefined {
  if (feature.operationMode === "newBody") {
    return feature.profileKind;
  }

  if (!feature.targetTopologyAnchorId && !allowActiveResultBodyAnchor) {
    return undefined;
  }

  let current: Extract<CadFeatureSummary, { kind: "extrude" }> | undefined =
    feature;
  const visitedFeatureIds = new Set<string>();

  while (current && !visitedFeatureIds.has(current.id)) {
    visitedFeatureIds.add(current.id);

    if (current.operationMode === "newBody") {
      return current.profileKind;
    }

    if (!current.targetBodyId) {
      return undefined;
    }

    if (
      feature.targetTopologyAnchorId &&
      current.targetTopologyAnchorId !== feature.targetTopologyAnchorId
    ) {
      return undefined;
    }

    const targetBodyId = current.targetBodyId;
    const parent = features.find(
      (
        candidate
      ): candidate is Extract<CadFeatureSummary, { kind: "extrude" }> =>
        candidate.kind === "extrude" && candidate.bodyId === targetBodyId
    );
    current = parent;
  }

  return undefined;
}

export function getAddOperationStatus(
  entity: SketchEntitySnapshot | undefined,
  addTargets: readonly BooleanTargetBodyOption[]
): BooleanOperationStatus {
  if (!entity) {
    return {
      available: false,
      message:
        "Select a rectangle or circle profile to add to an existing body."
    };
  }

  if (entity.kind !== "rectangle" && entity.kind !== "circle") {
    return {
      available: false,
      message:
        "Add currently supports rectangle or circle profiles on eligible rectangle or circle targets. This profile can still create a new body."
    };
  }

  if (addTargets.length === 0) {
    return {
      available: false,
      message:
        "Create an active rectangle or circle body, or select a ready result body, before using Add to body."
    };
  }

  return {
    available: true,
    message:
      addTargets.length === 1
        ? "1 eligible add target body."
        : `${addTargets.length} eligible add target bodies.`
  };
}

export function getCutOperationStatus(
  entity: SketchEntitySnapshot | undefined,
  cutTargets: readonly BooleanTargetBodyOption[]
): BooleanOperationStatus {
  if (!entity) {
    return {
      available: false,
      message: "Select a rectangle or circle profile to cut an existing body."
    };
  }

  if (entity.kind !== "rectangle" && entity.kind !== "circle") {
    return {
      available: false,
      message:
        "Cut currently supports rectangle or circle profiles only. This profile can still create a new body."
    };
  }

  if (cutTargets.length === 0) {
    return {
      available: false,
      message:
        "Create an active rectangle, circle, or previous result body before using Cut body."
    };
  }

  return {
    available: true,
    message:
      cutTargets.length === 1
        ? "1 eligible cut target body."
        : `${cutTargets.length} eligible cut target bodies.`
  };
}

export function getHoleOperationStatus(
  entity: SketchEntitySnapshot | undefined,
  holeTargets: readonly BooleanTargetBodyOption[],
  form: HoleOperationFormLike,
  sketchDisplayStatus?: HoleSketchDisplayStatusLike
): BooleanOperationStatus {
  if (!entity) {
    return {
      available: false,
      message: "Select a circle profile to create a hole."
    };
  }

  if (entity.kind !== "circle") {
    return {
      available: false,
      message: "Hole currently supports circle profiles only."
    };
  }

  if (sketchDisplayStatus?.kind === "unresolved") {
    return {
      available: false,
      message: "Resolve the attached sketch face before creating a hole."
    };
  }

  if (
    form.depthMode === "blind" &&
    (!Number.isFinite(form.depth) || form.depth <= 0)
  ) {
    return {
      available: false,
      message: "Blind hole depth must be a positive finite value."
    };
  }

  if (holeTargets.length === 0) {
    return {
      available: false,
      message:
        "Create an eligible rectangle, circle, or stable result target before creating a hole."
    };
  }

  return {
    available: true,
    message:
      holeTargets.length === 1
        ? "1 eligible hole target body."
        : `${holeTargets.length} eligible hole target bodies.`
  };
}

export function getHoleTargetGuidance(
  selectedTarget: BooleanTargetBodyOption | undefined,
  sketchPlane: SketchSnapshot["plane"] | undefined
): string | undefined {
  if (!selectedTarget) {
    return undefined;
  }

  if (
    selectedTarget.profileKind === "circle" &&
    (sketchPlane === "XZ" || sketchPlane === "YZ")
  ) {
    return `Creates a side hole through the circular target from the ${sketchPlane} sketch plane.`;
  }

  if (selectedTarget.profileKind === "circle") {
    return "Creates an axial hole through the circular target. Use an XZ or YZ sketch for a side hole.";
  }

  if (sketchPlane === "XZ" || sketchPlane === "YZ") {
    return `Creates a hole from the ${sketchPlane} sketch plane through the selected target.`;
  }

  return "Creates a hole result body. The target stays in structure as consumed.";
}

export function createEffectiveHoleTargetForm<T extends HoleTargetFormLike>(
  form: T,
  selectedTarget:
    | Pick<BooleanTargetBodyOption, "bodyId" | "targetTopologyAnchorId">
    | undefined
): T {
  return {
    ...form,
    targetBodyId: selectedTarget?.bodyId ?? form.targetBodyId,
    targetTopologyAnchorId: selectedTarget?.targetTopologyAnchorId
  };
}

function isSupportedCutTargetProfileKind(
  profileKind: Extract<CadFeatureSummary, { kind: "extrude" }>["profileKind"]
): boolean {
  return profileKind === "rectangle" || profileKind === "circle";
}

function isSupportedAddTargetProfileKind(
  profileKind: Extract<CadFeatureSummary, { kind: "extrude" }>["profileKind"],
  isTopologyResultTarget = false
): boolean {
  return (
    profileKind === "rectangle" ||
    (isTopologyResultTarget && profileKind === "circle")
  );
}

function isSupportedTargetProfileKind(
  operationMode: "add" | "cut" | "hole",
  profileKind: Extract<CadFeatureSummary, { kind: "extrude" }>["profileKind"],
  isTopologyResultTarget = false
): boolean {
  if (operationMode === "add") {
    return isSupportedAddTargetProfileKind(profileKind, isTopologyResultTarget);
  }

  return isSupportedCutTargetProfileKind(profileKind);
}

export function sketchDimensionTargetsEqual(
  left: SketchDimensionTarget,
  right: SketchDimensionTarget | undefined
): boolean {
  if (!right) {
    return false;
  }

  return left.entityKind === right.entityKind && left.role === right.role;
}

function formatProfileKind(
  profileKind: Extract<CadFeatureSummary, { kind: "extrude" }>["profileKind"]
): string {
  return profileKind === "rectangle" ? "Rectangle" : "Circle";
}
