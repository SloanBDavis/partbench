import {
  CAD_V19_RESOURCE_LIMITS,
  type OrientedSketchSegmentRef,
  type SketchEntitySnapshot,
  type SketchLoopRef,
  type SketchProfileRegionRef,
  type SketchRegionsProfileRef
} from "@web-cad/cad-protocol";
import { describe, expect, it } from "vitest";

import { SKETCH_GEOMETRY_POLICY } from "./sketchGeometryPolicy";
import {
  createSketchProfileRegionValidateResponse,
  validateV22RegionSource,
  type V22RegionSourceSketch
} from "./v22RegionSourceValidation";

function rectangle(
  id: string,
  center: readonly [number, number],
  width: number,
  height: number
): SketchEntitySnapshot {
  return {
    id,
    kind: "rectangle",
    center,
    width,
    height,
    construction: false
  };
}

function circle(
  id: string,
  center: readonly [number, number],
  radius: number
): SketchEntitySnapshot {
  return {
    id,
    kind: "circle",
    center,
    radius,
    construction: false
  };
}

function line(
  id: string,
  start: readonly [number, number],
  end: readonly [number, number]
): SketchEntitySnapshot {
  return {
    id,
    kind: "line",
    start,
    end,
    construction: false
  };
}

function entities(
  ...values: readonly SketchEntitySnapshot[]
): V22RegionSourceSketch {
  return {
    id: "sketch",
    entities: new Map(values.map((value) => [value.id, value]))
  };
}

function entityLoop(entityId: string): SketchLoopRef {
  return { kind: "entity", entityId };
}

function wireLoop(
  ...references: readonly (readonly [
    entityId: string,
    orientation?: "forward" | "reverse"
  ])[]
): SketchLoopRef {
  return {
    kind: "wire",
    segments: references.map(([entityId, orientation = "forward"]) => ({
      entityId,
      orientation
    }))
  };
}

function profile(
  first: SketchProfileRegionRef,
  ...rest: readonly SketchProfileRegionRef[]
): SketchRegionsProfileRef {
  return {
    kind: "regions",
    sketchId: "sketch",
    regions: [first, ...rest]
  };
}

function issueCodes(
  result: ReturnType<typeof validateV22RegionSource>
): readonly string[] {
  return result.issues.map((issue) => issue.code);
}

