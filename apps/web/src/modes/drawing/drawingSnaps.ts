import type { DrawingEntity, Vec2 } from "@web-cad/cad-protocol";

export const drawingSnapKinds = [
  "endpoint",
  "midpoint",
  "center",
  "quadrant",
  "intersection",
  "tangent",
  "perpendicular",
  "extension",
  "tracking"
] as const;
export type DrawingSnapKind = (typeof drawingSnapKinds)[number];
export interface DrawingSnapCandidate {
  readonly key: string;
  readonly kind: DrawingSnapKind;
  readonly point: Vec2;
  readonly sourceIds: readonly string[];
  readonly guides: readonly { start: Vec2; end: Vec2 }[];
  readonly description: string;
}
export interface DrawingSnapOptions {
  readonly entities: readonly DrawingEntity[];
  readonly point: Vec2;
  /** World distance corresponding to the desired CSS-pixel acquisition radius. */
  readonly tolerance: number;
  readonly base?: Vec2;
  readonly enabled?: readonly DrawingSnapKind[];
  readonly trackingPoints?: readonly Vec2[];
}

type Segment = {
  kind: "segment";
  key: string;
  id: string;
  start: Vec2;
  end: Vec2;
  length: number;
  direction: Vec2;
};
type Circle = {
  kind: "circle";
  key: string;
  id: string;
  center: Vec2;
  radius: number;
};
type Boundary = Segment | Circle;
const roundoff = Number.EPSILON * 64;
const finitePoint = (p: Vec2) => p.every(Number.isFinite);
const distance = (a: Vec2, b: Vec2) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const subtract = (a: Vec2, b: Vec2): Vec2 => [a[0] - b[0], a[1] - b[1]];
const dot = (a: Vec2, b: Vec2) => a[0] * b[0] + a[1] * b[1];
const cross = (a: Vec2, b: Vec2) => a[0] * b[1] - a[1] * b[0];
const along = (a: Vec2, u: Vec2, length: number): Vec2 => [
  a[0] + u[0] * length,
  a[1] + u[1] * length
];
const midpoint = (a: Vec2, b: Vec2): Vec2 => [
  a[0] / 2 + b[0] / 2,
  a[1] / 2 + b[1] / 2
];

function boundaries(entities: readonly DrawingEntity[]): Boundary[] {
  const result: Boundary[] = [];
  for (const entity of entities) {
    if (entity.kind === "circle") {
      result.push({ ...entity, key: JSON.stringify([entity.id, "circle"]) });
      continue;
    }
    const { start: a, end: b } = entity;
    const corners: readonly Vec2[] =
      entity.kind === "line" ? [a, b] : [a, [b[0], a[1]], b, [a[0], b[1]], a];
    for (let index = 0; index < corners.length - 1; index++) {
      const start = corners[index]!,
        end = corners[index + 1]!;
      const length = distance(start, end);
      if (!(length > 0) || !Number.isFinite(length)) continue;
      result.push({
        kind: "segment",
        key: JSON.stringify([entity.id, index]),
        id: entity.id,
        start,
        end,
        length,
        direction: [(end[0] - start[0]) / length, (end[1] - start[1]) / length]
      });
    }
  }
  return result.sort((a, b) => a.key.localeCompare(b.key));
}

function project(segment: Segment, point: Vec2) {
  const length = dot(subtract(point, segment.start), segment.direction);
  return { point: along(segment.start, segment.direction, length), length };
}

function segmentPoint(segment: Segment, length: number): Vec2 | undefined {
  const epsilon = roundoff * segment.length;
  if (
    !Number.isFinite(length) ||
    length < -epsilon ||
    length > segment.length + epsilon
  )
    return;
  // Clamp roundoff outside the interval, but preserve every interior root:
  // long segments must not turn nearby valid targets into their endpoints.
  if (length <= 0) return segment.start;
  if (length >= segment.length) return segment.end;
  return along(segment.start, segment.direction, length);
}

function segmentIntersections(a: Segment, b: Segment): Vec2[] {
  const determinant = cross(a.direction, b.direction);
  // Parallel/collinear edges have no unique intersection; their endpoint snaps
  // remain available, including the endpoints of overlapping segments.
  if (Math.abs(determinant) <= roundoff) return [];
  const delta = subtract(b.start, a.start);
  const lengthA = cross(delta, b.direction) / determinant;
  const lengthB = cross(delta, a.direction) / determinant;
  const point = segmentPoint(a, lengthA);
  return point && segmentPoint(b, lengthB) ? [point] : [];
}

