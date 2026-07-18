import {
  CadEngine,
  type CadFeatureSummary,
  type SketchSnapshot,
  type WcadTopologyCheckpointPayloadInput
} from "@web-cad/cad-core";
import type { CadGeneratedFaceReference } from "@web-cad/cad-protocol";
import { describe, expect, it, vi } from "vitest";

import {
  createDerivedGeometryCacheKey,
  createEmptyDerivedGeometrySnapshot,
  deriveGeometrySourceMesh,
  DerivedGeometryService,
  type DerivedRevolveGeometrySource
} from "./derivedGeometry";
import {
  createDerivedExactMetadataCacheKey,
  createEmptyDerivedExactMetadataSnapshot,
  createExactMetadataRuntimeInput,
  createImportedBodyExactMetadataSources,
  DerivedExactMetadataService,
  getCurrentDerivedExactMetadataEntryForBody,
  type DerivedExactMetadataSnapshot
} from "./derivedExactMetadata";
import type {
  DerivedExactMetadataResult,
  DerivedGeometryResult,
  DerivedGeometryRevolveInput,
  DerivedGeometryRuntime
} from "./derivedGeometryRuntime";
import {
  createDerivedGeometrySourcesFromDocument,
  createRevolveDerivedGeometrySources
} from "./derivedGeometrySources";
import {
  createCurrentDerivedExactMetadataSnapshots,
  readProjectExactStepExport
} from "./projectExactExportQueries";
import { createGeneratedFaceReferenceKey } from "./sketchDisplayFrames";

