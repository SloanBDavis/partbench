import type {
  SketchAddRoundedRectangleOp,
  SketchAddSlotOp,
  SketchArcEntity,
  SketchConstraintCreateOp,
  SketchConstraintId,
  SketchEntityId,
  SketchEntitySnapshot,
  SketchLineEntitySnapshot,
  SketchPointTargetV22,
  Vec2
} from "@web-cad/cad-protocol";

import {
  SKETCH_GEOMETRY_POLICY,
  type SketchGeometryPolicy
} from "./sketchGeometryPolicy";
import { getSketchArcPoint } from "./sketchArcMath";

const FULL_TURN_DEGREES = 360;
const DEGREES_PER_RADIAN = 180 / Math.PI;

export const SLOT_ENTITY_ROLES = [
  "sidePositive",
  "endCap",
  "sideNegative",
  "startCap"
] as const;

export type SketchSlotEntityRole = (typeof SLOT_ENTITY_ROLES)[number];

export const SLOT_CONSTRAINT_ROLES = [
  "join.sidePositive.end-endCap.start",
  "join.endCap.end-sideNegative.start",
  "join.sideNegative.end-startCap.start",
  "join.startCap.end-sidePositive.start",
  "tangent.sidePositive-endCap",
  "tangent.endCap-sideNegative",
  "tangent.sideNegative-startCap",
  "tangent.startCap-sidePositive",
  "equalRadius.endCap-startCap"
] as const;

export type SketchSlotConstraintRole = (typeof SLOT_CONSTRAINT_ROLES)[number];

export const ROUNDED_RECTANGLE_ENTITY_ROLES = [
  "top",
  "topRightArc",
  "right",
  "bottomRightArc",
  "bottom",
  "bottomLeftArc",
  "left",
  "topLeftArc"
] as const;

export type SketchRoundedRectangleEntityRole =
  (typeof ROUNDED_RECTANGLE_ENTITY_ROLES)[number];

export const ROUNDED_RECTANGLE_CONSTRAINT_ROLES = [
  "join.top.end-topRightArc.start",
  "join.topRightArc.end-right.start",
  "join.right.end-bottomRightArc.start",
  "join.bottomRightArc.end-bottom.start",
  "join.bottom.end-bottomLeftArc.start",
  "join.bottomLeftArc.end-left.start",
  "join.left.end-topLeftArc.start",
  "join.topLeftArc.end-top.start",
  "tangent.top-topRightArc",
  "tangent.topRightArc-right",
  "tangent.right-bottomRightArc",
  "tangent.bottomRightArc-bottom",
  "tangent.bottom-bottomLeftArc",
  "tangent.bottomLeftArc-left",
  "tangent.left-topLeftArc",
  "tangent.topLeftArc-top",
  "equalRadius.topRightArc-bottomRightArc",
  "equalRadius.topRightArc-bottomLeftArc",
  "equalRadius.topRightArc-topLeftArc",
  "horizontal.top",
  "horizontal.bottom",
  "vertical.left",
  "vertical.right"
] as const;

export type SketchRoundedRectangleConstraintRole =
  (typeof ROUNDED_RECTANGLE_CONSTRAINT_ROLES)[number];

type PlannedSketchConvenienceShape =
  | Omit<SketchLineEntitySnapshot, "id">
  | Omit<SketchArcEntity, "id">;

export interface PlannedSketchConvenienceEntity<Role extends string = string> {
  readonly role: Role;
  readonly shape: PlannedSketchConvenienceShape;
}

type MaterializedSketchConstraintCreateOp =
  SketchConstraintCreateOp extends infer Op
    ? Op extends SketchConstraintCreateOp
      ? Omit<Op, "id"> & { readonly id: SketchConstraintId }
      : never
    : never;

export interface MaterializedSketchConveniencePlan {
  readonly entities: readonly SketchEntitySnapshot[];
  /**
   * Ordinary constraint-create operations in Decision 8 order. The command
   * engine can pass these through its existing constraint validation/storage
   * path after staging the planned entities in the same transaction.
   */
  readonly constraintOps: readonly MaterializedSketchConstraintCreateOp[];
}

interface SketchConveniencePlanBase<
  Operation extends "slot" | "roundedRectangle",
  EntityRole extends string,
  ConstraintRole extends string
