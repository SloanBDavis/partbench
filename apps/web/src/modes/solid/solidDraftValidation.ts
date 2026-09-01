import { CAD_PATTERN_COMMAND_INSTANCE_LIMIT } from "@web-cad/cad-core";
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
  if (kind === "sketch") {
    const form = draft as SketchCreateForm;
    if (!form.name.trim()) {
      return blocked("Enter a sketch name.");
    }
    if (
      form.offset !== undefined &&
      (!Number.isFinite(form.offset) || form.offset === Number.NaN)
    ) {
      return blocked("Offset must be finite.");
    }
    return ready();
  }
  if (kind === "datumPlane") {
    const form = draft as DatumPlaneCreateForm;
    return form.name.trim()
      ? ready()
      : blocked("Enter a datum name.");
  }
  if (kind === "datumAxis") {
    const form = draft as DatumAxisCreateForm;
    return form.name.trim()
      ? ready()
      : blocked("Enter a datum name.");
  }
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
    if (!form.seedBodyId && !form.seedFeatureId) {
      return collecting("Select an exact-ready seed body or a completed hole.");
    }
    if (form.seedBodyId && form.seedFeatureId) {
      return blocked("Pattern seed is a body or a hole feature, not both.");
    }
    return positive(form.spacing) &&
      Number.isInteger(form.instanceCount) &&
      form.instanceCount >= 2 &&
      form.instanceCount <= CAD_PATTERN_COMMAND_INSTANCE_LIMIT
      ? ready()
      : blocked(
          `Spacing must be positive and instances must be a whole number from 2 through ${CAD_PATTERN_COMMAND_INSTANCE_LIMIT}.`
        );
  }
  if (kind === "circularPattern") {
    const form = draft as FeatureCircularPatternForm;
    if (!form.seedBodyId && !form.seedFeatureId) {
      return collecting("Select an exact-ready seed body or a completed hole.");
    }
    if (form.seedBodyId && form.seedFeatureId) {
      return blocked("Pattern seed is a body or a hole feature, not both.");
    }
    return positive(form.totalAngleDegrees) &&
      form.totalAngleDegrees <= 360 &&
      Number.isInteger(form.instanceCount) &&
      form.instanceCount >= 2 &&
      form.instanceCount <= CAD_PATTERN_COMMAND_INSTANCE_LIMIT
      ? ready()
      : blocked(
          `Angle must be within 360° and instances must be a whole number from 2 through ${CAD_PATTERN_COMMAND_INSTANCE_LIMIT}.`
        );
  }
  if (kind === "combine") {
    const form = draft as FeatureCombineForm;
    if (!form.targetBodyId) return collecting("Select a target solid.");
    if (!form.toolBodyId) return collecting("Select a tool solid.");
    if (form.targetBodyId === form.toolBodyId) {
      return blocked("Combine requires two distinct completed solids.");
    }
    return form.mode === "union" || form.mode === "subtract"
      ? ready()
      : blocked("Choose union or subtract.");
  }
  if (kind === "offset") {
    const form = draft as FeatureOffsetForm;
    if (form.sourceKind === "sketchProfile") {
      if (!form.profileSketchId || !form.profileEntityId) {
        return collecting("Select a sketch profile.");
      }
    } else if (!form.face) {
      return collecting("Select a face.");
    }
    return positive(form.distance) &&
      (form.side === "inward" || form.side === "outward")
      ? ready()
      : blocked("Distance must be greater than zero and side must be inward or outward.");
  }
  const mirror = draft as FeatureMirrorForm;
  if (!mirror.seedBodyId) return collecting("Select an exact-ready seed body.");
  return Number.isFinite(mirror.plane.offset ?? 0)
    ? ready()
    : blocked("Mirror plane offset must be finite.");
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
