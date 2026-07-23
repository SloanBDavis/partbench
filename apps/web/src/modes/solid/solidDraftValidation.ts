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
import type { FeatureEditorValidation } from "../../editors/featureEditorState";
import type { SolidDraft, SolidEditorKind } from "./solidEditorTypes";

export function validateSolidDraft(
  kind: SolidEditorKind,
  draft: SolidDraft
): FeatureEditorValidation {
  const positive = (value: number) => Number.isFinite(value) && value > 0;
  if (kind === "box") {
    const form = draft as PrimitiveCommandForm;
    return positive(form.width) && positive(form.height) && positive(form.depth)
      ? ready()
      : blocked("Width, height, and depth must be greater than zero.");
  }
  if (kind === "cylinder" || kind === "cone") {
    const form = draft as PrimitiveCommandForm;
    return positive(form.radius) && positive(form.height)
      ? ready()
      : blocked("Radius and height must be greater than zero.");
  }
  if (kind === "sphere")
    return positive((draft as PrimitiveCommandForm).radius)
      ? ready()
      : blocked("Radius must be greater than zero.");
  if (kind === "torus") {
    const form = draft as PrimitiveCommandForm;
    return positive(form.majorRadius) &&
      positive(form.minorRadius) &&
      form.majorRadius > form.minorRadius
      ? ready()
      : blocked("Major radius must be greater than the positive minor radius.");
  }
  if (kind === "sketch")
    return (draft as SketchCreateForm).name.trim()
      ? ready()
      : blocked("Enter a sketch name.");
  if (kind === "transform") {
    const form = draft as TransformCommandForm;
    return [
      form.translationX,
      form.translationY,
      form.translationZ,
      form.rotationX,
      form.rotationY,
      form.rotationZ,
      form.scaleX,
      form.scaleY,
      form.scaleZ
    ].every(Number.isFinite) &&
      form.scaleX !== 0 &&
      form.scaleY !== 0 &&
      form.scaleZ !== 0
      ? ready()
      : blocked("Transform values must be finite and scale cannot be zero.");
  }
  if (kind === "extrude" || kind === "compositeExtrude") {
    const form = draft as FeatureExtrudeForm;
    if (
      kind === "compositeExtrude" &&
      !(draft as FeatureCompositeExtrudeForm).profile
    )
      return collecting("Select a closed sketch profile.");
    if (!positive(form.depth))
      return blocked("Depth must be greater than zero.");
    return form.operationMode !== "newBody" && !form.targetBodyId
      ? collecting("Select a target body.")
      : ready();
  }
  if (kind === "revolve" || kind === "compositeRevolve") {
    const form = draft as FeatureRevolveForm;
    if (
      kind === "compositeRevolve" &&
      !(draft as FeatureCompositeRevolveForm).profile
    )
      return collecting("Select a closed sketch profile.");
    if (!form.axisEntityId) return collecting("Select an axis line.");
    return positive(form.angleDegrees) && form.angleDegrees <= 360
      ? ready()
      : blocked("Angle must be greater than zero and no more than 360°.");
  }
  if (kind === "sweep") {
    const form = draft as FeatureSweepForm;
    return form.pathSketchId && form.pathEntityIds.length > 0
      ? ready()
      : collecting("Select a supported sweep path.");
  }
  if (kind === "compositeSweep") {
    const form = draft as FeatureCompositeSweepForm;
    if (!form.profile) return collecting("Select an entity profile.");
    return form.path ? ready() : collecting("Select a supported sweep path.");
  }
  if (kind === "loft")
    return (draft as FeatureLoftForm).sections.length >= 2
      ? ready()
      : collecting("Select at least two sections.");
  if (kind === "hole") {
    const form = draft as FeatureHoleForm;
    if (!form.targetBodyId) return collecting("Select a target body.");
    return form.depthMode === "throughAll" || positive(form.depth)
      ? ready()
      : blocked("Blind depth must be greater than zero.");
  }
  if (kind === "fillet" || kind === "chamfer") {
    const form = draft as FeatureEdgeFinishForm;
    if (
      !form.targetBodyId ||
      (!form.edgeStableId && !form.namedReference && !form.topologyAnchorId)
    )
      return collecting("Select a supported edge.");
    return positive(kind === "fillet" ? form.radius : form.distance)
      ? ready()
      : blocked(
          `${kind === "fillet" ? "Radius" : "Distance"} must be greater than zero.`
        );
  }
  if (kind === "shell") {
    const form = draft as FeatureShellForm;
    if (!form.targetBodyId) return collecting("Select a target body.");
    return positive(form.wallThickness)
      ? ready()
      : blocked("Wall thickness must be greater than zero.");
  }
  if (kind === "linearPattern") {
    const form = draft as FeatureLinearPatternForm;
    if (!form.seedBodyId) return collecting("Select an authored seed body.");
    return positive(form.spacing) &&
      Number.isInteger(form.instanceCount) &&
      form.instanceCount >= 2
      ? ready()
      : blocked(
          "Spacing must be positive and instances must be a whole number of at least two."
        );
  }
  if (kind === "circularPattern") {
    const form = draft as FeatureCircularPatternForm;
    if (!form.seedBodyId) return collecting("Select an authored seed body.");
    return positive(form.totalAngleDegrees) &&
      form.totalAngleDegrees <= 360 &&
      Number.isInteger(form.instanceCount) &&
      form.instanceCount >= 2
      ? ready()
      : blocked(
          "Angle must be within 360° and instances must be a whole number of at least two."
        );
  }
  return (draft as FeatureMirrorForm).seedBodyId
    ? ready()
    : collecting("Select an authored seed body.");
}

function ready(): FeatureEditorValidation {
  return { status: "ready" };
}

function blocked(message: string): FeatureEditorValidation {
  return { status: "blocked", message };
}

function collecting(message: string): FeatureEditorValidation {
  return { status: "collecting", message };
}
