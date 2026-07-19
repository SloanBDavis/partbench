import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { WORKBENCH_LAYOUT } from "../styles/tokens";
import { getKeyboardDockResizeValue } from "./DockDivider";
import {
  WorkbenchShell,
  resolveWorkbenchLayout,
  type WorkbenchShellProps
} from "./WorkbenchShell";

describe("V18 workbench responsive shell", () => {
  it("uses the exact inline and drawer breakpoints without changing preferences", () => {
    const desktop = layout({ viewportWidth: 1536 });
    expect(desktop.left).toMatchObject({ placement: "inline", visible: true });
    expect(desktop.right).toMatchObject({ placement: "inline", visible: true });

    const medium = layout({ viewportWidth: 1024, openDrawer: "right" });
    expect(medium.left).toMatchObject({ placement: "inline", visible: true });
    expect(medium.right).toMatchObject({ placement: "drawer", visible: true });
    expect(medium.activeDrawer).toBe("right");

    const narrowClosed = layout({ viewportWidth: 390 });
    expect(narrowClosed.left).toMatchObject({
      placement: "drawer",
      visible: false
    });
    expect(narrowClosed.right).toMatchObject({
      placement: "drawer",
      visible: false
    });
    expect(narrowClosed.activeDrawer).toBeUndefined();

    const narrowEditor = layout({
      viewportWidth: 390,
      openDrawer: "left",
      activeEditor: true
    });
    expect(narrowEditor.left.visible).toBe(false);
    expect(narrowEditor.right.visible).toBe(true);
    expect(narrowEditor.activeDrawer).toBe("right");

    const narrowCollapsedEditor = layout({
      viewportWidth: 390,
      rightDockCollapsed: true,
      activeEditor: true
    });
    expect(narrowCollapsedEditor.right.visible).toBe(true);
    expect(narrowCollapsedEditor.activeDrawer).toBe("right");
  });

  it("derives a viewport-protecting collapse while preserving explicit open state", () => {
    const passive = layout({
      viewportWidth: 1200,
      leftDockWidth: 380,
      rightDockWidth: 460
    });
    expect(passive.left.visible).toBe(true);
    expect(passive.right).toMatchObject({
      visible: false,
      hiddenForViewport: true
    });

    const editor = layout({
      viewportWidth: 1200,
      leftDockWidth: 380,
      rightDockWidth: 460,
      activeEditor: true
    });
    expect(editor.left).toMatchObject({
      visible: false,
      hiddenForViewport: true
    });
    expect(editor.right.visible).toBe(true);
  });

  it("keeps viewport and Project slots mounted while exposing only the active center", () => {
    const markup = renderToStaticMarkup(
      createElement(WorkbenchShell, shellProps({ mode: "project" }))
    );

    expect(markup).toContain("Viewport instance sentinel");
    expect(markup).toContain("Project workspace sentinel");
    expect(markup).toMatch(
      /aria-label="CAD viewport" hidden="" aria-hidden="true"/
    );
    expect(markup).toMatch(/aria-label="Project workspace"/);
    expect(markup).toContain('aria-label="Project navigation"');
    expect(markup).toContain('aria-label="Workbench workspace"');
    expect(markup).toMatch(
      /class="pb-dock-toggle pb-dock-toggle--right"[^>]*aria-label="Open Inspector"[^>]*hidden=""/
    );
  });

  it("gives open overlay docks modal dialog semantics and focus hooks", () => {
    const markup = renderToStaticMarkup(
      createElement(
        WorkbenchShell,
        shellProps({ viewportWidth: 1024, openDrawer: "right" })
      )
    );

    expect(markup).toContain('class="pb-dock pb-dock--right pb-dock--drawer"');
    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('class="pb-drawer-scrim"');
  });
});

describe("DockDivider keyboard sizing", () => {
  it("uses 8px arrows, 32px shifted arrows, and clamps to bounds", () => {
    expect(getKeyboardDockResizeValue(282, "ArrowRight", false, 220, 380)).toBe(
      290
    );
    expect(getKeyboardDockResizeValue(282, "ArrowLeft", true, 220, 380)).toBe(
      250
    );
    expect(getKeyboardDockResizeValue(378, "ArrowRight", false, 220, 380)).toBe(
      380
    );
    expect(getKeyboardDockResizeValue(282, "Home", false, 220, 380)).toBe(220);
    expect(getKeyboardDockResizeValue(282, "End", false, 220, 380)).toBe(380);
    expect(
      getKeyboardDockResizeValue(282, "Enter", false, 220, 380)
    ).toBeUndefined();
  });
});

function layout(
  overrides: Partial<Parameters<typeof resolveWorkbenchLayout>[0]> = {}
) {
  return resolveWorkbenchLayout({
    viewportWidth: 1536,
    leftDockWidth: WORKBENCH_LAYOUT.leftDock.default,
    rightDockWidth: WORKBENCH_LAYOUT.rightDock.default,
    leftDockCollapsed: false,
    rightDockCollapsed: false,
    activeEditor: false,
    ...overrides
  });
}

function shellProps(
  overrides: Partial<WorkbenchShellProps> = {}
): WorkbenchShellProps {
  return {
    mode: "solid",
    viewportWidth: 1536,
    leftDockWidth: WORKBENCH_LAYOUT.leftDock.default,
    rightDockWidth: WORKBENCH_LAYOUT.rightDock.default,
    leftDockCollapsed: false,
    rightDockCollapsed: false,
    onDockCollapsedChange: vi.fn(),
    onDockWidthChange: vi.fn(),
    header: createElement("header", { "aria-label": "Header" }, "Header"),
    ribbon: createElement("nav", { "aria-label": "Ribbon" }, "Ribbon"),
    leftDock: createElement("div", null, "Left dock sentinel"),
    viewport: createElement("div", null, "Viewport instance sentinel"),
    projectWorkspace: createElement("div", null, "Project workspace sentinel"),
    rightDock: createElement("div", null, "Right dock sentinel"),
    statusBar: createElement("footer", null, "Status"),
    ...overrides
  };
}
