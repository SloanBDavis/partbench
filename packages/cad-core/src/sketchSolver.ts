import type {
  CadQueryRequest,
  CadQueryResponse,
  ParameterId,
  SketchConstraintEntry,
  SketchConstraintId,
  SketchConstraintIssue,
  SketchConstraintKind,
  SketchConstraintSnapshot,
  SketchDimensionEntry,
  SketchDimensionId,
  SketchDimensionIssue,
  SketchDimensionSnapshot,
  SketchDimensionTarget,
  SketchEntityId,
  SketchEntitySnapshot,
  SketchId,
  SketchPlane,
  SketchPointTarget,
  Vec2
} from "@web-cad/cad-protocol";

export interface SketchSolverSketch {
  readonly id: SketchId;
  readonly name: string;
  readonly plane: SketchPlane;
  readonly entities: ReadonlyMap<SketchEntityId, SketchEntitySnapshot>;
}

export interface SketchSolverParameter {
  readonly id: ParameterId;
  readonly value: number;
}

export interface SketchSolverDocument {
  readonly sketches: ReadonlyMap<SketchId, SketchSolverSketch>;
  readonly parameters: ReadonlyMap<ParameterId, SketchSolverParameter>;
  readonly sketchDimensions: ReadonlyMap<
    SketchDimensionId,
    SketchDimensionSnapshot
  >;
  readonly sketchConstraints: ReadonlyMap<
    SketchConstraintId,
    SketchConstraintSnapshot
  >;
}

export type SketchSolverStatus = SketchDimensionEntry["status"];

export interface SketchSolverApplyIssue {
  readonly kind: "dimension" | "constraint";
  readonly code: "INVALID_SKETCH_DIMENSION" | "INVALID_SKETCH_CONSTRAINT";
  readonly message: string;
  readonly sketchId: SketchId;
  readonly sketchEntityId: SketchEntityId;
  readonly sketchDimensionId?: SketchDimensionId;
  readonly sketchConstraintId?: SketchConstraintId;
  readonly pathField: string;
  readonly expected?: string;
  readonly received?: string;
}

export type SketchSolverEntityResult =
  | {
      readonly ok: true;
      readonly entity: SketchEntitySnapshot;
    }
  | {
      readonly ok: false;
      readonly issue: SketchSolverApplyIssue;
    };

export type SketchSolverNumberResult =
  | {
      readonly ok: true;
      readonly value: number;
    }
  | {
      readonly ok: false;
      readonly issue: SketchSolverApplyIssue;
    };

export interface EvaluatedSketchGeometry {
  readonly entities: ReadonlyMap<SketchEntityId, SketchEntitySnapshot>;
}

export interface SketchSolverEvaluation {
  readonly sketchId: SketchId;
  readonly sketchName: string;
  readonly plane: SketchPlane;
  readonly status: SketchSolverStatus;
  readonly drivenEntityIds: readonly SketchEntityId[];
  readonly dimensions: readonly SketchDimensionEntry[];
  readonly constraints: readonly SketchConstraintEntry[];
  readonly issues: readonly (SketchDimensionIssue | SketchConstraintIssue)[];
  readonly evaluatedGeometry: EvaluatedSketchGeometry;
}

export function evaluateSketch(
  document: SketchSolverDocument,
  sketch: SketchSolverSketch
): SketchSolverEvaluation {
  const dimensions = [...document.sketchDimensions.values()]
    .filter((dimension) => dimension.sketchId === sketch.id)
    .map((dimension) => evaluateSketchDimension(document, dimension));
  const constraints = [...document.sketchConstraints.values()]
    .filter((constraint) => constraint.sketchId === sketch.id)
    .map((constraint) => evaluateSketchConstraint(document, constraint));
  const issues = [
    ...dimensions.flatMap((dimension) => dimension.issues),
    ...constraints.flatMap((constraint) => constraint.issues)
  ];
  const drivenEntityIds = [
    ...new Set([
      ...dimensions.map((dimension) => dimension.entityId),
      ...constraints.map((constraint) => constraint.entityId)
    ])
  ];

  return {
    sketchId: sketch.id,
    sketchName: sketch.name,
    plane: sketch.plane,
    status: getSketchEvaluationStatus(issues),
    drivenEntityIds,
    dimensions,
    constraints,
    issues,
    evaluatedGeometry: evaluateSketchGeometry(document, sketch)
  };
}

