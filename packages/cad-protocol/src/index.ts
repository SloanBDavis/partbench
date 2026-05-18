export interface PackageInfo {
  readonly name: string;
  readonly status: "ready";
}

export type CadOpsVersion = "cadops.v1";
export type CadBatchMode = "dryRun" | "commit";

export type ObjectId = string;
export type PartId = string;
export type FeatureId = string;
export type BodyId = string;
export type SketchId = string;
export type SketchEntityId = string;
export type TransactionId = string;
export type DocumentUnits = "mm" | "cm" | "m" | "in";
export type DocumentUnitUpdateMode = "metadataOnly" | "preservePhysicalSize";
export type CadActorType = "human" | "agent" | "script" | "system";
export type CadRequestIntent = CadBatchMode;

export type Vec2 = readonly [number, number];
export type Vec3 = readonly [number, number, number];
export type SketchPlane = "XY" | "XZ" | "YZ";
export type FeatureExtrudeProfileKind = "rectangle" | "circle";
export type FeatureExtrudeSide = "positive" | "negative" | "symmetric";

export interface CadActorMetadata {
  readonly type: CadActorType;
  readonly id?: string;
  readonly name?: string;
}

export interface CadTransactionAuditMetadata {
  readonly source?: string;
  readonly requestId?: string;
  readonly toolName?: string;
  readonly intent: CadRequestIntent;
  readonly operationCount: number;
}

export interface Transform {
  readonly translation: Vec3;
  readonly rotation: Vec3;
  readonly scale: Vec3;
}

export interface BoxDimensions {
  readonly width: number;
  readonly height: number;
  readonly depth: number;
}

export interface CylinderDimensions {
  readonly radius: number;
  readonly height: number;
}

export interface SphereDimensions {
  readonly radius: number;
}

export interface ConeDimensions {
  readonly radius: number;
  readonly height: number;
}

export interface TorusDimensions {
  readonly majorRadius: number;
  readonly minorRadius: number;
}

export type CadObjectKind = "box" | "cylinder" | "sphere" | "cone" | "torus";
export type SketchEntityKind = "point" | "line" | "rectangle" | "circle";

export type CadOp =
  | DocumentUpdateUnitsOp
  | SceneCreateBoxOp
  | SceneCreateCylinderOp
  | SceneCreateSphereOp
  | SceneCreateConeOp
  | SceneCreateTorusOp
  | SceneDeleteObjectOp
  | SceneUpdateTransformOp
  | SceneUpdateBoxDimensionsOp
  | SceneUpdateCylinderDimensionsOp
  | SceneUpdateSphereDimensionsOp
  | SceneUpdateConeDimensionsOp
  | SceneUpdateTorusDimensionsOp
  | SceneRenameObjectOp
  | SketchCreateOp
  | SketchCreateOnFaceOp
  | SketchRenameOp
  | SketchDeleteOp
  | SketchAddPointOp
  | SketchAddLineOp
  | SketchAddRectangleOp
  | SketchAddCircleOp
  | SketchUpdateEntityOp
  | SketchDeleteEntityOp
  | FeatureExtrudeOp
  | FeatureUpdateExtrudeOp
  | FeatureDeleteOp;

export interface DocumentUpdateUnitsOp {
  readonly op: "document.updateUnits";
  readonly units: DocumentUnits;
  readonly mode?: DocumentUnitUpdateMode;
}

export interface SceneCreateBoxOp {
  readonly op: "scene.createBox";
  readonly id?: ObjectId;
  readonly name?: string;
  readonly dimensions: BoxDimensions;
  readonly transform?: Partial<Transform>;
}

export interface SceneCreateCylinderOp {
  readonly op: "scene.createCylinder";
  readonly id?: ObjectId;
  readonly name?: string;
  readonly dimensions: CylinderDimensions;
  readonly transform?: Partial<Transform>;
}

export interface SceneCreateSphereOp {
  readonly op: "scene.createSphere";
  readonly id?: ObjectId;
  readonly name?: string;
  readonly dimensions: SphereDimensions;
  readonly transform?: Partial<Transform>;
}

export interface SceneCreateConeOp {
  readonly op: "scene.createCone";
  readonly id?: ObjectId;
  readonly name?: string;
  readonly dimensions: ConeDimensions;
  readonly transform?: Partial<Transform>;
}

export interface SceneCreateTorusOp {
  readonly op: "scene.createTorus";
  readonly id?: ObjectId;
  readonly name?: string;
  readonly dimensions: TorusDimensions;
  readonly transform?: Partial<Transform>;
}

export interface SceneDeleteObjectOp {
  readonly op: "scene.deleteObject";
  readonly id: ObjectId;
}

