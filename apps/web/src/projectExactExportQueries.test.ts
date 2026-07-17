import { CadEngine } from "@web-cad/cad-core";
import { describe, expect, it } from "vitest";

import {
  createDerivedExactMetadataCacheKey,
  getCurrentDerivedExactMetadataEntryForBody,
  type DerivedExactMetadataSnapshot
} from "./derivedExactMetadata";
import type { DerivedBooleanExtrudeGeometrySource } from "./derivedGeometry";
import { createDerivedGeometrySourcesFromDocument } from "./derivedGeometrySources";
import {
  createCurrentDerivedExactMetadataSnapshots,
  readProjectExactStepExport,
  readProjectExportReadiness
} from "./projectExactExportQueries";

describe("project exact export query evidence", () => {
  it("keeps composite add deferred while pending, enables current evidence, and rejects a stale cache entry", () => {
    const engine = createCompositeAddEngine();
    const source = readCompositeAddSource(engine);
    const pending = pendingSnapshot(source);

    expect(
      readAddBodyReadiness(
        readProjectExportReadiness(engine, pending, [source])
      )?.sourceStatus
    ).toBe("deferred");
    expect(
      readProjectExactStepExport(engine, pending, [source])?.available
    ).toBe(false);

    const ready = readySnapshot(source);
    expect(
      readAddBodyReadiness(readProjectExportReadiness(engine, ready, [source]))
        ?.sourceStatus
    ).toBe("supported");
    const exact = readProjectExactStepExport(engine, ready, [source]);
    expect(exact).toMatchObject({
      status: "supported",
      available: true,
      exportableBodyCount: 1,
      exportSources: [
        expect.objectContaining({
          bodyId: "body_add",
          kind: "booleanExtrudes",
          operation: "add",
          target: expect.objectContaining({
            profile: expect.objectContaining({ kind: "rectangle" })
          }),
          tool: expect.objectContaining({
            profile: expect.objectContaining({ kind: "wire" })
          })
        })
      ]
    });

    engine.apply({
      op: "sketch.updateEntity",
      sketchId: "sketch_target",
      entity: {
        id: "target_rect",
        kind: "rectangle",
        center: [0, 0],
        width: 5,
        height: 4,
        construction: false
      }
    });
    const targetEditedSource = readCompositeAddSource(engine);
    expect(createDerivedExactMetadataCacheKey(targetEditedSource)).not.toBe(
      createDerivedExactMetadataCacheKey(source)
    );
    expect(
      createCurrentDerivedExactMetadataSnapshots(engine, ready, [
        targetEditedSource
      ])
    ).toEqual([]);
    expect(
      readAddBodyReadiness(
        readProjectExportReadiness(engine, ready, [targetEditedSource])
      )?.sourceStatus
    ).toBe("deferred");

    engine.apply({
      op: "feature.updateExtrude",
      id: "feature_add",
      depth: 5
    });
    const editedSource = readCompositeAddSource(engine);
    expect(createDerivedExactMetadataCacheKey(editedSource)).not.toBe(
      createDerivedExactMetadataCacheKey(targetEditedSource)
    );
    expect(
      readAddBodyReadiness(
        readProjectExportReadiness(engine, ready, [editedSource])
      )?.sourceStatus
    ).toBe("deferred");
    expect(
      readProjectExactStepExport(engine, ready, [editedSource])?.available
    ).toBe(false);
  });

  it("plumbs current add metadata into mass properties, extents, and honest reference unavailability", () => {
    const engine = createCompositeAddEngine();
    const source = readCompositeAddSource(engine);
    const evidence = createCurrentDerivedExactMetadataSnapshots(
      engine,
      readySnapshot(source),
      [source]
    );
    expect(evidence).toHaveLength(1);

    const mass = engine.executeQuery({
      version: "cadops.v1",
      query: {
        query: "body.massProperties",
        bodyId: "body_add",
        derivedExactMetadata: evidence[0]!
      }
    });
    expect(mass).toMatchObject({
      ok: true,
      query: "body.massProperties",
      massProperties: {
        bodyId: "body_add",
        volume: 40,
        surfaceArea: 64,
        centerOfMass: [2, 2, 2],
        measurementSource: "kernel-derived"
      }
    });

    const extents = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "project.extents", derivedExactMetadata: evidence }
    });
    expect(extents).toMatchObject({
      ok: true,
      query: "project.extents",
      bodies: [
        expect.objectContaining({
          bodyId: "body_add",
          volume: 40,
          worldBounds: expect.objectContaining({
            min: [0, 0, 0],
            max: [4, 4, 4]
          })
        })
      ]
    });

    const references = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "body.generatedReferences", bodyId: "body_add" }
    });
    expect(references).toMatchObject({
      ok: false,
      query: "body.generatedReferences",
      error: {
        code: "GENERATED_REFERENCE_CORRESPONDENCE_UNPROVEN",
        bodyId: "body_add",
        generatedReferencesStatus: "unavailable"
      }
    });
  });

  it("filters current recursive add-to-cut evidence through health, mass, extents, and STEP", () => {
    const engine = createCompositeCutEngine();
    const source = readCompositeBooleanSource(engine, "body_cut");
    const ready = readySnapshot(source);
    const evidence = createCurrentDerivedExactMetadataSnapshots(engine, ready, [
      source
    ]);

    expect(source.sourceIdentitySignature).toBe(
      readBodySourceIdentitySignature(engine, "body_cut")
    );
    expect(
      getCurrentDerivedExactMetadataEntryForBody(ready, source.id, source)
    ).toMatchObject({ status: "ready" });
    expect(evidence).toHaveLength(1);
    const readiness = readProjectExportReadiness(engine, ready, [source]);
    expect(
      readiness?.bodies.find((body) => body.bodyId === "body_cut")?.sourceStatus
    ).toBe("supported");
    expect(readProjectExactStepExport(engine, ready, [source])).toMatchObject({
      available: true,
      exportSources: [
        expect.objectContaining({
          bodyId: "body_cut",
          kind: "booleanExtrudes",
          operation: "cut",
          target: expect.objectContaining({
            kind: "booleanExtrudes",
            operation: "add",
            tool: expect.objectContaining({
              profile: expect.objectContaining({ kind: "wire" })
            })
          }),
          tool: expect.objectContaining({
            profile: expect.objectContaining({ kind: "wire" })
          })
        })
      ]
    });

    const health = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "project.health", derivedExactMetadata: evidence }
    });
    expect(health).toMatchObject({
      ok: true,
      query: "project.health",
      authoredExtrudes: expect.arrayContaining([
        expect.objectContaining({
          featureId: "feature_cut",
          status: "healthy",
          topologyStatus: "healthy"
        })
      ])
    });
    const mass = engine.executeQuery({
      version: "cadops.v1",
      query: {
        query: "body.massProperties",
        bodyId: "body_cut",
        derivedExactMetadata: evidence[0]!
      }
    });
    expect(mass).toMatchObject({
      ok: true,
      massProperties: { bodyId: "body_cut", volume: 40 }
    });
    const extents = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "project.extents", derivedExactMetadata: evidence }
    });
    expect(extents).toMatchObject({
      ok: true,
      bodies: [expect.objectContaining({ bodyId: "body_cut", volume: 40 })]
    });

    engine.applyBatch([
      {
        op: "sketch.addLine",
        sketchId: "sketch_cut",
        id: "cut_diameter_recreated",
        start: [0, -0.5],
        end: [0, 0.5]
      },
      {
        op: "sketch.addArc",
        sketchId: "sketch_cut",
        id: "cut_arc_recreated",
        definition: {
          kind: "centerAngles",
          center: [0, 0],
          radius: 0.5,
          startAngleDegrees: 90,
          sweepAngleDegrees: 180
        }
      },
      {
        op: "feature.updateExtrude",
        id: "feature_cut",
        profile: {
          kind: "wire",
          sketchId: "sketch_cut",
          segments: [
            { entityId: "cut_diameter_recreated", orientation: "forward" },
            { entityId: "cut_arc_recreated", orientation: "forward" }
          ]
        }
      }
    ]);
    const edited = readCompositeBooleanSource(engine, "body_cut");
    expect(createDerivedExactMetadataCacheKey(edited)).not.toBe(
      createDerivedExactMetadataCacheKey(source)
    );
    expect(
      getCurrentDerivedExactMetadataEntryForBody(ready, edited.id, edited)
    ).toBeUndefined();
    expect(
      createCurrentDerivedExactMetadataSnapshots(engine, ready, [edited])
    ).toEqual([]);
    expect(readProjectExactStepExport(engine, ready, [edited])?.available).toBe(
      false
    );
  });

  it("invalidates identical geometry when an add is retargeted or its target identity is recreated", () => {
    const engine = createCompositeAddEngine(true);
    const initial = readCompositeAddSource(engine);
    const ready = readySnapshot(initial);

    expect(
      getCurrentDerivedExactMetadataEntryForBody(ready, initial.id, initial)
    ).toMatchObject({ status: "ready" });

    engine.apply({ op: "feature.delete", id: "feature_add" });
    createWireAdd(engine, "body_target_2");
    const retargeted = readCompositeAddSource(engine);

    expect(retargeted.sourceIdentitySignature).toBe(
      readBodySourceIdentitySignature(engine, "body_add")
    );
    expect(createDerivedExactMetadataCacheKey(retargeted)).not.toBe(
      createDerivedExactMetadataCacheKey(initial)
    );
    expect(
      getCurrentDerivedExactMetadataEntryForBody(
        ready,
        retargeted.id,
        retargeted
      )
    ).toBeUndefined();
    expect(
      createCurrentDerivedExactMetadataSnapshots(engine, ready, [retargeted])
    ).toEqual([]);

    engine.apply({ op: "feature.delete", id: "feature_add" });
    engine.apply({ op: "feature.delete", id: "feature_target_2" });
    engine.apply({
      op: "feature.extrude",
      id: "feature_target_2_recreated",
      bodyId: "body_target_2",
      sketchId: "sketch_target_2",
      entityId: "target_rect_2",
      depth: 4,
      operationMode: "newBody"
    });
    createWireAdd(engine, "body_target_2");
    const recreatedIdentity = readCompositeAddSource(engine);

    expect(createDerivedExactMetadataCacheKey(recreatedIdentity)).not.toBe(
      createDerivedExactMetadataCacheKey(retargeted)
    );
    expect(
      getCurrentDerivedExactMetadataEntryForBody(
        readySnapshot(retargeted),
        recreatedIdentity.id,
        recreatedIdentity
      )
    ).toBeUndefined();
    expect(
      createCurrentDerivedExactMetadataSnapshots(
        engine,
        readySnapshot(retargeted),
        [recreatedIdentity]
      )
    ).toEqual([]);
  });

  it("invalidates identical geometry when a wire cut is retargeted or its target source is recreated", () => {
    const engine = createCompositeAddEngine(true);
    engine.apply({ op: "feature.delete", id: "feature_add" });
    createWireBoolean(engine, "body_target", "cut");
    const initial = readCompositeBooleanSource(engine, "body_add");
    const ready = readySnapshot(initial);

    expect(
      getCurrentDerivedExactMetadataEntryForBody(ready, initial.id, initial)
    ).toMatchObject({ status: "ready" });

    engine.apply({ op: "feature.delete", id: "feature_add" });
    createWireBoolean(engine, "body_target_2", "cut");
    const retargeted = readCompositeBooleanSource(engine, "body_add");
    expect(createDerivedExactMetadataCacheKey(retargeted)).not.toBe(
      createDerivedExactMetadataCacheKey(initial)
    );
    expect(
      getCurrentDerivedExactMetadataEntryForBody(
        ready,
        retargeted.id,
        retargeted
      )
    ).toBeUndefined();
    expect(
      createCurrentDerivedExactMetadataSnapshots(engine, ready, [retargeted])
    ).toEqual([]);

    engine.apply({ op: "feature.delete", id: "feature_add" });
    engine.apply({ op: "feature.delete", id: "feature_target_2" });
    engine.apply({
      op: "feature.extrude",
      id: "feature_target_2_cut_recreated",
      bodyId: "body_target_2",
      sketchId: "sketch_target_2",
      entityId: "target_rect_2",
      depth: 4,
      operationMode: "newBody"
    });
    createWireBoolean(engine, "body_target_2", "cut");
    const recreated = readCompositeBooleanSource(engine, "body_add");
    expect(createDerivedExactMetadataCacheKey(recreated)).not.toBe(
      createDerivedExactMetadataCacheKey(retargeted)
    );
    expect(
      getCurrentDerivedExactMetadataEntryForBody(
        readySnapshot(retargeted),
        recreated.id,
        recreated
      )
    ).toBeUndefined();
    expect(
      createCurrentDerivedExactMetadataSnapshots(
        engine,
        readySnapshot(retargeted),
        [recreated]
      )
    ).toEqual([]);
  });
});

