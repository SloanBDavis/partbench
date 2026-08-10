import type { CadFeatureSummary, CadOp } from "@web-cad/cad-protocol";

import {
  buildFeatureChamferOp,
  buildFeatureCompositeExtrudeOp,
  buildFeatureCompositeRevolveOp,
  buildFeatureCompositeSweepOp,
  buildFeatureCircularPatternOp,
  buildFeatureExtrudeOp,
  buildFeatureFilletOp,
  buildFeatureHoleOp,
  buildFeatureLinearPatternOp,
  buildFeatureLoftOp,
  buildFeatureMirrorOp,
  buildFeatureRevolveOp,
  buildFeatureShellOp,
  buildFeatureSweepOp,
  buildFeatureUpdateChamferOp,
  buildFeatureUpdateCompositeExtrudeOp,
  buildFeatureUpdateCompositeRevolveOp,
  buildFeatureUpdateCompositeSweepOp,
  buildFeatureUpdateCircularPatternOp,
  buildFeatureUpdateExtrudeOp,
  buildFeatureUpdateFilletOp,
  buildFeatureUpdateHoleOp,
  buildFeatureUpdateLinearPatternOp,
  buildFeatureUpdateLoftOp,
  buildFeatureUpdateMirrorOp,
  buildFeatureUpdateRevolveOp,
  buildFeatureUpdateShellOp
} from "../../cadCommands";
import type {
  SolidEditorKind,
  SolidEditorRequest,
  SolidEditorSubmission
} from "./solidEditorTypes";

/**
 * The small portion of the current sketch selection that a legacy
 * sketch-entity feature builder needs.  It intentionally contains no render
 * IDs or geometry handles.
 */
export interface SolidSelectedSketchEntityContext {
  readonly sketchId: string;
  readonly entityId: string;
  readonly entityKind?: string;
}

export interface ExactFeaturePreviewPlanInput {
  readonly request: SolidEditorRequest;
  readonly submission: SolidEditorSubmission;
  readonly existingFeature?: CadFeatureSummary;
  readonly selectedSketchEntityContext?: SolidSelectedSketchEntityContext;
}

export interface ExactFeaturePreviewSupportedPlan {
  readonly status: "supported";
  /** The one immutable operation batch shared by preview and Apply. */
  readonly ops: readonly CadOp[];
  /** The body whose exact result is affected by this operation, when known. */
  readonly affectedBodyId?: string;
  /** Alias kept explicit for preview consumers that call this the result body. */
  readonly resultBodyId?: string;
  readonly requiresExactDownstreamCommitPreflight: boolean;
}

export interface ExactFeaturePreviewUnsupportedPlan {
  readonly status: "unsupported";
  readonly reason: string;
}

export type ExactFeaturePreviewPlan =
  | ExactFeaturePreviewSupportedPlan
  | ExactFeaturePreviewUnsupportedPlan;

const EXACT_DOWNSTREAM_OPS = new Set<CadOp["op"]>([
  "feature.hole",
  "feature.linearPattern",
  "feature.circularPattern",
  "feature.mirror",
  "feature.shell",
  "feature.updateHole",
  "feature.updateLinearPattern",
  "feature.updateCircularPattern",
  "feature.updateMirror",
  "feature.updateShell"
]);

function unsupported(reason: string): ExactFeaturePreviewUnsupportedPlan {
  return { status: "unsupported", reason };
}

function expectedFeatureKind(
  kind: SolidEditorKind
): CadFeatureSummary["kind"] | undefined {
  switch (kind) {
    case "extrude":
    case "compositeExtrude":
      return "extrude";
    case "revolve":
    case "compositeRevolve":
      return "revolve";
    case "sweep":
    case "compositeSweep":
      return "sweep";
    case "loft":
      return "loft";
    case "hole":
    case "chamfer":
    case "fillet":
    case "shell":
    case "linearPattern":
    case "circularPattern":
    case "mirror":
      return kind;
    default:
      return undefined;
  }
}

function bodyIdFromOp(op: CadOp): string | undefined {
  return "bodyId" in op && typeof op.bodyId === "string"
    ? op.bodyId
    : undefined;
}

function supported(
  op: CadOp,
  fallbackBodyId?: string
): ExactFeaturePreviewSupportedPlan {
  const bodyId = bodyIdFromOp(op) ?? fallbackBodyId;
  return {
    status: "supported",
    ops: [op],
    ...(bodyId ? { affectedBodyId: bodyId, resultBodyId: bodyId } : {}),
    requiresExactDownstreamCommitPreflight: EXACT_DOWNSTREAM_OPS.has(op.op)
  };
}

