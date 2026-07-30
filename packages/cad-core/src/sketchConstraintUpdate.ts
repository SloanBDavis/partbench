import type {
  SketchConstraintSnapshot,
  SketchConstraintUpdateOpV19,
  SketchCurveConstraintTarget,
  SketchEntitySnapshot,
  SketchPointTarget,
  SketchPointTargetV22,
  SketchRadiusCurveTarget,
  Vec2
} from "@web-cad/cad-protocol";

export type SketchConstraintUpdateIssueCode =
  | "SKETCH_CONSTRAINT_UPDATE_ID_MISMATCH"
  | "SKETCH_CONSTRAINT_UPDATE_KIND_CHANGE_UNSUPPORTED"
  | "SKETCH_CONSTRAINT_UPDATE_TARGET_NOT_FOUND"
  | "SKETCH_CONSTRAINT_UPDATE_TARGET_KIND_MISMATCH"
  | "SKETCH_CONSTRAINT_UPDATE_TARGET_ROLE_INVALID"
  | "SKETCH_CONSTRAINT_UPDATE_TARGETS_NOT_DISTINCT"
  | "SKETCH_CONSTRAINT_UPDATE_SELF_REFERENCE"
  | "SKETCH_CONSTRAINT_UPDATE_TARGET_PAIR_UNSUPPORTED"
  | "SKETCH_CONSTRAINT_UPDATE_VALUE_INVALID";

export interface SketchConstraintUpdateIssue {
  readonly code: SketchConstraintUpdateIssueCode;
  readonly path: string;
  readonly message: string;
  readonly expected: string;
  readonly received: string;
}

export type SketchConstraintUpdatePlanResult =
  | {
      readonly ok: true;
      readonly constraint: SketchConstraintSnapshot;
    }
  | {
      readonly ok: false;
      readonly issue: SketchConstraintUpdateIssue;
    };

type EntityIndex = ReadonlyMap<string, SketchEntitySnapshot>;

type PointTargetResult =
  | {
      readonly ok: true;
      readonly target: SketchPointTarget;
    }
  | {
      readonly ok: false;
      readonly issue: SketchConstraintUpdateIssue;
    };

type CurveTargetResult<Target extends SketchCurveConstraintTarget> =
  | {
      readonly ok: true;
      readonly target: Target;
    }
  | {
      readonly ok: false;
      readonly issue: SketchConstraintUpdateIssue;
    };

