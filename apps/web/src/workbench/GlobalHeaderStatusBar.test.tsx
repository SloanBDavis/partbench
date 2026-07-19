import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { GlobalHeader } from "./GlobalHeader";
import { StatusBar } from "./StatusBar";

describe("V18 global header and mode status", () => {
  it("keeps the header global, compact, and explicitly labeled", () => {
    const markup = renderToStaticMarkup(
      createElement(GlobalHeader, {
        documentName: "Gearbox Mount",
        saveState: "saved-local",
        undo: { available: true, run: vi.fn() },
        redo: { available: false, run: vi.fn() },
        onOpenCommandSearch: vi.fn(),
        onOpenHelp: vi.fn(),
        pendingLabel: "Applying Extrude"
      })
    );

    expect(markup).toContain("Partbench");
    expect(markup).toContain("Gearbox Mount");
    expect(markup).toContain("All changes saved locally");
    expect(markup).toContain('aria-label="Search commands"');
    expect(markup).toContain('aria-keyshortcuts="Control+K Meta+K"');
    expect(markup).toContain('aria-label="Help and keyboard shortcuts"');
    expect(markup).not.toContain("millimeter");
  });

  it("renders only Project-specific status content in Project mode", () => {
    const markup = renderToStaticMarkup(
      createElement(StatusBar, {
        mode: "project",
        fileState: "Gearbox Mount.wcad",
        saveState: "Saved locally",
        readiness: "Ready to export",
        pendingLabel: "Saving"
      })
    );

    expect(markup).toContain('aria-label="Project status"');
    expect(markup).toContain("Gearbox Mount.wcad");
    expect(markup).toContain("Ready to export");
    expect(markup).not.toContain("Selection filter");
    expect(markup).not.toContain("Zoom");
    expect(markup).not.toContain("Pointer");
  });

  it("keeps passive coordinates unfocusable and Solid controls mode-specific", () => {
    const markup = renderToStaticMarkup(
      createElement(StatusBar, {
        mode: "solid",
        instruction: "Select a face",
        selectionFilter: "face",
        onSelectionFilterChange: vi.fn(),
        coordinates: "X 12.0 · Y 8.0",
        zoom: "100%",
        units: "mm",
        rebuildState: "Ready"
      })
    );

    expect(markup).toContain("Select a face");
    expect(markup).toContain("X 12.0 · Y 8.0");
    expect(markup).not.toContain('tabindex="0">X 12.0');
    expect(markup).toContain("Selection filter");
    expect(markup).toContain('<option value="face" selected="">Face</option>');
  });
});
