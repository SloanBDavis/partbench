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
            depth: 4,
            operationMode: "newBody"
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
      features: [{ id: "feat_1", kind: "extrude", operationMode: "newBody" }],
      bodies: [{ id: "body_1", featureId: "feat_1" }]
    });
  });

  it("passes feature.revolve through JSON batch commit", () => {
    const adapter = new CadOpsAgentAdapter();
    const response = JSON.parse(
      adapter.executeJson(
        JSON.stringify({
          requestId: "agent_req_json_revolve",
          adapterVersion: "web-cad.agent-adapter.v1",
          permissions: { allowCommit: true },
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
        })
      )
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
      createdFeatureIds: ["feat_revolve_1"],
      createdBodyIds: ["body_revolve_1"]
    });
    expect(structure).toMatchObject({
      ok: true,
      features: [{ id: "feat_revolve_1", kind: "revolve", angleDegrees: 180 }],
      bodies: [
        {
          id: "body_revolve_1",
          featureId: "feat_revolve_1",
          source: { type: "sketchRevolveFeature" }
        }
      ]
    });
  });

  it("passes feature.hole through JSON batch commit", () => {
    const adapter = new CadOpsAgentAdapter();
    const response = JSON.parse(
      adapter.executeJson(
        JSON.stringify({
          requestId: "agent_req_json_hole",
          adapterVersion: "web-cad.agent-adapter.v1",
          permissions: { allowCommit: true },
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
                depthMode: "throughAll",
                direction: "positive"
              }
            ]
          }
        })
      )
    ) as {
      readonly ok: boolean;
      readonly createdFeatureIds?: readonly string[];
      readonly createdBodyIds?: readonly string[];
    };
    const structure = adapter.getEngine().executeQuery({
      version: "cadops.v1",
      query: { query: "project.structure" }
    });
    const health = adapter.getEngine().executeQuery({
      version: "cadops.v1",
      query: { query: "project.health" }
    });

    expect(response).toMatchObject({
      ok: true,
      createdFeatureIds: ["feat_target", "feat_hole"],
      createdBodyIds: ["body_target", "body_hole"]
    });
    expect(structure).toMatchObject({
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
          source: expect.objectContaining({ type: "sketchHoleFeature" })
        })
      ])
    });
    expect(health).toMatchObject({
      ok: true,
      authoredHoleCount: 1,
      authoredHoles: [
        {
          featureId: "feat_hole",
          bodyId: "body_hole",
          targetBodyId: "body_target",
          status: "healthy"
        }
      ]
    });
  });

  it("passes feature.chamfer and feature.fillet through JSON batch commit", () => {
    const adapter = new CadOpsAgentAdapter();
    const response = JSON.parse(
      adapter.executeJson(
        JSON.stringify({
          requestId: "agent_req_json_edge_finish",
          adapterVersion: "web-cad.agent-adapter.v1",
          permissions: { allowCommit: true },
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
        })
      )
    ) as {
      readonly ok: boolean;
      readonly createdFeatureIds?: readonly string[];
      readonly createdBodyIds?: readonly string[];
    };

    expect(response).toMatchObject({
      ok: true,
      createdFeatureIds: ["feat_target", "feat_chamfer"],
      createdBodyIds: ["body_target", "body_chamfer"]
    });

    const secondAdapter = new CadOpsAgentAdapter();
    const filletResponse = JSON.parse(
      secondAdapter.executeJson(
        JSON.stringify({
          requestId: "agent_req_json_fillet",
          adapterVersion: "web-cad.agent-adapter.v1",
          permissions: { allowCommit: true },
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
        })
      )
    ) as {
      readonly ok: boolean;
      readonly createdFeatureIds?: readonly string[];
      readonly createdBodyIds?: readonly string[];
    };

    expect(filletResponse).toMatchObject({
      ok: true,
      createdFeatureIds: ["feat_circle", "feat_fillet"],
      createdBodyIds: ["body_circle", "body_fillet"]
    });
  });

  it("passes rectangle add extrudes through JSON batch dry-run and commit", () => {
    const adapter = new CadOpsAgentAdapter();

    seedExtrudeFeature(adapter, {
      sketchId: "sketch_add",
      entityId: "rect_add",
      featureId: "feat_seed_add",
      bodyId: "body_seed_add"
    });

    const batch = {
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
          depth: 2,
          operationMode: "add" as const
        }
      ]
    };
    const dryRun = JSON.parse(
      adapter.executeJson(
        JSON.stringify({
          requestId: "agent_req_add_dry_run",
          adapterVersion: "web-cad.agent-adapter.v1",
          batch: { ...batch, mode: "dryRun" }
        })
      )
    );
    const commit = JSON.parse(
      adapter.executeJson(
        JSON.stringify({
          requestId: "agent_req_add_commit",
          adapterVersion: "web-cad.agent-adapter.v1",
          permissions: { allowCommit: true },
          batch
        })
      )
    );
    const structure = adapter.getEngine().executeQuery({
      version: "cadops.v1",
      query: { query: "project.structure" }
    });

    expect(dryRun).toMatchObject({
      ok: true,
      createdFeatureIds: ["feat_add"],
      createdBodyIds: ["body_add"]
    });
    expect(commit).toMatchObject({
      ok: true,
      createdFeatureIds: ["feat_add"],
      createdBodyIds: ["body_add"]
    });
    expect(structure).toMatchObject({
      ok: true,
      bodies: expect.arrayContaining([
        expect.objectContaining({
          id: "body_seed_add",
          consumedByFeatureId: "feat_add"
        }),
        expect.objectContaining({ id: "body_add", featureId: "feat_add" })
      ])
    });
  });

  it("passes rectangle cut extrudes through JSON batch dry-run and commit", () => {
    const adapter = new CadOpsAgentAdapter();

    seedExtrudeFeature(adapter, {
      sketchId: "sketch_cut",
      entityId: "rect_cut",
      featureId: "feat_seed_cut",
      bodyId: "body_seed_cut"
    });

    const batch = {
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
    const dryRun = JSON.parse(
      adapter.executeJson(
        JSON.stringify({
          requestId: "agent_req_cut_dry_run",
          adapterVersion: "web-cad.agent-adapter.v1",
          batch: { ...batch, mode: "dryRun" }
        })
      )
    );
    const commit = JSON.parse(
      adapter.executeJson(
        JSON.stringify({
          requestId: "agent_req_cut_commit",
          adapterVersion: "web-cad.agent-adapter.v1",
          permissions: { allowCommit: true },
          batch
        })
      )
    );

    expect(dryRun).toMatchObject({
      ok: true,
      createdFeatureIds: ["feat_cut"],
      createdBodyIds: ["body_cut"]
    });
    expect(commit).toMatchObject({
      ok: true,
      createdFeatureIds: ["feat_cut"],
      createdBodyIds: ["body_cut"]
    });
  });

  it("passes circle-target cut extrudes through JSON batch dry-run and commit", () => {
    const adapter = new CadOpsAgentAdapter();
    const seed = adapter.execute({
      requestId: "agent_req_seed_circle_cut_target",
      adapterVersion: "web-cad.agent-adapter.v1",
      permissions: { allowCommit: true },
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
    });

    expect(seed).toMatchObject({
      ok: true,
      createdFeatureIds: ["feat_circle_target"],
      createdBodyIds: ["body_circle_target"]
    });

    const batch = {
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
    const dryRun = JSON.parse(
      adapter.executeJson(
        JSON.stringify({
          requestId: "agent_req_circle_cut_dry_run",
          adapterVersion: "web-cad.agent-adapter.v1",
          batch: { ...batch, mode: "dryRun" }
        })
      )
    );
    const commit = JSON.parse(
      adapter.executeJson(
        JSON.stringify({
          requestId: "agent_req_circle_cut_commit",
          adapterVersion: "web-cad.agent-adapter.v1",
          permissions: { allowCommit: true },
          batch
        })
      )
    );

    expect(dryRun).toMatchObject({
      ok: true,
      createdFeatureIds: ["feat_circle_cut"],
      createdBodyIds: ["body_circle_cut"]
    });
    expect(commit).toMatchObject({
      ok: true,
      createdFeatureIds: ["feat_circle_cut"],
      createdBodyIds: ["body_circle_cut"]
    });
    expect(
      adapter.getEngine().executeQuery({
        version: "cadops.v1",
        query: { query: "project.structure" }
      })
    ).toMatchObject({
      ok: true,
      bodies: expect.arrayContaining([
        expect.objectContaining({
          id: "body_circle_target",
          consumedByFeatureId: "feat_circle_cut"
        }),
        expect.objectContaining({ id: "body_circle_cut" })
      ])
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

  it("returns authored body measurements through adapter queries", () => {
    const adapter = new CadOpsAgentAdapter();

    seedExtrudeFeature(adapter, {
      sketchId: "sketch_body_measure",
      entityId: "rect_body_measure",
      featureId: "feat_body_measure",
      bodyId: "body_measure"
    });

    const response = adapter.query({
      requestId: "agent_body_measure",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: { query: "body.measurements", bodyId: "body_measure" }
      }
    });

    expect(response).toMatchObject({
      ok: true,
      requestId: "agent_body_measure",
      adapterVersion: "web-cad.agent-adapter.v1",
      cadOpsVersion: "cadops.v1",
      query: "body.measurements",
      measurements: {
        bodyId: "body_measure",
        sourceFeatureId: "feat_body_measure",
        sourceSketchId: "sketch_body_measure",
        sourceSketchEntityId: "rect_body_measure",
        profileKind: "rectangle",
        depth: 4,
        volume: 24,
        surfaceArea: 52,
        localBounds: {
          min: [-1, -1.5, 0],
          max: [1, 1.5, 4],
          size: [2, 3, 4]
        }
      }
    });
  });

  it("returns body measurement errors through adapter queries", () => {
    const adapter = new CadOpsAgentAdapter();

    const response = adapter.query({
      requestId: "agent_missing_body_measure",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: { query: "body.measurements", bodyId: "missing_body" }
      }
    });

    expect(response).toMatchObject({
      ok: false,
      requestId: "agent_missing_body_measure",
      adapterVersion: "web-cad.agent-adapter.v1",
      cadOpsVersion: "cadops.v1",
      query: "body.measurements",
      error: {
        code: "BODY_NOT_FOUND",
        bodyId: "missing_body"
      }
    });
  });

  it("returns derived body topology status through adapter queries", () => {
    const adapter = new CadOpsAgentAdapter();

    seedExtrudeFeature(adapter, {
      sketchId: "sketch_body_topology",
      entityId: "rect_body_topology",
      featureId: "feat_body_topology",
      bodyId: "body_topology"
    });

    const response = adapter.query({
      requestId: "agent_body_topology",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: { query: "body.topology", bodyId: "body_topology" }
      }
    });

    expect(response).toMatchObject({
      ok: true,
      requestId: "agent_body_topology",
      adapterVersion: "web-cad.agent-adapter.v1",
      cadOpsVersion: "cadops.v1",
      query: "body.topology",
      topology: {
        bodyId: "body_topology",
        status: "healthy",
        sourceIdentity: {
          featureId: "feat_body_topology",
          sourceSketchId: "sketch_body_topology",
          sourceSketchEntityId: "rect_body_topology",
          operationMode: "newBody"
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
    });

    if (!response.ok || response.query !== "body.topology") {
      throw new Error("Expected body topology response.");
    }

    const withExactMetadata = adapter.query({
      requestId: "agent_body_topology_exact",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: {
          query: "body.topology",
          bodyId: "body_topology",
          derivedExactMetadata: {
            bodyId: "body_topology",
            sourceIdentityCacheKey: response.topology.sourceIdentity.cacheKey,
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
      }
    });

    expect(withExactMetadata).toMatchObject({
      ok: true,
      requestId: "agent_body_topology_exact",
      query: "body.topology",
      topology: {
        bodyId: "body_topology",
        exactGeometryAvailable: true,
        exactMeasurementsAvailable: true,
        measurementConfidence: "kernel-derived",
        exactMetadata: { status: "healthy", volume: 24 }
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

  it("passes derived exact metadata snapshots through project extents adapter queries", () => {
    const adapter = new CadOpsAgentAdapter();

    adapter.execute({
      requestId: "agent_req_revolve_extents_create",
      adapterVersion: "web-cad.agent-adapter.v1",
      permissions: { allowCommit: true },
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
    });

    const topology = adapter.query({
      requestId: "agent_revolve_topology",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: { query: "body.topology", bodyId: "body_revolve" }
      }
    });

    if (!topology.ok || topology.query !== "body.topology") {
      throw new Error("Expected body topology response.");
    }

    const request = parseCadOpsAgentQueryRequestJson(
      JSON.stringify({
        requestId: "agent_extents_exact_json",
        adapterVersion: "web-cad.agent-adapter.v1",
        query: {
          version: "cadops.v1",
          query: {
            query: "project.extents",
            derivedExactMetadata: [
              {
                bodyId: "body_revolve",
                sourceIdentityCacheKey:
                  topology.topology.sourceIdentity.cacheKey,
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
        }
      })
    );
    const response = JSON.parse(adapter.queryJson(JSON.stringify(request))) as {
      readonly ok: boolean;
      readonly query: string;
      readonly bodyCount: number;
      readonly bodies: readonly {
        readonly bodyId: string;
        readonly extentSource: string;
        readonly volume: number;
      }[];
      readonly warnings: readonly unknown[];
    };

    expect(response).toMatchObject({
      ok: true,
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
    });
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

  it("passes sketch.createOnFace through JSON batch dry-run and commit", () => {
    const adapter = new CadOpsAgentAdapter();
    seedExtrudeFeature(adapter, {
      sketchId: "sketch_profile",
      entityId: "rect_profile",
      featureId: "feat_profile",
      bodyId: "body_profile"
    });

    const batch = {
      version: "cadops.v1" as const,
      mode: "dryRun" as const,
      ops: [
        {
          op: "sketch.createOnFace" as const,
          id: "sketch_face",
          name: "Face sketch",
          bodyId: "body_profile",
          faceStableId: "generated:face:body_profile:endCap"
        }
      ]
    };

    expect(
      adapter.execute({
        requestId: "agent_req_create_on_face_dry",
        adapterVersion: "web-cad.agent-adapter.v1",
        batch
      })
    ).toMatchObject({
      ok: true,
      mode: "dryRun",
      createdSketchIds: ["sketch_face"]
    });

    expect(
      adapter.execute({
        requestId: "agent_req_create_on_face_commit",
        adapterVersion: "web-cad.agent-adapter.v1",
        permissions: { allowCommit: true },
        batch: { ...batch, mode: "commit" }
      })
    ).toMatchObject({
      ok: true,
      mode: "commit",
      createdSketchIds: ["sketch_face"]
    });

    const sketch = executeCadOpsAgentQueryRequest(adapter.getEngine(), {
      requestId: "agent_req_face_sketch_get",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: { query: "sketch.get", id: "sketch_face" }
      }
    });

    expect(sketch).toMatchObject({
      ok: true,
      sketch: {
        id: "sketch_face",
        attachment: {
          kind: "generatedFace",
          bodyId: "body_profile",
          faceRole: "endCap"
        }
      }
    });
  });

  it("passes sketch.createOnFace with a named face reference through JSON batch dry-run and commit", () => {
    const adapter = new CadOpsAgentAdapter();
    seedExtrudeFeature(adapter, {
      sketchId: "sketch_named_profile",
      entityId: "rect_named_profile",
      featureId: "feat_named_profile",
      bodyId: "body_named_profile"
    });

    const batch = {
      version: "cadops.v1" as const,
      mode: "dryRun" as const,
      ops: [
        {
          op: "reference.nameGenerated" as const,
          name: "Named end face",
          bodyId: "body_named_profile",
          stableId: "generated:face:body_named_profile:endCap"
        },
        {
          op: "sketch.createOnFace" as const,
          id: "sketch_named_face",
          name: "Named face sketch",
          referenceName: "Named end face"
        }
      ]
    };

    expect(
      adapter.execute({
        requestId: "agent_req_create_on_named_face_dry",
        adapterVersion: "web-cad.agent-adapter.v1",
        batch
      })
    ).toMatchObject({
      ok: true,
      mode: "dryRun",
      createdSketchIds: ["sketch_named_face"]
    });

    expect(
      adapter.execute({
        requestId: "agent_req_create_on_named_face_commit",
        adapterVersion: "web-cad.agent-adapter.v1",
        permissions: { allowCommit: true },
        batch: { ...batch, mode: "commit" }
      })
    ).toMatchObject({
      ok: true,
      mode: "commit",
      createdSketchIds: ["sketch_named_face"]
    });
  });

  it("returns generated body references through adapter queries", () => {
    const adapter = new CadOpsAgentAdapter();

    seedExtrudeFeature(adapter, {
      sketchId: "sketch_refs",
      entityId: "rect_refs",
      featureId: "feat_refs",
      bodyId: "body_refs"
    });

    const response = executeCadOpsAgentQueryRequest(adapter.getEngine(), {
      requestId: "agent_body_refs",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: { query: "body.generatedReferences", bodyId: "body_refs" }
      }
    });

    expect(response).toMatchObject({
      ok: true,
      requestId: "agent_body_refs",
      query: "body.generatedReferences",
      body: {
        stableId: "generated:body:body_refs",
        label: "Rectangle extrude body",
        eligibleOperations: [
          "feature.measureReference",
          "feature.selectReference"
        ],
        bodyId: "body_refs",
        sourceFeatureId: "feat_refs",
        sourceSketchId: "sketch_refs",
        sourceSketchEntityId: "rect_refs",
        profileKind: "rectangle"
      },
      faceCount: 6,
      edgeCount: 12,
      vertexCount: 8,
      faces: [
        {
          role: "startCap",
          label: "Start cap",
          eligibleOperations: [
            "feature.attachSketchPlane",
            "feature.measureReference",
            "feature.selectReference"
          ]
        },
        { role: "endCap" },
        { role: "side:uMin", label: "uMin side face" },
        { role: "side:uMax" },
        { role: "side:vMin" },
        { role: "side:vMax" }
      ],
      edges: [
        { role: "start:uMin" },
        { role: "start:uMax" },
        { role: "start:vMin" },
        { role: "start:vMax" },
        { role: "end:uMin" },
        { role: "end:uMax" },
        { role: "end:vMin" },
        { role: "end:vMax" },
        {
          role: "longitudinal:uMin:vMin",
          label: "uMin/vMin longitudinal edge",
          eligibleOperations: [
            "feature.chamfer",
            "feature.fillet",
            "feature.measureReference",
            "feature.selectReference"
          ],
          adjacentFaceRoles: ["side:uMin", "side:vMin"]
        },
        { role: "longitudinal:uMin:vMax" },
        { role: "longitudinal:uMax:vMin" },
        { role: "longitudinal:uMax:vMax" }
      ],
      vertices: [
        {
          role: "start:uMin:vMin",
          label: "Start uMin/vMin corner",
          eligibleOperations: [
            "feature.measureReference",
            "feature.selectReference"
          ],
          adjacentFaceRoles: ["startCap", "side:uMin", "side:vMin"],
          adjacentEdgeRoles: [
            "start:uMin",
            "start:vMin",
            "longitudinal:uMin:vMin"
          ]
        },
        { role: "start:uMin:vMax" },
        { role: "start:uMax:vMin" },
        { role: "start:uMax:vMax" },
        { role: "end:uMin:vMin" },
        { role: "end:uMin:vMax" },
        { role: "end:uMax:vMin" },
        { role: "end:uMax:vMax" }
      ]
    });
  });

  it("returns project dependency health through adapter queries", () => {
    const adapter = new CadOpsAgentAdapter();

    seedExtrudeFeature(adapter, {
      sketchId: "sketch_health",
      entityId: "rect_health",
      featureId: "feat_health",
      bodyId: "body_health"
    });
    adapter.execute({
      requestId: "agent_req_seed_health_constraint",
      adapterVersion: "web-cad.agent-adapter.v1",
      permissions: { allowCommit: true },
      batch: {
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            op: "sketch.constraint.create",
            id: "fix_health_center",
            name: "Fixed health center",
            sketchId: "sketch_health",
            kind: "fixed",
            target: { entityId: "rect_health", role: "center" },
            coordinate: [1, 2]
          }
        ]
      }
    });

    const response = executeCadOpsAgentQueryRequest(adapter.getEngine(), {
      requestId: "agent_project_health",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: { query: "project.health" }
      }
    });

    expect(response).toMatchObject({
      ok: true,
      requestId: "agent_project_health",
      query: "project.health",
      status: "under-defined",
      issueCount: 1,
      authoredExtrudeCount: 1,
      sketchEvaluationCount: 1,
      sketchDimensionCount: 0,
      sketchConstraintCount: 1,
      authoredExtrudes: [
        {
          featureId: "feat_health",
          bodyId: "body_health",
          sketchId: "sketch_health",
          entityId: "rect_health",
          status: "healthy"
        }
      ],
      sketchEvaluations: [
        expect.objectContaining({
          sketchId: "sketch_health",
          status: "under-defined",
          affectedFeatureIds: ["feat_health"],
          affectedBodyIds: ["body_health"],
          issues: [expect.objectContaining({ code: "UNDER_DEFINED_SKETCH" })]
        })
      ],
      sketchDimensions: [],
      sketchConstraints: [
        {
          constraintId: "fix_health_center",
          affectedFeatureIds: ["feat_health"],
          affectedBodyIds: ["body_health"],
          status: "healthy"
        }
      ]
    });
  });

  it("resolves generated references through adapter queries", () => {
    const adapter = new CadOpsAgentAdapter();

    seedExtrudeFeature(adapter, {
      sketchId: "sketch_resolve_refs",
      entityId: "rect_resolve_refs",
      featureId: "feat_resolve_refs",
      bodyId: "body_resolve_refs"
    });

    const response = executeCadOpsAgentQueryRequest(adapter.getEngine(), {
      requestId: "agent_resolve_refs",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: {
          query: "body.resolveGeneratedReference",
          bodyId: "body_resolve_refs",
          stableId: "generated:vertex:body_resolve_refs:start:uMin:vMin"
        }
      }
    });

    expect(response).toMatchObject({
      ok: true,
      requestId: "agent_resolve_refs",
      query: "body.resolveGeneratedReference",
      bodyId: "body_resolve_refs",
      stableId: "generated:vertex:body_resolve_refs:start:uMin:vMin",
      kind: "vertex",
      reference: {
        kind: "vertex",
        label: "Start uMin/vMin corner",
        eligibleOperations: [
          "feature.measureReference",
          "feature.selectReference"
        ],
        role: "start:uMin:vMin",
        adjacentFaceRoles: ["startCap", "side:uMin", "side:vMin"],
        adjacentEdgeRoles: [
          "start:uMin",
          "start:vMin",
          "longitudinal:uMin:vMin"
        ]
      }
    });
  });

  it("passes named generated references through adapter batch and queries", () => {
    const adapter = new CadOpsAgentAdapter();

    seedExtrudeFeature(adapter, {
      sketchId: "sketch_named_refs",
      entityId: "rect_named_refs",
      featureId: "feat_named_refs",
      bodyId: "body_named_refs"
    });

    const commit = adapter.execute({
      requestId: "agent_name_ref",
      adapterVersion: "web-cad.agent-adapter.v1",
      permissions: { allowCommit: true },
      batch: {
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            op: "reference.nameGenerated",
            name: "Mounting face",
            bodyId: "body_named_refs",
            stableId: "generated:face:body_named_refs:startCap"
          }
        ]
      }
    });

    expect(commit).toMatchObject({
      ok: true,
      mode: "commit"
    });

    expect(
      executeCadOpsAgentQueryRequest(adapter.getEngine(), {
        requestId: "agent_named_refs",
        adapterVersion: "web-cad.agent-adapter.v1",
        query: {
          version: "cadops.v1",
          query: { query: "reference.listNamed" }
        }
      })
    ).toMatchObject({
      ok: true,
      query: "reference.listNamed",
      referenceCount: 1,
      references: [
        {
          name: "Mounting face",
          status: "resolved",
          reference: { kind: "face", role: "startCap" }
        }
      ]
    });

    expect(
      executeCadOpsAgentQueryRequest(adapter.getEngine(), {
        requestId: "agent_resolve_named_ref",
        adapterVersion: "web-cad.agent-adapter.v1",
        query: {
          version: "cadops.v1",
          query: { query: "reference.resolveNamed", name: "Mounting face" }
        }
      })
    ).toMatchObject({
      ok: true,
      query: "reference.resolveNamed",
      name: "Mounting face",
      reference: { kind: "face", role: "startCap" }
    });
  });

  it("returns generated reference measurements through adapter queries", () => {
    const adapter = new CadOpsAgentAdapter();

    seedExtrudeFeature(adapter, {
      sketchId: "sketch_measure_refs",
      entityId: "rect_measure_refs",
      featureId: "feat_measure_refs",
      bodyId: "body_measure_refs"
    });

    const response = executeCadOpsAgentQueryRequest(adapter.getEngine(), {
      requestId: "agent_measure_refs",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: {
          query: "body.generatedReferenceMeasurements",
          bodyId: "body_measure_refs",
          stableId: "generated:face:body_measure_refs:endCap"
        }
      }
    });

    expect(response).toMatchObject({
      ok: true,
      requestId: "agent_measure_refs",
      query: "body.generatedReferenceMeasurements",
      bodyId: "body_measure_refs",
      stableId: "generated:face:body_measure_refs:endCap",
      kind: "face",
      reference: {
        kind: "face",
        role: "endCap",
        label: "End cap"
      },
      measurements: {
        kind: "face",
        role: "endCap",
        area: 6,
        center: [0, 0, 4],
        bounds: {
          min: [-1, -1.5, 4],
          max: [1, 1.5, 4]
        }
      }
    });
  });

  it("passes through generated reference measurement errors through adapter queries", () => {
    const adapter = new CadOpsAgentAdapter();

    seedExtrudeFeature(adapter, {
      sketchId: "sketch_measure_error_refs",
      entityId: "rect_measure_error_refs",
      featureId: "feat_measure_error_refs",
      bodyId: "body_measure_error_refs"
    });

    const response = adapter.query({
      requestId: "agent_measure_missing_ref",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: {
          query: "body.generatedReferenceMeasurements",
          bodyId: "body_measure_error_refs",
          stableId: "generated:face:body_measure_error_refs:missing"
        }
      }
    });

    expect(response).toMatchObject({
      ok: false,
      requestId: "agent_measure_missing_ref",
      adapterVersion: "web-cad.agent-adapter.v1",
      cadOpsVersion: "cadops.v1",
      query: "body.generatedReferenceMeasurements",
      error: {
        code: "GENERATED_REFERENCE_NOT_FOUND",
        bodyId: "body_measure_error_refs",
        stableId: "generated:face:body_measure_error_refs:missing"
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

describe("agent-adapter V3 parameter and dimension pass-through", () => {
  it("passes parameter and sketch dimension commands and queries through", () => {
    const adapter = new CadOpsAgentAdapter();

    const commit = adapter.execute({
      requestId: "agent_req_v3_commit",
      adapterVersion: "web-cad.agent-adapter.v1",
      permissions: { allowCommit: true },
      batch: {
        version: "cadops.v1",
        mode: "commit",
        ops: [
          { op: "sketch.create", id: "sketch_1", name: "Profile", plane: "XY" },
          {
            op: "sketch.addRectangle",
            sketchId: "sketch_1",
            id: "rect_1",
            center: [0, 0],
            width: 2,
            height: 1
          },
          {
            op: "sketch.addLine",
            sketchId: "sketch_1",
            id: "line_1",
            start: [0, 0],
            end: [0, 2]
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
          { op: "parameter.create", id: "param_w", name: "Width", value: 5 },
          {
            op: "parameter.create",
            id: "param_length",
            name: "Length",
            value: 6
          },
          {
            op: "sketch.dimension.create",
            id: "dim_w",
            name: "Width dimension",
            sketchId: "sketch_1",
            entityId: "rect_1",
            target: { entityKind: "rectangle", role: "width" },
            parameterId: "param_w"
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
    });

    expect(commit).toMatchObject({
      ok: true,
      createdParameterIds: ["param_w", "param_length"],
      createdSketchDimensionIds: ["dim_w", "dim_line_length"],
      createdSketchConstraintIds: [
        "con_horizontal",
        "con_fixed_start",
        "con_coincident_end",
        "con_midpoint",
        "con_parallel",
        "con_perpendicular"
      ],
      modifiedSketchEntityIds: [
        "rect_1",
        "line_1",
        "point_1",
        "point_mid",
        "line_2",
        "line_3"
      ]
    });

    expect(
      adapter.query({
        requestId: "agent_req_parameter_list",
        adapterVersion: "web-cad.agent-adapter.v1",
        query: {
          version: "cadops.v1",
          query: { query: "parameter.list" }
        }
      })
    ).toMatchObject({
      ok: true,
      query: "parameter.list",
      parameterCount: 2,
      parameters: [
        { id: "param_w", name: "Width", value: 5 },
        { id: "param_length", name: "Length", value: 6 }
      ]
    });

    expect(
      adapter.query({
        requestId: "agent_req_dimensions",
        adapterVersion: "web-cad.agent-adapter.v1",
        query: {
          version: "cadops.v1",
          query: { query: "sketch.dimensions", sketchId: "sketch_1" }
        }
      })
    ).toMatchObject({
      ok: true,
      query: "sketch.dimensions",
      sketchId: "sketch_1",
      dimensionCount: 2,
      dimensions: [
        expect.objectContaining({
          id: "dim_w",
          status: "healthy",
          effectiveValue: 5
        }),
        expect.objectContaining({
          id: "dim_line_length",
          target: { entityKind: "line", role: "length" },
          status: "healthy",
          effectiveValue: 6
        })
      ]
    });

    expect(
      adapter.query({
        requestId: "agent_req_sketch_evaluation",
        adapterVersion: "web-cad.agent-adapter.v1",
        query: {
          version: "cadops.v1",
          query: { query: "sketch.evaluation", sketchId: "sketch_1" }
        }
      })
    ).toMatchObject({
      ok: true,
      query: "sketch.evaluation",
      sketchId: "sketch_1",
      sketchName: "Profile",
      plane: "XY",
      status: "under-defined",
      drivenEntityIds: [
        "rect_1",
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
        expect.objectContaining({
          id: "dim_w",
          effectiveValue: 5
        }),
        expect.objectContaining({
          id: "dim_line_length",
          effectiveValue: 6
        })
      ]
    });
  });
});
