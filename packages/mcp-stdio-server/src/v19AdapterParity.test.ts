import { describe, expect, it } from "vitest";
import { createMcpStdioSession } from "./index";

interface StdioToolResponse {
  readonly jsonrpc: "2.0";
  readonly id: string;
  readonly result: {
    readonly toolName: string;
    readonly isError: boolean;
    readonly structuredContent: Record<string, unknown>;
  };
}

function callTool(
  session: ReturnType<typeof createMcpStdioSession>,
  id: string,
  name: string,
  arguments_: unknown
): StdioToolResponse {
  const response = session.handleMessage(
    JSON.stringify({
      jsonrpc: "2.0",
      id,
      method: "tools/call",
      params: { name, arguments: arguments_ }
    })
  );
  if ("error" in response) {
    throw new Error(`Unexpected JSON-RPC error: ${JSON.stringify(response)}`);
  }
  return response as StdioToolResponse;
}

describe("V19 stdio adapter parity", () => {
  it("carries V19 query identity and strict validation over JSON-RPC", () => {
    const session = createMcpStdioSession();
    const valid = session.handleMessage(
      JSON.stringify({
        jsonrpc: "2.0",
        id: "v19-region-query",
        method: "tools/call",
        params: {
          name: "cad.sketch_profile_region_candidates",
          arguments: {
            sketchId: "sketch_1",
            entityIds: ["circle_1"],
            limit: 20
          }
        }
      })
    );
    const invalid = session.handleMessage(
      JSON.stringify({
        jsonrpc: "2.0",
        id: "v19-bad-region-query",
        method: "tools/call",
        params: {
          name: "cad.sketch_profile_region_candidates",
          arguments: {
            sketchId: "sketch_1",
            limit: 1000,
            screenshot: "data:image/png;base64,opaque"
          }
        }
      })
    );

    expect(valid).toMatchObject({
      jsonrpc: "2.0",
      id: "v19-region-query",
      result: {
        toolName: "cad.sketch_profile_region_candidates",
        isError: true,
        structuredContent: {
          ok: false,
          error: { code: "UNKNOWN_QUERY" }
        }
      }
    });
    expect(invalid).toMatchObject({
      jsonrpc: "2.0",
      id: "v19-bad-region-query",
      result: {
        toolName: "cad.sketch_profile_region_candidates",
        isError: true,
        structuredContent: {
          ok: false,
          error: { code: "INVALID_ARGUMENTS" }
        }
      }
    });
  });

  it("preserves readiness, impact failures, audit, dry-run, and commit evidence", () => {
    const session = createMcpStdioSession();
    expect(
      callTool(session, "setup", "cad.batch", {
        allowCommit: true,
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [
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
          ]
        }
      })
    ).toMatchObject({
      result: { isError: false, structuredContent: { ok: true } }
    });

    const readiness = callTool(
      session,
      "split-readiness",
      "cad.sketch_curve_edit_readiness",
      {
        proposal: {
          kind: "split",
          sketchId: "sketch_1",
          entityId: "target",
          splitPoints: [[3, 0]]
        }
      }
    );
    expect(readiness).toMatchObject({
      result: {
        isError: false,
        structuredContent: {
          ok: true,
          requestId: "mcp_jsonrpc_split-readiness",
          query: "sketch.curveEditReadiness",
          status: "ready",
          preparedOperation: {
            op: "sketch.split",
            createdEntityIds: expect.any(Array),
            deleteConstraintIds: [],
            deleteDimensionIds: ["length_dimension"]
          },
          impact: {
            operation: "split",
            replacements: expect.any(Array),
            constraintImpacts: expect.any(Array),
            dimensionImpacts: expect.any(Array),
            requiredDeleteConstraintIds: [],
            requiredDeleteDimensionIds: ["length_dimension"]
          },
          preview: {
            projectedSplitParameters: [3],
            resultEntities: expect.any(Array)
          },
          diagnostics: []
        }
      }
    });
    const preparedOperation = readiness.result.structuredContent
      .preparedOperation as Record<string, unknown>;
    const impact = readiness.result.structuredContent.impact;

    expect(
      callTool(session, "split-dry-run", "cad.batch", {
        batch: {
          version: "cadops.v1",
          mode: "dryRun",
          ops: [preparedOperation]
        }
      })
    ).toMatchObject({
      result: {
        isError: false,
        structuredContent: {
          ok: true,
          mode: "dryRun",
          semanticDiff: {
            sketches: {
              curveEdits: [
                {
                  operation: "split",
                  requiredDeleteDimensionIds: ["length_dimension"],
                  deletedDimensionIds: ["length_dimension"]
                }
              ]
            }
          },
          review: {
            operations: [{ op: "sketch.split", destructive: true }],
            hints: [{ code: "DESTRUCTIVE_DELETE", severity: "warning" }],
            audit: {
              source: "mcp",
              requestId: "mcp_jsonrpc_split-dry-run",
              toolName: "cad.batch",
              intent: "dryRun"
            }
          }
        }
      }
    });

    expect(
      callTool(session, "split-mismatch", "cad.batch", {
        batch: {
          version: "cadops.v1",
          mode: "dryRun",
          ops: [
            {
              ...preparedOperation,
              deleteDimensionIds: ["length_dimension", "length_dimension"]
            }
          ]
        }
      })
    ).toMatchObject({
      result: {
        isError: true,
        structuredContent: {
          ok: false,
          error: {
            code: "SKETCH_EDIT_DELETE_LIST_MISMATCH",
            curveEditImpact: impact
          },
          review: {
            operations: [{ op: "sketch.split", destructive: true }],
            audit: {
              source: "mcp",
              requestId: "mcp_jsonrpc_split-mismatch",
              toolName: "cad.batch"
            }
          }
        }
      }
    });

    expect(
      callTool(session, "split-commit", "cad.batch", {
        allowCommit: true,
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [preparedOperation]
        }
      })
    ).toMatchObject({
      result: {
        isError: false,
        structuredContent: {
          ok: true,
          mode: "commit",
          transactionId: expect.any(String),
          review: {
            commitGate: { permissionProvided: true, blocked: false },
            audit: {
              source: "mcp",
              requestId: "mcp_jsonrpc_split-commit",
              intent: "commit"
            }
          }
        }
      }
    });
  });

  it("marks explode-rectangle destructive before the engine can apply it", () => {
    const session = createMcpStdioSession();
    const result = callTool(session, "explode-missing-rectangle", "cad.batch", {
      batch: {
        version: "cadops.v1",
        mode: "dryRun",
        ops: [
          {
            op: "sketch.explodeRectangle",
            sketchId: "missing_sketch",
            entityId: "missing_rectangle",
            precondition: {
              expectedSourceRevision: `partbench-source-v1:${"0".repeat(64)}`,
              expectedSolverEvaluationIdentity: "none"
            }
          }
        ]
      }
    });

    expect(result).toMatchObject({
      result: {
        isError: true,
        structuredContent: {
          ok: false,
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
              requestId: "mcp_jsonrpc_explode-missing-rectangle",
              toolName: "cad.batch"
            }
          }
        }
      }
    });
  });

  it("rejects pixel, opaque-token, and injected-query readiness inputs", () => {
    const session = createMcpStdioSession();
    for (const [id, extra] of [
      ["pixel", { pixelX: 320 }],
      ["token", { candidateToken: "opaque-selection-token" }],
      ["query", { query: "sketch.curveEditReadiness" }]
    ] as const) {
      expect(
        callTool(session, `bad-${id}`, "cad.sketch_curve_edit_readiness", {
          proposal: {
            kind: "split",
            sketchId: "sketch_1",
            entityId: "line_1",
            splitPoints: [[2, 0]],
            ...extra
          }
        })
      ).toMatchObject({
        result: {
          isError: true,
          structuredContent: {
            ok: false,
            error: { code: "INVALID_ARGUMENTS" }
          }
        }
      });
    }

    expect(
      callTool(
        session,
        "bad-top-level-query",
        "cad.sketch_curve_edit_readiness",
        {
          query: "sketch.curveEditReadiness",
          proposal: {
            kind: "split",
            sketchId: "sketch_1",
            entityId: "line_1",
            splitPoints: [[2, 0]]
          }
        }
      )
    ).toMatchObject({
      result: {
        isError: true,
        structuredContent: {
          ok: false,
          error: { code: "INVALID_ARGUMENTS" }
        }
      }
    });

    for (const [id, extra] of [
      ["pixel", { pixelX: 320 }],
      ["viewport", { viewport: { width: 800, height: 600 } }],
      ["screenshot", { screenshot: "data:image/png;base64,opaque" }],
      ["token", { candidateToken: "opaque-selection-token" }]
    ] as const) {
      expect(
        callTool(session, `bad-batch-${id}`, "cad.batch", {
          batch: {
            version: "cadops.v1",
            mode: "dryRun",
            ops: [],
            ...extra
          }
        })
      ).toMatchObject({
        result: {
          isError: true,
          structuredContent: {
            ok: false,
            error: { code: "INVALID_ARGUMENTS" }
          }
        }
      });
    }

    for (const [id, nested] of [
      ["actor", { actor: { type: "agent", screenshot: "opaque" } }],
      [
        "audit",
        {
          audit: {
            intent: "dryRun",
            operationCount: 0,
            candidateToken: "opaque-selection-token"
          }
        }
      ]
    ] as const) {
      expect(
        callTool(session, `bad-batch-${id}`, "cad.batch", {
          batch: {
            version: "cadops.v1",
            mode: "dryRun",
            ops: [],
            ...nested
          }
        })
      ).toMatchObject({
        result: {
          isError: true,
          structuredContent: {
            ok: false,
            error: { code: "INVALID_ARGUMENTS" }
          }
        }
      });
    }
  });
});
