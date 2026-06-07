import type { CadFeatureSummary } from "@web-cad/cad-protocol";
import { describe, expect, it } from "vitest";
import {
  formatSketchEntityUsageLabel,
  getSketchEntityExtrudeUsages
} from "./sketchEntityUsage";

describe("sketch entity usage helpers", () => {
  it("finds authored extrudes driven by a sketch entity", () => {
    const features: CadFeatureSummary[] = [
      {
        id: "feature:box_1",
        kind: "primitive",
        partId: "part:default",
        primitive: "box",
        objectId: "box_1",
        bodyId: "body:box_1",
        dimensions: { width: 1, height: 1, depth: 1 },
        transform: {
          translation: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1]
        },
        source: { type: "sceneObject" }
      },
      {
        id: "feat_rect",
        kind: "extrude",
        partId: "part:default",
        bodyId: "body_rect",
        name: "Rib",
        sketchId: "sketch_1",
        entityId: "rect_1",
        profileKind: "rectangle",
        depth: 2,
        side: "positive",
        operationMode: "newBody",
        source: {
          type: "sketchEntity",
          sketchId: "sketch_1",
          entityId: "rect_1"
        }
      }
    ];

    const usages = getSketchEntityExtrudeUsages(features, "sketch_1", "rect_1");

    expect(usages).toEqual([
      {
        featureId: "feat_rect",
        featureKind: "extrude",
        bodyId: "body_rect",
        featureName: "Rib",
        role: "profile"
      }
    ]);
    expect(formatSketchEntityUsageLabel(usages)).toBe(
      "Drives Rib -> body_rect"
    );
    expect(
      formatSketchEntityUsageLabel(
        getSketchEntityExtrudeUsages(features, "sketch_1", "unused")
      )
    ).toBeUndefined();
  });

  it("formats multiple extrude usages compactly", () => {
    expect(
      formatSketchEntityUsageLabel([
        {
          featureId: "feat_a",
          featureKind: "extrude",
          bodyId: "body_a",
          role: "profile"
        },
        {
          featureId: "feat_b",
          featureKind: "revolve",
          bodyId: "body_b",
          role: "axis"
        }
      ])
    ).toBe("Used by 2 features");
  });

  it("finds revolve axis usage for line entities", () => {
    const features: CadFeatureSummary[] = [
      {
        id: "feat_revolve",
        kind: "revolve",
        partId: "part:default",
        bodyId: "body_revolve",
        sketchId: "sketch_1",
        entityId: "rect_1",
        profileKind: "rectangle",
        axis: {
          type: "sketchLine",
          sketchId: "sketch_1",
          entityId: "axis_1"
        },
        angleDegrees: 360,
        operationMode: "newBody",
        source: {
          type: "sketchEntityWithAxis",
          sketchId: "sketch_1",
          entityId: "rect_1",
          axis: {
            type: "sketchLine",
            sketchId: "sketch_1",
            entityId: "axis_1"
          }
        }
      }
    ];

    const usages = getSketchEntityExtrudeUsages(features, "sketch_1", "axis_1");

    expect(usages).toEqual([
      {
        featureId: "feat_revolve",
        featureKind: "revolve",
        bodyId: "body_revolve",
        role: "axis"
      }
    ]);
    expect(formatSketchEntityUsageLabel(usages)).toBe(
      "Axis for feat_revolve -> body_revolve"
    );
  });
});
