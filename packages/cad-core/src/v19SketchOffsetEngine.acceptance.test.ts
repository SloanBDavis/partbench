import { describe, expect, it } from "vitest";

import type {
  CadBatchResponse,
  CadOp,
  SketchCurveEditProposal,
  SketchOffsetOp
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
  type CadProject
} from "./index";

type OffsetProposal = Extract<
  SketchCurveEditProposal,
  { readonly kind: "offset" }
>;

type ReadyOffset = Extract<
  ReturnType<CadEngine["executeQuery"]>,
  {
    readonly ok: true;
    readonly query: "sketch.curveEditReadiness";
    readonly status: "ready";
  }
>;

function expectSuccessfulBatch(
  response: CadBatchResponse
): Extract<CadBatchResponse, { readonly ok: true }> {
  expect(response.ok).toBe(true);
  if (!response.ok) throw new Error(JSON.stringify(response.error));
  return response;
}

function expectFailedBatch(
  response: CadBatchResponse,
  code: string
): Extract<CadBatchResponse, { readonly ok: false }> {
  expect(response.ok).toBe(false);
  if (response.ok) throw new Error("Expected failed CADOps batch.");
  expect(response.error.code).toBe(code);
  return response;
}

function offsetReadiness(
  engine: CadEngine,
  proposal: OffsetProposal
): ReadyOffset {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "sketch.curveEditReadiness", proposal }
  });
  expect(response).toMatchObject({
    ok: true,
    query: "sketch.curveEditReadiness",
    status: "ready",
    diagnostics: []
  });
  if (
    !response.ok ||
    response.query !== "sketch.curveEditReadiness" ||
    response.status !== "ready"
  ) {
    throw new Error(`Expected ready offset: ${JSON.stringify(response)}`);
  }
  expect(response.preparedOperation.op).toBe("sketch.offset");
  return response;
}

function preparedOffset(readiness: ReadyOffset): SketchOffsetOp & {
  readonly createdEntityIds: readonly string[];
} {
  if (readiness.preparedOperation.op !== "sketch.offset") {
    throw new Error("Expected a materialized sketch.offset operation.");
  }
  return readiness.preparedOperation;
}

function createOffsetEngine(): CadEngine {
  const engine = new CadEngine();
  const ops = [
    {
      op: "sketch.create",
      id: "sketch_1",
      name: "Offset acceptance",
      plane: "XY"
    },
    {
      op: "sketch.addLine",
      sketchId: "sketch_1",
      id: "line_source",
      start: [0, 0],
      end: [4, 0]
    },
    {
      op: "sketch.addCircle",
      sketchId: "sketch_1",
      id: "circle_source",
      center: [10, 0],
      radius: 2
    },
    {
      op: "sketch.addArc",
      sketchId: "sketch_1",
      id: "arc_source",
      definition: {
        kind: "centerAngles",
        center: [20, 0],
        radius: 3,
        startAngleDegrees: 0,
        sweepAngleDegrees: 90
      }
    },
    {
      op: "sketch.addRectangle",
      sketchId: "sketch_1",
      id: "rectangle_source",
      center: [30, 0],
      width: 6,
      height: 4
    },
    {
      op: "sketch.addLine",
      sketchId: "sketch_1",
      id: "open_a",
      start: [0, 10],
      end: [4, 10]
    },
    {
      op: "sketch.addLine",
      sketchId: "sketch_1",
      id: "open_b",
      start: [4, 10],
      end: [4, 13]
    },
    {
      op: "sketch.addLine",
      sketchId: "sketch_1",
      id: "closed_bottom",
      start: [40, 10],
      end: [44, 10]
    },
    {
      op: "sketch.addLine",
      sketchId: "sketch_1",
      id: "closed_right",
      start: [44, 10],
      end: [44, 14]
    },
    {
      op: "sketch.addLine",
      sketchId: "sketch_1",
      id: "closed_top",
      start: [44, 14],
      end: [40, 14]
    },
    {
      op: "sketch.addLine",
      sketchId: "sketch_1",
      id: "closed_left",
      start: [40, 14],
      end: [40, 10]
    }
  ] satisfies readonly CadOp[];
  engine.applyBatch(ops);
  return engine;
}

