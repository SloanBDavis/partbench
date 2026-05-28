import {
  CadEngine,
  exportCadProjectJson,
  type CadFeatureSummary
} from "@web-cad/cad-core";
import type { CadGeneratedFaceReference } from "@web-cad/cad-protocol";
import { describe, expect, it } from "vitest";
import {
  createDerivedExactMetadataCacheKey,
  createBodyTopologyDerivedExactMetadataSnapshot,
  createEmptyDerivedExactMetadataSnapshot,
  createExactMetadataRuntimeInput,
  DerivedExactMetadataService,
  formatDerivedExactMetadataEntryStatus,
  getDerivedExactMetadataEntryForBody,
  type DerivedExactMetadataEntry,
  type DerivedExactMetadataSnapshot
} from "./derivedExactMetadata";
import {
  createDerivedGeometryCacheKey,
  createPrimitiveDerivedGeometrySource,
  type DerivedBooleanExtrudeGeometrySource,
  type DerivedExtrudeGeometrySource,
  type DerivedGeometrySource,
  type DerivedRevolveGeometrySource
} from "./derivedGeometry";
import { createDerivedGeometrySourcesFromDocument } from "./derivedGeometrySources";
import type {
  DerivedExactMetadataInput,
  DerivedExactMetadataResult,
  DerivedGeometryRuntime
} from "./derivedGeometryRuntime";
import { createGeneratedFaceReferenceKey } from "./sketchDisplayFrames";

