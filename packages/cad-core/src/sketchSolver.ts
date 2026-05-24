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

type SketchSolverEntitiesResult =
  | {
      readonly ok: true;
      readonly entities: ReadonlyMap<SketchEntityId, SketchEntitySnapshot>;
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

export interface SketchSolverApplyContext {
  readonly document: SketchSolverDocument;
  readonly sketchId: SketchId;
  readonly entities: ReadonlyMap<SketchEntityId, SketchEntitySnapshot>;
}

export function evaluateSketch(
  document: SketchSolverDocument,
  sketch: SketchSolverSketch
): SketchSolverEvaluation {
  const evaluatedGeometry = evaluateSketchGeometry(document, sketch);
  const dimensions = [...document.sketchDimensions.values()]
    .filter((dimension) => dimension.sketchId === sketch.id)
    .map((dimension) =>
      evaluateSketchDimension(document, dimension, evaluatedGeometry.entities)
    );
  const constraints = [...document.sketchConstraints.values()]
    .filter((constraint) => constraint.sketchId === sketch.id)
    .map((constraint) =>
      evaluateSketchConstraint(document, constraint, evaluatedGeometry.entities)
    );
  const issues = [
    ...dimensions.flatMap((dimension) => dimension.issues),
    ...constraints.flatMap((constraint) => constraint.issues)
  ];
  const drivenEntityIds = [
    ...new Set([
      ...dimensions.map((dimension) => dimension.entityId),
      ...constraints.flatMap((constraint) =>
        constraint.kind === "coincident"
          ? [
              constraint.entityId,
              constraint.primaryTarget.entityId,
              constraint.secondaryTarget.entityId
            ]
          : constraint.kind === "midpoint"
            ? [
                constraint.entityId,
                constraint.lineEntityId,
                constraint.target.entityId
              ]
            : [constraint.entityId]
      )
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
    evaluatedGeometry
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
  dimension: SketchDimensionSnapshot,
  evaluatedEntities?: ReadonlyMap<SketchEntityId, SketchEntitySnapshot>,
  options: { readonly checkConsistency?: boolean } = {}
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

  const entity =
    evaluatedEntities?.get(dimension.entityId) ??
    sketch?.entities.get(dimension.entityId);

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

  if (
    entity &&
    options.checkConsistency !== false &&
    issues.length === 0 &&
    effectiveValue !== undefined &&
    isSupportedSketchDimensionTarget(dimension.target, entity)
  ) {
    const currentValue = getSketchDimensionTargetValue(entity, dimension);

    if (currentValue.ok && !numbersEqual(currentValue.value, effectiveValue)) {
      issues.push({
        code: "INCONSISTENT_CONSTRAINT",
        message: "Sketch dimension target does not match its evaluated value.",
        sketchId: dimension.sketchId,
        sketchEntityId: dimension.entityId,
        sketchDimensionId: dimension.id,
        expected: String(cleanSketchNumber(effectiveValue)),
        received: String(cleanSketchNumber(currentValue.value))
      });
    }
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
  constraint: SketchConstraintSnapshot,
  evaluatedEntities?: ReadonlyMap<SketchEntityId, SketchEntitySnapshot>
): SketchConstraintEntry {
  if (constraint.kind === "fixed") {
    return evaluateFixedSketchConstraint(
      document,
      constraint,
      evaluatedEntities
    );
  }

  if (constraint.kind === "coincident") {
    return evaluateCoincidentSketchConstraint(
      document,
      constraint,
      evaluatedEntities
    );
  }

  if (constraint.kind === "midpoint") {
    return evaluateMidpointSketchConstraint(
      document,
      constraint,
      evaluatedEntities
    );
  }

  return evaluateOrientationSketchConstraint(
    document,
    constraint,
    evaluatedEntities
  );
}

function evaluateOrientationSketchConstraint(
  document: SketchSolverDocument,
  constraint: Extract<
    SketchConstraintSnapshot,
    { readonly kind: "horizontal" | "vertical" }
  >,
  evaluatedEntities?: ReadonlyMap<SketchEntityId, SketchEntitySnapshot>
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

  const entity =
    evaluatedEntities?.get(constraint.entityId) ??
    sketch?.entities.get(constraint.entityId);

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
  constraint: Extract<SketchConstraintSnapshot, { readonly kind: "fixed" }>,
  evaluatedEntities?: ReadonlyMap<SketchEntityId, SketchEntitySnapshot>
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

  const entity =
    evaluatedEntities?.get(constraint.target.entityId) ??
    sketch?.entities.get(constraint.target.entityId);

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

function evaluateCoincidentSketchConstraint(
  document: SketchSolverDocument,
  constraint: Extract<
    SketchConstraintSnapshot,
    { readonly kind: "coincident" }
  >,
  evaluatedEntities?: ReadonlyMap<SketchEntityId, SketchEntitySnapshot>
): SketchConstraintEntry {
  const issues: SketchConstraintIssue[] = [];
  const sketch = document.sketches.get(constraint.sketchId);

  if (!sketch) {
    issues.push({
      code: "SKETCH_NOT_FOUND",
      message: `Sketch does not exist: ${constraint.sketchId}`,
      sketchId: constraint.sketchId,
      sketchConstraintId: constraint.id,
      primaryTarget: constraint.primaryTarget,
      secondaryTarget: constraint.secondaryTarget
    });
  }

  const primaryEntity =
    evaluatedEntities?.get(constraint.primaryTarget.entityId) ??
    sketch?.entities.get(constraint.primaryTarget.entityId);
  const secondaryEntity = sketch?.entities.get(
    constraint.secondaryTarget.entityId
  );
  const evaluatedSecondaryEntity =
    evaluatedEntities?.get(constraint.secondaryTarget.entityId) ??
    secondaryEntity;

  if (sketch && !primaryEntity) {
    issues.push({
      code: "SKETCH_ENTITY_NOT_FOUND",
      message: `Sketch entity does not exist: ${constraint.primaryTarget.entityId}`,
      sketchId: constraint.sketchId,
      sketchEntityId: constraint.primaryTarget.entityId,
      sketchConstraintId: constraint.id,
      primaryTarget: constraint.primaryTarget,
      secondaryTarget: constraint.secondaryTarget
    });
  }

  if (sketch && !secondaryEntity) {
    issues.push({
      code: "SKETCH_ENTITY_NOT_FOUND",
      message: `Sketch entity does not exist: ${constraint.secondaryTarget.entityId}`,
      sketchId: constraint.sketchId,
      sketchEntityId: constraint.secondaryTarget.entityId,
      sketchConstraintId: constraint.id,
      primaryTarget: constraint.primaryTarget,
      secondaryTarget: constraint.secondaryTarget
    });
  }

  if (
    primaryEntity &&
    !isSketchPointTargetSupported(primaryEntity, constraint.primaryTarget)
  ) {
    issues.push({
      code: "UNSUPPORTED_TARGET",
      message:
        "Coincident sketch constraint primary target role is not supported for this entity.",
      sketchId: constraint.sketchId,
      sketchEntityId: constraint.primaryTarget.entityId,
      sketchConstraintId: constraint.id,
      primaryTarget: constraint.primaryTarget,
      secondaryTarget: constraint.secondaryTarget,
      expected: `point target for ${primaryEntity.kind}`,
      received: constraint.primaryTarget.role
    });
  }

  if (
    evaluatedSecondaryEntity &&
    !isSketchPointTargetSupported(
      evaluatedSecondaryEntity,
      constraint.secondaryTarget
    )
  ) {
    issues.push({
      code: "UNSUPPORTED_TARGET",
      message:
        "Coincident sketch constraint secondary target role is not supported for this entity.",
      sketchId: constraint.sketchId,
      sketchEntityId: constraint.secondaryTarget.entityId,
      sketchConstraintId: constraint.id,
      primaryTarget: constraint.primaryTarget,
      secondaryTarget: constraint.secondaryTarget,
      expected: `point target for ${evaluatedSecondaryEntity.kind}`,
      received: constraint.secondaryTarget.role
    });
  }

  if (
    sketchPointTargetsEqual(
      constraint.primaryTarget,
      constraint.secondaryTarget
    )
  ) {
    issues.push({
      code: "CONFLICTING_CONSTRAINT",
      message: "Coincident sketch constraint targets must be distinct.",
      sketchId: constraint.sketchId,
      sketchEntityId: constraint.entityId,
      sketchConstraintId: constraint.id,
      primaryTarget: constraint.primaryTarget,
      secondaryTarget: constraint.secondaryTarget,
      expected: "distinct sketch point targets",
      received: "same target"
    });
  }

  const duplicate = [...document.sketchConstraints.values()].find(
    (candidate) =>
      candidate.id !== constraint.id &&
      candidate.sketchId === constraint.sketchId &&
      candidate.kind === "coincident" &&
      sketchPointTargetPairKey(
        candidate.primaryTarget,
        candidate.secondaryTarget
      ) ===
        sketchPointTargetPairKey(
          constraint.primaryTarget,
          constraint.secondaryTarget
        )
  );

  if (duplicate) {
    issues.push({
      code: "CONFLICTING_CONSTRAINT",
      message: `Sketch point targets have a duplicate coincident constraint: ${duplicate.id}.`,
      sketchId: constraint.sketchId,
      sketchEntityId: constraint.entityId,
      sketchConstraintId: constraint.id,
      primaryTarget: constraint.primaryTarget,
      secondaryTarget: constraint.secondaryTarget,
      expected: "one coincident constraint per target pair",
      received: duplicate.id
    });
  }

  const primaryCurrentCoordinate =
    primaryEntity &&
    isSketchPointTargetSupported(primaryEntity, constraint.primaryTarget)
      ? getSketchPointTargetCoordinate(primaryEntity, constraint.primaryTarget)
      : undefined;
  const secondaryCurrentCoordinate =
    evaluatedSecondaryEntity &&
    isSketchPointTargetSupported(
      evaluatedSecondaryEntity,
      constraint.secondaryTarget
    )
      ? getSketchPointTargetCoordinate(
          evaluatedSecondaryEntity,
          constraint.secondaryTarget
        )
      : undefined;
  const primaryFixed = findFixedConstraintCoordinate(
    document,
    constraint.sketchId,
    constraint.primaryTarget
  );
  const secondaryFixed = findFixedConstraintCoordinate(
    document,
    constraint.sketchId,
    constraint.secondaryTarget
  );
  const resolvedCoordinate =
    primaryFixed?.coordinate ??
    secondaryFixed?.coordinate ??
    primaryCurrentCoordinate;

  if (
    primaryFixed &&
    secondaryFixed &&
    !vec2Equal(primaryFixed.coordinate, secondaryFixed.coordinate)
  ) {
    issues.push({
      code: "INCONSISTENT_CONSTRAINT",
      message:
        "Coincident sketch constraint cannot satisfy two different fixed coordinates.",
      sketchId: constraint.sketchId,
      sketchEntityId: constraint.entityId,
      sketchConstraintId: constraint.id,
      primaryTarget: constraint.primaryTarget,
      secondaryTarget: constraint.secondaryTarget,
      expected: formatVec2(primaryFixed.coordinate),
      received: formatVec2(secondaryFixed.coordinate)
    });
  }

  if (
    resolvedCoordinate &&
    primaryCurrentCoordinate &&
    !vec2Equal(primaryCurrentCoordinate, resolvedCoordinate)
  ) {
    issues.push({
      code: "INCONSISTENT_CONSTRAINT",
      message:
        "Coincident sketch constraint primary target does not match the resolved coordinate.",
      sketchId: constraint.sketchId,
      sketchEntityId: constraint.primaryTarget.entityId,
      sketchConstraintId: constraint.id,
      primaryTarget: constraint.primaryTarget,
      secondaryTarget: constraint.secondaryTarget,
      expected: formatVec2(resolvedCoordinate),
      received: formatVec2(primaryCurrentCoordinate)
    });
  }

  if (
    resolvedCoordinate &&
    secondaryCurrentCoordinate &&
    !vec2Equal(secondaryCurrentCoordinate, resolvedCoordinate)
  ) {
    issues.push({
      code: "INCONSISTENT_CONSTRAINT",
      message:
        "Coincident sketch constraint secondary target does not match the resolved coordinate.",
      sketchId: constraint.sketchId,
      sketchEntityId: constraint.secondaryTarget.entityId,
      sketchConstraintId: constraint.id,
      primaryTarget: constraint.primaryTarget,
      secondaryTarget: constraint.secondaryTarget,
      expected: formatVec2(resolvedCoordinate),
      received: formatVec2(secondaryCurrentCoordinate)
    });
  }

  return {
    ...cloneSketchConstraintSnapshot(constraint),
    status: getSketchEvaluationStatus(issues),
    issues,
    ...(primaryCurrentCoordinate ? { primaryCurrentCoordinate } : {}),
    ...(secondaryCurrentCoordinate ? { secondaryCurrentCoordinate } : {}),
    ...(resolvedCoordinate ? { resolvedCoordinate } : {})
  };
}

function evaluateMidpointSketchConstraint(
  document: SketchSolverDocument,
  constraint: Extract<SketchConstraintSnapshot, { readonly kind: "midpoint" }>,
  evaluatedEntities?: ReadonlyMap<SketchEntityId, SketchEntitySnapshot>
): SketchConstraintEntry {
  const issues: SketchConstraintIssue[] = [];
  const sketch = document.sketches.get(constraint.sketchId);

  if (!sketch) {
    issues.push({
      code: "SKETCH_NOT_FOUND",
      message: `Sketch does not exist: ${constraint.sketchId}`,
      sketchId: constraint.sketchId,
      sketchConstraintId: constraint.id,
      lineEntityId: constraint.lineEntityId,
      sketchPointTarget: constraint.target
    });
  }

  const lineEntity =
    evaluatedEntities?.get(constraint.lineEntityId) ??
    sketch?.entities.get(constraint.lineEntityId);
  const targetEntity =
    evaluatedEntities?.get(constraint.target.entityId) ??
    sketch?.entities.get(constraint.target.entityId);

  if (sketch && !lineEntity) {
    issues.push({
      code: "SKETCH_ENTITY_NOT_FOUND",
      message: `Sketch entity does not exist: ${constraint.lineEntityId}`,
      sketchId: constraint.sketchId,
      sketchEntityId: constraint.lineEntityId,
      sketchConstraintId: constraint.id,
      lineEntityId: constraint.lineEntityId,
      sketchPointTarget: constraint.target
    });
  }

  if (sketch && !targetEntity) {
    issues.push({
      code: "SKETCH_ENTITY_NOT_FOUND",
      message: `Sketch entity does not exist: ${constraint.target.entityId}`,
      sketchId: constraint.sketchId,
      sketchEntityId: constraint.target.entityId,
      sketchConstraintId: constraint.id,
      lineEntityId: constraint.lineEntityId,
      sketchPointTarget: constraint.target
    });
  }

  if (lineEntity && lineEntity.kind !== "line") {
    issues.push({
      code: "UNSUPPORTED_TARGET",
      message: "Midpoint sketch constraint line target is not a line entity.",
      sketchId: constraint.sketchId,
      sketchEntityId: constraint.lineEntityId,
      sketchConstraintId: constraint.id,
      lineEntityId: constraint.lineEntityId,
      sketchPointTarget: constraint.target,
      expected: "line entity",
      received: lineEntity.kind
    });
  }

  if (
    targetEntity &&
    !isMidpointSketchPointTargetSupported(targetEntity, constraint.target)
  ) {
    issues.push({
      code: "UNSUPPORTED_TARGET",
      message:
        "Midpoint sketch constraint target role is not supported for this entity.",
      sketchId: constraint.sketchId,
      sketchEntityId: constraint.target.entityId,
      sketchConstraintId: constraint.id,
      lineEntityId: constraint.lineEntityId,
      sketchPointTarget: constraint.target,
      expected: `point, rectangle center, or circle center target for ${targetEntity.kind}`,
      received: constraint.target.role
    });
  }

  if (
    constraint.target.entityId === constraint.lineEntityId &&
    (constraint.target.role === "start" || constraint.target.role === "end")
  ) {
    issues.push({
      code: "UNSUPPORTED_TARGET",
      message:
        "Midpoint sketch constraint target cannot be one of the same line endpoints.",
      sketchId: constraint.sketchId,
      sketchEntityId: constraint.target.entityId,
      sketchConstraintId: constraint.id,
      lineEntityId: constraint.lineEntityId,
      sketchPointTarget: constraint.target,
      expected: "point, rectangle center, or circle center target",
      received: constraint.target.role
    });
  }

  const duplicate = [...document.sketchConstraints.values()].find(
    (candidate) =>
      candidate.id !== constraint.id &&
      candidate.sketchId === constraint.sketchId &&
      candidate.kind === "midpoint" &&
      candidate.lineEntityId === constraint.lineEntityId &&
      sketchPointTargetsEqual(candidate.target, constraint.target)
  );

  if (duplicate) {
    issues.push({
      code: "CONFLICTING_CONSTRAINT",
      message: `Line and point target already have a midpoint constraint: ${duplicate.id}.`,
      sketchId: constraint.sketchId,
      sketchEntityId: constraint.target.entityId,
      sketchConstraintId: constraint.id,
      lineEntityId: constraint.lineEntityId,
      sketchPointTarget: constraint.target,
      expected: "one midpoint constraint per line/target pair",
      received: duplicate.id
    });
  }

  const resolvedCoordinate =
    lineEntity?.kind === "line" ? getLineMidpoint(lineEntity) : undefined;
  const currentCoordinate =
    targetEntity &&
    isMidpointSketchPointTargetSupported(targetEntity, constraint.target)
      ? getSketchPointTargetCoordinate(targetEntity, constraint.target)
      : undefined;
  const fixedTarget = findFixedConstraintCoordinatesForTarget(
    document,
    constraint.sketchId,
    constraint.target
  ).find(
    (candidate) =>
      resolvedCoordinate && !vec2Equal(candidate.coordinate, resolvedCoordinate)
  );

  if (resolvedCoordinate && fixedTarget) {
    issues.push({
      code: "INCONSISTENT_CONSTRAINT",
      message:
        "Midpoint sketch constraint cannot satisfy the target's fixed coordinate.",
      sketchId: constraint.sketchId,
      sketchEntityId: constraint.target.entityId,
      sketchConstraintId: constraint.id,
      lineEntityId: constraint.lineEntityId,
      sketchPointTarget: constraint.target,
      expected: formatVec2(fixedTarget.coordinate),
      received: formatVec2(resolvedCoordinate)
    });
  }

  if (
    resolvedCoordinate &&
    currentCoordinate &&
    !vec2Equal(currentCoordinate, resolvedCoordinate)
  ) {
    issues.push({
      code: "INCONSISTENT_CONSTRAINT",
      message:
        "Midpoint sketch constraint target does not match the line midpoint.",
      sketchId: constraint.sketchId,
      sketchEntityId: constraint.target.entityId,
      sketchConstraintId: constraint.id,
      lineEntityId: constraint.lineEntityId,
      sketchPointTarget: constraint.target,
      expected: formatVec2(resolvedCoordinate),
      received: formatVec2(currentCoordinate)
    });
  }

  return {
    ...cloneSketchConstraintSnapshot(constraint),
    status: getSketchEvaluationStatus(issues),
    issues,
    ...(currentCoordinate ? { currentCoordinate } : {}),
    ...(resolvedCoordinate ? { resolvedCoordinate } : {})
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
    const entry = evaluateSketchDimension(document, dimension, undefined, {
      checkConsistency: false
    });

    if (
      !entity ||
      entity.kind === "line" ||
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

    if (constraint.kind === "coincident") {
      const primaryEntity = entities.get(constraint.primaryTarget.entityId);
      const secondaryEntity = entities.get(constraint.secondaryTarget.entityId);

      if (primaryEntity?.kind === "line" || secondaryEntity?.kind === "line") {
        continue;
      }

      const result = applyCoincidentSketchConstraintValue(
        entities,
        document,
        constraint
      );

      if (result.ok) {
        for (const entity of result.entities.values()) {
          entities.set(entity.id, entity);
        }
      }

      continue;
    }

    const entity = entities.get(constraint.entityId);

    if (!entity || entity.kind === "line") {
      continue;
    }

    const result = applySketchConstraintValue(entity, constraint);

    if (result.ok) {
      entities.set(result.entity.id, result.entity);
    }
  }

  for (const entity of [...entities.values()]) {
    if (entity.kind !== "line") {
      continue;
    }

    const result = applySketchLineEvaluation(entity, {
      document,
      sketchId: sketch.id,
      entities
    });

    if (result.ok) {
      entities.set(result.entity.id, result.entity);
    }
  }

  for (const constraint of document.sketchConstraints.values()) {
    if (constraint.sketchId !== sketch.id || constraint.kind !== "midpoint") {
      continue;
    }

    const result = applyMidpointSketchConstraintValue(
      entities,
      document,
      constraint
    );

    if (result.ok) {
      for (const entity of result.entities.values()) {
        entities.set(entity.id, entity);
      }
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
  value: number,
  context?: SketchSolverApplyContext
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
    if (context) {
      return applySketchLineEvaluation(entity, context, {
        dimension,
        dimensionValue: value
      });
    }

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
  constraint: SketchConstraintSnapshot,
  context?: SketchSolverApplyContext
): SketchSolverEntityResult {
  if (constraint.kind === "fixed") {
    if (entity.kind === "line" && context) {
      return applySketchLineEvaluation(entity, context, { constraint });
    }

    return applyFixedSketchConstraintValue(entity, constraint);
  }

  if (constraint.kind === "coincident") {
    if (
      entity.kind === "line" &&
      context &&
      (constraint.primaryTarget.entityId === entity.id ||
        constraint.secondaryTarget.entityId === entity.id)
    ) {
      return applySketchLineEvaluation(entity, context, { constraint });
    }

    return {
      ok: false,
      issue: {
        kind: "constraint",
        code: "INVALID_SKETCH_CONSTRAINT",
        message:
          "Coincident sketch constraints require sketch-level evaluation.",
        sketchId: constraint.sketchId,
        sketchEntityId: constraint.entityId,
        sketchConstraintId: constraint.id,
        pathField: "primaryTarget",
        expected: "sketch-level coincident evaluation",
        received: "single entity evaluation"
      }
    };
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

  if (context) {
    return applySketchLineEvaluation(entity, context, { constraint });
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
  if (kind === "fixed" || kind === "coincident" || kind === "midpoint") {
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

function applySketchLineEvaluation(
  entity: Extract<SketchEntitySnapshot, { readonly kind: "line" }>,
  context: SketchSolverApplyContext,
  override: {
    readonly dimension?: SketchDimensionSnapshot;
    readonly dimensionValue?: number;
    readonly constraint?: SketchConstraintSnapshot;
  } = {}
): SketchSolverEntityResult {
  const lengthDimension = getLineLengthDimension(
    context,
    entity.id,
    override.dimension
  );
  const lengthValue =
    override.dimension &&
    lengthDimension?.id === override.dimension.id &&
    override.dimensionValue !== undefined
      ? override.dimensionValue
      : lengthDimension
        ? resolveSketchDimensionEffectiveValue(
            context.document,
            lengthDimension
          )
        : undefined;
  const orientation = getLineOrientationConstraint(
    context,
    entity.id,
    override.constraint
  );
  const startAnchor = resolveLineEndpointAnchor(context, entity, "start");

  if (!startAnchor.ok) {
    return { ok: false, issue: startAnchor.issue };
  }

  const endAnchor = resolveLineEndpointAnchor(context, entity, "end");

  if (!endAnchor.ok) {
    return { ok: false, issue: endAnchor.issue };
  }

  const shouldPreserveLength =
    lengthValue !== undefined || orientation !== undefined;

  if (!shouldPreserveLength) {
    let next: SketchEntitySnapshot = entity;

    if (startAnchor.coordinate) {
      next = setSketchPointTargetCoordinate(
        next,
        {
          entityId: entity.id,
          role: "start"
        },
        startAnchor.coordinate
      );
    }

    if (endAnchor.coordinate) {
      next = setSketchPointTargetCoordinate(
        next,
        {
          entityId: entity.id,
          role: "end"
        },
        endAnchor.coordinate
      );
    }

    return { ok: true, entity: next };
  }

  const currentLength = getLineLength(entity);
  const issueSource =
    override.dimension ?? lengthDimension ?? override.constraint ?? orientation;

  if (currentLength <= 0) {
    return {
      ok: false,
      issue: createLineAmbiguityApplyIssue(entity, issueSource)
    };
  }

  if (startAnchor.coordinate && endAnchor.coordinate) {
    return {
      ok: true,
      entity: {
        ...entity,
        start: cleanVec2(startAnchor.coordinate),
        end: cleanVec2(endAnchor.coordinate)
      }
    };
  }

  const length = cleanSketchNumber(lengthValue ?? currentLength);
  const direction = getLineSolveDirection(
    entity,
    orientation?.kind,
    startAnchor.coordinate ? "start" : endAnchor.coordinate ? "end" : undefined
  );

  if (startAnchor.coordinate) {
    return {
      ok: true,
      entity: {
        ...entity,
        start: cleanVec2(startAnchor.coordinate),
        end: cleanVec2([
          startAnchor.coordinate[0] + direction[0] * length,
          startAnchor.coordinate[1] + direction[1] * length
        ])
      }
    };
  }

  if (endAnchor.coordinate) {
    return {
      ok: true,
      entity: {
        ...entity,
        start: cleanVec2([
          endAnchor.coordinate[0] - direction[0] * length,
          endAnchor.coordinate[1] - direction[1] * length
        ]),
        end: cleanVec2(endAnchor.coordinate)
      }
    };
  }

  const center: Vec2 = [
    (entity.start[0] + entity.end[0]) / 2,
    (entity.start[1] + entity.end[1]) / 2
  ];
  const half = length / 2;

  return {
    ok: true,
    entity: {
      ...entity,
      start: cleanVec2([
        center[0] - direction[0] * half,
        center[1] - direction[1] * half
      ]),
      end: cleanVec2([
        center[0] + direction[0] * half,
        center[1] + direction[1] * half
      ])
    }
  };
}

function getLineLengthDimension(
  context: SketchSolverApplyContext,
  entityId: SketchEntityId,
  override?: SketchDimensionSnapshot
): SketchDimensionSnapshot | undefined {
  if (
    override &&
    override.entityId === entityId &&
    override.target.entityKind === "line" &&
    override.target.role === "length"
  ) {
    return override;
  }

  return [...context.document.sketchDimensions.values()].find(
    (dimension) =>
      dimension.sketchId === context.sketchId &&
      dimension.entityId === entityId &&
      dimension.target.entityKind === "line" &&
      dimension.target.role === "length"
  );
}

function getLineOrientationConstraint(
  context: SketchSolverApplyContext,
  entityId: SketchEntityId,
  override?: SketchConstraintSnapshot
):
  | Extract<
      SketchConstraintSnapshot,
      { readonly kind: "horizontal" | "vertical" }
    >
  | undefined {
  if (
    override &&
    override.entityId === entityId &&
    (override.kind === "horizontal" || override.kind === "vertical")
  ) {
    return override;
  }

  return [...context.document.sketchConstraints.values()].find(
    (
      constraint
    ): constraint is Extract<
      SketchConstraintSnapshot,
      { readonly kind: "horizontal" | "vertical" }
    > =>
      constraint.sketchId === context.sketchId &&
      constraint.entityId === entityId &&
      (constraint.kind === "horizontal" || constraint.kind === "vertical")
  );
}

function resolveSketchDimensionEffectiveValue(
  document: SketchSolverDocument,
  dimension: SketchDimensionSnapshot
): number | undefined {
  if (dimension.valueSource.type === "literal") {
    return isPositiveFiniteNumber(dimension.valueSource.value)
      ? cleanSketchNumber(dimension.valueSource.value)
      : undefined;
  }

  const parameter = document.parameters.get(dimension.valueSource.parameterId);

  return parameter && isPositiveFiniteNumber(parameter.value)
    ? cleanSketchNumber(parameter.value)
    : undefined;
}

function resolveLineEndpointAnchor(
  context: SketchSolverApplyContext,
  entity: Extract<SketchEntitySnapshot, { readonly kind: "line" }>,
  role: "start" | "end"
):
  | { readonly ok: true; readonly coordinate?: Vec2 }
  | { readonly ok: false; readonly issue: SketchSolverApplyIssue } {
  const target: SketchPointTarget = { entityId: entity.id, role };
  let coordinate: Vec2 | undefined;

  for (const constraint of context.document.sketchConstraints.values()) {
    if (constraint.sketchId !== context.sketchId) {
      continue;
    }

    if (constraint.kind !== "fixed" && constraint.kind !== "coincident") {
      continue;
    }

    if (
      constraint.kind === "fixed" &&
      sketchPointTargetsEqual(constraint.target, target)
    ) {
      coordinate = constraint.coordinate;
      continue;
    }

    if (constraint.kind !== "coincident") {
      continue;
    }

    const isPrimary = sketchPointTargetsEqual(constraint.primaryTarget, target);
    const isSecondary = sketchPointTargetsEqual(
      constraint.secondaryTarget,
      target
    );

    if (!isPrimary && !isSecondary) {
      continue;
    }

    const primaryFixed = findFixedConstraintCoordinate(
      context.document,
      constraint.sketchId,
      constraint.primaryTarget
    );
    const secondaryFixed = findFixedConstraintCoordinate(
      context.document,
      constraint.sketchId,
      constraint.secondaryTarget
    );

    if (
      primaryFixed &&
      secondaryFixed &&
      !vec2Equal(primaryFixed.coordinate, secondaryFixed.coordinate)
    ) {
      return {
        ok: false,
        issue: {
          kind: "constraint",
          code: "INVALID_SKETCH_CONSTRAINT",
          message:
            "Coincident sketch constraint cannot satisfy two different fixed coordinates.",
          sketchId: constraint.sketchId,
          sketchEntityId: entity.id,
          sketchConstraintId: constraint.id,
          pathField: isPrimary ? "primaryTarget" : "secondaryTarget",
          expected: formatVec2(primaryFixed.coordinate),
          received: formatVec2(secondaryFixed.coordinate)
        }
      };
    }

    const nextCoordinate = isPrimary
      ? secondaryFixed?.coordinate
      : (primaryFixed?.coordinate ??
        getSketchPointTargetCoordinateFromEntities(
          context.entities,
          constraint.primaryTarget
        ));

    if (!nextCoordinate) {
      continue;
    }

    if (coordinate && !vec2Equal(coordinate, nextCoordinate)) {
      return {
        ok: false,
        issue: {
          kind: "constraint",
          code: "INVALID_SKETCH_CONSTRAINT",
          message:
            "Line endpoint has conflicting fixed/coincident anchor coordinates.",
          sketchId: constraint.sketchId,
          sketchEntityId: entity.id,
          sketchConstraintId: constraint.id,
          pathField: isPrimary ? "primaryTarget" : "secondaryTarget",
          expected: formatVec2(coordinate),
          received: formatVec2(nextCoordinate)
        }
      };
    }

    coordinate = nextCoordinate;
  }

  return coordinate
    ? { ok: true, coordinate: cleanVec2(coordinate) }
    : { ok: true };
}

function getSketchPointTargetCoordinateFromEntities(
  entities: ReadonlyMap<SketchEntityId, SketchEntitySnapshot>,
  target: SketchPointTarget
): Vec2 | undefined {
  const entity = entities.get(target.entityId);

  if (!entity || !isSketchPointTargetSupported(entity, target)) {
    return undefined;
  }

  return getSketchPointTargetCoordinate(entity, target);
}

function getLineSolveDirection(
  entity: Extract<SketchEntitySnapshot, { readonly kind: "line" }>,
  orientation: "horizontal" | "vertical" | undefined,
  anchoredRole: "start" | "end" | undefined
): Vec2 {
  if (orientation === "horizontal") {
    const sign =
      anchoredRole === "end"
        ? entity.start[0] <= entity.end[0]
          ? 1
          : -1
        : entity.end[0] >= entity.start[0]
          ? 1
          : -1;

    return [sign, 0];
  }

  if (orientation === "vertical") {
    const sign =
      anchoredRole === "end"
        ? entity.start[1] <= entity.end[1]
          ? 1
          : -1
        : entity.end[1] >= entity.start[1]
          ? 1
          : -1;

    return [0, sign];
  }

  const currentLength = getLineLength(entity);

  return [
    (entity.end[0] - entity.start[0]) / currentLength,
    (entity.end[1] - entity.start[1]) / currentLength
  ];
}

function createLineAmbiguityApplyIssue(
  entity: Extract<SketchEntitySnapshot, { readonly kind: "line" }>,
  source: SketchDimensionSnapshot | SketchConstraintSnapshot | undefined
): SketchSolverApplyIssue {
  if (!source || "valueSource" in source) {
    const dimension = source as SketchDimensionSnapshot | undefined;

    return {
      kind: "dimension",
      code: "INVALID_SKETCH_DIMENSION",
      message:
        "Line length dimension cannot update a zero-length line because the direction is ambiguous.",
      sketchId: dimension?.sketchId ?? "unknown",
      sketchEntityId: entity.id,
      sketchDimensionId: dimension?.id,
      pathField: "target",
      expected: "line with a non-zero direction",
      received: "zero-length line"
    };
  }

  return {
    kind: "constraint",
    code: "INVALID_SKETCH_CONSTRAINT",
    message:
      "Line orientation constraint cannot update a zero-length line because the orientation is ambiguous.",
    sketchId: source.sketchId,
    sketchEntityId: entity.id,
    sketchConstraintId: source.id,
    pathField: "entityId",
    expected: "line with a non-zero direction",
    received: "zero-length line"
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

function applyCoincidentSketchConstraintValue(
  entities: ReadonlyMap<SketchEntityId, SketchEntitySnapshot>,
  document: SketchSolverDocument,
  constraint: Extract<SketchConstraintSnapshot, { readonly kind: "coincident" }>
): SketchSolverEntitiesResult {
  const primaryEntity = entities.get(constraint.primaryTarget.entityId);
  const secondaryEntity = entities.get(constraint.secondaryTarget.entityId);

  if (!primaryEntity) {
    return {
      ok: false,
      issue: {
        kind: "constraint",
        code: "INVALID_SKETCH_CONSTRAINT",
        message: `Sketch entity does not exist: ${constraint.primaryTarget.entityId}`,
        sketchId: constraint.sketchId,
        sketchEntityId: constraint.primaryTarget.entityId,
        sketchConstraintId: constraint.id,
        pathField: "primaryTarget.entityId",
        expected: "existing sketch entity id",
        received: constraint.primaryTarget.entityId
      }
    };
  }

  if (!secondaryEntity) {
    return {
      ok: false,
      issue: {
        kind: "constraint",
        code: "INVALID_SKETCH_CONSTRAINT",
        message: `Sketch entity does not exist: ${constraint.secondaryTarget.entityId}`,
        sketchId: constraint.sketchId,
        sketchEntityId: constraint.secondaryTarget.entityId,
        sketchConstraintId: constraint.id,
        pathField: "secondaryTarget.entityId",
        expected: "existing sketch entity id",
        received: constraint.secondaryTarget.entityId
      }
    };
  }

  if (!isSketchPointTargetSupported(primaryEntity, constraint.primaryTarget)) {
    return {
      ok: false,
      issue: {
        kind: "constraint",
        code: "INVALID_SKETCH_CONSTRAINT",
        message:
          "Coincident sketch constraint primary target role is not supported for this entity.",
        sketchId: constraint.sketchId,
        sketchEntityId: constraint.primaryTarget.entityId,
        sketchConstraintId: constraint.id,
        pathField: "primaryTarget.role",
        expected: `point target for ${primaryEntity.kind}`,
        received: constraint.primaryTarget.role
      }
    };
  }

  if (
    !isSketchPointTargetSupported(secondaryEntity, constraint.secondaryTarget)
  ) {
    return {
      ok: false,
      issue: {
        kind: "constraint",
        code: "INVALID_SKETCH_CONSTRAINT",
        message:
          "Coincident sketch constraint secondary target role is not supported for this entity.",
        sketchId: constraint.sketchId,
        sketchEntityId: constraint.secondaryTarget.entityId,
        sketchConstraintId: constraint.id,
        pathField: "secondaryTarget.role",
        expected: `point target for ${secondaryEntity.kind}`,
        received: constraint.secondaryTarget.role
      }
    };
  }

  const primaryFixed = findFixedConstraintCoordinate(
    document,
    constraint.sketchId,
    constraint.primaryTarget
  );
  const secondaryFixed = findFixedConstraintCoordinate(
    document,
    constraint.sketchId,
    constraint.secondaryTarget
  );

  if (
    primaryFixed &&
    secondaryFixed &&
    !vec2Equal(primaryFixed.coordinate, secondaryFixed.coordinate)
  ) {
    return {
      ok: false,
      issue: {
        kind: "constraint",
        code: "INVALID_SKETCH_CONSTRAINT",
        message:
          "Coincident sketch constraint cannot satisfy two different fixed coordinates.",
        sketchId: constraint.sketchId,
        sketchEntityId: constraint.entityId,
        sketchConstraintId: constraint.id,
        pathField: "secondaryTarget",
        expected: formatVec2(primaryFixed.coordinate),
        received: formatVec2(secondaryFixed.coordinate)
      }
    };
  }

  if (primaryFixed && secondaryFixed) {
    return { ok: true, entities: new Map() };
  }

  const target = primaryFixed
    ? constraint.secondaryTarget
    : secondaryFixed
      ? constraint.primaryTarget
      : constraint.secondaryTarget;
  const coordinate =
    primaryFixed?.coordinate ??
    secondaryFixed?.coordinate ??
    getSketchPointTargetCoordinate(primaryEntity, constraint.primaryTarget);
  const targetEntity =
    target.entityId === primaryEntity.id ? primaryEntity : secondaryEntity;
  const next = setSketchPointTargetCoordinate(targetEntity, target, coordinate);

  return { ok: true, entities: new Map([[next.id, next]]) };
}

function applyMidpointSketchConstraintValue(
  entities: ReadonlyMap<SketchEntityId, SketchEntitySnapshot>,
  document: SketchSolverDocument,
  constraint: Extract<SketchConstraintSnapshot, { readonly kind: "midpoint" }>
): SketchSolverEntitiesResult {
  const lineEntity = entities.get(constraint.lineEntityId);
  const targetEntity = entities.get(constraint.target.entityId);

  if (!lineEntity) {
    return {
      ok: false,
      issue: {
        kind: "constraint",
        code: "INVALID_SKETCH_CONSTRAINT",
        message: `Sketch entity does not exist: ${constraint.lineEntityId}`,
        sketchId: constraint.sketchId,
        sketchEntityId: constraint.lineEntityId,
        sketchConstraintId: constraint.id,
        pathField: "lineEntityId",
        expected: "existing line sketch entity id",
        received: constraint.lineEntityId
      }
    };
  }

  if (!targetEntity) {
    return {
      ok: false,
      issue: {
        kind: "constraint",
        code: "INVALID_SKETCH_CONSTRAINT",
        message: `Sketch entity does not exist: ${constraint.target.entityId}`,
        sketchId: constraint.sketchId,
        sketchEntityId: constraint.target.entityId,
        sketchConstraintId: constraint.id,
        pathField: "target.entityId",
        expected: "existing sketch point target entity id",
        received: constraint.target.entityId
      }
    };
  }

  if (lineEntity.kind !== "line") {
    return {
      ok: false,
      issue: {
        kind: "constraint",
        code: "INVALID_SKETCH_CONSTRAINT",
        message: "Midpoint sketch constraint line target is not a line entity.",
        sketchId: constraint.sketchId,
        sketchEntityId: constraint.lineEntityId,
        sketchConstraintId: constraint.id,
        pathField: "lineEntityId",
        expected: "line entity",
        received: lineEntity.kind
      }
    };
  }

  if (!isMidpointSketchPointTargetSupported(targetEntity, constraint.target)) {
    return {
      ok: false,
      issue: {
        kind: "constraint",
        code: "INVALID_SKETCH_CONSTRAINT",
        message:
          "Midpoint sketch constraint target role is not supported for this entity.",
        sketchId: constraint.sketchId,
        sketchEntityId: constraint.target.entityId,
        sketchConstraintId: constraint.id,
        pathField: "target.role",
        expected: `point, rectangle center, or circle center target for ${targetEntity.kind}`,
        received: constraint.target.role
      }
    };
  }

  const midpoint = getLineMidpoint(lineEntity);
  const fixedTarget = findFixedConstraintCoordinatesForTarget(
    document,
    constraint.sketchId,
    constraint.target
  ).find((candidate) => !vec2Equal(candidate.coordinate, midpoint));

  if (fixedTarget) {
    return {
      ok: false,
      issue: {
        kind: "constraint",
        code: "INVALID_SKETCH_CONSTRAINT",
        message:
          "Midpoint sketch constraint cannot satisfy the target's fixed coordinate.",
        sketchId: constraint.sketchId,
        sketchEntityId: constraint.target.entityId,
        sketchConstraintId: constraint.id,
        pathField: "target",
        expected: formatVec2(fixedTarget.coordinate),
        received: formatVec2(midpoint)
      }
    };
  }

  const next = setSketchPointTargetCoordinate(
    targetEntity,
    constraint.target,
    midpoint
  );

  return { ok: true, entities: new Map([[next.id, next]]) };
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

function isMidpointSketchPointTargetSupported(
  entity: SketchEntitySnapshot,
  target: SketchPointTarget
): boolean {
  return (
    target.entityId === entity.id &&
    ((entity.kind === "point" && target.role === "position") ||
      ((entity.kind === "rectangle" || entity.kind === "circle") &&
        target.role === "center"))
  );
}

function getLineMidpoint(
  entity: Extract<SketchEntitySnapshot, { readonly kind: "line" }>
): Vec2 {
  return cleanVec2([
    (entity.start[0] + entity.end[0]) / 2,
    (entity.start[1] + entity.end[1]) / 2
  ]);
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

function sketchPointTargetPairKey(
  left: SketchPointTarget,
  right: SketchPointTarget
): string {
  return [sketchPointTargetKey(left), sketchPointTargetKey(right)]
    .sort()
    .join("\0");
}

function sketchPointTargetKey(target: SketchPointTarget): string {
  return `${target.entityId}\0${target.role}`;
}

function findFixedConstraintCoordinate(
  document: SketchSolverDocument,
  sketchId: SketchId,
  target: SketchPointTarget
): { readonly id: SketchConstraintId; readonly coordinate: Vec2 } | undefined {
  for (const constraint of document.sketchConstraints.values()) {
    if (
      constraint.kind === "fixed" &&
      constraint.sketchId === sketchId &&
      sketchPointTargetsEqual(constraint.target, target)
    ) {
      return {
        id: constraint.id,
        coordinate: cleanVec2(constraint.coordinate)
      };
    }
  }

  return undefined;
}

function findFixedConstraintCoordinatesForTarget(
  document: SketchSolverDocument,
  sketchId: SketchId,
  target: SketchPointTarget
): readonly { readonly id: SketchConstraintId; readonly coordinate: Vec2 }[] {
  const coordinates: {
    readonly id: SketchConstraintId;
    readonly coordinate: Vec2;
  }[] = [];
  const directFixed = findFixedConstraintCoordinate(document, sketchId, target);

  if (directFixed) {
    coordinates.push(directFixed);
  }

  for (const constraint of document.sketchConstraints.values()) {
    if (constraint.kind !== "coincident" || constraint.sketchId !== sketchId) {
      continue;
    }

    const otherTarget = sketchPointTargetsEqual(
      constraint.primaryTarget,
      target
    )
      ? constraint.secondaryTarget
      : sketchPointTargetsEqual(constraint.secondaryTarget, target)
        ? constraint.primaryTarget
        : undefined;

    if (!otherTarget) {
      continue;
    }

    const fixedOtherTarget = findFixedConstraintCoordinate(
      document,
      sketchId,
      otherTarget
    );

    if (fixedOtherTarget) {
      coordinates.push(fixedOtherTarget);
    }
  }

  return coordinates;
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

  if (constraint.kind === "coincident") {
    return {
      id: constraint.id,
      name: constraint.name,
      sketchId: constraint.sketchId,
      entityId: constraint.entityId,
      kind: "coincident",
      primaryTarget: { ...constraint.primaryTarget },
      secondaryTarget: { ...constraint.secondaryTarget }
    };
  }

  if (constraint.kind === "midpoint") {
    return {
      id: constraint.id,
      name: constraint.name,
      sketchId: constraint.sketchId,
      entityId: constraint.entityId,
      kind: "midpoint",
      lineEntityId: constraint.lineEntityId,
      target: { ...constraint.target }
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

function numbersEqual(left: number, right: number): boolean {
  return cleanSketchNumber(left) === cleanSketchNumber(right);
}

function formatVec2(value: Vec2): string {
  return `[${cleanSketchNumber(value[0])}, ${cleanSketchNumber(value[1])}]`;
}
