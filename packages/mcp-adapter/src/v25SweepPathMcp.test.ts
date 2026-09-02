import { describe, expect, it } from "vitest";
import { CadMcpServer } from "./index";

const PRIVATE_ID_PATTERN = /snapshot-local|raw-occt|entitySignature|localId/i;

const COMPOSITE_SWEEP_CADOPS = [
  {
    op: "sketch.create",
    id: "sketch_profile",
    name: "Sweep profile",
    plane: "XY"
  },
  {
    op: "sketch.addCircle",
    sketchId: "sketch_profile",
    id: "profile_circle",
    center: [0, 0],
    radius: 1
  },
  {
    op: "sketch.create",
    id: "sketch_path",
    name: "Sweep path",
    plane: "XZ"
  },
  {
    op: "sketch.addLine",
    id: "path_line",
    sketchId: "sketch_path",
    start: [0, 0],
    end: [0, 10]
  },
  {
    op: "sketch.addSpline",
    id: "path_spline",
    sketchId: "sketch_path",
    definition: {
      kind: "interpolation",
      points: [
        [0, 10],
        [0, 16],
        [0, 22],
        [8, 28]
      ],
      closed: false
    }
  },
  {
    op: "feature.sweep",
    id: "feat_sweep_composite",
    bodyId: "body_sweep_composite",
    profile: {
      kind: "entity",
      sketchId: "sketch_profile",
      entityId: "profile_circle"
    },
    path: {
      kind: "chain",
      sketchId: "sketch_path",
      segments: [
        { entityId: "path_line", orientation: "forward" },
        { entityId: "path_spline", orientation: "forward" }
      ]
    }
  }
] as const;

describe("feature.sweep composite path MCP pass-through", () => {
  it("commits the same composite-path feature.sweep CADOps as UI Apply without a new tool", () => {
    const server = new CadMcpServer();
    expect(server.listTools().tools.map((tool) => tool.name)).toContain(
      "cad.batch"
    );
    expect(server.listTools().tools.map((tool) => tool.name)).not.toContain(
      "feature.sweep"
    );

    const committed = server.callTool({
      name: "cad.batch",
      requestId: "mcp_sweep_path",
      arguments: {
        allowCommit: true,
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [...COMPOSITE_SWEEP_CADOPS]
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
        createdFeatureIds: expect.arrayContaining(["feat_sweep_composite"]),
        createdBodyIds: expect.arrayContaining(["body_sweep_composite"])
      }
    });

    const structure = server.callTool({
      name: "cad.project_structure",
      requestId: "mcp_sweep_path_structure"
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
            id: "feat_sweep_composite",
            kind: "sweep",
            bodyId: "body_sweep_composite"
          })
        ])
      }
    });
  });
});
