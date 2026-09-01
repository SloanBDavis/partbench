import { describe, expect, it } from "vitest";
import { CadMcpServer } from "./index";

const PRIVATE_ID_PATTERN = /snapshot-local|raw-occt|entitySignature|localId/i;

describe("datum.axis.create MCP pass-through", () => {
  it("commits the same datum.axis.create + circular-pattern CADOps as UI Apply without a new tool", () => {
    const server = new CadMcpServer();
    const seeded = server.callTool({
      name: "cad.batch",
      requestId: "mcp_axis_seed",
      arguments: {
        allowCommit: true,
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [
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
            }
          ]
        }
      }
    });
    expect(seeded).toMatchObject({
      isError: false,
      structuredContent: { ok: true }
    });

    const axisAndPattern = server.callTool({
      name: "cad.batch",
      requestId: "mcp_axis_pattern",
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
          ]
        }
      }
    });
    expect(axisAndPattern).toMatchObject({
      toolName: "cad.batch",
      isError: false,
      structuredContent: {
        ok: true,
        createdDatumIds: ["datum_axis_z"],
        createdFeatureIds: ["feat_pattern"],
        createdBodyIds: ["body_patterned"]
      }
    });

    const structure = server.callTool({
      name: "cad.project_structure",
      requestId: "mcp_axis_structure"
    });
    const publicJson = JSON.stringify(structure.structuredContent);
    expect(PRIVATE_ID_PATTERN.test(publicJson)).toBe(false);
    expect(structure).toMatchObject({
      structuredContent: {
        ok: true,
        datums: expect.arrayContaining([
          expect.objectContaining({
            id: "datum_axis_z",
            kind: "axis",
            axis: { kind: "globalAxis", axis: "z" }
          })
        ]),
        features: expect.arrayContaining([
          expect.objectContaining({
            id: "feat_pattern",
            kind: "circularPattern",
            rotationAxis: { kind: "datumAxis", datumId: "datum_axis_z" }
          })
        ]),
        bodies: expect.arrayContaining([
          expect.objectContaining({
            id: "body_patterned",
            featureId: "feat_pattern"
          })
        ])
      }
    });
  });
});
