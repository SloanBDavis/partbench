import type {
  CadSketchSolverStatus,
  SketchConstraintId,
  SketchDimensionId,
  SketchDimensionStatus,
  SketchEntitySnapshot,
  SketchId,
  WcadSourceIdentity
} from "@web-cad/cad-protocol";
import { encodeCanonicalCbor } from "./canonicalCbor";
import { normalizeSketchArcStartAngleDegrees } from "./sketchArcMath";
import { cleanSketchNumber } from "./sketchNumber";
import { SHA256_HEX_PATTERN, sha256Hex } from "./sha256";

export const SKETCH_CURVE_EDIT_SOURCE_REVISION_ALGORITHM =
  "partbench-source-v1";
export const SKETCH_SOLVER_EVALUATION_IDENTITY_ALGORITHM =
  "partbench-sketch-solver-evaluation-v1";
export const NO_SKETCH_SOLVER_EVALUATION_IDENTITY = "none";

export type SketchCurveEditSourceRevision =
  `${typeof SKETCH_CURVE_EDIT_SOURCE_REVISION_ALGORITHM}:${string}`;
export type HashedSketchSolverEvaluationIdentity =
  `${typeof SKETCH_SOLVER_EVALUATION_IDENTITY_ALGORITHM}:${string}`;
export type SketchSolverEvaluationIdentity =
  | typeof NO_SKETCH_SOLVER_EVALUATION_IDENTITY
  | HashedSketchSolverEvaluationIdentity;

export interface SketchSolverConstraintResidualEvidence {
  readonly id: SketchConstraintId;
  /** A stable solver family name, canonicalized to lowercase kebab case. */
  readonly family: string;
  readonly status: SketchDimensionStatus;
  readonly residual: number;
}

export interface SketchSolverDimensionResidualEvidence {
  readonly id: SketchDimensionId;
  /** A stable solver family name, canonicalized to lowercase kebab case. */
  readonly family: string;
  readonly status: SketchDimensionStatus;
  readonly residual: number;
}

export type SketchSolverIdentityRecordCollection<
  T extends { readonly id: string }
> = readonly T[] | ReadonlyMap<string, T>;

export interface SketchSolverEvaluationIdentityEvidence {
  readonly sourceRevision: SketchCurveEditSourceRevision;
  readonly sketchId: SketchId;
  readonly solverStatus: CadSketchSolverStatus;
  /** Authoritative constraint plus dimension record count for this sketch. */
  readonly solverRecordCount: number;
  readonly evaluatedEntities: SketchSolverIdentityRecordCollection<SketchEntitySnapshot>;
  readonly orderedConstraintResiduals: SketchSolverIdentityRecordCollection<SketchSolverConstraintResidualEvidence>;
  readonly orderedDimensionResiduals: SketchSolverIdentityRecordCollection<SketchSolverDimensionResidualEvidence>;
}

export interface CanonicalSketchSolverResidualEvidence {
  readonly id: string;
  readonly family: string;
  readonly status: SketchDimensionStatus;
  readonly residual: number;
}

export interface CanonicalSketchSolverEvaluationPayload {
  readonly sourceRevision: SketchCurveEditSourceRevision;
  readonly sketchId: SketchId;
  readonly solverStatus: CadSketchSolverStatus;
  readonly evaluatedEntities: readonly SketchEntitySnapshot[];
  readonly orderedConstraintResiduals: readonly CanonicalSketchSolverResidualEvidence[];
  readonly orderedDimensionResiduals: readonly CanonicalSketchSolverResidualEvidence[];
}

const SOURCE_REVISION_PATTERN = /^partbench-source-v1:[0-9a-f]{64}$/;
const SOLVER_EVALUATION_IDENTITY_PATTERN =
  /^partbench-sketch-solver-evaluation-v1:[0-9a-f]{64}$/;
const RESIDUAL_FAMILY_INPUT_PATTERN = /^[A-Za-z][A-Za-z0-9._ -]*$/;

const SKETCH_SOLVER_STATUSES = new Set<CadSketchSolverStatus>([
  "not-run",
  "solved",
  "fully-defined",
  "under-defined",
  "over-defined",
  "conflicting",
  "redundant",
  "failed",
  "unsupported",
  "missing-target"
]);

const SKETCH_RESIDUAL_STATUSES = new Set<SketchDimensionStatus>([
  "healthy",
  "under-defined",
  "over-defined",
  "unsupported",
  "missing-target",
  "invalid-value",
  "inconsistent"
]);

export function isSketchCurveEditSourceRevision(
  value: unknown
): value is SketchCurveEditSourceRevision {
  return typeof value === "string" && SOURCE_REVISION_PATTERN.test(value);
}

export function isHashedSketchSolverEvaluationIdentity(
  value: unknown
): value is HashedSketchSolverEvaluationIdentity {
  return (
    typeof value === "string" && SOLVER_EVALUATION_IDENTITY_PATTERN.test(value)
  );
}

