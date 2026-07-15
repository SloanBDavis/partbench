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
  createProjectExtentsDerivedExactMetadataSnapshots,
  createProjectQueryDerivedExactMetadataSnapshots,
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
  type DerivedChamferGeometrySource,
  type DerivedEdgeFinishGeometrySource,
  type DerivedExtrudeGeometrySource,
  type DerivedFilletGeometrySource,
  type DerivedGeometrySource,
  type DerivedHoleGeometrySource,
  type DerivedRevolveGeometrySource,
  type DerivedSweepGeometrySource,
  type DerivedLoftGeometrySource
} from "./derivedGeometry";
import { createDerivedGeometrySourcesFromDocument } from "./derivedGeometrySources";
import type {
  DerivedExactMetadataInput,
  DerivedExactMetadataResult,
  DerivedGeometryBooleanExtrudePrimitiveInputSource,
  DerivedGeometryRuntime
} from "./derivedGeometryRuntime";
import { createGeneratedFaceReferenceKey } from "./sketchDisplayFrames";

describe("derivedExactMetadata", () => {
  it("builds exact metadata inputs for loft sources", () => {
    const source: DerivedLoftGeometrySource = {
      id: "body_loft",
      kind: "loft",
      sections: [
        {
          sketchPlane: "XY",
          profile: { kind: "rectangle", center: [0, 0], width: 4, height: 3 }
        },
        {
          sketchPlane: "XY",
          profile: { kind: "circle", center: [0, 0], radius: 1 },
          placementFrame: {
            origin: [0, 0, 5],
            uAxis: [1, 0, 0],
            vAxis: [0, 1, 0]
          }
        }
      ]
    };

    expect(createExactMetadataRuntimeInput(source)).toEqual({
      id: "body_loft",
      source: { kind: "loft", sections: source.sections }
    });
  });

  it("builds exact metadata inputs for sweep sources", () => {
    const source: DerivedSweepGeometrySource = {
      id: "body_sweep",
      kind: "sweep",
      profile: {
        sketchPlane: "XY",
        profile: { kind: "circle", center: [0, 0], radius: 1 }
      },
      pathSegments: [{ start: [0, 0, 0], end: [0, 0, 5] }]
    };

    expect(createExactMetadataRuntimeInput(source)).toEqual({
      id: "body_sweep",
      source: {
        kind: "sweep",
        profile: source.profile,
        pathSegments: source.pathSegments
      }
    });
  });

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

    const holeSource = createHoleSource("body_hole_1");
    const editedTarget = createExtrudeSource("body_rect_1");
    const editedTargetSource: DerivedHoleGeometrySource = {
      ...holeSource,
      target: {
        ...editedTarget,
        profile: {
          kind: "rectangle",
          center: [1, 0],
          width: 8,
          height: 4
        }
      }
    };
    const editedCircleSource: DerivedHoleGeometrySource = {
      ...holeSource,
      tool: {
        ...holeSource.tool,
        circle: {
          kind: "circle",
          center: [1, 1],
          radius: 0.75
        }
      }
    };
    const placedHoleSource: DerivedHoleGeometrySource = {
      ...holeSource,
      tool: {
        ...holeSource.tool,
        placementFrame: {
          origin: [0, 0, 3],
          uAxis: [1, 0, 0],
          vAxis: [0, 1, 0]
        }
      }
    };
    const throughAllHoleSource: DerivedHoleGeometrySource = {
      ...holeSource,
      tool: {
        ...holeSource.tool,
        depthMode: "throughAll",
        depth: undefined
      }
    };
    const negativeHoleSource: DerivedHoleGeometrySource = {
      ...holeSource,
      tool: {
        ...holeSource.tool,
        direction: "negative"
      }
    };

    expect(JSON.parse(createDerivedExactMetadataCacheKey(holeSource))).toEqual({
      kind: "exactMetadata",
      source: createDerivedGeometryCacheKey(holeSource)
    });
    expect(createDerivedExactMetadataCacheKey(holeSource)).not.toBe(
      createDerivedExactMetadataCacheKey(editedTargetSource)
    );
    expect(createDerivedExactMetadataCacheKey(holeSource)).not.toBe(
      createDerivedExactMetadataCacheKey(editedCircleSource)
    );
    expect(createDerivedExactMetadataCacheKey(holeSource)).not.toBe(
      createDerivedExactMetadataCacheKey(placedHoleSource)
    );
    expect(createDerivedExactMetadataCacheKey(holeSource)).not.toBe(
      createDerivedExactMetadataCacheKey(throughAllHoleSource)
    );
    expect(createDerivedExactMetadataCacheKey(holeSource)).not.toBe(
      createDerivedExactMetadataCacheKey(negativeHoleSource)
    );

    const chamferSource = createChamferSource("body_chamfer_1");
    const chamferTarget = chamferSource.target;
    if (chamferTarget.kind !== "extrude") {
      throw new Error("Expected chamfer source target to be an extrude");
    }
    const editedChamferTarget: DerivedEdgeFinishGeometrySource = {
      ...chamferSource,
      target: {
        ...chamferTarget,
        depth: 5
      }
    };
    const editedChamferEdge: DerivedEdgeFinishGeometrySource = {
      ...chamferSource,
      edgeStableId: "generated:edge:body_rect_1:end:uMax"
    };
    const editedChamferDistance: DerivedEdgeFinishGeometrySource = {
      ...chamferSource,
      distance: 0.5
    };
    const filletSource = createFilletSource("body_fillet_1");
    const editedFilletRadius: DerivedEdgeFinishGeometrySource = {
      ...filletSource,
      radius: 0.4
    };

    expect(
      JSON.parse(createDerivedExactMetadataCacheKey(chamferSource))
    ).toEqual({
      kind: "exactMetadata",
      source: createDerivedGeometryCacheKey(chamferSource)
    });
    expect(createDerivedExactMetadataCacheKey(chamferSource)).not.toBe(
      createDerivedExactMetadataCacheKey(editedChamferTarget)
    );
    expect(createDerivedExactMetadataCacheKey(chamferSource)).not.toBe(
      createDerivedExactMetadataCacheKey(editedChamferEdge)
    );
    expect(createDerivedExactMetadataCacheKey(chamferSource)).not.toBe(
      createDerivedExactMetadataCacheKey(editedChamferDistance)
    );
    expect(createDerivedExactMetadataCacheKey(filletSource)).not.toBe(
      createDerivedExactMetadataCacheKey(editedFilletRadius)
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
      "body-topology-source:v1:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    );

    expect(snapshot).toEqual({
      bodyId: "body_rect_1",
      sourceIdentitySignature:
        "body-topology-source:v1:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
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

  it("maps exact metadata entries into project query snapshots by source identity", () => {
    const ready = createReadyExactMetadataEntry(
      "body_revolve_1",
      "revolve",
      64
    );
    const unsupported: DerivedExactMetadataEntry = {
      bodyId: "body_hole_1",
      sourceKind: "hole",
      cacheKey: "exact:hole",
      status: "unsupported",
      message: "Exact metadata for this hole is unsupported."
    };
    const pending: DerivedExactMetadataEntry = {
      bodyId: "body_chamfer_1",
      sourceKind: "edgeFinish",
      cacheKey: "exact:chamfer",
      status: "pending"
    };
    const skipped = createReadyExactMetadataEntry(
      "body_missing_cache",
      "edgeFinish",
      12
    );
    const snapshots = createProjectExtentsDerivedExactMetadataSnapshots(
      {
        entries: [ready, unsupported, pending, skipped],
        supportedCount: 3,
        pendingCount: 1,
        readyCount: 2,
        errorCount: 0
      },
      new Map([
        [
          "body_revolve_1",
          "body-topology-source:v1:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
        ],
        [
          "body_hole_1",
          "body-topology-source:v1:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
        ],
        [
          "body_chamfer_1",
          "body-topology-source:v1:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"
        ]
      ])
    );

    expect(snapshots).toEqual([
      expect.objectContaining({
        bodyId: "body_revolve_1",
        sourceIdentitySignature:
          "body-topology-source:v1:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        status: "ready",
        metadata: expect.objectContaining({ volume: 64 })
      }),
      expect.objectContaining({
        bodyId: "body_hole_1",
        sourceIdentitySignature:
          "body-topology-source:v1:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        status: "unsupported",
        error: expect.objectContaining({
          code: "UNSUPPORTED_EXACT_METADATA_SOURCE"
        })
      })
    ]);
    expect(
      createProjectQueryDerivedExactMetadataSnapshots(
        {
          entries: [ready, unsupported, pending, skipped],
          supportedCount: 3,
          pendingCount: 1,
          readyCount: 2,
          errorCount: 0
        },
        new Map([
          [
            "body_revolve_1",
            "body-topology-source:v1:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
          ],
          [
            "body_hole_1",
            "body-topology-source:v1:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
          ],
          [
            "body_chamfer_1",
            "body-topology-source:v1:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"
          ]
        ])
      )
    ).toEqual(snapshots);
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
    const sourceIdentitySignature = readBodyTopologySignature(engine, bodyId);
    const derivedExactMetadata = createBodyTopologyDerivedExactMetadataSnapshot(
      createReadyExactMetadataEntry(bodyId, "extrude", 42),
      sourceIdentitySignature
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

  it("enriches authored revolve topology with derived exact metadata while generated references stay source-semantic", () => {
    const engine = createRevolvedRectangleEngine();
    const bodyId = "body_revolve_1";
    const sourceIdentitySignature = readBodyTopologySignature(engine, bodyId);
    const derivedExactMetadata = createBodyTopologyDerivedExactMetadataSnapshot(
      createReadyExactMetadataEntry(bodyId, "revolve", 64),
      sourceIdentitySignature
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
      ok: true,
      query: "body.generatedReferences",
      body: {
        stableId: "generated:body:body_revolve_1",
        geometricSignature: {
          sourceKind: "revolve"
        }
      },
      faces: [],
      edges: [],
      vertices: [],
      axes: [
        {
          stableId: "generated:axis:body_revolve_1:revolveAxis",
          role: "revolveAxis"
        }
      ]
    });
  });

  it("enriches authored hole topology while generated references stay source-semantic", () => {
    const engine = createHoleEngine();
    const bodyId = "body_hole_1";
    const sourceIdentitySignature = readBodyTopologySignature(engine, bodyId);
    const derivedExactMetadata = createBodyTopologyDerivedExactMetadataSnapshot(
      createReadyExactMetadataEntry(bodyId, "hole", 68),
      sourceIdentitySignature
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
        sourceKind: "authoredHole",
        topologyAvailable: false,
        exactGeometryAvailable: true,
        exactMeasurementsAvailable: true,
        measurementConfidence: "kernel-derived",
        exactMetadata: {
          status: "healthy",
          volume: 68
        }
      }
    });
    expect(generatedReferences).toMatchObject({
      ok: true,
      query: "body.generatedReferences",
      body: {
        stableId: "generated:body:body_hole_1",
        geometricSignature: {
          sourceKind: "hole",
          targetBodyId: "body_rect_1"
        }
      },
      faces: [
        {
          stableId: "generated:face:body_hole_1:holeWall",
          role: "holeWall"
        }
      ],
      edges: [
        {
          stableId: "generated:edge:body_hole_1:startRim",
          role: "startRim"
        }
      ],
      axes: [
        {
          stableId: "generated:axis:body_hole_1:holeAxis",
          role: "holeAxis"
        }
      ]
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
      tool: createCircleExtrudeSource("body_circle_tool")
    };
    const circleTargetAddSource: DerivedBooleanExtrudeGeometrySource = {
      id: "body_add_circle_target",
      kind: "extrudeBoolean",
      operation: "add",
      target: createCircleExtrudeSource("body_circle_target"),
      tool: createCircleExtrudeSource("body_circle_tool")
    };
    const cutSource: DerivedBooleanExtrudeGeometrySource = {
      id: "body_cut_1",
      kind: "extrudeBoolean",
      operation: "cut",
      target: createCircleExtrudeSource("body_circle_target"),
      tool: createCircleExtrudeSource("body_circle_tool")
    };
    const chainedCutSource: DerivedBooleanExtrudeGeometrySource = {
      id: "body_cut_2",
      kind: "extrudeBoolean",
      operation: "cut",
      target: {
        id: "body_cut_1",
        kind: "extrudeBoolean",
        operation: "cut",
        target: createExtrudeSource("body_target"),
        tool: createExtrudeSource("body_tool_1")
      },
      tool: createExtrudeSource("body_tool_2")
    };

    service.reconcile([
      addSource,
      circleTargetAddSource,
      cutSource,
      chainedCutSource
    ]);

    expect(runtime.exactInputs.map((input) => input.source)).toMatchObject([
      {
        kind: "booleanExtrudes",
        operation: "add",
        target: { profile: { kind: "rectangle" } },
        tool: { profile: { kind: "circle" } }
      },
      {
        kind: "booleanExtrudes",
        operation: "add",
        target: { profile: { kind: "circle" } },
        tool: { profile: { kind: "circle" } }
      },
      {
        kind: "booleanExtrudes",
        operation: "cut",
        target: { profile: { kind: "circle" } },
        tool: { profile: { kind: "circle" } }
      },
      {
        kind: "booleanExtrudes",
        operation: "cut",
        target: {
          kind: "booleanExtrudes",
          operation: "cut",
          target: { profile: { kind: "rectangle" } },
          tool: { profile: { kind: "rectangle" } }
        },
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

  it("requests and caches exact metadata for authored hole sources", async () => {
    const runtime = createRuntime(async (input) =>
      createMetadataResult(input.id, input.source.kind)
    );
    const service = new DerivedExactMetadataService({
      runtime,
      onChange: () => {}
    });
    const source: DerivedHoleGeometrySource = {
      ...createHoleSource("body_hole_1"),
      tool: {
        ...createHoleSource("body_hole_1").tool,
        depthMode: "throughAll",
        depth: undefined,
        direction: "negative",
        placementFrame: {
          origin: [0, 0, 3],
          uAxis: [1, 0, 0],
          vAxis: [0, 1, 0]
        }
      }
    };

    service.reconcile([source]);
    await flushPromises();

    expect(runtime.exactInputs).toEqual([
      {
        id: "body_hole_1",
        source: {
          kind: "hole",
          target: {
            sketchPlane: "XY",
            profile: {
              kind: "rectangle",
              center: [0, 0],
              width: 6,
              height: 4
            },
            depth: 3,
            side: "positive"
          },
          tool: {
            sketchPlane: "XY",
            circle: {
              kind: "circle",
              center: [0, 0],
              radius: 0.5
            },
            depthMode: "throughAll",
            depth: undefined,
            direction: "negative",
            placementFrame: {
              origin: [0, 0, 3],
              uAxis: [1, 0, 0],
              vAxis: [0, 1, 0]
            }
          }
        }
      }
    ]);
    expect(service.getSnapshot().entries[0]).toMatchObject({
      bodyId: "body_hole_1",
      sourceKind: "hole",
      status: "ready",
      metadata: { sourceKind: "hole", volume: 10 }
    });
  });

  it("requests and caches exact metadata for authored edge-finish sources", async () => {
    const runtime = createRuntime(async (input) =>
      createMetadataResult(input.id, input.source.kind)
    );
    const service = new DerivedExactMetadataService({
      runtime,
      onChange: () => {}
    });
    const chamferSource = createChamferSource("body_chamfer_1");
    const filletSource = createFilletSource("body_fillet_1");

    service.reconcile([chamferSource, filletSource]);
    await flushPromises();

    expect(runtime.exactInputs).toEqual([
      {
        id: "body_chamfer_1",
        source: {
          kind: "edgeFinish",
          operation: "chamfer",
          target: {
            sketchPlane: "XY",
            profile: {
              kind: "rectangle",
              center: [0, 0],
              width: 6,
              height: 4
            },
            depth: 3,
            side: "positive"
          },
          edgeStableId: "generated:edge:body_rect_1:start:uMin",
          distance: 0.25
        }
      },
      {
        id: "body_fillet_1",
        source: {
          kind: "edgeFinish",
          operation: "fillet",
          target: {
            sketchPlane: "XY",
            profile: {
              kind: "rectangle",
              center: [0, 0],
              width: 6,
              height: 4
            },
            depth: 3,
            side: "positive"
          },
          edgeStableId: "generated:edge:body_rect_1:longitudinal:uMax:vMax",
          radius: 0.2
        }
      }
    ]);
    expect(service.getSnapshot().entries).toMatchObject([
      {
        bodyId: "body_chamfer_1",
        sourceKind: "edgeFinish",
        status: "ready",
        metadata: { sourceKind: "edgeFinish", volume: 10 }
      },
      {
        bodyId: "body_fillet_1",
        sourceKind: "edgeFinish",
        status: "ready",
        metadata: { sourceKind: "edgeFinish", volume: 10 }
      }
    ]);
  });

  it("requests exact metadata for rectangle cut-wall edge finishes with boolean target source", async () => {
    const runtime = createRuntime(async (input) =>
      createMetadataResult(input.id, input.source.kind)
    );
    const service = new DerivedExactMetadataService({
      runtime,
      onChange: () => {}
    });
    const targetSource = createChamferSource("body_cut_chamfer_1").target;

    service.reconcile([
      {
        id: "body_cut_chamfer_1",
        kind: "edgeFinish",
        operation: "chamfer",
        target: {
          id: "body_cut_1",
          kind: "extrudeBoolean",
          operation: "cut",
          target: targetSource,
          tool: {
            id: "body_cut_1",
            kind: "extrude",
            sketchPlane: "XY",
            profile: {
              kind: "rectangle",
              center: [1, 0],
              width: 2,
              height: 1
            },
            depth: 3,
            side: "positive"
          }
        },
        edgeStableId: "generated:edge:body_cut_1:longitudinal:uMin:vMin",
        distance: 0.1
      }
    ]);
    await flushPromises();

    expect(runtime.exactInputs).toEqual([
      {
        id: "body_cut_chamfer_1",
        source: {
          kind: "edgeFinish",
          operation: "chamfer",
          target: {
            kind: "booleanExtrudes",
            operation: "cut",
            target: {
              sketchPlane: "XY",
              profile: {
                kind: "rectangle",
                center: [0, 0],
                width: 6,
                height: 4
              },
              depth: 3,
              side: "positive"
            },
            tool: {
              sketchPlane: "XY",
              profile: {
                kind: "rectangle",
                center: [1, 0],
                width: 2,
                height: 1
              },
              depth: 3,
              side: "positive"
            }
          },
          edgeStableId: "generated:edge:body_cut_1:longitudinal:uMin:vMin",
          distance: 0.1
        }
      }
    ]);
    expect(service.getSnapshot().entries[0]).toMatchObject({
      bodyId: "body_cut_chamfer_1",
      sourceKind: "edgeFinish",
      status: "ready",
      metadata: { sourceKind: "edgeFinish", volume: 10 }
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
      {
        ...createHoleSource("body_stale_hole_attachment"),
        placementError: "Attachment unresolved for hole."
      },
      {
        ...createChamferSource("body_stale_edge_finish_attachment"),
        placementError: "Attachment unresolved for edge finish."
      },
      {
        ...createChamferSource("body_unsupported_circle_edge"),
        edgeStableId: "generated:edge:body_rect_1:start:circular"
      },
      {
        ...createChamferSource("body_unsupported_circle_target"),
        target: createCircleExtrudeSource("body_rect_1")
      }
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
        bodyId: "body_stale_hole_attachment",
        status: "unsupported",
        message: "Attachment unresolved for hole."
      },
      {
        bodyId: "body_stale_edge_finish_attachment",
        status: "unsupported",
        message: "Attachment unresolved for edge finish."
      },
      {
        bodyId: "body_unsupported_circle_edge",
        status: "unsupported",
        message:
          "Exact metadata for edge finishing currently supports generated rectangle edge references only."
      },
      {
        bodyId: "body_unsupported_circle_target",
        status: "unsupported",
        message:
          "Exact metadata for edge finishing currently supports rectangle source edges and rectangle cut-wall result edges only."
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
        ...getPrimitiveBooleanTarget(initialSource),
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
    const runtime = createRuntime((input) => {
      const target = getExactRuntimePrimitiveTarget(input);

      return input.source.kind === "booleanExtrudes" &&
        target?.profile.kind === "rectangle" &&
        target.profile.width === 4
        ? first.promise
        : second.promise;
    });
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

  it("ignores stale hole exact metadata after target and circle tool edits", async () => {
    const initialSource = createHoleSource("body_hole_1");
    const editedTarget = createExtrudeSource("body_rect_1");
    const editedSource: DerivedHoleGeometrySource = {
      ...initialSource,
      target: {
        ...editedTarget,
        profile: {
          kind: "rectangle",
          center: [0, 0],
          width: 8,
          height: 4
        }
      },
      tool: {
        ...initialSource.tool,
        circle: {
          kind: "circle",
          center: [1, 0],
          radius: 0.75
        }
      }
    };
    const first = createDeferred<DerivedExactMetadataResult>();
    const second = createDeferred<DerivedExactMetadataResult>();
    const snapshots: DerivedExactMetadataSnapshot[] = [];
    const runtime = createRuntime((input) => {
      const target = getExactRuntimePrimitiveTarget(input);

      return input.source.kind === "hole" &&
        target?.profile.kind === "rectangle" &&
        target.profile.width === 6
        ? first.promise
        : second.promise;
    });
    const service = new DerivedExactMetadataService({
      runtime,
      onChange: (snapshot) => snapshots.push(snapshot)
    });

    service.reconcile([initialSource]);
    service.reconcile([editedSource]);

    first.resolve(createMetadataResult("body_hole_1", "hole"));
    await flushPromises();

    expect(snapshots.at(-1)?.entries[0]).toMatchObject({
      bodyId: "body_hole_1",
      status: "pending",
      cacheKey: createDerivedExactMetadataCacheKey(editedSource)
    });

    second.resolve(createMetadataResult("body_hole_1", "hole", 44));
    await flushPromises();

    expect(snapshots.at(-1)?.entries[0]).toMatchObject({
      bodyId: "body_hole_1",
      status: "ready",
      metadata: { sourceKind: "hole", volume: 44 }
    });
  });

  it("ignores stale edge-finish exact metadata after target, edge, and scalar edits", async () => {
    const initialSource = createChamferSource("body_chamfer_1");
    const initialTarget = initialSource.target;
    if (initialTarget.kind !== "extrude") {
      throw new Error("Expected chamfer source target to be an extrude");
    }
    const editedSource: DerivedEdgeFinishGeometrySource = {
      ...initialSource,
      target: {
        ...initialTarget,
        profile: {
          kind: "rectangle",
          center: [0, 0],
          width: 8,
          height: 4
        }
      },
      edgeStableId: "generated:edge:body_rect_1:end:uMax",
      distance: 0.4
    };
    const first = createDeferred<DerivedExactMetadataResult>();
    const second = createDeferred<DerivedExactMetadataResult>();
    const snapshots: DerivedExactMetadataSnapshot[] = [];
    const runtime = createRuntime((input) =>
      input.source.kind === "edgeFinish" &&
      input.source.operation === "chamfer" &&
      input.source.distance === 0.25
        ? first.promise
        : second.promise
    );
    const service = new DerivedExactMetadataService({
      runtime,
      onChange: (snapshot) => snapshots.push(snapshot)
    });

    service.reconcile([initialSource]);
    service.reconcile([editedSource]);

    first.resolve(createMetadataResult("body_chamfer_1", "edgeFinish"));
    await flushPromises();

    expect(snapshots.at(-1)?.entries[0]).toMatchObject({
      bodyId: "body_chamfer_1",
      status: "pending",
      cacheKey: createDerivedExactMetadataCacheKey(editedSource)
    });

    second.resolve(createMetadataResult("body_chamfer_1", "edgeFinish", 21));
    await flushPromises();

    expect(snapshots.at(-1)?.entries[0]).toMatchObject({
      bodyId: "body_chamfer_1",
      status: "ready",
      cacheKey: createDerivedExactMetadataCacheKey(editedSource),
      metadata: { sourceKind: "edgeFinish", volume: 21 }
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

  it("builds exact metadata runtime input for holes with boolean result targets", () => {
    const source: DerivedHoleGeometrySource = {
      id: "body_hole_1",
      kind: "hole",
      target: {
        id: "body_cut_1",
        kind: "extrudeBoolean",
        operation: "cut",
        target: createExtrudeSource("body_rect_1"),
        tool: createExtrudeSource("body_cut_1")
      },
      tool: {
        sketchPlane: "XY",
        circle: { kind: "circle", center: [0.5, 0.25], radius: 0.4 },
        depthMode: "throughAll",
        direction: "positive"
      }
    };

    expect(createExactMetadataRuntimeInput(source)).toMatchObject({
      id: "body_hole_1",
      source: {
        kind: "hole",
        target: {
          kind: "booleanExtrudes",
          operation: "cut",
          target: { profile: { kind: "rectangle" } },
          tool: { profile: { kind: "rectangle" } }
        },
        tool: {
          circle: { kind: "circle", radius: 0.4 },
          depthMode: "throughAll",
          direction: "positive"
        }
      }
    });
  });

  it("builds exact metadata runtime input for holes with circle-origin boolean result targets", () => {
    const source: DerivedHoleGeometrySource = {
      id: "body_hole_1",
      kind: "hole",
      target: {
        id: "body_cut_1",
        kind: "extrudeBoolean",
        operation: "cut",
        target: createCircleExtrudeSource("body_circle_1"),
        tool: createExtrudeSource("body_cut_1")
      },
      tool: {
        sketchPlane: "XY",
        circle: { kind: "circle", center: [0.5, 0.25], radius: 0.4 },
        depthMode: "throughAll",
        direction: "positive"
      }
    };

    expect(createExactMetadataRuntimeInput(source)).toMatchObject({
      id: "body_hole_1",
      source: {
        kind: "hole",
        target: {
          kind: "booleanExtrudes",
          operation: "cut",
          target: { profile: { kind: "circle" } },
          tool: { profile: { kind: "rectangle" } }
        },
        tool: {
          circle: { kind: "circle", radius: 0.4 },
          depthMode: "throughAll",
          direction: "positive"
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

  it("removes hole exact metadata entries across feature delete and undo", async () => {
    const engine = createHoleEngine();
    const service = new DerivedExactMetadataService({
      runtime: createRuntime(async (input) =>
        createMetadataResult(input.id, input.source.kind)
      ),
      onChange: () => {}
    });

    service.reconcile(getDerivedSources(engine));
    await flushPromises();
    expect(service.getSnapshot().entries.map((entry) => entry.bodyId)).toEqual([
      "body_hole_1"
    ]);

    engine.apply({ op: "feature.delete", id: "feat_hole_1" });
    service.reconcile(getDerivedSources(engine));
    expect(service.getSnapshot().entries.map((entry) => entry.bodyId)).toEqual([
      "body_rect_1"
    ]);

    engine.undo();
    service.reconcile(getDerivedSources(engine));
    await flushPromises();
    expect(service.getSnapshot().entries.map((entry) => entry.bodyId)).toEqual([
      "body_hole_1"
    ]);
  });

  it("removes edge-finish exact metadata entries across feature delete and undo", async () => {
    const engine = createChamferEngine();
    const service = new DerivedExactMetadataService({
      runtime: createRuntime(async (input) =>
        createMetadataResult(input.id, input.source.kind)
      ),
      onChange: () => {}
    });

    service.reconcile(getDerivedSources(engine));
    await flushPromises();
    expect(service.getSnapshot().entries.map((entry) => entry.bodyId)).toEqual([
      "body_chamfer_1"
    ]);

    engine.apply({ op: "feature.delete", id: "feat_chamfer_1" });
    service.reconcile(getDerivedSources(engine));
    await flushPromises();
    expect(service.getSnapshot().entries.map((entry) => entry.bodyId)).toEqual([
      "body_rect_1"
    ]);

    engine.undo();
    service.reconcile(getDerivedSources(engine));
    await flushPromises();
    expect(service.getSnapshot().entries.map((entry) => entry.bodyId)).toEqual([
      "body_chamfer_1"
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

function createHoleSource(id: string): DerivedHoleGeometrySource {
  return {
    id,
    kind: "hole",
    target: {
      id: "body_rect_1",
      kind: "extrude",
      sketchPlane: "XY",
      profile: {
        kind: "rectangle",
        center: [0, 0],
        width: 6,
        height: 4
      },
      depth: 3,
      side: "positive"
    },
    tool: {
      sketchPlane: "XY",
      circle: {
        kind: "circle",
        center: [0, 0],
        radius: 0.5
      },
      depthMode: "blind",
      depth: 2,
      direction: "positive"
    }
  };
}

function createChamferSource(id: string): DerivedChamferGeometrySource {
  return {
    id,
    kind: "edgeFinish",
    operation: "chamfer",
    target: {
      id: "body_rect_1",
      kind: "extrude",
      sketchPlane: "XY",
      profile: {
        kind: "rectangle",
        center: [0, 0],
        width: 6,
        height: 4
      },
      depth: 3,
      side: "positive"
    },
    edgeStableId: "generated:edge:body_rect_1:start:uMin",
    distance: 0.25
  };
}

function createFilletSource(id: string): DerivedFilletGeometrySource {
  const chamfer = createChamferSource(id);

  return {
    id,
    kind: "edgeFinish",
    operation: "fillet",
    target: chamfer.target,
    edgeStableId: "generated:edge:body_rect_1:longitudinal:uMax:vMax",
    radius: 0.2
  };
}

function createMetadataResult(
  objectId: string,
  sourceKind:
    | "extrude"
    | "booleanExtrudes"
    | "revolve"
    | "hole"
    | "edgeFinish"
    | "sweep"
    | "loft",
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
  sourceKind:
    | "extrude"
    | "booleanExtrudes"
    | "revolve"
    | "hole"
    | "edgeFinish"
    | "sweep"
    | "loft",
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

function readBodyTopologySignature(engine: CadEngine, bodyId: string): string {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "body.topology", bodyId }
  });

  if (!response.ok || response.query !== "body.topology") {
    throw new Error(`Expected topology response for ${bodyId}.`);
  }

  return response.topology.sourceIdentity.signature;
}

function getPrimitiveBooleanTarget(
  source: DerivedBooleanExtrudeGeometrySource
): DerivedExtrudeGeometrySource {
  if (source.target.kind === "extrudeBoolean") {
    throw new Error("Expected primitive boolean target source.");
  }

  return source.target;
}

function getExactRuntimePrimitiveTarget(
  input: DerivedExactMetadataInput
): DerivedGeometryBooleanExtrudePrimitiveInputSource | undefined {
  if (!("target" in input.source)) {
    return undefined;
  }

  return "profile" in input.source.target ? input.source.target : undefined;
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
    edgeFinish() {
      throw new Error("Mesh requests are not used by exact metadata tests.");
    },
    linearPattern() {
      throw new Error("Mesh requests are not used by exact metadata tests.");
    },
    circularPattern() {
      throw new Error("Mesh requests are not used by exact metadata tests.");
    },
    mirror() {
      throw new Error("Mesh requests are not used by exact metadata tests.");
    },
    shell() {
      throw new Error("Mesh requests are not used by exact metadata tests.");
    },
    sweep() {
      throw new Error("Mesh requests are not used by exact metadata tests.");
    },
    loft() {
      throw new Error("Mesh requests are not used by exact metadata tests.");
    },
    exactBodyMetadata(input) {
      exactInputs.push(input);
      return handler(input);
    },
    exactTopologyCheckpointPayload() {
      throw new Error(
        "Checkpoint payload requests are not used by exact metadata tests."
      );
    },
    importStep() {
      throw new Error("STEP import is not used by exact metadata tests.");
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

function createHoleEngine(): CadEngine {
  const engine = new CadEngine();

  engine.applyBatch([
    { op: "sketch.create", id: "sketch_1", name: "Target", plane: "XY" },
    {
      op: "sketch.addRectangle",
      sketchId: "sketch_1",
      id: "rect_1",
      center: [0, 0],
      width: 6,
      height: 4
    },
    {
      op: "feature.extrude",
      id: "feat_rect_1",
      bodyId: "body_rect_1",
      sketchId: "sketch_1",
      entityId: "rect_1",
      depth: 3
    },
    { op: "sketch.create", id: "sketch_hole", name: "Hole", plane: "XY" },
    {
      op: "sketch.addCircle",
      sketchId: "sketch_hole",
      id: "circle_hole",
      center: [0, 0],
      radius: 0.5
    },
    {
      op: "feature.hole",
      id: "feat_hole_1",
      bodyId: "body_hole_1",
      targetBodyId: "body_rect_1",
      sketchId: "sketch_hole",
      circleEntityId: "circle_hole",
      depthMode: "blind",
      depth: 2,
      direction: "positive"
    }
  ]);

  return engine;
}

function createChamferEngine(): CadEngine {
  const engine = createExtrudedRectangleEngine();

  engine.apply({
    op: "feature.chamfer",
    id: "feat_chamfer_1",
    bodyId: "body_chamfer_1",
    targetBodyId: "body_rect_1",
    edgeStableId: "generated:edge:body_rect_1:start:uMin",
    distance: 0.25
  });

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
