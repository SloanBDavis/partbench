import type {
  BodyMeasurementsSnapshot,
  CadBodySnapshot
} from "@web-cad/cad-core";
import type {
  CadGeneratedFaceReference,
  GeneratedReferenceMeasurement
} from "@web-cad/cad-protocol";
import { describe, expect, it } from "vitest";
import {
  createSelectedGeneratedReference,
  getGeneratedReferenceSelectionState
} from "./generatedReferenceSelection";
import { createViewportMeasurementOverlay } from "./viewportMeasurementOverlay";

describe("viewport measurement overlay", () => {
  it("formats selected generated-reference measurements from query-derived selection state", () => {
    const reference = createFaceReference();
    const measurement: GeneratedReferenceMeasurement = {
      kind: "face",
      stableId: reference.stableId,
      bodyId: reference.bodyId,
      sourceFeatureId: reference.sourceFeatureId,
      sourceSketchId: reference.sourceSketchId,
      sourceSketchEntityId: reference.sourceSketchEntityId,
      profileKind: "rectangle",
      units: "mm",
      measurementModel: "sourceAnalytic",
      role: "startCap",
      area: 8,
      bounds: {
        min: [-2, -1, 0],
        max: [2, 1, 0],
        size: [4, 2, 0],
        center: [0, 0, 0]
      },
      center: [0, 0, 0],
      surfaceType: "plane",
      normal: [0, 0, 1],
      normalRole: "startCap"
    };
    const state = getGeneratedReferenceSelectionState(
      createSelectedGeneratedReference(reference),
      createReferences(reference),
      new Map([[reference.stableId, { measurement }]]),
      "mm"
    );
    const overlay = createViewportMeasurementOverlay({
      body: createBody(),
      selectedGeneratedReferenceState: state,
      units: "mm"
    });

    expect(overlay).toMatchObject({
      selectionKind: "generatedReference",
      title: "Face measurement",
      detail: "Start cap",
      source: "body.generatedReferenceMeasurements",
      tone: "ready",
      rows: [
        { label: "Area", value: "8 mm^2" },
        {
          label: "Bounds",
          value:
            "min -2 mm, -1 mm, 0 mm; max 2 mm, 1 mm, 0 mm; size 4 mm, 2 mm, 0 mm"
        },
        { label: "Center", value: "0 mm, 0 mm, 0 mm" },
        { label: "Surface", value: "plane" },
        { label: "Normal", value: "0, 0, 1" },
        { label: "Normal role", value: "startCap" }
      ]
    });
  });

  it("formats supported body measurements from body.measurements query output", () => {
    const overlay = createViewportMeasurementOverlay({
      body: createBody("body_rect", "Base"),
      bodyMeasurements: createBodyMeasurements(),
      selectedGeneratedReferenceState: { status: "none" },
      units: "mm"
    });

    expect(overlay).toEqual({
      selectionKind: "body",
      title: "Body measurements",
      detail: "Base",
      source: "body.measurements",
      tone: "ready",
      rows: [
        { label: "Volume", value: "24 mm^3" },
        { label: "Surface area", value: "52 mm^2" },
        {
          label: "Local bounds",
          value:
            "min -2 mm, -1 mm, 0 mm; max 2 mm, 1 mm, 3 mm; size 4 mm, 2 mm, 3 mm"
        },
        { label: "Centroid", value: "0, 0, 1.50" },
        { label: "Model", value: "Source analytic" }
      ]
    });
  });

  it("surfaces structured measurement errors without leaking internal render IDs", () => {
    const reference = createFaceReference({
      stableId: "selection-buffer:face:17"
    });
    const state = getGeneratedReferenceSelectionState(
      createSelectedGeneratedReference(reference),
      createReferences(reference),
      new Map([
        [
          reference.stableId,
          {
            error:
              "Reference measurements unavailable: selection-buffer:face:17 is missing or stale."
          }
        ]
      ]),
      "mm"
    );
    const overlay = createViewportMeasurementOverlay({
      body: createBody(),
      selectedGeneratedReferenceState: state,
      units: "mm"
    });

    expect(overlay).toMatchObject({
      tone: "blocked",
      error:
        "Reference measurements unavailable: internal render target is missing or stale."
    });
    expect(JSON.stringify(overlay)).not.toContain("selection-buffer");
    expect(JSON.stringify(overlay)).not.toContain("mesh-triangle");
    expect(JSON.stringify(overlay)).not.toContain("occt-shape");
  });

  it("surfaces stale selected-reference measurement state", () => {
    const overlay = createViewportMeasurementOverlay({
      body: createBody(),
      selectedGeneratedReferenceState: {
        status: "stale",
        selection: {
          bodyId: "body_rect",
          stableId: "generated:face:body_rect:startCap",
          kind: "face"
        },
        message: "Selected face reference is no longer available."
      },
      units: "mm"
    });

    expect(overlay).toEqual({
      selectionKind: "generatedReference",
      title: "Reference measurement",
      detail: "Selected reference stale",
      source: "body.generatedReferenceMeasurements",
      tone: "blocked",
      rows: [],
      error: "Selected face reference is no longer available."
    });
  });

  it("surfaces body measurement errors from body.measurements query formatting", () => {
    const overlay = createViewportMeasurementOverlay({
      body: createBody("body_box"),
      bodyMeasurementsError:
        "Body measurements unavailable for body_box. Authored rectangle and circle extrude bodies are supported.",
      selectedGeneratedReferenceState: { status: "none" },
      units: "mm"
    });

    expect(overlay).toMatchObject({
      selectionKind: "body",
      tone: "blocked",
      rows: [],
      error:
        "Body measurements unavailable for body_box. Authored rectangle and circle extrude bodies are supported."
    });
  });
});

