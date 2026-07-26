import type {
  SketchAddRoundedRectangleOp,
  SketchAddSlotOp,
  SketchConstraintCreateOp,
  SketchEntitySnapshot,
  Vec2
} from "@web-cad/cad-protocol";
import { describe, expect, it } from "vitest";

import {
  ROUNDED_RECTANGLE_CONSTRAINT_ROLES,
  ROUNDED_RECTANGLE_ENTITY_ROLES,
  SLOT_CONSTRAINT_ROLES,
  SLOT_ENTITY_ROLES,
  planSketchRoundedRectangle,
  planSketchSlot,
  type SketchConveniencePlanResult,
  type SketchRoundedRectanglePlan,
  type SketchSlotPlan
} from "./sketchConveniencePlans";
import { SKETCH_GEOMETRY_POLICY } from "./sketchGeometryPolicy";

const slotEntityIds = ["slot-e0", "slot-e1", "slot-e2", "slot-e3"] as const;
const slotConstraintIds = [
  "slot-c0",
  "slot-c1",
  "slot-c2",
  "slot-c3",
  "slot-c4",
  "slot-c5",
  "slot-c6",
  "slot-c7",
  "slot-c8"
] as const;
const roundedEntityIds = [
  "rounded-e0",
  "rounded-e1",
  "rounded-e2",
  "rounded-e3",
  "rounded-e4",
  "rounded-e5",
  "rounded-e6",
  "rounded-e7"
] as const;
const roundedConstraintIds = [
  "rounded-c0",
  "rounded-c1",
  "rounded-c2",
  "rounded-c3",
  "rounded-c4",
  "rounded-c5",
  "rounded-c6",
  "rounded-c7",
  "rounded-c8",
  "rounded-c9",
  "rounded-c10",
  "rounded-c11",
  "rounded-c12",
  "rounded-c13",
  "rounded-c14",
  "rounded-c15",
  "rounded-c16",
  "rounded-c17",
  "rounded-c18",
  "rounded-c19",
  "rounded-c20",
  "rounded-c21",
  "rounded-c22"
] as const;

function ready<Plan extends SketchSlotPlan | SketchRoundedRectanglePlan>(
  result: SketchConveniencePlanResult<Plan>
): Plan {
  expect(result.status).toBe("ready");
  if (result.status !== "ready") {
    throw new Error(result.diagnostics[0]?.code);
  }
  return result.plan;
}

function blocked(
  result: SketchConveniencePlanResult<
    SketchSlotPlan | SketchRoundedRectanglePlan
  >
) {
  expect(result.status).toBe("blocked");
  if (result.status !== "blocked") throw new Error("Expected blocked plan.");
  return result.diagnostics[0]!;
}

function entityEndpoint(
  entity: SketchEntitySnapshot,
  endpoint: "start" | "end"
): Vec2 {
  if (entity.kind === "line") return entity[endpoint];
  if (entity.kind !== "arc") {
    throw new Error(`Unexpected entity kind: ${entity.kind}`);
  }
  const angle =
    entity.startAngleDegrees +
    (endpoint === "end" ? entity.sweepAngleDegrees : 0);
  const radians = (angle * Math.PI) / 180;
  return [
    entity.center[0] + entity.radius * Math.cos(radians),
    entity.center[1] + entity.radius * Math.sin(radians)
  ];
}

function expectPointClose(actual: Vec2, expected: Vec2): void {
  expect(actual[0]).toBeCloseTo(expected[0], 12);
  expect(actual[1]).toBeCloseTo(expected[1], 12);
}

function constraintPairKey(op: SketchConstraintCreateOp): string {
  if (op.kind === "coincident" || op.kind === "tangent") {
    return `${op.kind}:${op.primaryTarget.entityId}:${"role" in op.primaryTarget ? op.primaryTarget.role : "curve"}:${op.secondaryTarget.entityId}:${"role" in op.secondaryTarget ? op.secondaryTarget.role : "curve"}`;
  }
  if (op.kind === "equalRadius") {
    const primary =
      op.primaryTarget?.entityId ?? op.primaryCircleEntityId ?? "missing";
    const secondary =
      op.secondaryTarget?.entityId ?? op.secondaryCircleEntityId ?? "missing";
    return `${op.kind}:${primary}:${secondary}`;
  }
  if (op.kind === "horizontal" || op.kind === "vertical") {
    return `${op.kind}:${op.entityId}`;
  }
  return `${op.kind}:${op.id ?? "missing"}`;
}

