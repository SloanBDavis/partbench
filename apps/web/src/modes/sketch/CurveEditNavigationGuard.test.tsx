import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CurveEditNavigationGuard } from "./CurveEditNavigationGuard";
import {
  CurveEditNavigationResolutionGate,
  getCurveEditDiscardFocusTarget,
  getWrappedDialogFocusIndex,
  handleCurveEditNavigationGuardEscape,
  shouldRestoreResolvedCurveEditNavigationFocus
} from "./curveEditNavigationGuardModel";

describe("V19 curve-edit dirty navigation guard", () => {
  it("renders a modal Apply/Discard/Stay decision with an initial focus target", () => {
    const markup = renderToStaticMarkup(
      createElement(CurveEditNavigationGuard, {
        intent: {
          kind: "sketch-selection",
          sketchId: "sketch-b"
        },
        onApply: vi.fn(),
        onDiscard: vi.fn(),
        onStay: vi.fn()
      })
    );

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain("opening another sketch");
    expect(markup).toContain("data-dialog-initial-focus");
    expect(markup).toContain(">Apply<");
    expect(markup).toContain(">Discard<");
    expect(markup).toContain(">Stay<");
  });

  it("wraps Tab and Shift+Tab at modal boundaries", () => {
    expect(getWrappedDialogFocusIndex(2, 3, false)).toBe(0);
    expect(getWrappedDialogFocusIndex(0, 3, true)).toBe(2);
    expect(getWrappedDialogFocusIndex(1, 3, false)).toBeUndefined();
    expect(getWrappedDialogFocusIndex(-1, 3, false)).toBe(0);
  });

  it("stops an actual bubbling Escape event before the panel listener sees it", () => {
    const event = new Event("keydown", {
      bubbles: true,
      cancelable: true
    }) as Event & { readonly key: string };
    Object.defineProperty(event, "key", { value: "Escape" });
    const onStay = vi.fn();

    expect(handleCurveEditNavigationGuardEscape(event, false, onStay)).toBe(
      true
    );
    expect(event.defaultPrevented).toBe(true);
    expect(event.cancelBubble).toBe(true);
    expect(onStay).toHaveBeenCalledOnce();
  });

  it("serializes a deferred Apply and rejects competing resolutions", async () => {
    let resolveApply: (() => void) | undefined;
    const deferred = new Promise<void>((resolve) => {
      resolveApply = resolve;
    });
    const gate = new CurveEditNavigationResolutionGate();
    const first = gate.run(() => deferred);

    expect(gate.pending).toBe(true);
    await expect(gate.run(vi.fn())).resolves.toBe(false);
    resolveApply?.();
    await expect(first).resolves.toBe(true);
    expect(gate.pending).toBe(false);
  });

  it("routes close-editor Discard to the tool opener and other navigation to its trigger", () => {
    const opener = { id: "tool-opener" };
    const navigationTrigger = { id: "tree-row" };
    const directEditorOpener = { id: "direct-editor-opener" };

    expect(
      getCurveEditDiscardFocusTarget(
        { kind: "close-editor" },
        opener,
        navigationTrigger
      )
    ).toBe(opener);
    expect(
      getCurveEditDiscardFocusTarget(
        { kind: "sketch-selection", sketchId: "sketch-b" },
        opener,
        navigationTrigger
      )
    ).toBe(navigationTrigger);
    expect(
      getCurveEditDiscardFocusTarget(
        { kind: "close-editor" },
        null,
        navigationTrigger,
        directEditorOpener
      )
    ).toBe(directEditorOpener);
  });

  it("replaces transient editor focus but preserves meaningful destination focus", () => {
    const body = focusElement(false);
    const documentElement = focusElement(false);
    const guardButton = focusElement(true);
    const destinationControl = focusElement(false);

    expect(
      shouldRestoreResolvedCurveEditNavigationFocus({
        activeElement: guardButton,
        body,
        documentElement
      })
    ).toBe(true);
    expect(
      shouldRestoreResolvedCurveEditNavigationFocus({
        activeElement: destinationControl,
        body,
        documentElement
      })
    ).toBe(false);
    expect(
      shouldRestoreResolvedCurveEditNavigationFocus({
        activeElement: body,
        body,
        documentElement
      })
    ).toBe(true);
  });

  it.each([
    "Offset sketch geometry",
    "Create Slot",
    "Create Rounded Rectangle"
  ])("treats the V19 %s panel as transient focus", (label) => {
    const body = focusElement(false);
    const documentElement = focusElement(false);
    const panelControl = {
      isConnected: true,
      closest: vi.fn((selector: string) =>
        selector.includes(`[aria-label="${label}"]`) ? {} : null
      )
    };

    expect(
      shouldRestoreResolvedCurveEditNavigationFocus({
        activeElement: panelControl,
        body,
        documentElement
      })
    ).toBe(true);
  });
});

function focusElement(transient: boolean) {
  return {
    isConnected: true,
    closest: vi.fn(() => (transient ? {} : null))
  };
}
