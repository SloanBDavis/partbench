import type {
  OrientedSketchSegmentRef,
  SketchArcEntity,
  SketchCircleEntitySnapshot,
  SketchEntityId,
  SketchEntitySnapshot,
  SketchLineEntitySnapshot,
  SketchRectangleEntitySnapshot,
  Vec2
} from "@web-cad/cad-protocol";

import {
  intersectFiniteSketchCurves,
  intersectSketchCurveInfiniteSupports,
  projectPointToFiniteSketchCurve,
  resolveSketchCurveEditEntity,
  type ResolvedSketchCurve,
  type ResolvedSketchCurveArc
} from "./sketchCurveEditGeometry";
import {
  SKETCH_GEOMETRY_POLICY,
  type SketchGeometryPolicy
} from "./sketchGeometryPolicy";

export const MAX_SKETCH_OFFSET_SOURCE_SEGMENTS = 1_024;
export const MAX_OFFSET_EDITED_SKETCH_ENTITIES = 4_096;
export const MAX_SKETCH_OFFSET_MITER_FACTOR = 10;

const FULL_TURN_DEGREES = 360;
const RADIANS_PER_DEGREE = Math.PI / 180;
const DEGREES_PER_RADIAN = 180 / Math.PI;

export type SketchOffsetSide = "left" | "right" | "inward" | "outward";

export type SketchOffsetSource =
  | { readonly kind: "entity"; readonly entityId: SketchEntityId }
  | {
      readonly kind: "chain";
      readonly segments: readonly OrientedSketchSegmentRef[];
      readonly closed: boolean;
    };

export interface SketchOffsetPlanInput {
  readonly entities: readonly SketchEntitySnapshot[];
  readonly source: SketchOffsetSource;
  readonly distance: number;
  readonly side: SketchOffsetSide;
  readonly referencePoint?: Vec2;
  readonly createdEntityIds?: readonly SketchEntityId[];
}

export type PlannedSketchOffsetShape =
  | Omit<SketchLineEntitySnapshot, "id">
  | Omit<SketchCircleEntitySnapshot, "id">
  | Omit<SketchArcEntity, "id">
  | Omit<SketchRectangleEntitySnapshot, "id">;

export type SketchOffsetDiagnosticCode =
  | "SKETCH_OFFSET_NON_FINITE"
  | "SKETCH_OFFSET_DISTANCE_INVALID"
  | "SKETCH_OFFSET_SIDE_INVALID"
  | "SKETCH_OFFSET_SOURCE_MISSING"
  | "SKETCH_OFFSET_SOURCE_UNSUPPORTED"
  | "SKETCH_OFFSET_SKETCH_ENTITY_LIMIT"
  | "SKETCH_OFFSET_SEGMENT_LIMIT"
  | "SKETCH_OFFSET_DUPLICATE_SOURCE"
  | "SKETCH_OFFSET_CHAIN_DISCONNECTED"
  | "SKETCH_OFFSET_CHAIN_CLOSURE_MISMATCH"
  | "SKETCH_OFFSET_CHAIN_OVERLAP"
  | "SKETCH_OFFSET_CHAIN_SELF_INTERSECTION"
  | "SKETCH_OFFSET_CONSTRUCTION_MISMATCH"
  | "SKETCH_OFFSET_REFERENCE_PROJECTION_AMBIGUOUS"
  | "SKETCH_OFFSET_REFERENCE_POINT_ON_SOURCE"
  | "SKETCH_OFFSET_REFERENCE_SIDE_MISMATCH"
  | "SKETCH_OFFSET_COLLAPSE"
  | "SKETCH_OFFSET_JOIN_NO_SOLUTION"
  | "SKETCH_OFFSET_JOIN_AMBIGUOUS"
  | "SKETCH_OFFSET_MITER_LIMIT"
  | "SKETCH_OFFSET_ZERO_LENGTH"
  | "SKETCH_OFFSET_ARC_REVERSAL"
  | "SKETCH_OFFSET_ARC_EXTRA_WRAP"
  | "SKETCH_OFFSET_ARC_DOMAIN"
  | "SKETCH_OFFSET_OUTPUT_DISCONNECTED"
  | "SKETCH_OFFSET_OUTPUT_SELF_INTERSECTION"
  | "SKETCH_OFFSET_OUTPUT_ID_COUNT_MISMATCH"
  | "SKETCH_OFFSET_OUTPUT_ID_DUPLICATE"
  | "SKETCH_OFFSET_OUTPUT_ID_CONFLICT";

export interface SketchOffsetDiagnostic {
  readonly code: SketchOffsetDiagnosticCode;
  readonly path: string;
  readonly entityIds: readonly SketchEntityId[];
  readonly message: string;
  readonly expected?: string;
  readonly received?: string;
}

export interface SketchOffsetPlan {
  readonly operation: "offset";
  readonly associative: false;
  readonly constraints: readonly [];
  readonly sourceEntityIds: readonly SketchEntityId[];
  readonly side: SketchOffsetSide;
  readonly distance: number;
  readonly construction: boolean;
  readonly closed: boolean;
  readonly resultEntityCount: number;
  readonly requiredCreatedEntityIdCount: number;
  readonly outputShapes: readonly PlannedSketchOffsetShape[];
  readonly materialized?: {
    readonly entities: readonly (
      | SketchLineEntitySnapshot
      | SketchCircleEntitySnapshot
      | SketchArcEntity
      | SketchRectangleEntitySnapshot
    )[];
  };
}

export type SketchOffsetPlanResult =
  | {
      readonly status: "ready";
      readonly plan: SketchOffsetPlan;
      readonly diagnostics: readonly [];
    }
  | {
      readonly status: "blocked";
      readonly diagnostics: readonly SketchOffsetDiagnostic[];
    };

interface OrientedSourceSegment {
  readonly entity: SketchLineEntitySnapshot | SketchArcEntity;
  readonly construction: boolean;
  readonly curve: ResolvedSketchCurve;
  readonly start: Vec2;
  readonly end: Vec2;
}

interface RawOffsetSegment {
  readonly sourceEntityId: SketchEntityId;
  readonly construction: boolean;
  readonly curve: ResolvedSketchCurve;
  readonly rawStart: Vec2;
  readonly rawEnd: Vec2;
}

function canonicalZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

function point(x: number, y: number): Vec2 {
  return [canonicalZero(x), canonicalZero(y)];
}

function add(left: Vec2, right: Vec2): Vec2 {
  return point(left[0] + right[0], left[1] + right[1]);
}

function subtract(left: Vec2, right: Vec2): Vec2 {
  return point(left[0] - right[0], left[1] - right[1]);
}

