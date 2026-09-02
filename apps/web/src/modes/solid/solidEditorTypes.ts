import type {
  CadOp,
  FeatureShellOpenFaceRef,
  LoftSection,
  MirrorPlaneRef,
  PatternDirectionRef,
  PatternRotationAxisRef,
  SketchPathRef,
  SketchProfileRefV22
} from "@web-cad/cad-protocol";
import type {
  FeatureCircularPatternForm,
  FeatureCompositeExtrudeForm,
  FeatureCompositeRevolveForm,
  FeatureCompositeSweepForm,
  FeatureEdgeFinishForm,
  FeatureExtrudeForm,
  FeatureHoleForm,
  FeatureLinearPatternForm,
  FeatureLoftForm,
  FeatureMirrorForm,
  FeatureAlignForm,
  FeatureCombineForm,
  FeatureOffsetForm,
  FeatureRevolveForm,
  FeatureShellForm,
  FeatureSweepForm,
  PrimitiveCommandForm,
  SketchCreateForm,
  DatumAxisCreateForm,
  DatumPlaneCreateForm,
  TransformCommandForm
} from "../../cadCommands";

export type PrimitiveEditorKind =
  | "box"
  | "cylinder"
  | "sphere"
  | "cone"
  | "torus";

export type SolidEditorKind =
  | PrimitiveEditorKind
  | "sketch"
  | "datumPlane"
  | "datumAxis"
  | "transform"
  | "extrude"
  | "compositeExtrude"
  | "revolve"
  | "compositeRevolve"
  | "sweep"
  | "compositeSweep"
  | "loft"
  | "hole"
  | "fillet"
  | "chamfer"
  | "shell"
  | "linearPattern"
  | "circularPattern"
  | "mirror"
  | "combine"
  | "offset"
  | "align";

export interface SolidDraftByKind {
  readonly box: PrimitiveCommandForm;
  readonly cylinder: PrimitiveCommandForm;
  readonly sphere: PrimitiveCommandForm;
  readonly cone: PrimitiveCommandForm;
  readonly torus: PrimitiveCommandForm;
  readonly sketch: SketchCreateForm;
  readonly datumPlane: DatumPlaneCreateForm;
  readonly datumAxis: DatumAxisCreateForm;
  readonly transform: TransformCommandForm;
  readonly extrude: FeatureExtrudeForm;
  readonly compositeExtrude: FeatureCompositeExtrudeForm;
  readonly revolve: FeatureRevolveForm;
  readonly compositeRevolve: FeatureCompositeRevolveForm;
  readonly sweep: FeatureSweepForm;
  readonly compositeSweep: FeatureCompositeSweepForm;
  readonly loft: FeatureLoftForm;
  readonly hole: FeatureHoleForm;
  readonly fillet: FeatureEdgeFinishForm;
  readonly chamfer: FeatureEdgeFinishForm;
  readonly shell: FeatureShellForm;
  readonly linearPattern: FeatureLinearPatternForm;
  readonly circularPattern: FeatureCircularPatternForm;
  readonly mirror: FeatureMirrorForm;
  readonly combine: FeatureCombineForm;
  readonly offset: FeatureOffsetForm;
  readonly align: FeatureAlignForm;
}

export type SolidDraft = SolidDraftByKind[SolidEditorKind];

export type SolidEditorSubmission = {
  readonly [Kind in SolidEditorKind]: {
    readonly kind: Kind;
    readonly draft: SolidDraftByKind[Kind];
  };
}[SolidEditorKind];

export interface SolidChoice<Value> {
  readonly value: Value;
  readonly key: string;
  readonly label: string;
  readonly kind: string;
  readonly targetTopologyAnchorId?: string;
  readonly targetBodyId?: string;
  readonly disabled?: boolean;
  readonly warning?: string;
  readonly detail?: string;
}

export interface SweepPathChoiceValue {
  readonly pathSketchId: string;
  readonly pathEntityIds: readonly string[];
}

export interface EdgeChoiceValue {
  readonly targetBodyId: string;
  readonly edgeStableId?: string;
  readonly namedReference?: string;
  readonly topologyAnchorId?: string;
  readonly topologyAnchorProof?: FeatureEdgeFinishForm["topologyAnchorProof"];
}

export interface SolidEditorChoices {
  readonly bodies?: readonly SolidChoice<string>[];
  readonly targetBodies?: readonly SolidChoice<string>[];
  readonly addTargetBodies?: readonly SolidChoice<string>[];
  readonly cutTargetBodies?: readonly SolidChoice<string>[];
  readonly seedBodies?: readonly SolidChoice<string>[];
  readonly seedFeatures?: readonly SolidChoice<string>[];
  readonly toolBodies?: readonly SolidChoice<string>[];
  readonly axes?: readonly SolidChoice<string>[];
  readonly profiles?: readonly SolidChoice<SketchProfileRefV22>[];
  readonly paths?: readonly SolidChoice<SketchPathRef>[];
  readonly sweepPaths?: readonly SolidChoice<SweepPathChoiceValue>[];
  readonly loftSections?: readonly SolidChoice<LoftSection>[];
  readonly edges?: readonly SolidChoice<EdgeChoiceValue>[];
  readonly directions?: readonly SolidChoice<PatternDirectionRef>[];
  readonly rotationAxes?: readonly SolidChoice<PatternRotationAxisRef>[];
  readonly mirrorPlanes?: readonly SolidChoice<MirrorPlaneRef>[];
  readonly datums?: readonly SolidChoice<string>[];
  readonly openFaces?: readonly SolidChoice<FeatureShellOpenFaceRef>[];
}

export interface SolidEditorRequest<
  Kind extends SolidEditorKind = SolidEditorKind
> {
  readonly key: string;
  readonly kind: Kind;
  readonly title: string;
  readonly mode?: "create" | "edit";
  readonly initialDraft: SolidDraftByKind[Kind];
  readonly choices?: SolidEditorChoices;
  readonly blockedReason?: string;
  readonly deletable?: boolean;
  /** Browser-session-only promotion batch prefix for an unmatched exact pick. */
  readonly pendingCurrentExactPromotionOps?: readonly CadOp[];
}

export interface SolidCollectorRequest {
  readonly editorKey: string;
  readonly collector:
    | "targetBody"
    | "seedBody"
    | "seedFeature"
    | "toolBody"
    | "axis"
    | "profile"
    | "path"
    | "sections"
    | "edge"
    | "openFaces"
    | "direction"
    | "rotationAxis"
    | "mirrorPlane";
  readonly acceptedKinds: readonly string[];
}

export interface SolidCollectorSelection {
  readonly key: string;
  readonly choiceKeys: Partial<
    Record<SolidCollectorRequest["collector"], string>
  >;
}

export function createSolidEditorSubmission(
  kind: SolidEditorKind,
  draft: SolidDraft
): SolidEditorSubmission {
  return { kind, draft } as SolidEditorSubmission;
}