export function createSketchEvaluationQueryResponse(
  document: SketchSolverDocument,
  sketch: SketchSolverSketch,
  cadOpsVersion: CadQueryRequest["version"]
): Extract<
  CadQueryResponse,
  { readonly ok: true; readonly query: "sketch.evaluation" }
> {
  const evaluation = evaluateSketch(document, sketch);

  return {
    ok: true,
    query: "sketch.evaluation",
    cadOpsVersion,
    sketchId: evaluation.sketchId,
    sketchName: evaluation.sketchName,
    plane: evaluation.plane,
    status: evaluation.status,
    drivenEntityCount: evaluation.drivenEntityIds.length,
    drivenEntityIds: evaluation.drivenEntityIds,
    dimensionCount: evaluation.dimensions.length,
    dimensions: evaluation.dimensions,
    constraintCount: evaluation.constraints.length,
    constraints: evaluation.constraints,
    issueCount: evaluation.issues.length,
    issues: evaluation.issues
  };
}

export function evaluateSketchDimension(
  document: SketchSolverDocument,
  dimension: SketchDimensionSnapshot
): SketchDimensionEntry {
  const issues: SketchDimensionIssue[] = [];
  const sketch = document.sketches.get(dimension.sketchId);
  const parameter =
    dimension.valueSource.type === "parameter"
      ? document.parameters.get(dimension.valueSource.parameterId)
      : undefined;
  const effectiveValue =
    dimension.valueSource.type === "literal"
      ? dimension.valueSource.value
      : parameter?.value;

  if (!sketch) {
    issues.push({
      code: "SKETCH_NOT_FOUND",
      message: `Sketch does not exist: ${dimension.sketchId}`,
      sketchId: dimension.sketchId,
      sketchDimensionId: dimension.id
    });
  }

  const entity = sketch?.entities.get(dimension.entityId);

  if (sketch && !entity) {
    issues.push({
      code: "SKETCH_ENTITY_NOT_FOUND",
      message: `Sketch entity does not exist: ${dimension.entityId}`,
      sketchId: dimension.sketchId,
      sketchEntityId: dimension.entityId,
      sketchDimensionId: dimension.id
    });
  }

  const targetLabel = `${dimension.target.entityKind}.${dimension.target.role}`;

  if (entity && !isSupportedSketchDimensionTarget(dimension.target, entity)) {
    issues.push({
      code: "UNSUPPORTED_TARGET",
      message: "Sketch dimension target is not supported for this entity.",
      sketchId: dimension.sketchId,
      sketchEntityId: dimension.entityId,
      sketchDimensionId: dimension.id,
      expected: `target for ${entity.kind}`,
      received: targetLabel
    });
  }

  if (
    entity?.kind === "line" &&
    dimension.target.entityKind === "line" &&
    getLineLength(entity) <= 0
  ) {
    issues.push({
      code: "INVALID_VALUE",
      message:
        "Line length dimension cannot evaluate a zero-length line because the direction is ambiguous.",
      sketchId: dimension.sketchId,
      sketchEntityId: dimension.entityId,
      sketchDimensionId: dimension.id,
      expected: "line with a non-zero direction",
      received: "zero-length line"
    });
  }

  if (dimension.valueSource.type === "parameter" && !parameter) {
    issues.push({
      code: "PARAMETER_NOT_FOUND",
      message: `Parameter does not exist: ${dimension.valueSource.parameterId}`,
      parameterId: dimension.valueSource.parameterId,
      sketchDimensionId: dimension.id
    });
  }

  if (effectiveValue !== undefined && !isPositiveFiniteNumber(effectiveValue)) {
    issues.push({
      code: "INVALID_VALUE",
      message: "Sketch dimension effective value must be positive and finite.",
      sketchDimensionId: dimension.id,
      expected: "positive finite number",
      received: describeReceived(effectiveValue)
    });
  }

  return {
    ...cloneSketchDimensionSnapshot(dimension),
    status: getSketchEvaluationStatus(issues),
    issues,
    ...(effectiveValue !== undefined
      ? { effectiveValue: cleanSketchNumber(effectiveValue) }
      : {})
  };
}

export function evaluateSketchConstraint(
  document: SketchSolverDocument,
  constraint: SketchConstraintSnapshot
): SketchConstraintEntry {
  if (constraint.kind === "fixed") {
    return evaluateFixedSketchConstraint(document, constraint);
  }

  return evaluateOrientationSketchConstraint(document, constraint);
}

