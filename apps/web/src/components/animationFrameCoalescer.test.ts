import { describe, expect, it, vi } from "vitest";
import {
  createAnimationFrameCoalescer,
  getViewportBackingPixelRatio,
  shouldNotifyViewportHover
} from "./animationFrameCoalescer";

describe("createAnimationFrameCoalescer", () => {
  it("delivers only the newest sample once per animation frame", () => {
    const callbacks = new Map<number, FrameRequestCallback>();
    const onFrame = vi.fn();
    let nextFrameId = 0;
    const coalescer = createAnimationFrameCoalescer<number>({
      cancelFrame: (frameId) => callbacks.delete(frameId),
      onFrame,
      requestFrame: (callback) => {
        const frameId = ++nextFrameId;
        callbacks.set(frameId, callback);
        return frameId;
      }
    });

    coalescer.schedule(1);
    coalescer.schedule(2);
    coalescer.schedule(3);

    expect(callbacks.size).toBe(1);
    callbacks.values().next().value?.(16);
    expect(onFrame).toHaveBeenCalledOnce();
    expect(onFrame).toHaveBeenCalledWith(3);
  });

  it("cancels queued work and can synchronously flush the final sample", () => {
    const callbacks = new Map<number, FrameRequestCallback>();
    const onFrame = vi.fn();
    let nextFrameId = 0;
    const coalescer = createAnimationFrameCoalescer<string>({
      cancelFrame: (frameId) => callbacks.delete(frameId),
      onFrame,
      requestFrame: (callback) => {
        const frameId = ++nextFrameId;
        callbacks.set(frameId, callback);
        return frameId;
      }
    });

    coalescer.schedule("discarded");
    coalescer.cancel();
    expect(callbacks.size).toBe(0);
    expect(onFrame).not.toHaveBeenCalled();

    coalescer.schedule("committed");
    coalescer.flush();
    expect(callbacks.size).toBe(0);
    expect(onFrame).toHaveBeenCalledWith("committed");
  });
});

describe("viewport hot-path policies", () => {
  it("caps canvas backing resolution at 2x while retaining lower valid ratios", () => {
    expect(getViewportBackingPixelRatio(3)).toBe(2);
    expect(getViewportBackingPixelRatio(2)).toBe(2);
    expect(getViewportBackingPixelRatio(1.25)).toBe(1.25);
    expect(getViewportBackingPixelRatio(0)).toBe(1);
    expect(getViewportBackingPixelRatio(Number.NaN)).toBe(1);
  });

  it("notifies ordinary hover only for semantic changes with point tracking opt-in", () => {
    expect(shouldNotifyViewportHover(undefined, undefined, false)).toBe(false);
    expect(shouldNotifyViewportHover("body-a", "body-a", false)).toBe(false);
    expect(shouldNotifyViewportHover("body-a", "body-b", false)).toBe(true);
    expect(shouldNotifyViewportHover("body-a", undefined, false)).toBe(true);
    expect(shouldNotifyViewportHover("body-a", "body-a", true)).toBe(true);
  });
});
