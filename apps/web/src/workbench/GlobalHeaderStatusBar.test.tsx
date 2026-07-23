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

  it("keeps model-work cancellation accessible alongside pending commands", () => {
    const markup = renderToStaticMarkup(
      createElement(StatusBar, {
        mode: "project",
        fileState: "Gearbox Mount.wcad",
        saveState: "Unsaved",
        readiness: "Building results",
        pendingLabel: "Updating model",
        modelWorkControl: {
          label: "Model results are building",
          actionLabel: "Cancel model work",
          onAction: vi.fn()
        }
      })
    );

    expect(markup).toContain("Model results are building");
    expect(markup).toContain("Cancel model work");
    expect(markup).not.toContain('disabled=""');
  });

  it("renders a busy-disabled retry without hiding its recovery label", () => {
    const markup = renderToStaticMarkup(
      createElement(StatusBar, {
        mode: "solid",
        instruction: "Model work cancelled",
        selectionFilter: "body",
        zoom: "Viewport",
        units: "mm",
        rebuildState: "1 display result cancelled",
        modelWorkControl: {
          label: "Model results need attention",
          actionLabel: "Retry model results",
          disabled: true,
          busy: true,
          onAction: vi.fn()
        }
      })
    );

    expect(markup).toContain("Retry model results");
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('disabled=""');
  });
});
