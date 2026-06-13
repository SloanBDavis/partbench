import type {
  CadBodySnapshot,
  CadGeneratedFaceReference,
  CadGeneratedReference,
  SelectionReferenceCandidatesQueryResponse
} from "@web-cad/cad-protocol";
import { describe, expect, it } from "vitest";
import type { DerivedGeometryEntry } from "./derivedGeometry";
import { createViewportSelectionDisplay } from "./viewportSelectionDisplay";

describe("viewportSelectionDisplay", () => {
  it("derives selected body viewport status from reference candidates", () => {
    const face = createFaceReference();
    const display = createViewportSelectionDisplay({
      derivedGeometryEnabled: true,
      selectedBody: createBody({ name: "Base" }),
      selectedGeneratedReferenceState: { status: "none" },
      selectedGeometryEntry: createGeometryEntry("ready"),
      selectionReferenceCandidates: createSelectionReferenceCandidates(face)
    });

    expect(display).toMatchObject({
      selectionKind: "body",
      title: "Base (Body)",
      detail: "Command-ready reference",
      tone: "ready",
      renderTargetId: "body_rect",
      geometryStatus: "ready",
      geometryDetail: "OCCT mesh ready",
      referenceStatus: "resolved",
      referenceSummary: "Face: Start cap",
      commandOperationLabels: [
        "Name reference",
        "Create sketch on face",
        "Measure reference",
        "Inspect reference"
      ],
      diagnostics: []
    });
  });

  it("uses selected generated references as viewport semantic selections", () => {
    const face = createFaceReference();
    const display = createViewportSelectionDisplay({
      derivedGeometryEnabled: true,
      selectedBody: createBody(),
      selectedGeneratedReferenceState: {
        status: "selected",
        selection: {
          bodyId: face.bodyId,
          stableId: face.stableId,
          kind: face.kind
        },
        reference: face,
        measurementRows: []
      },
      selectedGeometryEntry: createGeometryEntry("pending"),
      selectionReferenceCandidates: createSelectionReferenceCandidates(face)
    });

    expect(display.selectionKind).toBe("generatedReference");
    expect(display.title).toBe("Face: Start cap");
    expect(display.detail).toBe("Command-ready reference");
    expect(display.renderTargetId).toBe("body_rect");
    expect(display.geometryStatus).toBe("pending");
    expect(display.geometryDetail).toBe("Building OCCT mesh");
    expect(display.commandOperations).toContain("feature.attachSketchPlane");
  });

  it("preserves structured consumed diagnostics for selected bodies", () => {
    const face = createFaceReference();
    const display = createViewportSelectionDisplay({
      derivedGeometryEnabled: true,
      selectedBody: createBody({
        consumedByFeatureId: "feat_cut"
      }),
      selectedGeneratedReferenceState: { status: "none" },
      selectedGeometryEntry: createGeometryEntry("ready"),
      selectionReferenceCandidates: createSelectionReferenceCandidates(face, {
        status: "consumed",
        commandable: false,
        commandOperations: [],
        code: "CONSUMED_SELECTION_BODY",
        message: "Selected body body_rect is consumed by feature feat_cut."
      })
    });

    expect(display.detail).toBe("Selection body consumed");
    expect(display.tone).toBe("warning");
    expect(display.commandOperations).toEqual([]);
    expect(display.diagnostics).toEqual([
      {
        code: "CONSUMED_SELECTION_BODY",
        status: "consumed",
        message: "Selected body body_rect is consumed by feature feat_cut."
      }
    ]);
  });

  it("creates structured stale diagnostics for stale selected generated references", () => {
    const display = createViewportSelectionDisplay({
      derivedGeometryEnabled: true,
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

    expect(display).toMatchObject({
      selectionKind: "generatedReference",
      title: "Selected reference stale",
      detail: "Selected face reference is no longer available.",
      tone: "blocked",
      renderTargetId: "body_rect",
      referenceStatus: undefined,
      diagnostics: [
        {
          code: "STALE_SELECTION_REFERENCE",
          status: "stale",
          message: "Selected face reference is no longer available."
        }
      ]
    });
  });

  it("surfaces unsupported candidate diagnostics without inventing commandability", () => {
    const display = createViewportSelectionDisplay({
      derivedGeometryEnabled: false,
      selectedBody: createBody(),
      selectedGeneratedReferenceState: { status: "none" },
      selectionReferenceCandidates: {
        ok: true,
        query: "selection.referenceCandidates",
        cadOpsVersion: "cadops.v1",
        selection: { type: "body", bodyId: "body_rect" },
        status: "unsupported",
        candidateCount: 0,
        candidates: [],
        issueCount: 1,
        issues: [
          {
            code: "UNSUPPORTED_SELECTION_TARGET",
            status: "unsupported",
            message: "Primitive body references are not command-ready.",
            bodyId: "body_rect"
          }
        ]
      }
    });

    expect(display.detail).toBe("Selection target unsupported");
    expect(display.tone).toBe("blocked");
    expect(display.geometryStatus).toBe("fallback");
    expect(display.diagnostics).toEqual([
      {
        code: "UNSUPPORTED_SELECTION_TARGET",
        status: "unsupported",
        message: "Primitive body references are not command-ready."
      }
    ]);
  });

  it("surfaces unresolved viewport pick diagnostics as structured status", () => {
    const display = createViewportSelectionDisplay({
      derivedGeometryEnabled: true,
      selectedGeneratedReferenceState: { status: "none" },
      viewportPickIntent: {
        kind: "unsupported",
        issues: [
          {
            code: "UNSUPPORTED_SELECTION_TARGET",
            status: "unsupported",
            message:
              "Sketch display geometry is not selectable as a command-ready CAD body from the viewport."
          }
        ],
        interactionDiagnostics: [
          {
            code: "VIEWPORT_UNSUPPORTED_DISPLAY_ENTITY",
            status: "unsupported",
            message:
              "Sketch display geometry is not selectable as a command-ready CAD body from the viewport."
          }
        ]
      }
    });

    expect(display).toMatchObject({
      selectionKind: "none",
      title: "Viewport pick unsupported",
      detail: "Selection target unsupported",
      tone: "blocked",
      diagnostics: [
        {
          code: "UNSUPPORTED_SELECTION_TARGET",
          status: "unsupported",
          message:
            "Sketch display geometry is not selectable as a command-ready CAD body from the viewport."
        }
      ]
    });
  });

  it("surfaces renderer-only and ambiguous viewport pick diagnostics", () => {
    const rendererOnlyDisplay = createViewportSelectionDisplay({
      derivedGeometryEnabled: true,
      selectedGeneratedReferenceState: { status: "none" },
      viewportPickIntent: {
        kind: "renderer-only",
        issues: [
          {
            code: "UNSUPPORTED_SELECTION_TARGET",
            status: "unsupported",
            message: "Viewport hit target is renderer-private."
          }
        ],
        interactionDiagnostics: [
          {
            code: "VIEWPORT_RENDERER_ONLY_TARGET",
            status: "renderer-only",
            message: "Viewport hit target is renderer-private."
          }
        ]
      }
    });
    const ambiguousDisplay = createViewportSelectionDisplay({
      derivedGeometryEnabled: true,
      selectedGeneratedReferenceState: { status: "none" },
      viewportPickIntent: {
        kind: "ambiguous",
        issues: [
          {
            code: "AMBIGUOUS_SELECTION_TOPOLOGY",
            status: "ambiguous",
            message: "Viewport object hit maps to multiple CAD bodies."
          }
        ],
        interactionDiagnostics: [
          {
            code: "VIEWPORT_AMBIGUOUS_HIT_CANDIDATE",
            status: "ambiguous",
            message: "Viewport object hit maps to multiple CAD bodies."
          }
        ]
      }
    });

    expect(rendererOnlyDisplay).toMatchObject({
      selectionKind: "none",
      title: "Viewport pick unsupported",
      detail: "Selection target unsupported",
      tone: "blocked",
      diagnostics: [
        {
          code: "UNSUPPORTED_SELECTION_TARGET",
          status: "unsupported"
        }
      ]
    });
    expect(ambiguousDisplay).toMatchObject({
      selectionKind: "none",
      title: "Viewport pick unsupported",
      detail: "Selection target ambiguous",
      tone: "blocked",
      diagnostics: [
        {
          code: "AMBIGUOUS_SELECTION_TOPOLOGY",
          status: "ambiguous"
        }
      ]
    });
  });

  it("keeps object render IDs separate from object-backed body candidate status", () => {
    const display = createViewportSelectionDisplay({
      derivedGeometryEnabled: true,
      selectedBody: createBody({
        id: "body:box_1",
        objectId: "box_1",
        primitive: "box",
        source: {
          type: "primitiveFeature",
          featureId: "feature:box_1",
          objectId: "box_1"
        }
      }),
      selectedGeneratedReferenceState: { status: "none" },
      selectedObject: {
        id: "box_1",
        kind: "box",
        dimensions: { width: 2, height: 2, depth: 2 },
        transform: {
          translation: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1]
        }
      },
      selectionReferenceCandidates: {
        ok: true,
        query: "selection.referenceCandidates",
        cadOpsVersion: "cadops.v1",
        selection: { type: "body", bodyId: "body:box_1" },
        status: "unsupported",
        candidateCount: 0,
        candidates: [],
        issueCount: 1,
        issues: [
          {
            code: "UNSUPPORTED_SELECTION_TARGET",
            status: "unsupported",
            message:
              "Primitive body body:box_1 does not expose command-ready semantic generated references.",
            bodyId: "body:box_1"
          }
        ]
      }
    });

    expect(display.selectionKind).toBe("body");
    expect(display.renderTargetId).toBe("box_1");
    expect(display.referenceStatus).toBe("unsupported");
    expect(display.diagnostics[0]).toMatchObject({
      code: "UNSUPPORTED_SELECTION_TARGET",
      status: "unsupported"
    });
  });

  it("keeps raw mesh OCCT and selection-buffer identifiers out of viewport display state", () => {
    const face = createFaceReference({
      stableId: "selection-buffer:face:17"
    });
    const display = createViewportSelectionDisplay({
      derivedGeometryEnabled: true,
      selectedBody: createBody(),
      selectedGeneratedReferenceState: {
        status: "selected",
        selection: {
          bodyId: face.bodyId,
          stableId: face.stableId,
          kind: face.kind
        },
        reference: face,
        measurementRows: []
      },
      selectedGeometryEntry: {
        ...createGeometryEntry("pending"),
        cacheKey: "occt-shape:wire:12"
      },
      selectionReferenceCandidates: createSelectionReferenceCandidates(face)
    });
    const visibleDisplayText = [
      display.title,
      display.detail,
      display.referenceSummary,
      ...display.commandOperationLabels,
      ...display.diagnostics.map((diagnostic) => diagnostic.message),
      display.geometryDetail
    ].join(" ");

    expect(display.renderTargetId).toBe("body_rect");
    expect(visibleDisplayText).not.toContain("selection-buffer");
    expect(visibleDisplayText).not.toContain("occt-shape");
    expect(visibleDisplayText).not.toContain("mesh-triangle");
  });
});

function createBody(
  overrides: {
    readonly consumedByFeatureId?: string;
    readonly name?: string;
    readonly id?: string;
    readonly objectId?: string;
    readonly primitive?: CadBodySnapshot["primitive"];
    readonly source?: CadBodySnapshot["source"];
  } = {}
): CadBodySnapshot {
  return {
    id: overrides.id ?? "body_rect",
    kind: "solid",
    partId: "part:default",
    featureId:
      overrides.source?.type === "primitiveFeature"
        ? overrides.source.featureId
        : "feat_rect",
    ...(overrides.consumedByFeatureId
      ? { consumedByFeatureId: overrides.consumedByFeatureId }
      : {}),
    ...(overrides.objectId ? { objectId: overrides.objectId } : {}),
    ...(overrides.primitive ? { primitive: overrides.primitive } : {}),
    ...(overrides.name ? { name: overrides.name } : {}),
    source:
      overrides.source ??
      ({
        type: "sketchExtrudeFeature",
        featureId: "feat_rect",
        sketchId: "sketch_1",
        entityId: "rect_1",
        profileKind: "rectangle"
      } satisfies CadBodySnapshot["source"])
  };
}

function createFaceReference(
  overrides: { readonly stableId?: string } = {}
): CadGeneratedFaceReference {
  return {
    kind: "face",
    stableId: overrides.stableId ?? "generated:face:body_rect:startCap",
    label: "Start cap",
    description: "Start cap face",
    eligibleOperations: [
      "feature.attachSketchPlane",
      "feature.measureReference",
      "feature.selectReference"
    ],
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
      depth: 2,
      surfaceType: "plane"
    }
  };
}

