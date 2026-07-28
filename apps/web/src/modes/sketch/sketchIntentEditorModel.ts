import type {
  CadParameterSnapshot,
  SketchConstraintEntry,
  SketchConstraintKind,
  SketchConstraintUpdateOpV19,
  SketchCurveConstraintTarget,
  SketchDimensionEntryCurrent,
  SketchDimensionTargetV22,
  SketchEntitySnapshot,
  SketchPointTarget,
  SketchPointTargetV22,
  SketchRadiusCurveTarget
} from "@web-cad/cad-protocol";
import { CAD_V19_SKETCH_GEOMETRY_POLICY } from "@web-cad/cad-protocol";
import {
  getSketchConstraintKindFeasibility,
  getSketchDimensionFamilyFeasibility
} from "../../sketchIntentAvailability";

export type SketchDimensionFamilyV19 =
  | "rectangleWidth"
  | "rectangleHeight"
  | "lineLength"
  | "radius"
  | "diameter"
  | "arcSweep"
  | "pointDistance"
  | "horizontalDistance"
  | "verticalDistance"
  | "pointLineDistance"
  | "lineAngle";

export type SketchConstraintDefinitionV19 =
  SketchConstraintUpdateOpV19["definition"];
export type SketchConstraintCreateKindV19 = Exclude<
  SketchConstraintKind,
  "angle"
>;

export interface SketchDimensionDraftV19 {
  readonly id: string;
  readonly name: string;
  readonly target: SketchDimensionTargetV22;
  readonly valueSourceType: "literal" | "parameter";
  readonly value: number;
  readonly parameterId: string;
}

export interface SketchConstraintDraftV19 {
  readonly id: string;
  readonly name: string;
  readonly definition: SketchConstraintDefinitionV19;
}

export interface SketchIntentOption<T> {
  readonly value: T;
  readonly label: string;
}

export interface SketchIntentDraftValidation {
  readonly valid: boolean;
  readonly message: string;
}

export type SketchIntentCreationAvailabilityV19 =
  | { readonly status: "ready" }
  | { readonly status: "needs-selection"; readonly message: string }
  | { readonly status: "blocked"; readonly message: string };

export const DIMENSION_FAMILY_OPTIONS_V19: readonly SketchIntentOption<SketchDimensionFamilyV19>[] =
  [
    { value: "rectangleWidth", label: "Rectangle width" },
    { value: "rectangleHeight", label: "Rectangle height" },
    { value: "lineLength", label: "Line length" },
    { value: "radius", label: "Radius" },
    { value: "diameter", label: "Diameter" },
    { value: "arcSweep", label: "Arc sweep" },
    { value: "pointDistance", label: "Point distance" },
    { value: "horizontalDistance", label: "Horizontal distance" },
    { value: "verticalDistance", label: "Vertical distance" },
    { value: "pointLineDistance", label: "Point to line" },
    { value: "lineAngle", label: "Line angle" }
  ];

export const CONSTRAINT_KIND_OPTIONS_V19: readonly SketchIntentOption<SketchConstraintCreateKindV19>[] =
  [
    { value: "horizontal", label: "Horizontal" },
    { value: "vertical", label: "Vertical" },
    { value: "fixed", label: "Fixed point" },
    { value: "coincident", label: "Coincident" },
    { value: "midpoint", label: "Midpoint" },
    { value: "parallel", label: "Parallel" },
    { value: "perpendicular", label: "Perpendicular" },
    { value: "tangent", label: "Tangent" },
    { value: "concentric", label: "Concentric" },
    { value: "equalLength", label: "Equal length" },
    { value: "equalRadius", label: "Equal radius" },
    { value: "symmetry", label: "Symmetry" }
  ];

export function createPointTargetOptionsV19(
  entities: readonly SketchEntitySnapshot[]
): readonly SketchIntentOption<SketchPointTargetV22>[] {
  const options: SketchIntentOption<SketchPointTargetV22>[] = [];
  for (const entity of entities) {
    if (entity.kind === "point") {
      options.push(
        option(
          { entityId: entity.id, entityKind: "point", role: "position" },
          `${entityLabelV19(entity, entities)} · position`
        )
      );
      continue;
    }
    if (entity.kind === "line") {
      options.push(
        option(
          { entityId: entity.id, entityKind: "line", role: "start" },
          `${entityLabelV19(entity, entities)} · start`
        ),
        option(
          { entityId: entity.id, entityKind: "line", role: "end" },
          `${entityLabelV19(entity, entities)} · end`
        )
      );
      continue;
    }
    if (entity.kind === "rectangle" || entity.kind === "circle") {
      options.push(
        option(
          { entityId: entity.id, entityKind: entity.kind, role: "center" },
          `${entityLabelV19(entity, entities)} · center`
        )
      );
      continue;
    }
    options.push(
      option(
        { entityId: entity.id, entityKind: "arc", role: "center" },
        `${entityLabelV19(entity, entities)} · center`
      ),
      option(
        { entityId: entity.id, entityKind: "arc", role: "start" },
        `${entityLabelV19(entity, entities)} · start`
      ),
      option(
        { entityId: entity.id, entityKind: "arc", role: "end" },
        `${entityLabelV19(entity, entities)} · end`
      )
    );
  }
  return options;
}

export function createMidpointTargetOptionsV19(
  entities: readonly SketchEntitySnapshot[]
): readonly SketchIntentOption<SketchPointTargetV22>[] {
  return createPointTargetOptionsV19(entities).filter(
    ({ value }) =>
      value.entityKind === "point" ||
      value.entityKind === "rectangle" ||
      value.entityKind === "circle"
  );
}

export function createLineTargetOptionsV19(
  entities: readonly SketchEntitySnapshot[]
): readonly SketchIntentOption<string>[] {
  return entities
    .filter(
      (
        entity
      ): entity is Extract<SketchEntitySnapshot, { readonly kind: "line" }> =>
        entity.kind === "line"
    )
    .map((entity) => option(entity.id, entityLabelV19(entity, entities)));
}

