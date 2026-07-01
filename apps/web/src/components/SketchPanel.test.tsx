import type {
  SketchConstraintEntry,
  SketchDimensionEntry,
  SketchEvaluationQueryResponse,
  SketchSolverStatusQueryResponse,
  SketchSnapshot
} from "@web-cad/cad-protocol";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SketchPanel } from "./SketchPanel";

describe("SketchPanel", () => {
  it("renders compact solver status and selected entity intent", () => {
    const rectangle: SketchSnapshot["entities"][number] = {
      id: "rect_1",
      kind: "rectangle",
      center: [0, 0],
      width: 4,
      height: 2
    };
    const sketch: SketchSnapshot = {
      id: "sketch_1",
      name: "Sketch 1",
      plane: "XY",
      entities: [rectangle]
    };
    const dimension: SketchDimensionEntry = {
      id: "dim_width",
      name: "Width",
      sketchId: sketch.id,
      entityId: rectangle.id,
      target: { entityKind: "rectangle", role: "width" },
      valueSource: { type: "literal", value: 4 },
      status: "healthy",
      issues: [],
      effectiveValue: 4
    };
    const constraint: SketchConstraintEntry = {
      id: "constraint_fixed",
      name: "Fixed center",
      sketchId: sketch.id,
      kind: "fixed",
      entityId: rectangle.id,
      target: { entityId: rectangle.id, role: "position" },
      coordinate: [0, 0],
      status: "healthy",
      issues: []
    };
    const markup = renderToStaticMarkup(
      createElement(SketchPanel, {
        disabled: false,
        sketches: [sketch],
        parameters: [],
        features: [],
        sketchDimensionsBySketchId: new Map([[sketch.id, [dimension]]]),
        sketchEvaluationsBySketchId: new Map([
          [sketch.id, createEvaluation(sketch, dimension, constraint)]
        ]),
        sketchSolverStatusesBySketchId: new Map([
          [sketch.id, createSolverStatus()]
        ]),
        onCreateSketch: () => undefined,
        onCreateParameter: () => undefined,
        onApplyParameterEdit: () => undefined,
        onDeleteParameter: () => undefined,
        onRenameSketch: () => undefined,
        onDeleteSketch: () => undefined,
        onAddEntity: () => undefined,
        onUpdateEntity: () => undefined,
        onDeleteEntity: () => undefined,
        onCreateDimension: () => undefined,
        onApplyDimensionEdit: () => undefined,
        onDeleteDimension: () => undefined,
        onCreateConstraint: () => undefined,
        onApplyConstraintEdit: () => undefined,
        onDeleteConstraint: () => undefined,
        onExtrudeEntity: () => undefined,
        onRevolveEntity: () => undefined,
        onHoleEntity: () => undefined
      })
    );

    expect(markup).toContain("Evaluation");
    expect(markup).toContain("Solver");
    expect(markup).toContain("Feature-ready");
    expect(markup).toContain("Numerical under-defined");
    expect(markup).toContain("1/1 feature-ready profile");
    expect(markup).toContain("1 dim · 1 constraint");
    expect(markup).toContain("Driving dimensions");
    expect(markup).toContain("Sketch constraints");
    expect(markup).not.toContain("sourceBoundaryNote");
    expect(markup).not.toContain("derivedBoundaryNote");
  });

  it("renders session-only constraint inference for selected line entities", () => {
    const line: SketchSnapshot["entities"][number] = {
      id: "line_1",
      kind: "line",
      start: [0, 0],
      end: [4, 0.1]
    };
    const sketch: SketchSnapshot = {
      id: "sketch_1",
      name: "Sketch 1",
      plane: "XY",
      entities: [line]
    };
    const markup = renderToStaticMarkup(
      createElement(SketchPanel, {
        disabled: false,
        sketches: [sketch],
        parameters: [],
        features: [],
        sketchDimensionsBySketchId: new Map([[sketch.id, []]]),
        sketchEvaluationsBySketchId: new Map([
          [sketch.id, createEmptyEvaluation(sketch)]
        ]),
        sketchSolverStatusesBySketchId: new Map([
          [sketch.id, createSolverStatus()]
        ]),
        onCreateSketch: () => undefined,
        onCreateParameter: () => undefined,
        onApplyParameterEdit: () => undefined,
        onDeleteParameter: () => undefined,
        onRenameSketch: () => undefined,
        onDeleteSketch: () => undefined,
        onAddEntity: () => undefined,
        onUpdateEntity: () => undefined,
        onDeleteEntity: () => undefined,
        onCreateDimension: () => undefined,
        onApplyDimensionEdit: () => undefined,
        onDeleteDimension: () => undefined,
        onCreateConstraint: () => undefined,
        onApplyConstraintEdit: () => undefined,
        onDeleteConstraint: () => undefined,
        onExtrudeEntity: () => undefined,
        onRevolveEntity: () => undefined,
        onHoleEntity: () => undefined
      })
    );

    expect(markup).toContain("Inferred constraints");
    expect(markup).toContain("Session only until accepted");
    expect(markup).toContain("Horizontal");
    expect(markup).not.toContain("renderer");
    expect(markup).not.toContain("selection-buffer");
  });
});

