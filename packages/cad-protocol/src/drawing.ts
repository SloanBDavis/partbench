import type { Vec2 } from "./index";

/** Model-space geometry, independent of part sketches and the sketch solver. */
export type DrawingEntity =
  | {
      readonly id: string;
      readonly kind: "line";
      readonly start: Vec2;
      readonly end: Vec2;
    }
  | {
      readonly id: string;
      readonly kind: "circle";
      readonly center: Vec2;
      readonly radius: number;
    }
  | {
      readonly id: string;
      readonly kind: "rectangle";
      readonly start: Vec2;
      readonly end: Vec2;
    };

export type DrawingEntityCreateOp = {
  readonly op: "drawing.entity.create";
  readonly entity: DrawingEntity;
};
export type DrawingEntityUpdateOp = {
  readonly op: "drawing.entity.update";
  readonly entity: DrawingEntity;
};
export type DrawingEntityDeleteOp = {
  readonly op: "drawing.entity.delete";
  readonly id: string;
};
export interface DrawingSemanticDiff {
  readonly created: readonly DrawingEntity[];
  readonly modified: readonly DrawingEntity[];
  readonly deleted: readonly DrawingEntity[];
}

export function isDrawingEntity(value: unknown): value is DrawingEntity {
  if (!value || typeof value !== "object") return false;
  const entity = value as Record<string, unknown>;
  const point = (v: unknown): v is Vec2 =>
    Array.isArray(v) &&
    v.length === 2 &&
    v.every((n) => typeof n === "number" && Number.isFinite(n));
  if (typeof entity.id !== "string" || !entity.id.trim()) return false;
  if (entity.kind === "circle")
    return (
      point(entity.center) &&
      typeof entity.radius === "number" &&
      Number.isFinite(entity.radius) &&
      entity.radius > 0
    );
  if (
    (entity.kind !== "line" && entity.kind !== "rectangle") ||
    !point(entity.start) ||
    !point(entity.end)
  )
    return false;
  const dx = entity.end[0] - entity.start[0],
    dy = entity.end[1] - entity.start[1];
  return (
    Number.isFinite(Math.hypot(dx, dy)) &&
    (entity.kind === "line" ? dx !== 0 || dy !== 0 : dx !== 0 && dy !== 0)
  );
}

export function isDrawingOp(
  value: unknown
): value is
  | DrawingEntityCreateOp
  | DrawingEntityUpdateOp
  | DrawingEntityDeleteOp {
  if (!value || typeof value !== "object") return false;
  const op = value as Record<string, unknown>;
  return op.op === "drawing.entity.delete"
    ? typeof op.id === "string" && Boolean(op.id.trim())
    : (op.op === "drawing.entity.create" ||
        op.op === "drawing.entity.update") &&
        isDrawingEntity(op.entity);
}
