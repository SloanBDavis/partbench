import type { CadFeatureSummary, SketchSnapshot } from "@web-cad/cad-core";
import { describe, expect, it, vi } from "vitest";

import { createBooleanExtrudeResultRuntimeSource } from "./booleanExtrudeRuntimeSource";
import {
  createDerivedGeometryCacheKey,
  createEmptyDerivedGeometrySnapshot,
  deriveGeometrySourceMesh,
  DerivedGeometryService,
  type DerivedBooleanExtrudeGeometrySource
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

describe("V17 composite add web integration", () => {
  it("uses one recursive mixed line/arc recipe for display and exact routes", async () => {
    const source = resolveAddSource();
    const booleanExtrudes = vi.fn<DerivedGeometryRuntime["booleanExtrudes"]>(
      async () => createMeshResult(source.id)
    );
    const runtime = { booleanExtrudes } as unknown as DerivedGeometryRuntime;

    const result = await deriveGeometrySourceMesh(runtime, source);
    const displayInput = booleanExtrudes.mock.calls[0]?.[0];
    const exactInput = createExactMetadataRuntimeInput(source);

    expect(result.mesh.id).toBe("body_add");
    expect(displayInput).toEqual({
      id: "body_add",
      operation: "add",
      target: expect.objectContaining({
        profile: expect.objectContaining({ kind: "rectangle" })
      }),
      tool: expect.objectContaining({
        profile: expect.objectContaining({
          kind: "wire",
          segments: [
            expect.objectContaining({
              kind: "line",
              sourceEntityId: "tool_diameter"
            }),
            expect.objectContaining({
              kind: "arc",
              sourceEntityId: "tool_arc"
            })
          ]
        })
      })
    });
    expect(exactInput).toEqual({
      id: "body_add",
      source: {
        kind: "booleanExtrudes",
        operation: displayInput?.operation,
        target: displayInput?.target,
        tool: displayInput?.tool
      }
    });
    expect(displayInput?.tool).not.toHaveProperty("placementFrame");
  });

  it("keeps a reversed arc in one attached world frame without double placement", () => {
    const source = resolveAddSource({ attached: true, reversedArc: true });
    const runtimeSource = createBooleanExtrudeResultRuntimeSource(source);

    expect(runtimeSource.operation).toBe("add");
    expect(runtimeSource.tool).toMatchObject({
      sketchPlane: "XY",
      profile: {
        kind: "wire",
        frame: {
          origin: [5, 0, 0],
          uAxis: [0, 1, 0],
          vAxis: [0, 0, 1]
        },
        segments: [
          expect.objectContaining({ kind: "line" }),
          expect.objectContaining({
            kind: "arc",
            startAngleDegrees: 90,
            sweepAngleDegrees: 180
          })
        ]
      }
    });
    expect(runtimeSource.tool).not.toHaveProperty("placementFrame");
    expect(createExactMetadataRuntimeInput(source).source).toEqual(
      runtimeSource
    );
  });

  it("keys target and tool edits and ignores both stale mesh completions", async () => {
    const source = resolveAddSource();
    const targetEdited = editAddTarget(source, 6);
    const toolEdited = editAddToolDepth(targetEdited, 7);
    const first = deferred<DerivedGeometryResult>();
    const second = deferred<DerivedGeometryResult>();
    const third = deferred<DerivedGeometryResult>();
    const booleanExtrudes = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
      .mockReturnValueOnce(third.promise);
    let snapshot = createEmptyDerivedGeometrySnapshot();
    const service = new DerivedGeometryService({
      runtime: { booleanExtrudes } as unknown as DerivedGeometryRuntime,
      onChange(next) {
        snapshot = next;
      }
    });

    expect(
      new Set(
        [source, targetEdited, toolEdited].map(createDerivedGeometryCacheKey)
      ).size
    ).toBe(3);
    service.reconcile([source]);
    service.reconcile([targetEdited]);
    service.reconcile([toolEdited]);

    first.resolve(createMeshResult(source.id));
    second.resolve(createMeshResult(source.id));
    await flushPromises();
    expect(snapshot.entries[0]?.status).toBe("pending");
    expect(snapshot.meshes).toEqual([]);

    third.resolve(createMeshResult(source.id));
    await flushPromises();
    expect(snapshot.entries[0]?.status).toBe("ready");
    expect(snapshot.meshes.map((mesh) => mesh.id)).toEqual(["body_add"]);
  });

  it("clears exact metadata while edited add evidence is pending or failed", async () => {
    const source = resolveAddSource();
    const edited = editAddToolDepth(source, 8);
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

    service.reconcile([source]);
    service.reconcile([edited]);
    first.resolve(createExactResult(source.id));
    await flushPromises();
    expect(snapshot.entries[0]?.status).toBe("pending");
    expect(snapshot.entries[0]).not.toHaveProperty("metadata");

    second.reject(new Error("edited add failed exact construction"));
    await flushPromises();
    expect(snapshot.entries[0]?.status).toBe("error");
    expect(snapshot.entries[0]).not.toHaveProperty("metadata");
  });

  it("rejects malformed composite wire cut before any runtime request", async () => {
    const add = resolveAddSource();
    const malformed = {
      ...add,
      operation: "cut"
    } satisfies DerivedBooleanExtrudeGeometrySource;
    const booleanExtrudes = vi.fn();

    expect(() => createBooleanExtrudeResultRuntimeSource(malformed)).toThrow(
      "Composite wire extrudes are not supported as cut tools"
    );
    await expect(
      deriveGeometrySourceMesh(
        { booleanExtrudes } as unknown as DerivedGeometryRuntime,
        malformed
      )
    ).rejects.toThrow("Composite wire extrudes are not supported as cut tools");
    expect(booleanExtrudes).not.toHaveBeenCalled();
  });
});

function resolveAddSource(
  options: { readonly attached?: boolean; readonly reversedArc?: boolean } = {}
): DerivedBooleanExtrudeGeometrySource {
  const features = [
    rectangleTargetFeature(),
    wireAddFeature(options.reversedArc ?? false)
  ];
  const sketches = [rectangleTargetSketch(), wireToolSketch(options)];
  const [source] = createExtrudeDerivedGeometrySources(features, sketches);

  if (!source || source.kind !== "extrudeBoolean") {
    throw new Error("Expected one active composite add result source.");
  }
  if (source.tool.profile.kind !== "wire") {
    throw new Error("Expected a composite wire add tool.");
  }
  return source;
}

function rectangleTargetFeature(): Extract<
  CadFeatureSummary,
  { readonly kind: "extrude" }
> {
  return {
    id: "feature_target",
    kind: "extrude",
    partId: "part_1",
    bodyId: "body_target",
    sketchId: "sketch_target",
    entityId: "target_rect",
    profileKind: "rectangle",
    depth: 4,
    side: "positive",
    operationMode: "newBody",
    source: {
      type: "sketchEntity",
      sketchId: "sketch_target",
      entityId: "target_rect"
    }
  };
}

function wireAddFeature(
  reversedArc: boolean
): Extract<CadFeatureSummary, { readonly kind: "extrude" }> {
  const profile = {
    kind: "wire" as const,
    sketchId: "sketch_tool",
    segments: [
      { entityId: "tool_diameter", orientation: "forward" as const },
      {
        entityId: "tool_arc",
        orientation: reversedArc ? ("reverse" as const) : ("forward" as const)
      }
    ]
  };
  return {
    id: "feature_add",
    kind: "extrude",
    partId: "part_1",
    bodyId: "body_add",
    sketchId: "sketch_tool",
    profile,
    depth: 4,
    side: "positive",
    operationMode: "add",
    targetBodyId: "body_target",
    source: {
      type: "sketchEntity",
      sketchId: "sketch_tool",
      profile
    }
  };
}

function rectangleTargetSketch(): SketchSnapshot {
  return {
    id: "sketch_target",
    name: "Target sketch",
    plane: "XY",
    entities: [
      {
        id: "target_rect",
        kind: "rectangle",
        center: [0, 0],
        width: 4,
        height: 4,
        construction: false
      }
    ]
  };
}

function wireToolSketch(options: {
  readonly attached?: boolean;
  readonly reversedArc?: boolean;
}): SketchSnapshot {
  return {
    id: "sketch_tool",
    name: "Tool sketch",
    plane: "XY",
    ...(options.attached
      ? {
          attachment: {
            kind: "topologyAnchorFace" as const,
            bodyId: "body_target",
            topologyAnchorId: "anchor_target",
            checkpointId: "checkpoint_target",
            planarAxis: "x" as const,
            planarCoordinate: 5
          }
        }
      : {}),
    entities: [
      {
        id: "tool_diameter",
        kind: "line",
        start: [0, -1],
        end: [0, 1],
        construction: false
      },
      {
        id: "tool_arc",
        kind: "arc",
        center: [0, 0],
        radius: 1,
        startAngleDegrees: options.reversedArc ? 270 : 90,
        sweepAngleDegrees: options.reversedArc ? -180 : 180,
        construction: false
      }
    ]
  };
}

function editAddTarget(
  source: DerivedBooleanExtrudeGeometrySource,
  depth: number
): DerivedBooleanExtrudeGeometrySource {
  if (source.target.kind !== "extrude") {
    throw new Error("Expected primitive target fixture.");
  }
  return { ...source, target: { ...source.target, depth } };
}

function editAddToolDepth(
  source: DerivedBooleanExtrudeGeometrySource,
  depth: number
): DerivedBooleanExtrudeGeometrySource {
  return { ...source, tool: { ...source.tool, depth } };
}

function createMeshResult(id: string): DerivedGeometryResult {
  return {
    mesh: {
      id,
      kind: "mesh",
      vertices: [[0, 0, 0]],
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

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}
