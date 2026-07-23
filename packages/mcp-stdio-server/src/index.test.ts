import { describe, expect, it } from "vitest";
import type { CadMcpServer } from "@web-cad/mcp-adapter";
import { createMcpStdioSession } from "./index";

interface ToolsListResponse {
  readonly jsonrpc: "2.0";
  readonly id: number;
  readonly result: {
    readonly tools: ReadonlyArray<{
      readonly name: string;
      readonly description?: string;
      readonly inputSchema?: unknown;
    }>;
  };
}

describe("mcp stdio server", () => {
  it("handles tools/list over line-delimited JSON-RPC", () => {
    const session = createMcpStdioSession();
    const response = parseLineResponse(
      session.handleLine(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list"
        })
      )
    ) as ToolsListResponse;

    expect(response).toMatchObject({
      jsonrpc: "2.0",
      id: 1,
      result: {
        tools: expect.any(Array)
      }
    });
    if (!Array.isArray(response.result.tools)) {
      throw new Error("Expected tools/list result with tools array.");
    }

    const tools = response.result.tools;
    const toolNames = tools.map((tool) => tool.name);

    expect(toolNames).toEqual(
      expect.arrayContaining([
        "cad.parameter_list",
        "cad.parameter_get",
        "cad.project_parameter_evaluation",
        "cad.feature_editability",
        "cad.project_summary",
        "cad.project_features",
        "cad.project_structure",
        "cad.project_health",
        "cad.project_dependency_graph",
        "cad.project_rebuild_plan",
        "cad.project_topology_identity_readiness",
        "cad.topology_match_snapshots",
        "cad.topology_anchor_repair_candidates",
        "cad.topology_anchor_command_readiness",
        "cad.topology_command_target_readiness",
        "cad.topology_anchor_creation_plan",
        "cad.topology_anchor_repair_plan",
        "cad.project_export_readiness",
        "cad.project_export_exact",
        "cad.project_package_readiness",
        "cad.project_import_readiness",
        "cad.v8_project_surface",
        "cad.project_sketches",
        "cad.object_measurements",
        "cad.body_measurements",
        "cad.body_imported_body_status",
        "cad.body_topology",
        "cad.body_topology_identity",
        "cad.project_extents",
        "cad.sketch_get",
        "cad.sketch_edit_readiness",
        "cad.sketch_solver_status",
        "cad.sketch_dimensions",
        "cad.sketch_evaluation",
        "cad.sketch_dimension_get",
        "cad.body_generated_references",
        "cad.resolve_generated_reference",
        "cad.generated_reference_measurements",
        "cad.named_references",
        "cad.resolve_named_reference",
        "cad.reference_health",
        "cad.selection_reference_candidates",
        "cad.transaction_history",
        "cad.batch"
      ])
    );
    expect(tools).toContainEqual(
      expect.objectContaining({
        name: "cad.batch",
        description: expect.any(String),
        inputSchema: expect.objectContaining({ type: "object" })
      })
    );
  });

  it("handles tools/call and preserves document state for later calls", () => {
    const session = createMcpStdioSession();
    const commit = parseLineResponse(
      session.handleLine(
        JSON.stringify({
          jsonrpc: "2.0",
          id: "commit-box",
          method: "tools/call",
          params: {
            name: "cad.batch",
            arguments: {
              allowCommit: true,
              batch: {
                version: "cadops.v1",
                mode: "commit",
                ops: [
                  {
                    op: "scene.createBox",
                    id: "stdio_box",
                    dimensions: { width: 2, height: 3, depth: 4 }
                  }
                ]
              }
            }
          }
        })
      )
    );
    const summary = parseLineResponse(
      session.handleLine(
        JSON.stringify({
          jsonrpc: "2.0",
          id: "summary",
          method: "tools/call",
          params: {
            name: "cad.project_summary",
            arguments: {}
          }
        })
      )
    );

    expect(commit).toMatchObject({
      jsonrpc: "2.0",
      id: "commit-box",
      result: {
        toolName: "cad.batch",
        isError: false,
        structuredContent: {
          ok: true,
          createdIds: ["stdio_box"],
          transactionId: "txn_1"
        }
      }
    });
    expect(summary).toMatchObject({
      jsonrpc: "2.0",
      id: "summary",
      result: {
        toolName: "cad.project_summary",
        isError: false,
        structuredContent: {
          ok: true,
          objectCount: 1,
          objects: [{ id: "stdio_box", kind: "box" }],
          structure: {
            partCount: 1,
            featureCount: 1,
            bodyCount: 1,
            primitiveCompatibilityBodyCount: 1,
            authoredBodyFeatureCount: 0
          },
          references: {
            semanticBodySelectionCount: 1,
            generatedReferenceCount: 0
          },
          exportReadiness: {
            status: "unavailable",
            canExportFiles: false,
            bodyCount: 1
          }
        }
      }
    });
  });

  it("passes cad.batch review previews and commit refusals over JSON-RPC", () => {
    const session = createMcpStdioSession();
    const preview = parseLineResponse(
      session.handleLine(
        JSON.stringify({
          jsonrpc: "2.0",
          id: "preview-batch",
          method: "tools/call",
          params: {
            name: "cad.batch",
            arguments: {
              batch: {
                version: "cadops.v1",
                mode: "dryRun",
                ops: [
                  {
                    op: "scene.createBox",
                    id: "stdio_preview_box",
                    dimensions: { width: 1, height: 2, depth: 3 }
                  }
                ]
              }
            }
          }
        })
      )
    );
    const blocked = parseLineResponse(
      session.handleLine(
        JSON.stringify({
          jsonrpc: "2.0",
          id: "blocked-batch",
          method: "tools/call",
          params: {
            name: "cad.batch",
            arguments: {
              batch: {
                version: "cadops.v1",
                mode: "commit",
                ops: [
                  {
                    op: "scene.createBox",
                    id: "stdio_blocked_box",
                    dimensions: { width: 1, height: 1, depth: 1 }
                  }
                ]
              }
            }
          }
        })
      )
    );
    const summary = parseLineResponse(
      session.handleLine(
        JSON.stringify({
          jsonrpc: "2.0",
          id: "preview-summary",
          method: "tools/call",
          params: {
            name: "cad.project_summary",
            arguments: {}
          }
        })
      )
    );

    expect(preview).toMatchObject({
      jsonrpc: "2.0",
      id: "preview-batch",
      result: {
        toolName: "cad.batch",
        isError: false,
        structuredContent: {
          ok: true,
          requestId: "mcp_jsonrpc_preview-batch",
          mode: "dryRun",
          createdIds: ["stdio_preview_box"],
          review: {
            requestedMode: "dryRun",
            operationCount: 1,
            entityChanges: {
              objects: { created: 1, modified: 0, deleted: 0 }
            },
            audit: {
              source: "mcp",
              requestId: "mcp_jsonrpc_preview-batch",
              toolName: "cad.batch"
            },
            commitGate: {
              permissionProvided: false,
              blocked: false
            },
            blockers: []
          }
        }
      }
    });
    expect(blocked).toMatchObject({
      jsonrpc: "2.0",
      id: "blocked-batch",
      result: {
        toolName: "cad.batch",
        isError: true,
        structuredContent: {
          ok: false,
          requestId: "mcp_jsonrpc_blocked-batch",
          mode: "commit",
          error: {
            code: "COMMIT_NOT_ALLOWED"
          },
          review: {
            requestedMode: "commit",
            operationCount: 1,
            commitGate: {
              permissionProvided: false,
              blocked: true
            },
            blockers: [
              {
                code: "COMMIT_NOT_ALLOWED",
                severity: "blocker",
                path: "$.permissions.allowCommit"
              }
            ]
          }
        }
      }
    });
    expect(summary).toMatchObject({
      jsonrpc: "2.0",
      id: "preview-summary",
      result: {
        structuredContent: {
          ok: true,
          objectCount: 0
        }
      }
    });
  });

  it("handles sketch extrude cad.batch calls over line-delimited JSON-RPC", () => {
    const session = createMcpStdioSession();
    const commit = parseLineResponse(
      session.handleLine(
        JSON.stringify({
          jsonrpc: "2.0",
          id: "commit-extrude",
          method: "tools/call",
          params: {
            name: "cad.batch",
            arguments: {
              allowCommit: true,
              batch: {
                version: "cadops.v1",
                mode: "commit",
                ops: [
                  {
                    op: "sketch.create",
                    id: "sketch_1",
                    name: "Profile",
                    plane: "XY"
                  },
                  {
                    op: "sketch.addRectangle",
                    sketchId: "sketch_1",
                    id: "rect_1",
                    center: [0, 0],
                    width: 2,
                    height: 3
                  },
                  {
                    op: "feature.extrude",
                    id: "feat_1",
                    bodyId: "body_1",
                    sketchId: "sketch_1",
                    entityId: "rect_1",
                    depth: 4
                  }
                ]
              }
            }
          }
        })
      )
    );

    expect(commit).toMatchObject({
      jsonrpc: "2.0",
      id: "commit-extrude",
      result: {
        toolName: "cad.batch",
        isError: false,
        structuredContent: {
          ok: true,
          createdFeatureIds: ["feat_1"],
          createdBodyIds: ["body_1"]
        }
      }
    });
  });

  it("handles rectangle add cad.batch calls over line-delimited JSON-RPC", () => {
    const session = createMcpStdioSession();
    const commit = parseLineResponse(
      session.handleLine(
        JSON.stringify({
          jsonrpc: "2.0",
          id: "commit-add",
          method: "tools/call",
          params: {
            name: "cad.batch",
            arguments: {
              allowCommit: true,
              batch: {
                version: "cadops.v1",
                mode: "commit",
                ops: [
                  {
                    op: "sketch.create",
                    id: "sketch_add",
                    name: "Profile",
                    plane: "XY"
                  },
                  {
                    op: "sketch.addRectangle",
                    sketchId: "sketch_add",
                    id: "rect_add",
                    center: [0, 0],
                    width: 3,
                    height: 2
                  },
                  {
                    op: "feature.extrude",
                    id: "feat_target",
                    bodyId: "body_target",
                    sketchId: "sketch_add",
                    entityId: "rect_add",
                    depth: 4
                  },
                  {
                    op: "feature.extrude",
                    id: "feat_add",
                    bodyId: "body_add",
                    targetBodyId: "body_target",
                    sketchId: "sketch_add",
                    entityId: "rect_add",
                    depth: 1,
                    operationMode: "add"
                  }
                ]
              }
            }
          }
        })
      )
    );
    const structure = parseLineResponse(
      session.handleLine(
        JSON.stringify({
          jsonrpc: "2.0",
          id: "structure-add",
          method: "tools/call",
          params: {
            name: "cad.project_structure",
            arguments: {}
          }
        })
      )
    );

    expect(commit).toMatchObject({
      jsonrpc: "2.0",
      id: "commit-add",
      result: {
        toolName: "cad.batch",
        isError: false,
        structuredContent: {
          ok: true,
          createdFeatureIds: ["feat_target", "feat_add"],
          createdBodyIds: ["body_target", "body_add"]
        }
      }
    });
    expect(structure).toMatchObject({
      jsonrpc: "2.0",
      id: "structure-add",
      result: {
        toolName: "cad.project_structure",
        isError: false,
        structuredContent: {
          ok: true,
          features: expect.arrayContaining([
            expect.objectContaining({
              id: "feat_add",
              operationMode: "add",
              targetBodyId: "body_target"
            })
          ]),
          bodies: expect.arrayContaining([
            expect.objectContaining({
              id: "body_target",
              consumedByFeatureId: "feat_add"
            }),
            expect.objectContaining({
              id: "body_add",
              featureId: "feat_add"
            })
          ])
        }
      }
    });
  });

  it("round-trips composite wire cut through an anchored add result over line-delimited JSON-RPC", () => {
    const session = createMcpStdioSession();
    const callBatch = (id: string, argumentsValue: unknown) =>
      parseLineResponse(
        session.handleLine(
          JSON.stringify({
            jsonrpc: "2.0",
            id,
            method: "tools/call",
            params: { name: "cad.batch", arguments: argumentsValue }
          })
        )
      );
    const profile = {
      kind: "wire",
      sketchId: "stdio_add_wire_sketch",
      segments: [
        { entityId: "stdio_add_wire_bottom", orientation: "forward" },
        { entityId: "stdio_add_wire_right", orientation: "forward" },
        { entityId: "stdio_add_wire_top", orientation: "forward" },
        { entityId: "stdio_add_wire_left", orientation: "forward" }
      ]
    };
    const seed = callBatch("stdio-wire-add-seed", {
      allowCommit: true,
      batch: {
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            op: "sketch.create",
            id: "stdio_add_target_sketch",
            name: "Composite add target",
            plane: "XY"
          },
          {
            op: "sketch.addRectangle",
            sketchId: "stdio_add_target_sketch",
            id: "stdio_add_target_rect",
            center: [0, 0],
            width: 10,
            height: 10
          },
          {
            op: "feature.extrude",
            id: "stdio_add_target_feature",
            bodyId: "stdio_add_target_body",
            sketchId: "stdio_add_target_sketch",
            entityId: "stdio_add_target_rect",
            depth: 4
          },
          {
            op: "topology.checkpoint.create",
            checkpointId: "stdio_add_target_checkpoint",
            bodyId: "stdio_add_target_body",
            sourceFeatureId: "stdio_add_target_feature",
            sourceIdentity: {
              algorithm: "partbench-source-v1",
              sha256:
                "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
            },
            status: "active"
          },
          {
            op: "topology.anchor.create",
            anchorId: "stdio_add_target_anchor",
            entityKind: "body",
            bodyId: "stdio_add_target_body",
            checkpointId: "stdio_add_target_checkpoint",
            checkpointEntityId: "stdio-add-target-body",
            sourceFeatureId: "stdio_add_target_feature",
            stableId: "generated:body:stdio_add_target_body"
          },
          {
            op: "sketch.create",
            id: "stdio_add_wire_sketch",
            name: "Composite add wire",
            plane: "XY"
          },
          {
            op: "sketch.addLine",
            sketchId: "stdio_add_wire_sketch",
            id: "stdio_add_wire_bottom",
            start: [-2, -1],
            end: [2, -1]
          },
          {
            op: "sketch.addArc",
            sketchId: "stdio_add_wire_sketch",
            id: "stdio_add_wire_right",
            definition: {
              kind: "centerAngles",
              center: [2, 0],
              radius: 1,
              startAngleDegrees: -90,
              sweepAngleDegrees: 180
            }
          },
          {
            op: "sketch.addLine",
            sketchId: "stdio_add_wire_sketch",
            id: "stdio_add_wire_top",
            start: [2, 1],
            end: [-2, 1]
          },
          {
            op: "sketch.addArc",
            sketchId: "stdio_add_wire_sketch",
            id: "stdio_add_wire_left",
            definition: {
              kind: "centerAngles",
              center: [-2, 0],
              radius: 1,
              startAngleDegrees: 90,
              sweepAngleDegrees: 180
            }
          },
          {
            op: "feature.extrude",
            id: "stdio_add_wire_feature",
            bodyId: "stdio_add_wire_body",
            profile,
            depth: 2,
            side: "symmetric",
            operationMode: "add",
            targetTopologyAnchorId: "stdio_add_target_anchor"
          },
          {
            op: "topology.checkpoint.create",
            checkpointId: "stdio_add_result_checkpoint",
            bodyId: "stdio_add_wire_body",
            sourceFeatureId: "stdio_add_wire_feature",
            sourceIdentity: {
              algorithm: "partbench-source-v1",
              sha256:
                "cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd"
            },
            status: "active"
          },
          {
            op: "topology.anchor.create",
            anchorId: "stdio_add_result_anchor",
            entityKind: "body",
            bodyId: "stdio_add_wire_body",
            checkpointId: "stdio_add_result_checkpoint",
            checkpointEntityId: "stdio-add-result-body",
            sourceFeatureId: "stdio_add_wire_feature",
            stableId: "generated:body:stdio_add_wire_body"
          }
        ]
      }
    });
    const operation = {
      op: "feature.extrude",
      id: "stdio_cut_wire_feature",
      bodyId: "stdio_cut_wire_body",
      profile,
      depth: 1,
      operationMode: "cut",
      targetTopologyAnchorId: "stdio_add_result_anchor"
    };
    const directTarget = callBatch("stdio-wire-cut-direct-target", {
      batch: {
        version: "cadops.v1",
        mode: "dryRun",
        ops: [
          {
            ...operation,
            side: "negative",
            targetBodyId: "stdio_add_wire_body",
            targetTopologyAnchorId: undefined
          }
        ]
      }
    });
    const dryRun = callBatch("stdio-wire-cut-dry-run", {
      batch: {
        version: "cadops.v1",
        mode: "dryRun",
        ops: [{ ...operation, side: "symmetric" }]
      }
    });
    const commit = callBatch("stdio-wire-cut-commit", {
      allowCommit: true,
      batch: {
        version: "cadops.v1",
        mode: "commit",
        ops: [{ ...operation, side: "negative" }]
      }
    });
    const structure = parseLineResponse(
      session.handleLine(
        JSON.stringify({
          jsonrpc: "2.0",
          id: "stdio-wire-cut-structure",
          method: "tools/call",
          params: {
            name: "cad.project_structure",
            arguments: {}
          }
        })
      )
    );

    expect(seed).toMatchObject({
      jsonrpc: "2.0",
      id: "stdio-wire-add-seed",
      result: { toolName: "cad.batch", isError: false }
    });
    expect(directTarget).toMatchObject({
      jsonrpc: "2.0",
      id: "stdio-wire-cut-direct-target",
      result: {
        toolName: "cad.batch",
        isError: true,
        structuredContent: {
          ok: false,
          error: {
            code: "UNSUPPORTED_BODY_REFERENCES",
            path: "$.ops[0].profile"
          }
        }
      }
    });
    for (const response of [dryRun, commit]) {
      expect(response).toMatchObject({
        jsonrpc: "2.0",
        result: {
          toolName: "cad.batch",
          isError: false,
          structuredContent: {
            ok: true,
            createdFeatureIds: ["stdio_cut_wire_feature"],
            createdBodyIds: ["stdio_cut_wire_body"],
            semanticDiff: {
              features: {
                created: [
                  expect.objectContaining({
                    id: "stdio_cut_wire_feature",
                    profile,
                    operationMode: "cut",
                    targetBodyId: "stdio_add_wire_body",
                    targetTopologyAnchorId: "stdio_add_result_anchor"
                  })
                ],
                inputReferences: [
                  expect.objectContaining({
                    featureId: "stdio_cut_wire_feature",
                    after: profile
                  })
                ]
              }
            },
            review: {
              operations: [
                expect.objectContaining({
                  op: "feature.extrude",
                  sketchId: "stdio_add_wire_sketch",
                  operationMode: "cut",
                  targetTopologyAnchorId: "stdio_add_result_anchor"
                })
              ]
            }
          }
        }
      });
    }
    expect(dryRun).toMatchObject({
      id: "stdio-wire-cut-dry-run",
      result: {
        structuredContent: {
          mode: "dryRun",
          semanticDiff: {
            features: {
              created: [expect.objectContaining({ side: "symmetric" })]
            }
          }
        }
      }
    });
    expect(commit).toMatchObject({
      id: "stdio-wire-cut-commit",
      result: {
        structuredContent: {
          mode: "commit",
          semanticDiff: {
            features: {
              created: [expect.objectContaining({ side: "negative" })]
            }
          }
        }
      }
    });
    expect(structure).toMatchObject({
      jsonrpc: "2.0",
      id: "stdio-wire-cut-structure",
      result: {
        toolName: "cad.project_structure",
        isError: false,
        structuredContent: {
          ok: true,
          features: expect.arrayContaining([
            expect.objectContaining({
              id: "stdio_cut_wire_feature",
              profile,
              depth: 1,
              side: "negative",
              operationMode: "cut",
              targetBodyId: "stdio_add_wire_body",
              targetTopologyAnchorId: "stdio_add_result_anchor"
            })
          ]),
          bodies: expect.arrayContaining([
            expect.objectContaining({
              id: "stdio_add_wire_body",
              consumedByFeatureId: "stdio_cut_wire_feature"
            }),
            expect.objectContaining({
              id: "stdio_cut_wire_body",
              featureId: "stdio_cut_wire_feature",
              source: expect.objectContaining({ profile })
            })
          ])
        }
      }
    });
  });

  it("handles extrude depth updates over line-delimited JSON-RPC", () => {
    const session = createMcpStdioSession();

    parseLineResponse(
      session.handleLine(
        JSON.stringify({
          jsonrpc: "2.0",
          id: "commit-extrude",
          method: "tools/call",
          params: {
            name: "cad.batch",
            arguments: {
              allowCommit: true,
              batch: {
                version: "cadops.v1",
                mode: "commit",
                ops: [
                  {
                    op: "sketch.create",
                    id: "sketch_1",
                    name: "Profile",
                    plane: "XY"
                  },
                  {
                    op: "sketch.addRectangle",
                    sketchId: "sketch_1",
                    id: "rect_1",
                    center: [0, 0],
                    width: 2,
                    height: 3
                  },
                  {
                    op: "feature.extrude",
                    id: "feat_1",
                    bodyId: "body_1",
                    sketchId: "sketch_1",
                    entityId: "rect_1",
                    depth: 4
                  }
                ]
              }
            }
          }
        })
      )
    );
    const update = parseLineResponse(
      session.handleLine(
        JSON.stringify({
          jsonrpc: "2.0",
          id: "update-extrude",
          method: "tools/call",
          params: {
            name: "cad.batch",
            arguments: {
              allowCommit: true,
              batch: {
                version: "cadops.v1",
                mode: "commit",
                ops: [
                  {
                    op: "feature.updateExtrude",
                    id: "feat_1",
                    depth: 9,
                    side: "symmetric"
                  }
                ]
              }
            }
          }
        })
      )
    );
    const structure = parseLineResponse(
      session.handleLine(
        JSON.stringify({
          jsonrpc: "2.0",
          id: "structure",
          method: "tools/call",
          params: {
            name: "cad.project_structure",
            arguments: {}
          }
        })
      )
    );

    expect(update).toMatchObject({
      jsonrpc: "2.0",
      id: "update-extrude",
      result: {
        toolName: "cad.batch",
        isError: false,
        structuredContent: {
          ok: true,
          modifiedFeatureIds: ["feat_1"],
          modifiedBodyIds: ["body_1"],
          transactionId: "txn_2"
        }
      }
    });
    expect(structure).toMatchObject({
      jsonrpc: "2.0",
      id: "structure",
      result: {
        toolName: "cad.project_structure",
        isError: false,
        structuredContent: {
          ok: true,
          features: [{ id: "feat_1", depth: 9, side: "symmetric" }],
          bodies: [{ id: "body_1", featureId: "feat_1" }]
        }
      }
    });
  });

  it("returns JSON-RPC parse errors for malformed input", () => {
    const session = createMcpStdioSession();
    const response = parseLineResponse(session.handleLine("{bad json"));

    expect(response).toEqual({
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32700,
        message: "Parse error."
      }
    });
  });

  it("does not misreport server failures as JSON parse errors", () => {
    const server = {
      handleJsonRpc() {
        throw new Error("Injected server failure.");
      }
    } as unknown as CadMcpServer;
    const session = createMcpStdioSession({ server });
    const response = parseLineResponse(
      session.handleLine('{"jsonrpc":"2.0","id":7,"method":"tools/list"}')
    );

    expect(response).toEqual({
      jsonrpc: "2.0",
      id: 7,
      error: {
        code: -32603,
        message: "Internal error."
      }
    });
  });

  it("ignores blank lines", () => {
    const session = createMcpStdioSession();

    expect(session.handleLine(" \n")).toBeUndefined();
  });
});

function parseLineResponse(response: string | undefined): unknown {
  if (!response) {
    throw new Error("Expected a stdio response line.");
  }

  return JSON.parse(response) as unknown;
}
