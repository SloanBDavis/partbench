import type {
  BodyGeneratedReferencesQueryResponse,
  CadGeneratedFaceReference,
  SelectionReferenceCandidatesQueryResponse
} from "@web-cad/cad-protocol";
import { describe, expect, it } from "vitest";
import { createViewportReferenceActions } from "./viewportReferenceActions";

describe("viewport reference actions", () => {
  it("creates compact actions from query-derived reference candidates", () => {
    const face = createFaceReference();
    const actions = createViewportReferenceActions({
      references: createReferences(face),
      candidatesByStableId: new Map([
        [face.stableId, createCandidateResponse(face)]
      ]),
      selectedGeneratedReference: {
        bodyId: face.bodyId,
        stableId: face.stableId,
        kind: face.kind
      }
    });

    expect(actions).toMatchObject([
      {
        reference: face,
        label: "Start cap",
        kindLabel: "Face",
        commandable: true,
        selected: true,
        commandOperationLabels: ["Name reference", "Create sketch on face"],
        diagnostic: undefined
      }
    ]);
  });

  it("shows commandability and the first structured diagnostic for blocked candidates", () => {
    const face = createFaceReference();
    const actions = createViewportReferenceActions({
      references: createReferences(face),
      candidatesByStableId: new Map([
        [
          face.stableId,
          createCandidateResponse(face, {
            commandable: false,
            issueMessage:
              "Selected body body_rect is consumed by feature feat_cut."
          })
        ]
      ])
    });

    expect(actions).toMatchObject([
      {
        commandable: false,
        selected: false,
        diagnostic: {
          code: "CONSUMED_SELECTION_BODY",
          status: "consumed",
          message: "Selected body body_rect is consumed by feature feat_cut."
        }
      }
    ]);
  });

  it("does not expose raw mesh OCCT or selection-buffer IDs in visible action fields", () => {
    const face = createFaceReference({
      stableId: "selection-buffer:face:17"
    });
    const actions = createViewportReferenceActions({
      references: createReferences(face),
      candidatesByStableId: new Map([
        [face.stableId, createCandidateResponse(face)]
      ])
    });
    const visibleText = actions
      .flatMap((action) => [
        action.label,
        action.kindLabel,
        ...action.commandOperationLabels,
        action.diagnostic?.message
      ])
      .join(" ");

    expect(actions[0]?.id).not.toContain("selection-buffer");
    expect(visibleText).not.toContain("selection-buffer");
    expect(visibleText).not.toContain("occt-shape");
    expect(visibleText).not.toContain("mesh-triangle");
  });
});

function createReferences(
  face: CadGeneratedFaceReference
): BodyGeneratedReferencesQueryResponse {
  return {
    ok: true,
    query: "body.generatedReferences",
    cadOpsVersion: "cadops.v1",
    body: {
      kind: "body",
      stableId: "generated:body:body_rect",
      label: "Body",
      bodyId: "body_rect",
      ownerPartId: "part:default",
      sourceFeatureId: "feat_rect",
      sourceSketchId: "sketch_1",
      sourceSketchEntityId: "rect_1",
      profileKind: "rectangle",
      eligibleOperations: ["feature.selectReference"],
      geometricSignature: {
        profileKind: "rectangle",
        sketchPlane: "XY",
        extrudeSide: "positive",
        depth: 2
      }
    },
    faceCount: 1,
    faces: [face],
    edgeCount: 0,
    edges: [],
    vertexCount: 0,
    vertices: []
  };
}

function createCandidateResponse(
  reference: CadGeneratedFaceReference,
  overrides: {
    readonly commandable?: boolean;
    readonly issueMessage?: string;
  } = {}
): SelectionReferenceCandidatesQueryResponse {
  const issue = overrides.issueMessage
    ? {
        code: "CONSUMED_SELECTION_BODY" as const,
        status: "consumed" as const,
        message: overrides.issueMessage,
        bodyId: reference.bodyId,
        featureId: "feat_cut"
      }
    : undefined;

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
    status: issue ? "consumed" : "resolved",
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
        commandOperations: issue
          ? []
          : ["reference.nameGenerated", "feature.attachSketchPlane"],
        label: reference.label,
        issues: issue ? [issue] : []
      }
    ],
    issueCount: issue ? 1 : 0,
    issues: issue ? [issue] : []
  };
}

function createFaceReference(
  overrides: { readonly stableId?: string } = {}
): CadGeneratedFaceReference {
  return {
    kind: "face",
    stableId: overrides.stableId ?? "generated:face:body_rect:startCap",
    label: "Start cap",
    bodyId: "body_rect",
    ownerPartId: "part:default",
    sourceFeatureId: "feat_rect",
    sourceSketchId: "sketch_1",
    sourceSketchEntityId: "rect_1",
    role: "startCap",
    eligibleOperations: ["feature.attachSketchPlane"],
    geometricSignature: {
      profileKind: "rectangle",
      sketchPlane: "XY",
      extrudeSide: "positive",
      depth: 2,
      surfaceType: "plane"
    }
  };
}
