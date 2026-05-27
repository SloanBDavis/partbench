import type {
  BodyId,
  CadGeneratedBodyReference,
  CadGeneratedEdgeReference,
  CadGeneratedEntityKind,
  CadGeneratedExtrudeEdgeRole,
  CadGeneratedExtrudeFaceRole,
  CadGeneratedExtrudeVertexRole,
  CadGeneratedFaceReference,
  CadGeneratedReference,
  CadGeneratedReferenceEligibleOperation,
  CadGeneratedReferenceProfileSignature,
  CadGeneratedReferenceSignature,
  CadGeneratedVertexReference,
  FeatureExtrudeOperationMode,
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
  Vec2,
  Vec3
} from "@web-cad/cad-protocol";

const SEMANTIC_REFERENCE_NOTE =
  "Generated references are semantic first-slice references, not exact B-rep topology.";
const MEASURE_AND_SELECT_OPERATIONS = [
  "feature.measureReference",
  "feature.selectReference"
] satisfies readonly CadGeneratedReferenceEligibleOperation[];
const PLANAR_FACE_OPERATIONS = [
  "feature.attachSketchPlane",
  "feature.measureReference",
  "feature.selectReference"
] satisfies readonly CadGeneratedReferenceEligibleOperation[];
const CIRCULAR_SIDE_FACE_NOTE =
  "Circular side faces are not planar and are not eligible for sketch-plane attachment.";

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

export type GeneratedReferencesFeature =
  | GeneratedReferencesExtrudeFeature
  | GeneratedReferencesUnsupportedFeature;

export interface GeneratedReferencesExtrudeFeature {
  readonly id: FeatureId;
  readonly kind: "extrude";
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
  readonly profileKind: FeatureExtrudeProfileKind;
  readonly depth: number;
  readonly side: FeatureExtrudeSide;
  readonly operationMode: FeatureExtrudeOperationMode;
  readonly targetBodyId?: BodyId;
  readonly bodyId: BodyId;
}

export interface GeneratedReferencesUnsupportedFeature {
  readonly id: FeatureId;
  readonly kind: "revolve";
  readonly bodyId: BodyId;
}

export interface BodyGeneratedReferencesSnapshot {
  readonly body: CadGeneratedBodyReference;
  readonly faces: readonly CadGeneratedFaceReference[];
  readonly edges: readonly CadGeneratedEdgeReference[];
  readonly vertices: readonly CadGeneratedVertexReference[];
}

export interface BodyGeneratedReferenceResolution {
  readonly kind: CadGeneratedReference["kind"];
  readonly reference: CadGeneratedReference;
}

export type GeneratedReferenceValidationErrorCode =
  | "BODY_NOT_FOUND"
  | "UNSUPPORTED_BODY_REFERENCES"
  | "GENERATED_REFERENCE_NOT_FOUND"
  | "GENERATED_REFERENCE_KIND_MISMATCH"
  | "GENERATED_REFERENCE_OPERATION_NOT_ELIGIBLE";

export interface GeneratedReferenceValidationError {
  readonly code: GeneratedReferenceValidationErrorCode;
  readonly message: string;
  readonly bodyId: BodyId;
  readonly stableId?: string;
  readonly expectedKind?: CadGeneratedEntityKind;
  readonly actualKind?: CadGeneratedEntityKind;
  readonly requiredOperation?: CadGeneratedReferenceEligibleOperation;
}

export interface ValidateGeneratedReferenceOptions {
  readonly document: GeneratedReferencesDocument;
  readonly ownerPartId: PartId;
  readonly bodyId: BodyId;
  readonly stableId: string;
  readonly bodyExists: (bodyId: BodyId) => boolean;
  readonly expectedKind?: CadGeneratedEntityKind;
  readonly requiredOperation?: CadGeneratedReferenceEligibleOperation;
}

