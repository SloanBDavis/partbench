import { describe, expect, it } from "vitest";
import type { CadBodyDerivedExactMetadataSnapshot } from "@web-cad/cad-protocol";

import {
  CadEngine,
  exportCadProject,
  exportCadProjectJson,
  exportCadProjectToWcad,
  importCadProject,
  importCadProjectJson,
  readCadProjectWcad,
  type ExtrudeFeature
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

function createEngine(targetName = "Target"): CadEngine {
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
      name: targetName,
      sketchId: "sketch_target",
      entityId: "rectangle_target",
      depth: 2
    },
    { op: "sketch.create", id: "sketch_wire", name: "Wire", plane: "XY" },
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

function addWire(engine: CadEngine): ReturnType<CadEngine["executeBatch"]> {
  return engine.executeBatch({
    version: "cadops.v1",
    mode: "commit",
    ops: [
      {
        op: "feature.extrude",
        id: "feature_add",
        bodyId: "body_add",
        profile,
        depth: 3,
        operationMode: "add",
        targetBodyId: "body_target"
      }
    ]
  });
}

function topologySignature(engine: CadEngine): string {
  const result = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "body.topology", bodyId: "body_add" }
  });
  if (!result.ok || result.query !== "body.topology")
    throw new Error("topology");
  return result.topology.sourceIdentity.signature;
}

function structure(engine: CadEngine) {
  const result = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "project.structure" }
  });
  if (!result.ok || result.query !== "project.structure")
    throw new Error("structure");
  return result;
}

