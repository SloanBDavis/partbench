import {
  CadEngine,
  type CadFeatureSummary,
  type SketchSnapshot
} from "@web-cad/cad-core";
import type { CadGeneratedFaceReference } from "@web-cad/cad-protocol";
import { describe, expect, it, vi } from "vitest";

import {
  createDerivedGeometryCacheKey,
  createEmptyDerivedGeometrySnapshot,
  deriveGeometrySourceMesh,
  DerivedGeometryService,
  type DerivedExtrudeGeometrySource
} from "./derivedGeometry";
import {
  createEmptyDerivedExactMetadataSnapshot,
  createExactMetadataRuntimeInput,
  DerivedExactMetadataService
} from "./derivedExactMetadata";
import type {
  DerivedExactMetadataResult,
  DerivedGeometryResult,
  DerivedGeometryRuntime
} from "./derivedGeometryRuntime";
import { createExtrudeDerivedGeometrySources } from "./derivedGeometrySources";
import { createGeneratedFaceReferenceKey } from "./sketchDisplayFrames";

describe("V17 composite extrude web integration", () => {
  it("resolves an ordered line wire and reverses endpoints exactly", () => {
    const sketch = createSketch([
      line("bottom", [0, 0], [2, 0]),
      line("right", [2, 2], [2, 0]),
      line("top", [2, 2], [0, 2]),
      line("left", [0, 0], [0, 2])
    ]);
    const source = resolveWireSource(
      sketch,
      wireFeature([
        segment("bottom"),
        segment("right", "reverse"),
        segment("top"),
        segment("left", "reverse")
      ])
    );

    expect(source.profile).toMatchObject({
      kind: "wire",
      closed: true,
      frame: {
        origin: [0, 0, 0],
        uAxis: [1, 0, 0],
        vAxis: [0, 1, 0]
      },
      segments: [
        { kind: "line", sourceEntityId: "bottom", start: [0, 0], end: [2, 0] },
        { kind: "line", sourceEntityId: "right", start: [2, 0], end: [2, 2] },
        { kind: "line", sourceEntityId: "top", start: [2, 2], end: [0, 2] },
        { kind: "line", sourceEntityId: "left", start: [0, 2], end: [0, 0] }
      ]
    });
  });

  it("reverses arc traversal without changing authored circle geometry", () => {
    const sketch = createSketch([
      line("diameter", [0, -1], [0, 1]),
      arc("round", [0, 0], 1, 270, -180)
    ]);
    const source = resolveWireSource(
      sketch,
      wireFeature([segment("diameter"), segment("round", "reverse")])
    );

    expect(source.profile.kind).toBe("wire");
    if (source.profile.kind !== "wire") throw new Error("Expected wire.");
    expect(source.profile.segments[1]).toEqual({
      kind: "arc",
      sourceEntityId: "round",
      center: [0, 0],
      radius: 1,
      startAngleDegrees: 90,
      sweepAngleDegrees: 180
    });
  });

  it("keeps two-arc order and resolves an attached frame as profile authority", () => {
    const sketch = createSketch(
      [
        arc("right-half", [0, 0], 2, 270, 180),
        arc("left-half", [0, 0], 2, 90, 180)
      ],
      {
        kind: "topologyAnchorFace",
        bodyId: "body_parent",
        topologyAnchorId: "anchor_face",
        checkpointId: "checkpoint_parent",
        planarAxis: "x",
        planarCoordinate: 5
      }
    );
    const source = resolveWireSource(
      sketch,
      wireFeature([segment("right-half"), segment("left-half")])
    );

    expect(source.profile).toMatchObject({
      kind: "wire",
      frame: {
        origin: [5, 0, 0],
        uAxis: [0, 1, 0],
        vAxis: [0, 0, 1]
      },
      segments: [
        {
          sourceEntityId: "right-half",
          startAngleDegrees: 270,
          sweepAngleDegrees: 180
        },
        {
          sourceEntityId: "left-half",
          startAngleDegrees: 90,
          sweepAngleDegrees: 180
        }
      ]
    });
    expect(source).not.toHaveProperty("placementFrame");
  });

  it("uses one deterministic resolved recipe for display, cache, and exact metadata", async () => {
    const sketch = createSketch([
      line("diameter", [0, -1], [0, 1]),
      arc("round", [0, 0], 1, 90, 180)
    ]);
    const source = resolveWireSource(
      sketch,
      wireFeature([segment("diameter"), segment("round")])
    );
    const tessellateExtrude = vi.fn(async () => createResult(source.id));
    const runtime = { tessellateExtrude } as unknown as DerivedGeometryRuntime;

    const displayed = await deriveGeometrySourceMesh(runtime, source);
    const exact = createExactMetadataRuntimeInput(source);

    expect(tessellateExtrude).toHaveBeenCalledWith(
      expect.objectContaining({ profile: source.profile }),
      undefined
    );
    expect(displayed.mesh.vertices).toEqual([[1, 2, 3]]);
    expect(exact.source).toMatchObject({
      kind: "extrude",
      profile: source.profile,
      depth: source.depth,
      side: source.side
    });
    expect(source.profile.kind).toBe("wire");
    if (source.profile.kind !== "wire") throw new Error("Expected wire.");
    expect(
      JSON.parse(createDerivedGeometryCacheKey(source)).profile.sourceIdentity
    ).toBe(source.profile.sourceIdentity);

    const editedSketch = createSketch([
      line("diameter", [0, -2], [0, 2]),
      arc("round", [0, 0], 2, 90, 180)
    ]);
    const edited = resolveWireSource(
      editedSketch,
      wireFeature([segment("diameter"), segment("round")])
    );
    expect(createDerivedGeometryCacheKey(edited)).not.toBe(
      createDerivedGeometryCacheKey(source)
    );
  });

  it("shares the exact STEP recipe for base and attached reversed-arc display", () => {
    for (const engine of [
      createWireEngine(),
      createWireEngine({ attached: true, reversedArc: true })
    ]) {
      const displaySource = resolveEngineWireSource(engine);
      expect(displaySource).not.toHaveProperty("placementError");
      const exact = engine.executeQuery({
        version: "cadops.v1",
        query: { query: "project.exportExact", format: "step" }
      });
      expect(exact).toMatchObject({
        ok: true,
        status: "supported"
      });
      if (!exact.ok || exact.query !== "project.exportExact") continue;
      const exactSource = exact.exportSources.find(
        (candidate) => candidate.bodyId === "body_wire"
      );
      expect(
        exactSource && "profile" in exactSource
          ? exactSource.profile.kind
          : undefined
      ).toBe("wire");
      if (
        !exactSource ||
        !("profile" in exactSource) ||
        exactSource.profile.kind !== "wire"
      ) {
        continue;
      }

      expect(displaySource.profile).toEqual(exactSource.profile);
    }
  });

  it("does not bypass select-only correspondence for a direct face attachment", () => {
    const source = resolveEngineWireSource(
      createWireEngine({ attached: true }),
      (face) => ({
        ...face,
        eligibleOperations: ["feature.selectReference"]
      })
    );

    expect(source).toMatchObject({
      placementError:
        "Attachment face is not eligible to place Wire sketch; derived extrude mesh is unavailable."
    });
  });

  it("invalidates and restores the resolved cache recipe across edit, undo, and redo", () => {
    const engine = createWireEngine();
    const initial = resolveEngineWireSource(engine);
    const initialKey = createDerivedGeometryCacheKey(initial);

    engine.applyBatch([
      {
        op: "sketch.updateEntity",
        sketchId: "sketch_wire",
        entity: line("diameter", [0, -2], [0, 2])
      },
      {
        op: "sketch.updateEntity",
        sketchId: "sketch_wire",
        entity: arc("round", [0, 0], 2, 90, 180)
      }
    ]);
    const editedKey = createDerivedGeometryCacheKey(
      resolveEngineWireSource(engine)
    );
    expect(editedKey).not.toBe(initialKey);

    engine.undo();
    expect(createDerivedGeometryCacheKey(resolveEngineWireSource(engine))).toBe(
      initialKey
    );

    engine.redo();
    expect(createDerivedGeometryCacheKey(resolveEngineWireSource(engine))).toBe(
      editedKey
    );
  });

  it("publishes no stale mesh after an edit fails asynchronously", async () => {
    const first = deferred<DerivedGeometryResult>();
    const second = deferred<DerivedGeometryResult>();
    const tessellateExtrude = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    let snapshot = createEmptyDerivedGeometrySnapshot();
    const service = new DerivedGeometryService({
      runtime: { tessellateExtrude } as unknown as DerivedGeometryRuntime,
      onChange(next) {
        snapshot = next;
      }
    });
    const source = resolveWireSource(
      createSketch([
        line("diameter", [0, -1], [0, 1]),
        arc("round", [0, 0], 1, 90, 180)
      ]),
      wireFeature([segment("diameter"), segment("round")])
    );
    const edited = {
      ...source,
      depth: source.depth + 1
    } satisfies DerivedExtrudeGeometrySource;

    service.reconcile([source]);
    service.reconcile([edited]);
    first.resolve(createResult(source.id));
    await Promise.resolve();
    expect(snapshot.meshes).toEqual([]);
    expect(snapshot.entries[0]?.status).toBe("pending");

    second.reject(new Error("OCCT rejected edited wire"));
    await Promise.resolve();
    await Promise.resolve();
    expect(snapshot.meshes).toEqual([]);
    expect(snapshot.entries[0]?.status).toBe("error");
  });

  it("publishes no stale exact metadata after a wire source edit fails", async () => {
    const first = deferred<DerivedExactMetadataResult>();
    const second = deferred<DerivedExactMetadataResult>();
    const exactBodyMetadata = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    let snapshot = createEmptyDerivedExactMetadataSnapshot();
    const service = new DerivedExactMetadataService({
      runtime: { exactBodyMetadata } as unknown as DerivedGeometryRuntime,
      onChange(next) {
        snapshot = next;
      }
    });
    const source = resolveWireSource(
      createSketch([
        line("diameter", [0, -1], [0, 1]),
        arc("round", [0, 0], 1, 90, 180)
      ]),
      wireFeature([segment("diameter"), segment("round")])
    );
    const edited = { ...source, depth: source.depth + 1 };

    service.reconcile([source]);
    service.reconcile([edited]);
    first.resolve(createExactResult(source.id));
    await Promise.resolve();
    expect(snapshot.entries[0]?.status).toBe("pending");

    second.reject(new Error("exact wire rebuild failed"));
    await Promise.resolve();
    await Promise.resolve();
    expect(snapshot.entries[0]?.status).toBe("error");
    expect(snapshot.entries[0]).not.toHaveProperty("metadata");
  });

  it("returns an explicit unavailable entry when a referenced segment disappears", () => {
    const sources = createExtrudeDerivedGeometrySources(
      [wireFeature([segment("missing")])],
      [createSketch([])]
    );

    expect(sources).toHaveLength(1);
    expect(sources[0]).toMatchObject({
      id: "body_wire",
      kind: "extrude",
      placementError:
        "Composite extrude feature feature_wire cannot be displayed because profile entity missing is unavailable."
    });
  });
});

