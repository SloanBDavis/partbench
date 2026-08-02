import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type {
  FeatureCompositeSweepForm,
  FeatureExtrudeForm,
  FeatureLoftForm
} from "../../cadCommands";
import {
  buildFeatureChamferOp,
  buildFeatureHoleOp,
  buildFeatureLinearPatternOp,
  buildFeatureMirrorOp,
  buildFeatureShellOp
} from "../../cadCommands";
import { SolidModePanel } from "./SolidModePanel";
import { createPrimitiveDraft } from "./solidEditorDefaults";
import {
  advanceDeleteConfirmation,
  applySolidCollectorSelection,
  applySolidDraftOnce,
  cancelSolidDraft
} from "./solidEditorSession";
import { validateSolidDraft } from "./solidDraftValidation";
import {
  createSolidEditorSubmission,
  type SolidEditorRequest
} from "./solidEditorTypes";

describe("SolidModePanel", () => {
  it("locks editor fields and delete while disabled/pending", () => {
    const request = {
      key: "extrude-edit",
      kind: "extrude",
      mode: "edit",
      deletable: true,
      title: "Extrude 1",
      initialDraft: {
        id: "feat_1",
        bodyId: "body_1",
        name: "Extrude 1",
        depth: 10,
        side: "positive",
        operationMode: "newBody"
      }
    } as const satisfies SolidEditorRequest<"extrude">;

    const markup = renderToStaticMarkup(
      createElement(SolidModePanel, {
        activeEditor: request,
        disabled: true,
        onApply: () => undefined,
        onDelete: () => undefined
      })
    );

    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain("pb-solid-draft-fields");
    expect(markup).toMatch(/<fieldset[^>]*disabled=""/);
    expect(markup).toContain("Delete");
    const deleteButton = markup.match(
      /<button[^>]*class="[^"]*pb-button--danger[^"]*"[^>]*>/
    )?.[0];
    expect(deleteButton).toContain('disabled=""');
  });

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

  it("keeps hole targets editable and shows disabled exact choices plus multi-solid warnings", () => {
    const markup = renderToStaticMarkup(
      createElement(SolidModePanel, {
        activeEditor: {
          key: "hole-edit",
          kind: "hole",
          mode: "edit",
          title: "Edit Hole",
          initialDraft: {
            id: "feature-hole",
            bodyId: "body-hole",
            targetBodyId: "body-multi",
            name: "Hole",
            depthMode: "throughAll",
            depth: 1,
            direction: "positive"
          },
          choices: {
            targetBodies: [
              {
                key: "body-multi",
                value: "body-multi",
                label: "Multi-solid target",
                kind: "body",
                warning:
                  "This body contains 3 solids. The hole applies to every intersected solid."
              },
              {
                key: "body-blocked",
                value: "body-blocked",
                label: "Unavailable imported body",
                kind: "body",
                disabled: true
              }
            ]
          }
        },
        onApply: () => undefined
      })
    );
    const targetSelect = markup.match(
      /<select class="pb-field"[^>]*>[\s\S]*?Multi-solid target[\s\S]*?<\/select>/
    )?.[0];

    expect(targetSelect).toBeDefined();
    expect(targetSelect?.match(/^<select[^>]*>/)?.[0]).not.toContain(
      'disabled=""'
    );
    expect(targetSelect).toMatch(
      /<option[^>]*value="body-blocked"[^>]*disabled=""[^>]*>Unavailable imported body<\/option>/
    );
    expect(markup).toContain(
      "This body contains 3 solids. The hole applies to every intersected solid."
    );
    expect(markup).toContain('role="status"');
  });

  it("locks edit fields the backend cannot update", () => {
    const markup = renderToStaticMarkup(
      createElement(SolidModePanel, {
        activeEditor: {
          key: "extrude-edit",
          kind: "compositeExtrude",
          title: "Edit Extrude",
          mode: "edit",
          initialDraft: {
            id: "extrude-a",
            bodyId: "body-a",
            targetBodyId: "body-target",
            name: "Extrude A",
            profile: {
              kind: "entity",
              sketchId: "sketch-a",
              entityId: "rectangle-a"
            },
            depth: 10,
            side: "positive",
            operationMode: "cut"
          },
          choices: {
            profiles: [],
            cutTargetBodies: [
              {
                key: "body-target",
                value: "body-target",
                label: "Target",
                kind: "body"
              }
            ]
          }
        },
        onApply: () => undefined
      })
    );

    expect(markup).toMatch(/id="solid-feature-name"[^>]*disabled=""/);
    expect(markup).toMatch(
      /id="solid-composite-extrude-operation"[^>]*disabled=""/
    );
    expect(markup).toMatch(/class="pb-selection-collector"[^>]*disabled=""/);
    expect(markup).not.toMatch(
      /id="solid-composite-extrude-depth"[^>]*disabled=""/
    );
  });
});

