import { describe, expect, it } from "vitest";
import {
  SKETCH_SOLVER_MODEL_VERSION,
  evaluateSketchResidualsAtInitialState,
  solveSketch,
  type SketchSolveDimension,
  type SketchSolveModel,
  type SketchSolvePointTarget
} from "./index";

const pointTarget = (pointId: string): SketchSolvePointTarget => ({
  kind: "point",
  pointId
});

const lineTarget = (startPointId: string, endPointId: string) => ({
  kind: "line" as const,
  startPointId,
  endPointId
});

function model(
  points: SketchSolveModel["points"],
  dimensions: readonly SketchSolveDimension[]
): SketchSolveModel {
  return {
    version: SKETCH_SOLVER_MODEL_VERSION,
    points,
    dimensions,
    settings: {
      tolerance: 1e-7,
      angularToleranceDegrees: 0.1
    }
  };
}

describe("V19 normalized dimension residuals", () => {
  it("evaluates generalized euclidean and signed point-component residuals", () => {
    const result = evaluateSketchResidualsAtInitialState(
      model(
        [
          { id: "origin", initial: [0, 0] },
          { id: "positive", initial: [4, 3] },
          { id: "negative", initial: [-2, -5] }
        ],
        [
          {
            id: "distance",
            kind: "pointDistance",
            primaryTarget: pointTarget("origin"),
            secondaryTarget: pointTarget("positive"),
            value: 5
          },
          {
            id: "horizontal_negative",
            kind: "pointComponent",
            primaryTarget: pointTarget("origin"),
            secondaryTarget: pointTarget("negative"),
            axis: "horizontal",
            value: -2
          },
          {
            id: "vertical_positive",
            kind: "pointComponent",
            primaryTarget: pointTarget("origin"),
            secondaryTarget: pointTarget("positive"),
            axis: "vertical",
            value: 3
          }
        ]
      )
    );

    expect(result.status).toBe("evaluated");
    expect(result.records).toEqual([
      expect.objectContaining({
        sourceId: "distance",
        family: "pointDistance",
        residuals: [0],
        satisfied: true
      }),
      expect.objectContaining({
        sourceId: "horizontal_negative",
        family: "pointComponent",
        residuals: [0],
        satisfied: true
      }),
      expect.objectContaining({
        sourceId: "vertical_positive",
        family: "pointComponent",
        residuals: [0],
        satisfied: true
      })
    ]);
  });

  it("uses signed infinite-line support distance on both stored sides", () => {
    const result = evaluateSketchResidualsAtInitialState(
      model(
        [
          { id: "line_start", initial: [0, 0] },
          { id: "line_end", initial: [2, 0] },
          { id: "beyond_left", initial: [5, 3] },
          { id: "beyond_right", initial: [-4, -2] }
        ],
        [
          {
            id: "left",
            kind: "pointLineDistance",
            pointTarget: pointTarget("beyond_left"),
            lineTarget: lineTarget("line_start", "line_end"),
            side: "left",
            value: 3
          },
          {
            id: "right",
            kind: "pointLineDistance",
            pointTarget: pointTarget("beyond_right"),
            lineTarget: lineTarget("line_start", "line_end"),
            side: "right",
            value: 2
          }
        ]
      )
    );

    expect(result.status).toBe("evaluated");
    expect(result.records).toEqual([
      expect.objectContaining({
        sourceId: "left",
        family: "pointLineDistance",
        residuals: [0],
        satisfied: true
      }),
      expect.objectContaining({
        sourceId: "right",
        family: "pointLineDistance",
        residuals: [0],
        satisfied: true
      })
    ]);
  });

  it("evaluates clockwise and counterclockwise line-angle senses in degrees", () => {
    const sixty = Math.PI / 3;
    const result = evaluateSketchResidualsAtInitialState(
      model(
        [
          { id: "origin", initial: [0, 0] },
          { id: "east", initial: [1, 0] },
          { id: "ccw", initial: [Math.cos(sixty), Math.sin(sixty)] },
          { id: "cw", initial: [Math.cos(sixty), -Math.sin(sixty)] }
        ],
        [
          {
            id: "ccw",
            kind: "lineAngle",
            primaryLineTarget: lineTarget("origin", "east"),
            secondaryLineTarget: lineTarget("origin", "ccw"),
            sense: "counterclockwise",
            value: 60
          },
          {
            id: "cw",
            kind: "lineAngle",
            primaryLineTarget: lineTarget("origin", "east"),
            secondaryLineTarget: lineTarget("origin", "cw"),
            sense: "clockwise",
            value: 60
          }
        ]
      )
    );

    expect(result.status).toBe("evaluated");
    expect(result.records).toHaveLength(2);
    for (const record of result.records) {
      expect(record.family).toBe("lineAngle");
      expect(record.maxResidual).toBeCloseTo(0, 10);
      expect(record.satisfactionTolerance).toBe(0.1);
      expect(record.satisfied).toBe(true);
    }
  });

  it("rejects zero-length target lines and invalid direction/side/sense branches", () => {
    const zeroLine = evaluateSketchResidualsAtInitialState(
      model(
        [
          { id: "same_a", initial: [0, 0] },
          { id: "same_b", initial: [0, 0] },
          { id: "point", initial: [0, 2] },
          { id: "east", initial: [1, 0] }
        ],
        [
          {
            id: "zero_distance",
            kind: "pointLineDistance",
            pointTarget: pointTarget("point"),
            lineTarget: lineTarget("same_a", "same_b"),
            side: "left",
            value: 2
          },
          {
            id: "zero_angle",
            kind: "lineAngle",
            primaryLineTarget: lineTarget("same_a", "same_b"),
            secondaryLineTarget: lineTarget("same_a", "east"),
            sense: "counterclockwise",
            value: 90
          }
        ]
      )
    );
    expect(zeroLine.status).toBe("blocked");
    expect(zeroLine.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "SKETCH_DIMENSION_DISTANCE_INVALID",
          sourceId: "zero_distance",
          received: "zero-length line"
        }),
        expect.objectContaining({
          code: "SKETCH_DIMENSION_ANGLE_SENSE_INVALID",
          sourceId: "zero_angle",
          received: "zero-length line"
        })
      ])
    );

    const wrongBranches = evaluateSketchResidualsAtInitialState(
      model(
        [
          { id: "origin", initial: [0, 0] },
          { id: "east", initial: [2, 0] },
          { id: "north", initial: [0, 2] },
          { id: "west", initial: [-2, 0] }
        ],
        [
          {
            id: "wrong_direction",
            kind: "pointComponent",
            primaryTarget: pointTarget("origin"),
            secondaryTarget: pointTarget("west"),
            axis: "horizontal",
            value: 2
          },
          {
            id: "wrong_side",
            kind: "pointLineDistance",
            pointTarget: pointTarget("north"),
            lineTarget: lineTarget("origin", "east"),
            side: "right",
            value: 2
          },
          {
            id: "wrong_sense",
            kind: "lineAngle",
            primaryLineTarget: lineTarget("origin", "east"),
            secondaryLineTarget: lineTarget("origin", "north"),
            sense: "clockwise",
            value: 90
          }
        ]
      )
    );
    expect(wrongBranches.status).toBe("blocked");
    expect(
      wrongBranches.diagnostics.map(({ code, sourceId }) => ({
        code,
        sourceId
      }))
    ).toEqual([
      {
        code: "SKETCH_DIMENSION_DISTANCE_INVALID",
        sourceId: "wrong_direction"
      },
      {
        code: "SKETCH_DIMENSION_DISTANCE_INVALID",
        sourceId: "wrong_side"
      },
      {
        code: "SKETCH_DIMENSION_ANGLE_SENSE_INVALID",
        sourceId: "wrong_sense"
      }
    ]);
  });

  it("reports contradictory normalized residual sources deterministically", () => {
    const dimensions: readonly SketchSolveDimension[] = [
      {
        id: "z_three",
        kind: "pointComponent",
        primaryTarget: pointTarget("a"),
        secondaryTarget: pointTarget("b"),
        axis: "horizontal",
        value: 3
      },
      {
        id: "a_two",
        kind: "pointComponent",
        primaryTarget: pointTarget("a"),
        secondaryTarget: pointTarget("b"),
        axis: "horizontal",
        value: 2
      }
    ];
    const points = [
      { id: "a", initial: [0, 0] as const },
      { id: "b", initial: [2, 0] as const }
    ];
    const first = solveSketch(model(points, dimensions));
    const reordered = solveSketch(model(points, [...dimensions].reverse()));
    const evidence = (result: typeof first) =>
      result.diagnostics
        .filter(
          (diagnostic) =>
            diagnostic.code === "SKETCH_SOLVER_CONFLICTING" &&
            diagnostic.sourceType === "dimension"
        )
        .map(({ code, sourceId, dimensionKind, expected, received }) => ({
          code,
          sourceId,
          dimensionKind,
          expected,
          received
        }));

    expect(first.status).toBe("conflicting");
    expect(reordered.status).toBe("conflicting");
    expect(evidence(first)).toEqual(evidence(reordered));
    expect(evidence(first).map(({ sourceId }) => sourceId)).toEqual([
      "a_two",
      "z_three"
    ]);
  });

  it("uses angular family tolerance consistently for convergence and conflict classification", () => {
    const result = solveSketch(
      model(
        [
          { id: "origin", initial: [0, 0] },
          { id: "east", initial: [1, 0] },
          { id: "sixty", initial: [0.5, Math.sqrt(3) / 2] }
        ],
        [
          {
            id: "angle_60",
            kind: "lineAngle",
            primaryLineTarget: lineTarget("origin", "east"),
            secondaryLineTarget: lineTarget("origin", "sixty"),
            sense: "counterclockwise",
            value: 60
          },
          {
            id: "angle_60_05",
            kind: "lineAngle",
            primaryLineTarget: lineTarget("origin", "east"),
            secondaryLineTarget: lineTarget("origin", "sixty"),
            sense: "counterclockwise",
            value: 60.05
          }
        ]
      )
    );

    expect(result.status).toBe("under-defined");
    expect(result.iterations).toBe(0);
    expect(result.diagnostics).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "SKETCH_SOLVER_CONFLICTING" })
      ])
    );
  });
});
