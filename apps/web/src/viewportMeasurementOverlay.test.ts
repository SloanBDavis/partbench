import type {
  BodyMeasurementsSnapshot,
  CadBodySnapshot
} from "@web-cad/cad-core";
import type {
  CadGeneratedFaceReference,
  CadGeneratedEdgeReference,
  CadGeneratedReference,
  CadGeneratedBodyReference,
  CadGeneratedVertexReference,
  GeneratedReferenceMeasurement,
  NamedGeneratedReferenceEntry,
  SelectionReferenceCandidatesQueryResponse
} from "@web-cad/cad-protocol";
import { describe, expect, it } from "vitest";
import {
  createSelectedGeneratedReference,
  getGeneratedReferenceSelectionState
} from "./generatedReferenceSelection";
import { createViewportMeasurementOverlay } from "./viewportMeasurementOverlay";

describe("viewport measurement overlay", () => {
  it("formats selected generated planar-face measurements with source authority", () => {
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
      selectionReferenceCandidates: createSelectionCandidates(reference),
      units: "mm"
    });

    expect(overlay).toMatchObject({
      selectionKind: "generatedReference",
      title: "Face measurement",
      detail: "Start cap",
      source: "body.generatedReferenceMeasurements",
      authority: "sourceAnalytic",
      authorityLabel: "Authority: source-analytic exact",
      tone: "ready",
      rows: [
        { label: "Area", value: "8 mm^2" },
        { label: "Center", value: "0 mm, 0 mm, 0 mm" },
        { label: "Surface", value: "plane" },
        { label: "Normal", value: "0, 0, 1" }
      ],
      inspect: {
        title: "Inspect target",
        detail: "Command-ready target",
        commandOperationLabels: [
          "Name reference",
          "Create sketch on face",
          "Measure reference",
          "Inspect reference"
        ]
      }
    });
    expect(overlay?.inspect.rows).toContainEqual({
      label: "Target",
      value: "Face: Start cap"
    });
  });

  it("formats supported body measurements from body.measurements query output", () => {
    const overlay = createViewportMeasurementOverlay({
      body: createBody("body_rect", "Base"),
      bodyMeasurements: createBodyMeasurements(),
      selectionReferenceCandidates: createSelectionCandidates(
        createBodyReference()
      ),
      selectedGeneratedReferenceState: { status: "none" },
      units: "mm"
    });

    expect(overlay).toMatchObject({
      selectionKind: "body",
      title: "Body measurement",
      detail: "Base",
      source: "body.measurements",
      authority: "sourceAnalytic",
      authorityLabel: "Authority: source-analytic exact",
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
      ],
      inspect: {
        title: "Inspect body",
        detail: "Command-ready target",
        authorityLabel: "Authority: source-analytic exact"
      }
    });
    expect(overlay?.inspect.rows).toContainEqual({
      label: "Commands",
      value: "Name reference, Inspect reference"
    });
  });

  it("formats source-proven generated edge length and circular radius/diameter", () => {
    const reference = createCircularEdgeReference();
    const measurement: GeneratedReferenceMeasurement = {
      kind: "edge",
      stableId: reference.stableId,
      bodyId: reference.bodyId,
      sourceFeatureId: reference.sourceFeatureId,
      sourceSketchId: reference.sourceSketchId,
      sourceSketchEntityId: reference.sourceSketchEntityId,
      profileKind: "circle",
      units: "mm",
      measurementModel: "sourceAnalytic",
      role: "end:circular",
      length: 12.566370614359172,
      curveType: "circle",
      center: [0, 0, 3],
      radius: 2,
      axis: [0, 0, 1],
      axisRole: "extrude"
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
      selectionReferenceCandidates: createSelectionCandidates(reference),
      units: "mm"
    });

    expect(overlay).toMatchObject({
      selectionKind: "generatedReference",
      authority: "sourceAnalytic",
      rows: [
        { label: "Length", value: "12.57 mm" },
        { label: "Curve", value: "circle" },
        { label: "Radius", value: "2 mm" },
        { label: "Diameter", value: "4 mm" }
      ]
    });
  });

  it("identifies named references that resolve to supported generated targets", () => {
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
      surfaceType: "plane"
    };
    const state = getGeneratedReferenceSelectionState(
      createSelectedGeneratedReference(reference),
      createReferences(reference),
      new Map([[reference.stableId, { measurement }]]),
      "mm"
    );
    const candidates = createSelectionCandidates(reference, {
      selection: { type: "namedReference", name: "mounting_top" },
      source: "namedReferenceSelection"
    });
    const overlay = createViewportMeasurementOverlay({
      body: createBody(),
      namedReferences: [createNamedReference("mounting_top", reference)],
      selectedGeneratedReferenceState: state,
      selectionReferenceCandidates: candidates,
      units: "mm"
    });

    expect(overlay?.target).toMatchObject({
      targetKind: "namedReference",
      referenceName: "mounting_top",
      selection: { type: "namedReference", name: "mounting_top" }
    });
    expect(overlay?.inspect.rows).toContainEqual({
      label: "Name",
      value: "mounting_top"
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
              "Reference measurements unavailable: selection-buffer:face:17 mesh-triangle:12 occt-shape:2 gpu-buffer:4 pixel-hit:9 file-handle:abc opfs:cache is missing or stale."
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
        "Reference measurements unavailable: internal render target internal render target internal render target internal render target internal render target internal render target internal render target is missing or stale."
    });
    expect(JSON.stringify(overlay)).not.toContain("selection-buffer");
    expect(JSON.stringify(overlay)).not.toContain("mesh-triangle");
    expect(JSON.stringify(overlay)).not.toContain("occt-shape");
    expect(JSON.stringify(overlay)).not.toContain("gpu-buffer");
    expect(JSON.stringify(overlay)).not.toContain("pixel-hit");
    expect(JSON.stringify(overlay)).not.toContain("file-handle");
    expect(JSON.stringify(overlay).toLowerCase()).not.toContain("opfs:");
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

    expect(overlay).toMatchObject({
      selectionKind: "generatedReference",
      title: "Reference measurement",
      detail: "Selected reference stale",
      source: "body.generatedReferenceMeasurements",
      authority: "unsupported",
      tone: "blocked",
      rows: [],
      diagnostics: [
        {
          code: "STALE_SELECTION_REFERENCE",
          status: "stale",
          message: "Selected face reference is no longer available."
        }
      ],
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
      authority: "unsupported",
      tone: "blocked",
      rows: [],
      diagnostics: [
        {
          code: "VIEWPORT_MEASUREMENT_SOURCE_UNAVAILABLE",
          status: "unsupported"
        }
      ],
      error:
        "Body measurements unavailable for body_box. Authored rectangle and circle extrude bodies are supported."
    });
  });

  it.each([
    ["consumed", "CONSUMED_SELECTION_BODY"],
    ["ambiguous", "AMBIGUOUS_SELECTION_TOPOLOGY"],
    ["missing", "MISSING_SELECTION_TARGET"]
  ] as const)(
    "preserves structured %s diagnostics from selection.referenceCandidates",
    (status, code) => {
      const overlay = createViewportMeasurementOverlay({
        body: createBody(),
        bodyMeasurements: createBodyMeasurements(),
        selectedGeneratedReferenceState: { status: "none" },
        selectionReferenceCandidates: createSelectionCandidates(
          createBodyReference(),
          {
            status,
            commandable: false,
            commandOperations: [],
            issue: {
              code,
              status,
              message: `${status} target diagnostic`
            }
          }
        ),
        units: "mm"
      });

      expect(overlay?.diagnostics).toContainEqual({
        code,
        status,
        message: `${status} target diagnostic`
      });
      expect(overlay?.target.status).toBe(status);
    }
  );

  it("returns unsupported diagnostics for generated targets outside the F1 single-target set", () => {
    const reference = createVertexReference();
    const measurement: GeneratedReferenceMeasurement = {
      kind: "vertex",
      stableId: reference.stableId,
      bodyId: reference.bodyId,
      sourceFeatureId: reference.sourceFeatureId,
      sourceSketchId: reference.sourceSketchId,
      sourceSketchEntityId: reference.sourceSketchEntityId,
      profileKind: "rectangle",
      units: "mm",
      measurementModel: "sourceAnalytic",
      role: "start:uMin:vMin",
      point: [0, 0, 0]
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
      authority: "unsupported",
      target: {
        targetKind: "unsupportedGeneratedReference"
      },
      tone: "blocked",
      rows: [],
      diagnostics: [
        {
          code: "VIEWPORT_MEASUREMENT_TARGET_UNSUPPORTED",
          status: "unsupported"
        }
      ]
    });
  });

  it("keeps measurement output separate from derived/session authority identifiers", () => {
    const overlay = createViewportMeasurementOverlay({
      body: createBody("body_rect", "Base"),
      bodyMeasurements: createBodyMeasurements(),
      selectedGeneratedReferenceState: { status: "none" },
      units: "mm"
    });
    const output = JSON.stringify(overlay);

    expect(output).toContain("sourceAnalytic");
    expect(output).not.toContain("displayApproximation");
    expect(output).not.toContain("geometryBoundaryExact");
    expect(output).not.toContain("renderer-hit");
    expect(output).not.toContain("mesh-triangle");
    expect(output).not.toContain("occt-shape");
    expect(output).not.toContain("selection-buffer");
    expect(output).not.toContain("gpu-buffer");
    expect(output).not.toContain("pixel-hit");
    expect(output).not.toContain("file-handle");
    expect(output.toLowerCase()).not.toContain("opfs:");
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

function createReferences(reference: CadGeneratedReference) {
  return {
    ok: true,
    query: "body.generatedReferences",
    cadOpsVersion: "cadops.v1",
    body: createBodyReference(),
    faceCount: reference.kind === "face" ? 1 : 0,
    faces: reference.kind === "face" ? [reference] : [],
    edgeCount: reference.kind === "edge" ? 1 : 0,
    edges: reference.kind === "edge" ? [reference] : [],
    vertexCount: reference.kind === "vertex" ? 1 : 0,
    vertices: reference.kind === "vertex" ? [reference] : [],
    axisCount: reference.kind === "axis" ? 1 : 0,
    axes: reference.kind === "axis" ? [reference] : []
  } as const;
}

function createBodyReference(): CadGeneratedBodyReference {
  return {
    kind: "body",
    stableId: "generated:body:body_rect",
    label: "Rectangle extrude body",
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
  };
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

function createCircularEdgeReference(): CadGeneratedEdgeReference {
  return {
    kind: "edge",
    stableId: "generated:edge:body_rect:end:circular",
    label: "End circular edge",
    bodyId: "body_rect",
    ownerPartId: "part:default",
    sourceFeatureId: "feat_rect",
    sourceSketchId: "sketch_1",
    sourceSketchEntityId: "circle_1",
    role: "end:circular",
    adjacentFaceRoles: ["endCap", "side:circular"],
    eligibleOperations: ["feature.selectReference", "feature.measureReference"],
    geometricSignature: {
      profileKind: "circle",
      sketchPlane: "XY",
      extrudeSide: "positive",
      depth: 3,
      curveType: "circle",
      axis: [0, 0, 1],
      axisRole: "extrude",
      profile: {
        kind: "circle",
        center: [0, 0],
        radius: 2
      }
    }
  };
}

function createVertexReference(): CadGeneratedVertexReference {
  return {
    kind: "vertex",
    stableId: "generated:vertex:body_rect:start:uMin:vMin",
    label: "Start corner",
    bodyId: "body_rect",
    ownerPartId: "part:default",
    sourceFeatureId: "feat_rect",
    sourceSketchId: "sketch_1",
    sourceSketchEntityId: "rect_1",
    role: "start:uMin:vMin",
    adjacentFaceRoles: ["startCap", "side:uMin", "side:vMin"],
    adjacentEdgeRoles: ["start:uMin", "start:vMin", "longitudinal:uMin:vMin"],
    eligibleOperations: ["feature.selectReference"],
    geometricSignature: {
      profileKind: "rectangle",
      sketchPlane: "XY",
      extrudeSide: "positive",
      depth: 3
    }
  };
}

function createNamedReference(
  name: string,
  reference: CadGeneratedReference
): NamedGeneratedReferenceEntry {
  return {
    name,
    bodyId: reference.bodyId,
    stableId: reference.stableId,
    kind: reference.kind,
    status: "resolved",
    reference
  };
}

function createSelectionCandidates(
  reference: CadGeneratedReference,
  overrides: {
    readonly selection?: SelectionReferenceCandidatesQueryResponse["selection"];
    readonly source?: SelectionReferenceCandidatesQueryResponse["candidates"][number]["source"];
    readonly status?: SelectionReferenceCandidatesQueryResponse["status"];
    readonly commandable?: boolean;
    readonly commandOperations?: readonly SelectionReferenceCandidatesQueryResponse["candidates"][number]["commandOperations"][number][];
    readonly issue?: SelectionReferenceCandidatesQueryResponse["issues"][number];
  } = {}
): SelectionReferenceCandidatesQueryResponse {
  const issue = overrides.issue;
  const referenceName =
    overrides.selection?.type === "namedReference"
      ? overrides.selection.name
      : undefined;
  const commandOperations =
    overrides.commandOperations ??
    (reference.kind === "body"
      ? ["reference.nameGenerated", "feature.selectReference"]
      : [
          "reference.nameGenerated",
          ...reference.eligibleOperations,
          "feature.measureReference",
          "feature.selectReference"
        ]);

  return {
    ok: true,
    query: "selection.referenceCandidates",
    cadOpsVersion: "cadops.v1",
    selection:
      overrides.selection ??
      (reference.kind === "body"
        ? { type: "body", bodyId: reference.bodyId }
        : {
            type: "generatedReference",
            bodyId: reference.bodyId,
            stableId: reference.stableId,
            expectedKind: reference.kind
          }),
    status: overrides.status ?? "resolved",
    candidateCount: 1,
    candidates: [
      {
        source: overrides.source ?? "generatedReferenceSelection",
        target: {
          type: "generatedReference",
          bodyId: reference.bodyId,
          stableId: reference.stableId,
          kind: reference.kind,
          ...(referenceName ? { referenceName } : {})
        },
        reference,
        commandable: overrides.commandable ?? true,
        commandOperations,
        label: reference.label,
        issues: issue ? [issue] : []
      }
    ],
    issueCount: issue ? 1 : 0,
    issues: issue ? [issue] : []
  };
}