export interface SceneUpdateTransformOp {
  readonly op: "scene.updateTransform";
  readonly id: ObjectId;
  readonly transform: Partial<Transform>;
}

export interface SceneUpdateBoxDimensionsOp {
  readonly op: "scene.updateBoxDimensions";
  readonly id: ObjectId;
  readonly dimensions: BoxDimensions;
}

export interface SceneUpdateCylinderDimensionsOp {
  readonly op: "scene.updateCylinderDimensions";
  readonly id: ObjectId;
  readonly dimensions: CylinderDimensions;
}

export interface SceneUpdateSphereDimensionsOp {
  readonly op: "scene.updateSphereDimensions";
  readonly id: ObjectId;
  readonly dimensions: SphereDimensions;
}

export interface SceneUpdateConeDimensionsOp {
  readonly op: "scene.updateConeDimensions";
  readonly id: ObjectId;
  readonly dimensions: ConeDimensions;
}

export interface SceneUpdateTorusDimensionsOp {
  readonly op: "scene.updateTorusDimensions";
  readonly id: ObjectId;
  readonly dimensions: TorusDimensions;
}

export interface SceneRenameObjectOp {
  readonly op: "scene.renameObject";
  readonly id: ObjectId;
  readonly name: string;
}

export interface SketchCreateOp {
  readonly op: "sketch.create";
  readonly id?: SketchId;
  readonly name: string;
  readonly plane: SketchPlane;
}

export interface SketchCreateOnFaceOp {
  readonly op: "sketch.createOnFace";
  readonly id?: SketchId;
  readonly name: string;
  readonly bodyId: BodyId;
  readonly faceStableId: string;
}

export interface SketchRenameOp {
  readonly op: "sketch.rename";
  readonly id: SketchId;
  readonly name: string;
}

export interface SketchDeleteOp {
  readonly op: "sketch.delete";
  readonly id: SketchId;
}

export interface SketchAddPointOp {
  readonly op: "sketch.addPoint";
  readonly sketchId: SketchId;
  readonly id?: SketchEntityId;
  readonly point: Vec2;
}

export interface SketchAddLineOp {
  readonly op: "sketch.addLine";
  readonly sketchId: SketchId;
  readonly id?: SketchEntityId;
  readonly start: Vec2;
  readonly end: Vec2;
}

export interface SketchAddRectangleOp {
  readonly op: "sketch.addRectangle";
  readonly sketchId: SketchId;
  readonly id?: SketchEntityId;
  readonly center: Vec2;
  readonly width: number;
  readonly height: number;
}

export interface SketchAddCircleOp {
  readonly op: "sketch.addCircle";
  readonly sketchId: SketchId;
  readonly id?: SketchEntityId;
  readonly center: Vec2;
  readonly radius: number;
}

export interface SketchUpdateEntityOp {
  readonly op: "sketch.updateEntity";
  readonly sketchId: SketchId;
  readonly entity: SketchEntitySnapshot;
}

export interface SketchDeleteEntityOp {
  readonly op: "sketch.deleteEntity";
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
}

export interface FeatureExtrudeOp {
  readonly op: "feature.extrude";
  readonly id?: FeatureId;
  readonly bodyId?: BodyId;
  readonly name?: string;
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
  readonly depth: number;
  readonly side?: FeatureExtrudeSide;
}

export interface FeatureDeleteOp {
  readonly op: "feature.delete";
  readonly id: FeatureId;
}

export interface FeatureUpdateExtrudeOp {
  readonly op: "feature.updateExtrude";
  readonly id: FeatureId;
  readonly depth?: number;
  readonly side?: FeatureExtrudeSide;
}

export interface CadObjectRef {
  readonly id: ObjectId;
  readonly kind: CadObjectKind;
}

export interface CadSketchRef {
  readonly id: SketchId;
}

export interface CadSketchEntityRef {
  readonly sketchId: SketchId;
  readonly id: SketchEntityId;
  readonly kind: SketchEntityKind;
}

export interface CadFeatureRef {
  readonly id: FeatureId;
  readonly kind: "extrude";
  readonly bodyId: BodyId;
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
  readonly profileKind: FeatureExtrudeProfileKind;
  readonly depth: number;
  readonly side: FeatureExtrudeSide;
}

export interface CadBodyRef {
  readonly id: BodyId;
  readonly kind: "solid";
  readonly featureId: FeatureId;
}

export interface DocumentSemanticDiff {
  readonly units?: {
    readonly before: DocumentUnits;
    readonly after: DocumentUnits;
    readonly mode?: DocumentUnitUpdateMode;
    readonly scaleFactor?: number;
  };
}

