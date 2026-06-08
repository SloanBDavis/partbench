import type { SceneObject } from "@web-cad/cad-core";
import type {
  CadBodySnapshot,
  CadGeneratedFaceReference,
  CadSelectionReferenceIssue,
  SelectionReferenceCandidatesQueryResponse
} from "@web-cad/cad-protocol";
import { describe, expect, it } from "vitest";
import { resolveViewportPickIntent } from "./viewportPickIntent";

describe("viewport pick intent", () => {
  it("resolves authored body render IDs to semantic body selection intent", () => {
    const body = createExtrudeBody("body_rect");
    const response = createCandidateResponse({
      bodyId: body.id,
      status: "resolved"
    });
    const intent = resolveViewportPickIntent({
      pickedRenderId: body.id,
      bodies: [body],
      objects: [],
      readReferenceCandidates: (selection) => {
        expect(selection).toEqual({ type: "body", bodyId: body.id });
        return response;
      }
    });

    expect(intent).toMatchObject({
      kind: "body",
      selectedId: "body_rect",
      renderTargetId: "body_rect",
      semanticSelection: { type: "body", bodyId: "body_rect" },
      referenceCandidates: response,
      issues: []
    });
  });

  it("preserves primitive object selection while consuming its body candidate response", () => {
    const object = createBoxObject("box_1");
    const body = createPrimitiveBody("body:box_1", object.id);
    const response = createCandidateResponse({
      bodyId: body.id,
      status: "unsupported",
      issue: {
        code: "UNSUPPORTED_SELECTION_TARGET",
        status: "unsupported",
        message:
          "Primitive body body:box_1 does not expose command-ready semantic generated references.",
        bodyId: body.id
      }
    });
    const intent = resolveViewportPickIntent({
      pickedRenderId: object.id,
      bodies: [body],
      objects: [object],
      readReferenceCandidates: () => response
    });

    expect(intent).toMatchObject({
      kind: "object",
      selectedId: "box_1",
      objectId: "box_1",
      bodyId: "body:box_1",
      renderTargetId: "box_1",
      semanticSelection: { type: "body", bodyId: "body:box_1" },
      referenceCandidates: response,
      issues: [
        {
          code: "UNSUPPORTED_SELECTION_TARGET",
          status: "unsupported"
        }
      ]
    });
  });

  it.each([
    ["missing", "MISSING_SELECTION_TARGET"],
    ["stale", "STALE_SELECTION_REFERENCE"],
    ["unsupported", "UNSUPPORTED_SELECTION_TARGET"],
    ["ambiguous", "AMBIGUOUS_SELECTION_TOPOLOGY"],
    ["consumed", "CONSUMED_SELECTION_BODY"],
    ["non-commandable", "NON_COMMANDABLE_SELECTION_TARGET"]
  ] as const)(
    "carries structured %s diagnostics from CADOps candidate responses",
    (status, code) => {
      const body = createExtrudeBody("body_rect");
      const response = createCandidateResponse({
        bodyId: body.id,
        status,
        issue: {
          code,
          status,
          message: `${status} body diagnostic`,
          bodyId: body.id
        }
      });
      const intent = resolveViewportPickIntent({
        pickedRenderId: body.id,
        bodies: [body],
        objects: [],
        readReferenceCandidates: () => response
      });

      expect(intent.kind).toBe("body");
      expect(intent.issues).toEqual([
        {
          code,
          status,
          message: `${status} body diagnostic`,
          bodyId: body.id
        }
      ]);
    }
  );

  it("does not convert sketch or unknown render IDs into generated-reference selections", () => {
    const sketchIntent = resolveViewportPickIntent({
      pickedRenderId: "sketch:sketch_1",
      bodies: [],
      objects: []
    });
    const unknownIntent = resolveViewportPickIntent({
      pickedRenderId: "selection-buffer:face:17",
      bodies: [],
      objects: []
    });

    expect(sketchIntent).toMatchObject({
      kind: "unsupported",
      issues: [
        {
          code: "UNSUPPORTED_SELECTION_TARGET",
          status: "unsupported"
        }
      ]
    });
    expect(unknownIntent).toMatchObject({
      kind: "missing",
      issues: [
        {
          code: "MISSING_SELECTION_TARGET",
          status: "missing"
        }
      ]
    });
    expect(sketchIntent).not.toHaveProperty("selectedId");
    expect(sketchIntent).not.toHaveProperty("semanticSelection");
    expect(unknownIntent).not.toHaveProperty("selectedId");
    expect(unknownIntent).not.toHaveProperty("semanticSelection");
    expect(JSON.stringify(unknownIntent.issues)).not.toContain(
      "selection-buffer"
    );
  });
});

function createPrimitiveBody(id: string, objectId: string): CadBodySnapshot {
  return {
    id,
    kind: "solid",
    partId: "part:default",
    featureId: `feature:${objectId}`,
    objectId,
    primitive: "box",
    source: {
      type: "primitiveFeature",
      featureId: `feature:${objectId}`,
      objectId
    }
  };
}

function createExtrudeBody(id: string): CadBodySnapshot {
  return {
    id,
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

function createBoxObject(id: string): SceneObject {
  return {
    id,
    kind: "box",
    dimensions: { width: 2, height: 2, depth: 2 },
    transform: {
      translation: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    }
  };
}

function createCandidateResponse({
  bodyId,
  issue,
  status
}: {
  readonly bodyId: string;
  readonly issue?: CadSelectionReferenceIssue;
  readonly status: SelectionReferenceCandidatesQueryResponse["status"];
}): SelectionReferenceCandidatesQueryResponse {
  const reference = createFaceReference(bodyId);

  return {
    ok: true,
    query: "selection.referenceCandidates",
    cadOpsVersion: "cadops.v1",
    selection: { type: "body", bodyId },
    status,
    candidateCount: issue ? 0 : 1,
    candidates: issue
      ? []
      : [
          {
            source: "bodySelection",
            target: {
              type: "generatedReference",
              bodyId,
              stableId: reference.stableId,
              kind: reference.kind
            },
            reference,
            commandable: true,
            commandOperations: [
              "reference.nameGenerated",
              "feature.selectReference"
            ],
            label: reference.label,
            issues: []
          }
        ],
    issueCount: issue ? 1 : 0,
    issues: issue ? [issue] : []
  };
}

function createFaceReference(bodyId: string): CadGeneratedFaceReference {
  return {
    kind: "face",
    stableId: `generated:face:${bodyId}:startCap`,
    label: "Start cap",
    bodyId,
    ownerPartId: "part:default",
    sourceFeatureId: "feat_rect",
    sourceSketchId: "sketch_1",
    sourceSketchEntityId: "rect_1",
    role: "startCap",
    eligibleOperations: ["feature.selectReference"],
    geometricSignature: {
      profileKind: "rectangle",
      sketchPlane: "XY",
      extrudeSide: "positive",
      depth: 2,
      surfaceType: "plane"
    }
  };
}