function resolveWireSource(
  sketch: SketchSnapshot,
  feature: Extract<CadFeatureSummary, { kind: "extrude" }>
): DerivedExtrudeGeometrySource {
  const [source] = createExtrudeDerivedGeometrySources([feature], [sketch]);
  if (!source || source.kind !== "extrude" || source.profile.kind !== "wire") {
    throw new Error("Expected one composite new-body extrude source.");
  }
  return source;
}

function resolveEngineWireSource(
  engine: CadEngine,
  mapFace: (face: CadGeneratedFaceReference) => CadGeneratedFaceReference = (
    face
  ) => face
): DerivedExtrudeGeometrySource {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "project.structure" }
  });
  if (!response.ok || response.query !== "project.structure") {
    throw new Error("Expected project structure.");
  }
  const sketches = [...engine.getDocument().sketches.values()].map(
    (sketch) => ({
      id: sketch.id,
      name: sketch.name,
      plane: sketch.plane,
      attachment: sketch.attachment,
      entities: [...sketch.entities.values()]
    })
  );
  const generatedFacesByKey = new Map();
  const parentReferences = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "body.generatedReferences", bodyId: "body_parent" }
  });
  if (
    parentReferences.ok &&
    parentReferences.query === "body.generatedReferences"
  ) {
    for (const face of parentReferences.faces) {
      const mappedFace = mapFace(face);
      generatedFacesByKey.set(
        createGeneratedFaceReferenceKey(mappedFace.bodyId, mappedFace.stableId),
        mappedFace
      );
    }
  }
  const source = createExtrudeDerivedGeometrySources(
    response.features,
    sketches,
    generatedFacesByKey
  ).find((candidate) => candidate.id === "body_wire");
  if (!source || source.kind !== "extrude" || source.profile.kind !== "wire") {
    throw new Error("Expected resolved engine wire source.");
  }
  return source;
}

