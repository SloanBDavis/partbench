export const SKETCH_SOLVER_MODEL_VERSION = "partbench.sketch-solver.v2";

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
  | "SKETCH_SOLVER_NOT_RUN"
  | "SKETCH_TANGENCY_OUTSIDE_ARC"
  | "SKETCH_ARC_SOLVE_BRANCH_INVALID"
  | "SKETCH_ARC_DIMENSION_INVALID";

export type SketchSolveConstraintKind =
  | "fixedPoint"
  | "coincident"
  | "horizontal"
  | "vertical"
  | "midpoint"
  | "parallel"
  | "perpendicular"
  | "concentric"
  | "equalRadius"
  | "equalLength"
  | "angle"
  | "tangent"
  | "symmetry"
  | SketchSolveDeferredConstraintKind;

export type SketchSolveDeferredConstraintKind = never;

export type SketchSolveDimensionKind =
  | "pointDistance"
  | "lineLength"
  | "circleRadius"
  | "arcRadius"
  | "arcSweep";

export interface SketchSolvePointVariable {
  readonly id: SketchSolverPointId;
  readonly initial: SketchSolverVec2;
}

export interface SketchSolveScalarVariable {
  readonly id: SketchSolverScalarId;
  readonly initial: number;
}

export interface SketchSolveArcVariable {
  readonly id: string;
  readonly initial: {
    readonly center: SketchSolverVec2;
    readonly radius: number;
    readonly startAngleDegrees: number;
    readonly sweepAngleDegrees: number;
  };
}

export type SketchSolvePointTarget =
  | { readonly kind: "point"; readonly pointId: SketchSolverPointId }
  | {
      readonly kind: "arc";
      readonly arcId: string;
      readonly role: "center" | "start" | "end";
    };

export interface SketchSolveLineCurveTarget {
  readonly kind: "line";
  readonly startPointId: SketchSolverPointId;
  readonly endPointId: SketchSolverPointId;
}

export interface SketchSolveCircleCurveTarget {
  readonly kind: "circle";
  readonly centerPointId: SketchSolverPointId;
  readonly radiusId: SketchSolverScalarId;
}

export interface SketchSolveArcCurveTarget {
  readonly kind: "arc";
  readonly arcId: string;
}

export type SketchSolveCurveTarget =
  | SketchSolveLineCurveTarget
  | SketchSolveCircleCurveTarget
  | SketchSolveArcCurveTarget;

export type SketchSolveRadiusCurveTarget =
  | SketchSolveCircleCurveTarget
  | SketchSolveArcCurveTarget;

export type SketchSolveConstraint =
  | SketchSolveFixedPointConstraint
  | SketchSolveCoincidentConstraint
  | SketchSolveHorizontalConstraint
  | SketchSolveVerticalConstraint
  | SketchSolveMidpointConstraint
  | SketchSolveParallelConstraint
  | SketchSolvePerpendicularConstraint
  | SketchSolveConcentricConstraint
  | SketchSolveEqualRadiusConstraint
  | SketchSolveEqualLengthConstraint
  | SketchSolveAngleConstraint
  | SketchSolveTangentConstraint
  | SketchSolveSymmetryConstraint
  | SketchSolveFixedTargetConstraint
  | SketchSolveCoincidentTargetConstraint
  | SketchSolveConcentricTargetConstraint
  | SketchSolveEqualRadiusTargetConstraint
  | SketchSolveTangentTargetConstraint
  | SketchSolveSymmetryTargetConstraint
  | SketchSolveDeferredConstraint;

export interface SketchSolveFixedTargetConstraint {
  readonly id: SketchSolverConstraintId;
  readonly kind: "fixedPoint";
  readonly target: SketchSolvePointTarget;
  readonly value: SketchSolverVec2;
}

export interface SketchSolveCoincidentTargetConstraint {
  readonly id: SketchSolverConstraintId;
  readonly kind: "coincident";
  readonly primaryTarget: SketchSolvePointTarget;
  readonly secondaryTarget: SketchSolvePointTarget;
}

export interface SketchSolveConcentricTargetConstraint {
  readonly id: SketchSolverConstraintId;
  readonly kind: "concentric";
  readonly primaryTarget: SketchSolveRadiusCurveTarget;
  readonly secondaryTarget: SketchSolveRadiusCurveTarget;
}

export interface SketchSolveEqualRadiusTargetConstraint {
  readonly id: SketchSolverConstraintId;
  readonly kind: "equalRadius";
  readonly primaryTarget: SketchSolveRadiusCurveTarget;
  readonly secondaryTarget: SketchSolveRadiusCurveTarget;
}

export interface SketchSolveTangentTargetConstraint {
  readonly id: SketchSolverConstraintId;
  readonly kind: "tangent";
  readonly primaryTarget: SketchSolveCurveTarget;
  readonly secondaryTarget: SketchSolveCurveTarget;
}

export interface SketchSolveSymmetryTargetConstraint {
  readonly id: SketchSolverConstraintId;
  readonly kind: "symmetry";
  readonly primaryTarget: SketchSolvePointTarget;
  readonly secondaryTarget: SketchSolvePointTarget;
  readonly axisTarget: SketchSolveLineCurveTarget;
}

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

export interface SketchSolveConcentricConstraint {
  readonly id: SketchSolverConstraintId;
  readonly kind: "concentric";
  readonly primaryCenterPointId: SketchSolverPointId;
  readonly secondaryCenterPointId: SketchSolverPointId;
}

export interface SketchSolveEqualRadiusConstraint {
  readonly id: SketchSolverConstraintId;
  readonly kind: "equalRadius";
  readonly primaryRadiusId: SketchSolverScalarId;
  readonly secondaryRadiusId: SketchSolverScalarId;
}

export interface SketchSolveEqualLengthConstraint {
  readonly id: SketchSolverConstraintId;
  readonly kind: "equalLength";
  readonly primaryStartPointId: SketchSolverPointId;
  readonly primaryEndPointId: SketchSolverPointId;
  readonly secondaryStartPointId: SketchSolverPointId;
  readonly secondaryEndPointId: SketchSolverPointId;
}

export interface SketchSolveAngleConstraint {
  readonly id: SketchSolverConstraintId;
  readonly kind: "angle";
  readonly primaryStartPointId: SketchSolverPointId;
  readonly primaryEndPointId: SketchSolverPointId;
  readonly secondaryStartPointId: SketchSolverPointId;
  readonly secondaryEndPointId: SketchSolverPointId;
  readonly angleDegrees: number;
}

export interface SketchSolveTangentConstraint {
  readonly id: SketchSolverConstraintId;
  readonly kind: "tangent";
  readonly lineStartPointId: SketchSolverPointId;
  readonly lineEndPointId: SketchSolverPointId;
  readonly circleCenterPointId: SketchSolverPointId;
  readonly circleRadiusId: SketchSolverScalarId;
}

export interface SketchSolveSymmetryConstraint {
  readonly id: SketchSolverConstraintId;
  readonly kind: "symmetry";
  readonly primaryPointId: SketchSolverPointId;
  readonly secondaryPointId: SketchSolverPointId;
  readonly lineStartPointId: SketchSolverPointId;
  readonly lineEndPointId: SketchSolverPointId;
}

export interface SketchSolveDeferredConstraint {
  readonly id: SketchSolverConstraintId;
  readonly kind: SketchSolveDeferredConstraintKind;
  readonly targetIds?: readonly string[];
}

export type SketchSolveDimension =
  | SketchSolvePointDistanceDimension
  | SketchSolveLineLengthDimension
  | SketchSolveCircleRadiusDimension
  | SketchSolveArcRadiusDimension
  | SketchSolveArcSweepDimension;

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

export interface SketchSolveArcRadiusDimension {
  readonly id: SketchSolverDimensionId;
  readonly kind: "arcRadius";
  readonly arcId: string;
  readonly value: number;
}

export interface SketchSolveArcSweepDimension {
  readonly id: SketchSolverDimensionId;
  readonly kind: "arcSweep";
  readonly arcId: string;
  /** Positive magnitude in degrees; the authored arc sign is preserved. */
  readonly value: number;
}

export interface SketchSolveSettings {
  readonly tolerance: number;
  readonly angularToleranceDegrees: number;
  readonly maxIterations: number;
  readonly damping: number;
  readonly finiteDifferenceStep: number;
}