export type GeneratedReferenceValidationResult =
  | {
      readonly ok: true;
      readonly kind: CadGeneratedEntityKind;
      readonly reference: CadGeneratedReference;
      readonly references: BodyGeneratedReferencesSnapshot;
    }
  | {
      readonly ok: false;
      readonly error: GeneratedReferenceValidationError;
    };

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

  if (feature.kind !== "extrude") {
    return undefined;
  }

  if (feature.operationMode !== "newBody") {
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
    label: createBodyReferenceLabel(feature.profileKind),
    description: createBodyReferenceDescription(feature),
    eligibleOperations: createBodyEligibleOperations(),
    eligibilityNotes: createBodyEligibilityNotes(),
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
          ),
    edges:
      feature.profileKind === "rectangle"
        ? createRectangleExtrudeEdgeReferences(
            feature,
            sketch,
            profile,
            ownerPartId
          )
        : createCircleExtrudeEdgeReferences(
            feature,
            sketch,
            profile,
            ownerPartId
          ),
    vertices:
      feature.profileKind === "rectangle" && profile.kind === "rectangle"
        ? createRectangleExtrudeVertexReferences(
            feature,
            sketch,
            profile,
            ownerPartId
          )
        : []
  };
}

export function validateGeneratedReference(
  options: ValidateGeneratedReferenceOptions
): GeneratedReferenceValidationResult {
  const references = createBodyGeneratedReferences(
    options.document,
    options.bodyId,
    options.ownerPartId
  );

  if (!references) {
    return {
      ok: false,
      error: options.bodyExists(options.bodyId)
        ? {
            code: "UNSUPPORTED_BODY_REFERENCES",
            message:
              "Generated references are currently available only for authored sketch-extrude bodies.",
            bodyId: options.bodyId,
            stableId: options.stableId
          }
        : {
            code: "BODY_NOT_FOUND",
            message: `Body does not exist: ${options.bodyId}`,
            bodyId: options.bodyId,
            stableId: options.stableId
          }
    };
  }

  const resolution = resolveGeneratedReference(references, options.stableId);

  if (!resolution) {
    return {
      ok: false,
      error: {
        code: "GENERATED_REFERENCE_NOT_FOUND",
        message: `Generated reference does not exist on body ${options.bodyId}: ${options.stableId}`,
        bodyId: options.bodyId,
        stableId: options.stableId
      }
    };
  }

  if (
    options.expectedKind !== undefined &&
    resolution.kind !== options.expectedKind
  ) {
    return {
      ok: false,
      error: {
        code: "GENERATED_REFERENCE_KIND_MISMATCH",
        message: `Expected generated reference ${options.stableId} to be a ${options.expectedKind}, but found ${resolution.kind}.`,
        bodyId: options.bodyId,
        stableId: options.stableId,
        expectedKind: options.expectedKind,
        actualKind: resolution.kind
      }
    };
  }

  if (
    options.requiredOperation !== undefined &&
    !resolution.reference.eligibleOperations.includes(options.requiredOperation)
  ) {
    return {
      ok: false,
      error: {
        code: "GENERATED_REFERENCE_OPERATION_NOT_ELIGIBLE",
        message: `Generated reference ${options.stableId} is not eligible for ${options.requiredOperation}.`,
        bodyId: options.bodyId,
        stableId: options.stableId,
        actualKind: resolution.kind,
        requiredOperation: options.requiredOperation
      }
    };
  }

  return {
    ok: true,
    kind: resolution.kind,
    reference: resolution.reference,
    references
  };
}

