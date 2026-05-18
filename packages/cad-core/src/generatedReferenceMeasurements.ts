import type {
  BodyId,
  CadAxisAlignedBounds,
  CadGeneratedEdgeReference,
  CadGeneratedExtrudeEdgeRole,
  CadGeneratedExtrudeFaceRole,
  CadGeneratedExtrudeVertexRole,
  CadGeneratedFaceReference,
  CadGeneratedReference,
  CadGeneratedVertexReference,
  CadQueryError,
  DocumentUnits,
  FeatureExtrudeSide,
  GeneratedReferenceMeasurement,
  PartId,
  SketchPlane,
  Vec2,
  Vec3
} from "@web-cad/cad-protocol";

import { createBodyMeasurements } from "./bodyMeasurements";
import {
  createBodyGeneratedReferences,
  validateGeneratedReference
} from "./generatedReferences";
import type { CadDocument, Sketch } from "./index";

export type GeneratedReferenceMeasurementsResult =
  | {
      readonly ok: true;
      readonly kind: CadGeneratedReference["kind"];
      readonly reference: CadGeneratedReference;
      readonly measurements: GeneratedReferenceMeasurement;
    }
  | {
      readonly ok: false;
      readonly error: CadQueryError;
    };

interface GeneratedReferenceMeasurementsOptions {
  readonly document: CadDocument;
  readonly bodyId: BodyId;
  readonly stableId: string;
  readonly units: DocumentUnits;
  readonly ownerPartId: PartId;
  readonly bodyExists: (bodyId: BodyId) => boolean;
}

interface MeasurementFrame {
  readonly origin: Vec3;
  readonly uAxis: Vec3;
  readonly vAxis: Vec3;
}

type MeasurementProfile =
  | {
      readonly kind: "rectangle";
      readonly center: Vec2;
      readonly width: number;
      readonly height: number;
    }
  | {
      readonly kind: "circle";
      readonly center: Vec2;
      readonly radius: number;
    };

export function createGeneratedReferenceMeasurements(
  options: GeneratedReferenceMeasurementsOptions
): GeneratedReferenceMeasurementsResult {
  const validation = validateGeneratedReference({
    document: options.document,
    ownerPartId: options.ownerPartId,
    bodyId: options.bodyId,
    stableId: options.stableId,
    bodyExists: options.bodyExists,
    requiredOperation: "feature.measureReference"
  });

  if (!validation.ok) {
    return {
      ok: false,
      error: {
        code:
          validation.error.code === "UNSUPPORTED_BODY_REFERENCES"
            ? "UNSUPPORTED_BODY_REFERENCES"
            : validation.error.code === "BODY_NOT_FOUND"
              ? "BODY_NOT_FOUND"
              : "GENERATED_REFERENCE_NOT_FOUND",
        message: validation.error.message,
        bodyId: validation.error.bodyId,
        stableId: validation.error.stableId
      }
    };
  }

  const measurementInput = createReferenceMeasurementInput(
    options.document,
    validation.reference,
    options.ownerPartId
  );

  if (!measurementInput) {
    return {
      ok: false,
      error: {
        code: "UNSUPPORTED_GENERATED_REFERENCE_MEASUREMENTS",
        message: `Generated reference measurements are unavailable for ${options.stableId}. The source feature, profile, or attached sketch reference could not be resolved.`,
        bodyId: options.bodyId,
        stableId: options.stableId
      }
    };
  }

  const base = {
    stableId: validation.reference.stableId,
    bodyId: validation.reference.bodyId,
    sourceFeatureId: validation.reference.sourceFeatureId,
    sourceSketchId: validation.reference.sourceSketchId,
    sourceSketchEntityId: validation.reference.sourceSketchEntityId,
    profileKind: validation.reference.geometricSignature.profileKind,
    units: options.units,
    measurementModel: "sourceAnalytic" as const
  };

  if (validation.reference.kind === "body") {
    const bodyMeasurements = createBodyMeasurements(
      options.document,
      options.bodyId,
      options.units,
      options.ownerPartId
    );

    if (!bodyMeasurements) {
      return {
        ok: false,
        error: {
          code: "UNSUPPORTED_GENERATED_REFERENCE_MEASUREMENTS",
          message: `Generated body measurements are unavailable for ${options.bodyId}. The source feature, profile, or attached sketch reference could not be resolved.`,
          bodyId: options.bodyId,
          stableId: options.stableId
        }
      };
    }

    return {
      ok: true,
      kind: validation.kind,
      reference: validation.reference,
      measurements: {
        ...base,
        kind: "body",
        bounds: bodyMeasurements.localBounds,
        volume: bodyMeasurements.volume,
        centroid: bodyMeasurements.centroid
      }
    };
  }

  const measurements =
    validation.reference.kind === "face"
      ? createFaceMeasurement(base, validation.reference, measurementInput)
      : validation.reference.kind === "edge"
        ? createEdgeMeasurement(base, validation.reference, measurementInput)
        : createVertexMeasurement(base, validation.reference, measurementInput);

  if (!measurements) {
    return {
      ok: false,
      error: {
        code: "UNSUPPORTED_GENERATED_REFERENCE_MEASUREMENTS",
        message: `Generated reference measurements are unavailable for ${options.stableId}.`,
        bodyId: options.bodyId,
        stableId: options.stableId
      }
    };
  }

  return {
    ok: true,
    kind: validation.kind,
    reference: validation.reference,
    measurements
  };
}

