import { describe, expect, it } from "vitest";
import { CadMcpServer } from "./index";

const PRIVATE_ID_PATTERN = /snapshot-local|raw-occt|entitySignature|localId/i;

const DATUM_AXIS_CADOPS = [
  { op: "sketch.create", id: "sketch_block", name: "Block", plane: "XY" },
  {
    op: "sketch.addRectangle",
    sketchId: "sketch_block",
    id: "rect_block",
    center: [20, 0],
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
    op: "datum.axis.create",
    id: "datum_axis_z",
    name: "Z axis",
    axis: { kind: "globalAxis", axis: "z" }
  },
  {
    op: "feature.circularPattern",
    id: "feat_pattern",
    bodyId: "body_patterned",
    seedBodyId: "body_block",
    rotationAxis: { kind: "datumAxis", datumId: "datum_axis_z" },
    totalAngleDegrees: 360,
    instanceCount: 4
  }
] as const;

describe("datum.axis.create MCP pass-through", () => {
  it("submits the same datum.axis.create + circular-pattern CADOps as UI Apply without a new tool", () => {
    const server = new CadMcpServer();
    expect(server.listTools().tools.map((tool) => tool.name)).toContain(
      "cad.batch"
    );
    expect(server.listTools().tools.map((tool) => tool.name)).not.toContain(
      "datum.axis.create"
    );

    const dryRun = server.callTool({
      name: "cad.batch",
      requestId: "mcp_datum_axis_pattern",
      arguments: {
        batch: {
          version: "cadops.v1",
          mode: "dryRun",
          ops: [...DATUM_AXIS_CADOPS]
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
        createdDatumIds: ["datum_axis_z"],
        createdFeatureIds: expect.arrayContaining(["feat_pattern"]),
        createdBodyIds: expect.arrayContaining(["body_patterned"]),
        review: {
          operations: expect.arrayContaining([
            expect.objectContaining({
              op: "datum.axis.create",
              datumId: "datum_axis_z",
              label: expect.stringContaining("datum axis")
            }),
            expect.objectContaining({
              op: "feature.circularPattern",
              featureId: "feat_pattern",
              label: expect.stringContaining("datum_axis_z")
            })
          ])
        }
      }
    });
  });

  it("commits datum.axis.create through cad.batch and exposes it on project.structure", () => {
    const server = new CadMcpServer();
    const committed = server.callTool({
      name: "cad.batch",
      requestId: "mcp_datum_axis_commit",
      arguments: {
        allowCommit: true,
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [
            {
              op: "datum.axis.create",
              id: "datum_axis_z",
              name: "Z axis",
              axis: { kind: "globalAxis", axis: "z" }
            }
          ]
        }
      }
    });
    expect(committed).toMatchObject({
      toolName: "cad.batch",
      isError: false,
      structuredContent: {
        ok: true,
        createdDatumIds: ["datum_axis_z"]
      }
    });

    const structure = server.callTool({
      name: "cad.project_structure",
      requestId: "mcp_datum_axis_structure"
    });
    expect(PRIVATE_ID_PATTERN.test(JSON.stringify(structure.structuredContent))).toBe(
      false
    );
    expect(structure).toMatchObject({
      structuredContent: {
        ok: true,
        datums: expect.arrayContaining([
          expect.objectContaining({
            id: "datum_axis_z",
            kind: "axis",
            axis: { kind: "globalAxis", axis: "z" }
          })
        ])
      }
    });
  });
});
