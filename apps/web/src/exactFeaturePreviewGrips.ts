import type {
  CadBodySource,
  CadFeatureSummary,
  ParameterId
} from "@web-cad/cad-protocol";

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
