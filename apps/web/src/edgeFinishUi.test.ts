import type {
  CadBodySnapshot,
  CadFeatureSummary,
  CadGeneratedEdgeReference,
  CadGeneratedFaceReference,
  CadTopologyAnchorCommandProof,
  NamedGeneratedReferenceEntry,
  SelectionReferenceCandidatesQueryResponse
} from "@web-cad/cad-protocol";
import { describe, expect, it } from "vitest";
import { buildFeatureChamferOp, buildFeatureFilletOp } from "./cadCommands";
import {
  SELECTED_EDGE_FINISH_REFERENCE_VALUE,
  buildEdgeFinishForm,
  createEdgeFinishReferenceOptions,
  createNamedEdgeFinishReferenceValue,
  getEdgeFinishOperationStatus,
  isSupportedRectangleEdgeFinishReference,
  parseGeneratedRectangleEdgeStableId,
  selectEdgeFinishReferenceOption
} from "./edgeFinishUi";
import type { GeneratedReferenceSelectionState } from "./generatedReferenceSelection";

describe("edge finish UI helpers", () => {
  it("filters selected and named generated rectangle edge references", () => {
    const edge = createEdge();
    const named = createNamedReference("Top edge", edge);
    const staleNamed = createNamedReference("Old edge", edge, "stale");
    const options = createEdgeFinishReferenceOptions(selected(edge), [
      named,
      staleNamed
    ]);

    expect(options.map((option) => option.value)).toEqual([
      SELECTED_EDGE_FINISH_REFERENCE_VALUE,
      createNamedEdgeFinishReferenceValue("Old edge"),
      createNamedEdgeFinishReferenceValue("Top edge")
    ]);
    expect(
      isSupportedRectangleEdgeFinishReference(edge, "body_rect", "chamfer")
    ).toBe(true);
    expect(parseGeneratedRectangleEdgeStableId(edge.stableId)).toEqual({
      bodyId: "body_rect"
    });
    expect(
      getEdgeFinishOperationStatus({
        body: createBody(),
        feature: createExtrudeFeature(),
        operation: "chamfer",
        referenceOption: options[0],
        scalar: 0.2,
        selectionState: selected(edge)
      })
    ).toEqual({
      available: true,
      message:
        "Chamfer will consume body_rect and create a derived result body."
    });
  });

  it("builds selected generated-edge chamfer commands", () => {
    const edge = createEdge();
    const option = selectEdgeFinishReferenceOption(
      createEdgeFinishReferenceOptions(selected(edge), []),
      SELECTED_EDGE_FINISH_REFERENCE_VALUE
    );
    const form = buildEdgeFinishForm({
      draft: {
        id: "",
        bodyId: "",
        name: " Edge break ",
        distance: 0.25,
        radius: 0.1
      },
      operation: "chamfer",
      referenceOption: option,
      targetBodyId: "body_rect"
    });

    expect(form).toEqual({
      id: "",
      bodyId: "",
      targetBodyId: "body_rect",
      name: " Edge break ",
      edgeStableId: edge.stableId,
      distance: 0.25,
      radius: 0.1
    });
    expect(buildFeatureChamferOp(form!)).toEqual({
      op: "feature.chamfer",
      id: undefined,
      bodyId: undefined,
      targetBodyId: "body_rect",
      edgeStableId: edge.stableId,
      distance: 0.25,
      name: "Edge break"
    });
  });

  it("builds topology-anchor-backed edge finish commands from selection candidates", () => {
    const edge = createEdge();
    const option = selectEdgeFinishReferenceOption(
      createEdgeFinishReferenceOptions(
        selected(edge),
        [],
        createTopologyAnchorSelectionCandidates(edge)
      ),
      SELECTED_EDGE_FINISH_REFERENCE_VALUE
    );
    const form = buildEdgeFinishForm({
      draft: {
        id: "feat_anchor_chamfer",
        bodyId: "body_anchor_chamfer",
        name: "Anchor break",
        distance: 0.25,
        radius: 0.1
      },
      operation: "chamfer",
      referenceOption: option,
      targetBodyId: "body_rect"
    });

    expect(option).toMatchObject({
      topologyAnchorId: "anchor_edge_1",
      edgeStableId: edge.stableId
    });
    expect(form).toEqual({
      id: "feat_anchor_chamfer",
      bodyId: "body_anchor_chamfer",
      targetBodyId: "body_rect",
      name: "Anchor break",
      topologyAnchorId: "anchor_edge_1",
      distance: 0.25,
      radius: 0.1
    });
    expect(buildFeatureChamferOp(form!)).toEqual({
      op: "feature.chamfer",
      id: "feat_anchor_chamfer",
      bodyId: "body_anchor_chamfer",
      targetBodyId: "body_rect",
      topologyAnchorId: "anchor_edge_1",
      distance: 0.25,
      name: "Anchor break"
    });
  });

  it("builds selected topology-anchor edge finish commands with public proof", () => {
    const edge = createEdge();
    const proof = createEdgeProof();
    const option = selectEdgeFinishReferenceOption(
      createEdgeFinishReferenceOptions(
        selected(edge, { topologyAnchorId: "anchor_selected_edge" }),
        [],
        undefined,
        proof
      ),
      SELECTED_EDGE_FINISH_REFERENCE_VALUE
    );
    const form = buildEdgeFinishForm({
      draft: {
        id: "feat_selected_anchor_chamfer",
        bodyId: "body_selected_anchor_chamfer",
        name: "Selected anchor break",
        distance: 0.25,
        radius: 0.1
      },
      operation: "chamfer",
      referenceOption: option,
      targetBodyId: "body_rect"
    });

    expect(option).toMatchObject({
      topologyAnchorId: "anchor_selected_edge",
      topologyAnchorProof: proof
    });
    expect(form).toEqual({
      id: "feat_selected_anchor_chamfer",
      bodyId: "body_selected_anchor_chamfer",
      targetBodyId: "body_rect",
      name: "Selected anchor break",
      topologyAnchorId: "anchor_selected_edge",
      topologyAnchorProof: proof,
      distance: 0.25,
      radius: 0.1
    });
    expect(buildFeatureChamferOp(form!)).toEqual({
      op: "feature.chamfer",
      id: "feat_selected_anchor_chamfer",
      bodyId: "body_selected_anchor_chamfer",
      targetBodyId: "body_rect",
      topologyAnchorId: "anchor_selected_edge",
      topologyAnchorProof: proof,
      distance: 0.25,
      name: "Selected anchor break"
    });
    expect(JSON.stringify(form)).not.toMatch(
      /checkpoint-local|checkpointEntityId|rendererId|meshId|occtId|gpuId|selectionBufferId|pixelId|opfsPath|fileHandle/i
    );
  });

  it("builds named-edge fillet commands", () => {
    const edge = createEdge();
    const option = selectEdgeFinishReferenceOption(
      createEdgeFinishReferenceOptions(selected(edge), [
        createNamedReference("Top edge", edge)
      ]),
      createNamedEdgeFinishReferenceValue("Top edge")
    );
    const form = buildEdgeFinishForm({
      draft: {
        id: "feat_fillet_1",
        bodyId: "body_fillet_1",
        name: "Round",
        distance: 0.2,
        radius: 0.125
      },
      operation: "fillet",
      referenceOption: option,
      targetBodyId: "body_rect"
    });

    expect(buildFeatureFilletOp(form!)).toEqual({
      op: "feature.fillet",
      id: "feat_fillet_1",
      bodyId: "body_fillet_1",
      targetBodyId: "body_rect",
      namedReference: "Top edge",
      radius: 0.125,
      name: "Round"
    });
  });

  it("formats invalid chamfer distance and fillet radius status", () => {
    const edge = createEdge();
    const referenceOption = selectEdgeFinishReferenceOption(
      createEdgeFinishReferenceOptions(selected(edge), []),
      SELECTED_EDGE_FINISH_REFERENCE_VALUE
    );

    expect(
      getEdgeFinishOperationStatus({
        body: createBody(),
        feature: createExtrudeFeature(),
        operation: "chamfer",
        referenceOption,
        scalar: 0,
        selectionState: selected(edge)
      })
    ).toEqual({
      available: false,
      message: "Chamfer distance must be a positive finite value."
    });
    expect(
      getEdgeFinishOperationStatus({
        body: createBody(),
        feature: createExtrudeFeature(),
        operation: "fillet",
        referenceOption,
        scalar: Number.NaN,
        selectionState: selected(edge)
      })
    ).toEqual({
      available: false,
      message: "Fillet radius must be a positive finite value."
    });
  });

  it("formats unsupported, consumed, stale, and missing edge statuses", () => {
    const edge = createEdge();
    const referenceOption = selectEdgeFinishReferenceOption(
      createEdgeFinishReferenceOptions(selected(edge), []),
      SELECTED_EDGE_FINISH_REFERENCE_VALUE
    );

    expect(
      getEdgeFinishOperationStatus({
        body: createBody(),
        feature: createExtrudeFeature("circle"),
        operation: "chamfer",
        referenceOption,
        scalar: 0.2,
        selectionState: selected(edge)
      }).message
    ).toBe("Chamfer will consume body_rect and create a derived result body.");
    expect(
      getEdgeFinishOperationStatus({
        body: createBody({ consumedByFeatureId: "feat_cut" }),
        feature: createExtrudeFeature(),
        operation: "chamfer",
        referenceOption,
        scalar: 0.2,
        selectionState: selected(edge)
      }).message
    ).toBe("Target body is consumed by feature feat_cut.");
    expect(
      getEdgeFinishOperationStatus({
        body: createBody(),
        feature: createExtrudeFeature(),
        operation: "fillet",
        referenceOption: undefined,
        scalar: 0.2,
        selectionState: { status: "none" }
      }).message
    ).toBe("Select an eligible generated edge to create a fillet.");
    expect(
      getEdgeFinishOperationStatus({
        body: createBody(),
        feature: createExtrudeFeature(),
        operation: "fillet",
        referenceOption: undefined,
        scalar: 0.2,
        selectionState: {
          status: "stale",
          selection: {
            bodyId: "body_rect",
            stableId: edge.stableId,
            kind: "edge"
          },
          message: "Selected edge reference is no longer available."
        }
      }).message
    ).toBe(
      "Selected generated reference is stale. Selected edge reference is no longer available."
    );
    expect(
      getEdgeFinishOperationStatus({
        body: createBody(),
        feature: createExtrudeFeature(),
        operation: "chamfer",
        referenceOption: selectEdgeFinishReferenceOption(
          createEdgeFinishReferenceOptions(selected(edge), [
            createNamedReference("Old edge", edge, "stale")
          ]),
          createNamedEdgeFinishReferenceValue("Old edge")
        ),
        scalar: 0.2,
        selectionState: selected(edge)
      }).message
    ).toBe("Named reference Old edge is stale or missing.");
  });

  it("rejects non-edge and unsupported edge roles", () => {
    const face = createFace();
    const unsupportedEdge = createEdge({
      stableId: "generated:edge:body_rect:unsupported",
      role: "start:circular"
    });
    const circleEdge = createEdge({
      stableId: "generated:edge:body_rect:start:circular",
      role: "start:circular",
      geometricSignature: {
        profileKind: "circle",
        sketchPlane: "XY",
        extrudeSide: "positive",
        depth: 2,
        curveType: "circle"
      }
    });

    expect(
      getEdgeFinishOperationStatus({
        body: createBody(),
        feature: createExtrudeFeature(),
        operation: "chamfer",
        referenceOption: undefined,
        scalar: 0.2,
        selectionState: selected(face)
      }).message
    ).toBe("Select a generated edge reference.");
    expect(
      getEdgeFinishOperationStatus({
        body: createBody(),
        feature: createExtrudeFeature(),
        operation: "chamfer",
        referenceOption: selectEdgeFinishReferenceOption(
          createEdgeFinishReferenceOptions(selected(circleEdge), []),
          SELECTED_EDGE_FINISH_REFERENCE_VALUE
        ),
        scalar: 0.2,
        selectionState: selected(circleEdge)
      }).message
    ).toBe("Chamfer will consume body_rect and create a derived result body.");
    expect(
      getEdgeFinishOperationStatus({
        body: createBody(),
        feature: createExtrudeFeature(),
        operation: "chamfer",
        referenceOption: selectEdgeFinishReferenceOption(
          createEdgeFinishReferenceOptions(selected(unsupportedEdge), []),
          SELECTED_EDGE_FINISH_REFERENCE_VALUE
        ),
        scalar: 0.2,
        selectionState: selected(unsupportedEdge)
      }).message
    ).toBe("Selected edge is not a supported generated edge.");
  });
});