function lineProposal(overrides: Partial<OffsetProposal> = {}): OffsetProposal {
  return {
    kind: "offset",
    sketchId: "sketch_1",
    source: { kind: "entity", entityId: "line_source" },
    distance: 1,
    side: "left",
    ...overrides
  };
}

describe("V19 sketch offset vertical acceptance", () => {
  it("readies every individual source plus representative open and closed chains with ordered materialized previews", () => {
    const engine = createOffsetEngine();
    const cases: readonly {
      readonly label: string;
      readonly proposal: OffsetProposal;
      readonly count: number;
      readonly kinds: readonly string[];
    }[] = [
      {
        label: "line",
        proposal: lineProposal(),
        count: 1,
        kinds: ["line"]
      },
      {
        label: "circle",
        proposal: lineProposal({
          source: { kind: "entity", entityId: "circle_source" },
          side: "outward"
        }),
        count: 1,
        kinds: ["circle"]
      },
      {
        label: "arc",
        proposal: lineProposal({
          source: { kind: "entity", entityId: "arc_source" },
          side: "right"
        }),
        count: 1,
        kinds: ["arc"]
      },
      {
        label: "rectangle",
        proposal: lineProposal({
          source: { kind: "entity", entityId: "rectangle_source" },
          side: "inward",
          distance: 0.5
        }),
        count: 1,
        kinds: ["rectangle"]
      },
      {
        label: "open chain",
        proposal: lineProposal({
          source: {
            kind: "chain",
            segments: [
              { entityId: "open_a", orientation: "forward" },
              { entityId: "open_b", orientation: "forward" }
            ],
            closed: false
          }
        }),
        count: 2,
        kinds: ["line", "line"]
      },
      {
        label: "closed chain",
        proposal: lineProposal({
          source: {
            kind: "chain",
            segments: [
              { entityId: "closed_bottom", orientation: "forward" },
              { entityId: "closed_right", orientation: "forward" },
              { entityId: "closed_top", orientation: "forward" },
              { entityId: "closed_left", orientation: "forward" }
            ],
            closed: true
          },
          side: "inward",
          distance: 0.5
        }),
        count: 4,
        kinds: ["line", "line", "line", "line"]
      }
    ];

    for (const { label, proposal, count, kinds } of cases) {
      const ready = offsetReadiness(engine, proposal);
      const operation = preparedOffset(ready);
      expect(operation.createdEntityIds, label).toHaveLength(count);
      expect(ready.preview, label).toMatchObject({
        intersections: [],
        projectedSplitParameters: [],
        resultEntityCount: count
      });
      expect(
        ready.preview.resultEntities.map((entity) => entity.id),
        label
      ).toEqual(operation.createdEntityIds);
      expect(
        ready.preview.resultEntities.map((entity) => entity.kind),
        label
      ).toEqual(kinds);
      expect(new Set(operation.createdEntityIds).size, label).toBe(count);
    }
  });

  it("applies offset additively with empty replacement/record effects, ordinary created diffs, solver health, and dry-run parity", () => {
    const engine = createOffsetEngine();
    const sourceBefore = engine
      .getDocument()
      .sketches.get("sketch_1")!
      .entities.get("line_source");
    const entityCountBefore = engine.getDocument().sketches.get("sketch_1")!
      .entities.size;
    const constraintCountBefore = engine.getDocument().sketchConstraints.size;
    const dimensionCountBefore = engine.getDocument().sketchDimensions.size;
    const ready = offsetReadiness(engine, lineProposal());
    const operation = preparedOffset(ready);

    expect(ready.impact).toMatchObject({
      sketchId: "sketch_1",
      operation: "offset",
      replacements: [],
      constraintImpacts: [],
      dimensionImpacts: [],
      requiredDeleteConstraintIds: [],
      requiredDeleteDimensionIds: [],
      affectedFeatureIds: [],
      postEditSolverStatus: "not-run"
    });

    const dryRun = expectSuccessfulBatch(
      engine.executeBatch({
        version: "cadops.v1",
        mode: "dryRun",
        ops: [operation]
      })
    );
    const committed = expectSuccessfulBatch(
      engine.executeBatch({
        version: "cadops.v1",
        mode: "commit",
        ops: [operation]
      })
    );
    expect(committed.semanticDiff).toEqual(dryRun.semanticDiff);

    const document = engine.getDocument();
    const sketch = document.sketches.get("sketch_1")!;
    expect(sketch.entities.size).toBe(entityCountBefore + 1);
    expect(sketch.entities.get("line_source")).toEqual(sourceBefore);
    expect(document.sketchConstraints.size).toBe(constraintCountBefore);
    expect(document.sketchDimensions.size).toBe(dimensionCountBefore);
    const createdId = operation.createdEntityIds[0]!;
    expect(sketch.entities.get(createdId)).toEqual(
      ready.preview.resultEntities[0]
    );
    expect(Object.keys(sketch.entities.get(createdId)!).sort()).toEqual([
      "construction",
      "end",
      "id",
      "kind",
      "start"
    ]);

    const diff = engine.getTransactions().at(-1)!.diff;
    expect(diff.sketches?.curveEdits?.[0]).toMatchObject({
      opIndex: 0,
      sketchId: "sketch_1",
      operation: "offset",
      replacements: [],
      constraintImpacts: [],
      dimensionImpacts: [],
      requiredDeleteConstraintIds: [],
      requiredDeleteDimensionIds: [],
      affectedFeatureIds: [],
      createdEntityIds: operation.createdEntityIds,
      modifiedEntityIds: [],
      deletedEntityIds: [],
      retargetedConstraintIds: [],
      deletedConstraintIds: [],
      retargetedDimensionIds: [],
      deletedDimensionIds: [],
      postEditSolverStatus: "not-run"
    });
    expect(diff.sketches?.entitiesCreated?.map(({ id }) => id)).toEqual(
      operation.createdEntityIds
    );
    expect(diff.sketches?.entitiesModified ?? []).toEqual([]);
    expect(diff.sketches?.entitiesDeleted ?? []).toEqual([]);
    expect(diff.sketchConstraints).toBeUndefined();
    expect(diff.sketchDimensions).toBeUndefined();

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
  });

  it("honors generated and caller-supplied IDs in exact traversal order", () => {
    const generatedEngine = createOffsetEngine();
    const generated = preparedOffset(
      offsetReadiness(
        generatedEngine,
        lineProposal({
          source: {
            kind: "chain",
            segments: [
              { entityId: "open_a", orientation: "forward" },
              { entityId: "open_b", orientation: "forward" }
            ],
            closed: false
          }
        })
      )
    );
    expect(generated.createdEntityIds).toEqual(["skent_1", "skent_2"]);

    const suppliedEngine = createOffsetEngine();
    const prepared = preparedOffset(
      offsetReadiness(
        suppliedEngine,
        lineProposal({
          source: {
            kind: "chain",
            segments: [
              { entityId: "open_a", orientation: "forward" },
              { entityId: "open_b", orientation: "forward" }
            ],
            closed: false
          }
        })
      )
    );
    const supplied: SketchOffsetOp = {
      ...prepared,
      createdEntityIds: ["offset_first", "offset_second"]
    };
    expectSuccessfulBatch(
      suppliedEngine.executeBatch({
        version: "cadops.v1",
        mode: "commit",
        ops: [supplied]
      })
    );
    expect(suppliedEngine.getTransactions().at(-1)?.ops[0]).toMatchObject({
      op: "sketch.offset",
      createdEntityIds: ["offset_first", "offset_second"]
    });
    expect(
      [
        ...suppliedEngine
          .getDocument()
          .sketches.get("sketch_1")!
          .entities.keys()
      ].filter((id) => id.startsWith("offset_"))
    ).toEqual(["offset_first", "offset_second"]);
  });

  it("checks stale source before materialization and does not consume generated IDs", () => {
    const engine = createOffsetEngine();
    const first = preparedOffset(offsetReadiness(engine, lineProposal()));
    expect(first.createdEntityIds).toEqual(["skent_1"]);
    engine.apply({
      op: "scene.createBox",
      id: "unrelated_box",
      dimensions: { width: 1, height: 1, depth: 1 }
    });

    const stale = expectFailedBatch(
      engine.executeBatch({
        version: "cadops.v1",
        mode: "dryRun",
        ops: [first]
      }),
      "SKETCH_EDIT_SOURCE_REVISION_STALE"
    );
    expect(stale.error.path).toContain("expectedSourceRevision");

    const fresh = preparedOffset(offsetReadiness(engine, lineProposal()));
    expect(fresh.createdEntityIds).toEqual(first.createdEntityIds);
  });

  it("uses exact authored residual classification: a redundant source remains eligible and its unconstrained output makes the complete post-state under-defined", () => {
    const engine = new CadEngine();
    engine.applyBatch([
      {
        op: "sketch.create",
        id: "sketch_1",
        name: "Redundant offset source",
        plane: "XY"
      },
      {
        op: "sketch.addArc",
        sketchId: "sketch_1",
        id: "arc_source",
        definition: {
          kind: "centerAngles",
          center: [0, 0],
          radius: 3,
          startAngleDegrees: 0,
          sweepAngleDegrees: 90
        }
      },
      {
        op: "sketch.constraint.create",
        id: "fix_center",
        name: "Fix center",
        sketchId: "sketch_1",
        kind: "fixed",
        target: {
          entityId: "arc_source",
          entityKind: "arc",
          role: "center"
        }
      },
      {
        op: "sketch.constraint.create",
        id: "fix_start",
        name: "Fix start",
        sketchId: "sketch_1",
        kind: "fixed",
        target: {
          entityId: "arc_source",
          entityKind: "arc",
          role: "start"
        }
      },
      {
        op: "sketch.dimension.create",
        id: "dim_sweep",
        name: "Sweep",
        sketchId: "sketch_1",
        entityId: "arc_source",
        target: { entityKind: "arc", role: "sweep" },
        value: 90
      },
      {
        op: "sketch.constraint.create",
        id: "fix_end_redundant",
        name: "Fix end redundantly",
        sketchId: "sketch_1",
        kind: "fixed",
        target: {
          entityId: "arc_source",
          entityKind: "arc",
          role: "end"
        }
      }
    ]);
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: { query: "sketch.solverStatus", sketchId: "sketch_1" }
      })
    ).toMatchObject({
      ok: true,
      status: "over-defined",
      solver: { numericalSolverStatus: "over-defined" }
    });

    const ready = offsetReadiness(
      engine,
      lineProposal({
        source: { kind: "entity", entityId: "arc_source" },
        side: "right",
        distance: 0.5
      })
    );
    expect(ready.impact.postEditSolverStatus).toBe("under-defined");
    const operation = preparedOffset(ready);
    const dryRun = expectSuccessfulBatch(
      engine.executeBatch({
        version: "cadops.v1",
        mode: "dryRun",
        ops: [operation]
      })
    );
    const committed = expectSuccessfulBatch(
      engine.executeBatch({
        version: "cadops.v1",
        mode: "commit",
        ops: [operation]
      })
    );
    expect(committed.semanticDiff).toEqual(dryRun.semanticDiff);
    expect(committed.warnings).toEqual([]);
    expect(
      committed.semanticDiff.sketches?.curveEdits?.[0]?.postEditSolverStatus
    ).toBe("under-defined");
  });

  it.each([
    {
      publicCode: "SKETCH_OFFSET_SIDE_AMBIGUOUS",
      create(): readonly [CadEngine, OffsetProposal] {
        return [
          createOffsetEngine(),
          lineProposal({ referencePoint: [2, -1] })
        ];
      }
    },
    {
      publicCode: "SKETCH_OFFSET_RADIUS_COLLAPSED",
      create(): readonly [CadEngine, OffsetProposal] {
        return [
          createOffsetEngine(),
          lineProposal({
            source: { kind: "entity", entityId: "circle_source" },
            distance: 2,
            side: "inward"
          })
        ];
      }
    },
    {
      publicCode: "SKETCH_OFFSET_JOIN_UNSUPPORTED",
      create(): readonly [CadEngine, OffsetProposal] {
        const engine = new CadEngine();
        engine.applyBatch([
          {
            op: "sketch.create",
            id: "sketch_1",
            name: "Join diagnostic",
            plane: "XY"
          },
          {
            op: "sketch.addArc",
            sketchId: "sketch_1",
            id: "a",
            definition: {
              kind: "centerAngles",
              center: [0, 0],
              radius: 1,
              startAngleDegrees: 270,
              sweepAngleDegrees: 90
            }
          },
          {
            op: "sketch.addArc",
            sketchId: "sketch_1",
            id: "b",
            definition: {
              kind: "centerAngles",
              center: [2, 0],
              radius: 1,
              startAngleDegrees: 180,
              sweepAngleDegrees: 90
            }
          }
        ]);
        return [
          engine,
          lineProposal({
            source: {
              kind: "chain",
              segments: [
                { entityId: "a", orientation: "forward" },
                { entityId: "b", orientation: "forward" }
              ],
              closed: false
            },
            distance: 0.5
          })
        ];
      }
    },
    {
      publicCode: "SKETCH_OFFSET_SELF_INTERSECTION",
      create(): readonly [CadEngine, OffsetProposal] {
        const engine = new CadEngine();
        engine.applyBatch([
          {
            op: "sketch.create",
            id: "sketch_1",
            name: "Intersection diagnostic",
            plane: "XY"
          },
          {
            op: "sketch.addLine",
            sketchId: "sketch_1",
            id: "a",
            start: [0, 0],
            end: [2, 2]
          },
          {
            op: "sketch.addLine",
            sketchId: "sketch_1",
            id: "b",
            start: [2, 2],
            end: [0, 2]
          },
          {
            op: "sketch.addLine",
            sketchId: "sketch_1",
            id: "c",
            start: [0, 2],
            end: [2, 0]
          }
        ]);
        return [
          engine,
          lineProposal({
            source: {
              kind: "chain",
              segments: [
                { entityId: "a", orientation: "forward" },
                { entityId: "b", orientation: "forward" },
                { entityId: "c", orientation: "forward" }
              ],
              closed: false
            },
            distance: 0.1
          })
        ];
      }
    }
  ])(
    "maps analytic failures exactly to $publicCode",
    ({ publicCode, create }) => {
      const [engine, proposal] = create();
      const response = engine.executeQuery({
        version: "cadops.v1",
        query: { query: "sketch.curveEditReadiness", proposal }
      });
      expect(response).toMatchObject({
        ok: true,
        query: "sketch.curveEditReadiness",
        status: "blocked",
        diagnostics: [{ code: publicCode }]
      });
    }
  );

  it("rejects document-wide output collisions atomically and does not burn generated IDs", () => {
    const engine = createOffsetEngine();
    const ready = preparedOffset(offsetReadiness(engine, lineProposal()));
    const before = exportCadProjectJson(engine);
    const collision: SketchOffsetOp = {
      ...ready,
      createdEntityIds: ["line_source"]
    };
    expectFailedBatch(
      engine.executeBatch({
        version: "cadops.v1",
        mode: "commit",
        ops: [collision]
      }),
      "SKETCH_EDIT_INVALID_PROPOSAL"
    );
    expect(exportCadProjectJson(engine)).toBe(before);

    const fresh = preparedOffset(offsetReadiness(engine, lineProposal()));
    expect(fresh.createdEntityIds).toEqual(["skent_1"]);
    expectSuccessfulBatch(
      engine.executeBatch({
        version: "cadops.v1",
        mode: "commit",
        ops: [fresh]
      })
    );
  });

  it("commits in one undo/redo step without modifying source geometry", () => {
    const engine = createOffsetEngine();
    const sourceBefore = engine
      .getDocument()
      .sketches.get("sketch_1")!
      .entities.get("line_source");
    const beforeDocument = engine.getDocument();
    const transactionCountBefore = engine.getTransactions().length;
    const operation = preparedOffset(offsetReadiness(engine, lineProposal()));
    expectSuccessfulBatch(
      engine.executeBatch({
        version: "cadops.v1",
        mode: "commit",
        ops: [operation]
      })
    );
    const committed = engine.createSnapshot();
    expect(engine.getTransactions()).toHaveLength(transactionCountBefore + 1);

    expect(engine.undo()).toBeDefined();
    expect(engine.getDocument()).toEqual(beforeDocument);
    expect(engine.getTransactions()).toHaveLength(transactionCountBefore);
    expect(engine.redo()).toBeDefined();
    expect(engine.createSnapshot()).toEqual(committed);
    expect(engine.getTransactions()).toHaveLength(transactionCountBefore + 1);
    expect(
      engine.getDocument().sketches.get("sketch_1")!.entities.get("line_source")
    ).toEqual(sourceBefore);
  });

  it("round-trips ordinary non-associative offset output through JSON and canonical-CBOR WCAD", async () => {
    const engine = createOffsetEngine();
    const operation = preparedOffset(offsetReadiness(engine, lineProposal()));
    expectSuccessfulBatch(
      engine.executeBatch({
        version: "cadops.v1",
        mode: "commit",
        ops: [operation]
      })
    );
    const expected = exportCadProject(engine);
    const created = engine
      .getDocument()
      .sketches.get("sketch_1")!
      .entities.get(operation.createdEntityIds[0]!)!;
    expect(created).toEqual({
      id: operation.createdEntityIds[0],
      kind: "line",
      start: [0, 1],
      end: [4, 1],
      construction: false
    });
    expect(created).not.toHaveProperty("parentEntityId");
    expect(created).not.toHaveProperty("offsetDistance");
    expect(created).not.toHaveProperty("source");
    expect(engine.getDocument().sketchConstraints.size).toBe(0);

    const jsonEngine = importCadProjectJson(exportCadProjectJson(engine));
    expect(exportCadProject(jsonEngine)).toEqual(expected);

    const wcad = await exportCadProjectWcad(engine, {
      createdAt: "2026-07-26T00:00:00.000Z"
    });
    const wcadEngine = await importCadProjectWcad(wcad.bytes);
    expect(exportCadProject(wcadEngine)).toEqual(expected);
  });

  it.each(["history", "redoStack"] as const)(
    "rejects imported %s offset operations with omitted materialized output IDs",
    (location) => {
      const engine = createOffsetEngine();
      const operation = preparedOffset(offsetReadiness(engine, lineProposal()));
      expectSuccessfulBatch(
        engine.executeBatch({
          version: "cadops.v1",
          mode: "commit",
          ops: [operation]
        })
      );
      if (location === "redoStack") engine.undo();
      const corrupted = JSON.parse(
        JSON.stringify(exportCadProject(engine))
      ) as {
        history: Array<{ ops: Array<Record<string, unknown>> }>;
        redoStack: Array<{ ops: Array<Record<string, unknown>> }>;
      };
      delete corrupted[location].at(-1)!.ops[0]!.createdEntityIds;

      expect(() =>
        importCadProject(corrupted as unknown as CadProject)
      ).toThrow(CadProjectImportError);
    }
  );
});
