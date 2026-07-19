import type {
  FeatureShellOpenFaceRef,
  LoftSection,
  MirrorPlaneRef,
  PatternDirectionRef,
  PatternRotationAxisRef,
  SketchPathRef,
  SketchProfileRef
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
  FeatureRevolveForm,
  FeatureShellForm,
  FeatureSweepForm,
  PrimitiveCommandForm,
  SketchCreateForm,
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
  | "mirror";

export interface SolidDraftByKind {
  readonly box: PrimitiveCommandForm;
  readonly cylinder: PrimitiveCommandForm;
  readonly sphere: PrimitiveCommandForm;
  readonly cone: PrimitiveCommandForm;
  readonly torus: PrimitiveCommandForm;
  readonly sketch: SketchCreateForm;
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
}

export type SolidDraft = SolidDraftByKind[SolidEditorKind];

export type SolidEditorSubmission = {
  readonly [Kind in SolidEditorKind]: {
    readonly kind: Kind;
    readonly draft: SolidDraftByKind[Kind];
  };
}[SolidEditorKind];

export interface SolidChoice<Value> {
  /** Exact source/query-returned value. It is never reconstructed from label text. */
  readonly value: Value;
  readonly key: string;
  readonly label: string;
  readonly kind: string;
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
  readonly seedBodies?: readonly SolidChoice<string>[];
  readonly axes?: readonly SolidChoice<string>[];
  readonly profiles?: readonly SolidChoice<SketchProfileRef>[];
  readonly paths?: readonly SolidChoice<SketchPathRef>[];
  readonly sweepPaths?: readonly SolidChoice<SweepPathChoiceValue>[];
  readonly loftSections?: readonly SolidChoice<LoftSection>[];
  readonly edges?: readonly SolidChoice<EdgeChoiceValue>[];
  readonly directions?: readonly SolidChoice<PatternDirectionRef>[];
  readonly rotationAxes?: readonly SolidChoice<PatternRotationAxisRef>[];
  readonly mirrorPlanes?: readonly SolidChoice<MirrorPlaneRef>[];
  readonly openFaces?: readonly SolidChoice<FeatureShellOpenFaceRef>[];
}

export interface SolidEditorRequest<
  Kind extends SolidEditorKind = SolidEditorKind
> {
  /** Changes whenever the parent intentionally opens a fresh editor session. */
  readonly key: string;
  readonly kind: Kind;
  readonly title: string;
  readonly mode?: "create" | "edit";
  readonly initialDraft: SolidDraftByKind[Kind];
  readonly choices?: SolidEditorChoices;
  readonly blockedReason?: string;
  readonly deletable?: boolean;
}

export interface SolidCollectorRequest {
  readonly editorKey: string;
  readonly collector:
    | "targetBody"
    | "seedBody"
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

export function createSolidEditorSubmission(
  kind: SolidEditorKind,
  draft: SolidDraft
): SolidEditorSubmission {
  return { kind, draft } as SolidEditorSubmission;
}
