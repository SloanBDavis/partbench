import type {
  SketchConstraintSnapshot,
  SketchDimensionSnapshotV22,
  SketchDimensionTargetV22,
  SketchEntityId,
  SketchEntityKind,
  SketchEntityReplacement,
  SketchPointTarget,
  SketchPointTargetV22
} from "@web-cad/cad-protocol";

import { cloneSketchDimensionSnapshotV22 } from "./v22SourceShapes";

export type SketchCurveEditStructuralDisposition =
  | "preserved"
  | "retargeted"
  | "invalid"
  | "unaffected";

export type SketchCurveEditStructuralReason =
  | "curve-wide-target-replaced"
  | "endpoint-kind-changed"
  | "endpoint-provenance-missing"
  | "endpoint-provenance-outside-replacement"
  | "endpoint-provenance-target-invalid"
  | "point-target-replaced"
  | "same-target-collapse"
  | "source-kind-mismatch"
  | "symmetry-retarget-forbidden"
  | "target-kind-changed"
  | "target-missing";

export type SketchPointTargetProvenanceKey = string;

type SketchPointTargetInput = SketchPointTarget | SketchPointTargetV22;

export interface SketchEndpointProvenance {
  readonly entityId: SketchEntityId;
  readonly entityKind: "line" | "arc";
  readonly role: "start" | "end";
}

export interface SketchCurveEditRecordTargetContext {
  readonly replacements: readonly SketchEntityReplacement[];
  readonly endpointProvenance: ReadonlyMap<
    SketchPointTargetProvenanceKey,
    SketchEndpointProvenance
  >;
  readonly sourceEntityKinds: ReadonlyMap<SketchEntityId, SketchEntityKind>;
  readonly resultEntityKinds: ReadonlyMap<SketchEntityId, SketchEntityKind>;
}

export interface SketchCurveEditConstraintTargetResult {
  readonly disposition: SketchCurveEditStructuralDisposition;
  readonly before: SketchConstraintSnapshot;
  readonly after?: SketchConstraintSnapshot;
  readonly reason?: SketchCurveEditStructuralReason;
}

export interface SketchCurveEditDimensionTargetResult {
  readonly disposition: SketchCurveEditStructuralDisposition;
  readonly before: SketchDimensionSnapshotV22;
  readonly after?: SketchDimensionSnapshotV22;
  readonly reason?: SketchCurveEditStructuralReason;
}

interface TargetContext {
  readonly replacements: ReadonlyMap<SketchEntityId, SketchEntityReplacement>;
  readonly endpointProvenance: ReadonlyMap<
    SketchPointTargetProvenanceKey,
    SketchEndpointProvenance
  >;
  readonly sourceEntityKinds: ReadonlyMap<SketchEntityId, SketchEntityKind>;
  readonly resultEntityKinds: ReadonlyMap<SketchEntityId, SketchEntityKind>;
}

interface PointTargetResult {
  readonly disposition: "preserved" | "retargeted" | "invalid";
  readonly target?: SketchPointTarget;
  readonly normalizedTarget?: SketchPointTargetV22;
  readonly reason?: SketchCurveEditStructuralReason;
}

interface ExactEntityTargetResult {
  readonly disposition: "preserved" | "invalid";
  readonly reason?: SketchCurveEditStructuralReason;
}

export function compareSketchCurveEditRecordIds(
  left: string,
  right: string
): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function sortUniqueSketchCurveEditRecordIds(
  ids: readonly string[]
): readonly string[] {
  return [...new Set(ids)].sort(compareSketchCurveEditRecordIds);
}

export function createSketchPointTargetProvenanceKey(
  target: Pick<SketchPointTargetInput, "entityId" | "role">
): SketchPointTargetProvenanceKey {
  return JSON.stringify([target.entityId, target.role]);
}