export function planSketchConstraintUpdate(
  existing: SketchConstraintSnapshot,
  operation: SketchConstraintUpdateOpV19,
  entities: readonly SketchEntitySnapshot[]
): SketchConstraintUpdatePlanResult {
  if (operation.id !== existing.id) {
    return blocked(
      "SKETCH_CONSTRAINT_UPDATE_ID_MISMATCH",
      "$.id",
      "The update operation must identify the supplied constraint.",
      existing.id,
      operation.id
    );
  }

  const definition = operation.definition;
  if (definition.kind !== existing.kind) {
    return blocked(
      "SKETCH_CONSTRAINT_UPDATE_KIND_CHANGE_UNSUPPORTED",
      "$.definition.kind",
      "A structural constraint update cannot change constraint kind.",
      existing.kind,
      definition.kind
    );
  }

  const entityIndex = new Map(entities.map((entity) => [entity.id, entity]));
  const base = {
    id: existing.id,
    name: existing.name,
    sketchId: existing.sketchId
  } as const;

  switch (definition.kind) {
    case "horizontal":
    case "vertical": {
      const lineIssue = validateEntityKind(
        entityIndex,
        definition.entityId,
        "line",
        "$.definition.entityId"
      );
      if (lineIssue) return { ok: false, issue: lineIssue };
      return {
        ok: true,
        constraint: {
          ...base,
          kind: definition.kind,
          entityId: definition.entityId
        }
      };
    }

    case "fixed": {
      const target = normalizePointTarget(
        entityIndex,
        definition.target,
        "$.definition.target"
      );
      if (!target.ok) return target;
      if (!isFiniteVec2(definition.coordinate)) {
        return blocked(
          "SKETCH_CONSTRAINT_UPDATE_VALUE_INVALID",
          "$.definition.coordinate",
          "A fixed constraint coordinate must contain two finite numbers.",
          "finite [x, y]",
          describeValue(definition.coordinate)
        );
      }
      return {
        ok: true,
        constraint: {
          ...base,
          kind: "fixed",
          entityId: target.target.entityId,
          target: target.target,
          coordinate: cloneVec2(definition.coordinate)
        }
      };
    }

    case "coincident": {
      const primary = normalizePointTarget(
        entityIndex,
        definition.primaryTarget,
        "$.definition.primaryTarget"
      );
      if (!primary.ok) return primary;
      const secondary = normalizePointTarget(
        entityIndex,
        definition.secondaryTarget,
        "$.definition.secondaryTarget"
      );
      if (!secondary.ok) return secondary;
      if (pointTargetKey(primary.target) === pointTargetKey(secondary.target)) {
        return blocked(
          "SKETCH_CONSTRAINT_UPDATE_TARGETS_NOT_DISTINCT",
          "$.definition.secondaryTarget",
          "Coincident constraints require two distinct point targets.",
          "a point target different from primaryTarget",
          pointTargetKey(secondary.target)
        );
      }
      return {
        ok: true,
        constraint: {
          ...base,
          kind: "coincident",
          entityId: primary.target.entityId,
          primaryTarget: primary.target,
          secondaryTarget: secondary.target
        }
      };
    }

    case "midpoint": {
      const lineIssue = validateEntityKind(
        entityIndex,
        definition.lineEntityId,
        "line",
        "$.definition.lineEntityId"
      );
      if (lineIssue) return { ok: false, issue: lineIssue };
      const target = normalizePointTarget(
        entityIndex,
        definition.target,
        "$.definition.target",
        new Set(["point", "rectangle", "circle"])
      );
      if (!target.ok) return target;
      return {
        ok: true,
        constraint: {
          ...base,
          kind: "midpoint",
          entityId: definition.lineEntityId,
          lineEntityId: definition.lineEntityId,
          target: {
            entityId: target.target.entityId,
            role: target.target.role
          }
        }
      };
    }

    case "parallel":
    case "perpendicular":
    case "equalLength": {
      const pairIssue = validateDistinctLinePair(
        entityIndex,
        definition.primaryLineEntityId,
        definition.secondaryLineEntityId,
        "$.definition.primaryLineEntityId",
        "$.definition.secondaryLineEntityId"
      );
      if (pairIssue) return { ok: false, issue: pairIssue };
      return {
        ok: true,
        constraint: {
          ...base,
          kind: definition.kind,
          entityId: definition.secondaryLineEntityId,
          primaryLineEntityId: definition.primaryLineEntityId,
          secondaryLineEntityId: definition.secondaryLineEntityId
        }
      };
    }

    case "tangent": {
      const primary = validateCurveTarget(
        entityIndex,
        definition.primaryTarget,
        "$.definition.primaryTarget",
        new Set(["line", "circle", "arc"])
      );
      if (!primary.ok) return primary;
      const secondary = validateCurveTarget(
        entityIndex,
        definition.secondaryTarget,
        "$.definition.secondaryTarget",
        new Set(["line", "circle", "arc"])
      );
      if (!secondary.ok) return secondary;
      if (primary.target.entityId === secondary.target.entityId) {
        return selfReference(
          "$.definition.secondaryTarget",
          secondary.target.entityId
        );
      }
      if (!isSupportedTangentPair(primary.target, secondary.target)) {
        return blocked(
          "SKETCH_CONSTRAINT_UPDATE_TARGET_PAIR_UNSUPPORTED",
          "$.definition",
          "Tangent constraints support line-circle, line-arc, circle-arc, or arc-arc pairs.",
          "line-circle, line-arc, circle-arc, or arc-arc",
          `${primary.target.entityKind}-${secondary.target.entityKind}`
        );
      }
      return {
        ok: true,
        constraint: {
          ...base,
          kind: "tangent",
          entityId: secondary.target.entityId,
          primaryTarget: primary.target,
          secondaryTarget: secondary.target
        }
      };
    }

    case "concentric":
    case "equalRadius": {
      const allowedKinds = new Set<SketchEntitySnapshot["kind"]>([
        "circle",
        "arc"
      ]);
      const primary = validateCurveTarget(
        entityIndex,
        definition.primaryTarget,
        "$.definition.primaryTarget",
        allowedKinds
      );
      if (!primary.ok) return primary;
      const secondary = validateCurveTarget(
        entityIndex,
        definition.secondaryTarget,
        "$.definition.secondaryTarget",
        allowedKinds
      );
      if (!secondary.ok) return secondary;
      if (primary.target.entityId === secondary.target.entityId) {
        return selfReference(
          "$.definition.secondaryTarget",
          secondary.target.entityId
        );
      }
      const primaryTarget = primary.target as SketchRadiusCurveTarget;
      const secondaryTarget = secondary.target as SketchRadiusCurveTarget;
      return {
        ok: true,
        constraint: {
          ...base,
          kind: definition.kind,
          entityId: secondaryTarget.entityId,
          primaryTarget,
          secondaryTarget
        }
      };
    }

    case "symmetry": {
      const primary = normalizePointTarget(
        entityIndex,
        definition.primaryTarget,
        "$.definition.primaryTarget"
      );
      if (!primary.ok) return primary;
      const secondary = normalizePointTarget(
        entityIndex,
        definition.secondaryTarget,
        "$.definition.secondaryTarget"
      );
      if (!secondary.ok) return secondary;
      if (pointTargetKey(primary.target) === pointTargetKey(secondary.target)) {
        return blocked(
          "SKETCH_CONSTRAINT_UPDATE_TARGETS_NOT_DISTINCT",
          "$.definition.secondaryTarget",
          "Symmetry constraints require two distinct point targets.",
          "a point target different from primaryTarget",
          pointTargetKey(secondary.target)
        );
      }
      const lineIssue = validateEntityKind(
        entityIndex,
        definition.symmetryLineEntityId,
        "line",
        "$.definition.symmetryLineEntityId"
      );
      if (lineIssue) return { ok: false, issue: lineIssue };
      return {
        ok: true,
        constraint: {
          ...base,
          kind: "symmetry",
          entityId: secondary.target.entityId,
          primaryTarget: primary.target,
          secondaryTarget: secondary.target,
          symmetryLineEntityId: definition.symmetryLineEntityId
        }
      };
    }

    case "angle": {
      const pairIssue = validateDistinctLinePair(
        entityIndex,
        definition.primaryLineEntityId,
        definition.secondaryLineEntityId,
        "$.definition.primaryLineEntityId",
        "$.definition.secondaryLineEntityId"
      );
      if (pairIssue) return { ok: false, issue: pairIssue };
      if (
        !Number.isFinite(definition.angleDegrees) ||
        definition.angleDegrees <= 0 ||
        definition.angleDegrees >= 180
      ) {
        return blocked(
          "SKETCH_CONSTRAINT_UPDATE_VALUE_INVALID",
          "$.definition.angleDegrees",
          "A legacy angle constraint must be greater than 0 and less than 180 degrees.",
          "finite angleDegrees > 0 and < 180",
          describeValue(definition.angleDegrees)
        );
      }
      return {
        ok: true,
        constraint: {
          ...base,
          kind: "angle",
          entityId: definition.secondaryLineEntityId,
          primaryLineEntityId: definition.primaryLineEntityId,
          secondaryLineEntityId: definition.secondaryLineEntityId,
          angleDegrees: definition.angleDegrees
        }
      };
    }
  }
}