function createReferenceMeasurementInput(
  document: CadDocument,
  reference: CadGeneratedReference,
  ownerPartId: PartId
):
  | {
      readonly frame: MeasurementFrame;
      readonly sketchPlane: SketchPlane;
      readonly profile: MeasurementProfile;
      readonly depthRange: readonly [number, number];
      readonly depth: number;
    }
  | undefined {
  const sketch = document.sketches.get(reference.sourceSketchId);
  const profile = reference.geometricSignature.profile;

  if (!sketch || !profile) {
    return undefined;
  }

  const frame = createSketchMeasurementFrame(document, sketch, ownerPartId);

  if (!frame) {
    return undefined;
  }

  const depthRange = createExtrudeMeasurementDepthRange(
    reference.geometricSignature.depth,
    reference.geometricSignature.extrudeSide
  );

  return {
    frame,
    sketchPlane: reference.geometricSignature.sketchPlane,
    profile,
    depthRange,
    depth: Math.abs(depthRange[1] - depthRange[0])
  };
}

function createFaceMeasurement(
  base: Omit<GeneratedReferenceMeasurement, "kind">,
  reference: CadGeneratedFaceReference,
  input: NonNullable<ReturnType<typeof createReferenceMeasurementInput>>
): GeneratedReferenceMeasurement | undefined {
  const profile = input.profile;
  const boundsPoints = createFaceBoundsPoints(reference.role, profile, input);

  if (boundsPoints.length === 0) {
    return undefined;
  }

  return {
    ...base,
    kind: "face",
    role: reference.role,
    area: cleanMeasurementNumber(
      createFaceArea(reference.role, profile, input)
    ),
    bounds: createBounds(boundsPoints),
    center: createFaceCenter(reference.role, profile, input),
    surfaceType: reference.geometricSignature.surfaceType ?? "plane",
    ...(reference.geometricSignature.normal
      ? { normal: reference.geometricSignature.normal }
      : {}),
    ...(reference.geometricSignature.normalRole
      ? { normalRole: reference.geometricSignature.normalRole }
      : {}),
    ...(reference.geometricSignature.axis
      ? { axis: reference.geometricSignature.axis }
      : {}),
    ...(reference.geometricSignature.axisRole
      ? { axisRole: reference.geometricSignature.axisRole }
      : {})
  };
}

function createEdgeMeasurement(
  base: Omit<GeneratedReferenceMeasurement, "kind">,
  reference: CadGeneratedEdgeReference,
  input: NonNullable<ReturnType<typeof createReferenceMeasurementInput>>
): GeneratedReferenceMeasurement | undefined {
  if (
    reference.role === "start:circular" ||
    reference.role === "end:circular"
  ) {
    if (input.profile.kind !== "circle") {
      return undefined;
    }

    const depth =
      reference.role === "start:circular"
        ? input.depthRange[0]
        : input.depthRange[1];

    return {
      ...base,
      kind: "edge",
      role: reference.role,
      length: cleanMeasurementNumber(2 * Math.PI * input.profile.radius),
      curveType: "circle",
      center: mapLocalPoint(input, [
        input.profile.center[0],
        input.profile.center[1],
        depth
      ]),
      radius: input.profile.radius,
      ...(reference.geometricSignature.axis
        ? { axis: reference.geometricSignature.axis }
        : {}),
      ...(reference.geometricSignature.axisRole
        ? { axisRole: reference.geometricSignature.axisRole }
        : {})
    };
  }

  if (input.profile.kind !== "rectangle") {
    return undefined;
  }

  const endpoints = createRectangleEdgeEndpoints(
    reference.role,
    input.profile,
    input.depthRange
  );

  if (!endpoints) {
    return undefined;
  }

  const startPoint = mapLocalPoint(input, endpoints[0]);
  const endPoint = mapLocalPoint(input, endpoints[1]);

  return {
    ...base,
    kind: "edge",
    role: reference.role,
    length: cleanMeasurementNumber(distanceVec3(startPoint, endPoint)),
    curveType: "line",
    startPoint,
    endPoint,
    ...(reference.geometricSignature.axis
      ? { axis: reference.geometricSignature.axis }
      : {}),
    ...(reference.geometricSignature.axisRole
      ? { axisRole: reference.geometricSignature.axisRole }
      : {})
  };
}