describe("Solid editor session", () => {
  it("arms delete on the first click and fires only once on the second", () => {
    expect(advanceDeleteConfirmation(false)).toEqual({
      nextArmed: true,
      shouldDelete: false
    });
    expect(advanceDeleteConfirmation(true)).toEqual({
      nextArmed: false,
      shouldDelete: true
    });
    expect(advanceDeleteConfirmation(true, { blocked: true })).toEqual({
      nextArmed: true,
      shouldDelete: false
    });
  });

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

  it("routes semantic viewport/tree picks into the exact CADOps fields", () => {
    const chamfer = applySolidCollectorSelection(
      "chamfer",
      {
        id: "",
        bodyId: "",
        targetBodyId: "body-a",
        name: "",
        edgeStableId: "edge-first",
        distance: 1,
        radius: 1
      },
      {
        edges: [
          {
            key: "edge-first",
            value: { targetBodyId: "body-a", edgeStableId: "edge-first" },
            label: "First edge",
            kind: "edge"
          },
          {
            key: "edge-selected",
            value: {
              targetBodyId: "body-a",
              edgeStableId: "edge-selected"
            },
            label: "Selected edge",
            kind: "edge"
          }
        ]
      },
      "edge",
      "edge-selected"
    );
    expect(
      buildFeatureChamferOp(
        chamfer as Parameters<typeof buildFeatureChamferOp>[0]
      )
    ).toMatchObject({
      targetBodyId: "body-a",
      edgeStableId: "edge-selected"
    });

    const hole = applySolidCollectorSelection(
      "hole",
      {
        id: "",
        bodyId: "",
        targetBodyId: "",
        sketchId: "sketch-source",
        circleEntityId: "circle-source",
        name: "",
        depthMode: "throughAll",
        depth: 10,
        direction: "positive"
      },
      {
        targetBodies: [
          {
            key: "body-result",
            value: "body-result",
            label: "Result body",
            kind: "hole target",
            targetTopologyAnchorId: "anchor-body"
          }
        ]
      },
      "targetBody",
      "body-result"
    );
    const holeForm = hole as Parameters<typeof buildFeatureHoleOp>[2];
    expect(
      buildFeatureHoleOp(holeForm.sketchId!, holeForm.circleEntityId!, holeForm)
    ).toMatchObject({
      sketchId: "sketch-source",
      circleEntityId: "circle-source",
      targetTopologyAnchorId: "anchor-body"
    });
    expect(
      applySolidCollectorSelection(
        "hole",
        holeForm,
        {
          targetBodies: [
            {
              key: "blocked-body",
              value: "blocked-body",
              label: "Blocked body",
              kind: "hole target",
              disabled: true
            }
          ]
        },
        "targetBody",
        "blocked-body"
      )
    ).toBe(holeForm);

    const shell = applySolidCollectorSelection(
      "shell",
      {
        id: "",
        bodyId: "",
        targetBodyId: "body-a",
        name: "",
        wallThickness: 1,
        openFaceRefs: []
      },
      {
        openFaces: [
          {
            key: "saved-face",
            value: {
              kind: "topologyAnchor",
              bodyId: "body-a",
              anchorId: "face-anchor"
            },
            label: "Saved face",
            kind: "saved planar face"
          }
        ]
      },
      "openFaces",
      "saved-face"
    );
    expect(
      buildFeatureShellOp(shell as Parameters<typeof buildFeatureShellOp>[0])
        .openFaceRefs
    ).toEqual([
      {
        kind: "topologyAnchor",
        bodyId: "body-a",
        anchorId: "face-anchor"
      }
    ]);

    const pattern = applySolidCollectorSelection(
      "linearPattern",
      {
        id: "",
        bodyId: "",
        seedBodyId: "body-a",
        name: "",
        direction: { kind: "globalAxis", axis: "x" },
        spacing: 10,
        instanceCount: 3
      },
      {
        directions: [
          {
            key: "named-axis",
            value: { kind: "namedReference", name: "Axis A" },
            label: "Axis A",
            kind: "named line edge"
          }
        ]
      },
      "direction",
      "named-axis"
    );
    expect(
      buildFeatureLinearPatternOp(
        pattern as Parameters<typeof buildFeatureLinearPatternOp>[0]
      ).direction
    ).toEqual({
      kind: "namedReference",
      name: "Axis A"
    });

    const mirror = applySolidCollectorSelection(
      "mirror",
      {
        id: "",
        bodyId: "",
        seedBodyId: "body-a",
        name: "",
        plane: { kind: "standardPlane", plane: "XY", offset: 4 },
        includeOriginal: true
      },
      {
        mirrorPlanes: [
          {
            key: "selected-face",
            value: {
              kind: "generatedFace",
              bodyId: "body-b",
              stableId: "face-selected"
            },
            label: "Selected face",
            kind: "face"
          }
        ]
      },
      "mirrorPlane",
      "selected-face"
    );
    expect(
      buildFeatureMirrorOp(mirror as Parameters<typeof buildFeatureMirrorOp>[0])
        .plane
    ).toEqual({
      kind: "generatedFace",
      bodyId: "body-b",
      stableId: "face-selected",
      offset: 4
    });
  });
});
