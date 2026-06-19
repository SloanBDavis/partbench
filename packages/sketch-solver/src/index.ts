export const SKETCH_SOLVER_MODEL_VERSION = "partbench.sketch-solver.v1";

export const sketchSolverPackage = {
  name: "@web-cad/sketch-solver",
  status: "foundation",
  modelVersion: SKETCH_SOLVER_MODEL_VERSION
} as const;

export type SketchSolverModelVersion = typeof SKETCH_SOLVER_MODEL_VERSION;

export type SketchSolverVec2 = readonly [number, number];

export type SketchSolverPointId = string;

export type SketchSolverScalarId = string;

export type SketchSolverConstraintId = string;

export type SketchSolverDimensionId = string;

export type SketchSolveStatus =
  | "not-run"
  | "converged"
  | "under-defined"
  | "over-defined"
  | "conflicting"
  | "failed"
  | "unsupported";

export type SketchSolveDiagnosticSeverity = "info" | "warning" | "blocker";

export type SketchSolveDiagnosticCode =
  | "SKETCH_SOLVER_MISSING_TARGET"
  | "SKETCH_SOLVER_UNSUPPORTED_CONSTRAINT"
  | "SKETCH_SOLVER_INVALID_VALUE"
  | "SKETCH_SOLVER_NON_CONVERGENCE"
  | "SKETCH_SOLVER_CONFLICTING"
  | "SKETCH_SOLVER_UNDER_DEFINED"
  | "SKETCH_SOLVER_OVER_DEFINED"
  | "SKETCH_SOLVER_REDUNDANT"
  | "SKETCH_SOLVER_NOT_RUN";

export type SketchSolveConstraintKind =
  | "fixedPoint"
  | "coincident"
  | "horizontal"
  | "vertical"
  | "midpoint"
  | "parallel"
  | "perpendicular"
  | SketchSolveDeferredConstraintKind;

export type SketchSolveDeferredConstraintKind =
  | "tangent"
  | "concentric"
  | "equalLength"
  | "equalRadius"
  | "angle"
  | "symmetry";

export type SketchSolveDimensionKind =
  | "pointDistance"
  | "lineLength"
  | "circleRadius";

export interface SketchSolvePointVariable {
  readonly id: SketchSolverPointId;
  readonly initial: SketchSolverVec2;
}

export interface SketchSolveScalarVariable {
  readonly id: SketchSolverScalarId;
  readonly initial: number;
}

export type SketchSolveConstraint =
  | SketchSolveFixedPointConstraint
  | SketchSolveCoincidentConstraint
  | SketchSolveHorizontalConstraint
  | SketchSolveVerticalConstraint
  | SketchSolveMidpointConstraint
  | SketchSolveParallelConstraint
  | SketchSolvePerpendicularConstraint
  | SketchSolveDeferredConstraint;

export interface SketchSolveFixedPointConstraint {
  readonly id: SketchSolverConstraintId;
  readonly kind: "fixedPoint";
  readonly pointId: SketchSolverPointId;
  readonly value: SketchSolverVec2;
}

export interface SketchSolveCoincidentConstraint {
  readonly id: SketchSolverConstraintId;
  readonly kind: "coincident";
  readonly pointAId: SketchSolverPointId;
  readonly pointBId: SketchSolverPointId;
}

export interface SketchSolveHorizontalConstraint {
  readonly id: SketchSolverConstraintId;
  readonly kind: "horizontal";
  readonly startPointId: SketchSolverPointId;
  readonly endPointId: SketchSolverPointId;
}

export interface SketchSolveVerticalConstraint {
  readonly id: SketchSolverConstraintId;
  readonly kind: "vertical";
  readonly startPointId: SketchSolverPointId;
  readonly endPointId: SketchSolverPointId;
}

export interface SketchSolveMidpointConstraint {
  readonly id: SketchSolverConstraintId;
  readonly kind: "midpoint";
  readonly midpointId: SketchSolverPointId;
  readonly startPointId: SketchSolverPointId;
  readonly endPointId: SketchSolverPointId;
}

export interface SketchSolveParallelConstraint {
  readonly id: SketchSolverConstraintId;
  readonly kind: "parallel";
  readonly primaryStartPointId: SketchSolverPointId;
  readonly primaryEndPointId: SketchSolverPointId;
  readonly secondaryStartPointId: SketchSolverPointId;
  readonly secondaryEndPointId: SketchSolverPointId;
}

export interface SketchSolvePerpendicularConstraint {
  readonly id: SketchSolverConstraintId;
  readonly kind: "perpendicular";
  readonly primaryStartPointId: SketchSolverPointId;
  readonly primaryEndPointId: SketchSolverPointId;
  readonly secondaryStartPointId: SketchSolverPointId;
  readonly secondaryEndPointId: SketchSolverPointId;
}

export interface SketchSolveDeferredConstraint {
  readonly id: SketchSolverConstraintId;
  readonly kind: SketchSolveDeferredConstraintKind;
  readonly targetIds?: readonly string[];
}

export type SketchSolveDimension =
  | SketchSolvePointDistanceDimension
  | SketchSolveLineLengthDimension
  | SketchSolveCircleRadiusDimension;

