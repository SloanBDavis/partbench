import type {
  BodyGeneratedReferencesQueryResponse,
  CadBodySnapshot,
  CadFeatureSummary,
  CadGeneratedEdgeReference,
  CadGeneratedFaceReference,
  CadGeneratedReference,
  SelectionReferenceCandidatesQueryResponse,
  SketchSnapshot
} from "@web-cad/cad-protocol";
import { describe, expect, it } from "vitest";
import {
  deriveModelingActions,
  type ModelingActionDescriptor,
  type ModelingActionId
} from "./modelingActions";

describe("modeling action helpers", () => {
  it("offers sketch creation when there is no selection and no sketch context", () => {
    const actions = deriveModelingActions({
      context: { selectionKind: "none" }
    });

    expect(actions).toEqual([
      {
        id: "sketch.create",
        label: "Create sketch",
        kind: "command",
        category: "sketch",
        available: true,
        selection: { context: "none" }
      }
    ]);
  });

  it("offers sketch entity creation actions for a selected sketch", () => {
    const sketch = createSketch("sketch_1");
    const actions = deriveModelingActions({
      context: { selectionKind: "sketch", sketch }
    });

    expect(actions.map((action) => action.id)).toEqual([
      "sketch.entity.add.point",
      "sketch.entity.add.line",
      "sketch.entity.add.rectangle",
      "sketch.entity.add.circle"
    ]);
    expect(actions.every((action) => action.available)).toBe(true);
    expect(actions[2]).toMatchObject({
      label: "Add rectangle",
      kind: "command",
      category: "sketch",
      target: { sketchId: "sketch_1", addEntityKind: "rectangle" },
      selection: { context: "sketch", sketchId: "sketch_1" }
    });
  });

  it("derives rectangle entity actions and explains missing revolve axes", () => {
    const rectangle: SketchSnapshot["entities"][number] = {
      id: "rect_1",
      kind: "rectangle",
      center: [0, 0],
      width: 4,
      height: 2
    };
    const sketch = createSketch("sketch_1", { entities: [rectangle] });
    const actions = deriveModelingActions({
      context: { selectionKind: "sketchEntity", sketch, entity: rectangle }
    });

    expect(actions.map((action) => action.id)).toEqual([
      "sketch.entity.edit",
      "sketch.dimension.add",
      "sketch.constraint.add",
      "feature.extrude",
      "feature.revolve"
    ]);
    expect(actionById(actions, "feature.extrude")).toMatchObject({
      available: true,
      target: {
        sketchId: "sketch_1",
        sketchEntityId: "rect_1",
        sketchEntityKind: "rectangle"
      }
    });
    expect(actionById(actions, "feature.revolve")).toMatchObject({
      available: false,
      reason:
        "Add a non-zero line entity in this sketch to use as the revolve axis.",
      target: { revolveAxes: [] }
    });
  });

  it("enables circle hole and revolve actions when eligible targets exist", () => {
    const circle: SketchSnapshot["entities"][number] = {
      id: "circle_1",
      kind: "circle",
      center: [0, 0],
      radius: 1
    };
    const axis: SketchSnapshot["entities"][number] = {
      id: "axis_1",
      kind: "line",
      start: [0, -2],
      end: [0, 2]
    };
    const sketch = createSketch("sketch_1", { entities: [circle, axis] });
    const bodies = [createBody("body_rect", "feat_rect")];
    const features = [
      createExtrudeFeature("feat_rect", "body_rect", "rectangle", "newBody")
    ];
    const actions = deriveModelingActions({
      context: { selectionKind: "sketchEntity", sketch, entity: circle },
      bodies,
      features,
      preferredBodyId: "body_rect"
    });

    expect(actionById(actions, "feature.hole")).toMatchObject({
      available: true,
      target: {
        holeTargets: [
          {
            bodyId: "body_rect",
            featureId: "feat_rect",
            profileKind: "rectangle"
          }
        ]
      }
    });
    expect(actionById(actions, "feature.revolve")).toMatchObject({
      available: true,
      target: {
        revolveAxes: [
          {
            entityId: "axis_1",
            label: "Axis 1 / 4 mm",
            detail: "0, -2 to 0, 2"
          }
        ]
      }
    });
  });

  it("describes side-plane hole actions on circular targets without topology jargon", () => {
    const circle: SketchSnapshot["entities"][number] = {
      id: "circle_1",
      kind: "circle",
      center: [0, 0],
      radius: 1
    };
    const sketch = createSketch("sketch_side_hole", {
      plane: "XZ",
      entities: [circle]
    });
    const bodies = [createBody("body_circle", "feat_circle")];
    const features = [
      createExtrudeFeature("feat_circle", "body_circle", "circle", "newBody")
    ];
    const actions = deriveModelingActions({
      context: { selectionKind: "sketchEntity", sketch, entity: circle },
      bodies,
      features,
      preferredBodyId: "body_circle"
    });

    expect(actionById(actions, "feature.hole")).toMatchObject({
      available: true,
      target: {
        holeTargets: [
          expect.objectContaining({
            bodyId: "body_circle",
            profileKind: "circle"
          })
        ],
        holeTargetGuidance:
          "Creates a side hole through the circular target from the XZ sketch plane."
      }
    });
    expect(JSON.stringify(actionById(actions, "feature.hole"))).not.toMatch(
      /\b(topology|checkpoint|debug|tranche|milestone|command-ready)\b/i
    );
  });

  it("describes axial hole actions on circular targets from cap-plane sketches", () => {
    const circle: SketchSnapshot["entities"][number] = {
      id: "circle_1",
      kind: "circle",
      center: [0, 0],
      radius: 1
    };
    const sketch = createSketch("sketch_axial_hole", {
      plane: "XY",
      entities: [circle]
    });
    const bodies = [createBody("body_circle", "feat_circle")];
    const features = [
      createExtrudeFeature("feat_circle", "body_circle", "circle", "newBody")
    ];
    const actions = deriveModelingActions({
      context: { selectionKind: "sketchEntity", sketch, entity: circle },
      bodies,
      features,
      preferredBodyId: "body_circle"
    });

    expect(actionById(actions, "feature.hole")).toMatchObject({
      available: true,
      target: {
        holeTargetGuidance:
          "Creates an axial hole through the circular target. Use an XZ or YZ sketch for a side hole."
      }
    });
  });

  it("explains unavailable circle hole targets", () => {
    const circle: SketchSnapshot["entities"][number] = {
      id: "circle_1",
      kind: "circle",
      center: [0, 0],
      radius: 1
    };
    const sketch = createSketch("sketch_1", { entities: [circle] });
    const actions = deriveModelingActions({
      context: { selectionKind: "sketchEntity", sketch, entity: circle }
    });

    expect(actionById(actions, "feature.hole")).toMatchObject({
      available: false,
      reason:
        "Create an eligible rectangle, circle, or stable result target before creating a hole."
    });
  });

  it("represents line entities as revolve axes but not extrudable profiles", () => {
    const line: SketchSnapshot["entities"][number] = {
      id: "axis_1",
      kind: "line",
      start: [0, -1],
      end: [0, 1]
    };
    const sketch = createSketch("sketch_1", { entities: [line] });
    const actions = deriveModelingActions({
      context: { selectionKind: "sketchEntity", sketch, entity: line }
    });

    expect(actionById(actions, "feature.extrude")).toMatchObject({
      available: false,
      reason: "Line entities cannot be extruded directly."
    });
    expect(actionById(actions, "sketch.revolveAxis.use")).toMatchObject({
      available: true,
      target: {
        revolveAxes: [
          {
            entityId: "axis_1",
            label: "Axis 1 / 2 mm",
            detail: "0, -1 to 0, 1"
          }
        ]
      }
    });
  });

  it("derives body actions from generated planar faces", () => {
    const body = createBody("body_rect", "feat_rect");
    const feature = createExtrudeFeature(
      "feat_rect",
      "body_rect",
      "rectangle",
      "newBody"
    );
    const face = createFace();
    const references = createGeneratedReferences({
      faces: [face]
    });
    const actions = deriveModelingActions({
      context: {
        selectionKind: "body",
        body,
        feature,
        generatedReferences: references,
        referenceCandidatesByStableId: new Map([
          [face.stableId, createSelectionReferenceCandidates(face)]
        ])
      }
    });

    expect(actions.map((action) => action.id)).toEqual([
      "body.references.inspect",
      "body.measureTopology",
      "sketch.createOnFace"
    ]);
    expect(actionById(actions, "sketch.createOnFace")).toMatchObject({
      available: true,
      target: {
        bodyId: "body_rect",
        featureId: "feat_rect",
        eligibleFaceStableIds: ["generated:face:body_rect:startCap"]
      }
    });
  });

  it("does not enable generated face body actions without reference candidate query results", () => {
    const face = createFace();
    const actions = deriveModelingActions({
      context: {
        selectionKind: "body",
        body: createBody("body_rect", "feat_rect"),
        feature: createExtrudeFeature(
          "feat_rect",
          "body_rect",
          "rectangle",
          "newBody"
        ),
        generatedReferences: createGeneratedReferences({
          faces: [face]
        })
      }
    });

    expect(actionById(actions, "sketch.createOnFace")).toMatchObject({
      available: false,
      reason: "Create sketch on face needs reference readiness information.",
      target: { eligibleFaceStableIds: [] }
    });
  });

  it("explains body selections without eligible sketch faces", () => {
    const actions = deriveModelingActions({
      context: {
        selectionKind: "body",
        body: createBody("body_rect", "feat_rect"),
        feature: createExtrudeFeature(
          "feat_rect",
          "body_rect",
          "rectangle",
          "newBody"
        ),
        generatedReferences: createGeneratedReferences({
          faces: [createFace({ eligibleOperations: [] })]
        })
      }
    });

    expect(actionById(actions, "sketch.createOnFace")).toMatchObject({
      available: false,
      reason: "No planar generated faces are available for attached sketches."
    });
  });

  it("derives generated face reference actions and ineligible-face reasons", () => {
    const eligibleFace = createFace();
    const eligibleActions = deriveModelingActions({
      context: {
        selectionKind: "generatedReference",
        reference: eligibleFace,
        selectionReferenceCandidates:
          createSelectionReferenceCandidates(eligibleFace)
      }
    });

    expect(eligibleActions.map((action) => action.id)).toEqual([
      "reference.name",
      "sketch.createOnFace"
    ]);
    expect(actionById(eligibleActions, "sketch.createOnFace")).toMatchObject({
      available: true,
      target: {
        generatedReferenceStableId: "generated:face:body_rect:startCap",
        eligibleFaceStableIds: ["generated:face:body_rect:startCap"]
      }
    });

    const ineligibleFace = createFace({
      stableId: "generated:face:body_rect:side:circular",
      label: "Circular side face",
      role: "side:circular",
      eligibleOperations: ["feature.measureReference"],
      eligibilityNotes: [
        "Curved side faces cannot host attached sketches. Use a planar cap or an existing XZ/YZ sketch for supported hole workflows."
      ]
    });
    const ineligibleActions = deriveModelingActions({
      context: {
        selectionKind: "generatedReference",
        reference: ineligibleFace
      }
    });

    expect(actionById(ineligibleActions, "sketch.createOnFace")).toMatchObject({
      available: false,
      reason:
        "Curved side faces cannot host attached sketches. Use a planar cap or an existing XZ/YZ sketch for supported hole workflows."
    });
  });

  it("offers a side-hole sketch starter for circular side faces without enabling curved face attachment", () => {
    const circularSideFace = createFace({
      stableId: "generated:face:body_circle:side:circular",
      label: "Circular side face",
      bodyId: "body_circle",
      sourceFeatureId: "feat_circle",
      sourceSketchEntityId: "circle_1",
      role: "side:circular",
      eligibleOperations: [
        "feature.measureReference",
        "feature.selectReference"
      ],
      eligibilityNotes: [
        "Curved side faces cannot host attached sketches. Use a planar cap or an existing XZ/YZ sketch for supported hole workflows."
      ],
      geometricSignature: {
        profileKind: "circle",
        sketchPlane: "XY",
        extrudeSide: "positive",
        depth: 2,
        surfaceType: "cylinder"
      }
    });
    const actions = deriveModelingActions({
      context: {
        selectionKind: "generatedReference",
        reference: circularSideFace
      },
      bodies: [createBody("body_circle", "feat_circle")],
      features: [
        createExtrudeFeature("feat_circle", "body_circle", "circle", "newBody")
      ]
    });

    expect(actions.map((action) => action.id)).toEqual([
      "sketch.createSideHole",
      "reference.name",
      "sketch.createOnFace"
    ]);
    expect(actionById(actions, "sketch.createSideHole")).toMatchObject({
      available: true,
      target: {
        preferredHoleTargetBodyId: "body_circle",
        sideHoleSketchPlanes: ["XZ", "YZ"],
        holeTargetGuidance:
          "Creates a side hole through the circular target from the XZ sketch plane.",
        holeTargets: [
          expect.objectContaining({
            bodyId: "body_circle",
            profileKind: "circle"
          })
        ]
      }
    });
    expect(actionById(actions, "sketch.createOnFace")).toMatchObject({
      available: false,
      reason:
        "Curved side faces cannot host attached sketches. Use a planar cap or an existing XZ/YZ sketch for supported hole workflows."
    });
  });

  it("blocks side-hole sketch starters for consumed circular targets", () => {
    const circularSideFace = createFace({
      stableId: "generated:face:body_circle:side:circular",
      label: "Circular side face",
      bodyId: "body_circle",
      sourceFeatureId: "feat_circle",
      sourceSketchEntityId: "circle_1",
      role: "side:circular",
      eligibleOperations: [
        "feature.measureReference",
        "feature.selectReference"
      ],
      geometricSignature: {
        profileKind: "circle",
        sketchPlane: "XY",
        extrudeSide: "positive",
        depth: 2,
        surfaceType: "cylinder"
      }
    });
    const actions = deriveModelingActions({
      context: {
        selectionKind: "generatedReference",
        reference: circularSideFace
      },
      bodies: [createBody("body_circle", "feat_circle", "feat_cut")],
      features: [
        createExtrudeFeature("feat_circle", "body_circle", "circle", "newBody")
      ]
    });

    expect(actionById(actions, "sketch.createSideHole")).toMatchObject({
      available: false,
      reason: "This circular target is not ready for a side-hole sketch.",
      target: {
        holeTargets: [],
        sideHoleSketchPlanes: ["XZ", "YZ"]
      }
    });
  });

  it("derives generated edge finish actions through edge-finish rules", () => {
    const edge = createEdge();
    const actions = deriveModelingActions({
      context: {
        selectionKind: "generatedReference",
        reference: edge,
        body: createBody("body_rect", "feat_rect"),
        feature: createExtrudeFeature(
          "feat_rect",
          "body_rect",
          "rectangle",
          "newBody"
        ),
        selectionReferenceCandidates: createSelectionReferenceCandidates(edge)
      }
    });

    expect(actions.map((action) => action.id)).toEqual([
      "reference.name",
      "feature.chamfer",
      "feature.fillet"
    ]);
    expect(actionById(actions, "feature.chamfer")).toMatchObject({
      available: true,
      target: {
        bodyId: "body_rect",
        generatedReferenceStableId: "generated:edge:body_rect:start:uMin",
        generatedReferenceKind: "edge"
      }
    });
    expect(actionById(actions, "feature.fillet")).toMatchObject({
      available: true
    });
  });

  it("uses V7 selection reference candidates to block consumed face actions", () => {
    const face = createFace();
    const consumedCandidates = createSelectionReferenceCandidates(face, {
      status: "consumed",
      commandable: false,
      commandOperations: [],
      message: "Body body_rect was consumed by feat_cut."
    });
    const actions = deriveModelingActions({
      context: {
        selectionKind: "generatedReference",
        reference: face,
        selectionReferenceCandidates: consumedCandidates
      }
    });
    const bodyActions = deriveModelingActions({
      context: {
        selectionKind: "body",
        body: createBody("body_rect", "feat_rect"),
        feature: createExtrudeFeature(
          "feat_rect",
          "body_rect",
          "rectangle",
          "newBody"
        ),
        generatedReferences: createGeneratedReferences({ faces: [face] }),
        referenceCandidatesByStableId: new Map([
          [face.stableId, consumedCandidates]
        ])
      }
    });

    expect(actionById(actions, "reference.name")).toMatchObject({
      available: false,
      reason: "Selected body already has a downstream result."
    });
    expect(actionById(actions, "sketch.createOnFace")).toMatchObject({
      available: false,
      reason: "Selected body already has a downstream result."
    });
    expect(actionById(bodyActions, "sketch.createOnFace")).toMatchObject({
      available: false,
      reason: "Selected body already has a downstream result.",
      target: { eligibleFaceStableIds: [] }
    });
  });

  it("uses V7 selection reference candidates to block unsupported edge operations", () => {
    const edge = createEdge();
    const edgeCandidates = createSelectionReferenceCandidates(edge, {
      commandOperations: ["reference.nameGenerated", "feature.fillet"]
    });
    const actions = deriveModelingActions({
      context: {
        selectionKind: "generatedReference",
        reference: edge,
        body: createBody("body_rect", "feat_rect"),
        feature: createExtrudeFeature(
          "feat_rect",
          "body_rect",
          "rectangle",
          "newBody"
        ),
        selectionReferenceCandidates: edgeCandidates
      }
    });

    expect(actionById(actions, "reference.name")).toMatchObject({
      available: true
    });
    expect(actions.some((action) => action.id === "feature.chamfer")).toBe(
      false
    );
    expect(actionById(actions, "feature.fillet")).toMatchObject({
      available: true
    });
  });

  it("preserves previous result body anchors in compact hole actions", () => {
    const circle: SketchSnapshot["entities"][number] = {
      id: "circle_1",
      kind: "circle",
      center: [0, 0],
      radius: 1
    };
    const sketch = createSketch("sketch_1", { entities: [circle] });
    const bodies = [
      createBody("body_rect", "feat_rect", "feat_cut"),
      createBody("body_cut", "feat_cut")
    ];
    const features = [
      createExtrudeFeature("feat_rect", "body_rect", "rectangle", "newBody"),
      {
        ...createExtrudeFeature("feat_cut", "body_cut", "rectangle", "cut"),
        targetBodyId: "body_rect"
      }
    ];
    const actions = deriveModelingActions({
      context: { selectionKind: "sketchEntity", sketch, entity: circle },
      bodies,
      features,
      preferredBodyId: "body_cut",
      topologyAnchors: [
        {
          anchorId: "anchor_body_cut",
          entityKind: "body",
          bodyId: "body_cut",
          checkpointId: "checkpoint_body_cut",
          checkpointEntityId: "checkpoint-local-body-cut",
          stableId: "generated:body:body_cut",
          state: "active",
          diagnostics: []
        }
      ]
    });

    expect(actionById(actions, "feature.hole")).toMatchObject({
      available: true,
      target: {
        holeTargets: [
          expect.objectContaining({
            bodyId: "body_cut",
            targetTopologyAnchorId: "anchor_body_cut"
          })
        ]
      }
    });
  });

  it("keeps deferred V12 cut-wall edge finish operations out of compact actions", () => {
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
    const actions = deriveModelingActions({
      context: {
        selectionKind: "generatedReference",
        reference: edge,
        body: createBody("body_cut", "feat_cut"),
        feature: createExtrudeFeature(
          "feat_cut",
          "body_cut",
          "rectangle",
          "cut"
        ),
        selectionReferenceCandidates: createSelectionReferenceCandidates(edge)
      }
    });

    expect(actions.map((action) => action.id)).toEqual(["reference.name"]);
    expect(actionById(actions, "reference.name")).toMatchObject({
      available: true,
      target: {
        bodyId: "body_cut",
        generatedReferenceStableId:
          "generated:edge:body_cut:longitudinal:uMin:vMin",
        generatedReferenceKind: "edge"
      }
    });
  });

  it("explains unsupported generated edge finish targets", () => {
    const unsupportedEdge = createEdge({
      stableId: "generated:edge:body_rect:unsupported",
      label: "Unsupported edge",
      role: "start:circular",
      geometricSignature: {
        profileKind: "rectangle",
        sketchPlane: "XY",
        extrudeSide: "positive",
        depth: 2,
        curveType: "line"
      }
    });
    const actions = deriveModelingActions({
      context: {
        selectionKind: "generatedReference",
        reference: unsupportedEdge,
        body: createBody("body_rect", "feat_rect"),
        feature: createExtrudeFeature(
          "feat_rect",
          "body_rect",
          "rectangle",
          "newBody"
        ),
        selectionReferenceCandidates:
          createSelectionReferenceCandidates(unsupportedEdge)
      }
    });

    expect(actionById(actions, "feature.chamfer")).toMatchObject({
      available: false,
      reason: "This edge cannot be used for edge finish."
    });
    expect(actionById(actions, "feature.fillet")).toMatchObject({
      available: false,
      reason: "This edge cannot be used for edge finish."
    });
  });
});

