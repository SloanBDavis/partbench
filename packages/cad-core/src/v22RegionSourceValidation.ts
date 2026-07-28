import {
  CAD_V19_RESOURCE_LIMITS,
  type CadOpsVersion,
  type OrientedSketchSegmentRef,
  type SketchEntitySnapshot,
  type SketchBounds2d,
  type SketchLoopRef,
  type SketchProfileRegionValidateQueryResponse,
  type SketchProfileRegionRef,
  type SketchRegionDiagnostic,
  type SketchRegionsProfileRef,
  type Vec2
} from "@web-cad/cad-protocol";

import {
  compareSketchCanonicalKeys,
  getSketchLoopCanonicalKey
} from "./v22SourceShapes";
import {
  areSketchPointsCoincident,
  getSketchWireSignedArea,
  intersectSketchSegments,
  resolveOrientedSketchSegment,
  type ResolvedSketchArcSegment,
  type ResolvedSketchLineSegment,
  type ResolvedSketchSegment
} from "./sketchWireGeometry";
import {
  SKETCH_GEOMETRY_POLICY,
  type SketchGeometryPolicy
} from "./sketchGeometryPolicy";

type BoundaryPrimitive =
  | ResolvedSketchLineSegment
  | ResolvedSketchArcSegment
  | {
      readonly kind: "circle";
      readonly entityId: string;
      readonly center: Vec2;
      readonly radius: number;
    };

interface ResolvedLoop {
  readonly source: SketchLoopRef;
  readonly normalized: SketchLoopRef;
  readonly key: string;
  readonly entityIds: readonly string[];
  readonly primitives: readonly BoundaryPrimitive[];
  readonly signedArea: number;
  readonly absoluteArea: number;
  readonly boundarySample: Vec2;
  readonly sample: Vec2;
}

export type V22RegionSourceIssueCode =
  | "SKETCH_REGION_COMPLEXITY_LIMIT"
  | "SKETCH_REGION_PROFILE_EMPTY"
  | "SKETCH_REGION_SKETCH_MISMATCH"
  | "SKETCH_REGION_ENTITY_MISSING"
  | "SKETCH_REGION_ENTITY_UNSUPPORTED"
  | "SKETCH_REGION_CONSTRUCTION_ENTITY"
  | "SKETCH_REGION_ENTITY_REPEATED"
  | "SKETCH_REGION_LOOP_OPEN"
  | "SKETCH_REGION_LOOP_INTERSECTION"
  | "SKETCH_REGION_LOOP_AREA_TOO_SMALL"
  | "SKETCH_REGION_BOUNDARY_TOUCHING"
  | "SKETCH_REGION_HOLE_OUTSIDE"
  | "SKETCH_REGION_HOLES_OVERLAP"
  | "SKETCH_REGION_MATERIAL_OVERLAP"
  | "SKETCH_REGION_NESTING_UNSUPPORTED";

export interface V22RegionSourceIssue {
  readonly code: V22RegionSourceIssueCode;
  readonly message: string;
  readonly regionIndex?: number;
  readonly loopRole?: "outer" | "hole";
  readonly holeIndex?: number;
  readonly entityId?: string;
  readonly otherEntityId?: string;
  readonly loopKey?: string;
  readonly otherLoopKey?: string;
  readonly expected?: string;
  readonly received?: string;
}

export interface V22RegionSourceSketch {
  readonly id: string;
  readonly entities: ReadonlyMap<string, SketchEntitySnapshot>;
}

export interface V22RegionSourceComplexity {
  readonly sketchEntityCount: number;
  readonly regionCount: number;
  readonly loopCount: number;
  readonly segmentReferenceCount: number;
  readonly predicateVisitCount: number;
}

export interface V22RegionSourceNormalization {
  readonly orientationChanged: boolean;
  readonly cyclicStartChanged: boolean;
  readonly outerOrientationsChanged: readonly string[];
  readonly holeOrientationsChanged: readonly string[];
  readonly cyclicStartsChanged: readonly string[];
  readonly holeOrderChanged: boolean;
  readonly regionOrderChanged: boolean;
}

export interface V22RegionSourceLoopSummary {
  readonly loopKey: string;
  readonly role: "outer" | "hole";
  readonly regionIndex: number;
  readonly entityIds: readonly string[];
  readonly signedArea: number;
  readonly absoluteArea: number;
  readonly containmentDepth: number;
}

export type V22RegionSourceValidationResult =
  | {
      readonly ok: true;
      readonly normalizedProfile: SketchRegionsProfileRef;
      readonly materialAreas: readonly number[];
      readonly loopSummaries: readonly V22RegionSourceLoopSummary[];
      readonly normalization: V22RegionSourceNormalization;
      readonly complexity: V22RegionSourceComplexity;
      readonly issues: readonly [];
    }
  | {
      readonly ok: false;
      readonly complexity: V22RegionSourceComplexity;
      readonly issues: readonly V22RegionSourceIssue[];
    };

interface MutableComplexity {
  sketchEntityCount: number;
  regionCount: number;
  loopCount: number;
  segmentReferenceCount: number;
  predicateVisitCount: number;
}

class PredicateBudgetExceeded extends Error {}

class PredicateBudget {
  constructor(
    private readonly complexity: MutableComplexity,
    private readonly maximum: number = CAD_V19_RESOURCE_LIMITS.maxSubmittedProfilePredicateVisits
  ) {}

  visit(count = 1): void {
    this.complexity.predicateVisitCount += count;
    if (this.complexity.predicateVisitCount > this.maximum) {
      throw new PredicateBudgetExceeded();
    }
  }
}

function issue(
  code: V22RegionSourceIssueCode,
  message: string,
  details: Omit<V22RegionSourceIssue, "code" | "message"> = {}
): V22RegionSourceIssue {
  return { code, message, ...details };
}

function isFinitePoint(point: Vec2): boolean {
  return Number.isFinite(point[0]) && Number.isFinite(point[1]);
}

function distance(left: Vec2, right: Vec2): number {
  return Math.hypot(left[0] - right[0], left[1] - right[1]);
}

function flipOrientation(
  orientation: OrientedSketchSegmentRef["orientation"]
): OrientedSketchSegmentRef["orientation"] {
  return orientation === "forward" ? "reverse" : "forward";
}

function compareReferenceSequences(
  left: readonly OrientedSketchSegmentRef[],
  right: readonly OrientedSketchSegmentRef[]
): number {
  for (let index = 0; index < left.length; index += 1) {
    const leftReference = left[index]!;
    const rightReference = right[index]!;
    const entityComparison = compareSketchCanonicalKeys(
      leftReference.entityId,
      rightReference.entityId
    );
    if (entityComparison !== 0) return entityComparison;
    const orientationComparison = compareSketchCanonicalKeys(
      leftReference.orientation,
      rightReference.orientation
    );
    if (orientationComparison !== 0) return orientationComparison;
  }
  return left.length - right.length;
}

function rotateToCanonicalStart(
  references: readonly OrientedSketchSegmentRef[]
): readonly OrientedSketchSegmentRef[] {
  let best = [...references];
  for (let index = 1; index < references.length; index += 1) {
    const candidate = [
      ...references.slice(index),
      ...references.slice(0, index)
    ];
    if (compareReferenceSequences(candidate, best) < 0) best = candidate;
  }
  return best;
}

function sameReferences(
  left: readonly OrientedSketchSegmentRef[],
  right: readonly OrientedSketchSegmentRef[]
): boolean {
  return (
    left.length === right.length &&
    left.every(
      (reference, index) =>
        reference.entityId === right[index]?.entityId &&
        reference.orientation === right[index]?.orientation
    )
  );
}

function canonicalizeWire(
  references: readonly OrientedSketchSegmentRef[],
  signedArea: number,
  role: "outer" | "hole"
): {
  readonly loop: SketchLoopRef;
  readonly orientationChanged: boolean;
  readonly cyclicStartChanged: boolean;
} {
  const wantsCounterClockwise = role === "outer";
  const isCounterClockwise = signedArea > 0;
  const oriented =
    wantsCounterClockwise === isCounterClockwise
      ? [...references]
      : [...references].reverse().map((reference) => ({
          entityId: reference.entityId,
          orientation: flipOrientation(reference.orientation)
        }));
  const rotated = rotateToCanonicalStart(oriented);
  return {
    loop: { kind: "wire", segments: rotated },
    orientationChanged: !sameReferences(references, oriented),
    cyclicStartChanged: !sameReferences(oriented, rotated)
  };
}

