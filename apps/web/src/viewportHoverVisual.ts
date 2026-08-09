import { parseSketchRenderId } from "./sketchRenderIds";
import { createViewportBodyHitTarget } from "./viewportPickIntent";
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
  const target = createViewportBodyHitTarget({
    pickedRenderId: hoveredRenderId,
    bodies,
    objects
  });
  if (target.kind === "body" || target.kind === "object") {
    const status = readReferenceCandidates?.({
      type: "body",
      bodyId: target.bodyId
    })?.status;
    return {
      kind: target.kind,
      tone:
        status === "resolved"
          ? "ready"
          : status === "consumed"
            ? "warning"
            : status
              ? "blocked"
              : "idle",
      renderTargetId: target.renderTargetId
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