> {
  readonly operation: Operation;
  readonly entityRoles: readonly EntityRole[];
  readonly constraintRoles: readonly ConstraintRole[];
  readonly entityDrafts: readonly PlannedSketchConvenienceEntity<EntityRole>[];
  readonly requiredEntityIdCount: number;
  readonly requiredConstraintIdCount: number;
  /**
   * Present only when both complete caller/allocator-provided ID tuples were
   * supplied. No IDs are synthesized or retained as hidden composite identity.
   */
  readonly materialized?: MaterializedSketchConveniencePlan;
}

export type SketchSlotPlan = SketchConveniencePlanBase<
  "slot",
  SketchSlotEntityRole,
  SketchSlotConstraintRole
>;

export type SketchRoundedRectanglePlan = SketchConveniencePlanBase<
  "roundedRectangle",
  SketchRoundedRectangleEntityRole,
  SketchRoundedRectangleConstraintRole
>;

export type SketchConveniencePlan = SketchSlotPlan | SketchRoundedRectanglePlan;

export type SketchConveniencePlanDiagnosticCode =
  | "SKETCH_CONVENIENCE_GEOMETRY_INVALID"
  | "SKETCH_CONVENIENCE_ENTITY_ID_COUNT_MISMATCH"
  | "SKETCH_CONVENIENCE_CONSTRAINT_ID_COUNT_MISMATCH"
  | "SKETCH_CONVENIENCE_ENTITY_ID_CONFLICT"
  | "SKETCH_CONVENIENCE_CONSTRAINT_ID_CONFLICT";

export interface SketchConveniencePlanDiagnostic {
  readonly code: SketchConveniencePlanDiagnosticCode;
  readonly path: string;
  readonly message: string;
  readonly expected?: string;
  readonly received?: string;
}

export type SketchConveniencePlanResult<Plan extends SketchConveniencePlan> =
  | {
      readonly status: "ready";
      readonly plan: Plan;
      readonly diagnostics: readonly [];
    }
  | {
      readonly status: "blocked";
      readonly diagnostics: readonly SketchConveniencePlanDiagnostic[];
    };

export interface SketchConveniencePlanOptions {
  readonly policy?: SketchGeometryPolicy;
  /**
   * Optional current-document occupancy lets the pure planner reject caller
   * IDs before mutation. The command engine remains authoritative for races.
   */
  readonly occupiedEntityIds?: ReadonlySet<SketchEntityId>;
  readonly occupiedConstraintIds?: ReadonlySet<SketchConstraintId>;
}

function canonicalZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

function point(x: number, y: number): Vec2 {
  return [canonicalZero(x), canonicalZero(y)];
}

function normalizeDegrees(value: number): number {
  return canonicalZero(
    ((value % FULL_TURN_DEGREES) + FULL_TURN_DEGREES) % FULL_TURN_DEGREES
  );
}

function isFinitePoint(value: Vec2): boolean {
  return Number.isFinite(value[0]) && Number.isFinite(value[1]);
}

function pointDistance(left: Vec2, right: Vec2): number {
  return Math.hypot(left[0] - right[0], left[1] - right[1]);
}

function blocked<Plan extends SketchConveniencePlan>(
  diagnostic: SketchConveniencePlanDiagnostic
): SketchConveniencePlanResult<Plan> {
  return { status: "blocked", diagnostics: [diagnostic] };
}

function geometryDiagnostic(
  path: string,
  message: string,
  expected?: string,
  received?: string
): SketchConveniencePlanDiagnostic {
  return {
    code: "SKETCH_CONVENIENCE_GEOMETRY_INVALID",
    path,
    message,
    ...(expected === undefined ? {} : { expected }),
    ...(received === undefined ? {} : { received })
  };
}

function describeNumber(value: number): string {
  return Number.isFinite(value) ? String(value) : "non-finite";
}