export function resolveGeneratedReference(
  references: BodyGeneratedReferencesSnapshot,
  stableId: string
): BodyGeneratedReferenceResolution | undefined {
  if (references.body.stableId === stableId) {
    return {
      kind: references.body.kind,
      reference: references.body
    };
  }

  const reference = [
    ...references.faces,
    ...references.edges,
    ...references.vertices
  ].find((candidate) => candidate.stableId === stableId);

  if (!reference) {
    return undefined;
  }

  return {
    kind: reference.kind,
    reference
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
  feature: GeneratedReferencesExtrudeFeature,
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
  feature: GeneratedReferencesExtrudeFeature,
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

function createRectangleExtrudeEdgeReferences(
  feature: GeneratedReferencesExtrudeFeature,
  sketch: GeneratedReferencesSketch,
  profile: CadGeneratedReferenceProfileSignature,
  ownerPartId: PartId
): readonly CadGeneratedEdgeReference[] {
  const profileEdgeRoles = ["uMin", "uMax", "vMin", "vMax"] as const;
  const startEdges = profileEdgeRoles.map((profileRole) =>
    createGeneratedEdgeReference(
      feature,
      sketch,
      profile,
      `start:${profileRole}`,
      ownerPartId,
      ["startCap", createRectangleSideFaceRole(profileRole)],
      {
        curveType: "line",
        axis: createRectangleProfileEdgeAxis(sketch.plane, profileRole),
        axisRole: createRectangleProfileEdgeAxisRole(profileRole)
      }
    )
  );
  const endEdges = profileEdgeRoles.map((profileRole) =>
    createGeneratedEdgeReference(
      feature,
      sketch,
      profile,
      `end:${profileRole}`,
      ownerPartId,
      ["endCap", createRectangleSideFaceRole(profileRole)],
      {
        curveType: "line",
        axis: createRectangleProfileEdgeAxis(sketch.plane, profileRole),
        axisRole: createRectangleProfileEdgeAxisRole(profileRole)
      }
    )
  );
  const longitudinalRoles = [
    "longitudinal:uMin:vMin",
    "longitudinal:uMin:vMax",
    "longitudinal:uMax:vMin",
    "longitudinal:uMax:vMax"
  ] satisfies readonly CadGeneratedExtrudeEdgeRole[];
  const longitudinalEdges = longitudinalRoles.map((role) =>
    createGeneratedEdgeReference(
      feature,
      sketch,
      profile,
      role,
      ownerPartId,
      createLongitudinalAdjacentFaceRoles(role),
      {
        curveType: "line",
        axis: createSketchPlaneNormal(sketch.plane),
        axisRole: "sketchPlaneNormal"
      }
    )
  );

  return [...startEdges, ...endEdges, ...longitudinalEdges];
}

function createCircleExtrudeEdgeReferences(
  feature: GeneratedReferencesExtrudeFeature,
  sketch: GeneratedReferencesSketch,
  profile: CadGeneratedReferenceProfileSignature,
  ownerPartId: PartId
): readonly CadGeneratedEdgeReference[] {
  return [
    createGeneratedEdgeReference(
      feature,
      sketch,
      profile,
      "start:circular",
      ownerPartId,
      ["startCap", "side:circular"],
      {
        curveType: "circle",
        axis: createSketchPlaneNormal(sketch.plane),
        axisRole: "sketchPlaneNormal"
      }
    ),
    createGeneratedEdgeReference(
      feature,
      sketch,
      profile,
      "end:circular",
      ownerPartId,
      ["endCap", "side:circular"],
      {
        curveType: "circle",
        axis: createSketchPlaneNormal(sketch.plane),
        axisRole: "sketchPlaneNormal"
      }
    )
  ];
}

type RectangleProfileSignature = Extract<
  CadGeneratedReferenceProfileSignature,
  { readonly kind: "rectangle" }
>;

function createRectangleExtrudeVertexReferences(
  feature: GeneratedReferencesExtrudeFeature,
  sketch: GeneratedReferencesSketch,
  profile: RectangleProfileSignature,
  ownerPartId: PartId
): readonly CadGeneratedVertexReference[] {
  const roles = [
    "start:uMin:vMin",
    "start:uMin:vMax",
    "start:uMax:vMin",
    "start:uMax:vMax",
    "end:uMin:vMin",
    "end:uMin:vMax",
    "end:uMax:vMin",
    "end:uMax:vMax"
  ] satisfies readonly CadGeneratedExtrudeVertexRole[];

  return roles.map((role) =>
    createGeneratedVertexReference(
      feature,
      sketch,
      profile,
      role,
      ownerPartId,
      createVertexAdjacentFaceRoles(role),
      createVertexAdjacentEdgeRoles(role),
      {
        axis: createSketchPlaneNormal(sketch.plane),
        axisRole: "sketchPlaneNormal",
        profilePoint: createRectangleVertexProfilePoint(profile, role),
        positionRole: createVertexPositionRole(role)
      }
    )
  );
}

function createGeneratedFaceReference(
  feature: GeneratedReferencesExtrudeFeature,
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
    label: createFaceReferenceLabel(role),
    description: createFaceReferenceDescription(role),
    eligibleOperations: createFaceEligibleOperations(role),
    eligibilityNotes: createFaceEligibilityNotes(role),
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

function createGeneratedEdgeReference(
  feature: GeneratedReferencesExtrudeFeature,
  sketch: GeneratedReferencesSketch,
  profile: CadGeneratedReferenceProfileSignature,
  role: CadGeneratedExtrudeEdgeRole,
  ownerPartId: PartId,
  adjacentFaceRoles: readonly CadGeneratedExtrudeFaceRole[],
  signature: Pick<
    CadGeneratedReferenceSignature,
    "curveType" | "axis" | "axisRole"
  >
): CadGeneratedEdgeReference {
  return {
    kind: "edge",
    stableId: `generated:edge:${feature.bodyId}:${role}`,
    label: createEdgeReferenceLabel(role),
    description: createEdgeReferenceDescription(role),
    eligibleOperations: createEdgeEligibleOperations(),
    eligibilityNotes: createEdgeEligibilityNotes(),
    bodyId: feature.bodyId,
    ownerPartId,
    sourceFeatureId: feature.id,
    sourceSketchId: feature.sketchId,
    sourceSketchEntityId: feature.entityId,
    role,
    adjacentFaceRoles,
    geometricSignature: createGeneratedReferenceSignature(
      feature,
      sketch,
      profile,
      signature
    )
  };
}

function createGeneratedVertexReference(
  feature: GeneratedReferencesExtrudeFeature,
  sketch: GeneratedReferencesSketch,
  profile: CadGeneratedReferenceProfileSignature,
  role: CadGeneratedExtrudeVertexRole,
  ownerPartId: PartId,
  adjacentFaceRoles: readonly CadGeneratedExtrudeFaceRole[],
  adjacentEdgeRoles: readonly CadGeneratedExtrudeEdgeRole[],
  signature: Pick<
    CadGeneratedReferenceSignature,
    "axis" | "axisRole" | "profilePoint" | "positionRole"
  >
): CadGeneratedVertexReference {
  return {
    kind: "vertex",
    stableId: `generated:vertex:${feature.bodyId}:${role}`,
    label: createVertexReferenceLabel(role),
    description: createVertexReferenceDescription(role),
    eligibleOperations: createVertexEligibleOperations(),
    eligibilityNotes: createVertexEligibilityNotes(),
    bodyId: feature.bodyId,
    ownerPartId,
    sourceFeatureId: feature.id,
    sourceSketchId: feature.sketchId,
    sourceSketchEntityId: feature.entityId,
    role,
    adjacentFaceRoles,
    adjacentEdgeRoles,
    geometricSignature: createGeneratedReferenceSignature(
      feature,
      sketch,
      profile,
      signature
    )
  };
}

function createGeneratedReferenceSignature(
  feature: GeneratedReferencesExtrudeFeature,
  sketch: GeneratedReferencesSketch,
  profile: CadGeneratedReferenceProfileSignature,
  signature: Pick<
    CadGeneratedReferenceSignature,
    | "surfaceType"
    | "curveType"
    | "normal"
    | "axis"
    | "normalRole"
    | "axisRole"
    | "profilePoint"
    | "positionRole"
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

type RectangleProfileEdgeRole = "uMin" | "uMax" | "vMin" | "vMax";

function createBodyReferenceLabel(
  profileKind: FeatureExtrudeProfileKind
): string {
  return `${capitalize(profileKind)} extrude body`;
}

function createBodyReferenceDescription(
  feature: GeneratedReferencesExtrudeFeature
): string {
  return `Solid body generated by ${feature.profileKind} extrude feature ${feature.id}.`;
}

function createBodyEligibleOperations(): readonly CadGeneratedReferenceEligibleOperation[] {
  return MEASURE_AND_SELECT_OPERATIONS;
}

function createBodyEligibilityNotes(): readonly string[] {
  return [SEMANTIC_REFERENCE_NOTE];
}

function createFaceReferenceLabel(role: CadGeneratedExtrudeFaceRole): string {
  if (role === "startCap") {
    return "Start cap";
  }

  if (role === "endCap") {
    return "End cap";
  }

  if (role === "side:circular") {
    return "Circular side face";
  }

  return `${role.replace("side:", "")} side face`;
}

function createFaceReferenceDescription(
  role: CadGeneratedExtrudeFaceRole
): string {
  if (role === "startCap") {
    return "Cap face at the start of the extrude.";
  }

  if (role === "endCap") {
    return "Cap face at the end of the extrude.";
  }

  if (role === "side:circular") {
    return "Cylindrical side face generated from the circle profile.";
  }

  return `Side face generated from the rectangle ${role.replace(
    "side:",
    ""
  )} profile edge.`;
}

function createFaceEligibleOperations(
  role: CadGeneratedExtrudeFaceRole
): readonly CadGeneratedReferenceEligibleOperation[] {
  return role === "side:circular"
    ? MEASURE_AND_SELECT_OPERATIONS
    : PLANAR_FACE_OPERATIONS;
}

function createFaceEligibilityNotes(
  role: CadGeneratedExtrudeFaceRole
): readonly string[] {
  return role === "side:circular"
    ? [CIRCULAR_SIDE_FACE_NOTE, SEMANTIC_REFERENCE_NOTE]
    : [SEMANTIC_REFERENCE_NOTE];
}

function createEdgeReferenceLabel(role: CadGeneratedExtrudeEdgeRole): string {
  if (role === "start:circular") {
    return "Start circular edge";
  }

  if (role === "end:circular") {
    return "End circular edge";
  }

  if (role.startsWith("longitudinal:")) {
    const [uRole, vRole] = createLongitudinalProfileRoles(role);
    return `${uRole}/${vRole} longitudinal edge`;
  }

  const [position, profileRole] = role.split(":") as [
    "start" | "end",
    RectangleProfileEdgeRole
  ];

  return `${capitalize(position)} ${profileRole} edge`;
}

function createEdgeReferenceDescription(
  role: CadGeneratedExtrudeEdgeRole
): string {
  if (role === "start:circular") {
    return "Circular profile edge on the start cap.";
  }

  if (role === "end:circular") {
    return "Circular profile edge on the end cap.";
  }

  if (role.startsWith("longitudinal:")) {
    const [uRole, vRole] = createLongitudinalProfileRoles(role);
    return `Longitudinal edge joining the ${uRole}/${vRole} rectangle corners.`;
  }

  const [position, profileRole] = role.split(":") as [
    "start" | "end",
    RectangleProfileEdgeRole
  ];

  return `${capitalize(
    position
  )} cap edge generated from the rectangle ${profileRole} profile edge.`;
}

function createEdgeEligibleOperations(): readonly CadGeneratedReferenceEligibleOperation[] {
  return MEASURE_AND_SELECT_OPERATIONS;
}

function createEdgeEligibilityNotes(): readonly string[] {
  return [SEMANTIC_REFERENCE_NOTE];
}

function createVertexReferenceLabel(
  role: CadGeneratedExtrudeVertexRole
): string {
  const position = createVertexPositionRole(role);
  const [uRole, vRole] = createVertexProfileRoles(role);

  return `${capitalize(position)} ${uRole}/${vRole} corner`;
}

function createVertexReferenceDescription(
  role: CadGeneratedExtrudeVertexRole
): string {
  const position = createVertexPositionRole(role);
  const [uRole, vRole] = createVertexProfileRoles(role);

  return `Corner vertex where the ${position} cap, ${uRole} side face, and ${vRole} side face meet.`;
}

function createVertexEligibleOperations(): readonly CadGeneratedReferenceEligibleOperation[] {
  return MEASURE_AND_SELECT_OPERATIONS;
}

function createVertexEligibilityNotes(): readonly string[] {
  return [SEMANTIC_REFERENCE_NOTE];
}

function createRectangleSideFaceRole(
  profileRole: RectangleProfileEdgeRole
): CadGeneratedExtrudeFaceRole {
  return `side:${profileRole}`;
}

function createRectangleProfileEdgeAxis(
  plane: SketchPlane,
  profileRole: RectangleProfileEdgeRole
): Vec3 {
  if (profileRole === "uMin" || profileRole === "uMax") {
    return createSketchPlaneVAxis(plane);
  }

  return createSketchPlaneUAxis(plane);
}

function createRectangleProfileEdgeAxisRole(
  profileRole: RectangleProfileEdgeRole
): string {
  return profileRole === "uMin" || profileRole === "uMax"
    ? "profileVAxis"
    : "profileUAxis";
}

function createLongitudinalAdjacentFaceRoles(
  role: CadGeneratedExtrudeEdgeRole
): readonly CadGeneratedExtrudeFaceRole[] {
  if (role === "longitudinal:uMin:vMin") {
    return ["side:uMin", "side:vMin"];
  }

  if (role === "longitudinal:uMin:vMax") {
    return ["side:uMin", "side:vMax"];
  }

  if (role === "longitudinal:uMax:vMin") {
    return ["side:uMax", "side:vMin"];
  }

  if (role === "longitudinal:uMax:vMax") {
    return ["side:uMax", "side:vMax"];
  }

  return [];
}

function createLongitudinalProfileRoles(
  role: CadGeneratedExtrudeEdgeRole
): readonly [
  Extract<RectangleProfileEdgeRole, "uMin" | "uMax">,
  Extract<RectangleProfileEdgeRole, "vMin" | "vMax">
] {
  const [, uRole, vRole] = role.split(":") as [
    "longitudinal",
    Extract<RectangleProfileEdgeRole, "uMin" | "uMax">,
    Extract<RectangleProfileEdgeRole, "vMin" | "vMax">
  ];

  return [uRole, vRole];
}

function createVertexAdjacentFaceRoles(
  role: CadGeneratedExtrudeVertexRole
): readonly CadGeneratedExtrudeFaceRole[] {
  const capRole = role.startsWith("start:") ? "startCap" : "endCap";
  const profileRoles = createVertexProfileRoles(role);

  return [capRole, ...profileRoles.map(createRectangleSideFaceRole)];
}

function createVertexAdjacentEdgeRoles(
  role: CadGeneratedExtrudeVertexRole
): readonly CadGeneratedExtrudeEdgeRole[] {
  const capPrefix = createVertexPositionRole(role);
  const [uRole, vRole] = createVertexProfileRoles(role);

  return [
    `${capPrefix}:${uRole}`,
    `${capPrefix}:${vRole}`,
    `longitudinal:${uRole}:${vRole}`
  ];
}

function createRectangleVertexProfilePoint(
  profile: RectangleProfileSignature,
  role: CadGeneratedExtrudeVertexRole
): Vec2 {
  const [uRole, vRole] = createVertexProfileRoles(role);
  const u =
    uRole === "uMin"
      ? profile.center[0] - profile.width / 2
      : profile.center[0] + profile.width / 2;
  const v =
    vRole === "vMin"
      ? profile.center[1] - profile.height / 2
      : profile.center[1] + profile.height / 2;

  return [u, v];
}

function createVertexPositionRole(
  role: CadGeneratedExtrudeVertexRole
): "start" | "end" {
  return role.startsWith("start:") ? "start" : "end";
}

function createVertexProfileRoles(
  role: CadGeneratedExtrudeVertexRole
): readonly [
  Extract<RectangleProfileEdgeRole, "uMin" | "uMax">,
  Extract<RectangleProfileEdgeRole, "vMin" | "vMax">
] {
  const uRole = role.includes(":uMin:") ? "uMin" : "uMax";
  const vRole = role.endsWith(":vMin") ? "vMin" : "vMax";

  return [uRole, vRole];
}

function createSketchPlaneUAxis(plane: SketchPlane): Vec3 {
  if (plane === "YZ") {
    return [0, 1, 0];
  }

  return [1, 0, 0];
}

function createSketchPlaneVAxis(plane: SketchPlane): Vec3 {
  if (plane === "XY") {
    return [0, 1, 0];
  }

  return [0, 0, 1];
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

function capitalize(value: string): string {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}
