import {
  canonicalizeSketchArcDefinition,
  getSketchArcPoint
} from "@web-cad/cad-core";
import type {
  OrientedSketchSegmentRef,
  SketchArcDefinition,
  SketchPathCandidate,
  SketchPathCandidatesQueryResponse,
  SketchPathDiagnostic,
  SketchPathRef,
  SketchProfileCandidate,
  SketchProfileCandidatesQueryResponse,
  SketchProfileDiagnostic,
  SketchProfileRef,
  SketchSnapshot,
  Vec2
} from "@web-cad/cad-protocol";

export interface CandidateChoice<T> {
  readonly selectedKey?: string;
  readonly selected?: T;
  readonly requiresExplicitChoice: boolean;
}

export function chooseProfileCandidate(
  response: SketchProfileCandidatesQueryResponse | undefined,
  selectedKey?: string
): CandidateChoice<SketchProfileCandidate> {
  return chooseCandidate(response?.candidates ?? [], selectedKey);
}

export function choosePathCandidate(
  response: SketchPathCandidatesQueryResponse | undefined,
  selectedKey?: string
): CandidateChoice<SketchPathCandidate> {
  return chooseCandidate(response?.candidates ?? [], selectedKey);
}

export function getEligibleProfileCandidates(
  candidates: readonly SketchProfileCandidate[],
  consumer: "extrude" | "revolve" | "sweep"
): readonly SketchProfileCandidate[] {
  return consumer === "sweep"
    ? candidates.filter((candidate) => candidate.profile.kind === "entity")
    : candidates;
}

export function findProfileCandidateKey(
  response: SketchProfileCandidatesQueryResponse | undefined,
  profile: SketchProfileRef
): string | undefined {
  return response?.candidates.find((candidate) =>
    areSketchRefsEqual(candidate.profile, profile)
  )?.sortKey;
}

export function findPathCandidateSelection(
  response: SketchPathCandidatesQueryResponse | undefined,
  path: SketchPathRef
): { readonly key: string; readonly reversed: boolean } | undefined {
  const exact = response?.candidates.find((candidate) =>
    areSketchRefsEqual(candidate.path, path)
  );
  if (exact) return { key: exact.sortKey, reversed: false };
  const reversed = response?.candidates.find((candidate) =>
    areSketchRefsEqual(reverseSketchPath(candidate.path), path)
  );
  return reversed ? { key: reversed.sortKey, reversed: true } : undefined;
}

export function areSketchRefsEqual(
  left: SketchProfileRef | SketchPathRef,
  right: SketchProfileRef | SketchPathRef
): boolean {
  if (left.kind !== right.kind || left.sketchId !== right.sketchId)
    return false;
  if (left.kind === "entity" && right.kind === "entity") {
    const leftOrientation =
      "orientation" in left ? left.orientation : undefined;
    const rightOrientation =
      "orientation" in right ? right.orientation : undefined;
    return (
      left.entityId === right.entityId && leftOrientation === rightOrientation
    );
  }
  if (left.kind === "wire" && right.kind === "wire") {
    return segmentsEqual(left.segments, right.segments);
  }
  if (left.kind === "chain" && right.kind === "chain") {
    return segmentsEqual(left.segments, right.segments);
  }
  return false;
}

function segmentsEqual(
  left: readonly OrientedSketchSegmentRef[],
  right: readonly OrientedSketchSegmentRef[]
): boolean {
  return (
    left.length === right.length &&
    left.every(
      (segment, index) =>
        segment.entityId === right[index]?.entityId &&
        segment.orientation === right[index]?.orientation
    )
  );
}

function chooseCandidate<T extends { readonly sortKey: string }>(
  candidates: readonly T[],
  selectedKey?: string
): CandidateChoice<T> {
  const selected = selectedKey
    ? candidates.find((candidate) => candidate.sortKey === selectedKey)
    : undefined;

  return {
    selectedKey: selected?.sortKey,
    selected,
    requiresExplicitChoice: candidates.length > 0 && selected === undefined
  };
}

export function reverseSketchPath(path: SketchPathRef): SketchPathRef {
  if (path.kind === "entity") {
    return {
      ...path,
      orientation: path.orientation === "forward" ? "reverse" : "forward"
    };
  }

  return {
    ...path,
    segments: [...path.segments]
      .reverse()
      .map((segment) => reverseSegment(segment))
  };
}

function reverseSegment(
  segment: OrientedSketchSegmentRef
): OrientedSketchSegmentRef {
  return {
    entityId: segment.entityId,
    orientation: segment.orientation === "forward" ? "reverse" : "forward"
  };
}

export function formatSketchProfileMembership(
  profile: SketchProfileRef
): string {
  return profile.kind === "entity"
    ? profile.entityId
    : profile.segments
        .map(
          (segment, index) =>
            `${index + 1}. ${segment.entityId} (${segment.orientation})`
        )
        .join(" · ");
}

