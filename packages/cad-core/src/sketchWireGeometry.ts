import type {
  SketchArcEntity,
  SketchLineEntitySnapshot,
  Vec2
} from "@web-cad/cad-protocol";

import {
  SKETCH_GEOMETRY_POLICY,
  type SketchGeometryPolicy
} from "./sketchGeometryPolicy";

export type SketchWireEntity = SketchLineEntitySnapshot | SketchArcEntity;
export type SketchSegmentOrientation = "forward" | "reverse";
export type SketchSegmentEndpoint = "start" | "end";

interface ResolvedSketchSegmentBase {
  readonly entityId: string;
  readonly orientation: SketchSegmentOrientation;
  readonly start: Vec2;
  readonly end: Vec2;
}

export interface ResolvedSketchLineSegment extends ResolvedSketchSegmentBase {
  readonly kind: "line";
}

export interface ResolvedSketchArcSegment extends ResolvedSketchSegmentBase {
  readonly kind: "arc";
  readonly center: Vec2;
  readonly radius: number;
  readonly startAngleRadians: number;
  readonly sweepAngleRadians: number;
}

export type ResolvedSketchSegment =
  | ResolvedSketchLineSegment
  | ResolvedSketchArcSegment;

export type SketchSegmentResolutionIssueCode =
  | "SKETCH_SEGMENT_GEOMETRY_NON_FINITE"
  | "SKETCH_LINE_ZERO_LENGTH"
  | "SKETCH_ARC_RADIUS_INVALID"
  | "SKETCH_ARC_SWEEP_INVALID";

export interface SketchSegmentResolutionIssue {
  readonly code: SketchSegmentResolutionIssueCode;
  readonly entityId: string;
  readonly message: string;
}

export type SketchSegmentResolution =
  | { readonly ok: true; readonly segment: ResolvedSketchSegment }
  | { readonly ok: false; readonly issue: SketchSegmentResolutionIssue };

export type SketchSegmentPointLocation = SketchSegmentEndpoint | "interior";

export interface SketchSegmentIntersectionPoint {
  readonly point: Vec2;
  readonly kind: "crossing" | "tangent";
  readonly leftLocation: SketchSegmentPointLocation;
  readonly rightLocation: SketchSegmentPointLocation;
}

export interface SketchSegmentIntersection {
  /** True when the segments share a finite interval, not merely one point. */
  readonly overlap: boolean;
  readonly points: readonly SketchSegmentIntersectionPoint[];
}

export interface SketchSegmentBounds {
  readonly min: Vec2;
  readonly max: Vec2;
}

const TWO_PI = 2 * Math.PI;

function isFinitePoint(point: Vec2): boolean {
  return Number.isFinite(point[0]) && Number.isFinite(point[1]);
}

function distance(left: Vec2, right: Vec2): number {
  return Math.hypot(left[0] - right[0], left[1] - right[1]);
}

function normalizeRadians(angle: number): number {
  const normalized = ((angle % TWO_PI) + TWO_PI) % TWO_PI;
  return Object.is(normalized, -0) ? 0 : normalized;
}

function numericTolerance(...values: readonly number[]): number {
  return (
    Number.EPSILON * Math.max(1, ...values.map((value) => Math.abs(value))) * 32
  );
}

function pointAt(center: Vec2, radius: number, angle: number): Vec2 {
  return [
    center[0] + radius * Math.cos(angle),
    center[1] + radius * Math.sin(angle)
  ];
}

function resolutionIssue(
  entityId: string,
  code: SketchSegmentResolutionIssueCode,
  message: string
): SketchSegmentResolution {
  return { ok: false, issue: { entityId, code, message } };
}

