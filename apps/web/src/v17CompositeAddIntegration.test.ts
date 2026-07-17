import {
  CadEngine,
  type CadFeatureSummary,
  type SketchSnapshot
} from "@web-cad/cad-core";
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
import {
  createDerivedGeometrySourcesFromDocument,
  createExtrudeDerivedGeometrySources
} from "./derivedGeometrySources";

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

  it("resolves a real add-to-cut chain through the same ordered recursive recipe", async () => {
    const source = resolveAddCutChainSource();
    const runtimeSource = createBooleanExtrudeResultRuntimeSource(source);
    const booleanExtrudes = vi.fn(async () => createMeshResult(source.id));

    expect(source.sourceIdentitySignature).toEqual(expect.any(String));
    expect(runtimeSource).toMatchObject({
      kind: "booleanExtrudes",
      operation: "cut",
      target: {
        kind: "booleanExtrudes",
        operation: "add",
        target: expect.objectContaining({
          profile: expect.objectContaining({ kind: "rectangle" })
        }),
        tool: expect.objectContaining({
          profile: expect.objectContaining({ kind: "wire" })
        })
      },
      tool: {
        sketchPlane: "XY",
        profile: expect.objectContaining({
          kind: "wire",
          frame: {
            origin: [0, 0, 0],
            uAxis: [1, 0, 0],
            vAxis: [0, 1, 0]
          },
          segments: [
            expect.objectContaining({
              sourceEntityId: "cut_arc",
              sweepAngleDegrees: 180
            }),
            expect.objectContaining({ sourceEntityId: "cut_diameter" })
          ]
        }),
        depth: 2,
        side: "negative"
      }
    });
    expect(runtimeSource.tool).not.toHaveProperty("placementFrame");
    expect(createExactMetadataRuntimeInput(source)).toEqual({
      id: "body_cut",
      source: runtimeSource
    });
    await expect(
      deriveGeometrySourceMesh(
        { booleanExtrudes } as unknown as DerivedGeometryRuntime,
        source
      )
    ).resolves.toMatchObject({ mesh: { id: "body_cut" } });
    expect(booleanExtrudes).toHaveBeenCalledWith({
      id: "body_cut",
      operation: "cut",
      target: runtimeSource.target,
      tool: runtimeSource.tool
    });
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

  it("keys retarget and recreated source lineage and ignores every stale completion", async () => {
    const geometry = {
      ...resolveAddSource(),
      operation: "cut" as const
    };
    const initial = {
      ...geometry,
      sourceIdentitySignature: "body-topology-source:v1:target-a"
    };
    const retargeted = {
      ...geometry,
      sourceIdentitySignature: "body-topology-source:v1:target-b"
    };
    const recreatedTarget = {
      ...geometry,
      sourceIdentitySignature: "body-topology-source:v1:target-b-recreated"
    };
    const firstMesh = deferred<DerivedGeometryResult>();
    const secondMesh = deferred<DerivedGeometryResult>();
    const thirdMesh = deferred<DerivedGeometryResult>();
    const firstExact = deferred<DerivedExactMetadataResult>();
    const secondExact = deferred<DerivedExactMetadataResult>();
    const thirdExact = deferred<DerivedExactMetadataResult>();
    let geometrySnapshot = createEmptyDerivedGeometrySnapshot();
    let exactSnapshot = createEmptyDerivedExactMetadataSnapshot();
    const geometryService = new DerivedGeometryService({
      runtime: {
        booleanExtrudes: vi
          .fn()
          .mockReturnValueOnce(firstMesh.promise)
          .mockReturnValueOnce(secondMesh.promise)
          .mockReturnValueOnce(thirdMesh.promise)
      } as unknown as DerivedGeometryRuntime,
      onChange(next) {
        geometrySnapshot = next;
      }
    });
    const exactService = new DerivedExactMetadataService({
      runtime: {
        exactBodyMetadata: vi
          .fn()
          .mockReturnValueOnce(firstExact.promise)
          .mockReturnValueOnce(secondExact.promise)
          .mockReturnValueOnce(thirdExact.promise)
      } as unknown as DerivedGeometryRuntime,
      onChange(next) {
        exactSnapshot = next;
      }
    });

    expect(createDerivedGeometryCacheKey(retargeted)).not.toBe(
      createDerivedGeometryCacheKey(initial)
    );
    expect(createDerivedGeometryCacheKey(recreatedTarget)).not.toBe(
      createDerivedGeometryCacheKey(retargeted)
    );
    geometryService.reconcile([initial]);
    exactService.reconcile([initial]);
    geometryService.reconcile([retargeted]);
    exactService.reconcile([retargeted]);
    geometryService.reconcile([recreatedTarget]);
    exactService.reconcile([recreatedTarget]);

    firstMesh.resolve(createMeshResult(initial.id));
    firstExact.resolve(createExactResult(initial.id));
    secondMesh.resolve(createMeshResult(retargeted.id));
    secondExact.resolve(createExactResult(retargeted.id));
    await flushPromises();
    expect(geometrySnapshot.entries[0]?.status).toBe("pending");
    expect(exactSnapshot.entries[0]?.status).toBe("pending");

    thirdMesh.resolve(createMeshResult(recreatedTarget.id));
    thirdExact.resolve(createExactResult(recreatedTarget.id));
    await flushPromises();
    expect(geometrySnapshot.entries[0]?.status).toBe("ready");
    expect(exactSnapshot.entries[0]?.status).toBe("ready");
  });

  it("clears exact metadata while an edited cut rebuild is pending or failed", async () => {
    const source = {
      ...resolveAddSource(),
      operation: "cut" as const
    };
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

    second.reject(new Error("edited cut failed exact construction"));
    await flushPromises();
    expect(snapshot.entries[0]?.status).toBe("error");
    expect(snapshot.entries[0]).not.toHaveProperty("metadata");
  });

  it("routes a committed composite wire cut and still rejects wire targets", async () => {
    const add = resolveAddSource();
    const cut = {
      ...add,
      operation: "cut"
    } satisfies DerivedBooleanExtrudeGeometrySource;
    const booleanExtrudes = vi.fn(async () => createMeshResult(cut.id));

    expect(createBooleanExtrudeResultRuntimeSource(cut)).toMatchObject({
      kind: "booleanExtrudes",
      operation: "cut",
      target: expect.objectContaining({
        profile: expect.objectContaining({ kind: "rectangle" })
      }),
      tool: expect.objectContaining({
        profile: expect.objectContaining({ kind: "wire" })
      })
    });
    await expect(
      deriveGeometrySourceMesh(
        { booleanExtrudes } as unknown as DerivedGeometryRuntime,
        cut
      )
    ).resolves.toMatchObject({ mesh: { id: cut.id } });
    expect(booleanExtrudes).toHaveBeenCalledWith(
      expect.objectContaining({ operation: "cut" })
    );

    const wireTarget = {
      ...cut,
      target: cut.tool,
      tool: cut.target.kind === "extrude" ? cut.target : cut.target.tool
    } satisfies DerivedBooleanExtrudeGeometrySource;
    expect(() => createBooleanExtrudeResultRuntimeSource(wireTarget)).toThrow(
      "composite new-body wire extrude"
    );
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

function resolveAddCutChainSource(): DerivedBooleanExtrudeGeometrySource {
  const engine = new CadEngine();
  engine.applyBatch([
    {
      op: "sketch.create",
      id: "sketch_target",
      name: "Target sketch",
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
      name: "Add tool sketch",
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
    },
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
      name: "Cut tool sketch",
      plane: "XY"
    },
    {
      op: "sketch.addLine",
      sketchId: "sketch_cut",
      id: "cut_diameter",
      start: [0, 0.5],
      end: [0, -0.5]
    },
    {
      op: "sketch.addArc",
      sketchId: "sketch_cut",
      id: "cut_arc",
      definition: {
        kind: "centerAngles",
        center: [0, 0],
        radius: 0.5,
        startAngleDegrees: 270,
        sweepAngleDegrees: -180
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
      depth: 2,
      side: "negative",
      operationMode: "cut",
      targetTopologyAnchorId: "anchor_body_add"
    }
  ]);
  const structure = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "project.structure" }
  });
  if (!structure.ok || structure.query !== "project.structure") {
    throw new Error("Expected project structure for the add-to-cut chain.");
  }
  const cutFeature = structure.features.find(
    (feature) => feature.id === "feature_cut"
  );
  if (
    cutFeature?.kind !== "extrude" ||
    cutFeature.targetTopologyAnchorId !== "anchor_body_add"
  ) {
    throw new Error("Expected the cut to retain its active body anchor.");
  }
  const source = createDerivedGeometrySourcesFromDocument(
    engine.getDocument(),
    structure.features,
    new Map(),
    new Map(
      structure.bodies.map((body) => [
        body.id,
        readBodySourceIdentitySignature(engine, body.id)
      ])
    )
  ).find((candidate) => candidate.id === "body_cut");

  if (
    !source ||
    source.kind !== "extrudeBoolean" ||
    source.operation !== "cut" ||
    source.target.kind !== "extrudeBoolean" ||
    source.target.operation !== "add" ||
    source.tool.profile.kind !== "wire"
  ) {
    throw new Error("Expected one active recursive add-to-cut wire result.");
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

function wireToolSketch(
  options: {
    readonly attached?: boolean;
    readonly reversedArc?: boolean;
  } = {}
): SketchSnapshot {
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
