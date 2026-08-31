import { describe, expect, it } from "vitest";
import {
  bindDirtyProjectUnloadGuard,
  documentActionForReplacement,
  getProjectReplacementGuardPrompt,
  getRecoveryDiscardConfirmPrompt,
  shouldPromptProjectDirtyGuard
} from "./projectDirtyReplacementGuard";

describe("V22 project dirty replacement guard", () => {
  it("runs the editor draft guard before the project dirty guard", () => {
    expect(shouldPromptProjectDirtyGuard(true, true)).toBe("editor-draft");
    expect(shouldPromptProjectDirtyGuard(true, false)).toBe("project-dirty");
    expect(shouldPromptProjectDirtyGuard(false, true)).toBe("editor-draft");
    expect(shouldPromptProjectDirtyGuard(false, false)).toBe("proceed");
  });

  it("uses Save/Discard/Cancel copy for New, Open, JSON, and Restore", () => {
    for (const kind of ["new", "open-wcad", "import-json", "restore"] as const) {
      const prompt = getProjectReplacementGuardPrompt(kind);
      expect(prompt.saveLabel).toBe("Save");
      expect(prompt.discardLabel).toBe("Discard");
      expect(prompt.cancelLabel).toBe("Cancel");
      expect(prompt.message.toLowerCase()).not.toMatch(
        /g-|\.wcad|opfs|filehandle|file-handle/
      );
      expect(documentActionForReplacement(kind)).toBeTruthy();
    }
  });

  it("requires explicit confirmation before discarding recovery data", () => {
    const prompt = getRecoveryDiscardConfirmPrompt();
    expect(prompt.confirmLabel).toBe("Discard recovery data");
    expect(prompt.cancelLabel).toBe("Cancel");
    expect(prompt.message.toLowerCase()).not.toMatch(/opfs|filehandle|g-/);
  });

  it("registers beforeunload only while dirty and never starts a recovery write", () => {
    const listeners = new Map<string, EventListener>();
    const target = {
      addEventListener(type: string, listener: EventListener) {
        listeners.set(type, listener);
      },
      removeEventListener(type: string, listener: EventListener) {
        if (listeners.get(type) === listener) {
          listeners.delete(type);
        }
      }
    } as Pick<Window, "addEventListener" | "removeEventListener">;
    const clean = bindDirtyProjectUnloadGuard(target, false);
    expect(listeners.has("beforeunload")).toBe(false);
    clean();
    const unbind = bindDirtyProjectUnloadGuard(target, true);
    expect(listeners.has("beforeunload")).toBe(true);
    const event = {
      preventDefault() {
        this.defaultPrevented = true;
      },
      returnValue: "changed",
      defaultPrevented: false
    };
    const result = listeners.get("beforeunload")?.(event as unknown as Event);
    expect(result).toBeUndefined();
    expect(event.defaultPrevented).toBe(true);
    expect(event.returnValue).toBe("");
    unbind();
    expect(listeners.has("beforeunload")).toBe(false);
  });
});
