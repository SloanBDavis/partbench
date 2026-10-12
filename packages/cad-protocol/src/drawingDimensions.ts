import type { DrawingEntity } from "./drawing";
import type { Vec2 } from "./index";

export type DrawingAnchorName =
  | "start"
  | "end"
  | "midpoint"
  | "center"
  | "cornerX"
  | "cornerY"
  | "east"
  | "north"
  | "west"
  | "south";
export interface DrawingAnchor {
  readonly entityId: string;
  readonly point: DrawingAnchorName;
}
export interface DrawingDimension {
  readonly id: string;
  readonly kind: "dimension";
  readonly dimensionType: "aligned" | "horizontal" | "vertical";
  readonly first: DrawingAnchor;
  readonly second: DrawingAnchor;
  /** Absolute model-space label position; geometry edits never replace it. */
  readonly placement: Vec2;
}

export function drawingAnchors(
  entity: DrawingEntity
): readonly { name: DrawingAnchorName; point: Vec2 }[] {
  if (entity.kind === "dimension") return [];
  if (entity.kind === "circle") {
    const [x, y] = entity.center,
      r = entity.radius;
    return [
      { name: "center", point: entity.center },
      { name: "east", point: [x + r, y] },
      { name: "north", point: [x, y + r] },
      { name: "west", point: [x - r, y] },
      { name: "south", point: [x, y - r] }
    ];
  }
  const { start: a, end: b } = entity;
  const middle: Vec2 = [a[0] / 2 + b[0] / 2, a[1] / 2 + b[1] / 2];
  return entity.kind === "line"
    ? [
        { name: "start", point: a },
        { name: "end", point: b },
        { name: "midpoint", point: middle }
      ]
    : [
        { name: "start", point: a },
        { name: "end", point: b },
        { name: "cornerX", point: [b[0], a[1]] },
        { name: "cornerY", point: [a[0], b[1]] },
        { name: "center", point: middle }
      ];
}

export function resolveDrawingDimension(
  dimension: DrawingDimension,
  entities: ReadonlyMap<string, DrawingEntity>
) {
  const resolve = (anchor: DrawingAnchor) => {
    const entity = entities.get(anchor.entityId);
    return (
      entity &&
      drawingAnchors(entity).find((p) => p.name === anchor.point)?.point
    );
  };
  const first = resolve(dimension.first),
    second = resolve(dimension.second);
  if (!first || !second) return undefined;
  const dx = second[0] - first[0],
    dy = second[1] - first[1];
  const length = Math.hypot(dx, dy);
  const value =
    dimension.dimensionType === "horizontal"
      ? Math.abs(dx)
      : dimension.dimensionType === "vertical"
        ? Math.abs(dy)
        : length;
  // Coincident points after an edit remain a valid associative zero measurement.
  const u: Vec2 =
    dimension.dimensionType === "horizontal"
      ? [1, 0]
      : dimension.dimensionType === "vertical"
        ? [0, 1]
        : length > 0
          ? [dx / length, dy / length]
          : [1, 0];
  const n: Vec2 = [-u[1], u[0]];
  const project = (p: Vec2): Vec2 => {
    const offset =
      (dimension.placement[0] - p[0]) * n[0] +
      (dimension.placement[1] - p[1]) * n[1];
    return [p[0] + offset * n[0], p[1] + offset * n[1]];
  };
  const start = project(first),
    end = project(second);
  if (![value, ...start, ...end].every(Number.isFinite)) return undefined;
  return {
    first,
    second,
    start,
    end,
    value,
    labelPosition: dimension.placement
  };
}

export function isDrawingDimension(value: Record<string, unknown>): boolean {
  const anchor = (a: unknown) => {
    if (!a || typeof a !== "object") return false;
    const ref = a as Record<string, unknown>;
    return (
      typeof ref.entityId === "string" &&
      !!ref.entityId.trim() &&
      [
        "start",
        "end",
        "midpoint",
        "center",
        "cornerX",
        "cornerY",
        "east",
        "north",
        "west",
        "south"
      ].includes(String(ref.point))
    );
  };
  return (
    ["aligned", "horizontal", "vertical"].includes(
      String(value.dimensionType)
    ) &&
    anchor(value.first) &&
    anchor(value.second) &&
    Array.isArray(value.placement) &&
    value.placement.length === 2 &&
    value.placement.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}
