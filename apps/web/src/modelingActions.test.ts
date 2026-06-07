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
        "Create an active rectangle or circle new body before creating a hole."
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
    const references = createGeneratedReferences({
      faces: [createFace()]
    });
    const actions = deriveModelingActions({
      context: {
        selectionKind: "body",
        body,
        feature,
        generatedReferences: references
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
        reference: eligibleFace
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
        "Circular side faces are not planar and are not eligible for sketch-plane attachment."
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
        "Circular side faces are not planar and are not eligible for sketch-plane attachment."
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
        )
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
      reason: "Body body_rect was consumed by feat_cut."
    });
    expect(actionById(actions, "sketch.createOnFace")).toMatchObject({
      available: false,
      reason: "Body body_rect was consumed by feat_cut."
    });
    expect(actionById(bodyActions, "sketch.createOnFace")).toMatchObject({
      available: false,
      reason: "Body body_rect was consumed by feat_cut.",
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
    expect(actionById(actions, "feature.chamfer")).toMatchObject({
      available: false,
      reason: "Chamfer is not command-ready for this selection."
    });
    expect(actionById(actions, "feature.fillet")).toMatchObject({
      available: true
    });
  });

  it("explains unsupported generated edge finish targets", () => {
    const unsupportedEdge = createEdge({
      stableId: "generated:edge:body_rect:start:circular",
      label: "Start circular edge",
      role: "start:circular",
      geometricSignature: {
        profileKind: "circle",
        sketchPlane: "XY",
        extrudeSide: "positive",
        depth: 2,
        curveType: "circle"
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
        )
      }
    });

    expect(actionById(actions, "feature.chamfer")).toMatchObject({
      available: false,
      reason: "Selected edge is not a supported generated rectangle edge."
    });
    expect(actionById(actions, "feature.fillet")).toMatchObject({
      available: false,
      reason: "Selected edge is not a supported generated rectangle edge."
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
    vertices: []
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
  const message = overrides.message ?? "Selection is not commandable.";
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
