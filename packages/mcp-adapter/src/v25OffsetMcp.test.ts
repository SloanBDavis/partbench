import { describe, expect, it } from "vitest";
import { CadMcpServer } from "./index";

const PRIVATE_ID_PATTERN = /snapshot-local|raw-occt|entitySignature|localId/i;

const OFFSET_CADOPS = [
  { op: "sketch.create", id: "sketch_plate", name: "Plate", plane: "XY" },
  {
    op: "sketch.addRectangle",
    sketchId: "sketch_plate",
    id: "rect_plate",
    center: [0, 0],
    width: 20,
    height: 12
  },
  { op: "sketch.create", id: "sketch_block", name: "Block", plane: "XY" },
  {
    op: "sketch.addRectangle",
    sketchId: "sketch_block",
    id: "rect_block",
    center: [40, 0],
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
    op: "feature.offset",
    id: "feat_profile_offset",
    bodyId: "body_profile_offset",
    source: {
      kind: "sketchProfile",
      profile: {
        kind: "entity",
        sketchId: "sketch_plate",
        entityId: "rect_plate"
      }
    },
    distance: 4,
    side: "outward"
  },
  {
    op: "feature.updateOffset",
    id: "feat_profile_offset",
    distance: 6
  },
  {
    op: "feature.offset",
    id: "feat_face_offset",
    bodyId: "body_face_offset",
    source: {
      kind: "face",
      face: {
        kind: "generatedFace",
        bodyId: "body_block",
        stableId: "generated:face:body_block:endCap"
      }
    },
    distance: 2,
    side: "outward"
  }
] as const;

describe("feature.offset MCP pass-through", () => {
  it("commits the same feature.offset CADOps as UI Apply without a new tool", () => {
    const server = new CadMcpServer();
    expect(server.listTools().tools.map((tool) => tool.name)).toContain(
      "cad.batch"
    );
    expect(server.listTools().tools.map((tool) => tool.name)).not.toContain(
      "feature.offset"
    );

    const committed = server.callTool({
      name: "cad.batch",
      requestId: "mcp_offset",
      arguments: {
        allowCommit: true,
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [...OFFSET_CADOPS]
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
        createdFeatureIds: expect.arrayContaining([
          "feat_profile_offset",
          "feat_face_offset"
        ]),
        createdBodyIds: expect.arrayContaining([
          "body_profile_offset",
          "body_face_offset"
        ])
      }
    });

    const structure = server.callTool({
      name: "cad.project_structure",
      requestId: "mcp_offset_structure"
    });
    expect(PRIVATE_ID_PATTERN.test(JSON.stringify(structure.structuredContent))).toBe(
      false
    );
    expect(structure).toMatchObject({
      isError: false,
      structuredContent: {
        ok: true,
        features: expect.arrayContaining([
          expect.objectContaining({
            id: "feat_profile_offset",
            kind: "offset",
            distance: 6
          }),
          expect.objectContaining({
            id: "feat_face_offset",
            kind: "offset",
            targetBodyId: "body_block"
          })
        ])
      }
    });
  });
});
