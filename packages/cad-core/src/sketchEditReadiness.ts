import type {
  BodyId,
  CadBodyLifecycleSummary,
  CadBodySnapshot,
  CadFeatureSummary,
  CadOpsVersion,
  CadReferenceHealthEntry,
  CadReferenceHealthStatus,
  CadSketchConstraintCreateEditProposal,
  CadSketchEditAffectedSummary,
  CadSketchEditDiagnostic,
  CadSketchEditDiagnosticCode,
  CadSketchEditDryRunStatus,
  CadSketchEditEvaluationSummary,
  CadSketchEditFeatureImpact,
  CadSketchEditFeatureImpactKind,
  CadSketchEditHealthSummary,
  CadSketchEditProposal,
  CadSketchEditReadinessStatus,
  CadSketchEditReferenceEffectSummary,
  SketchEditReadinessQueryResponse,
  FeatureId,
  ParameterId,
  SketchConstraintEntry,
  SketchConstraintId,
  SketchConstraintSnapshot,
  SketchDimensionEntry,
  SketchDimensionId,
  SketchDimensionSnapshot,
  SketchDimensionValueSource,
  SketchEntityId,
  SketchEntitySnapshot,
  SketchId,
  SketchPlane,
  SketchPointTarget,
  Vec2
} from "@web-cad/cad-protocol";

import { createCanonicalSketchArcEntity } from "./sketchArcMath";
import { SKETCH_GEOMETRY_POLICY } from "./sketchGeometryPolicy";

import {
  applySketchDimensionValue,
  evaluateSketch,
  isSupportedSketchDimensionTarget,
  type SketchSolverApplyIssue,
  type SketchSolverDocument,
  type SketchSolverEvaluation,
  type SketchSolverParameter,
  type SketchSolverSketch
} from "./sketchSolver";

const SOURCE_BOUNDARY_NOTE =
  "Sketch edit readiness is derived from authoritative sketch source, dimensions, constraints, feature dependencies, reference health, and rebuild-plan lifecycle state.";
const DERIVED_BOUNDARY_NOTE =
  "Renderer meshes, OCCT indexes, OPFS paths, file handles, viewport state, selection-buffer ids, and export artifacts are excluded from sketch edit readiness.";

export interface CreateSketchEditReadinessResponseOptions {
  readonly cadOpsVersion: CadOpsVersion;
  readonly edit: CadSketchEditProposal;
  readonly document: SketchEditReadinessDocument;
  readonly features: readonly CadFeatureSummary[];
  readonly bodies: readonly CadBodySnapshot[];
  readonly referenceHealth: readonly CadReferenceHealthEntry[];
  readonly bodyLifecycles: readonly CadBodyLifecycleSummary[];
}