function createCompositeAddEngine(includeSecondTarget = false): CadEngine {
  const engine = new CadEngine();
  engine.applyBatch([
    ...(includeSecondTarget
      ? [
          {
            op: "sketch.create" as const,
            id: "sketch_target_2",
            name: "Second target",
            plane: "XY" as const
          },
          {
            op: "sketch.addRectangle" as const,
            sketchId: "sketch_target_2",
            id: "target_rect_2",
            center: [0, 0] as const,
            width: 4,
            height: 4
          },
          {
            op: "feature.extrude" as const,
            id: "feature_target_2",
            bodyId: "body_target_2",
            sketchId: "sketch_target_2",
            entityId: "target_rect_2",
            depth: 4,
            operationMode: "newBody" as const
          }
        ]
      : []),
    {
      op: "sketch.create",
      id: "sketch_target",
      name: "Target",
      plane: "XY"
    },
    {
      op: "sketch.addRectangle",
      sketchId: "sketch_target",
      id: "target_rect",
      center: [0, 0],
      width: 4,
      height: 4
    },
    {
      op: "feature.extrude",
      id: "feature_target",
      bodyId: "body_target",
      sketchId: "sketch_target",
      entityId: "target_rect",
      depth: 4,
      operationMode: "newBody"
    },
    {
      op: "sketch.create",
      id: "sketch_tool",
      name: "Composite tool",
      plane: "XY"
    },
    {
      op: "sketch.addLine",
      sketchId: "sketch_tool",
      id: "tool_diameter",
      start: [0, -1],
      end: [0, 1]
    },
    {
      op: "sketch.addArc",
      sketchId: "sketch_tool",
      id: "tool_arc",
      definition: {
        kind: "centerAngles",
        center: [0, 0],
        radius: 1,
        startAngleDegrees: 90,
        sweepAngleDegrees: 180
      }
    },
    {
      op: "feature.extrude",
      id: "feature_add",
      bodyId: "body_add",
      profile: {
        kind: "wire",
        sketchId: "sketch_tool",
        segments: [
          { entityId: "tool_diameter", orientation: "forward" },
          { entityId: "tool_arc", orientation: "forward" }
        ]
      },
      depth: 4,
      operationMode: "add",
      targetBodyId: "body_target"
    }
  ]);
  return engine;
}