function scale(value: Vec2, factor: number): Vec2 {
  return point(value[0] * factor, value[1] * factor);
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

function isFinitePoint(value: Vec2): boolean {
  return Number.isFinite(value[0]) && Number.isFinite(value[1]);
}

function normalizeDegrees(value: number): number {
  return canonicalZero(
    ((value % FULL_TURN_DEGREES) + FULL_TURN_DEGREES) % FULL_TURN_DEGREES
  );
}

function polarDegrees(center: Vec2, value: Vec2): number {
  return normalizeDegrees(
    Math.atan2(value[1] - center[1], value[0] - center[0]) * DEGREES_PER_RADIAN
  );
}

function representsIntendedSignedOffset(
  actual: number,
  intended: number,
  scaleValues: readonly number[]
): boolean {
  if (
    !Number.isFinite(actual) ||
    actual === 0 ||
    Math.sign(actual) !== Math.sign(intended)
  ) {
    return false;
  }
  const coordinateRoundoff =
    Number.EPSILON *
    Math.max(1, ...scaleValues.map((value) => Math.abs(value))) *
    64;
  const relativeIntentCap = Math.abs(intended) * 1e-7;
  const tolerance = Math.min(coordinateRoundoff, relativeIntentCap);
  return Math.abs(actual - intended) <= tolerance;
}

function diagnostic(
  code: SketchOffsetDiagnosticCode,
  path: string,
  entityIds: readonly SketchEntityId[],
  message: string,
  expected?: string,
  received?: string
): SketchOffsetDiagnostic {
  return { code, path, entityIds, message, expected, received };
}

function blocked(issue: SketchOffsetDiagnostic): {
  readonly status: "blocked";
  readonly diagnostics: readonly SketchOffsetDiagnostic[];
} {
  return { status: "blocked", diagnostics: [issue] };
}

function entityMap(
  entities: readonly SketchEntitySnapshot[]
): ReadonlyMap<SketchEntityId, SketchEntitySnapshot> | SketchOffsetDiagnostic {
  const result = new Map<SketchEntityId, SketchEntitySnapshot>();
  for (let index = 0; index < entities.length; index += 1) {
    const entity = entities[index]!;
    if (result.has(entity.id)) {
      return diagnostic(
        "SKETCH_OFFSET_DUPLICATE_SOURCE",
        `entities[${index}].id`,
        [entity.id],
        "Edited-sketch entity IDs must be unique.",
        "unique entity ID",
        entity.id
      );
    }
    result.set(entity.id, entity);
  }
  return result;
}

function resolveOrientedSourceSegment(
  entity: SketchEntitySnapshot,
  orientation: OrientedSketchSegmentRef["orientation"],
  policy: SketchGeometryPolicy
): OrientedSourceSegment | SketchOffsetDiagnostic {
  if (entity.kind !== "line" && entity.kind !== "arc") {
    return diagnostic(
      "SKETCH_OFFSET_SOURCE_UNSUPPORTED",
      "source.segments",
      [entity.id],
      "Offset chains support only line and canonical arc entities.",
      "line | arc",
      entity.kind
    );
  }
  const oriented: SketchLineEntitySnapshot | SketchArcEntity =
    orientation === "forward"
      ? entity
      : entity.kind === "line"
        ? { ...entity, start: entity.end, end: entity.start }
        : {
            ...entity,
            startAngleDegrees: normalizeDegrees(
              entity.startAngleDegrees + entity.sweepAngleDegrees
            ),
            sweepAngleDegrees: -entity.sweepAngleDegrees
          };
  const resolution = resolveSketchCurveEditEntity(oriented, policy);
  if (resolution.status === "blocked" || resolution.curve.kind === "circle") {
    return diagnostic(
      "SKETCH_OFFSET_SOURCE_UNSUPPORTED",
      "source.segments",
      [entity.id],
      "Source segment geometry is invalid under the shared sketch policy."
    );
  }
  const curve = resolution.curve;
  return {
    entity,
    construction: entity.construction,
    curve,
    start: curve.start,
    end: curve.end
  };
}

function adjacencyPoints(
  segments: readonly OrientedSourceSegment[],
  leftIndex: number,
  rightIndex: number,
  closed: boolean
): readonly Vec2[] {
  const points: Vec2[] = [];
  if (rightIndex === leftIndex + 1) {
    points.push(segments[leftIndex]!.end);
  }
  if (closed && leftIndex === 0 && rightIndex === segments.length - 1) {
    points.push(segments[rightIndex]!.end);
  }
  return points;
}

function validateSimpleChain(
  segments: readonly OrientedSourceSegment[],
  closed: boolean,
  policy: SketchGeometryPolicy,
  output: boolean
): SketchOffsetDiagnostic | undefined {
  for (let leftIndex = 0; leftIndex < segments.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < segments.length;
      rightIndex += 1
    ) {
      const left = segments[leftIndex]!;
      const right = segments[rightIndex]!;
      const intersection = intersectFiniteSketchCurves(
        left.curve,
        right.curve,
        policy
      );
      const entityIds = [left.entity.id, right.entity.id];
      if (intersection.status === "blocked") {
        return diagnostic(
          output
            ? "SKETCH_OFFSET_OUTPUT_SELF_INTERSECTION"
            : "SKETCH_OFFSET_CHAIN_OVERLAP",
          output ? "outputShapes" : "source.segments",
          entityIds,
          output
            ? "Offset output segments must not overlap."
            : "Source chain segments must not overlap."
        );
      }
      const allowed = adjacencyPoints(segments, leftIndex, rightIndex, closed);
      const unexpected = intersection.points.find(
        (candidate) =>
          !allowed.some(
            (allowedPoint) =>
              distance(candidate.point, allowedPoint) <= policy.linearTolerance
          )
      );
      if (unexpected) {
        return diagnostic(
          output
            ? "SKETCH_OFFSET_OUTPUT_SELF_INTERSECTION"
            : "SKETCH_OFFSET_CHAIN_SELF_INTERSECTION",
          output ? "outputShapes" : "source.segments",
          entityIds,
          output
            ? "Offset output must remain a simple analytic chain."
            : "Source chain must have no self-intersection or branch."
        );
      }
    }
  }
  return undefined;
}

function signedChainArea(segments: readonly OrientedSourceSegment[]): number {
  const anchor = segments[0]?.start ?? ([0, 0] as const);
  let twiceArea = 0;
  let compensation = 0;
  const accumulate = (term: number): void => {
    const corrected = term - compensation;
    const next = twiceArea + corrected;
    compensation = next - twiceArea - corrected;
    twiceArea = next;
  };
  for (const segment of segments) {
    if (segment.curve.kind === "line") {
      accumulate(
        cross(
          subtract(segment.curve.start, anchor),
          subtract(segment.curve.end, anchor)
        )
      );
      continue;
    }
    if (segment.curve.kind === "circle") continue;
    const start = segment.curve.startAngleDegrees * RADIANS_PER_DEGREE;
    const sweep = segment.curve.sweepAngleDegrees * RADIANS_PER_DEGREE;
    const end = start + sweep;
    const localCenter = subtract(segment.curve.center, anchor);
    accumulate(
      localCenter[0] *
        segment.curve.radius *
        (Math.sin(end) - Math.sin(start)) +
        localCenter[1] *
          segment.curve.radius *
          (Math.cos(start) - Math.cos(end)) +
        segment.curve.radius * segment.curve.radius * sweep
    );
  }
  return twiceArea / 2;
}

