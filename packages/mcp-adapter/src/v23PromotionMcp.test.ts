import { CAD_AGENT_APPROVAL_MODES } from "@web-cad/agent-adapter";
import type {
  CadCurrentTopologySelectionEvidence,
  CadSelectionReferenceOperation,
  CadTopologyAnchorCommandProof
} from "@web-cad/cad-protocol";
import { describe, expect, it } from "vitest";
import { CadMcpServer } from "./index";

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

const PRIVATE_ID_PATTERN = /snapshot-local|raw-occt|entitySignature|localId/i;
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

function createSeededServer(): CadMcpServer {
  const server = new CadMcpServer();
  const seeded = server.callTool({
    name: "cad.batch",
    requestId: "seed",
    arguments: {
      allowCommit: true,
      batch: {
        version: "cadops.v1",
        mode: "commit",
        ops: [
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
        ]
      }
    }
  });
  expect(seeded).toMatchObject({
    isError: false,
    structuredContent: { ok: true }
  });
  return server;
}

function currentEvidence(
  server: CadMcpServer,
  entityKind: "face" | "edge" | "vertex"
): CadCurrentTopologySelectionEvidence {
  const topology = server.callTool({
    name: "cad.body_topology",
    arguments: { bodyId: "body_rect_1" }
  });
  if (
    !topology.structuredContent.ok ||
    !("topology" in topology.structuredContent)
  ) {
    throw new Error("Expected body topology response.");
  }
  return {
    bodyId: "body_rect_1",
    bodySourceIdentitySignature:
      topology.structuredContent.topology.sourceIdentity.signature,
    topologySignature: "current-topology-signature",
    entityKind,
    localId: `snapshot-local:${entityKind}:2`,
    entitySignature: `raw-occt-${entityKind}-signature`
  };
}

function query(
  server: CadMcpServer,
  entityKind: "face" | "edge" | "vertex",
  requiredOperation: CadSelectionReferenceOperation
) {
  return server.callTool({
    name: "cad.selection_reference_candidates",
    arguments: {
      currentTopologyEvidence: currentEvidence(server, entityKind),
      requiredOperation
    }
  });
}

function promotionPrefix(
  evidence: CadCurrentTopologySelectionEvidence,
  kind: "face" | "edge",
  suffix: string
) {
  return [
    {
      op: "topology.checkpoint.create",
      checkpointId: `checkpoint_${suffix}`,
      bodyId: "body_rect_1",
      sourceFeatureId: "feat_rect_1",
      sourceIdentity: {
        algorithm: "partbench-source-v1",
        sha256:
          "2222222222222222222222222222222222222222222222222222222222222222"
      },
      status: "active"
    },
    {
      op: "topology.anchor.create",
      anchorId: `anchor_${suffix}`,
      entityKind: kind,
      bodyId: "body_rect_1",
      checkpointId: `checkpoint_${suffix}`,
      checkpointEntityId: evidence.localId,
      sourceFeatureId: "feat_rect_1",
      signatureHash: evidence.entitySignature
    }
  ] as const;
}

