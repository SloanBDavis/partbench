import { describe, expect, it } from "vitest";
import type { CadBodyDerivedExactMetadataSnapshot } from "@web-cad/cad-protocol";

import {
  CadEngine,
  exportCadProject,
  exportCadProjectJson,
  exportCadProjectToWcad,
  importCadProject,
  importCadProjectJson,
  readCadProjectWcad
} from "./index";

const profile = {
  kind: "wire" as const,
  sketchId: "sketch_wire",
  segments: [
    { entityId: "line_a", orientation: "forward" as const },
    { entityId: "line_b", orientation: "forward" as const },
    { entityId: "line_c", orientation: "forward" as const },
    { entityId: "line_d", orientation: "forward" as const }
  ]
};

function createEngine(): CadEngine {
  const engine = new CadEngine();
  engine.applyBatch([
    { op: "sketch.create", id: "sketch_target", name: "Target", plane: "XY" },
    {
      op: "sketch.addRectangle",
      sketchId: "sketch_target",
      id: "rectangle_target",
      center: [0, 0],
      width: 8,
      height: 6
    },
    {
      op: "feature.extrude",
      id: "feature_target",
      bodyId: "body_target",
      sketchId: "sketch_target",
      entityId: "rectangle_target",
      depth: 4
    },
    { op: "sketch.create", id: "sketch_wire", name: "Cut wire", plane: "XY" },
    {
      op: "sketch.addLine",
      sketchId: "sketch_wire",
      id: "line_a",
      start: [-2, -1],
      end: [2, -1]
    },
    {
      op: "sketch.addLine",
      sketchId: "sketch_wire",
      id: "line_b",
      start: [2, -1],
      end: [2, 1]
    },
    {
      op: "sketch.addLine",
      sketchId: "sketch_wire",
      id: "line_c",
      start: [2, 1],
      end: [-2, 1]
    },
    {
      op: "sketch.addLine",
      sketchId: "sketch_wire",
      id: "line_d",
      start: [-2, 1],
      end: [-2, -1]
    }
  ]);
  return engine;
}

function cutWire(
  engine: CadEngine,
  target:
    | { readonly targetBodyId: string }
    | { readonly targetTopologyAnchorId: string } = {
    targetBodyId: "body_target"
  }
): ReturnType<CadEngine["executeBatch"]> {
  return engine.executeBatch({
    version: "cadops.v1",
    mode: "commit",
    ops: [
      {
        op: "feature.extrude",
        id: "feature_cut",
        bodyId: "body_cut",
        profile,
        depth: 3,
        side: "negative",
        operationMode: "cut",
        ...target
      }
    ]
  });
}

function structure(engine: CadEngine) {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "project.structure" }
  });
  if (!response.ok || response.query !== "project.structure") {
    throw new Error("Expected project structure.");
  }
  return response;
}

function topologySignature(engine: CadEngine): string {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "body.topology", bodyId: "body_cut" }
  });
  if (!response.ok || response.query !== "body.topology") {
    throw new Error("Expected cut topology.");
  }
  return response.topology.sourceIdentity.signature;
}

function exactMetadata(
  engine: CadEngine,
  solidCount = 1,
  signature = topologySignature(engine)
): CadBodyDerivedExactMetadataSnapshot {
  return {
    bodyId: "body_cut",
    sourceIdentitySignature: signature,
    status: "ready",
    metadata: {
      source: "kernel-derived",
      confidence: "kernel-derived",
      bounds: {
        min: [-4, -3, 0],
        max: [4, 3, 4],
        size: [8, 6, 4],
        center: [0, 0, 2]
      },
      volume: 80,
      surfaceArea: 120,
      centroid: [0, 0, 2],
      topologyCounts: {
        solidCount,
        faceCount: 10,
        edgeCount: 24,
        vertexCount: 16
      },
      diagnostics: []
    }
  };
}

