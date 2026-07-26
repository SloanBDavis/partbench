import type {
  SketchArcEntity,
  SketchCircleEntitySnapshot,
  SketchEntityId,
  SketchEntityReplacement,
  SketchEntitySnapshot,
  SketchLineEntitySnapshot,
  SketchRectangleEntitySnapshot,
  Vec2
} from "@web-cad/cad-protocol";

import {
  collapseSketchCurveParameters,
  intersectFiniteSketchCurves,
  intersectSketchCurveSupportWithFiniteCurve,
  projectPointToFiniteSketchCurve,
  resolveSketchCurveEditEntity,
  type ResolvedSketchCurve,
  type ResolvedSketchCurveArc,
  type ResolvedSketchCurveLine,
  type SketchCurveEditEntity,
  type SketchCurveGeometryDiagnostic
} from "./sketchCurveEditGeometry";
import {
  SKETCH_GEOMETRY_POLICY,
  type SketchGeometryPolicy
} from "./sketchGeometryPolicy";

const FULL_TURN_DEGREES = 360;
const RADIANS_PER_DEGREE = Math.PI / 180;

type PlannedCurveShape =
  | Omit<SketchLineEntitySnapshot, "id">
  | Omit<SketchCircleEntitySnapshot, "id">
  | Omit<SketchArcEntity, "id">;

export type SketchCurveEditPlanDiagnosticCode =
  | "SKETCH_EDIT_TARGET_UNSUPPORTED"
  | "SKETCH_EDIT_BOUNDARY_MISSING"
  | "SKETCH_EDIT_BOUNDARY_UNSUPPORTED"
  | "SKETCH_EDIT_INTERSECTION_MISSING"
  | "SKETCH_EDIT_INTERSECTION_AMBIGUOUS"
  | "SKETCH_EDIT_PICK_OFF_CURVE"
  | "SKETCH_EDIT_ZERO_LENGTH_RESULT"
  | "SKETCH_EDIT_SPLIT_POINT_INVALID"
  | "SKETCH_EDIT_OUTPUT_ID_COUNT_MISMATCH"
  | "SKETCH_EDIT_OUTPUT_ID_CONFLICT"
  | "SKETCH_EDIT_GEOMETRY_INVALID";

export interface SketchCurveEditPlanDiagnostic {
  readonly code: SketchCurveEditPlanDiagnosticCode;
  readonly entityIds: readonly SketchEntityId[];
  readonly path: string;
  readonly message: string;
  readonly expected?: string;
  readonly received?: string;
  readonly geometryDiagnostics?: readonly SketchCurveGeometryDiagnostic[];
}

export interface SketchCurveEndpointProvenance {
  /**
   * Authored traversal parameter on the source curve. Line parameters are
   * distances from start, arc parameters are positive traversal degrees, and
   * circle parameters are canonical polar degrees.
   */
  readonly sourceParameter: number;
  /**
   * Present only when the result endpoint owns the continuing authored
   * endpoint intent. Extend deliberately assigns this to the moved endpoint.
   */
  readonly sourceEndpoint?: "start" | "end";
  readonly cause:
    | "source-endpoint"
    | "intersection"
    | "split"
    | "extension"
    | "rectangle-corner";
  readonly boundaryEntityId?: SketchEntityId;
}

export interface SketchCurveSourceInterval {
  readonly startParameter: number;
  readonly endParameter: number;
  readonly cyclic: boolean;
}

export type PlannedSketchEntityId =
  | {
      readonly kind: "preserved";
      readonly entityId: SketchEntityId;
    }
  | {
      readonly kind: "created";
      readonly createdIndex: number;
      readonly entityId?: SketchEntityId;
    };

export interface PlannedSketchCurvePiece {
  readonly id: PlannedSketchEntityId;
  readonly shape: PlannedCurveShape;
  readonly sourceInterval: SketchCurveSourceInterval;
  readonly endpointProvenance: {
    readonly start: SketchCurveEndpointProvenance;
    readonly end: SketchCurveEndpointProvenance;
  };
}

export interface SketchCurveEditReplacementPlan {
  readonly sourceEntityId: SketchEntityId;
  readonly disposition: "modified" | "deleted";
  readonly resultIds: readonly PlannedSketchEntityId[];
  readonly preservedResultEntityId?: SketchEntityId;
}

export interface SketchCurveEditIntersectionEvidence {
  readonly boundaryEntityId: SketchEntityId;
  readonly point: Vec2;
  readonly targetParameter: number;
}

export interface SketchCurveEditPlan {
  readonly operation: "trim" | "extend" | "split" | "explodeRectangle";
  readonly sourceEntityId: SketchEntityId;
  readonly resultEntityCount: number;
  readonly requiredCreatedEntityIdCount: number;
  readonly pieces: readonly PlannedSketchCurvePiece[];
  readonly replacement: SketchCurveEditReplacementPlan;
  /**
   * Complete normalized finite intersection evidence used by readiness
   * previews. Trim retains every eligible target/boundary partition hit and
   * extend retains the nearest command-selectable outward hit for each exact
   * boundary ID at the selected endpoint. It is preview-only evidence and does
   * not change the selected edit result.
   */
  readonly previewIntersections?: readonly SketchCurveEditIntersectionEvidence[];
  /**
   * Present when all created IDs were supplied, or when the plan creates no
   * entities. Readiness can first inspect requiredCreatedEntityIdCount without
   * consuming an allocator and then re-plan with the exact prospective IDs.
   */
  readonly materialized?: {
    readonly entities: readonly (
      | SketchLineEntitySnapshot
      | SketchCircleEntitySnapshot
      | SketchArcEntity
    )[];
    readonly replacement: SketchEntityReplacement;
  };
}

export type SketchCurveEditPlanResult =
  | {
      readonly status: "ready";
      readonly plan: SketchCurveEditPlan;
      readonly diagnostics: readonly [];
    }
  | {
      readonly status: "blocked";
      readonly diagnostics: readonly SketchCurveEditPlanDiagnostic[];
      /**
       * Complete evidence when planning reached deterministic intersections
       * before a later readiness condition blocked materialization.
       */
      readonly previewIntersections?: readonly SketchCurveEditIntersectionEvidence[];
    };

interface PlanContext {
  readonly entities: readonly SketchEntitySnapshot[];
  readonly entityById: ReadonlyMap<SketchEntityId, SketchEntitySnapshot>;
  readonly policy: SketchGeometryPolicy;
}

