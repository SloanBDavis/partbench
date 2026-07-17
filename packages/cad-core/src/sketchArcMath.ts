import type {
  SketchArcDefinition,
  SketchArcEntity,
  SketchEntityId,
  Vec2
} from "@web-cad/cad-protocol";

import {
  SKETCH_GEOMETRY_POLICY,
  type SketchGeometryPolicy
} from "./sketchGeometryPolicy";

export type SketchArcValidationIssueCode =
  | "SKETCH_ARC_DEFINITION_INVALID"
  | "SKETCH_ARC_THREE_POINT_COLLINEAR"
  | "SKETCH_ARC_POINTS_COINCIDENT"
  | "SKETCH_ARC_RADIUS_INVALID"
  | "SKETCH_ARC_SWEEP_INVALID"
  | "SKETCH_ARC_FULL_CIRCLE_USE_CIRCLE"
  | "SKETCH_ENTITY_CONSTRUCTION_INVALID"
  | "SCHEMA_V21_SOURCE_INVALID";

export interface SketchArcValidationIssue {
  readonly code: SketchArcValidationIssueCode;
  readonly path: string;
  readonly message: string;
  readonly expected?: string;
  readonly received?: string;
}

export type SketchArcValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false;
      readonly issues: readonly SketchArcValidationIssue[];
    };

export interface CanonicalSketchArcGeometry {
  readonly center: Vec2;
  readonly radius: number;
  readonly startAngleDegrees: number;
  readonly sweepAngleDegrees: number;
}

function invalid<T>(
  code: SketchArcValidationIssueCode,
  path: string,
  message: string,
  expected?: string,
  received?: string
): SketchArcValidationResult<T> {
  return { ok: false, issues: [{ code, path, message, expected, received }] };
}

function canonicalZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

function isFiniteVec2(value: unknown): value is Vec2 {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === "number" &&
    Number.isFinite(value[0]) &&
    typeof value[1] === "number" &&
    Number.isFinite(value[1])
  );
}

export function normalizeSketchArcStartAngleDegrees(
  angleDegrees: number
): number {
  if (!Number.isFinite(angleDegrees)) return Number.NaN;
  return canonicalZero(((angleDegrees % 360) + 360) % 360);
}

export function getSketchArcPoint(
  arc: Pick<
    SketchArcEntity,
    "center" | "radius" | "startAngleDegrees" | "sweepAngleDegrees"
  >,
  role: "center" | "start" | "end"
): Vec2 {
  if (role === "center") {
    return [arc.center[0], arc.center[1]];
  }

  const angleDegrees =
    role === "start"
      ? arc.startAngleDegrees
      : arc.startAngleDegrees + arc.sweepAngleDegrees;
  const angleRadians = (angleDegrees * Math.PI) / 180;
  return [
    canonicalZero(arc.center[0] + arc.radius * Math.cos(angleRadians)),
    canonicalZero(arc.center[1] + arc.radius * Math.sin(angleRadians))
  ];
}

function validateRadius(
  radius: number,
  policy: SketchGeometryPolicy,
  path: string
): SketchArcValidationResult<number> {
  if (!Number.isFinite(radius) || radius <= policy.linearTolerance) {
    return invalid(
      "SKETCH_ARC_RADIUS_INVALID",
      path,
      "Arc radius must be finite and greater than the sketch linear tolerance.",
      `>${policy.linearTolerance}`,
      String(radius)
    );
  }
  return { ok: true, value: canonicalZero(radius) };
}

function validateSweep(
  sweepAngleDegrees: number,
  policy: SketchGeometryPolicy,
  path: string
): SketchArcValidationResult<number> {
  if (!Number.isFinite(sweepAngleDegrees)) {
    return invalid(
      "SKETCH_ARC_SWEEP_INVALID",
      path,
      "Arc sweep must be finite.",
      "finite signed degrees",
      String(sweepAngleDegrees)
    );
  }
  if (Math.abs(sweepAngleDegrees) === 360) {
    return invalid(
      "SKETCH_ARC_FULL_CIRCLE_USE_CIRCLE",
      path,
      "A full circle must use a circle entity.",
      `abs(sweep) <= ${360 - policy.angularToleranceDegrees}`,
      String(sweepAngleDegrees)
    );
  }
  const magnitude = Math.abs(sweepAngleDegrees);
  if (
    magnitude < policy.angularToleranceDegrees ||
    magnitude > 360 - policy.angularToleranceDegrees
  ) {
    return invalid(
      "SKETCH_ARC_SWEEP_INVALID",
      path,
      "Arc sweep is outside the supported angular bounds.",
      `${policy.angularToleranceDegrees} <= abs(sweep) <= ${360 - policy.angularToleranceDegrees}`,
      String(sweepAngleDegrees)
    );
  }
  return { ok: true, value: canonicalZero(sweepAngleDegrees) };
}

