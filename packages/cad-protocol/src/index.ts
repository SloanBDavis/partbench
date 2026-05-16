export interface PackageInfo {
  readonly name: string;
  readonly status: "ready";
}

export type CadOpsVersion = "cadops.v1";
export type CadBatchMode = "dryRun" | "commit";

export type ObjectId = string;
export type FeatureId = string;
export type TransactionId = string;
export type DocumentUnits = "mm" | "cm" | "m" | "in";
export type DocumentUnitUpdateMode = "metadataOnly" | "preservePhysicalSize";
export type CadActorType = "human" | "agent" | "script" | "system";
export type CadRequestIntent = CadBatchMode;

export type Vec3 = readonly [number, number, number];

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

export type CadObjectKind = "box" | "cylinder" | "sphere";

export type CadOp =
  | DocumentUpdateUnitsOp
  | SceneCreateBoxOp
  | SceneCreateCylinderOp
  | SceneCreateSphereOp
  | SceneDeleteObjectOp
  | SceneUpdateTransformOp
  | SceneUpdateBoxDimensionsOp
  | SceneUpdateCylinderDimensionsOp
  | SceneUpdateSphereDimensionsOp
  | SceneRenameObjectOp;

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

export interface SceneRenameObjectOp {
  readonly op: "scene.renameObject";
  readonly id: ObjectId;
  readonly name: string;
}

export interface CadObjectRef {
  readonly id: ObjectId;
  readonly kind: CadObjectKind;
}

export interface DocumentSemanticDiff {
  readonly units?: {
    readonly before: DocumentUnits;
    readonly after: DocumentUnits;
    readonly mode?: DocumentUnitUpdateMode;
    readonly scaleFactor?: number;
  };
}

export interface SemanticDiff {
  readonly created: readonly CadObjectRef[];
  readonly modified: readonly CadObjectRef[];
  readonly deleted: readonly CadObjectRef[];
  readonly document?: DocumentSemanticDiff;
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
  | "INVALID_ACTOR"
  | "INVALID_AUDIT";

export interface CadBatchValidationError {
  readonly code: CadBatchValidationErrorCode;
  readonly message: string;
  readonly opIndex?: number;
  readonly op?: CadOp["op"];
  readonly objectId?: ObjectId;
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
  readonly warnings: readonly string[];
}

export type CadQueryKind =
  | "project.summary"
  | "project.features"
  | "object.get"
  | "object.measurements"
  | "project.extents"
  | "transaction.history";

export type CadQuery =
  | ProjectSummaryQuery
  | ProjectFeaturesQuery
  | ObjectGetQuery
  | ObjectMeasurementsQuery
  | ProjectExtentsQuery
  | TransactionHistoryQuery;

export interface ProjectSummaryQuery {
  readonly query: "project.summary";
}

export interface ProjectFeaturesQuery {
  readonly query: "project.features";
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
  | SphereObjectSnapshot;

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
  readonly dimensions: BoxDimensions | CylinderDimensions | SphereDimensions;
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

export type CadPrimitiveCreateOp =
  | "scene.createBox"
  | "scene.createCylinder"
  | "scene.createSphere";

export interface CadPrimitiveFeatureSource {
  readonly type: "sceneObject";
  readonly createdByTransactionId?: TransactionId;
  readonly createOp?: CadPrimitiveCreateOp;
}

export interface CadPrimitiveFeatureSummary {
  readonly id: FeatureId;
  readonly kind: "primitive";
  readonly primitive: CadObjectKind;
  readonly objectId: ObjectId;
  readonly name?: string;
  readonly dimensions: BoxDimensions | CylinderDimensions | SphereDimensions;
  readonly transform: Transform;
  readonly source: CadPrimitiveFeatureSource;
}

export interface CadOperationSummary {
  readonly op: CadOp["op"];
  readonly label: string;
  readonly objectId?: ObjectId;
  readonly objectKind?: CadObjectKind;
}

export interface CadSemanticDiffSummary {
  readonly created: readonly CadObjectRef[];
  readonly modified: readonly CadObjectRef[];
  readonly deleted: readonly CadObjectRef[];
  readonly createdCount: number;
  readonly modifiedCount: number;
  readonly deletedCount: number;
  readonly document?: DocumentSemanticDiff;
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

export type CadQueryErrorCode = "OBJECT_NOT_FOUND";

export interface CadQueryError {
  readonly code: CadQueryErrorCode;
  readonly message: string;
  readonly objectId?: ObjectId;
}

export type CadQueryResponse =
  | ProjectSummaryQueryResponse
  | ProjectFeaturesQueryResponse
  | ObjectGetQueryResponse
  | ObjectMeasurementsQueryResponse
  | ProjectExtentsQueryResponse
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
  readonly features: readonly CadPrimitiveFeatureSummary[];
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
