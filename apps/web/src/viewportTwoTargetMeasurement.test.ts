import type { BodyMeasurementsSnapshot } from "@web-cad/cad-core";
import type {
  CadViewportMeasurementAuthority,
  GeneratedReferenceMeasurement
} from "@web-cad/cad-protocol";
import { describe, expect, it } from "vitest";
import type { ViewportMeasurementOverlay } from "./viewportMeasurementOverlay";
import {
  clearViewportTwoTargetMeasurementSecondTargetOnSelectionChange,
  createViewportTwoTargetMeasurementTarget,
  createViewportTwoTargetMeasurementView,
  updateViewportTwoTargetMeasurementSession,
  type ViewportTwoTargetMeasurementTarget
} from "./viewportTwoTargetMeasurement";

describe("viewport two-target measurement", () => {
  it("captures source-backed body centers and bounds summaries", () => {
    const target = createViewportTwoTargetMeasurementTarget({
      bodyMeasurements: createBodyMeasurements(),
      measurementOverlay: createBodyOverlay()
    });

    expect(target).toMatchObject({
      targetKind: "body",
      authority: "sourceAnalytic",
      pointRole: "bodyCentroid",
      point: [0, 0, 1.5],
      summaryRows: [
        { label: "Centroid", value: "0 mm, 0 mm, 1.50 mm" },
        {
          label: "Bounds",
          value:
            "min -2 mm, -1 mm, 0 mm; max 2 mm, 1 mm, 3 mm; size 4 mm, 2 mm, 3 mm"
        }
      ]
    });
  });

  it("captures generated face centers and normals from source measurements", () => {
    const target = createViewportTwoTargetMeasurementTarget({
      generatedReferenceMeasurement: createFaceMeasurement({
        center: [0, 0, 3],
        normal: [0, 0, 1]
      }),
      measurementOverlay: createGeneratedReferenceOverlay({
        targetKind: "generatedPlanarFace",
        title: "Face: End cap",
        stableId: "generated:face:body_rect:endCap"
      })
    });

    expect(target).toMatchObject({
      targetKind: "generatedPlanarFace",
      pointRole: "generatedFaceCenter",
      point: [0, 0, 3],
      vectorRole: "generatedFaceNormal",
      vector: [0, 0, 1]
    });
  });

  it("captures linear edge centers and directions from source endpoints", () => {
    const target = createViewportTwoTargetMeasurementTarget({
      generatedReferenceMeasurement: createLineEdgeMeasurement({
        startPoint: [0, 0, 0],
        endPoint: [4, 0, 0]
      }),
      measurementOverlay: createGeneratedReferenceOverlay({
        targetKind: "generatedEdge",
        title: "Edge: Start uMin",
        stableId: "generated:edge:body_rect:start:uMin"
      })
    });

    expect(target).toMatchObject({
      targetKind: "generatedEdge",
      pointRole: "generatedEdgeCenter",
      point: [2, 0, 0],
      vectorRole: "generatedLinearEdgeDirection",
      vector: [4, 0, 0]
    });
  });

  it("transitions through first, pending, second, selection-change, and Escape clear states", () => {
    const first = createTarget("first", {
      point: [0, 0, 0],
      vector: [0, 0, 1]
    });
    const second = createTarget("second", {
      point: [2, 0, 0],
      vector: [1, 0, 0]
    });
    const started = updateViewportTwoTargetMeasurementSession(
      {},
      { type: "start", target: first }
    );
    const preview = createViewportTwoTargetMeasurementView({
      activeTarget: second,
      session: started,
      units: "mm"
    });
    const completed = updateViewportTwoTargetMeasurementSession(started, {
      type: "setSecond",
      target: second
    });
    const selectionChanged =
      clearViewportTwoTargetMeasurementSecondTargetOnSelectionChange(completed);
    const escaped = updateViewportTwoTargetMeasurementSession(
      selectionChanged,
      {
        type: "clear"
      }
    );

    expect(started.firstTarget?.key).toBe("first");
    expect(preview).toMatchObject({
      status: "preview",
      pendingTarget: { key: "second" }
    });
    expect(completed.secondTarget?.key).toBe("second");
    expect(selectionChanged).toEqual({ firstTarget: first });
    expect(escaped).toEqual({});
  });

  it("creates supported distance and angle results with source authority", () => {
    const first = createTarget("face", {
      point: [0, 0, 0],
      pointLabel: "Face center",
      vector: [0, 0, 1],
      vectorLabel: "Face normal"
    });
    const second = createTarget("edge", {
      point: [2, 0, 0],
      pointLabel: "Edge center",
      vector: [1, 0, 0],
      vectorLabel: "Linear edge direction"
    });
    const view = createViewportTwoTargetMeasurementView({
      session: { firstTarget: first, secondTarget: second },
      units: "mm"
    });

    expect(view.status).toBe("complete");
    expect(view.results).toHaveLength(2);
    expect(view.results[0]).toMatchObject({
      kind: "distance",
      authority: "sourceAnalytic",
      value: 2,
      rows: [
        { label: "Distance", value: "2 mm" },
        { label: "Basis", value: "Face center to Edge center" }
      ]
    });
    expect(view.results[1]).toMatchObject({
      kind: "angle",
      authority: "sourceAnalytic",
      value: 90,
      rows: [
        { label: "Angle", value: "90 deg" },
        {
          label: "Basis",
          value: "Face normal to Linear edge direction"
        }
      ]
    });
  });

  it("labels source-backed point results from the measured inputs instead of unsupported target affordances", () => {
    const first = createTarget("body", {
      authority: "unsupported",
      point: [0, 0, 0],
      pointLabel: "Body centroid",
      source: "body.measurements"
    });
    const second = createTarget("edge", {
      authority: "unsupported",
      point: [1, 1, 0],
      pointLabel: "Edge center",
      source: "body.generatedReferenceMeasurements"
    });
    const view = createViewportTwoTargetMeasurementView({
      session: { firstTarget: first, secondTarget: second },
      units: "mm"
    });

    expect(view.results[0]).toMatchObject({
      kind: "distance",
      authority: "sourceAnalytic",
      authorityLabel: "Authority: source-analytic exact",
      rows: [
        { label: "Distance", value: "1.41 mm" },
        { label: "Basis", value: "Body centroid to Edge center" }
      ]
    });
  });

  it.each([
    ["stale", "VIEWPORT_TWO_TARGET_STALE_TARGET"],
    ["consumed", "VIEWPORT_TWO_TARGET_CONSUMED_TARGET"],
    ["non-commandable", "VIEWPORT_TWO_TARGET_NON_COMMANDABLE_TARGET"]
  ] as const)("returns structured %s target diagnostics", (status, code) => {
    const view = createViewportTwoTargetMeasurementView({
      session: {
        firstTarget: createTarget("first", {
          point: [0, 0, 0],
          status
        }),
        secondTarget: createTarget("second", { point: [1, 0, 0] })
      },
      units: "mm"
    });

    expect(view.status).toBe("blocked");
    expect(view.diagnostics).toContainEqual(
      expect.objectContaining({ code, status })
    );
  });

  it("returns missing, ambiguous, unsupported pair, and display-only diagnostics", () => {
    const missing = createViewportTwoTargetMeasurementView({
      session: {},
      units: "mm"
    });
    const sameTarget = createTarget("same", { point: [0, 0, 0] });
    const ambiguous = createViewportTwoTargetMeasurementView({
      session: { firstTarget: sameTarget, secondTarget: sameTarget },
      units: "mm"
    });
    const unsupported = createViewportTwoTargetMeasurementView({
      session: {
        firstTarget: createTarget("first"),
        secondTarget: createTarget("second")
      },
      units: "mm"
    });
    const displayOnly = createViewportTwoTargetMeasurementView({
      session: {
        firstTarget: createTarget("first", {
          authority: "displayApproximation",
          point: [0, 0, 0]
        }),
        secondTarget: createTarget("second", { point: [1, 0, 0] })
      },
      units: "mm"
    });

    expect(missing.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "VIEWPORT_TWO_TARGET_MISSING_FIRST_TARGET",
        status: "missing"
      })
    );
    expect(ambiguous.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "VIEWPORT_TWO_TARGET_AMBIGUOUS_PAIR",
        status: "ambiguous"
      })
    );
    expect(unsupported.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "VIEWPORT_TWO_TARGET_UNSUPPORTED_PAIR",
        status: "unsupported"
      })
    );
    expect(displayOnly.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "VIEWPORT_TWO_TARGET_DISPLAY_APPROXIMATION_ONLY",
        status: "unsupported"
      })
    );
  });

  it("keeps public output separated from renderer, mesh, file, and cache identifiers", () => {
    const first = createTarget("renderer-hit:selection-buffer:face:1", {
      point: [0, 0, 0],
      title: "First selection-buffer:face:1",
      detail: "mesh-triangle:2"
    });
    const second = createTarget("second", {
      point: [1, 0, 0],
      title: "Second occt-shape:3",
      detail: "gpu-buffer:4 file-handle:abc opfs:cache"
    });
    const view = createViewportTwoTargetMeasurementView({
      session: { firstTarget: first, secondTarget: second },
      units: "mm"
    });
    const output = JSON.stringify(view);

    expect(output).toContain("sourceAnalytic");
    expect(output).toContain("internal render target");
    expect(output).not.toContain("renderer-hit");
    expect(output).not.toContain("selection-buffer");
    expect(output).not.toContain("mesh-triangle");
    expect(output).not.toContain("occt-shape");
    expect(output).not.toContain("gpu-buffer");
    expect(output).not.toContain("file-handle");
    expect(output.toLowerCase()).not.toContain("opfs:");
  });
});

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