describe("V17 composite wire extrude cut", () => {
  it("commits deterministically and preserves target lifecycle through undo, redo, and delete", () => {
    const engine = createEngine();
    const before = engine.createSnapshot();
    expect(
      engine.executeBatch({
        version: "cadops.v1",
        mode: "dryRun",
        ops: [
          {
            op: "feature.extrude",
            id: "feature_cut",
            bodyId: "body_cut",
            profile,
            depth: 3,
            side: "negative",
            operationMode: "cut",
            targetBodyId: "body_target"
          }
        ]
      })
    ).toMatchObject({
      ok: true,
      createdFeatureIds: ["feature_cut"],
      createdBodyIds: ["body_cut"]
    });
    expect(engine.createSnapshot()).toEqual(before);
    expect(cutWire(engine)).toMatchObject({
      ok: true,
      semanticDiff: {
        features: {
          created: [
            expect.objectContaining({
              id: "feature_cut",
              operationMode: "cut",
              targetBodyId: "body_target",
              depth: 3,
              side: "negative",
              profile
            })
          ],
          inputReferences: [
            expect.objectContaining({
              featureId: "feature_cut",
              after: profile
            })
          ]
        }
      }
    });
    expect(structure(engine).bodies).toContainEqual(
      expect.objectContaining({
        id: "body_target",
        consumedByFeatureId: "feature_cut"
      })
    );
    engine.undo();
    expect(structure(engine).bodies).toContainEqual(
      expect.objectContaining({ id: "body_target" })
    );
    expect(
      structure(engine).bodies.some((body) => body.id === "body_cut")
    ).toBe(false);
    engine.redo();
    engine.apply({ op: "feature.delete", id: "feature_cut" });
    expect(
      structure(engine).bodies.find((body) => body.id === "body_target")
    ).not.toHaveProperty("consumedByFeatureId");
  });

  it("rejects invalid source and unsupported targets without consuming them", () => {
    for (const testCase of [
      {
        profile: { ...profile, segments: profile.segments.slice(0, 3) },
        targetBodyId: "body_target",
        code: "SKETCH_PROFILE_OPEN"
      },
      { profile, targetBodyId: "missing", code: "BODY_NOT_FOUND" }
    ]) {
      const engine = createEngine();
      const before = engine.createSnapshot();
      expect(
        engine.executeBatch({
          version: "cadops.v1",
          mode: "commit",
          ops: [
            {
              op: "feature.extrude",
              profile: testCase.profile,
              depth: 1,
              operationMode: "cut",
              targetBodyId: testCase.targetBodyId
            }
          ]
        })
      ).toMatchObject({ ok: false, error: { code: testCase.code } });
      expect(engine.createSnapshot()).toEqual(before);
      expect(
        structure(engine).bodies.find((body) => body.id === "body_target")
      ).not.toHaveProperty("consumedByFeatureId");
    }

    const wireTarget = createEngine();
    wireTarget.apply({
      op: "feature.extrude",
      id: "feature_wire_target",
      bodyId: "body_wire_target",
      profile,
      depth: 2
    });
    expect(
      wireTarget.executeBatch({
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            op: "feature.extrude",
            profile,
            depth: 1,
            operationMode: "cut",
            targetBodyId: "body_wire_target"
          }
        ]
      })
    ).toMatchObject({
      ok: false,
      error: { code: "UNSUPPORTED_BODY_REFERENCES" }
    });
  });

  it("supports editability and profile updates while keeping entity transitions blocked", () => {
    const engine = createEngine();
    cutWire(engine);
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: {
          query: "feature.editability",
          featureId: "feature_cut",
          proposedEdit: { kind: "extrude", profile, depth: 5 }
        }
      })
    ).toMatchObject({
      ok: true,
      status: "editable",
      dryRun: { status: "valid" }
    });
    engine.apply({
      op: "feature.updateExtrude",
      id: "feature_cut",
      profile,
      depth: 5,
      side: "symmetric"
    });
    expect(engine.getDocument().features.get("feature_cut")).toMatchObject({
      operationMode: "cut",
      targetBodyId: "body_target",
      profile,
      depth: 5,
      side: "symmetric"
    });
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: {
          query: "feature.editability",
          featureId: "feature_cut",
          proposedEdit: {
            kind: "extrude",
            profile: {
              kind: "entity",
              sketchId: "sketch_target",
              entityId: "rectangle_target"
            }
          }
        }
      })
    ).toMatchObject({
      ok: true,
      dryRun: {
        status: "blocked",
        diagnostics: [
          expect.objectContaining({
            code: "FEATURE_EDIT_INVALID_PROPOSAL",
            fieldPath: "profile"
          })
        ]
      }
    });
  });

  it("retains the authored cut and consumed target after a later source failure", () => {
    const engine = createEngine();
    cutWire(engine);
    engine.apply({
      op: "sketch.updateEntity",
      sketchId: "sketch_wire",
      entity: {
        id: "line_b",
        kind: "line",
        start: [2, -1],
        end: [3, 1],
        construction: false
      }
    });
    expect(engine.getDocument().features.get("feature_cut")).toMatchObject({
      operationMode: "cut",
      profile
    });
    expect(structure(engine).bodies).toContainEqual(
      expect.objectContaining({
        id: "body_target",
        consumedByFeatureId: "feature_cut"
      })
    );
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: { query: "project.health" }
      })
    ).toMatchObject({ ok: true, status: "unsupported" });
  });

  it("round-trips JSON, history, redo, dependency order, and WCAD v2", async () => {
    const engine = createEngine();
    cutWire(engine);
    engine.apply({ op: "feature.updateExtrude", id: "feature_cut", depth: 4 });
    engine.undo();
    const reopenedJson = importCadProjectJson(exportCadProjectJson(engine));
    expect(reopenedJson.createSnapshot()).toEqual(engine.createSnapshot());
    expect(reopenedJson.getTransactions().at(-1)?.diff.features).toEqual(
      engine.getTransactions().at(-1)?.diff.features
    );
    const graph = reopenedJson.executeQuery({
      version: "cadops.v1",
      query: { query: "project.dependencyGraph" }
    });
    if (!graph.ok || graph.query !== "project.dependencyGraph") {
      throw new Error("Expected dependency graph.");
    }
    const sourceEdges = graph.edges.filter(
      (edge) =>
        edge.sourceFeatureId === "feature_cut" &&
        edge.from.startsWith("sketch-entity:sketch_wire:")
    );
    expect(sourceEdges.map((edge) => edge.from.split(":").at(-1))).toEqual([
      "line_a",
      "line_b",
      "line_c",
      "line_d"
    ]);

    const packed = await exportCadProjectToWcad(exportCadProject(engine));
    const read = await readCadProjectWcad(packed.bytes);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.project.history.at(-1)?.diff.features?.created).toContainEqual(
      expect.objectContaining({
        id: "feature_cut",
        operationMode: "cut",
        targetBodyId: "body_target",
        profile
      })
    );
    const reopenedWcad = importCadProject(read.project);
    reopenedWcad.redo();
    expect(
      reopenedWcad.getDocument().features.get("feature_cut")
    ).toMatchObject({
      operationMode: "cut",
      depth: 4,
      profile
    });
  });

  it("accepts positive cut result evidence while rejecting an empty result", () => {
    const engine = createEngine();
    engine.apply({
      op: "topology.checkpoint.create",
      checkpointId: "checkpoint_target",
      bodyId: "body_target",
      sourceFeatureId: "feature_target",
      sourceIdentity: {
        algorithm: "partbench-source-v1",
        sha256: "d".repeat(64)
      },
      status: "active"
    });
    engine.apply({
      op: "topology.anchor.create",
      anchorId: "anchor_target",
      entityKind: "body",
      bodyId: "body_target",
      checkpointId: "checkpoint_target",
      checkpointEntityId: "body:0",
      sourceFeatureId: "feature_target",
      signatureHash: "target-body-signature"
    });
    expect(
      cutWire(engine, { targetTopologyAnchorId: "anchor_target" })
    ).toMatchObject({
      ok: true
    });
    expect(engine.getDocument().features.get("feature_cut")).toMatchObject({
      operationMode: "cut",
      targetBodyId: "body_target",
      targetTopologyAnchorId: "anchor_target"
    });
    const ready = exactMetadata(engine);
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: {
          query: "project.health",
          derivedExactMetadata: [ready]
        }
      })
    ).toMatchObject({
      ok: true,
      authoredExtrudes: expect.arrayContaining([
        expect.objectContaining({
          featureId: "feature_cut",
          status: "healthy",
          topologyStatus: "healthy"
        })
      ])
    });
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: {
          query: "project.exportExact",
          format: "step",
          bodyIds: ["body_cut"],
          derivedExactMetadata: [ready]
        }
      })
    ).toMatchObject({
      ok: true,
      status: "supported",
      exportSources: [
        expect.objectContaining({
          bodyId: "body_cut",
          kind: "booleanExtrudes",
          operation: "cut",
          targetBodyId: "body_target",
          targetTopologyAnchorId: "anchor_target",
          tool: expect.objectContaining({
            profile: expect.objectContaining({ kind: "wire" })
          })
        })
      ]
    });
    const compound = exactMetadata(engine, 2);
    const empty = exactMetadata(engine, 0);
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: {
          query: "body.topology",
          bodyId: "body_cut",
          derivedExactMetadata: compound
        }
      })
    ).toMatchObject({
      ok: true,
      topology: {
        status: "healthy",
        topologyModel: "kernel-derived",
        topologyAvailable: true,
        exactGeometryAvailable: true,
        exactMeasurementsAvailable: true,
        exactMetadata: {
          topologyCounts: { solidCount: 2 },
          diagnostics: []
        },
        issues: []
      }
    });
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: {
          query: "project.health",
          derivedExactMetadata: [compound]
        }
      })
    ).toMatchObject({
      ok: true,
      authoredExtrudes: expect.arrayContaining([
        expect.objectContaining({
          featureId: "feature_cut",
          status: "healthy",
          topologyStatus: "healthy",
          exactMeasurementsAvailable: true
        })
      ])
    });
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: {
          query: "body.massProperties",
          bodyId: "body_cut",
          derivedExactMetadata: compound
        }
      })
    ).toMatchObject({
      ok: true,
      massProperties: {
        bodyId: "body_cut",
        volume: 80,
        diagnostics: []
      }
    });
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: {
          query: "project.extents",
          derivedExactMetadata: [compound]
        }
      })
    ).toMatchObject({
      ok: true,
      bodies: [
        expect.objectContaining({
          bodyId: "body_cut",
          topologyCounts: expect.objectContaining({ solidCount: 2 })
        })
      ],
      warnings: []
    });
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: {
          query: "project.exportExact",
          format: "step",
          bodyIds: ["body_cut"],
          derivedExactMetadata: [compound]
        }
      })
    ).toMatchObject({
      ok: true,
      status: "supported",
      exportableBodyCount: 1,
      exportSources: [
        expect.objectContaining({
          bodyId: "body_cut",
          kind: "booleanExtrudes",
          operation: "cut"
        })
      ]
    });

    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: {
          query: "body.topology",
          bodyId: "body_cut",
          derivedExactMetadata: empty
        }
      })
    ).toMatchObject({
      ok: true,
      topology: {
        status: "kernel-failed",
        exactGeometryAvailable: false,
        issues: expect.arrayContaining([
          expect.objectContaining({
            code: "INVALID_EXACT_GEOMETRY_RESULT",
            expected: "solidCount>=1",
            received: "solidCount=0"
          })
        ])
      }
    });
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: {
          query: "project.health",
          derivedExactMetadata: [empty]
        }
      })
    ).toMatchObject({
      ok: true,
      authoredExtrudes: expect.arrayContaining([
        expect.objectContaining({
          featureId: "feature_cut",
          topologyStatus: "kernel-failed",
          issues: expect.arrayContaining([
            expect.objectContaining({
              code: "INVALID_EXACT_GEOMETRY_RESULT"
            })
          ])
        })
      ])
    });
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: {
          query: "body.massProperties",
          bodyId: "body_cut",
          derivedExactMetadata: empty
        }
      })
    ).toMatchObject({
      ok: false,
      error: { code: "MASS_PROPERTIES_UNAVAILABLE" }
    });
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: {
          query: "project.extents",
          derivedExactMetadata: [empty]
        }
      })
    ).toMatchObject({
      ok: true,
      bodies: [],
      warnings: [
        expect.objectContaining({
          code: "DERIVED_EXACT_METADATA_INVALID",
          bodyId: "body_cut",
          expected: "solidCount>=1",
          received: "solidCount=0"
        })
      ]
    });
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: {
          query: "project.exportExact",
          format: "step",
          bodyIds: ["body_cut"],
          derivedExactMetadata: [empty]
        }
      })
    ).toMatchObject({
      ok: true,
      exportableBodyCount: 0,
      exportSources: []
    });

    const stale = exactMetadata(engine, 1, "stale");
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: {
          query: "project.exportExact",
          format: "step",
          bodyIds: ["body_cut"],
          derivedExactMetadata: [stale]
        }
      })
    ).toMatchObject({
      ok: true,
      exportableBodyCount: 0,
      exportSources: []
    });
  });

  it("cuts a topology-anchored composite add result through the canonical target matrix", () => {
    const engine = createEngine();
    expect(
      engine.apply({
        op: "feature.extrude",
        id: "feature_add",
        bodyId: "body_add",
        profile,
        depth: 2,
        operationMode: "add",
        targetBodyId: "body_target"
      }).transaction.diff.features?.created
    ).toContainEqual(
      expect.objectContaining({
        id: "feature_add",
        operationMode: "add",
        targetBodyId: "body_target"
      })
    );
    engine.apply({
      op: "topology.checkpoint.create",
      checkpointId: "checkpoint_add",
      bodyId: "body_add",
      sourceFeatureId: "feature_add",
      sourceIdentity: {
        algorithm: "partbench-source-v1",
        sha256: "a".repeat(64)
      },
      status: "active"
    });
    engine.apply({
      op: "topology.anchor.create",
      anchorId: "anchor_add",
      entityKind: "body",
      bodyId: "body_add",
      checkpointId: "checkpoint_add",
      checkpointEntityId: "body:0",
      sourceFeatureId: "feature_add",
      signatureHash: "add-result-body-signature"
    });

    expect(
      engine.apply({
        op: "feature.extrude",
        id: "feature_cut",
        bodyId: "body_cut",
        profile,
        depth: 1,
        operationMode: "cut",
        targetTopologyAnchorId: "anchor_add"
      }).transaction.diff.features?.created
    ).toContainEqual(
      expect.objectContaining({
        id: "feature_cut",
        operationMode: "cut",
        targetBodyId: "body_add",
        targetTopologyAnchorId: "anchor_add"
      })
    );

    const ready = exactMetadata(engine);
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: {
          query: "project.exportExact",
          format: "step",
          bodyIds: ["body_cut"],
          derivedExactMetadata: [ready]
        }
      })
    ).toMatchObject({
      ok: true,
      status: "supported",
      exportSources: [
        {
          bodyId: "body_cut",
          kind: "booleanExtrudes",
          operation: "cut",
          targetBodyId: "body_add",
          targetTopologyAnchorId: "anchor_add",
          target: expect.objectContaining({
            kind: "booleanExtrudes",
            operation: "add"
          }),
          tool: expect.objectContaining({
            profile: expect.objectContaining({ kind: "wire" })
          })
        }
      ]
    });
  });
});
