import type {
  BodyId,
  BodyMeasurementsSnapshot,
  CadAxisAlignedBounds,
  CadGeneratedFaceReference,
  DocumentUnits,
  FeatureExtrudeSide,
  PartId,
  SketchPlane,
  Vec2,
  Vec3
} from "@web-cad/cad-protocol";

import { createBodyGeneratedReferences } from "./generatedReferences";
import type { CadDocument, Feature, Sketch, SketchEntity } from "./index";

export function createBodyMeasurements(
  document: CadDocument,
  bodyId: BodyId,
  units: DocumentUnits,
  ownerPartId: PartId
): BodyMeasurementsSnapshot | undefined {
  const feature = [...document.features.values()].find(
    (candidate) => candidate.bodyId === bodyId
  );

  if (!feature) {
    return undefined;
  }

  const sketch = document.sketches.get(feature.sketchId);
  const entity = sketch?.entities.get(feature.entityId);

  if (!sketch || !entity || !isExtrudeMeasurementEntity(feature, entity)) {
    return undefined;
  }

  const frame = createSketchMeasurementFrame(document, sketch, ownerPartId);

  if (!frame) {
    return undefined;
  }

  const depthRange = createExtrudeMeasurementDepthRange(
    feature.depth,
    feature.side
  );
  const measurement =
    entity.kind === "rectangle"
      ? createRectangleExtrudeMeasurementInput(entity, depthRange)
      : createCircleExtrudeMeasurementInput(entity, depthRange);
  const points = measurement.points.map((point) =>
    mapSketchPlanePointToMeasurementFrame(frame, sketch.plane, point)
  );
  const localBounds = createBounds(points);

  return {
    bodyId: feature.bodyId,
    sourceFeatureId: feature.id,
    sourceSketchId: feature.sketchId,
    sourceSketchEntityId: feature.entityId,
    profileKind: feature.profileKind,
    units,
    sketchPlane: sketch.plane,
    side: feature.side,
    depth: feature.depth,
    measurementModel: "sourceAnalytic",
    localBounds,
    localExtents: localBounds.size,
    centroid: mapSketchPlanePointToMeasurementFrame(
      frame,
      sketch.plane,
      measurement.centroid
    ),
    volume: cleanMeasurementNumber(measurement.volume),
    surfaceArea: cleanMeasurementNumber(measurement.surfaceArea)
  };
}

type ExtrudeMeasurementEntity =
  | Extract<SketchEntity, { readonly kind: "rectangle" }>
  | Extract<SketchEntity, { readonly kind: "circle" }>;

function isExtrudeMeasurementEntity(
  feature: Feature,
  entity: SketchEntity
): entity is ExtrudeMeasurementEntity {
  return (
    (feature.profileKind === "rectangle" && entity.kind === "rectangle") ||
    (feature.profileKind === "circle" && entity.kind === "circle")
  );
}

interface SketchMeasurementFrame {
  readonly origin: Vec3;
  readonly uAxis: Vec3;
  readonly vAxis: Vec3;
}

interface ExtrudeMeasurementInput {
  readonly points: readonly Vec3[];
  readonly centroid: Vec3;
  readonly volume: number;
  readonly surfaceArea: number;
}

function createRectangleExtrudeMeasurementInput(
  entity: Extract<SketchEntity, { readonly kind: "rectangle" }>,
  depthRange: readonly [number, number]
): ExtrudeMeasurementInput {
  const uMin = entity.center[0] - entity.width / 2;
  const uMax = entity.center[0] + entity.width / 2;
  const vMin = entity.center[1] - entity.height / 2;
  const vMax = entity.center[1] + entity.height / 2;
  const depth = Math.abs(depthRange[1] - depthRange[0]);

  return {
    points: createProfileExtrudeBoundsPoints(
      uMin,
      uMax,
      vMin,
      vMax,
      depthRange
    ),
    centroid: [
      entity.center[0],
      entity.center[1],
      (depthRange[0] + depthRange[1]) / 2
    ],
    volume: entity.width * entity.height * depth,
    surfaceArea:
      2 *
      (entity.width * entity.height +
        entity.width * depth +
        entity.height * depth)
  };
}

function createCircleExtrudeMeasurementInput(
  entity: Extract<SketchEntity, { readonly kind: "circle" }>,
  depthRange: readonly [number, number]
): ExtrudeMeasurementInput {
  const uMin = entity.center[0] - entity.radius;
  const uMax = entity.center[0] + entity.radius;
  const vMin = entity.center[1] - entity.radius;
  const vMax = entity.center[1] + entity.radius;
  const depth = Math.abs(depthRange[1] - depthRange[0]);

  return {
    points: createProfileExtrudeBoundsPoints(
      uMin,
      uMax,
      vMin,
      vMax,
      depthRange
    ),
    centroid: [
      entity.center[0],
      entity.center[1],
      (depthRange[0] + depthRange[1]) / 2
    ],
    volume: Math.PI * entity.radius * entity.radius * depth,
    surfaceArea: 2 * Math.PI * entity.radius * (entity.radius + depth)
  };
}