describe("V17 composite revolve web integration", () => {
  it("maps real partial and full wire revolves into one display/exact recipe", async () => {
    const engine = createWireRevolveEngine({ includeFull: true });
    const partial = readRevolveSource(engine, "body_revolve_partial");
    const full = readRevolveSource(engine, "body_revolve_full");
    const revolveProfile = vi.fn(async (input: DerivedGeometryRevolveInput) => {
      void input;
      return createMeshResult(partial.id);
    });

    expect(partial).toMatchObject({
      kind: "revolve",
      sketchPlane: "XY",
      sourceIdentitySignature: expect.any(String),
      profile: {
        kind: "wire",
        frame: {
          origin: [0, 0, 0],
          uAxis: [1, 0, 0],
          vAxis: [0, 1, 0]
        },
        segments: [
          expect.objectContaining({
            kind: "line",
            sourceEntityId: "profile_line_lower",
            start: [0, 0],
            end: [2, -1]
          }),
          expect.objectContaining({
            kind: "arc",
            sourceEntityId: "profile_arc",
            startAngleDegrees: 270,
            sweepAngleDegrees: 180
          }),
          expect.objectContaining({
            kind: "line",
            sourceEntityId: "profile_line_upper",
            start: [2, 1],
            end: [0, 0]
          })
        ]
      },
      axis: { start: [0, -3], end: [0, 3] },
      angleDegrees: 180
    });
    expect(full.angleDegrees).toBe(360);
    expect(full.profile.kind).toBe("wire");

    const result = await deriveGeometrySourceMesh(
      { revolveProfile } as unknown as DerivedGeometryRuntime,
      partial
    );
    const displayInput = revolveProfile.mock.calls[0]?.[0];
    expect(displayInput).toMatchObject({
      id: partial.id,
      profile: partial.profile,
      axis: partial.axis,
      angleDegrees: 180
    });
    expect(result.mesh.vertices).toEqual([[1, 2, 3]]);
    expect(createExactMetadataRuntimeInput(partial)).toEqual({
      id: partial.id,
      source: {
        kind: "revolve",
        sketchPlane: partial.sketchPlane,
        profile: partial.profile,
        axis: partial.axis,
        angleDegrees: partial.angleDegrees
      }
    });
    expect(partial).not.toHaveProperty("placementFrame");
    expect(createExactMetadataRuntimeInput(partial).source).not.toHaveProperty(
      "placementFrame"
    );
  });

  it("applies one attached world frame to display and exact recipes", async () => {
    const source = readRevolveSource(
      createWireRevolveEngine({ attachedParentDepth: 5 }),
      "body_revolve_partial"
    );
    const moved = readRevolveSource(
      createWireRevolveEngine({ attachedParentDepth: 6 }),
      "body_revolve_partial"
    );
    const revolveProfile = vi.fn(async (input: DerivedGeometryRevolveInput) => {
      void input;
      return createMeshResult(source.id);
    });

    expect(source.profile).toMatchObject({
      kind: "wire",
      frame: {
        origin: [0, 0, 5],
        uAxis: [1, 0, 0],
        vAxis: [0, 1, 0]
      }
    });
    await deriveGeometrySourceMesh(
      { revolveProfile } as unknown as DerivedGeometryRuntime,
      source
    );
    const displayInput = revolveProfile.mock.calls[0]?.[0];
    const exactInput = createExactMetadataRuntimeInput(source);
    expect(displayInput?.profile).toEqual(source.profile);
    expect(exactInput.source).toMatchObject({ profile: source.profile });
    expect(displayInput).not.toHaveProperty("placementFrame");
    expect(exactInput.source).not.toHaveProperty("placementFrame");
    expect(moved.profile).toMatchObject({
      kind: "wire",
      frame: { origin: [0, 0, 6] }
    });
    expect(moved.sourceIdentitySignature).not.toBe(
      source.sourceIdentitySignature
    );
    expect(createDerivedGeometryCacheKey(moved)).not.toBe(
      createDerivedGeometryCacheKey(source)
    );
  });

  it("invalidates edit, retarget, and recreated lineage before stale work completes", async () => {
    const engine = createWireRevolveEngine();
    const initial = readRevolveSource(engine, "body_revolve_partial");
    engine.apply({
      op: "feature.updateRevolve",
      id: "feature_revolve_partial",
      angleDegrees: 270
    });
    const edited = readRevolveSource(engine, "body_revolve_partial");
    engine.apply({
      op: "feature.updateRevolve",
      id: "feature_revolve_partial",
      profile: secondaryProfile
    });
    const retargeted = readRevolveSource(engine, "body_revolve_partial");
    engine.apply({ op: "feature.delete", id: "feature_revolve_partial" });
    engine.apply({
      op: "feature.revolve",
      id: "feature_revolve_recreated",
      bodyId: "body_revolve_partial",
      profile: secondaryProfile,
      axis,
      angleDegrees: 270,
      operationMode: "newBody"
    });
    const recreated = readRevolveSource(engine, "body_revolve_partial");

    expect(
      new Set(
        [initial, edited, retargeted, recreated].map(
          createDerivedGeometryCacheKey
        )
      ).size
    ).toBe(4);
    const initialReady = readyExactSnapshot(initial);
    expect(
      getCurrentDerivedExactMetadataEntryForBody(
        initialReady,
        recreated.id,
        recreated
      )
    ).toBeUndefined();
    expect(
      createCurrentDerivedExactMetadataSnapshots(engine, initialReady, [
        recreated
      ])
    ).toEqual([]);

    const meshRequests = [
      deferred<DerivedGeometryResult>(),
      deferred<DerivedGeometryResult>(),
      deferred<DerivedGeometryResult>(),
      deferred<DerivedGeometryResult>()
    ];
    const exactRequests = [
      deferred<DerivedExactMetadataResult>(),
      deferred<DerivedExactMetadataResult>(),
      deferred<DerivedExactMetadataResult>(),
      deferred<DerivedExactMetadataResult>()
    ];
    let geometrySnapshot = createEmptyDerivedGeometrySnapshot();
    let exactSnapshot = createEmptyDerivedExactMetadataSnapshot();
    const geometryService = new DerivedGeometryService({
      runtime: {
        revolveProfile: vi
          .fn()
          .mockReturnValueOnce(meshRequests[0]!.promise)
          .mockReturnValueOnce(meshRequests[1]!.promise)
          .mockReturnValueOnce(meshRequests[2]!.promise)
          .mockReturnValueOnce(meshRequests[3]!.promise)
      } as unknown as DerivedGeometryRuntime,
      onChange(next) {
        geometrySnapshot = next;
      }
    });
    const exactService = new DerivedExactMetadataService({
      runtime: {
        exactBodyMetadata: vi
          .fn()
          .mockReturnValueOnce(exactRequests[0]!.promise)
          .mockReturnValueOnce(exactRequests[1]!.promise)
          .mockReturnValueOnce(exactRequests[2]!.promise)
          .mockReturnValueOnce(exactRequests[3]!.promise)
      } as unknown as DerivedGeometryRuntime,
      onChange(next) {
        exactSnapshot = next;
      }
    });

    geometryService.reconcile([initial]);
    exactService.reconcile([initial]);
    meshRequests[0]!.resolve(createMeshResult(initial.id));
    exactRequests[0]!.resolve(createExactResult(initial.id));
    await flushPromises();
    expect(geometrySnapshot.entries[0]?.status).toBe("ready");
    expect(geometrySnapshot.meshes).toHaveLength(1);
    expect(exactSnapshot.entries[0]).toMatchObject({
      status: "ready",
      metadata: { sourceKind: "revolve", volume: 24 }
    });

    geometryService.reconcile([edited]);
    exactService.reconcile([edited]);
    expect(geometrySnapshot.entries[0]?.status).toBe("pending");
    expect(geometrySnapshot.meshes).toEqual([]);
    expect(exactSnapshot.entries[0]?.status).toBe("pending");
    expect(exactSnapshot.entries[0]).not.toHaveProperty("metadata");

    for (const source of [retargeted, recreated]) {
      geometryService.reconcile([source]);
      exactService.reconcile([source]);
    }
    for (let index = 1; index < 3; index += 1) {
      meshRequests[index]!.resolve(createMeshResult(initial.id));
      exactRequests[index]!.resolve(createExactResult(initial.id));
    }
    await flushPromises();
    expect(geometrySnapshot.entries[0]?.status).toBe("pending");
    expect(geometrySnapshot.meshes).toEqual([]);
    expect(exactSnapshot.entries[0]?.status).toBe("pending");
    expect(exactSnapshot.entries[0]).not.toHaveProperty("metadata");

    meshRequests[3]!.reject(new Error("recreated revolve failed"));
    exactRequests[3]!.reject(new Error("recreated revolve exact failed"));
    await flushPromises();
    expect(geometrySnapshot.entries[0]?.status).toBe("error");
    expect(geometrySnapshot.meshes).toEqual([]);
    expect(exactSnapshot.entries[0]?.status).toBe("error");
    expect(exactSnapshot.entries[0]).not.toHaveProperty("metadata");
  });

  it("feeds only current exact evidence to health, mass, extents, and STEP", () => {
    const engine = createWireRevolveEngine();
    const source = readRevolveSource(engine, "body_revolve_partial");
    const ready = readyExactSnapshot(source);
    const [evidence] = createCurrentDerivedExactMetadataSnapshots(
      engine,
      ready,
      [source]
    );
    if (!evidence) throw new Error("Expected current revolve evidence.");

    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: { query: "project.health", derivedExactMetadata: [evidence] }
      })
    ).toMatchObject({
      ok: true,
      authoredRevolves: expect.arrayContaining([
        expect.objectContaining({
          bodyId: source.id,
          status: "healthy",
          topologyStatus: "healthy"
        })
      ])
    });
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: {
          query: "body.massProperties",
          bodyId: source.id,
          derivedExactMetadata: evidence
        }
      })
    ).toMatchObject({ ok: true, massProperties: { volume: 24 } });
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: { query: "project.extents", derivedExactMetadata: [evidence] }
      })
    ).toMatchObject({
      ok: true,
      bodies: expect.arrayContaining([
        expect.objectContaining({ bodyId: source.id, volume: 24 })
      ])
    });
    expect(readProjectExactStepExport(engine, ready, [source])).toMatchObject({
      ok: true,
      available: true,
      exportSources: expect.arrayContaining([
        expect.objectContaining({
          bodyId: source.id,
          sourceKind: "authoredRevolve",
          profile: expect.objectContaining({ kind: "wire" }),
          angleDegrees: 180
        })
      ])
    });

    engine.apply({
      op: "feature.updateRevolve",
      id: "feature_revolve_partial",
      angleDegrees: 270
    });
    const edited = readRevolveSource(engine, source.id);
    expect(
      createCurrentDerivedExactMetadataSnapshots(engine, ready, [edited])
    ).toEqual([]);
    expect(readProjectExactStepExport(engine, ready, [edited])).toMatchObject({
      available: true,
      exportSources: expect.arrayContaining([
        expect.objectContaining({
          sourceKind: "authoredRevolve",
          angleDegrees: 270,
          profile: edited.profile
        })
      ])
    });
  });

  it("preserves imported evidence while rebuilding a revolve source", async () => {
    const engine = createWireRevolveEngine();
    const initial = readRevolveSource(engine, "body_revolve_partial");
    const importedPayload = createImportedPayload();
    importBody(engine, importedPayload);
    const imported = createImportedBodyExactMetadataSources(
      readFeatures(engine),
      [importedPayload]
    )[0];
    if (!imported) throw new Error("Expected imported exact source.");
    const exactBodyMetadata = vi.fn(async (input) =>
      createExactResult(input.id)
    );
    let snapshot = createEmptyDerivedExactMetadataSnapshot();
    const service = new DerivedExactMetadataService({
      runtime: { exactBodyMetadata } as unknown as DerivedGeometryRuntime,
      onChange(next) {
        snapshot = next;
      }
    });

    service.reconcile([initial, imported]);
    await flushPromises();
    const importedKey = createDerivedExactMetadataCacheKey(imported);
    expect(
      snapshot.entries.find((entry) => entry.bodyId === imported.id)
    ).toMatchObject({ status: "ready", cacheKey: importedKey });

    engine.apply({
      op: "feature.updateRevolve",
      id: "feature_revolve_partial",
      angleDegrees: 270
    });
    service.reconcile([
      readRevolveSource(engine, "body_revolve_partial"),
      imported
    ]);
    await flushPromises();
    expect(
      snapshot.entries.find((entry) => entry.bodyId === imported.id)
    ).toMatchObject({ status: "ready", cacheKey: importedKey });
    expect(
      exactBodyMetadata.mock.calls.filter(([input]) => input.id === imported.id)
    ).toHaveLength(1);
  });

  it("does not widen wire use beyond supported new-body revolve", async () => {
    const engine = createWireRevolveEngine();
    const invalidRevolve = engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "feature.revolve",
          id: "feature_revolve_add",
          bodyId: "body_revolve_add",
          profile: primaryProfile,
          axis,
          angleDegrees: 180,
          operationMode: "add",
          targetBodyId: "body_revolve_partial"
        } as never
      ]
    });
    const invalidSweep = engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "feature.sweep",
          id: "feature_wire_sweep",
          bodyId: "body_wire_sweep",
          profile: primaryProfile,
          path: {
            kind: "entity",
            sketchId: "sketch_revolve",
            entityId: "axis"
          }
        } as never
      ]
    });

    expect(invalidRevolve).toMatchObject({ ok: false });
    expect(invalidSweep).toMatchObject({ ok: false });

    const committedFeature = readFeatures(engine).find(
      (feature) => feature.id === "feature_revolve_partial"
    );
    if (committedFeature?.kind !== "revolve") {
      throw new Error("Expected committed revolve feature.");
    }
    const malformedFeature = {
      ...committedFeature,
      operationMode: "add",
      targetBodyId: "body_revolve_partial"
    } as CadFeatureSummary;
    const [malformedSource] = createRevolveDerivedGeometrySources(
      [malformedFeature],
      readSketches(engine)
    );
    expect(malformedSource).toMatchObject({
      placementError:
        "Revolve display currently supports newBody revolve features only."
    });
    if (!malformedSource) throw new Error("Expected malformed source marker.");
    await expect(
      deriveGeometrySourceMesh({} as DerivedGeometryRuntime, malformedSource)
    ).rejects.toThrow(
      "Revolve display currently supports newBody revolve features only."
    );
  });
});

