import type {
  SketchEntityKind,
  SketchEntitySnapshot,
  SketchSnapshot
} from "@web-cad/cad-protocol";
import { SKETCH_GEOMETRY_POLICY } from "@web-cad/cad-core";
import type { SketchEntityForm } from "./cadCommands";

export const defaultSketchEntityForm: SketchEntityForm = {
  id: "",
  construction: false,
  x: 0,
  y: 0,
  x2: 1,
  y2: 1,
  width: 1,
  height: 1,
  radius: 0.5,
  startAngleDegrees: 0,
  sweepAngleDegrees: 90
};

export function getDefaultSketchEntityFormForSketch(
  sketch: SketchSnapshot,
  kind: SketchEntityKind,
  sketches: readonly SketchSnapshot[]
): SketchEntityForm {
  const form = { ...defaultSketchEntityForm };

  if (!sketch.attachment || sketch.entities.length > 0) {
    return form;
  }

  const sourceBounds = getAttachmentSourceBounds(sketch, sketches);
  if (!sourceBounds) {
    return form;
  }

  const width = Math.max(sourceBounds.width * 0.5, 0.1);
  const height = Math.max(sourceBounds.height * 0.5, 0.1);

  if (kind === "rectangle") {
    return {
      ...form,
      width,
      height
    };
  }

  if (kind === "circle") {
    return {
      ...form,
      radius: Math.max(
        Math.min(sourceBounds.width, sourceBounds.height) * 0.25,
        0.05
      )
    };
  }

  return form;
}

export type SketchEntityFormValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string };

export interface SketchEntityFormLabels {
  readonly x: string;
  readonly y: string;
  readonly x2?: string;
  readonly y2?: string;
  readonly width?: string;
  readonly height?: string;
  readonly radius?: string;
  readonly startAngleDegrees?: string;
  readonly sweepAngleDegrees?: string;
}

function getAttachmentSourceBounds(
  sketch: SketchSnapshot,
  sketches: readonly SketchSnapshot[]
): { readonly width: number; readonly height: number } | undefined {
  const attachment = sketch.attachment;
  if (!attachment || attachment.kind !== "generatedFace") {
    return undefined;
  }

  const sourceSketch = sketches.find(
    (candidate) => candidate.id === attachment.sourceSketchId
  );
  const sourceEntity = sourceSketch?.entities.find(
    (entity) => entity.id === attachment.sourceSketchEntityId
  );

  if (sourceEntity?.kind === "rectangle") {
    return {
      width: sourceEntity.width,
      height: sourceEntity.height
    };
  }

  if (sourceEntity?.kind === "circle") {
    const diameter = sourceEntity.radius * 2;
    return {
      width: diameter,
      height: diameter
    };
  }

  return undefined;
}

export function entityToSketchEntityForm(
  entity: SketchEntitySnapshot
): SketchEntityForm {
  switch (entity.kind) {
    case "point":
      return {
        ...defaultSketchEntityForm,
        id: entity.id,
        construction: entity.construction,
        x: entity.point[0],
        y: entity.point[1]
      };
    case "line":
      return {
        ...defaultSketchEntityForm,
        id: entity.id,
        construction: entity.construction,
        x: entity.start[0],
        y: entity.start[1],
        x2: entity.end[0],
        y2: entity.end[1]
      };
    case "rectangle":
      return {
        ...defaultSketchEntityForm,
        id: entity.id,
        construction: entity.construction,
        x: entity.center[0],
        y: entity.center[1],
        width: entity.width,
        height: entity.height
      };
    case "circle":
      return {
        ...defaultSketchEntityForm,
        id: entity.id,
        construction: entity.construction,
        x: entity.center[0],
        y: entity.center[1],
        radius: entity.radius
      };
    case "arc":
      return {
        ...defaultSketchEntityForm,
        id: entity.id,
        construction: entity.construction,
        x: entity.center[0],
        y: entity.center[1],
        radius: entity.radius,
        startAngleDegrees: entity.startAngleDegrees,
        sweepAngleDegrees: entity.sweepAngleDegrees
      };
  }
}

export function sketchEntityFormToEntity(
  id: string,
  kind: SketchEntityKind,
  form: SketchEntityForm
): SketchEntitySnapshot {
  switch (kind) {
    case "point":
      return {
        id,
        kind,
        point: [form.x, form.y],
        construction: form.construction
      };
    case "line":
      return {
        id,
        kind,
        start: [form.x, form.y],
        end: [form.x2, form.y2],
        construction: form.construction
      };
    case "rectangle":
      return {
        id,
        kind,
        center: [form.x, form.y],
        width: form.width,
        height: form.height,
        construction: form.construction
      };
    case "circle":
      return {
        id,
        kind,
        center: [form.x, form.y],
        radius: form.radius,
        construction: form.construction
      };
    case "arc":
      return {
        id,
        kind,
        center: [form.x, form.y],
        radius: form.radius,
        startAngleDegrees: normalizeDegrees(form.startAngleDegrees),
        sweepAngleDegrees: form.sweepAngleDegrees,
        construction: form.construction
      };
  }
}

