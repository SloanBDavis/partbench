import { CadEngine } from "@web-cad/cad-core";
import { describe, expect, it } from "vitest";

import {
  createDerivedExactMetadataCacheKey,
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
});

function createCompositeAddEngine(): CadEngine {
  const engine = new CadEngine();
  engine.applyBatch([
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

function readCompositeAddSource(
  engine: CadEngine
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
    structure.features
  );
  const source = sources.find(
    (candidate): candidate is DerivedBooleanExtrudeGeometrySource =>
      candidate.id === "body_add" && candidate.kind === "extrudeBoolean"
  );
  if (!source || source.tool.profile.kind !== "wire") {
    throw new Error("Expected a composite add source.");
  }
  return source;
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