function createVertexMeasurement(
  base: Omit<GeneratedReferenceMeasurement, "kind">,
  reference: CadGeneratedVertexReference,
  input: NonNullable<ReturnType<typeof createReferenceMeasurementInput>>
): GeneratedReferenceMeasurement | undefined {
  if (input.profile.kind !== "rectangle") {
    return undefined;
  }

  const profilePoint = createRectangleVertexPoint(
    reference.role,
    input.profile
  );
  const depth = reference.role.startsWith("start:")
    ? input.depthRange[0]
    : input.depthRange[1];

  return {
    ...base,
    kind: "vertex",
    role: reference.role,
    point: mapLocalPoint(input, [profilePoint[0], profilePoint[1], depth])
  };
}

function createFaceBoundsPoints(
  role: CadGeneratedExtrudeFaceRole,
  profile: MeasurementProfile,
  input: NonNullable<ReturnType<typeof createReferenceMeasurementInput>>
): readonly Vec3[] {
  const localPoints = createFaceLocalPoints(role, profile, input.depthRange);
  return localPoints.map((point) => mapLocalPoint(input, point));
}

function createFaceLocalPoints(
  role: CadGeneratedExtrudeFaceRole,
  profile: MeasurementProfile,
  depthRange: readonly [number, number]
): readonly Vec3[] {
  const extents = createProfileExtents(profile);

  if (role === "startCap" || role === "endCap") {
    const depth = role === "startCap" ? depthRange[0] : depthRange[1];
    return createCapLocalPoints(extents, depth);
  }

  if (profile.kind === "circle") {
    return createProfileExtrudeBoundsPoints(extents, depthRange);
  }

  switch (role) {
    case "side:uMin":
      return [
        [extents.uMin, extents.vMin, depthRange[0]],
        [extents.uMin, extents.vMax, depthRange[0]],
        [extents.uMin, extents.vMax, depthRange[1]],
        [extents.uMin, extents.vMin, depthRange[1]]
      ];
    case "side:uMax":
      return [
        [extents.uMax, extents.vMin, depthRange[0]],
        [extents.uMax, extents.vMax, depthRange[0]],
        [extents.uMax, extents.vMax, depthRange[1]],
        [extents.uMax, extents.vMin, depthRange[1]]
      ];
    case "side:vMin":
      return [
        [extents.uMin, extents.vMin, depthRange[0]],
        [extents.uMax, extents.vMin, depthRange[0]],
        [extents.uMax, extents.vMin, depthRange[1]],
        [extents.uMin, extents.vMin, depthRange[1]]
      ];
    case "side:vMax":
      return [
        [extents.uMin, extents.vMax, depthRange[0]],
        [extents.uMax, extents.vMax, depthRange[0]],
        [extents.uMax, extents.vMax, depthRange[1]],
        [extents.uMin, extents.vMax, depthRange[1]]
      ];
    case "side:circular":
      return createProfileExtrudeBoundsPoints(extents, depthRange);
  }
}

function createFaceArea(
  role: CadGeneratedExtrudeFaceRole,
  profile: MeasurementProfile,
  input: NonNullable<ReturnType<typeof createReferenceMeasurementInput>>
): number {
  if (profile.kind === "circle") {
    return role === "side:circular"
      ? 2 * Math.PI * profile.radius * input.depth
      : Math.PI * profile.radius * profile.radius;
  }

  if (role === "startCap" || role === "endCap") {
    return profile.width * profile.height;
  }

  if (role === "side:uMin" || role === "side:uMax") {
    return profile.height * input.depth;
  }

  return profile.width * input.depth;
}

