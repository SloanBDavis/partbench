import { describe, expect, it } from "vitest";
import type { FeatureSnapshotV22 } from "@web-cad/cad-protocol";

import { collectSketchCurveEditFeatureDependencies } from "./sketchCurveEditDependencies";

describe("V19 curve-edit feature dependencies", () => {
  it("covers region loops, sweep paths, revolve axes, loft sections, and holes", () => {
    const features: FeatureSnapshotV22[] = [
      {
        id: "feature_regions",
        kind: "extrude",
        bodyId: "body_regions",
        profile: {
          kind: "regions",
          sketchId: "sketch_1",
          regions: [
            {
              outer: {
                kind: "wire",
                segments: [
                  { entityId: "outer_1", orientation: "forward" },
                  { entityId: "deleted", orientation: "forward" }
                ]
              },
              holes: [{ kind: "entity", entityId: "hole_loop" }]
            }
          ]
        },
        depth: 5,
        side: "positive",
        operationMode: "newBody"
      },
      {
        id: "feature_sweep",
        kind: "sweep",
        bodyId: "body_sweep",
        profile: {
          kind: "entity",
          sketchId: "sketch_2",
          entityId: "profile"
        },
        path: {
          kind: "chain",
          sketchId: "sketch_1",
          segments: [
            { entityId: "deleted", orientation: "forward" },
            { entityId: "path_2", orientation: "forward" }
          ]
        }
      },
      {
        id: "feature_revolve",
        kind: "revolve",
        bodyId: "body_revolve",
        profile: {
          kind: "entity",
          sketchId: "sketch_2",
          entityId: "profile"
        },
        axis: {
          type: "sketchLine",
          sketchId: "sketch_1",
          entityId: "deleted"
        },
        angleDegrees: 180,
        operationMode: "newBody"
      },
      {
        id: "feature_loft",
        kind: "loft",
        bodyId: "body_loft",
        sections: [
          {
            profile: {
              kind: "entity",
              sketchId: "sketch_1",
              entityId: "deleted"
            }
          },
          {
            profile: {
              kind: "entity",
              sketchId: "sketch_2",
              entityId: "other"
            }
          }
        ]
      },
      {
        id: "feature_hole",
        kind: "hole",
        bodyId: "body_hole",
        targetBodyId: "body_target",
        sketchId: "sketch_1",
        circleEntityId: "deleted",
        depthMode: "throughAll",
        direction: "positive"
      }
    ];

    expect(
      collectSketchCurveEditFeatureDependencies(
        features,
        "sketch_1",
        new Set(["deleted"])
      )
    ).toEqual([
      {
        featureId: "feature_hole",
        roles: ["hole-center"],
        referencedEntityIds: ["deleted"]
      },
      {
        featureId: "feature_loft",
        roles: ["profile"],
        referencedEntityIds: ["deleted"]
      },
      {
        featureId: "feature_regions",
        roles: ["profile"],
        referencedEntityIds: ["deleted"]
      },
      {
        featureId: "feature_revolve",
        roles: ["axis"],
        referencedEntityIds: ["deleted"]
      },
      {
        featureId: "feature_sweep",
        roles: ["path"],
        referencedEntityIds: ["deleted"]
      }
    ]);
  });

  it("does not report unrelated boundaries or other sketches", () => {
    const feature: FeatureSnapshotV22 = {
      id: "feature_1",
      kind: "extrude",
      bodyId: "body_1",
      profile: {
        kind: "entity",
        sketchId: "sketch_2",
        entityId: "same_id"
      },
      depth: 2,
      side: "positive",
      operationMode: "newBody"
    };

    expect(
      collectSketchCurveEditFeatureDependencies([feature], "sketch_1", [
        "same_id"
      ])
    ).toEqual([]);
  });
});
