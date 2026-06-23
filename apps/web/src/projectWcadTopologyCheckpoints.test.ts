import {
  CadEngine,
  createV13ReleaseSampleBatch,
  exportCadProjectWcad,
  readCadProjectWcad,
  type CadFeatureSummary,
  type SketchSnapshot
} from "@web-cad/cad-core";
import type { GeometryKernelExactTopologyCheckpointPayload } from "@web-cad/geometry-worker";
import { describe, expect, it, vi } from "vitest";
import type { DerivedGeometryRuntime } from "./derivedGeometryRuntime";
import {
  createProjectTopologyAnchorCreationPlanForGeneratedReference,
  createProjectWcadTopologyCheckpointPayloadInputs,
  exportProjectWcadWithTopologyCheckpoints,
  isProjectWcadTopologyCheckpointPayloadError
} from "./projectWcadTopologyCheckpoints";

describe("projectWcadTopologyCheckpoints", () => {
  it("creates WCAD v2 checkpoint payload inputs from supported source-backed checkpoints", async () => {
    const engine = createRectangleCheckpointEngine();
    const runtime = createCheckpointRuntime();
    const structure = readProjectStructure(engine);
    const payloads = await createProjectWcadTopologyCheckpointPayloadInputs({
      document: engine.getDocument(),
      features: structure.features,
      sketches: readSketches(engine),
      runtime
    });

    expect(payloads).toHaveLength(1);
    expect(runtime.exactTopologyCheckpointPayload).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "body_rect_1",
        checkpointId: "checkpoint_rect_1",
        bodyId: "body_rect_1",
        source: expect.objectContaining({
          kind: "extrude",
          depth: 3
        })
      })
    );
    expect(payloads[0]).toMatchObject({
      checkpointId: "checkpoint_rect_1",
      bodyId: "body_rect_1",
      sourceFeatureId: "feat_rect_1",
      kernel: {
        boundary: "geometry-kernel",
        snapshotAlgorithm: "partbench-derived-topology-snapshot-v1"
      },
      tolerance: {
        linearTolerance: 0.001,
        angularToleranceDegrees: 0.01
      }
    });
    expect(new TextDecoder().decode(payloads[0]?.brepBytes)).toContain(
      "CASCADE Topology"
    );

    const exported = await exportCadProjectWcad(engine, {
      topologyCheckpoints: payloads
    });
    const read = await readCadProjectWcad(exported.bytes);

    expect(exported.manifest.packageVersion).toBe("partbench.wcad.v2");
    expect(read.ok).toBe(true);
    if (!read.ok) {
      throw new Error(read.issues[0]?.message);
    }
    expect(read.checkpointPayloads).toHaveLength(1);
    expect(read.checkpointPayloads?.[0]).toMatchObject({
      checkpointId: "checkpoint_rect_1",
      bodyId: "body_rect_1",
      sourceFeatureId: "feat_rect_1"
    });
    expect(JSON.stringify(payloads)).not.toMatch(
      /rendererId|renderId|meshId|occtId|occtShape|gpuId|selectionBufferId|triangleIndex|faceIndex|edgeIndex|vertexIndex|fileHandle|opfsPath|localPath/i
    );
  });

  it("exports checkpointed projects with generated payloads through the app save helper", async () => {
    const engine = createRectangleCheckpointEngine();
    const runtime = createCheckpointRuntime();
    const exported = await exportProjectWcadWithTopologyCheckpoints({
      engine,
      features: readProjectStructure(engine).features,
      sketches: readSketches(engine),
      runtime,
      createdAt: "2026-06-22T00:00:00.000Z",
      modifiedAt: "2026-06-22T00:00:00.000Z"
    });
    const read = await readCadProjectWcad(exported.bytes);

    expect(runtime.exactTopologyCheckpointPayload).toHaveBeenCalledTimes(1);
    expect(exported.manifest.packageVersion).toBe("partbench.wcad.v2");
    expect(exported.checkpointPayloads).toHaveLength(1);
    expect(read.ok).toBe(true);
    if (!read.ok) {
      throw new Error(read.issues[0]?.message);
    }
    expect(read.checkpointPayloads).toHaveLength(1);
    expect(JSON.stringify(exported.manifest)).not.toMatch(
      /rendererId|renderId|meshId|occtId|occtShape|gpuId|selectionBufferId|triangleIndex|faceIndex|edgeIndex|vertexIndex|fileHandle|opfsPath|localPath/i
    );
  });

  it("keeps ordinary projects on WCAD v1 and does not request checkpoint payloads", async () => {
    const engine = createRectangleExtrudeEngine();
    const runtime = createCheckpointRuntime();
    const exported = await exportProjectWcadWithTopologyCheckpoints({
      engine,
      features: readProjectStructure(engine).features,
      sketches: readSketches(engine),
      runtime,
      createdAt: "2026-06-22T00:00:00.000Z",
      modifiedAt: "2026-06-22T00:00:00.000Z"
    });

    expect(runtime.exactTopologyCheckpointPayload).not.toHaveBeenCalled();
    expect(exported.manifest.packageVersion).toBe("partbench.wcad.v1");
    expect(exported.checkpointPayloads).toBeUndefined();
  });

  it("plans explicit selected-reference topology anchors and persists them through normal WCAD save", async () => {
    const engine = createRectangleExtrudeEngine();
    const runtime = createCheckpointRuntime();
    const structure = readProjectStructure(engine);
    const target = {
      bodyId: "body_plain_1",
      stableId: "generated:face:body_plain_1:endCap",
      kind: "face" as const
    };
    const planned =
      await createProjectTopologyAnchorCreationPlanForGeneratedReference({
        engine,
        features: structure.features,
        sketches: readSketches(engine),
        runtime,
        target
      });

    expect(planned.ok).toBe(true);
    if (!planned.ok) {
      throw new Error(planned.message);
    }
    expect(engine.getDocument().topologyIdentity).toBeUndefined();
    expect(planned.plan).toMatchObject({
      status: "ready",
      createsCheckpoint: true,
      createsAnchor: true,
      opCount: 2,
      mutatesSource: false
    });
    expect(planned.plan.candidate).toMatchObject({
      stableId: target.stableId,
      kind: "face",
      status: "bound",
      confidence: "exact"
    });

    const dryRun = engine.executeBatch({
      ...planned.plan.proposedBatch,
      mode: "dryRun"
    });
    expect(dryRun.ok).toBe(true);
    expect(engine.getDocument().topologyIdentity).toBeUndefined();

    const commit = engine.executeBatch(planned.plan.proposedBatch);
    expect(commit.ok).toBe(true);
    const topologyIdentity = engine.getDocument().topologyIdentity;
    expect(topologyIdentity?.checkpoints).toHaveLength(1);
    expect(topologyIdentity?.anchors).toEqual([
      expect.objectContaining({
        bodyId: target.bodyId,
        entityKind: "face",
        stableId: target.stableId,
        state: "active"
      })
    ]);

    const exported = await exportProjectWcadWithTopologyCheckpoints({
      engine,
      features: readProjectStructure(engine).features,
      sketches: readSketches(engine),
      runtime
    });
    const read = await readCadProjectWcad(exported.bytes);

    expect(exported.manifest.packageVersion).toBe("partbench.wcad.v2");
    expect(exported.checkpointPayloads).toHaveLength(1);
    expect(read.ok).toBe(true);
    if (!read.ok) {
      throw new Error(read.issues[0]?.message);
    }
    expect(read.project.document.topologyIdentity?.anchors).toEqual([
      expect.objectContaining({
        stableId: target.stableId,
        checkpointEntityId: topologyIdentity?.anchors[0]?.checkpointEntityId
      })
    ]);
    expect(JSON.stringify(planned)).not.toMatch(
      /rendererId|renderId|meshId|occtId|occtShape|gpuId|selectionBufferId|triangleIndex|faceIndex|edgeIndex|vertexIndex|fileHandle|opfsPath|localPath|checkpoint-local-face/i
    );
  });

  it("returns structured diagnostics and does not mutate when selected reference evidence is ambiguous", async () => {
    const engine = createRectangleExtrudeEngine();
    const runtime = createCheckpointRuntime({
      duplicateEndCapFace: true
    });
    const planned =
      await createProjectTopologyAnchorCreationPlanForGeneratedReference({
        engine,
        features: readProjectStructure(engine).features,
        sketches: readSketches(engine),
        runtime,
        target: {
          bodyId: "body_plain_1",
          stableId: "generated:face:body_plain_1:endCap",
          kind: "face"
        }
      });

    expect(planned).toMatchObject({
      ok: false,
      status: "ambiguous"
    });
    if (planned.ok) {
      throw new Error("Expected ambiguous topology anchor plan.");
    }
    expect(planned.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "TOPOLOGY_MATCH_AMBIGUOUS",
          severity: "warning"
        })
      ])
    );
    expect(engine.getDocument().topologyIdentity).toBeUndefined();
  });

  it("returns structured diagnostics and does not mutate unsupported selected topology anchor targets", async () => {
    const engine = createRectangleExtrudeEngine();
    const planned =
      await createProjectTopologyAnchorCreationPlanForGeneratedReference({
        engine,
        features: readProjectStructure(engine).features,
        sketches: readSketches(engine),
        runtime: createCheckpointRuntime(),
        target: {
          bodyId: "body_plain_1",
          stableId: "generated:vertex:body_plain_1:start:uMin:vMin",
          kind: "vertex"
        }
      });

    expect(planned).toMatchObject({
      ok: false,
      status: "unsupported"
    });
    if (planned.ok) {
      throw new Error("Expected unsupported topology anchor plan.");
    }
    expect(planned.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "TOPOLOGY_MATCH_UNSUPPORTED",
          severity: "warning"
        })
      ])
    );
    expect(engine.getDocument().topologyIdentity).toBeUndefined();
  });

  it("exports V13 source-owned checkpoint anchor ids instead of generated snapshot-local ids", async () => {
    const engine = new CadEngine();
    const response = engine.executeBatch(
      createV13ReleaseSampleBatch("v13-topology-anchor-repair-command-chain")
    );
    const runtime = createCheckpointRuntime();
    const exported = await exportProjectWcadWithTopologyCheckpoints({
      engine,
      features: readProjectStructure(engine).features,
      sketches: readSketches(engine),
      runtime
    });
    const read = await readCadProjectWcad(exported.bytes);

    expect(response.ok).toBe(true);
    expect(exported.manifest.packageVersion).toBe("partbench.wcad.v2");
    expect(read.ok).toBe(true);
    if (!read.ok) {
      throw new Error(read.issues[0]?.message);
    }
    expect(
      read.checkpointPayloads?.map((payload) => payload.checkpointId)
    ).toEqual(
      expect.arrayContaining([
        "v13_checkpoint_repair_body",
        "v13_checkpoint_repair_body_rebuilt",
        "v13_checkpoint_target_body"
      ])
    );
    expect(JSON.stringify(exported.manifest)).not.toMatch(
      /rendererId|renderId|meshId|occtId|occtShape|gpuId|selectionBufferId|triangleIndex|faceIndex|edgeIndex|vertexIndex|fileHandle|opfsPath|localPath/i
    );
  });

  it("reconstructs checkpoint payloads for source-backed bodies after they are consumed", async () => {
    const engine = createRectangleCheckpointEngine();

    engine.apply({
      op: "feature.extrude",
      id: "feat_cut_1",
      bodyId: "body_cut_1",
      targetBodyId: "body_rect_1",
      sketchId: "sketch_rect_1",
      entityId: "rect_1",
      depth: 1,
      side: "positive",
      operationMode: "cut"
    });

    const runtime = createCheckpointRuntime();
    const payloads = await createProjectWcadTopologyCheckpointPayloadInputs({
      document: engine.getDocument(),
      features: readProjectStructure(engine).features,
      sketches: readSketches(engine),
      runtime
    });

    expect(payloads).toHaveLength(1);
    expect(runtime.exactTopologyCheckpointPayload).toHaveBeenCalledWith(
      expect.objectContaining({
        checkpointId: "checkpoint_rect_1",
        bodyId: "body_rect_1",
        source: expect.objectContaining({
          kind: "extrude"
        })
      })
    );
  });

  it("returns structured diagnostics when a checkpoint source cannot be resolved", async () => {
    const engine = createRectangleCheckpointEngine();

    await expect(
      createProjectWcadTopologyCheckpointPayloadInputs({
        document: engine.getDocument(),
        features: [],
        sketches: readSketches(engine),
        runtime: createCheckpointRuntime()
      })
    ).rejects.toSatisfy((error: unknown) => {
      expect(isProjectWcadTopologyCheckpointPayloadError(error)).toBe(true);
      if (!isProjectWcadTopologyCheckpointPayloadError(error)) {
        return false;
      }
      expect(error.issues).toEqual([
        expect.objectContaining({
          code: "WCAD_UNSUPPORTED_CHECKPOINT_ENTRY",
          severity: "error",
          entryPath: "checkpoints/checkpoint_rect_1.brep",
          message: expect.stringContaining(
            "does not have a supported exact source"
          )
        })
      ]);
      return true;
    });
  });

  it("returns structured diagnostics when runtime payload generation fails", async () => {
    const engine = createRectangleCheckpointEngine();
    const runtime = {
      exactTopologyCheckpointPayload: vi.fn(async () => {
        throw new Error("BRep writer unavailable.");
      })
    } satisfies Pick<DerivedGeometryRuntime, "exactTopologyCheckpointPayload">;

    await expect(
      createProjectWcadTopologyCheckpointPayloadInputs({
        document: engine.getDocument(),
        features: readProjectStructure(engine).features,
        sketches: readSketches(engine),
        runtime
      })
    ).rejects.toSatisfy((error: unknown) => {
      expect(isProjectWcadTopologyCheckpointPayloadError(error)).toBe(true);
      if (!isProjectWcadTopologyCheckpointPayloadError(error)) {
        return false;
      }
      expect(error.issues[0]).toMatchObject({
        code: "WCAD_UNSUPPORTED_CHECKPOINT_ENTRY",
        message: "BRep writer unavailable."
      });
      return true;
    });
  });
});