function createProfileExtrudeBoundsPoints(
  uMin: number,
  uMax: number,
  vMin: number,
  vMax: number,
  depthRange: readonly [number, number]
): readonly Vec3[] {
  return [
    [uMin, vMin, depthRange[0]],
    [uMax, vMin, depthRange[0]],
    [uMax, vMax, depthRange[0]],
    [uMin, vMax, depthRange[0]],
    [uMin, vMin, depthRange[1]],
    [uMax, vMin, depthRange[1]],
    [uMax, vMax, depthRange[1]],
    [uMin, vMax, depthRange[1]]
  ];
}

function createSketchMeasurementFrame(
  document: CadDocument,
  sketch: Sketch,
  ownerPartId: PartId
): SketchMeasurementFrame | undefined {
  if (!sketch.attachment) {
    return createDefaultSketchMeasurementFrame(sketch.plane);
  }

  const references = createBodyGeneratedReferences(
    document,
    sketch.attachment.bodyId,
    ownerPartId
  );
  const face = references?.faces.find(
    (candidate) => candidate.stableId === sketch.attachment?.faceStableId
  );

  if (!face) {
    return undefined;
  }

  return createAttachedSketchMeasurementFrame(sketch, face);
}

function createDefaultSketchMeasurementFrame(
  plane: SketchPlane
): SketchMeasurementFrame {
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

function createAttachedSketchMeasurementFrame(
  sketch: Sketch,
  face: CadGeneratedFaceReference
): SketchMeasurementFrame | undefined {
  if (face.geometricSignature.surfaceType !== "plane") {
    return undefined;
  }

  const profile = face.geometricSignature.profile;
  const normal = face.geometricSignature.normal;

  if (!profile || !normal) {
    return undefined;
  }

  const sourcePlane = face.geometricSignature.sketchPlane;
  const sourceFrame = createDefaultSketchMeasurementFrame(sourcePlane);
  const sourceNormal = createSketchPlaneNormal(sourcePlane);
  const profileCenter = mapSketchPointToMeasurementFrame(
    sourceFrame,
    profile.center
  );
  const depthRange = createExtrudeMeasurementDepthRange(
    face.geometricSignature.depth,
    face.geometricSignature.extrudeSide
  );
  const frameOrigin =
    profile.kind === "rectangle"
      ? createRectangleMeasurementFaceCenter(
          face,
          sourceFrame,
          sourceNormal,
          profileCenter,
          profile.center,
          profile.width,
          profile.height,
          depthRange
        )
      : createCircleMeasurementFaceCenter(
          face,
          sourceNormal,
          profileCenter,
          depthRange
        );

  if (!frameOrigin) {
    return undefined;
  }

  return {
    ...createDefaultSketchMeasurementFrame(sketch.plane),
    origin: frameOrigin
  };
}

function mapSketchPointToMeasurementFrame(
  frame: SketchMeasurementFrame,
  point: Vec2
): Vec3 {
  return cleanVec3([
    frame.origin[0] + frame.uAxis[0] * point[0] + frame.vAxis[0] * point[1],
    frame.origin[1] + frame.uAxis[1] * point[0] + frame.vAxis[1] * point[1],
    frame.origin[2] + frame.uAxis[2] * point[0] + frame.vAxis[2] * point[1]
  ]);
}

function mapSketchPlanePointToMeasurementFrame(
  frame: SketchMeasurementFrame,
  plane: SketchPlane,
  point: Vec3
): Vec3 {
  const [u, v, normalDistance] = getSketchPlaneCoordinates(plane, point);
  const normal = createSketchMeasurementFrameNormal(frame);

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

function createSketchMeasurementFrameNormal(
  frame: SketchMeasurementFrame
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

function createRectangleMeasurementFaceCenter(
  face: CadGeneratedFaceReference,
  sourceFrame: SketchMeasurementFrame,
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
        mapSketchPointToMeasurementFrame(sourceFrame, [
          profileCenter2d[0] - width / 2,
          profileCenter2d[1]
        ]),
        scaleVec3(sourceNormal, midDepth)
      );
    case "side:uMax":
      return addVec3(
        mapSketchPointToMeasurementFrame(sourceFrame, [
          profileCenter2d[0] + width / 2,
          profileCenter2d[1]
        ]),
        scaleVec3(sourceNormal, midDepth)
      );
    case "side:vMin":
      return addVec3(
        mapSketchPointToMeasurementFrame(sourceFrame, [
          profileCenter2d[0],
          profileCenter2d[1] - height / 2
        ]),
        scaleVec3(sourceNormal, midDepth)
      );
    case "side:vMax":
      return addVec3(
        mapSketchPointToMeasurementFrame(sourceFrame, [
          profileCenter2d[0],
          profileCenter2d[1] + height / 2
        ]),
        scaleVec3(sourceNormal, midDepth)
      );
    case "side:circular":
      return undefined;
  }
}

function createCircleMeasurementFaceCenter(
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

function createExtrudeMeasurementDepthRange(
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

function createBounds(points: readonly Vec3[]): CadAxisAlignedBounds {
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

function cleanMeasurementNumber(value: number): number {
  const rounded = Math.round(value * 1e12) / 1e12;
  return Object.is(rounded, -0) ? 0 : rounded;
}
