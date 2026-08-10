import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  dragViewportFeatureGripValue,
  parseViewportFeatureGripValue,
  stepViewportFeatureGripValue,
  ViewportFeatureGrips,
  type ViewportFeatureGripDescriptor
} from "./ViewportFeatureGrips";

const depth: ViewportFeatureGripDescriptor = {
  id: "depth",
  label: "Extrude depth",
  value: 10,
  unit: "mm",
  normalStep: 1,
  shiftStep: 5,
  min: 1,
  max: 20
};

describe("ViewportFeatureGrips", () => {
  it("renders an accessible handle and typed value editor", () => {
    const markup = renderToStaticMarkup(
      createElement(ViewportFeatureGrips, { grips: [depth] })
    );

    expect(markup).toContain('role="group"');
    expect(markup).toContain('aria-label="Drag Extrude depth"');
    expect(markup).toContain('aria-label="Extrude depth value"');
    expect(markup).toContain('value="10"');
    expect(markup).toContain("mm");
    expect(markup).toContain("Shift for a larger step");
    expect(markup).toContain("Enter applies and Escape cancels");
  });

  it("computes bounded horizontal pointer steps", () => {
    expect(dragViewportFeatureGripValue(depth, 10, 16)).toBe(12);
    expect(dragViewportFeatureGripValue(depth, 10, -80)).toBe(1);
    expect(dragViewportFeatureGripValue(depth, 10, 4)).toBeUndefined();
    expect(dragViewportFeatureGripValue(depth, 10, 8, true)).toBe(15);
  });

  it("computes normal and Shift keyboard increments", () => {
    expect(stepViewportFeatureGripValue(depth, 1)).toBe(11);
    expect(stepViewportFeatureGripValue(depth, -1)).toBe(9);
    expect(stepViewportFeatureGripValue(depth, 1, true)).toBe(15);
    expect(stepViewportFeatureGripValue(depth, 1, false, 19)).toBe(20);
  });

  it("accepts finite typed values and blocks invalid, nonfinite, and out-of-range text", () => {
    expect(parseViewportFeatureGripValue("12.5", depth)).toBe(12.5);
    expect(parseViewportFeatureGripValue("", depth)).toBeUndefined();
    expect(parseViewportFeatureGripValue("nope", depth)).toBeUndefined();
    expect(parseViewportFeatureGripValue("Infinity", depth)).toBeUndefined();
    expect(parseViewportFeatureGripValue("21", depth)).toBeUndefined();
  });

  it("keeps pending and disabled values readable", () => {
    const markup = renderToStaticMarkup(
      createElement(ViewportFeatureGrips, {
        disabled: true,
        pending: true,
        grips: [depth]
      })
    );

    expect(markup).toContain('value="10"');
    expect(markup).toContain(
      "Preview pending; current values remain available."
    );
    expect(markup).toContain('disabled=""');
  });

  it("routes read-only grips to their owner without exposing drag editing", () => {
    const markup = renderToStaticMarkup(
      createElement(ViewportFeatureGrips, {
        grips: [
          {
            ...depth,
            id: "bound-depth",
            readOnly: true,
            routeToOwnerLabel: "Edit parameter wall in Parameters"
          }
        ],
        onRouteToOwner: vi.fn()
      })
    );

    expect(markup).toContain("Edit parameter wall in Parameters");
    expect(markup).toContain('readOnly=""');
    expect(markup).not.toContain('aria-label="Drag Extrude depth"');
  });
});
