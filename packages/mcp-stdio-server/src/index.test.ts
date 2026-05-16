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
          { name: "cad.project_summary" },
          { name: "cad.project_features" },
          { name: "cad.project_structure" },
          { name: "cad.object_measurements" },
          { name: "cad.project_extents" },
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
          objects: [{ id: "stdio_box", kind: "box" }]
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
