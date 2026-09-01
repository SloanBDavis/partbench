import type {
  SketchSplineDefinition,
  SketchSplineEntity,
  Vec2
} from "@web-cad/cad-protocol";

import {
  SKETCH_GEOMETRY_POLICY,
  type SketchGeometryPolicy
} from "./sketchGeometryPolicy";

export const SKETCH_SPLINE_DEFAULT_DEGREE = 3;
export const SKETCH_SPLINE_MIN_INTERPOLATION_POINTS = 3;
export const SKETCH_SPLINE_MAX_DEGREE = 7;

export type SketchSplineCanonicalizationIssueCode =
  | "SKETCH_SPLINE_DEFINITION_INVALID"
  | "SKETCH_SPLINE_POINTS_INVALID"
  | "SKETCH_SPLINE_DEGREE_INVALID"
  | "SKETCH_SPLINE_DEGENERATE";

export interface SketchSplineCanonicalizationIssue {
  readonly code: SketchSplineCanonicalizationIssueCode;
  readonly path: string;
  readonly message: string;
}

export type SketchSplineCanonicalization =
  | {
      readonly ok: true;
      readonly value: Omit<SketchSplineEntity, "id" | "construction">;
    }
  | {
      readonly ok: false;
      readonly issues: readonly SketchSplineCanonicalizationIssue[];
    };

function isFinitePoint(point: Vec2): boolean {
  return Number.isFinite(point[0]) && Number.isFinite(point[1]);
}

function distance(left: Vec2, right: Vec2): number {
  return Math.hypot(left[0] - right[0], left[1] - right[1]);
}

function issue(
  code: SketchSplineCanonicalizationIssueCode,
  path: string,
  message: string
): SketchSplineCanonicalizationIssue {
  return { code, path, message };
}

function fail(
  issues: readonly SketchSplineCanonicalizationIssue[]
): SketchSplineCanonicalization {
  return { ok: false, issues };
}

export function canonicalizeSketchSplineDefinition(
  definition: SketchSplineDefinition,
  policy: SketchGeometryPolicy = SKETCH_GEOMETRY_POLICY
): SketchSplineCanonicalization {
  if (definition.kind !== "interpolation" && definition.kind !== "controlPoints") {
    return fail([
      issue(
        "SKETCH_SPLINE_DEFINITION_INVALID",
        "definition.kind",
        "Spline definition kind must be interpolation or controlPoints."
      )
    ]);
  }
  if (!Array.isArray(definition.points) || definition.points.length === 0) {
    return fail([
      issue(
        "SKETCH_SPLINE_POINTS_INVALID",
        "definition.points",
        "Spline definition requires a non-empty points array."
      )
    ]);
  }

  const points: Vec2[] = [];
  for (const [index, point] of definition.points.entries()) {
    if (
      !Array.isArray(point) ||
      point.length !== 2 ||
      typeof point[0] !== "number" ||
      typeof point[1] !== "number" ||
      !isFinitePoint([point[0], point[1]])
    ) {
      return fail([
        issue(
          "SKETCH_SPLINE_POINTS_INVALID",
          `definition.points[${index}]`,
          "Spline points must be finite 2D coordinates."
        )
      ]);
    }
    const next: Vec2 = [point[0], point[1]];
    const previous = points[points.length - 1];
    if (previous && distance(previous, next) <= policy.linearTolerance) {
      return fail([
        issue(
          "SKETCH_SPLINE_DEGENERATE",
          `definition.points[${index}]`,
          "Consecutive spline points must be farther apart than the sketch linear tolerance."
        )
      ]);
    }
    points.push(next);
  }

  const closed = definition.closed === true;
  if (closed && points.length >= 2) {
    const first = points[0]!;
    const last = points[points.length - 1]!;
    if (distance(first, last) <= policy.linearTolerance) {
      points.pop();
    }
  }

  const degree =
    definition.kind === "interpolation"
      ? SKETCH_SPLINE_DEFAULT_DEGREE
      : definition.degree === undefined
        ? SKETCH_SPLINE_DEFAULT_DEGREE
        : definition.degree;

  if (
    definition.kind === "controlPoints" &&
    (typeof degree !== "number" ||
      !Number.isInteger(degree) ||
      degree < 1 ||
      degree > SKETCH_SPLINE_MAX_DEGREE)
  ) {
    return fail([
      issue(
        "SKETCH_SPLINE_DEGREE_INVALID",
        "definition.degree",
        `Control-point spline degree must be an integer from 1 to ${SKETCH_SPLINE_MAX_DEGREE}.`
      )
    ]);
  }

  const minimumPoints =
    definition.kind === "interpolation"
      ? SKETCH_SPLINE_MIN_INTERPOLATION_POINTS
      : degree + 1;
  if (points.length < minimumPoints) {
    return fail([
      issue(
        "SKETCH_SPLINE_POINTS_INVALID",
        "definition.points",
        definition.kind === "interpolation"
          ? `Interpolation splines require at least ${SKETCH_SPLINE_MIN_INTERPOLATION_POINTS} points.`
          : `Control-point splines require at least ${minimumPoints} points for degree ${degree}.`
      )
    ]);
  }

  return {
    ok: true,
    value: {
      kind: "spline",
      form: definition.kind,
      points,
      degree,
      closed
    }
  };
}

