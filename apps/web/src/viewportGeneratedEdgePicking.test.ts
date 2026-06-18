import type {
  CadGeneratedEdgeReference,
  CadGeneratedExtrudeEdgeRole
} from "@web-cad/cad-protocol";
import { createDefaultCamera, projectPoint } from "@web-cad/renderer";
import { describe, expect, it } from "vitest";
import { createViewportGeneratedEdgeHitCandidate } from "./viewportGeneratedEdgePicking";

describe("viewport generated edge picking", () => {
  const camera = createDefaultCamera();
  const size = { width: 800, height: 600 };

  it("creates private hit candidates for supported generated rectangle cap edges", () => {
    const edges = createRectangleEdges("body_rect");
    const point = projectPoint([2, 0, 0], camera, size);

    expect(point).toBeDefined();

    const candidate = createViewportGeneratedEdgeHitCandidate({
      camera,
      edges,
      pickedRenderId: "body_rect",
      point: { x: point?.x ?? 0, y: point?.y ?? 0 },
      preferredBodyId: "body_rect",
      size
    });

    expect(candidate).toMatchObject({
      displayEntityKind: "edge",
      semanticHint: {
        type: "generatedReference",
        bodyId: "body_rect",
        stableId: "generated:edge:body_rect:start:uMax",
        expectedKind: "edge"
      },
      precision: "displayApproximation"
    });
    expect(candidate?.rendererHitId).toContain("renderer-hit");
    expect(JSON.stringify(candidate?.semanticHint)).not.toContain(
      "renderer-hit"
    );
  });

  it("creates private hit candidates for generated rectangle longitudinal corner edges", () => {
    const point = projectPoint([2, 1, 1.5], camera, size);
    const candidate = createViewportGeneratedEdgeHitCandidate({
      camera,
      edges: [createRectangleEdge("body_rect", "longitudinal:uMax:vMax")],
      pickedRenderId: "body_rect",
      point: { x: point?.x ?? 0, y: point?.y ?? 0 },
      preferredBodyId: "body_rect",
      size
    });

    expect(candidate?.semanticHint).toEqual({
      type: "generatedReference",
      bodyId: "body_rect",
      stableId: "generated:edge:body_rect:longitudinal:uMax:vMax",
      expectedKind: "edge"
    });
  });

  it("supports generated circle start and end circular edges", () => {
    const point = projectPoint([1, 0, 3], camera, size);
    const candidate = createViewportGeneratedEdgeHitCandidate({
      camera,
      edges: [createCircleEdge("body_circle", "end:circular")],
      pickedRenderId: "body_circle",
      point: { x: point?.x ?? 0, y: point?.y ?? 0 },
      preferredBodyId: "body_circle",
      size
    });

    expect(candidate?.semanticHint).toEqual({
      type: "generatedReference",
      bodyId: "body_circle",
      stableId: "generated:edge:body_circle:end:circular",
      expectedKind: "edge"
    });
  });

  it("requires a resolved target body but not the previously selected body", () => {
    const point = projectPoint([2, 0, 0], camera, size);
    const edges = createRectangleEdges("body_rect");

    expect(
      createViewportGeneratedEdgeHitCandidate({
        camera,
        edges,
        pickedRenderId: "body_rect",
        point: { x: point?.x ?? 0, y: point?.y ?? 0 },
        size
      })
    ).toBeUndefined();
    expect(
      createViewportGeneratedEdgeHitCandidate({
        camera,
        edges,
        pickedRenderId: "body_other",
        point: { x: point?.x ?? 0, y: point?.y ?? 0 },
        targetBodyId: "body_rect",
        size
      })
    ).toMatchObject({
      displayEntityKind: "edge",
      semanticHint: {
        type: "generatedReference",
        bodyId: "body_rect",
        expectedKind: "edge"
      }
    });
  });

  it("keeps renderer and session details out of the semantic selection hint", () => {
    const point = projectPoint([2, 0, 0], camera, size);
    const candidate = createViewportGeneratedEdgeHitCandidate({
      camera,
      edges: [createRectangleEdge("body_rect", "start:uMax")],
      pickedRenderId: "body_rect",
      point: { x: point?.x ?? 0, y: point?.y ?? 0 },
      preferredBodyId: "body_rect",
      size
    });
    const semanticHint = JSON.stringify(candidate?.semanticHint);
    const fullCandidate = JSON.stringify(candidate);

    expect(semanticHint).toBe(
      '{"type":"generatedReference","bodyId":"body_rect","stableId":"generated:edge:body_rect:start:uMax","expectedKind":"edge"}'
    );
    expect(fullCandidate).not.toContain("selection-buffer");
    expect(fullCandidate).not.toContain("mesh-triangle");
    expect(fullCandidate).not.toContain("occt-shape");
    expect(fullCandidate).not.toContain(".wcad");
    expect(fullCandidate).not.toContain("web-cad.project.v17");
  });
});

function createRectangleEdges(
  bodyId: string
): readonly CadGeneratedEdgeReference[] {
  return [
    "start:uMin",
    "start:uMax",
    "start:vMin",
    "start:vMax",
    "end:uMin",
    "end:uMax",
    "end:vMin",
    "end:vMax",
    "longitudinal:uMin:vMin",
    "longitudinal:uMin:vMax",
    "longitudinal:uMax:vMin",
    "longitudinal:uMax:vMax"
  ].map((role) =>
    createRectangleEdge(bodyId, role as CadGeneratedExtrudeEdgeRole)
  );
}

function createRectangleEdge(
  bodyId: string,
  role: CadGeneratedExtrudeEdgeRole
): CadGeneratedEdgeReference {
  return {
    kind: "edge",
    stableId: `generated:edge:${bodyId}:${role}`,
    label: role,
    bodyId,
    ownerPartId: "part:default",
    sourceFeatureId: "feat_rect",
    sourceSketchId: "sketch_1",
    sourceSketchEntityId: "rect_1",
    role,
    adjacentFaceRoles: role.startsWith("end:")
      ? ["endCap", "side:uMax"]
      : ["startCap", "side:uMax"],
    eligibleOperations: [
      "feature.chamfer",
      "feature.fillet",
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
      curveType: "line"
    }
  };
}

function createCircleEdge(
  bodyId: string,
  role: "start:circular" | "end:circular"
): CadGeneratedEdgeReference {
  return {
    kind: "edge",
    stableId: `generated:edge:${bodyId}:${role}`,
    label: role,
    bodyId,
    ownerPartId: "part:default",
    sourceFeatureId: "feat_circle",
    sourceSketchId: "sketch_1",
    sourceSketchEntityId: "circle_1",
    role,
    adjacentFaceRoles: [
      role === "start:circular" ? "startCap" : "endCap",
      "side:circular"
    ],
    eligibleOperations: [
      "feature.chamfer",
      "feature.fillet",
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
      curveType: "circle"
    }
  };
}
