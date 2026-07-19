import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_WORKBENCH_UI_PREFERENCES,
  loadWorkbenchUiPreferences,
  parseWorkbenchUiPreferences,
  saveWorkbenchUiPreferences,
  serializeWorkbenchUiPreferences,
  WORKBENCH_UI_PREFERENCES_KEY
} from "./uiPreferences";

describe("uiPreferences", () => {
  it("loads a versioned record and clamps dock widths", () => {
    expect(
      parseWorkbenchUiPreferences(
        JSON.stringify({
          version: 1,
          leftDockWidth: 999,
          rightDockWidth: 10,
          leftDockCollapsed: true,
          rightDockCollapsed: false
        })
      )
    ).toEqual({
      version: 1,
      leftDockWidth: 380,
      rightDockWidth: 300,
      leftDockCollapsed: true,
      rightDockCollapsed: false
    });
  });

  it.each([
    null,
    "",
    "not json",
    "[]",
    JSON.stringify({ version: 2 }),
    JSON.stringify({
      version: 1,
      leftDockWidth: "282",
      rightDockWidth: 350,
      leftDockCollapsed: false,
      rightDockCollapsed: false
    })
  ])("resets malformed or unknown records", (serialized) => {
    expect(parseWorkbenchUiPreferences(serialized)).toEqual(
      DEFAULT_WORKBENCH_UI_PREFERENCES
    );
  });

  it("serializes only the preference allowlist", () => {
    const input = {
      version: 99,
      leftDockWidth: 300,
      rightDockWidth: 400,
      leftDockCollapsed: false,
      rightDockCollapsed: true,
      documentId: "internal-document-id",
      selectedReference: "generated:face:private",
      featureDraft: { distance: 42 },
      fileHandle: "private-handle",
      diagnostics: ["private-diagnostic"]
    };

    const serialized = serializeWorkbenchUiPreferences(input);
    expect(JSON.parse(serialized)).toEqual({
      version: 1,
      leftDockWidth: 300,
      rightDockWidth: 400,
      leftDockCollapsed: false,
      rightDockCollapsed: true
    });
    expect(serialized).not.toContain("documentId");
    expect(serialized).not.toContain("selectedReference");
    expect(serialized).not.toContain("featureDraft");
  });

  it("treats unavailable storage as best-effort", () => {
    const failingStorage = {
      getItem: vi.fn(() => {
        throw new Error("unavailable");
      }),
      setItem: vi.fn(() => {
        throw new Error("unavailable");
      })
    };

    expect(loadWorkbenchUiPreferences(failingStorage)).toEqual(
      DEFAULT_WORKBENCH_UI_PREFERENCES
    );
    expect(
      saveWorkbenchUiPreferences(
        DEFAULT_WORKBENCH_UI_PREFERENCES,
        failingStorage
      )
    ).toBe(false);
  });

  it("writes the namespaced record", () => {
    const storage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn()
    };

    expect(
      saveWorkbenchUiPreferences(DEFAULT_WORKBENCH_UI_PREFERENCES, storage)
    ).toBe(true);
    expect(storage.setItem).toHaveBeenCalledWith(
      WORKBENCH_UI_PREFERENCES_KEY,
      serializeWorkbenchUiPreferences(DEFAULT_WORKBENCH_UI_PREFERENCES)
    );
  });
});