function makeLine(
  entityId: string,
  start: Vec2,
  end: Vec2
): ResolvedSketchLineSegment {
  return {
    kind: "line",
    entityId,
    orientation: "forward",
    start,
    end
  };
}

function rectanglePrimitives(
  entity: Extract<SketchEntitySnapshot, { readonly kind: "rectangle" }>
): readonly BoundaryPrimitive[] {
  const halfWidth = entity.width / 2;
  const halfHeight = entity.height / 2;
  const bottomLeft: Vec2 = [
    entity.center[0] - halfWidth,
    entity.center[1] - halfHeight
  ];
  const bottomRight: Vec2 = [
    entity.center[0] + halfWidth,
    entity.center[1] - halfHeight
  ];
  const topRight: Vec2 = [
    entity.center[0] + halfWidth,
    entity.center[1] + halfHeight
  ];
  const topLeft: Vec2 = [
    entity.center[0] - halfWidth,
    entity.center[1] + halfHeight
  ];
  return [
    makeLine(entity.id, bottomLeft, bottomRight),
    makeLine(entity.id, bottomRight, topRight),
    makeLine(entity.id, topRight, topLeft),
    makeLine(entity.id, topLeft, bottomLeft)
  ];
}

function hasFiniteDerivedPrimitiveGeometry(
  primitive: BoundaryPrimitive,
  policy: SketchGeometryPolicy
): boolean {
  if (primitive.kind === "circle") {
    return (
      isFinitePoint(primitive.center) &&
      Number.isFinite(primitive.radius) &&
      primitive.radius > policy.linearTolerance
    );
  }
  if (!isFinitePoint(primitive.start) || !isFinitePoint(primitive.end)) {
    return false;
  }
  if (primitive.kind === "line") {
    const length = distance(primitive.start, primitive.end);
    return Number.isFinite(length) && length > policy.linearTolerance;
  }
  return (
    isFinitePoint(primitive.center) &&
    Number.isFinite(primitive.radius) &&
    primitive.radius > policy.linearTolerance &&
    Number.isFinite(primitive.startAngleRadians) &&
    Number.isFinite(primitive.sweepAngleRadians)
  );
}

function resolveLoop(
  loop: SketchLoopRef,
  role: "outer" | "hole",
  entities: ReadonlyMap<string, SketchEntitySnapshot>,
  globallySeen: Set<string>,
  issues: V22RegionSourceIssue[],
  details: {
    readonly regionIndex: number;
    readonly holeIndex?: number;
  },
  policy: SketchGeometryPolicy,
  budget: PredicateBudget
): {
  readonly loop?: ResolvedLoop;
  readonly orientationChanged: boolean;
  readonly cyclicStartChanged: boolean;
} {
  const issueDetails = {
    regionIndex: details.regionIndex,
    loopRole: role,
    ...(details.holeIndex === undefined ? {} : { holeIndex: details.holeIndex })
  } as const;

  if (loop.kind === "entity") {
    if (globallySeen.has(loop.entityId)) {
      issues.push(
        issue(
          "SKETCH_REGION_ENTITY_REPEATED",
          `Entity ${loop.entityId} occurs in more than one submitted loop.`,
          { ...issueDetails, entityId: loop.entityId }
        )
      );
      return { orientationChanged: false, cyclicStartChanged: false };
    }
    globallySeen.add(loop.entityId);
    const entity = entities.get(loop.entityId);
    if (!entity) {
      issues.push(
        issue(
          "SKETCH_REGION_ENTITY_MISSING",
          `Region loop entity does not exist: ${loop.entityId}.`,
          { ...issueDetails, entityId: loop.entityId }
        )
      );
      return { orientationChanged: false, cyclicStartChanged: false };
    }
    if (entity.kind !== "rectangle" && entity.kind !== "circle") {
      issues.push(
        issue(
          "SKETCH_REGION_ENTITY_UNSUPPORTED",
          `Entity loops support only rectangle and circle entities, not ${entity.kind}.`,
          { ...issueDetails, entityId: entity.id }
        )
      );
      return { orientationChanged: false, cyclicStartChanged: false };
    }
    if (entity.construction) {
      issues.push(
        issue(
          "SKETCH_REGION_CONSTRUCTION_ENTITY",
          `Construction entity ${entity.id} cannot define a material region.`,
          { ...issueDetails, entityId: entity.id }
        )
      );
      return { orientationChanged: false, cyclicStartChanged: false };
    }

    let primitives: readonly BoundaryPrimitive[];
    let area: number;
    let sample: Vec2;
    if (entity.kind === "circle") {
      if (
        !isFinitePoint(entity.center) ||
        !Number.isFinite(entity.radius) ||
        entity.radius <= policy.linearTolerance
      ) {
        issues.push(
          issue(
            "SKETCH_REGION_ENTITY_UNSUPPORTED",
            `Circle ${entity.id} must have finite geometry and radius above tolerance.`,
            { ...issueDetails, entityId: entity.id }
          )
        );
        return { orientationChanged: false, cyclicStartChanged: false };
      }
      area = Math.PI * entity.radius * entity.radius;
      primitives = [
        {
          kind: "circle",
          entityId: entity.id,
          center: entity.center,
          radius: entity.radius
        }
      ];
      sample = entity.center;
    } else {
      if (
        !isFinitePoint(entity.center) ||
        !Number.isFinite(entity.width) ||
        !Number.isFinite(entity.height) ||
        entity.width <= policy.linearTolerance ||
        entity.height <= policy.linearTolerance
      ) {
        issues.push(
          issue(
            "SKETCH_REGION_ENTITY_UNSUPPORTED",
            `Rectangle ${entity.id} must have finite dimensions above tolerance.`,
            { ...issueDetails, entityId: entity.id }
          )
        );
        return { orientationChanged: false, cyclicStartChanged: false };
      }
      area = entity.width * entity.height;
      primitives = rectanglePrimitives(entity);
      sample = entity.center;
    }
    if (
      primitives.some(
        (primitive) => !hasFiniteDerivedPrimitiveGeometry(primitive, policy)
      )
    ) {
      issues.push(
        issue(
          "SKETCH_REGION_ENTITY_UNSUPPORTED",
          `Entity ${entity.id} produces non-finite or degenerate boundary geometry.`,
          { ...issueDetails, entityId: entity.id }
        )
      );
      return { orientationChanged: false, cyclicStartChanged: false };
    }
    if (!Number.isFinite(area) || area < policy.minimumProfileArea) {
      issues.push(
        issue(
          "SKETCH_REGION_LOOP_AREA_TOO_SMALL",
          `Loop ${entity.id} is below the shared minimum profile area.`,
          {
            ...issueDetails,
            entityId: entity.id,
            expected: `>= ${policy.minimumProfileArea}`,
            received: String(area)
          }
        )
      );
      return { orientationChanged: false, cyclicStartChanged: false };
    }
    const normalized = { kind: "entity", entityId: entity.id } as const;
    return {
      loop: {
        source: loop,
        normalized,
        key: getSketchLoopCanonicalKey(normalized),
        entityIds: [entity.id],
        primitives,
        signedArea: role === "outer" ? area : -area,
        absoluteArea: area,
        boundarySample:
          entity.kind === "circle"
            ? [entity.center[0] + entity.radius, entity.center[1]]
            : primitives[0]!.kind === "circle"
              ? sample
              : primitives[0]!.start,
        sample
      },
      orientationChanged: false,
      cyclicStartChanged: false
    };
  }

  if (loop.segments.length < 2) {
    issues.push(
      issue(
        "SKETCH_REGION_LOOP_OPEN",
        "A wire loop requires at least two line or arc segments.",
        { ...issueDetails, received: String(loop.segments.length) }
      )
    );
    return { orientationChanged: false, cyclicStartChanged: false };
  }

  const localSeen = new Set<string>();
  const resolved: ResolvedSketchSegment[] = [];
  for (const [segmentIndex, reference] of loop.segments.entries()) {
    if (
      localSeen.has(reference.entityId) ||
      globallySeen.has(reference.entityId)
    ) {
      issues.push(
        issue(
          "SKETCH_REGION_ENTITY_REPEATED",
          `Entity ${reference.entityId} occurs more than once in the submitted regions profile.`,
          { ...issueDetails, entityId: reference.entityId }
        )
      );
      continue;
    }
    localSeen.add(reference.entityId);
    globallySeen.add(reference.entityId);
    const entity = entities.get(reference.entityId);
    if (!entity) {
      issues.push(
        issue(
          "SKETCH_REGION_ENTITY_MISSING",
          `Region loop entity does not exist: ${reference.entityId}.`,
          { ...issueDetails, entityId: reference.entityId }
        )
      );
      continue;
    }
    if (entity.kind !== "line" && entity.kind !== "arc") {
      issues.push(
        issue(
          "SKETCH_REGION_ENTITY_UNSUPPORTED",
          `Wire loops support only line and arc entities, not ${entity.kind}.`,
          { ...issueDetails, entityId: entity.id }
        )
      );
      continue;
    }
    if (entity.construction) {
      issues.push(
        issue(
          "SKETCH_REGION_CONSTRUCTION_ENTITY",
          `Construction entity ${entity.id} cannot define a material region.`,
          { ...issueDetails, entityId: entity.id }
        )
      );
      continue;
    }
    const resolution = resolveOrientedSketchSegment(
      entity,
      reference.orientation,
      policy
    );
    if (!resolution.ok) {
      issues.push(
        issue("SKETCH_REGION_ENTITY_UNSUPPORTED", resolution.issue.message, {
          ...issueDetails,
          entityId: entity.id
        })
      );
      continue;
    }
    if (!hasFiniteDerivedPrimitiveGeometry(resolution.segment, policy)) {
      issues.push(
        issue(
          "SKETCH_REGION_ENTITY_UNSUPPORTED",
          `Entity ${entity.id} produces non-finite or degenerate boundary geometry.`,
          { ...issueDetails, entityId: entity.id }
        )
      );
      continue;
    }
    resolved.push(resolution.segment);
    void segmentIndex;
  }
  if (resolved.length !== loop.segments.length) {
    return { orientationChanged: false, cyclicStartChanged: false };
  }

  for (let index = 0; index < resolved.length; index += 1) {
    budget.visit();
    const left = resolved[index]!;
    const right = resolved[(index + 1) % resolved.length]!;
    if (!areSketchPointsCoincident(left.end, right.start, policy)) {
      issues.push(
        issue(
          "SKETCH_REGION_LOOP_OPEN",
          `Wire loop join ${index} exceeds the shared linear tolerance.`,
          {
            ...issueDetails,
            entityId: left.entityId,
            otherEntityId: right.entityId
          }
        )
      );
    }
  }

  for (let leftIndex = 0; leftIndex < resolved.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < resolved.length;
      rightIndex += 1
    ) {
      budget.visit();
      const left = resolved[leftIndex]!;
      const right = resolved[rightIndex]!;
      const intersection = intersectSketchSegments(left, right, policy);
      const adjacent =
        rightIndex === leftIndex + 1 ||
        (leftIndex === 0 && rightIndex === resolved.length - 1);
      const allowedJoin =
        adjacent &&
        !intersection.overlap &&
        intersection.points.length > 0 &&
        intersection.points.every((point) =>
          resolved.length === 2
            ? (point.leftLocation === "start" &&
                point.rightLocation === "end") ||
              (point.leftLocation === "end" && point.rightLocation === "start")
            : leftIndex === 0 && rightIndex === resolved.length - 1
              ? point.leftLocation === "start" && point.rightLocation === "end"
              : point.leftLocation === "end" && point.rightLocation === "start"
        );
      if (
        intersection.overlap ||
        (intersection.points.length > 0 && !allowedJoin)
      ) {
        issues.push(
          issue(
            "SKETCH_REGION_LOOP_INTERSECTION",
            `Wire loop entities ${left.entityId} and ${right.entityId} overlap or intersect away from their shared join.`,
            {
              ...issueDetails,
              entityId: left.entityId,
              otherEntityId: right.entityId
            }
          )
        );
      }
    }
  }

  const signedArea = getSketchWireSignedArea(resolved);
  const absoluteArea = Math.abs(signedArea);
  if (
    !Number.isFinite(signedArea) ||
    absoluteArea < policy.minimumProfileArea
  ) {
    issues.push(
      issue(
        "SKETCH_REGION_LOOP_AREA_TOO_SMALL",
        "Wire loop is below the shared minimum profile area.",
        {
          ...issueDetails,
          expected: `>= ${policy.minimumProfileArea}`,
          received: String(absoluteArea)
        }
      )
    );
    return { orientationChanged: false, cyclicStartChanged: false };
  }

  const canonical = canonicalizeWire(loop.segments, signedArea, role);
  const normalized = canonical.loop;
  return {
    loop: {
      source: loop,
      normalized,
      key: getSketchLoopCanonicalKey(normalized),
      entityIds:
        normalized.kind === "wire"
          ? normalized.segments.map((reference) => reference.entityId)
          : [normalized.entityId],
      primitives: resolved,
      signedArea: role === "outer" ? absoluteArea : -absoluteArea,
      absoluteArea,
      boundarySample: resolved[0]!.start,
      sample: resolved[0]!.start
    },
    orientationChanged: canonical.orientationChanged,
    cyclicStartChanged: canonical.cyclicStartChanged
  };
}