function sideDirectionForChain(
  side: SketchOffsetSide,
  closed: boolean,
  segments: readonly OrientedSourceSegment[],
  policy: SketchGeometryPolicy
): number | SketchOffsetDiagnostic {
  if (!closed) {
    if (side !== "left" && side !== "right") {
      return diagnostic(
        "SKETCH_OFFSET_SIDE_INVALID",
        "side",
        segments.map((segment) => segment.entity.id),
        "An open chain requires left or right relative to submitted traversal.",
        "left | right",
        side
      );
    }
    return side === "left" ? 1 : -1;
  }
  if (side !== "inward" && side !== "outward") {
    return diagnostic(
      "SKETCH_OFFSET_SIDE_INVALID",
      "side",
      segments.map((segment) => segment.entity.id),
      "A closed chain requires inward or outward.",
      "inward | outward",
      side
    );
  }
  const area = signedChainArea(segments);
  if (!Number.isFinite(area) || Math.abs(area) <= policy.minimumProfileArea) {
    return diagnostic(
      "SKETCH_OFFSET_COLLAPSE",
      "source",
      segments.map((segment) => segment.entity.id),
      "Closed source traversal must enclose non-collapsed signed area.",
      `abs(area) > ${policy.minimumProfileArea}`,
      String(area)
    );
  }
  const interiorDirection = Math.sign(area);
  return side === "inward" ? interiorDirection : -interiorDirection;
}

function rawOffsetSegment(
  segment: OrientedSourceSegment,
  signedSide: number,
  offsetDistance: number,
  policy: SketchGeometryPolicy
): RawOffsetSegment | SketchOffsetDiagnostic {
  const curve = segment.curve;
  if (curve.kind === "line") {
    const normal = point(-curve.direction[1], curve.direction[0]);
    const translation = scale(normal, signedSide * offsetDistance);
    const entity: SketchLineEntitySnapshot = {
      id: segment.entity.id,
      kind: "line",
      start: add(curve.start, translation),
      end: add(curve.end, translation),
      construction: segment.construction
    };
    const resolution = resolveSketchCurveEditEntity(entity, policy);
    if (resolution.status === "blocked" || resolution.curve.kind !== "line") {
      return diagnostic(
        "SKETCH_OFFSET_ZERO_LENGTH",
        "outputShapes",
        [segment.entity.id],
        "Offset line must retain non-zero analytic length."
      );
    }
    return {
      sourceEntityId: segment.entity.id,
      construction: segment.construction,
      curve: resolution.curve,
      rawStart: resolution.curve.start,
      rawEnd: resolution.curve.end
    };
  }
  if (curve.kind === "circle") {
    return diagnostic(
      "SKETCH_OFFSET_SOURCE_UNSUPPORTED",
      "source.segments",
      [segment.entity.id],
      "A circle cannot be a chain segment."
    );
  }
  const radius =
    curve.radius -
    Math.sign(curve.sweepAngleDegrees) * signedSide * offsetDistance;
  if (!Number.isFinite(radius) || radius <= policy.linearTolerance) {
    return diagnostic(
      "SKETCH_OFFSET_COLLAPSE",
      "outputShapes",
      [segment.entity.id],
      "Offset arc radius must remain above the shared linear tolerance.",
      `>${policy.linearTolerance}`,
      String(radius)
    );
  }
  const entity: SketchArcEntity = {
    id: segment.entity.id,
    kind: "arc",
    center: curve.center,
    radius,
    startAngleDegrees: curve.startAngleDegrees,
    sweepAngleDegrees: curve.sweepAngleDegrees,
    construction: segment.construction
  };
  const resolution = resolveSketchCurveEditEntity(entity, policy);
  if (resolution.status === "blocked" || resolution.curve.kind === "circle") {
    return diagnostic(
      "SKETCH_OFFSET_ARC_DOMAIN",
      "outputShapes",
      [segment.entity.id],
      "Raw offset arc must satisfy the complete V17 arc domain."
    );
  }
  const resolved = resolution.curve as ResolvedSketchCurveArc;
  return {
    sourceEntityId: segment.entity.id,
    construction: segment.construction,
    curve: resolved,
    rawStart: resolved.start,
    rawEnd: resolved.end
  };
}

function validateRepresentableSegmentOffset(
  source: OrientedSourceSegment,
  raw: RawOffsetSegment,
  signedSide: number,
  offsetDistance: number
): SketchOffsetDiagnostic | undefined {
  if (source.curve.kind === "line" && raw.curve.kind === "line") {
    const intended = signedSide * offsetDistance;
    const startSeparation = cross(
      source.curve.direction,
      subtract(raw.rawStart, source.curve.start)
    );
    const endSeparation = cross(
      source.curve.direction,
      subtract(raw.rawEnd, source.curve.end)
    );
    const scaleValues = [
      ...source.curve.start,
      ...source.curve.end,
      ...raw.rawStart,
      ...raw.rawEnd,
      intended
    ];
    if (
      representsIntendedSignedOffset(startSeparation, intended, scaleValues) &&
      representsIntendedSignedOffset(endSeparation, intended, scaleValues)
    ) {
      return undefined;
    }
    return diagnostic(
      "SKETCH_OFFSET_JOIN_NO_SOLUTION",
      "outputShapes",
      [source.entity.id],
      "The positive exact line offset is not representable at the submitted finite coordinates.",
      `signed normal separation ${intended} at both endpoints`,
      `${startSeparation},${endSeparation}`
    );
  }
  if (source.curve.kind === "arc" && raw.curve.kind === "arc") {
    const intended =
      -Math.sign(source.curve.sweepAngleDegrees) * signedSide * offsetDistance;
    const actual = raw.curve.radius - source.curve.radius;
    if (
      representsIntendedSignedOffset(actual, intended, [
        source.curve.radius,
        raw.curve.radius,
        intended
      ])
    ) {
      return undefined;
    }
    return diagnostic(
      "SKETCH_OFFSET_JOIN_NO_SOLUTION",
      "outputShapes",
      [source.entity.id],
      "The positive exact arc offset is not representable by a distinct finite radius.",
      `radius delta ${intended}`,
      String(actual)
    );
  }
  return diagnostic(
    "SKETCH_OFFSET_JOIN_NO_SOLUTION",
    "outputShapes",
    [source.entity.id],
    "Offset output did not preserve the source segment's analytic support kind."
  );
}

function pointOnSupport(
  curve: ResolvedSketchCurve,
  value: Vec2,
  policy: SketchGeometryPolicy
): boolean {
  if (curve.kind === "line") {
    return (
      Math.abs(cross(curve.direction, subtract(value, curve.start))) <=
      policy.linearTolerance
    );
  }
  return (
    Math.abs(distance(value, curve.center) - curve.radius) <=
    policy.linearTolerance
  );
}

