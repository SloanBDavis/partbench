import { describe, expect, it } from "vitest";
import { CadMcpServer, createCadMcpServer } from "./index";

describe("mcp-adapter", () => {
  it("lists only the supported CAD tools", () => {
    const server = createCadMcpServer();

    expect(server.listTools().tools.map((tool) => tool.name)).toEqual([
      "cad.project_summary",
      "cad.object_measurements",
      "cad.project_extents",
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

  it("returns object measurements through cad.object_measurements", () => {
    const server = new CadMcpServer();

    server.callTool({
      name: "cad.batch",
      requestId: "mcp_req_create_measured",
      arguments: {
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

  it("returns project extents through cad.project_extents", () => {
    const server = new CadMcpServer();

    server.callTool({
      name: "cad.batch",
      requestId: "mcp_req_create_extents",
      arguments: {
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

  it("returns structured CADOps errors from cad.batch", () => {
    const server = new CadMcpServer();

    const result = server.callTool({
      name: "cad.batch",
      requestId: "mcp_req_error",
      arguments: {
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
          { name: "cad.object_measurements" },
          { name: "cad.project_extents" },
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
  });
});
