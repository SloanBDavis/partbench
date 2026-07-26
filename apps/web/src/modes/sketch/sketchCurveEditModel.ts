import {
  CAD_V19_SKETCH_GEOMETRY_POLICY,
  type CadSketchEditDiagnostic,
  type OrientedSketchSegmentRef,
  type PreparedSketchCurveEditOp,
  type SketchCurveEditImpact,
  type SketchCurveEditPreview,
  type SketchCurveEditProposal,
  type SketchCurveEditReadinessQueryResponse,
  type SketchEntitySnapshot,
  type SketchSnapshot,
  type Vec2
} from "@web-cad/cad-protocol";

export type SketchCurveEditKind =
  | "trim"
  | "extend"
  | "split"
  | "explodeRectangle"
  | "offset";

export type SketchCurveEditCollector =
  | "target"
  | "boundaries"
  | "pick"
  | "splitPoints"
  | "chain"
  | "side"
  | "witness";

export interface SketchCurveEditDraft {
  readonly kind: SketchCurveEditKind;
  readonly targetEntityId: string;
  readonly boundaryEntityIds: readonly string[];
  readonly endpoint?: "start" | "end";
  readonly pickPoint?: Vec2;
  readonly splitPoints: readonly Vec2[];
  readonly pendingSplitPoint: Vec2;
  readonly collector: SketchCurveEditCollector;
  readonly offsetSourceMode: "entity" | "chain";
  readonly offsetSegments: readonly OrientedSketchSegmentRef[];
  readonly offsetClosed: boolean;
  readonly offsetDistance: number;
  readonly offsetSide?: "left" | "right" | "inward" | "outward";
  readonly offsetUseReferencePoint: boolean;
  readonly offsetReferencePoint?: Vec2;
}

export interface SketchCurveEditViewportChoice {
  readonly sequence: number;
  readonly entityId?: string;
  readonly point?: Vec2;
}

export type SketchCurveEditKeyboardCommand =
  | "apply"
  | "cancel"
  | "next-collector"
  | undefined;

export interface SketchCurveEditReadinessProjection {
  readonly displayReadiness?: SketchCurveEditReadinessQueryResponse;
  readonly applyOperation?: PreparedSketchCurveEditOp;
  readonly displayingHoverPreview: boolean;
}

export interface SketchTrimIntervalChoice {
  readonly key: string;
  readonly label: string;
  readonly witnessPoint: Vec2;
  readonly startParameter: number;
  readonly endParameter: number;
  readonly boundaryEntityIds: readonly string[];
}

export interface SketchExtendHitChoice {
  readonly key: string;
  readonly label: string;
  readonly endpoint: "start" | "end";
  readonly boundaryEntityId: string;
  readonly hitPoint: Vec2;
}

export function createSketchCurveEditReadinessAuthorityKey(
  sourceAuthorityKey: string | number,
  refresh: number
): string {
  return `${typeof sourceAuthorityKey}:${String(sourceAuthorityKey)}:${refresh}`;
}

const CURVE_KINDS = new Set<SketchEntitySnapshot["kind"]>([
  "line",
  "arc",
  "circle"
]);

export function createSketchCurveEditDraft(
  kind: SketchCurveEditKind,
  sketch: SketchSnapshot,
  selectedEntityId?: string
): SketchCurveEditDraft {
  const selected = sketch.entities.find(
    (entity) =>
      entity.id === selectedEntityId && isEligibleCurveEditTarget(kind, entity)
  );
  const target = selected;
  const collector =
    target === undefined
      ? "target"
      : kind === "explodeRectangle"
        ? "target"
        : kind === "split"
          ? "splitPoints"
          : kind === "offset"
            ? "side"
            : "boundaries";

  return {
    kind,
    targetEntityId: target?.id ?? "",
    boundaryEntityIds: [],
    endpoint: undefined,
    splitPoints: [],
    pendingSplitPoint: target ? getSketchEntityWitnessPoint(target) : [0, 0],
    collector,
    offsetSourceMode: "entity",
    offsetSegments: [],
    offsetClosed: false,
    offsetDistance: 1,
    offsetUseReferencePoint: false
  };
}

export function isEligibleCurveEditTarget(
  kind: SketchCurveEditKind,
  entity: SketchEntitySnapshot
): boolean {
  switch (kind) {
    case "trim":
    case "split":
      return CURVE_KINDS.has(entity.kind);
    case "extend":
      return entity.kind === "line" || entity.kind === "arc";
    case "explodeRectangle":
      return entity.kind === "rectangle";
    case "offset":
      return (
        entity.kind === "line" ||
        entity.kind === "arc" ||
        entity.kind === "circle" ||
        entity.kind === "rectangle"
      );
  }
}

