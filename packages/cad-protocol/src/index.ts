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
export type WcadPackageVersion = "partbench.wcad.v1" | "partbench.wcad.v2";
export type WcadPackageExtension = ".wcad";
export type WcadSourceIdentityAlgorithm = "partbench-source-v1";
export type WcadPackageV1DocumentSchemaVersion =
  | "web-cad.project.v16"
  | "web-cad.project.v17";
export type WcadDocumentSchemaVersion =
  | WcadPackageV1DocumentSchemaVersion
  | "web-cad.project.v18"
  | "web-cad.project.v19"
  | "web-cad.project.v20"
  | "web-cad.project.v21";
export type CadTopologyIdentityContractVersion =
  "partbench.topology-identity.v1";
export type CadTopologyIdentityProjectSchemaVersion = "web-cad.project.v18";
export type CadTopologyIdentityPackageVersion = "partbench.wcad.v2";
export type CadV15ProjectSchemaVersion = "web-cad.project.v19";
export type CadV16ProjectSchemaVersion = "web-cad.project.v20";
export type CadV17ProjectSchemaVersion = "web-cad.project.v21";
export type WcadPackageEntryRole =
  | "manifest"
  | "document"
  | "commands"
  | "checkpoint-brep"
  | "checkpoint-topology"
  | "checkpoint-signature"
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

export const WCAD_PACKAGE_VERSION = "partbench.wcad.v1" as const;
export const WCAD_PACKAGE_EXTENSION: WcadPackageExtension = ".wcad";
export const WCAD_SOURCE_IDENTITY_ALGORITHM: WcadSourceIdentityAlgorithm =
  "partbench-source-v1";
export const WCAD_MANIFEST_ENTRY_PATH = "manifest.json";
export const WCAD_DOCUMENT_ENTRY_PATH = "document.cbor";
export const WCAD_COMMANDS_ENTRY_PATH = "commands.cbor";
export const CAD_TOPOLOGY_IDENTITY_CONTRACT_VERSION: CadTopologyIdentityContractVersion =
  "partbench.topology-identity.v1";
export const CAD_TOPOLOGY_IDENTITY_PROJECT_SCHEMA_VERSION: CadTopologyIdentityProjectSchemaVersion =
  "web-cad.project.v18";
export const CAD_TOPOLOGY_IDENTITY_PACKAGE_VERSION: CadTopologyIdentityPackageVersion =
  "partbench.wcad.v2";
export const CAD_V15_PROJECT_SCHEMA_VERSION: CadV15ProjectSchemaVersion =
  "web-cad.project.v19";
export const CAD_V16_PROJECT_SCHEMA_VERSION: CadV16ProjectSchemaVersion =
  "web-cad.project.v20";
export const CAD_V17_PROJECT_SCHEMA_VERSION: CadV17ProjectSchemaVersion =
  "web-cad.project.v21";

export type CadProjectSchemaDiagnosticCode =
  | "SCHEMA_UPGRADED_TO_V21"
  | "SCHEMA_V21_SOURCE_INVALID";

export interface CadProjectSchemaDiagnostic {
  readonly code: CadProjectSchemaDiagnosticCode;
  readonly severity: "info" | "error";
  readonly message: string;
  readonly path?: string;
  readonly expected?: string;
  readonly received?: string;
}

export type Vec2 = readonly [number, number];
export type Vec3 = readonly [number, number, number];
/** Row-major document-space rigid transform. Pattern instances never scale. */
export type Mat4 = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number
];
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
export type SketchEntityKindV20 = "point" | "line" | "rectangle" | "circle";

export type SketchEntityKind = SketchEntityKindV20 | "arc";
export type SketchEntityKindV21 = SketchEntityKind;

export type SketchSegmentOrientation = "forward" | "reverse";

export interface OrientedSketchSegmentRef {
  readonly entityId: SketchEntityId;
  readonly orientation: SketchSegmentOrientation;
}

export interface SketchEntityProfileRef {
  readonly kind: "entity";
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
}

export interface SketchWireProfileRef {
  readonly kind: "wire";
  readonly sketchId: SketchId;
  readonly segments: readonly OrientedSketchSegmentRef[];
}

export type SketchProfileRef = SketchEntityProfileRef | SketchWireProfileRef;

export interface SketchEntityPathRef {
  readonly kind: "entity";
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
  readonly orientation: SketchSegmentOrientation;
}

export interface SketchChainPathRef {
  readonly kind: "chain";
  readonly sketchId: SketchId;
  readonly segments: readonly OrientedSketchSegmentRef[];
}

export type SketchPathRef = SketchEntityPathRef | SketchChainPathRef;

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

export interface SketchLegacyPointTarget {
  readonly entityId: SketchEntityId;
  readonly role: SketchPointTargetRole;
  readonly entityKind?: never;
}

export interface SketchArcPointTarget {
  readonly entityId: SketchEntityId;
  readonly entityKind: "arc";
  readonly role: "center" | "start" | "end";
}

export type SketchPointTarget = SketchLegacyPointTarget | SketchArcPointTarget;

export type SketchPointTargetV21 = SketchPointTarget;

export type SketchCurveConstraintTargetKind = "line" | "circle" | "arc";

export interface SketchLineCurveConstraintTarget {
  readonly entityId: SketchEntityId;
  readonly entityKind: "line";
}

export interface SketchCircleCurveConstraintTarget {
  readonly entityId: SketchEntityId;
  readonly entityKind: "circle";
}

export type SketchLegacyCurveConstraintTarget =
  | SketchLineCurveConstraintTarget
  | SketchCircleCurveConstraintTarget;

export interface SketchArcCurveConstraintTarget {
  readonly entityId: SketchEntityId;
  readonly entityKind: "arc";
}

export type SketchCurveConstraintTarget =
  | SketchLegacyCurveConstraintTarget
  | SketchArcCurveConstraintTarget;

export type SketchCurveConstraintTargetV21 = SketchCurveConstraintTarget;

export interface SketchRadiusCurveTarget {
  readonly entityId: SketchEntityId;
  readonly entityKind: "circle" | "arc";
}

export type SketchDimensionIssueCode =
  | "PARAMETER_NOT_FOUND"
  | "SKETCH_NOT_FOUND"
  | "SKETCH_ENTITY_NOT_FOUND"
  | "UNSUPPORTED_TARGET"
  | "INVALID_VALUE"
  | "INCONSISTENT_CONSTRAINT"
  | "SKETCH_ARC_DIMENSION_INVALID";

export type SketchConstraintIssueCode =
  | "SKETCH_NOT_FOUND"
  | "SKETCH_ENTITY_NOT_FOUND"
  | "UNSUPPORTED_TARGET"
  | "INVALID_VALUE"
  | "INCONSISTENT_CONSTRAINT"
  | "CONFLICTING_CONSTRAINT"
  | "SKETCH_TANGENCY_OUTSIDE_ARC"
  | "SKETCH_ARC_SOLVE_BRANCH_INVALID";

export type SketchDimensionTargetV20 =
  | SketchRectangleDimensionTarget
  | SketchCircleDimensionTarget
  | SketchLineDimensionTarget;

export type SketchDimensionTarget =
  | SketchDimensionTargetV20
  | SketchArcDimensionTarget;

export type SketchDimensionTargetV21 = SketchDimensionTarget;

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