function evaluateOrientationSketchConstraint(
  document: SketchSolverDocument,
  constraint: Extract<
    SketchConstraintSnapshot,
    { readonly kind: "horizontal" | "vertical" }
  >
): SketchConstraintEntry {
  const issues: SketchConstraintIssue[] = [];
  const sketch = document.sketches.get(constraint.sketchId);

  if (!sketch) {
    issues.push({
      code: "SKETCH_NOT_FOUND",
      message: `Sketch does not exist: ${constraint.sketchId}`,
      sketchId: constraint.sketchId,
      sketchConstraintId: constraint.id
    });
  }

  const entity = sketch?.entities.get(constraint.entityId);

  if (sketch && !entity) {
    issues.push({
      code: "SKETCH_ENTITY_NOT_FOUND",
      message: `Sketch entity does not exist: ${constraint.entityId}`,
      sketchId: constraint.sketchId,
      sketchEntityId: constraint.entityId,
      sketchConstraintId: constraint.id
    });
  }

  if (entity && entity.kind !== "line") {
    issues.push({
      code: "UNSUPPORTED_TARGET",
      message: "Sketch orientation constraint target is not a line entity.",
      sketchId: constraint.sketchId,
      sketchEntityId: constraint.entityId,
      sketchConstraintId: constraint.id,
      expected: "line entity",
      received: entity.kind
    });
  }

  if (entity?.kind === "line" && getLineLength(entity) <= 0) {
    issues.push({
      code: "INVALID_VALUE",
      message:
        "Line orientation constraint cannot evaluate a zero-length line because the orientation is ambiguous.",
      sketchId: constraint.sketchId,
      sketchEntityId: constraint.entityId,
      sketchConstraintId: constraint.id,
      expected: "line with a non-zero direction",
      received: "zero-length line"
    });
  }

  if (
    entity?.kind === "line" &&
    getLineLength(entity) > 0 &&
    !sketchConstraintMatchesLine(constraint.kind, entity)
  ) {
    issues.push({
      code: "INVALID_VALUE",
      message: `Line does not satisfy its ${constraint.kind} constraint.`,
      sketchId: constraint.sketchId,
      sketchEntityId: constraint.entityId,
      sketchConstraintId: constraint.id,
      expected:
        constraint.kind === "horizontal"
          ? "line with equal endpoint Y values"
          : "line with equal endpoint X values",
      received:
        constraint.kind === "horizontal"
          ? "line with different endpoint Y values"
          : "line with different endpoint X values"
    });
  }

  const conflicting = [...document.sketchConstraints.values()].find(
    (candidate) =>
      candidate.id !== constraint.id &&
      candidate.sketchId === constraint.sketchId &&
      candidate.entityId === constraint.entityId &&
      (candidate.kind === "horizontal" || candidate.kind === "vertical")
  );

  if (conflicting) {
    issues.push({
      code: "CONFLICTING_CONSTRAINT",
      message:
        conflicting.kind === constraint.kind
          ? `Line has a duplicate ${constraint.kind} constraint: ${conflicting.id}.`
          : `Line has a conflicting ${conflicting.kind} constraint: ${conflicting.id}.`,
      sketchId: constraint.sketchId,
      sketchEntityId: constraint.entityId,
      sketchConstraintId: constraint.id,
      expected: "one orientation constraint per line",
      received: conflicting.kind
    });
  }

  return {
    ...cloneSketchConstraintSnapshot(constraint),
    status: getSketchEvaluationStatus(issues),
    issues
  };
}