export interface SketchSemanticDiff {
  readonly created?: readonly CadSketchRef[];
  readonly modified?: readonly CadSketchRef[];
  readonly deleted?: readonly CadSketchRef[];
  readonly entitiesCreated?: readonly CadSketchEntityRef[];
  readonly entitiesModified?: readonly CadSketchEntityRef[];
  readonly entitiesDeleted?: readonly CadSketchEntityRef[];
}

export interface FeatureSemanticDiff {
  readonly created?: readonly CadFeatureRef[];
  readonly modified?: readonly CadFeatureRef[];
  readonly deleted?: readonly CadFeatureRef[];
  readonly bodiesCreated?: readonly CadBodyRef[];
  readonly bodiesModified?: readonly CadBodyRef[];
  readonly bodiesDeleted?: readonly CadBodyRef[];
}

export interface SemanticDiff {
  readonly created: readonly CadObjectRef[];
  readonly modified: readonly CadObjectRef[];
  readonly deleted: readonly CadObjectRef[];
  readonly document?: DocumentSemanticDiff;
  readonly sketches?: SketchSemanticDiff;
  readonly features?: FeatureSemanticDiff;
}

export type CadTransactionStatus = "committed" | "undone";

export interface CadBatch {
  readonly version: CadOpsVersion;
  readonly mode: CadBatchMode;
  readonly ops: readonly CadOp[];
  readonly actor?: CadActorMetadata;
  readonly audit?: CadTransactionAuditMetadata;
}

export type CadBatchValidationErrorCode =
  | "EMPTY_BATCH"
  | "OBJECT_ALREADY_EXISTS"
  | "OBJECT_NOT_FOUND"
  | "OBJECT_KIND_MISMATCH"
  | "INVALID_DIMENSIONS"
  | "INVALID_UNITS"
  | "INVALID_UNIT_UPDATE_MODE"
  | "INVALID_OBJECT_NAME"
  | "SKETCH_ALREADY_EXISTS"
  | "SKETCH_NOT_FOUND"
  | "SKETCH_ENTITY_ALREADY_EXISTS"
  | "SKETCH_ENTITY_NOT_FOUND"
  | "SKETCH_IN_USE"
  | "SKETCH_ENTITY_IN_USE"
  | "INVALID_SKETCH_NAME"
  | "INVALID_SKETCH_PLANE"
  | "INVALID_SKETCH_ENTITY"
  | "BODY_NOT_FOUND"
  | "UNSUPPORTED_BODY_REFERENCES"
  | "GENERATED_REFERENCE_NOT_FOUND"
  | "GENERATED_REFERENCE_KIND_MISMATCH"
  | "GENERATED_REFERENCE_OPERATION_NOT_ELIGIBLE"
  | "FEATURE_ALREADY_EXISTS"
  | "FEATURE_NOT_FOUND"
  | "FEATURE_NOT_DELETABLE"
  | "FEATURE_NOT_EDITABLE"
  | "BODY_ALREADY_EXISTS"
  | "INVALID_FEATURE"
  | "UNSUPPORTED_SKETCH_PROFILE"
  | "INVALID_ACTOR"
  | "INVALID_AUDIT";

export interface CadBatchValidationError {
  readonly code: CadBatchValidationErrorCode;
  readonly message: string;
  readonly opIndex?: number;
  readonly op?: CadOp["op"];
  readonly objectId?: ObjectId;
  readonly sketchId?: SketchId;
  readonly sketchEntityId?: SketchEntityId;
  readonly featureId?: FeatureId;
  readonly bodyId?: BodyId;
  readonly stableId?: string;
  readonly path?: string;
  readonly expected?: string;
  readonly received?: string;
}

export interface CadBatchValidationResult {
  readonly ok: boolean;
  readonly errors: readonly CadBatchValidationError[];
  readonly warnings: readonly string[];
}

export type CadBatchResponse = CadBatchSuccessResponse | CadBatchErrorResponse;

export interface CadBatchSuccessResponse {
  readonly ok: true;
  readonly mode: CadBatchMode;
  readonly createdIds: readonly ObjectId[];
  readonly modifiedIds: readonly ObjectId[];
  readonly deletedIds: readonly ObjectId[];
  readonly createdSketchIds?: readonly SketchId[];
  readonly modifiedSketchIds?: readonly SketchId[];
  readonly deletedSketchIds?: readonly SketchId[];
  readonly createdSketchEntityIds?: readonly SketchEntityId[];
  readonly modifiedSketchEntityIds?: readonly SketchEntityId[];
  readonly deletedSketchEntityIds?: readonly SketchEntityId[];
  readonly createdFeatureIds?: readonly FeatureId[];
  readonly modifiedFeatureIds?: readonly FeatureId[];
  readonly deletedFeatureIds?: readonly FeatureId[];
  readonly createdBodyIds?: readonly BodyId[];
  readonly modifiedBodyIds?: readonly BodyId[];
  readonly deletedBodyIds?: readonly BodyId[];
  readonly warnings: readonly string[];
  readonly transactionId?: TransactionId;
  readonly actor?: CadActorMetadata;
  readonly audit?: CadTransactionAuditMetadata;
}

