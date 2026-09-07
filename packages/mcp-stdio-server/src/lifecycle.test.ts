import { describe, expect, it } from "vitest";
import { createMcpStdioSession } from "./index";

describe("MCP lifecycle", () => {
  it("initializes, ignores notifications, and answers ping without opening a browser", async () => {
    const session = createMcpStdioSession();
    const initialize = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "test", version: "1" }
      }
    });
    expect(
      JSON.parse((await session.handleLineAsync(initialize))!)
    ).toMatchObject({
      id: 1,
      result: {
        protocolVersion: "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: { name: "partbench" }
      }
    });
    expect(
      await session.handleLineAsync(
        JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })
      )
    ).toBeUndefined();
    expect(
      session.handleLine(
        JSON.stringify({
          jsonrpc: "2.0",
          method: "notifications/cancelled",
          params: { requestId: 1 }
        })
      )
    ).toBeUndefined();
    expect(
      JSON.parse(
        (await session.handleLineAsync(
          JSON.stringify({ jsonrpc: "2.0", id: 2, method: "ping" })
        ))!
      )
    ).toEqual({ jsonrpc: "2.0", id: 2, result: {} });
  });

  it("returns an actionable protocol error for malformed initialization", async () => {
    const session = createMcpStdioSession();
    expect(
      JSON.parse(
        (await session.handleLineAsync(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "initialize",
            params: {}
          })
        ))!
      )
    ).toMatchObject({
      id: 1,
      error: {
        code: -32602,
        message: expect.stringContaining("protocolVersion")
      }
    });
  });
});
