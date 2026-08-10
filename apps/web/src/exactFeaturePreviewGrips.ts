import type {
  CadBodySource,
  CadFeatureSummary,
  ParameterId
} from "@web-cad/cad-protocol";
import { CAD_PATTERN_COMMAND_INSTANCE_LIMIT } from "@web-cad/cad-core";
import type {
  ViewportFeatureGripDescriptor
} from "./components/ViewportFeatureGrips";
import type { SolidEditorSubmission } from "./modes/solid/solidEditorTypes";

/** The only scalar fields that V22 permits to be manipulated as grips. */
export type ExactFeaturePreviewGripField =
  | "depth"
  | "angle"
  | "blindDepth"
  | "distance"
  | "radius"
  | "spacing"
  | "totalAngle"
  | "planeOffset"
  | "wallThickness";

/** Pattern counts are typed in the adjacent value editor, never dragged. */
export type ExactFeaturePreviewGripValueEditor = "count";

export type ExactFeaturePreviewAvailability = "must" | "none";

export interface ExactFeaturePreviewGripPolicy {
  readonly create: ExactFeaturePreviewAvailability;
  readonly update: ExactFeaturePreviewAvailability;
  readonly grips: readonly ExactFeaturePreviewGripField[];
  readonly valueEditors: readonly ExactFeaturePreviewGripValueEditor[];
}

export type ExactFeaturePreviewGripFeatureFamily = CadFeatureSummary["kind"];
export type ExactFeaturePreviewGripSourceType = CadBodySource["type"];

/**
 * Gate E's frozen preview/grip matrix, keyed by the existing feature-family
 * discriminant.  `satisfies` makes adding a source family to cad-protocol a
 * compile-time review point rather than an implicit preview promise.
 */
export const EXACT_FEATURE_PREVIEW_GRIP_POLICY = {
  primitive: { create: "none", update: "none", grips: [], valueEditors: [] },
  extrude: {
    create: "must",
    update: "must",
    grips: ["depth"],
    valueEditors: []
  },
  revolve: {
    create: "must",
    update: "must",
    grips: ["angle"],
    valueEditors: []
  },
  hole: {
    create: "must",
    update: "must",
    grips: ["blindDepth"],
    valueEditors: []
  },
  chamfer: {
    create: "must",
    update: "must",
    grips: ["distance"],
    valueEditors: []
  },
  fillet: {
    create: "must",
    update: "must",
    grips: ["radius"],
    valueEditors: []
  },
  importedBody: {
    create: "none",
    update: "none",
    grips: [],
    valueEditors: []
  },
  linearPattern: {
    create: "must",
    update: "must",
    grips: ["spacing"],
    valueEditors: ["count"]
  },
  circularPattern: {
    create: "must",
    update: "must",
    grips: ["totalAngle"],
    valueEditors: ["count"]
  },
  mirror: {
    create: "must",
    update: "must",
    grips: ["planeOffset"],
    valueEditors: []
  },
  shell: {
    create: "must",
    update: "must",
    grips: ["wallThickness"],
    valueEditors: []
  },
  sweep: { create: "must", update: "must", grips: [], valueEditors: [] },
  loft: { create: "must", update: "must", grips: [], valueEditors: [] }
} as const satisfies Record<
  ExactFeaturePreviewGripFeatureFamily,
  ExactFeaturePreviewGripPolicy
>;

/**
 * The existing body-source discriminants map one-to-one to feature families.
 * Keeping this seam typed prevents the UI from inventing a second source
 * universe for preview behavior.
 */
export const EXACT_FEATURE_PREVIEW_GRIP_SOURCE_FAMILY = {
  primitiveFeature: "primitive",
  sketchExtrudeFeature: "extrude",
  sketchRevolveFeature: "revolve",
  sketchHoleFeature: "hole",
  edgeChamferFeature: "chamfer",
  edgeFilletFeature: "fillet",
  linearPatternFeature: "linearPattern",
  circularPatternFeature: "circularPattern",
  mirrorFeature: "mirror",
  shellFeature: "shell",
  sweepFeature: "sweep",
  loftFeature: "loft",
  importedStepBody: "importedBody"
} as const satisfies Record<
  ExactFeaturePreviewGripSourceType,
  ExactFeaturePreviewGripFeatureFamily
>;

export type ExactFeaturePreviewGripNonFeatureFamily =
  | "delete"
  | "suppress"
  | "reorder"
  | "unsupported";

/** Lifecycle/unsupported rows make no new preview or grip promise. */
export const EXACT_FEATURE_PREVIEW_GRIP_NON_FEATURE_POLICY = {
  delete: { create: "none", update: "none", grips: [], valueEditors: [] },
  suppress: { create: "none", update: "none", grips: [], valueEditors: [] },
  reorder: { create: "none", update: "none", grips: [], valueEditors: [] },
  unsupported: {
    create: "none",
    update: "none",
    grips: [],
    valueEditors: []
  }
} as const satisfies Record<
  ExactFeaturePreviewGripNonFeatureFamily,
  ExactFeaturePreviewGripPolicy
