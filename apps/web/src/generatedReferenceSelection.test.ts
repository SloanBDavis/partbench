import { CadEngine, exportCadProjectJson } from "@web-cad/cad-core";
import type {
  BodyGeneratedReferencesQueryResponse,
  CadGeneratedReference,
  GeneratedReferenceMeasurement,
  SelectionReferenceCandidatesQueryResponse
} from "@web-cad/cad-protocol";
import { describe, expect, it } from "vitest";
import {
  createSelectionReferenceCandidateSummaries,
  createSelectedGeneratedReference,
  formatSelectionReferenceStatus,
  getPrimarySelectionReferenceCandidate,
  getGeneratedReferenceSelectionState,
  isSelectedGeneratedReference,
  reconcileSelectedGeneratedReferenceBody
} from "./generatedReferenceSelection";

describe("generated reference selection helpers", () => {
  it("creates and resolves selected reference state with measurements", () => {
    const references = createReferences();
    const selection = createSelectedGeneratedReference(references.faces[0]);
    const measurement: GeneratedReferenceMeasurement = {
      kind: "face",
      stableId: "generated:face:body_1:startCap",
      bodyId: "body_1",
      sourceFeatureId: "feat_1",
      sourceSketchId: "sketch_1",
      sourceSketchEntityId: "rect_1",
      profileKind: "rectangle",
      units: "mm",
      measurementModel: "sourceAnalytic",
      role: "startCap",
      area: 8,
      bounds: {
        min: [-2, -1, 0],
        max: [2, 1, 0],
        size: [4, 2, 0],
        center: [0, 0, 0]
      },
      center: [0, 0, 0],
      surfaceType: "plane",
      normal: [0, 0, 1],
      normalRole: "startCap"
    };

    const state = getGeneratedReferenceSelectionState(
      selection,
      references,
      new Map([[measurement.stableId, { measurement }]]),
      "mm"
    );

    expect(state).toMatchObject({
      status: "selected",
      selection,
      reference: { stableId: "generated:face:body_1:startCap" },
      measurementRows: [
        { label: "Area", value: "8 mm^2" },
        {
          label: "Bounds",
          value:
            "min -2 mm, -1 mm, 0 mm; max 2 mm, 1 mm, 0 mm; size 4 mm, 2 mm, 0 mm"
        },
        { label: "Center", value: "0 mm, 0 mm, 0 mm" },
        { label: "Surface", value: "plane" },
        { label: "Normal", value: "0, 0, 1" },
        { label: "Normal role", value: "startCap" }
      ]
    });
    expect(isSelectedGeneratedReference(selection, references.faces[0])).toBe(
      true
    );
  });

  it("marks selections stale when references no longer contain the stable ID", () => {
    const references = createReferences();
    const selection = {
      bodyId: "body_1",
      stableId: "generated:vertex:body_1:start:uMin:vMin",
      kind: "vertex" as const
    };

    expect(
      getGeneratedReferenceSelectionState(
        selection,
        references,
        undefined,
        "mm"
      )
    ).toEqual({
      status: "stale",
      selection,
      message:
        "Selected vertex reference generated:vertex:body_1:start:uMin:vMin is no longer available on body_1."
    });
  });

  it("clears selections when their body is removed", () => {
    const selection = {
      bodyId: "body_1",
      stableId: "generated:body:body_1",
      kind: "body" as const
    };

    expect(
      reconcileSelectedGeneratedReferenceBody(selection, [{ id: "body_1" }])
    ).toEqual(selection);
    expect(
      reconcileSelectedGeneratedReferenceBody(selection, [])
    ).toBeUndefined();
  });

  it("keeps UI reference selection out of project JSON", () => {
    const engine = new CadEngine();
    const selection = {
      bodyId: "body_rect_1",
      stableId: "generated:face:body_rect_1:startCap",
      kind: "face" as const
    };

    engine.applyBatch([
      { op: "sketch.create", id: "sketch_1", name: "Profile", plane: "XY" },
      {
        op: "sketch.addRectangle",
        sketchId: "sketch_1",
        id: "rect_1",
        center: [0, 0],
        width: 4,
        height: 2
      },
      {
        op: "feature.extrude",
        id: "feat_rect_1",
        bodyId: "body_rect_1",
        sketchId: "sketch_1",
        entityId: "rect_1",
        depth: 3
      }
    ]);

    const project = JSON.parse(exportCadProjectJson(engine)) as Record<
      string,
      unknown
    >;

    expect(project).not.toHaveProperty("selectedGeneratedReference");
    expect(JSON.stringify(project)).not.toContain(selection.stableId);
  });

  it("summarizes V7 selection reference candidate query responses", () => {
    const references = createReferences();
    const response: SelectionReferenceCandidatesQueryResponse = {
      ok: true,
      query: "selection.referenceCandidates",
      cadOpsVersion: "cadops.v1",
      selection: {
        type: "generatedReference",
        bodyId: "body_1",
        stableId: references.faces[0].stableId,
        expectedKind: "face"
      },
      requiredOperation: "feature.attachSketchPlane",
      status: "resolved",
      candidateCount: 1,
      candidates: [
        {
          source: "generatedReferenceSelection",
          target: {
            type: "generatedReference",
            bodyId: "body_1",
            stableId: references.faces[0].stableId,
            kind: "face"
          },
          reference: references.faces[0],
          commandable: true,
          commandOperations: [
            "reference.nameGenerated",
            "feature.attachSketchPlane",
            "feature.measureReference",
            "feature.selectReference"
          ],
          label: references.faces[0].label,
          description: references.faces[0].description,
          issues: []
        }
      ],
      issueCount: 0,
      issues: []
    };

    expect(getPrimarySelectionReferenceCandidate(response)).toEqual(
      response.candidates[0]
    );
    expect(createSelectionReferenceCandidateSummaries(response)).toEqual([
      {
        tone: "ready",
        title: "Face: Start cap",
        detail: "4 command-ready operations",
        stableId: "generated:face:body_1:startCap",
        commandOperations: [
          "reference.nameGenerated",
          "feature.attachSketchPlane",
          "feature.measureReference",
          "feature.selectReference"
        ],
        issues: []
      }
    ]);
  });

  it("summarizes blocked V7 selection reference diagnostics", () => {
    const response: SelectionReferenceCandidatesQueryResponse = {
      ok: true,
      query: "selection.referenceCandidates",
      cadOpsVersion: "cadops.v1",
      selection: { type: "body", bodyId: "body_cut" },
      status: "ambiguous",
      candidateCount: 0,
      candidates: [],
      issueCount: 1,
      issues: [
        {
          code: "AMBIGUOUS_SELECTION_TOPOLOGY",
          status: "ambiguous",
          message:
            "Boolean result body body_cut does not yet have stable command-ready generated topology.",
          bodyId: "body_cut",
          featureId: "feat_cut"
        }
      ]
    };

    expect(formatSelectionReferenceStatus(response.status)).toBe(
      "Selection topology ambiguous"
    );
    expect(createSelectionReferenceCandidateSummaries(response)).toEqual([
      {
        tone: "blocked",
        title: "Selection topology ambiguous",
        detail:
          "Boolean result body body_cut does not yet have stable command-ready generated topology.",
        commandOperations: [],
        issues: [
          "Boolean result body body_cut does not yet have stable command-ready generated topology."
        ]
      }
    ]);
  });
});

