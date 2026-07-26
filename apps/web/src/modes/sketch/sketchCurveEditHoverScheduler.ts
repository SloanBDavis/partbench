import type { Vec2 } from "@web-cad/cad-protocol";

export interface SketchCurveEditHoverChoice {
  readonly entityId?: string;
  readonly point?: Vec2;
}

export interface SketchCurveEditHoverPublicationState {
  readonly semanticKey?: string;
  readonly publishedAt: number;
}

export const SKETCH_CURVE_EDIT_HOVER_INTERVAL_MS = 50;
export const SKETCH_CURVE_EDIT_HOVER_POINT_QUANTUM = 0.05;

export function createSketchCurveEditHoverSemanticKey(
  choice: SketchCurveEditHoverChoice
): string {
  const point = choice.point
    ? choice.point.map((coordinate) =>
        Math.round(coordinate / SKETCH_CURVE_EDIT_HOVER_POINT_QUANTUM)
      )
    : undefined;
  return `${choice.entityId ?? "none"}:${point?.[0] ?? "x"}:${point?.[1] ?? "y"}`;
}

export function shouldPublishSketchCurveEditHover(
  previous: SketchCurveEditHoverPublicationState,
  nextSemanticKey: string,
  now: number
): boolean {
  if (previous.semanticKey === nextSemanticKey) return false;
  if (previous.semanticKey === undefined) return true;
  return now - previous.publishedAt >= SKETCH_CURVE_EDIT_HOVER_INTERVAL_MS;
}

export interface SketchCurveEditHoverSchedulerOptions {
  readonly publish: (choice: SketchCurveEditHoverChoice) => void;
  readonly now?: () => number;
  readonly setTimer?: (callback: () => void, delayMs: number) => number;
  readonly clearTimer?: (timerId: number) => void;
  readonly intervalMs?: number;
}

/**
 * Publishes immediately when the bound allows and always trails the latest
 * semantic hover when raw pointer movement stops inside the interval.
 */
export class SketchCurveEditHoverScheduler {
  readonly #publish: (choice: SketchCurveEditHoverChoice) => void;
  readonly #now: () => number;
  readonly #setTimer: (callback: () => void, delayMs: number) => number;
  readonly #clearTimer: (timerId: number) => void;
  readonly #intervalMs: number;
  #publishedKey: string | undefined;
  #publishedAt = Number.NEGATIVE_INFINITY;
  #pending:
    | { readonly key: string; readonly choice: SketchCurveEditHoverChoice }
    | undefined;
  #timerId: number | undefined;

  constructor(options: SketchCurveEditHoverSchedulerOptions) {
    this.#publish = options.publish;
    this.#now = options.now ?? (() => performance.now());
    this.#setTimer =
      options.setTimer ??
      ((callback, delayMs) => window.setTimeout(callback, delayMs));
    this.#clearTimer =
      options.clearTimer ?? ((timerId) => window.clearTimeout(timerId));
    this.#intervalMs =
      options.intervalMs ?? SKETCH_CURVE_EDIT_HOVER_INTERVAL_MS;
  }

  schedule(choice: SketchCurveEditHoverChoice): void {
    const key = createSketchCurveEditHoverSemanticKey(choice);
    if (key === this.#pending?.key) return;
    if (key === this.#publishedKey) {
      // The pointer returned to the displayed semantic hover. A previously
      // queued different hover is no longer the latest and must not flash.
      this.#cancelPending();
      return;
    }
    const now = this.#now();
    if (now - this.#publishedAt >= this.#intervalMs) {
      this.#cancelPending();
      this.#publishNow(key, choice, now);
      return;
    }
    this.#pending = { key, choice };
    if (this.#timerId !== undefined) return;
    this.#timerId = this.#setTimer(
      () => this.#flushPending(),
      Math.max(0, this.#intervalMs - (now - this.#publishedAt))
    );
  }

  clear(): void {
    this.#cancelPending();
    this.#publishedKey = undefined;
    this.#publishedAt = Number.NEGATIVE_INFINITY;
  }

  #flushPending(): void {
    this.#timerId = undefined;
    const pending = this.#pending;
    this.#pending = undefined;
    if (!pending || pending.key === this.#publishedKey) return;
    this.#publishNow(pending.key, pending.choice, this.#now());
  }

  #publishNow(
    key: string,
    choice: SketchCurveEditHoverChoice,
    now: number
  ): void {
    this.#publishedKey = key;
    this.#publishedAt = now;
    this.#publish(choice);
  }

  #cancelPending(): void {
    if (this.#timerId !== undefined) this.#clearTimer(this.#timerId);
    this.#timerId = undefined;
    this.#pending = undefined;
  }
}