describe("derivedExactMetadata", () => {
  it("creates cache keys from the same authored source inputs as mesh sources", () => {
    const source = createExtrudeSource("body_rect_1");
    const deeperSource: DerivedExtrudeGeometrySource = {
      ...source,
      depth: 8
    };
    const negativeSource: DerivedExtrudeGeometrySource = {
      ...source,
      side: "negative"
    };
    const editedProfileSource: DerivedExtrudeGeometrySource = {
      ...source,
      profile: {
        kind: "rectangle",
        center: [1, 2],
        width: 6,
        height: 5
      }
    };
    const placedSource: DerivedExtrudeGeometrySource = {
      ...source,
      placementFrame: {
        origin: [0, 0, 3],
        uAxis: [1, 0, 0],
        vAxis: [0, 1, 0]
      }
    };

    expect(JSON.parse(createDerivedExactMetadataCacheKey(source))).toEqual({
      kind: "exactMetadata",
      source: createDerivedGeometryCacheKey(source)
    });
    expect(createDerivedExactMetadataCacheKey(source)).not.toBe(
      createDerivedExactMetadataCacheKey(deeperSource)
    );
    expect(createDerivedExactMetadataCacheKey(source)).not.toBe(
      createDerivedExactMetadataCacheKey(negativeSource)
    );
    expect(createDerivedExactMetadataCacheKey(source)).not.toBe(
      createDerivedExactMetadataCacheKey(editedProfileSource)
    );
    expect(createDerivedExactMetadataCacheKey(source)).not.toBe(
      createDerivedExactMetadataCacheKey(placedSource)
    );

    const revolveSource = createRevolveSource("body_revolve_1");
    const editedAxisSource: DerivedRevolveGeometrySource = {
      ...revolveSource,
      axis: { start: [0, -2], end: [0, 3] }
    };
    const editedAngleSource: DerivedRevolveGeometrySource = {
      ...revolveSource,
      angleDegrees: 180
    };

    expect(
      JSON.parse(createDerivedExactMetadataCacheKey(revolveSource))
    ).toEqual({
      kind: "exactMetadata",
      source: createDerivedGeometryCacheKey(revolveSource)
    });
    expect(createDerivedExactMetadataCacheKey(revolveSource)).not.toBe(
      createDerivedExactMetadataCacheKey(editedAxisSource)
    );
    expect(createDerivedExactMetadataCacheKey(revolveSource)).not.toBe(
      createDerivedExactMetadataCacheKey(editedAngleSource)
    );
  });

  it("maps ready exact metadata entries into body.topology query snapshots", () => {
    const entry = createReadyExactMetadataEntry("body_rect_1", "extrude", 42);
    expect(
      getDerivedExactMetadataEntryForBody(
        {
          entries: [entry],
          supportedCount: 1,
          pendingCount: 0,
          readyCount: 1,
          errorCount: 0
        },
        "body_rect_1"
      )
    ).toBe(entry);

    const snapshot = createBodyTopologyDerivedExactMetadataSnapshot(
      entry,
      'body-topology:v1:{"bodyId":"body_rect_1"}'
    );

    expect(snapshot).toEqual({
      bodyId: "body_rect_1",
      sourceIdentityCacheKey: 'body-topology:v1:{"bodyId":"body_rect_1"}',
      status: "ready",
      metadata: {
        source: "kernel-derived",
        confidence: "kernel-derived",
        bounds: {
          min: [0, 0, 0],
          max: [1, 2, 3],
          size: [1, 2, 3],
          center: [0.5, 1, 1.5]
        },
        volume: 42,
        surfaceArea: 20,
        centroid: [0.5, 1, 1.5],
        topologyCounts: {
          solidCount: 1,
          faceCount: 6,
          edgeCount: 12,
          vertexCount: 8
        },
        diagnostics: []
      }
    });
  });

  it("maps exact metadata terminal states and leaves pending query-only", () => {
    expect(
      createBodyTopologyDerivedExactMetadataSnapshot(
        {
          bodyId: "body_pending",
          sourceKind: "extrude",
          cacheKey: "exact:pending",
          status: "pending"
        },
        "topology:pending"
      )
    ).toBeUndefined();
    expect(formatDerivedExactMetadataEntryStatus(undefined)).toBeUndefined();
    expect(
      formatDerivedExactMetadataEntryStatus({
        bodyId: "body_pending",
        sourceKind: "extrude",
        cacheKey: "exact:pending",
        status: "pending"
      })
    ).toBe("Pending");
    expect(
      createBodyTopologyDerivedExactMetadataSnapshot(
        {
          bodyId: "body_unsupported",
          sourceKind: "extrudeBoolean",
          cacheKey: "exact:unsupported",
          status: "unsupported",
          message: "Circle tool exact metadata is unsupported."
        },
        "topology:unsupported"
      )
    ).toMatchObject({
      bodyId: "body_unsupported",
      status: "unsupported",
      error: {
        code: "UNSUPPORTED_EXACT_METADATA_SOURCE",
        message: "Circle tool exact metadata is unsupported."
      }
    });
    expect(
      createBodyTopologyDerivedExactMetadataSnapshot(
        {
          bodyId: "body_unavailable",
          sourceKind: "revolve",
          cacheKey: "exact:unavailable",
          status: "error",
          error: {
            code: "UNAVAILABLE_BINDING",
            stage: "occt",
            message: "Exact metadata binding is unavailable.",
            workerStarted: true,
            wasmLoadStatus: "ready"
          }
        },
        "topology:unavailable"
      )
    ).toMatchObject({
      bodyId: "body_unavailable",
      status: "unavailable-binding",
      error: {
        code: "UNAVAILABLE_BINDING",
        message: "Exact metadata binding is unavailable."
      }
    });
    expect(
      formatDerivedExactMetadataEntryStatus({
        bodyId: "body_failed",
        sourceKind: "revolve",
        cacheKey: "exact:failed",
        status: "error",
        error: {
          code: "KERNEL_FAILED",
          stage: "kernel",
          message: "Kernel failed.",
          workerStarted: true,
          wasmLoadStatus: "ready"
        }
      })
    ).toBe("Kernel failed");
  });

  it("enriches selected-body topology with matching exact metadata without mutating project JSON", () => {
    const engine = createExtrudedRectangleEngine();
    const bodyId = "body_rect_1";
    const beforeJson = exportCadProjectJson(engine);
    const sourceIdentityCacheKey = readBodyTopologyCacheKey(engine, bodyId);
    const derivedExactMetadata = createBodyTopologyDerivedExactMetadataSnapshot(
      createReadyExactMetadataEntry(bodyId, "extrude", 42),
      sourceIdentityCacheKey
    );

    if (!derivedExactMetadata) {
      throw new Error("Expected exact metadata query snapshot.");
    }

    const response = engine.executeQuery({
      version: "cadops.v1",
      query: {
        query: "body.topology",
        bodyId,
        derivedExactMetadata
      }
    });

    expect(response).toMatchObject({
      ok: true,
      query: "body.topology",
      topology: {
        bodyId,
        status: "healthy",
        exactGeometryAvailable: true,
        exactMeasurementsAvailable: true,
        measurementConfidence: "kernel-derived",
        exactMetadata: {
          status: "healthy",
          volume: 42
        }
      }
    });
    expect(exportCadProjectJson(engine)).toBe(beforeJson);
  });

  it("enriches authored revolve topology with derived exact metadata while generated references remain unsupported", () => {
    const engine = createRevolvedRectangleEngine();
    const bodyId = "body_revolve_1";
    const sourceIdentityCacheKey = readBodyTopologyCacheKey(engine, bodyId);
    const derivedExactMetadata = createBodyTopologyDerivedExactMetadataSnapshot(
      createReadyExactMetadataEntry(bodyId, "revolve", 64),
      sourceIdentityCacheKey
    );

    if (!derivedExactMetadata) {
      throw new Error("Expected exact metadata query snapshot.");
    }

    const response = engine.executeQuery({
      version: "cadops.v1",
      query: {
        query: "body.topology",
        bodyId,
        derivedExactMetadata
      }
    });
    const generatedReferences = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "body.generatedReferences", bodyId }
    });

    expect(response).toMatchObject({
      ok: true,
      query: "body.topology",
      topology: {
        bodyId,
        sourceKind: "authoredRevolve",
        exactGeometryAvailable: true,
        exactMeasurementsAvailable: true,
        measurementConfidence: "kernel-derived",
        exactMetadata: {
          status: "healthy",
          volume: 64
        }
      }
    });
    expect(generatedReferences).toMatchObject({
      ok: false,
      query: "body.generatedReferences",
      error: {
        code: "UNSUPPORTED_BODY_REFERENCES"
      }
    });
  });

  it("requests and caches exact metadata for authored extrude sources", async () => {
    const snapshots: DerivedExactMetadataSnapshot[] = [];
    const runtime = createRuntime(async (input) =>
      createMetadataResult(input.id, input.source.kind)
    );
    const service = new DerivedExactMetadataService({
      runtime,
      onChange: (snapshot) => snapshots.push(snapshot)
    });
    const source = createExtrudeSource("body_rect_1");

    service.reconcile([source]);

    expect(snapshots.at(-1)?.entries).toMatchObject([
      {
        bodyId: "body_rect_1",
        sourceKind: "extrude",
        status: "pending"
      }
    ]);
    expect(runtime.exactInputs).toEqual([
      {
        id: "body_rect_1",
        source: {
          kind: "extrude",
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [0, 0],
            width: 4,
            height: 2
          },
          depth: 3,
          side: "positive"
        }
      }
    ]);

    await flushPromises();

    const snapshot =
      snapshots.at(-1) ?? createEmptyDerivedExactMetadataSnapshot();
    expect(snapshot).toMatchObject({
      supportedCount: 1,
      pendingCount: 0,
      readyCount: 1,
      errorCount: 0
    });
    expect(snapshot.entries[0]).toMatchObject({
      bodyId: "body_rect_1",
      status: "ready",
      metadata: {
        sourceKind: "extrude",
        volume: 10
      }
    });
  });

  it("requests exact metadata for supported boolean add and cut sources", async () => {
    const runtime = createRuntime(async (input) =>
      createMetadataResult(input.id, input.source.kind)
    );
    const service = new DerivedExactMetadataService({
      runtime,
      onChange: () => {}
    });
    const addSource: DerivedBooleanExtrudeGeometrySource = {
      id: "body_add_1",
      kind: "extrudeBoolean",
      operation: "add",
      target: createExtrudeSource("body_target"),
      tool: createExtrudeSource("body_tool")
    };
    const cutSource: DerivedBooleanExtrudeGeometrySource = {
      id: "body_cut_1",
      kind: "extrudeBoolean",
      operation: "cut",
      target: createCircleExtrudeSource("body_circle_target"),
      tool: createExtrudeSource("body_tool")
    };

    service.reconcile([addSource, cutSource]);

    expect(runtime.exactInputs.map((input) => input.source)).toMatchObject([
      {
        kind: "booleanExtrudes",
        operation: "add",
        target: { profile: { kind: "rectangle" } },
        tool: { profile: { kind: "rectangle" } }
      },
      {
        kind: "booleanExtrudes",
        operation: "cut",
        target: { profile: { kind: "circle" } },
        tool: { profile: { kind: "rectangle" } }
      }
    ]);
  });

  it("requests and caches exact metadata for authored revolve sources", async () => {
    const runtime = createRuntime(async (input) =>
      createMetadataResult(input.id, input.source.kind)
    );
    const service = new DerivedExactMetadataService({
      runtime,
      onChange: () => {}
    });
    const source: DerivedRevolveGeometrySource = {
      ...createRevolveSource("body_revolve_1"),
      placementFrame: {
        origin: [0, 0, 3],
        uAxis: [1, 0, 0],
        vAxis: [0, 1, 0]
      }
    };

    service.reconcile([source]);
    await flushPromises();

    expect(runtime.exactInputs).toEqual([
      {
        id: "body_revolve_1",
        source: {
          kind: "revolve",
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [2, 0],
            width: 1,
            height: 3
          },
          axis: { start: [0, -2], end: [0, 2] },
          angleDegrees: 360,
          placementFrame: {
            origin: [0, 0, 3],
            uAxis: [1, 0, 0],
            vAxis: [0, 1, 0]
          }
        }
      }
    ]);
    expect(service.getSnapshot().entries[0]).toMatchObject({
      bodyId: "body_revolve_1",
      sourceKind: "revolve",
      status: "ready",
      metadata: { sourceKind: "revolve", volume: 10 }
    });
  });

  it("marks unsupported sources without requesting exact metadata", () => {
    const snapshots: DerivedExactMetadataSnapshot[] = [];
    const runtime = createRuntime(async (input) =>
      createMetadataResult(input.id, input.source.kind)
    );
    const service = new DerivedExactMetadataService({
      runtime,
      onChange: (snapshot) => snapshots.push(snapshot)
    });
    const unsupportedBoolean: DerivedBooleanExtrudeGeometrySource = {
      id: "body_cut_unsupported",
      kind: "extrudeBoolean",
      operation: "cut",
      target: createExtrudeSource("body_target"),
      tool: createCircleExtrudeSource("body_circle_tool")
    };

    service.reconcile([
      createPrimitiveDerivedGeometrySource({
        id: "box_1",
        kind: "box",
        dimensions: { width: 1, height: 1, depth: 1 },
        transform: {
          translation: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1]
        }
      }),
      {
        ...createExtrudeSource("body_stale_attachment"),
        placementError: "Attachment unresolved."
      },
      {
        ...createRevolveSource("body_stale_revolve_attachment"),
        placementError: "Attachment unresolved for revolve."
      },
      unsupportedBoolean
    ]);

    const snapshot =
      snapshots.at(-1) ?? createEmptyDerivedExactMetadataSnapshot();
    expect(runtime.exactInputs).toEqual([]);
    expect(snapshot.entries).toMatchObject([
      {
        bodyId: "body_stale_attachment",
        status: "unsupported",
        message: "Attachment unresolved."
      },
      {
        bodyId: "body_stale_revolve_attachment",
        status: "unsupported",
        message: "Attachment unresolved for revolve."
      },
      {
        bodyId: "body_cut_unsupported",
        status: "unsupported",
        message:
          "Exact metadata currently supports rectangle tool boolean extrudes only."
      }
    ]);
  });

  it("ignores stale exact metadata after extrude source invalidation", async () => {
    const first = createDeferred<DerivedExactMetadataResult>();
    const second = createDeferred<DerivedExactMetadataResult>();
    const snapshots: DerivedExactMetadataSnapshot[] = [];
    const runtime = createRuntime((input) =>
      input.source.kind === "extrude" && input.source.depth === 3
        ? first.promise
        : second.promise
    );
    const service = new DerivedExactMetadataService({
      runtime,
      onChange: (snapshot) => snapshots.push(snapshot)
    });
    const initialSource = createExtrudeSource("body_rect_1");
    const editedSource: DerivedExtrudeGeometrySource = {
      ...initialSource,
      depth: 8
    };

    service.reconcile([initialSource]);
    service.reconcile([editedSource]);

    first.resolve(createMetadataResult("body_rect_1", "extrude"));
    await flushPromises();

    expect(snapshots.at(-1)?.entries[0]).toMatchObject({
      bodyId: "body_rect_1",
      status: "pending",
      cacheKey: createDerivedExactMetadataCacheKey(editedSource)
    });

    second.resolve(createMetadataResult("body_rect_1", "extrude", 24));
    await flushPromises();

    expect(snapshots.at(-1)?.entries[0]).toMatchObject({
      bodyId: "body_rect_1",
      status: "ready",
      cacheKey: createDerivedExactMetadataCacheKey(editedSource),
      metadata: { volume: 24 }
    });
  });

  it("removes exact metadata entries across feature delete and restores after undo", async () => {
    const engine = createExtrudedRectangleEngine();
    const service = new DerivedExactMetadataService({
      runtime: createRuntime(async (input) =>
        createMetadataResult(input.id, input.source.kind)
      ),
      onChange: () => {}
    });

    service.reconcile(getDerivedSources(engine));
    await flushPromises();
    expect(service.getSnapshot().entries.map((entry) => entry.bodyId)).toEqual([
      "body_rect_1"
    ]);

    engine.apply({ op: "feature.delete", id: "feat_rect_1" });
    service.reconcile(getDerivedSources(engine));
    expect(service.getSnapshot().entries).toEqual([]);

    engine.undo();
    service.reconcile(getDerivedSources(engine));
    await flushPromises();
    expect(service.getSnapshot().entries.map((entry) => entry.bodyId)).toEqual([
      "body_rect_1"
    ]);
  });

  it("ignores stale boolean exact metadata after target profile edits", async () => {
    const initialSource: DerivedBooleanExtrudeGeometrySource = {
      id: "body_add_1",
      kind: "extrudeBoolean",
      operation: "add",
      target: createExtrudeSource("body_target"),
      tool: createExtrudeSource("body_tool")
    };
    const editedSource: DerivedBooleanExtrudeGeometrySource = {
      ...initialSource,
      target: {
        ...initialSource.target,
        profile: {
          kind: "rectangle",
          center: [2, 3],
          width: 8,
          height: 2
        }
      }
    };
    const first = createDeferred<DerivedExactMetadataResult>();
    const second = createDeferred<DerivedExactMetadataResult>();
    const snapshots: DerivedExactMetadataSnapshot[] = [];
    const runtime = createRuntime((input) =>
      input.source.kind === "booleanExtrudes" &&
      input.source.target.profile.kind === "rectangle" &&
      input.source.target.profile.width === 4
        ? first.promise
        : second.promise
    );
    const service = new DerivedExactMetadataService({
      runtime,
      onChange: (snapshot) => snapshots.push(snapshot)
    });

    service.reconcile([initialSource]);
    service.reconcile([editedSource]);

    first.resolve(createMetadataResult("body_add_1", "booleanExtrudes"));
    await flushPromises();

    expect(snapshots.at(-1)?.entries[0]).toMatchObject({
      bodyId: "body_add_1",
      status: "pending",
      cacheKey: createDerivedExactMetadataCacheKey(editedSource)
    });

    second.resolve(createMetadataResult("body_add_1", "booleanExtrudes", 18));
    await flushPromises();

    expect(snapshots.at(-1)?.entries[0]).toMatchObject({
      bodyId: "body_add_1",
      status: "ready",
      metadata: { sourceKind: "booleanExtrudes", volume: 18 }
    });
  });

  it("ignores stale revolve exact metadata after axis edits", async () => {
    const initialSource = createRevolveSource("body_revolve_1");
    const editedSource: DerivedRevolveGeometrySource = {
      ...initialSource,
      axis: { start: [0, -3], end: [0, 3] }
    };
    const first = createDeferred<DerivedExactMetadataResult>();
    const second = createDeferred<DerivedExactMetadataResult>();
    const snapshots: DerivedExactMetadataSnapshot[] = [];
    const runtime = createRuntime((input) =>
      input.source.kind === "revolve" && input.source.axis.start[1] === -2
        ? first.promise
        : second.promise
    );
    const service = new DerivedExactMetadataService({
      runtime,
      onChange: (snapshot) => snapshots.push(snapshot)
    });

    service.reconcile([initialSource]);
    service.reconcile([editedSource]);

    first.resolve(createMetadataResult("body_revolve_1", "revolve"));
    await flushPromises();

    expect(snapshots.at(-1)?.entries[0]).toMatchObject({
      bodyId: "body_revolve_1",
      status: "pending",
      cacheKey: createDerivedExactMetadataCacheKey(editedSource)
    });

    second.resolve(createMetadataResult("body_revolve_1", "revolve", 32));
    await flushPromises();

    expect(snapshots.at(-1)?.entries[0]).toMatchObject({
      bodyId: "body_revolve_1",
      status: "ready",
      metadata: { sourceKind: "revolve", volume: 32 }
    });
  });

  it("builds exact metadata runtime input with placement frames intact", () => {
    const source: DerivedExtrudeGeometrySource = {
      ...createExtrudeSource("body_attached_1"),
      placementFrame: {
        origin: [0, 0, 3],
        uAxis: [1, 0, 0],
        vAxis: [0, 1, 0]
      }
    };

    expect(createExactMetadataRuntimeInput(source)).toMatchObject({
      id: "body_attached_1",
      source: {
        kind: "extrude",
        placementFrame: {
          origin: [0, 0, 3],
          uAxis: [1, 0, 0],
          vAxis: [0, 1, 0]
        }
      }
    });
  });

  it("removes revolve exact metadata entries across feature delete and undo", async () => {
    const engine = createRevolvedRectangleEngine();
    const service = new DerivedExactMetadataService({
      runtime: createRuntime(async (input) =>
        createMetadataResult(input.id, input.source.kind)
      ),
      onChange: () => {}
    });

    service.reconcile(getDerivedSources(engine, ["body_revolve_1"]));
    await flushPromises();
    expect(service.getSnapshot().entries.map((entry) => entry.bodyId)).toEqual([
      "body_revolve_1"
    ]);

    engine.apply({ op: "feature.delete", id: "feat_revolve_1" });
    service.reconcile(getDerivedSources(engine, ["body_revolve_1"]));
    expect(service.getSnapshot().entries).toEqual([]);

    engine.undo();
    service.reconcile(getDerivedSources(engine, ["body_revolve_1"]));
    await flushPromises();
    expect(service.getSnapshot().entries.map((entry) => entry.bodyId)).toEqual([
      "body_revolve_1"
    ]);
  });
});

