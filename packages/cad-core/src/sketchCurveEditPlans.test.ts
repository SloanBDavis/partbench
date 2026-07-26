import type {
  SketchArcEntity,
  SketchCircleEntitySnapshot,
  SketchEntitySnapshot,
  SketchLineEntitySnapshot,
  SketchRectangleEntitySnapshot
} from "@web-cad/cad-protocol";
import { describe, expect, it } from "vitest";

import {
  planSketchExplodeRectangle,
  planSketchExtend,
  planSketchSplit,
  planSketchTrim,
  type SketchCurveEditPlanResult
} from "./sketchCurveEditPlans";

function line(
  id: string,
  start: readonly [number, number],
  end: readonly [number, number],
  construction = false
): SketchLineEntitySnapshot {
  return { id, kind: "line", start, end, construction };
}

function circle(
  id: string,
  center: readonly [number, number],
  radius: number,
  construction = false
): SketchCircleEntitySnapshot {
  return { id, kind: "circle", center, radius, construction };
}

function arc(
  id: string,
  center: readonly [number, number],
  radius: number,
  startAngleDegrees: number,
  sweepAngleDegrees: number,
  construction = false
): SketchArcEntity {
  return {
    id,
    kind: "arc",
    center,
    radius,
    startAngleDegrees,
    sweepAngleDegrees,
    construction
  };
}

function rectangle(
  id: string,
  center: readonly [number, number],
  width: number,
  height: number,
  construction = false
): SketchRectangleEntitySnapshot {
  return {
    id,
    kind: "rectangle",
    center,
    width,
    height,
    construction
  };
}

function ready(result: SketchCurveEditPlanResult) {
  expect(result.status).toBe("ready");
  if (result.status !== "ready") {
    throw new Error(result.diagnostics[0]?.code);
  }
  return result.plan;
}

function blockedCode(result: SketchCurveEditPlanResult): string | undefined {
  expect(result.status).toBe("blocked");
  return result.status === "blocked" ? result.diagnostics[0]?.code : undefined;
}

