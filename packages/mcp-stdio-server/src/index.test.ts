import { describe, expect, it } from "vitest";
import { createMcpStdioSession } from "./index";

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
    );

    expect(response).toMatchObject({
      jsonrpc: "2.0",
      id: 1,
      result: {
        tools: [
          { name: "cad.parameter_list" },
          { name: "cad.parameter_get" },
          { name: "cad.feature_editability" },
          { name: "cad.project_summary" },
          { name: "cad.project_features" },
          { name: "cad.project_structure" },
          { name: "cad.project_health" },
          { name: "cad.project_dependency_graph" },
          { name: "cad.project_rebuild_plan" },
          { name: "cad.project_topology_identity_readiness" },
          { name: "cad.topology_match_snapshots" },
          { name: "cad.project_export_readiness" },
          { name: "cad.project_export_exact" },
          { name: "cad.project_package_readiness" },
          { name: "cad.v8_project_surface" },
          { name: "cad.project_sketches" },
          { name: "cad.object_measurements" },
          { name: "cad.body_measurements" },
          { name: "cad.body_topology" },
          { name: "cad.project_extents" },
          { name: "cad.sketch_get" },
          { name: "cad.sketch_edit_readiness" },
          { name: "cad.sketch_solver_status" },
          { name: "cad.sketch_dimensions" },
          { name: "cad.sketch_evaluation" },
          { name: "cad.sketch_dimension_get" },
          { name: "cad.body_generated_references" },
          { name: "cad.resolve_generated_reference" },
          { name: "cad.generated_reference_measurements" },
          { name: "cad.named_references" },
          { name: "cad.resolve_named_reference" },
          { name: "cad.reference_health" },
          { name: "cad.selection_reference_candidates" },
          { name: "cad.transaction_history" },
          { name: "cad.batch" }
        ]
      }
    });
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