function exactMetadata(
  engine: CadEngine,
  solidCount = 1,
  signature = topologySignature(engine)
): CadBodyDerivedExactMetadataSnapshot {
  return {
    bodyId: "body_add",
    sourceIdentitySignature: signature,
    status: "ready",
    metadata: {
      source: "kernel-derived",
      confidence: "kernel-derived",
      bounds: {
        min: [-4, -3, 0],
        max: [4, 3, 3],
        size: [8, 6, 3],
        center: [0, 0, 1.5]
      },
      volume: 64,
      surfaceArea: 156,
      centroid: [0, 0, 1.5],
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

describe("V17 composite wire extrude add", () => {
  it("creates through dry-run/commit and preserves the target lifecycle through undo, redo, and delete", () => {
    const engine = createEngine();
    const before = engine.createSnapshot();
    const dryRun = engine.executeBatch({
      version: "cadops.v1",
      mode: "dryRun",
      ops: [
        {
          op: "feature.extrude",
          id: "feature_add",
          bodyId: "body_add",
          profile,
          depth: 3,
          operationMode: "add",
          targetBodyId: "body_target"
        }
      ]
    });
    expect(dryRun).toMatchObject({
      ok: true,
      createdFeatureIds: ["feature_add"],
      createdBodyIds: ["body_add"]
    });
    expect(engine.createSnapshot()).toEqual(before);
    expect(addWire(engine)).toMatchObject({
      ok: true,
      semanticDiff: {
        features: {
          created: [
            expect.objectContaining({
              id: "feature_add",
              operationMode: "add",
              targetBodyId: "body_target",
              profile
            })
          ]
        }
      }
    });
    expect(structure(engine).bodies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "body_target",
          consumedByFeatureId: "feature_add"
        }),
        expect.objectContaining({ id: "body_add" })
      ])
    );
    engine.undo();
    expect(structure(engine).bodies).toContainEqual(
      expect.objectContaining({ id: "body_target" })
    );
    expect(
      structure(engine).bodies.some((body) => body.id === "body_add")
    ).toBe(false);
    engine.redo();
    engine.apply({ op: "feature.delete", id: "feature_add" });
    expect(
      structure(engine).bodies.find((body) => body.id === "body_target")
    ).not.toHaveProperty("consumedByFeatureId");
  });

  it("updates and retargets the composite profile while retaining the consumed target", () => {
    const engine = createEngine();
    addWire(engine);
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: {
          query: "feature.editability",
          featureId: "feature_add",
          proposedEdit: { kind: "extrude", profile, depth: 5 }
        }
      })
    ).toMatchObject({
      ok: true,
      status: "editable",
      dryRun: { status: "valid" }
    });
    expect(
      engine.apply({
        op: "feature.updateExtrude",
        id: "feature_add",
        profile,
        depth: 5,
        side: "symmetric"
      }).transaction.diff.features
    ).toMatchObject({
      modified: [expect.objectContaining({ id: "feature_add", depth: 5 })],
      inputReferences: [
        expect.objectContaining({ before: profile, after: profile })
      ]
    });
    expect(structure(engine).bodies).toContainEqual(
      expect.objectContaining({
        id: "body_target",
        consumedByFeatureId: "feature_add"
      })
    );
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: {
          query: "feature.editability",
          featureId: "feature_add",
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
      status: "editable",
      dryRun: {
        status: "blocked",
        diagnostics: [
          expect.objectContaining({
            code: "FEATURE_EDIT_INVALID_PROPOSAL",
            fieldPath: "profile",
            expected: "composite wire profile",
            received: "entity"
          })
        ]
      }
    });
    const beforeRejectedTransition = engine.createSnapshot();
    expect(
      engine.executeBatch({
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            op: "feature.updateExtrude",
            id: "feature_add",
            profile: {
              kind: "entity",
              sketchId: "sketch_target",
              entityId: "rectangle_target"
            }
          }
        ]
      })
    ).toMatchObject({
      ok: false,
      error: {
        code: "UNSUPPORTED_FEATURE_OPERATION",
        path: "$.ops[0].profile"
      }
    });
    expect(engine.createSnapshot()).toEqual(beforeRejectedTransition);
  });

  it("rejects missing, already consumed, and wire cut targets atomically", () => {
    const cases = [
      { targetBodyId: "missing", code: "BODY_NOT_FOUND" },
      { targetBodyId: "body:box", code: "BODY_NOT_FOUND" }
    ] as const;
    for (const testCase of cases) {
      const engine = createEngine();
      const before = engine.createSnapshot();
      const result = engine.executeBatch({
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            op: "feature.extrude",
            profile,
            depth: 1,
            operationMode: "add",
            targetBodyId: testCase.targetBodyId
          }
        ]
      });
      expect(result).toMatchObject({
        ok: false,
        error: { code: testCase.code }
      });
      expect(engine.createSnapshot()).toEqual(before);
    }
    const cutEngine = createEngine();
    expect(
      cutEngine.executeBatch({
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            op: "feature.extrude",
            profile,
            depth: 1,
            operationMode: "cut",
            targetBodyId: "body_target"
          }
        ]
      })
    ).toMatchObject({
      ok: false,
      error: { code: "UNSUPPORTED_FEATURE_OPERATION" }
    });
    addWire(cutEngine);
    expect(
      cutEngine.executeBatch({
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            op: "feature.extrude",
            profile,
            depth: 1,
            operationMode: "add",
            targetBodyId: "body_target"
          }
        ]
      })
    ).toMatchObject({
      ok: false,
      error: { code: "TARGET_BODY_NOT_SUPPORTED" }
    });
  });

  it("keeps an invalid edited wire source while the committed target remains consumed", () => {
    const engine = createEngine();
    addWire(engine);
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
    expect(structure(engine).bodies).toContainEqual(
      expect.objectContaining({
        id: "body_target",
        consumedByFeatureId: "feature_add"
      })
    );
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: { query: "project.health" }
      })
    ).toMatchObject({ ok: true, status: "unsupported" });
  });

  it("round-trips V21 JSON source/history and rejects persisted wire cut", () => {
    const engine = createEngine();
    addWire(engine);
    const json = exportCadProjectJson(engine);
    const reopened = importCadProjectJson(json);
    expect(reopened.createSnapshot()).toEqual(engine.createSnapshot());
    expect(reopened.getTransactions().at(-1)?.diff.features).toEqual(
      engine.getTransactions().at(-1)?.diff.features
    );
    const invalid = JSON.parse(json) as {
      document: { features: Array<Record<string, unknown>> };
    };
    invalid.document.features.find(
      (feature) => feature.id === "feature_add"
    )!.operationMode = "cut";
    expect(() => importCadProjectJson(JSON.stringify(invalid))).toThrow(
      /wire extrude cut/i
    );
  });

  it("round-trips V21 source, history, and redo through WCAD v2", async () => {
    const engine = createEngine();
    addWire(engine);
    engine.apply({ op: "feature.updateExtrude", id: "feature_add", depth: 4 });
    engine.undo();
    const packed = await exportCadProjectToWcad(exportCadProject(engine));
    const read = await readCadProjectWcad(packed.bytes);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    const reopened = importCadProject(read.project);
    expect(reopened.createSnapshot()).toEqual(engine.createSnapshot());
    expect(read.project.history.at(-1)?.diff.features?.created).toContainEqual(
      expect.objectContaining({
        id: "feature_add",
        operationMode: "add",
        targetBodyId: "body_target",
        profile
      })
    );
    expect(
      read.project.redoStack.at(-1)?.diff.features?.modified
    ).toContainEqual(expect.objectContaining({ id: "feature_add", depth: 4 }));
    reopened.redo();
    expect(reopened.getDocument().features.get("feature_add")).toMatchObject({
      depth: 4,
      operationMode: "add",
      targetBodyId: "body_target",
      profile
    });
  });

  it("reports honest boolean topology and gates health/export on current one-solid exact evidence", () => {
    const engine = createEngine();
    addWire(engine);
    const without = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "body.topology", bodyId: "body_add" }
    });
    expect(without).toMatchObject({
      ok: true,
      topology: {
        status: "ambiguous",
        topologyAvailable: false,
        booleanTopology: {
          status: "ambiguous",
          sourceSemanticsAvailable: false,
          sourceInputs: {
            operationMode: "add",
            toolProfileKind: "wire",
            toolSketchEntityIds: ["line_a", "line_b", "line_c", "line_d"]
          }
        }
      }
    });
    const ready = exactMetadata(engine);
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: {
          query: "body.topology",
          bodyId: "body_add",
          derivedExactMetadata: ready
        }
      })
    ).toMatchObject({
      ok: true,
      topology: {
        status: "healthy",
        exactGeometryAvailable: true,
        booleanTopology: { derivedExactValidationStatus: "available" }
      }
    });
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: { query: "project.health", derivedExactMetadata: [ready] }
      })
    ).toMatchObject({
      ok: true,
      status: "under-defined",
      authoredExtrudes: expect.arrayContaining([
        expect.objectContaining({
          featureId: "feature_add",
          status: "healthy",
          topologyStatus: "healthy"
        })
      ])
    });
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: { query: "project.extents", derivedExactMetadata: [ready] }
      })
    ).toMatchObject({
      ok: true,
      bodies: [expect.objectContaining({ bodyId: "body_add", volume: 64 })]
    });
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: {
          query: "body.massProperties",
          bodyId: "body_add",
          derivedExactMetadata: ready
        }
      })
    ).toMatchObject({
      ok: true,
      massProperties: expect.objectContaining({
        bodyId: "body_add",
        volume: 64
      })
    });
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: {
          query: "project.exportExact",
          format: "step",
          bodyIds: ["body_add"],
          derivedExactMetadata: [ready]
        }
      })
    ).toMatchObject({
      ok: true,
      status: "supported",
      exportSources: [
        expect.objectContaining({
          bodyId: "body_add",
          kind: "booleanExtrudes",
          operation: "add",
          tool: expect.objectContaining({
            profile: expect.objectContaining({ kind: "wire" })
          })
        })
      ]
    });
    for (const metadata of [
      exactMetadata(engine, 0),
      exactMetadata(engine, 2),
      exactMetadata(engine, 1, "stale")
    ]) {
      expect(
        engine.executeQuery({
          version: "cadops.v1",
          query: {
            query: "body.topology",
            bodyId: "body_add",
            derivedExactMetadata: metadata
          }
        })
      ).toMatchObject({
        ok: true,
        topology: { exactGeometryAvailable: false }
      });
    }
  });

  it("binds result identity to target geometry but not target display name", () => {
    const first = createEngine("First name");
    const second = createEngine("Second name");
    addWire(first);
    addWire(second);
    expect(topologySignature(first)).toBe(topologySignature(second));
    const before = topologySignature(first);
    first.apply({
      op: "feature.updateExtrude",
      id: "feature_target",
      depth: 4
    });
    expect(topologySignature(first)).not.toBe(before);
  });

  it("uses an active body checkpoint anchor to trace a composite add target to its supported root", () => {
    const engine = createEngine();
    addWire(engine);
    engine.apply({
      op: "topology.checkpoint.create",
      checkpointId: "checkpoint_add",
      bodyId: "body_add",
      sourceFeatureId: "feature_add",
      sourceIdentity: {
        algorithm: "partbench-source-v1",
        sha256:
          "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      },
      status: "active"
    });
    engine.apply({
      op: "topology.anchor.create",
      anchorId: "anchor_body_add",
      entityKind: "body",
      bodyId: "body_add",
      checkpointId: "checkpoint_add",
      checkpointEntityId: "body:0",
      sourceFeatureId: "feature_add",
      signatureHash: "add-body-signature"
    });
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: {
          query: "sketch.profileReadiness",
          profile,
          consumer: {
            featureKind: "extrude",
            operationMode: "add",
            targetTopologyAnchorId: "anchor_body_add"
          }
        }
      })
    ).toMatchObject({
      ok: true,
      status: "ready",
      targetCompatibility: {
        status: "ready",
        targetBodyId: "body_add",
        targetTopologyAnchorId: "anchor_body_add"
      }
    });
    expect(
      engine.apply({
        op: "feature.extrude",
        id: "feature_add_2",
        bodyId: "body_add_2",
        profile,
        depth: 1,
        operationMode: "add",
        targetTopologyAnchorId: "anchor_body_add"
      }).transaction.diff.features?.created
    ).toContainEqual(
      expect.objectContaining({
        id: "feature_add_2",
        targetBodyId: "body_add",
        targetTopologyAnchorId: "anchor_body_add"
      })
    );
  });

  it("terminates malformed cyclic composite target lineage", () => {
    const engine = createEngine();
    addWire(engine);
    const features = engine.getDocument().features as Map<
      string,
      ExtrudeFeature
    >;
    const add = features.get("feature_add")!;
    features.set("feature_target", {
      ...add,
      id: "feature_target",
      bodyId: "body_target",
      targetBodyId: "body_add"
    });
    expect(() => topologySignature(engine)).not.toThrow();
  });
});
