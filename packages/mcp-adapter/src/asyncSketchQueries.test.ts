import { createCadOpsAgentAdapter } from "@web-cad/agent-adapter";
import { describe, expect, it, vi } from "vitest";
import {
  createCadMcpServer,
  type CadMcpExecutionPort,
  type CadMcpToolCallRequest
} from "./index";

function createFixture() {
  const adapter = createCadOpsAgentAdapter();
  adapter.getEngine().applyBatch([
    { op: "sketch.create", id: "outline", name: "Outline", plane: "XY" },
    {
      op: "sketch.addRectangle",
      sketchId: "outline",
      id: "outer",
      center: [0, 0],
      width: 20,
      height: 10
    },
    {
      op: "sketch.addCircle",
      sketchId: "outline",
      id: "hole",
      center: [0, 0],
      radius: 2
    },
    {
      op: "sketch.addLine",
      sketchId: "outline",
      id: "line",
      start: [30, 0],
      end: [40, 0]
    }
  ]);
  const query = vi.fn<CadMcpExecutionPort["query"]>(async (request) =>
    adapter.query(request)
  );
  const unexpected = async (): Promise<never> => {
    throw new Error("Unexpected execution-port operation.");
  };
  const executionPort: CadMcpExecutionPort = {
    query,
    execute: unexpected,
    inspectV8ProjectSurface: unexpected,
    getCurrentSelection: unexpected,
    requestExactExport: unexpected
  };
  return {
    adapter,
    query,
    sync: createCadMcpServer({ adapter }),
    async: createCadMcpServer({ executionPort })
  };
}

describe("async sketch query parity", () => {
  it("discovers and validates actual regions and curve edits through the host", async () => {
    const fixture = createFixture();
    const candidatesRequest = {
      name: "cad.sketch_profile_region_candidates",
      requestId: "regions",
      arguments: { sketchId: "outline", entityIds: ["outer", "hole"], limit: 1 }
    };
    const candidates = await fixture.async.callToolAsync(candidatesRequest);
    expect(candidates).toEqual(fixture.sync.callTool(candidatesRequest));
    expect(candidates).toMatchObject({
      isError: false,
      structuredContent: {
        ok: true,
        status: "ready",
        candidates: [expect.any(Object)]
      }
    });
    const response = candidates.structuredContent;
    if (
      !response.ok ||
      !("query" in response) ||
      response.query !== "sketch.profileRegionCandidates"
    ) {
      throw new Error("Expected region candidates.");
    }
    const region = response.candidates[0]?.region;
    expect(region).toBeDefined();
    const requests: CadMcpToolCallRequest[] = [
      {
        name: "cad.sketch_profile_region_validate",
        requestId: "validate",
        arguments: {
          profile: { kind: "regions", sketchId: "outline", regions: [region] }
        }
      },
      {
        name: "cad.sketch_curve_edit_readiness",
        requestId: "curve",
        arguments: {
          proposal: {
            kind: "split",
            sketchId: "outline",
            entityId: "line",
            splitPoints: [[35, 0]]
          }
        }
      }
    ];
    for (const request of requests) {
      const result = await fixture.async.callToolAsync(request);
      expect(result).toEqual(fixture.sync.callTool(request));
      expect(result).toMatchObject({
        isError: false,
        structuredContent: { ok: true, status: "ready" }
      });
    }
    expect(
      fixture.query.mock.calls.map(([request]) => request.query.query.query)
    ).toEqual([
      "sketch.profileRegionCandidates",
      "sketch.profileRegionValidate",
      "sketch.curveEditReadiness"
    ]);
  });

  it("rejects malformed arguments before calling the host in either path", async () => {
    const fixture = createFixture();
    const requests: CadMcpToolCallRequest[] = [
      {
        name: "cad.sketch_profile_region_candidates",
        arguments: { sketchId: "outline", limit: 0 }
      },
      {
        name: "cad.sketch_profile_region_candidates",
        arguments: {
          sketchId: "outline",
          afterCandidateKey: "cursor_without_revision"
        }
      },
      {
        name: "cad.sketch_profile_region_candidates",
        arguments: { sketchId: "outline", query: "project.summary" }
      },
      {
        name: "cad.sketch_profile_region_validate",
        arguments: {
          profile: { kind: "regions", sketchId: "outline", regions: [] }
        }
      },
      {
        name: "cad.sketch_curve_edit_readiness",
        arguments: { proposal: { kind: "split", sketchId: "outline" } }
      }
    ];
    for (const request of requests) {
      expect(fixture.sync.callTool(request)).toMatchObject({
        isError: true,
        structuredContent: { error: { code: "INVALID_ARGUMENTS" } }
      });
      expect(await fixture.async.callToolAsync(request)).toEqual(
        fixture.sync.callTool(request)
      );
    }
    expect(fixture.query).not.toHaveBeenCalled();
  });

  it("preserves document failures and does not relabel execution errors as malformed input", async () => {
    const fixture = createFixture();
    const request = {
      name: "cad.sketch_profile_region_candidates",
      requestId: "missing",
      arguments: { sketchId: "missing" }
    };
    const failed = await fixture.async.callToolAsync(request);
    expect(failed).toEqual(fixture.sync.callTool(request));
    expect(failed).toMatchObject({
      isError: true,
      structuredContent: { ok: false }
    });
    expect(failed.structuredContent).not.toMatchObject({
      error: { code: "INVALID_ARGUMENTS" }
    });

    const executionError = new Error("Query host disconnected.");
    fixture.query.mockRejectedValueOnce(executionError);
    await expect(fixture.async.callToolAsync(request)).rejects.toBe(
      executionError
    );
    vi.spyOn(fixture.adapter, "query").mockImplementationOnce(() => {
      throw executionError;
    });
    expect(() => fixture.sync.callTool(request)).toThrow(executionError);
  });
});