export function isEligibleCurveEditBoundary(
  targetEntityId: string,
  entity: SketchEntitySnapshot
): boolean {
  return entity.id !== targetEntityId && CURVE_KINDS.has(entity.kind);
}

export function buildSketchCurveEditProposal(
  sketchId: string,
  draft: SketchCurveEditDraft
): SketchCurveEditProposal | undefined {
  if (
    !draft.targetEntityId &&
    !(draft.kind === "offset" && draft.offsetSourceMode === "chain")
  ) {
    return undefined;
  }
  switch (draft.kind) {
    case "trim":
      return draft.boundaryEntityIds.length > 0 && draft.pickPoint
        ? {
            kind: "trim",
            sketchId,
            entityId: draft.targetEntityId,
            boundaryEntityIds: draft.boundaryEntityIds,
            pickPoint: draft.pickPoint
          }
        : undefined;
    case "extend":
      return draft.boundaryEntityIds.length > 0 && draft.endpoint
        ? {
            kind: "extend",
            sketchId,
            entityId: draft.targetEntityId,
            endpoint: draft.endpoint,
            boundaryEntityIds: draft.boundaryEntityIds
          }
        : undefined;
    case "split":
      return draft.splitPoints.length > 0
        ? {
            kind: "split",
            sketchId,
            entityId: draft.targetEntityId,
            splitPoints: draft.splitPoints
          }
        : undefined;
    case "explodeRectangle":
      return {
        kind: "explodeRectangle",
        sketchId,
        entityId: draft.targetEntityId
      };
    case "offset": {
      if (
        !(Number.isFinite(draft.offsetDistance) && draft.offsetDistance > 0) ||
        draft.offsetSide === undefined
      ) {
        return undefined;
      }
      const source =
        draft.offsetSourceMode === "entity"
          ? draft.targetEntityId
            ? ({
                kind: "entity",
                entityId: draft.targetEntityId
              } as const)
            : undefined
          : draft.offsetSegments.length > 0
            ? ({
                kind: "chain",
                segments: draft.offsetSegments,
                closed: draft.offsetClosed
              } as const)
            : undefined;
      if (!source) return undefined;
      return {
        kind: "offset",
        sketchId,
        source,
        distance: draft.offsetDistance,
        side: draft.offsetSide,
        ...(draft.offsetUseReferencePoint && draft.offsetReferencePoint
          ? { referencePoint: draft.offsetReferencePoint }
          : {})
      };
    }
  }
}

export function hasCollectedSketchCurveEditChoices(
  draft: SketchCurveEditDraft,
  initialDraft: SketchCurveEditDraft
): boolean {
  return (
    draft.targetEntityId !== initialDraft.targetEntityId ||
    draft.boundaryEntityIds.length > 0 ||
    draft.endpoint !== undefined ||
    draft.pickPoint !== undefined ||
    draft.splitPoints.length > 0 ||
    draft.pendingSplitPoint[0] !== initialDraft.pendingSplitPoint[0] ||
    draft.pendingSplitPoint[1] !== initialDraft.pendingSplitPoint[1] ||
    draft.offsetSourceMode !== initialDraft.offsetSourceMode ||
    draft.offsetSegments.length > 0 ||
    draft.offsetClosed !== initialDraft.offsetClosed ||
    draft.offsetDistance !== initialDraft.offsetDistance ||
    draft.offsetSide !== initialDraft.offsetSide ||
    draft.offsetUseReferencePoint !== initialDraft.offsetUseReferencePoint ||
    draft.offsetReferencePoint?.[0] !==
      initialDraft.offsetReferencePoint?.[0] ||
    draft.offsetReferencePoint?.[1] !== initialDraft.offsetReferencePoint?.[1]
  );
}