/** Resolve authored line/arc source into an oriented, finite analytic segment. */
export function resolveOrientedSketchSegment(
  entity: SketchWireEntity,
  orientation: SketchSegmentOrientation,
  policy: SketchGeometryPolicy = SKETCH_GEOMETRY_POLICY
): SketchSegmentResolution {
  if (entity.kind === "line") {
    if (!isFinitePoint(entity.start) || !isFinitePoint(entity.end)) {
      return resolutionIssue(
        entity.id,
        "SKETCH_SEGMENT_GEOMETRY_NON_FINITE",
        "Line endpoints must contain finite coordinates."
      );
    }
    if (distance(entity.start, entity.end) <= policy.linearTolerance) {
      return resolutionIssue(
        entity.id,
        "SKETCH_LINE_ZERO_LENGTH",
        "Line length must be greater than the sketch linear tolerance."
      );
    }
    const forward = orientation === "forward";
    return {
      ok: true,
      segment: {
        entityId: entity.id,
        kind: "line",
        orientation,
        start: forward ? entity.start : entity.end,
        end: forward ? entity.end : entity.start
      }
    };
  }

  if (
    !isFinitePoint(entity.center) ||
    !Number.isFinite(entity.radius) ||
    !Number.isFinite(entity.startAngleDegrees) ||
    !Number.isFinite(entity.sweepAngleDegrees)
  ) {
    return resolutionIssue(
      entity.id,
      "SKETCH_SEGMENT_GEOMETRY_NON_FINITE",
      "Arc geometry must contain only finite values."
    );
  }
  if (entity.radius <= policy.linearTolerance) {
    return resolutionIssue(
      entity.id,
      "SKETCH_ARC_RADIUS_INVALID",
      "Arc radius must be greater than the sketch linear tolerance."
    );
  }
  const sweepMagnitude = Math.abs(entity.sweepAngleDegrees);
  if (
    sweepMagnitude < policy.angularToleranceDegrees ||
    sweepMagnitude > 360 - policy.angularToleranceDegrees
  ) {
    return resolutionIssue(
      entity.id,
      "SKETCH_ARC_SWEEP_INVALID",
      "Arc sweep must be bounded away from zero and a full circle."
    );
  }

  const authoredStart = (entity.startAngleDegrees * Math.PI) / 180;
  const authoredSweep = (entity.sweepAngleDegrees * Math.PI) / 180;
  const forward = orientation === "forward";
  const startAngleRadians = forward
    ? authoredStart
    : authoredStart + authoredSweep;
  const sweepAngleRadians = forward ? authoredSweep : -authoredSweep;
  return {
    ok: true,
    segment: {
      entityId: entity.id,
      kind: "arc",
      orientation,
      center: entity.center,
      radius: entity.radius,
      startAngleRadians,
      sweepAngleRadians,
      start: pointAt(entity.center, entity.radius, startAngleRadians),
      end: pointAt(
        entity.center,
        entity.radius,
        startAngleRadians + sweepAngleRadians
      )
    }
  };
}

export function areSketchPointsCoincident(
  left: Vec2,
  right: Vec2,
  policy: SketchGeometryPolicy = SKETCH_GEOMETRY_POLICY
): boolean {
  return distance(left, right) <= policy.linearTolerance;
}

function arcContainsAngle(
  arc: ResolvedSketchArcSegment,
  angle: number,
  includeEndpoints = true
): boolean {
  const progress =
    arc.sweepAngleRadians >= 0
      ? normalizeRadians(angle - arc.startAngleRadians)
      : normalizeRadians(arc.startAngleRadians - angle);
  const limit = Math.abs(arc.sweepAngleRadians);
  const tolerance = numericTolerance(angle, arc.startAngleRadians, limit);
  return includeEndpoints
    ? progress <= limit + tolerance || TWO_PI - progress <= tolerance
    : progress > tolerance && progress < limit - tolerance;
}

function pointLocation(
  segment: ResolvedSketchSegment,
  point: Vec2,
  policy: SketchGeometryPolicy
): SketchSegmentPointLocation {
  if (areSketchPointsCoincident(segment.start, point, policy)) return "start";
  if (areSketchPointsCoincident(segment.end, point, policy)) return "end";
  return "interior";
}

function tangentAtPoint(segment: ResolvedSketchSegment, point: Vec2): Vec2 {
  if (segment.kind === "line") {
    return unitVector([
      segment.end[0] - segment.start[0],
      segment.end[1] - segment.start[1]
    ]);
  }
  const radial = unitVector([
    point[0] - segment.center[0],
    point[1] - segment.center[1]
  ]);
  const direction = Math.sign(segment.sweepAngleRadians);
  return [-radial[1] * direction, radial[0] * direction];
}

function createIntersectionPoint(
  left: ResolvedSketchSegment,
  right: ResolvedSketchSegment,
  point: Vec2,
  policy: SketchGeometryPolicy
): SketchSegmentIntersectionPoint {
  const leftTangent = tangentAtPoint(left, point);
  const rightTangent = tangentAtPoint(right, point);
  const tangentThreshold = numericTolerance(...leftTangent, ...rightTangent);
  return {
    point,
    kind:
      Math.abs(cross(leftTangent, rightTangent)) <= tangentThreshold
        ? "tangent"
        : "crossing",
    leftLocation: pointLocation(left, point, policy),
    rightLocation: pointLocation(right, point, policy)
  };
}

function cross(left: Vec2, right: Vec2): number {
  return left[0] * right[1] - left[1] * right[0];
}

