import { createCadOpsAgentAdapter } from "@web-cad/agent-adapter";
import { describe, expect, it, vi } from "vitest";
import { createCadMcpServer } from "./index";

const SOURCE_REVISION = `partbench-source-v1:${"2".repeat(64)}`;

describe("V19 MCP adapter parity", () => {
  it("publishes typed curve and region discovery tools with boundary notes", () => {
    const tools = createCadMcpServer().listTools().tools;

    expect(tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        "cad.sketch_curve_edit_readiness",
        "cad.sketch_profile_region_candidates",
        "cad.sketch_profile_region_validate"
      ])
    );
    expect(
      tools.find((tool) => tool.name === "cad.sketch_curve_edit_readiness")
        ?.description
    ).toContain("non-associative offset");
    expect(
      tools.find((tool) => tool.name === "cad.sketch_profile_region_candidates")
        ?.description
    ).toContain("derived");
    const curveSchema = tools.find(
      (tool) => tool.name === "cad.sketch_curve_edit_readiness"
    )?.inputSchema;
    expect(curveSchema).toMatchObject({
      additionalProperties: false,
      required: ["proposal"],
      properties: {
        proposal: {
          oneOf: expect.arrayContaining([
            expect.objectContaining({
              required: ["kind", "sketchId", "entityId", "splitPoints"]
            })
          ])
        }
      }
    });
    const regionSchema = tools.find(
      (tool) => tool.name === "cad.sketch_profile_region_validate"
    )?.inputSchema;
    expect(regionSchema).toMatchObject({
      properties: {
        profile: {
          additionalProperties: false,
          properties: {
            regions: {
              items: expect.objectContaining({
                additionalProperties: false,
                required: ["outer", "holes"]
              })
            }
          }
        }
      }
    });
  });

  it("passes valid V19 query shapes through with the original query identity", () => {
    const adapter = createCadOpsAgentAdapter();
    vi.spyOn(adapter, "query").mockImplementation((request) => ({
      ok: false,
      requestId: request.requestId,
      adapterVersion: request.adapterVersion,
      cadOpsVersion: "cadops.v1",
      query: request.query.query.query,
      error: {
        code: "UNKNOWN_QUERY",
        message: "Slice-specific query implementation is not installed."
      }
    }));
    const server = createCadMcpServer({ adapter });
    const calls = [
      {
        name: "cad.sketch_curve_edit_readiness",
        arguments: {
          proposal: {
            kind: "split",
            sketchId: "sketch_1",
            entityId: "line_1",
            splitPoints: [[5, 0]]
          }
        },
        query: "sketch.curveEditReadiness"
      },
      {
        name: "cad.sketch_profile_region_candidates",
        arguments: {
          sketchId: "sketch_1",
          limit: 10,
          afterCandidateKey: "candidate_1",
          sourceRevision: SOURCE_REVISION
        },
        query: "sketch.profileRegionCandidates"
      },
      {
        name: "cad.sketch_profile_region_validate",
        arguments: {
          profile: {
            kind: "regions",
            sketchId: "sketch_1",
            regions: [
              {
                outer: { kind: "entity", entityId: "circle_outer" },
                holes: []
              }
            ]
          }
        },
        query: "sketch.profileRegionValidate"
      }
    ] as const;

    for (const call of calls) {
      const result = server.callTool({
        name: call.name,
        arguments: call.arguments,
        requestId: `request_${call.query}`
      });
      expect(result.structuredContent).toMatchObject({
        query: call.query
      });
    }
  });

  it("rejects malformed V19 query and mutation shapes as invalid arguments", () => {
    const server = createCadMcpServer();
    const malformedQuery = server.callTool({
      name: "cad.sketch_profile_region_candidates",
      arguments: {
        sketchId: "sketch_1",
        afterCandidateKey: "opaque_without_revision"
      }
    });
    expect(malformedQuery).toMatchObject({
      isError: true,
      structuredContent: {
        ok: false,
        error: { code: "INVALID_ARGUMENTS" }
      }
    });

    const malformedBatch = server.callTool({
      name: "cad.batch",
      arguments: {
        batch: {
          version: "cadops.v1",
          mode: "dryRun",
          ops: [
            {
              op: "sketch.dimension.update",
              id: "dimension_1",
              target: {
                kind: "pointPair",
                primary: {
                  kind: "entityPoint",
                  entityId: "line_1",
                  role: "start"
                },
                secondary: {
                  kind: "entityPoint",
                  entityId: "line_2",
                  role: "end"
                },
                measurement: "horizontal"
              },
              value: 2
            }
          ]
        }
      }
    });
    expect(malformedBatch).toMatchObject({
      isError: true,
      structuredContent: {
        ok: false,
        error: { code: "INVALID_ARGUMENTS" }
      }
    });

    for (const arguments_ of [
      {
        batch: { version: "cadops.v1", mode: "dryRun", ops: [] },
        allowCommit: "true"
      },
      {
        batch: { version: "cadops.v1", mode: "dryRun", ops: [] },
        actor: { type: "robot" }
      },
      {
        batch: { version: "cadops.v1", mode: "dryRun", ops: [] },
        screenshot: true
      }
    ]) {
      expect(
        server.callTool({
          name: "cad.batch",
          arguments: arguments_
        })
      ).toMatchObject({
        isError: true,
        structuredContent: {
          ok: false,
          error: { code: "INVALID_ARGUMENTS" }
        }
      });
    }
  });
});
