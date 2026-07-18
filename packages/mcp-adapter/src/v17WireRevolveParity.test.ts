import { describe, expect, it } from "vitest";

import { CadMcpServer } from "./index";

const sketchId = "mcp_revolve_sketch";
const profile = {
  kind: "wire",
  sketchId,
  segments: [
    { entityId: "diameter", orientation: "forward" },
    { entityId: "arc", orientation: "forward" }
  ]
};
const normalizedProfile = {
  kind: "wire",
  sketchId,
  segments: [
    { entityId: "arc", orientation: "reverse" },
    { entityId: "diameter", orientation: "reverse" }
  ]
};
const retargetProfile = {
  kind: "wire",
  sketchId,
  segments: [
    { entityId: "retarget_diameter", orientation: "forward" },
    { entityId: "retarget_arc", orientation: "forward" }
  ]
};
const normalizedRetargetProfile = {
  kind: "wire",
  sketchId,
  segments: [
    { entityId: "retarget_arc", orientation: "reverse" },
    { entityId: "retarget_diameter", orientation: "reverse" }
  ]
};

function callBatch(
  server: CadMcpServer,
  requestId: string,
  mode: "dryRun" | "commit",
  ops: readonly unknown[]
) {
  return server.callTool({
    name: "cad.batch",
    requestId,
    arguments: {
      ...(mode === "commit" ? { allowCommit: true } : {}),
      batch: { version: "cadops.v1", mode, ops }
    }
  });
}

