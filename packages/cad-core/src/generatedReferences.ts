import type {
  BodyId,
  CadGeneratedAxisReference,
  CadGeneratedBodyReference,
  CadGeneratedEdgeReference,
  CadGeneratedEntityKind,
  CadGeneratedExtrudeEdgeRole,
  CadGeneratedExtrudeFaceRole,
  CadGeneratedExtrudeVertexRole,
  CadGeneratedFaceRole,
  CadGeneratedFaceReference,
  CadGeneratedHoleEdgeRole,
  CadGeneratedHoleFaceRole,
  CadGeneratedReference,
  CadGeneratedReferenceEligibleOperation,
  CadGeneratedReferenceProfileSignature,
  CadGeneratedReferenceSignature,
  CadGeneratedVertexReference,
  FeatureExtrudeOperationMode,
  FeatureExtrudeProfileKind,
  FeatureExtrudeSide,
  FeatureHoleDepthMode,
  FeatureHoleDirection,
  FeatureId,
  FeatureRevolveAxis,
  FeatureRevolveOperationMode,
  FeatureRevolveProfileKind,
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
const EDGE_FINISH_OPERATIONS = [
  "feature.chamfer",
  "feature.fillet",
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
  | GeneratedReferencesRevolveFeature
  | GeneratedReferencesHoleFeature
  | GeneratedReferencesChamferFeature
  | GeneratedReferencesFilletFeature;

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
  readonly targetTopologyAnchorId?: string;
  readonly bodyId: BodyId;
}

export interface GeneratedReferencesRevolveFeature {
  readonly id: FeatureId;
  readonly kind: "revolve";
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
  readonly profileKind: FeatureRevolveProfileKind;
  readonly axis: FeatureRevolveAxis;
  readonly angleDegrees: number;
  readonly operationMode: FeatureRevolveOperationMode;
  readonly targetBodyId?: BodyId;
  readonly bodyId: BodyId;
}

export interface GeneratedReferencesChamferFeature {
  readonly id: FeatureId;
  readonly kind: "chamfer";
  readonly targetBodyId: BodyId;
  readonly edgeStableId?: string;
  readonly namedReference?: string;
  readonly topologyAnchorId?: string;
  readonly distance: number;
  readonly bodyId: BodyId;
}

export interface GeneratedReferencesFilletFeature {
  readonly id: FeatureId;
  readonly kind: "fillet";
  readonly targetBodyId: BodyId;
  readonly edgeStableId?: string;
  readonly namedReference?: string;
  readonly topologyAnchorId?: string;
  readonly radius: number;
  readonly bodyId: BodyId;
}

export interface GeneratedReferencesHoleFeature {
  readonly id: FeatureId;
  readonly kind: "hole";
  readonly targetBodyId: BodyId;
  readonly sketchId: SketchId;
  readonly circleEntityId: SketchEntityId;
  readonly depthMode: FeatureHoleDepthMode;
  readonly depth?: number;
  readonly direction: FeatureHoleDirection;
  readonly bodyId: BodyId;
}

export interface BodyGeneratedReferencesSnapshot {
  readonly body: CadGeneratedBodyReference;
  readonly faces: readonly CadGeneratedFaceReference[];
  readonly edges: readonly CadGeneratedEdgeReference[];
  readonly vertices: readonly CadGeneratedVertexReference[];
  readonly axes: readonly CadGeneratedAxisReference[];
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

  if (feature.kind === "extrude") {
    return createExtrudeBodyGeneratedReferences(document, feature, ownerPartId);
  }

  if (feature.kind === "revolve") {
    return createRevolveBodyGeneratedReferences(document, feature, ownerPartId);
  }

  if (feature.kind === "hole") {
    return createHoleBodyGeneratedReferences(document, feature, ownerPartId);
  }

  return undefined;
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
              "Generated references are currently available only for authored sketch-extrude bodies, supported authored revolve newBody result bodies, and supported authored hole result bodies.",
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
    ...references.vertices,
    ...references.axes
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

function createExtrudeBodyGeneratedReferences(
  document: GeneratedReferencesDocument,
  feature: GeneratedReferencesExtrudeFeature,
  ownerPartId: PartId
): BodyGeneratedReferencesSnapshot | undefined {
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

  if (feature.operationMode === "cut") {
    return createCutExtrudeBodyGeneratedReferences(
      document,
      feature,
      sketch,
      profile,
      ownerPartId
    );
  }

  if (feature.operationMode === "add") {
    return createAddExtrudeBodyGeneratedReferences(
      document,
      feature,
      sketch,
      profile,
      ownerPartId
    );
  }

  if (feature.operationMode !== "newBody") {
    return undefined;
  }

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
        : [],
    axes: []
  };
}

function createAddExtrudeBodyGeneratedReferences(
  document: GeneratedReferencesDocument,
  feature: GeneratedReferencesExtrudeFeature,
  sketch: GeneratedReferencesSketch,
  profile: CadGeneratedReferenceProfileSignature,
  ownerPartId: PartId
): BodyGeneratedReferencesSnapshot | undefined {
  if (
    !isBooleanToolProfile(feature, profile) ||
    !feature.targetBodyId ||
    !isSupportedBooleanAddTarget(document, feature)
  ) {
    return undefined;
  }

  const body: CadGeneratedBodyReference = {
    kind: "body",
    stableId: `generated:body:${feature.bodyId}`,
    label: "Boolean add result body",
    description: `Result body generated by ${feature.profileKind} add feature ${feature.id} fused to target body ${feature.targetBodyId}.`,
    eligibleOperations: [],
    eligibilityNotes: createBooleanAddEligibilityNotes(),
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
        axisRole: "addDirection"
      }
    )
  };

  return {
    body,
    faces:
      profile.kind === "rectangle"
        ? createRectangleAddFaceReferences(
            feature,
            sketch,
            profile,
            ownerPartId
          )
        : createCircleAddFaceReferences(feature, sketch, profile, ownerPartId),
    edges:
      profile.kind === "rectangle"
        ? createRectangleAddProfileEdgeReferences(
            feature,
            sketch,
            profile,
            ownerPartId
          )
        : createCircleAddProfileEdgeReferences(
            feature,
            sketch,
            profile,
            ownerPartId
          ),
    vertices: [],
    axes: []
  };
}

