import { CadEngine, type CadFeatureSummary } from "@web-cad/cad-core";
import type {
  CadOp,
  CadTopologyIdentityDiagnostic,
  FeatureExtrudeOperationMode,
  TopologyAnchorCreationPlanQueryResponse
} from "@web-cad/cad-protocol";
import { describe, expect, it, vi } from "vitest";
import { buildBatch, WEB_UI_ACTOR } from "./cadCommands";
import {
  createSketchOnFaceCommandPlan,
  shouldPromoteSketchOnFaceTarget
} from "./sketchOnFacePromotion";

describe("sketchOnFacePromotion", () => {
  it("keeps source-body sketch attachment on the direct generated-face path", async () => {
    const createAnchorPlan = vi.fn();
    const result = await createSketchOnFaceCommandPlan({
      ...createPlanInput("body_source_1", [
        createExtrudeFeature("body_source_1", "newBody")
      ]),
      form: createSketchOnFaceForm("body_source_1"),
      createAnchorPlan
    });

    expect(createAnchorPlan).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: true,
      status: "direct",
      ops: [
        {
          op: "sketch.createOnFace",
          id: "sketch_face_1",
          name: "Face sketch",
          bodyId: "body_source_1",
          faceStableId: "generated:face:body_source_1:endCap"
        }
      ]
    });
  });

  it("promotes result-body faces to saved topology anchors before sketch creation", async () => {
    const anchorOps = createAnchorOps("body_cut_1", "anchor_cut_face_1");
    const createAnchorPlan = vi.fn(async () => ({
      ok: true as const,
      plan: createCreationPlan({
        bodyId: "body_cut_1",
        stableId: "generated:face:body_cut_1:endCap",
        anchorId: "anchor_cut_face_1",
        status: "ready",
        ops: anchorOps
      })
    }));
    const result = await createSketchOnFaceCommandPlan({
      ...createPlanInput("body_cut_1", [
        createExtrudeFeature("body_cut_1", "cut")
      ]),
      form: createSketchOnFaceForm("body_cut_1"),
      createAnchorPlan
    });

    expect(createAnchorPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        target: {
          bodyId: "body_cut_1",
          stableId: "generated:face:body_cut_1:endCap",
          kind: "face"
        }
      })
    );
    expect(result).toMatchObject({
      ok: true,
      status: "ready",
      topologyAnchorId: "anchor_cut_face_1"
    });
    if (!result.ok) {
      throw new Error(result.message);
    }
    expect(result.ops).toEqual([
      ...anchorOps,
      {
        op: "sketch.createOnFace",
        id: "sketch_face_1",
        name: "Face sketch",
        topologyAnchorId: "anchor_cut_face_1"
      }
    ]);
    expect(JSON.stringify(result)).not.toMatch(
      /rendererId|renderId|meshId|occtId|occtShape|gpuId|selectionBufferId|triangleIndex|faceIndex|edgeIndex|vertexIndex|fileHandle|opfsPath|localPath|checkpoint-local/i
    );
  });

  it("uses existing topology anchors without replaying anchor creation ops", async () => {
    const createAnchorPlan = vi.fn(async () => ({
      ok: true as const,
      plan: createCreationPlan({
        bodyId: "body_hole_1",
        stableId: "generated:face:body_hole_1:endCap",
        anchorId: "anchor_hole_face_1",
        status: "alreadyExists",
        ops: createAnchorOps("body_hole_1", "anchor_hole_face_1")
      })
    }));
    const result = await createSketchOnFaceCommandPlan({
      ...createPlanInput("body_hole_1", [createHoleFeature("body_hole_1")]),
      form: createSketchOnFaceForm("body_hole_1"),
      createAnchorPlan
    });

    expect(result).toEqual({
      ok: true,
      status: "alreadyExists",
      topologyAnchorId: "anchor_hole_face_1",
      ops: [
        {
          op: "sketch.createOnFace",
          id: "sketch_face_1",
          name: "Face sketch",
          topologyAnchorId: "anchor_hole_face_1"
        }
      ]
    });
  });

  it("blocks unsupported result faces with structured diagnostics and no ops", async () => {
    const diagnostic: CadTopologyIdentityDiagnostic = {
      code: "TOPOLOGY_MATCH_UNSUPPORTED",
      status: "unavailable",
      severity: "warning",
      message: "Result face is not supported for saved reference creation.",
      bodyId: "body_cut_1",
      entityKind: "face"
    };
    const createAnchorPlan = vi.fn(async () => ({
      ok: false as const,
      status: "unsupported" as const,
      message: "Result face is not supported for saved reference creation.",
      diagnostics: [diagnostic]
    }));
    const result = await createSketchOnFaceCommandPlan({
      ...createPlanInput("body_cut_1", [
        createExtrudeFeature("body_cut_1", "cut")
      ]),
      form: createSketchOnFaceForm("body_cut_1"),
      createAnchorPlan
    });

    expect(result).toEqual({
      ok: false,
      status: "unsupported",
      message: "Result face is not supported for saved reference creation.",
      diagnostics: [diagnostic]
    });
    expect("ops" in result).toBe(false);
  });

  it("does not promote forms that already carry a topology anchor", () => {
    expect(
      shouldPromoteSketchOnFaceTarget(
        {
          ...createSketchOnFaceForm("body_cut_1"),
          topologyAnchorId: "anchor_cut_face_1"
        },
        [createExtrudeFeature("body_cut_1", "cut")]
      )
    ).toBe(false);
  });
});

