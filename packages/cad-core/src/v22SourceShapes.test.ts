import { describe, expect, it } from "vitest";
import type {
  SketchDimensionSnapshot,
  SketchDimensionSnapshotV22,
  SketchRegionsProfileRef
} from "@web-cad/cad-protocol";
import {
  cloneSketchDimensionSnapshotV22,
  cloneSketchRegionsProfileRef,
  compareSketchCanonicalKeys,
  downconvertSketchDimensionSnapshotV22,
  downconvertSketchProfileRefV22,
  getSketchDimensionTargetEntityIdsV22,
  getSketchDimensionTargetKeyV22,
  getSketchLoopCanonicalKey,
  normalizeSketchDimensionSnapshotV22,
  normalizeSketchProfileRefV22,
  normalizeSketchRegionsProfileRef,
  normalizeSketchWireLoopCyclicStart,
  reverseSketchWireLoop,
  sketchDimensionRequiresV22,
  sketchProfileRequiresV22
} from "./v22SourceShapes";

const legacyDimension: SketchDimensionSnapshot = {
  id: "skdim_1",
  name: "Width",
  sketchId: "sketch_1",
  entityId: "rect_1",
  target: { entityKind: "rectangle", role: "width" },
  valueSource: { type: "literal", value: 12 }
};

const regionsProfile: SketchRegionsProfileRef = {
  kind: "regions",
  sketchId: "sketch_1",
  regions: [
    {
      outer: {
        kind: "wire",
        segments: [
          { entityId: "line_b", orientation: "forward" },
          { entityId: "line_a", orientation: "reverse" }
        ]
      },
      holes: [
        { kind: "entity", entityId: "circle_z" },
        { kind: "entity", entityId: "circle_a" }
      ]
    },
    {
      outer: { kind: "entity", entityId: "circle_outer" },
      holes: []
    }
  ]
};