export interface CadBatchErrorResponse {
  readonly ok: false;
  readonly mode: CadBatchMode;
  readonly error: CadBatchValidationError;
  readonly errors: readonly CadBatchValidationError[];
  readonly createdIds: readonly ObjectId[];
  readonly modifiedIds: readonly ObjectId[];
  readonly deletedIds: readonly ObjectId[];
  readonly createdSketchIds?: readonly SketchId[];
  readonly modifiedSketchIds?: readonly SketchId[];
  readonly deletedSketchIds?: readonly SketchId[];
  readonly createdSketchEntityIds?: readonly SketchEntityId[];
  readonly modifiedSketchEntityIds?: readonly SketchEntityId[];
  readonly deletedSketchEntityIds?: readonly SketchEntityId[];
  readonly createdFeatureIds?: readonly FeatureId[];
  readonly modifiedFeatureIds?: readonly FeatureId[];
  readonly deletedFeatureIds?: readonly FeatureId[];
  readonly createdBodyIds?: readonly BodyId[];
  readonly modifiedBodyIds?: readonly BodyId[];
  readonly deletedBodyIds?: readonly BodyId[];
  readonly warnings: readonly string[];
}

export type CadQueryKind =
  | "project.summary"
  | "project.features"
  | "project.structure"
  | "project.sketches"
  | "object.get"
  | "object.measurements"
  | "project.extents"
  | "sketch.get"
  | "body.generatedReferences"
  | "body.resolveGeneratedReference"
  | "body.measurements"
  | "transaction.history";

export type CadQuery =
  | ProjectSummaryQuery
  | ProjectFeaturesQuery
  | ProjectStructureQuery
  | ProjectSketchesQuery
  | ObjectGetQuery
  | ObjectMeasurementsQuery
  | ProjectExtentsQuery
  | SketchGetQuery
  | BodyGeneratedReferencesQuery
  | BodyResolveGeneratedReferenceQuery
  | BodyMeasurementsQuery
  | TransactionHistoryQuery;

export interface ProjectSummaryQuery {
  readonly query: "project.summary";
}

export interface ProjectFeaturesQuery {
  readonly query: "project.features";
}

export interface ProjectStructureQuery {
  readonly query: "project.structure";
}

export interface ProjectSketchesQuery {
  readonly query: "project.sketches";
}

export interface ObjectGetQuery {
  readonly query: "object.get";
  readonly id: ObjectId;
}

export interface ObjectMeasurementsQuery {
  readonly query: "object.measurements";
  readonly id: ObjectId;
}

export interface ProjectExtentsQuery {
  readonly query: "project.extents";
}

export interface SketchGetQuery {
  readonly query: "sketch.get";
  readonly id: SketchId;
}

export interface BodyGeneratedReferencesQuery {
  readonly query: "body.generatedReferences";
  readonly bodyId: BodyId;
}

export interface BodyResolveGeneratedReferenceQuery {
  readonly query: "body.resolveGeneratedReference";
  readonly bodyId: BodyId;
  readonly stableId: string;
}

export interface BodyMeasurementsQuery {
  readonly query: "body.measurements";
  readonly bodyId: BodyId;
}

export interface TransactionHistoryQuery {
  readonly query: "transaction.history";
}

export interface CadQueryRequest {
  readonly version: CadOpsVersion;
  readonly query: CadQuery;
}

export type CadObjectSnapshot =
  | BoxObjectSnapshot
  | CylinderObjectSnapshot
  | SphereObjectSnapshot
  | ConeObjectSnapshot
  | TorusObjectSnapshot;

export interface BoxObjectSnapshot {
  readonly id: ObjectId;
  readonly kind: "box";
  readonly name?: string;
  readonly dimensions: BoxDimensions;
  readonly transform: Transform;
}

export interface CylinderObjectSnapshot {
  readonly id: ObjectId;
  readonly kind: "cylinder";
  readonly name?: string;
  readonly dimensions: CylinderDimensions;
  readonly transform: Transform;
}

export interface SphereObjectSnapshot {
  readonly id: ObjectId;
  readonly kind: "sphere";
  readonly name?: string;
  readonly dimensions: SphereDimensions;
  readonly transform: Transform;
}