function chooseJoin(
  left: RawOffsetSegment,
  right: RawOffsetSegment,
  offsetDistance: number,
  policy: SketchGeometryPolicy
): Vec2 | SketchOffsetDiagnostic {
  const intersection = intersectSketchCurveInfiniteSupports(
    left.curve,
    right.curve,
    policy
  );
  if (intersection.status === "blocked") {
    const mapped = point(
      (left.rawEnd[0] + right.rawStart[0]) / 2,
      (left.rawEnd[1] + right.rawStart[1]) / 2
    );
    if (
      distance(left.rawEnd, right.rawStart) <= policy.linearTolerance &&
      pointOnSupport(left.curve, mapped, policy) &&
      pointOnSupport(right.curve, mapped, policy)
    ) {
      return mapped;
    }
    return diagnostic(
      "SKETCH_OFFSET_JOIN_AMBIGUOUS",
      "source.segments",
      [left.sourceEntityId, right.sourceEntityId],
      "Coincident analytic supports did not yield one shared mapped source endpoint."
    );
  }
  if (intersection.points.length === 0) {
    return diagnostic(
      "SKETCH_OFFSET_JOIN_NO_SOLUTION",
      "source.segments",
      [left.sourceEntityId, right.sourceEntityId],
      "Adjacent offset analytic supports do not intersect."
    );
  }
  const ordered = intersection.points
    .map((candidate) => ({
      point: candidate.point,
      score:
        distance(candidate.point, left.rawEnd) +
        distance(candidate.point, right.rawStart),
      maximum: Math.max(
        distance(candidate.point, left.rawEnd),
        distance(candidate.point, right.rawStart)
      )
    }))
    .sort(
      (first, second) =>
        first.score - second.score ||
        first.maximum - second.maximum ||
        first.point[0] - second.point[0] ||
        first.point[1] - second.point[1]
    );
  const selected = ordered[0]!;
  const second = ordered[1];
  if (
    second &&
    Math.abs(second.score - selected.score) <= policy.linearTolerance
  ) {
    return diagnostic(
      "SKETCH_OFFSET_JOIN_AMBIGUOUS",
      "source.segments",
      [left.sourceEntityId, right.sourceEntityId],
      "Multiple analytic support intersections are equally consistent with the source join."
    );
  }
  const maximumMiter = MAX_SKETCH_OFFSET_MITER_FACTOR * offsetDistance;
  if (selected.maximum > maximumMiter + policy.linearTolerance) {
    return diagnostic(
      "SKETCH_OFFSET_MITER_LIMIT",
      "source.segments",
      [left.sourceEntityId, right.sourceEntityId],
      "Natural offset join exceeds the ten-times-distance miter bound.",
      `<=${maximumMiter}`,
      String(selected.maximum)
    );
  }
  return selected.point;
}

function equivalentParameterNear(
  canonicalParameter: number,
  referenceParameter: number
): number {
  const turn = Math.floor(
    (referenceParameter - canonicalParameter) / FULL_TURN_DEGREES
  );
  const lower = canonicalParameter + turn * FULL_TURN_DEGREES;
  const upper = lower + FULL_TURN_DEGREES;
  return canonicalZero(
    Math.abs(referenceParameter - lower) <= Math.abs(referenceParameter - upper)
      ? lower
      : upper
  );
}

function circularReconstructionTolerance(...values: readonly number[]): number {
  return (
    Number.EPSILON *
    Math.max(FULL_TURN_DEGREES, ...values.map((value) => Math.abs(value))) *
    64
  );
}

function finalizedSegmentShape(
  segment: RawOffsetSegment,
  start: Vec2,
  end: Vec2,
  policy: SketchGeometryPolicy
): PlannedSketchOffsetShape | SketchOffsetDiagnostic {
  if (segment.curve.kind === "line") {
    if (distance(start, end) <= policy.linearTolerance) {
      return diagnostic(
        "SKETCH_OFFSET_ZERO_LENGTH",
        "outputShapes",
        [segment.sourceEntityId],
        "Natural joins collapsed an offset line to zero length."
      );
    }
    if (
      dot(subtract(end, start), segment.curve.direction) <=
      policy.linearTolerance
    ) {
      return diagnostic(
        "SKETCH_OFFSET_ZERO_LENGTH",
        "outputShapes",
        [segment.sourceEntityId],
        "Natural joins reversed an offset line traversal."
      );
    }
    return {
      kind: "line",
      start,
      end,
      construction: segment.construction
    };
  }
  if (segment.curve.kind === "circle") {
    return diagnostic(
      "SKETCH_OFFSET_SOURCE_UNSUPPORTED",
      "outputShapes",
      [segment.sourceEntityId],
      "A circle cannot be finalized as a chain segment."
    );
  }
  const sign = Math.sign(segment.curve.sweepAngleDegrees);
  const rawMagnitude = Math.abs(segment.curve.sweepAngleDegrees);
  const startCanonical = normalizeDegrees(
    sign *
      (polarDegrees(segment.curve.center, start) -
        segment.curve.startAngleDegrees)
  );
  const endCanonical = normalizeDegrees(
    sign *
      (polarDegrees(segment.curve.center, end) -
        segment.curve.startAngleDegrees)
  );
  const startParameter = equivalentParameterNear(startCanonical, 0);
  const endParameter = equivalentParameterNear(endCanonical, rawMagnitude);
  const computedMagnitude = endParameter - startParameter;
  const parameterTolerance = circularReconstructionTolerance(
    rawMagnitude,
    startParameter,
    endParameter,
    computedMagnitude
  );
  if (computedMagnitude < -parameterTolerance) {
    return diagnostic(
      "SKETCH_OFFSET_ARC_REVERSAL",
      "outputShapes",
      [segment.sourceEntityId],
      "Natural offset joins reversed the submitted arc traversal.",
      ">0 traversal degrees",
      String(computedMagnitude)
    );
  }
  const minimumMagnitude = policy.angularToleranceDegrees;
  const maximumMagnitude = FULL_TURN_DEGREES - policy.angularToleranceDegrees;
  let magnitude = computedMagnitude;
  if (Math.abs(magnitude - minimumMagnitude) <= parameterTolerance) {
    magnitude = minimumMagnitude;
  } else if (Math.abs(magnitude - maximumMagnitude) <= parameterTolerance) {
    magnitude = maximumMagnitude;
  }
  if (magnitude > maximumMagnitude + parameterTolerance) {
    return diagnostic(
      "SKETCH_OFFSET_ARC_EXTRA_WRAP",
      "outputShapes",
      [segment.sourceEntityId],
      "Natural offset joins require an extra circular wrap.",
      `<=${maximumMagnitude}`,
      String(magnitude)
    );
  }
  if (magnitude < minimumMagnitude - parameterTolerance) {
    return diagnostic(
      "SKETCH_OFFSET_ARC_DOMAIN",
      "outputShapes",
      [segment.sourceEntityId],
      "Offset arc sweep is below the complete V17 arc domain.",
      `>=${minimumMagnitude}`,
      String(magnitude)
    );
  }
  return {
    kind: "arc",
    center: segment.curve.center,
    radius: segment.curve.radius,
    startAngleDegrees: polarDegrees(segment.curve.center, start),
    sweepAngleDegrees: canonicalZero(sign * magnitude),
    construction: segment.construction
  };
}

function shapeToOrientedSegment(
  shape: PlannedSketchOffsetShape,
  index: number,
  policy: SketchGeometryPolicy
): OrientedSourceSegment | SketchOffsetDiagnostic {
  if (shape.kind !== "line" && shape.kind !== "arc") {
    return diagnostic(
      "SKETCH_OFFSET_SOURCE_UNSUPPORTED",
      `outputShapes[${index}]`,
      [],
      "Only line and arc shapes can form a chain."
    );
  }
  const entity = { ...shape, id: `__offset_output_${index}` } as
    | SketchLineEntitySnapshot
    | SketchArcEntity;
  const resolution = resolveSketchCurveEditEntity(entity, policy);
  if (resolution.status === "blocked" || resolution.curve.kind === "circle") {
    return diagnostic(
      shape.kind === "arc"
        ? "SKETCH_OFFSET_ARC_DOMAIN"
        : "SKETCH_OFFSET_ZERO_LENGTH",
      `outputShapes[${index}]`,
      [],
      "Final offset segment is invalid under the shared geometry policy."
    );
  }
  return {
    entity,
    construction: entity.construction,
    curve: resolution.curve,
    start: resolution.curve.start,
    end: resolution.curve.end
  };
}

