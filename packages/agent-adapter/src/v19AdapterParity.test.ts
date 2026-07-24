import { CadEngine } from "@web-cad/cad-core";
import type {
  CadBatchSuccessResponse,
  CadQueryResponse,
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
              createdConstraintIds: ["slot_c1"]
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
