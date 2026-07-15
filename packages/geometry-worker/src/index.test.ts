import { describe, expect, it } from "vitest";
import {
  GeometryKernelWorker,
  createBoxTessellationWorkerRequest,
  createConeTessellationWorkerRequest,
  createCylinderTessellationWorkerRequest,
  createEdgeFinishWorkerRequest,
  createExactBodyMetadataWorkerRequest,
  createExactTopologyCheckpointPayloadWorkerRequest,
  createExactTopologySnapshotWorkerRequest,
  createExactStepExportWorkerRequest,
  createStepImportWorkerRequest,
  createExtrudeBooleanWorkerRequest,
  createExtrudeTessellationWorkerRequest,
  createHoleWorkerRequest,
  createMirrorWorkerRequest,
  createRevolveProfileWorkerRequest,
  createShellWorkerRequest,
  createSweepWorkerRequest,
  createLoftWorkerRequest,
  createSphereTessellationWorkerRequest,
  createTorusTessellationWorkerRequest,
  getGeometryWorkerExactExportCapabilities,
  getGeometryWorkerStepImportCapabilities,
  createWorkerErrorDiagnostics,
  createWorkerSuccessDiagnostics,
  createGeometryKernelWorker
} from "./index";
import { GeometryKernelBrowserWorker } from "./browser";

