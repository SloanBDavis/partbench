import { describe, expect, it } from "vitest";

import { createV17AdapterCompositeParityFixture } from "@web-cad/mcp-adapter";
import { createMcpStdioSession } from "./index";

describe("V17 curved sweep and normalized loft stdio parity", () => {
  it("passes JSON-RPC create/update/query evidence and ambiguity diagnostics", () => {
    const session = createMcpStdioSession();
    const fixture = createV17AdapterCompositeParityFixture("stdio_v17");
    const call = (id: string, name: string, argumentsValue: unknown = {}) => {
      const line = session.handleLine(
        JSON.stringify({
          jsonrpc: "2.0",
          id,
          method: "tools/call",
          params: { name, arguments: argumentsValue }
        })
      );
      if (!line) throw new Error("Expected JSON-RPC response.");
      return JSON.parse(line) as Record<string, unknown>;
    };
    const batch = (
      id: string,
      mode: "dryRun" | "commit",
      ops: readonly unknown[]
    ) =>
      call(id, "cad.batch", {
        ...(mode === "commit" ? { allowCommit: true } : {}),
        batch: { version: "cadops.v1", mode, ops }
      });

    for (const [index, ops] of fixture.setupBatches.entries()) {
      expect(batch(`stdio_v17_setup_${index}`, "commit", ops)).toMatchObject({
        jsonrpc: "2.0",
        result: { isError: false, structuredContent: { ok: true } }
      });
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
      const dryRun = batch(`stdio_v17_${label}_dry`, "dryRun", [operation]);
      const commit = batch(`stdio_v17_${label}_commit`, "commit", [operation]);
      for (const response of [dryRun, commit]) {
        expect(response).toMatchObject({
          jsonrpc: "2.0",
          result: {
            isError: false,
            structuredContent: {
              ok: true,
              createdFeatureIds: [featureId],
              createdBodyIds: [bodyId]
            }
          }
        });
      }
      expect(dryRun).toMatchObject({
        result: { structuredContent: { semanticDiff: expect.any(Object) } }
      });
      expect(commit).toMatchObject({
        result: { structuredContent: { semanticDiff: expect.any(Object) } }
      });
    }

    for (const [label, operation, featureId] of [
      ["sweep", fixture.sweepUpdate, fixture.ids.sweepFeature],
      ["loft", fixture.loftUpdate, fixture.ids.loftFeature]
    ] as const) {
      for (const [mode, suffix] of [
        ["dryRun", "dry"],
        ["commit", "commit"]
      ] as const) {
        expect(
          batch(`stdio_v17_${label}_update_${suffix}`, mode, [operation])
        ).toMatchObject({
          jsonrpc: "2.0",
          result: {
            isError: false,
            structuredContent: {
              ok: true,
              modifiedFeatureIds: [featureId],
              semanticDiff: expect.any(Object)
            }
          }
        });
      }
    }

    expect(call("stdio_v17_structure", "cad.project_structure")).toMatchObject({
      jsonrpc: "2.0",
      result: {
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
      }
    });

    for (const [label, operation] of [
      ["sweep", fixture.mixedSweep],
      ["loft", fixture.mixedLoft]
    ] as const) {
      expect(
        batch(`stdio_v17_mixed_${label}`, "dryRun", [operation])
      ).toMatchObject({
        jsonrpc: "2.0",
        result: {
          isError: true,
          structuredContent: {
            ok: false,
            error: {
              code: "COMMAND_INPUT_AMBIGUOUS",
              path: `$.ops[0].${label === "sweep" ? "profile" : "sections"}`
            }
          }
        }
      });
    }
  });
});
