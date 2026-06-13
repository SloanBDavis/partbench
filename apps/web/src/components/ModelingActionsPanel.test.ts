import type {
  CadBodySnapshot,
  CadFeatureSummary,
  BodyGeneratedReferencesQueryResponse,
  CadGeneratedEdgeReference,
  CadGeneratedFaceReference,
  CadGeneratedReference,
  SelectionReferenceCandidatesQueryResponse,
  SketchSnapshot
} from "@web-cad/cad-protocol";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { deriveModelingActions } from "../modelingActions";
import { getExtrudeSideForOperationMode } from "../sketchPanelUi";
import { ModelingActionsPanel } from "./ModelingActionsPanel";

describe("ModelingActionsPanel", () => {
  it("renders sketch entity controls without sketch-opening shortcuts", () => {
    const rectangle: SketchSnapshot["entities"][number] = {
      id: "rect_1",
      kind: "rectangle",
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
        context
      })
    );

    expect(markup).toContain("Rectangle in Sketch 1");
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
    expect(markup).toContain("Source sketch");
    expect(markup).toContain("Source profile");
    expect(markup).toContain("Delete feature");
    expect(markup).toContain("Sketch on face");
    expect(markup).not.toContain("feat_rect");
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
      faces: [
        createFace({ label: "Start cap", role: "startCap" }),
        createFace({
          stableId: "generated:face:body_rect:endCap",
          label: "End cap",
          role: "endCap"
        })
      ],
      edgeCount: 0,
      edges: [],
      vertexCount: 0,
      vertices: []
    };
    const context = {
      selectionKind: "body" as const,
      body,
      feature,
      generatedReferences
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

  it("defaults circle profiles with eligible targets to hole creation", () => {
    const circle: SketchSnapshot["entities"][number] = {
      id: "circle_1",
      kind: "circle",
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

  it("explains selected sketch lines as revolve axis candidates", () => {
    const line: SketchSnapshot["entities"][number] = {
      id: "line_axis",
      kind: "line",
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
    expect(markup).toContain("Reference contract");
    expect(markup).toContain("Command-ready reference");
    expect(markup).toContain("Back to body");
    expect(markup).toContain("Create sketch on face");
    expect(markup).not.toContain("generated:face:body_rect:startCap");
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
    expect(markup).toContain("Body body_rect was consumed by feat_cut.");
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
    expect(markup).toContain("Reference contract");
    expect(markup).toContain("Command-ready reference");
    expect(markup).toContain("Edge finish");
    expect(markup).toContain("Chamfer");
    expect(markup).toContain("Fillet");
    expect(markup).toContain("Create chamfer");
    expect(markup).not.toContain("generated:edge:body_rect:start:uMin");
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
  attachment?: SketchSnapshot["attachment"]
): SketchSnapshot {
  return {
    id,
    name,
    plane: "XY",
    entities,
    ...(attachment ? { attachment } : {})
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
