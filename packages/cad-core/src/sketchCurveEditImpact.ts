import {
  evaluateSketchResidualsAtInitialState,
  type SketchInitialResidualEvaluation,
  type SketchInitialResidualRecord,
  type SketchSolveDiagnostic
} from "@web-cad/sketch-solver";
import type {
  CadSketchSolverDiagnostic,
  CadSketchConstraintRef,
  CadSketchDimensionRefCurrent,
  CadSketchSolverStatus,
  FeatureSnapshot,
  FeatureSnapshotV21,
  FeatureSnapshotV22,
  SketchConstraintId,
  SketchConstraintSnapshot,
  SketchCurveEditConstraintImpact,
  SketchCurveEditDimensionImpact,
  SketchCurveEditImpact,
  SketchDimensionId,
  SketchDimensionSnapshotV22,
  SketchEntityId,
  SketchEntityKind,
  SketchEntitySnapshot
} from "@web-cad/cad-protocol";

import {
  collectSketchCurveEditFeatureDependencies,
  type SketchCurveEditFeatureDependency
} from "./sketchCurveEditDependencies";
import type { SketchCurveEditPlan } from "./sketchCurveEditPlans";
import {
  compareSketchCurveEditRecordIds,
  createSketchPointTargetProvenanceKey,
  retargetSketchCurveEditConstraint,
  retargetSketchCurveEditDimension,
  sortUniqueSketchCurveEditRecordIds,
  type SketchCurveEditConstraintTargetResult,
  type SketchCurveEditDimensionTargetResult,
  type SketchCurveEditRecordTargetContext,
  type SketchEndpointProvenance
} from "./sketchCurveEditRecordTargets";
import {
  type SketchSolverDocument,
  type SketchSolverSketch
} from "./sketchSolver";
import {
  createSketchSolveModelFromCadSource,
  type SketchSolverPackageModelBuild
} from "./sketchSolverPackageMapping";
import {
  downconvertSketchDimensionSnapshotV22,
  normalizeSketchDimensionSnapshotV22
} from "./v22SourceShapes";

export type MaterializedSketchCurveEditPlan = SketchCurveEditPlan & {
  readonly materialized: NonNullable<SketchCurveEditPlan["materialized"]>;
};

export interface SketchCurveEditImpactInput {
  readonly document: SketchSolverDocument;
  readonly sketch: SketchSolverSketch;
  readonly features: Iterable<
    FeatureSnapshot | FeatureSnapshotV21 | FeatureSnapshotV22
  >;
  readonly plan: MaterializedSketchCurveEditPlan;
  readonly operation: SketchCurveEditPlan["operation"];
}

export interface SketchCurveEditImpactReady {
  readonly status: "ready";
  readonly impact: SketchCurveEditImpact;
  readonly entities: ReadonlyMap<SketchEntityId, SketchEntitySnapshot>;
  readonly constraints: ReadonlyMap<
    SketchConstraintId,
    SketchConstraintSnapshot
  >;
  readonly dimensions: ReadonlyMap<
    SketchDimensionId,
    SketchDimensionSnapshotV22
  >;
  readonly residualEvaluation: SketchInitialResidualEvaluation;
}

export interface SketchCurveEditDependencyBlocked {
  readonly status: "blocked";
  readonly code: "SKETCH_ENTITY_IN_USE";
  readonly reason: "feature-dependency";
  readonly sourceEntityId: SketchEntityId;
  readonly affectedFeatureIds: readonly string[];
  readonly dependencies: readonly SketchCurveEditFeatureDependency[];
}

export interface SketchCurveEditPlanBlocked {
  readonly status: "blocked";
  readonly code: "SKETCH_EDIT_GEOMETRY_INVALID";
  readonly reason: "invalid-materialized-plan";
  readonly sourceEntityId: SketchEntityId;
  readonly message: string;
}

export interface SketchCurveEditResidualBlocked {
  readonly status: "blocked";
  readonly code: "SKETCH_EDIT_SOLVER_STATE_BLOCKED";
  readonly reason: "residual-evaluation";
  readonly sourceEntityId: SketchEntityId;
  readonly message: string;
  readonly expectedConstraintIds: readonly SketchConstraintId[];
  readonly mappedConstraintIds: readonly SketchConstraintId[];
  readonly expectedDimensionIds: readonly SketchDimensionId[];
  readonly mappedDimensionIds: readonly SketchDimensionId[];
  readonly diagnostics: readonly (
    | CadSketchSolverDiagnostic
    | SketchSolveDiagnostic
  )[];
}

