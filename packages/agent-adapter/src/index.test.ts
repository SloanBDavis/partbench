import { CadEngine } from "@web-cad/cad-core";
import { describe, expect, it } from "vitest";
import {
  CadOpsAgentAdapter,
  executeCadOpsAgentQueryRequest,
  executeCadOpsAgentRequest,
  parseCadOpsAgentQueryRequestJson,
  parseCadOpsAgentRequestJson
} from "./index";

describe("agent-adapter", () => {
  it("runs a CADOps dry-run batch without mutating the engine", () => {
    const engine = new CadEngine();
    const response = executeCadOpsAgentRequest(engine, {
      requestId: "agent_req_1",
      adapterVersion: "web-cad.agent-adapter.v1",
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
    });

    expect(response).toEqual({
      ok: true,
      requestId: "agent_req_1",
      adapterVersion: "web-cad.agent-adapter.v1",
      cadOpsVersion: "cadops.v1",
      mode: "dryRun",
      createdIds: ["preview_box"],
      modifiedIds: [],
      deletedIds: [],
      warnings: [],
      transactionId: undefined,
      audit: {
        source: "agent-adapter",
        requestId: "agent_req_1",
        intent: "dryRun",
        operationCount: 1
      }
    });
    expect(engine.getDocument().objects.size).toBe(0);
  });

  it("runs a CADOps commit batch and returns the transaction ID", () => {
    const adapter = new CadOpsAgentAdapter();

    const response = adapter.execute({
      requestId: "agent_req_2",
      adapterVersion: "web-cad.agent-adapter.v1",
      permissions: { allowCommit: true },
      actor: {
        type: "agent",
        id: "fixture-agent",
        name: "Fixture Agent"
      },
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
    });

    expect(response).toEqual({
      ok: true,
      requestId: "agent_req_2",
      adapterVersion: "web-cad.agent-adapter.v1",
      cadOpsVersion: "cadops.v1",
      mode: "commit",
      createdIds: ["committed_cylinder"],
      modifiedIds: [],
      deletedIds: [],
      warnings: [],
      transactionId: "txn_1",
      actor: {
        type: "agent",
        id: "fixture-agent",
        name: "Fixture Agent"
      },
      audit: {
        source: "agent-adapter",
        requestId: "agent_req_2",
        intent: "commit",
        operationCount: 1
      }
    });
    expect(adapter.getEngine().getTransactions()[0]?.actor).toEqual({
      type: "agent",
      id: "fixture-agent",
      name: "Fixture Agent"
    });
    expect(
      adapter.getEngine().getDocument().objects.get("committed_cylinder")?.kind
    ).toBe("cylinder");
  });

  it("blocks commit batches unless the caller explicitly allows commit", () => {
    const adapter = new CadOpsAgentAdapter();

    const response = adapter.execute({
      requestId: "agent_req_blocked_commit",
      adapterVersion: "web-cad.agent-adapter.v1",
      batch: {
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            op: "scene.createBox",
            id: "blocked_box",
            dimensions: { width: 1, height: 1, depth: 1 }
          }
        ]
      }
    });

    expect(response).toMatchObject({
      ok: false,
      requestId: "agent_req_blocked_commit",
      mode: "commit",
      error: {
        code: "COMMIT_NOT_ALLOWED",
        path: "$.permissions.allowCommit",
        expected: "true",
        received: "false"
      },
      audit: {
        source: "agent-adapter",
        requestId: "agent_req_blocked_commit",
        intent: "commit",
        operationCount: 1
      }
    });
    expect(adapter.getEngine().getDocument().objects.size).toBe(0);
  });

  it("returns structured CADOps validation errors", () => {
    const adapter = new CadOpsAgentAdapter();

    const response = adapter.execute({
      requestId: "agent_req_3",
      adapterVersion: "web-cad.agent-adapter.v1",
      permissions: { allowCommit: true },
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
    });

    expect(response).toMatchObject({
      ok: false,
      requestId: "agent_req_3",
      adapterVersion: "web-cad.agent-adapter.v1",
      cadOpsVersion: "cadops.v1",
      mode: "commit",
      error: {
        code: "OBJECT_NOT_FOUND",
        message: "Object does not exist: missing_object",
        opIndex: 0,
        op: "scene.deleteObject",
        objectId: "missing_object",
        path: "$.ops[0].id"
      },
      errors: [
        expect.objectContaining({
          code: "OBJECT_NOT_FOUND",
          message: "Object does not exist: missing_object",
          opIndex: 0,
          op: "scene.deleteObject",
          objectId: "missing_object",
          path: "$.ops[0].id"
        })
      ],
      createdIds: [],
      modifiedIds: [],
      deletedIds: [],
      warnings: []
    });
  });

  it("returns structured unit update mode validation errors", () => {
    const adapter = new CadOpsAgentAdapter();

    const response = adapter.execute({
      requestId: "agent_req_bad_unit_mode",
      adapterVersion: "web-cad.agent-adapter.v1",
      permissions: { allowCommit: true },
      batch: {
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            op: "document.updateUnits",
            units: "in",
            mode: "reinterpret" as never
          }
        ]
      }
    });

    expect(response).toMatchObject({
      ok: false,
      requestId: "agent_req_bad_unit_mode",
      error: {
        code: "INVALID_UNIT_UPDATE_MODE",
        path: "$.ops[0].mode",
        expected: "metadataOnly or preservePhysicalSize",
        received: "reinterpret"
      },
      createdIds: [],
      modifiedIds: [],
      deletedIds: [],
      warnings: []
    });
    expect(adapter.getEngine().getTransactions()).toEqual([]);
  });

  it("returns structured actor validation errors from CADOps", () => {
    const adapter = new CadOpsAgentAdapter();

    const response = adapter.execute({
      requestId: "agent_req_bad_actor",
      adapterVersion: "web-cad.agent-adapter.v1",
      permissions: { allowCommit: true },
      actor: {
        type: "robot" as never
      },
      batch: {
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            op: "scene.createBox",
            id: "box_1",
            dimensions: { width: 1, height: 1, depth: 1 }
          }
        ]
      }
    });

    expect(response).toMatchObject({
      ok: false,
      requestId: "agent_req_bad_actor",
      error: {
        code: "INVALID_ACTOR",
        path: "$.actor.type",
        expected: "human, agent, script, or system",
        received: "robot"
      }
    });
    expect(adapter.getEngine().getTransactions()).toEqual([]);
  });

  it("supports JSON request parsing for external callers", () => {
    const adapter = new CadOpsAgentAdapter();
    const request = parseCadOpsAgentRequestJson(
      JSON.stringify({
        requestId: "agent_req_json",
        adapterVersion: "web-cad.agent-adapter.v1",
        permissions: { allowCommit: true },
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [
            {
              op: "scene.createBox",
              id: "json_box",
              dimensions: { width: 4, height: 5, depth: 6 }
            },
            {
              op: "scene.updateTransform",
              id: "json_box",
              transform: { translation: [1, 2, 3] }
            },
            {
              op: "scene.updateBoxDimensions",
              id: "json_box",
              dimensions: { width: 7, height: 8, depth: 9 }
            },
            {
              op: "scene.renameObject",
              id: "json_box",
              name: "JSON box"
            },
            {
              op: "document.updateUnits",
              units: "in"
            }
          ]
        }
      })
    );

    const responseJson = adapter.executeJson(JSON.stringify(request));
    const response = JSON.parse(responseJson) as {
      readonly ok: boolean;
      readonly requestId: string;
      readonly createdIds: readonly string[];
      readonly modifiedIds: readonly string[];
      readonly transactionId?: string;
    };

    expect(response).toMatchObject({
      ok: true,
      requestId: "agent_req_json",
      createdIds: ["json_box"],
      modifiedIds: ["json_box"],
      transactionId: "txn_1"
    });
    expect(
      adapter.getEngine().getDocument().objects.get("json_box")?.transform
        .translation
    ).toEqual([1, 2, 3]);
    expect(
      adapter.getEngine().getDocument().objects.get("json_box")?.dimensions
    ).toEqual({ width: 7, height: 8, depth: 9 });
    expect(
      adapter.getEngine().getDocument().objects.get("json_box")?.name
    ).toBe("JSON box");
    expect(adapter.getEngine().getDocument().units).toBe("in");
  });

  it("supports JSON feature extrude batches for external callers", () => {
    const adapter = new CadOpsAgentAdapter();
    const request = {
      requestId: "agent_req_json_extrude",
      adapterVersion: "web-cad.agent-adapter.v1",
      permissions: { allowCommit: true },
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
    };

    const response = JSON.parse(
      adapter.executeJson(JSON.stringify(request))
    ) as {
      readonly ok: boolean;
      readonly createdFeatureIds?: readonly string[];
      readonly createdBodyIds?: readonly string[];
    };
    const structure = adapter.getEngine().executeQuery({
      version: "cadops.v1",
      query: { query: "project.structure" }
    });

    expect(response).toMatchObject({
      ok: true,
      createdFeatureIds: ["feat_1"],
      createdBodyIds: ["body_1"]
    });
    expect(structure).toMatchObject({
      ok: true,
      features: [{ id: "feat_1", kind: "extrude" }],
      bodies: [{ id: "body_1", featureId: "feat_1" }]
    });
  });

  it("passes feature.updateExtrude through JSON batch dry-run and commit", () => {
    const adapter = new CadOpsAgentAdapter();
    seedExtrudeFeature(adapter, {
      sketchId: "sketch_update",
      entityId: "rect_update",
      featureId: "feat_update",
      bodyId: "body_update"
    });

    const dryRun = JSON.parse(
      adapter.executeJson(
        JSON.stringify({
          requestId: "agent_req_update_extrude_dry_run",
          adapterVersion: "web-cad.agent-adapter.v1",
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
        })
      )
    ) as {
      readonly ok: boolean;
      readonly modifiedFeatureIds?: readonly string[];
      readonly modifiedBodyIds?: readonly string[];
      readonly transactionId?: string;
    };
    const dryRunStructure = adapter.getEngine().executeQuery({
      version: "cadops.v1",
      query: { query: "project.structure" }
    });

    expect(dryRun).toMatchObject({
      ok: true,
      mode: "dryRun",
      modifiedFeatureIds: ["feat_update"],
      modifiedBodyIds: ["body_update"],
      audit: {
        source: "agent-adapter",
        requestId: "agent_req_update_extrude_dry_run",
        intent: "dryRun",
        operationCount: 1
      }
    });
    expect(dryRun.transactionId).toBeUndefined();
    expect(dryRunStructure).toMatchObject({
      ok: true,
      features: [{ id: "feat_update", depth: 4, side: "positive" }],
      bodies: [{ id: "body_update", featureId: "feat_update" }]
    });

    const commit = JSON.parse(
      adapter.executeJson(
        JSON.stringify({
          requestId: "agent_req_update_extrude_commit",
          adapterVersion: "web-cad.agent-adapter.v1",
          permissions: { allowCommit: true },
          actor: {
            type: "agent",
            id: "feature-update-agent",
            name: "Feature Update Agent"
          },
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
        })
      )
    ) as {
      readonly ok: boolean;
      readonly modifiedFeatureIds?: readonly string[];
      readonly modifiedBodyIds?: readonly string[];
      readonly transactionId?: string;
    };
    const committedStructure = adapter.getEngine().executeQuery({
      version: "cadops.v1",
      query: { query: "project.structure" }
    });

    expect(commit).toMatchObject({
      ok: true,
      mode: "commit",
      modifiedFeatureIds: ["feat_update"],
      modifiedBodyIds: ["body_update"],
      transactionId: "txn_2",
      actor: {
        type: "agent",
        id: "feature-update-agent",
        name: "Feature Update Agent"
      },
      audit: {
        source: "agent-adapter",
        requestId: "agent_req_update_extrude_commit",
        intent: "commit",
        operationCount: 1
      }
    });
    expect(committedStructure).toMatchObject({
      ok: true,
      features: [{ id: "feat_update", depth: 9, side: "symmetric" }],
      bodies: [{ id: "body_update", featureId: "feat_update" }]
    });
  });

  it("passes sketch.updateEntity profile edits through JSON batch dry-run and commit", () => {
    const adapter = new CadOpsAgentAdapter();
    seedExtrudeFeature(adapter, {
      sketchId: "sketch_profile_update",
      entityId: "rect_profile_update",
      featureId: "feat_profile_update",
      bodyId: "body_profile_update"
    });

    const dryRun = JSON.parse(
      adapter.executeJson(
        JSON.stringify({
          requestId: "agent_req_profile_update_dry_run",
          adapterVersion: "web-cad.agent-adapter.v1",
          batch: {
            version: "cadops.v1",
            mode: "dryRun",
            ops: [
              {
                op: "sketch.updateEntity",
                sketchId: "sketch_profile_update",
                entity: {
                  id: "rect_profile_update",
                  kind: "rectangle",
                  center: [1, 2],
                  width: 7,
                  height: 8
                }
              }
            ]
          }
        })
      )
    ) as {
      readonly ok: boolean;
      readonly modifiedSketchEntityIds?: readonly string[];
      readonly modifiedFeatureIds?: readonly string[];
      readonly modifiedBodyIds?: readonly string[];
    };
    const dryRunSketch = adapter.getEngine().executeQuery({
      version: "cadops.v1",
      query: { query: "sketch.get", id: "sketch_profile_update" }
    });

    expect(dryRun).toMatchObject({
      ok: true,
      mode: "dryRun",
      modifiedSketchEntityIds: ["rect_profile_update"],
      modifiedFeatureIds: ["feat_profile_update"],
      modifiedBodyIds: ["body_profile_update"],
      audit: {
        source: "agent-adapter",
        requestId: "agent_req_profile_update_dry_run",
        intent: "dryRun",
        operationCount: 1
      }
    });
    expect(dryRunSketch).toMatchObject({
      ok: true,
      sketch: {
        entities: [
          {
            id: "rect_profile_update",
            kind: "rectangle",
            center: [0, 0],
            width: 2,
            height: 3
          }
        ]
      }
    });

    const commit = JSON.parse(
      adapter.executeJson(
        JSON.stringify({
          requestId: "agent_req_profile_update_commit",
          adapterVersion: "web-cad.agent-adapter.v1",
          permissions: { allowCommit: true },
          batch: {
            version: "cadops.v1",
            mode: "commit",
            ops: [
              {
                op: "sketch.updateEntity",
                sketchId: "sketch_profile_update",
                entity: {
                  id: "rect_profile_update",
                  kind: "rectangle",
                  center: [1, 2],
                  width: 7,
                  height: 8
                }
              }
            ]
          }
        })
      )
    ) as {
      readonly ok: boolean;
      readonly modifiedSketchEntityIds?: readonly string[];
      readonly modifiedFeatureIds?: readonly string[];
      readonly modifiedBodyIds?: readonly string[];
    };
    const committedSketch = adapter.getEngine().executeQuery({
      version: "cadops.v1",
      query: { query: "sketch.get", id: "sketch_profile_update" }
    });

    expect(commit).toMatchObject({
      ok: true,
      mode: "commit",
      modifiedSketchEntityIds: ["rect_profile_update"],
      modifiedFeatureIds: ["feat_profile_update"],
      modifiedBodyIds: ["body_profile_update"],
      transactionId: "txn_2",
      audit: {
        source: "agent-adapter",
        requestId: "agent_req_profile_update_commit",
        intent: "commit",
        operationCount: 1
      }
    });
    expect(committedSketch).toMatchObject({
      ok: true,
      sketch: {
        entities: [
          {
            id: "rect_profile_update",
            kind: "rectangle",
            center: [1, 2],
            width: 7,
            height: 8
          }
        ]
      }
    });
  });

  it("passes feature.delete through JSON batch dry-run and commit", () => {
    const adapter = new CadOpsAgentAdapter();
    seedExtrudeFeature(adapter, {
      sketchId: "sketch_delete",
      entityId: "rect_delete",
      featureId: "feat_delete",
      bodyId: "body_delete"
    });

    const dryRun = JSON.parse(
      adapter.executeJson(
        JSON.stringify({
          requestId: "agent_req_delete_dry_run",
          adapterVersion: "web-cad.agent-adapter.v1",
          batch: {
            version: "cadops.v1",
            mode: "dryRun",
            ops: [{ op: "feature.delete", id: "feat_delete" }]
          }
        })
      )
    ) as {
      readonly ok: boolean;
      readonly deletedFeatureIds?: readonly string[];
      readonly deletedBodyIds?: readonly string[];
      readonly transactionId?: string;
    };
    const dryRunStructure = adapter.getEngine().executeQuery({
      version: "cadops.v1",
      query: { query: "project.structure" }
    });

    expect(dryRun).toMatchObject({
      ok: true,
      mode: "dryRun",
      deletedFeatureIds: ["feat_delete"],
      deletedBodyIds: ["body_delete"],
      audit: {
        source: "agent-adapter",
        requestId: "agent_req_delete_dry_run",
        intent: "dryRun",
        operationCount: 1
      }
    });
    expect(dryRunStructure).toMatchObject({
      ok: true,
      features: [{ id: "feat_delete" }],
      bodies: [{ id: "body_delete", featureId: "feat_delete" }]
    });

    const commit = JSON.parse(
      adapter.executeJson(
        JSON.stringify({
          requestId: "agent_req_delete_commit",
          adapterVersion: "web-cad.agent-adapter.v1",
          permissions: { allowCommit: true },
          actor: {
            type: "agent",
            id: "feature-delete-agent",
            name: "Feature Delete Agent"
          },
          batch: {
            version: "cadops.v1",
            mode: "commit",
            ops: [{ op: "feature.delete", id: "feat_delete" }]
          }
        })
      )
    ) as {
      readonly ok: boolean;
      readonly deletedFeatureIds?: readonly string[];
      readonly deletedBodyIds?: readonly string[];
      readonly transactionId?: string;
    };
    const committedStructure = adapter.getEngine().executeQuery({
      version: "cadops.v1",
      query: { query: "project.structure" }
    });

    expect(commit).toMatchObject({
      ok: true,
      mode: "commit",
      deletedFeatureIds: ["feat_delete"],
      deletedBodyIds: ["body_delete"],
      transactionId: "txn_2",
      actor: {
        type: "agent",
        id: "feature-delete-agent",
        name: "Feature Delete Agent"
      },
      audit: {
        source: "agent-adapter",
        requestId: "agent_req_delete_commit",
        intent: "commit",
        operationCount: 1
      }
    });
    expect(committedStructure).toMatchObject({
      ok: true,
      features: [],
      bodies: []
    });
  });

  it("returns project summary queries through the adapter", () => {
    const engine = new CadEngine();

    engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "scene.createBox",
          id: "summary_box",
          dimensions: { width: 1, height: 2, depth: 3 },
          transform: { translation: [3, 2, 1] }
        },
        {
          op: "scene.createCylinder",
          id: "summary_cylinder",
          dimensions: { radius: 2, height: 8 }
        }
      ]
    });

    const response = executeCadOpsAgentQueryRequest(engine, {
      requestId: "agent_query_1",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: { query: "project.summary" }
      }
    });

    expect(response).toEqual({
      ok: true,
      requestId: "agent_query_1",
      adapterVersion: "web-cad.agent-adapter.v1",
      cadOpsVersion: "cadops.v1",
      query: "project.summary",
      units: "mm",
      objectCount: 2,
      objects: [
        {
          id: "summary_box",
          kind: "box",
          dimensions: { width: 1, height: 2, depth: 3 },
          transform: {
            translation: [3, 2, 1],
            rotation: [0, 0, 0],
            scale: [1, 1, 1]
          }
        },
        {
          id: "summary_cylinder",
          kind: "cylinder",
          dimensions: { radius: 2, height: 8 },
          transform: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1]
          }
        }
      ]
    });
  });

  it("returns one object through adapter query JSON", () => {
    const adapter = new CadOpsAgentAdapter();

    adapter.execute({
      requestId: "agent_req_create",
      adapterVersion: "web-cad.agent-adapter.v1",
      permissions: { allowCommit: true },
      batch: {
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            op: "scene.createBox",
            id: "query_box",
            name: "Query box",
            dimensions: { width: 4, height: 5, depth: 6 }
          }
        ]
      }
    });

    const request = parseCadOpsAgentQueryRequestJson(
      JSON.stringify({
        requestId: "agent_query_json",
        adapterVersion: "web-cad.agent-adapter.v1",
        query: {
          version: "cadops.v1",
          query: { query: "object.get", id: "query_box" }
        }
      })
    );
    const response = JSON.parse(adapter.queryJson(JSON.stringify(request))) as {
      readonly ok: boolean;
      readonly requestId: string;
      readonly query: string;
      readonly object: { readonly id: string; readonly kind: string };
    };

    expect(response).toMatchObject({
      ok: true,
      requestId: "agent_query_json",
      query: "object.get",
      object: {
        id: "query_box",
        kind: "box"
      }
    });
  });

  it("returns object measurements through adapter queries", () => {
    const engine = new CadEngine();

    engine.apply({
      op: "scene.createBox",
      id: "measured_box",
      dimensions: { width: 2, height: 4, depth: 6 }
    });

    const response = executeCadOpsAgentQueryRequest(engine, {
      requestId: "agent_measure_1",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: { query: "object.measurements", id: "measured_box" }
      }
    });

    expect(response).toMatchObject({
      ok: true,
      requestId: "agent_measure_1",
      adapterVersion: "web-cad.agent-adapter.v1",
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
    });
  });

  it("accepts sphere commands and exposes sphere measurements through adapter queries", () => {
    const adapter = new CadOpsAgentAdapter();

    adapter.execute({
      requestId: "agent_sphere_commit",
      adapterVersion: "web-cad.agent-adapter.v1",
      permissions: { allowCommit: true },
      batch: {
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            op: "scene.createSphere",
            id: "agent_sphere",
            dimensions: { radius: 2 }
          }
        ]
      }
    });

    const response = adapter.query({
      requestId: "agent_sphere_measure",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: { query: "object.measurements", id: "agent_sphere" }
      }
    });

    expect(response).toMatchObject({
      ok: true,
      requestId: "agent_sphere_measure",
      query: "object.measurements",
      measurements: {
        id: "agent_sphere",
        kind: "sphere",
        dimensions: { radius: 2 },
        localBounds: {
          min: [-2, -2, -2],
          max: [2, 2, 2]
        }
      }
    });
  });

  it("accepts cone and torus commands and exposes their measurements through adapter queries", () => {
    const adapter = new CadOpsAgentAdapter();

    const commit = adapter.execute({
      requestId: "agent_cone_torus_commit",
      adapterVersion: "web-cad.agent-adapter.v1",
      permissions: { allowCommit: true },
      batch: {
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            op: "scene.createCone",
            id: "agent_cone",
            dimensions: { radius: 1.5, height: 4 }
          },
          {
            op: "scene.createTorus",
            id: "agent_torus",
            dimensions: { majorRadius: 3, minorRadius: 1 }
          }
        ]
      }
    });
    const cone = adapter.query({
      requestId: "agent_cone_measure",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: { query: "object.measurements", id: "agent_cone" }
      }
    });
    const torus = adapter.query({
      requestId: "agent_torus_measure",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: { query: "object.measurements", id: "agent_torus" }
      }
    });

    expect(commit).toMatchObject({
      ok: true,
      createdIds: ["agent_cone", "agent_torus"],
      transactionId: "txn_1"
    });
    expect(cone).toMatchObject({
      ok: true,
      requestId: "agent_cone_measure",
      query: "object.measurements",
      measurements: {
        id: "agent_cone",
        kind: "cone",
        dimensions: { radius: 1.5, height: 4 },
        localBounds: {
          min: [-1.5, -1.5, -2],
          max: [1.5, 1.5, 2]
        }
      }
    });
    expect(torus).toMatchObject({
      ok: true,
      requestId: "agent_torus_measure",
      query: "object.measurements",
      measurements: {
        id: "agent_torus",
        kind: "torus",
        dimensions: { majorRadius: 3, minorRadius: 1 },
        localBounds: {
          min: [-4, -4, -1],
          max: [4, 4, 1]
        }
      }
    });
  });

  it("returns project extents through adapter query JSON", () => {
    const adapter = new CadOpsAgentAdapter();

    adapter.execute({
      requestId: "agent_req_extents_create",
      adapterVersion: "web-cad.agent-adapter.v1",
      permissions: { allowCommit: true },
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
    });

    const request = parseCadOpsAgentQueryRequestJson(
      JSON.stringify({
        requestId: "agent_extents_json",
        adapterVersion: "web-cad.agent-adapter.v1",
        query: {
          version: "cadops.v1",
          query: { query: "project.extents" }
        }
      })
    );
    const response = JSON.parse(adapter.queryJson(JSON.stringify(request))) as {
      readonly ok: boolean;
      readonly query: string;
      readonly objectCount: number;
      readonly objects: readonly { readonly id: string }[];
      readonly approximateVolume: number;
    };

    expect(response).toMatchObject({
      ok: true,
      query: "project.extents",
      objectCount: 1,
      objects: [{ id: "extent_cylinder" }]
    });
    expect(response.approximateVolume).toBeCloseTo(4 * Math.PI);
  });

  it("returns primitive feature summaries through adapter queries", () => {
    const adapter = new CadOpsAgentAdapter();

    adapter.execute({
      requestId: "agent_req_features_create",
      adapterVersion: "web-cad.agent-adapter.v1",
      permissions: { allowCommit: true },
      batch: {
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            op: "scene.createBox",
            id: "feature_box",
            name: "Feature box",
            dimensions: { width: 2, height: 3, depth: 4 }
          }
        ]
      }
    });

    const response = executeCadOpsAgentQueryRequest(adapter.getEngine(), {
      requestId: "agent_features_1",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: { query: "project.features" }
      }
    });

    expect(response).toMatchObject({
      ok: true,
      requestId: "agent_features_1",
      adapterVersion: "web-cad.agent-adapter.v1",
      cadOpsVersion: "cadops.v1",
      query: "project.features",
      featureCount: 1,
      features: [
        {
          id: "feature:feature_box",
          kind: "primitive",
          primitive: "box",
          objectId: "feature_box",
          name: "Feature box",
          source: {
            createdByTransactionId: "txn_1",
            createOp: "scene.createBox"
          }
        }
      ]
    });
  });

  it("returns derived part, feature, body, and object source mappings through adapter queries", () => {
    const adapter = new CadOpsAgentAdapter();

    adapter.execute({
      requestId: "agent_req_structure_create",
      adapterVersion: "web-cad.agent-adapter.v1",
      permissions: { allowCommit: true },
      batch: {
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            op: "scene.createCylinder",
            id: "structure_cylinder",
            name: "Structure cylinder",
            dimensions: { radius: 2, height: 8 }
          }
        ]
      }
    });

    const response = executeCadOpsAgentQueryRequest(adapter.getEngine(), {
      requestId: "agent_structure_1",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: { query: "project.structure" }
      }
    });

    expect(response).toMatchObject({
      ok: true,
      requestId: "agent_structure_1",
      adapterVersion: "web-cad.agent-adapter.v1",
      cadOpsVersion: "cadops.v1",
      query: "project.structure",
      partCount: 1,
      featureCount: 1,
      bodyCount: 1,
      parts: [
        {
          id: "part:default",
          featureIds: ["feature:structure_cylinder"],
          bodyIds: ["body:structure_cylinder"],
          objectIds: ["structure_cylinder"]
        }
      ],
      features: [
        {
          id: "feature:structure_cylinder",
          partId: "part:default",
          primitive: "cylinder",
          objectId: "structure_cylinder",
          bodyId: "body:structure_cylinder"
        }
      ],
      bodies: [
        {
          id: "body:structure_cylinder",
          kind: "solid",
          partId: "part:default",
          featureId: "feature:structure_cylinder",
          objectId: "structure_cylinder",
          primitive: "cylinder"
        }
      ],
      objectSources: [
        {
          objectId: "structure_cylinder",
          partId: "part:default",
          featureId: "feature:structure_cylinder",
          bodyId: "body:structure_cylinder"
        }
      ]
    });
  });

  it("returns sketch queries and sketch batch IDs through the adapter", () => {
    const adapter = new CadOpsAgentAdapter();

    const commit = adapter.execute({
      requestId: "agent_req_sketch_create",
      adapterVersion: "web-cad.agent-adapter.v1",
      permissions: { allowCommit: true },
      batch: {
        version: "cadops.v1",
        mode: "commit",
        ops: [
          { op: "sketch.create", name: "Adapter sketch", plane: "XY" },
          {
            op: "sketch.addCircle",
            sketchId: "sketch_1",
            center: [0, 0],
            radius: 2
          }
        ]
      }
    });

    const sketches = executeCadOpsAgentQueryRequest(adapter.getEngine(), {
      requestId: "agent_sketches_1",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: { query: "project.sketches" }
      }
    });
    const sketch = executeCadOpsAgentQueryRequest(adapter.getEngine(), {
      requestId: "agent_sketch_1",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: { query: "sketch.get", id: "sketch_1" }
      }
    });

    expect(commit).toMatchObject({
      ok: true,
      createdSketchIds: ["sketch_1"],
      createdSketchEntityIds: ["skent_1"]
    });
    expect(sketches).toMatchObject({
      ok: true,
      query: "project.sketches",
      sketchCount: 1,
      sketches: [
        {
          id: "sketch_1",
          name: "Adapter sketch",
          entities: [{ id: "skent_1", kind: "circle" }]
        }
      ]
    });
    expect(sketch).toMatchObject({
      ok: true,
      query: "sketch.get",
      sketch: {
        id: "sketch_1",
        plane: "XY"
      }
    });
  });

  it("returns transaction history through adapter queries", () => {
    const adapter = new CadOpsAgentAdapter();

    adapter.execute({
      requestId: "agent_req_history_create",
      adapterVersion: "web-cad.agent-adapter.v1",
      permissions: { allowCommit: true },
      actor: {
        type: "agent",
        id: "history-agent",
        name: "History Agent"
      },
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
    });
    adapter.getEngine().undo();

    const request = parseCadOpsAgentQueryRequestJson(
      JSON.stringify({
        requestId: "agent_history_json",
        adapterVersion: "web-cad.agent-adapter.v1",
        query: {
          version: "cadops.v1",
          query: { query: "transaction.history" }
        }
      })
    );
    const response = JSON.parse(adapter.queryJson(JSON.stringify(request))) as {
      readonly ok: boolean;
      readonly query: string;
      readonly transactionCount: number;
      readonly transactions: readonly {
        readonly id: string;
        readonly status: string;
        readonly actor?: { readonly id?: string };
        readonly ops: readonly {
          readonly op: string;
          readonly objectId?: string;
        }[];
      }[];
    };

    expect(response).toMatchObject({
      ok: true,
      query: "transaction.history",
      transactionCount: 1,
      transactions: [
        {
          id: "txn_1",
          status: "undone",
          actor: {
            id: "history-agent"
          },
          audit: {
            source: "agent-adapter",
            requestId: "agent_req_history_create",
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
            createdCount: 1,
            modifiedCount: 0,
            deletedCount: 0
          }
        }
      ]
    });
  });

  it("returns structured adapter query errors", () => {
    const adapter = new CadOpsAgentAdapter();

    const response = adapter.query({
      requestId: "agent_query_3",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: { query: "object.get", id: "missing_object" }
      }
    });

    expect(response).toEqual({
      ok: false,
      requestId: "agent_query_3",
      adapterVersion: "web-cad.agent-adapter.v1",
      cadOpsVersion: "cadops.v1",
      query: "object.get",
      error: {
        code: "OBJECT_NOT_FOUND",
        message: "Object does not exist: missing_object",
        objectId: "missing_object"
      }
    });
  });

  it("rejects non-CADOps adapter payloads", () => {
    expect(() =>
      parseCadOpsAgentRequestJson(
        JSON.stringify({
          requestId: "bad_request",
          adapterVersion: "web-cad.agent-adapter.v1",
          prompt: "make me a box"
        })
      )
    ).toThrow("Invalid CADOps agent adapter request.");
  });

  it("rejects non-CADOps adapter query payloads", () => {
    expect(() =>
      parseCadOpsAgentQueryRequestJson(
        JSON.stringify({
          requestId: "bad_query_request",
          adapterVersion: "web-cad.agent-adapter.v1",
          prompt: "what objects are in this model?"
        })
      )
    ).toThrow("Invalid CADOps agent adapter query request.");
  });
});

function seedExtrudeFeature(
  adapter: CadOpsAgentAdapter,
  ids: {
    readonly sketchId: string;
    readonly entityId: string;
    readonly featureId: string;
    readonly bodyId: string;
  }
): void {
  const response = adapter.execute({
    requestId: `agent_req_seed_${ids.featureId}`,
    adapterVersion: "web-cad.agent-adapter.v1",
    permissions: { allowCommit: true },
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
          op: "sketch.addRectangle",
          sketchId: ids.sketchId,
          id: ids.entityId,
          center: [0, 0],
          width: 2,
          height: 3
        },
        {
          op: "feature.extrude",
          id: ids.featureId,
          bodyId: ids.bodyId,
          sketchId: ids.sketchId,
          entityId: ids.entityId,
          depth: 4
        }
      ]
    }
  });

  expect(response).toMatchObject({
    ok: true,
    createdFeatureIds: [ids.featureId],
    createdBodyIds: [ids.bodyId]
  });
}