export interface SketchSolvePointDistanceDimension {
  readonly id: SketchSolverDimensionId;
  readonly kind: "pointDistance";
  readonly pointAId: SketchSolverPointId;
  readonly pointBId: SketchSolverPointId;
  readonly value: number;
}

export interface SketchSolveLineLengthDimension {
  readonly id: SketchSolverDimensionId;
  readonly kind: "lineLength";
  readonly startPointId: SketchSolverPointId;
  readonly endPointId: SketchSolverPointId;
  readonly value: number;
}

export interface SketchSolveCircleRadiusDimension {
  readonly id: SketchSolverDimensionId;
  readonly kind: "circleRadius";
  readonly radiusId: SketchSolverScalarId;
  readonly value: number;
}

export interface SketchSolveSettings {
  readonly tolerance: number;
  readonly maxIterations: number;
  readonly damping: number;
  readonly finiteDifferenceStep: number;
}

export interface SketchSolveModel {
  readonly version: SketchSolverModelVersion;
  readonly points: readonly SketchSolvePointVariable[];
  readonly scalars?: readonly SketchSolveScalarVariable[];
  readonly constraints?: readonly SketchSolveConstraint[];
  readonly dimensions?: readonly SketchSolveDimension[];
  readonly settings?: Partial<SketchSolveSettings>;
}

export interface SketchSolveDiagnostic {
  readonly code: SketchSolveDiagnosticCode;
  readonly severity: SketchSolveDiagnosticSeverity;
  readonly message: string;
  readonly sourceType?:
    | "model"
    | "point"
    | "scalar"
    | "constraint"
    | "dimension";
  readonly sourceId?: string;
  readonly targetId?: string;
  readonly constraintKind?: SketchSolveConstraintKind;
  readonly dimensionKind?: SketchSolveDimensionKind;
  readonly expected?: string;
  readonly received?: string;
}

export interface SketchSolvePointResult {
  readonly id: SketchSolverPointId;
  readonly value: SketchSolverVec2;
}

export interface SketchSolveScalarResult {
  readonly id: SketchSolverScalarId;
  readonly value: number;
}

export interface SketchSolveResult {
  readonly version: SketchSolverModelVersion;
  readonly status: SketchSolveStatus;
  readonly converged: boolean;
  readonly iterations: number;
  readonly variableCount: number;
  readonly residualCount: number;
  readonly degreesOfFreedomEstimate: number;
  readonly maxResidual: number;
  readonly rmsResidual: number;
  readonly settings: SketchSolveSettings;
  readonly points: readonly SketchSolvePointResult[];
  readonly scalars: readonly SketchSolveScalarResult[];
  readonly diagnosticCount: number;
  readonly diagnostics: readonly SketchSolveDiagnostic[];
}

interface SolverVariable {
  readonly id: string;
  readonly kind: "pointX" | "pointY" | "scalar";
  readonly sourceId: string;
  readonly initial: number;
}

type ResidualEvaluator = (state: readonly number[]) => readonly number[];

type SketchSolveLinePairConstraint =
  | SketchSolveParallelConstraint
  | SketchSolvePerpendicularConstraint;

interface ResidualBlock {
  readonly sourceType: "constraint" | "dimension";
  readonly sourceId: string;
  readonly evaluator: ResidualEvaluator;
}

interface SolverStateAccess {
  readonly variables: readonly SolverVariable[];
  readonly pointIndex: ReadonlyMap<SketchSolverPointId, number>;
  readonly scalarIndex: ReadonlyMap<SketchSolverScalarId, number>;
}

const DEFAULT_SETTINGS: SketchSolveSettings = {
  tolerance: 1e-7,
  maxIterations: 80,
  damping: 1e-6,
  finiteDifferenceStep: 1e-6
};

const DEFERRED_CONSTRAINT_KINDS = new Set<SketchSolveDeferredConstraintKind>([
  "tangent",
  "concentric",
  "equalLength",
  "equalRadius",
  "angle",
  "symmetry"
]);

export function createDefaultSketchSolveSettings(
  overrides: Partial<SketchSolveSettings> = {}
): SketchSolveSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...overrides
  };
}

export function getSketchSolverCapabilities(): {
  readonly modelVersion: SketchSolverModelVersion;
  readonly supportedConstraintKinds: readonly SketchSolveConstraintKind[];
  readonly supportedDimensionKinds: readonly SketchSolveDimensionKind[];
  readonly deferredConstraintKinds: readonly SketchSolveDeferredConstraintKind[];
} {
  return {
    modelVersion: SKETCH_SOLVER_MODEL_VERSION,
    supportedConstraintKinds: [
      "fixedPoint",
      "coincident",
      "horizontal",
      "vertical",
      "midpoint",
      "parallel",
      "perpendicular"
    ],
    supportedDimensionKinds: ["pointDistance", "lineLength", "circleRadius"],
    deferredConstraintKinds: [...DEFERRED_CONSTRAINT_KINDS]
  };
}

