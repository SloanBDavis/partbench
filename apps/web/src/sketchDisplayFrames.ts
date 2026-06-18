import type {
  CadGeneratedFaceReference,
  SketchPlane,
  SketchSnapshot,
  Vec2
} from "@web-cad/cad-protocol";
import type { Vec3 } from "@web-cad/renderer";

export const ATTACHED_SKETCH_FACE_OFFSET = 0.01;

export interface SketchDisplayFrame {
  readonly origin: Vec3;
  readonly uAxis: Vec3;
  readonly vAxis: Vec3;
}

export type SketchDisplayStatus =
  | {
      readonly kind: "unattached";
      readonly message?: undefined;
    }
  | {
      readonly kind: "attached";
      readonly message: string;
    }
  | {
      readonly kind: "unresolved";
      readonly message: string;
    };

export interface SketchDisplayState {
  readonly frames: ReadonlyMap<string, SketchDisplayFrame>;
  readonly statuses: ReadonlyMap<string, SketchDisplayStatus>;
}

export function createGeneratedFaceReferenceKey(
  bodyId: string,
  stableId: string
): string {
  return `${bodyId}\n${stableId}`;
}

export function createSketchDisplayState(
  sketches: readonly SketchSnapshot[],
  generatedFacesByKey: ReadonlyMap<string, CadGeneratedFaceReference>
): SketchDisplayState {
  const frames = new Map<string, SketchDisplayFrame>();
  const statuses = new Map<string, SketchDisplayStatus>();

  for (const sketch of sketches) {
    const attachment = sketch.attachment;

    if (!attachment) {
      statuses.set(sketch.id, { kind: "unattached" });
      continue;
    }

    const face = generatedFacesByKey.get(
      createGeneratedFaceReferenceKey(
        attachment.bodyId,
        attachment.faceStableId
      )
    );

    if (!face) {
      statuses.set(sketch.id, {
        kind: "unresolved",
        message: `Attachment unresolved; displaying ${sketch.name} on saved ${sketch.plane} plane.`
      });
      continue;
    }

    const frame = createAttachedSketchDisplayFrame(sketch, face);

    if (!frame) {
      statuses.set(sketch.id, {
        kind: "unresolved",
        message: `Attachment cannot be displayed; displaying ${sketch.name} on saved ${sketch.plane} plane.`
      });
      continue;
    }

    frames.set(sketch.id, frame);
    statuses.set(sketch.id, {
      kind: "attached",
      message: `Displaying on ${face.label}.`
    });
  }

  return { frames, statuses };
}

export function createDefaultSketchDisplayFrame(
  plane: SketchPlane
): SketchDisplayFrame {
  switch (plane) {
    case "XY":
      return {
        origin: [0, 0, 0],
        uAxis: [1, 0, 0],
        vAxis: [0, 1, 0]
      };
    case "XZ":
      return {
        origin: [0, 0, 0],
        uAxis: [1, 0, 0],
        vAxis: [0, 0, 1]
      };
    case "YZ":
      return {
        origin: [0, 0, 0],
        uAxis: [0, 1, 0],
        vAxis: [0, 0, 1]
      };
  }
}

export function mapSketchPointToDisplayFrame(
  frame: SketchDisplayFrame,
  point: readonly [number, number]
): Vec3 {
  return cleanVec3([
    frame.origin[0] + frame.uAxis[0] * point[0] + frame.vAxis[0] * point[1],
    frame.origin[1] + frame.uAxis[1] * point[0] + frame.vAxis[1] * point[1],
    frame.origin[2] + frame.uAxis[2] * point[0] + frame.vAxis[2] * point[1]
  ]);
}

