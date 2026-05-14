export interface PackageInfo {
  readonly name: string;
  readonly status: "ready";
}

export type CadOpsVersion = "cadops.v1";
export type CadBatchMode = "dryRun" | "commit";

export type ObjectId = string;
export type TransactionId = string;

export type Vec3 = readonly [number, number, number];

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

export type CadOp =
  | SceneCreateBoxOp
  | SceneCreateCylinderOp
  | SceneDeleteObjectOp
  | SceneUpdateTransformOp;

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

export interface CadObjectRef {
  readonly id: ObjectId;
  readonly kind: "box" | "cylinder";
}

export interface SemanticDiff {
  readonly created: readonly CadObjectRef[];
  readonly modified: readonly CadObjectRef[];
  readonly deleted: readonly CadObjectRef[];
}

export interface CadBatch {
  readonly version: CadOpsVersion;
  readonly mode: CadBatchMode;
  readonly ops: readonly CadOp[];
}

export type CadBatchValidationErrorCode =
  | "EMPTY_BATCH"
  | "OBJECT_ALREADY_EXISTS"
  | "OBJECT_NOT_FOUND";

export interface CadBatchValidationError {
  readonly code: CadBatchValidationErrorCode;
  readonly message: string;
  readonly opIndex?: number;
  readonly objectId?: ObjectId;
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

export const protocolPackage: PackageInfo = {
  name: "@web-cad/cad-protocol",
  status: "ready"
};