function evaluateFixedSketchConstraint(
  document: SketchSolverDocument,
  constraint: Extract<SketchConstraintSnapshot, { readonly kind: "fixed" }>
): SketchConstraintEntry {
  const issues: SketchConstraintIssue[] = [];
  const sketch = document.sketches.get(constraint.sketchId);

  if (!sketch) {
    issues.push({
      code: "SKETCH_NOT_FOUND",
      message: `Sketch does not exist: ${constraint.sketchId}`,
      sketchId: constraint.sketchId,
      sketchConstraintId: constraint.id,
      sketchPointTarget: constraint.target
    });
  }

  const entity = sketch?.entities.get(constraint.target.entityId);

  if (sketch && !entity) {
    issues.push({
      code: "SKETCH_ENTITY_NOT_FOUND",
      message: `Sketch entity does not exist: ${constraint.target.entityId}`,
      sketchId: constraint.sketchId,
      sketchEntityId: constraint.target.entityId,
      sketchConstraintId: constraint.id,
      sketchPointTarget: constraint.target
    });
  }

  if (entity && !isSketchPointTargetSupported(entity, constraint.target)) {
    issues.push({
      code: "UNSUPPORTED_TARGET",
      message:
        "Fixed sketch constraint target role is not supported for this entity.",
      sketchId: constraint.sketchId,
      sketchEntityId: constraint.target.entityId,
      sketchConstraintId: constraint.id,
      sketchPointTarget: constraint.target,
      expected: `point target for ${entity.kind}`,
      received: constraint.target.role
    });
  }

  const currentCoordinate =
    entity && isSketchPointTargetSupported(entity, constraint.target)
      ? getSketchPointTargetCoordinate(entity, constraint.target)
      : undefined;

  if (!isFiniteVec2(constraint.coordinate)) {
    issues.push({
      code: "INVALID_VALUE",
      message: "Fixed sketch constraint coordinate must be finite.",
      sketchId: constraint.sketchId,
      sketchEntityId: constraint.target.entityId,
      sketchConstraintId: constraint.id,
      sketchPointTarget: constraint.target,
      expected: "finite coordinate",
      received: describeReceived(constraint.coordinate)
    });
  }

  if (
    currentCoordinate &&
    isFiniteVec2(constraint.coordinate) &&
    !vec2Equal(currentCoordinate, constraint.coordinate)
  ) {
    issues.push({
      code: "INCONSISTENT_CONSTRAINT",
      message:
        "Fixed sketch constraint target does not match its fixed coordinate.",
      sketchId: constraint.sketchId,
      sketchEntityId: constraint.target.entityId,
      sketchConstraintId: constraint.id,
      sketchPointTarget: constraint.target,
      expected: formatVec2(constraint.coordinate),
      received: formatVec2(currentCoordinate)
    });
  }

  const conflicting = [...document.sketchConstraints.values()].find(
    (candidate) =>
      candidate.id !== constraint.id &&
      candidate.sketchId === constraint.sketchId &&
      candidate.kind === "fixed" &&
      sketchPointTargetsEqual(candidate.target, constraint.target)
  );

  if (conflicting) {
    issues.push({
      code: "CONFLICTING_CONSTRAINT",
      message: `Sketch point target already has a fixed constraint: ${conflicting.id}.`,
      sketchId: constraint.sketchId,
      sketchEntityId: constraint.target.entityId,
      sketchConstraintId: constraint.id,
      sketchPointTarget: constraint.target,
      expected: "one fixed constraint per sketch point target",
      received: conflicting.id
    });
  }

  return {
    ...cloneSketchConstraintSnapshot(constraint),
    status: getSketchEvaluationStatus(issues),
    issues,
    ...(currentCoordinate ? { currentCoordinate } : {})
  };
}

export function evaluateSketchGeometry(
  document: SketchSolverDocument,
  sketch: SketchSolverSketch
): EvaluatedSketchGeometry {
  const entities = new Map(sketch.entities);

  for (const dimension of document.sketchDimensions.values()) {
    if (dimension.sketchId !== sketch.id) {
      continue;
    }

    const entity = entities.get(dimension.entityId);
    const entry = evaluateSketchDimension(document, dimension);

    if (
      !entity ||
      entry.status !== "healthy" ||
      entry.effectiveValue === undefined
    ) {
      continue;
    }

    const result = applySketchDimensionValue(
      entity,
      dimension,
      entry.effectiveValue
    );

    if (result.ok) {
      entities.set(result.entity.id, result.entity);
    }
  }

  for (const constraint of document.sketchConstraints.values()) {
    if (constraint.sketchId !== sketch.id) {
      continue;
    }

    const entity = entities.get(constraint.entityId);

    if (!entity) {
      continue;
    }

    const result = applySketchConstraintValue(entity, constraint);

    if (result.ok) {
      entities.set(result.entity.id, result.entity);
    }
  }

  return { entities };
}

export function isSupportedSketchDimensionTarget(
  target: unknown,
  entity: SketchEntitySnapshot
): target is SketchDimensionTarget {
  if (!isRecord(target)) {
    return false;
  }

  if (entity.kind === "rectangle") {
    return (
      target.entityKind === "rectangle" &&
      (target.role === "width" || target.role === "height")
    );
  }

  if (entity.kind === "circle") {
    return target.entityKind === "circle" && target.role === "radius";
  }

  if (entity.kind === "line") {
    return target.entityKind === "line" && target.role === "length";
  }

  return false;
}

