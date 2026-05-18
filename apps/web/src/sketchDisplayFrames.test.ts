import { describe, expect, it } from "vitest";
import type {
  CadGeneratedExtrudeFaceRole,
  CadGeneratedFaceReference,
  FeatureExtrudeSide,
  SketchPlane,
  SketchSnapshot,
  Vec2,
  Vec3
} from "@web-cad/cad-protocol";
import {
  ATTACHED_SKETCH_FACE_OFFSET,
  createAttachedSketchDisplayFrame,
  createGeneratedFaceReferenceKey,
  createSketchDisplayState,
  mapSketchPlanePointToDisplayFrame,
  mapSketchPointToDisplayFrame
} from "./sketchDisplayFrames";

describe("sketch display frames", () => {
  it("derives a display frame for an attached rectangle end cap sketch", () => {
    const sketch = createAttachedSketch("sketch_face_1", "endCap", "XY");
    const face = createRectangleFace({
      role: "endCap",
      normal: [0, 0, 1],
      depth: 3
    });
    const state = createSketchDisplayState(
      [sketch],
      new Map([
        [createGeneratedFaceReferenceKey(face.bodyId, face.stableId), face]
      ])
    );
    const frame = state.frames.get(sketch.id);

    expect(state.statuses.get(sketch.id)).toEqual({
      kind: "attached",
      message: "Displaying on End cap."
    });
    expect(frame).toBeDefined();
    expect(frame?.origin).toEqual([0, 0, 3 + ATTACHED_SKETCH_FACE_OFFSET]);
    expect(frame && mapSketchPointToDisplayFrame(frame, [1, 2])).toEqual([
      1,
      2,
      3 + ATTACHED_SKETCH_FACE_OFFSET
    ]);
  });

  it("can derive an exact attached frame without display offset for geometry placement", () => {
    const sketch = createAttachedSketch("sketch_face_1", "endCap", "XY");
    const face = createRectangleFace({
      role: "endCap",
      normal: [0, 0, 1],
      depth: 3
    });
    const frame = createAttachedSketchDisplayFrame(sketch, face, 0);

    expect(frame?.origin).toEqual([0, 0, 3]);
  });

  it("maps local sketch-plane 3D points into an attached display frame", () => {
    const frame = {
      origin: [10, 20, 30] satisfies Vec3,
      uAxis: [0, 1, 0] satisfies Vec3,
      vAxis: [0, 0, 1] satisfies Vec3
    };

    expect(mapSketchPlanePointToDisplayFrame(frame, "XY", [1, 2, 3])).toEqual([
      13, 21, 32
    ]);
  });

  it("derives a display frame for an attached rectangle start cap sketch", () => {
    const sketch = createAttachedSketch("sketch_face_1", "startCap", "XY");
    const face = createRectangleFace({
      role: "startCap",
      normal: [0, 0, -1],
      depth: 3
    });
    const state = createSketchDisplayState(
      [sketch],
      new Map([
        [createGeneratedFaceReferenceKey(face.bodyId, face.stableId), face]
      ])
    );
    const frame = state.frames.get(sketch.id);

    expect(frame?.origin).toEqual([0, 0, -ATTACHED_SKETCH_FACE_OFFSET]);
  });

  it("derives a display frame for an attached rectangle side face sketch", () => {
    const sketch = createAttachedSketch("sketch_side_1", "side:uMax", "YZ");
    const face = createRectangleFace({
      role: "side:uMax",
      normal: [1, 0, 0],
      depth: 4,
      side: "positive",
      width: 6,
      height: 2
    });
    const state = createSketchDisplayState(
      [sketch],
      new Map([
        [createGeneratedFaceReferenceKey(face.bodyId, face.stableId), face]
      ])
    );
    const frame = state.frames.get(sketch.id);

    expect(frame?.origin).toEqual([3 + ATTACHED_SKETCH_FACE_OFFSET, 0, 2]);
    expect(frame && mapSketchPointToDisplayFrame(frame, [1, 1])).toEqual([
      3 + ATTACHED_SKETCH_FACE_OFFSET,
      1,
      3
    ]);
  });

  it("falls back to the saved sketch plane when an attachment is stale", () => {
    const sketch = createAttachedSketch("sketch_missing", "endCap", "XY");
    const state = createSketchDisplayState([sketch], new Map());

    expect(state.frames.has(sketch.id)).toBe(false);
    expect(state.statuses.get(sketch.id)).toEqual({
      kind: "unresolved",
      message:
        "Attachment unresolved; displaying Attached sketch on saved XY plane."
    });
  });

  it("leaves unattached sketches on their saved plane", () => {
    const state = createSketchDisplayState(
      [
        {
          id: "sketch_1",
          name: "Base sketch",
          plane: "XZ",
          entities: []
        }
      ],
      new Map()
    );

    expect(state.frames.size).toBe(0);
    expect(state.statuses.get("sketch_1")).toEqual({ kind: "unattached" });
  });
});

function createAttachedSketch(
  id: string,
  faceRole: CadGeneratedExtrudeFaceRole,
  plane: SketchPlane
): SketchSnapshot {
  return {
    id,
    name: "Attached sketch",
    plane,
    attachment: {
      kind: "generatedFace",
      bodyId: "body_1",
      faceStableId: `generated:face:body_1:${faceRole}`,
      sourceFeatureId: "feat_1",
      sourceSketchId: "sketch_1",
      sourceSketchEntityId: "rect_1",
      faceRole
    },
    entities: []
  };
}

function createRectangleFace({
  depth,
  height = 2,
  normal,
  role,
  side = "positive",
  width = 4
}: {
  readonly depth: number;
  readonly height?: number;
  readonly normal: Vec3;
  readonly role: CadGeneratedExtrudeFaceRole;
  readonly side?: FeatureExtrudeSide;
  readonly width?: number;
}): CadGeneratedFaceReference {
  return {
    kind: "face",
    stableId: `generated:face:body_1:${role}`,
    label:
      role === "endCap"
        ? "End cap"
        : role === "startCap"
          ? "Start cap"
          : "Side face",
    description: "Generated face",
    eligibleOperations: [
      "feature.attachSketchPlane",
      "feature.measureReference",
      "feature.selectReference"
    ],
    eligibilityNotes: [],
    bodyId: "body_1",
    ownerPartId: "part:default",
    sourceFeatureId: "feat_1",
    sourceSketchId: "sketch_1",
    sourceSketchEntityId: "rect_1",
    role,
    geometricSignature: {
      profileKind: "rectangle",
      sketchPlane: "XY",
      extrudeSide: side,
      depth,
      profile: {
        kind: "rectangle",
        center: [0, 0] satisfies Vec2,
        width,
        height
      },
      surfaceType: "plane",
      normal
    }
  };
}
