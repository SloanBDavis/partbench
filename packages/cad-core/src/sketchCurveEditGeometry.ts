import type {
  SketchArcEntity,
  SketchCircleEntitySnapshot,
  SketchLineEntitySnapshot,
  Vec2
} from "@web-cad/cad-protocol";

import {
  SKETCH_GEOMETRY_POLICY,
  type SketchGeometryPolicy
} from "./sketchGeometryPolicy";

export type SketchCurveEditEntity =
  | SketchLineEntitySnapshot
  | SketchCircleEntitySnapshot
  | SketchArcEntity;

export interface ResolvedSketchCurveLine {
  readonly kind: "line";
  readonly entityId: string;
  readonly start: Vec2;
  readonly end: Vec2;
  readonly direction: Vec2;
  readonly length: number;
}

export interface ResolvedSketchCurveCircle {
  readonly kind: "circle";
  readonly entityId: string;
  readonly center: Vec2;
  readonly radius: number;
}

export interface ResolvedSketchCurveArc {
  readonly kind: "arc";
  readonly entityId: string;
  readonly center: Vec2;
  readonly radius: number;
  readonly startAngleDegrees: number;
  readonly sweepAngleDegrees: number;
  readonly start: Vec2;
  readonly end: Vec2;
}

export type ResolvedSketchCurve =
  | ResolvedSketchCurveLine
  | ResolvedSketchCurveCircle
  | ResolvedSketchCurveArc;

export type SketchCurveGeometryDiagnosticCode =
  | "SKETCH_CURVE_GEOMETRY_NON_FINITE"
  | "SKETCH_CURVE_GEOMETRY_DEGENERATE"
  | "SKETCH_CURVE_SUPPORT_OVERLAP"
  | "SKETCH_CURVE_PROJECTION_AMBIGUOUS"
  | "SKETCH_CURVE_PARAMETER_INVALID";

export interface SketchCurveGeometryDiagnostic {
  readonly code: SketchCurveGeometryDiagnosticCode;
  readonly entityIds: readonly string[];
  readonly path: string;
  readonly message: string;
  readonly expected?: string;
  readonly received?: string;
}

export type SketchCurveResolution =
  | { readonly status: "ready"; readonly curve: ResolvedSketchCurve }
  | {
      readonly status: "blocked";
      readonly diagnostics: readonly SketchCurveGeometryDiagnostic[];
    };

export type SketchCurvePointLocation = "start" | "end" | "interior";

export interface SketchCurveIntersectionPoint {
  readonly point: Vec2;
  readonly leftParameter: number;
  readonly rightParameter: number;
  readonly kind: "crossing" | "tangent";
  readonly leftLocation: SketchCurvePointLocation;
  readonly rightLocation: SketchCurvePointLocation;
}

export type SketchCurveIntersectionResult =
  | {
      readonly status: "ready";
      readonly points: readonly SketchCurveIntersectionPoint[];
      readonly diagnostics: readonly [];
    }
  | {
      readonly status: "blocked";
      readonly points: readonly [];
      readonly diagnostics: readonly SketchCurveGeometryDiagnostic[];
    };

export interface SketchCurveProjection {
  readonly point: Vec2;
  readonly parameter: number;
  readonly distance: number;
  readonly location: SketchCurvePointLocation;
  readonly tangent: Vec2;
}

export type SketchCurveProjectionResult =
  | {
      readonly status: "ready";
      readonly projection: SketchCurveProjection;
      readonly diagnostics: readonly [];
    }
  | {
      readonly status: "blocked";
      readonly diagnostics: readonly SketchCurveGeometryDiagnostic[];
    };

export type SketchCurveParameterCollapseResult =
  | {
      readonly status: "ready";
      readonly parameters: readonly number[];
      readonly diagnostics: readonly [];
    }
  | {
      readonly status: "blocked";
      readonly diagnostics: readonly SketchCurveGeometryDiagnostic[];
    };

interface SupportIntersectionCandidate {
  readonly point: Vec2;
  readonly kind: "crossing" | "tangent";
}

type SupportIntersection =
  | {
      readonly relation: "points";
      readonly candidates: readonly SupportIntersectionCandidate[];
    }
  | { readonly relation: "clear" }
  | { readonly relation: "coincident" };

const FULL_TURN_DEGREES = 360;
const HALF_TURN_DEGREES = 180;
const DEGREES_PER_RADIAN = 180 / Math.PI;

function canonicalZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

function point(x: number, y: number): Vec2 {
  return [canonicalZero(x), canonicalZero(y)];
}

function isFinitePoint(value: Vec2): boolean {
  return Number.isFinite(value[0]) && Number.isFinite(value[1]);
}

function distance(left: Vec2, right: Vec2): number {
  return Math.hypot(left[0] - right[0], left[1] - right[1]);
}

function dot(left: Vec2, right: Vec2): number {
  return left[0] * right[0] + left[1] * right[1];
}

function cross(left: Vec2, right: Vec2): number {
  return left[0] * right[1] - left[1] * right[0];
}

function subtract(left: Vec2, right: Vec2): Vec2 {
  return point(left[0] - right[0], left[1] - right[1]);
}

function addScaled(origin: Vec2, direction: Vec2, scale: number): Vec2 {
  return point(
    origin[0] + direction[0] * scale,
    origin[1] + direction[1] * scale
  );
}

function normalizeDegrees(value: number): number {
  if (!Number.isFinite(value)) return Number.NaN;
  return canonicalZero(
    ((value % FULL_TURN_DEGREES) + FULL_TURN_DEGREES) % FULL_TURN_DEGREES
  );
}

function pointAtAngle(
  center: Vec2,
  radius: number,
  angleDegrees: number
): Vec2 {
  const radians = angleDegrees / DEGREES_PER_RADIAN;
  return point(
    center[0] + radius * Math.cos(radians),
    center[1] + radius * Math.sin(radians)
  );
}

function diagnostic(
  code: SketchCurveGeometryDiagnosticCode,
  entityIds: readonly string[],
  path: string,
  message: string,
  expected?: string,
  received?: string
): SketchCurveGeometryDiagnostic {
  return { code, entityIds, path, message, expected, received };
}

function blockedResolution(
  entityId: string,
  code: SketchCurveGeometryDiagnosticCode,
  path: string,
  message: string,
  expected?: string,
  received?: string
): SketchCurveResolution {
  return {
    status: "blocked",
    diagnostics: [
      diagnostic(code, [entityId], path, message, expected, received)
    ]
  };
}

export function resolveSketchCurveEditEntity(
  entity: SketchCurveEditEntity,
  policy: SketchGeometryPolicy = SKETCH_GEOMETRY_POLICY
): SketchCurveResolution {
  if (entity.kind === "line") {
    if (!isFinitePoint(entity.start) || !isFinitePoint(entity.end)) {
      return blockedResolution(
        entity.id,
        "SKETCH_CURVE_GEOMETRY_NON_FINITE",
        "entity",
        "Line endpoints must contain finite coordinates.",
        "two finite endpoints"
      );
    }
    const delta = subtract(entity.end, entity.start);
    const length = Math.hypot(...delta);
    if (!Number.isFinite(length)) {
      return blockedResolution(
        entity.id,
        "SKETCH_CURVE_GEOMETRY_NON_FINITE",
        "entity",
        "Line-derived geometry must remain finite."
      );
    }
    if (length <= policy.linearTolerance) {
      return blockedResolution(
        entity.id,
        "SKETCH_CURVE_GEOMETRY_DEGENERATE",
        "entity",
        "Line length must exceed the shared linear tolerance.",
        `>${policy.linearTolerance}`,
        String(length)
      );
    }
    return {
      status: "ready",
      curve: {
        kind: "line",
        entityId: entity.id,
        start: point(...entity.start),
        end: point(...entity.end),
        direction: point(delta[0] / length, delta[1] / length),
        length
      }
    };
  }

  if (
    !isFinitePoint(entity.center) ||
    !Number.isFinite(entity.radius) ||
    (entity.kind === "arc" &&
      (!Number.isFinite(entity.startAngleDegrees) ||
        !Number.isFinite(entity.sweepAngleDegrees)))
  ) {
    return blockedResolution(
      entity.id,
      "SKETCH_CURVE_GEOMETRY_NON_FINITE",
      "entity",
      "Circular curve geometry must contain only finite values."
    );
  }
  if (entity.radius <= policy.linearTolerance) {
    return blockedResolution(
      entity.id,
      "SKETCH_CURVE_GEOMETRY_DEGENERATE",
      "entity.radius",
      "Circular curve radius must exceed the shared linear tolerance.",
      `>${policy.linearTolerance}`,
      String(entity.radius)
    );
  }
  if (entity.kind === "circle") {
    return {
      status: "ready",
      curve: {
        kind: "circle",
        entityId: entity.id,
        center: point(...entity.center),
        radius: entity.radius
      }
    };
  }

  const sweepMagnitude = Math.abs(entity.sweepAngleDegrees);
  if (
    sweepMagnitude < policy.angularToleranceDegrees ||
    sweepMagnitude > FULL_TURN_DEGREES - policy.angularToleranceDegrees
  ) {
    return blockedResolution(
      entity.id,
      "SKETCH_CURVE_GEOMETRY_DEGENERATE",
      "entity.sweepAngleDegrees",
      "Arc sweep must satisfy the complete signed V17 domain.",
      `${policy.angularToleranceDegrees} <= abs(sweep) <= ${
        FULL_TURN_DEGREES - policy.angularToleranceDegrees
      }`,
      String(entity.sweepAngleDegrees)
    );
  }
  const startAngleDegrees = normalizeDegrees(entity.startAngleDegrees);
  const start = pointAtAngle(entity.center, entity.radius, startAngleDegrees);
  const end = pointAtAngle(
    entity.center,
    entity.radius,
    startAngleDegrees + entity.sweepAngleDegrees
  );
  if (!isFinitePoint(start) || !isFinitePoint(end)) {
    return blockedResolution(
      entity.id,
      "SKETCH_CURVE_GEOMETRY_NON_FINITE",
      "entity",
      "Arc-derived endpoints must remain finite."
    );
  }
  return {
    status: "ready",
    curve: {
      kind: "arc",
      entityId: entity.id,
      center: point(...entity.center),
      radius: entity.radius,
      startAngleDegrees,
      sweepAngleDegrees: canonicalZero(entity.sweepAngleDegrees),
      start,
      end
    }
  };
}