function dot(left: Vec2, right: Vec2): number {
  return left[0] * right[0] + left[1] * right[1];
}

function unitVector(vector: Vec2): Vec2 {
  const length = Math.hypot(vector[0], vector[1]);
  return [vector[0] / length, vector[1] / length];
}

function uniquePoints(
  points: readonly Vec2[],
  policy: SketchGeometryPolicy
): Vec2[] {
  const unique: Vec2[] = [];
  for (const point of points) {
    if (
      !unique.some((candidate) =>
        areSketchPointsCoincident(candidate, point, policy)
      )
    ) {
      unique.push(point);
    }
  }
  return unique;
}

function lineLineIntersection(
  left: ResolvedSketchLineSegment,
  right: ResolvedSketchLineSegment
): { readonly overlap: boolean; readonly points: readonly Vec2[] } {
  const r: Vec2 = [left.end[0] - left.start[0], left.end[1] - left.start[1]];
  const s: Vec2 = [
    right.end[0] - right.start[0],
    right.end[1] - right.start[1]
  ];
  const offset: Vec2 = [
    right.start[0] - left.start[0],
    right.start[1] - left.start[1]
  ];
  const denominator = cross(r, s);
  const scale = Math.hypot(...r) * Math.hypot(...s);
  const parallel = Math.abs(denominator) <= numericTolerance(scale);
  if (!parallel) {
    const t = cross(offset, s) / denominator;
    const u = cross(offset, r) / denominator;
    const leftTolerance = numericTolerance(t);
    const rightTolerance = numericTolerance(u);
    if (
      t < -leftTolerance ||
      t > 1 + leftTolerance ||
      u < -rightTolerance ||
      u > 1 + rightTolerance
    ) {
      return { overlap: false, points: [] };
    }
    return {
      overlap: false,
      points: [[left.start[0] + t * r[0], left.start[1] + t * r[1]]]
    };
  }

  const offsetCross = cross(offset, r);
  if (Math.abs(offsetCross) > numericTolerance(offsetCross, ...offset, ...r)) {
    return { overlap: false, points: [] };
  }
  const lengthSquared = dot(r, r);
  const t0 = dot(offset, r) / lengthSquared;
  const t1 = t0 + dot(s, r) / lengthSquared;
  const low = Math.max(0, Math.min(t0, t1));
  const high = Math.min(1, Math.max(t0, t1));
  const parameterTolerance = numericTolerance(t0, t1);
  if (high < low - parameterTolerance) return { overlap: false, points: [] };
  if (high - low <= parameterTolerance) {
    const t = (low + high) / 2;
    return {
      overlap: false,
      points: [[left.start[0] + t * r[0], left.start[1] + t * r[1]]]
    };
  }
  return { overlap: true, points: [] };
}

function lineArcIntersection(
  line: ResolvedSketchLineSegment,
  arc: ResolvedSketchArcSegment,
  policy: SketchGeometryPolicy
): readonly Vec2[] {
  const direction: Vec2 = [
    line.end[0] - line.start[0],
    line.end[1] - line.start[1]
  ];
  const relative: Vec2 = [
    line.start[0] - arc.center[0],
    line.start[1] - arc.center[1]
  ];
  const a = dot(direction, direction);
  const b = 2 * dot(relative, direction);
  const c = dot(relative, relative) - arc.radius * arc.radius;
  const discriminant = b * b - 4 * a * c;
  const discriminantTolerance = numericTolerance(b * b, 4 * a * c);
  if (discriminant < -discriminantTolerance) return [];
  const root = Math.sqrt(Math.max(0, discriminant));
  const parameters =
    root === 0
      ? [-b / (2 * a)]
      : [(-b - root) / (2 * a), (-b + root) / (2 * a)];
  const parameterTolerance = numericTolerance(...parameters);
  return uniquePoints(
    parameters
      .filter(
        (parameter) =>
          parameter >= -parameterTolerance &&
          parameter <= 1 + parameterTolerance
      )
      .map<Vec2>((parameter) => [
        line.start[0] + parameter * direction[0],
        line.start[1] + parameter * direction[1]
      ])
      .filter((point) =>
        arcContainsAngle(
          arc,
          Math.atan2(point[1] - arc.center[1], point[0] - arc.center[0])
        )
      ),
    policy
  );
}

function circleSupportCoincident(
  left: ResolvedSketchArcSegment,
  right: ResolvedSketchArcSegment
): boolean {
  const scale = Math.max(
    left.radius,
    right.radius,
    ...left.center.map(Math.abs),
    ...right.center.map(Math.abs)
  );
  const tolerance = numericTolerance(scale);
  return (
    distance(left.center, right.center) <= tolerance &&
    Math.abs(left.radius - right.radius) <= tolerance
  );
}