function slotOp(overrides: Partial<SketchAddSlotOp> = {}): SketchAddSlotOp {
  return {
    op: "sketch.addSlot",
    sketchId: "sketch-1",
    centerlineStart: [0, 0],
    centerlineEnd: [6, 0],
    radius: 2,
    entityIds: slotEntityIds,
    constraintIds: slotConstraintIds,
    ...overrides
  };
}

function roundedOp(
  overrides: Partial<SketchAddRoundedRectangleOp> = {}
): SketchAddRoundedRectangleOp {
  return {
    op: "sketch.addRoundedRectangle",
    sketchId: "sketch-1",
    center: [1, -2],
    width: 10,
    height: 6,
    cornerRadius: 1,
    entityIds: roundedEntityIds,
    constraintIds: roundedConstraintIds,
    ...overrides
  };
}

describe("Decision 8 pure slot planning", () => {
  it("creates the exact stable clockwise entity tuple and propagates construction", () => {
    const plan = ready(planSketchSlot(slotOp({ construction: true })));

    expect(plan.operation).toBe("slot");
    expect(plan.entityRoles).toEqual(SLOT_ENTITY_ROLES);
    expect(plan.constraintRoles).toEqual(SLOT_CONSTRAINT_ROLES);
    expect(plan.requiredEntityIdCount).toBe(4);
    expect(plan.requiredConstraintIdCount).toBe(9);
    expect(plan.materialized?.entities).toEqual([
      {
        id: "slot-e0",
        kind: "line",
        start: [0, 2],
        end: [6, 2],
        construction: true
      },
      {
        id: "slot-e1",
        kind: "arc",
        center: [6, 0],
        radius: 2,
        startAngleDegrees: 90,
        sweepAngleDegrees: -180,
        construction: true
      },
      {
        id: "slot-e2",
        kind: "line",
        start: [6, -2],
        end: [0, -2],
        construction: true
      },
      {
        id: "slot-e3",
        kind: "arc",
        center: [0, 0],
        radius: 2,
        startAngleDegrees: 270,
        sweepAngleDegrees: -180,
        construction: true
      }
    ]);

    const entities = plan.materialized!.entities;
    for (const [index, entity] of entities.entries()) {
      const next = entities[(index + 1) % entities.length]!;
      expectPointClose(
        entityEndpoint(entity, "end"),
        entityEndpoint(next, "start")
      );
    }
    expect(
      entities.every(
        (entity) => entity.kind === "line" || entity.kind === "arc"
      )
    ).toBe(true);
  });

  it("uses the normalized centerline left normal for diagonal and reversed directions", () => {
    const diagonal = ready(
      planSketchSlot(
        slotOp({
          centerlineStart: [-2, 1],
          centerlineEnd: [1, 5],
          radius: 2
        })
      )
    );
    expect(diagonal.entityDrafts[0]?.shape).toEqual({
      kind: "line",
      start: [-3.6, 2.2],
      end: [-0.6000000000000001, 6.2],
      construction: false
    });
    expect(diagonal.entityDrafts[2]?.shape).toEqual({
      kind: "line",
      start: [2.6, 3.8],
      end: [-0.3999999999999999, -0.19999999999999996],
      construction: false
    });
    expect(
      diagonal.entityDrafts[1]?.shape.kind === "arc"
        ? diagonal.entityDrafts[1].shape.startAngleDegrees
        : undefined
    ).toBeCloseTo(143.130102354156, 12);
    expect(
      diagonal.entityDrafts[3]?.shape.kind === "arc"
        ? diagonal.entityDrafts[3].shape.startAngleDegrees
        : undefined
    ).toBeCloseTo(323.130102354156, 12);

    const reversed = ready(
      planSketchSlot(
        slotOp({
          centerlineStart: [5, 0],
          centerlineEnd: [0, 0],
          radius: 1
        })
      )
    );
    expect(reversed.entityDrafts[0]?.shape).toMatchObject({
      kind: "line",
      start: [5, -1],
      end: [0, -1]
    });
    expect(reversed.entityDrafts[1]?.shape).toMatchObject({
      kind: "arc",
      startAngleDegrees: 270,
      sweepAngleDegrees: -180
    });
    for (const draft of reversed.entityDrafts) {
      if (draft.shape.kind === "arc") {
        expect(Object.is(draft.shape.startAngleDegrees, -0)).toBe(false);
      }
    }
  });

  it("materializes exactly four joins, four traversal-ordered tangencies, and one cap-radius equality", () => {
    const constraints = ready(planSketchSlot(slotOp())).materialized!
      .constraintOps;

    expect(constraints.map((constraint) => constraint.id)).toEqual(
      slotConstraintIds
    );
    expect(constraints.map((constraint) => constraint.kind)).toEqual([
      "coincident",
      "coincident",
      "coincident",
      "coincident",
      "tangent",
      "tangent",
      "tangent",
      "tangent",
      "equalRadius"
    ]);
    expect(constraints.slice(0, 4)).toMatchObject([
      {
        primaryTarget: {
          entityId: "slot-e0",
          entityKind: "line",
          role: "end"
        },
        secondaryTarget: {
          entityId: "slot-e1",
          entityKind: "arc",
          role: "start"
        }
      },
      {
        primaryTarget: {
          entityId: "slot-e1",
          entityKind: "arc",
          role: "end"
        },
        secondaryTarget: {
          entityId: "slot-e2",
          entityKind: "line",
          role: "start"
        }
      },
      {
        primaryTarget: {
          entityId: "slot-e2",
          entityKind: "line",
          role: "end"
        },
        secondaryTarget: {
          entityId: "slot-e3",
          entityKind: "arc",
          role: "start"
        }
      },
      {
        primaryTarget: {
          entityId: "slot-e3",
          entityKind: "arc",
          role: "end"
        },
        secondaryTarget: {
          entityId: "slot-e0",
          entityKind: "line",
          role: "start"
        }
      }
    ]);
    expect(constraints.slice(4, 8)).toMatchObject([
      {
        primaryTarget: { entityId: "slot-e0", entityKind: "line" },
        secondaryTarget: { entityId: "slot-e1", entityKind: "arc" }
      },
      {
        primaryTarget: { entityId: "slot-e1", entityKind: "arc" },
        secondaryTarget: { entityId: "slot-e2", entityKind: "line" }
      },
      {
        primaryTarget: { entityId: "slot-e2", entityKind: "line" },
        secondaryTarget: { entityId: "slot-e3", entityKind: "arc" }
      },
      {
        primaryTarget: { entityId: "slot-e3", entityKind: "arc" },
        secondaryTarget: { entityId: "slot-e0", entityKind: "line" }
      }
    ]);
    expect(constraints[8]).toMatchObject({
      primaryTarget: { entityId: "slot-e1", entityKind: "arc" },
      secondaryTarget: { entityId: "slot-e3", entityKind: "arc" }
    });
    expect(
      constraints.some(
        (constraint) =>
          constraint.kind === "parallel" ||
          constraint.kind === "perpendicular" ||
          constraint.kind === "horizontal" ||
          constraint.kind === "vertical"
      )
    ).toBe(false);
    expect(new Set(constraints.map(constraintPairKey)).size).toBe(9);
  });

  it.each([
    [
      "non-finite start",
      { centerlineStart: [Number.NaN, 0] as Vec2 },
      "centerlineStart"
    ],
    [
      "non-finite end",
      { centerlineEnd: [Number.POSITIVE_INFINITY, 0] as Vec2 },
      "centerlineEnd"
    ],
    [
      "centerline at tolerance",
      {
        centerlineStart: [0, 0] as Vec2,
        centerlineEnd: [SKETCH_GEOMETRY_POLICY.linearTolerance, 0] as Vec2
      },
      "centerlineEnd"
    ],
    [
      "radius at tolerance",
      { radius: SKETCH_GEOMETRY_POLICY.linearTolerance },
      "radius"
    ],
    ["non-finite radius", { radius: Number.NaN }, "radius"]
  ])("rejects %s", (_label, overrides, path) => {
    const diagnostic = blocked(
      planSketchSlot(slotOp(overrides as Partial<SketchAddSlotOp>))
    );
    expect(diagnostic).toMatchObject({
      code: "SKETCH_CONVENIENCE_GEOMETRY_INVALID",
      path
    });
  });

  it("rejects derived overflow and an injected arc policy that excludes a semicircle", () => {
    expect(
      blocked(
        planSketchSlot(
          slotOp({
            centerlineStart: [Number.MAX_VALUE * 0.5, 0],
            centerlineEnd: [Number.MAX_VALUE * 0.5, Number.MAX_VALUE * 0.25],
            radius: Number.MAX_VALUE
          })
        )
      )
    ).toMatchObject({
      code: "SKETCH_CONVENIENCE_GEOMETRY_INVALID",
      path: "radius"
    });
    expect(
      blocked(
        planSketchSlot(slotOp(), {
          policy: {
            ...SKETCH_GEOMETRY_POLICY,
            angularToleranceDegrees: 181
          }
        })
      )
    ).toMatchObject({
      code: "SKETCH_CONVENIENCE_GEOMETRY_INVALID",
      path: "radius"
    });
  });

  it("rejects finite offset cancellation that collapses both authored side lines", () => {
    expect(
      blocked(
        planSketchSlot(
          slotOp({
            centerlineStart: [0, 0],
            centerlineEnd: [1, 1],
            radius: 1e30
          })
        )
      )
    ).toMatchObject({
      code: "SKETCH_CONVENIENCE_GEOMETRY_INVALID",
      path: "centerlineEnd",
      expected: `>${SKETCH_GEOMETRY_POLICY.linearTolerance}`,
      received: "0"
    });
  });

  it("rejects a finite large-scale slot whose canonical arc endpoints miss an authored join tolerance", () => {
    expect(
      blocked(
        planSketchSlot(
          slotOp({
            centerlineStart: [0, 0],
            centerlineEnd: [4e9, 0],
            radius: 1e9
          })
        )
      )
    ).toMatchObject({
      code: "SKETCH_CONVENIENCE_GEOMETRY_INVALID",
      path: "radius",
      expected: `<=${SKETCH_GEOMETRY_POLICY.linearTolerance}`
    });
  });
});

