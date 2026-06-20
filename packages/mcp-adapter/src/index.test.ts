import { describe, expect, it } from "vitest";
import { CadMcpServer, createCadMcpServer } from "./index";

describe("mcp-adapter", () => {
  it("lists only the supported CAD tools", () => {
    const server = createCadMcpServer();
    const tools = server.listTools().tools;

    expect(tools.map((tool) => tool.name)).toEqual([
      "cad.parameter_list",
      "cad.parameter_get",
      "cad.feature_editability",
      "cad.project_summary",
      "cad.project_features",
      "cad.project_structure",
      "cad.project_health",
      "cad.project_dependency_graph",
      "cad.project_rebuild_plan",
      "cad.project_export_readiness",
      "cad.project_export_exact",
      "cad.project_package_readiness",
      "cad.v8_project_surface",
      "cad.project_sketches",
      "cad.object_measurements",
      "cad.body_measurements",
      "cad.body_topology",
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
    ]);
    expect(
      tools.find((tool) => tool.name === "cad.project_summary")?.description
    ).toContain("V7 release summary");
    expect(
      tools.find((tool) => tool.name === "cad.body_generated_references")
        ?.description
    ).toContain("axis");
    expect(
      tools.find((tool) => tool.name === "cad.resolve_generated_reference")
        ?.description
    ).toContain("axis");
    expect(
      JSON.stringify(
        tools.find((tool) => tool.name === "cad.reference_health")?.inputSchema
      )
    ).toContain('"axis"');
    expect(
      JSON.stringify(
        tools.find((tool) => tool.name === "cad.selection_reference_candidates")
          ?.inputSchema
      )
    ).toContain('"axis"');
  });

  it("runs cad.batch dry-run without mutating the document", () => {
    const server = new CadMcpServer();

    const dryRun = server.callTool({
      name: "cad.batch",
      requestId: "mcp_req_dry_run",
      arguments: {
        batch: {
          version: "cadops.v1",
          mode: "dryRun",
          ops: [
            {
              op: "scene.createBox",
              id: "preview_box",
              dimensions: { width: 1, height: 2, depth: 3 }
            }
          ]
        }
      }
    });
    const summary = server.callTool({
      name: "cad.project_summary",
      requestId: "mcp_req_summary"
    });

    expect(dryRun).toMatchObject({
      toolName: "cad.batch",
      isError: false,
      structuredContent: {
        ok: true,
        requestId: "mcp_req_dry_run",
        cadOpsVersion: "cadops.v1",
        mode: "dryRun",
        createdIds: ["preview_box"],
        modifiedIds: [],
        deletedIds: [],
        review: {
          requestedMode: "dryRun",
          effectiveIntent: "dryRun",
          operationCount: 1,
          entityChanges: {
            objects: { created: 1, modified: 0, deleted: 0 }
          },
          operations: [
            {
              index: 0,
              op: "scene.createBox",
              intent: "create",
              label: "Create box preview_box",
              objectId: "preview_box"
            }
          ],
          audit: {
            source: "mcp",
            requestId: "mcp_req_dry_run",
            toolName: "cad.batch",
            intent: "dryRun",
            operationCount: 1,
            actor: {
              type: "agent",
              id: "mcp",
              name: "MCP Client"
            }
          },
          commitGate: {
            permissionProvided: false,
            blocked: false
          },
          hints: [],
          blockers: []
        }
      }
    });
    expect(summary.structuredContent).toMatchObject({
      ok: true,
      requestId: "mcp_req_summary",
      query: "project.summary",
      objectCount: 0,
      objects: [],
      structure: {
        partCount: 1,
        bodyCount: 0,
        authoredBodyFeatureCount: 0
      },
      references: {
        semanticBodySelectionCount: 0,
        generatedReferenceCount: 0
      },
      exportReadiness: {
        status: "unavailable",
        canExportFiles: false,
        formatCount: 2
      },
      workflowHints: [
        expect.objectContaining({ code: "PROJECT_EMPTY" }),
        expect.objectContaining({ code: "EXPORT_UNAVAILABLE" })
      ]
    });
  });

  it("runs cad.batch commit and reports the object through cad.project_summary", () => {
    const server = new CadMcpServer();

    const commit = server.callTool({
      name: "cad.batch",
      requestId: "mcp_req_commit",
      arguments: {
        allowCommit: true,
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [
            {
              op: "scene.createCylinder",
              id: "committed_cylinder",
              dimensions: { radius: 2, height: 8 }
            }
          ]
        }
      }
    });
    const summary = server.callTool({
      name: "cad.project_summary",
      requestId: "mcp_req_summary"
    });

    expect(commit).toMatchObject({
      toolName: "cad.batch",
      isError: false,
      structuredContent: {
        ok: true,
        requestId: "mcp_req_commit",
        cadOpsVersion: "cadops.v1",
        mode: "commit",
        createdIds: ["committed_cylinder"],
        transactionId: "txn_1",
        actor: {
          type: "agent",
          id: "mcp",
          name: "MCP Client"
        }
      }
    });
    expect(summary.structuredContent).toMatchObject({
      ok: true,
      query: "project.summary",
      objectCount: 1,
      objects: [
        {
          id: "committed_cylinder",
          kind: "cylinder",
          dimensions: { radius: 2, height: 8 }
        }
      ],
      structure: {
        partCount: 1,
        featureCount: 1,
        bodyCount: 1,
        primitiveCompatibilityBodyCount: 1,
        authoredBodyFeatureCount: 0
      },
      references: {
        semanticBodySelectionCount: 1,
        generatedReferenceCount: 0,
        semanticBodySelectionStatusCounts: {
          unsupported: 1
        }
      },
      exportReadiness: {
        status: "unavailable",
        canExportFiles: false,
        bodyCount: 1,
        unavailableBodyCount: 1
      }
    });
  });

  it("passes actor metadata through cad.batch commits", () => {
    const server = new CadMcpServer();

    const commit = server.callTool({
      name: "cad.batch",
      requestId: "mcp_req_actor",
      arguments: {
        actor: {
          type: "agent",
          id: "external-agent",
          name: "External Agent"
        },
        allowCommit: true,
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [
            {
              op: "scene.createBox",
              id: "actor_box",
              dimensions: { width: 1, height: 1, depth: 1 }
            }
          ]
        }
      }
    });

    expect(commit).toMatchObject({
      toolName: "cad.batch",
      isError: false,
      structuredContent: {
        ok: true,
        requestId: "mcp_req_actor",
        transactionId: "txn_1",
        actor: {
          type: "agent",
          id: "external-agent",
          name: "External Agent"
        }
      }
    });
  });

  it("blocks cad.batch commit unless allowCommit is explicit", () => {
    const server = new CadMcpServer();

    const result = server.callTool({
      name: "cad.batch",
      requestId: "mcp_req_blocked_commit",
      arguments: {
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [
            {
              op: "scene.createBox",
              id: "blocked_mcp_box",
              dimensions: { width: 1, height: 1, depth: 1 }
            }
          ]
        }
      }
    });
    const summary = server.callTool({
      name: "cad.project_summary",
      requestId: "mcp_req_blocked_summary"
    });

    expect(result).toMatchObject({
      toolName: "cad.batch",
      isError: true,
      structuredContent: {
        ok: false,
        requestId: "mcp_req_blocked_commit",
        mode: "commit",
        error: {
          code: "COMMIT_NOT_ALLOWED",
          path: "$.permissions.allowCommit"
        },
        audit: {
          source: "mcp",
          requestId: "mcp_req_blocked_commit",
          toolName: "cad.batch",
          intent: "commit",
          operationCount: 1
        },
        review: {
          requestedMode: "commit",
          effectiveIntent: "commit",
          operationCount: 1,
          entityChanges: {
            objects: { created: 0, modified: 0, deleted: 0 }
          },
          operations: [
            {
              index: 0,
              op: "scene.createBox",
              intent: "create",
              label: "Create box blocked_mcp_box",
              objectId: "blocked_mcp_box"
            }
          ],
          audit: {
            source: "mcp",
            requestId: "mcp_req_blocked_commit",
            toolName: "cad.batch",
            intent: "commit",
            operationCount: 1,
            actor: {
              type: "agent",
              id: "mcp",
              name: "MCP Client"
            }
          },
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
    });
    expect(summary.structuredContent).toMatchObject({
      ok: true,
      objectCount: 0
    });
  });

  it("returns object measurements through cad.object_measurements", () => {
    const server = new CadMcpServer();

    server.callTool({
      name: "cad.batch",
      requestId: "mcp_req_create_measured",
      arguments: {
        allowCommit: true,
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [
            {
              op: "scene.createBox",
              id: "measured_box",
              dimensions: { width: 2, height: 4, depth: 6 }
            }
          ]
        }
      }
    });
    const result = server.callTool({
      name: "cad.object_measurements",
      requestId: "mcp_req_measure",
      arguments: { id: "measured_box" }
    });

    expect(result).toMatchObject({
      toolName: "cad.object_measurements",
      isError: false,
      structuredContent: {
        ok: true,
        requestId: "mcp_req_measure",
        cadOpsVersion: "cadops.v1",
        query: "object.measurements",
        measurements: {
          id: "measured_box",
          kind: "box",
          approximateVolume: 48,
          localBounds: {
            min: [-1, -2, -3],
            max: [1, 2, 3]
          }
        }
      }
    });
  });

  it("returns authored body measurements through cad.body_measurements", () => {
    const server = new CadMcpServer();

    server.callTool({
      name: "cad.batch",
      requestId: "mcp_req_create_body_measure",
      arguments: {
        allowCommit: true,
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [
            {
              op: "sketch.create",
              id: "sketch_body_measure",
              name: "Profile",
              plane: "XY"
            },
            {
              op: "sketch.addRectangle",
              sketchId: "sketch_body_measure",
              id: "rect_body_measure",
              center: [0, 0],
              width: 4,
              height: 2
            },
            {
              op: "feature.extrude",
              id: "feat_body_measure",
              bodyId: "body_measure",
              sketchId: "sketch_body_measure",
              entityId: "rect_body_measure",
              depth: 3
            }
          ]
        }
      }
    });

    const result = server.callTool({
      name: "cad.body_measurements",
      requestId: "mcp_req_body_measure",
      arguments: { bodyId: "body_measure" }
    });

    expect(result).toMatchObject({
      toolName: "cad.body_measurements",
      isError: false,
      structuredContent: {
        ok: true,
        requestId: "mcp_req_body_measure",
        cadOpsVersion: "cadops.v1",
        query: "body.measurements",
        measurements: {
          bodyId: "body_measure",
          sourceFeatureId: "feat_body_measure",
          profileKind: "rectangle",
          volume: 24,
          surfaceArea: 52,
          localBounds: {
            min: [-2, -1, 0],
            max: [2, 1, 3],
            size: [4, 2, 3]
          }
        }
      }
    });
  });

  it("returns missing body measurement errors through cad.body_measurements", () => {
    const server = new CadMcpServer();

    const result = server.callTool({
      name: "cad.body_measurements",
      requestId: "mcp_req_missing_body_measure",
      arguments: { bodyId: "missing_body" }
    });

    expect(result).toMatchObject({
      toolName: "cad.body_measurements",
      isError: true,
      structuredContent: {
        ok: false,
        requestId: "mcp_req_missing_body_measure",
        cadOpsVersion: "cadops.v1",
        query: "body.measurements",
        error: {
          code: "BODY_NOT_FOUND",
          bodyId: "missing_body"
        }
      }
    });
  });

  it("returns derived body topology status through cad.body_topology", () => {
    const server = new CadMcpServer();

    server.callTool({
      name: "cad.batch",
      requestId: "mcp_req_create_body_topology",
      arguments: {
        allowCommit: true,
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [
            {
              op: "sketch.create",
              id: "sketch_body_topology",
              name: "Profile",
              plane: "XY"
            },
            {
              op: "sketch.addRectangle",
              sketchId: "sketch_body_topology",
              id: "rect_body_topology",
              center: [0, 0],
              width: 4,
              height: 2
            },
            {
              op: "feature.extrude",
              id: "feat_body_topology",
              bodyId: "body_topology",
              sketchId: "sketch_body_topology",
              entityId: "rect_body_topology",
              depth: 3
            }
          ]
        }
      }
    });

    const result = server.callTool({
      name: "cad.body_topology",
      requestId: "mcp_req_body_topology",
      arguments: { bodyId: "body_topology" }
    });

    expect(result).toMatchObject({
      toolName: "cad.body_topology",
      isError: false,
      structuredContent: {
        ok: true,
        requestId: "mcp_req_body_topology",
        cadOpsVersion: "cadops.v1",
        query: "body.topology",
        topology: {
          bodyId: "body_topology",
          status: "healthy",
          sourceIdentity: {
            featureId: "feat_body_topology",
            sourceSketchId: "sketch_body_topology",
            sourceSketchEntityId: "rect_body_topology"
          },
          topologyModel: "semantic-source",
          topologyAvailable: true,
          exactGeometryAvailable: false,
          exactMeasurementsAvailable: true,
          measurementConfidence: "source-analytic",
          faceCount: 6,
          edgeCount: 12,
          vertexCount: 8,
          issues: []
        }
      }
    });

    const topologyContent = result.structuredContent as {
      readonly topology: {
        readonly sourceIdentity: { readonly signature: string };
      };
    };
    const exactResult = server.callTool({
      name: "cad.body_topology",
      requestId: "mcp_req_body_topology_exact",
      arguments: {
        bodyId: "body_topology",
        derivedExactMetadata: {
          bodyId: "body_topology",
          sourceIdentitySignature:
            topologyContent.topology.sourceIdentity.signature,
          status: "ready",
          metadata: {
            source: "kernel-derived",
            confidence: "kernel-derived",
            bounds: {
              min: [0, 0, 0],
              max: [4, 2, 3],
              size: [4, 2, 3],
              center: [2, 1, 1.5]
            },
            volume: 24,
            surfaceArea: 52,
            centroid: [2, 1, 1.5],
            topologyCounts: {
              solidCount: 1,
              faceCount: 6,
              edgeCount: 12,
              vertexCount: 8
            },
            diagnostics: []
          }
        }
      }
    });

    expect(exactResult).toMatchObject({
      toolName: "cad.body_topology",
      isError: false,
      structuredContent: {
        ok: true,
        requestId: "mcp_req_body_topology_exact",
        query: "body.topology",
        topology: {
          bodyId: "body_topology",
          exactGeometryAvailable: true,
          exactMeasurementsAvailable: true,
          measurementConfidence: "kernel-derived",
          exactMetadata: { status: "healthy", volume: 24 }
        }
      }
    });
  });

  it("accepts sphere batches and exposes sphere measurements", () => {
    const server = new CadMcpServer();

    server.callTool({
      name: "cad.batch",
      requestId: "mcp_req_create_sphere",
      arguments: {
        allowCommit: true,
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [
            {
              op: "scene.createSphere",
              id: "measured_sphere",
              dimensions: { radius: 2 }
            }
          ]
        }
      }
    });
    const result = server.callTool({
      name: "cad.object_measurements",
      requestId: "mcp_req_measure_sphere",
      arguments: { id: "measured_sphere" }
    });

    expect(result).toMatchObject({
      toolName: "cad.object_measurements",
      isError: false,
      structuredContent: {
        ok: true,
        requestId: "mcp_req_measure_sphere",
        query: "object.measurements",
        measurements: {
          id: "measured_sphere",
          kind: "sphere",
          dimensions: { radius: 2 },
          localBounds: {
            min: [-2, -2, -2],
            max: [2, 2, 2]
          }
        }
      }
    });
  });

  it("accepts cone and torus batches and exposes their measurements", () => {
    const server = new CadMcpServer();

    const commit = server.callTool({
      name: "cad.batch",
      requestId: "mcp_req_create_cone_torus",
      arguments: {
        allowCommit: true,
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [
            {
              op: "scene.createCone",
              id: "measured_cone",
              dimensions: { radius: 1.5, height: 4 }
            },
            {
              op: "scene.createTorus",
              id: "measured_torus",
              dimensions: { majorRadius: 3, minorRadius: 1 }
            }
          ]
        }
      }
    });
    const cone = server.callTool({
      name: "cad.object_measurements",
      requestId: "mcp_req_measure_cone",
      arguments: { id: "measured_cone" }
    });
    const torus = server.callTool({
      name: "cad.object_measurements",
      requestId: "mcp_req_measure_torus",
      arguments: { id: "measured_torus" }
    });

    expect(commit).toMatchObject({
      toolName: "cad.batch",
      isError: false,
      structuredContent: {
        ok: true,
        requestId: "mcp_req_create_cone_torus",
        createdIds: ["measured_cone", "measured_torus"],
        transactionId: "txn_1"
      }
    });
    expect(cone).toMatchObject({
      toolName: "cad.object_measurements",
      isError: false,
      structuredContent: {
        ok: true,
        requestId: "mcp_req_measure_cone",
        query: "object.measurements",
        measurements: {
          id: "measured_cone",
          kind: "cone",
          dimensions: { radius: 1.5, height: 4 },
          localBounds: {
            min: [-1.5, -1.5, -2],
            max: [1.5, 1.5, 2]
          }
        }
      }
    });
    expect(torus).toMatchObject({
      toolName: "cad.object_measurements",
      isError: false,
      structuredContent: {
        ok: true,
        requestId: "mcp_req_measure_torus",
        query: "object.measurements",
        measurements: {
          id: "measured_torus",
          kind: "torus",
          dimensions: { majorRadius: 3, minorRadius: 1 },
          localBounds: {
            min: [-4, -4, -1],
            max: [4, 4, 1]
          }
        }
      }
    });
  });

  it("returns primitive feature summaries through cad.project_features", () => {
    const server = new CadMcpServer();

    server.callTool({
      name: "cad.batch",
      requestId: "mcp_req_create_feature_box",
      arguments: {
        allowCommit: true,
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [
            {
              op: "scene.createBox",
              id: "mcp_feature_box",
              dimensions: { width: 2, height: 3, depth: 4 }
            }
          ]
        }
      }
    });
    const result = server.callTool({
      name: "cad.project_features",
      requestId: "mcp_req_features"
    });

    expect(result).toMatchObject({
      toolName: "cad.project_features",
      isError: false,
      structuredContent: {
        ok: true,
        requestId: "mcp_req_features",
        query: "project.features",
        featureCount: 1,
        features: [
          {
            id: "feature:mcp_feature_box",
            kind: "primitive",
            primitive: "box",
            objectId: "mcp_feature_box",
            source: {
              createdByTransactionId: "txn_1",
              createOp: "scene.createBox"
            }
          }
        ]
      }
    });
  });

  it("returns derived model structure through cad.project_structure", () => {
    const server = new CadMcpServer();

    server.callTool({
      name: "cad.batch",
      requestId: "mcp_req_create_structure_box",
      arguments: {
        allowCommit: true,
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [
            {
              op: "scene.createBox",
              id: "mcp_structure_box",
              dimensions: { width: 2, height: 3, depth: 4 }
            }
          ]
        }
      }
    });
    const result = server.callTool({
      name: "cad.project_structure",
      requestId: "mcp_req_structure"
    });

    expect(result).toMatchObject({
      toolName: "cad.project_structure",
      isError: false,
      structuredContent: {
        ok: true,
        requestId: "mcp_req_structure",
        query: "project.structure",
        partCount: 1,
        featureCount: 1,
        bodyCount: 1,
        parts: [
          {
            id: "part:default",
            featureIds: ["feature:mcp_structure_box"],
            bodyIds: ["body:mcp_structure_box"],
            objectIds: ["mcp_structure_box"]
          }
        ],
        features: [
          {
            id: "feature:mcp_structure_box",
            partId: "part:default",
            objectId: "mcp_structure_box",
            bodyId: "body:mcp_structure_box"
          }
        ],
        bodies: [
          {
            id: "body:mcp_structure_box",
            partId: "part:default",
            featureId: "feature:mcp_structure_box",
            objectId: "mcp_structure_box"
          }
        ],
        objectSources: [
          {
            objectId: "mcp_structure_box",
            partId: "part:default",
            featureId: "feature:mcp_structure_box",
            bodyId: "body:mcp_structure_box"
          }
        ]
      }
    });
  });

  it("returns export readiness through cad.project_export_readiness", () => {
    const server = new CadMcpServer();

    server.callTool({
      name: "cad.batch",
      requestId: "mcp_req_create_export_ready_body",
      arguments: {
        allowCommit: true,
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [
            {
              op: "sketch.create",
              id: "sketch_export_ready",
              name: "Export profile",
              plane: "XY"
            },
            {
              op: "sketch.addRectangle",
              sketchId: "sketch_export_ready",
              id: "rect_export_ready",
              center: [0, 0],
              width: 2,
              height: 1
            },
            {
              op: "feature.extrude",
              id: "feat_export_ready",
              bodyId: "body_export_ready",
              sketchId: "sketch_export_ready",
              entityId: "rect_export_ready",
              depth: 1.5
            }
          ]
        }
      }
    });

    const result = server.callTool({
      name: "cad.project_export_readiness",
      requestId: "mcp_req_export_readiness"
    });

    expect(result).toMatchObject({
      toolName: "cad.project_export_readiness",
      isError: false,
      structuredContent: {
        ok: true,
        requestId: "mcp_req_export_readiness",
        query: "project.exportReadiness",
        status: "supported",
        canExportFiles: true,
        bodyCount: 1,
        sourceSupportedBodyCount: 1,
        formats: expect.arrayContaining([
          expect.objectContaining({
            format: "step",
            label: "STEP",
            status: "supported",
            available: true,
            writerStatus: "available"
          }),
          expect.objectContaining({
            format: "glb",
            label: "Mesh/GLB visualization",
            status: "deferred",
            available: false
          })
        ]),
        bodies: [
          expect.objectContaining({
            bodyId: "body_export_ready",
            sourceKind: "authoredExtrude",
            sourceStatus: "supported",
            status: "supported"
          })
        ]
      }
    });
  });

  it("returns exact STEP source requests through cad.project_export_exact", () => {
    const server = new CadMcpServer();

    server.callTool({
      name: "cad.batch",
      requestId: "mcp_req_exact_export_setup",
      arguments: {
        allowCommit: true,
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [
            {
              op: "sketch.create",
              id: "sketch_exact_export",
              name: "Exact export profile",
              plane: "XY"
            },
            {
              op: "sketch.addRectangle",
              sketchId: "sketch_exact_export",
              id: "rect_exact_export",
              center: [0, 0],
              width: 2,
              height: 1
            },
            {
              op: "feature.extrude",
              id: "feat_exact_export",
              bodyId: "body_exact_export",
              sketchId: "sketch_exact_export",
              entityId: "rect_exact_export",
              depth: 1.5
            }
          ]
        }
      }
    });

    const result = server.callTool({
      name: "cad.project_export_exact",
      requestId: "mcp_req_exact_export",
      arguments: {
        format: "step",
        bodyIds: ["body_exact_export"]
      }
    });

    expect(result).toMatchObject({
      toolName: "cad.project_export_exact",
      isError: false,
      structuredContent: {
        ok: true,
        requestId: "mcp_req_exact_export",
        query: "project.exportExact",
        format: "step",
        status: "supported",
        available: true,
        canExportFile: true,
        writerStatus: "available",
        requestedBodyIds: ["body_exact_export"],
        sourceSupportedBodyCount: 1,
        exportableBodyCount: 1,
        diagnostics: expect.arrayContaining([
          expect.objectContaining({
            code: "EXPORT_BODY_SOURCE_SUPPORTED",
            status: "supported",
            bodyId: "body_exact_export"
          })
        ]),
        exportSources: [
          expect.objectContaining({
            bodyId: "body_exact_export",
            sourceKind: "authoredExtrude",
            featureId: "feat_exact_export",
            sourceSketchId: "sketch_exact_export",
            sourceSketchEntityId: "rect_exact_export",
            profile: expect.objectContaining({
              kind: "rectangle"
            })
          })
        ]
      }
    });
    expect(
      "artifact" in
        (result.structuredContent as unknown as Record<string, unknown>)
    ).toBe(false);
  });

  it("returns V8 package readiness through cad.project_package_readiness", () => {
    const server = new CadMcpServer();

    server.callTool({
      name: "cad.batch",
      requestId: "mcp_req_package_readiness_seed",
      arguments: {
        permissions: { allowCommit: true },
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [
            {
              op: "sketch.create",
              id: "sketch_package_ready",
              name: "Package ready sketch",
              plane: "XY"
            },
            {
              op: "sketch.addRectangle",
              sketchId: "sketch_package_ready",
              id: "rect_package_ready",
              center: [0, 0],
              width: 2,
              height: 1
            },
            {
              op: "feature.extrude",
              id: "feat_package_ready",
              bodyId: "body_package_ready",
              sketchId: "sketch_package_ready",
              entityId: "rect_package_ready",
              depth: 1.5
            }
          ]
        }
      }
    });

    const result = server.callTool({
      name: "cad.project_package_readiness",
      requestId: "mcp_req_package_readiness"
    });

    expect(result).toMatchObject({
      toolName: "cad.project_package_readiness",
      isError: false,
      structuredContent: {
        ok: true,
        requestId: "mcp_req_package_readiness",
        query: "project.packageReadiness",
        status: "supported",
        packageVersion: "partbench.wcad.v1",
        fileExtension: ".wcad",
        documentSchemaVersion: "web-cad.project.v16",
        canRepresentCurrentSource: true,
        requiredEntries: [
          { role: "manifest", path: "manifest.json", source: true },
          { role: "document", path: "document.cbor", source: true },
          { role: "commands", path: "commands.cbor", source: true }
        ],
        capabilities: expect.arrayContaining([
          expect.objectContaining({
            capability: "packageContract",
            status: "supported"
          }),
          expect.objectContaining({
            capability: "packageReadWrite",
            status: "supported"
          }),
          expect.objectContaining({
            capability: "opfsCache",
            status: "supported",
            available: true
          }),
          expect.objectContaining({
            capability: "stepExport",
            status: "supported",
            available: true
          })
        ])
      }
    });
    expect(JSON.stringify(result.structuredContent)).not.toMatch(
      /rendererId|renderId|meshId|occtId|occtShape|opfsPath|fileHandle|selectionBufferId|triangleIndex|faceIndex|edgeIndex|vertexIndex/i
    );
  });

  it("returns compact V8 package, cache, export, and file boundary surface through cad.v8_project_surface", () => {
    const server = new CadMcpServer();

    server.callTool({
      name: "cad.batch",
      requestId: "mcp_req_v8_surface_seed_primitive",
      arguments: {
        allowCommit: true,
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [
            {
              op: "scene.createBox",
              id: "mcp_surface_box",
              dimensions: { width: 1, height: 1, depth: 1 }
            }
          ]
        }
      }
    });
    server.callTool({
      name: "cad.batch",
      requestId: "mcp_req_v8_surface_seed_body",
      arguments: {
        allowCommit: true,
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [
            {
              op: "sketch.create",
              id: "sketch_mcp_surface",
              name: "MCP surface profile",
              plane: "XY"
            },
            {
              op: "sketch.addRectangle",
              sketchId: "sketch_mcp_surface",
              id: "rect_mcp_surface",
              center: [0, 0],
              width: 2,
              height: 1
            },
            {
              op: "feature.extrude",
              id: "feat_mcp_surface",
              bodyId: "body_mcp_surface",
              sketchId: "sketch_mcp_surface",
              entityId: "rect_mcp_surface",
              depth: 1.5
            }
          ]
        }
      }
    });

    const result = server.callTool({
      name: "cad.v8_project_surface",
      requestId: "mcp_req_v8_surface",
      arguments: {
        exactExport: {
          format: "step",
          bodyIds: ["body_mcp_surface"]
        }
      }
    });
    const invalidWrite = server.callTool({
      name: "cad.v8_project_surface",
      requestId: "mcp_req_v8_surface_write",
      arguments: {
        writeFile: true,
        localPath: "/tmp/part.step"
      }
    });

    expect(result).toMatchObject({
      toolName: "cad.v8_project_surface",
      isError: false,
      structuredContent: {
        ok: true,
        requestId: "mcp_req_v8_surface",
        surface: "v8.agent_mcp_package_export",
        package: {
          packageVersion: "partbench.wcad.v1",
          fileExtension: ".wcad",
          diagnostics: expect.arrayContaining([
            expect.objectContaining({ code: "WCAD_PACKAGE_CONTRACT_READY" })
          ])
        },
        cache: {
          cachePolicy: "optional-rebuildable",
          opfsLocationsExposed: false,
          clearMutatesSource: false
        },
        exportReadiness: {
          status: "supported",
          canExportFiles: true,
          unsupportedBodies: [
            expect.objectContaining({
              bodyId: "body:mcp_surface_box",
              sourceKind: "primitiveCompatibility"
            })
          ]
        },
        exactExport: {
          format: "step",
          available: true,
          canExportFile: true,
          requestedBodyIds: ["body_mcp_surface"],
          exportSourceCount: 1,
          artifactPolicy: {
            artifactBytesReturned: false,
            fileWritesPerformed: false,
            localLocationsAccepted: false,
            browserHandlesAccepted: false
          }
        },
        fileWriting: {
          defaultBehavior: "readiness-only",
          adapterWritesUserVisibleFiles: false,
          mcpWritesUserVisibleFiles: false,
          localLocationsAccepted: false,
          browserHandlesAccepted: false,
          opfsLocationsAccepted: false
        },
        boundaries: {
          browserHandlesExposed: false,
          localLocationsExposed: false,
          opfsLocationsExposed: false,
          packageBinaryReturned: false,
          stepBytesReturned: false,
          jsonImportExportPreserved: true
        }
      }
    });
    expect(JSON.stringify(result.structuredContent)).not.toMatch(
      /rendererId|renderId|meshId|occtId|occtShape|opfsPath|fileHandle|selectionBufferId|triangleIndex|faceIndex|edgeIndex|vertexIndex|bytesBase64|localPath/i
    );
    expect(invalidWrite).toMatchObject({
      toolName: "cad.v8_project_surface",
      isError: true,
      structuredContent: {
        ok: false,
        error: {
          code: "INVALID_ARGUMENTS"
        }
      }
    });
  });

  it("commits sketch extrude batches through cad.batch", () => {
    const server = new CadMcpServer();
    const batchResult = server.callTool({
      name: "cad.batch",
      requestId: "mcp_req_extrude",
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
              op: "sketch.addCircle",
              sketchId: "sketch_1",
              id: "circle_1",
              center: [0, 0],
              radius: 2
            },
            {
              op: "feature.extrude",
              id: "feat_1",
              bodyId: "body_1",
              sketchId: "sketch_1",
              entityId: "circle_1",
              depth: 5,
              operationMode: "newBody"
            }
          ]
        }
      }
    });
    const structureResult = server.callTool({
      name: "cad.project_structure",
      requestId: "mcp_req_extrude_structure"
    });

    expect(batchResult).toMatchObject({
      toolName: "cad.batch",
      isError: false,
      structuredContent: {
        ok: true,
        createdFeatureIds: ["feat_1"],
        createdBodyIds: ["body_1"]
      }
    });
    expect(structureResult).toMatchObject({
      structuredContent: {
        ok: true,
        features: [{ id: "feat_1", kind: "extrude", operationMode: "newBody" }],
        bodies: [{ id: "body_1", featureId: "feat_1" }]
      }
    });
  });

  it("passes feature.revolve through cad.batch", () => {
    const server = new CadMcpServer();
    const batchResult = server.callTool({
      name: "cad.batch",
      requestId: "mcp_req_revolve",
      arguments: {
        allowCommit: true,
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [
            {
              op: "sketch.create",
              id: "sketch_1",
              name: "Revolve",
              plane: "XY"
            },
            {
              op: "sketch.addRectangle",
              sketchId: "sketch_1",
              id: "rect_1",
              center: [2, 0],
              width: 1,
              height: 2
            },
            {
              op: "sketch.addLine",
              sketchId: "sketch_1",
              id: "axis_1",
              start: [0, -2],
              end: [0, 2]
            },
            {
              op: "feature.revolve",
              id: "feat_revolve_1",
              bodyId: "body_revolve_1",
              sketchId: "sketch_1",
              entityId: "rect_1",
              axis: {
                type: "sketchLine",
                sketchId: "sketch_1",
                entityId: "axis_1"
              },
              angleDegrees: 180,
              operationMode: "newBody"
            }
          ]
        }
      }
    });
    const structureResult = server.callTool({
      name: "cad.project_structure",
      requestId: "mcp_req_revolve_structure"
    });

    expect(batchResult).toMatchObject({
      toolName: "cad.batch",
      isError: false,
      structuredContent: {
        ok: true,
        createdFeatureIds: ["feat_revolve_1"],
        createdBodyIds: ["body_revolve_1"]
      }
    });
    expect(structureResult).toMatchObject({
      structuredContent: {
        ok: true,
        features: [
          { id: "feat_revolve_1", kind: "revolve", angleDegrees: 180 }
        ],
        bodies: [
          {
            id: "body_revolve_1",
            featureId: "feat_revolve_1",
            source: { type: "sketchRevolveFeature" }
          }
        ]
      }
    });
  });

  it("passes feature.hole through cad.batch", () => {
    const server = new CadMcpServer();
    const batchResult = server.callTool({
      name: "cad.batch",
      requestId: "mcp_req_hole",
      arguments: {
        allowCommit: true,
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [
            {
              op: "sketch.create",
              id: "sketch_target",
              name: "Target",
              plane: "XY"
            },
            {
              op: "sketch.addRectangle",
              sketchId: "sketch_target",
              id: "rect_target",
              center: [0, 0],
              width: 4,
              height: 3
            },
            {
              op: "feature.extrude",
              id: "feat_target",
              bodyId: "body_target",
              sketchId: "sketch_target",
              entityId: "rect_target",
              depth: 2
            },
            {
              op: "sketch.create",
              id: "sketch_hole",
              name: "Hole",
              plane: "XY"
            },
            {
              op: "sketch.addCircle",
              sketchId: "sketch_hole",
              id: "circle_hole",
              center: [0, 0],
              radius: 0.5
            },
            {
              op: "feature.hole",
              id: "feat_hole",
              bodyId: "body_hole",
              targetBodyId: "body_target",
              sketchId: "sketch_hole",
              circleEntityId: "circle_hole",
              depthMode: "throughAll"
            }
          ]
        }
      }
    });
    const structureResult = server.callTool({
      name: "cad.project_structure",
      requestId: "mcp_req_hole_structure"
    });

    expect(batchResult).toMatchObject({
      toolName: "cad.batch",
      isError: false,
      structuredContent: {
        ok: true,
        createdFeatureIds: ["feat_target", "feat_hole"],
        createdBodyIds: ["body_target", "body_hole"]
      }
    });
    expect(structureResult).toMatchObject({
      structuredContent: {
        ok: true,
        features: expect.arrayContaining([
          expect.objectContaining({
            id: "feat_hole",
            kind: "hole",
            targetBodyId: "body_target"
          })
        ]),
        bodies: expect.arrayContaining([
          expect.objectContaining({
            id: "body_target",
            consumedByFeatureId: "feat_hole"
          }),
          expect.objectContaining({
            id: "body_hole",
            featureId: "feat_hole",
            source: expect.objectContaining({ type: "sketchHoleFeature" })
          })
        ])
      }
    });
  });

  it("passes feature.chamfer and feature.fillet through cad.batch", () => {
    const server = new CadMcpServer();
    const chamferResult = server.callTool({
      name: "cad.batch",
      requestId: "mcp_req_chamfer",
      arguments: {
        allowCommit: true,
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [
            {
              op: "sketch.create",
              id: "sketch_target",
              name: "Target",
              plane: "XY"
            },
            {
              op: "sketch.addRectangle",
              sketchId: "sketch_target",
              id: "rect_target",
              center: [0, 0],
              width: 4,
              height: 3
            },
            {
              op: "feature.extrude",
              id: "feat_target",
              bodyId: "body_target",
              sketchId: "sketch_target",
              entityId: "rect_target",
              depth: 2
            },
            {
              op: "feature.chamfer",
              id: "feat_chamfer",
              bodyId: "body_chamfer",
              targetBodyId: "body_target",
              edgeStableId: "generated:edge:body_target:start:uMin",
              distance: 0.2
            }
          ]
        }
      }
    });

    expect(chamferResult).toMatchObject({
      toolName: "cad.batch",
      isError: false,
      structuredContent: {
        ok: true,
        createdFeatureIds: ["feat_target", "feat_chamfer"],
        createdBodyIds: ["body_target", "body_chamfer"]
      }
    });

    const filletServer = new CadMcpServer();
    const filletResult = filletServer.callTool({
      name: "cad.batch",
      requestId: "mcp_req_fillet",
      arguments: {
        allowCommit: true,
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [
            {
              op: "sketch.create",
              id: "sketch_circle",
              name: "Circle",
              plane: "XY"
            },
            {
              op: "sketch.addCircle",
              sketchId: "sketch_circle",
              id: "circle_target",
              center: [0, 0],
              radius: 2
            },
            {
              op: "feature.extrude",
              id: "feat_circle",
              bodyId: "body_circle",
              sketchId: "sketch_circle",
              entityId: "circle_target",
              depth: 3
            },
            {
              op: "reference.nameGenerated",
              name: "Roundable edge",
              bodyId: "body_circle",
              stableId: "generated:edge:body_circle:end:circular"
            },
            {
              op: "feature.fillet",
              id: "feat_fillet",
              bodyId: "body_fillet",
              targetBodyId: "body_circle",
              namedReference: "Roundable edge",
              radius: 0.25
            }
          ]
        }
      }
    });

    expect(filletResult).toMatchObject({
      toolName: "cad.batch",
      isError: false,
      structuredContent: {
        ok: true,
        createdFeatureIds: ["feat_circle", "feat_fillet"],
        createdBodyIds: ["body_circle", "body_fillet"]
      }
    });
  });

  it("passes unsupported extrude operation mode errors through cad.batch", () => {
    const server = new CadMcpServer();
    seedMcpExtrudeFeature(server, {
      sketchId: "sketch_unsupported",
      entityId: "circle_unsupported",
      featureId: "feat_seed_unsupported",
      bodyId: "body_seed_unsupported"
    });

    const result = server.callTool({
      name: "cad.batch",
      requestId: "mcp_req_unsupported_operation",
      arguments: {
        batch: {
          version: "cadops.v1",
          mode: "dryRun",
          ops: [
            {
              op: "feature.extrude",
              id: "feat_cut",
              bodyId: "body_cut",
              targetBodyId: "body_seed_unsupported",
              sketchId: "sketch_unsupported",
              entityId: "circle_unsupported",
              depth: 3,
              operationMode: "cut"
            }
          ]
        }
      }
    });

    expect(result).toMatchObject({
      toolName: "cad.batch",
      isError: true,
      structuredContent: {
        ok: false,
        error: {
          code: "UNSUPPORTED_FEATURE_OPERATION",
          path: "$.ops[0].operationMode"
        }
      }
    });
  });

  it("passes rectangle cut extrudes through cad.batch dry-run and commit", () => {
    const server = new CadMcpServer();
    const seedResult = server.callTool({
      name: "cad.batch",
      requestId: "mcp_req_seed_cut_target",
      arguments: {
        allowCommit: true,
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [
            {
              op: "sketch.create",
              id: "sketch_cut",
              name: "Profile",
              plane: "XY"
            },
            {
              op: "sketch.addRectangle",
              sketchId: "sketch_cut",
              id: "rect_cut",
              center: [0, 0],
              width: 3,
              height: 2
            },
            {
              op: "feature.extrude",
              id: "feat_seed_cut",
              bodyId: "body_seed_cut",
              sketchId: "sketch_cut",
              entityId: "rect_cut",
              depth: 4
            }
          ]
        }
      }
    });

    expect(seedResult).toMatchObject({
      toolName: "cad.batch",
      isError: false
    });

    const cutBatch = {
      version: "cadops.v1" as const,
      mode: "commit" as const,
      ops: [
        {
          op: "feature.extrude" as const,
          id: "feat_cut",
          bodyId: "body_cut",
          targetBodyId: "body_seed_cut",
          sketchId: "sketch_cut",
          entityId: "rect_cut",
          depth: 1,
          operationMode: "cut" as const
        }
      ]
    };
    const dryRun = server.callTool({
      name: "cad.batch",
      requestId: "mcp_req_cut_dry_run",
      arguments: { batch: { ...cutBatch, mode: "dryRun" } }
    });
    const commit = server.callTool({
      name: "cad.batch",
      requestId: "mcp_req_cut_commit",
      arguments: {
        allowCommit: true,
        batch: cutBatch
      }
    });

    expect(dryRun).toMatchObject({
      toolName: "cad.batch",
      isError: false,
      structuredContent: {
        ok: true,
        createdFeatureIds: ["feat_cut"],
        createdBodyIds: ["body_cut"]
      }
    });
    expect(commit).toMatchObject({
      toolName: "cad.batch",
      isError: false,
      structuredContent: {
        ok: true,
        createdFeatureIds: ["feat_cut"],
        createdBodyIds: ["body_cut"]
      }
    });
  });

  it("passes rectangle add extrudes through cad.batch dry-run and commit", () => {
    const server = new CadMcpServer();
    const seedResult = server.callTool({
      name: "cad.batch",
      requestId: "mcp_req_seed_add_target",
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
              id: "feat_seed_add",
              bodyId: "body_seed_add",
              sketchId: "sketch_add",
              entityId: "rect_add",
              depth: 4
            }
          ]
        }
      }
    });

    expect(seedResult).toMatchObject({
      toolName: "cad.batch",
      isError: false
    });

    const addBatch = {
      version: "cadops.v1" as const,
      mode: "commit" as const,
      ops: [
        {
          op: "feature.extrude" as const,
          id: "feat_add",
          bodyId: "body_add",
          targetBodyId: "body_seed_add",
          sketchId: "sketch_add",
          entityId: "rect_add",
          depth: 1,
          operationMode: "add" as const
        }
      ]
    };
    const dryRun = server.callTool({
      name: "cad.batch",
      requestId: "mcp_req_add_dry_run",
      arguments: { batch: { ...addBatch, mode: "dryRun" } }
    });
    const commit = server.callTool({
      name: "cad.batch",
      requestId: "mcp_req_add_commit",
      arguments: {
        allowCommit: true,
        batch: addBatch
      }
    });

    expect(dryRun).toMatchObject({
      toolName: "cad.batch",
      isError: false,
      structuredContent: {
        ok: true,
        createdFeatureIds: ["feat_add"],
        createdBodyIds: ["body_add"]
      }
    });
    expect(commit).toMatchObject({
      toolName: "cad.batch",
      isError: false,
      structuredContent: {
        ok: true,
        createdFeatureIds: ["feat_add"],
        createdBodyIds: ["body_add"]
      }
    });
  });

  it("passes circle-target cut extrudes through cad.batch dry-run and commit", () => {
    const server = new CadMcpServer();
    const seedResult = server.callTool({
      name: "cad.batch",
      requestId: "mcp_req_seed_circle_cut_target",
      arguments: {
        allowCommit: true,
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [
            {
              op: "sketch.create",
              id: "sketch_circle_cut",
              name: "Profile",
              plane: "XY"
            },
            {
              op: "sketch.addCircle",
              sketchId: "sketch_circle_cut",
              id: "circle_target",
              center: [0, 0],
              radius: 2
            },
            {
              op: "sketch.addRectangle",
              sketchId: "sketch_circle_cut",
              id: "rect_tool",
              center: [0, 0],
              width: 1,
              height: 1
            },
            {
              op: "feature.extrude",
              id: "feat_circle_target",
              bodyId: "body_circle_target",
              sketchId: "sketch_circle_cut",
              entityId: "circle_target",
              depth: 4
            }
          ]
        }
      }
    });

    expect(seedResult).toMatchObject({
      toolName: "cad.batch",
      isError: false
    });

    const cutBatch = {
      version: "cadops.v1" as const,
      mode: "commit" as const,
      ops: [
        {
          op: "feature.extrude" as const,
          id: "feat_circle_cut",
          bodyId: "body_circle_cut",
          targetBodyId: "body_circle_target",
          sketchId: "sketch_circle_cut",
          entityId: "rect_tool",
          depth: 1,
          operationMode: "cut" as const
        }
      ]
    };
    const dryRun = server.callTool({
      name: "cad.batch",
      requestId: "mcp_req_circle_cut_dry_run",
      arguments: { batch: { ...cutBatch, mode: "dryRun" } }
    });
    const commit = server.callTool({
      name: "cad.batch",
      requestId: "mcp_req_circle_cut_commit",
      arguments: {
        allowCommit: true,
        batch: cutBatch
      }
    });

    expect(dryRun).toMatchObject({
      toolName: "cad.batch",
      isError: false,
      structuredContent: {
        ok: true,
        createdFeatureIds: ["feat_circle_cut"],
        createdBodyIds: ["body_circle_cut"]
      }
    });
    expect(commit).toMatchObject({
      toolName: "cad.batch",
      isError: false,
      structuredContent: {
        ok: true,
        createdFeatureIds: ["feat_circle_cut"],
        createdBodyIds: ["body_circle_cut"]
      }
    });
  });

  it("passes feature.updateExtrude through cad.batch dry-run and commit", () => {
    const server = new CadMcpServer();
    seedMcpExtrudeFeature(server, {
      sketchId: "sketch_update",
      entityId: "circle_update",
      featureId: "feat_update",
      bodyId: "body_update"
    });

    const dryRun = server.callTool({
      name: "cad.batch",
      requestId: "mcp_req_update_dry_run",
      arguments: {
        batch: {
          version: "cadops.v1",
          mode: "dryRun",
          ops: [
            {
              op: "feature.updateExtrude",
              id: "feat_update",
              depth: 9,
              side: "negative"
            }
          ]
        }
      }
    });
    const dryRunStructure = server.callTool({
      name: "cad.project_structure",
      requestId: "mcp_req_update_dry_run_structure"
    });

    expect(dryRun).toMatchObject({
      toolName: "cad.batch",
      isError: false,
      structuredContent: {
        ok: true,
        requestId: "mcp_req_update_dry_run",
        mode: "dryRun",
        modifiedFeatureIds: ["feat_update"],
        modifiedBodyIds: ["body_update"],
        audit: {
          source: "mcp",
          requestId: "mcp_req_update_dry_run",
          toolName: "cad.batch",
          intent: "dryRun",
          operationCount: 1
        }
      }
    });
    expect(dryRunStructure).toMatchObject({
      structuredContent: {
        ok: true,
        features: [{ id: "feat_update", depth: 5, side: "positive" }],
        bodies: [{ id: "body_update", featureId: "feat_update" }]
      }
    });

    const commit = server.callTool({
      name: "cad.batch",
      requestId: "mcp_req_update_commit",
      arguments: {
        allowCommit: true,
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [
            {
              op: "feature.updateExtrude",
              id: "feat_update",
              depth: 9,
              side: "symmetric"
            }
          ]
        }
      }
    });
    const committedStructure = server.callTool({
      name: "cad.project_structure",
      requestId: "mcp_req_update_commit_structure"
    });
    const history = server.callTool({
      name: "cad.transaction_history",
      requestId: "mcp_req_update_commit_history"
    });

    expect(commit).toMatchObject({
      toolName: "cad.batch",
      isError: false,
      structuredContent: {
        ok: true,
        requestId: "mcp_req_update_commit",
        mode: "commit",
        modifiedFeatureIds: ["feat_update"],
        modifiedBodyIds: ["body_update"],
        transactionId: "txn_2",
        actor: {
          type: "agent",
          id: "mcp",
          name: "MCP Client"
        },
        audit: {
          source: "mcp",
          requestId: "mcp_req_update_commit",
          toolName: "cad.batch",
          intent: "commit",
          operationCount: 1
        }
      }
    });
    expect(committedStructure).toMatchObject({
      structuredContent: {
        ok: true,
        features: [{ id: "feat_update", depth: 9, side: "symmetric" }],
        bodies: [{ id: "body_update", featureId: "feat_update" }]
      }
    });

    expect(history).toMatchObject({
      toolName: "cad.transaction_history",
      isError: false,
      structuredContent: {
        ok: true,
        query: "transaction.history"
      }
    });

    const historyContent = history.structuredContent as {
      readonly transactions?: readonly {
        readonly diff: {
          readonly features?: {
            readonly referenceEffects?: readonly {
              readonly category: string;
              readonly bodyId?: string;
              readonly sourceFeatureId?: string;
            }[];
          };
        };
      }[];
    };

    expect(historyContent.transactions?.at(-1)?.diff.features).toMatchObject({
      referenceEffects: expect.arrayContaining([
        expect.objectContaining({
          category: "active",
          bodyId: "body_update",
          sourceFeatureId: "feat_update"
        })
      ])
    });
  });

  it("passes feature.updateHole through cad.batch dry-run and commit", () => {
    const server = new CadMcpServer();

    seedMcpExtrudeFeature(server, {
      sketchId: "sketch_hole_target",
      entityId: "circle_hole_target",
      featureId: "feat_hole_target",
      bodyId: "body_hole_target"
    });
    server.callTool({
      name: "cad.batch",
      requestId: "mcp_req_seed_hole",
      arguments: {
        allowCommit: true,
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [
            {
              op: "sketch.create",
              id: "sketch_hole",
              name: "Hole",
              plane: "XY"
            },
            {
              op: "sketch.addCircle",
              sketchId: "sketch_hole",
              id: "circle_hole",
              center: [0, 0],
              radius: 0.4
            },
            {
              op: "feature.hole",
              id: "feat_hole",
              bodyId: "body_hole",
              targetBodyId: "body_hole_target",
              sketchId: "sketch_hole",
              circleEntityId: "circle_hole",
              depthMode: "blind",
              depth: 1,
              direction: "negative"
            }
          ]
        }
      }
    });

    const dryRun = server.callTool({
      name: "cad.batch",
      requestId: "mcp_req_update_hole_dry_run",
      arguments: {
        batch: {
          version: "cadops.v1",
          mode: "dryRun",
          ops: [
            {
              op: "feature.updateHole",
              id: "feat_hole",
              depthMode: "throughAll",
              direction: "positive"
            }
          ]
        }
      }
    });
    const commit = server.callTool({
      name: "cad.batch",
      requestId: "mcp_req_update_hole_commit",
      arguments: {
        allowCommit: true,
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [
            {
              op: "feature.updateHole",
              id: "feat_hole",
              depthMode: "throughAll",
              direction: "positive"
            }
          ]
        }
      }
    });
    const structure = server.callTool({
      name: "cad.project_structure",
      requestId: "mcp_req_update_hole_structure"
    });

    expect(dryRun).toMatchObject({
      toolName: "cad.batch",
      isError: false,
      structuredContent: {
        ok: true,
        mode: "dryRun",
        modifiedFeatureIds: ["feat_hole"],
        modifiedBodyIds: ["body_hole"]
      }
    });
    expect(commit).toMatchObject({
      toolName: "cad.batch",
      isError: false,
      structuredContent: {
        ok: true,
        mode: "commit",
        modifiedFeatureIds: ["feat_hole"],
        modifiedBodyIds: ["body_hole"]
      }
    });
    expect(structure).toMatchObject({
      structuredContent: {
        ok: true,
        features: expect.arrayContaining([
          expect.objectContaining({
            id: "feat_hole",
            kind: "hole",
            depthMode: "throughAll",
            direction: "positive"
          })
        ])
      }
    });
  });

  it("passes sketch.updateEntity profile edits through cad.batch dry-run and commit", () => {
    const server = new CadMcpServer();
    seedMcpExtrudeFeature(server, {
      sketchId: "sketch_profile_update",
      entityId: "circle_profile_update",
      featureId: "feat_profile_update",
      bodyId: "body_profile_update"
    });

    const dryRun = server.callTool({
      name: "cad.batch",
      requestId: "mcp_req_profile_update_dry_run",
      arguments: {
        batch: {
          version: "cadops.v1",
          mode: "dryRun",
          ops: [
            {
              op: "sketch.updateEntity",
              sketchId: "sketch_profile_update",
              entity: {
                id: "circle_profile_update",
                kind: "circle",
                center: [2, 3],
                radius: 5
              }
            }
          ]
        }
      }
    });
    const dryRunSketch = server.callTool({
      name: "cad.sketch_get",
      requestId: "mcp_req_profile_update_dry_run_sketch",
      arguments: { id: "sketch_profile_update" }
    });

    expect(dryRun).toMatchObject({
      toolName: "cad.batch",
      isError: false,
      structuredContent: {
        ok: true,
        requestId: "mcp_req_profile_update_dry_run",
        mode: "dryRun",
        modifiedSketchEntityIds: ["circle_profile_update"],
        modifiedFeatureIds: ["feat_profile_update"],
        modifiedBodyIds: ["body_profile_update"],
        audit: {
          source: "mcp",
          requestId: "mcp_req_profile_update_dry_run",
          toolName: "cad.batch",
          intent: "dryRun",
          operationCount: 1
        }
      }
    });
    expect(dryRunSketch).toMatchObject({
      structuredContent: {
        ok: true,
        sketch: {
          entities: [
            {
              id: "circle_profile_update",
              kind: "circle",
              center: [0, 0],
              radius: 2
            }
          ]
        }
      }
    });

    const commit = server.callTool({
      name: "cad.batch",
      requestId: "mcp_req_profile_update_commit",
      arguments: {
        allowCommit: true,
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [
            {
              op: "sketch.updateEntity",
              sketchId: "sketch_profile_update",
              entity: {
                id: "circle_profile_update",
                kind: "circle",
                center: [2, 3],
                radius: 5
              }
            }
          ]
        }
      }
    });
    const committedSketch = server.callTool({
      name: "cad.sketch_get",
      requestId: "mcp_req_profile_update_commit_sketch",
      arguments: { id: "sketch_profile_update" }
    });

    expect(commit).toMatchObject({
      toolName: "cad.batch",
      isError: false,
      structuredContent: {
        ok: true,
        requestId: "mcp_req_profile_update_commit",
        mode: "commit",
        modifiedSketchEntityIds: ["circle_profile_update"],
        modifiedFeatureIds: ["feat_profile_update"],
        modifiedBodyIds: ["body_profile_update"],
        transactionId: "txn_2",
        actor: {
          type: "agent",
          id: "mcp",
          name: "MCP Client"
        },
        audit: {
          source: "mcp",
          requestId: "mcp_req_profile_update_commit",
          toolName: "cad.batch",
          intent: "commit",
          operationCount: 1
        }
      }
    });
    expect(committedSketch).toMatchObject({
      structuredContent: {
        ok: true,
        sketch: {
          entities: [
            {
              id: "circle_profile_update",
              kind: "circle",
              center: [2, 3],
              radius: 5
            }
          ]
        }
      }
    });
  });

  it("passes feature.delete through cad.batch dry-run and commit", () => {
    const server = new CadMcpServer();
    seedMcpExtrudeFeature(server, {
      sketchId: "sketch_delete",
      entityId: "circle_delete",
      featureId: "feat_delete",
      bodyId: "body_delete"
    });

    const dryRun = server.callTool({
      name: "cad.batch",
      requestId: "mcp_req_delete_dry_run",
      arguments: {
        batch: {
          version: "cadops.v1",
          mode: "dryRun",
          ops: [{ op: "feature.delete", id: "feat_delete" }]
        }
      }
    });
    const dryRunStructure = server.callTool({
      name: "cad.project_structure",
      requestId: "mcp_req_delete_dry_run_structure"
    });

    expect(dryRun).toMatchObject({
      toolName: "cad.batch",
      isError: false,
      structuredContent: {
        ok: true,
        requestId: "mcp_req_delete_dry_run",
        mode: "dryRun",
        deletedFeatureIds: ["feat_delete"],
        deletedBodyIds: ["body_delete"],
        audit: {
          source: "mcp",
          requestId: "mcp_req_delete_dry_run",
          toolName: "cad.batch",
          intent: "dryRun",
          operationCount: 1
        }
      }
    });
    expect(dryRunStructure).toMatchObject({
      structuredContent: {
        ok: true,
        features: [{ id: "feat_delete" }],
        bodies: [{ id: "body_delete", featureId: "feat_delete" }]
      }
    });

    const commit = server.callTool({
      name: "cad.batch",
      requestId: "mcp_req_delete_commit",
      arguments: {
        allowCommit: true,
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [{ op: "feature.delete", id: "feat_delete" }]
        }
      }
    });
    const committedStructure = server.callTool({
      name: "cad.project_structure",
      requestId: "mcp_req_delete_commit_structure"
    });

    expect(commit).toMatchObject({
      toolName: "cad.batch",
      isError: false,
      structuredContent: {
        ok: true,
        requestId: "mcp_req_delete_commit",
        mode: "commit",
        deletedFeatureIds: ["feat_delete"],
        deletedBodyIds: ["body_delete"],
        transactionId: "txn_2",
        actor: {
          type: "agent",
          id: "mcp",
          name: "MCP Client"
        },
        audit: {
          source: "mcp",
          requestId: "mcp_req_delete_commit",
          toolName: "cad.batch",
          intent: "commit",
          operationCount: 1
        }
      }
    });
    expect(committedStructure).toMatchObject({
      structuredContent: {
        ok: true,
        features: [],
        bodies: []
      }
    });
  });

  it("returns sketches through cad.project_sketches and cad.sketch_get", () => {
    const server = new CadMcpServer();

    const commit = server.callTool({
      name: "cad.batch",
      requestId: "mcp_req_create_sketch",
      arguments: {
        allowCommit: true,
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [
            {
              op: "sketch.create",
              id: "mcp_sketch",
              name: "MCP sketch",
              plane: "XZ"
            },
            {
              op: "sketch.addLine",
              sketchId: "mcp_sketch",
              id: "mcp_line",
              start: [0, 0],
              end: [1, 2]
            }
          ]
        }
      }
    });
    const list = server.callTool({
      name: "cad.project_sketches",
      requestId: "mcp_req_project_sketches"
    });
    const get = server.callTool({
      name: "cad.sketch_get",
      requestId: "mcp_req_sketch_get",
      arguments: { id: "mcp_sketch" }
    });

    expect(commit.structuredContent).toMatchObject({
      ok: true,
      createdSketchIds: ["mcp_sketch"],
      createdSketchEntityIds: ["mcp_line"]
    });
    expect(list).toMatchObject({
      toolName: "cad.project_sketches",
      isError: false,
      structuredContent: {
        ok: true,
        query: "project.sketches",
        sketchCount: 1,
        sketches: [{ id: "mcp_sketch", name: "MCP sketch" }]
      }
    });
    expect(get).toMatchObject({
      toolName: "cad.sketch_get",
      isError: false,
      structuredContent: {
        ok: true,
        query: "sketch.get",
        sketch: {
          id: "mcp_sketch",
          plane: "XZ",
          entities: [{ id: "mcp_line", kind: "line" }]
        }
      }
    });
  });

  it("passes sketch.createOnFace through cad.batch", () => {
    const server = new CadMcpServer();

    const commit = server.callTool({
      name: "cad.batch",
      requestId: "mcp_req_create_on_face",
      arguments: {
        allowCommit: true,
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [
            {
              op: "sketch.create",
              id: "profile_sketch",
              name: "Profile",
              plane: "XY"
            },
            {
              op: "sketch.addRectangle",
              sketchId: "profile_sketch",
              id: "profile_rect",
              center: [0, 0],
              width: 2,
              height: 3
            },
            {
              op: "feature.extrude",
              id: "feat_profile",
              bodyId: "body_profile",
              sketchId: "profile_sketch",
              entityId: "profile_rect",
              depth: 4
            },
            {
              op: "sketch.createOnFace",
              id: "face_sketch",
              name: "Face sketch",
              bodyId: "body_profile",
              faceStableId: "generated:face:body_profile:endCap"
            }
          ]
        }
      }
    });
    const get = server.callTool({
      name: "cad.sketch_get",
      requestId: "mcp_req_face_sketch_get",
      arguments: { id: "face_sketch" }
    });

    expect(commit.structuredContent).toMatchObject({
      ok: true,
      createdSketchIds: ["profile_sketch", "face_sketch"],
      createdFeatureIds: ["feat_profile"],
      createdBodyIds: ["body_profile"]
    });
    expect(get.structuredContent).toMatchObject({
      ok: true,
      sketch: {
        id: "face_sketch",
        attachment: {
          bodyId: "body_profile",
          faceStableId: "generated:face:body_profile:endCap",
          faceRole: "endCap"
        }
      }
    });
  });

  it("passes sketch.createOnFace with a named face reference through cad.batch", () => {
    const server = new CadMcpServer();

    const commit = server.callTool({
      name: "cad.batch",
      requestId: "mcp_req_create_on_named_face",
      arguments: {
        allowCommit: true,
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [
            {
              op: "sketch.create",
              id: "named_profile_sketch",
              name: "Profile",
              plane: "XY"
            },
            {
              op: "sketch.addRectangle",
              sketchId: "named_profile_sketch",
              id: "named_profile_rect",
              center: [0, 0],
              width: 2,
              height: 3
            },
            {
              op: "feature.extrude",
              id: "feat_named_profile",
              bodyId: "body_named_profile",
              sketchId: "named_profile_sketch",
              entityId: "named_profile_rect",
              depth: 4
            },
            {
              op: "reference.nameGenerated",
              name: "Named end face",
              bodyId: "body_named_profile",
              stableId: "generated:face:body_named_profile:endCap"
            },
            {
              op: "sketch.createOnFace",
              id: "named_face_sketch",
              name: "Named face sketch",
              referenceName: "Named end face"
            }
          ]
        }
      }
    });

    expect(commit.structuredContent).toMatchObject({
      ok: true,
      createdSketchIds: ["named_profile_sketch", "named_face_sketch"],
      createdFeatureIds: ["feat_named_profile"],
      createdBodyIds: ["body_named_profile"]
    });
  });

  it("returns generated body references through cad.body_generated_references", () => {
    const server = new CadMcpServer();

    seedMcpExtrudeFeature(server, {
      sketchId: "mcp_refs_sketch",
      entityId: "mcp_refs_rect",
      featureId: "mcp_refs_feature",
      bodyId: "mcp_refs_body"
    });

    const result = server.callTool({
      name: "cad.body_generated_references",
      requestId: "mcp_req_body_refs",
      arguments: { bodyId: "mcp_refs_body" }
    });

    expect(result).toMatchObject({
      toolName: "cad.body_generated_references",
      isError: false,
      structuredContent: {
        ok: true,
        requestId: "mcp_req_body_refs",
        query: "body.generatedReferences",
        body: {
          stableId: "generated:body:mcp_refs_body",
          label: "Circle extrude body",
          eligibleOperations: [
            "feature.measureReference",
            "feature.selectReference"
          ],
          bodyId: "mcp_refs_body",
          sourceFeatureId: "mcp_refs_feature",
          sourceSketchId: "mcp_refs_sketch",
          sourceSketchEntityId: "mcp_refs_rect",
          profileKind: "circle"
        },
        faceCount: 3,
        edgeCount: 2,
        vertexCount: 0,
        faces: [
          { role: "startCap", label: "Start cap" },
          { role: "endCap" },
          {
            role: "side:circular",
            label: "Circular side face",
            eligibleOperations: [
              "feature.measureReference",
              "feature.selectReference"
            ],
            eligibilityNotes: [
              "Circular side faces are not planar and are not eligible for sketch-plane attachment.",
              "Generated references are semantic first-slice references, not exact B-rep topology."
            ]
          }
        ],
        edges: [
          {
            role: "start:circular",
            label: "Start circular edge",
            eligibleOperations: [
              "feature.chamfer",
              "feature.fillet",
              "feature.measureReference",
              "feature.selectReference"
            ],
            adjacentFaceRoles: ["startCap", "side:circular"]
          },
          {
            role: "end:circular",
            label: "End circular edge",
            adjacentFaceRoles: ["endCap", "side:circular"]
          }
        ],
        vertices: []
      }
    });
  });

  it("returns V7 selection reference candidates through cad.selection_reference_candidates", () => {
    const server = new CadMcpServer();

    seedMcpExtrudeFeature(server, {
      sketchId: "mcp_selection_sketch",
      entityId: "mcp_selection_circle",
      featureId: "mcp_selection_feature",
      bodyId: "mcp_selection_body"
    });

    const result = server.callTool({
      name: "cad.selection_reference_candidates",
      requestId: "mcp_req_selection_refs",
      arguments: {
        selection: {
          type: "generatedReference",
          bodyId: "mcp_selection_body",
          stableId: "generated:face:mcp_selection_body:endCap",
          expectedKind: "face"
        },
        requiredOperation: "feature.attachSketchPlane"
      }
    });

    expect(result).toMatchObject({
      toolName: "cad.selection_reference_candidates",
      isError: false,
      structuredContent: {
        ok: true,
        requestId: "mcp_req_selection_refs",
        query: "selection.referenceCandidates",
        selection: {
          type: "generatedReference",
          bodyId: "mcp_selection_body",
          stableId: "generated:face:mcp_selection_body:endCap",
          expectedKind: "face"
        },
        requiredOperation: "feature.attachSketchPlane",
        status: "resolved",
        candidateCount: 1,
        issueCount: 0,
        candidates: [
          {
            source: "generatedReferenceSelection",
            commandable: true,
            commandOperations: expect.arrayContaining([
              "reference.nameGenerated",
              "feature.attachSketchPlane"
            ]),
            target: {
              type: "generatedReference",
              bodyId: "mcp_selection_body",
              stableId: "generated:face:mcp_selection_body:endCap",
              kind: "face"
            },
            reference: {
              kind: "face",
              role: "endCap",
              sourceFeatureId: "mcp_selection_feature"
            },
            issues: []
          }
        ],
        issues: []
      }
    });
  });

  it("returns V10 feature editability through cad.feature_editability", () => {
    const server = new CadMcpServer();

    seedMcpExtrudeFeature(server, {
      sketchId: "mcp_editability_sketch",
      entityId: "mcp_editability_rect",
      featureId: "mcp_editability_feature",
      bodyId: "mcp_editability_body"
    });

    const result = server.callTool({
      name: "cad.feature_editability",
      requestId: "mcp_req_feature_editability",
      arguments: {
        featureId: "mcp_editability_feature",
        proposedEdit: {
          kind: "extrude",
          depth: 10,
          side: "negative"
        }
      }
    });

    expect(result).toMatchObject({
      toolName: "cad.feature_editability",
      isError: false,
      structuredContent: {
        ok: true,
        requestId: "mcp_req_feature_editability",
        query: "feature.editability",
        featureId: "mcp_editability_feature",
        status: "editable",
        fieldCount: 2,
        rebuildReadiness: {
          status: "ready",
          commitDeferred: false
        },
        dryRun: {
          status: "valid",
          commitOperation: "feature.updateExtrude",
          willMutateDocument: false
        },
        affected: {
          sketchIds: ["mcp_editability_sketch"],
          featureIds: ["mcp_editability_feature"],
          bodyIds: ["mcp_editability_body"]
        },
        requiresProjectSchemaMigration: false
      }
    });
    const structured = result.structuredContent as {
      readonly referenceChanges?: readonly { readonly stableId?: string }[];
    };

    expect(
      structured.referenceChanges?.every(
        (change) =>
          change.stableId === undefined ||
          !/mesh|occt|opfs|fileHandle|selectionBuffer|viewport/i.test(
            change.stableId
          )
      )
    ).toBe(true);
  });

  it("returns V10 F1 sketch edit readiness through cad.sketch_edit_readiness", () => {
    const server = new CadMcpServer();

    seedMcpExtrudeFeature(server, {
      sketchId: "mcp_sketch_readiness_sketch",
      entityId: "mcp_sketch_readiness_rect",
      featureId: "mcp_sketch_readiness_feature",
      bodyId: "mcp_sketch_readiness_body"
    });

    const result = server.callTool({
      name: "cad.sketch_edit_readiness",
      requestId: "mcp_req_sketch_edit_readiness",
      arguments: {
        edit: {
          editKind: "entity.dimension.update",
          sketchId: "mcp_sketch_readiness_sketch",
          entityId: "mcp_sketch_readiness_rect",
          target: { entityKind: "circle", role: "radius" },
          value: 3
        }
      }
    });

    expect(result).toMatchObject({
      toolName: "cad.sketch_edit_readiness",
      isError: false,
      structuredContent: {
        ok: true,
        requestId: "mcp_req_sketch_edit_readiness",
        query: "sketch.editReadiness",
        status: "ready",
        dryRun: {
          status: "valid",
          commitOperation: "sketch.updateEntity",
          willMutateDocument: false
        },
        affected: {
          sketchIds: expect.arrayContaining(["mcp_sketch_readiness_sketch"]),
          sketchEntityIds: expect.arrayContaining([
            "mcp_sketch_readiness_rect"
          ]),
          featureIds: expect.arrayContaining(["mcp_sketch_readiness_feature"]),
          bodyIds: expect.arrayContaining(["mcp_sketch_readiness_body"])
        },
        featureImpacts: [
          expect.objectContaining({
            featureId: "mcp_sketch_readiness_feature",
            impact: "source-profile"
          })
        ],
        requiresProjectSchemaMigration: false
      }
    });

    const structured = result.structuredContent;
    if (
      !structured.ok ||
      !("query" in structured) ||
      structured.query !== "sketch.editReadiness"
    ) {
      throw new Error("Expected sketch.editReadiness MCP response.");
    }

    expect(
      JSON.stringify({
        affected: structured.affected,
        featureImpacts: structured.featureImpacts,
        bodyLifecycles: structured.bodyLifecycles,
        referenceEffects: structured.referenceEffects,
        referenceHealth: structured.referenceHealth,
        diagnostics: structured.diagnostics
      })
    ).not.toMatch(/mesh|occt|opfs|fileHandle|selectionBuffer|viewport/i);
  });

  it("returns V11 sketch solver status through cad.sketch_solver_status", () => {
    const server = new CadMcpServer();

    seedMcpExtrudeFeature(server, {
      sketchId: "mcp_solver_status_sketch",
      entityId: "mcp_solver_status_rect",
      featureId: "mcp_solver_status_feature",
      bodyId: "mcp_solver_status_body"
    });

    const result = server.callTool({
      name: "cad.sketch_solver_status",
      requestId: "mcp_req_sketch_solver_status",
      arguments: {
        sketchId: "mcp_solver_status_sketch"
      }
    });

    expect(result).toMatchObject({
      toolName: "cad.sketch_solver_status",
      isError: false,
      structuredContent: {
        ok: true,
        requestId: "mcp_req_sketch_solver_status",
        query: "sketch.solverStatus",
        sketchId: "mcp_solver_status_sketch",
        status: "under-defined",
        readiness: "ready",
        solver: {
          engine: "current-direct-evaluator",
          numericalSolverStatus: "under-defined",
          numericalSolverEngine: "@web-cad/sketch-solver",
          numericalSolverModelVersion: "partbench.sketch-solver.v1",
          modelBuilt: true,
          solverRan: true,
          canSolveNumerically: true
        },
        entityCount: 1,
        deferredConstraintCount: 1,
        profileValidity: {
          status: "valid",
          validProfileCount: 1
        },
        sourceContract: {
          emittedProjectSchemaVersion: "web-cad.project.v16",
          requiresProjectSchemaMigration: false,
          nextProjectSchemaVersion: "web-cad.project.v17"
        },
        requiresProjectSchemaMigration: false
      }
    });

    const structured = result.structuredContent;
    if (
      !structured.ok ||
      !("query" in structured) ||
      structured.query !== "sketch.solverStatus"
    ) {
      throw new Error("Expected sketch.solverStatus MCP response.");
    }

    expect(
      JSON.stringify({
        entities: structured.entities,
        dimensions: structured.dimensions,
        constraints: structured.constraints,
        sourceContract: structured.sourceContract
      })
    ).not.toMatch(/mesh|occt|opfs|fileHandle|selectionBuffer|viewport|gpu/i);

    expect(
      server.callTool({
        name: "cad.batch",
        requestId: "mcp_req_sketch_solver_commit",
        arguments: {
          allowCommit: true,
          batch: {
            version: "cadops.v1",
            mode: "commit",
            ops: [
              {
                op: "sketch.constraint.create",
                id: "mcp_solver_status_fixed_center",
                name: "Fixed rectangle center",
                sketchId: "mcp_solver_status_sketch",
                kind: "fixed",
                target: {
                  entityId: "mcp_solver_status_rect",
                  role: "center"
                }
              },
              {
                op: "sketch.dimension.create",
                id: "mcp_solver_status_radius",
                name: "Circle radius",
                sketchId: "mcp_solver_status_sketch",
                entityId: "mcp_solver_status_rect",
                target: { entityKind: "circle", role: "radius" },
                value: 2
              }
            ]
          }
        }
      })
    ).toMatchObject({
      toolName: "cad.batch",
      isError: false,
      structuredContent: {
        ok: true,
        requestId: "mcp_req_sketch_solver_commit",
        createdSketchConstraintIds: ["mcp_solver_status_fixed_center"],
        createdSketchDimensionIds: ["mcp_solver_status_radius"],
        modifiedSketchEntityIds: ["mcp_solver_status_rect"]
      }
    });

    const committedResult = server.callTool({
      name: "cad.sketch_solver_status",
      requestId: "mcp_req_sketch_solver_status_committed",
      arguments: {
        sketchId: "mcp_solver_status_sketch"
      }
    });

    expect(committedResult).toMatchObject({
      toolName: "cad.sketch_solver_status",
      isError: false,
      structuredContent: {
        ok: true,
        requestId: "mcp_req_sketch_solver_status_committed",
        query: "sketch.solverStatus",
        solver: {
          numericalSolverStatus: "converged",
          numericalSolverEngine: "@web-cad/sketch-solver",
          modelBuilt: true,
          solverRan: true,
          canSolveNumerically: true,
          variableCount: 3,
          residualCount: 3
        },
        dimensions: expect.arrayContaining([
          expect.objectContaining({
            dimensionId: "mcp_solver_status_radius",
            effectiveValue: 2,
            status: "healthy"
          })
        ]),
        constraints: expect.arrayContaining([
          expect.objectContaining({
            constraintId: "mcp_solver_status_fixed_center",
            kind: "fixed",
            supportedByCurrentEvaluator: true
          })
        ])
      }
    });
  });

  it("returns V10 dependency graph and reference health through MCP tools", () => {
    const server = new CadMcpServer();

    seedMcpExtrudeFeature(server, {
      sketchId: "mcp_dependency_sketch",
      entityId: "mcp_dependency_circle",
      featureId: "mcp_dependency_feature",
      bodyId: "mcp_dependency_body"
    });
    expect(
      server.callTool({
        name: "cad.batch",
        requestId: "mcp_req_name_dependency_ref",
        arguments: {
          allowCommit: true,
          batch: {
            version: "cadops.v1",
            mode: "commit",
            ops: [
              {
                op: "reference.nameGenerated",
                name: "MCP graph face",
                bodyId: "mcp_dependency_body",
                stableId: "generated:face:mcp_dependency_body:endCap"
              }
            ]
          }
        }
      })
    ).toMatchObject({ isError: false });

    const graph = server.callTool({
      name: "cad.project_dependency_graph",
      requestId: "mcp_req_dependency_graph"
    });
    const rebuildPlan = server.callTool({
      name: "cad.project_rebuild_plan",
      requestId: "mcp_req_rebuild_plan"
    });
    const health = server.callTool({
      name: "cad.reference_health",
      requestId: "mcp_req_reference_health",
      arguments: {
        target: { type: "namedReference", name: "MCP graph face" }
      }
    });

    expect(graph).toMatchObject({
      toolName: "cad.project_dependency_graph",
      isError: false,
      structuredContent: {
        ok: true,
        requestId: "mcp_req_dependency_graph",
        query: "project.dependencyGraph",
        nodes: expect.arrayContaining([
          expect.objectContaining({
            id: "feature:mcp_dependency_feature",
            kind: "feature"
          }),
          expect.objectContaining({
            id: "named-reference:MCP graph face",
            kind: "namedReference",
            status: "active"
          })
        ]),
        requiresProjectSchemaMigration: false
      }
    });
    expect(health).toMatchObject({
      toolName: "cad.reference_health",
      isError: false,
      structuredContent: {
        ok: true,
        requestId: "mcp_req_reference_health",
        query: "reference.health",
        target: { type: "namedReference", name: "MCP graph face" },
        status: "active",
        referenceHealth: [
          expect.objectContaining({
            source: "namedReference",
            commandable: true,
            referenceName: "MCP graph face",
            stableId: "generated:face:mcp_dependency_body:endCap"
          })
        ]
      }
    });
    expect(rebuildPlan).toMatchObject({
      toolName: "cad.project_rebuild_plan",
      isError: false,
      structuredContent: {
        ok: true,
        requestId: "mcp_req_rebuild_plan",
        query: "project.rebuildPlan",
        status: "ready",
        bodyLifecycles: [
          expect.objectContaining({
            bodyId: "mcp_dependency_body",
            primaryState: "active",
            referenceHealthStatus: "active",
            commandReady: true
          })
        ],
        requiresProjectSchemaMigration: false
      }
    });
  });

  it("resolves generated references through cad.resolve_generated_reference", () => {
    const server = new CadMcpServer();

    seedMcpExtrudeFeature(server, {
      sketchId: "mcp_resolve_sketch",
      entityId: "mcp_resolve_circle",
      featureId: "mcp_resolve_feature",
      bodyId: "mcp_resolve_body"
    });

    const result = server.callTool({
      name: "cad.resolve_generated_reference",
      requestId: "mcp_req_resolve_ref",
      arguments: {
        bodyId: "mcp_resolve_body",
        stableId: "generated:edge:mcp_resolve_body:start:circular"
      }
    });

    expect(result).toMatchObject({
      toolName: "cad.resolve_generated_reference",
      isError: false,
      structuredContent: {
        ok: true,
        requestId: "mcp_req_resolve_ref",
        query: "body.resolveGeneratedReference",
        bodyId: "mcp_resolve_body",
        stableId: "generated:edge:mcp_resolve_body:start:circular",
        kind: "edge",
        reference: {
          kind: "edge",
          label: "Start circular edge",
          eligibleOperations: [
            "feature.chamfer",
            "feature.fillet",
            "feature.measureReference",
            "feature.selectReference"
          ],
          role: "start:circular",
          adjacentFaceRoles: ["startCap", "side:circular"]
        }
      }
    });
  });

  it("lists and resolves named generated references through MCP tools", () => {
    const server = new CadMcpServer();

    seedMcpExtrudeFeature(server, {
      sketchId: "mcp_named_sketch",
      entityId: "mcp_named_circle",
      featureId: "mcp_named_feature",
      bodyId: "mcp_named_body"
    });

    const nameResult = server.callTool({
      name: "cad.batch",
      requestId: "mcp_req_name_ref",
      arguments: {
        allowCommit: true,
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [
            {
              op: "reference.nameGenerated",
              name: "Outside wall",
              bodyId: "mcp_named_body",
              stableId: "generated:face:mcp_named_body:side:circular"
            }
          ]
        }
      }
    });
    const listResult = server.callTool({
      name: "cad.named_references",
      requestId: "mcp_req_named_refs"
    });
    const resolveResult = server.callTool({
      name: "cad.resolve_named_reference",
      requestId: "mcp_req_resolve_named",
      arguments: { name: "Outside wall" }
    });

    expect(nameResult).toMatchObject({
      toolName: "cad.batch",
      isError: false,
      structuredContent: { ok: true }
    });
    expect(listResult).toMatchObject({
      toolName: "cad.named_references",
      isError: false,
      structuredContent: {
        ok: true,
        requestId: "mcp_req_named_refs",
        query: "reference.listNamed",
        referenceCount: 1,
        references: [
          {
            name: "Outside wall",
            status: "resolved",
            reference: {
              kind: "face",
              role: "side:circular"
            }
          }
        ]
      }
    });
    expect(resolveResult).toMatchObject({
      toolName: "cad.resolve_named_reference",
      isError: false,
      structuredContent: {
        ok: true,
        requestId: "mcp_req_resolve_named",
        query: "reference.resolveNamed",
        name: "Outside wall",
        reference: {
          kind: "face",
          role: "side:circular"
        }
      }
    });
  });

  it("returns project dependency health through MCP tools", () => {
    const server = new CadMcpServer();

    seedMcpExtrudeFeature(server, {
      sketchId: "mcp_health_sketch",
      entityId: "mcp_health_circle",
      featureId: "mcp_health_feature",
      bodyId: "mcp_health_body"
    });
    server.callTool({
      name: "cad.batch",
      requestId: "mcp_req_seed_health_constraint",
      arguments: {
        allowCommit: true,
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [
            {
              op: "sketch.constraint.create",
              id: "fix_mcp_health_center",
              name: "Fixed MCP health center",
              sketchId: "mcp_health_sketch",
              kind: "fixed",
              target: { entityId: "mcp_health_circle", role: "center" },
              coordinate: [1, 2]
            }
          ]
        }
      }
    });

    const healthResult = server.callTool({
      name: "cad.project_health",
      requestId: "mcp_req_project_health"
    });

    expect(healthResult).toMatchObject({
      toolName: "cad.project_health",
      isError: false,
      structuredContent: {
        ok: true,
        requestId: "mcp_req_project_health",
        query: "project.health",
        status: "under-defined",
        issueCount: 1,
        authoredExtrudeCount: 1,
        sketchEvaluationCount: 1,
        sketchDimensionCount: 0,
        sketchConstraintCount: 1,
        authoredExtrudes: [
          {
            featureId: "mcp_health_feature",
            bodyId: "mcp_health_body",
            status: "healthy"
          }
        ],
        sketchEvaluations: [
          expect.objectContaining({
            sketchId: "mcp_health_sketch",
            status: "under-defined",
            affectedFeatureIds: ["mcp_health_feature"],
            affectedBodyIds: ["mcp_health_body"],
            issues: [expect.objectContaining({ code: "UNDER_DEFINED_SKETCH" })]
          })
        ],
        sketchDimensions: [],
        sketchConstraints: [
          {
            constraintId: "fix_mcp_health_center",
            affectedFeatureIds: ["mcp_health_feature"],
            affectedBodyIds: ["mcp_health_body"],
            status: "healthy"
          }
        ]
      }
    });
  });

  it("passes derived exact metadata snapshots through cad.project_health", () => {
    const server = new CadMcpServer();
    const commit = server.callTool({
      name: "cad.batch",
      requestId: "mcp_req_seed_health_revolve",
      arguments: {
        allowCommit: true,
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [
            {
              op: "sketch.create",
              id: "mcp_sketch_health_revolve",
              name: "Revolve",
              plane: "XY"
            },
            {
              op: "sketch.addRectangle",
              sketchId: "mcp_sketch_health_revolve",
              id: "mcp_rect_health_revolve",
              center: [2, 0],
              width: 1,
              height: 2
            },
            {
              op: "sketch.addLine",
              sketchId: "mcp_sketch_health_revolve",
              id: "mcp_axis_health_revolve",
              start: [0, -2],
              end: [0, 2]
            },
            {
              op: "feature.revolve",
              id: "mcp_feat_health_revolve",
              bodyId: "mcp_body_health_revolve",
              sketchId: "mcp_sketch_health_revolve",
              entityId: "mcp_rect_health_revolve",
              axis: {
                type: "sketchLine",
                sketchId: "mcp_sketch_health_revolve",
                entityId: "mcp_axis_health_revolve"
              },
              angleDegrees: 180,
              operationMode: "newBody"
            }
          ]
        }
      }
    });
    expect(commit).toMatchObject({
      toolName: "cad.batch",
      isError: false,
      structuredContent: { ok: true }
    });

    const topology = server.callTool({
      name: "cad.body_topology",
      requestId: "mcp_req_health_revolve_topology",
      arguments: { bodyId: "mcp_body_health_revolve" }
    });
    if (
      topology.isError ||
      topology.structuredContent.ok !== true ||
      !("query" in topology.structuredContent) ||
      topology.structuredContent.query !== "body.topology"
    ) {
      throw new Error("Expected body topology for project health snapshot.");
    }
    const topologyContent = topology.structuredContent as {
      readonly topology: {
        readonly sourceIdentity: { readonly signature: string };
      };
    };

    const healthResult = server.callTool({
      name: "cad.project_health",
      requestId: "mcp_req_project_health_exact",
      arguments: {
        derivedExactMetadata: [
          {
            bodyId: "mcp_body_health_revolve",
            sourceIdentitySignature:
              topologyContent.topology.sourceIdentity.signature,
            status: "ready",
            metadata: {
              source: "kernel-derived",
              confidence: "kernel-derived",
              bounds: {
                min: [0, 0, 0],
                max: [4, 2, 3],
                size: [4, 2, 3],
                center: [2, 1, 1.5]
              },
              volume: 24,
              surfaceArea: 52,
              centroid: [2, 1, 1.5],
              topologyCounts: {
                solidCount: 1,
                faceCount: 6,
                edgeCount: 12,
                vertexCount: 8
              },
              diagnostics: []
            }
          }
        ]
      }
    });

    expect(healthResult).toMatchObject({
      toolName: "cad.project_health",
      isError: false,
      structuredContent: {
        ok: true,
        requestId: "mcp_req_project_health_exact",
        query: "project.health",
        authoredRevolves: [
          {
            featureId: "mcp_feat_health_revolve",
            bodyId: "mcp_body_health_revolve",
            exactMeasurementsAvailable: true,
            measurementConfidence: "kernel-derived"
          }
        ]
      }
    });
  });

  it("returns generated reference measurements through cad.generated_reference_measurements", () => {
    const server = new CadMcpServer();

    seedMcpExtrudeFeature(server, {
      sketchId: "mcp_measure_sketch",
      entityId: "mcp_measure_circle",
      featureId: "mcp_measure_feat",
      bodyId: "mcp_measure_body"
    });

    const result = server.callTool({
      name: "cad.generated_reference_measurements",
      requestId: "mcp_req_measure_ref",
      arguments: {
        bodyId: "mcp_measure_body",
        stableId: "generated:edge:mcp_measure_body:start:circular"
      }
    });

    expect(result).toMatchObject({
      toolName: "cad.generated_reference_measurements",
      isError: false,
      structuredContent: {
        ok: true,
        requestId: "mcp_req_measure_ref",
        query: "body.generatedReferenceMeasurements",
        bodyId: "mcp_measure_body",
        stableId: "generated:edge:mcp_measure_body:start:circular",
        kind: "edge",
        measurements: {
          kind: "edge",
          role: "start:circular",
          curveType: "circle",
          center: [0, 0, 0],
          radius: 2
        }
      }
    });

    const structured = result.structuredContent;
    if (
      structured.ok &&
      "query" in structured &&
      structured.query === "body.generatedReferenceMeasurements" &&
      structured.measurements.kind === "edge"
    ) {
      expect(structured.measurements.length).toBeCloseTo(4 * Math.PI);
    } else {
      throw new Error("Expected generated reference measurement response.");
    }
  });

  it("returns generated reference measurement errors through cad.generated_reference_measurements", () => {
    const server = new CadMcpServer();

    seedMcpExtrudeFeature(server, {
      sketchId: "mcp_measure_error_sketch",
      entityId: "mcp_measure_error_rect",
      featureId: "mcp_measure_error_feat",
      bodyId: "mcp_measure_error_body"
    });

    const result = server.callTool({
      name: "cad.generated_reference_measurements",
      requestId: "mcp_req_measure_missing_ref",
      arguments: {
        bodyId: "mcp_measure_error_body",
        stableId: "generated:face:mcp_measure_error_body:missing"
      }
    });

    expect(result).toMatchObject({
      toolName: "cad.generated_reference_measurements",
      isError: true,
      structuredContent: {
        ok: false,
        requestId: "mcp_req_measure_missing_ref",
        query: "body.generatedReferenceMeasurements",
        error: {
          code: "GENERATED_REFERENCE_NOT_FOUND",
          bodyId: "mcp_measure_error_body",
          stableId: "generated:face:mcp_measure_error_body:missing"
        }
      }
    });
  });

  it("returns project extents through cad.project_extents", () => {
    const server = new CadMcpServer();

    server.callTool({
      name: "cad.batch",
      requestId: "mcp_req_create_extents",
      arguments: {
        allowCommit: true,
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [
            {
              op: "scene.createCylinder",
              id: "extent_cylinder",
              dimensions: { radius: 1, height: 4 }
            }
          ]
        }
      }
    });
    const result = server.callTool({
      name: "cad.project_extents",
      requestId: "mcp_req_extents"
    });

    expect(result).toMatchObject({
      toolName: "cad.project_extents",
      isError: false,
      structuredContent: {
        ok: true,
        requestId: "mcp_req_extents",
        query: "project.extents",
        objectCount: 1,
        objects: [{ id: "extent_cylinder" }]
      }
    });
  });

  it("accepts derived exact metadata snapshots in cad.project_extents", () => {
    const server = new CadMcpServer();

    server.callTool({
      name: "cad.batch",
      requestId: "mcp_req_create_revolve_extents",
      arguments: {
        allowCommit: true,
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [
            {
              op: "sketch.create",
              id: "sketch_revolve",
              name: "Revolve",
              plane: "XY"
            },
            {
              op: "sketch.addRectangle",
              sketchId: "sketch_revolve",
              id: "rect_revolve",
              center: [2, 0],
              width: 1,
              height: 3
            },
            {
              op: "sketch.addLine",
              sketchId: "sketch_revolve",
              id: "axis_revolve",
              start: [0, -2],
              end: [0, 2]
            },
            {
              op: "feature.revolve",
              id: "feat_revolve",
              bodyId: "body_revolve",
              sketchId: "sketch_revolve",
              entityId: "rect_revolve",
              axis: {
                type: "sketchLine",
                sketchId: "sketch_revolve",
                entityId: "axis_revolve"
              },
              angleDegrees: 360
            }
          ]
        }
      }
    });
    const topology = server.callTool({
      name: "cad.body_topology",
      requestId: "mcp_req_revolve_topology",
      arguments: { bodyId: "body_revolve" }
    });
    const topologyContent = topology.structuredContent as {
      readonly topology: {
        readonly sourceIdentity: { readonly signature: string };
      };
    };
    const result = server.callTool({
      name: "cad.project_extents",
      requestId: "mcp_req_revolve_extents",
      arguments: {
        derivedExactMetadata: [
          {
            bodyId: "body_revolve",
            sourceIdentitySignature:
              topologyContent.topology.sourceIdentity.signature,
            status: "ready",
            metadata: {
              source: "kernel-derived",
              confidence: "kernel-derived",
              bounds: {
                min: [0, 0, 0],
                max: [4, 2, 3],
                size: [4, 2, 3],
                center: [2, 1, 1.5]
              },
              volume: 24,
              diagnostics: []
            }
          }
        ]
      }
    });

    expect(result).toMatchObject({
      toolName: "cad.project_extents",
      isError: false,
      structuredContent: {
        ok: true,
        requestId: "mcp_req_revolve_extents",
        query: "project.extents",
        bodyCount: 1,
        bodies: [
          {
            bodyId: "body_revolve",
            extentSource: "kernel-derived",
            volume: 24
          }
        ],
        warnings: []
      }
    });
  });

  it("returns transaction history through cad.transaction_history", () => {
    const server = new CadMcpServer();

    server.callTool({
      name: "cad.batch",
      requestId: "mcp_req_history_create",
      arguments: {
        actor: {
          type: "agent",
          id: "mcp-history-agent",
          name: "MCP History Agent"
        },
        allowCommit: true,
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [
            {
              op: "scene.createBox",
              id: "history_box",
              dimensions: { width: 1, height: 2, depth: 3 }
            }
          ]
        }
      }
    });

    const result = server.callTool({
      name: "cad.transaction_history",
      requestId: "mcp_req_history"
    });

    expect(result).toMatchObject({
      toolName: "cad.transaction_history",
      isError: false,
      structuredContent: {
        ok: true,
        requestId: "mcp_req_history",
        query: "transaction.history",
        transactionCount: 1,
        transactions: [
          {
            id: "txn_1",
            status: "committed",
            actor: {
              id: "mcp-history-agent"
            },
            audit: {
              source: "mcp",
              requestId: "mcp_req_history_create",
              toolName: "cad.batch",
              intent: "commit",
              operationCount: 1
            },
            ops: [
              {
                op: "scene.createBox",
                objectId: "history_box"
              }
            ],
            diff: {
              createdCount: 1
            }
          }
        ]
      }
    });
  });

  it("returns structured CADOps errors from cad.batch", () => {
    const server = new CadMcpServer();

    const result = server.callTool({
      name: "cad.batch",
      requestId: "mcp_req_error",
      arguments: {
        allowCommit: true,
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [
            {
              op: "scene.deleteObject",
              id: "missing_object"
            }
          ]
        }
      }
    });

    expect(result).toMatchObject({
      toolName: "cad.batch",
      isError: true,
      structuredContent: {
        ok: false,
        requestId: "mcp_req_error",
        cadOpsVersion: "cadops.v1",
        mode: "commit",
        error: {
          code: "OBJECT_NOT_FOUND",
          objectId: "missing_object"
        }
      }
    });
  });

  it("handles minimal JSON-RPC tools/list and tools/call requests", () => {
    const server = new CadMcpServer();

    const tools = server.handleJsonRpc({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list"
    });
    const call = server.handleJsonRpc({
      jsonrpc: "2.0",
      id: "create-box",
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
                id: "jsonrpc_box",
                dimensions: { width: 4, height: 5, depth: 6 }
              }
            ]
          }
        }
      }
    });

    expect(tools).toMatchObject({
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
    expect(call).toMatchObject({
      jsonrpc: "2.0",
      id: "create-box",
      result: {
        toolName: "cad.batch",
        isError: false,
        structuredContent: {
          ok: true,
          requestId: "mcp_jsonrpc_create-box",
          createdIds: ["jsonrpc_box"]
        }
      }
    });
  });

  it("returns tool-level errors for unknown tools and invalid arguments", () => {
    const server = new CadMcpServer();

    expect(
      server.callTool({
        name: "cad.measure"
      })
    ).toMatchObject({
      toolName: "cad.measure",
      isError: true,
      structuredContent: {
        ok: false,
        error: { code: "UNKNOWN_TOOL" }
      }
    });
    expect(
      server.callTool({
        name: "cad.batch",
        arguments: { prompt: "make a box" }
      })
    ).toMatchObject({
      toolName: "cad.batch",
      isError: true,
      structuredContent: {
        ok: false,
        error: { code: "INVALID_ARGUMENTS" }
      }
    });
    expect(
      server.callTool({
        name: "cad.object_measurements",
        arguments: {}
      })
    ).toMatchObject({
      toolName: "cad.object_measurements",
      isError: true,
      structuredContent: {
        ok: false,
        error: { code: "INVALID_ARGUMENTS" }
      }
    });
    expect(
      server.callTool({
        name: "cad.body_measurements",
        arguments: {}
      })
    ).toMatchObject({
      toolName: "cad.body_measurements",
      isError: true,
      structuredContent: {
        ok: false,
        error: { code: "INVALID_ARGUMENTS" }
      }
    });
    expect(
      server.callTool({
        name: "cad.selection_reference_candidates",
        arguments: {
          selection: {
            type: "selectionBuffer",
            index: 12
          }
        }
      })
    ).toMatchObject({
      toolName: "cad.selection_reference_candidates",
      isError: true,
      structuredContent: {
        ok: false,
        error: { code: "INVALID_ARGUMENTS" }
      }
    });
  });
});

