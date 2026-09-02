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
export type DatumId = string;
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
  | "web-cad.project.v21"
  | "web-cad.project.v22";
export type CadTopologyIdentityContractVersion =
  "partbench.topology-identity.v1";
export type CadTopologyIdentityProjectSchemaVersion = "web-cad.project.v18";
export type CadTopologyIdentityPackageVersion = "partbench.wcad.v2";
export type CadV15ProjectSchemaVersion = "web-cad.project.v19";
export type CadV16ProjectSchemaVersion = "web-cad.project.v20";
export type CadV17ProjectSchemaVersion = "web-cad.project.v21";
export type CadV19ProjectSchemaVersion = "web-cad.project.v22";
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
export const CAD_V19_PROJECT_SCHEMA_VERSION: CadV19ProjectSchemaVersion =
  "web-cad.project.v22";

export const CAD_V19_SKETCH_GEOMETRY_POLICY = {
  linearTolerance: 1e-7,
  angularToleranceDegrees: 0.1,
  minimumProfileArea: 1e-12
} as const;

export const CAD_V19_RESOURCE_LIMITS = {
  maxSketchEntitiesPerEditedSketch: 4_096,
  maxBoundaryEntityIdsPerCurveEdit: 256,
  maxSplitPointsPerCommand: 1_024,
  maxOffsetSourceSegments: 1_024,
  maxRegionsPerProfile: 256,
  maxLoopsPerProfile: 512,
  maxSegmentReferencesPerProfile: 4_096,
  maxDiscoveredCandidateRegions: 512,
  maxCandidatePairEdgeVisits: 250_000,
  maxSubmittedProfilePredicateVisits: 100_000,
  maxRegionCandidatesPerPage: 100
} as const;

export const CAD_V21_EXACT_EXPORT_RESOURCE_LIMITS = {
  maxSelectedBodies: 256,
  maxSourceGraphNodes: 4_096,
  maxBrepArtifactBytes: 128 * 1024 * 1024,
  maxAggregateBrepArtifactBytes: 512 * 1024 * 1024,
  maxStepArtifactBytes: 512 * 1024 * 1024
} as const;

export const CAD_V21_1_EXACT_CACHE_RESOURCE_LIMITS = {
  maxEntryBytes: CAD_V21_EXACT_EXPORT_RESOURCE_LIMITS.maxBrepArtifactBytes,
  maxRetainedBytes:
    CAD_V21_EXACT_EXPORT_RESOURCE_LIMITS.maxAggregateBrepArtifactBytes
} as const;

export type CadProjectSchemaDiagnosticCode =
  | "SCHEMA_UPGRADED_TO_V21"
  | "SCHEMA_V21_SOURCE_INVALID"
  | "SCHEMA_UPGRADED_TO_V22"
  | "SCHEMA_V22_SOURCE_INVALID";

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

export type SketchEntityKindV21 = SketchEntityKindV20 | "arc";
export type SketchEntityKind = SketchEntityKindV21 | "spline";

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

export interface SketchEntityLoopRef {
  readonly kind: "entity";
  readonly entityId: SketchEntityId;
}

export interface SketchWireLoopRef {
  readonly kind: "wire";
  readonly segments: readonly OrientedSketchSegmentRef[];
}

export type SketchLoopRef = SketchEntityLoopRef | SketchWireLoopRef;

export interface SketchProfileRegionRef {
  readonly outer: SketchLoopRef;
  readonly holes: readonly SketchLoopRef[];
}

export interface SketchRegionsProfileRef {
  readonly kind: "regions";
  readonly sketchId: SketchId;
  readonly regions: readonly [
    SketchProfileRegionRef,
    ...SketchProfileRegionRef[]
  ];
}

export type SketchProfileRefV22 =
  | SketchEntityProfileRef
  | SketchWireProfileRef
  | SketchRegionsProfileRef;

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

export type SketchPointTargetV22 =
  | {
      readonly entityId: SketchEntityId;
      readonly entityKind: "point";
      readonly role: "position";
    }
  | {
      readonly entityId: SketchEntityId;
      readonly entityKind: "line";
      readonly role: "start" | "end";
    }
  | {
      readonly entityId: SketchEntityId;
      readonly entityKind: "rectangle" | "circle";
      readonly role: "center";
    }
  | {
      readonly entityId: SketchEntityId;
      readonly entityKind: "arc";
      readonly role: "center" | "start" | "end";
    };

export type SketchMidpointTargetV22 =
  | Extract<SketchPointTargetV22, { readonly entityKind: "point" }>
  | Extract<
      SketchPointTargetV22,
      { readonly entityKind: "rectangle" | "circle" }
    >;

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
  | "SKETCH_ARC_DIMENSION_INVALID"
  | "SKETCH_DIMENSION_TARGET_UNSUPPORTED"
  | "SKETCH_DIMENSION_ANGLE_SENSE_INVALID"
  | "SKETCH_DIMENSION_DISTANCE_INVALID";

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

export type SketchEntityScalarDimensionTargetV22 =
  | {
      readonly kind: "entityScalar";
      readonly entityId: SketchEntityId;
      readonly entityKind: "rectangle";
      readonly role: "width" | "height";
    }
  | {
      readonly kind: "entityScalar";
      readonly entityId: SketchEntityId;
      readonly entityKind: "line";
      readonly role: "length";
    }
  | {
      readonly kind: "entityScalar";
      readonly entityId: SketchEntityId;
      readonly entityKind: "circle";
      readonly role: "radius" | "diameter";
    }
  | {
      readonly kind: "entityScalar";
      readonly entityId: SketchEntityId;
      readonly entityKind: "arc";
      readonly role: "radius" | "diameter" | "sweep";
    };

export interface SketchEuclideanPointPairDimensionTargetV22 {
  readonly kind: "pointPair";
  readonly primary: SketchPointTargetV22;
  readonly secondary: SketchPointTargetV22;
  readonly measurement: "distance";
}

export interface SketchDirectedPointPairDimensionTargetV22 {
  readonly kind: "pointPair";
  readonly primary: SketchPointTargetV22;
  readonly secondary: SketchPointTargetV22;
  readonly measurement: "horizontal" | "vertical";
  readonly direction: "positive" | "negative";
}

export type SketchPointPairDimensionTargetV22 =
  | SketchEuclideanPointPairDimensionTargetV22
  | SketchDirectedPointPairDimensionTargetV22;

export interface SketchPointLineDimensionTargetV22 {
  readonly kind: "pointLineDistance";
  readonly point: SketchPointTargetV22;
  readonly lineEntityId: SketchEntityId;
  readonly side: "left" | "right";
}

export interface SketchLineAngleDimensionTargetV22 {
  readonly kind: "lineAngle";
  readonly primaryLineEntityId: SketchEntityId;
  readonly secondaryLineEntityId: SketchEntityId;
  readonly sense: "clockwise" | "counterclockwise";
}

export type SketchDimensionTargetV22 =
  | SketchEntityScalarDimensionTargetV22
  | SketchPointPairDimensionTargetV22
  | SketchPointLineDimensionTargetV22
  | SketchLineAngleDimensionTargetV22;

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
  | DatumPlaneCreateOp
  | DatumAxisCreateOp
  | SketchRenameOp
  | SketchDeleteOp
  | SketchAddPointOp
  | SketchAddLineOp
  | SketchAddRectangleOp
  | SketchAddCircleOp
  | SketchAddArcOp
  | SketchAddSplineOp
  | SketchUpdateEntityOp
  | SketchDeleteEntityOp
  | SketchSetEntityConstructionOp
  | SketchCurveEditOp
  | SketchAddSlotOp
  | SketchAddRoundedRectangleOp
  | SketchDimensionCreateCommandInput
  | SketchDimensionUpdateCommandInput
  | SketchDimensionRenameOp
  | SketchDimensionDeleteOp
  | SketchConstraintCreateOp
  | SketchConstraintUpdateOpV19
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
  | FeatureCombineOp
  | FeatureOffsetOp
  | FeatureAlignOp
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
  | FeatureUpdateOffsetOp
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

export const CAD_EXACT_DOWNSTREAM_GEOMETRY_OPS = [
  "feature.hole",
  "feature.updateHole",
  "feature.linearPattern",
  "feature.updateLinearPattern",
  "feature.circularPattern",
  "feature.updateCircularPattern",
  "feature.mirror",
  "feature.updateMirror",
  "feature.shell",
  "feature.updateShell"
] as const satisfies readonly CadOp["op"][];

export type CadExactDownstreamGeometryOp = Extract<
  CadOp,
  { readonly op: (typeof CAD_EXACT_DOWNSTREAM_GEOMETRY_OPS)[number] }
>;

export function isCadExactDownstreamGeometryOp(
  op: CadOp
): op is CadExactDownstreamGeometryOp {
  return (CAD_EXACT_DOWNSTREAM_GEOMETRY_OPS as readonly string[]).includes(
    op.op
  );
}

export type CadV19Op =
  | SketchCurveEditOp
  | SketchAddSlotOp
  | SketchAddRoundedRectangleOp
  | SketchDimensionCreateOpV22
  | SketchDimensionUpdateOpV22
  | SketchEqualLengthConstraintCreateOp
  | SketchNormalizedPointConstraintCreateOpV19
  | SketchConstraintUpdateOpV19
  | (Omit<FeatureExtrudeOpV22, "profile"> & {
      readonly profile: SketchRegionsProfileRef;
    })
  | (Omit<FeatureRevolveOpV22, "profile"> & {
      readonly profile: SketchRegionsProfileRef;
    })
  | (FeatureUpdateExtrudeOpV22 & {
      readonly profile: SketchRegionsProfileRef;
    })
  | (Omit<FeatureUpdateRevolveOp, "angleDegrees"> & {
      readonly angleDegrees?: number;
      readonly profile: SketchRegionsProfileRef;
      readonly sketchId?: never;
      readonly entityId?: never;
    });

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
  readonly plane?: SketchPlane;
  readonly datumId?: DatumId;
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

export type SketchSplineDefinition =
  | SketchSplineInterpolationDefinition
  | SketchSplineControlPointsDefinition;

export interface SketchSplineInterpolationDefinition {
  readonly kind: "interpolation";
  readonly points: readonly Vec2[];
  readonly closed?: boolean;
}

export interface SketchSplineControlPointsDefinition {
  readonly kind: "controlPoints";
  readonly points: readonly Vec2[];
  readonly degree?: number;
  readonly closed?: boolean;
}

