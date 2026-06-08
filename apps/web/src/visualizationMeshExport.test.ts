import {
  CadEngine,
  exportCadProjectJson,
  type CadFeatureSummary
} from "@web-cad/cad-core";
import type { ProjectExportReadinessQueryResponse } from "@web-cad/cad-protocol";
import type { RenderTriangleMesh } from "@web-cad/renderer";
import { describe, expect, it } from "vitest";
import {
  createDerivedGeometryCacheKey,
  type DerivedGeometryEntry,
  type DerivedGeometrySnapshot,
  type DerivedGeometrySource
} from "./derivedGeometry";
import { createDerivedGeometrySourcesFromDocument } from "./derivedGeometrySources";
import {
  createGlbFromRenderMeshes,
  createVisualizationMeshExportArtifact,
  createVisualizationMeshExportStatus
} from "./visualizationMeshExport";

describe("visualizationMeshExport", () => {
  it("writes deterministic GLB metadata and binary shape", () => {
    const mesh = createTriangleMesh("mesh_internal_1");
    const first = createGlbFromRenderMeshes([{ label: "Body 1", mesh }]);
    const second = createGlbFromRenderMeshes([{ label: "Body 1", mesh }]);
    const parsed = parseGlb(first.bytes);

    expect(Array.from(first.bytes)).toEqual(Array.from(second.bytes));
    expect(first.meshMetadata).toEqual([{ vertexCount: 3, triangleCount: 1 }]);
    expect(parsed.header).toEqual({
      magic: 0x46546c67,
      version: 2,
      length: first.bytes.byteLength
    });
    expect(parsed.json.asset).toEqual({
      version: "2.0",
      generator: "Partbench visualization mesh export"
    });
    expect(parsed.json.extras.partbench).toEqual({
      exportKind: "visualization",
      authoritative: false
    });
    expect(parsed.json.buffers[0].byteLength).toBe(first.binaryByteLength);
    expect(parsed.binaryChunkType).toBe(0x004e4942);
  });

  it("exports supported rectangle and circle newBody extrude visualization meshes", () => {
    const engine = createRectangleAndCircleExtrudeProject();
    const readiness = readExportReadiness(engine);
    const sources = readDerivedSources(engine);
    const derivedGeometry = createReadyDerivedGeometrySnapshot(sources);
    const status = createVisualizationMeshExportStatus({
      exportReadiness: readiness,
      derivedGeometry,
      derivedGeometrySources: sources
    });
    const result = createVisualizationMeshExportArtifact({
      exportReadiness: readiness,
      derivedGeometry,
      derivedGeometrySources: sources
    });

    expect(status.available).toBe(true);
    expect(status.status).toBe("supported");
    expect(status.exportableBodyCount).toBe(2);
    expect(status.skippedBodyCount).toBe(0);
    expect(status.diagnostics).toEqual([]);
    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.artifact.fileName).toBe("partbench-visualization.glb");
      expect(result.artifact.mimeType).toBe("model/gltf-binary");
      expect(result.artifact.metadata).toMatchObject({
        format: "glb",
        exportKind: "visualization",
        authoritative: false,
        units: "mm",
        bodyCount: 2,
        vertexCount: 6,
        triangleCount: 2
      });
      expect(
        result.artifact.metadata.bodySummaries.map((body) => body.bodyId)
      ).toEqual(["body_rect", "body_circle"]);
    }
  });

  it("returns structured diagnostics for missing, failed, consumed, and unsupported bodies", () => {
    const missingEngine = createSingleRectangleExtrudeProject("body_missing");
    const missingReadiness = readExportReadiness(missingEngine);
    const missingSources = readDerivedSources(missingEngine);
    const missingStatus = createVisualizationMeshExportStatus({
      exportReadiness: missingReadiness,
      derivedGeometry: createEmptyDerivedGeometrySnapshot(),
      derivedGeometrySources: missingSources
    });

    expect(missingStatus.available).toBe(false);
    expect(missingStatus.diagnostics[0]).toMatchObject({
      code: "VISUALIZATION_EXPORT_MESH_MISSING",
      status: "deferred",
      bodyId: "body_missing"
    });

    const failedEngine = createSingleRectangleExtrudeProject("body_failed");
    const failedReadiness = readExportReadiness(failedEngine);
    const failedSources = readDerivedSources(failedEngine);
    const failedStatus = createVisualizationMeshExportStatus({
      exportReadiness: failedReadiness,
      derivedGeometry: createDerivedGeometrySnapshot([
        createErrorEntry(failedSources[0])
      ]),
      derivedGeometrySources: failedSources
    });

    expect(failedStatus.available).toBe(false);
    expect(failedStatus.diagnostics[0]).toMatchObject({
      code: "VISUALIZATION_EXPORT_MESH_FAILED",
      status: "unavailable",
      bodyId: "body_failed"
    });

    const consumedEngine = createConsumedExtrudeProject();
    const consumedStatus = createVisualizationMeshExportStatus({
      exportReadiness: readExportReadiness(consumedEngine),
      derivedGeometry: createReadyDerivedGeometrySnapshot(
        readDerivedSources(consumedEngine)
      ),
      derivedGeometrySources: readDerivedSources(consumedEngine)
    });

    expect(consumedStatus.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "VISUALIZATION_EXPORT_SOURCE_UNSUPPORTED",
          bodyId: "body_base",
          received: "authoredExtrude"
        })
      ])
    );

    const primitiveEngine = new CadEngine();
    primitiveEngine.apply({
      op: "scene.createBox",
      id: "box_1",
      dimensions: { width: 1, height: 1, depth: 1 }
    });
    const primitiveStatus = createVisualizationMeshExportStatus({
      exportReadiness: readExportReadiness(primitiveEngine),
      derivedGeometry: createReadyDerivedGeometrySnapshot(
        readDerivedSources(primitiveEngine)
      ),
      derivedGeometrySources: readDerivedSources(primitiveEngine)
    });

    expect(primitiveStatus.available).toBe(false);
    expect(primitiveStatus.diagnostics[0]).toMatchObject({
      code: "VISUALIZATION_EXPORT_SOURCE_UNSUPPORTED",
      status: "unavailable",
      received: "primitiveCompatibility"
    });
  });

  it("does not persist visualization artifacts or change project JSON schema", () => {
    const engine = createSingleRectangleExtrudeProject("body_source");
    const beforeJson = exportCadProjectJson(engine);
    const readiness = readExportReadiness(engine);
    const sources = readDerivedSources(engine);
    const result = createVisualizationMeshExportArtifact({
      exportReadiness: readiness,
      derivedGeometry: createReadyDerivedGeometrySnapshot(sources),
      derivedGeometrySources: sources
    });
    const afterJson = exportCadProjectJson(engine);

    expect(result.ok).toBe(true);
    expect(afterJson).toBe(beforeJson);
    expect(
      (JSON.parse(afterJson) as { schemaVersion: string }).schemaVersion
    ).toBe("web-cad.project.v16");
    expect(afterJson).not.toContain("web-cad.project.v17");
    expect(afterJson).not.toMatch(/visualization|glb|mesh/i);
  });

  it("redacts internal mesh identifiers from public status and artifact metadata", () => {
    const engine = createSingleRectangleExtrudeProject("body_public");
    const readiness = readExportReadiness(engine);
    const sources = readDerivedSources(engine);
    const mesh = createTriangleMesh("mesh-triangle-private");
    const result = createVisualizationMeshExportArtifact({
      exportReadiness: readiness,
      derivedGeometry: createDerivedGeometrySnapshot([
        createReadyEntry(sources[0], mesh)
      ]),
      derivedGeometrySources: sources
    });

    expect(result.ok).toBe(true);

    const publicText = JSON.stringify(result);
    expect(publicText).not.toContain("mesh-triangle-private");
    expect(publicText).not.toMatch(/OCCT|renderer|cache|selection-buffer/i);
  });
});

