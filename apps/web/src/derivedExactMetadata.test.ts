import { CadEngine, type CadFeatureSummary } from "@web-cad/cad-core";
import type { CadGeneratedFaceReference } from "@web-cad/cad-protocol";
import { describe, expect, it } from "vitest";
import {
  createDerivedExactMetadataCacheKey,
  createEmptyDerivedExactMetadataSnapshot,
  createExactMetadataRuntimeInput,
  DerivedExactMetadataService,
  type DerivedExactMetadataSnapshot
} from "./derivedExactMetadata";
import {
  createDerivedGeometryCacheKey,
  createPrimitiveDerivedGeometrySource,
  type DerivedBooleanExtrudeGeometrySource,
  type DerivedExtrudeGeometrySource,
  type DerivedGeometrySource
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

function createMetadataResult(
  objectId: string,
  sourceKind: "extrude" | "booleanExtrudes",
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

function getDerivedSources(
  engine: CadEngine
): readonly DerivedGeometrySource[] {
  return createDerivedGeometrySourcesFromDocument(
    engine.getDocument(),
    getProjectStructureFeatures(engine),
    getGeneratedFacesByKey(engine, ["body_rect_1"])
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