function createCompositeCutEngine(): CadEngine {
  const engine = createCompositeAddEngine();
  engine.applyBatch([
    {
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
    },
    {
      op: "topology.anchor.create",
      anchorId: "anchor_body_add",
      entityKind: "body",
      bodyId: "body_add",
      checkpointId: "checkpoint_add",
      checkpointEntityId: "body:0",
      sourceFeatureId: "feature_add",
      signatureHash: "add-body-signature"
    },
    {
      op: "sketch.create",
      id: "sketch_cut",
      name: "Composite cut tool",
      plane: "XY"
    },
    {
      op: "sketch.addLine",
      sketchId: "sketch_cut",
      id: "cut_diameter",
      start: [0, -0.5],
      end: [0, 0.5]
    },
    {
      op: "sketch.addArc",
      sketchId: "sketch_cut",
      id: "cut_arc",
      definition: {
        kind: "centerAngles",
        center: [0, 0],
        radius: 0.5,
        startAngleDegrees: 90,
        sweepAngleDegrees: 180
      }
    },
    {
      op: "feature.extrude",
      id: "feature_cut",
      bodyId: "body_cut",
      profile: {
        kind: "wire",
        sketchId: "sketch_cut",
        segments: [
          { entityId: "cut_diameter", orientation: "forward" },
          { entityId: "cut_arc", orientation: "forward" }
        ]
      },
      depth: 4,
      operationMode: "cut",
      targetTopologyAnchorId: "anchor_body_add"
    }
  ]);
  return engine;
}

