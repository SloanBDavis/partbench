import { describe, expect, it } from "vitest";

import type {
  FeatureSnapshotV22,
  SketchConstraintSnapshot,
  SketchDimensionSnapshotV22,
  SketchEntitySnapshot
} from "@web-cad/cad-protocol";

import {
  createSketchCurveEditImpact,
  finalizeSketchCurveEditImpactForApply,
  type MaterializedSketchCurveEditPlan,
  type SketchCurveEditImpactInput
} from "./sketchCurveEditImpact";
import {
  planSketchExplodeRectangle,
  planSketchExtend,
  planSketchSplit,
  type SketchCurveEditPlanResult
} from "./sketchCurveEditPlans";
import type { SketchSolverDocument, SketchSolverSketch } from "./sketchSolver";

const sketchId = "sketch_1";

function line(
  id: string,
  start: readonly [number, number],
  end: readonly [number, number],
  construction = false
): SketchEntitySnapshot {
  return { id, kind: "line", start, end, construction };
}

function materialized(
  result: SketchCurveEditPlanResult
): MaterializedSketchCurveEditPlan {
  expect(result.status).toBe("ready");
  if (result.status !== "ready" || !result.plan.materialized) {
    throw new Error("Expected a materialized curve-edit plan.");
  }
  return result.plan as MaterializedSketchCurveEditPlan;
}

function source({
  entities,
  constraints = [],
  dimensions = [],
  features = [],
  plan
}: {
  readonly entities: readonly SketchEntitySnapshot[];
  readonly constraints?: readonly SketchConstraintSnapshot[];
  readonly dimensions?: readonly SketchDimensionSnapshotV22[];
  readonly features?: readonly FeatureSnapshotV22[];
  readonly plan: MaterializedSketchCurveEditPlan;
}): SketchCurveEditImpactInput {
  const sketch: SketchSolverSketch = {
    id: sketchId,
    name: "Sketch",
    plane: "XY",
    entities: new Map(entities.map((entity) => [entity.id, entity]))
  };
  const document: SketchSolverDocument = {
    sketches: new Map([[sketchId, sketch]]),
    parameters: new Map(),
    sketchConstraints: new Map(
      constraints.map((constraint) => [constraint.id, constraint])
    ),
    sketchDimensions: new Map(
      dimensions.map((dimension) => [dimension.id, dimension])
    )
  };
  return {
    document,
    sketch,
    features,
    plan,
    operation: plan.operation
  };
}

function constraintBase(id: string) {
  return { id, name: id, sketchId } as const;
}

function dimension(
  id: string,
  target: SketchDimensionSnapshotV22["target"],
  value: number
): SketchDimensionSnapshotV22 {
  return {
    id,
    name: id,
    sketchId,
    target,
    valueSource: { type: "literal", value }
  };
}

