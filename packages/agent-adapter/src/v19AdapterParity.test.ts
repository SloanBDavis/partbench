import { CadEngine } from "@web-cad/cad-core";
import type {
  CadBatchSuccessResponse,
  CadQueryResponse,
  PreparedSketchCurveEditOp,
  SketchDimensionEntryCurrent
} from "@web-cad/cad-protocol";
import { describe, expect, it, vi } from "vitest";
import {
  CadOpsAgentAdapter,
  type CadOpsAgentSketchDimensionsQueryResponse,
  parseCadOpsAgentQueryRequest,
  parseCadOpsAgentRequest
} from "./index";

const SOURCE_REVISION = `partbench-source-v1:${"1".repeat(64)}`;
const SOLVER_IDENTITY = `partbench-sketch-solver-evaluation-v1:${"2".repeat(
  64
)}`;

const CURVE_EDIT_PRECONDITION = {
  expectedSourceRevision: SOURCE_REVISION,
  expectedSolverEvaluationIdentity: SOLVER_IDENTITY
} as const;

function createTrimEngine(): CadEngine {
  const engine = new CadEngine();
  engine.applyBatch([
    { op: "sketch.create", id: "sketch_1", name: "Edit", plane: "XY" },
    {
      op: "sketch.addLine",
      sketchId: "sketch_1",
      id: "target",
      start: [0, 0],
      end: [10, 0]
    },
    {
      op: "sketch.addLine",
      sketchId: "sketch_1",
      id: "boundary_a",
      start: [3, -2],
      end: [3, 2]
    },
    {
      op: "sketch.addLine",
      sketchId: "sketch_1",
      id: "boundary_b",
      start: [7, -2],
      end: [7, 2]
    }
  ]);
  return engine;
}