function createFaceCenter(
  role: CadGeneratedExtrudeFaceRole,
  profile: MeasurementProfile,
  input: NonNullable<ReturnType<typeof createReferenceMeasurementInput>>
): Vec3 {
  const depth =
    role === "startCap"
      ? input.depthRange[0]
      : role === "endCap"
        ? input.depthRange[1]
        : (input.depthRange[0] + input.depthRange[1]) / 2;

  if (profile.kind === "circle" || role === "startCap" || role === "endCap") {
    return mapLocalPoint(input, [profile.center[0], profile.center[1], depth]);
  }

  const extents = createProfileExtents(profile);

  switch (role) {
    case "side:uMin":
      return mapLocalPoint(input, [extents.uMin, profile.center[1], depth]);
    case "side:uMax":
      return mapLocalPoint(input, [extents.uMax, profile.center[1], depth]);
    case "side:vMin":
      return mapLocalPoint(input, [profile.center[0], extents.vMin, depth]);
    case "side:vMax":
      return mapLocalPoint(input, [profile.center[0], extents.vMax, depth]);
    case "side:circular":
      return mapLocalPoint(input, [
        profile.center[0],
        profile.center[1],
        depth
      ]);
  }
}

function createRectangleEdgeEndpoints(
  role: CadGeneratedExtrudeEdgeRole,
  profile: Extract<MeasurementProfile, { readonly kind: "rectangle" }>,
  depthRange: readonly [number, number]
): readonly [Vec3, Vec3] | undefined {
  const extents = createProfileExtents(profile);

  if (role.startsWith("longitudinal:")) {
    const [uRole, vRole] = createLongitudinalProfileRoles(role);
    const u = uRole === "uMin" ? extents.uMin : extents.uMax;
    const v = vRole === "vMin" ? extents.vMin : extents.vMax;
    return [
      [u, v, depthRange[0]],
      [u, v, depthRange[1]]
    ];
  }

  const [cap, edgeRole] = role.split(":") as [
    "start" | "end",
    "uMin" | "uMax" | "vMin" | "vMax"
  ];
  const depth = cap === "start" ? depthRange[0] : depthRange[1];

  switch (edgeRole) {
    case "uMin":
      return [
        [extents.uMin, extents.vMin, depth],
        [extents.uMin, extents.vMax, depth]
      ];
    case "uMax":
      return [
        [extents.uMax, extents.vMin, depth],
        [extents.uMax, extents.vMax, depth]
      ];
    case "vMin":
      return [
        [extents.uMin, extents.vMin, depth],
        [extents.uMax, extents.vMin, depth]
      ];
    case "vMax":
      return [
        [extents.uMin, extents.vMax, depth],
        [extents.uMax, extents.vMax, depth]
      ];
  }
}

function createRectangleVertexPoint(
  role: CadGeneratedExtrudeVertexRole,
  profile: Extract<MeasurementProfile, { readonly kind: "rectangle" }>
): Vec2 {
  const extents = createProfileExtents(profile);
  const u = role.includes(":uMin:") ? extents.uMin : extents.uMax;
  const v = role.endsWith(":vMin") ? extents.vMin : extents.vMax;
  return [u, v];
}

function createProfileExtents(profile: MeasurementProfile): {
  readonly uMin: number;
  readonly uMax: number;
  readonly vMin: number;
  readonly vMax: number;
} {
  if (profile.kind === "rectangle") {
    return {
      uMin: profile.center[0] - profile.width / 2,
      uMax: profile.center[0] + profile.width / 2,
      vMin: profile.center[1] - profile.height / 2,
      vMax: profile.center[1] + profile.height / 2
    };
  }

  return {
    uMin: profile.center[0] - profile.radius,
    uMax: profile.center[0] + profile.radius,
    vMin: profile.center[1] - profile.radius,
    vMax: profile.center[1] + profile.radius
  };
}

function createCapLocalPoints(
  extents: {
    readonly uMin: number;
    readonly uMax: number;
    readonly vMin: number;
    readonly vMax: number;
  },
  depth: number
): readonly Vec3[] {
  return [
    [extents.uMin, extents.vMin, depth],
    [extents.uMax, extents.vMin, depth],
    [extents.uMax, extents.vMax, depth],
    [extents.uMin, extents.vMax, depth]
  ];
}

function createProfileExtrudeBoundsPoints(
  extents: {
    readonly uMin: number;
    readonly uMax: number;
    readonly vMin: number;
    readonly vMax: number;
  },
  depthRange: readonly [number, number]
): readonly Vec3[] {
  return [
    ...createCapLocalPoints(extents, depthRange[0]),
    ...createCapLocalPoints(extents, depthRange[1])
  ];
}

