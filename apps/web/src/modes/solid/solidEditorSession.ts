import type { FeatureEditorValidation } from "../../editors/featureEditorState";
import type {
  SolidChoice,
  SolidCollectorRequest,
  SolidDraft,
  SolidEditorChoices,
  SolidEditorKind,
  SolidEditorSubmission
} from "./solidEditorTypes";
import type {
  FeatureCompositeExtrudeForm,
  FeatureCompositeRevolveForm,
  FeatureCompositeSweepForm,
  FeatureEdgeFinishForm,
  FeatureExtrudeForm,
  FeatureHoleForm,
  FeatureLinearPatternForm,
  FeatureCircularPatternForm,
  FeatureLoftForm,
  FeatureMirrorForm,
  FeatureCombineForm,
  FeatureOffsetForm,
  FeatureRevolveForm,
  FeatureShellForm,
  FeatureSweepForm
} from "../../cadCommands";

export interface SolidApplyGate {
  pending: boolean;
}

export async function applySolidDraftOnce(
  gate: SolidApplyGate,
  submission: SolidEditorSubmission,
  validation: FeatureEditorValidation,
  dirty: boolean,
  onApply?: (submission: SolidEditorSubmission) => void | Promise<void>
): Promise<boolean> {
  if (gate.pending || !dirty || validation.status !== "ready" || !onApply) {
    return false;
  }

  gate.pending = true;
  try {
    await onApply(submission);
    return true;
  } finally {
    gate.pending = false;
  }
}

export function cancelSolidDraft<Draft>(
  initialDraft: Draft,
  onCancel?: () => void
): Draft {
  onCancel?.();
  return initialDraft;
}