export function applySketchCurveEditViewportChoice(
  draft: SketchCurveEditDraft,
  choice: SketchCurveEditViewportChoice,
  sketch: SketchSnapshot
): SketchCurveEditDraft {
  if (draft.collector === "target" && choice.entityId) {
    const entity = sketch.entities.find(
      (candidate) => candidate.id === choice.entityId
    );
    if (!entity || !isEligibleCurveEditTarget(draft.kind, entity)) return draft;
    return {
      ...draft,
      targetEntityId: entity.id,
      boundaryEntityIds: draft.boundaryEntityIds.filter(
        (id) => id !== entity.id
      ),
      pickPoint: draft.kind === "trim" ? undefined : draft.pickPoint,
      pendingSplitPoint: getSketchEntityWitnessPoint(entity),
      collector:
        draft.kind === "explodeRectangle"
          ? "target"
          : draft.kind === "split"
            ? "splitPoints"
            : draft.kind === "offset"
              ? "side"
              : "boundaries"
    };
  }
  if (draft.collector === "boundaries" && choice.entityId) {
    const entity = sketch.entities.find(
      (candidate) => candidate.id === choice.entityId
    );
    if (!entity || !isEligibleCurveEditBoundary(draft.targetEntityId, entity)) {
      return draft;
    }
    const selected = draft.boundaryEntityIds.includes(entity.id);
    return {
      ...draft,
      boundaryEntityIds: selected
        ? draft.boundaryEntityIds.filter((id) => id !== entity.id)
        : [...draft.boundaryEntityIds, entity.id]
    };
  }
  if (draft.collector === "pick" && choice.point) {
    return { ...draft, pickPoint: choice.point };
  }
  if (draft.collector === "splitPoints" && choice.point) {
    return {
      ...draft,
      splitPoints: appendUniquePoint(draft.splitPoints, choice.point),
      pendingSplitPoint: choice.point
    };
  }
  if (draft.collector === "chain" && choice.entityId) {
    const entity = sketch.entities.find(
      (candidate) => candidate.id === choice.entityId
    );
    if (!entity || (entity.kind !== "line" && entity.kind !== "arc")) {
      return draft;
    }
    const selected = draft.offsetSegments.some(
      (segment) => segment.entityId === entity.id
    );
    return {
      ...draft,
      offsetSegments: selected
        ? draft.offsetSegments.filter(
            (segment) => segment.entityId !== entity.id
          )
        : [
            ...draft.offsetSegments,
            { entityId: entity.id, orientation: "forward" }
          ]
    };
  }
  if (draft.collector === "witness" && choice.point) {
    return {
      ...draft,
      offsetUseReferencePoint: true,
      offsetReferencePoint: choice.point
    };
  }
  return draft;
}

export function createSketchCurveEditPreviewDraft(
  draft: SketchCurveEditDraft,
  hoverChoice: SketchCurveEditViewportChoice | undefined,
  sketch: SketchSnapshot
): SketchCurveEditDraft {
  return hoverChoice
    ? applySketchCurveEditViewportChoice(draft, hoverChoice, sketch)
    : draft;
}

export function getCurveEditKeyboardCommand(input: {
  readonly key: string;
  readonly ctrlKey?: boolean;
  readonly metaKey?: boolean;
}): SketchCurveEditKeyboardCommand {
  if (input.key === "Escape") return "cancel";
  if (input.key === "Enter" && Boolean(input.ctrlKey || input.metaKey)) {
    return "apply";
  }
  if (input.key === "Enter") return "next-collector";
  return undefined;
}

export function getSketchCurveEditEscapeAction(
  dirty: boolean
): "cancel" | "guard" {
  return dirty ? "guard" : "cancel";
}

export function commitSketchCurveEditDraftChange(
  clearHoverPreview: (() => void) | undefined,
  commit: () => void
): void {
  clearHoverPreview?.();
  commit();
}

export function handleSketchCurveEditWindowShortcut(input: {
  readonly event: {
    readonly key: string;
    readonly ctrlKey?: boolean;
    readonly metaKey?: boolean;
    preventDefault(): void;
  };
  readonly suspended: boolean;
  readonly dirty: boolean;
  readonly canApply: boolean;
  readonly onApply: () => void;
  readonly onCancel: () => void;
  readonly onDirtyEscape: () => void;
}): boolean {
  if (input.suspended) return false;
  const command = getCurveEditKeyboardCommand(input.event);
  if (command === "cancel") {
    input.event.preventDefault();
    if (getSketchCurveEditEscapeAction(input.dirty) === "guard") {
      input.onDirtyEscape();
    } else {
      input.onCancel();
    }
    return true;
  }
  if (command === "apply" && input.canApply) {
    input.event.preventDefault();
    input.onApply();
    return true;
  }
  return false;
}

export function getNextCurveEditCollector(
  draft: SketchCurveEditDraft
): SketchCurveEditCollector {
  switch (draft.kind) {
    case "trim":
      return draft.collector === "target"
        ? "boundaries"
        : draft.collector === "boundaries"
          ? "pick"
          : "target";
    case "extend":
      return draft.collector === "target" ? "boundaries" : "target";
    case "split":
      return draft.collector === "target" ? "splitPoints" : "target";
    case "explodeRectangle":
      return "target";
    case "offset":
      return draft.collector === "target"
        ? "side"
        : draft.collector === "chain"
          ? "side"
          : draft.collector === "side"
            ? draft.offsetUseReferencePoint
              ? "witness"
              : draft.offsetSourceMode === "chain"
                ? "chain"
                : "target"
            : draft.offsetSourceMode === "chain"
              ? "chain"
              : "target";
  }
}

