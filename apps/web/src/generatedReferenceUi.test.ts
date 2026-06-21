import { describe, expect, it } from "vitest";
import type {
  BodyGeneratedReferencesQueryResponse,
  CadGeneratedAxisReference,
  CadGeneratedEdgeReference,
  CadGeneratedFaceReference,
  CadGeneratedReference,
  CadGeneratedVertexReference,
  GeneratedReferenceMeasurement,
  NamedGeneratedReferenceEntry
} from "@web-cad/cad-protocol";
import {
  buildSketchOnFaceForm,
  canCreateSketchOnFace,
  createGeneratedReferenceActionStatuses,
  createGeneratedReferenceDetailRows,
  createGeneratedReferenceMeasurementRows,
  createSketchOnFaceDefaultName,
  formatGeneratedReferenceActionStatus,
  formatGeneratedReferenceCount,
  formatGeneratedFaceEligibility,
  formatGeneratedReferenceKind,
  formatGeneratedReferenceMeasurementError,
  formatGeneratedReferenceOperationLabels,
  formatGeneratedReferencesError,
  formatNamedReferenceStatus,
  formatNamedReferenceTarget,
  formatSketchOnFaceAvailability,
  formatSketchAttachmentLabel,
  getGeneratedReferenceGroups,
  getGeneratedReferenceItems,
  getNamedReferencesForGeneratedReference,
  getSketchAttachableFaces
} from "./generatedReferenceUi";

const startCap = createFace({
  role: "startCap",
  stableId: "generated:face:body_1:startCap",
  label: "Start cap",
  eligibleOperations: [
    "feature.attachSketchPlane",
    "feature.measureReference",
    "feature.selectReference"
  ]
});

const circularSide = createFace({
  role: "side:circular",
  stableId: "generated:face:body_1:side:circular",
  label: "Circular side face",
  eligibleOperations: ["feature.measureReference", "feature.selectReference"],
  eligibilityNotes: [
    "Circular side faces are not planar and are not eligible for sketch-plane attachment."
  ]
});