export interface SketchAddSplineOp {
  readonly op: "sketch.addSpline";
  readonly sketchId: SketchId;
  readonly id?: SketchEntityId;
  readonly construction?: boolean;
  readonly definition: SketchSplineDefinition;
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
  | SketchArcEntity
  | SketchSplineEntity;

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

export interface SketchCurveEditPrecondition {
  readonly expectedSourceRevision: string;
  readonly expectedSolverEvaluationIdentity: string;
}

export interface SketchTrimOp {
  readonly op: "sketch.trim";
  readonly sketchId: SketchId;
  readonly precondition: SketchCurveEditPrecondition;
  readonly entityId: SketchEntityId;
  readonly boundaryEntityIds: readonly SketchEntityId[];
  readonly pickPoint: Vec2;
  readonly createdEntityIds?: readonly SketchEntityId[];
  readonly deleteConstraintIds?: readonly SketchConstraintId[];
  readonly deleteDimensionIds?: readonly SketchDimensionId[];
}

export interface SketchExtendOp {
  readonly op: "sketch.extend";
  readonly sketchId: SketchId;
  readonly precondition: SketchCurveEditPrecondition;
  readonly entityId: SketchEntityId;
  readonly endpoint: "start" | "end";
  readonly boundaryEntityIds: readonly SketchEntityId[];
  readonly deleteConstraintIds?: readonly SketchConstraintId[];
  readonly deleteDimensionIds?: readonly SketchDimensionId[];
}

export interface SketchSplitOp {
  readonly op: "sketch.split";
  readonly sketchId: SketchId;
  readonly precondition: SketchCurveEditPrecondition;
  readonly entityId: SketchEntityId;
  readonly splitPoints: readonly Vec2[];
  readonly createdEntityIds?: readonly SketchEntityId[];
  readonly deleteConstraintIds?: readonly SketchConstraintId[];
  readonly deleteDimensionIds?: readonly SketchDimensionId[];
}

export interface SketchExplodeRectangleOp {
  readonly op: "sketch.explodeRectangle";
  readonly sketchId: SketchId;
  readonly precondition: SketchCurveEditPrecondition;
  readonly entityId: SketchEntityId;
  readonly lineEntityIds?: readonly [
    SketchEntityId,
    SketchEntityId,
    SketchEntityId,
    SketchEntityId
  ];
  readonly deleteConstraintIds?: readonly SketchConstraintId[];
  readonly deleteDimensionIds?: readonly SketchDimensionId[];
}

export type SketchOffsetSource =
  | {
      readonly kind: "entity";
      readonly entityId: SketchEntityId;
    }
  | {
      readonly kind: "chain";
      readonly segments: readonly OrientedSketchSegmentRef[];
      readonly closed: boolean;
    };

export interface SketchOffsetOp {
  readonly op: "sketch.offset";
  readonly sketchId: SketchId;
  readonly precondition: SketchCurveEditPrecondition;
  readonly source: SketchOffsetSource;
  readonly distance: number;
  readonly side: "left" | "right" | "inward" | "outward";
  readonly referencePoint?: Vec2;
  readonly createdEntityIds?: readonly SketchEntityId[];
}

export type SketchCurveEditOp =
  | SketchTrimOp
  | SketchExtendOp
  | SketchSplitOp
  | SketchExplodeRectangleOp
  | SketchOffsetOp;

export type SketchCurveEditProposal =
  | (Omit<
      SketchTrimOp,
      | "op"
      | "precondition"
      | "createdEntityIds"
      | "deleteConstraintIds"
      | "deleteDimensionIds"
    > & { readonly kind: "trim" })
  | (Omit<
      SketchExtendOp,
      "op" | "precondition" | "deleteConstraintIds" | "deleteDimensionIds"
    > & { readonly kind: "extend" })
  | (Omit<
      SketchSplitOp,
      | "op"
      | "precondition"
      | "createdEntityIds"
      | "deleteConstraintIds"
      | "deleteDimensionIds"
    > & { readonly kind: "split" })
  | (Omit<
      SketchExplodeRectangleOp,
      | "op"
      | "precondition"
      | "lineEntityIds"
      | "deleteConstraintIds"
      | "deleteDimensionIds"
    > & { readonly kind: "explodeRectangle" })
  | (Omit<SketchOffsetOp, "op" | "precondition" | "createdEntityIds"> & {
      readonly kind: "offset";
    });

export type PreparedSketchCurveEditOp =
  | (Omit<
      SketchTrimOp,
      "createdEntityIds" | "deleteConstraintIds" | "deleteDimensionIds"
    > & {
      readonly createdEntityIds: readonly SketchEntityId[];
      readonly deleteConstraintIds: readonly SketchConstraintId[];
      readonly deleteDimensionIds: readonly SketchDimensionId[];
    })
  | (Omit<SketchExtendOp, "deleteConstraintIds" | "deleteDimensionIds"> & {
      readonly deleteConstraintIds: readonly SketchConstraintId[];
      readonly deleteDimensionIds: readonly SketchDimensionId[];
    })
  | (Omit<
      SketchSplitOp,
      "createdEntityIds" | "deleteConstraintIds" | "deleteDimensionIds"
    > & {
      readonly createdEntityIds: readonly SketchEntityId[];
      readonly deleteConstraintIds: readonly SketchConstraintId[];
      readonly deleteDimensionIds: readonly SketchDimensionId[];
    })
  | (Omit<
      SketchExplodeRectangleOp,
      "lineEntityIds" | "deleteConstraintIds" | "deleteDimensionIds"
    > & {
      readonly lineEntityIds: readonly [
        SketchEntityId,
        SketchEntityId,
        SketchEntityId,
        SketchEntityId
      ];
      readonly deleteConstraintIds: readonly SketchConstraintId[];
      readonly deleteDimensionIds: readonly SketchDimensionId[];
    })
  | (Omit<SketchOffsetOp, "createdEntityIds"> & {
      readonly createdEntityIds: readonly SketchEntityId[];
    });

export interface SketchAddSlotOp {
  readonly op: "sketch.addSlot";
  readonly sketchId: SketchId;
  readonly centerlineStart: Vec2;
  readonly centerlineEnd: Vec2;
  readonly radius: number;
  readonly construction?: boolean;
  readonly entityIds?: readonly [
    SketchEntityId,
    SketchEntityId,
    SketchEntityId,
    SketchEntityId
  ];
  readonly constraintIds?: readonly [
    SketchConstraintId,
    SketchConstraintId,
    SketchConstraintId,
    SketchConstraintId,
    SketchConstraintId,
    SketchConstraintId,
    SketchConstraintId,
    SketchConstraintId,
    SketchConstraintId
  ];
}

export interface SketchAddRoundedRectangleOp {
  readonly op: "sketch.addRoundedRectangle";
  readonly sketchId: SketchId;
  readonly center: Vec2;
  readonly width: number;
  readonly height: number;
  readonly cornerRadius: number;
  readonly construction?: boolean;
  readonly entityIds?: readonly [
    SketchEntityId,
    SketchEntityId,
    SketchEntityId,
    SketchEntityId,
    SketchEntityId,
    SketchEntityId,
    SketchEntityId,
    SketchEntityId
  ];
  readonly constraintIds?: readonly [
    SketchConstraintId,
    SketchConstraintId,
    SketchConstraintId,
    SketchConstraintId,
    SketchConstraintId,
    SketchConstraintId,
    SketchConstraintId,
    SketchConstraintId,
    SketchConstraintId,
    SketchConstraintId,
    SketchConstraintId,
    SketchConstraintId,
    SketchConstraintId,
    SketchConstraintId,
    SketchConstraintId,
    SketchConstraintId,
    SketchConstraintId,
    SketchConstraintId,
    SketchConstraintId,
    SketchConstraintId,
    SketchConstraintId,
    SketchConstraintId,
    SketchConstraintId
  ];
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

export interface SketchDimensionCreateOpV22 {
  readonly op: "sketch.dimension.create";
  readonly id?: SketchDimensionId;
  readonly name: string;
  readonly sketchId: SketchId;
  readonly target: SketchDimensionTargetV22;
  readonly value?: number;
  readonly parameterId?: ParameterId;
  readonly entityId?: never;
}

export type SketchDimensionCreateCommandInput =
  | SketchDimensionCreateOp
  | SketchDimensionCreateOpV22;

export interface SketchDimensionUpdateOp {
  readonly op: "sketch.dimension.update";
  readonly id: SketchDimensionId;
  readonly value?: number;
  readonly parameterId?: ParameterId;
}

export interface SketchDimensionUpdateOpV22 {
  readonly op: "sketch.dimension.update";
  readonly id: SketchDimensionId;
  readonly target?: SketchDimensionTargetV22;
  readonly value?: number;
  readonly parameterId?: ParameterId;
}

export type SketchDimensionUpdateCommandInput =
  | SketchDimensionUpdateOp
  | SketchDimensionUpdateOpV22;

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
  | SketchEqualLengthConstraintCreateOp
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
  readonly target: SketchPointTarget | SketchPointTargetV22;
  readonly coordinate?: Vec2;
}

export interface SketchCoincidentConstraintCreateOp {
  readonly op: "sketch.constraint.create";
  readonly id?: SketchConstraintId;
  readonly name: string;
  readonly sketchId: SketchId;
  readonly kind: "coincident";
  readonly primaryTarget: SketchPointTarget | SketchPointTargetV22;
  readonly secondaryTarget: SketchPointTarget | SketchPointTargetV22;
}

export interface SketchMidpointConstraintCreateOp {
  readonly op: "sketch.constraint.create";
  readonly id?: SketchConstraintId;
  readonly name: string;
  readonly sketchId: SketchId;
  readonly kind: "midpoint";
  readonly lineEntityId: SketchEntityId;
  readonly target: SketchLegacyPointTarget | SketchMidpointTargetV22;
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

export interface SketchEqualLengthConstraintCreateOp {
  readonly op: "sketch.constraint.create";
  readonly id?: SketchConstraintId;
  readonly name: string;
  readonly sketchId: SketchId;
  readonly kind: "equalLength";
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
  readonly primaryTarget: SketchPointTarget | SketchPointTargetV22;
  readonly secondaryTarget: SketchPointTarget | SketchPointTargetV22;
  readonly symmetryLineEntityId: SketchEntityId;
}

export type SketchNormalizedPointConstraintCreateOpV19 =
  | (Omit<SketchFixedConstraintCreateOp, "target"> & {
      readonly target: SketchPointTargetV22;
    })
  | (Omit<
      SketchCoincidentConstraintCreateOp,
      "primaryTarget" | "secondaryTarget"
    > & {
      readonly primaryTarget: SketchPointTargetV22;
      readonly secondaryTarget: SketchPointTargetV22;
    })
  | (Omit<SketchMidpointConstraintCreateOp, "target"> & {
      readonly target: SketchMidpointTargetV22;
    })
  | (Omit<
      SketchSymmetryConstraintCreateOp,
      "primaryTarget" | "secondaryTarget"
    > & {
      readonly primaryTarget: SketchPointTargetV22;
      readonly secondaryTarget: SketchPointTargetV22;
    });

export interface SketchConstraintUpdateOpV19 {
  readonly op: "sketch.constraint.update";
  readonly id: SketchConstraintId;
  readonly definition:
    | {
        readonly kind: "horizontal" | "vertical";
        readonly entityId: SketchEntityId;
      }
    | {
        readonly kind: "fixed";
        readonly target: SketchPointTargetV22;
        readonly coordinate: Vec2;
      }
    | {
        readonly kind: "coincident";
        readonly primaryTarget: SketchPointTargetV22;
        readonly secondaryTarget: SketchPointTargetV22;
      }
    | {
        readonly kind: "midpoint";
        readonly lineEntityId: SketchEntityId;
        readonly target: SketchMidpointTargetV22;
      }
    | {
        readonly kind: "parallel" | "perpendicular" | "equalLength";
        readonly primaryLineEntityId: SketchEntityId;
        readonly secondaryLineEntityId: SketchEntityId;
      }
    | ({
        readonly kind: "tangent";
      } & SketchTangentConstraintTargetPair)
    | {
        readonly kind: "concentric" | "equalRadius";
        readonly primaryTarget: SketchRadiusCurveTarget;
        readonly secondaryTarget: SketchRadiusCurveTarget;
      }
    | {
        readonly kind: "symmetry";
        readonly primaryTarget: SketchPointTargetV22;
        readonly secondaryTarget: SketchPointTargetV22;
        readonly symmetryLineEntityId: SketchEntityId;
      }
    | {
        readonly kind: "angle";
        readonly primaryLineEntityId: SketchEntityId;
        readonly secondaryLineEntityId: SketchEntityId;
        readonly angleDegrees: number;
      };
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

export interface FeatureExtrudeOpV22 extends Omit<
  FeatureExtrudeOpV21,
  "profile"
> {
  readonly profile: SketchProfileRefV22;
}

export type FeatureExtrudeCommandInput =
  | (FeatureExtrudeOp & { readonly profile?: never })
  | FeatureExtrudeOpV21
  | FeatureExtrudeOpV22;

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

export interface FeatureRevolveOpV22 extends Omit<
  FeatureRevolveOpV21,
  "profile"
> {
  readonly profile: SketchProfileRefV22;
}

export type FeatureRevolveCommandInput =
  | (FeatureRevolveOp & { readonly profile?: never })
  | FeatureRevolveOpV21
  | FeatureRevolveOpV22;

export interface FeatureHoleOp {
  readonly op: "feature.hole";
  readonly id?: FeatureId;
  readonly bodyId?: BodyId;
  readonly targetBodyId?: BodyId;
  readonly targetTopologyAnchorId?: string;
  readonly name?: string;
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

export type PatternRotationAxisRef =
  | PatternDirectionRef
  | { readonly kind: "datumAxis"; readonly datumId: DatumId };

export type DatumAxisSourceRef = PatternDirectionRef;

export type DatumPlaneSourceRef =
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

export type MirrorPlaneRef =
  | DatumPlaneSourceRef
  | {
      readonly kind: "datumPlane";
      readonly datumId: DatumId;
      readonly offset?: number;
    };

export interface DatumPlaneCreateOp {
  readonly op: "datum.plane.create";
  readonly id?: DatumId;
  readonly name: string;
  readonly plane: DatumPlaneSourceRef;
  readonly topologyAnchorProof?: CadTopologyAnchorCommandProof;
}

export interface DatumAxisCreateOp {
  readonly op: "datum.axis.create";
  readonly id?: DatumId;
  readonly name: string;
  readonly axis: DatumAxisSourceRef;
  readonly topologyAnchorProof?: CadTopologyAnchorCommandProof;
}

export type PatternSeedFields =
  | { readonly seedBodyId: BodyId; readonly seedFeatureId?: never }
  | { readonly seedFeatureId: FeatureId; readonly seedBodyId?: never };

export const PATTERNED_SEED_FEATURE_KINDS = [
  "extrude",
  "revolve",
  "hole",
  "chamfer",
  "fillet",
  "combine",
  "shell",
  "sweep",
  "loft",
  "mirror"
] as const;

export type PatternedSeedFeatureKind =
  (typeof PATTERNED_SEED_FEATURE_KINDS)[number];

export function isPatternedSeedFeatureKind(
  kind: string
): kind is PatternedSeedFeatureKind {
  return (PATTERNED_SEED_FEATURE_KINDS as readonly string[]).includes(kind);
}

export function readExclusivePatternSeed(value: {
  readonly seedBodyId?: unknown;
  readonly seedFeatureId?: unknown;
}):
  | { readonly ok: true; readonly seed: PatternSeedFields }
  | { readonly ok: false } {
  const hasBody =
    typeof value.seedBodyId === "string" && value.seedBodyId.length > 0;
  const hasFeature =
    typeof value.seedFeatureId === "string" && value.seedFeatureId.length > 0;
  if (hasBody === hasFeature) {
    return { ok: false };
  }
  return hasBody
    ? { ok: true, seed: { seedBodyId: value.seedBodyId as BodyId } }
    : { ok: true, seed: { seedFeatureId: value.seedFeatureId as FeatureId } };
}

export function patternSeedSourceFields(seed: {
  readonly seedBodyId?: BodyId;
  readonly seedFeatureId?: FeatureId;
}): PatternSeedFields {
  return seed.seedFeatureId
    ? { seedFeatureId: seed.seedFeatureId }
    : { seedBodyId: seed.seedBodyId as BodyId };
}

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
  readonly seedBodyId?: BodyId;
  readonly seedFeatureId?: FeatureId;
  readonly axis?: FeaturePatternAxis;
  readonly direction?: PatternDirectionRef;
  readonly topologyAnchorProof?: CadTopologyAnchorCommandProof;
  readonly spacing: number;
  readonly instanceCount: number;
  readonly name?: string;
}

export interface FeatureCircularPatternOp {
  readonly op: "feature.circularPattern";
  readonly id?: FeatureId;
  readonly bodyId?: BodyId;
  readonly seedBodyId?: BodyId;
  readonly seedFeatureId?: FeatureId;
  readonly rotationAxis?: FeaturePatternAxis | PatternRotationAxisRef;
  readonly topologyAnchorProof?: CadTopologyAnchorCommandProof;
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
  readonly profile: SketchProfileRefV22;
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

export interface FeatureUpdateExtrudeOpV22 extends FeatureUpdateExtrudeOp {
  readonly profile?: SketchProfileRefV22;
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
  | (FeatureUpdateExtrudeOpV21 & { readonly profile: SketchProfileRef })
  | (FeatureUpdateExtrudeOpV22 & { readonly profile: SketchRegionsProfileRef });

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
    })
  | (Omit<FeatureUpdateRevolveOp, "angleDegrees"> & {
      readonly angleDegrees?: number;
      readonly profile: SketchRegionsProfileRef;
      readonly sketchId?: never;
      readonly entityId?: never;
    });

export interface FeatureUpdateHoleOp {
  readonly op: "feature.updateHole";
  readonly id: FeatureId;
  readonly depthMode?: FeatureHoleDepthMode;
  readonly depth?: number;
  readonly direction?: FeatureHoleDirection;
  readonly targetBodyId?: BodyId;
  readonly targetTopologyAnchorId?: string;
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
  readonly topologyAnchorProof?: CadTopologyAnchorCommandProof;
  readonly spacing?: number;
  readonly instanceCount?: number;
}

export interface FeatureUpdateCircularPatternOp {
  readonly op: "feature.updateCircularPattern";
  readonly id: FeatureId;
  readonly rotationAxis?: FeaturePatternAxis | PatternRotationAxisRef;
  readonly topologyAnchorProof?: CadTopologyAnchorCommandProof;
  readonly totalAngleDegrees?: number;
  readonly instanceCount?: number;
}

export interface FeatureMirrorOp {
  readonly op: "feature.mirror";
  readonly id?: FeatureId;
  readonly bodyId?: BodyId;
  readonly seedBodyId: BodyId;
  readonly mirrorPlane?: FeatureMirrorPlane;
  readonly plane?: MirrorPlaneRef;
  readonly topologyAnchorProof?: CadTopologyAnchorCommandProof;
  readonly includeOriginal: boolean;
  readonly name?: string;
}

export const FEATURE_COMBINE_MODES = ["union", "subtract", "intersect"] as const;

export type FeatureCombineMode = (typeof FEATURE_COMBINE_MODES)[number];

export function isFeatureCombineMode(
  value: unknown
): value is FeatureCombineMode {
  return (
    value === "union" || value === "subtract" || value === "intersect"
  );
}

export interface FeatureCombineOp {
  readonly op: "feature.combine";
  readonly id?: FeatureId;
  readonly bodyId?: BodyId;
  readonly name?: string;
  readonly mode: FeatureCombineMode;
  readonly targetBodyId: BodyId;
  readonly toolBodyId: BodyId;
}

export type FeatureOffsetSide = "inward" | "outward";

export type FeatureOffsetFaceRef = FeatureShellOpenFaceRef;

export type FeatureOffsetSource =
  | {
      readonly kind: "sketchProfile";
      readonly profile: SketchEntityProfileRef;
    }
  | {
      readonly kind: "face";
      readonly face: FeatureOffsetFaceRef;
    };

export interface FeatureOffsetOp {
  readonly op: "feature.offset";
  readonly id?: FeatureId;
  readonly bodyId?: BodyId;
  readonly name?: string;
  readonly source: FeatureOffsetSource;
  readonly distance: number;
  readonly side: FeatureOffsetSide;
}

export interface FeatureUpdateOffsetOp {
  readonly op: "feature.updateOffset";
  readonly id: FeatureId;
  readonly distance?: number;
  readonly side?: FeatureOffsetSide;
}

export type FeatureAlignFaceRef = FeatureShellOpenFaceRef;

export type FeatureAlignTarget =
  | {
      readonly kind: "planarFace";
      readonly face: FeatureAlignFaceRef;
    }
  | {
      readonly kind: "datumPlane";
      readonly datumId: DatumId;
    }
  | {
      readonly kind: "datumAxis";
      readonly datumId: DatumId;
    };

export interface FeatureAlignTransform {
  readonly translation: Vec3;
  readonly rotationAxis: Vec3;
  readonly rotationDegrees: number;
}

export interface FeatureAlignPlane {
  readonly point: Vec3;
  readonly normal: Vec3;
}

export interface FeatureAlignOp {
  readonly op: "feature.align";
  readonly id?: FeatureId;
  readonly bodyId?: BodyId;
  readonly name?: string;
  readonly seedBodyId: BodyId;
  readonly sourceFace: FeatureAlignFaceRef;
  readonly target: FeatureAlignTarget;
  readonly topologyAnchorProof?: CadTopologyAnchorCommandProof;
}

export interface FeatureUpdateMirrorOp {
  readonly op: "feature.updateMirror";
  readonly id: FeatureId;
  readonly mirrorPlane?: FeatureMirrorPlane;
  readonly plane?: MirrorPlaneRef;
  readonly topologyAnchorProof?: CadTopologyAnchorCommandProof;
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
  readonly plane?: SketchPlane;
  readonly datumId?: DatumId;
}

export type CadDatumRef = CadDatumPlaneRef | CadDatumAxisRef;

export interface CadDatumPlaneRef {
  readonly id: DatumId;
  readonly kind: "plane";
  readonly name: string;
  readonly plane: DatumPlaneSourceRef;
}

export interface CadDatumAxisRef {
  readonly id: DatumId;
  readonly kind: "axis";
  readonly name: string;
  readonly axis: DatumAxisSourceRef;
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
  | CadCombineFeatureRef
  | CadOffsetFeatureRef
  | CadAlignFeatureRef
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
        readonly profile: SketchWireProfileRef | SketchRegionsProfileRef;
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
        readonly profile: SketchWireProfileRef | SketchRegionsProfileRef;
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
  readonly seedBodyId?: BodyId;
  readonly seedFeatureId?: FeatureId;
  readonly direction: PatternDirectionRef;
  readonly spacing: number;
  readonly instanceCount: number;
  readonly instances: readonly PatternInstanceRecord[];
}

export interface CadCircularPatternFeatureRef {
  readonly id: FeatureId;
  readonly kind: "circularPattern";
  readonly bodyId: BodyId;
  readonly seedBodyId?: BodyId;
  readonly seedFeatureId?: FeatureId;
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

export interface CadCombineFeatureRef {
  readonly id: FeatureId;
  readonly kind: "combine";
  readonly bodyId: BodyId;
  readonly mode: FeatureCombineMode;
  readonly targetBodyId: BodyId;
  readonly toolBodyId: BodyId;
}

export interface CadOffsetFeatureRef {
  readonly id: FeatureId;
  readonly kind: "offset";
  readonly bodyId: BodyId;
  readonly source: FeatureOffsetSource;
  readonly distance: number;
  readonly side: FeatureOffsetSide;
  readonly targetBodyId?: BodyId;
}

export interface CadAlignFeatureRef {
  readonly id: FeatureId;
  readonly kind: "align";
  readonly bodyId: BodyId;
  readonly seedBodyId: BodyId;
  readonly sourceFace: FeatureAlignFaceRef;
  readonly target: FeatureAlignTarget;
  readonly transform: FeatureAlignTransform;
  readonly alignedSourceFace: FeatureAlignPlane;
}

export type CadSweepFeatureRef =
  | SweepFeatureSnapshot
  | SweepFeatureV21;
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

export interface CadSketchDimensionRefV22 {
  readonly sourceShape: "v22";
  readonly id: SketchDimensionId;
  readonly name: string;
  readonly sketchId: SketchId;
  readonly target: SketchDimensionTargetV22;
  readonly parameterId?: ParameterId;
  readonly entityId?: never;
}

export type CadSketchDimensionRefCurrent =
  | CadSketchDimensionRef
  | CadSketchDimensionRefV22;

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
  readonly curveEdits?: readonly SketchCurveEditSemanticDiff[];
  readonly convenienceOperations?: readonly SketchConvenienceSemanticDiff[];
}

export interface DatumSemanticDiff {
  readonly created?: readonly CadDatumRef[];
  readonly modified?: readonly CadDatumRef[];
  readonly deleted?: readonly CadDatumRef[];
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
  readonly inputReferences?: readonly FeatureInputReferenceSemanticDiffCurrent[];
}

export interface SketchEntitySemanticDiff {
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
  readonly action: "added" | "updated" | "deleted";
  readonly entityKind: SketchEntityKind;
  readonly changedFields: readonly string[];
  readonly constructionBefore?: boolean;
  readonly constructionAfter?: boolean;
}

export interface FeatureInputReferenceSemanticDiffLegacy {
  readonly featureId: FeatureId;
  readonly inputKind: "profile" | "path";
  readonly before?: SketchProfileRef | SketchPathRef;
  readonly after: SketchProfileRef | SketchPathRef;
  readonly profileOrientationNormalized?: boolean;
  readonly affectedSketchIds: readonly SketchId[];
  readonly affectedEntityIds: readonly SketchEntityId[];
}

export type FeatureInputReferenceSemanticDiffV22 =
  | {
      readonly featureId: FeatureId;
      readonly inputKind: "profile";
      readonly before?: SketchProfileRefV22;
      readonly after: SketchProfileRefV22;
      readonly normalization?: {
        readonly outerOrientationsChanged: readonly string[];
        readonly holeOrientationsChanged: readonly string[];
        readonly cyclicStartsChanged: readonly string[];
        readonly holeOrderChanged: boolean;
        readonly regionOrderChanged: boolean;
      };
      readonly affectedSketchIds: readonly SketchId[];
      readonly affectedEntityIds: readonly SketchEntityId[];
    }
  | {
      readonly featureId: FeatureId;
      readonly inputKind: "path";
      readonly before?: SketchPathRef;
      readonly after: SketchPathRef;
      readonly affectedSketchIds: readonly SketchId[];
      readonly affectedEntityIds: readonly SketchEntityId[];
    };

export type FeatureInputReferenceSemanticDiff =
  FeatureInputReferenceSemanticDiffV22;

export type FeatureInputReferenceSemanticDiffCurrent =
  FeatureInputReferenceSemanticDiff;

export interface SketchEntityReplacement {
  readonly sourceEntityId: SketchEntityId;
  readonly disposition: "modified" | "deleted";
  readonly resultEntityIds: readonly SketchEntityId[];
  readonly preservedResultEntityId?: SketchEntityId;
}

export type SketchCurveEditRecordDisposition =
  | "preserved"
  | "retargeted"
  | "invalid"
  | "deleted-by-request"
  | "unaffected";

export interface SketchCurveEditConstraintImpact {
  readonly id: SketchConstraintId;
  readonly disposition: SketchCurveEditRecordDisposition;
  readonly before: CadSketchConstraintRef;
  readonly after?: CadSketchConstraintRef;
  readonly residualFamily?: string;
  readonly residual?: number;
}

export interface SketchCurveEditDimensionImpact {
  readonly id: SketchDimensionId;
  readonly disposition: SketchCurveEditRecordDisposition;
  readonly before: CadSketchDimensionRefCurrent;
  readonly after?: CadSketchDimensionRefCurrent;
  readonly residualFamily?: string;
  readonly residual?: number;
}

export interface SketchCurveEditImpact {
  readonly sketchId: SketchId;
  readonly operation:
    | "trim"
    | "extend"
    | "split"
    | "explodeRectangle"
    | "offset";
  readonly replacements: readonly SketchEntityReplacement[];
  readonly constraintImpacts: readonly SketchCurveEditConstraintImpact[];
  readonly dimensionImpacts: readonly SketchCurveEditDimensionImpact[];
  readonly requiredDeleteConstraintIds: readonly SketchConstraintId[];
  readonly requiredDeleteDimensionIds: readonly SketchDimensionId[];
  readonly affectedFeatureIds: readonly FeatureId[];
  readonly postEditSolverStatus: CadSketchSolverStatus;
}

export interface SketchCurveEditSemanticDiff extends SketchCurveEditImpact {
  readonly opIndex: number;
  readonly createdEntityIds: readonly SketchEntityId[];
  readonly modifiedEntityIds: readonly SketchEntityId[];
  readonly deletedEntityIds: readonly SketchEntityId[];
  readonly retargetedConstraintIds: readonly SketchConstraintId[];
  readonly deletedConstraintIds: readonly SketchConstraintId[];
  readonly retargetedDimensionIds: readonly SketchDimensionId[];
  readonly deletedDimensionIds: readonly SketchDimensionId[];
}

export interface SketchConvenienceSemanticDiff {
  readonly opIndex: number;
  readonly sketchId: SketchId;
  readonly operation: "slot" | "roundedRectangle";
  readonly createdEntityIds: readonly SketchEntityId[];
  readonly createdConstraintIds: readonly SketchConstraintId[];
}

export interface ReferenceSemanticDiff {
  readonly namedCreated?: readonly CadNamedReferenceRef[];
  readonly namedRepaired?: readonly CadNamedReferenceRepairRef[];
  readonly namedDeleted?: readonly CadNamedReferenceRef[];
  readonly topologyCheckpointsCreated?: readonly CadTopologyCheckpointRef[];
  readonly topologyCheckpointsDeleted?: readonly CadTopologyCheckpointRef[];
  readonly topologyAnchorsCreated?: readonly CadTopologyAnchorRef[];
  readonly topologyAnchorsDeleted?: readonly CadTopologyAnchorRef[];
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
  readonly created?: readonly CadSketchDimensionRefCurrent[];
  readonly modified?: readonly CadSketchDimensionRefCurrent[];
  readonly deleted?: readonly CadSketchDimensionRefCurrent[];
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
  readonly datums?: DatumSemanticDiff;
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
  | "DATUM_ALREADY_EXISTS"
  | "DATUM_NOT_FOUND"
  | "INVALID_DATUM"
  | "INVALID_DATUM_NAME"
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
  | "SKETCH_EDIT_INVALID_PROPOSAL"
  | "SKETCH_EDIT_TARGET_UNSUPPORTED"
  | "SKETCH_EDIT_BOUNDARY_MISSING"
  | "SKETCH_EDIT_INTERSECTION_MISSING"
  | "SKETCH_EDIT_INTERSECTION_AMBIGUOUS"
  | "SKETCH_EDIT_PICK_OFF_CURVE"
  | "SKETCH_EDIT_ZERO_LENGTH_RESULT"
  | "SKETCH_EDIT_SOLVER_STATE_BLOCKED"
  | "SKETCH_EDIT_SOURCE_REVISION_STALE"
  | "SKETCH_EDIT_BATCH_MULTIPLE_UNSUPPORTED"
  | "SKETCH_EDIT_DEPENDENCY_CONFLICT"
  | "SKETCH_EDIT_DELETE_LIST_MISMATCH"
  | "SKETCH_OFFSET_SIDE_AMBIGUOUS"
  | "SKETCH_OFFSET_RADIUS_COLLAPSED"
  | "SKETCH_OFFSET_JOIN_UNSUPPORTED"
  | "SKETCH_OFFSET_SELF_INTERSECTION"
  | "SKETCH_REGION_LOOP_OPEN"
  | "SKETCH_REGION_LOOP_INTERSECTION"
  | "SKETCH_REGION_BOUNDARY_TOUCHING"
  | "SKETCH_REGION_HOLE_OUTSIDE"
  | "SKETCH_REGION_HOLES_OVERLAP"
  | "SKETCH_REGION_MATERIAL_OVERLAP"
  | "SKETCH_REGION_NESTING_UNSUPPORTED"
  | "SKETCH_REGION_COMPLEXITY_LIMIT"
  | "SKETCH_REGION_CONSUMER_UNSUPPORTED"
  | "SKETCH_REGION_RESULT_NOT_SINGLE_SOLID"
  | "SKETCH_DIMENSION_TARGET_UNSUPPORTED"
  | "SKETCH_DIMENSION_ANGLE_SENSE_INVALID"
  | "SKETCH_DIMENSION_DISTANCE_INVALID"
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
  readonly datumId?: DatumId;
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
  readonly curveEditImpact?: SketchCurveEditImpact;
}

export type CadBatchValidationResult =
  | {
      readonly ok: true;
      readonly errors: readonly [];
      readonly warnings: readonly string[];
    }
  | {
      readonly ok: false;
      readonly errors: readonly [
        CadBatchValidationError,
        ...CadBatchValidationError[]
      ];
      readonly warnings: readonly string[];
    };

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
  readonly createdDatumIds?: readonly DatumId[];
  readonly modifiedDatumIds?: readonly DatumId[];
  readonly deletedDatumIds?: readonly DatumId[];
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
  readonly createdDatumIds?: readonly DatumId[];
  readonly modifiedDatumIds?: readonly DatumId[];
  readonly deletedDatumIds?: readonly DatumId[];
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
  | "sketch.curveEditReadiness"
  | "sketch.profileRegionCandidates"
  | "sketch.profileRegionValidate"
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
  | SketchCurveEditReadinessQuery
  | SketchProfileRegionCandidatesQuery
  | SketchProfileRegionValidateQuery
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
  readonly derivedExactMetadata?: readonly CadBodyDerivedExactMetadataSnapshot[];
  readonly currentExactResults?: readonly CadCurrentExactResult[];
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
  readonly currentExactResults?: readonly CadCurrentExactResult[];
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
  readonly currentExactResults?: readonly CadCurrentExactResult[];
}

export interface ProjectExactExportQuery {
  readonly query: "project.exportExact";
  readonly format: CadExactExportFormatId;
  readonly bodyIds?: readonly BodyId[];
  readonly sourceIdentity?: WcadSourceIdentity;
  readonly derivedExactMetadata?: readonly CadBodyDerivedExactMetadataSnapshot[];
  readonly currentExactResults?: readonly CadCurrentExactResult[];
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
  readonly profile: SketchProfileRefV22;
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

export interface SketchCurveEditReadinessQuery {
  readonly query: "sketch.curveEditReadiness";
  readonly proposal: SketchCurveEditProposal;
}

export interface SketchProfileRegionCandidatesQuery {
  readonly query: "sketch.profileRegionCandidates";
  readonly sketchId: SketchId;
  readonly entityIds?: readonly SketchEntityId[];
  readonly limit?: number;
  readonly afterCandidateKey?: string;
  readonly sourceRevision?: string;
}

export interface SketchProfileRegionValidateQuery {
  readonly query: "sketch.profileRegionValidate";
  readonly profile: SketchRegionsProfileRef;
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

export interface CadCurrentTopologySelectionEvidence {
  readonly bodyId: BodyId;
  readonly bodySourceIdentitySignature: string;
  readonly topologySignature: string;
  readonly entityKind: "face" | "edge" | "vertex";
  readonly localId: string;
  readonly entitySignature: string;
}

export type CadCurrentTopologySelectionOutcome =
  | "selectable"
  | "inspectOnly"
  | "existingGeneratedMatch"
  | "existingAnchorMatch"
  | "promotableGeneratedMatch"
  | "blocked"
  | "stale"
  | "missing"
  | "ambiguous"
  | "resourceLimited"
  | "unsupported";

export interface CadCurrentTopologySelectionDiagnostic {
  readonly message: string;
  readonly code?: CadCurrentTopologySelectionOutcome;
}

export interface CadCurrentTopologySelectionProjection {
  readonly bodyId: BodyId;
  readonly entityKind: CadCurrentTopologySelectionEvidence["entityKind"];
  readonly outcome: CadCurrentTopologySelectionOutcome;
  readonly diagnostics: readonly CadCurrentTopologySelectionDiagnostic[];
}

export type SelectionReferenceCandidatesQuery =
  | {
      readonly query: "selection.referenceCandidates";
      readonly selection: CadSelectionReferenceInput;
      readonly currentTopologyEvidence?: never;
      readonly requiredOperation?: CadSelectionReferenceOperation;
      readonly topologyMatchResults?: readonly CadTopologyMatchResult[];
    }
  | {
      readonly query: "selection.referenceCandidates";
      readonly selection?: never;
      readonly currentTopologyEvidence: CadCurrentTopologySelectionEvidence;
      readonly requiredOperation?: CadSelectionReferenceOperation;
      readonly topologyMatchResults?: readonly CadTopologyMatchResult[];
    };

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
  | SketchArcEntity
  | SketchSplineEntity;

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
  readonly startAngleDegrees: number;
  readonly sweepAngleDegrees: number;
  readonly construction: boolean;
}

export type SketchSplineForm = "interpolation" | "controlPoints";

export interface SketchSplineEntity {
  readonly id: SketchEntityId;
  readonly kind: "spline";
  readonly form: SketchSplineForm;
  readonly points: readonly Vec2[];
  readonly degree: number;
  readonly closed: boolean;
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

export interface SketchDimensionSnapshotV22 {
  readonly id: SketchDimensionId;
  readonly name: string;
  readonly sketchId: SketchId;
  readonly target: SketchDimensionTargetV22;
  readonly valueSource: SketchDimensionValueSource;
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

export interface SketchDimensionEntryV22 extends SketchDimensionSnapshotV22 {
  readonly sourceShape: "v22";
  readonly status: SketchDimensionStatus;
  readonly issues: readonly SketchDimensionIssue[];
  readonly effectiveValue?: number;
}

export type SketchDimensionEntryCurrent =
  | SketchDimensionEntry
  | SketchDimensionEntryV22;

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
  readonly datumId?: DatumId;
  readonly attachment?: SketchAttachmentSnapshot;
  readonly entities: readonly SketchEntitySnapshot[];
}

export interface SketchSnapshotV21 {
  readonly id: SketchId;
  readonly name: string;
  readonly plane: SketchPlane;
  readonly datumId?: DatumId;
  readonly attachment?: SketchAttachmentSnapshot;
  readonly entities: readonly SketchEntityV21[];
}

export interface DatumPlaneSnapshot {
  readonly id: DatumId;
  readonly name: string;
  readonly kind: "plane";
  readonly plane: DatumPlaneSourceRef;
}

export interface DatumAxisSnapshot {
  readonly id: DatumId;
  readonly name: string;
  readonly kind: "axis";
  readonly axis: DatumAxisSourceRef;
}

export type DatumSnapshot = DatumPlaneSnapshot | DatumAxisSnapshot;

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
  readonly seedBodyId?: BodyId;
  readonly seedFeatureId?: FeatureId;
  readonly axis?: FeaturePatternAxis;
  readonly direction?: PatternDirectionRef;
  readonly spacing: number;
  readonly instanceCount: number;
  readonly bodyId: BodyId;
  readonly instances?: readonly PatternInstanceRecord[];
}

export interface CircularPatternFeatureSnapshot {
  readonly id: FeatureId;
  readonly kind: "circularPattern";
  readonly name?: string;
  readonly seedBodyId?: BodyId;
  readonly seedFeatureId?: FeatureId;
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
  readonly mirrorPlane?: FeatureMirrorPlane;
  readonly plane?: MirrorPlaneRef;
  readonly includeOriginal: boolean;
  readonly bodyId: BodyId;
}

export interface CombineFeatureSnapshot {
  readonly id: FeatureId;
  readonly kind: "combine";
  readonly name?: string;
  readonly mode: FeatureCombineMode;
  readonly targetBodyId: BodyId;
  readonly toolBodyId: BodyId;
  readonly bodyId: BodyId;
}

export interface OffsetFeatureSnapshot {
  readonly id: FeatureId;
  readonly kind: "offset";
  readonly name?: string;
  readonly source: FeatureOffsetSource;
  readonly distance: number;
  readonly side: FeatureOffsetSide;
  readonly targetBodyId?: BodyId;
  readonly bodyId: BodyId;
}

export interface AlignFeatureSnapshot {
  readonly id: FeatureId;
  readonly kind: "align";
  readonly name?: string;
  readonly seedBodyId: BodyId;
  readonly sourceFace: FeatureAlignFaceRef;
  readonly target: FeatureAlignTarget;
  readonly transform: FeatureAlignTransform;
  readonly alignedSourceFace: FeatureAlignPlane;
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

export type ExtrudeFeatureV22 = Omit<ExtrudeFeatureV21, "profile"> & {
  readonly profile: SketchProfileRefV22;
};

export type RevolveFeatureV22 = Omit<RevolveFeatureV21, "profile"> & {
  readonly profile: SketchProfileRefV22;
};

export interface SweepFeatureV21 {
  readonly id: FeatureId;
  readonly kind: "sweep";
  readonly name?: string;
  readonly profile: SketchProfileRefV22;
  readonly path: SketchPathRef;
  readonly bodyId: BodyId;
}

export type SweepFeatureV22 = SweepFeatureV21;

export interface LoftSectionV21 {
  readonly profile: SketchEntityProfileRef;
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

export type LoftFeatureV22 = LoftFeatureV21;

export type ProfileConsumerFeatureV21 =
  | ExtrudeFeatureV21
  | RevolveFeatureV21
  | SweepFeatureV21
  | LoftFeatureV21;

export type ProfileConsumerFeatureV22 =
  | ExtrudeFeatureV22
  | RevolveFeatureV22
  | SweepFeatureV22
  | LoftFeatureV22;

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
  | CombineFeatureSnapshot
  | OffsetFeatureSnapshot
  | AlignFeatureSnapshot
  | ShellFeatureSnapshot
  | SweepFeatureV21
  | LoftFeatureV21;

export type FeatureSnapshotV22 =
  | ExtrudeFeatureV22
  | RevolveFeatureV22
  | HoleFeatureSnapshot
  | ChamferFeatureSnapshot
  | FilletFeatureSnapshot
  | ImportedBodyFeatureSnapshot
  | LinearPatternFeatureSnapshot
  | CircularPatternFeatureSnapshot
  | MirrorFeatureSnapshot
  | CombineFeatureSnapshot
  | OffsetFeatureSnapshot
  | AlignFeatureSnapshot
  | ShellFeatureSnapshot
  | SweepFeatureV22
  | LoftFeatureV22;

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
  | CombineFeatureSnapshot
  | OffsetFeatureSnapshot
  | AlignFeatureSnapshot
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
    | {
        readonly profile: SketchWireProfileRef | SketchRegionsProfileRef;
        readonly entityId?: never;
      }
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
        readonly profile: SketchWireProfileRef | SketchRegionsProfileRef;
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
    | {
        readonly profile: SketchWireProfileRef | SketchRegionsProfileRef;
        readonly entityId?: never;
      }
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
        readonly profile: SketchWireProfileRef | SketchRegionsProfileRef;
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
  readonly seedBodyId?: BodyId;
  readonly seedFeatureId?: FeatureId;
  readonly direction: PatternDirectionRef;
}

export interface CadLinearPatternFeatureSummary {
  readonly id: FeatureId;
  readonly kind: "linearPattern";
  readonly partId: PartId;
  readonly bodyId: BodyId;
  readonly seedBodyId?: BodyId;
  readonly seedFeatureId?: FeatureId;
  readonly direction: PatternDirectionRef;
  readonly spacing: number;
  readonly instanceCount: number;
  readonly instances: readonly PatternInstanceRecord[];
  readonly name?: string;
  readonly source: CadLinearPatternFeatureSource;
}

export interface CadCircularPatternFeatureSource {
  readonly type: "circularPatternFeature";
  readonly seedBodyId?: BodyId;
  readonly seedFeatureId?: FeatureId;
  readonly rotationAxis: PatternRotationAxisRef;
}

export interface CadCircularPatternFeatureSummary {
  readonly id: FeatureId;
  readonly kind: "circularPattern";
  readonly partId: PartId;
  readonly bodyId: BodyId;
  readonly seedBodyId?: BodyId;
  readonly seedFeatureId?: FeatureId;
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

export interface CadCombineFeatureSource {
  readonly type: "combineFeature";
  readonly mode: FeatureCombineMode;
  readonly targetBodyId: BodyId;
  readonly toolBodyId: BodyId;
}

export interface CadCombineFeatureSummary {
  readonly id: FeatureId;
  readonly kind: "combine";
  readonly partId: PartId;
  readonly bodyId: BodyId;
  readonly mode: FeatureCombineMode;
  readonly targetBodyId: BodyId;
  readonly toolBodyId: BodyId;
  readonly name?: string;
  readonly source: CadCombineFeatureSource;
}

export interface CadOffsetFeatureSource {
  readonly type: "offsetFeature";
  readonly source: FeatureOffsetSource;
  readonly distance: number;
  readonly side: FeatureOffsetSide;
  readonly targetBodyId?: BodyId;
}

export interface CadOffsetFeatureSummary {
  readonly id: FeatureId;
  readonly kind: "offset";
  readonly partId: PartId;
  readonly bodyId: BodyId;
  readonly sourceKind: FeatureOffsetSource["kind"];
  readonly offsetSource: FeatureOffsetSource;
  readonly distance: number;
  readonly side: FeatureOffsetSide;
  readonly targetBodyId?: BodyId;
  readonly name?: string;
  readonly source: CadOffsetFeatureSource;
}

export interface CadAlignFeatureSource {
  readonly type: "alignFeature";
  readonly seedBodyId: BodyId;
  readonly sourceFace: FeatureAlignFaceRef;
  readonly target: FeatureAlignTarget;
  readonly transform: FeatureAlignTransform;
  readonly alignedSourceFace: FeatureAlignPlane;
}

export interface CadAlignFeatureSummary {
  readonly id: FeatureId;
  readonly kind: "align";
  readonly partId: PartId;
  readonly bodyId: BodyId;
  readonly seedBodyId: BodyId;
  readonly sourceFace: FeatureAlignFaceRef;
  readonly target: FeatureAlignTarget;
  readonly transform: FeatureAlignTransform;
  readonly alignedSourceFace: FeatureAlignPlane;
  readonly name?: string;
  readonly source: CadAlignFeatureSource;
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
  readonly profile: SketchProfileRefV22;
  readonly path: SketchPathRef;
  readonly profileSketchId: SketchId;
  readonly profileEntityId?: SketchEntityId;
  readonly pathSketchId: SketchId;
  readonly pathEntityIds: readonly SketchEntityId[];
}

export interface CadSweepFeatureSummary extends SweepFeatureV21 {
  readonly partId: PartId;
  readonly profileSketchId: SketchId;
  readonly profileEntityId?: SketchEntityId;
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
  | CadCombineFeatureSummary
  | CadOffsetFeatureSummary
  | CadAlignFeatureSummary
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
  | "CONSUMED_REFERENCE_NOT_COMMAND_READY"
  | "SKETCH_REGION_LOOP_OPEN"
  | "SKETCH_REGION_LOOP_INTERSECTION"
  | "SKETCH_REGION_BOUNDARY_TOUCHING"
  | "SKETCH_REGION_HOLE_OUTSIDE"
  | "SKETCH_REGION_HOLES_OVERLAP"
  | "SKETCH_REGION_MATERIAL_OVERLAP"
  | "SKETCH_REGION_NESTING_UNSUPPORTED"
  | "SKETCH_REGION_COMPLEXITY_LIMIT"
  | "SKETCH_REGION_CONSUMER_UNSUPPORTED"
  | "SKETCH_REGION_RESULT_NOT_SINGLE_SOLID";

export interface CadFeatureExtrudeEditProposal {
  readonly kind: "extrude";
  readonly profile?: SketchProfileRefV22;
  readonly depth?: number;
  readonly side?: FeatureExtrudeSide;
}

export interface CadFeatureRevolveEditProposal {
  readonly kind: "revolve";
  readonly profile?: SketchProfileRefV22;
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

export interface CadFeatureOffsetEditProposal {
  readonly kind: "offset";
  readonly distance?: number;
  readonly side?: FeatureOffsetSide;
}

export interface CadFeatureSweepEditProposal {
  readonly kind: "sweep";
  readonly profile?: SketchEntityProfileRef;
  readonly path?: SketchPathRef;
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
  | CadFeatureOffsetEditProposal
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
  readonly sourceFeatureId?: FeatureId;
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
  readonly featureId?: FeatureId;
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
  | "SKETCH_EDIT_SCHEMA_MIGRATION_NEEDED"
  | "SKETCH_EDIT_TARGET_UNSUPPORTED"
  | "SKETCH_EDIT_BOUNDARY_MISSING"
  | "SKETCH_EDIT_INTERSECTION_MISSING"
  | "SKETCH_EDIT_INTERSECTION_AMBIGUOUS"
  | "SKETCH_EDIT_PICK_OFF_CURVE"
  | "SKETCH_EDIT_ZERO_LENGTH_RESULT"
  | "SKETCH_EDIT_SOLVER_STATE_BLOCKED"
  | "SKETCH_EDIT_SOURCE_REVISION_STALE"
  | "SKETCH_EDIT_BATCH_MULTIPLE_UNSUPPORTED"
  | "SKETCH_EDIT_DEPENDENCY_CONFLICT"
  | "SKETCH_EDIT_DELETE_LIST_MISMATCH"
  | "SKETCH_OFFSET_SIDE_AMBIGUOUS"
  | "SKETCH_OFFSET_RADIUS_COLLAPSED"
  | "SKETCH_OFFSET_JOIN_UNSUPPORTED"
  | "SKETCH_OFFSET_SELF_INTERSECTION"
  | "SKETCH_REGION_LOOP_OPEN"
  | "SKETCH_REGION_LOOP_INTERSECTION"
  | "SKETCH_REGION_BOUNDARY_TOUCHING"
  | "SKETCH_REGION_HOLE_OUTSIDE"
  | "SKETCH_REGION_HOLES_OVERLAP"
  | "SKETCH_REGION_MATERIAL_OVERLAP"
  | "SKETCH_REGION_NESTING_UNSUPPORTED"
  | "SKETCH_REGION_COMPLEXITY_LIMIT"
  | "SKETCH_REGION_CONSUMER_UNSUPPORTED"
  | "SKETCH_REGION_RESULT_NOT_SINGLE_SOLID"
  | "SKETCH_DIMENSION_TARGET_UNSUPPORTED"
  | "SKETCH_DIMENSION_ANGLE_SENSE_INVALID"
  | "SKETCH_DIMENSION_DISTANCE_INVALID";

export interface CadSketchEntityDimensionEditProposal {
  readonly editKind: "entity.dimension.update";
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
  readonly target: SketchDimensionTarget | SketchDimensionTargetV22;
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
  readonly recoveryAction?: string;
}

export interface CadSketchEditEvaluationSummary {
  readonly sketchId: SketchId;
  readonly sketchName: string;
  readonly plane: SketchPlane;
  readonly status: SketchDimensionStatus;
  readonly drivenEntityCount: number;
  readonly drivenEntityIds: readonly SketchEntityId[];
  readonly dimensionCount: number;
  readonly dimensions: readonly SketchDimensionEntryCurrent[];
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
  | "SKETCH_ARC_DIMENSION_INVALID"
  | "SKETCH_DIMENSION_TARGET_UNSUPPORTED"
  | "SKETCH_DIMENSION_ANGLE_SENSE_INVALID"
  | "SKETCH_DIMENSION_DISTANCE_INVALID";

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

export interface CadSketchSolverDimensionSummaryV22 {
  readonly sourceShape: "v22";
  readonly dimensionId: SketchDimensionId;
  readonly sketchId: SketchId;
  readonly target: SketchDimensionTargetV22;
  readonly valueSource: SketchDimensionValueSource;
  readonly effectiveValue?: number;
  readonly status: SketchDimensionStatus;
  readonly supported: boolean;
  readonly diagnosticCount: number;
  readonly diagnostics: readonly CadSketchSolverDiagnostic[];
  readonly entityId?: never;
  readonly targetRef?: never;
}

export type CadSketchSolverDimensionSummaryCurrent =
  | CadSketchSolverDimensionSummary
  | CadSketchSolverDimensionSummaryV22;

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
  readonly datumIds?: readonly DatumId[];
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
        readonly profile: SketchWireProfileRef | SketchRegionsProfileRef;
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
        readonly profile: SketchWireProfileRef | SketchRegionsProfileRef;
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
  readonly seedBodyId?: BodyId;
  readonly seedFeatureId?: FeatureId;
  readonly direction: PatternDirectionRef;
  readonly spacing: number;
  readonly instanceCount: number;
  readonly instances: readonly PatternInstanceRecord[];
}

export interface CadCircularPatternBodySource {
  readonly type: "circularPatternFeature";
  readonly featureId: FeatureId;
  readonly seedBodyId?: BodyId;
  readonly seedFeatureId?: FeatureId;
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

export interface CadCombineBodySource {
  readonly type: "combineFeature";
  readonly featureId: FeatureId;
  readonly mode: FeatureCombineMode;
  readonly targetBodyId: BodyId;
  readonly toolBodyId: BodyId;
}

export interface CadOffsetBodySource {
  readonly type: "offsetFeature";
  readonly featureId: FeatureId;
  readonly source: FeatureOffsetSource;
  readonly distance: number;
  readonly side: FeatureOffsetSide;
  readonly targetBodyId?: BodyId;
}

export interface CadAlignBodySource {
  readonly type: "alignFeature";
  readonly featureId: FeatureId;
  readonly seedBodyId: BodyId;
  readonly sourceFace: FeatureAlignFaceRef;
  readonly target: FeatureAlignTarget;
  readonly transform: FeatureAlignTransform;
  readonly alignedSourceFace: FeatureAlignPlane;
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
  readonly profile: SketchProfileRefV22;
  readonly path: SketchPathRef;
  readonly profileSketchId: SketchId;
  readonly profileEntityId?: SketchEntityId;
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
  | CadCombineBodySource
  | CadOffsetBodySource
  | CadAlignBodySource
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
  | `side:segment:${SketchEntityId}`
  | `region:${string}.startCap`
  | `region:${string}.endCap`
  | `region:${string}.outer.side:${string}`
  | `region:${string}.hole:${string}.side:${string}`;

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
  | `longitudinal:join:${SketchEntityId}:${SketchEntityId}`
  | `region:${string}.outer.startBoundary:${string}`
  | `region:${string}.outer.endBoundary:${string}`
  | `region:${string}.hole:${string}.startBoundary:${string}`
  | `region:${string}.hole:${string}.endBoundary:${string}`
  | `region:${string}.outer.longitudinal:${string}:${string}`
  | `region:${string}.hole:${string}.longitudinal:${string}:${string}`;

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
  | `end:join:${SketchEntityId}:${SketchEntityId}`
  | `region:${string}.outer.startJoin:${string}:${string}`
  | `region:${string}.outer.endJoin:${string}:${string}`
  | `region:${string}.hole:${string}.startJoin:${string}:${string}`
  | `region:${string}.hole:${string}.endJoin:${string}:${string}`;

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
  | "feature.offset"
  | "feature.align"
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
  | "wire"
  | "regions";

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
  readonly exactBodyCount?: number;
  readonly exactReadyBodyCount?: number;
  readonly exactPendingBodyCount?: number;
  readonly exactStaleBodyCount?: number;
  readonly exactBlockedBodyCount?: number;
  readonly exactFailedBodyCount?: number;
  readonly exactUnsupportedBodyCount?: number;
  readonly currentExactResults?: readonly CadCurrentExactResult[];
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

export type CadSelectionReferenceCommandTarget =
  | {
      readonly type: "body";
      readonly bodyId: BodyId;
    }
  | {
      readonly type: "generatedReference";
      readonly bodyId: BodyId;
      readonly stableId: string;
      readonly kind: CadGeneratedEntityKind;
      readonly topologyAnchorId?: string;
      readonly checkpointId?: string;
      readonly referenceName?: NamedReferenceName;
    }
  | {
      readonly type: "topologyAnchor";
      readonly bodyId: BodyId;
      readonly kind: "face" | "edge";
      readonly topologyAnchorId?: string;
      readonly checkpointId?: string;
    };

export type CadSelectionReferenceCandidateSource =
  | "bodySelection"
  | "generatedReferenceSelection"
  | "namedReferenceSelection"
  | "topologyAnchorSelection";

interface CadSelectionReferenceCandidateBase {
  readonly source: CadSelectionReferenceCandidateSource;
  readonly commandable: boolean;
  readonly commandOperations: readonly CadSelectionReferenceOperation[];
  readonly label: string;
  readonly description?: string;
  readonly issues: readonly CadSelectionReferenceIssue[];
}

export type CadSelectionReferenceCandidate =
  | (CadSelectionReferenceCandidateBase & {
      readonly target: Extract<
        CadSelectionReferenceCommandTarget,
        { readonly type: "body" }
      >;
      readonly reference: CadSemanticBodyReference;
    })
  | (CadSelectionReferenceCandidateBase & {
      readonly target: Extract<
        CadSelectionReferenceCommandTarget,
        { readonly type: "generatedReference" }
      >;
      readonly reference: CadGeneratedReference;
    })
  | (CadSelectionReferenceCandidateBase & {
      readonly target: Extract<
        CadSelectionReferenceCommandTarget,
        { readonly type: "topologyAnchor" }
      >;
      readonly reference: CadSemanticTopologyAnchorReference;
    });

/** Whole-body selection proof for bodies without feature-generated references. */
export interface CadSemanticBodyReference {
  readonly kind: "body";
  readonly stableId: string;
  readonly label: string;
  readonly description?: string;
  readonly eligibleOperations: readonly CadSelectionReferenceOperation[];
  readonly bodyId: BodyId;
  readonly ownerPartId: PartId;
  readonly sourceFeatureId: FeatureId;
}

export interface CadSemanticTopologyAnchorReference {
  readonly kind: "face" | "edge";
  readonly label: string;
  readonly description?: string;
  readonly eligibleOperations: readonly CadSelectionReferenceOperation[];
  readonly bodyId: BodyId;
  readonly ownerPartId: PartId;
  readonly sourceFeatureId: FeatureId;
  readonly topologyAnchorId?: string;
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
  | "SKETCH_REGION_LOOP_OPEN"
  | "SKETCH_REGION_LOOP_INTERSECTION"
  | "SKETCH_REGION_BOUNDARY_TOUCHING"
  | "SKETCH_REGION_CONTAINMENT_INVALID"
  | "SKETCH_REGION_MATERIAL_OVERLAP"
  | "SKETCH_REGION_COMPLEXITY_LIMIT"
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
  readonly profileKind: CadGeneratedReferenceProfileKind | "regions";
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
  readonly profileKind: CadGeneratedReferenceProfileKind | "regions";
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

interface CadSketchDimensionHealthBase {
  readonly dimensionId: SketchDimensionId;
  readonly dimensionName: string;
  readonly sketchId: SketchId;
  readonly valueSource: SketchDimensionValueSource;
  readonly status: CadDependencyHealthStatus;
  readonly affectedFeatureIds: readonly FeatureId[];
  readonly affectedBodyIds: readonly BodyId[];
  readonly effectiveValue?: number;
  readonly parameterId?: ParameterId;
  readonly issues: readonly CadDependencyHealthIssue[];
}

export interface CadSketchDimensionHealthLegacy extends CadSketchDimensionHealthBase {
  readonly entityId: SketchEntityId;
  readonly target: SketchDimensionTarget;
  readonly sourceShape?: never;
}

export interface CadSketchDimensionHealthV22 extends CadSketchDimensionHealthBase {
  readonly sourceShape: "v22";
  readonly target: SketchDimensionTargetV22;
  readonly entityId?: never;
}

export type CadSketchDimensionHealth =
  | CadSketchDimensionHealthLegacy
  | CadSketchDimensionHealthV22;

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
  readonly datumId?: DatumId;
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
  readonly datums?: DatumSemanticDiff;
  readonly features?: FeatureSemanticDiff;
  readonly references?: ReferenceSemanticDiff;
  readonly parameters?: ParameterSemanticDiff;
  readonly sketchDimensions?: SketchDimensionSemanticDiff;
  readonly sketchConstraints?: SketchConstraintSemanticDiff;
  readonly curveEdits?: readonly SketchCurveEditSemanticDiff[];
  readonly convenienceOperations?: readonly SketchConvenienceSemanticDiff[];
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
  | "authoredCombine"
  | "authoredOffset"
  | "authoredAlign"
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
  readonly toolProfileKind?: FeatureExtrudeProfileKind | "wire" | "regions";
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
  readonly unsupportedEntityKinds: readonly (CadTopologyEntityKind | "solid")[];
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
  | "authoredLoft"
  | "authoredHole"
  | "authoredChamfer"
  | "authoredFillet"
  | "authoredLinearPattern"
  | "authoredCircularPattern"
  | "authoredMirror"
  | "authoredCombine"
  | "authoredOffset"
  | "authoredAlign"
  | "authoredShell"
  | "importedBody"
  | "primitiveCompatibility"
  | "unresolvedSource";

export const CAD_EXPORT_SOURCE_KIND_BY_BODY_SOURCE_TYPE = {
  primitiveFeature: "primitiveCompatibility",
  sketchExtrudeFeature: "authoredExtrude",
  sketchRevolveFeature: "authoredRevolve",
  sketchHoleFeature: "authoredHole",
  edgeChamferFeature: "authoredChamfer",
  edgeFilletFeature: "authoredFillet",
  linearPatternFeature: "authoredLinearPattern",
  circularPatternFeature: "authoredCircularPattern",
  mirrorFeature: "authoredMirror",
  combineFeature: "authoredCombine",
  offsetFeature: "authoredOffset",
  alignFeature: "authoredAlign",
  shellFeature: "authoredShell",
  sweepFeature: "authoredSweep",
  loftFeature: "authoredLoft",
  importedStepBody: "importedBody"
} as const satisfies Record<CadBodySource["type"], CadExportBodySourceKind>;

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
  | "EXPORT_PRIMITIVE_SOURCE_UNAVAILABLE"
  | "EXPORT_BODY_SELECTION_INVALID"
  | "EXPORT_BODY_DUPLICATE"
  | "EXPORT_BODY_NOT_ACTIVE"
  | "EXPORT_EXACT_SOURCE_UNAVAILABLE"
  | "EXPORT_EXACT_SOURCE_STALE"
  | "EXPORT_EXACT_ARTIFACT_FAILED"
  | "EXPORT_EXACT_ARTIFACT_INVALID"
  | "EXPORT_EXACT_ARTIFACT_LIMIT_EXCEEDED"
  | "EXPORT_SOURCE_CHANGED"
  | "EXPORT_CANCELLED"
  | "EXPORT_STEP_NAMED_WRITER_UNAVAILABLE"
  | "EXPORT_STEP_TRANSFER_FAILED"
  | "EXPORT_STEP_WRITE_FAILED"
  | "EXPORT_STEP_ARTIFACT_INVALID"
  | "HOLE_TOOL_NO_INTERSECTION"
  | "HOLE_RESULT_INVALID"
  | "SHELL_TARGET_MULTI_SOLID_UNSUPPORTED"
  | "EXACT_CACHE_ENTRY_INVALID"
  | "CHECKPOINT_PAYLOAD_RECOVERY_MISMATCH";

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

export type CadCurrentExactResultStatus =
  | "pending"
  | "ready"
  | "stale"
  | "blocked"
  | "failed"
  | "unsupported";

export type CadExactBodyShapePolicy =
  | "singleSolid"
  | "singleShapeOneOrMoreSolids";

export type CadExactDownstreamOperation =
  | "holeTarget"
  | "patternSeed"
  | "mirrorSeed"
  | "shellTarget";

/** Byte-free, source-policy and current-shape evidence for downstream use. */
export interface CadExactDownstreamReadinessEvidence {
  readonly operation: CadExactDownstreamOperation;
  readonly status: CadCurrentExactResultStatus;
  readonly requiredShapePolicy: CadExactBodyShapePolicy;
  readonly shapePolicy?: CadExactBodyShapePolicy;
  readonly diagnostics: readonly CadExactResultDiagnostic[];
}

export interface CadExactResultDiagnostic {
  readonly code: CadExportDiagnosticCode;
  readonly status: CadCurrentExactResultStatus;
  readonly message: string;
  readonly bodyId?: BodyId;
  readonly sourceType?: CadBodySource["type"];
  readonly featureId?: FeatureId;
  readonly expected?: string;
  readonly received?: string;
}

/** Public, byte-free evidence for a session-only exact artifact. */
export interface CadExactArtifactEvidence {
  readonly bodyId: BodyId;
  readonly sourceType: CadBodySource["type"];
  readonly documentSourceIdentity: WcadSourceIdentity;
  readonly bodySourceIdentitySignature: string;
  readonly sourceGraphNodeCount: number;
  readonly brepFormat: "occt-brep";
  readonly brepByteLength: number;
  readonly brepSha256: string;
  readonly shapePolicy?: CadExactBodyShapePolicy;
  readonly topologySignature?: string;
}

export type CadCurrentExactResult =
  | {
      readonly status: "ready";
      readonly bodyId: BodyId;
      readonly sourceType: CadBodySource["type"];
      readonly sourceIdentitySignature: string;
      readonly artifactEvidence?: CadExactArtifactEvidence;
      readonly downstreamReadiness?: readonly CadExactDownstreamReadinessEvidence[];
      readonly diagnostics: readonly CadExactResultDiagnostic[];
    }
  | {
      readonly status: Exclude<CadCurrentExactResultStatus, "ready">;
      readonly bodyId: BodyId;
      readonly sourceType: CadBodySource["type"];
      readonly downstreamReadiness?: readonly CadExactDownstreamReadinessEvidence[];
      readonly diagnostics: readonly CadExactResultDiagnostic[];
    };

export interface CadExactExportPlan {
  readonly format: "step";
  readonly schema: "AP242DIS";
  readonly units: DocumentUnits;
  readonly sourceIdentity: WcadSourceIdentity;
  readonly orderedBodyIds: readonly BodyId[];
  readonly allOrNothing: true;
  readonly planIdentity: string;
  readonly bodies: readonly CadExactExportPlanBody[];
}

export interface CadExactExportPlanBody {
  readonly bodyId: BodyId;
  readonly bodyName: string;
  readonly partId: PartId;
  readonly featureId: FeatureId;
  readonly sourceType: CadBodySource["type"];
  readonly sourceIdentitySignature: string;
  readonly status: "ready" | "blocked";
  readonly diagnostics: readonly CadExportDiagnostic[];
}

export interface CadExactReadySubsetBody {
  readonly bodyId: BodyId;
  readonly bodyName: string;
  readonly diagnostics: readonly CadExportDiagnostic[];
}

/** Review metadata only; execution still uses a normal explicit bodyIds plan. */
export interface CadExactReadySubsetMetadata {
  readonly orderedBodyIds: readonly BodyId[];
  readonly includedBodies: readonly CadExactReadySubsetBody[];
  readonly excludedBodies: readonly CadExactReadySubsetBody[];
  readonly allOrNothing: true;
}

export type ProjectPortabilityStatus =
  | { readonly status: "portable-json" }
  | {
      readonly status: "wcad-required";
      readonly checkpointIds: readonly string[];
    }
  | {
      readonly status: "payload-missing";
      readonly checkpointIds: readonly string[];
    };

export interface ProjectCheckpointPayloadRecoveryDiagnostic {
  readonly code: "CHECKPOINT_PAYLOAD_RECOVERY_MISMATCH";
  readonly checkpointId: string;
  readonly message: string;
  readonly expected?: string;
  readonly received?: string;
}

/** Byte-free result of one atomic user-selected .wcad payload recovery. */
export type ProjectCheckpointPayloadRecoveryResult =
  | {
      readonly status: "recovered";
      readonly projectSourceIdentity: WcadSourceIdentity;
      readonly requestedCheckpointIds: readonly string[];
      readonly recoveredCheckpointIds: readonly string[];
      readonly diagnostics: readonly [];
    }
  | {
      readonly status: "rejected";
      readonly projectSourceIdentity: WcadSourceIdentity;
      readonly requestedCheckpointIds: readonly string[];
      readonly recoveredCheckpointIds: readonly [];
      readonly diagnostics: readonly ProjectCheckpointPayloadRecoveryDiagnostic[];
    };

export type CadExactArtifactCacheStatus = "ready" | "degraded" | "unavailable";

/** Aggregate derived-cache evidence; private keys and paths are excluded. */
export interface CadExactArtifactCacheSummary {
  readonly status: CadExactArtifactCacheStatus;
  readonly entryCount: number;
  readonly retainedByteLength: number;
}

export interface CadExactExportQueryEvidence {
  readonly plan?: CadExactExportPlan;
  readonly currentExactResults?: readonly CadCurrentExactResult[];
  readonly readySubset?: CadExactReadySubsetMetadata;
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

export type CadExactExportResolvedRegionLoop =
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
    }
  | CadExactExportResolvedWireProfile;

export interface CadExactExportResolvedRegionProfile {
  readonly kind: "region";
  readonly frame: CadExactExportResolvedWireProfile["frame"];
  readonly outer: CadExactExportResolvedRegionLoop;
  readonly holes: readonly CadExactExportResolvedRegionLoop[];
  readonly sourceIdentity: string;
  readonly geometryPolicy: CadExactExportResolvedWireProfile["geometryPolicy"];
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
  | CadExactExportWireExtrudeSource
  | CadExactExportBooleanResultSource;

export type CadExactExportBooleanResultSource =
  | {
      readonly kind: "booleanExtrudes";
      readonly operation: "add";
      readonly materialPolicy?: "regionPositiveVolumeSingleSolid";
      readonly target: CadExactExportBooleanSource;
      readonly tool: CadExactExportBooleanSource;
    }
  | {
      readonly kind: "booleanExtrudes";
      readonly operation: "cut";
      readonly materialPolicy?: "regionPositiveVolumeSingleSolid";
      readonly target: CadExactExportBooleanSource;
      readonly tool: CadExactExportBooleanSource;
    };

export interface CadExactExportRegionExtrudeBodySource extends CadExactExportExtrudeBodySourceBase {
  readonly kind: "regionExtrude";
  readonly sourceSketchEntityId?: never;
  readonly sourceSketchEntityIds: readonly SketchEntityId[];
  readonly regions: SketchRegionsProfileRef;
  readonly recipe: CadExactExportBooleanSource;
  readonly targetBodyId?: BodyId;
  readonly targetTopologyAnchorId?: string;
  readonly exactResultSourceIdentitySignature?: string;
  readonly solidPolicy: "positiveVolumeSingleSolid";
}

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
  readonly profile:
    | CadExactExportResolvedWireProfile
    | CadExactExportResolvedRegionProfile;
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

/** @deprecated V21 production export consumes identity-bound exact artifacts. */
export type CadExactExportBodySource =
  | CadExactExportExtrudeBodySource
  | CadExactExportRegionExtrudeBodySource
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

/** @deprecated Compatibility-only base64 artifact shape. */
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
  | "SKETCH_REGION_LOOP_OPEN"
  | "SKETCH_REGION_LOOP_INTERSECTION"
  | "SKETCH_REGION_BOUNDARY_TOUCHING"
  | "SKETCH_REGION_HOLE_OUTSIDE"
  | "SKETCH_REGION_HOLES_OVERLAP"
  | "SKETCH_REGION_MATERIAL_OVERLAP"
  | "SKETCH_REGION_NESTING_UNSUPPORTED"
  | "SKETCH_REGION_COMPLEXITY_LIMIT"
  | "SKETCH_REGION_CONSUMER_UNSUPPORTED"
  | "SKETCH_REGION_RESULT_NOT_SINGLE_SOLID"
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
  readonly regionCandidateKey?: string;
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
  readonly requestedProfile: SketchProfileRefV22;
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
  readonly normalizedProfile: SketchProfileRefV22;
  readonly orientation: "counterclockwise";
  readonly orientationNormalized: boolean;
  readonly area: number;
  readonly signedArea: number;
  readonly bounds: SketchBounds2d;
  readonly intersectionStatus: "clear";
}

export interface SketchProfileReadinessBlockedQueryResponse extends SketchProfileReadinessQueryResponseBase {
  readonly status: "blocked";
  readonly normalizedProfile?: SketchProfileRefV22;
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

export interface SketchCurveEditIntersectionPreview {
  readonly boundaryEntityId: SketchEntityId;
  readonly point: Vec2;
  readonly targetParameter: number;
}

export interface SketchCurveEditPreview {
  readonly intersections: readonly SketchCurveEditIntersectionPreview[];
  readonly projectedSplitParameters: readonly number[];
  readonly resultEntityCount: number;
  readonly resultEntities: readonly SketchEntitySnapshot[];
}

interface SketchCurveEditReadinessQueryResponseBase {
  readonly ok: true;
  readonly query: "sketch.curveEditReadiness";
  readonly cadOpsVersion: CadOpsVersion;
}

export interface SketchCurveEditReadinessReadyResponse extends SketchCurveEditReadinessQueryResponseBase {
  readonly status: "ready";
  readonly preparedOperation: PreparedSketchCurveEditOp;
  readonly impact: SketchCurveEditImpact;
  readonly preview: SketchCurveEditPreview;
  readonly diagnostics: readonly [];
}

export interface SketchCurveEditReadinessBlockedResponse extends SketchCurveEditReadinessQueryResponseBase {
  readonly status: "blocked";
  readonly impact?: SketchCurveEditImpact;
  readonly preview?: SketchCurveEditPreview;
  readonly diagnostics: readonly CadSketchEditDiagnostic[];
}

export type SketchCurveEditReadinessQueryResponse =
  | SketchCurveEditReadinessReadyResponse
  | SketchCurveEditReadinessBlockedResponse;

export type SketchRegionDiagnosticCode =
  | "SKETCH_REGION_PROFILE_EMPTY"
  | "SKETCH_REGION_SKETCH_MISMATCH"
  | "SKETCH_REGION_ENTITY_MISSING"
  | "SKETCH_REGION_ENTITY_UNSUPPORTED"
  | "SKETCH_REGION_CONSTRUCTION_ENTITY"
  | "SKETCH_REGION_ENTITY_REPEATED"
  | "SKETCH_REGION_LOOP_OPEN"
  | "SKETCH_REGION_LOOP_INTERSECTION"
  | "SKETCH_REGION_LOOP_AREA_TOO_SMALL"
  | "SKETCH_REGION_BOUNDARY_TOUCHING"
  | "SKETCH_REGION_HOLE_OUTSIDE"
  | "SKETCH_REGION_HOLES_OVERLAP"
  | "SKETCH_REGION_MATERIAL_OVERLAP"
  | "SKETCH_REGION_NESTING_UNSUPPORTED"
  | "SKETCH_REGION_COMPLEXITY_LIMIT"
  | "SKETCH_REGION_SOURCE_REVISION_STALE"
  | "SKETCH_REGION_CURSOR_INVALID"
  | "SKETCH_REGION_CONSUMER_UNSUPPORTED"
  | "SKETCH_REGION_RESULT_NOT_SINGLE_SOLID";

export interface SketchRegionDiagnostic {
  readonly code: SketchRegionDiagnosticCode;
  readonly severity: CadFeatureEditDiagnosticSeverity;
  readonly message: string;
  readonly sketchId?: SketchId;
  readonly entityId?: SketchEntityId;
  readonly featureId?: FeatureId;
  readonly regionKey?: string;
  readonly loopKey?: string;
  readonly expected?: string;
  readonly received?: string;
  readonly recoveryAction?: string;
}

export interface SketchProfileRegionCandidate {
  readonly candidateKey: string;
  readonly region: SketchProfileRegionRef;
  readonly outerLoopKey: string;
  readonly holeLoopKeys: readonly string[];
  readonly outerEntityIds: readonly SketchEntityId[];
  readonly holeEntityIds: readonly (readonly SketchEntityId[])[];
  readonly signedArea: number;
  readonly materialArea: number;
  readonly containmentDepth: number;
  readonly status: "valid" | "invalid";
  readonly diagnostics: readonly SketchRegionDiagnostic[];
}

export interface SketchProfileRegionCandidatesQueryResponse {
  readonly ok: true;
  readonly query: "sketch.profileRegionCandidates";
  readonly cadOpsVersion: CadOpsVersion;
  readonly sketchId: SketchId;
  readonly status: "ready" | "blocked";
  readonly sourceRevision: string;
  readonly sourceFingerprint: string;
  readonly candidateCount: number;
  readonly candidates: readonly SketchProfileRegionCandidate[];
  readonly hasMore: boolean;
  readonly nextAfterCandidateKey?: string;
  readonly complexity: SketchProfileRegionComplexity;
  readonly diagnostics: readonly SketchRegionDiagnostic[];
}

export interface SketchProfileRegionLoopSummary {
  readonly loopKey: string;
  readonly role: "outer" | "hole";
  readonly regionIndex: number;
  readonly entityIds: readonly SketchEntityId[];
  readonly signedArea: number;
  readonly absoluteArea: number;
  readonly containmentDepth: number;
}

export interface SketchProfileRegionComplexity {
  readonly regionCount: number;
  readonly loopCount: number;
  readonly segmentReferenceCount: number;
  readonly predicateVisitCount: number;
}

export interface SketchProfileRegionValidateQueryResponse {
  readonly ok: true;
  readonly query: "sketch.profileRegionValidate";
  readonly cadOpsVersion: CadOpsVersion;
  readonly status: "ready" | "blocked";
  readonly requestedProfile: SketchRegionsProfileRef;
  readonly normalizedProfile?: SketchRegionsProfileRef;
  readonly loopSummaries: readonly SketchProfileRegionLoopSummary[];
  readonly materialAreas: readonly number[];
  readonly complexity: SketchProfileRegionComplexity;
  readonly diagnostics: readonly SketchRegionDiagnostic[];
}

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
  | SketchCurveEditReadinessQueryResponse
  | SketchProfileRegionCandidatesQueryResponse
  | SketchProfileRegionValidateQueryResponse
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
  readonly datums?: readonly DatumSnapshot[];
}

export interface ProjectHealthQueryResponse {
  readonly ok: true;
  readonly query: "project.health";
  readonly cadOpsVersion: CadOpsVersion;
  readonly status: CadDependencyHealthStatus;
  readonly issueCount: number;
  readonly exactBodyCount?: number;
  readonly exactReadyBodyCount?: number;
  readonly exactPendingBodyCount?: number;
  readonly exactStaleBodyCount?: number;
  readonly exactBlockedBodyCount?: number;
  readonly exactFailedBodyCount?: number;
  readonly exactUnsupportedBodyCount?: number;
  readonly currentExactResults?: readonly CadCurrentExactResult[];
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
  readonly plan?: CadExactExportPlan;
  readonly currentExactResults?: readonly CadCurrentExactResult[];
  readonly readySubset?: CadExactReadySubsetMetadata;
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
  /** @deprecated V21 production export consumes the exact export plan. */
  readonly exportSources: readonly CadExactExportBodySource[];
  readonly bodies: readonly CadExportBodyReadiness[];
  readonly diagnosticCount: number;
  readonly diagnostics: readonly CadExportDiagnostic[];
  readonly plan?: CadExactExportPlan;
  readonly currentExactResults?: readonly CadCurrentExactResult[];
  readonly readySubset?: CadExactReadySubsetMetadata;
  /** @deprecated Compatibility-only base64 artifact response. */
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
  readonly portability?: ProjectPortabilityStatus;
  readonly exactArtifactCache?: CadExactArtifactCacheSummary;
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
  readonly dimensions: readonly CadSketchSolverDimensionSummaryCurrent[];
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
  readonly dimensions: readonly SketchDimensionEntryCurrent[];
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
  readonly dimensions: readonly SketchDimensionEntryCurrent[];
}

export interface SketchDimensionGetQueryResponse {
  readonly ok: true;
  readonly query: "sketch.dimension.get";
  readonly cadOpsVersion: CadOpsVersion;
  readonly dimension: SketchDimensionEntryCurrent;
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

interface SelectionReferenceCandidatesQueryResponseBase {
  readonly ok: true;
  readonly query: "selection.referenceCandidates";
  readonly cadOpsVersion: CadOpsVersion;
  readonly requiredOperation?: CadSelectionReferenceOperation;
  readonly status: CadSelectionReferenceStatus;
  readonly candidateCount: number;
  readonly candidates: readonly CadSelectionReferenceCandidate[];
  readonly issueCount: number;
  readonly issues: readonly CadSelectionReferenceIssue[];
}

export type SelectionReferenceCandidatesQueryResponse =
  | (SelectionReferenceCandidatesQueryResponseBase & {
      readonly selection: CadSelectionReferenceInput;
      readonly currentTopology?: never;
    })
  | (SelectionReferenceCandidatesQueryResponseBase & {
      readonly selection?: never;
      readonly currentTopology: CadCurrentTopologySelectionProjection;
    });

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
  | "COUNT_MISMATCH"
  | "COMMAND_INPUT_AMBIGUOUS";

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
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== null && prototype !== Object.prototype) {
    issues.push({
      code: "UNKNOWN_FIELD",
      path: `${path}.__proto__`,
      message: "Protocol records must not inherit custom fields."
    });
  }
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || !allowed.has(key)) {
      const label = typeof key === "symbol" ? key.toString() : key;
      issues.push({
        code: "UNKNOWN_FIELD",
        path: `${path}.${label}`,
        message: `Field '${label}' is not part of this query contract.`
      });
    }
  }
  for (const key in value) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      issues.push({
        code: "UNKNOWN_FIELD",
        path: `${path}.${key}`,
        message: `Inherited field '${key}' is not part of this query contract.`
      });
    }
  }
  for (const key of required) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      issues.push({
        code: "MISSING_FIELD",
        path: `${path}.${key}`,
        message: `Required field '${key}' is missing.`
      });
    }
  }
  return true;
}

function validateDenseArray(
  value: readonly unknown[],
  path: string,
  issues: SketchProfilePathValidationIssue[]
): void {
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, index)) {
      issues.push({
        code: "MISSING_FIELD",
        path: `${path}[${index}]`,
        message: "Sparse arrays are not valid protocol input."
      });
    }
  }
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
  for (let index = 0; index < value.length; index += 1) {
    if (!(index in value)) {
      issues.push({
        code: "INVALID_VALUE",
        path: `${path}[${index}]`,
        message: "Sparse arrays are not allowed."
      });
      continue;
    }
    validateNonEmptyString(value[index], `${path}[${index}]`, issues);
  }
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
  for (let index = 0; index < value.length; index += 1) {
    if (!(index in value)) {
      issues.push({
        code: "INVALID_VALUE",
        path: `${path}[${index}]`,
        message: "Sparse arrays are not allowed."
      });
      continue;
    }
    const segment = value[index];
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
      continue;
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
  }
}

function validateDistinctOrientedSegmentEntityIds(
  value: unknown,
  path: string,
  issues: SketchProfilePathValidationIssue[]
): void {
  if (!Array.isArray(value)) return;
  const entityIds = new Set<string>();
  for (let index = 0; index < value.length; index += 1) {
    const segment = value[index];
    if (!isUnknownRecord(segment) || typeof segment.entityId !== "string") {
      continue;
    }
    if (entityIds.has(segment.entityId)) {
      issues.push({
        code: "INVALID_VALUE",
        path: `${path}[${index}].entityId`,
        message: "An oriented segment list cannot repeat an entity ID."
      });
    }
    entityIds.add(segment.entityId);
  }
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
    validateDistinctOrientedSegmentEntityIds(
      value.segments,
      `${path}.segments`,
      issues
    );
    return;
  }
  if (!entityOnly && value.kind === "regions") {
    if (
      !validateExactRecord(
        value,
        path,
        ["kind", "sketchId", "regions"],
        [],
        issues
      )
    )
      return;
    validateNonEmptyString(value.sketchId, `${path}.sketchId`, issues);
    validateRegions(value.regions, `${path}.regions`, issues);
    return;
  }
  issues.push({
    code: "INVALID_VALUE",
    path: `${path}.kind`,
    message: entityOnly
      ? "Expected an entity profile reference."
      : "Expected profile kind 'entity', 'wire', or 'regions'."
  });
}