export function createCurveTargetOptionsV19(
  entities: readonly SketchEntitySnapshot[]
): readonly SketchIntentOption<SketchCurveConstraintTarget>[] {
  return entities
    .filter(
      (
        entity
      ): entity is Extract<
        SketchEntitySnapshot,
        { readonly kind: "line" | "circle" | "arc" }
      > =>
        entity.kind === "line" ||
        entity.kind === "circle" ||
        entity.kind === "arc"
    )
    .map((entity) =>
      option(
        { entityId: entity.id, entityKind: entity.kind },
        entityLabelV19(entity, entities)
      )
    );
}

export function createRadiusTargetOptionsV19(
  entities: readonly SketchEntitySnapshot[]
): readonly SketchIntentOption<SketchRadiusCurveTarget>[] {
  return entities
    .filter(
      (
        entity
      ): entity is Extract<
        SketchEntitySnapshot,
        { readonly kind: "circle" | "arc" }
      > => entity.kind === "circle" || entity.kind === "arc"
    )
    .map((entity) =>
      option(
        { entityId: entity.id, entityKind: entity.kind },
        entityLabelV19(entity, entities)
      )
    );
}

export function createAvailableDimensionFamilyOptionsV19(
  entities: readonly SketchEntitySnapshot[],
  dimensions: readonly SketchDimensionEntryCurrent[] = [],
  editedDimensionId?: string
): readonly SketchIntentOption<SketchDimensionFamilyV19>[] {
  return DIMENSION_FAMILY_OPTIONS_V19.filter(({ value }) => {
    if (!getSketchDimensionFamilyFeasibility(value, entities).available)
      return false;
    return createDimensionTargetCandidatesV19(value, entities).some(
      (target) =>
        !dimensions.some(
          (dimension) =>
            dimension.id !== editedDimensionId &&
            dimensionTargetKeyV19(
              dimensionEntryToDraftV19(dimension).target
            ) === dimensionTargetKeyV19(target)
        )
    );
  });
}

export function createDefaultDimensionDraftV19(
  entities: readonly SketchEntitySnapshot[],
  preferredEntityId?: string,
  preferredFamily?: SketchDimensionFamilyV19,
  dimensions: readonly SketchDimensionEntryCurrent[] = []
): SketchDimensionDraftV19 | undefined {
  const families = createAvailableDimensionFamilyOptionsV19(
    entities,
    dimensions
  );
  const family = preferredFamily
    ? families.find(({ value }) => value === preferredFamily)?.value
    : families[0]?.value;
  if (!family) return undefined;
  const target = createDimensionTargetCandidatesV19(
    family,
    entities,
    preferredEntityId
  ).find(
    (candidate) =>
      !dimensions.some(
        (dimension) =>
          dimensionTargetKeyV19(dimensionEntryToDraftV19(dimension).target) ===
          dimensionTargetKeyV19(candidate)
      )
  );
  if (!target) return undefined;
  return {
    id: "",
    name: defaultDimensionNameV19(family),
    target,
    valueSourceType: "literal",
    value: measureDimensionTargetV19(target, entities),
    parameterId: ""
  };
}

export function getDimensionCreationAvailabilityV19(
  family: SketchDimensionFamilyV19,
  entities: readonly SketchEntitySnapshot[],
  preferredEntityId: string | undefined,
  dimensions: readonly SketchDimensionEntryCurrent[]
): SketchIntentCreationAvailabilityV19 {
  const feasibility = getSketchDimensionFamilyFeasibility(family, entities);
  if (!feasibility.available)
    return { status: "needs-selection", message: feasibility.message };
  if (dimensions.length === 0) return { status: "ready" };
  return createDefaultDimensionDraftV19(
    entities,
    preferredEntityId,
    family,
    dimensions
  )
    ? { status: "ready" }
    : {
        status: "blocked",
        message:
          "Every eligible target already has this driving dimension. Edit an existing dimension or add different geometry."
      };
}

function defaultDimensionNameV19(family: SketchDimensionFamilyV19): string {
  switch (family) {
    case "rectangleWidth":
      return "Width";
    case "rectangleHeight":
      return "Height";
    case "lineLength":
      return "Length";
    case "arcSweep":
      return "Sweep";
    default:
      return dimensionFamilyLabelV19(family);
  }
}

export function createDefaultDimensionTargetV19(
  family: SketchDimensionFamilyV19,
  entities: readonly SketchEntitySnapshot[],
  preferredEntityId?: string
): SketchDimensionTargetV22 | undefined {
  return createDimensionTargetCandidatesV19(
    family,
    entities,
    preferredEntityId
  )[0];
}