function createExtrudeSource(id = "body_rect_1"): DerivedExtrudeGeometrySource {
  return {
    id,
    kind: "extrude",
    sketchPlane: "XY",
    profile: {
      kind: "rectangle",
      center: [0, 0],
      width: 4,
      height: 2
    },
    depth: 3,
    side: "positive"
  };
}

function createCircleExtrudeSource(id: string): DerivedExtrudeGeometrySource {
  return {
    id,
    kind: "extrude",
    sketchPlane: "XY",
    profile: {
      kind: "circle",
      center: [0, 0],
      radius: 2
    },
    depth: 3,
    side: "positive"
  };
}

function createRevolveSource(id: string): DerivedRevolveGeometrySource {
  return {
    id,
    kind: "revolve",
    sketchPlane: "XY",
    profile: {
      kind: "rectangle",
      center: [2, 0],
      width: 1,
      height: 3
    },
    axis: { start: [0, -2], end: [0, 2] },
    angleDegrees: 360
  };
}

function createMetadataResult(
  objectId: string,
  sourceKind: "extrude" | "booleanExtrudes" | "revolve",
  volume = 10
): DerivedExactMetadataResult {
  return {
    metadata: {
      sourceKind,
      bounds: {
        min: [0, 0, 0],
        max: [1, 2, 3]
      },
      volume,
      surfaceArea: 20,
      centroid: [0.5, 1, 1.5],
      topologyCounts: {
        solidCount: 1,
        faceCount: 6,
        edgeCount: 12,
        vertexCount: 8
      },
      measurementSource: "kernel-derived",
      measurementConfidence: "kernel-derived",
      diagnostics: []
    },
    metrics: {
      objectId,
      roundTripMs: 1
    },
    message: `Derived exact metadata for ${objectId}.`
  };
}