function createCutExtrudeBodyGeneratedReferences(
  document: GeneratedReferencesDocument,
  feature: GeneratedReferencesExtrudeFeature,
  sketch: GeneratedReferencesSketch,
  profile: CadGeneratedReferenceProfileSignature,
  ownerPartId: PartId
): BodyGeneratedReferencesSnapshot | undefined {
  if (
    !isBooleanToolProfile(feature, profile) ||
    !feature.targetBodyId ||
    !isSupportedBooleanCutTarget(document, feature)
  ) {
    return undefined;
  }

  const body: CadGeneratedBodyReference = {
    kind: "body",
    stableId: `generated:body:${feature.bodyId}`,
    label: "Boolean cut result body",
    description: `Result body generated by ${feature.profileKind} cut feature ${feature.id} in target body ${feature.targetBodyId}.`,
    eligibleOperations: [],
    eligibilityNotes: createBooleanCutEligibilityNotes(),
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
        axisRole: "cutDirection"
      }
    )
  };

  return {
    body,
    faces:
      profile.kind === "rectangle"
        ? createRectangleCutWallFaceReferences(
            feature,
            sketch,
            profile,
            ownerPartId
          )
        : createCircleCutWallFaceReferences(
            feature,
            sketch,
            profile,
            ownerPartId
          ),
    edges:
      profile.kind === "rectangle"
        ? createRectangleCutWallProfileEdgeReferences(
            feature,
            sketch,
            profile,
            ownerPartId
          )
        : createCircleCutRimEdgeReferences(
            feature,
            sketch,
            profile,
            ownerPartId
          ),
    vertices: [],
    axes: []
  };
}

function isBooleanToolProfile(
  feature: GeneratedReferencesExtrudeFeature,
  profile: CadGeneratedReferenceProfileSignature
): boolean {
  return (
    (feature.profileKind === "rectangle" && profile.kind === "rectangle") ||
    (feature.profileKind === "circle" && profile.kind === "circle")
  );
}

function isSupportedBooleanAddTarget(
  document: GeneratedReferencesDocument,
  feature: GeneratedReferencesExtrudeFeature
): boolean {
  const targetFeature = [...document.features.values()].find(
    (candidate) => candidate.bodyId === feature.targetBodyId
  );
  const targetProfileKind = resolveBooleanTargetProfileKind(
    document,
    targetFeature,
    feature.targetTopologyAnchorId
  );

  return targetProfileKind === "rectangle";
}

function isSupportedBooleanCutTarget(
  document: GeneratedReferencesDocument,
  feature: GeneratedReferencesExtrudeFeature
): boolean {
  const targetFeature = [...document.features.values()].find(
    (candidate) => candidate.bodyId === feature.targetBodyId
  );
  const targetProfileKind = resolveBooleanTargetProfileKind(
    document,
    targetFeature,
    feature.targetTopologyAnchorId
  );

  return targetProfileKind === "rectangle" || targetProfileKind === "circle";
}

function resolveBooleanTargetProfileKind(
  document: GeneratedReferencesDocument,
  targetFeature: GeneratedReferencesFeature | undefined,
  targetTopologyAnchorId?: string
): FeatureExtrudeProfileKind | undefined {
  if (targetFeature?.kind !== "extrude") {
    return undefined;
  }

  if (targetFeature.operationMode === "newBody") {
    return targetFeature.profileKind;
  }

  if (targetTopologyAnchorId === undefined) {
    return undefined;
  }

  let current: GeneratedReferencesExtrudeFeature | undefined = targetFeature;
  const visitedFeatureIds = new Set<FeatureId>();

  while (current && !visitedFeatureIds.has(current.id)) {
    visitedFeatureIds.add(current.id);

    if (current.operationMode === "newBody") {
      return current.profileKind;
    }

    if (
      current.targetTopologyAnchorId !== targetTopologyAnchorId ||
      current.targetBodyId === undefined
    ) {
      return undefined;
    }

    const targetBodyId: BodyId = current.targetBodyId;
    const parent: GeneratedReferencesFeature | undefined = [
      ...document.features.values()
    ].find((candidate) => candidate.bodyId === targetBodyId);
    current = parent?.kind === "extrude" ? parent : undefined;
  }

  return undefined;
}

