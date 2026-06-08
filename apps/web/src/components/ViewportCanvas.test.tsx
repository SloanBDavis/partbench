import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ViewportCanvas } from "./ViewportCanvas";
import type { ViewportReferenceAction } from "../viewportReferenceActions";
import type { ViewportSelectionDisplay } from "../viewportSelectionDisplay";

describe("ViewportCanvas", () => {
  it("renders semantic selection and command-ready status beside the viewport", () => {
    const markup = renderToStaticMarkup(
      createElement(ViewportCanvas, {
        primitives: [],
        meshes: [],
        selectedId: "body_rect",
        selectionDisplay: createSelectionDisplay({
          selectionKind: "generatedReference",
          title: "Face: Start cap",
          detail: "Command-ready reference",
          tone: "ready",
          geometryStatus: "ready",
          geometryDetail: "OCCT mesh ready",
          referenceSummary: "Face: Start cap",
          commandOperationLabels: ["Create sketch on face", "Name reference"]
        }),
        onSelect: () => undefined
      })
    );

    expect(markup).toContain('data-selection-kind="generatedReference"');
    expect(markup).toContain('data-geometry-status="ready"');
    expect(markup).toContain("Command-ready reference");
    expect(markup).toContain("Create sketch on face, Name reference");
    expect(markup).toContain("OCCT mesh ready");
  });

  it("renders structured diagnostics for blocked viewport selections", () => {
    const markup = renderToStaticMarkup(
      createElement(ViewportCanvas, {
        primitives: [],
        meshes: [],
        selectedId: "body_rect",
        selectionDisplay: createSelectionDisplay({
          detail: "Selection target unsupported",
          tone: "blocked",
          diagnostics: [
            {
              code: "UNSUPPORTED_SELECTION_TARGET",
              status: "unsupported",
              message: "Primitive body references are not command-ready."
            }
          ]
        }),
        onSelect: () => undefined
      })
    );

    expect(markup).toContain("viewport-status-blocked");
    expect(markup).toContain("Selection target unsupported");
    expect(markup).toContain(
      "Primitive body references are not command-ready."
    );
  });

  it("renders viewport-adjacent query-derived reference actions", () => {
    const actions = [
      createReferenceAction({
        id: "face:body_rect:generated:face:body_rect:startCap",
        label: "Start cap",
        kindLabel: "Face",
        commandable: true,
        selected: true,
        commandOperationLabels: ["Name reference", "Create sketch on face"]
      }),
      createReferenceAction({
        id: "edge:body_rect:generated:edge:body_rect:start:uMin",
        label: "Start uMin",
        kindLabel: "Edge",
        commandable: false,
        selected: false,
        commandOperationLabels: [],
        diagnostic: {
          code: "CONSUMED_SELECTION_BODY",
          status: "consumed",
          message: "Selected body body_rect is consumed by feature feat_cut."
        }
      })
    ];
    const markup = renderToStaticMarkup(
      createElement(ViewportCanvas, {
        primitives: [],
        meshes: [],
        selectedId: "body_rect",
        selectionDisplay: createSelectionDisplay(),
        referenceActions: actions,
        onSelect: () => undefined,
        onSelectGeneratedReference: () => undefined
      })
    );

    expect(markup).toContain("Viewport reference candidates");
    expect(markup).toContain("Face: Start cap");
    expect(markup).toContain("Name reference, Create sketch on face");
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain('data-commandable="false"');
    expect(markup).toContain(
      "Selected body body_rect is consumed by feature feat_cut."
    );
  });

  it("keeps raw generated-reference IDs out of visible viewport action markup", () => {
    const markup = renderToStaticMarkup(
      createElement(ViewportCanvas, {
        primitives: [],
        meshes: [],
        selectedId: "body_rect",
        selectionDisplay: createSelectionDisplay(),
        referenceActions: [
          createReferenceAction({
            id: "face:body_rect:selection-buffer:face:17",
            label: "Start cap",
            kindLabel: "Face",
            commandable: true,
            selected: false,
            stableId: "selection-buffer:face:17"
          })
        ],
        onSelect: () => undefined,
        onSelectGeneratedReference: () => undefined
      })
    );

    expect(markup).toContain("Face: Start cap");
    expect(markup).not.toContain("selection-buffer");
    expect(markup).not.toContain("mesh-triangle");
    expect(markup).not.toContain("occt-shape");
  });
});

function createSelectionDisplay(
  overrides: Partial<ViewportSelectionDisplay> = {}
): ViewportSelectionDisplay {
  return {
    selectionKind: "body",
    title: "Base (Body)",
    detail: "Command-ready reference",
    tone: "ready",
    renderTargetId: "body_rect",
    geometryStatus: "ready",
    geometryDetail: "OCCT mesh ready",
    referenceStatus: "resolved",
    referenceSummary: "Face: Start cap",
    commandOperations: [],
    commandOperationLabels: [],
    diagnostics: [],
    ...overrides
  };
}

function createReferenceAction(
  overrides: Partial<ViewportReferenceAction> & {
    readonly id: string;
    readonly label: string;
    readonly kindLabel: string;
    readonly stableId?: string;
  }
): ViewportReferenceAction {
  const stableId = overrides.stableId ?? "generated:face:body_rect:startCap";

  return {
    id: overrides.id,
    reference: {
      kind: "face",
      stableId,
      label: overrides.label,
      bodyId: "body_rect",
      ownerPartId: "part:default",
      sourceFeatureId: "feat_rect",
      sourceSketchId: "sketch_1",
      sourceSketchEntityId: "rect_1",
      role: "startCap",
      eligibleOperations: ["feature.attachSketchPlane"],
      geometricSignature: {
        profileKind: "rectangle",
        sketchPlane: "XY",
        extrudeSide: "positive",
        depth: 2,
        surfaceType: "plane"
      }
    },
    label: overrides.label,
    kindLabel: overrides.kindLabel,
    commandable: overrides.commandable ?? true,
    selected: overrides.selected ?? false,
    commandOperations: overrides.commandOperations ?? [],
    commandOperationLabels: overrides.commandOperationLabels ?? [],
    ...(overrides.diagnostic ? { diagnostic: overrides.diagnostic } : {})
  };
}