const axis = {
  type: "sketchLine" as const,
  sketchId: "sketch_revolve",
  entityId: "axis"
};

const primaryProfile = {
  kind: "wire" as const,
  sketchId: "sketch_revolve",
  segments: [
    { entityId: "profile_line_lower", orientation: "forward" as const },
    { entityId: "profile_arc", orientation: "forward" as const },
    { entityId: "profile_line_upper", orientation: "forward" as const }
  ]
};

const secondaryProfile = {
  kind: "wire" as const,
  sketchId: "sketch_revolve",
  segments: [
    { entityId: "secondary_line_lower", orientation: "forward" as const },
    { entityId: "secondary_arc", orientation: "forward" as const },
    { entityId: "secondary_line_upper", orientation: "forward" as const }
  ]
};

function createWireRevolveEngine(
  options: {
    readonly includeFull?: boolean;
    readonly attachedParentDepth?: number;
  } = {}
): CadEngine {
  const engine = new CadEngine();
  if (options.attachedParentDepth !== undefined) {
    engine.applyBatch([
      {
        op: "sketch.create",
        id: "sketch_parent",
        name: "Parent",
        plane: "XY"
      },
      {
        op: "sketch.addRectangle",
        sketchId: "sketch_parent",
        id: "parent_rectangle",
        center: [0, 0],
        width: 6,
        height: 6
      },
      {
        op: "feature.extrude",
        id: "feature_parent",
        bodyId: "body_parent",
        sketchId: "sketch_parent",
        entityId: "parent_rectangle",
        depth: options.attachedParentDepth,
        operationMode: "newBody"
      }
    ]);
    engine.apply({
      op: "sketch.createOnFace",
      id: "sketch_revolve",
      name: "Composite revolve",
      bodyId: "body_parent",
      faceStableId: "generated:face:body_parent:endCap"
    });
  } else {
    engine.apply({
      op: "sketch.create",
      id: "sketch_revolve",
      name: "Composite revolve",
      plane: "XY"
    });
  }
  engine.applyBatch([
    {
      op: "sketch.addLine",
      sketchId: "sketch_revolve",
      id: "axis",
      start: [0, -3],
      end: [0, 3],
      construction: true
    },
    ...profileEntityOps("profile", 2),
    ...profileEntityOps("secondary", 3),
    {
      op: "feature.revolve",
      id: "feature_revolve_partial",
      bodyId: "body_revolve_partial",
      profile: primaryProfile,
      axis,
      angleDegrees: 180,
      operationMode: "newBody"
    },
    ...(options.includeFull
      ? [
          {
            op: "feature.revolve" as const,
            id: "feature_revolve_full",
            bodyId: "body_revolve_full",
            profile: secondaryProfile,
            axis,
            angleDegrees: 360,
            operationMode: "newBody" as const
          }
        ]
      : [])
  ]);
  return engine;
}

