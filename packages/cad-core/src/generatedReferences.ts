import type {
  BodyId,
  CadGeneratedBodyReference,
  CadGeneratedExtrudeFaceRole,
  CadGeneratedFaceReference,
  CadGeneratedReferenceProfileSignature,
  CadGeneratedReferenceSignature,
  FeatureExtrudeProfileKind,
  FeatureExtrudeSide,
  FeatureId,
  PartId,
  SketchCircleEntitySnapshot,
  SketchEntityId,
  SketchPlane,
  SketchPointEntitySnapshot,
  SketchLineEntitySnapshot,
  SketchRectangleEntitySnapshot,
  SketchId,
  Vec3
} from "@web-cad/cad-protocol";

export interface GeneratedReferencesDocument {
  readonly sketches: ReadonlyMap<SketchId, GeneratedReferencesSketch>;
  readonly features: ReadonlyMap<FeatureId, GeneratedReferencesFeature>;
}

export interface GeneratedReferencesSketch {
  readonly id: SketchId;
  readonly plane: SketchPlane;
  readonly entities: ReadonlyMap<
    SketchEntityId,
    GeneratedReferencesSketchEntity
  >;
}

export type GeneratedReferencesSketchEntity =
  | SketchPointEntitySnapshot
  | SketchLineEntitySnapshot
  | SketchRectangleEntitySnapshot
  | SketchCircleEntitySnapshot;

export interface GeneratedReferencesFeature {
  readonly id: FeatureId;
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
  readonly profileKind: FeatureExtrudeProfileKind;
  readonly depth: number;
  readonly side: FeatureExtrudeSide;
  readonly bodyId: BodyId;
}

export interface BodyGeneratedReferencesSnapshot {
  readonly body: CadGeneratedBodyReference;
  readonly faces: readonly CadGeneratedFaceReference[];
}

export function createBodyGeneratedReferences(
  document: GeneratedReferencesDocument,
  bodyId: BodyId,
  ownerPartId: PartId
): BodyGeneratedReferencesSnapshot | undefined {
  const feature = [...document.features.values()].find(
    (candidate) => candidate.bodyId === bodyId
  );

  if (!feature) {
    return undefined;
  }

  const sketch = document.sketches.get(feature.sketchId);
  const entity = sketch?.entities.get(feature.entityId);

  if (!sketch || !entity) {
    return undefined;
  }

  if (feature.profileKind === "rectangle" && entity.kind !== "rectangle") {
    return undefined;
  }

  if (feature.profileKind === "circle" && entity.kind !== "circle") {
    return undefined;
  }

  const profile = createGeneratedReferenceProfileSignature(entity);
  const body: CadGeneratedBodyReference = {
    kind: "body",
    stableId: `generated:body:${feature.bodyId}`,
    bodyId: feature.bodyId,
    ownerPartId,
    sourceFeatureId: feature.id,
    sourceSketchId: feature.sketchId,
    sourceSketchEntityId: feature.entityId,
    profileKind: feature.profileKind,
    geometricSignature: createGeneratedReferenceSignature(
      feature,
      sketch,
      profile,
      {
        axis: createSketchPlaneNormal(sketch.plane),
        axisRole: "sketchPlaneNormal"
      }
    )
  };

  return {
    body,
    faces:
      feature.profileKind === "rectangle"
        ? createRectangleExtrudeFaceReferences(
            feature,
            sketch,
            profile,
            ownerPartId
          )
        : createCircleExtrudeFaceReferences(
            feature,
            sketch,
            profile,
            ownerPartId
          )
  };
}

function createGeneratedReferenceProfileSignature(
  entity: GeneratedReferencesSketchEntity
): CadGeneratedReferenceProfileSignature {
  if (entity.kind === "rectangle") {
    return {
      kind: "rectangle",
      center: [...entity.center],
      width: entity.width,
      height: entity.height
    };
  }

  if (entity.kind === "circle") {
    return {
      kind: "circle",
      center: [...entity.center],
      radius: entity.radius
    };
  }

  throw new Error(`Unsupported generated reference profile: ${entity.kind}`);
}

function createRectangleExtrudeFaceReferences(
  feature: GeneratedReferencesFeature,
  sketch: GeneratedReferencesSketch,
  profile: CadGeneratedReferenceProfileSignature,
  ownerPartId: PartId
): readonly CadGeneratedFaceReference[] {
  return [
    createGeneratedFaceReference(
      feature,
      sketch,
      profile,
      "startCap",
      ownerPartId,
      {
        surfaceType: "plane",
        normal: createExtrudeCapNormal(sketch.plane, feature.side, "startCap"),
        normalRole: "startCapOutward"
      }
    ),
    createGeneratedFaceReference(
      feature,
      sketch,
      profile,
      "endCap",
      ownerPartId,
      {
        surfaceType: "plane",
        normal: createExtrudeCapNormal(sketch.plane, feature.side, "endCap"),
        normalRole: "endCapOutward"
      }
    ),
    ...(
      [
        "side:uMin",
        "side:uMax",
        "side:vMin",
        "side:vMax"
      ] satisfies readonly CadGeneratedExtrudeFaceRole[]
    ).map((role) =>
      createGeneratedFaceReference(
        feature,
        sketch,
        profile,
        role,
        ownerPartId,
        {
          surfaceType: "plane",
          normal: createRectangleSideNormal(sketch.plane, role),
          normalRole: role
        }
      )
    )
  ];
}