function createWireAdd(engine: CadEngine, targetBodyId: string): void {
  createWireBoolean(engine, targetBodyId, "add");
}

function createWireBoolean(
  engine: CadEngine,
  targetBodyId: string,
  operationMode: "add" | "cut"
): void {
  engine.apply({
    op: "feature.extrude",
    id: "feature_add",
    bodyId: "body_add",
    profile: {
      kind: "wire",
      sketchId: "sketch_tool",
      segments: [
        { entityId: "tool_diameter", orientation: "forward" },
        { entityId: "tool_arc", orientation: "forward" }
      ]
    },
    depth: 4,
    operationMode,
    targetBodyId
  });
}

function readCompositeBooleanSource(
  engine: CadEngine,
  bodyId: string
): DerivedBooleanExtrudeGeometrySource {
  const structure = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "project.structure" }
  });
  if (!structure.ok || structure.query !== "project.structure") {
    throw new Error("Expected project structure.");
  }
  const sources = createDerivedGeometrySourcesFromDocument(
    engine.getDocument(),
    structure.features,
    new Map(),
    new Map(
      structure.bodies.map((body) => [
        body.id,
        readBodySourceIdentitySignature(engine, body.id)
      ])
    )
  );
  const source = sources.find(
    (candidate): candidate is DerivedBooleanExtrudeGeometrySource =>
      candidate.id === bodyId && candidate.kind === "extrudeBoolean"
  );
  if (!source || source.tool.profile.kind !== "wire") {
    throw new Error(`Expected a composite wire boolean source for ${bodyId}.`);
  }
  return source;
}