export function solveSketch(model: SketchSolveModel): SketchSolveResult {
  const settings = createDefaultSketchSolveSettings(model.settings);
  const stateAccess = createStateAccess(model);
  const initialState = stateAccess.variables.map(
    (variable) => variable.initial
  );
  const diagnostics = validateModel(model, settings, stateAccess);
  const blockingDiagnostics = diagnostics.filter(
    (diagnostic) => diagnostic.severity === "blocker"
  );
  const unsupportedDiagnostics = diagnostics.filter(
    (diagnostic) => diagnostic.code === "SKETCH_SOLVER_UNSUPPORTED_CONSTRAINT"
  );

  if (unsupportedDiagnostics.length > 0) {
    return createResult({
      model,
      settings,
      stateAccess,
      state: initialState,
      status: "unsupported",
      iterations: 0,
      diagnostics,
      residuals: []
    });
  }

  if (blockingDiagnostics.length > 0) {
    return createResult({
      model,
      settings,
      stateAccess,
      state: initialState,
      status: "failed",
      iterations: 0,
      diagnostics,
      residuals: []
    });
  }

  const residualBlocks = createResidualBlocks(model, stateAccess);
  const residualCount = getResiduals(residualBlocks, initialState).length;

  if (stateAccess.variables.length === 0) {
    return createResult({
      model,
      settings,
      stateAccess,
      state: initialState,
      status: residualCount === 0 ? "not-run" : "failed",
      iterations: 0,
      diagnostics:
        residualCount === 0
          ? [
              ...diagnostics,
              {
                code: "SKETCH_SOLVER_NOT_RUN",
                severity: "info",
                message:
                  "Solve did not run because the model has no variables.",
                sourceType: "model"
              }
            ]
          : diagnostics,
      residuals: []
    });
  }

  if (residualCount === 0) {
    return createResult({
      model,
      settings,
      stateAccess,
      state: initialState,
      status: "under-defined",
      iterations: 0,
      diagnostics: [
        ...diagnostics,
        {
          code: "SKETCH_SOLVER_UNDER_DEFINED",
          severity: "warning",
          message:
            "Solve model has variables but no supported constraints or dimensions.",
          sourceType: "model",
          expected: "at least one supported residual source",
          received: "0 residuals"
        }
      ],
      residuals: []
    });
  }

  const solve = runDampedSolve(initialState, residualBlocks, settings);
  const status = classifySolveStatus({
    converged: solve.converged,
    variableCount: stateAccess.variables.length,
    residualCount,
    maxResidual: solve.maxResidual,
    tolerance: settings.tolerance
  });
  const finalDiagnostics = [...diagnostics];

  if (status === "under-defined") {
    finalDiagnostics.push({
      code: "SKETCH_SOLVER_UNDER_DEFINED",
      severity: "warning",
      message:
        "Solve converged, but residual count is lower than variable count.",
      sourceType: "model",
      expected: `${stateAccess.variables.length} independent residual(s)`,
      received: `${residualCount} residual(s)`
    });
  }

  if (status === "over-defined") {
    finalDiagnostics.push({
      code: "SKETCH_SOLVER_OVER_DEFINED",
      severity: "warning",
      message:
        "Solve converged with more residuals than variables; redundant constraints or dimensions may exist.",
      sourceType: "model",
      expected: `at most ${stateAccess.variables.length} independent residual(s)`,
      received: `${residualCount} residual(s)`
    });
  }

  if (status === "conflicting") {
    finalDiagnostics.push({
      code: "SKETCH_SOLVER_CONFLICTING",
      severity: "blocker",
      message:
        "Solve did not converge and the model has more residuals than variables; constraints may conflict.",
      sourceType: "model",
      expected: `max residual <= ${settings.tolerance}`,
      received: String(cleanNumber(solve.maxResidual))
    });
  }

  if (status === "failed") {
    finalDiagnostics.push({
      code: "SKETCH_SOLVER_NON_CONVERGENCE",
      severity: "blocker",
      message: "Solve did not converge within the configured iteration limit.",
      sourceType: "model",
      expected: `max residual <= ${settings.tolerance}`,
      received: String(cleanNumber(solve.maxResidual))
    });
  }

  return createResult({
    model,
    settings,
    stateAccess,
    state: solve.state,
    status,
    iterations: solve.iterations,
    diagnostics: finalDiagnostics,
    residuals: solve.residuals
  });
}

function createStateAccess(model: SketchSolveModel): SolverStateAccess {
  const variables: SolverVariable[] = [];
  const pointIndex = new Map<SketchSolverPointId, number>();
  const scalarIndex = new Map<SketchSolverScalarId, number>();

  for (const point of model.points) {
    pointIndex.set(point.id, variables.length);
    variables.push({
      id: `${point.id}:x`,
      kind: "pointX",
      sourceId: point.id,
      initial: point.initial[0]
    });
    variables.push({
      id: `${point.id}:y`,
      kind: "pointY",
      sourceId: point.id,
      initial: point.initial[1]
    });
  }

  for (const scalar of model.scalars ?? []) {
    scalarIndex.set(scalar.id, variables.length);
    variables.push({
      id: scalar.id,
      kind: "scalar",
      sourceId: scalar.id,
      initial: scalar.initial
    });
  }

  return {
    variables,
    pointIndex,
    scalarIndex
  };
}

