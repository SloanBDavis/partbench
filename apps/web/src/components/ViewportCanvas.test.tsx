import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ViewportCanvas } from "./ViewportCanvas";
import type { ViewportReferenceAction } from "../viewportReferenceActions";
import type { ViewportSelectionDisplay } from "../viewportSelectionDisplay";
import type { ViewportHoverState } from "../viewportHoverIntent";
import type { ViewportMeasurementOverlay } from "../viewportMeasurementOverlay";

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

  it("renders transient hover feedback without changing selected status", () => {
    const markup = renderToStaticMarkup(
      createElement(ViewportCanvas, {
        primitives: [],
        meshes: [],
        selectedId: "body_rect",
        selectionDisplay: createSelectionDisplay({
          title: "Base (Body)"
        }),
        hoverState: createHoverState({
          title: "Hovered base (Body)",
          detail: "4 command-ready operations",
          commandOperationLabels: ["Name reference", "Inspect reference"]
        }),
        onSelect: () => undefined,
        onHover: () => undefined
      })
    );

    expect(markup).toContain('data-selection-kind="body"');
    expect(markup).toContain('data-hover-kind="body"');
    expect(markup).toContain("Hovered base (Body)");
    expect(markup).toContain("Name reference, Inspect reference");
  });

  it("renders compact query-derived measurement overlays", () => {
    const markup = renderToStaticMarkup(
      createElement(ViewportCanvas, {
        primitives: [],
        meshes: [],
        selectedId: "body_rect",
        selectionDisplay: createSelectionDisplay(),
        measurementOverlay: createMeasurementOverlay({
          title: "Face measurement",
          detail: "Start cap",
          rows: [
            { label: "Area", value: "8 mm^2" },
            { label: "Surface", value: "plane" }
          ]
        }),
        onSelect: () => undefined
      })
    );

    expect(markup).toContain("Viewport measurements");
    expect(markup).toContain('data-measurement-kind="generatedReference"');
    expect(markup).toContain(
      'data-measurement-source="body.generatedReferenceMeasurements"'
    );
    expect(markup).toContain("Face measurement");
    expect(markup).toContain("8 mm^2");
  });

  it("keeps raw internal IDs out of visible hover and measurement markup", () => {
    const markup = renderToStaticMarkup(
      createElement(ViewportCanvas, {
        primitives: [],
        meshes: [],
        selectedId: "body_rect",
        selectionDisplay: createSelectionDisplay(),
        hoverState: createHoverState({
          diagnostics: [
            {
              code: "MISSING_SELECTION_TARGET",
              status: "missing",
              message:
                "Viewport hover target did not resolve to a current CAD body or object."
            }
          ]
        }),
        measurementOverlay: createMeasurementOverlay({
          error:
            "Reference measurements unavailable: internal render target is missing or stale."
        }),
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

    expect(markup).not.toContain("selection-buffer");
    expect(markup).not.toContain("mesh-triangle");
    expect(markup).not.toContain("occt-shape");
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

function createHoverState(
  overrides: Partial<
    Extract<ViewportHoverState, { readonly kind: "body" }>
  > = {}
): ViewportHoverState {
  return {
    kind: "body",
    title: "Base (Body)",
    detail: "Command-ready reference",
    tone: "ready",
    bodyId: "body_rect",
    renderTargetId: "body_rect",
    semanticSelection: { type: "body", bodyId: "body_rect" },
    referenceStatus: "resolved",
    commandOperations: [],
    commandOperationLabels: [],
    diagnostics: [],
    ...overrides
  };
}

function createMeasurementOverlay(
  overrides: Partial<ViewportMeasurementOverlay> = {}
): ViewportMeasurementOverlay {
  return {
    selectionKind: "generatedReference",
    title: "Face measurement",
    detail: "Start cap",
    source: "body.generatedReferenceMeasurements",
    tone: "ready",
    rows: [],
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