export type SketchCurveEditImpactResult =
  | SketchCurveEditImpactReady
  | SketchCurveEditDependencyBlocked
  | SketchCurveEditPlanBlocked
  | SketchCurveEditResidualBlocked;

export interface SketchCurveEditDeleteListMismatch {
  readonly status: "blocked";
  readonly code: "SKETCH_EDIT_DELETE_LIST_MISMATCH";
  readonly expectedConstraintIds: readonly SketchConstraintId[];
  readonly receivedConstraintIds: readonly SketchConstraintId[];
  readonly expectedDimensionIds: readonly SketchDimensionId[];
  readonly receivedDimensionIds: readonly SketchDimensionId[];
  readonly impact: SketchCurveEditImpact;
}

export type FinalizeSketchCurveEditImpactResult =
  | {
      readonly status: "ready";
      readonly impact: SketchCurveEditImpact;
    }
  | SketchCurveEditDeleteListMismatch;

interface StructuralRecords {
  readonly constraints: readonly SketchCurveEditConstraintTargetResult[];
  readonly dimensions: readonly SketchCurveEditDimensionTargetResult[];
}

interface ResidualEvaluationReady {
  readonly status: "ready";
  readonly solverStatus: CadSketchSolverStatus;
  readonly build: SketchSolverPackageModelBuild;
  readonly evaluation: SketchInitialResidualEvaluation;
}

type ResidualEvaluationResult =
  | ResidualEvaluationReady
  | SketchCurveEditResidualBlocked;

export interface ExactSketchAuthoredResidualStateReady {
  readonly status: "ready";
  readonly solverStatus: CadSketchSolverStatus;
  readonly build: SketchSolverPackageModelBuild;
  readonly evaluation: SketchInitialResidualEvaluation;
}

export interface ExactSketchAuthoredResidualStateBlocked {
  readonly status: "blocked";
  readonly message: string;
  readonly build: SketchSolverPackageModelBuild;
  readonly evaluation: SketchInitialResidualEvaluation;
  readonly expectedConstraintIds: readonly SketchConstraintId[];
  readonly mappedConstraintIds: readonly SketchConstraintId[];
  readonly expectedDimensionIds: readonly SketchDimensionId[];
  readonly mappedDimensionIds: readonly SketchDimensionId[];
}

export type ExactSketchAuthoredResidualStateResult =
  | ExactSketchAuthoredResidualStateReady
  | ExactSketchAuthoredResidualStateBlocked;