describe("V19 pure curve-edit plans", () => {
  it("trims a line against only the listed finite boundary and preserves the retained target ID", () => {
    const entities: SketchEntitySnapshot[] = [
      line("target", [0, 0], [10, 0], true),
      line("cut", [4, -1], [4, 1]),
      line("unlisted", [8, -1], [8, 1])
    ];
    const plan = ready(
      planSketchTrim(entities, {
        entityId: "target",
        boundaryEntityIds: ["cut"],
        pickPoint: [1, 0]
      })
    );

    expect(plan.requiredCreatedEntityIdCount).toBe(0);
    expect(plan.materialized?.entities).toEqual([
      {
        id: "target",
        kind: "line",
        start: [4, 0],
        end: [10, 0],
        construction: true
      }
    ]);
    expect(plan.pieces[0]?.endpointProvenance).toMatchObject({
      start: {
        sourceParameter: 4,
        cause: "intersection",
        boundaryEntityId: "cut"
      },
      end: {
        sourceParameter: 10,
        sourceEndpoint: "end",
        cause: "source-endpoint"
      }
    });
  });

  it("orders multi-piece line trim results by source parameter and consumes IDs only for additional pieces", () => {
    const entities = [
      line("target", [0, 0], [10, 0]),
      line("left", [3, -1], [3, 1]),
      line("right", [7, -1], [7, 1])
    ];
    const unmaterialized = ready(
      planSketchTrim(entities, {
        entityId: "target",
        boundaryEntityIds: ["right", "left"],
        pickPoint: [5, 0]
      })
    );
    expect(unmaterialized.requiredCreatedEntityIdCount).toBe(1);
    expect(unmaterialized.materialized).toBeUndefined();
    expect(unmaterialized.pieces.map((piece) => piece.id)).toEqual([
      { kind: "preserved", entityId: "target" },
      { kind: "created", createdIndex: 0 }
    ]);

    const materialized = ready(
      planSketchTrim(entities, {
        entityId: "target",
        boundaryEntityIds: ["right", "left"],
        pickPoint: [5, 0],
        createdEntityIds: ["new-right"]
      })
    );
    expect(materialized.materialized?.entities).toEqual([
      {
        id: "target",
        kind: "line",
        start: [0, 0],
        end: [3, 0],
        construction: false
      },
      {
        id: "new-right",
        kind: "line",
        start: [7, 0],
        end: [10, 0],
        construction: false
      }
    ]);
  });

  it("converts a trimmed circle to one complementary CCW arc with no inherited ID", () => {
    const plan = ready(
      planSketchTrim(
        [
          circle("target", [0, 0], 10, true),
          line("diameter", [0, -20], [0, 20])
        ],
        {
          entityId: "target",
          boundaryEntityIds: ["diameter"],
          pickPoint: [10, 0],
          createdEntityIds: ["retained-arc"]
        }
      )
    );
    expect(plan.materialized?.entities).toEqual([
      {
        id: "retained-arc",
        kind: "arc",
        center: [0, 0],
        radius: 10,
        startAngleDegrees: 90,
        sweepAngleDegrees: 180,
        construction: true
      }
    ]);
    expect(plan.materialized?.replacement).toEqual({
      sourceEntityId: "target",
      disposition: "deleted",
      resultEntityIds: ["retained-arc"]
    });
    expect(plan.pieces[0]?.sourceInterval).toEqual({
      startParameter: 90,
      endParameter: 270,
      cyclic: false
    });
  });

  it("retains every boundary identity when circle intersections collapse across the seam", () => {
    const radialBoundary = (id: string, degrees: number) => {
      const radians = (degrees * Math.PI) / 180;
      const direction = [Math.cos(radians), Math.sin(radians)] as const;
      return line(
        id,
        [-20 * direction[0], -20 * direction[1]],
        [20 * direction[0], 20 * direction[1]]
      );
    };
    const plan = ready(
      planSketchTrim(
        [
          circle("target", [0, 0], 10),
          radialBoundary("z-boundary", -0.01),
          radialBoundary("a-boundary", 0.01)
        ],
        {
          entityId: "target",
          boundaryEntityIds: ["z-boundary", "a-boundary"],
          pickPoint: [0, 10],
          createdEntityIds: ["retained-arc"]
        },
        {
          linearTolerance: 0.01,
          angularToleranceDegrees: 0.1,
          minimumProfileArea: 1e-12
        }
      )
    );

    expect(
      plan.previewIntersections?.map(
        ({ boundaryEntityId, targetParameter }) => ({
          boundaryEntityId,
          targetParameter
        })
      )
    ).toEqual([
      { boundaryEntityId: "a-boundary", targetParameter: 0 },
      { boundaryEntityId: "z-boundary", targetParameter: 0 },
      { boundaryEntityId: "a-boundary", targetParameter: 179.99 },
      { boundaryEntityId: "z-boundary", targetParameter: 179.99 }
    ]);
    expect(plan.previewIntersections?.[0]?.point).toEqual([10, 0]);
    expect(plan.previewIntersections?.[1]?.point).toEqual([10, 0]);
  });

  it("rejects off-curve and intersection trim picks and overlapping supports", () => {
    const base = [
      line("target", [0, 0], [10, 0]),
      line("cut", [5, -1], [5, 1])
    ];
    expect(
      blockedCode(
        planSketchTrim(base, {
          entityId: "target",
          boundaryEntityIds: ["cut"],
          pickPoint: [2, 0.001]
        })
      )
    ).toBe("SKETCH_EDIT_PICK_OFF_CURVE");
    expect(
      blockedCode(
        planSketchTrim(base, {
          entityId: "target",
          boundaryEntityIds: ["cut"],
          pickPoint: [5, 0]
        })
      )
    ).toBe("SKETCH_EDIT_INTERSECTION_AMBIGUOUS");
    expect(
      blockedCode(
        planSketchTrim([...base, line("overlap", [2, 0], [7, 0])], {
          entityId: "target",
          boundaryEntityIds: ["overlap"],
          pickPoint: [1, 0]
        })
      )
    ).toBe("SKETCH_EDIT_INTERSECTION_AMBIGUOUS");
  });

  it("trims a signed arc while retaining its signed V17 traversal", () => {
    const plan = ready(
      planSketchTrim(
        [arc("target", [0, 0], 10, 180, -180), line("cut", [0, -1], [0, 11])],
        {
          entityId: "target",
          boundaryEntityIds: ["cut"],
          pickPoint: [-Math.SQRT1_2 * 10, Math.SQRT1_2 * 10]
        }
      )
    );
    expect(plan.materialized?.entities[0]).toMatchObject({
      id: "target",
      kind: "arc",
      startAngleDegrees: 90,
      sweepAngleDegrees: -90
    });
  });

  it("splits line points in canonical order, collapses duplicates, and records endpoint provenance", () => {
    const plan = ready(
      planSketchSplit([line("target", [0, 0], [10, 0], true)], {
        entityId: "target",
        splitPoints: [
          [8, 0],
          [2, 0],
          [2 + 1e-8, 0]
        ],
        createdEntityIds: ["middle", "right"]
      })
    );
    expect(plan.materialized?.entities).toEqual([
      {
        id: "target",
        kind: "line",
        start: [0, 0],
        end: [2, 0],
        construction: true
      },
      {
        id: "middle",
        kind: "line",
        start: [2, 0],
        end: [8, 0],
        construction: true
      },
      {
        id: "right",
        kind: "line",
        start: [8, 0],
        end: [10, 0],
        construction: true
      }
    ]);
    expect(plan.pieces[0]?.endpointProvenance.start.sourceEndpoint).toBe(
      "start"
    );
    expect(plan.pieces[2]?.endpointProvenance.end.sourceEndpoint).toBe("end");
  });

  it("rejects an entire line/arc split when any submitted point is an endpoint", () => {
    expect(
      blockedCode(
        planSketchSplit([line("target", [0, 0], [10, 0])], {
          entityId: "target",
          splitPoints: [
            [4, 0],
            [10, 0]
          ]
        })
      )
    ).toBe("SKETCH_EDIT_SPLIT_POINT_INVALID");
  });

  it("splits a circle into increasing CCW arcs with the seam-spanning arc last", () => {
    const plan = ready(
      planSketchSplit([circle("target", [0, 0], 10)], {
        entityId: "target",
        splitPoints: [
          [-10, 0],
          [10, 0],
          [0, 10]
        ],
        createdEntityIds: ["zero", "ninety", "seam"]
      })
    );
    expect(
      plan.materialized?.entities.map((entity) => ({
        id: entity.id,
        kind: entity.kind,
        startAngleDegrees:
          entity.kind === "arc" ? entity.startAngleDegrees : undefined,
        sweepAngleDegrees:
          entity.kind === "arc" ? entity.sweepAngleDegrees : undefined
      }))
    ).toEqual([
      {
        id: "zero",
        kind: "arc",
        startAngleDegrees: 0,
        sweepAngleDegrees: 90
      },
      {
        id: "ninety",
        kind: "arc",
        startAngleDegrees: 90,
        sweepAngleDegrees: 90
      },
      {
        id: "seam",
        kind: "arc",
        startAngleDegrees: 180,
        sweepAngleDegrees: 180
      }
    ]);
    expect(plan.pieces[2]?.sourceInterval.cyclic).toBe(true);
    expect(plan.pieces[2]?.endpointProvenance.end.sourceParameter).toBe(0);
  });

  it("requires two distinct circle split parameters and the exact created-ID count", () => {
    const entities = [circle("target", [0, 0], 10)];
    expect(
      blockedCode(
        planSketchSplit(entities, {
          entityId: "target",
          splitPoints: [
            [10, 0],
            [10, 1e-9]
          ]
        })
      )
    ).toBe("SKETCH_EDIT_INTERSECTION_MISSING");
    expect(
      blockedCode(
        planSketchSplit(entities, {
          entityId: "target",
          splitPoints: [
            [10, 0],
            [-10, 0]
          ],
          createdEntityIds: ["only-one"]
        })
      )
    ).toBe("SKETCH_EDIT_OUTPUT_ID_COUNT_MISMATCH");
  });

  it("extends a line endpoint to the closest explicit finite boundary", () => {
    const plan = ready(
      planSketchExtend(
        [
          line("target", [0, 0], [2, 0], true),
          line("far", [5, -1], [5, 1]),
          line("near", [3, -1], [3, 1])
        ],
        {
          entityId: "target",
          endpoint: "end",
          boundaryEntityIds: ["far", "near"]
        }
      )
    );
    expect(plan.requiredCreatedEntityIdCount).toBe(0);
    expect(plan.materialized?.entities).toEqual([
      {
        id: "target",
        kind: "line",
        start: [0, 0],
        end: [3, 0],
        construction: true
      }
    ]);
    expect(plan.pieces[0]?.endpointProvenance.end).toMatchObject({
      sourceEndpoint: "end",
      sourceParameter: 3,
      cause: "extension",
      boundaryEntityId: "near"
    });
  });

  it("uses finite boundary geometry for extend and rejects overlapping supports", () => {
    expect(
      blockedCode(
        planSketchExtend(
          [line("target", [0, 0], [2, 0]), line("miss", [3, 1], [3, 2])],
          {
            entityId: "target",
            endpoint: "end",
            boundaryEntityIds: ["miss"]
          }
        )
      )
    ).toBe("SKETCH_EDIT_INTERSECTION_MISSING");
    expect(
      blockedCode(
        planSketchExtend(
          [line("target", [0, 0], [2, 0]), line("overlap", [3, 0], [4, 0])],
          {
            entityId: "target",
            endpoint: "end",
            boundaryEntityIds: ["overlap"]
          }
        )
      )
    ).toBe("SKETCH_EDIT_INTERSECTION_AMBIGUOUS");
    expect(
      blockedCode(
        planSketchExtend(
          [line("target", [0, 0], [2, 0]), line("at-end", [2, -1], [2, 1])],
          {
            entityId: "target",
            endpoint: "end",
            boundaryEntityIds: ["at-end"]
          }
        )
      )
    ).toBe("SKETCH_EDIT_ZERO_LENGTH_RESULT");
  });

  it("extends positive and negative signed arc endpoints without changing center or radius", () => {
    const positive = ready(
      planSketchExtend(
        [arc("target", [0, 0], 1, 0, 90), line("boundary", [-1, -1], [-1, 1])],
        {
          entityId: "target",
          endpoint: "end",
          boundaryEntityIds: ["boundary"]
        }
      )
    );
    expect(positive.materialized?.entities[0]).toMatchObject({
      id: "target",
      kind: "arc",
      center: [0, 0],
      radius: 1,
      startAngleDegrees: 0,
      sweepAngleDegrees: 180
    });

    const negative = ready(
      planSketchExtend(
        [
          arc("target", [0, 0], 1, 180, -90),
          line("boundary", [-1, -1], [1, -1])
        ],
        {
          entityId: "target",
          endpoint: "start",
          boundaryEntityIds: ["boundary"]
        }
      )
    );
    expect(negative.materialized?.entities[0]).toMatchObject({
      id: "target",
      kind: "arc",
      center: [0, 0],
      radius: 1,
      startAngleDegrees: 270,
      sweepAngleDegrees: -180
    });
  });

  it("directionally unwraps valid arc extensions beyond half a turn", () => {
    const pointAt = (degrees: number, radius: number) => {
      const radians = (degrees * Math.PI) / 180;
      return [radius * Math.cos(radians), radius * Math.sin(radians)] as const;
    };
    const positive = ready(
      planSketchExtend(
        [
          arc("target", [0, 0], 1, 0, 10),
          line("boundary", pointAt(200, 0.5), pointAt(200, 1.5))
        ],
        {
          entityId: "target",
          endpoint: "end",
          boundaryEntityIds: ["boundary"]
        }
      )
    );
    expect(positive.materialized?.entities[0]).toMatchObject({
      startAngleDegrees: 0,
      sweepAngleDegrees: 200
    });

    const negative = ready(
      planSketchExtend(
        [
          arc("target", [0, 0], 1, 0, -10),
          line("boundary", pointAt(160, 0.5), pointAt(160, 1.5))
        ],
        {
          entityId: "target",
          endpoint: "start",
          boundaryEntityIds: ["boundary"]
        }
      )
    );
    expect(negative.materialized?.entities[0]).toMatchObject({
      startAngleDegrees: 160,
      sweepAngleDegrees: -170
    });
  });

  it("rejects multiple closest extend boundaries even at one contact", () => {
    expect(
      blockedCode(
        planSketchExtend(
          [
            line("target", [0, 0], [2, 0]),
            line("first", [3, -1], [3, 1]),
            line("second", [3, -2], [3, 2])
          ],
          {
            entityId: "target",
            endpoint: "end",
            boundaryEntityIds: ["first", "second"]
          }
        )
      )
    ).toBe("SKETCH_EDIT_INTERSECTION_AMBIGUOUS");
  });

  it("explodes a rectangle in exact vMin, uMax, vMax, uMin CCW order", () => {
    const plan = ready(
      planSketchExplodeRectangle([rectangle("rect", [2, 3], 4, 2, true)], {
        entityId: "rect",
        lineEntityIds: ["vMin", "uMax", "vMax", "uMin"]
      })
    );
    expect(plan.materialized?.entities).toEqual([
      {
        id: "vMin",
        kind: "line",
        start: [0, 2],
        end: [4, 2],
        construction: true
      },
      {
        id: "uMax",
        kind: "line",
        start: [4, 2],
        end: [4, 4],
        construction: true
      },
      {
        id: "vMax",
        kind: "line",
        start: [4, 4],
        end: [0, 4],
        construction: true
      },
      {
        id: "uMin",
        kind: "line",
        start: [0, 4],
        end: [0, 2],
        construction: true
      }
    ]);
    expect(plan.materialized?.replacement).toEqual({
      sourceEntityId: "rect",
      disposition: "deleted",
      resultEntityIds: ["vMin", "uMax", "vMax", "uMin"]
    });
    expect(
      plan.pieces.map((piece) => piece.endpointProvenance.start.cause)
    ).toEqual([
      "rectangle-corner",
      "rectangle-corner",
      "rectangle-corner",
      "rectangle-corner"
    ]);
  });

  it("rejects conflicting created IDs before materialization", () => {
    expect(
      blockedCode(
        planSketchExplodeRectangle(
          [
            rectangle("rect", [0, 0], 4, 2),
            line("already-there", [0, 0], [1, 0])
          ],
          {
            entityId: "rect",
            lineEntityIds: ["a", "already-there", "c", "d"]
          }
        )
      )
    ).toBe("SKETCH_EDIT_OUTPUT_ID_CONFLICT");
  });

  it("rejects non-finite and precision-collapsed derived rectangle edges", () => {
    expect(
      blockedCode(
        planSketchExplodeRectangle(
          [rectangle("overflow", [1e308, 0], 1.6e308, 2)],
          { entityId: "overflow" }
        )
      )
    ).toBe("SKETCH_EDIT_GEOMETRY_INVALID");
    expect(
      blockedCode(
        planSketchExplodeRectangle([rectangle("collapsed", [1e20, 0], 1, 2)], {
          entityId: "collapsed"
        })
      )
    ).toBe("SKETCH_EDIT_GEOMETRY_INVALID");
  });
});
