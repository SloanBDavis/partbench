import { describe, expect, it } from "vitest";
import { CadMcpServer } from "./index";

const PRIVATE_ID_PATTERN = /snapshot-local|raw-occt|entitySignature|localId/i;

const CHAMFER_PATTERN_CADOPS = [
  { op: "sketch.create", id: "sketch_block", name: "Block", plane: "XY" },
  {
    op: "sketch.addRectangle",
    sketchId: "sketch_block",
    id: "rect_block",
    center: [0, 0],
    width: 20,
    height: 12
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
    op: "feature.chamfer",
    id: "feat_chamfer",
    bodyId: "body_chamfer",
    targetBodyId: "body_block",
    edgeStableId: "generated:edge:body_block:start:uMin",
    distance: 2
  },
  {
    op: "feature.linearPattern",
    id: "feat_pattern",
    bodyId: "body_patterned",
    seedFeatureId: "feat_chamfer",
    direction: { kind: "globalAxis", axis: "x" },
    spacing: 30,
    instanceCount: 3
  }
] as const;

describe("feature pattern grown solid seed MCP pass-through", () => {
  it("submits the same grown chamfer-pattern CADOps as UI Apply without a new tool", () => {
    const server = new CadMcpServer();
    expect(server.listTools().tools.map((tool) => tool.name)).toContain(
      "cad.batch"
    );
    expect(server.listTools().tools.map((tool) => tool.name)).not.toContain(
      "feature.linearFeaturePattern"
    );

    const dryRun = server.callTool({
      name: "cad.batch",
      requestId: "mcp_chamfer_pattern",
      arguments: {
        batch: {
          version: "cadops.v1",
          mode: "dryRun",
          ops: [...CHAMFER_PATTERN_CADOPS]
        }
      }
    });
    const publicJson = JSON.stringify(dryRun.structuredContent);
    expect(PRIVATE_ID_PATTERN.test(publicJson)).toBe(false);
    expect(dryRun).toMatchObject({
      toolName: "cad.batch",
      isError: false,
      structuredContent: {
        ok: true,
        mode: "dryRun",
        createdFeatureIds: expect.arrayContaining([
          "feat_chamfer",
          "feat_pattern"
        ]),
        createdBodyIds: expect.arrayContaining(["body_patterned"]),
        review: {
          operations: expect.arrayContaining([
            expect.objectContaining({
              op: "feature.linearPattern",
              featureId: "feat_pattern",
              label: expect.stringContaining("feat_chamfer")
            })
          ])
        }
      }
    });
  });
});