export function createSketchCurveEditImpact(
  input: SketchCurveEditImpactInput
): SketchCurveEditImpactResult {
  if (input.operation !== input.plan.operation) {
    return invalidPlan(
      input.plan,
      `Operation '${input.operation}' does not match materialized plan operation '${input.plan.operation}'.`
    );
  }

  const postEntitiesResult = createPostEntities(input.sketch, input.plan);
  if (postEntitiesResult.status === "blocked") return postEntitiesResult;
  const contextResult = createRecordTargetContext(
    input.sketch,
    postEntitiesResult.entities,
    input.plan
  );
  if (contextResult.status === "blocked") return contextResult;

  const dependencies = collectSketchCurveEditFeatureDependencies(
    input.features,
    input.sketch.id,
    [input.plan.sourceEntityId]
  );
  if (
    input.plan.materialized.replacement.disposition === "deleted" &&
    dependencies.length > 0
  ) {
    return {
      status: "blocked",
      code: "SKETCH_ENTITY_IN_USE",
      reason: "feature-dependency",
      sourceEntityId: input.plan.sourceEntityId,
      affectedFeatureIds: dependencies.map(
        (dependency) => dependency.featureId
      ),
      dependencies
    };
  }

  const structural = classifyStructuralRecords(input, contextResult.context);
  const structurallyInvalidConstraintIds = new Set(
    structural.constraints
      .filter((result) => result.disposition === "invalid")
      .map((result) => result.before.id)
  );
  const structurallyInvalidDimensionIds = new Set(
    structural.dimensions
      .filter((result) => result.disposition === "invalid")
      .map((result) => result.before.id)
  );
  const structuralDocument = createPostDocument({
    document: input.document,
    constraints: structural.constraints,
    dimensions: structural.dimensions,
    deletedConstraintIds: structurallyInvalidConstraintIds,
    deletedDimensionIds: structurallyInvalidDimensionIds
  });
  const postSketch = {
    ...input.sketch,
    entities: postEntitiesResult.entities
  };
  const firstResiduals = evaluateExactResiduals({
    document: structuralDocument,
    sketch: postSketch,
    plan: input.plan
  });
  if (firstResiduals.status === "blocked") return firstResiduals;

  const structuralConstraintById = new Map(
    structural.constraints.map((result) => [result.before.id, result])
  );
  const structuralDimensionById = new Map(
    structural.dimensions.map((result) => [result.before.id, result])
  );
  const residualConstraintById = residualRecordsById(
    firstResiduals.evaluation,
    "constraint"
  );
  const residualDimensionById = residualRecordsById(
    firstResiduals.evaluation,
    "dimension"
  );
  const residualInvalidConstraintIds = new Set<SketchConstraintId>();
  const residualInvalidDimensionIds = new Set<SketchDimensionId>();

  for (const record of residualConstraintById.values()) {
    if (record.satisfied) continue;
    const structuralResult = structuralConstraintById.get(record.sourceId);
    if (
      structuralResult?.disposition === "preserved" ||
      structuralResult?.disposition === "retargeted"
    ) {
      residualInvalidConstraintIds.add(record.sourceId);
      continue;
    }
    return residualBlocked({
      plan: input.plan,
      message: `Unaffected constraint '${record.sourceId}' is not satisfied at the exact post-edit authored state.`,
      build: firstResiduals.build,
      evaluation: firstResiduals.evaluation,
      expectedConstraintIds: expectedRecordIds(
        structuralDocument.sketchConstraints,
        input.sketch.id
      ),
      expectedDimensionIds: expectedRecordIds(
        structuralDocument.sketchDimensions,
        input.sketch.id
      )
    });
  }
  for (const record of residualDimensionById.values()) {
    if (record.satisfied) continue;
    const structuralResult = structuralDimensionById.get(record.sourceId);
    if (
      structuralResult?.disposition === "preserved" ||
      structuralResult?.disposition === "retargeted"
    ) {
      residualInvalidDimensionIds.add(record.sourceId);
      continue;
    }
    return residualBlocked({
      plan: input.plan,
      message: `Unaffected dimension '${record.sourceId}' is not satisfied at the exact post-edit authored state.`,
      build: firstResiduals.build,
      evaluation: firstResiduals.evaluation,
      expectedConstraintIds: expectedRecordIds(
        structuralDocument.sketchConstraints,
        input.sketch.id
      ),
      expectedDimensionIds: expectedRecordIds(
        structuralDocument.sketchDimensions,
        input.sketch.id
      )
    });
  }

  const invalidConstraintIds = new Set([
    ...structurallyInvalidConstraintIds,
    ...residualInvalidConstraintIds
  ]);
  const invalidDimensionIds = new Set([
    ...structurallyInvalidDimensionIds,
    ...residualInvalidDimensionIds
  ]);
  const finalDocument = createPostDocument({
    document: input.document,
    constraints: structural.constraints,
    dimensions: structural.dimensions,
    deletedConstraintIds: invalidConstraintIds,
    deletedDimensionIds: invalidDimensionIds
  });
  const finalResiduals = evaluateExactResiduals({
    document: finalDocument,
    sketch: postSketch,
    plan: input.plan
  });
  if (finalResiduals.status === "blocked") return finalResiduals;
  const remainingUnsatisfied = finalResiduals.evaluation.records.find(
    (record) => !record.satisfied
  );
  if (remainingUnsatisfied) {
    return residualBlocked({
      plan: input.plan,
      message: `Surviving ${remainingUnsatisfied.sourceType} '${remainingUnsatisfied.sourceId}' is not satisfied after removing the complete invalid-record set.`,
      build: finalResiduals.build,
      evaluation: finalResiduals.evaluation,
      expectedConstraintIds: expectedRecordIds(
        finalDocument.sketchConstraints,
        input.sketch.id
      ),
      expectedDimensionIds: expectedRecordIds(
        finalDocument.sketchDimensions,
        input.sketch.id
      )
    });
  }

  const constraintImpacts = structural.constraints.map((result) =>
    createConstraintImpact(
      result,
      invalidConstraintIds,
      residualConstraintById.get(result.before.id)
    )
  );
  const dimensionImpacts = structural.dimensions.map((result) =>
    createDimensionImpact(
      result,
      invalidDimensionIds,
      residualDimensionById.get(result.before.id)
    )
  );
  const requiredDeleteConstraintIds = sortUniqueSketchCurveEditRecordIds([
    ...invalidConstraintIds
  ]);
  const requiredDeleteDimensionIds = sortUniqueSketchCurveEditRecordIds([
    ...invalidDimensionIds
  ]);
  const postEditSolverStatus = finalResiduals.solverStatus;
  if (
    postEditSolverStatus === "conflicting" ||
    postEditSolverStatus === "failed" ||
    postEditSolverStatus === "unsupported" ||
    postEditSolverStatus === "missing-target"
  ) {
    return residualBlocked({
      plan: input.plan,
      message: `Exact post-edit authored state has blocked solver status '${postEditSolverStatus}'.`,
      build: finalResiduals.build,
      evaluation: finalResiduals.evaluation,
      expectedConstraintIds: expectedRecordIds(
        finalDocument.sketchConstraints,
        input.sketch.id
      ),
      expectedDimensionIds: expectedRecordIds(
        finalDocument.sketchDimensions,
        input.sketch.id
      )
    });
  }

  return {
    status: "ready",
    impact: {
      sketchId: input.sketch.id,
      operation: input.operation,
      replacements: [input.plan.materialized.replacement],
      constraintImpacts,
      dimensionImpacts,
      requiredDeleteConstraintIds,
      requiredDeleteDimensionIds,
      affectedFeatureIds: dependencies.map(
        (dependency) => dependency.featureId
      ),
      postEditSolverStatus
    },
    entities: postEntitiesResult.entities,
    constraints: new Map(
      [...finalDocument.sketchConstraints].filter(
        ([, constraint]) => constraint.sketchId === input.sketch.id
      )
    ),
    dimensions: new Map(
      [...finalDocument.sketchDimensions]
        .filter(([, dimension]) => dimension.sketchId === input.sketch.id)
        .map(([id, dimension]) => [
          id,
          normalizeSketchDimensionSnapshotV22(dimension)
        ])
    ),
    residualEvaluation: finalResiduals.evaluation
  };
}

