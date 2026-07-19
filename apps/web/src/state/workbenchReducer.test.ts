import { describe, expect, it } from "vitest";
import {
  createInitialWorkbenchUiState,
  getDirtyNavigationPrompt,
  shouldPromptForDirtyNavigation,
  workbenchReducer
} from "./workbenchReducer";

describe("workbenchReducer", () => {
  it("starts in Solid with exact dock defaults", () => {
    expect(createInitialWorkbenchUiState()).toEqual({
      mode: "solid",
      activeEditorDirty: false,
      selectionFilter: "body",
      leftDockCollapsed: false,
      rightDockCollapsed: false,
      leftDockWidth: 282,
      rightDockWidth: 350,
      commandSearchOpen: false
    });
  });

  it("changes mode immediately when no editor draft is dirty", () => {
    const result = workbenchReducer(createInitialWorkbenchUiState(), {
      type: "request-navigation",
      intent: { kind: "mode", mode: "project" }
    });

    expect(result.mode).toBe("project");
    expect(result.projectPage).toBe("overview");
    expect(result.navigationIntent).toBeUndefined();
  });

  it("queues one navigation intent while a draft is dirty", () => {
    const state = createInitialWorkbenchUiState({
      activeEditor: { kind: "extrude", sourceId: "feature-1" },
      activeEditorDirty: true
    });
    const intent = { kind: "mode", mode: "inspect" } as const;
    const queued = workbenchReducer(state, {
      type: "request-navigation",
      intent
    });

    expect(shouldPromptForDirtyNavigation(state, intent)).toBe(true);
    expect(queued.mode).toBe("solid");
    expect(queued.activeEditor).toEqual(state.activeEditor);
    expect(queued.navigationIntent).toEqual(intent);

    const secondRequest = workbenchReducer(queued, {
      type: "request-navigation",
      intent: { kind: "mode", mode: "project" }
    });
    expect(secondRequest.navigationIntent).toEqual(intent);
  });

  it("supports Stay, Discard, and successful Apply navigation outcomes", () => {
    const queued = workbenchReducer(
      createInitialWorkbenchUiState({
        activeEditor: { kind: "hole", sourceId: "hole-1" },
        activeEditorDirty: true
      }),
      {
        type: "request-navigation",
        intent: { kind: "mode", mode: "project" }
      }
    );

    const stayed = workbenchReducer(queued, {
      type: "resolve-navigation",
      resolution: "stay"
    });
    expect(stayed.mode).toBe("solid");
    expect(stayed.activeEditorDirty).toBe(true);
    expect(stayed.navigationIntent).toBeUndefined();

    for (const resolution of ["discard", "applied"] as const) {
      const resolved = workbenchReducer(queued, {
        type: "resolve-navigation",
        resolution
      });
      expect(resolved.mode).toBe("project");
      expect(resolved.activeEditor).toBeUndefined();
      expect(resolved.activeEditorDirty).toBe(false);
    }
  });

  it("preserves the draft after Apply failure", () => {
    const queued = workbenchReducer(
      createInitialWorkbenchUiState({
        activeEditor: { kind: "loft" },
        activeEditorDirty: true
      }),
      {
        type: "request-navigation",
        intent: { kind: "document-action", action: "undo" }
      }
    );
    const failed = workbenchReducer(queued, {
      type: "navigation-apply-failed"
    });

    expect(failed.activeEditor).toEqual({ kind: "loft" });
    expect(failed.activeEditorDirty).toBe(true);
    expect(failed.navigationIntent).toBeUndefined();
  });

  it("does not guard an action explicitly declared to preserve the editor", () => {
    const state = createInitialWorkbenchUiState({
      activeEditor: { kind: "fillet" },
      activeEditorDirty: true,
      commandSearchOpen: true
    });
    const next = workbenchReducer(state, {
      type: "request-navigation",
      intent: {
        kind: "command-search-action",
        actionId: "solid.measure",
        mode: "solid",
        closesEditor: false
      }
    });

    expect(next.activeEditor).toEqual({ kind: "fillet" });
    expect(next.activeEditorDirty).toBe(true);
    expect(next.navigationIntent).toBeUndefined();
    expect(next.commandSearchOpen).toBe(false);
  });

  it("clamps reducer-driven dock resizing", () => {
    const narrowed = workbenchReducer(createInitialWorkbenchUiState(), {
      type: "set-dock-width",
      side: "left",
      width: 100
    });
    const widened = workbenchReducer(narrowed, {
      type: "set-dock-width",
      side: "right",
      width: 900
    });

    expect(widened.leftDockWidth).toBe(220);
    expect(widened.rightDockWidth).toBe(460);
  });

  it("uses human navigation-prompt copy", () => {
    const prompt = getDirtyNavigationPrompt({
      kind: "mode",
      mode: "sketch"
    });

    expect(prompt.title).toBe("Apply changes before leaving?");
    expect(prompt.message).toContain("switching to Sketch mode");
    expect(prompt.message).not.toMatch(/CADOps|schema|featureId/);
  });
});