function cross(left: Vec2, right: Vec2): number {
  return left[0] * right[1] - left[1] * right[0];
}

function dot(left: Vec2, right: Vec2): number {
  return left[0] * right[0] + left[1] * right[1];
}

function subtract(left: Vec2, right: Vec2): Vec2 {
  return [left[0] - right[0], left[1] - right[1]];
}

function normalizeRadians(angle: number): number {
  const twoPi = 2 * Math.PI;
  return ((angle % twoPi) + twoPi) % twoPi;
}

function arcContainsAngle(
  arc: ResolvedSketchArcSegment,
  angle: number,
  policy: SketchGeometryPolicy
): boolean {
  const progress =
    arc.sweepAngleRadians >= 0
      ? normalizeRadians(angle - arc.startAngleRadians)
      : normalizeRadians(arc.startAngleRadians - angle);
  const limit = Math.abs(arc.sweepAngleRadians);
  const tolerance = Math.min(Math.PI, policy.linearTolerance / arc.radius);
  return progress <= limit + tolerance || 2 * Math.PI - progress <= tolerance;
}

function pointOnPrimitiveDistance(
  point: Vec2,
  primitive: BoundaryPrimitive,
  policy: SketchGeometryPolicy
): number {
  if (primitive.kind === "circle") {
    return Math.abs(distance(point, primitive.center) - primitive.radius);
  }
  if (primitive.kind === "arc") {
    const angle = Math.atan2(
      point[1] - primitive.center[1],
      point[0] - primitive.center[0]
    );
    if (arcContainsAngle(primitive, angle, policy)) {
      return Math.abs(distance(point, primitive.center) - primitive.radius);
    }
    return Math.min(
      distance(point, primitive.start),
      distance(point, primitive.end)
    );
  }
  const vector = subtract(primitive.end, primitive.start);
  const lengthSquared = dot(vector, vector);
  const along = Math.max(
    0,
    Math.min(1, dot(subtract(point, primitive.start), vector) / lengthSquared)
  );
  return distance(point, [
    primitive.start[0] + along * vector[0],
    primitive.start[1] + along * vector[1]
  ]);
}

function primitiveEndpoints(primitive: BoundaryPrimitive): readonly Vec2[] {
  return primitive.kind === "circle" ? [] : [primitive.start, primitive.end];
}