function normalizePointTarget(
  entityIndex: EntityIndex,
  target: SketchPointTargetV22,
  path: string,
  allowedKinds = new Set<SketchEntitySnapshot["kind"]>([
    "point",
    "line",
    "rectangle",
    "circle",
    "arc"
  ])
): PointTargetResult {
  if (!isPointTargetRoleValid(target)) {
    return blocked(
      "SKETCH_CONSTRAINT_UPDATE_TARGET_ROLE_INVALID",
      path,
      "The point-target role must match its declared entity kind.",
      pointRoleExpectation(target.entityKind),
      `${describeValue(target.entityKind)}:${describeValue(target.role)}`
    );
  }
  if (!allowedKinds.has(target.entityKind)) {
    return blocked(
      "SKETCH_CONSTRAINT_UPDATE_TARGET_KIND_MISMATCH",
      `${path}.entityKind`,
      "This constraint does not support the supplied point-target entity kind.",
      [...allowedKinds].join(" | "),
      target.entityKind
    );
  }
  const entityIssue = validateEntityKind(
    entityIndex,
    target.entityId,
    target.entityKind,
    path
  );
  if (entityIssue) return { ok: false, issue: entityIssue };

  return target.entityKind === "arc"
    ? {
        ok: true,
        target: {
          entityId: target.entityId,
          entityKind: "arc",
          role: target.role
        }
      }
    : {
        ok: true,
        target: {
          entityId: target.entityId,
          role: target.role
        }
      };
}

function validateCurveTarget<
  Target extends SketchCurveConstraintTarget = SketchCurveConstraintTarget
>(
  entityIndex: EntityIndex,
  target: Target,
  path: string,
  allowedKinds: ReadonlySet<SketchEntitySnapshot["kind"]>
): CurveTargetResult<Target> {
  if (!allowedKinds.has(target.entityKind)) {
    return blocked(
      "SKETCH_CONSTRAINT_UPDATE_TARGET_KIND_MISMATCH",
      `${path}.entityKind`,
      "This constraint does not support the supplied curve-target entity kind.",
      [...allowedKinds].join(" | "),
      target.entityKind
    );
  }
  const entityIssue = validateEntityKind(
    entityIndex,
    target.entityId,
    target.entityKind,
    path
  );
  return entityIssue
    ? { ok: false, issue: entityIssue }
    : {
        ok: true,
        target: { ...target }
      };
}

