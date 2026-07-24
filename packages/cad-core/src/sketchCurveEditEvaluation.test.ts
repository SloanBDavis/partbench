import { describe, expect, it } from "vitest";

import { createCadDocument, type Sketch, type SketchDimension } from "./index";
import { createSketchCurveEditEvaluationEvidence } from "./sketchCurveEditEvaluation";

const sourceIdentity = {
  algorithm: "partbench-source-v1" as const,
  sha256: "1".repeat(64)
};

function lineSketch(): Sketch {
  return {
    id: "sketch_1",
    name: "Profile",
    plane: "XY",
    entities: new Map([
      [
        "line_1",
        {
          id: "line_1",
          kind: "line",
          start: [0, 0],
          end: [10, 0],
          construction: false
        }
      ]
    ])
  };
}

describe("V19 curve-edit evaluation evidence", () => {
  it("uses none exactly when the sketch has no solver records", () => {
    const sketch = lineSketch();
    const document = createCadDocument([], "mm", [[sketch.id, sketch]]);

    const evidence = createSketchCurveEditEvaluationEvidence({
      sourceIdentity,
      document,
      sketch
    });

    expect(evidence.solverStatus).toBe("not-run");
    expect(evidence.solverEvaluationIdentity).toBe("none");
    expect(evidence.constraintResiduals).toEqual([]);
    expect(evidence.dimensionResiduals).toEqual([]);
    expect(evidence.blocked).toBe(false);
  });

  it("hashes stable zero-iteration residual evidence for solver records", () => {
    const sketch = lineSketch();
    const dimension: SketchDimension = {
      id: "skdim_1",
      name: "Length",
      sketchId: sketch.id,
      target: {
        kind: "entityScalar",
        entityId: "line_1",
        entityKind: "line",
        role: "length"
      },
      valueSource: { type: "literal", value: 10 }
    };
    const document = createCadDocument(
      [],
      "mm",
      [[sketch.id, sketch]],
      [],
      [[dimension.id, dimension]]
    );

    const first = createSketchCurveEditEvaluationEvidence({
      sourceIdentity,
      document,
      sketch
    });
    const second = createSketchCurveEditEvaluationEvidence({
      sourceIdentity,
      document,
      sketch
    });

    expect(first.solverEvaluationIdentity).toMatch(
      /^partbench-sketch-solver-evaluation-v1:[0-9a-f]{64}$/
    );
    expect(second.solverEvaluationIdentity).toBe(
      first.solverEvaluationIdentity
    );
    expect(first.authoredResidualEvaluation).toMatchObject({
      iterations: 0,
      status: "evaluated"
    });
    expect(first.dimensionResiduals).toEqual([
      {
        id: "skdim_1",
        family: "lineLength",
        status: "healthy",
        residual: 0
      }
    ]);
  });

  it("blocks rather than fabricating residuals for unmapped V22 records", () => {
    const sketch = lineSketch();
    const dimension: SketchDimension = {
      id: "skdim_pair",
      name: "Endpoint span",
      sketchId: sketch.id,
      target: {
        kind: "pointPair",
        primary: {
          entityId: "line_1",
          entityKind: "line",
          role: "start"
        },
        secondary: {
          entityId: "line_1",
          entityKind: "line",
          role: "end"
        },
        measurement: "distance"
      },
      valueSource: { type: "literal", value: 10 }
    };
    const document = createCadDocument(
      [],
      "mm",
      [[sketch.id, sketch]],
      [],
      [[dimension.id, dimension]]
    );

    const evidence = createSketchCurveEditEvaluationEvidence({
      sourceIdentity,
      document,
      sketch
    });

    expect(evidence).toMatchObject({
      blocked: true,
      solverStatus: "failed",
      constraintResiduals: [],
      dimensionResiduals: []
    });
    expect(evidence.solverEvaluationIdentity).toBeUndefined();
    expect(evidence.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "SKETCH_EDIT_SOLVER_RECORD_MAPPING_INCOMPLETE"
        })
      ])
    );
  });
});