function makeChainShapes(
  segments: readonly OrientedSourceSegment[],
  signedSide: number,
  offsetDistance: number,
  closed: boolean,
  policy: SketchGeometryPolicy
): readonly PlannedSketchOffsetShape[] | SketchOffsetDiagnostic {
  const raw: RawOffsetSegment[] = [];
  for (const segment of segments) {
    const offset = rawOffsetSegment(
      segment,
      signedSide,
      offsetDistance,
      policy
    );
    if ("code" in offset) return offset;
    raw.push(offset);
  }
  const joins: Vec2[] = [];
  const joinCount = closed ? raw.length : Math.max(0, raw.length - 1);
  for (let index = 0; index < joinCount; index += 1) {
    const rightIndex = (index + 1) % raw.length;
    const join = chooseJoin(
      raw[index]!,
      raw[rightIndex]!,
      offsetDistance,
      policy
    );
    if ("code" in join) return join;
    joins.push(join);
  }
  const shapes: PlannedSketchOffsetShape[] = [];
  for (let index = 0; index < raw.length; index += 1) {
    const start =
      index === 0
        ? closed
          ? joins[joins.length - 1]!
          : raw[index]!.rawStart
        : joins[index - 1]!;
    const end =
      index === raw.length - 1 && !closed ? raw[index]!.rawEnd : joins[index]!;
    const shape = finalizedSegmentShape(raw[index]!, start, end, policy);
    if ("code" in shape) return shape;
    shapes.push(shape);
  }
  const resolvedOutput: OrientedSourceSegment[] = [];
  for (let index = 0; index < shapes.length; index += 1) {
    const segment = shapeToOrientedSegment(shapes[index]!, index, policy);
    if ("code" in segment) return segment;
    resolvedOutput.push(segment);
  }
  for (let index = 0; index < resolvedOutput.length - 1; index += 1) {
    const gap = distance(
      resolvedOutput[index]!.end,
      resolvedOutput[index + 1]!.start
    );
    if (gap > policy.linearTolerance) {
      return diagnostic(
        "SKETCH_OFFSET_OUTPUT_DISCONNECTED",
        `outputShapes[${index + 1}]`,
        [raw[index]!.sourceEntityId, raw[index + 1]!.sourceEntityId],
        "Re-resolved offset output endpoints must remain forward-connected within the shared linear tolerance.",
        `<=${policy.linearTolerance}`,
        String(gap)
      );
    }
  }
  if (!closed && resolvedOutput.length > 0) {
    const startGap = distance(resolvedOutput[0]!.start, raw[0]!.rawStart);
    if (startGap > policy.linearTolerance) {
      return diagnostic(
        "SKETCH_OFFSET_OUTPUT_DISCONNECTED",
        "outputShapes[0]",
        [raw[0]!.sourceEntityId],
        "Re-resolved open offset output must preserve its first raw offset endpoint.",
        `<=${policy.linearTolerance}`,
        String(startGap)
      );
    }
    const finalIndex = resolvedOutput.length - 1;
    const endGap = distance(
      resolvedOutput[finalIndex]!.end,
      raw[finalIndex]!.rawEnd
    );
    if (endGap > policy.linearTolerance) {
      return diagnostic(
        "SKETCH_OFFSET_OUTPUT_DISCONNECTED",
        `outputShapes[${finalIndex}]`,
        [raw[finalIndex]!.sourceEntityId],
        "Re-resolved open offset output must preserve its last raw offset endpoint.",
        `<=${policy.linearTolerance}`,
        String(endGap)
      );
    }
  }
  if (closed && resolvedOutput.length > 0) {
    const closureGap = distance(
      resolvedOutput[resolvedOutput.length - 1]!.end,
      resolvedOutput[0]!.start
    );
    if (closureGap > policy.linearTolerance) {
      return diagnostic(
        "SKETCH_OFFSET_OUTPUT_DISCONNECTED",
        "outputShapes[0]",
        [raw[raw.length - 1]!.sourceEntityId, raw[0]!.sourceEntityId],
        "Re-resolved closed offset output must preserve last-to-first endpoint closure.",
        `<=${policy.linearTolerance}`,
        String(closureGap)
      );
    }
  }
  const topologyIssue = validateSimpleChain(
    resolvedOutput,
    closed,
    policy,
    true
  );
  if (topologyIssue) return topologyIssue;
  for (let index = 0; index < segments.length; index += 1) {
    const representabilityIssue = validateRepresentableSegmentOffset(
      segments[index]!,
      raw[index]!,
      signedSide,
      offsetDistance
    );
    if (representabilityIssue) return representabilityIssue;
  }
  return shapes;
}

function rectangleBoundary(
  rectangle: SketchRectangleEntitySnapshot,
  policy: SketchGeometryPolicy
): readonly OrientedSourceSegment[] | SketchOffsetDiagnostic {
  if (
    !isFinitePoint(rectangle.center) ||
    !Number.isFinite(rectangle.width) ||
    !Number.isFinite(rectangle.height)
  ) {
    return diagnostic(
      "SKETCH_OFFSET_NON_FINITE",
      "source",
      [rectangle.id],
      "Rectangle source geometry must contain only finite values."
    );
  }
  if (
    rectangle.width <= policy.linearTolerance ||
    rectangle.height <= policy.linearTolerance
  ) {
    return diagnostic(
      "SKETCH_OFFSET_COLLAPSE",
      "source",
      [rectangle.id],
      "Rectangle width and height must exceed the shared linear tolerance."
    );
  }
  const halfWidth = rectangle.width / 2;
  const halfHeight = rectangle.height / 2;
  const corners: readonly Vec2[] = [
    point(rectangle.center[0] - halfWidth, rectangle.center[1] - halfHeight),
    point(rectangle.center[0] + halfWidth, rectangle.center[1] - halfHeight),
    point(rectangle.center[0] + halfWidth, rectangle.center[1] + halfHeight),
    point(rectangle.center[0] - halfWidth, rectangle.center[1] + halfHeight)
  ];
  const result: OrientedSourceSegment[] = [];
  for (let index = 0; index < corners.length; index += 1) {
    const entity: SketchLineEntitySnapshot = {
      id: `${rectangle.id}:edge:${index}`,
      kind: "line",
      start: corners[index]!,
      end: corners[(index + 1) % corners.length]!,
      construction: rectangle.construction
    };
    const resolution = resolveSketchCurveEditEntity(entity, policy);
    if (resolution.status === "blocked" || resolution.curve.kind !== "line") {
      return diagnostic(
        "SKETCH_OFFSET_COLLAPSE",
        "source",
        [rectangle.id],
        "Rectangle boundary did not resolve to four finite line segments."
      );
    }
    result.push({
      entity,
      construction: rectangle.construction,
      curve: resolution.curve,
      start: resolution.curve.start,
      end: resolution.curve.end
    });
  }
  return result;
}

