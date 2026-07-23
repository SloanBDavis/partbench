import type {
  CadAxisAlignedBounds,
  CadGeneratedExtrudeFaceRole,
  CadGeneratedFaceReference,
  CadGeneratedReferenceProfileSignature,
  FeatureExtrudeSide,
  PartId,
  SketchAttachmentSnapshot,
  SketchPlane,
  Vec2,
  Vec3
} from "@web-cad/cad-protocol";

import {
  createBodyGeneratedReferences,
  type GeneratedReferencesDocument
} from "./generatedReferences";

export interface SourceMeasurementSketch {
  readonly plane: SketchPlane;
  readonly attachment?: SketchAttachmentSnapshot;
}

export interface SourceMeasurementFrame {
  readonly origin: Vec3;
  readonly uAxis: Vec3;
  readonly vAxis: Vec3;
}

export function createSourceMeasurementFrame(
  document: GeneratedReferencesDocument,
  sketch: SourceMeasurementSketch,
  ownerPartId: PartId
): SourceMeasurementFrame | undefined {
  const attachment = sketch.attachment;

  if (!attachment) {
    return createDefaultSourceMeasurementFrame(sketch.plane);
  }

  if (attachment.kind === "topologyAnchorFace") {
    return createTopologyAnchorFaceMeasurementFrame(attachment);
  }

  const references = createBodyGeneratedReferences(
    document,
    attachment.bodyId,
    ownerPartId
  );
  const face = references?.faces.find(
    (candidate) => candidate.stableId === attachment.faceStableId
  );

  if (!face || face.geometricSignature.surfaceType !== "plane") {
    return undefined;
  }

  return createAttachedSourceMeasurementFrame(sketch, face);
}

function createTopologyAnchorFaceMeasurementFrame(
  attachment: Extract<
    SketchAttachmentSnapshot,
    { readonly kind: "topologyAnchorFace" }
  >
): SourceMeasurementFrame {
  switch (attachment.planarAxis) {
    case "x":
      return {
        origin: [attachment.planarCoordinate, 0, 0],
        uAxis: [0, 1, 0],
        vAxis: [0, 0, 1]
      };
    case "y":
      return {
        origin: [0, attachment.planarCoordinate, 0],
        uAxis: [1, 0, 0],
        vAxis: [0, 0, 1]
      };
    case "z":
      return {
        origin: [0, 0, attachment.planarCoordinate],
        uAxis: [1, 0, 0],
        vAxis: [0, 1, 0]
      };
  }
}