function profileEntityOps(prefix: string, x: number) {
  return [
    {
      op: "sketch.addLine" as const,
      sketchId: "sketch_revolve",
      id: `${prefix}_line_lower`,
      start: [0, 0] as const,
      end: [x, -1] as const
    },
    {
      op: "sketch.addArc" as const,
      sketchId: "sketch_revolve",
      id: `${prefix}_arc`,
      definition: {
        kind: "centerAngles" as const,
        center: [x, 0] as const,
        radius: 1,
        startAngleDegrees: 270,
        sweepAngleDegrees: 180
      }
    },
    {
      op: "sketch.addLine" as const,
      sketchId: "sketch_revolve",
      id: `${prefix}_line_upper`,
      start: [x, 1] as const,
      end: [0, 0] as const
    }
  ];
}

function readRevolveSource(
  engine: CadEngine,
  bodyId: string
): DerivedRevolveGeometrySource {
  const source = createDerivedGeometrySourcesFromDocument(
    engine.getDocument(),
    readFeatures(engine),
    readGeneratedFaces(engine),
    new Map([[bodyId, readBodySourceIdentitySignature(engine, bodyId)]])
  ).find((candidate) => candidate.id === bodyId);
  if (!source || source.kind !== "revolve" || source.profile.kind !== "wire") {
    throw new Error(`Expected composite revolve source for ${bodyId}.`);
  }
  return source;
}