export interface ConeObjectSnapshot {
  readonly id: ObjectId;
  readonly kind: "cone";
  readonly name?: string;
  readonly dimensions: ConeDimensions;
  readonly transform: Transform;
}

export interface TorusObjectSnapshot {
  readonly id: ObjectId;
  readonly kind: "torus";
  readonly name?: string;
  readonly dimensions: TorusDimensions;
  readonly transform: Transform;
}

export type SketchEntitySnapshot =
  | SketchPointEntitySnapshot
  | SketchLineEntitySnapshot
  | SketchRectangleEntitySnapshot
  | SketchCircleEntitySnapshot;

export interface SketchPointEntitySnapshot {
  readonly id: SketchEntityId;
  readonly kind: "point";
  readonly point: Vec2;
}

export interface SketchLineEntitySnapshot {
  readonly id: SketchEntityId;
  readonly kind: "line";
  readonly start: Vec2;
  readonly end: Vec2;
}

export interface SketchRectangleEntitySnapshot {
  readonly id: SketchEntityId;
  readonly kind: "rectangle";
  readonly center: Vec2;
  readonly width: number;
  readonly height: number;
}

export interface SketchCircleEntitySnapshot {
  readonly id: SketchEntityId;
  readonly kind: "circle";
  readonly center: Vec2;
  readonly radius: number;
}

export type SketchAttachmentSnapshot = SketchGeneratedFaceAttachmentSnapshot;

export interface SketchGeneratedFaceAttachmentSnapshot {
  readonly kind: "generatedFace";
  readonly bodyId: BodyId;
  readonly faceStableId: string;
  readonly sourceFeatureId: FeatureId;
  readonly sourceSketchId: SketchId;
  readonly sourceSketchEntityId: SketchEntityId;
  readonly faceRole: CadGeneratedExtrudeFaceRole;
}

export interface SketchSnapshot {
  readonly id: SketchId;
  readonly name: string;
  readonly plane: SketchPlane;
  readonly attachment?: SketchAttachmentSnapshot;
  readonly entities: readonly SketchEntitySnapshot[];
}

export interface ExtrudeFeatureSnapshot {
  readonly id: FeatureId;
  readonly kind: "extrude";
  readonly name?: string;
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
  readonly profileKind: FeatureExtrudeProfileKind;
  readonly depth: number;
  readonly side: FeatureExtrudeSide;
  readonly bodyId: BodyId;
}

export interface CadAxisAlignedBounds {
  readonly min: Vec3;
  readonly max: Vec3;
  readonly size: Vec3;
  readonly center: Vec3;
}

export interface ObjectMeasurementsSnapshot {
  readonly id: ObjectId;
  readonly kind: CadObjectKind;
  readonly name?: string;
  readonly units: DocumentUnits;
  readonly dimensions:
    | BoxDimensions
    | CylinderDimensions
    | SphereDimensions
    | ConeDimensions
    | TorusDimensions;
  readonly transform: Transform;
  readonly localBounds: CadAxisAlignedBounds;
  readonly worldBounds: CadAxisAlignedBounds;
  readonly approximateVolume: number;
}

export interface ObjectExtentSnapshot {
  readonly id: ObjectId;
  readonly kind: CadObjectKind;
  readonly name?: string;
  readonly worldBounds: CadAxisAlignedBounds;
  readonly approximateVolume: number;
}

export type CadBodyMeasurementModel = "sourceAnalytic";

export interface BodyMeasurementsSnapshot {
  readonly bodyId: BodyId;
  readonly sourceFeatureId: FeatureId;
  readonly sourceSketchId: SketchId;
  readonly sourceSketchEntityId: SketchEntityId;
  readonly profileKind: FeatureExtrudeProfileKind;
  readonly units: DocumentUnits;
  readonly sketchPlane: SketchPlane;
  readonly side: FeatureExtrudeSide;
  readonly depth: number;
  readonly measurementModel: CadBodyMeasurementModel;
  readonly localBounds: CadAxisAlignedBounds;
  readonly localExtents: Vec3;
  readonly centroid: Vec3;
  readonly volume: number;
  readonly surfaceArea: number;
}

export type CadPrimitiveCreateOp =
  | "scene.createBox"
  | "scene.createCylinder"
  | "scene.createSphere"
  | "scene.createCone"
  | "scene.createTorus";

export interface CadPrimitiveFeatureSource {
  readonly type: "sceneObject";
  readonly createdByTransactionId?: TransactionId;
  readonly createOp?: CadPrimitiveCreateOp;
}