function primitiveIntersection(
  left: BoundaryPrimitive,
  right: BoundaryPrimitive,
  policy: SketchGeometryPolicy
): boolean {
  if (left.kind !== "circle" && right.kind !== "circle") {
    const intersection = intersectSketchSegments(left, right, policy);
    return intersection.overlap || intersection.points.length > 0;
  }
  if (left.kind === "circle" && right.kind === "circle") {
    const centerDistance = distance(left.center, right.center);
    return (
      Math.abs(centerDistance - (left.radius + right.radius)) <=
        policy.linearTolerance ||
      Math.abs(centerDistance - Math.abs(left.radius - right.radius)) <=
        policy.linearTolerance ||
      (centerDistance < left.radius + right.radius - policy.linearTolerance &&
        centerDistance >
          Math.abs(left.radius - right.radius) + policy.linearTolerance)
    );
  }
  const circle =
    left.kind === "circle"
      ? left
      : (right as Extract<BoundaryPrimitive, { readonly kind: "circle" }>);
  const segment =
    left.kind === "circle"
      ? (right as ResolvedSketchSegment)
      : (left as ResolvedSketchSegment);
  if (segment.kind === "line") {
    const lineDistance = pointOnPrimitiveDistance(
      circle.center,
      segment,
      policy
    );
    if (Math.abs(lineDistance - circle.radius) <= policy.linearTolerance)
      return true;
    const endpointDistances = primitiveEndpoints(segment).map((point) =>
      distance(point, circle.center)
    );
    return (
      lineDistance < circle.radius - policy.linearTolerance &&
      endpointDistances.some(
        (value) => value > circle.radius + policy.linearTolerance
      )
    );
  }
  const supportDistance = distance(circle.center, segment.center);
  if (
    supportDistance > circle.radius + segment.radius + policy.linearTolerance ||
    supportDistance <
      Math.abs(circle.radius - segment.radius) - policy.linearTolerance
  ) {
    return false;
  }
  const denominator = 2 * supportDistance * circle.radius;
  if (denominator === 0) {
    return Math.abs(circle.radius - segment.radius) <= policy.linearTolerance;
  }
  const cosine =
    (supportDistance * supportDistance +
      circle.radius * circle.radius -
      segment.radius * segment.radius) /
    denominator;
  if (cosine < -1 || cosine > 1) return false;
  const base = Math.atan2(
    segment.center[1] - circle.center[1],
    segment.center[0] - circle.center[0]
  );
  const offset = Math.acos(Math.max(-1, Math.min(1, cosine)));
  return [base - offset, base + offset].some((angle) => {
    const point: Vec2 = [
      circle.center[0] + circle.radius * Math.cos(angle),
      circle.center[1] + circle.radius * Math.sin(angle)
    ];
    return arcContainsAngle(
      segment,
      Math.atan2(point[1] - segment.center[1], point[0] - segment.center[0]),
      policy
    );
  });
}

function primitiveDistance(
  left: BoundaryPrimitive,
  right: BoundaryPrimitive,
  policy: SketchGeometryPolicy
): number {
  if (primitiveIntersection(left, right, policy)) return 0;
  const endpointDistances = [
    ...primitiveEndpoints(left).map((point) =>
      pointOnPrimitiveDistance(point, right, policy)
    ),
    ...primitiveEndpoints(right).map((point) =>
      pointOnPrimitiveDistance(point, left, policy)
    )
  ];
  const addLineArcStationaryDistances = (
    line: ResolvedSketchLineSegment,
    arc: ResolvedSketchArcSegment
  ): void => {
    const vector = subtract(line.end, line.start);
    const lengthSquared = dot(vector, vector);
    const length = Math.sqrt(lengthSquared);
    const normalAngle = Math.atan2(vector[1], vector[0]) + Math.PI / 2;
    for (const angle of [normalAngle, normalAngle + Math.PI]) {
      if (!arcContainsAngle(arc, angle, policy)) continue;
      const point: Vec2 = [
        arc.center[0] + arc.radius * Math.cos(angle),
        arc.center[1] + arc.radius * Math.sin(angle)
      ];
      const parameter =
        dot(subtract(point, line.start), vector) / lengthSquared;
      if (parameter < 0 || parameter > 1) continue;
      endpointDistances.push(
        Math.abs(cross(vector, subtract(point, line.start))) / length
      );
    }
  };
  if (left.kind === "line" && right.kind === "arc") {
    addLineArcStationaryDistances(left, right);
  } else if (left.kind === "arc" && right.kind === "line") {
    addLineArcStationaryDistances(right, left);
  }
  if (left.kind === "circle") {
    if (right.kind === "circle") {
      const centers = distance(left.center, right.center);
      endpointDistances.push(
        Math.min(
          Math.abs(centers - left.radius - right.radius),
          Math.abs(centers - Math.abs(left.radius - right.radius))
        )
      );
    } else {
      endpointDistances.push(
        Math.abs(
          pointOnPrimitiveDistance(left.center, right, policy) - left.radius
        )
      );
      if (right.kind === "arc") {
        const angle = Math.atan2(
          left.center[1] - right.center[1],
          left.center[0] - right.center[0]
        );
        for (const candidateAngle of [angle, angle + Math.PI]) {
          if (!arcContainsAngle(right, candidateAngle, policy)) continue;
          const point: Vec2 = [
            right.center[0] + right.radius * Math.cos(candidateAngle),
            right.center[1] + right.radius * Math.sin(candidateAngle)
          ];
          endpointDistances.push(
            Math.abs(distance(point, left.center) - left.radius)
          );
        }
      }
    }
  } else if (right.kind === "circle") {
    endpointDistances.push(
      Math.abs(
        pointOnPrimitiveDistance(right.center, left, policy) - right.radius
      )
    );
    if (left.kind === "arc") {
      const angle = Math.atan2(
        right.center[1] - left.center[1],
        right.center[0] - left.center[0]
      );
      for (const candidateAngle of [angle, angle + Math.PI]) {
        if (!arcContainsAngle(left, candidateAngle, policy)) continue;
        const point: Vec2 = [
          left.center[0] + left.radius * Math.cos(candidateAngle),
          left.center[1] + left.radius * Math.sin(candidateAngle)
        ];
        endpointDistances.push(
          Math.abs(distance(point, right.center) - right.radius)
        );
      }
    }
  } else if (left.kind === "arc" && right.kind === "arc") {
    const angle = Math.atan2(
      right.center[1] - left.center[1],
      right.center[0] - left.center[0]
    );
    for (const leftAngle of [angle, angle + Math.PI]) {
      if (!arcContainsAngle(left, leftAngle, policy)) continue;
      const point: Vec2 = [
        left.center[0] + left.radius * Math.cos(leftAngle),
        left.center[1] + left.radius * Math.sin(leftAngle)
      ];
      endpointDistances.push(pointOnPrimitiveDistance(point, right, policy));
    }
    const reverseAngle = Math.atan2(
      left.center[1] - right.center[1],
      left.center[0] - right.center[0]
    );
    for (const rightAngle of [reverseAngle, reverseAngle + Math.PI]) {
      if (!arcContainsAngle(right, rightAngle, policy)) continue;
      const point: Vec2 = [
        right.center[0] + right.radius * Math.cos(rightAngle),
        right.center[1] + right.radius * Math.sin(rightAngle)
      ];
      endpointDistances.push(pointOnPrimitiveDistance(point, left, policy));
    }
  }
  return Math.min(...endpointDistances);
}

function loopBoundaryDistance(
  left: ResolvedLoop,
  right: ResolvedLoop,
  budget: PredicateBudget,
  policy: SketchGeometryPolicy
): number {
  let minimum = Number.POSITIVE_INFINITY;
  for (const leftPrimitive of left.primitives) {
    for (const rightPrimitive of right.primitives) {
      budget.visit();
      minimum = Math.min(
        minimum,
        primitiveDistance(leftPrimitive, rightPrimitive, policy)
      );
      if (minimum === 0) return 0;
    }
  }
  return minimum;
}

function pointInsideLoop(
  point: Vec2,
  loop: ResolvedLoop,
  budget: PredicateBudget
): boolean {
  budget.visit();
  if (loop.primitives.length === 1 && loop.primitives[0]?.kind === "circle") {
    const circle = loop.primitives[0];
    return distance(point, circle.center) < circle.radius;
  }

  let winding = 0;
  for (const primitive of loop.primitives) {
    if (primitive.kind === "circle") {
      if (distance(point, primitive.center) < primitive.radius) {
        winding += 2 * Math.PI;
      }
      continue;
    }
    const start = subtract(primitive.start, point);
    const end = subtract(primitive.end, point);
    if (primitive.kind === "line") {
      winding += Math.atan2(cross(start, end), dot(start, end));
      continue;
    }
    const endpointDelta = Math.atan2(cross(start, end), dot(start, end));
    winding +=
      distance(point, primitive.center) < primitive.radius
        ? primitive.sweepAngleRadians
        : endpointDelta;
  }
  return Math.abs(winding) > Math.PI;
}