function createRectangleAndCircleExtrudeProject(): CadEngine {
  const engine = new CadEngine();

  engine.applyBatch([
    {
      op: "sketch.create",
      id: "sketch_rect",
      name: "Rectangle",
      plane: "XY"
    },
    {
      op: "sketch.addRectangle",
      sketchId: "sketch_rect",
      id: "rect_1",
      center: [0, 0],
      width: 2,
      height: 1
    },
    {
      op: "feature.extrude",
      id: "feat_rect",
      bodyId: "body_rect",
      sketchId: "sketch_rect",
      entityId: "rect_1",
      depth: 1
    },
    {
      op: "sketch.create",
      id: "sketch_circle",
      name: "Circle",
      plane: "XY"
    },
    {
      op: "sketch.addCircle",
      sketchId: "sketch_circle",
      id: "circle_1",
      center: [3, 0],
      radius: 0.5
    },
    {
      op: "feature.extrude",
      id: "feat_circle",
      bodyId: "body_circle",
      sketchId: "sketch_circle",
      entityId: "circle_1",
      depth: 1
    }
  ]);

  return engine;
}

function createSingleRectangleExtrudeProject(bodyId: string): CadEngine {
  const engine = new CadEngine();

  engine.applyBatch([
    {
      op: "sketch.create",
      id: `sketch_${bodyId}`,
      name: "Profile",
      plane: "XY"
    },
    {
      op: "sketch.addRectangle",
      sketchId: `sketch_${bodyId}`,
      id: `rect_${bodyId}`,
      center: [0, 0],
      width: 2,
      height: 1
    },
    {
      op: "feature.extrude",
      id: `feat_${bodyId}`,
      bodyId,
      sketchId: `sketch_${bodyId}`,
      entityId: `rect_${bodyId}`,
      depth: 1
    }
  ]);

  return engine;
}

