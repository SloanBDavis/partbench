import type { CadBodySnapshot, CadFeatureSummary } from "@web-cad/cad-core";
import type {
  BodyGeneratedReferencesQueryResponse,
  CadGeneratedAxisReference,
  CadGeneratedReference,
  CadGeneratedEdgeReference,
  CadGeneratedFaceReference,
  CadReferenceHealthEntry,
  FeatureEditabilityQueryResponse,
  NamedGeneratedReferenceEntry,
  SelectionReferenceCandidatesQueryResponse
} from "@web-cad/cad-protocol";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Inspector } from "./Inspector";

describe("Inspector", () => {
  it("renders generated references as grouped actionable cards", () => {
    const face = createFace();
    const edge = createEdge();
    const faceCandidates = createSelectionReferenceCandidates(face);
    const edgeCandidates = createSelectionReferenceCandidates(edge);
    const markup = renderToStaticMarkup(
      createElement(Inspector, {
        body: createBody(),
        disabled: false,
        feature: createFeature(),
        generatedReferences: createGeneratedReferences(face, edge),
        namedReferences: [],
        referenceCandidatesByStableId: new Map([
          [face.stableId, faceCandidates],
          [edge.stableId, edgeCandidates]
        ]),
        selectedGeneratedReference: {
          bodyId: "body_rect",
          stableId: face.stableId,
          kind: "face"
        },
        selectionReferenceCandidates: faceCandidates,
        units: "mm",
        onApplyDimensions: () => undefined,
        onApplyName: () => undefined,
        onApplyTransform: () => undefined,
        onCreateSketchOnFace: () => undefined,
        onCreateEdgeFinish: () => undefined,
        onDeleteNamedReference: () => undefined,
        onNameGeneratedReference: () => undefined,
        onRepairNamedReference: () => undefined,
        onInspectNamedReference: () => undefined,
        onSelectGeneratedReference: () => undefined,
        onDelete: () => undefined,
        onDeleteFeature: () => undefined,
        onUpdateExtrude: () => undefined,
        onUpdateRevolve: () => undefined,
        onUpdateHole: () => undefined,
        onUpdateChamfer: () => undefined,
        onUpdateFillet: () => undefined
      })
    );

    expect(markup).toContain("Generated references");
    expect(markup).toContain("Faces");
    expect(markup).toContain("Edges");
    expect(markup).toContain("Sketch");
    expect(markup).toContain("Chamfer");
    expect(markup).toContain("Fillet");
    expect(markup).toContain("Name");
    expect(markup).toContain("Reference status");
    expect(markup).toContain("Command-ready reference");
    expect(markup).toContain("Stable ID and source");
    expect(markup).toContain("Selected reference");
    expect(markup).toContain('<optgroup label="Faces">');
  });

  it("renders structured candidate diagnostics for consumed selected references", () => {
    const face = createFace();
    const edge = createEdge();
    const consumedCandidates = createSelectionReferenceCandidates(face, {
      status: "consumed",
      commandable: false,
      commandOperations: [],
      message: "Body body_rect was consumed by feat_cut."
    });
    const markup = renderToStaticMarkup(
      createElement(Inspector, {
        body: createBody(),
        disabled: false,
        feature: createFeature(),
        generatedReferences: createGeneratedReferences(face, edge),
        namedReferences: [],
        referenceCandidatesByStableId: new Map([
          [face.stableId, consumedCandidates]
        ]),
        selectedGeneratedReference: {
          bodyId: "body_rect",
          stableId: face.stableId,
          kind: "face"
        },
        selectionReferenceCandidates: consumedCandidates,
        units: "mm",
        onApplyDimensions: () => undefined,
        onApplyName: () => undefined,
        onApplyTransform: () => undefined,
        onCreateSketchOnFace: () => undefined,
        onCreateEdgeFinish: () => undefined,
        onDeleteNamedReference: () => undefined,
        onNameGeneratedReference: () => undefined,
        onRepairNamedReference: () => undefined,
        onInspectNamedReference: () => undefined,
        onSelectGeneratedReference: () => undefined,
        onDelete: () => undefined,
        onDeleteFeature: () => undefined,
        onUpdateExtrude: () => undefined,
        onUpdateRevolve: () => undefined,
        onUpdateHole: () => undefined,
        onUpdateChamfer: () => undefined,
        onUpdateFillet: () => undefined
      })
    );

    expect(markup).toContain("Selection body consumed");
    expect(markup).toContain("Body body_rect was consumed by feat_cut.");
  });

  it("surfaces selected feature editability before body detail", () => {
    const feature = createFeature();
    const markup = renderToStaticMarkup(
      createElement(Inspector, {
        body: createBody(),
        disabled: false,
        feature,
        featureEditability: createFeatureEditability(feature, [
          {
            path: "depth",
            label: "Depth",
            valueType: "number",
            currentValue: feature.depth,
            unit: "mm",
            editable: true,
            commitOperation: "feature.updateExtrude",
            diagnostics: []
          },
          {
            path: "side",
            label: "Side",
            valueType: "enum",
            currentValue: feature.side,
            enumValues: ["positive", "negative", "symmetric"],
            editable: true,
            commitOperation: "feature.updateExtrude",
            diagnostics: []
          }
        ]),
        namedReferences: [],
        units: "mm",
        onApplyDimensions: () => undefined,
        onApplyName: () => undefined,
        onApplyTransform: () => undefined,
        onCreateSketchOnFace: () => undefined,
        onCreateEdgeFinish: () => undefined,
        onDeleteNamedReference: () => undefined,
        onNameGeneratedReference: () => undefined,
        onRepairNamedReference: () => undefined,
        onInspectNamedReference: () => undefined,
        onSelectGeneratedReference: () => undefined,
        onDelete: () => undefined,
        onDeleteFeature: () => undefined,
        onUpdateExtrude: () => undefined,
        onUpdateRevolve: () => undefined,
        onUpdateHole: () => undefined,
        onUpdateChamfer: () => undefined,
        onUpdateFillet: () => undefined
      })
    );

    expect(markup).toContain("Feature edits ready");
    expect(markup).toContain("Edit Depth and Side below");
    expect(markup.indexOf("Feature edits ready")).toBeLessThan(
      markup.indexOf("<dt>ID</dt>")
    );
  });

  it("surfaces non-editable feature diagnostics before disabled controls", () => {
    const feature = createFeature();
    const markup = renderToStaticMarkup(
      createElement(Inspector, {
        body: createBody(),
        disabled: false,
        feature,
        featureEditability: createFeatureEditability(feature, [], {
          status: "unsupported",
          diagnostic: "Boolean result topology cannot be edited safely."
        }),
        namedReferences: [],
        units: "mm",
        onApplyDimensions: () => undefined,
        onApplyName: () => undefined,
        onApplyTransform: () => undefined,
        onCreateSketchOnFace: () => undefined,
        onCreateEdgeFinish: () => undefined,
        onDeleteNamedReference: () => undefined,
        onNameGeneratedReference: () => undefined,
        onRepairNamedReference: () => undefined,
        onInspectNamedReference: () => undefined,
        onSelectGeneratedReference: () => undefined,
        onDelete: () => undefined,
        onDeleteFeature: () => undefined,
        onUpdateExtrude: () => undefined,
        onUpdateRevolve: () => undefined,
        onUpdateHole: () => undefined,
        onUpdateChamfer: () => undefined,
        onUpdateFillet: () => undefined
      })
    );

    expect(markup).toContain("Feature edit unavailable");
    expect(markup).toContain(
      "Boolean result topology cannot be edited safely."
    );
  });

  it("plumbs selected generated edges into inspector edge-finish affordances", () => {
    const face = createFace();
    const edge = createEdge();
    const edgeCandidates = createSelectionReferenceCandidates(edge);
    const markup = renderToStaticMarkup(
      createElement(Inspector, {
        body: createBody(),
        disabled: false,
        feature: createFeature(),
        generatedReferences: createGeneratedReferences(face, edge),
        namedReferences: [],
        referenceCandidatesByStableId: new Map([
          [edge.stableId, edgeCandidates]
        ]),
        selectedGeneratedReference: {
          bodyId: "body_rect",
          stableId: edge.stableId,
          kind: "edge"
        },
        selectionReferenceCandidates: edgeCandidates,
        units: "mm",
        onApplyDimensions: () => undefined,
        onApplyName: () => undefined,
        onApplyTransform: () => undefined,
        onCreateSketchOnFace: () => undefined,
        onCreateEdgeFinish: () => undefined,
        onDeleteNamedReference: () => undefined,
        onNameGeneratedReference: () => undefined,
        onRepairNamedReference: () => undefined,
        onInspectNamedReference: () => undefined,
        onSelectGeneratedReference: () => undefined,
        onDelete: () => undefined,
        onDeleteFeature: () => undefined,
        onUpdateExtrude: () => undefined,
        onUpdateRevolve: () => undefined,
        onUpdateHole: () => undefined,
        onUpdateChamfer: () => undefined,
        onUpdateFillet: () => undefined
      })
    );

    expect(markup).toContain("Selected reference");
    expect(markup).toContain("Start uMin edge");
    expect(markup).toContain("Reference status");
    expect(markup).toContain("Command-ready reference");
    expect(markup).toContain("Edge finish");
    expect(markup).toContain("Fillet");
    expect(markup).toContain("Create chamfer");
  });

  it("renders generated references for non-extrude authored bodies", () => {
    const holeFeature = createHoleFeature();
    const markup = renderToStaticMarkup(
      createElement(Inspector, {
        body: createHoleBody(),
        disabled: false,
        feature: holeFeature,
        featureEditability: createFeatureEditability(holeFeature, [
          {
            path: "depthMode",
            label: "Depth mode",
            valueType: "enum",
            currentValue: "throughAll",
            enumValues: ["blind", "throughAll"],
            editable: true,
            commitOperation: "feature.updateHole",
            diagnostics: []
          }
        ]),
        generatedReferences: createHoleGeneratedReferences(),
        namedReferences: [],
        referenceCandidatesByStableId: new Map(),
        units: "mm",
        onApplyDimensions: () => undefined,
        onApplyName: () => undefined,
        onApplyTransform: () => undefined,
        onCreateSketchOnFace: () => undefined,
        onCreateEdgeFinish: () => undefined,
        onDeleteNamedReference: () => undefined,
        onNameGeneratedReference: () => undefined,
        onRepairNamedReference: () => undefined,
        onInspectNamedReference: () => undefined,
        onSelectGeneratedReference: () => undefined,
        onDelete: () => undefined,
        onDeleteFeature: () => undefined,
        onUpdateExtrude: () => undefined,
        onUpdateRevolve: () => undefined,
        onUpdateHole: () => undefined,
        onUpdateChamfer: () => undefined,
        onUpdateFillet: () => undefined
      })
    );

    expect(markup).toContain("Hole feature");
    expect(markup).toContain("Generated references");
    expect(markup).toContain("Hole wall face");
    expect(markup).toContain("Hole start rim edge");
    expect(markup).toContain("Hole axis");
    expect(markup).toContain('<optgroup label="Faces">');
    expect(markup).toContain('<optgroup label="Edges">');
    expect(markup).toContain('<optgroup label="Axes">');
    expect(markup).not.toContain(
      "Generated references are unavailable for the selected body."
    );
  });

  it("offers feature delete for non-extrude authored bodies", () => {
    const holeFeature = createHoleFeature();
    const markup = renderToStaticMarkup(
      createElement(Inspector, {
        body: createHoleBody(),
        disabled: false,
        feature: holeFeature,
        featureEditability: createFeatureEditability(holeFeature, [
          {
            path: "depthMode",
            label: "Depth mode",
            valueType: "enum",
            currentValue: "blind",
            enumValues: ["blind", "throughAll"],
            editable: true,
            commitOperation: "feature.updateHole",
            diagnostics: []
          },
          {
            path: "depth",
            label: "Depth",
            valueType: "number",
            currentValue: 1,
            unit: "mm",
            editable: true,
            commitOperation: "feature.updateHole",
            diagnostics: []
          },
          {
            path: "direction",
            label: "Direction",
            valueType: "enum",
            currentValue: "negative",
            enumValues: ["positive", "negative"],
            editable: true,
            commitOperation: "feature.updateHole",
            diagnostics: []
          }
        ]),
        namedReferences: [],
        units: "mm",
        onApplyDimensions: () => undefined,
        onApplyName: () => undefined,
        onApplyTransform: () => undefined,
        onCreateSketchOnFace: () => undefined,
        onCreateEdgeFinish: () => undefined,
        onDeleteNamedReference: () => undefined,
        onNameGeneratedReference: () => undefined,
        onRepairNamedReference: () => undefined,
        onInspectNamedReference: () => undefined,
        onSelectGeneratedReference: () => undefined,
        onDelete: () => undefined,
        onDeleteFeature: () => undefined,
        onUpdateExtrude: () => undefined,
        onUpdateRevolve: () => undefined,
        onUpdateHole: () => undefined,
        onUpdateChamfer: () => undefined,
        onUpdateFillet: () => undefined
      })
    );

    expect(markup).toContain("Hole feature");
    expect(markup).toContain("Depth mode");
    expect(markup).toContain("Apply hole");
    expect(markup).toContain("Delete feature");
  });

  it("shows query-proven repair action for selected stale named references", () => {
    const face = createFace();
    const edge = createEdge();
    const faceCandidates = createSelectionReferenceCandidates(face);
    const staleReference: NamedGeneratedReferenceEntry = {
      name: "Top face",
      kind: "face",
      bodyId: "body_old",
      stableId: "generated:face:body_old:startCap",
      status: "stale"
    };
    const markup = renderToStaticMarkup(
      createElement(Inspector, {
        body: createBody(),
        disabled: false,
        feature: createFeature(),
        generatedReferences: createGeneratedReferences(face, edge),
        namedReferences: [staleReference],
        namedReferenceHealthByName: new Map([
          ["Top face", createNamedReferenceHealth(staleReference)]
        ]),
        referenceCandidatesByStableId: new Map([
          [face.stableId, faceCandidates]
        ]),
        selectedGeneratedReference: {
          bodyId: face.bodyId,
          stableId: face.stableId,
          kind: face.kind
        },
        selectedNamedReferenceName: "Top face",
        selectionReferenceCandidates: faceCandidates,
        units: "mm",
        onApplyDimensions: () => undefined,
        onApplyName: () => undefined,
        onApplyTransform: () => undefined,
        onCreateSketchOnFace: () => undefined,
        onCreateEdgeFinish: () => undefined,
        onDeleteNamedReference: () => undefined,
        onNameGeneratedReference: () => undefined,
        onRepairNamedReference: () => undefined,
        onInspectNamedReference: () => undefined,
        onSelectGeneratedReference: () => undefined,
        onDelete: () => undefined,
        onDeleteFeature: () => undefined,
        onUpdateExtrude: () => undefined,
        onUpdateRevolve: () => undefined,
        onUpdateHole: () => undefined,
        onUpdateChamfer: () => undefined,
        onUpdateFillet: () => undefined
      })
    );

    expect(markup).toContain("Repair Top face");
    expect(markup).toContain("Repair needed");
    expect(markup).toContain("Repair name");
    expect(markup).toContain("Named reference needs a new target.");
  });
});