export function isSketchSolverEvaluationIdentity(
  value: unknown
): value is SketchSolverEvaluationIdentity {
  return (
    value === NO_SKETCH_SOLVER_EVALUATION_IDENTITY ||
    isHashedSketchSolverEvaluationIdentity(value)
  );
}

/**
 * Formats the command precondition from the authoritative project source
 * identity. The digest must already have been computed by the WCAD
 * canonical-CBOR source-identity algorithm.
 */
export function createSketchCurveEditSourceRevision(
  sourceIdentity: Pick<WcadSourceIdentity, "algorithm" | "sha256">
): SketchCurveEditSourceRevision {
  if (
    sourceIdentity.algorithm !== SKETCH_CURVE_EDIT_SOURCE_REVISION_ALGORITHM
  ) {
    throw new TypeError(
      `Sketch source identity algorithm must be ${SKETCH_CURVE_EDIT_SOURCE_REVISION_ALGORITHM}.`
    );
  }
  if (!SHA256_HEX_PATTERN.test(sourceIdentity.sha256)) {
    throw new TypeError(
      "Sketch source identity digest must be a lowercase SHA-256 hex string."
    );
  }
  return `${SKETCH_CURVE_EDIT_SOURCE_REVISION_ALGORITHM}:${sourceIdentity.sha256}`;
}

export function normalizeSketchSolverResidualFamily(family: string): string {
  if (
    family.length === 0 ||
    family !== family.trim() ||
    !RESIDUAL_FAMILY_INPUT_PATTERN.test(family)
  ) {
    throw new TypeError(
      "Sketch solver residual family must be a non-empty identifier."
    );
  }

  return family
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[ _]+/g, "-")
    .toLowerCase();
}

export function createCanonicalSketchSolverEvaluationPayload(
  evidence: SketchSolverEvaluationIdentityEvidence
): CanonicalSketchSolverEvaluationPayload {
  if (!isSketchCurveEditSourceRevision(evidence.sourceRevision)) {
    throw new TypeError(
      "Sketch solver evidence sourceRevision must be a canonical Partbench source revision."
    );
  }
  assertNonEmptyId(evidence.sketchId, "Sketch solver evidence sketchId");
  if (!SKETCH_SOLVER_STATUSES.has(evidence.solverStatus)) {
    throw new TypeError("Sketch solver evidence has an invalid solverStatus.");
  }

  const evaluatedEntities = sortUniqueRecords(
    readRecordCollection(evidence.evaluatedEntities, "evaluated entity"),
    "evaluated entity"
  ).map(canonicalizeEvaluatedEntity);
  const orderedConstraintResiduals = canonicalizeResiduals(
    evidence.orderedConstraintResiduals,
    "constraint residual"
  );
  const orderedDimensionResiduals = canonicalizeResiduals(
    evidence.orderedDimensionResiduals,
    "dimension residual"
  );
  const residualRecordCount =
    orderedConstraintResiduals.length + orderedDimensionResiduals.length;
  if (
    !Number.isSafeInteger(evidence.solverRecordCount) ||
    evidence.solverRecordCount < 0 ||
    evidence.solverRecordCount !== residualRecordCount
  ) {
    throw new TypeError(
      "Sketch solver evidence solverRecordCount must equal its constraint and dimension residual record count."
    );
  }

  if (
    evidence.solverRecordCount > 0 ===
    (evidence.solverStatus === "not-run")
  ) {
    throw new TypeError(
      evidence.solverRecordCount > 0
        ? "Sketch solver evidence with solver records cannot have not-run status."
        : "Sketch solver evidence without solver records must have not-run status."
    );
  }

  return {
    sourceRevision: evidence.sourceRevision,
    sketchId: evidence.sketchId,
    solverStatus: evidence.solverStatus,
    evaluatedEntities,
    orderedConstraintResiduals,
    orderedDimensionResiduals
  };
}

export function createSketchSolverEvaluationIdentity(
  evidence: SketchSolverEvaluationIdentityEvidence
): SketchSolverEvaluationIdentity {
  const canonical = createCanonicalSketchSolverEvaluationPayload(evidence);
  if (evidence.solverRecordCount === 0) {
    return NO_SKETCH_SOLVER_EVALUATION_IDENTITY;
  }

  return `${SKETCH_SOLVER_EVALUATION_IDENTITY_ALGORITHM}:${sha256Hex(
    encodeCanonicalCbor(canonical)
  )}`;
}

function canonicalizeResiduals<T extends { readonly id: string }>(
  collection: SketchSolverIdentityRecordCollection<T>,
  label: string
): readonly CanonicalSketchSolverResidualEvidence[] {
  return sortUniqueRecords(readRecordCollection(collection, label), label).map(
    (record) => {
      const evidence = record as T &
        Pick<
          CanonicalSketchSolverResidualEvidence,
          "family" | "status" | "residual"
        >;
      if (typeof evidence.family !== "string") {
        throw new TypeError(`${label} family must be a string.`);
      }
      if (!SKETCH_RESIDUAL_STATUSES.has(evidence.status)) {
        throw new TypeError(`${label} has an invalid status.`);
      }
      return {
        id: evidence.id,
        family: normalizeSketchSolverResidualFamily(evidence.family),
        status: evidence.status,
        residual: normalizeFiniteNumber(evidence.residual, `${label} residual`)
      };
    }
  );
}

