import { describe, expect, it } from "vitest";
import { createCadMcpServer } from "./index";

describe("compact batch results", () => {
  it("preserves full defaults and bounds successful IDs/review with explicit totals", () => {
    const server = createCadMcpServer();
    const ops = Array.from({ length: 12 }, (_, index) => ({
      op: "parameter.create",
      id: `p_${index}`,
      name: `Parameter ${index}`,
      value: index
    }));
    const batch = { version: "cadops.v1", mode: "dryRun", ops };
    const full = server.callTool({
      name: "cad.batch",
      requestId: "same",
      arguments: { batch }
    });
    const summary = server.callTool({
      name: "cad.batch",
      requestId: "same",
      arguments: { batch, responseDetail: "summary" }
    });
    expect(full.structuredContent).toHaveProperty("semanticDiff");
    expect(full.structuredContent).not.toHaveProperty("responseDetail");
    expect(summary).toMatchObject({
      isError: false,
      structuredContent: {
        ok: true,
        responseDetail: "summary",
        mode: "dryRun",
        sampleLimit: 8,
        idChanges: {
          createdParameterIds: {
            total: 12,
            ids: ops.slice(0, 8).map((op) => op.id),
            truncated: true
          }
        },
        diffCounts: { parameters: { created: 12 } },
        review: {
          operationCount: 12,
          operationsTotal: 12,
          operationsTruncated: true
        }
      }
    });
    expect(summary.structuredContent).not.toHaveProperty("semanticDiff");
    if (
      !("review" in summary.structuredContent) ||
      !("review" in full.structuredContent)
    )
      throw new Error("Missing review");
    expect(summary.structuredContent.review.operations).toHaveLength(8);
    expect(summary.structuredContent.review.hints).toEqual(
      full.structuredContent.review.hints
    );
    expect(summary.structuredContent.review.blockers).toEqual(
      full.structuredContent.review.blockers
    );
    expect(summary.structuredContent).toMatchObject({
      warnings:
        "warnings" in full.structuredContent
          ? full.structuredContent.warnings
          : undefined
    });
    expect(
      server.callTool({
        name: "cad.batch",
        requestId: "same",
        arguments: { batch, responseDetail: "full" }
      })
    ).toEqual(full);
    expect(
      server.callTool({ name: "cad.parameter_list" }).structuredContent
    ).toMatchObject({ parameterCount: 0 });
  });
  it("keeps errors full and rejects summary/project handoff before execution", () => {
    const server = createCadMcpServer();
    const batch = {
      version: "cadops.v1",
      mode: "commit",
      ops: [{ op: "parameter.update", id: "missing", value: 1 }]
    };
    const full = server.callTool({
      name: "cad.batch",
      requestId: "same",
      arguments: { allowCommit: true, batch }
    });
    expect(full.isError).toBe(true);
    expect(
      server.callTool({
        name: "cad.batch",
        requestId: "same",
        arguments: { allowCommit: true, batch, responseDetail: "summary" }
      })
    ).toEqual(full);
    expect(
      server.callTool({
        name: "cad.batch",
        arguments: {
          batch,
          responseDetail: "summary",
          projectHandoff: { includeProjectJson: true }
        }
      })
    ).toMatchObject({
      isError: true,
      structuredContent: {
        error: {
          code: "INVALID_ARGUMENTS",
          diagnostics: expect.arrayContaining([
            expect.objectContaining({
              path: "$.projectHandoff",
              message: expect.stringContaining("responseDetail:'full'")
            })
          ])
        }
      }
    });
    expect(
      server.callTool({
        name: "cad.batch",
        arguments: { batch, responseDetail: "brief" }
      })
    ).toMatchObject({
      isError: true,
      structuredContent: {
        error: {
          diagnostics: expect.arrayContaining([
            expect.objectContaining({ path: "$.responseDetail" })
          ])
        }
      }
    });
  });
});
