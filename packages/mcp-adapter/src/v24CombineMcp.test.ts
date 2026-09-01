import { describe, expect, it } from "vitest";
import { CadMcpServer } from "./index";

const PRIVATE_ID_PATTERN = /snapshot-local|raw-occt|entitySignature|localId/i;

describe("feature.combine MCP pass-through", () => {
  it("commits the same combine CADOps as UI Apply without a new tool", () => {
    const server = new CadMcpServer();
    const seeded = server.callTool({
      name: "cad.batch",
      requestId: "mcp_combine_seed",
      arguments: {
        allowCommit: true,
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [
            { op: "sketch.create", id: "sketch_hub", name: "Hub", plane: "XY" },
            {
              op: "sketch.addCircle",
              sketchId: "sketch_hub",
              id: "circle_hub",
              center: [0, 0],
              radius: 20
            },
            {
              op: "feature.extrude",
              id: "feat_hub",
              bodyId: "body_hub",
              sketchId: "sketch_hub",
              entityId: "circle_hub",
              depth: 10
            },
            {
              op: "sketch.createOnFace",
              id: "sketch_step",
              name: "Step",
              bodyId: "body_hub",
              faceStableId: "generated:face:body_hub:endCap"
            },
            {
              op: "sketch.addCircle",
              sketchId: "sketch_step",
              id: "circle_step",
              center: [0, 0],
              radius: 12
            },
            {
              op: "feature.extrude",
              id: "feat_step",
              bodyId: "body_step",
              sketchId: "sketch_step",
              entityId: "circle_step",
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

    const combine = server.callTool({
      name: "cad.batch",
      requestId: "mcp_combine_union",
      arguments: {
        allowCommit: true,
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [
            {
              op: "feature.combine",
              id: "feat_union",
              bodyId: "body_pulley",
              mode: "union",
              targetBodyId: "body_hub",
              toolBodyId: "body_step"
            }
          ]
        }
      }
    });
    expect(combine).toMatchObject({
      toolName: "cad.batch",
      isError: false,
      structuredContent: {
        ok: true,
        createdFeatureIds: ["feat_union"],
        createdBodyIds: ["body_pulley"]
      }
    });

    const structure = server.callTool({
      name: "cad.project_structure",
      requestId: "mcp_combine_structure"
    });
    const publicJson = JSON.stringify(structure.structuredContent);
    expect(PRIVATE_ID_PATTERN.test(publicJson)).toBe(false);
    expect(structure).toMatchObject({
      structuredContent: {
        ok: true,
        bodies: expect.arrayContaining([
          expect.objectContaining({
            id: "body_hub",
            consumedByFeatureId: "feat_union"
          }),
          expect.objectContaining({
            id: "body_step",
            consumedByFeatureId: "feat_union"
          }),
          expect.objectContaining({
            id: "body_pulley",
            featureId: "feat_union",
            source: expect.objectContaining({
              type: "combineFeature",
              mode: "union",
              targetBodyId: "body_hub",
              toolBodyId: "body_step"
            })
          })
        ])
      }
    });
  });
});