function segmentCircleIntersections(segment: Segment, circle: Circle): Vec2[] {
  const delta = subtract(segment.start, circle.center);
  const scale = Math.max(
    Math.abs(delta[0]),
    Math.abs(delta[1]),
    circle.radius,
    segment.length
  );
  if (!(scale > 0) || !Number.isFinite(scale)) return [];
  const normalized: Vec2 = [delta[0] / scale, delta[1] / scale];
  const radius = circle.radius / scale;
  const offset = cross(normalized, segment.direction);
  const discriminant = radius * radius - offset * offset;
  const epsilon = roundoff * Math.max(radius * radius, offset * offset);
  if (discriminant < -epsilon) return [];
  const center = -dot(normalized, segment.direction);
  const halfChord = Math.sqrt(Math.max(0, discriminant));
  const roots =
    halfChord === 0 ? [center] : [center - halfChord, center + halfChord];
  return roots.flatMap((root) => {
    const point = segmentPoint(segment, root * scale);
    return point ? [point] : [];
  });
}

function circleIntersections(a: Circle, b: Circle): Vec2[] {
  const delta = subtract(b.center, a.center),
    separation = Math.hypot(...delta);
  if (!(separation > 0) || !Number.isFinite(separation)) return [];
  const scale = Math.max(a.radius, b.radius, separation);
  const ra = a.radius / scale,
    rb = b.radius / scale,
    d = separation / scale;
  if (d > ra + rb + roundoff || d < Math.abs(ra - rb) - roundoff) return [];
  const axis = ((ra - rb) * (ra + rb) + d * d) / (2 * d);
  const heightSquared = ra * ra - axis * axis;
  if (heightSquared < -roundoff * Math.max(ra * ra, axis * axis)) return [];
  const unit: Vec2 = [delta[0] / separation, delta[1] / separation];
  const center = along(a.center, unit, axis * scale);
  const height = Math.sqrt(Math.max(0, heightSquared)) * scale;
  return height === 0
    ? [center]
    : [
        along(center, [-unit[1], unit[0]], height),
        along(center, [unit[1], -unit[0]], height)
      ];
}

function intersections(a: Boundary, b: Boundary): Vec2[] {
  if (a.kind === "segment")
    return b.kind === "segment"
      ? segmentIntersections(a, b)
      : segmentCircleIntersections(a, b);
  return b.kind === "segment"
    ? segmentCircleIntersections(b, a)
    : circleIntersections(a, b);
}

function nearBoundary(
  boundary: Boundary,
  point: Vec2,
  tolerance: number
): boolean {
  if (boundary.kind === "circle")
    return (
      Math.abs(distance(point, boundary.center) - boundary.radius) <= tolerance
    );
  const projection = project(boundary, point);
  const nearest =
    projection.length <= 0
      ? boundary.start
      : projection.length >= boundary.length
        ? boundary.end
        : projection.point;
  return distance(point, nearest) <= tolerance;
}

/**
 * Analytic, derived interaction targets only. No rounding or source edits occur
 * here: display the returned point and commit that same point through CADOps.
 * Callers own acquisition, temporary overrides, candidate cycling and CSS scale.
 */
