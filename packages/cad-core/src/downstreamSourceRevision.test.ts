import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { CadOp } from "@web-cad/cad-protocol";
import {
  CadEngine,
  createCadProjectSourceIdentity,
  exportCadProject
} from "./index";

const plate = JSON.parse(
  readFileSync(
    new URL(
      "../../../examples/agent-runtime/mounting-plate.json",
      import.meta.url
    ),
    "utf8"
  )
) as { create: CadOp[]; revise: CadOp[] };

describe("source revisions through downstream feature chains", () => {
  it("rejects a source profile change that invalidates a downstream edge", () => {
    const engine = new CadEngine();
    engine.applyBatch([
      ...plate.create,
      {
        op: "sketch.create",
        id: "replacement_sketch",
        name: "Round replacement",
        plane: "XY"
      },
      {
        op: "sketch.addCircle",
        sketchId: "replacement_sketch",
        id: "replacement_circle",
        center: [0, 0],
        radius: 20
      }
    ]);
    const before = createCadProjectSourceIdentity(exportCadProject(engine));
    const historyCount = engine.getTransactions().length;
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: {
          query: "feature.editability",
          featureId: "base_extrude",
          proposedEdit: {
            kind: "extrude",
            profile: {
              kind: "entity",
              sketchId: "replacement_sketch",
              entityId: "replacement_circle"
            }
          }
        }
      })
    ).toMatchObject({ status: "editable", dryRun: { status: "blocked" } });
    for (const mode of ["dryRun", "commit"] as const) {
      const result = engine.executeBatch({
        version: "cadops.v1",
        mode,
        ops: [
          {
            op: "feature.updateExtrude",
            id: "base_extrude",
            profile: {
              kind: "entity",
              sketchId: "replacement_sketch",
              entityId: "replacement_circle"
            }
          }
        ]
      });
      expect(result).toMatchObject({
        ok: false,
        error: { code: "GENERATED_REFERENCE_NOT_FOUND" }
      });
      expect(createCadProjectSourceIdentity(exportCadProject(engine))).toEqual(
        before
      );
      expect(engine.getTransactions()).toHaveLength(historyCount);
    }
  });

  it("revises a filleted, drilled, patterned extrude with complete diffs and truthful editability", () => {
    const engine = new CadEngine();
    expect(
      engine.executeBatch({
        version: "cadops.v1",
        mode: "commit",
        ops: plate.create
      }).ok
    ).toBe(true);
    const before = exportCadProject(engine);
    const beforeDocument = engine.getDocument();
    const identity = createCadProjectSourceIdentity(before);
    const historyCount = engine.getTransactions().length;
    const featureIds = [
      "base_extrude",
      "base_fillet",
      "mounting_hole",
      "hole_pattern"
    ];
    const bodyIds = ["base", "rounded_base", "drilled_base", "patterned_base"];
    const editability = engine.executeQuery({
      version: "cadops.v1",
      query: {
        query: "feature.editability",
        featureId: "base_extrude",
        proposedEdit: { kind: "extrude", depth: 6 }
      }
    });
    expect(editability).toMatchObject({
      status: "editable",
      dryRun: { status: "valid" },
      affected: { featureIds, bodyIds }
    });
    expect(createCadProjectSourceIdentity(exportCadProject(engine))).toEqual(
      identity
    );
    expect(engine.getTransactions()).toHaveLength(historyCount);

    const dryRun = engine.executeBatch({
      version: "cadops.v1",
      mode: "dryRun",
      ops: plate.revise
    });
    expect(dryRun).toMatchObject({
      ok: true,
      modifiedFeatureIds: expect.arrayContaining(featureIds),
      modifiedBodyIds: expect.arrayContaining(bodyIds)
    });
    expect(createCadProjectSourceIdentity(exportCadProject(engine))).toEqual(
      identity
    );

    const committed = engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: plate.revise
    });
    expect(committed).toMatchObject({
      ok: true,
      modifiedFeatureIds: expect.arrayContaining(featureIds),
      modifiedBodyIds: expect.arrayContaining(bodyIds)
    });
    const effects =
      engine.getTransactions().at(-1)!.diff.features!.lifecycleEffects ?? [];
    for (const bodyId of bodyIds.slice(0, -1)) {
      expect(effects.filter((effect) => effect.bodyId === bodyId)).toEqual([
        expect.objectContaining({
          primaryState: "consumed",
          states: expect.arrayContaining(["consumed"])
        })
      ]);
    }
    expect(effects).toContainEqual(
      expect.objectContaining({
        bodyId: "patterned_base",
        states: expect.arrayContaining(["active", "replacement"])
      })
    );
    const revised = exportCadProject(engine);
    const revisedDocument = engine.getDocument();
    const reopened = CadEngine.fromProject(revised);
    expect(createCadProjectSourceIdentity(exportCadProject(reopened))).toEqual(
      createCadProjectSourceIdentity(revised)
    );
    engine.undo();
    expect(engine.getDocument()).toEqual(beforeDocument);
    engine.redo();
    expect(engine.getDocument()).toEqual(revisedDocument);
  });

  it("rejects invalid downstream source references without altering history or identity", () => {
    const engine = new CadEngine();
    const ops = plate.create.flatMap((op): CadOp[] =>
      op.op === "feature.fillet"
        ? [
            {
              op: "reference.nameGenerated",
              name: "Rounded edge",
              bodyId: "base",
              stableId: "generated:edge:base:start:uMax"
            },
            {
              op: "feature.fillet",
              id: "base_fillet",
              bodyId: "rounded_base",
              targetBodyId: "base",
              namedReference: "Rounded edge",
              radius: 1
            }
          ]
        : [op]
    );
    expect(
      engine.executeBatch({ version: "cadops.v1", mode: "commit", ops }).ok
    ).toBe(true);
    engine.apply({ op: "reference.deleteName", name: "Rounded edge" });
    const before = createCadProjectSourceIdentity(exportCadProject(engine));
    const historyCount = engine.getTransactions().length;
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: { query: "feature.editability", featureId: "base_extrude" }
      })
    ).toMatchObject({ status: "blocked" });
    expect(
      engine.executeBatch({
        version: "cadops.v1",
        mode: "commit",
        ops: plate.revise
      })
    ).toMatchObject({
      ok: false,
      error: { code: "NAMED_REFERENCE_NOT_FOUND" }
    });
    expect(createCadProjectSourceIdentity(exportCadProject(engine))).toEqual(
      before
    );
    expect(engine.getTransactions()).toHaveLength(historyCount);
  });
});
