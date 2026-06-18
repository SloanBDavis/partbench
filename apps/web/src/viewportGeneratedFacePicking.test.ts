import type {
  CadGeneratedExtrudeFaceRole,
  CadGeneratedFaceReference
} from "@web-cad/cad-protocol";
import { createDefaultCamera, projectPoint } from "@web-cad/renderer";
import { describe, expect, it } from "vitest";
import { createViewportGeneratedPlanarFaceHitCandidate } from "./viewportGeneratedFacePicking";

describe("viewport generated face picking", () => {
  const camera = createDefaultCamera();
  const size = { width: 800, height: 600 };

  it("creates private hit candidates for supported generated rectangle planar faces", () => {
    const faces = createRectangleFaces("body_rect");
    const point = projectPoint([2, 0, 1.5], camera, size);

    expect(point).toBeDefined();

    const candidate = createViewportGeneratedPlanarFaceHitCandidate({
      camera,
      faces,
      pickedRenderId: "body_rect",
      point: { x: point?.x ?? 0, y: point?.y ?? 0 },
      preferredBodyId: "body_rect",
      size
    });

    expect(candidate).toMatchObject({
      displayEntityKind: "face",
      semanticHint: {
        type: "generatedReference",
        bodyId: "body_rect",
        stableId: "generated:face:body_rect:side:uMax",
        expectedKind: "face"
      },
      precision: "displayApproximation"
    });
    expect(candidate?.rendererHitId).toContain("renderer-hit");
    expect(JSON.stringify(candidate?.semanticHint)).not.toContain(
      "renderer-hit"
    );
  });

  it("requires a resolved target body but not the previously selected body", () => {
    const point = projectPoint([2, 0, 1.5], camera, size);
    const faces = createRectangleFaces("body_rect");

    expect(
      createViewportGeneratedPlanarFaceHitCandidate({
        camera,
        faces,
        pickedRenderId: "body_rect",
        point: { x: point?.x ?? 0, y: point?.y ?? 0 },
        size
      })
    ).toBeUndefined();
    expect(
      createViewportGeneratedPlanarFaceHitCandidate({
        camera,
        faces,
        pickedRenderId: "body_other",
        point: { x: point?.x ?? 0, y: point?.y ?? 0 },
        targetBodyId: "body_rect",
        size
      })
    ).toMatchObject({
      displayEntityKind: "face",
      semanticHint: {
        type: "generatedReference",
        bodyId: "body_rect",
        expectedKind: "face"
      }
    });
  });

  it("supports generated circle cap faces but not the cylindrical side face", () => {
    const point = projectPoint([0, 0, 3], camera, size);
    const capCandidate = createViewportGeneratedPlanarFaceHitCandidate({
      camera,
      faces: [createCircleFace("body_circle", "endCap")],
      pickedRenderId: "body_circle",
      point: { x: point?.x ?? 0, y: point?.y ?? 0 },
      preferredBodyId: "body_circle",
      size
    });
    const sideCandidate = createViewportGeneratedPlanarFaceHitCandidate({
      camera,
      faces: [createCircleFace("body_circle", "side:circular")],
      pickedRenderId: "body_circle",
      point: { x: point?.x ?? 0, y: point?.y ?? 0 },
      preferredBodyId: "body_circle",
      size
    });

    expect(capCandidate?.semanticHint).toEqual({
      type: "generatedReference",
      bodyId: "body_circle",
      stableId: "generated:face:body_circle:endCap",
      expectedKind: "face"
    });
    expect(sideCandidate).toBeUndefined();
  });
});

function createRectangleFaces(
  bodyId: string
): readonly CadGeneratedFaceReference[] {
  return [
    "startCap",
    "endCap",
    "side:uMin",
    "side:uMax",
    "side:vMin",
    "side:vMax"
  ].map((role) =>
    createRectangleFace(bodyId, role as CadGeneratedExtrudeFaceRole)
  );
}

function createRectangleFace(
  bodyId: string,
  role: CadGeneratedExtrudeFaceRole
): CadGeneratedFaceReference {
  return {
    kind: "face",
    stableId: `generated:face:${bodyId}:${role}`,
    label: role,
    bodyId,
    ownerPartId: "part:default",
    sourceFeatureId: "feat_rect",
    sourceSketchId: "sketch_1",
    sourceSketchEntityId: "rect_1",
    role,
    eligibleOperations: [
      "feature.attachSketchPlane",
      "feature.measureReference",
      "feature.selectReference"
    ],
    geometricSignature: {
      profileKind: "rectangle",
      sketchPlane: "XY",
      extrudeSide: "positive",
      depth: 3,
      profile: {
        kind: "rectangle",
        center: [0, 0],
        width: 4,
        height: 2
      },
      surfaceType: "plane"
    }
  };
}

function createCircleFace(
  bodyId: string,
  role: "startCap" | "endCap" | "side:circular"
): CadGeneratedFaceReference {
  return {
    kind: "face",
    stableId: `generated:face:${bodyId}:${role}`,
    label: role,
    bodyId,
    ownerPartId: "part:default",
    sourceFeatureId: "feat_circle",
    sourceSketchId: "sketch_1",
    sourceSketchEntityId: "circle_1",
    role,
    eligibleOperations:
      role === "side:circular"
        ? ["feature.measureReference", "feature.selectReference"]
        : [
            "feature.attachSketchPlane",
            "feature.measureReference",
            "feature.selectReference"
          ],
    geometricSignature: {
      profileKind: "circle",
      sketchPlane: "XY",
      extrudeSide: "positive",
      depth: 3,
      profile: {
        kind: "circle",
        center: [0, 0],
        radius: 1
      },
      surfaceType: role === "side:circular" ? "cylinder" : "plane"
    }
  };
}
