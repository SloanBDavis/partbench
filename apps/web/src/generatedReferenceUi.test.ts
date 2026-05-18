import { describe, expect, it } from "vitest";
import type { CadGeneratedFaceReference } from "@web-cad/cad-protocol";
import {
  canCreateSketchOnFace,
  createSketchOnFaceDefaultName,
  formatGeneratedFaceEligibility,
  formatSketchAttachmentLabel,
  getSketchAttachableFaces
} from "./generatedReferenceUi";

const startCap = createFace({
  role: "startCap",
  stableId: "generated:face:body_1:startCap",
  label: "Start cap",
  eligibleOperations: [
    "feature.attachSketchPlane",
    "feature.measureReference",
    "feature.selectReference"
  ]
});

const circularSide = createFace({
  role: "side:circular",
  stableId: "generated:face:body_1:side:circular",
  label: "Circular side face",
  eligibleOperations: ["feature.measureReference", "feature.selectReference"],
  eligibilityNotes: [
    "Circular side faces are not planar and are not eligible for sketch-plane attachment."
  ]
});

describe("generated reference UI helpers", () => {
  it("filters only faces eligible for sketch-plane attachment", () => {
    expect(canCreateSketchOnFace(startCap)).toBe(true);
    expect(canCreateSketchOnFace(circularSide)).toBe(false);
    expect(getSketchAttachableFaces([startCap, circularSide])).toEqual([
      startCap
    ]);
  });

  it("formats generated face labels and eligibility text", () => {
    expect(createSketchOnFaceDefaultName(startCap)).toBe("Start cap sketch");
    expect(formatGeneratedFaceEligibility(startCap)).toBe("Sketch plane");
    expect(formatGeneratedFaceEligibility(circularSide)).toBe(
      "Circular side faces are not planar and are not eligible for sketch-plane attachment."
    );
  });

  it("formats attached sketch metadata", () => {
    expect(
      formatSketchAttachmentLabel({
        kind: "generatedFace",
        bodyId: "body_1",
        faceStableId: "generated:face:body_1:endCap",
        sourceFeatureId: "feat_1",
        sourceSketchId: "sketch_1",
        sourceSketchEntityId: "rect_1",
        faceRole: "endCap"
      })
    ).toBe("endCap on body_1");
  });
});

function createFace(
  overrides: Pick<
    CadGeneratedFaceReference,
    "role" | "stableId" | "label" | "eligibleOperations" | "eligibilityNotes"
  >
): CadGeneratedFaceReference {
  return {
    kind: "face",
    bodyId: "body_1",
    ownerPartId: "part:default",
    sourceFeatureId: "feat_1",
    sourceSketchId: "sketch_1",
    sourceSketchEntityId: "rect_1",
    description: `${overrides.label} description`,
    geometricSignature: {
      profileKind: "rectangle",
      sketchPlane: "XY",
      extrudeSide: "positive",
      depth: 1
    },
    ...overrides
  };
}