export function createDimensionTargetCandidatesV19(
  family: SketchDimensionFamilyV19,
  entities: readonly SketchEntitySnapshot[],
  preferredEntityId?: string
): readonly SketchDimensionTargetV22[] {
  const preferred = [
    ...entities.filter((entity) => entity.id === preferredEntityId),
    ...entities.filter((entity) => entity.id !== preferredEntityId)
  ];
  const points = createPointTargetOptionsV19(preferred);
  const lines = createLineTargetOptionsV19(preferred);
  const targets: SketchDimensionTargetV22[] = [];
  const keys = new Set<string>();
  const add = (target: SketchDimensionTargetV22) => {
    const measured = measureDimensionTargetV19(target, preferred);
    const key = dimensionTargetKeyV19(target);
    if (
      !keys.has(key) &&
      validateDimensionValueDomainV19(target, measured) === undefined
    ) {
      keys.add(key);
      targets.push(target);
    }
  };
  for (const target of createScalarTargets(family, preferred)) add(target);
  if (targets.length > 0) return targets;
  if (
    family === "pointDistance" ||
    family === "horizontalDistance" ||
    family === "verticalDistance"
  ) {
    for (const { value: primary } of points) {
      for (const { value: secondary } of points) {
        if (pointTargetKeyV19(primary) === pointTargetKeyV19(secondary))
          continue;
        const first = pointCoordinate(primary, preferred);
        const second = pointCoordinate(secondary, preferred);
        const dx = second[0] - first[0];
        const dy = second[1] - first[1];
        if (
          family === "pointDistance" &&
          Math.hypot(dx, dy) > CAD_V19_SKETCH_GEOMETRY_POLICY.linearTolerance
        )
          add({
            kind: "pointPair",
            primary,
            secondary,
            measurement: "distance"
          });
        const component = family === "horizontalDistance" ? dx : dy;
        if (
          family !== "pointDistance" &&
          Math.abs(component) > CAD_V19_SKETCH_GEOMETRY_POLICY.linearTolerance
        )
          add({
            kind: "pointPair",
            primary,
            secondary,
            measurement:
              family === "horizontalDistance" ? "horizontal" : "vertical",
            direction: component > 0 ? "positive" : "negative"
          });
      }
    }
    return targets;
  }
  if (family === "pointLineDistance") {
    for (const { value: lineEntityId } of lines) {
      const line = preferred.find(
        (
          entity
        ): entity is Extract<SketchEntitySnapshot, { readonly kind: "line" }> =>
          entity.id === lineEntityId && entity.kind === "line"
      );
      if (
        !line ||
        lineLength(line) <= CAD_V19_SKETCH_GEOMETRY_POLICY.linearTolerance
      )
        continue;
      for (const { value: point } of points) {
        if (point.entityKind === "line" && point.entityId === lineEntityId)
          continue;
        const coordinate = pointCoordinate(point, preferred);
        const signed =
          ((line.end[0] - line.start[0]) * (coordinate[1] - line.start[1]) -
            (line.end[1] - line.start[1]) * (coordinate[0] - line.start[0])) /
          lineLength(line);
        if (Math.abs(signed) > CAD_V19_SKETCH_GEOMETRY_POLICY.linearTolerance)
          add({
            kind: "pointLineDistance",
            point,
            lineEntityId,
            side: signed > 0 ? "left" : "right"
          });
      }
    }
    return targets;
  }
  if (family === "lineAngle") {
    for (const { value: primaryLineEntityId } of lines) {
      for (const { value: secondaryLineEntityId } of lines) {
        if (primaryLineEntityId === secondaryLineEntityId) continue;
        const provisional: SketchDimensionTargetV22 = {
          kind: "lineAngle",
          primaryLineEntityId,
          secondaryLineEntityId,
          sense: "counterclockwise"
        };
        const signed = measureDimensionTargetV19(provisional, preferred);
        const angular = CAD_V19_SKETCH_GEOMETRY_POLICY.angularToleranceDegrees;
        if (signed > angular && signed < 180 - angular) add(provisional);
        if (-signed > angular && -signed < 180 - angular)
          add({ ...provisional, sense: "clockwise" });
      }
    }
    return targets;
  }
  return targets;
}

export function dimensionTargetToFamilyV19(
  target: SketchDimensionTargetV22
): SketchDimensionFamilyV19 {
  if (target.kind === "entityScalar") {
    if (target.entityKind === "rectangle")
      return target.role === "width" ? "rectangleWidth" : "rectangleHeight";
    if (target.entityKind === "line") return "lineLength";
    if (target.role === "sweep") return "arcSweep";
    return target.role;
  }
  if (target.kind === "pointPair") {
    return target.measurement === "distance"
      ? "pointDistance"
      : target.measurement === "horizontal"
        ? "horizontalDistance"
        : "verticalDistance";
  }
  return target.kind;
}

export function dimensionEntryToDraftV19(
  dimension: SketchDimensionEntryCurrent
): SketchDimensionDraftV19 {
  const target: SketchDimensionTargetV22 =
    "sourceShape" in dimension
      ? dimension.target
      : normalizeLegacyDimensionTargetV19(dimension.entityId, dimension.target);
  const value =
    dimension.valueSource.type === "literal"
      ? dimension.valueSource.value
      : (dimension.effectiveValue ?? 1);
  return {
    id: "",
    name: dimension.name,
    target,
    valueSourceType: dimension.valueSource.type,
    value:
      target.kind === "entityScalar" && target.role === "sweep"
        ? Math.abs(value)
        : value,
    parameterId:
      dimension.valueSource.type === "parameter"
        ? dimension.valueSource.parameterId
        : ""
  };
}

function normalizeLegacyDimensionTargetV19(
  entityId: string,
  target: import("@web-cad/cad-protocol").SketchDimensionTarget
): SketchDimensionTargetV22 {
  switch (target.entityKind) {
    case "rectangle":
      return {
        kind: "entityScalar",
        entityId,
        entityKind: "rectangle",
        role: target.role
      };
    case "line":
      return {
        kind: "entityScalar",
        entityId,
        entityKind: "line",
        role: "length"
      };
    case "circle":
      return {
        kind: "entityScalar",
        entityId,
        entityKind: "circle",
        role: "radius"
      };
    case "arc":
      return {
        kind: "entityScalar",
        entityId,
        entityKind: "arc",
        role: target.role
      };
  }
}