export function getSketchCurveEditKindLabel(kind: SketchCurveEditKind): string {
  switch (kind) {
    case "trim":
      return "Trim";
    case "extend":
      return "Extend";
    case "split":
      return "Split";
    case "explodeRectangle":
      return "Explode Rectangle";
    case "offset":
      return "Offset";
  }
}

export function getSketchOffsetSideChoices(
  draft: SketchCurveEditDraft,
  sketch: SketchSnapshot
): readonly {
  readonly side: "left" | "right" | "inward" | "outward";
  readonly witnessPoint?: Vec2;
}[] {
  const closed =
    draft.offsetSourceMode === "chain"
      ? draft.offsetClosed
      : sketch.entities.find((entity) => entity.id === draft.targetEntityId)
          ?.kind === "circle" ||
        sketch.entities.find((entity) => entity.id === draft.targetEntityId)
          ?.kind === "rectangle";
  const sides = closed
    ? (["inward", "outward"] as const)
    : (["left", "right"] as const);
  return sides.map((side) => ({
    side,
    witnessPoint: createSketchOffsetWitnessPoint(draft, sketch, side)
  }));
}

export function createSketchOffsetWitnessPoint(
  draft: SketchCurveEditDraft,
  sketch: SketchSnapshot,
  side: "left" | "right" | "inward" | "outward"
): Vec2 | undefined {
  const sourceEntity =
    draft.offsetSourceMode === "entity"
      ? sketch.entities.find((entity) => entity.id === draft.targetEntityId)
      : sketch.entities.find(
          (entity) => entity.id === draft.offsetSegments[0]?.entityId
        );
  if (!sourceEntity) return undefined;
  const distance = Math.max(draft.offsetDistance, 1e-6);
  const lateralSide = resolveSketchOffsetLateralSide(draft, sketch, side);
  if (sourceEntity.kind === "line") {
    const orientation =
      draft.offsetSourceMode === "chain"
        ? (draft.offsetSegments[0]?.orientation ?? "forward")
        : "forward";
    const start =
      orientation === "forward" ? sourceEntity.start : sourceEntity.end;
    const end =
      orientation === "forward" ? sourceEntity.end : sourceEntity.start;
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const length = Math.hypot(dx, dy);
    if (!(length > 0)) return undefined;
    if (!lateralSide) return undefined;
    const sign = lateralSide === "left" ? 1 : -1;
    return [
      (start[0] + end[0]) / 2 - (dy / length) * distance * sign,
      (start[1] + end[1]) / 2 + (dx / length) * distance * sign
    ];
  }
  if (sourceEntity.kind === "arc") {
    if (!lateralSide) return undefined;
    const authoredSign = Math.sign(sourceEntity.sweepAngleDegrees) || 1;
    const orientationSign =
      draft.offsetSourceMode === "chain" &&
      draft.offsetSegments[0]?.orientation === "reverse"
        ? -1
        : 1;
    const angle =
      ((sourceEntity.startAngleDegrees + sourceEntity.sweepAngleDegrees / 2) *
        Math.PI) /
      180;
    const tangentSign = authoredSign * orientationSign;
    const radialSign =
      (lateralSide === "left" ? -tangentSign : tangentSign) *
      (sourceEntity.radius > distance ? 1 : 0.5);
    const radius = Math.max(
      sourceEntity.radius + radialSign * distance,
      sourceEntity.radius * 0.5
    );
    return [
      sourceEntity.center[0] + radius * Math.cos(angle),
      sourceEntity.center[1] + radius * Math.sin(angle)
    ];
  }
  if (sourceEntity.kind === "circle") {
    const radius =
      side === "inward"
        ? sourceEntity.radius * 0.5
        : sourceEntity.radius + distance;
    return [sourceEntity.center[0] + radius, sourceEntity.center[1]];
  }
  if (sourceEntity.kind === "rectangle") {
    return side === "inward"
      ? [
          sourceEntity.center[0] + sourceEntity.width * 0.173,
          sourceEntity.center[1] + sourceEntity.height * 0.127
        ]
      : [
          sourceEntity.center[0] + sourceEntity.width / 2 + distance,
          sourceEntity.center[1] + sourceEntity.height * 0.137
        ];
  }
  return undefined;
}

function resolveSketchOffsetLateralSide(
  draft: SketchCurveEditDraft,
  sketch: SketchSnapshot,
  side: "left" | "right" | "inward" | "outward"
): "left" | "right" | undefined {
  if (side === "left" || side === "right") return side;
  if (draft.offsetSourceMode !== "chain" || !draft.offsetClosed) {
    return undefined;
  }
  const winding = getOrientedChainWinding(draft.offsetSegments, sketch);
  if (winding === undefined) return undefined;
  const interiorSide = winding > 0 ? "left" : "right";
  if (side === "inward") return interiorSide;
  return interiorSide === "left" ? "right" : "left";
}