function validateModel(
  model: SketchSolveModel,
  settings: SketchSolveSettings,
  stateAccess: SolverStateAccess
): readonly SketchSolveDiagnostic[] {
  const diagnostics: SketchSolveDiagnostic[] = [];

  if (model.version !== SKETCH_SOLVER_MODEL_VERSION) {
    diagnostics.push({
      code: "SKETCH_SOLVER_INVALID_VALUE",
      severity: "blocker",
      message: "Unsupported sketch solve model version.",
      sourceType: "model",
      expected: SKETCH_SOLVER_MODEL_VERSION,
      received: model.version
    });
  }

  validateSettings(settings, diagnostics);
  validateVariables(model, diagnostics);

  for (const constraint of model.constraints ?? []) {
    validateConstraint(constraint, stateAccess, diagnostics);
  }

  for (const dimension of model.dimensions ?? []) {
    validateDimension(dimension, stateAccess, diagnostics);
  }

  return diagnostics;
}

function validateSettings(
  settings: SketchSolveSettings,
  diagnostics: SketchSolveDiagnostic[]
): void {
  for (const [field, value] of Object.entries(settings)) {
    if (!Number.isFinite(value) || value <= 0) {
      diagnostics.push({
        code: "SKETCH_SOLVER_INVALID_VALUE",
        severity: "blocker",
        message: `Sketch solver setting ${field} must be positive and finite.`,
        sourceType: "model",
        expected: "positive finite number",
        received: describeReceived(value)
      });
    }
  }
}

function validateVariables(
  model: SketchSolveModel,
  diagnostics: SketchSolveDiagnostic[]
): void {
  const pointIds = new Set<SketchSolverPointId>();
  const scalarIds = new Set<SketchSolverScalarId>();

  for (const point of model.points) {
    if (pointIds.has(point.id)) {
      diagnostics.push({
        code: "SKETCH_SOLVER_INVALID_VALUE",
        severity: "blocker",
        message: `Duplicate point variable id: ${point.id}`,
        sourceType: "point",
        sourceId: point.id,
        expected: "unique point id",
        received: point.id
      });
    }
    pointIds.add(point.id);

    if (!isFiniteVec2(point.initial)) {
      diagnostics.push({
        code: "SKETCH_SOLVER_INVALID_VALUE",
        severity: "blocker",
        message: "Point initial value must be finite.",
        sourceType: "point",
        sourceId: point.id,
        expected: "finite [x, y]",
        received: describeReceived(point.initial)
      });
    }
  }

  for (const scalar of model.scalars ?? []) {
    if (scalarIds.has(scalar.id)) {
      diagnostics.push({
        code: "SKETCH_SOLVER_INVALID_VALUE",
        severity: "blocker",
        message: `Duplicate scalar variable id: ${scalar.id}`,
        sourceType: "scalar",
        sourceId: scalar.id,
        expected: "unique scalar id",
        received: scalar.id
      });
    }
    scalarIds.add(scalar.id);

    if (!Number.isFinite(scalar.initial)) {
      diagnostics.push({
        code: "SKETCH_SOLVER_INVALID_VALUE",
        severity: "blocker",
        message: "Scalar initial value must be finite.",
        sourceType: "scalar",
        sourceId: scalar.id,
        expected: "finite number",
        received: describeReceived(scalar.initial)
      });
    }
  }
}

function validateConstraint(
  constraint: SketchSolveConstraint,
  stateAccess: SolverStateAccess,
  diagnostics: SketchSolveDiagnostic[]
): void {
  if (isDeferredConstraint(constraint)) {
    diagnostics.push({
      code: "SKETCH_SOLVER_UNSUPPORTED_CONSTRAINT",
      severity: "warning",
      message: `Constraint kind ${constraint.kind} is reserved by the V11 solver contract but not implemented in this foundation tranche.`,
      sourceType: "constraint",
      sourceId: constraint.id,
      constraintKind: constraint.kind,
      expected: "supported V11 foundation constraint",
      received: constraint.kind
    });
    return;
  }

  if (constraint.kind === "fixedPoint") {
    validatePointTarget(
      constraint.pointId,
      constraint,
      stateAccess,
      diagnostics
    );
    if (!isFiniteVec2(constraint.value)) {
      diagnostics.push({
        code: "SKETCH_SOLVER_INVALID_VALUE",
        severity: "blocker",
        message: "Fixed point constraint value must be finite.",
        sourceType: "constraint",
        sourceId: constraint.id,
        constraintKind: constraint.kind,
        expected: "finite [x, y]",
        received: describeReceived(constraint.value)
      });
    }
    return;
  }

  if (constraint.kind === "coincident") {
    validatePointTarget(
      constraint.pointAId,
      constraint,
      stateAccess,
      diagnostics
    );
    validatePointTarget(
      constraint.pointBId,
      constraint,
      stateAccess,
      diagnostics
    );
    return;
  }

  if (constraint.kind === "horizontal" || constraint.kind === "vertical") {
    validatePointTarget(
      constraint.startPointId,
      constraint,
      stateAccess,
      diagnostics
    );
    validatePointTarget(
      constraint.endPointId,
      constraint,
      stateAccess,
      diagnostics
    );
    return;
  }

  if (constraint.kind === "parallel" || constraint.kind === "perpendicular") {
    validateLinePairConstraint(constraint, stateAccess, diagnostics);
    return;
  }

  validatePointTarget(
    constraint.midpointId,
    constraint,
    stateAccess,
    diagnostics
  );
  validatePointTarget(
    constraint.startPointId,
    constraint,
    stateAccess,
    diagnostics
  );
  validatePointTarget(
    constraint.endPointId,
    constraint,
    stateAccess,
    diagnostics
  );
}