export interface CadPrimitiveFeatureSummary {
  readonly id: FeatureId;
  readonly kind: "primitive";
  readonly partId: PartId;
  readonly primitive: CadObjectKind;
  readonly objectId: ObjectId;
  readonly bodyId: BodyId;
  readonly name?: string;
  readonly dimensions:
    | BoxDimensions
    | CylinderDimensions
    | SphereDimensions
    | ConeDimensions
    | TorusDimensions;
  readonly transform: Transform;
  readonly source: CadPrimitiveFeatureSource;
}

export interface CadExtrudeFeatureSource {
  readonly type: "sketchEntity";
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
}

export interface CadExtrudeFeatureSummary {
  readonly id: FeatureId;
  readonly kind: "extrude";
  readonly partId: PartId;
  readonly bodyId: BodyId;
  readonly name?: string;
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
  readonly profileKind: FeatureExtrudeProfileKind;
  readonly depth: number;
  readonly side: FeatureExtrudeSide;
  readonly source: CadExtrudeFeatureSource;
}

export type CadFeatureSummary =
  | CadPrimitiveFeatureSummary
  | CadExtrudeFeatureSummary;

export interface CadPartSource {
  readonly type: "defaultScenePart";
}

export interface CadPartSnapshot {
  readonly id: PartId;
  readonly kind: "part";
  readonly name: string;
  readonly source: CadPartSource;
  readonly objectIds: readonly ObjectId[];
  readonly featureIds: readonly FeatureId[];
  readonly bodyIds: readonly BodyId[];
  readonly sketchIds: readonly SketchId[];
}

export interface CadPrimitiveBodySource {
  readonly type: "primitiveFeature";
  readonly featureId: FeatureId;
  readonly objectId: ObjectId;
}

export interface CadSketchExtrudeBodySource {
  readonly type: "sketchExtrudeFeature";
  readonly featureId: FeatureId;
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
  readonly profileKind: FeatureExtrudeProfileKind;
}

export type CadBodySource = CadPrimitiveBodySource | CadSketchExtrudeBodySource;

export interface CadBodySnapshot {
  readonly id: BodyId;
  readonly kind: "solid";
  readonly partId: PartId;
  readonly featureId: FeatureId;
  readonly objectId?: ObjectId;
  readonly primitive?: CadObjectKind;
  readonly name?: string;
  readonly source: CadBodySource;
}

export type CadGeneratedEntityKind = "body" | "face" | "edge" | "vertex";

export type CadGeneratedExtrudeFaceRole =
  | "startCap"
  | "endCap"
  | "side:uMin"
  | "side:uMax"
  | "side:vMin"
  | "side:vMax"
  | "side:circular";

export type CadGeneratedExtrudeEdgeRole =
  | "start:uMin"
  | "start:uMax"
  | "start:vMin"
  | "start:vMax"
  | "end:uMin"
  | "end:uMax"
  | "end:vMin"
  | "end:vMax"
  | "longitudinal:uMin:vMin"
  | "longitudinal:uMin:vMax"
  | "longitudinal:uMax:vMin"
  | "longitudinal:uMax:vMax"
  | "start:circular"
  | "end:circular";

export type CadGeneratedExtrudeVertexRole =
  | "start:uMin:vMin"
  | "start:uMin:vMax"
  | "start:uMax:vMin"
  | "start:uMax:vMax"
  | "end:uMin:vMin"
  | "end:uMin:vMax"
  | "end:uMax:vMin"
  | "end:uMax:vMax";

export type CadGeneratedSurfaceType = "plane" | "cylinder";
export type CadGeneratedCurveType = "line" | "circle";

export type CadGeneratedReferenceEligibleOperation =
  | "feature.attachSketchPlane"
  | "feature.measureReference"
  | "feature.selectReference";

export type CadGeneratedReferenceProfileSignature =
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

export interface CadGeneratedReferenceSignature {
  readonly profileKind: FeatureExtrudeProfileKind;
  readonly sketchPlane: SketchPlane;
  readonly extrudeSide: FeatureExtrudeSide;
  readonly depth: number;
  readonly profile?: CadGeneratedReferenceProfileSignature;
  readonly surfaceType?: CadGeneratedSurfaceType;
  readonly curveType?: CadGeneratedCurveType;
  readonly normal?: Vec3;
  readonly axis?: Vec3;
  readonly normalRole?: string;
  readonly axisRole?: string;
  readonly profilePoint?: Vec2;
  readonly positionRole?: string;
}

export interface CadGeneratedBodyReference {
  readonly kind: "body";
  readonly stableId: string;
  readonly label: string;
  readonly description?: string;
  readonly eligibleOperations: readonly CadGeneratedReferenceEligibleOperation[];
  readonly eligibilityNotes?: readonly string[];
  readonly bodyId: BodyId;
  readonly ownerPartId: PartId;
  readonly sourceFeatureId: FeatureId;
  readonly sourceSketchId: SketchId;
  readonly sourceSketchEntityId: SketchEntityId;
  readonly profileKind: FeatureExtrudeProfileKind;
  readonly geometricSignature: CadGeneratedReferenceSignature;
}