function createPlanInput(
  bodyId: string,
  features: readonly CadFeatureSummary[]
) {
  return {
    engine: new CadEngine(),
    features,
    sketches: [],
    generatedFacesByKey: new Map(),
    runtime: {
      exactTopologyCheckpointPayload: vi.fn()
    },
    target: {
      bodyId,
      stableId: `generated:face:${bodyId}:endCap`,
      kind: "face" as const
    }
  };
}

function createSketchOnFaceForm(bodyId: string) {
  return {
    id: "sketch_face_1",
    name: "Face sketch",
    bodyId,
    faceStableId: `generated:face:${bodyId}:endCap`
  };
}

function createExtrudeFeature(
  bodyId: string,
  operationMode: FeatureExtrudeOperationMode
): Extract<CadFeatureSummary, { kind: "extrude" }> {
  return {
    id: `feature_${bodyId}`,
    kind: "extrude",
    partId: "part_main",
    bodyId,
    sketchId: `sketch_${bodyId}`,
    entityId: `entity_${bodyId}`,
    profileKind: "rectangle",
    depth: 1,
    side: "positive",
    operationMode,
    ...(operationMode === "newBody" ? {} : { targetBodyId: "body_source_1" }),
    source: {
      type: "sketchEntity",
      sketchId: `sketch_${bodyId}`,
      entityId: `entity_${bodyId}`
    }
  };
}

function createHoleFeature(
  bodyId: string
): Extract<CadFeatureSummary, { kind: "hole" }> {
  return {
    id: `feature_${bodyId}`,
    kind: "hole",
    partId: "part_main",
    bodyId,
    targetBodyId: "body_source_1",
    sketchId: `sketch_${bodyId}`,
    circleEntityId: `circle_${bodyId}`,
    depthMode: "throughAll",
    direction: "negative",
    source: {
      type: "sketchCircleHole",
      sketchId: `sketch_${bodyId}`,
      circleEntityId: `circle_${bodyId}`,
      targetBodyId: "body_source_1"
    }
  };
}

function createAnchorOps(bodyId: string, anchorId: string): readonly CadOp[] {
  return [
    {
      op: "topology.checkpoint.create",
      checkpointId: `checkpoint_${bodyId}`,
      bodyId,
      sourceFeatureId: `feature_${bodyId}`,
      sourceIdentity: {
        algorithm: "partbench-source-v1",
        sha256:
          "1111111111111111111111111111111111111111111111111111111111111111"
      },
      status: "active"
    },
    {
      op: "topology.anchor.create",
      anchorId,
      entityKind: "face",
      bodyId,
      checkpointId: `checkpoint_${bodyId}`,
      checkpointEntityId: `checkpoint_${bodyId}_face`,
      stableId: `generated:face:${bodyId}:endCap`,
      sourceFeatureId: `feature_${bodyId}`,
      sourceSemanticRole: "end cap",
      signatureHash: `${bodyId}:face`
    }
  ];
}

function createCreationPlan({
  bodyId,
  stableId,
  anchorId,
  status,
  ops
}: {
  readonly bodyId: string;
  readonly stableId: string;
  readonly anchorId: string;
  readonly status: TopologyAnchorCreationPlanQueryResponse["status"];
  readonly ops: readonly CadOp[];
}): TopologyAnchorCreationPlanQueryResponse {
  const replayOps = status === "ready" ? ops : [];

  return {
    ok: true,
    query: "topology.anchorCreationPlan",
    cadOpsVersion: "cadops.v1",
    status,
    bodyId,
    stableId,
    checkpointId: `checkpoint_${bodyId}`,
    anchorId,
    sourceFeatureId: `feature_${bodyId}`,
    createsCheckpoint: status === "ready",
    createsAnchor: status === "ready",
    opCount: replayOps.length,
    ops: replayOps,
    proposedBatch: buildBatch("commit", replayOps, WEB_UI_ACTOR),
    diagnosticCount: 0,
    diagnostics: [],
    sourceBoundaryNote: "Uses public source topology identity.",
    derivedBoundaryNote: "Does not expose renderer or checkpoint-local ids.",
    mutatesSource: false
  };
}
