import {
  evaluateSketchResidualsAtInitialState,
  type SketchInitialResidualEvaluation,
  type SketchInitialResidualRecord,
  type SketchSolveStatus
} from "@web-cad/sketch-solver";
import type {
  CadSketchSolverStatus,
  SketchConstraintId,
  SketchDimensionId,
  SketchEntitySnapshot,
  WcadSourceIdentity
} from "@web-cad/cad-protocol";

import {
  createSketchCurveEditSourceRevision,
  createSketchSolverEvaluationIdentity,
  type SketchCurveEditSourceRevision,
  type SketchSolverConstraintResidualEvidence,
  type SketchSolverDimensionResidualEvidence,
  type SketchSolverEvaluationIdentity
} from "./sketchCurveEditIdentity";
import {
  evaluateSketchGeometry,
  type SketchSolverDocument,
  type SketchSolverSketch
} from "./sketchSolver";
import { createSketchSolveModelFromCadSource } from "./sketchSolverPackageMapping";

export interface SketchCurveEditEvaluationDiagnostic {
  readonly code: string;
  readonly message: string;
}

export interface SketchCurveEditEvaluationEvidence {
  readonly sourceRevision: SketchCurveEditSourceRevision;
  readonly solverEvaluationIdentity?: SketchSolverEvaluationIdentity;
  readonly solverStatus: CadSketchSolverStatus;
  readonly evaluatedEntities: ReadonlyMap<string, SketchEntitySnapshot>;
  readonly constraintResiduals: readonly SketchSolverConstraintResidualEvidence[];
  readonly dimensionResiduals: readonly SketchSolverDimensionResidualEvidence[];
  readonly authoredResidualEvaluation?: SketchInitialResidualEvaluation;
  readonly diagnostics: readonly SketchCurveEditEvaluationDiagnostic[];
  readonly blocked: boolean;
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function arraysEqual(
  left: readonly string[],
  right: readonly string[]
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function mapSolveStatus(status: SketchSolveStatus): CadSketchSolverStatus {
  switch (status) {
    case "not-run":
      return "not-run";
    case "converged":
      return "fully-defined";
    case "under-defined":
      return "under-defined";
    case "over-defined":
      return "over-defined";
    case "conflicting":
      return "conflicting";
    case "failed":
    case "unsupported":
      return status;
  }
}

function createConstraintResidualEvidence(
  ids: readonly SketchConstraintId[],
  residuals: ReadonlyMap<string, SketchInitialResidualRecord>
): readonly SketchSolverConstraintResidualEvidence[] {
  return ids.map((id) => {
    const residual = residuals.get(`constraint:${id}`);
    if (!residual || residual.sourceType !== "constraint") {
      throw new Error(`Missing exact constraint residual for ${id}.`);
    }
    return {
      id,
      family: residual.family,
      status: residual.satisfied ? "healthy" : "inconsistent",
      residual: residual.maxResidual
    };
  });
}

function createDimensionResidualEvidence(
  ids: readonly SketchDimensionId[],
  residuals: ReadonlyMap<string, SketchInitialResidualRecord>
): readonly SketchSolverDimensionResidualEvidence[] {
  return ids.map((id) => {
    const residual = residuals.get(`dimension:${id}`);
    if (!residual || residual.sourceType !== "dimension") {
      throw new Error(`Missing exact dimension residual for ${id}.`);
    }
    return {
      id,
      family: residual.family,
      status: residual.satisfied ? "healthy" : "inconsistent",
      residual: residual.maxResidual
    };
  });
}

/**
 * Produces revision-bound solver evidence without a free numerical solve.
 * Every authoritative record must map to exactly one existing solver residual
 * block; unsupported V22 forms remain explicitly blocked until their solver
 * family lands.
 */
export function createSketchCurveEditEvaluationEvidence({
  sourceIdentity,
  document,
  sketch
}: {
  readonly sourceIdentity: Pick<WcadSourceIdentity, "algorithm" | "sha256">;
  readonly document: SketchSolverDocument;
  readonly sketch: SketchSolverSketch;
}): SketchCurveEditEvaluationEvidence {
  const sourceRevision = createSketchCurveEditSourceRevision(sourceIdentity);
  const evaluatedGeometry = evaluateSketchGeometry(document, sketch);
  const evaluatedSketch: SketchSolverSketch = {
    ...sketch,
    entities: evaluatedGeometry.entities
  };
  const constraintIds = [...document.sketchConstraints.values()]
    .filter((constraint) => constraint.sketchId === sketch.id)
    .map((constraint) => constraint.id)
    .sort(compareCodeUnits);
  const dimensionIds = [...document.sketchDimensions.values()]
    .filter((dimension) => dimension.sketchId === sketch.id)
    .map((dimension) => dimension.id)
    .sort(compareCodeUnits);
  const solverRecordCount = constraintIds.length + dimensionIds.length;

  if (solverRecordCount === 0) {
    return {
      sourceRevision,
      solverEvaluationIdentity: "none",
      solverStatus: "not-run",
      evaluatedEntities: evaluatedGeometry.entities,
      constraintResiduals: [],
      dimensionResiduals: [],
      diagnostics: [],
      blocked: false
    };
  }

  const build = createSketchSolveModelFromCadSource(document, evaluatedSketch);
  const mappedConstraintIds = (build.model.constraints ?? [])
    .map((constraint) => constraint.id)
    .sort(compareCodeUnits);
  const mappedDimensionIds = (build.model.dimensions ?? [])
    .map((dimension) => dimension.id)
    .sort(compareCodeUnits);
  const mappingComplete =
    arraysEqual(constraintIds, mappedConstraintIds) &&
    arraysEqual(dimensionIds, mappedDimensionIds);
  const authoredResidualEvaluation = evaluateSketchResidualsAtInitialState(
    build.model
  );
  const diagnostics: SketchCurveEditEvaluationDiagnostic[] = [
    ...build.diagnostics.map(({ code, message }) => ({ code, message })),
    ...authoredResidualEvaluation.diagnostics.map(({ code, message }) => ({
      code,
      message
    }))
  ];

  if (!mappingComplete || authoredResidualEvaluation.status !== "evaluated") {
    if (!mappingComplete) {
      diagnostics.push({
        code: "SKETCH_EDIT_SOLVER_RECORD_MAPPING_INCOMPLETE",
        message:
          "Every authoritative sketch constraint and dimension must map to one authored-state residual record."
      });
    }
    return {
      sourceRevision,
      solverStatus:
        authoredResidualEvaluation.status === "unsupported"
          ? "unsupported"
          : "failed",
      evaluatedEntities: evaluatedGeometry.entities,
      constraintResiduals: [],
      dimensionResiduals: [],
      authoredResidualEvaluation,
      diagnostics,
      blocked: true
    };
  }

  const residuals = new Map<string, SketchInitialResidualRecord>(
    authoredResidualEvaluation.records.map((record) => [
      `${record.sourceType}:${record.sourceId}`,
      record
    ])
  );
  const residualMappingComplete =
    residuals.size === solverRecordCount &&
    constraintIds.every((id) => residuals.has(`constraint:${id}`)) &&
    dimensionIds.every((id) => residuals.has(`dimension:${id}`));
  if (!residualMappingComplete) {
    return {
      sourceRevision,
      solverStatus: "failed",
      evaluatedEntities: evaluatedGeometry.entities,
      constraintResiduals: [],
      dimensionResiduals: [],
      authoredResidualEvaluation,
      diagnostics: [
        ...diagnostics,
        {
          code: "SKETCH_EDIT_SOLVER_RESIDUAL_EVIDENCE_INCOMPLETE",
          message:
            "Authored-state evaluation did not return exactly one residual record per authoritative solver record."
        }
      ],
      blocked: true
    };
  }

  const constraintResiduals = createConstraintResidualEvidence(
    constraintIds,
    residuals
  );
  const dimensionResiduals = createDimensionResidualEvidence(
    dimensionIds,
    residuals
  );
  const solverStatus = mapSolveStatus(authoredResidualEvaluation.solveStatus);
  let solverEvaluationIdentity: SketchSolverEvaluationIdentity;
  try {
    solverEvaluationIdentity = createSketchSolverEvaluationIdentity({
      sourceRevision,
      sketchId: sketch.id,
      solverStatus,
      solverRecordCount,
      evaluatedEntities: evaluatedGeometry.entities,
      orderedConstraintResiduals: constraintResiduals,
      orderedDimensionResiduals: dimensionResiduals
    });
  } catch (error) {
    return {
      sourceRevision,
      solverStatus: "failed",
      evaluatedEntities: evaluatedGeometry.entities,
      constraintResiduals,
      dimensionResiduals,
      authoredResidualEvaluation,
      diagnostics: [
        ...diagnostics,
        {
          code: "SKETCH_EDIT_SOLVER_IDENTITY_EVIDENCE_INVALID",
          message:
            error instanceof Error
              ? error.message
              : "Solver evaluation identity evidence is invalid."
        }
      ],
      blocked: true
    };
  }
  const blocked = !(
    solverStatus === "fully-defined" ||
    solverStatus === "under-defined" ||
    solverStatus === "over-defined" ||
    solverStatus === "redundant"
  );

  return {
    sourceRevision,
    solverEvaluationIdentity,
    solverStatus,
    evaluatedEntities: evaluatedGeometry.entities,
    constraintResiduals,
    dimensionResiduals,
    authoredResidualEvaluation,
    diagnostics,
    blocked
  };
}

export function getSketchCurveEditResidualRecord(
  evidence: SketchCurveEditEvaluationEvidence,
  sourceType: "constraint" | "dimension",
  sourceId: SketchConstraintId | SketchDimensionId
):
  | SketchSolverConstraintResidualEvidence
  | SketchSolverDimensionResidualEvidence
  | undefined {
  return (
    sourceType === "constraint"
      ? evidence.constraintResiduals
      : evidence.dimensionResiduals
  ).find((record) => record.id === sourceId);
}
