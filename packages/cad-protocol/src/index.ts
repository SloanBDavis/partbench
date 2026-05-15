export interface PackageInfo {
  readonly name: string;
  readonly status: "ready";
}

export type CadOpsVersion = "cadops.v1";
export type CadBatchMode = "dryRun" | "commit";

export type ObjectId = string;
export type TransactionId = string;
export type DocumentUnits = "mm" | "cm" | "m" | "in";
export type CadActorType = "human" | "agent" | "script" | "system";

export type Vec3 = readonly [number, number, number];

export interface CadActorMetadata {
  readonly type: CadActorType;
  readonly id?: string;
  readonly name?: string;
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

export type CadObjectKind = "box" | "cylinder";

export type CadOp =
  | DocumentUpdateUnitsOp
  | SceneCreateBoxOp
  | SceneCreateCylinderOp
  | SceneDeleteObjectOp
  | SceneUpdateTransformOp
  | SceneUpdateBoxDimensionsOp
  | SceneUpdateCylinderDimensionsOp
  | SceneRenameObjectOp;

export interface DocumentUpdateUnitsOp {
  readonly op: "document.updateUnits";
  readonly units: DocumentUnits;
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
  };
}

export interface SemanticDiff {
  readonly created: readonly CadObjectRef[];
  readonly modified: readonly CadObjectRef[];
  readonly deleted: readonly CadObjectRef[];
  readonly document?: DocumentSemanticDiff;
}

export interface CadBatch {
  readonly version: CadOpsVersion;
  readonly mode: CadBatchMode;
  readonly ops: readonly CadOp[];
  readonly actor?: CadActorMetadata;
}

export type CadBatchValidationErrorCode =
  | "EMPTY_BATCH"
  | "OBJECT_ALREADY_EXISTS"
  | "OBJECT_NOT_FOUND"
  | "OBJECT_KIND_MISMATCH"
  | "INVALID_DIMENSIONS"
  | "INVALID_UNITS"
  | "INVALID_OBJECT_NAME"
  | "INVALID_ACTOR";

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
  | "object.get"
  | "object.measurements"
  | "project.extents";

export type CadQuery =
  | ProjectSummaryQuery
  | ObjectGetQuery
  | ObjectMeasurementsQuery
  | ProjectExtentsQuery;

export interface ProjectSummaryQuery {
  readonly query: "project.summary";
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

export interface CadQueryRequest {
  readonly version: CadOpsVersion;
  readonly query: CadQuery;
}

export type CadObjectSnapshot = BoxObjectSnapshot | CylinderObjectSnapshot;

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
  readonly dimensions: BoxDimensions | CylinderDimensions;
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

export type CadQueryErrorCode = "OBJECT_NOT_FOUND";

export interface CadQueryError {
  readonly code: CadQueryErrorCode;
  readonly message: string;
  readonly objectId?: ObjectId;
}

export type CadQueryResponse =
  | ProjectSummaryQueryResponse
  | ObjectGetQueryResponse
  | ObjectMeasurementsQueryResponse
  | ProjectExtentsQueryResponse
  | CadQueryErrorResponse;

export interface ProjectSummaryQueryResponse {
  readonly ok: true;
  readonly query: "project.summary";
  readonly cadOpsVersion: CadOpsVersion;
  readonly units: DocumentUnits;
  readonly objectCount: number;
  readonly objects: readonly CadObjectSnapshot[];
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