export function createCanonicalSketchSplineEntity(
  id: string,
  definition: SketchSplineDefinition,
  construction: boolean,
  policy: SketchGeometryPolicy = SKETCH_GEOMETRY_POLICY
):
  | { readonly ok: true; readonly entity: SketchSplineEntity }
  | { readonly ok: false; readonly issues: readonly SketchSplineCanonicalizationIssue[] } {
  const geometry = canonicalizeSketchSplineDefinition(definition, policy);
  if (!geometry.ok) return geometry;
  return {
    ok: true,
    entity: {
      id,
      ...geometry.value,
      construction
    }
  };
}

function wrapIndex(index: number, count: number): number {
  return ((index % count) + count) % count;
}

function catmullRomPoint(
  p0: Vec2,
  p1: Vec2,
  p2: Vec2,
  p3: Vec2,
  t: number
): Vec2 {
  const t2 = t * t;
  const t3 = t2 * t;
  return [
    0.5 *
      (2 * p1[0] +
        (-p0[0] + p2[0]) * t +
        (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
        (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
    0.5 *
      (2 * p1[1] +
        (-p0[1] + p2[1]) * t +
        (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
        (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
  ];
}

function evaluateInterpolation(points: readonly Vec2[], closed: boolean, t: number): Vec2 {
  const count = points.length;
  if (count === 1) return points[0]!;
  const segments = closed ? count : count - 1;
  const scaled = Math.min(Math.max(t, 0), 1) * segments;
  const segment = Math.min(Math.floor(scaled), segments - 1);
  const local = scaled - segment;
  const p1 = points[wrapIndex(segment, count)]!;
  const p2 = points[wrapIndex(segment + 1, count)]!;
  const p0 = closed
    ? points[wrapIndex(segment - 1, count)]!
    : points[Math.max(0, segment - 1)]!;
  const p3 = closed
    ? points[wrapIndex(segment + 2, count)]!
    : points[Math.min(count - 1, segment + 2)]!;
  return catmullRomPoint(p0, p1, p2, p3, local);
}

function clampedKnots(controlCount: number, degree: number): number[] {
  const knotCount = controlCount + degree + 1;
  const knots: number[] = [];
  for (let index = 0; index < knotCount; index += 1) {
    if (index <= degree) {
      knots.push(0);
    } else if (index >= controlCount) {
      knots.push(1);
    } else {
      knots.push((index - degree) / (controlCount - degree));
    }
  }
  return knots;
}

function periodicKnots(controlCount: number, degree: number): number[] {
  const knots: number[] = [];
  for (let index = 0; index < controlCount + degree + 1; index += 1) {
    knots.push((index - degree) / controlCount);
  }
  return knots;
}

function deBoor(
  controls: readonly Vec2[],
  knots: readonly number[],
  degree: number,
  u: number
): Vec2 {
  let span = degree;
  const last = knots.length - degree - 2;
  while (span < last && knots[span + 1]! <= u) {
    span += 1;
  }
  const d: Vec2[] = [];
  for (let j = 0; j <= degree; j += 1) {
    d.push([
      controls[span - degree + j]![0],
      controls[span - degree + j]![1]
    ]);
  }
  for (let r = 1; r <= degree; r += 1) {
    for (let j = degree; j >= r; j -= 1) {
      const left = knots[span - degree + j]!;
      const right = knots[span + 1 + j - r]!;
      const denominator = right - left;
      const alpha = denominator === 0 ? 0 : (u - left) / denominator;
      d[j] = [
        (1 - alpha) * d[j - 1]![0] + alpha * d[j]![0],
        (1 - alpha) * d[j - 1]![1] + alpha * d[j]![1]
      ];
    }
  }
  return d[degree]!;
}

function evaluateControlPoints(
  points: readonly Vec2[],
  degree: number,
  closed: boolean,
  t: number
): Vec2 {
  const parameter = Math.min(Math.max(t, 0), 1);
  if (closed) {
    const wrapped = [
      ...points.slice(-degree),
      ...points,
      ...points.slice(0, degree)
    ];
    const knots = periodicKnots(points.length, degree);
    const u = parameter * points.length;
    const wrappedKnots = [
      ...knots.slice(0, degree).map((value) => value - 1),
      ...knots,
      ...knots.slice(-degree).map((value) => value + 1)
    ];
    return deBoor(wrapped, wrappedKnots, degree, u / points.length);
  }
  const knots = clampedKnots(points.length, degree);
  const u =
    parameter === 1
      ? knots[points.length]! - Number.EPSILON
      : parameter;
  return deBoor(points, knots, degree, u);
}

export function evaluateSketchSpline(
  entity: Pick<SketchSplineEntity, "form" | "points" | "degree" | "closed">,
  t: number
): Vec2 {
  if (entity.form === "interpolation") {
    return evaluateInterpolation(entity.points, entity.closed, t);
  }
  return evaluateControlPoints(
    entity.points,
    entity.degree,
    entity.closed,
    t
  );
}

export function sketchSplineSampleCount(
  entity: Pick<SketchSplineEntity, "points" | "closed">
): number {
  const spans = entity.closed ? entity.points.length : entity.points.length - 1;
  return Math.max(24, spans * 8);
}

export function sampleSketchSpline(
  entity: Pick<SketchSplineEntity, "form" | "points" | "degree" | "closed">,
  sampleCount = sketchSplineSampleCount(entity)
): Vec2[] {
  const last = entity.closed ? sampleCount : sampleCount;
  const samples: Vec2[] = [];
  const steps = entity.closed ? last : last;
  for (let index = 0; index <= steps; index += 1) {
    if (!entity.closed && index === steps) {
      samples.push(evaluateSketchSpline(entity, 1));
      break;
    }
    if (entity.closed && index === steps) {
      samples.push(samples[0] ?? evaluateSketchSpline(entity, 0));
      break;
    }
    samples.push(evaluateSketchSpline(entity, index / steps));
  }
  return samples;
}

export function sketchSplineEndpoints(
  entity: Pick<SketchSplineEntity, "form" | "points" | "degree" | "closed">
): { readonly start: Vec2; readonly end: Vec2 } {
  const start = evaluateSketchSpline(entity, 0);
  const end = entity.closed ? start : evaluateSketchSpline(entity, 1);
  return { start, end };
}

export function sketchSplineEndpointTangent(
  entity: Pick<SketchSplineEntity, "form" | "points" | "degree" | "closed">,
  endpoint: "start" | "end"
): Vec2 {
  const samples = sampleSketchSpline(entity);
  if (samples.length < 2) return [1, 0];
  if (endpoint === "start") {
    const next = samples[1]!;
    const first = samples[0]!;
    return [next[0] - first[0], next[1] - first[1]];
  }
  const last = samples[samples.length - 1]!;
  const previous = samples[samples.length - 2]!;
  return [last[0] - previous[0], last[1] - previous[1]];
}
