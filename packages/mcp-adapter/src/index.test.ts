import { describe, expect, it } from "vitest";
import { CadMcpServer, createCadMcpServer } from "./index";

describe("mcp-adapter", () => {
  it("lists only the supported CAD tools", () => {
    const server = createCadMcpServer();

    expect(server.listTools().tools.map((tool) => tool.name)).toEqual([
      "cad.project_summary",
      "cad.project_features",
      "cad.project_structure",
      "cad.project_sketches",
      "cad.object_measurements",
      "cad.body_measurements",
      "cad.project_extents",
      "cad.sketch_get",
      "cad.body_generated_references",
      "cad.resolve_generated_reference",
      "cad.generated_reference_measurements",
      "cad.transaction_history",
      "cad.batch"
    ]);
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
        deletedIds: []
      }
    });
    expect(summary.structuredContent).toMatchObject({
      ok: true,
      requestId: "mcp_req_summary",
      query: "project.summary",
      objectCount: 0,
      objects: []
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
      ]
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
              depth: 5
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
        features: [{ id: "feat_1", kind: "extrude" }],
        bodies: [{ id: "body_1", featureId: "feat_1" }]
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
            "feature.measureReference",
            "feature.selectReference"
          ],
          role: "start:circular",
          adjacentFaceRoles: ["startCap", "side:circular"]
        }
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
          { name: "cad.project_summary" },
          { name: "cad.project_features" },
          { name: "cad.project_structure" },
          { name: "cad.project_sketches" },
          { name: "cad.object_measurements" },
          { name: "cad.body_measurements" },
          { name: "cad.project_extents" },
          { name: "cad.sketch_get" },
          { name: "cad.body_generated_references" },
          { name: "cad.resolve_generated_reference" },
          { name: "cad.generated_reference_measurements" },
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