function closestProjection(
  curves: readonly ResolvedSketchCurve[],
  referencePoint: Vec2,
  sourceEntityIds: readonly SketchEntityId[],
  policy: SketchGeometryPolicy
):
  | {
      readonly curve: ResolvedSketchCurve;
      readonly point: Vec2;
      readonly tangent: Vec2;
      readonly distance: number;
      readonly ambiguous?: boolean;
    }
  | SketchOffsetDiagnostic {
  const candidates: {
    readonly curve: ResolvedSketchCurve;
    readonly point: Vec2;
    readonly tangent: Vec2;
    readonly distance: number;
    readonly ambiguous?: boolean;
  }[] = [];
  for (const curve of curves) {
    const projection = projectPointToFiniteSketchCurve(
      curve,
      referencePoint,
      policy
    );
    if (projection.status === "blocked") {
      if (curve.kind === "line") {
        return diagnostic(
          "SKETCH_OFFSET_REFERENCE_PROJECTION_AMBIGUOUS",
          "referencePoint",
          sourceEntityIds,
          "Reference point has no unique closest finite source parameter."
        );
      }
      if (curve.kind === "circle") {
        candidates.push({
          curve,
          point: curve.center,
          tangent: [0, 0],
          distance: curve.radius,
          ambiguous: true
        });
        continue;
      }
      const tangentAt = (angleDegrees: number): Vec2 => {
        const angle = angleDegrees * RADIANS_PER_DEGREE;
        const direction = Math.sign(curve.sweepAngleDegrees);
        return point(-Math.sin(angle) * direction, Math.cos(angle) * direction);
      };
      const centerDistance = distance(referencePoint, curve.center);
      if (centerDistance <= policy.linearTolerance) {
        candidates.push({
          curve,
          point: curve.center,
          tangent: [0, 0],
          distance: curve.radius,
          ambiguous: true
        });
        continue;
      }
      candidates.push(
        {
          curve,
          point: curve.start,
          tangent: tangentAt(curve.startAngleDegrees),
          distance: distance(referencePoint, curve.start)
        },
        {
          curve,
          point: curve.end,
          tangent: tangentAt(curve.startAngleDegrees + curve.sweepAngleDegrees),
          distance: distance(referencePoint, curve.end)
        }
      );
      continue;
    }
    candidates.push({
      curve,
      point: projection.projection.point,
      tangent: projection.projection.tangent,
      distance: projection.projection.distance
    });
  }
  candidates.sort(
    (left, right) =>
      left.distance - right.distance ||
      (left.curve.entityId < right.curve.entityId
        ? -1
        : left.curve.entityId > right.curve.entityId
          ? 1
          : 0)
  );
  const selected = candidates[0]!;
  const second = candidates[1];
  if (selected.ambiguous) {
    return diagnostic(
      "SKETCH_OFFSET_REFERENCE_PROJECTION_AMBIGUOUS",
      "referencePoint",
      sourceEntityIds,
      "Reference point has multiple equal closest finite source parameters."
    );
  }
  if (
    second &&
    Math.abs(second.distance - selected.distance) <= policy.linearTolerance
  ) {
    return diagnostic(
      "SKETCH_OFFSET_REFERENCE_PROJECTION_AMBIGUOUS",
      "referencePoint",
      sourceEntityIds,
      "Reference point is equally close to multiple finite source parameters."
    );
  }
  if (selected.distance <= policy.linearTolerance) {
    return diagnostic(
      "SKETCH_OFFSET_REFERENCE_POINT_ON_SOURCE",
      "referencePoint",
      sourceEntityIds,
      "Reference point must not lie on the source geometry."
    );
  }
  return selected;
}

function arcRayCrossings(
  arc: ResolvedSketchCurveArc,
  referencePoint: Vec2,
  policy: SketchGeometryPolicy
): number {
  const vertical = referencePoint[1] - arc.center[1];
  if (Math.abs(vertical) >= arc.radius) return 0;
  const ratio = vertical / arc.radius;
  const principal = Math.asin(Math.max(-1, Math.min(1, ratio)));
  const angles = [
    normalizeDegrees(principal * DEGREES_PER_RADIAN),
    normalizeDegrees((Math.PI - principal) * DEGREES_PER_RADIAN)
  ];
  const magnitude = Math.abs(arc.sweepAngleDegrees);
  const parameterTolerance = Math.min(
    180,
    (policy.linearTolerance / arc.radius) * DEGREES_PER_RADIAN
  );
  let crossings = 0;
  for (const angle of angles) {
    const parameter = normalizeDegrees(
      Math.sign(arc.sweepAngleDegrees) * (angle - arc.startAngleDegrees)
    );
    if (
      parameter < -parameterTolerance ||
      parameter >= magnitude - parameterTolerance
    ) {
      continue;
    }
    const radians = angle * RADIANS_PER_DEGREE;
    if (Math.abs(Math.cos(radians)) * arc.radius <= policy.linearTolerance) {
      continue;
    }
    const x = arc.center[0] + arc.radius * Math.cos(radians);
    if (x > referencePoint[0]) crossings += 1;
  }
  return crossings;
}

function isInsideClosedChain(
  segments: readonly OrientedSourceSegment[],
  referencePoint: Vec2,
  policy: SketchGeometryPolicy
): boolean {
  let crossings = 0;
  for (const segment of segments) {
    const curve = segment.curve;
    if (curve.kind === "line") {
      const startAbove = curve.start[1] > referencePoint[1];
      const endAbove = curve.end[1] > referencePoint[1];
      if (startAbove === endAbove) continue;
      const x =
        curve.start[0] +
        ((referencePoint[1] - curve.start[1]) *
          (curve.end[0] - curve.start[0])) /
          (curve.end[1] - curve.start[1]);
      if (x > referencePoint[0]) crossings += 1;
    } else if (curve.kind === "arc") {
      crossings += arcRayCrossings(curve, referencePoint, policy);
    }
  }
  return crossings % 2 === 1;
}

function validateReferencePoint(
  referencePoint: Vec2 | undefined,
  side: SketchOffsetSide,
  curves: readonly ResolvedSketchCurve[],
  sourceEntityIds: readonly SketchEntityId[],
  closedSegments: readonly OrientedSourceSegment[] | undefined,
  circle: ResolvedSketchCurve | undefined,
  policy: SketchGeometryPolicy
): SketchOffsetDiagnostic | undefined {
  if (referencePoint === undefined) return undefined;
  if (!isFinitePoint(referencePoint)) {
    return diagnostic(
      "SKETCH_OFFSET_NON_FINITE",
      "referencePoint",
      sourceEntityIds,
      "Reference point must contain two finite coordinates."
    );
  }
  const projection = closestProjection(
    curves,
    referencePoint,
    sourceEntityIds,
    policy
  );
  if ("code" in projection) return projection;
  let derived: SketchOffsetSide;
  if (closedSegments || circle?.kind === "circle") {
    const inside =
      circle?.kind === "circle"
        ? distance(referencePoint, circle.center) <
          circle.radius - policy.linearTolerance
        : isInsideClosedChain(closedSegments!, referencePoint, policy);
    derived = inside ? "inward" : "outward";
  } else {
    const signedSide = cross(
      projection.tangent,
      subtract(referencePoint, projection.point)
    );
    if (Math.abs(signedSide) <= policy.linearTolerance) {
      return diagnostic(
        "SKETCH_OFFSET_REFERENCE_PROJECTION_AMBIGUOUS",
        "referencePoint",
        sourceEntityIds,
        "Reference point does not classify a stable side at its closest finite parameter."
      );
    }
    derived = signedSide > 0 ? "left" : "right";
  }
  if (derived !== side) {
    return diagnostic(
      "SKETCH_OFFSET_REFERENCE_SIDE_MISMATCH",
      "referencePoint",
      sourceEntityIds,
      "Reference-point evidence disagrees with the explicit offset side.",
      side,
      derived
    );
  }
  return undefined;
}