export function mapSketchPlanePointToDisplayFrame(
  frame: SketchDisplayFrame,
  plane: SketchPlane,
  point: Vec3
): Vec3 {
  const [u, v, normalDistance] = getSketchPlaneCoordinates(plane, point);
  const normal = createSketchDisplayFrameNormal(frame);

  return cleanVec3([
    frame.origin[0] +
      frame.uAxis[0] * u +
      frame.vAxis[0] * v +
      normal[0] * normalDistance,
    frame.origin[1] +
      frame.uAxis[1] * u +
      frame.vAxis[1] * v +
      normal[1] * normalDistance,
    frame.origin[2] +
      frame.uAxis[2] * u +
      frame.vAxis[2] * v +
      normal[2] * normalDistance
  ]);
}

export function createSketchDisplayFrameNormal(
  frame: SketchDisplayFrame
): Vec3 {
  return normalizeVec3(crossVec3(frame.uAxis, frame.vAxis));
}

export function createAttachedSketchDisplayFrame(
  sketch: SketchSnapshot,
  face: CadGeneratedFaceReference
): SketchDisplayFrame | undefined {
  return createAttachedSketchFaceFrame(
    sketch,
    face,
    ATTACHED_SKETCH_FACE_OFFSET
  );
}

export function createAttachedSketchGeometryFrame(
  sketch: SketchSnapshot,
  face: CadGeneratedFaceReference
): SketchDisplayFrame | undefined {
  return createAttachedSketchFaceFrame(sketch, face, 0);
}

function createAttachedSketchFaceFrame(
  sketch: SketchSnapshot,
  face: CadGeneratedFaceReference,
  offset: number
): SketchDisplayFrame | undefined {
  if (face.geometricSignature.surfaceType !== "plane") {
    return undefined;
  }

  const profile = face.geometricSignature.profile;
  const normal = face.geometricSignature.normal;

  if (
    !profile ||
    !normal ||
    face.geometricSignature.depth === undefined ||
    face.geometricSignature.extrudeSide === undefined
  ) {
    return undefined;
  }

  const sourcePlane = face.geometricSignature.sketchPlane;
  const sourceFrame = createDefaultSketchDisplayFrame(sourcePlane);
  const sourceNormal = createSketchPlaneNormal(sourcePlane);
  const profileCenter = mapProfileCenterToSourceFrame(sourceFrame, profile);
  const depthRange = createExtrudeDepthRange(
    face.geometricSignature.depth,
    face.geometricSignature.extrudeSide
  );
  const frameOrigin =
    profile.kind === "rectangle"
      ? createRectangleFaceCenter(
          face,
          sourceFrame,
          sourceNormal,
          profileCenter,
          profile.center,
          profile.width,
          profile.height,
          depthRange
        )
      : createCircleFaceCenter(face, sourceNormal, profileCenter, depthRange);

  if (!frameOrigin) {
    return undefined;
  }

  return orientFrameToNormal(
    {
      ...createDefaultSketchDisplayFrame(sketch.plane),
      origin: addVec3(frameOrigin, scaleVec3(normal, offset))
    },
    normal
  );
}

function orientFrameToNormal(
  frame: SketchDisplayFrame,
  targetNormal: Vec3
): SketchDisplayFrame {
  const frameNormal = createSketchDisplayFrameNormal(frame);

  if (dotVec3(frameNormal, targetNormal) >= 0) {
    return frame;
  }

  return {
    ...frame,
    uAxis: scaleVec3(frame.uAxis, -1)
  };
}

