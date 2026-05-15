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
      transactionId: undefined
    });
    expect(engine.getDocument().objects.size).toBe(0);
  });

  it("runs a CADOps commit batch and returns the transaction ID", () => {
    const adapter = new CadOpsAgentAdapter();

    const response = adapter.execute({
      requestId: "agent_req_2",
      adapterVersion: "web-cad.agent-adapter.v1",
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

  it("returns structured CADOps validation errors", () => {
    const adapter = new CadOpsAgentAdapter();

    const response = adapter.execute({
      requestId: "agent_req_3",
      adapterVersion: "web-cad.agent-adapter.v1",
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

  it("returns structured actor validation errors from CADOps", () => {
    const adapter = new CadOpsAgentAdapter();

    const response = adapter.execute({
      requestId: "agent_req_bad_actor",
      adapterVersion: "web-cad.agent-adapter.v1",
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