function getOrientedChainWinding(
  segments: readonly OrientedSketchSegmentRef[],
  sketch: SketchSnapshot
): number | undefined {
  const firstSegment = segments[0];
  const firstEntity = firstSegment
    ? sketch.entities.find(
        (candidate) => candidate.id === firstSegment.entityId
      )
    : undefined;
  if (
    !firstSegment ||
    !firstEntity ||
    (firstEntity.kind !== "line" && firstEntity.kind !== "arc")
  ) {
    return undefined;
  }
  const anchor =
    firstEntity.kind === "line"
      ? firstSegment.orientation === "forward"
        ? firstEntity.start
        : firstEntity.end
      : getOrientedArcStartPoint(firstEntity, firstSegment.orientation);
  let twiceSignedArea = 0;
  let compensation = 0;
  const accumulate = (term: number): void => {
    const corrected = term - compensation;
    const next = twiceSignedArea + corrected;
    compensation = next - twiceSignedArea - corrected;
    twiceSignedArea = next;
  };
  for (const segment of segments) {
    const entity = sketch.entities.find(
      (candidate) => candidate.id === segment.entityId
    );
    if (!entity || (entity.kind !== "line" && entity.kind !== "arc")) {
      return undefined;
    }
    if (entity.kind === "line") {
      const start =
        segment.orientation === "forward" ? entity.start : entity.end;
      const end = segment.orientation === "forward" ? entity.end : entity.start;
      const localStart: Vec2 = [start[0] - anchor[0], start[1] - anchor[1]];
      const localEnd: Vec2 = [end[0] - anchor[0], end[1] - anchor[1]];
      accumulate(localStart[0] * localEnd[1] - localEnd[0] * localStart[1]);
      continue;
    }
    const authoredStart = (entity.startAngleDegrees * Math.PI) / 180;
    const authoredSweep = (entity.sweepAngleDegrees * Math.PI) / 180;
    const startAngle =
      segment.orientation === "forward"
        ? authoredStart
        : authoredStart + authoredSweep;
    const sweep =
      segment.orientation === "forward" ? authoredSweep : -authoredSweep;
    const endAngle = startAngle + sweep;
    const localCenter: Vec2 = [
      entity.center[0] - anchor[0],
      entity.center[1] - anchor[1]
    ];
    accumulate(
      entity.radius *
        (localCenter[0] * (Math.sin(endAngle) - Math.sin(startAngle)) +
          localCenter[1] * (Math.cos(startAngle) - Math.cos(endAngle))) +
        entity.radius * entity.radius * sweep
    );
  }
  const signedArea = twiceSignedArea / 2;
  return Number.isFinite(signedArea) &&
    Math.abs(signedArea) > CAD_V19_SKETCH_GEOMETRY_POLICY.minimumProfileArea
    ? Math.sign(signedArea)
    : undefined;
}

function getOrientedArcStartPoint(
  arc: Extract<SketchEntitySnapshot, { readonly kind: "arc" }>,
  orientation: OrientedSketchSegmentRef["orientation"]
): Vec2 {
  const angleDegrees =
    orientation === "forward"
      ? arc.startAngleDegrees
      : arc.startAngleDegrees + arc.sweepAngleDegrees;
  const angle = (angleDegrees * Math.PI) / 180;
  return [
    arc.center[0] + arc.radius * Math.cos(angle),
    arc.center[1] + arc.radius * Math.sin(angle)
  ];
}

export function getSketchEntitySemanticLabel(
  entity: SketchEntitySnapshot,
  sketch: SketchSnapshot
): string {
  const sameKind = sketch.entities.filter(
    (candidate) => candidate.kind === entity.kind
  );
  const ordinal = sameKind.findIndex((candidate) => candidate.id === entity.id);
  return `${formatEntityKind(entity.kind)} ${ordinal + 1}`;
}