export function getSketchConstraintTargetEntityIds(
  constraint: SketchConstraintSnapshot
): readonly SketchEntityId[] {
  const ids: SketchEntityId[] = [constraint.entityId];
  switch (constraint.kind) {
    case "horizontal":
    case "vertical":
      break;
    case "fixed":
      ids.push(constraint.target.entityId);
      break;
    case "coincident":
      ids.push(
        constraint.primaryTarget.entityId,
        constraint.secondaryTarget.entityId
      );
      break;
    case "midpoint":
      ids.push(constraint.lineEntityId, constraint.target.entityId);
      break;
    case "parallel":
    case "perpendicular":
    case "equalLength":
    case "angle":
      ids.push(
        constraint.primaryLineEntityId,
        constraint.secondaryLineEntityId
      );
      break;
    case "tangent":
    case "concentric":
    case "equalRadius":
      ids.push(
        constraint.primaryTarget.entityId,
        constraint.secondaryTarget.entityId
      );
      break;
    case "symmetry":
      ids.push(
        constraint.primaryTarget.entityId,
        constraint.secondaryTarget.entityId,
        constraint.symmetryLineEntityId
      );
      break;
  }
  return sortUniqueSketchCurveEditRecordIds(ids);
}

export function getSketchDimensionTargetEntityIds(
  target: SketchDimensionTargetV22
): readonly SketchEntityId[] {
  switch (target.kind) {
    case "entityScalar":
      return [target.entityId];
    case "pointPair":
      return sortUniqueSketchCurveEditRecordIds([
        target.primary.entityId,
        target.secondary.entityId
      ]);
    case "pointLineDistance":
      return sortUniqueSketchCurveEditRecordIds([
        target.point.entityId,
        target.lineEntityId
      ]);
    case "lineAngle":
      return sortUniqueSketchCurveEditRecordIds([
        target.primaryLineEntityId,
        target.secondaryLineEntityId
      ]);
  }
}

export function getSketchConstraintPointTargetProvenanceKeys(
  constraint: SketchConstraintSnapshot
): readonly SketchPointTargetProvenanceKey[] {
  switch (constraint.kind) {
    case "fixed":
      return [createSketchPointTargetProvenanceKey(constraint.target)];
    case "coincident":
      return sortUniqueSketchCurveEditRecordIds([
        createSketchPointTargetProvenanceKey(constraint.primaryTarget),
        createSketchPointTargetProvenanceKey(constraint.secondaryTarget)
      ]);
    case "midpoint":
      return [createSketchPointTargetProvenanceKey(constraint.target)];
    case "symmetry":
      return sortUniqueSketchCurveEditRecordIds([
        createSketchPointTargetProvenanceKey(constraint.primaryTarget),
        createSketchPointTargetProvenanceKey(constraint.secondaryTarget)
      ]);
    case "horizontal":
    case "vertical":
    case "parallel":
    case "perpendicular":
    case "tangent":
    case "concentric":
    case "equalLength":
    case "equalRadius":
    case "angle":
      return [];
  }
}

export function getSketchDimensionPointTargetProvenanceKeys(
  target: SketchDimensionTargetV22
): readonly SketchPointTargetProvenanceKey[] {
  switch (target.kind) {
    case "pointPair":
      return sortUniqueSketchCurveEditRecordIds([
        createSketchPointTargetProvenanceKey(target.primary),
        createSketchPointTargetProvenanceKey(target.secondary)
      ]);
    case "pointLineDistance":
      return [createSketchPointTargetProvenanceKey(target.point)];
    case "entityScalar":
    case "lineAngle":
      return [];
  }
}

