import { describe, expect, it } from "vitest";
import type {
  CadBatchResponse,
  SketchAddRoundedRectangleOp,
  SketchAddSlotOp
} from "@web-cad/cad-protocol";

import {
  CadEngine,
  CadProjectImportError,
  exportCadProject,
  exportCadProjectJson,
  exportCadProjectWcad,
  importCadProject,
  importCadProjectJson,
  importCadProjectWcad,
  planSketchRoundedRectangle,
  planSketchSlot,
  type CadProject,
  type SketchConveniencePlan
} from "./index";

type ConvenienceOp = SketchAddSlotOp | SketchAddRoundedRectangleOp;

const slotConstraintIds = Array.from(
  { length: 9 },
  (_, index) => `slot_constraint_${index + 1}`
) as unknown as NonNullable<SketchAddSlotOp["constraintIds"]>;

const roundedConstraintIds = Array.from(
  { length: 23 },
  (_, index) => `rounded_constraint_${index + 1}`
) as unknown as NonNullable<SketchAddRoundedRectangleOp["constraintIds"]>;

function createSketchEngine(secondSketch = false): CadEngine {
  const engine = new CadEngine();
  engine.applyBatch([
    {
      op: "sketch.create",
      id: "sketch_1",
      name: "Convenience",
      plane: "XY"
    },
    ...(secondSketch
      ? [
          {
            op: "sketch.create" as const,
            id: "sketch_2",
            name: "Other",
            plane: "XY" as const
          }
        ]
      : [])
  ]);
  return engine;
}

function slotOp(overrides: Partial<SketchAddSlotOp> = {}): SketchAddSlotOp {
  return {
    op: "sketch.addSlot",
    sketchId: "sketch_1",
    centerlineStart: [0, 0],
    centerlineEnd: [10, 0],
    radius: 2,
    ...overrides
  };
}

function roundedOp(
  overrides: Partial<SketchAddRoundedRectangleOp> = {}
): SketchAddRoundedRectangleOp {
  return {
    op: "sketch.addRoundedRectangle",
    sketchId: "sketch_1",
    center: [0, 0],
    width: 12,
    height: 8,
    cornerRadius: 2,
    ...overrides
  };
}

function expectSuccessfulBatch(
  response: CadBatchResponse
): Extract<CadBatchResponse, { readonly ok: true }> {
  expect(response.ok).toBe(true);
  if (!response.ok) throw new Error(JSON.stringify(response.error));
  return response;
}

function getMaterializedPlan(op: ConvenienceOp): SketchConveniencePlan {
  const result =
    op.op === "sketch.addSlot"
      ? planSketchSlot(op)
      : planSketchRoundedRectangle(op);
  expect(result.status).toBe("ready");
  if (result.status !== "ready") {
    throw new Error(JSON.stringify(result.diagnostics));
  }
  expect(result.plan.materialized).toBeDefined();
  return result.plan;
}