export function applySolidCollectorSelection(
  kind: SolidEditorKind,
  draft: SolidDraft,
  choices: SolidEditorChoices | undefined,
  collector: SolidCollectorRequest["collector"],
  choiceKey: string | undefined
): SolidDraft {
  if (!choiceKey) return draft;

  if (collector === "targetBody") {
    const extrude = draft as FeatureExtrudeForm;
    const choice = findChoice(
      kind === "extrude" || kind === "compositeExtrude"
        ? extrude.operationMode === "add"
          ? (choices?.addTargetBodies ?? choices?.targetBodies)
          : extrude.operationMode === "cut"
            ? (choices?.cutTargetBodies ?? choices?.targetBodies)
            : []
        : choices?.targetBodies,
      choiceKey
    );
    if (!choice) return draft;
    if (kind === "hole") {
      return {
        ...(draft as FeatureHoleForm),
        targetBodyId: choice.value,
        targetTopologyAnchorId: choice.targetTopologyAnchorId
      };
    }
    if (kind === "shell") {
      return {
        ...(draft as FeatureShellForm),
        targetBodyId: choice.value,
        openFaceRefs: []
      };
    }
    if (kind === "extrude" || kind === "compositeExtrude") {
      return {
        ...(draft as FeatureExtrudeForm | FeatureCompositeExtrudeForm),
        targetBodyId: choice.value,
        targetTopologyAnchorId: choice.targetTopologyAnchorId
      };
    }
    if (kind === "combine") {
      return {
        ...(draft as FeatureCombineForm),
        targetBodyId: choice.value
      };
    }
    return draft;
  }

  if (collector === "toolBody") {
    const value = findChoice(
      choices?.toolBodies ?? choices?.targetBodies,
      choiceKey
    )?.value;
    if (!value || kind !== "combine") return draft;
    return { ...(draft as FeatureCombineForm), toolBodyId: value };
  }

  if (collector === "seedBody") {
    const value = findChoice(choices?.seedBodies, choiceKey)?.value;
    if (!value) return draft;
    if (kind === "linearPattern")
      return {
        ...(draft as FeatureLinearPatternForm),
        seedBodyId: value,
        seedFeatureId: ""
      };
    if (kind === "circularPattern")
      return {
        ...(draft as FeatureCircularPatternForm),
        seedBodyId: value,
        seedFeatureId: ""
      };
    if (kind === "mirror")
      return { ...(draft as FeatureMirrorForm), seedBodyId: value };
    return draft;
  }

  if (collector === "seedFeature") {
    const value = findChoice(choices?.seedFeatures, choiceKey)?.value;
    if (!value) return draft;
    if (kind === "linearPattern")
      return {
        ...(draft as FeatureLinearPatternForm),
        seedFeatureId: value,
        seedBodyId: ""
      };
    if (kind === "circularPattern")
      return {
        ...(draft as FeatureCircularPatternForm),
        seedFeatureId: value,
        seedBodyId: ""
      };
    return draft;
  }

  if (collector === "axis") {
    const value = findChoice(choices?.axes, choiceKey)?.value;
    return value && (kind === "revolve" || kind === "compositeRevolve")
      ? {
          ...(draft as FeatureRevolveForm | FeatureCompositeRevolveForm),
          axisEntityId: value
        }
      : draft;
  }

  if (collector === "profile") {
    const value = findChoice(choices?.profiles, choiceKey)?.value;
    if (!value) return draft;
    if (kind === "compositeExtrude")
      return { ...(draft as FeatureCompositeExtrudeForm), profile: value };
    if (kind === "compositeRevolve")
      return { ...(draft as FeatureCompositeRevolveForm), profile: value };
    if (kind === "compositeSweep" && value.kind === "entity")
      return { ...(draft as FeatureCompositeSweepForm), profile: value };
    if (kind === "offset" && value.kind === "entity") {
      return {
        ...(draft as FeatureOffsetForm),
        sourceKind: "sketchProfile",
        profileSketchId: value.sketchId,
        profileEntityId: value.entityId,
        face: undefined
      };
    }
    return draft;
  }

  if (collector === "path") {
    if (kind === "compositeSweep") {
      const value = findChoice(choices?.paths, choiceKey)?.value;
      return value
        ? { ...(draft as FeatureCompositeSweepForm), path: value }
        : draft;
    }
    if (kind === "sweep") {
      const value = findChoice(choices?.sweepPaths, choiceKey)?.value;
      return value ? { ...(draft as FeatureSweepForm), ...value } : draft;
    }
    return draft;
  }

  if (collector === "sections" && kind === "loft") {
    const value = findChoice(choices?.loftSections, choiceKey)?.value;
    if (!value) return draft;
    const current = draft as FeatureLoftForm;
    return current.sections.some(
      (section) => stableSerialize(section) === stableSerialize(value)
    )
      ? draft
      : { ...current, sections: [...current.sections, value] };
  }

  if (collector === "edge" && (kind === "fillet" || kind === "chamfer")) {
    const value = findChoice(choices?.edges, choiceKey)?.value;
    return value
      ? {
          ...(draft as FeatureEdgeFinishForm),
          ...value,
          edgeStableId: value.edgeStableId,
          namedReference: value.namedReference,
          topologyAnchorId: value.topologyAnchorId,
          topologyAnchorProof: value.topologyAnchorProof
        }
      : draft;
  }

  if (collector === "openFaces" && kind === "offset") {
    const choice = findChoice(choices?.openFaces, choiceKey);
    if (!choice) return draft;
    return {
      ...(draft as FeatureOffsetForm),
      sourceKind: "face",
      face: choice.value,
      profileSketchId: "",
      profileEntityId: ""
    };
  }

  if (collector === "openFaces" && kind === "shell") {
    const choice = findChoice(choices?.openFaces, choiceKey);
    if (
      !choice ||
      (choice.targetBodyId &&
        choice.targetBodyId !== (draft as FeatureShellForm).targetBodyId)
    )
      return draft;
    const value = choice.value;
    const current = draft as FeatureShellForm;
    return current.openFaceRefs.some(
      (face) => stableSerialize(face) === stableSerialize(value)
    )
      ? draft
      : { ...current, openFaceRefs: [...current.openFaceRefs, value] };
  }

  if (collector === "direction" && kind === "linearPattern") {
    const value = findChoice(choices?.directions, choiceKey)?.value;
    return value
      ? { ...(draft as FeatureLinearPatternForm), direction: value }
      : draft;
  }

  if (collector === "rotationAxis" && kind === "circularPattern") {
    const value = findChoice(choices?.rotationAxes, choiceKey)?.value;
    return value
      ? { ...(draft as FeatureCircularPatternForm), rotationAxis: value }
      : draft;
  }

  if (collector === "mirrorPlane" && kind === "mirror") {
    const value = findChoice(choices?.mirrorPlanes, choiceKey)?.value;
    return value
      ? {
          ...(draft as FeatureMirrorForm),
          plane: {
            ...value,
            ...((draft as FeatureMirrorForm).plane.offset !== undefined
              ? { offset: (draft as FeatureMirrorForm).plane.offset }
              : {})
          }
        }
      : draft;
  }

  return draft;
}

function findChoice<Value>(
  choices: readonly SolidChoice<Value>[] | undefined,
  key: string
): SolidChoice<Value> | undefined {
  return choices?.find((choice) => choice.key === key && !choice.disabled);
}

function stableSerialize(value: unknown): string {
  return JSON.stringify(value);
}

/** Two-click delete arming: first click arms, second fires and resets. */
export function advanceDeleteConfirmation(
  armed: boolean,
  options: { readonly blocked?: boolean } = {}
): { readonly nextArmed: boolean; readonly shouldDelete: boolean } {
  if (options.blocked) {
    return { nextArmed: armed, shouldDelete: false };
  }
  if (!armed) {
    return { nextArmed: true, shouldDelete: false };
  }
  return { nextArmed: false, shouldDelete: true };
}
