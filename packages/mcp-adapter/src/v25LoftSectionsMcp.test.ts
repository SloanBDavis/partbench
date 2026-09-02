import { describe, expect, it } from "vitest";
import { CadMcpServer } from "./index";

const PRIVATE_ID_PATTERN = /snapshot-local|raw-occt|entitySignature|localId/i;

const NON_PARALLEL_LOFT_CADOPS = [
  {
    op: "sketch.create",
    id: "sketch_xy",
    name: "XY section",
    plane: "XY"
  },
  {
    op: "sketch.addCircle",
    sketchId: "sketch_xy",
    id: "xy_circle",
    center: [0, 0],
    radius: 1
  },
  {
    op: "sketch.create",
    id: "sketch_xz",
    name: "XZ section",
    plane: "XZ"
  },
  {
    op: "sketch.addCircle",
    sketchId: "sketch_xz",
    id: "xz_circle",
    center: [0, 10],
    radius: 1
  },
  {
    op: "feature.loft",
    id: "feat_loft_nonparallel",
    bodyId: "body_loft_nonparallel",
    sections: [
      { sketchId: "sketch_xy", entityId: "xy_circle" },
      { sketchId: "sketch_xz", entityId: "xz_circle" }
    ]
  }
] as const;

describe("feature.loft non-parallel sections MCP pass-through", () => {
  it("commits the same non-parallel feature.loft CADOps as UI Apply without a new tool", () => {
    const server = new CadMcpServer();
    expect(server.listTools().tools.map((tool) => tool.name)).toContain(
      "cad.batch"
    );
    expect(server.listTools().tools.map((tool) => tool.name)).not.toContain(
      "feature.loft"
    );

    const committed = server.callTool({
      name: "cad.batch",
      requestId: "mcp_loft_sections",
      arguments: {
        allowCommit: true,
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [...NON_PARALLEL_LOFT_CADOPS]
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
        createdFeatureIds: expect.arrayContaining(["feat_loft_nonparallel"]),
        createdBodyIds: expect.arrayContaining(["body_loft_nonparallel"])
      }
    });

    const structure = server.callTool({
      name: "cad.project_structure",
      requestId: "mcp_loft_sections_structure"
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
            id: "feat_loft_nonparallel",
            kind: "loft",
            bodyId: "body_loft_nonparallel"
          })
        ])
      }
    });
  });
});
