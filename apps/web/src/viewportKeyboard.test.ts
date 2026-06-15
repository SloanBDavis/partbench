import { describe, expect, it } from "vitest";
import {
  isEditableKeyboardTarget,
  shouldCancelViewportTransientState
} from "./viewportKeyboard";

describe("viewport keyboard ergonomics", () => {
  it("handles Escape for viewport transient cancellation outside editable controls", () => {
    expect(
      shouldCancelViewportTransientState({
        key: "Escape",
        target: createTarget("div")
      })
    ).toBe(true);
  });

  it("ignores non-Escape and already-handled keyboard events", () => {
    expect(
      shouldCancelViewportTransientState({
        key: "Enter",
        target: createTarget("div")
      })
    ).toBe(false);
    expect(
      shouldCancelViewportTransientState({
        key: "Escape",
        defaultPrevented: true,
        target: createTarget("div")
      })
    ).toBe(false);
  });

  it("does not cancel viewport state from form editing targets", () => {
    for (const tagName of ["input", "select", "textarea"]) {
      const target = createTarget(tagName);

      expect(isEditableKeyboardTarget(target)).toBe(true);
      expect(
        shouldCancelViewportTransientState({
          key: "Escape",
          target
        })
      ).toBe(false);
    }
  });

  it("does not cancel viewport state from contenteditable or textbox-like targets", () => {
    expect(
      isEditableKeyboardTarget(
        createTarget("div", { contenteditable: "plaintext-only" })
      )
    ).toBe(true);
    expect(
      isEditableKeyboardTarget(createTarget("div", { role: "textbox" }))
    ).toBe(true);
    expect(
      shouldCancelViewportTransientState({
        key: "Escape",
        target: createTarget("span", {}, true)
      })
    ).toBe(false);
  });
});

function createTarget(
  tagName: string,
  attributes: Readonly<Record<string, string>> = {},
  hasEditableAncestor = false
): EventTarget {
  return {
    tagName,
    isContentEditable: attributes.contenteditable === "true",
    getAttribute: (name: string) => attributes[name] ?? null,
    closest: () => (hasEditableAncestor ? createTarget("input") : null)
  } as unknown as EventTarget;
}