export function retargetSketchCurveEditConstraint(
  constraint: SketchConstraintSnapshot,
  input: SketchCurveEditRecordTargetContext
): SketchCurveEditConstraintTargetResult {
  const context = normalizeContext(input);
  const before = cloneNormalizedConstraint(constraint);
  const affected = getSketchConstraintTargetEntityIds(before).some((id) =>
    context.replacements.has(id)
  );
  if (!affected) {
    return { disposition: "unaffected", before, after: before };
  }

  switch (before.kind) {
    case "fixed":
      return retargetFixedConstraint(before, context);
    case "coincident":
      return retargetCoincidentConstraint(before, context);
    case "symmetry":
      return {
        disposition: "invalid",
        before,
        reason: "symmetry-retarget-forbidden"
      };
    case "horizontal":
    case "vertical":
      return exactConstraintResult(
        before,
        exactEntityTarget(before.entityId, "line", context)
      );
    case "midpoint":
      return exactConstraintResults(before, [
        exactEntityTarget(before.lineEntityId, "line", context),
        exactPointTarget(before.target, context)
      ]);
    case "parallel":
    case "perpendicular":
    case "equalLength":
    case "angle":
      return exactConstraintResults(before, [
        exactEntityTarget(before.primaryLineEntityId, "line", context),
        exactEntityTarget(before.secondaryLineEntityId, "line", context)
      ]);
    case "tangent":
      return exactConstraintResults(before, [
        exactEntityTarget(
          before.primaryTarget.entityId,
          before.primaryTarget.entityKind,
          context
        ),
        exactEntityTarget(
          before.secondaryTarget.entityId,
          before.secondaryTarget.entityKind,
          context
        )
      ]);
    case "concentric":
    case "equalRadius":
      return exactConstraintResults(before, [
        exactEntityTarget(
          before.primaryTarget.entityId,
          before.primaryTarget.entityKind,
          context
        ),
        exactEntityTarget(
          before.secondaryTarget.entityId,
          before.secondaryTarget.entityKind,
          context
        )
      ]);
  }
}

export function retargetSketchCurveEditDimension(
  dimension: SketchDimensionSnapshotV22,
  input: SketchCurveEditRecordTargetContext
): SketchCurveEditDimensionTargetResult {
  const context = normalizeContext(input);
  const before = cloneSketchDimensionSnapshotV22(dimension);
  const affected = getSketchDimensionTargetEntityIds(before.target).some((id) =>
    context.replacements.has(id)
  );
  if (!affected) {
    return { disposition: "unaffected", before, after: before };
  }

  switch (before.target.kind) {
    case "entityScalar":
      return exactDimensionResult(
        before,
        exactEntityTarget(
          before.target.entityId,
          before.target.entityKind,
          context
        )
      );
    case "lineAngle":
      return exactDimensionResults(before, [
        exactEntityTarget(before.target.primaryLineEntityId, "line", context),
        exactEntityTarget(before.target.secondaryLineEntityId, "line", context)
      ]);
    case "pointPair":
      return retargetPointPairDimension(before, before.target, context);
    case "pointLineDistance":
      return retargetPointLineDimension(before, before.target, context);
  }
}

function normalizeContext(
  input: SketchCurveEditRecordTargetContext
): TargetContext {
  const replacements = new Map<SketchEntityId, SketchEntityReplacement>();
  for (const replacement of input.replacements) {
    if (replacements.has(replacement.sourceEntityId)) {
      throw new Error(
        `Duplicate curve-edit replacement for ${replacement.sourceEntityId}.`
      );
    }
    replacements.set(replacement.sourceEntityId, replacement);
  }
  return { ...input, replacements };
}

function retargetFixedConstraint(
  before: Extract<SketchConstraintSnapshot, { readonly kind: "fixed" }>,
  context: TargetContext
): SketchCurveEditConstraintTargetResult {
  const targetResult = retargetSafePointTarget(before.target, context);
  if (
    targetResult.disposition === "invalid" ||
    targetResult.target === undefined
  ) {
    return {
      disposition: "invalid",
      before,
      reason: targetResult.reason
    };
  }
  const after = {
    ...before,
    entityId: targetResult.target.entityId,
    target: targetResult.target,
    coordinate: [before.coordinate[0], before.coordinate[1]]
  } as typeof before;
  return {
    disposition: targetResult.disposition,
    before,
    after
  };
}