function createWireEngine(
  options: { readonly attached?: boolean; readonly reversedArc?: boolean } = {}
): CadEngine {
  const engine = new CadEngine();
  if (options.attached) {
    engine.applyBatch([
      {
        op: "sketch.create",
        id: "sketch_parent",
        name: "Parent sketch",
        plane: "XY"
      },
      {
        op: "sketch.addRectangle",
        sketchId: "sketch_parent",
        id: "rect_parent",
        center: [0, 0],
        width: 4,
        height: 4
      },
      {
        op: "feature.extrude",
        id: "feature_parent",
        bodyId: "body_parent",
        sketchId: "sketch_parent",
        entityId: "rect_parent",
        depth: 5,
        operationMode: "newBody"
      }
    ]);
    engine.apply({
      op: "sketch.createOnFace",
      id: "sketch_wire",
      name: "Wire sketch",
      bodyId: "body_parent",
      faceStableId: "generated:face:body_parent:endCap"
    });
  } else {
    engine.apply({
      op: "sketch.create",
      id: "sketch_wire",
      name: "Wire sketch",
      plane: "XY"
    });
  }
  engine.applyBatch([
    {
      op: "sketch.addLine",
      sketchId: "sketch_wire",
      id: "diameter",
      start: [0, -1],
      end: [0, 1]
    },
    {
      op: "sketch.addArc",
      sketchId: "sketch_wire",
      id: "round",
      definition: {
        kind: "centerAngles",
        center: [0, 0],
        radius: 1,
        startAngleDegrees: options.reversedArc ? 270 : 90,
        sweepAngleDegrees: options.reversedArc ? -180 : 180
      }
    },
    {
      op: "feature.extrude",
      id: "feature_wire",
      bodyId: "body_wire",
      profile: {
        kind: "wire",
        sketchId: "sketch_wire",
        segments: [
          segment("diameter"),
          segment("round", options.reversedArc ? "reverse" : "forward")
        ]
      },
      depth: 4,
      operationMode: "newBody"
    }
  ]);
  return engine;
}

