import { describe, expect, it } from "vitest";
import {
  canApplyFeatureEditor,
  createDraftChangedAction,
  createFeatureEditorState,
  featureEditorReducer,
  type FeatureEditorDraftPolicy
} from "./featureEditorState";

interface Draft {
  readonly name: string;
  readonly depth: number;
}

const policy: FeatureEditorDraftPolicy<Draft> = {
  isEqual: (left, right) =>
    left.name === right.name && left.depth === right.depth,
  validate: (draft) =>
    draft.depth > 0
      ? { status: "ready", message: "Ready to apply." }
      : {
          status: "blocked",
          message: "Depth must be greater than zero.",
          issues: [{ fieldId: "depth", message: "Enter a positive depth." }]
        }
};

describe("featureEditorState", () => {
  it("keeps field edits in a dirty draft until Apply starts", () => {
    const committed = { name: "Extrude 1", depth: 10 };
    const initial = createFeatureEditorState(
      committed,
      policy.validate(committed)
    );
    const changed = featureEditorReducer(
      initial,
      createDraftChangedAction(initial, { ...committed, depth: 24 }, policy)
    );

    expect(changed.committed).toEqual(committed);
    expect(changed.draft.depth).toBe(24);
    expect(changed.dirty).toBe(true);
    expect(changed.phase).toBe("ready");
    expect(canApplyFeatureEditor(changed)).toBe(true);
  });

  it("blocks invalid drafts and associates a field issue", () => {
    const initial = createFeatureEditorState(
      { name: "Extrude 1", depth: 10 },
      { status: "ready" }
    );
    const blocked = featureEditorReducer(
      initial,
      createDraftChangedAction(initial, { ...initial.draft, depth: 0 }, policy)
    );

    expect(blocked.phase).toBe("blocked");
    expect(blocked.validation.issues).toEqual([
      { fieldId: "depth", message: "Enter a positive depth." }
    ]);
    expect(canApplyFeatureEditor(blocked)).toBe(false);

    const cancelled = featureEditorReducer(blocked, { type: "cancelled" });
    expect(cancelled.validation.status).toBe("ready");
    expect(cancelled.phase).toBe("editing");
  });

  it("prevents duplicate Apply transitions while applying", () => {
    const initial = createFeatureEditorState(
      { name: "Box 1", depth: 10 },
      { status: "ready" }
    );
    const dirty = featureEditorReducer(
      initial,
      createDraftChangedAction(initial, { ...initial.draft, depth: 12 }, policy)
    );
    const applying = featureEditorReducer(dirty, { type: "apply-started" });

    expect(applying.phase).toBe("applying");
    expect(featureEditorReducer(applying, { type: "apply-started" })).toBe(
      applying
    );
    expect(
      featureEditorReducer(
        applying,
        createDraftChangedAction(
          applying,
          { ...applying.draft, depth: 14 },
          policy
        )
      )
    ).toBe(applying);
  });

  it("preserves the complete draft after Apply fails", () => {
    const initial = createFeatureEditorState(
      { name: "Fillet 1", depth: 2 },
      { status: "ready" }
    );
    const dirty = featureEditorReducer(
      initial,
      createDraftChangedAction(
        initial,
        { name: "Edge finish", depth: 4 },
        policy
      )
    );
    const applying = featureEditorReducer(dirty, { type: "apply-started" });
    const failed = featureEditorReducer(applying, {
      type: "apply-failed",
      message: "The selected edge is no longer available."
    });

    expect(failed.phase).toBe("error");
    expect(failed.draft).toEqual({ name: "Edge finish", depth: 4 });
    expect(failed.committed).toEqual({ name: "Fillet 1", depth: 2 });
    expect(failed.dirty).toBe(true);
  });

  it("promotes the draft only after success and Cancel restores source values", () => {
    const initial = createFeatureEditorState(
      { name: "Shell 1", depth: 1 },
      { status: "ready" }
    );
    const dirty = featureEditorReducer(
      initial,
      createDraftChangedAction(initial, { ...initial.draft, depth: 3 }, policy)
    );
    const cancelled = featureEditorReducer(dirty, { type: "cancelled" });

    expect(cancelled.draft).toEqual(initial.committed);
    expect(cancelled.dirty).toBe(false);

    const applying = featureEditorReducer(dirty, { type: "apply-started" });
    const succeeded = featureEditorReducer(applying, {
      type: "apply-succeeded"
    });
    expect(succeeded.committed.depth).toBe(3);
    expect(succeeded.dirty).toBe(false);
    expect(succeeded.phase).toBe("success");
  });

  it("supports an explicit asynchronous validation phase", () => {
    const initial = createFeatureEditorState(
      { name: "Loft 1", depth: 1 },
      { status: "collecting", message: "Select another section." }
    );
    const validating = featureEditorReducer(initial, {
      type: "validation-started"
    });
    const ready = featureEditorReducer(validating, {
      type: "validation-finished",
      validation: { status: "ready" }
    });

    expect(validating.phase).toBe("validating");
    expect(ready.phase).toBe("editing");
  });
});
