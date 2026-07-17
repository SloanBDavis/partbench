import type { CadFeatureSummary, SketchSnapshot } from "@web-cad/cad-core";
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
      expect.objectContaining({ profile: source.profile })
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
