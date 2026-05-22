import type {
  BodyId,
  CadGeneratedEdgeReference,
  CadGeneratedExtrudeEdgeRole,
  CadGeneratedExtrudeFaceRole,
  CadGeneratedExtrudeVertexRole,
  CadGeneratedFaceReference,
  CadGeneratedReference,
  CadGeneratedReferenceProfileSignature,
  CadGeneratedVertexReference,
  CadQueryError,
  DocumentUnits,
  GeneratedReferenceMeasurement,
  PartId,
  SketchPlane,
  Vec2,
  Vec3
} from "@web-cad/cad-protocol";

import { createBodyMeasurements } from "./bodyMeasurements";
import { validateGeneratedReference } from "./generatedReferences";
import type { CadDocument } from "./index";
import {
  cleanMeasurementNumber,
  createExtrudeMeasurementDepthRange,
  createMeasurementBounds,
  createSourceMeasurementFrame,
  distanceVec3,
  mapLocalExtrudePointToSourceMeasurementFrame,
  type SourceMeasurementFrame
} from "./sourceMeasurementGeometry";

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
      readonly frame: SourceMeasurementFrame;
      readonly sketchPlane: SketchPlane;
      readonly profile: CadGeneratedReferenceProfileSignature;
      readonly depthRange: readonly [number, number];
      readonly depth: number;
    }
  | undefined {
  const sketch = document.sketches.get(reference.sourceSketchId);
  const profile = reference.geometricSignature.profile;

  if (!sketch || !profile) {
    return undefined;
  }

  const frame = createSourceMeasurementFrame(document, sketch, ownerPartId);

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
    bounds: createMeasurementBounds(boundsPoints),
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
  profile: CadGeneratedReferenceProfileSignature,
  input: NonNullable<ReturnType<typeof createReferenceMeasurementInput>>
): readonly Vec3[] {
  const localPoints = createFaceLocalPoints(role, profile, input.depthRange);
  return localPoints.map((point) => mapLocalPoint(input, point));
}

function createFaceLocalPoints(
  role: CadGeneratedExtrudeFaceRole,
  profile: CadGeneratedReferenceProfileSignature,
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
  profile: CadGeneratedReferenceProfileSignature,
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
  profile: CadGeneratedReferenceProfileSignature,
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
  profile: Extract<
    CadGeneratedReferenceProfileSignature,
    { readonly kind: "rectangle" }
  >,
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
  profile: Extract<
    CadGeneratedReferenceProfileSignature,
    { readonly kind: "rectangle" }
  >
): Vec2 {
  const extents = createProfileExtents(profile);
  const u = role.includes(":uMin:") ? extents.uMin : extents.uMax;
  const v = role.endsWith(":vMin") ? extents.vMin : extents.vMax;
  return [u, v];
}

function createProfileExtents(profile: CadGeneratedReferenceProfileSignature): {
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

function mapLocalPoint(
  input: NonNullable<ReturnType<typeof createReferenceMeasurementInput>>,
  point: Vec3
): Vec3 {
  return mapLocalExtrudePointToSourceMeasurementFrame(input.frame, point);
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
