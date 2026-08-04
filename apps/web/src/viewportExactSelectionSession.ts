import type {
  RenderExactPickBody,
  RenderExactPickCandidate,
  RenderExactPickResult,
  ViewportPoint
} from "@web-cad/renderer";
import {
  createViewportExactSelection,
  isSameViewportExactSelection,
  type ViewportExactSelection
} from "./viewportPickIntent";

const MAX_EXACT_SELECTIONS = 64;

export interface ViewportExactCandidateSession extends RenderExactPickResult {
  readonly bodies: readonly RenderExactPickBody[];
  readonly point: ViewportPoint;
  readonly index: number;
}

export function reconcileViewportExactCandidateSession(
  current: ViewportExactCandidateSession | undefined,
  result: RenderExactPickResult | undefined,
  point: ViewportPoint | undefined,
  bodies: readonly RenderExactPickBody[]
): ViewportExactCandidateSession | undefined {
  if (!result || !point) return undefined;
  const keepIndex =
    current &&
    current.bodies === bodies &&
    Math.hypot(current.point.x - point.x, current.point.y - point.y) <= 10 &&
    sameCandidates(current.candidates, result.candidates);
  return {
    ...result,
    bodies,
    point,
    index: keepIndex
      ? Math.max(0, Math.min(current.index, result.candidates.length - 1))
      : 0
  };
}

export function updateViewportExactSelections(
  current: readonly ViewportExactSelection[],
  candidate: RenderExactPickCandidate,
  additive: boolean
): readonly ViewportExactSelection[] {
  const selection = createViewportExactSelection(candidate);
  if (!additive) return [selection];
  const existing = current.findIndex((entry) =>
    isSameViewportExactSelection(entry, selection)
  );
  return existing < 0 && current.length < MAX_EXACT_SELECTIONS
    ? [...current, selection]
    : current;
}

function sameCandidates(
  left: readonly RenderExactPickCandidate[],
  right: readonly RenderExactPickCandidate[]
): boolean {
  return (
    left.length === right.length &&
    left.every(
      (candidate, index) =>
        right[index] !== undefined &&
        isSameViewportExactSelection(candidate, right[index])
    )
  );
}