function circularCenter(
  curve: ResolvedSketchCurveCircle | ResolvedSketchCurveArc
): Vec2 {
  return curve.center;
}

function circularRadius(
  curve: ResolvedSketchCurveCircle | ResolvedSketchCurveArc
): number {
  return curve.radius;
}

function isCircularCurve(
  curve: ResolvedSketchCurve
): curve is ResolvedSketchCurveCircle | ResolvedSketchCurveArc {
  return curve.kind !== "line";
}

function parameterTolerance(
  curve: ResolvedSketchCurve,
  policy: SketchGeometryPolicy
): number {
  return curve.kind === "line"
    ? policy.linearTolerance
    : Math.min(
        HALF_TURN_DEGREES,
        (policy.linearTolerance / curve.radius) * DEGREES_PER_RADIAN
      );
}

export function getSketchCurveSupportParameter(
  curve: ResolvedSketchCurve,
  supportPoint: Vec2
): number {
  if (curve.kind === "line") {
    return canonicalZero(
      dot(subtract(supportPoint, curve.start), curve.direction)
    );
  }
  const polarDegrees = normalizeDegrees(
    Math.atan2(
      supportPoint[1] - curve.center[1],
      supportPoint[0] - curve.center[0]
    ) * DEGREES_PER_RADIAN
  );
  if (curve.kind === "circle") return polarDegrees;
  return canonicalZero(
    curve.sweepAngleDegrees >= 0
      ? normalizeDegrees(polarDegrees - curve.startAngleDegrees)
      : normalizeDegrees(curve.startAngleDegrees - polarDegrees)
  );
}

export function unwrapSketchCurveParameterNear(
  curve: ResolvedSketchCurveCircle | ResolvedSketchCurveArc,
  canonicalParameter: number,
  referenceParameter: number
): number {
  if (!Number.isFinite(curve.radius) || curve.radius <= 0) {
    return Number.NaN;
  }
  const normalized = normalizeDegrees(canonicalParameter);
  if (!Number.isFinite(normalized) || !Number.isFinite(referenceParameter)) {
    return Number.NaN;
  }
  const turn = Math.floor(
    (referenceParameter - normalized) / FULL_TURN_DEGREES
  );
  const lower = normalized + turn * FULL_TURN_DEGREES;
  const upper = lower + FULL_TURN_DEGREES;
  return canonicalZero(
    Math.abs(referenceParameter - lower) <= Math.abs(referenceParameter - upper)
      ? lower
      : upper
  );
}

