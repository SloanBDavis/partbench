import { describe, expect, it } from "vitest";
import { CadMcpServer } from "./index";

const PRIVATE_ID_PATTERN = /snapshot-local|raw-occt|entitySignature|localId/i;

const FLANGE_CADOPS = [
  { op: "sketch.create", id: "sketch_disc", name: "Disc", plane: "XY" },
  {
    op: "sketch.addCircle",
    sketchId: "sketch_disc",
    id: "circle_disc",
    center: [0, 0],
    radius: 40
  },
  {
    op: "feature.extrude",
    id: "feat_disc",
    bodyId: "body_disc",
    sketchId: "sketch_disc",
    entityId: "circle_disc",
    depth: 8
  },
  { op: "sketch.create", id: "sketch_bore", name: "Bore", plane: "XY" },
  {
    op: "sketch.addCircle",
    sketchId: "sketch_bore",
    id: "circle_bore",
    center: [0, 0],
    radius: 8
  },
  {
    op: "feature.hole",
    id: "feat_bore",
    bodyId: "body_bored",
    targetBodyId: "body_disc",
    sketchId: "sketch_bore",
    circleEntityId: "circle_bore",
    depthMode: "throughAll"
  },
  { op: "sketch.create", id: "sketch_bolt", name: "Bolt", plane: "XY" },
  {
    op: "sketch.addCircle",
    sketchId: "sketch_bolt",
    id: "circle_bolt",
    center: [28, 0],
    radius: 3
  },
  {
    op: "feature.hole",
    id: "feat_bolt",
    bodyId: "body_bolt",
    targetBodyId: "body_bored",
    sketchId: "sketch_bolt",
    circleEntityId: "circle_bolt",
    depthMode: "throughAll"
  },
  {
    op: "feature.circularPattern",
    id: "feat_bolts",
    bodyId: "body_flange",
    seedFeatureId: "feat_bolt",
    rotationAxis: { kind: "globalAxis", axis: "z" },
    totalAngleDegrees: 360,
    instanceCount: 6
  }
] as const;

describe("feature pattern hole seed MCP pass-through", () => {
  it("submits the same grown circular hole-pattern CADOps as UI Apply without a new tool", () => {
    const server = new CadMcpServer();
    expect(server.listTools().tools.map((tool) => tool.name)).toContain(
      "cad.batch"
    );
    expect(server.listTools().tools.map((tool) => tool.name)).not.toContain(
      "feature.linearFeaturePattern"
    );

    const dryRun = server.callTool({
      name: "cad.batch",
      requestId: "mcp_flange_pattern",
      arguments: {
        batch: {
          version: "cadops.v1",
          mode: "dryRun",
          ops: [...FLANGE_CADOPS]
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
        createdFeatureIds: expect.arrayContaining(["feat_bolts"]),
        createdBodyIds: expect.arrayContaining(["body_flange"]),
        review: {
          operations: expect.arrayContaining([
            expect.objectContaining({
              op: "feature.circularPattern",
              featureId: "feat_bolts",
              label: expect.stringContaining("feat_bolt")
            })
          ])
        }
      }
    });
  });
});