export interface SketchEditReadinessDocument extends SketchSolverDocument {
  readonly sketches: ReadonlyMap<SketchId, SketchEditReadinessSketch>;
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

export interface SketchEditReadinessSketch extends SketchSolverSketch {
  readonly id: SketchId;
  readonly name: string;
  readonly plane: SketchPlane;
  readonly entities: ReadonlyMap<SketchEntityId, SketchEntitySnapshot>;
}

type SimulatedSketchDocument = {
  readonly sketches: Map<SketchId, SketchEditReadinessSketch>;
  readonly parameters: ReadonlyMap<ParameterId, SketchSolverParameter>;
  readonly sketchDimensions: Map<SketchDimensionId, SketchDimensionSnapshot>;
  readonly sketchConstraints: Map<SketchConstraintId, SketchConstraintSnapshot>;
};

type SimulationResult = {
  readonly document: SimulatedSketchDocument;
  readonly sketchId?: SketchId;
  readonly editedEntityIds: readonly SketchEntityId[];
  readonly editedDimensionIds: readonly SketchDimensionId[];
  readonly editedConstraintIds: readonly SketchConstraintId[];
  readonly commitOperation?: CadSketchEditDryRunSummaryCommitOperation;
  readonly diagnostics: readonly CadSketchEditDiagnostic[];
};

type CadSketchEditDryRunSummaryCommitOperation =
  | "sketch.updateEntity"
  | "sketch.setEntityConstruction"
  | "sketch.dimension.create"
  | "sketch.dimension.update"
  | "sketch.dimension.delete"
  | "sketch.constraint.create"
  | "sketch.constraint.delete";

export function createSketchEditReadinessResponse(
  options: CreateSketchEditReadinessResponseOptions
): SketchEditReadinessQueryResponse {
  const beforeSketchId = getProposalSketchId(options.document, options.edit);
  const beforeSketch = beforeSketchId
    ? options.document.sketches.get(beforeSketchId)
    : undefined;
  const beforeEvaluation = beforeSketch
    ? evaluateSketch(options.document, beforeSketch)
    : undefined;
  const simulation = simulateSketchEdit(options.document, options.edit);
  const afterSketch =
    simulation.sketchId !== undefined
      ? simulation.document.sketches.get(simulation.sketchId)
      : undefined;
  const afterEvaluation = afterSketch
    ? evaluateSketch(simulation.document, afterSketch)
    : undefined;
  const evaluationDiagnostics = simulation.diagnostics.some(
    (diagnostic) => diagnostic.severity === "blocker"
  )
    ? []
    : collectEvaluationDiagnostics(afterEvaluation ?? beforeEvaluation);
  const editedTargets = collectEditedTargets(
    simulation.sketchId ?? beforeSketchId,
    simulation.editedEntityIds
  );
  const affected = collectAffectedSummary(
    options,
    editedTargets,
    simulation.editedDimensionIds,
    simulation.editedConstraintIds
  );
  const bodyLifecycleById = new Map(
    options.bodyLifecycles.map((lifecycle) => [lifecycle.bodyId, lifecycle])
  );
  const referenceHealth = filterAffectedReferenceHealth(
    options.referenceHealth,
    affected
  );
  const bodyLifecycles = affected.bodyIds
    .map((bodyId) => bodyLifecycleById.get(bodyId))
    .filter(
      (lifecycle): lifecycle is CadBodyLifecycleSummary =>
        lifecycle !== undefined
    );
  const featureImpacts = createFeatureImpacts(
    options,
    editedTargets,
    affected,
    bodyLifecycleById,
    referenceHealth
  );
  const downstreamDiagnostics = [
    ...createDownstreamDiagnostics(featureImpacts, bodyLifecycles),
    ...createReferenceDiagnostics(referenceHealth)
  ];
  const diagnostics = [
    ...simulation.diagnostics,
    ...evaluationDiagnostics,
    ...downstreamDiagnostics
  ];
  const status = chooseReadinessStatus(diagnostics, referenceHealth);
  const dryRunDiagnostics = [
    ...simulation.diagnostics,
    ...evaluationDiagnostics
  ];
  const dryRunStatus = chooseDryRunStatus(dryRunDiagnostics);
  const sketchHealth =
    beforeEvaluation !== undefined
      ? createSketchHealth(beforeEvaluation, afterEvaluation)
      : undefined;

  return {
    ok: true,
    query: "sketch.editReadiness" as const,
    cadOpsVersion: options.cadOpsVersion,
    status,
    edit: options.edit,
    dryRun: {
      status: dryRunStatus,
      edit: options.edit,
      ...(dryRunStatus === "valid" && simulation.commitOperation
        ? { commitOperation: simulation.commitOperation }
        : {}),
      willMutateDocument: false as const,
      diagnosticCount: dryRunDiagnostics.length,
      diagnostics: dryRunDiagnostics
    },
    ...(sketchHealth ? { sketchHealth } : {}),
    affected,
    featureImpactCount: featureImpacts.length,
    featureImpacts,
    bodyLifecycleCount: bodyLifecycles.length,
    bodyLifecycles,
    referenceEffectCount: referenceHealth.length,
    referenceEffects: referenceHealth.map(createReferenceEffect),
    referenceHealthCount: referenceHealth.length,
    referenceHealth,
    diagnosticCount: diagnostics.length,
    diagnostics,
    sourceBoundaryNote: SOURCE_BOUNDARY_NOTE,
    derivedBoundaryNote: DERIVED_BOUNDARY_NOTE,
    requiresProjectSchemaMigration: false as const
  };
}

function simulateSketchEdit(
  document: SketchEditReadinessDocument,
  edit: CadSketchEditProposal
): SimulationResult {
  const simulated = cloneSketchDocument(document);
  const diagnostics: CadSketchEditDiagnostic[] = [];

  switch (edit.editKind) {
    case "sketch.updateEntity": {
      const sketch = simulated.sketches.get(edit.sketchId);
      const existing = sketch?.entities.get(edit.entity.id);

      if (!sketch) {
        diagnostics.push(
          createDiagnostic({
            code: "SKETCH_EDIT_MISSING_SKETCH",
            severity: "blocker",
            message: `Sketch does not exist: ${edit.sketchId}`,
            sketchId: edit.sketchId,
            expected: "existing sketch",
            received: edit.sketchId
          })
        );
      } else if (!existing) {
        diagnostics.push(
          createDiagnostic({
            code: "SKETCH_EDIT_MISSING_ENTITY",
            severity: "blocker",
            message: `Sketch entity does not exist: ${edit.entity.id}`,
            sketchId: edit.sketchId,
            sketchEntityId: edit.entity.id,
            expected: "existing sketch entity",
            received: edit.entity.id
          })
        );
      } else if (existing.kind !== edit.entity.kind) {
        diagnostics.push(
          createDiagnostic({
            code: "SKETCH_EDIT_INVALID_PROPOSAL",
            severity: "blocker",
            message: "A sketch entity update cannot change entity kind.",
            sketchId: edit.sketchId,
            sketchEntityId: edit.entity.id,
            fieldPath: "entity.kind",
            expected: existing.kind,
            received: edit.entity.kind
          })
        );
      } else {
        const entities = new Map(sketch.entities);
        if (edit.entity.kind === "arc") {
          const canonical = createCanonicalSketchArcEntity(
            edit.entity.id,
            {
              kind: "centerAngles",
              center: edit.entity.center,
              radius: edit.entity.radius,
              startAngleDegrees: edit.entity.startAngleDegrees,
              sweepAngleDegrees: edit.entity.sweepAngleDegrees
            },
            edit.entity.construction,
            SKETCH_GEOMETRY_POLICY
          );
          if (!canonical.ok) {
            const issue = canonical.issues[0]!;
            diagnostics.push(
              createDiagnostic({
                code: "SKETCH_EDIT_INVALID_VALUE",
                severity: "blocker",
                message: issue.message,
                sketchId: edit.sketchId,
                sketchEntityId: edit.entity.id,
                fieldPath: `entity.${issue.path.replace(/^definition\./, "")}`,
                expected: issue.expected,
                received: issue.received
              })
            );
          } else {
            entities.set(edit.entity.id, canonical.value);
            simulated.sketches.set(sketch.id, { ...sketch, entities });
          }
        } else {
          entities.set(edit.entity.id, {
            ...edit.entity,
            construction:
              edit.entity.construction === undefined
                ? existing.construction
                : edit.entity.construction
          });
          simulated.sketches.set(sketch.id, { ...sketch, entities });
        }
      }

      return {
        document: simulated,
        sketchId: edit.sketchId,
        editedEntityIds: [edit.entity.id],
        editedDimensionIds: [],
        editedConstraintIds: [],
        commitOperation: "sketch.updateEntity",
        diagnostics: addSupportedDiagnostic(diagnostics, edit.sketchId)
      };
    }

    case "sketch.setEntityConstruction": {
      const sketch = simulated.sketches.get(edit.sketchId);
      const existing = sketch?.entities.get(edit.entityId);

      if (!sketch) {
        diagnostics.push(
          createDiagnostic({
            code: "SKETCH_EDIT_MISSING_SKETCH",
            severity: "blocker",
            message: `Sketch does not exist: ${edit.sketchId}`,
            sketchId: edit.sketchId,
            expected: "existing sketch",
            received: edit.sketchId
          })
        );
      } else if (!existing) {
        diagnostics.push(
          createDiagnostic({
            code: "SKETCH_EDIT_MISSING_ENTITY",
            severity: "blocker",
            message: `Sketch entity does not exist: ${edit.entityId}`,
            sketchId: edit.sketchId,
            sketchEntityId: edit.entityId,
            expected: "existing sketch entity",
            received: edit.entityId
          })
        );
      } else {
        const entities = new Map(sketch.entities);
        entities.set(edit.entityId, {
          ...existing,
          construction: edit.construction
        });
        simulated.sketches.set(sketch.id, { ...sketch, entities });
      }

      return {
        document: simulated,
        sketchId: edit.sketchId,
        editedEntityIds: [edit.entityId],
        editedDimensionIds: [],
        editedConstraintIds: [],
        commitOperation: "sketch.setEntityConstruction",
        diagnostics: addSupportedDiagnostic(diagnostics, edit.sketchId)
      };
    }

    case "entity.dimension.update": {
      const sketch = simulated.sketches.get(edit.sketchId);
      const entity = sketch?.entities.get(edit.entityId);
      const dimension = createVirtualDimension(edit);

      if (!sketch) {
        diagnostics.push(
          createDiagnostic({
            code: "SKETCH_EDIT_MISSING_SKETCH",
            severity: "blocker",
            message: `Sketch does not exist: ${edit.sketchId}`,
            sketchId: edit.sketchId,
            expected: "existing sketch",
            received: edit.sketchId
          })
        );
      } else if (!entity) {
        diagnostics.push(
          createDiagnostic({
            code: "SKETCH_EDIT_MISSING_ENTITY",
            severity: "blocker",
            message: `Sketch entity does not exist: ${edit.entityId}`,
            sketchId: edit.sketchId,
            sketchEntityId: edit.entityId,
            expected: "existing sketch entity",
            received: edit.entityId
          })
        );
      } else {
        applyDimensionToSimulatedEntity(
          simulated,
          sketch,
          entity,
          dimension,
          edit.value,
          diagnostics
        );
      }

      return {
        document: simulated,
        sketchId: edit.sketchId,
        editedEntityIds: [edit.entityId],
        editedDimensionIds: [],
        editedConstraintIds: [],
        commitOperation: "sketch.updateEntity",
        diagnostics: addSupportedDiagnostic(diagnostics, edit.sketchId)
      };
    }

    case "sketch.dimension.create": {
      const dimensionId = edit.id ?? "__sketch_edit_readiness_dimension__";
      const dimension: SketchDimensionSnapshot = {
        id: dimensionId,
        name: edit.name,
        sketchId: edit.sketchId,
        entityId: edit.entityId,
        target: edit.target,
        valueSource: createDimensionValueSource(edit, diagnostics, dimensionId)
      };
      const sketch = simulated.sketches.get(edit.sketchId);
      const entity = sketch?.entities.get(edit.entityId);
      const receivedTarget = formatSketchDimensionTarget(edit.target);

      if (!sketch) {
        diagnostics.push(
          createDiagnostic({
            code: "SKETCH_EDIT_MISSING_SKETCH",
            severity: "blocker",
            message: `Sketch does not exist: ${edit.sketchId}`,
            sketchId: edit.sketchId,
            sketchDimensionId: dimensionId,
            expected: "existing sketch",
            received: edit.sketchId
          })
        );
      } else if (!entity) {
        diagnostics.push(
          createDiagnostic({
            code: "SKETCH_EDIT_MISSING_ENTITY",
            severity: "blocker",
            message: `Sketch entity does not exist: ${edit.entityId}`,
            sketchId: edit.sketchId,
            sketchEntityId: edit.entityId,
            sketchDimensionId: dimensionId,
            expected: "existing sketch entity",
            received: edit.entityId
          })
        );
      } else if (!isSupportedSketchDimensionTarget(edit.target, entity)) {
        diagnostics.push(
          createDiagnostic({
            code: "SKETCH_EDIT_UNSUPPORTED",
            severity: "blocker",
            message:
              "Sketch dimension target is not supported for this entity.",
            sketchId: edit.sketchId,
            sketchEntityId: edit.entityId,
            sketchDimensionId: dimensionId,
            fieldPath: "target",
            expected: `supported target for ${entity.kind}`,
            received: receivedTarget
          })
        );
      } else if (hasExistingDimensionTarget(simulated, dimension)) {
        diagnostics.push(
          createDiagnostic({
            code: "SKETCH_EDIT_OVER_DEFINED",
            severity: "blocker",
            message: "Sketch dimension target is already driven.",
            sketchId: edit.sketchId,
            sketchEntityId: edit.entityId,
            sketchDimensionId: dimensionId,
            fieldPath: "target",
            expected: "undriven sketch dimension target",
            received: "existing dimension"
          })
        );
      } else {
        simulated.sketchDimensions.set(dimension.id, dimension);
        const value = resolveDimensionValue(simulated, dimension, diagnostics);

        if (value !== undefined) {
          applyDimensionToSimulatedEntity(
            simulated,
            sketch,
            entity,
            dimension,
            value,
            diagnostics
          );
        }
      }

      return {
        document: simulated,
        sketchId: edit.sketchId,
        editedEntityIds: [edit.entityId],
        editedDimensionIds: [dimensionId],
        editedConstraintIds: [],
        commitOperation: "sketch.dimension.create",
        diagnostics: addSupportedDiagnostic(diagnostics, edit.sketchId)
      };
    }

    case "sketch.dimension.update": {
      const existing = simulated.sketchDimensions.get(edit.id);
      const nextValueSource = createDimensionValueSource(
        edit,
        diagnostics,
        edit.id
      );

      if (!existing) {
        diagnostics.push(
          createDiagnostic({
            code: "SKETCH_EDIT_MISSING_DIMENSION",
            severity: "blocker",
            message: `Sketch dimension does not exist: ${edit.id}`,
            sketchDimensionId: edit.id,
            expected: "existing sketch dimension",
            received: edit.id
          })
        );

        return {
          document: simulated,
          editedEntityIds: [],
          editedDimensionIds: [edit.id],
          editedConstraintIds: [],
          commitOperation: "sketch.dimension.update",
          diagnostics
        };
      }

      const sketch = simulated.sketches.get(existing.sketchId);
      const entity = sketch?.entities.get(existing.entityId);
      const updated = { ...existing, valueSource: nextValueSource };
      simulated.sketchDimensions.set(updated.id, updated);

      if (!sketch) {
        diagnostics.push(
          createDiagnostic({
            code: "SKETCH_EDIT_MISSING_SKETCH",
            severity: "blocker",
            message: `Sketch does not exist: ${existing.sketchId}`,
            sketchId: existing.sketchId,
            sketchDimensionId: edit.id,
            expected: "existing sketch",
            received: existing.sketchId
          })
        );
      } else if (!entity) {
        diagnostics.push(
          createDiagnostic({
            code: "SKETCH_EDIT_MISSING_ENTITY",
            severity: "blocker",
            message: `Sketch entity does not exist: ${existing.entityId}`,
            sketchId: existing.sketchId,
            sketchEntityId: existing.entityId,
            sketchDimensionId: edit.id,
            expected: "existing sketch entity",
            received: existing.entityId
          })
        );
      } else {
        const value = resolveDimensionValue(simulated, updated, diagnostics);

        if (value !== undefined) {
          applyDimensionToSimulatedEntity(
            simulated,
            sketch,
            entity,
            updated,
            value,
            diagnostics
          );
        }
      }

      return {
        document: simulated,
        sketchId: existing.sketchId,
        editedEntityIds: [existing.entityId],
        editedDimensionIds: [edit.id],
        editedConstraintIds: [],
        commitOperation: "sketch.dimension.update",
        diagnostics: addSupportedDiagnostic(diagnostics, existing.sketchId)
      };
    }

    case "sketch.dimension.delete": {
      const existing = simulated.sketchDimensions.get(edit.id);

      if (!existing) {
        diagnostics.push(
          createDiagnostic({
            code: "SKETCH_EDIT_MISSING_DIMENSION",
            severity: "blocker",
            message: `Sketch dimension does not exist: ${edit.id}`,
            sketchDimensionId: edit.id,
            expected: "existing sketch dimension",
            received: edit.id
          })
        );

        return {
          document: simulated,
          editedEntityIds: [],
          editedDimensionIds: [edit.id],
          editedConstraintIds: [],
          commitOperation: "sketch.dimension.delete",
          diagnostics
        };
      }

      simulated.sketchDimensions.delete(edit.id);

      return {
        document: simulated,
        sketchId: existing.sketchId,
        editedEntityIds: [existing.entityId],
        editedDimensionIds: [edit.id],
        editedConstraintIds: [],
        commitOperation: "sketch.dimension.delete",
        diagnostics: addSupportedDiagnostic(diagnostics, existing.sketchId)
      };
    }

    case "sketch.constraint.create": {
      const constraint = createConstraintSnapshot(simulated, edit, diagnostics);

      if (constraint) {
        simulated.sketchConstraints.set(constraint.id, constraint);
      }

      return {
        document: simulated,
        sketchId: edit.sketchId,
        editedEntityIds: constraint
          ? getConstraintAffectedEntityIds(constraint)
          : getConstraintProposalAffectedEntityIds(edit),
        editedDimensionIds: [],
        editedConstraintIds: [
          edit.id ?? "__sketch_edit_readiness_constraint__"
        ],
        commitOperation: "sketch.constraint.create",
        diagnostics: addSupportedDiagnostic(diagnostics, edit.sketchId)
      };
    }

    case "sketch.constraint.delete": {
      const existing = simulated.sketchConstraints.get(edit.id);

      if (!existing) {
        diagnostics.push(
          createDiagnostic({
            code: "SKETCH_EDIT_MISSING_CONSTRAINT",
            severity: "blocker",
            message: `Sketch constraint does not exist: ${edit.id}`,
            sketchConstraintId: edit.id,
            expected: "existing sketch constraint",
            received: edit.id
          })
        );

        return {
          document: simulated,
          editedEntityIds: [],
          editedDimensionIds: [],
          editedConstraintIds: [edit.id],
          commitOperation: "sketch.constraint.delete",
          diagnostics
        };
      }

      simulated.sketchConstraints.delete(edit.id);

      return {
        document: simulated,
        sketchId: existing.sketchId,
        editedEntityIds: getConstraintAffectedEntityIds(existing),
        editedDimensionIds: [],
        editedConstraintIds: [edit.id],
        commitOperation: "sketch.constraint.delete",
        diagnostics: addSupportedDiagnostic(diagnostics, existing.sketchId)
      };
    }
  }
}

function createDimensionValueSource(
  edit:
    | Extract<
        CadSketchEditProposal,
        { readonly editKind: "sketch.dimension.create" }
      >
    | Extract<
        CadSketchEditProposal,
        { readonly editKind: "sketch.dimension.update" }
      >,
  diagnostics: CadSketchEditDiagnostic[],
  dimensionId: SketchDimensionId
): SketchDimensionValueSource {
  const hasLiteral = edit.value !== undefined;
  const hasParameter = edit.parameterId !== undefined;

  if (hasLiteral === hasParameter) {
    diagnostics.push(
      createDiagnostic({
        code: "SKETCH_EDIT_INVALID_PROPOSAL",
        severity: "blocker",
        message:
          "Sketch dimension edit readiness expects exactly one of value or parameterId.",
        sketchDimensionId: dimensionId,
        expected: "value or parameterId",
        received: hasLiteral && hasParameter ? "both" : "neither"
      })
    );
  }

  if (hasParameter) {
    return { type: "parameter", parameterId: edit.parameterId };
  }

  return { type: "literal", value: edit.value ?? NaN };
}

function createVirtualDimension(
  edit: Extract<
    CadSketchEditProposal,
    { readonly editKind: "entity.dimension.update" }
  >
): SketchDimensionSnapshot {
  return {
    id: "__sketch_edit_readiness_dimension__",
    name: "Sketch edit readiness dimension",
    sketchId: edit.sketchId,
    entityId: edit.entityId,
    target: edit.target,
    valueSource: { type: "literal", value: edit.value }
  };
}

function applyDimensionToSimulatedEntity(
  document: SimulatedSketchDocument,
  sketch: SketchEditReadinessSketch,
  entity: SketchEntitySnapshot,
  dimension: SketchDimensionSnapshot,
  value: number,
  diagnostics: CadSketchEditDiagnostic[]
): void {
  const receivedTarget = formatSketchDimensionTarget(dimension.target);

  if (!isSupportedSketchDimensionTarget(dimension.target, entity)) {
    diagnostics.push(
      createDiagnostic({
        code: "SKETCH_EDIT_UNSUPPORTED",
        severity: "blocker",
        message: "Sketch dimension target is not supported for this entity.",
        sketchId: dimension.sketchId,
        sketchEntityId: dimension.entityId,
        sketchDimensionId: dimension.id,
        fieldPath: "target",
        expected: `supported target for ${entity.kind}`,
        received: receivedTarget
      })
    );
    return;
  }

  const result = applySketchDimensionValue(entity, dimension, value, {
    document,
    sketchId: sketch.id,
    entities: sketch.entities
  });

  if (!result.ok) {
    diagnostics.push(createDiagnosticFromApplyIssue(result.issue));
    return;
  }

  const nextEntities = new Map(sketch.entities);
  nextEntities.set(result.entity.id, result.entity);
  document.sketches.set(sketch.id, { ...sketch, entities: nextEntities });
}

function resolveDimensionValue(
  document: SimulatedSketchDocument,
  dimension: SketchDimensionSnapshot,
  diagnostics: CadSketchEditDiagnostic[]
): number | undefined {
  if (dimension.valueSource.type === "literal") {
    if (
      typeof dimension.valueSource.value === "number" &&
      Number.isFinite(dimension.valueSource.value) &&
      dimension.valueSource.value > 0
    ) {
      return dimension.valueSource.value;
    }

    diagnostics.push(
      createDiagnostic({
        code: "SKETCH_EDIT_INVALID_VALUE",
        severity: "blocker",
        message: "Sketch dimension value must be a positive finite number.",
        sketchId: dimension.sketchId,
        sketchEntityId: dimension.entityId,
        sketchDimensionId: dimension.id,
        fieldPath: "value",
        expected: "positive finite number",
        received: String(dimension.valueSource.value)
      })
    );
    return undefined;
  }

  const parameter = document.parameters.get(dimension.valueSource.parameterId);

  if (!parameter) {
    diagnostics.push(
      createDiagnostic({
        code: "SKETCH_EDIT_MISSING_PARAMETER",
        severity: "blocker",
        message: `Parameter does not exist: ${dimension.valueSource.parameterId}`,
        sketchId: dimension.sketchId,
        sketchEntityId: dimension.entityId,
        sketchDimensionId: dimension.id,
        fieldPath: "parameterId",
        expected: "existing parameter",
        received: dimension.valueSource.parameterId
      })
    );
    return undefined;
  }

  if (!Number.isFinite(parameter.value) || parameter.value <= 0) {
    diagnostics.push(
      createDiagnostic({
        code: "SKETCH_EDIT_INVALID_VALUE",
        severity: "blocker",
        message:
          "Sketch dimension parameter value must be a positive finite number.",
        sketchId: dimension.sketchId,
        sketchEntityId: dimension.entityId,
        sketchDimensionId: dimension.id,
        fieldPath: "parameterId",
        expected: "positive finite parameter value",
        received: String(parameter.value)
      })
    );
    return undefined;
  }

  return parameter.value;
}

function createConstraintSnapshot(
  document: SimulatedSketchDocument,
  edit: CadSketchConstraintCreateEditProposal,
  diagnostics: CadSketchEditDiagnostic[]
): SketchConstraintSnapshot | undefined {
  const id = edit.id ?? "__sketch_edit_readiness_constraint__";
  const sketch = document.sketches.get(edit.sketchId);

  if (!sketch) {
    diagnostics.push(
      createDiagnostic({
        code: "SKETCH_EDIT_MISSING_SKETCH",
        severity: "blocker",
        message: `Sketch does not exist: ${edit.sketchId}`,
        sketchId: edit.sketchId,
        sketchConstraintId: id,
        expected: "existing sketch",
        received: edit.sketchId
      })
    );
    return undefined;
  }

  if (document.sketchConstraints.has(id)) {
    diagnostics.push(
      createDiagnostic({
        code: "SKETCH_EDIT_CONFLICTING_CONSTRAINT",
        severity: "blocker",
        message: `Sketch constraint already exists: ${id}`,
        sketchId: edit.sketchId,
        sketchConstraintId: id,
        expected: "unique sketch constraint id",
        received: id
      })
    );
    return undefined;
  }

  if (edit.kind === "fixed") {
    const entity = sketch.entities.get(edit.target.entityId);

    if (!entity) {
      diagnostics.push(
        createMissingEntityDiagnostic(edit.sketchId, edit.target.entityId, id)
      );
      return undefined;
    }

    return {
      id,
      name: edit.name,
      sketchId: edit.sketchId,
      entityId: edit.target.entityId,
      kind: "fixed",
      target: edit.target,
      coordinate:
        edit.coordinate ?? getSketchPointTargetCoordinate(entity, edit.target)
    };
  }

  if (edit.kind === "coincident") {
    return {
      id,
      name: edit.name,
      sketchId: edit.sketchId,
      entityId: edit.primaryTarget.entityId,
      kind: "coincident",
      primaryTarget: edit.primaryTarget,
      secondaryTarget: edit.secondaryTarget
    };
  }

  if (edit.kind === "midpoint") {
    return {
      id,
      name: edit.name,
      sketchId: edit.sketchId,
      entityId: edit.lineEntityId,
      kind: "midpoint",
      lineEntityId: edit.lineEntityId,
      target: edit.target
    };
  }

  if (edit.kind === "parallel" || edit.kind === "perpendicular") {
    return {
      id,
      name: edit.name,
      sketchId: edit.sketchId,
      entityId: edit.secondaryLineEntityId,
      kind: edit.kind,
      primaryLineEntityId: edit.primaryLineEntityId,
      secondaryLineEntityId: edit.secondaryLineEntityId
    };
  }

  return {
    id,
    name: edit.name,
    sketchId: edit.sketchId,
    entityId: edit.entityId,
    kind: edit.kind
  };
}

function createSketchHealth(
  before: SketchSolverEvaluation,
  after: SketchSolverEvaluation | undefined
): CadSketchEditHealthSummary {
  const beforeSummary = createEvaluationSummary(before);
  const afterSummary = after ? createEvaluationSummary(after) : undefined;

  return {
    before: beforeSummary,
    ...(afterSummary ? { after: afterSummary } : {}),
    statusChanged: beforeSummary.status !== afterSummary?.status
  };
}

function createEvaluationSummary(
  evaluation: SketchSolverEvaluation
): CadSketchEditEvaluationSummary {
  return {
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

function collectEvaluationDiagnostics(
  evaluation: SketchSolverEvaluation | undefined
): readonly CadSketchEditDiagnostic[] {
  if (!evaluation) {
    return [];
  }

  const diagnostics: CadSketchEditDiagnostic[] = [];

  if (
    evaluation.status === "unsupported" &&
    evaluation.issues.some(
      (issue) =>
        issue.code === "UNSUPPORTED_TARGET" &&
        issue.sketchEntityId !== undefined
    )
  ) {
    const issue = evaluation.issues.find(
      (candidate) =>
        candidate.code === "UNSUPPORTED_TARGET" &&
        "sketchEntityId" in candidate &&
        candidate.sketchEntityId !== undefined
    )!;
    const entityIssue = issue as typeof issue & {
      readonly sketchEntityId: SketchEntityId;
    };
    diagnostics.push(
      createDiagnostic({
        code: "SKETCH_EDIT_UNSUPPORTED",
        severity: "blocker",
        message: entityIssue.message,
        sketchId: entityIssue.sketchId,
        sketchEntityId: entityIssue.sketchEntityId,
        expected: entityIssue.expected,
        received: entityIssue.received
      })
    );
  }

  if (evaluation.status === "under-defined") {
    diagnostics.push(
      createDiagnostic({
        code: "SKETCH_EDIT_UNDER_DEFINED",
        severity: "warning",
        message: `Sketch ${evaluation.sketchId} is under-defined after the proposed edit.`,
        sketchId: evaluation.sketchId,
        expected: "fully constrained sketch",
        received: "under-defined"
      })
    );
  }

  if (evaluation.status === "over-defined") {
    diagnostics.push(
      createDiagnostic({
        code: "SKETCH_EDIT_OVER_DEFINED",
        severity: "blocker",
        message: `Sketch ${evaluation.sketchId} is over-defined after the proposed edit.`,
        sketchId: evaluation.sketchId,
        expected: "non-over-defined sketch",
        received: "over-defined"
      })
    );
  }

  for (const dimension of evaluation.dimensions) {
    diagnostics.push(...createDimensionDiagnostics(dimension));
  }

  for (const constraint of evaluation.constraints) {
    diagnostics.push(...createConstraintDiagnostics(constraint));
  }

  return diagnostics;
}

function createDimensionDiagnostics(
  dimension: SketchDimensionEntry
): readonly CadSketchEditDiagnostic[] {
  return dimension.issues.map((issue) =>
    createDiagnostic({
      code:
        issue.code === "INVALID_VALUE"
          ? "SKETCH_EDIT_INVALID_VALUE"
          : issue.code === "PARAMETER_NOT_FOUND"
            ? "SKETCH_EDIT_MISSING_PARAMETER"
            : issue.code === "INCONSISTENT_CONSTRAINT"
              ? "SKETCH_EDIT_CONFLICTING_CONSTRAINT"
              : issue.code === "UNSUPPORTED_TARGET"
                ? "SKETCH_EDIT_UNSUPPORTED"
                : issue.code === "SKETCH_ENTITY_NOT_FOUND"
                  ? "SKETCH_EDIT_MISSING_ENTITY"
                  : issue.code === "SKETCH_NOT_FOUND"
                    ? "SKETCH_EDIT_MISSING_SKETCH"
                    : "SKETCH_EDIT_MISSING_DIMENSION",
      severity: "blocker",
      message: issue.message,
      sketchId: issue.sketchId,
      sketchEntityId: issue.sketchEntityId,
      sketchDimensionId: issue.sketchDimensionId,
      expected: issue.expected,
      received: issue.received
    })
  );
}

function createConstraintDiagnostics(
  constraint: SketchConstraintEntry
): readonly CadSketchEditDiagnostic[] {
  return constraint.issues.map((issue) =>
    createDiagnostic({
      code:
        issue.code === "INVALID_VALUE"
          ? "SKETCH_EDIT_INVALID_VALUE"
          : issue.code === "INCONSISTENT_CONSTRAINT" ||
              issue.code === "CONFLICTING_CONSTRAINT"
            ? "SKETCH_EDIT_CONFLICTING_CONSTRAINT"
            : issue.code === "UNSUPPORTED_TARGET"
              ? "SKETCH_EDIT_UNSUPPORTED"
              : issue.code === "SKETCH_ENTITY_NOT_FOUND"
                ? "SKETCH_EDIT_MISSING_ENTITY"
                : "SKETCH_EDIT_MISSING_SKETCH",
      severity: "blocker",
      message: issue.message,
      sketchId: issue.sketchId,
      sketchEntityId: issue.sketchEntityId,
      sketchConstraintId: issue.sketchConstraintId,
      expected: issue.expected,
      received: issue.received
    })
  );
}

function collectEditedTargets(
  sketchId: SketchId | undefined,
  editedEntityIds: readonly SketchEntityId[]
): readonly {
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
}[] {
  if (!sketchId) {
    return [];
  }

  return [...new Set(editedEntityIds)].map((entityId) => ({
    sketchId,
    entityId
  }));
}

function collectAffectedSummary(
  options: CreateSketchEditReadinessResponseOptions,
  targets: readonly {
    readonly sketchId: SketchId;
    readonly entityId: SketchEntityId;
  }[],
  dimensionIds: readonly SketchDimensionId[],
  constraintIds: readonly SketchConstraintId[]
): CadSketchEditAffectedSummary {
  const featureIds = new Set<FeatureId>();
  const bodyIds = new Set<BodyId>();
  const sketchIds = new Set<SketchId>(targets.map((target) => target.sketchId));
  const entityIds = new Set<SketchEntityId>(
    targets.map((target) => target.entityId)
  );

  for (const feature of options.features) {
    const impact = findFeatureDirectImpact(feature, targets);

    if (!impact) {
      continue;
    }

    featureIds.add(feature.id);
    bodyIds.add(feature.bodyId);

    if ("sketchId" in feature) {
      sketchIds.add(feature.sketchId);
    }
  }

  let changed = true;

  while (changed) {
    changed = false;

    for (const feature of options.features) {
      const targetBodyId =
        "targetBodyId" in feature ? feature.targetBodyId : undefined;

      if (
        !targetBodyId ||
        !bodyIds.has(targetBodyId) ||
        featureIds.has(feature.id)
      ) {
        continue;
      }

      featureIds.add(feature.id);
      bodyIds.add(feature.bodyId);

      if ("sketchId" in feature) {
        sketchIds.add(feature.sketchId);
      }

      changed = true;
    }
  }

  const affectedReferenceHealth = filterAffectedReferenceHealth(
    options.referenceHealth,
    {
      sketchIds: [...sketchIds],
      sketchEntityIds: [...entityIds],
      dimensionIds,
      constraintIds,
      featureIds: [...featureIds],
      bodyIds: [...bodyIds],
      generatedReferenceCount: 0,
      namedReferenceCount: 0
    }
  );

  return {
    sketchIds: [...sketchIds],
    sketchEntityIds: [...entityIds],
    dimensionIds: [...new Set(dimensionIds)],
    constraintIds: [...new Set(constraintIds)],
    featureIds: [...featureIds],
    bodyIds: [...bodyIds],
    generatedReferenceCount: affectedReferenceHealth.filter(
      (entry) => entry.source === "generatedReference"
    ).length,
    namedReferenceCount: affectedReferenceHealth.filter(
      (entry) => entry.source === "namedReference"
    ).length
  };
}

function createFeatureImpacts(
  options: CreateSketchEditReadinessResponseOptions,
  targets: readonly {
    readonly sketchId: SketchId;
    readonly entityId: SketchEntityId;
  }[],
  affected: CadSketchEditAffectedSummary,
  bodyLifecycleById: ReadonlyMap<BodyId, CadBodyLifecycleSummary>,
  referenceHealth: readonly CadReferenceHealthEntry[]
): readonly CadSketchEditFeatureImpact[] {
  return options.features
    .filter((feature) => affected.featureIds.includes(feature.id))
    .map((feature) => {
      const directImpact = findFeatureDirectImpact(feature, targets);
      const lifecycle = bodyLifecycleById.get(feature.bodyId);
      const referenceHealthStatus = combineReferenceStatuses(
        referenceHealth
          .filter((entry) => entry.bodyId === feature.bodyId)
          .map((entry) => entry.status)
      );
      const diagnostics = createFeatureImpactDiagnostics(
        feature,
        directImpact,
        lifecycle,
        referenceHealthStatus
      );

      return {
        featureId: feature.id,
        featureKind: feature.kind,
        bodyId: feature.bodyId,
        impact: directImpact ?? "downstream-target",
        ...("sketchId" in feature ? { sketchId: feature.sketchId } : {}),
        ...(getFeaturePrimaryEntityId(feature)
          ? { sketchEntityId: getFeaturePrimaryEntityId(feature) }
          : {}),
        ...("targetBodyId" in feature && feature.targetBodyId
          ? { targetBodyId: feature.targetBodyId }
          : {}),
        ...(lifecycle ? { bodyLifecycle: lifecycle.primaryState } : {}),
        ...(referenceHealthStatus ? { referenceHealthStatus } : {}),
        diagnosticCount: diagnostics.length,
        diagnostics
      };
    });
}

function createFeatureImpactDiagnostics(
  feature: CadFeatureSummary,
  impact: CadSketchEditFeatureImpactKind | undefined,
  lifecycle: CadBodyLifecycleSummary | undefined,
  referenceHealthStatus: CadReferenceHealthStatus | undefined
): readonly CadSketchEditDiagnostic[] {
  const diagnostics: CadSketchEditDiagnostic[] = [];

  if (!impact && lifecycle?.role === "result") {
    diagnostics.push(
      createDiagnostic({
        code: "SKETCH_EDIT_NON_REBUILDABLE",
        severity: "warning",
        message: `Feature ${feature.id} is affected through downstream target-body lifecycle rather than a direct sketch source edit.`,
        featureId: feature.id,
        bodyId: feature.bodyId,
        expected: "direct source-backed sketch feature",
        received: "downstream target feature"
      })
    );
  }

  if (referenceHealthStatus === "ambiguous") {
    diagnostics.push(
      createDiagnostic({
        code: "SKETCH_EDIT_AMBIGUOUS_DOWNSTREAM",
        severity: "warning",
        message: `Feature ${feature.id} has ambiguous downstream reference health.`,
        featureId: feature.id,
        bodyId: feature.bodyId,
        expected: "unambiguous reference health",
        received: "ambiguous"
      })
    );
  }

  if (referenceHealthStatus === "repair-needed") {
    diagnostics.push(
      createDiagnostic({
        code: "SKETCH_EDIT_REPAIR_NEEDED_DOWNSTREAM",
        severity: "warning",
        message: `Feature ${feature.id} has downstream reference health that needs repair.`,
        featureId: feature.id,
        bodyId: feature.bodyId,
        expected: "active reference health",
        received: "repair-needed"
      })
    );
  }

  return diagnostics;
}

function createDownstreamDiagnostics(
  featureImpacts: readonly CadSketchEditFeatureImpact[],
  bodyLifecycles: readonly CadBodyLifecycleSummary[]
): readonly CadSketchEditDiagnostic[] {
  const diagnostics: CadSketchEditDiagnostic[] = [];

  for (const lifecycle of bodyLifecycles) {
    if (lifecycle.primaryState === "consumed") {
      diagnostics.push(
        createDiagnostic({
          code: "SKETCH_EDIT_CONSUMED_DOWNSTREAM",
          severity: "warning",
          message: `Affected body ${lifecycle.bodyId} is consumed by downstream feature ${lifecycle.consumedByFeatureId}.`,
          featureId: lifecycle.featureId,
          bodyId: lifecycle.bodyId,
          targetBodyId: lifecycle.targetBodyId,
          expected: "active or rebuildable body",
          received: "consumed"
        })
      );
    }
  }

  for (const impact of featureImpacts) {
    diagnostics.push(...impact.diagnostics);
  }

  return diagnostics;
}

function createReferenceDiagnostics(
  referenceHealth: readonly CadReferenceHealthEntry[]
): readonly CadSketchEditDiagnostic[] {
  return referenceHealth.flatMap((entry) => {
    if (entry.status === "active") {
      return [];
    }

    return [
      createDiagnostic({
        code:
          entry.status === "ambiguous"
            ? "SKETCH_EDIT_AMBIGUOUS_DOWNSTREAM"
            : entry.status === "consumed"
              ? "SKETCH_EDIT_CONSUMED_DOWNSTREAM"
              : entry.status === "repair-needed"
                ? "SKETCH_EDIT_REPAIR_NEEDED_DOWNSTREAM"
                : entry.status === "missing"
                  ? "SKETCH_EDIT_STALE_SOURCE"
                  : "SKETCH_EDIT_UNSUPPORTED",
        severity: entry.status === "missing" ? "blocker" : "warning",
        message: `Affected reference health is ${entry.status}: ${entry.label}`,
        featureId: entry.sourceFeatureId,
        bodyId: entry.bodyId,
        stableId: entry.stableId,
        referenceName: entry.referenceName,
        expected: "active reference health",
        received: entry.status
      })
    ];
  });
}

function findFeatureDirectImpact(
  feature: CadFeatureSummary,
  targets: readonly {
    readonly sketchId: SketchId;
    readonly entityId: SketchEntityId;
  }[]
): CadSketchEditFeatureImpactKind | undefined {
  if (feature.kind === "extrude" || feature.kind === "revolve") {
    if (
      targets.some(
        (target) =>
          target.sketchId === feature.sketchId &&
          target.entityId === feature.entityId
      )
    ) {
      return "source-profile";
    }
  }

  if (
    feature.kind === "revolve" &&
    targets.some(
      (target) =>
        target.sketchId === feature.axis.sketchId &&
        target.entityId === feature.axis.entityId
    )
  ) {
    return "source-axis";
  }

  if (
    feature.kind === "hole" &&
    targets.some(
      (target) =>
        target.sketchId === feature.sketchId &&
        target.entityId === feature.circleEntityId
    )
  ) {
    return "source-hole-circle";
  }

  if (
    feature.kind === "sweep" &&
    targets.some(
      (target) =>
        target.sketchId === feature.profileSketchId &&
        target.entityId === feature.profileEntityId
    )
  ) {
    return "source-profile";
  }

  if (
    feature.kind === "loft" &&
    feature.sections.some((section) =>
      targets.some(
        (target) =>
          target.sketchId === section.sketchId &&
          target.entityId === section.entityId
      )
    )
  ) {
    return "source-profile";
  }

  return undefined;
}

function getFeaturePrimaryEntityId(
  feature: CadFeatureSummary
): SketchEntityId | undefined {
  if (feature.kind === "extrude" || feature.kind === "revolve") {
    return feature.entityId;
  }

  if (feature.kind === "hole") {
    return feature.circleEntityId;
  }

  if (feature.kind === "sweep") {
    return feature.profileEntityId;
  }

  if (feature.kind === "loft") {
    return feature.sections[0]?.entityId;
  }

  return undefined;
}

function filterAffectedReferenceHealth(
  referenceHealth: readonly CadReferenceHealthEntry[],
  affected: CadSketchEditAffectedSummary
): readonly CadReferenceHealthEntry[] {
  return referenceHealth.filter(
    (entry) =>
      (entry.bodyId !== undefined && affected.bodyIds.includes(entry.bodyId)) ||
      entry.dependencies.sketchIds.some((id) =>
        affected.sketchIds.includes(id)
      ) ||
      entry.dependencies.sketchEntityIds.some((id) =>
        affected.sketchEntityIds.includes(id)
      ) ||
      entry.dependencies.featureIds.some((id) =>
        affected.featureIds.includes(id)
      ) ||
      entry.dependencies.bodyIds.some((id) => affected.bodyIds.includes(id))
  );
}

function createReferenceEffect(
  entry: CadReferenceHealthEntry
): CadSketchEditReferenceEffectSummary {
  return {
    category: entry.status,
    ...(entry.bodyId ? { bodyId: entry.bodyId } : {}),
    ...(entry.stableId ? { stableId: entry.stableId } : {}),
    ...(entry.kind ? { kind: entry.kind } : {}),
    ...(entry.referenceName ? { referenceName: entry.referenceName } : {}),
    ...(entry.sourceFeatureId
      ? { sourceFeatureId: entry.sourceFeatureId }
      : {}),
    ...(entry.consumedByFeatureId
      ? { targetFeatureId: entry.consumedByFeatureId }
      : {}),
    ...(entry.status === "active"
      ? {}
      : { diagnosticCode: diagnosticCodeForReferenceStatus(entry.status) }),
    message: entry.label
  };
}

function diagnosticCodeForReferenceStatus(
  status: CadReferenceHealthStatus
): CadSketchEditDiagnosticCode {
  if (status === "ambiguous") {
    return "SKETCH_EDIT_AMBIGUOUS_DOWNSTREAM";
  }

  if (status === "consumed") {
    return "SKETCH_EDIT_CONSUMED_DOWNSTREAM";
  }

  if (status === "repair-needed") {
    return "SKETCH_EDIT_REPAIR_NEEDED_DOWNSTREAM";
  }

  if (status === "missing" || status === "stale") {
    return "SKETCH_EDIT_STALE_SOURCE";
  }

  return "SKETCH_EDIT_UNSUPPORTED";
}

function chooseReadinessStatus(
  diagnostics: readonly CadSketchEditDiagnostic[],
  referenceHealth: readonly CadReferenceHealthEntry[]
): CadSketchEditReadinessStatus {
  if (
    diagnostics.some(
      (diagnostic) => diagnostic.code === "SKETCH_EDIT_SCHEMA_MIGRATION_NEEDED"
    )
  ) {
    return "schema-migration-needed";
  }

  if (
    diagnostics.some(
      (diagnostic) =>
        diagnostic.severity === "blocker" && diagnostic.code.includes("MISSING")
    )
  ) {
    return "missing";
  }

  if (
    diagnostics.some(
      (diagnostic) =>
        diagnostic.severity === "blocker" &&
        diagnostic.code === "SKETCH_EDIT_UNSUPPORTED"
    )
  ) {
    return "unsupported";
  }

  if (diagnostics.some((diagnostic) => diagnostic.severity === "blocker")) {
    return "blocked";
  }

  if (referenceHealth.some((entry) => entry.status === "repair-needed")) {
    return "repair-needed";
  }

  return "ready";
}

function chooseDryRunStatus(
  diagnostics: readonly CadSketchEditDiagnostic[]
): CadSketchEditDryRunStatus {
  if (
    diagnostics.some(
      (diagnostic) =>
        diagnostic.severity === "blocker" && diagnostic.code.includes("MISSING")
    )
  ) {
    return "missing";
  }

  if (
    diagnostics.some(
      (diagnostic) =>
        diagnostic.severity === "blocker" &&
        diagnostic.code === "SKETCH_EDIT_UNSUPPORTED"
    )
  ) {
    return "unsupported";
  }

  return diagnostics.some((diagnostic) => diagnostic.severity === "blocker")
    ? "blocked"
    : "valid";
}

function getProposalSketchId(
  document: SketchEditReadinessDocument,
  edit: CadSketchEditProposal
): SketchId | undefined {
  if (
    edit.editKind === "sketch.updateEntity" ||
    edit.editKind === "sketch.setEntityConstruction" ||
    edit.editKind === "entity.dimension.update" ||
    edit.editKind === "sketch.dimension.create" ||
    edit.editKind === "sketch.constraint.create"
  ) {
    return edit.sketchId;
  }

  if (
    edit.editKind === "sketch.dimension.update" ||
    edit.editKind === "sketch.dimension.delete"
  ) {
    return document.sketchDimensions.get(edit.id)?.sketchId;
  }

  return document.sketchConstraints.get(edit.id)?.sketchId;
}

function hasExistingDimensionTarget(
  document: SimulatedSketchDocument,
  dimension: SketchDimensionSnapshot
): boolean {
  return [...document.sketchDimensions.values()].some(
    (candidate) =>
      candidate.id !== dimension.id &&
      candidate.sketchId === dimension.sketchId &&
      candidate.entityId === dimension.entityId &&
      candidate.target.entityKind === dimension.target.entityKind &&
      candidate.target.role === dimension.target.role
  );
}

function formatSketchDimensionTarget(
  target: SketchDimensionSnapshot["target"]
): string {
  return `${target.entityKind}.${target.role}`;
}

function cloneSketchDocument(
  document: SketchEditReadinessDocument
): SimulatedSketchDocument {
  return {
    sketches: new Map(
      [...document.sketches.entries()].map(([id, sketch]) => [
        id,
        { ...sketch, entities: new Map(sketch.entities) }
      ])
    ),
    parameters: document.parameters,
    sketchDimensions: new Map(document.sketchDimensions),
    sketchConstraints: new Map(document.sketchConstraints)
  };
}

function createDiagnosticFromApplyIssue(
  issue: SketchSolverApplyIssue
): CadSketchEditDiagnostic {
  return createDiagnostic({
    code:
      issue.code === "INVALID_SKETCH_DIMENSION"
        ? "SKETCH_EDIT_INVALID_VALUE"
        : "SKETCH_EDIT_CONFLICTING_CONSTRAINT",
    severity: "blocker",
    message: issue.message,
    sketchId: issue.sketchId,
    sketchEntityId: issue.sketchEntityId,
    sketchDimensionId: issue.sketchDimensionId,
    sketchConstraintId: issue.sketchConstraintId,
    fieldPath: issue.pathField,
    expected: issue.expected,
    received: issue.received
  });
}

function addSupportedDiagnostic(
  diagnostics: readonly CadSketchEditDiagnostic[],
  sketchId: SketchId | undefined
): readonly CadSketchEditDiagnostic[] {
  if (diagnostics.some((diagnostic) => diagnostic.severity === "blocker")) {
    return diagnostics;
  }

  return [
    ...diagnostics,
    createDiagnostic({
      code: "SKETCH_EDIT_SUPPORTED",
      severity: "info",
      message:
        "Sketch edit readiness dry-run is supported for this source-backed edit.",
      sketchId
    })
  ];
}

function createDiagnostic(
  diagnostic: CadSketchEditDiagnostic
): CadSketchEditDiagnostic {
  return diagnostic;
}

function createMissingEntityDiagnostic(
  sketchId: SketchId,
  entityId: SketchEntityId,
  constraintId: SketchConstraintId
): CadSketchEditDiagnostic {
  return createDiagnostic({
    code: "SKETCH_EDIT_MISSING_ENTITY",
    severity: "blocker",
    message: `Sketch entity does not exist: ${entityId}`,
    sketchId,
    sketchEntityId: entityId,
    sketchConstraintId: constraintId,
    expected: "existing sketch entity",
    received: entityId
  });
}

function getConstraintAffectedEntityIds(
  constraint: SketchConstraintSnapshot
): readonly SketchEntityId[] {
  if (constraint.kind === "fixed") {
    return [constraint.target.entityId];
  }

  if (constraint.kind === "coincident") {
    return [
      constraint.primaryTarget.entityId,
      constraint.secondaryTarget.entityId
    ];
  }

  if (constraint.kind === "midpoint") {
    return [constraint.lineEntityId, constraint.target.entityId];
  }

  if (constraint.kind === "parallel" || constraint.kind === "perpendicular") {
    return [constraint.primaryLineEntityId, constraint.secondaryLineEntityId];
  }

  if (constraint.kind === "tangent") {
    return [
      constraint.primaryTarget.entityId,
      constraint.secondaryTarget.entityId
    ];
  }

  if (constraint.kind === "concentric" || constraint.kind === "equalRadius") {
    return [
      constraint.primaryCircleEntityId,
      constraint.secondaryCircleEntityId
    ];
  }

  if (constraint.kind === "equalLength" || constraint.kind === "angle") {
    return [constraint.primaryLineEntityId, constraint.secondaryLineEntityId];
  }

  if (constraint.kind === "symmetry") {
    return [
      constraint.primaryTarget.entityId,
      constraint.secondaryTarget.entityId,
      constraint.symmetryLineEntityId
    ];
  }

  return [constraint.entityId];
}

function getConstraintProposalAffectedEntityIds(
  edit: CadSketchConstraintCreateEditProposal
): readonly SketchEntityId[] {
  if (edit.kind === "fixed") {
    return [edit.target.entityId];
  }

  if (edit.kind === "coincident") {
    return [edit.primaryTarget.entityId, edit.secondaryTarget.entityId];
  }

  if (edit.kind === "midpoint") {
    return [edit.lineEntityId, edit.target.entityId];
  }

  if (edit.kind === "parallel" || edit.kind === "perpendicular") {
    return [edit.primaryLineEntityId, edit.secondaryLineEntityId];
  }

  return [edit.entityId];
}

function getSketchPointTargetCoordinate(
  entity: SketchEntitySnapshot,
  target: SketchPointTarget
): Vec2 {
  if (entity.kind === "point" && target.role === "position") {
    return entity.point;
  }

  if (entity.kind === "line" && target.role === "start") {
    return entity.start;
  }

  if (entity.kind === "line" && target.role === "end") {
    return entity.end;
  }

  if (
    (entity.kind === "rectangle" || entity.kind === "circle") &&
    target.role === "center"
  ) {
    return entity.center;
  }

  return [NaN, NaN];
}

function combineReferenceStatuses(
  statuses: readonly CadReferenceHealthStatus[]
): CadReferenceHealthStatus | undefined {
  if (statuses.length === 0) {
    return undefined;
  }

  const priority: readonly CadReferenceHealthStatus[] = [
    "missing",
    "ambiguous",
    "repair-needed",
    "stale",
    "unsupported",
    "consumed",
    "replaced",
    "deleted",
    "active"
  ];

  return priority.find((status) => statuses.includes(status)) ?? statuses[0];
}