function actionById(
  actions: readonly ModelingActionDescriptor[],
  id: ModelingActionId
): ModelingActionDescriptor {
  const action = actions.find((candidate) => candidate.id === id);
  expect(action).toBeDefined();
  return action!;
}

function createSketch(
  id: string,
  overrides: Partial<SketchSnapshot> = {}
): SketchSnapshot {
  return {
    id,
    name: id,
    plane: "XY",
    entities: [],
    ...overrides
  };
}

function createBody(
  id: string,
  featureId: string,
  consumedByFeatureId?: string
): CadBodySnapshot {
  return {
    id,
    kind: "solid",
    partId: "part:default",
    featureId,
    source: {
      type: "sketchExtrudeFeature",
      featureId,
      sketchId: "sketch_1",
      entityId: id === "body_circle" ? "circle_1" : "rect_1",
      profileKind: id === "body_circle" ? "circle" : "rectangle"
    },
    ...(consumedByFeatureId ? { consumedByFeatureId } : {})
  };
}

function createExtrudeFeature(
  id: string,
  bodyId: string,
  profileKind: "rectangle" | "circle",
  operationMode: "newBody" | "add" | "cut"
): Extract<CadFeatureSummary, { readonly kind: "extrude" }> {
  return {
    id,
    kind: "extrude",
    partId: "part:default",
    bodyId,
    sketchId: "sketch_1",
    entityId: profileKind === "rectangle" ? "rect_1" : "circle_1",
    profileKind,
    depth: 2,
    side: "positive",
    operationMode,
    source: {
      type: "sketchEntity",
      sketchId: "sketch_1",
      entityId: profileKind === "rectangle" ? "rect_1" : "circle_1"
    }
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
      label: "Generated body",
      eligibleOperations: [
        "feature.measureReference",
        "feature.selectReference"
      ],
      bodyId: "body_rect",
      ownerPartId: "part:default",
      sourceFeatureId: "feat_rect",
      sourceSketchId: "sketch_1",
      sourceSketchEntityId: "rect_1",
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

function createSelectionReferenceCandidates(
  reference: CadGeneratedReference,
  overrides: {
    readonly status?: SelectionReferenceCandidatesQueryResponse["status"];
    readonly commandable?: boolean;
    readonly commandOperations?: SelectionReferenceCandidatesQueryResponse["candidates"][number]["commandOperations"];
    readonly message?: string;
  } = {}
): SelectionReferenceCandidatesQueryResponse {
  const status = overrides.status ?? "resolved";
  const message =
    overrides.message ?? "Selection is not available for modeling.";
  const issue =
    status === "resolved"
      ? undefined
      : {
          code: "CONSUMED_SELECTION_BODY" as const,
          status: status as Exclude<
            SelectionReferenceCandidatesQueryResponse["status"],
            "resolved"
          >,
          message,
          bodyId: reference.bodyId,
          featureId: "feat_cut"
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
