import { describe, expect, it } from "vitest";

import { createMcpStdioSession } from "./index";

const sketchId = "stdio_revolve_sketch";
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

describe("V17 composite wire revolve stdio parity", () => {
  it("preserves normalized JSON-RPC batch/query evidence and structured failures", () => {
    const session = createMcpStdioSession();
    const call = (id: string, name: string, argumentsValue: unknown = {}) => {
      const response = session.handleLine(
        JSON.stringify({
          jsonrpc: "2.0",
          id,
          method: "tools/call",
          params: { name, arguments: argumentsValue }
        })
      );
      if (!response) throw new Error("Expected JSON-RPC response.");
      return JSON.parse(response) as unknown;
    };
    const batch = (
      id: string,
      mode: "dryRun" | "commit",
      ops: readonly unknown[]
    ) =>
      call(id, "cad.batch", {
        ...(mode === "commit" ? { allowCommit: true } : {}),
        batch: { version: "cadops.v1", mode, ops }
      });

    expect(
      batch("stdio-revolve-seed", "commit", [
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
    ).toMatchObject({
      result: { toolName: "cad.batch", isError: false }
    });
    const operation = {
      op: "feature.revolve",
      id: "stdio_wire_revolve",
      bodyId: "stdio_wire_revolve_body",
      profile,
      axis: { type: "sketchLine", sketchId, entityId: "axis" },
      angleDegrees: 270,
      operationMode: "newBody"
    };
    const dryRun = batch("stdio-revolve-dry-run", "dryRun", [operation]);
    const commit = batch("stdio-revolve-commit", "commit", [operation]);
    for (const result of [dryRun, commit]) {
      expect(result).toMatchObject({
        jsonrpc: "2.0",
        result: {
          toolName: "cad.batch",
          isError: false,
          structuredContent: {
            ok: true,
            createdFeatureIds: ["stdio_wire_revolve"],
            semanticDiff: {
              features: {
                created: [
                  expect.objectContaining({
                    profile: normalizedProfile,
                    operationMode: "newBody"
                  })
                ],
                inputReferences: [
                  expect.objectContaining({
                    after: normalizedProfile,
                    affectedEntityIds: ["arc", "diameter"],
                    profileOrientationNormalized: true
                  })
                ]
              }
            }
          }
        }
      });
    }
    expect(
      call("stdio-revolve-structure", "cad.project_structure")
    ).toMatchObject({
      result: {
        isError: false,
        structuredContent: {
          features: [
            expect.objectContaining({
              id: "stdio_wire_revolve",
              profile: normalizedProfile
            })
          ]
        }
      }
    });
    expect(
      call("stdio-revolve-export", "cad.project_export_exact", {
        format: "step",
        bodyIds: ["stdio_wire_revolve_body"]
      })
    ).toMatchObject({
      result: {
        isError: false,
        structuredContent: {
          ok: true,
          available: true,
          exportSources: [
            expect.objectContaining({
              sourceKind: "authoredRevolve",
              sourceSketchEntityIds: ["arc", "diameter"],
              solidPolicy: "exactlyOne"
            })
          ]
        }
      }
    });

    const updateOperation = {
      op: "feature.updateRevolve",
      id: "stdio_wire_revolve",
      profile: retargetProfile,
      angleDegrees: 180
    };
    for (const result of [
      batch("stdio-revolve-update-dry", "dryRun", [updateOperation]),
      batch("stdio-revolve-update-commit", "commit", [updateOperation])
    ]) {
      expect(result).toMatchObject({
        result: {
          isError: false,
          structuredContent: {
            ok: true,
            semanticDiff: {
              features: {
                modified: [
                  expect.objectContaining({
                    id: "stdio_wire_revolve",
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
        }
      });
    }
    expect(
      call("stdio-revolve-retargeted", "cad.project_structure")
    ).toMatchObject({
      result: {
        isError: false,
        structuredContent: {
          features: [
            expect.objectContaining({
              id: "stdio_wire_revolve",
              profile: normalizedRetargetProfile,
              angleDegrees: 180
            })
          ]
        }
      }
    });

    for (const [index, invalidCase] of [
      ["add", "axis", "UNSUPPORTED_FEATURE_OPERATION"],
      ["newBody", "crossing_axis", "COMPOSITE_REVOLVE_AXIS_INTERSECTION"],
      ["newBody", "overlap_axis", "COMPOSITE_REVOLVE_AXIS_INTERSECTION"]
    ].entries()) {
      const [operationMode, axisEntityId, code] = invalidCase;
      expect(
        batch(`stdio-revolve-invalid-${index}`, "dryRun", [
          {
            ...operation,
            id: `stdio_invalid_revolve_${index}`,
            bodyId: `stdio_invalid_body_${index}`,
            operationMode,
            axis: { type: "sketchLine", sketchId, entityId: axisEntityId }
          }
        ])
      ).toMatchObject({
        result: {
          toolName: "cad.batch",
          isError: true,
          structuredContent: { ok: false, error: { code } }
        }
      });
    }
  });
});
