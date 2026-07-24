import { describe, expect, it } from "vitest";
import {
  SKETCH_SOLVER_MODEL_VERSION,
  evaluateSketchResidualsAtInitialState,
  solveSketch,
  type SketchSolveConstraint,
  type SketchSolveModel
} from "./index";

function orderedModel(): SketchSolveModel {
  return {
    version: SKETCH_SOLVER_MODEL_VERSION,
    points: [
      { id: "a", initial: [0, 0] },
      { id: "b", initial: [2, 0] },
      { id: "c", initial: [0, 1] },
      { id: "d", initial: [0, 3] }
    ],
    constraints: [
      {
        id: "z_vertical",
        kind: "vertical",
        startPointId: "c",
        endPointId: "d"
      },
      {
        id: "m_coincident",
        kind: "coincident",
        pointAId: "a",
        pointBId: "c"
      },
      {
        id: "a_horizontal",
        kind: "horizontal",
        startPointId: "a",
        endPointId: "b"
      }
    ],
    dimensions: [
      {
        id: "z_line",
        kind: "lineLength",
        startPointId: "a",
        endPointId: "b",
        value: 3
      },
      {
        id: "a_distance",
        kind: "pointDistance",
        pointAId: "c",
        pointBId: "d",
        value: 2
      }
    ]
  };
}

