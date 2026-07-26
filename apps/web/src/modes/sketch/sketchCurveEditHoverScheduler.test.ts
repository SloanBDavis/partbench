import { afterEach, describe, expect, it, vi } from "vitest";
import { SketchCurveEditHoverScheduler } from "./sketchCurveEditHoverScheduler";

describe("V19 curve-edit hover scheduler", () => {
  afterEach(() => vi.useRealTimers());

  it("publishes the latest trailing semantic hover when movement stops", () => {
    vi.useFakeTimers();
    let now = 0;
    const published: unknown[] = [];
    const scheduler = new SketchCurveEditHoverScheduler({
      now: () => now,
      publish: (choice) => published.push(choice),
      setTimer: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
      clearTimer: (timerId) => globalThis.clearTimeout(timerId)
    });

    scheduler.schedule({ entityId: "line-a", point: [0, 0] });
    now = 10;
    scheduler.schedule({ entityId: "line-a", point: [1, 0] });
    now = 20;
    scheduler.schedule({ entityId: "line-a", point: [2, 0] });

    expect(published).toEqual([{ entityId: "line-a", point: [0, 0] }]);
    now = 50;
    vi.advanceTimersByTime(40);
    expect(published).toEqual([
      { entityId: "line-a", point: [0, 0] },
      { entityId: "line-a", point: [2, 0] }
    ]);
  });

  it("cancels a pending trailing hover with the editor session", () => {
    vi.useFakeTimers();
    let now = 0;
    const publish = vi.fn();
    const scheduler = new SketchCurveEditHoverScheduler({
      now: () => now,
      publish,
      setTimer: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
      clearTimer: (timerId) => globalThis.clearTimeout(timerId)
    });

    scheduler.schedule({ point: [0, 0] });
    now = 10;
    scheduler.schedule({ point: [1, 0] });
    scheduler.clear();
    now = 100;
    vi.runAllTimers();

    expect(publish).toHaveBeenCalledTimes(1);
  });

  it("does not publish an obsolete trailing hover after returning to the displayed choice", () => {
    vi.useFakeTimers();
    let now = 0;
    const publish = vi.fn();
    const scheduler = new SketchCurveEditHoverScheduler({
      now: () => now,
      publish,
      setTimer: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
      clearTimer: (timerId) => globalThis.clearTimeout(timerId)
    });

    scheduler.schedule({ entityId: "line-a", point: [0, 0] });
    now = 10;
    scheduler.schedule({ entityId: "line-b", point: [1, 0] });
    now = 20;
    scheduler.schedule({ entityId: "line-a", point: [0, 0] });
    now = 100;
    vi.runAllTimers();

    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith({
      entityId: "line-a",
      point: [0, 0]
    });
  });
});
