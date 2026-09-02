import { describe, expect, it } from "vitest";
import { CadMcpServer } from "./index";

const PRIVATE_ID_PATTERN = /snapshot-local|raw-occt|entitySignature|localId/i;

const DRAFT_CADOPS = [
  { op: "sketch.create", id: "sketch_block", name: "Block", plane: "XY" },
  {
    op: "sketch.addRectangle",
    sketchId: "sketch_block",
    id: "rect_block",
    center: [0, 0],
    width: 10,
    height: 10
  },
  {
    op: "feature.extrude",
    id: "feat_block",
    bodyId: "body_block",
    sketchId: "sketch_block",
    entityId: "rect_block",
    depth: 8
  },
  {
    op: "feature.draft",
    id: "feat_draft_side",
    bodyId: "body_draft_side",
    targetBodyId: "body_block",
    faces: [
      {
        kind: "generatedFace",
        bodyId: "body_block",
        stableId: "generated:face:body_block:side:uMax"
      }
    ],
    angleDegrees: 10,
    neutralPlane: {
      kind: "planarFace",
      face: {
        kind: "generatedFace",
        bodyId: "body_block",
        stableId: "generated:face:body_block:startCap"
      }
    }
  }
] as const;

describe("feature.draft MCP pass-through", () => {
  it("commits the same feature.draft CADOps as UI Apply without a new tool", () => {
    const server = new CadMcpServer();
    expect(server.listTools().tools.map((tool) => tool.name)).toContain(
      "cad.batch"
    );
    expect(server.listTools().tools.map((tool) => tool.name)).not.toContain(
      "feature.draft"
    );

    const committed = server.callTool({
      name: "cad.batch",
      requestId: "mcp_draft",
      arguments: {
        allowCommit: true,
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [...DRAFT_CADOPS]
        }
      }
    });
    const publicJson = JSON.stringify(committed.structuredContent);
    expect(PRIVATE_ID_PATTERN.test(publicJson)).toBe(false);
    expect(committed).toMatchObject({
      toolName: "cad.batch",
      isError: false,
      structuredContent: {
        ok: true,
        createdFeatureIds: expect.arrayContaining(["feat_draft_side"]),
        createdBodyIds: expect.arrayContaining(["body_draft_side"])
      }
    });

    const structure = server.callTool({
      name: "cad.project_structure",
      requestId: "mcp_draft_structure"
    });
    expect(JSON.stringify(structure.structuredContent)).not.toMatch(
      PRIVATE_ID_PATTERN
    );
    expect(structure).toMatchObject({
      isError: false,
      structuredContent: {
        ok: true,
        features: expect.arrayContaining([
          expect.objectContaining({
            id: "feat_draft_side",
            kind: "draft",
            angleDegrees: 10,
            pullDirection: [0, 0, 1],
            draftedFaces: [
              expect.objectContaining({
                plane: expect.objectContaining({
                  normal: [0.984807753012, 0, 0.173648177667]
                })
              })
            ]
          })
        ])
      }
    });
  });
});
