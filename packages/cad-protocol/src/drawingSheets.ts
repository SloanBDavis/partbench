import type { Vec2 } from "./index";

/** Paper dimensions and margins are always physical millimeters. */
export interface DrawingSheet {
  readonly id: string;
  readonly name: string;
  readonly paper: { readonly width: number; readonly height: number };
  readonly orientation: "portrait" | "landscape";
  readonly margins: {
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
    readonly left: number;
  };
  readonly viewports: readonly DrawingSheetViewport[];
}
export interface DrawingSheetViewport {
  readonly id: string;
  readonly name: string;
  /** Rectangle from the top-left of the physical sheet, in millimeters. */
  readonly paper: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
  /** Persistent model-space window, in document units, with Y upwards. */
  readonly model: {
    readonly center: Vec2;
    readonly width: number;
    readonly height: number;
  };
}
export type DrawingSheetOp =
  | { readonly op: "drawing.sheet.create"; readonly sheet: DrawingSheet }
  | { readonly op: "drawing.sheet.update"; readonly sheet: DrawingSheet }
  | { readonly op: "drawing.sheet.delete"; readonly id: string };
export interface DrawingSheetSemanticDiff {
  readonly created: readonly DrawingSheet[];
  readonly modified: readonly DrawingSheet[];
  readonly deleted: readonly DrawingSheet[];
}
export function drawingSheetSize(sheet: DrawingSheet): {
  width: number;
  height: number;
} {
  const short = Math.min(sheet.paper.width, sheet.paper.height),
    long = Math.max(sheet.paper.width, sheet.paper.height);
  return sheet.orientation === "portrait"
    ? { width: short, height: long }
    : { width: long, height: short };
}
const record = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object";
const positive = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v > 0;
const nonnegative = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0;
const named = (v: unknown): v is string =>
  typeof v === "string" && Boolean(v.trim());
export function isDrawingSheet(value: unknown): value is DrawingSheet {
  if (
    !record(value) ||
    !named(value.id) ||
    !named(value.name) ||
    !record(value.paper) ||
    !positive(value.paper.width) ||
    !positive(value.paper.height) ||
    !["portrait", "landscape"].includes(String(value.orientation)) ||
    !record(value.margins) ||
    ![
      value.margins.top,
      value.margins.right,
      value.margins.bottom,
      value.margins.left
    ].every(nonnegative) ||
    !Array.isArray(value.viewports)
  )
    return false;
  const sheet = value as unknown as DrawingSheet;
  const size = drawingSheetSize(sheet);
  if (
    sheet.margins.left + sheet.margins.right >= size.width ||
    sheet.margins.top + sheet.margins.bottom >= size.height
  )
    return false;
  const ids = new Set<string>();
  return value.viewports.every((v) => {
    if (
      !record(v) ||
      !named(v.id) ||
      ids.has(v.id) ||
      !named(v.name) ||
      !record(v.paper) ||
      !nonnegative(v.paper.x) ||
      !nonnegative(v.paper.y) ||
      !positive(v.paper.width) ||
      !positive(v.paper.height) ||
      !record(v.model) ||
      !positive(v.model.width) ||
      !positive(v.model.height) ||
      !Array.isArray(v.model.center) ||
      v.model.center.length !== 2 ||
      !v.model.center.every((n) => typeof n === "number" && Number.isFinite(n))
    )
      return false;
    if (
      ![
        v.model.center[0] - v.model.width / 2,
        v.model.center[0] + v.model.width / 2,
        v.model.center[1] - v.model.height / 2,
        v.model.center[1] + v.model.height / 2
      ].every(Number.isFinite)
    )
      return false;
    ids.add(v.id);
    return (
      v.paper.x >= sheet.margins.left &&
      v.paper.y >= sheet.margins.top &&
      v.paper.x + v.paper.width <= size.width - sheet.margins.right &&
      v.paper.y + v.paper.height <= size.height - sheet.margins.bottom
    );
  });
}
export function isDrawingSheetOp(value: unknown): value is DrawingSheetOp {
  return (
    record(value) &&
    (value.op === "drawing.sheet.delete"
      ? named(value.id)
      : (value.op === "drawing.sheet.create" ||
          value.op === "drawing.sheet.update") &&
        isDrawingSheet(value.sheet))
  );
}