function readCompositeAddSource(
  engine: CadEngine
): DerivedBooleanExtrudeGeometrySource {
  const source = readCompositeBooleanSource(engine, "body_add");
  if (source.operation !== "add") {
    throw new Error("Expected a composite add source.");
  }
  return source;
}

function readBodySourceIdentitySignature(
  engine: CadEngine,
  bodyId: string
): string {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "body.topology", bodyId }
  });
  if (!response.ok || response.query !== "body.topology") {
    throw new Error(`Expected body topology for ${bodyId}.`);
  }
  return response.topology.sourceIdentity.signature;
}

function pendingSnapshot(
  source: DerivedBooleanExtrudeGeometrySource
): DerivedExactMetadataSnapshot {
  return {
    entries: [
      {
        bodyId: source.id,
        sourceKind: source.kind,
        cacheKey: createDerivedExactMetadataCacheKey(source),
        status: "pending"
      }
    ],
    supportedCount: 1,
    pendingCount: 1,
    readyCount: 0,
    errorCount: 0
  };
}

function readySnapshot(
  source: DerivedBooleanExtrudeGeometrySource
): DerivedExactMetadataSnapshot {
  return {
    entries: [
      {
        bodyId: source.id,
        sourceKind: source.kind,
        cacheKey: createDerivedExactMetadataCacheKey(source),
        status: "ready",
        metadata: {
          sourceKind: "booleanExtrudes",
          bounds: { min: [0, 0, 0], max: [4, 4, 4] },
          volume: 40,
          surfaceArea: 64,
          centroid: [2, 2, 2],
          topologyCounts: {
            solidCount: 1,
            faceCount: 9,
            edgeCount: 18,
            vertexCount: 12
          },
          measurementSource: "kernel-derived",
          measurementConfidence: "kernel-derived",
          diagnostics: []
        },
        metrics: { objectId: source.id, roundTripMs: 1 }
      }
    ],
    supportedCount: 1,
    pendingCount: 0,
    readyCount: 1,
    errorCount: 0
  };
}

function readAddBodyReadiness(
  readiness: ReturnType<typeof readProjectExportReadiness>
) {
  return readiness?.bodies.find((body) => body.bodyId === "body_add");
}