describe("V17 composite wire revolve MCP parity", () => {
  it("preserves normalized batch/query evidence and structured revolve failures", () => {
    const server = new CadMcpServer();
    expect(
      callBatch(server, "mcp_revolve_seed", "commit", [
        {
          op: "sketch.create",
          id: sketchId,
          name: "Wire revolve",
          plane: "XY"
        },
        {
          op: "sketch.addLine",
          sketchId,
          id: "diameter",
          start: [1, -1],
          end: [1, 1]
        },
        {
          op: "sketch.addArc",
          sketchId,
          id: "arc",
          definition: {
            kind: "centerAngles",
            center: [1, 0],
            radius: 1,
            startAngleDegrees: 90,
            sweepAngleDegrees: -180
          }
        },
        {
          op: "sketch.addLine",
          sketchId,
          id: "axis",
          start: [0, -2],
          end: [0, 2],
          construction: true
        },
        {
          op: "sketch.addLine",
          sketchId,
          id: "retarget_diameter",
          start: [3, -1],
          end: [3, 1]
        },
        {
          op: "sketch.addArc",
          sketchId,
          id: "retarget_arc",
          definition: {
            kind: "centerAngles",
            center: [3, 0],
            radius: 1,
            startAngleDegrees: 90,
            sweepAngleDegrees: -180
          }
        },
        {
          op: "sketch.addLine",
          sketchId,
          id: "crossing_axis",
          start: [1.5, -2],
          end: [1.5, 2],
          construction: true
        },
        {
          op: "sketch.addLine",
          sketchId,
          id: "overlap_axis",
          start: [1, -2],
          end: [1, 2],
          construction: true
        }
      ])
    ).toMatchObject({ isError: false, structuredContent: { ok: true } });
    const operation = {
      op: "feature.revolve",
      id: "mcp_wire_revolve",
      bodyId: "mcp_wire_revolve_body",
      profile,
      axis: { type: "sketchLine", sketchId, entityId: "axis" },
      angleDegrees: 270,
      operationMode: "newBody"
    };
    const dryRun = callBatch(server, "mcp_revolve_dry_run", "dryRun", [
      operation
    ]);
    const commit = callBatch(server, "mcp_revolve_commit", "commit", [
      operation
    ]);
    for (const result of [dryRun, commit]) {
      expect(result).toMatchObject({
        toolName: "cad.batch",
        isError: false,
        structuredContent: {
          ok: true,
          createdFeatureIds: ["mcp_wire_revolve"],
          createdBodyIds: ["mcp_wire_revolve_body"],
          semanticDiff: {
            features: {
              created: [
                expect.objectContaining({
                  id: "mcp_wire_revolve",
                  profile: normalizedProfile,
                  operationMode: "newBody"
                })
              ],
              inputReferences: [
                expect.objectContaining({
                  featureId: "mcp_wire_revolve",
                  after: normalizedProfile,
                  affectedEntityIds: ["arc", "diameter"],
                  profileOrientationNormalized: true
                })
              ]
            }
          }
        }
      });
    }

    expect(
      server.callTool({
        name: "cad.project_structure",
        requestId: "mcp_revolve_structure"
      })
    ).toMatchObject({
      isError: false,
      structuredContent: {
        ok: true,
        features: [
          expect.objectContaining({
            id: "mcp_wire_revolve",
            profile: normalizedProfile,
            operationMode: "newBody"
          })
        ]
      }
    });
    expect(
      server.callTool({
        name: "cad.project_export_exact",
        requestId: "mcp_revolve_export",
        arguments: {
          format: "step",
          bodyIds: ["mcp_wire_revolve_body"]
        }
      })
    ).toMatchObject({
      isError: false,
      structuredContent: {
        ok: true,
        available: true,
        exportSources: [
          expect.objectContaining({
            sourceKind: "authoredRevolve",
            sourceSketchEntityIds: ["arc", "diameter"],
            solidPolicy: "exactlyOne",
            axis: expect.objectContaining({ sourceEntityId: "axis" })
          })
        ]
      }
    });

    const updateOperation = {
      op: "feature.updateRevolve",
      id: "mcp_wire_revolve",
      profile: retargetProfile,
      angleDegrees: 180
    };
    for (const result of [
      callBatch(server, "mcp_revolve_update_dry", "dryRun", [updateOperation]),
      callBatch(server, "mcp_revolve_update_commit", "commit", [
        updateOperation
      ])
    ]) {
      expect(result).toMatchObject({
        isError: false,
        structuredContent: {
          ok: true,
          semanticDiff: {
            features: {
              modified: [
                expect.objectContaining({
                  id: "mcp_wire_revolve",
                  profile: normalizedRetargetProfile,
                  angleDegrees: 180
                })
              ],
              inputReferences: [
                expect.objectContaining({
                  after: normalizedRetargetProfile,
                  affectedEntityIds: [
                    "arc",
                    "diameter",
                    "retarget_arc",
                    "retarget_diameter"
                  ],
                  profileOrientationNormalized: true
                })
              ]
            }
          }
        }
      });
    }
    expect(
      server.callTool({
        name: "cad.project_structure",
        requestId: "mcp_revolve_retargeted_structure"
      })
    ).toMatchObject({
      isError: false,
      structuredContent: {
        features: [
          expect.objectContaining({
            id: "mcp_wire_revolve",
            profile: normalizedRetargetProfile,
            angleDegrees: 180
          })
        ]
      }
    });

    for (const [index, invalidCase] of [
      ["add", "axis", "UNSUPPORTED_FEATURE_OPERATION"],
      ["newBody", "crossing_axis", "COMPOSITE_REVOLVE_AXIS_INTERSECTION"],
      ["newBody", "overlap_axis", "COMPOSITE_REVOLVE_AXIS_INTERSECTION"]
    ].entries()) {
      const [operationMode, axisEntityId, code] = invalidCase;
      expect(
        callBatch(server, `mcp_revolve_invalid_${index}`, "dryRun", [
          {
            ...operation,
            id: `mcp_invalid_revolve_${index}`,
            bodyId: `mcp_invalid_body_${index}`,
            operationMode,
            axis: { type: "sketchLine", sketchId, entityId: axisEntityId }
          }
        ])
      ).toMatchObject({
        toolName: "cad.batch",
        isError: true,
        structuredContent: { ok: false, error: { code } }
      });
    }
  });
});