function createBodyOverlay(): ViewportMeasurementOverlay {
  return {
    selectionKind: "body",
    title: "Body measurement",
    detail: "Base",
    source: "body.measurements",
    authority: "sourceAnalytic",
    authorityLabel: "Authority: source-analytic exact",
    target: {
      targetKind: "body",
      title: "Base (Body)",
      detail: "Semantic body target",
      label: "Base",
      bodyId: "body_rect",
      selection: { type: "body", bodyId: "body_rect" },
      authority: "sourceAnalytic",
      authorityLabel: "Authority: source-analytic exact",
      status: "resolved",
      diagnostics: []
    },
    tone: "ready",
    rows: [],
    diagnostics: [],
    inspect: {
      title: "Inspect body",
      detail: "Ready target",
      authority: "sourceAnalytic",
      authorityLabel: "Authority: source-analytic exact",
      rows: [],
      commandOperationLabels: [],
      diagnostics: []
    }
  };
}

function createGeneratedReferenceOverlay({
  stableId,
  targetKind,
  title
}: {
  readonly stableId: string;
  readonly targetKind: "generatedPlanarFace" | "generatedEdge";
  readonly title: string;
}): ViewportMeasurementOverlay {
  const expectedKind = targetKind === "generatedPlanarFace" ? "face" : "edge";

  return {
    selectionKind: "generatedReference",
    title: `${expectedKind} measurement`,
    detail: title,
    source: "body.generatedReferenceMeasurements",
    authority: "sourceAnalytic",
    authorityLabel: "Authority: source-analytic exact",
    target: {
      targetKind,
      title,
      detail: "Generated reference target",
      label: title,
      bodyId: "body_rect",
      stableId,
      selection: {
        type: "generatedReference",
        bodyId: "body_rect",
        stableId,
        expectedKind
      },
      authority: "sourceAnalytic",
      authorityLabel: "Authority: source-analytic exact",
      status: "resolved",
      diagnostics: []
    },
    tone: "ready",
    rows: [],
    diagnostics: [],
    inspect: {
      title: "Inspect target",
      detail: "Ready target",
      authority: "sourceAnalytic",
      authorityLabel: "Authority: source-analytic exact",
      rows: [],
      commandOperationLabels: [],
      diagnostics: []
    }
  };
}