export function findDrawingSnaps({
  entities,
  point,
  tolerance,
  base,
  enabled = drawingSnapKinds,
  trackingPoints = []
}: DrawingSnapOptions): DrawingSnapCandidate[] {
  if (!finitePoint(point) || !(tolerance > 0) || !Number.isFinite(tolerance))
    return [];
  const active = new Set(enabled);
  const candidates: DrawingSnapCandidate[] = [];
  const seen = new Set<string>();
  const add = (
    kind: DrawingSnapKind,
    target: Vec2,
    sourceIds: readonly string[],
    key: string,
    guides: DrawingSnapCandidate["guides"] = [],
    description: string = kind[0]!.toUpperCase() + kind.slice(1)
  ) => {
    if (
      !active.has(kind) ||
      !finitePoint(target) ||
      distance(point, target) > tolerance
    )
      return;
    const ids = [...new Set(sourceIds)].sort();
    const identity = JSON.stringify([kind, target, ids]);
    if (seen.has(identity)) return;
    seen.add(identity);
    candidates.push({
      key: JSON.stringify([kind, key]),
      kind,
      point: target,
      sourceIds: ids,
      guides,
      description
    });
  };
  const geometry = boundaries(entities);
  for (const edge of geometry) {
    if (edge.kind === "segment") {
      add("endpoint", edge.start, [edge.id], `${edge.key}:start`);
      add("endpoint", edge.end, [edge.id], `${edge.key}:end`);
      add("midpoint", midpoint(edge.start, edge.end), [edge.id], edge.key);
      if (base && finitePoint(base)) {
        const projection = project(edge, base);
        const target = segmentPoint(edge, projection.length);
        if (target)
          add("perpendicular", target, [edge.id], edge.key, [
            { start: base, end: target }
          ]);
      }
      const projection = project(edge, point);
      if (projection.length < 0 || projection.length > edge.length) {
        const endpoint = projection.length < 0 ? edge.start : edge.end;
        add("extension", projection.point, [edge.id], edge.key, [
          { start: endpoint, end: projection.point }
        ]);
      }
    } else {
      add("center", edge.center, [edge.id], edge.key);
      const quadrants: Vec2[] = [
        [edge.center[0] + edge.radius, edge.center[1]],
        [edge.center[0], edge.center[1] + edge.radius],
        [edge.center[0] - edge.radius, edge.center[1]],
        [edge.center[0], edge.center[1] - edge.radius]
      ];
      quadrants.forEach((target, i) =>
        add("quadrant", target, [edge.id], `${edge.key}:${i}`)
      );
      if (base && finitePoint(base)) {
        const delta = subtract(base, edge.center),
          length = Math.hypot(...delta);
        if (length > 0 && Number.isFinite(length)) {
          const direction: Vec2 = [delta[0] / length, delta[1] / length];
          for (const sign of [-1, 1]) {
            const target = along(edge.center, direction, edge.radius * sign);
            add("perpendicular", target, [edge.id], `${edge.key}:${sign}`, [
              { start: base, end: target }
            ]);
          }
          if (length >= edge.radius) {
            const ratio = edge.radius / length;
            const tangentCenter = along(
              edge.center,
              direction,
              edge.radius * ratio
            );
            const height =
              edge.radius * Math.sqrt(Math.max(0, (1 - ratio) * (1 + ratio)));
            for (const sign of [-1, 1]) {
              const target = along(
                tangentCenter,
                [-direction[1], direction[0]],
                height * sign
              );
              add("tangent", target, [edge.id], `${edge.key}:${sign}`, [
                { start: base, end: target }
              ]);
            }
          }
        }
      }
    }
  }
  for (const entity of entities) {
    if (entity.kind === "rectangle")
      add("center", midpoint(entity.start, entity.end), [entity.id], entity.id);
  }
  if (active.has("intersection")) {
    // An intersection within the pick radius must lie on two nearby finite
    // boundaries. Avoid the quadratic pair walk across the whole drawing.
    const nearby = geometry.filter((edge) =>
      nearBoundary(edge, point, tolerance)
    );
    for (let i = 0; i < nearby.length; i++) {
      for (let j = i + 1; j < nearby.length; j++) {
        const a = nearby[i]!,
          b = nearby[j]!;
        if (a.id === b.id) continue;
        intersections(a, b).forEach((target, index) =>
          add(
            "intersection",
            target,
            [a.id, b.id],
            JSON.stringify([a.key, b.key, index])
          )
        );
      }
    }
  }
  if (active.has("tracking")) {
    const acquired = trackingPoints.filter(finitePoint);
    acquired.forEach((origin, index) => {
      const horizontal: Vec2 = [point[0], origin[1]],
        vertical: Vec2 = [origin[0], point[1]];
      add(
        "tracking",
        horizontal,
        [],
        `${index}:horizontal`,
        [{ start: origin, end: horizontal }],
        "Horizontal tracking"
      );
      add(
        "tracking",
        vertical,
        [],
        `${index}:vertical`,
        [{ start: origin, end: vertical }],
        "Vertical tracking"
      );
      acquired.forEach((other, otherIndex) => {
        if (index === otherIndex) return;
        const target: Vec2 = [origin[0], other[1]];
        add(
          "tracking",
          target,
          [],
          `${index}:${otherIndex}`,
          [
            { start: origin, end: target },
            { start: other, end: target }
          ],
          "Tracking intersection"
        );
      });
    });
  }
  const priority: Record<DrawingSnapKind, number> = {
    endpoint: 0,
    intersection: 1,
    midpoint: 2,
    center: 3,
    quadrant: 4,
    tangent: 5,
    perpendicular: 6,
    extension: 7,
    tracking: 8
  };
  // Small semantic bias makes coincident targets predictable without allowing
  // a distant endpoint to hide a much closer intersection. Keys support cycling.
  const score = (candidate: DrawingSnapCandidate) =>
    distance(point, candidate.point) / tolerance +
    priority[candidate.kind] * 0.015;
  return candidates.sort(
    (a, b) => score(a) - score(b) || a.key.localeCompare(b.key)
  );
}