function finiteParameter(
  curve: ResolvedSketchCurve,
  supportPoint: Vec2,
  policy: SketchGeometryPolicy
): number | undefined {
  const parameter = getSketchCurveSupportParameter(curve, supportPoint);
  const tolerance = parameterTolerance(curve, policy);
  if (curve.kind === "circle") return parameter;
  const maximum =
    curve.kind === "line" ? curve.length : Math.abs(curve.sweepAngleDegrees);
  if (curve.kind === "line") {
    if (parameter < -tolerance || parameter > maximum + tolerance) {
      return undefined;
    }
    return canonicalZero(Math.max(0, Math.min(maximum, parameter)));
  }
  if (parameter <= maximum + tolerance) {
    return parameter > maximum ? maximum : parameter;
  }
  if (curve.kind === "arc" && FULL_TURN_DEGREES - parameter <= tolerance) {
    return 0;
  }
  return undefined;
}

function curvePointAtParameter(
  curve: ResolvedSketchCurve,
  parameter: number
): Vec2 {
  if (curve.kind === "line") {
    return addScaled(curve.start, curve.direction, parameter);
  }
  if (curve.kind === "circle") {
    return pointAtAngle(curve.center, curve.radius, parameter);
  }
  const direction = Math.sign(curve.sweepAngleDegrees);
  return pointAtAngle(
    curve.center,
    curve.radius,
    curve.startAngleDegrees + direction * parameter
  );
}

function curveTangentAtParameter(
  curve: ResolvedSketchCurve,
  parameter: number
): Vec2 {
  if (curve.kind === "line") return curve.direction;
  const polarDegrees =
    curve.kind === "circle"
      ? parameter
      : curve.startAngleDegrees +
        Math.sign(curve.sweepAngleDegrees) * parameter;
  const radians = polarDegrees / DEGREES_PER_RADIAN;
  const direction =
    curve.kind === "arc" ? Math.sign(curve.sweepAngleDegrees) : 1;
  return point(-Math.sin(radians) * direction, Math.cos(radians) * direction);
}

function lineLineSupportIntersection(
  left: ResolvedSketchCurveLine,
  right: ResolvedSketchCurveLine,
  policy: SketchGeometryPolicy
): SupportIntersection {
  const denominator = cross(left.direction, right.direction);
  const parallelTolerance =
    Number.EPSILON *
    Math.max(
      1,
      Math.abs(left.direction[0]),
      Math.abs(left.direction[1]),
      Math.abs(right.direction[0]),
      Math.abs(right.direction[1])
    ) *
    8;
  const offset = subtract(right.start, left.start);
  if (Math.abs(denominator) <= parallelTolerance) {
    return Math.abs(cross(offset, left.direction)) <= policy.linearTolerance
      ? { relation: "coincident" }
      : { relation: "clear" };
  }
  const leftParameter = cross(offset, right.direction) / denominator;
  const intersectionPoint = addScaled(
    left.start,
    left.direction,
    leftParameter
  );
  return isFinitePoint(intersectionPoint)
    ? {
        relation: "points",
        candidates: [{ point: intersectionPoint, kind: "crossing" }]
      }
    : { relation: "clear" };
}

function lineCircleSupportIntersection(
  line: ResolvedSketchCurveLine,
  circle: ResolvedSketchCurveCircle | ResolvedSketchCurveArc,
  policy: SketchGeometryPolicy
): SupportIntersection {
  const toCenter = subtract(circle.center, line.start);
  const along = dot(toCenter, line.direction);
  const closest = addScaled(line.start, line.direction, along);
  const perpendicularDistance = distance(closest, circle.center);
  const radialGap = perpendicularDistance - circle.radius;
  if (radialGap > policy.linearTolerance) return { relation: "clear" };

  const halfChordSquared =
    (circle.radius - perpendicularDistance) *
    (circle.radius + perpendicularDistance);
  if (!Number.isFinite(halfChordSquared)) return { relation: "clear" };
  if (
    radialGap >= 0 ||
    halfChordSquared <= policy.linearTolerance * policy.linearTolerance
  ) {
    return {
      relation: "points",
      candidates: [{ point: closest, kind: "tangent" }]
    };
  }
  const halfChord = Math.sqrt(Math.max(0, halfChordSquared));
  const first = addScaled(line.start, line.direction, along - halfChord);
  const second = addScaled(line.start, line.direction, along + halfChord);
  return isFinitePoint(first) && isFinitePoint(second)
    ? {
        relation: "points",
        candidates: [
          { point: first, kind: "crossing" },
          { point: second, kind: "crossing" }
        ]
      }
    : { relation: "clear" };
}

