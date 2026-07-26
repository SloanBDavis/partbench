import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  SketchConveniencePanel,
  type SketchConveniencePanelProps
} from "./SketchConveniencePanel";

describe("V19 Sketch Create convenience editor", () => {
  it("renders a keyboard-complete atomic Slot form", () => {
    const markup = render({ kind: "slot" });

    expect(markup).toContain('aria-label="Create Slot"');
    expect(markup).toContain("Centerline start");
    expect(markup).toContain("Start X");
    expect(markup).toContain("End Y");
    expect(markup).toContain("Radius");
    expect(markup).toContain("Construction");
    expect(markup).toContain("Apply Slot");
    expect(markup).toContain("Ctrl/Cmd+Enter applies when ready");
    expect(markup).toContain("one transaction");
    expect(markup).not.toContain("entityIds");
    expect(markup).not.toContain("constraintIds");
  });

  it("renders a keyboard-complete atomic Rounded Rectangle form", () => {
    const markup = render({ kind: "roundedRectangle" });

    expect(markup).toContain('aria-label="Create Rounded Rectangle"');
    expect(markup).toContain("Center X");
    expect(markup).toContain("Width");
    expect(markup).toContain("Height");
    expect(markup).toContain("Corner radius");
    expect(markup).toContain("Apply Rounded Rectangle");
    expect(markup).toContain("Cancel");
  });
});

function render(overrides: Partial<SketchConveniencePanelProps>): string {
  return renderToStaticMarkup(
    createElement(SketchConveniencePanel, {
      disabled: false,
      kind: "slot",
      sketchId: "sketch-a",
      onApply: vi.fn(),
      onCancel: vi.fn(),
      ...overrides
    })
  );
}