export function createSketchTrimIntervalChoices(
  target: SketchEntitySnapshot,
  preview: SketchCurveEditPreview,
  sketch: SketchSnapshot
): readonly SketchTrimIntervalChoice[] {
  if (
    target.kind !== "line" &&
    target.kind !== "arc" &&
    target.kind !== "circle"
  ) {
    return [];
  }
  const domainEnd =
    target.kind === "line"
      ? Math.hypot(
          target.end[0] - target.start[0],
          target.end[1] - target.start[1]
        )
      : target.kind === "arc"
        ? Math.abs(target.sweepAngleDegrees)
        : 360;
  const intersections = [
    ...new Map(
      preview.intersections.map((entry) => [
        `${normalizeCurveParameter(entry.targetParameter, domainEnd, target.kind === "circle")}:${entry.boundaryEntityId}`,
        {
          ...entry,
          targetParameter: normalizeCurveParameter(
            entry.targetParameter,
            domainEnd,
            target.kind === "circle"
          )
        }
      ])
    ).values()
  ].sort(
    (left, right) =>
      left.targetParameter - right.targetParameter ||
      left.boundaryEntityId.localeCompare(right.boundaryEntityId)
  );
  const uniqueParameters = [
    ...new Set(intersections.map((entry) => entry.targetParameter))
  ];
  if (uniqueParameters.length === 0) return [];
  if (target.kind === "circle" && uniqueParameters.length < 2) return [];

  const breakpoints = [...new Set([0, ...uniqueParameters, domainEnd])].sort(
    (left, right) => left - right
  );
  const ranges =
    target.kind === "circle"
      ? uniqueParameters.map((startParameter, index) => ({
          startParameter,
          endParameter:
            uniqueParameters[(index + 1) % uniqueParameters.length]! +
            (index === uniqueParameters.length - 1 ? domainEnd : 0)
        }))
      : breakpoints
          .slice(0, -1)
          .map((startParameter, index) => ({
            startParameter,
            endParameter: breakpoints[index + 1] ?? startParameter
          }))
          .filter(
            ({ startParameter, endParameter }) =>
              endParameter - startParameter > 1e-9
          );

  return ranges.map(({ startParameter, endParameter }, index) => {
    const witnessParameter = normalizeCurveParameter(
      (startParameter + endParameter) / 2,
      domainEnd,
      target.kind === "circle"
    );
    const adjacentBoundaryIds = intersections
      .filter(
        (entry) =>
          Math.abs(entry.targetParameter - startParameter) <= 1e-9 ||
          Math.abs(
            entry.targetParameter -
              normalizeCurveParameter(
                endParameter,
                domainEnd,
                target.kind === "circle"
              )
          ) <= 1e-9
      )
      .map((entry) => entry.boundaryEntityId);
    const boundaryNames = [
      ...new Set(
        adjacentBoundaryIds.map((id) => {
          const boundary = sketch.entities.find((entity) => entity.id === id);
          return boundary
            ? getSketchEntitySemanticLabel(boundary, sketch)
            : "selected boundary";
        })
      )
    ];
    return {
      key: `${startParameter}:${endParameter}:${index}`,
      label:
        boundaryNames.length > 0
          ? `Interval ${index + 1} · ${boundaryNames.join(" / ")}`
          : `Interval ${index + 1}`,
      witnessPoint: getSketchEntityPointAtParameter(target, witnessParameter),
      startParameter,
      endParameter,
      boundaryEntityIds: [...new Set(adjacentBoundaryIds)]
    };
  });
}

export function createSketchExtendHitChoices(
  endpoint: "start" | "end",
  preview: SketchCurveEditPreview,
  sketch: SketchSnapshot,
  target?: Extract<SketchEntitySnapshot, { readonly kind: "line" | "arc" }>
): readonly SketchExtendHitChoice[] {
  const endpointParameter =
    endpoint === "start" || !target
      ? 0
      : target.kind === "line"
        ? Math.hypot(
            target.end[0] - target.start[0],
            target.end[1] - target.start[1]
          )
        : Math.abs(target.sweepAngleDegrees);
  const nearestByBoundary = new Map<
    string,
    SketchCurveEditPreview["intersections"][number]
  >();
  for (const intersection of preview.intersections) {
    const current = nearestByBoundary.get(intersection.boundaryEntityId);
    if (
      !current ||
      Math.abs(intersection.targetParameter - endpointParameter) <
        Math.abs(current.targetParameter - endpointParameter)
    ) {
      nearestByBoundary.set(intersection.boundaryEntityId, intersection);
    }
  }
  return [...nearestByBoundary.values()].map((intersection, index) => {
    const boundary = sketch.entities.find(
      (entity) => entity.id === intersection.boundaryEntityId
    );
    return {
      key: `${endpoint}:${intersection.boundaryEntityId}`,
      label: `${endpoint === "start" ? "Start" : "End"} endpoint → ${
        boundary
          ? getSketchEntitySemanticLabel(boundary, sketch)
          : `Boundary ${index + 1}`
      } at (${formatChoiceNumber(intersection.point[0])}, ${formatChoiceNumber(intersection.point[1])})`,
      endpoint,
      boundaryEntityId: intersection.boundaryEntityId,
      hitPoint: intersection.point
    };
  });
}