export function validateDimensionDraftV19(
  draft: SketchDimensionDraftV19,
  entities: readonly SketchEntitySnapshot[],
  parameters: readonly CadParameterSnapshot[],
  dimensions: readonly SketchDimensionEntryCurrent[] = [],
  editedDimensionId?: string
): SketchIntentDraftValidation {
  if (draft.name.trim().length === 0) return invalid("Enter a dimension name.");
  if (
    draft.target.kind === "lineAngle" &&
    draft.valueSourceType === "parameter"
  )
    return invalid("Line angle dimensions require a literal value.");
  const effectiveValue =
    draft.valueSourceType === "literal"
      ? draft.value
      : parameters.find((parameter) => parameter.id === draft.parameterId)
          ?.value;
  if (draft.valueSourceType === "parameter" && effectiveValue === undefined)
    return invalid("Choose an available parameter.");
  const valueDomain = validateDimensionValueDomainV19(
    draft.target,
    effectiveValue
  );
  if (valueDomain) return invalid(valueDomain);
  const entityById = new Map(entities.map((entity) => [entity.id, entity]));
  for (const id of dimensionTargetEntityIdsV19(draft.target)) {
    if (!entityById.has(id))
      return invalid("Choose targets that still exist in this sketch.");
  }
  const pointTargets =
    draft.target.kind === "pointPair"
      ? [draft.target.primary, draft.target.secondary]
      : draft.target.kind === "pointLineDistance"
        ? [draft.target.point]
        : [];
  for (const point of pointTargets) {
    const entity = entityById.get(point.entityId);
    if (entity?.kind !== point.entityKind)
      return invalid(
        "Choose a point target that matches the selected geometry."
      );
    if (entity.kind === "line" && lineLength(entity) <= 1e-7)
      return invalid("Choose a point on a line with a defined direction.");
  }
  if (draft.target.kind === "entityScalar") {
    const entity = entityById.get(draft.target.entityId);
    if (entity?.kind !== draft.target.entityKind)
      return invalid("Choose a target that matches the measurement kind.");
    if (entity.kind === "line" && lineLength(entity) <= 1e-7)
      return invalid("Choose a line with a defined length.");
  }
  if (draft.target.kind === "pointLineDistance") {
    const line = entityById.get(draft.target.lineEntityId);
    if (line?.kind !== "line" || lineLength(line) <= 1e-7)
      return invalid("Choose a support line with a defined direction.");
  }
  if (draft.target.kind === "lineAngle") {
    const primary = entityById.get(draft.target.primaryLineEntityId);
    const secondary = entityById.get(draft.target.secondaryLineEntityId);
    if (
      primary?.kind !== "line" ||
      secondary?.kind !== "line" ||
      lineLength(primary) <= 1e-7 ||
      lineLength(secondary) <= 1e-7
    )
      return invalid("Choose two lines with defined directions.");
  }
  if (
    draft.target.kind === "pointPair" &&
    pointTargetKeyV19(draft.target.primary) ===
      pointTargetKeyV19(draft.target.secondary)
  )
    return invalid("Choose two different points.");
  if (
    draft.target.kind === "pointLineDistance" &&
    draft.target.point.entityKind === "line" &&
    draft.target.point.entityId === draft.target.lineEntityId
  )
    return invalid("Choose a point that is not on its measured line.");
  if (
    draft.target.kind === "lineAngle" &&
    draft.target.primaryLineEntityId === draft.target.secondaryLineEntityId
  )
    return invalid("Choose two different lines.");
  if (draft.target.kind === "lineAngle") {
    const measured = measureDimensionTargetV19(draft.target, entities);
    const angular = CAD_V19_SKETCH_GEOMETRY_POLICY.angularToleranceDegrees;
    if (!(measured > angular && measured < 180 - angular))
      return invalid(
        "Choose the clockwise or counterclockwise sense that matches the current angle branch."
      );
  }
  if (
    dimensions.some(
      (dimension) =>
        dimension.id !== editedDimensionId &&
        dimensionTargetKeyV19(dimensionEntryToDraftV19(dimension).target) ===
          dimensionTargetKeyV19(draft.target)
    )
  )
    return invalid(
      "This measurement already has a driving dimension. Edit the existing dimension or choose different targets."
    );
  return { valid: true, message: "Ready to apply." };
}

export function createAvailableConstraintKindOptionsV19(
  entities: readonly SketchEntitySnapshot[],
  constraints: readonly SketchConstraintEntry[] = [],
  editedConstraintId?: string
): readonly SketchIntentOption<SketchConstraintCreateKindV19>[] {
  return CONSTRAINT_KIND_OPTIONS_V19.filter(({ value }) => {
    if (!getSketchConstraintKindFeasibility(value, entities).available)
      return false;
    return createConstraintDefinitionCandidatesV19(value, entities).some(
      (definition) =>
        !constraints.some(
          (constraint) =>
            constraint.id !== editedConstraintId &&
            constraintConflictKeyV19(
              constraintEntryToDraftV19(constraint, entities).definition
            ) === constraintConflictKeyV19(definition)
        )
    );
  });
}

export function createDefaultConstraintDraftV19(
  entities: readonly SketchEntitySnapshot[],
  preferredEntityId?: string,
  preferredKind?: SketchConstraintCreateKindV19,
  constraints: readonly SketchConstraintEntry[] = []
): SketchConstraintDraftV19 | undefined {
  const options = createAvailableConstraintKindOptionsV19(
    entities,
    constraints
  );
  const kind = preferredKind
    ? options.find(({ value }) => value === preferredKind)?.value
    : options[0]?.value;
  if (!kind) return undefined;
  const definition = createConstraintDefinitionCandidatesV19(
    kind,
    entities,
    preferredEntityId
  ).find(
    (candidate) =>
      !constraints.some(
        (constraint) =>
          constraintConflictKeyV19(
            constraintEntryToDraftV19(constraint, entities).definition
          ) === constraintConflictKeyV19(candidate)
      )
  );
  return definition
    ? { id: "", name: constraintKindLabelV19(kind), definition }
    : undefined;
}

export function getConstraintCreationAvailabilityV19(
  kind: SketchConstraintCreateKindV19,
  entities: readonly SketchEntitySnapshot[],
  preferredEntityId: string | undefined,
  constraints: readonly SketchConstraintEntry[]
): SketchIntentCreationAvailabilityV19 {
  const feasibility = getSketchConstraintKindFeasibility(kind, entities);
  if (!feasibility.available)
    return { status: "needs-selection", message: feasibility.message };
  if (constraints.length === 0) return { status: "ready" };
  return createDefaultConstraintDraftV19(
    entities,
    preferredEntityId,
    kind,
    constraints
  )
    ? { status: "ready" }
    : {
        status: "blocked",
        message:
          "Every eligible target already has this constraint or a conflicting relation. Edit existing intent or add different geometry."
      };
}

export function createDefaultConstraintDefinitionV19(
  kind: SketchConstraintCreateKindV19,
  entities: readonly SketchEntitySnapshot[],
  preferredEntityId?: string
): SketchConstraintDefinitionV19 | undefined {
  return createConstraintDefinitionCandidatesV19(
    kind,
    entities,
    preferredEntityId
  )[0];
}

