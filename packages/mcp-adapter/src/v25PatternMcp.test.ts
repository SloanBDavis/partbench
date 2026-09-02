import { describe, expect, it } from "vitest";
import { CadMcpServer } from "./index";

const PRIVATE_ID_PATTERN = /snapshot-local|raw-occt|entitySignature|localId/i;

const EXTRUDE_ADD_PATTERN_CADOPS = [
  { op: "sketch.create", id: "sketch_plate", name: "Plate", plane: "XY" },
  {
    op: "sketch.addRectangle",
    sketchId: "sketch_plate",
    id: "rect_plate",
    center: [0, 0],
    width: 60,
    height: 24
  },
  {
    op: "feature.extrude",
    id: "feat_plate",
    bodyId: "body_plate",
    sketchId: "sketch_plate",
    entityId: "rect_plate",
    depth: 6
  },
  { op: "sketch.create", id: "sketch_boss", name: "Boss", plane: "XY" },
  {
    op: "sketch.addRectangle",
    sketchId: "sketch_boss",
    id: "rect_boss",
    center: [-16, 0],
    width: 8,
    height: 8
  },
  {
    op: "feature.extrude",
    id: "feat_boss",
    bodyId: "body_boss",
    sketchId: "sketch_boss",
    entityId: "rect_boss",
    depth: 10,
    operationMode: "add",
    targetBodyId: "body_plate"
  },
  {
    op: "feature.linearPattern",
    id: "feat_pattern",
    bodyId: "body_patterned",
    seedFeatureId: "feat_boss",
    direction: { kind: "globalAxis", axis: "x" },
    spacing: 16,
    instanceCount: 3
  }
] as const;

describe("feature pattern grown solid seed MCP pass-through", () => {
  it("submits the same grown extrude-add pattern CADOps as UI Apply without a new tool", () => {
    const server = new CadMcpServer();
    expect(server.listTools().tools.map((tool) => tool.name)).toContain(
      "cad.batch"
    );
    expect(server.listTools().tools.map((tool) => tool.name)).not.toContain(
      "feature.linearFeaturePattern"
    );

    const dryRun = server.callTool({
      name: "cad.batch",
      requestId: "mcp_extrude_add_pattern",
      arguments: {
        batch: {
          version: "cadops.v1",
          mode: "dryRun",
          ops: [...EXTRUDE_ADD_PATTERN_CADOPS]
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
          "feat_boss",
          "feat_pattern"
        ]),
        createdBodyIds: expect.arrayContaining(["body_patterned"]),
        review: {
          operations: expect.arrayContaining([
            expect.objectContaining({
              op: "feature.linearPattern",
              featureId: "feat_pattern",
              label: expect.stringContaining("feat_boss")
            })
          ])
        }
      }
    });
  });
});
