import { describe, expect, it } from "vitest";
import type {
  CadSketchSolverStatus,
  SketchDimensionStatus,
  SketchEntitySnapshot
} from "@web-cad/cad-protocol";
import {
  NO_SKETCH_SOLVER_EVALUATION_IDENTITY,
  createCanonicalSketchSolverEvaluationPayload,
  createSketchCurveEditSourceRevision,
  createSketchSolverEvaluationIdentity,
  isHashedSketchSolverEvaluationIdentity,
  isSketchCurveEditSourceRevision,
  isSketchSolverEvaluationIdentity,
  normalizeSketchSolverResidualFamily,
  type SketchCurveEditSourceRevision,
  type SketchSolverConstraintResidualEvidence,
  type SketchSolverDimensionResidualEvidence,
  type SketchSolverEvaluationIdentityEvidence
} from "./sketchCurveEditIdentity";

const sourceRevisionA =
  `partbench-source-v1:${"a".repeat(64)}` as SketchCurveEditSourceRevision;
const sourceRevisionB =
  `partbench-source-v1:${"b".repeat(64)}` as SketchCurveEditSourceRevision;

const evaluatedEntities: readonly SketchEntitySnapshot[] = [
  {
    id: "point_1",
    kind: "point",
    point: [1, 2],
    construction: false
  },
  {
    id: "line_1",
    kind: "line",
    start: [0, 0],
    end: [10, 5],
    construction: false
  },
  {
    id: "rectangle_1",
    kind: "rectangle",
    center: [5, 3],
    width: 8,
    height: 4,
    construction: true
  },
  {
    id: "circle_1",
    kind: "circle",
    center: [9, -2],
    radius: 3,
    construction: false
  },
  {
    id: "arc_1",
    kind: "arc",
    center: [4, 5],
    radius: 2,
    startAngleDegrees: 30,
    sweepAngleDegrees: -120,
    construction: false
  }
];

const constraintResiduals: readonly SketchSolverConstraintResidualEvidence[] = [
  {
    id: "constraint_2",
    family: "equalLength",
    status: "healthy",
    residual: -0
  },
  {
    id: "constraint_1",
    family: "coincident",
    status: "healthy",
    residual: 1.2345678901234
  }
];

const dimensionResiduals: readonly SketchSolverDimensionResidualEvidence[] = [
  {
    id: "dimension_1",
    family: "pointDistance",
    status: "healthy",
    residual: 0.0000000000002
  }
];

function createEvidence(
  overrides: Partial<SketchSolverEvaluationIdentityEvidence> = {}
): SketchSolverEvaluationIdentityEvidence {
  return {
    sourceRevision: sourceRevisionA,
    sketchId: "sketch_1",
    solverStatus: "fully-defined",
    solverRecordCount: 3,
    evaluatedEntities,
    orderedConstraintResiduals: constraintResiduals,
    orderedDimensionResiduals: dimensionResiduals,
    ...overrides
  };
}