>;

const THROUGH_ALL_HOLE_POLICY: ExactFeaturePreviewGripPolicy = {
  ...EXACT_FEATURE_PREVIEW_GRIP_POLICY.hole,
  grips: []
};

/**
 * Returns the policy for a feature summary, removing the blind-depth grip for
 * the existing through-all hole row while retaining its preview promise.
 */
export function getExactFeaturePreviewGripPolicy(
  feature: CadFeatureSummary
): ExactFeaturePreviewGripPolicy {
  if (feature.kind === "hole" && feature.depthMode === "throughAll") {
    return THROUGH_ALL_HOLE_POLICY;
  }
  return EXACT_FEATURE_PREVIEW_GRIP_POLICY[feature.kind];
}

export function getExactFeaturePreviewGripPolicyForSource(
  sourceType: ExactFeaturePreviewGripSourceType
): ExactFeaturePreviewGripPolicy {
  return EXACT_FEATURE_PREVIEW_GRIP_POLICY[
    EXACT_FEATURE_PREVIEW_GRIP_SOURCE_FAMILY[sourceType]
  ];
}

export type ExactFeaturePreviewGripBinding =
  | {
      readonly kind: "parameter";
      readonly parameterId: ParameterId;
      readonly ownerId?: string;
    }
  | {
      readonly kind: "expression";
      readonly expression: string;
      readonly parameterId?: ParameterId;
      readonly ownerId?: string;
    };

export interface ExactFeaturePreviewGripDraftField {
  readonly value: number;
  readonly binding?: ExactFeaturePreviewGripBinding;
}

export type ExactFeaturePreviewGripDraftInteraction =
  | {
      readonly status: "editable";
      readonly value: number;
    }
  | {
      readonly status: "readOnly";
      readonly route: "route-to-owner";
      readonly value: number;
      readonly binding: ExactFeaturePreviewGripBinding;
    };

/**
 * Classifies interaction without producing a replacement value.  A bound
 * field is deliberately never converted to a literal by this helper.
 */
export function classifyExactFeaturePreviewGripDraftField(
  field: ExactFeaturePreviewGripDraftField
): ExactFeaturePreviewGripDraftInteraction {
  if (field.binding) {
    return {
      status: "readOnly",
      route: "route-to-owner",
      value: field.value,
      binding: field.binding
    };
  }
  return { status: "editable", value: field.value };
}

export function isExactFeaturePreviewGripDraftFieldBound(
  field: ExactFeaturePreviewGripDraftField
): boolean {
  return field.binding !== undefined;
}

export type ExactFeaturePreviewGripBindingMap = Readonly<
  Partial<
    Record<
      ExactFeaturePreviewGripField | ExactFeaturePreviewGripValueEditor,
      ExactFeaturePreviewGripBinding
    >
  >
>;

export interface ExactFeaturePreviewGripMappingOptions {
  readonly lengthUnitLabel: string;
  readonly bindings?: ExactFeaturePreviewGripBindingMap;
}

type GripId = ExactFeaturePreviewGripField | ExactFeaturePreviewGripValueEditor;
type GripSpec = Omit<Pick<ViewportFeatureGripDescriptor, "label" | "value" | "min" | "max">, "id"> & {
  readonly id: GripId;
  readonly unit: "length" | "°" | "instances";
  readonly dragDisabled?: boolean;
  readonly integerOnly?: boolean;
};

const POSITIVE_GRIP_MIN = Number.MIN_VALUE;
const length = (id: GripId, label: string, value: number): GripSpec => ({
  id,
  label,
  value,
  unit: "length",
  min: POSITIVE_GRIP_MIN
});
const angle = (id: GripId, label: string, value: number): GripSpec => ({
  id,
  label,
  value,
  unit: "°",
  min: 0,
  max: 360
});
const count = (label: string, value: number): GripSpec => ({
  id: "count",
  label,
  value,
  unit: "instances",
  min: 2,
  max: CAD_PATTERN_COMMAND_INSTANCE_LIMIT,
  dragDisabled: true,
  integerOnly: true
});

