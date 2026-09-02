import { describe, expect, it } from "vitest";
import { CadMcpServer } from "./index";

const PRIVATE_ID_PATTERN = /snapshot-local|raw-occt|entitySignature|localId/i;

const ALIGN_CADOPS = [
  { op: "sketch.create", id: "sketch_target", name: "Target", plane: "XY" },
  {
    op: "sketch.addRectangle",
    sketchId: "sketch_target",
    id: "rect_target",
    center: [0, 0],
    width: 20,
    height: 20
  },
  {
    op: "feature.extrude",
    id: "feat_target",
    bodyId: "body_target",
    sketchId: "sketch_target",
    entityId: "rect_target",
    depth: 10
  },
  {
    op: "sketch.create",
    id: "sketch_source_face",
    name: "Face source",
    plane: "XY"
  },
  {
    op: "sketch.addRectangle",
    sketchId: "sketch_source_face",
    id: "rect_source_face",
    center: [40, 0],
    width: 10,
    height: 10
  },
  {
    op: "feature.extrude",
    id: "feat_source_face",
    bodyId: "body_source_face",
    sketchId: "sketch_source_face",
    entityId: "rect_source_face",
    depth: 8
  },
  {
    op: "sketch.create",
    id: "sketch_source_plane",
    name: "Plane source",
    plane: "XY"
  },
  {
    op: "sketch.addRectangle",
    sketchId: "sketch_source_plane",
    id: "rect_source_plane",
    center: [80, 0],
    width: 10,
    height: 10
  },
  {
    op: "feature.extrude",
    id: "feat_source_plane",
    bodyId: "body_source_plane",
    sketchId: "sketch_source_plane",
    entityId: "rect_source_plane",
    depth: 8
  },
  {
    op: "sketch.create",
    id: "sketch_source_axis",
    name: "Axis source",
    plane: "XY"
  },
  {
    op: "sketch.addRectangle",
    sketchId: "sketch_source_axis",
    id: "rect_source_axis",
    center: [120, 0],
    width: 10,
    height: 10
  },
  {
    op: "feature.extrude",
    id: "feat_source_axis",
    bodyId: "body_source_axis",
    sketchId: "sketch_source_axis",
    entityId: "rect_source_axis",
    depth: 8
  },
  {
    op: "datum.plane.create",
    id: "datum_xy_20",
    name: "XY 20",
    plane: { kind: "standardPlane", plane: "XY", offset: 20 }
  },
  {
    op: "datum.axis.create",
    id: "datum_axis_z",
    name: "Z axis",
    axis: { kind: "globalAxis", axis: "z" }
  },
  {
    op: "feature.align",
    id: "feat_align_face",
    bodyId: "body_align_face",
    seedBodyId: "body_source_face",
    sourceFace: {
      kind: "generatedFace",
      bodyId: "body_source_face",
      stableId: "generated:face:body_source_face:endCap"
    },
    target: {
      kind: "planarFace",
      face: {
        kind: "generatedFace",
        bodyId: "body_target",
        stableId: "generated:face:body_target:endCap"
      }
    }
  },
  {
    op: "feature.align",
    id: "feat_align_plane",
    bodyId: "body_align_plane",
    seedBodyId: "body_source_plane",
    sourceFace: {
      kind: "generatedFace",
      bodyId: "body_source_plane",
      stableId: "generated:face:body_source_plane:endCap"
    },
    target: { kind: "datumPlane", datumId: "datum_xy_20" }
  },
  {
    op: "feature.align",
    id: "feat_align_axis",
    bodyId: "body_align_axis",
    seedBodyId: "body_source_axis",
    sourceFace: {
      kind: "generatedFace",
      bodyId: "body_source_axis",
      stableId: "generated:face:body_source_axis:side:uMax"
    },
    target: { kind: "datumAxis", datumId: "datum_axis_z" }
  }
] as const;

describe("feature.align MCP pass-through", () => {
  it("commits the same feature.align CADOps as UI Apply without a new tool", () => {
    const server = new CadMcpServer();
    expect(server.listTools().tools.map((tool) => tool.name)).toContain(
      "cad.batch"
    );
    expect(server.listTools().tools.map((tool) => tool.name)).not.toContain(
      "feature.align"
    );

    const committed = server.callTool({
      name: "cad.batch",
      requestId: "mcp_align",
      arguments: {
        allowCommit: true,
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [...ALIGN_CADOPS]
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
          "feat_align_face",
          "feat_align_plane",
          "feat_align_axis"
        ]),
        createdBodyIds: expect.arrayContaining([
          "body_align_face",
          "body_align_plane",
          "body_align_axis"
        ])
      }
    });

    const structure = server.callTool({
      name: "cad.project_structure",
      requestId: "mcp_align_structure"
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
            id: "feat_align_face",
            kind: "align",
            transform: expect.objectContaining({ translation: [0, 0, 2] })
          }),
          expect.objectContaining({
            id: "feat_align_plane",
            kind: "align",
            transform: expect.objectContaining({ translation: [0, 0, 12] })
          }),
          expect.objectContaining({
            id: "feat_align_axis",
            kind: "align",
            transform: expect.objectContaining({ translation: [-125, 0, 0] })
          })
        ])
      }
    });
  });
});