function readGeneratedFaces(
  engine: CadEngine
): ReadonlyMap<string, CadGeneratedFaceReference> {
  const faces = new Map<string, CadGeneratedFaceReference>();
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "body.generatedReferences", bodyId: "body_parent" }
  });
  if (!response.ok || response.query !== "body.generatedReferences") {
    return faces;
  }
  for (const face of response.faces) {
    faces.set(
      createGeneratedFaceReferenceKey(face.bodyId, face.stableId),
      face
    );
  }
  return faces;
}

function readFeatures(engine: CadEngine) {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "project.structure" }
  });
  if (!response.ok || response.query !== "project.structure") {
    throw new Error("Expected project structure.");
  }
  return response.features;
}

function readSketches(engine: CadEngine): readonly SketchSnapshot[] {
  return [...engine.getDocument().sketches.values()].map((sketch) => ({
    id: sketch.id,
    name: sketch.name,
    plane: sketch.plane,
    attachment: sketch.attachment,
    entities: [...sketch.entities.values()]
  }));
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
    throw new Error(`Expected topology for ${bodyId}.`);
  }
  return response.topology.sourceIdentity.signature;
}

function createMeshResult(id: string): DerivedGeometryResult {
  return {
    mesh: {
      id,
      kind: "mesh",
      vertices: [[1, 2, 3]],
      indices: [],
      transform: {
        translation: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1]
      }
    },
    metrics: {
      objectId: id,
      roundTripMs: 1,
      vertexCount: 1,
      triangleCount: 0
    },
    message: "ready"
  };
}