export function createDefaultSourceMeasurementFrame(
  plane: SketchPlane
): SourceMeasurementFrame {
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

export function mapSketchPointToSourceMeasurementFrame(
  frame: SourceMeasurementFrame,
  point: Vec2
): Vec3 {
  return cleanVec3([
    frame.origin[0] + frame.uAxis[0] * point[0] + frame.vAxis[0] * point[1],
    frame.origin[1] + frame.uAxis[1] * point[0] + frame.vAxis[1] * point[1],
    frame.origin[2] + frame.uAxis[2] * point[0] + frame.vAxis[2] * point[1]
  ]);
}

export function mapSketchPlanePointToSourceMeasurementFrame(
  frame: SourceMeasurementFrame,
  plane: SketchPlane,
  point: Vec3
): Vec3 {
  const [u, v, normalDistance] = getSketchPlaneCoordinates(plane, point);
  const normal = createSourceMeasurementFrameNormal(frame);

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

export function mapLocalExtrudePointToSourceMeasurementFrame(
  frame: SourceMeasurementFrame,
  point: Vec3
): Vec3 {
  const normal = createSourceMeasurementFrameNormal(frame);

  return cleanVec3([
    frame.origin[0] +
      frame.uAxis[0] * point[0] +
      frame.vAxis[0] * point[1] +
      normal[0] * point[2],
    frame.origin[1] +
      frame.uAxis[1] * point[0] +
      frame.vAxis[1] * point[1] +
      normal[1] * point[2],
    frame.origin[2] +
      frame.uAxis[2] * point[0] +
      frame.vAxis[2] * point[1] +
      normal[2] * point[2]
  ]);
}

export function createExtrudeMeasurementDepthRange(
  depth: number,
  side: FeatureExtrudeSide
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

export function createMeasurementBounds(
  points: readonly Vec3[]
): CadAxisAlignedBounds {
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const zs = points.map((point) => point[2]);
  const min: Vec3 = [
    cleanMeasurementNumber(Math.min(...xs)),
    cleanMeasurementNumber(Math.min(...ys)),
    cleanMeasurementNumber(Math.min(...zs))
  ];
  const max: Vec3 = [
    cleanMeasurementNumber(Math.max(...xs)),
    cleanMeasurementNumber(Math.max(...ys)),
    cleanMeasurementNumber(Math.max(...zs))
  ];
  const size: Vec3 = [
    cleanMeasurementNumber(max[0] - min[0]),
    cleanMeasurementNumber(max[1] - min[1]),
    cleanMeasurementNumber(max[2] - min[2])
  ];
  const center: Vec3 = [
    cleanMeasurementNumber((min[0] + max[0]) / 2),
    cleanMeasurementNumber((min[1] + max[1]) / 2),
    cleanMeasurementNumber((min[2] + max[2]) / 2)
  ];

  return { min, max, size, center };
}

export function distanceVec3(left: Vec3, right: Vec3): number {
  return Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2]);
}

export function cleanMeasurementNumber(value: number): number {
  const rounded = Math.round(value * 1e12) / 1e12;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function createAttachedSourceMeasurementFrame(
  sketch: SourceMeasurementSketch,
  face: CadGeneratedFaceReference
): SourceMeasurementFrame | undefined {
  const profile = face.geometricSignature.profile;
  const normal = face.geometricSignature.normal;

  if (
    !profile ||
    !normal ||
    !isExtrudeFaceRole(face.role) ||
    face.geometricSignature.depth === undefined ||
    face.geometricSignature.extrudeSide === undefined
  ) {
    return undefined;
  }

  const sourcePlane = face.geometricSignature.sketchPlane;
  const sourceFrame = createDefaultSourceMeasurementFrame(sourcePlane);
  const sourceNormal = createSketchPlaneNormal(sourcePlane);
  const profileCenter = mapSketchPointToSourceMeasurementFrame(
    sourceFrame,
    profile.center
  );
  const depthRange = createExtrudeMeasurementDepthRange(
    face.geometricSignature.depth,
    face.geometricSignature.extrudeSide
  );
  const origin =
    profile.kind === "rectangle"
      ? createRectangleFaceCenter(
          face.role,
          sourceFrame,
          sourceNormal,
          profileCenter,
          profile,
          depthRange
        )
      : createCircleFaceCenter(
          face.role,
          sourceNormal,
          profileCenter,
          depthRange
        );

  if (!origin) {
    return undefined;
  }

  return orientFrameToNormal(
    {
      ...createDefaultSourceMeasurementFrame(sketch.plane),
      origin
    },
    normal
  );
}

function isExtrudeFaceRole(
  role: CadGeneratedFaceReference["role"]
): role is CadGeneratedExtrudeFaceRole {
  return role !== "holeWall";
}

function orientFrameToNormal(
  frame: SourceMeasurementFrame,
  targetNormal: Vec3
): SourceMeasurementFrame {
  const frameNormal = createSourceMeasurementFrameNormal(frame);

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

function createRectangleFaceCenter(
  role: CadGeneratedExtrudeFaceRole,
  sourceFrame: SourceMeasurementFrame,
  sourceNormal: Vec3,
  profileCenter: Vec3,
  profile: Extract<
    CadGeneratedReferenceProfileSignature,
    { readonly kind: "rectangle" }
  >,
  depthRange: readonly [number, number]
): Vec3 | undefined {
  const midDepth = (depthRange[0] + depthRange[1]) / 2;

  switch (role) {
    case "startCap":
      return addVec3(profileCenter, scaleVec3(sourceNormal, depthRange[0]));
    case "endCap":
      return addVec3(profileCenter, scaleVec3(sourceNormal, depthRange[1]));
    case "side:uMin":
      return addVec3(
        mapSketchPointToSourceMeasurementFrame(sourceFrame, [
          profile.center[0] - profile.width / 2,
          profile.center[1]
        ]),
        scaleVec3(sourceNormal, midDepth)
      );
    case "side:uMax":
      return addVec3(
        mapSketchPointToSourceMeasurementFrame(sourceFrame, [
          profile.center[0] + profile.width / 2,
          profile.center[1]
        ]),
        scaleVec3(sourceNormal, midDepth)
      );
    case "side:vMin":
      return addVec3(
        mapSketchPointToSourceMeasurementFrame(sourceFrame, [
          profile.center[0],
          profile.center[1] - profile.height / 2
        ]),
        scaleVec3(sourceNormal, midDepth)
      );
    case "side:vMax":
      return addVec3(
        mapSketchPointToSourceMeasurementFrame(sourceFrame, [
          profile.center[0],
          profile.center[1] + profile.height / 2
        ]),
        scaleVec3(sourceNormal, midDepth)
      );
    case "side:circular":
      return undefined;
  }

  return undefined;
}

function createCircleFaceCenter(
  role: CadGeneratedExtrudeFaceRole,
  sourceNormal: Vec3,
  profileCenter: Vec3,
  depthRange: readonly [number, number]
): Vec3 | undefined {
  switch (role) {
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

  return undefined;
}

function createSourceMeasurementFrameNormal(
  frame: SourceMeasurementFrame
): Vec3 {
  return normalizeVec3(crossVec3(frame.uAxis, frame.vAxis));
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

function cleanVec3(vector: Vec3): Vec3 {
  return [
    cleanMeasurementNumber(vector[0]),
    cleanMeasurementNumber(vector[1]),
    cleanMeasurementNumber(vector[2])
  ];
}
