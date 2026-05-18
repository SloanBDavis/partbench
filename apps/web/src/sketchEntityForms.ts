import type {
  SketchEntityKind,
  SketchEntitySnapshot
} from "@web-cad/cad-protocol";
import type { SketchEntityForm } from "./cadCommands";

export const defaultSketchEntityForm: SketchEntityForm = {
  id: "",
  x: 0,
  y: 0,
  x2: 1,
  y2: 1,
  width: 1,
  height: 1,
  radius: 0.5
};

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
}

export function entityToSketchEntityForm(
  entity: SketchEntitySnapshot
): SketchEntityForm {
  switch (entity.kind) {
    case "point":
      return {
        ...defaultSketchEntityForm,
        id: entity.id,
        x: entity.point[0],
        y: entity.point[1]
      };
    case "line":
      return {
        ...defaultSketchEntityForm,
        id: entity.id,
        x: entity.start[0],
        y: entity.start[1],
        x2: entity.end[0],
        y2: entity.end[1]
      };
    case "rectangle":
      return {
        ...defaultSketchEntityForm,
        id: entity.id,
        x: entity.center[0],
        y: entity.center[1],
        width: entity.width,
        height: entity.height
      };
    case "circle":
      return {
        ...defaultSketchEntityForm,
        id: entity.id,
        x: entity.center[0],
        y: entity.center[1],
        radius: entity.radius
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
      return { id, kind, point: [form.x, form.y] };
    case "line":
      return { id, kind, start: [form.x, form.y], end: [form.x2, form.y2] };
    case "rectangle":
      return {
        id,
        kind,
        center: [form.x, form.y],
        width: form.width,
        height: form.height
      };
    case "circle":
      return { id, kind, center: [form.x, form.y], radius: form.radius };
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
        kind === "rectangle" || kind === "circle"
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
    kind === "circle" &&
    (!Number.isFinite(form.radius) || form.radius <= 0)
  ) {
    return {
      ok: false,
      message: "Circle radius must be a positive finite number."
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
  }
}