function validateIdTuple(
  ids: readonly string[] | undefined,
  expectedCount: number,
  path: "entityIds" | "constraintIds",
  occupied: ReadonlySet<string> | undefined
): SketchConveniencePlanDiagnostic | undefined {
  if (ids === undefined) return undefined;
  const countCode =
    path === "entityIds"
      ? "SKETCH_CONVENIENCE_ENTITY_ID_COUNT_MISMATCH"
      : "SKETCH_CONVENIENCE_CONSTRAINT_ID_COUNT_MISMATCH";
  const conflictCode =
    path === "entityIds"
      ? "SKETCH_CONVENIENCE_ENTITY_ID_CONFLICT"
      : "SKETCH_CONVENIENCE_CONSTRAINT_ID_CONFLICT";
  if (!Array.isArray(ids) || ids.length !== expectedCount) {
    return {
      code: countCode,
      path,
      message: `The provided ${path} count must match the Decision 8 tuple.`,
      expected: String(expectedCount),
      received: Array.isArray(ids) ? String(ids.length) : "non-array"
    };
  }
  const seen = new Set<string>();
  for (const [index, id] of ids.entries()) {
    if (
      typeof id !== "string" ||
      id.length === 0 ||
      seen.has(id) ||
      occupied?.has(id)
    ) {
      return {
        code: conflictCode,
        path: `${path}[${index}]`,
        message: `Provided ${path} must be non-empty, unique, and absent from current source.`,
        expected: "available unique non-empty ID",
        received: typeof id === "string" ? id : typeof id
      };
    }
    seen.add(id);
  }
  return undefined;
}

function validateConstruction(
  value: boolean | undefined
): SketchConveniencePlanDiagnostic | undefined {
  return value === undefined || typeof value === "boolean"
    ? undefined
    : geometryDiagnostic(
        "construction",
        "Construction must be a boolean when supplied.",
        "boolean",
        typeof value
      );
}

function validateArcDomain(
  radius: number,
  sweepMagnitudeDegrees: number,
  policy: SketchGeometryPolicy,
  path: string
): SketchConveniencePlanDiagnostic | undefined {
  if (!Number.isFinite(radius) || radius <= policy.linearTolerance) {
    return geometryDiagnostic(
      path,
      "Every convenience-command arc radius must be finite and above the shared linear tolerance.",
      `>${policy.linearTolerance}`,
      describeNumber(radius)
    );
  }
  if (
    !Number.isFinite(sweepMagnitudeDegrees) ||
    sweepMagnitudeDegrees < policy.angularToleranceDegrees ||
    sweepMagnitudeDegrees > FULL_TURN_DEGREES - policy.angularToleranceDegrees
  ) {
    return geometryDiagnostic(
      path,
      "Every convenience-command arc sweep must satisfy the complete canonical arc domain.",
      `${policy.angularToleranceDegrees} <= abs(sweep) <= ${
        FULL_TURN_DEGREES - policy.angularToleranceDegrees
      }`,
      describeNumber(sweepMagnitudeDegrees)
    );
  }
  return undefined;
}

function linePointTarget(
  entityId: SketchEntityId,
  role: "start" | "end"
): SketchPointTargetV22 {
  return { entityId, entityKind: "line", role };
}

function arcPointTarget(
  entityId: SketchEntityId,
  role: "start" | "end"
): SketchPointTargetV22 {
  return { entityId, entityKind: "arc", role };
}

function materializeEntityDrafts(
  drafts: readonly PlannedSketchConvenienceEntity[],
  entityIds: readonly SketchEntityId[]
): readonly SketchEntitySnapshot[] {
  return drafts.map((draft, index) => ({
    id: entityIds[index]!,
    ...draft.shape
  }));
}

function getPlannedEntityEndpoint(
  draft: PlannedSketchConvenienceEntity,
  role: "start" | "end"
): Vec2 {
  return draft.shape.kind === "line"
    ? draft.shape[role]
    : getSketchArcPoint(draft.shape, role);
}

function validateConsecutiveJoins(
  drafts: readonly PlannedSketchConvenienceEntity[],
  policy: SketchGeometryPolicy,
  path: "radius" | "cornerRadius"
): SketchConveniencePlanDiagnostic | undefined {
  for (const [index, draft] of drafts.entries()) {
    const next = drafts[(index + 1) % drafts.length]!;
    const end = getPlannedEntityEndpoint(draft, "end");
    const start = getPlannedEntityEndpoint(next, "start");
    const separation = pointDistance(end, start);
    if (
      !isFinitePoint(end) ||
      !isFinitePoint(start) ||
      !Number.isFinite(separation) ||
      separation > policy.linearTolerance
    ) {
      return geometryDiagnostic(
        path,
        `Convenience-command join ${index + 1} is not representable as a finite canonical line/arc join within the shared linear tolerance.`,
        `<=${policy.linearTolerance}`,
        describeNumber(separation)
      );
    }
  }
  return undefined;
}

function coincident(
  id: SketchConstraintId,
  name: string,
  sketchId: string,
  primaryTarget: SketchPointTargetV22,
  secondaryTarget: SketchPointTargetV22
): MaterializedSketchConstraintCreateOp {
  return {
    op: "sketch.constraint.create",
    id,
    name,
    sketchId,
    kind: "coincident",
    primaryTarget,
    secondaryTarget
  };
}