function pointInRegionMaterial(
  point: Vec2,
  outer: ResolvedLoop,
  holes: readonly ResolvedLoop[],
  budget: PredicateBudget
): boolean {
  return (
    pointInsideLoop(point, outer, budget) &&
    !holes.some((hole) => pointInsideLoop(point, hole, budget))
  );
}

function findInteriorSample(
  loop: ResolvedLoop,
  budget: PredicateBudget,
  policy: SketchGeometryPolicy
): Vec2 {
  if (loop.primitives.length === 1 && loop.primitives[0]?.kind === "circle") {
    return loop.primitives[0].center;
  }
  const primitive = loop.primitives[0]!;
  if (primitive.kind === "circle") return primitive.center;
  const midpoint: Vec2 = [
    (primitive.start[0] + primitive.end[0]) / 2,
    (primitive.start[1] + primitive.end[1]) / 2
  ];
  const tangent =
    primitive.kind === "line"
      ? subtract(primitive.end, primitive.start)
      : [
          -Math.sin(
            primitive.startAngleRadians + primitive.sweepAngleRadians / 2
          ) * Math.sign(primitive.sweepAngleRadians),
          Math.cos(
            primitive.startAngleRadians + primitive.sweepAngleRadians / 2
          ) * Math.sign(primitive.sweepAngleRadians)
        ];
  const length = Math.hypot(tangent[0], tangent[1]);
  const normal: Vec2 = [-tangent[1] / length, tangent[0] / length];
  const scale = Math.max(
    policy.linearTolerance * 4,
    Math.sqrt(loop.absoluteArea) * 1e-6
  );
  const left: Vec2 = [
    midpoint[0] + normal[0] * scale,
    midpoint[1] + normal[1] * scale
  ];
  if (pointInsideLoop(left, loop, budget)) return left;
  const right: Vec2 = [
    midpoint[0] - normal[0] * scale,
    midpoint[1] - normal[1] * scale
  ];
  return pointInsideLoop(right, loop, budget) ? right : loop.sample;
}

function findRegionMaterialSample(
  outer: ResolvedLoop,
  holes: readonly ResolvedLoop[],
  budget: PredicateBudget,
  policy: SketchGeometryPolicy
): Vec2 {
  const inset = policy.linearTolerance / 2;
  for (const primitive of outer.primitives) {
    if (primitive.kind === "circle") {
      for (const angle of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
        const radius = Math.max(primitive.radius / 2, primitive.radius - inset);
        const candidate: Vec2 = [
          primitive.center[0] + radius * Math.cos(angle),
          primitive.center[1] + radius * Math.sin(angle)
        ];
        if (pointInRegionMaterial(candidate, outer, holes, budget)) {
          return candidate;
        }
      }
      continue;
    }
    const angle =
      primitive.kind === "arc"
        ? primitive.startAngleRadians + primitive.sweepAngleRadians / 2
        : undefined;
    const midpoint: Vec2 =
      primitive.kind === "arc" && angle !== undefined
        ? [
            primitive.center[0] + primitive.radius * Math.cos(angle),
            primitive.center[1] + primitive.radius * Math.sin(angle)
          ]
        : [
            (primitive.start[0] + primitive.end[0]) / 2,
            (primitive.start[1] + primitive.end[1]) / 2
          ];
    const tangent: Vec2 =
      primitive.kind === "arc" && angle !== undefined
        ? [
            -Math.sin(angle) * Math.sign(primitive.sweepAngleRadians),
            Math.cos(angle) * Math.sign(primitive.sweepAngleRadians)
          ]
        : subtract(primitive.end, primitive.start);
    const length = Math.hypot(tangent[0], tangent[1]);
    const normal: Vec2 = [-tangent[1] / length, tangent[0] / length];
    for (const direction of [1, -1]) {
      const candidate: Vec2 = [
        midpoint[0] + direction * normal[0] * inset,
        midpoint[1] + direction * normal[1] * inset
      ];
      if (pointInRegionMaterial(candidate, outer, holes, budget)) {
        return candidate;
      }
    }
  }
  return findInteriorSample(outer, budget, policy);
}

function orderChanged(
  before: readonly string[],
  after: readonly string[]
): boolean {
  return before.some((key, index) => key !== after[index]);
}

function complexitySnapshot(
  complexity: MutableComplexity
): V22RegionSourceComplexity {
  return { ...complexity };
}

function sortedKeys(keys: ReadonlySet<string>): readonly string[] {
  return [...keys].sort(compareSketchCanonicalKeys);
}

function createContainmentDepths(
  loops: readonly ResolvedLoop[],
  budget: PredicateBudget
): ReadonlyMap<string, number> {
  return new Map(
    loops.map((loop) => [
      loop.key,
      loops.reduce(
        (depth, candidateContainer) =>
          candidateContainer === loop
            ? depth
            : depth +
              (pointInsideLoop(loop.boundarySample, candidateContainer, budget)
                ? 1
                : 0),
        0
      )
    ])
  );
}

/**
 * Validate and deterministically normalize authoritative V22 material-region
 * source. The function is pure and bounded; it never consults derived meshes
 * or OCCT.
 */