function createCircleExtrudeFaceReferences(
  feature: GeneratedReferencesFeature,
  sketch: GeneratedReferencesSketch,
  profile: CadGeneratedReferenceProfileSignature,
  ownerPartId: PartId
): readonly CadGeneratedFaceReference[] {
  return [
    createGeneratedFaceReference(
      feature,
      sketch,
      profile,
      "startCap",
      ownerPartId,
      {
        surfaceType: "plane",
        normal: createExtrudeCapNormal(sketch.plane, feature.side, "startCap"),
        normalRole: "startCapOutward"
      }
    ),
    createGeneratedFaceReference(
      feature,
      sketch,
      profile,
      "endCap",
      ownerPartId,
      {
        surfaceType: "plane",
        normal: createExtrudeCapNormal(sketch.plane, feature.side, "endCap"),
        normalRole: "endCapOutward"
      }
    ),
    createGeneratedFaceReference(
      feature,
      sketch,
      profile,
      "side:circular",
      ownerPartId,
      {
        surfaceType: "cylinder",
        axis: createSketchPlaneNormal(sketch.plane),
        axisRole: "sketchPlaneNormal"
      }
    )
  ];
}

function createGeneratedFaceReference(
  feature: GeneratedReferencesFeature,
  sketch: GeneratedReferencesSketch,
  profile: CadGeneratedReferenceProfileSignature,
  role: CadGeneratedExtrudeFaceRole,
  ownerPartId: PartId,
  signature: Pick<
    CadGeneratedReferenceSignature,
    "surfaceType" | "normal" | "axis" | "normalRole" | "axisRole"
  >
): CadGeneratedFaceReference {
  return {
    kind: "face",
    stableId: `generated:face:${feature.bodyId}:${role}`,
    bodyId: feature.bodyId,
    ownerPartId,
    sourceFeatureId: feature.id,
    sourceSketchId: feature.sketchId,
    sourceSketchEntityId: feature.entityId,
    role,
    geometricSignature: createGeneratedReferenceSignature(
      feature,
      sketch,
      profile,
      signature
    )
  };
}

function createGeneratedReferenceSignature(
  feature: GeneratedReferencesFeature,
  sketch: GeneratedReferencesSketch,
  profile: CadGeneratedReferenceProfileSignature,
  signature: Pick<
    CadGeneratedReferenceSignature,
    "surfaceType" | "normal" | "axis" | "normalRole" | "axisRole"
  > = {}
): CadGeneratedReferenceSignature {
  return {
    profileKind: feature.profileKind,
    sketchPlane: sketch.plane,
    extrudeSide: feature.side,
    depth: feature.depth,
    profile,
    ...signature
  };
}

function createSketchPlaneNormal(plane: SketchPlane): Vec3 {
  if (plane === "XY") {
    return [0, 0, 1];
  }

  if (plane === "XZ") {
    return [0, 1, 0];
  }

  return [1, 0, 0];
}

function createExtrudeCapNormal(
  plane: SketchPlane,
  side: FeatureExtrudeSide,
  role: "startCap" | "endCap"
): Vec3 {
  const normal = createSketchPlaneNormal(plane);

  if (side === "negative") {
    return role === "startCap" ? normal : negateVector(normal);
  }

  return role === "startCap" ? negateVector(normal) : normal;
}

function createRectangleSideNormal(
  plane: SketchPlane,
  role: CadGeneratedExtrudeFaceRole
): Vec3 {
  if (role === "side:uMin") {
    return plane === "YZ" ? [0, -1, 0] : [-1, 0, 0];
  }

  if (role === "side:uMax") {
    return plane === "YZ" ? [0, 1, 0] : [1, 0, 0];
  }

  if (role === "side:vMin") {
    return plane === "XY" ? [0, -1, 0] : [0, 0, -1];
  }

  if (role === "side:vMax") {
    return plane === "XY" ? [0, 1, 0] : [0, 0, 1];
  }

  return createSketchPlaneNormal(plane);
}

function negateVector(vector: Vec3): Vec3 {
  return [
    negateVectorComponent(vector[0]),
    negateVectorComponent(vector[1]),
    negateVectorComponent(vector[2])
  ];
}

function negateVectorComponent(component: number): number {
  return Object.is(component, 0) ? 0 : -component;
}
