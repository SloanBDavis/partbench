import type {
  CurrentSketchConstraintKind,
  SketchConstraintEntry,
  SketchEntityId,
  SketchEntitySnapshot
} from "@web-cad/cad-protocol";
import type { SketchConstraintForm } from "./cadCommands";

type InferableConstraintKind =
  | "horizontal"
  | "vertical"
  | "parallel"
  | "perpendicular";

export interface SketchConstraintInferenceCandidate {
  readonly id: string;
  readonly kind: InferableConstraintKind;
  readonly label: string;
  readonly detail: string;
  readonly confidence: "strong";
  readonly relatedEntityIds: readonly SketchEntityId[];
  readonly form: SketchConstraintForm;
}

export interface SketchConstraintInferenceInput {
  readonly entity: SketchEntitySnapshot | undefined;
  readonly sketchEntities: readonly SketchEntitySnapshot[];
  readonly constraints: readonly SketchConstraintEntry[];
  readonly angleToleranceDegrees?: number;
  readonly maxCandidates?: number;
}

const DEFAULT_ANGLE_TOLERANCE_DEGREES = 3;
const DEFAULT_MAX_CANDIDATES = 3;
const MIN_LINE_LENGTH = 1e-9;

const CONSTRAINT_LABELS: Record<InferableConstraintKind, string> = {
  horizontal: "Horizontal",
  vertical: "Vertical",
  parallel: "Parallel",
  perpendicular: "Perpendicular"
};

export function createSketchConstraintInferenceCandidates({
  entity,
  sketchEntities,
  constraints,
  angleToleranceDegrees = DEFAULT_ANGLE_TOLERANCE_DEGREES,
  maxCandidates = DEFAULT_MAX_CANDIDATES
}: SketchConstraintInferenceInput): readonly SketchConstraintInferenceCandidate[] {
  if (entity?.kind !== "line" || getLineLength(entity) <= MIN_LINE_LENGTH) {
    return [];
  }

  const tolerance = Math.max(0, angleToleranceDegrees);
  const candidates: SketchConstraintInferenceCandidate[] = [];
  const axisCandidate = createAxisCandidate(entity, constraints, tolerance);
  if (axisCandidate) {
    candidates.push(axisCandidate);
  }

  for (const other of sketchEntities) {
    if (candidates.length >= maxCandidates) {
      break;
    }

    if (
      other.kind !== "line" ||
      other.id === entity.id ||
      getLineLength(other) <= MIN_LINE_LENGTH
    ) {
      continue;
    }

    const pairCandidate = createLinePairCandidate(
      entity,
      other,
      constraints,
      tolerance
    );
    if (pairCandidate) {
      candidates.push(pairCandidate);
    }
  }

  return candidates;
}

function createAxisCandidate(
  line: Extract<SketchEntitySnapshot, { readonly kind: "line" }>,
  constraints: readonly SketchConstraintEntry[],
  toleranceDegrees: number
): SketchConstraintInferenceCandidate | undefined {
  const angle = Math.abs(normalizeAngleDegrees(lineAngleDegrees(line)));
  const horizontalDelta = Math.min(angle, Math.abs(180 - angle));
  const verticalDelta = Math.abs(90 - angle);

  if (
    horizontalDelta <= toleranceDegrees &&
    !hasEntityKindConstraint(line.id, "horizontal", constraints)
  ) {
    return buildCandidate({
      kind: "horizontal",
      primaryEntityId: line.id,
      detail: `Line is ${formatDegrees(horizontalDelta)} from horizontal.`,
      relatedEntityIds: [line.id]
    });
  }

  if (
    verticalDelta <= toleranceDegrees &&
    !hasEntityKindConstraint(line.id, "vertical", constraints)
  ) {
    return buildCandidate({
      kind: "vertical",
      primaryEntityId: line.id,
      detail: `Line is ${formatDegrees(verticalDelta)} from vertical.`,
      relatedEntityIds: [line.id]
    });
  }

  return undefined;
}