describe("Decision 8 pure rounded-rectangle planning", () => {
  it("creates the exact stable clockwise top-first tuple with canonical -90 degree arcs", () => {
    const plan = ready(
      planSketchRoundedRectangle(roundedOp({ construction: true }))
    );

    expect(plan.operation).toBe("roundedRectangle");
    expect(plan.entityRoles).toEqual(ROUNDED_RECTANGLE_ENTITY_ROLES);
    expect(plan.constraintRoles).toEqual(ROUNDED_RECTANGLE_CONSTRAINT_ROLES);
    expect(plan.requiredEntityIdCount).toBe(8);
    expect(plan.requiredConstraintIdCount).toBe(23);
    expect(plan.materialized?.entities).toEqual([
      {
        id: "rounded-e0",
        kind: "line",
        start: [-3, 1],
        end: [5, 1],
        construction: true
      },
      {
        id: "rounded-e1",
        kind: "arc",
        center: [5, 0],
        radius: 1,
        startAngleDegrees: 90,
        sweepAngleDegrees: -90,
        construction: true
      },
      {
        id: "rounded-e2",
        kind: "line",
        start: [6, 0],
        end: [6, -4],
        construction: true
      },
      {
        id: "rounded-e3",
        kind: "arc",
        center: [5, -4],
        radius: 1,
        startAngleDegrees: 0,
        sweepAngleDegrees: -90,
        construction: true
      },
      {
        id: "rounded-e4",
        kind: "line",
        start: [5, -5],
        end: [-3, -5],
        construction: true
      },
      {
        id: "rounded-e5",
        kind: "arc",
        center: [-3, -4],
        radius: 1,
        startAngleDegrees: 270,
        sweepAngleDegrees: -90,
        construction: true
      },
      {
        id: "rounded-e6",
        kind: "line",
        start: [-4, -4],
        end: [-4, 0],
        construction: true
      },
      {
        id: "rounded-e7",
        kind: "arc",
        center: [-3, 0],
        radius: 1,
        startAngleDegrees: 180,
        sweepAngleDegrees: -90,
        construction: true
      }
    ]);
    const entities = plan.materialized!.entities;
    for (const [index, entity] of entities.entries()) {
      const next = entities[(index + 1) % entities.length]!;
      expectPointClose(
        entityEndpoint(entity, "end"),
        entityEndpoint(next, "start")
      );
    }
  });

  it("materializes the exact 8+8+3+2+2 minimal constraint graph in normative order", () => {
    const constraints = ready(planSketchRoundedRectangle(roundedOp()))
      .materialized!.constraintOps;

    expect(constraints.map((constraint) => constraint.id)).toEqual(
      roundedConstraintIds
    );
    expect(constraints.map((constraint) => constraint.kind)).toEqual([
      ...Array<string>(8).fill("coincident"),
      ...Array<string>(8).fill("tangent"),
      "equalRadius",
      "equalRadius",
      "equalRadius",
      "horizontal",
      "horizontal",
      "vertical",
      "vertical"
    ]);
    expect(constraints.slice(0, 8)).toMatchObject([
      {
        primaryTarget: { entityId: "rounded-e0", role: "end" },
        secondaryTarget: { entityId: "rounded-e1", role: "start" }
      },
      {
        primaryTarget: { entityId: "rounded-e1", role: "end" },
        secondaryTarget: { entityId: "rounded-e2", role: "start" }
      },
      {
        primaryTarget: { entityId: "rounded-e2", role: "end" },
        secondaryTarget: { entityId: "rounded-e3", role: "start" }
      },
      {
        primaryTarget: { entityId: "rounded-e3", role: "end" },
        secondaryTarget: { entityId: "rounded-e4", role: "start" }
      },
      {
        primaryTarget: { entityId: "rounded-e4", role: "end" },
        secondaryTarget: { entityId: "rounded-e5", role: "start" }
      },
      {
        primaryTarget: { entityId: "rounded-e5", role: "end" },
        secondaryTarget: { entityId: "rounded-e6", role: "start" }
      },
      {
        primaryTarget: { entityId: "rounded-e6", role: "end" },
        secondaryTarget: { entityId: "rounded-e7", role: "start" }
      },
      {
        primaryTarget: { entityId: "rounded-e7", role: "end" },
        secondaryTarget: { entityId: "rounded-e0", role: "start" }
      }
    ]);
    expect(constraints.slice(8, 16)).toMatchObject([
      {
        primaryTarget: { entityId: "rounded-e0", entityKind: "line" },
        secondaryTarget: { entityId: "rounded-e1", entityKind: "arc" }
      },
      {
        primaryTarget: { entityId: "rounded-e1", entityKind: "arc" },
        secondaryTarget: { entityId: "rounded-e2", entityKind: "line" }
      },
      {
        primaryTarget: { entityId: "rounded-e2", entityKind: "line" },
        secondaryTarget: { entityId: "rounded-e3", entityKind: "arc" }
      },
      {
        primaryTarget: { entityId: "rounded-e3", entityKind: "arc" },
        secondaryTarget: { entityId: "rounded-e4", entityKind: "line" }
      },
      {
        primaryTarget: { entityId: "rounded-e4", entityKind: "line" },
        secondaryTarget: { entityId: "rounded-e5", entityKind: "arc" }
      },
      {
        primaryTarget: { entityId: "rounded-e5", entityKind: "arc" },
        secondaryTarget: { entityId: "rounded-e6", entityKind: "line" }
      },
      {
        primaryTarget: { entityId: "rounded-e6", entityKind: "line" },
        secondaryTarget: { entityId: "rounded-e7", entityKind: "arc" }
      },
      {
        primaryTarget: { entityId: "rounded-e7", entityKind: "arc" },
        secondaryTarget: { entityId: "rounded-e0", entityKind: "line" }
      }
    ]);
    expect(constraints.slice(16, 19)).toMatchObject([
      {
        primaryTarget: { entityId: "rounded-e1", entityKind: "arc" },
        secondaryTarget: { entityId: "rounded-e3", entityKind: "arc" }
      },
      {
        primaryTarget: { entityId: "rounded-e1", entityKind: "arc" },
        secondaryTarget: { entityId: "rounded-e5", entityKind: "arc" }
      },
      {
        primaryTarget: { entityId: "rounded-e1", entityKind: "arc" },
        secondaryTarget: { entityId: "rounded-e7", entityKind: "arc" }
      }
    ]);
    expect(constraints.slice(19)).toMatchObject([
      { kind: "horizontal", entityId: "rounded-e0" },
      { kind: "horizontal", entityId: "rounded-e4" },
      { kind: "vertical", entityId: "rounded-e6" },
      { kind: "vertical", entityId: "rounded-e2" }
    ]);
    expect(
      constraints.some(
        (constraint) =>
          constraint.kind === "parallel" || constraint.kind === "perpendicular"
      )
    ).toBe(false);
    expect(new Set(constraints.map(constraintPairKey)).size).toBe(23);
  });

  it.each([
    ["non-finite center", { center: [0, Number.NaN] as Vec2 }, "center"],
    ["width at tolerance", { width: 1 }, "width"],
    ["height at tolerance", { height: 1 }, "height"],
    ["radius at tolerance", { cornerRadius: 1 }, "cornerRadius"],
    ["non-finite radius", { cornerRadius: Number.NaN }, "cornerRadius"]
  ])("rejects %s", (_label, overrides, path) => {
    const diagnostic = blocked(
      planSketchRoundedRectangle(
        roundedOp(overrides as Partial<SketchAddRoundedRectangleOp>),
        {
          policy: {
            ...SKETCH_GEOMETRY_POLICY,
            linearTolerance: 1
          }
        }
      )
    );
    expect(diagnostic).toMatchObject({
      code: "SKETCH_CONVENIENCE_GEOMETRY_INVALID",
      path
    });
  });

  it("rejects horizontal/vertical collapse, derived overflow, and an excluded quarter-arc domain", () => {
    const policy = { ...SKETCH_GEOMETRY_POLICY, linearTolerance: 1 };
    expect(
      blocked(
        planSketchRoundedRectangle(
          roundedOp({ width: 3, height: 10, cornerRadius: 1 }),
          { policy }
        )
      )
    ).toMatchObject({ path: "cornerRadius" });
    expect(
      blocked(
        planSketchRoundedRectangle(
          roundedOp({ width: 10, height: 3, cornerRadius: 1 }),
          { policy }
        )
      )
    ).toMatchObject({ path: "cornerRadius" });
    expect(
      blocked(
        planSketchRoundedRectangle(
          roundedOp({
            center: [Number.MAX_VALUE, 0],
            width: Number.MAX_VALUE,
            height: 10,
            cornerRadius: 1
          })
        )
      )
    ).toMatchObject({ path: "center" });
    expect(
      blocked(
        planSketchRoundedRectangle(roundedOp(), {
          policy: {
            ...SKETCH_GEOMETRY_POLICY,
            angularToleranceDegrees: 100
          }
        })
      )
    ).toMatchObject({ path: "cornerRadius" });
  });

  it("rejects a finite large-scale rounded rectangle whose canonical arc endpoint misses a line join tolerance", () => {
    expect(
      blocked(
        planSketchRoundedRectangle(
          roundedOp({
            center: [0, 0],
            width: 4e9,
            height: 4e9,
            cornerRadius: 1e9
          })
        )
      )
    ).toMatchObject({
      code: "SKETCH_CONVENIENCE_GEOMETRY_INVALID",
      path: "cornerRadius",
      expected: `<=${SKETCH_GEOMETRY_POLICY.linearTolerance}`
    });
  });
});