export function validateSketchEntityForm(
  kind: SketchEntityKind,
  form: SketchEntityForm
): SketchEntityFormValidation {
  if (!Number.isFinite(form.x) || !Number.isFinite(form.y)) {
    return {
      ok: false,
      message:
        kind === "rectangle" || kind === "circle" || kind === "arc"
          ? "Center coordinates must be finite numbers."
          : "Coordinates must be finite numbers."
    };
  }

  if (
    kind === "line" &&
    (!Number.isFinite(form.x2) || !Number.isFinite(form.y2))
  ) {
    return {
      ok: false,
      message: "Line end coordinates must be finite numbers."
    };
  }

  if (
    kind === "rectangle" &&
    (!Number.isFinite(form.width) ||
      !Number.isFinite(form.height) ||
      form.width <= 0 ||
      form.height <= 0)
  ) {
    return {
      ok: false,
      message: "Rectangle width and height must be positive finite numbers."
    };
  }

  if (
    (kind === "circle" &&
      (!Number.isFinite(form.radius) || form.radius <= 0)) ||
    (kind === "arc" &&
      (!Number.isFinite(form.radius) ||
        form.radius <= SKETCH_GEOMETRY_POLICY.linearTolerance))
  ) {
    return {
      ok: false,
      message:
        kind === "arc"
          ? "Arc radius must exceed the sketch tolerance."
          : "Circle radius must be a positive finite number."
    };
  }

  if (
    kind === "arc" &&
    (!Number.isFinite(form.startAngleDegrees) ||
      !Number.isFinite(form.sweepAngleDegrees))
  ) {
    return {
      ok: false,
      message: "Arc start and signed sweep angles must be finite numbers."
    };
  }

  if (
    kind === "arc" &&
    (Math.abs(form.sweepAngleDegrees) <
      SKETCH_GEOMETRY_POLICY.angularToleranceDegrees ||
      Math.abs(form.sweepAngleDegrees) >
        360 - SKETCH_GEOMETRY_POLICY.angularToleranceDegrees)
  ) {
    return {
      ok: false,
      message: `Arc signed sweep must be between ${SKETCH_GEOMETRY_POLICY.angularToleranceDegrees} and ${360 - SKETCH_GEOMETRY_POLICY.angularToleranceDegrees} degrees in magnitude.`
    };
  }

  return { ok: true };
}

export function getSketchEntityFormLabels(
  kind: SketchEntityKind
): SketchEntityFormLabels {
  switch (kind) {
    case "point":
      return { x: "X", y: "Y" };
    case "line":
      return { x: "Start X", y: "Start Y", x2: "End X", y2: "End Y" };
    case "rectangle":
      return {
        x: "Center X",
        y: "Center Y",
        width: "Width",
        height: "Height"
      };
    case "circle":
      return { x: "Center X", y: "Center Y", radius: "Radius" };
    case "arc":
      return {
        x: "Center X",
        y: "Center Y",
        radius: "Radius",
        startAngleDegrees: "Start angle (deg)",
        sweepAngleDegrees: "Signed sweep (deg)"
      };
  }
}

export function formatSketchEntity(entity: SketchEntitySnapshot): string {
  switch (entity.kind) {
    case "point":
      return `Point (${entity.point[0]}, ${entity.point[1]})`;
    case "line":
      return `Line (${entity.start[0]}, ${entity.start[1]}) -> (${entity.end[0]}, ${entity.end[1]})`;
    case "rectangle":
      return `Rectangle ${entity.width} x ${entity.height} at (${entity.center[0]}, ${entity.center[1]})`;
    case "circle":
      return `Circle r ${entity.radius} at (${entity.center[0]}, ${entity.center[1]})`;
    case "arc":
      return `Arc r ${entity.radius} at (${entity.center[0]}, ${entity.center[1]}), start ${entity.startAngleDegrees}°, sweep ${entity.sweepAngleDegrees}°`;
  }
}

function normalizeDegrees(value: number): number {
  const normalized = value % 360;
  const positive = normalized < 0 ? normalized + 360 : normalized;
  return Object.is(positive, -0) ? 0 : positive;
}
