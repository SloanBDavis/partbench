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
export type ParameterId = string;
export type SketchDimensionId = string;
export type SketchConstraintId = string;
export type TransactionId = string;
export type NamedReferenceName = string;
export type DocumentUnits = "mm" | "cm" | "m" | "in";
export type DocumentUnitUpdateMode = "metadataOnly" | "preservePhysicalSize";
export type CadActorType = "human" | "agent" | "script" | "system";
export type CadRequestIntent = CadBatchMode;
export type WcadPackageVersion = "partbench.wcad.v1";
export type WcadPackageExtension = ".wcad";
export type WcadSourceIdentityAlgorithm = "partbench-source-v1";
export type WcadDocumentSchemaVersion =
  | "web-cad.project.v16"
  | "web-cad.project.v17";
export type WcadPackageEntryRole =
  | "manifest"
  | "document"
  | "commands"
  | "cache"
  | "thumbnail"
  | "export"
  | "debug"
  | "metadata";
export type WcadReadinessStatus = "supported" | "deferred" | "unavailable";
export type WcadPackageCapabilityId =
  | "packageContract"
  | "packageReadWrite"
  | "fileSystemAccess"
  | "opfsCache"
  | "stepExport";
export type WcadPackageCacheArtifactKind =
  | "derivedMesh"
  | "derivedExactMetadata"
  | "thumbnail"
  | "packageUnpack"
  | "exportIntermediate";

export const WCAD_PACKAGE_VERSION: WcadPackageVersion = "partbench.wcad.v1";
export const WCAD_PACKAGE_EXTENSION: WcadPackageExtension = ".wcad";
export const WCAD_SOURCE_IDENTITY_ALGORITHM: WcadSourceIdentityAlgorithm =
  "partbench-source-v1";
export const WCAD_MANIFEST_ENTRY_PATH = "manifest.json";
export const WCAD_DOCUMENT_ENTRY_PATH = "document.cbor";
export const WCAD_COMMANDS_ENTRY_PATH = "commands.cbor";

export type Vec2 = readonly [number, number];
export type Vec3 = readonly [number, number, number];
export type SketchPlane = "XY" | "XZ" | "YZ";
export type FeatureProfileKind = "rectangle" | "circle";
export type FeatureExtrudeProfileKind = FeatureProfileKind;
export type FeatureRevolveProfileKind = FeatureProfileKind;
export type FeatureExtrudeSide = "positive" | "negative" | "symmetric";
export type FeatureExtrudeOperationMode = "newBody" | "add" | "cut";
export type FeatureRevolveOperationMode = "newBody" | "add" | "cut";
export type FeatureHoleDepthMode = "blind" | "throughAll";
export type FeatureHoleDirection = "positive" | "negative";

export interface FeatureRevolveAxis {
  readonly type: "sketchLine";
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
}

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

export type SketchDimensionStatus =
  | "healthy"
  | "under-defined"
  | "over-defined"
  | "unsupported"
  | "missing-target"
  | "invalid-value"
  | "inconsistent";

export type CurrentSketchConstraintKind =
  | "horizontal"
  | "vertical"
  | "fixed"
  | "coincident"
  | "midpoint"
  | "parallel"
  | "perpendicular";

export type AdvancedSketchConstraintKind =
  | "tangent"
  | "concentric"
  | "equalLength"
  | "equalRadius"
  | "angle"
  | "symmetry";

export type SketchConstraintKind =
  | CurrentSketchConstraintKind
  | AdvancedSketchConstraintKind;

export type SketchPointTargetRole = "position" | "start" | "end" | "center";

export interface SketchPointTarget {
  readonly entityId: SketchEntityId;
  readonly role: SketchPointTargetRole;
}

export type SketchCurveConstraintTargetKind = "line" | "circle";

export interface SketchCurveConstraintTarget {
  readonly entityId: SketchEntityId;
  readonly entityKind: SketchCurveConstraintTargetKind;
}

export type SketchDimensionIssueCode =
  | "PARAMETER_NOT_FOUND"
  | "SKETCH_NOT_FOUND"
  | "SKETCH_ENTITY_NOT_FOUND"
  | "UNSUPPORTED_TARGET"
  | "INVALID_VALUE"
  | "INCONSISTENT_CONSTRAINT";

export type SketchConstraintIssueCode =
  | "SKETCH_NOT_FOUND"
  | "SKETCH_ENTITY_NOT_FOUND"
  | "UNSUPPORTED_TARGET"
  | "INVALID_VALUE"
  | "INCONSISTENT_CONSTRAINT"
  | "CONFLICTING_CONSTRAINT";

export type SketchDimensionTarget =
  | SketchRectangleDimensionTarget
  | SketchCircleDimensionTarget
  | SketchLineDimensionTarget;

export interface SketchRectangleDimensionTarget {
  readonly entityKind: "rectangle";
  readonly role: "width" | "height";
}

export interface SketchCircleDimensionTarget {
  readonly entityKind: "circle";
  readonly role: "radius";
}

export interface SketchLineDimensionTarget {
  readonly entityKind: "line";
  readonly role: "length";
}

export type SketchDimensionValueSource =
  | SketchDimensionLiteralValueSource
  | SketchDimensionParameterValueSource;

export interface SketchDimensionLiteralValueSource {
  readonly type: "literal";
  readonly value: number;
}

export interface SketchDimensionParameterValueSource {
  readonly type: "parameter";
  readonly parameterId: ParameterId;
}

export type CadOp =
  | ParameterCreateOp
  | ParameterUpdateOp
  | ParameterRenameOp
  | ParameterDeleteOp
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
  | SketchDimensionCreateOp
  | SketchDimensionUpdateOp
  | SketchDimensionRenameOp
  | SketchDimensionDeleteOp
  | SketchConstraintCreateOp
  | SketchConstraintRenameOp
  | SketchConstraintDeleteOp
  | FeatureExtrudeOp
  | FeatureRevolveOp
  | FeatureHoleOp
  | FeatureChamferOp
  | FeatureFilletOp
  | FeatureUpdateExtrudeOp
  | FeatureUpdateRevolveOp
  | FeatureUpdateHoleOp
  | FeatureUpdateChamferOp
  | FeatureUpdateFilletOp
  | FeatureDeleteOp
  | ReferenceNameGeneratedOp
  | ReferenceRepairNameOp
  | ReferenceDeleteNameOp;

export interface DocumentUpdateUnitsOp {
  readonly op: "document.updateUnits";
  readonly units: DocumentUnits;
  readonly mode?: DocumentUnitUpdateMode;
}

export interface ParameterCreateOp {
  readonly op: "parameter.create";
  readonly id?: ParameterId;
  readonly name: string;
  readonly value: number;
  readonly description?: string;
}

export interface ParameterUpdateOp {
  readonly op: "parameter.update";
  readonly id: ParameterId;
  readonly value?: number;
  readonly description?: string;
}

export interface ParameterRenameOp {
  readonly op: "parameter.rename";
  readonly id: ParameterId;
  readonly name: string;
}