describe("generated reference UI helpers", () => {
  it("filters only faces eligible for sketch-plane attachment", () => {
    expect(canCreateSketchOnFace(startCap)).toBe(true);
    expect(canCreateSketchOnFace(circularSide)).toBe(false);
    expect(getSketchAttachableFaces([startCap, circularSide])).toEqual([
      startCap
    ]);
  });

  it("formats generated face labels and eligibility text", () => {
    expect(createSketchOnFaceDefaultName(startCap)).toBe("Start cap sketch");
    expect(formatGeneratedFaceEligibility(startCap)).toBe("Sketch plane");
    expect(formatSketchOnFaceAvailability(startCap)).toBe(
      "Planar face available for attached sketches"
    );
    expect(formatGeneratedFaceEligibility(circularSide)).toBe(
      "Circular side faces are not planar and are not eligible for sketch-plane attachment."
    );
    expect(formatSketchOnFaceAvailability(circularSide)).toBe(
      "Circular side faces are not planar and are not eligible for sketch-plane attachment."
    );
  });

  it("builds sketch create-on-face forms only for eligible faces", () => {
    expect(
      buildSketchOnFaceForm("body_1", startCap, {
        id: " sketch_face_1 ",
        name: " End cap sketch "
      })
    ).toEqual({
      id: " sketch_face_1 ",
      name: "End cap sketch",
      bodyId: "body_1",
      faceStableId: "generated:face:body_1:startCap"
    });
    expect(
      buildSketchOnFaceForm("body_1", circularSide, {
        id: "",
        name: "Circular sketch"
      })
    ).toBeUndefined();
    expect(
      buildSketchOnFaceForm("body_1", startCap, {
        id: "",
        name: "   "
      })
    ).toBeUndefined();
  });

  it("formats attached sketch metadata", () => {
    expect(
      formatSketchAttachmentLabel({
        kind: "generatedFace",
        bodyId: "body_1",
        faceStableId: "generated:face:body_1:endCap",
        sourceFeatureId: "feat_1",
        sourceSketchId: "sketch_1",
        sourceSketchEntityId: "rect_1",
        faceRole: "endCap"
      })
    ).toBe("endCap on body_1");
  });

  it("collects and labels generated reference items", () => {
    const references = createReferences({ faces: [startCap] });

    expect(
      getGeneratedReferenceItems(references).map((item) => item.kind)
    ).toEqual(["body", "face"]);
    expect(formatGeneratedReferenceKind("edge")).toBe("Edge");
    expect(formatGeneratedReferenceOperationLabels(startCap)).toBe(
      "Sketch plane, Measure, Select"
    );
  });

  it("groups generated references by kind and omits empty groups", () => {
    const edge = createEdge();
    const references = createReferences({
      faces: [startCap, circularSide],
      edges: [edge],
      vertices: []
    });

    const groups = getGeneratedReferenceGroups(references);

    expect(groups.map((group) => group.label)).toEqual([
      "Body",
      "Faces",
      "Edges"
    ]);
    expect(groups.map((group) => group.countLabel)).toEqual([
      "1 body",
      "2 faces",
      "1 edge"
    ]);
    expect(groups.flatMap((group) => group.references)).toEqual([
      references.body,
      startCap,
      circularSide,
      edge
    ]);
    expect(formatGeneratedReferenceCount("vertex", 2)).toBe("2 vertices");
  });

  it("formats generated-reference action availability", () => {
    const edge = createEdge({
      eligibleOperations: ["feature.chamfer", "feature.selectReference"]
    });

    expect(createGeneratedReferenceActionStatuses(startCap)).toEqual([
      {
        id: "reference.name",
        label: "Name reference",
        available: true,
        status: "Available"
      },
      {
        id: "sketch.createOnFace",
        label: "Create sketch",
        available: true,
        status: "Planar face"
      }
    ]);
    expect(
      formatGeneratedReferenceActionStatus(
        createGeneratedReferenceActionStatuses(circularSide)[1]!
      )
    ).toBe(
      "Unavailable: Circular side faces are not planar and are not eligible for sketch-plane attachment."
    );
    expect(createGeneratedReferenceActionStatuses(edge)).toEqual([
      {
        id: "reference.name",
        label: "Name reference",
        available: true,
        status: "Available"
      },
      {
        id: "feature.chamfer",
        label: "Chamfer",
        available: true,
        status: "Eligible edge"
      }
    ]);

    expect(
      createGeneratedReferenceActionStatuses(
        createEdge({
          stableId: "generated:edge:body_1:longitudinal:uMin:vMin",
          label: "Cut wall profile edge uMin/vMin",
          role: "longitudinal:uMin:vMin",
          eligibleOperations: [
            "feature.measureReference",
            "feature.selectReference"
          ]
        })
      )
    ).toEqual([
      {
        id: "reference.name",
        label: "Name reference",
        available: true,
        status: "Available"
      }
    ]);
  });

  it("creates compact stable-ID detail rows", () => {
    const edge = createEdge();

    expect(createGeneratedReferenceDetailRows(edge)).toEqual([
      { label: "Stable ID", value: "generated:edge:body_1:start:uMin" },
      { label: "Body", value: "body_1" },
      { label: "Source feature", value: "feat_1" },
      { label: "Source sketch", value: "sketch_1" },
      { label: "Source entity", value: "rect_1" },
      { label: "Profile", value: "rectangle" },
      { label: "Role", value: "start:uMin" },
      { label: "Adjacent faces", value: "startCap, side:uMin" }
    ]);
  });

  it("formats generated reference measurement rows", () => {
    const faceMeasurement: GeneratedReferenceMeasurement = {
      kind: "face",
      stableId: "generated:face:body_1:endCap",
      bodyId: "body_1",
      sourceFeatureId: "feat_1",
      sourceSketchId: "sketch_1",
      sourceSketchEntityId: "rect_1",
      profileKind: "rectangle",
      units: "mm",
      measurementModel: "sourceAnalytic",
      role: "endCap",
      area: 6,
      bounds: {
        min: [-1, -1.5, 2],
        max: [1, 1.5, 2],
        size: [2, 3, 0],
        center: [0, 0, 2]
      },
      center: [0, 0, 2],
      surfaceType: "plane",
      normal: [0, 0, 1],
      normalRole: "endCap"
    };

    expect(
      createGeneratedReferenceMeasurementRows(faceMeasurement, "mm")
    ).toEqual([
      { label: "Area", value: "6 mm^2" },
      {
        label: "Bounds",
        value:
          "min -1 mm, -1.50 mm, 2 mm; max 1 mm, 1.50 mm, 2 mm; size 2 mm, 3 mm, 0 mm"
      },
      { label: "Center", value: "0 mm, 0 mm, 2 mm" },
      { label: "Surface", value: "plane" },
      { label: "Normal", value: "0, 0, 1" },
      { label: "Normal role", value: "endCap" }
    ]);
  });

  it("formats generated reference measurement errors", () => {
    expect(
      formatGeneratedReferenceMeasurementError({
        code: "GENERATED_REFERENCE_NOT_FOUND",
        message: "Reference not found.",
        bodyId: "body_1",
        stableId: "generated:face:body_1:missing"
      })
    ).toBe(
      "Reference measurements unavailable: generated:face:body_1:missing is missing or stale."
    );

    expect(
      formatGeneratedReferenceMeasurementError({
        code: "UNSUPPORTED_BODY_REFERENCES",
        message: "Unsupported body.",
        bodyId: "body:box_1"
      })
    ).toBe(
      "Reference measurements unavailable for body:box_1. Authored rectangle and circle extrude bodies are supported."
    );
  });

  it("formats generated reference query errors", () => {
    expect(
      formatGeneratedReferencesError({
        code: "BODY_NOT_FOUND",
        message: "Body not found.",
        bodyId: "body_missing"
      })
    ).toBe("Generated references unavailable: body_missing was not found.");
    expect(
      formatGeneratedReferencesError({
        code: "GENERATED_REFERENCE_NOT_FOUND",
        message: "Reference not found.",
        bodyId: "body_1",
        stableId: "generated:face:body_1:stale"
      })
    ).toBe(
      "Generated reference generated:face:body_1:stale is missing or stale."
    );
  });

  it("filters named references for the selected generated reference", () => {
    const selected = createNamedReference({
      name: "Front face",
      bodyId: "body_1",
      stableId: "generated:face:body_1:startCap",
      kind: "face",
      status: "resolved",
      reference: startCap
    });
    const sameTarget = createNamedReference({
      name: "A face",
      bodyId: "body_1",
      stableId: "generated:face:body_1:startCap",
      kind: "face",
      status: "resolved",
      reference: startCap
    });
    const other = createNamedReference({
      name: "Generated body",
      bodyId: "body_1",
      stableId: "generated:body:body_1",
      kind: "body",
      status: "stale"
    });

    expect(
      getNamedReferencesForGeneratedReference(
        [selected, other, sameTarget],
        startCap
      ).map((reference) => reference.name)
    ).toEqual(["A face", "Front face"]);
  });

  it("formats named reference targets and stale status", () => {
    const resolved = createNamedReference({
      name: "Front face",
      bodyId: "body_1",
      stableId: "generated:face:body_1:startCap",
      kind: "face",
      status: "resolved",
      reference: startCap
    });
    const stale = createNamedReference({
      name: "Old face",
      bodyId: "body_1",
      stableId: "generated:face:body_1:missing",
      kind: "face",
      status: "stale",
      error: {
        code: "GENERATED_REFERENCE_NOT_FOUND",
        message: "Generated reference does not exist.",
        bodyId: "body_1",
        stableId: "generated:face:body_1:missing"
      }
    });

    expect(formatNamedReferenceTarget(resolved)).toBe("Face / Start cap");
    expect(formatNamedReferenceStatus(resolved)).toEqual({
      tone: "resolved",
      text: "Resolved"
    });
    expect(formatNamedReferenceStatus(stale)).toEqual({
      tone: "stale",
      text: "Target reference generated:face:body_1:missing is stale or missing."
    });
  });
});