export function finalizeSketchCurveEditImpactForApply(
  impact: SketchCurveEditImpact,
  deleteConstraintIds: readonly SketchConstraintId[],
  deleteDimensionIds: readonly SketchDimensionId[]
): FinalizeSketchCurveEditImpactResult {
  const receivedConstraintIds =
    sortUniqueSketchCurveEditRecordIds(deleteConstraintIds);
  const receivedDimensionIds =
    sortUniqueSketchCurveEditRecordIds(deleteDimensionIds);
  if (
    deleteConstraintIds.length !== receivedConstraintIds.length ||
    deleteDimensionIds.length !== receivedDimensionIds.length ||
    !sameOrderedIds(
      impact.requiredDeleteConstraintIds,
      receivedConstraintIds
    ) ||
    !sameOrderedIds(impact.requiredDeleteDimensionIds, receivedDimensionIds)
  ) {
    return {
      status: "blocked",
      code: "SKETCH_EDIT_DELETE_LIST_MISMATCH",
      expectedConstraintIds: impact.requiredDeleteConstraintIds,
      receivedConstraintIds,
      expectedDimensionIds: impact.requiredDeleteDimensionIds,
      receivedDimensionIds,
      impact
    };
  }
  const constraintIds = new Set(receivedConstraintIds);
  const dimensionIds = new Set(receivedDimensionIds);
  return {
    status: "ready",
    impact: {
      ...impact,
      constraintImpacts: impact.constraintImpacts.map((entry) =>
        entry.disposition === "invalid" && constraintIds.has(entry.id)
          ? { ...entry, disposition: "deleted-by-request" as const }
          : entry
      ),
      dimensionImpacts: impact.dimensionImpacts.map((entry) =>
        entry.disposition === "invalid" && dimensionIds.has(entry.id)
          ? { ...entry, disposition: "deleted-by-request" as const }
          : entry
      )
    }
  };
}