function validateLinePairConstraint(
  constraint: SketchSolveLinePairConstraint,
  stateAccess: SolverStateAccess,
  diagnostics: SketchSolveDiagnostic[]
): void {
  validatePointTarget(
    constraint.primaryStartPointId,
    constraint,
    stateAccess,
    diagnostics
  );
  validatePointTarget(
    constraint.primaryEndPointId,
    constraint,
    stateAccess,
    diagnostics
  );
  validatePointTarget(
    constraint.secondaryStartPointId,
    constraint,
    stateAccess,
    diagnostics
  );
  validatePointTarget(
    constraint.secondaryEndPointId,
    constraint,
    stateAccess,
    diagnostics
  );
  validateNonZeroLineTarget({
    constraint,
    stateAccess,
    diagnostics,
    startPointId: constraint.primaryStartPointId,
    endPointId: constraint.primaryEndPointId,
    label: "primary line"
  });
  validateNonZeroLineTarget({
    constraint,
    stateAccess,
    diagnostics,
    startPointId: constraint.secondaryStartPointId,
    endPointId: constraint.secondaryEndPointId,
    label: "secondary line"
  });
}

function validateNonZeroLineTarget({
  constraint,
  stateAccess,
  diagnostics,
  startPointId,
  endPointId,
  label
}: {
  readonly constraint: SketchSolveLinePairConstraint;
  readonly stateAccess: SolverStateAccess;
  readonly diagnostics: SketchSolveDiagnostic[];
  readonly startPointId: SketchSolverPointId;
  readonly endPointId: SketchSolverPointId;
  readonly label: string;
}): void {
  const start = readInitialPoint(stateAccess, startPointId);
  const end = readInitialPoint(stateAccess, endPointId);

  if (!start || !end) {
    return;
  }

  if (distance(start, end) <= 1e-12) {
    diagnostics.push({
      code: "SKETCH_SOLVER_INVALID_VALUE",
      severity: "blocker",
      message: `Parallel/perpendicular constraint ${label} must have non-zero length.`,
      sourceType: "constraint",
      sourceId: constraint.id,
      constraintKind: constraint.kind,
      targetId: `${startPointId}:${endPointId}`,
      expected: "non-zero line direction",
      received: "zero-length line"
    });
  }
}

function validateDimension(
  dimension: SketchSolveDimension,
  stateAccess: SolverStateAccess,
  diagnostics: SketchSolveDiagnostic[]
): void {
  if (!Number.isFinite(dimension.value) || dimension.value <= 0) {
    diagnostics.push({
      code: "SKETCH_SOLVER_INVALID_VALUE",
      severity: "blocker",
      message: "Driving dimension value must be positive and finite.",
      sourceType: "dimension",
      sourceId: dimension.id,
      dimensionKind: dimension.kind,
      expected: "positive finite number",
      received: describeReceived(dimension.value)
    });
  }

  if (dimension.kind === "circleRadius") {
    validateScalarTarget(
      dimension.radiusId,
      dimension,
      stateAccess,
      diagnostics
    );
    return;
  }

  if (dimension.kind === "pointDistance") {
    validatePointTarget(
      dimension.pointAId,
      dimension,
      stateAccess,
      diagnostics
    );
    validatePointTarget(
      dimension.pointBId,
      dimension,
      stateAccess,
      diagnostics
    );
    return;
  }

  validatePointTarget(
    dimension.startPointId,
    dimension,
    stateAccess,
    diagnostics
  );
  validatePointTarget(
    dimension.endPointId,
    dimension,
    stateAccess,
    diagnostics
  );
}

function validatePointTarget(
  pointId: SketchSolverPointId,
  source: SketchSolveConstraint | SketchSolveDimension,
  stateAccess: SolverStateAccess,
  diagnostics: SketchSolveDiagnostic[]
): void {
  if (!stateAccess.pointIndex.has(pointId)) {
    diagnostics.push({
      code: "SKETCH_SOLVER_MISSING_TARGET",
      severity: "blocker",
      message: `Sketch solve point target does not exist: ${pointId}`,
      sourceType: getSourceType(source),
      sourceId: source.id,
      targetId: pointId,
      ...(isConstraintSource(source) ? { constraintKind: source.kind } : {}),
      ...(isDimensionSource(source) ? { dimensionKind: source.kind } : {})
    });
  }
}

