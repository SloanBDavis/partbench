import {
  validateSketchProfilePathQueryResponse,
  type SketchProfileRegionCandidatesQueryResponse,
  type SketchProfileRegionValidateQueryResponse,
  type SketchRegionsProfileRef
} from "@web-cad/cad-protocol";
import { describe, expect, it } from "vitest";

import {
  CadEngine,
  exportCadProject,
  importCadProject,
  type CadProject
} from "./index";

function createRegionEngine(): CadEngine {
  const engine = new CadEngine();
  engine.applyBatch([
    {
      op: "sketch.create",
      id: "sketch_1",
      name: "Regions",
      plane: "XY"
    },
    {
      op: "sketch.addRectangle",
      sketchId: "sketch_1",
      id: "outer",
      center: [0, 0],
      width: 20,
      height: 20
    },
    {
      op: "sketch.addCircle",
      sketchId: "sketch_1",
      id: "hole",
      center: [0, 0],
      radius: 4
    },
    {
      op: "sketch.addCircle",
      sketchId: "sketch_1",
      id: "island",
      center: [0, 0],
      radius: 1
    },
    {
      op: "sketch.addCircle",
      sketchId: "sketch_1",
      id: "other",
      center: [30, 0],
      radius: 2
    }
  ]);
  return engine;
}

function createImportedRegionFeatureEngine(
  featureKind: "extrude" | "revolve" = "extrude"
): CadEngine {
  const baseEngine = createRegionEngine();
  if (featureKind === "revolve") {
    baseEngine.applyBatch([
      {
        op: "sketch.addLine",
        sketchId: "sketch_1",
        id: "axis",
        start: [-15, 0],
        end: [-15, 10],
        construction: true
      }
    ]);
  }
  const base = exportCadProject(baseEngine);
  const project: CadProject = {
    ...base,
    schemaVersion: "web-cad.project.v22",
    history: [],
    redoStack: [],
    document: {
      ...base.document,
      sketches: base.document.sketches.map((sketch) => ({
        ...sketch,
        entities: sketch.entities.map((entity) => ({
          ...entity,
          construction: false
        }))
      })),
      features: [
        featureKind === "extrude"
          ? {
              id: "feature_region",
              kind: "extrude",
              profile: {
                kind: "regions",
                sketchId: "sketch_1",
                regions: [
                  {
                    outer: { kind: "entity", entityId: "outer" },
                    holes: [{ kind: "entity", entityId: "hole" }]
                  }
                ]
              },
              operationMode: "newBody",
              depth: 5,
              side: "positive",
              bodyId: "body_region"
            }
          : {
              id: "feature_region",
              kind: "revolve",
              profile: {
                kind: "regions",
                sketchId: "sketch_1",
                regions: [
                  {
                    outer: { kind: "entity", entityId: "outer" },
                    holes: [{ kind: "entity", entityId: "hole" }]
                  }
                ]
              },
              axis: {
                type: "sketchLine",
                sketchId: "sketch_1",
                entityId: "axis"
              },
              angleDegrees: 180,
              operationMode: "newBody",
              bodyId: "body_region"
            }
      ],
      nextFeatureNumber: 2,
      nextBodyNumber: 2
    }
  };
  return importCadProject(project);
}

function createImportedWireRegionFeatureEngine(): {
  readonly engine: CadEngine;
  readonly profile: SketchRegionsProfileRef;
} {
  const source = new CadEngine();
  source.applyBatch([
    { op: "sketch.create", id: "sketch_1", name: "Wire", plane: "XY" },
    {
      op: "sketch.addLine",
      sketchId: "sketch_1",
      id: "bottom",
      start: [-5, -5],
      end: [5, -5]
    },
    {
      op: "sketch.addLine",
      sketchId: "sketch_1",
      id: "right",
      start: [5, -5],
      end: [5, 5]
    },
    {
      op: "sketch.addLine",
      sketchId: "sketch_1",
      id: "top",
      start: [5, 5],
      end: [-5, 5]
    },
    {
      op: "sketch.addLine",
      sketchId: "sketch_1",
      id: "left",
      start: [-5, 5],
      end: [-5, -5]
    }
  ]);
  const discovery = source.executeQuery({
    version: "cadops.v1",
    query: {
      query: "sketch.profileRegionCandidates",
      sketchId: "sketch_1"
    }
  });
  if (!discovery.ok || discovery.query !== "sketch.profileRegionCandidates") {
    throw new Error("Expected a discoverable wire region fixture.");
  }
  const region = discovery.candidates.find(
    (candidate) => candidate.region.outer.kind === "wire"
  )?.region;
  if (!region) {
    throw new Error("Expected a wire-backed region candidate.");
  }
  const profile: SketchRegionsProfileRef = {
    kind: "regions",
    sketchId: "sketch_1",
    regions: [region]
  };
  const base = exportCadProject(source);
  return {
    profile,
    engine: importCadProject({
      ...base,
      schemaVersion: "web-cad.project.v22",
      history: [],
      redoStack: [],
      document: {
        ...base.document,
        sketches: base.document.sketches.map((sketch) => ({
          ...sketch,
          entities: sketch.entities.map((entity) => ({
            ...entity,
            construction: false
          }))
        })),
        features: [
          {
            id: "feature_region",
            kind: "extrude",
            profile,
            operationMode: "newBody",
            depth: 5,
            side: "positive",
            bodyId: "body_region"
          }
        ],
        nextFeatureNumber: 2,
        nextBodyNumber: 2
      }
    })
  };
}

