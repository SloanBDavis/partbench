import { describe, expect, it } from "vitest";
import type { GeneratedReferenceSelectionState } from "./generatedReferenceSelection";
import { createViewportVisualStateModel } from "./viewportVisualState";
import type { ViewportSelectionDisplay } from "./viewportSelectionDisplay";
import { createSketchEntitySelectionId } from "./sketchRenderIds";

describe("viewport visual state", () => {
  it("marks selected command-ready bodies as selected command targets", () => {
    const visualState = createViewportVisualStateModel({
      selectionDisplay: createSelectionDisplay({
        selectionKind: "body",
        renderTargetId: "body_rect",
        commandOperations: ["feature.selectReference"]
      }),
      selectedGeneratedReferenceState: { status: "none" }
    });

    expect(visualState.rendererVisualStates).toEqual([
      { targetId: "body_rect", targetKind: "body", state: "selected" },
      { targetId: "body_rect", targetKind: "body", state: "commandTarget" }
    ]);
    expect(visualState.status).toBeUndefined();
  });

  it("maps selected generated faces to owning body target IDs with face display metadata", () => {
    const visualState = createViewportVisualStateModel({
      selectionDisplay: createSelectionDisplay({
        selectionKind: "generatedReference",
        title: "Face: Start cap",
        renderTargetId: "body_rect",
        commandOperations: ["feature.attachSketchPlane"]
      }),
      selectedGeneratedReferenceState: createGeneratedReferenceState("face")
    });

    expect(visualState.rendererVisualStates).toEqual([
      { targetId: "body_rect", targetKind: "face", state: "selected" },
      { targetId: "body_rect", targetKind: "face", state: "commandTarget" }
    ]);
    expect(visualState.status).toBeUndefined();
    expect(JSON.stringify(visualState.rendererVisualStates)).not.toContain(
      "generated:face:body_rect:startCap"
    );
  });

  it("maps selected generated edges to owning body target IDs with edge display metadata", () => {
    const visualState = createViewportVisualStateModel({
      selectionDisplay: createSelectionDisplay({
        selectionKind: "generatedReference",
        title: "Edge: Start uMin",
        renderTargetId: "body_rect",
        commandOperations: ["feature.selectReference"]
      }),
      selectedGeneratedReferenceState: createGeneratedReferenceState("edge")
    });

    expect(visualState.rendererVisualStates).toEqual([
      { targetId: "body_rect", targetKind: "edge", state: "selected" },
      { targetId: "body_rect", targetKind: "edge", state: "commandTarget" }
    ]);
    expect(visualState.status).toBeUndefined();
    expect(JSON.stringify(visualState.rendererVisualStates)).not.toContain(
      "generated:edge:body_rect:start:uMin"
    );
  });

  it("uses warning tone for consumed and unsupported selected bodies", () => {
    const visualState = createViewportVisualStateModel({
      selectionDisplay: createSelectionDisplay({
        renderTargetId: "body_rect",
        tone: "warning",
        detail: "Selection body consumed"
      }),
      selectedGeneratedReferenceState: { status: "none" }
    });

    expect(visualState.rendererVisualStates).toEqual([
      { targetId: "body_rect", targetKind: "body", state: "selected" },
      { targetId: "body_rect", targetKind: "body", state: "warning" }
    ]);
    expect(visualState.status).toBeUndefined();
  });

  it("uses blocked warning state for stale generated references", () => {
    const visualState = createViewportVisualStateModel({
      selectionDisplay: createSelectionDisplay({
        selectionKind: "generatedReference",
        renderTargetId: "body_rect",
        tone: "blocked",
        title: "Selected reference stale",
        detail: "Selected face reference is no longer available."
      }),
      selectedGeneratedReferenceState: {
        status: "stale",
        selection: {
          bodyId: "body_rect",
          stableId: "generated:face:body_rect:startCap",
          kind: "face"
        },
        message: "Selected face reference is no longer available."
      }
    });

    expect(visualState.rendererVisualStates).toEqual([
      { targetId: "body_rect", targetKind: "face", state: "selected" },
      { targetId: "body_rect", targetKind: "face", state: "warning" }
    ]);
    expect(visualState.status).toEqual({
      label: "Reference stale",
      detail: "Selected face reference is no longer available.",
      tone: "blocked"
    });
  });

  it("adds pending and failed derived geometry states", () => {
    const pending = createViewportVisualStateModel({
      selectionDisplay: createSelectionDisplay({
        renderTargetId: "body_rect",
        geometryStatus: "pending",
        geometryDetail: "Building display geometry"
      }),
      selectedGeneratedReferenceState: { status: "none" }
    });
    const failed = createViewportVisualStateModel({
      selectionDisplay: createSelectionDisplay({
        renderTargetId: "body_rect",
        geometryStatus: "error",
        geometryDetail: "OCCT mesh failed"
      }),
      selectedGeneratedReferenceState: { status: "none" }
    });

    expect(pending.rendererVisualStates).toContainEqual({
      targetId: "body_rect",
      targetKind: "body",
      state: "pending"
    });
    expect(failed.rendererVisualStates).toContainEqual({
      targetId: "body_rect",
      targetKind: "body",
      state: "failed"
    });
    expect(pending.status).toEqual({
      label: "Building display geometry",
      detail: "Building display geometry",
      tone: "warning"
    });
    expect(failed.status?.detail).toBe("OCCT mesh failed");
    expect(failed.status?.tone).toBe("failed");
  });

  it("preselects a hovered sketch entity by its semantic render ID", () => {
    const targetId = createSketchEntitySelectionId("sketch_1", "arc_1");
    const visualState = createViewportVisualStateModel({
      hoverState: {
        kind: "sketchEntity",
        title: "arc_1 (Arc)",
        detail: "Arc in Base sketch",
        tone: "idle",
        sketchId: "sketch_1",
        entityId: "arc_1",
        renderTargetId: targetId,
        commandOperations: [],
        commandOperationLabels: [],
        diagnostics: []
      },
      selectionDisplay: createSelectionDisplay({
        selectionKind: "none",
        renderTargetId: undefined,
        tone: "idle",
        geometryStatus: "none"
      }),
      selectedGeneratedReferenceState: { status: "none" }
    });

    expect(visualState.rendererVisualStates).toEqual([
      {
        targetId,
        targetKind: "sketchEntity",
        state: "preselection"
      }
    ]);
  });
});