export function createConstraintDefinitionCandidatesV19(
  kind: SketchConstraintCreateKindV19,
  entities: readonly SketchEntitySnapshot[],
  preferredEntityId?: string
): readonly SketchConstraintDefinitionV19[] {
  const preferred = [
    ...entities.filter((entity) => entity.id === preferredEntityId),
    ...entities.filter((entity) => entity.id !== preferredEntityId)
  ];
  const lines = createLineTargetOptionsV19(preferred).filter(({ value }) => {
    const line = preferred.find(
      (
        entity
      ): entity is Extract<SketchEntitySnapshot, { readonly kind: "line" }> =>
        entity.id === value && entity.kind === "line"
    );
    return (
      line !== undefined &&
      lineLength(line) > CAD_V19_SKETCH_GEOMETRY_POLICY.linearTolerance
    );
  });
  const points = createPointTargetOptionsV19(preferred);
  const midpointPoints = createMidpointTargetOptionsV19(preferred);
  const curves = createCurveTargetOptionsV19(preferred);
  const radiusCurves = createRadiusTargetOptionsV19(preferred);
  const definitions: SketchConstraintDefinitionV19[] = [];
  const keys = new Set<string>();
  const add = (definition: SketchConstraintDefinitionV19) => {
    const key = constraintConflictKeyV19(definition);
    if (!keys.has(key)) {
      keys.add(key);
      definitions.push(definition);
    }
  };
  switch (kind) {
    case "horizontal":
    case "vertical":
      for (const { value: entityId } of lines) add({ kind, entityId });
      break;
    case "fixed":
      for (const { value: target } of points)
        add({ kind, target, coordinate: pointCoordinate(target, preferred) });
      break;
    case "coincident":
      for (let primary = 0; primary < points.length; primary += 1)
        for (
          let secondary = primary + 1;
          secondary < points.length;
          secondary += 1
        )
          add({
            kind,
            primaryTarget: points[primary]!.value,
            secondaryTarget: points[secondary]!.value
          });
      break;
    case "midpoint": {
      for (const { value: lineEntityId } of lines)
        for (const { value: target } of midpointPoints)
          add({
            kind,
            lineEntityId,
            target: target as Extract<
              SketchPointTargetV22,
              { readonly entityKind: "point" | "rectangle" | "circle" }
            >
          });
      break;
    }
    case "parallel":
    case "perpendicular":
    case "equalLength": {
      for (let primary = 0; primary < lines.length; primary += 1)
        for (
          let secondary = primary + 1;
          secondary < lines.length;
          secondary += 1
        )
          add({
            kind,
            primaryLineEntityId: lines[primary]!.value,
            secondaryLineEntityId: lines[secondary]!.value
          });
      break;
    }
    case "tangent": {
      for (let primary = 0; primary < curves.length; primary += 1)
        for (
          let secondary = primary + 1;
          secondary < curves.length;
          secondary += 1
        ) {
          const primaryTarget = curves[primary]!.value;
          const secondaryTarget = curves[secondary]!.value;
          if (
            tangentKindsSupported(
              primaryTarget.entityKind,
              secondaryTarget.entityKind
            )
          )
            add({
              kind,
              primaryTarget,
              secondaryTarget
            } as SketchConstraintDefinitionV19);
        }
      break;
    }
    case "concentric":
    case "equalRadius": {
      for (let primary = 0; primary < radiusCurves.length; primary += 1)
        for (
          let secondary = primary + 1;
          secondary < radiusCurves.length;
          secondary += 1
        )
          add({
            kind,
            primaryTarget: radiusCurves[primary]!.value,
            secondaryTarget: radiusCurves[secondary]!.value
          });
      break;
    }
    case "symmetry": {
      for (let primary = 0; primary < points.length; primary += 1)
        for (
          let secondary = primary + 1;
          secondary < points.length;
          secondary += 1
        )
          for (const { value: symmetryLineEntityId } of lines)
            add({
              kind,
              primaryTarget: points[primary]!.value,
              secondaryTarget: points[secondary]!.value,
              symmetryLineEntityId
            });
      break;
    }
  }
  return definitions;
}

export function constraintEntryToDraftV19(
  constraint: SketchConstraintEntry,
  entities: readonly SketchEntitySnapshot[]
): SketchConstraintDraftV19 {
  const normalizePoint = (target: SketchPointTarget): SketchPointTargetV22 => {
    if ("entityKind" in target && target.entityKind === "arc") return target;
    const entity = entities.find(
      (candidate) => candidate.id === target.entityId
    );
    if (!entity) {
      return {
        entityId: target.entityId,
        entityKind: "point",
        role: "position"
      };
    }
    return {
      entityId: target.entityId,
      entityKind: entity.kind,
      role: target.role
    } as SketchPointTargetV22;
  };
  let definition: SketchConstraintDefinitionV19;
  switch (constraint.kind) {
    case "horizontal":
    case "vertical":
      definition = { kind: constraint.kind, entityId: constraint.entityId };
      break;
    case "fixed":
      definition = {
        kind: "fixed",
        target: normalizePoint(constraint.target),
        coordinate: constraint.coordinate
      };
      break;
    case "coincident":
      definition = {
        kind: "coincident",
        primaryTarget: normalizePoint(constraint.primaryTarget),
        secondaryTarget: normalizePoint(constraint.secondaryTarget)
      };
      break;
    case "midpoint":
      definition = {
        kind: "midpoint",
        lineEntityId: constraint.lineEntityId,
        target: normalizePoint(constraint.target) as Extract<
          SketchPointTargetV22,
          { readonly entityKind: "point" | "rectangle" | "circle" }
        >
      };
      break;
    case "parallel":
    case "perpendicular":
    case "equalLength":
      definition = {
        kind: constraint.kind,
        primaryLineEntityId: constraint.primaryLineEntityId,
        secondaryLineEntityId: constraint.secondaryLineEntityId
      };
      break;
    case "tangent":
      definition = {
        kind: "tangent",
        primaryTarget: constraint.primaryTarget,
        secondaryTarget: constraint.secondaryTarget
      } as SketchConstraintDefinitionV19;
      break;
    case "concentric":
    case "equalRadius":
      definition = {
        kind: constraint.kind,
        primaryTarget: constraint.primaryTarget,
        secondaryTarget: constraint.secondaryTarget
      };
      break;
    case "symmetry":
      definition = {
        kind: "symmetry",
        primaryTarget: normalizePoint(constraint.primaryTarget),
        secondaryTarget: normalizePoint(constraint.secondaryTarget),
        symmetryLineEntityId: constraint.symmetryLineEntityId
      };
      break;
    case "angle":
      definition = {
        kind: "angle",
        primaryLineEntityId: constraint.primaryLineEntityId,
        secondaryLineEntityId: constraint.secondaryLineEntityId,
        angleDegrees: constraint.angleDegrees
      };
      break;
  }
  return { id: "", name: constraint.name, definition };
}

