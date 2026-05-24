import type {
  CadBodySnapshot,
  CadFeatureSummary,
  CadParameterSnapshot,
  SketchConstraintEntry,
  SketchConstraintKind,
  SketchDimensionEntry,
  SketchDimensionStatus,
  SketchDimensionTarget,
  SketchEvaluationIssue,
  SketchEvaluationQueryResponse,
  SketchEntityId,
  SketchEntityKind,
  SketchId,
  SketchEntitySnapshot,
  SketchPointTarget,
  SketchPointTargetRole,
  SketchSnapshot
} from "@web-cad/cad-protocol";

export interface BooleanTargetBodyOption {
  readonly bodyId: string;
  readonly featureId: string;
  readonly profileKind: "rectangle" | "circle";
  readonly label: string;
  readonly detail: string;
}

export interface BooleanOperationStatus {
  readonly available: boolean;
  readonly message: string;
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
  readonly kind: SketchConstraintKind;
  readonly label: string;
}

export interface SketchPointTargetOption {
  readonly target: SketchPointTarget;
  readonly label: string;
  readonly detail: string;
  readonly coordinate?: readonly [number, number];
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

export function getDefaultSketchEntityKind(
  sketch: SketchSnapshot | undefined
): SketchEntityKind {
  return sketch?.attachment && sketch.entities.length === 0
    ? "rectangle"
    : "point";
}

export function chooseSketchEntitySelection(
  entities: readonly SketchEntitySnapshot[],
  currentEntityId: SketchEntityId | undefined
): SketchEntityId | undefined {
  if (
    currentEntityId &&
    entities.some((entity) => entity.id === currentEntityId)
  ) {
    return currentEntityId;
  }

  return entities[0]?.id;
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
  }
}

export function isExtrudableSketchEntity(
  entity: SketchEntitySnapshot | undefined
): entity is SketchEntitySnapshot & { kind: "rectangle" | "circle" } {
  return entity?.kind === "rectangle" || entity?.kind === "circle";
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

  return [
    {
      target: { entityId: entity.id, role: "center" },
      label: `${entity.id} center`,
      detail: "Circle center",
      coordinate: entity.center
    }
  ];
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

export function formatSketchEvaluationIssue(
  issue: SketchEvaluationIssue
): string {
  const subject =
    ("sketchConstraintId" in issue ? issue.sketchConstraintId : undefined) ??
    ("sketchDimensionId" in issue ? issue.sketchDimensionId : undefined) ??
    issue.sketchEntityId ??
    ("parameterId" in issue ? issue.parameterId : undefined) ??
    issue.sketchId;

  return subject ? `${subject}: ${issue.message}` : issue.message;
}

export function getSketchDimensionStatusLabel(
  status: SketchDimensionStatus
): string {
  switch (status) {
    case "healthy":
      return "Healthy";
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
  preferredBodyId?: string
): readonly BooleanTargetBodyOption[] {
  return createBooleanTargetBodyOptions(
    bodies,
    features,
    "add",
    preferredBodyId
  );
}

export function createCutTargetBodyOptions(
  bodies: readonly CadBodySnapshot[],
  features: readonly CadFeatureSummary[],
  preferredBodyId?: string
): readonly BooleanTargetBodyOption[] {
  return createBooleanTargetBodyOptions(
    bodies,
    features,
    "cut",
    preferredBodyId
  );
}

function createBooleanTargetBodyOptions(
  bodies: readonly CadBodySnapshot[],
  features: readonly CadFeatureSummary[],
  operationMode: "add" | "cut",
  preferredBodyId?: string
): readonly BooleanTargetBodyOption[] {
  const options = bodies
    .filter(
      (body) =>
        body.source.type === "sketchExtrudeFeature" &&
        body.consumedByFeatureId === undefined
    )
    .flatMap((body) => {
      const feature = features.find(
        (
          candidate
        ): candidate is Extract<CadFeatureSummary, { kind: "extrude" }> =>
          candidate.kind === "extrude" && candidate.id === body.featureId
      );

      if (
        !feature ||
        feature.operationMode !== "newBody" ||
        !isSupportedTargetProfileKind(operationMode, feature.profileKind)
      ) {
        return [];
      }

      return [
        {
          bodyId: body.id,
          featureId: feature.id,
          profileKind: feature.profileKind,
          label: `${body.name ?? body.id} / ${feature.id}`,
          detail: `${formatProfileKind(feature.profileKind)} new body / ${feature.depth} / ${feature.side}`
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

export function getAddOperationStatus(
  entity: SketchEntitySnapshot | undefined,
  addTargets: readonly BooleanTargetBodyOption[]
): BooleanOperationStatus {
  if (!entity) {
    return {
      available: false,
      message: "Select a rectangle profile to add to an existing body."
    };
  }

  if (entity.kind !== "rectangle") {
    return {
      available: false,
      message:
        "Add currently supports rectangle profiles and rectangle targets only. This profile can still create a new body."
    };
  }

  if (addTargets.length === 0) {
    return {
      available: false,
      message: "Create an active rectangle new body before using Add to body."
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
      message: "Select a rectangle profile to cut an existing body."
    };
  }

  if (entity.kind !== "rectangle") {
    return {
      available: false,
      message:
        "Cut currently supports rectangle profiles only. This profile can still create a new body."
    };
  }

  if (cutTargets.length === 0) {
    return {
      available: false,
      message:
        "Create an active rectangle or circle new body before using Cut body."
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

function isSupportedCutTargetProfileKind(
  profileKind: Extract<CadFeatureSummary, { kind: "extrude" }>["profileKind"]
): boolean {
  return profileKind === "rectangle" || profileKind === "circle";
}

function isSupportedAddTargetProfileKind(
  profileKind: Extract<CadFeatureSummary, { kind: "extrude" }>["profileKind"]
): boolean {
  return profileKind === "rectangle";
}

function isSupportedTargetProfileKind(
  operationMode: "add" | "cut",
  profileKind: Extract<CadFeatureSummary, { kind: "extrude" }>["profileKind"]
): boolean {
  return operationMode === "add"
    ? isSupportedAddTargetProfileKind(profileKind)
    : isSupportedCutTargetProfileKind(profileKind);
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