export function canonicalizeSketchArcDefinition(
  definition: SketchArcDefinition,
  policy: SketchGeometryPolicy = SKETCH_GEOMETRY_POLICY
): SketchArcValidationResult<CanonicalSketchArcGeometry> {
  if (!definition || typeof definition !== "object") {
    return invalid(
      "SKETCH_ARC_DEFINITION_INVALID",
      "definition",
      "Arc definition must be an object."
    );
  }
  if (definition.kind === "centerAngles") {
    if (!isFiniteVec2(definition.center)) {
      return invalid(
        "SKETCH_ARC_DEFINITION_INVALID",
        "definition.center",
        "Arc center must contain two finite coordinates."
      );
    }
    if (!Number.isFinite(definition.startAngleDegrees)) {
      return invalid(
        "SKETCH_ARC_DEFINITION_INVALID",
        "definition.startAngleDegrees",
        "Arc start angle must be finite."
      );
    }
    const radius = validateRadius(
      definition.radius,
      policy,
      "definition.radius"
    );
    if (!radius.ok) return radius;
    const sweep = validateSweep(
      definition.sweepAngleDegrees,
      policy,
      "definition.sweepAngleDegrees"
    );
    if (!sweep.ok) return sweep;
    return {
      ok: true,
      value: {
        center: [
          canonicalZero(definition.center[0]),
          canonicalZero(definition.center[1])
        ],
        radius: radius.value,
        startAngleDegrees: normalizeSketchArcStartAngleDegrees(
          definition.startAngleDegrees
        ),
        sweepAngleDegrees: sweep.value
      }
    };
  }
  if (definition.kind !== "threePoint") {
    return invalid(
      "SKETCH_ARC_DEFINITION_INVALID",
      "definition.kind",
      "Arc definition kind must be centerAngles or threePoint."
    );
  }

  const points = [definition.start, definition.pointOnArc, definition.end];
  const paths = ["definition.start", "definition.pointOnArc", "definition.end"];
  for (let index = 0; index < points.length; index += 1) {
    if (!isFiniteVec2(points[index])) {
      return invalid(
        "SKETCH_ARC_DEFINITION_INVALID",
        paths[index] ?? "definition",
        "Three-point arc inputs must contain finite coordinates."
      );
    }
  }
  const [start, middle, end] = points as [Vec2, Vec2, Vec2];
  const distanceSquared = (left: Vec2, right: Vec2): number =>
    (left[0] - right[0]) ** 2 + (left[1] - right[1]) ** 2;
  const coincidenceLimitSquared = policy.linearTolerance ** 2;
  if (
    distanceSquared(start, middle) <= coincidenceLimitSquared ||
    distanceSquared(start, end) <= coincidenceLimitSquared ||
    distanceSquared(middle, end) <= coincidenceLimitSquared
  ) {
    return invalid(
      "SKETCH_ARC_POINTS_COINCIDENT",
      "definition",
      "Three-point arc inputs must be distinct beyond the linear tolerance."
    );
  }

  const [ax, ay] = start;
  const [bx, by] = middle;
  const [cx, cy] = end;
  const ux = bx - ax;
  const uy = by - ay;
  const vx = cx - ax;
  const vy = cy - ay;
  const cross = ux * vy - uy * vx;
  const scale = Math.max(
    Math.sqrt(distanceSquared(start, middle)),
    Math.sqrt(distanceSquared(start, end)),
    Math.sqrt(distanceSquared(middle, end))
  );
  if (
    !Number.isFinite(cross) ||
    Math.abs(cross) <= policy.linearTolerance * scale
  ) {
    return invalid(
      "SKETCH_ARC_THREE_POINT_COLLINEAR",
      "definition",
      "Three-point arc inputs must define a unique finite circle."
    );
  }
  const uSquared = ux * ux + uy * uy;
  const vSquared = vx * vx + vy * vy;
  const denominator = 2 * cross;
  const centerX = ax + (uSquared * vy - vSquared * uy) / denominator;
  const centerY = ay + (ux * vSquared - vx * uSquared) / denominator;
  if (!Number.isFinite(centerX) || !Number.isFinite(centerY)) {
    return invalid(
      "SKETCH_ARC_DEFINITION_INVALID",
      "definition",
      "Three-point arc conversion did not produce a finite center."
    );
  }
  const radius = validateRadius(
    Math.hypot(ax - centerX, ay - centerY),
    policy,
    "definition"
  );
  if (!radius.ok) return radius;
  const toAngle = (x: number, y: number): number =>
    normalizeSketchArcStartAngleDegrees(
      (Math.atan2(y - centerY, x - centerX) * 180) / Math.PI
    );
  const startAngle = toAngle(ax, ay);
  const middleAngle = toAngle(bx, by);
  const endAngle = toAngle(cx, cy);
  const ccwMiddle = normalizeSketchArcStartAngleDegrees(
    middleAngle - startAngle
  );
  const ccwEnd = normalizeSketchArcStartAngleDegrees(endAngle - startAngle);
  const sweep = validateSweep(
    ccwMiddle < ccwEnd ? ccwEnd : ccwEnd - 360,
    policy,
    "definition"
  );
  if (!sweep.ok) return sweep;
  return {
    ok: true,
    value: {
      center: [canonicalZero(centerX), canonicalZero(centerY)],
      radius: radius.value,
      startAngleDegrees: startAngle,
      sweepAngleDegrees: sweep.value
    }
  };
}

export function createCanonicalSketchArcEntity(
  id: SketchEntityId,
  definition: SketchArcDefinition,
  construction = false,
  policy: SketchGeometryPolicy = SKETCH_GEOMETRY_POLICY
): SketchArcValidationResult<SketchArcEntity> {
  if (typeof id !== "string" || id.length === 0) {
    return invalid(
      "SCHEMA_V21_SOURCE_INVALID",
      "id",
      "Arc entity ID must be a non-empty string."
    );
  }
  if (typeof construction !== "boolean") {
    return invalid(
      "SKETCH_ENTITY_CONSTRUCTION_INVALID",
      "construction",
      "Construction state must be boolean."
    );
  }
  const geometry = canonicalizeSketchArcDefinition(definition, policy);
  return geometry.ok
    ? { ok: true, value: { id, kind: "arc", ...geometry.value, construction } }
    : geometry;
}