export function validateConstraintDraftV19(
  draft: SketchConstraintDraftV19,
  entities: readonly SketchEntitySnapshot[],
  constraints: readonly SketchConstraintEntry[] = [],
  editedConstraintId?: string
): SketchIntentDraftValidation {
  if (draft.name.trim().length === 0)
    return invalid("Enter a constraint name.");
  const definition = draft.definition;
  const entityById = new Map(entities.map((entity) => [entity.id, entity]));
  const entityIds = constraintDefinitionEntityIdsV19(definition);
  if (entityIds.some((id) => !entities.some((entity) => entity.id === id)))
    return invalid("Choose targets that still exist in this sketch.");
  if (
    ("primaryLineEntityId" in definition &&
      definition.primaryLineEntityId === definition.secondaryLineEntityId) ||
    ("primaryTarget" in definition &&
      "secondaryTarget" in definition &&
      targetEntityKey(definition.primaryTarget) ===
        targetEntityKey(definition.secondaryTarget))
  )
    return invalid("Choose two different targets.");
  for (const entityId of constraintDefinitionLineIds(definition)) {
    const line = entityById.get(entityId);
    if (line?.kind !== "line" || lineLength(line) <= 1e-7)
      return invalid("Choose line targets with defined directions.");
  }
  if (
    definition.kind === "tangent" &&
    !tangentKindsSupported(
      definition.primaryTarget.entityKind,
      definition.secondaryTarget.entityKind
    )
  )
    return invalid(
      "Choose a supported line-circle, line-arc, circle-arc, or arc-arc pair."
    );
  if (
    definition.kind === "angle" &&
    (!Number.isFinite(definition.angleDegrees) ||
      definition.angleDegrees <= 0 ||
      definition.angleDegrees >= 180)
  )
    return invalid("Enter an angle strictly between 0° and 180°.");
  const conflict = constraints.find((constraint) => {
    if (constraint.id === editedConstraintId) return false;
    return (
      constraintConflictKeyV19(
        constraintEntryToDraftV19(constraint, entities).definition
      ) === constraintConflictKeyV19(definition)
    );
  });
  if (conflict)
    return invalid(
      conflict.kind === definition.kind
        ? "These targets already have this constraint. Edit the existing constraint or choose different targets."
        : "These targets already have a conflicting constraint. Edit the existing constraint or choose different targets."
    );
  return { valid: true, message: "Ready to apply." };
}

export function dimensionTargetEntityIdsV19(
  target: SketchDimensionTargetV22
): readonly string[] {
  switch (target.kind) {
    case "entityScalar":
      return [target.entityId];
    case "pointPair":
      return [target.primary.entityId, target.secondary.entityId];
    case "pointLineDistance":
      return [target.point.entityId, target.lineEntityId];
    case "lineAngle":
      return [target.primaryLineEntityId, target.secondaryLineEntityId];
  }
}

export function constraintDefinitionEntityIdsV19(
  definition: SketchConstraintDefinitionV19
): readonly string[] {
  switch (definition.kind) {
    case "horizontal":
    case "vertical":
      return [definition.entityId];
    case "fixed":
      return [definition.target.entityId];
    case "coincident":
      return [
        definition.primaryTarget.entityId,
        definition.secondaryTarget.entityId
      ];
    case "midpoint":
      return [definition.lineEntityId, definition.target.entityId];
    case "parallel":
    case "perpendicular":
    case "equalLength":
    case "angle":
      return [definition.primaryLineEntityId, definition.secondaryLineEntityId];
    case "tangent":
    case "concentric":
    case "equalRadius":
      return [
        definition.primaryTarget.entityId,
        definition.secondaryTarget.entityId
      ];
    case "symmetry":
      return [
        definition.primaryTarget.entityId,
        definition.secondaryTarget.entityId,
        definition.symmetryLineEntityId
      ];
  }
}

export function dimensionFamilyLabelV19(
  family: SketchDimensionFamilyV19
): string {
  return (
    DIMENSION_FAMILY_OPTIONS_V19.find(({ value }) => value === family)?.label ??
    "Dimension"
  );
}

export function constraintKindLabelV19(kind: SketchConstraintKind): string {
  if (kind === "angle") return "Angle";
  return (
    CONSTRAINT_KIND_OPTIONS_V19.find(({ value }) => value === kind)?.label ??
    "Constraint"
  );
}

export function pointTargetKeyV19(
  target: SketchPointTargetV22 | undefined
): string {
  return target ? `${target.entityId}:${target.entityKind}:${target.role}` : "";
}

export function curveTargetKeyV19(
  target: SketchCurveConstraintTarget | SketchRadiusCurveTarget
): string {
  return `${target.entityId}:${target.entityKind}`;
}

export function dimensionTargetSummaryV19(
  target: SketchDimensionTargetV22,
  entities: readonly SketchEntitySnapshot[] = []
): string {
  const entityName = (id: string): string => {
    const entity = entities.find((candidate) => candidate.id === id);
    return entity ? entityLabelV19(entity, entities) : "Missing target";
  };
  const pointName = (point: SketchPointTargetV22): string =>
    `${entityName(point.entityId)} · ${point.role}`;
  switch (target.kind) {
    case "entityScalar":
      return `${entityName(target.entityId)} · ${target.role}`;
    case "pointPair":
      return `${pointName(target.primary)} to ${pointName(
        target.secondary
      )} · ${target.measurement}${
        target.measurement === "distance" ? "" : ` · ${target.direction}`
      }`;
    case "pointLineDistance":
      return `${pointName(target.point)} to ${entityName(target.lineEntityId)} · ${
        target.side
      }`;
    case "lineAngle":
      return `${entityName(target.primaryLineEntityId)} to ${entityName(
        target.secondaryLineEntityId
      )} · ${target.sense}`;
  }
}