function requireSketchEntity(
  context: SolidSelectedSketchEntityContext | undefined,
  expectedKind?: string
): SolidSelectedSketchEntityContext | ExactFeaturePreviewUnsupportedPlan {
  if (!context?.sketchId || !context.entityId) {
    return unsupported(
      "Select a supported sketch entity before creating this feature."
    );
  }
  if (
    expectedKind &&
    context.entityKind &&
    context.entityKind !== expectedKind
  ) {
    return unsupported(
      `This feature requires a sketch ${expectedKind}; the selected entity is ${context.entityKind}.`
    );
  }
  return context;
}

function requireExistingFeature<K extends CadFeatureSummary["kind"]>(
  input: ExactFeaturePreviewPlanInput,
  expectedKind: K
):
  | Extract<CadFeatureSummary, { readonly kind: K }>
  | ExactFeaturePreviewUnsupportedPlan {
  const feature = input.existingFeature;
  if (!feature) {
    return unsupported(
      "This preview is an edit, but its current feature is unavailable."
    );
  }
  if (feature.kind !== expectedKind) {
    return unsupported(
      `The editor is for ${expectedKind}, but the current feature is ${feature.kind}.`
    );
  }

  const draft = input.submission.draft;
  if (
    "id" in draft &&
    typeof draft.id === "string" &&
    draft.id !== feature.id
  ) {
    return unsupported(
      "The editor draft targets a different feature than the current document."
    );
  }
  if (
    "bodyId" in draft &&
    typeof draft.bodyId === "string" &&
    draft.bodyId !== feature.bodyId
  ) {
    return unsupported(
      "The editor draft targets a different result body than the current document."
    );
  }
  return feature as Extract<CadFeatureSummary, { readonly kind: K }>;
}

function isUnsupported(
  value: unknown
): value is ExactFeaturePreviewUnsupportedPlan {
  return (
    typeof value === "object" &&
    value !== null &&
    "status" in value &&
    value.status === "unsupported"
  );
}

function sameExtrudeTarget(
  draft: Extract<
    SolidEditorSubmission["draft"],
    { readonly operationMode: string }
  >,
  feature: Extract<CadFeatureSummary, { readonly kind: "extrude" }>
): boolean {
  return (
    draft.operationMode === feature.operationMode &&
    draft.targetBodyId === feature.targetBodyId &&
    draft.targetTopologyAnchorId === feature.targetTopologyAnchorId
  );
}

function sameRevolveAxis(
  draft: Extract<
    SolidEditorSubmission["draft"],
    { readonly axisEntityId: string }
  >,
  feature: Extract<CadFeatureSummary, { readonly kind: "revolve" }>
): boolean {
  return draft.axisEntityId === feature.axis.entityId;
}

function sameSeedBody(
  draft: Extract<
    SolidEditorSubmission["draft"],
    { readonly seedBodyId: string }
  >,
  feature:
    | Extract<CadFeatureSummary, { readonly kind: "linearPattern" }>
    | Extract<CadFeatureSummary, { readonly kind: "mirror" }>
): boolean {
  return draft.seedBodyId === feature.seedBodyId;
}

function sameShellTarget(
  draft: Extract<
    SolidEditorSubmission["draft"],
    { readonly targetBodyId: string }
  >,
  feature: Extract<CadFeatureSummary, { readonly kind: "shell" }>
): boolean {
  return draft.targetBodyId === feature.targetBodyId;
}

/**
 * Builds the single existing CADOps batch used by both transient preview and
 * the eventual Apply.  This function is intentionally pure: it does not
 * validate or execute geometry and never allocates IDs.
 */