interface IntervalDraft {
  readonly startParameter: number;
  readonly endParameter: number;
  readonly startProvenanceParameter?: number;
  readonly endProvenanceParameter?: number;
  readonly cyclic?: boolean;
  readonly startCause: SketchCurveEndpointProvenance["cause"];
  readonly endCause: SketchCurveEndpointProvenance["cause"];
  readonly startSourceEndpoint?: "start" | "end";
  readonly endSourceEndpoint?: "start" | "end";
  readonly startBoundaryEntityId?: SketchEntityId;
  readonly endBoundaryEntityId?: SketchEntityId;
}

function canonicalZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

function compareEntityIds(left: SketchEntityId, right: SketchEntityId): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function point(x: number, y: number): Vec2 {
  return [canonicalZero(x), canonicalZero(y)];
}

function distance(left: Vec2, right: Vec2): number {
  return Math.hypot(left[0] - right[0], left[1] - right[1]);
}

function normalizeDegrees(value: number): number {
  return canonicalZero(
    ((value % FULL_TURN_DEGREES) + FULL_TURN_DEGREES) % FULL_TURN_DEGREES
  );
}

function pointAtCircularParameter(
  curve:
    | ResolvedSketchCurveArc
    | { readonly center: Vec2; readonly radius: number },
  polarDegrees: number
): Vec2 {
  const radians = polarDegrees * RADIANS_PER_DEGREE;
  return point(
    curve.center[0] + curve.radius * Math.cos(radians),
    curve.center[1] + curve.radius * Math.sin(radians)
  );
}

function pointAtSourceParameter(
  curve: ResolvedSketchCurve,
  parameter: number
): Vec2 {
  if (curve.kind === "line") {
    return point(
      curve.start[0] + curve.direction[0] * parameter,
      curve.start[1] + curve.direction[1] * parameter
    );
  }
  if (curve.kind === "circle") {
    return pointAtCircularParameter(curve, parameter);
  }
  return pointAtCircularParameter(
    curve,
    curve.startAngleDegrees + Math.sign(curve.sweepAngleDegrees) * parameter
  );
}

function diagnostic(
  code: SketchCurveEditPlanDiagnosticCode,
  entityIds: readonly SketchEntityId[],
  path: string,
  message: string,
  expected?: string,
  received?: string,
  geometryDiagnostics?: readonly SketchCurveGeometryDiagnostic[]
): SketchCurveEditPlanDiagnostic {
  return {
    code,
    entityIds,
    path,
    message,
    ...(expected === undefined ? {} : { expected }),
    ...(received === undefined ? {} : { received }),
    ...(geometryDiagnostics === undefined ? {} : { geometryDiagnostics })
  };
}

function blocked(
  value:
    | SketchCurveEditPlanDiagnostic
    | readonly SketchCurveEditPlanDiagnostic[],
  previewIntersections?: readonly SketchCurveEditIntersectionEvidence[]
): SketchCurveEditPlanResult {
  return {
    status: "blocked",
    diagnostics: Array.isArray(value) ? value : [value],
    ...(previewIntersections === undefined ? {} : { previewIntersections })
  };
}

function createContext(
  entities: readonly SketchEntitySnapshot[],
  policy: SketchGeometryPolicy
): PlanContext {
  return {
    entities,
    entityById: new Map(entities.map((entity) => [entity.id, entity])),
    policy
  };
}

function resolveEditable(
  context: PlanContext,
  entityId: SketchEntityId,
  permittedKinds: readonly SketchCurveEditEntity["kind"][]
):
  | {
      readonly status: "ready";
      readonly curve: ResolvedSketchCurve;
      readonly source: SketchCurveEditEntity;
    }
  | { readonly status: "blocked"; readonly result: SketchCurveEditPlanResult } {
  const entity = context.entityById.get(entityId);
  if (
    !entity ||
    !permittedKinds.includes(entity.kind as SketchCurveEditEntity["kind"])
  ) {
    return {
      status: "blocked",
      result: blocked(
        diagnostic(
          "SKETCH_EDIT_TARGET_UNSUPPORTED",
          [entityId],
          "entityId",
          entity
            ? `Entity kind '${entity.kind}' is not supported by this curve edit.`
            : "The target entity does not exist in the supplied sketch source.",
          permittedKinds.join(" | "),
          entity?.kind ?? "missing"
        )
      )
    };
  }
  const source = entity as SketchCurveEditEntity;
  const resolution = resolveSketchCurveEditEntity(source, context.policy);
  if (resolution.status === "blocked") {
    return {
      status: "blocked",
      result: blocked(
        diagnostic(
          "SKETCH_EDIT_GEOMETRY_INVALID",
          [entityId],
          "entityId",
          "The target curve does not satisfy the shared analytic policy.",
          undefined,
          undefined,
          resolution.diagnostics
        )
      )
    };
  }
  return { status: "ready", curve: resolution.curve, source };
}

function resolveBoundaries(
  context: PlanContext,
  targetEntityId: SketchEntityId,
  boundaryEntityIds: readonly SketchEntityId[]
):
  | {
      readonly status: "ready";
      readonly boundaries: readonly ResolvedSketchCurve[];
    }
  | { readonly status: "blocked"; readonly result: SketchCurveEditPlanResult } {
  if (boundaryEntityIds.length === 0) {
    return {
      status: "blocked",
      result: blocked(
        diagnostic(
          "SKETCH_EDIT_BOUNDARY_MISSING",
          [targetEntityId],
          "boundaryEntityIds",
          "At least one explicit boundary entity ID is required."
        )
      )
    };
  }
  const boundaries: ResolvedSketchCurve[] = [];
  const visited = new Set<SketchEntityId>();
  for (const [index, boundaryEntityId] of boundaryEntityIds.entries()) {
    if (visited.has(boundaryEntityId)) continue;
    visited.add(boundaryEntityId);
    if (boundaryEntityId === targetEntityId) {
      return {
        status: "blocked",
        result: blocked(
          diagnostic(
            "SKETCH_EDIT_INTERSECTION_AMBIGUOUS",
            [targetEntityId],
            `boundaryEntityIds[${index}]`,
            "The edited target cannot be its own boundary."
          )
        )
      };
    }
    const entity = context.entityById.get(boundaryEntityId);
    if (!entity) {
      return {
        status: "blocked",
        result: blocked(
          diagnostic(
            "SKETCH_EDIT_BOUNDARY_MISSING",
            [boundaryEntityId],
            `boundaryEntityIds[${index}]`,
            "The explicit boundary entity does not exist in the supplied sketch source."
          )
        )
      };
    }
    if (
      entity.kind !== "line" &&
      entity.kind !== "circle" &&
      entity.kind !== "arc"
    ) {
      return {
        status: "blocked",
        result: blocked(
          diagnostic(
            "SKETCH_EDIT_BOUNDARY_UNSUPPORTED",
            [boundaryEntityId],
            `boundaryEntityIds[${index}]`,
            "Only finite line, circle, and arc entities may be curve-edit boundaries.",
            "line | circle | arc",
            entity.kind
          )
        )
      };
    }
    const resolution = resolveSketchCurveEditEntity(entity, context.policy);
    if (resolution.status === "blocked") {
      return {
        status: "blocked",
        result: blocked(
          diagnostic(
            "SKETCH_EDIT_GEOMETRY_INVALID",
            [boundaryEntityId],
            `boundaryEntityIds[${index}]`,
            "The boundary curve does not satisfy the shared analytic policy.",
            undefined,
            undefined,
            resolution.diagnostics
          )
        )
      };
    }
    boundaries.push(resolution.curve);
  }
  return { status: "ready", boundaries };
}