export function discoverSketchExtendHitChoices(input: {
  readonly sketch: SketchSnapshot;
  readonly target: Extract<
    SketchEntitySnapshot,
    { readonly kind: "line" | "arc" }
  >;
  readonly boundaryEntityIds: readonly string[];
  readonly readReadiness: (
    proposal: SketchCurveEditProposal
  ) => SketchCurveEditReadinessQueryResponse;
}): readonly SketchExtendHitChoice[] {
  return (["start", "end"] as const).flatMap((endpoint) => {
    const readiness = input.readReadiness({
      kind: "extend",
      sketchId: input.sketch.id,
      entityId: input.target.id,
      endpoint,
      boundaryEntityIds: input.boundaryEntityIds
    });
    return readiness.preview
      ? createSketchExtendHitChoices(
          endpoint,
          readiness.preview,
          input.sketch,
          input.target
        )
      : [];
  });
}

export function formatCurveEditDiagnostic(
  diagnostic: CadSketchEditDiagnostic
): string {
  switch (diagnostic.code) {
    case "SKETCH_EDIT_INTERSECTION_MISSING":
      return "The selected curves do not meet in a usable location.";
    case "SKETCH_EDIT_INTERSECTION_AMBIGUOUS":
      return "More than one edit result is possible. Refine the selected boundaries or point.";
    case "SKETCH_EDIT_BOUNDARY_MISSING":
      return "Choose at least one supported boundary curve.";
    case "SKETCH_EDIT_PICK_OFF_CURVE":
      return "Choose a removal or split point directly on the target curve.";
    case "SKETCH_EDIT_ZERO_LENGTH_RESULT":
      return "This choice would leave a zero-length curve. Choose another interval or hit.";
    case "SKETCH_EDIT_MISSING_SKETCH":
      return "The edited sketch is no longer available. Close this draft and choose another sketch.";
    case "SKETCH_EDIT_MISSING_ENTITY":
      return "One of the selected sketch entities is no longer available.";
    case "SKETCH_EDIT_DELETE_LIST_MISMATCH":
      return "The required constraint or dimension removals changed. Refresh the preview.";
    case "SKETCH_EDIT_TARGET_UNSUPPORTED":
      return "This sketch entity is not supported by the active edit.";
    case "SKETCH_EDIT_INVALID_PROPOSAL":
    case "SKETCH_EDIT_INVALID_VALUE":
      return "One or more edit choices are invalid. Review the highlighted inputs.";
    case "SKETCH_EDIT_SOURCE_REVISION_STALE":
      return "The sketch changed while this preview was open. Refresh the edit choices.";
    case "SKETCH_EDIT_SOLVER_STATE_BLOCKED":
      return "Repair the sketch constraints before applying this edit.";
    case "SKETCH_EDIT_CONFLICTING_CONSTRAINT":
      return "One or more affected constraints must be removed before this edit can apply.";
    case "SKETCH_EDIT_DEPENDENCY_CONFLICT":
      return "A downstream feature still depends on geometry this edit would remove.";
    case "SKETCH_OFFSET_SIDE_AMBIGUOUS":
      return "The reference witness does not identify one unambiguous side of the submitted source.";
    case "SKETCH_OFFSET_RADIUS_COLLAPSED":
      return "This distance would collapse or reverse a circle or arc radius.";
    case "SKETCH_OFFSET_JOIN_UNSUPPORTED":
      return "The selected chain has no supported exact analytic join at this distance and side.";
    case "SKETCH_OFFSET_SELF_INTERSECTION":
      return "This offset would cross or overlap itself. Choose another distance or side.";
    default:
      return "This edit is not ready. Review the highlighted choices and try again.";
  }
}

export function summarizeCurveEditImpact(
  impact: SketchCurveEditImpact
): readonly string[] {
  const invalidConstraints = impact.constraintImpacts.filter(
    (item) => item.disposition === "invalid"
  ).length;
  const retargetedConstraints = impact.constraintImpacts.filter(
    (item) => item.disposition === "retargeted"
  ).length;
  const invalidDimensions = impact.dimensionImpacts.filter(
    (item) => item.disposition === "invalid"
  ).length;
  const retargetedDimensions = impact.dimensionImpacts.filter(
    (item) => item.disposition === "retargeted"
  ).length;

  return [
    `${impact.replacements.length} geometry replacement${impact.replacements.length === 1 ? "" : "s"}`,
    `${retargetedConstraints} constraint${retargetedConstraints === 1 ? "" : "s"} retargeted`,
    `${invalidConstraints} constraint${invalidConstraints === 1 ? "" : "s"} must be removed`,
    `${retargetedDimensions} dimension${retargetedDimensions === 1 ? "" : "s"} retargeted`,
    `${invalidDimensions} dimension${invalidDimensions === 1 ? "" : "s"} must be removed`,
    `${impact.affectedFeatureIds.length} downstream feature${impact.affectedFeatureIds.length === 1 ? "" : "s"} affected`,
    `Post-edit solver: ${impact.postEditSolverStatus}`
  ];
}