export function applySketchDimensionValue(
  entity: SketchEntitySnapshot,
  dimension: SketchDimensionSnapshot,
  value: number
): SketchSolverEntityResult {
  if (
    entity.kind === "rectangle" &&
    dimension.target.entityKind === "rectangle"
  ) {
    return {
      ok: true,
      entity: {
        ...entity,
        [dimension.target.role]: value
      }
    };
  }

  if (entity.kind === "circle" && dimension.target.entityKind === "circle") {
    return {
      ok: true,
      entity: {
        ...entity,
        radius: value
      }
    };
  }

  if (entity.kind === "line" && dimension.target.entityKind === "line") {
    return applyLineLengthDimensionValue(entity, dimension, value);
  }

  return {
    ok: false,
    issue: {
      kind: "dimension",
      code: "INVALID_SKETCH_DIMENSION",
      message: "Sketch dimension target no longer matches the target entity.",
      sketchId: dimension.sketchId,
      sketchEntityId: dimension.entityId,
      sketchDimensionId: dimension.id,
      pathField: "target",
      expected: `target for ${entity.kind}`,
      received: `${dimension.target.entityKind}.${dimension.target.role}`
    }
  };
}

export function getSketchDimensionTargetValue(
  entity: SketchEntitySnapshot,
  dimension: SketchDimensionSnapshot
): SketchSolverNumberResult {
  if (
    entity.kind === "rectangle" &&
    dimension.target.entityKind === "rectangle"
  ) {
    return {
      ok: true,
      value: cleanSketchNumber(entity[dimension.target.role])
    };
  }

  if (entity.kind === "circle" && dimension.target.entityKind === "circle") {
    return {
      ok: true,
      value: cleanSketchNumber(entity.radius)
    };
  }

  if (entity.kind === "line" && dimension.target.entityKind === "line") {
    return {
      ok: true,
      value: getLineLength(entity)
    };
  }

  return {
    ok: false,
    issue: {
      kind: "dimension",
      code: "INVALID_SKETCH_DIMENSION",
      message: "Sketch dimension target no longer matches the target entity.",
      sketchId: dimension.sketchId,
      sketchEntityId: dimension.entityId,
      sketchDimensionId: dimension.id,
      pathField: "target",
      expected: `target for ${entity.kind}`,
      received: `${dimension.target.entityKind}.${dimension.target.role}`
    }
  };
}

export function applySketchConstraintValue(
  entity: SketchEntitySnapshot,
  constraint: SketchConstraintSnapshot
): SketchSolverEntityResult {
  if (constraint.kind === "fixed") {
    return applyFixedSketchConstraintValue(entity, constraint);
  }

  if (entity.kind !== "line") {
    return {
      ok: false,
      issue: {
        kind: "constraint",
        code: "INVALID_SKETCH_CONSTRAINT",
        message: "Sketch constraint target no longer matches a line entity.",
        sketchId: constraint.sketchId,
        sketchEntityId: constraint.entityId,
        sketchConstraintId: constraint.id,
        pathField: "entityId",
        expected: "line entity",
        received: entity.kind
      }
    };
  }

  const length = getLineLength(entity);

  if (length <= 0) {
    return {
      ok: false,
      issue: {
        kind: "constraint",
        code: "INVALID_SKETCH_CONSTRAINT",
        message:
          "Line orientation constraint cannot update a zero-length line because the orientation is ambiguous.",
        sketchId: constraint.sketchId,
        sketchEntityId: constraint.entityId,
        sketchConstraintId: constraint.id,
        pathField: "entityId",
        expected: "line with a non-zero direction",
        received: "zero-length line"
      }
    };
  }

  const center: Vec2 = [
    (entity.start[0] + entity.end[0]) / 2,
    (entity.start[1] + entity.end[1]) / 2
  ];
  const half = length / 2;

  if (constraint.kind === "horizontal") {
    return {
      ok: true,
      entity: {
        ...entity,
        start: [
          cleanSketchNumber(center[0] - half),
          cleanSketchNumber(center[1])
        ],
        end: [cleanSketchNumber(center[0] + half), cleanSketchNumber(center[1])]
      }
    };
  }

  return {
    ok: true,
    entity: {
      ...entity,
      start: [
        cleanSketchNumber(center[0]),
        cleanSketchNumber(center[1] - half)
      ],
      end: [cleanSketchNumber(center[0]), cleanSketchNumber(center[1] + half)]
    }
  };
}

