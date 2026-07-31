import { describe, expect, it } from "vitest";
import {
  formatShortcutHelpNotice,
  isSingleKeyShortcutToken,
  resolveShortcutRouterAction,
  shortcutTokensFromKeyboardEvent
} from "./shortcutRouter";
import { UI_ACTION_REGISTRY } from "./actionRegistry";

describe("shortcutRouter", () => {
  it("expands chord and single-key events into registry tokens", () => {
    expect(
      shortcutTokensFromKeyboardEvent({ key: "k", ctrlKey: true })
    ).toEqual(["Ctrl/Cmd+K"]);
    expect(
      shortcutTokensFromKeyboardEvent({
        key: "z",
        metaKey: true,
        shiftKey: true
      })
    ).toEqual(["Ctrl/Cmd+Shift+Z"]);
    expect(
      shortcutTokensFromKeyboardEvent({ key: "y", ctrlKey: true })
    ).toEqual(["Ctrl+Y"]);
    expect(
      shortcutTokensFromKeyboardEvent({ key: "Enter", metaKey: true })
    ).toEqual(["Ctrl/Cmd+Enter"]);
    expect(shortcutTokensFromKeyboardEvent({ key: "f" })).toEqual(["F"]);
    expect(shortcutTokensFromKeyboardEvent({ key: "F2" })).toEqual(["F2"]);
    expect(shortcutTokensFromKeyboardEvent({ key: "Delete" })).toEqual([
      "Delete"
    ]);
    expect(shortcutTokensFromKeyboardEvent({ key: "Backspace" })).toEqual([
      "Backspace"
    ]);
    expect(shortcutTokensFromKeyboardEvent({ key: "Escape" })).toEqual([
      "Escape"
    ]);
  });

  it("classifies single-key vs chord tokens", () => {
    expect(isSingleKeyShortcutToken("F")).toBe(true);
    expect(isSingleKeyShortcutToken("F2")).toBe(true);
    expect(isSingleKeyShortcutToken("Delete")).toBe(true);
    expect(isSingleKeyShortcutToken("Ctrl/Cmd+K")).toBe(false);
    expect(isSingleKeyShortcutToken("Ctrl+Y")).toBe(false);
  });

  it("resolves fit, delete precedence, rename, redo, and apply", () => {
    expect(resolveShortcutRouterAction({ key: "f" }, "solid")?.actionId).toBe(
      "inspect.fit-all"
    );
    expect(
      resolveShortcutRouterAction({ key: "Delete" }, "sketch")?.actionId
    ).toBe("sketch.delete");
    expect(
      resolveShortcutRouterAction({ key: "Backspace" }, "solid")?.actionId
    ).toBe("solid.delete");
    expect(resolveShortcutRouterAction({ key: "F2" }, "solid")?.actionId).toBe(
      "solid.rename"
    );
    expect(
      resolveShortcutRouterAction({ key: "y", ctrlKey: true }, "project")
        ?.actionId
    ).toBe("project.redo");
    expect(
      resolveShortcutRouterAction({ key: "Enter", ctrlKey: true }, "solid")
        ?.actionId
    ).toBe("project.apply");
    expect(
      resolveShortcutRouterAction({ key: "Escape" }, "inspect")?.actionId
    ).toBe("project.cancel");
  });

  it("suppresses single-key shortcuts from editable targets", () => {
    const input = {
      tagName: "INPUT",
      getAttribute: () => null,
      closest: () => null
    } as unknown as EventTarget;

    expect(
      resolveShortcutRouterAction({ key: "f", target: input }, "solid")
    ).toBeUndefined();
    expect(
      resolveShortcutRouterAction({ key: "Escape", target: input }, "solid")
        ?.actionId
    ).toBe("project.cancel");
    expect(
      resolveShortcutRouterAction(
        { key: "k", ctrlKey: true, target: input },
        "solid"
      )?.actionId
    ).toBe("project.command-search");
  });

  it("builds Help copy from registry shortcut declarations", () => {
    const notice = formatShortcutHelpNotice(UI_ACTION_REGISTRY);
    expect(notice).toContain("Ctrl/Cmd+K");
    expect(notice).toContain("Ctrl+Y");
    expect(notice).toContain("Ctrl/Cmd+Enter");
    expect(notice).toContain("Delete");
    expect(notice).toContain("F2");
    expect(notice).toContain("F ");
    expect(notice).toContain("Escape");
  });
});