describe("V19 region query dispatch", () => {
  it("returns real engine-backed discovery pages and validation summaries", () => {
    const engine = createRegionEngine();
    const before = exportCadProject(engine);
    const candidates = engine.executeQuery({
      version: "cadops.v1",
      query: {
        query: "sketch.profileRegionCandidates",
        sketchId: "sketch_1",
        limit: 2
      }
    });

    expect(candidates.ok).toBe(true);
    expect(candidates.query).toBe("sketch.profileRegionCandidates");
    if (
      !candidates.ok ||
      candidates.query !== "sketch.profileRegionCandidates"
    ) {
      return;
    }
    const candidatePage =
      candidates as SketchProfileRegionCandidatesQueryResponse;
    expect(candidatePage).toMatchObject({
      status: "ready",
      candidateCount: 4,
      hasMore: true
    });
    expect(candidatePage.candidates).toHaveLength(2);
    expect(candidatePage.sourceRevision).toMatch(
      /^partbench-source-v1:[0-9a-f]{64}$/
    );

    const selected = candidatePage.candidates[0]!;
    const profile: SketchRegionsProfileRef = {
      kind: "regions",
      sketchId: "sketch_1",
      regions: [selected.region]
    };
    const validation = engine.executeQuery({
      version: "cadops.v1",
      query: {
        query: "sketch.profileRegionValidate",
        profile
      }
    });
    expect(validation.ok).toBe(true);
    expect(validation.query).toBe("sketch.profileRegionValidate");
    if (!validation.ok || validation.query !== "sketch.profileRegionValidate") {
      return;
    }
    const validationResponse =
      validation as SketchProfileRegionValidateQueryResponse;
    expect(validationResponse.status).toBe("ready");
    expect(validationResponse.normalizedProfile).toEqual(profile);
    expect(validationResponse.loopSummaries).not.toHaveLength(0);
    expect(validationResponse.diagnostics).toEqual([]);
    expect(exportCadProject(engine)).toEqual(before);
  });

  it("links V17 candidates and applies the bounded region consumer matrix", () => {
    const engine = createRegionEngine();
    const legacy = engine.executeQuery({
      version: "cadops.v1",
      query: {
        query: "sketch.profileCandidates",
        sketchId: "sketch_1"
      }
    });
    expect(legacy.ok).toBe(true);
    expect(legacy.query).toBe("sketch.profileCandidates");
    if (!legacy.ok || legacy.query !== "sketch.profileCandidates") return;
    expect(legacy.candidates).not.toHaveLength(0);
    expect(
      legacy.candidates.every(
        (candidate) => candidate.regionCandidateKey !== undefined
      )
    ).toBe(true);

    const oneRegion: SketchRegionsProfileRef = {
      kind: "regions",
      sketchId: "sketch_1",
      regions: [
        {
          outer: { kind: "entity", entityId: "outer" },
          holes: [{ kind: "entity", entityId: "hole" }]
        }
      ]
    };
    const multipleRegions: SketchRegionsProfileRef = {
      kind: "regions",
      sketchId: "sketch_1",
      regions: [
        oneRegion.regions[0],
        {
          outer: { kind: "entity", entityId: "other" },
          holes: []
        }
      ]
    };
    const extrudeOne = engine.executeQuery({
      version: "cadops.v1",
      query: {
        query: "sketch.profileReadiness",
        profile: oneRegion,
        consumer: { featureKind: "extrude", operationMode: "newBody" }
      }
    });
    const extrudeMultipleNewBody = engine.executeQuery({
      version: "cadops.v1",
      query: {
        query: "sketch.profileReadiness",
        profile: multipleRegions,
        consumer: { featureKind: "extrude", operationMode: "newBody" }
      }
    });
    const extrudeMultipleAdd = engine.executeQuery({
      version: "cadops.v1",
      query: {
        query: "sketch.profileReadiness",
        profile: multipleRegions,
        consumer: { featureKind: "extrude", operationMode: "add" }
      }
    });
    const revolveMultiple = engine.executeQuery({
      version: "cadops.v1",
      query: {
        query: "sketch.profileReadiness",
        profile: multipleRegions,
        consumer: { featureKind: "revolve", operationMode: "newBody" }
      }
    });
    const sweep = engine.executeQuery({
      version: "cadops.v1",
      query: {
        query: "sketch.profileReadiness",
        profile: oneRegion,
        consumer: { featureKind: "sweep", operationMode: "newBody" }
      }
    });

    expect(extrudeOne).toMatchObject({
      ok: true,
      query: "sketch.profileReadiness",
      status: "ready",
      consumerCompatibility: { status: "ready" },
      normalizedProfile: oneRegion
    });
    expect(extrudeMultipleNewBody).toMatchObject({
      ok: true,
      status: "blocked",
      consumerCompatibility: {
        status: "blocked",
        diagnostics: [
          expect.objectContaining({
            code: "SKETCH_REGION_CONSUMER_UNSUPPORTED"
          })
        ]
      }
    });
    expect(
      validateSketchProfilePathQueryResponse(extrudeMultipleNewBody)
    ).toEqual({ ok: true, value: extrudeMultipleNewBody });
    expect(extrudeMultipleAdd).toMatchObject({
      ok: true,
      status: "blocked",
      consumerCompatibility: { status: "ready" },
      targetCompatibility: { status: "missing" }
    });
    expect(revolveMultiple).toMatchObject({
      ok: true,
      status: "blocked",
      consumerCompatibility: { status: "blocked" }
    });
    expect(sweep).toMatchObject({
      ok: true,
      status: "blocked",
      consumerCompatibility: { status: "blocked" }
    });
  });

  it("returns typed missing-sketch errors for both region queries", () => {
    const engine = new CadEngine();
    const candidates = engine.executeQuery({
      version: "cadops.v1",
      query: {
        query: "sketch.profileRegionCandidates",
        sketchId: "missing"
      }
    });
    const validation = engine.executeQuery({
      version: "cadops.v1",
      query: {
        query: "sketch.profileRegionValidate",
        profile: {
          kind: "regions",
          sketchId: "missing",
          regions: [
            {
              outer: { kind: "entity", entityId: "circle" },
              holes: []
            }
          ]
        }
      }
    });

    expect(candidates).toMatchObject({
      ok: false,
      query: "sketch.profileRegionCandidates",
      error: { code: "SKETCH_NOT_FOUND", sketchId: "missing" }
    });
    expect(validation).toMatchObject({
      ok: false,
      query: "sketch.profileRegionValidate",
      error: { code: "SKETCH_NOT_FOUND", sketchId: "missing" }
    });
  });

  it("applies the strict V19 query envelope before dispatch", () => {
    const engine = createRegionEngine();
    const unknownField = engine.executeQuery({
      version: "cadops.v1",
      query: {
        query: "sketch.profileRegionCandidates",
        sketchId: "sketch_1",
        screenshot: "pixels"
      }
    } as never);
    const unpairedCursor = engine.executeQuery({
      version: "cadops.v1",
      query: {
        query: "sketch.profileRegionCandidates",
        sketchId: "sketch_1",
        afterCandidateKey: "candidate"
      }
    } as never);

    expect(unknownField).toMatchObject({
      ok: false,
      query: "sketch.profileRegionCandidates",
      error: { code: "INVALID_QUERY" }
    });
    expect(unpairedCursor).toMatchObject({
      ok: false,
      query: "sketch.profileRegionCandidates",
      error: { code: "INVALID_QUERY" }
    });
  });

  it("projects imported region source through summaries, dependency health, and editability", () => {
    const engine = createImportedRegionFeatureEngine();
    const features = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "project.features" }
    });
    expect(features).toMatchObject({
      ok: true,
      query: "project.features",
      features: [
        {
          id: "feature_region",
          profile: { kind: "regions" }
        }
      ]
    });

    const dependencyGraph = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "project.dependencyGraph" }
    });
    expect(dependencyGraph.ok).toBe(true);
    expect(dependencyGraph.query).toBe("project.dependencyGraph");
    if (
      !dependencyGraph.ok ||
      dependencyGraph.query !== "project.dependencyGraph"
    ) {
      return;
    }
    expect(
      dependencyGraph.edges
        .filter(
          (edge) =>
            edge.kind === "sources" &&
            edge.sourceFeatureId === "feature_region" &&
            edge.from.startsWith("sketch-entity:")
        )
        .map((edge) => edge.from)
    ).toEqual(["sketch-entity:sketch_1:outer", "sketch-entity:sketch_1:hole"]);

    const health = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "project.health" }
    });
    expect(health).toMatchObject({
      ok: true,
      query: "project.health",
      authoredExtrudes: [
        {
          featureId: "feature_region",
          profileKind: "regions",
          sourceEntityIds: ["outer", "hole"],
          status: "unsupported",
          issues: [
            expect.objectContaining({
              code: "UNSUPPORTED_BODY_REFERENCES"
            })
          ]
        }
      ]
    });

    const editability = engine.executeQuery({
      version: "cadops.v1",
      query: {
        query: "feature.editability",
        featureId: "feature_region"
      }
    });
    expect(editability).toMatchObject({
      ok: true,
      query: "feature.editability",
      status: "blocked"
    });

    for (const query of [
      "project.summary",
      "project.rebuildPlan",
      "reference.health",
      "project.packageReadiness",
      "project.exportReadiness"
    ] as const) {
      const response = engine.executeQuery({
        version: "cadops.v1",
        query: { query }
      });
      expect(response.query).toBe(query);
    }

    for (const query of ["body.topology", "body.massProperties"] as const) {
      const response = engine.executeQuery({
        version: "cadops.v1",
        query: { query, bodyId: "body_region" }
      });
      expect(response.query).toBe(query);
    }
  });

  it("keeps region refs authored and reports containment health after a sketch edit", () => {
    const engine = createImportedRegionFeatureEngine();
    const topologyBefore = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "body.topology", bodyId: "body_region" }
    });
    expect(topologyBefore.ok).toBe(true);
    expect(topologyBefore.query).toBe("body.topology");
    if (!topologyBefore.ok || topologyBefore.query !== "body.topology") return;
    const sourceIdentityBefore =
      topologyBefore.topology.sourceIdentity.signature;

    expect(() =>
      engine.applyBatch([
        {
          op: "sketch.deleteEntity",
          sketchId: "sketch_1",
          entityId: "hole"
        }
      ])
    ).toThrow(/used by feature feature_region/);
    engine.applyBatch([
      {
        op: "sketch.updateEntity",
        sketchId: "sketch_1",
        entity: {
          id: "hole",
          kind: "circle",
          center: [20, 0],
          radius: 4,
          construction: false
        }
      }
    ]);

    const invalidReadiness = engine.executeQuery({
      version: "cadops.v1",
      query: {
        query: "sketch.profileReadiness",
        profile: {
          kind: "regions",
          sketchId: "sketch_1",
          regions: [
            {
              outer: { kind: "entity", entityId: "outer" },
              holes: [{ kind: "entity", entityId: "hole" }]
            }
          ]
        },
        consumer: { featureKind: "extrude", operationMode: "newBody" }
      }
    });
    expect(invalidReadiness).toMatchObject({
      ok: true,
      status: "blocked",
      diagnostics: [
        expect.objectContaining({ code: "SKETCH_REGION_HOLE_OUTSIDE" })
      ]
    });
    expect(validateSketchProfilePathQueryResponse(invalidReadiness)).toEqual({
      ok: true,
      value: invalidReadiness
    });

    const topologyAfter = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "body.topology", bodyId: "body_region" }
    });
    expect(topologyAfter.ok).toBe(true);
    expect(topologyAfter.query).toBe("body.topology");
    if (!topologyAfter.ok || topologyAfter.query !== "body.topology") return;
    expect(topologyAfter.topology.sourceIdentity.signature).not.toBe(
      sourceIdentityBefore
    );
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: {
          query: "body.topology",
          bodyId: "body_region",
          derivedExactMetadata: {
            bodyId: "body_region",
            sourceIdentitySignature: sourceIdentityBefore,
            status: "unsupported"
          }
        }
      })
    ).toMatchObject({
      ok: true,
      topology: {
        status: "stale",
        issues: expect.arrayContaining([
          expect.objectContaining({
            code: "STALE_BODY_TOPOLOGY"
          })
        ])
      }
    });

    const saved = exportCadProject(engine);
    expect(saved.document.features[0]).toMatchObject({
      id: "feature_region",
      profile: {
        kind: "regions",
        regions: [
          {
            outer: { entityId: "outer" },
            holes: [{ entityId: "hole" }]
          }
        ]
      }
    });
    const health = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "project.health" }
    });
    expect(health.ok).toBe(true);
    expect(health.query).toBe("project.health");
    if (!health.ok || health.query !== "project.health") return;
    expect(health.authoredExtrudes[0]).toMatchObject({
      featureId: "feature_region",
      status: "unsupported"
    });
    expect(
      health.authoredExtrudes[0]?.issues.map((issue) => issue.code)
    ).toContain("SKETCH_REGION_CONTAINMENT_INVALID");
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: {
          query: "feature.editability",
          featureId: "feature_region"
        }
      })
    ).toMatchObject({
      ok: true,
      status: "blocked",
      diagnostics: expect.arrayContaining([
        expect.objectContaining({
          code: "SKETCH_REGION_HOLE_OUTSIDE"
        }),
        expect.objectContaining({
          code: "FEATURE_EDIT_UNSUPPORTED"
        })
      ])
    });

    engine.undo();
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: { query: "project.health" }
      })
    ).toMatchObject({
      ok: true,
      authoredExtrudes: [
        {
          featureId: "feature_region",
          status: "unsupported",
          issues: [
            expect.objectContaining({
              code: "UNSUPPORTED_BODY_REFERENCES"
            })
          ]
        }
      ]
    });

    engine.redo();
    const reloaded = importCadProject(exportCadProject(engine));
    expect(
      reloaded.executeQuery({
        version: "cadops.v1",
        query: { query: "project.health" }
      })
    ).toMatchObject({
      ok: true,
      authoredExtrudes: [
        {
          featureId: "feature_region",
          status: "unsupported",
          issues: expect.arrayContaining([
            expect.objectContaining({
              code: "SKETCH_REGION_CONTAINMENT_INVALID"
            })
          ])
        }
      ]
    });
  });

  it("reloads retained wire winding drift only with a replayable baseline", () => {
    const { engine, profile } = createImportedWireRegionFeatureEngine();
    engine.applyBatch([
      {
        op: "sketch.updateEntity",
        sketchId: "sketch_1",
        entity: {
          id: "bottom",
          kind: "line",
          start: [5, -5],
          end: [-5, -5],
          construction: false
        }
      },
      {
        op: "sketch.updateEntity",
        sketchId: "sketch_1",
        entity: {
          id: "right",
          kind: "line",
          start: [-5, -5],
          end: [-5, 5],
          construction: false
        }
      },
      {
        op: "sketch.updateEntity",
        sketchId: "sketch_1",
        entity: {
          id: "top",
          kind: "line",
          start: [-5, 5],
          end: [5, 5],
          construction: false
        }
      },
      {
        op: "sketch.updateEntity",
        sketchId: "sketch_1",
        entity: {
          id: "left",
          kind: "line",
          start: [5, 5],
          end: [5, -5],
          construction: false
        }
      }
    ]);

    const saved = exportCadProject(engine);
    expect(saved.historyBaseline).toBeDefined();
    expect(saved.document.features[0]).toMatchObject({ profile });
    const reloaded = importCadProject(saved);
    expect(exportCadProject(reloaded).document.features[0]).toMatchObject({
      profile
    });

    const {
      historyBaseline: _historyBaseline,
      ...savedWithoutHistoryBaseline
    } = saved;
    expect(() =>
      importCadProject({
        ...savedWithoutHistoryBaseline,
        history: [],
        redoStack: []
      })
    ).toThrow(/winding.*canonical/);
  });

  it("changes region revolve source identity after retained profile edits", () => {
    const engine = createImportedRegionFeatureEngine("revolve");
    const before = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "body.topology", bodyId: "body_region" }
    });
    expect(before.ok).toBe(true);
    expect(before.query).toBe("body.topology");
    if (!before.ok || before.query !== "body.topology") return;

    engine.applyBatch([
      {
        op: "sketch.updateEntity",
        sketchId: "sketch_1",
        entity: {
          id: "outer",
          kind: "rectangle",
          center: [0, 0],
          width: 22,
          height: 20,
          construction: false
        }
      }
    ]);
    const after = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "body.topology", bodyId: "body_region" }
    });
    expect(after.ok).toBe(true);
    expect(after.query).toBe("body.topology");
    if (!after.ok || after.query !== "body.topology") return;
    expect(after.topology.sourceIdentity.signature).not.toBe(
      before.topology.sourceIdentity.signature
    );
  });

  it("includes bounded target lineage in region boolean source identity", () => {
    const source = createRegionEngine();
    source.applyBatch([
      {
        op: "sketch.addRectangle",
        sketchId: "sketch_1",
        id: "target_profile",
        center: [40, 0],
        width: 10,
        height: 10
      }
    ]);
    const base = exportCadProject(source);
    const engine = importCadProject({
      ...base,
      schemaVersion: "web-cad.project.v22",
      history: [],
      redoStack: [],
      document: {
        ...base.document,
        sketches: base.document.sketches.map((sketch) => ({
          ...sketch,
          entities: sketch.entities.map((entity) => ({
            ...entity,
            construction: false
          }))
        })),
        features: [
          {
            id: "feat_1",
            kind: "extrude",
            profile: {
              kind: "entity",
              sketchId: "sketch_1",
              entityId: "target_profile"
            },
            operationMode: "newBody",
            depth: 5,
            side: "positive",
            bodyId: "body_1"
          },
          {
            id: "feat_2",
            kind: "extrude",
            profile: {
              kind: "regions",
              sketchId: "sketch_1",
              regions: [
                {
                  outer: { kind: "entity", entityId: "outer" },
                  holes: [{ kind: "entity", entityId: "hole" }]
                }
              ]
            },
            operationMode: "add",
            targetBodyId: "body_1",
            depth: 5,
            side: "positive",
            bodyId: "body_2"
          }
        ],
        nextFeatureNumber: 3,
        nextBodyNumber: 3
      }
    });
    const before = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "body.topology", bodyId: "body_2" }
    });
    expect(before.ok).toBe(true);
    expect(before.query).toBe("body.topology");
    if (!before.ok || before.query !== "body.topology") return;

    engine.applyBatch([
      {
        op: "sketch.updateEntity",
        sketchId: "sketch_1",
        entity: {
          id: "target_profile",
          kind: "rectangle",
          center: [40, 0],
          width: 12,
          height: 10,
          construction: false
        }
      }
    ]);
    const after = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "body.topology", bodyId: "body_2" }
    });
    expect(after.ok).toBe(true);
    expect(after.query).toBe("body.topology");
    if (!after.ok || after.query !== "body.topology") return;
    expect(after.topology.sourceIdentity.signature).not.toBe(
      before.topology.sourceIdentity.signature
    );
  });

  it("keeps region feature create and update commands disabled until geometry slices", () => {
    const profile: SketchRegionsProfileRef = {
      kind: "regions",
      sketchId: "sketch_1",
      regions: [
        {
          outer: { kind: "entity", entityId: "outer" },
          holes: [{ kind: "entity", entityId: "hole" }]
        }
      ]
    };
    const createEngine = createRegionEngine();
    createEngine.applyBatch([
      {
        op: "sketch.addLine",
        sketchId: "sketch_1",
        id: "axis",
        start: [-15, 0],
        end: [-15, 10]
      }
    ]);

    expect(() =>
      createEngine.applyBatch([
        {
          op: "feature.extrude",
          id: "blocked_extrude",
          profile,
          operationMode: "newBody",
          depth: 5,
          side: "positive"
        }
      ])
    ).toThrow(/Region feature\.extrude remains disabled/);
    expect(() =>
      createEngine.applyBatch([
        {
          op: "feature.revolve",
          id: "blocked_revolve",
          profile,
          axis: {
            type: "sketchLine",
            sketchId: "sketch_1",
            entityId: "axis"
          },
          angleDegrees: 180,
          operationMode: "newBody"
        }
      ])
    ).toThrow(/Region feature\.revolve remains disabled/);

    const extrude = createImportedRegionFeatureEngine();
    expect(() =>
      extrude.applyBatch([
        {
          op: "feature.updateExtrude",
          id: "feature_region",
          depth: 6
        }
      ])
    ).toThrow(/cannot be edited.*region extrude geometry slice/);

    const revolve = createImportedRegionFeatureEngine("revolve");
    expect(() =>
      revolve.applyBatch([
        {
          op: "feature.updateRevolve",
          id: "feature_region",
          angleDegrees: 270
        }
      ])
    ).toThrow(/cannot be edited.*region revolve geometry slice/);
  });
});