interface AngularInterval {
  readonly start: number;
  readonly end: number;
}

function arcIntervals(
  arc: ResolvedSketchArcSegment
): readonly AngularInterval[] {
  const start =
    arc.sweepAngleRadians >= 0
      ? normalizeRadians(arc.startAngleRadians)
      : normalizeRadians(arc.startAngleRadians + arc.sweepAngleRadians);
  const end = start + Math.abs(arc.sweepAngleRadians);
  return end <= TWO_PI
    ? [{ start, end }]
    : [
        { start, end: TWO_PI },
        { start: 0, end: end - TWO_PI }
      ];
}

function coincidentArcIntersection(
  left: ResolvedSketchArcSegment,
  right: ResolvedSketchArcSegment,
  policy: SketchGeometryPolicy
): { readonly overlap: boolean; readonly points: readonly Vec2[] } {
  const angleTolerance = numericTolerance(
    left.startAngleRadians,
    right.startAngleRadians,
    left.sweepAngleRadians,
    right.sweepAngleRadians
  );
  let overlap = false;
  for (const leftInterval of arcIntervals(left)) {
    for (const rightInterval of arcIntervals(right)) {
      const low = Math.max(leftInterval.start, rightInterval.start);
      const high = Math.min(leftInterval.end, rightInterval.end);
      if (high - low > angleTolerance) overlap = true;
    }
  }
  if (overlap) return { overlap: true, points: [] };
  const candidates = [left.start, left.end, right.start, right.end].filter(
    (point) => {
      const angle = Math.atan2(
        point[1] - left.center[1],
        point[0] - left.center[0]
      );
      return arcContainsAngle(left, angle) && arcContainsAngle(right, angle);
    }
  );
  return { overlap: false, points: uniquePoints(candidates, policy) };
}

function arcArcIntersection(
  left: ResolvedSketchArcSegment,
  right: ResolvedSketchArcSegment,
  policy: SketchGeometryPolicy
): { readonly overlap: boolean; readonly points: readonly Vec2[] } {
  if (circleSupportCoincident(left, right)) {
    return coincidentArcIntersection(left, right, policy);
  }
  const dx = right.center[0] - left.center[0];
  const dy = right.center[1] - left.center[1];
  const centerDistance = Math.hypot(dx, dy);
  const existenceTolerance = numericTolerance(
    centerDistance,
    left.radius,
    right.radius
  );
  if (
    centerDistance > left.radius + right.radius + existenceTolerance ||
    centerDistance <
      Math.abs(left.radius - right.radius) - existenceTolerance ||
    centerDistance <= existenceTolerance
  ) {
    return { overlap: false, points: [] };
  }
  const along =
    (left.radius * left.radius -
      right.radius * right.radius +
      centerDistance * centerDistance) /
    (2 * centerDistance);
  const heightSquared = left.radius * left.radius - along * along;
  const heightTolerance = numericTolerance(
    left.radius * left.radius,
    along * along
  );
  if (heightSquared < -heightTolerance) return { overlap: false, points: [] };
  const height = Math.sqrt(Math.max(0, heightSquared));
  const base: Vec2 = [
    left.center[0] + (along * dx) / centerDistance,
    left.center[1] + (along * dy) / centerDistance
  ];
  const perpendicular: Vec2 = [-dy / centerDistance, dx / centerDistance];
  const candidates: Vec2[] =
    height === 0
      ? [base]
      : [
          [
            base[0] + height * perpendicular[0],
            base[1] + height * perpendicular[1]
          ],
          [
            base[0] - height * perpendicular[0],
            base[1] - height * perpendicular[1]
          ]
        ];
  return {
    overlap: false,
    points: uniquePoints(
      candidates.filter((point) => {
        const leftAngle = Math.atan2(
          point[1] - left.center[1],
          point[0] - left.center[0]
        );
        const rightAngle = Math.atan2(
          point[1] - right.center[1],
          point[0] - right.center[0]
        );
        return (
          arcContainsAngle(left, leftAngle) &&
          arcContainsAngle(right, rightAngle)
        );
      }),
      policy
    )
  };
}

