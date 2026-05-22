import type {
  CadBodySnapshot,
  CadFeatureSummary,
  CadParameterSnapshot,
  SketchDimensionEntry,
  SketchDimensionTarget,
  SketchEntityId,
  SketchEntityKind,
  SketchId,
  SketchEntitySnapshot,
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

export function formatSketchDimensionStatus(
  dimension: SketchDimensionEntry
): string {
  if (dimension.status === "healthy") {
    return dimension.effectiveValue !== undefined
      ? `Healthy / ${dimension.effectiveValue}`
      : "Healthy";
  }

  return dimension.issues[0]?.message ?? dimension.status;
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