export function validateV22RegionSource(
  profile: SketchRegionsProfileRef,
  sketch: V22RegionSourceSketch,
  policy: SketchGeometryPolicy = SKETCH_GEOMETRY_POLICY
): V22RegionSourceValidationResult {
  const { entities } = sketch;
  const complexity: MutableComplexity = {
    sketchEntityCount: entities.size,
    regionCount: profile.regions.length,
    loopCount: profile.regions.reduce(
      (count, region) => count + 1 + region.holes.length,
      0
    ),
    segmentReferenceCount: profile.regions.reduce(
      (count, region) =>
        count +
        (region.outer.kind === "wire" ? region.outer.segments.length : 0) +
        region.holes.reduce(
          (holeCount, hole) =>
            holeCount + (hole.kind === "wire" ? hole.segments.length : 0),
          0
        ),
      0
    ),
    predicateVisitCount: 0
  };
  const issues: V22RegionSourceIssue[] = [];
  if (profile.sketchId !== sketch.id) {
    issues.push(
      issue(
        "SKETCH_REGION_SKETCH_MISMATCH",
        "Every submitted region loop must resolve from the profile sketch.",
        {
          expected: profile.sketchId,
          received: sketch.id
        }
      )
    );
  }
  if (profile.regions.length === 0) {
    issues.push(
      issue(
        "SKETCH_REGION_PROFILE_EMPTY",
        "A regions profile requires at least one material region."
      )
    );
  }
  const limitChecks = [
    {
      received: entities.size,
      maximum: CAD_V19_RESOURCE_LIMITS.maxSketchEntitiesPerEditedSketch,
      label: "sketch entities"
    },
    {
      received: complexity.regionCount,
      maximum: CAD_V19_RESOURCE_LIMITS.maxRegionsPerProfile,
      label: "regions"
    },
    {
      received: complexity.loopCount,
      maximum: CAD_V19_RESOURCE_LIMITS.maxLoopsPerProfile,
      label: "loops"
    },
    {
      received: complexity.segmentReferenceCount,
      maximum: CAD_V19_RESOURCE_LIMITS.maxSegmentReferencesPerProfile,
      label: "segment references"
    }
  ];
  for (const check of limitChecks) {
    if (check.received > check.maximum) {
      issues.push(
        issue(
          "SKETCH_REGION_COMPLEXITY_LIMIT",
          `Submitted region source exceeds the V19 ${check.label} limit.`,
          {
            expected: `<= ${check.maximum}`,
            received: String(check.received)
          }
        )
      );
    }
  }
  if (issues.length > 0) {
    return {
      ok: false,
      complexity: complexitySnapshot(complexity),
      issues
    };
  }

  const budget = new PredicateBudget(complexity);
  const globallySeen = new Set<string>();
  let orientationChanged = false;
  let cyclicStartChanged = false;
  let holeOrderChanged = false;
  let regionOrderChanged = false;
  const outerOrientationsChanged = new Set<string>();
  const holeOrientationsChanged = new Set<string>();
  const cyclicStartsChanged = new Set<string>();
  const resolvedRegions: {
    readonly sourceIndex: number;
    readonly outer: ResolvedLoop;
    readonly holes: readonly ResolvedLoop[];
  }[] = [];

  try {
    for (const [regionIndex, region] of profile.regions.entries()) {
      const outerResult = resolveLoop(
        region.outer,
        "outer",
        entities,
        globallySeen,
        issues,
        { regionIndex },
        policy,
        budget
      );
      orientationChanged ||= outerResult.orientationChanged;
      cyclicStartChanged ||= outerResult.cyclicStartChanged;
      if (outerResult.loop && outerResult.orientationChanged) {
        outerOrientationsChanged.add(outerResult.loop.key);
      }
      if (outerResult.loop && outerResult.cyclicStartChanged) {
        cyclicStartsChanged.add(outerResult.loop.key);
      }
      const holes: ResolvedLoop[] = [];
      for (const [holeIndex, hole] of region.holes.entries()) {
        const holeResult = resolveLoop(
          hole,
          "hole",
          entities,
          globallySeen,
          issues,
          { regionIndex, holeIndex },
          policy,
          budget
        );
        orientationChanged ||= holeResult.orientationChanged;
        cyclicStartChanged ||= holeResult.cyclicStartChanged;
        if (holeResult.loop && holeResult.orientationChanged) {
          holeOrientationsChanged.add(holeResult.loop.key);
        }
        if (holeResult.loop && holeResult.cyclicStartChanged) {
          cyclicStartsChanged.add(holeResult.loop.key);
        }
        if (holeResult.loop) holes.push(holeResult.loop);
      }
      if (outerResult.loop && holes.length === region.holes.length) {
        resolvedRegions.push({
          sourceIndex: regionIndex,
          outer: outerResult.loop,
          holes
        });
      }
    }

    if (
      issues.length > 0 ||
      resolvedRegions.length !== profile.regions.length
    ) {
      return {
        ok: false,
        complexity: complexitySnapshot(complexity),
        issues
      };
    }

    const validationRegions = resolvedRegions
      .map((region) => ({
        ...region,
        holes: [...region.holes].sort((left, right) =>
          compareSketchCanonicalKeys(left.key, right.key)
        )
      }))
      .sort((left, right) =>
        compareSketchCanonicalKeys(left.outer.key, right.outer.key)
      );
    const materialAreas: number[] = Array.from({
      length: resolvedRegions.length
    });
    for (const region of validationRegions) {
      for (const hole of region.holes) {
        const separation = loopBoundaryDistance(
          region.outer,
          hole,
          budget,
          policy
        );
        if (separation <= policy.linearTolerance) {
          issues.push(
            issue(
              "SKETCH_REGION_BOUNDARY_TOUCHING",
              "A hole boundary must remain more than linearTolerance from its outer boundary.",
              {
                regionIndex: region.sourceIndex,
                loopRole: "hole",
                loopKey: hole.key,
                otherLoopKey: region.outer.key,
                expected: `> ${policy.linearTolerance}`,
                received: String(separation)
              }
            )
          );
        } else {
          if (!pointInsideLoop(hole.boundarySample, region.outer, budget)) {
            issues.push(
              issue(
                "SKETCH_REGION_HOLE_OUTSIDE",
                "Every hole must lie strictly inside its region outer loop.",
                {
                  regionIndex: region.sourceIndex,
                  loopRole: "hole",
                  loopKey: hole.key,
                  otherLoopKey: region.outer.key
                }
              )
            );
          }
        }
      }

      for (let leftIndex = 0; leftIndex < region.holes.length; leftIndex += 1) {
        for (
          let rightIndex = leftIndex + 1;
          rightIndex < region.holes.length;
          rightIndex += 1
        ) {
          const left = region.holes[leftIndex]!;
          const right = region.holes[rightIndex]!;
          const separation = loopBoundaryDistance(left, right, budget, policy);
          if (separation <= policy.linearTolerance) {
            issues.push(
              issue(
                "SKETCH_REGION_HOLES_OVERLAP",
                "Hole boundaries must be disjoint and more than linearTolerance apart.",
                {
                  regionIndex: region.sourceIndex,
                  loopKey: left.key,
                  otherLoopKey: right.key,
                  expected: `> ${policy.linearTolerance}`,
                  received: String(separation)
                }
              )
            );
            continue;
          }
          if (
            pointInsideLoop(left.boundarySample, right, budget) ||
            pointInsideLoop(right.boundarySample, left, budget)
          ) {
            issues.push(
              issue(
                "SKETCH_REGION_NESTING_UNSUPPORTED",
                "A hole cannot overlap, contain, or be contained by another hole in the same region.",
                {
                  regionIndex: region.sourceIndex,
                  loopKey: left.key,
                  otherLoopKey: right.key
                }
              )
            );
          }
        }
      }

      const materialArea =
        region.outer.absoluteArea -
        region.holes.reduce((sum, hole) => sum + hole.absoluteArea, 0);
      materialAreas[region.sourceIndex] = materialArea;
      if (
        !Number.isFinite(materialArea) ||
        materialArea < policy.minimumProfileArea
      ) {
        issues.push(
          issue(
            "SKETCH_REGION_LOOP_AREA_TOO_SMALL",
            "Region material area after subtracting holes is below the shared minimum profile area.",
            {
              regionIndex: region.sourceIndex,
              loopKey: region.outer.key,
              expected: `>= ${policy.minimumProfileArea}`,
              received: String(materialArea)
            }
          )
        );
      }
    }

    for (
      let leftIndex = 0;
      leftIndex < validationRegions.length;
      leftIndex += 1
    ) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < validationRegions.length;
        rightIndex += 1
      ) {
        const left = validationRegions[leftIndex]!;
        const right = validationRegions[rightIndex]!;
        const leftLoops = [left.outer, ...left.holes];
        const rightLoops = [right.outer, ...right.holes];
        let boundariesTouch = false;
        for (const leftLoop of leftLoops) {
          for (const rightLoop of rightLoops) {
            const separation = loopBoundaryDistance(
              leftLoop,
              rightLoop,
              budget,
              policy
            );
            if (separation <= policy.linearTolerance) {
              boundariesTouch = true;
              issues.push(
                issue(
                  "SKETCH_REGION_BOUNDARY_TOUCHING",
                  "Distinct regions may not have touching or intersecting boundaries.",
                  {
                    regionIndex: left.sourceIndex,
                    loopKey: leftLoop.key,
                    otherLoopKey: rightLoop.key,
                    expected: `> ${policy.linearTolerance}`,
                    received: String(separation)
                  }
                )
              );
            }
          }
        }
        if (boundariesTouch) continue;
        const leftSample = findRegionMaterialSample(
          left.outer,
          left.holes,
          budget,
          policy
        );
        const rightSample = findRegionMaterialSample(
          right.outer,
          right.holes,
          budget,
          policy
        );
        if (
          pointInRegionMaterial(leftSample, right.outer, right.holes, budget) ||
          pointInRegionMaterial(rightSample, left.outer, left.holes, budget)
        ) {
          issues.push(
            issue(
              "SKETCH_REGION_MATERIAL_OVERLAP",
              "Material areas of distinct submitted regions must be disjoint.",
              {
                regionIndex: left.sourceIndex,
                loopKey: left.outer.key,
                otherLoopKey: right.outer.key
              }
            )
          );
        }
      }
    }

    if (issues.length > 0) {
      return {
        ok: false,
        complexity: complexitySnapshot(complexity),
        issues
      };
    }

    const normalizedRegions = resolvedRegions.map((region) => {
      const holes = [...region.holes].sort((left, right) =>
        compareSketchCanonicalKeys(left.key, right.key)
      );
      holeOrderChanged ||= orderChanged(
        region.holes.map((hole) => hole.key),
        holes.map((hole) => hole.key)
      );
      return {
        sourceIndex: region.sourceIndex,
        outer: region.outer,
        holes,
        region: {
          outer: region.outer.normalized,
          holes: holes.map((hole) => hole.normalized)
        } satisfies SketchProfileRegionRef
      };
    });
    normalizedRegions.sort((left, right) =>
      compareSketchCanonicalKeys(left.outer.key, right.outer.key)
    );
    regionOrderChanged = orderChanged(
      resolvedRegions.map((region) => region.outer.key),
      normalizedRegions.map((region) => region.outer.key)
    );
    const [firstRegion, ...remainingRegions] = normalizedRegions.map(
      (region) => region.region
    );
    if (!firstRegion) {
      throw new Error("Validated regions profile unexpectedly became empty.");
    }
    const normalizedProfile: SketchRegionsProfileRef = {
      kind: "regions",
      sketchId: profile.sketchId,
      regions: [firstRegion, ...remainingRegions]
    };
    const normalizedMaterialAreas = normalizedRegions.map(
      (region) => materialAreas[region.sourceIndex]!
    );
    const containmentDepths = createContainmentDepths(
      normalizedRegions.flatMap((region) => [region.outer, ...region.holes]),
      budget
    );
    const loopSummaries = normalizedRegions.flatMap((region, regionIndex) => [
      {
        loopKey: region.outer.key,
        role: "outer" as const,
        regionIndex,
        entityIds: region.outer.entityIds,
        signedArea: region.outer.absoluteArea,
        absoluteArea: region.outer.absoluteArea,
        containmentDepth: containmentDepths.get(region.outer.key) ?? 0
      },
      ...region.holes.map((hole) => ({
        loopKey: hole.key,
        role: "hole" as const,
        regionIndex,
        entityIds: hole.entityIds,
        signedArea: -hole.absoluteArea,
        absoluteArea: hole.absoluteArea,
        containmentDepth: containmentDepths.get(hole.key) ?? 0
      }))
    ]);
    return {
      ok: true,
      normalizedProfile,
      materialAreas: normalizedMaterialAreas,
      loopSummaries,
      normalization: {
        orientationChanged,
        cyclicStartChanged,
        outerOrientationsChanged: sortedKeys(outerOrientationsChanged),
        holeOrientationsChanged: sortedKeys(holeOrientationsChanged),
        cyclicStartsChanged: sortedKeys(cyclicStartsChanged),
        holeOrderChanged,
        regionOrderChanged
      },
      complexity: complexitySnapshot(complexity),
      issues: []
    };
  } catch (error) {
    if (!(error instanceof PredicateBudgetExceeded)) throw error;
    return {
      ok: false,
      complexity: complexitySnapshot(complexity),
      issues: [
        ...issues,
        issue(
          "SKETCH_REGION_COMPLEXITY_LIMIT",
          "Submitted region validation exceeded the analytic predicate-visit limit.",
          {
            expected: `<= ${CAD_V19_RESOURCE_LIMITS.maxSubmittedProfilePredicateVisits}`,
            received: String(complexity.predicateVisitCount)
          }
        )
      ]
    };
  }
}