function retargetCoincidentConstraint(
  before: Extract<SketchConstraintSnapshot, { readonly kind: "coincident" }>,
  context: TargetContext
): SketchCurveEditConstraintTargetResult {
  const primary = retargetSafePointTarget(before.primaryTarget, context);
  if (primary.disposition === "invalid" || primary.target === undefined) {
    return {
      disposition: "invalid",
      before,
      reason: primary.reason
    };
  }
  const secondary = retargetSafePointTarget(before.secondaryTarget, context);
  if (secondary.disposition === "invalid" || secondary.target === undefined) {
    return {
      disposition: "invalid",
      before,
      reason: secondary.reason
    };
  }
  if (
    pointTargetsEqual(primary.normalizedTarget!, secondary.normalizedTarget!)
  ) {
    return {
      disposition: "invalid",
      before,
      reason: "same-target-collapse"
    };
  }
  const after = {
    ...before,
    entityId: primary.target.entityId,
    primaryTarget: primary.target,
    secondaryTarget: secondary.target
  } as typeof before;
  return {
    disposition:
      primary.disposition === "retargeted" ||
      secondary.disposition === "retargeted"
        ? "retargeted"
        : "preserved",
    before,
    after
  };
}

function retargetPointPairDimension(
  before: SketchDimensionSnapshotV22,
  target: Extract<SketchDimensionTargetV22, { readonly kind: "pointPair" }>,
  context: TargetContext
): SketchCurveEditDimensionTargetResult {
  const primary = retargetSafePointTarget(target.primary, context);
  if (
    primary.disposition === "invalid" ||
    primary.normalizedTarget === undefined
  ) {
    return {
      disposition: "invalid",
      before,
      reason: primary.reason
    };
  }
  const secondary = retargetSafePointTarget(target.secondary, context);
  if (
    secondary.disposition === "invalid" ||
    secondary.normalizedTarget === undefined
  ) {
    return {
      disposition: "invalid",
      before,
      reason: secondary.reason
    };
  }
  if (pointTargetsEqual(primary.normalizedTarget, secondary.normalizedTarget)) {
    return {
      disposition: "invalid",
      before,
      reason: "same-target-collapse"
    };
  }
  const after: SketchDimensionSnapshotV22 = {
    ...before,
    target: {
      ...target,
      primary: primary.normalizedTarget,
      secondary: secondary.normalizedTarget
    }
  };
  return {
    disposition:
      primary.disposition === "retargeted" ||
      secondary.disposition === "retargeted"
        ? "retargeted"
        : "preserved",
    before,
    after
  };
}

function retargetPointLineDimension(
  before: SketchDimensionSnapshotV22,
  target: Extract<
    SketchDimensionTargetV22,
    { readonly kind: "pointLineDistance" }
  >,
  context: TargetContext
): SketchCurveEditDimensionTargetResult {
  const point = retargetSafePointTarget(target.point, context);
  if (point.disposition === "invalid" || point.normalizedTarget === undefined) {
    return { disposition: "invalid", before, reason: point.reason };
  }
  const line = exactEntityTarget(target.lineEntityId, "line", context);
  if (line.disposition === "invalid") {
    return { disposition: "invalid", before, reason: line.reason };
  }
  const after: SketchDimensionSnapshotV22 = {
    ...before,
    target: {
      ...target,
      point: point.normalizedTarget
    }
  };
  return {
    disposition: point.disposition,
    before,
    after
  };
}

