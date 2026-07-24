import { describe, expect, it } from "vitest";
import type {
  ExtrudeFeatureSnapshot,
  ExtrudeFeatureV22,
  LoftFeatureV22,
  SketchRegionsProfileRef,
  SweepFeatureV22
} from "@web-cad/cad-protocol";
import {
  cloneSketchProfileRef,
  getFeatureEntityProfileRef,
  getFeaturePrimaryEntityRef,
  getLoftSectionProfiles,
  getProfileConsumerRefs,
  getProfileEntityIds,
  getProfileEntityReferences,
  getProfileEntityRefs,
  normalizeFeatureInputs
} from "./normalizedFeatureInputs";

const regionsProfile: SketchRegionsProfileRef = {
  kind: "regions",
  sketchId: "sketch_regions",
  regions: [
    {
      outer: {
        kind: "wire",
        segments: [
          { entityId: "outer_a", orientation: "forward" },
          { entityId: "outer_b", orientation: "reverse" }
        ]
      },
      holes: [
        { kind: "entity", entityId: "hole_circle" },
        {
          kind: "wire",
          segments: [
            { entityId: "hole_a", orientation: "reverse" },
            { entityId: "hole_b", orientation: "forward" }
          ]
        }
      ]
    },
    {
      outer: { kind: "entity", entityId: "outer_circle" },
      holes: []
    }
  ]
};

describe("normalized feature inputs", () => {
  it("preserves legacy V20 entity-profile normalization", () => {
    const legacy: ExtrudeFeatureSnapshot = {
      id: "feat_1",
      kind: "extrude",
      sketchId: "sketch_1",
      entityId: "rect_1",
      profileKind: "rectangle",
      depth: 10,
      side: "positive",
      operationMode: "newBody",
      bodyId: "body_1"
    };

    expect(normalizeFeatureInputs(legacy)).toEqual({
      id: "feat_1",
      kind: "extrude",
      profile: {
        kind: "entity",
        sketchId: "sketch_1",
        entityId: "rect_1"
      },
      depth: 10,
      side: "positive",
      operationMode: "newBody",
      bodyId: "body_1"
    });
  });

  it("deep-clones V21 wire profiles without changing traversal", () => {
    const profile = {
      kind: "wire" as const,
      sketchId: "sketch_1",
      segments: [
        { entityId: "line_b", orientation: "reverse" as const },
        { entityId: "arc_a", orientation: "forward" as const }
      ]
    };
    const clone = cloneSketchProfileRef(profile);

    expect(clone).toEqual(profile);
    expect(clone).not.toBe(profile);
    if (clone.kind !== "wire") {
      throw new Error("Expected a wire profile.");
    }
    expect(clone.segments).not.toBe(profile.segments);
  });

  it("deep-clones V22 region profiles through normalized extrude input", () => {
    const feature: ExtrudeFeatureV22 = {
      id: "feat_regions",
      kind: "extrude",
      profile: regionsProfile,
      operationMode: "cut",
      targetBodyId: "body_target",
      depth: 4,
      side: "negative",
      bodyId: "body_result"
    };
    const normalized = normalizeFeatureInputs(feature);

    expect(normalized).toEqual(feature);
    expect(normalized).not.toBe(feature);
    if (normalized.kind !== "extrude") {
      throw new Error("Expected an extrude feature.");
    }
    expect(normalized.profile).not.toBe(feature.profile);
    if (normalized.profile.kind !== "regions") {
      throw new Error("Expected a regions profile.");
    }
    expect(normalized.profile.regions).not.toBe(regionsProfile.regions);
    expect(normalized.profile.regions[0].outer).not.toBe(
      regionsProfile.regions[0].outer
    );
  });

  it("flattens region boundaries in region, outer, hole, and segment order", () => {
    expect(getProfileEntityRefs(regionsProfile)).toEqual([
      {
        sketchId: "sketch_regions",
        entityId: "outer_a",
        orientation: "forward"
      },
      {
        sketchId: "sketch_regions",
        entityId: "outer_b",
        orientation: "reverse"
      },
      { sketchId: "sketch_regions", entityId: "hole_circle" },
      {
        sketchId: "sketch_regions",
        entityId: "hole_a",
        orientation: "reverse"
      },
      {
        sketchId: "sketch_regions",
        entityId: "hole_b",
        orientation: "forward"
      },
      { sketchId: "sketch_regions", entityId: "outer_circle" }
    ]);
    expect(getProfileEntityIds(regionsProfile)).toEqual([
      "outer_a",
      "outer_b",
      "hole_circle",
      "hole_a",
      "hole_b",
      "outer_circle"
    ]);
    expect(getProfileEntityReferences(regionsProfile)).toEqual([
      { sketchId: "sketch_regions", entityId: "outer_a" },
      { sketchId: "sketch_regions", entityId: "outer_b" },
      { sketchId: "sketch_regions", entityId: "hole_circle" },
      { sketchId: "sketch_regions", entityId: "hole_a" },
      { sketchId: "sketch_regions", entityId: "hole_b" },
      { sketchId: "sketch_regions", entityId: "outer_circle" }
    ]);
  });

  it("returns every region reference for extrude while reporting no primary entity", () => {
    const feature: ExtrudeFeatureV22 = {
      id: "feat_regions",
      kind: "extrude",
      profile: regionsProfile,
      operationMode: "newBody",
      depth: 4,
      side: "positive",
      bodyId: "body_result"
    };

    expect(getProfileConsumerRefs(feature)).toEqual(
      getProfileEntityRefs(regionsProfile)
    );
    expect(getFeatureEntityProfileRef(feature)).toBeUndefined();
    expect(getFeaturePrimaryEntityRef(feature)).toBeUndefined();
  });

  it("keeps sweep profiles and loft sections entity-narrow", () => {
    const sweep: SweepFeatureV22 = {
      id: "feat_sweep",
      kind: "sweep",
      profile: {
        kind: "entity",
        sketchId: "sketch_profile",
        entityId: "circle_profile"
      },
      path: {
        kind: "chain",
        sketchId: "sketch_path",
        segments: [
          { entityId: "path_a", orientation: "forward" },
          { entityId: "path_b", orientation: "reverse" }
        ]
      },
      bodyId: "body_sweep"
    };
    const loft: LoftFeatureV22 = {
      id: "feat_loft",
      kind: "loft",
      sections: [
        {
          profile: {
            kind: "entity",
            sketchId: "sketch_a",
            entityId: "circle_a"
          }
        },
        {
          profile: {
            kind: "entity",
            sketchId: "sketch_b",
            entityId: "circle_b"
          }
        }
      ],
      bodyId: "body_loft"
    };

    expect(getProfileConsumerRefs(sweep)).toEqual([
      { sketchId: "sketch_profile", entityId: "circle_profile" },
      {
        sketchId: "sketch_path",
        entityId: "path_a",
        orientation: "forward"
      },
      {
        sketchId: "sketch_path",
        entityId: "path_b",
        orientation: "reverse"
      }
    ]);
    expect(getLoftSectionProfiles(loft)).toEqual([
      {
        kind: "entity",
        sketchId: "sketch_a",
        entityId: "circle_a"
      },
      {
        kind: "entity",
        sketchId: "sketch_b",
        entityId: "circle_b"
      }
    ]);
  });
});