function createReadyExactMetadataEntry(
  bodyId: string,
  sourceKind: "extrude" | "booleanExtrudes" | "revolve",
  volume = 10
): DerivedExactMetadataEntry {
  return {
    bodyId,
    sourceKind:
      sourceKind === "booleanExtrudes" ? "extrudeBoolean" : sourceKind,
    cacheKey: `exact:${bodyId}`,
    status: "ready",
    metadata: createMetadataResult(bodyId, sourceKind, volume).metadata,
    metrics: {
      objectId: bodyId,
      roundTripMs: 1
    }
  };
}

function readBodyTopologyCacheKey(engine: CadEngine, bodyId: string): string {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "body.topology", bodyId }
  });

  if (!response.ok || response.query !== "body.topology") {
    throw new Error(`Expected topology response for ${bodyId}.`);
  }

  return response.topology.sourceIdentity.cacheKey;
}

function createRuntime(
  handler: (
    input: DerivedExactMetadataInput
  ) => Promise<DerivedExactMetadataResult>
): DerivedGeometryRuntime & {
  readonly exactInputs: readonly DerivedExactMetadataInput[];
} {
  const exactInputs: DerivedExactMetadataInput[] = [];

  return {
    exactInputs,
    tessellateBox() {
      throw new Error("Mesh requests are not used by exact metadata tests.");
    },
    tessellateCylinder() {
      throw new Error("Mesh requests are not used by exact metadata tests.");
    },
    tessellateSphere() {
      throw new Error("Mesh requests are not used by exact metadata tests.");
    },
    tessellateCone() {
      throw new Error("Mesh requests are not used by exact metadata tests.");
    },
    tessellateTorus() {
      throw new Error("Mesh requests are not used by exact metadata tests.");
    },
    tessellateExtrude() {
      throw new Error("Mesh requests are not used by exact metadata tests.");
    },
    revolveProfile() {
      throw new Error("Mesh requests are not used by exact metadata tests.");
    },
    booleanExtrudes() {
      throw new Error("Mesh requests are not used by exact metadata tests.");
    },
    hole() {
      throw new Error("Mesh requests are not used by exact metadata tests.");
    },
    exactBodyMetadata(input) {
      exactInputs.push(input);
      return handler(input);
    },
    dispose() {}
  };
}

