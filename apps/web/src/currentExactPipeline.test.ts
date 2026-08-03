import { CadEngine, createV15ReleaseSampleBatch } from "@web-cad/cad-core";
import type {
  GeometryKernelExactBodyArtifact,
  GeometryKernelGeneratedReferences
} from "@web-cad/geometry-worker";
import { describe, expect, it } from "vitest";

import {
  createDerivedGeometryCacheKey,
  type DerivedGeometrySnapshot
} from "./derivedGeometry";
import { createDerivedGeometrySourcesFromDocument } from "./derivedGeometrySources";
import {
  createDerivedExactMetadataCacheKey,
  type DerivedExactMetadataSnapshot
} from "./derivedExactMetadata";
import {
  createCurrentExactSources,
  projectCurrentExactBodyArtifacts
} from "./currentExactPipeline";

describe("currentExactPipeline", () => {
  it("projects artifact display, metadata, topology references, and counts once per body", () => {
    const generatedReferences = createGeneratedReferences("artifact-root");
    const artifact = createArtifact("pattern_body", generatedReferences);
    const display: DerivedGeometrySnapshot = {
      entries: [
        {
          objectId: artifact.bodyId,
          objectKind: "exactBody",
          sourceId: artifact.bodyId,
          sourceKind: "exactBody",
          cacheKey: "current-display-key",
          status: "pending"
        },
        {
          objectId: "unsupported_body",
          objectKind: "exactBody",
          sourceId: "unsupported_body",
          sourceKind: "exactBody",
          cacheKey: "unsupported-display-key",
          status: "unsupported",
          message: "Unsupported fixture"
        }
      ],
      meshes: [],
      supportedCount: 1,
      pendingCount: 1,
      readyCount: 0,
      cancelledCount: 0,
      errorCount: 0
    };
    const metadata: DerivedExactMetadataSnapshot = {
      entries: [
        {
          bodyId: artifact.bodyId,
          sourceKind: "exactBody",
          cacheKey: "current-metadata-key",
          status: "pending"
        },
        {
          bodyId: "unsupported_body",
          sourceKind: "exactBody",
          cacheKey: "unsupported-metadata-key",
          status: "unsupported",
          message: "Unsupported fixture"
        }
      ],
      supportedCount: 1,
      pendingCount: 1,
      readyCount: 0,
      cancelledCount: 0,
      errorCount: 0
    };

    const projected = projectCurrentExactBodyArtifacts({
      artifacts: [artifact, artifact],
      display,
      metadata
    });

    expect(projected.display).toMatchObject({
      supportedCount: 1,
      pendingCount: 0,
      readyCount: 1,
      cancelledCount: 0,
      errorCount: 0
    });
    expect(projected.display.meshes).toHaveLength(1);
    expect(projected.display.meshes[0]).toMatchObject({
      id: artifact.bodyId,
      vertices: [
        [0, 0, 0],
        [1, 0, 0],
        [0, 1, 0]
      ],
      indices: [0, 1, 2]
    });
    expect(projected.display.entries[0]).toMatchObject({
      objectId: artifact.bodyId,
      status: "ready",
      warnings: ["PATTERN_MULTI_SOLID_RESULT"],
      generatedReferences
    });
    expect(projected.metadata).toMatchObject({
      supportedCount: 1,
      pendingCount: 0,
      readyCount: 1,
      cancelledCount: 0,
      errorCount: 0
    });
    expect(projected.metadata.entries[0]).toMatchObject({
      bodyId: artifact.bodyId,
      status: "ready",
      metadata: {
        volume: 2,
        topologyCounts: { solidCount: 2 },
        topologySnapshot: { signature: `topology:${artifact.bodyId}` },
        generatedReferences
      }
    });
    expect(projected.artifactSources).toHaveLength(1);
    expect(projected.artifactSources[0]).toMatchObject({
      id: artifact.bodyId,
      kind: "exactBody",
      sourceIdentitySignature: artifact.bodySourceIdentitySignature,
      sourceCacheKeySha256: artifact.sourceCacheKeySha256,
      source: {
        kind: "bodyArtifact",
        topologySignature: artifact.topologySnapshot.signature
      }
    });
    expect(projected.display.entries[0]?.cacheKey).toBe(
      createDerivedGeometryCacheKey(projected.artifactSources[0]!)
    );
    expect(projected.display.entries[0]?.cacheKey).not.toBe(
      "current-display-key"
    );
    expect(projected.metadata.entries[0]?.cacheKey).toBe(
      createDerivedExactMetadataCacheKey(projected.artifactSources[0]!)
    );
    expect(projected.metadata.entries[0]?.cacheKey).not.toBe(
      "current-metadata-key"
    );
  });

  it("appends an artifact body missing from both base snapshots", () => {
    const artifact = {
      ...createArtifact("shell_body"),
      sourceType: "shellFeature",
      sourceKind: "shell" as const,
      metadata: {
        ...createArtifact("shell_body").metadata,
        sourceKind: "shell" as const,
        topologyCounts: {
          solidCount: 1,
          faceCount: 1,
          edgeCount: 3,
          vertexCount: 3
        }
      }
    };

    const projected = projectCurrentExactBodyArtifacts({
      artifacts: [artifact],
      display: emptyDisplaySnapshot(),
      metadata: emptyMetadataSnapshot()
    });

    expect(projected.display.entries).toEqual([
      expect.objectContaining({
        objectId: artifact.bodyId,
        objectKind: "exactBody",
        sourceKind: "exactBody",
        status: "ready"
      })
    ]);
    expect(projected.display.entries[0]).not.toHaveProperty("warnings");
    expect(projected.metadata.entries).toEqual([
      expect.objectContaining({
        bodyId: artifact.bodyId,
        sourceKind: "exactBody",
        status: "ready"
      })
    ]);
  });

  it("projects terminal artifact failures instead of leaving bodies pending", () => {
    const projected = projectCurrentExactBodyArtifacts({
      artifacts: [],
      failures: [
        {
          bodyId: "failed_shell",
          sourceType: "shellFeature",
          cacheKeySha256: "failed-shell-key",
          status: "error",
          error: new Error("Shell feasibility failed")
        }
      ],
      display: emptyDisplaySnapshot(),
      metadata: emptyMetadataSnapshot()
    });

    expect(projected.display).toMatchObject({
      pendingCount: 0,
      readyCount: 0,
      errorCount: 1
    });
    expect(projected.display.entries).toEqual([
      expect.objectContaining({
        objectId: "failed_shell",
        status: "error",
        error: expect.objectContaining({ message: "Shell feasibility failed" })
      })
    ]);
    expect(projected.metadata).toMatchObject({
      pendingCount: 0,
      readyCount: 0,
      errorCount: 1
    });
  });

  it("removes artifact-operation bodies from legacy display derivation in every lifecycle state", () => {
    const engine = new CadEngine();
    engine.applyBatch(createV15ReleaseSampleBatch("v15-linear-pattern").ops);
    const structure = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "project.structure" }
    });
    if (!structure.ok || structure.query !== "project.structure") {
      throw new Error("Expected project structure.");
    }
    const signatures = new Map<string, string>();
    for (const body of structure.bodies) {
      const topology = engine.executeQuery({
        version: "cadops.v1",
        query: { query: "body.topology", bodyId: body.id }
      });
      if (topology.ok && topology.query === "body.topology") {
        signatures.set(body.id, topology.topology.sourceIdentity.signature);
      }
    }
    const geometrySources = createDerivedGeometrySourcesFromDocument(
      engine.getDocument(),
      structure.features,
      new Map(),
      signatures
    );
    const artifactGeometrySources = createDerivedGeometrySourcesFromDocument(
      engine.getDocument(),
      structure.features,
      new Map(),
      signatures,
      true
    );
    const pattern = structure.features.find(
      (feature) => feature.kind === "linearPattern"
    );
    if (!pattern || pattern.kind !== "linearPattern") {
      throw new Error("Expected linear pattern fixture.");
    }
    expect(geometrySources.some((source) => source.id === pattern.bodyId)).toBe(
      false
    );

    const current = createCurrentExactSources({
      document: engine.getDocument(),
      bodies: structure.bodies,
      features: structure.features,
      geometrySources,
      artifactGeometrySources,
      sourceIdentitySignaturesByBodyId: signatures
    });

    expect(current.resolutions).toContainEqual(
      expect.objectContaining({
        status: "ready",
        bodyId: pattern.bodyId,
        source: expect.objectContaining({ kind: "linearPattern" })
      })
    );
    expect(
      current.derivedGeometrySources.some(
        (source) => source.id === pattern.bodyId
      )
    ).toBe(false);
    expect(
      current.metadataSources.some((source) => source.id === pattern.bodyId)
    ).toBe(false);
    expect(
      current.displaySources.some((source) => source.id === pattern.bodyId)
    ).toBe(false);

    const signaturesWithoutPattern = new Map(signatures);
    signaturesWithoutPattern.delete(pattern.bodyId);
    const pending = createCurrentExactSources({
      document: engine.getDocument(),
      bodies: structure.bodies,
      features: structure.features,
      geometrySources,
      artifactGeometrySources,
      sourceIdentitySignaturesByBodyId: signaturesWithoutPattern
    });
    expect(pending.resolutions).toContainEqual(
      expect.objectContaining({ bodyId: pattern.bodyId, status: "pending" })
    );
    expect(
      pending.derivedGeometrySources.some(
        (source) => source.id === pattern.bodyId
      )
    ).toBe(false);
  });
});