describe("V19 sketch convenience command engine", () => {
  it.each([
    {
      label: "slot",
      op: slotOp({ construction: true }),
      operation: "slot" as const,
      entityCount: 4,
      constraintCount: 9
    },
    {
      label: "rounded rectangle",
      op: roundedOp({ construction: true }),
      operation: "roundedRectangle" as const,
      entityCount: 8,
      constraintCount: 23
    }
  ])(
    "materializes $label with exact geometry/order, dry-run parity, diffs, and healthy solver source",
    ({ op, operation, entityCount, constraintCount }) => {
      const engine = createSketchEngine();
      const dryRun = expectSuccessfulBatch(
        engine.executeBatch({
          version: "cadops.v1",
          mode: "dryRun",
          ops: [op]
        })
      );
      const committed = expectSuccessfulBatch(
        engine.executeBatch({
          version: "cadops.v1",
          mode: "commit",
          ops: [op]
        })
      );
      expect(committed.semanticDiff).toEqual(dryRun.semanticDiff);

      const transaction = engine.getTransactions().at(-1)!;
      expect(transaction.ops).toHaveLength(1);
      const appliedOp = transaction.ops[0] as ConvenienceOp;
      expect(appliedOp.entityIds).toHaveLength(entityCount);
      expect(appliedOp.constraintIds).toHaveLength(constraintCount);
      const plan = getMaterializedPlan(appliedOp);

      const document = engine.getDocument();
      const entities = [
        ...document.sketches.get("sketch_1")!.entities.values()
      ];
      const constraints = [...document.sketchConstraints.values()];
      expect(entities).toEqual(plan.materialized!.entities);
      expect(entities.every((entity) => entity.construction)).toBe(true);
      expect(constraints.map((constraint) => constraint.id)).toEqual(
        appliedOp.constraintIds
      );
      expect(constraints.map((constraint) => constraint.kind)).toEqual(
        plan.materialized!.constraintOps.map((constraint) => constraint.kind)
      );

      expect(
        transaction.diff.sketches?.entitiesCreated?.map(({ id }) => id)
      ).toEqual(appliedOp.entityIds);
      expect(
        transaction.diff.sketchConstraints?.created?.map(({ id }) => id)
      ).toEqual(appliedOp.constraintIds);
      expect(transaction.diff.sketches?.convenienceOperations).toEqual([
        {
          opIndex: 0,
          sketchId: "sketch_1",
          operation,
          createdEntityIds: appliedOp.entityIds,
          createdConstraintIds: appliedOp.constraintIds
        }
      ]);

      const solver = engine.executeQuery({
        version: "cadops.v1",
        query: { query: "sketch.solverStatus", sketchId: "sketch_1" }
      });
      expect(solver).toMatchObject({
        ok: true,
        query: "sketch.solverStatus"
      });
      if (!solver.ok || solver.query !== "sketch.solverStatus") return;
      expect(["fully-defined", "under-defined"]).toContain(solver.status);
      expect(["converged", "under-defined"]).toContain(
        solver.solver.numericalSolverStatus
      );
    }
  );

  it("preserves supplied tuples, actor/audit metadata, and one-step undo/redo", () => {
    const engine = createSketchEngine();
    const entityIds = [
      "slot_side_positive",
      "slot_end_cap",
      "slot_side_negative",
      "slot_start_cap"
    ] as const;
    const response = expectSuccessfulBatch(
      engine.executeBatch({
        version: "cadops.v1",
        mode: "commit",
        actor: { type: "agent", id: "agent-c3", name: "C3 verifier" },
        audit: {
          intent: "commit",
          operationCount: 1,
          source: "v19-c3-test",
          requestId: "request-c3",
          toolName: "sketch.addSlot"
        },
        ops: [
          slotOp({
            entityIds,
            constraintIds: slotConstraintIds
          })
        ]
      })
    );

    expect(response.actor).toEqual({
      type: "agent",
      id: "agent-c3",
      name: "C3 verifier"
    });
    expect(response.audit).toMatchObject({
      intent: "commit",
      operationCount: 1,
      source: "v19-c3-test",
      requestId: "request-c3",
      toolName: "sketch.addSlot"
    });
    expect(engine.getTransactions().at(-1)?.ops[0]).toMatchObject({
      op: "sketch.addSlot",
      entityIds,
      constraintIds: slotConstraintIds
    });

    const beforeUndo = exportCadProjectJson(engine);
    expect(engine.undo()).toBeDefined();
    expect(engine.getDocument().sketches.get("sketch_1")?.entities.size).toBe(
      0
    );
    expect(engine.getDocument().sketchConstraints.size).toBe(0);
    expect(engine.redo()).toBeDefined();
    expect(exportCadProjectJson(engine)).toBe(beforeUndo);
  });

  it("defensively snapshots caller-owned geometry and ID arrays before history storage", () => {
    const engine = createSketchEngine();
    const centerlineStart: [number, number] = [0, 0];
    const centerlineEnd: [number, number] = [10, 0];
    const entityIds = [
      "mutable_slot_side_positive",
      "mutable_slot_end_cap",
      "mutable_slot_side_negative",
      "mutable_slot_start_cap"
    ];
    const constraintIds = Array.from(
      { length: 9 },
      (_, index) => `mutable_slot_constraint_${index + 1}`
    );
    engine.apply(
      slotOp({
        centerlineStart,
        centerlineEnd,
        entityIds: entityIds as unknown as NonNullable<
          SketchAddSlotOp["entityIds"]
        >,
        constraintIds: constraintIds as unknown as NonNullable<
          SketchAddSlotOp["constraintIds"]
        >
      })
    );

    const storedOpBefore = JSON.stringify(
      engine.getTransactions().at(-1)!.ops[0]
    );
    const diffBefore = JSON.stringify(engine.getTransactions().at(-1)!.diff);
    const documentBefore = JSON.stringify([
      ...engine.getDocument().sketches.get("sketch_1")!.entities.values()
    ]);
    const exportBefore = exportCadProjectJson(engine);

    centerlineStart[0] = 999;
    centerlineEnd[1] = 999;
    entityIds[0] = "mutated_entity_id";
    constraintIds[0] = "mutated_constraint_id";

    expect(JSON.stringify(engine.getTransactions().at(-1)!.ops[0])).toBe(
      storedOpBefore
    );
    expect(JSON.stringify(engine.getTransactions().at(-1)!.diff)).toBe(
      diffBefore
    );
    expect(
      JSON.stringify([
        ...engine.getDocument().sketches.get("sketch_1")!.entities.values()
      ])
    ).toBe(documentBefore);
    expect(exportCadProjectJson(engine)).toBe(exportBefore);
    expect(exportCadProjectJson(importCadProjectJson(exportBefore))).toBe(
      exportBefore
    );

    const roundedEngine = createSketchEngine();
    const center: [number, number] = [3, 4];
    const roundedEntityIds = Array.from(
      { length: 8 },
      (_, index) => `mutable_rounded_entity_${index + 1}`
    );
    const roundedIds = Array.from(
      { length: 23 },
      (_, index) => `mutable_rounded_constraint_${index + 1}`
    );
    roundedEngine.apply(
      roundedOp({
        center,
        entityIds: roundedEntityIds as unknown as NonNullable<
          SketchAddRoundedRectangleOp["entityIds"]
        >,
        constraintIds: roundedIds as unknown as NonNullable<
          SketchAddRoundedRectangleOp["constraintIds"]
        >
      })
    );
    const roundedExportBefore = exportCadProjectJson(roundedEngine);
    center[0] = -999;
    roundedEntityIds[0] = "mutated_rounded_entity";
    roundedIds[0] = "mutated_rounded_constraint";
    expect(exportCadProjectJson(roundedEngine)).toBe(roundedExportBefore);
    expect(
      exportCadProjectJson(importCadProjectJson(roundedExportBefore))
    ).toBe(roundedExportBefore);
  });

  it("rejects geometry and document-wide supplied-ID collisions atomically without burning generated counters", () => {
    const engine = createSketchEngine(true);
    engine.apply({
      op: "sketch.addLine",
      sketchId: "sketch_2",
      id: "foreign_entity",
      start: [0, 0],
      end: [1, 0]
    });
    engine.apply({
      op: "sketch.constraint.create",
      id: "foreign_constraint",
      name: "Foreign horizontal",
      sketchId: "sketch_2",
      kind: "horizontal",
      entityId: "foreign_entity"
    });
    const beforeCollision = exportCadProjectJson(engine);
    const collision = engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        slotOp({
          entityIds: ["slot_a", "foreign_entity", "slot_c", "slot_d"],
          constraintIds: slotConstraintIds
        })
      ]
    });
    expect(collision.ok).toBe(false);
    expect(exportCadProjectJson(engine)).toBe(beforeCollision);

    const constraintCollision = engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        slotOp({
          entityIds: ["slot_a", "slot_b", "slot_c", "slot_d"],
          constraintIds: [
            "slot_constraint_1",
            "foreign_constraint",
            "slot_constraint_3",
            "slot_constraint_4",
            "slot_constraint_5",
            "slot_constraint_6",
            "slot_constraint_7",
            "slot_constraint_8",
            "slot_constraint_9"
          ]
        })
      ]
    });
    expect(constraintCollision.ok).toBe(false);
    expect(exportCadProjectJson(engine)).toBe(beforeCollision);

    const fresh = createSketchEngine();
    const beforeInvalid = exportCadProjectJson(fresh);
    const invalid = fresh.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        slotOp({
          centerlineEnd: [0, 0]
        })
      ]
    });
    expect(invalid.ok).toBe(false);
    expect(exportCadProjectJson(fresh)).toBe(beforeInvalid);

    expectSuccessfulBatch(
      fresh.executeBatch({
        version: "cadops.v1",
        mode: "commit",
        ops: [slotOp()]
      })
    );
    const applied = fresh.getTransactions().at(-1)!.ops[0];
    expect(applied).toMatchObject({
      op: "sketch.addSlot",
      entityIds: ["skent_1", "skent_2", "skent_3", "skent_4"],
      constraintIds: [
        "skcon_1",
        "skcon_2",
        "skcon_3",
        "skcon_4",
        "skcon_5",
        "skcon_6",
        "skcon_7",
        "skcon_8",
        "skcon_9"
      ]
    });
  });

  it("validates direct apply inputs and supplied tuple cardinality", () => {
    const engine = createSketchEngine();
    expect(() =>
      engine.apply({
        ...roundedOp(),
        width: Number.NaN
      })
    ).toThrow();
    expect(() =>
      engine.apply({
        ...slotOp(),
        entityIds: ["only-one"]
      } as unknown as SketchAddSlotOp)
    ).toThrow();
    expect(engine.getDocument().sketches.get("sketch_1")?.entities.size).toBe(
      0
    );
    expect(engine.getDocument().sketchConstraints.size).toBe(0);
  });

  it("round-trips materialized operations through JSON and canonical-CBOR WCAD", async () => {
    const engine = createSketchEngine();
    engine.apply(
      roundedOp({
        entityIds: [
          "rounded_top",
          "rounded_top_right",
          "rounded_right",
          "rounded_bottom_right",
          "rounded_bottom",
          "rounded_bottom_left",
          "rounded_left",
          "rounded_top_left"
        ],
        constraintIds: roundedConstraintIds
      })
    );
    const expected = exportCadProject(engine);

    const jsonEngine = importCadProjectJson(exportCadProjectJson(engine));
    expect(exportCadProject(jsonEngine)).toEqual(expected);

    const wcad = await exportCadProjectWcad(engine, {
      createdAt: "2026-07-26T00:00:00.000Z"
    });
    const wcadEngine = await importCadProjectWcad(wcad.bytes);
    expect(exportCadProject(wcadEngine)).toEqual(expected);
  });

  it.each(["history", "redoStack"] as const)(
    "rejects imported %s convenience operations missing materialized tuples",
    (location) => {
      const engine = createSketchEngine();
      engine.apply(slotOp());
      if (location === "redoStack") {
        engine.undo();
      }
      const corrupted = JSON.parse(
        JSON.stringify(exportCadProject(engine))
      ) as {
        history: Array<{ ops: Array<Record<string, unknown>> }>;
        redoStack: Array<{ ops: Array<Record<string, unknown>> }>;
      };
      const transaction = corrupted[location].at(-1)!;
      delete transaction.ops[0]!.entityIds;
      delete transaction.ops[0]!.constraintIds;

      expect(() =>
        importCadProject(corrupted as unknown as CadProject)
      ).toThrow(CadProjectImportError);
    }
  );
});