export interface ParameterDeleteOp {
  readonly op: "parameter.delete";
  readonly id: ParameterId;
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
  readonly bodyId?: BodyId;
  readonly faceStableId?: string;
  readonly referenceName?: NamedReferenceName;
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

export interface SketchDimensionCreateOp {
  readonly op: "sketch.dimension.create";
  readonly id?: SketchDimensionId;
  readonly name: string;
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
  readonly target: SketchDimensionTarget;
  readonly value?: number;
  readonly parameterId?: ParameterId;
}

export interface SketchDimensionUpdateOp {
  readonly op: "sketch.dimension.update";
  readonly id: SketchDimensionId;
  readonly value?: number;
  readonly parameterId?: ParameterId;
}

export interface SketchDimensionRenameOp {
  readonly op: "sketch.dimension.rename";
  readonly id: SketchDimensionId;
  readonly name: string;
}

export interface SketchDimensionDeleteOp {
  readonly op: "sketch.dimension.delete";
  readonly id: SketchDimensionId;
}

export type SketchConstraintCreateOp =
  | SketchOrientationConstraintCreateOp
  | SketchFixedConstraintCreateOp
  | SketchCoincidentConstraintCreateOp
  | SketchMidpointConstraintCreateOp
  | SketchParallelConstraintCreateOp
  | SketchPerpendicularConstraintCreateOp;

export interface SketchOrientationConstraintCreateOp {
  readonly op: "sketch.constraint.create";
  readonly id?: SketchConstraintId;
  readonly name: string;
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
  readonly kind: "horizontal" | "vertical";
}

export interface SketchFixedConstraintCreateOp {
  readonly op: "sketch.constraint.create";
  readonly id?: SketchConstraintId;
  readonly name: string;
  readonly sketchId: SketchId;
  readonly kind: "fixed";
  readonly target: SketchPointTarget;
  readonly coordinate?: Vec2;
}

export interface SketchCoincidentConstraintCreateOp {
  readonly op: "sketch.constraint.create";
  readonly id?: SketchConstraintId;
  readonly name: string;
  readonly sketchId: SketchId;
  readonly kind: "coincident";
  readonly primaryTarget: SketchPointTarget;
  readonly secondaryTarget: SketchPointTarget;
}

export interface SketchMidpointConstraintCreateOp {
  readonly op: "sketch.constraint.create";
  readonly id?: SketchConstraintId;
  readonly name: string;
  readonly sketchId: SketchId;
  readonly kind: "midpoint";
  readonly lineEntityId: SketchEntityId;
  readonly target: SketchPointTarget;
}

export interface SketchParallelConstraintCreateOp {
  readonly op: "sketch.constraint.create";
  readonly id?: SketchConstraintId;
  readonly name: string;
  readonly sketchId: SketchId;
  readonly kind: "parallel";
  readonly primaryLineEntityId: SketchEntityId;
  readonly secondaryLineEntityId: SketchEntityId;
}

export interface SketchPerpendicularConstraintCreateOp {
  readonly op: "sketch.constraint.create";
  readonly id?: SketchConstraintId;
  readonly name: string;
  readonly sketchId: SketchId;
  readonly kind: "perpendicular";
  readonly primaryLineEntityId: SketchEntityId;
  readonly secondaryLineEntityId: SketchEntityId;
}

export interface SketchConstraintRenameOp {
  readonly op: "sketch.constraint.rename";
  readonly id: SketchConstraintId;
  readonly name: string;
}

export interface SketchConstraintDeleteOp {
  readonly op: "sketch.constraint.delete";
  readonly id: SketchConstraintId;
}

export interface FeatureExtrudeOp {
  readonly op: "feature.extrude";
  readonly id?: FeatureId;
  readonly bodyId?: BodyId;
  readonly targetBodyId?: BodyId;
  readonly name?: string;
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
  readonly depth: number;
  readonly side?: FeatureExtrudeSide;
  readonly operationMode?: FeatureExtrudeOperationMode;
}

export interface FeatureRevolveOp {
  readonly op: "feature.revolve";
  readonly id?: FeatureId;
  readonly bodyId?: BodyId;
  readonly targetBodyId?: BodyId;
  readonly name?: string;
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
  readonly axis: FeatureRevolveAxis;
  readonly angleDegrees: number;
  readonly operationMode?: FeatureRevolveOperationMode;
}

export interface FeatureHoleOp {
  readonly op: "feature.hole";
  readonly id?: FeatureId;
  readonly bodyId?: BodyId;
  readonly targetBodyId: BodyId;
  readonly name?: string;
  readonly sketchId: SketchId;
  readonly circleEntityId: SketchEntityId;
  readonly depthMode: FeatureHoleDepthMode;
  readonly depth?: number;
  readonly direction?: FeatureHoleDirection;
}

export interface FeatureChamferOp {
  readonly op: "feature.chamfer";
  readonly id?: FeatureId;
  readonly bodyId?: BodyId;
  readonly targetBodyId: BodyId;
  readonly edgeStableId?: string;
  readonly namedReference?: NamedReferenceName;
  readonly distance: number;
  readonly name?: string;
}

export interface FeatureFilletOp {
  readonly op: "feature.fillet";
  readonly id?: FeatureId;
  readonly bodyId?: BodyId;
  readonly targetBodyId: BodyId;
  readonly edgeStableId?: string;
  readonly namedReference?: NamedReferenceName;
  readonly radius: number;
  readonly name?: string;
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

export interface FeatureUpdateRevolveOp {
  readonly op: "feature.updateRevolve";
  readonly id: FeatureId;
  readonly angleDegrees: number;
}

export interface FeatureUpdateHoleOp {
  readonly op: "feature.updateHole";
  readonly id: FeatureId;
  readonly depthMode?: FeatureHoleDepthMode;
  readonly depth?: number;
  readonly direction?: FeatureHoleDirection;
}

export interface FeatureUpdateChamferOp {
  readonly op: "feature.updateChamfer";
  readonly id: FeatureId;
  readonly distance: number;
}

export interface FeatureUpdateFilletOp {
  readonly op: "feature.updateFillet";
  readonly id: FeatureId;
  readonly radius: number;
}

export interface ReferenceNameGeneratedOp {
  readonly op: "reference.nameGenerated";
  readonly name: NamedReferenceName;
  readonly bodyId: BodyId;
  readonly stableId: string;
}

export interface ReferenceRepairNameOp {
  readonly op: "reference.repairName";
  readonly name: NamedReferenceName;
  readonly bodyId: BodyId;
  readonly stableId: string;
}

export interface ReferenceDeleteNameOp {
  readonly op: "reference.deleteName";
  readonly name: NamedReferenceName;
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

export type CadFeatureRef =
  | CadExtrudeFeatureRef
  | CadRevolveFeatureRef
  | CadHoleFeatureRef
  | CadChamferFeatureRef
  | CadFilletFeatureRef;

export interface CadExtrudeFeatureRef {
  readonly id: FeatureId;
  readonly kind: "extrude";
  readonly bodyId: BodyId;
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
  readonly profileKind: FeatureExtrudeProfileKind;
  readonly depth: number;
  readonly side: FeatureExtrudeSide;
  readonly operationMode: FeatureExtrudeOperationMode;
  readonly targetBodyId?: BodyId;
}

export interface CadRevolveFeatureRef {
  readonly id: FeatureId;
  readonly kind: "revolve";
  readonly bodyId: BodyId;
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
  readonly profileKind: FeatureRevolveProfileKind;
  readonly axis: FeatureRevolveAxis;
  readonly angleDegrees: number;
  readonly operationMode: FeatureRevolveOperationMode;
  readonly targetBodyId?: BodyId;
}

export interface CadHoleFeatureRef {
  readonly id: FeatureId;
  readonly kind: "hole";
  readonly bodyId: BodyId;
  readonly targetBodyId: BodyId;
  readonly sketchId: SketchId;
  readonly circleEntityId: SketchEntityId;
  readonly depthMode: FeatureHoleDepthMode;
  readonly depth?: number;
  readonly direction: FeatureHoleDirection;
}

export interface CadChamferFeatureRef {
  readonly id: FeatureId;
  readonly kind: "chamfer";
  readonly bodyId: BodyId;
  readonly targetBodyId: BodyId;
  readonly edgeStableId?: string;
  readonly namedReference?: NamedReferenceName;
  readonly distance: number;
}

export interface CadFilletFeatureRef {
  readonly id: FeatureId;
  readonly kind: "fillet";
  readonly bodyId: BodyId;
  readonly targetBodyId: BodyId;
  readonly edgeStableId?: string;
  readonly namedReference?: NamedReferenceName;
  readonly radius: number;
}

export interface CadBodyRef {
  readonly id: BodyId;
  readonly kind: "solid";
  readonly featureId: FeatureId;
}

export interface CadNamedReferenceRef {
  readonly name: NamedReferenceName;
  readonly bodyId: BodyId;
  readonly stableId: string;
  readonly kind: CadGeneratedEntityKind;
}

export interface CadParameterRef {
  readonly id: ParameterId;
  readonly name: string;
}

export interface CadSketchDimensionRef {
  readonly id: SketchDimensionId;
  readonly name: string;
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
  readonly target: SketchDimensionTarget;
  readonly parameterId?: ParameterId;
}

export interface CadSketchConstraintRef {
  readonly id: SketchConstraintId;
  readonly name: string;
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
  readonly kind: SketchConstraintKind;
  readonly target?: SketchPointTarget;
  readonly primaryTarget?: SketchPointTarget;
  readonly secondaryTarget?: SketchPointTarget;
  readonly lineEntityId?: SketchEntityId;
  readonly primaryLineEntityId?: SketchEntityId;
  readonly secondaryLineEntityId?: SketchEntityId;
  readonly primaryCurveTarget?: SketchCurveConstraintTarget;
  readonly secondaryCurveTarget?: SketchCurveConstraintTarget;
  readonly primaryCircleEntityId?: SketchEntityId;
  readonly secondaryCircleEntityId?: SketchEntityId;
  readonly angleDegrees?: number;
  readonly symmetryLineEntityId?: SketchEntityId;
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
  readonly referenceEffects?: readonly CadFeatureReferenceChangeSummary[];
  readonly lifecycleEffects?: readonly CadBodyLifecycleEffectSummary[];
}

export interface ReferenceSemanticDiff {
  readonly namedCreated?: readonly CadNamedReferenceRef[];
  readonly namedRepaired?: readonly CadNamedReferenceRepairRef[];
  readonly namedDeleted?: readonly CadNamedReferenceRef[];
}

export interface CadNamedReferenceRepairRef {
  readonly before: CadNamedReferenceRef;
  readonly after: CadNamedReferenceRef;
}

export interface ParameterSemanticDiff {
  readonly created?: readonly CadParameterRef[];
  readonly modified?: readonly CadParameterRef[];
  readonly deleted?: readonly CadParameterRef[];
}

export interface SketchDimensionSemanticDiff {
  readonly created?: readonly CadSketchDimensionRef[];
  readonly modified?: readonly CadSketchDimensionRef[];
  readonly deleted?: readonly CadSketchDimensionRef[];
}

export interface SketchConstraintSemanticDiff {
  readonly created?: readonly CadSketchConstraintRef[];
  readonly modified?: readonly CadSketchConstraintRef[];
  readonly deleted?: readonly CadSketchConstraintRef[];
}

export interface SemanticDiff {
  readonly created: readonly CadObjectRef[];
  readonly modified: readonly CadObjectRef[];
  readonly deleted: readonly CadObjectRef[];
  readonly document?: DocumentSemanticDiff;
  readonly sketches?: SketchSemanticDiff;
  readonly features?: FeatureSemanticDiff;
  readonly references?: ReferenceSemanticDiff;
  readonly parameters?: ParameterSemanticDiff;
  readonly sketchDimensions?: SketchDimensionSemanticDiff;
  readonly sketchConstraints?: SketchConstraintSemanticDiff;
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
  | "INVALID_CADOPS_VERSION"
  | "INVALID_BATCH"
  | "INVALID_BATCH_MODE"
  | "INVALID_OPERATION"
  | "EMPTY_BATCH"
  | "OBJECT_ALREADY_EXISTS"
  | "OBJECT_NOT_FOUND"
  | "OBJECT_KIND_MISMATCH"
  | "INVALID_DIMENSIONS"
  | "INVALID_UNITS"
  | "INVALID_UNIT_UPDATE_MODE"
  | "PARAMETER_ALREADY_EXISTS"
  | "PARAMETER_NOT_FOUND"
  | "PARAMETER_IN_USE"
  | "INVALID_PARAMETER"
  | "INVALID_PARAMETER_NAME"
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
  | "SKETCH_DIMENSION_ALREADY_EXISTS"
  | "SKETCH_DIMENSION_NOT_FOUND"
  | "INVALID_SKETCH_DIMENSION"
  | "INVALID_SKETCH_DIMENSION_NAME"
  | "SKETCH_CONSTRAINT_ALREADY_EXISTS"
  | "SKETCH_CONSTRAINT_NOT_FOUND"
  | "CONFLICTING_SKETCH_CONSTRAINT"
  | "INVALID_SKETCH_CONSTRAINT"
  | "INVALID_SKETCH_CONSTRAINT_NAME"
  | "BODY_NOT_FOUND"
  | "UNSUPPORTED_BODY_REFERENCES"
  | "GENERATED_REFERENCE_NOT_FOUND"
  | "GENERATED_REFERENCE_KIND_MISMATCH"
  | "GENERATED_REFERENCE_OPERATION_NOT_ELIGIBLE"
  | "INVALID_REFERENCE_NAME"
  | "NAMED_REFERENCE_ALREADY_EXISTS"
  | "NAMED_REFERENCE_NOT_FOUND"
  | "FEATURE_ALREADY_EXISTS"
  | "FEATURE_NOT_FOUND"
  | "FEATURE_NOT_DELETABLE"
  | "FEATURE_NOT_EDITABLE"
  | "BODY_ALREADY_EXISTS"
  | "TARGET_BODY_REQUIRED"
  | "TARGET_BODY_NOT_SUPPORTED"
  | "INVALID_FEATURE"
  | "UNSUPPORTED_FEATURE_OPERATION"
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
  readonly parameterId?: ParameterId;
  readonly sketchDimensionId?: SketchDimensionId;
  readonly sketchConstraintId?: SketchConstraintId;
  readonly featureId?: FeatureId;
  readonly bodyId?: BodyId;
  readonly stableId?: string;
  readonly referenceName?: NamedReferenceName;
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
  readonly createdParameterIds?: readonly ParameterId[];
  readonly modifiedParameterIds?: readonly ParameterId[];
  readonly deletedParameterIds?: readonly ParameterId[];
  readonly createdSketchDimensionIds?: readonly SketchDimensionId[];
  readonly modifiedSketchDimensionIds?: readonly SketchDimensionId[];
  readonly deletedSketchDimensionIds?: readonly SketchDimensionId[];
  readonly createdSketchConstraintIds?: readonly SketchConstraintId[];
  readonly modifiedSketchConstraintIds?: readonly SketchConstraintId[];
  readonly deletedSketchConstraintIds?: readonly SketchConstraintId[];
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
  readonly createdParameterIds?: readonly ParameterId[];
  readonly modifiedParameterIds?: readonly ParameterId[];
  readonly deletedParameterIds?: readonly ParameterId[];
  readonly createdSketchDimensionIds?: readonly SketchDimensionId[];
  readonly modifiedSketchDimensionIds?: readonly SketchDimensionId[];
  readonly deletedSketchDimensionIds?: readonly SketchDimensionId[];
  readonly createdSketchConstraintIds?: readonly SketchConstraintId[];
  readonly modifiedSketchConstraintIds?: readonly SketchConstraintId[];
  readonly deletedSketchConstraintIds?: readonly SketchConstraintId[];
  readonly createdFeatureIds?: readonly FeatureId[];
  readonly modifiedFeatureIds?: readonly FeatureId[];
  readonly deletedFeatureIds?: readonly FeatureId[];
  readonly createdBodyIds?: readonly BodyId[];
  readonly modifiedBodyIds?: readonly BodyId[];
  readonly deletedBodyIds?: readonly BodyId[];
  readonly warnings: readonly string[];
}

export type CadQueryKind =
  | "parameter.list"
  | "parameter.get"
  | "feature.editability"
  | "project.summary"
  | "project.features"
  | "project.structure"
  | "project.health"
  | "project.dependencyGraph"
  | "project.rebuildPlan"
  | "project.exportReadiness"
  | "project.exportExact"
  | "project.packageReadiness"
  | "project.sketches"
  | "object.get"
  | "object.measurements"
  | "project.extents"
  | "sketch.get"
  | "sketch.editReadiness"
  | "sketch.solverStatus"
  | "sketch.evaluation"
  | "sketch.dimensions"
  | "sketch.dimension.get"
  | "body.generatedReferences"
  | "body.resolveGeneratedReference"
  | "body.topology"
  | "body.measurements"
  | "body.generatedReferenceMeasurements"
  | "reference.listNamed"
  | "reference.resolveNamed"
  | "reference.health"
  | "selection.referenceCandidates"
  | "transaction.history";

export type CadQuery =
  | ParameterListQuery
  | ParameterGetQuery
  | FeatureEditabilityQuery
  | ProjectSummaryQuery
  | ProjectFeaturesQuery
  | ProjectStructureQuery
  | ProjectHealthQuery
  | ProjectDependencyGraphQuery
  | ProjectRebuildPlanQuery
  | ProjectExportReadinessQuery
  | ProjectExactExportQuery
  | ProjectPackageReadinessQuery
  | ProjectSketchesQuery
  | ObjectGetQuery
  | ObjectMeasurementsQuery
  | ProjectExtentsQuery
  | SketchGetQuery
  | SketchEditReadinessQuery
  | SketchSolverStatusQuery
  | SketchEvaluationQuery
  | SketchDimensionsQuery
  | SketchDimensionGetQuery
  | BodyGeneratedReferencesQuery
  | BodyResolveGeneratedReferenceQuery
  | BodyTopologyQuery
  | BodyMeasurementsQuery
  | BodyGeneratedReferenceMeasurementsQuery
  | ReferenceListNamedQuery
  | ReferenceResolveNamedQuery
  | ReferenceHealthQuery
  | SelectionReferenceCandidatesQuery
  | TransactionHistoryQuery;

export interface ParameterListQuery {
  readonly query: "parameter.list";
}

export interface ParameterGetQuery {
  readonly query: "parameter.get";
  readonly id: ParameterId;
}

export interface FeatureEditabilityQuery {
  readonly query: "feature.editability";
  readonly featureId: FeatureId;
  readonly proposedEdit?: CadFeatureEditProposal;
}

export interface ProjectSummaryQuery {
  readonly query: "project.summary";
}

export interface ProjectFeaturesQuery {
  readonly query: "project.features";
}

export interface ProjectStructureQuery {
  readonly query: "project.structure";
}

export interface ProjectHealthQuery {
  readonly query: "project.health";
  readonly derivedExactMetadata?: readonly CadBodyDerivedExactMetadataSnapshot[];
}

export interface ProjectDependencyGraphQuery {
  readonly query: "project.dependencyGraph";
}

export interface ProjectRebuildPlanQuery {
  readonly query: "project.rebuildPlan";
}

export interface ProjectExportReadinessQuery {
  readonly query: "project.exportReadiness";
}

export interface ProjectExactExportQuery {
  readonly query: "project.exportExact";
  readonly format: CadExactExportFormatId;
  readonly bodyIds?: readonly BodyId[];
  readonly sourceIdentity?: WcadSourceIdentity;
}

export interface ProjectPackageReadinessQuery {
  readonly query: "project.packageReadiness";
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
  readonly derivedExactMetadata?: readonly CadBodyDerivedExactMetadataSnapshot[];
}

export interface SketchGetQuery {
  readonly query: "sketch.get";
  readonly id: SketchId;
}

export interface SketchEditReadinessQuery {
  readonly query: "sketch.editReadiness";
  readonly edit: CadSketchEditProposal;
}

export interface SketchSolverStatusQuery {
  readonly query: "sketch.solverStatus";
  readonly sketchId: SketchId;
}

export interface SketchEvaluationQuery {
  readonly query: "sketch.evaluation";
  readonly sketchId: SketchId;
}

export interface SketchDimensionsQuery {
  readonly query: "sketch.dimensions";
  readonly sketchId: SketchId;
}

export interface SketchDimensionGetQuery {
  readonly query: "sketch.dimension.get";
  readonly id: SketchDimensionId;
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

export interface BodyTopologyQuery {
  readonly query: "body.topology";
  readonly bodyId: BodyId;
  readonly derivedExactMetadata?: CadBodyDerivedExactMetadataSnapshot;
}

export interface BodyMeasurementsQuery {
  readonly query: "body.measurements";
  readonly bodyId: BodyId;
}

export interface BodyGeneratedReferenceMeasurementsQuery {
  readonly query: "body.generatedReferenceMeasurements";
  readonly bodyId: BodyId;
  readonly stableId: string;
}

export interface ReferenceListNamedQuery {
  readonly query: "reference.listNamed";
}

export interface ReferenceResolveNamedQuery {
  readonly query: "reference.resolveNamed";
  readonly name: NamedReferenceName;
}

export interface ReferenceHealthQuery {
  readonly query: "reference.health";
  readonly target?: CadReferenceHealthTarget;
}

export interface SelectionReferenceCandidatesQuery {
  readonly query: "selection.referenceCandidates";
  readonly selection: CadSelectionReferenceInput;
  readonly requiredOperation?: CadSelectionReferenceOperation;
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

export interface CadParameterSnapshot {
  readonly id: ParameterId;
  readonly name: string;
  readonly value: number;
  readonly description?: string;
}

export interface SketchDimensionSnapshot {
  readonly id: SketchDimensionId;
  readonly name: string;
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
  readonly target: SketchDimensionTarget;
  readonly valueSource: SketchDimensionValueSource;
}

export type SketchConstraintSnapshot =
  | SketchOrientationConstraintSnapshot
  | SketchFixedConstraintSnapshot
  | SketchCoincidentConstraintSnapshot
  | SketchMidpointConstraintSnapshot
  | SketchParallelConstraintSnapshot
  | SketchPerpendicularConstraintSnapshot
  | SketchTangentConstraintSnapshot
  | SketchConcentricConstraintSnapshot
  | SketchEqualLengthConstraintSnapshot
  | SketchEqualRadiusConstraintSnapshot
  | SketchAngleConstraintSnapshot
  | SketchSymmetryConstraintSnapshot;

export interface SketchOrientationConstraintSnapshot {
  readonly id: SketchConstraintId;
  readonly name: string;
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
  readonly kind: "horizontal" | "vertical";
}

export interface SketchFixedConstraintSnapshot {
  readonly id: SketchConstraintId;
  readonly name: string;
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
  readonly kind: "fixed";
  readonly target: SketchPointTarget;
  readonly coordinate: Vec2;
}

export interface SketchCoincidentConstraintSnapshot {
  readonly id: SketchConstraintId;
  readonly name: string;
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
  readonly kind: "coincident";
  readonly primaryTarget: SketchPointTarget;
  readonly secondaryTarget: SketchPointTarget;
}

export interface SketchMidpointConstraintSnapshot {
  readonly id: SketchConstraintId;
  readonly name: string;
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
  readonly kind: "midpoint";
  readonly lineEntityId: SketchEntityId;
  readonly target: SketchPointTarget;
}

export interface SketchParallelConstraintSnapshot {
  readonly id: SketchConstraintId;
  readonly name: string;
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
  readonly kind: "parallel";
  readonly primaryLineEntityId: SketchEntityId;
  readonly secondaryLineEntityId: SketchEntityId;
}

export interface SketchPerpendicularConstraintSnapshot {
  readonly id: SketchConstraintId;
  readonly name: string;
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
  readonly kind: "perpendicular";
  readonly primaryLineEntityId: SketchEntityId;
  readonly secondaryLineEntityId: SketchEntityId;
}

export interface SketchTangentConstraintSnapshot {
  readonly id: SketchConstraintId;
  readonly name: string;
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
  readonly kind: "tangent";
  readonly primaryTarget: SketchCurveConstraintTarget;
  readonly secondaryTarget: SketchCurveConstraintTarget;
}

export interface SketchConcentricConstraintSnapshot {
  readonly id: SketchConstraintId;
  readonly name: string;
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
  readonly kind: "concentric";
  readonly primaryCircleEntityId: SketchEntityId;
  readonly secondaryCircleEntityId: SketchEntityId;
}

export interface SketchEqualLengthConstraintSnapshot {
  readonly id: SketchConstraintId;
  readonly name: string;
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
  readonly kind: "equalLength";
  readonly primaryLineEntityId: SketchEntityId;
  readonly secondaryLineEntityId: SketchEntityId;
}

export interface SketchEqualRadiusConstraintSnapshot {
  readonly id: SketchConstraintId;
  readonly name: string;
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
  readonly kind: "equalRadius";
  readonly primaryCircleEntityId: SketchEntityId;
  readonly secondaryCircleEntityId: SketchEntityId;
}

export interface SketchAngleConstraintSnapshot {
  readonly id: SketchConstraintId;
  readonly name: string;
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
  readonly kind: "angle";
  readonly primaryLineEntityId: SketchEntityId;
  readonly secondaryLineEntityId: SketchEntityId;
  readonly angleDegrees: number;
}

export interface SketchSymmetryConstraintSnapshot {
  readonly id: SketchConstraintId;
  readonly name: string;
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
  readonly kind: "symmetry";
  readonly primaryTarget: SketchPointTarget;
  readonly secondaryTarget: SketchPointTarget;
  readonly symmetryLineEntityId: SketchEntityId;
}

export interface SketchDimensionIssue {
  readonly code: SketchDimensionIssueCode;
  readonly message: string;
  readonly parameterId?: ParameterId;
  readonly sketchId?: SketchId;
  readonly sketchEntityId?: SketchEntityId;
  readonly sketchDimensionId?: SketchDimensionId;
  readonly expected?: string;
  readonly received?: string;
}

export interface SketchConstraintIssue {
  readonly code: SketchConstraintIssueCode;
  readonly message: string;
  readonly sketchId?: SketchId;
  readonly sketchEntityId?: SketchEntityId;
  readonly sketchConstraintId?: SketchConstraintId;
  readonly sketchPointTarget?: SketchPointTarget;
  readonly primaryTarget?: SketchPointTarget;
  readonly secondaryTarget?: SketchPointTarget;
  readonly lineEntityId?: SketchEntityId;
  readonly expected?: string;
  readonly received?: string;
}

export interface SketchCompletenessIssue {
  readonly code: "UNDER_DEFINED_SKETCH" | "OVER_DEFINED_SKETCH";
  readonly message: string;
  readonly sketchId: SketchId;
  readonly expected?: string;
  readonly received?: string;
}

export type SketchEvaluationIssue =
  | SketchDimensionIssue
  | SketchConstraintIssue
  | SketchCompletenessIssue;

export interface SketchDimensionEntry extends SketchDimensionSnapshot {
  readonly status: SketchDimensionStatus;
  readonly issues: readonly SketchDimensionIssue[];
  readonly effectiveValue?: number;
}

export type SketchConstraintEntry = SketchConstraintSnapshot & {
  readonly status: SketchDimensionStatus;
  readonly issues: readonly SketchConstraintIssue[];
  readonly currentCoordinate?: Vec2;
  readonly primaryCurrentCoordinate?: Vec2;
  readonly secondaryCurrentCoordinate?: Vec2;
  readonly resolvedCoordinate?: Vec2;
  readonly primaryDirection?: Vec2;
  readonly secondaryDirection?: Vec2;
};

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
  readonly operationMode?: FeatureExtrudeOperationMode;
  readonly targetBodyId?: BodyId;
  readonly bodyId: BodyId;
}

export interface RevolveFeatureSnapshot {
  readonly id: FeatureId;
  readonly kind: "revolve";
  readonly name?: string;
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
  readonly profileKind: FeatureRevolveProfileKind;
  readonly axis: FeatureRevolveAxis;
  readonly angleDegrees: number;
  readonly operationMode?: FeatureRevolveOperationMode;
  readonly targetBodyId?: BodyId;
  readonly bodyId: BodyId;
}

export interface HoleFeatureSnapshot {
  readonly id: FeatureId;
  readonly kind: "hole";
  readonly name?: string;
  readonly targetBodyId: BodyId;
  readonly sketchId: SketchId;
  readonly circleEntityId: SketchEntityId;
  readonly depthMode: FeatureHoleDepthMode;
  readonly depth?: number;
  readonly direction: FeatureHoleDirection;
  readonly bodyId: BodyId;
}

export interface ChamferFeatureSnapshot {
  readonly id: FeatureId;
  readonly kind: "chamfer";
  readonly name?: string;
  readonly targetBodyId: BodyId;
  readonly edgeStableId?: string;
  readonly namedReference?: NamedReferenceName;
  readonly distance: number;
  readonly bodyId: BodyId;
}

export interface FilletFeatureSnapshot {
  readonly id: FeatureId;
  readonly kind: "fillet";
  readonly name?: string;
  readonly targetBodyId: BodyId;
  readonly edgeStableId?: string;
  readonly namedReference?: NamedReferenceName;
  readonly radius: number;
  readonly bodyId: BodyId;
}

export type FeatureSnapshot =
  | ExtrudeFeatureSnapshot
  | RevolveFeatureSnapshot
  | HoleFeatureSnapshot
  | ChamferFeatureSnapshot
  | FilletFeatureSnapshot;

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

export type ProjectBodyExtentSource = "source-analytic" | "kernel-derived";

export interface BodyExtentSnapshot {
  readonly bodyId: BodyId;
  readonly sourceFeatureId: FeatureId;
  readonly sourceKind: CadBodyTopologySourceKind;
  readonly extentSource: ProjectBodyExtentSource;
  readonly measurementConfidence: Exclude<
    CadBodyTopologyMeasurementConfidence,
    "none"
  >;
  readonly sourceIdentitySignature?: string;
  readonly sourceSketchId?: SketchId;
  readonly sourceSketchEntityId?: SketchEntityId;
  readonly profileKind?: FeatureExtrudeProfileKind;
  readonly worldBounds: CadAxisAlignedBounds;
  readonly volume: number;
  readonly surfaceArea?: number;
  readonly centroid?: Vec3;
  readonly topologyCounts?: CadBodyExactMetadataTopologyCounts;
}

export type ProjectExtentsWarningCode =
  | "BODY_EXTENTS_UNAVAILABLE"
  | "DERIVED_EXACT_METADATA_MISSING"
  | "DERIVED_EXACT_METADATA_STALE"
  | "DERIVED_EXACT_METADATA_UNSUPPORTED"
  | "DERIVED_EXACT_METADATA_KERNEL_FAILED"
  | "DERIVED_EXACT_METADATA_BINDING_UNAVAILABLE"
  | "DERIVED_EXACT_METADATA_EMPTY"
  | "DERIVED_EXACT_METADATA_INVALID";

export interface ProjectExtentsWarning {
  readonly code: ProjectExtentsWarningCode;
  readonly message: string;
  readonly bodyId: BodyId;
  readonly featureId?: FeatureId;
  readonly status?: CadBodyDerivedExactMetadataStatus;
  readonly errorCode?: string;
  readonly expected?: string;
  readonly received?: string;
}

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

export type GeneratedReferenceMeasurementModel = "sourceAnalytic";

export type GeneratedReferenceMeasurement =
  | GeneratedBodyReferenceMeasurement
  | GeneratedFaceReferenceMeasurement
  | GeneratedEdgeReferenceMeasurement
  | GeneratedVertexReferenceMeasurement;

export interface GeneratedReferenceMeasurementBase {
  readonly kind: CadGeneratedEntityKind;
  readonly stableId: string;
  readonly bodyId: BodyId;
  readonly sourceFeatureId: FeatureId;
  readonly sourceSketchId: SketchId;
  readonly sourceSketchEntityId: SketchEntityId;
  readonly profileKind: FeatureExtrudeProfileKind;
  readonly units: DocumentUnits;
  readonly measurementModel: GeneratedReferenceMeasurementModel;
}

export interface GeneratedBodyReferenceMeasurement extends GeneratedReferenceMeasurementBase {
  readonly kind: "body";
  readonly bounds: CadAxisAlignedBounds;
  readonly volume: number;
  readonly centroid: Vec3;
}

export interface GeneratedFaceReferenceMeasurement extends GeneratedReferenceMeasurementBase {
  readonly kind: "face";
  readonly role: CadGeneratedExtrudeFaceRole;
  readonly area: number;
  readonly bounds: CadAxisAlignedBounds;
  readonly center: Vec3;
  readonly surfaceType: CadGeneratedSurfaceType;
  readonly normal?: Vec3;
  readonly normalRole?: string;
  readonly axis?: Vec3;
  readonly axisRole?: string;
}

export interface GeneratedEdgeReferenceMeasurement extends GeneratedReferenceMeasurementBase {
  readonly kind: "edge";
  readonly role: CadGeneratedExtrudeEdgeRole;
  readonly length: number;
  readonly curveType: CadGeneratedCurveType;
  readonly startPoint?: Vec3;
  readonly endPoint?: Vec3;
  readonly center?: Vec3;
  readonly radius?: number;
  readonly axis?: Vec3;
  readonly axisRole?: string;
}

export interface GeneratedVertexReferenceMeasurement extends GeneratedReferenceMeasurementBase {
  readonly kind: "vertex";
  readonly role: CadGeneratedExtrudeVertexRole;
  readonly point: Vec3;
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
  readonly operationMode: FeatureExtrudeOperationMode;
  readonly targetBodyId?: BodyId;
  readonly source: CadExtrudeFeatureSource;
}

export interface CadRevolveFeatureSource {
  readonly type: "sketchEntityWithAxis";
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
  readonly axis: FeatureRevolveAxis;
}

export interface CadRevolveFeatureSummary {
  readonly id: FeatureId;
  readonly kind: "revolve";
  readonly partId: PartId;
  readonly bodyId: BodyId;
  readonly name?: string;
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
  readonly profileKind: FeatureRevolveProfileKind;
  readonly axis: FeatureRevolveAxis;
  readonly angleDegrees: number;
  readonly operationMode: FeatureRevolveOperationMode;
  readonly targetBodyId?: BodyId;
  readonly source: CadRevolveFeatureSource;
}

export interface CadHoleFeatureSource {
  readonly type: "sketchCircleHole";
  readonly sketchId: SketchId;
  readonly circleEntityId: SketchEntityId;
  readonly targetBodyId: BodyId;
}

export interface CadHoleFeatureSummary {
  readonly id: FeatureId;
  readonly kind: "hole";
  readonly partId: PartId;
  readonly bodyId: BodyId;
  readonly targetBodyId: BodyId;
  readonly name?: string;
  readonly sketchId: SketchId;
  readonly circleEntityId: SketchEntityId;
  readonly depthMode: FeatureHoleDepthMode;
  readonly depth?: number;
  readonly direction: FeatureHoleDirection;
  readonly source: CadHoleFeatureSource;
}

export interface CadChamferFeatureSource {
  readonly type: "generatedEdgeChamfer";
  readonly targetBodyId: BodyId;
  readonly edgeStableId?: string;
  readonly namedReference?: NamedReferenceName;
}

export interface CadChamferFeatureSummary {
  readonly id: FeatureId;
  readonly kind: "chamfer";
  readonly partId: PartId;
  readonly bodyId: BodyId;
  readonly targetBodyId: BodyId;
  readonly edgeStableId?: string;
  readonly namedReference?: NamedReferenceName;
  readonly distance: number;
  readonly name?: string;
  readonly source: CadChamferFeatureSource;
}

export interface CadFilletFeatureSource {
  readonly type: "generatedEdgeFillet";
  readonly targetBodyId: BodyId;
  readonly edgeStableId?: string;
  readonly namedReference?: NamedReferenceName;
}

export interface CadFilletFeatureSummary {
  readonly id: FeatureId;
  readonly kind: "fillet";
  readonly partId: PartId;
  readonly bodyId: BodyId;
  readonly targetBodyId: BodyId;
  readonly edgeStableId?: string;
  readonly namedReference?: NamedReferenceName;
  readonly radius: number;
  readonly name?: string;
  readonly source: CadFilletFeatureSource;
}

export type CadFeatureSummary =
  | CadPrimitiveFeatureSummary
  | CadExtrudeFeatureSummary
  | CadRevolveFeatureSummary
  | CadHoleFeatureSummary
  | CadChamferFeatureSummary
  | CadFilletFeatureSummary;

export type CadFeatureEditabilityStatus =
  | "editable"
  | "blocked"
  | "unsupported"
  | "missing";

export type CadFeatureEditFieldValueType = "number" | "enum" | "reference";

export type CadFeatureRebuildReadinessStatus =
  | "ready"
  | "blocked"
  | "deferred"
  | "unsupported";

export type CadFeatureEditDryRunStatus =
  | "not-requested"
  | "valid"
  | "blocked"
  | "deferred"
  | "unsupported";

export type CadFeatureReferenceChangeCategory =
  | "active"
  | "replaced"
  | "stale"
  | "consumed"
  | "ambiguous"
  | "missing"
  | "unsupported"
  | "repair-needed"
  | "deleted";

export type CadFeatureEditDiagnosticSeverity = "info" | "warning" | "blocker";

export type CadFeatureEditDiagnosticCode =
  | "FEATURE_NOT_FOUND"
  | "FEATURE_EDIT_SUPPORTED"
  | "FEATURE_EDIT_UNSUPPORTED"
  | "FEATURE_EDIT_CONSUMED_BODY"
  | "FEATURE_EDIT_INVALID_PROPOSAL"
  | "FEATURE_EDIT_COMMIT_DEFERRED"
  | "FEATURE_REBUILD_DEFERRED"
  | "REFERENCE_HEALTH_DEFERRED"
  | "AMBIGUOUS_RESULT_TOPOLOGY"
  | "CONSUMED_REFERENCE_NOT_COMMAND_READY";

export interface CadFeatureExtrudeEditProposal {
  readonly kind: "extrude";
  readonly depth?: number;
  readonly side?: FeatureExtrudeSide;
}

export interface CadFeatureRevolveEditProposal {
  readonly kind: "revolve";
  readonly angleDegrees?: number;
}

export interface CadFeatureHoleEditProposal {
  readonly kind: "hole";
  readonly depthMode?: FeatureHoleDepthMode;
  readonly depth?: number;
  readonly direction?: FeatureHoleDirection;
}

export interface CadFeatureChamferEditProposal {
  readonly kind: "chamfer";
  readonly distance?: number;
}

export interface CadFeatureFilletEditProposal {
  readonly kind: "fillet";
  readonly radius?: number;
}

export type CadFeatureEditProposal =
  | CadFeatureExtrudeEditProposal
  | CadFeatureRevolveEditProposal
  | CadFeatureHoleEditProposal
  | CadFeatureChamferEditProposal
  | CadFeatureFilletEditProposal;

export interface CadFeatureEditDiagnostic {
  readonly code: CadFeatureEditDiagnosticCode;
  readonly severity: CadFeatureEditDiagnosticSeverity;
  readonly message: string;
  readonly featureId?: FeatureId;
  readonly bodyId?: BodyId;
  readonly targetBodyId?: BodyId;
  readonly sketchId?: SketchId;
  readonly sketchEntityId?: SketchEntityId;
  readonly stableId?: string;
  readonly referenceName?: NamedReferenceName;
  readonly fieldPath?: string;
  readonly expected?: string;
  readonly received?: string;
}

export interface CadFeatureEditFieldDescriptor {
  readonly path: string;
  readonly label: string;
  readonly valueType: CadFeatureEditFieldValueType;
  readonly currentValue?: number | string;
  readonly unit?: DocumentUnits | "deg";
  readonly enumValues?: readonly string[];
  readonly editable: boolean;
  readonly commitOperation?: CadOp["op"];
  readonly diagnostics: readonly CadFeatureEditDiagnostic[];
}

export interface CadFeatureEditAffectedSummary {
  readonly sketchIds: readonly SketchId[];
  readonly featureIds: readonly FeatureId[];
  readonly bodyIds: readonly BodyId[];
  readonly generatedReferenceCount: number;
  readonly namedReferenceCount: number;
}

export interface CadFeatureReferenceChangeSummary {
  readonly category: CadFeatureReferenceChangeCategory;
  readonly bodyId?: BodyId;
  readonly stableId?: string;
  readonly kind?: CadGeneratedEntityKind;
  readonly referenceName?: NamedReferenceName;
  /** Feature whose source edit or output owns the reported reference effect. */
  readonly sourceFeatureId?: FeatureId;
  /** Direct downstream feature affected by the source feature, when applicable. */
  readonly targetFeatureId?: FeatureId;
  readonly diagnosticCode?: CadFeatureEditDiagnosticCode;
  readonly message: string;
}

export type CadBodyLifecycleState =
  | CadFeatureReferenceChangeCategory
  | "source"
  | "result"
  | "modified"
  | "replacement"
  | "failed"
  | "derived-rebuild-pending"
  | "suppressed"
  | "deferred";

export type CadBodyLifecycleRole =
  | "source"
  | "target"
  | "result"
  | "primitiveCompatibility";

export type CadRebuildPlanStatus =
  | "ready"
  | "pending"
  | "repair-needed"
  | "blocked"
  | "unsupported"
  | "failed";

export type CadRebuildPlanDiagnosticSeverity = CadFeatureEditDiagnosticSeverity;

export type CadRebuildPlanDiagnosticCode =
  | "REBUILD_PLAN_READY"
  | "REBUILD_DERIVED_PENDING"
  | "REBUILD_TARGET_CONSUMED"
  | "REBUILD_RESULT_REPAIR_NEEDED"
  | "REBUILD_RESULT_TOPOLOGY_AMBIGUOUS"
  | "REBUILD_BODY_UNSUPPORTED"
  | "REBUILD_SOURCE_STALE"
  | "REBUILD_FAILED"
  | "REBUILD_REFERENCE_REPAIR_NEEDED"
  | "REBUILD_EXECUTION_DEFERRED";

export interface CadRebuildPlanDiagnostic {
  readonly code: CadRebuildPlanDiagnosticCode;
  readonly severity: CadRebuildPlanDiagnosticSeverity;
  readonly message: string;
  readonly status: CadRebuildPlanStatus;
  readonly featureId?: FeatureId;
  readonly targetFeatureId?: FeatureId;
  readonly bodyId?: BodyId;
  readonly targetBodyId?: BodyId;
  readonly stableId?: string;
  readonly referenceName?: NamedReferenceName;
  readonly expected?: string;
  readonly received?: string;
}

export interface CadBodyLifecycleSummary {
  readonly bodyId: BodyId;
  readonly bodyName?: string;
  readonly featureId: FeatureId;
  readonly featureKind?: CadFeatureSummary["kind"];
  readonly role: CadBodyLifecycleRole;
  readonly sourceType: CadBodySource["type"];
  readonly primaryState: CadBodyLifecycleState;
  readonly states: readonly CadBodyLifecycleState[];
  readonly consumedByFeatureId?: FeatureId;
  readonly targetBodyId?: BodyId;
  readonly referenceHealthStatus?: CadReferenceHealthStatus;
  readonly rebuildRequired: boolean;
  readonly derivedRebuildPending: boolean;
  readonly commandReady: boolean;
  readonly diagnosticCount: number;
  readonly diagnostics: readonly CadRebuildPlanDiagnostic[];
}

export interface CadBodyLifecycleEffectSummary {
  readonly bodyId: BodyId;
  /** Feature that owns the body or lifecycle effect being reported. */
  readonly featureId?: FeatureId;
  /** Direct consuming/downstream feature affected by a source-body effect. */
  readonly targetFeatureId?: FeatureId;
  readonly primaryState: CadBodyLifecycleState;
  readonly states: readonly CadBodyLifecycleState[];
  readonly diagnosticCode?: CadRebuildPlanDiagnosticCode;
  readonly message: string;
}

export interface CadRebuildAffectedSummary {
  readonly sketchIds: readonly SketchId[];
  readonly sketchEntityIds: readonly SketchEntityId[];
  readonly featureIds: readonly FeatureId[];
  readonly bodyIds: readonly BodyId[];
  readonly generatedReferenceCount: number;
  readonly namedReferenceCount: number;
  readonly derivedArtifactKinds: readonly string[];
}

export interface CadFeatureRebuildReadiness {
  readonly status: CadFeatureRebuildReadinessStatus;
  readonly commitDeferred: boolean;
  readonly diagnosticCount: number;
  readonly diagnostics: readonly CadFeatureEditDiagnostic[];
}

export interface CadFeatureEditDryRunSummary {
  readonly status: CadFeatureEditDryRunStatus;
  readonly proposedEdit?: CadFeatureEditProposal;
  readonly commitOperation?: CadOp["op"];
  readonly willMutateDocument: false;
  readonly diagnosticCount: number;
  readonly diagnostics: readonly CadFeatureEditDiagnostic[];
}

export type CadSketchEditReadinessStatus =
  | "ready"
  | "blocked"
  | "unsupported"
  | "missing"
  | "repair-needed"
  | "schema-migration-needed";

export type CadSketchEditDryRunStatus =
  | "valid"
  | "blocked"
  | "unsupported"
  | "missing";

export type CadSketchEditDiagnosticSeverity = CadFeatureEditDiagnosticSeverity;

export type CadSketchEditDiagnosticCode =
  | "SKETCH_EDIT_SUPPORTED"
  | "SKETCH_EDIT_UNSUPPORTED"
  | "SKETCH_EDIT_INVALID_PROPOSAL"
  | "SKETCH_EDIT_MISSING_SKETCH"
  | "SKETCH_EDIT_MISSING_ENTITY"
  | "SKETCH_EDIT_MISSING_PARAMETER"
  | "SKETCH_EDIT_MISSING_DIMENSION"
  | "SKETCH_EDIT_MISSING_CONSTRAINT"
  | "SKETCH_EDIT_STALE_SOURCE"
  | "SKETCH_EDIT_INVALID_VALUE"
  | "SKETCH_EDIT_UNDER_DEFINED"
  | "SKETCH_EDIT_OVER_DEFINED"
  | "SKETCH_EDIT_CONFLICTING_CONSTRAINT"
  | "SKETCH_EDIT_NON_REBUILDABLE"
  | "SKETCH_EDIT_CONSUMED_DOWNSTREAM"
  | "SKETCH_EDIT_AMBIGUOUS_DOWNSTREAM"
  | "SKETCH_EDIT_REPAIR_NEEDED_DOWNSTREAM"
  | "SKETCH_EDIT_SCHEMA_MIGRATION_NEEDED";

export interface CadSketchEntityDimensionEditProposal {
  readonly editKind: "entity.dimension.update";
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
  readonly target: SketchDimensionTarget;
  readonly value: number;
}

export interface CadSketchDimensionCreateEditProposal extends Omit<
  SketchDimensionCreateOp,
  "op"
> {
  readonly editKind: "sketch.dimension.create";
}

export interface CadSketchDimensionUpdateEditProposal extends Omit<
  SketchDimensionUpdateOp,
  "op"
> {
  readonly editKind: "sketch.dimension.update";
}

export interface CadSketchDimensionDeleteEditProposal extends Omit<
  SketchDimensionDeleteOp,
  "op"
> {
  readonly editKind: "sketch.dimension.delete";
}

export type CadSketchConstraintCreateEditProposal =
  | (Omit<SketchOrientationConstraintCreateOp, "op"> & {
      readonly editKind: "sketch.constraint.create";
    })
  | (Omit<SketchFixedConstraintCreateOp, "op"> & {
      readonly editKind: "sketch.constraint.create";
    })
  | (Omit<SketchCoincidentConstraintCreateOp, "op"> & {
      readonly editKind: "sketch.constraint.create";
    })
  | (Omit<SketchMidpointConstraintCreateOp, "op"> & {
      readonly editKind: "sketch.constraint.create";
    })
  | (Omit<SketchParallelConstraintCreateOp, "op"> & {
      readonly editKind: "sketch.constraint.create";
    })
  | (Omit<SketchPerpendicularConstraintCreateOp, "op"> & {
      readonly editKind: "sketch.constraint.create";
    });

export interface CadSketchConstraintDeleteEditProposal extends Omit<
  SketchConstraintDeleteOp,
  "op"
> {
  readonly editKind: "sketch.constraint.delete";
}

export type CadSketchEditProposal =
  | CadSketchEntityDimensionEditProposal
  | CadSketchDimensionCreateEditProposal
  | CadSketchDimensionUpdateEditProposal
  | CadSketchDimensionDeleteEditProposal
  | CadSketchConstraintCreateEditProposal
  | CadSketchConstraintDeleteEditProposal;

export interface CadSketchEditDiagnostic {
  readonly code: CadSketchEditDiagnosticCode;
  readonly severity: CadSketchEditDiagnosticSeverity;
  readonly message: string;
  readonly sketchId?: SketchId;
  readonly sketchEntityId?: SketchEntityId;
  readonly sketchDimensionId?: SketchDimensionId;
  readonly sketchConstraintId?: SketchConstraintId;
  readonly featureId?: FeatureId;
  readonly bodyId?: BodyId;
  readonly targetBodyId?: BodyId;
  readonly stableId?: string;
  readonly referenceName?: NamedReferenceName;
  readonly fieldPath?: string;
  readonly expected?: string;
  readonly received?: string;
}

export interface CadSketchEditEvaluationSummary {
  readonly sketchId: SketchId;
  readonly sketchName: string;
  readonly plane: SketchPlane;
  readonly status: SketchDimensionStatus;
  readonly drivenEntityCount: number;
  readonly drivenEntityIds: readonly SketchEntityId[];
  readonly dimensionCount: number;
  readonly dimensions: readonly SketchDimensionEntry[];
  readonly constraintCount: number;
  readonly constraints: readonly SketchConstraintEntry[];
  readonly issueCount: number;
  readonly issues: readonly SketchEvaluationIssue[];
}

export interface CadSketchEditHealthSummary {
  readonly before: CadSketchEditEvaluationSummary;
  readonly after?: CadSketchEditEvaluationSummary;
  readonly statusChanged: boolean;
}

export interface CadSketchEditDryRunSummary {
  readonly status: CadSketchEditDryRunStatus;
  readonly edit: CadSketchEditProposal;
  readonly commitOperation?: CadOp["op"];
  readonly willMutateDocument: false;
  readonly diagnosticCount: number;
  readonly diagnostics: readonly CadSketchEditDiagnostic[];
}

export interface CadSketchEditAffectedSummary {
  readonly sketchIds: readonly SketchId[];
  readonly sketchEntityIds: readonly SketchEntityId[];
  readonly dimensionIds: readonly SketchDimensionId[];
  readonly constraintIds: readonly SketchConstraintId[];
  readonly featureIds: readonly FeatureId[];
  readonly bodyIds: readonly BodyId[];
  readonly generatedReferenceCount: number;
  readonly namedReferenceCount: number;
}

export type CadSketchEditFeatureImpactKind =
  | "source-profile"
  | "source-axis"
  | "source-hole-circle"
  | "downstream-target";

export interface CadSketchEditFeatureImpact {
  readonly featureId: FeatureId;
  readonly featureKind: CadFeatureSummary["kind"];
  readonly bodyId: BodyId;
  readonly impact: CadSketchEditFeatureImpactKind;
  readonly sketchId?: SketchId;
  readonly sketchEntityId?: SketchEntityId;
  readonly targetBodyId?: BodyId;
  readonly bodyLifecycle?: CadBodyLifecycleState;
  readonly referenceHealthStatus?: CadReferenceHealthStatus;
  readonly diagnosticCount: number;
  readonly diagnostics: readonly CadSketchEditDiagnostic[];
}

export interface CadSketchEditReferenceEffectSummary {
  readonly category: CadReferenceHealthStatus;
  readonly bodyId?: BodyId;
  readonly stableId?: string;
  readonly kind?: CadGeneratedEntityKind;
  readonly referenceName?: NamedReferenceName;
  readonly sourceFeatureId?: FeatureId;
  readonly targetFeatureId?: FeatureId;
  readonly diagnosticCode?: CadSketchEditDiagnosticCode;
  readonly message: string;
}

export type CadSketchSolverStatus =
  | "not-run"
  | "solved"
  | "fully-defined"
  | "under-defined"
  | "over-defined"
  | "conflicting"
  | "redundant"
  | "failed"
  | "unsupported"
  | "missing-target";

export type CadSketchSolverReadinessStatus =
  | "ready"
  | "deferred"
  | "blocked"
  | "unsupported"
  | "missing";

export type CadSketchProfileValidityStatus =
  | "valid"
  | "invalid"
  | "unsupported"
  | "not-evaluated";

export type CadSketchSolverDiagnosticSeverity =
  CadFeatureEditDiagnosticSeverity;

export type CadSketchSolverDiagnosticCode =
  | "SKETCH_SOLVER_STATUS_READY"
  | "SKETCH_SOLVER_NUMERICAL_STATUS_READY"
  | "SKETCH_SOLVER_MODEL_BUILT"
  | "SKETCH_SOLVER_MISSING_TARGET"
  | "SKETCH_SOLVER_UNSUPPORTED_ENTITY"
  | "SKETCH_SOLVER_UNSUPPORTED_CONSTRAINT"
  | "SKETCH_SOLVER_STALE_TARGET"
  | "SKETCH_SOLVER_UNDER_DEFINED"
  | "SKETCH_SOLVER_FULLY_DEFINED"
  | "SKETCH_SOLVER_OVER_DEFINED"
  | "SKETCH_SOLVER_CONFLICTING"
  | "SKETCH_SOLVER_REDUNDANT"
  | "SKETCH_SOLVER_FAILED"
  | "SKETCH_SOLVER_NOT_RUN"
  | "SKETCH_SOLVER_NUMERICAL_SOLVER_DEFERRED"
  | "SKETCH_SOLVER_PREVIEW_DEFERRED"
  | "SKETCH_SOLVER_SCHEMA_V17_DEFERRED"
  | "SKETCH_SOLVER_PROFILE_OPEN"
  | "SKETCH_SOLVER_PROFILE_VALID";

export type CadSketchSolverSourceRecordKind =
  | "advancedConstraint"
  | "constructionGeometry"
  | "constraintLabel"
  | "dimensionDisplayIntent"
  | "solverSettings"
  | "sketchSolvePolicy";

export type CadSketchSolverSourceRecordStatus =
  | "current-source"
  | "v17-required"
  | "deferred";

export type CadSketchSolverConstraintSupportStatus =
  | "current-source"
  | "deferred";

export type CadSketchSolverPreviewStatus = "deferred" | "unsupported";

export interface CadSketchSolverDiagnostic {
  readonly code: CadSketchSolverDiagnosticCode;
  readonly severity: CadSketchSolverDiagnosticSeverity;
  readonly message: string;
  readonly sketchId?: SketchId;
  readonly sketchEntityId?: SketchEntityId;
  readonly sketchDimensionId?: SketchDimensionId;
  readonly sketchConstraintId?: SketchConstraintId;
  readonly constraintKind?:
    | SketchConstraintKind
    | CadSketchSolverDeferredConstraintKind;
  readonly target?: CadSketchSolverTargetReference;
  readonly expected?: string;
  readonly received?: string;
}

export type CadSketchSolverTargetReference =
  | CadSketchSolverEntityTargetReference
  | CadSketchSolverPointTargetReference
  | CadSketchSolverDimensionTargetReference
  | CadSketchSolverConstraintTargetReference;

export interface CadSketchSolverEntityTargetReference {
  readonly type: "entity";
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
  readonly entityKind: SketchEntityKind;
}

export interface CadSketchSolverPointTargetReference {
  readonly type: "point";
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
  readonly role: SketchPointTargetRole;
}

export interface CadSketchSolverDimensionTargetReference {
  readonly type: "dimension";
  readonly sketchId: SketchId;
  readonly dimensionId: SketchDimensionId;
  readonly entityId: SketchEntityId;
  readonly dimensionTarget: SketchDimensionTarget;
}

export interface CadSketchSolverConstraintTargetReference {
  readonly type: "constraint";
  readonly sketchId: SketchId;
  readonly constraintId: SketchConstraintId;
  readonly kind: SketchConstraintKind;
}

export type CadSketchSolverDeferredConstraintKind =
  | "tangent"
  | "concentric"
  | "equalLength"
  | "equalRadius"
  | "distance"
  | "angle"
  | "symmetry";

export interface CadSketchSolverEntitySummary {
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
  readonly entityKind: SketchEntityKind;
  readonly supported: boolean;
  readonly variableCount: number;
  readonly degreesOfFreedom: number;
  readonly targetCount: number;
  readonly targets: readonly CadSketchSolverTargetReference[];
  readonly diagnosticCount: number;
  readonly diagnostics: readonly CadSketchSolverDiagnostic[];
}

export interface CadSketchSolverDimensionSummary {
  readonly dimensionId: SketchDimensionId;
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
  readonly target: SketchDimensionTarget;
  readonly valueSource: SketchDimensionValueSource;
  readonly effectiveValue?: number;
  readonly status: SketchDimensionStatus;
  readonly supported: boolean;
  readonly targetRef: CadSketchSolverDimensionTargetReference;
  readonly diagnosticCount: number;
  readonly diagnostics: readonly CadSketchSolverDiagnostic[];
}

export interface CadSketchSolverConstraintSummary {
  readonly constraintId: SketchConstraintId;
  readonly sketchId: SketchId;
  readonly kind: SketchConstraintKind | CadSketchSolverDeferredConstraintKind;
  readonly status: CadSketchSolverConstraintSupportStatus;
  readonly sourceBacked: boolean;
  readonly supportedByCurrentEvaluator: boolean;
  readonly targetRefs: readonly CadSketchSolverTargetReference[];
  readonly diagnosticCount: number;
  readonly diagnostics: readonly CadSketchSolverDiagnostic[];
}

export interface CadSketchSolverDeferredConstraintSummary {
  readonly kind: CadSketchSolverDeferredConstraintKind;
  readonly status: "deferred";
  readonly requiresProjectSchemaMigration: true;
  readonly nextProjectSchemaVersion: "web-cad.project.v17";
  readonly diagnostic: CadSketchSolverDiagnostic;
}

export interface CadSketchProfileCandidateSummary {
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
  readonly entityKind: SketchEntityKind;
  readonly profileKind: "rectangle" | "circle" | "open" | "unsupported";
  readonly closed: boolean;
  readonly featureReady: boolean;
  readonly diagnosticCount: number;
  readonly diagnostics: readonly CadSketchSolverDiagnostic[];
}

export interface CadSketchProfileValiditySummary {
  readonly status: CadSketchProfileValidityStatus;
  readonly profileCount: number;
  readonly validProfileCount: number;
  readonly profiles: readonly CadSketchProfileCandidateSummary[];
  readonly diagnosticCount: number;
  readonly diagnostics: readonly CadSketchSolverDiagnostic[];
}

export interface CadSketchSolverPreviewSummary {
  readonly status: CadSketchSolverPreviewStatus;
  readonly willMutateDocument: false;
  readonly supportedPreviewKinds: readonly string[];
  readonly deferredPreviewKinds: readonly string[];
  readonly diagnosticCount: number;
  readonly diagnostics: readonly CadSketchSolverDiagnostic[];
}

export interface CadSketchSolverSourceRecordRequirement {
  readonly recordKind: CadSketchSolverSourceRecordKind;
  readonly status: CadSketchSolverSourceRecordStatus;
  readonly requiresProjectSchemaMigration: boolean;
  readonly nextProjectSchemaVersion?: "web-cad.project.v17";
  readonly reason: string;
}

export interface CadSketchSolverSourceContract {
  readonly currentProjectSchemaVersion: WcadDocumentSchemaVersion;
  readonly emittedProjectSchemaVersion: WcadDocumentSchemaVersion;
  readonly packageVersion: WcadPackageVersion;
  readonly queryOnly: boolean;
  readonly requiresProjectSchemaMigration: false;
  readonly nextProjectSchemaVersion: "web-cad.project.v17";
  readonly sourceRecordRequirements: readonly CadSketchSolverSourceRecordRequirement[];
}

export interface CadSketchSolverEngineSummary {
  readonly engine: "current-direct-evaluator";
  readonly numericalSolverStatus:
    | "deferred"
    | "not-run"
    | "converged"
    | "under-defined"
    | "over-defined"
    | "conflicting"
    | "failed"
    | "unsupported";
  readonly numericalSolverEngine?: "@web-cad/sketch-solver";
  readonly numericalSolverModelVersion?: "partbench.sketch-solver.v1";
  readonly modelBuilt: boolean;
  readonly solverRan: boolean;
  readonly canSolveNumerically: boolean;
  readonly deterministic: true;
  readonly workerReady: false;
  readonly variableCount?: number;
  readonly residualCount?: number;
  readonly degreesOfFreedomEstimate?: number;
  readonly iterations?: number;
  readonly maxResidual?: number;
  readonly rmsResidual?: number;
  readonly diagnosticCount?: number;
  readonly diagnostics?: readonly CadSketchSolverDiagnostic[];
  readonly diagnostic: CadSketchSolverDiagnostic;
}

export type CadReferenceHealthStatus = CadFeatureReferenceChangeCategory;

export type CadReferenceHealthDiagnosticSeverity =
  CadFeatureEditDiagnosticSeverity;

export type CadReferenceHealthDiagnosticCode =
  | "REFERENCE_ACTIVE"
  | "REFERENCE_REPLACED_DEFERRED"
  | "REFERENCE_STALE"
  | "REFERENCE_BODY_CONSUMED"
  | "REFERENCE_TOPOLOGY_AMBIGUOUS"
  | "REFERENCE_TARGET_MISSING"
  | "REFERENCE_UNSUPPORTED"
  | "REFERENCE_REPAIR_NEEDED"
  | "REFERENCE_DELETED"
  | "DEPENDENCY_SOURCE_MISSING";

export type CadDependencyGraphNodeKind =
  | "sketch"
  | "sketchEntity"
  | "feature"
  | "body"
  | "generatedReference"
  | "namedReference";

export type CadDependencyGraphEdgeKind =
  | "contains"
  | "sources"
  | "produces"
  | "targets"
  | "consumes"
  | "generates"
  | "names"
  | "dependsOn";

export type CadDependencyGraphNodeId = string;

export interface CadDependencyGraphNode {
  readonly id: CadDependencyGraphNodeId;
  readonly kind: CadDependencyGraphNodeKind;
  readonly label: string;
  readonly status: CadReferenceHealthStatus;
  readonly sketchId?: SketchId;
  readonly sketchEntityId?: SketchEntityId;
  readonly featureId?: FeatureId;
  readonly bodyId?: BodyId;
  readonly stableId?: string;
  readonly referenceName?: NamedReferenceName;
  readonly generatedReferenceKind?: CadGeneratedEntityKind;
  readonly featureKind?: CadFeatureSummary["kind"];
  readonly bodySourceType?: CadBodySource["type"];
}

export interface CadDependencyGraphEdge {
  readonly id: string;
  readonly kind: CadDependencyGraphEdgeKind;
  readonly from: CadDependencyGraphNodeId;
  readonly to: CadDependencyGraphNodeId;
  readonly label: string;
  readonly sourceFeatureId?: FeatureId;
  readonly targetFeatureId?: FeatureId;
  readonly bodyId?: BodyId;
  readonly stableId?: string;
  readonly referenceName?: NamedReferenceName;
}

export interface CadReferenceHealthDiagnostic {
  readonly code: CadReferenceHealthDiagnosticCode;
  readonly severity: CadReferenceHealthDiagnosticSeverity;
  readonly message: string;
  readonly status: CadReferenceHealthStatus;
  readonly featureId?: FeatureId;
  readonly bodyId?: BodyId;
  readonly targetBodyId?: BodyId;
  readonly sketchId?: SketchId;
  readonly sketchEntityId?: SketchEntityId;
  readonly stableId?: string;
  readonly referenceName?: NamedReferenceName;
  readonly expected?: string;
  readonly received?: string;
}

export type CadReferenceHealthTarget =
  | CadReferenceHealthAllTarget
  | CadReferenceHealthBodyTarget
  | CadReferenceHealthGeneratedReferenceTarget
  | CadReferenceHealthNamedReferenceTarget;

export interface CadReferenceHealthAllTarget {
  readonly type: "all";
}

export interface CadReferenceHealthBodyTarget {
  readonly type: "body";
  readonly bodyId: BodyId;
}

export interface CadReferenceHealthGeneratedReferenceTarget {
  readonly type: "generatedReference";
  readonly bodyId: BodyId;
  readonly stableId: string;
  readonly expectedKind?: CadGeneratedEntityKind;
}

export interface CadReferenceHealthNamedReferenceTarget {
  readonly type: "namedReference";
  readonly name: NamedReferenceName;
}

export interface CadReferenceHealthDependencies {
  readonly sketchIds: readonly SketchId[];
  readonly sketchEntityIds: readonly SketchEntityId[];
  readonly featureIds: readonly FeatureId[];
  readonly bodyIds: readonly BodyId[];
  readonly generatedReferenceStableIds: readonly string[];
  readonly namedReferenceNames: readonly NamedReferenceName[];
}

export type CadReferenceHealthSource =
  | "body"
  | "generatedReference"
  | "namedReference";

export interface CadReferenceHealthEntry {
  readonly source: CadReferenceHealthSource;
  readonly status: CadReferenceHealthStatus;
  readonly commandable: boolean;
  readonly commandOperations: readonly CadSelectionReferenceOperation[];
  readonly label: string;
  readonly bodyId?: BodyId;
  readonly stableId?: string;
  readonly kind?: CadGeneratedEntityKind;
  readonly referenceName?: NamedReferenceName;
  readonly sourceFeatureId?: FeatureId;
  readonly consumedByFeatureId?: FeatureId;
  readonly dependencies: CadReferenceHealthDependencies;
  readonly diagnosticCount: number;
  readonly diagnostics: readonly CadReferenceHealthDiagnostic[];
}

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

export interface CadSketchRevolveBodySource {
  readonly type: "sketchRevolveFeature";
  readonly featureId: FeatureId;
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
  readonly profileKind: FeatureRevolveProfileKind;
  readonly axis: FeatureRevolveAxis;
}

export interface CadSketchHoleBodySource {
  readonly type: "sketchHoleFeature";
  readonly featureId: FeatureId;
  readonly targetBodyId: BodyId;
  readonly sketchId: SketchId;
  readonly circleEntityId: SketchEntityId;
}

export interface CadChamferBodySource {
  readonly type: "edgeChamferFeature";
  readonly featureId: FeatureId;
  readonly targetBodyId: BodyId;
  readonly edgeStableId?: string;
  readonly namedReference?: NamedReferenceName;
}

export interface CadFilletBodySource {
  readonly type: "edgeFilletFeature";
  readonly featureId: FeatureId;
  readonly targetBodyId: BodyId;
  readonly edgeStableId?: string;
  readonly namedReference?: NamedReferenceName;
}

export type CadBodySource =
  | CadPrimitiveBodySource
  | CadSketchExtrudeBodySource
  | CadSketchRevolveBodySource
  | CadSketchHoleBodySource
  | CadChamferBodySource
  | CadFilletBodySource;

export interface CadBodySnapshot {
  readonly id: BodyId;
  readonly kind: "solid";
  readonly partId: PartId;
  readonly featureId: FeatureId;
  readonly consumedByFeatureId?: FeatureId;
  readonly objectId?: ObjectId;
  readonly primitive?: CadObjectKind;
  readonly name?: string;
  readonly source: CadBodySource;
}

export type CadGeneratedEntityKind =
  | "body"
  | "face"
  | "edge"
  | "vertex"
  | "axis";

export type CadGeneratedExtrudeFaceRole =
  | "startCap"
  | "endCap"
  | "side:uMin"
  | "side:uMax"
  | "side:vMin"
  | "side:vMax"
  | "side:circular";

export type CadGeneratedHoleFaceRole = "holeWall";

export type CadGeneratedFaceRole =
  | CadGeneratedExtrudeFaceRole
  | CadGeneratedHoleFaceRole;

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

export type CadGeneratedHoleEdgeRole = "startRim";

export type CadGeneratedEdgeRole =
  | CadGeneratedExtrudeEdgeRole
  | CadGeneratedHoleEdgeRole;

export type CadGeneratedAxisRole = "revolveAxis" | "holeAxis";

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

export interface CadGeneratedAxisSourceSignature {
  readonly type: "sketchLine";
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
  readonly start: Vec2;
  readonly end: Vec2;
}

export type CadGeneratedReferenceEligibleOperation =
  | "feature.attachSketchPlane"
  | "feature.chamfer"
  | "feature.fillet"
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
  readonly sourceKind?: "extrude" | "revolve" | "hole";
  readonly targetBodyId?: BodyId;
  readonly profileKind: FeatureExtrudeProfileKind;
  readonly sketchPlane: SketchPlane;
  readonly extrudeSide?: FeatureExtrudeSide;
  readonly depth?: number;
  readonly revolveAxis?: FeatureRevolveAxis;
  readonly revolveAxisSignature?: CadGeneratedAxisSourceSignature;
  readonly revolveAngleDegrees?: number;
  readonly holeDepthMode?: FeatureHoleDepthMode;
  readonly holeDepth?: number;
  readonly holeDirection?: FeatureHoleDirection;
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
  readonly role: CadGeneratedFaceRole;
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
  readonly role: CadGeneratedEdgeRole;
  readonly adjacentFaceRoles: readonly CadGeneratedFaceRole[];
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
  readonly adjacentFaceRoles: readonly CadGeneratedFaceRole[];
  readonly adjacentEdgeRoles: readonly CadGeneratedExtrudeEdgeRole[];
  readonly geometricSignature: CadGeneratedReferenceSignature;
}

export interface CadGeneratedAxisReference {
  readonly kind: "axis";
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
  readonly role: CadGeneratedAxisRole;
  readonly geometricSignature: CadGeneratedReferenceSignature;
}

export type CadGeneratedReference =
  | CadGeneratedBodyReference
  | CadGeneratedFaceReference
  | CadGeneratedEdgeReference
  | CadGeneratedVertexReference
  | CadGeneratedAxisReference;

export interface NamedGeneratedReferenceSnapshot {
  readonly name: NamedReferenceName;
  readonly bodyId: BodyId;
  readonly stableId: string;
  readonly kind: CadGeneratedEntityKind;
}

export type NamedGeneratedReferenceStatus = "resolved" | "stale";

export interface NamedGeneratedReferenceEntry extends NamedGeneratedReferenceSnapshot {
  readonly status: NamedGeneratedReferenceStatus;
  readonly reference?: CadGeneratedReference;
  readonly error?: CadQueryError;
}

export type CadSelectionReferenceInput =
  | CadSelectionBodyInput
  | CadSelectionGeneratedReferenceInput
  | CadSelectionNamedReferenceInput;

export interface CadSelectionBodyInput {
  readonly type: "body";
  readonly bodyId: BodyId;
}

export interface CadSelectionGeneratedReferenceInput {
  readonly type: "generatedReference";
  readonly bodyId: BodyId;
  readonly stableId: string;
  readonly expectedKind?: CadGeneratedEntityKind;
}

export interface CadSelectionNamedReferenceInput {
  readonly type: "namedReference";
  readonly name: NamedReferenceName;
}

export type CadViewportPointerInputKind =
  | "move"
  | "down"
  | "up"
  | "drag"
  | "click"
  | "doubleClick"
  | "cancel";

export type CadViewportPointerDevice = "mouse" | "pen" | "touch" | "unknown";

export type CadViewportPointerButton =
  | "none"
  | "primary"
  | "secondary"
  | "middle";

export type CadViewportModifierKey = "alt" | "control" | "meta" | "shift";

export interface CadViewportScreenPoint {
  readonly x: number;
  readonly y: number;
  readonly viewportWidth?: number;
  readonly viewportHeight?: number;
}

export interface CadViewportPointerInputIntent {
  readonly kind: CadViewportPointerInputKind;
  readonly point: CadViewportScreenPoint;
  readonly device: CadViewportPointerDevice;
  readonly button?: CadViewportPointerButton;
  readonly buttons?: readonly CadViewportPointerButton[];
  readonly modifiers?: readonly CadViewportModifierKey[];
  readonly timestampMs?: number;
}

export type CadViewportDisplayEntityKind =
  | CadGeneratedEntityKind
  | "sketchEntity";

export type CadViewportHitPrecision =
  | "exact"
  | "bounds"
  | "displayApproximation";

export interface CadViewportHitCandidate {
  readonly displayEntityKind: CadViewportDisplayEntityKind;
  readonly semanticHint?: CadSelectionReferenceInput;
  readonly rendererHitId?: string;
  readonly selectionBufferHitId?: string;
  readonly precision?: CadViewportHitPrecision;
  readonly depth?: number;
  readonly instancePath?: readonly string[];
  readonly assemblyPath?: readonly string[];
}

export type CadViewportInteractionStatus =
  | "resolved"
  | "empty"
  | "missing"
  | "stale"
  | "unsupported"
  | "ambiguous"
  | "consumed"
  | "non-commandable"
  | "renderer-only"
  | "assembly-unsupported";

export type CadViewportInteractionDiagnosticCode =
  | "VIEWPORT_MISSING_HIT_TARGET"
  | "VIEWPORT_STALE_SEMANTIC_HINT"
  | "VIEWPORT_AMBIGUOUS_HIT_CANDIDATE"
  | "VIEWPORT_UNSUPPORTED_DISPLAY_ENTITY"
  | "VIEWPORT_CONSUMED_TARGET"
  | "VIEWPORT_NON_COMMANDABLE_TARGET"
  | "VIEWPORT_RENDERER_ONLY_TARGET"
  | "VIEWPORT_ASSEMBLY_INSTANCE_UNSUPPORTED";

export interface CadViewportInteractionDiagnostic {
  readonly code: CadViewportInteractionDiagnosticCode;
  readonly status: Exclude<CadViewportInteractionStatus, "resolved" | "empty">;
  readonly message: string;
  readonly expected?: string;
  readonly received?: string;
}

export interface CadViewportSelectionIntent {
  readonly source: "viewport";
  readonly pointer?: CadViewportPointerInputIntent;
  readonly hitCandidate?: CadViewportHitCandidate;
  readonly selection?: CadSelectionReferenceInput;
  readonly requiredOperation?: CadSelectionReferenceOperation;
  readonly additive?: boolean;
}

export interface CadViewportCommandTargetSummary {
  readonly selection: CadSelectionReferenceInput;
  readonly status: CadSelectionReferenceStatus;
  readonly commandable: boolean;
  readonly target?: CadSelectionReferenceCommandTarget;
  readonly label?: string;
  readonly commandOperations: readonly CadSelectionReferenceOperation[];
  readonly diagnostics: readonly CadViewportInteractionDiagnostic[];
}

export interface CadViewportHoverState {
  readonly status: CadViewportInteractionStatus;
  readonly hitCandidate?: CadViewportHitCandidate;
  readonly selection?: CadSelectionReferenceInput;
  readonly commandTarget?: CadViewportCommandTargetSummary;
  readonly diagnostics: readonly CadViewportInteractionDiagnostic[];
}

export interface CadViewportSelectionState {
  readonly status: CadViewportInteractionStatus;
  readonly selection?: CadSelectionReferenceInput;
  readonly commandTarget?: CadViewportCommandTargetSummary;
  readonly diagnostics: readonly CadViewportInteractionDiagnostic[];
}

export type CadViewportMeasurementAuthority =
  | "semanticDocument"
  | "sourceAnalytic"
  | "geometryBoundaryExact"
  | "displayApproximation"
  | "unsupported";

export interface CadViewportMeasurementTarget {
  readonly selection?: CadSelectionReferenceInput;
  readonly authority: CadViewportMeasurementAuthority;
  readonly status: CadViewportInteractionStatus;
  readonly diagnostics: readonly CadViewportInteractionDiagnostic[];
}

export type CadViewportSingleTargetMeasureInspectKind =
  | "body"
  | "generatedPlanarFace"
  | "generatedEdge"
  | "namedReference"
  | "unsupportedGeneratedReference";

export interface CadViewportSingleTargetMeasureInspectTarget extends CadViewportMeasurementTarget {
  readonly targetKind: CadViewportSingleTargetMeasureInspectKind;
  readonly label?: string;
  readonly bodyId?: BodyId;
  readonly stableId?: string;
  readonly referenceName?: NamedReferenceName;
}

export type CadViewportTwoTargetMeasurementKind = "distance" | "angle";

export type CadViewportTwoTargetMeasurementTargetKind =
  CadViewportSingleTargetMeasureInspectKind;

export type CadViewportTwoTargetMeasurementPointRole =
  | "bodyCentroid"
  | "generatedFaceCenter"
  | "generatedEdgeCenter";

export type CadViewportTwoTargetMeasurementVectorRole =
  | "generatedFaceNormal"
  | "generatedLinearEdgeDirection";

export type CadViewportTwoTargetMeasurementDiagnosticCode =
  | "VIEWPORT_TWO_TARGET_MISSING_FIRST_TARGET"
  | "VIEWPORT_TWO_TARGET_MISSING_SECOND_TARGET"
  | "VIEWPORT_TWO_TARGET_STALE_TARGET"
  | "VIEWPORT_TWO_TARGET_CONSUMED_TARGET"
  | "VIEWPORT_TWO_TARGET_UNSUPPORTED_TARGET"
  | "VIEWPORT_TWO_TARGET_UNSUPPORTED_PAIR"
  | "VIEWPORT_TWO_TARGET_AMBIGUOUS_PAIR"
  | "VIEWPORT_TWO_TARGET_NON_COMMANDABLE_TARGET"
  | "VIEWPORT_TWO_TARGET_DISPLAY_APPROXIMATION_ONLY";

export interface CadViewportTwoTargetMeasurementDiagnostic {
  readonly code: CadViewportTwoTargetMeasurementDiagnosticCode;
  readonly status: Exclude<CadViewportInteractionStatus, "resolved" | "empty">;
  readonly message: string;
  readonly expected?: string;
  readonly received?: string;
}

export interface CadViewportTwoTargetMeasurementTarget extends CadViewportMeasurementTarget {
  readonly targetKind: CadViewportTwoTargetMeasurementTargetKind;
  readonly label?: string;
  readonly bodyId?: BodyId;
  readonly stableId?: string;
  readonly referenceName?: NamedReferenceName;
  readonly pointRole?: CadViewportTwoTargetMeasurementPointRole;
  readonly vectorRole?: CadViewportTwoTargetMeasurementVectorRole;
}

export interface CadViewportTwoTargetMeasurementResult {
  readonly kind: CadViewportTwoTargetMeasurementKind;
  readonly authority: CadViewportMeasurementAuthority;
  readonly value: number;
  readonly units?: DocumentUnits | "deg";
  readonly diagnostics: readonly CadViewportTwoTargetMeasurementDiagnostic[];
}

export interface CadViewportTwoTargetMeasurementState {
  readonly firstTarget?: CadViewportTwoTargetMeasurementTarget;
  readonly secondTarget?: CadViewportTwoTargetMeasurementTarget;
  readonly pendingTarget?: CadViewportTwoTargetMeasurementTarget;
  readonly results: readonly CadViewportTwoTargetMeasurementResult[];
  readonly diagnostics: readonly CadViewportTwoTargetMeasurementDiagnostic[];
}

export type CadSelectionReferenceOperation =
  | CadGeneratedReferenceEligibleOperation
  | "reference.nameGenerated";

export type CadSelectionReferenceStatus =
  | "resolved"
  | "missing"
  | "stale"
  | "unsupported"
  | "ambiguous"
  | "consumed"
  | "non-commandable";

export interface CadProjectSummaryStructureCounts {
  readonly partCount: number;
  readonly sketchCount: number;
  readonly sketchEntityCount: number;
  readonly featureCount: number;
  readonly bodyCount: number;
  readonly activeBodyCount: number;
  readonly consumedBodyCount: number;
  readonly primitiveCompatibilityBodyCount: number;
  readonly authoredBodyFeatureCount: number;
}

export interface CadProjectSummaryHealthSummary {
  readonly status: CadDependencyHealthStatus;
  readonly issueCount: number;
}

export type CadProjectSummaryReferenceKindCounts = {
  readonly [kind in CadGeneratedEntityKind]: number;
};

export type CadProjectSummaryReferenceOperationCounts = {
  readonly [operation in CadSelectionReferenceOperation]: number;
};

export type CadProjectSummaryReferenceStatusCounts = {
  readonly [status in CadSelectionReferenceStatus]: number;
};

export interface CadProjectSummaryNamedReferenceStatusCounts {
  readonly resolved: number;
  readonly stale: number;
}

export interface CadProjectSummaryReferenceSummary {
  readonly namedReferenceCount: number;
  readonly namedReferenceStatusCounts: CadProjectSummaryNamedReferenceStatusCounts;
  readonly semanticBodySelectionCount: number;
  readonly semanticBodySelectionStatusCounts: CadProjectSummaryReferenceStatusCounts;
  readonly generatedReferenceBodyCount: number;
  readonly generatedReferenceCount: number;
  readonly commandableReferenceCount: number;
  readonly referenceKindCounts: CadProjectSummaryReferenceKindCounts;
  readonly operationCounts: CadProjectSummaryReferenceOperationCounts;
}

export interface CadProjectSummaryExportFormatSummary {
  readonly format: CadExportFormatId;
  readonly status: CadExportReadinessStatus;
  readonly available: boolean;
  readonly candidateBodyCount: number;
  readonly sourceSupportedBodyCount: number;
  readonly deferredBodyCount: number;
  readonly unavailableBodyCount: number;
}

export interface CadProjectSummaryExportSummary {
  readonly status: CadExportReadinessStatus;
  readonly canExportFiles: boolean;
  readonly sourceBoundaryNote: string;
  readonly derivedBoundaryNote: string;
  readonly formatCount: number;
  readonly formats: readonly CadProjectSummaryExportFormatSummary[];
  readonly bodyCount: number;
  readonly sourceSupportedBodyCount: number;
  readonly deferredBodyCount: number;
  readonly unavailableBodyCount: number;
  readonly diagnosticCount: number;
}

export type CadProjectSummaryWorkflowHintLevel = "info" | "warning" | "blocker";

export type CadProjectSummaryWorkflowHintCode =
  | "PROJECT_EMPTY"
  | "PROJECT_HEALTH_ISSUES"
  | "NO_AUTHORED_BODY_FEATURES"
  | "NO_COMMANDABLE_REFERENCES"
  | "EXPORT_READY"
  | "EXPORT_DEFERRED"
  | "EXPORT_UNAVAILABLE";

export interface CadProjectSummaryWorkflowHint {
  readonly code: CadProjectSummaryWorkflowHintCode;
  readonly level: CadProjectSummaryWorkflowHintLevel;
  readonly message: string;
}

export type CadSelectionReferenceIssueCode =
  | "MISSING_SELECTION_TARGET"
  | "STALE_SELECTION_REFERENCE"
  | "UNSUPPORTED_SELECTION_TARGET"
  | "AMBIGUOUS_SELECTION_TOPOLOGY"
  | "CONSUMED_SELECTION_BODY"
  | "NON_COMMANDABLE_SELECTION_TARGET"
  | "SELECTION_KIND_MISMATCH";

export interface CadSelectionReferenceIssue {
  readonly code: CadSelectionReferenceIssueCode;
  readonly status: Exclude<CadSelectionReferenceStatus, "resolved">;
  readonly message: string;
  readonly bodyId?: BodyId;
  readonly stableId?: string;
  readonly referenceName?: NamedReferenceName;
  readonly featureId?: FeatureId;
  readonly expected?: string;
  readonly received?: string;
}

export interface CadSelectionReferenceCommandTarget {
  readonly type: "generatedReference";
  readonly bodyId: BodyId;
  readonly stableId: string;
  readonly kind: CadGeneratedEntityKind;
  readonly referenceName?: NamedReferenceName;
}

export type CadSelectionReferenceCandidateSource =
  | "bodySelection"
  | "generatedReferenceSelection"
  | "namedReferenceSelection";

export interface CadSelectionReferenceCandidate {
  readonly source: CadSelectionReferenceCandidateSource;
  readonly target: CadSelectionReferenceCommandTarget;
  readonly reference: CadGeneratedReference;
  readonly commandable: boolean;
  readonly commandOperations: readonly CadSelectionReferenceOperation[];
  readonly label: string;
  readonly description?: string;
  readonly issues: readonly CadSelectionReferenceIssue[];
}

export type CadDependencyHealthStatus =
  | "healthy"
  | "under-defined"
  | "over-defined"
  | "stale"
  | "missing-source"
  | "unsupported";

export type CadDependencyHealthIssueCode =
  | "PARAMETER_NOT_FOUND"
  | "SKETCH_NOT_FOUND"
  | "SKETCH_ENTITY_NOT_FOUND"
  | "PROFILE_KIND_MISMATCH"
  | "UNSUPPORTED_SKETCH_DIMENSION_TARGET"
  | "INVALID_SKETCH_DIMENSION_VALUE"
  | "UNSUPPORTED_SKETCH_CONSTRAINT_TARGET"
  | "INVALID_SKETCH_CONSTRAINT_VALUE"
  | "INCONSISTENT_SKETCH_CONSTRAINT"
  | "CONFLICTING_SKETCH_CONSTRAINT"
  | "UNDER_DEFINED_SKETCH"
  | "OVER_DEFINED_SKETCH"
  | "BODY_NOT_FOUND"
  | "UNSUPPORTED_BODY_REFERENCES"
  | "GENERATED_REFERENCE_NOT_FOUND"
  | "GENERATED_REFERENCE_KIND_MISMATCH"
  | "GENERATED_REFERENCE_OPERATION_NOT_ELIGIBLE"
  | "ATTACHMENT_SOURCE_MISMATCH"
  | "NAMED_REFERENCE_KIND_CHANGED"
  | "NAMED_REFERENCE_NOT_FOUND";

export interface CadDependencyHealthIssue {
  readonly code: CadDependencyHealthIssueCode;
  readonly message: string;
  readonly featureId?: FeatureId;
  readonly bodyId?: BodyId;
  readonly parameterId?: ParameterId;
  readonly sketchDimensionId?: SketchDimensionId;
  readonly sketchConstraintId?: SketchConstraintId;
  readonly sketchId?: SketchId;
  readonly sketchEntityId?: SketchEntityId;
  readonly sketchPointTarget?: SketchPointTarget;
  readonly primaryTarget?: SketchPointTarget;
  readonly secondaryTarget?: SketchPointTarget;
  readonly stableId?: string;
  readonly referenceName?: NamedReferenceName;
  readonly expected?: string;
  readonly received?: string;
}

export interface CadAuthoredExtrudeHealth {
  readonly featureId: FeatureId;
  readonly bodyId: BodyId;
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
  readonly profileKind: FeatureExtrudeProfileKind;
  readonly operationMode: FeatureExtrudeOperationMode;
  readonly targetBodyId?: BodyId;
  readonly topologyStatus?: CadBodyTopologyStatus;
  readonly topologyModel?: CadBodyTopologyModel;
  readonly topologyAvailable?: boolean;
  readonly exactMeasurementsAvailable?: boolean;
  readonly measurementConfidence?: CadBodyTopologyMeasurementConfidence;
  readonly topologyIssueCount?: number;
  readonly status: CadDependencyHealthStatus;
  readonly issues: readonly CadDependencyHealthIssue[];
}

export interface CadAuthoredRevolveHealth {
  readonly featureId: FeatureId;
  readonly bodyId: BodyId;
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
  readonly profileKind: FeatureRevolveProfileKind;
  readonly axis: FeatureRevolveAxis;
  readonly angleDegrees: number;
  readonly operationMode: FeatureRevolveOperationMode;
  readonly targetBodyId?: BodyId;
  readonly topologyStatus?: CadBodyTopologyStatus;
  readonly topologyModel?: CadBodyTopologyModel;
  readonly topologyAvailable?: boolean;
  readonly exactMeasurementsAvailable?: boolean;
  readonly measurementConfidence?: CadBodyTopologyMeasurementConfidence;
  readonly topologyIssueCount?: number;
  readonly status: CadDependencyHealthStatus;
  readonly issues: readonly CadDependencyHealthIssue[];
}

export interface CadAuthoredHoleHealth {
  readonly featureId: FeatureId;
  readonly bodyId: BodyId;
  readonly targetBodyId: BodyId;
  readonly sketchId: SketchId;
  readonly circleEntityId: SketchEntityId;
  readonly depthMode: FeatureHoleDepthMode;
  readonly depth?: number;
  readonly direction: FeatureHoleDirection;
  readonly topologyStatus?: CadBodyTopologyStatus;
  readonly topologyModel?: CadBodyTopologyModel;
  readonly topologyAvailable?: boolean;
  readonly exactMeasurementsAvailable?: boolean;
  readonly measurementConfidence?: CadBodyTopologyMeasurementConfidence;
  readonly topologyIssueCount?: number;
  readonly status: CadDependencyHealthStatus;
  readonly issues: readonly CadDependencyHealthIssue[];
}

export interface CadAuthoredChamferHealth {
  readonly featureId: FeatureId;
  readonly bodyId: BodyId;
  readonly targetBodyId: BodyId;
  readonly edgeStableId?: string;
  readonly namedReference?: NamedReferenceName;
  readonly distance: number;
  readonly topologyStatus?: CadBodyTopologyStatus;
  readonly topologyModel?: CadBodyTopologyModel;
  readonly topologyAvailable?: boolean;
  readonly exactMeasurementsAvailable?: boolean;
  readonly measurementConfidence?: CadBodyTopologyMeasurementConfidence;
  readonly topologyIssueCount?: number;
  readonly status: CadDependencyHealthStatus;
  readonly issues: readonly CadDependencyHealthIssue[];
}

export interface CadAuthoredFilletHealth {
  readonly featureId: FeatureId;
  readonly bodyId: BodyId;
  readonly targetBodyId: BodyId;
  readonly edgeStableId?: string;
  readonly namedReference?: NamedReferenceName;
  readonly radius: number;
  readonly topologyStatus?: CadBodyTopologyStatus;
  readonly topologyModel?: CadBodyTopologyModel;
  readonly topologyAvailable?: boolean;
  readonly exactMeasurementsAvailable?: boolean;
  readonly measurementConfidence?: CadBodyTopologyMeasurementConfidence;
  readonly topologyIssueCount?: number;
  readonly status: CadDependencyHealthStatus;
  readonly issues: readonly CadDependencyHealthIssue[];
}

export interface CadAttachedSketchHealth {
  readonly sketchId: SketchId;
  readonly sketchName: string;
  readonly plane: SketchPlane;
  readonly bodyId: BodyId;
  readonly faceStableId: string;
  readonly sourceFeatureId: FeatureId;
  readonly sourceSketchId: SketchId;
  readonly sourceSketchEntityId: SketchEntityId;
  readonly faceRole: CadGeneratedExtrudeFaceRole;
  readonly status: CadDependencyHealthStatus;
  readonly resolves: boolean;
  readonly eligibleForSketchPlane: boolean;
  readonly resolvedKind?: CadGeneratedEntityKind;
  readonly resolvedFaceRole?: CadGeneratedExtrudeFaceRole;
  readonly issues: readonly CadDependencyHealthIssue[];
}

export interface CadSketchDimensionHealth {
  readonly dimensionId: SketchDimensionId;
  readonly dimensionName: string;
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
  readonly target: SketchDimensionTarget;
  readonly valueSource: SketchDimensionValueSource;
  readonly status: CadDependencyHealthStatus;
  readonly affectedFeatureIds: readonly FeatureId[];
  readonly affectedBodyIds: readonly BodyId[];
  readonly effectiveValue?: number;
  readonly parameterId?: ParameterId;
  readonly issues: readonly CadDependencyHealthIssue[];
}

export interface CadSketchConstraintHealth {
  readonly constraintId: SketchConstraintId;
  readonly constraintName: string;
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
  readonly kind: SketchConstraintKind;
  readonly status: CadDependencyHealthStatus;
  readonly affectedFeatureIds: readonly FeatureId[];
  readonly affectedBodyIds: readonly BodyId[];
  readonly target?: SketchPointTarget;
  readonly primaryTarget?: SketchPointTarget;
  readonly secondaryTarget?: SketchPointTarget;
  readonly lineEntityId?: SketchEntityId;
  readonly primaryLineEntityId?: SketchEntityId;
  readonly secondaryLineEntityId?: SketchEntityId;
  readonly primaryCurveTarget?: SketchCurveConstraintTarget;
  readonly secondaryCurveTarget?: SketchCurveConstraintTarget;
  readonly primaryCircleEntityId?: SketchEntityId;
  readonly secondaryCircleEntityId?: SketchEntityId;
  readonly angleDegrees?: number;
  readonly symmetryLineEntityId?: SketchEntityId;
  readonly currentCoordinate?: Vec2;
  readonly primaryCurrentCoordinate?: Vec2;
  readonly secondaryCurrentCoordinate?: Vec2;
  readonly resolvedCoordinate?: Vec2;
  readonly primaryDirection?: Vec2;
  readonly secondaryDirection?: Vec2;
  readonly issues: readonly CadDependencyHealthIssue[];
}

export interface CadNamedReferenceHealth {
  readonly name: NamedReferenceName;
  readonly bodyId: BodyId;
  readonly stableId: string;
  readonly kind: CadGeneratedEntityKind;
  readonly status: CadDependencyHealthStatus;
  readonly resolvedKind?: CadGeneratedEntityKind;
  readonly issues: readonly CadDependencyHealthIssue[];
}

export interface CadSketchEvaluationHealth {
  readonly sketchId: SketchId;
  readonly sketchName: string;
  readonly plane: SketchPlane;
  readonly status: CadDependencyHealthStatus;
  readonly drivenEntityIds: readonly SketchEntityId[];
  readonly affectedFeatureIds: readonly FeatureId[];
  readonly affectedBodyIds: readonly BodyId[];
  readonly issues: readonly CadDependencyHealthIssue[];
}

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
  readonly parameterId?: ParameterId;
  readonly sketchDimensionId?: SketchDimensionId;
  readonly sketchConstraintId?: SketchConstraintId;
  readonly sketchId?: SketchId;
  readonly sketchEntityId?: SketchEntityId;
  readonly sketchEntityKind?: SketchEntityKind;
  readonly featureId?: FeatureId;
  readonly bodyId?: BodyId;
  readonly stableId?: string;
  readonly referenceName?: NamedReferenceName;
  readonly generatedReferenceKind?: CadGeneratedEntityKind;
  readonly operationMode?: FeatureExtrudeOperationMode;
  readonly targetBodyId?: BodyId;
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
  readonly references?: ReferenceSemanticDiff;
  readonly parameters?: ParameterSemanticDiff;
  readonly sketchDimensions?: SketchDimensionSemanticDiff;
  readonly sketchConstraints?: SketchConstraintSemanticDiff;
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

export interface WcadPackageEntryMetadata {
  readonly path: string;
  readonly byteLength: number;
  readonly sha256: string;
}

export interface WcadManifestV1 {
  readonly packageVersion: WcadPackageVersion;
  readonly product: "Partbench";
  readonly createdBy: {
    readonly app: "partbench";
    readonly version?: string;
  };
  readonly createdAt: string;
  readonly modifiedAt: string;
  readonly units: DocumentUnits;
  readonly document: WcadPackageEntryMetadata & {
    readonly schemaVersion: WcadDocumentSchemaVersion;
  };
  readonly commands: WcadPackageEntryMetadata;
  readonly sourceIdentity: WcadSourceIdentity;
  readonly cache?: WcadPackageCacheManifestMetadata;
  readonly thumbnail?: WcadPackageThumbnailMetadata;
}

export interface WcadSourceIdentity {
  readonly sha256: string;
  readonly algorithm: WcadSourceIdentityAlgorithm;
}

export interface WcadPackageCacheManifestMetadata {
  readonly entriesPath?: "metadata/cache-index.json";
  readonly policy: "optional-rebuildable";
}

export interface WcadPackageThumbnailMetadata extends WcadPackageEntryMetadata {
  readonly mimeType: "image/png" | "image/webp";
}

export interface WcadPackageCacheEntryMetadata extends WcadPackageEntryMetadata {
  readonly artifactKind: WcadPackageCacheArtifactKind;
  readonly artifactVersion: string;
  readonly sourceIdentity: WcadSourceIdentity;
}

export type WcadPackageValidationIssueCode =
  | "WCAD_INVALID_PACKAGE"
  | "WCAD_MISSING_MANIFEST"
  | "WCAD_INVALID_MANIFEST"
  | "WCAD_UNSUPPORTED_PACKAGE_VERSION"
  | "WCAD_DUPLICATE_ENTRY"
  | "WCAD_MISSING_DOCUMENT"
  | "WCAD_MISSING_COMMANDS"
  | "WCAD_INVALID_PACKAGE_PATH"
  | "WCAD_BYTE_LENGTH_MISMATCH"
  | "WCAD_HASH_MISMATCH"
  | "WCAD_INVALID_DOCUMENT_CBOR"
  | "WCAD_INVALID_COMMANDS_CBOR"
  | "WCAD_UNSUPPORTED_DOCUMENT_SCHEMA"
  | "WCAD_SOURCE_IDENTITY_MISMATCH"
  | "WCAD_STALE_CACHE_ENTRY"
  | "WCAD_UNSUPPORTED_CACHE_ENTRY";

export interface WcadPackageValidationIssue {
  readonly code: WcadPackageValidationIssueCode;
  readonly severity: "error" | "warning";
  readonly message: string;
  readonly path?: string;
  readonly entryPath?: string;
  readonly entryRole?: WcadPackageEntryRole;
  readonly expected?: string | number;
  readonly received?: string | number;
}

export type WcadPackageReadinessDiagnosticCode =
  | "WCAD_PACKAGE_CONTRACT_READY"
  | "WCAD_CURRENT_PROJECT_SCHEMA_SUPPORTED"
  | "WCAD_PROJECT_SCHEMA_V17_NOT_REQUIRED"
  | "WCAD_PACKAGE_READ_WRITE_READY"
  | "WCAD_PACKAGE_READ_WRITE_DEFERRED"
  | "WCAD_FILE_SYSTEM_ACCESS_READY"
  | "WCAD_FILE_SYSTEM_ACCESS_DEFERRED"
  | "WCAD_OPFS_CACHE_READY"
  | "WCAD_OPFS_CACHE_DEFERRED"
  | "WCAD_STEP_EXPORT_READY"
  | "WCAD_STEP_EXPORT_DEFERRED"
  | "WCAD_STEP_EXPORT_CONTRACT_READY";

export interface WcadPackageReadinessDiagnostic {
  readonly code: WcadPackageReadinessDiagnosticCode;
  readonly status: WcadReadinessStatus;
  readonly message: string;
  readonly expected?: string;
  readonly received?: string;
}

export interface WcadPackageRequiredEntry {
  readonly role: Extract<
    WcadPackageEntryRole,
    "manifest" | "document" | "commands"
  >;
  readonly path: string;
  readonly source: true;
}

export interface WcadPackageOptionalCacheEntry {
  readonly role: Extract<
    WcadPackageEntryRole,
    "cache" | "thumbnail" | "export" | "metadata"
  >;
  readonly path: string;
  readonly source: false;
}

export interface WcadPackageCapabilityReadiness {
  readonly capability: WcadPackageCapabilityId;
  readonly label: string;
  readonly status: WcadReadinessStatus;
  readonly available: boolean;
  readonly sourceBoundaryNote: string;
  readonly derivedBoundaryNote: string;
  readonly diagnostics: readonly WcadPackageReadinessDiagnostic[];
}

export type CadQueryErrorCode =
  | "INVALID_CADOPS_VERSION"
  | "INVALID_QUERY"
  | "UNKNOWN_QUERY"
  | "PARAMETER_NOT_FOUND"
  | "OBJECT_NOT_FOUND"
  | "SKETCH_NOT_FOUND"
  | "SKETCH_DIMENSION_NOT_FOUND"
  | "BODY_NOT_FOUND"
  | "UNSUPPORTED_BODY_REFERENCES"
  | "UNSUPPORTED_BODY_MEASUREMENTS"
  | "UNSUPPORTED_BODY_TOPOLOGY"
  | "STALE_BODY_TOPOLOGY"
  | "AMBIGUOUS_BODY_TOPOLOGY"
  | "EMPTY_EXACT_GEOMETRY_RESULT"
  | "INVALID_EXACT_GEOMETRY_RESULT"
  | "EXACT_GEOMETRY_KERNEL_FAILED"
  | "GENERATED_REFERENCE_NOT_FOUND"
  | "NAMED_REFERENCE_NOT_FOUND"
  | "UNSUPPORTED_GENERATED_REFERENCE_MEASUREMENTS";

export interface CadQueryError {
  readonly code: CadQueryErrorCode;
  readonly message: string;
  readonly parameterId?: ParameterId;
  readonly objectId?: ObjectId;
  readonly sketchId?: SketchId;
  readonly sketchDimensionId?: SketchDimensionId;
  readonly bodyId?: BodyId;
  readonly featureId?: FeatureId;
  readonly stableId?: string;
  readonly referenceName?: NamedReferenceName;
}

export type CadBodyTopologyStatus =
  | "healthy"
  | "unsupported"
  | "ambiguous"
  | "stale"
  | "kernel-failed"
  | "unavailable-binding";

export type CadBodyTopologySourceKind =
  | "authoredExtrude"
  | "authoredRevolve"
  | "authoredHole"
  | "authoredChamfer"
  | "authoredFillet"
  | "primitiveCompatibility";

export type CadBodyTopologyModel = "none" | "semantic-source";

export type CadBodyTopologyMeasurementConfidence =
  | "none"
  | "source-analytic"
  | "kernel-derived";

export type CadBodyTopologyIssueCode =
  | "UNSUPPORTED_BODY_TOPOLOGY"
  | "STALE_BODY_TOPOLOGY"
  | "AMBIGUOUS_BODY_TOPOLOGY"
  | "EMPTY_EXACT_GEOMETRY_RESULT"
  | "INVALID_EXACT_GEOMETRY_RESULT"
  | "EXACT_GEOMETRY_KERNEL_FAILED"
  | "EXACT_GEOMETRY_BINDING_UNAVAILABLE";

export type CadBodyExactMetadataStatus =
  | "healthy"
  | "unsupported"
  | "stale"
  | "kernel-failed"
  | "unavailable-binding";

export interface CadBodyExactMetadataDiagnostic {
  readonly code: string;
  readonly message: string;
}

export interface CadBodyExactMetadataTopologyCounts {
  readonly solidCount: number;
  readonly faceCount: number;
  readonly edgeCount: number;
  readonly vertexCount: number;
}

export interface CadBodyExactMetadataSnapshot {
  readonly status: CadBodyExactMetadataStatus;
  readonly source: "kernel-derived";
  readonly confidence: "kernel-derived";
  readonly bounds?: CadAxisAlignedBounds;
  readonly volume?: number;
  readonly surfaceArea?: number;
  readonly centroid?: Vec3;
  readonly topologyCounts?: CadBodyExactMetadataTopologyCounts;
  readonly diagnostics: readonly CadBodyExactMetadataDiagnostic[];
}

export type CadBodyDerivedExactMetadataStatus =
  | "ready"
  | "unsupported"
  | "stale"
  | "kernel-failed"
  | "unavailable-binding";

export interface CadBodyDerivedExactMetadataSnapshot {
  readonly bodyId: BodyId;
  readonly sourceIdentitySignature: string;
  readonly status: CadBodyDerivedExactMetadataStatus;
  readonly metadata?: Omit<CadBodyExactMetadataSnapshot, "status">;
  readonly error?: CadBodyExactMetadataDiagnostic;
}

export interface CadBodyTopologySourceIdentity {
  readonly bodyId: BodyId;
  readonly sourceKind: CadBodyTopologySourceKind;
  readonly signature: string;
  readonly units: DocumentUnits;
  readonly featureId?: FeatureId;
  readonly operationMode?: FeatureExtrudeOperationMode;
  readonly targetBodyId?: BodyId;
  readonly sourceSketchId?: SketchId;
  readonly sourceSketchEntityId?: SketchEntityId;
  readonly profileKind?: FeatureExtrudeProfileKind;
  readonly revolveAxis?: FeatureRevolveAxis;
  readonly revolveAxisSignature?: {
    readonly start: Vec2;
    readonly end: Vec2;
  };
  readonly revolveAngleDegrees?: number;
  readonly holeCircleEntityId?: SketchEntityId;
  readonly holeDepthMode?: FeatureHoleDepthMode;
  readonly holeDepth?: number;
  readonly holeDirection?: FeatureHoleDirection;
  readonly edgeStableId?: string;
  readonly namedReference?: NamedReferenceName;
  readonly chamferDistance?: number;
  readonly filletRadius?: number;
  readonly profileSignature?: CadGeneratedReferenceProfileSignature;
  readonly side?: FeatureExtrudeSide;
  readonly depth?: number;
}

export interface CadBodyTopologyIssue {
  readonly code: CadBodyTopologyIssueCode;
  readonly message: string;
  readonly bodyId: BodyId;
  readonly featureId?: FeatureId;
  readonly expected?: string;
  readonly received?: string;
}

export interface CadBodyTopologySnapshot {
  readonly bodyId: BodyId;
  readonly units: DocumentUnits;
  readonly status: CadBodyTopologyStatus;
  readonly sourceKind: CadBodyTopologySourceKind;
  readonly sourceIdentity: CadBodyTopologySourceIdentity;
  readonly topologyModel: CadBodyTopologyModel;
  readonly topologyAvailable: boolean;
  readonly exactGeometryAvailable: boolean;
  readonly exactMeasurementsAvailable: boolean;
  readonly measurementConfidence: CadBodyTopologyMeasurementConfidence;
  readonly exactMetadata?: CadBodyExactMetadataSnapshot;
  readonly faceCount?: number;
  readonly edgeCount?: number;
  readonly vertexCount?: number;
  readonly issues: readonly CadBodyTopologyIssue[];
}

export type CadExportFormatId = "step" | "glb";

export type CadExportKind = "exact" | "visualization";

export type CadExactExportFormatId = "step";

export type CadExactExportWriterStatus = "available" | "unavailable";

export type CadExactExportSourceIdentityStatus =
  | "notProvided"
  | "matchedCurrent"
  | "mismatchedCurrent";

export type CadExportReadinessStatus = "supported" | "deferred" | "unavailable";

export type CadExportBodySourceKind =
  | "authoredExtrude"
  | "authoredRevolve"
  | "authoredHole"
  | "authoredChamfer"
  | "authoredFillet"
  | "primitiveCompatibility"
  | "unresolvedSource";

export type CadExportDiagnosticCode =
  | "EXPORT_WRITER_NOT_IMPLEMENTED"
  | "EXPORT_EXACT_WRITER_UNAVAILABLE"
  | "EXPORT_EXACT_WRITER_FAILED"
  | "EXPORT_EXACT_FORMAT_UNSUPPORTED"
  | "EXPORT_EXACT_BODY_UNSUPPORTED"
  | "EXPORT_SOURCE_IDENTITY_MISMATCH"
  | "EXPORT_PROJECT_EMPTY"
  | "EXPORT_BODY_SOURCE_SUPPORTED"
  | "EXPORT_BODY_CONSUMED"
  | "EXPORT_BODY_SOURCE_UNRESOLVED"
  | "EXPORT_BODY_SOURCE_UNSUPPORTED"
  | "EXPORT_RESULT_BODY_DEFERRED"
  | "EXPORT_PRIMITIVE_SOURCE_UNAVAILABLE";

export interface CadExportDiagnostic {
  readonly code: CadExportDiagnosticCode;
  readonly status: CadExportReadinessStatus;
  readonly message: string;
  readonly format?: CadExportFormatId;
  readonly bodyId?: BodyId;
  readonly bodyName?: string;
  readonly bodyKind?: CadBodySnapshot["kind"];
  readonly sourceKind?: CadExportBodySourceKind;
  readonly featureId?: FeatureId;
  readonly objectId?: ObjectId;
  readonly consumedByFeatureId?: FeatureId;
  readonly expected?: string;
  readonly received?: string;
}

export interface CadExactExportExtrudeBodySource {
  readonly bodyId: BodyId;
  readonly bodyName?: string;
  readonly sourceKind: "authoredExtrude";
  readonly featureId: FeatureId;
  readonly sourceSketchId: SketchId;
  readonly sourceSketchEntityId: SketchEntityId;
  readonly sketchPlane: SketchPlane;
  readonly profile:
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
  readonly depth: number;
  readonly side: FeatureExtrudeSide;
  readonly placementFrame?: {
    readonly origin: Vec3;
    readonly uAxis: Vec3;
    readonly vAxis: Vec3;
  };
}

export type CadExactExportBodySource = CadExactExportExtrudeBodySource;

export interface CadExportFormatReadiness {
  readonly format: CadExportFormatId;
  readonly label: string;
  readonly exportKind: CadExportKind;
  readonly status: CadExportReadinessStatus;
  readonly available: boolean;
  readonly writerStatus: CadExactExportWriterStatus;
  readonly fileExtensions: readonly string[];
  readonly units: DocumentUnits;
  readonly sourceBoundaryNote: string;
  readonly derivedBoundaryNote: string;
  readonly candidateBodyCount: number;
  readonly sourceSupportedBodyCount: number;
  readonly deferredBodyCount: number;
  readonly unavailableBodyCount: number;
  readonly diagnostics: readonly CadExportDiagnostic[];
}

export interface CadExportBodyFormatReadiness {
  readonly format: CadExportFormatId;
  readonly label: string;
  readonly exportKind: CadExportKind;
  readonly status: CadExportReadinessStatus;
  readonly writerStatus: CadExactExportWriterStatus;
  readonly diagnostics: readonly CadExportDiagnostic[];
}

export interface CadExactExportArtifact {
  readonly format: CadExactExportFormatId;
  readonly fileName: string;
  readonly mimeType: "model/step" | "application/step";
  readonly byteLength: number;
  readonly sha256: string;
  readonly bytesBase64: string;
}

export interface CadExportBodyReadiness {
  readonly bodyId: BodyId;
  readonly bodyName?: string;
  readonly bodyKind: CadBodySnapshot["kind"];
  readonly featureId: FeatureId;
  readonly partId: PartId;
  readonly sourceKind: CadExportBodySourceKind;
  readonly sourceStatus: CadExportReadinessStatus;
  readonly status: CadExportReadinessStatus;
  readonly consumedByFeatureId?: FeatureId;
  readonly objectId?: ObjectId;
  readonly primitive?: CadObjectKind;
  readonly sourceBoundaryNote: string;
  readonly derivedBoundaryNote: string;
  readonly formats: readonly CadExportBodyFormatReadiness[];
  readonly diagnostics: readonly CadExportDiagnostic[];
}

export type CadQueryResponse =
  | ParameterListQueryResponse
  | ParameterGetQueryResponse
  | FeatureEditabilityQueryResponse
  | ProjectSummaryQueryResponse
  | ProjectFeaturesQueryResponse
  | ProjectStructureQueryResponse
  | ProjectHealthQueryResponse
  | ProjectDependencyGraphQueryResponse
  | ProjectRebuildPlanQueryResponse
  | ProjectExportReadinessQueryResponse
  | ProjectExactExportQueryResponse
  | ProjectPackageReadinessQueryResponse
  | ProjectSketchesQueryResponse
  | ObjectGetQueryResponse
  | ObjectMeasurementsQueryResponse
  | ProjectExtentsQueryResponse
  | SketchGetQueryResponse
  | SketchEditReadinessQueryResponse
  | SketchSolverStatusQueryResponse
  | SketchEvaluationQueryResponse
  | SketchDimensionsQueryResponse
  | SketchDimensionGetQueryResponse
  | BodyGeneratedReferencesQueryResponse
  | BodyResolveGeneratedReferenceQueryResponse
  | BodyTopologyQueryResponse
  | BodyMeasurementsQueryResponse
  | BodyGeneratedReferenceMeasurementsQueryResponse
  | ReferenceListNamedQueryResponse
  | ReferenceResolveNamedQueryResponse
  | ReferenceHealthQueryResponse
  | SelectionReferenceCandidatesQueryResponse
  | TransactionHistoryQueryResponse
  | CadQueryErrorResponse;

export interface ParameterListQueryResponse {
  readonly ok: true;
  readonly query: "parameter.list";
  readonly cadOpsVersion: CadOpsVersion;
  readonly parameterCount: number;
  readonly parameters: readonly CadParameterSnapshot[];
}

export interface ParameterGetQueryResponse {
  readonly ok: true;
  readonly query: "parameter.get";
  readonly cadOpsVersion: CadOpsVersion;
  readonly parameter: CadParameterSnapshot;
}

export interface FeatureEditabilityQueryResponse {
  readonly ok: true;
  readonly query: "feature.editability";
  readonly cadOpsVersion: CadOpsVersion;
  readonly featureId: FeatureId;
  readonly status: CadFeatureEditabilityStatus;
  readonly feature?: CadFeatureSummary;
  readonly fieldCount: number;
  readonly fields: readonly CadFeatureEditFieldDescriptor[];
  readonly rebuildReadiness: CadFeatureRebuildReadiness;
  readonly dryRun: CadFeatureEditDryRunSummary;
  readonly affected: CadFeatureEditAffectedSummary;
  readonly referenceChangeCount: number;
  readonly referenceChanges: readonly CadFeatureReferenceChangeSummary[];
  readonly diagnosticCount: number;
  readonly diagnostics: readonly CadFeatureEditDiagnostic[];
  readonly sourceBoundaryNote: string;
  readonly derivedBoundaryNote: string;
  readonly requiresProjectSchemaMigration: false;
}

export interface ProjectSummaryQueryResponse {
  readonly ok: true;
  readonly query: "project.summary";
  readonly cadOpsVersion: CadOpsVersion;
  readonly units: DocumentUnits;
  readonly objectCount: number;
  readonly objects: readonly CadObjectSnapshot[];
  readonly structure: CadProjectSummaryStructureCounts;
  readonly health: CadProjectSummaryHealthSummary;
  readonly references: CadProjectSummaryReferenceSummary;
  readonly exportReadiness: CadProjectSummaryExportSummary;
  readonly workflowHints: readonly CadProjectSummaryWorkflowHint[];
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

export interface ProjectHealthQueryResponse {
  readonly ok: true;
  readonly query: "project.health";
  readonly cadOpsVersion: CadOpsVersion;
  readonly status: CadDependencyHealthStatus;
  readonly issueCount: number;
  readonly authoredExtrudeCount: number;
  readonly authoredRevolveCount: number;
  readonly authoredHoleCount: number;
  readonly authoredChamferCount: number;
  readonly authoredFilletCount: number;
  readonly attachedSketchCount: number;
  readonly sketchEvaluationCount: number;
  readonly sketchDimensionCount: number;
  readonly sketchConstraintCount: number;
  readonly namedReferenceCount: number;
  readonly authoredExtrudes: readonly CadAuthoredExtrudeHealth[];
  readonly authoredRevolves: readonly CadAuthoredRevolveHealth[];
  readonly authoredHoles: readonly CadAuthoredHoleHealth[];
  readonly authoredChamfers: readonly CadAuthoredChamferHealth[];
  readonly authoredFillets: readonly CadAuthoredFilletHealth[];
  readonly attachedSketches: readonly CadAttachedSketchHealth[];
  readonly sketchEvaluations: readonly CadSketchEvaluationHealth[];
  readonly sketchDimensions: readonly CadSketchDimensionHealth[];
  readonly sketchConstraints: readonly CadSketchConstraintHealth[];
  readonly namedReferences: readonly CadNamedReferenceHealth[];
}

export interface ProjectDependencyGraphQueryResponse {
  readonly ok: true;
  readonly query: "project.dependencyGraph";
  readonly cadOpsVersion: CadOpsVersion;
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly nodes: readonly CadDependencyGraphNode[];
  readonly edges: readonly CadDependencyGraphEdge[];
  readonly referenceHealthCount: number;
  readonly referenceHealth: readonly CadReferenceHealthEntry[];
  readonly diagnosticCount: number;
  readonly diagnostics: readonly CadReferenceHealthDiagnostic[];
  readonly sourceBoundaryNote: string;
  readonly derivedBoundaryNote: string;
  readonly requiresProjectSchemaMigration: false;
}

export interface ProjectRebuildPlanQueryResponse {
  readonly ok: true;
  readonly query: "project.rebuildPlan";
  readonly cadOpsVersion: CadOpsVersion;
  readonly status: CadRebuildPlanStatus;
  readonly bodyLifecycleCount: number;
  readonly bodyLifecycles: readonly CadBodyLifecycleSummary[];
  readonly lifecycleEffectCount: number;
  readonly lifecycleEffects: readonly CadBodyLifecycleEffectSummary[];
  readonly affected: CadRebuildAffectedSummary;
  readonly diagnosticCount: number;
  readonly diagnostics: readonly CadRebuildPlanDiagnostic[];
  readonly sourceBoundaryNote: string;
  readonly derivedBoundaryNote: string;
  readonly requiresProjectSchemaMigration: false;
}

export interface ProjectExportReadinessQueryResponse {
  readonly ok: true;
  readonly query: "project.exportReadiness";
  readonly cadOpsVersion: CadOpsVersion;
  readonly status: CadExportReadinessStatus;
  readonly canExportFiles: boolean;
  readonly units: DocumentUnits;
  readonly sourceBoundaryNote: string;
  readonly derivedBoundaryNote: string;
  readonly formatCount: number;
  readonly formats: readonly CadExportFormatReadiness[];
  readonly bodyCount: number;
  readonly sourceSupportedBodyCount: number;
  readonly deferredBodyCount: number;
  readonly unavailableBodyCount: number;
  readonly bodies: readonly CadExportBodyReadiness[];
  readonly diagnosticCount: number;
  readonly diagnostics: readonly CadExportDiagnostic[];
}

export interface ProjectExactExportQueryResponse {
  readonly ok: true;
  readonly query: "project.exportExact";
  readonly cadOpsVersion: CadOpsVersion;
  readonly format: CadExactExportFormatId;
  readonly label: "STEP";
  readonly exportKind: "exact";
  readonly status: CadExportReadinessStatus;
  readonly available: boolean;
  readonly canExportFile: boolean;
  readonly writerStatus: CadExactExportWriterStatus;
  readonly units: DocumentUnits;
  readonly fileExtensions: readonly [".step", ".stp"];
  readonly documentSchemaVersion: WcadDocumentSchemaVersion;
  readonly sourceIdentityAlgorithm: WcadSourceIdentityAlgorithm;
  readonly requestedSourceIdentity?: WcadSourceIdentity;
  readonly sourceIdentityStatus: CadExactExportSourceIdentityStatus;
  readonly requestedBodyIds: readonly BodyId[];
  readonly bodyCount: number;
  readonly sourceSupportedBodyCount: number;
  readonly deferredBodyCount: number;
  readonly unavailableBodyCount: number;
  readonly exportableBodyCount: number;
  readonly exportSources: readonly CadExactExportBodySource[];
  readonly bodies: readonly CadExportBodyReadiness[];
  readonly diagnosticCount: number;
  readonly diagnostics: readonly CadExportDiagnostic[];
  readonly artifact?: CadExactExportArtifact;
}

export interface ProjectPackageReadinessQueryResponse {
  readonly ok: true;
  readonly query: "project.packageReadiness";
  readonly cadOpsVersion: CadOpsVersion;
  readonly status: WcadReadinessStatus;
  readonly packageVersion: WcadPackageVersion;
  readonly fileExtension: WcadPackageExtension;
  readonly sourceIdentityAlgorithm: WcadSourceIdentityAlgorithm;
  readonly documentSchemaVersion: WcadDocumentSchemaVersion;
  readonly canRepresentCurrentSource: boolean;
  readonly requiresProjectSchemaMigration: boolean;
  readonly nextProjectSchemaVersion?: "web-cad.project.v17";
  readonly sourceBoundaryNote: string;
  readonly derivedBoundaryNote: string;
  readonly requiredEntryCount: number;
  readonly requiredEntries: readonly WcadPackageRequiredEntry[];
  readonly optionalCacheEntryCount: number;
  readonly optionalCacheEntries: readonly WcadPackageOptionalCacheEntry[];
  readonly capabilityCount: number;
  readonly capabilities: readonly WcadPackageCapabilityReadiness[];
  readonly diagnosticCount: number;
  readonly diagnostics: readonly WcadPackageReadinessDiagnostic[];
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
  readonly bodyCount: number;
  readonly bounds?: CadAxisAlignedBounds;
  readonly approximateVolume: number;
  readonly objects: readonly ObjectExtentSnapshot[];
  readonly bodies: readonly BodyExtentSnapshot[];
  readonly warnings: readonly ProjectExtentsWarning[];
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

export interface SketchEditReadinessQueryResponse {
  readonly ok: true;
  readonly query: "sketch.editReadiness";
  readonly cadOpsVersion: CadOpsVersion;
  readonly status: CadSketchEditReadinessStatus;
  readonly edit: CadSketchEditProposal;
  readonly dryRun: CadSketchEditDryRunSummary;
  readonly sketchHealth?: CadSketchEditHealthSummary;
  readonly affected: CadSketchEditAffectedSummary;
  readonly featureImpactCount: number;
  readonly featureImpacts: readonly CadSketchEditFeatureImpact[];
  readonly bodyLifecycleCount: number;
  readonly bodyLifecycles: readonly CadBodyLifecycleSummary[];
  readonly referenceEffectCount: number;
  readonly referenceEffects: readonly CadSketchEditReferenceEffectSummary[];
  readonly referenceHealthCount: number;
  readonly referenceHealth: readonly CadReferenceHealthEntry[];
  readonly diagnosticCount: number;
  readonly diagnostics: readonly CadSketchEditDiagnostic[];
  readonly sourceBoundaryNote: string;
  readonly derivedBoundaryNote: string;
  readonly requiresProjectSchemaMigration: false;
}

export interface SketchSolverStatusQueryResponse {
  readonly ok: true;
  readonly query: "sketch.solverStatus";
  readonly cadOpsVersion: CadOpsVersion;
  readonly sketchId: SketchId;
  readonly sketchName: string;
  readonly plane: SketchPlane;
  readonly status: CadSketchSolverStatus;
  readonly readiness: CadSketchSolverReadinessStatus;
  readonly solver: CadSketchSolverEngineSummary;
  readonly entityCount: number;
  readonly entities: readonly CadSketchSolverEntitySummary[];
  readonly dimensionCount: number;
  readonly dimensions: readonly CadSketchSolverDimensionSummary[];
  readonly constraintCount: number;
  readonly constraints: readonly CadSketchSolverConstraintSummary[];
  readonly deferredConstraintCount: number;
  readonly deferredConstraints: readonly CadSketchSolverDeferredConstraintSummary[];
  readonly profileValidity: CadSketchProfileValiditySummary;
  readonly preview: CadSketchSolverPreviewSummary;
  readonly sourceContract: CadSketchSolverSourceContract;
  readonly diagnosticCount: number;
  readonly diagnostics: readonly CadSketchSolverDiagnostic[];
  readonly sourceBoundaryNote: string;
  readonly derivedBoundaryNote: string;
  readonly requiresProjectSchemaMigration: false;
}

export interface SketchEvaluationQueryResponse {
  readonly ok: true;
  readonly query: "sketch.evaluation";
  readonly cadOpsVersion: CadOpsVersion;
  readonly sketchId: SketchId;
  readonly sketchName: string;
  readonly plane: SketchPlane;
  readonly status: SketchDimensionStatus;
  readonly drivenEntityCount: number;
  readonly drivenEntityIds: readonly SketchEntityId[];
  readonly dimensionCount: number;
  readonly dimensions: readonly SketchDimensionEntry[];
  readonly constraintCount: number;
  readonly constraints: readonly SketchConstraintEntry[];
  readonly issueCount: number;
  readonly issues: readonly SketchEvaluationIssue[];
}

export interface SketchDimensionsQueryResponse {
  readonly ok: true;
  readonly query: "sketch.dimensions";
  readonly cadOpsVersion: CadOpsVersion;
  readonly sketchId: SketchId;
  readonly dimensionCount: number;
  readonly dimensions: readonly SketchDimensionEntry[];
}

export interface SketchDimensionGetQueryResponse {
  readonly ok: true;
  readonly query: "sketch.dimension.get";
  readonly cadOpsVersion: CadOpsVersion;
  readonly dimension: SketchDimensionEntry;
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
  readonly axisCount: number;
  readonly axes: readonly CadGeneratedAxisReference[];
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

export interface BodyTopologyQueryResponse {
  readonly ok: true;
  readonly query: "body.topology";
  readonly cadOpsVersion: CadOpsVersion;
  readonly topology: CadBodyTopologySnapshot;
}

export interface BodyMeasurementsQueryResponse {
  readonly ok: true;
  readonly query: "body.measurements";
  readonly cadOpsVersion: CadOpsVersion;
  readonly measurements: BodyMeasurementsSnapshot;
}

export interface BodyGeneratedReferenceMeasurementsQueryResponse {
  readonly ok: true;
  readonly query: "body.generatedReferenceMeasurements";
  readonly cadOpsVersion: CadOpsVersion;
  readonly bodyId: BodyId;
  readonly stableId: string;
  readonly kind: CadGeneratedEntityKind;
  readonly reference: CadGeneratedReference;
  readonly measurements: GeneratedReferenceMeasurement;
}

export interface ReferenceListNamedQueryResponse {
  readonly ok: true;
  readonly query: "reference.listNamed";
  readonly cadOpsVersion: CadOpsVersion;
  readonly referenceCount: number;
  readonly references: readonly NamedGeneratedReferenceEntry[];
}

export interface ReferenceResolveNamedQueryResponse {
  readonly ok: true;
  readonly query: "reference.resolveNamed";
  readonly cadOpsVersion: CadOpsVersion;
  readonly name: NamedReferenceName;
  readonly target: NamedGeneratedReferenceSnapshot;
  readonly reference: CadGeneratedReference;
}

export interface ReferenceHealthQueryResponse {
  readonly ok: true;
  readonly query: "reference.health";
  readonly cadOpsVersion: CadOpsVersion;
  readonly target: CadReferenceHealthTarget;
  readonly status: CadReferenceHealthStatus;
  readonly referenceHealthCount: number;
  readonly referenceHealth: readonly CadReferenceHealthEntry[];
  readonly diagnosticCount: number;
  readonly diagnostics: readonly CadReferenceHealthDiagnostic[];
  readonly sourceBoundaryNote: string;
  readonly derivedBoundaryNote: string;
  readonly requiresProjectSchemaMigration: false;
}

export interface SelectionReferenceCandidatesQueryResponse {
  readonly ok: true;
  readonly query: "selection.referenceCandidates";
  readonly cadOpsVersion: CadOpsVersion;
  readonly selection: CadSelectionReferenceInput;
  readonly requiredOperation?: CadSelectionReferenceOperation;
  readonly status: CadSelectionReferenceStatus;
  readonly candidateCount: number;
  readonly candidates: readonly CadSelectionReferenceCandidate[];
  readonly issueCount: number;
  readonly issues: readonly CadSelectionReferenceIssue[];
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