describe("evaluateSketchResidualsAtInitialState", () => {
  it("reports satisfied and unsatisfied residual families in stable source order", () => {
    const result = evaluateSketchResidualsAtInitialState(orderedModel());

    expect(result).toMatchObject({
      version: SKETCH_SOLVER_MODEL_VERSION,
      status: "evaluated",
      blocked: false,
      iterations: 0,
      diagnosticCount: 0,
      diagnostics: []
    });
    expect(result.records).toEqual([
      {
        sourceType: "constraint",
        sourceId: "a_horizontal",
        family: "horizontal",
        residuals: [0],
        maxResidual: 0,
        satisfied: true
      },
      {
        sourceType: "constraint",
        sourceId: "m_coincident",
        family: "coincident",
        residuals: [0, -1],
        maxResidual: 1,
        satisfied: false
      },
      {
        sourceType: "constraint",
        sourceId: "z_vertical",
        family: "vertical",
        residuals: [0],
        maxResidual: 0,
        satisfied: true
      },
      {
        sourceType: "dimension",
        sourceId: "a_distance",
        family: "pointDistance",
        residuals: [0],
        maxResidual: 0,
        satisfied: true
      },
      {
        sourceType: "dimension",
        sourceId: "z_line",
        family: "lineLength",
        residuals: [-1],
        maxResidual: 1,
        satisfied: false
      }
    ]);
  });

  it("evaluates the authored state without moving geometry or running a free solve", () => {
    const model: SketchSolveModel = {
      version: SKETCH_SOLVER_MODEL_VERSION,
      points: [{ id: "p", initial: [5, 6] }],
      constraints: [
        {
          id: "fixed",
          kind: "fixedPoint",
          pointId: "p",
          value: [0, 0]
        }
      ]
    };
    const authoredSnapshot = JSON.parse(JSON.stringify(model)) as unknown;

    const evaluation = evaluateSketchResidualsAtInitialState(model);
    const solved = solveSketch(model);

    expect(evaluation.records).toEqual([
      {
        sourceType: "constraint",
        sourceId: "fixed",
        family: "fixedPoint",
        residuals: [5, 6],
        maxResidual: 6,
        satisfied: false
      }
    ]);
    expect(solved.iterations).toBeGreaterThan(0);
    expect(solved.points[0]?.value[0]).toBeCloseTo(0, 7);
    expect(solved.points[0]?.value[1]).toBeCloseTo(0, 7);
    expect(model).toEqual(authoredSnapshot);
  });

  it("uses the configured solver tolerance for satisfaction", () => {
    const result = evaluateSketchResidualsAtInitialState({
      version: SKETCH_SOLVER_MODEL_VERSION,
      settings: { tolerance: 1e-4 },
      points: [
        { id: "a", initial: [0, 0] },
        { id: "within", initial: [1, 0.00005] },
        { id: "outside", initial: [1, 0.0002] }
      ],
      constraints: [
        {
          id: "outside",
          kind: "horizontal",
          startPointId: "a",
          endPointId: "outside"
        },
        {
          id: "within",
          kind: "horizontal",
          startPointId: "a",
          endPointId: "within"
        }
      ]
    });

    expect(result.records).toEqual([
      expect.objectContaining({
        sourceId: "outside",
        maxResidual: 0.0002,
        satisfied: false
      }),
      expect.objectContaining({
        sourceId: "within",
        maxResidual: 0.00005,
        satisfied: true
      })
    ]);
  });

  it("is deterministic when constraint and dimension input order changes", () => {
    const model = orderedModel();
    const reordered: SketchSolveModel = {
      ...model,
      constraints: [...(model.constraints ?? [])].reverse(),
      dimensions: [...(model.dimensions ?? [])].reverse()
    };

    expect(evaluateSketchResidualsAtInitialState(reordered)).toEqual(
      evaluateSketchResidualsAtInitialState(model)
    );
  });

  it("blocks malformed targets and returns validation diagnostics without evaluating", () => {
    const result = evaluateSketchResidualsAtInitialState({
      version: SKETCH_SOLVER_MODEL_VERSION,
      points: [{ id: "present", initial: [0, 0] }],
      constraints: [
        {
          id: "broken",
          kind: "coincident",
          pointAId: "present",
          pointBId: "missing"
        }
      ]
    });

    expect(result).toMatchObject({
      status: "blocked",
      blocked: true,
      records: []
    });
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "SKETCH_SOLVER_MISSING_TARGET",
        severity: "blocker",
        sourceType: "constraint",
        sourceId: "broken",
        targetId: "missing"
      })
    );
  });

  it("preserves unsupported diagnostics and does not evaluate unsupported blocks", () => {
    const unsupported = {
      id: "arc_parallel",
      kind: "parallel",
      primaryTarget: { kind: "arc", arcId: "arc" },
      primaryStartPointId: "a",
      primaryEndPointId: "b",
      secondaryStartPointId: "a",
      secondaryEndPointId: "b"
    } as unknown as SketchSolveConstraint;
    const result = evaluateSketchResidualsAtInitialState({
      version: SKETCH_SOLVER_MODEL_VERSION,
      points: [
        { id: "a", initial: [0, 0] },
        { id: "b", initial: [1, 0] }
      ],
      arcs: [
        {
          id: "arc",
          initial: {
            center: [0, 0],
            radius: 1,
            startAngleDegrees: 0,
            sweepAngleDegrees: 90
          }
        }
      ],
      constraints: [unsupported]
    });

    expect(result).toMatchObject({
      status: "unsupported",
      blocked: true,
      records: []
    });
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "SKETCH_SOLVER_UNSUPPORTED_CONSTRAINT",
        sourceId: "arc_parallel"
      })
    );
  });

  it("rejects duplicate constraint and dimension source IDs deterministically", () => {
    const result = evaluateSketchResidualsAtInitialState({
      version: SKETCH_SOLVER_MODEL_VERSION,
      points: [
        { id: "a", initial: [0, 0] },
        { id: "b", initial: [1, 0] }
      ],
      constraints: [
        {
          id: "duplicate",
          kind: "horizontal",
          startPointId: "a",
          endPointId: "b"
        },
        {
          id: "duplicate",
          kind: "vertical",
          startPointId: "a",
          endPointId: "b"
        }
      ],
      dimensions: [
        {
          id: "duplicate",
          kind: "lineLength",
          startPointId: "a",
          endPointId: "b",
          value: 1
        },
        {
          id: "duplicate",
          kind: "pointDistance",
          pointAId: "a",
          pointBId: "b",
          value: 1
        }
      ]
    });

    expect(result).toMatchObject({
      status: "blocked",
      blocked: true,
      records: []
    });
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: "SKETCH_SOLVER_INVALID_VALUE",
        sourceType: "constraint",
        sourceId: "duplicate",
        received: "2 records with id duplicate"
      }),
      expect.objectContaining({
        code: "SKETCH_SOLVER_INVALID_VALUE",
        sourceType: "dimension",
        sourceId: "duplicate",
        received: "2 records with id duplicate"
      })
    ]);
  });
});