function tangent(
  id: SketchConstraintId,
  name: string,
  sketchId: string,
  primaryTarget: {
    readonly entityId: SketchEntityId;
    readonly entityKind: "line" | "arc";
  },
  secondaryTarget: {
    readonly entityId: SketchEntityId;
    readonly entityKind: "line" | "arc";
  }
): MaterializedSketchConstraintCreateOp {
  return {
    op: "sketch.constraint.create",
    id,
    name,
    sketchId,
    kind: "tangent",
    primaryTarget,
    secondaryTarget
  } as MaterializedSketchConstraintCreateOp;
}

function equalRadius(
  id: SketchConstraintId,
  name: string,
  sketchId: string,
  primaryEntityId: SketchEntityId,
  secondaryEntityId: SketchEntityId
): MaterializedSketchConstraintCreateOp {
  return {
    op: "sketch.constraint.create",
    id,
    name,
    sketchId,
    kind: "equalRadius",
    primaryTarget: { entityId: primaryEntityId, entityKind: "arc" },
    secondaryTarget: { entityId: secondaryEntityId, entityKind: "arc" }
  };
}

function orientation(
  id: SketchConstraintId,
  name: string,
  sketchId: string,
  entityId: SketchEntityId,
  kind: "horizontal" | "vertical"
): MaterializedSketchConstraintCreateOp {
  return {
    op: "sketch.constraint.create",
    id,
    name,
    sketchId,
    entityId,
    kind
  };
}

function materializeSlotConstraints(
  op: SketchAddSlotOp,
  entityIds: readonly SketchEntityId[],
  constraintIds: readonly SketchConstraintId[]
): readonly MaterializedSketchConstraintCreateOp[] {
  const [sidePositive, endCap, sideNegative, startCap] = entityIds as [
    SketchEntityId,
    SketchEntityId,
    SketchEntityId,
    SketchEntityId
  ];
  const ids = constraintIds as [
    SketchConstraintId,
    SketchConstraintId,
    SketchConstraintId,
    SketchConstraintId,
    SketchConstraintId,
    SketchConstraintId,
    SketchConstraintId,
    SketchConstraintId,
    SketchConstraintId
  ];
  return [
    coincident(
      ids[0],
      "Slot join 1",
      op.sketchId,
      linePointTarget(sidePositive, "end"),
      arcPointTarget(endCap, "start")
    ),
    coincident(
      ids[1],
      "Slot join 2",
      op.sketchId,
      arcPointTarget(endCap, "end"),
      linePointTarget(sideNegative, "start")
    ),
    coincident(
      ids[2],
      "Slot join 3",
      op.sketchId,
      linePointTarget(sideNegative, "end"),
      arcPointTarget(startCap, "start")
    ),
    coincident(
      ids[3],
      "Slot join 4",
      op.sketchId,
      arcPointTarget(startCap, "end"),
      linePointTarget(sidePositive, "start")
    ),
    tangent(
      ids[4],
      "Slot tangent 1",
      op.sketchId,
      { entityId: sidePositive, entityKind: "line" },
      { entityId: endCap, entityKind: "arc" }
    ),
    tangent(
      ids[5],
      "Slot tangent 2",
      op.sketchId,
      { entityId: endCap, entityKind: "arc" },
      { entityId: sideNegative, entityKind: "line" }
    ),
    tangent(
      ids[6],
      "Slot tangent 3",
      op.sketchId,
      { entityId: sideNegative, entityKind: "line" },
      { entityId: startCap, entityKind: "arc" }
    ),
    tangent(
      ids[7],
      "Slot tangent 4",
      op.sketchId,
      { entityId: startCap, entityKind: "arc" },
      { entityId: sidePositive, entityKind: "line" }
    ),
    equalRadius(ids[8], "Slot cap radii", op.sketchId, endCap, startCap)
  ];
}

