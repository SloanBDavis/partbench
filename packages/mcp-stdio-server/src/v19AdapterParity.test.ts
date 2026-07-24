import { describe, expect, it } from "vitest";
import { createMcpStdioSession } from "./index";

describe("V19 stdio adapter parity", () => {
  it("carries V19 query identity and strict validation over JSON-RPC", () => {
    const session = createMcpStdioSession();
    const valid = session.handleMessage(
      JSON.stringify({
        jsonrpc: "2.0",
        id: "v19-region-query",
        method: "tools/call",
        params: {
          name: "cad.sketch_profile_region_candidates",
          arguments: {
            sketchId: "sketch_1",
            entityIds: ["circle_1"],
            limit: 20
          }
        }
      })
    );
    const invalid = session.handleMessage(
      JSON.stringify({
        jsonrpc: "2.0",
        id: "v19-bad-region-query",
        method: "tools/call",
        params: {
          name: "cad.sketch_profile_region_candidates",
          arguments: {
            sketchId: "sketch_1",
            limit: 1000,
            screenshot: "data:image/png;base64,opaque"
          }
        }
      })
    );

    expect(valid).toMatchObject({
      jsonrpc: "2.0",
      id: "v19-region-query",
      result: {
        toolName: "cad.sketch_profile_region_candidates",
        isError: true,
        structuredContent: {
          ok: false,
          error: { code: "UNKNOWN_QUERY" }
        }
      }
    });
    expect(invalid).toMatchObject({
      jsonrpc: "2.0",
      id: "v19-bad-region-query",
      result: {
        toolName: "cad.sketch_profile_region_candidates",
        isError: true,
        structuredContent: {
          ok: false,
          error: { code: "INVALID_ARGUMENTS" }
        }
      }
    });
  });
});
