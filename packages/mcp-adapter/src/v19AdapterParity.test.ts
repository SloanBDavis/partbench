import {
  createCadOpsAgentAdapter,
  type CadOpsAgentQueryResponse
} from "@web-cad/agent-adapter";
import { describe, expect, it, vi } from "vitest";
import {
  createCadMcpServer,
  type CadMcpToolCallResult,
  type CadMcpServer
} from "./index";

const SOURCE_REVISION = `partbench-source-v1:${"2".repeat(64)}`;

type ReadyCurveEditResponse = Extract<
  CadOpsAgentQueryResponse,
  {
    readonly ok: true;
    readonly query: "sketch.curveEditReadiness";
    readonly status: "ready";
  }
>;

function requireReadyCurveEdit(
  result: CadMcpToolCallResult
): ReadyCurveEditResponse {
  const response = result.structuredContent;
  if (
    !response.ok ||
    !("query" in response) ||
    response.query !== "sketch.curveEditReadiness" ||
    !("status" in response) ||
    response.status !== "ready"
  ) {
    throw new Error(`Expected ready curve edit: ${JSON.stringify(response)}`);
  }
  return response as ReadyCurveEditResponse;
}

function createTrimServer(): CadMcpServer {
  const adapter = createCadOpsAgentAdapter();
  adapter.getEngine().applyBatch([
    { op: "sketch.create", id: "sketch_1", name: "Edit", plane: "XY" },
    {
      op: "sketch.addLine",
      sketchId: "sketch_1",
      id: "target",
      start: [0, 0],
      end: [10, 0]
    },
    {
      op: "sketch.addLine",
      sketchId: "sketch_1",
      id: "boundary_a",
      start: [3, -2],
      end: [3, 2]
    },
    {
      op: "sketch.addLine",
      sketchId: "sketch_1",
      id: "boundary_b",
      start: [7, -2],
      end: [7, 2]
    }
  ]);
  return createCadMcpServer({ adapter });
}