function createConsumedExtrudeProject(): CadEngine {
  const engine = createSingleRectangleExtrudeProject("body_base");

  engine.applyBatch([
    {
      op: "sketch.create",
      id: "sketch_tool",
      name: "Tool",
      plane: "XY"
    },
    {
      op: "sketch.addRectangle",
      sketchId: "sketch_tool",
      id: "rect_tool",
      center: [0.25, 0],
      width: 0.5,
      height: 0.5
    },
    {
      op: "feature.extrude",
      id: "feat_add",
      bodyId: "body_add",
      sketchId: "sketch_tool",
      entityId: "rect_tool",
      depth: 0.5,
      operationMode: "add",
      targetBodyId: "body_base"
    }
  ]);

  return engine;
}

function readExportReadiness(
  engine: CadEngine
): ProjectExportReadinessQueryResponse {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "project.exportReadiness" }
  });

  if (!response.ok || response.query !== "project.exportReadiness") {
    throw new Error("Expected project.exportReadiness response.");
  }

  return response;
}

function readDerivedSources(
  engine: CadEngine
): readonly DerivedGeometrySource[] {
  const document = engine.getDocument();
  const features = readProjectFeatures(engine);

  return createDerivedGeometrySourcesFromDocument(document, features);
}

function readProjectFeatures(engine: CadEngine): readonly CadFeatureSummary[] {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "project.structure" }
  });

  if (!response.ok || response.query !== "project.structure") {
    throw new Error("Expected project.structure response.");
  }

  return response.features;
}

function createReadyDerivedGeometrySnapshot(
  sources: readonly DerivedGeometrySource[]
): DerivedGeometrySnapshot {
  return createDerivedGeometrySnapshot(
    sources.map((source) => createReadyEntry(source))
  );
}

function createEmptyDerivedGeometrySnapshot(): DerivedGeometrySnapshot {
  return createDerivedGeometrySnapshot([]);
}

function createDerivedGeometrySnapshot(
  entries: readonly DerivedGeometryEntry[]
): DerivedGeometrySnapshot {
  return {
    entries,
    meshes: entries
      .filter(
        (entry): entry is Extract<DerivedGeometryEntry, { status: "ready" }> =>
          entry.status === "ready"
      )
      .map((entry) => entry.mesh),
    supportedCount: entries.filter((entry) => entry.status !== "unsupported")
      .length,
    pendingCount: entries.filter((entry) => entry.status === "pending").length,
    readyCount: entries.filter((entry) => entry.status === "ready").length,
    errorCount: entries.filter((entry) => entry.status === "error").length
  };
}

function createReadyEntry(
  source: DerivedGeometrySource,
  mesh: RenderTriangleMesh = createTriangleMesh(source.id)
): DerivedGeometryEntry {
  return {
    objectId: source.id,
    objectKind: source.kind,
    sourceId: source.id,
    sourceKind: source.kind,
    cacheKey: createDerivedGeometryCacheKey(source),
    status: "ready",
    mesh,
    metrics: {
      objectId: source.id,
      vertexCount: mesh.vertices.length,
      triangleCount: mesh.indices.length / 3,
      roundTripMs: 1
    }
  };
}

function createErrorEntry(source: DerivedGeometrySource): DerivedGeometryEntry {
  return {
    objectId: source.id,
    objectKind: source.kind,
    sourceId: source.id,
    sourceKind: source.kind,
    cacheKey: createDerivedGeometryCacheKey(source),
    status: "error",
    error: {
      code: "TEST_DERIVED_FAILURE",
      stage: "test",
      message: "Derived geometry failed in test.",
      workerStarted: true,
      wasmLoadStatus: "ready"
    }
  };
}

function createTriangleMesh(id: string): RenderTriangleMesh {
  return {
    id,
    kind: "mesh",
    vertices: [
      [0, 0, 0],
      [1, 0, 0],
      [0, 1, 0]
    ],
    indices: [0, 1, 2],
    transform: {
      translation: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    }
  };
}

function parseGlb(bytes: Uint8Array): {
  readonly header: {
    readonly magic: number;
    readonly version: number;
    readonly length: number;
  };
  readonly json: {
    readonly asset: unknown;
    readonly extras: { readonly partbench: unknown };
    readonly buffers: readonly { readonly byteLength: number }[];
  };
  readonly binaryChunkType: number;
} {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const jsonLength = view.getUint32(12, true);
  const jsonType = view.getUint32(16, true);
  const json = JSON.parse(
    new TextDecoder().decode(bytes.slice(20, 20 + jsonLength)).trim()
  ) as {
    readonly asset: unknown;
    readonly extras: { readonly partbench: unknown };
    readonly buffers: readonly { readonly byteLength: number }[];
  };
  const binaryChunkType = view.getUint32(20 + jsonLength + 4, true);

  expect(jsonType).toBe(0x4e4f534a);

  return {
    header: {
      magic: view.getUint32(0, true),
      version: view.getUint32(4, true),
      length: view.getUint32(8, true)
    },
    json,
    binaryChunkType
  };
}
