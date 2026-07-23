import {
  CadEngine,
  createV13ReleaseSampleBatch,
  encodeWcadCanonicalCbor,
  exportCadProjectWcad,
  importCadProjectWcad,
  readCadProjectWcad,
  type CadFeatureSummary,
  type SketchSnapshot,
  type WcadTopologyCheckpointPayloadInput
} from "@web-cad/cad-core";
import type { GeometryKernelExactTopologyCheckpointPayload } from "@web-cad/geometry-worker";
import { describe, expect, it, vi } from "vitest";
import type { DerivedGeometryRuntime } from "./derivedGeometryRuntime";
import {
  createProjectTopologyAnchorCreationPlanForGeneratedReference,
  createProjectTopologyAnchorRepairPlanForGeneratedReference,
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

  it("hands the resolved composite wire recipe to checkpoint generation", async () => {
    const engine = createWireCheckpointEngine();
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
        id: "body_wire_1",
        checkpointId: "checkpoint_wire_1",
        bodyId: "body_wire_1",
        source: expect.objectContaining({
          kind: "extrude",
          profile: expect.objectContaining({
            kind: "wire",
            closed: true,
            frame: {
              origin: [0, 0, 0],
              uAxis: [1, 0, 0],
              vAxis: [0, 1, 0]
            },
            segments: [
              expect.objectContaining({
                kind: "line",
                sourceEntityId: "wire_diameter",
                start: [0, -1],
                end: [0, 1]
              }),
              expect.objectContaining({
                kind: "arc",
                sourceEntityId: "wire_arc",
                startAngleDegrees: 90,
                sweepAngleDegrees: 180
              })
            ]
          })
        })
      })
    );
  });

  it("hands a resolved composite revolve recipe to checkpoint generation", async () => {
    const engine = createWireRevolveCheckpointEngine();
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
        id: "body_wire_revolve",
        checkpointId: "checkpoint_wire_revolve",
        bodyId: "body_wire_revolve",
        source: {
          kind: "revolve",
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
                sourceEntityId: "revolve_lower"
              }),
              expect.objectContaining({
                kind: "arc",
                sourceEntityId: "revolve_arc"
              }),
              expect.objectContaining({
                sourceEntityId: "revolve_upper"
              })
            ]
          }),
          axis: { start: [0, -3], end: [0, 3] },
          angleDegrees: 270
        }
      })
    );
  });

  it("hands the recursive composite add recipe to checkpoint generation", async () => {
    const engine = createWireAddCheckpointEngine();
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
        id: "body_wire_add",
        checkpointId: "checkpoint_wire_add",
        bodyId: "body_wire_add",
        source: {
          kind: "booleanExtrudes",
          operation: "add",
          target: expect.objectContaining({
            profile: expect.objectContaining({ kind: "rectangle" })
          }),
          tool: expect.objectContaining({
            profile: expect.objectContaining({
              kind: "wire",
              sourceIdentity: expect.any(String),
              segments: [
                expect.objectContaining({
                  kind: "line",
                  sourceEntityId: "wire_add_diameter"
                }),
                expect.objectContaining({
                  kind: "arc",
                  sourceEntityId: "wire_add_arc"
                })
              ]
            })
          })
        }
      })
    );
  });

  it("hands the recursive composite wire cut recipe to checkpoint rebuild", async () => {
    const engine = createWireAddCheckpointEngine("cut");
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
        id: "body_wire_add",
        checkpointId: "checkpoint_wire_add",
        bodyId: "body_wire_add",
        source: {
          kind: "booleanExtrudes",
          operation: "cut",
          target: expect.objectContaining({
            profile: expect.objectContaining({ kind: "rectangle" })
          }),
          tool: expect.objectContaining({
            profile: expect.objectContaining({
              kind: "wire",
              sourceIdentity: expect.any(String)
            })
          })
        }
      })
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

  it("preserves imported-body checkpoint payloads from the WCAD package cache", async () => {
    const { engine, checkpointPayload } = createImportedBodyCheckpointEngine();
    const runtime = createCheckpointRuntime();
    const input = {
      engine,
      features: readProjectStructure(engine).features,
      sketches: readSketches(engine),
      runtime
    };

    await expect(
      exportProjectWcadWithTopologyCheckpoints(input)
    ).rejects.toSatisfy((error: unknown) => {
      expect(isProjectWcadTopologyCheckpointPayloadError(error)).toBe(true);
      if (!isProjectWcadTopologyCheckpointPayloadError(error)) {
        return false;
      }
      expect(error.issues).toEqual([
        expect.objectContaining({
          code: "WCAD_UNSUPPORTED_CHECKPOINT_ENTRY",
          message: expect.stringContaining(
            "does not have a supported exact source"
          )
        })
      ]);
      return true;
    });

    const exported = await exportProjectWcadWithTopologyCheckpoints({
      ...input,
      importedCheckpointPayloads: [checkpointPayload]
    });
    const read = await readCadProjectWcad(exported.bytes);

    expect(runtime.exactTopologyCheckpointPayload).not.toHaveBeenCalled();
    expect(exported.manifest.packageVersion).toBe("partbench.wcad.v2");
    expect(exported.checkpointPayloads).toHaveLength(1);
    expect(read.ok).toBe(true);
    if (!read.ok) {
      throw new Error(read.issues[0]?.message);
    }
    expect(read.checkpointPayloads).toHaveLength(1);
    expect(read.project.document.features).toEqual([
      expect.objectContaining({
        kind: "importedBody",
        bodyId: "body_imported_1",
        checkpointId: "checkpoint_imported_1"
      })
    ]);
    expect(JSON.stringify(read.project)).not.toMatch(
      /imported checkpoint brep bytes|occtShape|meshId|rendererId|fileHandle|opfsPath|localPath/i
    );
  });

  it("preserves topology-anchor face sketch attachments through WCAD save and open", async () => {
    const engine = createRectangleCheckpointEngine();

    engine.apply({
      op: "sketch.createOnFace",
      id: "sketch_anchor_face_1",
      name: "Anchor face sketch",
      topologyAnchorId: "anchor_rect_1_end_face",
      topologyAnchorProof: {
        kind: "axisAlignedPlanarFace",
        entityKind: "face",
        evidenceSource: "checkpointSnapshot",
        exposesCheckpointLocalIds: false,
        planarAxis: "z",
        planarCoordinate: 3,
        bounds: { min: [0, 0, 3], max: [2, 1, 3] }
      }
    });

    const exported = await exportProjectWcadWithTopologyCheckpoints({
      engine,
      features: readProjectStructure(engine).features,
      sketches: readSketches(engine),
      runtime: createCheckpointRuntime()
    });
    const read = await readCadProjectWcad(exported.bytes);

    expect(exported.manifest.packageVersion).toBe("partbench.wcad.v2");
    expect(read.ok).toBe(true);
    if (!read.ok) {
      throw new Error(read.issues[0]?.message);
    }
    expect(read.project.document.sketches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "sketch_anchor_face_1",
          attachment: {
            kind: "topologyAnchorFace",
            bodyId: "body_rect_1",
            topologyAnchorId: "anchor_rect_1_end_face",
            checkpointId: "checkpoint_rect_1",
            planarAxis: "z",
            planarCoordinate: 3
          }
        })
      ])
    );

    const opened = await importCadProjectWcad(exported.bytes);
    expect(
      opened.getDocument().sketches.get("sketch_anchor_face_1")?.attachment
    ).toEqual({
      kind: "topologyAnchorFace",
      bodyId: "body_rect_1",
      topologyAnchorId: "anchor_rect_1_end_face",
      checkpointId: "checkpoint_rect_1",
      planarAxis: "z",
      planarCoordinate: 3
    });
    expect(JSON.stringify({ exported, read })).not.toMatch(
      /rendererId|renderId|meshId|occtId|occtShape|gpuId|selectionBufferId|triangleIndex|faceIndex|edgeIndex|vertexIndex|fileHandle|opfsPath|localPath|checkpoint-local/i
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

    if (!planned.ok) {
      throw new Error(planned.message);
    }
    expect(planned.ok).toBe(true);
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

  it("plans selected topology anchors for supported boolean result tool side faces", async () => {
    const engine = createRectangleExtrudeEngine();
    engine.applyBatch([
      {
        op: "sketch.create",
        id: "sketch_cut_tool_1",
        name: "Cut tool sketch",
        plane: "XY"
      },
      {
        op: "sketch.addRectangle",
        sketchId: "sketch_cut_tool_1",
        id: "rect_cut_tool_1",
        center: [0, 0],
        width: 0.5,
        height: 0.5
      },
      {
        op: "feature.extrude",
        id: "feat_cut_1",
        bodyId: "body_cut_1",
        sketchId: "sketch_cut_tool_1",
        entityId: "rect_cut_tool_1",
        depth: 1,
        operationMode: "cut",
        targetBodyId: "body_plain_1"
      }
    ]);
    const runtime = createCheckpointRuntime({
      booleanToolSideFaces: true
    });
    const target = {
      bodyId: "body_cut_1",
      stableId: "generated:face:body_cut_1:side:uMin",
      kind: "face" as const
    };

    const planned =
      await createProjectTopologyAnchorCreationPlanForGeneratedReference({
        engine,
        features: readProjectStructure(engine).features,
        sketches: readSketches(engine),
        runtime,
        target
      });

    if (!planned.ok) {
      throw new Error(planned.message);
    }
    expect(planned.ok).toBe(true);
    expect(runtime.exactTopologyCheckpointPayload).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "body_cut_1",
        bodyId: "body_cut_1",
        source: expect.objectContaining({
          kind: "booleanExtrudes"
        })
      })
    );
    expect(planned.plan).toMatchObject({
      status: "ready",
      createsCheckpoint: true,
      createsAnchor: true,
      mutatesSource: false,
      candidate: expect.objectContaining({
        stableId: target.stableId,
        kind: "face",
        status: "bound",
        confidence: "exact"
      })
    });
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

  it("plans selected saved reference repairs through cad-core CADOps", async () => {
    const engine = createRectangleExtrudeEngine();
    const runtime = createCheckpointRuntime();
    const structure = readProjectStructure(engine);
    const target = {
      bodyId: "body_plain_1",
      stableId: "generated:face:body_plain_1:endCap",
      kind: "face" as const
    };
    const creation =
      await createProjectTopologyAnchorCreationPlanForGeneratedReference({
        engine,
        features: structure.features,
        sketches: readSketches(engine),
        runtime,
        target
      });

    expect(creation.ok).toBe(true);
    if (!creation.ok) {
      throw new Error(creation.message);
    }
    expect(engine.executeBatch(creation.plan.proposedBatch)).toMatchObject({
      ok: true
    });

    const anchorId =
      engine.getDocument().topologyIdentity?.anchors[0]?.anchorId;
    if (!anchorId) {
      throw new Error("Expected created topology anchor.");
    }
    const beforeRepairJson = JSON.stringify(engine.getDocument());
    const repair =
      await createProjectTopologyAnchorRepairPlanForGeneratedReference({
        engine,
        features: readProjectStructure(engine).features,
        sketches: readSketches(engine),
        runtime,
        target: {
          ...target,
          topologyAnchorId: anchorId
        }
      });

    if (!repair.ok) {
      throw new Error(repair.message);
    }
    expect(repair.ok).toBe(true);
    expect(repair.plan).toMatchObject({
      query: "topology.anchorRepairPlan",
      status: "ready",
      createsCheckpoint: true,
      createsRepair: true,
      opCount: 2,
      ops: [
        expect.objectContaining({
          op: "topology.checkpoint.create",
          bodyId: target.bodyId
        }),
        expect.objectContaining({
          op: "topology.anchor.repair",
          anchorId
        })
      ]
    });
    expect(JSON.stringify(engine.getDocument())).toBe(beforeRepairJson);
    expect(
      engine.executeBatch({ ...repair.plan.proposedBatch, mode: "dryRun" })
    ).toMatchObject({ ok: true });
    expect(JSON.stringify(engine.getDocument())).toBe(beforeRepairJson);
    expect(engine.executeBatch(repair.plan.proposedBatch)).toMatchObject({
      ok: true
    });
    expect(engine.getDocument().topologyIdentity).toMatchObject({
      checkpoints: [
        expect.objectContaining({
          checkpointId: creation.plan.checkpointId
        }),
        expect.objectContaining({
          checkpointId: repair.plan.replacementCheckpointId
        })
      ],
      anchors: [
        expect.objectContaining({
          anchorId,
          checkpointId: repair.plan.replacementCheckpointId
        })
      ],
      repairs: [
        expect.objectContaining({
          anchorId,
          replacementCheckpointId: repair.plan.replacementCheckpointId
        })
      ]
    });
    expect(JSON.stringify(repair)).not.toMatch(
      /rendererId|renderId|meshId|occtId|occtShape|gpuId|selectionBufferId|triangleIndex|faceIndex|edgeIndex|vertexIndex|fileHandle|opfsPath|localPath|checkpoint-local-face/i
    );
  });

  it("returns structured diagnostics and does not mutate ambiguous stable reference repairs", async () => {
    const engine = createRectangleExtrudeEngine();
    const runtime = createCheckpointRuntime();
    const structure = readProjectStructure(engine);
    const target = {
      bodyId: "body_plain_1",
      stableId: "generated:face:body_plain_1:endCap",
      kind: "face" as const
    };
    const creation =
      await createProjectTopologyAnchorCreationPlanForGeneratedReference({
        engine,
        features: structure.features,
        sketches: readSketches(engine),
        runtime,
        target
      });

    expect(creation.ok).toBe(true);
    if (!creation.ok) {
      throw new Error(creation.message);
    }
    expect(engine.executeBatch(creation.plan.proposedBatch)).toMatchObject({
      ok: true
    });

    const anchorId =
      engine.getDocument().topologyIdentity?.anchors[0]?.anchorId;
    if (!anchorId) {
      throw new Error("Expected created topology anchor.");
    }
    const beforeRepairJson = JSON.stringify(engine.getDocument());
    const repair =
      await createProjectTopologyAnchorRepairPlanForGeneratedReference({
        engine,
        features: readProjectStructure(engine).features,
        sketches: readSketches(engine),
        runtime: createCheckpointRuntime({ duplicateEndCapFace: true }),
        target: {
          ...target,
          topologyAnchorId: anchorId
        }
      });

    expect(repair).toMatchObject({
      ok: false,
      status: "ambiguous",
      diagnostics: expect.arrayContaining([
        expect.objectContaining({
          code: "TOPOLOGY_MATCH_AMBIGUOUS",
          severity: "warning"
        })
      ])
    });
    if (repair.ok) {
      throw new Error("Expected ambiguous repair plan.");
    }
    expect(JSON.stringify(engine.getDocument())).toBe(beforeRepairJson);
  });

  it("forwards selected repair candidate ids to cad-core repair planning", async () => {
    const engine = createRectangleExtrudeEngine();
    const runtime = createCheckpointRuntime();
    const structure = readProjectStructure(engine);
    const target = {
      bodyId: "body_plain_1",
      stableId: "generated:face:body_plain_1:endCap",
      kind: "face" as const
    };
    const creation =
      await createProjectTopologyAnchorCreationPlanForGeneratedReference({
        engine,
        features: structure.features,
        sketches: readSketches(engine),
        runtime,
        target
      });

    expect(creation.ok).toBe(true);
    if (!creation.ok) {
      throw new Error(creation.message);
    }
    expect(engine.executeBatch(creation.plan.proposedBatch)).toMatchObject({
      ok: true
    });

    const anchorId =
      engine.getDocument().topologyIdentity?.anchors[0]?.anchorId;
    if (!anchorId) {
      throw new Error("Expected created topology anchor.");
    }

    const selectedRepairCandidateId = "topology_repair_candidate_manual_choice";
    const beforeRepairJson = JSON.stringify(engine.getDocument());
    const executeQuery = vi.spyOn(engine, "executeQuery");

    await createProjectTopologyAnchorRepairPlanForGeneratedReference({
      engine,
      features: readProjectStructure(engine).features,
      sketches: readSketches(engine),
      runtime,
      target: {
        ...target,
        topologyAnchorId: anchorId,
        selectedRepairCandidateId
      }
    });

    expect(
      executeQuery.mock.calls
        .map(([request]) => request.query)
        .filter((query) => query.query === "topology.anchorRepairPlan")
    ).toEqual([
      expect.objectContaining({
        query: "topology.anchorRepairPlan",
        anchorId,
        createReplacementCheckpoint: true,
        selectedRepairCandidateId
      })
    ]);
    expect(JSON.stringify(engine.getDocument())).toBe(beforeRepairJson);
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

function createWireCheckpointEngine(): CadEngine {
  const engine = new CadEngine();

  engine.applyBatch([
    {
      op: "sketch.create",
      id: "sketch_wire_1",
      name: "Wire sketch",
      plane: "XY"
    },
    {
      op: "sketch.addLine",
      sketchId: "sketch_wire_1",
      id: "wire_diameter",
      start: [0, -1],
      end: [0, 1]
    },
    {
      op: "sketch.addArc",
      sketchId: "sketch_wire_1",
      id: "wire_arc",
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
      id: "feat_wire_1",
      bodyId: "body_wire_1",
      profile: {
        kind: "wire",
        sketchId: "sketch_wire_1",
        segments: [
          { entityId: "wire_diameter", orientation: "forward" },
          { entityId: "wire_arc", orientation: "forward" }
        ]
      },
      depth: 3,
      operationMode: "newBody"
    },
    {
      op: "topology.checkpoint.create",
      checkpointId: "checkpoint_wire_1",
      bodyId: "body_wire_1",
      sourceFeatureId: "feat_wire_1",
      sourceIdentity: {
        algorithm: "partbench-source-v1",
        sha256:
          "3333333333333333333333333333333333333333333333333333333333333333"
      },
      status: "active"
    }
  ]);

  return engine;
}

function createWireRevolveCheckpointEngine(): CadEngine {
  const engine = new CadEngine();

  engine.applyBatch([
    {
      op: "sketch.create",
      id: "sketch_wire_revolve",
      name: "Wire revolve sketch",
      plane: "XY"
    },
    {
      op: "sketch.addLine",
      sketchId: "sketch_wire_revolve",
      id: "revolve_axis",
      start: [0, -3],
      end: [0, 3],
      construction: true
    },
    {
      op: "sketch.addLine",
      sketchId: "sketch_wire_revolve",
      id: "revolve_lower",
      start: [0, 0],
      end: [2, -1]
    },
    {
      op: "sketch.addArc",
      sketchId: "sketch_wire_revolve",
      id: "revolve_arc",
      definition: {
        kind: "centerAngles",
        center: [2, 0],
        radius: 1,
        startAngleDegrees: 270,
        sweepAngleDegrees: 180
      }
    },
    {
      op: "sketch.addLine",
      sketchId: "sketch_wire_revolve",
      id: "revolve_upper",
      start: [2, 1],
      end: [0, 0]
    },
    {
      op: "feature.revolve",
      id: "feature_wire_revolve",
      bodyId: "body_wire_revolve",
      profile: {
        kind: "wire",
        sketchId: "sketch_wire_revolve",
        segments: [
          { entityId: "revolve_lower", orientation: "forward" },
          { entityId: "revolve_arc", orientation: "forward" },
          { entityId: "revolve_upper", orientation: "forward" }
        ]
      },
      axis: {
        type: "sketchLine",
        sketchId: "sketch_wire_revolve",
        entityId: "revolve_axis"
      },
      angleDegrees: 270,
      operationMode: "newBody"
    },
    {
      op: "topology.checkpoint.create",
      checkpointId: "checkpoint_wire_revolve",
      bodyId: "body_wire_revolve",
      sourceFeatureId: "feature_wire_revolve",
      sourceIdentity: {
        algorithm: "partbench-source-v1",
        sha256:
          "4444444444444444444444444444444444444444444444444444444444444444"
      },
      status: "active"
    }
  ]);

  return engine;
}

function createWireAddCheckpointEngine(
  operationMode: "add" | "cut" = "add"
): CadEngine {
  const engine = new CadEngine();

  engine.applyBatch([
    {
      op: "sketch.create",
      id: "sketch_add_target",
      name: "Add target",
      plane: "XY"
    },
    {
      op: "sketch.addRectangle",
      sketchId: "sketch_add_target",
      id: "rect_add_target",
      center: [0, 0],
      width: 4,
      height: 4
    },
    {
      op: "feature.extrude",
      id: "feat_add_target",
      bodyId: "body_add_target",
      sketchId: "sketch_add_target",
      entityId: "rect_add_target",
      depth: 3,
      operationMode: "newBody"
    },
    {
      op: "sketch.create",
      id: "sketch_wire_add",
      name: "Wire add tool",
      plane: "XY"
    },
    {
      op: "sketch.addLine",
      sketchId: "sketch_wire_add",
      id: "wire_add_diameter",
      start: [0, -1],
      end: [0, 1]
    },
    {
      op: "sketch.addArc",
      sketchId: "sketch_wire_add",
      id: "wire_add_arc",
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
      id: "feat_wire_add",
      bodyId: "body_wire_add",
      profile: {
        kind: "wire",
        sketchId: "sketch_wire_add",
        segments: [
          { entityId: "wire_add_diameter", orientation: "forward" },
          { entityId: "wire_add_arc", orientation: "forward" }
        ]
      },
      depth: 3,
      operationMode,
      targetBodyId: "body_add_target"
    },
    {
      op: "topology.checkpoint.create",
      checkpointId: "checkpoint_wire_add",
      bodyId: "body_wire_add",
      sourceFeatureId: "feat_wire_add",
      sourceIdentity: {
        algorithm: "partbench-source-v1",
        sha256:
          "4444444444444444444444444444444444444444444444444444444444444444"
      },
      status: "active"
    }
  ]);

  return engine;
}

function createImportedBodyCheckpointEngine(): {
  readonly engine: CadEngine;
  readonly checkpointPayload: WcadTopologyCheckpointPayloadInput;
} {
  const engine = new CadEngine();
  const checkpointId = "checkpoint_imported_1";
  const bodyId = "body_imported_1";
  const featureId = "feat_imported_1";
  const checkpointPayloadFixture = createCheckpointPayloadFixture(
    checkpointId,
    bodyId,
    1,
    "importedBody"
  );
  const response = engine.executeBatch({
    version: "cadops.v1",
    mode: "commit",
    ops: [
      {
        op: "project.importStep",
        sourceFileName: "imported-block.step",
        sourceFormat: "step",
        payloadRef: {
          kind: "transient",
          payloadId: "step_payload_1",
          byteLength: 256,
          sha256:
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        },
        resolvedBodies: [
          {
            featureId,
            bodyId,
            checkpointId,
            name: "Imported block",
            sourceIdentity: {
              algorithm: "partbench-source-v1",
              sha256:
                "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
            },
            checkpointStatus: "active",
            healingApplied: true
          }
        ]
      }
    ]
  });

  if (!response.ok) {
    throw new Error(response.error.message);
  }

  return {
    engine,
    checkpointPayload: {
      checkpointId,
      bodyId,
      sourceFeatureId: featureId,
      units: "mm",
      kernel: {
        boundary: "geometry-kernel",
        snapshotAlgorithm: "partbench-derived-topology-snapshot-v1"
      },
      tolerance: {
        linearTolerance: 0.001,
        angularToleranceDegrees: 0.01
      },
      brepBytes: checkpointPayloadFixture.brepBytes,
      topologyBytes: encodeWcadCanonicalCbor(
        checkpointPayloadFixture.topologySnapshot
      ),
      signatureBytes: encodeWcadCanonicalCbor(
        checkpointPayloadFixture.signaturePayload
      )
    }
  };
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
  options: {
    readonly booleanToolSideFaces?: boolean;
    readonly duplicateEndCapFace?: boolean;
  } = {}
): Pick<DerivedGeometryRuntime, "exactTopologyCheckpointPayload"> {
  return {
    exactTopologyCheckpointPayload: vi.fn(async (input) => ({
      checkpointPayload: createCheckpointPayloadFixture(
        input.checkpointId,
        input.bodyId,
        input.source.kind === "extrude" ? input.source.depth : 1,
        input.source.kind,
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
  sourceKind: GeometryKernelExactTopologyCheckpointPayload["sourceKind"] = "extrude",
  options: {
    readonly booleanToolSideFaces?: boolean;
    readonly duplicateEndCapFace?: boolean;
  } = {}
): GeometryKernelExactTopologyCheckpointPayload {
  type TopologyEntity =
    GeometryKernelExactTopologyCheckpointPayload["topologySnapshot"]["entities"][number];
  const brepBytes = new TextEncoder().encode(
    `CASCADE Topology checkpoint fixture ${checkpointId}`
  );
  const bodyEntity: TopologyEntity = {
    localId: "checkpoint-local-body",
    kind: "body",
    source: "kernel-derived",
    signature: `${bodyId}:body`,
    bounds: {
      min: [0, 0, 0],
      max: [1, 1, depth]
    }
  };
  const endCapEntity: TopologyEntity = {
    localId: "checkpoint-local-face",
    kind: "face",
    source: "kernel-derived",
    signature: `${bodyId}:face`,
    bounds: {
      min: [0, 0, depth],
      max: [1, 1, depth]
    }
  };
  const entities: TopologyEntity[] = [bodyEntity, endCapEntity];
  const topologyEntities: TopologyEntity[] = options.booleanToolSideFaces
    ? [
        bodyEntity,
        {
          localId: "checkpoint-local-tool-u-min",
          kind: "face",
          source: "kernel-derived",
          signature: `${bodyId}:face:tool-u-min`,
          bounds: {
            min: [-0.25, -0.25, 0],
            max: [-0.25, 0.25, depth]
          }
        },
        {
          localId: "checkpoint-local-tool-u-max",
          kind: "face",
          source: "kernel-derived",
          signature: `${bodyId}:face:tool-u-max`,
          bounds: {
            min: [0.25, -0.25, 0],
            max: [0.25, 0.25, depth]
          }
        },
        {
          localId: "checkpoint-local-cap",
          kind: "face",
          source: "kernel-derived",
          signature: `${bodyId}:face:cap`,
          bounds: {
            min: [-0.25, -0.25, depth],
            max: [0.25, 0.25, depth]
          }
        }
      ]
    : options.duplicateEndCapFace
      ? [
          ...entities,
          {
            ...endCapEntity,
            localId: "checkpoint-local-face-duplicate"
          }
        ]
      : entities;
  const topologySnapshot = {
    sourceKind,
    source: "kernel-derived" as const,
    status: "partial" as const,
    entityCounts: {
      bodyCount: 1,
      solidCount: 0,
      faceCount: topologyEntities.filter((entity) => entity.kind === "face")
        .length,
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
    sourceKind,
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