function validateCreatedIds(
  context: PlanContext,
  sourceEntityId: SketchEntityId,
  requiredCount: number,
  createdEntityIds?: readonly SketchEntityId[]
): SketchCurveEditPlanResult | undefined {
  if (!createdEntityIds) return undefined;
  if (createdEntityIds.length !== requiredCount) {
    return blocked(
      diagnostic(
        "SKETCH_EDIT_OUTPUT_ID_COUNT_MISMATCH",
        [sourceEntityId],
        "createdEntityIds",
        "The provided output ID count must equal the analytic result count.",
        String(requiredCount),
        String(createdEntityIds.length)
      )
    );
  }
  const seen = new Set<SketchEntityId>();
  for (const [index, entityId] of createdEntityIds.entries()) {
    if (
      entityId.length === 0 ||
      seen.has(entityId) ||
      context.entityById.has(entityId)
    ) {
      return blocked(
        diagnostic(
          "SKETCH_EDIT_OUTPUT_ID_CONFLICT",
          [sourceEntityId, entityId],
          `createdEntityIds[${index}]`,
          "Created entity IDs must be non-empty, unique, and absent from the current sketch."
        )
      );
    }
    seen.add(entityId);
  }
  return undefined;
}

function materializePlan(
  operation: SketchCurveEditPlan["operation"],
  sourceEntityId: SketchEntityId,
  disposition: "modified" | "deleted",
  drafts: readonly {
    readonly id: PlannedSketchEntityId;
    readonly shape: PlannedCurveShape;
    readonly interval: IntervalDraft;
  }[],
  requiredCreatedEntityIdCount: number,
  previewIntersections?: readonly SketchCurveEditIntersectionEvidence[]
): SketchCurveEditPlan {
  const pieces = drafts.map<PlannedSketchCurvePiece>((draft) => ({
    id: draft.id,
    shape: draft.shape,
    sourceInterval: {
      startParameter: canonicalZero(draft.interval.startParameter),
      endParameter: canonicalZero(draft.interval.endParameter),
      cyclic: draft.interval.cyclic ?? false
    },
    endpointProvenance: {
      start: {
        sourceParameter: canonicalZero(
          draft.interval.startProvenanceParameter ??
            draft.interval.startParameter
        ),
        cause: draft.interval.startCause,
        ...(draft.interval.startSourceEndpoint === undefined
          ? {}
          : { sourceEndpoint: draft.interval.startSourceEndpoint }),
        ...(draft.interval.startBoundaryEntityId === undefined
          ? {}
          : { boundaryEntityId: draft.interval.startBoundaryEntityId })
      },
      end: {
        sourceParameter: canonicalZero(
          draft.interval.endProvenanceParameter ?? draft.interval.endParameter
        ),
        cause: draft.interval.endCause,
        ...(draft.interval.endSourceEndpoint === undefined
          ? {}
          : { sourceEndpoint: draft.interval.endSourceEndpoint }),
        ...(draft.interval.endBoundaryEntityId === undefined
          ? {}
          : { boundaryEntityId: draft.interval.endBoundaryEntityId })
      }
    }
  }));
  const allMaterialized = pieces.every(
    (piece) => piece.id.kind === "preserved" || piece.id.entityId !== undefined
  );
  const preservedResultEntityId = pieces.find(
    (piece) => piece.id.kind === "preserved"
  )?.id.entityId;
  const replacement: SketchCurveEditReplacementPlan = {
    sourceEntityId,
    disposition,
    resultIds: pieces.map((piece) => piece.id),
    ...(preservedResultEntityId === undefined
      ? {}
      : { preservedResultEntityId })
  };
  let materialized: SketchCurveEditPlan["materialized"];
  if (allMaterialized) {
    const entities = pieces.map((piece) => ({
      ...piece.shape,
      id: piece.id.kind === "preserved" ? piece.id.entityId : piece.id.entityId!
    })) as (
      | SketchLineEntitySnapshot
      | SketchCircleEntitySnapshot
      | SketchArcEntity
    )[];
    materialized = {
      entities,
      replacement: {
        sourceEntityId,
        disposition,
        resultEntityIds: entities.map((entity) => entity.id),
        ...(preservedResultEntityId === undefined
          ? {}
          : { preservedResultEntityId })
      }
    };
  }
  return {
    operation,
    sourceEntityId,
    resultEntityCount: pieces.length,
    requiredCreatedEntityIdCount,
    pieces,
    replacement,
    ...(previewIntersections === undefined ? {} : { previewIntersections }),
    materialized
  };
}

function sourceMaximum(
  curve: ResolvedSketchCurveLine | ResolvedSketchCurveArc
): number {
  return curve.kind === "line"
    ? curve.length
    : Math.abs(curve.sweepAngleDegrees);
}

function intervalShape(
  source: SketchLineEntitySnapshot | SketchArcEntity,
  curve: ResolvedSketchCurveLine | ResolvedSketchCurveArc,
  startParameter: number,
  endParameter: number
): PlannedCurveShape {
  if (curve.kind === "line") {
    return {
      kind: "line",
      start: pointAtSourceParameter(curve, startParameter),
      end: pointAtSourceParameter(curve, endParameter),
      construction: source.construction
    };
  }
  return {
    kind: "arc",
    center: point(...curve.center),
    radius: curve.radius,
    startAngleDegrees: normalizeDegrees(
      curve.startAngleDegrees +
        Math.sign(curve.sweepAngleDegrees) * startParameter
    ),
    sweepAngleDegrees: canonicalZero(
      Math.sign(curve.sweepAngleDegrees) * (endParameter - startParameter)
    ),
    construction: source.construction
  };
}