export interface CadGeneratedFaceReference {
  readonly kind: "face";
  readonly stableId: string;
  readonly label: string;
  readonly description?: string;
  readonly eligibleOperations: readonly CadGeneratedReferenceEligibleOperation[];
  readonly eligibilityNotes?: readonly string[];
  readonly bodyId: BodyId;
  readonly ownerPartId: PartId;
  readonly sourceFeatureId: FeatureId;
  readonly sourceSketchId: SketchId;
  readonly sourceSketchEntityId: SketchEntityId;
  readonly role: CadGeneratedExtrudeFaceRole;
  readonly geometricSignature: CadGeneratedReferenceSignature;
}

export interface CadGeneratedEdgeReference {
  readonly kind: "edge";
  readonly stableId: string;
  readonly label: string;
  readonly description?: string;
  readonly eligibleOperations: readonly CadGeneratedReferenceEligibleOperation[];
  readonly eligibilityNotes?: readonly string[];
  readonly bodyId: BodyId;
  readonly ownerPartId: PartId;
  readonly sourceFeatureId: FeatureId;
  readonly sourceSketchId: SketchId;
  readonly sourceSketchEntityId: SketchEntityId;
  readonly role: CadGeneratedExtrudeEdgeRole;
  readonly adjacentFaceRoles: readonly CadGeneratedExtrudeFaceRole[];
  readonly geometricSignature: CadGeneratedReferenceSignature;
}

export interface CadGeneratedVertexReference {
  readonly kind: "vertex";
  readonly stableId: string;
  readonly label: string;
  readonly description?: string;
  readonly eligibleOperations: readonly CadGeneratedReferenceEligibleOperation[];
  readonly eligibilityNotes?: readonly string[];
  readonly bodyId: BodyId;
  readonly ownerPartId: PartId;
  readonly sourceFeatureId: FeatureId;
  readonly sourceSketchId: SketchId;
  readonly sourceSketchEntityId: SketchEntityId;
  readonly role: CadGeneratedExtrudeVertexRole;
  readonly adjacentFaceRoles: readonly CadGeneratedExtrudeFaceRole[];
  readonly adjacentEdgeRoles: readonly CadGeneratedExtrudeEdgeRole[];
  readonly geometricSignature: CadGeneratedReferenceSignature;
}

export type CadGeneratedReference =
  | CadGeneratedBodyReference
  | CadGeneratedFaceReference
  | CadGeneratedEdgeReference
  | CadGeneratedVertexReference;

export interface CadObjectModelSource {
  readonly objectId: ObjectId;
  readonly partId: PartId;
  readonly featureId: FeatureId;
  readonly bodyId: BodyId;
}

export interface CadOperationSummary {
  readonly op: CadOp["op"];
  readonly label: string;
  readonly objectId?: ObjectId;
  readonly objectKind?: CadObjectKind;
  readonly sketchId?: SketchId;
  readonly sketchEntityId?: SketchEntityId;
  readonly sketchEntityKind?: SketchEntityKind;
  readonly featureId?: FeatureId;
  readonly bodyId?: BodyId;
}

export interface CadSemanticDiffSummary {
  readonly created: readonly CadObjectRef[];
  readonly modified: readonly CadObjectRef[];
  readonly deleted: readonly CadObjectRef[];
  readonly createdCount: number;
  readonly modifiedCount: number;
  readonly deletedCount: number;
  readonly document?: DocumentSemanticDiff;
  readonly sketches?: SketchSemanticDiff;
  readonly features?: FeatureSemanticDiff;
}

export interface CadTransactionHistoryEntry {
  readonly id: TransactionId;
  readonly status: CadTransactionStatus;
  readonly actor?: CadActorMetadata;
  readonly audit?: CadTransactionAuditMetadata;
  readonly opCount: number;
  readonly ops: readonly CadOperationSummary[];
  readonly diff: CadSemanticDiffSummary;
}

export type CadQueryErrorCode =
  | "OBJECT_NOT_FOUND"
  | "SKETCH_NOT_FOUND"
  | "BODY_NOT_FOUND"
  | "UNSUPPORTED_BODY_REFERENCES"
  | "UNSUPPORTED_BODY_MEASUREMENTS"
  | "GENERATED_REFERENCE_NOT_FOUND";

export interface CadQueryError {
  readonly code: CadQueryErrorCode;
  readonly message: string;
  readonly objectId?: ObjectId;
  readonly sketchId?: SketchId;
  readonly bodyId?: BodyId;
  readonly stableId?: string;
}