function createReferences(): BodyGeneratedReferencesQueryResponse {
  const body: CadGeneratedReference = {
    kind: "body",
    stableId: "generated:body:body_1",
    label: "Rectangle extrude body",
    description: "Body description",
    eligibleOperations: ["feature.measureReference", "feature.selectReference"],
    bodyId: "body_1",
    ownerPartId: "part:default",
    sourceFeatureId: "feat_1",
    sourceSketchId: "sketch_1",
    sourceSketchEntityId: "rect_1",
    profileKind: "rectangle",
    geometricSignature: {
      profileKind: "rectangle",
      sketchPlane: "XY",
      extrudeSide: "positive",
      depth: 2
    }
  };
  const face: CadGeneratedReference = {
    kind: "face",
    stableId: "generated:face:body_1:startCap",
    label: "Start cap",
    description: "Start cap description",
    eligibleOperations: [
      "feature.attachSketchPlane",
      "feature.measureReference",
      "feature.selectReference"
    ],
    bodyId: "body_1",
    ownerPartId: "part:default",
    sourceFeatureId: "feat_1",
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

  return {
    ok: true,
    query: "body.generatedReferences",
    cadOpsVersion: "cadops.v1",
    body,
    faceCount: 1,
    faces: [face],
    edgeCount: 0,
    edges: [],
    vertexCount: 0,
    vertices: []
  };
}