describe("Decision 8 convenience ID and purity policy", () => {
  it("keeps plans unmaterialized until both exact ID tuples are supplied", () => {
    const noIds = ready(
      planSketchSlot({
        op: "sketch.addSlot",
        sketchId: "sketch-1",
        centerlineStart: [0, 0],
        centerlineEnd: [6, 0],
        radius: 2
      })
    );
    const entitiesOnly = ready(
      planSketchSlot(slotOp({ constraintIds: undefined }))
    );
    const constraintsOnly = ready(
      planSketchSlot(slotOp({ entityIds: undefined }))
    );

    expect(noIds.materialized).toBeUndefined();
    expect(entitiesOnly.materialized).toBeUndefined();
    expect(constraintsOnly.materialized).toBeUndefined();
    expect(noIds.entityDrafts).toHaveLength(4);
    expect(noIds.requiredConstraintIdCount).toBe(9);
  });

  it.each([
    [
      "slot entity cardinality",
      () =>
        planSketchSlot(
          slotOp({
            entityIds: ["a", "b"] as unknown as NonNullable<
              SketchAddSlotOp["entityIds"]
            >
          })
        ),
      "SKETCH_CONVENIENCE_ENTITY_ID_COUNT_MISMATCH",
      "entityIds"
    ],
    [
      "slot constraint cardinality",
      () =>
        planSketchSlot(
          slotOp({
            constraintIds: ["a"] as unknown as NonNullable<
              SketchAddSlotOp["constraintIds"]
            >
          })
        ),
      "SKETCH_CONVENIENCE_CONSTRAINT_ID_COUNT_MISMATCH",
      "constraintIds"
    ],
    [
      "rounded entity cardinality",
      () =>
        planSketchRoundedRectangle(
          roundedOp({
            entityIds: ["a"] as unknown as NonNullable<
              SketchAddRoundedRectangleOp["entityIds"]
            >
          })
        ),
      "SKETCH_CONVENIENCE_ENTITY_ID_COUNT_MISMATCH",
      "entityIds"
    ],
    [
      "rounded constraint cardinality",
      () =>
        planSketchRoundedRectangle(
          roundedOp({
            constraintIds: ["a"] as unknown as NonNullable<
              SketchAddRoundedRectangleOp["constraintIds"]
            >
          })
        ),
      "SKETCH_CONVENIENCE_CONSTRAINT_ID_COUNT_MISMATCH",
      "constraintIds"
    ]
  ])("rejects %s", (_label, run, code, path) => {
    expect(blocked(run())).toMatchObject({ code, path });
  });

  it("rejects duplicate, empty, and occupied IDs in their independent namespaces", () => {
    expect(
      blocked(
        planSketchSlot(
          slotOp({
            entityIds: ["slot-e0", "slot-e0", "slot-e2", "slot-e3"]
          })
        )
      )
    ).toMatchObject({
      code: "SKETCH_CONVENIENCE_ENTITY_ID_CONFLICT",
      path: "entityIds[1]"
    });
    expect(
      blocked(
        planSketchSlot(
          slotOp({
            constraintIds: [
              "slot-c0",
              "slot-c1",
              "slot-c2",
              "slot-c3",
              "",
              "slot-c5",
              "slot-c6",
              "slot-c7",
              "slot-c8"
            ]
          })
        )
      )
    ).toMatchObject({
      code: "SKETCH_CONVENIENCE_CONSTRAINT_ID_CONFLICT",
      path: "constraintIds[4]"
    });
    expect(
      blocked(
        planSketchRoundedRectangle(roundedOp(), {
          occupiedEntityIds: new Set(["rounded-e6"])
        })
      )
    ).toMatchObject({
      code: "SKETCH_CONVENIENCE_ENTITY_ID_CONFLICT",
      path: "entityIds[6]"
    });
    expect(
      blocked(
        planSketchRoundedRectangle(roundedOp(), {
          occupiedConstraintIds: new Set(["rounded-c22"])
        })
      )
    ).toMatchObject({
      code: "SKETCH_CONVENIENCE_CONSTRAINT_ID_CONFLICT",
      path: "constraintIds[22]"
    });
  });

  it("is deterministic, preserves input objects, and emits no composite source identity", () => {
    const op = Object.freeze({
      ...roundedOp(),
      entityIds: Object.freeze([...roundedEntityIds]),
      constraintIds: Object.freeze([...roundedConstraintIds])
    }) as SketchAddRoundedRectangleOp;
    const before = JSON.stringify(op);
    const first = planSketchRoundedRectangle(op);
    const second = planSketchRoundedRectangle(op);

    expect(first).toEqual(second);
    expect(JSON.stringify(op)).toBe(before);
    const plan = ready(first);
    expect(plan.materialized?.entities.map((entity) => entity.kind)).toEqual([
      "line",
      "arc",
      "line",
      "arc",
      "line",
      "arc",
      "line",
      "arc"
    ]);
    expect(
      plan.materialized?.constraintOps.every(
        (constraint) => constraint.op === "sketch.constraint.create"
      )
    ).toBe(true);
    expect(Object.keys(plan.materialized ?? {}).sort()).toEqual([
      "constraintOps",
      "entities"
    ]);
  });

  it("defaults construction to false and rejects a non-boolean runtime value", () => {
    const slot = ready(planSketchSlot(slotOp({ construction: undefined })));
    const rounded = ready(
      planSketchRoundedRectangle(roundedOp({ construction: undefined }))
    );
    expect(
      slot.materialized?.entities.every((entity) => !entity.construction)
    ).toBe(true);
    expect(
      rounded.materialized?.entities.every((entity) => !entity.construction)
    ).toBe(true);

    expect(
      blocked(
        planSketchSlot(
          slotOp({
            construction: "yes" as unknown as boolean
          })
        )
      )
    ).toMatchObject({
      code: "SKETCH_CONVENIENCE_GEOMETRY_INVALID",
      path: "construction"
    });
  });
});
