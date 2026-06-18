import type { CadBodySnapshot, CadFeatureSummary } from "@web-cad/cad-core";
import type {
  BodyGeneratedReferencesQueryResponse,
  CadGeneratedReference,
  CadGeneratedEdgeReference,
  CadGeneratedFaceReference,
  CadReferenceHealthEntry,
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
        onUpdateExtrude: () => undefined
      })
    );

    expect(markup).toContain("Generated references");
    expect(markup).toContain("Faces");
    expect(markup).toContain("Edges");
    expect(markup).toContain("Sketch");
    expect(markup).toContain("Chamfer");
    expect(markup).toContain("Fillet");
    expect(markup).toContain("Name");
    expect(markup).toContain("Reference contract");
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
        onUpdateExtrude: () => undefined
      })
    );

    expect(markup).toContain("Selection body consumed");
    expect(markup).toContain("Body body_rect was consumed by feat_cut.");
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
        onUpdateExtrude: () => undefined
      })
    );

    expect(markup).toContain("Selected reference");
    expect(markup).toContain("Start uMin edge");
    expect(markup).toContain("Reference contract");
    expect(markup).toContain("Command-ready reference");
    expect(markup).toContain("Edge finish");
    expect(markup).toContain("Fillet");
    expect(markup).toContain("Create chamfer");
  });

  it("offers feature delete for non-extrude authored bodies", () => {
    const markup = renderToStaticMarkup(
      createElement(Inspector, {
        body: createHoleBody(),
        disabled: false,
        feature: createHoleFeature(),
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
        onUpdateExtrude: () => undefined
      })
    );

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
        onUpdateExtrude: () => undefined
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