function createLinePairCandidate(
  primary: Extract<SketchEntitySnapshot, { readonly kind: "line" }>,
  secondary: Extract<SketchEntitySnapshot, { readonly kind: "line" }>,
  constraints: readonly SketchConstraintEntry[],
  toleranceDegrees: number
): SketchConstraintInferenceCandidate | undefined {
  if (hasLinePairConstraint(primary.id, secondary.id, constraints)) {
    return undefined;
  }

  const difference = lineAngleDifferenceDegrees(primary, secondary);

  if (difference <= toleranceDegrees) {
    return buildCandidate({
      kind: "parallel",
      primaryEntityId: primary.id,
      secondaryEntityId: secondary.id,
      detail: `${secondary.id} is ${formatDegrees(difference)} from parallel.`,
      relatedEntityIds: [primary.id, secondary.id]
    });
  }

  const perpendicularDelta = Math.abs(90 - difference);
  if (perpendicularDelta <= toleranceDegrees) {
    return buildCandidate({
      kind: "perpendicular",
      primaryEntityId: primary.id,
      secondaryEntityId: secondary.id,
      detail: `${secondary.id} is ${formatDegrees(perpendicularDelta)} from perpendicular.`,
      relatedEntityIds: [primary.id, secondary.id]
    });
  }

  return undefined;
}

function buildCandidate({
  kind,
  primaryEntityId,
  secondaryEntityId = "",
  detail,
  relatedEntityIds
}: {
  readonly kind: InferableConstraintKind;
  readonly primaryEntityId: SketchEntityId;
  readonly secondaryEntityId?: SketchEntityId | "";
  readonly detail: string;
  readonly relatedEntityIds: readonly SketchEntityId[];
}): SketchConstraintInferenceCandidate {
  const label = CONSTRAINT_LABELS[kind];

  return {
    id: ["constraint-inference", kind, primaryEntityId, secondaryEntityId]
      .filter(Boolean)
      .join(":"),
    kind,
    label,
    detail,
    confidence: "strong",
    relatedEntityIds,
    form: {
      id: "",
      name: label,
      kind,
      targetRole: "start",
      coordinateMode: "current",
      coordinateX: 0,
      coordinateY: 0,
      secondaryEntityId,
      secondaryTargetRole: "start"
    }
  };
}

function hasEntityKindConstraint(
  entityId: SketchEntityId,
  kind: CurrentSketchConstraintKind,
  constraints: readonly SketchConstraintEntry[]
): boolean {
  return constraints.some(
    (constraint) =>
      constraint.kind === kind &&
      "entityId" in constraint &&
      constraint.entityId === entityId
  );
}

function hasLinePairConstraint(
  primaryLineEntityId: SketchEntityId,
  secondaryLineEntityId: SketchEntityId,
  constraints: readonly SketchConstraintEntry[]
): boolean {
  return constraints.some(
    (constraint) =>
      (constraint.kind === "parallel" || constraint.kind === "perpendicular") &&
      constraint.primaryLineEntityId === primaryLineEntityId &&
      constraint.secondaryLineEntityId === secondaryLineEntityId
  );
}

function getLineLength(
  line: Extract<SketchEntitySnapshot, { readonly kind: "line" }>
): number {
  const dx = line.end[0] - line.start[0];
  const dy = line.end[1] - line.start[1];
  return Math.hypot(dx, dy);
}

function lineAngleDegrees(
  line: Extract<SketchEntitySnapshot, { readonly kind: "line" }>
): number {
  return (
    (Math.atan2(line.end[1] - line.start[1], line.end[0] - line.start[0]) *
      180) /
    Math.PI
  );
}

function lineAngleDifferenceDegrees(
  first: Extract<SketchEntitySnapshot, { readonly kind: "line" }>,
  second: Extract<SketchEntitySnapshot, { readonly kind: "line" }>
): number {
  const raw = Math.abs(
    normalizeAngleDegrees(lineAngleDegrees(first) - lineAngleDegrees(second))
  );
  return Math.min(raw, 180 - raw);
}

function normalizeAngleDegrees(angle: number): number {
  return ((angle % 180) + 180) % 180;
}

function formatDegrees(value: number): string {
  if (value < 0.01) {
    return "0 degrees";
  }

  return `${Number(value.toFixed(2))} degrees`;
}
