import { describe, expect, it } from "vitest";
import type {
  CadOp,
  CadSelectionReferenceOperation,
  CadTopologyAnchorCommandProof
} from "@web-cad/cad-protocol";
import {
  CadEngine,
  CURRENT_CAD_PROJECT_FORMAT_VERSION,
  exportCadProject
} from "./index";

const CHECKPOINT_SOURCE_IDENTITY = {
  algorithm: "partbench-source-v1" as const,
  sha256: "2222222222222222222222222222222222222222222222222222222222222222"
};

const FACE_PROOF: CadTopologyAnchorCommandProof = {
  kind: "axisAlignedPlanarFace",
  entityKind: "face",
  evidenceSource: "checkpointSnapshot",
  exposesCheckpointLocalIds: false,
  planarAxis: "z",
  planarCoordinate: 3
};

const EDGE_PROOF: CadTopologyAnchorCommandProof = {
  kind: "axisAlignedLinearEdge",
  entityKind: "edge",
  evidenceSource: "checkpointSnapshot",
  exposesCheckpointLocalIds: false,
  bounds: { min: [-2, -1, 0], max: [-2, 1, 0] },
  linearAxis: "y",
  length: 2
};

const FACE_MUST = [
  "feature.attachSketchPlane",
  "feature.shell",
  "feature.mirrorPlane"
] as const;

const EDGE_MUST = [
  "feature.chamfer",
  "feature.fillet",
  "feature.linearPatternDirection",
  "feature.circularPatternAxis"
] as const;

const PRIVATE_ID_PATTERN = /snapshot-local|raw-occt|entitySignature|localId/i;

function createRectangleExtrudeEngine(): CadEngine {
  const engine = new CadEngine();
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
  return engine;
}

function readBodyTopologySourceSignature(engine: CadEngine): string {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "body.topology", bodyId: "body_rect_1" }
  });
  if (!response.ok || response.query !== "body.topology") {
    throw new Error("Expected body topology response.");
  }
  return response.topology.sourceIdentity.signature;
}

function currentEvidence(
  engine: CadEngine,
  kind: "face" | "edge" | "vertex"
) {
  return {
    bodyId: "body_rect_1",
    bodySourceIdentitySignature: readBodyTopologySourceSignature(engine),
    topologySignature: "current-topology-signature",
    entityKind: kind,
    localId: `snapshot-local:${kind}:2`,
    entitySignature: `raw-occt-${kind}-signature`
  } as const;
}

function queryCandidates(
  engine: CadEngine,
  kind: "face" | "edge" | "vertex",
  requiredOperation?: CadSelectionReferenceOperation
) {
  return engine.executeQuery({
    version: "cadops.v1",
    query: {
      query: "selection.referenceCandidates",
      currentTopologyEvidence: currentEvidence(engine, kind),
      ...(requiredOperation ? { requiredOperation } : {})
    }
  });
}

function promotionOps(
  kind: "face" | "edge",
  consuming: CadOp
): readonly CadOp[] {
  const evidence = currentEvidence(createRectangleExtrudeEngine(), kind);
  return [
    {
      op: "topology.checkpoint.create",
      checkpointId: "checkpoint_promoted",
      bodyId: "body_rect_1",
      sourceFeatureId: "feat_rect_1",
      sourceIdentity: CHECKPOINT_SOURCE_IDENTITY,
      status: "active"
    },
    {
      op: "topology.anchor.create",
      anchorId: "anchor_promoted",
      entityKind: kind,
      bodyId: "body_rect_1",
      checkpointId: "checkpoint_promoted",
      checkpointEntityId: evidence.localId,
      sourceFeatureId: "feat_rect_1",
      signatureHash: evidence.entitySignature
    },
    consuming
  ];
}