function createExactResult(id: string): DerivedExactMetadataResult {
  return {
    metadata: {
      sourceKind: "revolve",
      bounds: { min: [0, -3, -3], max: [4, 3, 3] },
      volume: 24,
      surfaceArea: 48,
      centroid: [1, 0, 0],
      topologyCounts: {
        solidCount: 1,
        faceCount: 5,
        edgeCount: 10,
        vertexCount: 6
      },
      measurementSource: "kernel-derived",
      measurementConfidence: "kernel-derived",
      diagnostics: []
    },
    metrics: { objectId: id, roundTripMs: 1 },
    message: "ready"
  };
}

function readyExactSnapshot(
  source: DerivedRevolveGeometrySource
): DerivedExactMetadataSnapshot {
  const result = createExactResult(source.id);
  return {
    entries: [
      {
        bodyId: source.id,
        sourceKind: source.kind,
        cacheKey: createDerivedExactMetadataCacheKey(source),
        status: "ready",
        metadata: result.metadata,
        metrics: result.metrics
      }
    ],
    supportedCount: 1,
    pendingCount: 0,
    readyCount: 1,
    errorCount: 0
  };
}

function createImportedPayload(): WcadTopologyCheckpointPayloadInput {
  return {
    bodyId: "body_imported",
    checkpointId: "checkpoint_imported",
    kernel: {
      boundary: "geometry-kernel",
      snapshotAlgorithm: "partbench-derived-topology-snapshot-v1"
    },
    tolerance: { linearTolerance: 0.001, angularToleranceDegrees: 0.01 },
    brepBytes: new Uint8Array([1, 2, 3]),
    topologyBytes: new Uint8Array([4]),
    signatureBytes: new Uint8Array([5])
  };
}

function importBody(
  engine: CadEngine,
  payload: WcadTopologyCheckpointPayloadInput
): void {
  const response = engine.executeBatch({
    version: "cadops.v1",
    mode: "commit",
    ops: [
      {
        op: "project.importStep",
        sourceFileName: "preserved.step",
        sourceFormat: "step",
        payloadRef: {
          kind: "transient",
          payloadId: "payload_imported",
          byteLength: 3,
          sha256:
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        },
        resolvedBodies: [
          {
            featureId: "feature_imported",
            bodyId: payload.bodyId,
            checkpointId: payload.checkpointId,
            name: "Imported",
            sourceIdentity: {
              algorithm: "partbench-source-v1",
              sha256:
                "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
            },
            checkpointStatus: "active",
            healingApplied: false
          }
        ]
      }
    ]
  });
  if (!response.ok) throw new Error(response.error.message);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}