function createRectangleExtrudeEngine(): CadEngine {
  const engine = new CadEngine();

  engine.applyBatch([
    {
      op: "sketch.create",
      id: "sketch_plain_1",
      name: "Plain rectangle sketch",
      plane: "XY"
    },
    {
      op: "sketch.addRectangle",
      sketchId: "sketch_plain_1",
      id: "rect_plain_1",
      center: [0, 0],
      width: 2,
      height: 1
    },
    {
      op: "feature.extrude",
      id: "feat_plain_1",
      bodyId: "body_plain_1",
      sketchId: "sketch_plain_1",
      entityId: "rect_plain_1",
      depth: 1,
      operationMode: "newBody"
    }
  ]);

  return engine;
}

function createRectangleCheckpointEngine(): CadEngine {
  const engine = new CadEngine();

  engine.applyBatch([
    {
      op: "sketch.create",
      id: "sketch_rect_1",
      name: "Rectangle sketch",
      plane: "XY"
    },
    {
      op: "sketch.addRectangle",
      sketchId: "sketch_rect_1",
      id: "rect_1",
      center: [0, 0],
      width: 2,
      height: 1
    },
    {
      op: "feature.extrude",
      id: "feat_rect_1",
      bodyId: "body_rect_1",
      sketchId: "sketch_rect_1",
      entityId: "rect_1",
      depth: 3,
      operationMode: "newBody"
    },
    {
      op: "topology.checkpoint.create",
      checkpointId: "checkpoint_rect_1",
      bodyId: "body_rect_1",
      sourceFeatureId: "feat_rect_1",
      sourceIdentity: {
        algorithm: "partbench-source-v1",
        sha256:
          "1111111111111111111111111111111111111111111111111111111111111111"
      },
      status: "active"
    },
    {
      op: "topology.anchor.create",
      anchorId: "anchor_rect_1_end_face",
      entityKind: "face",
      bodyId: "body_rect_1",
      checkpointId: "checkpoint_rect_1",
      checkpointEntityId: "checkpoint_rect_1_end_face",
      stableId: "generated:face:body_rect_1:endCap",
      sourceFeatureId: "feat_rect_1",
      sourceSemanticRole: "end cap",
      signatureHash: "checkpoint_rect_1_end_face_signature"
    }
  ]);

  return engine;
}