export function constraintDefinitionSummaryV19(
  definition: SketchConstraintDefinitionV19,
  entities: readonly SketchEntitySnapshot[]
): string {
  const entityName = (id: string): string => {
    const entity = entities.find((candidate) => candidate.id === id);
    return entity ? entityLabelV19(entity, entities) : "Missing target";
  };
  const pointName = (target: SketchPointTargetV22): string =>
    `${entityName(target.entityId)} · ${target.role}`;
  switch (definition.kind) {
    case "horizontal":
    case "vertical":
      return entityName(definition.entityId);
    case "fixed":
      return `${pointName(definition.target)} at ${definition.coordinate[0]}, ${definition.coordinate[1]}`;
    case "coincident":
      return `${pointName(definition.primaryTarget)} with ${pointName(definition.secondaryTarget)}`;
    case "midpoint":
      return `${pointName(definition.target)} on ${entityName(definition.lineEntityId)}`;
    case "parallel":
    case "perpendicular":
    case "equalLength":
    case "angle":
      return `${entityName(definition.primaryLineEntityId)} and ${entityName(definition.secondaryLineEntityId)}`;
    case "tangent":
    case "concentric":
    case "equalRadius":
      return `${entityName(definition.primaryTarget.entityId)} and ${entityName(definition.secondaryTarget.entityId)}`;
    case "symmetry":
      return `${pointName(definition.primaryTarget)} and ${pointName(definition.secondaryTarget)} about ${entityName(definition.symmetryLineEntityId)}`;
  }
}

export function dimensionTargetKeyV19(
  target: SketchDimensionTargetV22
): string {
  switch (target.kind) {
    case "entityScalar":
      return `scalar:${target.entityId}:${
        target.role === "diameter" ? "radius" : target.role
      }`;
    case "pointPair":
      return `points:${[
        pointTargetKeyV19(target.primary),
        pointTargetKeyV19(target.secondary)
      ]
        .sort()
        .join(":")}:${target.measurement}`;
    case "pointLineDistance":
      return `point-line:${pointTargetKeyV19(target.point)}:${
        target.lineEntityId
      }`;
    case "lineAngle":
      return `angle:${[target.primaryLineEntityId, target.secondaryLineEntityId]
        .sort()
        .join(":")}`;
  }
}

export function entityLabelV19(
  entity: SketchEntitySnapshot,
  entities: readonly SketchEntitySnapshot[]
): string {
  const ordinal =
    entities
      .filter((candidate) => candidate.kind === entity.kind)
      .indexOf(entity) + 1;
  const kind = `${entity.kind[0]?.toUpperCase() ?? ""}${entity.kind.slice(1)}`;
  return `${kind} ${Math.max(ordinal, 1)}`;
}

function createScalarTargets(
  family: SketchDimensionFamilyV19,
  entities: readonly SketchEntitySnapshot[]
): readonly SketchDimensionTargetV22[] {
  if (family === "rectangleWidth" || family === "rectangleHeight") {
    return entities
      .filter((entity) => entity.kind === "rectangle")
      .map((entity) => ({
        kind: "entityScalar",
        entityId: entity.id,
        entityKind: "rectangle" as const,
        role: family === "rectangleWidth" ? "width" : "height"
      }));
  }
  if (family === "lineLength") {
    return entities
      .filter(
        (
          entity
        ): entity is Extract<SketchEntitySnapshot, { readonly kind: "line" }> =>
          entity.kind === "line" &&
          lineLength(entity) > CAD_V19_SKETCH_GEOMETRY_POLICY.linearTolerance
      )
      .map((entity) => ({
        kind: "entityScalar",
        entityId: entity.id,
        entityKind: "line" as const,
        role: "length" as const
      }));
  }
  if (family === "radius" || family === "diameter") {
    return entities
      .filter(
        (
          entity
        ): entity is Extract<
          SketchEntitySnapshot,
          { readonly kind: "circle" | "arc" }
        > => entity.kind === "circle" || entity.kind === "arc"
      )
      .map((entity) => ({
        kind: "entityScalar",
        entityId: entity.id,
        entityKind: entity.kind,
        role: family
      }));
  }
  if (family === "arcSweep") {
    return entities
      .filter((entity) => entity.kind === "arc")
      .map((entity) => ({
        kind: "entityScalar",
        entityId: entity.id,
        entityKind: "arc" as const,
        role: "sweep" as const
      }));
  }
  return [];
}

export function measureDimensionTargetV19(
  target: SketchDimensionTargetV22,
  entities: readonly SketchEntitySnapshot[]
): number {
  if (target.kind === "pointPair") {
    const primary = pointCoordinate(target.primary, entities);
    const secondary = pointCoordinate(target.secondary, entities);
    const dx = secondary[0] - primary[0];
    const dy = secondary[1] - primary[1];
    if (target.measurement === "distance") return Math.hypot(dx, dy);
    const component = target.measurement === "horizontal" ? dx : dy;
    return target.direction === "positive" ? component : -component;
  }
  if (target.kind === "pointLineDistance") {
    const point = pointCoordinate(target.point, entities);
    const line = entities.find(
      (
        entity
      ): entity is Extract<SketchEntitySnapshot, { readonly kind: "line" }> =>
        entity.id === target.lineEntityId && entity.kind === "line"
    );
    if (!line) return Number.NaN;
    const length = lineLength(line);
    if (length <= CAD_V19_SKETCH_GEOMETRY_POLICY.linearTolerance)
      return Number.NaN;
    const signed =
      ((line.end[0] - line.start[0]) * (point[1] - line.start[1]) -
        (line.end[1] - line.start[1]) * (point[0] - line.start[0])) /
      length;
    return target.side === "left" ? signed : -signed;
  }
  if (target.kind === "lineAngle") {
    const primary = entities.find(
      (
        entity
      ): entity is Extract<SketchEntitySnapshot, { readonly kind: "line" }> =>
        entity.id === target.primaryLineEntityId && entity.kind === "line"
    );
    const secondary = entities.find(
      (
        entity
      ): entity is Extract<SketchEntitySnapshot, { readonly kind: "line" }> =>
        entity.id === target.secondaryLineEntityId && entity.kind === "line"
    );
    if (!primary || !secondary) return Number.NaN;
    const signed =
      (Math.atan2(
        (primary.end[0] - primary.start[0]) *
          (secondary.end[1] - secondary.start[1]) -
          (primary.end[1] - primary.start[1]) *
            (secondary.end[0] - secondary.start[0]),
        (primary.end[0] - primary.start[0]) *
          (secondary.end[0] - secondary.start[0]) +
          (primary.end[1] - primary.start[1]) *
            (secondary.end[1] - secondary.start[1])
      ) *
        180) /
      Math.PI;
    return target.sense === "counterclockwise" ? signed : -signed;
  }
  const entity = entities.find((candidate) => candidate.id === target.entityId);
  if (!entity) return Number.NaN;
  if (entity.kind === "rectangle")
    return target.role === "width" ? entity.width : entity.height;
  if (entity.kind === "line")
    return Math.hypot(
      entity.end[0] - entity.start[0],
      entity.end[1] - entity.start[1]
    );
  if (entity.kind === "circle")
    return target.role === "diameter" ? entity.radius * 2 : entity.radius;
  if (entity.kind !== "arc") return 1;
  if (target.role === "sweep") return Math.abs(entity.sweepAngleDegrees);
  return target.role === "diameter" ? entity.radius * 2 : entity.radius;
}