function materializePlan(
  base: Omit<SketchOffsetPlan, "materialized">,
  createdEntityIds: readonly SketchEntityId[] | undefined,
  existingIds: ReadonlySet<SketchEntityId>
): SketchOffsetPlan | SketchOffsetDiagnostic {
  if (createdEntityIds === undefined) return base;
  if (createdEntityIds.length !== base.outputShapes.length) {
    return diagnostic(
      "SKETCH_OFFSET_OUTPUT_ID_COUNT_MISMATCH",
      "createdEntityIds",
      [],
      "Caller-supplied output IDs must match exact traversal-order output count.",
      String(base.outputShapes.length),
      String(createdEntityIds.length)
    );
  }
  const seen = new Set<SketchEntityId>();
  for (let index = 0; index < createdEntityIds.length; index += 1) {
    const id = createdEntityIds[index]!;
    if (typeof id !== "string" || id.length === 0) {
      return diagnostic(
        "SKETCH_OFFSET_OUTPUT_ID_CONFLICT",
        `createdEntityIds[${index}]`,
        [],
        "Caller-supplied output IDs must be non-empty strings."
      );
    }
    if (seen.has(id)) {
      return diagnostic(
        "SKETCH_OFFSET_OUTPUT_ID_DUPLICATE",
        `createdEntityIds[${index}]`,
        [id],
        "Caller-supplied output IDs must be unique."
      );
    }
    if (existingIds.has(id)) {
      return diagnostic(
        "SKETCH_OFFSET_OUTPUT_ID_CONFLICT",
        `createdEntityIds[${index}]`,
        [id],
        "Caller-supplied output ID conflicts with existing sketch source."
      );
    }
    seen.add(id);
  }
  return {
    ...base,
    materialized: {
      entities: base.outputShapes.map((shape, index) => ({
        ...shape,
        id: createdEntityIds[index]!
      }))
    }
  };
}

function makeIndividualShape(
  entity: SketchEntitySnapshot,
  offsetDistance: number,
  side: SketchOffsetSide,
  policy: SketchGeometryPolicy
):
  | {
      readonly shape: PlannedSketchOffsetShape;
      readonly curves: readonly ResolvedSketchCurve[];
      readonly closedSegments?: readonly OrientedSourceSegment[];
      readonly circle?: ResolvedSketchCurve;
    }
  | SketchOffsetDiagnostic {
  if (entity.kind === "point") {
    return diagnostic(
      "SKETCH_OFFSET_SOURCE_UNSUPPORTED",
      "source.entityId",
      [entity.id],
      "Points are not offset sources.",
      "line | circle | arc | rectangle",
      entity.kind
    );
  }
  if (entity.kind === "rectangle") {
    if (side !== "inward" && side !== "outward") {
      return diagnostic(
        "SKETCH_OFFSET_SIDE_INVALID",
        "side",
        [entity.id],
        "A rectangle requires inward or outward.",
        "inward | outward",
        side
      );
    }
    const boundary = rectangleBoundary(entity, policy);
    if ("code" in boundary) return boundary;
    const delta = side === "inward" ? -2 * offsetDistance : 2 * offsetDistance;
    const width = entity.width + delta;
    const height = entity.height + delta;
    if (
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      width <= policy.linearTolerance ||
      height <= policy.linearTolerance
    ) {
      return diagnostic(
        "SKETCH_OFFSET_COLLAPSE",
        "outputShapes",
        [entity.id],
        "Rectangle offset must preserve positive width and height.",
        `width,height > ${policy.linearTolerance}`,
        `${width},${height}`
      );
    }
    const widthDelta = width - entity.width;
    const heightDelta = height - entity.height;
    if (
      !representsIntendedSignedOffset(widthDelta, delta, [
        entity.width,
        width,
        delta
      ]) ||
      !representsIntendedSignedOffset(heightDelta, delta, [
        entity.height,
        height,
        delta
      ])
    ) {
      return diagnostic(
        "SKETCH_OFFSET_JOIN_NO_SOLUTION",
        "outputShapes",
        [entity.id],
        "The positive exact rectangle offset is not representable by distinct finite width and height.",
        `width,height delta ${delta}`,
        `${widthDelta},${heightDelta}`
      );
    }
    return {
      shape: {
        kind: "rectangle",
        center: entity.center,
        width,
        height,
        construction: entity.construction
      },
      curves: boundary.map((segment) => segment.curve),
      closedSegments: boundary
    };
  }
  const resolution = resolveSketchCurveEditEntity(entity, policy);
  if (resolution.status === "blocked") {
    return diagnostic(
      "SKETCH_OFFSET_SOURCE_UNSUPPORTED",
      "source.entityId",
      [entity.id],
      "Source curve geometry is invalid under the shared sketch policy."
    );
  }
  const curve = resolution.curve;
  if (curve.kind === "circle") {
    if (side !== "inward" && side !== "outward") {
      return diagnostic(
        "SKETCH_OFFSET_SIDE_INVALID",
        "side",
        [entity.id],
        "A circle requires inward or outward.",
        "inward | outward",
        side
      );
    }
    const radius =
      curve.radius + (side === "inward" ? -offsetDistance : offsetDistance);
    if (!Number.isFinite(radius) || radius <= policy.linearTolerance) {
      return diagnostic(
        "SKETCH_OFFSET_COLLAPSE",
        "outputShapes",
        [entity.id],
        "Circle offset must preserve a positive resulting radius.",
        `>${policy.linearTolerance}`,
        String(radius)
      );
    }
    const intended = side === "inward" ? -offsetDistance : offsetDistance;
    const actual = radius - curve.radius;
    if (
      !representsIntendedSignedOffset(actual, intended, [
        curve.radius,
        radius,
        intended
      ])
    ) {
      return diagnostic(
        "SKETCH_OFFSET_JOIN_NO_SOLUTION",
        "outputShapes",
        [entity.id],
        "The positive exact circle offset is not representable by a distinct finite radius.",
        `radius delta ${intended}`,
        String(actual)
      );
    }
    return {
      shape: {
        kind: "circle",
        center: curve.center,
        radius,
        construction: entity.construction
      },
      curves: [curve],
      circle: curve
    };
  }
  if (side !== "left" && side !== "right") {
    return diagnostic(
      "SKETCH_OFFSET_SIDE_INVALID",
      "side",
      [entity.id],
      "An individual line or arc requires left or right.",
      "left | right",
      side
    );
  }
  const curveEntity = entity as SketchLineEntitySnapshot | SketchArcEntity;
  const segment: OrientedSourceSegment = {
    entity: curveEntity,
    construction: entity.construction,
    curve,
    start: curve.start,
    end: curve.end
  };
  const raw = rawOffsetSegment(
    segment,
    side === "left" ? 1 : -1,
    offsetDistance,
    policy
  );
  if ("code" in raw) return raw;
  const representabilityIssue = validateRepresentableSegmentOffset(
    segment,
    raw,
    side === "left" ? 1 : -1,
    offsetDistance
  );
  if (representabilityIssue) return representabilityIssue;
  if (curve.kind === "arc") {
    if (raw.curve.kind !== "arc") {
      return diagnostic(
        "SKETCH_OFFSET_ARC_DOMAIN",
        "outputShapes",
        [entity.id],
        "Individual offset arc did not retain exact circular-arc geometry."
      );
    }
    return {
      shape: {
        kind: "arc",
        center: raw.curve.center,
        radius: raw.curve.radius,
        startAngleDegrees: curve.startAngleDegrees,
        sweepAngleDegrees: curve.sweepAngleDegrees,
        construction: entity.construction
      },
      curves: [curve]
    };
  }
  const shape = finalizedSegmentShape(raw, raw.rawStart, raw.rawEnd, policy);
  if ("code" in shape) return shape;
  return { shape, curves: [curve] };
}