function seedMcpExtrudeFeature(
  server: CadMcpServer,
  ids: {
    readonly sketchId: string;
    readonly entityId: string;
    readonly featureId: string;
    readonly bodyId: string;
  }
): void {
  const result = server.callTool({
    name: "cad.batch",
    requestId: `mcp_req_seed_${ids.featureId}`,
    arguments: {
      allowCommit: true,
      batch: {
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            op: "sketch.create",
            id: ids.sketchId,
            name: "Profile",
            plane: "XY"
          },
          {
            op: "sketch.addCircle",
            sketchId: ids.sketchId,
            id: ids.entityId,
            center: [0, 0],
            radius: 2
          },
          {
            op: "feature.extrude",
            id: ids.featureId,
            bodyId: ids.bodyId,
            sketchId: ids.sketchId,
            entityId: ids.entityId,
            depth: 5
          }
        ]
      }
    }
  });

  expect(result).toMatchObject({
    toolName: "cad.batch",
    isError: false,
    structuredContent: {
      ok: true,
      createdFeatureIds: [ids.featureId],
      createdBodyIds: [ids.bodyId]
    }
  });
}

describe("mcp-adapter V3 parameter and dimension pass-through", () => {
  it("passes parameter and sketch dimension commands and queries through", () => {
    const server = new CadMcpServer();

    const commit = server.callTool({
      name: "cad.batch",
      requestId: "mcp_req_v3_commit",
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
              op: "sketch.addCircle",
              sketchId: "sketch_1",
              id: "circle_1",
              center: [0, 0],
              radius: 1
            },
            {
              op: "sketch.addLine",
              sketchId: "sketch_1",
              id: "line_1",
              start: [0, 0],
              end: [3, 4]
            },
            {
              op: "sketch.addLine",
              sketchId: "sketch_1",
              id: "line_2",
              start: [10, 0],
              end: [10, 2]
            },
            {
              op: "sketch.addLine",
              sketchId: "sketch_1",
              id: "line_3",
              start: [20, 0],
              end: [20, 2]
            },
            {
              op: "sketch.addPoint",
              sketchId: "sketch_1",
              id: "point_1",
              point: [10, 10]
            },
            {
              op: "sketch.addPoint",
              sketchId: "sketch_1",
              id: "point_mid",
              point: [0, 0]
            },
            { op: "parameter.create", id: "param_r", name: "Radius", value: 4 },
            {
              op: "parameter.create",
              id: "param_length",
              name: "Length",
              value: 10
            },
            {
              op: "sketch.dimension.create",
              id: "dim_r",
              name: "Radius dimension",
              sketchId: "sketch_1",
              entityId: "circle_1",
              target: { entityKind: "circle", role: "radius" },
              parameterId: "param_r"
            },
            {
              op: "sketch.dimension.create",
              id: "dim_line_length",
              name: "Line length",
              sketchId: "sketch_1",
              entityId: "line_1",
              target: { entityKind: "line", role: "length" },
              parameterId: "param_length"
            },
            {
              op: "sketch.constraint.create",
              id: "con_horizontal",
              name: "Horizontal line",
              sketchId: "sketch_1",
              entityId: "line_1",
              kind: "horizontal"
            },
            {
              op: "sketch.constraint.create",
              id: "con_fixed_start",
              name: "Fixed line start",
              sketchId: "sketch_1",
              kind: "fixed",
              target: { entityId: "line_1", role: "start" }
            },
            {
              op: "sketch.constraint.create",
              id: "con_coincident_end",
              name: "Line end point",
              sketchId: "sketch_1",
              kind: "coincident",
              primaryTarget: { entityId: "line_1", role: "end" },
              secondaryTarget: { entityId: "point_1", role: "position" }
            },
            {
              op: "sketch.constraint.create",
              id: "con_midpoint",
              name: "Line midpoint",
              sketchId: "sketch_1",
              kind: "midpoint",
              lineEntityId: "line_1",
              target: { entityId: "point_mid", role: "position" }
            },
            {
              op: "sketch.constraint.create",
              id: "con_parallel",
              name: "Parallel lines",
              sketchId: "sketch_1",
              kind: "parallel",
              primaryLineEntityId: "line_1",
              secondaryLineEntityId: "line_2"
            },
            {
              op: "sketch.constraint.create",
              id: "con_perpendicular",
              name: "Perpendicular lines",
              sketchId: "sketch_1",
              kind: "perpendicular",
              primaryLineEntityId: "line_1",
              secondaryLineEntityId: "line_3"
            }
          ]
        }
      }
    });

    expect(commit).toMatchObject({
      toolName: "cad.batch",
      isError: false,
      structuredContent: {
        ok: true,
        createdParameterIds: ["param_r", "param_length"],
        createdSketchDimensionIds: ["dim_r", "dim_line_length"],
        createdSketchConstraintIds: [
          "con_horizontal",
          "con_fixed_start",
          "con_coincident_end",
          "con_midpoint",
          "con_parallel",
          "con_perpendicular"
        ]
      }
    });

    expect(
      server.callTool({
        name: "cad.parameter_get",
        requestId: "mcp_req_parameter_get",
        arguments: { id: "param_r" }
      })
    ).toMatchObject({
      toolName: "cad.parameter_get",
      isError: false,
      structuredContent: {
        ok: true,
        query: "parameter.get",
        parameter: { id: "param_r", name: "Radius", value: 4 }
      }
    });

    expect(
      server.callTool({
        name: "cad.sketch_dimensions",
        requestId: "mcp_req_dimensions",
        arguments: { sketchId: "sketch_1" }
      })
    ).toMatchObject({
      toolName: "cad.sketch_dimensions",
      isError: false,
      structuredContent: {
        ok: true,
        query: "sketch.dimensions",
        dimensionCount: 2,
        dimensions: [
          expect.objectContaining({
            id: "dim_r",
            status: "healthy",
            effectiveValue: 4
          }),
          expect.objectContaining({
            id: "dim_line_length",
            target: { entityKind: "line", role: "length" },
            status: "healthy",
            effectiveValue: 10
          })
        ]
      }
    });

    expect(
      server.callTool({
        name: "cad.sketch_evaluation",
        requestId: "mcp_req_sketch_evaluation",
        arguments: { sketchId: "sketch_1" }
      })
    ).toMatchObject({
      toolName: "cad.sketch_evaluation",
      isError: false,
      structuredContent: {
        ok: true,
        query: "sketch.evaluation",
        sketchId: "sketch_1",
        sketchName: "Profile",
        plane: "XY",
        status: "under-defined",
        drivenEntityIds: [
          "circle_1",
          "line_1",
          "point_1",
          "point_mid",
          "line_2",
          "line_3"
        ],
        dimensionCount: 2,
        constraintCount: 6,
        issueCount: 1,
        issues: [expect.objectContaining({ code: "UNDER_DEFINED_SKETCH" })],
        constraints: [
          expect.objectContaining({
            id: "con_horizontal",
            kind: "horizontal",
            status: "healthy"
          }),
          expect.objectContaining({
            id: "con_fixed_start",
            kind: "fixed",
            target: { entityId: "line_1", role: "start" },
            status: "healthy"
          }),
          expect.objectContaining({
            id: "con_coincident_end",
            kind: "coincident",
            primaryTarget: { entityId: "line_1", role: "end" },
            secondaryTarget: { entityId: "point_1", role: "position" },
            status: "healthy"
          }),
          expect.objectContaining({
            id: "con_midpoint",
            kind: "midpoint",
            lineEntityId: "line_1",
            target: { entityId: "point_mid", role: "position" },
            status: "healthy"
          }),
          expect.objectContaining({
            id: "con_parallel",
            kind: "parallel",
            primaryLineEntityId: "line_1",
            secondaryLineEntityId: "line_2",
            status: "healthy"
          }),
          expect.objectContaining({
            id: "con_perpendicular",
            kind: "perpendicular",
            primaryLineEntityId: "line_1",
            secondaryLineEntityId: "line_3",
            status: "healthy"
          })
        ],
        dimensions: [
          expect.objectContaining({ id: "dim_r", effectiveValue: 4 }),
          expect.objectContaining({
            id: "dim_line_length",
            effectiveValue: 10
          })
        ]
      }
    });
  });
});