function materializeRoundedRectangleConstraints(
  op: SketchAddRoundedRectangleOp,
  entityIds: readonly SketchEntityId[],
  constraintIds: readonly SketchConstraintId[]
): readonly MaterializedSketchConstraintCreateOp[] {
  const [
    top,
    topRightArc,
    right,
    bottomRightArc,
    bottom,
    bottomLeftArc,
    left,
    topLeftArc
  ] = entityIds as [
    SketchEntityId,
    SketchEntityId,
    SketchEntityId,
    SketchEntityId,
    SketchEntityId,
    SketchEntityId,
    SketchEntityId,
    SketchEntityId
  ];
  const ids = constraintIds as [
    SketchConstraintId,
    SketchConstraintId,
    SketchConstraintId,
    SketchConstraintId,
    SketchConstraintId,
    SketchConstraintId,
    SketchConstraintId,
    SketchConstraintId,
    SketchConstraintId,
    SketchConstraintId,
    SketchConstraintId,
    SketchConstraintId,
    SketchConstraintId,
    SketchConstraintId,
    SketchConstraintId,
    SketchConstraintId,
    SketchConstraintId,
    SketchConstraintId,
    SketchConstraintId,
    SketchConstraintId,
    SketchConstraintId,
    SketchConstraintId,
    SketchConstraintId
  ];
  const joins = [
    [linePointTarget(top, "end"), arcPointTarget(topRightArc, "start")],
    [arcPointTarget(topRightArc, "end"), linePointTarget(right, "start")],
    [linePointTarget(right, "end"), arcPointTarget(bottomRightArc, "start")],
    [arcPointTarget(bottomRightArc, "end"), linePointTarget(bottom, "start")],
    [linePointTarget(bottom, "end"), arcPointTarget(bottomLeftArc, "start")],
    [arcPointTarget(bottomLeftArc, "end"), linePointTarget(left, "start")],
    [linePointTarget(left, "end"), arcPointTarget(topLeftArc, "start")],
    [arcPointTarget(topLeftArc, "end"), linePointTarget(top, "start")]
  ] as const;
  const tangentPairs = [
    [
      { entityId: top, entityKind: "line" as const },
      { entityId: topRightArc, entityKind: "arc" as const }
    ],
    [
      { entityId: topRightArc, entityKind: "arc" as const },
      { entityId: right, entityKind: "line" as const }
    ],
    [
      { entityId: right, entityKind: "line" as const },
      { entityId: bottomRightArc, entityKind: "arc" as const }
    ],
    [
      { entityId: bottomRightArc, entityKind: "arc" as const },
      { entityId: bottom, entityKind: "line" as const }
    ],
    [
      { entityId: bottom, entityKind: "line" as const },
      { entityId: bottomLeftArc, entityKind: "arc" as const }
    ],
    [
      { entityId: bottomLeftArc, entityKind: "arc" as const },
      { entityId: left, entityKind: "line" as const }
    ],
    [
      { entityId: left, entityKind: "line" as const },
      { entityId: topLeftArc, entityKind: "arc" as const }
    ],
    [
      { entityId: topLeftArc, entityKind: "arc" as const },
      { entityId: top, entityKind: "line" as const }
    ]
  ] as const;
  return [
    ...joins.map(([primary, secondary], index) =>
      coincident(
        ids[index]!,
        `Rounded rectangle join ${index + 1}`,
        op.sketchId,
        primary,
        secondary
      )
    ),
    ...tangentPairs.map(([primary, secondary], index) =>
      tangent(
        ids[index + 8]!,
        `Rounded rectangle tangent ${index + 1}`,
        op.sketchId,
        primary,
        secondary
      )
    ),
    equalRadius(
      ids[16],
      "Rounded rectangle radius 1",
      op.sketchId,
      topRightArc,
      bottomRightArc
    ),
    equalRadius(
      ids[17],
      "Rounded rectangle radius 2",
      op.sketchId,
      topRightArc,
      bottomLeftArc
    ),
    equalRadius(
      ids[18],
      "Rounded rectangle radius 3",
      op.sketchId,
      topRightArc,
      topLeftArc
    ),
    orientation(
      ids[19],
      "Rounded rectangle top",
      op.sketchId,
      top,
      "horizontal"
    ),
    orientation(
      ids[20],
      "Rounded rectangle bottom",
      op.sketchId,
      bottom,
      "horizontal"
    ),
    orientation(
      ids[21],
      "Rounded rectangle left",
      op.sketchId,
      left,
      "vertical"
    ),
    orientation(
      ids[22],
      "Rounded rectangle right",
      op.sketchId,
      right,
      "vertical"
    )
  ];
}