describe("V23 slice B current-exact promotion", () => {
  it("returns promotableGeneratedMatch for frozen Must rows and inspectOnly without requiredOperation", () => {
    const engine = createRectangleExtrudeEngine();
    expect(engine.getDocument().topologyIdentity).toBeUndefined();

    for (const requiredOperation of FACE_MUST) {
      const response = queryCandidates(engine, "face", requiredOperation);
      expect(response).toMatchObject({
        ok: true,
        status: "resolved",
        currentTopology: { outcome: "promotableGeneratedMatch" },
        candidateCount: 1,
        candidates: [
          expect.objectContaining({
            commandable: true,
            commandOperations: expect.arrayContaining([requiredOperation]),
            target: { type: "topologyAnchor", bodyId: "body_rect_1", kind: "face" }
          })
        ]
      });
      expect(JSON.stringify(response)).not.toMatch(PRIVATE_ID_PATTERN);
    }

    for (const requiredOperation of EDGE_MUST) {
      const response = queryCandidates(engine, "edge", requiredOperation);
      expect(response).toMatchObject({
        ok: true,
        status: "resolved",
        currentTopology: { outcome: "promotableGeneratedMatch" },
        candidateCount: 1,
        candidates: [
          expect.objectContaining({
            commandable: true,
            commandOperations: expect.arrayContaining([requiredOperation]),
            target: { type: "topologyAnchor", bodyId: "body_rect_1", kind: "edge" }
          })
        ]
      });
      expect(JSON.stringify(response)).not.toMatch(PRIVATE_ID_PATTERN);
    }

    expect(queryCandidates(engine, "face")).toMatchObject({
      status: "non-commandable",
      currentTopology: { outcome: "inspectOnly" },
      candidateCount: 0
    });
    expect(queryCandidates(engine, "edge")).toMatchObject({
      status: "non-commandable",
      currentTopology: { outcome: "inspectOnly" },
      candidateCount: 0
    });
    expect(engine.getDocument().topologyIdentity).toBeUndefined();
  });

  it("keeps vertices inspect-only and blocks unlisted kind/action pairs", () => {
    const engine = createRectangleExtrudeEngine();

    for (const requiredOperation of [
      "feature.chamfer",
      "feature.attachSketchPlane",
      "reference.nameGenerated"
    ] as const) {
      expect(queryCandidates(engine, "vertex", requiredOperation)).toMatchObject({
        status: "non-commandable",
        currentTopology: { outcome: "inspectOnly" },
        candidateCount: 0
      });
    }

    const blocked = [
      queryCandidates(engine, "face", "feature.chamfer"),
      queryCandidates(engine, "edge", "feature.attachSketchPlane"),
      queryCandidates(engine, "face", "reference.nameGenerated"),
      queryCandidates(engine, "edge", "reference.nameGenerated")
    ];
    for (const response of blocked) {
      expect(response).toMatchObject({
        status: "non-commandable",
        currentTopology: { outcome: "blocked" },
        issues: [
          expect.objectContaining({
            code: "NON_COMMANDABLE_SELECTION_TARGET"
          })
        ]
      });
      expect(JSON.stringify(response)).not.toMatch(PRIVATE_ID_PATTERN);
    }
  });

  it.each([
    {
      name: "sketch.createOnFace",
      kind: "face" as const,
      requiredOperation: "feature.attachSketchPlane" as const,
      consuming: {
        op: "sketch.createOnFace" as const,
        id: "sketch_promoted",
        name: "Promoted face",
        topologyAnchorId: "anchor_promoted",
        topologyAnchorProof: FACE_PROOF
      }
    },
    {
      name: "feature.shell",
      kind: "face" as const,
      requiredOperation: "feature.shell" as const,
      consuming: {
        op: "feature.shell" as const,
        id: "feat_promoted",
        bodyId: "body_promoted",
        targetBodyId: "body_rect_1",
        wallThickness: 0.2,
        openFaceRefs: [
          {
            kind: "topologyAnchor" as const,
            bodyId: "body_rect_1",
            anchorId: "anchor_promoted"
          }
        ]
      }
    },
    {
      name: "feature.mirror",
      kind: "face" as const,
      requiredOperation: "feature.mirrorPlane" as const,
      consuming: {
        op: "feature.mirror" as const,
        id: "feat_promoted",
        bodyId: "body_promoted",
        seedBodyId: "body_rect_1",
        plane: {
          kind: "topologyAnchor" as const,
          bodyId: "body_rect_1",
          anchorId: "anchor_promoted"
        },
        topologyAnchorProof: FACE_PROOF,
        includeOriginal: true
      }
    },
    {
      name: "feature.chamfer",
      kind: "edge" as const,
      requiredOperation: "feature.chamfer" as const,
      consuming: {
        op: "feature.chamfer" as const,
        id: "feat_promoted",
        bodyId: "body_promoted",
        targetBodyId: "body_rect_1",
        topologyAnchorId: "anchor_promoted",
        topologyAnchorProof: EDGE_PROOF,
        distance: 0.2
      }
    },
    {
      name: "feature.fillet",
      kind: "edge" as const,
      requiredOperation: "feature.fillet" as const,
      consuming: {
        op: "feature.fillet" as const,
        id: "feat_promoted",
        bodyId: "body_promoted",
        targetBodyId: "body_rect_1",
        topologyAnchorId: "anchor_promoted",
        topologyAnchorProof: EDGE_PROOF,
        radius: 0.2
      }
    },
    {
      name: "feature.linearPattern",
      kind: "edge" as const,
      requiredOperation: "feature.linearPatternDirection" as const,
      consuming: {
        op: "feature.linearPattern" as const,
        id: "feat_promoted",
        bodyId: "body_promoted",
        seedBodyId: "body_rect_1",
        direction: {
          kind: "topologyAnchor" as const,
          bodyId: "body_rect_1",
          anchorId: "anchor_promoted"
        },
        topologyAnchorProof: EDGE_PROOF,
        spacing: 5,
        instanceCount: 2
      }
    },
    {
      name: "feature.circularPattern",
      kind: "edge" as const,
      requiredOperation: "feature.circularPatternAxis" as const,
      consuming: {
        op: "feature.circularPattern" as const,
        id: "feat_promoted",
        bodyId: "body_promoted",
        seedBodyId: "body_rect_1",
        rotationAxis: {
          kind: "topologyAnchor" as const,
          bodyId: "body_rect_1",
          anchorId: "anchor_promoted"
        },
        topologyAnchorProof: EDGE_PROOF,
        totalAngleDegrees: 180,
        instanceCount: 2
      }
    }
  ])(
    "applies checkpoint, omitted-stableId anchor, and $name in one transaction",
    ({ kind, requiredOperation, consuming }) => {
      const engine = createRectangleExtrudeEngine();
      const ops = promotionOps(kind, consuming);
      const result = engine.applyBatch(ops);

      expect(result.transaction.ops.map((op) => op.op)).toEqual([
        "topology.checkpoint.create",
        "topology.anchor.create",
        consuming.op
      ]);
      expect(result.transaction.ops[1]).toMatchObject({
        op: "topology.anchor.create",
        anchorId: "anchor_promoted"
      });
      expect("stableId" in result.transaction.ops[1]!).toBe(false);
      expect(result.transaction.diff.references).toMatchObject({
        topologyCheckpointsCreated: [
          expect.objectContaining({ checkpointId: "checkpoint_promoted" })
        ],
        topologyAnchorsCreated: [
          expect.objectContaining({ anchorId: "anchor_promoted" })
        ]
      });
      expect(CURRENT_CAD_PROJECT_FORMAT_VERSION).toBe("web-cad.project.v22");
      expect(exportCadProject(engine).schemaVersion).not.toMatch(/v23/);
      expect(
        engine.getDocument().topologyIdentity?.checkpoints[0]?.packageVersion
      ).toBe("partbench.wcad.v2");

      const after = queryCandidates(engine, kind, requiredOperation);
      expect(after).toMatchObject({
        ok: true,
        status: "resolved",
        currentTopology: { outcome: "existingAnchorMatch" },
        candidates: [
          expect.objectContaining({
            commandable: true,
            target: expect.objectContaining({
              type: "topologyAnchor",
              topologyAnchorId: "anchor_promoted"
            })
          })
        ]
      });
      expect(JSON.stringify(after)).not.toMatch(PRIVATE_ID_PATTERN);

      engine.undo();
      expect(engine.getDocument().topologyIdentity).toBeUndefined();
      expect(engine.getDocument().features.has("feat_promoted")).toBe(false);
      expect(engine.getDocument().sketches.has("sketch_promoted")).toBe(false);

      engine.redo();
      expect(
        engine.getDocument().topologyIdentity?.anchors.some(
          (anchor) => anchor.anchorId === "anchor_promoted"
        )
      ).toBe(true);
      if (consuming.op === "sketch.createOnFace") {
        expect(engine.getDocument().sketches.has("sketch_promoted")).toBe(true);
      } else {
        expect(engine.getDocument().features.has("feat_promoted")).toBe(true);
      }
    }
  );

  it("rejects non-planar proofs and out-of-range fillet bounds", () => {
    const nonPlanar = {
      kind: "axisAlignedLinearEdge" as const,
      entityKind: "edge" as const,
      evidenceSource: "checkpointSnapshot" as const,
      exposesCheckpointLocalIds: false as const,
      linearAxis: "y" as const,
      length: 2
    };
    const createOnFace = createRectangleExtrudeEngine().executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: promotionOps("face", {
        op: "sketch.createOnFace",
        id: "sketch_promoted",
        name: "Bad plane",
        topologyAnchorId: "anchor_promoted",
        topologyAnchorProof: nonPlanar
      })
    });
    expect(createOnFace).toMatchObject({
      ok: false,
      error: { code: "INVALID_TOPOLOGY_ANCHOR" }
    });

    const mirror = createRectangleExtrudeEngine().executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: promotionOps("face", {
        op: "feature.mirror",
        id: "feat_promoted",
        bodyId: "body_promoted",
        seedBodyId: "body_rect_1",
        plane: {
          kind: "topologyAnchor",
          bodyId: "body_rect_1",
          anchorId: "anchor_promoted"
        },
        topologyAnchorProof: nonPlanar,
        includeOriginal: true
      })
    });
    expect(mirror).toMatchObject({
      ok: false,
      error: { code: "INVALID_TOPOLOGY_ANCHOR" }
    });

    const fillet = createRectangleExtrudeEngine().executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: promotionOps("edge", {
        op: "feature.fillet",
        id: "feat_promoted",
        bodyId: "body_promoted",
        targetBodyId: "body_rect_1",
        topologyAnchorId: "anchor_promoted",
        topologyAnchorProof: {
          ...EDGE_PROOF,
          bounds: { min: [5, 0, 0], max: [6, 0, 0] }
        },
        radius: 0.2
      })
    });
    expect(fillet).toMatchObject({
      ok: false,
      error: { code: "INVALID_TOPOLOGY_ANCHOR" }
    });
  });
});
