import { describe, expect, it } from "vitest";

import type {
  OrientedSketchSegmentRef,
  SketchArcEntity,
  SketchCircleEntitySnapshot,
  SketchEntitySnapshot,
  SketchLineEntitySnapshot,
  SketchRectangleEntitySnapshot,
  Vec2
} from "@web-cad/cad-protocol";

import {
  MAX_OFFSET_EDITED_SKETCH_ENTITIES,
  MAX_SKETCH_OFFSET_SOURCE_SEGMENTS,
  planSketchOffset,
  type PlannedSketchOffsetShape,
  type SketchOffsetDiagnosticCode,
  type SketchOffsetPlan,
  type SketchOffsetPlanInput
} from "./sketchOffsetPolicy";

function line(
  id: string,
  start: Vec2,
  end: Vec2,
  construction = false
): SketchLineEntitySnapshot {
  return { id, kind: "line", start, end, construction };
}

function arc(
  id: string,
  center: Vec2,
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

function circle(
  id: string,
  center: Vec2,
  radius: number,
  construction = false
): SketchCircleEntitySnapshot {
  return { id, kind: "circle", center, radius, construction };
}

function rectangle(
  id: string,
  center: Vec2,
  width: number,
  height: number,
  construction = false
): SketchRectangleEntitySnapshot {
  return { id, kind: "rectangle", center, width, height, construction };
}

function forward(...entityIds: readonly string[]): OrientedSketchSegmentRef[] {
  return entityIds.map((entityId) => ({
    entityId,
    orientation: "forward"
  }));
}

function ready(input: SketchOffsetPlanInput): SketchOffsetPlan {
  const result = planSketchOffset(input);
  expect(result).toMatchObject({ status: "ready", diagnostics: [] });
  if (result.status !== "ready") throw new Error("Expected offset readiness.");
  return result.plan;
}

function blockedCode(
  input: SketchOffsetPlanInput,
  code: SketchOffsetDiagnosticCode
): void {
  const result = planSketchOffset(input);
  expect(result).toMatchObject({
    status: "blocked",
    diagnostics: [{ code }]
  });
}

function expectPoint(actual: Vec2, expected: Vec2): void {
  expect(actual[0]).toBeCloseTo(expected[0], 10);
  expect(actual[1]).toBeCloseTo(expected[1], 10);
}

function expectLine(
  shape: PlannedSketchOffsetShape,
  start: Vec2,
  end: Vec2
): void {
  expect(shape.kind).toBe("line");
  if (shape.kind !== "line") return;
  expectPoint(shape.start, start);
  expectPoint(shape.end, end);
}

describe("Decision 7 individual analytic offset policy", () => {
  it("offsets both authored sides of a line and inherits construction", () => {
    const source = line("line", [0, 0], [4, 0], true);
    const left = ready({
      entities: [source],
      source: { kind: "entity", entityId: source.id },
      distance: 1,
      side: "left"
    });
    const right = ready({
      entities: [source],
      source: { kind: "entity", entityId: source.id },
      distance: 1,
      side: "right"
    });

    expectLine(left.outputShapes[0]!, [0, 1], [4, 1]);
    expectLine(right.outputShapes[0]!, [0, -1], [4, -1]);
    expect(left).toMatchObject({
      construction: true,
      associative: false,
      constraints: [],
      resultEntityCount: 1,
      requiredCreatedEntityIdCount: 1
    });
  });

  it("offsets both sides of positive and negative arcs while preserving signed sweep", () => {
    for (const sweepAngleDegrees of [90, -90]) {
      const source = arc("arc", [0, 0], 5, 0, sweepAngleDegrees);
      const left = ready({
        entities: [source],
        source: { kind: "entity", entityId: source.id },
        distance: 1,
        side: "left"
      }).outputShapes[0]!;
      const right = ready({
        entities: [source],
        source: { kind: "entity", entityId: source.id },
        distance: 1,
        side: "right"
      }).outputShapes[0]!;
      expect(left).toMatchObject({
        kind: "arc",
        radius: sweepAngleDegrees > 0 ? 4 : 6,
        sweepAngleDegrees
      });
      expect(right).toMatchObject({
        kind: "arc",
        radius: sweepAngleDegrees > 0 ? 6 : 4,
        sweepAngleDegrees
      });
    }
  });

  it("preserves exact authored arc sweeps at both V17 angular domain boundaries", () => {
    for (const sweepAngleDegrees of [0.1, 359.9, -0.1, -359.9]) {
      const source = arc("arc", [2.3, -4.7], 5.6, 11.988, sweepAngleDegrees);
      const shape = ready({
        entities: [source],
        source: { kind: "entity", entityId: source.id },
        distance: 0.2,
        side: "right"
      }).outputShapes[0]!;
      expect(shape.kind).toBe("arc");
      if (shape.kind === "arc") {
        expect(shape.startAngleDegrees).toBe(source.startAngleDegrees);
        expect(shape.sweepAngleDegrees).toBe(source.sweepAngleDegrees);
      }
    }
  });

  it("offsets circles inward and outward and rejects inward collapse", () => {
    const source = circle("circle", [2, 3], 4, true);
    expect(
      ready({
        entities: [source],
        source: { kind: "entity", entityId: source.id },
        distance: 1,
        side: "inward"
      }).outputShapes[0]
    ).toEqual({
      kind: "circle",
      center: [2, 3],
      radius: 3,
      construction: true
    });
    expect(
      ready({
        entities: [source],
        source: { kind: "entity", entityId: source.id },
        distance: 1,
        side: "outward"
      }).outputShapes[0]
    ).toEqual({
      kind: "circle",
      center: [2, 3],
      radius: 5,
      construction: true
    });
    blockedCode(
      {
        entities: [source],
        source: { kind: "entity", entityId: source.id },
        distance: 4,
        side: "inward"
      },
      "SKETCH_OFFSET_COLLAPSE"
    );
  });

  it("offsets rectangles inward and outward without exploding their source kind", () => {
    const source = rectangle("rectangle", [2, 3], 6, 4);
    expect(
      ready({
        entities: [source],
        source: { kind: "entity", entityId: source.id },
        distance: 1,
        side: "inward"
      }).outputShapes
    ).toEqual([
      {
        kind: "rectangle",
        center: [2, 3],
        width: 4,
        height: 2,
        construction: false
      }
    ]);
    expect(
      ready({
        entities: [source],
        source: { kind: "entity", entityId: source.id },
        distance: 1,
        side: "outward"
      }).outputShapes[0]
    ).toMatchObject({ kind: "rectangle", width: 8, height: 6 });
    blockedCode(
      {
        entities: [source],
        source: { kind: "entity", entityId: source.id },
        distance: 2,
        side: "inward"
      },
      "SKETCH_OFFSET_COLLAPSE"
    );
  });

  it("enforces the exact side vocabulary for each individual source family", () => {
    blockedCode(
      {
        entities: [line("line", [0, 0], [1, 0])],
        source: { kind: "entity", entityId: "line" },
        distance: 0.5,
        side: "inward"
      },
      "SKETCH_OFFSET_SIDE_INVALID"
    );
    blockedCode(
      {
        entities: [circle("circle", [0, 0], 2)],
        source: { kind: "entity", entityId: "circle" },
        distance: 0.5,
        side: "left"
      },
      "SKETCH_OFFSET_SIDE_INVALID"
    );
  });

  it("never publishes positive offsets that round to unchanged line, circle, arc, or rectangle source", () => {
    const large = 10_000_000_000_000_000;
    const cases: readonly SketchOffsetPlanInput[] = [
      {
        entities: [line("line", [large, large], [large + 4, large])],
        source: { kind: "entity", entityId: "line" },
        distance: 0.1,
        side: "left"
      },
      {
        entities: [circle("circle", [0, 0], large)],
        source: { kind: "entity", entityId: "circle" },
        distance: 0.1,
        side: "outward"
      },
      {
        entities: [arc("arc", [0, 0], large, 0, 90)],
        source: { kind: "entity", entityId: "arc" },
        distance: 0.1,
        side: "right"
      },
      {
        entities: [rectangle("rectangle", [0, 0], large, large)],
        source: { kind: "entity", entityId: "rectangle" },
        distance: 0.1,
        side: "outward"
      }
    ];
    for (const input of cases) {
      blockedCode(input, "SKETCH_OFFSET_JOIN_NO_SOLUTION");
    }
  });

  it("preserves positive sub-tolerance offsets when their supports and spans are representable", () => {
    const distance = 1e-8;
    const cases: readonly SketchOffsetPlanInput[] = [
      {
        entities: [line("line", [0, 0], [4, 0])],
        source: { kind: "entity", entityId: "line" },
        distance,
        side: "left"
      },
      {
        entities: [circle("circle", [0, 0], 4)],
        source: { kind: "entity", entityId: "circle" },
        distance,
        side: "outward"
      },
      {
        entities: [arc("arc", [0, 0], 4, 0, 90)],
        source: { kind: "entity", entityId: "arc" },
        distance,
        side: "right"
      },
      {
        entities: [rectangle("rectangle", [0, 0], 6, 4)],
        source: { kind: "entity", entityId: "rectangle" },
        distance,
        side: "outward"
      }
    ];
    for (const input of cases) {
      expect(planSketchOffset(input).status).toBe("ready");
    }
  });
});

describe("Decision 7 ordered chain offset policy", () => {
  const cornerEntities = [
    line("a", [0, 0], [4, 0]),
    line("b", [4, 0], [4, 3])
  ] as const;

  it("creates one forward-connected output per open-chain segment on both sides", () => {
    const left = ready({
      entities: cornerEntities,
      source: { kind: "chain", segments: forward("a", "b"), closed: false },
      distance: 1,
      side: "left"
    });
    expect(left.outputShapes).toHaveLength(2);
    expectLine(left.outputShapes[0]!, [0, 1], [3, 1]);
    expectLine(left.outputShapes[1]!, [3, 1], [3, 3]);

    const right = ready({
      entities: cornerEntities,
      source: { kind: "chain", segments: forward("a", "b"), closed: false },
      distance: 1,
      side: "right"
    });
    expectLine(right.outputShapes[0]!, [0, -1], [5, -1]);
    expectLine(right.outputShapes[1]!, [5, -1], [5, 3]);
  });

  it("rejects a chain segment whose intended positive support offset is not representable", () => {
    const large = 10_000_000_000_000_000;
    blockedCode(
      {
        entities: [line("line", [large, large], [large + 4, large])],
        source: {
          kind: "chain",
          segments: forward("line"),
          closed: false
        },
        distance: 0.1,
        side: "left"
      },
      "SKETCH_OFFSET_JOIN_NO_SOLUTION"
    );
  });

  it("retains a representable positive sub-tolerance chain support offset", () => {
    const plan = ready({
      entities: [line("line", [0, 0], [4, 0])],
      source: {
        kind: "chain",
        segments: forward("line"),
        closed: false
      },
      distance: 1e-8,
      side: "left"
    });
    expectLine(plan.outputShapes[0]!, [0, 1e-8], [4, 1e-8]);
  });

  it("honors submitted reverse orientations rather than authored entity direction", () => {
    const entities = [line("a", [4, 0], [0, 0]), line("b", [4, 3], [4, 0])];
    const plan = ready({
      entities,
      source: {
        kind: "chain",
        segments: [
          { entityId: "a", orientation: "reverse" },
          { entityId: "b", orientation: "reverse" }
        ],
        closed: false
      },
      distance: 1,
      side: "left"
    });
    expectLine(plan.outputShapes[0]!, [0, 1], [3, 1]);
    expectLine(plan.outputShapes[1]!, [3, 1], [3, 3]);
  });

  it("maps coincident collinear and co-circular support joins exactly", () => {
    const collinear = ready({
      entities: [line("a", [0, 0], [2, 0]), line("b", [2, 0], [4, 0])],
      source: { kind: "chain", segments: forward("a", "b"), closed: false },
      distance: 1,
      side: "left"
    });
    expectLine(collinear.outputShapes[0]!, [0, 1], [2, 1]);
    expectLine(collinear.outputShapes[1]!, [2, 1], [4, 1]);

    const circular = ready({
      entities: [arc("a", [0, 0], 5, 0, 45), arc("b", [0, 0], 5, 45, 45)],
      source: { kind: "chain", segments: forward("a", "b"), closed: false },
      distance: 1,
      side: "left"
    });
    expect(circular.outputShapes).toMatchObject([
      { kind: "arc", radius: 4, sweepAngleDegrees: 45 },
      { kind: "arc", radius: 4, sweepAngleDegrees: 45 }
    ]);
    const first = circular.outputShapes[0]!;
    const second = circular.outputShapes[1]!;
    if (first.kind === "arc" && second.kind === "arc") {
      const firstEndAngle = first.startAngleDegrees + first.sweepAngleDegrees;
      expect(firstEndAngle).toBeCloseTo(second.startAngleDegrees, 10);
    }
  });

  it("uses exact line/arc natural joins without tessellated replacement", () => {
    const plan = ready({
      entities: [line("line", [0, 0], [4, 0]), arc("arc", [4, 1], 1, 270, 90)],
      source: {
        kind: "chain",
        segments: forward("line", "arc"),
        closed: false
      },
      distance: 0.5,
      side: "left"
    });
    expectLine(plan.outputShapes[0]!, [0, 0.5], [4, 0.5]);
    expect(plan.outputShapes[1]).toMatchObject({
      kind: "arc",
      center: [4, 1],
      radius: 0.5,
      startAngleDegrees: 270,
      sweepAngleDegrees: 90
    });
  });

  it("rejects a real small-radius arc reversal instead of tolerance-snapping it into the V17 domain", () => {
    blockedCode(
      {
        entities: [
          line(
            "line",
            [0.000_045_436_298_414_302_495, -0.000_029_650_845_314_032_824],
            [0.000_05, 0]
          ),
          arc("arc", [0, 0], 0.000_05, 0, 1)
        ],
        source: {
          kind: "chain",
          segments: forward("line", "arc"),
          closed: false
        },
        distance: 0.000_01,
        side: "left"
      },
      "SKETCH_OFFSET_ARC_REVERSAL"
    );
  });

  it("snaps only floating reconstruction noise at chain arc domain boundaries", () => {
    for (const sweepAngleDegrees of [0.1, 359.9]) {
      const source = arc("arc", [2.3, -4.7], 5.6, 11.988, sweepAngleDegrees);
      const shape = ready({
        entities: [source],
        source: {
          kind: "chain",
          segments: forward(source.id),
          closed: false
        },
        distance: 0.2,
        side: "right"
      }).outputShapes[0]!;
      expect(shape.kind).toBe("arc");
      if (shape.kind === "arc") {
        expect(shape.sweepAngleDegrees).toBe(sweepAngleDegrees);
      }
    }
  });

  it("offsets a CCW closed loop inward/outward and a CW loop by orientation", () => {
    const ccw = [
      line("bottom", [0, 0], [4, 0]),
      line("right", [4, 0], [4, 4]),
      line("top", [4, 4], [0, 4]),
      line("left", [0, 4], [0, 0])
    ];
    const inward = ready({
      entities: ccw,
      source: {
        kind: "chain",
        segments: forward("bottom", "right", "top", "left"),
        closed: true
      },
      distance: 1,
      side: "inward"
    });
    expectLine(inward.outputShapes[0]!, [1, 1], [3, 1]);
    expectLine(inward.outputShapes[1]!, [3, 1], [3, 3]);
    expectLine(inward.outputShapes[2]!, [3, 3], [1, 3]);
    expectLine(inward.outputShapes[3]!, [1, 3], [1, 1]);

    const outward = ready({
      entities: ccw,
      source: {
        kind: "chain",
        segments: forward("bottom", "right", "top", "left"),
        closed: true
      },
      distance: 1,
      side: "outward"
    });
    expectLine(outward.outputShapes[0]!, [-1, -1], [5, -1]);

    const clockwise = ready({
      entities: ccw,
      source: {
        kind: "chain",
        segments: [
          { entityId: "left", orientation: "reverse" },
          { entityId: "top", orientation: "reverse" },
          { entityId: "right", orientation: "reverse" },
          { entityId: "bottom", orientation: "reverse" }
        ],
        closed: true
      },
      distance: 1,
      side: "inward"
    });
    expectLine(clockwise.outputShapes[0]!, [1, 1], [1, 3]);
  });

  it("classifies translated closed-loop orientation without absolute-coordinate cancellation", () => {
    const x = 437_555_721.678_615_45;
    const y = 425_861_289.477_595_3;
    const entities = [
      line("bottom", [x, y], [x + 4, y]),
      line("right", [x + 4, y], [x + 4, y + 4]),
      line("top", [x + 4, y + 4], [x, y + 4]),
      line("left", [x, y + 4], [x, y])
    ];
    const plan = ready({
      entities,
      source: {
        kind: "chain",
        segments: forward("bottom", "right", "top", "left"),
        closed: true
      },
      distance: 0.5,
      side: "inward"
    });
    expectLine(plan.outputShapes[0]!, [x + 0.5, y + 0.5], [x + 3.5, y + 0.5]);
    expectLine(plan.outputShapes[1]!, [x + 3.5, y + 0.5], [x + 3.5, y + 3.5]);
  });

  it("offsets closed oriented arc loops on both sides with exact containment evidence", () => {
    const entities = [
      arc("q0", [0, 0], 5, 0, 90),
      arc("q1", [0, 0], 5, 90, 90),
      arc("q2", [0, 0], 5, 180, 90),
      arc("q3", [0, 0], 5, 270, 90)
    ];
    const source = {
      kind: "chain" as const,
      segments: forward("q0", "q1", "q2", "q3"),
      closed: true
    };
    const inward = ready({
      entities,
      source,
      distance: 1,
      side: "inward",
      referencePoint: [1, 1]
    });
    expect(inward.outputShapes).toHaveLength(4);
    expect(
      inward.outputShapes.every(
        (shape) =>
          shape.kind === "arc" &&
          shape.radius === 4 &&
          shape.sweepAngleDegrees === 90
      )
    ).toBe(true);

    const outward = ready({
      entities,
      source,
      distance: 1,
      side: "outward",
      referencePoint: [7, 1]
    });
    expect(
      outward.outputShapes.every(
        (shape) =>
          shape.kind === "arc" &&
          shape.radius === 6 &&
          shape.sweepAngleDegrees === 90
      )
    ).toBe(true);
  });

  it("uses translation-stable arc-center terms for closed-loop orientation", () => {
    const center: Vec2 = [100_000_000.25, -100_000_000.75];
    const entities = [
      arc("q0", center, 4, 0, 90),
      arc("q1", center, 4, 90, 90),
      arc("q2", center, 4, 180, 90),
      arc("q3", center, 4, 270, 90)
    ];
    const plan = ready({
      entities,
      source: {
        kind: "chain",
        segments: forward("q0", "q1", "q2", "q3"),
        closed: true
      },
      distance: 0.5,
      side: "inward"
    });
    expect(
      plan.outputShapes.every(
        (shape) => shape.kind === "arc" && shape.radius === 3.5
      )
    ).toBe(true);
  });

  it("rejects an analytic natural join with no solution", () => {
    blockedCode(
      {
        entities: [arc("a", [0, 0], 1, 270, 90), arc("b", [2, 0], 1, 180, 90)],
        source: {
          kind: "chain",
          segments: forward("a", "b"),
          closed: false
        },
        distance: 0.5,
        side: "left"
      },
      "SKETCH_OFFSET_JOIN_NO_SOLUTION"
    );
  });

  it("rejects natural miters farther than ten times the offset distance", () => {
    blockedCode(
      {
        entities: [line("a", [0, 0], [4, 0]), line("b", [4, 0], [0.001, 0.01])],
        source: { kind: "chain", segments: forward("a", "b"), closed: false },
        distance: 0.1,
        side: "left"
      },
      "SKETCH_OFFSET_MITER_LIMIT"
    );
  });

  it("rejects re-resolved analytic output whose nominal joins exceed the shared gap tolerance", () => {
    blockedCode(
      {
        entities: [
          line(
            "first",
            [-1_374_651_406.327_177_3, 213_957_757.183_746_87],
            [-1_336_994_826.941_661_4, 303_957_256.222_371_6]
          ),
          arc(
            "arc",
            [-1_516_993_825.018_910_6, 379_270_414.993_403_43],
            195_119_735.528_942_02,
            337.295_138_240_607_1,
            43.992_477_092_880_83
          ),
          line(
            "last",
            [-1_335_187_162.949_245_7, 450_108_602.575_885_65],
            [-1_370_606_256.740_486_9, 541_011_933.610_718_1]
          )
        ],
        source: {
          kind: "chain",
          segments: forward("first", "arc", "last"),
          closed: false
        },
        distance: 9_755_986.776_447_1,
        side: "left"
      },
      "SKETCH_OFFSET_OUTPUT_DISCONNECTED"
    );
  });

  it.each([
    {
      expected: "SKETCH_OFFSET_ARC_REVERSAL",
      sweep: 5,
      incomingAngle: 0,
      outgoingAngle: 30,
      distance: 1,
      side: "left"
    },
    {
      expected: "SKETCH_OFFSET_ARC_EXTRA_WRAP",
      sweep: 270,
      incomingAngle: 300,
      outgoingAngle: 120,
      distance: 4,
      side: "right"
    },
    {
      expected: "SKETCH_OFFSET_OUTPUT_SELF_INTERSECTION",
      sweep: 20,
      incomingAngle: 0,
      outgoingAngle: 210,
      distance: 0.5,
      side: "left"
    },
    {
      expected: "SKETCH_OFFSET_JOIN_AMBIGUOUS",
      sweep: 5,
      incomingAngle: 270,
      outgoingAngle: 90,
      distance: 0.1,
      side: "right"
    }
  ] as const)(
    "reports typed $expected rather than publishing invalid analytic geometry",
    ({ expected, sweep, incomingAngle, outgoingAngle, distance, side }) => {
      const radians = (angle: number): number => (angle * Math.PI) / 180;
      const arcStart: Vec2 = [5, 0];
      const arcEnd: Vec2 = [
        5 * Math.cos(radians(sweep)),
        5 * Math.sin(radians(sweep))
      ];
      const entities: SketchEntitySnapshot[] = [
        line(
          "in",
          [
            arcStart[0] - 3 * Math.cos(radians(incomingAngle)),
            arcStart[1] - 3 * Math.sin(radians(incomingAngle))
          ],
          arcStart
        ),
        arc("arc", [0, 0], 5, 0, sweep),
        line("out", arcEnd, [
          arcEnd[0] + 3 * Math.cos(radians(outgoingAngle)),
          arcEnd[1] + 3 * Math.sin(radians(outgoingAngle))
        ])
      ];
      blockedCode(
        {
          entities,
          source: {
            kind: "chain",
            segments: forward("in", "arc", "out"),
            closed: false
          },
          distance,
          side
        },
        expected
      );
    }
  );

  it("inherits one construction value and rejects mixed chains", () => {
    const constructionPlan = ready({
      entities: [
        line("a", [0, 0], [2, 0], true),
        line("b", [2, 0], [2, 2], true)
      ],
      source: { kind: "chain", segments: forward("a", "b"), closed: false },
      distance: 0.25,
      side: "left"
    });
    expect(constructionPlan.construction).toBe(true);
    expect(
      constructionPlan.outputShapes.every((shape) => shape.construction)
    ).toBe(true);

    blockedCode(
      {
        entities: [line("a", [0, 0], [2, 0]), line("b", [2, 0], [2, 2], true)],
        source: { kind: "chain", segments: forward("a", "b"), closed: false },
        distance: 0.25,
        side: "left"
      },
      "SKETCH_OFFSET_CONSTRUCTION_MISMATCH"
    );
  });
});

describe("Decision 7 reference-point evidence", () => {
  it("accepts both sides of an open source and rejects disagreement/on-source evidence", () => {
    const source = line("line", [0, 0], [4, 0]);
    for (const [side, referencePoint] of [
      ["left", [2, 2]],
      ["right", [2, -2]]
    ] as const) {
      expect(
        planSketchOffset({
          entities: [source],
          source: { kind: "entity", entityId: source.id },
          distance: 1,
          side,
          referencePoint
        }).status
      ).toBe("ready");
    }
    blockedCode(
      {
        entities: [source],
        source: { kind: "entity", entityId: source.id },
        distance: 1,
        side: "right",
        referencePoint: [2, 2]
      },
      "SKETCH_OFFSET_REFERENCE_SIDE_MISMATCH"
    );
    blockedCode(
      {
        entities: [source],
        source: { kind: "entity", entityId: source.id },
        distance: 1,
        side: "left",
        referencePoint: [2, 0]
      },
      "SKETCH_OFFSET_REFERENCE_POINT_ON_SOURCE"
    );
  });

  it("validates strict inward/outward evidence for circles and rectangles", () => {
    const round = circle("circle", [0, 0], 4);
    expect(
      planSketchOffset({
        entities: [round],
        source: { kind: "entity", entityId: round.id },
        distance: 1,
        side: "inward",
        referencePoint: [1, 0]
      }).status
    ).toBe("ready");
    expect(
      planSketchOffset({
        entities: [round],
        source: { kind: "entity", entityId: round.id },
        distance: 1,
        side: "outward",
        referencePoint: [6, 0]
      }).status
    ).toBe("ready");
    blockedCode(
      {
        entities: [round],
        source: { kind: "entity", entityId: round.id },
        distance: 1,
        side: "inward",
        referencePoint: [0, 0]
      },
      "SKETCH_OFFSET_REFERENCE_PROJECTION_AMBIGUOUS"
    );

    const box = rectangle("rectangle", [0, 0], 6, 4);
    expect(
      planSketchOffset({
        entities: [box],
        source: { kind: "entity", entityId: box.id },
        distance: 0.5,
        side: "inward",
        referencePoint: [0, 1.5]
      }).status
    ).toBe("ready");
    expect(
      planSketchOffset({
        entities: [box],
        source: { kind: "entity", entityId: box.id },
        distance: 0.5,
        side: "outward",
        referencePoint: [0, 3]
      }).status
    ).toBe("ready");
  });

  it("rejects equal-distance segment ambiguity in a chain", () => {
    blockedCode(
      {
        entities: [line("a", [0, 0], [4, 0]), line("b", [4, 0], [4, 4])],
        source: { kind: "chain", segments: forward("a", "b"), closed: false },
        distance: 0.5,
        side: "left",
        referencePoint: [3, 1]
      },
      "SKETCH_OFFSET_REFERENCE_PROJECTION_AMBIGUOUS"
    );
  });

  it("rejects an arc-center reference with no unique polar projection", () => {
    const source = arc("arc", [2, 3], 4, 0, 90);
    blockedCode(
      {
        entities: [source],
        source: { kind: "entity", entityId: source.id },
        distance: 1,
        side: "left",
        referencePoint: [2, 3]
      },
      "SKETCH_OFFSET_REFERENCE_PROJECTION_AMBIGUOUS"
    );
  });
});

describe("Decision 7 rejection matrix and bounded work", () => {
  const baseLine = line("line", [0, 0], [4, 0]);

  it.each([
    [0, "SKETCH_OFFSET_DISTANCE_INVALID"],
    [-1, "SKETCH_OFFSET_DISTANCE_INVALID"],
    [Number.NaN, "SKETCH_OFFSET_NON_FINITE"],
    [Number.POSITIVE_INFINITY, "SKETCH_OFFSET_NON_FINITE"]
  ] as const)("rejects invalid distance %s", (distance, code) => {
    blockedCode(
      {
        entities: [baseLine],
        source: { kind: "entity", entityId: baseLine.id },
        distance,
        side: "left"
      },
      code
    );
  });

  it("accepts every positive finite distance even below the geometry tolerance", () => {
    const plan = ready({
      entities: [baseLine],
      source: { kind: "entity", entityId: baseLine.id },
      distance: Number.MIN_VALUE,
      side: "left"
    });
    expect(plan.distance).toBe(Number.MIN_VALUE);
    expect(plan.outputShapes).toHaveLength(1);
  });

  it("rejects missing and unsupported source entities", () => {
    blockedCode(
      {
        entities: [],
        source: { kind: "entity", entityId: "missing" },
        distance: 1,
        side: "left"
      },
      "SKETCH_OFFSET_SOURCE_MISSING"
    );
    blockedCode(
      {
        entities: [
          { id: "point", kind: "point", point: [0, 0], construction: false }
        ],
        source: { kind: "entity", entityId: "point" },
        distance: 1,
        side: "left"
      },
      "SKETCH_OFFSET_SOURCE_UNSUPPORTED"
    );
  });

  it("rejects duplicate, disconnected, and closure-mismatched chain source", () => {
    blockedCode(
      {
        entities: [baseLine],
        source: {
          kind: "chain",
          segments: forward("line", "line"),
          closed: false
        },
        distance: 1,
        side: "left"
      },
      "SKETCH_OFFSET_DUPLICATE_SOURCE"
    );
    blockedCode(
      {
        entities: [baseLine, line("b", [5, 0], [6, 0])],
        source: {
          kind: "chain",
          segments: forward("line", "b"),
          closed: false
        },
        distance: 1,
        side: "left"
      },
      "SKETCH_OFFSET_CHAIN_DISCONNECTED"
    );
    blockedCode(
      {
        entities: [line("a", [0, 0], [1, 0]), line("b", [1, 0], [0, 0])],
        source: { kind: "chain", segments: forward("a", "b"), closed: false },
        distance: 0.1,
        side: "left"
      },
      "SKETCH_OFFSET_CHAIN_CLOSURE_MISMATCH"
    );
  });

  it("rejects source overlap and non-adjacent self-intersection", () => {
    blockedCode(
      {
        entities: [line("a", [0, 0], [2, 0]), line("b", [2, 0], [1, 0])],
        source: { kind: "chain", segments: forward("a", "b"), closed: false },
        distance: 0.1,
        side: "left"
      },
      "SKETCH_OFFSET_CHAIN_OVERLAP"
    );
    blockedCode(
      {
        entities: [
          line("a", [0, 0], [2, 2]),
          line("b", [2, 2], [0, 2]),
          line("c", [0, 2], [2, 0])
        ],
        source: {
          kind: "chain",
          segments: forward("a", "b", "c"),
          closed: false
        },
        distance: 0.1,
        side: "left"
      },
      "SKETCH_OFFSET_CHAIN_SELF_INTERSECTION"
    );
  });

  it("rejects the edited-sketch and source-segment resource limits", () => {
    const tooManyEntities: SketchEntitySnapshot[] = Array.from(
      { length: MAX_OFFSET_EDITED_SKETCH_ENTITIES + 1 },
      (_, index) => ({
        id: `point-${index}`,
        kind: "point",
        point: [index, 0],
        construction: false
      })
    );
    blockedCode(
      {
        entities: tooManyEntities,
        source: { kind: "entity", entityId: "point-0" },
        distance: 1,
        side: "left"
      },
      "SKETCH_OFFSET_SKETCH_ENTITY_LIMIT"
    );

    const segments = Array.from(
      { length: MAX_SKETCH_OFFSET_SOURCE_SEGMENTS + 1 },
      (_, index) => ({
        entityId: `line-${index}`,
        orientation: "forward" as const
      })
    );
    blockedCode(
      {
        entities: [],
        source: { kind: "chain", segments, closed: false },
        distance: 1,
        side: "left"
      },
      "SKETCH_OFFSET_SEGMENT_LIMIT"
    );
  });

  it("rejects output ID count, duplicates, and conflicts", () => {
    blockedCode(
      {
        entities: [baseLine],
        source: { kind: "entity", entityId: baseLine.id },
        distance: 1,
        side: "left",
        createdEntityIds: []
      },
      "SKETCH_OFFSET_OUTPUT_ID_COUNT_MISMATCH"
    );
    const chainInput = {
      entities: [line("a", [0, 0], [2, 0]), line("b", [2, 0], [2, 2])],
      source: {
        kind: "chain" as const,
        segments: forward("a", "b"),
        closed: false
      },
      distance: 0.25,
      side: "left" as const
    };
    blockedCode(
      { ...chainInput, createdEntityIds: ["new", "new"] },
      "SKETCH_OFFSET_OUTPUT_ID_DUPLICATE"
    );
    blockedCode(
      { ...chainInput, createdEntityIds: ["new", "a"] },
      "SKETCH_OFFSET_OUTPUT_ID_CONFLICT"
    );
    blockedCode(
      { ...chainInput, createdEntityIds: ["new", ""] },
      "SKETCH_OFFSET_OUTPUT_ID_CONFLICT"
    );
    blockedCode(
      {
        ...chainInput,
        createdEntityIds: ["new", 7] as unknown as readonly string[]
      },
      "SKETCH_OFFSET_OUTPUT_ID_CONFLICT"
    );
  });
});

describe("Decision 7 deterministic, non-associative planning contract", () => {
  it("keeps planning geometry byte-identical with omitted or arbitrary caller IDs", () => {
    const input = {
      entities: [line("a", [0, 0], [4, 0]), line("b", [4, 0], [4, 3])],
      source: {
        kind: "chain" as const,
        segments: forward("a", "b"),
        closed: false
      },
      distance: 1,
      side: "left" as const
    };
    const planned = ready(input);
    const first = ready({
      ...input,
      createdEntityIds: ["first-a", "first-b"]
    });
    const second = ready({
      ...input,
      createdEntityIds: ["second-a", "second-b"]
    });

    expect(JSON.stringify(first.outputShapes)).toBe(
      JSON.stringify(planned.outputShapes)
    );
    expect(JSON.stringify(second.outputShapes)).toBe(
      JSON.stringify(planned.outputShapes)
    );
    expect(first.materialized?.entities.map((entity) => entity.id)).toEqual([
      "first-a",
      "first-b"
    ]);
    expect(second.materialized?.entities.map((entity) => entity.id)).toEqual([
      "second-a",
      "second-b"
    ]);
  });

  it("returns ordinary independent entities with no offset relation or constraints", () => {
    const plan = ready({
      entities: [circle("source", [0, 0], 5)],
      source: { kind: "entity", entityId: "source" },
      distance: 1,
      side: "outward",
      createdEntityIds: ["ordinary-circle"]
    });

    expect(plan.associative).toBe(false);
    expect(plan.constraints).toEqual([]);
    expect(plan.materialized?.entities).toEqual([
      {
        id: "ordinary-circle",
        kind: "circle",
        center: [0, 0],
        radius: 6,
        construction: false
      }
    ]);
    expect(JSON.stringify(plan)).not.toContain("parent");
    expect(JSON.stringify(plan)).not.toContain("offsetConstraint");
  });
});