function validateScalarTarget(
  scalarId: SketchSolverScalarId,
  source: SketchSolveDimension,
  stateAccess: SolverStateAccess,
  diagnostics: SketchSolveDiagnostic[]
): void {
  if (!stateAccess.scalarIndex.has(scalarId)) {
    diagnostics.push({
      code: "SKETCH_SOLVER_MISSING_TARGET",
      severity: "blocker",
      message: `Sketch solve scalar target does not exist: ${scalarId}`,
      sourceType: "dimension",
      sourceId: source.id,
      targetId: scalarId,
      dimensionKind: source.kind
    });
  }
}

function createResidualBlocks(
  model: SketchSolveModel,
  stateAccess: SolverStateAccess
): readonly ResidualBlock[] {
  const blocks: ResidualBlock[] = [];

  for (const constraint of model.constraints ?? []) {
    if (isDeferredConstraint(constraint)) {
      continue;
    }
    blocks.push({
      sourceType: "constraint",
      sourceId: constraint.id,
      evaluator: createConstraintResidual(constraint, stateAccess)
    });
  }

  for (const dimension of model.dimensions ?? []) {
    blocks.push({
      sourceType: "dimension",
      sourceId: dimension.id,
      evaluator: createDimensionResidual(dimension, stateAccess)
    });
  }

  return blocks;
}

function createConstraintResidual(
  constraint: Exclude<SketchSolveConstraint, SketchSolveDeferredConstraint>,
  stateAccess: SolverStateAccess
): ResidualEvaluator {
  if (constraint.kind === "fixedPoint") {
    return (state) => {
      const point = readPoint(state, stateAccess, constraint.pointId);
      return [point[0] - constraint.value[0], point[1] - constraint.value[1]];
    };
  }

  if (constraint.kind === "coincident") {
    return (state) => {
      const pointA = readPoint(state, stateAccess, constraint.pointAId);
      const pointB = readPoint(state, stateAccess, constraint.pointBId);
      return [pointA[0] - pointB[0], pointA[1] - pointB[1]];
    };
  }

  if (constraint.kind === "horizontal") {
    return (state) => {
      const start = readPoint(state, stateAccess, constraint.startPointId);
      const end = readPoint(state, stateAccess, constraint.endPointId);
      return [end[1] - start[1]];
    };
  }

  if (constraint.kind === "vertical") {
    return (state) => {
      const start = readPoint(state, stateAccess, constraint.startPointId);
      const end = readPoint(state, stateAccess, constraint.endPointId);
      return [end[0] - start[0]];
    };
  }

  if (constraint.kind === "parallel" || constraint.kind === "perpendicular") {
    return createLinePairResidual(constraint, stateAccess);
  }

  return (state) => {
    const midpoint = readPoint(state, stateAccess, constraint.midpointId);
    const start = readPoint(state, stateAccess, constraint.startPointId);
    const end = readPoint(state, stateAccess, constraint.endPointId);
    return [
      midpoint[0] - (start[0] + end[0]) / 2,
      midpoint[1] - (start[1] + end[1]) / 2
    ];
  };
}

function createLinePairResidual(
  constraint: SketchSolveLinePairConstraint,
  stateAccess: SolverStateAccess
): ResidualEvaluator {
  return (state) => {
    const primaryDirection = readLineDirection(
      state,
      stateAccess,
      constraint.primaryStartPointId,
      constraint.primaryEndPointId
    );
    const secondaryDirection = readLineDirection(
      state,
      stateAccess,
      constraint.secondaryStartPointId,
      constraint.secondaryEndPointId
    );

    if (!primaryDirection || !secondaryDirection) {
      return [1];
    }

    if (constraint.kind === "parallel") {
      return [
        primaryDirection[0] * secondaryDirection[1] -
          primaryDirection[1] * secondaryDirection[0]
      ];
    }

    return [
      primaryDirection[0] * secondaryDirection[0] +
        primaryDirection[1] * secondaryDirection[1]
    ];
  };
}

function createDimensionResidual(
  dimension: SketchSolveDimension,
  stateAccess: SolverStateAccess
): ResidualEvaluator {
  if (dimension.kind === "circleRadius") {
    return (state) => [
      readScalar(state, stateAccess, dimension.radiusId) - dimension.value
    ];
  }

  if (dimension.kind === "pointDistance") {
    return (state) => {
      const pointA = readPoint(state, stateAccess, dimension.pointAId);
      const pointB = readPoint(state, stateAccess, dimension.pointBId);
      return [distance(pointA, pointB) - dimension.value];
    };
  }

  return (state) => {
    const start = readPoint(state, stateAccess, dimension.startPointId);
    const end = readPoint(state, stateAccess, dimension.endPointId);
    return [distance(start, end) - dimension.value];
  };
}