describe("V19 MCP adapter parity", () => {
  it("publishes typed curve and region discovery tools with boundary notes", () => {
    const tools = createCadMcpServer().listTools().tools;

    expect(tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        "cad.sketch_curve_edit_readiness",
        "cad.sketch_profile_region_candidates",
        "cad.sketch_profile_region_validate"
      ])
    );
    expect(
      tools.find((tool) => tool.name === "cad.sketch_curve_edit_readiness")
        ?.description
    ).toContain("only operation");
    expect(
      tools.find((tool) => tool.name === "cad.sketch_curve_edit_readiness")
        ?.description
    ).toContain("exact constraint/dimension deletion lists");
    expect(
      tools.find((tool) => tool.name === "cad.sketch_profile_region_candidates")
        ?.description
    ).toContain("derived");
    const curveSchema = tools.find(
      (tool) => tool.name === "cad.sketch_curve_edit_readiness"
    )?.inputSchema;
    expect(curveSchema).toMatchObject({
      additionalProperties: false,
      required: ["proposal"],
      properties: {
        proposal: {
          oneOf: expect.arrayContaining([
            expect.objectContaining({
              required: ["kind", "sketchId", "entityId", "splitPoints"]
            })
          ])
        }
      }
    });
    expect(JSON.stringify(curveSchema)).toContain("model space");
    expect(JSON.stringify(curveSchema)).toContain("Pixel");
    const batchTool = tools.find((tool) => tool.name === "cad.batch");
    expect(batchTool?.description).toContain(
      "deleteConstraintIds and deleteDimensionIds"
    );
    expect(batchTool?.description).toContain(
      "exactly that one curve-edit operation"
    );
    expect(batchTool?.inputSchema).toMatchObject({
      properties: {
        batch: {
          additionalProperties: false,
          required: ["version", "mode", "ops"]
        }
      }
    });
    expect(JSON.stringify(batchTool?.inputSchema)).toContain("opaque");
    const regionSchema = tools.find(
      (tool) => tool.name === "cad.sketch_profile_region_validate"
    )?.inputSchema;
    expect(regionSchema).toMatchObject({
      properties: {
        profile: {
          additionalProperties: false,
          properties: {
            regions: {
              items: expect.objectContaining({
                additionalProperties: false,
                required: ["outer", "holes"]
              })
            }
          }
        }
      }
    });
  });

  it("preserves full readiness evidence and curve-edit batch audit metadata", () => {
    const server = createTrimServer();
    const readinessResult = server.callTool({
      name: "cad.sketch_curve_edit_readiness",
      requestId: "mcp_trim_readiness",
      arguments: {
        proposal: {
          kind: "trim",
          sketchId: "sketch_1",
          entityId: "target",
          boundaryEntityIds: ["boundary_a", "boundary_b"],
          pickPoint: [5, 0]
        }
      }
    });
    const readiness = requireReadyCurveEdit(readinessResult);

    expect(readinessResult).toMatchObject({
      isError: false,
      structuredContent: {
        requestId: "mcp_trim_readiness",
        status: "ready",
        preparedOperation: {
          op: "sketch.trim",
          createdEntityIds: expect.any(Array),
          deleteConstraintIds: [],
          deleteDimensionIds: []
        },
        impact: {
          operation: "trim",
          replacements: expect.any(Array),
          constraintImpacts: expect.any(Array),
          dimensionImpacts: expect.any(Array),
          requiredDeleteConstraintIds: [],
          requiredDeleteDimensionIds: []
        },
        preview: {
          intersections: expect.any(Array),
          projectedSplitParameters: expect.any(Array),
          resultEntities: expect.any(Array)
        },
        diagnostics: []
      }
    });

    const dryRun = server.callTool({
      name: "cad.batch",
      requestId: "mcp_prepared_trim",
      arguments: {
        batch: {
          version: "cadops.v1",
          mode: "dryRun",
          ops: [readiness.preparedOperation]
        }
      }
    });
    expect(dryRun).toMatchObject({
      isError: false,
      structuredContent: {
        ok: true,
        mode: "dryRun",
        semanticDiff: {
          sketches: {
            curveEdits: [
              {
                operation: "trim",
                constraintImpacts: expect.any(Array),
                dimensionImpacts: expect.any(Array)
              }
            ]
          }
        },
        review: {
          operationCount: 1,
          operations: [
            {
              op: "sketch.trim",
              sketchId: "sketch_1",
              sketchEntityId: "target"
            }
          ],
          audit: {
            source: "mcp",
            requestId: "mcp_prepared_trim",
            toolName: "cad.batch",
            intent: "dryRun"
          }
        }
      }
    });
  });

  it("reports explode-rectangle source deletion as destructive", () => {
    const adapter = createCadOpsAgentAdapter();
    adapter.getEngine().applyBatch([
      { op: "sketch.create", id: "sketch_1", name: "Edit", plane: "XY" },
      {
        op: "sketch.addRectangle",
        sketchId: "sketch_1",
        id: "rectangle_1",
        center: [0, 0],
        width: 6,
        height: 4
      }
    ]);
    const server = createCadMcpServer({ adapter });
    const ready = requireReadyCurveEdit(
      server.callTool({
        name: "cad.sketch_curve_edit_readiness",
        arguments: {
          proposal: {
            kind: "explodeRectangle",
            sketchId: "sketch_1",
            entityId: "rectangle_1"
          }
        }
      })
    );
    const result = server.callTool({
      name: "cad.batch",
      requestId: "mcp_explode_rectangle",
      arguments: {
        batch: {
          version: "cadops.v1",
          mode: "dryRun",
          ops: [ready.preparedOperation]
        }
      }
    });

    expect(result).toMatchObject({
      isError: false,
      structuredContent: {
        ok: true,
        deletedSketchEntityIds: ["rectangle_1"],
        review: {
          operations: [{ op: "sketch.explodeRectangle", destructive: true }],
          hints: [
            {
              code: "DESTRUCTIVE_DELETE",
              severity: "warning",
              op: "sketch.explodeRectangle"
            }
          ],
          audit: {
            source: "mcp",
            requestId: "mcp_explode_rectangle",
            toolName: "cad.batch"
          }
        }
      }
    });
  });

  it("accepts a direct curve-edit commit and returns exact impact on list mismatch", () => {
    const directServer = createTrimServer();
    const ready = requireReadyCurveEdit(
      directServer.callTool({
        name: "cad.sketch_curve_edit_readiness",
        arguments: {
          proposal: {
            kind: "trim",
            sketchId: "sketch_1",
            entityId: "target",
            boundaryEntityIds: ["boundary_a", "boundary_b"],
            pickPoint: [5, 0]
          }
        }
      })
    );
    if (ready.preparedOperation.op !== "sketch.trim") {
      throw new Error("Expected prepared trim.");
    }
    const directCommit = directServer.callTool({
      name: "cad.batch",
      requestId: "mcp_direct_trim",
      arguments: {
        allowCommit: true,
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [
            {
              op: ready.preparedOperation.op,
              sketchId: ready.preparedOperation.sketchId,
              entityId: ready.preparedOperation.entityId,
              boundaryEntityIds: ready.preparedOperation.boundaryEntityIds,
              pickPoint: ready.preparedOperation.pickPoint,
              precondition: ready.preparedOperation.precondition
            }
          ]
        }
      }
    });
    expect(directCommit).toMatchObject({
      isError: false,
      structuredContent: {
        ok: true,
        mode: "commit",
        transactionId: expect.any(String),
        review: {
          commitGate: { permissionProvided: true, blocked: false },
          audit: {
            source: "mcp",
            requestId: "mcp_direct_trim"
          }
        }
      }
    });

    const mismatchAdapter = createCadOpsAgentAdapter();
    mismatchAdapter.getEngine().applyBatch([
      {
        op: "sketch.create",
        id: "sketch_1",
        name: "Edit",
        plane: "XY"
      },
      {
        op: "sketch.addLine",
        sketchId: "sketch_1",
        id: "target",
        start: [0, 0],
        end: [6, 0]
      },
      {
        op: "sketch.dimension.create",
        id: "length_dimension",
        name: "Length",
        sketchId: "sketch_1",
        entityId: "target",
        target: { entityKind: "line", role: "length" },
        value: 6
      }
    ]);
    const mismatchServer = createCadMcpServer({
      adapter: mismatchAdapter
    });
    const split = requireReadyCurveEdit(
      mismatchServer.callTool({
        name: "cad.sketch_curve_edit_readiness",
        arguments: {
          proposal: {
            kind: "split",
            sketchId: "sketch_1",
            entityId: "target",
            splitPoints: [[3, 0]]
          }
        }
      })
    );
    if (split.preparedOperation.op !== "sketch.split") {
      throw new Error("Expected prepared split.");
    }
    const mismatch = mismatchServer.callTool({
      name: "cad.batch",
      requestId: "mcp_split_mismatch",
      arguments: {
        batch: {
          version: "cadops.v1",
          mode: "dryRun",
          ops: [
            {
              ...split.preparedOperation,
              deleteDimensionIds: ["length_dimension", "length_dimension"]
            }
          ]
        }
      }
    });
    expect(mismatch).toMatchObject({
      isError: true,
      structuredContent: {
        ok: false,
        error: {
          code: "SKETCH_EDIT_DELETE_LIST_MISMATCH",
          curveEditImpact: split.impact
        },
        review: {
          operations: [{ op: "sketch.split", destructive: true }],
          audit: {
            source: "mcp",
            requestId: "mcp_split_mismatch",
            toolName: "cad.batch"
          }
        }
      }
    });
  }, 20_000);

  it("passes valid V19 query shapes through with the original query identity", () => {
    const adapter = createCadOpsAgentAdapter();
    vi.spyOn(adapter, "query").mockImplementation((request) => ({
      ok: false,
      requestId: request.requestId,
      adapterVersion: request.adapterVersion,
      cadOpsVersion: "cadops.v1",
      query: request.query.query.query,
      error: {
        code: "UNKNOWN_QUERY",
        message: "Slice-specific query implementation is not installed."
      }
    }));
    const server = createCadMcpServer({ adapter });
    const calls = [
      {
        name: "cad.sketch_curve_edit_readiness",
        arguments: {
          proposal: {
            kind: "split",
            sketchId: "sketch_1",
            entityId: "line_1",
            splitPoints: [[5, 0]]
          }
        },
        query: "sketch.curveEditReadiness"
      },
      {
        name: "cad.sketch_profile_region_candidates",
        arguments: {
          sketchId: "sketch_1",
          limit: 10,
          afterCandidateKey: "candidate_1",
          sourceRevision: SOURCE_REVISION
        },
        query: "sketch.profileRegionCandidates"
      },
      {
        name: "cad.sketch_profile_region_validate",
        arguments: {
          profile: {
            kind: "regions",
            sketchId: "sketch_1",
            regions: [
              {
                outer: { kind: "entity", entityId: "circle_outer" },
                holes: []
              }
            ]
          }
        },
        query: "sketch.profileRegionValidate"
      }
    ] as const;

    for (const call of calls) {
      const result = server.callTool({
        name: call.name,
        arguments: call.arguments,
        requestId: `request_${call.query}`
      });
      expect(result.structuredContent).toMatchObject({
        query: call.query
      });
    }
  });

  it("rejects malformed V19 query and mutation shapes as invalid arguments", () => {
    const server = createCadMcpServer();
    const malformedQuery = server.callTool({
      name: "cad.sketch_profile_region_candidates",
      arguments: {
        sketchId: "sketch_1",
        afterCandidateKey: "opaque_without_revision"
      }
    });
    expect(malformedQuery).toMatchObject({
      isError: true,
      structuredContent: {
        ok: false,
        error: { code: "INVALID_ARGUMENTS" }
      }
    });

    expect(
      server.callTool({
        name: "cad.sketch_curve_edit_readiness",
        arguments: {
          query: "sketch.curveEditReadiness",
          proposal: {
            kind: "split",
            sketchId: "sketch_1",
            entityId: "line_1",
            splitPoints: [[2, 0]]
          }
        }
      })
    ).toMatchObject({
      isError: true,
      structuredContent: {
        ok: false,
        error: { code: "INVALID_ARGUMENTS" }
      }
    });

    const malformedBatch = server.callTool({
      name: "cad.batch",
      arguments: {
        batch: {
          version: "cadops.v1",
          mode: "dryRun",
          ops: [
            {
              op: "sketch.dimension.update",
              id: "dimension_1",
              target: {
                kind: "pointPair",
                primary: {
                  kind: "entityPoint",
                  entityId: "line_1",
                  role: "start"
                },
                secondary: {
                  kind: "entityPoint",
                  entityId: "line_2",
                  role: "end"
                },
                measurement: "horizontal"
              },
              value: 2
            }
          ]
        }
      }
    });
    expect(malformedBatch).toMatchObject({
      isError: true,
      structuredContent: {
        ok: false,
        error: { code: "INVALID_ARGUMENTS" }
      }
    });

    for (const arguments_ of [
      {
        batch: { version: "cadops.v1", mode: "dryRun", ops: [] },
        allowCommit: "true"
      },
      {
        batch: { version: "cadops.v1", mode: "dryRun", ops: [] },
        actor: { type: "robot" }
      },
      {
        batch: { version: "cadops.v1", mode: "dryRun", ops: [] },
        screenshot: true
      }
    ]) {
      expect(
        server.callTool({
          name: "cad.batch",
          arguments: arguments_
        })
      ).toMatchObject({
        isError: true,
        structuredContent: {
          ok: false,
          error: { code: "INVALID_ARGUMENTS" }
        }
      });
    }

    for (const extra of [
      { pixelX: 320 },
      { viewport: { width: 800, height: 600 } },
      { screenshot: "data:image/png;base64,opaque" },
      { candidateToken: "opaque-selection-token" }
    ]) {
      expect(
        server.callTool({
          name: "cad.batch",
          arguments: {
            batch: {
              version: "cadops.v1",
              mode: "dryRun",
              ops: [],
              ...extra
            }
          }
        })
      ).toMatchObject({
        isError: true,
        structuredContent: {
          ok: false,
          error: { code: "INVALID_ARGUMENTS" }
        }
      });
    }

    for (const nested of [
      { actor: { type: "agent", screenshot: "opaque" } },
      {
        audit: {
          intent: "dryRun",
          operationCount: 0,
          candidateToken: "opaque-selection-token"
        }
      }
    ]) {
      expect(
        server.callTool({
          name: "cad.batch",
          arguments: {
            batch: {
              version: "cadops.v1",
              mode: "dryRun",
              ops: [],
              ...nested
            }
          }
        })
      ).toMatchObject({
        isError: true,
        structuredContent: {
          ok: false,
          error: { code: "INVALID_ARGUMENTS" }
        }
      });
    }
  });
});