describe("V19 curve-edit identities", () => {
  it("formats and exactly validates committed source revisions", () => {
    expect(
      createSketchCurveEditSourceRevision({
        algorithm: "partbench-source-v1",
        sha256: "0".repeat(64)
      })
    ).toBe(`partbench-source-v1:${"0".repeat(64)}`);
    expect(isSketchCurveEditSourceRevision(sourceRevisionA)).toBe(true);

    for (const malformed of [
      undefined,
      null,
      "",
      "none",
      `partbench-source-v1:${"A".repeat(64)}`,
      `partbench-source-v1:${"a".repeat(63)}`,
      `partbench-source-v1:${"a".repeat(65)}`,
      `partbench-source-v2:${"a".repeat(64)}`,
      ` partbench-source-v1:${"a".repeat(64)}`,
      `partbench-source-v1:${"a".repeat(64)} `
    ]) {
      expect(isSketchCurveEditSourceRevision(malformed)).toBe(false);
    }

    expect(() =>
      createSketchCurveEditSourceRevision({
        algorithm: "other" as "partbench-source-v1",
        sha256: "0".repeat(64)
      })
    ).toThrow(/algorithm/);
    expect(() =>
      createSketchCurveEditSourceRevision({
        algorithm: "partbench-source-v1",
        sha256: "A".repeat(64)
      })
    ).toThrow(/lowercase SHA-256/);
  });

  it("exactly validates hashed and no-record solver identities", () => {
    const hashed =
      `partbench-sketch-solver-evaluation-v1:${"f".repeat(64)}` as const;
    expect(isHashedSketchSolverEvaluationIdentity(hashed)).toBe(true);
    expect(isSketchSolverEvaluationIdentity(hashed)).toBe(true);
    expect(isSketchSolverEvaluationIdentity("none")).toBe(true);
    expect(isHashedSketchSolverEvaluationIdentity("none")).toBe(false);

    for (const malformed of [
      undefined,
      null,
      "",
      "NONE",
      `partbench-sketch-solver-evaluation-v1:${"F".repeat(64)}`,
      `partbench-sketch-solver-evaluation-v1:${"f".repeat(63)}`,
      `partbench-sketch-solver-evaluation-v1:${"f".repeat(65)}`,
      `partbench-sketch-solver-evaluation-v2:${"f".repeat(64)}`,
      `partbench-sketch-solver-evaluation-v1:${"f".repeat(64)} `
    ]) {
      expect(isSketchSolverEvaluationIdentity(malformed)).toBe(false);
    }
  });

  it("returns exactly none only for a sketch with no solver records", () => {
    expect(
      createSketchSolverEvaluationIdentity(
        createEvidence({
          solverStatus: "not-run",
          solverRecordCount: 0,
          orderedConstraintResiduals: [],
          orderedDimensionResiduals: []
        })
      )
    ).toBe(NO_SKETCH_SOLVER_EVALUATION_IDENTITY);

    expect(() =>
      createSketchSolverEvaluationIdentity(
        createEvidence({
          orderedConstraintResiduals: [],
          orderedDimensionResiduals: [],
          solverRecordCount: 0
        })
      )
    ).toThrow(/without solver records must have not-run/);
    expect(() =>
      createSketchSolverEvaluationIdentity(
        createEvidence({ solverStatus: "not-run" })
      )
    ).toThrow(/with solver records cannot have not-run/);
    expect(createSketchSolverEvaluationIdentity(createEvidence())).not.toBe(
      "none"
    );
  });

  it("hashes the exact canonical V19 evidence vector", () => {
    expect(createSketchSolverEvaluationIdentity(createEvidence())).toBe(
      "partbench-sketch-solver-evaluation-v1:8ff216cee256e1c6e4912e00f2bab9130560f47ba11f184b629439dd0c837b0c"
    );
  });

  it("sorts entity and residual records by ID across array and Map order", () => {
    const baseline = createSketchSolverEvaluationIdentity(createEvidence());
    const entityMap = new Map(
      [...evaluatedEntities]
        .reverse()
        .map((entity) => [entity.id, entity] as const)
    );
    const constraintMap = new Map(
      [...constraintResiduals]
        .reverse()
        .map((record) => [record.id, record] as const)
    );
    const dimensionMap = new Map(
      [...dimensionResiduals]
        .reverse()
        .map((record) => [record.id, record] as const)
    );

    expect(
      createSketchSolverEvaluationIdentity(
        createEvidence({
          evaluatedEntities: entityMap,
          orderedConstraintResiduals: constraintMap,
          orderedDimensionResiduals: dimensionMap
        })
      )
    ).toBe(baseline);
    expect(
      createCanonicalSketchSolverEvaluationPayload(
        createEvidence({
          evaluatedEntities: [...evaluatedEntities].reverse()
        })
      ).evaluatedEntities.map(({ id }) => id)
    ).toEqual(["arc_1", "circle_1", "line_1", "point_1", "rectangle_1"]);
  });

  it("canonicalizes source numbers, arc starts, families, and irrelevant fields", () => {
    const baseline = createSketchSolverEvaluationIdentity(createEvidence());
    const noisierEvidence = createEvidence({
      evaluatedEntities: evaluatedEntities.map((entity) => {
        if (entity.kind === "point") {
          return {
            ...entity,
            point: [1.0000000000001, 2],
            presentationColor: "red"
          } as SketchEntitySnapshot;
        }
        if (entity.kind === "line") {
          return { ...entity, start: [-0, 0] };
        }
        if (entity.kind === "arc") {
          return { ...entity, startAngleDegrees: 390 };
        }
        return entity;
      }),
      orderedConstraintResiduals: [
        {
          id: "constraint_2",
          family: "equal length",
          status: "healthy",
          residual: 0,
          elapsedMilliseconds: 42
        } as SketchSolverConstraintResidualEvidence,
        {
          id: "constraint_1",
          family: "coincident",
          status: "healthy",
          residual: 1.23456789012349
        }
      ],
      orderedDimensionResiduals: [
        {
          id: "dimension_1",
          family: "point_distance",
          status: "healthy",
          residual: -0
        }
      ]
    });

    expect(normalizeSketchSolverResidualFamily("pointDistance")).toBe(
      "point-distance"
    );
    expect(normalizeSketchSolverResidualFamily("point distance")).toBe(
      "point-distance"
    );
    expect(createSketchSolverEvaluationIdentity(noisierEvidence)).toBe(
      baseline
    );
  });

  it("changes for every normative evidence family", () => {
    const baseline = createSketchSolverEvaluationIdentity(createEvidence());
    const changes: readonly SketchSolverEvaluationIdentityEvidence[] = [
      createEvidence({ sourceRevision: sourceRevisionB }),
      createEvidence({ sketchId: "sketch_2" }),
      createEvidence({ solverStatus: "under-defined" }),
      createEvidence({
        evaluatedEntities: evaluatedEntities.map((entity) =>
          entity.id === "point_1" && entity.kind === "point"
            ? { ...entity, point: [1.01, 2] }
            : entity
        )
      }),
      createEvidence({
        evaluatedEntities: evaluatedEntities.map((entity) =>
          entity.id === "point_1" ? { ...entity, construction: true } : entity
        )
      }),
      createEvidence({
        orderedConstraintResiduals: [
          {
            id: "constraint_2",
            family: "equalRadius",
            status: "healthy",
            residual: 0
          },
          ...constraintResiduals.slice(1)
        ]
      }),
      createEvidence({
        orderedConstraintResiduals: [
          {
            id: "constraint_2_changed",
            family: "equalLength",
            status: "healthy",
            residual: 0
          },
          ...constraintResiduals.slice(1)
        ]
      }),
      createEvidence({
        orderedConstraintResiduals: [
          {
            id: "constraint_2",
            family: "equalLength",
            status: "inconsistent",
            residual: 0
          },
          ...constraintResiduals.slice(1)
        ]
      }),
      createEvidence({
        orderedConstraintResiduals: [
          {
            id: "constraint_2",
            family: "equalLength",
            status: "healthy",
            residual: 0.01
          },
          ...constraintResiduals.slice(1)
        ]
      }),
      createEvidence({
        solverRecordCount: 4,
        orderedConstraintResiduals: [
          ...constraintResiduals,
          {
            id: "constraint_3",
            family: "parallel",
            status: "healthy",
            residual: 0
          }
        ]
      }),
      createEvidence({
        orderedDimensionResiduals: [
          {
            id: "dimension_1",
            family: "lineAngle",
            status: "healthy",
            residual: 0
          }
        ]
      }),
      createEvidence({
        orderedConstraintResiduals: [],
        orderedDimensionResiduals: [
          ...dimensionResiduals,
          ...constraintResiduals
        ]
      })
    ];

    for (const changed of changes) {
      expect(createSketchSolverEvaluationIdentity(changed)).not.toBe(baseline);
    }
  });

  it("changes for every canonical evaluated-entity geometry shape", () => {
    const baseline = createSketchSolverEvaluationIdentity(createEvidence());
    const entityChanges = [
      evaluatedEntities.map((entity) =>
        entity.kind === "point"
          ? { ...entity, point: [entity.point[0] + 1, entity.point[1]] }
          : entity
      ),
      evaluatedEntities.map((entity) =>
        entity.kind === "line"
          ? { ...entity, start: [entity.start[0] + 1, entity.start[1]] }
          : entity
      ),
      evaluatedEntities.map((entity) =>
        entity.kind === "line"
          ? { ...entity, end: [entity.end[0], entity.end[1] + 1] }
          : entity
      ),
      evaluatedEntities.map((entity) =>
        entity.kind === "rectangle"
          ? { ...entity, center: [entity.center[0] + 1, entity.center[1]] }
          : entity
      ),
      evaluatedEntities.map((entity) =>
        entity.kind === "rectangle"
          ? { ...entity, width: entity.width + 1 }
          : entity
      ),
      evaluatedEntities.map((entity) =>
        entity.kind === "rectangle"
          ? { ...entity, height: entity.height + 1 }
          : entity
      ),
      evaluatedEntities.map((entity) =>
        entity.kind === "circle"
          ? { ...entity, center: [entity.center[0], entity.center[1] + 1] }
          : entity
      ),
      evaluatedEntities.map((entity) =>
        entity.kind === "circle"
          ? { ...entity, radius: entity.radius + 1 }
          : entity
      ),
      evaluatedEntities.map((entity) =>
        entity.kind === "arc"
          ? { ...entity, center: [entity.center[0] + 1, entity.center[1]] }
          : entity
      ),
      evaluatedEntities.map((entity) =>
        entity.kind === "arc"
          ? { ...entity, radius: entity.radius + 1 }
          : entity
      ),
      evaluatedEntities.map((entity) =>
        entity.kind === "arc"
          ? {
              ...entity,
              startAngleDegrees: entity.startAngleDegrees + 1
            }
          : entity
      ),
      evaluatedEntities.map((entity) =>
        entity.kind === "arc"
          ? {
              ...entity,
              sweepAngleDegrees: entity.sweepAngleDegrees + 1
            }
          : entity
      )
    ] satisfies readonly (readonly SketchEntitySnapshot[])[];

    for (const changedEntities of entityChanges) {
      expect(
        createSketchSolverEvaluationIdentity(
          createEvidence({ evaluatedEntities: changedEntities })
        )
      ).not.toBe(baseline);
    }
  });

  it("rejects malformed evidence before hashing", () => {
    const malformed: readonly SketchSolverEvaluationIdentityEvidence[] = [
      createEvidence({
        sourceRevision: `partbench-source-v1:${"A".repeat(
          64
        )}` as SketchCurveEditSourceRevision
      }),
      createEvidence({ sketchId: "" }),
      createEvidence({
        solverStatus: "converged" as CadSketchSolverStatus
      }),
      createEvidence({ solverRecordCount: 2 }),
      createEvidence({
        evaluatedEntities: [evaluatedEntities[0]!, { ...evaluatedEntities[0]! }]
      }),
      createEvidence({
        evaluatedEntities: [
          {
            id: "circle_bad",
            kind: "circle",
            center: [0, 0],
            radius: 0,
            construction: false
          }
        ]
      }),
      createEvidence({
        evaluatedEntities: [
          {
            id: "arc_bad",
            kind: "arc",
            center: [0, 0],
            radius: 1,
            startAngleDegrees: 0,
            sweepAngleDegrees: 360,
            construction: false
          }
        ]
      }),
      createEvidence({
        evaluatedEntities: [
          {
            id: "point_bad",
            kind: "point",
            point: [Number.NaN, 0],
            construction: false
          }
        ]
      }),
      createEvidence({
        orderedConstraintResiduals: [
          ...constraintResiduals,
          { ...constraintResiduals[0]! }
        ]
      }),
      createEvidence({
        orderedConstraintResiduals: [
          {
            id: "constraint_bad",
            family: " equalLength",
            status: "healthy",
            residual: 0
          }
        ]
      }),
      createEvidence({
        orderedDimensionResiduals: [
          {
            id: "dimension_bad",
            family: "distance",
            status: "healthy",
            residual: Number.POSITIVE_INFINITY
          }
        ]
      }),
      createEvidence({
        orderedDimensionResiduals: [
          {
            id: "dimension_bad",
            family: "distance",
            status: "solved" as SketchDimensionStatus,
            residual: 0
          }
        ]
      })
    ];

    for (const evidence of malformed) {
      expect(() => createSketchSolverEvaluationIdentity(evidence)).toThrow(
        TypeError
      );
    }

    expect(() =>
      createSketchSolverEvaluationIdentity(
        createEvidence({
          evaluatedEntities: new Map([["wrong_key", evaluatedEntities[0]!]])
        })
      )
    ).toThrow(/Map key/);
    expect(() =>
      createSketchSolverEvaluationIdentity(
        createEvidence({
          orderedDimensionResiduals:
            {} as SketchSolverEvaluationIdentityEvidence["orderedDimensionResiduals"]
        })
      )
    ).toThrow(/array or Map/);
    expect(() => normalizeSketchSolverResidualFamily("not/normalized")).toThrow(
      /non-empty identifier/
    );
  });
});