export function getLineLength(
  entity: Extract<SketchEntitySnapshot, { readonly kind: "line" }>
): number {
  return cleanSketchNumber(
    Math.hypot(entity.end[0] - entity.start[0], entity.end[1] - entity.start[1])
  );
}

export function sketchConstraintMatchesLine(
  kind: SketchConstraintKind,
  entity: Extract<SketchEntitySnapshot, { readonly kind: "line" }>
): boolean {
  if (kind === "fixed") {
    return true;
  }

  return kind === "horizontal"
    ? cleanSketchNumber(entity.start[1]) === cleanSketchNumber(entity.end[1])
    : cleanSketchNumber(entity.start[0]) === cleanSketchNumber(entity.end[0]);
}

export function getSketchEvaluationStatus(
  issues: readonly { readonly code: string }[]
): SketchSolverStatus {
  if (issues.length === 0) {
    return "healthy";
  }

  if (
    issues.some(
      (issue) =>
        issue.code === "SKETCH_NOT_FOUND" ||
        issue.code === "SKETCH_ENTITY_NOT_FOUND" ||
        issue.code === "PARAMETER_NOT_FOUND"
    )
  ) {
    return "missing-target";
  }

  if (issues.some((issue) => issue.code === "INVALID_VALUE")) {
    return "invalid-value";
  }

  if (
    issues.some(
      (issue) =>
        issue.code === "INCONSISTENT_CONSTRAINT" ||
        issue.code === "CONFLICTING_CONSTRAINT"
    )
  ) {
    return "inconsistent";
  }

  return "unsupported";
}