function circleCircleSupportIntersection(
  left: ResolvedSketchCurveCircle | ResolvedSketchCurveArc,
  right: ResolvedSketchCurveCircle | ResolvedSketchCurveArc,
  policy: SketchGeometryPolicy
): SupportIntersection {
  const centerDistance = distance(left.center, right.center);
  const radiusGap = Math.abs(left.radius - right.radius);
  if (
    centerDistance <= policy.linearTolerance &&
    radiusGap <= policy.linearTolerance
  ) {
    return { relation: "coincident" };
  }
  if (
    !Number.isFinite(centerDistance) ||
    centerDistance <= policy.linearTolerance
  ) {
    return { relation: "clear" };
  }

  const radiusSum = left.radius + right.radius;
  const externalGap = centerDistance - radiusSum;
  const internalGap = radiusGap - centerDistance;
  if (
    externalGap > policy.linearTolerance ||
    internalGap > policy.linearTolerance
  ) {
    return { relation: "clear" };
  }

  const direction = point(
    (right.center[0] - left.center[0]) / centerDistance,
    (right.center[1] - left.center[1]) / centerDistance
  );
  const along =
    (left.radius * left.radius -
      right.radius * right.radius +
      centerDistance * centerDistance) /
    (2 * centerDistance);
  const base = addScaled(left.center, direction, along);
  const heightSquared = left.radius * left.radius - along * along;
  if (!Number.isFinite(heightSquared) || !isFinitePoint(base)) {
    return { relation: "clear" };
  }
  if (
    externalGap >= 0 ||
    internalGap >= 0 ||
    heightSquared <= policy.linearTolerance * policy.linearTolerance
  ) {
    return {
      relation: "points",
      candidates: [{ point: base, kind: "tangent" }]
    };
  }
  const height = Math.sqrt(Math.max(0, heightSquared));
  const perpendicular = point(-direction[1], direction[0]);
  return {
    relation: "points",
    candidates: [
      {
        point: addScaled(base, perpendicular, height),
        kind: "crossing"
      },
      {
        point: addScaled(base, perpendicular, -height),
        kind: "crossing"
      }
    ]
  };
}

function supportIntersection(
  left: ResolvedSketchCurve,
  right: ResolvedSketchCurve,
  policy: SketchGeometryPolicy
): SupportIntersection {
  if (left.kind === "line" && right.kind === "line") {
    return lineLineSupportIntersection(left, right, policy);
  }
  if (left.kind === "line" && isCircularCurve(right)) {
    return lineCircleSupportIntersection(left, right, policy);
  }
  if (isCircularCurve(left) && right.kind === "line") {
    return lineCircleSupportIntersection(right, left, policy);
  }
  return circleCircleSupportIntersection(
    left as ResolvedSketchCurveCircle | ResolvedSketchCurveArc,
    right as ResolvedSketchCurveCircle | ResolvedSketchCurveArc,
    policy
  );
}

function intervalsForArc(
  arc: ResolvedSketchCurveArc
): readonly (readonly [number, number])[] {
  const low =
    arc.sweepAngleDegrees >= 0
      ? arc.startAngleDegrees
      : normalizeDegrees(arc.startAngleDegrees + arc.sweepAngleDegrees);
  const high = low + Math.abs(arc.sweepAngleDegrees);
  return high <= FULL_TURN_DEGREES
    ? [[low, high]]
    : [
        [low, FULL_TURN_DEGREES],
        [0, high - FULL_TURN_DEGREES]
      ];
}