/** Analytic finite-segment intersections. Overlap never masquerades as points. */
export function intersectSketchSegments(
  left: ResolvedSketchSegment,
  right: ResolvedSketchSegment,
  policy: SketchGeometryPolicy = SKETCH_GEOMETRY_POLICY
): SketchSegmentIntersection {
  const result =
    left.kind === "line" && right.kind === "line"
      ? lineLineIntersection(left, right)
      : left.kind === "line" && right.kind === "arc"
        ? { overlap: false, points: lineArcIntersection(left, right, policy) }
        : left.kind === "arc" && right.kind === "line"
          ? { overlap: false, points: lineArcIntersection(right, left, policy) }
          : arcArcIntersection(
              left as ResolvedSketchArcSegment,
              right as ResolvedSketchArcSegment,
              policy
            );
  return {
    overlap: result.overlap,
    points: result.points.map((point) =>
      createIntersectionPoint(left, right, point, policy)
    )
  };
}

export function getSketchSegmentSignedArea(
  segment: ResolvedSketchSegment
): number {
  if (segment.kind === "line") {
    return cross(segment.start, segment.end) / 2;
  }
  const endpointTerm =
    segment.center[0] * (segment.end[1] - segment.start[1]) -
    segment.center[1] * (segment.end[0] - segment.start[0]);
  return (
    (endpointTerm +
      segment.radius * segment.radius * segment.sweepAngleRadians) /
    2
  );
}

export function getSketchWireSignedArea(
  segments: readonly ResolvedSketchSegment[]
): number {
  return segments.reduce(
    (area, segment) => area + getSketchSegmentSignedArea(segment),
    0
  );
}

export function reverseSketchSegmentTraversal(
  segment: ResolvedSketchSegment
): ResolvedSketchSegment {
  const orientation = segment.orientation === "forward" ? "reverse" : "forward";
  if (segment.kind === "line") {
    return { ...segment, orientation, start: segment.end, end: segment.start };
  }
  return {
    ...segment,
    orientation,
    start: segment.end,
    end: segment.start,
    startAngleRadians: segment.startAngleRadians + segment.sweepAngleRadians,
    sweepAngleRadians: -segment.sweepAngleRadians
  };
}

export function normalizeSketchWireCounterClockwise(
  segments: readonly ResolvedSketchSegment[]
): {
  readonly segments: readonly ResolvedSketchSegment[];
  readonly signedArea: number;
  readonly normalized: boolean;
} {
  const signedArea = getSketchWireSignedArea(segments);
  if (signedArea >= 0) {
    return { segments, signedArea, normalized: false };
  }
  return {
    segments: [...segments].reverse().map(reverseSketchSegmentTraversal),
    signedArea: -signedArea,
    normalized: true
  };
}

export function getSketchSegmentEndpointTangent(
  segment: ResolvedSketchSegment,
  endpoint: SketchSegmentEndpoint
): Vec2 {
  return tangentAtPoint(segment, segment[endpoint]);
}

export function areSketchTangentsG1(
  outgoing: Vec2,
  incoming: Vec2,
  policy: SketchGeometryPolicy = SKETCH_GEOMETRY_POLICY
): boolean {
  if (!isFinitePoint(outgoing) || !isFinitePoint(incoming)) return false;
  const outgoingLength = Math.hypot(...outgoing);
  const incomingLength = Math.hypot(...incoming);
  if (outgoingLength === 0 || incomingLength === 0) return false;
  const cosine = Math.max(
    -1,
    Math.min(1, dot(outgoing, incoming) / (outgoingLength * incomingLength))
  );
  const angularToleranceRadians =
    (policy.angularToleranceDegrees * Math.PI) / 180;
  return cosine >= Math.cos(angularToleranceRadians);
}

export function getSketchSegmentBounds(
  segment: ResolvedSketchSegment
): SketchSegmentBounds {
  const points: Vec2[] = [segment.start, segment.end];
  if (segment.kind === "arc") {
    for (const angle of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
      if (arcContainsAngle(segment, angle)) {
        points.push(pointAt(segment.center, segment.radius, angle));
      }
    }
  }
  return {
    min: [
      Math.min(...points.map((point) => point[0])),
      Math.min(...points.map((point) => point[1]))
    ],
    max: [
      Math.max(...points.map((point) => point[0])),
      Math.max(...points.map((point) => point[1]))
    ]
  };
}

export function mergeSketchSegmentBounds(
  segments: readonly ResolvedSketchSegment[]
): SketchSegmentBounds | undefined {
  if (segments.length === 0) return undefined;
  const bounds = segments.map(getSketchSegmentBounds);
  return {
    min: [
      Math.min(...bounds.map((value) => value.min[0])),
      Math.min(...bounds.map((value) => value.min[1]))
    ],
    max: [
      Math.max(...bounds.map((value) => value.max[0])),
      Math.max(...bounds.map((value) => value.max[1]))
    ]
  };
}