export function cleanSketchNumber(value: number): number {
  const rounded = Math.round(value * 1e12) / 1e12;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function applyLineLengthDimensionValue(
  entity: Extract<SketchEntitySnapshot, { readonly kind: "line" }>,
  dimension: SketchDimensionSnapshot,
  value: number
): SketchSolverEntityResult {
  const currentLength = getLineLength(entity);

  if (currentLength <= 0) {
    return {
      ok: false,
      issue: {
        kind: "dimension",
        code: "INVALID_SKETCH_DIMENSION",
        message:
          "Line length dimension cannot update a zero-length line because the direction is ambiguous.",
        sketchId: dimension.sketchId,
        sketchEntityId: dimension.entityId,
        sketchDimensionId: dimension.id,
        pathField: "target",
        expected: "line with a non-zero direction",
        received: "zero-length line"
      }
    };
  }

  const center: Vec2 = [
    (entity.start[0] + entity.end[0]) / 2,
    (entity.start[1] + entity.end[1]) / 2
  ];
  const ux = (entity.end[0] - entity.start[0]) / currentLength;
  const uy = (entity.end[1] - entity.start[1]) / currentLength;
  const half = value / 2;

  return {
    ok: true,
    entity: {
      ...entity,
      start: [
        cleanSketchNumber(center[0] - ux * half),
        cleanSketchNumber(center[1] - uy * half)
      ],
      end: [
        cleanSketchNumber(center[0] + ux * half),
        cleanSketchNumber(center[1] + uy * half)
      ]
    }
  };
}

function applyFixedSketchConstraintValue(
  entity: SketchEntitySnapshot,
  constraint: Extract<SketchConstraintSnapshot, { readonly kind: "fixed" }>
): SketchSolverEntityResult {
  if (!isSketchPointTargetSupported(entity, constraint.target)) {
    return {
      ok: false,
      issue: {
        kind: "constraint",
        code: "INVALID_SKETCH_CONSTRAINT",
        message:
          "Fixed sketch constraint target role is not supported for this entity.",
        sketchId: constraint.sketchId,
        sketchEntityId: constraint.target.entityId,
        sketchConstraintId: constraint.id,
        pathField: "target",
        expected: `point target for ${entity.kind}`,
        received: constraint.target.role
      }
    };
  }

  if (!isFiniteVec2(constraint.coordinate)) {
    return {
      ok: false,
      issue: {
        kind: "constraint",
        code: "INVALID_SKETCH_CONSTRAINT",
        message: "Fixed sketch constraint coordinate must be finite.",
        sketchId: constraint.sketchId,
        sketchEntityId: constraint.target.entityId,
        sketchConstraintId: constraint.id,
        pathField: "coordinate",
        expected: "finite coordinate",
        received: describeReceived(constraint.coordinate)
      }
    };
  }

  return {
    ok: true,
    entity: setSketchPointTargetCoordinate(
      entity,
      constraint.target,
      constraint.coordinate
    )
  };
}

function isSketchPointTargetSupported(
  entity: SketchEntitySnapshot,
  target: SketchPointTarget
): boolean {
  if (target.entityId !== entity.id) {
    return false;
  }

  return (
    (entity.kind === "point" && target.role === "position") ||
    (entity.kind === "line" &&
      (target.role === "start" || target.role === "end")) ||
    ((entity.kind === "rectangle" || entity.kind === "circle") &&
      target.role === "center")
  );
}

function getSketchPointTargetCoordinate(
  entity: SketchEntitySnapshot,
  target: SketchPointTarget
): Vec2 {
  if (entity.kind === "point" && target.role === "position") {
    return cleanVec2(entity.point);
  }

  if (entity.kind === "line" && target.role === "start") {
    return cleanVec2(entity.start);
  }

  if (entity.kind === "line" && target.role === "end") {
    return cleanVec2(entity.end);
  }

  if (
    (entity.kind === "rectangle" || entity.kind === "circle") &&
    target.role === "center"
  ) {
    return cleanVec2(entity.center);
  }

  return [NaN, NaN];
}

function setSketchPointTargetCoordinate(
  entity: SketchEntitySnapshot,
  target: SketchPointTarget,
  coordinate: Vec2
): SketchEntitySnapshot {
  const cleanCoordinate = cleanVec2(coordinate);

  if (entity.kind === "point" && target.role === "position") {
    return { ...entity, point: cleanCoordinate };
  }

  if (entity.kind === "line" && target.role === "start") {
    return { ...entity, start: cleanCoordinate };
  }

  if (entity.kind === "line" && target.role === "end") {
    return { ...entity, end: cleanCoordinate };
  }

  if (entity.kind === "rectangle" && target.role === "center") {
    return { ...entity, center: cleanCoordinate };
  }

  if (entity.kind === "circle" && target.role === "center") {
    return { ...entity, center: cleanCoordinate };
  }

  return entity;
}

function sketchPointTargetsEqual(
  left: SketchPointTarget,
  right: SketchPointTarget
): boolean {
  return left.entityId === right.entityId && left.role === right.role;
}

function cloneSketchDimensionSnapshot(
  dimension: SketchDimensionSnapshot
): SketchDimensionSnapshot {
  return {
    id: dimension.id,
    name: dimension.name,
    sketchId: dimension.sketchId,
    entityId: dimension.entityId,
    target: { ...dimension.target },
    valueSource:
      dimension.valueSource.type === "literal"
        ? { type: "literal", value: dimension.valueSource.value }
        : { type: "parameter", parameterId: dimension.valueSource.parameterId }
  };
}

function cloneSketchConstraintSnapshot(
  constraint: SketchConstraintSnapshot
): SketchConstraintSnapshot {
  if (constraint.kind === "fixed") {
    return {
      id: constraint.id,
      name: constraint.name,
      sketchId: constraint.sketchId,
      entityId: constraint.entityId,
      kind: "fixed",
      target: { ...constraint.target },
      coordinate: cleanVec2(constraint.coordinate)
    };
  }

  return {
    id: constraint.id,
    name: constraint.name,
    sketchId: constraint.sketchId,
    entityId: constraint.entityId,
    kind: constraint.kind
  };
}

function isPositiveFiniteNumber(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function describeReceived(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (
    value === undefined ||
    value === null ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function cleanVec2(value: Vec2): Vec2 {
  return [cleanSketchNumber(value[0]), cleanSketchNumber(value[1])];
}

function isFiniteVec2(value: Vec2): boolean {
  return Number.isFinite(value[0]) && Number.isFinite(value[1]);
}

function vec2Equal(left: Vec2, right: Vec2): boolean {
  return (
    cleanSketchNumber(left[0]) === cleanSketchNumber(right[0]) &&
    cleanSketchNumber(left[1]) === cleanSketchNumber(right[1])
  );
}

function formatVec2(value: Vec2): string {
  return `[${cleanSketchNumber(value[0])}, ${cleanSketchNumber(value[1])}]`;
}