function validateInterval(
  curve: ResolvedSketchCurveLine | ResolvedSketchCurveArc,
  startParameter: number,
  endParameter: number,
  policy: SketchGeometryPolicy
): boolean {
  const span = endParameter - startParameter;
  return curve.kind === "line"
    ? span > policy.linearTolerance
    : span >= policy.angularToleranceDegrees &&
        span <= FULL_TURN_DEGREES - policy.angularToleranceDegrees;
}

function createdId(
  createdIndex: number,
  createdEntityIds?: readonly SketchEntityId[]
): PlannedSketchEntityId {
  const entityId = createdEntityIds?.[createdIndex];
  return entityId === undefined
    ? { kind: "created", createdIndex }
    : { kind: "created", createdIndex, entityId };
}

function boundaryAtParameter(
  parameter: number,
  boundaryParameters: readonly {
    readonly parameter: number;
    readonly boundaryEntityId: SketchEntityId;
  }[],
  curve: ResolvedSketchCurve,
  policy: SketchGeometryPolicy
): SketchEntityId | undefined {
  const pointAtParameter = pointAtSourceParameter(curve, parameter);
  return boundaryParameters.find(
    (candidate) =>
      distance(
        pointAtParameter,
        pointAtSourceParameter(curve, candidate.parameter)
      ) <= policy.linearTolerance
  )?.boundaryEntityId;
}

function createNormalizedIntersectionEvidence(
  target: ResolvedSketchCurve,
  candidates: readonly {
    readonly parameter: number;
    readonly boundaryEntityId: SketchEntityId;
  }[],
  normalizedParameters: readonly number[],
  policy: SketchGeometryPolicy
): readonly SketchCurveEditIntersectionEvidence[] {
  return normalizedParameters.flatMap((targetParameter) => {
    const normalizedPoint = pointAtSourceParameter(target, targetParameter);
    const boundaryEntityIds = [
      ...new Set(
        candidates
          .filter(
            (candidate) =>
              distance(
                normalizedPoint,
                pointAtSourceParameter(target, candidate.parameter)
              ) <= policy.linearTolerance
          )
          .map((candidate) => candidate.boundaryEntityId)
      )
    ].sort(compareEntityIds);
    return boundaryEntityIds.map((boundaryEntityId) => ({
      boundaryEntityId,
      point: normalizedPoint,
      targetParameter: canonicalZero(targetParameter)
    }));
  });
}

function collectFiniteBoundaryParameters(
  target: ResolvedSketchCurve,
  boundaries: readonly ResolvedSketchCurve[],
  policy: SketchGeometryPolicy
):
  | {
      readonly status: "ready";
      readonly parameters: readonly {
        readonly parameter: number;
        readonly boundaryEntityId: SketchEntityId;
      }[];
      readonly intersections: readonly SketchCurveEditIntersectionEvidence[];
    }
  | { readonly status: "blocked"; readonly result: SketchCurveEditPlanResult } {
  const candidates: {
    parameter: number;
    boundaryEntityId: SketchEntityId;
  }[] = [];
  for (const boundary of boundaries) {
    const intersection = intersectFiniteSketchCurves(target, boundary, policy);
    if (intersection.status === "blocked") {
      return {
        status: "blocked",
        result: blocked(
          diagnostic(
            "SKETCH_EDIT_INTERSECTION_AMBIGUOUS",
            [target.entityId, boundary.entityId],
            "boundaryEntityIds",
            "A target/boundary pair has coincident or overlapping finite support.",
            undefined,
            undefined,
            intersection.diagnostics
          )
        )
      };
    }
    for (const intersectionPoint of intersection.points) {
      if (
        target.kind !== "circle" &&
        intersectionPoint.leftLocation !== "interior"
      ) {
        continue;
      }
      candidates.push({
        parameter: intersectionPoint.leftParameter,
        boundaryEntityId: boundary.entityId
      });
    }
  }
  const collapsed = collapseSketchCurveParameters(
    target,
    candidates.map((candidate) => candidate.parameter),
    policy
  );
  if (collapsed.status === "blocked") {
    return {
      status: "blocked",
      result: blocked(
        diagnostic(
          "SKETCH_EDIT_GEOMETRY_INVALID",
          [target.entityId],
          "boundaryEntityIds",
          "Boundary intersection parameters could not be canonicalized.",
          undefined,
          undefined,
          collapsed.diagnostics
        )
      )
    };
  }
  const intersections = createNormalizedIntersectionEvidence(
    target,
    candidates,
    collapsed.parameters,
    policy
  );
  return {
    status: "ready",
    parameters: collapsed.parameters.map((parameter) => ({
      parameter,
      boundaryEntityId:
        intersections.find(
          (intersection) => intersection.targetParameter === parameter
        )?.boundaryEntityId ??
        [...boundaries]
          .map((boundary) => boundary.entityId)
          .sort(compareEntityIds)[0]!
    })),
    intersections
  };
}

export interface PlanSketchTrimInput {
  readonly entityId: SketchEntityId;
  readonly boundaryEntityIds: readonly SketchEntityId[];
  readonly pickPoint: Vec2;
  readonly createdEntityIds?: readonly SketchEntityId[];
}