function coincidentFiniteCandidates(
  left: ResolvedSketchCurve,
  right: ResolvedSketchCurve,
  leftFinite: boolean,
  rightFinite: boolean,
  policy: SketchGeometryPolicy
):
  | { readonly relation: "overlap" }
  | {
      readonly relation: "points";
      readonly candidates: readonly SupportIntersectionCandidate[];
    }
  | { readonly relation: "clear" } {
  if (!leftFinite && !rightFinite) return { relation: "overlap" };
  if (!leftFinite || !rightFinite) {
    const finite = leftFinite ? left : right;
    return finite.kind === "line" ||
      finite.kind === "circle" ||
      Math.abs(finite.sweepAngleDegrees) > parameterTolerance(finite, policy)
      ? { relation: "overlap" }
      : { relation: "clear" };
  }

  if (left.kind === "line" && right.kind === "line") {
    const rightStart = getSketchCurveSupportParameter(left, right.start);
    const rightEnd = getSketchCurveSupportParameter(left, right.end);
    const low = Math.max(0, Math.min(rightStart, rightEnd));
    const high = Math.min(left.length, Math.max(rightStart, rightEnd));
    if (high < low - policy.linearTolerance) return { relation: "clear" };
    if (high - low > policy.linearTolerance) return { relation: "overlap" };
    return {
      relation: "points",
      candidates: [
        {
          point: curvePointAtParameter(left, (low + high) / 2),
          kind: "tangent"
        }
      ]
    };
  }

  if (!isCircularCurve(left) || !isCircularCurve(right)) {
    return { relation: "clear" };
  }
  if (left.kind === "circle" || right.kind === "circle") {
    return { relation: "overlap" };
  }

  const tolerance = Math.max(
    parameterTolerance(left, policy),
    parameterTolerance(right, policy)
  );
  for (const leftInterval of intervalsForArc(left)) {
    for (const rightInterval of intervalsForArc(right)) {
      const low = Math.max(leftInterval[0], rightInterval[0]);
      const high = Math.min(leftInterval[1], rightInterval[1]);
      if (high - low > tolerance) return { relation: "overlap" };
    }
  }
  const endpointCandidates = [left.start, left.end, right.start, right.end]
    .filter(
      (candidate) =>
        finiteParameter(left, candidate, policy) !== undefined &&
        finiteParameter(right, candidate, policy) !== undefined
    )
    .sort(comparePoints);
  const unique = collapsePointCandidates(
    endpointCandidates.map((candidate) => ({
      point: candidate,
      kind: "tangent" as const
    })),
    policy
  );
  return unique.length > 0
    ? { relation: "points", candidates: unique }
    : { relation: "clear" };
}

function comparePoints(left: Vec2, right: Vec2): number {
  return left[0] - right[0] || left[1] - right[1];
}

function collapsePointCandidates(
  candidates: readonly SupportIntersectionCandidate[],
  policy: SketchGeometryPolicy
): readonly SupportIntersectionCandidate[] {
  const ordered = [...candidates].sort((left, right) =>
    comparePoints(left.point, right.point)
  );
  const result: SupportIntersectionCandidate[] = [];
  for (const candidate of ordered) {
    const prior = result.find(
      (value) =>
        distance(value.point, candidate.point) <= policy.linearTolerance
    );
    if (!prior) {
      result.push(candidate);
    } else if (candidate.kind === "tangent" && prior.kind !== "tangent") {
      result[result.indexOf(prior)] = candidate;
    }
  }
  return result;
}

function locationAtParameter(
  curve: ResolvedSketchCurve,
  parameter: number,
  policy: SketchGeometryPolicy
): SketchCurvePointLocation {
  if (curve.kind === "circle") return "interior";
  const tolerance = parameterTolerance(curve, policy);
  const maximum =
    curve.kind === "line" ? curve.length : Math.abs(curve.sweepAngleDegrees);
  if (Math.abs(parameter) <= tolerance) return "start";
  if (Math.abs(maximum - parameter) <= tolerance) return "end";
  return "interior";
}