function createRevolveBodyGeneratedReferences(
  document: GeneratedReferencesDocument,
  feature: GeneratedReferencesRevolveFeature,
  ownerPartId: PartId
): BodyGeneratedReferencesSnapshot | undefined {
  if (feature.operationMode !== "newBody") {
    return undefined;
  }

  const sketch = document.sketches.get(feature.sketchId);
  const entity = sketch?.entities.get(feature.entityId);
  const axisSketch = document.sketches.get(feature.axis.sketchId);
  const axisEntity = axisSketch?.entities.get(feature.axis.entityId);

  if (!sketch || !entity || !axisSketch || !axisEntity) {
    return undefined;
  }

  if (feature.profileKind === "rectangle" && entity.kind !== "rectangle") {
    return undefined;
  }

  if (feature.profileKind === "circle" && entity.kind !== "circle") {
    return undefined;
  }

  if (axisEntity.kind !== "line") {
    return undefined;
  }

  const profile = createGeneratedReferenceProfileSignature(entity);
  const axisSignature = createRevolveAxisSourceSignature(feature, axisEntity);
  const body: CadGeneratedBodyReference = {
    kind: "body",
    stableId: `generated:body:${feature.bodyId}`,
    label: `${capitalize(feature.profileKind)} revolve body`,
    description: `Solid body generated by ${feature.profileKind} revolve feature ${feature.id}.`,
    eligibleOperations: createSourceSemanticSelectionOperations(),
    eligibilityNotes: createRevolveEligibilityNotes(),
    bodyId: feature.bodyId,
    ownerPartId,
    sourceFeatureId: feature.id,
    sourceSketchId: feature.sketchId,
    sourceSketchEntityId: feature.entityId,
    profileKind: feature.profileKind,
    geometricSignature: createRevolveGeneratedReferenceSignature(
      feature,
      sketch,
      profile,
      axisSignature,
      {
        axis: createSketchLineDirection(axisEntity, axisSketch.plane),
        axisRole: "revolveAxis"
      }
    )
  };

  return {
    body,
    faces: [],
    edges: [],
    vertices: [],
    axes: [
      createRevolveAxisReference(
        feature,
        sketch,
        profile,
        axisSignature,
        axisSketch.plane,
        ownerPartId
      )
    ]
  };
}