function retargetSafePointTarget(
  target: SketchPointTargetInput,
  context: TargetContext
): PointTargetResult {
  const normalized = normalizePointTarget(target, context.sourceEntityKinds);
  if (!normalized) {
    return { disposition: "invalid", reason: "source-kind-mismatch" };
  }
  const replacement = context.replacements.get(target.entityId);
  if (!replacement) {
    return {
      disposition: "preserved",
      target: cloneStoredPointTarget(target, normalized),
      normalizedTarget: { ...normalized }
    };
  }

  if (target.role !== "start" && target.role !== "end") {
    const exact = exactEntityTarget(
      target.entityId,
      normalized.entityKind,
      context
    );
    return exact.disposition === "preserved"
      ? {
          disposition: "preserved",
          target: cloneStoredPointTarget(target, normalized),
          normalizedTarget: { ...normalized }
        }
      : { disposition: "invalid", reason: "point-target-replaced" };
  }

  const continuation = context.endpointProvenance.get(
    createSketchPointTargetProvenanceKey(target)
  );
  if (!continuation) {
    return {
      disposition: "invalid",
      reason: "endpoint-provenance-missing"
    };
  }
  if (
    (continuation.role !== "start" && continuation.role !== "end") ||
    (continuation.entityKind !== "line" && continuation.entityKind !== "arc") ||
    context.resultEntityKinds.get(continuation.entityId) !==
      continuation.entityKind
  ) {
    return {
      disposition: "invalid",
      reason: "endpoint-provenance-target-invalid"
    };
  }
  if (
    continuation.entityId === replacement.sourceEntityId &&
    (replacement.disposition !== "modified" ||
      replacement.preservedResultEntityId !== replacement.sourceEntityId)
  ) {
    return {
      disposition: "invalid",
      reason: "endpoint-provenance-target-invalid"
    };
  }
  if (continuation.entityKind !== normalized.entityKind) {
    return { disposition: "invalid", reason: "endpoint-kind-changed" };
  }
  if (!replacement.resultEntityIds.includes(continuation.entityId)) {
    return {
      disposition: "invalid",
      reason: "endpoint-provenance-outside-replacement"
    };
  }
  const normalizedTarget: SketchPointTargetV22 = {
    entityId: continuation.entityId,
    entityKind: continuation.entityKind,
    role: continuation.role
  };
  const storedTarget = cloneStoredPointTarget(target, normalizedTarget);
  return {
    disposition: pointTargetsEqual(normalized, normalizedTarget)
      ? "preserved"
      : "retargeted",
    target: storedTarget,
    normalizedTarget
  };
}

function exactPointTarget(
  target: SketchPointTarget,
  context: TargetContext
): ExactEntityTargetResult {
  const normalized = normalizePointTarget(target, context.sourceEntityKinds);
  if (!normalized) {
    return { disposition: "invalid", reason: "source-kind-mismatch" };
  }
  const exact = exactEntityTarget(
    normalized.entityId,
    normalized.entityKind,
    context
  );
  if (
    exact.disposition === "invalid" ||
    !context.replacements.has(normalized.entityId) ||
    (normalized.role !== "start" && normalized.role !== "end")
  ) {
    return exact;
  }
  const continuation = context.endpointProvenance.get(
    createSketchPointTargetProvenanceKey(normalized)
  );
  if (!continuation) {
    return {
      disposition: "invalid",
      reason: "endpoint-provenance-missing"
    };
  }
  return continuation.entityId === normalized.entityId &&
    continuation.entityKind === normalized.entityKind &&
    continuation.role === normalized.role
    ? { disposition: "preserved" }
    : { disposition: "invalid", reason: "point-target-replaced" };
}

function exactEntityTarget(
  entityId: SketchEntityId,
  expectedKind: SketchEntityKind,
  context: TargetContext
): ExactEntityTargetResult {
  const sourceKind = context.sourceEntityKinds.get(entityId);
  if (sourceKind !== expectedKind) {
    return { disposition: "invalid", reason: "source-kind-mismatch" };
  }
  const replacement = context.replacements.get(entityId);
  if (!replacement) {
    return { disposition: "preserved" };
  }
  if (
    replacement.disposition !== "modified" ||
    replacement.preservedResultEntityId !== entityId ||
    !replacement.resultEntityIds.includes(entityId)
  ) {
    return { disposition: "invalid", reason: "curve-wide-target-replaced" };
  }
  const resultKind = context.resultEntityKinds.get(entityId);
  if (resultKind === undefined) {
    return { disposition: "invalid", reason: "target-missing" };
  }
  return resultKind === expectedKind
    ? { disposition: "preserved" }
    : { disposition: "invalid", reason: "target-kind-changed" };
}

function exactConstraintResult(
  before: SketchConstraintSnapshot,
  exact: ExactEntityTargetResult
): SketchCurveEditConstraintTargetResult {
  return exact.disposition === "preserved"
    ? { disposition: "preserved", before, after: before }
    : { disposition: "invalid", before, reason: exact.reason };
}