function intersectWithFiniteFlags(
  left: ResolvedSketchCurve,
  right: ResolvedSketchCurve,
  leftFinite: boolean,
  rightFinite: boolean,
  policy: SketchGeometryPolicy
): SketchCurveIntersectionResult {
  const support = supportIntersection(left, right, policy);
  let candidates: readonly SupportIntersectionCandidate[];
  if (support.relation === "coincident") {
    const coincident = coincidentFiniteCandidates(
      left,
      right,
      leftFinite,
      rightFinite,
      policy
    );
    if (coincident.relation === "overlap") {
      return {
        status: "blocked",
        points: [],
        diagnostics: [
          diagnostic(
            "SKETCH_CURVE_SUPPORT_OVERLAP",
            [left.entityId, right.entityId],
            "curves",
            "Coincident curve supports share a finite interval; overlap cannot be represented as intersection points."
          )
        ]
      };
    }
    candidates = coincident.relation === "points" ? coincident.candidates : [];
  } else {
    candidates = support.relation === "points" ? support.candidates : [];
  }

  const filtered = collapsePointCandidates(
    candidates.filter(
      (candidate) =>
        (!leftFinite ||
          finiteParameter(left, candidate.point, policy) !== undefined) &&
        (!rightFinite ||
          finiteParameter(right, candidate.point, policy) !== undefined)
    ),
    policy
  );
  const points = filtered
    .map<SketchCurveIntersectionPoint>((candidate) => {
      const leftParameter =
        finiteParameter(left, candidate.point, policy) ??
        getSketchCurveSupportParameter(left, candidate.point);
      const rightParameter =
        finiteParameter(right, candidate.point, policy) ??
        getSketchCurveSupportParameter(right, candidate.point);
      return {
        point: candidate.point,
        leftParameter,
        rightParameter,
        kind: candidate.kind,
        leftLocation: locationAtParameter(left, leftParameter, policy),
        rightLocation: locationAtParameter(right, rightParameter, policy)
      };
    })
    .sort(
      (first, second) =>
        first.leftParameter - second.leftParameter ||
        first.rightParameter - second.rightParameter ||
        comparePoints(first.point, second.point)
    );
  return { status: "ready", points, diagnostics: [] };
}

export function intersectFiniteSketchCurves(
  left: ResolvedSketchCurve,
  right: ResolvedSketchCurve,
  policy: SketchGeometryPolicy = SKETCH_GEOMETRY_POLICY
): SketchCurveIntersectionResult {
  return intersectWithFiniteFlags(left, right, true, true, policy);
}

export function intersectSketchCurveInfiniteSupports(
  left: ResolvedSketchCurve,
  right: ResolvedSketchCurve,
  policy: SketchGeometryPolicy = SKETCH_GEOMETRY_POLICY
): SketchCurveIntersectionResult {
  return intersectWithFiniteFlags(left, right, false, false, policy);
}

export function intersectSketchCurveSupportWithFiniteCurve(
  targetSupport: ResolvedSketchCurve,
  finiteBoundary: ResolvedSketchCurve,
  policy: SketchGeometryPolicy = SKETCH_GEOMETRY_POLICY
): SketchCurveIntersectionResult {
  return intersectWithFiniteFlags(
    targetSupport,
    finiteBoundary,
    false,
    true,
    policy
  );
}

function ambiguousProjection(
  curve: ResolvedSketchCurve,
  message: string
): SketchCurveProjectionResult {
  return {
    status: "blocked",
    diagnostics: [
      diagnostic(
        "SKETCH_CURVE_PROJECTION_AMBIGUOUS",
        [curve.entityId],
        "queryPoint",
        message
      )
    ]
  };
}