function createHoleBodyGeneratedReferences(
  document: GeneratedReferencesDocument,
  feature: GeneratedReferencesHoleFeature,
  ownerPartId: PartId
): BodyGeneratedReferencesSnapshot | undefined {
  const sketch = document.sketches.get(feature.sketchId);
  const entity = sketch?.entities.get(feature.circleEntityId);

  if (!sketch || !entity || entity.kind !== "circle") {
    return undefined;
  }

  const profile = createGeneratedReferenceProfileSignature(entity);

  if (profile.kind !== "circle") {
    return undefined;
  }

  const body: CadGeneratedBodyReference = {
    kind: "body",
    stableId: `generated:body:${feature.bodyId}`,
    label: "Hole result body",
    description: `Result body generated by ${feature.depthMode} hole feature ${feature.id} in target body ${feature.targetBodyId}.`,
    eligibleOperations: createHoleBodyEligibleOperations(),
    eligibilityNotes: createHoleEligibilityNotes(),
    bodyId: feature.bodyId,
    ownerPartId,
    sourceFeatureId: feature.id,
    sourceSketchId: feature.sketchId,
    sourceSketchEntityId: feature.circleEntityId,
    profileKind: "circle",
    geometricSignature: createHoleGeneratedReferenceSignature(
      feature,
      sketch,
      profile,
      {
        normal: createSketchPlaneNormal(sketch.plane),
        normalRole: "sketchPlaneNormal",
        axis: createHoleAxis(sketch.plane, feature.direction),
        axisRole: "holeDirection"
      }
    )
  };

  return {
    body,
    faces: [
      createHoleFaceReference(feature, sketch, profile, "holeWall", ownerPartId)
    ],
    edges: createHoleEdgeReferences(feature, sketch, profile, ownerPartId),
    vertices: [],
    axes: [createHoleAxisReference(feature, sketch, profile, ownerPartId)]
  };
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

function createRectangleAddFaceReferences(
  feature: GeneratedReferencesExtrudeFeature,
  sketch: GeneratedReferencesSketch,
  profile: Extract<
    CadGeneratedReferenceProfileSignature,
    { readonly kind: "rectangle" }
  >,
  ownerPartId: PartId
): readonly CadGeneratedFaceReference[] {
  return [
    ...(
      [
        "side:uMin",
        "side:uMax",
        "side:vMin",
        "side:vMax"
      ] satisfies readonly CadGeneratedExtrudeFaceRole[]
    ).map((role) =>
      createBooleanAddFaceReference(feature, sketch, profile, role, ownerPartId)
    ),
    createBooleanAddFaceReference(
      feature,
      sketch,
      profile,
      "endCap",
      ownerPartId
    )
  ];
}

function createCircleAddFaceReferences(
  feature: GeneratedReferencesExtrudeFeature,
  sketch: GeneratedReferencesSketch,
  profile: Extract<
    CadGeneratedReferenceProfileSignature,
    { readonly kind: "circle" }
  >,
  ownerPartId: PartId
): readonly CadGeneratedFaceReference[] {
  return [
    createBooleanAddFaceReference(
      feature,
      sketch,
      profile,
      "side:circular",
      ownerPartId
    ),
    createBooleanAddFaceReference(
      feature,
      sketch,
      profile,
      "endCap",
      ownerPartId
    )
  ];
}

function createBooleanAddFaceReference(
  feature: GeneratedReferencesExtrudeFeature,
  sketch: GeneratedReferencesSketch,
  profile: Extract<
    CadGeneratedReferenceProfileSignature,
    { readonly kind: "rectangle" | "circle" }
  >,
  role: Extract<CadGeneratedExtrudeFaceRole, "endCap" | `side:${string}`>,
  ownerPartId: PartId
): CadGeneratedFaceReference {
  const isCap = role === "endCap";
  const isCircularWall = role === "side:circular";

  return {
    kind: "face",
    stableId: `generated:face:${feature.bodyId}:${role}`,
    label: isCap
      ? "Added cap face"
      : isCircularWall
        ? "Added circular wall face"
        : `Added wall face ${role.replace("side:", "")}`,
    description: isCap
      ? `Planar cap face at the end of the added ${profile.kind} extrusion.`
      : isCircularWall
        ? "Cylindrical added wall face generated from the circle tool profile."
        : `Planar added wall face generated from the rectangle ${role.replace(
            "side:",
            ""
          )} tool profile edge.`,
    eligibleOperations: isCircularWall
      ? MEASURE_AND_SELECT_OPERATIONS
      : PLANAR_FACE_OPERATIONS,
    eligibilityNotes: createBooleanAddEligibilityNotes(),
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
      isCap
        ? {
            surfaceType: "plane",
            normal: createExtrudeCapNormal(sketch.plane, feature.side, role),
            normalRole: "addedCap:endCap"
          }
        : isCircularWall
          ? {
              surfaceType: "cylinder",
              axis: createSketchPlaneNormal(sketch.plane),
              axisRole: "addedWall:side:circular"
            }
          : {
              surfaceType: "plane",
              normal: createRectangleSideNormal(sketch.plane, role),
              normalRole: `addedWall:${role}`
            }
    )
  };
}

function createCircleAddProfileEdgeReferences(
  feature: GeneratedReferencesExtrudeFeature,
  sketch: GeneratedReferencesSketch,
  profile: Extract<
    CadGeneratedReferenceProfileSignature,
    { readonly kind: "circle" }
  >,
  ownerPartId: PartId
): readonly CadGeneratedEdgeReference[] {
  return [
    {
      kind: "edge",
      stableId: `generated:edge:${feature.bodyId}:end:circular`,
      label: "Added cap circular edge",
      description:
        "Added cap perimeter edge generated from the circle profile.",
      eligibleOperations: MEASURE_AND_SELECT_OPERATIONS,
      eligibilityNotes: createBooleanAddEdgeEligibilityNotes(),
      bodyId: feature.bodyId,
      ownerPartId,
      sourceFeatureId: feature.id,
      sourceSketchId: feature.sketchId,
      sourceSketchEntityId: feature.entityId,
      role: "end:circular",
      adjacentFaceRoles: ["endCap", "side:circular"],
      geometricSignature: createGeneratedReferenceSignature(
        feature,
        sketch,
        profile,
        {
          curveType: "circle",
          axis: createSketchPlaneNormal(sketch.plane),
          axisRole: "addedCapProfile:circular"
        }
      )
    }
  ];
}

function createRectangleAddProfileEdgeReferences(
  feature: GeneratedReferencesExtrudeFeature,
  sketch: GeneratedReferencesSketch,
  profile: Extract<
    CadGeneratedReferenceProfileSignature,
    { readonly kind: "rectangle" }
  >,
  ownerPartId: PartId
): readonly CadGeneratedEdgeReference[] {
  const roles = [
    "end:uMin",
    "end:uMax",
    "end:vMin",
    "end:vMax"
  ] satisfies readonly CadGeneratedExtrudeEdgeRole[];

  return roles.map((role) =>
    createBooleanAddProfileEdgeReference(
      feature,
      sketch,
      profile,
      role,
      ownerPartId
    )
  );
}