describe("V19 agent adapter parity", () => {
  it("accepts each strictly validated V19 sketch query", () => {
    const requests = [
      {
        query: "sketch.curveEditReadiness",
        proposal: {
          kind: "trim",
          sketchId: "sketch_1",
          entityId: "line_1",
          boundaryEntityIds: ["line_2"],
          pickPoint: [1, 2]
        }
      },
      {
        query: "sketch.profileRegionCandidates",
        sketchId: "sketch_1",
        entityIds: ["line_1", "line_2"],
        limit: 25,
        afterCandidateKey: "candidate_1",
        sourceRevision: SOURCE_REVISION
      },
      {
        query: "sketch.profileRegionValidate",
        profile: {
          kind: "regions",
          sketchId: "sketch_1",
          regions: [
            {
              outer: { kind: "entity", entityId: "circle_outer" },
              holes: [{ kind: "entity", entityId: "circle_hole" }]
            }
          ]
        }
      }
    ] as const;

    for (const [index, query] of requests.entries()) {
      const parsed = parseCadOpsAgentQueryRequest({
        requestId: `v19_query_${index}`,
        adapterVersion: "web-cad.agent-adapter.v1",
        query: { version: "cadops.v1", query }
      });
      expect(parsed.query.query.query).toBe(query.query);
    }
  });

  it("rejects malformed V19 queries at the adapter boundary", () => {
    expect(() =>
      parseCadOpsAgentQueryRequest({
        requestId: "bad_curve_query",
        adapterVersion: "web-cad.agent-adapter.v1",
        query: {
          version: "cadops.v1",
          query: {
            query: "sketch.curveEditReadiness",
            proposal: {
              kind: "trim",
              sketchId: "sketch_1",
              entityId: "line_1",
              boundaryEntityIds: [],
              pickPoint: [1, 2],
              pixelX: 400
            }
          }
        }
      })
    ).toThrow("Invalid CADOps agent adapter query request.");

    expect(() =>
      parseCadOpsAgentQueryRequest({
        requestId: "bad_region_cursor",
        adapterVersion: "web-cad.agent-adapter.v1",
        query: {
          version: "cadops.v1",
          query: {
            query: "sketch.profileRegionCandidates",
            sketchId: "sketch_1",
            afterCandidateKey: "candidate_1"
          }
        }
      })
    ).toThrow("Invalid CADOps agent adapter query request.");
  });

  it("rejects unknown nested CadBatch envelope fields", () => {
    for (const extra of [
      { pixelX: 320 },
      { viewport: { width: 800, height: 600 } },
      { screenshot: "data:image/png;base64,opaque" },
      { candidateToken: "opaque-selection-token" }
    ]) {
      expect(() =>
        parseCadOpsAgentRequest({
          requestId: "bad_batch_envelope",
          adapterVersion: "web-cad.agent-adapter.v1",
          batch: {
            version: "cadops.v1",
            mode: "dryRun",
            ops: [],
            ...extra
          }
        })
      ).toThrow("Invalid CADOps agent adapter request.");
    }

    for (const nested of [
      { actor: { type: "robot" } },
      { actor: { type: "agent", screenshot: "opaque" } },
      {
        audit: {
          intent: "dryRun",
          operationCount: 0,
          candidateToken: "opaque-selection-token"
        }
      },
      { audit: { intent: "dryRun", operationCount: 0.5 } }
    ]) {
      expect(() =>
        parseCadOpsAgentRequest({
          requestId: "bad_batch_metadata",
          adapterVersion: "web-cad.agent-adapter.v1",
          batch: {
            version: "cadops.v1",
            mode: "dryRun",
            ops: [],
            ...nested
          }
        })
      ).toThrow("Invalid CADOps agent adapter request.");
    }
  });

  it("passes all V19 query response evidence through with adapter metadata", () => {
    const engine = new CadEngine();
    const adapter = new CadOpsAgentAdapter(engine);
    const profile = {
      kind: "regions",
      sketchId: "sketch_1",
      regions: [
        {
          outer: { kind: "entity", entityId: "circle_1" },
          holes: []
        }
      ]
    } as const;
    const responses: readonly CadQueryResponse[] = [
      {
        ok: true,
        query: "sketch.curveEditReadiness",
        cadOpsVersion: "cadops.v1",
        status: "blocked",
        diagnostics: [
          {
            code: "SKETCH_EDIT_STALE_SOURCE",
            severity: "blocker",
            message: "The proposal must be prepared against current source."
          }
        ]
      },
      {
        ok: true,
        query: "sketch.profileRegionCandidates",
        cadOpsVersion: "cadops.v1",
        sketchId: "sketch_1",
        status: "ready",
        sourceRevision: SOURCE_REVISION,
        sourceFingerprint: "fingerprint_1",
        candidateCount: 0,
        candidates: [],
        hasMore: false,
        complexity: {
          regionCount: 0,
          loopCount: 0,
          segmentReferenceCount: 0,
          predicateVisitCount: 0
        },
        diagnostics: []
      },
      {
        ok: true,
        query: "sketch.profileRegionValidate",
        cadOpsVersion: "cadops.v1",
        status: "ready",
        requestedProfile: profile,
        normalizedProfile: profile,
        loopSummaries: [],
        materialAreas: [Math.PI],
        complexity: {
          regionCount: 1,
          loopCount: 1,
          segmentReferenceCount: 1,
          predicateVisitCount: 1
        },
        diagnostics: []
      }
    ];

    for (const [index, response] of responses.entries()) {
      vi.spyOn(engine, "executeQuery").mockReturnValueOnce(response);
      const query =
        response.query === "sketch.curveEditReadiness"
          ? {
              query: "sketch.curveEditReadiness" as const,
              proposal: {
                kind: "split" as const,
                sketchId: "sketch_1",
                entityId: "line_1",
                splitPoints: [[1, 0] as const]
              }
            }
          : response.query === "sketch.profileRegionCandidates"
            ? {
                query: "sketch.profileRegionCandidates" as const,
                sketchId: "sketch_1"
              }
            : {
                query: "sketch.profileRegionValidate" as const,
                profile
              };
      const result = adapter.query(
        parseCadOpsAgentQueryRequest({
          requestId: `v19_response_${index}`,
          adapterVersion: "web-cad.agent-adapter.v1",
          query: { version: "cadops.v1", query }
        })
      );

      expect(result).toEqual({
        ...response,
        requestId: `v19_response_${index}`,
        adapterVersion: "web-cad.agent-adapter.v1"
      });
    }
  });

  it("preserves complete ready and blocked curve-edit evidence", () => {
    const engine = new CadEngine();
    const adapter = new CadOpsAgentAdapter(engine);
    const impact = {
      sketchId: "sketch_1",
      operation: "trim",
      replacements: [
        {
          sourceEntityId: "line_1",
          disposition: "modified",
          resultEntityIds: ["line_1", "line_3"],
          preservedResultEntityId: "line_1"
        }
      ],
      constraintImpacts: [],
      dimensionImpacts: [],
      requiredDeleteConstraintIds: [],
      requiredDeleteDimensionIds: [],
      affectedFeatureIds: ["feature_1"],
      postEditSolverStatus: "fully-defined"
    } as const;
    const preview = {
      intersections: [
        {
          boundaryEntityId: "line_2",
          point: [4, 0] as const,
          targetParameter: 4
        }
      ],
      projectedSplitParameters: [4],
      resultEntityCount: 2,
      resultEntities: [
        {
          id: "line_1",
          kind: "line",
          start: [0, 0] as const,
          end: [4, 0] as const,
          construction: false
        },
        {
          id: "line_3",
          kind: "line",
          start: [6, 0] as const,
          end: [10, 0] as const,
          construction: false
        }
      ]
    } as const;
    const preparedOperation: PreparedSketchCurveEditOp = {
      op: "sketch.trim",
      sketchId: "sketch_1",
      entityId: "line_1",
      boundaryEntityIds: ["line_2"],
      pickPoint: [5, 0],
      precondition: CURVE_EDIT_PRECONDITION,
      createdEntityIds: ["line_3"],
      deleteConstraintIds: [],
      deleteDimensionIds: []
    };
    const ready: CadQueryResponse = {
      ok: true,
      query: "sketch.curveEditReadiness",
      cadOpsVersion: "cadops.v1",
      status: "ready",
      preparedOperation,
      impact,
      preview,
      diagnostics: []
    };
    const blocked: CadQueryResponse = {
      ok: true,
      query: "sketch.curveEditReadiness",
      cadOpsVersion: "cadops.v1",
      status: "blocked",
      impact,
      preview,
      diagnostics: [
        {
          code: "SKETCH_EDIT_DELETE_LIST_MISMATCH",
          severity: "blocker",
          message: "Use the exact authored-record deletion lists."
        }
      ]
    };

    for (const [index, response] of [ready, blocked].entries()) {
      vi.spyOn(engine, "executeQuery").mockReturnValueOnce(response);
      const result = adapter.query(
        parseCadOpsAgentQueryRequest({
          requestId: `curve_evidence_${index}`,
          adapterVersion: "web-cad.agent-adapter.v1",
          query: {
            version: "cadops.v1",
            query: {
              query: "sketch.curveEditReadiness",
              proposal: {
                kind: "trim",
                sketchId: "sketch_1",
                entityId: "line_1",
                boundaryEntityIds: ["line_2"],
                pickPoint: [5, 0]
              }
            }
          }
        })
      );

      expect(result).toEqual({
        ...response,
        requestId: `curve_evidence_${index}`,
        adapterVersion: "web-cad.agent-adapter.v1"
      });
    }
  });

  it("accepts V19 operations and rejects malformed overlapping shapes", () => {
    const parsed = parseCadOpsAgentRequest({
      requestId: "v19_batch",
      adapterVersion: "web-cad.agent-adapter.v1",
      batch: {
        version: "cadops.v1",
        mode: "dryRun",
        ops: [
          {
            op: "sketch.addSlot",
            sketchId: "sketch_1",
            centerlineStart: [0, 0],
            centerlineEnd: [10, 0],
            radius: 2,
            entityIds: ["slot_1", "slot_2", "slot_3", "slot_4"],
            constraintIds: [
              "slot_c1",
              "slot_c2",
              "slot_c3",
              "slot_c4",
              "slot_c5",
              "slot_c6",
              "slot_c7",
              "slot_c8",
              "slot_c9"
            ]
          },
          {
            op: "sketch.dimension.update",
            id: "dimension_1",
            target: {
              kind: "entityScalar",
              entityId: "circle_1",
              entityKind: "circle",
              role: "diameter"
            },
            value: 12
          },
          {
            op: "sketch.constraint.update",
            id: "constraint_1",
            definition: {
              kind: "equalLength",
              primaryLineEntityId: "line_1",
              secondaryLineEntityId: "line_2"
            }
          },
          {
            op: "sketch.constraint.create",
            id: "constraint_2",
            name: "Fixed point",
            sketchId: "sketch_1",
            kind: "fixed",
            target: {
              entityId: "point_1",
              entityKind: "point",
              role: "position"
            },
            coordinate: [1, 2]
          },
          {
            op: "sketch.constraint.create",
            name: "Tangent",
            sketchId: "sketch_1",
            kind: "tangent",
            primaryTarget: { entityId: "line_1", entityKind: "line" },
            secondaryTarget: { entityId: "arc_1", entityKind: "arc" }
          },
          {
            op: "sketch.constraint.create",
            name: "Concentric",
            sketchId: "sketch_1",
            kind: "concentric",
            primaryTarget: { entityId: "circle_1", entityKind: "circle" },
            secondaryTarget: { entityId: "arc_1", entityKind: "arc" }
          },
          {
            op: "sketch.constraint.create",
            name: "Equal radius",
            sketchId: "sketch_1",
            kind: "equalRadius",
            primaryTarget: { entityId: "circle_1", entityKind: "circle" },
            secondaryTarget: { entityId: "arc_1", entityKind: "arc" }
          }
        ]
      }
    });

    expect(parsed.batch.ops.map((op) => op.op)).toEqual([
      "sketch.addSlot",
      "sketch.dimension.update",
      "sketch.constraint.update",
      "sketch.constraint.create",
      "sketch.constraint.create",
      "sketch.constraint.create",
      "sketch.constraint.create"
    ]);

    expect(() =>
      parseCadOpsAgentRequest({
        requestId: "bad_dimension_update",
        adapterVersion: "web-cad.agent-adapter.v1",
        batch: {
          version: "cadops.v1",
          mode: "dryRun",
          ops: [
            {
              op: "sketch.dimension.update",
              id: "dimension_1",
              target: {
                kind: "entityScalar",
                entityId: "circle_1",
                entityKind: "circle",
                role: "width"
              },
              value: 12
            }
          ]
        }
      })
    ).toThrow("Invalid CADOps agent adapter request.");

    for (const [kind, primaryKind, secondaryKind] of [
      ["tangent", "line", "line"],
      ["concentric", "line", "circle"],
      ["equalRadius", "circle", "circle"]
    ] as const) {
      expect(() =>
        parseCadOpsAgentRequest({
          requestId: `bad_${kind}`,
          adapterVersion: "web-cad.agent-adapter.v1",
          batch: {
            version: "cadops.v1",
            mode: "dryRun",
            ops: [
              {
                op: "sketch.constraint.create",
                name: `Bad ${kind}`,
                sketchId: "sketch_1",
                kind,
                primaryTarget: {
                  entityId: "same_1",
                  entityKind: primaryKind
                },
                secondaryTarget: {
                  entityId: "same_1",
                  entityKind: secondaryKind
                }
              }
            ]
          }
        })
      ).toThrow("Invalid CADOps agent adapter request.");
    }

    expect(() =>
      parseCadOpsAgentRequest({
        requestId: "bad_normalized_constraint",
        adapterVersion: "web-cad.agent-adapter.v1",
        batch: {
          version: "cadops.v1",
          mode: "dryRun",
          ops: [
            {
              op: "sketch.constraint.create",
              name: "Bad fixed point",
              sketchId: "sketch_1",
              kind: "fixed",
              target: {
                entityId: "circle_1",
                entityKind: "circle",
                role: "position"
              }
            }
          ]
        }
      })
    ).toThrow("Invalid CADOps agent adapter request.");

    expect(() =>
      parseCadOpsAgentRequest({
        requestId: "bad_region_patch",
        adapterVersion: "web-cad.agent-adapter.v1",
        batch: {
          version: "cadops.v1",
          mode: "dryRun",
          ops: [
            {
              op: "feature.updateExtrude",
              id: "extrude_1",
              depth: 4,
              profile: {
                kind: "regions",
                sketchId: "sketch_1",
                regions: []
              }
            }
          ]
        }
      })
    ).toThrow("Invalid CADOps agent adapter request.");
  });

  it("accepts direct and prepared trim, extend, split, and explode operations", () => {
    const directOperations = [
      {
        op: "sketch.trim",
        sketchId: "sketch_1",
        entityId: "line_1",
        boundaryEntityIds: ["line_2"],
        pickPoint: [4, 0],
        precondition: CURVE_EDIT_PRECONDITION
      },
      {
        op: "sketch.extend",
        sketchId: "sketch_1",
        entityId: "line_1",
        endpoint: "end",
        boundaryEntityIds: ["line_2"],
        precondition: CURVE_EDIT_PRECONDITION
      },
      {
        op: "sketch.split",
        sketchId: "sketch_1",
        entityId: "line_1",
        splitPoints: [[4, 0]],
        precondition: CURVE_EDIT_PRECONDITION
      },
      {
        op: "sketch.explodeRectangle",
        sketchId: "sketch_1",
        entityId: "rectangle_1",
        precondition: CURVE_EDIT_PRECONDITION
      }
    ] as const;
    const preparedOperations = [
      {
        ...directOperations[0],
        createdEntityIds: ["line_3"],
        deleteConstraintIds: [],
        deleteDimensionIds: []
      },
      {
        ...directOperations[1],
        deleteConstraintIds: [],
        deleteDimensionIds: []
      },
      {
        ...directOperations[2],
        createdEntityIds: ["line_4"],
        deleteConstraintIds: ["constraint_1"],
        deleteDimensionIds: ["dimension_1"]
      },
      {
        ...directOperations[3],
        lineEntityIds: ["line_5", "line_6", "line_7", "line_8"],
        deleteConstraintIds: [],
        deleteDimensionIds: []
      }
    ] as const;

    for (const [shape, operations] of [
      ["direct", directOperations],
      ["prepared", preparedOperations]
    ] as const) {
      for (const [index, operation] of operations.entries()) {
        const parsed = parseCadOpsAgentRequest({
          requestId: `${shape}_${index}`,
          adapterVersion: "web-cad.agent-adapter.v1",
          batch: {
            version: "cadops.v1",
            mode: "dryRun",
            ops: [operation]
          }
        });
        expect(parsed.batch.ops).toEqual([operation]);
      }
    }
  });

  it("executes prepared dry-runs and direct commits with curve-edit audit metadata", () => {
    const preparedEngine = createTrimEngine();
    const preparedAdapter = new CadOpsAgentAdapter(preparedEngine);
    const readiness = preparedAdapter.query(
      parseCadOpsAgentQueryRequest({
        requestId: "prepare_trim",
        adapterVersion: "web-cad.agent-adapter.v1",
        query: {
          version: "cadops.v1",
          query: {
            query: "sketch.curveEditReadiness",
            proposal: {
              kind: "trim",
              sketchId: "sketch_1",
              entityId: "target",
              boundaryEntityIds: ["boundary_a", "boundary_b"],
              pickPoint: [5, 0]
            }
          }
        }
      })
    );
    if (
      !readiness.ok ||
      readiness.query !== "sketch.curveEditReadiness" ||
      readiness.status !== "ready"
    ) {
      throw new Error(`Expected ready trim: ${JSON.stringify(readiness)}`);
    }
    const dryRun = preparedAdapter.execute(
      parseCadOpsAgentRequest({
        requestId: "prepared_trim_dry_run",
        adapterVersion: "web-cad.agent-adapter.v1",
        source: { source: "test", toolName: "curve-edit" },
        batch: {
          version: "cadops.v1",
          mode: "dryRun",
          ops: [readiness.preparedOperation]
        }
      })
    );
    expect(dryRun).toMatchObject({
      ok: true,
      mode: "dryRun",
      review: {
        operationCount: 1,
        operations: [
          {
            op: "sketch.trim",
            intent: "modify",
            sketchId: "sketch_1",
            sketchEntityId: "target"
          }
        ],
        audit: {
          source: "test",
          requestId: "prepared_trim_dry_run",
          toolName: "curve-edit",
          intent: "dryRun"
        }
      }
    });
    expect(dryRun.review.operations[0]?.destructive).toBeUndefined();
    expect(
      dryRun.review.hints.some((hint) => hint.code === "DESTRUCTIVE_DELETE")
    ).toBe(false);

    const directEngine = createTrimEngine();
    const directAdapter = new CadOpsAgentAdapter(directEngine);
    const directReadiness = directAdapter.query(
      parseCadOpsAgentQueryRequest({
        requestId: "prepare_direct_trim",
        adapterVersion: "web-cad.agent-adapter.v1",
        query: {
          version: "cadops.v1",
          query: {
            query: "sketch.curveEditReadiness",
            proposal: {
              kind: "trim",
              sketchId: "sketch_1",
              entityId: "target",
              boundaryEntityIds: ["boundary_a", "boundary_b"],
              pickPoint: [5, 0]
            }
          }
        }
      })
    );
    if (
      !directReadiness.ok ||
      directReadiness.query !== "sketch.curveEditReadiness" ||
      directReadiness.status !== "ready"
    ) {
      throw new Error("Expected ready direct trim.");
    }
    const prepared = directReadiness.preparedOperation;
    if (prepared.op !== "sketch.trim") {
      throw new Error("Expected trim operation.");
    }
    const commit = directAdapter.execute(
      parseCadOpsAgentRequest({
        requestId: "direct_trim_commit",
        adapterVersion: "web-cad.agent-adapter.v1",
        permissions: { allowCommit: true },
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [
            {
              op: prepared.op,
              sketchId: prepared.sketchId,
              entityId: prepared.entityId,
              boundaryEntityIds: prepared.boundaryEntityIds,
              pickPoint: prepared.pickPoint,
              precondition: prepared.precondition
            }
          ]
        }
      })
    );
    expect(commit).toMatchObject({
      ok: true,
      mode: "commit",
      transactionId: expect.any(String),
      review: {
        commitGate: { permissionProvided: true, blocked: false }
      }
    });
  });

  it("preserves exact curve-edit impact errors and marks explicit record deletion destructive", () => {
    const engine = new CadEngine();
    engine.applyBatch([
      { op: "sketch.create", id: "sketch_1", name: "Edit", plane: "XY" },
      {
        op: "sketch.addLine",
        sketchId: "sketch_1",
        id: "target",
        start: [0, 0],
        end: [6, 0]
      },
      {
        op: "sketch.dimension.create",
        id: "length_dimension",
        name: "Length",
        sketchId: "sketch_1",
        entityId: "target",
        target: { entityKind: "line", role: "length" },
        value: 6
      }
    ]);
    const adapter = new CadOpsAgentAdapter(engine);
    const ready = adapter.query(
      parseCadOpsAgentQueryRequest({
        requestId: "prepare_split",
        adapterVersion: "web-cad.agent-adapter.v1",
        query: {
          version: "cadops.v1",
          query: {
            query: "sketch.curveEditReadiness",
            proposal: {
              kind: "split",
              sketchId: "sketch_1",
              entityId: "target",
              splitPoints: [[3, 0]]
            }
          }
        }
      })
    );
    if (
      !ready.ok ||
      ready.query !== "sketch.curveEditReadiness" ||
      ready.status !== "ready" ||
      ready.preparedOperation.op !== "sketch.split"
    ) {
      throw new Error("Expected ready split.");
    }
    const failed = adapter.execute(
      parseCadOpsAgentRequest({
        requestId: "bad_split_delete_list",
        adapterVersion: "web-cad.agent-adapter.v1",
        batch: {
          version: "cadops.v1",
          mode: "dryRun",
          ops: [
            {
              ...ready.preparedOperation,
              deleteDimensionIds: ["length_dimension", "length_dimension"]
            }
          ]
        }
      })
    );
    expect(failed.ok).toBe(false);
    if (failed.ok) throw new Error("Expected exact-list failure.");
    expect(failed.error).toMatchObject({
      code: "SKETCH_EDIT_DELETE_LIST_MISMATCH",
      curveEditImpact: ready.impact
    });
    expect(failed.errors[0]).toEqual(failed.error);
    expect(failed.review.operations[0]).toMatchObject({
      op: "sketch.split",
      destructive: true
    });
  });

  it("derives destructive review evidence when a direct edit deletes authored records", () => {
    const engine = new CadEngine();
    const response: CadBatchSuccessResponse = {
      ok: true,
      mode: "dryRun",
      semanticDiff: {
        created: [],
        modified: [],
        deleted: [],
        sketches: {
          curveEdits: [
            {
              opIndex: 0,
              sketchId: "sketch_1",
              operation: "split",
              replacements: [],
              constraintImpacts: [],
              dimensionImpacts: [],
              requiredDeleteConstraintIds: [],
              requiredDeleteDimensionIds: ["dimension_1"],
              affectedFeatureIds: [],
              postEditSolverStatus: "under-defined",
              createdEntityIds: ["line_2"],
              modifiedEntityIds: ["line_1"],
              deletedEntityIds: [],
              retargetedConstraintIds: [],
              deletedConstraintIds: [],
              retargetedDimensionIds: [],
              deletedDimensionIds: ["dimension_1"]
            }
          ]
        }
      },
      createdIds: [],
      modifiedIds: [],
      deletedIds: [],
      modifiedSketchIds: ["sketch_1"],
      createdSketchEntityIds: ["line_2"],
      modifiedSketchEntityIds: ["line_1"],
      deletedSketchDimensionIds: ["dimension_1"],
      warnings: []
    };
    vi.spyOn(engine, "executeBatch").mockReturnValue(response);

    const result = new CadOpsAgentAdapter(engine).execute(
      parseCadOpsAgentRequest({
        requestId: "direct_split_derived_deletion",
        adapterVersion: "web-cad.agent-adapter.v1",
        batch: {
          version: "cadops.v1",
          mode: "dryRun",
          ops: [
            {
              op: "sketch.split",
              sketchId: "sketch_1",
              entityId: "line_1",
              splitPoints: [[3, 0]],
              precondition: CURVE_EDIT_PRECONDITION
            }
          ]
        }
      })
    );

    expect(result).toMatchObject({
      ok: true,
      deletedSketchDimensionIds: ["dimension_1"],
      review: {
        operations: [{ op: "sketch.split", destructive: true }],
        hints: [
          {
            code: "DESTRUCTIVE_DELETE",
            severity: "warning",
            opIndex: 0,
            op: "sketch.split"
          }
        ]
      }
    });
  });

  it("derives destructive review evidence from an actual sketch-entity deletion", () => {
    const engine = new CadEngine();
    const response: CadBatchSuccessResponse = {
      ok: true,
      mode: "dryRun",
      semanticDiff: {
        created: [],
        modified: [],
        deleted: []
      },
      createdIds: [],
      modifiedIds: [],
      deletedIds: [],
      modifiedSketchIds: ["sketch_1"],
      deletedSketchEntityIds: ["line_1"],
      warnings: []
    };
    vi.spyOn(engine, "executeBatch").mockReturnValue(response);

    const result = new CadOpsAgentAdapter(engine).execute(
      parseCadOpsAgentRequest({
        requestId: "direct_trim_entity_deletion",
        adapterVersion: "web-cad.agent-adapter.v1",
        batch: {
          version: "cadops.v1",
          mode: "dryRun",
          ops: [
            {
              op: "sketch.trim",
              sketchId: "sketch_1",
              entityId: "line_1",
              boundaryEntityIds: ["line_2"],
              pickPoint: [4, 0],
              precondition: CURVE_EDIT_PRECONDITION
            }
          ]
        }
      })
    );

    expect(result).toMatchObject({
      ok: true,
      deletedSketchEntityIds: ["line_1"],
      review: {
        operations: [{ op: "sketch.trim", destructive: true }],
        hints: [
          {
            code: "DESTRUCTIVE_DELETE",
            severity: "warning",
            opIndex: 0,
            op: "sketch.trim"
          }
        ]
      }
    });
  });

  it("marks explode-rectangle destructive before execution or permission", () => {
    const result = new CadOpsAgentAdapter().execute(
      parseCadOpsAgentRequest({
        requestId: "blocked_explode_rectangle",
        adapterVersion: "web-cad.agent-adapter.v1",
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [
            {
              op: "sketch.explodeRectangle",
              sketchId: "sketch_1",
              entityId: "rectangle_1",
              precondition: CURVE_EDIT_PRECONDITION
            }
          ]
        }
      })
    );

    expect(result).toMatchObject({
      ok: false,
      error: { code: "COMMIT_NOT_ALLOWED" },
      review: {
        operations: [{ op: "sketch.explodeRectangle", destructive: true }],
        hints: [
          {
            code: "DESTRUCTIVE_DELETE",
            severity: "warning",
            opIndex: 0,
            op: "sketch.explodeRectangle"
          }
        ],
        commitGate: { permissionProvided: false, blocked: true }
      }
    });
  });

  it("passes V19 semantic evidence through without dropping normalization", () => {
    const engine = new CadEngine();
    const response: CadBatchSuccessResponse = {
      ok: true,
      mode: "dryRun",
      semanticDiff: {
        created: [],
        modified: [],
        deleted: [],
        sketches: {
          curveEdits: [
            {
              opIndex: 0,
              sketchId: "sketch_1",
              operation: "trim",
              replacements: [],
              constraintImpacts: [],
              dimensionImpacts: [],
              requiredDeleteConstraintIds: [],
              requiredDeleteDimensionIds: [],
              affectedFeatureIds: ["feature_1"],
              postEditSolverStatus: "fully-defined",
              createdEntityIds: [],
              modifiedEntityIds: ["line_1"],
              deletedEntityIds: [],
              retargetedConstraintIds: [],
              deletedConstraintIds: [],
              retargetedDimensionIds: [],
              deletedDimensionIds: []
            }
          ],
          convenienceOperations: [
            {
              opIndex: 1,
              sketchId: "sketch_1",
              operation: "slot",
              createdEntityIds: ["slot_1", "slot_2", "slot_3", "slot_4"],
              createdConstraintIds: Array.from(
                { length: 9 },
                (_, index) => `slot_c${index + 1}`
              )
            }
          ]
        },
        features: {
          inputReferences: [
            {
              featureId: "feature_1",
              inputKind: "profile",
              after: {
                kind: "regions",
                sketchId: "sketch_1",
                regions: [
                  {
                    outer: { kind: "entity", entityId: "circle_1" },
                    holes: []
                  }
                ]
              },
              normalization: {
                outerOrientationsChanged: [],
                holeOrientationsChanged: [],
                cyclicStartsChanged: [],
                holeOrderChanged: false,
                regionOrderChanged: true
              },
              affectedSketchIds: ["sketch_1"],
              affectedEntityIds: ["circle_1"]
            }
          ]
        }
      },
      createdIds: [],
      modifiedIds: [],
      deletedIds: [],
      warnings: []
    };
    vi.spyOn(engine, "executeBatch").mockReturnValue(response);

    const adapterResponse = new CadOpsAgentAdapter(engine).execute(
      parseCadOpsAgentRequest({
        requestId: "v19_diff",
        adapterVersion: "web-cad.agent-adapter.v1",
        batch: {
          version: "cadops.v1",
          mode: "dryRun",
          ops: [
            {
              op: "sketch.trim",
              sketchId: "sketch_1",
              entityId: "line_1",
              boundaryEntityIds: ["line_2"],
              pickPoint: [1, 2],
              precondition: {
                expectedSourceRevision: SOURCE_REVISION,
                expectedSolverEvaluationIdentity: "none"
              }
            }
          ]
        }
      })
    );

    expect(adapterResponse.ok && adapterResponse.semanticDiff).toEqual(
      response.semanticDiff
    );
  });

  it("keeps normalized V22 dimension entries typed on query responses", () => {
    const dimension: SketchDimensionEntryCurrent = {
      sourceShape: "v22",
      id: "dimension_1",
      name: "Diameter",
      sketchId: "sketch_1",
      target: {
        kind: "entityScalar",
        entityId: "circle_1",
        entityKind: "circle",
        role: "diameter"
      },
      valueSource: { type: "literal", value: 12 },
      status: "healthy",
      issues: [],
      effectiveValue: 12
    };
    const response: CadOpsAgentSketchDimensionsQueryResponse = {
      ok: true,
      requestId: "dimension_query",
      adapterVersion: "web-cad.agent-adapter.v1",
      cadOpsVersion: "cadops.v1",
      query: "sketch.dimensions",
      sketchId: "sketch_1",
      dimensionCount: 1,
      dimensions: [dimension]
    };

    expect(response.dimensions[0]).toMatchObject({
      sourceShape: "v22",
      target: { role: "diameter" }
    });
  });
});
