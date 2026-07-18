import type {
  CadBodyDerivedExactMetadataSnapshot,
  CadOp
} from "@web-cad/cad-protocol";
import { describe, expect, it } from "vitest";

import {
  CadEngine,
  exportCadProject,
  exportCadProjectJson,
  exportCadProjectToWcad,
  importCadProject,
  importCadProjectJson,
  readCadProjectWcad
} from "./index";
import { SKETCH_GEOMETRY_POLICY } from "./sketchGeometryPolicy";

const profile = {
  kind: "wire" as const,
  sketchId: "sketch_revolve",
  segments: [
    { entityId: "diameter", orientation: "forward" as const },
    { entityId: "arc", orientation: "forward" as const }
  ]
};

function createEngine(): CadEngine {
  const engine = new CadEngine();
  engine.applyBatch([
    {
      op: "sketch.create",
      id: "sketch_revolve",
      name: "Composite revolve",
      plane: "XY"
    },
    {
      op: "sketch.addLine",
      sketchId: "sketch_revolve",
      id: "diameter",
      start: [1, -1],
      end: [1, 1]
    },
    {
      op: "sketch.addArc",
      sketchId: "sketch_revolve",
      id: "arc",
      definition: {
        kind: "centerAngles",
        center: [1, 0],
        radius: 1,
        startAngleDegrees: 90,
        sweepAngleDegrees: -180
      }
    },
    {
      op: "sketch.addLine",
      sketchId: "sketch_revolve",
      id: "axis",
      start: [0, -2],
      end: [0, 2],
      construction: true
    }
  ]);
  return engine;
}

function createAttachedEngine(): CadEngine {
  const engine = new CadEngine();
  engine.applyBatch([
    { op: "sketch.create", id: "sketch_parent", name: "Parent", plane: "XY" },
    {
      op: "sketch.addRectangle",
      sketchId: "sketch_parent",
      id: "parent_profile",
      center: [0, 0],
      width: 6,
      height: 4
    },
    {
      op: "feature.extrude",
      id: "feature_parent",
      bodyId: "body_parent",
      sketchId: "sketch_parent",
      entityId: "parent_profile",
      depth: 5
    }
  ]);
  engine.apply({
    op: "sketch.createOnFace",
    id: "sketch_revolve",
    name: "Attached composite revolve",
    bodyId: "body_parent",
    faceStableId: "generated:face:body_parent:endCap"
  });
  engine.applyBatch([
    {
      op: "sketch.addLine",
      sketchId: "sketch_revolve",
      id: "diameter",
      start: [1, -1],
      end: [1, 1]
    },
    {
      op: "sketch.addArc",
      sketchId: "sketch_revolve",
      id: "arc",
      definition: {
        kind: "centerAngles",
        center: [1, 0],
        radius: 1,
        startAngleDegrees: 90,
        sweepAngleDegrees: -180
      }
    },
    {
      op: "sketch.addLine",
      sketchId: "sketch_revolve",
      id: "axis",
      start: [0, -2],
      end: [0, 2],
      construction: true
    },
    revolveOp()
  ]);
  return engine;
}

function revolveOp() {
  return {
    op: "feature.revolve" as const,
    id: "feature_revolve",
    bodyId: "body_revolve",
    profile,
    axis: {
      type: "sketchLine" as const,
      sketchId: "sketch_revolve",
      entityId: "axis"
    },
    angleDegrees: 270,
    operationMode: "newBody" as const
  };
}

function topologySignature(engine: CadEngine): string {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "body.topology", bodyId: "body_revolve" }
  });
  if (!response.ok || response.query !== "body.topology")
    throw new Error("topology");
  return response.topology.sourceIdentity.signature;
}