export function planSketchOffset(
  input: SketchOffsetPlanInput,
  policy: SketchGeometryPolicy = SKETCH_GEOMETRY_POLICY
): SketchOffsetPlanResult {
  if (input.entities.length > MAX_OFFSET_EDITED_SKETCH_ENTITIES) {
    return blocked(
      diagnostic(
        "SKETCH_OFFSET_SKETCH_ENTITY_LIMIT",
        "entities",
        [],
        "Edited sketch exceeds the bounded source-entity limit.",
        `<=${MAX_OFFSET_EDITED_SKETCH_ENTITIES}`,
        String(input.entities.length)
      )
    );
  }
  if (!Number.isFinite(input.distance) || input.distance <= 0) {
    return blocked(
      diagnostic(
        Number.isFinite(input.distance)
          ? "SKETCH_OFFSET_DISTANCE_INVALID"
          : "SKETCH_OFFSET_NON_FINITE",
        "distance",
        [],
        "Offset distance must be positive and finite.",
        ">0",
        String(input.distance)
      )
    );
  }
  const byId = entityMap(input.entities);
  if (!("get" in byId)) return blocked(byId);

  let outputShapes: readonly PlannedSketchOffsetShape[];
  let sourceEntityIds: readonly SketchEntityId[];
  let construction: boolean;
  let closed: boolean;
  let referenceCurves: readonly ResolvedSketchCurve[];
  let referenceClosedSegments: readonly OrientedSourceSegment[] | undefined;
  let referenceCircle: ResolvedSketchCurve | undefined;

  if (input.source.kind === "entity") {
    const entity = byId.get(input.source.entityId);
    if (!entity) {
      return blocked(
        diagnostic(
          "SKETCH_OFFSET_SOURCE_MISSING",
          "source.entityId",
          [input.source.entityId],
          "Offset source entity does not exist in the declared sketch."
        )
      );
    }
    const planned = makeIndividualShape(
      entity,
      input.distance,
      input.side,
      policy
    );
    if ("code" in planned) return blocked(planned);
    outputShapes = [planned.shape];
    sourceEntityIds = [entity.id];
    construction = entity.construction;
    closed = entity.kind === "circle" || entity.kind === "rectangle";
    referenceCurves = planned.curves;
    referenceClosedSegments = planned.closedSegments;
    referenceCircle = planned.circle;
  } else {
    if (
      input.source.segments.length === 0 ||
      input.source.segments.length > MAX_SKETCH_OFFSET_SOURCE_SEGMENTS
    ) {
      return blocked(
        diagnostic(
          "SKETCH_OFFSET_SEGMENT_LIMIT",
          "source.segments",
          input.source.segments.map((segment) => segment.entityId),
          "Offset chain must contain between one and 1,024 segments.",
          `1..${MAX_SKETCH_OFFSET_SOURCE_SEGMENTS}`,
          String(input.source.segments.length)
        )
      );
    }
    const seen = new Set<SketchEntityId>();
    const segments: OrientedSourceSegment[] = [];
    for (let index = 0; index < input.source.segments.length; index += 1) {
      const reference = input.source.segments[index]!;
      if (seen.has(reference.entityId)) {
        return blocked(
          diagnostic(
            "SKETCH_OFFSET_DUPLICATE_SOURCE",
            `source.segments[${index}].entityId`,
            [reference.entityId],
            "Every chain source entity ID may occur only once."
          )
        );
      }
      seen.add(reference.entityId);
      const entity = byId.get(reference.entityId);
      if (!entity) {
        return blocked(
          diagnostic(
            "SKETCH_OFFSET_SOURCE_MISSING",
            `source.segments[${index}].entityId`,
            [reference.entityId],
            "Offset chain source entity does not exist in the declared sketch."
          )
        );
      }
      const resolved = resolveOrientedSourceSegment(
        entity,
        reference.orientation,
        policy
      );
      if ("code" in resolved) return blocked(resolved);
      segments.push(resolved);
    }
    construction = segments[0]!.construction;
    const mixedConstruction = segments.find(
      (segment) => segment.construction !== construction
    );
    if (mixedConstruction) {
      return blocked(
        diagnostic(
          "SKETCH_OFFSET_CONSTRUCTION_MISMATCH",
          "source.segments",
          segments.map((segment) => segment.entity.id),
          "Every chain member must have the same construction value."
        )
      );
    }
    for (let index = 0; index < segments.length - 1; index += 1) {
      if (
        distance(segments[index]!.end, segments[index + 1]!.start) >
        policy.linearTolerance
      ) {
        return blocked(
          diagnostic(
            "SKETCH_OFFSET_CHAIN_DISCONNECTED",
            `source.segments[${index + 1}]`,
            [segments[index]!.entity.id, segments[index + 1]!.entity.id],
            "Consecutive oriented source endpoints must coincide within the shared tolerance."
          )
        );
      }
    }
    const endpointsClose =
      distance(segments[segments.length - 1]!.end, segments[0]!.start) <=
      policy.linearTolerance;
    if (endpointsClose !== input.source.closed) {
      return blocked(
        diagnostic(
          "SKETCH_OFFSET_CHAIN_CLOSURE_MISMATCH",
          "source.closed",
          segments.map((segment) => segment.entity.id),
          "The closed flag must exactly match last-to-first endpoint closure.",
          String(endpointsClose),
          String(input.source.closed)
        )
      );
    }
    const topologyIssue = validateSimpleChain(
      segments,
      input.source.closed,
      policy,
      false
    );
    if (topologyIssue) return blocked(topologyIssue);
    const signedSide = sideDirectionForChain(
      input.side,
      input.source.closed,
      segments,
      policy
    );
    if (typeof signedSide !== "number") return blocked(signedSide);
    const shapes = makeChainShapes(
      segments,
      signedSide,
      input.distance,
      input.source.closed,
      policy
    );
    if ("code" in shapes) return blocked(shapes);
    outputShapes = shapes;
    sourceEntityIds = segments.map((segment) => segment.entity.id);
    closed = input.source.closed;
    referenceCurves = segments.map((segment) => segment.curve);
    referenceClosedSegments = closed ? segments : undefined;
  }

  const referenceIssue = validateReferencePoint(
    input.referencePoint,
    input.side,
    referenceCurves,
    sourceEntityIds,
    referenceClosedSegments,
    referenceCircle,
    policy
  );
  if (referenceIssue) return blocked(referenceIssue);

  const base = {
    operation: "offset" as const,
    associative: false as const,
    constraints: [] as const,
    sourceEntityIds,
    side: input.side,
    distance: input.distance,
    construction,
    closed,
    resultEntityCount: outputShapes.length,
    requiredCreatedEntityIdCount: outputShapes.length,
    outputShapes
  };
  const materialized = materializePlan(
    base,
    input.createdEntityIds,
    new Set(byId.keys())
  );
  return "code" in materialized
    ? blocked(materialized)
    : { status: "ready", plan: materialized, diagnostics: [] };
}