function createPostEntities(
  sketch: SketchSolverSketch,
  plan: MaterializedSketchCurveEditPlan
):
  | {
      readonly status: "ready";
      readonly entities: ReadonlyMap<SketchEntityId, SketchEntitySnapshot>;
    }
  | SketchCurveEditPlanBlocked {
  if (plan.pieces.length !== plan.materialized.entities.length) {
    return invalidPlan(
      plan,
      "Materialized entity count does not match the analytic plan piece count."
    );
  }
  if (!sketch.entities.has(plan.sourceEntityId)) {
    return invalidPlan(
      plan,
      `Source entity '${plan.sourceEntityId}' is missing from the current sketch.`
    );
  }
  const entities = new Map(sketch.entities);
  entities.delete(plan.sourceEntityId);
  for (const [index, entity] of plan.materialized.entities.entries()) {
    const piece = plan.pieces[index];
    const plannedId =
      piece?.id.kind === "preserved" ? piece.id.entityId : piece?.id.entityId;
    if (!piece || plannedId !== entity.id) {
      return invalidPlan(
        plan,
        `Materialized entity '${entity.id}' does not match analytic piece ${index}.`
      );
    }
    if (entity.id !== plan.sourceEntityId && sketch.entities.has(entity.id)) {
      return invalidPlan(
        plan,
        `Materialized entity ID '${entity.id}' collides with the current sketch.`
      );
    }
    if (entities.has(entity.id)) {
      return invalidPlan(
        plan,
        `Materialized entity ID '${entity.id}' occurs more than once.`
      );
    }
    entities.set(entity.id, cloneEntity(entity));
  }
  const replacement = plan.materialized.replacement;
  if (
    replacement.sourceEntityId !== plan.sourceEntityId ||
    !sameOrderedIds(
      replacement.resultEntityIds,
      plan.materialized.entities.map((entity) => entity.id)
    ) ||
    (replacement.disposition === "modified" &&
      replacement.preservedResultEntityId !== plan.sourceEntityId) ||
    (replacement.disposition === "deleted" &&
      replacement.preservedResultEntityId !== undefined)
  ) {
    return invalidPlan(
      plan,
      "Materialized replacement evidence is inconsistent."
    );
  }
  return { status: "ready", entities };
}

function createRecordTargetContext(
  sketch: SketchSolverSketch,
  postEntities: ReadonlyMap<SketchEntityId, SketchEntitySnapshot>,
  plan: MaterializedSketchCurveEditPlan
):
  | {
      readonly status: "ready";
      readonly context: SketchCurveEditRecordTargetContext;
    }
  | SketchCurveEditPlanBlocked {
  const sourceEntityKinds = new Map<SketchEntityId, SketchEntityKind>(
    [...sketch.entities].map(([id, entity]) => [id, entity.kind])
  );
  const resultEntityKinds = new Map<SketchEntityId, SketchEntityKind>(
    [...postEntities].map(([id, entity]) => [id, entity.kind])
  );
  const endpointProvenance = new Map<string, SketchEndpointProvenance>();
  const sourceKind = sourceEntityKinds.get(plan.sourceEntityId);

  for (const [pieceIndex, piece] of plan.pieces.entries()) {
    const entity = plan.materialized.entities[pieceIndex];
    if (!entity) {
      return invalidPlan(plan, `Plan piece ${pieceIndex} is not materialized.`);
    }
    for (const role of ["start", "end"] as const) {
      const sourceEndpoint = piece.endpointProvenance[role].sourceEndpoint;
      if (!sourceEndpoint) continue;
      if (
        (sourceKind !== "line" && sourceKind !== "arc") ||
        (entity.kind !== "line" && entity.kind !== "arc")
      ) {
        return invalidPlan(
          plan,
          "Endpoint provenance requires line/arc source and result entities."
        );
      }
      const key = createSketchPointTargetProvenanceKey({
        entityId: plan.sourceEntityId,
        role: sourceEndpoint
      });
      if (endpointProvenance.has(key)) {
        return invalidPlan(
          plan,
          `Authored endpoint '${sourceEndpoint}' has more than one result owner.`
        );
      }
      endpointProvenance.set(key, {
        entityId: entity.id,
        entityKind: entity.kind,
        role
      });
    }
  }
  return {
    status: "ready",
    context: {
      replacements: [plan.materialized.replacement],
      endpointProvenance,
      sourceEntityKinds,
      resultEntityKinds
    }
  };
}

