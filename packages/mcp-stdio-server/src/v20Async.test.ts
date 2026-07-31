import { createCadMcpServer, type CadMcpExecutionPort } from "@web-cad/mcp-adapter";
import type { CadOpsAgentCurrentSelectionResponse } from "@web-cad/agent-adapter";
import { describe, expect, it } from "vitest";
import { createMcpStdioSession } from "./index";

describe("V20 async stdio", () => {
  it("lets responses complete out of order without losing JSON-RPC IDs", async () => {
    const pending = new Map<
      string,
      (response: CadOpsAgentCurrentSelectionResponse) => void
    >();
    const executionPort: CadMcpExecutionPort = {
      execute: rejectUnexpected,
      query: rejectUnexpected,
      inspectV8ProjectSurface: rejectUnexpected,
      getCurrentSelection: ({ requestId }) =>
        new Promise((resolve) => pending.set(requestId, resolve))
    };
    const session = createMcpStdioSession({
      server: createCadMcpServer({ executionPort })
    });
    const first = session.handleLineAsync(selectionCall("first"));
    const second = session.handleLineAsync(selectionCall("second"));

    pending.get("mcp_jsonrpc_second")?.(selectionResponse("mcp_jsonrpc_second"));
    expect(JSON.parse((await second) ?? "null")).toMatchObject({
      id: "second",
      result: { structuredContent: { requestId: "mcp_jsonrpc_second" } }
    });

    pending.get("mcp_jsonrpc_first")?.(selectionResponse("mcp_jsonrpc_first"));
    expect(JSON.parse((await first) ?? "null")).toMatchObject({
      id: "first",
      result: { structuredContent: { requestId: "mcp_jsonrpc_first" } }
    });
  });
});

async function rejectUnexpected(): Promise<never> {
  throw new Error("Unexpected execution-port operation.");
}

function selectionCall(id: string): string {
  return JSON.stringify({
    jsonrpc: "2.0",
    id,
    method: "tools/call",
    params: { name: "cad.get_selection", arguments: {} }
  });
}

function selectionResponse(requestId: string): CadOpsAgentCurrentSelectionResponse {
  return {
    ok: true,
    requestId,
    adapterVersion: "web-cad.agent-adapter.v1",
    sourceIdentity: {
      algorithm: "partbench-source-v1",
      sha256: "a".repeat(64)
    },
    selection: { kind: "none" }
  };
}
