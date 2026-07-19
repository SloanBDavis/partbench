import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  EditorFieldRow,
  FeatureEditorShell,
  PreviewToggle
} from "./FeatureEditorShell";
import {
  SelectionCollectorRow,
  formatAcceptedKinds
} from "./SelectionCollectorRow";

describe("FeatureEditorShell", () => {
  it("renders labeled sticky commit controls and a collapsed advanced section", () => {
    const markup = renderToStaticMarkup(
      createElement(FeatureEditorShell, {
        title: "Extrude 1",
        kind: "Extrude",
        phase: "ready",
        dirty: true,
        validation: { status: "ready" },
        onApply: () => undefined,
        onCancel: () => undefined,
        advanced: createElement("p", null, "Direction controls"),
        children: createElement(EditorFieldRow, {
          label: "Depth",
          htmlFor: "depth",
          unit: "mm",
          required: true,
          children: createElement("input", {
            id: "depth",
            className: "pb-field pb-numeric",
            value: 12,
            readOnly: true
          })
        })
      })
    );

    expect(markup).toContain("Extrude 1");
    expect(markup).toContain("Unsaved changes");
    expect(markup).toContain("Ready to apply.");
    expect(markup).toContain("Apply (Ctrl/Cmd+Enter)");
    expect(markup).toContain("Cancel");
    expect(markup).toContain("<summary>Advanced</summary>");
    expect(markup).toContain("mm");
  });

  it("blocks Apply while a required selection is missing", () => {
    const markup = renderToStaticMarkup(
      createElement(FeatureEditorShell, {
        title: "Loft 1",
        kind: "Loft",
        phase: "collecting",
        dirty: true,
        validation: {
          status: "collecting",
          message: "Select at least two sections."
        },
        onApply: () => undefined,
        onCancel: () => undefined,
        children: createElement("div")
      })
    );

    expect(markup).toContain("Select at least two sections.");
    const applyButton = markup.match(
      /<button[^>]*title="Apply \(Ctrl\/Cmd\+Enter\)"[^>]*>/
    )?.[0];
    expect(applyButton).toContain('disabled=""');
  });

  it("announces Apply failures assertively while preserving editor content", () => {
    const markup = renderToStaticMarkup(
      createElement(FeatureEditorShell, {
        title: "Fillet 1",
        kind: "Fillet",
        phase: "error",
        dirty: true,
        applyError: "The selected edge is no longer available.",
        validation: { status: "ready" },
        onApply: () => undefined,
        onCancel: () => undefined,
        children: createElement("input", {
          value: "4 mm",
          readOnly: true
        })
      })
    );

    expect(markup).toContain('role="alert"');
    expect(markup).toContain("The selected edge is no longer available.");
    expect(markup).toContain("4 mm");
  });

  it("renders explicit collector kinds, targets, and collection feedback", () => {
    const markup = renderToStaticMarkup(
      createElement(SelectionCollectorRow, {
        label: "Edges",
        acceptedKinds: ["edge", "named edge"],
        targets: [{ value: "edge-anchor", label: "Outer edge", kind: "Edge" }],
        collecting: true,
        required: true,
        rejectedReason: "Select an edge, not a face.",
        onStartCollecting: () => undefined,
        onStopCollecting: () => undefined,
        onRemove: () => undefined,
        onClear: () => undefined
      })
    );

    expect(markup).toContain("Select an edge or a named edge.");
    expect(markup).toContain("Outer edge");
    expect(markup).toContain('aria-label="Remove Outer edge"');
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain("Stop selecting");
    expect(markup).toContain("Clear");
    expect(markup).toContain('role="alert"');
  });

  it("renders preview as an honest controlled checkbox", () => {
    const markup = renderToStaticMarkup(
      createElement(PreviewToggle, {
        checked: true,
        onChange: () => undefined
      })
    );

    expect(markup).toContain('type="checkbox"');
    expect(markup).toContain("Show provisional preview");
    expect(markup).toContain("checked");
  });

  it("formats accepted target kinds without internal identifiers", () => {
    expect(formatAcceptedKinds([])).toBe("an eligible target");
    expect(formatAcceptedKinds(["face"])).toBe("a face");
    expect(formatAcceptedKinds(["face", "named face"])).toBe(
      "a face or a named face"
    );
  });
});