function createFaceMeasurement({
  center,
  normal
}: {
  readonly center: [number, number, number];
  readonly normal: [number, number, number];
}): GeneratedReferenceMeasurement {
  return {
    kind: "face",
    stableId: "generated:face:body_rect:endCap",
    bodyId: "body_rect",
    sourceFeatureId: "feat_rect",
    sourceSketchId: "sketch_1",
    sourceSketchEntityId: "rect_1",
    profileKind: "rectangle",
    units: "mm",
    measurementModel: "sourceAnalytic",
    role: "endCap",
    area: 8,
    bounds: {
      min: [-2, -1, 3],
      max: [2, 1, 3],
      size: [4, 2, 0],
      center
    },
    center,
    surfaceType: "plane",
    normal
  };
}

function createLineEdgeMeasurement({
  endPoint,
  startPoint
}: {
  readonly endPoint: [number, number, number];
  readonly startPoint: [number, number, number];
}): GeneratedReferenceMeasurement {
  return {
    kind: "edge",
    stableId: "generated:edge:body_rect:start:uMin",
    bodyId: "body_rect",
    sourceFeatureId: "feat_rect",
    sourceSketchId: "sketch_1",
    sourceSketchEntityId: "rect_1",
    profileKind: "rectangle",
    units: "mm",
    measurementModel: "sourceAnalytic",
    role: "start:uMin",
    length: 4,
    curveType: "line",
    startPoint,
    endPoint
  };
}

function createTarget(
  key: string,
  overrides: Partial<ViewportTwoTargetMeasurementTarget> = {}
): ViewportTwoTargetMeasurementTarget {
  return {
    key,
    targetKind: "generatedPlanarFace",
    title: "Face: Start cap",
    detail: "Generated reference target",
    label: "Start cap",
    bodyId: "body_rect",
    stableId: `generated:face:body_rect:${key}`,
    selection: {
      type: "generatedReference",
      bodyId: "body_rect",
      stableId: `generated:face:body_rect:${key}`,
      expectedKind: "face"
    },
    authority: "sourceAnalytic",
    authorityLabel: "Authority: source-analytic exact",
    status: "resolved",
    diagnostics: [],
    source: "body.generatedReferenceMeasurements",
    summaryRows: [],
    ...overrides,
    ...(overrides.authority
      ? {
          authorityLabel: formatAuthority(overrides.authority)
        }
      : {})
  };
}

function formatAuthority(authority: CadViewportMeasurementAuthority): string {
  switch (authority) {
    case "semanticDocument":
      return "Authority: semantic document";
    case "sourceAnalytic":
      return "Authority: source-analytic exact";
    case "geometryBoundaryExact":
      return "Authority: geometry-boundary exact metadata";
    case "displayApproximation":
      return "Authority: display approximation";
    case "unsupported":
      return "Authority: unsupported";
  }
}