function createSketchMeasurementFrame(
  document: CadDocument,
  sketch: Sketch,
  ownerPartId: PartId
): MeasurementFrame | undefined {
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

  if (!face || face.geometricSignature.surfaceType !== "plane") {
    return undefined;
  }

  return createAttachedSketchMeasurementFrame(sketch, face);
}

function createAttachedSketchMeasurementFrame(
  sketch: Sketch,
  face: CadGeneratedFaceReference
): MeasurementFrame | undefined {
  const profile = face.geometricSignature.profile;
  const normal = face.geometricSignature.normal;

  if (!profile || !normal) {
    return undefined;
  }

  const sourcePlane = face.geometricSignature.sketchPlane;
  const sourceFrame = createDefaultSketchMeasurementFrame(sourcePlane);
  const sourceNormal = createSketchPlaneNormal(sourcePlane);
  const profileCenter = mapSketchPointToFrame(sourceFrame, profile.center);
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
          profile.center,
          profile.width,
          profile.height,
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

  return {
    ...createDefaultSketchMeasurementFrame(sketch.plane),
    origin
  };
}

function createRectangleFaceCenter(
  role: CadGeneratedExtrudeFaceRole,
  sourceFrame: MeasurementFrame,
  sourceNormal: Vec3,
  profileCenter: Vec3,
  profileCenter2d: Vec2,
  width: number,
  height: number,
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
        mapSketchPointToFrame(sourceFrame, [
          profileCenter2d[0] - width / 2,
          profileCenter2d[1]
        ]),
        scaleVec3(sourceNormal, midDepth)
      );
    case "side:uMax":
      return addVec3(
        mapSketchPointToFrame(sourceFrame, [
          profileCenter2d[0] + width / 2,
          profileCenter2d[1]
        ]),
        scaleVec3(sourceNormal, midDepth)
      );
    case "side:vMin":
      return addVec3(
        mapSketchPointToFrame(sourceFrame, [
          profileCenter2d[0],
          profileCenter2d[1] - height / 2
        ]),
        scaleVec3(sourceNormal, midDepth)
      );
    case "side:vMax":
      return addVec3(
        mapSketchPointToFrame(sourceFrame, [
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
}

function mapLocalPoint(
  input: NonNullable<ReturnType<typeof createReferenceMeasurementInput>>,
  point: Vec3
): Vec3 {
  const [u, v, normalDistance] = getSketchPlaneCoordinates(
    input.sketchPlane,
    point
  );
  const normal = createFrameNormal(input.frame);

  return cleanVec3([
    input.frame.origin[0] +
      input.frame.uAxis[0] * u +
      input.frame.vAxis[0] * v +
      normal[0] * normalDistance,
    input.frame.origin[1] +
      input.frame.uAxis[1] * u +
      input.frame.vAxis[1] * v +
      normal[1] * normalDistance,
    input.frame.origin[2] +
      input.frame.uAxis[2] * u +
      input.frame.vAxis[2] * v +
      normal[2] * normalDistance
  ]);
}

function mapSketchPointToFrame(frame: MeasurementFrame, point: Vec2): Vec3 {
  return cleanVec3([
    frame.origin[0] + frame.uAxis[0] * point[0] + frame.vAxis[0] * point[1],
    frame.origin[1] + frame.uAxis[1] * point[0] + frame.vAxis[1] * point[1],
    frame.origin[2] + frame.uAxis[2] * point[0] + frame.vAxis[2] * point[1]
  ]);
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

function createDefaultSketchMeasurementFrame(
  plane: SketchPlane
): MeasurementFrame {
  switch (plane) {
    case "XY":
      return { origin: [0, 0, 0], uAxis: [1, 0, 0], vAxis: [0, 1, 0] };
    case "XZ":
      return { origin: [0, 0, 0], uAxis: [1, 0, 0], vAxis: [0, 0, 1] };
    case "YZ":
      return { origin: [0, 0, 0], uAxis: [0, 1, 0], vAxis: [0, 0, 1] };
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

function createFrameNormal(frame: MeasurementFrame): Vec3 {
  return normalizeVec3(crossVec3(frame.uAxis, frame.vAxis));
}

function createLongitudinalProfileRoles(
  role: CadGeneratedExtrudeEdgeRole
): readonly ["uMin" | "uMax", "vMin" | "vMax"] {
  const [, uRole, vRole] = role.split(":") as [
    "longitudinal",
    "uMin" | "uMax",
    "vMin" | "vMax"
  ];

  return [uRole, vRole];
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

function distanceVec3(left: Vec3, right: Vec3): number {
  return Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2]);
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
