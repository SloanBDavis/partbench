import type {
  SketchAddRoundedRectangleOp,
  SketchAddSlotOp
} from "@web-cad/cad-protocol";
import {
  buildAddSketchRoundedRectangleOp,
  buildAddSketchSlotOp,
  type SketchRoundedRectangleForm,
  type SketchSlotForm
} from "../../cadCommands";

export type SketchConvenienceKind = "slot" | "roundedRectangle";
export type SketchConvenienceOp = SketchAddSlotOp | SketchAddRoundedRectangleOp;

export interface SketchConvenienceDraft {
  readonly kind: SketchConvenienceKind;
  readonly slot: SketchSlotForm;
  readonly roundedRectangle: SketchRoundedRectangleForm;
}

const LINEAR_TOLERANCE = 1e-7;

export function createSketchConvenienceDraft(
  kind: SketchConvenienceKind
): SketchConvenienceDraft {
  return {
    kind,
    slot: {
      centerlineStart: [0, 0],
      centerlineEnd: [10, 0],
      radius: 2,
      construction: false
    },
    roundedRectangle: {
      center: [0, 0],
      width: 10,
      height: 8,
      cornerRadius: 1,
      construction: false
    }
  };
}

export function validateSketchConvenienceDraft(
  draft: SketchConvenienceDraft
): string | undefined {
  if (draft.kind === "slot") {
    const { centerlineStart, centerlineEnd, radius } = draft.slot;
    if (
      !isFinitePoint(centerlineStart) ||
      !isFinitePoint(centerlineEnd) ||
      !Number.isFinite(radius)
    ) {
      return "Slot coordinates and radius must be finite.";
    }
    if (radius <= LINEAR_TOLERANCE) {
      return "Radius must be greater than sketch tolerance.";
    }
    if (
      Math.hypot(
        centerlineEnd[0] - centerlineStart[0],
        centerlineEnd[1] - centerlineStart[1]
      ) <= LINEAR_TOLERANCE
    ) {
      return "Centerline endpoints must be farther apart than sketch tolerance.";
    }
    return undefined;
  }
  const { center, width, height, cornerRadius } = draft.roundedRectangle;
  if (
    !isFinitePoint(center) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    !Number.isFinite(cornerRadius)
  ) {
    return "Rounded rectangle inputs must be finite.";
  }
  if (cornerRadius <= LINEAR_TOLERANCE) {
    return "Corner radius must be greater than sketch tolerance.";
  }
  if (
    width - 2 * cornerRadius <= LINEAR_TOLERANCE ||
    height - 2 * cornerRadius <= LINEAR_TOLERANCE
  ) {
    return "Width and height must leave straight spans above sketch tolerance.";
  }
  return undefined;
}

export function buildSketchConvenienceOp(
  sketchId: string,
  draft: SketchConvenienceDraft
): SketchConvenienceOp | undefined {
  if (validateSketchConvenienceDraft(draft)) return undefined;
  return draft.kind === "slot"
    ? buildAddSketchSlotOp(sketchId, draft.slot)
    : buildAddSketchRoundedRectangleOp(sketchId, draft.roundedRectangle);
}

export function isSketchConvenienceDraftDirty(
  draft: SketchConvenienceDraft,
  initial: SketchConvenienceDraft
): boolean {
  return JSON.stringify(draft) !== JSON.stringify(initial);
}

export function getSketchConvenienceLabel(
  kind: SketchConvenienceKind
): "Slot" | "Rounded Rectangle" {
  return kind === "slot" ? "Slot" : "Rounded Rectangle";
}

function isFinitePoint(point: readonly [number, number]): boolean {
  return Number.isFinite(point[0]) && Number.isFinite(point[1]);
}
