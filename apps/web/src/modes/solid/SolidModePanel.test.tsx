import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type {
  FeatureCompositeSweepForm,
  FeatureExtrudeForm,
  FeatureLoftForm
} from "../../cadCommands";
import { SolidModePanel, validateSolidDraft } from "./SolidModePanel";
import { createPrimitiveDraft } from "./solidEditorDefaults";
import { applySolidDraftOnce, cancelSolidDraft } from "./solidEditorSession";
import {
  createSolidEditorSubmission,
  type SolidEditorRequest
} from "./solidEditorTypes";

describe("SolidModePanel", () => {
  it("opens a primitive as an explicit draft and stays inert without an apply callback", () => {
    const request = {
      key: "box-new",
      kind: "box",
      title: "New box",
      initialDraft: createPrimitiveDraft("box")
    } as const satisfies SolidEditorRequest<"box">;

    const markup = renderToStaticMarkup(
      createElement(SolidModePanel, { activeEditor: request })
    );

    expect(markup).toContain("New box");
    expect(markup).toContain("Width");
    expect(markup).toContain("Height");
    expect(markup).toContain("Depth");
    expect(markup).toContain("Profile center");
    expect(markup).toContain("Move along Z is not supported");
    expect(markup).not.toContain("solid-translation-z");
    expect(markup).toContain("Cancel");
    expect(markup).toContain("This action is not connected.");
    const applyButton = markup.match(
      /<button[^>]*title="Apply \(Ctrl\/Cmd\+Enter\)"[^>]*>/
    )?.[0];
    expect(applyButton).toContain('disabled=""');
  });

  it("keeps full XYZ placement for primitives whose command honors it", () => {
    const markup = renderToStaticMarkup(
      createElement(SolidModePanel, {
        activeEditor: {
          key: "sphere-new",
          kind: "sphere",
          title: "New sphere",
          initialDraft: createPrimitiveDraft("sphere")
        },
        onApply: () => undefined
      })
    );

    expect(markup).toContain("Center position");
    expect(markup).toContain("solid-translation-z");
  });

  it("keeps Z placement when editing a legacy primitive box", () => {
    const markup = renderToStaticMarkup(
      createElement(SolidModePanel, {
        activeEditor: {
          key: "box-edit",
          kind: "box",
          mode: "edit",
          title: "Edit box",
          initialDraft: createPrimitiveDraft("box")
        },
        onApply: () => undefined
      })
    );

    expect(markup).toContain("Center position");
    expect(markup).toContain("solid-translation-z");
    expect(markup).not.toContain("Move along Z is not supported");
  });

  it("renders the target collector and every extrude parameter", () => {
    const draft: FeatureExtrudeForm = {
      id: "",
      bodyId: "",
      targetBodyId: "body-target",
      name: "Pocket",
      depth: 6,
      side: "symmetric",
      operationMode: "cut"
    };
    const request = {
      key: "extrude-cut",
      kind: "extrude",
      title: "Pocket",
      initialDraft: draft,
      choices: {
        targetBodies: [
          {
            key: "target-body",
            value: "body-target",
            label: "Main body",
            kind: "Body"
          }
        ]
      }
    } as const satisfies SolidEditorRequest<"extrude">;

    const markup = renderToStaticMarkup(
      createElement(SolidModePanel, {
        activeEditor: request,
        onApply: () => undefined
      })
    );

    expect(markup).toContain("Target body");
    expect(markup).toContain("Main body");
    expect(markup).toContain("Accepts a body.");
    expect(markup).not.toContain("Select a body.");
    expect(markup).toContain("Operation");
    expect(markup).toContain("Depth");
    expect(markup).toContain("Side");
    expect(markup).toContain("Ready to apply.");
  });

  it("renders a multi-section loft collector without exposing source ids", () => {
    const draft: FeatureLoftForm = {
      id: "",
      bodyId: "",
      name: "Transition",
      sections: [
        { sketchId: "private-sketch-a", entityId: "private-profile-a" },
        { sketchId: "private-sketch-b", entityId: "private-profile-b" }
      ]
    };
    const request = {
      key: "loft-new",
      kind: "loft",
      title: "Transition",
      initialDraft: draft,
      choices: {
        loftSections: [
          {
            key: "section-a",
            value: draft.sections[0]!,
            label: "Top profile",
            kind: "Closed profile"
          },
          {
            key: "section-b",
            value: draft.sections[1]!,
            label: "Bottom profile",
            kind: "Closed profile"
          }
        ]
      }
    } as const satisfies SolidEditorRequest<"loft">;

    const markup = renderToStaticMarkup(
      createElement(SolidModePanel, {
        activeEditor: request,
        onApply: () => undefined
      })
    );

    expect(markup).toContain("Top profile");
    expect(markup).toContain("Bottom profile");
    expect(markup).toContain("numbered order shown");
    expect(markup).toContain("parallel planar body face");
    expect(markup).not.toContain("private-sketch-a");
    expect(markup).not.toContain("private-profile-b");
  });

  it("keeps V17 sweep source orientation editable", () => {
    const draft: FeatureCompositeSweepForm = {
      id: "sweep-a",
      bodyId: "body-a",
      name: "Rail",
      profile: { kind: "entity", sketchId: "profile", entityId: "circle" },
      path: {
        kind: "entity",
        sketchId: "path",
        entityId: "arc",
        orientation: "reverse"
      }
    };
    const markup = renderToStaticMarkup(
      createElement(SolidModePanel, {
        activeEditor: {
          key: "sweep-edit",
          kind: "compositeSweep",
          title: "Edit Sweep",
          mode: "edit",
          initialDraft: draft,
          choices: {
            profiles: [],
            paths: [
              {
                key: "path:arc",
                value: draft.path,
                label: "Arc path",
                kind: "path"
              }
            ]
          }
        },
        onApply: () => undefined
      })
    );

    expect(markup).toContain("Reverse path direction");
  });
});

describe("Solid editor session", () => {
  it("submits an eligible draft at most once while apply is pending", async () => {
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const onApply = vi.fn(() => pending);
    const gate = { pending: false };
    const draft = createPrimitiveDraft("sphere");
    const submission = createSolidEditorSubmission("sphere", draft);

    const first = applySolidDraftOnce(
      gate,
      submission,
      { status: "ready" },
      true,
      onApply
    );
    const second = applySolidDraftOnce(
      gate,
      submission,
      { status: "ready" },
      true,
      onApply
    );

    expect(onApply).toHaveBeenCalledTimes(1);
    await expect(second).resolves.toBe(false);
    release();
    await expect(first).resolves.toBe(true);
    expect(gate.pending).toBe(false);
  });

  it("cancel restores the initial draft and invokes only the cancel callback", () => {
    const onCancel = vi.fn();
    const initial = createPrimitiveDraft("cylinder");
    const restored = cancelSolidDraft(initial, onCancel);

    expect(restored).toBe(initial);
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("keeps invalid and incomplete forms out of the ready state", () => {
    expect(
      validateSolidDraft("box", {
        ...createPrimitiveDraft("box"),
        width: 0
      })
    ).toMatchObject({ status: "blocked" });
    expect(
      validateSolidDraft("loft", {
        id: "",
        bodyId: "",
        name: "Loft",
        sections: []
      })
    ).toEqual({
      status: "collecting",
      message: "Select at least two sections."
    });
  });
});