describe("geometry-worker", () => {
  it("reports STEP exact export writer capability through the worker boundary", () => {
    expect(getGeometryWorkerExactExportCapabilities()).toEqual([
      expect.objectContaining({
        format: "step",
        label: "STEP",
        status: "available",
        writerAvailable: true,
        boundary: "geometry-worker",
        kernelBoundary: "geometry-kernel",
        writerBoundary: "occt-wasm",
        missingBindings: []
      })
    ]);
  });

  it("reports unavailable STEP exact export writer capability through the worker boundary", () => {
    expect(
      getGeometryWorkerExactExportCapabilities([
        {
          format: "step",
          label: "STEP",
          status: "unavailable",
          writerAvailable: false,
          boundary: "geometry-kernel",
          writerBoundary: "occt-wasm",
          packageName: "opencascade.js",
          packageVersion: "2.0.0-test",
          checkedBindings: ["STEPControl_Writer_1"],
          availableBindings: [],
          missingBindings: ["STEPControl_Writer_1"],
          reason: "Missing test binding."
        }
      ])
    ).toEqual([
      expect.objectContaining({
        format: "step",
        status: "unavailable",
        writerAvailable: false,
        boundary: "geometry-worker",
        kernelBoundary: "geometry-kernel",
        missingBindings: ["STEPControl_Writer_1"]
      })
    ]);
  });

  it("reports STEP import reader and healing capability through the worker boundary", () => {
    expect(getGeometryWorkerStepImportCapabilities()).toEqual([
      expect.objectContaining({
        format: "step",
        label: "STEP",
        status: "available",
        readerAvailable: true,
        healingAvailable: true,
        checkpointWriterAvailable: true,
        boundary: "geometry-worker",
        kernelBoundary: "geometry-kernel",
        readerBoundary: "occt-wasm",
        missingBindings: []
      })
    ]);
  });

  it("reports unavailable STEP import capability through the worker boundary", () => {
    expect(
      getGeometryWorkerStepImportCapabilities([
        {
          format: "step",
          label: "STEP",
          status: "unavailable",
          readerAvailable: false,
          healingAvailable: false,
          checkpointWriterAvailable: false,
          boundary: "geometry-kernel",
          readerBoundary: "occt-wasm",
          packageName: "opencascade.js",
          packageVersion: "2.0.0-test",
          checkedBindings: ["STEPControl_Reader_1"],
          availableBindings: [],
          missingBindings: ["STEPControl_Reader_1"],
          reason: "Missing test binding."
        }
      ])
    ).toEqual([
      expect.objectContaining({
        format: "step",
        status: "unavailable",
        readerAvailable: false,
        healingAvailable: false,
        checkpointWriterAvailable: false,
        boundary: "geometry-worker",
        kernelBoundary: "geometry-kernel",
        missingBindings: ["STEPControl_Reader_1"]
      })
    ]);
  });

  it("creates a typed exact STEP export worker request", () => {
    const request = createExactStepExportWorkerRequest({
      id: "worker_req_step_export",
      units: "mm",
      bodies: [
        {
          bodyId: "body_step_rect",
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [0, 0],
            width: 2,
            height: 1
          },
          depth: 3,
          side: "positive"
        }
      ]
    });

    expect(request).toMatchObject({
      id: "worker_req_step_export",
      version: "geometry-worker.v1",
      kind: "geometry-worker.exactExport",
      payload: {
        id: "worker_req_step_export:payload",
        version: "geometry-kernel.v1",
        op: "geometry.exportStep",
        units: "mm",
        bodies: [
          expect.objectContaining({
            bodyId: "body_step_rect",
            depth: 3
          })
        ]
      }
    });
  });

  it("creates a typed STEP import worker request", () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const request = createStepImportWorkerRequest({
      id: "worker_req_step_import",
      sourceFileName: "fixture-import.step",
      bytes,
      maxBodyCount: 1,
      bodyId: "body_imported_worker",
      checkpointId: "checkpoint_imported_worker"
    });

    expect(request).toMatchObject({
      id: "worker_req_step_import",
      version: "geometry-worker.v1",
      kind: "geometry-worker.importStep",
      payload: {
        id: "worker_req_step_import:payload",
        version: "geometry-kernel.v1",
        op: "geometry.importStep",
        sourceFileName: "fixture-import.step",
        maxBodyCount: 1,
        bodyId: "body_imported_worker",
        checkpointId: "checkpoint_imported_worker"
      }
    });
    expect(request.payload.bytes).toBe(bytes);
  });

  it("creates a typed mirror feature worker request", () => {
    const seed = {
      kind: "extrude" as const,
      sketchPlane: "XY" as const,
      profile: {
        kind: "rectangle" as const,
        center: [1, 1] as const,
        width: 4,
        height: 2
      },
      depth: 3
    };

    const request = createMirrorWorkerRequest({
      id: "worker_req_mirror",
      seed,
      plane: {
        point: [0, 0, 0],
        normal: [1, 0, 0]
      },
      includeOriginal: true,
      linearDeflection: 0.25
    });

    expect(request).toMatchObject({
      id: "worker_req_mirror",
      version: "geometry-worker.v1",
      kind: "geometry-worker.mirrorFeature",
      payload: {
        id: "worker_req_mirror:payload",
        version: "geometry-kernel.v1",
        op: "geometry.mirror",
        seed,
        plane: {
          point: [0, 0, 0],
          normal: [1, 0, 0]
        },
        includeOriginal: true,
        tessellation: { linearDeflection: 0.25 }
      }
    });
  });

  it("creates a typed shell feature worker request", () => {
    const target = {
      kind: "extrude" as const,
      sketchPlane: "XY" as const,
      profile: {
        kind: "rectangle" as const,
        center: [0, 0] as const,
        width: 4,
        height: 2
      },
      depth: 3
    };

    const request = createShellWorkerRequest({
      id: "worker_req_shell",
      target,
      wallThickness: 0.2,
      openFaceStableIds: ["generated:face:body_seed:endCap"],
      linearDeflection: 0.25
    });

    expect(request).toMatchObject({
      id: "worker_req_shell",
      version: "geometry-worker.v1",
      kind: "geometry-worker.shellFeature",
      payload: {
        id: "worker_req_shell:payload",
        version: "geometry-kernel.v1",
        op: "geometry.shell",
        target,
        wallThickness: 0.2,
        openFaceStableIds: ["generated:face:body_seed:endCap"],
        tessellation: { linearDeflection: 0.25 }
      }
    });
  });

  it("creates a typed sweep feature worker request", () => {
    const profile = {
      sketchPlane: "XY" as const,
      profile: {
        kind: "circle" as const,
        center: [0, 0] as const,
        radius: 1
      }
    };
    const pathSegments = [{ start: [0, 0, 0], end: [0, 0, 5] }] as const;

    expect(
      createSweepWorkerRequest({
        id: "worker_req_sweep",
        profile,
        pathSegments,
        linearDeflection: 0.25
      })
    ).toEqual({
      id: "worker_req_sweep",
      version: "geometry-worker.v1",
      kind: "geometry-worker.sweepFeature",
      payload: {
        id: "worker_req_sweep:payload",
        version: "geometry-kernel.v1",
        op: "geometry.sweep",
        profile,
        pathSegments,
        tessellation: { linearDeflection: 0.25 }
      }
    });
  });

  it("creates a typed loft feature worker request", () => {
    const sections = [
      {
        sketchPlane: "XY" as const,
        profile: {
          kind: "rectangle" as const,
          center: [0, 0] as const,
          width: 4,
          height: 3
        }
      },
      {
        sketchPlane: "XY" as const,
        profile: {
          kind: "circle" as const,
          center: [0, 0] as const,
          radius: 1
        },
        placementFrame: {
          origin: [0, 0, 5] as const,
          uAxis: [1, 0, 0] as const,
          vAxis: [0, 1, 0] as const
        }
      }
    ];

    expect(
      createLoftWorkerRequest({ id: "worker_req_loft", sections })
    ).toEqual({
      id: "worker_req_loft",
      version: "geometry-worker.v1",
      kind: "geometry-worker.loftFeature",
      payload: {
        id: "worker_req_loft:payload",
        version: "geometry-kernel.v1",
        op: "geometry.loft",
        sections
      }
    });
  });

  it("lets browser shell feature requests pass request validation", async () => {
    const target = {
      kind: "extrude" as const,
      sketchPlane: "XY" as const,
      profile: {
        kind: "rectangle" as const,
        center: [0, 0] as const,
        width: 1,
        height: 1
      },
      depth: 1,
      side: "positive" as const
    };
    const worker = new GeometryKernelBrowserWorker();
    const response = await worker.execute(
      createShellWorkerRequest({
        id: "worker_req_browser_shell",
        target,
        wallThickness: 0.2,
        openFaceStableIds: []
      })
    );

    expect(response.response).toMatchObject({
      id: "worker_req_browser_shell:payload",
      op: "geometry.shell"
    });
    expect(JSON.stringify(response)).not.toContain(
      "Unsupported geometry kernel operation: geometry.shell."
    );

    if (response.response.ok) {
      expect(response.response.mesh.vertexCount).toBeGreaterThan(0);
    } else {
      expect(response.diagnostics?.stage).not.toBe("requestValidation");
      expect(response.diagnostics?.error?.code).not.toBe(
        "UNSUPPORTED_PRIMITIVE"
      );
    }
  });

  it("creates a typed box tessellation worker request", () => {
    const request = createBoxTessellationWorkerRequest({
      id: "worker_req_1",
      width: 10,
      height: 20,
      depth: 30,
      linearDeflection: 0.25
    });

    expect(request).toEqual({
      id: "worker_req_1",
      version: "geometry-worker.v1",
      kind: "geometry-worker.tessellatePrimitive",
      payload: {
        id: "worker_req_1:payload",
        version: "geometry-kernel.v1",
        op: "geometry.tessellateBox",
        dimensions: {
          width: 10,
          height: 20,
          depth: 30
        },
        tessellation: {
          linearDeflection: 0.25
        }
      }
    });
  });

  it("creates a typed sphere tessellation worker request", () => {
    const request = createSphereTessellationWorkerRequest({
      id: "worker_req_sphere",
      radius: 10,
      angularDeflection: 0.5
    });

    expect(request).toEqual({
      id: "worker_req_sphere",
      version: "geometry-worker.v1",
      kind: "geometry-worker.tessellatePrimitive",
      payload: {
        id: "worker_req_sphere:payload",
        version: "geometry-kernel.v1",
        op: "geometry.tessellateSphere",
        dimensions: {
          radius: 10
        },
        tessellation: {
          angularDeflection: 0.5
        }
      }
    });
  });

  it("creates a typed cylinder tessellation worker request", () => {
    const request = createCylinderTessellationWorkerRequest({
      id: "worker_req_cylinder",
      radius: 10,
      height: 30,
      angularDeflection: 0.5
    });

    expect(request).toEqual({
      id: "worker_req_cylinder",
      version: "geometry-worker.v1",
      kind: "geometry-worker.tessellatePrimitive",
      payload: {
        id: "worker_req_cylinder:payload",
        version: "geometry-kernel.v1",
        op: "geometry.tessellateCylinder",
        dimensions: {
          radius: 10,
          height: 30
        },
        tessellation: {
          angularDeflection: 0.5
        }
      }
    });
  });

  it("creates typed cone and torus tessellation worker requests", () => {
    expect(
      createConeTessellationWorkerRequest({
        id: "worker_req_cone",
        radius: 2,
        height: 5
      }).payload
    ).toEqual({
      id: "worker_req_cone:payload",
      version: "geometry-kernel.v1",
      op: "geometry.tessellateCone",
      dimensions: { radius: 2, height: 5 }
    });
    expect(
      createTorusTessellationWorkerRequest({
        id: "worker_req_torus",
        majorRadius: 3,
        minorRadius: 0.5
      }).payload
    ).toEqual({
      id: "worker_req_torus:payload",
      version: "geometry-kernel.v1",
      op: "geometry.tessellateTorus",
      dimensions: { majorRadius: 3, minorRadius: 0.5 }
    });
  });

  it("creates a typed sketch extrude tessellation worker request", () => {
    expect(
      createExtrudeTessellationWorkerRequest({
        id: "worker_req_extrude",
        sketchPlane: "XY",
        profile: {
          kind: "rectangle",
          center: [0, 0],
          width: 4,
          height: 3
        },
        depth: 5,
        side: "negative"
      })
    ).toEqual({
      id: "worker_req_extrude",
      version: "geometry-worker.v1",
      kind: "geometry-worker.tessellateFeature",
      payload: {
        id: "worker_req_extrude:payload",
        version: "geometry-kernel.v1",
        op: "geometry.tessellateExtrude",
        sketchPlane: "XY",
        profile: {
          kind: "rectangle",
          center: [0, 0],
          width: 4,
          height: 3
        },
        depth: 5,
        side: "negative"
      }
    });
  });

  it("creates a typed revolve profile worker request", () => {
    expect(
      createRevolveProfileWorkerRequest({
        id: "worker_req_revolve",
        sketchPlane: "XY",
        profile: {
          kind: "circle",
          center: [2, 0],
          radius: 1
        },
        axis: {
          start: [0, -1],
          end: [0, 1]
        },
        angleDegrees: 180,
        angularDeflection: 0.25
      })
    ).toEqual({
      id: "worker_req_revolve",
      version: "geometry-worker.v1",
      kind: "geometry-worker.tessellateFeature",
      payload: {
        id: "worker_req_revolve:payload",
        version: "geometry-kernel.v1",
        op: "geometry.revolveProfile",
        sketchPlane: "XY",
        profile: {
          kind: "circle",
          center: [2, 0],
          radius: 1
        },
        axis: {
          start: [0, -1],
          end: [0, 1]
        },
        angleDegrees: 180,
        tessellation: {
          angularDeflection: 0.25
        }
      }
    });
  });

  it("creates typed extrude boolean worker requests for cut and add", () => {
    expect(
      createExtrudeBooleanWorkerRequest({
        id: "worker_req_boolean",
        operation: "cut",
        target: {
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [0, 0],
            width: 4,
            height: 4
          },
          depth: 4
        },
        tool: {
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [1, 0],
            width: 2,
            height: 2
          },
          depth: 4
        },
        linearDeflection: 0.25
      })
    ).toEqual({
      id: "worker_req_boolean",
      version: "geometry-worker.v1",
      kind: "geometry-worker.booleanFeature",
      payload: {
        id: "worker_req_boolean:payload",
        version: "geometry-kernel.v1",
        op: "geometry.booleanExtrudes",
        operation: "cut",
        target: {
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [0, 0],
            width: 4,
            height: 4
          },
          depth: 4
        },
        tool: {
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [1, 0],
            width: 2,
            height: 2
          },
          depth: 4
        },
        tessellation: {
          linearDeflection: 0.25
        }
      }
    });
    expect(
      createExtrudeBooleanWorkerRequest({
        id: "worker_req_boolean_add",
        operation: "add",
        target: {
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [0, 0],
            width: 4,
            height: 4
          },
          depth: 4
        },
        tool: {
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [1, 0],
            width: 2,
            height: 2
          },
          depth: 4
        }
      })
    ).toMatchObject({
      id: "worker_req_boolean_add",
      kind: "geometry-worker.booleanFeature",
      payload: {
        id: "worker_req_boolean_add:payload",
        op: "geometry.booleanExtrudes",
        operation: "add"
      }
    });
  });

  it("creates a typed hole worker request", () => {
    expect(
      createHoleWorkerRequest({
        id: "worker_req_hole",
        target: {
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [0, 0],
            width: 4,
            height: 4
          },
          depth: 4
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
        },
        angularDeflection: 0.25
      })
    ).toEqual({
      id: "worker_req_hole",
      version: "geometry-worker.v1",
      kind: "geometry-worker.booleanFeature",
      payload: {
        id: "worker_req_hole:payload",
        version: "geometry-kernel.v1",
        op: "geometry.hole",
        target: {
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [0, 0],
            width: 4,
            height: 4
          },
          depth: 4
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
        },
        tessellation: {
          angularDeflection: 0.25
        }
      }
    });
  });

  it("creates a typed edge-finish worker request", () => {
    expect(
      createEdgeFinishWorkerRequest({
        id: "worker_req_edge_finish",
        operation: "chamfer",
        target: {
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [0, 0],
            width: 4,
            height: 4
          },
          depth: 4
        },
        edgeStableId: "generated:edge:body:1:start:uMin",
        distance: 0.25,
        linearDeflection: 0.2
      })
    ).toEqual({
      id: "worker_req_edge_finish",
      version: "geometry-worker.v1",
      kind: "geometry-worker.edgeFinishFeature",
      payload: {
        id: "worker_req_edge_finish:payload",
        version: "geometry-kernel.v1",
        op: "geometry.edgeFinish",
        operation: "chamfer",
        target: {
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [0, 0],
            width: 4,
            height: 4
          },
          depth: 4
        },
        edgeStableId: "generated:edge:body:1:start:uMin",
        distance: 0.25,
        tessellation: {
          linearDeflection: 0.2
        }
      }
    });
  });

  it("creates a typed exact body metadata worker request", () => {
    expect(
      createExactBodyMetadataWorkerRequest({
        id: "worker_req_exact_metadata",
        source: {
          kind: "extrude",
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [0, 0],
            width: 4,
            height: 3
          },
          depth: 5,
          side: "positive"
        }
      })
    ).toEqual({
      id: "worker_req_exact_metadata",
      version: "geometry-worker.v1",
      kind: "geometry-worker.exactMetadata",
      payload: {
        id: "worker_req_exact_metadata:payload",
        version: "geometry-kernel.v1",
        op: "geometry.exactBodyMetadata",
        source: {
          kind: "extrude",
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [0, 0],
            width: 4,
            height: 3
          },
          depth: 5,
          side: "positive"
        }
      }
    });
  });

  it("creates a typed exact topology snapshot worker request", () => {
    expect(
      createExactTopologySnapshotWorkerRequest({
        id: "worker_req_exact_topology_snapshot",
        source: {
          kind: "extrude",
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [0, 0],
            width: 4,
            height: 3
          },
          depth: 5,
          side: "positive"
        }
      })
    ).toEqual({
      id: "worker_req_exact_topology_snapshot",
      version: "geometry-worker.v1",
      kind: "geometry-worker.exactTopologySnapshot",
      payload: {
        id: "worker_req_exact_topology_snapshot:payload",
        version: "geometry-kernel.v1",
        op: "geometry.exactTopologySnapshot",
        source: {
          kind: "extrude",
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [0, 0],
            width: 4,
            height: 3
          },
          depth: 5,
          side: "positive"
        }
      }
    });
  });

  it("creates a typed exact topology checkpoint payload worker request", () => {
    expect(
      createExactTopologyCheckpointPayloadWorkerRequest({
        id: "worker_req_exact_topology_checkpoint_payload",
        checkpointId: "checkpoint_worker_rect",
        bodyId: "body_worker_rect",
        source: {
          kind: "extrude",
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [0, 0],
            width: 4,
            height: 3
          },
          depth: 5,
          side: "positive"
        }
      })
    ).toEqual({
      id: "worker_req_exact_topology_checkpoint_payload",
      version: "geometry-worker.v1",
      kind: "geometry-worker.exactTopologyCheckpointPayload",
      payload: {
        id: "worker_req_exact_topology_checkpoint_payload:payload",
        version: "geometry-kernel.v1",
        op: "geometry.exactTopologyCheckpointPayload",
        checkpointId: "checkpoint_worker_rect",
        bodyId: "body_worker_rect",
        source: {
          kind: "extrude",
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [0, 0],
            width: 4,
            height: 3
          },
          depth: 5,
          side: "positive"
        }
      }
    });
  });

  it("creates a typed exact body metadata worker request for revolve sources", () => {
    expect(
      createExactBodyMetadataWorkerRequest({
        id: "worker_req_revolve_exact_metadata",
        source: {
          kind: "revolve",
          sketchPlane: "XY",
          profile: {
            kind: "circle",
            center: [2, 0],
            radius: 0.5
          },
          axis: { start: [0, -2], end: [0, 2] },
          angleDegrees: 180
        }
      })
    ).toEqual({
      id: "worker_req_revolve_exact_metadata",
      version: "geometry-worker.v1",
      kind: "geometry-worker.exactMetadata",
      payload: {
        id: "worker_req_revolve_exact_metadata:payload",
        version: "geometry-kernel.v1",
        op: "geometry.exactBodyMetadata",
        source: {
          kind: "revolve",
          sketchPlane: "XY",
          profile: {
            kind: "circle",
            center: [2, 0],
            radius: 0.5
          },
          axis: { start: [0, -2], end: [0, 2] },
          angleDegrees: 180
        }
      }
    });
  });

  it("creates a typed exact body metadata worker request for hole sources", () => {
    expect(
      createExactBodyMetadataWorkerRequest({
        id: "worker_req_hole_exact_metadata",
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
            direction: "positive"
          }
        }
      })
    ).toEqual({
      id: "worker_req_hole_exact_metadata",
      version: "geometry-worker.v1",
      kind: "geometry-worker.exactMetadata",
      payload: {
        id: "worker_req_hole_exact_metadata:payload",
        version: "geometry-kernel.v1",
        op: "geometry.exactBodyMetadata",
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
            direction: "positive"
          }
        }
      }
    });
  });

  it("creates a typed exact body metadata worker request for edge-finish sources", () => {
    expect(
      createExactBodyMetadataWorkerRequest({
        id: "worker_req_edge_finish_exact_metadata",
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
          edgeStableId: "generated:edge:body:1:longitudinal:uMax:vMax",
          radius: 0.2
        }
      })
    ).toEqual({
      id: "worker_req_edge_finish_exact_metadata",
      version: "geometry-worker.v1",
      kind: "geometry-worker.exactMetadata",
      payload: {
        id: "worker_req_edge_finish_exact_metadata:payload",
        version: "geometry-kernel.v1",
        op: "geometry.exactBodyMetadata",
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
          edgeStableId: "generated:edge:body:1:longitudinal:uMax:vMax",
          radius: 0.2
        }
      }
    });
  });

  it("tessellates one box asynchronously through the geometry kernel facade", async () => {
    const worker = createGeometryKernelWorker({ delayMs: 1 });
    const responsePromise = worker.execute(
      createBoxTessellationWorkerRequest({
        id: "worker_req_box",
        payloadId: "geometry_req_box",
        width: 10,
        height: 20,
        depth: 30
      })
    );
    let isSettled = false;
    void responsePromise.then(() => {
      isSettled = true;
    });

    expect(isSettled).toBe(false);

    const response = await responsePromise;

    expect(response).toMatchObject({
      id: "worker_req_box",
      version: "geometry-worker.v1",
      kind: "geometry-worker.tessellatePrimitive",
      payloadId: "geometry_req_box",
      response: {
        ok: true,
        id: "geometry_req_box",
        op: "geometry.tessellateBox",
        warnings: []
      }
    });

    if (!response.response.ok) {
      throw new Error(response.response.error.message);
    }

    expect(response.response.mesh.primitive).toBe("box");
    expect(response.response.mesh.faceCount).toBe(6);
    expect(response.response.mesh.vertexCount).toBe(24);
    expect(response.response.mesh.triangleCount).toBe(12);
    expect(response.response.mesh.positions).toBeInstanceOf(Float32Array);
    expect(response.response.mesh.indices).toBeInstanceOf(Uint32Array);
    expect(response.transferables).toEqual([
      response.response.mesh.positions.buffer,
      response.response.mesh.indices.buffer
    ]);
  }, 30000);

  it("tessellates one cylinder asynchronously through the geometry kernel facade", async () => {
    const worker = createGeometryKernelWorker({ delayMs: 1 });
    const response = await worker.execute(
      createCylinderTessellationWorkerRequest({
        id: "worker_req_cylinder",
        payloadId: "geometry_req_cylinder",
        radius: 10,
        height: 30
      })
    );

    expect(response).toMatchObject({
      id: "worker_req_cylinder",
      version: "geometry-worker.v1",
      kind: "geometry-worker.tessellatePrimitive",
      payloadId: "geometry_req_cylinder",
      response: {
        ok: true,
        id: "geometry_req_cylinder",
        op: "geometry.tessellateCylinder",
        warnings: []
      }
    });

    if (!response.response.ok) {
      throw new Error(response.response.error.message);
    }

    expect(response.response.mesh.primitive).toBe("cylinder");
    expect(response.response.mesh.vertexCount).toBeGreaterThan(0);
    expect(response.response.mesh.triangleCount).toBeGreaterThan(0);
    expect(response.transferables).toEqual([
      response.response.mesh.positions.buffer,
      response.response.mesh.indices.buffer
    ]);
  });

  it("tessellates one sphere asynchronously through the geometry kernel facade", async () => {
    const worker = createGeometryKernelWorker({ delayMs: 1 });
    const response = await worker.execute(
      createSphereTessellationWorkerRequest({
        id: "worker_req_sphere",
        payloadId: "geometry_req_sphere",
        radius: 10
      })
    );

    expect(response).toMatchObject({
      id: "worker_req_sphere",
      version: "geometry-worker.v1",
      kind: "geometry-worker.tessellatePrimitive",
      payloadId: "geometry_req_sphere",
      response: {
        ok: true,
        id: "geometry_req_sphere",
        op: "geometry.tessellateSphere",
        warnings: []
      }
    });

    if (!response.response.ok) {
      throw new Error(response.response.error.message);
    }

    expect(response.response.mesh.primitive).toBe("sphere");
    expect(response.response.mesh.vertexCount).toBeGreaterThan(0);
    expect(response.response.mesh.triangleCount).toBeGreaterThan(0);
    expect(response.transferables).toEqual([
      response.response.mesh.positions.buffer,
      response.response.mesh.indices.buffer
    ]);
  });

  it("tessellates cone and torus asynchronously through the geometry kernel facade", async () => {
    const worker = createGeometryKernelWorker({ delayMs: 1 });
    const cone = await worker.execute(
      createConeTessellationWorkerRequest({
        id: "worker_req_cone",
        payloadId: "geometry_req_cone",
        radius: 2,
        height: 5
      })
    );
    const torus = await worker.execute(
      createTorusTessellationWorkerRequest({
        id: "worker_req_torus",
        payloadId: "geometry_req_torus",
        majorRadius: 3,
        minorRadius: 0.5
      })
    );

    expect(cone).toMatchObject({
      payloadId: "geometry_req_cone",
      response: {
        ok: true,
        op: "geometry.tessellateCone"
      }
    });
    expect(torus).toMatchObject({
      payloadId: "geometry_req_torus",
      response: {
        ok: true,
        op: "geometry.tessellateTorus"
      }
    });

    if (!cone.response.ok || !torus.response.ok) {
      throw new Error("Expected cone and torus worker responses to succeed.");
    }

    expect(cone.response.mesh.primitive).toBe("cone");
    expect(torus.response.mesh.primitive).toBe("torus");
    expect(cone.response.mesh.vertexCount).toBeGreaterThan(0);
    expect(torus.response.mesh.vertexCount).toBeGreaterThan(0);
  });

  it("tessellates a sketch extrude asynchronously through the geometry kernel facade", async () => {
    const worker = createGeometryKernelWorker({ delayMs: 1 });
    const response = await worker.execute(
      createExtrudeTessellationWorkerRequest({
        id: "worker_req_extrude",
        payloadId: "geometry_req_extrude",
        sketchPlane: "XY",
        profile: {
          kind: "circle",
          center: [0, 0],
          radius: 2
        },
        depth: 5,
        side: "symmetric"
      })
    );

    expect(response).toMatchObject({
      id: "worker_req_extrude",
      version: "geometry-worker.v1",
      kind: "geometry-worker.tessellateFeature",
      payloadId: "geometry_req_extrude",
      response: {
        ok: true,
        id: "geometry_req_extrude",
        op: "geometry.tessellateExtrude"
      }
    });

    if (!response.response.ok) {
      throw new Error(response.response.error.message);
    }

    expect(response.response.mesh.primitive).toBe("extrude");
    expect(response.response.mesh.vertexCount).toBeGreaterThan(0);
    expect(response.response.mesh.triangleCount).toBeGreaterThan(0);
  });

  it("tessellates a revolve profile asynchronously through the geometry kernel facade", async () => {
    const worker = createGeometryKernelWorker({ delayMs: 1 });
    const response = await worker.execute(
      createRevolveProfileWorkerRequest({
        id: "worker_req_revolve_execute",
        payloadId: "geometry_req_revolve_execute",
        sketchPlane: "XY",
        profile: {
          kind: "rectangle",
          center: [2, 0],
          width: 1,
          height: 2
        },
        axis: {
          start: [0, -2],
          end: [0, 2]
        },
        angleDegrees: 360
      })
    );

    expect(response).toMatchObject({
      id: "worker_req_revolve_execute",
      version: "geometry-worker.v1",
      kind: "geometry-worker.tessellateFeature",
      payloadId: "geometry_req_revolve_execute",
      response: {
        ok: true,
        id: "geometry_req_revolve_execute",
        op: "geometry.revolveProfile"
      }
    });

    if (!response.response.ok) {
      throw new Error(response.response.error.message);
    }

    expect(response.response.mesh.primitive).toBe("revolve");
    expect(response.response.mesh.vertexCount).toBeGreaterThan(0);
    expect(response.response.mesh.triangleCount).toBeGreaterThan(0);
    expect(response.transferables).toEqual([
      response.response.mesh.positions.buffer,
      response.response.mesh.indices.buffer
    ]);
  });

  it("runs a rectangle boolean feasibility request through the geometry kernel facade", async () => {
    const worker = createGeometryKernelWorker({ delayMs: 1 });
    const response = await worker.execute(
      createExtrudeBooleanWorkerRequest({
        id: "worker_req_boolean_add",
        payloadId: "geometry_req_boolean_add",
        operation: "add",
        target: {
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [0, 0],
            width: 4,
            height: 4
          },
          depth: 4
        },
        tool: {
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [2, 0],
            width: 2,
            height: 2
          },
          depth: 4
        }
      })
    );

    expect(response).toMatchObject({
      id: "worker_req_boolean_add",
      version: "geometry-worker.v1",
      kind: "geometry-worker.booleanFeature",
      payloadId: "geometry_req_boolean_add",
      response: {
        ok: true,
        id: "geometry_req_boolean_add",
        op: "geometry.booleanExtrudes"
      }
    });

    if (!response.response.ok) {
      throw new Error(response.response.error.message);
    }

    expect(response.response.mesh.primitive).toBe("boolean");
    expect(response.response.mesh.vertexCount).toBeGreaterThan(0);
    expect(response.response.mesh.triangleCount).toBeGreaterThan(0);
    expect(response.transferables).toEqual([
      response.response.mesh.positions.buffer,
      response.response.mesh.indices.buffer
    ]);
  });

  it("runs a circle-target boolean cut through the geometry kernel facade", async () => {
    const worker = createGeometryKernelWorker({ delayMs: 1 });
    const response = await worker.execute(
      createExtrudeBooleanWorkerRequest({
        id: "worker_req_boolean_circle_cut",
        payloadId: "geometry_req_boolean_circle_cut",
        operation: "cut",
        target: {
          sketchPlane: "XY",
          profile: {
            kind: "circle",
            center: [0, 0],
            radius: 3
          },
          depth: 4
        },
        tool: {
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [0, 0],
            width: 2,
            height: 6
          },
          depth: 4
        }
      })
    );

    expect(response).toMatchObject({
      id: "worker_req_boolean_circle_cut",
      version: "geometry-worker.v1",
      kind: "geometry-worker.booleanFeature",
      payloadId: "geometry_req_boolean_circle_cut",
      response: {
        ok: true,
        id: "geometry_req_boolean_circle_cut",
        op: "geometry.booleanExtrudes"
      }
    });

    if (!response.response.ok) {
      throw new Error(response.response.error.message);
    }

    expect(response.response.mesh.primitive).toBe("boolean");
    expect(response.response.mesh.vertexCount).toBeGreaterThan(0);
    expect(response.response.mesh.triangleCount).toBeGreaterThan(0);
    expect(response.transferables).toEqual([
      response.response.mesh.positions.buffer,
      response.response.mesh.indices.buffer
    ]);
  });

  it("runs a hole feasibility request through the geometry kernel facade", async () => {
    const worker = createGeometryKernelWorker({ delayMs: 1 });
    const response = await worker.execute(
      createHoleWorkerRequest({
        id: "worker_req_hole_execute",
        payloadId: "geometry_req_hole_execute",
        target: {
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [0, 0],
            width: 4,
            height: 4
          },
          depth: 4
        },
        tool: {
          sketchPlane: "XY",
          circle: {
            kind: "circle",
            center: [0, 0],
            radius: 0.5
          },
          depthMode: "blind",
          depth: 2
        }
      })
    );

    expect(response).toMatchObject({
      id: "worker_req_hole_execute",
      version: "geometry-worker.v1",
      kind: "geometry-worker.booleanFeature",
      payloadId: "geometry_req_hole_execute",
      response: {
        ok: true,
        id: "geometry_req_hole_execute",
        op: "geometry.hole"
      }
    });

    if (!response.response.ok) {
      throw new Error(response.response.error.message);
    }

    expect(response.response.mesh.primitive).toBe("hole");
    expect(response.response.mesh.vertexCount).toBeGreaterThan(0);
    expect(response.response.mesh.triangleCount).toBeGreaterThan(0);
    expect(response.transferables).toEqual([
      response.response.mesh.positions.buffer,
      response.response.mesh.indices.buffer
    ]);
  });

  it("runs an edge-finish feasibility request through the geometry kernel facade", async () => {
    const worker = createGeometryKernelWorker({ delayMs: 1 });
    const response = await worker.execute(
      createEdgeFinishWorkerRequest({
        id: "worker_req_edge_finish_execute",
        payloadId: "geometry_req_edge_finish_execute",
        operation: "fillet",
        target: {
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [0, 0],
            width: 4,
            height: 4
          },
          depth: 4
        },
        edgeStableId: "generated:edge:body:1:end:vMax",
        radius: 0.2
      })
    );

    expect(response).toMatchObject({
      id: "worker_req_edge_finish_execute",
      version: "geometry-worker.v1",
      kind: "geometry-worker.edgeFinishFeature",
      payloadId: "geometry_req_edge_finish_execute",
      response: {
        ok: true,
        id: "geometry_req_edge_finish_execute",
        op: "geometry.edgeFinish"
      }
    });

    if (!response.response.ok) {
      throw new Error(response.response.error.message);
    }

    expect(response.response.mesh.primitive).toBe("edgeFinish");
    expect(response.response.mesh.vertexCount).toBeGreaterThan(0);
    expect(response.response.mesh.triangleCount).toBeGreaterThan(0);
    expect(response.transferables).toEqual([
      response.response.mesh.positions.buffer,
      response.response.mesh.indices.buffer
    ]);
  }, 120_000);

  it("returns exact body metadata through the geometry kernel facade", async () => {
    const worker = createGeometryKernelWorker({ delayMs: 1 });
    const response = await worker.execute(
      createExactBodyMetadataWorkerRequest({
        id: "worker_req_exact_metadata_execute",
        payloadId: "geometry_req_exact_metadata_execute",
        source: {
          kind: "extrude",
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [1, 2],
            width: 4,
            height: 3
          },
          depth: 5
        }
      })
    );

    expect(response).toMatchObject({
      id: "worker_req_exact_metadata_execute",
      version: "geometry-worker.v1",
      kind: "geometry-worker.exactMetadata",
      payloadId: "geometry_req_exact_metadata_execute",
      transferables: [],
      response: {
        ok: true,
        id: "geometry_req_exact_metadata_execute",
        op: "geometry.exactBodyMetadata",
        warnings: []
      }
    });

    if (!response.response.ok) {
      throw new Error(response.response.error.message);
    }

    expect(response.response.metadata.volume).toBeCloseTo(60, 6);
    expect(response.response.metadata.surfaceArea).toBeCloseTo(94, 6);
    expect(response.response.metadata.measurementSource).toBe("kernel-derived");
  }, 120_000);

  it("returns exact topology snapshots through the geometry kernel facade", async () => {
    const worker = createGeometryKernelWorker({ delayMs: 1 });
    const response = await worker.execute(
      createExactTopologySnapshotWorkerRequest({
        id: "worker_req_exact_topology_snapshot_execute",
        payloadId: "geometry_req_exact_topology_snapshot_execute",
        source: {
          kind: "extrude",
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [1, 2],
            width: 4,
            height: 3
          },
          depth: 5
        }
      })
    );

    if (!response.response.ok) {
      throw new Error(response.response.error.message);
    }

    expect(response).toMatchObject({
      id: "worker_req_exact_topology_snapshot_execute",
      version: "geometry-worker.v1",
      kind: "geometry-worker.exactTopologySnapshot",
      payloadId: "geometry_req_exact_topology_snapshot_execute",
      transferables: [],
      response: {
        ok: true,
        id: "geometry_req_exact_topology_snapshot_execute",
        op: "geometry.exactTopologySnapshot",
        warnings: []
      }
    });

    expect(response.response.snapshot).toMatchObject({
      sourceKind: "extrude",
      source: "kernel-derived",
      status: "partial",
      adjacencyAvailable: true,
      signatureAlgorithm: "partbench-derived-topology-snapshot-v1"
    });
    expect(response.response.snapshot.entityCounts.faceCount).toBe(6);
    expect(response.response.snapshot.entityCounts.loopCount).toBe(6);
    expect(response.response.snapshot.entityCounts.coedgeCount).toBe(24);
    expect(response.response.snapshot.entityCount).toBe(
      response.response.snapshot.entities.length
    );
    expect(response.response.snapshot.entities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "face",
          surfaceClass: "plane",
          normal: expect.arrayContaining([
            expect.any(Number),
            expect.any(Number),
            expect.any(Number)
          ])
        }),
        expect.objectContaining({
          kind: "edge",
          curveClass: "line",
          midpoint: expect.arrayContaining([
            expect.any(Number),
            expect.any(Number),
            expect.any(Number)
          ]),
          axis: expect.arrayContaining([
            expect.any(Number),
            expect.any(Number),
            expect.any(Number)
          ]),
          length: expect.any(Number)
        }),
        expect.objectContaining({
          kind: "vertex",
          point: expect.arrayContaining([
            expect.any(Number),
            expect.any(Number),
            expect.any(Number)
          ])
        }),
        expect.objectContaining({
          kind: "loop",
          orientation: expect.stringMatching(/forward|reversed/),
          relationships: expect.objectContaining({
            parentFaceLocalId: expect.stringMatching(/^snapshot-local:face:/),
            underlyingWireLocalId: expect.stringMatching(
              /^snapshot-local:wire:/
            ),
            childCoedgeLocalIds: expect.arrayContaining([
              expect.stringMatching(/^snapshot-local:coedge:/)
            ])
          })
        }),
        expect.objectContaining({
          kind: "coedge",
          orientation: expect.stringMatching(/forward|reversed/),
          relationships: expect.objectContaining({
            parentFaceLocalId: expect.stringMatching(/^snapshot-local:face:/),
            parentLoopLocalId: expect.stringMatching(/^snapshot-local:loop:/),
            underlyingEdgeLocalId: expect.stringMatching(
              /^snapshot-local:edge:/
            ),
            startVertexLocalId: expect.stringMatching(
              /^snapshot-local:vertex:/
            ),
            endVertexLocalId: expect.stringMatching(/^snapshot-local:vertex:/)
          })
        })
      ])
    );
    const bodyEntity = response.response.snapshot.entities.find(
      (entity) => entity.kind === "body"
    );
    expect(bodyEntity?.bounds?.min[0]).toBeCloseTo(-1, 6);
    expect(bodyEntity?.bounds?.min[1]).toBeCloseTo(0.5, 6);
    expect(bodyEntity?.bounds?.min[2]).toBeCloseTo(0, 6);
    expect(bodyEntity?.bounds?.max[0]).toBeCloseTo(3, 6);
    expect(bodyEntity?.bounds?.max[1]).toBeCloseTo(3.5, 6);
    expect(bodyEntity?.bounds?.max[2]).toBeCloseTo(5, 6);
    expect(JSON.stringify(response)).not.toMatch(
      /rendererId|renderId|meshId|occtId|occtShape|gpuId|selectionBufferId|triangleIndex|faceIndex|edgeIndex|vertexIndex/i
    );
  }, 120_000);

  it("returns exact topology checkpoint payloads through the geometry kernel facade", async () => {
    const worker = createGeometryKernelWorker({ delayMs: 1 });
    const response = await worker.execute(
      createExactTopologyCheckpointPayloadWorkerRequest({
        id: "worker_req_exact_topology_checkpoint_payload_execute",
        payloadId: "geometry_req_exact_topology_checkpoint_payload_execute",
        checkpointId: "checkpoint_worker_rect",
        bodyId: "body_worker_rect",
        source: {
          kind: "extrude",
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [1, 2],
            width: 4,
            height: 3
          },
          depth: 5
        }
      })
    );

    if (!response.response.ok) {
      throw new Error(response.response.error.message);
    }

    expect(response).toMatchObject({
      id: "worker_req_exact_topology_checkpoint_payload_execute",
      version: "geometry-worker.v1",
      kind: "geometry-worker.exactTopologyCheckpointPayload",
      payloadId: "geometry_req_exact_topology_checkpoint_payload_execute",
      response: {
        ok: true,
        id: "geometry_req_exact_topology_checkpoint_payload_execute",
        op: "geometry.exactTopologyCheckpointPayload",
        warnings: []
      }
    });
    expect(response.response.checkpointPayload).toMatchObject({
      checkpointId: "checkpoint_worker_rect",
      bodyId: "body_worker_rect",
      sourceKind: "extrude",
      brepFormat: "occt-brep",
      brepWriter: "BRepTools.Write_3",
      topologySnapshot: expect.objectContaining({
        sourceKind: "extrude",
        signatureAlgorithm: "partbench-derived-topology-snapshot-v1"
      }),
      signaturePayload: expect.objectContaining({
        checkpointId: "checkpoint_worker_rect",
        signatureAlgorithm: "partbench-derived-topology-snapshot-v1"
      })
    });
    expect(response.response.checkpointPayload.brepByteLength).toBe(
      response.response.checkpointPayload.brepBytes.byteLength
    );
    expect(response.response.checkpointPayload.brepByteLength).toBeGreaterThan(
      1000
    );
    expect(response.response.checkpointPayload.signaturePayload.signature).toBe(
      response.response.checkpointPayload.topologySnapshot.signature
    );
    expect(response.transferables).toEqual([
      response.response.checkpointPayload.brepBytes.buffer
    ]);
    expect(JSON.stringify(response)).not.toMatch(
      /rendererId|renderId|meshId|occtId|occtShape|gpuId|selectionBufferId|triangleIndex|faceIndex|edgeIndex|vertexIndex/i
    );
  }, 120_000);

  it("returns exact STEP bytes through the geometry kernel facade", async () => {
    const worker = createGeometryKernelWorker({ delayMs: 1 });
    const response = await worker.execute(
      createExactStepExportWorkerRequest({
        id: "worker_req_step_export_execute",
        payloadId: "geometry_req_step_export_execute",
        units: "mm",
        bodies: [
          {
            bodyId: "body_step_rect",
            sketchPlane: "XY",
            profile: {
              kind: "rectangle",
              center: [0, 0],
              width: 2,
              height: 1
            },
            depth: 3,
            side: "positive"
          }
        ]
      })
    );

    expect(response).toMatchObject({
      id: "worker_req_step_export_execute",
      version: "geometry-worker.v1",
      kind: "geometry-worker.exactExport",
      payloadId: "geometry_req_step_export_execute",
      response: {
        ok: true,
        id: "geometry_req_step_export_execute",
        op: "geometry.exportStep",
        warnings: []
      }
    });

    if (!response.response.ok) {
      throw new Error(response.response.error.message);
    }

    expect(response.response.artifact.byteLength).toBeGreaterThan(1000);
    expect(
      new TextDecoder().decode(response.response.artifact.bytes)
    ).toContain("ISO-10303-21");
    expect(response.transferables).toEqual([
      response.response.artifact.bytes.buffer
    ]);
  }, 120_000);

  it("imports STEP bytes through the geometry kernel facade", async () => {
    const worker = createGeometryKernelWorker({ delayMs: 1 });
    const exportResponse = await worker.execute(
      createExactStepExportWorkerRequest({
        id: "worker_req_step_import_source_export",
        payloadId: "geometry_req_step_import_source_export",
        units: "mm",
        bodies: [
          {
            bodyId: "body_step_import_source",
            sketchPlane: "XY",
            profile: {
              kind: "rectangle",
              center: [0, 0],
              width: 2,
              height: 1
            },
            depth: 3,
            side: "positive"
          }
        ]
      })
    );

    if (!exportResponse.response.ok) {
      throw new Error(exportResponse.response.error.message);
    }

    const importResponse = await worker.execute(
      createStepImportWorkerRequest({
        id: "worker_req_step_import_execute",
        payloadId: "geometry_req_step_import_execute",
        sourceFileName: "worker-roundtrip.step",
        bytes: exportResponse.response.artifact.bytes,
        maxBodyCount: 1,
        bodyId: "body_imported_worker_roundtrip",
        checkpointId: "checkpoint_imported_worker_roundtrip"
      })
    );

    expect(importResponse).toMatchObject({
      id: "worker_req_step_import_execute",
      version: "geometry-worker.v1",
      kind: "geometry-worker.importStep",
      payloadId: "geometry_req_step_import_execute",
      response: {
        ok: true,
        id: "geometry_req_step_import_execute",
        op: "geometry.importStep",
        sourceFormat: "step",
        sourceFileName: "worker-roundtrip.step",
        bodyCount: 1,
        warnings: []
      }
    });

    if (!importResponse.response.ok) {
      throw new Error(importResponse.response.error.message);
    }

    const body = importResponse.response.bodies[0];

    expect(body).toMatchObject({
      sourceFormat: "step",
      sourceFileName: "worker-roundtrip.step",
      shapeType: "solid",
      solidCount: 1,
      checkpointPayload: {
        checkpointId: "checkpoint_imported_worker_roundtrip",
        bodyId: "body_imported_worker_roundtrip",
        sourceKind: "importedBody",
        brepFormat: "occt-brep",
        brepWriter: "BRepTools.Write_3"
      }
    });
    expect(body.faceCount).toBeGreaterThanOrEqual(6);
    expect(body.checkpointPayload.signaturePayload.signature).toBe(
      body.topologySnapshot.signature
    );
    expect(importResponse.transferables).toEqual([
      body.checkpointPayload.brepBytes.buffer
    ]);
    expect(JSON.stringify(importResponse)).not.toMatch(
      /rendererId|renderId|meshId|occtId|occtShape|gpuId|selectionBufferId|triangleIndex|faceIndex|edgeIndex|vertexIndex/i
    );
  }, 120_000);

  it("returns revolve exact body metadata through the geometry kernel facade", async () => {
    const worker = createGeometryKernelWorker({ delayMs: 1 });
    const response = await worker.execute(
      createExactBodyMetadataWorkerRequest({
        id: "worker_req_revolve_exact_metadata_execute",
        payloadId: "geometry_req_revolve_exact_metadata_execute",
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
          angleDegrees: 360
        }
      })
    );

    expect(response).toMatchObject({
      id: "worker_req_revolve_exact_metadata_execute",
      version: "geometry-worker.v1",
      kind: "geometry-worker.exactMetadata",
      payloadId: "geometry_req_revolve_exact_metadata_execute",
      transferables: [],
      response: {
        ok: true,
        id: "geometry_req_revolve_exact_metadata_execute",
        op: "geometry.exactBodyMetadata",
        warnings: []
      }
    });

    if (!response.response.ok) {
      throw new Error(response.response.error.message);
    }

    expect(response.response.metadata.sourceKind).toBe("revolve");
    expect(response.response.metadata.volume).toBeGreaterThan(0);
    expect(response.response.metadata.measurementSource).toBe("kernel-derived");
  }, 120_000);

  it("returns hole exact body metadata through the geometry kernel facade", async () => {
    const worker = createGeometryKernelWorker({ delayMs: 1 });
    const response = await worker.execute(
      createExactBodyMetadataWorkerRequest({
        id: "worker_req_hole_exact_metadata_execute",
        payloadId: "geometry_req_hole_exact_metadata_execute",
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
            depthMode: "blind",
            depth: 2,
            direction: "positive"
          }
        }
      })
    );

    expect(response).toMatchObject({
      id: "worker_req_hole_exact_metadata_execute",
      version: "geometry-worker.v1",
      kind: "geometry-worker.exactMetadata",
      payloadId: "geometry_req_hole_exact_metadata_execute",
      transferables: [],
      response: {
        ok: true,
        id: "geometry_req_hole_exact_metadata_execute",
        op: "geometry.exactBodyMetadata",
        warnings: []
      }
    });

    if (!response.response.ok) {
      throw new Error(response.response.error.message);
    }

    expect(response.response.metadata.sourceKind).toBe("hole");
    expect(response.response.metadata.volume).toBeCloseTo(
      72 - Math.PI * 0.5,
      5
    );
    expect(response.response.metadata.measurementSource).toBe("kernel-derived");
  }, 120_000);

  it("returns edge-finish exact body metadata through the geometry kernel facade", async () => {
    const worker = createGeometryKernelWorker({ delayMs: 1 });
    const response = await worker.execute(
      createExactBodyMetadataWorkerRequest({
        id: "worker_req_edge_finish_exact_metadata_execute",
        payloadId: "geometry_req_edge_finish_exact_metadata_execute",
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
            depth: 4
          },
          edgeStableId: "generated:edge:body:1:start:uMin",
          distance: 0.25
        }
      })
    );

    expect(
      response.response.ok ||
        response.response.error.code === "UNAVAILABLE_BINDING"
    ).toBe(true);
    expect(response).toMatchObject({
      id: "worker_req_edge_finish_exact_metadata_execute",
      version: "geometry-worker.v1",
      kind: "geometry-worker.exactMetadata",
      payloadId: "geometry_req_edge_finish_exact_metadata_execute",
      transferables: [],
      response: {
        id: "geometry_req_edge_finish_exact_metadata_execute",
        op: "geometry.exactBodyMetadata",
        warnings: []
      }
    });

    if (!response.response.ok) {
      return;
    }

    expect(response.response.metadata.sourceKind).toBe("edgeFinish");
    expect(response.response.metadata.volume).toBeGreaterThan(0);
    expect(response.response.metadata.measurementSource).toBe("kernel-derived");
  }, 120_000);

  it("returns structured kernel validation errors without transferables", async () => {
    const worker = new GeometryKernelWorker();

    const response = await worker.execute(
      createBoxTessellationWorkerRequest({
        id: "worker_req_bad_dimensions",
        width: 0,
        height: 20,
        depth: 30
      })
    );

    expect(response).toEqual({
      id: "worker_req_bad_dimensions",
      version: "geometry-worker.v1",
      kind: "geometry-worker.tessellatePrimitive",
      payloadId: "worker_req_bad_dimensions:payload",
      response: {
        ok: false,
        id: "worker_req_bad_dimensions:payload",
        op: "geometry.tessellateBox",
        error: {
          code: "INVALID_DIMENSIONS",
          message: "Box dimensions must be finite numbers greater than zero."
        },
        warnings: []
      },
      transferables: []
    });
  });

  it("creates structured worker diagnostics for success and failure", () => {
    expect(
      createWorkerSuccessDiagnostics({
        wasmLoadStatus: "loaded"
      })
    ).toEqual({
      ok: true,
      stage: "complete",
      workerStarted: true,
      wasmLoadStatus: "loaded"
    });

    expect(
      createWorkerErrorDiagnostics({
        stage: "wasmLoad",
        code: "WASM_LOAD_FAILED",
        message: "OCCT WASM could not be loaded.",
        cause: "network error"
      })
    ).toEqual({
      ok: false,
      stage: "wasmLoad",
      workerStarted: true,
      wasmLoadStatus: "notRequested",
      error: {
        code: "WASM_LOAD_FAILED",
        message: "OCCT WASM could not be loaded.",
        cause: "network error"
      }
    });
  });
});
