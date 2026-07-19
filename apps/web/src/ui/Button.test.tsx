import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button, IconButton } from "./Button";
import { LiveRegion } from "./LiveRegion";

describe("UI primitives", () => {
  it("keeps blocked actions focusable and explains why", () => {
    const markup = renderToStaticMarkup(
      createElement(Button, {
        unavailableReason: "Select a target body.",
        icon: "extrude",
        children: "Extrude"
      })
    );

    expect(markup).toContain('aria-disabled="true"');
    expect(markup).toContain('title="Select a target body."');
    expect(markup).not.toContain('disabled=""');
  });

  it("provides an accessible name for icon-only controls", () => {
    const markup = renderToStaticMarkup(
      createElement(IconButton, { icon: "undo", label: "Undo" })
    );

    expect(markup).toContain('aria-label="Undo"');
    expect(markup).toContain("pb-visually-hidden");
  });

  it("uses assertive semantics only for blocking errors", () => {
    const polite = renderToStaticMarkup(
      createElement(LiveRegion, { children: "Ready to apply." })
    );
    const assertive = renderToStaticMarkup(
      createElement(LiveRegion, {
        urgency: "assertive",
        children: "Profile is open."
      })
    );

    expect(polite).toContain('role="status"');
    expect(polite).toContain('aria-live="polite"');
    expect(assertive).toContain('role="alert"');
    expect(assertive).toContain('aria-live="assertive"');
  });
});
