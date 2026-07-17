import type {
  CadBodySnapshot,
  CadFeatureSummary,
  BodyGeneratedReferencesQueryResponse,
  CadGeneratedEdgeReference,
  CadGeneratedFaceReference,
  CadGeneratedReference,
  CadReferenceHealthEntry,
  NamedGeneratedReferenceEntry,
  SelectionReferenceCandidatesQueryResponse,
  SketchSolverStatusQueryResponse,
  SketchSnapshot
} from "@web-cad/cad-protocol";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { deriveModelingActions } from "../modelingActions";
import { getExtrudeTargetFields } from "../modelingPanelExtrudeTargets";
import { getExtrudeSideForOperationMode } from "../sketchPanelUi";
import { ModelingActionsPanel } from "./ModelingActionsPanel";

describe("ModelingActionsPanel", () => {
  it("renders sketch entity controls without sketch-opening shortcuts", () => {
    const rectangle: SketchSnapshot["entities"][number] = {
      id: "rect_1",
      kind: "rectangle",
      construction: false,
      center: [0, 0],
      width: 4,
      height: 2
    };
    const sketch = createSketch("sketch_1", "Sketch 1", [rectangle]);
    const context = {
      selectionKind: "sketchEntity" as const,
      sketch,
      entity: rectangle,
      solverStatus: createSolverStatus({
        status: "under-defined",
        numericalSolverStatus: "under-defined",
        dimensionCount: 1,
        constraintCount: 2,
        validProfileCount: 1,
        profileCount: 1
      })
    };
    const actions = deriveModelingActions({ context });
    const markup = renderToStaticMarkup(
      createElement(ModelingActionsPanel, {
        actions,
        context
      })
    );

    expect(markup).toContain("Rectangle in Sketch 1");
    expect(markup).toContain("Sketch status");
    expect(markup).toContain("Feature-ready");
    expect(markup).toContain("Numerical under-defined");
    expect(markup).toContain("1/1 feature-ready profile");
    expect(markup).toContain("Edit Rectangle");
    expect(markup).toContain("Driving dimension");
    expect(markup).toContain("Create feature");
    expect(markup).toContain("Create new body");
    expect(markup).toContain("Delete profile");
    expect(markup).not.toContain("Open Sketch");
  });

  it("keeps sketch creation visible while editing a selected entity", () => {
    const rectangle: SketchSnapshot["entities"][number] = {
      id: "rect_1",
      kind: "rectangle",
      construction: false,
      center: [0, 0],
      width: 4,
      height: 2
    };
    const sketch = createSketch("sketch_1", "Sketch 1", [rectangle]);
    const context = {
      selectionKind: "sketchEntity" as const,
      sketch,
      entity: rectangle
    };
    const actions = deriveModelingActions({ context });
    const markup = renderToStaticMarkup(
      createElement(ModelingActionsPanel, {
        actions,
        context,
        onCreateSketch: () => undefined,
        onDeleteSketch: () => undefined,
        onRenameSketch: () => undefined
      })
    );

    expect(markup).toContain("+ Sketch");
    expect(markup).toContain("XY");
    expect(markup).toContain("Active sketch");
    expect(markup).toContain("Rename");
    expect(markup).toContain("Delete");
    expect(markup).toContain("Rectangle in Sketch 1");
  });

  it("renders existing arcs as editable curves without exposing arc creation", () => {
    const arc: SketchSnapshot["entities"][number] = {
      id: "arc_1",
      kind: "arc",
      construction: true,
      center: [1, -2],
      radius: 3,
      startAngleDegrees: 350,
      sweepAngleDegrees: -80
    };
    const sketch = createSketch("sketch_1", "Sketch 1", [arc]);
    const context = {
      selectionKind: "sketchEntity" as const,
      sketch,
      entity: arc
    };
    const markup = renderToStaticMarkup(
      createElement(ModelingActionsPanel, {
        actions: deriveModelingActions({ context }),
        context
      })
    );

    expect(markup).toContain("Arc in Sketch 1");
    expect(markup).toContain("Selected curve");
    expect(markup).toContain("Edit Arc");
    expect(markup).toContain("start 350°");
    expect(markup).toContain("sweep -80°");
    expect(markup).not.toContain("+ Arc");
    expect(markup).not.toContain("Selected profile");
  });

  it("uses the next available sketch name for quick sketch creation", () => {
    const context = { selectionKind: "none" as const };
    const actions = deriveModelingActions({ context });
    const markup = renderToStaticMarkup(
      createElement(ModelingActionsPanel, {
        actions,
        context,
        sketches: [
          createSketch("sketch_1", "Sketch 1"),
          createSketch("sketch_2", "Sketch 2")
        ],
        onCreateSketch: () => undefined
      })
    );

    expect(markup).toContain("+ Sketch");
    expect(markup).toContain("Create Sketch 3");
    expect(markup).toContain("Open sketch");
  });

  it("exposes sketch deletion from the open sketch list", () => {
    const context = { selectionKind: "none" as const };
    const actions = deriveModelingActions({ context });
    const markup = renderToStaticMarkup(
      createElement(ModelingActionsPanel, {
        actions,
        context,
        sketches: [createSketch("sketch_1", "Sketch 1")],
        onCreateSketch: () => undefined,
        onDeleteSketch: () => undefined,
        onSelectSketch: () => undefined
      })
    );

    expect(markup).toContain("Open sketch");
    expect(markup).toContain("Sketch 1");
    expect(markup).toContain("Delete");
  });

  it("renders no-selection controls as direct sketch creation", () => {
    const context = { selectionKind: "none" as const };
    const actions = deriveModelingActions({ context });
    const markup = renderToStaticMarkup(
      createElement(ModelingActionsPanel, {
        actions,
        context,
        onCreateSketch: () => undefined
      })
    );

    expect(markup).toContain("Create a source sketch");
    expect(markup).toContain("+ Sketch");
    expect(markup).not.toContain("Open Sketch");
  });

  it("renders selected sketch controls as direct entity creation", () => {
    const sketch = createSketch("sketch_1", "Sketch 1");
    const context = {
      selectionKind: "sketch" as const,
      sketch
    };
    const actions = deriveModelingActions({ context });
    const markup = renderToStaticMarkup(
      createElement(ModelingActionsPanel, {
        actions,
        context
      })
    );

    expect(markup).toContain("Sketch 1");
    expect(markup).toContain("Sketch tools");
    expect(markup).toContain("Rectangle");
    expect(markup).not.toContain("Open Sketch");
  });

  it("renders selected body lifecycle actions directly", () => {
    const body: CadBodySnapshot = {
      id: "body_rect",
      kind: "solid",
      partId: "part_default",
      featureId: "feat_rect",
      name: "Rectangle body",
      source: {
        type: "sketchExtrudeFeature",
        featureId: "feat_rect",
        sketchId: "sketch_1",
        entityId: "rect_1",
        profileKind: "rectangle"
      }
    };
    const feature: CadFeatureSummary = {
      id: "feat_rect",
      kind: "extrude",
      partId: "part_default",
      bodyId: "body_rect",
      sketchId: "sketch_1",
      entityId: "rect_1",
      profileKind: "rectangle",
      depth: 1,
      side: "positive",
      operationMode: "newBody",
      source: {
        type: "sketchEntity",
        sketchId: "sketch_1",
        entityId: "rect_1"
      }
    };
    const context = {
      selectionKind: "body" as const,
      body,
      feature
    };
    const actions = deriveModelingActions({ context });
    const markup = renderToStaticMarkup(
      createElement(ModelingActionsPanel, {
        actions,
        context,
        onCreateSketchOnFace: () => undefined,
        onDeleteFeature: () => undefined,
        onSelectSketch: () => undefined
      })
    );

    expect(markup).toContain("Body actions");
    expect(markup).toContain("Extrude new body result");
    expect(markup).toContain("Source sketch");
    expect(markup).toContain("Source profile");
    expect(markup).toContain("Delete feature");
    expect(markup).toContain("Sketch on face");
    expect(markup).not.toContain("feat_rect");
  });

  it("includes extrude operation modes in selected body summaries", () => {
    const scenarios = [
      {
        bodyId: "body_cut",
        featureId: "feat_cut",
        operationMode: "cut",
        expected: "Extrude cut body result"
      },
      {
        bodyId: "body_add",
        featureId: "feat_add",
        operationMode: "add",
        expected: "Extrude add to body result"
      }
    ] as const;

    for (const scenario of scenarios) {
      const body: CadBodySnapshot = {
        id: scenario.bodyId,
        kind: "solid",
        partId: "part_default",
        featureId: scenario.featureId,
        name: scenario.bodyId,
        source: {
          type: "sketchExtrudeFeature",
          featureId: scenario.featureId,
          sketchId: "sketch_1",
          entityId: "rect_1",
          profileKind: "rectangle"
        }
      };
      const feature: CadFeatureSummary = {
        id: scenario.featureId,
        kind: "extrude",
        partId: "part_default",
        bodyId: scenario.bodyId,
        sketchId: "sketch_1",
        entityId: "rect_1",
        profileKind: "rectangle",
        depth: 1,
        side: "positive",
        operationMode: scenario.operationMode,
        targetBodyId: "body_base",
        source: {
          type: "sketchEntity",
          sketchId: "sketch_1",
          entityId: "rect_1"
        }
      };
      const context = {
        selectionKind: "body" as const,
        body,
        feature
      };
      const actions = deriveModelingActions({ context });
      const markup = renderToStaticMarkup(
        createElement(ModelingActionsPanel, {
          actions,
          context
        })
      );

      expect(markup).toContain(scenario.expected);
      expect(markup).not.toContain("Extrude feature");
    }
  });

  it("renders source axis recovery for selected revolve bodies", () => {
    const body: CadBodySnapshot = {
      id: "body_revolve",
      kind: "solid",
      partId: "part_default",
      featureId: "feat_revolve",
      name: "Revolve body",
      source: {
        type: "sketchRevolveFeature",
        featureId: "feat_revolve",
        sketchId: "sketch_1",
        entityId: "rect_1",
        profileKind: "rectangle",
        axis: {
          type: "sketchLine",
          sketchId: "sketch_1",
          entityId: "axis_1"
        }
      }
    };
    const feature: CadFeatureSummary = {
      id: "feat_revolve",
      kind: "revolve",
      partId: "part_default",
      bodyId: "body_revolve",
      sketchId: "sketch_1",
      entityId: "rect_1",
      profileKind: "rectangle",
      axis: {
        type: "sketchLine",
        sketchId: "sketch_1",
        entityId: "axis_1"
      },
      angleDegrees: 360,
      operationMode: "newBody",
      source: {
        type: "sketchEntityWithAxis",
        sketchId: "sketch_1",
        entityId: "rect_1",
        axis: {
          type: "sketchLine",
          sketchId: "sketch_1",
          entityId: "axis_1"
        }
      }
    };
    const context = {
      selectionKind: "body" as const,
      body,
      feature
    };
    const actions = deriveModelingActions({ context });
    const markup = renderToStaticMarkup(
      createElement(ModelingActionsPanel, {
        actions,
        context,
        onSelectSketch: () => undefined
      })
    );

    expect(markup).toContain("Source sketch");
    expect(markup).toContain("Source profile");
    expect(markup).toContain("Source axis");
  });

  it("renders direct face sketch actions for selected bodies", () => {
    const body: CadBodySnapshot = {
      id: "body_rect",
      kind: "solid",
      partId: "part_default",
      featureId: "feat_rect",
      name: "Rectangle body",
      source: {
        type: "sketchExtrudeFeature",
        featureId: "feat_rect",
        sketchId: "sketch_1",
        entityId: "rect_1",
        profileKind: "rectangle"
      }
    };
    const feature: CadFeatureSummary = {
      id: "feat_rect",
      kind: "extrude",
      partId: "part_default",
      bodyId: "body_rect",
      sketchId: "sketch_1",
      entityId: "rect_1",
      profileKind: "rectangle",
      depth: 1,
      side: "positive",
      operationMode: "newBody",
      source: {
        type: "sketchEntity",
        sketchId: "sketch_1",
        entityId: "rect_1"
      }
    };
    const startFace = createFace({ label: "Start cap", role: "startCap" });
    const endFace = createFace({
      stableId: "generated:face:body_rect:endCap",
      label: "End cap",
      role: "endCap"
    });
    const generatedReferences: BodyGeneratedReferencesQueryResponse = {
      ok: true,
      query: "body.generatedReferences",
      cadOpsVersion: "cadops.v1",
      body: {
        kind: "body",
        stableId: "generated:body:body_rect",
        label: "Rectangle body",
        eligibleOperations: ["feature.measureReference"],
        bodyId: "body_rect",
        ownerPartId: "part_default",
        sourceFeatureId: "feat_rect",
        sourceSketchId: "sketch_1",
        sourceSketchEntityId: "rect_1",
        profileKind: "rectangle",
        geometricSignature: {
          profileKind: "rectangle",
          sketchPlane: "XY",
          extrudeSide: "positive",
          depth: 1
        }
      },
      faceCount: 2,
      faces: [startFace, endFace],
      edgeCount: 0,
      edges: [],
      vertexCount: 0,
      vertices: [],
      axisCount: 0,
      axes: []
    };
    const context = {
      selectionKind: "body" as const,
      body,
      feature,
      generatedReferences,
      referenceCandidatesByStableId: new Map([
        [startFace.stableId, createSelectionReferenceCandidates(startFace)],
        [endFace.stableId, createSelectionReferenceCandidates(endFace)]
      ])
    };
    const actions = deriveModelingActions({ context });
    const markup = renderToStaticMarkup(
      createElement(ModelingActionsPanel, {
        actions,
        context,
        sketches: [createSketch("sketch_1", "Sketch 1")],
        onCreateSketchOnFace: () => undefined,
        onSelectSketch: () => undefined
      })
    );

    expect(markup).toContain("Sketch on face");
    expect(markup).toContain("Sketch Start cap");
    expect(markup).toContain("Sketch End cap");
    expect(markup).toContain("Custom face/name");
  });

  it("defaults attached rectangle profiles to cut inward when targets exist", () => {
    const rectangle: SketchSnapshot["entities"][number] = {
      id: "rect_face",
      kind: "rectangle",
      construction: false,
      center: [0, 0],
      width: 1,
      height: 1
    };
    const sketch = createSketch("sketch_face_1", "Face sketch", [rectangle], {
      kind: "generatedFace",
      bodyId: "body_rect",
      faceStableId: "generated:face:body_rect:endCap",
      faceRole: "endCap",
      sourceFeatureId: "feat_rect",
      sourceSketchId: "sketch_1",
      sourceSketchEntityId: "rect_1"
    });
    const context = {
      selectionKind: "sketchEntity" as const,
      sketch,
      entity: rectangle
    };
    const actions = deriveModelingActions({ context });
    const markup = renderToStaticMarkup(
      createElement(ModelingActionsPanel, {
        actions,
        context,
        cutTargetBodies: [
          {
            bodyId: "body_rect",
            featureId: "feat_rect",
            profileKind: "rectangle",
            label: "Rectangle body / 2 mm",
            detail: "Rectangle new body / 2 mm / positive"
          }
        ]
      })
    );

    expect(markup).toContain("Cut body (1)");
    expect(markup).toContain("1 eligible cut target body.");
    expect(markup).toContain("Target: Rectangle body / 2 mm.");
    expect(markup).toContain(
      "Cut hides that target and creates a cut result body."
    );
    expect(markup).toContain("Negative cuts inward from the attached face.");
    expect(markup).toContain("Cut body");
  });

  it("preserves topology-backed cut and add target anchors for extrude submit forms", () => {
    const addTargets = [
      {
        bodyId: "body_add_result",
        featureId: "feat_add_result",
        targetTopologyAnchorId: "anchor_body_add",
        profileKind: "rectangle" as const,
        label: "Rectangle add result",
        detail: "Rectangle result body / add"
      }
    ];
    const cutTargets = [
      {
        bodyId: "body_cut_result",
        featureId: "feat_cut_result",
        targetTopologyAnchorId: "anchor_body_cut",
        profileKind: "rectangle" as const,
        label: "Rectangle cut result",
        detail: "Rectangle result body / cut"
      }
    ];

    expect(getExtrudeTargetFields("cut", addTargets, cutTargets)).toEqual({
      targetBodyId: "body_cut_result",
      targetTopologyAnchorId: "anchor_body_cut"
    });
    expect(getExtrudeTargetFields("add", addTargets, cutTargets)).toEqual({
      targetBodyId: "body_add_result",
      targetTopologyAnchorId: "anchor_body_add"
    });
    expect(
      getExtrudeTargetFields(
        "cut",
        addTargets,
        [
          {
            bodyId: "body_cut_other",
            featureId: "feat_cut_other",
            targetTopologyAnchorId: "anchor_body_other",
            profileKind: "rectangle",
            label: "Other cut result",
            detail: "Rectangle result body / cut"
          },
          ...cutTargets
        ],
        "body_cut_result"
      )
    ).toEqual({
      targetBodyId: "body_cut_result",
      targetTopologyAnchorId: "anchor_body_cut"
    });
    expect(getExtrudeTargetFields("newBody", addTargets, cutTargets)).toEqual({
      targetBodyId: undefined,
      targetTopologyAnchorId: undefined
    });
  });

  it("defaults circle profiles with eligible targets to hole creation", () => {
    const circle: SketchSnapshot["entities"][number] = {
      id: "circle_1",
      kind: "circle",
      construction: false,
      center: [0, 0],
      radius: 0.3
    };
    const sketch = createSketch("sketch_face_1", "Face sketch", [circle]);
    const context = {
      selectionKind: "sketchEntity" as const,
      sketch,
      entity: circle
    };
    const actions = deriveModelingActions({ context });
    const markup = renderToStaticMarkup(
      createElement(ModelingActionsPanel, {
        actions,
        context,
        holeTargetBodies: [
          {
            bodyId: "body_rect",
            featureId: "feat_rect",
            profileKind: "rectangle",
            label: "Rectangle body / 2 mm",
            detail: "Rectangle new body / 2 mm / positive"
          }
        ]
      })
    );

    expect(markup).toContain("Create hole");
    expect(markup).toContain("Through all");
    expect(markup).not.toContain("Create extrude");
  });

  it("guides XZ circle profiles toward circular side holes", () => {
    const circle: SketchSnapshot["entities"][number] = {
      id: "circle_1",
      kind: "circle",
      construction: false,
      center: [0, 1.5],
      radius: 0.2
    };
    const sketch = createSketch(
      "sketch_side_hole",
      "Side hole sketch",
      [circle],
      undefined,
      "XZ"
    );
    const context = {
      selectionKind: "sketchEntity" as const,
      sketch,
      entity: circle
    };
    const targetBody: CadBodySnapshot = {
      id: "body_circle_result",
      kind: "solid",
      partId: "part_default",
      featureId: "feat_circle_result",
      source: {
        type: "sketchExtrudeFeature",
        featureId: "feat_circle_result",
        sketchId: "sketch_target",
        entityId: "circle_target",
        profileKind: "circle"
      }
    };
    const targetFeature: CadFeatureSummary = {
      id: "feat_circle_result",
      kind: "extrude",
      partId: "part_default",
      bodyId: "body_circle_result",
      sketchId: "sketch_target",
      entityId: "circle_target",
      profileKind: "circle",
      depth: 3,
      side: "positive",
      operationMode: "newBody",
      source: {
        type: "sketchEntity",
        sketchId: "sketch_target",
        entityId: "circle_target"
      }
    };
    const actions = deriveModelingActions({
      context,
      bodies: [targetBody],
      features: [targetFeature],
      preferredBodyId: "body_circle_result"
    });
    const markup = renderToStaticMarkup(
      createElement(ModelingActionsPanel, {
        actions,
        context,
        holeTargetBodies: [
          {
            bodyId: "body_circle_result",
            featureId: "feat_circle_result",
            profileKind: "circle",
            label: "Circle result target",
            detail: "Circle target"
          }
        ]
      })
    );

    expect(markup).toContain(
      "Creates a side hole through the circular target from the XZ sketch plane."
    );
    expect(markup).not.toContain("topology");
  });

  it("prefers app-supplied topology hole targets over stale action targets", () => {
    const circle: SketchSnapshot["entities"][number] = {
      id: "circle_1",
      kind: "circle",
      construction: false,
      center: [0, 0],
      radius: 0.3
    };
    const sketch = createSketch("sketch_face_1", "Face sketch", [circle]);
    const context = {
      selectionKind: "sketchEntity" as const,
      sketch,
      entity: circle
    };
    const actions = deriveModelingActions({
      context,
      bodies: [
        {
          id: "body_stale",
          kind: "solid",
          partId: "part:default",
          featureId: "feat_stale",
          source: {
            type: "sketchExtrudeFeature",
            featureId: "feat_stale",
            sketchId: "sketch_1",
            entityId: "rect_1",
            profileKind: "rectangle"
          }
        }
      ],
      features: [
        {
          id: "feat_stale",
          kind: "extrude",
          partId: "part:default",
          bodyId: "body_stale",
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
          }
        }
      ],
      preferredBodyId: "body_stale"
    }).map((action) =>
      action.id === "feature.hole"
        ? {
            ...action,
            target: {
              ...action.target,
              holeTargets: [
                {
                  bodyId: "body_stale",
                  featureId: "feat_stale",
                  profileKind: "rectangle" as const,
                  label: "Stale action target",
                  detail: "Stale action target detail"
                }
              ]
            }
          }
        : action
    );
    const markup = renderToStaticMarkup(
      createElement(ModelingActionsPanel, {
        actions,
        context,
        holeTargetBodies: [
          {
            bodyId: "body_fresh",
            featureId: "feat_fresh",
            targetTopologyAnchorId: "anchor_body_fresh",
            profileKind: "rectangle",
            label: "Fresh result body",
            detail: "Fresh result body / cut"
          }
        ]
      })
    );

    expect(markup).toContain("Fresh result body");
    expect(markup).not.toContain("Stale action target");
  });

  it("explains selected sketch lines as revolve axis candidates", () => {
    const line: SketchSnapshot["entities"][number] = {
      id: "line_axis",
      kind: "line",
      construction: false,
      start: [0, 0],
      end: [0, 5]
    };
    const sketch = createSketch("sketch_1", "Sketch 1", [line]);
    const context = {
      selectionKind: "sketchEntity" as const,
      sketch,
      entity: line
    };
    const actions = deriveModelingActions({ context });
    const markup = renderToStaticMarkup(
      createElement(ModelingActionsPanel, {
        actions,
        context,
        onDeleteEntity: () => undefined
      })
    );

    expect(markup).toContain("Axis candidate");
    expect(markup).toContain("Use this line as a revolve axis");
    expect(markup).toContain("Delete axis");
  });

  it("keeps an axis-line action visible when a selected profile cannot revolve yet", () => {
    const rectangle: SketchSnapshot["entities"][number] = {
      id: "rect_1",
      kind: "rectangle",
      construction: false,
      center: [0, 0],
      width: 4,
      height: 2
    };
    const sketch = createSketch("sketch_1", "Sketch 1", [rectangle]);
    const context = {
      selectionKind: "sketchEntity" as const,
      sketch,
      entity: rectangle
    };
    const actions = deriveModelingActions({ context });
    const markup = renderToStaticMarkup(
      createElement(ModelingActionsPanel, {
        actions,
        context,
        sketches: [sketch],
        onAddEntity: () => undefined
      })
    );

    expect(markup).toContain("Revolve setup");
    expect(markup).toContain("Needs an axis line");
    expect(markup).toContain("Add axis line");
    expect(markup).toContain("Create feature");
    expect(markup).not.toMatch(
      /topology|checkpoint|rendererId|meshId|occtId|opfsPath|fileHandle/i
    );
  });

  it("renders generated reference summaries without using raw IDs as labels", () => {
    const reference = createFace({
      label: "Start cap"
    });
    const selectionReferenceCandidates =
      createSelectionReferenceCandidates(reference);
    const context = {
      selectionKind: "generatedReference",
      reference,
      selectionReferenceCandidates
    } as const;
    const actions = deriveModelingActions({ context });
    const markup = renderToStaticMarkup(
      createElement(ModelingActionsPanel, {
        actions,
        context
      })
    );

    expect(markup).toContain("Face");
    expect(markup).toContain("Start cap");
    expect(markup).toContain("Name reference");
    expect(markup).toContain("Reference status");
    expect(markup).toContain("Ready reference");
    expect(markup).toContain("Back to body");
    expect(markup).toContain("Create sketch on face");
    expect(markup).not.toContain("generated:face:body_rect:startCap");
  });

  it("renders a side-hole sketch starter for circular side references", () => {
    const reference = createFace({
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
    const context = {
      selectionKind: "generatedReference",
      reference
    } as const;
    const actions = deriveModelingActions({
      context,
      bodies: [createModelingBody("body_circle", "feat_circle", "circle")],
      features: [
        createModelingExtrudeFeature("feat_circle", "body_circle", "circle")
      ]
    });
    const markup = renderToStaticMarkup(
      createElement(ModelingActionsPanel, {
        actions,
        context,
        onCreateSideHoleSketch: () => undefined
      })
    );

    expect(markup).toContain("Side-hole sketch");
    expect(markup).toContain("World plane");
    expect(markup).toContain("XZ");
    expect(markup).toContain("YZ");
    expect(markup).toContain("Create XZ sketch");
    expect(markup).toContain(
      "Creates a side hole through the circular target from the XZ sketch plane."
    );
    expect(markup).toContain(
      "Curved side faces cannot host attached sketches."
    );
    expect(markup).not.toMatch(
      /topology|checkpoint|debug|tranche|milestone|command-ready|rendererId|meshId|occtId|opfsPath|fileHandle/i
    );
  });

  it("renders saved reference status without topology debug copy", () => {
    const reference = createFace({
      label: "Start cap"
    });
    const selectionReferenceCandidates = createSelectionReferenceCandidates(
      reference,
      {
        source: "topologyAnchorSelection",
        topologyAnchorId: "anchor_face_1",
        checkpointId: "checkpoint_1"
      }
    );
    const context = {
      selectionKind: "generatedReference",
      reference,
      selectionReferenceCandidates
    } as const;
    const actions = deriveModelingActions({ context });
    const markup = renderToStaticMarkup(
      createElement(ModelingActionsPanel, {
        actions,
        context
      })
    );

    expect(markup).toContain("Reference status");
    expect(markup).toContain("Ready reference");
    expect(markup).toContain("Create sketch on face");
    expect(markup).not.toContain("Topology anchor-backed");
    expect(markup).not.toContain("checkpoint evidence");
    expect(markup).not.toMatch(
      /checkpoint-local|checkpointEntityId|rendererId|meshId|occtId|gpuId|selectionBufferId|pixelId|opfsPath|fileHandle/i
    );
  });

  it("renders named reference repair in the generated reference workbench", () => {
    const reference = createFace({
      label: "Start cap"
    });
    const staleReference: NamedGeneratedReferenceEntry = {
      name: "Top face",
      kind: "face",
      bodyId: "body_old",
      stableId: "generated:face:body_old:startCap",
      status: "stale"
    };
    const selectionReferenceCandidates =
      createSelectionReferenceCandidates(reference);
    const context = {
      selectionKind: "generatedReference",
      reference,
      selectionReferenceCandidates
    } as const;
    const actions = deriveModelingActions({ context });
    const markup = renderToStaticMarkup(
      createElement(ModelingActionsPanel, {
        actions,
        context,
        namedReferences: [staleReference],
        namedReferenceHealthByName: new Map([
          ["Top face", createNamedReferenceHealth(staleReference)]
        ]),
        selectedNamedReferenceName: "Top face",
        onRepairNamedReference: () => undefined
      })
    );

    expect(markup).toContain("Repair Top face");
    expect(markup).toContain("Repair needed");
    expect(markup).toContain("Repair name");
    expect(markup).toContain("Named reference needs a new target.");
  });

  it("renders structured V7 diagnostics for non-commandable generated references", () => {
    const reference = createFace({
      label: "Start cap"
    });
    const selectionReferenceCandidates = createSelectionReferenceCandidates(
      reference,
      {
        status: "consumed",
        commandable: false,
        commandOperations: [],
        message: "Body body_rect was consumed by feat_cut."
      }
    );
    const context = {
      selectionKind: "generatedReference",
      reference,
      selectionReferenceCandidates
    } as const;
    const actions = deriveModelingActions({ context });
    const markup = renderToStaticMarkup(
      createElement(ModelingActionsPanel, {
        actions,
        context
      })
    );

    expect(markup).toContain("Selection body consumed");
    expect(markup).toContain("Selected body already has a downstream result.");
    expect(markup).not.toContain("feat_cut");
    expect(markup).toContain("Name reference");
  });

  it("renders edge reference naming and edge-finish controls directly", () => {
    const reference = createEdge({
      label: "Start uMin edge"
    });
    const selectionReferenceCandidates =
      createSelectionReferenceCandidates(reference);
    const context = {
      selectionKind: "generatedReference",
      reference,
      selectionReferenceCandidates
    } as const;
    const actions = deriveModelingActions({ context });
    const markup = renderToStaticMarkup(
      createElement(ModelingActionsPanel, {
        actions,
        context
      })
    );

    expect(markup).toContain("Name reference");
    expect(markup).toContain("Reference status");
    expect(markup).toContain("Ready reference");
    expect(markup).toContain("Edge finish");
    expect(markup).toContain("Chamfer");
    expect(markup).toContain("Fillet");
    expect(markup).toContain("Create chamfer");
    expect(markup).not.toContain("generated:edge:body_rect:start:uMin");
  });

  it("offers matching named edge references for edge-finish commands", () => {
    const reference = createEdge({
      label: "Cut wall profile edge uMin/vMin",
      stableId: "generated:edge:body_cut:longitudinal:uMin:vMin",
      bodyId: "body_cut",
      role: "longitudinal:uMin:vMin"
    });
    const namedReference: NamedGeneratedReferenceEntry = {
      name: "Result cut edge",
      bodyId: reference.bodyId,
      stableId: reference.stableId,
      kind: "edge",
      status: "resolved",
      reference
    };
    const selectionReferenceCandidates =
      createSelectionReferenceCandidates(reference);
    const context = {
      selectionKind: "generatedReference",
      reference,
      namedReferences: [namedReference],
      selectionReferenceCandidates
    } as const;
    const actions = deriveModelingActions({ context });
    const markup = renderToStaticMarkup(
      createElement(ModelingActionsPanel, {
        actions,
        context,
        namedReferences: [namedReference]
      })
    );

    expect(markup).toContain("Edge finish");
    expect(markup).toContain("Reference");
    expect(markup).toContain("Selected edge (Cut wall profile edge uMin/vMin)");
    expect(markup).toContain("Result cut edge");
    expect(markup).toContain("Create chamfer");
    expect(markup).not.toContain(reference.stableId);
  });

  it("keeps deferred V12 cut-wall edge finish controls out of the modeling surface", () => {
    const reference = createEdge({
      stableId: "generated:edge:body_cut:longitudinal:uMin:vMin",
      label: "Cut wall profile edge uMin/vMin",
      role: "longitudinal:uMin:vMin",
      eligibleOperations: [
        "feature.measureReference",
        "feature.selectReference"
      ]
    });
    const selectionReferenceCandidates = createSelectionReferenceCandidates(
      reference,
      {
        commandOperations: [
          "reference.nameGenerated",
          "feature.measureReference",
          "feature.selectReference"
        ]
      }
    );
    const context = {
      selectionKind: "generatedReference",
      reference,
      selectionReferenceCandidates
    } as const;
    const actions = deriveModelingActions({ context });
    const markup = renderToStaticMarkup(
      createElement(ModelingActionsPanel, {
        actions,
        context
      })
    );

    expect(actions.map((action) => action.id)).toEqual(["reference.name"]);
    expect(markup).toContain("Name reference");
    expect(markup).toContain("Reference status");
    expect(markup).toContain("Ready reference");
    expect(markup).not.toContain("Edge finish");
    expect(markup).not.toContain("Chamfer");
    expect(markup).not.toContain("Fillet");
  });

  it("defaults attached sketch cuts inward from the selected face", () => {
    const attachedSketch = createSketch("sketch_face_1", "Face sketch", [], {
      kind: "generatedFace",
      bodyId: "body_rect",
      faceStableId: "generated:face:body_rect:endCap",
      faceRole: "endCap",
      sourceFeatureId: "feat_rect",
      sourceSketchId: "sketch_1",
      sourceSketchEntityId: "rect_1"
    });
    const baseSketch = createSketch("sketch_1", "Base sketch");

    expect(
      getExtrudeSideForOperationMode(attachedSketch, "cut", "positive")
    ).toBe("negative");
    expect(
      getExtrudeSideForOperationMode(attachedSketch, "newBody", "negative")
    ).toBe("positive");
    expect(getExtrudeSideForOperationMode(baseSketch, "cut", "positive")).toBe(
      "positive"
    );
  });
});

function createSketch(
  id: string,
  name: string,
  entities: SketchSnapshot["entities"] = [],
  attachment?: SketchSnapshot["attachment"],
  plane: SketchSnapshot["plane"] = "XY"
): SketchSnapshot {
  return {
    id,
    name,
    plane,
    entities,
    ...(attachment ? { attachment } : {})
  };
}

function createSolverStatus({
  status = "solved",
  numericalSolverStatus = "converged",
  dimensionCount = 0,
  constraintCount = 0,
  validProfileCount = 0,
  profileCount = 0
}: {
  readonly status?: SketchSolverStatusQueryResponse["status"];
  readonly numericalSolverStatus?: SketchSolverStatusQueryResponse["solver"]["numericalSolverStatus"];
  readonly dimensionCount?: number;
  readonly constraintCount?: number;
  readonly validProfileCount?: number;
  readonly profileCount?: number;
} = {}): SketchSolverStatusQueryResponse {
  return {
    ok: true,
    query: "sketch.solverStatus",
    cadOpsVersion: "cadops.v1",
    sketchId: "sketch_1",
    sketchName: "Sketch 1",
    plane: "XY",
    status,
    readiness: "ready",
    solver: {
      engine: "current-direct-evaluator",
      numericalSolverStatus,
      numericalSolverEngine: "@web-cad/sketch-solver",
      numericalSolverModelVersion: "partbench.sketch-solver.v1",
      modelBuilt: true,
      solverRan: true,
      canSolveNumerically: true,
      deterministic: true,
      workerReady: false,
      diagnostic: {
        code: "SKETCH_SOLVER_NUMERICAL_STATUS_READY",
        severity: "info",
        message: "Numerical solver status is available.",
        sketchId: "sketch_1"
      }
    },
    entityCount: 0,
    entities: [],
    dimensionCount,
    dimensions: [],
    constraintCount,
    constraints: [],
    deferredConstraintCount: 0,
    deferredConstraints: [],
    profileValidity: {
      status: validProfileCount > 0 ? "valid" : "unsupported",
      profileCount,
      validProfileCount,
      profiles: [],
      diagnosticCount: 0,
      diagnostics: []
    },
    preview: {
      status: "deferred",
      willMutateDocument: false,
      supportedPreviewKinds: [],
      deferredPreviewKinds: ["entity.drag"],
      diagnosticCount: 0,
      diagnostics: []
    },
    sourceContract: {
      currentProjectSchemaVersion: "web-cad.project.v16",
      emittedProjectSchemaVersion: "web-cad.project.v16",
      packageVersion: "partbench.wcad.v1",
      queryOnly: true,
      requiresProjectSchemaMigration: false,
      nextProjectSchemaVersion: "web-cad.project.v17",
      sourceRecordRequirements: []
    },
    diagnosticCount: 0,
    diagnostics: [],
    sourceBoundaryNote: "source",
    derivedBoundaryNote: "derived",
    requiresProjectSchemaMigration: false
  };
}

function createFace(
  overrides: Partial<
    Extract<
      CadGeneratedFaceReference,
      { readonly sourceSketchEntityId: string }
    >
  > = {}
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

function createModelingBody(
  id: string,
  featureId: string,
  profileKind: "rectangle" | "circle" = "rectangle"
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
      entityId: profileKind === "circle" ? "circle_1" : "rect_1",
      profileKind
    }
  };
}

