import { describe, expect, it } from "vitest";

import {
  CadOpsAgentAdapter,
  createV17AdapterCompositeParityFixture
} from "./index";

function executeBatch(
  adapter: CadOpsAgentAdapter,
  requestId: string,
  mode: "dryRun" | "commit",
  ops: readonly unknown[]
) {
  return JSON.parse(
    adapter.executeJson(
      JSON.stringify({
        requestId,
        adapterVersion: "web-cad.agent-adapter.v1",
        ...(mode === "commit" ? { permissions: { allowCommit: true } } : {}),
        batch: { version: "cadops.v1", mode, ops }
      })
    )
  ) as Record<string, unknown>;
}

describe("V17 curved sweep and normalized loft agent parity", () => {
  it("passes create/update/query evidence and cad-core ambiguity diagnostics", () => {
    const adapter = new CadOpsAgentAdapter();
    const fixture = createV17AdapterCompositeParityFixture("agent_v17");
    for (const [index, ops] of fixture.setupBatches.entries()) {
      expect(
        executeBatch(adapter, `agent_v17_setup_${index}`, "commit", ops)
      ).toMatchObject({ ok: true });
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
      const dryRun = executeBatch(adapter, `agent_v17_${label}_dry`, "dryRun", [
        operation
      ]);
      const commit = executeBatch(
        adapter,
        `agent_v17_${label}_commit`,
        "commit",
        [operation]
      );
      for (const response of [dryRun, commit]) {
        expect(response).toMatchObject({
          ok: true,
          createdFeatureIds: [featureId],
          createdBodyIds: [bodyId]
        });
      }
      expect(dryRun.semanticDiff).toEqual(commit.semanticDiff);
    }

    for (const [label, operation, featureId] of [
      ["sweep", fixture.sweepUpdate, fixture.ids.sweepFeature],
      ["loft", fixture.loftUpdate, fixture.ids.loftFeature]
    ] as const) {
      const dryRun = executeBatch(
        adapter,
        `agent_v17_${label}_update_dry`,
        "dryRun",
        [operation]
      );
      const commit = executeBatch(
        adapter,
        `agent_v17_${label}_update_commit`,
        "commit",
        [operation]
      );
      for (const response of [dryRun, commit]) {
        expect(response).toMatchObject({
          ok: true,
          modifiedFeatureIds: [featureId]
        });
      }
      expect(dryRun.semanticDiff).toEqual(commit.semanticDiff);
    }

    const structure = JSON.parse(
      adapter.queryJson(
        JSON.stringify({
          requestId: "agent_v17_structure",
          adapterVersion: "web-cad.agent-adapter.v1",
          query: {
            version: "cadops.v1",
            query: { query: "project.structure" }
          }
        })
      )
    );
    expect(structure).toMatchObject({
      ok: true,
      features: expect.arrayContaining([
        expect.objectContaining({
          id: fixture.ids.sweepFeature,
          profile: expect.objectContaining({
            entityId: fixture.ids.sweepRetargetProfile
          }),
          path: expect.objectContaining({
            kind: "chain",
            segments: [
              expect.objectContaining({
                entityId: fixture.ids.tail,
                orientation: "reverse"
              }),
              expect.objectContaining({ entityId: fixture.ids.bend }),
              expect.objectContaining({ entityId: fixture.ids.lead })
            ]
          })
        }),
        expect.objectContaining({
          id: fixture.ids.loftFeature,
          sections: [
            expect.any(Object),
            expect.objectContaining({
              entityId: fixture.ids.topRectangle
            })
          ]
        })
      ])
    });

    for (const [label, operation] of [
      ["sweep", fixture.mixedSweep],
      ["loft", fixture.mixedLoft]
    ] as const) {
      expect(
        executeBatch(adapter, `agent_v17_mixed_${label}`, "dryRun", [operation])
      ).toMatchObject({
        ok: false,
        error: {
          code: "COMMAND_INPUT_AMBIGUOUS",
          path: `$.ops[0].${label === "sweep" ? "profile" : "sections"}`
        }
      });
    }
  });
});
