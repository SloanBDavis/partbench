import { describe, expect, it } from "vitest";
import { CadMcpServer } from "./index";

const PRIVATE_ID_PATTERN = /snapshot-local|raw-occt|entitySignature|localId/i;

describe("datum.plane.create MCP pass-through", () => {
  it("commits the same datum + sketch-on-datum CADOps as UI Apply without a new tool", () => {
    const server = new CadMcpServer();
    const seeded = server.callTool({
      name: "cad.batch",
      requestId: "mcp_clevis_seed",
      arguments: {
        allowCommit: true,
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [
            { op: "sketch.create", id: "sketch_plate", name: "Plate", plane: "XY" },
            {
              op: "sketch.addRectangle",
              sketchId: "sketch_plate",
              id: "rect_plate",
              center: [0, 0],
              width: 40,
              height: 40
            },
            {
              op: "feature.extrude",
              id: "feat_plate",
              bodyId: "body_plate",
              sketchId: "sketch_plate",
              entityId: "rect_plate",
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

    const datumsAndEars = server.callTool({
      name: "cad.batch",
      requestId: "mcp_clevis_datums",
      arguments: {
        allowCommit: true,
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [
            {
              op: "datum.plane.create",
              id: "datum_ear_a",
              name: "Ear A",
              plane: { kind: "standardPlane", plane: "XZ", offset: 15 }
            },
            {
              op: "sketch.create",
              id: "sketch_ear_a",
              name: "Ear A",
              datumId: "datum_ear_a"
            },
            {
              op: "sketch.addRectangle",
              sketchId: "sketch_ear_a",
              id: "rect_ear_a",
              center: [0, 12],
              width: 16,
              height: 24
            },
            {
              op: "feature.extrude",
              id: "feat_ear_a",
              bodyId: "body_ear_a",
              sketchId: "sketch_ear_a",
              entityId: "rect_ear_a",
              depth: 8
            }
          ]
        }
      }
    });
    expect(datumsAndEars).toMatchObject({
      toolName: "cad.batch",
      isError: false,
      structuredContent: {
        ok: true,
        createdDatumIds: ["datum_ear_a"],
        createdSketchIds: ["sketch_ear_a"],
        createdFeatureIds: ["feat_ear_a"],
        createdBodyIds: ["body_ear_a"]
      }
    });

    const structure = server.callTool({
      name: "cad.project_structure",
      requestId: "mcp_clevis_structure"
    });
    const publicJson = JSON.stringify(structure.structuredContent);
    expect(PRIVATE_ID_PATTERN.test(publicJson)).toBe(false);
    expect(structure).toMatchObject({
      structuredContent: {
        ok: true,
        datums: expect.arrayContaining([
          expect.objectContaining({
            id: "datum_ear_a",
            kind: "plane",
            plane: { kind: "standardPlane", plane: "XZ", offset: 15 }
          })
        ]),
        bodies: expect.arrayContaining([
          expect.objectContaining({
            id: "body_ear_a",
            featureId: "feat_ear_a"
          })
        ])
      }
    });
  });
});