function createBody(): CadBodySnapshot {
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
    }
  };
}

function createFeature(): Extract<
  CadFeatureSummary,
  { readonly kind: "extrude" }
> {
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
    }
  };
}

function createHoleBody(): CadBodySnapshot {
  return {
    id: "body_hole",
    kind: "solid",
    partId: "part:default",
    featureId: "feat_hole",
    source: {
      type: "sketchHoleFeature",
      featureId: "feat_hole",
      sketchId: "sketch_1",
      circleEntityId: "circle_1",
      targetBodyId: "body_rect"
    }
  };
}

function createHoleFeature(): Extract<
  CadFeatureSummary,
  { readonly kind: "hole" }
> {
  return {
    id: "feat_hole",
    kind: "hole",
    partId: "part:default",
    bodyId: "body_hole",
    targetBodyId: "body_rect",
    sketchId: "sketch_1",
    circleEntityId: "circle_1",
    depthMode: "throughAll",
    direction: "positive",
    source: {
      type: "sketchCircleHole",
      sketchId: "sketch_1",
      circleEntityId: "circle_1",
      targetBodyId: "body_rect"
    }
  };
}

function createFeatureEditability(
  feature: CadFeatureSummary,
  fields: FeatureEditabilityQueryResponse["fields"],
  overrides: {
    readonly status?: FeatureEditabilityQueryResponse["status"];
    readonly diagnostic?: string;
  } = {}
): FeatureEditabilityQueryResponse {
  const status = overrides.status ?? "editable";
  const diagnostic = overrides.diagnostic
    ? {
        code: "FEATURE_EDIT_UNSUPPORTED" as const,
        severity: "blocker" as const,
        message: overrides.diagnostic,
        featureId: feature.id
      }
    : undefined;

  return {
    ok: true,
    query: "feature.editability",
    cadOpsVersion: "cadops.v1",
    featureId: feature.id,
    status,
    feature,
    fieldCount: fields.length,
    fields,
    rebuildReadiness: {
      status: status === "editable" ? "ready" : "blocked",
      commitDeferred: false,
      diagnosticCount: diagnostic ? 1 : 0,
      diagnostics: diagnostic ? [diagnostic] : []
    },
    dryRun: {
      status: "not-requested",
      willMutateDocument: false,
      diagnosticCount: 0,
      diagnostics: []
    },
    affected: {
      sketchIds: [],
      featureIds: [feature.id],
      bodyIds: [feature.bodyId],
      generatedReferenceCount: 0,
      namedReferenceCount: 0
    },
    referenceChangeCount: 0,
    referenceChanges: [],
    diagnosticCount: diagnostic ? 1 : 0,
    diagnostics: diagnostic ? [diagnostic] : [],
    sourceBoundaryNote: "test source boundary",
    derivedBoundaryNote: "test derived boundary",
    requiresProjectSchemaMigration: false
  };
}

