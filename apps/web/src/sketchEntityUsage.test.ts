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
        bodyId: "body_rect",
        featureName: "Rib"
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
        { featureId: "feat_a", bodyId: "body_a" },
        { featureId: "feat_b", bodyId: "body_b" }
      ])
    ).toBe("Drives 2 extrudes");
  });
});