function createBooleanAddProfileEdgeReference(
  feature: GeneratedReferencesExtrudeFeature,
  sketch: GeneratedReferencesSketch,
  profile: Extract<
    CadGeneratedReferenceProfileSignature,
    { readonly kind: "rectangle" }
  >,
  role: Extract<CadGeneratedExtrudeEdgeRole, `end:${string}`>,
  ownerPartId: PartId
): CadGeneratedEdgeReference {
  const profileRole = role.replace("end:", "") as
    | "uMin"
    | "uMax"
    | "vMin"
    | "vMax";
  const adjacentFaceRoles: readonly CadGeneratedFaceRole[] = [
    "endCap",
    createRectangleSideFaceRole(profileRole)
  ];

  return {
    kind: "edge",
    stableId: `generated:edge:${feature.bodyId}:${role}`,
    label: `Added cap profile edge ${profileRole}`,
    description: `Added cap perimeter edge where ${adjacentFaceRoles.join(
      " and "
    )} meet.`,
    eligibleOperations: MEASURE_AND_SELECT_OPERATIONS,
    eligibilityNotes: createBooleanAddEdgeEligibilityNotes(),
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
      {
        curveType: "line",
        axis: createRectangleProfileEdgeAxis(sketch.plane, profileRole),
        axisRole: `addedCapProfile:${profileRole}`
      }
    )
  };
}

function createRectangleCutWallFaceReferences(
  feature: GeneratedReferencesExtrudeFeature,
  sketch: GeneratedReferencesSketch,
  profile: Extract<
    CadGeneratedReferenceProfileSignature,
    { readonly kind: "rectangle" }
  >,
  ownerPartId: PartId
): readonly CadGeneratedFaceReference[] {
  return (
    [
      "side:uMin",
      "side:uMax",
      "side:vMin",
      "side:vMax"
    ] satisfies readonly CadGeneratedExtrudeFaceRole[]
  ).map((role) =>
    createBooleanCutWallFaceReference(
      feature,
      sketch,
      profile,
      role,
      ownerPartId
    )
  );
}

function createCircleCutWallFaceReferences(
  feature: GeneratedReferencesExtrudeFeature,
  sketch: GeneratedReferencesSketch,
  profile: Extract<
    CadGeneratedReferenceProfileSignature,
    { readonly kind: "circle" }
  >,
  ownerPartId: PartId
): readonly CadGeneratedFaceReference[] {
  return [
    createBooleanCutWallFaceReference(
      feature,
      sketch,
      profile,
      "side:circular",
      ownerPartId
    )
  ];
}

function createBooleanCutWallFaceReference(
  feature: GeneratedReferencesExtrudeFeature,
  sketch: GeneratedReferencesSketch,
  profile: Extract<
    CadGeneratedReferenceProfileSignature,
    { readonly kind: "rectangle" | "circle" }
  >,
  role: CadGeneratedExtrudeFaceRole,
  ownerPartId: PartId
): CadGeneratedFaceReference {
  const isCircularWall = role === "side:circular";

  return {
    kind: "face",
    stableId: `generated:face:${feature.bodyId}:${role}`,
    label: isCircularWall
      ? "Cut circular wall face"
      : `Cut wall face ${role.replace("side:", "")}`,
    description: isCircularWall
      ? "Cylindrical cut wall face generated from the circle tool profile."
      : `Planar cut wall face generated from the rectangle ${role.replace(
          "side:",
          ""
        )} tool profile edge.`,
    eligibleOperations: isCircularWall
      ? MEASURE_AND_SELECT_OPERATIONS
      : PLANAR_FACE_OPERATIONS,
    eligibilityNotes: createBooleanCutEligibilityNotes(),
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
      isCircularWall
        ? {
            surfaceType: "cylinder",
            axis: createSketchPlaneNormal(sketch.plane),
            axisRole: "cutWall:side:circular"
          }
        : {
            surfaceType: "plane",
            normal: createRectangleSideNormal(sketch.plane, role),
            normalRole: `cutWall:${role}`
          }
    )
  };
}

function createCircleCutRimEdgeReferences(
  feature: GeneratedReferencesExtrudeFeature,
  sketch: GeneratedReferencesSketch,
  profile: Extract<
    CadGeneratedReferenceProfileSignature,
    { readonly kind: "circle" }
  >,
  ownerPartId: PartId
): readonly CadGeneratedEdgeReference[] {
  return [
    createBooleanCutCircularRimEdgeReference(
      feature,
      sketch,
      profile,
      "start:circular",
      ownerPartId
    ),
    createBooleanCutCircularRimEdgeReference(
      feature,
      sketch,
      profile,
      "end:circular",
      ownerPartId
    )
  ];
}