export interface SketchSolveModel {
  readonly version: SketchSolverModelVersion;
  readonly points: readonly SketchSolvePointVariable[];
  readonly scalars?: readonly SketchSolveScalarVariable[];
  readonly arcs?: readonly SketchSolveArcVariable[];
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

export interface SketchSolveArcResult {
  readonly id: string;
  readonly center: SketchSolverVec2;
  readonly radius: number;
  readonly startAngleDegrees: number;
  readonly sweepAngleDegrees: number;
  readonly start: SketchSolverVec2;
  readonly end: SketchSolverVec2;
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
  readonly arcs: readonly SketchSolveArcResult[];
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
  | SketchSolvePerpendicularConstraint
  | SketchSolveEqualLengthConstraint
  | SketchSolveAngleConstraint;

type SketchSolveLineTargetConstraint =
  | SketchSolveLinePairConstraint
  | SketchSolveTangentConstraint
  | SketchSolveSymmetryConstraint;

interface ResidualBlock {
  readonly sourceType: "constraint" | "dimension";
  readonly sourceId: string;
  readonly constraintKind?: SketchSolveConstraintKind;
  readonly dimensionKind?: SketchSolveDimensionKind;
  readonly evaluator: ResidualEvaluator;
}

interface SolverStateAccess {
  readonly variables: readonly SolverVariable[];
  readonly pointIndex: ReadonlyMap<SketchSolverPointId, number>;
  readonly scalarIndex: ReadonlyMap<SketchSolverScalarId, number>;
  readonly arcIndex: ReadonlyMap<string, number>;
}

const DEFAULT_SETTINGS: SketchSolveSettings = {
  tolerance: 1e-7,
  angularToleranceDegrees: 0.1,
  maxIterations: 80,
  damping: 1e-6,
  finiteDifferenceStep: 1e-6
};

const DEFERRED_CONSTRAINT_KINDS = new Set<SketchSolveDeferredConstraintKind>();

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
      "perpendicular",
      "concentric",
      "equalRadius",
      "equalLength",
      "angle",
      "tangent",
      "symmetry"
    ],
    supportedDimensionKinds: [
      "pointDistance",
      "lineLength",
      "circleRadius",
      "arcRadius",
      "arcSweep"
    ],
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

  const residualBlocks = createResidualBlocks(model, stateAccess, settings);
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

  const solve = runDampedSolve(
    initialState,
    residualBlocks,
    settings,
    (candidate) =>
      arcStateStaysWithinAuthoredBranch(model, stateAccess, candidate, settings)
  );
  const solvedStateDiagnostics = [
    ...validateSolvedState(model, settings, stateAccess, solve.state),
    ...(!solve.converged && solve.stateGuardConstrained
      ? [
          {
            code: "SKETCH_ARC_SOLVE_BRANCH_INVALID" as const,
            severity: "blocker" as const,
            message:
              "Arc solve cannot satisfy the residual system without leaving the authored radius/sweep branch.",
            sourceType: "model" as const,
            expected: "positive radius and authored bounded sweep sign",
            received: "iteration step crossed an authored arc bound"
          }
        ]
      : [])
  ];
  if (solvedStateDiagnostics.length > 0) {
    const revertedResiduals = getResiduals(residualBlocks, initialState);
    const revertedAnalysis = analyzeResidualSystem(
      initialState,
      residualBlocks,
      revertedResiduals,
      settings
    );
    return createResult({
      model,
      settings,
      stateAccess,
      state: initialState,
      status: "failed",
      iterations: solve.iterations,
      diagnostics: [...diagnostics, ...solvedStateDiagnostics],
      residuals: revertedResiduals,
      independentResidualCount: revertedAnalysis.jacobianRank
    });
  }
  const analysis = analyzeResidualSystem(
    solve.state,
    residualBlocks,
    solve.residuals,
    settings
  );
  const status = classifySolveStatus({
    converged: solve.converged,
    variableCount: stateAccess.variables.length,
    residualCount,
    jacobianRank: analysis.jacobianRank,
    augmentedRank: analysis.augmentedRank
  });
  const finalDiagnostics = [...diagnostics];

  if (status === "under-defined") {
    finalDiagnostics.push({
      code: "SKETCH_SOLVER_UNDER_DEFINED",
      severity: "warning",
      message:
        "Solve converged, but the independent residual rank is lower than the variable count.",
      sourceType: "model",
      expected: `${stateAccess.variables.length} independent residual(s)`,
      received: `${analysis.jacobianRank} independent residual(s) from ${residualCount} residual value(s)`
    });
  }

  if (status === "over-defined") {
    finalDiagnostics.push({
      code: "SKETCH_SOLVER_OVER_DEFINED",
      severity: "warning",
      message:
        "Solve converged with redundant residuals beyond the independent Jacobian rank.",
      sourceType: "model",
      expected: `at most ${analysis.jacobianRank} residual value(s) for ${analysis.jacobianRank} independent equation(s)`,
      received: `${residualCount} residual value(s)`
    });
  }

  if (status === "conflicting") {
    finalDiagnostics.push(
      {
        code: "SKETCH_SOLVER_CONFLICTING",
        severity: "blocker",
        message:
          "Solve residuals are inconsistent with the independent Jacobian equations.",
        sourceType: "model",
        expected: `augmented rank ${analysis.jacobianRank}`,
        received: `augmented rank ${analysis.augmentedRank}; max residual ${cleanNumber(solve.maxResidual)}`
      },
      ...createConflictEvidenceDiagnostics(
        residualBlocks,
        solve.state,
        settings.tolerance
      )
    );
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
    residuals: solve.residuals,
    independentResidualCount: analysis.jacobianRank
  });
}

function createConflictEvidenceDiagnostics(
  residualBlocks: readonly ResidualBlock[],
  state: readonly number[],
  tolerance: number
): readonly SketchSolveDiagnostic[] {
  return residualBlocks.flatMap((block) => {
    const maxResidual = getMaxResidual(block.evaluator(state));
    if (maxResidual <= tolerance) return [];
    return [
      {
        code: "SKETCH_SOLVER_CONFLICTING" as const,
        severity: "blocker" as const,
        message: "Residual source remains inconsistent at the solve minimum.",
        sourceType: block.sourceType,
        sourceId: block.sourceId,
        constraintKind: block.constraintKind,
        dimensionKind: block.dimensionKind,
        expected: `block max residual <= ${tolerance}`,
        received: String(cleanNumber(maxResidual))
      }
    ];
  });
}