/** Plan an exact finite-boundary trim without allocating source IDs. */
export function planSketchTrim(
  entities: readonly SketchEntitySnapshot[],
  input: PlanSketchTrimInput,
  policy: SketchGeometryPolicy = SKETCH_GEOMETRY_POLICY
): SketchCurveEditPlanResult {
  const context = createContext(entities, policy);
  const target = resolveEditable(context, input.entityId, [
    "line",
    "arc",
    "circle"
  ]);
  if (target.status === "blocked") return target.result;
  const boundaries = resolveBoundaries(
    context,
    input.entityId,
    input.boundaryEntityIds
  );
  if (boundaries.status === "blocked") return boundaries.result;
  const intersectionParameters = collectFiniteBoundaryParameters(
    target.curve,
    boundaries.boundaries,
    policy
  );
  if (intersectionParameters.status === "blocked") {
    return intersectionParameters.result;
  }
  const requiredIntersectionCount = target.curve.kind === "circle" ? 2 : 1;
  if (intersectionParameters.parameters.length < requiredIntersectionCount) {
    return blocked(
      diagnostic(
        "SKETCH_EDIT_INTERSECTION_MISSING",
        [input.entityId, ...input.boundaryEntityIds],
        "boundaryEntityIds",
        target.curve.kind === "circle"
          ? "Circle trim requires at least two distinct finite boundary intersections."
          : "Trim requires at least one distinct interior finite boundary intersection.",
        `>=${requiredIntersectionCount}`,
        String(intersectionParameters.parameters.length)
      ),
      intersectionParameters.intersections
    );
  }
  const projection = projectPointToFiniteSketchCurve(
    target.curve,
    input.pickPoint,
    policy
  );
  if (projection.status === "blocked") {
    return blocked(
      diagnostic(
        "SKETCH_EDIT_INTERSECTION_AMBIGUOUS",
        [input.entityId],
        "pickPoint",
        "The trim pick does not have a unique projection on the target.",
        undefined,
        undefined,
        projection.diagnostics
      ),
      intersectionParameters.intersections
    );
  }
  if (projection.projection.distance > policy.linearTolerance) {
    return blocked(
      diagnostic(
        "SKETCH_EDIT_PICK_OFF_CURVE",
        [input.entityId],
        "pickPoint",
        "The submitted model-space trim pick is farther from the target than the shared linear tolerance.",
        `<=${policy.linearTolerance}`,
        String(projection.projection.distance)
      ),
      intersectionParameters.intersections
    );
  }
  if (
    intersectionParameters.parameters.some(
      ({ parameter }) =>
        distance(
          projection.projection.point,
          pointAtSourceParameter(target.curve, parameter)
        ) <= policy.linearTolerance
    )
  ) {
    return blocked(
      diagnostic(
        "SKETCH_EDIT_INTERSECTION_AMBIGUOUS",
        [input.entityId],
        "pickPoint",
        "The trim pick lies on a partition intersection within tolerance."
      ),
      intersectionParameters.intersections
    );
  }

  if (target.curve.kind === "circle") {
    const parameters = intersectionParameters.parameters.map(
      ({ parameter }) => parameter
    );
    const pickParameter = projection.projection.parameter;
    let removedStartIndex = parameters.findIndex(
      (parameter) => parameter > pickParameter
    );
    removedStartIndex =
      removedStartIndex <= 0 ? parameters.length - 1 : removedStartIndex - 1;
    const removedStart = parameters[removedStartIndex]!;
    const removedEnd = parameters[(removedStartIndex + 1) % parameters.length]!;
    const removedSpan =
      normalizeDegrees(removedEnd - removedStart) || FULL_TURN_DEGREES;
    const retainedStart = removedEnd;
    const retainedSpan = FULL_TURN_DEGREES - removedSpan;
    const retainedEnd = retainedStart + retainedSpan;
    if (
      retainedSpan < policy.angularToleranceDegrees ||
      retainedSpan > FULL_TURN_DEGREES - policy.angularToleranceDegrees
    ) {
      return blocked(
        diagnostic(
          "SKETCH_EDIT_ZERO_LENGTH_RESULT",
          [input.entityId],
          "pickPoint",
          "Circle trim would create an arc outside the complete V17 sweep domain."
        ),
        intersectionParameters.intersections
      );
    }
    const idValidation = validateCreatedIds(
      context,
      input.entityId,
      1,
      input.createdEntityIds
    );
    if (idValidation) {
      return idValidation.status === "blocked"
        ? {
            ...idValidation,
            previewIntersections: intersectionParameters.intersections
          }
        : idValidation;
    }
    const source = target.source as SketchCircleEntitySnapshot;
    const draft = {
      id: createdId(0, input.createdEntityIds),
      shape: {
        kind: "arc" as const,
        center: point(...target.curve.center),
        radius: target.curve.radius,
        startAngleDegrees: normalizeDegrees(retainedStart),
        sweepAngleDegrees: canonicalZero(retainedSpan),
        construction: source.construction
      },
      interval: {
        startParameter: retainedStart,
        endParameter: retainedEnd,
        startProvenanceParameter: normalizeDegrees(retainedStart),
        endProvenanceParameter: normalizeDegrees(retainedEnd),
        cyclic: retainedEnd > FULL_TURN_DEGREES,
        startCause: "intersection" as const,
        endCause: "intersection" as const,
        startBoundaryEntityId: boundaryAtParameter(
          normalizeDegrees(retainedStart),
          intersectionParameters.parameters,
          target.curve,
          policy
        ),
        endBoundaryEntityId: boundaryAtParameter(
          normalizeDegrees(retainedEnd),
          intersectionParameters.parameters,
          target.curve,
          policy
        )
      }
    };
    return {
      status: "ready",
      plan: materializePlan(
        "trim",
        input.entityId,
        "deleted",
        [draft],
        1,
        intersectionParameters.intersections
      ),
      diagnostics: []
    };
  }

  const targetCurve = target.curve as
    | ResolvedSketchCurveLine
    | ResolvedSketchCurveArc;
  const parameters = intersectionParameters.parameters.map(
    ({ parameter }) => parameter
  );
  const maximum = sourceMaximum(targetCurve);
  const partitions = [0, ...parameters, maximum];
  const removedIndex = partitions.findIndex(
    (parameter, index) =>
      index < partitions.length - 1 &&
      projection.projection.parameter >= parameter &&
      projection.projection.parameter <= partitions[index + 1]!
  );
  if (removedIndex < 0) {
    return blocked(
      diagnostic(
        "SKETCH_EDIT_INTERSECTION_AMBIGUOUS",
        [input.entityId],
        "pickPoint",
        "The trim pick does not select one unique target interval."
      ),
      intersectionParameters.intersections
    );
  }
  const retained = partitions
    .slice(0, -1)
    .map((startParameter, index) => ({
      startParameter,
      endParameter: partitions[index + 1]!,
      index
    }))
    .filter(({ index }) => index !== removedIndex);
  if (
    retained.length === 0 ||
    retained.some(
      ({ startParameter, endParameter }) =>
        !validateInterval(targetCurve, startParameter, endParameter, policy)
    )
  ) {
    return blocked(
      diagnostic(
        "SKETCH_EDIT_ZERO_LENGTH_RESULT",
        [input.entityId],
        "boundaryEntityIds",
        "Trim would retain no valid pieces or a zero/domain-invalid piece."
      ),
      intersectionParameters.intersections
    );
  }
  const requiredCreatedEntityIdCount = Math.max(0, retained.length - 1);
  const idValidation = validateCreatedIds(
    context,
    input.entityId,
    requiredCreatedEntityIdCount,
    input.createdEntityIds
  );
  if (idValidation) {
    return idValidation.status === "blocked"
      ? {
          ...idValidation,
          previewIntersections: intersectionParameters.intersections
        }
      : idValidation;
  }
  const source = target.source as SketchLineEntitySnapshot | SketchArcEntity;
  let createdIndex = 0;
  const drafts = retained.map(({ startParameter, endParameter }, index) => ({
    id:
      index === 0
        ? ({ kind: "preserved", entityId: input.entityId } as const)
        : createdId(createdIndex++, input.createdEntityIds),
    shape: intervalShape(source, targetCurve, startParameter, endParameter),
    interval: {
      startParameter,
      endParameter,
      startCause:
        startParameter === 0
          ? ("source-endpoint" as const)
          : ("intersection" as const),
      endCause:
        endParameter === maximum
          ? ("source-endpoint" as const)
          : ("intersection" as const),
      startSourceEndpoint:
        startParameter === 0 ? ("start" as const) : undefined,
      endSourceEndpoint:
        endParameter === maximum ? ("end" as const) : undefined,
      startBoundaryEntityId: boundaryAtParameter(
        startParameter,
        intersectionParameters.parameters,
        targetCurve,
        policy
      ),
      endBoundaryEntityId: boundaryAtParameter(
        endParameter,
        intersectionParameters.parameters,
        targetCurve,
        policy
      )
    }
  }));
  return {
    status: "ready",
    plan: materializePlan(
      "trim",
      input.entityId,
      "modified",
      drafts,
      requiredCreatedEntityIdCount,
      intersectionParameters.intersections
    ),
    diagnostics: []
  };
}