function createGeneratedReferences(
  face: CadGeneratedFaceReference,
  edge: CadGeneratedEdgeReference
): BodyGeneratedReferencesQueryResponse {
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
      geometricSignature: createSignature()
    },
    faceCount: 1,
    faces: [face],
    edgeCount: 1,
    edges: [edge],
    vertexCount: 0,
    vertices: [],
    axisCount: 0,
    axes: []
  };
}

function createHoleGeneratedReferences(): BodyGeneratedReferencesQueryResponse {
  const face: CadGeneratedFaceReference = {
    kind: "face",
    stableId: "generated:face:body_hole:holeWall",
    label: "Hole wall face",
    description: "Hole wall",
    eligibleOperations: ["feature.selectReference"],
    bodyId: "body_hole",
    ownerPartId: "part:default",
    sourceFeatureId: "feat_hole",
    sourceSketchId: "sketch_1",
    sourceSketchEntityId: "circle_1",
    role: "holeWall",
    geometricSignature: {
      sourceKind: "hole",
      profileKind: "circle",
      sketchPlane: "XY",
      surfaceType: "cylinder",
      axis: [0, 0, 1],
      axisRole: "holeDirection"
    }
  };
  const edge: CadGeneratedEdgeReference = {
    kind: "edge",
    stableId: "generated:edge:body_hole:startRim",
    label: "Hole start rim edge",
    description: "Hole start rim",
    eligibleOperations: ["feature.selectReference"],
    bodyId: "body_hole",
    ownerPartId: "part:default",
    sourceFeatureId: "feat_hole",
    sourceSketchId: "sketch_1",
    sourceSketchEntityId: "circle_1",
    role: "startRim",
    adjacentFaceRoles: ["holeWall"],
    geometricSignature: {
      sourceKind: "hole",
      profileKind: "circle",
      sketchPlane: "XY",
      curveType: "circle",
      positionRole: "startRim"
    }
  };
  const axis: CadGeneratedAxisReference = {
    kind: "axis",
    stableId: "generated:axis:body_hole:holeAxis",
    label: "Hole axis",
    description: "Hole center axis",
    eligibleOperations: ["feature.selectReference"],
    bodyId: "body_hole",
    ownerPartId: "part:default",
    sourceFeatureId: "feat_hole",
    sourceSketchId: "sketch_1",
    sourceSketchEntityId: "circle_1",
    role: "holeAxis",
    geometricSignature: {
      sourceKind: "hole",
      profileKind: "circle",
      sketchPlane: "XY",
      axis: [0, 0, 1],
      axisRole: "holeAxis",
      positionRole: "holeCenter"
    }
  };

  return {
    ok: true,
    query: "body.generatedReferences",
    cadOpsVersion: "cadops.v1",
    body: {
      kind: "body",
      stableId: "generated:body:body_hole",
      label: "Generated body",
      eligibleOperations: [
        "feature.measureReference",
        "feature.selectReference"
      ],
      bodyId: "body_hole",
      ownerPartId: "part:default",
      sourceFeatureId: "feat_hole",
      sourceSketchId: "sketch_1",
      sourceSketchEntityId: "circle_1",
      profileKind: "circle",
      geometricSignature: {
        sourceKind: "hole",
        profileKind: "circle",
        sketchPlane: "XY",
        profile: {
          kind: "circle",
          center: [0, 0],
          radius: 0.5
        },
        axis: [0, 0, 1],
        axisRole: "holeDirection"
      }
    },
    faceCount: 1,
    faces: [face],
    edgeCount: 1,
    edges: [edge],
    vertexCount: 0,
    vertices: [],
    axisCount: 1,
    axes: [axis]
  };
}

function createFace(): CadGeneratedFaceReference {
  return {
    kind: "face",
    stableId: "generated:face:body_rect:startCap",
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
      ...createSignature(),
      surfaceType: "plane"
    }
  };
}

function createEdge(): CadGeneratedEdgeReference {
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
      ...createSignature(),
      curveType: "line"
    }
  };
}

function createSignature() {
  return {
    profileKind: "rectangle" as const,
    sketchPlane: "XY" as const,
    extrudeSide: "positive" as const,
    depth: 2
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