function createSelectionDisplay(
  overrides: Partial<ViewportSelectionDisplay> = {}
): ViewportSelectionDisplay {
  return {
    selectionKind: "body",
    title: "Body selected",
    detail: "Ready reference",
    tone: "ready",
    renderTargetId: "body_rect",
    geometryStatus: "ready",
    geometryDetail: "Display geometry ready",
    referenceStatus: "resolved",
    referenceSummary: "Body: Rectangle extrude body",
    commandOperations: [],
    commandOperationLabels: [],
    diagnostics: [],
    ...overrides
  };
}

function createGeneratedReferenceState(
  kind: "face" | "edge"
): GeneratedReferenceSelectionState {
  if (kind === "face") {
    const stableId = "generated:face:body_rect:startCap";

    return {
      status: "selected",
      selection: {
        bodyId: "body_rect",
        stableId,
        kind
      },
      reference: {
        kind,
        stableId,
        label: "Start cap",
        description: "Generated reference",
        eligibleOperations: ["feature.selectReference"],
        bodyId: "body_rect",
        ownerPartId: "part:default",
        sourceFeatureId: "feat_rect",
        sourceSketchId: "sketch_1",
        sourceSketchEntityId: "rect_1",
        role: "startCap",
        geometricSignature: {
          profileKind: "rectangle",
          sketchPlane: "XY",
          extrudeSide: "positive",
          depth: 3,
          surfaceType: "plane",
          normal: [0, 0, -1]
        }
      },
      measurementRows: []
    };
  }

  const stableId = "generated:edge:body_rect:start:uMin";

  return {
    status: "selected",
    selection: {
      bodyId: "body_rect",
      stableId,
      kind: "edge"
    },
    reference: {
      kind: "edge",
      stableId,
      label: "Start uMin",
      description: "Generated reference",
      eligibleOperations: ["feature.selectReference"],
      bodyId: "body_rect",
      ownerPartId: "part:default",
      sourceFeatureId: "feat_rect",
      sourceSketchId: "sketch_1",
      sourceSketchEntityId: "rect_1",
      role: "start:uMin",
      adjacentFaceRoles: ["startCap", "side:uMin"],
      geometricSignature: {
        profileKind: "rectangle",
        sketchPlane: "XY",
        extrudeSide: "positive",
        depth: 3,
        curveType: "line"
      }
    },
    measurementRows: []
  };
}