export interface PlanSketchSplitInput {
  readonly entityId: SketchEntityId;
  readonly splitPoints: readonly Vec2[];
  readonly createdEntityIds?: readonly SketchEntityId[];
}

/** Plan an exact explicit-point split without allocating source IDs. */
export function planSketchSplit(
  entities: readonly SketchEntitySnapshot[],
  input: PlanSketchSplitInput,
  policy: SketchGeometryPolicy = SKETCH_GEOMETRY_POLICY
): SketchCurveEditPlanResult {
  const context = createContext(entities, policy);
  const target = resolveEditable(context, input.entityId, [
    "line",
    "arc",
    "circle"
  ]);
  if (target.status === "blocked") return target.result;
  if (input.splitPoints.length === 0) {
    return blocked(
      diagnostic(
        "SKETCH_EDIT_INTERSECTION_MISSING",
        [input.entityId],
        "splitPoints",
        "At least one explicit split point is required."
      )
    );
  }
  const projectedParameters: number[] = [];
  for (const [index, splitPoint] of input.splitPoints.entries()) {
    const projection = projectPointToFiniteSketchCurve(
      target.curve,
      splitPoint,
      policy
    );
    if (projection.status === "blocked") {
      return blocked(
        diagnostic(
          "SKETCH_EDIT_SPLIT_POINT_INVALID",
          [input.entityId],
          `splitPoints[${index}]`,
          "The split point does not have a unique finite target projection.",
          undefined,
          undefined,
          projection.diagnostics
        )
      );
    }
    if (projection.projection.distance > policy.linearTolerance) {
      return blocked(
        diagnostic(
          "SKETCH_EDIT_PICK_OFF_CURVE",
          [input.entityId],
          `splitPoints[${index}]`,
          "The submitted model-space split point is farther from the target than the shared linear tolerance.",
          `<=${policy.linearTolerance}`,
          String(projection.projection.distance)
        )
      );
    }
    if (
      target.curve.kind !== "circle" &&
      projection.projection.location !== "interior"
    ) {
      return blocked(
        diagnostic(
          "SKETCH_EDIT_SPLIT_POINT_INVALID",
          [input.entityId],
          `splitPoints[${index}]`,
          "A line or arc split point may not project within tolerance of an existing endpoint."
        )
      );
    }
    projectedParameters.push(projection.projection.parameter);
  }
  const collapsed = collapseSketchCurveParameters(
    target.curve,
    projectedParameters,
    policy
  );
  if (collapsed.status === "blocked") {
    return blocked(
      diagnostic(
        "SKETCH_EDIT_SPLIT_POINT_INVALID",
        [input.entityId],
        "splitPoints",
        "Split parameters could not be canonicalized.",
        undefined,
        undefined,
        collapsed.diagnostics
      )
    );
  }

  if (target.curve.kind === "circle") {
    const targetCurve = target.curve;
    if (collapsed.parameters.length < 2) {
      return blocked(
        diagnostic(
          "SKETCH_EDIT_INTERSECTION_MISSING",
          [input.entityId],
          "splitPoints",
          "Circle split requires at least two distinct projected split points.",
          ">=2 distinct points",
          String(collapsed.parameters.length)
        )
      );
    }
    const idValidation = validateCreatedIds(
      context,
      input.entityId,
      collapsed.parameters.length,
      input.createdEntityIds
    );
    if (idValidation) return idValidation;
    const source = target.source as SketchCircleEntitySnapshot;
    const drafts = collapsed.parameters.map((startParameter, index) => {
      const next =
        collapsed.parameters[(index + 1) % collapsed.parameters.length]!;
      const endParameter =
        index === collapsed.parameters.length - 1 ? next + 360 : next;
      const span = endParameter - startParameter;
      return {
        id: createdId(index, input.createdEntityIds),
        shape: {
          kind: "arc" as const,
          center: point(targetCurve.center[0], targetCurve.center[1]),
          radius: targetCurve.radius,
          startAngleDegrees: normalizeDegrees(startParameter),
          sweepAngleDegrees: canonicalZero(span),
          construction: source.construction
        },
        interval: {
          startParameter,
          endParameter,
          startProvenanceParameter: normalizeDegrees(startParameter),
          endProvenanceParameter: normalizeDegrees(endParameter),
          cyclic: index === collapsed.parameters.length - 1,
          startCause: "split" as const,
          endCause: "split" as const
        }
      };
    });
    if (
      drafts.some(
        ({ interval }) =>
          interval.endParameter - interval.startParameter <
            policy.angularToleranceDegrees ||
          interval.endParameter - interval.startParameter >
            FULL_TURN_DEGREES - policy.angularToleranceDegrees
      )
    ) {
      return blocked(
        diagnostic(
          "SKETCH_EDIT_ZERO_LENGTH_RESULT",
          [input.entityId],
          "splitPoints",
          "Circle split would create an arc outside the complete V17 sweep domain."
        )
      );
    }
    return {
      status: "ready",
      plan: materializePlan(
        "split",
        input.entityId,
        "deleted",
        drafts,
        collapsed.parameters.length
      ),
      diagnostics: []
    };
  }

  const targetCurve = target.curve as
    | ResolvedSketchCurveLine
    | ResolvedSketchCurveArc;
  const maximum = sourceMaximum(targetCurve);
  const partitions = [0, ...collapsed.parameters, maximum];
  if (
    partitions
      .slice(0, -1)
      .some(
        (startParameter, index) =>
          !validateInterval(
            targetCurve,
            startParameter,
            partitions[index + 1]!,
            policy
          )
      )
  ) {
    return blocked(
      diagnostic(
        "SKETCH_EDIT_ZERO_LENGTH_RESULT",
        [input.entityId],
        "splitPoints",
        "Split would create a zero/domain-invalid result piece."
      )
    );
  }
  const requiredCreatedEntityIdCount = collapsed.parameters.length;
  const idValidation = validateCreatedIds(
    context,
    input.entityId,
    requiredCreatedEntityIdCount,
    input.createdEntityIds
  );
  if (idValidation) return idValidation;
  const source = target.source as SketchLineEntitySnapshot | SketchArcEntity;
  let createdIndex = 0;
  const drafts = partitions.slice(0, -1).map((startParameter, index) => {
    const endParameter = partitions[index + 1]!;
    return {
      id:
        index === 0
          ? ({ kind: "preserved", entityId: input.entityId } as const)
          : createdId(createdIndex++, input.createdEntityIds),
      shape: intervalShape(source, targetCurve, startParameter, endParameter),
      interval: {
        startParameter,
        endParameter,
        startCause:
          index === 0 ? ("source-endpoint" as const) : ("split" as const),
        endCause:
          index === partitions.length - 2
            ? ("source-endpoint" as const)
            : ("split" as const),
        startSourceEndpoint: index === 0 ? ("start" as const) : undefined,
        endSourceEndpoint:
          index === partitions.length - 2 ? ("end" as const) : undefined
      }
    };
  });
  return {
    status: "ready",
    plan: materializePlan(
      "split",
      input.entityId,
      "modified",
      drafts,
      requiredCreatedEntityIdCount
    ),
    diagnostics: []
  };
}