function validateCommonIds(
  entityIds: readonly SketchEntityId[] | undefined,
  constraintIds: readonly SketchConstraintId[] | undefined,
  expectedEntityCount: number,
  expectedConstraintCount: number,
  options: SketchConveniencePlanOptions
): SketchConveniencePlanDiagnostic | undefined {
  return (
    validateIdTuple(
      entityIds,
      expectedEntityCount,
      "entityIds",
      options.occupiedEntityIds
    ) ??
    validateIdTuple(
      constraintIds,
      expectedConstraintCount,
      "constraintIds",
      options.occupiedConstraintIds
    )
  );
}

/** Plan Decision 8 slot sugar without allocating IDs or mutating source. */
export function planSketchSlot(
  op: SketchAddSlotOp,
  options: SketchConveniencePlanOptions = {}
): SketchConveniencePlanResult<SketchSlotPlan> {
  const policy = options.policy ?? SKETCH_GEOMETRY_POLICY;
  const constructionDiagnostic = validateConstruction(op.construction);
  if (constructionDiagnostic) return blocked(constructionDiagnostic);
  if (!isFinitePoint(op.centerlineStart) || !isFinitePoint(op.centerlineEnd)) {
    return blocked(
      geometryDiagnostic(
        !isFinitePoint(op.centerlineStart)
          ? "centerlineStart"
          : "centerlineEnd",
        "A slot centerline endpoint must be a finite sketch-local point."
      )
    );
  }
  const dx = op.centerlineEnd[0] - op.centerlineStart[0];
  const dy = op.centerlineEnd[1] - op.centerlineStart[1];
  const length = Math.hypot(dx, dy);
  if (!Number.isFinite(length) || length <= policy.linearTolerance) {
    return blocked(
      geometryDiagnostic(
        "centerlineEnd",
        "A slot centerline must be finite and longer than the shared linear tolerance; use a circle for coincident endpoints.",
        `>${policy.linearTolerance}`,
        describeNumber(length)
      )
    );
  }
  const arcDiagnostic = validateArcDomain(op.radius, 180, policy, "radius");
  if (arcDiagnostic) return blocked(arcDiagnostic);
  const idDiagnostic = validateCommonIds(
    op.entityIds,
    op.constraintIds,
    SLOT_ENTITY_ROLES.length,
    SLOT_CONSTRAINT_ROLES.length,
    options
  );
  if (idDiagnostic) return blocked(idDiagnostic);

  const unitX = dx / length;
  const unitY = dy / length;
  const normalX = -unitY;
  const normalY = unitX;
  const positiveStart = point(
    op.centerlineStart[0] + normalX * op.radius,
    op.centerlineStart[1] + normalY * op.radius
  );
  const positiveEnd = point(
    op.centerlineEnd[0] + normalX * op.radius,
    op.centerlineEnd[1] + normalY * op.radius
  );
  const negativeEnd = point(
    op.centerlineEnd[0] - normalX * op.radius,
    op.centerlineEnd[1] - normalY * op.radius
  );
  const negativeStart = point(
    op.centerlineStart[0] - normalX * op.radius,
    op.centerlineStart[1] - normalY * op.radius
  );
  const derivedPoints = [
    positiveStart,
    positiveEnd,
    negativeEnd,
    negativeStart
  ];
  if (derivedPoints.some((value) => !isFinitePoint(value))) {
    return blocked(
      geometryDiagnostic("radius", "Slot offset endpoints must remain finite.")
    );
  }
  const endCapStartAngle = normalizeDegrees(
    Math.atan2(normalY, normalX) * DEGREES_PER_RADIAN
  );
  const startCapStartAngle = normalizeDegrees(endCapStartAngle + 180);
  if (
    !Number.isFinite(endCapStartAngle) ||
    !Number.isFinite(startCapStartAngle)
  ) {
    return blocked(
      geometryDiagnostic("centerlineEnd", "Slot cap angles must remain finite.")
    );
  }
  const construction = op.construction ?? false;
  const entityDrafts = [
    {
      role: "sidePositive",
      shape: {
        kind: "line",
        start: positiveStart,
        end: positiveEnd,
        construction
      }
    },
    {
      role: "endCap",
      shape: {
        kind: "arc",
        center: point(op.centerlineEnd[0], op.centerlineEnd[1]),
        radius: op.radius,
        startAngleDegrees: endCapStartAngle,
        sweepAngleDegrees: -180,
        construction
      }
    },
    {
      role: "sideNegative",
      shape: {
        kind: "line",
        start: negativeEnd,
        end: negativeStart,
        construction
      }
    },
    {
      role: "startCap",
      shape: {
        kind: "arc",
        center: point(op.centerlineStart[0], op.centerlineStart[1]),
        radius: op.radius,
        startAngleDegrees: startCapStartAngle,
        sweepAngleDegrees: -180,
        construction
      }
    }
  ] as const satisfies readonly PlannedSketchConvenienceEntity<SketchSlotEntityRole>[];
  for (const draft of entityDrafts) {
    if (draft.shape.kind !== "line") continue;
    const span = pointDistance(draft.shape.start, draft.shape.end);
    if (!Number.isFinite(span) || span <= policy.linearTolerance) {
      return blocked(
        geometryDiagnostic(
          "centerlineEnd",
          "Every slot side line must remain finite and longer than the shared linear tolerance after offset construction.",
          `>${policy.linearTolerance}`,
          describeNumber(span)
        )
      );
    }
  }
  const joinDiagnostic = validateConsecutiveJoins(
    entityDrafts,
    policy,
    "radius"
  );
  if (joinDiagnostic) return blocked(joinDiagnostic);

  const materialized =
    op.entityIds !== undefined && op.constraintIds !== undefined
      ? {
          entities: materializeEntityDrafts(entityDrafts, op.entityIds),
          constraintOps: materializeSlotConstraints(
            op,
            op.entityIds,
            op.constraintIds
          )
        }
      : undefined;
  return {
    status: "ready",
    plan: {
      operation: "slot",
      entityRoles: SLOT_ENTITY_ROLES,
      constraintRoles: SLOT_CONSTRAINT_ROLES,
      entityDrafts,
      requiredEntityIdCount: SLOT_ENTITY_ROLES.length,
      requiredConstraintIdCount: SLOT_CONSTRAINT_ROLES.length,
      ...(materialized === undefined ? {} : { materialized })
    },
    diagnostics: []
  };
}

