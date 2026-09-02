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
  buildFeatureAlignOp,
  buildFeatureDraftOp,
  buildFeatureCombineOp,
  buildFeatureOffsetOp,
  buildFeatureUpdateOffsetOp,
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
  readonly ops: readonly CadOp[];
  readonly affectedBodyId?: string;
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

type Feature<K extends CadFeatureSummary["kind"]> = Extract<CadFeatureSummary, { readonly kind: K }>;

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

const EXPECTED_FEATURE_KIND: Partial<
  Record<SolidEditorKind, CadFeatureSummary["kind"]>
> = {
  extrude: "extrude",
  compositeExtrude: "extrude",
  revolve: "revolve",
  compositeRevolve: "revolve",
  sweep: "sweep",
  compositeSweep: "sweep",
  loft: "loft",
  hole: "hole",
  chamfer: "chamfer",
  fillet: "fillet",
  shell: "shell",
  linearPattern: "linearPattern",
  circularPattern: "circularPattern",
  mirror: "mirror",
  combine: "combine",
  offset: "offset",
  align: "align",
  draft: "draft"
};

function unsupported(reason: string): ExactFeaturePreviewUnsupportedPlan {
  return { status: "unsupported", reason };
}

function bodyIdFromOp(op: CadOp): string | undefined {
  return "bodyId" in op && typeof op.bodyId === "string" ? op.bodyId : undefined;
}

function globalSupported(
  op: CadOp,
  fallbackBodyId?: string,
  prefixOps?: readonly CadOp[]
): ExactFeaturePreviewSupportedPlan {
  const bodyId = bodyIdFromOp(op) ?? fallbackBodyId;
  return {
    status: "supported",
    ops: [...(prefixOps ?? []), op],
    ...(bodyId ? { affectedBodyId: bodyId, resultBodyId: bodyId } : {}),
    requiresExactDownstreamCommitPreflight: EXACT_DOWNSTREAM_OPS.has(op.op)
  };
}

function requireSketchEntity(
  context: SolidSelectedSketchEntityContext | undefined,
  expectedKind?: string
): SolidSelectedSketchEntityContext | ExactFeaturePreviewUnsupportedPlan {
  if (!context?.sketchId || !context.entityId) {
    return unsupported("Select a supported sketch entity before creating this feature.");
  }
  if (expectedKind && context.entityKind && context.entityKind !== expectedKind) {
    return unsupported(
      `This feature requires a sketch ${expectedKind}; the selected entity is ${context.entityKind}.`
    );
  }
  return context;
}