export function projectPointToFiniteSketchCurve(
  curve: ResolvedSketchCurve,
  queryPoint: Vec2,
  policy: SketchGeometryPolicy = SKETCH_GEOMETRY_POLICY
): SketchCurveProjectionResult {
  if (!isFinitePoint(queryPoint)) {
    return {
      status: "blocked",
      diagnostics: [
        diagnostic(
          "SKETCH_CURVE_GEOMETRY_NON_FINITE",
          [curve.entityId],
          "queryPoint",
          "Projection point must contain two finite coordinates."
        )
      ]
    };
  }

  if (curve.kind === "line") {
    const supportParameter = getSketchCurveSupportParameter(curve, queryPoint);
    const parameter = Math.max(0, Math.min(curve.length, supportParameter));
    const projectedPoint = curvePointAtParameter(curve, parameter);
    return {
      status: "ready",
      projection: {
        point: projectedPoint,
        parameter,
        distance: distance(queryPoint, projectedPoint),
        location: locationAtParameter(curve, parameter, policy),
        tangent: curve.direction
      },
      diagnostics: []
    };
  }

  const centerDistance = distance(queryPoint, circularCenter(curve));
  if (!Number.isFinite(centerDistance)) {
    return ambiguousProjection(
      curve,
      "Projection did not produce a finite circular distance."
    );
  }
  if (centerDistance <= policy.linearTolerance) {
    return ambiguousProjection(
      curve,
      "A point at the circular center has no unique closest polar projection."
    );
  }

  const polarParameter = normalizeDegrees(
    Math.atan2(
      queryPoint[1] - curve.center[1],
      queryPoint[0] - curve.center[0]
    ) * DEGREES_PER_RADIAN
  );
  if (curve.kind === "circle") {
    const projectedPoint = curvePointAtParameter(curve, polarParameter);
    return {
      status: "ready",
      projection: {
        point: projectedPoint,
        parameter: polarParameter,
        distance: Math.abs(centerDistance - circularRadius(curve)),
        location: "interior",
        tangent: curveTangentAtParameter(curve, polarParameter)
      },
      diagnostics: []
    };
  }

  const onArcParameter = finiteParameter(
    curve,
    pointAtAngle(curve.center, curve.radius, polarParameter),
    policy
  );
  if (onArcParameter !== undefined) {
    const projectedPoint = curvePointAtParameter(curve, onArcParameter);
    return {
      status: "ready",
      projection: {
        point: projectedPoint,
        parameter: onArcParameter,
        distance: distance(queryPoint, projectedPoint),
        location: locationAtParameter(curve, onArcParameter, policy),
        tangent: curveTangentAtParameter(curve, onArcParameter)
      },
      diagnostics: []
    };
  }

  const endpointCandidates = [
    {
      point: curve.start,
      parameter: 0,
      distance: distance(queryPoint, curve.start),
      location: "start" as const
    },
    {
      point: curve.end,
      parameter: Math.abs(curve.sweepAngleDegrees),
      distance: distance(queryPoint, curve.end),
      location: "end" as const
    }
  ].sort(
    (left, right) =>
      left.distance - right.distance || left.parameter - right.parameter
  );
  const closest = endpointCandidates[0]!;
  const second = endpointCandidates[1]!;
  if (Math.abs(closest.distance - second.distance) <= policy.linearTolerance) {
    return ambiguousProjection(
      curve,
      "The finite arc endpoints are equally close within the shared linear tolerance."
    );
  }
  return {
    status: "ready",
    projection: {
      ...closest,
      tangent: curveTangentAtParameter(curve, closest.parameter)
    },
    diagnostics: []
  };
}

export function collapseSketchCurveParameters(
  curve: ResolvedSketchCurve,
  values: readonly number[],
  policy: SketchGeometryPolicy = SKETCH_GEOMETRY_POLICY
): SketchCurveParameterCollapseResult {
  const invalidIndex = values.findIndex((value) => !Number.isFinite(value));
  if (invalidIndex >= 0) {
    return {
      status: "blocked",
      diagnostics: [
        diagnostic(
          "SKETCH_CURVE_PARAMETER_INVALID",
          [curve.entityId],
          `parameters[${invalidIndex}]`,
          "Curve parameters must be finite.",
          "finite number",
          String(values[invalidIndex])
        )
      ]
    };
  }

  const tolerance = parameterTolerance(curve, policy);
  let normalized: number[];
  if (curve.kind === "circle") {
    normalized = values
      .map(normalizeDegrees)
      .sort((left, right) => left - right);
  } else {
    const maximum =
      curve.kind === "line" ? curve.length : Math.abs(curve.sweepAngleDegrees);
    const outOfRangeIndex = values.findIndex(
      (value) => value < -tolerance || value > maximum + tolerance
    );
    if (outOfRangeIndex >= 0) {
      return {
        status: "blocked",
        diagnostics: [
          diagnostic(
            "SKETCH_CURVE_PARAMETER_INVALID",
            [curve.entityId],
            `parameters[${outOfRangeIndex}]`,
            "Finite curve parameter is outside the authored domain.",
            `0 <= parameter <= ${maximum}`,
            String(values[outOfRangeIndex])
          )
        ]
      };
    }
    normalized = values
      .map((value) => canonicalZero(Math.max(0, Math.min(maximum, value))))
      .sort((left, right) => left - right);
  }

  const collapsed: number[] = [];
  for (const value of normalized) {
    const prior = collapsed.at(-1);
    if (prior === undefined || value - prior > tolerance) {
      collapsed.push(value);
    }
  }
  if (
    curve.kind === "circle" &&
    collapsed.length > 1 &&
    FULL_TURN_DEGREES - collapsed.at(-1)! + collapsed[0]! <= tolerance
  ) {
    collapsed.shift();
    collapsed.pop();
    collapsed.unshift(0);
  }
  return { status: "ready", parameters: collapsed, diagnostics: [] };
}