function createBooleanCutCircularRimEdgeReference(
  feature: GeneratedReferencesExtrudeFeature,
  sketch: GeneratedReferencesSketch,
  profile: Extract<
    CadGeneratedReferenceProfileSignature,
    { readonly kind: "circle" }
  >,
  role: Extract<CadGeneratedExtrudeEdgeRole, "start:circular" | "end:circular">,
  ownerPartId: PartId
): CadGeneratedEdgeReference {
  const isStart = role === "start:circular";

  return {
    kind: "edge",
    stableId: `generated:edge:${feature.bodyId}:${role}`,
    label: isStart
      ? "Cut start circular rim edge"
      : "Cut terminal circular rim edge",
    description: isStart
      ? "Circular rim edge at the start of the cut wall."
      : "Circular rim edge at the terminal end of the cut wall.",
    eligibleOperations: MEASURE_AND_SELECT_OPERATIONS,
    eligibilityNotes: createBooleanCutEdgeEligibilityNotes(),
    bodyId: feature.bodyId,
    ownerPartId,
    sourceFeatureId: feature.id,
    sourceSketchId: feature.sketchId,
    sourceSketchEntityId: feature.entityId,
    role,
    adjacentFaceRoles: [isStart ? "startCap" : "endCap", "side:circular"],
    geometricSignature: createGeneratedReferenceSignature(
      feature,
      sketch,
      profile,
      {
        curveType: "circle",
        axis: createSketchPlaneNormal(sketch.plane),
        axisRole: isStart ? "cutStartRim:circular" : "cutTerminalRim:circular"
      }
    )
  };
}

function createRectangleCutWallProfileEdgeReferences(
  feature: GeneratedReferencesExtrudeFeature,
  sketch: GeneratedReferencesSketch,
  profile: Extract<
    CadGeneratedReferenceProfileSignature,
    { readonly kind: "rectangle" }
  >,
  ownerPartId: PartId
): readonly CadGeneratedEdgeReference[] {
  const roles = [
    "longitudinal:uMin:vMin",
    "longitudinal:uMin:vMax",
    "longitudinal:uMax:vMin",
    "longitudinal:uMax:vMax"
  ] satisfies readonly CadGeneratedExtrudeEdgeRole[];

  return roles.map((role) =>
    createBooleanCutWallProfileEdgeReference(
      feature,
      sketch,
      profile,
      role,
      ownerPartId
    )
  );
}

function createBooleanCutWallProfileEdgeReference(
  feature: GeneratedReferencesExtrudeFeature,
  sketch: GeneratedReferencesSketch,
  profile: Extract<
    CadGeneratedReferenceProfileSignature,
    { readonly kind: "rectangle" }
  >,
  role: Extract<CadGeneratedExtrudeEdgeRole, `longitudinal:${string}`>,
  ownerPartId: PartId
): CadGeneratedEdgeReference {
  const adjacentFaceRoles = createLongitudinalAdjacentFaceRoles(role);

  return {
    kind: "edge",
    stableId: `generated:edge:${feature.bodyId}:${role}`,
    label: createBooleanCutWallProfileEdgeLabel(role),
    description: `Longitudinal cut-wall profile edge where ${adjacentFaceRoles.join(
      " and "
    )} meet.`,
    eligibleOperations: MEASURE_AND_SELECT_OPERATIONS,
    eligibilityNotes: createBooleanCutEdgeEligibilityNotes(),
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
      {
        curveType: "line",
        axis: createSketchPlaneNormal(sketch.plane),
        axisRole: `cutWallProfile:${role}`
      }
    )
  };
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

function createRevolveAxisReference(
  feature: GeneratedReferencesRevolveFeature,
  sketch: GeneratedReferencesSketch,
  profile: CadGeneratedReferenceProfileSignature,
  axisSignature: NonNullable<
    CadGeneratedReferenceSignature["revolveAxisSignature"]
  >,
  axisPlane: SketchPlane,
  ownerPartId: PartId
): CadGeneratedAxisReference {
  return {
    kind: "axis",
    stableId: `generated:axis:${feature.bodyId}:revolveAxis`,
    label: "Revolve axis",
    description:
      "Source-semantic axis generated from the authored revolve axis line.",
    eligibleOperations: createSourceSemanticSelectionOperations(),
    eligibilityNotes: createRevolveEligibilityNotes(),
    bodyId: feature.bodyId,
    ownerPartId,
    sourceFeatureId: feature.id,
    sourceSketchId: feature.axis.sketchId,
    sourceSketchEntityId: feature.axis.entityId,
    role: "revolveAxis",
    geometricSignature: createRevolveGeneratedReferenceSignature(
      feature,
      sketch,
      profile,
      axisSignature,
      {
        axis: createSketchLineDirectionFromPoints(
          axisSignature.start,
          axisSignature.end,
          axisPlane
        ),
        axisRole: "revolveAxis"
      }
    )
  };
}