function requireExistingFeature<K extends CadFeatureSummary["kind"]>(
  input: ExactFeaturePreviewPlanInput,
  expectedKind: K
): Extract<CadFeatureSummary, { readonly kind: K }> | ExactFeaturePreviewUnsupportedPlan {
  const { existingFeature: feature, submission: { draft } } = input;
  if (!feature) {
    return unsupported("This preview is an edit, but its current feature is unavailable.");
  }
  if (feature.kind !== expectedKind) {
    return unsupported(
      `The editor is for ${expectedKind}, but the current feature is ${feature.kind}.`
    );
  }
  if ("id" in draft && typeof draft.id === "string" && draft.id !== feature.id) {
    return unsupported("The editor draft targets a different feature than the current document.");
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

function sameFields<D extends object, F extends object, K extends keyof D & keyof F>(draft: D, feature: F, ...keys: readonly K[]): boolean {
  return keys.every((key) => (draft[key] as unknown) === feature[key]);
}

function samePatternSeed(
  draft: { readonly seedBodyId: string; readonly seedFeatureId: string },
  feature: { readonly seedBodyId?: string; readonly seedFeatureId?: string }
): boolean {
  return (
    (draft.seedBodyId || undefined) === feature.seedBodyId &&
    (draft.seedFeatureId || undefined) === feature.seedFeatureId
  );
}

export function planExactFeaturePreview(
  input: ExactFeaturePreviewPlanInput
): ExactFeaturePreviewPlan {
  const { request, submission, existingFeature, selectedSketchEntityContext: selectedContext } = input;
  const { kind, draft } = submission;
  if (request.kind !== kind) {
    return unsupported(
      "The editor request and submitted draft describe different feature kinds."
    );
  }

  const expectedKind = EXPECTED_FEATURE_KIND[kind];
  if (!expectedKind) {
    return unsupported(
      "Preview is not supported for primitives, sketches, transforms, imports, or lifecycle operations."
    );
  }

  const supported = (
    op: CadOp,
    fallbackBodyId?: string,
    prefixOps = request.pendingCurrentExactPromotionOps
  ) => globalSupported(op, fallbackBodyId, prefixOps);

  const edit = (request.mode ?? (existingFeature ? "edit" : "create")) === "edit";
  if (edit) {
    if (kind === "sweep") {
      return unsupported("Sweep updates require the existing composite sweep editor.");
    }
    const current = requireExistingFeature(input, expectedKind);
    if (isUnsupported(current)) return current;

    switch (kind) {
      case "extrude":
      case "compositeExtrude": {
        const feature = current as Feature<"extrude">;
        if (
          !sameFields(
            draft,
            feature,
            "operationMode",
            "targetBodyId",
            "targetTopologyAnchorId"
          )
        ) {
          return unsupported(
            "The V17 command matrix does not support changing an extrude boolean target."
          );
        }
        return supported(
          kind === "compositeExtrude"
            ? buildFeatureUpdateCompositeExtrudeOp(
                feature.id,
                draft.profile,
                draft.depth,
                draft.side
              )
            : buildFeatureUpdateExtrudeOp(feature.id, draft.depth, draft.side),
          feature.bodyId
        );
      }
      case "revolve":
      case "compositeRevolve": {
        const feature = current as Feature<"revolve">;
        if (draft.axisEntityId !== feature.axis.entityId) {
          return unsupported(
            "The V17 command matrix does not support changing a revolve axis."
          );
        }
        return supported(
          kind === "compositeRevolve"
            ? buildFeatureUpdateCompositeRevolveOp(
                feature.id,
                draft.profile,
                draft.angleDegrees
              )
            : buildFeatureUpdateRevolveOp(feature.id, draft.angleDegrees),
          feature.bodyId
        );
      }
      case "hole": {
        const feature = current as Feature<"hole">;
        const targetChanged = !sameFields(
          draft,
          feature,
          "targetBodyId",
          "targetTopologyAnchorId"
        );
        return supported(
          buildFeatureUpdateHoleOp(
            feature.id,
            draft.depthMode,
            draft.depthMode === "blind" ? draft.depth : undefined,
            draft.direction,
            targetChanged
              ? {
                  targetBodyId: draft.targetBodyId,
                  targetTopologyAnchorId: draft.targetTopologyAnchorId
                }
              : undefined
          ),
          feature.bodyId
        );
      }
      case "chamfer":
      case "fillet": {
        const feature = current as Feature<"chamfer" | "fillet">;
        return supported(
          kind === "chamfer"
            ? buildFeatureUpdateChamferOp(feature.id, draft.distance)
            : buildFeatureUpdateFilletOp(feature.id, draft.radius),
          feature.bodyId
        );
      }
      case "linearPattern":
      case "circularPattern": {
        const feature = current as Feature<"linearPattern" | "circularPattern">;
        if (!samePatternSeed(draft, feature)) {
          return unsupported(
            "The pattern update command does not change its seed body or hole."
          );
        }
        return supported(
          kind === "linearPattern"
            ? buildFeatureUpdateLinearPatternOp(feature.id, {
                direction: draft.direction,
                spacing: draft.spacing,
                instanceCount: draft.instanceCount
              })
            : buildFeatureUpdateCircularPatternOp(feature.id, {
                rotationAxis: draft.rotationAxis,
                totalAngleDegrees: draft.totalAngleDegrees,
                instanceCount: draft.instanceCount
              }),
          feature.bodyId
        );
      }
      case "mirror": {
        const feature = current as Feature<"mirror">;
        if (!sameFields(draft, feature, "seedBodyId")) {
          return unsupported(
            "The mirror update command does not change its seed body."
          );
        }
        return supported(
          buildFeatureUpdateMirrorOp(feature.id, {
            plane: draft.plane,
            includeOriginal: draft.includeOriginal
          }),
          feature.bodyId
        );
      }
      case "shell": {
        const feature = current as Feature<"shell">;
        if (!sameFields(draft, feature, "targetBodyId")) {
          return unsupported(
            "The shell update command does not change its target body."
          );
        }
        return supported(
          buildFeatureUpdateShellOp(feature.id, {
            wallThickness: draft.wallThickness,
            openFaceRefs: draft.openFaceRefs
          }),
          feature.bodyId
        );
      }
      case "compositeSweep": {
        const feature = current as Feature<"sweep">;
        return supported(
          buildFeatureUpdateCompositeSweepOp(
            feature.id,
            draft.profile,
            draft.path
          ),
          feature.bodyId
        );
      }
      case "loft": {
        const feature = current as Feature<"loft">;
        return supported(
          buildFeatureUpdateLoftOp(feature.id, draft.sections),
          feature.bodyId
        );
      }
      case "combine":
        return unsupported(
          "Combine features are create-only; delete and recreate to change inputs."
        );
      case "align":
        return unsupported(
          "Align features are create-only; delete and recreate to change inputs."
        );
      case "draft":
        return unsupported(
          "Draft features are create-only; delete and recreate to change inputs."
        );
      case "offset": {
        const feature = current as Feature<"offset">;
        return supported(
          buildFeatureUpdateOffsetOp(feature.id, {
            distance: draft.distance,
            side: draft.side
          }),
          feature.bodyId
        );
      }
    }
  }

  switch (kind) {
    case "extrude": {
      const context = requireSketchEntity(selectedContext);
      if (isUnsupported(context)) return context;
      return supported(
        buildFeatureExtrudeOp(context.sketchId, context.entityId, draft)
      );
    }
    case "compositeExtrude":
      return supported(buildFeatureCompositeExtrudeOp(draft));
    case "revolve": {
      const context = requireSketchEntity(selectedContext);
      if (isUnsupported(context)) return context;
      return supported(
        buildFeatureRevolveOp(context.sketchId, context.entityId, draft)
      );
    }
    case "compositeRevolve":
      return supported(buildFeatureCompositeRevolveOp(draft));
    case "hole": {
      let sketchId = draft.sketchId;
      let circleEntityId = draft.circleEntityId;
      if (!sketchId || !circleEntityId) {
        const context = requireSketchEntity(selectedContext, "circle");
        if (isUnsupported(context)) return context;
        sketchId = context.sketchId;
        circleEntityId = context.entityId;
      }
      return supported(buildFeatureHoleOp(sketchId, circleEntityId, draft));
    }
    case "chamfer":
      return supported(buildFeatureChamferOp(draft));
    case "fillet":
      return supported(buildFeatureFilletOp(draft));
    case "linearPattern":
      return supported(buildFeatureLinearPatternOp(draft));
    case "circularPattern":
      return supported(buildFeatureCircularPatternOp(draft));
    case "mirror":
      return supported(buildFeatureMirrorOp(draft));
    case "combine":
      return supported(buildFeatureCombineOp(draft));
    case "offset":
      return supported(buildFeatureOffsetOp(draft));
    case "align":
      return supported(buildFeatureAlignOp(draft));
    case "draft":
      return supported(buildFeatureDraftOp(draft));
    case "shell":
      return supported(buildFeatureShellOp(draft));
    case "sweep": {
      const context = requireSketchEntity(selectedContext);
      if (isUnsupported(context)) return context;
      return supported(
        buildFeatureSweepOp(context.sketchId, context.entityId, draft)
      );
    }
    case "compositeSweep":
      return supported(buildFeatureCompositeSweepOp(draft));
    case "loft":
      return supported(buildFeatureLoftOp(draft));
  }

  return unsupported("This feature row is not supported by the V22 preview matrix.");
}