/** Plan Decision 8 rounded-rectangle sugar without allocating IDs or mutation. */
export function planSketchRoundedRectangle(
  op: SketchAddRoundedRectangleOp,
  options: SketchConveniencePlanOptions = {}
): SketchConveniencePlanResult<SketchRoundedRectanglePlan> {
  const policy = options.policy ?? SKETCH_GEOMETRY_POLICY;
  const constructionDiagnostic = validateConstruction(op.construction);
  if (constructionDiagnostic) return blocked(constructionDiagnostic);
  if (!isFinitePoint(op.center)) {
    return blocked(
      geometryDiagnostic(
        "center",
        "A rounded-rectangle center must be a finite sketch-local point."
      )
    );
  }
  for (const [path, value] of [
    ["width", op.width],
    ["height", op.height]
  ] as const) {
    if (!Number.isFinite(value) || value <= policy.linearTolerance) {
      return blocked(
        geometryDiagnostic(
          path,
          `Rounded-rectangle ${path} must be finite and above the shared linear tolerance.`,
          `>${policy.linearTolerance}`,
          describeNumber(value)
        )
      );
    }
  }
  const arcDiagnostic = validateArcDomain(
    op.cornerRadius,
    90,
    policy,
    "cornerRadius"
  );
  if (arcDiagnostic) return blocked(arcDiagnostic);
  const horizontalLength = op.width - 2 * op.cornerRadius;
  const verticalLength = op.height - 2 * op.cornerRadius;
  if (
    !Number.isFinite(horizontalLength) ||
    horizontalLength <= policy.linearTolerance
  ) {
    return blocked(
      geometryDiagnostic(
        "cornerRadius",
        "Rounded-rectangle top and bottom lines must remain above the shared linear tolerance.",
        `width - 2 * cornerRadius > ${policy.linearTolerance}`,
        describeNumber(horizontalLength)
      )
    );
  }
  if (
    !Number.isFinite(verticalLength) ||
    verticalLength <= policy.linearTolerance
  ) {
    return blocked(
      geometryDiagnostic(
        "cornerRadius",
        "Rounded-rectangle left and right lines must remain above the shared linear tolerance.",
        `height - 2 * cornerRadius > ${policy.linearTolerance}`,
        describeNumber(verticalLength)
      )
    );
  }
  const idDiagnostic = validateCommonIds(
    op.entityIds,
    op.constraintIds,
    ROUNDED_RECTANGLE_ENTITY_ROLES.length,
    ROUNDED_RECTANGLE_CONSTRAINT_ROLES.length,
    options
  );
  if (idDiagnostic) return blocked(idDiagnostic);

  const xMin = op.center[0] - op.width / 2;
  const xMax = op.center[0] + op.width / 2;
  const yMin = op.center[1] - op.height / 2;
  const yMax = op.center[1] + op.height / 2;
  const xLeftCenter = xMin + op.cornerRadius;
  const xRightCenter = xMax - op.cornerRadius;
  const yBottomCenter = yMin + op.cornerRadius;
  const yTopCenter = yMax - op.cornerRadius;
  const derivedScalars = [
    xMin,
    xMax,
    yMin,
    yMax,
    xLeftCenter,
    xRightCenter,
    yBottomCenter,
    yTopCenter
  ];
  if (derivedScalars.some((value) => !Number.isFinite(value))) {
    return blocked(
      geometryDiagnostic(
        "center",
        "Rounded-rectangle corners and arc centers must remain finite."
      )
    );
  }
  const construction = op.construction ?? false;
  const entityDrafts = [
    {
      role: "top",
      shape: {
        kind: "line",
        start: point(xLeftCenter, yMax),
        end: point(xRightCenter, yMax),
        construction
      }
    },
    {
      role: "topRightArc",
      shape: {
        kind: "arc",
        center: point(xRightCenter, yTopCenter),
        radius: op.cornerRadius,
        startAngleDegrees: 90,
        sweepAngleDegrees: -90,
        construction
      }
    },
    {
      role: "right",
      shape: {
        kind: "line",
        start: point(xMax, yTopCenter),
        end: point(xMax, yBottomCenter),
        construction
      }
    },
    {
      role: "bottomRightArc",
      shape: {
        kind: "arc",
        center: point(xRightCenter, yBottomCenter),
        radius: op.cornerRadius,
        startAngleDegrees: 0,
        sweepAngleDegrees: -90,
        construction
      }
    },
    {
      role: "bottom",
      shape: {
        kind: "line",
        start: point(xRightCenter, yMin),
        end: point(xLeftCenter, yMin),
        construction
      }
    },
    {
      role: "bottomLeftArc",
      shape: {
        kind: "arc",
        center: point(xLeftCenter, yBottomCenter),
        radius: op.cornerRadius,
        startAngleDegrees: 270,
        sweepAngleDegrees: -90,
        construction
      }
    },
    {
      role: "left",
      shape: {
        kind: "line",
        start: point(xMin, yBottomCenter),
        end: point(xMin, yTopCenter),
        construction
      }
    },
    {
      role: "topLeftArc",
      shape: {
        kind: "arc",
        center: point(xLeftCenter, yTopCenter),
        radius: op.cornerRadius,
        startAngleDegrees: 180,
        sweepAngleDegrees: -90,
        construction
      }
    }
  ] as const satisfies readonly PlannedSketchConvenienceEntity<SketchRoundedRectangleEntityRole>[];
  if (
    entityDrafts.some((draft) => {
      if (draft.shape.kind === "line") {
        return (
          !isFinitePoint(draft.shape.start) ||
          !isFinitePoint(draft.shape.end) ||
          Math.hypot(
            draft.shape.end[0] - draft.shape.start[0],
            draft.shape.end[1] - draft.shape.start[1]
          ) <= policy.linearTolerance
        );
      }
      return !isFinitePoint(draft.shape.center);
    })
  ) {
    return blocked(
      geometryDiagnostic(
        "cornerRadius",
        "Every rounded-rectangle line and arc must remain finite and non-degenerate."
      )
    );
  }
  const joinDiagnostic = validateConsecutiveJoins(
    entityDrafts,
    policy,
    "cornerRadius"
  );
  if (joinDiagnostic) return blocked(joinDiagnostic);

  const materialized =
    op.entityIds !== undefined && op.constraintIds !== undefined
      ? {
          entities: materializeEntityDrafts(entityDrafts, op.entityIds),
          constraintOps: materializeRoundedRectangleConstraints(
            op,
            op.entityIds,
            op.constraintIds
          )
        }
      : undefined;
  return {
    status: "ready",
    plan: {
      operation: "roundedRectangle",
      entityRoles: ROUNDED_RECTANGLE_ENTITY_ROLES,
      constraintRoles: ROUNDED_RECTANGLE_CONSTRAINT_ROLES,
      entityDrafts,
      requiredEntityIdCount: ROUNDED_RECTANGLE_ENTITY_ROLES.length,
      requiredConstraintIdCount: ROUNDED_RECTANGLE_CONSTRAINT_ROLES.length,
      ...(materialized === undefined ? {} : { materialized })
    },
    diagnostics: []
  };
}