describe("validateV22RegionSource", () => {
  it("accepts an outer with disjoint holes and canonicalizes hole order", () => {
    const source = entities(
      rectangle("outer", [0, 0], 20, 20),
      circle("z-hole", [-4, 0], 1),
      circle("a-hole", [4, 0], 1)
    );
    const result = validateV22RegionSource(
      profile({
        outer: entityLoop("outer"),
        holes: [entityLoop("z-hole"), entityLoop("a-hole")]
      }),
      source
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.normalizedProfile.regions[0].holes).toEqual([
      entityLoop("a-hole"),
      entityLoop("z-hole")
    ]);
    expect(result.normalization.holeOrderChanged).toBe(true);
    expect(result.materialAreas[0]).toBeCloseTo(400 - 2 * Math.PI);

    const canonicalOrder = validateV22RegionSource(
      profile({
        outer: entityLoop("outer"),
        holes: [entityLoop("a-hole"), entityLoop("z-hole")]
      }),
      source
    );
    expect(canonicalOrder.ok).toBe(true);
    if (!canonicalOrder.ok) return;
    expect(result.normalizedProfile).toEqual(canonicalOrder.normalizedProfile);
    expect(result.complexity.predicateVisitCount).toBe(
      canonicalOrder.complexity.predicateVisitCount
    );
  });

  it("normalizes a reversed wire outer and its cyclic start deterministically", () => {
    const source = entities(
      line("a", [-2, -2], [2, -2]),
      line("b", [2, -2], [2, 2]),
      line("c", [2, 2], [-2, 2]),
      line("d", [-2, 2], [-2, -2])
    );
    const result = validateV22RegionSource(
      profile({
        outer: wireLoop(
          ["c", "reverse"],
          ["b", "reverse"],
          ["a", "reverse"],
          ["d", "reverse"]
        ),
        holes: []
      }),
      source
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.normalizedProfile.regions[0].outer).toEqual(
      wireLoop(["a"], ["b"], ["c"], ["d"])
    );
    expect(result.normalization).toMatchObject({
      orientationChanged: true,
      cyclicStartChanged: true,
      outerOrientationsChanged: [result.loopSummaries[0]!.loopKey],
      holeOrientationsChanged: [],
      cyclicStartsChanged: [result.loopSummaries[0]!.loopKey]
    });
    expect(result.loopSummaries[0]).toMatchObject({
      signedArea: 16,
      absoluteArea: 16,
      containmentDepth: 0
    });
  });

  it("orders canonical cyclic starts by raw tuple fields for escaped IDs", () => {
    const source = entities(
      line('"', [-2, -2], [2, -2]),
      line("A", [2, -2], [2, 2]),
      line("b", [2, 2], [-2, 2]),
      line("c", [-2, 2], [-2, -2])
    );
    const result = validateV22RegionSource(
      profile({
        outer: wireLoop(["A"], ["b"], ["c"], ['"']),
        holes: []
      }),
      source
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.normalizedProfile.regions[0].outer).toEqual(
      wireLoop(['"'], ["A"], ["b"], ["c"])
    );
  });

  it("accepts a closed analytic arc wire without polygonizing it", () => {
    const source = entities(
      {
        id: "upper",
        kind: "arc",
        center: [0, 0],
        radius: 5,
        startAngleDegrees: 0,
        sweepAngleDegrees: 180,
        construction: false
      },
      {
        id: "lower",
        kind: "arc",
        center: [0, 0],
        radius: 5,
        startAngleDegrees: 180,
        sweepAngleDegrees: 180,
        construction: false
      }
    );
    const result = validateV22RegionSource(
      profile({
        outer: wireLoop(["upper"], ["lower"]),
        holes: []
      }),
      source
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.materialAreas[0]).toBeCloseTo(25 * Math.PI);
  });

  it("rejects open and self-crossing wire loops", () => {
    const open = validateV22RegionSource(
      profile({
        outer: wireLoop(["a"], ["b"], ["c"]),
        holes: []
      }),
      entities(
        line("a", [0, 0], [2, 0]),
        line("b", [2, 0], [2, 2]),
        line("c", [2, 2], [0, 1])
      )
    );
    expect(issueCodes(open)).toContain("SKETCH_REGION_LOOP_OPEN");

    const crossing = validateV22RegionSource(
      profile({
        outer: wireLoop(["a"], ["b"], ["c"], ["d"]),
        holes: []
      }),
      entities(
        line("a", [0, 0], [2, 2]),
        line("b", [2, 2], [0, 2]),
        line("c", [0, 2], [2, 0]),
        line("d", [2, 0], [0, 0])
      )
    );
    expect(issueCodes(crossing)).toContain("SKETCH_REGION_LOOP_INTERSECTION");
  });

  it("rejects touching and outside holes", () => {
    const source = entities(
      rectangle("outer", [0, 0], 10, 10),
      circle("touching", [4, 0], 1),
      circle("outside", [8, 0], 1)
    );
    const touching = validateV22RegionSource(
      profile({
        outer: entityLoop("outer"),
        holes: [entityLoop("touching")]
      }),
      source
    );
    expect(issueCodes(touching)).toContain("SKETCH_REGION_BOUNDARY_TOUCHING");

    const outside = validateV22RegionSource(
      profile({
        outer: entityLoop("outer"),
        holes: [entityLoop("outside")]
      }),
      source
    );
    expect(issueCodes(outside)).toContain("SKETCH_REGION_HOLE_OUTSIDE");

    const containingOuter = validateV22RegionSource(
      profile({
        outer: entityLoop("small-outer"),
        holes: [entityLoop("too-large-hole")]
      }),
      entities(
        circle("small-outer", [0, 0], 2),
        circle("too-large-hole", [0, 0], 3)
      )
    );
    expect(issueCodes(containingOuter)).toContain("SKETCH_REGION_HOLE_OUTSIDE");
  });

  it("measures interior line-arc clearance rather than only endpoints", () => {
    const createSource = (gap: number) =>
      entities(
        rectangle("outer", [0, 0], 20, 10),
        {
          id: "upper",
          kind: "arc",
          center: [0, 0],
          radius: 5 - gap,
          startAngleDegrees: 0,
          sweepAngleDegrees: 180,
          construction: false
        },
        {
          id: "lower",
          kind: "arc",
          center: [0, 0],
          radius: 5 - gap,
          startAngleDegrees: 180,
          sweepAngleDegrees: 180,
          construction: false
        }
      );
    const submitted = profile({
      outer: entityLoop("outer"),
      holes: [wireLoop(["upper"], ["lower"])]
    });

    expect(
      issueCodes(
        validateV22RegionSource(
          submitted,
          createSource(SKETCH_GEOMETRY_POLICY.linearTolerance / 2)
        )
      )
    ).toContain("SKETCH_REGION_BOUNDARY_TOUCHING");
    expect(
      validateV22RegionSource(
        submitted,
        createSource(SKETCH_GEOMETRY_POLICY.linearTolerance * 2)
      ).ok
    ).toBe(true);
  });

  it("rejects overlapping, touching, and nested sibling holes", () => {
    const source = entities(
      rectangle("outer", [0, 0], 30, 30),
      circle("left", [-1, 0], 3),
      circle("right", [1, 0], 3),
      circle("touch", [4, 0], 2),
      circle("large", [0, 0], 6),
      circle("small", [0, 0], 1)
    );
    const overlapping = validateV22RegionSource(
      profile({
        outer: entityLoop("outer"),
        holes: [entityLoop("left"), entityLoop("right")]
      }),
      source
    );
    expect(issueCodes(overlapping)).toContain("SKETCH_REGION_HOLES_OVERLAP");

    const touching = validateV22RegionSource(
      profile({
        outer: entityLoop("outer"),
        holes: [entityLoop("left"), entityLoop("touch")]
      }),
      source
    );
    expect(issueCodes(touching)).toContain("SKETCH_REGION_HOLES_OVERLAP");

    const nested = validateV22RegionSource(
      profile({
        outer: entityLoop("outer"),
        holes: [entityLoop("large"), entityLoop("small")]
      }),
      source
    );
    expect(issueCodes(nested)).toContain("SKETCH_REGION_NESTING_UNSUPPORTED");
  });

  it("rejects overlapping material but permits a region strictly inside another region's hole", () => {
    const source = entities(
      circle("outer-a", [0, 0], 10),
      circle("hole-a", [0, 0], 5),
      circle("overlap", [7, 0], 1),
      circle("island", [0, 0], 2)
    );
    const overlap = validateV22RegionSource(
      profile(
        {
          outer: entityLoop("outer-a"),
          holes: [entityLoop("hole-a")]
        },
        { outer: entityLoop("overlap"), holes: [] }
      ),
      source
    );
    expect(issueCodes(overlap)).toContain("SKETCH_REGION_MATERIAL_OVERLAP");

    const disjoint = validateV22RegionSource(
      profile(
        {
          outer: entityLoop("outer-a"),
          holes: [entityLoop("hole-a")]
        },
        { outer: entityLoop("island"), holes: [] }
      ),
      source
    );
    expect(disjoint.ok).toBe(true);
    if (!disjoint.ok) return;
    const depthByLoopKey = new Map(
      disjoint.loopSummaries.map((summary) => [
        summary.loopKey,
        summary.containmentDepth
      ])
    );
    expect(depthByLoopKey).toEqual(
      new Map([
        [JSON.stringify(["entity", "outer-a"]), 0],
        [JSON.stringify(["entity", "hole-a"]), 1],
        [JSON.stringify(["entity", "island"]), 2]
      ])
    );
  });

  it("materializes exact public validation diagnostics without mutation", () => {
    const requested = profile({
      outer: entityLoop("missing"),
      holes: []
    });
    const before = structuredClone(requested);
    const response = createSketchProfileRegionValidateResponse(
      requested,
      entities(),
      "cadops.v1"
    );

    expect(response).toMatchObject({
      ok: true,
      query: "sketch.profileRegionValidate",
      cadOpsVersion: "cadops.v1",
      status: "blocked",
      requestedProfile: before,
      loopSummaries: [],
      materialAreas: [],
      diagnostics: [
        {
          code: "SKETCH_REGION_ENTITY_MISSING",
          severity: "blocker",
          sketchId: "sketch",
          entityId: "missing"
        }
      ]
    });
    expect(requested).toEqual(before);
  });

  it("rejects a profile evaluated against a different sketch scope", () => {
    const requested = profile({
      outer: entityLoop("outer"),
      holes: []
    });
    const result = validateV22RegionSource(requested, {
      id: "other-sketch",
      entities: new Map([["outer", rectangle("outer", [0, 0], 10, 10)]])
    });

    expect(issueCodes(result)).toContain("SKETCH_REGION_SKETCH_MISMATCH");
    expect(result.complexity.predicateVisitCount).toBe(0);
  });

  it("reports entity loops as loops, not wire segment references", () => {
    const requested = profile({
      outer: entityLoop("outer"),
      holes: [entityLoop("hole")]
    });
    const response = createSketchProfileRegionValidateResponse(
      requested,
      entities(circle("outer", [0, 0], 10), circle("hole", [0, 0], 2)),
      "cadops.v1"
    );

    expect(response.status).toBe("ready");
    expect(response.complexity).toMatchObject({
      regionCount: 1,
      loopCount: 2,
      segmentReferenceCount: 0
    });
  });

  it("rejects repeated members, construction source, and too little material area", () => {
    const repeated = validateV22RegionSource(
      profile({
        outer: entityLoop("outer"),
        holes: [entityLoop("outer")]
      }),
      entities(rectangle("outer", [0, 0], 10, 10))
    );
    expect(issueCodes(repeated)).toContain("SKETCH_REGION_ENTITY_REPEATED");

    const constructionEntity = {
      ...circle("construction", [0, 0], 5),
      construction: true
    } satisfies SketchEntitySnapshot;
    const construction = validateV22RegionSource(
      profile({ outer: entityLoop("construction"), holes: [] }),
      entities(constructionEntity)
    );
    expect(issueCodes(construction)).toContain(
      "SKETCH_REGION_CONSTRUCTION_ENTITY"
    );

    const smallMaterial = validateV22RegionSource(
      profile({
        outer: entityLoop("outer"),
        holes: [entityLoop("hole")]
      }),
      entities(circle("outer", [0, 0], 1), circle("hole", [0, 0], 0.99)),
      { ...SKETCH_GEOMETRY_POLICY, minimumProfileArea: 0.1 }
    );
    expect(issueCodes(smallMaterial)).toContain(
      "SKETCH_REGION_LOOP_AREA_TOO_SMALL"
    );
  });

  it("rejects finite parameters that overflow derived rectangle boundary geometry", () => {
    const hugeRectangle = rectangle("huge", [Number.MAX_VALUE, 0], 1e308, 1e-6);
    const result = validateV22RegionSource(
      profile({ outer: entityLoop("huge"), holes: [] }),
      entities(hugeRectangle)
    );

    expect(issueCodes(result)).toContain("SKETCH_REGION_ENTITY_UNSUPPORTED");
  });

  it("is independent of region order and entity-map insertion order", () => {
    const left = rectangle("left", [-10, 0], 4, 4);
    const right = rectangle("right", [10, 0], 4, 4);
    const forward = validateV22RegionSource(
      profile(
        { outer: entityLoop("right"), holes: [] },
        { outer: entityLoop("left"), holes: [] }
      ),
      entities(left, right)
    );
    const reordered = validateV22RegionSource(
      profile(
        { holes: [], outer: entityLoop("left") },
        { holes: [], outer: entityLoop("right") }
      ),
      entities(right, left)
    );

    expect(forward.ok).toBe(true);
    expect(reordered.ok).toBe(true);
    if (!forward.ok || !reordered.ok) return;
    expect(forward.normalizedProfile).toEqual(reordered.normalizedProfile);
    expect(forward.complexity.predicateVisitCount).toBe(
      reordered.complexity.predicateVisitCount
    );
    expect(forward.normalization.regionOrderChanged).toBe(true);
    expect(reordered.normalization.regionOrderChanged).toBe(false);
  });

  it("enforces structural and analytic predicate limits without partial success", () => {
    const overRegionLimitValues = Array.from({ length: 257 }, (_, index) => ({
      outer: entityLoop(`r${index}`),
      holes: []
    }));
    const [firstOverLimitRegion, ...remainingOverLimitRegions] =
      overRegionLimitValues;
    if (!firstOverLimitRegion) throw new Error("Fixture must not be empty.");
    const structural = validateV22RegionSource(
      {
        kind: "regions",
        sketchId: "sketch",
        regions: [firstOverLimitRegion, ...remainingOverLimitRegions]
      },
      entities()
    );
    expect(issueCodes(structural)).toEqual(["SKETCH_REGION_COMPLEXITY_LIMIT"]);
    expect(structural.complexity.predicateVisitCount).toBe(0);

    const manyEntities = Array.from({ length: 256 }, (_, index) =>
      rectangle(`r${String(index).padStart(3, "0")}`, [index * 10, 0], 2, 2)
    );
    const analytic = validateV22RegionSource(
      profile(
        { outer: entityLoop(manyEntities[0]!.id), holes: [] },
        ...manyEntities.slice(1).map((entity) => ({
          outer: entityLoop(entity.id),
          holes: []
        }))
      ),
      entities(...manyEntities)
    );
    expect(issueCodes(analytic)).toContain("SKETCH_REGION_COMPLEXITY_LIMIT");
    expect(analytic.complexity.predicateVisitCount).toBe(100_001);
  });

  it("enforces exact sketch-entity, loop, and segment-reference boundaries", () => {
    const entityLimit =
      CAD_V19_RESOURCE_LIMITS.maxSketchEntitiesPerEditedSketch;
    const atEntityLimit = Array.from({ length: entityLimit }, (_, index) =>
      rectangle(`entity_${index}`, [index * 3, 0], 1, 1)
    );
    expect(
      issueCodes(
        validateV22RegionSource(
          profile({ outer: entityLoop("entity_0"), holes: [] }),
          entities(...atEntityLimit)
        )
      )
    ).not.toContain("SKETCH_REGION_COMPLEXITY_LIMIT");
    expect(
      issueCodes(
        validateV22RegionSource(
          profile({ outer: entityLoop("entity_0"), holes: [] }),
          entities(
            ...atEntityLimit,
            rectangle("entity_over_limit", [entityLimit * 3, 0], 1, 1)
          )
        )
      )
    ).toContain("SKETCH_REGION_COMPLEXITY_LIMIT");

    const loopLimit = CAD_V19_RESOURCE_LIMITS.maxLoopsPerProfile;
    const atLoopLimit = profile({
      outer: entityLoop("outer"),
      holes: Array.from({ length: loopLimit - 1 }, (_, index) =>
        entityLoop(`hole_${index}`)
      )
    });
    expect(
      issueCodes(validateV22RegionSource(atLoopLimit, entities()))
    ).not.toContain("SKETCH_REGION_COMPLEXITY_LIMIT");
    expect(
      issueCodes(
        validateV22RegionSource(
          profile({
            outer: entityLoop("outer"),
            holes: Array.from({ length: loopLimit }, (_, index) =>
              entityLoop(`hole_${index}`)
            )
          }),
          entities()
        )
      )
    ).toContain("SKETCH_REGION_COMPLEXITY_LIMIT");

    const segmentLimit = CAD_V19_RESOURCE_LIMITS.maxSegmentReferencesPerProfile;
    const segments = Array.from(
      { length: segmentLimit },
      (_, index): OrientedSketchSegmentRef => ({
        entityId: `segment_${index}`,
        orientation: "forward"
      })
    );
    expect(
      issueCodes(
        validateV22RegionSource(
          profile({
            outer: { kind: "wire", segments },
            holes: []
          }),
          entities()
        )
      )
    ).not.toContain("SKETCH_REGION_COMPLEXITY_LIMIT");
    expect(
      issueCodes(
        validateV22RegionSource(
          profile({
            outer: {
              kind: "wire",
              segments: [
                ...segments,
                {
                  entityId: "segment_over_limit",
                  orientation: "forward"
                }
              ]
            },
            holes: []
          }),
          entities()
        )
      )
    ).toContain("SKETCH_REGION_COMPLEXITY_LIMIT");
  });
});