describe("V23 slice D current-exact promotion over existing MCP seams", () => {
  it("projects every frozen Must row without leaking exact-local identity", () => {
    const server = createSeededServer();
    for (const operation of FACE_MUST) {
      const result = query(server, "face", operation);
      expect(result).toMatchObject({
        isError: false,
        structuredContent: {
          ok: true,
          status: "resolved",
          currentTopology: { outcome: "promotableGeneratedMatch" },
          candidates: [expect.objectContaining({ commandable: true })]
        }
      });
      expect(JSON.stringify(result.structuredContent)).not.toMatch(
        PRIVATE_ID_PATTERN
      );
    }
    for (const operation of EDGE_MUST) {
      const result = query(server, "edge", operation);
      expect(result).toMatchObject({
        isError: false,
        structuredContent: {
          currentTopology: { outcome: "promotableGeneratedMatch" },
          candidates: [expect.objectContaining({ commandable: true })]
        }
      });
      expect(JSON.stringify(result.structuredContent)).not.toMatch(
        PRIVATE_ID_PATTERN
      );
    }
  });

  it("keeps vertices inspect-only and unlisted pairs blocked", () => {
    const server = createSeededServer();
    expect(query(server, "vertex", "feature.chamfer")).toMatchObject({
      structuredContent: {
        status: "non-commandable",
        currentTopology: { outcome: "inspectOnly" }
      }
    });
    for (const [kind, operation] of [
      ["face", "feature.chamfer"],
      ["edge", "feature.attachSketchPlane"],
      ["face", "reference.nameGenerated"],
      ["edge", "reference.nameGenerated"]
    ] as const) {
      expect(query(server, kind, operation)).toMatchObject({
        structuredContent: {
          status: "non-commandable",
          currentTopology: { outcome: "blocked" }
        }
      });
    }
  });

  it("commits face promotion and sketch consumption in one batch", () => {
    const server = createSeededServer();
    const evidence = currentEvidence(server, "face");
    const applied = server.callTool({
      name: "cad.batch",
      arguments: {
        allowCommit: true,
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [
            ...promotionPrefix(evidence, "face", "face"),
            {
              op: "sketch.createOnFace",
              id: "sketch_promoted",
              name: "Promoted face",
              topologyAnchorId: "anchor_face",
              topologyAnchorProof: FACE_PROOF
            }
          ]
        }
      }
    });
    expect(applied).toMatchObject({
      isError: false,
      structuredContent: { ok: true, mode: "commit", transactionId: "txn_2" }
    });
    expect(query(server, "face", "feature.attachSketchPlane")).toMatchObject({
      structuredContent: {
        currentTopology: { outcome: "existingAnchorMatch" },
        candidates: [
          expect.objectContaining({
            target: expect.objectContaining({ topologyAnchorId: "anchor_face" })
          })
        ]
      }
    });
  });

  it("commits edge promotion and chamfer consumption in one batch", () => {
    const server = createSeededServer();
    const evidence = currentEvidence(server, "edge");
    const applied = server.callTool({
      name: "cad.batch",
      arguments: {
        allowCommit: true,
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [
            ...promotionPrefix(evidence, "edge", "edge"),
            {
              op: "feature.chamfer",
              id: "feat_promoted",
              bodyId: "body_promoted",
              targetBodyId: "body_rect_1",
              topologyAnchorId: "anchor_edge",
              topologyAnchorProof: EDGE_PROOF,
              distance: 0.2
            }
          ]
        }
      }
    });
    expect(applied).toMatchObject({
      isError: false,
      structuredContent: { ok: true, mode: "commit", transactionId: "txn_2" }
    });
    expect(query(server, "edge", "feature.chamfer")).toMatchObject({
      structuredContent: {
        currentTopology: { outcome: "existingAnchorMatch" },
        candidates: [
          expect.objectContaining({
            target: expect.objectContaining({ topologyAnchorId: "anchor_edge" })
          })
        ]
      }
    });
  });

  it("freezes tools, approval and batch modes, and package readiness", () => {
    const server = createSeededServer();
    const tools = server.listTools().tools;
    expect(tools).toHaveLength(49);
    expect(tools.map(({ name }) => name)).toContain(
      "cad.selection_reference_candidates"
    );
    expect(tools.map(({ name }) => name)).toContain("cad.batch");
    expect(CAD_AGENT_APPROVAL_MODES).toEqual(["manualApproval", "approveAll"]);
    expect(
      tools.find(({ name }) => name === "cad.batch")?.inputSchema
    ).toMatchObject({
      properties: {
        batch: { properties: { mode: { enum: ["dryRun", "commit"] } } }
      }
    });
    const evidence = currentEvidence(server, "face");
    expect(
      server.callTool({
        name: "cad.batch",
        arguments: {
          allowCommit: true,
          batch: {
            version: "cadops.v1",
            mode: "commit",
            ops: [
              ...promotionPrefix(evidence, "face", "readiness"),
              {
                op: "sketch.createOnFace",
                id: "sketch_readiness",
                name: "Readiness face",
                topologyAnchorId: "anchor_readiness",
                topologyAnchorProof: FACE_PROOF
              }
            ]
          }
        }
      })
    ).toMatchObject({ isError: false, structuredContent: { ok: true } });
    expect(
      server.callTool({ name: "cad.project_package_readiness" })
    ).toMatchObject({
      structuredContent: {
        ok: true,
        packageVersion: "partbench.wcad.v2",
        documentSchemaVersion: expect.stringMatching(
          /^web-cad\.project\.v(1[6-9]|2[0-2])$/
        )
      }
    });
  });
});