export function formatSketchPathMembership(path: SketchPathRef): string {
  return path.kind === "entity"
    ? `1. ${path.entityId} (${path.orientation})`
    : path.segments
        .map(
          (segment, index) =>
            `${index + 1}. ${segment.entityId} (${segment.orientation})`
        )
        .join(" · ");
}

export function describeSketchPathEndpoints(
  sketch: SketchSnapshot,
  path: SketchPathRef
): { readonly start: Vec2; readonly end: Vec2 } | undefined {
  const segments =
    path.kind === "entity"
      ? [{ entityId: path.entityId, orientation: path.orientation }]
      : path.segments;
  const first = segments[0];
  const last = segments.at(-1);
  if (!first || !last) return undefined;

  const start = getOrientedEndpoint(sketch, first, "start");
  const end = getOrientedEndpoint(sketch, last, "end");
  return start && end ? { start, end } : undefined;
}

function getOrientedEndpoint(
  sketch: SketchSnapshot,
  segment: OrientedSketchSegmentRef,
  role: "start" | "end"
): Vec2 | undefined {
  const entity = sketch.entities.find(
    (candidate) => candidate.id === segment.entityId
  );
  if (!entity || (entity.kind !== "line" && entity.kind !== "arc")) {
    return undefined;
  }
  const authoredRole =
    segment.orientation === "forward"
      ? role
      : role === "start"
        ? "end"
        : "start";
  return entity.kind === "line"
    ? entity[authoredRole]
    : getSketchArcPoint(entity, authoredRole);
}

export function formatCandidateDiagnostics(
  diagnostics: readonly (SketchProfileDiagnostic | SketchPathDiagnostic)[]
): readonly string[] {
  return diagnostics.map((diagnostic) => {
    const location = [
      diagnostic.entityId ? `entity ${diagnostic.entityId}` : undefined,
      diagnostic.segmentIndex !== undefined
        ? `segment ${diagnostic.segmentIndex + 1}`
        : undefined,
      diagnostic.joinIndex !== undefined
        ? `join ${diagnostic.joinIndex + 1}`
        : undefined
    ]
      .filter(Boolean)
      .join(", ");
    const repair = diagnostic.expected
      ? ` Expected ${diagnostic.expected}${diagnostic.received ? `; received ${diagnostic.received}` : ""}.`
      : "";
    return `${diagnostic.message}${location ? ` (${location})` : ""}${repair}`;
  });
}

export type ThreePointArcToolStage =
  | "start"
  | "pointOnArc"
  | "end"
  | "complete";

export interface ThreePointArcToolSession {
  readonly sketchId: string;
  readonly points: readonly Vec2[];
  readonly hoverPoint?: Vec2;
}

export function createThreePointArcToolSession(
  sketchId: string
): ThreePointArcToolSession {
  return { sketchId, points: [] };
}

export function getThreePointArcToolStage(
  session: ThreePointArcToolSession
): ThreePointArcToolStage {
  return session.points.length === 0
    ? "start"
    : session.points.length === 1
      ? "pointOnArc"
      : session.points.length === 2
        ? "end"
        : "complete";
}

export function updateThreePointArcToolHover(
  session: ThreePointArcToolSession,
  point: Vec2 | undefined
): ThreePointArcToolSession {
  return { ...session, hoverPoint: point };
}

export function captureThreePointArcToolPoint(
  session: ThreePointArcToolSession,
  point: Vec2
): ThreePointArcToolSession {
  if (session.points.length >= 3) return session;
  const points = [...session.points, point];
  if (
    points.length === 3 &&
    !canonicalizeSketchArcDefinition({
      kind: "threePoint",
      start: points[0]!,
      pointOnArc: points[1]!,
      end: points[2]!
    }).ok
  ) {
    return { ...session, hoverPoint: point };
  }
  return { ...session, points, hoverPoint: undefined };
}

export function getThreePointArcDefinition(
  session: ThreePointArcToolSession
): SketchArcDefinition | undefined {
  if (session.points.length !== 3) return undefined;
  const definition: SketchArcDefinition = {
    kind: "threePoint",
    start: session.points[0]!,
    pointOnArc: session.points[1]!,
    end: session.points[2]!
  };
  return canonicalizeSketchArcDefinition(definition).ok
    ? definition
    : undefined;
}

export function getThreePointArcPreview(session: ThreePointArcToolSession) {
  const previewPoints = session.hoverPoint
    ? [...session.points, session.hoverPoint]
    : session.points;
  if (previewPoints.length !== 3) return undefined;
  return canonicalizeSketchArcDefinition({
    kind: "threePoint",
    start: previewPoints[0]!,
    pointOnArc: previewPoints[1]!,
    end: previewPoints[2]!
  });
}