describe("V19 curve-edit consequence engine", () => {
  it("retargets exact endpoint provenance, evaluates curve-wide residuals, and sorts every record", () => {
    const entities = [
      line("line_source", [0, 0], [10, 0]),
      line("line_other", [10, 0], [10, 5]),
      line("line_equal", [0, 2], [10, 2]),
      line("line_axis", [5, -5], [5, 5])
    ];
    const plan = materialized(
      planSketchSplit(entities, {
        entityId: "line_source",
        splitPoints: [[5, 0]],
        createdEntityIds: ["line_result"]
      })
    );
    const constraints: SketchConstraintSnapshot[] = [
      {
        ...constraintBase("z_unrelated"),
        entityId: "line_other",
        kind: "vertical"
      },
      {
        ...constraintBase("c_symmetry"),
        entityId: "line_source",
        kind: "symmetry",
        primaryTarget: { entityId: "line_source", role: "start" },
        secondaryTarget: { entityId: "line_other", role: "start" },
        symmetryLineEntityId: "line_axis"
      },
      {
        ...constraintBase("b_horizontal"),
        entityId: "line_source",
        kind: "horizontal"
      },
      {
        ...constraintBase("a_fixed_end"),
        entityId: "line_source",
        kind: "fixed",
        target: { entityId: "line_source", role: "end" },
        coordinate: [10, 0]
      },
      {
        ...constraintBase("e_equal_length"),
        entityId: "line_equal",
        kind: "equalLength",
        primaryLineEntityId: "line_source",
        secondaryLineEntityId: "line_equal"
      },
      {
        ...constraintBase("d_coincident"),
        entityId: "line_source",
        kind: "coincident",
        primaryTarget: { entityId: "line_source", role: "end" },
        secondaryTarget: { entityId: "line_other", role: "start" }
      },
      {
        ...constraintBase("f_same_target"),
        entityId: "line_source",
        kind: "coincident",
        primaryTarget: { entityId: "line_source", role: "end" },
        secondaryTarget: { entityId: "line_source", role: "end" }
      }
    ];
    const dimensions = [
      dimension(
        "dimension_length",
        {
          kind: "entityScalar",
          entityId: "line_source",
          entityKind: "line",
          role: "length"
        },
        10
      )
    ];

    const result = createSketchCurveEditImpact(
      source({ entities, constraints, dimensions, plan })
    );
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;

    expect(
      result.impact.constraintImpacts.map(({ id, disposition }) => [
        id,
        disposition
      ])
    ).toEqual([
      ["a_fixed_end", "retargeted"],
      ["b_horizontal", "preserved"],
      ["c_symmetry", "invalid"],
      ["d_coincident", "retargeted"],
      ["e_equal_length", "invalid"],
      ["f_same_target", "invalid"],
      ["z_unrelated", "unaffected"]
    ]);
    expect(result.impact.requiredDeleteConstraintIds).toEqual([
      "c_symmetry",
      "e_equal_length",
      "f_same_target"
    ]);
    expect(result.impact.requiredDeleteDimensionIds).toEqual([
      "dimension_length"
    ]);
    expect(
      result.impact.constraintImpacts.find(
        (entry) => entry.id === "a_fixed_end"
      )?.after
    ).toMatchObject({
      target: {
        entityId: "line_result",
        role: "end"
      }
    });
    expect(
      result.impact.constraintImpacts.find(
        (entry) => entry.id === "d_coincident"
      )?.after
    ).toMatchObject({
      primaryTarget: {
        entityId: "line_result",
        role: "end"
      }
    });
    expect(
      result.impact.constraintImpacts.find(
        (entry) => entry.id === "e_equal_length"
      )
    ).toMatchObject({
      disposition: "invalid",
      residualFamily: "equalLength",
      residual: 5
    });
    expect(result.impact.dimensionImpacts).toEqual([
      expect.objectContaining({
        id: "dimension_length",
        disposition: "invalid",
        residualFamily: "lineLength",
        residual: 5
      })
    ]);
    expect(
      result.impact.constraintImpacts.find((entry) => entry.id === "c_symmetry")
    ).not.toHaveProperty("residual");
    expect(
      result.impact.constraintImpacts.find(
        (entry) => entry.id === "z_unrelated"
      )
    ).not.toHaveProperty("residual");
    expect(
      result.impact.constraintImpacts.find(
        (entry) => entry.id === "z_unrelated"
      )
    ).not.toHaveProperty("after");
    expect([...result.entities.keys()]).toEqual([
      "line_other",
      "line_equal",
      "line_axis",
      "line_source",
      "line_result"
    ]);
    expect([...result.constraints.keys()].sort()).toEqual([
      "a_fixed_end",
      "b_horizontal",
      "d_coincident",
      "z_unrelated"
    ]);
    expect(result.dimensions.size).toBe(0);
    expect(result.residualEvaluation.iterations).toBe(0);
    expect(["fully-defined", "under-defined", "over-defined"]).toContain(
      result.impact.postEditSolverStatus
    );
  });

  it("keeps a modified feature reference, reports it affected, and invalidates a moved fixed endpoint without moving geometry", () => {
    const entities = [
      line("line_source", [0, 0], [10, 0]),
      line("boundary", [20, -5], [20, 5])
    ];
    const plan = materialized(
      planSketchExtend(entities, {
        entityId: "line_source",
        endpoint: "end",
        boundaryEntityIds: ["boundary"]
      })
    );
    const constraints: SketchConstraintSnapshot[] = [
      {
        ...constraintBase("fixed_start"),
        entityId: "line_source",
        kind: "fixed",
        target: { entityId: "line_source", role: "start" },
        coordinate: [0, 0]
      },
      {
        ...constraintBase("fixed_end"),
        entityId: "line_source",
        kind: "fixed",
        target: { entityId: "line_source", role: "end" },
        coordinate: [10, 0]
      }
    ];
    const features: FeatureSnapshotV22[] = [
      {
        id: "feature_profile",
        kind: "extrude",
        bodyId: "body_profile",
        profile: {
          kind: "entity",
          sketchId,
          entityId: "line_source"
        },
        depth: 2,
        side: "positive",
        operationMode: "newBody"
      }
    ];

    const result = createSketchCurveEditImpact(
      source({ entities, constraints, features, plan })
    );
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.impact.affectedFeatureIds).toEqual(["feature_profile"]);
    expect(result.impact.requiredDeleteConstraintIds).toEqual(["fixed_end"]);
    expect(result.impact.constraintImpacts).toEqual([
      expect.objectContaining({
        id: "fixed_end",
        disposition: "invalid",
        residualFamily: "fixedPoint",
        residual: 10
      }),
      expect.objectContaining({
        id: "fixed_start",
        disposition: "preserved",
        residualFamily: "fixedPoint",
        residual: 0
      })
    ]);
    expect(result.entities.get("line_source")).toMatchObject({
      start: [0, 0],
      end: [20, 0]
    });
    expect(result.entities.get("boundary")).toEqual(entities[1]);
    expect(result.residualEvaluation.iterations).toBe(0);
  });

  it("blocks every direct feature role when a kind-changing edit deletes its source ID", () => {
    const circle: SketchEntitySnapshot = {
      id: "circle_source",
      kind: "circle",
      center: [0, 0],
      radius: 5,
      construction: false
    };
    const plan = materialized(
      planSketchSplit([circle], {
        entityId: circle.id,
        splitPoints: [
          [5, 0],
          [-5, 0]
        ],
        createdEntityIds: ["arc_a", "arc_b"]
      })
    );
    const features: FeatureSnapshotV22[] = [
      {
        id: "a_region",
        kind: "extrude",
        bodyId: "body_region",
        profile: {
          kind: "regions",
          sketchId,
          regions: [
            {
              outer: { kind: "entity", entityId: circle.id },
              holes: []
            }
          ]
        },
        depth: 2,
        side: "positive",
        operationMode: "newBody"
      },
      {
        id: "b_sweep",
        kind: "sweep",
        bodyId: "body_sweep",
        profile: {
          kind: "entity",
          sketchId: "sketch_other",
          entityId: "profile"
        },
        path: {
          kind: "entity",
          sketchId,
          entityId: circle.id,
          orientation: "forward"
        }
      },
      {
        id: "c_revolve",
        kind: "revolve",
        bodyId: "body_revolve",
        profile: {
          kind: "entity",
          sketchId: "sketch_other",
          entityId: "profile"
        },
        axis: {
          type: "sketchLine",
          sketchId,
          entityId: circle.id
        },
        angleDegrees: 180,
        operationMode: "newBody"
      },
      {
        id: "d_hole",
        kind: "hole",
        bodyId: "body_hole",
        targetBodyId: "body_target",
        sketchId,
        circleEntityId: circle.id,
        depthMode: "throughAll",
        direction: "positive"
      }
    ];

    const result = createSketchCurveEditImpact(
      source({ entities: [circle], features, plan })
    );
    expect(result).toEqual({
      status: "blocked",
      code: "SKETCH_ENTITY_IN_USE",
      reason: "feature-dependency",
      sourceEntityId: "circle_source",
      affectedFeatureIds: ["a_region", "b_sweep", "c_revolve", "d_hole"],
      dependencies: [
        {
          featureId: "a_region",
          roles: ["profile"],
          referencedEntityIds: ["circle_source"]
        },
        {
          featureId: "b_sweep",
          roles: ["path"],
          referencedEntityIds: ["circle_source"]
        },
        {
          featureId: "c_revolve",
          roles: ["axis"],
          referencedEntityIds: ["circle_source"]
        },
        {
          featureId: "d_hole",
          roles: ["hole-center"],
          referencedEntityIds: ["circle_source"]
        }
      ]
    });
  });

  it("classifies circle-to-arc and rectangle-to-line target kind changes structurally before residual evaluation", () => {
    const circle: SketchEntitySnapshot = {
      id: "circle_source",
      kind: "circle",
      center: [0, 0],
      radius: 5,
      construction: false
    };
    const circlePlan = materialized(
      planSketchSplit([circle], {
        entityId: circle.id,
        splitPoints: [
          [5, 0],
          [-5, 0]
        ],
        createdEntityIds: ["arc_a", "arc_b"]
      })
    );
    const circleConstraints: SketchConstraintSnapshot[] = [
      {
        ...constraintBase("concentric"),
        entityId: "circle_other",
        kind: "concentric",
        primaryTarget: {
          entityId: circle.id,
          entityKind: "circle"
        },
        secondaryTarget: {
          entityId: "circle_other",
          entityKind: "circle"
        }
      },
      {
        ...constraintBase("fixed_center"),
        entityId: circle.id,
        kind: "fixed",
        target: { entityId: circle.id, role: "center" },
        coordinate: [0, 0]
      }
    ];
    const circleOther: SketchEntitySnapshot = {
      id: "circle_other",
      kind: "circle",
      center: [0, 0],
      radius: 5,
      construction: false
    };
    const circleResult = createSketchCurveEditImpact(
      source({
        entities: [circle, circleOther],
        constraints: circleConstraints,
        dimensions: [
          dimension(
            "radius",
            {
              kind: "entityScalar",
              entityId: circle.id,
              entityKind: "circle",
              role: "radius"
            },
            5
          )
        ],
        plan: circlePlan
      })
    );
    expect(circleResult.status).toBe("ready");
    if (circleResult.status === "ready") {
      expect(circleResult.impact.requiredDeleteConstraintIds).toEqual([
        "concentric",
        "fixed_center"
      ]);
      expect(circleResult.impact.requiredDeleteDimensionIds).toEqual([
        "radius"
      ]);
      expect(
        circleResult.impact.constraintImpacts.every(
          (entry) =>
            entry.disposition === "invalid" &&
            entry.residualFamily === undefined
        )
      ).toBe(true);
    }

    const rectangle: SketchEntitySnapshot = {
      id: "rectangle_source",
      kind: "rectangle",
      center: [0, 0],
      width: 10,
      height: 6,
      construction: false
    };
    const rectanglePlan = materialized(
      planSketchExplodeRectangle([rectangle], {
        entityId: rectangle.id,
        lineEntityIds: ["v_min", "u_max", "v_max", "u_min"]
      })
    );
    const rectangleResult = createSketchCurveEditImpact(
      source({
        entities: [rectangle],
        constraints: [
          {
            ...constraintBase("fixed_rectangle"),
            entityId: rectangle.id,
            kind: "fixed",
            target: { entityId: rectangle.id, role: "center" },
            coordinate: [0, 0]
          }
        ],
        plan: rectanglePlan
      })
    );
    expect(rectangleResult.status).toBe("ready");
    if (rectangleResult.status === "ready") {
      expect(rectangleResult.impact.constraintImpacts).toEqual([
        expect.objectContaining({
          id: "fixed_rectangle",
          disposition: "invalid"
        })
      ]);
      expect(rectangleResult.impact.constraintImpacts[0]).not.toHaveProperty(
        "residual"
      );
      expect([...rectangleResult.entities.keys()]).toEqual([
        "v_min",
        "u_max",
        "v_max",
        "u_min"
      ]);
    }
  });

  it("accepts normalized dimension families when every persisted record maps to one exact zero-solve residual", () => {
    const entities = [
      line("line_source", [0, 0], [10, 0]),
      line("boundary", [20, -5], [20, 5]),
      {
        id: "point_a",
        kind: "point",
        point: [0, 0],
        construction: false
      } satisfies SketchEntitySnapshot,
      {
        id: "point_b",
        kind: "point",
        point: [1, 0],
        construction: false
      } satisfies SketchEntitySnapshot
    ];
    const plan = materialized(
      planSketchExtend(entities, {
        entityId: "line_source",
        endpoint: "end",
        boundaryEntityIds: ["boundary"]
      })
    );
    const result = createSketchCurveEditImpact(
      source({
        entities,
        dimensions: [
          dimension(
            "normalized_distance",
            {
              kind: "pointPair",
              primary: {
                entityId: "point_a",
                entityKind: "point",
                role: "position"
              },
              secondary: {
                entityId: "point_b",
                entityKind: "point",
                role: "position"
              },
              measurement: "distance"
            },
            1
          )
        ],
        plan
      })
    );
    expect(result).toMatchObject({ status: "ready" });
  });

  it("requires exact deletion sets and turns only requested invalid rows into deleted-by-request evidence", () => {
    const entities = [
      line("line_source", [0, 0], [10, 0]),
      line("boundary", [20, -5], [20, 5])
    ];
    const plan = materialized(
      planSketchExtend(entities, {
        entityId: "line_source",
        endpoint: "end",
        boundaryEntityIds: ["boundary"]
      })
    );
    const result = createSketchCurveEditImpact(
      source({
        entities,
        constraints: [
          {
            ...constraintBase("fixed_end"),
            entityId: "line_source",
            kind: "fixed",
            target: { entityId: "line_source", role: "end" },
            coordinate: [10, 0]
          }
        ],
        dimensions: [
          dimension(
            "length",
            {
              kind: "entityScalar",
              entityId: "line_source",
              entityKind: "line",
              role: "length"
            },
            10
          )
        ],
        plan
      })
    );
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;

    expect(
      finalizeSketchCurveEditImpactForApply(
        result.impact,
        ["fixed_end"],
        ["length"]
      )
    ).toMatchObject({
      status: "ready",
      impact: {
        constraintImpacts: [
          { id: "fixed_end", disposition: "deleted-by-request" }
        ],
        dimensionImpacts: [{ id: "length", disposition: "deleted-by-request" }]
      }
    });
    expect(
      finalizeSketchCurveEditImpactForApply(
        result.impact,
        ["fixed_end", "fixed_end"],
        ["length", "extra"]
      )
    ).toMatchObject({
      status: "blocked",
      code: "SKETCH_EDIT_DELETE_LIST_MISMATCH",
      expectedConstraintIds: ["fixed_end"],
      receivedConstraintIds: ["fixed_end"],
      expectedDimensionIds: ["length"],
      receivedDimensionIds: ["extra", "length"]
    });
  });

  it("rejects mismatched materialized operation and piece evidence deterministically", () => {
    const entities = [
      line("line_source", [0, 0], [10, 0]),
      line("boundary", [20, -5], [20, 5])
    ];
    const plan = materialized(
      planSketchExtend(entities, {
        entityId: "line_source",
        endpoint: "end",
        boundaryEntityIds: ["boundary"]
      })
    );
    expect(
      createSketchCurveEditImpact({
        ...source({ entities, plan }),
        operation: "split"
      })
    ).toMatchObject({
      status: "blocked",
      code: "SKETCH_EDIT_GEOMETRY_INVALID",
      reason: "invalid-materialized-plan"
    });
  });
});
