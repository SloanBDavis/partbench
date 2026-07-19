import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ContextualActionStrip } from "./ContextualActionStrip";
import type { ViewportContextualCommandSurfaceModel } from "../viewportContextualCommands";

describe("ContextualActionStrip", () => {
  it("shows at most four stable actions and a More affordance", () => {
    const surface: ViewportContextualCommandSurfaceModel = {
      visible: true,
      selectionKey: "body-selection",
      title: "Result body",
      detail: "Solid body",
      tone: "selected",
      actions: [
        action("body.measureTopology", "Measure"),
        action("body.references.inspect", "References"),
        action("feature.chamfer", "Chamfer"),
        action("feature.fillet", "Fillet"),
        action("feature.shell", "Shell")
      ]
    };

    const markup = renderToStaticMarkup(
      createElement(ContextualActionStrip, {
        surface,
        onInvoke: () => undefined
      })
    );

    expect(markup).toContain("Result body");
    expect(markup).toContain("Measure");
    expect(markup).toContain("Fillet");
    expect(markup).toContain("More");
    expect(markup).not.toContain(">Shell<");
  });

  it("does not render without a semantic action", () => {
    const markup = renderToStaticMarkup(
      createElement(ContextualActionStrip, {
        surface: {
          visible: false,
          selectionKey: "none",
          title: "Nothing selected",
          detail: "",
          tone: "idle",
          actions: []
        },
        onInvoke: () => undefined
      })
    );

    expect(markup).toBe("");
  });
});

function action(
  id:
    | "body.measureTopology"
    | "body.references.inspect"
    | "feature.chamfer"
    | "feature.fillet"
    | "feature.shell",
  label: string
) {
  return { id, label, route: "command" as const, disabled: false };
}