function createHoleFaceReference(
  feature: GeneratedReferencesHoleFeature,
  sketch: GeneratedReferencesSketch,
  profile: Extract<
    CadGeneratedReferenceProfileSignature,
    { readonly kind: "circle" }
  >,
  role: CadGeneratedHoleFaceRole,
  ownerPartId: PartId
): CadGeneratedFaceReference {
  return {
    kind: "face",
    stableId: `generated:face:${feature.bodyId}:${role}`,
    label: "Hole wall face",
    description:
      "Cylindrical wall face generated from the authored hole circle.",
    eligibleOperations: createHoleReferenceEligibleOperations(),
    eligibilityNotes: createHoleEligibilityNotes(),
    bodyId: feature.bodyId,
    ownerPartId,
    sourceFeatureId: feature.id,
    sourceSketchId: feature.sketchId,
    sourceSketchEntityId: feature.circleEntityId,
    role,
    geometricSignature: createHoleGeneratedReferenceSignature(
      feature,
      sketch,
      profile,
      {
        surfaceType: "cylinder",
        normal: createSketchPlaneNormal(sketch.plane),
        normalRole: "sketchPlaneNormal",
        axis: createHoleAxis(sketch.plane, feature.direction),
        axisRole: "holeDirection"
      }
    )
  };
}

function createHoleEdgeReferences(
  feature: GeneratedReferencesHoleFeature,
  sketch: GeneratedReferencesSketch,
  profile: Extract<
    CadGeneratedReferenceProfileSignature,
    { readonly kind: "circle" }
  >,
  ownerPartId: PartId
): readonly CadGeneratedEdgeReference[] {
  return [
    createHoleEdgeReference(feature, sketch, profile, "startRim", ownerPartId)
  ];
}

function createHoleEdgeReference(
  feature: GeneratedReferencesHoleFeature,
  sketch: GeneratedReferencesSketch,
  profile: Extract<
    CadGeneratedReferenceProfileSignature,
    { readonly kind: "circle" }
  >,
  role: CadGeneratedHoleEdgeRole,
  ownerPartId: PartId
): CadGeneratedEdgeReference {
  return {
    kind: "edge",
    stableId: `generated:edge:${feature.bodyId}:${role}`,
    label: createHoleEdgeReferenceLabel(),
    description: createHoleEdgeReferenceDescription(),
    eligibleOperations: createHoleReferenceEligibleOperations(),
    eligibilityNotes: createHoleEligibilityNotes(),
    bodyId: feature.bodyId,
    ownerPartId,
    sourceFeatureId: feature.id,
    sourceSketchId: feature.sketchId,
    sourceSketchEntityId: feature.circleEntityId,
    role,
    adjacentFaceRoles: ["holeWall"],
    geometricSignature: createHoleGeneratedReferenceSignature(
      feature,
      sketch,
      profile,
      {
        curveType: "circle",
        normal: createSketchPlaneNormal(sketch.plane),
        normalRole: "sketchPlaneNormal",
        axis: createHoleAxis(sketch.plane, feature.direction),
        axisRole: "holeStartRim",
        positionRole: role
      }
    )
  };
}

