import type {
  BodyGeneratedReferencesQueryResponse,
  CadBodySnapshot,
  CadFeatureSummary,
  CadGeneratedEdgeReference,
  CadGeneratedFaceReference,
  CadGeneratedReference,
  CadReferenceHealthEntry,
  NamedGeneratedReferenceEntry,
  SelectionReferenceCandidatesQueryResponse
} from "@web-cad/cad-protocol";
import { describe, expect, it, vi } from "vitest";
import {
  createViewportContextualCommandSurface,
  runViewportContextualCommandAction
} from "./viewportContextualCommands";
import type {
  GeneratedReferenceSelectionState,
  SelectedGeneratedReference
} from "./generatedReferenceSelection";
import {
  deriveModelingActions,
  type ModelingActionDescriptor
} from "./modelingActions";
import type { ViewportSelectionDisplay } from "./viewportSelectionDisplay";
import { createViewportVisualStateModel } from "./viewportVisualState";

describe("viewport contextual commands", () => {
  it("derives compact body actions from modeling readiness", () => {
    const face = createFace();
    const actions = deriveModelingActions({
      context: {
        selectionKind: "body",
        body: createBody(),
        feature: createExtrudeFeature(),
        generatedReferences: createGeneratedReferences({ faces: [face] }),
        referenceCandidatesByStableId: new Map([
          [face.stableId, createSelectionReferenceCandidates(face)]
        ])
      }
    });
    const surface = createViewportContextualCommandSurface({
      modelingActions: actions,
      selectionDisplay: createSelectionDisplay({ selectionKind: "body" }),
      selectedGeneratedReferenceState: { status: "none" },
      selectionReferenceCandidates: createSelectionReferenceCandidates(
        createGeneratedReferences({ faces: [face] }).body
      )
    });

    expect(surface.actions.map((action) => action.id)).toEqual([
      "sketch.createOnFace",
      "body.measureTopology",
      "body.references.inspect"
    ]);
    expect(surface.actions[0]).toMatchObject({
      label: "Choose face",
      route: "modeling",
      disabled: false
    });
  });

  it("derives selected generated face commands from modeling and reference candidates", () => {
    const face = createFace();
    const candidates = createSelectionReferenceCandidates(face);
    const actions = createGeneratedReferenceActions(face, candidates);
    const surface = createViewportContextualCommandSurface({
      modelingActions: actions,
      selectionDisplay: createSelectionDisplay({
        selectionKind: "generatedReference",
        commandOperations: candidates.candidates[0].commandOperations
      }),
      selectedGeneratedReferenceState: createSelectedReferenceState(face),
      selectionReferenceCandidates: candidates
    });

    expect(surface.actions.map((action) => action.id)).toEqual([
      "sketch.createOnFace",
      "reference.name",
      "feature.measureReference",
      "feature.selectReference"
    ]);
    expect(surface.actions[0]).toMatchObject({
      label: "Create sketch",
      route: "command",
      disabled: false
    });
    expect(surface.actions[1].target).toEqual({
      bodyId: "body_rect",
      stableId: "generated:face:body_rect:startCap",
      kind: "face"
    });
  });

  it("hides unsupported generated-face sketch actions from viewport commands", () => {
    const face = createFace({
      stableId: "generated:face:body_add:side:circular",
      label: "Added circular wall face",
      bodyId: "body_add",
      eligibleOperations: [
        "feature.measureReference",
        "feature.selectReference"
      ],
      role: "side:circular",
      geometricSignature: {
        profileKind: "circle",
        sketchPlane: "XY",
        extrudeSide: "positive",
        depth: 1,
        surfaceType: "cylinder"
      }
    });
    const candidates = createSelectionReferenceCandidates(face, {
      commandOperations: [
        "reference.nameGenerated",
        "feature.measureReference",
        "feature.selectReference"
      ]
    });
    const actions = createGeneratedReferenceActions(face, candidates);
    const surface = createViewportContextualCommandSurface({
      modelingActions: actions,
      selectionDisplay: createSelectionDisplay({
        selectionKind: "generatedReference",
        commandOperations: candidates.candidates[0].commandOperations
      }),
      selectedGeneratedReferenceState: createSelectedReferenceState(face),
      selectionReferenceCandidates: candidates
    });

    expect(surface.actions.map((action) => action.id)).toEqual([
      "reference.name",
      "feature.measureReference",
      "feature.selectReference"
    ]);
  });

  it("derives selected generated edge commands and routes safe edge-finish defaults", () => {
    const edge = createEdge();
    const candidates = createSelectionReferenceCandidates(edge);
    const actions = createGeneratedReferenceActions(edge, candidates);
    const surface = createViewportContextualCommandSurface({
      modelingActions: actions,
      selectionDisplay: createSelectionDisplay({
        selectionKind: "generatedReference",
        commandOperations: candidates.candidates[0].commandOperations
      }),
      selectedGeneratedReferenceState: createSelectedReferenceState(edge),
      selectionReferenceCandidates: candidates
    });
    const onCreateEdgeFinish = vi.fn();

    expect(surface.actions.map((action) => action.id)).toEqual([
      "reference.name",
      "feature.chamfer",
      "feature.fillet",
      "feature.measureReference",
      "feature.selectReference"
    ]);

    const routed = runViewportContextualCommandAction({
      action: actionById(surface.actions, "feature.chamfer"),
      body: createBody(),
      selectedGeneratedReferenceState: createSelectedReferenceState(edge),
      onCreateEdgeFinish
    });

    expect(routed).toBe(true);
    expect(onCreateEdgeFinish).toHaveBeenCalledWith(
      "chamfer",
      expect.objectContaining({
        bodyId: "",
        targetBodyId: "body_rect",
        edgeStableId: "generated:edge:body_rect:start:uMin",
        distance: 0.2,
        radius: 0.2
      })
    );
  });

  it("routes selected topology-anchor edge finish through normal CADOps form", () => {
    const edge = createEdge();
    const candidates = createSelectionReferenceCandidates(edge);
    const actions = deriveModelingActions({
      context: {
        selectionKind: "generatedReference",
        reference: edge,
        topologyAnchorId: "anchor_selected_edge",
        body: createBody(),
        feature: createExtrudeFeature(),
        namedReferences: [],
        selectionReferenceCandidates: candidates
      }
    });
    const selectedState = createSelectedReferenceState(edge, {
      topologyAnchorId: "anchor_selected_edge"
    });
    const surface = createViewportContextualCommandSurface({
      modelingActions: actions,
      selectionDisplay: createSelectionDisplay({
        selectionKind: "generatedReference",
        commandOperations: candidates.candidates[0].commandOperations
      }),
      selectedGeneratedReferenceState: selectedState,
      selectionReferenceCandidates: candidates
    });
    const onCreateEdgeFinish = vi.fn();

    const routed = runViewportContextualCommandAction({
      action: actionById(surface.actions, "feature.fillet"),
      body: createBody(),
      selectedGeneratedReferenceState: selectedState,
      selectionReferenceCandidates: candidates,
      onCreateEdgeFinish
    });

    expect(routed).toBe(true);
    expect(onCreateEdgeFinish).toHaveBeenCalledWith(
      "fillet",
      expect.objectContaining({
        bodyId: "",
        targetBodyId: "body_rect",
        topologyAnchorId: "anchor_selected_edge",
        radius: 0.2
      })
    );
    expect(onCreateEdgeFinish.mock.calls[0]?.[1]).not.toHaveProperty(
      "edgeStableId"
    );
    expect(JSON.stringify(onCreateEdgeFinish.mock.calls)).not.toMatch(
      /checkpoint-local|checkpointEntityId|rendererId|meshId|occtId|gpuId|selectionBufferId|pixelId|opfsPath|fileHandle/i
    );
  });

  it("does not surface deferred V12 cut-wall edge-finish commands", () => {
    const edge = createEdge({
      stableId: "generated:edge:body_cut:longitudinal:uMin:vMin",
      label: "Cut wall profile edge uMin/vMin",
      bodyId: "body_cut",
      sourceFeatureId: "feat_cut",
      eligibleOperations: [
        "feature.measureReference",
        "feature.selectReference"
      ],
      role: "longitudinal:uMin:vMin"
    });
    const candidates = createSelectionReferenceCandidates(edge, {
      commandOperations: [
        "reference.nameGenerated",
        "feature.measureReference",
        "feature.selectReference"
      ]
    });
    const actions = createGeneratedReferenceActions(edge, candidates);
    const surface = createViewportContextualCommandSurface({
      modelingActions: actions,
      selectionDisplay: createSelectionDisplay({
        selectionKind: "generatedReference",
        title: "Edge: Cut wall profile edge uMin/vMin",
        commandOperations: candidates.candidates[0].commandOperations
      }),
      selectedGeneratedReferenceState: createSelectedReferenceState(edge),
      selectionReferenceCandidates: candidates
    });

    expect(actions.map((action) => action.id)).toEqual(["reference.name"]);
    expect(surface.actions.map((action) => action.id)).toEqual([
      "reference.name",
      "feature.measureReference",
      "feature.selectReference"
    ]);
    expect(
      surface.actions.some((action) => action.id === "feature.chamfer")
    ).toBe(false);
    expect(
      surface.actions.some((action) => action.id === "feature.fillet")
    ).toBe(false);
  });

  it("derives named-reference inspect and measure actions from reference candidates", () => {
    const face = createFace();
    const candidates = createSelectionReferenceCandidates(face, {
      selection: { type: "namedReference", name: "mounting_top" },
      source: "namedReferenceSelection"
    });
    const surface = createViewportContextualCommandSurface({
      modelingActions: [],
      selectionDisplay: createSelectionDisplay({
        selectionKind: "generatedReference"
      }),
      selectedGeneratedReferenceState: { status: "none" },
      selectionReferenceCandidates: candidates
    });

    expect(surface.actions.map((action) => action.id)).toEqual([
      "reference.name",
      "feature.measureReference",
      "feature.selectReference"
    ]);
    expect(
      actionById(surface.actions, "feature.selectReference")
    ).toMatchObject({
      route: "inspect",
      disabled: false
    });
  });

  it("keeps stale selected references as concise blocked status without inventing commands", () => {
    const surface = createViewportContextualCommandSurface({
      modelingActions: [],
      selectionDisplay: createSelectionDisplay({
        selectionKind: "generatedReference",
        title: "Selected reference stale",
        detail: "Selected face reference is no longer available.",
        tone: "blocked",
        diagnostics: [
          {
            code: "STALE_SELECTION_REFERENCE",
            status: "stale",
            message: "Selected face reference is no longer available."
          }
        ]
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

    expect(surface.visible).toBe(true);
    expect(surface.actions).toEqual([]);
    expect(surface).toMatchObject({
      tone: "blocked",
      diagnostic: "Selected face reference is no longer available."
    });
  });

  it("preserves disabled consumed actions from command readiness", () => {
    const face = createFace();
    const consumedCandidates = createSelectionReferenceCandidates(face, {
      status: "consumed",
      commandable: false,
      commandOperations: [],
      message: "Selected body body_rect is consumed by feature feat_cut."
    });
    const actions = createGeneratedReferenceActions(face, consumedCandidates);
    const surface = createViewportContextualCommandSurface({
      modelingActions: actions,
      selectionDisplay: createSelectionDisplay({
        selectionKind: "generatedReference",
        tone: "warning"
      }),
      selectedGeneratedReferenceState: createSelectedReferenceState(face),
      selectionReferenceCandidates: consumedCandidates
    });

    expect(surface.actions.map((action) => action.id)).toEqual([
      "sketch.createOnFace",
      "reference.name"
    ]);
    expect(surface.actions.every((action) => action.disabled)).toBe(true);
    expect(surface.actions.map((action) => action.reason)).toEqual([
      "Selected body body_rect is consumed by feature feat_cut.",
      "Selected body body_rect is consumed by feature feat_cut."
    ]);
  });

  it("routes create-sketch-on-face through the existing form contract", () => {
    const face = createFace();
    const onCreateSketchOnFace = vi.fn();

    const routed = runViewportContextualCommandAction({
      action: {
        id: "sketch.createOnFace",
        label: "Create sketch",
        route: "command",
        disabled: false
      },
      selectedGeneratedReferenceState: createSelectedReferenceState(face),
      onCreateSketchOnFace
    });

    expect(routed).toBe(true);
    expect(onCreateSketchOnFace).toHaveBeenCalledWith({
      id: "",
      name: "Start cap sketch",
      bodyId: "body_rect",
      faceStableId: "generated:face:body_rect:startCap"
    });
  });

  it("routes topology-anchor-backed face sketches through the shared reference contract", () => {
    const face = createFace();
    const candidates = createSelectionReferenceCandidates(face, {
      source: "topologyAnchorSelection",
      topologyAnchorId: "anchor_face_1",
      checkpointId: "checkpoint_1"
    });
    const selectedState = createSelectedReferenceState(face, {
      topologyAnchorId: "anchor_face_1"
    });
    const surface = createViewportContextualCommandSurface({
      modelingActions: createGeneratedReferenceActions(face, candidates),
      selectionDisplay: createSelectionDisplay({
        selectionKind: "generatedReference",
        commandOperations: candidates.candidates[0].commandOperations
      }),
      selectedGeneratedReferenceState: selectedState,
      selectionReferenceCandidates: candidates
    });
    const onCreateSketchOnFace = vi.fn();

    const routed = runViewportContextualCommandAction({
      action: actionById(surface.actions, "sketch.createOnFace"),
      selectedGeneratedReferenceState: selectedState,
      selectionReferenceCandidates: candidates,
      onCreateSketchOnFace
    });

    expect(routed).toBe(true);
    expect(onCreateSketchOnFace).toHaveBeenCalledWith({
      id: "",
      name: "Start cap sketch",
      bodyId: "body_rect",
      faceStableId: "generated:face:body_rect:startCap",
      topologyAnchorId: "anchor_face_1"
    });
    expect(JSON.stringify(onCreateSketchOnFace.mock.calls)).not.toMatch(
      /checkpoint-local|checkpointEntityId|rendererId|meshId|occtId|gpuId|selectionBufferId|pixelId|opfsPath|fileHandle/i
    );
  });

  it("routes selected topology-anchor face sketches after saved reference creation", () => {
    const face = createFace();
    const state = createSelectedReferenceState(face) as Extract<
      GeneratedReferenceSelectionState,
      { readonly status: "selected" }
    >;
    const onCreateSketchOnFace = vi.fn();

    const routed = runViewportContextualCommandAction({
      action: {
        id: "sketch.createOnFace",
        label: "Create sketch",
        route: "command",
        disabled: false
      },
      selectedGeneratedReferenceState: {
        ...state,
        selection: {
          ...state.selection,
          topologyAnchorId: "anchor_selected_face"
        }
      },
      onCreateSketchOnFace
    });

    expect(routed).toBe(true);
    expect(onCreateSketchOnFace).toHaveBeenCalledWith({
      id: "",
      name: "Start cap sketch",
      bodyId: "body_rect",
      faceStableId: "generated:face:body_rect:startCap",
      topologyAnchorId: "anchor_selected_face"
    });
    expect(JSON.stringify(onCreateSketchOnFace.mock.calls)).not.toMatch(
      /checkpoint-local|checkpointEntityId|rendererId|meshId|occtId|gpuId|selectionBufferId|pixelId|opfsPath|fileHandle/i
    );
  });

  it("routes query-proven topology-anchor named-reference repairs from viewport context", () => {
    const face = createFace();
    const candidates = createSelectionReferenceCandidates(face, {
      source: "topologyAnchorSelection",
      topologyAnchorId: "anchor_face_1",
      checkpointId: "checkpoint_1"
    });
    const surface = createViewportContextualCommandSurface({
      modelingActions: createGeneratedReferenceActions(face, candidates),
      namedReferences: [createNamedReference()],
      namedReferenceHealthByName: new Map([
        ["Mounting face", createReferenceHealth("repair-needed")]
      ]),
      selectedNamedReferenceName: "Mounting face",
      selectionDisplay: createSelectionDisplay({
        selectionKind: "generatedReference",
        commandOperations: candidates.candidates[0].commandOperations
      }),
      selectedGeneratedReferenceState: createSelectedReferenceState(face),
      selectionReferenceCandidates: candidates
    });
    const onRepairNamedReference = vi.fn();

    expect(surface.actions.map((action) => action.id)).toEqual([
      "sketch.createOnFace",
      "reference.name",
      "reference.repairName",
      "feature.measureReference",
      "feature.selectReference"
    ]);

    const routed = runViewportContextualCommandAction({
      action: actionById(surface.actions, "reference.repairName"),
      selectedGeneratedReferenceState: createSelectedReferenceState(face),
      onRepairNamedReference
    });

    expect(routed).toBe(true);
    expect(onRepairNamedReference).toHaveBeenCalledWith("Mounting face", {
      bodyId: "body_rect",
      stableId: "generated:face:body_rect:startCap",
      kind: "face",
      topologyAnchorId: "anchor_face_1"
    });
    expect(JSON.stringify(onRepairNamedReference.mock.calls)).not.toMatch(
      /checkpoint-local|checkpointEntityId|rendererId|meshId|occtId|gpuId|selectionBufferId|pixelId|opfsPath|fileHandle/i
    );
  });

  it("does not route disabled command actions", () => {
    const onCreateSketchOnFace = vi.fn();
    const routed = runViewportContextualCommandAction({
      action: {
        id: "sketch.createOnFace",
        label: "Create sketch",
        route: "command",
        disabled: true
      },
      selectedGeneratedReferenceState:
        createSelectedReferenceState(createFace()),
      onCreateSketchOnFace
    });

    expect(routed).toBe(false);
    expect(onCreateSketchOnFace).not.toHaveBeenCalled();
  });

  it("keeps body, face, and edge contextual readiness aligned with D1 visual status inputs", () => {
    const bodyFace = createFace();
    const cases = [
      {
        label: "body",
        display: createSelectionDisplay({
          selectionKind: "body",
          commandOperations: ["feature.selectReference"]
        }),
        modelingActions: deriveModelingActions({
          context: {
            selectionKind: "body",
            body: createBody(),
            feature: createExtrudeFeature(),
            generatedReferences: createGeneratedReferences({
              faces: [bodyFace]
            }),
            referenceCandidatesByStableId: new Map([
              [bodyFace.stableId, createSelectionReferenceCandidates(bodyFace)]
            ])
          }
        }),
        state: { status: "none" as const },
        expectedVisualKind: "body",
        expectedAction: "body.references.inspect"
      },
      {
        label: "face",
        display: createSelectionDisplay({
          selectionKind: "generatedReference",
          title: "Face: Start cap",
          commandOperations: [
            "feature.attachSketchPlane",
            "feature.selectReference"
          ]
        }),
        modelingActions: [],
        state: createSelectedReferenceState(createFace()),
        expectedVisualKind: "face",
        expectedAction: "feature.selectReference"
      },
      {
        label: "edge",
        display: createSelectionDisplay({
          selectionKind: "generatedReference",
          title: "Edge: Start uMin",
          commandOperations: ["feature.fillet", "feature.selectReference"]
        }),
        modelingActions: [],
        state: createSelectedReferenceState(createEdge()),
        expectedVisualKind: "edge",
        expectedAction: "feature.selectReference"
      }
    ] as const;

    for (const testCase of cases) {
      const visualState = createViewportVisualStateModel({
        selectionDisplay: testCase.display,
        selectedGeneratedReferenceState: testCase.state
      });
      const surface = createViewportContextualCommandSurface({
        modelingActions: testCase.modelingActions,
        selectionDisplay: testCase.display,
        selectedGeneratedReferenceState: testCase.state
      });

      expect(visualState.rendererVisualStates, testCase.label).toContainEqual({
        targetId: "body_rect",
        targetKind: testCase.expectedVisualKind,
        state: "commandTarget"
      });
      expect(
        surface.actions.map((action) => action.id),
        testCase.label
      ).toContain(testCase.expectedAction);
    }
  });
});

function createGeneratedReferenceActions(
  reference: CadGeneratedReference,
  candidates: SelectionReferenceCandidatesQueryResponse
): readonly ModelingActionDescriptor[] {
  return deriveModelingActions({
    context: {
      selectionKind: "generatedReference",
      reference,
      body: createBody(),
      feature: createExtrudeFeature(),
      namedReferences: [],
      selectionReferenceCandidates: candidates
    }
  });
}

function actionById<
  T extends { readonly id: string },
  Id extends T["id"] & string
>(actions: readonly T[], id: Id): Extract<T, { readonly id: Id }> {
  const action = actions.find((candidate) => candidate.id === id);
  expect(action).toBeDefined();
  return action as Extract<T, { readonly id: Id }>;
}

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
    referenceSummary: "Body: Rectangle extrude body",
    commandOperations: [],
    commandOperationLabels: [],
    diagnostics: [],
    ...overrides
  };
}

function createSelectedReferenceState(
  reference: CadGeneratedReference,
  overrides: Partial<SelectedGeneratedReference> = {}
): GeneratedReferenceSelectionState {
  return {
    status: "selected",
    selection: {
      bodyId: reference.bodyId,
      stableId: reference.stableId,
      kind: reference.kind,
      ...overrides
    },
    reference,
    measurementRows: []
  };
}

function createBody(overrides: Partial<CadBodySnapshot> = {}): CadBodySnapshot {
  return {
    id: "body_rect",
    kind: "solid",
    partId: "part:default",
    featureId: "feat_rect",
    source: {
      type: "sketchExtrudeFeature",
      featureId: "feat_rect",
      sketchId: "sketch_1",
      entityId: "rect_1",
      profileKind: "rectangle"
    },
    ...overrides
  };
}

function createExtrudeFeature(
  overrides: Partial<
    Extract<CadFeatureSummary, { readonly kind: "extrude" }>
  > = {}
): Extract<CadFeatureSummary, { readonly kind: "extrude" }> {
  return {
    id: "feat_rect",
    kind: "extrude",
    partId: "part:default",
    bodyId: "body_rect",
    sketchId: "sketch_1",
    entityId: "rect_1",
    profileKind: "rectangle",
    depth: 2,
    side: "positive",
    operationMode: "newBody",
    source: {
      type: "sketchEntity",
      sketchId: "sketch_1",
      entityId: "rect_1"
    },
    ...overrides
  };
}

function createGeneratedReferences({
  faces
}: {
  readonly faces: readonly CadGeneratedFaceReference[];
}): BodyGeneratedReferencesQueryResponse {
  return {
    ok: true,
    query: "body.generatedReferences",
    cadOpsVersion: "cadops.v1",
    body: {
      kind: "body",
      stableId: "generated:body:body_rect",
      label: "Rectangle extrude body",
      bodyId: "body_rect",
      ownerPartId: "part:default",
      sourceFeatureId: "feat_rect",
      sourceSketchId: "sketch_1",
      sourceSketchEntityId: "rect_1",
      eligibleOperations: [
        "feature.measureReference",
        "feature.selectReference"
      ],
      profileKind: "rectangle",
      geometricSignature: {
        profileKind: "rectangle",
        sketchPlane: "XY",
        extrudeSide: "positive",
        depth: 2
      }
    },
    faceCount: faces.length,
    faces,
    edgeCount: 0,
    edges: [],
    vertexCount: 0,
    vertices: [],
    axisCount: 0,
    axes: []
  };
}

function createFace(
  overrides: Partial<CadGeneratedFaceReference> = {}
): CadGeneratedFaceReference {
  return {
    kind: "face",
    stableId: "generated:face:body_rect:startCap",
    label: "Start cap",
    bodyId: "body_rect",
    ownerPartId: "part:default",
    sourceFeatureId: "feat_rect",
    sourceSketchId: "sketch_1",
    sourceSketchEntityId: "rect_1",
    eligibleOperations: [
      "feature.attachSketchPlane",
      "feature.measureReference",
      "feature.selectReference"
    ],
    role: "startCap",
    geometricSignature: {
      profileKind: "rectangle",
      sketchPlane: "XY",
      extrudeSide: "positive",
      depth: 2,
      surfaceType: "plane"
    },
    ...overrides
  };
}

function createEdge(
  overrides: Partial<CadGeneratedEdgeReference> = {}
): CadGeneratedEdgeReference {
  return {
    kind: "edge",
    stableId: "generated:edge:body_rect:start:uMin",
    label: "Start uMin edge",
    description: "Start cap uMin edge",
    bodyId: "body_rect",
    ownerPartId: "part:default",
    sourceFeatureId: "feat_rect",
    sourceSketchId: "sketch_1",
    sourceSketchEntityId: "rect_1",
    eligibleOperations: [
      "feature.chamfer",
      "feature.fillet",
      "feature.measureReference",
      "feature.selectReference"
    ],
    role: "start:uMin",
    adjacentFaceRoles: ["startCap", "side:uMin"],
    geometricSignature: {
      profileKind: "rectangle",
      sketchPlane: "XY",
      extrudeSide: "positive",
      depth: 2,
      curveType: "line"
    },
    ...overrides
  };
}

function createSelectionReferenceCandidates(
  reference: CadGeneratedReference,
  overrides: {
    readonly commandable?: boolean;
    readonly commandOperations?: SelectionReferenceCandidatesQueryResponse["candidates"][number]["commandOperations"];
    readonly message?: string;
    readonly selection?: SelectionReferenceCandidatesQueryResponse["selection"];
    readonly source?: SelectionReferenceCandidatesQueryResponse["candidates"][number]["source"];
    readonly status?: SelectionReferenceCandidatesQueryResponse["status"];
    readonly topologyAnchorId?: string;
    readonly checkpointId?: string;
  } = {}
): SelectionReferenceCandidatesQueryResponse {
  const status = overrides.status ?? "resolved";
  const issue =
    status === "resolved"
      ? undefined
      : {
          code: "CONSUMED_SELECTION_BODY" as const,
          status: status as Exclude<
            SelectionReferenceCandidatesQueryResponse["status"],
            "resolved"
          >,
          message:
            overrides.message ??
            "Selected body body_rect is consumed by feature feat_cut.",
          bodyId: reference.bodyId,
          featureId: "feat_cut"
        };

  return {
    ok: true,
    query: "selection.referenceCandidates",
    cadOpsVersion: "cadops.v1",
    selection:
      overrides.selection ??
      ({
        type: "generatedReference",
        bodyId: reference.bodyId,
        stableId: reference.stableId,
        expectedKind: reference.kind
      } as const),
    status,
    candidateCount: 1,
    candidates: [
      {
        source:
          overrides.source ??
          (overrides.selection?.type === "namedReference"
            ? "namedReferenceSelection"
            : "generatedReferenceSelection"),
        target: {
          type: "generatedReference",
          bodyId: reference.bodyId,
          stableId: reference.stableId,
          kind: reference.kind,
          ...(overrides.topologyAnchorId
            ? { topologyAnchorId: overrides.topologyAnchorId }
            : {}),
          ...(overrides.checkpointId
            ? { checkpointId: overrides.checkpointId }
            : {})
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

function createNamedReference(
  overrides: Partial<NamedGeneratedReferenceEntry> = {}
): NamedGeneratedReferenceEntry {
  return {
    name: "Mounting face",
    bodyId: "body_old",
    stableId: "generated:face:body_old:startCap",
    kind: "face",
    status: "stale",
    error: {
      code: "GENERATED_REFERENCE_NOT_FOUND",
      message: "Named reference Mounting face is stale."
    },
    ...overrides
  };
}

function createReferenceHealth(
  status: CadReferenceHealthEntry["status"]
): CadReferenceHealthEntry {
  return {
    source: "namedReference",
    status,
    commandable: status === "stale" || status === "repair-needed",
    commandOperations:
      status === "stale" || status === "repair-needed"
        ? ["feature.selectReference"]
        : [],
    label: "Mounting face",
    bodyId: "body_old",
    stableId: "generated:face:body_old:startCap",
    kind: "face",
    referenceName: "Mounting face",
    sourceFeatureId: "feat_rect",
    dependencies: {
      sketchIds: ["sketch_1"],
      sketchEntityIds: ["rect_1"],
      featureIds: ["feat_rect"],
      bodyIds: ["body_old"],
      generatedReferenceStableIds: ["generated:face:body_old:startCap"],
      namedReferenceNames: ["Mounting face"]
    },
    diagnosticCount: 1,
    diagnostics: [
      {
        code: "REFERENCE_REPAIR_NEEDED",
        severity: "blocker",
        message: `Named reference Mounting face is ${status}.`,
        status,
        referenceName: "Mounting face",
        stableId: "generated:face:body_old:startCap"
      }
    ]
  };
}