describe("V22 source shapes", () => {
  it("normalizes legacy dimensions and losslessly down-converts scalar targets", () => {
    const normalized = normalizeSketchDimensionSnapshotV22(legacyDimension);

    expect(normalized).toEqual({
      id: "skdim_1",
      name: "Width",
      sketchId: "sketch_1",
      target: {
        kind: "entityScalar",
        entityId: "rect_1",
        entityKind: "rectangle",
        role: "width"
      },
      valueSource: { type: "literal", value: 12 }
    });
    expect(downconvertSketchDimensionSnapshotV22(normalized)).toEqual(
      legacyDimension
    );
    expect(sketchDimensionRequiresV22(normalized)).toBe(false);
  });

  it("deep-clones normalized multi-entity dimensions and detects V22 triggers", () => {
    const dimension: SketchDimensionSnapshotV22 = {
      id: "skdim_2",
      name: "Distance",
      sketchId: "sketch_1",
      target: {
        kind: "pointPair",
        primary: {
          entityId: "line_a",
          entityKind: "line",
          role: "start"
        },
        secondary: {
          entityId: "arc_b",
          entityKind: "arc",
          role: "end"
        },
        measurement: "horizontal",
        direction: "negative"
      },
      valueSource: { type: "parameter", parameterId: "param_1" }
    };

    const clone = cloneSketchDimensionSnapshotV22(dimension);
    expect(clone).toEqual(dimension);
    expect(clone).not.toBe(dimension);
    expect(clone.target).not.toBe(dimension.target);
    if (
      clone.target.kind !== "pointPair" ||
      dimension.target.kind !== "pointPair"
    ) {
      throw new Error("Expected point-pair dimensions.");
    }
    expect(clone.target.primary).not.toBe(dimension.target.primary);
    expect(clone.target.secondary).not.toBe(dimension.target.secondary);
    expect(clone.valueSource).not.toBe(dimension.valueSource);
    expect(downconvertSketchDimensionSnapshotV22(clone)).toBeUndefined();
    expect(sketchDimensionRequiresV22(clone)).toBe(true);
    expect(getSketchDimensionTargetEntityIdsV22(clone.target)).toEqual([
      "line_a",
      "arc_b"
    ]);
    expect(getSketchDimensionTargetKeyV22("sketch_1", clone.target)).toBe(
      JSON.stringify([
        "sketch_1",
        "pointPair",
        "horizontal",
        "negative",
        "line_a",
        "line",
        "start",
        "arc_b",
        "arc",
        "end"
      ])
    );
  });

  it("creates target keys independent of JavaScript property insertion order", () => {
    const canonical = {
      kind: "entityScalar",
      entityId: "circle_1",
      entityKind: "circle",
      role: "radius"
    } as const;
    const reordered = {
      role: "radius",
      entityKind: "circle",
      entityId: "circle_1",
      kind: "entityScalar"
    } as const;

    expect(getSketchDimensionTargetKeyV22("sketch_1", reordered)).toBe(
      getSketchDimensionTargetKeyV22("sketch_1", canonical)
    );
  });

  it("retains diameter as a V22 trigger while allowing radius to lower", () => {
    const radius = normalizeSketchDimensionSnapshotV22({
      ...legacyDimension,
      entityId: "circle_1",
      target: { entityKind: "circle", role: "radius" }
    });
    const diameter: SketchDimensionSnapshotV22 = {
      ...radius,
      target: { ...radius.target, role: "diameter" }
    } as SketchDimensionSnapshotV22;

    expect(sketchDimensionRequiresV22(radius)).toBe(false);
    expect(downconvertSketchDimensionSnapshotV22(radius)).toMatchObject({
      entityId: "circle_1",
      target: { entityKind: "circle", role: "radius" }
    });
    expect(sketchDimensionRequiresV22(diameter)).toBe(true);
    expect(downconvertSketchDimensionSnapshotV22(diameter)).toBeUndefined();
  });

  it("deep-clones region profiles without sharing loop or segment arrays", () => {
    const clone = cloneSketchRegionsProfileRef(regionsProfile);

    expect(clone).toEqual(regionsProfile);
    expect(clone).not.toBe(regionsProfile);
    expect(clone.regions).not.toBe(regionsProfile.regions);
    expect(clone.regions[0]).not.toBe(regionsProfile.regions[0]);
    expect(clone.regions[0].outer).not.toBe(regionsProfile.regions[0].outer);
    expect(clone.regions[0].holes).not.toBe(regionsProfile.regions[0].holes);
    expect(sketchProfileRequiresV22(clone)).toBe(true);
    expect(downconvertSketchProfileRefV22(clone)).toBeUndefined();
    expect(
      sketchProfileRequiresV22({
        kind: "entity",
        sketchId: "sketch_1",
        entityId: "circle_1"
      })
    ).toBe(false);
    const wire = {
      kind: "wire" as const,
      sketchId: "sketch_1",
      segments: [
        { entityId: "line_2", orientation: "forward" as const },
        { entityId: "line_1", orientation: "reverse" as const }
      ]
    };
    expect(downconvertSketchProfileRefV22(wire)).toEqual(wire);
    expect(downconvertSketchProfileRefV22(wire)).not.toBe(wire);
  });

  it("normalizes cyclic starts, hole order, and region order deterministically", () => {
    const normalized = normalizeSketchRegionsProfileRef(regionsProfile);
    expect(normalizeSketchProfileRefV22(regionsProfile)).toEqual(normalized);

    expect(
      normalized.regions.map((region) =>
        getSketchLoopCanonicalKey(region.outer)
      )
    ).toEqual([
      '["entity","circle_outer"]',
      '["wire",["line_a","reverse"],["line_b","forward"]]'
    ]);
    expect(normalized.regions[1]?.holes.map(getSketchLoopCanonicalKey)).toEqual(
      ['["entity","circle_a"]', '["entity","circle_z"]']
    );
    expect(normalized.regions[1]?.outer).toEqual({
      kind: "wire",
      segments: [
        { entityId: "line_a", orientation: "reverse" },
        { entityId: "line_b", orientation: "forward" }
      ]
    });
    expect(regionsProfile.regions[0].outer).toEqual({
      kind: "wire",
      segments: [
        { entityId: "line_b", orientation: "forward" },
        { entityId: "line_a", orientation: "reverse" }
      ]
    });
  });

  it("uses collision-free loop keys and locale-independent canonical ordering", () => {
    const delimiterHeavy = getSketchLoopCanonicalKey({
      kind: "wire",
      segments: [
        { entityId: "a", orientation: "forward" },
        { entityId: "b:forward|c", orientation: "reverse" }
      ]
    });
    const formerlyColliding = getSketchLoopCanonicalKey({
      kind: "wire",
      segments: [
        { entityId: "a", orientation: "forward" },
        { entityId: "b", orientation: "forward" },
        { entityId: "c", orientation: "reverse" }
      ]
    });

    expect(delimiterHeavy).not.toBe(formerlyColliding);
    expect(compareSketchCanonicalKeys("Z", "a")).toBeLessThan(0);
    expect(
      normalizeSketchRegionsProfileRef({
        kind: "regions",
        sketchId: "sketch_1",
        regions: [
          { outer: { kind: "entity", entityId: "a" }, holes: [] },
          { outer: { kind: "entity", entityId: "Z" }, holes: [] }
        ]
      }).regions.map((region) => region.outer)
    ).toEqual([
      { kind: "entity", entityId: "Z" },
      { kind: "entity", entityId: "a" }
    ]);
  });

  it("supports a geometry-aware orientation callback without owning winding policy", () => {
    const normalized = normalizeSketchRegionsProfileRef(
      {
        kind: "regions",
        sketchId: "sketch_1",
        regions: [
          {
            outer: {
              kind: "wire",
              segments: [
                { entityId: "b", orientation: "forward" },
                { entityId: "a", orientation: "forward" }
              ]
            },
            holes: [
              {
                kind: "wire",
                segments: [
                  { entityId: "d", orientation: "forward" },
                  { entityId: "c", orientation: "forward" }
                ]
              }
            ]
          }
        ]
      },
      (loop, role) =>
        loop.kind === "wire" && role === "hole"
          ? reverseSketchWireLoop(loop)
          : loop
    );

    expect(normalized.regions[0].outer).toEqual({
      kind: "wire",
      segments: [
        { entityId: "a", orientation: "forward" },
        { entityId: "b", orientation: "forward" }
      ]
    });
    expect(normalized.regions[0].holes[0]).toEqual({
      kind: "wire",
      segments: [
        { entityId: "c", orientation: "reverse" },
        { entityId: "d", orientation: "reverse" }
      ]
    });
  });

  it("selects the lexicographically smallest cyclic wire sequence", () => {
    expect(
      normalizeSketchWireLoopCyclicStart({
        kind: "wire",
        segments: [
          { entityId: "z", orientation: "forward" },
          { entityId: "a", orientation: "reverse" },
          { entityId: "a", orientation: "forward" }
        ]
      })
    ).toEqual({
      kind: "wire",
      segments: [
        { entityId: "a", orientation: "forward" },
        { entityId: "z", orientation: "forward" },
        { entityId: "a", orientation: "reverse" }
      ]
    });
  });
});
