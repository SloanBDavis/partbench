import { describe, expect, it } from "vitest";
import { CadMcpServer } from "./index";

const PRIVATE_ID_PATTERN = /snapshot-local|raw-occt|entitySignature|localId/i;

const COMBINE_INTERSECT_CADOPS = [
  { op: "sketch.create", id: "sketch_block_a", name: "Block A", plane: "XY" },
  {
    op: "sketch.addRectangle",
    sketchId: "sketch_block_a",
    id: "rect_a",
    center: [0, 0],
    width: 20,
    height: 20
  },
  {
    op: "feature.extrude",
    id: "feat_block_a",
    bodyId: "body_block_a",
    sketchId: "sketch_block_a",
    entityId: "rect_a",
    depth: 10
  },
  { op: "sketch.create", id: "sketch_block_b", name: "Block B", plane: "XY" },
  {
    op: "sketch.addRectangle",
    sketchId: "sketch_block_b",
    id: "rect_b",
    center: [10, 0],
    width: 20,
    height: 20
  },
  {
    op: "feature.extrude",
    id: "feat_block_b",
    bodyId: "body_block_b",
    sketchId: "sketch_block_b",
    entityId: "rect_b",
    depth: 10
  },
  {
    op: "feature.combine",
    id: "feat_intersect",
    bodyId: "body_overlap",
    mode: "intersect",
    targetBodyId: "body_block_a",
    toolBodyId: "body_block_b"
  }
] as const;

describe("feature.combine intersect MCP pass-through", () => {
  it("submits the same combine intersect CADOps as UI Apply without a new tool", () => {
    const server = new CadMcpServer();
    expect(server.listTools().tools.map((tool) => tool.name)).toContain(
      "cad.batch"
    );
    expect(server.listTools().tools.map((tool) => tool.name)).not.toContain(
      "feature.combineIntersect"
    );

    const dryRun = server.callTool({
      name: "cad.batch",
      requestId: "mcp_combine_intersect",
      arguments: {
        batch: {
          version: "cadops.v1",
          mode: "dryRun",
          ops: [...COMBINE_INTERSECT_CADOPS]
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
        createdFeatureIds: expect.arrayContaining(["feat_intersect"]),
        createdBodyIds: expect.arrayContaining(["body_overlap"]),
        review: {
          operations: expect.arrayContaining([
            expect.objectContaining({
              op: "feature.combine",
              featureId: "feat_intersect",
              label: expect.stringContaining("intersect")
            })
          ])
        }
      }
    });
  });
});