export interface PlanSketchExtendInput {
  readonly entityId: SketchEntityId;
  readonly endpoint: "start" | "end";
  readonly boundaryEntityIds: readonly SketchEntityId[];
}

interface ExtensionCandidate {
  readonly sourceParameter: number;
  readonly extensionDistance: number;
  readonly boundaryEntityId: SketchEntityId;
}

function createExtensionIntersectionEvidence(
  target: ResolvedSketchCurveLine | ResolvedSketchCurveArc,
  endpoint: "start" | "end",
  candidates: readonly ExtensionCandidate[],
  policy: SketchGeometryPolicy
): readonly SketchCurveEditIntersectionEvidence[] {
  const maximum = sourceMaximum(target);
  const nearestByBoundaryId = new Map<
    SketchEntityId,
    SketchCurveEditIntersectionEvidence
  >();
  for (const candidate of candidates) {
    if (
      validateInterval(
        target,
        endpoint === "start" ? candidate.sourceParameter : 0,
        endpoint === "end" ? candidate.sourceParameter : maximum,
        policy
      )
    ) {
      if (nearestByBoundaryId.has(candidate.boundaryEntityId)) continue;
      nearestByBoundaryId.set(candidate.boundaryEntityId, {
        boundaryEntityId: candidate.boundaryEntityId,
        point: pointAtSourceParameter(target, candidate.sourceParameter),
        targetParameter: canonicalZero(candidate.sourceParameter)
      });
    }
  }
  return [...nearestByBoundaryId.values()];
}

