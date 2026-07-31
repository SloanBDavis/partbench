import { describe, expect, it, vi } from "vitest";
import {
  hasTransientPopoverInDocument,
  registerEscapeEditorContributor,
  resolveContributedEscapeEditorState,
  resolveEscapeRung,
  TRANSIENT_POPOVER_SELECTORS,
  type EscapeStackSnapshot,
  type TransientPopoverQuery
} from "./escapeStackModel";

describe("escapeStackModel", () => {
  const empty: EscapeStackSnapshot = {
    transientPopover: false,
    overlayDrawer: false,
    viewportGesture: false,
    measurementSecondTarget: false,
    commandSearch: false,
    editor: "none",
    selection: false
  };

  it("walks the seven rungs in documented order", () => {
    expect(
      resolveEscapeRung({ ...empty, selection: true, transientPopover: true })
    ).toBe("transient-popover");
    expect(
      resolveEscapeRung({ ...empty, selection: true, overlayDrawer: true })
    ).toBe("overlay-drawer");
    expect(
      resolveEscapeRung({ ...empty, selection: true, viewportGesture: true })
    ).toBe("viewport-gesture");
    expect(
      resolveEscapeRung({
        ...empty,
        selection: true,
        measurementSecondTarget: true
      })
    ).toBe("measurement-second-target");
    expect(
      resolveEscapeRung({ ...empty, selection: true, commandSearch: true })
    ).toBe("command-search");
    expect(
      resolveEscapeRung({ ...empty, selection: true, editor: "dirty" })
    ).toBe("editor");
    expect(
      resolveEscapeRung({ ...empty, selection: true, editor: "clean" })
    ).toBe("editor");
    expect(resolveEscapeRung({ ...empty, selection: true })).toBe("selection");
    expect(resolveEscapeRung(empty)).toBeUndefined();
  });

  it("prefers a dirty editor contributor over a clean one", () => {
    const dirtyCancel = vi.fn();
    const dirtyGuard = vi.fn();
    const cleanCancel = vi.fn();
    const unregisterDirty = registerEscapeEditorContributor({
      id: "dirty",
      getState: () => "dirty",
      cancelClean: dirtyCancel,
      requestDirtyGuard: dirtyGuard
    });
    const unregisterClean = registerEscapeEditorContributor({
      id: "clean",
      getState: () => "clean",
      cancelClean: cleanCancel,
      requestDirtyGuard: vi.fn()
    });

    const resolved = resolveContributedEscapeEditorState();
    expect(resolved.state).toBe("dirty");
    resolved.requestDirtyGuard();
    expect(dirtyGuard).toHaveBeenCalledOnce();
    expect(cleanCancel).not.toHaveBeenCalled();

    unregisterDirty();
    unregisterClean();
  });

  it("ignores suspended editor contributors", () => {
    const unregister = registerEscapeEditorContributor({
      id: "suspended",
      suspended: () => true,
      getState: () => "dirty",
      cancelClean: vi.fn(),
      requestDirtyGuard: vi.fn()
    });

    expect(resolveContributedEscapeEditorState().state).toBe("none");
    unregister();
  });

  // Closing a popover mutates the DOM and is proved in the browser smoke
  // harness; this repo runs Vitest without a DOM environment on purpose.
  it("detects each transient popover that owns Escape rung 1", () => {
    const queryFor = (present: string): TransientPopoverQuery => ({
      querySelector: (selectors: string) =>
        selectors === present ? { selectors } : null
    });

    for (const selector of TRANSIENT_POPOVER_SELECTORS) {
      expect(hasTransientPopoverInDocument(queryFor(selector))).toBe(true);
    }
    expect(hasTransientPopoverInDocument({ querySelector: () => null })).toBe(
      false
    );
  });
});