function createStateAccess(model: SketchSolveModel): SolverStateAccess {
  const variables: SolverVariable[] = [];
  const pointIndex = new Map<SketchSolverPointId, number>();
  const scalarIndex = new Map<SketchSolverScalarId, number>();
  const arcIndex = new Map<string, number>();

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

  for (const arc of model.arcs ?? []) {
    arcIndex.set(arc.id, variables.length);
    variables.push(
      {
        id: `${arc.id}:centerX`,
        kind: "pointX",
        sourceId: arc.id,
        initial: arc.initial.center[0]
      },
      {
        id: `${arc.id}:centerY`,
        kind: "pointY",
        sourceId: arc.id,
        initial: arc.initial.center[1]
      },
      {
        id: `${arc.id}:radius`,
        kind: "scalar",
        sourceId: arc.id,
        initial: arc.initial.radius
      },
      {
        id: `${arc.id}:startAngleDegrees`,
        kind: "scalar",
        sourceId: arc.id,
        initial: arc.initial.startAngleDegrees
      },
      {
        id: `${arc.id}:sweepAngleDegrees`,
        kind: "scalar",
        sourceId: arc.id,
        initial: arc.initial.sweepAngleDegrees
      }
    );
  }

  return {
    variables,
    pointIndex,
    scalarIndex,
    arcIndex
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
  validateVariables(model, settings, diagnostics);

  for (const constraint of model.constraints ?? []) {
    validateConstraint(constraint, settings, stateAccess, diagnostics);
  }

  for (const dimension of model.dimensions ?? []) {
    validateDimension(dimension, settings, stateAccess, diagnostics);
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
  settings: SketchSolveSettings,
  diagnostics: SketchSolveDiagnostic[]
): void {
  const pointIds = new Set<SketchSolverPointId>();
  const scalarIds = new Set<SketchSolverScalarId>();
  const arcIds = new Set<string>();

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

  for (const arc of model.arcs ?? []) {
    if (arcIds.has(arc.id)) {
      diagnostics.push({
        code: "SKETCH_SOLVER_INVALID_VALUE",
        severity: "blocker",
        message: `Duplicate arc variable id: ${arc.id}`,
        sourceType: "model",
        sourceId: arc.id,
        expected: "unique arc id",
        received: arc.id
      });
    }
    arcIds.add(arc.id);

    if (!isFiniteVec2(arc.initial.center)) {
      diagnostics.push(
        invalidArcDiagnostic(
          arc.id,
          "center",
          "finite [x, y]",
          arc.initial.center
        )
      );
    }
    if (
      !Number.isFinite(arc.initial.radius) ||
      arc.initial.radius <= settings.tolerance
    ) {
      diagnostics.push(
        invalidArcDiagnostic(
          arc.id,
          "radius",
          `finite radius > ${settings.tolerance}`,
          arc.initial.radius
        )
      );
    }
    if (!Number.isFinite(arc.initial.startAngleDegrees)) {
      diagnostics.push(
        invalidArcDiagnostic(
          arc.id,
          "start angle",
          "finite degrees",
          arc.initial.startAngleDegrees
        )
      );
    }
    const magnitude = Math.abs(arc.initial.sweepAngleDegrees);
    if (
      !Number.isFinite(arc.initial.sweepAngleDegrees) ||
      magnitude < settings.angularToleranceDegrees ||
      magnitude > 360 - settings.angularToleranceDegrees
    ) {
      diagnostics.push(
        invalidArcDiagnostic(
          arc.id,
          "signed sweep",
          `${settings.angularToleranceDegrees} <= abs(sweep) <= ${360 - settings.angularToleranceDegrees}`,
          arc.initial.sweepAngleDegrees
        )
      );
    }
  }
}

function invalidArcDiagnostic(
  arcId: string,
  field: string,
  expected: string,
  received: unknown
): SketchSolveDiagnostic {
  return {
    code: "SKETCH_SOLVER_INVALID_VALUE",
    severity: "blocker",
    message: `Arc ${field} must satisfy the V17 geometry policy.`,
    sourceType: "model",
    sourceId: arcId,
    targetId: field,
    expected,
    received: describeReceived(received)
  };
}

function validateConstraint(
  constraint: SketchSolveConstraint,
  settings: SketchSolveSettings,
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

  const raw = constraint as unknown as Record<string, unknown>;
  if (
    (constraint.kind === "midpoint" ||
      constraint.kind === "parallel" ||
      constraint.kind === "perpendicular" ||
      constraint.kind === "equalLength" ||
      constraint.kind === "angle") &&
    [raw.target, raw.primaryTarget, raw.secondaryTarget].some((target) =>
      isWholeArcTarget(target)
    )
  ) {
    diagnostics.push({
      code: "SKETCH_SOLVER_UNSUPPORTED_CONSTRAINT",
      severity: "warning",
      message: `${formatConstraintKindForMessage(constraint.kind)} does not support whole-arc targets in V17.`,
      sourceType: "constraint",
      sourceId: constraint.id,
      constraintKind: constraint.kind,
      expected: "supported point or line target",
      received: "arc curve target"
    });
    return;
  }

  if (constraint.kind === "fixedPoint") {
    if ("target" in constraint) {
      validateDerivedPointTarget(
        constraint.target,
        constraint,
        stateAccess,
        diagnostics
      );
    } else {
      validatePointTarget(
        constraint.pointId,
        constraint,
        stateAccess,
        diagnostics
      );
    }
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
    if ("primaryTarget" in constraint) {
      validateDerivedPointTarget(
        constraint.primaryTarget,
        constraint,
        stateAccess,
        diagnostics
      );
      validateDerivedPointTarget(
        constraint.secondaryTarget,
        constraint,
        stateAccess,
        diagnostics
      );
    } else {
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
    }
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

  if (
    constraint.kind === "parallel" ||
    constraint.kind === "perpendicular" ||
    constraint.kind === "equalLength" ||
    constraint.kind === "angle"
  ) {
    validateLinePairConstraint(constraint, stateAccess, diagnostics);
    if (constraint.kind === "angle") {
      validateAngleConstraint(constraint, diagnostics);
    }
    return;
  }

  if (constraint.kind === "concentric") {
    if ("primaryTarget" in constraint) {
      validateRadiusCurveTarget(
        constraint.primaryTarget,
        constraint,
        stateAccess,
        diagnostics
      );
      validateRadiusCurveTarget(
        constraint.secondaryTarget,
        constraint,
        stateAccess,
        diagnostics
      );
    } else {
      validatePointTarget(
        constraint.primaryCenterPointId,
        constraint,
        stateAccess,
        diagnostics
      );
      validatePointTarget(
        constraint.secondaryCenterPointId,
        constraint,
        stateAccess,
        diagnostics
      );
    }
    return;
  }

  if (constraint.kind === "equalRadius") {
    if ("primaryTarget" in constraint) {
      validateRadiusCurveTarget(
        constraint.primaryTarget,
        constraint,
        stateAccess,
        diagnostics
      );
      validateRadiusCurveTarget(
        constraint.secondaryTarget,
        constraint,
        stateAccess,
        diagnostics
      );
      return;
    }
    validateScalarTarget(
      constraint.primaryRadiusId,
      constraint,
      stateAccess,
      diagnostics
    );
    validateScalarTarget(
      constraint.secondaryRadiusId,
      constraint,
      stateAccess,
      diagnostics
    );
    validatePositiveScalarTarget({
      constraint,
      stateAccess,
      diagnostics,
      scalarId: constraint.primaryRadiusId,
      label: "primary radius"
    });
    validatePositiveScalarTarget({
      constraint,
      stateAccess,
      diagnostics,
      scalarId: constraint.secondaryRadiusId,
      label: "secondary radius"
    });
    return;
  }

  if (constraint.kind === "tangent") {
    if ("primaryTarget" in constraint) {
      validateTangentTargetConstraint(
        constraint,
        settings,
        stateAccess,
        diagnostics
      );
      return;
    }
    const hasLineStart = validatePointTargetField(
      constraint,
      "lineStartPointId",
      constraint.lineStartPointId,
      stateAccess,
      diagnostics
    );
    const hasLineEnd = validatePointTargetField(
      constraint,
      "lineEndPointId",
      constraint.lineEndPointId,
      stateAccess,
      diagnostics
    );
    validatePointTargetField(
      constraint,
      "circleCenterPointId",
      constraint.circleCenterPointId,
      stateAccess,
      diagnostics
    );
    const hasRadius = validateScalarTargetField(
      constraint,
      "circleRadiusId",
      constraint.circleRadiusId,
      stateAccess,
      diagnostics
    );

    if (hasLineStart && hasLineEnd) {
      validateNonZeroLineTarget({
        constraint,
        stateAccess,
        diagnostics,
        startPointId: constraint.lineStartPointId,
        endPointId: constraint.lineEndPointId,
        label: "tangent line"
      });
    }

    if (hasRadius) {
      validatePositiveScalarTarget({
        constraint,
        stateAccess,
        diagnostics,
        scalarId: constraint.circleRadiusId,
        label: "circle radius"
      });
    }
    return;
  }

  if (constraint.kind === "symmetry") {
    if ("axisTarget" in constraint) {
      validateDerivedPointTarget(
        constraint.primaryTarget,
        constraint,
        stateAccess,
        diagnostics
      );
      validateDerivedPointTarget(
        constraint.secondaryTarget,
        constraint,
        stateAccess,
        diagnostics
      );
      validateCurveTarget(
        constraint.axisTarget,
        constraint,
        stateAccess,
        diagnostics
      );
      return;
    }
    const hasLineStart = validatePointTargetField(
      constraint,
      "lineStartPointId",
      constraint.lineStartPointId,
      stateAccess,
      diagnostics
    );
    const hasLineEnd = validatePointTargetField(
      constraint,
      "lineEndPointId",
      constraint.lineEndPointId,
      stateAccess,
      diagnostics
    );
    validatePointTargetField(
      constraint,
      "primaryPointId",
      constraint.primaryPointId,
      stateAccess,
      diagnostics
    );
    validatePointTargetField(
      constraint,
      "secondaryPointId",
      constraint.secondaryPointId,
      stateAccess,
      diagnostics
    );

    if (hasLineStart && hasLineEnd) {
      validateNonZeroLineTarget({
        constraint,
        stateAccess,
        diagnostics,
        startPointId: constraint.lineStartPointId,
        endPointId: constraint.lineEndPointId,
        label: "symmetry line"
      });
    }
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

function validateDerivedPointTarget(
  target: SketchSolvePointTarget,
  source: SketchSolveConstraint,
  stateAccess: SolverStateAccess,
  diagnostics: SketchSolveDiagnostic[]
): void {
  if (target.kind === "point") {
    validatePointTarget(target.pointId, source, stateAccess, diagnostics);
    return;
  }
  if (!stateAccess.arcIndex.has(target.arcId)) {
    diagnostics.push(missingTargetDiagnostic(source, target.arcId));
  }
}

function validateCurveTarget(
  target: SketchSolveCurveTarget,
  source: SketchSolveConstraint,
  stateAccess: SolverStateAccess,
  diagnostics: SketchSolveDiagnostic[]
): void {
  if (target.kind === "arc") {
    if (!stateAccess.arcIndex.has(target.arcId)) {
      diagnostics.push(missingTargetDiagnostic(source, target.arcId));
    }
    return;
  }
  if (target.kind === "line") {
    validatePointTarget(target.startPointId, source, stateAccess, diagnostics);
    validatePointTarget(target.endPointId, source, stateAccess, diagnostics);
    const start = readInitialPoint(stateAccess, target.startPointId);
    const end = readInitialPoint(stateAccess, target.endPointId);
    if (start && end && distance(start, end) <= 1e-12) {
      diagnostics.push({
        code: "SKETCH_SOLVER_INVALID_VALUE",
        severity: "blocker",
        message: "Line curve target must have non-zero length.",
        sourceType: "constraint",
        sourceId: source.id,
        constraintKind: source.kind,
        expected: "non-zero line direction",
        received: "zero-length line"
      });
    }
    return;
  }
  validatePointTarget(target.centerPointId, source, stateAccess, diagnostics);
  validateScalarTarget(target.radiusId, source, stateAccess, diagnostics);
  const radius = readInitialScalar(stateAccess, target.radiusId);
  if (radius !== undefined && radius <= 0) {
    diagnostics.push({
      code: "SKETCH_SOLVER_INVALID_VALUE",
      severity: "blocker",
      message: "Circle curve target radius must be positive.",
      sourceType: "constraint",
      sourceId: source.id,
      constraintKind: source.kind,
      targetId: target.radiusId,
      expected: "positive radius",
      received: describeReceived(radius)
    });
  }
}

function validateRadiusCurveTarget(
  target: SketchSolveRadiusCurveTarget,
  source: SketchSolveConstraint,
  stateAccess: SolverStateAccess,
  diagnostics: SketchSolveDiagnostic[]
): void {
  validateCurveTarget(target, source, stateAccess, diagnostics);
}

function validateTangentTargetConstraint(
  constraint: SketchSolveTangentTargetConstraint,
  settings: SketchSolveSettings,
  stateAccess: SolverStateAccess,
  diagnostics: SketchSolveDiagnostic[]
): void {
  validateCurveTarget(
    constraint.primaryTarget,
    constraint,
    stateAccess,
    diagnostics
  );
  validateCurveTarget(
    constraint.secondaryTarget,
    constraint,
    stateAccess,
    diagnostics
  );
  const kinds = [constraint.primaryTarget.kind, constraint.secondaryTarget.kind]
    .sort()
    .join(":");
  if (kinds === "line:line" || kinds === "circle:circle") {
    diagnostics.push({
      code: "SKETCH_SOLVER_UNSUPPORTED_CONSTRAINT",
      severity: "warning",
      message: `Tangency between ${constraint.primaryTarget.kind} and ${constraint.secondaryTarget.kind} is outside the V17 support matrix.`,
      sourceType: "constraint",
      sourceId: constraint.id,
      constraintKind: constraint.kind,
      expected: "line-circle, line-arc, arc-circle, or arc-arc",
      received: kinds
    });
    return;
  }

  const seed = createTangencyBranchSeed(constraint, stateAccess, settings);
  if (seed.ambiguity) {
    diagnostics.push(branchDiagnostic(constraint.id, seed.ambiguity));
  }
}

function missingTargetDiagnostic(
  source: SketchSolveConstraint | SketchSolveDimension,
  targetId: string
): SketchSolveDiagnostic {
  return {
    code: "SKETCH_SOLVER_MISSING_TARGET",
    severity: "blocker",
    message: `Sketch solve target does not exist: ${targetId}`,
    sourceType: getSourceType(source),
    sourceId: source.id,
    targetId,
    ...(isConstraintSource(source) ? { constraintKind: source.kind } : {}),
    ...(isDimensionSource(source) ? { dimensionKind: source.kind } : {})
  };
}

function validateNonZeroLineTarget({
  constraint,
  stateAccess,
  diagnostics,
  startPointId,
  endPointId,
  label
}: {
  readonly constraint: SketchSolveLineTargetConstraint;
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
      message: `Line-pair constraint ${label} must have non-zero length.`,
      sourceType: "constraint",
      sourceId: constraint.id,
      constraintKind: constraint.kind,
      targetId: `${startPointId}:${endPointId}`,
      expected: "non-zero line direction",
      received: "zero-length line"
    });
  }
}

function validateAngleConstraint(
  constraint: SketchSolveAngleConstraint,
  diagnostics: SketchSolveDiagnostic[]
): void {
  if (
    !Number.isFinite(constraint.angleDegrees) ||
    constraint.angleDegrees <= 0 ||
    constraint.angleDegrees >= 180
  ) {
    diagnostics.push({
      code: "SKETCH_SOLVER_INVALID_VALUE",
      severity: "blocker",
      message:
        "Angle constraint value must be finite and greater than 0 degrees and less than 180 degrees.",
      sourceType: "constraint",
      sourceId: constraint.id,
      constraintKind: constraint.kind,
      expected: "finite angleDegrees > 0 and < 180",
      received: describeReceived(constraint.angleDegrees)
    });
  }
}

function validateDimension(
  dimension: SketchSolveDimension,
  settings: SketchSolveSettings,
  stateAccess: SolverStateAccess,
  diagnostics: SketchSolveDiagnostic[]
): void {
  if (dimension.kind === "arcRadius" || dimension.kind === "arcSweep") {
    if (!stateAccess.arcIndex.has(dimension.arcId)) {
      diagnostics.push(missingTargetDiagnostic(dimension, dimension.arcId));
      return;
    }
    const valid =
      Number.isFinite(dimension.value) &&
      (dimension.kind === "arcRadius"
        ? dimension.value > settings.tolerance
        : dimension.value >= settings.angularToleranceDegrees &&
          dimension.value <= 360 - settings.angularToleranceDegrees);
    if (!valid) {
      diagnostics.push({
        code: "SKETCH_ARC_DIMENSION_INVALID",
        severity: "blocker",
        message:
          dimension.kind === "arcRadius"
            ? "Arc radius dimension must exceed the linear tolerance."
            : "Arc sweep dimension magnitude is outside the V17 bounds.",
        sourceType: "dimension",
        sourceId: dimension.id,
        dimensionKind: dimension.kind,
        expected:
          dimension.kind === "arcRadius"
            ? `radius > ${settings.tolerance}`
            : `${settings.angularToleranceDegrees} <= sweep <= ${360 - settings.angularToleranceDegrees}`,
        received: describeReceived(dimension.value)
      });
    }
    return;
  }

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

function validatePointTargetField(
  source: SketchSolveConstraint,
  fieldName: string,
  pointId: SketchSolverPointId,
  stateAccess: SolverStateAccess,
  diagnostics: SketchSolveDiagnostic[]
): boolean {
  if (!isValidTargetId(pointId)) {
    diagnostics.push({
      code: "SKETCH_SOLVER_INVALID_VALUE",
      severity: "blocker",
      message: `Sketch solve point target field ${fieldName} must be a non-empty string.`,
      sourceType: "constraint",
      sourceId: source.id,
      constraintKind: source.kind,
      targetId: fieldName,
      expected: "non-empty point id",
      received: describeReceived(pointId)
    });
    return false;
  }

  validatePointTarget(pointId, source, stateAccess, diagnostics);
  return stateAccess.pointIndex.has(pointId);
}

function validateScalarTarget(
  scalarId: SketchSolverScalarId,
  source: SketchSolveConstraint | SketchSolveDimension,
  stateAccess: SolverStateAccess,
  diagnostics: SketchSolveDiagnostic[]
): void {
  if (!stateAccess.scalarIndex.has(scalarId)) {
    diagnostics.push({
      code: "SKETCH_SOLVER_MISSING_TARGET",
      severity: "blocker",
      message: `Sketch solve scalar target does not exist: ${scalarId}`,
      sourceType: getSourceType(source),
      sourceId: source.id,
      targetId: scalarId,
      ...(isConstraintSource(source) ? { constraintKind: source.kind } : {}),
      ...(isDimensionSource(source) ? { dimensionKind: source.kind } : {})
    });
  }
}

function validateScalarTargetField(
  source: SketchSolveConstraint,
  fieldName: string,
  scalarId: SketchSolverScalarId,
  stateAccess: SolverStateAccess,
  diagnostics: SketchSolveDiagnostic[]
): boolean {
  if (!isValidTargetId(scalarId)) {
    diagnostics.push({
      code: "SKETCH_SOLVER_INVALID_VALUE",
      severity: "blocker",
      message: `Sketch solve scalar target field ${fieldName} must be a non-empty string.`,
      sourceType: "constraint",
      sourceId: source.id,
      constraintKind: source.kind,
      targetId: fieldName,
      expected: "non-empty scalar id",
      received: describeReceived(scalarId)
    });
    return false;
  }

  validateScalarTarget(scalarId, source, stateAccess, diagnostics);
  return stateAccess.scalarIndex.has(scalarId);
}

function validatePositiveScalarTarget({
  constraint,
  stateAccess,
  diagnostics,
  scalarId,
  label
}: {
  readonly constraint:
    | SketchSolveEqualRadiusConstraint
    | SketchSolveTangentConstraint;
  readonly stateAccess: SolverStateAccess;
  readonly diagnostics: SketchSolveDiagnostic[];
  readonly scalarId: SketchSolverScalarId;
  readonly label: string;
}): void {
  const initial = readInitialScalar(stateAccess, scalarId);

  if (initial === undefined) {
    return;
  }

  if (initial <= 0) {
    diagnostics.push({
      code: "SKETCH_SOLVER_INVALID_VALUE",
      severity: "blocker",
      message: `${formatConstraintKindForMessage(
        constraint.kind
      )} constraint ${label} must be positive.`,
      sourceType: "constraint",
      sourceId: constraint.id,
      constraintKind: constraint.kind,
      targetId: scalarId,
      expected: "positive radius scalar",
      received: describeReceived(initial)
    });
  }
}

function createResidualBlocks(
  model: SketchSolveModel,
  stateAccess: SolverStateAccess,
  settings: SketchSolveSettings
): readonly ResidualBlock[] {
  const blocks: ResidualBlock[] = [];

  for (const constraint of model.constraints ?? []) {
    if (isDeferredConstraint(constraint)) {
      continue;
    }
    blocks.push({
      sourceType: "constraint",
      sourceId: constraint.id,
      constraintKind: constraint.kind,
      evaluator: createConstraintResidual(constraint, stateAccess, settings)
    });
  }

  for (const dimension of model.dimensions ?? []) {
    blocks.push({
      sourceType: "dimension",
      sourceId: dimension.id,
      dimensionKind: dimension.kind,
      evaluator: createDimensionResidual(dimension, stateAccess)
    });
  }

  return blocks;
}

function createConstraintResidual(
  constraint: Exclude<SketchSolveConstraint, SketchSolveDeferredConstraint>,
  stateAccess: SolverStateAccess,
  settings: SketchSolveSettings
): ResidualEvaluator {
  if (constraint.kind === "fixedPoint") {
    return (state) => {
      const point =
        "target" in constraint
          ? readPointTarget(state, stateAccess, constraint.target)
          : readPoint(state, stateAccess, constraint.pointId);
      return [point[0] - constraint.value[0], point[1] - constraint.value[1]];
    };
  }

  if (constraint.kind === "coincident") {
    return (state) => {
      const pointA =
        "primaryTarget" in constraint
          ? readPointTarget(state, stateAccess, constraint.primaryTarget)
          : readPoint(state, stateAccess, constraint.pointAId);
      const pointB =
        "primaryTarget" in constraint
          ? readPointTarget(state, stateAccess, constraint.secondaryTarget)
          : readPoint(state, stateAccess, constraint.pointBId);
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

  if (
    constraint.kind === "parallel" ||
    constraint.kind === "perpendicular" ||
    constraint.kind === "equalLength" ||
    constraint.kind === "angle"
  ) {
    return createLinePairResidual(constraint, stateAccess);
  }

  if (constraint.kind === "concentric") {
    return (state) => {
      const primary =
        "primaryTarget" in constraint
          ? readCurveCenter(state, stateAccess, constraint.primaryTarget)
          : readPoint(state, stateAccess, constraint.primaryCenterPointId);
      const secondary =
        "primaryTarget" in constraint
          ? readCurveCenter(state, stateAccess, constraint.secondaryTarget)
          : readPoint(state, stateAccess, constraint.secondaryCenterPointId);
      return [primary[0] - secondary[0], primary[1] - secondary[1]];
    };
  }

  if (constraint.kind === "equalRadius") {
    return (state) => {
      const primary =
        "primaryTarget" in constraint
          ? readCurveRadius(state, stateAccess, constraint.primaryTarget)
          : readScalar(state, stateAccess, constraint.primaryRadiusId);
      const secondary =
        "primaryTarget" in constraint
          ? readCurveRadius(state, stateAccess, constraint.secondaryTarget)
          : readScalar(state, stateAccess, constraint.secondaryRadiusId);
      return [primary - secondary];
    };
  }

  if (constraint.kind === "tangent") {
    if ("primaryTarget" in constraint) {
      return createCurveTangencyResidual(constraint, stateAccess, settings);
    }
    return (state) => {
      const lineDirection = readLineDirection(
        state,
        stateAccess,
        constraint.lineStartPointId,
        constraint.lineEndPointId
      );

      if (!lineDirection) {
        return [1];
      }

      const lineStart = readPoint(
        state,
        stateAccess,
        constraint.lineStartPointId
      );
      const center = readPoint(
        state,
        stateAccess,
        constraint.circleCenterPointId
      );
      const radius = readScalar(state, stateAccess, constraint.circleRadiusId);
      const centerOffset: SketchSolverVec2 = [
        center[0] - lineStart[0],
        center[1] - lineStart[1]
      ];
      const signedDistance =
        lineDirection[0] * centerOffset[1] - lineDirection[1] * centerOffset[0];

      return [Math.abs(signedDistance) - radius];
    };
  }

  if (constraint.kind === "symmetry") {
    return (state) => {
      const axis =
        "axisTarget" in constraint
          ? constraint.axisTarget
          : {
              kind: "line" as const,
              startPointId: constraint.lineStartPointId,
              endPointId: constraint.lineEndPointId
            };
      const lineDirection = readLineDirection(
        state,
        stateAccess,
        axis.startPointId,
        axis.endPointId
      );

      if (!lineDirection) {
        return [1, 1];
      }

      const lineStart = readPoint(state, stateAccess, axis.startPointId);
      const primary =
        "axisTarget" in constraint
          ? readPointTarget(state, stateAccess, constraint.primaryTarget)
          : readPoint(state, stateAccess, constraint.primaryPointId);
      const secondary =
        "axisTarget" in constraint
          ? readPointTarget(state, stateAccess, constraint.secondaryTarget)
          : readPoint(state, stateAccess, constraint.secondaryPointId);
      const normal: SketchSolverVec2 = [-lineDirection[1], lineDirection[0]];
      const midpoint: SketchSolverVec2 = [
        (primary[0] + secondary[0]) / 2,
        (primary[1] + secondary[1]) / 2
      ];
      const midpointOffset: SketchSolverVec2 = [
        midpoint[0] - lineStart[0],
        midpoint[1] - lineStart[1]
      ];

      return [
        midpointOffset[0] * normal[0] + midpointOffset[1] * normal[1],
        (primary[0] - secondary[0]) * lineDirection[0] +
          (primary[1] - secondary[1]) * lineDirection[1]
      ];
    };
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

    if (constraint.kind === "perpendicular") {
      return [
        primaryDirection[0] * secondaryDirection[0] +
          primaryDirection[1] * secondaryDirection[1]
      ];
    }

    if (constraint.kind === "angle") {
      return [
        primaryDirection[0] * secondaryDirection[0] +
          primaryDirection[1] * secondaryDirection[1] -
          Math.cos((constraint.angleDegrees * Math.PI) / 180)
      ];
    }

    const primaryStart = readPoint(
      state,
      stateAccess,
      constraint.primaryStartPointId
    );
    const primaryEnd = readPoint(
      state,
      stateAccess,
      constraint.primaryEndPointId
    );
    const secondaryStart = readPoint(
      state,
      stateAccess,
      constraint.secondaryStartPointId
    );
    const secondaryEnd = readPoint(
      state,
      stateAccess,
      constraint.secondaryEndPointId
    );
    return [
      distance(primaryStart, primaryEnd) -
        distance(secondaryStart, secondaryEnd)
    ];
  };
}

function createCurveTangencyResidual(
  constraint: SketchSolveTangentTargetConstraint,
  stateAccess: SolverStateAccess,
  settings: SketchSolveSettings
): ResidualEvaluator {
  const { seed } = createTangencyBranchSeed(constraint, stateAccess, settings);
  if (!seed) return () => [1];

  if (seed.kind === "line-round") {
    return (state) => {
      const currentDirection = readLineDirection(
        state,
        stateAccess,
        seed.lineTarget.startPointId,
        seed.lineTarget.endPointId
      );
      if (!currentDirection) return [1];
      const currentStart = readPoint(
        state,
        stateAccess,
        seed.lineTarget.startPointId
      );
      const currentCenter = readCurveCenter(
        state,
        stateAccess,
        seed.roundTarget
      );
      const signedDistance = cross(currentDirection, [
        currentCenter[0] - currentStart[0],
        currentCenter[1] - currentStart[1]
      ]);
      return [
        signedDistance -
          seed.side * readCurveRadius(state, stateAccess, seed.roundTarget)
      ];
    };
  }

  return (state) => {
    const currentDistance = distance(
      readCurveCenter(state, stateAccess, seed.primaryTarget),
      readCurveCenter(state, stateAccess, seed.secondaryTarget)
    );
    const radiusA = readCurveRadius(state, stateAccess, seed.primaryTarget);
    const radiusB = readCurveRadius(state, stateAccess, seed.secondaryTarget);
    return [
      currentDistance -
        (seed.branch === "external"
          ? radiusA + radiusB
          : Math.abs(radiusA - radiusB))
    ];
  };
}

type TangencyBranchSeed =
  | {
      readonly kind: "line-round";
      readonly lineTarget: SketchSolveLineCurveTarget;
      readonly roundTarget: SketchSolveRadiusCurveTarget;
      readonly side: -1 | 1;
    }
  | {
      readonly kind: "round-round";
      readonly primaryTarget: SketchSolveRadiusCurveTarget;
      readonly secondaryTarget: SketchSolveRadiusCurveTarget;
      readonly branch: "external" | "internal";
    };

function createTangencyBranchSeed(
  constraint: SketchSolveTangentTargetConstraint,
  stateAccess: SolverStateAccess,
  settings: SketchSolveSettings
): { readonly seed?: TangencyBranchSeed; readonly ambiguity?: string } {
  const initialState = stateAccess.variables.map(
    (variable) => variable.initial
  );
  const lineTarget =
    constraint.primaryTarget.kind === "line"
      ? constraint.primaryTarget
      : constraint.secondaryTarget.kind === "line"
        ? constraint.secondaryTarget
        : undefined;
  const roundTarget =
    constraint.primaryTarget.kind !== "line"
      ? constraint.primaryTarget
      : constraint.secondaryTarget.kind !== "line"
        ? constraint.secondaryTarget
        : undefined;

  if (lineTarget && roundTarget) {
    const direction = readLineDirection(
      initialState,
      stateAccess,
      lineTarget.startPointId,
      lineTarget.endPointId
    );
    const start = readPoint(initialState, stateAccess, lineTarget.startPointId);
    const center = readCurveCenter(initialState, stateAccess, roundTarget);
    const side = direction
      ? selectLineTangencySide(
          cross(direction, [center[0] - start[0], center[1] - start[1]]),
          settings.tolerance
        )
      : undefined;
    return side === undefined
      ? {
          ambiguity:
            "round-curve center lies on the tangent line, so the tangency side is indeterminate"
        }
      : { seed: { kind: "line-round", lineTarget, roundTarget, side } };
  }

  if (
    constraint.primaryTarget.kind === "line" ||
    constraint.secondaryTarget.kind === "line"
  ) {
    return {};
  }
  const primaryTarget = constraint.primaryTarget;
  const secondaryTarget = constraint.secondaryTarget;
  const centerDistance = distance(
    readCurveCenter(initialState, stateAccess, primaryTarget),
    readCurveCenter(initialState, stateAccess, secondaryTarget)
  );
  if (centerDistance <= settings.tolerance) {
    return {
      ambiguity:
        "round-curve centers are coincident, so tangency contact is indeterminate"
    };
  }
  const radiusA = readCurveRadius(initialState, stateAccess, primaryTarget);
  const radiusB = readCurveRadius(initialState, stateAccess, secondaryTarget);
  const branch = selectRoundTangencyBranch(
    Math.abs(centerDistance - radiusA - radiusB),
    Math.abs(centerDistance - Math.abs(radiusA - radiusB)),
    settings.tolerance
  );
  return branch === undefined
    ? {
        ambiguity:
          "internal and external tangency branches are equally supported by the authored geometry"
      }
    : {
        seed: {
          kind: "round-round",
          primaryTarget,
          secondaryTarget,
          branch
        }
      };
}

function selectLineTangencySide(
  signedDistance: number,
  tolerance: number
): -1 | 1 | undefined {
  if (
    !Number.isFinite(signedDistance) ||
    Math.abs(signedDistance) <= tolerance
  ) {
    return undefined;
  }
  return signedDistance < 0 ? -1 : 1;
}

function selectRoundTangencyBranch(
  externalError: number,
  internalError: number,
  tolerance: number
): "external" | "internal" | undefined {
  if (
    !Number.isFinite(externalError) ||
    !Number.isFinite(internalError) ||
    Math.abs(externalError - internalError) <= tolerance
  ) {
    return undefined;
  }
  return externalError < internalError ? "external" : "internal";
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

  if (dimension.kind === "arcRadius") {
    return (state) => [
      readArc(state, stateAccess, dimension.arcId).radius - dimension.value
    ];
  }

  if (dimension.kind === "arcSweep") {
    const initial = readInitialArc(stateAccess, dimension.arcId);
    const sign = (initial?.sweepAngleDegrees ?? 1) < 0 ? -1 : 1;
    return (state) => [
      readArc(state, stateAccess, dimension.arcId).sweepAngleDegrees -
        sign * dimension.value
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
  settings: SketchSolveSettings,
  isStateAllowed: (state: readonly number[]) => boolean = () => true
): {
  readonly state: readonly number[];
  readonly iterations: number;
  readonly converged: boolean;
  readonly stateGuardConstrained: boolean;
  readonly residuals: readonly number[];
  readonly maxResidual: number;
} {
  let state = [...initialState];
  let residuals = getResiduals(residualBlocks, state);
  let maxResidual = getMaxResidual(residuals);
  let stateGuardConstrained = false;

  if (maxResidual <= settings.tolerance) {
    return {
      state,
      iterations: 0,
      converged: true,
      stateGuardConstrained,
      residuals,
      maxResidual
    };
  }

  for (let iteration = 1; iteration <= settings.maxIterations; iteration += 1) {
    stateGuardConstrained = false;
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
        stateGuardConstrained,
        residuals,
        maxResidual
      };
    }

    let stepScale = 1;
    let candidate = state.map(
      (value, index) => value + stepScale * delta[index]
    );
    if (!isStateAllowed(candidate)) {
      stateGuardConstrained = true;
    }
    while (!isStateAllowed(candidate) && stepScale > 1e-9) {
      stepScale /= 2;
      candidate = state.map((value, index) => value + stepScale * delta[index]);
    }
    if (!isStateAllowed(candidate)) {
      return {
        state,
        iterations: iteration - 1,
        converged: false,
        stateGuardConstrained,
        residuals,
        maxResidual
      };
    }
    state = candidate;
    residuals = getResiduals(residualBlocks, state);
    maxResidual = getMaxResidual(residuals);

    if (maxResidual <= settings.tolerance) {
      return {
        state,
        iterations: iteration,
        converged: true,
        stateGuardConstrained,
        residuals,
        maxResidual
      };
    }
  }

  return {
    state,
    iterations: settings.maxIterations,
    converged: false,
    stateGuardConstrained,
    residuals,
    maxResidual
  };
}

function arcStateStaysWithinAuthoredBranch(
  model: SketchSolveModel,
  stateAccess: SolverStateAccess,
  state: readonly number[],
  settings: SketchSolveSettings
): boolean {
  return (model.arcs ?? []).every((arcVariable) => {
    const arc = readArc(state, stateAccess, arcVariable.id);
    const magnitude = Math.abs(arc.sweepAngleDegrees);
    return (
      Number.isFinite(arc.radius) &&
      arc.radius > settings.tolerance &&
      Number.isFinite(arc.startAngleDegrees) &&
      Number.isFinite(arc.sweepAngleDegrees) &&
      Math.sign(arc.sweepAngleDegrees) ===
        Math.sign(arcVariable.initial.sweepAngleDegrees) &&
      magnitude >= settings.angularToleranceDegrees &&
      magnitude <= 360 - settings.angularToleranceDegrees
    );
  });
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
  residualCount,
  jacobianRank,
  augmentedRank
}: {
  readonly converged: boolean;
  readonly variableCount: number;
  readonly residualCount: number;
  readonly jacobianRank: number;
  readonly augmentedRank: number;
}): SketchSolveStatus {
  if (!converged) {
    return augmentedRank > jacobianRank ? "conflicting" : "failed";
  }

  if (jacobianRank < variableCount) {
    return "under-defined";
  }

  if (residualCount > jacobianRank) {
    return "over-defined";
  }

  return "converged";
}

function analyzeResidualSystem(
  state: readonly number[],
  residualBlocks: readonly ResidualBlock[],
  residuals: readonly number[],
  settings: SketchSolveSettings
): {
  readonly jacobianRank: number;
  readonly augmentedRank: number;
} {
  const jacobian = finiteDifferenceJacobian(
    state,
    residualBlocks,
    residuals,
    settings.finiteDifferenceStep
  );
  return {
    jacobianRank: matrixRank(jacobian),
    augmentedRank: matrixRank(
      jacobian.map((row, index) => [...row, residuals[index]])
    )
  };
}

function matrixRank(matrix: readonly (readonly number[])[]): number {
  if (matrix.length === 0 || (matrix[0]?.length ?? 0) === 0) return 0;
  const reduced = matrix.map((row) => [...row]);
  const rowCount = reduced.length;
  const columnCount = reduced[0].length;
  const scale = reduced.reduce(
    (maximum, row) =>
      row.reduce(
        (rowMaximum, value) => Math.max(rowMaximum, Math.abs(value)),
        maximum
      ),
    0
  );
  const threshold = Math.max(1e-10, scale * 1e-8);
  let rank = 0;

  for (let column = 0; column < columnCount && rank < rowCount; column += 1) {
    let pivotRow = rank;
    let pivotMagnitude = Math.abs(reduced[pivotRow][column]);
    for (let row = rank + 1; row < rowCount; row += 1) {
      const magnitude = Math.abs(reduced[row][column]);
      if (magnitude > pivotMagnitude) {
        pivotMagnitude = magnitude;
        pivotRow = row;
      }
    }
    if (pivotMagnitude <= threshold) continue;

    [reduced[rank], reduced[pivotRow]] = [reduced[pivotRow], reduced[rank]];
    const pivot = reduced[rank][column];
    for (let nextColumn = column; nextColumn < columnCount; nextColumn += 1) {
      reduced[rank][nextColumn] /= pivot;
    }
    for (let row = rank + 1; row < rowCount; row += 1) {
      const factor = reduced[row][column];
      if (Math.abs(factor) <= threshold) continue;
      for (let nextColumn = column; nextColumn < columnCount; nextColumn += 1) {
        reduced[row][nextColumn] -= factor * reduced[rank][nextColumn];
      }
    }
    rank += 1;
  }

  return rank;
}

function validateSolvedState(
  model: SketchSolveModel,
  settings: SketchSolveSettings,
  stateAccess: SolverStateAccess,
  state: readonly number[]
): readonly SketchSolveDiagnostic[] {
  const diagnostics: SketchSolveDiagnostic[] = [];
  for (const arcVariable of model.arcs ?? []) {
    const initial = arcVariable.initial;
    const solved = readArc(state, stateAccess, arcVariable.id);
    if (
      !Number.isFinite(solved.radius) ||
      solved.radius <= settings.tolerance ||
      !Number.isFinite(solved.startAngleDegrees) ||
      !Number.isFinite(solved.sweepAngleDegrees) ||
      Math.abs(solved.sweepAngleDegrees) < settings.angularToleranceDegrees ||
      Math.abs(solved.sweepAngleDegrees) >
        360 - settings.angularToleranceDegrees
    ) {
      diagnostics.push(
        invalidArcDiagnostic(
          arcVariable.id,
          "solved geometry",
          `radius > ${settings.tolerance}; ${settings.angularToleranceDegrees} <= abs(sweep) <= ${360 - settings.angularToleranceDegrees}`,
          solved
        )
      );
      continue;
    }
    if (
      Math.sign(solved.sweepAngleDegrees) !==
      Math.sign(initial.sweepAngleDegrees)
    ) {
      diagnostics.push({
        code: "SKETCH_ARC_SOLVE_BRANCH_INVALID",
        severity: "blocker",
        message: "Arc solve would reverse the authored sweep branch.",
        sourceType: "model",
        sourceId: arcVariable.id,
        expected:
          initial.sweepAngleDegrees < 0 ? "negative sweep" : "positive sweep",
        received: describeReceived(solved.sweepAngleDegrees)
      });
    }
  }

  for (const constraint of model.constraints ?? []) {
    if (constraint.kind !== "tangent" || !("primaryTarget" in constraint))
      continue;
    diagnostics.push(
      ...validateTangencyContact(constraint, stateAccess, state, settings)
    );
  }
  return diagnostics;
}

function validateTangencyContact(
  constraint: SketchSolveTangentTargetConstraint,
  stateAccess: SolverStateAccess,
  state: readonly number[],
  settings: SketchSolveSettings
): readonly SketchSolveDiagnostic[] {
  const diagnostics: SketchSolveDiagnostic[] = [];
  const initialState = stateAccess.variables.map(
    (variable) => variable.initial
  );
  const branchSeed = createTangencyBranchSeed(
    constraint,
    stateAccess,
    settings
  );
  if (branchSeed.ambiguity) {
    diagnostics.push(branchDiagnostic(constraint.id, branchSeed.ambiguity));
    return diagnostics;
  }
  const seed = branchSeed.seed;
  if (!seed) return diagnostics;

  if (seed.kind === "line-round") {
    const solvedDirection = readLineDirection(
      state,
      stateAccess,
      seed.lineTarget.startPointId,
      seed.lineTarget.endPointId
    );
    if (!solvedDirection) return diagnostics;
    const solvedStart = readPoint(
      state,
      stateAccess,
      seed.lineTarget.startPointId
    );
    const solvedCenter = readCurveCenter(state, stateAccess, seed.roundTarget);
    const solvedSignedDistance = cross(solvedDirection, [
      solvedCenter[0] - solvedStart[0],
      solvedCenter[1] - solvedStart[1]
    ]);
    if (selectLineTangencySide(solvedSignedDistance, 0) !== seed.side) {
      diagnostics.push(
        branchDiagnostic(constraint.id, "line tangency side changed")
      );
    }
    if (seed.roundTarget.kind === "arc") {
      const normal: SketchSolverVec2 = [
        -solvedDirection[1],
        solvedDirection[0]
      ];
      const contact: SketchSolverVec2 = [
        solvedCenter[0] - solvedSignedDistance * normal[0],
        solvedCenter[1] - solvedSignedDistance * normal[1]
      ];
      if (
        !pointLiesOnArc(
          state,
          stateAccess,
          seed.roundTarget.arcId,
          contact,
          settings
        )
      ) {
        diagnostics.push(
          outsideArcDiagnostic(constraint.id, seed.roundTarget.arcId)
        );
      }
    }
    return diagnostics;
  }

  const primary = seed.primaryTarget;
  const secondary = seed.secondaryTarget;
  const initialRadiusA = readCurveRadius(initialState, stateAccess, primary);
  const initialRadiusB = readCurveRadius(initialState, stateAccess, secondary);
  const external = seed.branch === "external";
  const initialOwner = Math.sign(initialRadiusA - initialRadiusB);
  const centerA = readCurveCenter(state, stateAccess, primary);
  const centerB = readCurveCenter(state, stateAccess, secondary);
  const radiusA = readCurveRadius(state, stateAccess, primary);
  const radiusB = readCurveRadius(state, stateAccess, secondary);
  if (
    !external &&
    (Math.sign(radiusA - radiusB) || initialOwner) !== initialOwner
  ) {
    diagnostics.push(
      branchDiagnostic(constraint.id, "internal tangency containment changed")
    );
  }
  const centerDistance = distance(centerA, centerB);
  if (centerDistance <= settings.tolerance) {
    diagnostics.push(
      branchDiagnostic(
        constraint.id,
        "round-curve centers coincide, so tangency contact is indeterminate"
      )
    );
    return diagnostics;
  }
  const direction: SketchSolverVec2 = [
    (centerB[0] - centerA[0]) / centerDistance,
    (centerB[1] - centerA[1]) / centerDistance
  ];
  const primaryContactSign = external || radiusA >= radiusB ? 1 : -1;
  const contactA: SketchSolverVec2 = [
    centerA[0] + primaryContactSign * radiusA * direction[0],
    centerA[1] + primaryContactSign * radiusA * direction[1]
  ];
  const contactB: SketchSolverVec2 = external
    ? [centerB[0] - radiusB * direction[0], centerB[1] - radiusB * direction[1]]
    : contactA;
  if (
    primary.kind === "arc" &&
    !pointLiesOnArc(state, stateAccess, primary.arcId, contactA, settings)
  ) {
    diagnostics.push(outsideArcDiagnostic(constraint.id, primary.arcId));
  }
  if (
    secondary.kind === "arc" &&
    !pointLiesOnArc(state, stateAccess, secondary.arcId, contactB, settings)
  ) {
    diagnostics.push(outsideArcDiagnostic(constraint.id, secondary.arcId));
  }
  return diagnostics;
}

function pointLiesOnArc(
  state: readonly number[],
  stateAccess: SolverStateAccess,
  arcId: string,
  point: SketchSolverVec2,
  settings: SketchSolveSettings
): boolean {
  const arc = readArc(state, stateAccess, arcId);
  const angle = normalizeDegrees(
    (Math.atan2(point[1] - arc.center[1], point[0] - arc.center[0]) * 180) /
      Math.PI
  );
  const traveled =
    arc.sweepAngleDegrees > 0
      ? normalizeDegrees(angle - arc.startAngleDegrees)
      : normalizeDegrees(arc.startAngleDegrees - angle);
  return (
    traveled <=
    Math.abs(arc.sweepAngleDegrees) + settings.angularToleranceDegrees
  );
}

function outsideArcDiagnostic(
  constraintId: string,
  arcId: string
): SketchSolveDiagnostic {
  return {
    code: "SKETCH_TANGENCY_OUTSIDE_ARC",
    severity: "blocker",
    message:
      "Tangency contact lies on the support circle but outside the finite arc interval.",
    sourceType: "constraint",
    sourceId: constraintId,
    constraintKind: "tangent",
    targetId: arcId,
    expected: "contact inside authored finite arc",
    received: "support-circle-only contact"
  };
}

function branchDiagnostic(
  constraintId: string,
  received: string
): SketchSolveDiagnostic {
  return {
    code: "SKETCH_ARC_SOLVE_BRANCH_INVALID",
    severity: "blocker",
    message:
      "Tangency solve would change the branch selected by authored geometry.",
    sourceType: "constraint",
    sourceId: constraintId,
    constraintKind: "tangent",
    expected: "authored tangency branch",
    received
  };
}

function createResult({
  model,
  settings,
  stateAccess,
  state,
  status,
  iterations,
  diagnostics,
  residuals,
  independentResidualCount
}: {
  readonly model: SketchSolveModel;
  readonly settings: SketchSolveSettings;
  readonly stateAccess: SolverStateAccess;
  readonly state: readonly number[];
  readonly status: SketchSolveStatus;
  readonly iterations: number;
  readonly diagnostics: readonly SketchSolveDiagnostic[];
  readonly residuals: readonly number[];
  readonly independentResidualCount?: number;
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
  const arcs = (model.arcs ?? []).map((arcVariable) => {
    const arc = readArc(state, stateAccess, arcVariable.id);
    const startAngleDegrees = normalizeDegrees(arc.startAngleDegrees);
    return {
      id: arcVariable.id,
      center: [cleanNumber(arc.center[0]), cleanNumber(arc.center[1])] as const,
      radius: cleanNumber(arc.radius),
      startAngleDegrees: cleanNumber(startAngleDegrees),
      sweepAngleDegrees: cleanNumber(arc.sweepAngleDegrees),
      start: cleanVec2(
        pointOnCircle(arc.center, arc.radius, startAngleDegrees)
      ),
      end: cleanVec2(
        pointOnCircle(
          arc.center,
          arc.radius,
          startAngleDegrees + arc.sweepAngleDegrees
        )
      )
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
      stateAccess.variables.length -
        (independentResidualCount ??
          Math.min(stateAccess.variables.length, residuals.length))
    ),
    maxResidual: cleanNumber(maxResidual),
    rmsResidual: cleanNumber(getRmsResidual(residuals)),
    settings,
    points,
    scalars,
    arcs,
    diagnosticCount: diagnostics.length,
    diagnostics
  };
}

function cleanVec2(value: SketchSolverVec2): SketchSolverVec2 {
  return [cleanNumber(value[0]), cleanNumber(value[1])];
}

function normalizeDegrees(value: number): number {
  const normalized = ((value % 360) + 360) % 360;
  return Object.is(normalized, -0) ? 0 : normalized;
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

interface ArcState {
  readonly center: SketchSolverVec2;
  readonly radius: number;
  readonly startAngleDegrees: number;
  readonly sweepAngleDegrees: number;
}

function readArc(
  state: readonly number[],
  stateAccess: SolverStateAccess,
  arcId: string
): ArcState {
  const index = stateAccess.arcIndex.get(arcId);
  if (index === undefined) {
    return {
      center: [Number.NaN, Number.NaN],
      radius: Number.NaN,
      startAngleDegrees: Number.NaN,
      sweepAngleDegrees: Number.NaN
    };
  }
  return {
    center: [state[index], state[index + 1]],
    radius: state[index + 2],
    startAngleDegrees: state[index + 3],
    sweepAngleDegrees: state[index + 4]
  };
}

function readInitialArc(
  stateAccess: SolverStateAccess,
  arcId: string
): ArcState | undefined {
  if (!stateAccess.arcIndex.has(arcId)) return undefined;
  return readArc(
    stateAccess.variables.map((variable) => variable.initial),
    stateAccess,
    arcId
  );
}

function readPointTarget(
  state: readonly number[],
  stateAccess: SolverStateAccess,
  target: SketchSolvePointTarget
): SketchSolverVec2 {
  if (target.kind === "point") {
    return readPoint(state, stateAccess, target.pointId);
  }
  const arc = readArc(state, stateAccess, target.arcId);
  if (target.role === "center") return arc.center;
  const angle =
    target.role === "start"
      ? arc.startAngleDegrees
      : arc.startAngleDegrees + arc.sweepAngleDegrees;
  return pointOnCircle(arc.center, arc.radius, angle);
}

function readCurveCenter(
  state: readonly number[],
  stateAccess: SolverStateAccess,
  target: SketchSolveRadiusCurveTarget
): SketchSolverVec2 {
  return target.kind === "arc"
    ? readArc(state, stateAccess, target.arcId).center
    : readPoint(state, stateAccess, target.centerPointId);
}

function readCurveRadius(
  state: readonly number[],
  stateAccess: SolverStateAccess,
  target: SketchSolveRadiusCurveTarget
): number {
  return target.kind === "arc"
    ? readArc(state, stateAccess, target.arcId).radius
    : readScalar(state, stateAccess, target.radiusId);
}

function pointOnCircle(
  center: SketchSolverVec2,
  radius: number,
  angleDegrees: number
): SketchSolverVec2 {
  const angle = (angleDegrees * Math.PI) / 180;
  return [
    center[0] + radius * Math.cos(angle),
    center[1] + radius * Math.sin(angle)
  ];
}

function cross(a: SketchSolverVec2, b: SketchSolverVec2): number {
  return a[0] * b[1] - a[1] * b[0];
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

function readInitialScalar(
  stateAccess: SolverStateAccess,
  scalarId: SketchSolverScalarId
): number | undefined {
  const index = stateAccess.scalarIndex.get(scalarId);

  if (index === undefined) {
    return undefined;
  }

  const value = stateAccess.variables[index]?.initial;
  return Number.isFinite(value) ? value : undefined;
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

function isValidTargetId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isWholeArcTarget(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { readonly kind?: unknown }).kind === "arc" &&
    !("role" in value)
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
    source.kind === "circleRadius" ||
    source.kind === "arcRadius" ||
    source.kind === "arcSweep"
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

function formatConstraintKindForMessage(
  kind: SketchSolveConstraintKind
): string {
  return kind
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (character) => character.toUpperCase());
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