function createBody(id = "body_rect", name?: string): CadBodySnapshot {
  return {
    id,
    ...(name ? { name } : {}),
    kind: "solid",
    partId: "part:default",
    featureId: "feat_rect",
    source: {
      type: "sketchExtrudeFeature",
      featureId: "feat_rect",
      sketchId: "sketch_1",
      entityId: "rect_1",
      profileKind: "rectangle"
    }
  };
}

function createBodyMeasurements(): BodyMeasurementsSnapshot {
  return {
    bodyId: "body_rect",
    sourceFeatureId: "feat_rect",
    sourceSketchId: "sketch_1",
    sourceSketchEntityId: "rect_1",
    profileKind: "rectangle",
    sketchPlane: "XY",
    side: "positive",
    depth: 3,
    units: "mm",
    measurementModel: "sourceAnalytic",
    localExtents: [4, 2, 3],
    volume: 24,
    surfaceArea: 52,
    centroid: [0, 0, 1.5],
    localBounds: {
      min: [-2, -1, 0],
      max: [2, 1, 3],
      size: [4, 2, 3],
      center: [0, 0, 1.5]
    }
  };
}

function createReferences(reference: CadGeneratedFaceReference) {
  return {
    ok: true,
    query: "body.generatedReferences",
    cadOpsVersion: "cadops.v1",
    body: {
      kind: "body",
      stableId: "generated:body:body_rect",
      label: "Body",
      bodyId: "body_rect",
      ownerPartId: "part:default",
      sourceFeatureId: "feat_rect",
      sourceSketchId: "sketch_1",
      sourceSketchEntityId: "rect_1",
      profileKind: "rectangle",
      eligibleOperations: ["feature.selectReference"],
      geometricSignature: {
        profileKind: "rectangle",
        sketchPlane: "XY",
        extrudeSide: "positive",
        depth: 3
      }
    },
    faceCount: 1,
    faces: [reference],
    edgeCount: 0,
    edges: [],
    vertexCount: 0,
    vertices: []
  } as const;
}

function createFaceReference(
  overrides: { readonly stableId?: string } = {}
): CadGeneratedFaceReference {
  return {
    kind: "face",
    stableId: overrides.stableId ?? "generated:face:body_rect:startCap",
    label: "Start cap",
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
      depth: 3,
      surfaceType: "plane"
    }
  };
}
