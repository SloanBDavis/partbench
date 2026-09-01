import {
  CadEngine,
  CAD_PROJECT_FORMAT_VERSION_V22,
  exportCadProject
} from "@web-cad/cad-core";
import type {
  CadBodyExactTopologyEntityDescriptor,
  CadCurrentTopologySelectionEvidence,
  CadOp,
  CadSelectionReferenceOperation
} from "@web-cad/cad-protocol";
import { describe, expect, it } from "vitest";

import {
  createCurrentExactTopologyAnchorCommandProof,
  mapCollectorToRequiredOperation,
  prependCurrentExactPromotionOps,
  queryCurrentExactPromotionCandidate
} from "./currentExactPromotionApply";

const PRIVATE_ID_PATTERN = /snapshot-local|raw-occt/i;

const FACE_ENTITY: CadBodyExactTopologyEntityDescriptor = {
  localId: "snapshot-local:face:2",
  kind: "face",
  source: "kernel-derived",
  signature: "raw-occt-face-signature",
  bounds: { min: [-2, -1, 3], max: [2, 1, 3] },
  surfaceClass: "plane"
};

const EDGE_ENTITY: CadBodyExactTopologyEntityDescriptor = {
  localId: "snapshot-local:edge:2",
  kind: "edge",
  source: "kernel-derived",
  signature: "raw-occt-edge-signature",
  bounds: { min: [-2, -1, 0], max: [-2, 1, 0] },
  length: 2,
  curveClass: "line"
};

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
): CadCurrentTopologySelectionEvidence {
  return {
    bodyId: "body_rect_1",
    bodySourceIdentitySignature: readBodyTopologySourceSignature(engine),
    topologySignature: "current-topology-signature",
    entityKind: kind,
    localId: `snapshot-local:${kind}:2`,
    entitySignature: `raw-occt-${kind}-signature`
  };
}

function consumingOpsJson(ops: readonly CadOp[]): string {
  return JSON.stringify(ops.filter((op) => !op.op.startsWith("topology.")));
}