function createEvaluation(
  sketch: SketchSnapshot,
  dimension: SketchDimensionEntry,
  constraint: SketchConstraintEntry
): SketchEvaluationQueryResponse {
  return {
    ok: true,
    query: "sketch.evaluation",
    cadOpsVersion: "cadops.v1",
    sketchId: sketch.id,
    sketchName: sketch.name,
    plane: sketch.plane,
    status: "healthy",
    drivenEntityCount: 1,
    drivenEntityIds: ["rect_1"],
    dimensionCount: 1,
    dimensions: [dimension],
    constraintCount: 1,
    constraints: [constraint],
    issueCount: 0,
    issues: []
  };
}

function createEmptyEvaluation(
  sketch: SketchSnapshot
): SketchEvaluationQueryResponse {
  return {
    ok: true,
    query: "sketch.evaluation",
    cadOpsVersion: "cadops.v1",
    sketchId: sketch.id,
    sketchName: sketch.name,
    plane: sketch.plane,
    status: "healthy",
    drivenEntityCount: sketch.entities.length,
    drivenEntityIds: sketch.entities.map((entity) => entity.id),
    dimensionCount: 0,
    dimensions: [],
    constraintCount: 0,
    constraints: [],
    issueCount: 0,
    issues: []
  };
}

function createSolverStatus(): SketchSolverStatusQueryResponse {
  return {
    ok: true,
    query: "sketch.solverStatus",
    cadOpsVersion: "cadops.v1",
    sketchId: "sketch_1",
    sketchName: "Sketch 1",
    plane: "XY",
    status: "under-defined",
    readiness: "ready",
    solver: {
      engine: "current-direct-evaluator",
      numericalSolverStatus: "under-defined",
      numericalSolverEngine: "@web-cad/sketch-solver",
      numericalSolverModelVersion: "partbench.sketch-solver.v1",
      modelBuilt: true,
      solverRan: true,
      canSolveNumerically: true,
      deterministic: true,
      workerReady: false,
      diagnostic: {
        code: "SKETCH_SOLVER_NUMERICAL_STATUS_READY",
        severity: "info",
        message: "Numerical solver status is available.",
        sketchId: "sketch_1"
      }
    },
    entityCount: 1,
    entities: [],
    dimensionCount: 1,
    dimensions: [],
    constraintCount: 1,
    constraints: [],
    deferredConstraintCount: 0,
    deferredConstraints: [],
    profileValidity: {
      status: "valid",
      profileCount: 1,
      validProfileCount: 1,
      profiles: [],
      diagnosticCount: 0,
      diagnostics: []
    },
    preview: {
      status: "deferred",
      willMutateDocument: false,
      supportedPreviewKinds: [],
      deferredPreviewKinds: ["entity.drag"],
      diagnosticCount: 0,
      diagnostics: []
    },
    sourceContract: {
      currentProjectSchemaVersion: "web-cad.project.v16",
      emittedProjectSchemaVersion: "web-cad.project.v16",
      packageVersion: "partbench.wcad.v1",
      queryOnly: true,
      requiresProjectSchemaMigration: false,
      nextProjectSchemaVersion: "web-cad.project.v17",
      sourceRecordRequirements: []
    },
    diagnosticCount: 0,
    diagnostics: [],
    sourceBoundaryNote: "source",
    derivedBoundaryNote: "derived",
    requiresProjectSchemaMigration: false
  };
}