function classifyStructuralRecords(
  input: SketchCurveEditImpactInput,
  context: SketchCurveEditRecordTargetContext
): StructuralRecords {
  return {
    constraints: [...input.document.sketchConstraints.values()]
      .filter((constraint) => constraint.sketchId === input.sketch.id)
      .sort((left, right) => compareSketchCurveEditRecordIds(left.id, right.id))
      .map((constraint) =>
        retargetSketchCurveEditConstraint(constraint, context)
      ),
    dimensions: [...input.document.sketchDimensions.values()]
      .filter((dimension) => dimension.sketchId === input.sketch.id)
      .map(normalizeSketchDimensionSnapshotV22)
      .sort((left, right) => compareSketchCurveEditRecordIds(left.id, right.id))
      .map((dimension) => retargetSketchCurveEditDimension(dimension, context))
  };
}

function createPostDocument({
  document,
  constraints,
  dimensions,
  deletedConstraintIds,
  deletedDimensionIds
}: {
  readonly document: SketchSolverDocument;
  readonly constraints: readonly SketchCurveEditConstraintTargetResult[];
  readonly dimensions: readonly SketchCurveEditDimensionTargetResult[];
  readonly deletedConstraintIds: ReadonlySet<SketchConstraintId>;
  readonly deletedDimensionIds: ReadonlySet<SketchDimensionId>;
}): SketchSolverDocument {
  const sketchConstraints = new Map(document.sketchConstraints);
  for (const result of constraints) {
    if (deletedConstraintIds.has(result.before.id)) {
      sketchConstraints.delete(result.before.id);
    } else if (result.after) {
      sketchConstraints.set(result.after.id, result.after);
    }
  }
  const sketchDimensions = new Map(document.sketchDimensions);
  for (const result of dimensions) {
    if (deletedDimensionIds.has(result.before.id)) {
      sketchDimensions.delete(result.before.id);
    } else if (result.after) {
      sketchDimensions.set(result.after.id, result.after);
    }
  }
  return { ...document, sketchConstraints, sketchDimensions };
}

function evaluateExactResiduals({
  document,
  sketch,
  plan
}: {
  readonly document: SketchSolverDocument;
  readonly sketch: SketchSolverSketch;
  readonly plan: MaterializedSketchCurveEditPlan;
}): ResidualEvaluationResult {
  const result = evaluateExactSketchAuthoredResidualState({
    document,
    sketch
  });
  if (result.status === "ready") return result;
  return residualBlocked({
    plan,
    message: result.message,
    build: result.build,
    evaluation: result.evaluation,
    expectedConstraintIds: result.expectedConstraintIds,
    expectedDimensionIds: result.expectedDimensionIds
  });
}

export function evaluateExactSketchAuthoredResidualState({
  document,
  sketch
}: {
  readonly document: SketchSolverDocument;
  readonly sketch: SketchSolverSketch;
}): ExactSketchAuthoredResidualStateResult {
  const build = createSketchSolveModelFromCadSource(document, sketch);
  const evaluation = evaluateSketchResidualsAtInitialState(build.model);
  const expectedConstraintIds = expectedRecordIds(
    document.sketchConstraints,
    sketch.id
  );
  const expectedDimensionIds = expectedRecordIds(
    document.sketchDimensions,
    sketch.id
  );
  const mappedConstraintIds = sortUniqueSketchCurveEditRecordIds(
    build.model.constraints?.map((record) => record.id) ?? []
  );
  const mappedDimensionIds = sortUniqueSketchCurveEditRecordIds(
    build.model.dimensions?.map((record) => record.id) ?? []
  );
  const evaluatedConstraintIds = sortUniqueSketchCurveEditRecordIds(
    evaluation.records
      .filter((record) => record.sourceType === "constraint")
      .map((record) => record.sourceId)
  );
  const evaluatedDimensionIds = sortUniqueSketchCurveEditRecordIds(
    evaluation.records
      .filter((record) => record.sourceType === "dimension")
      .map((record) => record.sourceId)
  );
  if (
    !sameOrderedIds(expectedConstraintIds, mappedConstraintIds) ||
    !sameOrderedIds(expectedDimensionIds, mappedDimensionIds) ||
    !sameOrderedIds(mappedConstraintIds, evaluatedConstraintIds) ||
    !sameOrderedIds(mappedDimensionIds, evaluatedDimensionIds) ||
    evaluation.status !== "evaluated"
  ) {
    return {
      status: "blocked",
      message:
        "Post-edit solver records were unsupported, unmapped, duplicated, or blocked; exact residual evidence is required.",
      build,
      evaluation,
      expectedConstraintIds,
      mappedConstraintIds,
      expectedDimensionIds,
      mappedDimensionIds
    };
  }
  return {
    status: "ready",
    solverStatus:
      evaluation.records.length === 0
        ? "not-run"
        : mapPostEditSolverStatus(evaluation),
    build,
    evaluation
  };
}