function validateSketchLoopRef(
  value: unknown,
  path: string,
  issues: SketchProfilePathValidationIssue[]
): number {
  if (!isUnknownRecord(value)) {
    issues.push({
      code: "INVALID_TYPE",
      path,
      message: "Expected a sketch loop reference."
    });
    return 0;
  }
  if (value.kind === "entity") {
    if (!validateExactRecord(value, path, ["kind", "entityId"], [], issues)) {
      return 0;
    }
    validateNonEmptyString(value.entityId, `${path}.entityId`, issues);
    return 0;
  }
  if (value.kind === "wire") {
    if (!validateExactRecord(value, path, ["kind", "segments"], [], issues)) {
      return 0;
    }
    validateOrientedSegments(value.segments, `${path}.segments`, issues);
    if (Array.isArray(value.segments) && value.segments.length < 2) {
      issues.push({
        code: "INVALID_VALUE",
        path: `${path}.segments`,
        message: "A wire loop requires at least two segments."
      });
    }
    return Array.isArray(value.segments) ? value.segments.length : 0;
  }
  issues.push({
    code: "INVALID_VALUE",
    path: `${path}.kind`,
    message: "Expected loop kind 'entity' or 'wire'."
  });
  return 0;
}

function validateRegions(
  value: unknown,
  path: string,
  issues: SketchProfilePathValidationIssue[]
): void {
  if (!Array.isArray(value) || value.length === 0) {
    issues.push({
      code: "INVALID_VALUE",
      path,
      message: "Expected at least one profile region."
    });
    return;
  }
  if (value.length > CAD_V19_RESOURCE_LIMITS.maxRegionsPerProfile) {
    issues.push({
      code: "INVALID_VALUE",
      path,
      message: "The regions profile exceeds the V19 region limit."
    });
  }
  let loopCount = 0;
  let segmentReferenceCount = 0;
  const entityIds = new Set<string>();
  for (let regionIndex = 0; regionIndex < value.length; regionIndex += 1) {
    if (!(regionIndex in value)) {
      issues.push({
        code: "INVALID_VALUE",
        path: `${path}[${regionIndex}]`,
        message: "Sparse arrays are not allowed."
      });
      continue;
    }
    const region = value[regionIndex];
    const regionPath = `${path}[${regionIndex}]`;
    if (
      !validateExactRecord(region, regionPath, ["outer", "holes"], [], issues)
    ) {
      continue;
    }
    loopCount += 1;
    segmentReferenceCount += validateSketchLoopRef(
      region.outer,
      `${regionPath}.outer`,
      issues
    );
    if (!Array.isArray(region.holes)) {
      issues.push({
        code: "INVALID_TYPE",
        path: `${regionPath}.holes`,
        message: "Expected a hole-loop array."
      });
      continue;
    }
    loopCount += region.holes.length;
    for (let holeIndex = 0; holeIndex < region.holes.length; holeIndex += 1) {
      if (!(holeIndex in region.holes)) {
        issues.push({
          code: "INVALID_VALUE",
          path: `${regionPath}.holes[${holeIndex}]`,
          message: "Sparse arrays are not allowed."
        });
        continue;
      }
      const hole = region.holes[holeIndex];
      segmentReferenceCount += validateSketchLoopRef(
        hole,
        `${regionPath}.holes[${holeIndex}]`,
        issues
      );
    }
    const loops = [region.outer, ...region.holes];
    loops.forEach((loop, loopIndex) => {
      if (!isUnknownRecord(loop)) return;
      const ids =
        loop.kind === "entity"
          ? [loop.entityId]
          : loop.kind === "wire" && Array.isArray(loop.segments)
            ? loop.segments
                .filter(isUnknownRecord)
                .map((segment) => segment.entityId)
            : [];
      ids.forEach((entityId) => {
        if (typeof entityId !== "string") return;
        if (entityIds.has(entityId)) {
          issues.push({
            code: "INVALID_VALUE",
            path: `${regionPath}.${loopIndex === 0 ? "outer" : `holes[${loopIndex - 1}]`}`,
            message:
              "An entity ID may appear in at most one loop in a regions profile."
          });
        }
        entityIds.add(entityId);
      });
    });
  }
  if (loopCount > CAD_V19_RESOURCE_LIMITS.maxLoopsPerProfile) {
    issues.push({
      code: "INVALID_VALUE",
      path,
      message: "The regions profile exceeds the V19 loop limit."
    });
  }
  if (
    segmentReferenceCount >
    CAD_V19_RESOURCE_LIMITS.maxSegmentReferencesPerProfile
  ) {
    issues.push({
      code: "INVALID_VALUE",
      path,
      message: "The regions profile exceeds the V19 segment-reference limit."
    });
  }
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
  "SKETCH_REGION_LOOP_OPEN",
  "SKETCH_REGION_LOOP_INTERSECTION",
  "SKETCH_REGION_BOUNDARY_TOUCHING",
  "SKETCH_REGION_HOLE_OUTSIDE",
  "SKETCH_REGION_HOLES_OVERLAP",
  "SKETCH_REGION_MATERIAL_OVERLAP",
  "SKETCH_REGION_NESTING_UNSUPPORTED",
  "SKETCH_REGION_COMPLEXITY_LIMIT",
  "SKETCH_REGION_CONSUMER_UNSUPPORTED",
  "SKETCH_REGION_RESULT_NOT_SINGLE_SOLID",
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
  if (
    left.kind === "regions" &&
    Array.isArray(left.regions) &&
    Array.isArray(right.regions)
  ) {
    return JSON.stringify(left.regions) === JSON.stringify(right.regions);
  }
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
            ["regionCandidateKey"],
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
          if (candidate.regionCandidateKey !== undefined) {
            validateNonEmptyString(
              candidate.regionCandidateKey,
              `${path}.regionCandidateKey`,
              issues
            );
          }
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

export type CadV19ProtocolValidationIssue = SketchProfilePathValidationIssue;
export type CadV19ProtocolValidationResult<T> =
  SketchProfilePathValidationResult<T>;

function validateVec2(
  value: unknown,
  path: string,
  issues: SketchProfilePathValidationIssue[]
): void {
  if (!Array.isArray(value) || value.length !== 2) {
    issues.push({
      code: "INVALID_TYPE",
      path,
      message: "Expected a two-element point."
    });
    return;
  }
  validateFiniteNumber(value[0], `${path}[0]`, issues);
  validateFiniteNumber(value[1], `${path}[1]`, issues);
}

function validateUniqueIdArray(
  value: unknown,
  path: string,
  issues: SketchProfilePathValidationIssue[],
  options: {
    readonly exactLength?: number;
    readonly minLength?: number;
    readonly maxLength?: number;
  } = {}
): void {
  validateIdArray(value, path, issues);
  if (!Array.isArray(value)) return;
  if (options.minLength !== undefined && value.length < options.minLength) {
    issues.push({
      code: "INVALID_VALUE",
      path,
      message: `Expected at least ${options.minLength} IDs.`
    });
  }
  if (
    options.exactLength !== undefined &&
    value.length !== options.exactLength
  ) {
    issues.push({
      code: "INVALID_VALUE",
      path,
      message: `Expected exactly ${options.exactLength} IDs.`
    });
  }
  if (options.maxLength !== undefined && value.length > options.maxLength) {
    issues.push({
      code: "INVALID_VALUE",
      path,
      message: `Expected at most ${options.maxLength} IDs.`
    });
  }
  const ids = value.filter((id): id is string => typeof id === "string");
  if (new Set(ids).size !== ids.length) {
    issues.push({
      code: "INVALID_VALUE",
      path,
      message: "Duplicate IDs are not allowed."
    });
  }
}

const CAD_BODY_SOURCE_TYPES = Object.keys(
  CAD_EXPORT_SOURCE_KIND_BY_BODY_SOURCE_TYPE
) as readonly CadBodySource["type"][];

const CAD_EXPORT_BODY_SOURCE_KINDS = [
  ...Object.values(CAD_EXPORT_SOURCE_KIND_BY_BODY_SOURCE_TYPE),
  "unresolvedSource"
] as readonly CadExportBodySourceKind[];

export const CAD_EXPORT_DIAGNOSTIC_CODES: readonly CadExportDiagnosticCode[] =
  Object.freeze([
    "EXPORT_WRITER_NOT_IMPLEMENTED",
    "EXPORT_EXACT_WRITER_UNAVAILABLE",
    "EXPORT_EXACT_WRITER_FAILED",
    "EXPORT_EXACT_FORMAT_UNSUPPORTED",
    "EXPORT_EXACT_BODY_UNSUPPORTED",
    "EXPORT_SOURCE_IDENTITY_MISMATCH",
    "EXPORT_PROJECT_EMPTY",
    "EXPORT_BODY_SOURCE_SUPPORTED",
    "EXPORT_BODY_CONSUMED",
    "EXPORT_BODY_SOURCE_UNRESOLVED",
    "EXPORT_BODY_SOURCE_UNSUPPORTED",
    "EXPORT_RESULT_BODY_DEFERRED",
    "EXPORT_PRIMITIVE_SOURCE_UNAVAILABLE",
    "EXPORT_BODY_SELECTION_INVALID",
    "EXPORT_BODY_DUPLICATE",
    "EXPORT_BODY_NOT_ACTIVE",
    "EXPORT_EXACT_SOURCE_UNAVAILABLE",
    "EXPORT_EXACT_SOURCE_STALE",
    "EXPORT_EXACT_ARTIFACT_FAILED",
    "EXPORT_EXACT_ARTIFACT_INVALID",
    "EXPORT_EXACT_ARTIFACT_LIMIT_EXCEEDED",
    "EXPORT_SOURCE_CHANGED",
    "EXPORT_CANCELLED",
    "EXPORT_STEP_NAMED_WRITER_UNAVAILABLE",
    "EXPORT_STEP_TRANSFER_FAILED",
    "EXPORT_STEP_WRITE_FAILED",
    "EXPORT_STEP_ARTIFACT_INVALID",
    "HOLE_TOOL_NO_INTERSECTION",
    "HOLE_RESULT_INVALID",
    "SHELL_TARGET_MULTI_SOLID_UNSUPPORTED",
    "EXACT_CACHE_ENTRY_INVALID",
    "CHECKPOINT_PAYLOAD_RECOVERY_MISMATCH"
  ]);

const CAD_CURRENT_EXACT_RESULT_STATUSES: readonly CadCurrentExactResultStatus[] =
  ["pending", "ready", "stale", "blocked", "failed", "unsupported"];

function validateWcadSourceIdentityEvidence(
  value: unknown,
  path: string,
  issues: SketchProfilePathValidationIssue[]
): value is UnknownRecord {
  if (!validateExactRecord(value, path, ["sha256", "algorithm"], [], issues)) {
    return false;
  }
  if (value.algorithm !== WCAD_SOURCE_IDENTITY_ALGORITHM) {
    issues.push({
      code: "INVALID_VALUE",
      path: `${path}.algorithm`,
      message: `Expected ${WCAD_SOURCE_IDENTITY_ALGORITHM}.`
    });
  }
  if (
    typeof value.sha256 !== "string" ||
    !/^[0-9a-f]{64}$/.test(value.sha256)
  ) {
    issues.push({
      code: "INVALID_VALUE",
      path: `${path}.sha256`,
      message: "Expected a lowercase SHA-256 digest."
    });
  }
  return true;
}

function validateBoundedCount(
  value: unknown,
  path: string,
  maximum: number,
  issues: SketchProfilePathValidationIssue[],
  positive = false
): value is number {
  if (!validateNonNegativeInteger(value, path, issues)) return false;
  if ((positive && value === 0) || value > maximum) {
    issues.push({
      code: "INVALID_VALUE",
      path,
      message: `Expected ${positive ? "a positive integer" : "an integer"} no greater than ${maximum}.`
    });
    return false;
  }
  return true;
}

function validateCadExportDiagnosticEvidence(
  value: unknown,
  path: string,
  issues: SketchProfilePathValidationIssue[]
): void {
  if (
    !validateExactRecord(
      value,
      path,
      ["code", "status", "message"],
      [
        "format",
        "bodyId",
        "bodyName",
        "bodyKind",
        "sourceKind",
        "featureId",
        "objectId",
        "consumedByFeatureId",
        "expected",
        "received"
      ],
      issues
    )
  ) {
    return;
  }
  validateEnum(value.code, CAD_EXPORT_DIAGNOSTIC_CODES, `${path}.code`, issues);
  validateEnum(
    value.status,
    ["supported", "deferred", "unavailable"],
    `${path}.status`,
    issues
  );
  validateNonEmptyString(value.message, `${path}.message`, issues);
  if ("format" in value) {
    validateEnum(value.format, ["step", "glb"], `${path}.format`, issues);
  }
  for (const field of [
    "bodyId",
    "bodyName",
    "featureId",
    "objectId",
    "consumedByFeatureId",
    "expected",
    "received"
  ] as const) {
    if (field in value) {
      validateNonEmptyString(value[field], `${path}.${field}`, issues);
    }
  }
  if ("bodyKind" in value) {
    validateEnum(value.bodyKind, ["solid"], `${path}.bodyKind`, issues);
  }
  if ("sourceKind" in value) {
    validateEnum(
      value.sourceKind,
      CAD_EXPORT_BODY_SOURCE_KINDS,
      `${path}.sourceKind`,
      issues
    );
  }
}

function validateCadExactResultDiagnostic(
  value: unknown,
  path: string,
  issues: SketchProfilePathValidationIssue[]
): void {
  if (
    !validateExactRecord(
      value,
      path,
      ["code", "status", "message"],
      ["bodyId", "sourceType", "featureId", "expected", "received"],
      issues
    )
  ) {
    return;
  }
  validateEnum(value.code, CAD_EXPORT_DIAGNOSTIC_CODES, `${path}.code`, issues);
  validateEnum(
    value.status,
    CAD_CURRENT_EXACT_RESULT_STATUSES,
    `${path}.status`,
    issues
  );
  validateNonEmptyString(value.message, `${path}.message`, issues);
  for (const field of [
    "bodyId",
    "featureId",
    "expected",
    "received"
  ] as const) {
    if (field in value) {
      validateNonEmptyString(value[field], `${path}.${field}`, issues);
    }
  }
  if ("sourceType" in value) {
    validateEnum(
      value.sourceType,
      CAD_BODY_SOURCE_TYPES,
      `${path}.sourceType`,
      issues
    );
  }
}

function validateCadExactArtifactEvidence(
  value: unknown,
  path: string,
  issues: SketchProfilePathValidationIssue[]
): value is UnknownRecord {
  if (
    !validateExactRecord(
      value,
      path,
      [
        "bodyId",
        "sourceType",
        "documentSourceIdentity",
        "bodySourceIdentitySignature",
        "sourceGraphNodeCount",
        "brepFormat",
        "brepByteLength",
        "brepSha256"
      ],
      ["shapePolicy", "topologySignature"],
      issues
    )
  ) {
    return false;
  }
  validateNonEmptyString(value.bodyId, `${path}.bodyId`, issues);
  validateEnum(
    value.sourceType,
    CAD_BODY_SOURCE_TYPES,
    `${path}.sourceType`,
    issues
  );
  validateWcadSourceIdentityEvidence(
    value.documentSourceIdentity,
    `${path}.documentSourceIdentity`,
    issues
  );
  validateNonEmptyString(
    value.bodySourceIdentitySignature,
    `${path}.bodySourceIdentitySignature`,
    issues
  );
  validateBoundedCount(
    value.sourceGraphNodeCount,
    `${path}.sourceGraphNodeCount`,
    CAD_V21_EXACT_EXPORT_RESOURCE_LIMITS.maxSourceGraphNodes,
    issues,
    true
  );
  validateEnum(value.brepFormat, ["occt-brep"], `${path}.brepFormat`, issues);
  validateBoundedCount(
    value.brepByteLength,
    `${path}.brepByteLength`,
    CAD_V21_EXACT_EXPORT_RESOURCE_LIMITS.maxBrepArtifactBytes,
    issues,
    true
  );
  if (
    typeof value.brepSha256 !== "string" ||
    !/^[0-9a-f]{64}$/.test(value.brepSha256)
  ) {
    issues.push({
      code: "INVALID_VALUE",
      path: `${path}.brepSha256`,
      message: "Expected a lowercase SHA-256 digest."
    });
  }
  if ("shapePolicy" in value) {
    validateEnum(
      value.shapePolicy,
      ["singleSolid", "singleShapeOneOrMoreSolids"],
      `${path}.shapePolicy`,
      issues
    );
  }
  if ("topologySignature" in value) {
    validateNonEmptyString(
      value.topologySignature,
      `${path}.topologySignature`,
      issues
    );
  }
  return true;
}

const CAD_EXACT_DOWNSTREAM_OPERATIONS: readonly CadExactDownstreamOperation[] =
  ["holeTarget", "patternSeed", "mirrorSeed", "shellTarget"];

function validateCadExactDownstreamReadinessEvidence(
  value: unknown,
  path: string,
  issues: SketchProfilePathValidationIssue[]
): void {
  if (
    !validateExactRecord(
      value,
      path,
      ["operation", "status", "requiredShapePolicy", "diagnostics"],
      ["shapePolicy"],
      issues
    )
  ) {
    return;
  }
  validateEnum(
    value.operation,
    CAD_EXACT_DOWNSTREAM_OPERATIONS,
    `${path}.operation`,
    issues
  );
  validateEnum(
    value.status,
    CAD_CURRENT_EXACT_RESULT_STATUSES,
    `${path}.status`,
    issues
  );
  const requiredShapePolicy =
    value.operation === "shellTarget"
      ? "singleSolid"
      : "singleShapeOneOrMoreSolids";
  if (value.requiredShapePolicy !== requiredShapePolicy) {
    issues.push({
      code: "INVALID_VALUE",
      path: `${path}.requiredShapePolicy`,
      message: `${String(value.operation)} requires ${requiredShapePolicy}.`
    });
  }
  if ("shapePolicy" in value) {
    validateEnum(
      value.shapePolicy,
      ["singleSolid", "singleShapeOneOrMoreSolids"],
      `${path}.shapePolicy`,
      issues
    );
  }
  if (value.status === "ready" && !("shapePolicy" in value)) {
    issues.push({
      code: "MISSING_FIELD",
      path,
      message: "Ready downstream evidence requires a shape policy."
    });
  }
  if (
    value.status === "ready" &&
    value.operation === "shellTarget" &&
    value.shapePolicy !== "singleSolid"
  ) {
    issues.push({
      code: "INVALID_VALUE",
      path: `${path}.shapePolicy`,
      message: "A ready shell target must contain exactly one solid."
    });
  }
  validateCadExactResultDiagnostics(
    value.diagnostics,
    `${path}.diagnostics`,
    value.status,
    issues,
    CAD_V21_EXACT_EXPORT_RESOURCE_LIMITS.maxSelectedBodies
  );
}

function validateCadExactResultDiagnostics(
  value: unknown,
  path: string,
  status: unknown,
  issues: SketchProfilePathValidationIssue[],
  maxLength?: number
): void {
  if (!Array.isArray(value)) {
    issues.push({
      code: "INVALID_TYPE",
      path,
      message: "Expected a diagnostic array."
    });
    return;
  }
  if (maxLength !== undefined && value.length > maxLength) {
    issues.push({
      code: "INVALID_VALUE",
      path,
      message: `Expected at most ${maxLength} diagnostics.`
    });
  }
  validateDenseArray(value, path, issues);
  value.forEach((diagnostic, index) => {
    validateCadExactResultDiagnostic(diagnostic, `${path}[${index}]`, issues);
    if (isUnknownRecord(diagnostic) && diagnostic.status !== status) {
      issues.push({
        code: "INVALID_VALUE",
        path: `${path}[${index}].status`,
        message: "Diagnostic status must match its exact result."
      });
    }
  });
}

function validateCadExactDownstreamReadinessArray(
  value: unknown,
  path: string,
  outerStatus: unknown,
  issues: SketchProfilePathValidationIssue[]
): void {
  if (!Array.isArray(value)) {
    issues.push({
      code: "INVALID_TYPE",
      path,
      message: "Expected a downstream readiness array."
    });
    return;
  }
  if (value.length !== CAD_EXACT_DOWNSTREAM_OPERATIONS.length) {
    issues.push({
      code: "COUNT_MISMATCH",
      path,
      message: "Expected all four downstream operation decisions."
    });
  }
  validateDenseArray(value, path, issues);
  value.forEach((entry, index) => {
    validateCadExactDownstreamReadinessEvidence(
      entry,
      `${path}[${index}]`,
      issues
    );
    if (
      outerStatus !== "ready" &&
      isUnknownRecord(entry) &&
      entry.status === "ready"
    ) {
      issues.push({
        code: "INVALID_VALUE",
        path: `${path}[${index}].status`,
        message:
          "A non-ready exact result cannot have ready downstream evidence."
      });
    }
  });
  const operations = value
    .map((entry) => (isUnknownRecord(entry) ? entry.operation : undefined))
    .filter((operation): operation is string => typeof operation === "string");
  if (new Set(operations).size !== operations.length) {
    issues.push({
      code: "INVALID_VALUE",
      path,
      message: "Downstream operations must be unique."
    });
  }
}

function validateCadCurrentExactResultValue(
  value: unknown,
  path: string,
  issues: SketchProfilePathValidationIssue[]
): value is UnknownRecord {
  if (!isUnknownRecord(value)) {
    issues.push({ code: "INVALID_TYPE", path, message: "Expected an object." });
    return false;
  }
  const ready = value.status === "ready";
  if (
    !validateExactRecord(
      value,
      path,
      ready
        ? [
            "status",
            "bodyId",
            "sourceType",
            "sourceIdentitySignature",
            "diagnostics"
          ]
        : ["status", "bodyId", "sourceType", "diagnostics"],
      ready
        ? ["artifactEvidence", "downstreamReadiness"]
        : ["downstreamReadiness"],
      issues
    )
  ) {
    return false;
  }
  validateEnum(
    value.status,
    CAD_CURRENT_EXACT_RESULT_STATUSES,
    `${path}.status`,
    issues
  );
  validateNonEmptyString(value.bodyId, `${path}.bodyId`, issues);
  validateEnum(
    value.sourceType,
    CAD_BODY_SOURCE_TYPES,
    `${path}.sourceType`,
    issues
  );
  if (ready) {
    validateNonEmptyString(
      value.sourceIdentitySignature,
      `${path}.sourceIdentitySignature`,
      issues
    );
    if ("artifactEvidence" in value) {
      const artifact = value.artifactEvidence;
      if (
        validateCadExactArtifactEvidence(
          artifact,
          `${path}.artifactEvidence`,
          issues
        )
      ) {
        if (artifact.bodyId !== value.bodyId) {
          issues.push({
            code: "INVALID_VALUE",
            path: `${path}.artifactEvidence.bodyId`,
            message: "Artifact evidence must identify the result body."
          });
        }
        if (artifact.sourceType !== value.sourceType) {
          issues.push({
            code: "INVALID_VALUE",
            path: `${path}.artifactEvidence.sourceType`,
            message: "Artifact evidence must identify the result source type."
          });
        }
        if (
          artifact.bodySourceIdentitySignature !== value.sourceIdentitySignature
        ) {
          issues.push({
            code: "INVALID_VALUE",
            path: `${path}.artifactEvidence.bodySourceIdentitySignature`,
            message: "Artifact evidence must match the result source identity."
          });
        }
      }
    }
  }
  if ("downstreamReadiness" in value) {
    validateCadExactDownstreamReadinessArray(
      value.downstreamReadiness,
      `${path}.downstreamReadiness`,
      value.status,
      issues
    );
    if (Array.isArray(value.downstreamReadiness)) {
      value.downstreamReadiness.forEach((entry, index) => {
        if (!isUnknownRecord(entry)) return;
        if (
          ready &&
          isUnknownRecord(value.artifactEvidence) &&
          typeof value.artifactEvidence.shapePolicy === "string" &&
          typeof entry.shapePolicy === "string" &&
          entry.shapePolicy !== value.artifactEvidence.shapePolicy
        ) {
          issues.push({
            code: "INVALID_VALUE",
            path: `${path}.downstreamReadiness[${index}].shapePolicy`,
            message: "Downstream and artifact shape policies must match."
          });
        }
      });
    }
  }
  validateCadExactResultDiagnostics(
    value.diagnostics,
    `${path}.diagnostics`,
    value.status,
    issues
  );
  return true;
}

function validateCadExactExportPlanBody(
  value: unknown,
  path: string,
  issues: SketchProfilePathValidationIssue[]
): value is UnknownRecord {
  if (
    !validateExactRecord(
      value,
      path,
      [
        "bodyId",
        "bodyName",
        "partId",
        "featureId",
        "sourceType",
        "sourceIdentitySignature",
        "status",
        "diagnostics"
      ],
      [],
      issues
    )
  ) {
    return false;
  }
  for (const field of [
    "bodyId",
    "bodyName",
    "partId",
    "featureId",
    "sourceIdentitySignature"
  ] as const) {
    validateNonEmptyString(value[field], `${path}.${field}`, issues);
  }
  if (
    typeof value.bodyName === "string" &&
    value.bodyName.trim() !== value.bodyName
  ) {
    issues.push({
      code: "INVALID_VALUE",
      path: `${path}.bodyName`,
      message: "Export plan body names must already be trimmed."
    });
  }
  validateEnum(
    value.sourceType,
    CAD_BODY_SOURCE_TYPES,
    `${path}.sourceType`,
    issues
  );
  validateEnum(value.status, ["ready", "blocked"], `${path}.status`, issues);
  if (!Array.isArray(value.diagnostics)) {
    issues.push({
      code: "INVALID_TYPE",
      path: `${path}.diagnostics`,
      message: "Expected a diagnostic array."
    });
  } else {
    value.diagnostics.forEach((diagnostic, index) =>
      validateCadExportDiagnosticEvidence(
        diagnostic,
        `${path}.diagnostics[${index}]`,
        issues
      )
    );
  }
  return true;
}

export type CadExactExportValidationIssue = SketchProfilePathValidationIssue;
export type CadExactExportValidationResult<T> =
  SketchProfilePathValidationResult<T>;

export function validateFeatureUpdateHoleOp(
  value: unknown
): CadExactExportValidationResult<FeatureUpdateHoleOp> {
  const issues: SketchProfilePathValidationIssue[] = [];
  if (
    validateExactRecord(
      value,
      "$",
      ["op", "id"],
      [
        "depthMode",
        "depth",
        "direction",
        "targetBodyId",
        "targetTopologyAnchorId"
      ],
      issues
    )
  ) {
    validateEnum(value.op, ["feature.updateHole"], "$.op", issues);
    validateNonEmptyString(value.id, "$.id", issues);
    if ("depthMode" in value) {
      validateEnum(
        value.depthMode,
        ["blind", "throughAll"],
        "$.depthMode",
        issues
      );
    }
    if ("depth" in value)
      validatePositiveNumber(value.depth, "$.depth", issues);
    if ("direction" in value) {
      validateEnum(
        value.direction,
        ["positive", "negative"],
        "$.direction",
        issues
      );
    }
    const hasBody = "targetBodyId" in value;
    const hasAnchor = "targetTopologyAnchorId" in value;
    if (hasBody && hasAnchor) {
      issues.push({
        code: "COMMAND_INPUT_AMBIGUOUS",
        path: "$",
        message:
          "A hole update may target a body or topology anchor, never both."
      });
    }
    if (hasBody)
      validateNonEmptyString(value.targetBodyId, "$.targetBodyId", issues);
    if (hasAnchor) {
      validateNonEmptyString(
        value.targetTopologyAnchorId,
        "$.targetTopologyAnchorId",
        issues
      );
    }
    if (
      ![
        "depthMode",
        "depth",
        "direction",
        "targetBodyId",
        "targetTopologyAnchorId"
      ].some((field) => field in value)
    ) {
      issues.push({
        code: "MISSING_FIELD",
        path: "$",
        message: "A hole update requires at least one editable field."
      });
    }
  }
  return issues.length === 0
    ? { ok: true, value: value as FeatureUpdateHoleOp }
    : { ok: false, issues };
}

export function validateCadExportDiagnostics(
  value: unknown
): CadExactExportValidationResult<readonly CadExportDiagnostic[]> {
  const issues: SketchProfilePathValidationIssue[] = [];
  if (!Array.isArray(value)) {
    issues.push({
      code: "INVALID_TYPE",
      path: "$",
      message: "Expected an export diagnostic array."
    });
  } else {
    validateDenseArray(value, "$", issues);
    if (value.length > CAD_V21_EXACT_EXPORT_RESOURCE_LIMITS.maxSelectedBodies) {
      issues.push({
        code: "INVALID_VALUE",
        path: "$",
        message: `Expected at most ${CAD_V21_EXACT_EXPORT_RESOURCE_LIMITS.maxSelectedBodies} diagnostics.`
      });
    }
    value.forEach((diagnostic, index) =>
      validateCadExportDiagnosticEvidence(diagnostic, `$[${index}]`, issues)
    );
  }
  return issues.length === 0
    ? { ok: true, value: value as readonly CadExportDiagnostic[] }
    : { ok: false, issues };
}

function validateCadExactReadySubsetBody(
  value: unknown,
  path: string,
  excluded: boolean,
  issues: SketchProfilePathValidationIssue[]
): void {
  if (
    !validateExactRecord(
      value,
      path,
      ["bodyId", "bodyName", "diagnostics"],
      [],
      issues
    )
  ) {
    return;
  }
  validateNonEmptyString(value.bodyId, `${path}.bodyId`, issues);
  validateNonEmptyString(value.bodyName, `${path}.bodyName`, issues);
  if (
    typeof value.bodyName === "string" &&
    value.bodyName.trim() !== value.bodyName
  ) {
    issues.push({
      code: "INVALID_VALUE",
      path: `${path}.bodyName`,
      message: "Ready-subset body names must already be trimmed."
    });
  }
  if (!Array.isArray(value.diagnostics)) {
    issues.push({
      code: "INVALID_TYPE",
      path: `${path}.diagnostics`,
      message: "Expected a diagnostic array."
    });
  } else {
    validateDenseArray(value.diagnostics, `${path}.diagnostics`, issues);
    if (
      value.diagnostics.length >
      CAD_V21_EXACT_EXPORT_RESOURCE_LIMITS.maxSelectedBodies
    ) {
      issues.push({
        code: "INVALID_VALUE",
        path: `${path}.diagnostics`,
        message: `Expected at most ${CAD_V21_EXACT_EXPORT_RESOURCE_LIMITS.maxSelectedBodies} diagnostics.`
      });
    }
    if (excluded && value.diagnostics.length === 0) {
      issues.push({
        code: "MISSING_FIELD",
        path: `${path}.diagnostics`,
        message: "An excluded body requires its root blocker."
      });
    }
    value.diagnostics.forEach((diagnostic, index) =>
      validateCadExportDiagnosticEvidence(
        diagnostic,
        `${path}.diagnostics[${index}]`,
        issues
      )
    );
    const blockedDiagnostic = value.diagnostics.find(
      (diagnostic) =>
        isUnknownRecord(diagnostic) &&
        (diagnostic.status === "deferred" ||
          diagnostic.status === "unavailable")
    );
    if (excluded && blockedDiagnostic === undefined) {
      issues.push({
        code: "INVALID_VALUE",
        path: `${path}.diagnostics`,
        message: "An excluded body requires a deferred or unavailable blocker."
      });
    }
    if (!excluded && blockedDiagnostic !== undefined) {
      issues.push({
        code: "INVALID_VALUE",
        path: `${path}.diagnostics`,
        message:
          "An included body cannot carry a deferred or unavailable blocker."
      });
    }
  }
}

export function validateCadExactReadySubsetMetadata(
  value: unknown
): CadExactExportValidationResult<CadExactReadySubsetMetadata> {
  const issues: SketchProfilePathValidationIssue[] = [];
  if (
    validateExactRecord(
      value,
      "$",
      ["orderedBodyIds", "includedBodies", "excludedBodies", "allOrNothing"],
      [],
      issues
    )
  ) {
    validateUniqueIdArray(value.orderedBodyIds, "$.orderedBodyIds", issues, {
      maxLength: CAD_V21_EXACT_EXPORT_RESOURCE_LIMITS.maxSelectedBodies
    });
    if (Array.isArray(value.orderedBodyIds)) {
      validateDenseArray(value.orderedBodyIds, "$.orderedBodyIds", issues);
    }
    if (value.allOrNothing !== true) {
      issues.push({
        code: "INVALID_VALUE",
        path: "$.allOrNothing",
        message: "Ready-subset export remains all-or-nothing."
      });
    }
    for (const [field, excluded] of [
      ["includedBodies", false],
      ["excludedBodies", true]
    ] as const) {
      const bodies = value[field];
      if (!Array.isArray(bodies)) {
        issues.push({
          code: "INVALID_TYPE",
          path: `$.${field}`,
          message: "Expected a body array."
        });
      } else {
        validateDenseArray(bodies, `$.${field}`, issues);
        if (bodies.length === 0) {
          issues.push({
            code: "INVALID_VALUE",
            path: `$.${field}`,
            message: "Ready-subset review requires ready and excluded bodies."
          });
        }
        bodies.forEach((body, index) =>
          validateCadExactReadySubsetBody(
            body,
            `$.${field}[${index}]`,
            excluded,
            issues
          )
        );
      }
    }
    if (Array.isArray(value.includedBodies)) {
      if (
        Array.isArray(value.orderedBodyIds) &&
        value.includedBodies.length !== value.orderedBodyIds.length
      ) {
        issues.push({
          code: "COUNT_MISMATCH",
          path: "$.includedBodies",
          message: "Included bodies must match the ordered body IDs."
        });
      }
      value.includedBodies.forEach((body, index) => {
        if (
          isUnknownRecord(body) &&
          Array.isArray(value.orderedBodyIds) &&
          body.bodyId !== value.orderedBodyIds[index]
        ) {
          issues.push({
            code: "INVALID_VALUE",
            path: `$.includedBodies[${index}].bodyId`,
            message: "Included body order must match orderedBodyIds."
          });
        }
      });
    }
    const allBodies = [
      ...(Array.isArray(value.includedBodies) ? value.includedBodies : []),
      ...(Array.isArray(value.excludedBodies) ? value.excludedBodies : [])
    ];
    if (
      allBodies.length > CAD_V21_EXACT_EXPORT_RESOURCE_LIMITS.maxSelectedBodies
    ) {
      issues.push({
        code: "INVALID_VALUE",
        path: "$",
        message: `Expected at most ${CAD_V21_EXACT_EXPORT_RESOURCE_LIMITS.maxSelectedBodies} reviewed bodies.`
      });
    }
    const bodyIds = allBodies
      .map((body) => (isUnknownRecord(body) ? body.bodyId : undefined))
      .filter((bodyId): bodyId is string => typeof bodyId === "string");
    if (new Set(bodyIds).size !== bodyIds.length) {
      issues.push({
        code: "INVALID_VALUE",
        path: "$",
        message: "Ready-subset body IDs must be unique."
      });
    }
  }
  return issues.length === 0
    ? { ok: true, value: value as CadExactReadySubsetMetadata }
    : { ok: false, issues };
}

export function validateProjectPortabilityStatus(
  value: unknown
): CadExactExportValidationResult<ProjectPortabilityStatus> {
  const issues: SketchProfilePathValidationIssue[] = [];
  if (!isUnknownRecord(value)) {
    issues.push({
      code: "INVALID_TYPE",
      path: "$",
      message: "Expected an object."
    });
  } else if (value.status === "portable-json") {
    validateExactRecord(value, "$", ["status"], [], issues);
  } else {
    if (
      validateExactRecord(value, "$", ["status", "checkpointIds"], [], issues)
    ) {
      validateEnum(
        value.status,
        ["wcad-required", "payload-missing"],
        "$.status",
        issues
      );
      validateUniqueIdArray(value.checkpointIds, "$.checkpointIds", issues, {
        maxLength: CAD_V21_EXACT_EXPORT_RESOURCE_LIMITS.maxSourceGraphNodes
      });
      if (Array.isArray(value.checkpointIds)) {
        validateDenseArray(value.checkpointIds, "$.checkpointIds", issues);
      }
      if (
        Array.isArray(value.checkpointIds) &&
        value.checkpointIds.length === 0
      ) {
        issues.push({
          code: "INVALID_VALUE",
          path: "$.checkpointIds",
          message: "A checkpoint portability status requires checkpoint IDs."
        });
      }
    }
  }
  return issues.length === 0
    ? { ok: true, value: value as ProjectPortabilityStatus }
    : { ok: false, issues };
}

export function validateProjectCheckpointPayloadRecoveryResult(
  value: unknown
): CadExactExportValidationResult<ProjectCheckpointPayloadRecoveryResult> {
  const issues: SketchProfilePathValidationIssue[] = [];
  if (
    validateExactRecord(
      value,
      "$",
      [
        "status",
        "projectSourceIdentity",
        "requestedCheckpointIds",
        "recoveredCheckpointIds",
        "diagnostics"
      ],
      [],
      issues
    )
  ) {
    validateEnum(value.status, ["recovered", "rejected"], "$.status", issues);
    validateWcadSourceIdentityEvidence(
      value.projectSourceIdentity,
      "$.projectSourceIdentity",
      issues
    );
    for (const field of [
      "requestedCheckpointIds",
      "recoveredCheckpointIds"
    ] as const) {
      validateUniqueIdArray(value[field], `$.${field}`, issues, {
        maxLength: CAD_V21_EXACT_EXPORT_RESOURCE_LIMITS.maxSourceGraphNodes
      });
      if (Array.isArray(value[field])) {
        validateDenseArray(value[field], `$.${field}`, issues);
      }
    }
    const requested = Array.isArray(value.requestedCheckpointIds)
      ? value.requestedCheckpointIds
      : [];
    const recovered = Array.isArray(value.recoveredCheckpointIds)
      ? value.recoveredCheckpointIds
      : [];
    if (requested.length === 0) {
      issues.push({
        code: "INVALID_VALUE",
        path: "$.requestedCheckpointIds",
        message: "Recovery requires at least one checkpoint ID."
      });
    }
    if (value.status === "recovered") {
      if (
        recovered.length !== requested.length ||
        recovered.some(
          (checkpointId, index) => checkpointId !== requested[index]
        )
      ) {
        issues.push({
          code: "INVALID_VALUE",
          path: "$.recoveredCheckpointIds",
          message:
            "Atomic recovery must preserve every requested checkpoint in order."
        });
      }
    } else if (recovered.length !== 0) {
      issues.push({
        code: "INVALID_VALUE",
        path: "$.recoveredCheckpointIds",
        message: "Rejected recovery cannot import a partial payload set."
      });
    }
    if (!Array.isArray(value.diagnostics)) {
      issues.push({
        code: "INVALID_TYPE",
        path: "$.diagnostics",
        message: "Expected a recovery diagnostic array."
      });
    } else {
      validateDenseArray(value.diagnostics, "$.diagnostics", issues);
      if (
        (value.status === "recovered" && value.diagnostics.length !== 0) ||
        (value.status === "rejected" && value.diagnostics.length === 0)
      ) {
        issues.push({
          code: "INVALID_VALUE",
          path: "$.diagnostics",
          message: "Recovery diagnostics must match the terminal status."
        });
      }
      if (value.diagnostics.length > requested.length) {
        issues.push({
          code: "INVALID_VALUE",
          path: "$.diagnostics",
          message: "Recovery diagnostics cannot exceed requested checkpoints."
        });
      }
      value.diagnostics.forEach((diagnostic, index) => {
        const path = `$.diagnostics[${index}]`;
        if (
          !validateExactRecord(
            diagnostic,
            path,
            ["code", "checkpointId", "message"],
            ["expected", "received"],
            issues
          )
        ) {
          return;
        }
        validateEnum(
          diagnostic.code,
          ["CHECKPOINT_PAYLOAD_RECOVERY_MISMATCH"],
          `${path}.code`,
          issues
        );
        for (const field of [
          "checkpointId",
          "message",
          "expected",
          "received"
        ] as const) {
          if (field in diagnostic) {
            validateNonEmptyString(
              diagnostic[field],
              `${path}.${field}`,
              issues
            );
          }
        }
        if (
          typeof diagnostic.checkpointId === "string" &&
          !requested.includes(diagnostic.checkpointId)
        ) {
          issues.push({
            code: "INVALID_VALUE",
            path: `${path}.checkpointId`,
            message:
              "Recovery diagnostics must identify a requested checkpoint."
          });
        }
      });
    }
  }
  return issues.length === 0
    ? { ok: true, value: value as ProjectCheckpointPayloadRecoveryResult }
    : { ok: false, issues };
}

export function validateCadExactArtifactCacheSummary(
  value: unknown
): CadExactExportValidationResult<CadExactArtifactCacheSummary> {
  const issues: SketchProfilePathValidationIssue[] = [];
  if (
    validateExactRecord(
      value,
      "$",
      ["status", "entryCount", "retainedByteLength"],
      [],
      issues
    )
  ) {
    validateEnum(
      value.status,
      ["ready", "degraded", "unavailable"],
      "$.status",
      issues
    );
    validateNonNegativeInteger(value.entryCount, "$.entryCount", issues);
    validateBoundedCount(
      value.retainedByteLength,
      "$.retainedByteLength",
      CAD_V21_1_EXACT_CACHE_RESOURCE_LIMITS.maxRetainedBytes,
      issues
    );
    if (
      value.status === "unavailable" &&
      (value.entryCount !== 0 || value.retainedByteLength !== 0)
    ) {
      issues.push({
        code: "INVALID_VALUE",
        path: "$",
        message: "An unavailable exact cache cannot report retained entries."
      });
    }
  }
  return issues.length === 0
    ? { ok: true, value: value as CadExactArtifactCacheSummary }
    : { ok: false, issues };
}

export function validateCadExactExportPlan(
  value: unknown
): CadExactExportValidationResult<CadExactExportPlan> {
  const issues: SketchProfilePathValidationIssue[] = [];
  if (
    validateExactRecord(
      value,
      "$",
      [
        "format",
        "schema",
        "units",
        "sourceIdentity",
        "orderedBodyIds",
        "allOrNothing",
        "planIdentity",
        "bodies"
      ],
      [],
      issues
    )
  ) {
    validateEnum(value.format, ["step"], "$.format", issues);
    validateEnum(value.schema, ["AP242DIS"], "$.schema", issues);
    validateEnum(value.units, ["mm", "cm", "m", "in"], "$.units", issues);
    validateWcadSourceIdentityEvidence(
      value.sourceIdentity,
      "$.sourceIdentity",
      issues
    );
    validateUniqueIdArray(value.orderedBodyIds, "$.orderedBodyIds", issues, {
      maxLength: CAD_V21_EXACT_EXPORT_RESOURCE_LIMITS.maxSelectedBodies
    });
    if (value.allOrNothing !== true) {
      issues.push({
        code: "INVALID_VALUE",
        path: "$.allOrNothing",
        message: "Exact export plans are all-or-nothing."
      });
    }
    if (
      typeof value.planIdentity !== "string" ||
      !/^[0-9a-f]{64}$/.test(value.planIdentity)
    ) {
      issues.push({
        code: "INVALID_VALUE",
        path: "$.planIdentity",
        message: "Expected a lowercase SHA-256 plan identity."
      });
    }
    if (!Array.isArray(value.bodies)) {
      issues.push({
        code: "INVALID_TYPE",
        path: "$.bodies",
        message: "Expected an export plan body array."
      });
    } else {
      if (
        value.bodies.length >
        CAD_V21_EXACT_EXPORT_RESOURCE_LIMITS.maxSelectedBodies
      ) {
        issues.push({
          code: "INVALID_VALUE",
          path: "$.bodies",
          message: `Expected at most ${CAD_V21_EXACT_EXPORT_RESOURCE_LIMITS.maxSelectedBodies} bodies.`
        });
      }
      value.bodies.forEach((body, index) =>
        validateCadExactExportPlanBody(body, `$.bodies[${index}]`, issues)
      );
      if (
        Array.isArray(value.orderedBodyIds) &&
        value.bodies.length !== value.orderedBodyIds.length
      ) {
        issues.push({
          code: "COUNT_MISMATCH",
          path: "$.bodies",
          message: "Plan bodies must match the ordered body selection."
        });
      }
      const orderedBodyIds = value.orderedBodyIds;
      if (Array.isArray(orderedBodyIds)) {
        value.bodies.forEach((body, index) => {
          if (isUnknownRecord(body) && body.bodyId !== orderedBodyIds[index]) {
            issues.push({
              code: "INVALID_VALUE",
              path: `$.bodies[${index}].bodyId`,
              message: "Plan body order must match orderedBodyIds."
            });
          }
        });
      }
    }
  }
  return issues.length === 0
    ? { ok: true, value: value as CadExactExportPlan }
    : { ok: false, issues };
}

export function validateCadCurrentExactResults(
  value: unknown
): CadExactExportValidationResult<readonly CadCurrentExactResult[]> {
  const issues: SketchProfilePathValidationIssue[] = [];
  if (!Array.isArray(value)) {
    issues.push({
      code: "INVALID_TYPE",
      path: "$",
      message: "Expected a current exact result array."
    });
  } else {
    validateDenseArray(value, "$", issues);
    if (value.length > CAD_V21_EXACT_EXPORT_RESOURCE_LIMITS.maxSelectedBodies) {
      issues.push({
        code: "INVALID_VALUE",
        path: "$",
        message: `Expected at most ${CAD_V21_EXACT_EXPORT_RESOURCE_LIMITS.maxSelectedBodies} current exact results.`
      });
    }
    value.forEach((result, index) =>
      validateCadCurrentExactResultValue(result, `$[${index}]`, issues)
    );
    const bodyIds = value
      .map((result) => (isUnknownRecord(result) ? result.bodyId : undefined))
      .filter((bodyId): bodyId is string => typeof bodyId === "string");
    if (new Set(bodyIds).size !== bodyIds.length) {
      issues.push({
        code: "INVALID_VALUE",
        path: "$",
        message: "Duplicate exact-result body IDs are not allowed."
      });
    }
    const artifacts = value
      .map((result) =>
        isUnknownRecord(result) && isUnknownRecord(result.artifactEvidence)
          ? result.artifactEvidence
          : undefined
      )
      .filter((artifact): artifact is UnknownRecord => artifact !== undefined);
    const sourceGraphNodeCount = artifacts.reduce(
      (total, artifact) =>
        total +
        (typeof artifact.sourceGraphNodeCount === "number"
          ? artifact.sourceGraphNodeCount
          : 0),
      0
    );
    const brepByteLength = artifacts.reduce(
      (total, artifact) =>
        total +
        (typeof artifact.brepByteLength === "number"
          ? artifact.brepByteLength
          : 0),
      0
    );
    if (
      !Number.isSafeInteger(sourceGraphNodeCount) ||
      sourceGraphNodeCount >
        CAD_V21_EXACT_EXPORT_RESOURCE_LIMITS.maxSourceGraphNodes
    ) {
      issues.push({
        code: "INVALID_VALUE",
        path: "$",
        message: "Exact source graph node count exceeds the export limit."
      });
    }
    if (
      !Number.isSafeInteger(brepByteLength) ||
      brepByteLength >
        CAD_V21_EXACT_EXPORT_RESOURCE_LIMITS.maxAggregateBrepArtifactBytes
    ) {
      issues.push({
        code: "INVALID_VALUE",
        path: "$",
        message: "Aggregate B-rep evidence exceeds the export limit."
      });
    }
  }
  return issues.length === 0
    ? { ok: true, value: value as readonly CadCurrentExactResult[] }
    : { ok: false, issues };
}

export function validateCadExactExportQueryEvidence(
  value: unknown
): CadExactExportValidationResult<CadExactExportQueryEvidence> {
  const issues: SketchProfilePathValidationIssue[] = [];
  if (
    validateExactRecord(
      value,
      "$",
      [],
      ["plan", "currentExactResults", "readySubset"],
      issues
    )
  ) {
    if ("plan" in value) {
      const planResult = validateCadExactExportPlan(value.plan);
      if (!planResult.ok) issues.push(...planResult.issues);
    }
    if ("currentExactResults" in value) {
      const exactResults = validateCadCurrentExactResults(
        value.currentExactResults
      );
      if (!exactResults.ok) issues.push(...exactResults.issues);
    }
    if ("readySubset" in value) {
      const readySubset = validateCadExactReadySubsetMetadata(
        value.readySubset
      );
      if (!readySubset.ok) issues.push(...readySubset.issues);
    }
  }
  return issues.length === 0
    ? { ok: true, value: value as CadExactExportQueryEvidence }
    : { ok: false, issues };
}

export function validateProjectExactExportQuery(
  value: unknown
): CadExactExportValidationResult<ProjectExactExportQuery> {
  const issues: SketchProfilePathValidationIssue[] = [];
  if (
    validateExactRecord(
      value,
      "$",
      ["query", "format"],
      [
        "bodyIds",
        "sourceIdentity",
        "derivedExactMetadata",
        "currentExactResults"
      ],
      issues
    )
  ) {
    validateEnum(value.query, ["project.exportExact"], "$.query", issues);
    validateEnum(value.format, ["step"], "$.format", issues);
    if ("bodyIds" in value) {
      validateUniqueIdArray(value.bodyIds, "$.bodyIds", issues, {
        maxLength: CAD_V21_EXACT_EXPORT_RESOURCE_LIMITS.maxSelectedBodies
      });
    }
    if ("sourceIdentity" in value) {
      validateWcadSourceIdentityEvidence(
        value.sourceIdentity,
        "$.sourceIdentity",
        issues
      );
    }
    if (
      "derivedExactMetadata" in value &&
      !Array.isArray(value.derivedExactMetadata)
    ) {
      issues.push({
        code: "INVALID_TYPE",
        path: "$.derivedExactMetadata",
        message: "Expected a derived exact metadata array."
      });
    }
    if ("currentExactResults" in value) {
      const exactResults = validateCadCurrentExactResults(
        value.currentExactResults
      );
      if (!exactResults.ok) issues.push(...exactResults.issues);
    }
  }
  return issues.length === 0
    ? { ok: true, value: value as ProjectExactExportQuery }
    : { ok: false, issues };
}

function pointTargetV22Key(value: unknown): string | undefined {
  if (!isUnknownRecord(value)) return undefined;
  if (
    typeof value.entityId !== "string" ||
    typeof value.entityKind !== "string" ||
    typeof value.role !== "string"
  ) {
    return undefined;
  }
  return `${value.entityKind}\u0000${value.entityId}\u0000${value.role}`;
}

function validateCurveConstraintTarget(
  value: unknown,
  path: string,
  issues: SketchProfilePathValidationIssue[]
): value is UnknownRecord {
  if (
    !validateExactRecord(value, path, ["entityId", "entityKind"], [], issues)
  ) {
    return false;
  }
  validateNonEmptyString(value.entityId, `${path}.entityId`, issues);
  validateEnum(
    value.entityKind,
    ["line", "circle", "arc"],
    `${path}.entityKind`,
    issues
  );
  return true;
}

function validateRadiusCurveTarget(
  value: unknown,
  path: string,
  issues: SketchProfilePathValidationIssue[]
): value is UnknownRecord {
  if (!validateCurveConstraintTarget(value, path, issues)) return false;
  if (value.entityKind !== "circle" && value.entityKind !== "arc") {
    issues.push({
      code: "INVALID_VALUE",
      path: `${path}.entityKind`,
      message: "Expected a circle or arc target."
    });
    return false;
  }
  return true;
}

function validatePointTargetV22(
  value: unknown,
  path: string,
  issues: SketchProfilePathValidationIssue[]
): void {
  if (
    !validateExactRecord(
      value,
      path,
      ["entityId", "entityKind", "role"],
      [],
      issues
    )
  )
    return;
  validateNonEmptyString(value.entityId, `${path}.entityId`, issues);
  const valid =
    (value.entityKind === "point" && value.role === "position") ||
    (value.entityKind === "line" &&
      (value.role === "start" || value.role === "end")) ||
    ((value.entityKind === "rectangle" || value.entityKind === "circle") &&
      value.role === "center") ||
    (value.entityKind === "arc" &&
      (value.role === "center" ||
        value.role === "start" ||
        value.role === "end"));
  if (!valid) {
    issues.push({
      code: "INVALID_VALUE",
      path,
      message: "The point target role does not match its entity kind."
    });
  }
}

export function isSketchPointTargetV22(
  value: unknown
): value is SketchPointTargetV22 {
  const issues: SketchProfilePathValidationIssue[] = [];
  validatePointTargetV22(value, "$", issues);
  return issues.length === 0;
}

function validateDimensionTargetV22(
  value: unknown,
  path: string,
  issues: SketchProfilePathValidationIssue[]
): void {
  if (!isUnknownRecord(value)) {
    issues.push({
      code: "INVALID_TYPE",
      path,
      message: "Expected a normalized V22 dimension target."
    });
    return;
  }
  switch (value.kind) {
    case "entityScalar": {
      if (
        !validateExactRecord(
          value,
          path,
          ["kind", "entityId", "entityKind", "role"],
          [],
          issues
        )
      )
        return;
      validateNonEmptyString(value.entityId, `${path}.entityId`, issues);
      const valid =
        (value.entityKind === "rectangle" &&
          (value.role === "width" || value.role === "height")) ||
        (value.entityKind === "line" && value.role === "length") ||
        (value.entityKind === "circle" &&
          (value.role === "radius" || value.role === "diameter")) ||
        (value.entityKind === "arc" &&
          (value.role === "radius" ||
            value.role === "diameter" ||
            value.role === "sweep"));
      if (!valid) {
        issues.push({
          code: "INVALID_VALUE",
          path,
          message: "The scalar target role does not match its entity kind."
        });
      }
      break;
    }
    case "pointPair": {
      const directed =
        value.measurement === "horizontal" || value.measurement === "vertical";
      if (
        !validateExactRecord(
          value,
          path,
          ["kind", "primary", "secondary", "measurement"],
          directed ? ["direction"] : [],
          issues
        )
      )
        return;
      validatePointTargetV22(value.primary, `${path}.primary`, issues);
      validatePointTargetV22(value.secondary, `${path}.secondary`, issues);
      if (
        pointTargetV22Key(value.primary) !== undefined &&
        pointTargetV22Key(value.primary) === pointTargetV22Key(value.secondary)
      ) {
        issues.push({
          code: "INVALID_VALUE",
          path,
          message: "A point-pair dimension requires two distinct targets."
        });
      }
      if (
        value.measurement !== "distance" &&
        value.measurement !== "horizontal" &&
        value.measurement !== "vertical"
      ) {
        issues.push({
          code: "INVALID_VALUE",
          path: `${path}.measurement`,
          message: "Invalid point-pair measurement."
        });
      }
      if (
        directed &&
        value.direction !== "positive" &&
        value.direction !== "negative"
      ) {
        issues.push({
          code: "INVALID_VALUE",
          path: `${path}.direction`,
          message: "Directed point-pair dimensions require a direction."
        });
      }
      if (value.measurement === "distance" && "direction" in value) {
        issues.push({
          code: "UNKNOWN_FIELD",
          path: `${path}.direction`,
          message: "Euclidean distance does not carry a direction."
        });
      }
      break;
    }
    case "pointLineDistance":
      if (
        !validateExactRecord(
          value,
          path,
          ["kind", "point", "lineEntityId", "side"],
          [],
          issues
        )
      )
        return;
      validatePointTargetV22(value.point, `${path}.point`, issues);
      validateNonEmptyString(
        value.lineEntityId,
        `${path}.lineEntityId`,
        issues
      );
      if (
        isUnknownRecord(value.point) &&
        value.point.entityKind === "line" &&
        value.point.entityId === value.lineEntityId
      ) {
        issues.push({
          code: "INVALID_VALUE",
          path,
          message:
            "A line endpoint cannot be measured to the support of its owning line."
        });
      }
      validateEnum(value.side, ["left", "right"], `${path}.side`, issues);
      break;
    case "lineAngle":
      if (
        !validateExactRecord(
          value,
          path,
          ["kind", "primaryLineEntityId", "secondaryLineEntityId", "sense"],
          [],
          issues
        )
      )
        return;
      validateNonEmptyString(
        value.primaryLineEntityId,
        `${path}.primaryLineEntityId`,
        issues
      );
      validateNonEmptyString(
        value.secondaryLineEntityId,
        `${path}.secondaryLineEntityId`,
        issues
      );
      if (
        typeof value.primaryLineEntityId === "string" &&
        value.primaryLineEntityId === value.secondaryLineEntityId
      ) {
        issues.push({
          code: "INVALID_VALUE",
          path,
          message: "A line-angle dimension requires two distinct lines."
        });
      }
      validateEnum(
        value.sense,
        ["clockwise", "counterclockwise"],
        `${path}.sense`,
        issues
      );
      break;
    default:
      issues.push({
        code: "INVALID_VALUE",
        path: `${path}.kind`,
        message: "Unknown normalized V22 dimension target kind."
      });
  }
}

export function isSketchDimensionTargetV22(
  value: unknown
): value is SketchDimensionTargetV22 {
  const issues: SketchProfilePathValidationIssue[] = [];
  validateDimensionTargetV22(value, "$", issues);
  return issues.length === 0;
}

export function isSketchRegionsProfileRef(
  value: unknown
): value is SketchRegionsProfileRef {
  const issues: SketchProfilePathValidationIssue[] = [];
  if (
    !validateExactRecord(
      value,
      "$",
      ["kind", "sketchId", "regions"],
      [],
      issues
    )
  ) {
    return false;
  }
  if (value.kind !== "regions") {
    issues.push({
      code: "INVALID_VALUE",
      path: "$.kind",
      message: "Expected a regions profile."
    });
  }
  validateNonEmptyString(value.sketchId, "$.sketchId", issues);
  validateRegions(value.regions, "$.regions", issues);
  return issues.length === 0;
}

function validateCurveEditPrecondition(
  value: unknown,
  path: string,
  issues: SketchProfilePathValidationIssue[]
): void {
  if (
    !validateExactRecord(
      value,
      path,
      ["expectedSourceRevision", "expectedSolverEvaluationIdentity"],
      [],
      issues
    )
  )
    return;
  if (
    typeof value.expectedSourceRevision !== "string" ||
    !/^partbench-source-v1:[0-9a-f]{64}$/.test(value.expectedSourceRevision)
  ) {
    issues.push({
      code: "INVALID_VALUE",
      path: `${path}.expectedSourceRevision`,
      message: "Invalid V19 source revision identity."
    });
  }
  if (
    typeof value.expectedSolverEvaluationIdentity !== "string" ||
    (value.expectedSolverEvaluationIdentity !== "none" &&
      !/^partbench-sketch-solver-evaluation-v1:[0-9a-f]{64}$/.test(
        value.expectedSolverEvaluationIdentity
      ))
  ) {
    issues.push({
      code: "INVALID_VALUE",
      path: `${path}.expectedSolverEvaluationIdentity`,
      message: "Invalid V19 solver evaluation identity."
    });
  }
}

function validateCurveEditOperation(
  value: UnknownRecord,
  path: string,
  issues: SketchProfilePathValidationIssue[]
): void {
  const commonRequired = ["op", "sketchId", "precondition", "entityId"];
  const deletionFields = ["deleteConstraintIds", "deleteDimensionIds"];
  switch (value.op) {
    case "sketch.trim":
      validateExactRecord(
        value,
        path,
        [...commonRequired, "boundaryEntityIds", "pickPoint"],
        ["createdEntityIds", ...deletionFields],
        issues
      );
      validateUniqueIdArray(
        value.boundaryEntityIds,
        `${path}.boundaryEntityIds`,
        issues,
        {
          minLength: 1,
          maxLength: CAD_V19_RESOURCE_LIMITS.maxBoundaryEntityIdsPerCurveEdit
        }
      );
      validateVec2(value.pickPoint, `${path}.pickPoint`, issues);
      break;
    case "sketch.extend":
      validateExactRecord(
        value,
        path,
        [...commonRequired, "endpoint", "boundaryEntityIds"],
        deletionFields,
        issues
      );
      validateEnum(
        value.endpoint,
        ["start", "end"],
        `${path}.endpoint`,
        issues
      );
      validateUniqueIdArray(
        value.boundaryEntityIds,
        `${path}.boundaryEntityIds`,
        issues,
        {
          minLength: 1,
          maxLength: CAD_V19_RESOURCE_LIMITS.maxBoundaryEntityIdsPerCurveEdit
        }
      );
      break;
    case "sketch.split":
      validateExactRecord(
        value,
        path,
        [...commonRequired, "splitPoints"],
        ["createdEntityIds", ...deletionFields],
        issues
      );
      if (!Array.isArray(value.splitPoints)) {
        issues.push({
          code: "INVALID_TYPE",
          path: `${path}.splitPoints`,
          message: "Expected a split-point array."
        });
      } else {
        if (value.splitPoints.length === 0) {
          issues.push({
            code: "INVALID_VALUE",
            path: `${path}.splitPoints`,
            message: "A split command requires at least one split point."
          });
        }
        if (
          value.splitPoints.length >
          CAD_V19_RESOURCE_LIMITS.maxSplitPointsPerCommand
        ) {
          issues.push({
            code: "INVALID_VALUE",
            path: `${path}.splitPoints`,
            message: "The split point limit was exceeded."
          });
        }
        for (let index = 0; index < value.splitPoints.length; index += 1) {
          if (!(index in value.splitPoints)) {
            issues.push({
              code: "INVALID_VALUE",
              path: `${path}.splitPoints[${index}]`,
              message: "Sparse arrays are not allowed."
            });
            continue;
          }
          validateVec2(
            value.splitPoints[index],
            `${path}.splitPoints[${index}]`,
            issues
          );
        }
      }
      break;
    case "sketch.explodeRectangle":
      validateExactRecord(
        value,
        path,
        commonRequired,
        ["lineEntityIds", ...deletionFields],
        issues
      );
      if ("lineEntityIds" in value) {
        validateUniqueIdArray(
          value.lineEntityIds,
          `${path}.lineEntityIds`,
          issues,
          { exactLength: 4 }
        );
      }
      break;
    default:
      return;
  }
  validateNonEmptyString(value.sketchId, `${path}.sketchId`, issues);
  validateNonEmptyString(value.entityId, `${path}.entityId`, issues);
  if (
    Array.isArray(value.boundaryEntityIds) &&
    typeof value.entityId === "string" &&
    value.boundaryEntityIds.includes(value.entityId)
  ) {
    issues.push({
      code: "INVALID_VALUE",
      path: `${path}.boundaryEntityIds`,
      message: "The edited entity cannot be its own boundary."
    });
  }
  validateCurveEditPrecondition(
    value.precondition,
    `${path}.precondition`,
    issues
  );
  for (const field of [
    "createdEntityIds",
    "deleteConstraintIds",
    "deleteDimensionIds"
  ]) {
    if (field in value) {
      if (field === "createdEntityIds") {
        validateUniqueIdArray(value[field], `${path}.${field}`, issues);
      } else {
        validateIdArray(value[field], `${path}.${field}`, issues);
      }
    }
  }
}

function validateOffsetOperation(
  value: UnknownRecord,
  path: string,
  issues: SketchProfilePathValidationIssue[]
): void {
  if (
    !validateExactRecord(
      value,
      path,
      ["op", "sketchId", "precondition", "source", "distance", "side"],
      ["referencePoint", "createdEntityIds"],
      issues
    )
  )
    return;
  validateNonEmptyString(value.sketchId, `${path}.sketchId`, issues);
  validateCurveEditPrecondition(
    value.precondition,
    `${path}.precondition`,
    issues
  );
  validatePositiveNumber(value.distance, `${path}.distance`, issues);
  validateEnum(
    value.side,
    ["left", "right", "inward", "outward"],
    `${path}.side`,
    issues
  );
  if (!isUnknownRecord(value.source)) {
    issues.push({
      code: "INVALID_TYPE",
      path: `${path}.source`,
      message: "Expected an offset source."
    });
  } else if (value.source.kind === "entity") {
    if (
      validateExactRecord(
        value.source,
        `${path}.source`,
        ["kind", "entityId"],
        [],
        issues
      )
    ) {
      validateNonEmptyString(
        value.source.entityId,
        `${path}.source.entityId`,
        issues
      );
    }
  } else if (value.source.kind === "chain") {
    if (
      validateExactRecord(
        value.source,
        `${path}.source`,
        ["kind", "segments", "closed"],
        [],
        issues
      )
    ) {
      validateOrientedSegments(
        value.source.segments,
        `${path}.source.segments`,
        issues
      );
      validateDistinctOrientedSegmentEntityIds(
        value.source.segments,
        `${path}.source.segments`,
        issues
      );
      if (
        Array.isArray(value.source.segments) &&
        value.source.segments.length === 0
      ) {
        issues.push({
          code: "INVALID_VALUE",
          path: `${path}.source.segments`,
          message: "An offset chain requires at least one segment."
        });
      }
      if (
        Array.isArray(value.source.segments) &&
        value.source.segments.length >
          CAD_V19_RESOURCE_LIMITS.maxOffsetSourceSegments
      ) {
        issues.push({
          code: "INVALID_VALUE",
          path: `${path}.source.segments`,
          message: "The offset source-segment limit was exceeded."
        });
      }
      validateBoolean(value.source.closed, `${path}.source.closed`, issues);
    }
  } else {
    issues.push({
      code: "INVALID_VALUE",
      path: `${path}.source.kind`,
      message: "Invalid offset source kind."
    });
  }
  if ("referencePoint" in value) {
    validateVec2(value.referencePoint, `${path}.referencePoint`, issues);
  }
  if ("createdEntityIds" in value) {
    const expectedLength =
      isUnknownRecord(value.source) &&
      value.source.kind === "chain" &&
      Array.isArray(value.source.segments)
        ? value.source.segments.length
        : 1;
    validateUniqueIdArray(
      value.createdEntityIds,
      `${path}.createdEntityIds`,
      issues,
      { exactLength: expectedLength }
    );
  }
}

function validateV19DimensionLiteral(
  target: unknown,
  value: unknown,
  path: string,
  issues: SketchProfilePathValidationIssue[]
): void {
  if (!validateFiniteNumber(value, path, issues) || !isUnknownRecord(target)) {
    return;
  }
  const linearTolerance = CAD_V19_SKETCH_GEOMETRY_POLICY.linearTolerance;
  const angularTolerance =
    CAD_V19_SKETCH_GEOMETRY_POLICY.angularToleranceDegrees;
  let minimumExclusive: number | undefined;
  if (target.kind === "entityScalar") {
    if (target.role === "diameter") {
      minimumExclusive = 2 * linearTolerance;
    } else if (
      target.role === "width" ||
      target.role === "height" ||
      target.role === "length" ||
      target.role === "radius"
    ) {
      minimumExclusive = linearTolerance;
    } else if (
      target.role === "sweep" &&
      (value < angularTolerance || value > 360 - angularTolerance)
    ) {
      issues.push({
        code: "INVALID_VALUE",
        path,
        message:
          "An arc-sweep dimension must use a positive magnitude inside the V17 sweep domain."
      });
    }
  } else if (
    target.kind === "pointPair" ||
    target.kind === "pointLineDistance"
  ) {
    minimumExclusive = linearTolerance;
  } else if (
    target.kind === "lineAngle" &&
    (value <= angularTolerance || value >= 180 - angularTolerance)
  ) {
    issues.push({
      code: "INVALID_VALUE",
      path,
      message:
        "A line-angle dimension must remain strictly inside its 0/180-degree branch."
    });
  }
  if (minimumExclusive !== undefined && value <= minimumExclusive) {
    issues.push({
      code: "INVALID_VALUE",
      path,
      message: `The dimension value must be greater than ${minimumExclusive}.`
    });
  }
}

function validateDistinctIds(
  primary: unknown,
  secondary: unknown,
  path: string,
  issues: SketchProfilePathValidationIssue[]
): void {
  if (
    typeof primary === "string" &&
    primary.length > 0 &&
    primary === secondary
  ) {
    issues.push({
      code: "INVALID_VALUE",
      path,
      message: "The two constraint targets must be distinct."
    });
  }
}

function validateV19ConstraintDefinition(
  value: unknown,
  path: string,
  issues: SketchProfilePathValidationIssue[]
): void {
  if (!isUnknownRecord(value)) {
    issues.push({
      code: "INVALID_TYPE",
      path,
      message: "Expected a structural constraint definition."
    });
    return;
  }
  switch (value.kind) {
    case "horizontal":
    case "vertical":
      if (validateExactRecord(value, path, ["kind", "entityId"], [], issues)) {
        validateNonEmptyString(value.entityId, `${path}.entityId`, issues);
      }
      return;
    case "fixed":
      if (
        validateExactRecord(
          value,
          path,
          ["kind", "target", "coordinate"],
          [],
          issues
        )
      ) {
        validatePointTargetV22(value.target, `${path}.target`, issues);
        validateVec2(value.coordinate, `${path}.coordinate`, issues);
      }
      return;
    case "coincident":
      if (
        validateExactRecord(
          value,
          path,
          ["kind", "primaryTarget", "secondaryTarget"],
          [],
          issues
        )
      ) {
        validatePointTargetV22(
          value.primaryTarget,
          `${path}.primaryTarget`,
          issues
        );
        validatePointTargetV22(
          value.secondaryTarget,
          `${path}.secondaryTarget`,
          issues
        );
        validateDistinctIds(
          pointTargetV22Key(value.primaryTarget),
          pointTargetV22Key(value.secondaryTarget),
          path,
          issues
        );
      }
      return;
    case "midpoint":
      if (
        validateExactRecord(
          value,
          path,
          ["kind", "lineEntityId", "target"],
          [],
          issues
        )
      ) {
        validateNonEmptyString(
          value.lineEntityId,
          `${path}.lineEntityId`,
          issues
        );
        validatePointTargetV22(value.target, `${path}.target`, issues);
        if (
          isUnknownRecord(value.target) &&
          value.target.entityKind !== "point" &&
          value.target.entityKind !== "rectangle" &&
          value.target.entityKind !== "circle"
        ) {
          issues.push({
            code: "INVALID_VALUE",
            path: `${path}.target`,
            message:
              "A midpoint target must be a point, rectangle center, or circle center."
          });
        }
      }
      return;
    case "parallel":
    case "perpendicular":
    case "equalLength":
    case "angle": {
      const angle = value.kind === "angle";
      if (
        validateExactRecord(
          value,
          path,
          [
            "kind",
            "primaryLineEntityId",
            "secondaryLineEntityId",
            ...(angle ? ["angleDegrees"] : [])
          ],
          [],
          issues
        )
      ) {
        validateNonEmptyString(
          value.primaryLineEntityId,
          `${path}.primaryLineEntityId`,
          issues
        );
        validateNonEmptyString(
          value.secondaryLineEntityId,
          `${path}.secondaryLineEntityId`,
          issues
        );
        validateDistinctIds(
          value.primaryLineEntityId,
          value.secondaryLineEntityId,
          path,
          issues
        );
        if (angle) {
          validateFiniteNumber(
            value.angleDegrees,
            `${path}.angleDegrees`,
            issues
          );
        }
      }
      return;
    }
    case "tangent":
      if (
        validateExactRecord(
          value,
          path,
          ["kind", "primaryTarget", "secondaryTarget"],
          [],
          issues
        )
      ) {
        const primaryTarget = value.primaryTarget;
        const secondaryTarget = value.secondaryTarget;
        const primaryValid = validateCurveConstraintTarget(
          primaryTarget,
          `${path}.primaryTarget`,
          issues
        );
        const secondaryValid = validateCurveConstraintTarget(
          secondaryTarget,
          `${path}.secondaryTarget`,
          issues
        );
        if (primaryValid && secondaryValid) {
          const primaryKind = primaryTarget.entityKind;
          const secondaryKind = secondaryTarget.entityKind;
          const supported =
            (primaryKind === "line" &&
              (secondaryKind === "circle" || secondaryKind === "arc")) ||
            (secondaryKind === "line" &&
              (primaryKind === "circle" || primaryKind === "arc")) ||
            (primaryKind === "circle" && secondaryKind === "arc") ||
            (primaryKind === "arc" &&
              (secondaryKind === "circle" || secondaryKind === "arc"));
          if (!supported) {
            issues.push({
              code: "INVALID_VALUE",
              path,
              message:
                "Tangent updates support only line-circle, line-arc, circle-arc, or arc-arc pairs."
            });
          }
          validateDistinctIds(
            primaryTarget.entityId,
            secondaryTarget.entityId,
            path,
            issues
          );
        }
      }
      return;
    case "concentric":
    case "equalRadius":
      if (
        validateExactRecord(
          value,
          path,
          ["kind", "primaryTarget", "secondaryTarget"],
          [],
          issues
        )
      ) {
        const primaryTarget = value.primaryTarget;
        const secondaryTarget = value.secondaryTarget;
        const primaryValid = validateRadiusCurveTarget(
          primaryTarget,
          `${path}.primaryTarget`,
          issues
        );
        const secondaryValid = validateRadiusCurveTarget(
          secondaryTarget,
          `${path}.secondaryTarget`,
          issues
        );
        if (primaryValid && secondaryValid) {
          validateDistinctIds(
            primaryTarget.entityId,
            secondaryTarget.entityId,
            path,
            issues
          );
        }
      }
      return;
    case "symmetry":
      if (
        validateExactRecord(
          value,
          path,
          ["kind", "primaryTarget", "secondaryTarget", "symmetryLineEntityId"],
          [],
          issues
        )
      ) {
        const primaryTarget = value.primaryTarget;
        const secondaryTarget = value.secondaryTarget;
        validatePointTargetV22(primaryTarget, `${path}.primaryTarget`, issues);
        validatePointTargetV22(
          secondaryTarget,
          `${path}.secondaryTarget`,
          issues
        );
        validateDistinctIds(
          pointTargetV22Key(primaryTarget),
          pointTargetV22Key(secondaryTarget),
          path,
          issues
        );
        validateNonEmptyString(
          value.symmetryLineEntityId,
          `${path}.symmetryLineEntityId`,
          issues
        );
      }
      return;
    default:
      issues.push({
        code: "INVALID_VALUE",
        path: `${path}.kind`,
        message: "Unknown structural constraint definition kind."
      });
  }
}

function validateV19NormalizedPointConstraintCreate(
  value: UnknownRecord,
  path: string,
  issues: SketchProfilePathValidationIssue[]
): void {
  const commonRequired = ["op", "name", "sketchId", "kind"];
  const commonOptional = ["id"];
  switch (value.kind) {
    case "fixed":
      if (
        validateExactRecord(
          value,
          path,
          [...commonRequired, "target"],
          [...commonOptional, "coordinate"],
          issues
        )
      ) {
        validatePointTargetV22(value.target, `${path}.target`, issues);
        if ("coordinate" in value) {
          validateVec2(value.coordinate, `${path}.coordinate`, issues);
        }
      }
      break;
    case "coincident":
      if (
        validateExactRecord(
          value,
          path,
          [...commonRequired, "primaryTarget", "secondaryTarget"],
          commonOptional,
          issues
        )
      ) {
        validatePointTargetV22(
          value.primaryTarget,
          `${path}.primaryTarget`,
          issues
        );
        validatePointTargetV22(
          value.secondaryTarget,
          `${path}.secondaryTarget`,
          issues
        );
        validateDistinctIds(
          pointTargetV22Key(value.primaryTarget),
          pointTargetV22Key(value.secondaryTarget),
          path,
          issues
        );
      }
      break;
    case "midpoint":
      if (
        validateExactRecord(
          value,
          path,
          [...commonRequired, "lineEntityId", "target"],
          commonOptional,
          issues
        )
      ) {
        validateNonEmptyString(
          value.lineEntityId,
          `${path}.lineEntityId`,
          issues
        );
        validatePointTargetV22(value.target, `${path}.target`, issues);
        if (
          isUnknownRecord(value.target) &&
          value.target.entityKind !== "point" &&
          value.target.entityKind !== "rectangle" &&
          value.target.entityKind !== "circle"
        ) {
          issues.push({
            code: "INVALID_VALUE",
            path: `${path}.target`,
            message:
              "A midpoint target must be a point, rectangle center, or circle center."
          });
        }
      }
      break;
    case "symmetry":
      if (
        validateExactRecord(
          value,
          path,
          [
            ...commonRequired,
            "primaryTarget",
            "secondaryTarget",
            "symmetryLineEntityId"
          ],
          commonOptional,
          issues
        )
      ) {
        validatePointTargetV22(
          value.primaryTarget,
          `${path}.primaryTarget`,
          issues
        );
        validatePointTargetV22(
          value.secondaryTarget,
          `${path}.secondaryTarget`,
          issues
        );
        validateDistinctIds(
          pointTargetV22Key(value.primaryTarget),
          pointTargetV22Key(value.secondaryTarget),
          path,
          issues
        );
        validateNonEmptyString(
          value.symmetryLineEntityId,
          `${path}.symmetryLineEntityId`,
          issues
        );
      }
      break;
    default:
      issues.push({
        code: "INVALID_VALUE",
        path: `${path}.kind`,
        message: "Expected a normalized V19 point-target constraint kind."
      });
  }
  validateNonEmptyString(value.name, `${path}.name`, issues);
  validateNonEmptyString(value.sketchId, `${path}.sketchId`, issues);
  if ("id" in value) validateNonEmptyString(value.id, `${path}.id`, issues);
}

function isNormalizedPointConstraintCreateAttempt(
  value: UnknownRecord
): boolean {
  if (
    value.op !== "sketch.constraint.create" ||
    (value.kind !== "fixed" &&
      value.kind !== "coincident" &&
      value.kind !== "midpoint" &&
      value.kind !== "symmetry")
  ) {
    return false;
  }
  const targets =
    value.kind === "coincident" || value.kind === "symmetry"
      ? [value.primaryTarget, value.secondaryTarget]
      : [value.target];
  return targets.some(
    (target) => isUnknownRecord(target) && "entityKind" in target
  );
}

function validateRegionProfileForFeature(
  value: unknown,
  path: string,
  issues: SketchProfilePathValidationIssue[]
): number | undefined {
  const before = issues.length;
  validateProfileRef(value, path, issues);
  if (!isUnknownRecord(value) || value.kind !== "regions") {
    issues.push({
      code: "INVALID_VALUE",
      path: `${path}.kind`,
      message: "A V19-only feature operation requires a regions profile."
    });
    return undefined;
  }
  return issues.length === before && Array.isArray(value.regions)
    ? value.regions.length
    : undefined;
}

function validateRevolveAxis(
  value: unknown,
  path: string,
  issues: SketchProfilePathValidationIssue[]
): void {
  if (
    !validateExactRecord(
      value,
      path,
      ["type", "sketchId", "entityId"],
      [],
      issues
    )
  ) {
    return;
  }
  if (value.type !== "sketchLine") {
    issues.push({
      code: "INVALID_VALUE",
      path: `${path}.type`,
      message: "A revolve axis must be a sketch line."
    });
  }
  validateNonEmptyString(value.sketchId, `${path}.sketchId`, issues);
  validateNonEmptyString(value.entityId, `${path}.entityId`, issues);
}

function validateV19FeatureOp(
  value: UnknownRecord,
  path: string,
  issues: SketchProfilePathValidationIssue[]
): void {
  const createExtrude = value.op === "feature.extrude";
  const createRevolve = value.op === "feature.revolve";
  const updateExtrude = value.op === "feature.updateExtrude";
  if (createExtrude) {
    if (
      !validateExactRecord(
        value,
        path,
        ["op", "profile", "depth"],
        [
          "id",
          "bodyId",
          "targetBodyId",
          "targetTopologyAnchorId",
          "name",
          "side",
          "operationMode"
        ],
        issues
      )
    ) {
      return;
    }
  } else if (createRevolve) {
    if (
      !validateExactRecord(
        value,
        path,
        ["op", "profile", "axis", "angleDegrees", "operationMode"],
        ["id", "bodyId", "name"],
        issues
      )
    ) {
      return;
    }
  } else if (updateExtrude) {
    if (
      !validateExactRecord(
        value,
        path,
        ["op", "id", "profile"],
        ["depth", "side"],
        issues
      )
    ) {
      return;
    }
  } else if (
    !validateExactRecord(
      value,
      path,
      ["op", "id", "profile"],
      ["angleDegrees"],
      issues
    )
  ) {
    return;
  }

  if ("id" in value) validateNonEmptyString(value.id, `${path}.id`, issues);
  if ("bodyId" in value) {
    validateNonEmptyString(value.bodyId, `${path}.bodyId`, issues);
  }
  if ("name" in value)
    validateNonEmptyString(value.name, `${path}.name`, issues);
  if ("depth" in value) {
    validatePositiveNumber(value.depth, `${path}.depth`, issues);
  }
  if ("side" in value) {
    validateEnum(
      value.side,
      ["positive", "negative", "symmetric"],
      `${path}.side`,
      issues
    );
  }
  if ("angleDegrees" in value) {
    validateFiniteNumber(value.angleDegrees, `${path}.angleDegrees`, issues);
  }

  const regionCount = validateRegionProfileForFeature(
    value.profile,
    `${path}.profile`,
    issues
  );
  if (createRevolve) {
    validateRevolveAxis(value.axis, `${path}.axis`, issues);
    if (value.operationMode !== "newBody") {
      issues.push({
        code: "INVALID_VALUE",
        path: `${path}.operationMode`,
        message: "Region revolve supports newBody only."
      });
    }
    if (regionCount !== undefined && regionCount !== 1) {
      issues.push({
        code: "INVALID_VALUE",
        path: `${path}.profile.regions`,
        message: "Region revolve accepts exactly one region."
      });
    }
    return;
  }
  if (value.op === "feature.updateRevolve") {
    if (regionCount !== undefined && regionCount !== 1) {
      issues.push({
        code: "INVALID_VALUE",
        path: `${path}.profile.regions`,
        message: "Region revolve accepts exactly one region."
      });
    }
    return;
  }
  if (!createExtrude) return;

  const operationMode =
    value.operationMode === undefined ? "newBody" : value.operationMode;
  validateEnum(
    operationMode,
    ["newBody", "add", "cut"],
    `${path}.operationMode`,
    issues
  );
  if (operationMode === "newBody") {
    if (regionCount !== undefined && regionCount !== 1) {
      issues.push({
        code: "INVALID_VALUE",
        path: `${path}.profile.regions`,
        message: "A new-body region extrude accepts exactly one region."
      });
    }
    if ("targetBodyId" in value || "targetTopologyAnchorId" in value) {
      issues.push({
        code: "UNKNOWN_FIELD",
        path,
        message: "A new-body extrude cannot carry a target body."
      });
    }
  } else {
    const hasBody = "targetBodyId" in value;
    const hasAnchor = "targetTopologyAnchorId" in value;
    if (hasBody === hasAnchor) {
      issues.push({
        code: "INVALID_VALUE",
        path,
        message:
          "A region add/cut extrude requires exactly one target body or topology anchor."
      });
    }
    if (hasBody) {
      validateNonEmptyString(
        value.targetBodyId,
        `${path}.targetBodyId`,
        issues
      );
    }
    if (hasAnchor) {
      validateNonEmptyString(
        value.targetTopologyAnchorId,
        `${path}.targetTopologyAnchorId`,
        issues
      );
    }
  }
}

export function validateV19CadOp(
  value: unknown
): CadV19ProtocolValidationResult<CadV19Op> {
  const issues: SketchProfilePathValidationIssue[] = [];
  if (!isUnknownRecord(value) || typeof value.op !== "string") {
    return {
      ok: false,
      issues: [
        {
          code: "INVALID_TYPE",
          path: "$",
          message: "Expected a V19 CADOps operation."
        }
      ]
    };
  }
  if (
    value.op === "sketch.trim" ||
    value.op === "sketch.extend" ||
    value.op === "sketch.split" ||
    value.op === "sketch.explodeRectangle"
  ) {
    validateCurveEditOperation(value, "$", issues);
  } else if (value.op === "sketch.offset") {
    validateOffsetOperation(value, "$", issues);
  } else if (
    value.op === "sketch.addSlot" ||
    value.op === "sketch.addRoundedRectangle"
  ) {
    const rounded = value.op === "sketch.addRoundedRectangle";
    const linearTolerance = CAD_V19_SKETCH_GEOMETRY_POLICY.linearTolerance;
    validateExactRecord(
      value,
      "$",
      rounded
        ? ["op", "sketchId", "center", "width", "height", "cornerRadius"]
        : ["op", "sketchId", "centerlineStart", "centerlineEnd", "radius"],
      ["construction", "entityIds", "constraintIds"],
      issues
    );
    validateNonEmptyString(value.sketchId, "$.sketchId", issues);
    if (rounded) {
      validateVec2(value.center, "$.center", issues);
      validatePositiveNumber(value.width, "$.width", issues);
      validatePositiveNumber(value.height, "$.height", issues);
      validatePositiveNumber(value.cornerRadius, "$.cornerRadius", issues);
      if (
        typeof value.width === "number" &&
        typeof value.height === "number" &&
        typeof value.cornerRadius === "number"
      ) {
        if (value.cornerRadius <= linearTolerance) {
          issues.push({
            code: "INVALID_VALUE",
            path: "$.cornerRadius",
            message: `A rounded-rectangle corner radius must be greater than ${linearTolerance}.`
          });
        }
        if (
          value.width - 2 * value.cornerRadius <= linearTolerance ||
          value.height - 2 * value.cornerRadius <= linearTolerance
        ) {
          issues.push({
            code: "INVALID_VALUE",
            path: "$.cornerRadius",
            message:
              "A rounded rectangle must leave every straight span above the shared linear tolerance."
          });
        }
      }
    } else {
      validateVec2(value.centerlineStart, "$.centerlineStart", issues);
      validateVec2(value.centerlineEnd, "$.centerlineEnd", issues);
      validatePositiveNumber(value.radius, "$.radius", issues);
      if (typeof value.radius === "number" && value.radius <= linearTolerance) {
        issues.push({
          code: "INVALID_VALUE",
          path: "$.radius",
          message: `A slot radius must be greater than ${linearTolerance}.`
        });
      }
      if (
        Array.isArray(value.centerlineStart) &&
        Array.isArray(value.centerlineEnd) &&
        value.centerlineStart.length === 2 &&
        value.centerlineEnd.length === 2 &&
        typeof value.centerlineStart[0] === "number" &&
        typeof value.centerlineStart[1] === "number" &&
        typeof value.centerlineEnd[0] === "number" &&
        typeof value.centerlineEnd[1] === "number" &&
        Math.hypot(
          value.centerlineEnd[0] - value.centerlineStart[0],
          value.centerlineEnd[1] - value.centerlineStart[1]
        ) <= linearTolerance
      ) {
        issues.push({
          code: "INVALID_VALUE",
          path: "$.centerlineEnd",
          message: `A slot centerline must be longer than ${linearTolerance}.`
        });
      }
    }
    if ("construction" in value) {
      validateBoolean(value.construction, "$.construction", issues);
    }
    if ("entityIds" in value) {
      validateUniqueIdArray(value.entityIds, "$.entityIds", issues, {
        exactLength: rounded ? 8 : 4
      });
    }
    if ("constraintIds" in value) {
      validateUniqueIdArray(value.constraintIds, "$.constraintIds", issues, {
        exactLength: rounded ? 23 : 9
      });
    }
  } else if (
    value.op === "sketch.dimension.update" ||
    (value.op === "sketch.dimension.create" &&
      isUnknownRecord(value.target) &&
      typeof value.target.kind === "string")
  ) {
    const create = value.op === "sketch.dimension.create";
    if (create && "entityId" in value) {
      issues.push({
        code: "COMMAND_INPUT_AMBIGUOUS",
        path: "$",
        message:
          "A dimension command cannot mix legacy entityId with a normalized V22 target."
      });
    }
    validateExactRecord(
      value,
      "$",
      create ? ["op", "name", "sketchId", "target"] : ["op", "id"],
      create
        ? ["id", "value", "parameterId"]
        : ["target", "value", "parameterId"],
      issues
    );
    if (create) {
      validateNonEmptyString(value.name, "$.name", issues);
      validateNonEmptyString(value.sketchId, "$.sketchId", issues);
    } else {
      validateNonEmptyString(value.id, "$.id", issues);
    }
    if ("target" in value) {
      validateDimensionTargetV22(value.target, "$.target", issues);
      if (
        isUnknownRecord(value.target) &&
        value.target.kind === "lineAngle" &&
        "parameterId" in value
      ) {
        issues.push({
          code: "INVALID_VALUE",
          path: "$.parameterId",
          message: "Line-angle dimensions accept literal values only."
        });
      }
    }
    if ("value" in value) {
      validateV19DimensionLiteral(value.target, value.value, "$.value", issues);
    }
    if ("parameterId" in value) {
      validateNonEmptyString(value.parameterId, "$.parameterId", issues);
    }
    if ("value" in value && "parameterId" in value) {
      issues.push({
        code: "INVALID_VALUE",
        path: "$",
        message: "A dimension command accepts exactly one value source."
      });
    }
    if (!("value" in value) && !("parameterId" in value)) {
      issues.push({
        code: "MISSING_FIELD",
        path: "$",
        message: "A dimension command requires exactly one value source."
      });
    }
  } else if (value.op === "sketch.constraint.update") {
    if (
      validateExactRecord(value, "$", ["op", "id", "definition"], [], issues)
    ) {
      validateNonEmptyString(value.id, "$.id", issues);
      validateV19ConstraintDefinition(value.definition, "$.definition", issues);
    }
  } else if (isNormalizedPointConstraintCreateAttempt(value)) {
    validateV19NormalizedPointConstraintCreate(value, "$", issues);
  } else if (
    value.op === "sketch.constraint.create" &&
    value.kind === "equalLength"
  ) {
    if (
      validateExactRecord(
        value,
        "$",
        [
          "op",
          "name",
          "sketchId",
          "kind",
          "primaryLineEntityId",
          "secondaryLineEntityId"
        ],
        ["id"],
        issues
      )
    ) {
      validateNonEmptyString(value.name, "$.name", issues);
      validateNonEmptyString(value.sketchId, "$.sketchId", issues);
      validateNonEmptyString(
        value.primaryLineEntityId,
        "$.primaryLineEntityId",
        issues
      );
      validateNonEmptyString(
        value.secondaryLineEntityId,
        "$.secondaryLineEntityId",
        issues
      );
      validateDistinctIds(
        value.primaryLineEntityId,
        value.secondaryLineEntityId,
        "$",
        issues
      );
    }
  } else if (
    value.op === "feature.extrude" ||
    value.op === "feature.revolve" ||
    value.op === "feature.updateExtrude" ||
    value.op === "feature.updateRevolve"
  ) {
    validateV19FeatureOp(value, "$", issues);
  } else {
    issues.push({
      code: "INVALID_VALUE",
      path: "$.op",
      message: "Expected a V19 operation kind."
    });
  }
  return issues.length === 0
    ? { ok: true, value: value as unknown as CadV19Op }
    : { ok: false, issues };
}

function validateCurveEditProposal(
  value: unknown,
  path: string,
  issues: SketchProfilePathValidationIssue[]
): void {
  if (!isUnknownRecord(value) || typeof value.kind !== "string") {
    issues.push({
      code: "INVALID_TYPE",
      path,
      message: "Expected a curve-edit proposal."
    });
    return;
  }
  const op =
    value.kind === "trim"
      ? "sketch.trim"
      : value.kind === "extend"
        ? "sketch.extend"
        : value.kind === "split"
          ? "sketch.split"
          : value.kind === "explodeRectangle"
            ? "sketch.explodeRectangle"
            : value.kind === "offset"
              ? "sketch.offset"
              : undefined;
  if (!op) {
    issues.push({
      code: "INVALID_VALUE",
      path: `${path}.kind`,
      message: "Unknown curve-edit proposal kind."
    });
    return;
  }
  const synthetic: UnknownRecord = { ...value, op };
  delete synthetic.kind;
  synthetic.precondition = {
    expectedSourceRevision: `partbench-source-v1:${"0".repeat(64)}`,
    expectedSolverEvaluationIdentity: "none"
  };
  const result = validateV19CadOp(synthetic);
  if (!result.ok) {
    issues.push(
      ...result.issues.map((issue) => ({
        ...issue,
        path:
          issue.path === "$.precondition"
            ? path
            : issue.path.replace(/^\$/, path)
      }))
    );
  }
}

export function validateV19SketchQueryRequest(
  value: unknown
): CadV19ProtocolValidationResult<
  Omit<CadQueryRequest, "query"> & {
    readonly query:
      | SketchCurveEditReadinessQuery
      | SketchProfileRegionCandidatesQuery
      | SketchProfileRegionValidateQuery;
  }
> {
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
      message: "Expected a V19 sketch query."
    });
  } else if (value.query.query === "sketch.curveEditReadiness") {
    if (
      validateExactRecord(
        value.query,
        "$.query",
        ["query", "proposal"],
        [],
        issues
      )
    ) {
      validateCurveEditProposal(
        value.query.proposal,
        "$.query.proposal",
        issues
      );
    }
  } else if (value.query.query === "sketch.profileRegionCandidates") {
    if (
      validateExactRecord(
        value.query,
        "$.query",
        ["query", "sketchId"],
        ["entityIds", "limit", "afterCandidateKey", "sourceRevision"],
        issues
      )
    ) {
      validateNonEmptyString(value.query.sketchId, "$.query.sketchId", issues);
      if ("entityIds" in value.query) {
        validateUniqueIdArray(
          value.query.entityIds,
          "$.query.entityIds",
          issues,
          {
            maxLength: CAD_V19_RESOURCE_LIMITS.maxSketchEntitiesPerEditedSketch
          }
        );
      }
      if ("limit" in value.query) {
        if (
          !validateNonNegativeInteger(
            value.query.limit,
            "$.query.limit",
            issues
          ) ||
          value.query.limit < 1 ||
          value.query.limit > CAD_V19_RESOURCE_LIMITS.maxRegionCandidatesPerPage
        ) {
          issues.push({
            code: "INVALID_VALUE",
            path: "$.query.limit",
            message: "Candidate page limit must be from 1 through 100."
          });
        }
      }
      const hasAfter = "afterCandidateKey" in value.query;
      const hasRevision = "sourceRevision" in value.query;
      if (hasAfter !== hasRevision) {
        issues.push({
          code: "INVALID_VALUE",
          path: "$.query",
          message:
            "Later candidate pages require both afterCandidateKey and sourceRevision."
        });
      }
      if (hasAfter) {
        validateNonEmptyString(
          value.query.afterCandidateKey,
          "$.query.afterCandidateKey",
          issues
        );
        if (
          typeof value.query.sourceRevision !== "string" ||
          !/^partbench-source-v1:[0-9a-f]{64}$/.test(value.query.sourceRevision)
        ) {
          issues.push({
            code: "INVALID_VALUE",
            path: "$.query.sourceRevision",
            message: "Invalid revision-bound candidate cursor."
          });
        }
      }
    }
  } else if (value.query.query === "sketch.profileRegionValidate") {
    if (
      validateExactRecord(
        value.query,
        "$.query",
        ["query", "profile"],
        [],
        issues
      )
    ) {
      if (!isSketchRegionsProfileRef(value.query.profile)) {
        issues.push({
          code: "INVALID_VALUE",
          path: "$.query.profile",
          message: "Invalid explicit regions profile."
        });
      }
    }
  } else {
    issues.push({
      code: "INVALID_VALUE",
      path: "$.query.query",
      message: "Expected a V19 sketch query kind."
    });
  }
  return issues.length === 0
    ? {
        ok: true,
        value: value as unknown as Omit<CadQueryRequest, "query"> & {
          readonly query:
            | SketchCurveEditReadinessQuery
            | SketchProfileRegionCandidatesQuery
            | SketchProfileRegionValidateQuery;
        }
      }
    : { ok: false, issues };
}

export const protocolPackage: PackageInfo = {
  name: "@web-cad/cad-protocol",
  status: "ready"
};