export interface SketchArcDimensionTarget {
  readonly entityKind: "arc";
  readonly role: "radius" | "sweep";
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
  | ProjectImportStepOp
  | ParameterCreateOp
  | ParameterUpdateOp
  | ParameterSetExpressionOp
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
  | SketchAddArcOp
  | SketchUpdateEntityOp
  | SketchDeleteEntityOp
  | SketchSetEntityConstructionOp
  | SketchDimensionCreateOp
  | SketchDimensionUpdateOp
  | SketchDimensionRenameOp
  | SketchDimensionDeleteOp
  | SketchConstraintCreateOp
  | SketchConstraintRenameOp
  | SketchConstraintDeleteOp
  | FeatureExtrudeCommandInput
  | FeatureRevolveCommandInput
  | FeatureHoleOp
  | FeatureChamferOp
  | FeatureFilletOp
  | FeatureLinearPatternOp
  | FeatureCircularPatternOp
  | FeatureMirrorOp
  | FeatureShellOp
  | FeatureSweepCommandInput
  | FeatureLoftCommandInput
  | FeatureUpdateExtrudeCommandInput
  | FeatureUpdateRevolveCommandInput
  | FeatureUpdateHoleOp
  | FeatureUpdateChamferOp
  | FeatureUpdateFilletOp
  | FeatureUpdateLinearPatternOp
  | FeatureUpdateCircularPatternOp
  | FeatureUpdateMirrorOp
  | FeatureUpdateShellOp
  | FeatureUpdateSweepCommandInput
  | FeatureUpdateLoftCommandInput
  | FeatureDeleteOp
  | ReferenceNameGeneratedOp
  | ReferenceRepairNameOp
  | ReferenceDeleteNameOp
  | TopologyCheckpointCreateOp
  | TopologyAnchorCreateOp
  | TopologyAnchorRepairOp;

export interface DocumentUpdateUnitsOp {
  readonly op: "document.updateUnits";
  readonly units: DocumentUnits;
  readonly mode?: DocumentUnitUpdateMode;
}

export interface ProjectImportStepOp {
  readonly op: "project.importStep";
  readonly sourceFileName: string;
  readonly sourceFormat: "step";
  readonly payloadRef: CadStepImportTransientPayloadRef;
  readonly maxBodyCount?: number;
  readonly resolvedBodies?: readonly ProjectImportStepResolvedBody[];
}

export interface CadStepImportTransientPayloadRef {
  readonly kind: "transient";
  readonly payloadId: string;
  readonly byteLength: number;
  readonly sha256?: string;
}

export interface ProjectImportStepResolvedBody {
  readonly featureId: FeatureId;
  readonly bodyId: BodyId;
  readonly checkpointId: string;
  readonly name?: string;
  readonly sourceIdentity: WcadSourceIdentity;
  readonly checkpointStatus?: Extract<
    CadTopologyIdentityState,
    "active" | "stale" | "missing" | "failed" | "unsupported"
  >;
  readonly healingApplied: boolean;
  readonly diagnostics?: readonly CadStepImportDiagnostic[];
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

export interface ParameterSetExpressionOp {
  readonly op: "parameter.setExpression";
  readonly id: ParameterId;
  readonly expression?: string | null;
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
  readonly topologyAnchorId?: string;
  readonly topologyAnchorProof?: CadTopologyAnchorCommandProof;
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
  readonly construction?: boolean;
}

export interface SketchAddLineOp {
  readonly op: "sketch.addLine";
  readonly sketchId: SketchId;
  readonly id?: SketchEntityId;
  readonly start: Vec2;
  readonly end: Vec2;
  readonly construction?: boolean;
}

export interface SketchAddRectangleOp {
  readonly op: "sketch.addRectangle";
  readonly sketchId: SketchId;
  readonly id?: SketchEntityId;
  readonly center: Vec2;
  readonly width: number;
  readonly height: number;
  readonly construction?: boolean;
}

export interface SketchAddCircleOp {
  readonly op: "sketch.addCircle";
  readonly sketchId: SketchId;
  readonly id?: SketchEntityId;
  readonly center: Vec2;
  readonly radius: number;
  readonly construction?: boolean;
}

export type SketchArcDefinition =
  | SketchArcCenterAnglesDefinition
  | SketchArcThreePointDefinition;

export interface SketchArcCenterAnglesDefinition {
  readonly kind: "centerAngles";
  readonly center: Vec2;
  readonly radius: number;
  readonly startAngleDegrees: number;
  readonly sweepAngleDegrees: number;
}

export interface SketchArcThreePointDefinition {
  readonly kind: "threePoint";
  readonly start: Vec2;
  readonly pointOnArc: Vec2;
  readonly end: Vec2;
}

export interface SketchAddArcOp {
  readonly op: "sketch.addArc";
  readonly sketchId: SketchId;
  readonly id?: SketchEntityId;
  readonly construction?: boolean;
  readonly definition: SketchArcDefinition;
}

export interface SketchUpdateEntityOp {
  readonly op: "sketch.updateEntity";
  readonly sketchId: SketchId;
  readonly entity: SketchEntityUpdateInput;
}

export type SketchEntityUpdateInput =
  | (Omit<SketchPointEntitySnapshot, "construction"> & {
      readonly construction?: boolean;
    })
  | (Omit<SketchLineEntitySnapshot, "construction"> & {
      readonly construction?: boolean;
    })
  | (Omit<SketchRectangleEntitySnapshot, "construction"> & {
      readonly construction?: boolean;
    })
  | (Omit<SketchCircleEntitySnapshot, "construction"> & {
      readonly construction?: boolean;
    })
  | SketchArcEntity;

export interface SketchUpdateEntityOpV21 {
  readonly op: "sketch.updateEntity";
  readonly sketchId: SketchId;
  readonly entity: SketchEntityV21;
}

export interface SketchDeleteEntityOp {
  readonly op: "sketch.deleteEntity";
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
}

export interface SketchSetEntityConstructionOp {
  readonly op: "sketch.setEntityConstruction";
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
  readonly construction: boolean;
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
  | SketchPerpendicularConstraintCreateOp
  | SketchTangentConstraintCreateOp
  | SketchConcentricConstraintCreateOp
  | SketchEqualRadiusConstraintCreateOp
  | SketchSymmetryConstraintCreateOp;

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
  readonly target: SketchLegacyPointTarget;
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

interface SketchNamedConstraintCreateOpBase {
  readonly op: "sketch.constraint.create";
  readonly id?: SketchConstraintId;
  readonly name: string;
  readonly sketchId: SketchId;
}

export type SketchTangentConstraintTargetPair =
  | {
      readonly primaryTarget: SketchLineCurveConstraintTarget;
      readonly secondaryTarget:
        | SketchCircleCurveConstraintTarget
        | SketchArcCurveConstraintTarget;
    }
  | {
      readonly primaryTarget: SketchCircleCurveConstraintTarget;
      readonly secondaryTarget:
        | SketchLineCurveConstraintTarget
        | SketchArcCurveConstraintTarget;
    }
  | {
      readonly primaryTarget: SketchArcCurveConstraintTarget;
      readonly secondaryTarget: SketchCurveConstraintTarget;
    };

export type SketchTangentConstraintCreateOp =
  SketchNamedConstraintCreateOpBase & {
    readonly kind: "tangent";
  } & SketchTangentConstraintTargetPair;

interface SketchRadiusConstraintCreateOpBase extends SketchNamedConstraintCreateOpBase {
  readonly kind: "concentric" | "equalRadius";
}

export interface SketchLegacyRadiusConstraintCreateTargets {
  readonly primaryCircleEntityId: SketchEntityId;
  readonly secondaryCircleEntityId: SketchEntityId;
  readonly primaryTarget?: never;
  readonly secondaryTarget?: never;
}

export interface SketchNormalizedRadiusConstraintCreateTargets {
  readonly primaryTarget: SketchRadiusCurveTarget;
  readonly secondaryTarget: SketchRadiusCurveTarget;
  readonly primaryCircleEntityId?: never;
  readonly secondaryCircleEntityId?: never;
}

export type SketchConcentricConstraintCreateOp =
  SketchRadiusConstraintCreateOpBase & { readonly kind: "concentric" } & (
      | SketchLegacyRadiusConstraintCreateTargets
      | SketchNormalizedRadiusConstraintCreateTargets
    );

export type SketchEqualRadiusConstraintCreateOp =
  SketchRadiusConstraintCreateOpBase & { readonly kind: "equalRadius" } & (
      | SketchLegacyRadiusConstraintCreateTargets
      | SketchNormalizedRadiusConstraintCreateTargets
    );

export interface SketchSymmetryConstraintCreateOp extends SketchNamedConstraintCreateOpBase {
  readonly kind: "symmetry";
  readonly primaryTarget: SketchPointTarget;
  readonly secondaryTarget: SketchPointTarget;
  readonly symmetryLineEntityId: SketchEntityId;
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
  readonly targetTopologyAnchorId?: string;
  readonly name?: string;
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
  readonly depth: number;
  readonly side?: FeatureExtrudeSide;
  readonly operationMode?: FeatureExtrudeOperationMode;
}

export interface FeatureExtrudeOpV21 extends Omit<
  FeatureExtrudeOp,
  "sketchId" | "entityId"
> {
  readonly profile: SketchProfileRef;
  readonly sketchId?: never;
  readonly entityId?: never;
}

export type FeatureExtrudeCommandInput =
  | (FeatureExtrudeOp & { readonly profile?: never })
  | FeatureExtrudeOpV21;

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

export interface FeatureRevolveOpV21 extends Omit<
  FeatureRevolveOp,
  "sketchId" | "entityId" | "targetBodyId" | "operationMode"
> {
  readonly profile: SketchProfileRef;
  readonly operationMode: "newBody";
  readonly sketchId?: never;
  readonly entityId?: never;
  readonly targetBodyId?: never;
}

export type FeatureRevolveCommandInput =
  | (FeatureRevolveOp & { readonly profile?: never })
  | FeatureRevolveOpV21;

export interface FeatureHoleOp {
  readonly op: "feature.hole";
  readonly id?: FeatureId;
  readonly bodyId?: BodyId;
  readonly targetBodyId?: BodyId;
  readonly targetTopologyAnchorId?: string;
  readonly name?: string;
  /** Holes remain circle-entity consumers, not general profile consumers. */
  readonly profile?: never;
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
  readonly topologyAnchorId?: string;
  readonly topologyAnchorProof?: CadTopologyAnchorCommandProof;
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
  readonly topologyAnchorId?: string;
  readonly topologyAnchorProof?: CadTopologyAnchorCommandProof;
  readonly radius: number;
  readonly name?: string;
}

export type FeaturePatternAxis = "x" | "y" | "z";
export type FeatureMirrorPlane = "XY" | "XZ" | "YZ";

export type PatternDirectionRef =
  | { readonly kind: "globalAxis"; readonly axis: FeaturePatternAxis }
  | {
      readonly kind: "generatedEdge";
      readonly bodyId: BodyId;
      readonly stableId: string;
    }
  | { readonly kind: "namedReference"; readonly name: NamedReferenceName }
  | {
      readonly kind: "topologyAnchor";
      readonly bodyId: BodyId;
      readonly anchorId: string;
    };

export type PatternRotationAxisRef = PatternDirectionRef;

export type MirrorPlaneRef =
  | {
      readonly kind: "standardPlane";
      readonly plane: FeatureMirrorPlane;
      readonly offset?: number;
    }
  | {
      readonly kind: "generatedFace";
      readonly bodyId: BodyId;
      readonly stableId: string;
      readonly offset?: number;
    }
  | {
      readonly kind: "namedReference";
      readonly name: NamedReferenceName;
      readonly offset?: number;
    }
  | {
      readonly kind: "topologyAnchor";
      readonly bodyId: BodyId;
      readonly anchorId: string;
      readonly offset?: number;
    };

export interface PatternInstanceRecord {
  readonly instanceIndex: number;
  readonly transform: Mat4;
}

export type FeatureShellOpenFaceRef =
  | FeatureShellGeneratedFaceRef
  | FeatureShellNamedReferenceRef
  | FeatureShellTopologyAnchorRef;

export interface FeatureShellGeneratedFaceRef {
  readonly kind: "generatedFace";
  readonly bodyId: BodyId;
  readonly stableId: string;
}

export interface FeatureShellNamedReferenceRef {
  readonly kind: "namedReference";
  readonly name: NamedReferenceName;
}

export interface FeatureShellTopologyAnchorRef {
  readonly kind: "topologyAnchor";
  readonly bodyId: BodyId;
  readonly anchorId: string;
}

export interface FeatureLinearPatternOp {
  readonly op: "feature.linearPattern";
  readonly id?: FeatureId;
  readonly bodyId?: BodyId;
  readonly seedBodyId: BodyId;
  /** V15 compatibility sugar. At least one of axis or direction is required. */
  readonly axis?: FeaturePatternAxis;
  readonly direction?: PatternDirectionRef;
  readonly spacing: number;
  readonly instanceCount: number;
  readonly name?: string;
}

export interface FeatureCircularPatternOp {
  readonly op: "feature.circularPattern";
  readonly id?: FeatureId;
  readonly bodyId?: BodyId;
  readonly seedBodyId: BodyId;
  /** V15 compatibility sugar; V20 callers should pass the reference union. */
  readonly rotationAxis?: FeaturePatternAxis | PatternRotationAxisRef;
  readonly totalAngleDegrees: number;
  readonly instanceCount: number;
  readonly name?: string;
}

export interface FeatureSweepOp {
  readonly op: "feature.sweep";
  readonly id?: FeatureId;
  readonly bodyId?: BodyId;
  readonly name?: string;
  readonly operationMode?: "newBody";
  readonly targetBodyId?: never;
  readonly targetTopologyAnchorId?: never;
  readonly profileSketchId: SketchId;
  readonly profileEntityId: SketchEntityId;
  readonly pathSketchId: SketchId;
  readonly pathEntityIds: readonly SketchEntityId[];
}

export interface FeatureSweepOpV21 extends Omit<
  FeatureSweepOp,
  "profileSketchId" | "profileEntityId" | "pathSketchId" | "pathEntityIds"
> {
  readonly profile: SketchEntityProfileRef;
  readonly path: SketchPathRef;
  readonly profileSketchId?: never;
  readonly profileEntityId?: never;
  readonly pathSketchId?: never;
  readonly pathEntityIds?: never;
}

export type FeatureSweepCommandInput =
  | (FeatureSweepOp & {
      readonly profile?: never;
      readonly path?: never;
    })
  | FeatureSweepOpV21;

export interface FeatureLoftOp {
  readonly op: "feature.loft";
  readonly id?: FeatureId;
  readonly bodyId?: BodyId;
  readonly name?: string;
  readonly sections: readonly LoftSection[];
}

export interface FeatureLoftOpV21 extends Omit<FeatureLoftOp, "sections"> {
  readonly sections: readonly LoftSectionV21[];
}

export type FeatureLoftCommandInput = FeatureLoftOp | FeatureLoftOpV21;

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

export interface FeatureUpdateExtrudeOpV21 extends FeatureUpdateExtrudeOp {
  readonly profile?: SketchProfileRef;
  readonly sketchId?: never;
  readonly entityId?: never;
}

export type FeatureUpdateExtrudeCommandInput =
  | (FeatureUpdateExtrudeOp & {
      readonly profile?: never;
      readonly sketchId?: never;
      readonly entityId?: never;
    })
  | (FeatureUpdateExtrudeOp & {
      readonly profile?: never;
      readonly sketchId: SketchId;
      readonly entityId: SketchEntityId;
    })
  | (FeatureUpdateExtrudeOpV21 & { readonly profile: SketchProfileRef });

export interface FeatureUpdateRevolveOp {
  readonly op: "feature.updateRevolve";
  readonly id: FeatureId;
  readonly angleDegrees: number;
}

export type FeatureUpdateRevolveCommandInput =
  | (FeatureUpdateRevolveOp & {
      readonly profile?: never;
      readonly sketchId?: never;
      readonly entityId?: never;
    })
  | (Omit<FeatureUpdateRevolveOp, "angleDegrees"> & {
      readonly angleDegrees?: number;
      readonly profile?: never;
      readonly sketchId: SketchId;
      readonly entityId: SketchEntityId;
    })
  | (Omit<FeatureUpdateRevolveOp, "angleDegrees"> & {
      readonly angleDegrees?: number;
      readonly profile: SketchProfileRef;
      readonly sketchId?: never;
      readonly entityId?: never;
    });

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

export interface FeatureUpdateLinearPatternOp {
  readonly op: "feature.updateLinearPattern";
  readonly id: FeatureId;
  readonly axis?: FeaturePatternAxis;
  readonly direction?: PatternDirectionRef;
  readonly spacing?: number;
  readonly instanceCount?: number;
}

export interface FeatureUpdateCircularPatternOp {
  readonly op: "feature.updateCircularPattern";
  readonly id: FeatureId;
  readonly rotationAxis?: FeaturePatternAxis | PatternRotationAxisRef;
  readonly totalAngleDegrees?: number;
  readonly instanceCount?: number;
}

export interface FeatureMirrorOp {
  readonly op: "feature.mirror";
  readonly id?: FeatureId;
  readonly bodyId?: BodyId;
  readonly seedBodyId: BodyId;
  /** V15 compatibility sugar. At least one of mirrorPlane or plane is required. */
  readonly mirrorPlane?: FeatureMirrorPlane;
  readonly plane?: MirrorPlaneRef;
  readonly includeOriginal: boolean;
  readonly name?: string;
}

export interface FeatureUpdateMirrorOp {
  readonly op: "feature.updateMirror";
  readonly id: FeatureId;
  readonly mirrorPlane?: FeatureMirrorPlane;
  readonly plane?: MirrorPlaneRef;
  readonly includeOriginal?: boolean;
}

export interface FeatureUpdateSweepOp {
  readonly op: "feature.updateSweep";
  readonly id: FeatureId;
  readonly operationMode?: "newBody";
  readonly targetBodyId?: never;
  readonly targetTopologyAnchorId?: never;
  readonly profileSketchId?: SketchId;
  readonly profileEntityId?: SketchEntityId;
  readonly pathSketchId?: SketchId;
  readonly pathEntityIds?: readonly SketchEntityId[];
}

type FeatureUpdateSweepBase = Pick<
  FeatureUpdateSweepOp,
  "op" | "id" | "operationMode" | "targetBodyId" | "targetTopologyAnchorId"
>;

type FeatureUpdateSweepNoSourcePatch = {
  readonly profile?: never;
  readonly path?: never;
  readonly profileSketchId?: never;
  readonly profileEntityId?: never;
  readonly pathSketchId?: never;
  readonly pathEntityIds?: never;
};

type FeatureUpdateSweepLegacyProfilePatch = {
  readonly profile?: never;
  readonly path?: never;
  readonly profileSketchId: SketchId;
  readonly profileEntityId: SketchEntityId;
  readonly pathSketchId?: never;
  readonly pathEntityIds?: never;
};

type FeatureUpdateSweepLegacyPathPatch = {
  readonly profile?: never;
  readonly path?: never;
  readonly profileSketchId?: never;
  readonly profileEntityId?: never;
  readonly pathSketchId: SketchId;
  readonly pathEntityIds: readonly SketchEntityId[];
};

type FeatureUpdateSweepLegacyCompletePatch = {
  readonly profile?: never;
  readonly path?: never;
  readonly profileSketchId: SketchId;
  readonly profileEntityId: SketchEntityId;
  readonly pathSketchId: SketchId;
  readonly pathEntityIds: readonly SketchEntityId[];
};

type FeatureUpdateSweepNormalizedPatch =
  | {
      readonly profile: SketchEntityProfileRef;
      readonly path?: SketchPathRef;
      readonly profileSketchId?: never;
      readonly profileEntityId?: never;
      readonly pathSketchId?: never;
      readonly pathEntityIds?: never;
    }
  | {
      readonly profile?: SketchEntityProfileRef;
      readonly path: SketchPathRef;
      readonly profileSketchId?: never;
      readonly profileEntityId?: never;
      readonly pathSketchId?: never;
      readonly pathEntityIds?: never;
    };

export type FeatureUpdateSweepCommandInput = FeatureUpdateSweepBase &
  (
    | FeatureUpdateSweepNoSourcePatch
    | FeatureUpdateSweepLegacyProfilePatch
    | FeatureUpdateSweepLegacyPathPatch
    | FeatureUpdateSweepLegacyCompletePatch
    | FeatureUpdateSweepNormalizedPatch
  );

export interface FeatureUpdateLoftOp {
  readonly op: "feature.updateLoft";
  readonly id: FeatureId;
  readonly sections: readonly LoftSection[];
}

export interface FeatureUpdateLoftOpV21 extends Omit<
  FeatureUpdateLoftOp,
  "sections"
> {
  readonly sections: readonly LoftSectionV21[];
}

export type FeatureUpdateLoftCommandInput =
  | FeatureUpdateLoftOp
  | FeatureUpdateLoftOpV21;

export interface FeatureShellOp {
  readonly op: "feature.shell";
  readonly id?: FeatureId;
  readonly bodyId?: BodyId;
  readonly targetBodyId: BodyId;
  readonly wallThickness: number;
  readonly openFaceRefs?: readonly FeatureShellOpenFaceRef[];
  readonly name?: string;
}

export interface FeatureUpdateShellOp {
  readonly op: "feature.updateShell";
  readonly id: FeatureId;
  readonly wallThickness?: number;
  readonly openFaceRefs?: readonly FeatureShellOpenFaceRef[];
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
  readonly bodyId?: BodyId;
  readonly stableId?: string;
  readonly topologyAnchorId?: string;
}

export interface ReferenceDeleteNameOp {
  readonly op: "reference.deleteName";
  readonly name: NamedReferenceName;
}

export interface TopologyCheckpointCreateOp {
  readonly op: "topology.checkpoint.create";
  readonly checkpointId: string;
  readonly bodyId: BodyId;
  readonly sourceFeatureId?: FeatureId;
  readonly sourceIdentity: WcadSourceIdentity;
  readonly status: Extract<
    CadTopologyIdentityState,
    "active" | "stale" | "missing" | "failed" | "unsupported"
  >;
  readonly diagnostics?: readonly CadTopologyIdentityDiagnostic[];
}

export interface TopologyAnchorCreateOp {
  readonly op: "topology.anchor.create";
  readonly anchorId: string;
  readonly entityKind: CadTopologyAnchorEntityKind;
  readonly bodyId: BodyId;
  readonly checkpointId: string;
  readonly checkpointEntityId: string;
  readonly sourceFeatureId?: FeatureId;
  readonly stableId?: string;
  readonly sourceSemanticRole?: string;
  readonly signatureHash?: string;
}

export interface TopologyAnchorRepairOp {
  readonly op: "topology.anchor.repair";
  readonly repairId: string;
  readonly anchorId: string;
  readonly replacementCheckpointId: string;
  readonly replacementCheckpointEntityId: string;
  readonly confidence: CadTopologyMatchConfidence;
  readonly evidence?: readonly CadTopologyMatchEvidence[];
  readonly diagnostics?: readonly CadTopologyIdentityDiagnostic[];
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
  | CadFilletFeatureRef
  | CadLinearPatternFeatureRef
  | CadCircularPatternFeatureRef
  | CadMirrorFeatureRef
  | CadShellFeatureRef
  | CadImportedBodyFeatureRef
  | CadSweepFeatureRef
  | CadLoftFeatureRef;

interface CadExtrudeFeatureRefBase {
  readonly id: FeatureId;
  readonly kind: "extrude";
  readonly bodyId: BodyId;
  readonly sketchId: SketchId;
  readonly depth: number;
  readonly side: FeatureExtrudeSide;
  readonly operationMode: FeatureExtrudeOperationMode;
  readonly targetBodyId?: BodyId;
  readonly targetTopologyAnchorId?: string;
}

export type CadExtrudeFeatureRef = CadExtrudeFeatureRefBase &
  (
    | {
        readonly entityId: SketchEntityId;
        readonly profileKind: FeatureExtrudeProfileKind;
        readonly profile?: never;
      }
    | {
        readonly profile: SketchWireProfileRef;
        readonly entityId?: never;
        readonly profileKind?: never;
      }
  );

interface CadRevolveFeatureRefBase {
  readonly id: FeatureId;
  readonly kind: "revolve";
  readonly bodyId: BodyId;
  readonly sketchId: SketchId;
  readonly axis: FeatureRevolveAxis;
  readonly angleDegrees: number;
  readonly operationMode: FeatureRevolveOperationMode;
  readonly targetBodyId?: BodyId;
}

export type CadRevolveFeatureRef = CadRevolveFeatureRefBase &
  (
    | {
        readonly entityId: SketchEntityId;
        readonly profileKind: FeatureRevolveProfileKind;
        readonly profile?: never;
      }
    | {
        readonly profile: SketchWireProfileRef;
        readonly entityId?: never;
        readonly profileKind?: never;
      }
  );

export interface CadHoleFeatureRef {
  readonly id: FeatureId;
  readonly kind: "hole";
  readonly bodyId: BodyId;
  readonly targetBodyId: BodyId;
  readonly targetTopologyAnchorId?: string;
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
  readonly topologyAnchorId?: string;
  readonly distance: number;
}

export interface CadFilletFeatureRef {
  readonly id: FeatureId;
  readonly kind: "fillet";
  readonly bodyId: BodyId;
  readonly targetBodyId: BodyId;
  readonly edgeStableId?: string;
  readonly namedReference?: NamedReferenceName;
  readonly topologyAnchorId?: string;
  readonly radius: number;
}

export interface CadLinearPatternFeatureRef {
  readonly id: FeatureId;
  readonly kind: "linearPattern";
  readonly bodyId: BodyId;
  readonly seedBodyId: BodyId;
  readonly direction: PatternDirectionRef;
  readonly spacing: number;
  readonly instanceCount: number;
  readonly instances: readonly PatternInstanceRecord[];
}

export interface CadCircularPatternFeatureRef {
  readonly id: FeatureId;
  readonly kind: "circularPattern";
  readonly bodyId: BodyId;
  readonly seedBodyId: BodyId;
  readonly rotationAxis: PatternRotationAxisRef;
  readonly totalAngleDegrees: number;
  readonly instanceCount: number;
  readonly instances: readonly PatternInstanceRecord[];
}

export interface CadMirrorFeatureRef {
  readonly id: FeatureId;
  readonly kind: "mirror";
  readonly bodyId: BodyId;
  readonly seedBodyId: BodyId;
  readonly plane: MirrorPlaneRef;
  readonly includeOriginal: boolean;
}

export type CadSweepFeatureRef = SweepFeatureSnapshot;
export type CadLoftFeatureRef = LoftFeatureSnapshot;

export interface CadShellFeatureRef {
  readonly id: FeatureId;
  readonly kind: "shell";
  readonly bodyId: BodyId;
  readonly targetBodyId: BodyId;
  readonly wallThickness: number;
  readonly openFaceRefs: readonly FeatureShellOpenFaceRef[];
}

export interface CadImportedBodyFeatureRef {
  readonly id: FeatureId;
  readonly kind: "importedBody";
  readonly bodyId: BodyId;
  readonly sourceFileName: string;
  readonly sourceFormat: "step";
  readonly checkpointId: string;
  readonly healingApplied: boolean;
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
  readonly topologyAnchorId?: string;
}

export interface CadTopologyCheckpointRef {
  readonly checkpointId: string;
  readonly bodyId: BodyId;
  readonly sourceFeatureId?: FeatureId;
  readonly sourceIdentity: WcadSourceIdentity;
  readonly status: Extract<
    CadTopologyIdentityState,
    "active" | "stale" | "missing" | "failed" | "unsupported"
  >;
}

export interface CadTopologyAnchorRef {
  readonly anchorId: string;
  readonly entityKind: CadTopologyAnchorEntityKind;
  readonly bodyId: BodyId;
  readonly checkpointId: string;
  readonly checkpointEntityId: string;
  readonly sourceFeatureId?: FeatureId;
  readonly stableId?: string;
}

export interface CadTopologyAnchorRepairRef {
  readonly repairId: string;
  readonly before: CadTopologyAnchorRef;
  readonly after: CadTopologyAnchorRef;
  readonly confidence: CadTopologyMatchConfidence;
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
  readonly primaryTarget?: SketchPointTarget | SketchRadiusCurveTarget;
  readonly secondaryTarget?: SketchPointTarget | SketchRadiusCurveTarget;
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
  readonly entityChanges?: readonly SketchEntitySemanticDiff[];
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
  readonly inputReferences?: readonly FeatureInputReferenceSemanticDiff[];
}

export interface SketchEntitySemanticDiff {
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
  readonly action: "added" | "updated" | "deleted";
  readonly entityKind: SketchEntityKindV21;
  readonly changedFields: readonly string[];
  readonly constructionBefore?: boolean;
  readonly constructionAfter?: boolean;
}

export interface FeatureInputReferenceSemanticDiff {
  readonly featureId: FeatureId;
  readonly inputKind: "profile" | "path";
  readonly before?: SketchProfileRef | SketchPathRef;
  readonly after: SketchProfileRef | SketchPathRef;
  readonly profileOrientationNormalized?: boolean;
  readonly affectedSketchIds: readonly SketchId[];
  readonly affectedEntityIds: readonly SketchEntityId[];
}

export interface ReferenceSemanticDiff {
  readonly namedCreated?: readonly CadNamedReferenceRef[];
  readonly namedRepaired?: readonly CadNamedReferenceRepairRef[];
  readonly namedDeleted?: readonly CadNamedReferenceRef[];
  readonly topologyCheckpointsCreated?: readonly CadTopologyCheckpointRef[];
  readonly topologyAnchorsCreated?: readonly CadTopologyAnchorRef[];
  readonly topologyAnchorsRepaired?: readonly CadTopologyAnchorRepairRef[];
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
  | "STEP_FILE_CORRUPT"
  | "STEP_READER_UNAVAILABLE"
  | "STEP_NO_SOLID_FOUND"
  | "STEP_HEALING_FAILED"
  | "STEP_CHECKPOINT_UNAVAILABLE"
  | "STEP_BODY_LIMIT_EXCEEDED"
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
  | "PARAMETER_HAS_EXPRESSION"
  | "PARAMETER_CIRCULAR_REFERENCE"
  | "PARAMETER_REF_NOT_FOUND"
  | "PARAMETER_REF_AMBIGUOUS"
  | "EXPRESSION_PARSE_ERROR"
  | "EXPRESSION_UNKNOWN_IDENTIFIER"
  | "EXPRESSION_DIVISION_BY_ZERO"
  | "EXPRESSION_INVALID_FUNCTION"
  | "EXPRESSION_INVALID_VALUE"
  | "EXPRESSION_DOMAIN_ERROR"
  | "EXPRESSION_TERNARY_INVALID"
  | "EXPRESSION_LANGUAGE_UNSUPPORTED_TOKEN"
  | "EXPRESSION_LANGUAGE_V2_FEATURES_PRESENT"
  | "EXPRESSION_VALUE_INCONSISTENCY"
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
  | "SKETCH_ARC_DEFINITION_INVALID"
  | "SKETCH_ARC_THREE_POINT_COLLINEAR"
  | "SKETCH_ARC_POINTS_COINCIDENT"
  | "SKETCH_ARC_RADIUS_INVALID"
  | "SKETCH_ARC_SWEEP_INVALID"
  | "SKETCH_ARC_FULL_CIRCLE_USE_CIRCLE"
  | "SKETCH_TANGENCY_OUTSIDE_ARC"
  | "SKETCH_ARC_SOLVE_BRANCH_INVALID"
  | "SKETCH_ARC_DIMENSION_INVALID"
  | "SKETCH_ENTITY_CONSTRUCTION_INVALID"
  | "SKETCH_PROFILE_EMPTY"
  | "SKETCH_PROFILE_ENTITY_MISSING"
  | "SKETCH_PROFILE_ENTITY_UNSUPPORTED"
  | "SKETCH_PROFILE_CONSTRUCTION_ENTITY"
  | "SKETCH_PROFILE_ENTITY_REPEATED"
  | "SKETCH_PROFILE_DISCONNECTED"
  | "SKETCH_PROFILE_BRANCHING"
  | "SKETCH_PROFILE_OPEN"
  | "SKETCH_PROFILE_SELF_INTERSECTING"
  | "SKETCH_PROFILE_OVERLAPPING"
  | "SKETCH_PROFILE_AREA_TOO_SMALL"
  | "SKETCH_PROFILE_MULTIPLE_REGIONS_UNSUPPORTED"
  | "SKETCH_PROFILE_INNER_LOOP_UNSUPPORTED"
  | "SKETCH_PROFILE_CONSUMER_UNSUPPORTED"
  | "COMPOSITE_REVOLVE_PROFILE_UNSUPPORTED"
  | "COMPOSITE_REVOLVE_AXIS_INTERSECTION"
  | "SKETCH_PATH_EMPTY"
  | "SKETCH_PATH_ENTITY_MISSING"
  | "SKETCH_PATH_ENTITY_UNSUPPORTED"
  | "SKETCH_PATH_ENTITY_REPEATED"
  | "SKETCH_PATH_DISCONNECTED"
  | "SKETCH_PATH_CLOSED_UNSUPPORTED"
  | "SKETCH_PATH_SELF_INTERSECTING"
  | "SKETCH_PATH_JOIN_NOT_TANGENT"
  | "SKETCH_PATH_FRAME_INVALID"
  | "COMMAND_INPUT_AMBIGUOUS"
  | "SCHEMA_V21_SOURCE_INVALID"
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
  | "TOPOLOGY_CHECKPOINT_ALREADY_EXISTS"
  | "TOPOLOGY_ANCHOR_ALREADY_EXISTS"
  | "TOPOLOGY_ANCHOR_NOT_FOUND"
  | "TOPOLOGY_CHECKPOINT_NOT_FOUND"
  | "TOPOLOGY_REPAIR_ALREADY_EXISTS"
  | "INVALID_TOPOLOGY_CHECKPOINT"
  | "INVALID_TOPOLOGY_ANCHOR"
  | "INVALID_TOPOLOGY_REPAIR"
  | "FEATURE_ALREADY_EXISTS"
  | "FEATURE_NOT_FOUND"
  | "FEATURE_NOT_DELETABLE"
  | "FEATURE_NOT_EDITABLE"
  | "BODY_ALREADY_EXISTS"
  | "TARGET_BODY_REQUIRED"
  | "TARGET_BODY_NOT_SUPPORTED"
  | "PATTERN_SEED_BODY_UNSUPPORTED"
  | "PATTERN_SEED_BODY_CONSUMED"
  | "PATTERN_INSTANCE_COUNT_INVALID"
  | "PATTERN_SPACING_INVALID"
  | "PATTERN_DIRECTION_UNSUPPORTED"
  | "PATTERN_DIRECTION_UNRESOLVED"
  | "PATTERN_AXIS_UNSUPPORTED"
  | "PATTERN_AXIS_UNRESOLVED"
  | "PATTERN_INSTANCE_IDENTITY_INVALID"
  | "PATTERN_FUSE_DEGRADED_TO_COMPOUND"
  | "PATTERN_MULTI_SOLID_RESULT"
  | "PATTERN_MULTI_SOLID_DOWNSTREAM_UNSUPPORTED"
  | "PATTERN_GEOMETRY_FAILED"
  | "MIRROR_SEED_BODY_UNSUPPORTED"
  | "MIRROR_SEED_BODY_CONSUMED"
  | "MIRROR_PLANE_UNSUPPORTED"
  | "MIRROR_PLANE_UNRESOLVED"
  | "MIRROR_OFFSET_INVALID"
  | "SWEEP_PROFILE_UNSUPPORTED"
  | "SWEEP_PATH_UNSUPPORTED"
  | "SWEEP_PATH_DISCONNECTED"
  | "SWEEP_CURVED_PATH_UNSUPPORTED"
  | "SWEEP_PROFILE_PATH_FRAME_INVALID"
  | "SWEEP_GEOMETRY_FAILED"
  | "SWEEP_CURVED_GEOMETRY_FAILED"
  | "SWEEP_ENTITY_UNRESOLVED"
  | "LOFT_SECTION_UNSUPPORTED"
  | "LOFT_SECTION_UNRESOLVED"
  | "LOFT_SECTION_DUPLICATE"
  | "LOFT_SECTIONS_COPLANAR"
  | "LOFT_SECTION_FRAME_INVALID"
  | "LOFT_GEOMETRY_FAILED"
  | "MIRROR_GEOMETRY_FAILED"
  | "SHELL_TARGET_BODY_UNSUPPORTED"
  | "SHELL_TARGET_BODY_CONSUMED"
  | "SHELL_WALL_THICKNESS_INVALID"
  | "SHELL_OPEN_FACE_REF_INVALID"
  | "SHELL_GEOMETRY_FAILED"
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
  readonly topologyAnchorId?: string;
  readonly checkpointId?: string;
  readonly sourceFileName?: string;
  readonly payloadId?: string;
  readonly expression?: string;
  readonly parameterName?: string;
  readonly referencedName?: string;
  readonly cycle?: readonly ParameterId[];
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
  readonly semanticDiff: SemanticDiff;
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
  | "project.parameterEvaluation"
  | "feature.editability"
  | "project.summary"
  | "project.features"
  | "project.structure"
  | "project.health"
  | "project.dependencyGraph"
  | "project.rebuildPlan"
  | "project.topologyIdentityReadiness"
  | "project.importReadiness"
  | "topology.matchSnapshots"
  | "topology.anchorRepairCandidates"
  | "topology.anchorCommandReadiness"
  | "topology.commandTargetReadiness"
  | "topology.anchorCreationPlan"
  | "topology.anchorRepairPlan"
  | "project.exportReadiness"
  | "project.exportExact"
  | "project.packageReadiness"
  | "project.sketches"
  | "object.get"
  | "object.measurements"
  | "project.extents"
  | "sketch.get"
  | "sketch.profileCandidates"
  | "sketch.profileReadiness"
  | "sketch.pathCandidates"
  | "sketch.pathReadiness"
  | "sketch.editReadiness"
  | "sketch.solverStatus"
  | "sketch.evaluation"
  | "sketch.dimensions"
  | "sketch.dimension.get"
  | "body.generatedReferences"
  | "body.resolveGeneratedReference"
  | "body.importedBodyStatus"
  | "body.topology"
  | "body.topologyIdentity"
  | "body.measurements"
  | "body.patternInstances"
  | "body.massProperties"
  | "body.generatedReferenceMeasurements"
  | "reference.listNamed"
  | "reference.resolveNamed"
  | "reference.health"
  | "selection.referenceCandidates"
  | "transaction.history";

export type CadQuery =
  | ParameterListQuery
  | ParameterGetQuery
  | ProjectParameterEvaluationQuery
  | FeatureEditabilityQuery
  | ProjectSummaryQuery
  | ProjectFeaturesQuery
  | ProjectStructureQuery
  | ProjectHealthQuery
  | ProjectDependencyGraphQuery
  | ProjectRebuildPlanQuery
  | ProjectTopologyIdentityReadinessQuery
  | ProjectImportReadinessQuery
  | TopologyMatchSnapshotsQuery
  | TopologyAnchorRepairCandidatesQuery
  | TopologyAnchorCommandReadinessQuery
  | TopologyCommandTargetReadinessQuery
  | TopologyAnchorCreationPlanQuery
  | TopologyAnchorRepairPlanQuery
  | ProjectExportReadinessQuery
  | ProjectExactExportQuery
  | ProjectPackageReadinessQuery
  | ProjectSketchesQuery
  | ObjectGetQuery
  | ObjectMeasurementsQuery
  | ProjectExtentsQuery
  | SketchGetQuery
  | SketchProfileCandidatesQuery
  | SketchProfileReadinessQuery
  | SketchPathCandidatesQuery
  | SketchPathReadinessQuery
  | SketchEditReadinessQuery
  | SketchSolverStatusQuery
  | SketchEvaluationQuery
  | SketchDimensionsQuery
  | SketchDimensionGetQuery
  | BodyGeneratedReferencesQuery
  | BodyResolveGeneratedReferenceQuery
  | BodyImportedBodyStatusQuery
  | BodyTopologyQuery
  | BodyTopologyIdentityQuery
  | BodyMeasurementsQuery
  | BodyPatternInstancesQuery
  | BodyMassPropertiesQuery
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

export interface ProjectParameterEvaluationQuery {
  readonly query: "project.parameterEvaluation";
}

export interface FeatureEditabilityQuery {
  readonly query: "feature.editability";
  readonly featureId: FeatureId;
  readonly proposedEdit?: CadFeatureEditProposal;
  readonly topologyMatchResults?: readonly CadTopologyMatchResult[];
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
  readonly topologyMatchResults?: readonly CadTopologyMatchResult[];
}

export interface ProjectRebuildPlanQuery {
  readonly query: "project.rebuildPlan";
  readonly topologyMatchResults?: readonly CadTopologyMatchResult[];
}

export interface ProjectTopologyIdentityReadinessQuery {
  readonly query: "project.topologyIdentityReadiness";
}

export interface ProjectImportReadinessQuery {
  readonly query: "project.importReadiness";
}

export interface CadTopologyMatchSnapshotInput {
  readonly snapshotId?: string;
  readonly checkpointId?: string;
  readonly bodyId: BodyId;
  readonly sourceFeatureId?: FeatureId;
  readonly sourceIdentity?: WcadSourceIdentity;
  readonly topologySnapshot: CadBodyExactTopologySnapshot;
}

export interface TopologyMatchSnapshotsQuery {
  readonly query: "topology.matchSnapshots";
  readonly previous: CadTopologyMatchSnapshotInput;
  readonly candidates: readonly CadTopologyMatchSnapshotInput[];
}

export interface TopologyAnchorRepairCandidatesQuery {
  readonly query: "topology.anchorRepairCandidates";
  readonly previous: CadTopologyMatchSnapshotInput;
  readonly candidates: readonly CadTopologyMatchSnapshotInput[];
  readonly anchorIds?: readonly string[];
}

export interface TopologyAnchorCommandReadinessQuery {
  readonly query: "topology.anchorCommandReadiness";
  readonly anchorId: string;
  readonly snapshot: CadTopologyMatchSnapshotInput;
  readonly requiredOperation?: CadSelectionReferenceOperation;
}

export type CadTopologyCommandTargetInput = CadSelectionReferenceInput;

export interface TopologyCommandTargetReadinessQuery {
  readonly query: "topology.commandTargetReadiness";
  readonly target: CadTopologyCommandTargetInput;
  readonly desiredOperation?: CadSelectionReferenceOperation;
  readonly snapshot?: CadTopologyMatchSnapshotInput;
  readonly topologyMatchResults?: readonly CadTopologyMatchResult[];
}

export interface TopologyAnchorCreationPlanQuery {
  readonly query: "topology.anchorCreationPlan";
  readonly bodyId: BodyId;
  readonly stableId: string;
  readonly checkpointId?: string;
  readonly anchorId?: string;
  readonly derivedExactMetadata?: CadBodyDerivedExactMetadataSnapshot;
}

export interface TopologyAnchorRepairPlanQuery {
  readonly query: "topology.anchorRepairPlan";
  readonly anchorId: string;
  readonly replacementCheckpointId?: string;
  readonly createReplacementCheckpoint?: boolean;
  readonly derivedExactMetadata: CadBodyDerivedExactMetadataSnapshot;
  readonly selectedRepairCandidateId?: string;
  readonly repairId?: string;
}

export interface ProjectExportReadinessQuery {
  readonly query: "project.exportReadiness";
  readonly derivedExactMetadata?: readonly CadBodyDerivedExactMetadataSnapshot[];
}

export interface ProjectExactExportQuery {
  readonly query: "project.exportExact";
  readonly format: CadExactExportFormatId;
  readonly bodyIds?: readonly BodyId[];
  readonly sourceIdentity?: WcadSourceIdentity;
  readonly derivedExactMetadata?: readonly CadBodyDerivedExactMetadataSnapshot[];
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

export interface SketchProfileCandidatesQuery {
  readonly query: "sketch.profileCandidates";
  readonly sketchId: SketchId;
}

export type SketchProfileExtrudeTargetIntent =
  | {
      readonly targetBodyId?: never;
      readonly targetTopologyAnchorId?: never;
    }
  | {
      readonly targetBodyId: BodyId;
      readonly targetTopologyAnchorId?: never;
    }
  | {
      readonly targetBodyId?: never;
      readonly targetTopologyAnchorId: string;
    };

export type SketchProfileConsumerIntent =
  | {
      readonly featureKind: "extrude";
      readonly operationMode: "newBody";
      readonly targetBodyId?: never;
      readonly targetTopologyAnchorId?: never;
    }
  | ({
      readonly featureKind: "extrude";
      readonly operationMode: "add" | "cut";
    } & SketchProfileExtrudeTargetIntent)
  | {
      readonly featureKind: "revolve" | "sweep" | "loft";
      readonly operationMode: "newBody";
      readonly targetBodyId?: never;
      readonly targetTopologyAnchorId?: never;
    };

export interface SketchProfileReadinessQuery {
  readonly query: "sketch.profileReadiness";
  readonly profile: SketchProfileRef;
  readonly consumer: SketchProfileConsumerIntent;
}

export interface SketchPathCandidatesQuery {
  readonly query: "sketch.pathCandidates";
  readonly sketchId: SketchId;
}

export interface SketchPathReadinessQuery {
  readonly query: "sketch.pathReadiness";
  readonly path: SketchPathRef;
  readonly sweepProfile?: SketchEntityProfileRef;
}

export type SketchProfilePathQuery =
  | SketchProfileCandidatesQuery
  | SketchProfileReadinessQuery
  | SketchPathCandidatesQuery
  | SketchPathReadinessQuery;

export type SketchProfilePathQueryRequest = Omit<CadQueryRequest, "query"> & {
  readonly query: SketchProfilePathQuery;
};

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
  readonly derivedGeneratedReferences?: CadBodyGeneratedReferenceEvidenceSnapshot;
}

export interface BodyResolveGeneratedReferenceQuery {
  readonly query: "body.resolveGeneratedReference";
  readonly bodyId: BodyId;
  readonly stableId: string;
  readonly derivedGeneratedReferences?: CadBodyGeneratedReferenceEvidenceSnapshot;
}

export interface BodyImportedBodyStatusQuery {
  readonly query: "body.importedBodyStatus";
  readonly bodyId: BodyId;
}

export interface BodyTopologyQuery {
  readonly query: "body.topology";
  readonly bodyId: BodyId;
  readonly derivedExactMetadata?: CadBodyDerivedExactMetadataSnapshot;
}

export interface BodyTopologyIdentityQuery {
  readonly query: "body.topologyIdentity";
  readonly bodyId: BodyId;
  readonly checkpointId?: string;
  readonly derivedExactMetadata?: CadBodyDerivedExactMetadataSnapshot;
}

export interface BodyMeasurementsQuery {
  readonly query: "body.measurements";
  readonly bodyId: BodyId;
}

export interface BodyPatternInstancesQuery {
  readonly query: "body.patternInstances";
  readonly bodyId: BodyId;
  readonly derivedExactMetadata?: CadBodyDerivedExactMetadataSnapshot;
}

export interface BodyMassPropertiesQuery {
  readonly query: "body.massProperties";
  readonly bodyId: BodyId;
  readonly density?: number;
  readonly derivedExactMetadata?: CadBodyDerivedExactMetadataSnapshot;
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
  readonly topologyMatchResults?: readonly CadTopologyMatchResult[];
}

export interface SelectionReferenceCandidatesQuery {
  readonly query: "selection.referenceCandidates";
  readonly selection: CadSelectionReferenceInput;
  readonly requiredOperation?: CadSelectionReferenceOperation;
  readonly topologyMatchResults?: readonly CadTopologyMatchResult[];
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
  | SketchCircleEntitySnapshot
  | SketchArcEntity;

export interface SketchPointEntitySnapshot {
  readonly id: SketchEntityId;
  readonly kind: "point";
  readonly point: Vec2;
  readonly construction: boolean;
}

export interface SketchLineEntitySnapshot {
  readonly id: SketchEntityId;
  readonly kind: "line";
  readonly start: Vec2;
  readonly end: Vec2;
  readonly construction: boolean;
}

export interface SketchRectangleEntitySnapshot {
  readonly id: SketchEntityId;
  readonly kind: "rectangle";
  readonly center: Vec2;
  readonly width: number;
  readonly height: number;
  readonly construction: boolean;
}

export interface SketchCircleEntitySnapshot {
  readonly id: SketchEntityId;
  readonly kind: "circle";
  readonly center: Vec2;
  readonly radius: number;
  readonly construction: boolean;
}

export interface SketchArcEntity {
  readonly id: SketchEntityId;
  readonly kind: "arc";
  readonly center: Vec2;
  readonly radius: number;
  /** Canonical source range is [0, 360). */
  readonly startAngleDegrees: number;
  /** Signed source traversal; full circles are represented by circle entities. */
  readonly sweepAngleDegrees: number;
  readonly construction: boolean;
}

export type SketchEntityV21 = SketchEntitySnapshot;

export interface CadParameterSnapshot {
  readonly id: ParameterId;
  readonly name: string;
  readonly value: number;
  readonly expression?: string;
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

export interface SketchDimensionSnapshotV21 extends Omit<
  SketchDimensionSnapshot,
  "target"
> {
  readonly target: SketchDimensionTarget;
}

export interface SketchDimensionSnapshotV20 extends Omit<
  SketchDimensionSnapshot,
  "target"
> {
  readonly target: SketchDimensionTargetV20;
}

export type SketchConstraintSnapshotV20 =
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
  readonly target: SketchLegacyPointTarget;
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
  readonly primaryTarget?: never;
  readonly secondaryTarget?: never;
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
  readonly primaryTarget?: never;
  readonly secondaryTarget?: never;
}

export interface SketchConcentricConstraintV21 {
  readonly id: SketchConstraintId;
  readonly name: string;
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
  readonly kind: "concentric";
  readonly primaryTarget: SketchRadiusCurveTarget;
  readonly secondaryTarget: SketchRadiusCurveTarget;
  readonly primaryCircleEntityId?: never;
  readonly secondaryCircleEntityId?: never;
}

export interface SketchEqualRadiusConstraintV21 {
  readonly id: SketchConstraintId;
  readonly name: string;
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
  readonly kind: "equalRadius";
  readonly primaryTarget: SketchRadiusCurveTarget;
  readonly secondaryTarget: SketchRadiusCurveTarget;
  readonly primaryCircleEntityId?: never;
  readonly secondaryCircleEntityId?: never;
}

export type SketchRadiusConstraintV21 =
  | SketchConcentricConstraintV21
  | SketchEqualRadiusConstraintV21;

export interface SketchFixedConstraintV21 extends Omit<
  SketchFixedConstraintSnapshot,
  "target"
> {
  readonly target: SketchPointTargetV21;
}

export interface SketchCoincidentConstraintV21 extends Omit<
  SketchCoincidentConstraintSnapshot,
  "primaryTarget" | "secondaryTarget"
> {
  readonly primaryTarget: SketchPointTargetV21;
  readonly secondaryTarget: SketchPointTargetV21;
}

export type SketchTangentConstraintV21 = Omit<
  SketchTangentConstraintSnapshot,
  "primaryTarget" | "secondaryTarget"
> & {
  readonly primaryTarget: SketchCurveConstraintTarget;
  readonly secondaryTarget: SketchCurveConstraintTarget;
};

export interface SketchSymmetryConstraintV21 extends Omit<
  SketchSymmetryConstraintSnapshot,
  "primaryTarget" | "secondaryTarget"
> {
  readonly primaryTarget: SketchPointTargetV21;
  readonly secondaryTarget: SketchPointTargetV21;
}

export type SketchConstraintV21 =
  | SketchOrientationConstraintSnapshot
  | SketchFixedConstraintV21
  | SketchCoincidentConstraintV21
  | SketchMidpointConstraintSnapshot
  | SketchParallelConstraintSnapshot
  | SketchPerpendicularConstraintSnapshot
  | SketchTangentConstraintV21
  | SketchConcentricConstraintV21
  | SketchEqualLengthConstraintSnapshot
  | SketchEqualRadiusConstraintV21
  | SketchAngleConstraintSnapshot
  | SketchSymmetryConstraintV21;

/** Canonical live V21 storage and query shape. */
export type SketchConstraintSnapshot = SketchConstraintV21;

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

export type SketchAttachmentSnapshot =
  | SketchGeneratedFaceAttachmentSnapshot
  | SketchTopologyAnchorFaceAttachmentSnapshot;

export interface SketchGeneratedFaceAttachmentSnapshot {
  readonly kind: "generatedFace";
  readonly bodyId: BodyId;
  readonly faceStableId: string;
  readonly sourceFeatureId: FeatureId;
  readonly sourceSketchId: SketchId;
  readonly sourceSketchEntityId: SketchEntityId;
  readonly faceRole: CadGeneratedExtrudeFaceRole;
}

export interface SketchTopologyAnchorFaceAttachmentSnapshot {
  readonly kind: "topologyAnchorFace";
  readonly bodyId: BodyId;
  readonly topologyAnchorId: string;
  readonly checkpointId: string;
  readonly planarAxis: "x" | "y" | "z";
  readonly planarCoordinate: number;
}

export interface SketchSnapshot {
  readonly id: SketchId;
  readonly name: string;
  readonly plane: SketchPlane;
  readonly attachment?: SketchAttachmentSnapshot;
  readonly entities: readonly SketchEntitySnapshot[];
}

export interface SketchSnapshotV21 {
  readonly id: SketchId;
  readonly name: string;
  readonly plane: SketchPlane;
  readonly attachment?: SketchAttachmentSnapshot;
  readonly entities: readonly SketchEntityV21[];
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
  readonly targetTopologyAnchorId?: string;
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
  readonly targetTopologyAnchorId?: string;
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
  readonly topologyAnchorId?: string;
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
  readonly topologyAnchorId?: string;
  readonly radius: number;
  readonly bodyId: BodyId;
}

export interface ImportedBodyFeatureSnapshot {
  readonly id: FeatureId;
  readonly kind: "importedBody";
  readonly name?: string;
  readonly sourceFileName: string;
  readonly sourceFormat: "step";
  readonly bodyId: BodyId;
  readonly checkpointId: string;
  readonly healingApplied: boolean;
}

export interface LinearPatternFeatureSnapshot {
  readonly id: FeatureId;
  readonly kind: "linearPattern";
  readonly name?: string;
  readonly seedBodyId: BodyId;
  /** Present only in legacy V19 snapshots. */
  readonly axis?: FeaturePatternAxis;
  /** Required in normalized memory and V20 snapshots. */
  readonly direction?: PatternDirectionRef;
  readonly spacing: number;
  readonly instanceCount: number;
  readonly bodyId: BodyId;
  /** Required in normalized memory and V20 snapshots. */
  readonly instances?: readonly PatternInstanceRecord[];
}

export interface CircularPatternFeatureSnapshot {
  readonly id: FeatureId;
  readonly kind: "circularPattern";
  readonly name?: string;
  readonly seedBodyId: BodyId;
  readonly rotationAxis?: FeaturePatternAxis | PatternRotationAxisRef;
  readonly totalAngleDegrees: number;
  readonly instanceCount: number;
  readonly bodyId: BodyId;
  readonly instances?: readonly PatternInstanceRecord[];
}

export interface MirrorFeatureSnapshot {
  readonly id: FeatureId;
  readonly kind: "mirror";
  readonly name?: string;
  readonly seedBodyId: BodyId;
  /** Present only in legacy V19 snapshots. */
  readonly mirrorPlane?: FeatureMirrorPlane;
  /** Required in normalized memory and V20 snapshots. */
  readonly plane?: MirrorPlaneRef;
  readonly includeOriginal: boolean;
  readonly bodyId: BodyId;
}

export interface SweepFeatureSnapshot {
  readonly id: FeatureId;
  readonly kind: "sweep";
  readonly name?: string;
  readonly profileSketchId: SketchId;
  readonly profileEntityId: SketchEntityId;
  readonly pathSketchId: SketchId;
  readonly pathEntityIds: readonly SketchEntityId[];
  readonly bodyId: BodyId;
}

export interface LoftSection {
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
  /** Normalized V21 command/storage shape is mutually exclusive. */
  readonly profile?: never;
}

export interface LoftFeatureSnapshot {
  readonly id: FeatureId;
  readonly kind: "loft";
  readonly name?: string;
  readonly sections: readonly LoftSection[];
  readonly bodyId: BodyId;
}

export interface ExtrudeFeatureV21 {
  readonly id: FeatureId;
  readonly kind: "extrude";
  readonly name?: string;
  readonly profile: SketchProfileRef;
  readonly operationMode: FeatureExtrudeOperationMode;
  readonly targetBodyId?: BodyId;
  readonly targetTopologyAnchorId?: string;
  readonly depth: number;
  readonly side: FeatureExtrudeSide;
  readonly bodyId: BodyId;
}

export interface RevolveFeatureV21 {
  readonly id: FeatureId;
  readonly kind: "revolve";
  readonly name?: string;
  readonly profile: SketchProfileRef;
  readonly axis: FeatureRevolveAxis;
  readonly angleDegrees: number;
  readonly operationMode: "newBody";
  readonly bodyId: BodyId;
}

export interface SweepFeatureV21 {
  readonly id: FeatureId;
  readonly kind: "sweep";
  readonly name?: string;
  readonly profile: SketchEntityProfileRef;
  readonly path: SketchPathRef;
  readonly bodyId: BodyId;
}

export interface LoftSectionV21 {
  readonly profile: SketchEntityProfileRef;
  /** Legacy V20 command/storage fields are mutually exclusive. */
  readonly sketchId?: never;
  readonly entityId?: never;
}

export interface LoftFeatureV21 {
  readonly id: FeatureId;
  readonly kind: "loft";
  readonly name?: string;
  readonly sections: readonly LoftSectionV21[];
  readonly bodyId: BodyId;
}

export type ProfileConsumerFeatureV21 =
  | ExtrudeFeatureV21
  | RevolveFeatureV21
  | SweepFeatureV21
  | LoftFeatureV21;

export type FeatureSnapshotV21 =
  | ExtrudeFeatureV21
  | RevolveFeatureV21
  | HoleFeatureSnapshot
  | ChamferFeatureSnapshot
  | FilletFeatureSnapshot
  | ImportedBodyFeatureSnapshot
  | LinearPatternFeatureSnapshot
  | CircularPatternFeatureSnapshot
  | MirrorFeatureSnapshot
  | ShellFeatureSnapshot
  | SweepFeatureV21
  | LoftFeatureV21;

export interface ShellFeatureSnapshot {
  readonly id: FeatureId;
  readonly kind: "shell";
  readonly name?: string;
  readonly targetBodyId: BodyId;
  readonly wallThickness: number;
  readonly openFaceRefs: readonly FeatureShellOpenFaceRef[];
  readonly bodyId: BodyId;
}

export type FeatureSnapshot =
  | ExtrudeFeatureSnapshot
  | RevolveFeatureSnapshot
  | HoleFeatureSnapshot
  | ChamferFeatureSnapshot
  | FilletFeatureSnapshot
  | ImportedBodyFeatureSnapshot
  | LinearPatternFeatureSnapshot
  | CircularPatternFeatureSnapshot
  | MirrorFeatureSnapshot
  | ShellFeatureSnapshot
  | SweepFeatureSnapshot
  | LoftFeatureSnapshot;

export interface CadAxisAlignedBounds {
  readonly min: Vec3;
  readonly max: Vec3;
  readonly size: Vec3;
  readonly center: Vec3;
}

export type CadStepImportDiagnosticCode =
  | "STEP_READER_AVAILABLE"
  | "STEP_TRANSFER_COMPLETE"
  | "STEP_HEALING_APPLIED"
  | "STEP_HEALING_NOT_REQUIRED"
  | "STEP_TOPOLOGY_EXTRACTED"
  | "STEP_CHECKPOINT_PAYLOAD_CREATED"
  | "STEP_FILE_CORRUPT"
  | "STEP_READER_UNAVAILABLE"
  | "STEP_NO_SOLID_FOUND"
  | "STEP_HEALING_FAILED"
  | "STEP_CHECKPOINT_UNAVAILABLE"
  | "STEP_BODY_LIMIT_EXCEEDED"
  | "IMPORTED_BODY_CHECKPOINT_MISSING"
  | "IMPORTED_BODY_TOPOLOGY_UNAVAILABLE"
  | "IMPORTED_BODY_ANCHOR_NEEDED";

export type CadStepImportDiagnosticSeverity = "info" | "warning" | "blocking";

export type CadStepImportReadinessStatus =
  | "supported"
  | "deferred"
  | "unavailable";

export interface CadStepImportDiagnostic {
  readonly code: CadStepImportDiagnosticCode;
  readonly severity: CadStepImportDiagnosticSeverity;
  readonly message: string;
  readonly bodyId?: BodyId;
  readonly featureId?: FeatureId;
  readonly checkpointId?: string;
  readonly expected?: string;
  readonly received?: string;
}

export type CadImportedBodyShapeType = "solid" | "compound" | "assemblyLeaf";

export interface ImportedBodyPayload {
  readonly sourceFormat: "step";
  readonly bodyName?: string;
  readonly shapeType: CadImportedBodyShapeType;
  readonly bounds: CadAxisAlignedBounds;
  readonly solidCount: number;
  readonly faceCount: number;
  readonly edgeCount: number;
  readonly vertexCount: number;
  readonly topologySnapshot: CadBodyExactTopologySnapshot;
  readonly checkpointPayload: ImportedBodyCheckpointPayload;
  readonly healingApplied: boolean;
  readonly diagnostics: readonly CadStepImportDiagnostic[];
}

export interface ImportedBodyCheckpointPayload {
  readonly brepFormat: "occt-brep";
  readonly brepWriter: "BRepTools.Write_3";
  readonly brepByteLength: number;
  readonly brepSha256: string;
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

interface CadExtrudeFeatureSourceBase {
  readonly type: "sketchEntity";
  readonly sketchId: SketchId;
  readonly targetTopologyAnchorId?: string;
}

export type CadExtrudeFeatureSource = CadExtrudeFeatureSourceBase &
  (
    | { readonly entityId: SketchEntityId; readonly profile?: never }
    | { readonly profile: SketchWireProfileRef; readonly entityId?: never }
  );

interface CadExtrudeFeatureSummaryBase {
  readonly id: FeatureId;
  readonly kind: "extrude";
  readonly partId: PartId;
  readonly bodyId: BodyId;
  readonly name?: string;
  readonly sketchId: SketchId;
  readonly depth: number;
  readonly side: FeatureExtrudeSide;
  readonly operationMode: FeatureExtrudeOperationMode;
  readonly targetBodyId?: BodyId;
  readonly targetTopologyAnchorId?: string;
  readonly source: CadExtrudeFeatureSource;
}

export type CadExtrudeFeatureSummary = CadExtrudeFeatureSummaryBase &
  (
    | {
        readonly entityId: SketchEntityId;
        readonly profileKind: FeatureExtrudeProfileKind;
        readonly profile?: never;
      }
    | {
        readonly profile: SketchWireProfileRef;
        readonly entityId?: never;
        readonly profileKind?: never;
      }
  );

interface CadRevolveFeatureSourceBase {
  readonly type: "sketchEntityWithAxis";
  readonly sketchId: SketchId;
  readonly axis: FeatureRevolveAxis;
}

export type CadRevolveFeatureSource = CadRevolveFeatureSourceBase &
  (
    | { readonly entityId: SketchEntityId; readonly profile?: never }
    | { readonly profile: SketchWireProfileRef; readonly entityId?: never }
  );

interface CadRevolveFeatureSummaryBase {
  readonly id: FeatureId;
  readonly kind: "revolve";
  readonly partId: PartId;
  readonly bodyId: BodyId;
  readonly name?: string;
  readonly sketchId: SketchId;
  readonly axis: FeatureRevolveAxis;
  readonly angleDegrees: number;
  readonly operationMode: FeatureRevolveOperationMode;
  readonly targetBodyId?: BodyId;
  readonly source: CadRevolveFeatureSource;
}

export type CadRevolveFeatureSummary = CadRevolveFeatureSummaryBase &
  (
    | {
        readonly entityId: SketchEntityId;
        readonly profileKind: FeatureRevolveProfileKind;
        readonly profile?: never;
      }
    | {
        readonly profile: SketchWireProfileRef;
        readonly entityId?: never;
        readonly profileKind?: never;
      }
  );

export interface CadHoleFeatureSource {
  readonly type: "sketchCircleHole";
  readonly sketchId: SketchId;
  readonly circleEntityId: SketchEntityId;
  readonly targetBodyId: BodyId;
  readonly targetTopologyAnchorId?: string;
}

export interface CadHoleFeatureSummary {
  readonly id: FeatureId;
  readonly kind: "hole";
  readonly partId: PartId;
  readonly bodyId: BodyId;
  readonly targetBodyId: BodyId;
  readonly targetTopologyAnchorId?: string;
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
  readonly topologyAnchorId?: string;
}

export interface CadChamferFeatureSummary {
  readonly id: FeatureId;
  readonly kind: "chamfer";
  readonly partId: PartId;
  readonly bodyId: BodyId;
  readonly targetBodyId: BodyId;
  readonly edgeStableId?: string;
  readonly namedReference?: NamedReferenceName;
  readonly topologyAnchorId?: string;
  readonly distance: number;
  readonly name?: string;
  readonly source: CadChamferFeatureSource;
}

export interface CadFilletFeatureSource {
  readonly type: "generatedEdgeFillet";
  readonly targetBodyId: BodyId;
  readonly edgeStableId?: string;
  readonly namedReference?: NamedReferenceName;
  readonly topologyAnchorId?: string;
}

export interface CadFilletFeatureSummary {
  readonly id: FeatureId;
  readonly kind: "fillet";
  readonly partId: PartId;
  readonly bodyId: BodyId;
  readonly targetBodyId: BodyId;
  readonly edgeStableId?: string;
  readonly namedReference?: NamedReferenceName;
  readonly topologyAnchorId?: string;
  readonly radius: number;
  readonly name?: string;
  readonly source: CadFilletFeatureSource;
}

export interface CadImportedBodyFeatureSource {
  readonly type: "importedStepBody";
  readonly sourceFileName: string;
  readonly checkpointId: string;
}

export interface CadImportedBodyFeatureSummary {
  readonly id: FeatureId;
  readonly kind: "importedBody";
  readonly partId: PartId;
  readonly bodyId: BodyId;
  readonly name?: string;
  readonly sourceFileName: string;
  readonly sourceFormat: "step";
  readonly checkpointId: string;
  readonly healingApplied: boolean;
  readonly source: CadImportedBodyFeatureSource;
}

export interface CadLinearPatternFeatureSource {
  readonly type: "linearPatternFeature";
  readonly seedBodyId: BodyId;
  readonly direction: PatternDirectionRef;
}

export interface CadLinearPatternFeatureSummary {
  readonly id: FeatureId;
  readonly kind: "linearPattern";
  readonly partId: PartId;
  readonly bodyId: BodyId;
  readonly seedBodyId: BodyId;
  readonly direction: PatternDirectionRef;
  readonly spacing: number;
  readonly instanceCount: number;
  readonly instances: readonly PatternInstanceRecord[];
  readonly name?: string;
  readonly source: CadLinearPatternFeatureSource;
}

export interface CadCircularPatternFeatureSource {
  readonly type: "circularPatternFeature";
  readonly seedBodyId: BodyId;
  readonly rotationAxis: PatternRotationAxisRef;
}

export interface CadCircularPatternFeatureSummary {
  readonly id: FeatureId;
  readonly kind: "circularPattern";
  readonly partId: PartId;
  readonly bodyId: BodyId;
  readonly seedBodyId: BodyId;
  readonly rotationAxis: PatternRotationAxisRef;
  readonly totalAngleDegrees: number;
  readonly instanceCount: number;
  readonly instances: readonly PatternInstanceRecord[];
  readonly name?: string;
  readonly source: CadCircularPatternFeatureSource;
}

export interface CadMirrorFeatureSource {
  readonly type: "mirrorFeature";
  readonly seedBodyId: BodyId;
  readonly plane: MirrorPlaneRef;
}

export interface CadMirrorFeatureSummary {
  readonly id: FeatureId;
  readonly kind: "mirror";
  readonly partId: PartId;
  readonly bodyId: BodyId;
  readonly seedBodyId: BodyId;
  readonly plane: MirrorPlaneRef;
  readonly includeOriginal: boolean;
  readonly name?: string;
  readonly source: CadMirrorFeatureSource;
}

export interface CadShellFeatureSource {
  readonly type: "shellFeature";
  readonly targetBodyId: BodyId;
}

export interface CadShellFeatureSummary {
  readonly id: FeatureId;
  readonly kind: "shell";
  readonly partId: PartId;
  readonly bodyId: BodyId;
  readonly targetBodyId: BodyId;
  readonly wallThickness: number;
  readonly openFaceRefs: readonly FeatureShellOpenFaceRef[];
  readonly name?: string;
  readonly source: CadShellFeatureSource;
}

export interface CadSweepFeatureSource {
  readonly type: "sweepFeature";
  /** Normalized V21 source, including ordered traversal orientation. */
  readonly profile: SketchEntityProfileRef;
  readonly path: SketchPathRef;
  /** V20-compatible flattened source fields. */
  readonly profileSketchId: SketchId;
  readonly profileEntityId: SketchEntityId;
  readonly pathSketchId: SketchId;
  readonly pathEntityIds: readonly SketchEntityId[];
}

export interface CadSweepFeatureSummary extends SweepFeatureV21 {
  readonly partId: PartId;
  /** V20-compatible flattened source fields. */
  readonly profileSketchId: SketchId;
  readonly profileEntityId: SketchEntityId;
  readonly pathSketchId: SketchId;
  readonly pathEntityIds: readonly SketchEntityId[];
  readonly source: CadSweepFeatureSource;
}

export interface CadLoftFeatureSource {
  readonly type: "loftFeature";
  readonly sections: readonly LoftSection[];
}

export interface CadLoftFeatureSummary extends LoftFeatureSnapshot {
  readonly partId: PartId;
  readonly source: CadLoftFeatureSource;
}

export type CadFeatureSummary =
  | CadPrimitiveFeatureSummary
  | CadExtrudeFeatureSummary
  | CadRevolveFeatureSummary
  | CadHoleFeatureSummary
  | CadChamferFeatureSummary
  | CadFilletFeatureSummary
  | CadImportedBodyFeatureSummary
  | CadLinearPatternFeatureSummary
  | CadCircularPatternFeatureSummary
  | CadMirrorFeatureSummary
  | CadShellFeatureSummary
  | CadSweepFeatureSummary
  | CadLoftFeatureSummary;

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
  readonly profile?: SketchProfileRef;
  readonly depth?: number;
  readonly side?: FeatureExtrudeSide;
}

export interface CadFeatureRevolveEditProposal {
  readonly kind: "revolve";
  readonly profile?: SketchProfileRef;
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

export interface CadFeatureShellEditProposal {
  readonly kind: "shell";
  readonly wallThickness?: number;
  readonly openFaceRefs?: readonly FeatureShellOpenFaceRef[];
}

export interface CadFeatureSweepEditProposal {
  readonly kind: "sweep";
  readonly profile?: SketchEntityProfileRef;
  readonly path?: SketchPathRef;
  /** V20-compatible proposal fields. */
  readonly profileSketchId?: SketchId;
  readonly profileEntityId?: SketchEntityId;
  readonly pathSketchId?: SketchId;
  readonly pathEntityIds?: readonly SketchEntityId[];
}

export interface CadFeatureLoftEditProposal {
  readonly kind: "loft";
  readonly sections?: readonly LoftSection[];
}

export type CadFeatureEditProposal =
  | CadFeatureExtrudeEditProposal
  | CadFeatureRevolveEditProposal
  | CadFeatureHoleEditProposal
  | CadFeatureChamferEditProposal
  | CadFeatureFilletEditProposal
  | CadFeatureShellEditProposal
  | CadFeatureSweepEditProposal
  | CadFeatureLoftEditProposal;

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
  readonly topologyAnchorId?: string;
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
  readonly topologyAnchorId?: string;
  readonly checkpointId?: string;
  readonly matchConfidence?: CadTopologyMatchConfidence;
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
  readonly topologyAnchorCount?: number;
  readonly topologyMatchCount?: number;
  readonly topologyMatchStates?: readonly CadTopologyIdentityState[];
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

export interface CadSketchEntityUpdateEditProposal extends Omit<
  SketchUpdateEntityOp,
  "op"
> {
  readonly editKind: "sketch.updateEntity";
}

export interface CadSketchEntityConstructionEditProposal extends Omit<
  SketchSetEntityConstructionOp,
  "op"
> {
  readonly editKind: "sketch.setEntityConstruction";
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
  | CadSketchEntityUpdateEditProposal
  | CadSketchEntityConstructionEditProposal
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
  | "SKETCH_SOLVER_PROFILE_VALID"
  | "SKETCH_TANGENCY_OUTSIDE_ARC"
  | "SKETCH_ARC_SOLVE_BRANCH_INVALID"
  | "SKETCH_ARC_DIMENSION_INVALID";

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

interface CadSketchSolverPointTargetReferenceBase {
  readonly type: "point";
  readonly sketchId: SketchId;
}

export type CadSketchSolverPointTargetReference =
  CadSketchSolverPointTargetReferenceBase & SketchPointTarget;

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

export type CadSketchSolverDeferredConstraintKind = "distance";

export interface CadSketchSolverEntitySummary {
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
  readonly entityKind: SketchEntityKind;
  readonly construction: boolean;
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
  readonly supportedByNumericalSolver: boolean;
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
  readonly construction: boolean;
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
  readonly numericalSolverModelVersion?:
    | "partbench.sketch-solver.v1"
    | "partbench.sketch-solver.v2";
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
  | "REFERENCE_TOPOLOGY_CHECKPOINT_MISSING"
  | "REFERENCE_TOPOLOGY_MATCH_REPLACED"
  | "REFERENCE_TOPOLOGY_MATCH_REPAIR_NEEDED"
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
  | "namedReference"
  | "topologyAnchor";

export type CadDependencyGraphEdgeKind =
  | "contains"
  | "sources"
  | "produces"
  | "targets"
  | "consumes"
  | "generates"
  | "anchors"
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
  readonly topologyAnchorId?: string;
  readonly checkpointId?: string;
  readonly referenceName?: NamedReferenceName;
  readonly generatedReferenceKind?: CadGeneratedEntityKind;
  readonly topologyEntityKind?: CadTopologyAnchorEntityKind;
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
  readonly topologyAnchorId?: string;
  readonly checkpointId?: string;
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
  readonly topologyAnchorId?: string;
  readonly checkpointId?: string;
  readonly referenceName?: NamedReferenceName;
  readonly expected?: string;
  readonly received?: string;
}

export type CadReferenceHealthTarget =
  | CadReferenceHealthAllTarget
  | CadReferenceHealthBodyTarget
  | CadReferenceHealthGeneratedReferenceTarget
  | CadReferenceHealthNamedReferenceTarget
  | CadReferenceHealthTopologyAnchorTarget;

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

export interface CadReferenceHealthTopologyAnchorTarget {
  readonly type: "topologyAnchor";
  readonly anchorId: string;
}

export interface CadReferenceHealthDependencies {
  readonly sketchIds: readonly SketchId[];
  readonly sketchEntityIds: readonly SketchEntityId[];
  readonly featureIds: readonly FeatureId[];
  readonly bodyIds: readonly BodyId[];
  readonly generatedReferenceStableIds: readonly string[];
  readonly namedReferenceNames: readonly NamedReferenceName[];
  readonly topologyAnchorIds?: readonly string[];
  readonly checkpointIds?: readonly string[];
}

export type CadReferenceHealthSource =
  | "body"
  | "generatedReference"
  | "namedReference"
  | "topologyAnchor";

export interface CadReferenceHealthEntry {
  readonly source: CadReferenceHealthSource;
  readonly status: CadReferenceHealthStatus;
  readonly commandable: boolean;
  readonly commandOperations: readonly CadSelectionReferenceOperation[];
  readonly label: string;
  readonly bodyId?: BodyId;
  readonly stableId?: string;
  readonly kind?: CadGeneratedEntityKind;
  readonly topologyAnchorId?: string;
  readonly topologyEntityKind?: CadTopologyAnchorEntityKind;
  readonly checkpointId?: string;
  readonly matchConfidence?: CadTopologyMatchConfidence;
  readonly matchState?: CadTopologyIdentityState;
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

interface CadSketchExtrudeBodySourceBase {
  readonly type: "sketchExtrudeFeature";
  readonly featureId: FeatureId;
  readonly sketchId: SketchId;
}

export type CadSketchExtrudeBodySource = CadSketchExtrudeBodySourceBase &
  (
    | {
        readonly entityId: SketchEntityId;
        readonly profileKind: FeatureExtrudeProfileKind;
        readonly profile?: never;
      }
    | {
        readonly profile: SketchWireProfileRef;
        readonly entityId?: never;
        readonly profileKind?: never;
      }
  );

interface CadSketchRevolveBodySourceBase {
  readonly type: "sketchRevolveFeature";
  readonly featureId: FeatureId;
  readonly sketchId: SketchId;
  readonly axis: FeatureRevolveAxis;
}

export type CadSketchRevolveBodySource = CadSketchRevolveBodySourceBase &
  (
    | {
        readonly entityId: SketchEntityId;
        readonly profileKind: FeatureRevolveProfileKind;
        readonly profile?: never;
      }
    | {
        readonly profile: SketchWireProfileRef;
        readonly entityId?: never;
        readonly profileKind?: never;
      }
  );

export interface CadSketchHoleBodySource {
  readonly type: "sketchHoleFeature";
  readonly featureId: FeatureId;
  readonly targetBodyId: BodyId;
  readonly targetTopologyAnchorId?: string;
  readonly sketchId: SketchId;
  readonly circleEntityId: SketchEntityId;
}

export interface CadChamferBodySource {
  readonly type: "edgeChamferFeature";
  readonly featureId: FeatureId;
  readonly targetBodyId: BodyId;
  readonly edgeStableId?: string;
  readonly namedReference?: NamedReferenceName;
  readonly topologyAnchorId?: string;
}

export interface CadFilletBodySource {
  readonly type: "edgeFilletFeature";
  readonly featureId: FeatureId;
  readonly targetBodyId: BodyId;
  readonly edgeStableId?: string;
  readonly namedReference?: NamedReferenceName;
  readonly topologyAnchorId?: string;
}

export interface CadLinearPatternBodySource {
  readonly type: "linearPatternFeature";
  readonly featureId: FeatureId;
  readonly seedBodyId: BodyId;
  readonly direction: PatternDirectionRef;
  readonly spacing: number;
  readonly instanceCount: number;
  readonly instances: readonly PatternInstanceRecord[];
}

export interface CadCircularPatternBodySource {
  readonly type: "circularPatternFeature";
  readonly featureId: FeatureId;
  readonly seedBodyId: BodyId;
  readonly rotationAxis: PatternRotationAxisRef;
  readonly totalAngleDegrees: number;
  readonly instanceCount: number;
  readonly instances: readonly PatternInstanceRecord[];
}

export interface CadMirrorBodySource {
  readonly type: "mirrorFeature";
  readonly featureId: FeatureId;
  readonly seedBodyId: BodyId;
  readonly plane: MirrorPlaneRef;
  readonly includeOriginal: boolean;
}

export interface CadShellBodySource {
  readonly type: "shellFeature";
  readonly featureId: FeatureId;
  readonly targetBodyId: BodyId;
  readonly wallThickness: number;
  readonly openFaceRefs: readonly FeatureShellOpenFaceRef[];
}

export interface CadSweepBodySource {
  readonly type: "sweepFeature";
  readonly featureId: FeatureId;
  /** Normalized V21 source, including ordered traversal orientation. */
  readonly profile: SketchEntityProfileRef;
  readonly path: SketchPathRef;
  /** V20-compatible flattened source fields. */
  readonly profileSketchId: SketchId;
  readonly profileEntityId: SketchEntityId;
  readonly pathSketchId: SketchId;
  readonly pathEntityIds: readonly SketchEntityId[];
}

export interface CadLoftBodySource {
  readonly type: "loftFeature";
  readonly featureId: FeatureId;
  readonly sections: readonly LoftSection[];
}

export type CadBodySource =
  | CadPrimitiveBodySource
  | CadSketchExtrudeBodySource
  | CadSketchRevolveBodySource
  | CadSketchHoleBodySource
  | CadChamferBodySource
  | CadFilletBodySource
  | CadLinearPatternBodySource
  | CadCircularPatternBodySource
  | CadMirrorBodySource
  | CadShellBodySource
  | CadSweepBodySource
  | CadLoftBodySource
  | CadImportedBodySource;

export interface CadImportedBodySource {
  readonly type: "importedStepBody";
  readonly featureId: FeatureId;
  readonly sourceFileName: string;
  readonly checkpointId: string;
}

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

export type CadTopologyEntityKind =
  | CadGeneratedEntityKind
  | "loop"
  | "wire"
  | "coedge";

export type CadTopologyAnchorEntityKind = Extract<
  CadTopologyEntityKind,
  "body" | "face" | "edge" | "vertex" | "axis"
>;

export type CadTopologyIdentityCapabilityId =
  | "protocolVocabulary"
  | "snapshotExtraction"
  | "anchorPersistence"
  | "checkpointPersistence"
  | "matchingEngine"
  | "repairCommands"
  | "commandEligibility"
  | "v18SourceContract"
  | "wcadV2Package";

export type CadTopologyIdentityDiagnosticCode =
  | "TOPOLOGY_IDENTITY_CONTRACT_READY"
  | "TOPOLOGY_PUBLIC_ID_BOUNDARY_ENFORCED"
  | "TOPOLOGY_SNAPSHOT_EXTRACTION_READY"
  | "TOPOLOGY_SNAPSHOT_EXTRACTION_DEFERRED"
  | "TOPOLOGY_ANCHOR_PERSISTENCE_DEFERRED"
  | "TOPOLOGY_ANCHOR_PERSISTENCE_READY"
  | "TOPOLOGY_CHECKPOINT_PERSISTENCE_READY"
  | "TOPOLOGY_CHECKPOINT_PERSISTENCE_DEFERRED"
  | "TOPOLOGY_MATCHING_ENGINE_DEFERRED"
  | "TOPOLOGY_REPAIR_COMMANDS_DEFERRED"
  | "TOPOLOGY_REPAIR_COMMANDS_READY"
  | "TOPOLOGY_COMMAND_ELIGIBILITY_DEFERRED"
  | "TOPOLOGY_COMMAND_ELIGIBILITY_READY"
  | "TOPOLOGY_SOURCE_CONTRACT_READY"
  | "TOPOLOGY_SOURCE_CONTRACT_INVALID"
  | "TOPOLOGY_PACKAGE_V2_CONTRACT_READY"
  | "TOPOLOGY_PACKAGE_V2_CHECKPOINT_INVALID"
  | "TOPOLOGY_SCHEMA_V18_DEFERRED"
  | "TOPOLOGY_PACKAGE_V2_DEFERRED"
  | "TOPOLOGY_MATCH_EXACT"
  | "TOPOLOGY_MATCH_REPLACED"
  | "TOPOLOGY_MATCH_SPLIT"
  | "TOPOLOGY_MATCH_MERGED"
  | "TOPOLOGY_MATCH_AMBIGUOUS"
  | "TOPOLOGY_MATCH_DELETED"
  | "TOPOLOGY_MATCH_LOW_CONFIDENCE"
  | "TOPOLOGY_MATCH_KIND_MISMATCH"
  | "TOPOLOGY_MATCH_UNSUPPORTED"
  | "TOPOLOGY_MATCHING_ENGINE_READY"
  | "TOPOLOGY_ENTITY_MISSING"
  | "TOPOLOGY_ENTITY_KIND_MISMATCH"
  | "TOPOLOGY_SNAPSHOT_INVALID"
  | "TOPOLOGY_COMMAND_NOT_ELIGIBLE";

export type CadTopologyIdentityState =
  | "active"
  | "replaced"
  | "split"
  | "merged"
  | "consumed"
  | "deleted"
  | "ambiguous"
  | "stale"
  | "missing"
  | "repair-needed"
  | "unsupported"
  | "failed"
  | "deferred";

export type CadTopologyMatchConfidence =
  | "none"
  | "low"
  | "medium"
  | "high"
  | "exact";

export type CadTopologyMatchEvidenceKind =
  | "sourceLineage"
  | "checkpointSourceIdentity"
  | "entityKind"
  | "surfaceType"
  | "curveType"
  | "orientation"
  | "loopRole"
  | "relationship"
  | "geometrySignature"
  | "bounds"
  | "centroid"
  | "point"
  | "midpoint"
  | "normal"
  | "axis"
  | "radius"
  | "area"
  | "length"
  | "adjacency"
  | "neighborAnchors"
  | "kernelChangeHint"
  | "sourceSemanticRole";

export interface CadTopologyIdentityDiagnostic {
  readonly code: CadTopologyIdentityDiagnosticCode;
  readonly status: WcadReadinessStatus;
  readonly severity: "info" | "warning" | "error";
  readonly message: string;
  readonly entityKind?: CadTopologyEntityKind;
  readonly bodyId?: BodyId;
  readonly featureId?: FeatureId;
  readonly checkpointId?: string;
  readonly anchorId?: string;
  readonly expected?: string;
  readonly received?: string;
}

export interface CadTopologySnapshotDescriptor {
  readonly snapshotId?: string;
  readonly checkpointId?: string;
  readonly bodyId: BodyId;
  readonly sourceFeatureId?: FeatureId;
  readonly sourceIdentity?: WcadSourceIdentity;
  readonly entityKinds: readonly CadTopologyEntityKind[];
  readonly entityCount?: number;
  readonly status: CadTopologyIdentityState;
  readonly diagnostics: readonly CadTopologyIdentityDiagnostic[];
}

export type CadTopologyGeneratedReferenceCandidateStatus =
  | "bound"
  | "candidate"
  | "missing"
  | "unsupported"
  | "ambiguous";

export interface CadTopologyGeneratedReferenceCandidate {
  readonly stableId: string;
  readonly kind: CadGeneratedEntityKind;
  readonly bodyId: BodyId;
  readonly sourceFeatureId?: FeatureId;
  readonly checkpointId?: string;
  readonly checkpointEntityId?: string;
  readonly status: CadTopologyGeneratedReferenceCandidateStatus;
  readonly confidence: CadTopologyMatchConfidence;
  readonly sourceSemanticRole?: string;
  readonly geometrySignature?: string;
  readonly diagnosticCount: number;
  readonly diagnostics: readonly CadTopologyIdentityDiagnostic[];
}

export interface CadTopologyAnchorDescriptor {
  readonly anchorId: string;
  readonly entityKind: CadTopologyAnchorEntityKind;
  readonly bodyId?: BodyId;
  readonly sourceFeatureId?: FeatureId;
  readonly stableId?: string;
  readonly sourceSemanticRole?: string;
  readonly checkpointId?: string;
  readonly signatureHash?: string;
  readonly state: CadTopologyIdentityState;
  readonly diagnostics: readonly CadTopologyIdentityDiagnostic[];
}

export interface CadTopologyCheckpointMetadata {
  readonly checkpointId: string;
  readonly bodyId: BodyId;
  readonly sourceIdentity: WcadSourceIdentity;
  readonly projectSchemaVersion: CadTopologyIdentityProjectSchemaVersion;
  readonly packageVersion: CadTopologyIdentityPackageVersion;
  readonly brepEntryId: string;
  readonly topologyEntryId: string;
  readonly signatureEntryId: string;
  readonly byteLength?: number;
  readonly sha256?: string;
  readonly status: CadTopologyIdentityState;
  readonly diagnostics: readonly CadTopologyIdentityDiagnostic[];
}

export type CadTopologyMatchEvidenceValue =
  | string
  | number
  | readonly number[]
  | readonly string[];

export interface CadTopologyMatchEvidence {
  readonly kind: CadTopologyMatchEvidenceKind;
  readonly confidence: CadTopologyMatchConfidence;
  readonly message: string;
  readonly weight?: number;
  readonly previousValue?: CadTopologyMatchEvidenceValue;
  readonly candidateValue?: CadTopologyMatchEvidenceValue;
}

export interface CadTopologyMatchResult {
  readonly anchorId?: string;
  readonly previousStableId?: string;
  readonly candidateStableId?: string;
  readonly previousCheckpointId?: string;
  readonly candidateCheckpointId?: string;
  readonly previousCheckpointEntityId?: string;
  readonly candidateCheckpointEntityId?: string;
  readonly entityKind: CadTopologyEntityKind;
  readonly state: CadTopologyIdentityState;
  readonly confidence: CadTopologyMatchConfidence;
  readonly confidenceScore?: number;
  readonly evidenceCount: number;
  readonly evidence: readonly CadTopologyMatchEvidence[];
  readonly diagnosticCount: number;
  readonly diagnostics: readonly CadTopologyIdentityDiagnostic[];
}

export type CadTopologyRepairCandidateTarget =
  | {
      readonly type: "topologyAnchor";
      readonly anchorId: string;
    }
  | {
      readonly type: "generatedReference";
      readonly bodyId: BodyId;
      readonly stableId: string;
      readonly kind: CadTopologyAnchorEntityKind;
    }
  | {
      readonly type: "topologyMatch";
      readonly previousCheckpointId?: string;
      readonly previousSnapshotId?: string;
      readonly entityKind: CadTopologyAnchorEntityKind;
    };

export interface CadTopologyRepairCheckpointEvidence {
  readonly checkpointId?: string;
  readonly checkpointEntityId: string;
  readonly idScope: "checkpoint-local";
  readonly publicStableId: false;
}

export interface CadTopologyRepairCandidate {
  readonly candidateId: string;
  readonly anchorId?: string;
  readonly target: CadTopologyRepairCandidateTarget;
  readonly previousCheckpointEvidence?: CadTopologyRepairCheckpointEvidence;
  readonly candidateCheckpointEvidence?: CadTopologyRepairCheckpointEvidence;
  readonly entityKind: CadTopologyAnchorEntityKind;
  readonly state: Extract<
    CadTopologyIdentityState,
    "replaced" | "split" | "merged" | "ambiguous" | "repair-needed" | "deleted"
  >;
  readonly confidence: CadTopologyMatchConfidence;
  readonly confidenceScore?: number;
  readonly canAutoRetarget: false;
  readonly recommendedAction:
    | "inspect"
    | "manual-repair-plan"
    | "not-repairable";
  readonly evidence: readonly CadTopologyMatchEvidence[];
  readonly diagnostics: readonly CadTopologyIdentityDiagnostic[];
}

export interface CadTopologyIdentitySettingsSnapshot {
  readonly contractVersion: CadTopologyIdentityContractVersion;
  readonly matchingPolicy: "evidence-scored-explicit-repair";
  readonly checkpointPolicy: "required-for-topology-anchors";
  readonly minimumAutomaticConfidence: Extract<
    CadTopologyMatchConfidence,
    "high" | "exact"
  >;
  readonly allowSilentRetargeting: false;
}

export interface CadTopologyCheckpointSourceRecord {
  readonly checkpointId: string;
  readonly bodyId: BodyId;
  readonly sourceFeatureId?: FeatureId;
  readonly sourceIdentity: WcadSourceIdentity;
  readonly packageVersion: CadTopologyIdentityPackageVersion;
  readonly projectSchemaVersion: CadTopologyIdentityProjectSchemaVersion;
  readonly brepEntryPath: string;
  readonly topologyEntryPath: string;
  readonly signatureEntryPath: string;
  readonly status: Extract<
    CadTopologyIdentityState,
    "active" | "stale" | "missing" | "failed" | "unsupported"
  >;
  readonly diagnostics: readonly CadTopologyIdentityDiagnostic[];
}

export interface CadTopologyAnchorSourceRecord {
  readonly anchorId: string;
  readonly entityKind: CadTopologyAnchorEntityKind;
  readonly bodyId: BodyId;
  readonly checkpointId: string;
  readonly checkpointEntityId: string;
  readonly sourceFeatureId?: FeatureId;
  readonly stableId?: string;
  readonly sourceSemanticRole?: string;
  readonly signatureHash?: string;
  readonly state: CadTopologyIdentityState;
  readonly diagnostics: readonly CadTopologyIdentityDiagnostic[];
}

export interface CadTopologyRepairSourceRecord {
  readonly repairId: string;
  readonly anchorId: string;
  readonly previousCheckpointId: string;
  readonly replacementCheckpointId: string;
  readonly replacementCheckpointEntityId: string;
  readonly confidence: CadTopologyMatchConfidence;
  readonly evidence: readonly CadTopologyMatchEvidence[];
  readonly diagnostics: readonly CadTopologyIdentityDiagnostic[];
}

export interface CadTopologyIdentitySourceSnapshot {
  readonly schemaVersion: CadTopologyIdentityProjectSchemaVersion;
  readonly settings: CadTopologyIdentitySettingsSnapshot;
  readonly checkpoints: readonly CadTopologyCheckpointSourceRecord[];
  readonly anchors: readonly CadTopologyAnchorSourceRecord[];
  readonly repairs: readonly CadTopologyRepairSourceRecord[];
}

export interface CadTopologyIdentityCapabilityReadiness {
  readonly capability: CadTopologyIdentityCapabilityId;
  readonly label: string;
  readonly status: WcadReadinessStatus;
  readonly available: boolean;
  readonly sourceBoundaryNote: string;
  readonly derivedBoundaryNote: string;
  readonly diagnostics: readonly CadTopologyIdentityDiagnostic[];
}

export type CadGeneratedExtrudeFaceRole =
  | "startCap"
  | "endCap"
  | "side:uMin"
  | "side:uMax"
  | "side:vMin"
  | "side:vMax"
  | "side:circular"
  | `side:segment:${SketchEntityId}`;

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
  | "end:circular"
  | `start:segment:${SketchEntityId}`
  | `end:segment:${SketchEntityId}`
  | `longitudinal:join:${SketchEntityId}:${SketchEntityId}`;

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
  | "end:uMax:vMax"
  | `start:join:${SketchEntityId}:${SketchEntityId}`
  | `end:join:${SketchEntityId}:${SketchEntityId}`;

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
  | "feature.shell"
  | "feature.linearPatternDirection"
  | "feature.circularPatternAxis"
  | "feature.mirrorPlane"
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

export type CadGeneratedReferenceProfileKind =
  | FeatureExtrudeProfileKind
  | "wire";

export type CadBodyGeneratedReferenceFaceEvidence =
  | {
      readonly role: "startCap" | "endCap";
      readonly sourceEntityId?: never;
      readonly surfaceClass: "plane";
      readonly evidence: "kernel-builder";
    }
  | {
      readonly role: "side";
      readonly sourceEntityId: SketchEntityId;
      readonly surfaceClass: "plane" | "cylinder";
      readonly evidence: "kernel-builder";
    };

export type CadBodyGeneratedReferenceEdgeEvidence =
  | {
      readonly role: "startCapBoundary" | "endCapBoundary";
      readonly sourceEntityId: SketchEntityId;
      readonly adjacentSourceEntityIds?: never;
      readonly evidence: "kernel-builder";
    }
  | {
      readonly role: "longitudinal";
      readonly sourceEntityId?: never;
      readonly adjacentSourceEntityIds: readonly [
        SketchEntityId,
        SketchEntityId
      ];
      readonly evidence: "kernel-builder";
    };

interface CadBodyGeneratedReferenceEvidenceSnapshotBase {
  readonly bodyId: BodyId;
  readonly sourceIdentitySignature: string;
  readonly recipeIdentity?: string;
}

export type CadBodyGeneratedReferenceEvidenceSnapshot =
  | (CadBodyGeneratedReferenceEvidenceSnapshotBase & {
      readonly status: "ready";
      readonly faces: readonly CadBodyGeneratedReferenceFaceEvidence[];
      readonly edges: readonly CadBodyGeneratedReferenceEdgeEvidence[];
      readonly diagnostic?: never;
    })
  | (CadBodyGeneratedReferenceEvidenceSnapshotBase & {
      readonly status: "unavailable" | "ambiguous";
      readonly faces: readonly never[];
      readonly edges: readonly never[];
      readonly diagnostic: string;
    });

export interface CadGeneratedReferenceSignature {
  readonly sourceKind?: "extrude" | "revolve" | "hole";
  readonly targetBodyId?: BodyId;
  readonly targetTopologyAnchorId?: string;
  readonly profileKind: CadGeneratedReferenceProfileKind;
  readonly sketchPlane: SketchPlane;
  readonly extrudeOperationMode?: FeatureExtrudeOperationMode;
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

type CadGeneratedReferenceSketchSource =
  | {
      readonly sourceSketchEntityId: SketchEntityId;
      readonly sourceSketchEntityIds?: never;
    }
  | {
      readonly sourceSketchEntityId?: never;
      readonly sourceSketchEntityIds: readonly SketchEntityId[];
    };

interface CadGeneratedBodyReferenceBase {
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
  readonly profileKind: CadGeneratedReferenceProfileKind;
  readonly geometricSignature: CadGeneratedReferenceSignature;
}

export type CadGeneratedBodyReference = CadGeneratedBodyReferenceBase &
  CadGeneratedReferenceSketchSource;

interface CadGeneratedFaceReferenceBase {
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
  readonly role: CadGeneratedFaceRole;
  readonly geometricSignature: CadGeneratedReferenceSignature;
}

export type CadGeneratedFaceReference = CadGeneratedFaceReferenceBase &
  CadGeneratedReferenceSketchSource;

interface CadGeneratedEdgeReferenceBase {
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
  readonly role: CadGeneratedEdgeRole;
  readonly adjacentFaceRoles: readonly CadGeneratedFaceRole[];
  readonly geometricSignature: CadGeneratedReferenceSignature;
}

export type CadGeneratedEdgeReference = CadGeneratedEdgeReferenceBase &
  CadGeneratedReferenceSketchSource;

interface CadGeneratedVertexReferenceBase {
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
  readonly role: CadGeneratedExtrudeVertexRole;
  readonly adjacentFaceRoles: readonly CadGeneratedFaceRole[];
  readonly adjacentEdgeRoles: readonly CadGeneratedExtrudeEdgeRole[];
  readonly geometricSignature: CadGeneratedReferenceSignature;
}

export type CadGeneratedVertexReference = CadGeneratedVertexReferenceBase &
  CadGeneratedReferenceSketchSource;

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
  readonly topologyAnchorId?: string;
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
  | CadSelectionNamedReferenceInput
  | CadSelectionTopologyAnchorInput;

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

export interface CadSelectionTopologyAnchorInput {
  readonly type: "topologyAnchor";
  readonly anchorId: string;
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
  | "feature.extrudeCutTarget"
  | "feature.extrudeAddTarget"
  | "feature.holeTarget"
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
  | "IMPORTED_BODY_ANCHOR_NEEDED"
  | "SELECTION_KIND_MISMATCH";

export interface CadSelectionReferenceIssue {
  readonly code: CadSelectionReferenceIssueCode;
  readonly status: Exclude<CadSelectionReferenceStatus, "resolved">;
  readonly message: string;
  readonly bodyId?: BodyId;
  readonly stableId?: string;
  readonly topologyAnchorId?: string;
  readonly checkpointId?: string;
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
  readonly topologyAnchorId?: string;
  readonly checkpointId?: string;
  readonly referenceName?: NamedReferenceName;
}

export type CadSelectionReferenceCandidateSource =
  | "bodySelection"
  | "generatedReferenceSelection"
  | "namedReferenceSelection"
  | "topologyAnchorSelection";

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
  | "COMPOSITE_REVOLVE_PROFILE_UNSUPPORTED"
  | "COMPOSITE_REVOLVE_AXIS_INTERSECTION"
  | "GENERATED_REFERENCE_CORRESPONDENCE_UNPROVEN"
  | "STALE_BODY_TOPOLOGY"
  | "INVALID_EXACT_GEOMETRY_RESULT"
  | "EXACT_GEOMETRY_KERNEL_FAILED"
  | "EXACT_GEOMETRY_BINDING_UNAVAILABLE"
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
  readonly entityId?: SketchEntityId;
  readonly sourceEntityIds?: readonly SketchEntityId[];
  readonly profileKind: CadGeneratedReferenceProfileKind;
  readonly operationMode: FeatureExtrudeOperationMode;
  readonly targetBodyId?: BodyId;
  readonly targetTopologyAnchorId?: string;
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
  readonly entityId?: SketchEntityId;
  readonly sourceEntityIds?: readonly SketchEntityId[];
  readonly profileKind: CadGeneratedReferenceProfileKind;
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
  readonly targetTopologyAnchorId?: string;
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
  readonly topologyAnchorId?: string;
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
  readonly topologyAnchorId?: string;
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

export interface CadAuthoredShellHealth {
  readonly featureId: FeatureId;
  readonly bodyId: BodyId;
  readonly targetBodyId: BodyId;
  readonly wallThickness: number;
  readonly openFaceRefs: readonly FeatureShellOpenFaceRef[];
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
  readonly attachmentKind: SketchAttachmentSnapshot["kind"];
  readonly bodyId: BodyId;
  readonly faceStableId?: string;
  readonly sourceFeatureId?: FeatureId;
  readonly sourceSketchId?: SketchId;
  readonly sourceSketchEntityId?: SketchEntityId;
  readonly faceRole?: CadGeneratedExtrudeFaceRole;
  readonly topologyAnchorId?: string;
  readonly checkpointId?: string;
  readonly planarAxis?: "x" | "y" | "z";
  readonly planarCoordinate?: number;
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
  readonly topologyAnchorId?: string;
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
  readonly topologyAnchorId?: string;
  readonly checkpointId?: string;
  readonly checkpointEntityId?: string;
  readonly repairId?: string;
  readonly topologyEntityKind?: CadTopologyAnchorEntityKind;
  readonly confidence?: CadTopologyMatchConfidence;
  readonly operationMode?: FeatureExtrudeOperationMode;
  readonly targetBodyId?: BodyId;
  readonly targetTopologyAnchorId?: string;
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
  readonly packageVersion: "partbench.wcad.v1";
  readonly product: "Partbench";
  readonly createdBy: {
    readonly app: "partbench";
    readonly version?: string;
  };
  readonly createdAt: string;
  readonly modifiedAt: string;
  readonly units: DocumentUnits;
  readonly document: WcadPackageEntryMetadata & {
    readonly schemaVersion: WcadPackageV1DocumentSchemaVersion;
  };
  readonly commands: WcadPackageEntryMetadata;
  readonly sourceIdentity: WcadSourceIdentity;
  readonly cache?: WcadPackageCacheManifestMetadata;
  readonly thumbnail?: WcadPackageThumbnailMetadata;
}

export interface WcadTopologyCheckpointKernelMetadata {
  readonly boundary: "geometry-kernel" | "geometry-worker" | "occt-wasm";
  readonly packageName?: string;
  readonly packageVersion?: string;
  readonly snapshotAlgorithm: "partbench-derived-topology-snapshot-v1";
}

export interface WcadTopologyCheckpointToleranceMetadata {
  readonly linearTolerance: number;
  readonly angularToleranceDegrees?: number;
}

export interface WcadTopologyCheckpointPayloadEntry extends WcadPackageEntryMetadata {
  readonly checkpointId: string;
  readonly source: true;
  readonly sourceIdentity: WcadSourceIdentity;
}

export interface WcadTopologyCheckpointSignatureEntity {
  readonly localId: string;
  readonly kind: CadTopologyEntityKind | "solid";
  readonly signature: string;
}

export interface WcadTopologyCheckpointSignaturePayload {
  readonly checkpointId: string;
  readonly signatureAlgorithm: "partbench-derived-topology-snapshot-v1";
  readonly signature: string;
  readonly entityCount: number;
  readonly entities?: readonly WcadTopologyCheckpointSignatureEntity[];
}

export interface WcadTopologyCheckpointManifestEntry {
  readonly checkpointId: string;
  readonly bodyId: BodyId;
  readonly sourceFeatureId?: FeatureId;
  readonly sourceIdentity: WcadSourceIdentity;
  readonly units: DocumentUnits;
  readonly kernel: WcadTopologyCheckpointKernelMetadata;
  readonly tolerance: WcadTopologyCheckpointToleranceMetadata;
  readonly brep: WcadTopologyCheckpointPayloadEntry & {
    readonly path: string;
  };
  readonly topology: WcadTopologyCheckpointPayloadEntry & {
    readonly path: string;
  };
  readonly signature: WcadTopologyCheckpointPayloadEntry & {
    readonly path: string;
  };
}

export interface WcadTopologyIdentityManifestMetadata {
  readonly contractVersion: CadTopologyIdentityContractVersion;
  readonly projectSchemaVersion: CadTopologyIdentityProjectSchemaVersion;
  readonly checkpointCount: number;
  readonly checkpoints: readonly WcadTopologyCheckpointManifestEntry[];
  readonly jsonFallback:
    | "source-graph-only"
    | "checkpoint-metadata-only"
    | "lossless";
}

export interface WcadManifestV2 extends Omit<
  WcadManifestV1,
  "packageVersion" | "document" | "cache"
> {
  readonly packageVersion: CadTopologyIdentityPackageVersion;
  readonly document: WcadPackageEntryMetadata & {
    readonly schemaVersion: WcadDocumentSchemaVersion;
  };
  readonly topologyIdentity: WcadTopologyIdentityManifestMetadata;
  readonly cache?: WcadPackageCacheManifestMetadata;
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
  | "WCAD_MISSING_CHECKPOINT_ENTRY"
  | "WCAD_UNSUPPORTED_CHECKPOINT_ENTRY"
  | "WCAD_CHECKPOINT_SOURCE_IDENTITY_MISMATCH"
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
  | "GENERATED_REFERENCE_CORRESPONDENCE_UNPROVEN"
  | "UNSUPPORTED_BODY_MEASUREMENTS"
  | "UNSUPPORTED_BODY_PATTERN_INSTANCES"
  | "MASS_PROPERTIES_UNAVAILABLE"
  | "MASS_PROPERTIES_STALE"
  | "MASS_PROPERTIES_BODY_CONSUMED"
  | "MASS_PROPERTIES_INVALID_DENSITY"
  | "UNSUPPORTED_BODY_TOPOLOGY"
  | "STALE_BODY_TOPOLOGY"
  | "AMBIGUOUS_BODY_TOPOLOGY"
  | "EMPTY_EXACT_GEOMETRY_RESULT"
  | "INVALID_EXACT_GEOMETRY_RESULT"
  | "EXACT_GEOMETRY_KERNEL_FAILED"
  | "IMPORTED_BODY_CHECKPOINT_MISSING"
  | "IMPORTED_BODY_TOPOLOGY_UNAVAILABLE"
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
  readonly checkpointId?: string;
  readonly generatedReferencesStatus?: "unavailable" | "ambiguous";
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
  | "authoredShell"
  | "authoredLinearPattern"
  | "authoredCircularPattern"
  | "authoredMirror"
  | "authoredSweep"
  | "authoredLoft"
  | "importedBody"
  | "primitiveCompatibility";

export type CadBodyTopologyModel =
  | "none"
  | "semantic-source"
  | "kernel-derived";

export type CadBodyTopologyMeasurementConfidence =
  | "none"
  | "source-analytic"
  | "kernel-derived";

export type CadBooleanResultTopologyOperationMode = "add" | "cut";

export type CadBooleanResultTopologyStatus =
  | "unsupported"
  | "ambiguous"
  | "partial"
  | "ready";

export type CadBooleanResultTopologyDerivedExactValidationStatus =
  | "notProvided"
  | "available"
  | "stale"
  | "unsupported"
  | "failed"
  | "unavailable";

export type CadBooleanResultTopologyRoleEntityKind =
  | "body"
  | "face"
  | "edge"
  | "vertex";

export type CadBooleanResultTopologyRoleStatus =
  | "planned"
  | "unsupported"
  | "ambiguous"
  | "proven"
  | "command-ready";

export type CadBooleanResultTopologyRole =
  | "booleanResultBody"
  | "targetCarriedFace"
  | "targetModifiedFace"
  | "targetSplitFace"
  | "cutWallFace"
  | "cutStartRimEdge"
  | "cutTerminalFace"
  | "cutTerminalRimEdge"
  | "cutExitRimEdge"
  | "cutWallProfileEdge"
  | "addedWallFace"
  | "addedCapFace"
  | "addSeamEdge"
  | "addProfileEdge"
  | "targetCarriedEdge"
  | "targetSplitEdge"
  | "intersectionVertex";

export type CadBooleanResultTopologyDiagnosticCode =
  | "BOOLEAN_TOPOLOGY_MATCHING_DEFERRED"
  | "BOOLEAN_SOURCE_ROLE_DERIVATION_PARTIAL"
  | "BOOLEAN_ROLE_DERIVATION_DEFERRED"
  | "BOOLEAN_RESULT_REFERENCES_PARTIAL_COMMAND_READY"
  | "BOOLEAN_RESULT_REFERENCES_NOT_COMMAND_READY"
  | "BOOLEAN_EXACT_VALIDATION_NOT_PROVIDED"
  | "BOOLEAN_EXACT_VALIDATION_AVAILABLE"
  | "BOOLEAN_EXACT_VALIDATION_STALE"
  | "BOOLEAN_EXACT_VALIDATION_UNSUPPORTED"
  | "BOOLEAN_EXACT_VALIDATION_FAILED"
  | "BOOLEAN_EXACT_VALIDATION_UNAVAILABLE";

export interface CadBooleanResultTopologyDiagnostic {
  readonly code: CadBooleanResultTopologyDiagnosticCode;
  readonly severity: "info" | "warning" | "blocking";
  readonly message: string;
}

export interface CadBooleanResultTopologyRoleReadiness {
  readonly role: CadBooleanResultTopologyRole;
  readonly entityKind: CadBooleanResultTopologyRoleEntityKind;
  readonly status: CadBooleanResultTopologyRoleStatus;
  readonly commandReady: boolean;
  readonly roleStableId?: string;
  readonly label?: string;
  readonly sourceRole?: string;
  readonly message: string;
}

export interface CadBooleanResultTopologySourceInputs {
  readonly featureId: FeatureId;
  readonly resultBodyId: BodyId;
  readonly operationMode: CadBooleanResultTopologyOperationMode;
  readonly targetBodyId?: BodyId;
  readonly toolSketchId?: SketchId;
  readonly toolSketchEntityId?: SketchEntityId;
  readonly toolSketchEntityIds?: readonly SketchEntityId[];
  readonly toolProfileKind?: FeatureExtrudeProfileKind | "wire";
}

export interface CadBooleanResultTopologyReadiness {
  readonly contractVersion: "partbench.boolean-topology.v1";
  readonly status: CadBooleanResultTopologyStatus;
  readonly commandReady: boolean;
  readonly sourceSemanticsAvailable: boolean;
  readonly derivedExactValidationStatus: CadBooleanResultTopologyDerivedExactValidationStatus;
  readonly sourceInputs: CadBooleanResultTopologySourceInputs;
  readonly roleReadiness: readonly CadBooleanResultTopologyRoleReadiness[];
  readonly diagnostics: readonly CadBooleanResultTopologyDiagnostic[];
}

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
  readonly wireCount?: number;
  readonly edgeCount: number;
  readonly vertexCount: number;
}

export interface CadBodyExactTopologyEntityCounts extends Required<CadBodyExactMetadataTopologyCounts> {
  readonly bodyCount: number;
  readonly loopCount: number;
  readonly coedgeCount: number;
  readonly axisCount: number;
}

export type CadBodyExactTopologySnapshotStatus = "ready" | "partial";

export interface CadTopologyEntityBounds {
  readonly min: Vec3;
  readonly max: Vec3;
}

export type CadTopologySurfaceClass =
  | "plane"
  | "cylinder"
  | "cone"
  | "sphere"
  | "torus"
  | "bspline"
  | "unknown";

export type CadTopologyCurveClass =
  | "line"
  | "circle"
  | "ellipse"
  | "bspline"
  | "unknown";

export interface CadTopologyEntityAdjacencyEvidence {
  readonly available: boolean;
  readonly neighborSignatureHashes: readonly string[];
}

export type CadTopologyOrientation =
  | "forward"
  | "reversed"
  | "internal"
  | "external"
  | "unknown";

export type CadTopologyLoopRole = "outer" | "inner" | "unknown";

export interface CadTopologyEntityRelationshipEvidence {
  readonly parentFaceLocalId?: string;
  readonly parentWireLocalId?: string;
  readonly parentLoopLocalId?: string;
  readonly underlyingWireLocalId?: string;
  readonly underlyingEdgeLocalId?: string;
  readonly startVertexLocalId?: string;
  readonly endVertexLocalId?: string;
  readonly childWireLocalIds?: readonly string[];
  readonly childLoopLocalIds?: readonly string[];
  readonly childCoedgeLocalIds?: readonly string[];
  readonly childEdgeLocalIds?: readonly string[];
  readonly adjacentFaceLocalIds?: readonly string[];
}

export interface CadBodyExactTopologyEntityDescriptor {
  readonly localId: string;
  readonly kind: CadTopologyEntityKind | "solid";
  readonly source: "kernel-derived";
  readonly signature: string;
  readonly bounds?: CadTopologyEntityBounds;
  readonly surfaceClass?: CadTopologySurfaceClass;
  readonly curveClass?: CadTopologyCurveClass;
  readonly point?: Vec3;
  readonly midpoint?: Vec3;
  readonly normal?: Vec3;
  readonly axis?: Vec3;
  readonly radius?: number;
  readonly area?: number;
  readonly length?: number;
  readonly adjacency?: CadTopologyEntityAdjacencyEvidence;
  readonly orientation?: CadTopologyOrientation;
  readonly loopRole?: CadTopologyLoopRole;
  readonly relationships?: CadTopologyEntityRelationshipEvidence;
}

export interface CadBodyExactTopologySnapshot {
  readonly source: "kernel-derived";
  readonly status: CadBodyExactTopologySnapshotStatus;
  readonly entityCounts: CadBodyExactTopologyEntityCounts;
  readonly entityCount: number;
  readonly entities: readonly CadBodyExactTopologyEntityDescriptor[];
  readonly unsupportedEntityKinds: readonly CadTopologyEntityKind[];
  readonly adjacencyAvailable: boolean;
  readonly signatureAlgorithm: "partbench-derived-topology-snapshot-v1";
  readonly signature: string;
  readonly diagnostics: readonly CadBodyExactMetadataDiagnostic[];
}

export interface CadBodyExactMetadataSnapshot {
  readonly status: CadBodyExactMetadataStatus;
  readonly source: "kernel-derived";
  readonly confidence: "kernel-derived";
  readonly bounds?: CadAxisAlignedBounds;
  readonly volume?: number;
  readonly surfaceArea?: number;
  readonly centroid?: Vec3;
  readonly momentsOfInertia?: CadInertiaTensor;
  readonly principalMoments?: Vec3;
  readonly topologyCounts?: CadBodyExactMetadataTopologyCounts;
  readonly topologySnapshot?: CadBodyExactTopologySnapshot;
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
  readonly targetTopologyAnchorId?: string;
  readonly sourceSketchId?: SketchId;
  readonly sourceSketchEntityId?: SketchEntityId;
  readonly sourceSketchEntityIds?: readonly SketchEntityId[];
  readonly profileKind?: CadGeneratedReferenceProfileKind;
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
  readonly topologyAnchorId?: string;
  readonly chamferDistance?: number;
  readonly filletRadius?: number;
  readonly profileSignature?: CadGeneratedReferenceProfileSignature;
  readonly side?: FeatureExtrudeSide;
  readonly depth?: number;
  readonly featureSourceSignature?: string;
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
  readonly booleanTopology?: CadBooleanResultTopologyReadiness;
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
  | "authoredSweep"
  | "authoredHole"
  | "authoredChamfer"
  | "authoredFillet"
  | "authoredShell"
  | "importedBody"
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

interface CadExactExportExtrudeBodySourceBase {
  readonly bodyId: BodyId;
  readonly bodyName?: string;
  readonly sourceKind: "authoredExtrude";
  readonly featureId: FeatureId;
  readonly sourceSketchId: SketchId;
  readonly sketchPlane: SketchPlane;
  readonly depth: number;
  readonly side: FeatureExtrudeSide;
}

export type CadExactExportResolvedWireSegment =
  | {
      readonly kind: "line";
      readonly sourceEntityId: SketchEntityId;
      readonly start: Vec2;
      readonly end: Vec2;
    }
  | {
      readonly kind: "arc";
      readonly sourceEntityId: SketchEntityId;
      readonly center: Vec2;
      readonly radius: number;
      readonly startAngleDegrees: number;
      readonly sweepAngleDegrees: number;
    };

export interface CadExactExportResolvedWireProfile {
  readonly kind: "wire";
  readonly frame: {
    readonly origin: Vec3;
    readonly uAxis: Vec3;
    readonly vAxis: Vec3;
  };
  readonly closed: true;
  readonly segments: readonly CadExactExportResolvedWireSegment[];
  readonly sourceIdentity: string;
  readonly geometryPolicy: {
    readonly linearTolerance: number;
    readonly angularToleranceDegrees: number;
    readonly minimumProfileArea: number;
  };
}

export interface CadExactExportPrimitiveExtrudeSource {
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

export interface CadExactExportWireExtrudeSource {
  readonly sketchPlane: SketchPlane;
  readonly profile: CadExactExportResolvedWireProfile;
  readonly depth: number;
  readonly side: FeatureExtrudeSide;
  readonly placementFrame?: never;
}

export type CadExactExportBooleanSource =
  | CadExactExportPrimitiveExtrudeSource
  | CadExactExportBooleanResultSource;

export type CadExactExportBooleanResultSource =
  | {
      readonly kind: "booleanExtrudes";
      readonly operation: "add";
      readonly target: CadExactExportBooleanSource;
      readonly tool:
        | CadExactExportPrimitiveExtrudeSource
        | CadExactExportWireExtrudeSource;
    }
  | {
      readonly kind: "booleanExtrudes";
      readonly operation: "cut";
      readonly target: CadExactExportBooleanSource;
      readonly tool:
        | CadExactExportPrimitiveExtrudeSource
        | CadExactExportWireExtrudeSource;
    };

export type CadExactExportExtrudeBodySource =
  | (CadExactExportExtrudeBodySourceBase & {
      readonly sourceSketchEntityId: SketchEntityId;
      readonly sourceSketchEntityIds?: never;
      readonly placementFrame?: {
        readonly origin: Vec3;
        readonly uAxis: Vec3;
        readonly vAxis: Vec3;
      };
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
    })
  | (CadExactExportExtrudeBodySourceBase & {
      readonly sourceSketchEntityId?: never;
      readonly sourceSketchEntityIds: readonly SketchEntityId[];
      readonly profile: CadExactExportResolvedWireProfile;
      readonly placementFrame?: never;
    })
  | (CadExactExportExtrudeBodySourceBase &
      CadExactExportBooleanResultSource & {
        readonly operation: "add" | "cut";
        readonly sourceSketchEntityId?: never;
        readonly sourceSketchEntityIds: readonly SketchEntityId[];
        readonly targetBodyId: BodyId;
        readonly targetTopologyAnchorId?: string;
        readonly exactResultSourceIdentitySignature: string;
      });

export interface CadExactExportRevolveBodySource {
  readonly bodyId: BodyId;
  readonly bodyName?: string;
  readonly sourceKind: "authoredRevolve";
  readonly featureId: FeatureId;
  readonly sourceSketchId: SketchId;
  readonly sourceSketchEntityIds: readonly SketchEntityId[];
  readonly sketchPlane: SketchPlane;
  readonly profile: CadExactExportResolvedWireProfile;
  readonly axis: {
    readonly sourceEntityId: SketchEntityId;
    readonly start: Vec2;
    readonly end: Vec2;
  };
  readonly angleDegrees: number;
  readonly solidPolicy: "exactlyOne";
}

export interface CadExactExportResolvedSweepPath {
  readonly frame: {
    readonly origin: Vec3;
    readonly uAxis: Vec3;
    readonly vAxis: Vec3;
  };
  readonly closed: false;
  readonly segments: readonly CadExactExportResolvedWireSegment[];
  readonly sourceIdentity: string;
}

export interface CadExactExportSweepBodySource {
  readonly bodyId: BodyId;
  readonly bodyName?: string;
  readonly sourceKind: "authoredSweep";
  readonly featureId: FeatureId;
  readonly profileSketchId: SketchId;
  readonly profileEntityId: SketchEntityId;
  readonly pathSketchId: SketchId;
  readonly pathEntityIds: readonly SketchEntityId[];
  readonly profileFrame: {
    readonly origin: Vec3;
    readonly uAxis: Vec3;
    readonly vAxis: Vec3;
  };
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
  readonly path: CadExactExportResolvedSweepPath;
  readonly frameMode: "correctedFrenet";
  readonly solidPolicy: "exactlyOne";
}

export type CadExactExportBodySource =
  | CadExactExportExtrudeBodySource
  | CadExactExportRevolveBodySource
  | CadExactExportSweepBodySource;

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

export interface SketchBounds2d {
  readonly min: Vec2;
  readonly max: Vec2;
}

export interface SketchReferenceDependencies {
  readonly sketchIds: readonly SketchId[];
  /** Preserves traversal order; unlike dependency graph sets, this may not be sorted. */
  readonly orderedEntityIds: readonly SketchEntityId[];
}

export type SketchProfileDiagnosticCode =
  | "SKETCH_PROFILE_EMPTY"
  | "SKETCH_PROFILE_ENTITY_MISSING"
  | "SKETCH_PROFILE_ENTITY_UNSUPPORTED"
  | "SKETCH_PROFILE_CONSTRUCTION_ENTITY"
  | "SKETCH_PROFILE_ENTITY_REPEATED"
  | "SKETCH_PROFILE_DISCONNECTED"
  | "SKETCH_PROFILE_BRANCHING"
  | "SKETCH_PROFILE_OPEN"
  | "SKETCH_PROFILE_SELF_INTERSECTING"
  | "SKETCH_PROFILE_OVERLAPPING"
  | "SKETCH_PROFILE_AREA_TOO_SMALL"
  | "SKETCH_PROFILE_MULTIPLE_REGIONS_UNSUPPORTED"
  | "SKETCH_PROFILE_INNER_LOOP_UNSUPPORTED"
  | "SKETCH_PROFILE_ORIENTATION_NORMALIZED"
  | "SKETCH_PROFILE_CONSUMER_UNSUPPORTED"
  | "BODY_NOT_FOUND"
  | "UNSUPPORTED_BODY_REFERENCES"
  | "TOPOLOGY_ANCHOR_NOT_FOUND"
  | "INVALID_TOPOLOGY_ANCHOR"
  | "TARGET_BODY_REQUIRED"
  | "TARGET_BODY_NOT_SUPPORTED";

export type SketchPathDiagnosticCode =
  | "SKETCH_PATH_EMPTY"
  | "SKETCH_PATH_ENTITY_MISSING"
  | "SKETCH_PATH_ENTITY_UNSUPPORTED"
  | "SKETCH_PATH_ENTITY_REPEATED"
  | "SKETCH_PATH_DISCONNECTED"
  | "SKETCH_PATH_BRANCHING"
  | "SKETCH_PATH_CLOSED_UNSUPPORTED"
  | "SKETCH_PATH_SELF_INTERSECTING"
  | "SKETCH_PATH_JOIN_NOT_TANGENT"
  | "SKETCH_PATH_FRAME_INVALID";

export interface SketchProfileDiagnostic {
  readonly code: SketchProfileDiagnosticCode;
  readonly severity: CadFeatureEditDiagnosticSeverity;
  readonly message: string;
  readonly sketchId?: SketchId;
  readonly entityId?: SketchEntityId;
  readonly bodyId?: BodyId;
  readonly segmentIndex?: number;
  readonly joinIndex?: number;
  readonly expected?: string;
  readonly received?: string;
}

export interface SketchPathDiagnostic {
  readonly code: SketchPathDiagnosticCode;
  readonly severity: CadFeatureEditDiagnosticSeverity;
  readonly message: string;
  readonly sketchId?: SketchId;
  readonly entityId?: SketchEntityId;
  readonly segmentIndex?: number;
  readonly joinIndex?: number;
  readonly expected?: string;
  readonly received?: string;
}

export type SketchJoinConnectionStatus =
  | "exact"
  | "within-tolerance"
  | "disconnected";

export interface SketchProfileJoinHealth {
  readonly joinIndex: number;
  readonly primaryEntityId: SketchEntityId;
  readonly secondaryEntityId: SketchEntityId;
  readonly connectionStatus: SketchJoinConnectionStatus;
  readonly coincidentWithinTolerance: boolean;
  readonly gapDistance: number;
}

export type SketchPathJoinTangentStatus =
  | "tangent"
  | "not-tangent"
  | "not-evaluated";

export interface SketchPathJoinHealth extends SketchProfileJoinHealth {
  readonly tangentStatus: SketchPathJoinTangentStatus;
  readonly angularDeviationDegrees?: number;
}

export type SketchProfileIntersectionStatus =
  | "clear"
  | "self-intersecting"
  | "overlapping"
  | "not-evaluated";

export type SketchPathSelfIntersectionStatus =
  | "clear"
  | "self-intersecting"
  | "not-evaluated";

export type SketchPathFrameStatus = "ready" | "invalid" | "not-evaluated";

export interface SketchConstructionExclusion {
  readonly entityId: SketchEntityId;
  readonly entityKind: Extract<
    SketchEntityKind,
    "rectangle" | "circle" | "line" | "arc"
  >;
  readonly diagnostic: SketchProfileDiagnostic;
}

export interface SketchProfileCandidate {
  readonly status: "ready";
  readonly candidateIndex: number;
  readonly sortKey: string;
  readonly profile: SketchProfileRef;
  readonly orientation: "counterclockwise";
  readonly area: number;
  readonly signedArea: number;
  readonly bounds: SketchBounds2d;
  readonly joinCount: number;
  readonly joins: readonly SketchProfileJoinHealth[];
  readonly intersectionStatus: "clear";
  readonly dependencies: SketchReferenceDependencies;
  readonly diagnosticCount: number;
  readonly diagnostics: readonly SketchProfileDiagnostic[];
}

export interface SketchProfileRejectedComponent {
  readonly status: "blocked";
  readonly componentIndex: number;
  readonly sortKey: string;
  readonly sketchId: SketchId;
  readonly entityIds: readonly SketchEntityId[];
  readonly bounds?: SketchBounds2d;
  readonly closed: boolean;
  readonly branchFree: boolean;
  readonly intersectionStatus: SketchProfileIntersectionStatus;
  readonly area?: number;
  readonly joinCount: number;
  readonly joins: readonly SketchProfileJoinHealth[];
  readonly diagnosticCount: number;
  readonly diagnostics: readonly SketchProfileDiagnostic[];
}

export interface SketchPathCandidate {
  readonly status: "ready";
  readonly candidateIndex: number;
  readonly sortKey: string;
  readonly path: SketchPathRef;
  readonly length: number;
  readonly bounds: SketchBounds2d;
  readonly connectionStatus: "connected";
  readonly tangentStatus: "tangent";
  readonly selfIntersectionStatus: "clear";
  readonly joinCount: number;
  readonly joins: readonly SketchPathJoinHealth[];
  readonly dependencies: SketchReferenceDependencies;
  readonly diagnosticCount: number;
  readonly diagnostics: readonly SketchPathDiagnostic[];
}

export interface SketchPathRejectedComponent {
  readonly status: "blocked";
  readonly componentIndex: number;
  readonly sortKey: string;
  readonly sketchId: SketchId;
  readonly entityIds: readonly SketchEntityId[];
  readonly bounds?: SketchBounds2d;
  readonly connectionStatus: "connected" | "disconnected" | "branching";
  readonly tangentStatus: SketchPathJoinTangentStatus;
  readonly selfIntersectionStatus: SketchPathSelfIntersectionStatus;
  readonly joinCount: number;
  readonly joins: readonly SketchPathJoinHealth[];
  readonly diagnosticCount: number;
  readonly diagnostics: readonly SketchPathDiagnostic[];
}

export interface SketchConsumerCompatibility {
  readonly status: "ready" | "blocked";
  readonly featureKind: SketchProfileConsumerIntent["featureKind"];
  readonly operationMode: "newBody" | "add" | "cut";
  readonly diagnosticCount: number;
  readonly diagnostics: readonly SketchProfileDiagnostic[];
}

export type SketchProfileTargetCompatibility =
  | {
      readonly status: "not-applicable";
      readonly targetBodyId?: never;
      readonly targetTopologyAnchorId?: never;
      readonly diagnosticCount: 0;
      readonly diagnostics: readonly [];
    }
  | {
      readonly status: "missing";
      readonly targetBodyId?: never;
      readonly targetTopologyAnchorId?: never;
      readonly diagnosticCount: number;
      readonly diagnostics: readonly SketchProfileDiagnostic[];
    }
  | {
      readonly status: "ready" | "unsupported";
      readonly targetBodyId: BodyId;
      readonly targetTopologyAnchorId?: never;
      readonly diagnosticCount: number;
      readonly diagnostics: readonly SketchProfileDiagnostic[];
    }
  | {
      readonly status: "ready" | "unsupported";
      readonly targetBodyId: BodyId;
      readonly targetTopologyAnchorId: string;
      readonly diagnosticCount: number;
      readonly diagnostics: readonly SketchProfileDiagnostic[];
    }
  | {
      readonly status: "missing";
      readonly targetBodyId?: never;
      readonly targetTopologyAnchorId: string;
      readonly diagnosticCount: number;
      readonly diagnostics: readonly SketchProfileDiagnostic[];
    }
  | {
      readonly status: "stale";
      readonly targetBodyId?: BodyId;
      readonly targetTopologyAnchorId: string;
      readonly diagnosticCount: number;
      readonly diagnostics: readonly SketchProfileDiagnostic[];
    };

interface SketchProfileReadinessQueryResponseBase {
  readonly ok: true;
  readonly query: "sketch.profileReadiness";
  readonly cadOpsVersion: CadOpsVersion;
  readonly requestedProfile: SketchProfileRef;
  readonly consumer: SketchProfileConsumerIntent;
  readonly consumerCompatibility: SketchConsumerCompatibility;
  readonly targetCompatibility: SketchProfileTargetCompatibility;
  readonly dependencies: SketchReferenceDependencies;
  readonly joinCount: number;
  readonly joins: readonly SketchProfileJoinHealth[];
  readonly intersectionStatus: SketchProfileIntersectionStatus;
  readonly diagnosticCount: number;
  readonly diagnostics: readonly SketchProfileDiagnostic[];
}

export interface SketchProfileReadinessReadyQueryResponse extends SketchProfileReadinessQueryResponseBase {
  readonly status: "ready";
  readonly normalizedProfile: SketchProfileRef;
  readonly orientation: "counterclockwise";
  readonly orientationNormalized: boolean;
  readonly area: number;
  readonly signedArea: number;
  readonly bounds: SketchBounds2d;
  readonly intersectionStatus: "clear";
}

export interface SketchProfileReadinessBlockedQueryResponse extends SketchProfileReadinessQueryResponseBase {
  readonly status: "blocked";
  readonly normalizedProfile?: SketchProfileRef;
  readonly orientation?: "clockwise" | "counterclockwise";
  readonly orientationNormalized: boolean;
  readonly area?: number;
  readonly signedArea?: number;
  readonly bounds?: SketchBounds2d;
}

export type SketchProfileReadinessQueryResponse =
  | SketchProfileReadinessReadyQueryResponse
  | SketchProfileReadinessBlockedQueryResponse;

export interface SketchProfileCandidatesQueryResponse {
  readonly ok: true;
  readonly query: "sketch.profileCandidates";
  readonly cadOpsVersion: CadOpsVersion;
  readonly sketchId: SketchId;
  readonly status: "ready" | "blocked";
  readonly candidateCount: number;
  readonly candidates: readonly SketchProfileCandidate[];
  readonly rejectedComponentCount: number;
  readonly rejectedComponents: readonly SketchProfileRejectedComponent[];
  readonly constructionExclusionCount: number;
  readonly constructionExclusions: readonly SketchConstructionExclusion[];
  readonly diagnosticCount: number;
  readonly diagnostics: readonly SketchProfileDiagnostic[];
}

export interface SketchPathCandidatesQueryResponse {
  readonly ok: true;
  readonly query: "sketch.pathCandidates";
  readonly cadOpsVersion: CadOpsVersion;
  readonly sketchId: SketchId;
  readonly status: "ready" | "blocked";
  readonly candidateCount: number;
  readonly candidates: readonly SketchPathCandidate[];
  readonly rejectedComponentCount: number;
  readonly rejectedComponents: readonly SketchPathRejectedComponent[];
  readonly diagnosticCount: number;
  readonly diagnostics: readonly SketchPathDiagnostic[];
}

interface SketchPathReadinessQueryResponseBase {
  readonly ok: true;
  readonly query: "sketch.pathReadiness";
  readonly cadOpsVersion: CadOpsVersion;
  readonly requestedPath: SketchPathRef;
  readonly normalizedPath?: SketchPathRef;
  readonly sweepProfile?: SketchEntityProfileRef;
  readonly consumer: {
    readonly featureKind: "sweep";
    readonly operationMode: "newBody";
  };
  readonly dependencies: SketchReferenceDependencies;
  readonly connectionStatus: "connected" | "disconnected" | "branching";
  readonly tangentStatus: SketchPathJoinTangentStatus;
  readonly selfIntersectionStatus: SketchPathSelfIntersectionStatus;
  readonly frameStatus: SketchPathFrameStatus;
  readonly length?: number;
  readonly bounds?: SketchBounds2d;
  readonly joinCount: number;
  readonly joins: readonly SketchPathJoinHealth[];
  readonly diagnosticCount: number;
  readonly diagnostics: readonly SketchPathDiagnostic[];
}

export interface SketchPathReadinessReadyQueryResponse extends SketchPathReadinessQueryResponseBase {
  readonly status: "ready";
  readonly normalizedPath: SketchPathRef;
  readonly connectionStatus: "connected";
  readonly tangentStatus: "tangent";
  readonly selfIntersectionStatus: "clear";
  readonly frameStatus: "ready" | "not-evaluated";
  readonly length: number;
  readonly bounds: SketchBounds2d;
}

export interface SketchPathReadinessBlockedQueryResponse extends SketchPathReadinessQueryResponseBase {
  readonly status: "blocked";
}

export type SketchPathReadinessQueryResponse =
  | SketchPathReadinessReadyQueryResponse
  | SketchPathReadinessBlockedQueryResponse;

export type SketchProfilePathQueryResponse =
  | SketchProfileCandidatesQueryResponse
  | SketchProfileReadinessQueryResponse
  | SketchPathCandidatesQueryResponse
  | SketchPathReadinessQueryResponse;

export type CadQueryResponse =
  | ParameterListQueryResponse
  | ParameterGetQueryResponse
  | ProjectParameterEvaluationQueryResponse
  | FeatureEditabilityQueryResponse
  | ProjectSummaryQueryResponse
  | ProjectFeaturesQueryResponse
  | ProjectStructureQueryResponse
  | ProjectHealthQueryResponse
  | ProjectDependencyGraphQueryResponse
  | ProjectRebuildPlanQueryResponse
  | ProjectTopologyIdentityReadinessQueryResponse
  | ProjectImportReadinessQueryResponse
  | TopologyMatchSnapshotsQueryResponse
  | TopologyAnchorRepairCandidatesQueryResponse
  | TopologyAnchorCommandReadinessQueryResponse
  | TopologyCommandTargetReadinessQueryResponse
  | TopologyAnchorCreationPlanQueryResponse
  | TopologyAnchorRepairPlanQueryResponse
  | ProjectExportReadinessQueryResponse
  | ProjectExactExportQueryResponse
  | ProjectPackageReadinessQueryResponse
  | ProjectSketchesQueryResponse
  | ObjectGetQueryResponse
  | ObjectMeasurementsQueryResponse
  | ProjectExtentsQueryResponse
  | SketchGetQueryResponse
  | SketchProfileCandidatesQueryResponse
  | SketchProfileReadinessQueryResponse
  | SketchPathCandidatesQueryResponse
  | SketchPathReadinessQueryResponse
  | SketchEditReadinessQueryResponse
  | SketchSolverStatusQueryResponse
  | SketchEvaluationQueryResponse
  | SketchDimensionsQueryResponse
  | SketchDimensionGetQueryResponse
  | BodyGeneratedReferencesQueryResponse
  | BodyResolveGeneratedReferenceQueryResponse
  | BodyImportedBodyStatusQueryResponse
  | BodyTopologyQueryResponse
  | BodyTopologyIdentityQueryResponse
  | BodyMeasurementsQueryResponse
  | BodyPatternInstancesQueryResponse
  | BodyMassPropertiesQueryResponse
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

export type CadParameterEvaluationStatus = "valid" | "invalid" | "circular";

export type CadParameterExpressionDiagnosticCode =
  | "PARAMETER_CIRCULAR_REFERENCE"
  | "PARAMETER_REF_NOT_FOUND"
  | "PARAMETER_REF_AMBIGUOUS"
  | "EXPRESSION_PARSE_ERROR"
  | "EXPRESSION_UNKNOWN_IDENTIFIER"
  | "EXPRESSION_DIVISION_BY_ZERO"
  | "EXPRESSION_INVALID_FUNCTION"
  | "EXPRESSION_INVALID_VALUE"
  | "EXPRESSION_DOMAIN_ERROR"
  | "EXPRESSION_TERNARY_INVALID"
  | "EXPRESSION_LANGUAGE_UNSUPPORTED_TOKEN"
  | "EXPRESSION_LANGUAGE_V2_FEATURES_PRESENT"
  | "EXPRESSION_VALUE_INCONSISTENCY";

export interface CadParameterExpressionDiagnostic {
  readonly code: CadParameterExpressionDiagnosticCode;
  readonly message: string;
  readonly parameterId?: ParameterId;
  readonly parameterName?: string;
  readonly expression?: string;
  readonly referencedName?: string;
  readonly cycle?: readonly ParameterId[];
  readonly position?: number;
  readonly expected?: string;
  readonly received?: string;
}

export interface CadParameterEvaluationNode {
  readonly parameterId: ParameterId;
  readonly name: string;
  readonly value: number;
  readonly expression?: string;
  readonly referenceNames: readonly string[];
  readonly references: readonly ParameterId[];
  readonly dependents: readonly ParameterId[];
  readonly diagnostics: readonly CadParameterExpressionDiagnostic[];
}

export interface CadParameterEvaluationCycle {
  readonly parameterIds: readonly ParameterId[];
  readonly parameterNames: readonly string[];
}

export interface ProjectParameterEvaluationQueryResponse {
  readonly ok: true;
  readonly query: "project.parameterEvaluation";
  readonly cadOpsVersion: CadOpsVersion;
  readonly status: CadParameterEvaluationStatus;
  readonly parameterCount: number;
  readonly expressionCount: number;
  readonly nodes: readonly CadParameterEvaluationNode[];
  readonly evaluationOrder: readonly ParameterId[];
  readonly cycleCount: number;
  readonly cycles: readonly CadParameterEvaluationCycle[];
  readonly diagnosticCount: number;
  readonly diagnostics: readonly CadParameterExpressionDiagnostic[];
  readonly sourceBoundaryNote: string;
  readonly derivedBoundaryNote: string;
  readonly mutatesSource: false;
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
  readonly authoredShellCount: number;
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
  readonly authoredShells: readonly CadAuthoredShellHealth[];
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

export interface ProjectTopologyIdentityReadinessQueryResponse {
  readonly ok: true;
  readonly query: "project.topologyIdentityReadiness";
  readonly cadOpsVersion: CadOpsVersion;
  readonly contractVersion: CadTopologyIdentityContractVersion;
  readonly status: WcadReadinessStatus;
  readonly currentDocumentSchemaVersion: WcadDocumentSchemaVersion;
  readonly plannedProjectSchemaVersion: CadTopologyIdentityProjectSchemaVersion;
  readonly currentPackageVersion: WcadPackageVersion;
  readonly plannedPackageVersion: CadTopologyIdentityPackageVersion;
  readonly requiresProjectSchemaMigration: false;
  readonly requiresPackageVersionMigration: false;
  readonly sourceBoundaryNote: string;
  readonly derivedBoundaryNote: string;
  readonly supportedEntityKinds: readonly CadTopologyEntityKind[];
  readonly currentFeatureCount: number;
  readonly currentBodyCount: number;
  readonly currentNamedReferenceCount: number;
  readonly snapshotDescriptorCount: number;
  readonly snapshots: readonly CadTopologySnapshotDescriptor[];
  readonly anchorCount: number;
  readonly anchors: readonly CadTopologyAnchorDescriptor[];
  readonly checkpointCount: number;
  readonly checkpoints: readonly CadTopologyCheckpointMetadata[];
  readonly matchResultCount: number;
  readonly matchResults: readonly CadTopologyMatchResult[];
  readonly repairCandidateCount: number;
  readonly repairCandidates: readonly CadTopologyRepairCandidate[];
  readonly capabilityCount: number;
  readonly capabilities: readonly CadTopologyIdentityCapabilityReadiness[];
  readonly diagnosticCount: number;
  readonly diagnostics: readonly CadTopologyIdentityDiagnostic[];
}

export interface ProjectImportReadinessQueryResponse {
  readonly ok: true;
  readonly query: "project.importReadiness";
  readonly cadOpsVersion: CadOpsVersion;
  readonly sourceFormat: "step";
  readonly status: CadStepImportReadinessStatus;
  readonly geometryWorkerAvailable: boolean;
  readonly stepReaderAvailable: boolean;
  readonly healingAvailable: boolean;
  readonly importedBodyCount: number;
  readonly maxBodyCount: number;
  readonly diagnosticCount: number;
  readonly diagnostics: readonly CadStepImportDiagnostic[];
  readonly sourceBoundaryNote: string;
  readonly derivedBoundaryNote: string;
  readonly mutatesSource: false;
}

export interface TopologyMatchSnapshotsQueryResponse {
  readonly ok: true;
  readonly query: "topology.matchSnapshots";
  readonly cadOpsVersion: CadOpsVersion;
  readonly status: CadTopologyIdentityState;
  readonly previousSnapshot: CadTopologySnapshotDescriptor;
  readonly candidateSnapshotCount: number;
  readonly candidateSnapshots: readonly CadTopologySnapshotDescriptor[];
  readonly resultCount: number;
  readonly matchResults: readonly CadTopologyMatchResult[];
  readonly repairCandidateCount: number;
  readonly repairCandidates: readonly CadTopologyRepairCandidate[];
  readonly diagnosticCount: number;
  readonly diagnostics: readonly CadTopologyIdentityDiagnostic[];
  readonly sourceBoundaryNote: string;
  readonly derivedBoundaryNote: string;
  readonly mutatesSource: false;
}

export interface CadTopologyAnchorRepairCandidateGroup {
  readonly anchorId: string;
  readonly target: Extract<
    CadTopologyRepairCandidateTarget,
    { readonly type: "topologyAnchor" }
  >;
  readonly bodyId: BodyId;
  readonly entityKind: CadTopologyAnchorEntityKind;
  readonly state: CadTopologyIdentityState;
  readonly confidence: CadTopologyMatchConfidence;
  readonly confidenceScore?: number;
  readonly previousCheckpointId?: string;
  readonly previousCheckpointEntityId?: string;
  readonly candidateCheckpointId?: string;
  readonly candidateCheckpointEntityId?: string;
  readonly repairPlanQuery: "topology.anchorRepairPlan";
  readonly candidateIdScope: "topology-match-preview";
  readonly repairCandidateCount: number;
  readonly repairCandidates: readonly CadTopologyRepairCandidate[];
  readonly diagnosticCount: number;
  readonly diagnostics: readonly CadTopologyIdentityDiagnostic[];
}

export interface TopologyAnchorRepairCandidatesQueryResponse {
  readonly ok: true;
  readonly query: "topology.anchorRepairCandidates";
  readonly cadOpsVersion: CadOpsVersion;
  readonly status: CadTopologyIdentityState;
  readonly anchorFilterCount: number;
  readonly anchorIds: readonly string[];
  readonly previousSnapshot: CadTopologySnapshotDescriptor;
  readonly candidateSnapshotCount: number;
  readonly candidateSnapshots: readonly CadTopologySnapshotDescriptor[];
  readonly matchResultCount: number;
  readonly matchResults: readonly CadTopologyMatchResult[];
  readonly anchorGroupCount: number;
  readonly anchorGroups: readonly CadTopologyAnchorRepairCandidateGroup[];
  readonly unscopedRepairCandidateCount: number;
  readonly unscopedRepairCandidates: readonly CadTopologyRepairCandidate[];
  readonly diagnosticCount: number;
  readonly diagnostics: readonly CadTopologyIdentityDiagnostic[];
  readonly sourceBoundaryNote: string;
  readonly derivedBoundaryNote: string;
  readonly mutatesSource: false;
}

export type CadTopologyAnchorCommandReadinessStatus =
  | "ready"
  | "partial"
  | "missing"
  | "stale"
  | "unsupported"
  | "non-commandable";

export type CadTopologyAnchorCommandProofKind =
  | "checkpointEntityPresent"
  | "axisAlignedPlanarFace"
  | "axisAlignedLinearEdge"
  | "pointVertex";

export interface CadTopologyAnchorCommandProof {
  readonly kind: CadTopologyAnchorCommandProofKind;
  readonly entityKind: CadTopologyAnchorEntityKind;
  readonly evidenceSource: "checkpointSnapshot";
  readonly exposesCheckpointLocalIds: false;
  readonly bounds?: CadTopologyEntityBounds;
  readonly planarAxis?: "x" | "y" | "z";
  readonly planarCoordinate?: number;
  readonly linearAxis?: "x" | "y" | "z";
  readonly length?: number;
}

export interface TopologyAnchorCommandReadinessQueryResponse {
  readonly ok: true;
  readonly query: "topology.anchorCommandReadiness";
  readonly cadOpsVersion: CadOpsVersion;
  readonly status: CadTopologyAnchorCommandReadinessStatus;
  readonly anchorId: string;
  readonly bodyId?: BodyId;
  readonly entityKind?: CadTopologyAnchorEntityKind;
  readonly checkpointId?: string;
  readonly requiredOperation?: CadSelectionReferenceOperation;
  readonly selectionStatus: CadSelectionReferenceStatus;
  readonly commandable: boolean;
  readonly commandOperationCount: number;
  readonly commandOperations: readonly CadSelectionReferenceOperation[];
  readonly candidateCount: number;
  readonly candidates: readonly CadSelectionReferenceCandidate[];
  readonly issueCount: number;
  readonly issues: readonly CadSelectionReferenceIssue[];
  readonly proof?: CadTopologyAnchorCommandProof;
  readonly diagnosticCount: number;
  readonly diagnostics: readonly CadTopologyIdentityDiagnostic[];
  readonly sourceBoundaryNote: string;
  readonly derivedBoundaryNote: string;
  readonly mutatesSource: false;
  readonly exposesCheckpointLocalIds: false;
}

export type CadTopologyCommandTargetReadinessStatus =
  | "ready"
  | "needs-promotion"
  | "needs-checkpoint-evidence"
  | "needs-repair"
  | "blocked"
  | "missing"
  | "stale"
  | "ambiguous"
  | "consumed"
  | "unsupported"
  | "non-commandable";

export type CadTopologyCommandTargetOperationSource =
  | "selection.referenceCandidates"
  | "topology.anchorCommandReadiness";

export interface CadTopologyCommandTargetOperationSummary {
  readonly operation: CadSelectionReferenceOperation;
  readonly status: CadTopologyCommandTargetReadinessStatus;
  readonly commandable: boolean;
  readonly source: CadTopologyCommandTargetOperationSource;
  readonly target?: CadSelectionReferenceCommandTarget;
  readonly requiresPromotion: boolean;
  readonly requiresCheckpointEvidence: boolean;
  readonly requiresRepair: boolean;
}

export interface TopologyCommandTargetReadinessQueryResponse {
  readonly ok: true;
  readonly query: "topology.commandTargetReadiness";
  readonly cadOpsVersion: CadOpsVersion;
  readonly target: CadTopologyCommandTargetInput;
  readonly desiredOperation?: CadSelectionReferenceOperation;
  readonly status: CadTopologyCommandTargetReadinessStatus;
  readonly selectionStatus: CadSelectionReferenceStatus;
  readonly commandable: boolean;
  readonly promotionRequired: boolean;
  readonly checkpointEvidenceRequired: boolean;
  readonly repairRequired: boolean;
  readonly supportedOperationCount: number;
  readonly supportedOperations: readonly CadSelectionReferenceOperation[];
  readonly operationSummaryCount: number;
  readonly operationSummaries: readonly CadTopologyCommandTargetOperationSummary[];
  readonly candidateCount: number;
  readonly candidates: readonly CadSelectionReferenceCandidate[];
  readonly issueCount: number;
  readonly issues: readonly CadSelectionReferenceIssue[];
  readonly anchorReadiness?: TopologyAnchorCommandReadinessQueryResponse;
  readonly proof?: CadTopologyAnchorCommandProof;
  readonly diagnosticCount: number;
  readonly diagnostics: readonly CadTopologyIdentityDiagnostic[];
  readonly sourceBoundaryNote: string;
  readonly derivedBoundaryNote: string;
  readonly mutatesSource: false;
  readonly exposesCheckpointLocalIds: false;
  readonly exposesPrivateIds: false;
  readonly requiresProjectSchemaMigration: false;
  readonly requiresPackageVersionMigration: false;
}

export type CadTopologyAnchorCreationPlanStatus =
  | "ready"
  | "alreadyExists"
  | "missing"
  | "unsupported"
  | "ambiguous";

export interface TopologyAnchorCreationPlanQueryResponse {
  readonly ok: true;
  readonly query: "topology.anchorCreationPlan";
  readonly cadOpsVersion: CadOpsVersion;
  readonly status: CadTopologyAnchorCreationPlanStatus;
  readonly bodyId: BodyId;
  readonly stableId: string;
  readonly checkpointId?: string;
  readonly anchorId?: string;
  readonly sourceFeatureId?: FeatureId;
  readonly candidate?: CadTopologyGeneratedReferenceCandidate;
  readonly createsCheckpoint: boolean;
  readonly createsAnchor: boolean;
  readonly opCount: number;
  readonly ops: readonly CadOp[];
  readonly proposedBatch: CadBatch;
  readonly diagnosticCount: number;
  readonly diagnostics: readonly CadTopologyIdentityDiagnostic[];
  readonly sourceBoundaryNote: string;
  readonly derivedBoundaryNote: string;
  readonly mutatesSource: false;
}

export type CadTopologyAnchorRepairPlanStatus =
  | "ready"
  | "alreadyCurrent"
  | "missing"
  | "unsupported"
  | "ambiguous";

export interface TopologyAnchorRepairPlanQueryResponse {
  readonly ok: true;
  readonly query: "topology.anchorRepairPlan";
  readonly cadOpsVersion: CadOpsVersion;
  readonly status: CadTopologyAnchorRepairPlanStatus;
  readonly anchorId: string;
  readonly bodyId?: BodyId;
  readonly entityKind?: CadTopologyAnchorEntityKind;
  readonly previousCheckpointId?: string;
  readonly previousCheckpointEntityId?: string;
  readonly replacementCheckpointId?: string;
  readonly replacementCheckpointEntityId?: string;
  readonly repairId?: string;
  readonly confidence: CadTopologyMatchConfidence;
  readonly evidence: readonly CadTopologyMatchEvidence[];
  readonly repairCandidateCount: number;
  readonly repairCandidates: readonly CadTopologyRepairCandidate[];
  readonly createsCheckpoint: boolean;
  readonly createsRepair: boolean;
  readonly opCount: number;
  readonly ops: readonly CadOp[];
  readonly proposedBatch: CadBatch;
  readonly diagnosticCount: number;
  readonly diagnostics: readonly CadTopologyIdentityDiagnostic[];
  readonly sourceBoundaryNote: string;
  readonly derivedBoundaryNote: string;
  readonly mutatesSource: false;
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

export type ImportedBodyStatus =
  | "not-imported"
  | "healthy"
  | "checkpoint-missing"
  | "topology-unavailable";

export interface BodyImportedBodyStatusQueryResponse {
  readonly ok: true;
  readonly query: "body.importedBodyStatus";
  readonly cadOpsVersion: CadOpsVersion;
  readonly bodyId: BodyId;
  readonly imported: boolean;
  readonly status: ImportedBodyStatus;
  readonly checkpointStatus: "not-imported" | "available" | "missing";
  readonly healingApplied: boolean;
  readonly sourceFileName?: string;
  readonly sourceFormat?: "step";
  readonly checkpointId?: string;
  readonly availableDownstreamOperations: readonly CadSelectionReferenceOperation[];
  readonly diagnosticCount: number;
  readonly diagnostics: readonly CadStepImportDiagnostic[];
  readonly sourceBoundaryNote: string;
  readonly derivedBoundaryNote: string;
}

export interface BodyTopologyQueryResponse {
  readonly ok: true;
  readonly query: "body.topology";
  readonly cadOpsVersion: CadOpsVersion;
  readonly topology: CadBodyTopologySnapshot;
}

export interface BodyTopologyIdentityQueryResponse {
  readonly ok: true;
  readonly query: "body.topologyIdentity";
  readonly cadOpsVersion: CadOpsVersion;
  readonly bodyId: BodyId;
  readonly status: CadTopologyIdentityState;
  readonly checkpointId?: string;
  readonly sourceFeatureId?: FeatureId;
  readonly sourceIdentity?: WcadSourceIdentity;
  readonly snapshot?: CadTopologyMatchSnapshotInput;
  readonly descriptor: CadTopologySnapshotDescriptor;
  readonly candidateCount: number;
  readonly candidates: readonly CadTopologyGeneratedReferenceCandidate[];
  readonly diagnosticCount: number;
  readonly diagnostics: readonly CadTopologyIdentityDiagnostic[];
  readonly sourceBoundaryNote: string;
  readonly derivedBoundaryNote: string;
  readonly mutatesSource: false;
}

export interface BodyMeasurementsQueryResponse {
  readonly ok: true;
  readonly query: "body.measurements";
  readonly cadOpsVersion: CadOpsVersion;
  readonly measurements: BodyMeasurementsSnapshot;
}

export interface CadPatternInstanceQueryRecord {
  readonly index: number;
  readonly transform: Mat4;
  readonly bounds?: CadAxisAlignedBounds;
}

export interface BodyPatternInstancesQueryResponse {
  readonly ok: true;
  readonly query: "body.patternInstances";
  readonly cadOpsVersion: CadOpsVersion;
  readonly bodyId: BodyId;
  readonly featureId: FeatureId;
  readonly patternKind: "linearPattern" | "circularPattern";
  readonly instanceCount: number;
  readonly instances: readonly CadPatternInstanceQueryRecord[];
  readonly multiSolid: boolean;
  readonly multiSolidStatus: "single" | "multi" | "unknown";
  readonly solidCount?: number;
  readonly diagnostics: readonly CadBodyExactMetadataDiagnostic[];
}

export interface CadMassPropertiesSnapshot {
  readonly bodyId: BodyId;
  readonly density: number;
  readonly volume: number;
  readonly surfaceArea: number;
  readonly centerOfMass: Vec3;
  readonly mass: number;
  readonly units: DocumentUnits;
  readonly momentsOfInertia?: CadInertiaTensor;
  readonly principalMoments?: Vec3;
  readonly measurementSource: "kernel-derived";
  readonly measurementConfidence: "kernel-derived";
  readonly diagnostics: readonly CadBodyExactMetadataDiagnostic[];
}

export interface CadInertiaTensor {
  readonly xx: number;
  readonly yy: number;
  readonly zz: number;
  readonly xy: number;
  readonly xz: number;
  readonly yz: number;
}

export interface BodyMassPropertiesQueryResponse {
  readonly ok: true;
  readonly query: "body.massProperties";
  readonly cadOpsVersion: CadOpsVersion;
  readonly massProperties: CadMassPropertiesSnapshot;
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

export type SketchProfilePathValidationIssueCode =
  | "INVALID_TYPE"
  | "MISSING_FIELD"
  | "UNKNOWN_FIELD"
  | "INVALID_VALUE"
  | "COUNT_MISMATCH";

export interface SketchProfilePathValidationIssue {
  readonly code: SketchProfilePathValidationIssueCode;
  readonly path: string;
  readonly message: string;
}

export type SketchProfilePathValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false;
      readonly issues: readonly SketchProfilePathValidationIssue[];
    };

type UnknownRecord = Record<string, unknown>;

function isUnknownRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateExactRecord(
  value: unknown,
  path: string,
  required: readonly string[],
  optional: readonly string[],
  issues: SketchProfilePathValidationIssue[]
): value is UnknownRecord {
  if (!isUnknownRecord(value)) {
    issues.push({ code: "INVALID_TYPE", path, message: "Expected an object." });
    return false;
  }
  const allowed = new Set([...required, ...optional]);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      issues.push({
        code: "UNKNOWN_FIELD",
        path: `${path}.${key}`,
        message: `Field '${key}' is not part of this query contract.`
      });
    }
  }
  for (const key of required) {
    if (!(key in value)) {
      issues.push({
        code: "MISSING_FIELD",
        path: `${path}.${key}`,
        message: `Required field '${key}' is missing.`
      });
    }
  }
  return true;
}

function validateNonEmptyString(
  value: unknown,
  path: string,
  issues: SketchProfilePathValidationIssue[]
): value is string {
  if (typeof value === "string" && value.length > 0) return true;
  issues.push({
    code: "INVALID_VALUE",
    path,
    message: "Expected a non-empty string."
  });
  return false;
}

function validateFiniteNumber(
  value: unknown,
  path: string,
  issues: SketchProfilePathValidationIssue[]
): value is number {
  if (typeof value === "number" && Number.isFinite(value)) return true;
  issues.push({
    code: "INVALID_VALUE",
    path,
    message: "Expected a finite number."
  });
  return false;
}

function validateNonNegativeNumber(
  value: unknown,
  path: string,
  issues: SketchProfilePathValidationIssue[]
): value is number {
  if (!validateFiniteNumber(value, path, issues)) return false;
  if (value >= 0) return true;
  issues.push({
    code: "INVALID_VALUE",
    path,
    message: "Expected a non-negative number."
  });
  return false;
}

function validatePositiveNumber(
  value: unknown,
  path: string,
  issues: SketchProfilePathValidationIssue[]
): value is number {
  if (!validateFiniteNumber(value, path, issues)) return false;
  if (value > 0) return true;
  issues.push({
    code: "INVALID_VALUE",
    path,
    message: "Expected a positive number."
  });
  return false;
}

function validateNonNegativeInteger(
  value: unknown,
  path: string,
  issues: SketchProfilePathValidationIssue[]
): value is number {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
    return true;
  }
  issues.push({
    code: "INVALID_VALUE",
    path,
    message: "Expected a non-negative integer."
  });
  return false;
}

function validateBoolean(
  value: unknown,
  path: string,
  issues: SketchProfilePathValidationIssue[]
): value is boolean {
  if (typeof value === "boolean") return true;
  issues.push({
    code: "INVALID_TYPE",
    path,
    message: "Expected a boolean."
  });
  return false;
}

function validateEnum(
  value: unknown,
  allowed: readonly string[],
  path: string,
  issues: SketchProfilePathValidationIssue[]
): value is string {
  if (typeof value === "string" && allowed.includes(value)) return true;
  issues.push({
    code: "INVALID_VALUE",
    path,
    message: `Expected one of: ${allowed.join(", ")}.`
  });
  return false;
}

function validateIdArray(
  value: unknown,
  path: string,
  issues: SketchProfilePathValidationIssue[]
): void {
  if (!Array.isArray(value)) {
    issues.push({
      code: "INVALID_TYPE",
      path,
      message: "Expected an ID array."
    });
    return;
  }
  value.forEach((id, index) =>
    validateNonEmptyString(id, `${path}[${index}]`, issues)
  );
}

function validateOrientedSegments(
  value: unknown,
  path: string,
  issues: SketchProfilePathValidationIssue[]
): void {
  if (!Array.isArray(value)) {
    issues.push({ code: "INVALID_TYPE", path, message: "Expected an array." });
    return;
  }
  value.forEach((segment, index) => {
    const segmentPath = `${path}[${index}]`;
    if (
      !validateExactRecord(
        segment,
        segmentPath,
        ["entityId", "orientation"],
        [],
        issues
      )
    ) {
      return;
    }
    validateNonEmptyString(segment.entityId, `${segmentPath}.entityId`, issues);
    if (
      segment.orientation !== "forward" &&
      segment.orientation !== "reverse"
    ) {
      issues.push({
        code: "INVALID_VALUE",
        path: `${segmentPath}.orientation`,
        message: "Expected 'forward' or 'reverse'."
      });
    }
  });
}

function validateProfileRef(
  value: unknown,
  path: string,
  issues: SketchProfilePathValidationIssue[],
  entityOnly = false
): void {
  if (!isUnknownRecord(value)) {
    issues.push({
      code: "INVALID_TYPE",
      path,
      message: "Expected a profile reference."
    });
    return;
  }
  if (value.kind === "entity") {
    if (
      !validateExactRecord(
        value,
        path,
        ["kind", "sketchId", "entityId"],
        [],
        issues
      )
    )
      return;
    validateNonEmptyString(value.sketchId, `${path}.sketchId`, issues);
    validateNonEmptyString(value.entityId, `${path}.entityId`, issues);
    return;
  }
  if (!entityOnly && value.kind === "wire") {
    if (
      !validateExactRecord(
        value,
        path,
        ["kind", "sketchId", "segments"],
        [],
        issues
      )
    )
      return;
    validateNonEmptyString(value.sketchId, `${path}.sketchId`, issues);
    validateOrientedSegments(value.segments, `${path}.segments`, issues);
    return;
  }
  issues.push({
    code: "INVALID_VALUE",
    path: `${path}.kind`,
    message: entityOnly
      ? "Expected an entity profile reference."
      : "Expected profile kind 'entity' or 'wire'."
  });
}

function validatePathRef(
  value: unknown,
  path: string,
  issues: SketchProfilePathValidationIssue[]
): void {
  if (!isUnknownRecord(value)) {
    issues.push({
      code: "INVALID_TYPE",
      path,
      message: "Expected a path reference."
    });
    return;
  }
  if (value.kind === "entity") {
    if (
      !validateExactRecord(
        value,
        path,
        ["kind", "sketchId", "entityId", "orientation"],
        [],
        issues
      )
    )
      return;
    validateNonEmptyString(value.sketchId, `${path}.sketchId`, issues);
    validateNonEmptyString(value.entityId, `${path}.entityId`, issues);
    if (value.orientation !== "forward" && value.orientation !== "reverse") {
      issues.push({
        code: "INVALID_VALUE",
        path: `${path}.orientation`,
        message: "Invalid orientation."
      });
    }
    return;
  }
  if (value.kind === "chain") {
    if (
      !validateExactRecord(
        value,
        path,
        ["kind", "sketchId", "segments"],
        [],
        issues
      )
    )
      return;
    validateNonEmptyString(value.sketchId, `${path}.sketchId`, issues);
    validateOrientedSegments(value.segments, `${path}.segments`, issues);
    return;
  }
  issues.push({
    code: "INVALID_VALUE",
    path: `${path}.kind`,
    message: "Expected path kind 'entity' or 'chain'."
  });
}

function validateProfileConsumer(
  value: unknown,
  path: string,
  issues: SketchProfilePathValidationIssue[]
): void {
  if (!isUnknownRecord(value)) {
    issues.push({
      code: "INVALID_TYPE",
      path,
      message: "Expected a consumer intent."
    });
    return;
  }
  const featureKind = value.featureKind;
  const operationMode = value.operationMode;
  const isBooleanExtrude =
    featureKind === "extrude" &&
    (operationMode === "add" || operationMode === "cut");
  validateExactRecord(
    value,
    path,
    ["featureKind", "operationMode"],
    isBooleanExtrude ? ["targetBodyId", "targetTopologyAnchorId"] : [],
    issues
  );
  if (!["extrude", "revolve", "sweep", "loft"].includes(String(featureKind))) {
    issues.push({
      code: "INVALID_VALUE",
      path: `${path}.featureKind`,
      message: "Invalid profile consumer."
    });
  }
  const operationValid =
    operationMode === "newBody" ||
    (featureKind === "extrude" &&
      (operationMode === "add" || operationMode === "cut"));
  if (!operationValid) {
    issues.push({
      code: "INVALID_VALUE",
      path: `${path}.operationMode`,
      message: "Unsupported operation."
    });
  }
  if ("targetBodyId" in value) {
    validateNonEmptyString(value.targetBodyId, `${path}.targetBodyId`, issues);
  }
  if ("targetTopologyAnchorId" in value) {
    validateNonEmptyString(
      value.targetTopologyAnchorId,
      `${path}.targetTopologyAnchorId`,
      issues
    );
  }
  if (
    value.targetBodyId !== undefined &&
    value.targetTopologyAnchorId !== undefined
  ) {
    issues.push({
      code: "INVALID_VALUE",
      path: `${path}.targetTopologyAnchorId`,
      message:
        "Extrude add/cut must use targetBodyId or targetTopologyAnchorId, never both."
    });
  }
}

export function validateSketchProfilePathQueryRequest(
  value: unknown
): SketchProfilePathValidationResult<SketchProfilePathQueryRequest> {
  const issues: SketchProfilePathValidationIssue[] = [];
  if (!validateExactRecord(value, "$", ["version", "query"], [], issues)) {
    return { ok: false, issues };
  }
  if (value.version !== "cadops.v1") {
    issues.push({
      code: "INVALID_VALUE",
      path: "$.version",
      message: "Unsupported CADOps version."
    });
  }
  if (!isUnknownRecord(value.query)) {
    issues.push({
      code: "INVALID_TYPE",
      path: "$.query",
      message: "Expected a query object."
    });
  } else {
    const query = value.query;
    switch (query.query) {
      case "sketch.profileCandidates":
      case "sketch.pathCandidates":
        if (
          validateExactRecord(
            query,
            "$.query",
            ["query", "sketchId"],
            [],
            issues
          )
        ) {
          validateNonEmptyString(query.sketchId, "$.query.sketchId", issues);
        }
        break;
      case "sketch.profileReadiness":
        if (
          validateExactRecord(
            query,
            "$.query",
            ["query", "profile", "consumer"],
            [],
            issues
          )
        ) {
          validateProfileRef(query.profile, "$.query.profile", issues);
          validateProfileConsumer(query.consumer, "$.query.consumer", issues);
        }
        break;
      case "sketch.pathReadiness":
        if (
          validateExactRecord(
            query,
            "$.query",
            ["query", "path"],
            ["sweepProfile"],
            issues
          )
        ) {
          validatePathRef(query.path, "$.query.path", issues);
          if ("sweepProfile" in query) {
            validateProfileRef(
              query.sweepProfile,
              "$.query.sweepProfile",
              issues,
              true
            );
          }
        }
        break;
      default:
        issues.push({
          code: "INVALID_VALUE",
          path: "$.query.query",
          message: "Expected a V17 profile or path query kind."
        });
    }
  }
  return issues.length === 0
    ? { ok: true, value: value as unknown as SketchProfilePathQueryRequest }
    : { ok: false, issues };
}

function validateCountedArray(
  record: UnknownRecord,
  countKey: string,
  arrayKey: string,
  path: string,
  issues: SketchProfilePathValidationIssue[]
): readonly unknown[] {
  validateNonNegativeInteger(record[countKey], `${path}.${countKey}`, issues);
  const array = record[arrayKey];
  if (!Array.isArray(array)) {
    issues.push({
      code: "INVALID_TYPE",
      path: `${path}.${arrayKey}`,
      message: "Expected an array."
    });
    return [];
  }
  if (record[countKey] !== array.length) {
    issues.push({
      code: "COUNT_MISMATCH",
      path: `${path}.${countKey}`,
      message: `${countKey} must match ${arrayKey}.length.`
    });
  }
  return array;
}

const PROFILE_RESPONSE_KEYS = [
  "ok",
  "query",
  "cadOpsVersion",
  "sketchId",
  "status",
  "candidateCount",
  "candidates",
  "rejectedComponentCount",
  "rejectedComponents",
  "constructionExclusionCount",
  "constructionExclusions",
  "diagnosticCount",
  "diagnostics"
] as const;
const PATH_RESPONSE_KEYS = [
  "ok",
  "query",
  "cadOpsVersion",
  "sketchId",
  "status",
  "candidateCount",
  "candidates",
  "rejectedComponentCount",
  "rejectedComponents",
  "diagnosticCount",
  "diagnostics"
] as const;
const PROFILE_READINESS_KEYS = [
  "ok",
  "query",
  "cadOpsVersion",
  "status",
  "requestedProfile",
  "normalizedProfile",
  "consumer",
  "consumerCompatibility",
  "targetCompatibility",
  "dependencies",
  "joinCount",
  "joins",
  "intersectionStatus",
  "orientation",
  "orientationNormalized",
  "area",
  "signedArea",
  "bounds",
  "diagnosticCount",
  "diagnostics"
] as const;
const PATH_READINESS_KEYS = [
  "ok",
  "query",
  "cadOpsVersion",
  "status",
  "requestedPath",
  "normalizedPath",
  "sweepProfile",
  "consumer",
  "dependencies",
  "connectionStatus",
  "tangentStatus",
  "selfIntersectionStatus",
  "frameStatus",
  "length",
  "bounds",
  "joinCount",
  "joins",
  "diagnosticCount",
  "diagnostics"
] as const;

function validateResponseEnvelope(
  value: UnknownRecord,
  path: string,
  issues: SketchProfilePathValidationIssue[]
): void {
  if (value.ok !== true) {
    issues.push({
      code: "INVALID_VALUE",
      path: `${path}.ok`,
      message: "Expected a successful response."
    });
  }
  if (value.cadOpsVersion !== "cadops.v1") {
    issues.push({
      code: "INVALID_VALUE",
      path: `${path}.cadOpsVersion`,
      message: "Invalid CADOps version."
    });
  }
  validateCountedArray(value, "diagnosticCount", "diagnostics", path, issues);
}

function validateBounds(
  value: unknown,
  path: string,
  issues: SketchProfilePathValidationIssue[]
): void {
  if (!validateExactRecord(value, path, ["min", "max"], [], issues)) return;
  let min: readonly [number, number] | undefined;
  let max: readonly [number, number] | undefined;
  for (const key of ["min", "max"] as const) {
    const point = value[key];
    if (!Array.isArray(point) || point.length !== 2) {
      issues.push({
        code: "INVALID_TYPE",
        path: `${path}.${key}`,
        message: "Expected a 2D point."
      });
      continue;
    }
    validateFiniteNumber(point[0], `${path}.${key}[0]`, issues);
    validateFiniteNumber(point[1], `${path}.${key}[1]`, issues);
    if (
      typeof point[0] === "number" &&
      Number.isFinite(point[0]) &&
      typeof point[1] === "number" &&
      Number.isFinite(point[1])
    ) {
      const validatedPoint = [point[0], point[1]] as const;
      if (key === "min") min = validatedPoint;
      else max = validatedPoint;
    }
  }
  if (min && max && (min[0] > max[0] || min[1] > max[1])) {
    issues.push({
      code: "INVALID_VALUE",
      path,
      message: "Bounds minimum must not exceed maximum."
    });
  }
}

function validateDependencies(
  value: unknown,
  path: string,
  issues: SketchProfilePathValidationIssue[]
): void {
  if (
    !validateExactRecord(
      value,
      path,
      ["sketchIds", "orderedEntityIds"],
      [],
      issues
    )
  )
    return;
  for (const key of ["sketchIds", "orderedEntityIds"] as const) {
    validateIdArray(value[key], `${path}.${key}`, issues);
  }
}

function validateJoinArray(
  value: unknown,
  path: string,
  pathJoin: boolean,
  issues: SketchProfilePathValidationIssue[]
): void {
  if (!Array.isArray(value)) return;
  value.forEach((join, index) => {
    const joinPath = `${path}[${index}]`;
    const required = [
      "joinIndex",
      "primaryEntityId",
      "secondaryEntityId",
      "connectionStatus",
      "coincidentWithinTolerance",
      "gapDistance",
      ...(pathJoin ? ["tangentStatus"] : [])
    ];
    const optional = pathJoin ? ["angularDeviationDegrees"] : [];
    if (!validateExactRecord(join, joinPath, required, optional, issues))
      return;
    validateNonNegativeInteger(join.joinIndex, `${joinPath}.joinIndex`, issues);
    if (join.joinIndex !== index) {
      issues.push({
        code: "INVALID_VALUE",
        path: `${joinPath}.joinIndex`,
        message: "joinIndex must match deterministic array order."
      });
    }
    validateNonEmptyString(
      join.primaryEntityId,
      `${joinPath}.primaryEntityId`,
      issues
    );
    validateNonEmptyString(
      join.secondaryEntityId,
      `${joinPath}.secondaryEntityId`,
      issues
    );
    validateEnum(
      join.connectionStatus,
      ["exact", "within-tolerance", "disconnected"],
      `${joinPath}.connectionStatus`,
      issues
    );
    validateBoolean(
      join.coincidentWithinTolerance,
      `${joinPath}.coincidentWithinTolerance`,
      issues
    );
    validateNonNegativeNumber(
      join.gapDistance,
      `${joinPath}.gapDistance`,
      issues
    );
    if (pathJoin) {
      validateEnum(
        join.tangentStatus,
        ["tangent", "not-tangent", "not-evaluated"],
        `${joinPath}.tangentStatus`,
        issues
      );
    }
    if ("angularDeviationDegrees" in join) {
      if (
        validateNonNegativeNumber(
          join.angularDeviationDegrees,
          `${joinPath}.angularDeviationDegrees`,
          issues
        ) &&
        join.angularDeviationDegrees > 180
      ) {
        issues.push({
          code: "INVALID_VALUE",
          path: `${joinPath}.angularDeviationDegrees`,
          message: "Angular deviation must be at most 180 degrees."
        });
      }
    }
    if (
      typeof join.coincidentWithinTolerance === "boolean" &&
      typeof join.connectionStatus === "string"
    ) {
      const expected = join.connectionStatus === "within-tolerance";
      if (join.coincidentWithinTolerance !== expected) {
        issues.push({
          code: "INVALID_VALUE",
          path: `${joinPath}.coincidentWithinTolerance`,
          message:
            "coincidentWithinTolerance must be true only for a within-tolerance join."
        });
      }
    }
  });
}

const PROFILE_DIAGNOSTIC_CODES: ReadonlySet<string> = new Set([
  "SKETCH_PROFILE_EMPTY",
  "SKETCH_PROFILE_ENTITY_MISSING",
  "SKETCH_PROFILE_ENTITY_UNSUPPORTED",
  "SKETCH_PROFILE_CONSTRUCTION_ENTITY",
  "SKETCH_PROFILE_ENTITY_REPEATED",
  "SKETCH_PROFILE_DISCONNECTED",
  "SKETCH_PROFILE_BRANCHING",
  "SKETCH_PROFILE_OPEN",
  "SKETCH_PROFILE_SELF_INTERSECTING",
  "SKETCH_PROFILE_OVERLAPPING",
  "SKETCH_PROFILE_AREA_TOO_SMALL",
  "SKETCH_PROFILE_MULTIPLE_REGIONS_UNSUPPORTED",
  "SKETCH_PROFILE_INNER_LOOP_UNSUPPORTED",
  "SKETCH_PROFILE_ORIENTATION_NORMALIZED",
  "SKETCH_PROFILE_CONSUMER_UNSUPPORTED",
  "BODY_NOT_FOUND",
  "UNSUPPORTED_BODY_REFERENCES",
  "TOPOLOGY_ANCHOR_NOT_FOUND",
  "INVALID_TOPOLOGY_ANCHOR",
  "TARGET_BODY_REQUIRED",
  "TARGET_BODY_NOT_SUPPORTED"
]);
const PATH_DIAGNOSTIC_CODES: ReadonlySet<string> = new Set([
  "SKETCH_PATH_EMPTY",
  "SKETCH_PATH_ENTITY_MISSING",
  "SKETCH_PATH_ENTITY_UNSUPPORTED",
  "SKETCH_PATH_ENTITY_REPEATED",
  "SKETCH_PATH_DISCONNECTED",
  "SKETCH_PATH_BRANCHING",
  "SKETCH_PATH_CLOSED_UNSUPPORTED",
  "SKETCH_PATH_SELF_INTERSECTING",
  "SKETCH_PATH_JOIN_NOT_TANGENT",
  "SKETCH_PATH_FRAME_INVALID"
]);

function validateDiagnosticArray(
  value: unknown,
  path: string,
  codes: ReadonlySet<string>,
  issues: SketchProfilePathValidationIssue[]
): void {
  if (!Array.isArray(value)) return;
  const isProfile = codes === PROFILE_DIAGNOSTIC_CODES;
  value.forEach((diagnostic, index) => {
    const diagnosticPath = `${path}[${index}]`;
    if (
      !validateExactRecord(
        diagnostic,
        diagnosticPath,
        ["code", "severity", "message"],
        [
          "sketchId",
          "entityId",
          "segmentIndex",
          "joinIndex",
          "expected",
          "received",
          ...(isProfile ? ["bodyId"] : [])
        ],
        issues
      )
    )
      return;
    if (!codes.has(String(diagnostic.code))) {
      issues.push({
        code: "INVALID_VALUE",
        path: `${diagnosticPath}.code`,
        message: "Invalid diagnostic code."
      });
    }
    if (!["info", "warning", "blocker"].includes(String(diagnostic.severity))) {
      issues.push({
        code: "INVALID_VALUE",
        path: `${diagnosticPath}.severity`,
        message: "Invalid severity."
      });
    }
    validateNonEmptyString(
      diagnostic.message,
      `${diagnosticPath}.message`,
      issues
    );
    for (const key of ["sketchId", "entityId", "bodyId"] as const) {
      if (key in diagnostic) {
        validateNonEmptyString(
          diagnostic[key],
          `${diagnosticPath}.${key}`,
          issues
        );
      }
    }
    for (const key of ["segmentIndex", "joinIndex"] as const) {
      if (key in diagnostic) {
        validateNonNegativeInteger(
          diagnostic[key],
          `${diagnosticPath}.${key}`,
          issues
        );
      }
    }
    for (const key of ["expected", "received"] as const) {
      if (key in diagnostic && typeof diagnostic[key] !== "string") {
        issues.push({
          code: "INVALID_TYPE",
          path: `${diagnosticPath}.${key}`,
          message: "Expected a string."
        });
      }
    }
  });
}

function validateConsumerCompatibility(
  value: unknown,
  path: string,
  consumer: unknown,
  issues: SketchProfilePathValidationIssue[]
): void {
  if (
    !validateExactRecord(
      value,
      path,
      [
        "status",
        "featureKind",
        "operationMode",
        "diagnosticCount",
        "diagnostics"
      ],
      [],
      issues
    )
  )
    return;
  if (value.status !== "ready" && value.status !== "blocked") {
    issues.push({
      code: "INVALID_VALUE",
      path: `${path}.status`,
      message: "Invalid consumer status."
    });
  }
  validateEnum(
    value.featureKind,
    ["extrude", "revolve", "sweep", "loft"],
    `${path}.featureKind`,
    issues
  );
  validateEnum(
    value.operationMode,
    ["newBody", "add", "cut"],
    `${path}.operationMode`,
    issues
  );
  if (
    isUnknownRecord(consumer) &&
    (value.featureKind !== consumer.featureKind ||
      value.operationMode !== consumer.operationMode)
  ) {
    issues.push({
      code: "INVALID_VALUE",
      path,
      message:
        "Consumer compatibility must echo the requested consumer operation."
    });
  }
  validateCountedArray(value, "diagnosticCount", "diagnostics", path, issues);
  validateDiagnosticArray(
    value.diagnostics,
    `${path}.diagnostics`,
    PROFILE_DIAGNOSTIC_CODES,
    issues
  );
}

function validateTargetCompatibility(
  value: unknown,
  path: string,
  consumer: unknown,
  issues: SketchProfilePathValidationIssue[]
): void {
  if (!isUnknownRecord(value)) {
    issues.push({
      code: "INVALID_TYPE",
      path,
      message: "Expected target compatibility."
    });
    return;
  }
  if (
    !validateExactRecord(
      value,
      path,
      ["status", "diagnosticCount", "diagnostics"],
      ["targetBodyId", "targetTopologyAnchorId"],
      issues
    )
  )
    return;
  if (
    !["not-applicable", "missing", "ready", "stale", "unsupported"].includes(
      String(value.status)
    )
  ) {
    issues.push({
      code: "INVALID_VALUE",
      path: `${path}.status`,
      message: "Invalid target status."
    });
  }
  if ("targetBodyId" in value) {
    validateNonEmptyString(value.targetBodyId, `${path}.targetBodyId`, issues);
  }
  if ("targetTopologyAnchorId" in value) {
    validateNonEmptyString(
      value.targetTopologyAnchorId,
      `${path}.targetTopologyAnchorId`,
      issues
    );
  }
  validateCountedArray(value, "diagnosticCount", "diagnostics", path, issues);
  validateDiagnosticArray(
    value.diagnostics,
    `${path}.diagnostics`,
    PROFILE_DIAGNOSTIC_CODES,
    issues
  );
  if (value.status === "not-applicable") {
    if (
      value.diagnosticCount !== 0 ||
      (Array.isArray(value.diagnostics) && value.diagnostics.length !== 0)
    ) {
      issues.push({
        code: "INVALID_VALUE",
        path,
        message: "A not-applicable target cannot carry target diagnostics."
      });
    }
    if (
      value.targetBodyId !== undefined ||
      value.targetTopologyAnchorId !== undefined
    ) {
      issues.push({
        code: "INVALID_VALUE",
        path,
        message: "A not-applicable target cannot identify a body or anchor."
      });
    }
  }
  if (isUnknownRecord(consumer)) {
    const targetApplies =
      consumer.featureKind === "extrude" &&
      (consumer.operationMode === "add" || consumer.operationMode === "cut");
    if (!targetApplies && value.status !== "not-applicable") {
      issues.push({
        code: "INVALID_VALUE",
        path: `${path}.status`,
        message: "Only extrude add/cut has target compatibility."
      });
    }
    if (targetApplies) {
      const requestedBodyId = consumer.targetBodyId;
      const requestedAnchorId = consumer.targetTopologyAnchorId;
      if (
        requestedBodyId === undefined &&
        requestedAnchorId === undefined &&
        value.status !== "missing"
      ) {
        issues.push({
          code: "INVALID_VALUE",
          path: `${path}.status`,
          message: "A missing add/cut target must report status 'missing'."
        });
      }
      if (
        requestedBodyId === undefined &&
        requestedAnchorId === undefined &&
        (value.targetBodyId !== undefined ||
          value.targetTopologyAnchorId !== undefined)
      ) {
        issues.push({
          code: "INVALID_VALUE",
          path,
          message: "An omitted target cannot report a body or anchor identity."
        });
      }
      if (
        typeof requestedBodyId === "string" &&
        value.status !== "ready" &&
        value.status !== "unsupported"
      ) {
        issues.push({
          code: "INVALID_VALUE",
          path: `${path}.status`,
          message:
            "A supplied add/cut target must report status 'ready' or 'unsupported'."
        });
      }
      if (
        typeof requestedBodyId === "string" &&
        (value.status === "ready" || value.status === "unsupported") &&
        value.targetBodyId !== requestedBodyId
      ) {
        issues.push({
          code: "INVALID_VALUE",
          path: `${path}.targetBodyId`,
          message:
            "Target compatibility must describe the requested target body."
        });
      }
      if (
        typeof requestedBodyId === "string" &&
        value.targetTopologyAnchorId !== undefined
      ) {
        issues.push({
          code: "INVALID_VALUE",
          path: `${path}.targetTopologyAnchorId`,
          message: "A direct body target cannot report a topology anchor."
        });
      }
      if (
        typeof requestedAnchorId === "string" &&
        !["ready", "unsupported", "missing", "stale"].includes(
          String(value.status)
        )
      ) {
        issues.push({
          code: "INVALID_VALUE",
          path: `${path}.status`,
          message:
            "An anchor target must report ready, unsupported, missing, or stale."
        });
      }
      if (
        typeof requestedAnchorId === "string" &&
        value.targetTopologyAnchorId !== requestedAnchorId
      ) {
        issues.push({
          code: "INVALID_VALUE",
          path: `${path}.targetTopologyAnchorId`,
          message:
            "Target compatibility must echo the requested topology anchor."
        });
      }
      if (
        typeof requestedAnchorId === "string" &&
        (value.status === "ready" || value.status === "unsupported") &&
        typeof value.targetBodyId !== "string"
      ) {
        issues.push({
          code: "MISSING_FIELD",
          path: `${path}.targetBodyId`,
          message:
            "A resolved anchor target must report its public targetBodyId."
        });
      }
      if (
        typeof requestedAnchorId === "string" &&
        value.status === "missing" &&
        value.targetBodyId !== undefined
      ) {
        issues.push({
          code: "INVALID_VALUE",
          path: `${path}.targetBodyId`,
          message: "A missing anchor cannot report a resolved target body."
        });
      }
    }
  }
}

function sameOrientedSegments(left: unknown, right: unknown): boolean {
  if (
    !Array.isArray(left) ||
    !Array.isArray(right) ||
    left.length !== right.length
  ) {
    return false;
  }
  return left.every((segment, index) => {
    const other = right[index];
    return (
      isUnknownRecord(segment) &&
      isUnknownRecord(other) &&
      segment.entityId === other.entityId &&
      segment.orientation === other.orientation
    );
  });
}

function sameProfileRef(left: unknown, right: unknown): boolean {
  if (
    !isUnknownRecord(left) ||
    !isUnknownRecord(right) ||
    left.kind !== right.kind
  ) {
    return false;
  }
  if (left.sketchId !== right.sketchId) return false;
  if (left.kind === "entity") return left.entityId === right.entityId;
  if (left.kind === "wire")
    return sameOrientedSegments(left.segments, right.segments);
  return false;
}

function samePathRef(left: unknown, right: unknown): boolean {
  if (
    !isUnknownRecord(left) ||
    !isUnknownRecord(right) ||
    left.kind !== right.kind
  ) {
    return false;
  }
  if (left.sketchId !== right.sketchId) return false;
  if (left.kind === "entity") {
    return (
      left.entityId === right.entityId && left.orientation === right.orientation
    );
  }
  if (left.kind === "chain")
    return sameOrientedSegments(left.segments, right.segments);
  return false;
}

function sameConsumerIntent(left: unknown, right: unknown): boolean {
  return (
    isUnknownRecord(left) &&
    isUnknownRecord(right) &&
    left.featureKind === right.featureKind &&
    left.operationMode === right.operationMode &&
    left.targetBodyId === right.targetBodyId &&
    left.targetTopologyAnchorId === right.targetTopologyAnchorId
  );
}

function validateResponseRequestConsistency(
  response: UnknownRecord,
  request: SketchProfilePathQueryRequest,
  issues: SketchProfilePathValidationIssue[]
): void {
  if (response.cadOpsVersion !== request.version) {
    issues.push({
      code: "INVALID_VALUE",
      path: "$.cadOpsVersion",
      message: "Response CADOps version does not match the request."
    });
  }
  if (response.query !== request.query.query) {
    issues.push({
      code: "INVALID_VALUE",
      path: "$.query",
      message: "Response query kind does not match the request."
    });
    return;
  }
  switch (request.query.query) {
    case "sketch.profileCandidates":
    case "sketch.pathCandidates":
      if (response.sketchId !== request.query.sketchId) {
        issues.push({
          code: "INVALID_VALUE",
          path: "$.sketchId",
          message: "Response sketchId does not match the request."
        });
      }
      break;
    case "sketch.profileReadiness":
      if (!sameProfileRef(response.requestedProfile, request.query.profile)) {
        issues.push({
          code: "INVALID_VALUE",
          path: "$.requestedProfile",
          message: "Response profile does not match the request."
        });
      }
      if (!sameConsumerIntent(response.consumer, request.query.consumer)) {
        issues.push({
          code: "INVALID_VALUE",
          path: "$.consumer",
          message: "Response consumer does not match the request."
        });
      }
      break;
    case "sketch.pathReadiness":
      if (!samePathRef(response.requestedPath, request.query.path)) {
        issues.push({
          code: "INVALID_VALUE",
          path: "$.requestedPath",
          message: "Response path does not match the request."
        });
      }
      if (
        (request.query.sweepProfile === undefined) !==
          (response.sweepProfile === undefined) ||
        (request.query.sweepProfile !== undefined &&
          !sameProfileRef(response.sweepProfile, request.query.sweepProfile))
      ) {
        issues.push({
          code: "INVALID_VALUE",
          path: "$.sweepProfile",
          message: "Response sweep profile does not match the request."
        });
      }
      break;
  }
}

export function validateSketchProfilePathQueryResponse(
  value: unknown,
  request?: unknown
): SketchProfilePathValidationResult<SketchProfilePathQueryResponse> {
  const issues: SketchProfilePathValidationIssue[] = [];
  if (!isUnknownRecord(value)) {
    return {
      ok: false,
      issues: [
        {
          code: "INVALID_TYPE",
          path: "$",
          message: "Expected a query response object."
        }
      ]
    };
  }
  let validatedRequest: SketchProfilePathQueryRequest | undefined;
  if (request !== undefined) {
    const requestResult = validateSketchProfilePathQueryRequest(request);
    if (requestResult.ok) {
      validatedRequest = requestResult.value;
    } else {
      issues.push({
        code: "INVALID_VALUE",
        path: "$request",
        message:
          "The supplied request is not a valid profile/path query request."
      });
    }
  }
  switch (value.query) {
    case "sketch.profileCandidates": {
      validateExactRecord(value, "$", PROFILE_RESPONSE_KEYS, [], issues);
      validateResponseEnvelope(value, "$", issues);
      validateDiagnosticArray(
        value.diagnostics,
        "$.diagnostics",
        PROFILE_DIAGNOSTIC_CODES,
        issues
      );
      validateNonEmptyString(value.sketchId, "$.sketchId", issues);
      validateEnum(value.status, ["ready", "blocked"], "$.status", issues);
      const candidates = validateCountedArray(
        value,
        "candidateCount",
        "candidates",
        "$",
        issues
      );
      const rejected = validateCountedArray(
        value,
        "rejectedComponentCount",
        "rejectedComponents",
        "$",
        issues
      );
      const exclusions = validateCountedArray(
        value,
        "constructionExclusionCount",
        "constructionExclusions",
        "$",
        issues
      );
      candidates.forEach((candidate, index) => {
        const path = `$.candidates[${index}]`;
        if (
          validateExactRecord(
            candidate,
            path,
            [
              "status",
              "candidateIndex",
              "sortKey",
              "profile",
              "orientation",
              "area",
              "signedArea",
              "bounds",
              "joinCount",
              "joins",
              "intersectionStatus",
              "dependencies",
              "diagnosticCount",
              "diagnostics"
            ],
            [],
            issues
          )
        ) {
          validateProfileRef(
            candidate.profile,
            `$.candidates[${index}].profile`,
            issues
          );
          if (candidate.status !== "ready") {
            issues.push({
              code: "INVALID_VALUE",
              path: `$.candidates[${index}].status`,
              message: "Candidates must be ready."
            });
          }
          validateNonNegativeInteger(
            candidate.candidateIndex,
            `${path}.candidateIndex`,
            issues
          );
          if (candidate.candidateIndex !== index) {
            issues.push({
              code: "INVALID_VALUE",
              path: `${path}.candidateIndex`,
              message: "candidateIndex must match deterministic array order."
            });
          }
          validateNonEmptyString(candidate.sortKey, `${path}.sortKey`, issues);
          validateEnum(
            candidate.orientation,
            ["counterclockwise"],
            `${path}.orientation`,
            issues
          );
          validatePositiveNumber(candidate.area, `${path}.area`, issues);
          validatePositiveNumber(
            candidate.signedArea,
            `${path}.signedArea`,
            issues
          );
          validateEnum(
            candidate.intersectionStatus,
            ["clear"],
            `${path}.intersectionStatus`,
            issues
          );
          validateBounds(candidate.bounds, `${path}.bounds`, issues);
          validateDependencies(
            candidate.dependencies,
            `${path}.dependencies`,
            issues
          );
          validateCountedArray(candidate, "joinCount", "joins", path, issues);
          validateCountedArray(
            candidate,
            "diagnosticCount",
            "diagnostics",
            path,
            issues
          );
          validateDiagnosticArray(
            candidate.diagnostics,
            `${path}.diagnostics`,
            PROFILE_DIAGNOSTIC_CODES,
            issues
          );
          validateJoinArray(candidate.joins, `${path}.joins`, false, issues);
        }
      });
      rejected.forEach((component, index) => {
        const path = `$.rejectedComponents[${index}]`;
        if (
          validateExactRecord(
            component,
            path,
            [
              "status",
              "componentIndex",
              "sortKey",
              "sketchId",
              "entityIds",
              "closed",
              "branchFree",
              "intersectionStatus",
              "joinCount",
              "joins",
              "diagnosticCount",
              "diagnostics"
            ],
            ["bounds", "area"],
            issues
          )
        ) {
          validateEnum(component.status, ["blocked"], `${path}.status`, issues);
          validateNonNegativeInteger(
            component.componentIndex,
            `${path}.componentIndex`,
            issues
          );
          if (component.componentIndex !== index) {
            issues.push({
              code: "INVALID_VALUE",
              path: `${path}.componentIndex`,
              message: "componentIndex must match deterministic array order."
            });
          }
          validateNonEmptyString(component.sortKey, `${path}.sortKey`, issues);
          validateNonEmptyString(
            component.sketchId,
            `${path}.sketchId`,
            issues
          );
          validateIdArray(component.entityIds, `${path}.entityIds`, issues);
          validateBoolean(component.closed, `${path}.closed`, issues);
          validateBoolean(component.branchFree, `${path}.branchFree`, issues);
          validateEnum(
            component.intersectionStatus,
            ["clear", "self-intersecting", "overlapping", "not-evaluated"],
            `${path}.intersectionStatus`,
            issues
          );
          if ("area" in component) {
            validateNonNegativeNumber(component.area, `${path}.area`, issues);
          }
          if ("bounds" in component)
            validateBounds(component.bounds, `${path}.bounds`, issues);
          validateCountedArray(component, "joinCount", "joins", path, issues);
          validateCountedArray(
            component,
            "diagnosticCount",
            "diagnostics",
            path,
            issues
          );
          validateDiagnosticArray(
            component.diagnostics,
            `${path}.diagnostics`,
            PROFILE_DIAGNOSTIC_CODES,
            issues
          );
          validateJoinArray(component.joins, `${path}.joins`, false, issues);
        }
      });
      exclusions.forEach((exclusion, index) => {
        if (
          validateExactRecord(
            exclusion,
            `$.constructionExclusions[${index}]`,
            ["entityId", "entityKind", "diagnostic"],
            [],
            issues
          )
        ) {
          validateNonEmptyString(
            exclusion.entityId,
            `$.constructionExclusions[${index}].entityId`,
            issues
          );
          validateEnum(
            exclusion.entityKind,
            ["rectangle", "circle", "line", "arc"],
            `$.constructionExclusions[${index}].entityKind`,
            issues
          );
          validateDiagnosticArray(
            [exclusion.diagnostic],
            `$.constructionExclusions[${index}].diagnostics`,
            PROFILE_DIAGNOSTIC_CODES,
            issues
          );
          if (
            isUnknownRecord(exclusion.diagnostic) &&
            exclusion.diagnostic.code !== "SKETCH_PROFILE_CONSTRUCTION_ENTITY"
          ) {
            issues.push({
              code: "INVALID_VALUE",
              path: `$.constructionExclusions[${index}].diagnostic.code`,
              message:
                "A construction exclusion requires SKETCH_PROFILE_CONSTRUCTION_ENTITY."
            });
          }
        }
      });
      break;
    }
    case "sketch.pathCandidates": {
      validateExactRecord(value, "$", PATH_RESPONSE_KEYS, [], issues);
      validateResponseEnvelope(value, "$", issues);
      validateDiagnosticArray(
        value.diagnostics,
        "$.diagnostics",
        PATH_DIAGNOSTIC_CODES,
        issues
      );
      validateNonEmptyString(value.sketchId, "$.sketchId", issues);
      validateEnum(value.status, ["ready", "blocked"], "$.status", issues);
      const candidates = validateCountedArray(
        value,
        "candidateCount",
        "candidates",
        "$",
        issues
      );
      const rejected = validateCountedArray(
        value,
        "rejectedComponentCount",
        "rejectedComponents",
        "$",
        issues
      );
      candidates.forEach((candidate, index) => {
        const path = `$.candidates[${index}]`;
        if (
          validateExactRecord(
            candidate,
            path,
            [
              "status",
              "candidateIndex",
              "sortKey",
              "path",
              "length",
              "bounds",
              "connectionStatus",
              "tangentStatus",
              "selfIntersectionStatus",
              "joinCount",
              "joins",
              "dependencies",
              "diagnosticCount",
              "diagnostics"
            ],
            [],
            issues
          )
        ) {
          validatePathRef(
            candidate.path,
            `$.candidates[${index}].path`,
            issues
          );
          if (candidate.status !== "ready") {
            issues.push({
              code: "INVALID_VALUE",
              path: `$.candidates[${index}].status`,
              message: "Candidates must be ready."
            });
          }
          validateNonNegativeInteger(
            candidate.candidateIndex,
            `${path}.candidateIndex`,
            issues
          );
          if (candidate.candidateIndex !== index) {
            issues.push({
              code: "INVALID_VALUE",
              path: `${path}.candidateIndex`,
              message: "candidateIndex must match deterministic array order."
            });
          }
          validateNonEmptyString(candidate.sortKey, `${path}.sortKey`, issues);
          validatePositiveNumber(candidate.length, `${path}.length`, issues);
          validateEnum(
            candidate.connectionStatus,
            ["connected"],
            `${path}.connectionStatus`,
            issues
          );
          validateEnum(
            candidate.tangentStatus,
            ["tangent"],
            `${path}.tangentStatus`,
            issues
          );
          validateEnum(
            candidate.selfIntersectionStatus,
            ["clear"],
            `${path}.selfIntersectionStatus`,
            issues
          );
          validateBounds(candidate.bounds, `${path}.bounds`, issues);
          validateDependencies(
            candidate.dependencies,
            `${path}.dependencies`,
            issues
          );
          validateCountedArray(candidate, "joinCount", "joins", path, issues);
          validateCountedArray(
            candidate,
            "diagnosticCount",
            "diagnostics",
            path,
            issues
          );
          validateDiagnosticArray(
            candidate.diagnostics,
            `${path}.diagnostics`,
            PATH_DIAGNOSTIC_CODES,
            issues
          );
          validateJoinArray(candidate.joins, `${path}.joins`, true, issues);
        }
      });
      rejected.forEach((component, index) => {
        const path = `$.rejectedComponents[${index}]`;
        if (
          validateExactRecord(
            component,
            path,
            [
              "status",
              "componentIndex",
              "sortKey",
              "sketchId",
              "entityIds",
              "connectionStatus",
              "tangentStatus",
              "selfIntersectionStatus",
              "joinCount",
              "joins",
              "diagnosticCount",
              "diagnostics"
            ],
            ["bounds"],
            issues
          )
        ) {
          validateEnum(component.status, ["blocked"], `${path}.status`, issues);
          validateNonNegativeInteger(
            component.componentIndex,
            `${path}.componentIndex`,
            issues
          );
          if (component.componentIndex !== index) {
            issues.push({
              code: "INVALID_VALUE",
              path: `${path}.componentIndex`,
              message: "componentIndex must match deterministic array order."
            });
          }
          validateNonEmptyString(component.sortKey, `${path}.sortKey`, issues);
          validateNonEmptyString(
            component.sketchId,
            `${path}.sketchId`,
            issues
          );
          validateIdArray(component.entityIds, `${path}.entityIds`, issues);
          validateEnum(
            component.connectionStatus,
            ["connected", "disconnected", "branching"],
            `${path}.connectionStatus`,
            issues
          );
          validateEnum(
            component.tangentStatus,
            ["tangent", "not-tangent", "not-evaluated"],
            `${path}.tangentStatus`,
            issues
          );
          validateEnum(
            component.selfIntersectionStatus,
            ["clear", "self-intersecting", "not-evaluated"],
            `${path}.selfIntersectionStatus`,
            issues
          );
          if ("bounds" in component)
            validateBounds(component.bounds, `${path}.bounds`, issues);
          validateCountedArray(component, "joinCount", "joins", path, issues);
          validateCountedArray(
            component,
            "diagnosticCount",
            "diagnostics",
            path,
            issues
          );
          validateDiagnosticArray(
            component.diagnostics,
            `${path}.diagnostics`,
            PATH_DIAGNOSTIC_CODES,
            issues
          );
          validateJoinArray(component.joins, `${path}.joins`, true, issues);
        }
      });
      break;
    }
    case "sketch.profileReadiness":
      validateExactRecord(
        value,
        "$",
        [
          "ok",
          "query",
          "cadOpsVersion",
          "status",
          "requestedProfile",
          "consumer",
          "consumerCompatibility",
          "targetCompatibility",
          "dependencies",
          "joinCount",
          "joins",
          "intersectionStatus",
          "orientationNormalized",
          "diagnosticCount",
          "diagnostics"
        ],
        PROFILE_READINESS_KEYS.filter(
          (key) =>
            ![
              "ok",
              "query",
              "cadOpsVersion",
              "status",
              "requestedProfile",
              "consumer",
              "consumerCompatibility",
              "targetCompatibility",
              "dependencies",
              "joinCount",
              "joins",
              "intersectionStatus",
              "orientationNormalized",
              "diagnosticCount",
              "diagnostics"
            ].includes(key)
        ),
        issues
      );
      validateResponseEnvelope(value, "$", issues);
      validateDiagnosticArray(
        value.diagnostics,
        "$.diagnostics",
        PROFILE_DIAGNOSTIC_CODES,
        issues
      );
      validateProfileRef(value.requestedProfile, "$.requestedProfile", issues);
      if ("normalizedProfile" in value)
        validateProfileRef(
          value.normalizedProfile,
          "$.normalizedProfile",
          issues
        );
      validateProfileConsumer(value.consumer, "$.consumer", issues);
      validateConsumerCompatibility(
        value.consumerCompatibility,
        "$.consumerCompatibility",
        value.consumer,
        issues
      );
      validateTargetCompatibility(
        value.targetCompatibility,
        "$.targetCompatibility",
        value.consumer,
        issues
      );
      validateDependencies(value.dependencies, "$.dependencies", issues);
      validateCountedArray(value, "joinCount", "joins", "$", issues);
      validateJoinArray(value.joins, "$.joins", false, issues);
      if ("bounds" in value) validateBounds(value.bounds, "$.bounds", issues);
      validateBoolean(
        value.orientationNormalized,
        "$.orientationNormalized",
        issues
      );
      validateEnum(
        value.intersectionStatus,
        ["clear", "self-intersecting", "overlapping", "not-evaluated"],
        "$.intersectionStatus",
        issues
      );
      if ("orientation" in value) {
        validateEnum(
          value.orientation,
          ["clockwise", "counterclockwise"],
          "$.orientation",
          issues
        );
      }
      if ("area" in value) {
        validateNonNegativeNumber(value.area, "$.area", issues);
      }
      if ("signedArea" in value) {
        validateFiniteNumber(value.signedArea, "$.signedArea", issues);
      }
      if (value.status === "ready") {
        for (const key of [
          "normalizedProfile",
          "orientation",
          "area",
          "signedArea",
          "bounds"
        ]) {
          if (!(key in value))
            issues.push({
              code: "MISSING_FIELD",
              path: `$.${key}`,
              message: `Ready response requires '${key}'.`
            });
        }
        validateEnum(
          value.orientation,
          ["counterclockwise"],
          "$.orientation",
          issues
        );
        validatePositiveNumber(value.area, "$.area", issues);
        validatePositiveNumber(value.signedArea, "$.signedArea", issues);
        validateEnum(
          value.intersectionStatus,
          ["clear"],
          "$.intersectionStatus",
          issues
        );
        if (
          !isUnknownRecord(value.consumerCompatibility) ||
          value.consumerCompatibility.status !== "ready"
        ) {
          issues.push({
            code: "INVALID_VALUE",
            path: "$.consumerCompatibility.status",
            message: "A ready profile requires ready consumer compatibility."
          });
        }
        if (
          isUnknownRecord(value.consumer) &&
          value.consumer.featureKind === "extrude" &&
          (value.consumer.operationMode === "add" ||
            value.consumer.operationMode === "cut") &&
          (!isUnknownRecord(value.targetCompatibility) ||
            value.targetCompatibility.status !== "ready")
        ) {
          issues.push({
            code: "INVALID_VALUE",
            path: "$.targetCompatibility.status",
            message:
              "A ready add/cut profile requires ready target compatibility."
          });
        }
      } else if (value.status !== "blocked") {
        issues.push({
          code: "INVALID_VALUE",
          path: "$.status",
          message: "Invalid readiness status."
        });
      }
      break;
    case "sketch.pathReadiness":
      validateExactRecord(
        value,
        "$",
        [
          "ok",
          "query",
          "cadOpsVersion",
          "status",
          "requestedPath",
          "consumer",
          "dependencies",
          "connectionStatus",
          "tangentStatus",
          "selfIntersectionStatus",
          "frameStatus",
          "joinCount",
          "joins",
          "diagnosticCount",
          "diagnostics"
        ],
        PATH_READINESS_KEYS.filter(
          (key) =>
            ![
              "ok",
              "query",
              "cadOpsVersion",
              "status",
              "requestedPath",
              "consumer",
              "dependencies",
              "connectionStatus",
              "tangentStatus",
              "selfIntersectionStatus",
              "frameStatus",
              "joinCount",
              "joins",
              "diagnosticCount",
              "diagnostics"
            ].includes(key)
        ),
        issues
      );
      validateResponseEnvelope(value, "$", issues);
      validateDiagnosticArray(
        value.diagnostics,
        "$.diagnostics",
        PATH_DIAGNOSTIC_CODES,
        issues
      );
      validatePathRef(value.requestedPath, "$.requestedPath", issues);
      if ("normalizedPath" in value)
        validatePathRef(value.normalizedPath, "$.normalizedPath", issues);
      if ("sweepProfile" in value)
        validateProfileRef(value.sweepProfile, "$.sweepProfile", issues, true);
      if (
        validateExactRecord(
          value.consumer,
          "$.consumer",
          ["featureKind", "operationMode"],
          [],
          issues
        )
      ) {
        if (
          value.consumer.featureKind !== "sweep" ||
          value.consumer.operationMode !== "newBody"
        ) {
          issues.push({
            code: "INVALID_VALUE",
            path: "$.consumer",
            message: "Path readiness is sweep newBody only."
          });
        }
      }
      validateDependencies(value.dependencies, "$.dependencies", issues);
      validateCountedArray(value, "joinCount", "joins", "$", issues);
      validateJoinArray(value.joins, "$.joins", true, issues);
      if ("bounds" in value) validateBounds(value.bounds, "$.bounds", issues);
      validateEnum(
        value.connectionStatus,
        ["connected", "disconnected", "branching"],
        "$.connectionStatus",
        issues
      );
      validateEnum(
        value.tangentStatus,
        ["tangent", "not-tangent", "not-evaluated"],
        "$.tangentStatus",
        issues
      );
      validateEnum(
        value.selfIntersectionStatus,
        ["clear", "self-intersecting", "not-evaluated"],
        "$.selfIntersectionStatus",
        issues
      );
      validateEnum(
        value.frameStatus,
        ["ready", "invalid", "not-evaluated"],
        "$.frameStatus",
        issues
      );
      if ("length" in value) {
        validateNonNegativeNumber(value.length, "$.length", issues);
      }
      if (value.status === "ready") {
        for (const key of ["normalizedPath", "length", "bounds"]) {
          if (!(key in value))
            issues.push({
              code: "MISSING_FIELD",
              path: `$.${key}`,
              message: `Ready response requires '${key}'.`
            });
        }
        validateEnum(
          value.connectionStatus,
          ["connected"],
          "$.connectionStatus",
          issues
        );
        validateEnum(
          value.tangentStatus,
          ["tangent"],
          "$.tangentStatus",
          issues
        );
        validateEnum(
          value.selfIntersectionStatus,
          ["clear"],
          "$.selfIntersectionStatus",
          issues
        );
        validateEnum(
          value.frameStatus,
          ["ready", "not-evaluated"],
          "$.frameStatus",
          issues
        );
        validatePositiveNumber(value.length, "$.length", issues);
      } else if (value.status !== "blocked") {
        issues.push({
          code: "INVALID_VALUE",
          path: "$.status",
          message: "Invalid readiness status."
        });
      }
      if (!("sweepProfile" in value) && value.frameStatus !== "not-evaluated") {
        issues.push({
          code: "INVALID_VALUE",
          path: "$.frameStatus",
          message: "Frame status requires a sweep profile to evaluate."
        });
      }
      if (
        value.status === "ready" &&
        "sweepProfile" in value &&
        value.frameStatus !== "ready"
      ) {
        issues.push({
          code: "INVALID_VALUE",
          path: "$.frameStatus",
          message: "A ready path with a sweep profile requires a ready frame."
        });
      }
      break;
    default:
      issues.push({
        code: "INVALID_VALUE",
        path: "$.query",
        message: "Unknown profile/path response kind."
      });
  }
  if (validatedRequest) {
    validateResponseRequestConsistency(value, validatedRequest, issues);
  }
  return issues.length === 0
    ? { ok: true, value: value as unknown as SketchProfilePathQueryResponse }
    : { ok: false, issues };
}

export const protocolPackage: PackageInfo = {
  name: "@web-cad/cad-protocol",
  status: "ready"
};