/** Plan the closest unambiguous outward extension to explicit finite geometry. */
export function planSketchExtend(
  entities: readonly SketchEntitySnapshot[],
  input: PlanSketchExtendInput,
  policy: SketchGeometryPolicy = SKETCH_GEOMETRY_POLICY
): SketchCurveEditPlanResult {
  const context = createContext(entities, policy);
  const target = resolveEditable(context, input.entityId, ["line", "arc"]);
  if (target.status === "blocked") return target.result;
  const boundaries = resolveBoundaries(
    context,
    input.entityId,
    input.boundaryEntityIds
  );
  if (boundaries.status === "blocked") return boundaries.result;
  const targetCurve = target.curve as
    | ResolvedSketchCurveLine
    | ResolvedSketchCurveArc;
  const maximum = sourceMaximum(targetCurve);
  const candidates: ExtensionCandidate[] = [];
  let sawZeroExtension = false;
  for (const boundary of boundaries.boundaries) {
    const intersection = intersectSketchCurveSupportWithFiniteCurve(
      targetCurve,
      boundary,
      policy
    );
    if (intersection.status === "blocked") {
      return blocked(
        diagnostic(
          "SKETCH_EDIT_INTERSECTION_AMBIGUOUS",
          [input.entityId, boundary.entityId],
          "boundaryEntityIds",
          "The target support overlaps an explicit finite boundary.",
          undefined,
          undefined,
          intersection.diagnostics
        )
      );
    }
    for (const intersectionPoint of intersection.points) {
      let sourceParameter = intersectionPoint.leftParameter;
      if (targetCurve.kind === "arc") {
        if (input.endpoint === "start") {
          while (sourceParameter >= -policy.angularToleranceDegrees) {
            sourceParameter -= FULL_TURN_DEGREES;
          }
        } else {
          while (sourceParameter <= maximum + policy.angularToleranceDegrees) {
            sourceParameter += FULL_TURN_DEGREES;
          }
        }
      }
      const extensionParameter =
        input.endpoint === "start"
          ? -sourceParameter
          : sourceParameter - maximum;
      const extensionDistance =
        targetCurve.kind === "line"
          ? extensionParameter
          : extensionParameter * targetCurve.radius * RADIANS_PER_DEGREE;
      if (extensionDistance > policy.linearTolerance) {
        candidates.push({
          sourceParameter,
          extensionDistance,
          boundaryEntityId: boundary.entityId
        });
      } else if (
        extensionDistance >= -policy.linearTolerance &&
        ((input.endpoint === "start" &&
          sourceParameter <= policy.linearTolerance) ||
          (input.endpoint === "end" &&
            sourceParameter >= maximum - policy.linearTolerance))
      ) {
        sawZeroExtension = true;
      }
    }
  }
  candidates.sort(
    (left, right) =>
      left.extensionDistance - right.extensionDistance ||
      left.sourceParameter - right.sourceParameter ||
      (left.boundaryEntityId < right.boundaryEntityId
        ? -1
        : left.boundaryEntityId > right.boundaryEntityId
          ? 1
          : 0)
  );
  const selected = candidates[0];
  if (!selected) {
    return blocked(
      diagnostic(
        sawZeroExtension
          ? "SKETCH_EDIT_ZERO_LENGTH_RESULT"
          : "SKETCH_EDIT_INTERSECTION_MISSING",
        [input.entityId, ...input.boundaryEntityIds],
        "boundaryEntityIds",
        sawZeroExtension
          ? "The closest boundary contact produces no positive extension."
          : "No explicit finite boundary intersects the selected outward target ray."
      )
    );
  }
  const previewIntersections = createExtensionIntersectionEvidence(
    targetCurve,
    input.endpoint,
    candidates,
    policy
  );
  if (
    candidates[1] &&
    Math.abs(candidates[1].extensionDistance - selected.extensionDistance) <=
      policy.linearTolerance
  ) {
    return blocked(
      diagnostic(
        "SKETCH_EDIT_INTERSECTION_AMBIGUOUS",
        [
          input.entityId,
          selected.boundaryEntityId,
          candidates[1].boundaryEntityId
        ],
        "boundaryEntityIds",
        "Two distinct boundary intersections are equally close on the selected outward ray."
      ),
      previewIntersections
    );
  }
  const startParameter =
    input.endpoint === "start" ? selected.sourceParameter : 0;
  const endParameter =
    input.endpoint === "end" ? selected.sourceParameter : maximum;
  if (!validateInterval(targetCurve, startParameter, endParameter, policy)) {
    return blocked(
      diagnostic(
        "SKETCH_EDIT_ZERO_LENGTH_RESULT",
        [input.entityId],
        "boundaryEntityIds",
        targetCurve.kind === "arc"
          ? "Extend would produce an arc at or beyond the V17 full-circle bound."
          : "Extend would not increase the target by more than the shared linear tolerance."
      ),
      previewIntersections
    );
  }
  const source = target.source as SketchLineEntitySnapshot | SketchArcEntity;
  const draft = {
    id: { kind: "preserved", entityId: input.entityId } as const,
    shape: intervalShape(source, targetCurve, startParameter, endParameter),
    interval: {
      startParameter,
      endParameter,
      startCause:
        input.endpoint === "start"
          ? ("extension" as const)
          : ("source-endpoint" as const),
      endCause:
        input.endpoint === "end"
          ? ("extension" as const)
          : ("source-endpoint" as const),
      startSourceEndpoint: "start" as const,
      endSourceEndpoint: "end" as const,
      startBoundaryEntityId:
        input.endpoint === "start" ? selected.boundaryEntityId : undefined,
      endBoundaryEntityId:
        input.endpoint === "end" ? selected.boundaryEntityId : undefined
    }
  };
  return {
    status: "ready",
    plan: materializePlan(
      "extend",
      input.entityId,
      "modified",
      [draft],
      0,
      previewIntersections
    ),
    diagnostics: []
  };
}

export interface PlanSketchExplodeRectangleInput {
  readonly entityId: SketchEntityId;
  readonly lineEntityIds?: readonly [
    SketchEntityId,
    SketchEntityId,
    SketchEntityId,
    SketchEntityId
  ];
}

/** Plan the exact vMin, uMax, vMax, uMin counterclockwise rectangle boundary. */
export function planSketchExplodeRectangle(
  entities: readonly SketchEntitySnapshot[],
  input: PlanSketchExplodeRectangleInput,
  policy: SketchGeometryPolicy = SKETCH_GEOMETRY_POLICY
): SketchCurveEditPlanResult {
  const context = createContext(entities, policy);
  const entity = context.entityById.get(input.entityId);
  if (!entity || entity.kind !== "rectangle") {
    return blocked(
      diagnostic(
        "SKETCH_EDIT_TARGET_UNSUPPORTED",
        [input.entityId],
        "entityId",
        entity
          ? `Entity kind '${entity.kind}' cannot be exploded as a rectangle.`
          : "The rectangle entity does not exist in the supplied sketch source.",
        "rectangle",
        entity?.kind ?? "missing"
      )
    );
  }
  const rectangle = entity as SketchRectangleEntitySnapshot;
  if (
    !Number.isFinite(rectangle.center[0]) ||
    !Number.isFinite(rectangle.center[1]) ||
    !Number.isFinite(rectangle.width) ||
    !Number.isFinite(rectangle.height) ||
    rectangle.width <= policy.linearTolerance ||
    rectangle.height <= policy.linearTolerance
  ) {
    return blocked(
      diagnostic(
        "SKETCH_EDIT_GEOMETRY_INVALID",
        [input.entityId],
        "entityId",
        "Rectangle center, width, and height must define four finite non-degenerate edges."
      )
    );
  }
  const idValidation = validateCreatedIds(
    context,
    input.entityId,
    4,
    input.lineEntityIds
  );
  if (idValidation) return idValidation;
  const uMin = rectangle.center[0] - rectangle.width / 2;
  const uMax = rectangle.center[0] + rectangle.width / 2;
  const vMin = rectangle.center[1] - rectangle.height / 2;
  const vMax = rectangle.center[1] + rectangle.height / 2;
  const corners = [
    point(uMin, vMin),
    point(uMax, vMin),
    point(uMax, vMax),
    point(uMin, vMax)
  ] as const;
  if (
    corners.some(
      (corner) => !Number.isFinite(corner[0]) || !Number.isFinite(corner[1])
    ) ||
    corners.some(
      (corner, index) =>
        distance(corner, corners[(index + 1) % corners.length]!) <=
        policy.linearTolerance
    )
  ) {
    return blocked(
      diagnostic(
        "SKETCH_EDIT_GEOMETRY_INVALID",
        [input.entityId],
        "entityId",
        "Rectangle-derived corners and edges must remain finite and non-degenerate."
      )
    );
  }
  const drafts = corners.map((start, index) => {
    const end = corners[(index + 1) % corners.length]!;
    return {
      id: createdId(index, input.lineEntityIds),
      shape: {
        kind: "line" as const,
        start,
        end,
        construction: rectangle.construction
      },
      interval: {
        startParameter: index,
        endParameter: index + 1,
        cyclic: index === 3,
        startCause: "rectangle-corner" as const,
        endCause: "rectangle-corner" as const
      }
    };
  });
  return {
    status: "ready",
    plan: materializePlan(
      "explodeRectangle",
      input.entityId,
      "deleted",
      drafts,
      4
    ),
    diagnostics: []
  };
}