function createHoleAxisReference(
  feature: GeneratedReferencesHoleFeature,
  sketch: GeneratedReferencesSketch,
  profile: Extract<
    CadGeneratedReferenceProfileSignature,
    { readonly kind: "circle" }
  >,
  ownerPartId: PartId
): CadGeneratedAxisReference {
  return {
    kind: "axis",
    stableId: `generated:axis:${feature.bodyId}:holeAxis`,
    label: "Hole axis",
    description:
      "Source-semantic axis generated from the authored hole circle and direction.",
    eligibleOperations: createSourceSemanticSelectionOperations(),
    eligibilityNotes: createHoleEligibilityNotes(),
    bodyId: feature.bodyId,
    ownerPartId,
    sourceFeatureId: feature.id,
    sourceSketchId: feature.sketchId,
    sourceSketchEntityId: feature.circleEntityId,
    role: "holeAxis",
    geometricSignature: createHoleGeneratedReferenceSignature(
      feature,
      sketch,
      profile,
      {
        axis: createHoleAxis(sketch.plane, feature.direction),
        axisRole: "holeAxis",
        positionRole: "holeCenter"
      }
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
    sourceKind: "extrude",
    targetBodyId: feature.targetBodyId,
    targetTopologyAnchorId: feature.targetTopologyAnchorId,
    profileKind: feature.profileKind,
    sketchPlane: sketch.plane,
    extrudeOperationMode: feature.operationMode,
    extrudeSide: feature.side,
    depth: feature.depth,
    profile,
    ...signature
  };
}

function createRevolveGeneratedReferenceSignature(
  feature: GeneratedReferencesRevolveFeature,
  sketch: GeneratedReferencesSketch,
  profile: CadGeneratedReferenceProfileSignature,
  axisSignature: NonNullable<
    CadGeneratedReferenceSignature["revolveAxisSignature"]
  >,
  signature: Pick<CadGeneratedReferenceSignature, "axis" | "axisRole"> = {}
): CadGeneratedReferenceSignature {
  return {
    sourceKind: "revolve",
    profileKind: feature.profileKind,
    sketchPlane: sketch.plane,
    revolveAxis: feature.axis,
    revolveAxisSignature: axisSignature,
    revolveAngleDegrees: feature.angleDegrees,
    profile,
    ...signature
  };
}

function createHoleGeneratedReferenceSignature(
  feature: GeneratedReferencesHoleFeature,
  sketch: GeneratedReferencesSketch,
  profile: Extract<
    CadGeneratedReferenceProfileSignature,
    { readonly kind: "circle" }
  >,
  signature: Pick<
    CadGeneratedReferenceSignature,
    | "surfaceType"
    | "curveType"
    | "normal"
    | "axis"
    | "normalRole"
    | "axisRole"
    | "positionRole"
  > = {}
): CadGeneratedReferenceSignature {
  return {
    sourceKind: "hole",
    targetBodyId: feature.targetBodyId,
    profileKind: "circle",
    sketchPlane: sketch.plane,
    holeDepthMode: feature.depthMode,
    ...(feature.depth !== undefined ? { holeDepth: feature.depth } : {}),
    holeDirection: feature.direction,
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

function createRevolveAxisSourceSignature(
  feature: GeneratedReferencesRevolveFeature,
  axisEntity: SketchLineEntitySnapshot
): NonNullable<CadGeneratedReferenceSignature["revolveAxisSignature"]> {
  return {
    type: "sketchLine",
    sketchId: feature.axis.sketchId,
    entityId: feature.axis.entityId,
    start: [...axisEntity.start],
    end: [...axisEntity.end]
  };
}

function createSketchLineDirection(
  entity: SketchLineEntitySnapshot,
  plane: SketchPlane
): Vec3 {
  return createSketchLineDirectionFromPoints(entity.start, entity.end, plane);
}

function createSketchLineDirectionFromPoints(
  start: Vec2,
  end: Vec2,
  plane: SketchPlane
): Vec3 {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const length = Math.hypot(dx, dy);

  if (length === 0) {
    return [0, 0, 0];
  }

  const u = dx / length;
  const v = dy / length;

  if (plane === "XY") {
    return [u, v, 0];
  }

  if (plane === "XZ") {
    return [u, 0, v];
  }

  return [0, u, v];
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

function createHoleAxis(
  plane: SketchPlane,
  direction: FeatureHoleDirection
): Vec3 {
  const normal = createSketchPlaneNormal(plane);
  return direction === "positive" ? normal : negateVector(normal);
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

function createHoleBodyEligibleOperations(): readonly CadGeneratedReferenceEligibleOperation[] {
  return createSourceSemanticSelectionOperations();
}

function createHoleReferenceEligibleOperations(): readonly CadGeneratedReferenceEligibleOperation[] {
  return createSourceSemanticSelectionOperations();
}

function createSourceSemanticSelectionOperations(): readonly CadGeneratedReferenceEligibleOperation[] {
  return ["feature.selectReference"];
}

function createBodyEligibilityNotes(): readonly string[] {
  return [SEMANTIC_REFERENCE_NOTE];
}

function createHoleEligibilityNotes(): readonly string[] {
  return [
    SEMANTIC_REFERENCE_NOTE,
    "Hole result references are source-semantic result-body references; terminal and exit rims are deferred until typed exact evidence proves them."
  ];
}

function createRevolveEligibilityNotes(): readonly string[] {
  return [
    SEMANTIC_REFERENCE_NOTE,
    "Revolve result references are limited to source-semantic body and axis references; revolve faces and edges remain diagnostic-only."
  ];
}

function createBooleanCutEligibilityNotes(): readonly string[] {
  return [
    SEMANTIC_REFERENCE_NOTE,
    "Boolean cut result references are source-semantic V12 references for supported rectangle cut-wall roles and circle cut-wall/rim roles; split, terminal, and arbitrary intersection topology remains deferred."
  ];
}

function createBooleanAddEligibilityNotes(): readonly string[] {
  return [
    SEMANTIC_REFERENCE_NOTE,
    "Boolean add result references are source-semantic V12 references for supported rectangle added-wall/cap/profile-edge roles and circle added-wall/cap/cap-edge roles; target-carried, seam, and intersection topology remains deferred."
  ];
}

function createBooleanCutEdgeEligibilityNotes(): readonly string[] {
  return [
    ...createBooleanCutEligibilityNotes(),
    "Boolean cut-wall profile edges are selectable and measurable; chamfer and fillet on boolean result bodies remain deferred until the geometry pipeline supports those targets."
  ];
}

function createBooleanAddEdgeEligibilityNotes(): readonly string[] {
  return [
    ...createBooleanAddEligibilityNotes(),
    "Boolean added-cap profile edges are selectable and measurable; add seam edges and edge-finish commands on boolean result bodies remain deferred until the geometry pipeline supports those targets."
  ];
}

function createBooleanCutWallProfileEdgeLabel(
  role: Extract<CadGeneratedExtrudeEdgeRole, `longitudinal:${string}`>
): string {
  const [uRole, vRole] = createLongitudinalProfileRoles(role);
  return `Cut wall profile edge ${uRole}/${vRole}`;
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
  return EDGE_FINISH_OPERATIONS;
}

function createEdgeEligibilityNotes(): readonly string[] {
  return [SEMANTIC_REFERENCE_NOTE];
}

function createHoleEdgeReferenceLabel(): string {
  return "Hole start rim edge";
}

function createHoleEdgeReferenceDescription(): string {
  return "Circular rim edge where the authored hole starts from the source circle.";
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