function expectedRecordIds<
  T extends { readonly id: string; readonly sketchId: string }
>(records: ReadonlyMap<string, T>, sketchId: string): readonly string[] {
  return sortUniqueSketchCurveEditRecordIds(
    [...records.values()]
      .filter((record) => record.sketchId === sketchId)
      .map((record) => record.id)
  );
}

function residualRecordsById<T extends "constraint" | "dimension">(
  evaluation: SketchInitialResidualEvaluation,
  sourceType: T
): ReadonlyMap<
  string,
  Extract<SketchInitialResidualRecord, { readonly sourceType: T }>
> {
  return new Map(
    evaluation.records
      .filter(
        (
          record
        ): record is Extract<
          SketchInitialResidualRecord,
          { readonly sourceType: T }
        > => record.sourceType === sourceType
      )
      .map((record) => [record.sourceId, record])
  );
}

function createConstraintImpact(
  result: SketchCurveEditConstraintTargetResult,
  invalidIds: ReadonlySet<SketchConstraintId>,
  residual: SketchInitialResidualRecord | undefined
): SketchCurveEditConstraintImpact {
  const invalid = invalidIds.has(result.before.id);
  const affected = result.disposition !== "unaffected";
  return {
    id: result.before.id,
    disposition: invalid ? "invalid" : result.disposition,
    before: constraintRef(result.before),
    ...(!invalid && result.disposition !== "unaffected" && result.after
      ? { after: constraintRef(result.after) }
      : {}),
    ...(affected && residual
      ? {
          residualFamily: residual.family,
          residual: residual.maxResidual
        }
      : {})
  };
}

function createDimensionImpact(
  result: SketchCurveEditDimensionTargetResult,
  invalidIds: ReadonlySet<SketchDimensionId>,
  residual: SketchInitialResidualRecord | undefined
): SketchCurveEditDimensionImpact {
  const invalid = invalidIds.has(result.before.id);
  const affected = result.disposition !== "unaffected";
  return {
    id: result.before.id,
    disposition: invalid ? "invalid" : result.disposition,
    before: dimensionRef(result.before),
    ...(!invalid && result.disposition !== "unaffected" && result.after
      ? { after: dimensionRef(result.after) }
      : {}),
    ...(affected && residual
      ? {
          residualFamily: residual.family,
          residual: residual.maxResidual
        }
      : {})
  };
}

function constraintRef(
  constraint: SketchConstraintSnapshot
): CadSketchConstraintRef {
  return {
    id: constraint.id,
    name: constraint.name,
    sketchId: constraint.sketchId,
    entityId: constraint.entityId,
    kind: constraint.kind,
    ...(constraint.kind === "fixed"
      ? { target: { ...constraint.target } }
      : {}),
    ...(constraint.kind === "coincident"
      ? {
          primaryTarget: { ...constraint.primaryTarget },
          secondaryTarget: { ...constraint.secondaryTarget }
        }
      : {}),
    ...(constraint.kind === "midpoint"
      ? {
          lineEntityId: constraint.lineEntityId,
          target: { ...constraint.target }
        }
      : {}),
    ...(constraint.kind === "parallel" ||
    constraint.kind === "perpendicular" ||
    constraint.kind === "equalLength"
      ? {
          primaryLineEntityId: constraint.primaryLineEntityId,
          secondaryLineEntityId: constraint.secondaryLineEntityId
        }
      : {}),
    ...(constraint.kind === "tangent"
      ? {
          primaryCurveTarget: { ...constraint.primaryTarget },
          secondaryCurveTarget: { ...constraint.secondaryTarget }
        }
      : {}),
    ...(constraint.kind === "concentric" || constraint.kind === "equalRadius"
      ? {
          primaryTarget: { ...constraint.primaryTarget },
          secondaryTarget: { ...constraint.secondaryTarget }
        }
      : {}),
    ...(constraint.kind === "angle"
      ? {
          primaryLineEntityId: constraint.primaryLineEntityId,
          secondaryLineEntityId: constraint.secondaryLineEntityId,
          angleDegrees: constraint.angleDegrees
        }
      : {}),
    ...(constraint.kind === "symmetry"
      ? {
          primaryTarget: { ...constraint.primaryTarget },
          secondaryTarget: { ...constraint.secondaryTarget },
          symmetryLineEntityId: constraint.symmetryLineEntityId
        }
      : {})
  };
}