function wireFeature(
  segments: readonly {
    readonly entityId: string;
    readonly orientation: "forward" | "reverse";
  }[]
): Extract<CadFeatureSummary, { kind: "extrude" }> {
  const profile = { kind: "wire" as const, sketchId: "sketch_wire", segments };
  return {
    id: "feature_wire",
    kind: "extrude",
    partId: "part_1",
    bodyId: "body_wire",
    sketchId: "sketch_wire",
    profile,
    depth: 4,
    side: "positive",
    operationMode: "newBody",
    source: { type: "sketchEntity", sketchId: "sketch_wire", profile }
  };
}

function createSketch(
  entities: SketchSnapshot["entities"],
  attachment?: SketchSnapshot["attachment"]
): SketchSnapshot {
  return {
    id: "sketch_wire",
    name: "Wire sketch",
    plane: "XY",
    ...(attachment ? { attachment } : {}),
    entities
  };
}

function segment(
  entityId: string,
  orientation: "forward" | "reverse" = "forward"
) {
  return { entityId, orientation } as const;
}

function line(
  id: string,
  start: readonly [number, number],
  end: readonly [number, number]
) {
  return { id, kind: "line" as const, start, end, construction: false };
}

function arc(
  id: string,
  center: readonly [number, number],
  radius: number,
  startAngleDegrees: number,
  sweepAngleDegrees: number
) {
  return {
    id,
    kind: "arc" as const,
    center,
    radius,
    startAngleDegrees,
    sweepAngleDegrees,
    construction: false
  };
}

function createResult(id: string): DerivedGeometryResult {
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
      sourceKind: "extrude",
      bounds: { min: [0, 0, 0], max: [1, 1, 1] },
      volume: 1,
      surfaceArea: 6,
      centroid: [0.5, 0.5, 0.5],
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
    metrics: { objectId: id, roundTripMs: 1 },
    message: "ready"
  };
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