function validateDimensionValueDomainV19(
  target: SketchDimensionTargetV22,
  value: number | undefined
): string | undefined {
  if (!Number.isFinite(value)) return "Enter a finite value.";
  const linear = CAD_V19_SKETCH_GEOMETRY_POLICY.linearTolerance;
  const angular = CAD_V19_SKETCH_GEOMETRY_POLICY.angularToleranceDegrees;
  if (target.kind === "lineAngle")
    return value! > angular && value! < 180 - angular
      ? undefined
      : `Enter an angle strictly between ${angular}° and ${180 - angular}°.`;
  if (target.kind === "entityScalar" && target.role === "sweep") {
    return value! >= angular && value! <= 360 - angular
      ? undefined
      : `Enter a sweep magnitude between ${angular}° and ${360 - angular}°.`;
  }
  const minimum =
    target.kind === "entityScalar" && target.role === "diameter"
      ? 2 * linear
      : linear;
  return value! > minimum
    ? undefined
    : `Enter a value greater than ${minimum}.`;
}

function constraintConflictKeyV19(
  definition: SketchConstraintDefinitionV19
): string {
  const pair = (left: string, right: string) => [left, right].sort().join(":");
  switch (definition.kind) {
    case "horizontal":
    case "vertical":
      return `orientation:${definition.entityId}`;
    case "fixed":
      return `fixed:${pointTargetKeyV19(definition.target)}`;
    case "coincident":
      return `coincident:${pair(
        pointTargetKeyV19(definition.primaryTarget),
        pointTargetKeyV19(definition.secondaryTarget)
      )}`;
    case "midpoint":
      return `midpoint:${definition.lineEntityId}:${pointTargetKeyV19(
        definition.target
      )}`;
    case "parallel":
    case "perpendicular":
      return `line-relation:${pair(
        definition.primaryLineEntityId,
        definition.secondaryLineEntityId
      )}`;
    case "equalLength":
    case "angle":
      return `${definition.kind}:${pair(
        definition.primaryLineEntityId,
        definition.secondaryLineEntityId
      )}`;
    case "tangent":
    case "concentric":
    case "equalRadius":
      return `${definition.kind}:${pair(
        curveTargetKeyV19(definition.primaryTarget),
        curveTargetKeyV19(definition.secondaryTarget)
      )}`;
    case "symmetry":
      return `symmetry:${pair(
        pointTargetKeyV19(definition.primaryTarget),
        pointTargetKeyV19(definition.secondaryTarget)
      )}:${definition.symmetryLineEntityId}`;
  }
}

function pointCoordinate(
  target: SketchPointTargetV22,
  entities: readonly SketchEntitySnapshot[]
): readonly [number, number] {
  const entity = entities.find((candidate) => candidate.id === target.entityId);
  if (!entity) return [0, 0];
  if (entity.kind === "point") return entity.point;
  if (entity.kind === "line")
    return target.role === "end" ? entity.end : entity.start;
  if (entity.kind === "arc") {
    if (target.role === "center") return entity.center;
    const degrees =
      entity.startAngleDegrees +
      (target.role === "end" ? entity.sweepAngleDegrees : 0);
    const radians = (degrees * Math.PI) / 180;
    return [
      entity.center[0] + entity.radius * Math.cos(radians),
      entity.center[1] + entity.radius * Math.sin(radians)
    ];
  }
  return entity.center;
}

function constraintDefinitionLineIds(
  definition: SketchConstraintDefinitionV19
): readonly string[] {
  switch (definition.kind) {
    case "horizontal":
    case "vertical":
      return [definition.entityId];
    case "midpoint":
      return [definition.lineEntityId];
    case "parallel":
    case "perpendicular":
    case "equalLength":
    case "angle":
      return [definition.primaryLineEntityId, definition.secondaryLineEntityId];
    case "symmetry":
      return [definition.symmetryLineEntityId];
    default:
      return [];
  }
}

function lineLength(
  line: Extract<SketchEntitySnapshot, { readonly kind: "line" }>
): number {
  return Math.hypot(line.end[0] - line.start[0], line.end[1] - line.start[1]);
}

function tangentKindsSupported(
  primary: SketchCurveConstraintTarget["entityKind"],
  secondary: SketchCurveConstraintTarget["entityKind"]
): boolean {
  if (primary === secondary) return primary === "arc";
  return (
    primary === "line" ||
    secondary === "line" ||
    primary === "arc" ||
    secondary === "arc"
  );
}

function targetEntityKey(
  target:
    | SketchPointTargetV22
    | SketchCurveConstraintTarget
    | SketchRadiusCurveTarget
): string {
  return "role" in target
    ? pointTargetKeyV19(target)
    : curveTargetKeyV19(target);
}

function option<T>(value: T, label: string): SketchIntentOption<T> {
  return { value, label };
}

function invalid(message: string): SketchIntentDraftValidation {
  return { valid: false, message };
}
