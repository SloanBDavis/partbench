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
  it("carries compact region pages and explicit validation over JSON-RPC", () => {
    const session = createMcpStdioSession();
    expect(
      callTool(session, "v19-region-setup", "cad.batch", {
        allowCommit: true,
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [
            {
              op: "sketch.create",
              id: "sketch_regions",
              name: "Regions",
              plane: "XY"
            },
            {
              op: "sketch.addRectangle",
              sketchId: "sketch_regions",
              id: "outer",
              center: [0, 0],
              width: 20,
              height: 20
            },
            {
              op: "sketch.addCircle",
              sketchId: "sketch_regions",
              id: "hole",
              center: [0, 0],
              radius: 4
            },
            {
              op: "sketch.addCircle",
              sketchId: "sketch_regions",
              id: "island",
              center: [0, 0],
              radius: 1
            },
            {
              op: "sketch.addCircle",
              sketchId: "sketch_regions",
              id: "other",
              center: [30, 0],
              radius: 2
            }
          ]
        }
      })
    ).toMatchObject({
      result: {
        isError: false,
        structuredContent: { ok: true, mode: "commit" }
      }
    });

    const first = callTool(
      session,
      "v19-region-page-1",
      "cad.sketch_profile_region_candidates",
      {
        sketchId: "sketch_regions",
        limit: 1
      }
    );
    expect(first).toMatchObject({
      jsonrpc: "2.0",
      id: "v19-region-page-1",
      result: {
        toolName: "cad.sketch_profile_region_candidates",
        isError: false,
        structuredContent: {
          ok: true,
          query: "sketch.profileRegionCandidates",
          sketchId: "sketch_regions",
          status: "ready",
          hasMore: true,
          candidates: [
            expect.objectContaining({ candidateKey: expect.any(String) })
          ]
        }
      }
    });
    const firstPage = first.result.structuredContent as {
      readonly sourceRevision: string;
      readonly candidateCount: number;
      readonly candidates: readonly {
        readonly candidateKey: string;
        readonly region: unknown;
      }[];
      readonly nextAfterCandidateKey: string;
    };
    expect(firstPage.candidates).toHaveLength(1);
    expect(firstPage.candidateCount).toBeGreaterThan(
      firstPage.candidates.length
    );

    const second = callTool(
      session,
      "v19-region-page-2",
      "cad.sketch_profile_region_candidates",
      {
        sketchId: "sketch_regions",
        limit: 1,
        afterCandidateKey: firstPage.nextAfterCandidateKey,
        sourceRevision: firstPage.sourceRevision
      }
    );
    expect(second).toMatchObject({
      result: {
        isError: false,
        structuredContent: {
          ok: true,
          query: "sketch.profileRegionCandidates",
          sourceRevision: firstPage.sourceRevision,
          candidates: [
            expect.objectContaining({ candidateKey: expect.any(String) })
          ]
        }
      }
    });
    const secondPage = second.result.structuredContent as {
      readonly candidates: readonly { readonly candidateKey: string }[];
    };
    expect(secondPage.candidates).toHaveLength(1);
    expect(secondPage.candidates[0]?.candidateKey).not.toBe(
      firstPage.candidates[0]?.candidateKey
    );

    const profile = {
      kind: "regions",
      sketchId: "sketch_regions",
      regions: [firstPage.candidates[0]?.region]
    };
    expect(
      callTool(
        session,
        "v19-region-validate",
        "cad.sketch_profile_region_validate",
        { profile }
      )
    ).toMatchObject({
      result: {
        toolName: "cad.sketch_profile_region_validate",
        isError: false,
        structuredContent: {
          ok: true,
          query: "sketch.profileRegionValidate",
          status: "ready",
          requestedProfile: profile,
          normalizedProfile: profile,
          diagnostics: []
        }
      }
    });
  });

  it("rejects non-model-space region inputs over JSON-RPC", () => {
    const session = createMcpStdioSession();
    for (const extra of [
      { candidateToken: "opaque-mutation-token" },
      { screenshot: "data:image/png;base64,opaque" },
      { pixelX: 320 },
      { script: "selectRegions()" },
      { path: "/tmp/regions.json" },
      { limit: 101 },
      { sourceRevision: `partbench-source-v1:${"3".repeat(64)}` }
    ]) {
      expect(
        callTool(
          session,
          `v19-bad-region-${Object.keys(extra)[0]}`,
          "cad.sketch_profile_region_candidates",
          {
            sketchId: "sketch_regions",
            ...extra
          }
        )
      ).toMatchObject({
        result: {
          toolName: "cad.sketch_profile_region_candidates",
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
        "v19-bad-region-profile",
        "cad.sketch_profile_region_validate",
        {
          profile: {
            kind: "regions",
            sketchId: "sketch_regions",
            regions: [
              {
                outer: {
                  kind: "entity",
                  entityId: "outer",
                  candidateKey: "derived-candidate"
                },
                holes: []
              }
            ]
          }
        }
      )
    ).toMatchObject({
      result: {
        toolName: "cad.sketch_profile_region_validate",
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

  it("carries typed non-associative offset readiness through JSON-RPC dry-run, commit, diagnostics, and history", () => {
    const session = createMcpStdioSession();
    expect(
      callTool(session, "offset-setup", "cad.batch", {
        allowCommit: true,
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [
            {
              op: "sketch.create",
              id: "sketch_offset",
              name: "Offset parity",
              plane: "XY"
            },
            {
              op: "sketch.addLine",
              sketchId: "sketch_offset",
              id: "line_source",
              start: [0, 0],
              end: [4, 0]
            }
          ]
        }
      })
    ).toMatchObject({
      result: { isError: false, structuredContent: { ok: true } }
    });

    const readiness = callTool(
      session,
      "offset-readiness",
      "cad.sketch_curve_edit_readiness",
      {
        proposal: {
          kind: "offset",
          sketchId: "sketch_offset",
          source: { kind: "entity", entityId: "line_source" },
          distance: 1,
          side: "left"
        }
      }
    );
    expect(readiness).toMatchObject({
      result: {
        isError: false,
        structuredContent: {
          ok: true,
          requestId: "mcp_jsonrpc_offset-readiness",
          query: "sketch.curveEditReadiness",
          status: "ready",
          preparedOperation: {
            op: "sketch.offset",
            sketchId: "sketch_offset",
            source: { kind: "entity", entityId: "line_source" },
            createdEntityIds: ["skent_1"]
          },
          impact: {
            operation: "offset",
            replacements: [],
            constraintImpacts: [],
            dimensionImpacts: [],
            requiredDeleteConstraintIds: [],
            requiredDeleteDimensionIds: [],
            affectedFeatureIds: []
          },
          preview: {
            resultEntities: [
              {
                id: "skent_1",
                kind: "line",
                start: [0, 1],
                end: [4, 1],
                construction: false
              }
            ]
          },
          diagnostics: []
        }
      }
    });
    const preparedOperation = readiness.result.structuredContent
      .preparedOperation as Record<string, unknown>;
    const expectedSemanticDiff = {
      sketches: {
        curveEdits: [
          {
            operation: "offset",
            replacements: [],
            constraintImpacts: [],
            dimensionImpacts: [],
            createdEntityIds: ["skent_1"],
            modifiedEntityIds: [],
            deletedEntityIds: []
          }
        ]
      }
    };

    expect(
      callTool(session, "offset-dry-run", "cad.batch", {
        actor: {
          type: "agent",
          id: "stdio-offset-agent",
          name: "Stdio Offset Agent"
        },
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
          requestId: "mcp_jsonrpc_offset-dry-run",
          mode: "dryRun",
          createdSketchEntityIds: ["skent_1"],
          semanticDiff: expectedSemanticDiff,
          review: {
            operations: [
              {
                op: "sketch.offset",
                intent: "create",
                sketchId: "sketch_offset",
                sketchEntityId: "line_source"
              }
            ],
            audit: {
              source: "mcp",
              requestId: "mcp_jsonrpc_offset-dry-run",
              toolName: "cad.batch",
              intent: "dryRun",
              actor: {
                type: "agent",
                id: "stdio-offset-agent",
                name: "Stdio Offset Agent"
              }
            }
          }
        }
      }
    });

    const commit = callTool(session, "offset-commit", "cad.batch", {
      allowCommit: true,
      actor: {
        type: "agent",
        id: "stdio-offset-agent",
        name: "Stdio Offset Agent"
      },
      batch: {
        version: "cadops.v1",
        mode: "commit",
        ops: [preparedOperation]
      }
    });
    expect(commit).toMatchObject({
      result: {
        isError: false,
        structuredContent: {
          ok: true,
          requestId: "mcp_jsonrpc_offset-commit",
          mode: "commit",
          transactionId: expect.any(String),
          semanticDiff: expectedSemanticDiff,
          actor: {
            type: "agent",
            id: "stdio-offset-agent",
            name: "Stdio Offset Agent"
          },
          audit: {
            source: "mcp",
            requestId: "mcp_jsonrpc_offset-commit",
            toolName: "cad.batch",
            intent: "commit",
            operationCount: 1
          }
        }
      }
    });

    expect(
      callTool(session, "offset-history", "cad.transaction_history", {})
    ).toMatchObject({
      result: {
        isError: false,
        structuredContent: {
          ok: true,
          requestId: "mcp_jsonrpc_offset-history",
          query: "transaction.history",
          transactions: expect.arrayContaining([
            expect.objectContaining({
              id: commit.result.structuredContent.transactionId,
              status: "committed",
              actor: expect.objectContaining({ id: "stdio-offset-agent" }),
              audit: expect.objectContaining({
                source: "mcp",
                requestId: "mcp_jsonrpc_offset-commit",
                toolName: "cad.batch"
              })
            })
          ])
        }
      }
    });

    expect(
      callTool(session, "offset-blocked", "cad.sketch_curve_edit_readiness", {
        proposal: {
          kind: "offset",
          sketchId: "sketch_offset",
          source: { kind: "entity", entityId: "line_source" },
          distance: 1,
          side: "left",
          referencePoint: [2, -1]
        }
      })
    ).toMatchObject({
      result: {
        isError: false,
        structuredContent: {
          ok: true,
          requestId: "mcp_jsonrpc_offset-blocked",
          status: "blocked",
          diagnostics: [{ code: "SKETCH_OFFSET_SIDE_AMBIGUOUS" }]
        }
      }
    });
  });

  it("preserves supplied slot and rounded-rectangle identities through JSON-RPC dry-run, commit, and solver inspection", () => {
    const session = createMcpStdioSession();
    expect(
      callTool(session, "convenience-setup", "cad.batch", {
        allowCommit: true,
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [
            {
              op: "sketch.create",
              id: "sketch_convenience",
              name: "Convenience parity",
              plane: "XY"
            }
          ]
        }
      })
    ).toMatchObject({
      result: { isError: false, structuredContent: { ok: true } }
    });
    const slotEntityIds = [
      "slot_side_positive",
      "slot_end_cap",
      "slot_side_negative",
      "slot_start_cap"
    ];
    const slotConstraintIds = Array.from(
      { length: 9 },
      (_, index) => `slot_constraint_${index + 1}`
    );
    const roundedEntityIds = [
      "rounded_bottom",
      "rounded_bottom_right",
      "rounded_right",
      "rounded_top_right",
      "rounded_top",
      "rounded_top_left",
      "rounded_left",
      "rounded_bottom_left"
    ];
    const roundedConstraintIds = Array.from(
      { length: 23 },
      (_, index) => `rounded_constraint_${index + 1}`
    );
    const ops = [
      {
        op: "sketch.addSlot",
        sketchId: "sketch_convenience",
        centerlineStart: [0, 0],
        centerlineEnd: [10, 0],
        radius: 2,
        entityIds: slotEntityIds,
        constraintIds: slotConstraintIds
      },
      {
        op: "sketch.addRoundedRectangle",
        sketchId: "sketch_convenience",
        center: [20, 0],
        width: 12,
        height: 8,
        cornerRadius: 2,
        entityIds: roundedEntityIds,
        constraintIds: roundedConstraintIds
      }
    ];
    const expectedSemanticDiff = {
      sketches: {
        convenienceOperations: [
          {
            opIndex: 0,
            operation: "slot",
            createdEntityIds: slotEntityIds,
            createdConstraintIds: slotConstraintIds
          },
          {
            opIndex: 1,
            operation: "roundedRectangle",
            createdEntityIds: roundedEntityIds,
            createdConstraintIds: roundedConstraintIds
          }
        ]
      }
    };

    expect(
      callTool(session, "convenience-dry-run", "cad.batch", {
        batch: {
          version: "cadops.v1",
          mode: "dryRun",
          ops
        }
      })
    ).toMatchObject({
      result: {
        isError: false,
        structuredContent: {
          ok: true,
          requestId: "mcp_jsonrpc_convenience-dry-run",
          createdSketchEntityIds: [...slotEntityIds, ...roundedEntityIds],
          createdSketchConstraintIds: [
            ...slotConstraintIds,
            ...roundedConstraintIds
          ],
          semanticDiff: expectedSemanticDiff
        }
      }
    });

    expect(
      callTool(session, "convenience-commit", "cad.batch", {
        allowCommit: true,
        actor: { type: "script", id: "stdio-convenience-script" },
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops
        }
      })
    ).toMatchObject({
      result: {
        isError: false,
        structuredContent: {
          ok: true,
          requestId: "mcp_jsonrpc_convenience-commit",
          transactionId: expect.any(String),
          semanticDiff: expectedSemanticDiff,
          actor: { type: "script", id: "stdio-convenience-script" },
          audit: {
            source: "mcp",
            requestId: "mcp_jsonrpc_convenience-commit",
            toolName: "cad.batch",
            operationCount: 2
          }
        }
      }
    });

    expect(
      callTool(session, "convenience-solver", "cad.sketch_solver_status", {
        sketchId: "sketch_convenience"
      })
    ).toMatchObject({
      result: {
        isError: false,
        structuredContent: {
          ok: true,
          requestId: "mcp_jsonrpc_convenience-solver",
          query: "sketch.solverStatus"
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

    for (const [id, source] of [
      ["path", "/tmp/offset-source.json"],
      ["file", { kind: "file", path: "/tmp/offset-source.json" }],
      [
        "screenshot-source",
        {
          kind: "entity",
          entityId: "line_1",
          screenshot: "data:image/png;base64,opaque"
        }
      ]
    ] as const) {
      expect(
        callTool(
          session,
          `bad-offset-${id}`,
          "cad.sketch_curve_edit_readiness",
          {
            proposal: {
              kind: "offset",
              sketchId: "sketch_1",
              source,
              distance: 1,
              side: "left"
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
    }

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