function canonicalizeEvaluatedEntity(
  entity: SketchEntitySnapshot
): SketchEntitySnapshot {
  assertNonEmptyId(entity.id, "Evaluated entity id");
  if (typeof entity.construction !== "boolean") {
    throw new TypeError("Evaluated entity construction must be boolean.");
  }

  switch (entity.kind) {
    case "point":
      return {
        id: entity.id,
        kind: entity.kind,
        point: normalizeVec2(entity.point, `Evaluated point ${entity.id}`),
        construction: entity.construction
      };
    case "line":
      return {
        id: entity.id,
        kind: entity.kind,
        start: normalizeVec2(entity.start, `Evaluated line ${entity.id} start`),
        end: normalizeVec2(entity.end, `Evaluated line ${entity.id} end`),
        construction: entity.construction
      };
    case "rectangle":
      return {
        id: entity.id,
        kind: entity.kind,
        center: normalizeVec2(
          entity.center,
          `Evaluated rectangle ${entity.id} center`
        ),
        width: normalizePositiveNumber(
          entity.width,
          `Evaluated rectangle ${entity.id} width`
        ),
        height: normalizePositiveNumber(
          entity.height,
          `Evaluated rectangle ${entity.id} height`
        ),
        construction: entity.construction
      };
    case "circle":
      return {
        id: entity.id,
        kind: entity.kind,
        center: normalizeVec2(
          entity.center,
          `Evaluated circle ${entity.id} center`
        ),
        radius: normalizePositiveNumber(
          entity.radius,
          `Evaluated circle ${entity.id} radius`
        ),
        construction: entity.construction
      };
    case "arc": {
      const startAngleDegrees = normalizeSketchArcStartAngleDegrees(
        normalizeFiniteNumber(
          entity.startAngleDegrees,
          `Evaluated arc ${entity.id} start angle`
        )
      );
      const sweepAngleDegrees = normalizeFiniteNumber(
        entity.sweepAngleDegrees,
        `Evaluated arc ${entity.id} sweep angle`
      );
      if (sweepAngleDegrees === 0 || Math.abs(sweepAngleDegrees) >= 360) {
        throw new TypeError(
          `Evaluated arc ${entity.id} sweep angle must be non-zero and less than 360 degrees in magnitude.`
        );
      }
      return {
        id: entity.id,
        kind: entity.kind,
        center: normalizeVec2(
          entity.center,
          `Evaluated arc ${entity.id} center`
        ),
        radius: normalizePositiveNumber(
          entity.radius,
          `Evaluated arc ${entity.id} radius`
        ),
        startAngleDegrees,
        sweepAngleDegrees,
        construction: entity.construction
      };
    }
    default:
      throw new TypeError("Evaluated entity kind is unsupported.");
  }
}

function readRecordCollection<T extends { readonly id: string }>(
  collection: SketchSolverIdentityRecordCollection<T>,
  label: string
): readonly T[] {
  if (Array.isArray(collection)) {
    return collection;
  }
  if (!(collection instanceof Map)) {
    throw new TypeError(`${label} collection must be an array or Map.`);
  }

  return [...collection.entries()].map(([key, value]) => {
    if (key !== value.id) {
      throw new TypeError(`${label} Map key must match its record id.`);
    }
    return value;
  });
}

function sortUniqueRecords<T extends { readonly id: string }>(
  records: readonly T[],
  label: string
): readonly T[] {
  const sorted = [...records].sort((left, right) =>
    compareIds(left.id, right.id)
  );
  let previousId: string | undefined;
  for (const record of sorted) {
    assertNonEmptyId(record.id, `${label} id`);
    if (record.id === previousId) {
      throw new TypeError(`${label} ids must be unique.`);
    }
    previousId = record.id;
  }
  return sorted;
}

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function normalizeVec2(
  value: readonly [number, number],
  label: string
): readonly [number, number] {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new TypeError(`${label} must contain exactly two coordinates.`);
  }
  return [
    normalizeFiniteNumber(value[0], `${label} x`),
    normalizeFiniteNumber(value[1], `${label} y`)
  ];
}

function normalizePositiveNumber(value: number, label: string): number {
  const normalized = normalizeFiniteNumber(value, label);
  if (normalized <= 0) {
    throw new TypeError(`${label} must be positive.`);
  }
  return normalized;
}

function normalizeFiniteNumber(value: number, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${label} must be finite.`);
  }
  return cleanSketchNumber(value);
}

function assertNonEmptyId(value: string, label: string): void {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string.`);
  }
}
