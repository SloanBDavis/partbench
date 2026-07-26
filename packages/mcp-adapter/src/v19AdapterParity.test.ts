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

type SuccessfulBatchResponse = Extract<
  CadMcpToolCallResult["structuredContent"],
  {
    readonly ok: true;
    readonly mode: "dryRun" | "commit";
  }
>;

function requireSuccessfulBatch(
  result: CadMcpToolCallResult
): SuccessfulBatchResponse {
  const response = result.structuredContent;
  if (!response.ok || !("mode" in response) || !("semanticDiff" in response)) {
    throw new Error(`Expected successful batch: ${JSON.stringify(response)}`);
  }
  return response as SuccessfulBatchResponse;
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
      tools.find((tool) => tool.name === "cad.sketch_curve_edit_readiness")
        ?.description
    ).toContain("no persistent source link");
    expect(
      tools.find((tool) => tool.name === "cad.sketch_curve_edit_readiness")
        ?.description
    ).toContain("typed entity ref");
    expect(
      tools.find((tool) => tool.name === "cad.sketch_curve_edit_readiness")
        ?.description
    ).toContain("filesystem paths");
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
    expect(batchTool?.description).toContain("non-associative offset");
    expect(batchTool?.description).toContain("sketch.addSlot");
    expect(batchTool?.description).toContain("sketch.addRoundedRectangle");
    expect(batchTool?.inputSchema).toMatchObject({
      properties: {
        batch: {
          additionalProperties: false,
          required: ["version", "mode", "ops"]
        }
      }
    });
    type BatchOpSchema = {
      readonly properties?: {
        readonly op?: { readonly const?: string };
      };
      readonly [key: string]: unknown;
    };
    const batchOpSchemas = (
      batchTool?.inputSchema as {
        properties?: {
          batch?: {
            properties?: {
              ops?: { items?: { oneOf?: readonly BatchOpSchema[] } };
            };
          };
        };
      }
    ).properties?.batch?.properties?.ops?.items?.oneOf;
    expect(batchOpSchemas).toHaveLength(12);
    const batchOpSchema = (op: string) =>
      batchOpSchemas?.find((schema) => schema.properties?.op?.const === op);
    const offsetOpSchema = batchOpSchema("sketch.offset");
    const slotOpSchema = batchOpSchema("sketch.addSlot");
    const roundedOpSchema = batchOpSchema("sketch.addRoundedRectangle");
    const dimensionCreateSchema = batchOpSchema("sketch.dimension.create");
    const dimensionUpdateSchema = batchOpSchema("sketch.dimension.update");
    const constraintUpdateSchema = batchOpSchema("sketch.constraint.update");
    expect(offsetOpSchema).toMatchObject({
      additionalProperties: false,
      required: [
        "op",
        "sketchId",
        "precondition",
        "source",
        "distance",
        "side"
      ],
      properties: {
        precondition: {
          additionalProperties: false,
          required: [
            "expectedSourceRevision",
            "expectedSolverEvaluationIdentity"
          ],
          properties: {
            expectedSourceRevision: {
              pattern: "^partbench-source-v1:[0-9a-f]{64}$"
            },
            expectedSolverEvaluationIdentity: {
              oneOf: [
                { const: "none" },
                {
                  pattern:
                    "^partbench-sketch-solver-evaluation-v1:[0-9a-f]{64}$"
                }
              ]
            }
          }
        },
        source: {
          oneOf: expect.arrayContaining([
            expect.objectContaining({
              additionalProperties: false,
              required: ["kind", "entityId"]
            }),
            expect.objectContaining({
              additionalProperties: false,
              required: ["kind", "segments", "closed"]
            })
          ])
        }
      }
    });
    expect(slotOpSchema).toMatchObject({
      additionalProperties: false,
      properties: {
        entityIds: { minItems: 4, maxItems: 4, uniqueItems: true },
        constraintIds: { minItems: 9, maxItems: 9, uniqueItems: true }
      }
    });
    expect(roundedOpSchema).toMatchObject({
      additionalProperties: false,
      properties: {
        entityIds: { minItems: 8, maxItems: 8, uniqueItems: true },
        constraintIds: { minItems: 23, maxItems: 23, uniqueItems: true }
      }
    });
    expect(dimensionCreateSchema).toMatchObject({
      additionalProperties: false,
      required: ["op", "name", "sketchId", "target"],
      oneOf: expect.any(Array),
      properties: {
        target: { oneOf: expect.any(Array) }
      }
    });
    expect(dimensionUpdateSchema).toMatchObject({
      additionalProperties: false,
      required: ["op", "id"],
      oneOf: expect.any(Array)
    });
    expect(constraintUpdateSchema).toMatchObject({
      additionalProperties: false,
      required: ["op", "id", "definition"],
      properties: {
        definition: { oneOf: expect.any(Array) }
      }
    });
    expect(batchOpSchemas?.[11]).toMatchObject({
      required: ["op"],
      properties: {
        op: {
          not: {
            enum: [
              "sketch.offset",
              "sketch.addSlot",
              "sketch.addRoundedRectangle",
              "sketch.dimension.create",
              "sketch.dimension.update",
              "sketch.dimension.rename",
              "sketch.dimension.delete",
              "sketch.constraint.create",
              "sketch.constraint.update",
              "sketch.constraint.rename",
              "sketch.constraint.delete"
            ]
          }
        }
      },
      additionalProperties: true
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

  it("runs typed offset readiness through exact non-associative dry-run, commit, diagnostics, and history", () => {
    const adapter = createCadOpsAgentAdapter();
    adapter.getEngine().applyBatch([
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
    ]);
    const server = createCadMcpServer({ adapter });
    const readiness = requireReadyCurveEdit(
      server.callTool({
        name: "cad.sketch_curve_edit_readiness",
        requestId: "mcp_offset_readiness",
        arguments: {
          proposal: {
            kind: "offset",
            sketchId: "sketch_offset",
            source: { kind: "entity", entityId: "line_source" },
            distance: 1,
            side: "left"
          }
        }
      })
    );
    expect(readiness).toMatchObject({
      requestId: "mcp_offset_readiness",
      status: "ready",
      preparedOperation: {
        op: "sketch.offset",
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
    });
    if (readiness.preparedOperation.op !== "sketch.offset") {
      throw new Error("Expected prepared offset.");
    }

    const dryRun = server.callTool({
      name: "cad.batch",
      requestId: "mcp_offset_dry_run",
      arguments: {
        actor: {
          type: "agent",
          id: "mcp-offset-agent",
          name: "MCP Offset Agent"
        },
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
        requestId: "mcp_offset_dry_run",
        mode: "dryRun",
        createdSketchEntityIds: ["skent_1"],
        semanticDiff: {
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
        },
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
            requestId: "mcp_offset_dry_run",
            toolName: "cad.batch",
            intent: "dryRun",
            operationCount: 1,
            actor: {
              type: "agent",
              id: "mcp-offset-agent",
              name: "MCP Offset Agent"
            }
          }
        }
      }
    });

    const commit = server.callTool({
      name: "cad.batch",
      requestId: "mcp_offset_commit",
      arguments: {
        allowCommit: true,
        actor: {
          type: "agent",
          id: "mcp-offset-agent",
          name: "MCP Offset Agent"
        },
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [readiness.preparedOperation]
        }
      }
    });
    expect(commit).toMatchObject({
      isError: false,
      structuredContent: {
        ok: true,
        requestId: "mcp_offset_commit",
        mode: "commit",
        transactionId: expect.any(String),
        actor: {
          type: "agent",
          id: "mcp-offset-agent",
          name: "MCP Offset Agent"
        },
        audit: {
          source: "mcp",
          requestId: "mcp_offset_commit",
          toolName: "cad.batch",
          intent: "commit",
          operationCount: 1
        }
      }
    });
    const dryRunContent = requireSuccessfulBatch(dryRun);
    const commitContent = requireSuccessfulBatch(commit);
    expect(commitContent.semanticDiff).toEqual(dryRunContent.semanticDiff);
    expect(
      adapter
        .getEngine()
        .getDocument()
        .sketches.get("sketch_offset")
        ?.entities.get("line_source")
    ).toMatchObject({ start: [0, 0], end: [4, 0] });
    expect(
      adapter
        .getEngine()
        .getDocument()
        .sketches.get("sketch_offset")
        ?.entities.get("skent_1")
    ).not.toHaveProperty("source");

    expect(
      server.callTool({
        name: "cad.transaction_history",
        requestId: "mcp_offset_history"
      })
    ).toMatchObject({
      isError: false,
      structuredContent: {
        ok: true,
        requestId: "mcp_offset_history",
        query: "transaction.history",
        transactions: expect.arrayContaining([
          expect.objectContaining({
            id: commitContent.transactionId,
            status: "committed",
            actor: expect.objectContaining({ id: "mcp-offset-agent" }),
            audit: expect.objectContaining({
              source: "mcp",
              requestId: "mcp_offset_commit",
              toolName: "cad.batch"
            })
          })
        ])
      }
    });

    expect(
      server.callTool({
        name: "cad.sketch_curve_edit_readiness",
        requestId: "mcp_offset_blocked",
        arguments: {
          proposal: {
            kind: "offset",
            sketchId: "sketch_offset",
            source: { kind: "entity", entityId: "line_source" },
            distance: 1,
            side: "left",
            referencePoint: [2, -1]
          }
        }
      })
    ).toMatchObject({
      isError: false,
      structuredContent: {
        ok: true,
        requestId: "mcp_offset_blocked",
        status: "blocked",
        diagnostics: [{ code: "SKETCH_OFFSET_SIDE_AMBIGUOUS" }]
      }
    });
  });

  it("preserves supplied convenience IDs and exact semantic diffs through the sole batch authority", () => {
    const adapter = createCadOpsAgentAdapter();
    adapter.getEngine().apply({
      op: "sketch.create",
      id: "sketch_convenience",
      name: "Convenience parity",
      plane: "XY"
    });
    const server = createCadMcpServer({ adapter });
    const slotEntityIds = [
      "slot_side_positive",
      "slot_end_cap",
      "slot_side_negative",
      "slot_start_cap"
    ] as const;
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
    ] as const;
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
    ] as const;
    const dryRun = server.callTool({
      name: "cad.batch",
      requestId: "mcp_convenience_dry_run",
      arguments: {
        batch: {
          version: "cadops.v1",
          mode: "dryRun",
          ops
        }
      }
    });
    expect(dryRun).toMatchObject({
      isError: false,
      structuredContent: {
        ok: true,
        createdSketchEntityIds: [...slotEntityIds, ...roundedEntityIds],
        createdSketchConstraintIds: [
          ...slotConstraintIds,
          ...roundedConstraintIds
        ],
        semanticDiff: {
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
        }
      }
    });
    const commit = server.callTool({
      name: "cad.batch",
      requestId: "mcp_convenience_commit",
      arguments: {
        allowCommit: true,
        actor: { type: "script", id: "mcp-convenience-script" },
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops
        }
      }
    });
    expect(commit).toMatchObject({
      isError: false,
      structuredContent: {
        ok: true,
        requestId: "mcp_convenience_commit",
        transactionId: expect.any(String),
        actor: { type: "script", id: "mcp-convenience-script" },
        audit: {
          source: "mcp",
          requestId: "mcp_convenience_commit",
          toolName: "cad.batch",
          operationCount: 2
        }
      }
    });
    const dryRunContent = requireSuccessfulBatch(dryRun);
    const commitContent = requireSuccessfulBatch(commit);
    expect(commitContent.semanticDiff).toEqual(dryRunContent.semanticDiff);
    expect(
      server.callTool({
        name: "cad.sketch_solver_status",
        requestId: "mcp_convenience_solver",
        arguments: { sketchId: "sketch_convenience" }
      })
    ).toMatchObject({
      isError: false,
      structuredContent: {
        ok: true,
        requestId: "mcp_convenience_solver",
        query: "sketch.solverStatus"
      }
    });
    expect(adapter.getEngine().getTransactions().at(-1)?.ops).toMatchObject([
      {
        op: "sketch.addSlot",
        entityIds: slotEntityIds,
        constraintIds: slotConstraintIds
      },
      {
        op: "sketch.addRoundedRectangle",
        entityIds: roundedEntityIds,
        constraintIds: roundedConstraintIds
      }
    ]);
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

    for (const source of [
      "/tmp/offset-source.json",
      { kind: "file", path: "/tmp/offset-source.json" },
      {
        kind: "entity",
        entityId: "line_1",
        screenshot: "data:image/png;base64,opaque"
      }
    ]) {
      expect(
        server.callTool({
          name: "cad.sketch_curve_edit_readiness",
          arguments: {
            proposal: {
              kind: "offset",
              sketchId: "sketch_1",
              source,
              distance: 1,
              side: "left"
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
