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
  | "SKETCH_SEGMENT_DERIVED_GEOMETRY_NON_FINITE"
  | "SKETCH_LINE_ZERO_LENGTH"
  | "SKETCH_ARC_RADIUS_INVALID"
  | "SKETCH_ARC_SWEEP_INVALID"
  | "SKETCH_ARC_ZERO_LENGTH";

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

function floatingTolerance(...values: readonly number[]): number {
  return (
    Number.EPSILON *
    Math.max(Number.MIN_VALUE, ...values.map((value) => Math.abs(value))) *
    2
  );
}

function withinLinearTolerance(
  value: number,
  policy: SketchGeometryPolicy,
  ...calculationScale: readonly number[]
): boolean {
  return (
    value <= policy.linearTolerance ||
    value - policy.linearTolerance <=
      floatingTolerance(value, policy.linearTolerance, ...calculationScale)
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
    const delta: Vec2 = [
      entity.end[0] - entity.start[0],
      entity.end[1] - entity.start[1]
    ];
    const length = Math.hypot(...delta);
    if (!isFinitePoint(delta) || !Number.isFinite(length)) {
      return resolutionIssue(
        entity.id,
        "SKETCH_SEGMENT_DERIVED_GEOMETRY_NON_FINITE",
        "Line-derived length and tangent geometry must remain finite."
      );
    }
    if (withinLinearTolerance(length, policy, ...delta)) {
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
  const arcLength = entity.radius * Math.abs(authoredSweep);
  const areaScale = entity.radius * entity.radius * Math.abs(authoredSweep);
  if (
    !Number.isFinite(authoredStart) ||
    !Number.isFinite(authoredSweep) ||
    !Number.isFinite(arcLength) ||
    !Number.isFinite(areaScale)
  ) {
    return resolutionIssue(
      entity.id,
      "SKETCH_SEGMENT_DERIVED_GEOMETRY_NON_FINITE",
      "Arc-derived angles, length, and area geometry must remain finite."
    );
  }
  if (withinLinearTolerance(arcLength, policy, entity.radius, authoredSweep)) {
    return resolutionIssue(
      entity.id,
      "SKETCH_ARC_ZERO_LENGTH",
      "Arc length must be greater than the sketch linear tolerance."
    );
  }
  const forward = orientation === "forward";
  const startAngleRadians = forward
    ? authoredStart
    : authoredStart + authoredSweep;
  const sweepAngleRadians = forward ? authoredSweep : -authoredSweep;
  const segment: ResolvedSketchArcSegment = {
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
  };
  const bounds = getSketchSegmentBounds(segment, policy);
  if (
    !isFinitePoint(segment.start) ||
    !isFinitePoint(segment.end) ||
    !isFinitePoint(bounds.min) ||
    !isFinitePoint(bounds.max)
  ) {
    return resolutionIssue(
      entity.id,
      "SKETCH_SEGMENT_DERIVED_GEOMETRY_NON_FINITE",
      "Arc-derived endpoints and bounds must remain finite."
    );
  }
  return { ok: true, segment };
}

export function areSketchPointsCoincident(
  left: Vec2,
  right: Vec2,
  policy: SketchGeometryPolicy = SKETCH_GEOMETRY_POLICY
): boolean {
  const pointDistance = distance(left, right);
  return withinLinearTolerance(pointDistance, policy, pointDistance);
}

function arcContainsAngle(
  arc: ResolvedSketchArcSegment,
  angle: number,
  policy: SketchGeometryPolicy = SKETCH_GEOMETRY_POLICY,
  includeEndpoints = true
): boolean {
  const progress =
    arc.sweepAngleRadians >= 0
      ? normalizeRadians(angle - arc.startAngleRadians)
      : normalizeRadians(arc.startAngleRadians - angle);
  const limit = Math.abs(arc.sweepAngleRadians);
  const tolerance = Math.min(Math.PI, policy.linearTolerance / arc.radius);
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
  const angle = Math.atan2(
    point[1] - segment.center[1],
    point[0] - segment.center[0]
  );
  const direction = Math.sign(segment.sweepAngleRadians);
  return [-Math.sin(angle) * direction, Math.cos(angle) * direction];
}

function createIntersectionPoint(
  left: ResolvedSketchSegment,
  right: ResolvedSketchSegment,
  point: Vec2,
  policy: SketchGeometryPolicy
): SketchSegmentIntersectionPoint {
  const leftTangent = tangentAtPoint(left, point);
  const rightTangent = tangentAtPoint(right, point);
  const tangentThreshold = floatingTolerance(...leftTangent, ...rightTangent);
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
  right: ResolvedSketchLineSegment,
  policy: SketchGeometryPolicy
): { readonly overlap: boolean; readonly points: readonly Vec2[] } {
  const leftVector: Vec2 = [
    left.end[0] - left.start[0],
    left.end[1] - left.start[1]
  ];
  const rightVector: Vec2 = [
    right.end[0] - right.start[0],
    right.end[1] - right.start[1]
  ];
  const leftLength = Math.hypot(...leftVector);
  const rightLength = Math.hypot(...rightVector);
  const leftDirection: Vec2 = [
    leftVector[0] / leftLength,
    leftVector[1] / leftLength
  ];
  const rightDirection: Vec2 = [
    rightVector[0] / rightLength,
    rightVector[1] / rightLength
  ];
  const offset: Vec2 = [
    right.start[0] - left.start[0],
    right.start[1] - left.start[1]
  ];
  if (!isFinitePoint(offset)) return { overlap: false, points: [] };
  const denominator = cross(leftDirection, rightDirection);
  const parallel =
    Math.abs(denominator) <=
    floatingTolerance(...leftDirection, ...rightDirection);
  if (!parallel) {
    const leftDistance = cross(offset, rightDirection) / denominator;
    const rightDistance = cross(offset, leftDirection) / denominator;
    if (!Number.isFinite(leftDistance) || !Number.isFinite(rightDistance)) {
      return { overlap: false, points: [] };
    }
    if (
      leftDistance < -policy.linearTolerance ||
      leftDistance > leftLength + policy.linearTolerance ||
      rightDistance < -policy.linearTolerance ||
      rightDistance > rightLength + policy.linearTolerance
    ) {
      return { overlap: false, points: [] };
    }
    return {
      overlap: false,
      points: [
        [
          left.start[0] + leftDistance * leftDirection[0],
          left.start[1] + leftDistance * leftDirection[1]
        ]
      ]
    };
  }

  const perpendicularDistance = Math.abs(cross(offset, leftDirection));
  if (!withinLinearTolerance(perpendicularDistance, policy, ...offset)) {
    return { overlap: false, points: [] };
  }
  const startDistance = dot(offset, leftDirection);
  const endDistance = startDistance + dot(rightVector, leftDirection);
  const low = Math.max(0, Math.min(startDistance, endDistance));
  const high = Math.min(leftLength, Math.max(startDistance, endDistance));
  if (high < low - policy.linearTolerance) {
    return { overlap: false, points: [] };
  }
  if (high - low <= policy.linearTolerance) {
    const along = (low + high) / 2;
    return {
      overlap: false,
      points: [
        [
          left.start[0] + along * leftDirection[0],
          left.start[1] + along * leftDirection[1]
        ]
      ]
    };
  }
  return { overlap: true, points: [] };
}

function lineArcIntersection(
  line: ResolvedSketchLineSegment,
  arc: ResolvedSketchArcSegment,
  policy: SketchGeometryPolicy
): readonly Vec2[] {
  const vector: Vec2 = [
    line.end[0] - line.start[0],
    line.end[1] - line.start[1]
  ];
  const length = Math.hypot(...vector);
  const direction: Vec2 = [vector[0] / length, vector[1] / length];
  const toCenter: Vec2 = [
    arc.center[0] - line.start[0],
    arc.center[1] - line.start[1]
  ];
  if (!isFinitePoint(toCenter)) return [];
  const centerProjection = dot(toCenter, direction);
  const perpendicularDistance = Math.abs(cross(direction, toCenter));
  const radialGap = perpendicularDistance - arc.radius;
  if (
    radialGap > 0 &&
    !withinLinearTolerance(radialGap, policy, perpendicularDistance, arc.radius)
  )
    return [];
  const halfChord =
    radialGap >= 0
      ? 0
      : Math.sqrt(
          Math.max(
            0,
            (arc.radius - perpendicularDistance) *
              (arc.radius + perpendicularDistance)
          )
        );
  const distances =
    halfChord === 0
      ? [centerProjection]
      : [centerProjection - halfChord, centerProjection + halfChord];
  return uniquePoints(
    distances
      .filter(
        (along) =>
          along >= -policy.linearTolerance &&
          along <= length + policy.linearTolerance
      )
      .map<Vec2>((along) => [
        line.start[0] + along * direction[0],
        line.start[1] + along * direction[1]
      ])
      .filter((point) =>
        arcContainsAngle(
          arc,
          Math.atan2(point[1] - arc.center[1], point[0] - arc.center[0]),
          policy
        )
      ),
    policy
  );
}

function circleSupportCoincident(
  left: ResolvedSketchArcSegment,
  right: ResolvedSketchArcSegment,
  policy: SketchGeometryPolicy
): boolean {
  return (
    withinLinearTolerance(
      distance(left.center, right.center),
      policy,
      left.radius,
      right.radius
    ) &&
    withinLinearTolerance(
      Math.abs(left.radius - right.radius),
      policy,
      left.radius,
      right.radius
    )
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
  const angleTolerance = Math.min(
    Math.PI,
    policy.linearTolerance / Math.max(left.radius, right.radius)
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
      return (
        arcContainsAngle(left, angle, policy) &&
        arcContainsAngle(right, angle, policy)
      );
    }
  );
  return { overlap: false, points: uniquePoints(candidates, policy) };
}

function arcArcIntersection(
  left: ResolvedSketchArcSegment,
  right: ResolvedSketchArcSegment,
  policy: SketchGeometryPolicy
): { readonly overlap: boolean; readonly points: readonly Vec2[] } {
  if (circleSupportCoincident(left, right, policy)) {
    return coincidentArcIntersection(left, right, policy);
  }
  const dx = right.center[0] - left.center[0];
  const dy = right.center[1] - left.center[1];
  const centerDistance = Math.hypot(dx, dy);
  if (!Number.isFinite(centerDistance)) {
    return { overlap: false, points: [] };
  }
  const radiusSum = left.radius + right.radius;
  const radiusDifference = Math.abs(left.radius - right.radius);
  const externalGap = centerDistance - radiusSum;
  const internalGap = radiusDifference - centerDistance;
  if (
    (externalGap > 0 &&
      !withinLinearTolerance(externalGap, policy, centerDistance, radiusSum)) ||
    (internalGap > 0 &&
      !withinLinearTolerance(
        internalGap,
        policy,
        centerDistance,
        radiusDifference
      )) ||
    withinLinearTolerance(centerDistance, policy, left.radius, right.radius)
  ) {
    return { overlap: false, points: [] };
  }
  const direction: Vec2 = [dx / centerDistance, dy / centerDistance];
  const numericalDistanceTolerance = Math.min(
    policy.linearTolerance,
    floatingTolerance(centerDistance, radiusSum, radiusDifference)
  );
  const along =
    (centerDistance +
      ((left.radius - right.radius) * radiusSum) / centerDistance) /
    2;
  if (!Number.isFinite(along)) return { overlap: false, points: [] };
  const separatedTangent = externalGap >= -numericalDistanceTolerance;
  const containedTangent = internalGap >= -numericalDistanceTolerance;
  let candidates: Vec2[];
  if (separatedTangent || containedTangent) {
    candidates = [
      [
        left.center[0] + along * direction[0],
        left.center[1] + along * direction[1]
      ]
    ];
  } else {
    const externalFactor =
      (radiusSum - centerDistance) *
      ((radiusSum + centerDistance) / centerDistance);
    const internalFactor =
      (centerDistance + left.radius - right.radius) *
      ((centerDistance - left.radius + right.radius) / centerDistance);
    const height = Math.sqrt(Math.max(0, externalFactor * internalFactor)) / 2;
    if (!Number.isFinite(along) || !Number.isFinite(height)) {
      return { overlap: false, points: [] };
    }
    const base: Vec2 = [
      left.center[0] + along * direction[0],
      left.center[1] + along * direction[1]
    ];
    const perpendicular: Vec2 = [-direction[1], direction[0]];
    candidates = [
      [
        base[0] + height * perpendicular[0],
        base[1] + height * perpendicular[1]
      ],
      [base[0] - height * perpendicular[0], base[1] - height * perpendicular[1]]
    ];
  }
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
          arcContainsAngle(left, leftAngle, policy) &&
          arcContainsAngle(right, rightAngle, policy)
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
      ? lineLineIntersection(left, right, policy)
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
  segment: ResolvedSketchSegment,
  reference: Vec2 = [0, 0]
): number {
  if (segment.kind === "line") {
    return (
      cross(
        [segment.start[0] - reference[0], segment.start[1] - reference[1]],
        [segment.end[0] - reference[0], segment.end[1] - reference[1]]
      ) / 2
    );
  }
  const endAngle = segment.startAngleRadians + segment.sweepAngleRadians;
  const deltaX =
    segment.radius * (Math.cos(endAngle) - Math.cos(segment.startAngleRadians));
  const deltaY =
    segment.radius * (Math.sin(endAngle) - Math.sin(segment.startAngleRadians));
  const localCenter: Vec2 = [
    segment.center[0] - reference[0],
    segment.center[1] - reference[1]
  ];
  const endpointTerm = localCenter[0] * deltaY - localCenter[1] * deltaX;
  return (
    (endpointTerm +
      segment.radius * segment.radius * segment.sweepAngleRadians) /
    2
  );
}

export function getSketchWireSignedArea(
  segments: readonly ResolvedSketchSegment[]
): number {
  const reference = segments[0]?.start ?? ([0, 0] as const);
  let sum = 0;
  let compensation = 0;
  for (const segment of segments) {
    const contribution = getSketchSegmentSignedArea(segment, reference);
    const adjusted = contribution - compensation;
    const next = sum + adjusted;
    compensation = next - sum - adjusted;
    sum = next;
  }
  return sum;
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
  if (segment.kind === "arc") {
    const angle =
      endpoint === "start"
        ? segment.startAngleRadians
        : segment.startAngleRadians + segment.sweepAngleRadians;
    const direction = Math.sign(segment.sweepAngleRadians);
    return [-Math.sin(angle) * direction, Math.cos(angle) * direction];
  }
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
  segment: ResolvedSketchSegment,
  policy: SketchGeometryPolicy = SKETCH_GEOMETRY_POLICY
): SketchSegmentBounds {
  const points: Vec2[] = [segment.start, segment.end];
  if (segment.kind === "arc") {
    for (const angle of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
      if (arcContainsAngle(segment, angle, policy)) {
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
  const bounds = segments.map((segment) => getSketchSegmentBounds(segment));
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