function createNamedReference(
  entry: NamedGeneratedReferenceEntry
): NamedGeneratedReferenceEntry {
  return entry;
}

function createFace(
  overrides: Pick<
    CadGeneratedFaceReference,
    "role" | "stableId" | "label" | "eligibleOperations" | "eligibilityNotes"
  >
): CadGeneratedFaceReference {
  return {
    kind: "face",
    bodyId: "body_1",
    ownerPartId: "part:default",
    sourceFeatureId: "feat_1",
    sourceSketchId: "sketch_1",
    sourceSketchEntityId: "rect_1",
    description: `${overrides.label} description`,
    geometricSignature: {
      profileKind: "rectangle",
      sketchPlane: "XY",
      extrudeSide: "positive",
      depth: 1
    },
    ...overrides
  };
}

function createReferences({
  faces = [],
  edges = [],
  vertices = [],
  axes = []
}: {
  readonly faces?: readonly CadGeneratedFaceReference[];
  readonly edges?: readonly CadGeneratedEdgeReference[];
  readonly vertices?: readonly CadGeneratedVertexReference[];
  readonly axes?: readonly CadGeneratedAxisReference[];
}): BodyGeneratedReferencesQueryResponse {
  return {
    ok: true,
    query: "body.generatedReferences",
    cadOpsVersion: "cadops.v1",
    body: {
      kind: "body",
      stableId: "generated:body:body_1",
      label: "Generated body",
      eligibleOperations: [
        "feature.measureReference",
        "feature.selectReference"
      ],
      bodyId: "body_1",
      ownerPartId: "part:default",
      sourceFeatureId: "feat_1",
      sourceSketchId: "sketch_1",
      sourceSketchEntityId: "rect_1",
      profileKind: "rectangle",
      geometricSignature: createSignature()
    },
    faceCount: faces.length,
    faces,
    edgeCount: edges.length,
    edges,
    vertexCount: vertices.length,
    vertices,
    axisCount: axes.length,
    axes
  };
}

function createEdge(
  overrides: Partial<CadGeneratedEdgeReference> = {}
): CadGeneratedEdgeReference {
  return {
    kind: "edge",
    bodyId: "body_1",
    ownerPartId: "part:default",
    sourceFeatureId: "feat_1",
    sourceSketchId: "sketch_1",
    sourceSketchEntityId: "rect_1",
    stableId: "generated:edge:body_1:start:uMin",
    label: "Start uMin edge",
    description: "Start cap uMin edge",
    eligibleOperations: [
      "feature.chamfer",
      "feature.fillet",
      "feature.measureReference",
      "feature.selectReference"
    ],
    role: "start:uMin",
    adjacentFaceRoles: ["startCap", "side:uMin"],
    geometricSignature: {
      ...createSignature(),
      curveType: "line"
    },
    ...overrides
  };
}

function createSignature(): CadGeneratedReference["geometricSignature"] {
  return {
    profileKind: "rectangle",
    sketchPlane: "XY",
    extrudeSide: "positive",
    depth: 1
  };
}