function dimensionRef(
  dimension: SketchDimensionSnapshotV22
): CadSketchDimensionRefCurrent {
  const legacy = downconvertSketchDimensionSnapshotV22(dimension);
  return legacy
    ? {
        id: legacy.id,
        name: legacy.name,
        sketchId: legacy.sketchId,
        entityId: legacy.entityId,
        target: { ...legacy.target },
        ...(legacy.valueSource.type === "parameter"
          ? { parameterId: legacy.valueSource.parameterId }
          : {})
      }
    : {
        sourceShape: "v22",
        id: dimension.id,
        name: dimension.name,
        sketchId: dimension.sketchId,
        target: cloneDimensionTarget(dimension.target),
        ...(dimension.valueSource.type === "parameter"
          ? { parameterId: dimension.valueSource.parameterId }
          : {})
      };
}

function cloneDimensionTarget(
  target: SketchDimensionSnapshotV22["target"]
): SketchDimensionSnapshotV22["target"] {
  switch (target.kind) {
    case "entityScalar":
    case "lineAngle":
      return { ...target };
    case "pointPair":
      return {
        ...target,
        primary: { ...target.primary },
        secondary: { ...target.secondary }
      };
    case "pointLineDistance":
      return { ...target, point: { ...target.point } };
  }
}

function mapPostEditSolverStatus(
  evaluation: SketchInitialResidualEvaluation
): CadSketchSolverStatus {
  switch (evaluation.solveStatus) {
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
      return "failed";
    case "unsupported":
      return "unsupported";
  }
}

function residualBlocked({
  plan,
  message,
  build,
  evaluation,
  expectedConstraintIds,
  expectedDimensionIds
}: {
  readonly plan: MaterializedSketchCurveEditPlan;
  readonly message: string;
  readonly build: SketchSolverPackageModelBuild;
  readonly evaluation: SketchInitialResidualEvaluation;
  readonly expectedConstraintIds: readonly SketchConstraintId[];
  readonly expectedDimensionIds: readonly SketchDimensionId[];
}): SketchCurveEditResidualBlocked {
  return {
    status: "blocked",
    code: "SKETCH_EDIT_SOLVER_STATE_BLOCKED",
    reason: "residual-evaluation",
    sourceEntityId: plan.sourceEntityId,
    message,
    expectedConstraintIds,
    mappedConstraintIds: sortUniqueSketchCurveEditRecordIds(
      build.model.constraints?.map((record) => record.id) ?? []
    ),
    expectedDimensionIds,
    mappedDimensionIds: sortUniqueSketchCurveEditRecordIds(
      build.model.dimensions?.map((record) => record.id) ?? []
    ),
    diagnostics: [...build.diagnostics, ...evaluation.diagnostics]
  };
}

function invalidPlan(
  plan: Pick<SketchCurveEditPlan, "sourceEntityId">,
  message: string
): SketchCurveEditPlanBlocked {
  return {
    status: "blocked",
    code: "SKETCH_EDIT_GEOMETRY_INVALID",
    reason: "invalid-materialized-plan",
    sourceEntityId: plan.sourceEntityId,
    message
  };
}

function sameOrderedIds(
  left: readonly string[],
  right: readonly string[]
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function cloneEntity(entity: SketchEntitySnapshot): SketchEntitySnapshot {
  switch (entity.kind) {
    case "point":
      return { ...entity, point: [entity.point[0], entity.point[1]] };
    case "line":
      return {
        ...entity,
        start: [entity.start[0], entity.start[1]],
        end: [entity.end[0], entity.end[1]]
      };
    case "rectangle":
    case "circle":
    case "arc":
      return {
        ...entity,
        center: [entity.center[0], entity.center[1]]
      };
  }
}
