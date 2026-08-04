import { parseSketchRenderId } from "./sketchRenderIds";
import type {
  ResolveViewportHoverIntentInput,
  ViewportHoverTone
} from "./viewportHoverIntent";

export type ViewportHoverVisualState =
  | { readonly kind: "empty"; readonly tone: "idle" }
  | {
      readonly kind: "body" | "object" | "sketchEntity";
      readonly tone: ViewportHoverTone;
      readonly renderTargetId: string;
    }
  | {
      readonly kind: "unsupported" | "missing";
      readonly tone: "blocked";
      readonly renderTargetId?: undefined;
    };

export function resolveViewportHoverVisualState({
  hoveredRenderId,
  bodies,
  objects,
  readReferenceCandidates
}: ResolveViewportHoverIntentInput): ViewportHoverVisualState {
  if (!hoveredRenderId) return { kind: "empty", tone: "idle" };
  const body = bodies.find(({ id }) => id === hoveredRenderId);
  const object = body
    ? undefined
    : objects.find(({ id }) => id === hoveredRenderId);
  if (body || object) {
    const targetBody =
      body ?? bodies.find(({ objectId }) => objectId === object?.id);
    const status = targetBody
      ? readReferenceCandidates?.({ type: "body", bodyId: targetBody.id })
          ?.status
      : undefined;
    return {
      kind: body ? "body" : "object",
      tone:
        status === "resolved"
          ? "ready"
          : status === "consumed"
            ? "warning"
            : status
              ? "blocked"
              : "idle",
      renderTargetId: hoveredRenderId
    };
  }
  const sketchTarget = parseSketchRenderId(hoveredRenderId);
  if (sketchTarget?.kind === "sketchEntity") {
    return {
      kind: "sketchEntity",
      tone: "idle",
      renderTargetId: hoveredRenderId
    };
  }
  return {
    kind: sketchTarget ? "unsupported" : "missing",
    tone: "blocked"
  };
}