export function planExactFeaturePreview(
  input: ExactFeaturePreviewPlanInput
): ExactFeaturePreviewPlan {
  if (input.request.kind !== input.submission.kind) {
    return unsupported(
      "The editor request and submitted draft describe different feature kinds."
    );
  }

  const kind = input.submission.kind;
  if (!expectedFeatureKind(kind)) {
    return unsupported(
      "Preview is not supported for primitives, sketches, transforms, imports, or lifecycle operations."
    );
  }

  const edit =
    (input.request.mode ?? (input.existingFeature ? "edit" : "create")) ===
    "edit";
  if (edit) {
    switch (input.submission.kind) {
      case "extrude": {
        const feature = requireExistingFeature(input, "extrude");
        if (isUnsupported(feature)) return feature;
        if (!sameExtrudeTarget(input.submission.draft, feature)) {
          return unsupported(
            "The V17 command matrix does not support changing an extrude boolean target."
          );
        }
        return supported(
          buildFeatureUpdateExtrudeOp(
            feature.id,
            input.submission.draft.depth,
            input.submission.draft.side
          ),
          feature.bodyId
        );
      }
      case "compositeExtrude": {
        const feature = requireExistingFeature(input, "extrude");
        if (isUnsupported(feature)) return feature;
        if (!sameExtrudeTarget(input.submission.draft, feature)) {
          return unsupported(
            "The V17 command matrix does not support changing an extrude boolean target."
          );
        }
        return supported(
          buildFeatureUpdateCompositeExtrudeOp(
            feature.id,
            input.submission.draft.profile,
            input.submission.draft.depth,
            input.submission.draft.side
          ),
          feature.bodyId
        );
      }
      case "revolve": {
        const feature = requireExistingFeature(input, "revolve");
        if (isUnsupported(feature)) return feature;
        if (!sameRevolveAxis(input.submission.draft, feature)) {
          return unsupported(
            "The V17 command matrix does not support changing a revolve axis."
          );
        }
        return supported(
          buildFeatureUpdateRevolveOp(
            feature.id,
            input.submission.draft.angleDegrees
          ),
          feature.bodyId
        );
      }
      case "compositeRevolve": {
        const feature = requireExistingFeature(input, "revolve");
        if (isUnsupported(feature)) return feature;
        if (!sameRevolveAxis(input.submission.draft, feature)) {
          return unsupported(
            "The V17 command matrix does not support changing a revolve axis."
          );
        }
        return supported(
          buildFeatureUpdateCompositeRevolveOp(
            feature.id,
            input.submission.draft.profile,
            input.submission.draft.angleDegrees
          ),
          feature.bodyId
        );
      }
      case "hole": {
        const feature = requireExistingFeature(input, "hole");
        if (isUnsupported(feature)) return feature;
        const targetChanged =
          input.submission.draft.targetBodyId !== feature.targetBodyId ||
          input.submission.draft.targetTopologyAnchorId !==
            feature.targetTopologyAnchorId;
        return supported(
          buildFeatureUpdateHoleOp(
            feature.id,
            input.submission.draft.depthMode,
            input.submission.draft.depthMode === "blind"
              ? input.submission.draft.depth
              : undefined,
            input.submission.draft.direction,
            targetChanged
              ? {
                  targetBodyId: input.submission.draft.targetBodyId,
                  targetTopologyAnchorId:
                    input.submission.draft.targetTopologyAnchorId
                }
              : undefined
          ),
          feature.bodyId
        );
      }
      case "chamfer": {
        const feature = requireExistingFeature(input, "chamfer");
        if (isUnsupported(feature)) return feature;
        return supported(
          buildFeatureUpdateChamferOp(
            feature.id,
            input.submission.draft.distance
          ),
          feature.bodyId
        );
      }
      case "fillet": {
        const feature = requireExistingFeature(input, "fillet");
        if (isUnsupported(feature)) return feature;
        return supported(
          buildFeatureUpdateFilletOp(feature.id, input.submission.draft.radius),
          feature.bodyId
        );
      }
      case "linearPattern": {
        const feature = requireExistingFeature(input, "linearPattern");
        if (isUnsupported(feature)) return feature;
        if (!sameSeedBody(input.submission.draft, feature)) {
          return unsupported(
            "The pattern update command does not change its seed body."
          );
        }
        return supported(
          buildFeatureUpdateLinearPatternOp(feature.id, {
            direction: input.submission.draft.direction,
            spacing: input.submission.draft.spacing,
            instanceCount: input.submission.draft.instanceCount
          }),
          feature.bodyId
        );
      }
      case "circularPattern": {
        const feature = requireExistingFeature(input, "circularPattern");
        if (isUnsupported(feature)) return feature;
        if (input.submission.draft.seedBodyId !== feature.seedBodyId) {
          return unsupported(
            "The pattern update command does not change its seed body."
          );
        }
        return supported(
          buildFeatureUpdateCircularPatternOp(feature.id, {
            rotationAxis: input.submission.draft.rotationAxis,
            totalAngleDegrees: input.submission.draft.totalAngleDegrees,
            instanceCount: input.submission.draft.instanceCount
          }),
          feature.bodyId
        );
      }
      case "mirror": {
        const feature = requireExistingFeature(input, "mirror");
        if (isUnsupported(feature)) return feature;
        if (!sameSeedBody(input.submission.draft, feature)) {
          return unsupported(
            "The mirror update command does not change its seed body."
          );
        }
        return supported(
          buildFeatureUpdateMirrorOp(feature.id, {
            plane: input.submission.draft.plane,
            includeOriginal: input.submission.draft.includeOriginal
          }),
          feature.bodyId
        );
      }
      case "shell": {
        const feature = requireExistingFeature(input, "shell");
        if (isUnsupported(feature)) return feature;
        if (!sameShellTarget(input.submission.draft, feature)) {
          return unsupported(
            "The shell update command does not change its target body."
          );
        }
        return supported(
          buildFeatureUpdateShellOp(feature.id, {
            wallThickness: input.submission.draft.wallThickness,
            openFaceRefs: input.submission.draft.openFaceRefs
          }),
          feature.bodyId
        );
      }
      case "compositeSweep": {
        const feature = requireExistingFeature(input, "sweep");
        if (isUnsupported(feature)) return feature;
        return supported(
          buildFeatureUpdateCompositeSweepOp(
            feature.id,
            input.submission.draft.profile,
            input.submission.draft.path
          ),
          feature.bodyId
        );
      }
      case "sweep":
        return unsupported(
          "Sweep updates require the existing composite sweep editor."
        );
      case "loft": {
        const feature = requireExistingFeature(input, "loft");
        if (isUnsupported(feature)) return feature;
        return supported(
          buildFeatureUpdateLoftOp(feature.id, input.submission.draft.sections),
          feature.bodyId
        );
      }
    }
  }

  switch (input.submission.kind) {
    case "extrude": {
      const context = requireSketchEntity(input.selectedSketchEntityContext);
      if (isUnsupported(context)) return context;
      return supported(
        buildFeatureExtrudeOp(
          context.sketchId,
          context.entityId,
          input.submission.draft
        )
      );
    }
    case "compositeExtrude":
      return supported(buildFeatureCompositeExtrudeOp(input.submission.draft));
    case "revolve": {
      const context = requireSketchEntity(input.selectedSketchEntityContext);
      if (isUnsupported(context)) return context;
      return supported(
        buildFeatureRevolveOp(
          context.sketchId,
          context.entityId,
          input.submission.draft
        )
      );
    }
    case "compositeRevolve":
      return supported(buildFeatureCompositeRevolveOp(input.submission.draft));
    case "hole": {
      let sketchId = input.submission.draft.sketchId;
      let circleEntityId = input.submission.draft.circleEntityId;
      if (!sketchId || !circleEntityId) {
        const context = requireSketchEntity(
          input.selectedSketchEntityContext,
          "circle"
        );
        if (isUnsupported(context)) return context;
        sketchId = context.sketchId;
        circleEntityId = context.entityId;
      }
      return supported(
        buildFeatureHoleOp(sketchId, circleEntityId, input.submission.draft)
      );
    }
    case "chamfer":
      return supported(buildFeatureChamferOp(input.submission.draft));
    case "fillet":
      return supported(buildFeatureFilletOp(input.submission.draft));
    case "linearPattern":
      return supported(buildFeatureLinearPatternOp(input.submission.draft));
    case "circularPattern":
      return supported(buildFeatureCircularPatternOp(input.submission.draft));
    case "mirror":
      return supported(buildFeatureMirrorOp(input.submission.draft));
    case "shell":
      return supported(buildFeatureShellOp(input.submission.draft));
    case "sweep": {
      const context = requireSketchEntity(input.selectedSketchEntityContext);
      if (isUnsupported(context)) return context;
      return supported(
        buildFeatureSweepOp(
          context.sketchId,
          context.entityId,
          input.submission.draft
        )
      );
    }
    case "compositeSweep":
      return supported(buildFeatureCompositeSweepOp(input.submission.draft));
    case "loft":
      return supported(buildFeatureLoftOp(input.submission.draft));
  }

  return unsupported(
    "This feature row is not supported by the V22 preview matrix."
  );
}