function exactConstraintResults(
  before: SketchConstraintSnapshot,
  results: readonly ExactEntityTargetResult[]
): SketchCurveEditConstraintTargetResult {
  const invalid = results.find((result) => result.disposition === "invalid");
  return exactConstraintResult(before, invalid ?? { disposition: "preserved" });
}

function exactDimensionResult(
  before: SketchDimensionSnapshotV22,
  exact: ExactEntityTargetResult
): SketchCurveEditDimensionTargetResult {
  return exact.disposition === "preserved"
    ? { disposition: "preserved", before, after: before }
    : { disposition: "invalid", before, reason: exact.reason };
}

function exactDimensionResults(
  before: SketchDimensionSnapshotV22,
  results: readonly ExactEntityTargetResult[]
): SketchCurveEditDimensionTargetResult {
  const invalid = results.find((result) => result.disposition === "invalid");
  return exactDimensionResult(before, invalid ?? { disposition: "preserved" });
}

function normalizePointTarget(
  target: SketchPointTargetInput,
  kinds: ReadonlyMap<SketchEntityId, SketchEntityKind>
): SketchPointTargetV22 | undefined {
  const indexedKind = kinds.get(target.entityId);
  if (
    target.entityKind !== undefined &&
    indexedKind !== undefined &&
    target.entityKind !== indexedKind
  ) {
    return undefined;
  }
  const kind = target.entityKind ?? indexedKind;
  switch (target.role) {
    case "position":
      return kind === "point"
        ? { entityId: target.entityId, entityKind: "point", role: "position" }
        : undefined;
    case "start":
    case "end":
      return kind === "line" || kind === "arc"
        ? { entityId: target.entityId, entityKind: kind, role: target.role }
        : undefined;
    case "center":
      return kind === "rectangle" || kind === "circle" || kind === "arc"
        ? { entityId: target.entityId, entityKind: kind, role: "center" }
        : undefined;
  }
}

function cloneStoredPointTarget(
  source: SketchPointTargetInput,
  normalized: SketchPointTargetV22
): SketchPointTarget {
  if (source.entityKind !== undefined || normalized.entityKind === "arc") {
    return { ...normalized } as SketchPointTarget;
  }
  return {
    entityId: normalized.entityId,
    role: normalized.role
  } as SketchPointTarget;
}

function pointTargetsEqual(
  left: SketchPointTargetV22,
  right: SketchPointTargetV22
): boolean {
  return (
    left.entityId === right.entityId &&
    left.entityKind === right.entityKind &&
    left.role === right.role
  );
}

function cloneNormalizedConstraint(
  constraint: SketchConstraintSnapshot
): SketchConstraintSnapshot {
  switch (constraint.kind) {
    case "horizontal":
    case "vertical":
      return { ...constraint, entityId: constraint.entityId };
    case "fixed":
      return {
        ...constraint,
        entityId: constraint.target.entityId,
        target: { ...constraint.target },
        coordinate: [constraint.coordinate[0], constraint.coordinate[1]]
      };
    case "coincident":
      return {
        ...constraint,
        entityId: constraint.primaryTarget.entityId,
        primaryTarget: { ...constraint.primaryTarget },
        secondaryTarget: { ...constraint.secondaryTarget }
      };
    case "midpoint":
      return {
        ...constraint,
        entityId: constraint.lineEntityId,
        target: { ...constraint.target }
      };
    case "parallel":
    case "perpendicular":
    case "equalLength":
    case "angle":
      return {
        ...constraint,
        entityId: constraint.secondaryLineEntityId
      };
    case "tangent":
    case "concentric":
    case "equalRadius":
      return {
        ...constraint,
        entityId: constraint.secondaryTarget.entityId,
        primaryTarget: { ...constraint.primaryTarget },
        secondaryTarget: { ...constraint.secondaryTarget }
      } as SketchConstraintSnapshot;
    case "symmetry":
      return {
        ...constraint,
        entityId: constraint.secondaryTarget.entityId,
        primaryTarget: { ...constraint.primaryTarget },
        secondaryTarget: { ...constraint.secondaryTarget }
      };
  }
}