export function isCurveEditReady(
  readiness: SketchCurveEditReadinessQueryResponse | undefined
): readiness is Extract<
  SketchCurveEditReadinessQueryResponse,
  { readonly status: "ready" }
> {
  return readiness?.status === "ready";
}

export function projectSketchCurveEditReadiness(
  committedReadiness: SketchCurveEditReadinessQueryResponse | undefined,
  hoverReadiness: SketchCurveEditReadinessQueryResponse | undefined
): SketchCurveEditReadinessProjection {
  return {
    displayReadiness: hoverReadiness ?? committedReadiness,
    ...(hoverReadiness === undefined && isCurveEditReady(committedReadiness)
      ? { applyOperation: committedReadiness.preparedOperation }
      : {}),
    displayingHoverPreview: hoverReadiness !== undefined
  };
}

function appendUniquePoint(
  points: readonly Vec2[],
  point: Vec2
): readonly Vec2[] {
  return points.some(
    (candidate) => candidate[0] === point[0] && candidate[1] === point[1]
  )
    ? points
    : [...points, point];
}

export function getSketchEntityWitnessPoint(
  entity: SketchEntitySnapshot,
  fraction = 0.3819660112501051
): Vec2 {
  switch (entity.kind) {
    case "point":
      return entity.point;
    case "line":
      return [
        entity.start[0] + (entity.end[0] - entity.start[0]) * fraction,
        entity.start[1] + (entity.end[1] - entity.start[1]) * fraction
      ];
    case "rectangle":
      return entity.center;
    case "circle":
      return [entity.center[0] + entity.radius, entity.center[1]];
    case "arc": {
      const angle =
        ((entity.startAngleDegrees + entity.sweepAngleDegrees * fraction) *
          Math.PI) /
        180;
      return [
        entity.center[0] + entity.radius * Math.cos(angle),
        entity.center[1] + entity.radius * Math.sin(angle)
      ];
    }
  }
}

export function getSketchEntityDiscoveryWitnessPoints(
  entity: SketchEntitySnapshot
): readonly Vec2[] {
  const fractions = [0.21132486540518713, 0.5, 0.7886751345948129] as const;
  if (entity.kind === "circle") {
    return [0, 90, 180, 270, 76.39320225002103].map((angleDegrees) => {
      const angle = (angleDegrees * Math.PI) / 180;
      return [
        entity.center[0] + entity.radius * Math.cos(angle),
        entity.center[1] + entity.radius * Math.sin(angle)
      ] as Vec2;
    });
  }
  return fractions.map((fraction) =>
    getSketchEntityWitnessPoint(entity, fraction)
  );
}

function getSketchEntityPointAtParameter(
  entity: Extract<
    SketchEntitySnapshot,
    { readonly kind: "line" | "arc" | "circle" }
  >,
  parameter: number
): Vec2 {
  if (entity.kind === "line") {
    const length = Math.hypot(
      entity.end[0] - entity.start[0],
      entity.end[1] - entity.start[1]
    );
    const fraction = length > 0 ? parameter / length : 0;
    return [
      entity.start[0] + (entity.end[0] - entity.start[0]) * fraction,
      entity.start[1] + (entity.end[1] - entity.start[1]) * fraction
    ];
  }
  const angleDegrees =
    entity.kind === "arc"
      ? entity.startAngleDegrees +
        Math.sign(entity.sweepAngleDegrees) * parameter
      : parameter;
  const angle = (angleDegrees * Math.PI) / 180;
  return [
    entity.center[0] + entity.radius * Math.cos(angle),
    entity.center[1] + entity.radius * Math.sin(angle)
  ];
}

function normalizeCurveParameter(
  parameter: number,
  domainEnd: number,
  cyclic: boolean
): number {
  if (!cyclic) return Math.min(domainEnd, Math.max(0, parameter));
  const normalized = ((parameter % domainEnd) + domainEnd) % domainEnd;
  return Object.is(normalized, -0) ? 0 : normalized;
}

function formatChoiceNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3);
}

function formatEntityKind(kind: SketchEntitySnapshot["kind"]): string {
  switch (kind) {
    case "point":
      return "Point";
    case "line":
      return "Line";
    case "rectangle":
      return "Rectangle";
    case "circle":
      return "Circle";
    case "arc":
      return "Arc";
  }
}