function createExtrudedRectangleEngine(): CadEngine {
  const engine = new CadEngine();

  engine.applyBatch([
    { op: "sketch.create", id: "sketch_1", name: "Profile", plane: "XY" },
    {
      op: "sketch.addRectangle",
      sketchId: "sketch_1",
      id: "rect_1",
      center: [0, 0],
      width: 4,
      height: 2
    }
  ]);
  engine.apply({
    op: "feature.extrude",
    id: "feat_rect_1",
    bodyId: "body_rect_1",
    sketchId: "sketch_1",
    entityId: "rect_1",
    depth: 3
  });

  return engine;
}

function createRevolvedRectangleEngine(): CadEngine {
  const engine = new CadEngine();

  engine.applyBatch([
    { op: "sketch.create", id: "sketch_1", name: "Revolve", plane: "XY" },
    {
      op: "sketch.addRectangle",
      sketchId: "sketch_1",
      id: "rect_1",
      center: [2, 0],
      width: 1,
      height: 3
    },
    {
      op: "sketch.addLine",
      sketchId: "sketch_1",
      id: "axis_1",
      start: [0, -2],
      end: [0, 2]
    },
    {
      op: "feature.revolve",
      id: "feat_revolve_1",
      bodyId: "body_revolve_1",
      sketchId: "sketch_1",
      entityId: "rect_1",
      axis: { type: "sketchLine", sketchId: "sketch_1", entityId: "axis_1" },
      angleDegrees: 360
    }
  ]);

  return engine;
}

