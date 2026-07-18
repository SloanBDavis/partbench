import { describe, expect, it } from "vitest";

import { CadMcpServer, createV17AdapterCompositeParityFixture } from "./index";

function callBatch(
  server: CadMcpServer,
  requestId: string,
  mode: "dryRun" | "commit",
  ops: readonly unknown[]
) {
  return server.callTool({
    name: "cad.batch",
    requestId,
    arguments: {
      ...(mode === "commit" ? { allowCommit: true } : {}),
      batch: { version: "cadops.v1", mode, ops }
    }
  });
}

describe("V17 curved sweep and normalized loft MCP parity", () => {
  it("passes create/update/query evidence and cad-core ambiguity diagnostics", () => {
    const server = new CadMcpServer();
    const fixture = createV17AdapterCompositeParityFixture("mcp_v17");
    for (const [index, ops] of fixture.setupBatches.entries()) {
      expect(
        callBatch(server, `mcp_v17_setup_${index}`, "commit", ops)
      ).toMatchObject({ isError: false, structuredContent: { ok: true } });
    }

    for (const [label, operation, featureId, bodyId] of [
      [
        "sweep",
        fixture.sweepCreate,
        fixture.ids.sweepFeature,
        fixture.ids.sweepBody
      ],
      [
        "loft",
        fixture.loftCreate,
        fixture.ids.loftFeature,
        fixture.ids.loftBody
      ]
    ] as const) {
      const dryRun = callBatch(server, `mcp_v17_${label}_dry`, "dryRun", [
        operation
      ]);
      const commit = callBatch(server, `mcp_v17_${label}_commit`, "commit", [
        operation
      ]);
      for (const response of [dryRun, commit]) {
        expect(response).toMatchObject({
          isError: false,
          structuredContent: {
            ok: true,
            createdFeatureIds: [featureId],
            createdBodyIds: [bodyId]
          }
        });
      }
      expect(
        (dryRun.structuredContent as { semanticDiff?: unknown }).semanticDiff
      ).toEqual(
        (commit.structuredContent as { semanticDiff?: unknown }).semanticDiff
      );
    }

    for (const [label, operation, featureId] of [
      ["sweep", fixture.sweepUpdate, fixture.ids.sweepFeature],
      ["loft", fixture.loftUpdate, fixture.ids.loftFeature]
    ] as const) {
      const dryRun = callBatch(
        server,
        `mcp_v17_${label}_update_dry`,
        "dryRun",
        [operation]
      );
      const commit = callBatch(
        server,
        `mcp_v17_${label}_update_commit`,
        "commit",
        [operation]
      );
      for (const response of [dryRun, commit]) {
        expect(response).toMatchObject({
          isError: false,
          structuredContent: {
            ok: true,
            modifiedFeatureIds: [featureId]
          }
        });
      }
      expect(
        (dryRun.structuredContent as { semanticDiff?: unknown }).semanticDiff
      ).toEqual(
        (commit.structuredContent as { semanticDiff?: unknown }).semanticDiff
      );
    }

    expect(
      server.callTool({
        name: "cad.project_structure",
        requestId: "mcp_v17_structure",
        arguments: {}
      })
    ).toMatchObject({
      isError: false,
      structuredContent: {
        ok: true,
        features: expect.arrayContaining([
          expect.objectContaining({
            id: fixture.ids.sweepFeature,
            profileEntityId: fixture.ids.sweepRetargetProfile,
            pathEntityIds: [
              fixture.ids.tail,
              fixture.ids.bend,
              fixture.ids.lead
            ]
          }),
          expect.objectContaining({
            id: fixture.ids.loftFeature,
            sections: [
              expect.any(Object),
              expect.objectContaining({ entityId: fixture.ids.topRectangle })
            ]
          })
        ])
      }
    });

    for (const [label, operation] of [
      ["sweep", fixture.mixedSweep],
      ["loft", fixture.mixedLoft]
    ] as const) {
      expect(
        callBatch(server, `mcp_v17_mixed_${label}`, "dryRun", [operation])
      ).toMatchObject({
        isError: true,
        structuredContent: {
          ok: false,
          error: {
            code: "COMMAND_INPUT_AMBIGUOUS",
            path: `$.ops[0].${label === "sweep" ? "profile" : "sections"}`
          }
        }
      });
    }
  });
});