function validateDistinctLinePair(
  entityIndex: EntityIndex,
  primaryId: string,
  secondaryId: string,
  primaryPath: string,
  secondaryPath: string
): SketchConstraintUpdateIssue | undefined {
  const primaryIssue = validateEntityKind(
    entityIndex,
    primaryId,
    "line",
    primaryPath
  );
  if (primaryIssue) return primaryIssue;
  const secondaryIssue = validateEntityKind(
    entityIndex,
    secondaryId,
    "line",
    secondaryPath
  );
  if (secondaryIssue) return secondaryIssue;
  return primaryId === secondaryId
    ? selfReference(secondaryPath, secondaryId).issue
    : undefined;
}

function validateEntityKind(
  entityIndex: EntityIndex,
  entityId: string,
  expectedKind: SketchEntitySnapshot["kind"],
  path: string
): SketchConstraintUpdateIssue | undefined {
  const entity = entityIndex.get(entityId);
  if (!entity) {
    return blocked(
      "SKETCH_CONSTRAINT_UPDATE_TARGET_NOT_FOUND",
      path,
      "A constraint target does not resolve in the sketch.",
      `existing ${expectedKind} entity`,
      entityId
    ).issue;
  }
  if (entity.kind !== expectedKind) {
    return blocked(
      "SKETCH_CONSTRAINT_UPDATE_TARGET_KIND_MISMATCH",
      path,
      "The declared constraint target kind must match the stored sketch entity.",
      expectedKind,
      entity.kind
    ).issue;
  }
  return undefined;
}

function isPointTargetRoleValid(target: SketchPointTargetV22): boolean {
  return (
    (target.entityKind === "point" && target.role === "position") ||
    (target.entityKind === "line" &&
      (target.role === "start" || target.role === "end")) ||
    ((target.entityKind === "rectangle" || target.entityKind === "circle") &&
      target.role === "center") ||
    (target.entityKind === "arc" &&
      (target.role === "center" ||
        target.role === "start" ||
        target.role === "end"))
  );
}

function pointRoleExpectation(kind: unknown): string {
  switch (kind) {
    case "point":
      return "point:position";
    case "line":
      return "line:start | line:end";
    case "rectangle":
    case "circle":
      return `${kind}:center`;
    case "arc":
      return "arc:center | arc:start | arc:end";
    default:
      return "normalized V22 point target";
  }
}

function pointTargetKey(target: SketchPointTarget): string {
  return `${target.entityKind ?? "legacy"}:${target.entityId}:${target.role}`;
}

function isSupportedTangentPair(
  primary: SketchCurveConstraintTarget,
  secondary: SketchCurveConstraintTarget
): boolean {
  return (
    (primary.entityKind === "line" &&
      (secondary.entityKind === "circle" || secondary.entityKind === "arc")) ||
    (secondary.entityKind === "line" &&
      (primary.entityKind === "circle" || primary.entityKind === "arc")) ||
    (primary.entityKind === "circle" && secondary.entityKind === "arc") ||
    (primary.entityKind === "arc" &&
      (secondary.entityKind === "circle" || secondary.entityKind === "arc"))
  );
}

function isFiniteVec2(value: Vec2): boolean {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1])
  );
}

function cloneVec2(value: Vec2): Vec2 {
  return [value[0], value[1]];
}

function selfReference(
  path: string,
  entityId: string
): Extract<SketchConstraintUpdatePlanResult, { readonly ok: false }> {
  return blocked(
    "SKETCH_CONSTRAINT_UPDATE_SELF_REFERENCE",
    path,
    "A paired constraint cannot target the same entity twice.",
    "an entity different from the primary target",
    entityId
  );
}

function blocked(
  code: SketchConstraintUpdateIssueCode,
  path: string,
  message: string,
  expected: string,
  received: string
): Extract<SketchConstraintUpdatePlanResult, { readonly ok: false }> {
  return {
    ok: false,
    issue: { code, path, message, expected, received }
  };
}

function describeValue(value: unknown): string {
  if (typeof value === "number" && Number.isNaN(value)) return "NaN";
  if (value === Infinity) return "Infinity";
  if (value === -Infinity) return "-Infinity";
  if (Array.isArray(value)) return `[${value.map(describeValue).join(", ")}]`;
  return String(value);
}