function selected(
  reference: CadGeneratedEdgeReference | CadGeneratedFaceReference,
  selectionOverrides: Partial<
    Extract<
      GeneratedReferenceSelectionState,
      { status: "selected" }
    >["selection"]
  > = {}
): GeneratedReferenceSelectionState {
  return {
    status: "selected",
    selection: {
      bodyId: reference.bodyId,
      stableId: reference.stableId,
      kind: reference.kind,
      ...selectionOverrides
    },
    reference,
    measurementRows: []
  };
}

function createEdgeProof(): CadTopologyAnchorCommandProof {
  return {
    kind: "axisAlignedLinearEdge" as const,
    entityKind: "edge" as const,
    evidenceSource: "checkpointSnapshot" as const,
    exposesCheckpointLocalIds: false as const,
    bounds: { min: [0, 0, 0], max: [0, 1, 0] },
    linearAxis: "y" as const,
    length: 1
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
  profileKind: "rectangle" | "circle" = "rectangle"
): Extract<CadFeatureSummary, { readonly kind: "extrude" }> {
  return {
    id: "feat_rect",
    kind: "extrude",
    partId: "part:default",
    bodyId: "body_rect",
    sketchId: "sketch_1",
    entityId: profileKind === "rectangle" ? "rect_1" : "circle_1",
    profileKind,
    depth: 2,
    side: "positive",
    operationMode: "newBody",
    source: {
      type: "sketchEntity",
      sketchId: "sketch_1",
      entityId: profileKind === "rectangle" ? "rect_1" : "circle_1"
    }
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
    eligibleOperations: [
      "feature.chamfer",
      "feature.fillet",
      "feature.measureReference",
      "feature.selectReference"
    ],
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
      depth: 2,
      curveType: "line"
    },
    ...overrides
  };
}