function runDampedSolve(
  initialState: readonly number[],
  residualBlocks: readonly ResidualBlock[],
  settings: SketchSolveSettings
): {
  readonly state: readonly number[];
  readonly iterations: number;
  readonly converged: boolean;
  readonly residuals: readonly number[];
  readonly maxResidual: number;
} {
  let state = [...initialState];
  let residuals = getResiduals(residualBlocks, state);
  let maxResidual = getMaxResidual(residuals);

  if (maxResidual <= settings.tolerance) {
    return {
      state,
      iterations: 0,
      converged: true,
      residuals,
      maxResidual
    };
  }

  for (let iteration = 1; iteration <= settings.maxIterations; iteration += 1) {
    const jacobian = finiteDifferenceJacobian(
      state,
      residualBlocks,
      residuals,
      settings.finiteDifferenceStep
    );
    const delta = solveDampedNormalEquations(
      jacobian,
      residuals,
      settings.damping
    );

    if (!delta) {
      return {
        state,
        iterations: iteration - 1,
        converged: false,
        residuals,
        maxResidual
      };
    }

    state = state.map((value, index) => value + delta[index]);
    residuals = getResiduals(residualBlocks, state);
    maxResidual = getMaxResidual(residuals);

    if (maxResidual <= settings.tolerance) {
      return {
        state,
        iterations: iteration,
        converged: true,
        residuals,
        maxResidual
      };
    }
  }

  return {
    state,
    iterations: settings.maxIterations,
    converged: false,
    residuals,
    maxResidual
  };
}

function finiteDifferenceJacobian(
  state: readonly number[],
  residualBlocks: readonly ResidualBlock[],
  residuals: readonly number[],
  step: number
): readonly (readonly number[])[] {
  const columns: number[][] = [];

  for (
    let variableIndex = 0;
    variableIndex < state.length;
    variableIndex += 1
  ) {
    const perturbed = [...state];
    perturbed[variableIndex] += step;
    const perturbedResiduals = getResiduals(residualBlocks, perturbed);
    columns.push(
      perturbedResiduals.map(
        (residual, residualIndex) =>
          (residual - residuals[residualIndex]) / step
      )
    );
  }

  return residuals.map((_, residualIndex) =>
    columns.map((column) => column[residualIndex])
  );
}

function solveDampedNormalEquations(
  jacobian: readonly (readonly number[])[],
  residuals: readonly number[],
  damping: number
): readonly number[] | undefined {
  const variableCount = jacobian[0]?.length ?? 0;
  const normal = Array.from({ length: variableCount }, () =>
    Array.from({ length: variableCount }, () => 0)
  );
  const rhs = Array.from({ length: variableCount }, () => 0);

  for (let row = 0; row < jacobian.length; row += 1) {
    for (let col = 0; col < variableCount; col += 1) {
      rhs[col] -= jacobian[row][col] * residuals[row];

      for (let otherCol = 0; otherCol < variableCount; otherCol += 1) {
        normal[col][otherCol] += jacobian[row][col] * jacobian[row][otherCol];
      }
    }
  }

  for (let diagonal = 0; diagonal < variableCount; diagonal += 1) {
    normal[diagonal][diagonal] += damping;
  }

  return solveLinearSystem(normal, rhs);
}

function solveLinearSystem(
  matrix: number[][],
  rhs: readonly number[]
): readonly number[] | undefined {
  const size = rhs.length;
  const augmented = matrix.map((row, index) => [...row, rhs[index]]);

  for (let pivot = 0; pivot < size; pivot += 1) {
    let pivotRow = pivot;
    let pivotAbs = Math.abs(augmented[pivot][pivot]);

    for (let row = pivot + 1; row < size; row += 1) {
      const candidateAbs = Math.abs(augmented[row][pivot]);
      if (candidateAbs > pivotAbs) {
        pivotAbs = candidateAbs;
        pivotRow = row;
      }
    }

    if (pivotAbs < 1e-14) {
      return undefined;
    }

    if (pivotRow !== pivot) {
      const temp = augmented[pivot];
      augmented[pivot] = augmented[pivotRow];
      augmented[pivotRow] = temp;
    }

    const pivotValue = augmented[pivot][pivot];
    for (let col = pivot; col <= size; col += 1) {
      augmented[pivot][col] /= pivotValue;
    }

    for (let row = 0; row < size; row += 1) {
      if (row === pivot) {
        continue;
      }
      const factor = augmented[row][pivot];
      for (let col = pivot; col <= size; col += 1) {
        augmented[row][col] -= factor * augmented[pivot][col];
      }
    }
  }

  return augmented.map((row) => row[size]);
}

function classifySolveStatus({
  converged,
  variableCount,
  residualCount
}: {
  readonly converged: boolean;
  readonly variableCount: number;
  readonly residualCount: number;
  readonly maxResidual: number;
  readonly tolerance: number;
}): SketchSolveStatus {
  if (!converged) {
    return residualCount > variableCount ? "conflicting" : "failed";
  }

  if (residualCount < variableCount) {
    return "under-defined";
  }

  if (residualCount > variableCount) {
    return "over-defined";
  }

  return "converged";
}

