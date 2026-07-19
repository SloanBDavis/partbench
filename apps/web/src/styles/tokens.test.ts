import { describe, expect, it } from "vitest";
import { clampDockWidth, WORKBENCH_LAYOUT } from "./tokens";

describe("workbench layout tokens", () => {
  it("matches the fixed V18 sizing contract", () => {
    expect(WORKBENCH_LAYOUT).toMatchObject({
      leftDock: { default: 282, min: 220, max: 380 },
      rightDock: { default: 350, min: 300, max: 460 },
      minimumInlineViewportWidth: 480,
      inlineDocksBreakpoint: 1200,
      rightDrawerBreakpoint: 960,
      headerMaxHeight: 48,
      ribbonMaxHeight: 108,
      statusMaxHeight: 40
    });
  });

  it("normalizes finite, fractional, and invalid widths", () => {
    expect(clampDockWidth("left", 301.7)).toBe(302);
    expect(clampDockWidth("right", Number.NaN)).toBe(350);
    expect(clampDockWidth("left", Number.POSITIVE_INFINITY)).toBe(282);
  });
});
