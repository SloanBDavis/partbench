import { describe, expect, it } from "vitest";

import { CadOpsAgentAdapter, executeCadOpsAgentQueryRequest } from "./index";

const sketchId = "agent_revolve_sketch";
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

function executeBatch(
  adapter: CadOpsAgentAdapter,
  requestId: string,
  mode: "dryRun" | "commit",
  ops: readonly unknown[]
) {
  return JSON.parse(
    adapter.executeJson(
      JSON.stringify({
        requestId,
        adapterVersion: "web-cad.agent-adapter.v1",
        ...(mode === "commit" ? { permissions: { allowCommit: true } } : {}),
        batch: { version: "cadops.v1", mode, ops }
      })
    )
  ) as unknown;
}

describe("V17 composite wire revolve agent parity", () => {
  it("preserves normalized batch/query evidence and structured revolve failures", () => {
    const adapter = new CadOpsAgentAdapter();
    const seed = executeBatch(adapter, "agent_revolve_seed", "commit", [
      { op: "sketch.create", id: sketchId, name: "Wire revolve", plane: "XY" },
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
    ]);
    const operation = {
      op: "feature.revolve",
      id: "agent_wire_revolve",
      bodyId: "agent_wire_revolve_body",
      profile,
      axis: { type: "sketchLine", sketchId, entityId: "axis" },
      angleDegrees: 270,
      operationMode: "newBody"
    };
    const dryRun = executeBatch(adapter, "agent_revolve_dry_run", "dryRun", [
      operation
    ]);
    const commit = executeBatch(adapter, "agent_revolve_commit", "commit", [
      operation
    ]);

    expect(seed).toMatchObject({ ok: true });
    for (const result of [dryRun, commit]) {
      expect(result).toMatchObject({
        ok: true,
        createdFeatureIds: ["agent_wire_revolve"],
        createdBodyIds: ["agent_wire_revolve_body"],
        semanticDiff: {
          features: {
            created: [
              expect.objectContaining({
                id: "agent_wire_revolve",
                profile: normalizedProfile,
                operationMode: "newBody"
              })
            ],
            inputReferences: [
              expect.objectContaining({
                featureId: "agent_wire_revolve",
                inputKind: "profile",
                after: normalizedProfile,
                affectedEntityIds: ["arc", "diameter"],
                profileOrientationNormalized: true
              })
            ]
          }
        }
      });
    }

    const structure = executeCadOpsAgentQueryRequest(adapter.getEngine(), {
      requestId: "agent_revolve_structure",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: { query: "project.structure" }
      }
    });
    const exactExport = executeCadOpsAgentQueryRequest(adapter.getEngine(), {
      requestId: "agent_revolve_export",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: {
          query: "project.exportExact",
          format: "step",
          bodyIds: ["agent_wire_revolve_body"]
        }
      }
    });
    expect(structure).toMatchObject({
      ok: true,
      features: [
        expect.objectContaining({
          id: "agent_wire_revolve",
          profile: normalizedProfile,
          operationMode: "newBody"
        })
      ]
    });
    expect(exactExport).toMatchObject({
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
    });

    const updateOperation = {
      op: "feature.updateRevolve",
      id: "agent_wire_revolve",
      profile: retargetProfile,
      angleDegrees: 180
    };
    for (const result of [
      executeBatch(adapter, "agent_revolve_update_dry", "dryRun", [
        updateOperation
      ]),
      executeBatch(adapter, "agent_revolve_update_commit", "commit", [
        updateOperation
      ])
    ]) {
      expect(result).toMatchObject({
        ok: true,
        semanticDiff: {
          features: {
            modified: [
              expect.objectContaining({
                id: "agent_wire_revolve",
                profile: normalizedRetargetProfile,
                angleDegrees: 180
              })
            ],
            inputReferences: [
              expect.objectContaining({
                featureId: "agent_wire_revolve",
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
      });
    }
    expect(
      executeCadOpsAgentQueryRequest(adapter.getEngine(), {
        requestId: "agent_revolve_retargeted_structure",
        adapterVersion: "web-cad.agent-adapter.v1",
        query: {
          version: "cadops.v1",
          query: { query: "project.structure" }
        }
      })
    ).toMatchObject({
      ok: true,
      features: [
        expect.objectContaining({
          id: "agent_wire_revolve",
          profile: normalizedRetargetProfile,
          angleDegrees: 180
        })
      ]
    });

    const invalidCases = [
      {
        operationMode: "add",
        axisEntityId: "axis",
        code: "UNSUPPORTED_FEATURE_OPERATION"
      },
      {
        operationMode: "newBody",
        axisEntityId: "crossing_axis",
        code: "COMPOSITE_REVOLVE_AXIS_INTERSECTION"
      },
      {
        operationMode: "newBody",
        axisEntityId: "overlap_axis",
        code: "COMPOSITE_REVOLVE_AXIS_INTERSECTION"
      }
    ] as const;
    for (const [index, invalidCase] of invalidCases.entries()) {
      expect(
        executeBatch(adapter, `agent_revolve_invalid_${index}`, "dryRun", [
          {
            ...operation,
            id: `agent_invalid_revolve_${index}`,
            bodyId: `agent_invalid_body_${index}`,
            operationMode: invalidCase.operationMode,
            axis: {
              type: "sketchLine",
              sketchId,
              entityId: invalidCase.axisEntityId
            }
          }
        ])
      ).toMatchObject({
        ok: false,
        error: { code: invalidCase.code }
      });
    }
  });
});