function createResult({
  model,
  settings,
  stateAccess,
  state,
  status,
  iterations,
  diagnostics,
  residuals
}: {
  readonly model: SketchSolveModel;
  readonly settings: SketchSolveSettings;
  readonly stateAccess: SolverStateAccess;
  readonly state: readonly number[];
  readonly status: SketchSolveStatus;
  readonly iterations: number;
  readonly diagnostics: readonly SketchSolveDiagnostic[];
  readonly residuals: readonly number[];
}): SketchSolveResult {
  const points = model.points.map((point) => {
    const index = stateAccess.pointIndex.get(point.id);
    return {
      id: point.id,
      value:
        index === undefined
          ? point.initial
          : ([
              cleanNumber(state[index]),
              cleanNumber(state[index + 1])
            ] as const)
    };
  });
  const scalars = (model.scalars ?? []).map((scalar) => {
    const index = stateAccess.scalarIndex.get(scalar.id);
    return {
      id: scalar.id,
      value: cleanNumber(index === undefined ? scalar.initial : state[index])
    };
  });
  const maxResidual = getMaxResidual(residuals);

  return {
    version: SKETCH_SOLVER_MODEL_VERSION,
    status,
    converged:
      status === "converged" ||
      status === "under-defined" ||
      status === "over-defined",
    iterations,
    variableCount: stateAccess.variables.length,
    residualCount: residuals.length,
    degreesOfFreedomEstimate: Math.max(
      0,
      stateAccess.variables.length - residuals.length
    ),
    maxResidual: cleanNumber(maxResidual),
    rmsResidual: cleanNumber(getRmsResidual(residuals)),
    settings,
    points,
    scalars,
    diagnosticCount: diagnostics.length,
    diagnostics
  };
}

function getResiduals(
  residualBlocks: readonly ResidualBlock[],
  state: readonly number[]
): readonly number[] {
  return residualBlocks.flatMap((block) => block.evaluator(state));
}

function readPoint(
  state: readonly number[],
  stateAccess: SolverStateAccess,
  pointId: SketchSolverPointId
): SketchSolverVec2 {
  const index = stateAccess.pointIndex.get(pointId);

  if (index === undefined) {
    return [Number.NaN, Number.NaN];
  }

  return [state[index], state[index + 1]];
}

function readInitialPoint(
  stateAccess: SolverStateAccess,
  pointId: SketchSolverPointId
): SketchSolverVec2 | undefined {
  const index = stateAccess.pointIndex.get(pointId);

  if (index === undefined) {
    return undefined;
  }

  const x = stateAccess.variables[index]?.initial;
  const y = stateAccess.variables[index + 1]?.initial;

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return undefined;
  }

  return [x, y];
}

function readLineDirection(
  state: readonly number[],
  stateAccess: SolverStateAccess,
  startPointId: SketchSolverPointId,
  endPointId: SketchSolverPointId
): SketchSolverVec2 | undefined {
  const start = readPoint(state, stateAccess, startPointId);
  const end = readPoint(state, stateAccess, endPointId);
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const length = Math.hypot(dx, dy);

  if (!Number.isFinite(length) || length <= 1e-12) {
    return undefined;
  }

  return [dx / length, dy / length];
}

function readScalar(
  state: readonly number[],
  stateAccess: SolverStateAccess,
  scalarId: SketchSolverScalarId
): number {
  const index = stateAccess.scalarIndex.get(scalarId);

  if (index === undefined) {
    return Number.NaN;
  }

  return state[index];
}

function getMaxResidual(residuals: readonly number[]): number {
  return residuals.reduce(
    (maxResidual, residual) => Math.max(maxResidual, Math.abs(residual)),
    0
  );
}

function getRmsResidual(residuals: readonly number[]): number {
  if (residuals.length === 0) {
    return 0;
  }

  const sumSquares = residuals.reduce(
    (sum, residual) => sum + residual * residual,
    0
  );
  return Math.sqrt(sumSquares / residuals.length);
}

function distance(a: SketchSolverVec2, b: SketchSolverVec2): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

function isFiniteVec2(value: unknown): value is SketchSolverVec2 {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1])
  );
}

function isDeferredConstraint(
  constraint: SketchSolveConstraint
): constraint is SketchSolveDeferredConstraint {
  return DEFERRED_CONSTRAINT_KINDS.has(
    constraint.kind as SketchSolveDeferredConstraintKind
  );
}

function isConstraintSource(
  source: SketchSolveConstraint | SketchSolveDimension
): source is SketchSolveConstraint {
  return "kind" in source && !isDimensionSource(source);
}

function isDimensionSource(
  source: SketchSolveConstraint | SketchSolveDimension
): source is SketchSolveDimension {
  return (
    source.kind === "pointDistance" ||
    source.kind === "lineLength" ||
    source.kind === "circleRadius"
  );
}

function getSourceType(
  source: SketchSolveConstraint | SketchSolveDimension
): "constraint" | "dimension" {
  return isDimensionSource(source) ? "dimension" : "constraint";
}

function cleanNumber(value: number): number {
  if (Object.is(value, -0)) {
    return 0;
  }

  return Math.abs(value) < 1e-12 ? 0 : Number(value.toPrecision(12));
}

function describeReceived(value: unknown): string {
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "non-finite number";
  }

  try {
    return JSON.stringify(value);
  } catch {
    return typeof value;
  }
}