function createArtifact(
  bodyId: string,
  generatedReferences?: GeometryKernelGeneratedReferences
): GeometryKernelExactBodyArtifact {
  return {
    artifactVersion: "partbench.exact-body-artifact.v1",
    bodyId,
    sourceType: "linearPatternFeature",
    documentSourceIdentity: {
      algorithm: "partbench-source-v1",
      sha256: "1".repeat(64)
    },
    bodySourceIdentitySignature: `body-topology-source:v1:${"2".repeat(64)}`,
    sourceCacheKeySha256: "3".repeat(64),
    sourceGraphNodeCount: 2,
    units: "mm",
    shapePolicy: "singleShapeOneOrMoreSolids",
    sourceKind: "linearPattern",
    brepFormat: "occt-brep",
    brepWriter: "BRepTools.Write_3",
    brepBytes: new Uint8Array([1]),
    brepByteLength: 1,
    brepSha256: "4".repeat(64),
    metadata: {
      sourceKind: "linearPattern",
      bounds: { min: [0, 0, 0], max: [1, 1, 0] },
      volume: 2,
      surfaceArea: 2,
      centroid: [0.5, 0.5, 0],
      topologyCounts: {
        solidCount: 2,
        faceCount: 1,
        edgeCount: 3,
        vertexCount: 3
      },
      measurementSource: "kernel-derived",
      measurementConfidence: "kernel-derived",
      diagnostics: []
    },
    topologySnapshot: {
      sourceKind: "linearPattern",
      status: "ready",
      entityCounts: {
        bodyCount: 1,
        solidCount: 2,
        faceCount: 1,
        wireCount: 0,
        loopCount: 0,
        coedgeCount: 0,
        edgeCount: 3,
        vertexCount: 3,
        axisCount: 0
      },
      entityCount: 0,
      entities: [],
      unsupportedEntityKinds: [],
      adjacencyAvailable: false,
      signatureAlgorithm: "partbench-derived-topology-snapshot-v1",
      signature: `topology:${bodyId}`,
      source: "kernel-derived",
      diagnostics: [],
      ...(generatedReferences ? { generatedReferences } : {})
    },
    displayMesh: {
      primitive: "extrude",
      positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
      indices: new Uint32Array([0, 1, 2]),
      vertexCount: 3,
      triangleCount: 1,
      faceCount: 1
    }
  };
}

function createGeneratedReferences(
  sourceIdentity: string
): GeometryKernelGeneratedReferences {
  return {
    status: "ready",
    sourceIdentity,
    faces: [
      {
        role: "startCap",
        surfaceClass: "plane",
        evidence: "kernel-builder"
      }
    ],
    edges: []
  };
}

function emptyDisplaySnapshot(): DerivedGeometrySnapshot {
  return {
    entries: [],
    meshes: [],
    supportedCount: 0,
    pendingCount: 0,
    readyCount: 0,
    cancelledCount: 0,
    errorCount: 0
  };
}

function emptyMetadataSnapshot(): DerivedExactMetadataSnapshot {
  return {
    entries: [],
    supportedCount: 0,
    pendingCount: 0,
    readyCount: 0,
    cancelledCount: 0,
    errorCount: 0
  };
}