describe("V23 slice C current-exact human Apply", () => {
  it("maps Must collectors to required operations", () => {
    expect(mapCollectorToRequiredOperation("edge")).toBe("feature.chamfer");
    expect(mapCollectorToRequiredOperation("openFaces")).toBe("feature.shell");
    expect(mapCollectorToRequiredOperation("direction")).toBe(
      "feature.linearPatternDirection"
    );
    expect(mapCollectorToRequiredOperation("rotationAxis")).toBe(
      "feature.circularPatternAxis"
    );
    expect(mapCollectorToRequiredOperation("mirrorPlane")).toBe(
      "feature.mirrorPlane"
    );
    expect(mapCollectorToRequiredOperation("targetBody")).toBeUndefined();
    expect(mapCollectorToRequiredOperation(undefined)).toBeUndefined();

    expect(
      createCurrentExactTopologyAnchorCommandProof("face", FACE_ENTITY)
    ).toMatchObject({
      kind: "axisAlignedPlanarFace",
      entityKind: "face",
      planarAxis: "z",
      planarCoordinate: 3
    });
    expect(
      createCurrentExactTopologyAnchorCommandProof("edge", EDGE_ENTITY)
    ).toMatchObject({
      kind: "axisAlignedLinearEdge",
      entityKind: "edge",
      linearAxis: "y",
      length: 2
    });
    expect(
      createCurrentExactTopologyAnchorCommandProof("vertex", FACE_ENTITY)
    ).toBeUndefined();
  });

  it("applies unmatched face + feature.shell as one checkpoint, omitted-stableId-anchor, consuming op transaction", () => {
    const engine = createRectangleExtrudeEngine();
    const evidence = currentEvidence(engine, "face");
    const result = prependCurrentExactPromotionOps({
      engine,
      evidence,
      requiredOperation: "feature.shell",
      entity: FACE_ENTITY,
      consumingOps: [
        {
          op: "feature.shell",
          id: "feat_promoted",
          bodyId: "body_promoted",
          targetBodyId: "body_rect_1",
          wallThickness: 0.2,
          openFaceRefs: []
        }
      ]
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ops.map((op) => op.op)).toEqual([
      "topology.checkpoint.create",
      "topology.anchor.create",
      "feature.shell"
    ]);
    expect(result.ops[1]).toMatchObject({
      op: "topology.anchor.create",
      anchorId: result.topologyAnchorId
    });
    expect("stableId" in result.ops[1]!).toBe(false);
    expect(result.ops[2]).toMatchObject({
      op: "feature.shell",
      openFaceRefs: [
        {
          kind: "topologyAnchor",
          bodyId: "body_rect_1",
          anchorId: result.topologyAnchorId
        }
      ]
    });
    expect(consumingOpsJson(result.ops)).not.toMatch(PRIVATE_ID_PATTERN);

    const applied = engine.applyBatch(result.ops);
    expect(applied.transaction.ops.map((op) => op.op)).toEqual([
      "topology.checkpoint.create",
      "topology.anchor.create",
      "feature.shell"
    ]);
    expect(CAD_PROJECT_FORMAT_VERSION_V22).toBe("web-cad.project.v22");
    expect(exportCadProject(engine).schemaVersion).toMatch(
      /^web-cad\.project\.v(1[6-9]|2[0-2])$/
    );

    const after = queryCurrentExactPromotionCandidate(
      engine,
      evidence,
      "feature.shell"
    );
    expect(after).toMatchObject({
      ok: true,
      status: "resolved",
      currentTopology: { outcome: "existingAnchorMatch" },
      candidates: [
        expect.objectContaining({
          commandable: true,
          target: expect.objectContaining({
            type: "topologyAnchor",
            topologyAnchorId: result.topologyAnchorId
          })
        })
      ]
    });
    expect(JSON.stringify(after)).not.toMatch(PRIVATE_ID_PATTERN);
  });

  it("rewrites unmatched edge + feature.chamfer placeholder edgeStableId away", () => {
    const engine = createRectangleExtrudeEngine();
    const evidence = currentEvidence(engine, "edge");
    const result = prependCurrentExactPromotionOps({
      engine,
      evidence,
      requiredOperation: "feature.chamfer",
      entity: EDGE_ENTITY,
      consumingOps: [
        {
          op: "feature.chamfer",
          id: "feat_promoted",
          bodyId: "body_promoted",
          targetBodyId: "body_rect_1",
          edgeStableId: "placeholder-edge",
          distance: 0.2
        }
      ]
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ops.map((op) => op.op)).toEqual([
      "topology.checkpoint.create",
      "topology.anchor.create",
      "feature.chamfer"
    ]);
    expect("stableId" in result.ops[1]!).toBe(false);
    expect(result.ops[2]).toMatchObject({
      op: "feature.chamfer",
      topologyAnchorId: result.topologyAnchorId
    });
    expect("edgeStableId" in result.ops[2]!).toBe(false);
    expect("namedReference" in result.ops[2]!).toBe(false);
    expect(consumingOpsJson(result.ops)).not.toMatch(PRIVATE_ID_PATTERN);

    engine.applyBatch(result.ops);
    const after = queryCurrentExactPromotionCandidate(
      engine,
      evidence,
      "feature.chamfer"
    );
    expect(after).toMatchObject({
      ok: true,
      status: "resolved",
      currentTopology: { outcome: "existingAnchorMatch" },
      candidates: [
        expect.objectContaining({
          target: expect.objectContaining({
            topologyAnchorId: result.topologyAnchorId
          })
        })
      ]
    });
    expect(JSON.stringify(after)).not.toMatch(PRIVATE_ID_PATTERN);
  });

  it("keeps vertices inspect-only and blocks unlisted kind/action pairs", () => {
    const engine = createRectangleExtrudeEngine();
    const vertex = queryCurrentExactPromotionCandidate(
      engine,
      currentEvidence(engine, "vertex"),
      "feature.chamfer"
    );
    expect(vertex).toMatchObject({
      status: "non-commandable",
      currentTopology: { outcome: "inspectOnly" },
      candidateCount: 0
    });

    const blocked: readonly {
      readonly kind: "face" | "edge";
      readonly requiredOperation: CadSelectionReferenceOperation;
    }[] = [
      { kind: "face", requiredOperation: "feature.chamfer" },
      { kind: "edge", requiredOperation: "feature.attachSketchPlane" }
    ];
    for (const { kind, requiredOperation } of blocked) {
      const response = queryCurrentExactPromotionCandidate(
        engine,
        currentEvidence(engine, kind),
        requiredOperation
      );
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

      const promotion = prependCurrentExactPromotionOps({
        engine,
        evidence: currentEvidence(engine, kind),
        requiredOperation,
        entity: kind === "face" ? FACE_ENTITY : EDGE_ENTITY,
        consumingOps: []
      });
      expect(promotion).toEqual({ ok: false });
    }
  });
});