function gripSpecs(submission: SolidEditorSubmission): readonly GripSpec[] {
  switch (submission.kind) {
    case "extrude":
    case "compositeExtrude":
      return [length("depth", "Extrude depth", submission.draft.depth)];
    case "revolve":
    case "compositeRevolve":
      return [angle("angle", "Revolve angle", submission.draft.angleDegrees)];
    case "hole":
      return submission.draft.depthMode === "blind"
        ? [length("blindDepth", "Blind hole depth", submission.draft.depth)]
        : [];
    case "chamfer":
      return [length("distance", "Chamfer distance", submission.draft.distance)];
    case "fillet":
      return [length("radius", "Fillet radius", submission.draft.radius)];
    case "linearPattern":
      return [
        length("spacing", "Linear pattern spacing", submission.draft.spacing),
        count("Linear pattern instance count", submission.draft.instanceCount)
      ];
    case "circularPattern":
      return [
        angle("totalAngle", "Circular pattern total angle", submission.draft.totalAngleDegrees),
        count("Circular pattern instance count", submission.draft.instanceCount)
      ];
    case "mirror":
      return [{
        id: "planeOffset",
        label: "Mirror plane offset",
        value: submission.draft.plane.offset ?? 0,
        unit: "length"
      }];
    case "shell":
      return [length("wallThickness", "Shell wall thickness", submission.draft.wallThickness)];
    default:
      return [];
  }
}

function routeLabel(binding: ExactFeaturePreviewGripBinding): string {
  return binding.kind === "parameter"
    ? `Edit parameter ${binding.parameterId} in Parameters`
    : binding.parameterId
      ? `Edit parameter ${binding.parameterId} in Parameters`
      : "Edit expression in Parameters";
}

/** Creates the frozen viewport grip descriptors without mutating the draft. */
export function createExactFeaturePreviewGripDescriptors(
  submission: SolidEditorSubmission,
  options: ExactFeaturePreviewGripMappingOptions
): readonly ViewportFeatureGripDescriptor[] {
  return gripSpecs(submission).map((spec) => {
    const descriptor: ViewportFeatureGripDescriptor = {
      id: spec.id,
      label: spec.label,
      value: spec.value,
      unit: spec.unit === "length" ? options.lengthUnitLabel : spec.unit,
      normalStep: 1,
      shiftStep: spec.unit === "°" ? 15 : 5,
      ...(spec.min !== undefined ? { min: spec.min } : {}),
      ...(spec.max !== undefined ? { max: spec.max } : {}),
      ...(spec.dragDisabled ? { dragDisabled: true } : {}),
      ...(spec.integerOnly ? { integerOnly: true } : {})
    };
    const binding = options.bindings?.[spec.id];
    return binding
      ? {
          ...descriptor,
          readOnly: true,
          routeToOwnerLabel: routeLabel(binding)
        }
      : descriptor;
  });
}

function validValue(id: GripId, value: number): boolean {
  if (!Number.isFinite(value)) return false;
  if (id === "planeOffset") return true;
  if (id === "count") {
    return Number.isInteger(value) && value >= 2 && value <= CAD_PATTERN_COMMAND_INSTANCE_LIMIT;
  }
  if (id === "angle" || id === "totalAngle") return value > 0 && value <= 360;
  return value > 0;
}

/** Applies one grip value immutably; invalid or bound fields return undefined. */
export function applyExactFeaturePreviewGripValue(
  submission: SolidEditorSubmission,
  gripId: string,
  value: number,
  bindings?: ExactFeaturePreviewGripBindingMap
): SolidEditorSubmission | undefined {
  const id = gripSpecs(submission).some((spec) => spec.id === gripId)
    ? (gripId as GripId)
    : undefined;
  if (!id || !validValue(id, value) || bindings?.[id]) return undefined;
  switch (submission.kind) {
    case "extrude":
    case "compositeExtrude":
      return { ...submission, draft: { ...submission.draft, depth: value } } as SolidEditorSubmission;
    case "revolve":
    case "compositeRevolve":
      return { ...submission, draft: { ...submission.draft, angleDegrees: value } } as SolidEditorSubmission;
    case "hole":
      return submission.draft.depthMode === "blind"
        ? ({ ...submission, draft: { ...submission.draft, depth: value } } as SolidEditorSubmission)
        : undefined;
    case "chamfer":
      return { ...submission, draft: { ...submission.draft, distance: value } } as SolidEditorSubmission;
    case "fillet":
      return { ...submission, draft: { ...submission.draft, radius: value } } as SolidEditorSubmission;
    case "linearPattern":
      return { ...submission, draft: { ...submission.draft, ...(id === "spacing" ? { spacing: value } : { instanceCount: value }) } } as SolidEditorSubmission;
    case "circularPattern":
      return { ...submission, draft: { ...submission.draft, ...(id === "totalAngle" ? { totalAngleDegrees: value } : { instanceCount: value }) } } as SolidEditorSubmission;
    case "mirror":
      return { ...submission, draft: { ...submission.draft, plane: { ...submission.draft.plane, offset: value } } } as SolidEditorSubmission;
    case "shell":
      return { ...submission, draft: { ...submission.draft, wallThickness: value } } as SolidEditorSubmission;
    default:
      return undefined;
  }
}