function readProjectStructure(engine: CadEngine): {
  readonly features: readonly CadFeatureSummary[];
} {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "project.structure" }
  });

  if (!response.ok || response.query !== "project.structure") {
    throw new Error("Expected project.structure response.");
  }

  return { features: response.features };
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

function createCheckpointRuntime(
  options: { readonly duplicateEndCapFace?: boolean } = {}
): Pick<DerivedGeometryRuntime, "exactTopologyCheckpointPayload"> {
  return {
    exactTopologyCheckpointPayload: vi.fn(async (input) => ({
      checkpointPayload: createCheckpointPayloadFixture(
        input.checkpointId,
        input.bodyId,
        input.source.kind === "extrude" ? input.source.depth : 1,
        options
      ),
      metrics: {
        objectId: input.bodyId,
        roundTripMs: 1
      },
      message: `Derived checkpoint payload for ${input.bodyId}.`
    }))
  };
}

function createCheckpointPayloadFixture(
  checkpointId: string,
  bodyId: string,
  depth: number,
  options: { readonly duplicateEndCapFace?: boolean } = {}
): GeometryKernelExactTopologyCheckpointPayload {
  const brepBytes = new TextEncoder().encode(
    `CASCADE Topology checkpoint fixture ${checkpointId}`
  );
  const entities = [
    {
      localId: "checkpoint-local-body",
      kind: "body" as const,
      source: "kernel-derived" as const,
      signature: `${bodyId}:body`,
      bounds: {
        min: [0, 0, 0] as const,
        max: [1, 1, depth] as const
      }
    },
    {
      localId: "checkpoint-local-face",
      kind: "face" as const,
      source: "kernel-derived" as const,
      signature: `${bodyId}:face`,
      bounds: {
        min: [0, 0, depth] as const,
        max: [1, 1, depth] as const
      }
    }
  ];
  const topologyEntities = options.duplicateEndCapFace
    ? [
        ...entities,
        {
          ...entities[1],
          localId: "checkpoint-local-face-duplicate"
        }
      ]
    : entities;
  const topologySnapshot = {
    sourceKind: "extrude" as const,
    source: "kernel-derived" as const,
    status: "partial" as const,
    entityCounts: {
      bodyCount: 1,
      solidCount: 0,
      faceCount: 1,
      wireCount: 0,
      edgeCount: 0,
      vertexCount: 0,
      loopCount: 0,
      coedgeCount: 0,
      axisCount: 0
    },
    entityCount: topologyEntities.length,
    entities: topologyEntities,
    unsupportedEntityKinds: ["loop", "coedge", "axis"] as const,
    adjacencyAvailable: false,
    signatureAlgorithm: "partbench-derived-topology-snapshot-v1" as const,
    signature: `${bodyId}:topology-signature`,
    diagnostics: [
      {
        code: "GEOMETRY_TOPOLOGY_SNAPSHOT_EXTRACTED" as const,
        severity: "info" as const,
        message: "Test topology snapshot extracted."
      }
    ]
  };

  return {
    checkpointId,
    bodyId,
    sourceKind: "extrude",
    brepFormat: "occt-brep",
    brepWriter: "BRepTools.Write_3",
    brepBytes,
    brepByteLength: brepBytes.byteLength,
    topologySnapshot,
    signaturePayload: {
      checkpointId,
      signatureAlgorithm: "partbench-derived-topology-snapshot-v1",
      signature: topologySnapshot.signature,
      entityCount: topologySnapshot.entityCount,
      entities: topologySnapshot.entities.map((entity) => ({
        localId: entity.localId,
        kind: entity.kind,
        signature: entity.signature
      }))
    }
  };
}