export type CadQueryResponse =
  | ProjectSummaryQueryResponse
  | ProjectFeaturesQueryResponse
  | ProjectStructureQueryResponse
  | ProjectSketchesQueryResponse
  | ObjectGetQueryResponse
  | ObjectMeasurementsQueryResponse
  | ProjectExtentsQueryResponse
  | SketchGetQueryResponse
  | BodyGeneratedReferencesQueryResponse
  | BodyResolveGeneratedReferenceQueryResponse
  | BodyMeasurementsQueryResponse
  | TransactionHistoryQueryResponse
  | CadQueryErrorResponse;

export interface ProjectSummaryQueryResponse {
  readonly ok: true;
  readonly query: "project.summary";
  readonly cadOpsVersion: CadOpsVersion;
  readonly units: DocumentUnits;
  readonly objectCount: number;
  readonly objects: readonly CadObjectSnapshot[];
}

export interface ProjectFeaturesQueryResponse {
  readonly ok: true;
  readonly query: "project.features";
  readonly cadOpsVersion: CadOpsVersion;
  readonly featureCount: number;
  readonly features: readonly CadFeatureSummary[];
}

export interface ProjectStructureQueryResponse {
  readonly ok: true;
  readonly query: "project.structure";
  readonly cadOpsVersion: CadOpsVersion;
  readonly partCount: number;
  readonly featureCount: number;
  readonly bodyCount: number;
  readonly parts: readonly CadPartSnapshot[];
  readonly features: readonly CadFeatureSummary[];
  readonly bodies: readonly CadBodySnapshot[];
  readonly objectSources: readonly CadObjectModelSource[];
}

export interface ProjectSketchesQueryResponse {
  readonly ok: true;
  readonly query: "project.sketches";
  readonly cadOpsVersion: CadOpsVersion;
  readonly sketchCount: number;
  readonly sketches: readonly SketchSnapshot[];
}

export interface ObjectGetQueryResponse {
  readonly ok: true;
  readonly query: "object.get";
  readonly cadOpsVersion: CadOpsVersion;
  readonly object: CadObjectSnapshot;
}

export interface ObjectMeasurementsQueryResponse {
  readonly ok: true;
  readonly query: "object.measurements";
  readonly cadOpsVersion: CadOpsVersion;
  readonly measurements: ObjectMeasurementsSnapshot;
}

export interface ProjectExtentsQueryResponse {
  readonly ok: true;
  readonly query: "project.extents";
  readonly cadOpsVersion: CadOpsVersion;
  readonly units: DocumentUnits;
  readonly objectCount: number;
  readonly bounds?: CadAxisAlignedBounds;
  readonly approximateVolume: number;
  readonly objects: readonly ObjectExtentSnapshot[];
}

export interface TransactionHistoryQueryResponse {
  readonly ok: true;
  readonly query: "transaction.history";
  readonly cadOpsVersion: CadOpsVersion;
  readonly transactionCount: number;
  readonly transactions: readonly CadTransactionHistoryEntry[];
}

export interface SketchGetQueryResponse {
  readonly ok: true;
  readonly query: "sketch.get";
  readonly cadOpsVersion: CadOpsVersion;
  readonly sketch: SketchSnapshot;
}

export interface BodyGeneratedReferencesQueryResponse {
  readonly ok: true;
  readonly query: "body.generatedReferences";
  readonly cadOpsVersion: CadOpsVersion;
  readonly body: CadGeneratedBodyReference;
  readonly faceCount: number;
  readonly faces: readonly CadGeneratedFaceReference[];
  readonly edgeCount: number;
  readonly edges: readonly CadGeneratedEdgeReference[];
  readonly vertexCount: number;
  readonly vertices: readonly CadGeneratedVertexReference[];
}

export interface BodyResolveGeneratedReferenceQueryResponse {
  readonly ok: true;
  readonly query: "body.resolveGeneratedReference";
  readonly cadOpsVersion: CadOpsVersion;
  readonly bodyId: BodyId;
  readonly stableId: string;
  readonly kind: CadGeneratedEntityKind;
  readonly reference: CadGeneratedReference;
}

export interface BodyMeasurementsQueryResponse {
  readonly ok: true;
  readonly query: "body.measurements";
  readonly cadOpsVersion: CadOpsVersion;
  readonly measurements: BodyMeasurementsSnapshot;
}

export interface CadQueryErrorResponse {
  readonly ok: false;
  readonly query: CadQueryKind;
  readonly cadOpsVersion: CadOpsVersion;
  readonly error: CadQueryError;
}

export const protocolPackage: PackageInfo = {
  name: "@web-cad/cad-protocol",
  status: "ready"
};