function createSelectionReferenceCandidates(
  reference: CadGeneratedReference,
  overrides: {
    readonly status?: SelectionReferenceCandidatesQueryResponse["status"];
    readonly commandable?: boolean;
    readonly commandOperations?: SelectionReferenceCandidatesQueryResponse["candidates"][number]["commandOperations"];
    readonly code?: SelectionReferenceCandidatesQueryResponse["issues"][number]["code"];
    readonly message?: string;
  } = {}
): SelectionReferenceCandidatesQueryResponse {
  const status = overrides.status ?? "resolved";
  const issue =
    status === "resolved"
      ? undefined
      : {
          code: overrides.code ?? "UNSUPPORTED_SELECTION_TARGET",
          status: status as Exclude<
            SelectionReferenceCandidatesQueryResponse["status"],
            "resolved"
          >,
          message: overrides.message ?? "Selection is not command-ready.",
          bodyId: reference.bodyId
        };

  return {
    ok: true,
    query: "selection.referenceCandidates",
    cadOpsVersion: "cadops.v1",
    selection: {
      type: "generatedReference",
      bodyId: reference.bodyId,
      stableId: reference.stableId,
      expectedKind: reference.kind
    },
    status,
    candidateCount: 1,
    candidates: [
      {
        source: "generatedReferenceSelection",
        target: {
          type: "generatedReference",
          bodyId: reference.bodyId,
          stableId: reference.stableId,
          kind: reference.kind
        },
        reference,
        commandable: overrides.commandable ?? true,
        commandOperations:
          overrides.commandOperations ??
          ([
            "reference.nameGenerated",
            ...reference.eligibleOperations
          ] as const),
        label: reference.label,
        issues: issue ? [issue] : []
      }
    ],
    issueCount: issue ? 1 : 0,
    issues: issue ? [issue] : []
  };
}

function createGeometryEntry(
  status: "pending" | "ready"
): DerivedGeometryEntry {
  if (status === "pending") {
    return {
      objectId: "body_rect",
      objectKind: "extrude",
      sourceId: "body_rect",
      sourceKind: "extrude",
      cacheKey: "extrude-pending",
      status
    };
  }

  return {
    objectId: "body_rect",
    objectKind: "extrude",
    sourceId: "body_rect",
    sourceKind: "extrude",
    cacheKey: "extrude-ready",
    status,
    mesh: {
      id: "body_rect",
      kind: "mesh",
      vertices: [],
      indices: [],
      transform: {
        translation: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1]
      }
    },
    metrics: {
      objectId: "body_rect",
      roundTripMs: 1,
      vertexCount: 0,
      triangleCount: 0
    }
  };
}