function createFace(): CadGeneratedFaceReference {
  return {
    kind: "face",
    stableId: "generated:face:body_rect:startCap",
    label: "Start cap",
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
      depth: 2
    }
  };
}

function createNamedReference(
  name: string,
  reference: CadGeneratedEdgeReference,
  status: "resolved" | "stale" = "resolved"
): NamedGeneratedReferenceEntry {
  return {
    name,
    bodyId: reference.bodyId,
    stableId: reference.stableId,
    kind: "edge",
    status,
    ...(status === "resolved" ? { reference } : {})
  };
}

function createTopologyAnchorSelectionCandidates(
  edge: CadGeneratedEdgeReference
): SelectionReferenceCandidatesQueryResponse {
  return {
    ok: true,
    query: "selection.referenceCandidates",
    cadOpsVersion: "cadops.v1",
    selection: { type: "topologyAnchor", anchorId: "anchor_edge_1" },
    requiredOperation: "feature.chamfer",
    status: "resolved",
    candidateCount: 1,
    candidates: [
      {
        source: "topologyAnchorSelection",
        target: {
          type: "generatedReference",
          bodyId: edge.bodyId,
          stableId: edge.stableId,
          kind: "edge",
          topologyAnchorId: "anchor_edge_1",
          checkpointId: "checkpoint_1"
        },
        reference: edge,
        commandable: true,
        commandOperations: [
          "feature.chamfer",
          "feature.fillet",
          "feature.measureReference",
          "feature.selectReference"
        ],
        label: edge.label,
        issues: []
      }
    ],
    issueCount: 0,
    issues: []
  };
}