function dotVec3(left: Vec3, right: Vec3): number {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

function getSketchPlaneCoordinates(
  plane: SketchPlane,
  point: Vec3
): readonly [number, number, number] {
  switch (plane) {
    case "XY":
      return [point[0], point[1], point[2]];
    case "XZ":
      return [point[0], point[2], point[1]];
    case "YZ":
      return [point[1], point[2], point[0]];
  }
}

function mapProfileCenterToSourceFrame(
  frame: SketchDisplayFrame,
  profile: { readonly center: Vec2 }
): Vec3 {
  return mapSketchPointToDisplayFrame(frame, profile.center);
}

function createRectangleFaceCenter(
  face: CadGeneratedFaceReference,
  sourceFrame: SketchDisplayFrame,
  sourceNormal: Vec3,
  profileCenter: Vec3,
  profileCenter2d: Vec2,
  width: number,
  height: number,
  depthRange: readonly [number, number]
): Vec3 | undefined {
  const midDepth = (depthRange[0] + depthRange[1]) / 2;

  switch (face.role) {
    case "startCap":
      return addVec3(profileCenter, scaleVec3(sourceNormal, depthRange[0]));
    case "endCap":
      return addVec3(profileCenter, scaleVec3(sourceNormal, depthRange[1]));
    case "side:uMin":
      return addVec3(
        mapSketchPointToDisplayFrame(sourceFrame, [
          profileCenter2d[0] - width / 2,
          profileCenter2d[1]
        ]),
        scaleVec3(sourceNormal, midDepth)
      );
    case "side:uMax":
      return addVec3(
        mapSketchPointToDisplayFrame(sourceFrame, [
          profileCenter2d[0] + width / 2,
          profileCenter2d[1]
        ]),
        scaleVec3(sourceNormal, midDepth)
      );
    case "side:vMin":
      return addVec3(
        mapSketchPointToDisplayFrame(sourceFrame, [
          profileCenter2d[0],
          profileCenter2d[1] - height / 2
        ]),
        scaleVec3(sourceNormal, midDepth)
      );
    case "side:vMax":
      return addVec3(
        mapSketchPointToDisplayFrame(sourceFrame, [
          profileCenter2d[0],
          profileCenter2d[1] + height / 2
        ]),
        scaleVec3(sourceNormal, midDepth)
      );
    case "side:circular":
      return undefined;
  }
}

function createCircleFaceCenter(
  face: CadGeneratedFaceReference,
  sourceNormal: Vec3,
  profileCenter: Vec3,
  depthRange: readonly [number, number]
): Vec3 | undefined {
  switch (face.role) {
    case "startCap":
      return addVec3(profileCenter, scaleVec3(sourceNormal, depthRange[0]));
    case "endCap":
      return addVec3(profileCenter, scaleVec3(sourceNormal, depthRange[1]));
    case "side:circular":
    case "side:uMin":
    case "side:uMax":
    case "side:vMin":
    case "side:vMax":
      return undefined;
  }
}

function createExtrudeDepthRange(
  depth: number,
  side: "positive" | "negative" | "symmetric"
): readonly [number, number] {
  switch (side) {
    case "positive":
      return [0, depth];
    case "negative":
      return [0, -depth];
    case "symmetric":
      return [-depth / 2, depth / 2];
  }
}

function createSketchPlaneNormal(plane: SketchPlane): Vec3 {
  switch (plane) {
    case "XY":
      return [0, 0, 1];
    case "XZ":
      return [0, 1, 0];
    case "YZ":
      return [1, 0, 0];
  }
}

function crossVec3(left: Vec3, right: Vec3): Vec3 {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0]
  ];
}

function normalizeVec3(vector: Vec3): Vec3 {
  const length = Math.hypot(vector[0], vector[1], vector[2]);

  if (length === 0) {
    return [0, 0, 0];
  }

  return cleanVec3([
    vector[0] / length,
    vector[1] / length,
    vector[2] / length
  ]);
}

function addVec3(left: Vec3, right: Vec3): Vec3 {
  return cleanVec3([
    left[0] + right[0],
    left[1] + right[1],
    left[2] + right[2]
  ]);
}

function scaleVec3(vector: Vec3, scalar: number): Vec3 {
  return cleanVec3([
    vector[0] * scalar,
    vector[1] * scalar,
    vector[2] * scalar
  ]);
}

function cleanVec3(vector: Vec3): Vec3 {
  return [
    cleanNumber(vector[0]),
    cleanNumber(vector[1]),
    cleanNumber(vector[2])
  ];
}

function cleanNumber(value: number): number {
  return Math.abs(value) < 1e-10 ? 0 : value;
}