function createModelingExtrudeFeature(
  id: string,
  bodyId: string,
  profileKind: "rectangle" | "circle" = "rectangle"
): Extract<CadFeatureSummary, { readonly kind: "extrude" }> {
  return {
    id,
    kind: "extrude",
    partId: "part:default",
    bodyId,
    sketchId: "sketch_1",
    entityId: profileKind === "circle" ? "circle_1" : "rect_1",
    profileKind,
    depth: 2,
    side: "positive",
    operationMode: "newBody",
    source: {
      type: "sketchEntity",
      sketchId: "sketch_1",
      entityId: profileKind === "circle" ? "circle_1" : "rect_1"
    }
  };
}

function createEdge(
  overrides: Partial<
    Extract<
      CadGeneratedEdgeReference,
      { readonly sourceSketchEntityId: string }
    >
  > = {}
): CadGeneratedEdgeReference {
  return {
    kind: "edge",
    stableId: "generated:edge:body_rect:start:uMin",
    label: "Start uMin edge",
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
      profile: {
        kind: "rectangle",
        center: [0, 0],
        width: 4,
        height: 2
      },
      sketchPlane: "XY",
      extrudeSide: "positive",
      depth: 2,
      curveType: "line"
    },
    ...overrides
  };
}

function createNamedReferenceHealth(
  reference: NamedGeneratedReferenceEntry
): CadReferenceHealthEntry {
  return {
    source: "namedReference",
    status: "repair-needed",
    commandable: false,
    commandOperations: [],
    label: reference.name,
    bodyId: reference.bodyId,
    stableId: reference.stableId,
    kind: reference.kind,
    referenceName: reference.name,
    sourceFeatureId: "feat_rect",
    dependencies: {
      sketchIds: ["sketch_1"],
      sketchEntityIds: ["rect_1"],
      featureIds: ["feat_rect"],
      bodyIds: [reference.bodyId],
      generatedReferenceStableIds: [reference.stableId],
      namedReferenceNames: [reference.name]
    },
    diagnosticCount: 1,
    diagnostics: [
      {
        code: "REFERENCE_REPAIR_NEEDED",
        severity: "warning",
        status: "repair-needed",
        message: "Named reference needs a new target.",
        bodyId: reference.bodyId,
        stableId: reference.stableId,
        referenceName: reference.name
      }
    ]
  };
}

function createSelectionReferenceCandidates(
  reference: CadGeneratedReference,
  overrides: {
    readonly status?: SelectionReferenceCandidatesQueryResponse["status"];
    readonly commandable?: boolean;
    readonly commandOperations?: SelectionReferenceCandidatesQueryResponse["candidates"][number]["commandOperations"];
    readonly message?: string;
    readonly source?: SelectionReferenceCandidatesQueryResponse["candidates"][number]["source"];
    readonly topologyAnchorId?: string;
    readonly checkpointId?: string;
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
        source: overrides.source ?? "generatedReferenceSelection",
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