export interface V22RegionDiscoveryAnalyzedLoop {
  readonly outer: SketchLoopRef;
  readonly hole: SketchLoopRef;
  readonly outerLoopKey: string;
  readonly holeLoopKey: string;
  readonly entityIds: readonly string[];
  readonly signedArea: number;
  readonly absoluteArea: number;
  readonly bounds: SketchBounds2d;
  readonly containmentDepth: number;
  readonly parentIndex?: number;
  readonly directChildIndexes: readonly number[];
}

export interface V22RegionDiscoveryBoundaryConflict {
  readonly leftLoopIndex: number;
  readonly rightLoopIndex: number;
  readonly separation: number;
}

export type V22RegionDiscoveryAnalysisResult =
  | {
      readonly ok: true;
      readonly loops: readonly V22RegionDiscoveryAnalyzedLoop[];
      readonly boundaryConflicts: readonly V22RegionDiscoveryBoundaryConflict[];
      readonly complexity: V22RegionSourceComplexity;
      readonly issues: readonly [];
    }
  | {
      readonly ok: false;
      readonly loops: readonly [];
      readonly boundaryConflicts: readonly [];
      readonly complexity: V22RegionSourceComplexity;
      readonly issues: readonly V22RegionSourceIssue[];
    };

function mergePointBounds(points: readonly Vec2[]): SketchBounds2d {
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

function primitiveBounds(
  primitive: BoundaryPrimitive,
  policy: SketchGeometryPolicy
): SketchBounds2d {
  if (primitive.kind === "circle") {
    return {
      min: [
        primitive.center[0] - primitive.radius,
        primitive.center[1] - primitive.radius
      ],
      max: [
        primitive.center[0] + primitive.radius,
        primitive.center[1] + primitive.radius
      ]
    };
  }
  if (primitive.kind === "line") {
    return mergePointBounds([primitive.start, primitive.end]);
  }
  const points: Vec2[] = [primitive.start, primitive.end];
  for (const angle of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
    if (!arcContainsAngle(primitive, angle, policy)) continue;
    points.push([
      primitive.center[0] + primitive.radius * Math.cos(angle),
      primitive.center[1] + primitive.radius * Math.sin(angle)
    ]);
  }
  return mergePointBounds(points);
}

function loopBounds(
  loop: ResolvedLoop,
  policy: SketchGeometryPolicy
): SketchBounds2d {
  const bounds = loop.primitives.map((primitive) =>
    primitiveBounds(primitive, policy)
  );
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

function boundsCouldContain(
  outer: SketchBounds2d,
  inner: SketchBounds2d,
  policy: SketchGeometryPolicy
): boolean {
  return (
    outer.min[0] <= inner.min[0] - policy.linearTolerance &&
    outer.min[1] <= inner.min[1] - policy.linearTolerance &&
    outer.max[0] >= inner.max[0] + policy.linearTolerance &&
    outer.max[1] >= inner.max[1] + policy.linearTolerance
  );
}

function boundsOverlapWithTolerance(
  left: SketchBounds2d,
  right: SketchBounds2d,
  policy: SketchGeometryPolicy
): boolean {
  return !(
    left.max[0] < right.min[0] - policy.linearTolerance ||
    right.max[0] < left.min[0] - policy.linearTolerance ||
    left.max[1] < right.min[1] - policy.linearTolerance ||
    right.max[1] < left.min[1] - policy.linearTolerance
  );
}

function createHoleLoop(loop: ResolvedLoop): SketchLoopRef {
  if (loop.normalized.kind === "entity") return loop.normalized;
  return canonicalizeWire(loop.normalized.segments, loop.absoluteArea, "hole")
    .loop;
}

function containmentDepth(
  index: number,
  parents: readonly (number | undefined)[],
  memo: Map<number, number>
): number {
  const existing = memo.get(index);
  if (existing !== undefined) return existing;
  const parent = parents[index];
  const depth =
    parent === undefined ? 0 : containmentDepth(parent, parents, memo) + 1;
  memo.set(index, depth);
  return depth;
}

/**
 * Resolve individually complete loops and build their strict containment tree
 * with one shared E2 analytic budget. The sweep bounds are only a deterministic
 * pair generator; boundary and containment authority remains analytic.
 */
export function analyzeV22RegionDiscoveryLoops(
  sketch: V22RegionSourceSketch,
  sourceLoops: readonly SketchLoopRef[],
  initialPredicateVisitCount = 0,
  policy: SketchGeometryPolicy = SKETCH_GEOMETRY_POLICY
): V22RegionDiscoveryAnalysisResult {
  const complexity: MutableComplexity = {
    sketchEntityCount: sketch.entities.size,
    regionCount: sourceLoops.length,
    loopCount: sourceLoops.length,
    segmentReferenceCount: sourceLoops.reduce(
      (count, loop) =>
        count + (loop.kind === "wire" ? loop.segments.length : 0),
      0
    ),
    predicateVisitCount: initialPredicateVisitCount
  };
  const issues: V22RegionSourceIssue[] = [];
  const limitChecks = [
    {
      received: sketch.entities.size,
      maximum: CAD_V19_RESOURCE_LIMITS.maxSketchEntitiesPerEditedSketch,
      label: "sketch entities"
    },
    {
      received: sourceLoops.length,
      maximum: CAD_V19_RESOURCE_LIMITS.maxDiscoveredCandidateRegions,
      label: "candidate regions"
    },
    {
      received: complexity.segmentReferenceCount,
      maximum: CAD_V19_RESOURCE_LIMITS.maxSegmentReferencesPerProfile,
      label: "segment references"
    },
    {
      received: initialPredicateVisitCount,
      maximum: CAD_V19_RESOURCE_LIMITS.maxCandidatePairEdgeVisits,
      label: "candidate pair/edge visits"
    }
  ];
  for (const check of limitChecks) {
    if (check.received <= check.maximum) continue;
    issues.push(
      issue(
        "SKETCH_REGION_COMPLEXITY_LIMIT",
        `Region discovery exceeds the V19 ${check.label} limit.`,
        {
          expected: `<= ${check.maximum}`,
          received: String(check.received)
        }
      )
    );
  }
  if (issues.length > 0) {
    return {
      ok: false,
      loops: [],
      boundaryConflicts: [],
      complexity: complexitySnapshot(complexity),
      issues
    };
  }

  const budget = new PredicateBudget(
    complexity,
    CAD_V19_RESOURCE_LIMITS.maxCandidatePairEdgeVisits
  );
  const globallySeen = new Set<string>();
  const resolved: ResolvedLoop[] = [];
  try {
    for (const [loopIndex, loop] of sourceLoops.entries()) {
      const result = resolveLoop(
        loop,
        "outer",
        sketch.entities,
        globallySeen,
        issues,
        { regionIndex: loopIndex },
        policy,
        budget
      );
      if (result.loop) resolved.push(result.loop);
    }
    if (issues.length > 0 || resolved.length !== sourceLoops.length) {
      return {
        ok: false,
        loops: [],
        boundaryConflicts: [],
        complexity: complexitySnapshot(complexity),
        issues
      };
    }

    const bounds = resolved.map((loop) => loopBounds(loop, policy));
    const containers = resolved.map(() => [] as number[]);
    const boundaryConflicts: V22RegionDiscoveryBoundaryConflict[] = [];
    const sweepOrder = resolved
      .map((loop, index) => ({ index, loop, bounds: bounds[index]! }))
      .sort(
        (left, right) =>
          left.bounds.min[0] - right.bounds.min[0] ||
          left.bounds.min[1] - right.bounds.min[1] ||
          compareSketchCanonicalKeys(left.loop.key, right.loop.key)
      );
    let active: typeof sweepOrder = [];
    for (const current of sweepOrder) {
      active = active.filter(
        (candidate) =>
          candidate.bounds.max[0] >=
          current.bounds.min[0] - policy.linearTolerance
      );
      for (const candidate of active) {
        budget.visit();
        if (
          !boundsOverlapWithTolerance(current.bounds, candidate.bounds, policy)
        ) {
          continue;
        }
        const separation = loopBoundaryDistance(
          current.loop,
          candidate.loop,
          budget,
          policy
        );
        if (separation <= policy.linearTolerance) {
          boundaryConflicts.push({
            leftLoopIndex: candidate.index,
            rightLoopIndex: current.index,
            separation
          });
          continue;
        }
        if (
          boundsCouldContain(candidate.bounds, current.bounds, policy) &&
          pointInsideLoop(current.loop.boundarySample, candidate.loop, budget)
        ) {
          containers[current.index]!.push(candidate.index);
        } else if (
          boundsCouldContain(current.bounds, candidate.bounds, policy) &&
          pointInsideLoop(candidate.loop.boundarySample, current.loop, budget)
        ) {
          containers[candidate.index]!.push(current.index);
        }
      }
      active.push(current);
    }

    const parents = containers.map((candidateContainers) =>
      candidateContainers.length === 0
        ? undefined
        : [...candidateContainers].sort(
            (left, right) =>
              resolved[left]!.absoluteArea - resolved[right]!.absoluteArea ||
              compareSketchCanonicalKeys(
                resolved[left]!.key,
                resolved[right]!.key
              )
          )[0]
    );
    const children = resolved.map(() => [] as number[]);
    parents.forEach((parent, child) => {
      if (parent !== undefined) children[parent]!.push(child);
    });
    for (const childIndexes of children) {
      childIndexes.sort((left, right) =>
        compareSketchCanonicalKeys(resolved[left]!.key, resolved[right]!.key)
      );
    }
    const depthMemo = new Map<number, number>();
    return {
      ok: true,
      loops: resolved.map((loop, index) => {
        const hole = createHoleLoop(loop);
        return {
          outer: loop.normalized,
          hole,
          outerLoopKey: loop.key,
          holeLoopKey: getSketchLoopCanonicalKey(hole),
          entityIds: loop.entityIds,
          signedArea: loop.absoluteArea,
          absoluteArea: loop.absoluteArea,
          bounds: bounds[index]!,
          containmentDepth: containmentDepth(index, parents, depthMemo),
          ...(parents[index] === undefined
            ? {}
            : { parentIndex: parents[index] }),
          directChildIndexes: children[index]!
        };
      }),
      boundaryConflicts,
      complexity: complexitySnapshot(complexity),
      issues: []
    };
  } catch (error) {
    if (!(error instanceof PredicateBudgetExceeded)) throw error;
    return {
      ok: false,
      loops: [],
      boundaryConflicts: [],
      complexity: complexitySnapshot(complexity),
      issues: [
        issue(
          "SKETCH_REGION_COMPLEXITY_LIMIT",
          "Region discovery exceeded the analytic pair/edge-visit limit.",
          {
            expected: `<= ${CAD_V19_RESOURCE_LIMITS.maxCandidatePairEdgeVisits}`,
            received: String(complexity.predicateVisitCount)
          }
        )
      ]
    };
  }
}

function toPublicComplexity(
  complexity: V22RegionSourceComplexity
): SketchProfileRegionValidateQueryResponse["complexity"] {
  return {
    regionCount: complexity.regionCount,
    loopCount: complexity.loopCount,
    segmentReferenceCount: complexity.segmentReferenceCount,
    predicateVisitCount: complexity.predicateVisitCount
  };
}

function toPublicDiagnostic(
  profile: SketchRegionsProfileRef,
  issue: V22RegionSourceIssue
): SketchRegionDiagnostic {
  return {
    code: issue.code,
    severity: "blocker",
    message: issue.message,
    sketchId: profile.sketchId,
    ...(issue.entityId === undefined ? {} : { entityId: issue.entityId }),
    ...(issue.loopKey === undefined ? {} : { loopKey: issue.loopKey }),
    ...(issue.expected === undefined ? {} : { expected: issue.expected }),
    ...(issue.received === undefined ? {} : { received: issue.received }),
    recoveryAction:
      issue.code === "SKETCH_REGION_COMPLEXITY_LIMIT"
        ? "Reduce the submitted region source before retrying validation."
        : "Repair the referenced sketch geometry or submit a different exact region profile."
  };
}

/**
 * Materialize the public, side-effect-free E1 validation query response.
 * Query dispatch is wired separately so discovery and feature mutation do not
 * become accidental prerequisites of explicit source validation.
 */
export function createSketchProfileRegionValidateResponse(
  profile: SketchRegionsProfileRef,
  sketch: V22RegionSourceSketch,
  cadOpsVersion: CadOpsVersion
): SketchProfileRegionValidateQueryResponse {
  const result = validateV22RegionSource(profile, sketch);
  if (!result.ok) {
    return {
      ok: true,
      query: "sketch.profileRegionValidate",
      cadOpsVersion,
      status: "blocked",
      requestedProfile: profile,
      loopSummaries: [],
      materialAreas: [],
      complexity: toPublicComplexity(result.complexity),
      diagnostics: result.issues.map((issue) =>
        toPublicDiagnostic(profile, issue)
      )
    };
  }
  return {
    ok: true,
    query: "sketch.profileRegionValidate",
    cadOpsVersion,
    status: "ready",
    requestedProfile: profile,
    normalizedProfile: result.normalizedProfile,
    loopSummaries: result.loopSummaries,
    materialAreas: result.materialAreas,
    complexity: toPublicComplexity(result.complexity),
    diagnostics: []
  };
}