function getDerivedSources(
  engine: CadEngine,
  generatedReferenceBodyIds: readonly string[] = ["body_rect_1"]
): readonly DerivedGeometrySource[] {
  return createDerivedGeometrySourcesFromDocument(
    engine.getDocument(),
    getProjectStructureFeatures(engine),
    getGeneratedFacesByKey(engine, generatedReferenceBodyIds)
  );
}

function getProjectStructureFeatures(
  engine: CadEngine
): readonly CadFeatureSummary[] {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "project.structure" }
  });

  if (!response.ok || response.query !== "project.structure") {
    throw new Error("Expected project.structure query response.");
  }

  return response.features;
}

function getGeneratedFacesByKey(
  engine: CadEngine,
  bodyIds: readonly string[]
): ReadonlyMap<string, CadGeneratedFaceReference> {
  const facesByKey = new Map<string, CadGeneratedFaceReference>();

  for (const bodyId of bodyIds) {
    const response = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "body.generatedReferences", bodyId }
    });

    if (!response.ok || response.query !== "body.generatedReferences") {
      continue;
    }

    for (const face of response.faces) {
      facesByKey.set(
        createGeneratedFaceReferenceKey(face.bodyId, face.stableId),
        face
      );
    }
  }

  return facesByKey;
}

function createDeferred<T>(): {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
} {
  let resolveValue: ((value: T) => void) | undefined;
  const promise = new Promise<T>((resolve) => {
    resolveValue = resolve;
  });

  return {
    promise,
    resolve(value: T) {
      resolveValue?.(value);
    }
  };
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}