function exactMetadata(
  engine: CadEngine,
  solidCount = 1,
  signature = topologySignature(engine)
): CadBodyDerivedExactMetadataSnapshot {
  return {
    bodyId: "body_revolve",
    sourceIdentitySignature: signature,
    status: "ready",
    metadata: {
      source: "kernel-derived",
      confidence: "kernel-derived",
      bounds: {
        min: [-2, -2, -1],
        max: [2, 2, 1],
        size: [4, 4, 2],
        center: [0, 0, 0]
      },
      volume: 12,
      surfaceArea: 30,
      centroid: [0, 0, 0],
      topologyCounts: {
        solidCount,
        faceCount: 4,
        edgeCount: 8,
        vertexCount: 4
      },
      diagnostics: []
    }
  };
}

describe("V17 composite wire revolve core", () => {
  it("normalizes dry-run and commit identically with ordered semantic input evidence", () => {
    const engine = createEngine();
    const dryRun = engine.executeBatch({
      version: "cadops.v1",
      mode: "dryRun",
      ops: [revolveOp()]
    });
    expect(dryRun).toMatchObject({
      ok: true,
      mode: "dryRun",
      semanticDiff: {
        features: {
          created: [
            expect.objectContaining({
              id: "feature_revolve",
              profile: expect.objectContaining({ kind: "wire" })
            })
          ],
          inputReferences: [
            expect.objectContaining({
              featureId: "feature_revolve",
              inputKind: "profile",
              profileOrientationNormalized: true,
              affectedEntityIds: ["arc", "diameter"]
            })
          ]
        }
      }
    });
    expect(engine.getDocument().features.size).toBe(0);
    const committed = engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [revolveOp()]
    });
    expect(committed.ok).toBe(true);
    expect(engine.getDocument().features.get("feature_revolve")).toMatchObject({
      profile: { kind: "wire" },
      operationMode: "newBody",
      angleDegrees: 270
    });
  });

  it("updates profile/angle atomically and exposes summary, dependencies, rebuild, and editability", () => {
    const engine = createEngine();
    engine.apply(revolveOp());
    expect(
      engine.apply({
        op: "feature.updateRevolve",
        id: "feature_revolve",
        profile,
        angleDegrees: 180
      }).transaction.diff.features?.inputReferences
    ).toContainEqual(expect.objectContaining({ inputKind: "profile" }));
    const structure = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "project.structure" }
    });
    expect(structure).toMatchObject({
      ok: true,
      features: [
        expect.objectContaining({
          id: "feature_revolve",
          profile: expect.objectContaining({ kind: "wire" }),
          angleDegrees: 180
        })
      ]
    });
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: { query: "project.dependencyGraph" }
      })
    ).toMatchObject({
      ok: true,
      edges: expect.arrayContaining([
        expect.objectContaining({
          from: "sketch-entity:sketch_revolve:diameter",
          label: "profile source"
        }),
        expect.objectContaining({
          from: "sketch-entity:sketch_revolve:arc",
          label: "profile source"
        }),
        expect.objectContaining({
          from: "sketch-entity:sketch_revolve:axis",
          label: "axis source"
        })
      ])
    });
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: {
          query: "feature.editability",
          featureId: "feature_revolve",
          proposedEdit: { kind: "revolve", profile, angleDegrees: 90 }
        }
      })
    ).toMatchObject({
      ok: true,
      status: "editable",
      fields: expect.arrayContaining([
        {
          path: "profile",
          label: "Profile",
          valueType: "reference",
          editable: true,
          commitOperation: "feature.updateRevolve",
          diagnostics: []
        }
      ]),
      dryRun: { status: "valid" }
    });
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: {
          query: "feature.editability",
          featureId: "feature_revolve",
          proposedEdit: {
            kind: "revolve",
            profile: {
              kind: "entity",
              sketchId: "sketch_revolve",
              entityId: "missing"
            }
          }
        }
      })
    ).toMatchObject({
      ok: true,
      dryRun: {
        status: "blocked",
        diagnostics: expect.arrayContaining([
          expect.objectContaining({ code: "FEATURE_EDIT_INVALID_PROPOSAL" })
        ])
      }
    });
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: {
          query: "feature.editability",
          featureId: "feature_revolve",
          proposedEdit: {
            kind: "revolve",
            profile: {
              ...profile,
              segments: [
                ...profile.segments,
                { entityId: "axis", orientation: "forward" }
              ]
            }
          }
        }
      })
    ).toMatchObject({
      ok: true,
      dryRun: {
        status: "blocked",
        diagnostics: expect.arrayContaining([
          expect.objectContaining({ code: "FEATURE_EDIT_INVALID_PROPOSAL" })
        ])
      }
    });
  });

  it("requires current exactly-one-solid evidence for topology, health, mass, and extents but exports a rebuildable STEP recipe", () => {
    const engine = createEngine();
    engine.apply(revolveOp());
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: { query: "project.health" }
      })
    ).toMatchObject({
      ok: true,
      authoredRevolves: [
        expect.objectContaining({
          profileKind: "wire",
          sourceEntityIds: expect.arrayContaining(["diameter", "arc"]),
          status: "unsupported"
        })
      ]
    });
    const ready = exactMetadata(engine);
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: { query: "project.health", derivedExactMetadata: [ready] }
      })
    ).toMatchObject({
      ok: true,
      authoredRevolves: [
        expect.objectContaining({
          status: "healthy",
          topologyStatus: "healthy"
        })
      ]
    });
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: {
          query: "body.massProperties",
          bodyId: "body_revolve",
          derivedExactMetadata: ready
        }
      })
    ).toMatchObject({ ok: true, massProperties: { volume: 12 } });
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: { query: "project.extents", derivedExactMetadata: [ready] }
      })
    ).toMatchObject({
      ok: true,
      bodies: [expect.objectContaining({ volume: 12 })]
    });
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: {
          query: "project.exportExact",
          format: "step",
          bodyIds: ["body_revolve"]
        }
      })
    ).toMatchObject({
      ok: true,
      available: true,
      exportSources: [
        expect.objectContaining({
          sourceKind: "authoredRevolve",
          angleDegrees: 270,
          solidPolicy: "exactlyOne",
          profile: expect.objectContaining({ kind: "wire" }),
          axis: expect.objectContaining({ sourceEntityId: "axis" })
        })
      ]
    });
    for (const solidCount of [0, 2]) {
      const invalidEvidence = exactMetadata(engine, solidCount);
      expect(
        engine.executeQuery({
          version: "cadops.v1",
          query: {
            query: "body.topology",
            bodyId: "body_revolve",
            derivedExactMetadata: invalidEvidence
          }
        })
      ).toMatchObject({
        ok: true,
        topology: {
          status: "kernel-failed",
          issues: expect.arrayContaining([
            expect.objectContaining({
              code: "INVALID_EXACT_GEOMETRY_RESULT",
              expected: "solidCount=1"
            })
          ])
        }
      });
      expect(
        engine.executeQuery({
          version: "cadops.v1",
          query: {
            query: "project.health",
            derivedExactMetadata: [invalidEvidence]
          }
        })
      ).toMatchObject({
        ok: true,
        authoredRevolves: [
          expect.objectContaining({
            status: "unsupported",
            topologyStatus: "kernel-failed",
            issues: expect.arrayContaining([
              expect.objectContaining({
                code: "INVALID_EXACT_GEOMETRY_RESULT"
              })
            ])
          })
        ]
      });
    }
  });

  it("uses exact composite-revolve codes and keeps invalid commands atomic", () => {
    const engine = createEngine();
    engine.apply({
      op: "sketch.addLine",
      sketchId: "sketch_revolve",
      id: "crossing_axis",
      start: [1.5, -2],
      end: [1.5, 2],
      construction: true
    });
    const crossing = engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          ...revolveOp(),
          axis: {
            type: "sketchLine",
            sketchId: "sketch_revolve",
            entityId: "crossing_axis"
          }
        }
      ]
    });
    expect(crossing).toMatchObject({
      ok: false,
      error: { code: "COMPOSITE_REVOLVE_AXIS_INTERSECTION" }
    });
    expect(engine.getDocument().features.size).toBe(0);
    expect(
      engine.executeBatch({
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            ...revolveOp(),
            operationMode: "add"
          } as unknown as CadOp
        ]
      })
    ).toMatchObject({
      ok: false,
      error: { code: "UNSUPPORTED_FEATURE_OPERATION" }
    });
  });

  it("enforces the composite axis boundary matrix while allowing profile-vertex touch", () => {
    const touching = createEngine();
    touching.apply({
      op: "sketch.addLine",
      sketchId: "sketch_revolve",
      id: "touch_axis",
      start: [-2, 1],
      end: [2, 1],
      construction: true
    });
    expect(
      touching.executeBatch({
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            ...revolveOp(),
            axis: {
              type: "sketchLine",
              sketchId: "sketch_revolve",
              entityId: "touch_axis"
            },
            angleDegrees: 360
          }
        ]
      })
    ).toMatchObject({ ok: true });

    const engine = createEngine();
    engine.applyBatch([
      {
        op: "sketch.addLine",
        sketchId: "sketch_revolve",
        id: "overlap_axis",
        start: [1, -2],
        end: [1, 2],
        construction: true
      },
      {
        op: "sketch.addLine",
        sketchId: "sketch_revolve",
        id: "tolerance_axis",
        start: [0, 0],
        end: [0, SKETCH_GEOMETRY_POLICY.linearTolerance],
        construction: true
      },
      {
        op: "sketch.addLine",
        sketchId: "sketch_revolve",
        id: "above_tolerance_axis",
        start: [0, 0],
        end: [0, SKETCH_GEOMETRY_POLICY.linearTolerance * 1.01],
        construction: true
      },
      {
        op: "sketch.addLine",
        sketchId: "sketch_revolve",
        id: "zero_axis",
        start: [3, 3],
        end: [3, 3],
        construction: true
      },
      {
        op: "sketch.addCircle",
        sketchId: "sketch_revolve",
        id: "circle_axis",
        center: [3, 0],
        radius: 1,
        construction: true
      },
      { op: "sketch.create", id: "other_sketch", name: "Other", plane: "XY" },
      {
        op: "sketch.addLine",
        sketchId: "other_sketch",
        id: "other_axis",
        start: [0, -1],
        end: [0, 1],
        construction: true
      }
    ]);
    const cases = [
      {
        axis: { sketchId: "sketch_revolve", entityId: "overlap_axis" },
        code: "COMPOSITE_REVOLVE_AXIS_INTERSECTION"
      },
      {
        axis: { sketchId: "sketch_revolve", entityId: "zero_axis" },
        code: "COMPOSITE_REVOLVE_PROFILE_UNSUPPORTED"
      },
      {
        axis: { sketchId: "sketch_revolve", entityId: "tolerance_axis" },
        code: "COMPOSITE_REVOLVE_PROFILE_UNSUPPORTED"
      },
      {
        axis: { sketchId: "sketch_revolve", entityId: "circle_axis" },
        code: "COMPOSITE_REVOLVE_PROFILE_UNSUPPORTED"
      },
      {
        axis: { sketchId: "other_sketch", entityId: "other_axis" },
        code: "COMPOSITE_REVOLVE_PROFILE_UNSUPPORTED"
      }
    ] as const;
    for (const testCase of cases) {
      expect(
        engine.executeBatch({
          version: "cadops.v1",
          mode: "commit",
          ops: [
            {
              ...revolveOp(),
              axis: { type: "sketchLine", ...testCase.axis }
            }
          ]
        })
      ).toMatchObject({ ok: false, error: { code: testCase.code } });
    }
    expect(
      engine.executeBatch({
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            ...revolveOp(),
            profile: {
              ...profile,
              segments: [
                ...profile.segments,
                { entityId: "axis", orientation: "forward" }
              ]
            }
          }
        ]
      })
    ).toMatchObject({
      ok: false,
      error: { code: "COMPOSITE_REVOLVE_PROFILE_UNSUPPORTED" }
    });
    expect(
      engine.executeBatch({
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            ...revolveOp(),
            axis: {
              type: "sketchLine",
              sketchId: "sketch_revolve",
              entityId: "above_tolerance_axis"
            }
          }
        ]
      })
    ).toMatchObject({ ok: true });
  });

  it("accepts non-construction axes and preserves either axis direction in exact export recipes", () => {
    for (const [start, end] of [
      [
        [0, -2],
        [0, 2]
      ],
      [
        [0, 2],
        [0, -2]
      ]
    ] as const) {
      const engine = createEngine();
      engine.apply({
        op: "sketch.addLine",
        sketchId: "sketch_revolve",
        id: "regular_axis",
        start,
        end
      });
      engine.apply({
        ...revolveOp(),
        axis: {
          type: "sketchLine",
          sketchId: "sketch_revolve",
          entityId: "regular_axis"
        }
      });
      expect(
        engine.executeQuery({
          version: "cadops.v1",
          query: {
            query: "project.exportExact",
            format: "step",
            bodyIds: ["body_revolve"]
          }
        })
      ).toMatchObject({
        ok: true,
        available: true,
        exportSources: [
          expect.objectContaining({
            sourceKind: "authoredRevolve",
            axis: {
              sourceEntityId: "regular_axis",
              start,
              end
            }
          })
        ]
      });
    }
  });

  it("rejects a wire that straddles the axis through profile vertices only", () => {
    const engine = new CadEngine();
    engine.apply({
      op: "sketch.create",
      id: "diamond",
      name: "Diamond",
      plane: "XY"
    });
    const points = [
      [0, 1],
      [1, 0],
      [0, -1],
      [-1, 0]
    ] as const;
    points.forEach((start, index) =>
      engine.apply({
        op: "sketch.addLine",
        sketchId: "diamond",
        id: `edge_${index}`,
        start,
        end: points[(index + 1) % points.length]!
      })
    );
    engine.apply({
      op: "sketch.addLine",
      sketchId: "diamond",
      id: "axis",
      start: [0, -2],
      end: [0, 2],
      construction: true
    });
    expect(
      engine.executeBatch({
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            op: "feature.revolve",
            id: "diamond_revolve",
            bodyId: "diamond_body",
            profile: {
              kind: "wire",
              sketchId: "diamond",
              segments: points.map((_, index) => ({
                entityId: `edge_${index}`,
                orientation: "forward" as const
              }))
            },
            axis: { type: "sketchLine", sketchId: "diamond", entityId: "axis" },
            angleDegrees: 360,
            operationMode: "newBody"
          }
        ]
      })
    ).toMatchObject({
      ok: false,
      error: { code: "COMPOSITE_REVOLVE_AXIS_INTERSECTION" }
    });
  });

  it("accepts partial and full angles and rejects values outside the finite range", () => {
    for (const angleDegrees of [45, 360]) {
      const engine = createEngine();
      expect(
        engine.executeBatch({
          version: "cadops.v1",
          mode: "commit",
          ops: [{ ...revolveOp(), angleDegrees }]
        })
      ).toMatchObject({ ok: true });
    }
    for (const angleDegrees of [0, 360.01]) {
      const engine = createEngine();
      expect(
        engine.executeBatch({
          version: "cadops.v1",
          mode: "commit",
          ops: [{ ...revolveOp(), angleDegrees }]
        })
      ).toMatchObject({ ok: false });
      expect(engine.getDocument().features.size).toBe(0);
    }
  });

  it("retains later invalid source edits, marks stale evidence, and supports delete/undo/redo/history", () => {
    const engine = createEngine();
    engine.apply(revolveOp());
    const oldEvidence = exactMetadata(engine);
    engine.apply({
      op: "sketch.updateEntity",
      sketchId: "sketch_revolve",
      entity: {
        id: "arc",
        kind: "arc",
        center: [0.5, 0],
        radius: 1,
        startAngleDegrees: 90,
        sweepAngleDegrees: -180,
        construction: false
      }
    });
    expect(engine.getDocument().features.has("feature_revolve")).toBe(true);
    expect(topologySignature(engine)).not.toBe(
      oldEvidence.sourceIdentitySignature
    );
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: {
          query: "body.topology",
          bodyId: "body_revolve",
          derivedExactMetadata: oldEvidence
        }
      })
    ).toMatchObject({ ok: true, topology: { status: "stale" } });
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: { query: "project.health", derivedExactMetadata: [oldEvidence] }
      })
    ).toMatchObject({
      ok: true,
      authoredRevolves: [
        expect.objectContaining({
          status: "stale",
          issues: expect.arrayContaining([
            expect.objectContaining({ code: "STALE_BODY_TOPOLOGY" })
          ])
        })
      ]
    });
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: { query: "project.rebuildPlan" }
      })
    ).toMatchObject({
      ok: true,
      bodyLifecycles: expect.arrayContaining([
        expect.objectContaining({
          bodyId: "body_revolve",
          commandReady: false,
          primaryState: "unsupported",
          states: expect.arrayContaining(["unsupported"]),
          diagnostics: expect.arrayContaining([
            expect.objectContaining({ code: "REBUILD_BODY_UNSUPPORTED" })
          ])
        })
      ])
    });
    engine.apply({ op: "feature.delete", id: "feature_revolve" });
    expect(engine.getDocument().features.has("feature_revolve")).toBe(false);
    engine.undo();
    expect(engine.getDocument().features.has("feature_revolve")).toBe(true);
    engine.redo();
    expect(engine.getDocument().features.has("feature_revolve")).toBe(false);
    const history = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "transaction.history" }
    });
    expect(history).toMatchObject({
      ok: true,
      transactions: expect.arrayContaining([
        expect.objectContaining({
          ops: [
            expect.objectContaining({
              label: expect.stringContaining("revolve")
            })
          ]
        })
      ])
    });
  });

  it.each([
    {
      label: "crossing",
      start: [1.5, -2] as const,
      end: [1.5, 2] as const
    },
    {
      label: "overlap",
      start: [1, -2] as const,
      end: [1, 2] as const
    }
  ])(
    "retains the feature when an existing axis is edited into $label and invalidates downstream artifacts",
    ({ start, end }) => {
      const engine = createEngine();
      engine.apply(revolveOp());
      const oldEvidence = exactMetadata(engine);
      engine.apply({
        op: "sketch.updateEntity",
        sketchId: "sketch_revolve",
        entity: {
          id: "axis",
          kind: "line",
          start,
          end,
          construction: true
        }
      });

      expect(engine.getDocument().features.has("feature_revolve")).toBe(true);
      expect(
        engine.executeQuery({
          version: "cadops.v1",
          query: {
            query: "body.topology",
            bodyId: "body_revolve",
            derivedExactMetadata: oldEvidence
          }
        })
      ).toMatchObject({
        ok: true,
        topology: {
          status: "stale",
          issues: expect.arrayContaining([
            expect.objectContaining({ code: "STALE_BODY_TOPOLOGY" })
          ])
        }
      });
      expect(
        engine.executeQuery({
          version: "cadops.v1",
          query: {
            query: "project.health",
            derivedExactMetadata: [oldEvidence]
          }
        })
      ).toMatchObject({
        ok: true,
        authoredRevolves: [
          expect.objectContaining({
            status: "stale",
            issues: expect.arrayContaining([
              expect.objectContaining({
                code: "COMPOSITE_REVOLVE_AXIS_INTERSECTION"
              })
            ])
          })
        ]
      });
      expect(
        engine.executeQuery({
          version: "cadops.v1",
          query: { query: "project.rebuildPlan" }
        })
      ).toMatchObject({
        ok: true,
        bodyLifecycles: expect.arrayContaining([
          expect.objectContaining({
            bodyId: "body_revolve",
            commandReady: false,
            primaryState: "unsupported"
          })
        ])
      });
    }
  );

  it("invalidates topology identity and exact evidence when an attached parent frame changes", () => {
    const engine = createAttachedEngine();
    const oldSignature = topologySignature(engine);
    const oldEvidence = exactMetadata(engine);
    engine.apply({
      op: "feature.updateExtrude",
      id: "feature_parent",
      depth: 7
    });
    expect(topologySignature(engine)).not.toBe(oldSignature);
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: {
          query: "body.topology",
          bodyId: "body_revolve",
          derivedExactMetadata: oldEvidence
        }
      })
    ).toMatchObject({
      ok: true,
      topology: {
        status: "stale",
        issues: expect.arrayContaining([
          expect.objectContaining({ code: "STALE_BODY_TOPOLOGY" })
        ])
      }
    });
  });

  it("round-trips a normalized profile retarget, semantic input evidence, history, and redo", async () => {
    const engine = createEngine();
    engine.applyBatch([
      {
        op: "sketch.addLine",
        sketchId: "sketch_revolve",
        id: "diameter_retarget",
        start: [2, -1],
        end: [2, 1]
      },
      {
        op: "sketch.addArc",
        sketchId: "sketch_revolve",
        id: "arc_retarget",
        definition: {
          kind: "centerAngles",
          center: [2, 0],
          radius: 1,
          startAngleDegrees: 90,
          sweepAngleDegrees: -180
        }
      }
    ]);
    engine.apply(revolveOp());
    const retargetProfile = {
      kind: "wire" as const,
      sketchId: "sketch_revolve",
      segments: [
        { entityId: "diameter_retarget", orientation: "forward" as const },
        { entityId: "arc_retarget", orientation: "forward" as const }
      ]
    };
    const update = {
      op: "feature.updateRevolve" as const,
      id: "feature_revolve",
      profile: retargetProfile,
      angleDegrees: 180
    };
    const dryRun = engine.executeBatch({
      version: "cadops.v1",
      mode: "dryRun",
      ops: [update]
    });
    const committed = engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [update]
    });
    expect(dryRun).toMatchObject({
      ok: true,
      semanticDiff: {
        features: {
          inputReferences: [
            expect.objectContaining({
              featureId: "feature_revolve",
              inputKind: "profile",
              profileOrientationNormalized: true,
              affectedEntityIds: [
                "arc",
                "diameter",
                "arc_retarget",
                "diameter_retarget"
              ],
              after: {
                kind: "wire",
                sketchId: "sketch_revolve",
                segments: [
                  { entityId: "arc_retarget", orientation: "reverse" },
                  { entityId: "diameter_retarget", orientation: "reverse" }
                ]
              }
            })
          ]
        }
      }
    });
    expect(committed).toMatchObject({
      ok: true,
      semanticDiff: {
        features: {
          inputReferences: [
            expect.objectContaining({
              featureId: "feature_revolve",
              inputKind: "profile",
              profileOrientationNormalized: true,
              affectedEntityIds: [
                "arc",
                "diameter",
                "arc_retarget",
                "diameter_retarget"
              ],
              after: {
                kind: "wire",
                sketchId: "sketch_revolve",
                segments: [
                  { entityId: "arc_retarget", orientation: "reverse" },
                  { entityId: "diameter_retarget", orientation: "reverse" }
                ]
              }
            })
          ]
        }
      }
    });
    engine.undo();
    expect(
      importCadProjectJson(exportCadProjectJson(engine)).createSnapshot()
    ).toEqual(engine.createSnapshot());
    const packed = await exportCadProjectToWcad(exportCadProject(engine));
    const read = await readCadProjectWcad(packed.bytes);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    const reopened = importCadProject(read.project);
    expect(reopened.createSnapshot()).toEqual(engine.createSnapshot());
    expect(
      reopened.redo()?.transaction.diff.features?.inputReferences
    ).toContainEqual(
      expect.objectContaining({
        featureId: "feature_revolve",
        inputKind: "profile",
        affectedEntityIds: [
          "arc",
          "diameter",
          "arc_retarget",
          "diameter_retarget"
        ]
      })
    );
    expect(
      reopened.getDocument().features.get("feature_revolve")
    ).toMatchObject({
      angleDegrees: 180,
      profile: {
        kind: "wire",
        segments: expect.arrayContaining([
          expect.objectContaining({ entityId: "diameter_retarget" }),
          expect.objectContaining({ entityId: "arc_retarget" })
        ])
      }
    });
  });
});
