import { describe, expect, it } from "vitest";
import {
  executeGeometryKernelRequest,
  getGeometryKernelExactExportCapabilities,
  getGeometryResponseTransferables
} from "./index";
import {
  executeGeometryKernelRequestWithMeshFactory,
  type GeometryKernelMeshFactories
} from "./kernel";

const OCCT_WASM_TEST_TIMEOUT_MS = 120_000;

describe("geometry-kernel facade", () => {
  it("reports STEP exact export writer capability as available", () => {
    expect(getGeometryKernelExactExportCapabilities()).toEqual([
      expect.objectContaining({
        format: "step",
        label: "STEP",
        status: "available",
        writerAvailable: true,
        boundary: "geometry-kernel",
        writerBoundary: "occt-wasm",
        missingBindings: []
      })
    ]);
  });

  it("reports STEP exact export writer capability as unavailable when bindings are absent", () => {
    expect(
      getGeometryKernelExactExportCapabilities({
        status: "unavailable",
        writerAvailable: false,
        packageVersion: "2.0.0-test",
        checkedBindings: ["STEPControl_Writer_1"],
        availableBindings: [],
        missingBindings: ["STEPControl_Writer_1"]
      })
    ).toEqual([
      expect.objectContaining({
        format: "step",
        status: "unavailable",
        writerAvailable: false,
        missingBindings: ["STEPControl_Writer_1"]
      })
    ]);
  });

  it(
    "exports a rectangle extrude as STEP bytes through the isolated OCCT WASM adapter",
    async () => {
      const response = await executeGeometryKernelRequest({
        id: "geometry_req_step_export",
        version: "geometry-kernel.v1",
        op: "geometry.exportStep",
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

      expect(response.ok).toBe(true);

      if (!response.ok) {
        throw new Error(response.error.message);
      }

      const text = new TextDecoder().decode(response.artifact.bytes);

      expect(response.artifact.byteLength).toBeGreaterThan(1000);
      expect(text).toContain("ISO-10303-21");
      expect(getGeometryResponseTransferables(response)).toHaveLength(1);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "tessellates a box through the isolated OCCT WASM adapter",
    async () => {
      const response = await executeGeometryKernelRequest({
        id: "geometry_req_1",
        version: "geometry-kernel.v1",
        op: "geometry.tessellateBox",
        dimensions: {
          width: 10,
          height: 20,
          depth: 30
        }
      });

      expect(response.ok).toBe(true);

      if (!response.ok) {
        throw new Error(response.error.message);
      }

      expect(response).toMatchObject({
        id: "geometry_req_1",
        op: "geometry.tessellateBox",
        warnings: []
      });
      expect(response.mesh.primitive).toBe("box");
      expect(response.mesh.faceCount).toBe(6);
      expect(response.mesh.vertexCount).toBe(24);
      expect(response.mesh.triangleCount).toBe(12);
      expect(response.mesh.positions).toBeInstanceOf(Float32Array);
      expect(response.mesh.indices).toBeInstanceOf(Uint32Array);
      expect(response.mesh.positions).toHaveLength(
        response.mesh.vertexCount * 3
      );
      expect(response.mesh.indices).toHaveLength(
        response.mesh.triangleCount * 3
      );
      expect(getGeometryResponseTransferables(response)).toEqual([
        response.mesh.positions.buffer,
        response.mesh.indices.buffer
      ]);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "tessellates a cylinder through the isolated OCCT WASM adapter",
    async () => {
      const response = await executeGeometryKernelRequest({
        id: "geometry_req_cylinder",
        version: "geometry-kernel.v1",
        op: "geometry.tessellateCylinder",
        dimensions: {
          radius: 10,
          height: 30
        }
      });

      expect(response.ok).toBe(true);

      if (!response.ok) {
        throw new Error(response.error.message);
      }

      expect(response).toMatchObject({
        id: "geometry_req_cylinder",
        op: "geometry.tessellateCylinder",
        warnings: []
      });
      expect(response.mesh.primitive).toBe("cylinder");
      expect(response.mesh.faceCount).toBeGreaterThanOrEqual(3);
      expect(response.mesh.vertexCount).toBeGreaterThan(0);
      expect(response.mesh.triangleCount).toBeGreaterThan(0);
      expect(response.mesh.positions).toBeInstanceOf(Float32Array);
      expect(response.mesh.indices).toBeInstanceOf(Uint32Array);
      expect(response.mesh.positions).toHaveLength(
        response.mesh.vertexCount * 3
      );
      expect(response.mesh.indices).toHaveLength(
        response.mesh.triangleCount * 3
      );
      expect(getGeometryResponseTransferables(response)).toEqual([
        response.mesh.positions.buffer,
        response.mesh.indices.buffer
      ]);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "tessellates a sphere through the isolated OCCT WASM adapter",
    async () => {
      const response = await executeGeometryKernelRequest({
        id: "geometry_req_sphere",
        version: "geometry-kernel.v1",
        op: "geometry.tessellateSphere",
        dimensions: {
          radius: 10
        }
      });

      expect(response.ok).toBe(true);

      if (!response.ok) {
        throw new Error(response.error.message);
      }

      expect(response).toMatchObject({
        id: "geometry_req_sphere",
        op: "geometry.tessellateSphere",
        warnings: []
      });
      expect(response.mesh.primitive).toBe("sphere");
      expect(response.mesh.faceCount).toBeGreaterThan(0);
      expect(response.mesh.vertexCount).toBeGreaterThan(0);
      expect(response.mesh.triangleCount).toBeGreaterThan(0);
      expect(response.mesh.positions).toBeInstanceOf(Float32Array);
      expect(response.mesh.indices).toBeInstanceOf(Uint32Array);
      expect(response.mesh.positions).toHaveLength(
        response.mesh.vertexCount * 3
      );
      expect(response.mesh.indices).toHaveLength(
        response.mesh.triangleCount * 3
      );
      expect(getGeometryResponseTransferables(response)).toEqual([
        response.mesh.positions.buffer,
        response.mesh.indices.buffer
      ]);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "tessellates cone and torus primitives through the isolated OCCT WASM adapter",
    async () => {
      const cone = await executeGeometryKernelRequest({
        id: "geometry_req_cone",
        version: "geometry-kernel.v1",
        op: "geometry.tessellateCone",
        dimensions: {
          radius: 2,
          height: 5
        }
      });
      const torus = await executeGeometryKernelRequest({
        id: "geometry_req_torus",
        version: "geometry-kernel.v1",
        op: "geometry.tessellateTorus",
        dimensions: {
          majorRadius: 3,
          minorRadius: 0.5
        }
      });

      expect(cone.ok).toBe(true);
      expect(torus.ok).toBe(true);

      if (!cone.ok || !torus.ok) {
        throw new Error("Expected cone and torus tessellation to succeed.");
      }

      expect(cone.mesh.primitive).toBe("cone");
      expect(cone.mesh.vertexCount).toBeGreaterThan(0);
      expect(cone.mesh.triangleCount).toBeGreaterThan(0);
      expect(torus.mesh.primitive).toBe("torus");
      expect(torus.mesh.vertexCount).toBeGreaterThan(0);
      expect(torus.mesh.triangleCount).toBeGreaterThan(0);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "tessellates rectangle and circle extrudes through the isolated OCCT WASM adapter",
    async () => {
      const rectangle = await executeGeometryKernelRequest({
        id: "geometry_req_rect_extrude",
        version: "geometry-kernel.v1",
        op: "geometry.tessellateExtrude",
        sketchPlane: "XY",
        profile: {
          kind: "rectangle",
          center: [1, 2],
          width: 4,
          height: 3
        },
        depth: 5
      });
      const circle = await executeGeometryKernelRequest({
        id: "geometry_req_circle_extrude",
        version: "geometry-kernel.v1",
        op: "geometry.tessellateExtrude",
        sketchPlane: "XZ",
        profile: {
          kind: "circle",
          center: [0, 0],
          radius: 2
        },
        depth: 6
      });

      expect(rectangle.ok).toBe(true);
      expect(circle.ok).toBe(true);

      if (!rectangle.ok || !circle.ok) {
        throw new Error("Expected sketch extrude tessellation to succeed.");
      }

      expect(rectangle.mesh.primitive).toBe("extrude");
      expect(rectangle.mesh.vertexCount).toBeGreaterThan(0);
      expect(rectangle.mesh.triangleCount).toBeGreaterThan(0);
      expect(getMeshBounds(rectangle.mesh.positions)).toEqual({
        min: [-1, 0.5, 0],
        max: [3, 3.5, 5]
      });
      const circleBounds = getMeshBounds(circle.mesh.positions);

      expect(circle.mesh.primitive).toBe("extrude");
      expect(circle.mesh.vertexCount).toBeGreaterThan(0);
      expect(circle.mesh.triangleCount).toBeGreaterThan(0);
      expect(circleBounds.min[0]).toBeCloseTo(-2, 6);
      expect(circleBounds.max[0]).toBeCloseTo(2, 6);
      expect(circleBounds.min[1]).toBeCloseTo(0, 6);
      expect(circleBounds.max[1]).toBeCloseTo(6, 6);
      expect(circleBounds.min[2]).toBeGreaterThanOrEqual(-2);
      expect(circleBounds.max[2]).toBeLessThanOrEqual(2);
      expect(circleBounds.min[2] + circleBounds.max[2]).toBeCloseTo(0, 6);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "tessellates rectangle and circle revolve profiles through the isolated OCCT WASM adapter",
    async () => {
      const rectangle = await executeGeometryKernelRequest({
        id: "geometry_req_rect_revolve",
        version: "geometry-kernel.v1",
        op: "geometry.revolveProfile",
        sketchPlane: "XY",
        profile: {
          kind: "rectangle",
          center: [2, 0],
          width: 1,
          height: 3
        },
        axis: {
          start: [0, -2],
          end: [0, 2]
        },
        angleDegrees: 360
      });
      const circle = await executeGeometryKernelRequest({
        id: "geometry_req_circle_revolve",
        version: "geometry-kernel.v1",
        op: "geometry.revolveProfile",
        sketchPlane: "XZ",
        profile: {
          kind: "circle",
          center: [2, 0],
          radius: 0.5
        },
        axis: {
          start: [0, -2],
          end: [0, 2]
        },
        angleDegrees: 180
      });

      expect(rectangle.ok).toBe(true);
      expect(circle.ok).toBe(true);

      if (!rectangle.ok || !circle.ok) {
        throw new Error("Expected revolve profile tessellation to succeed.");
      }

      expect(rectangle.mesh.primitive).toBe("revolve");
      expect(rectangle.mesh.vertexCount).toBeGreaterThan(0);
      expect(rectangle.mesh.triangleCount).toBeGreaterThan(0);
      expect(circle.mesh.primitive).toBe("revolve");
      expect(circle.mesh.vertexCount).toBeGreaterThan(0);
      expect(circle.mesh.triangleCount).toBeGreaterThan(0);
      expect(getGeometryResponseTransferables(rectangle)).toEqual([
        rectangle.mesh.positions.buffer,
        rectangle.mesh.indices.buffer
      ]);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "returns exact rectangle extrude metadata through the isolated OCCT WASM adapter",
    async () => {
      const response = await executeGeometryKernelRequest({
        id: "geometry_req_rect_exact_metadata",
        version: "geometry-kernel.v1",
        op: "geometry.exactBodyMetadata",
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
      });

      expect(response.ok).toBe(true);

      if (!response.ok) {
        throw new Error(response.error.message);
      }

      expect(response.id).toBe("geometry_req_rect_exact_metadata");
      expect(response.op).toBe("geometry.exactBodyMetadata");
      expect(response.warnings).toEqual([]);
      expect(response.metadata.sourceKind).toBe("extrude");
      expect(response.metadata.bounds.min[0]).toBeCloseTo(-1, 6);
      expect(response.metadata.bounds.min[1]).toBeCloseTo(0.5, 6);
      expect(response.metadata.bounds.min[2]).toBeCloseTo(0, 6);
      expect(response.metadata.bounds.max[0]).toBeCloseTo(3, 6);
      expect(response.metadata.bounds.max[1]).toBeCloseTo(3.5, 6);
      expect(response.metadata.bounds.max[2]).toBeCloseTo(5, 6);
      expect(response.metadata.volume).toBeCloseTo(60, 6);
      expect(response.metadata.surfaceArea).toBeCloseTo(94, 6);
      expect(response.metadata.centroid).toEqual([1, 2, 2.5]);
      expect(response.metadata.topologyCounts).toEqual({
        solidCount: 1,
        faceCount: 6,
        edgeCount: 12,
        vertexCount: 8
      });
      expect(response.metadata.measurementSource).toBe("kernel-derived");
      expect(response.metadata.measurementConfidence).toBe("kernel-derived");
      expect(response.metadata.diagnostics).toEqual([]);
      expect(getGeometryResponseTransferables(response)).toEqual([]);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "returns exact circle extrude metadata through the isolated OCCT WASM adapter",
    async () => {
      const response = await executeGeometryKernelRequest({
        id: "geometry_req_circle_exact_metadata",
        version: "geometry-kernel.v1",
        op: "geometry.exactBodyMetadata",
        source: {
          kind: "extrude",
          sketchPlane: "XZ",
          profile: {
            kind: "circle",
            center: [0, 0],
            radius: 2
          },
          depth: 6
        }
      });

      expect(response.ok).toBe(true);

      if (!response.ok) {
        throw new Error(response.error.message);
      }

      expect(response.metadata.sourceKind).toBe("extrude");
      expect(response.metadata.bounds.min[0]).toBeCloseTo(-2, 6);
      expect(response.metadata.bounds.max[0]).toBeCloseTo(2, 6);
      expect(response.metadata.bounds.min[1]).toBeCloseTo(0, 6);
      expect(response.metadata.bounds.max[1]).toBeCloseTo(6, 6);
      expect(response.metadata.bounds.min[2]).toBeCloseTo(-2, 6);
      expect(response.metadata.bounds.max[2]).toBeCloseTo(2, 6);
      expect(response.metadata.volume).toBeCloseTo(Math.PI * 4 * 6, 6);
      expect(response.metadata.surfaceArea).toBeCloseTo(
        2 * Math.PI * 2 * (2 + 6),
        6
      );
      expect(response.metadata.centroid[0]).toBeCloseTo(0, 6);
      expect(response.metadata.centroid[1]).toBeCloseTo(3, 6);
      expect(response.metadata.centroid[2]).toBeCloseTo(0, 6);
      expect(response.metadata.topologyCounts.solidCount).toBe(1);
      expect(response.metadata.topologyCounts.faceCount).toBeGreaterThanOrEqual(
        3
      );
      expect(response.metadata.measurementSource).toBe("kernel-derived");
      expect(response.metadata.measurementConfidence).toBe("kernel-derived");
      expect(response.metadata.diagnostics).toEqual([]);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "returns exact revolve metadata through the isolated OCCT WASM adapter",
    async () => {
      const response = await executeGeometryKernelRequest({
        id: "geometry_req_revolve_exact_metadata",
        version: "geometry-kernel.v1",
        op: "geometry.exactBodyMetadata",
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
      });

      expect(response.ok).toBe(true);

      if (!response.ok) {
        throw new Error(response.error.message);
      }

      expect(response.metadata.sourceKind).toBe("revolve");
      expect(response.metadata.volume).toBeCloseTo(12 * Math.PI, 6);
      expect(response.metadata.surfaceArea).toBeCloseTo(32 * Math.PI, 6);
      expect(response.metadata.centroid[0]).toBeCloseTo(0, 6);
      expect(response.metadata.topologyCounts.solidCount).toBe(1);
      expect(response.metadata.topologyCounts.faceCount).toBeGreaterThan(0);
      expect(response.metadata.measurementSource).toBe("kernel-derived");
      expect(response.metadata.measurementConfidence).toBe("kernel-derived");
      expect(getGeometryResponseTransferables(response)).toEqual([]);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "returns exact hole metadata through the isolated OCCT WASM adapter",
    async () => {
      const response = await executeGeometryKernelRequest({
        id: "geometry_req_hole_exact_metadata",
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
            depthMode: "blind",
            depth: 2,
            direction: "positive"
          }
        }
      });

      expect(response.ok).toBe(true);

      if (!response.ok) {
        throw new Error(response.error.message);
      }

      expect(response.metadata.sourceKind).toBe("hole");
      expect(response.metadata.volume).toBeCloseTo(72 - Math.PI * 0.5, 5);
      expect(response.metadata.surfaceArea).toBeGreaterThan(0);
      expect(response.metadata.centroid[2]).toBeGreaterThan(1.5);
      expect(response.metadata.topologyCounts.solidCount).toBe(1);
      expect(response.metadata.topologyCounts.faceCount).toBeGreaterThan(0);
      expect(response.metadata.measurementSource).toBe("kernel-derived");
      expect(response.metadata.measurementConfidence).toBe("kernel-derived");
      expect(response.metadata.diagnostics).toEqual([]);
      expect(getGeometryResponseTransferables(response)).toEqual([]);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "returns exact edge-finish metadata through the isolated OCCT WASM adapter",
    async () => {
      const target = {
        sketchPlane: "XY" as const,
        profile: {
          kind: "rectangle" as const,
          center: [0, 0] as const,
          width: 6,
          height: 4
        },
        depth: 4
      };
      const chamfer = await executeGeometryKernelRequest({
        id: "geometry_req_chamfer_exact_metadata",
        version: "geometry-kernel.v1",
        op: "geometry.exactBodyMetadata",
        source: {
          kind: "edgeFinish",
          operation: "chamfer",
          target,
          edgeStableId: "generated:edge:body:1:start:uMin",
          distance: 0.25
        }
      });
      const fillet = await executeGeometryKernelRequest({
        id: "geometry_req_fillet_exact_metadata",
        version: "geometry-kernel.v1",
        op: "geometry.exactBodyMetadata",
        source: {
          kind: "edgeFinish",
          operation: "fillet",
          target,
          edgeStableId: "generated:edge:body:1:longitudinal:uMax:vMax",
          radius: 0.2
        }
      });

      expect(chamfer.ok || chamfer.error.code === "UNAVAILABLE_BINDING").toBe(
        true
      );
      expect(fillet.ok || fillet.error.code === "UNAVAILABLE_BINDING").toBe(
        true
      );

      if (!chamfer.ok || !fillet.ok) {
        return;
      }

      expect(chamfer.metadata.sourceKind).toBe("edgeFinish");
      expect(chamfer.metadata.bounds.min[0]).toBeCloseTo(-3, 6);
      expect(chamfer.metadata.bounds.min[1]).toBeCloseTo(-2, 6);
      expect(chamfer.metadata.bounds.min[2]).toBeCloseTo(0, 6);
      expect(chamfer.metadata.bounds.max[0]).toBeCloseTo(3, 6);
      expect(chamfer.metadata.bounds.max[1]).toBeCloseTo(2, 6);
      expect(chamfer.metadata.bounds.max[2]).toBeCloseTo(4, 6);
      expect(chamfer.metadata.volume).toBeLessThan(96);
      expect(chamfer.metadata.volume).toBeGreaterThan(0);
      expect(chamfer.metadata.surfaceArea).toBeGreaterThan(0);
      expect(chamfer.metadata.topologyCounts.solidCount).toBe(1);
      expect(chamfer.metadata.topologyCounts.faceCount).toBeGreaterThan(0);
      expect(chamfer.metadata.measurementSource).toBe("kernel-derived");
      expect(fillet.metadata.sourceKind).toBe("edgeFinish");
      expect(fillet.metadata.volume).toBeLessThan(96);
      expect(fillet.metadata.volume).toBeGreaterThan(0);
      expect(fillet.metadata.topologyCounts.solidCount).toBe(1);
      expect(getGeometryResponseTransferables(chamfer)).toEqual([]);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "maps extrude mesh bounds for negative and symmetric sides",
    async () => {
      const negative = await executeGeometryKernelRequest({
        id: "geometry_req_rect_negative_extrude",
        version: "geometry-kernel.v1",
        op: "geometry.tessellateExtrude",
        sketchPlane: "XY",
        profile: {
          kind: "rectangle",
          center: [0, 0],
          width: 2,
          height: 2
        },
        depth: 4,
        side: "negative"
      });
      const symmetric = await executeGeometryKernelRequest({
        id: "geometry_req_rect_symmetric_extrude",
        version: "geometry-kernel.v1",
        op: "geometry.tessellateExtrude",
        sketchPlane: "XY",
        profile: {
          kind: "rectangle",
          center: [0, 0],
          width: 2,
          height: 2
        },
        depth: 4,
        side: "symmetric"
      });

      expect(negative.ok).toBe(true);
      expect(symmetric.ok).toBe(true);

      if (!negative.ok || !symmetric.ok) {
        throw new Error("Expected extrude side tessellation to succeed.");
      }

      expect(getMeshBounds(negative.mesh.positions)).toEqual({
        min: [-1, -1, -4],
        max: [1, 1, 0]
      });
      expect(getMeshBounds(symmetric.mesh.positions)).toEqual({
        min: [-1, -1, -2],
        max: [1, 1, 2]
      });
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "runs add and cut boolean feasibility requests for rectangle extrude sources",
    async () => {
      const target = {
        sketchPlane: "XY" as const,
        profile: {
          kind: "rectangle" as const,
          center: [0, 0] as const,
          width: 4,
          height: 4
        },
        depth: 4
      };
      const tool = {
        sketchPlane: "XY" as const,
        profile: {
          kind: "rectangle" as const,
          center: [2, 0] as const,
          width: 2,
          height: 2
        },
        depth: 4
      };
      const add = await executeGeometryKernelRequest({
        id: "geometry_req_boolean_add",
        version: "geometry-kernel.v1",
        op: "geometry.booleanExtrudes",
        operation: "add",
        target,
        tool
      });
      const cut = await executeGeometryKernelRequest({
        id: "geometry_req_boolean_cut",
        version: "geometry-kernel.v1",
        op: "geometry.booleanExtrudes",
        operation: "cut",
        target,
        tool
      });

      expect(add.ok).toBe(true);
      expect(cut.ok).toBe(true);

      if (!add.ok || !cut.ok) {
        throw new Error("Expected rectangle boolean feasibility to succeed.");
      }

      expect(add.mesh.primitive).toBe("boolean");
      expect(add.mesh.vertexCount).toBeGreaterThan(0);
      expect(add.mesh.triangleCount).toBeGreaterThan(0);
      expect(getMeshBounds(add.mesh.positions)).toEqual({
        min: [-2, -2, 0],
        max: [3, 2, 4]
      });
      expect(cut.mesh.primitive).toBe("boolean");
      expect(cut.mesh.vertexCount).toBeGreaterThan(0);
      expect(cut.mesh.triangleCount).toBeGreaterThan(0);
      expect(getGeometryResponseTransferables(add)).toEqual([
        add.mesh.positions.buffer,
        add.mesh.indices.buffer
      ]);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "runs a circle-target cut by rectangle tool feasibility request",
    async () => {
      const response = await executeGeometryKernelRequest({
        id: "geometry_req_boolean_circle_cut",
        version: "geometry-kernel.v1",
        op: "geometry.booleanExtrudes",
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
      });

      expect(response.ok).toBe(true);

      if (!response.ok) {
        throw new Error(response.error.message);
      }

      const bounds = getMeshBounds(response.mesh.positions);

      expect(response.mesh.primitive).toBe("boolean");
      expect(response.mesh.vertexCount).toBeGreaterThan(0);
      expect(response.mesh.triangleCount).toBeGreaterThan(0);
      expect(bounds.min[0]).toBeCloseTo(-3, 6);
      expect(bounds.max[0]).toBeCloseTo(3, 6);
      expect(bounds.min[1]).toBeGreaterThanOrEqual(-3);
      expect(bounds.max[1]).toBeLessThanOrEqual(3);
      expect(bounds.min[2]).toBeCloseTo(0, 6);
      expect(bounds.max[2]).toBeCloseTo(4, 6);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "runs rectangle and circle target hole feasibility requests",
    async () => {
      const rectangleHole = await executeGeometryKernelRequest({
        id: "geometry_req_hole_rectangle_blind",
        version: "geometry-kernel.v1",
        op: "geometry.hole",
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
        tool: {
          sketchPlane: "XY",
          circle: {
            kind: "circle",
            center: [0, 0],
            radius: 0.75
          },
          depthMode: "blind",
          depth: 3,
          direction: "positive"
        }
      });
      const circleHole = await executeGeometryKernelRequest({
        id: "geometry_req_hole_circle_through",
        version: "geometry-kernel.v1",
        op: "geometry.hole",
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
          circle: {
            kind: "circle",
            center: [0, 0],
            radius: 0.75
          },
          depthMode: "throughAll",
          direction: "positive"
        }
      });

      expect(rectangleHole.ok).toBe(true);
      expect(circleHole.ok).toBe(true);

      if (!rectangleHole.ok || !circleHole.ok) {
        throw new Error("Expected hole feasibility requests to succeed.");
      }

      expect(rectangleHole.mesh.primitive).toBe("hole");
      expect(rectangleHole.mesh.vertexCount).toBeGreaterThan(0);
      expect(rectangleHole.mesh.triangleCount).toBeGreaterThan(0);
      expect(getMeshBounds(rectangleHole.mesh.positions)).toEqual({
        min: [-3, -2, 0],
        max: [3, 2, 4]
      });
      expect(circleHole.mesh.primitive).toBe("hole");
      expect(circleHole.mesh.vertexCount).toBeGreaterThan(0);
      expect(circleHole.mesh.triangleCount).toBeGreaterThan(0);
      expect(getGeometryResponseTransferables(rectangleHole)).toEqual([
        rectangleHole.mesh.positions.buffer,
        rectangleHole.mesh.indices.buffer
      ]);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "runs rectangle edge-finish chamfer and fillet feasibility requests",
    async () => {
      const target = {
        sketchPlane: "XY" as const,
        profile: {
          kind: "rectangle" as const,
          center: [0, 0] as const,
          width: 6,
          height: 4
        },
        depth: 4
      };
      const chamfer = await executeGeometryKernelRequest({
        id: "geometry_req_edge_finish_chamfer",
        version: "geometry-kernel.v1",
        op: "geometry.edgeFinish",
        operation: "chamfer",
        target,
        edgeStableId: "generated:edge:body:1:start:uMin",
        distance: 0.25
      });
      const fillet = await executeGeometryKernelRequest({
        id: "geometry_req_edge_finish_fillet",
        version: "geometry-kernel.v1",
        op: "geometry.edgeFinish",
        operation: "fillet",
        target,
        edgeStableId: "generated:edge:body:1:longitudinal:uMax:vMax",
        radius: 0.2
      });

      expect(chamfer.ok || chamfer.error.code === "UNAVAILABLE_BINDING").toBe(
        true
      );
      expect(fillet.ok || fillet.error.code === "UNAVAILABLE_BINDING").toBe(
        true
      );

      if (!chamfer.ok || !fillet.ok) {
        return;
      }

      expect(chamfer.mesh.primitive).toBe("edgeFinish");
      expect(chamfer.mesh.vertexCount).toBeGreaterThan(0);
      expect(chamfer.mesh.triangleCount).toBeGreaterThan(0);
      expect(getMeshBounds(chamfer.mesh.positions)).toEqual({
        min: [-3, -2, 0],
        max: [3, 2, 4]
      });
      expect(fillet.mesh.primitive).toBe("edgeFinish");
      expect(fillet.mesh.vertexCount).toBeGreaterThan(0);
      expect(fillet.mesh.triangleCount).toBeGreaterThan(0);
      expect(getGeometryResponseTransferables(chamfer)).toEqual([
        chamfer.mesh.positions.buffer,
        chamfer.mesh.indices.buffer
      ]);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "runs hole feasibility requests for side direction, planes, and placement frames",
    async () => {
      const negative = await executeGeometryKernelRequest({
        id: "geometry_req_hole_negative",
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
          depth: 4,
          side: "negative"
        },
        tool: {
          sketchPlane: "XY",
          circle: {
            kind: "circle",
            center: [0, 0],
            radius: 0.5
          },
          depthMode: "throughAll",
          direction: "negative"
        }
      });
      const xz = await executeGeometryKernelRequest({
        id: "geometry_req_hole_xz",
        version: "geometry-kernel.v1",
        op: "geometry.hole",
        target: {
          sketchPlane: "XZ",
          profile: {
            kind: "rectangle",
            center: [0, 0],
            width: 4,
            height: 4
          },
          depth: 4
        },
        tool: {
          sketchPlane: "XZ",
          circle: {
            kind: "circle",
            center: [0, 0],
            radius: 0.5
          },
          depthMode: "blind",
          depth: 3
        }
      });
      const placed = await executeGeometryKernelRequest({
        id: "geometry_req_hole_placed",
        version: "geometry-kernel.v1",
        op: "geometry.hole",
        target: {
          sketchPlane: "XY",
          placementFrame: {
            origin: [10, 20, 30],
            uAxis: [0, 1, 0],
            vAxis: [0, 0, 1]
          },
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
          placementFrame: {
            origin: [10, 20, 30],
            uAxis: [0, 1, 0],
            vAxis: [0, 0, 1]
          },
          circle: {
            kind: "circle",
            center: [0, 0],
            radius: 0.5
          },
          depthMode: "blind",
          depth: 3
        }
      });

      expect(negative.ok).toBe(true);
      expect(xz.ok).toBe(true);
      expect(placed.ok).toBe(true);

      if (!negative.ok || !xz.ok || !placed.ok) {
        throw new Error(
          "Expected negative, plane, and placement hole requests to succeed."
        );
      }

      expect(getMeshBounds(negative.mesh.positions)).toEqual({
        min: [-2, -2, -4],
        max: [2, 2, 0]
      });
      expect(getMeshBounds(xz.mesh.positions)).toEqual({
        min: [-2, 0, -6],
        max: [2, 4, -2]
      });
      expectBooleanBounds(
        getMeshBounds(placed.mesh.positions),
        {
          min: [10, 18, 28],
          max: [14, 22, 32]
        },
        [0]
      );
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "runs circle-target cut feasibility requests for sides and planes",
    async () => {
      const cases = [
        {
          id: "circle_cut_positive_xy",
          targetPlane: "XY" as const,
          targetSide: "positive" as const,
          toolPlane: "XY" as const,
          toolSide: "positive" as const,
          expectedBounds: {
            min: [-3, -3, 0] as const,
            max: [3, 3, 4] as const
          },
          exactAxes: [2] as const
        },
        {
          id: "circle_cut_negative_xy",
          targetPlane: "XY" as const,
          targetSide: "negative" as const,
          toolPlane: "XY" as const,
          toolSide: "negative" as const,
          expectedBounds: {
            min: [-3, -3, -4] as const,
            max: [3, 3, 0] as const
          },
          exactAxes: [2] as const
        },
        {
          id: "circle_cut_symmetric_xy",
          targetPlane: "XY" as const,
          targetSide: "symmetric" as const,
          toolPlane: "XY" as const,
          toolSide: "symmetric" as const,
          expectedBounds: {
            min: [-3, -3, -2] as const,
            max: [3, 3, 2] as const
          },
          exactAxes: [2] as const
        },
        {
          id: "circle_cut_positive_xz",
          targetPlane: "XZ" as const,
          targetSide: "positive" as const,
          toolPlane: "XZ" as const,
          toolSide: "positive" as const,
          expectedBounds: {
            min: [-3, 0, -3] as const,
            max: [3, 4, 3] as const
          },
          exactAxes: [1] as const
        },
        {
          id: "circle_cut_positive_yz",
          targetPlane: "YZ" as const,
          targetSide: "positive" as const,
          toolPlane: "YZ" as const,
          toolSide: "positive" as const,
          expectedBounds: {
            min: [0, -3, -3] as const,
            max: [4, 3, 3] as const
          },
          exactAxes: [0] as const
        }
      ];

      for (const testCase of cases) {
        const response = await executeGeometryKernelRequest({
          id: testCase.id,
          version: "geometry-kernel.v1",
          op: "geometry.booleanExtrudes",
          operation: "cut",
          target: {
            sketchPlane: testCase.targetPlane,
            profile: {
              kind: "circle",
              center: [0, 0],
              radius: 3
            },
            depth: 4,
            side: testCase.targetSide
          },
          tool: {
            sketchPlane: testCase.toolPlane,
            profile: {
              kind: "rectangle",
              center: [0, 0],
              width: 2,
              height: 6
            },
            depth: 4,
            side: testCase.toolSide
          }
        });

        expect(response.ok, testCase.id).toBe(true);

        if (!response.ok) {
          throw new Error(response.error.message);
        }

        expectBooleanBounds(
          getMeshBounds(response.mesh.positions),
          testCase.expectedBounds,
          testCase.exactAxes
        );
      }
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "runs circle-target cut feasibility requests for placement frames and non-overlap",
    async () => {
      const placementFrame = {
        origin: [10, 20, 30] as const,
        uAxis: [0, 1, 0] as const,
        vAxis: [0, 0, 1] as const
      };
      const placedCut = await executeGeometryKernelRequest({
        id: "geometry_req_boolean_circle_cut_placed",
        version: "geometry-kernel.v1",
        op: "geometry.booleanExtrudes",
        operation: "cut",
        target: {
          sketchPlane: "XY",
          placementFrame,
          profile: {
            kind: "circle",
            center: [0, 0],
            radius: 3
          },
          depth: 4
        },
        tool: {
          sketchPlane: "XY",
          placementFrame,
          profile: {
            kind: "rectangle",
            center: [0, 0],
            width: 2,
            height: 6
          },
          depth: 4
        }
      });
      const nonOverlappingCut = await executeGeometryKernelRequest({
        id: "geometry_req_boolean_circle_cut_non_overlap",
        version: "geometry-kernel.v1",
        op: "geometry.booleanExtrudes",
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
            center: [10, 0],
            width: 2,
            height: 2
          },
          depth: 4
        }
      });

      expect(placedCut.ok).toBe(true);
      expect(nonOverlappingCut.ok).toBe(true);

      if (!placedCut.ok || !nonOverlappingCut.ok) {
        throw new Error("Expected placement and non-overlap cuts to succeed.");
      }

      expectBooleanBounds(
        getMeshBounds(placedCut.mesh.positions),
        {
          min: [10, 17, 27],
          max: [14, 23, 33]
        },
        [0]
      );
      expectBooleanBounds(
        getMeshBounds(nonOverlappingCut.mesh.positions),
        {
          min: [-3, -3, 0],
          max: [3, 3, 4]
        },
        [2]
      );
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it("returns structured boolean feasibility errors", async () => {
    const rectangleSource = {
      sketchPlane: "XY" as const,
      profile: {
        kind: "rectangle" as const,
        center: [0, 0] as const,
        width: 2,
        height: 2
      },
      depth: 2
    };
    const unsupportedProfile = await executeGeometryKernelRequest({
      id: "geometry_req_boolean_unsupported_profile",
      version: "geometry-kernel.v1",
      op: "geometry.booleanExtrudes",
      operation: "add",
      target: {
        sketchPlane: "XY",
        profile: {
          kind: "circle",
          center: [0, 0],
          radius: 1
        },
        depth: 2
      },
      tool: rectangleSource
    });
    const unsupportedCircleTool = await executeGeometryKernelRequest({
      id: "geometry_req_boolean_unsupported_circle_tool",
      version: "geometry-kernel.v1",
      op: "geometry.booleanExtrudes",
      operation: "cut",
      target: rectangleSource,
      tool: {
        sketchPlane: "XY",
        profile: {
          kind: "circle",
          center: [0, 0],
          radius: 1
        },
        depth: 2
      }
    });
    const emptyResult = await executeGeometryKernelRequest({
      id: "geometry_req_boolean_empty_result",
      version: "geometry-kernel.v1",
      op: "geometry.booleanExtrudes",
      operation: "cut",
      target: rectangleSource,
      tool: rectangleSource
    });
    const circleTargetRemoved = await executeGeometryKernelRequest({
      id: "geometry_req_boolean_circle_removed",
      version: "geometry-kernel.v1",
      op: "geometry.booleanExtrudes",
      operation: "cut",
      target: {
        sketchPlane: "XY",
        profile: {
          kind: "circle",
          center: [0, 0],
          radius: 2
        },
        depth: 2
      },
      tool: {
        sketchPlane: "XY",
        profile: {
          kind: "rectangle",
          center: [0, 0],
          width: 6,
          height: 6
        },
        depth: 2
      }
    });
    const invalidPlacementFrame = await executeGeometryKernelRequest({
      id: "geometry_req_boolean_invalid_frame",
      version: "geometry-kernel.v1",
      op: "geometry.booleanExtrudes",
      operation: "cut",
      target: {
        ...rectangleSource,
        placementFrame: {
          origin: [0, 0, 0],
          uAxis: [1, 0, 0],
          vAxis: [2, 0, 0]
        }
      },
      tool: rectangleSource
    });

    expect(unsupportedProfile).toEqual({
      ok: false,
      id: "geometry_req_boolean_unsupported_profile",
      op: "geometry.booleanExtrudes",
      error: {
        code: "UNSUPPORTED_PROFILE",
        message:
          "Boolean extrude feasibility currently supports rectangle add/cut and circle-target cut by rectangle tool."
      },
      warnings: []
    });
    expect(unsupportedCircleTool).toEqual({
      ok: false,
      id: "geometry_req_boolean_unsupported_circle_tool",
      op: "geometry.booleanExtrudes",
      error: {
        code: "UNSUPPORTED_PROFILE",
        message:
          "Boolean extrude feasibility currently supports rectangle add/cut and circle-target cut by rectangle tool."
      },
      warnings: []
    });
    expect(emptyResult).toEqual({
      ok: false,
      id: "geometry_req_boolean_empty_result",
      op: "geometry.booleanExtrudes",
      error: {
        code: "EMPTY_RESULT",
        message: "The geometry kernel returned an empty or invalid mesh."
      },
      warnings: []
    });
    expect(circleTargetRemoved).toEqual({
      ok: false,
      id: "geometry_req_boolean_circle_removed",
      op: "geometry.booleanExtrudes",
      error: {
        code: "EMPTY_RESULT",
        message: "The geometry kernel returned an empty or invalid mesh."
      },
      warnings: []
    });
    expect(invalidPlacementFrame).toEqual({
      ok: false,
      id: "geometry_req_boolean_invalid_frame",
      op: "geometry.booleanExtrudes",
      error: {
        code: "INVALID_DIMENSIONS",
        message:
          "Boolean extrude requests require target/tool sources with supported sketch plane, side, profile dimensions, and positive finite depth."
      },
      warnings: []
    });
  });

  it("returns structured hole feasibility errors", async () => {
    const target = {
      sketchPlane: "XY" as const,
      profile: {
        kind: "rectangle" as const,
        center: [0, 0] as const,
        width: 2,
        height: 2
      },
      depth: 2
    };
    const blindWithoutDepth = await executeGeometryKernelRequest({
      id: "geometry_req_hole_missing_depth",
      version: "geometry-kernel.v1",
      op: "geometry.hole",
      target,
      tool: {
        sketchPlane: "XY",
        circle: {
          kind: "circle",
          center: [0, 0],
          radius: 0.5
        },
        depthMode: "blind"
      }
    });
    const throughAllWithDepth = await executeGeometryKernelRequest({
      id: "geometry_req_hole_through_depth",
      version: "geometry-kernel.v1",
      op: "geometry.hole",
      target,
      tool: {
        sketchPlane: "XY",
        circle: {
          kind: "circle",
          center: [0, 0],
          radius: 0.5
        },
        depthMode: "throughAll",
        depth: 2
      }
    });
    const invalidPlacement = await executeGeometryKernelRequest({
      id: "geometry_req_hole_invalid_placement",
      version: "geometry-kernel.v1",
      op: "geometry.hole",
      target,
      tool: {
        sketchPlane: "XY",
        circle: {
          kind: "circle",
          center: [0, 0],
          radius: 0.5
        },
        depthMode: "throughAll",
        direction: "negative"
      }
    });
    const fullRemoval = await executeGeometryKernelRequest({
      id: "geometry_req_hole_empty_result",
      version: "geometry-kernel.v1",
      op: "geometry.hole",
      target,
      tool: {
        sketchPlane: "XY",
        circle: {
          kind: "circle",
          center: [0, 0],
          radius: 3
        },
        depthMode: "throughAll",
        direction: "positive"
      }
    });

    expect(blindWithoutDepth).toEqual({
      ok: false,
      id: "geometry_req_hole_missing_depth",
      op: "geometry.hole",
      error: {
        code: "INVALID_DIMENSIONS",
        message:
          "Hole requests require a supported authored extrude target source, circular tool source, valid depth mode, direction, and finite positive blind depth when provided."
      },
      warnings: []
    });
    expect(throughAllWithDepth).toEqual({
      ok: false,
      id: "geometry_req_hole_through_depth",
      op: "geometry.hole",
      error: {
        code: "INVALID_DIMENSIONS",
        message:
          "Hole requests require a supported authored extrude target source, circular tool source, valid depth mode, direction, and finite positive blind depth when provided."
      },
      warnings: []
    });
    expect(invalidPlacement).toEqual({
      ok: false,
      id: "geometry_req_hole_invalid_placement",
      op: "geometry.hole",
      error: {
        code: "INVALID_PLACEMENT",
        message:
          "Hole through-all placement does not intersect the target bounds in the requested direction."
      },
      warnings: []
    });
    expect(fullRemoval).toEqual({
      ok: false,
      id: "geometry_req_hole_empty_result",
      op: "geometry.hole",
      error: {
        code: "EMPTY_RESULT",
        message: "The geometry kernel returned an empty or invalid mesh."
      },
      warnings: []
    });
  });

  it("returns structured edge-finish feasibility errors", async () => {
    const rectangleTarget = {
      sketchPlane: "XY" as const,
      profile: {
        kind: "rectangle" as const,
        center: [0, 0] as const,
        width: 4,
        height: 4
      },
      depth: 4
    };
    const unsupportedCircleTarget = await executeGeometryKernelRequest({
      id: "geometry_req_edge_finish_circle_target",
      version: "geometry-kernel.v1",
      op: "geometry.edgeFinish",
      operation: "chamfer",
      target: {
        sketchPlane: "XY",
        profile: {
          kind: "circle",
          center: [0, 0],
          radius: 2
        },
        depth: 4
      },
      edgeStableId: "generated:edge:body:1:start:circular",
      distance: 0.25
    });
    const unsupportedCircularEdge = await executeGeometryKernelRequest({
      id: "geometry_req_edge_finish_circular_edge",
      version: "geometry-kernel.v1",
      op: "geometry.edgeFinish",
      operation: "fillet",
      target: rectangleTarget,
      edgeStableId: "generated:edge:body:1:start:circular",
      radius: 0.25
    });
    const staleEdgeRole = await executeGeometryKernelRequest({
      id: "geometry_req_edge_finish_stale_edge",
      version: "geometry-kernel.v1",
      op: "geometry.edgeFinish",
      operation: "chamfer",
      target: rectangleTarget,
      edgeStableId: "generated:edge:body:1:deleted:uMin",
      distance: 0.25
    });
    const tooLarge = await executeGeometryKernelRequest({
      id: "geometry_req_edge_finish_too_large",
      version: "geometry-kernel.v1",
      op: "geometry.edgeFinish",
      operation: "fillet",
      target: rectangleTarget,
      edgeStableId: "generated:edge:body:1:start:uMin",
      radius: 3
    });

    expect(unsupportedCircleTarget).toEqual({
      ok: false,
      id: "geometry_req_edge_finish_circle_target",
      op: "geometry.edgeFinish",
      error: {
        code: "UNSUPPORTED_PROFILE",
        message:
          "Edge finish feasibility currently supports rectangle extrude targets only."
      },
      warnings: []
    });
    expect(unsupportedCircularEdge).toEqual({
      ok: false,
      id: "geometry_req_edge_finish_circular_edge",
      op: "geometry.edgeFinish",
      error: {
        code: "UNSUPPORTED_EDGE",
        message:
          "Edge finish feasibility currently supports generated rectangle extrude edges only."
      },
      warnings: []
    });
    expect(staleEdgeRole).toEqual({
      ok: false,
      id: "geometry_req_edge_finish_stale_edge",
      op: "geometry.edgeFinish",
      error: {
        code: "INVALID_EDGE_ROLE",
        message:
          "Edge finish requests require a generated rectangle edge stable ID with a supported semantic edge role."
      },
      warnings: []
    });
    expect(tooLarge).toEqual({
      ok: false,
      id: "geometry_req_edge_finish_too_large",
      op: "geometry.edgeFinish",
      error: {
        code: "EDGE_FINISH_TOO_LARGE",
        message:
          "Edge finish distance or radius is too large for the selected rectangle edge in this feasibility path."
      },
      warnings: []
    });
  });

  it("returns structured invalid mesh result errors", async () => {
    const unusedFactory = async () => {
      throw new Error("Unexpected mesh factory call.");
    };
    const factories: GeometryKernelMeshFactories = {
      createBoxMesh: unusedFactory,
      createCylinderMesh: unusedFactory,
      createSphereMesh: unusedFactory,
      createConeMesh: unusedFactory,
      createTorusMesh: unusedFactory,
      createBooleanExtrudeMesh: async () => ({
        primitive: "boolean",
        positions: new Float32Array([0, 0, 0]),
        indices: new Uint32Array([0, 1, 2]),
        vertexCount: 2,
        triangleCount: 1,
        faceCount: 1
      })
    };

    const response = await executeGeometryKernelRequestWithMeshFactory(
      factories,
      {
        id: "geometry_req_invalid_boolean_result",
        version: "geometry-kernel.v1",
        op: "geometry.booleanExtrudes",
        operation: "cut",
        target: {
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [0, 0],
            width: 2,
            height: 2
          },
          depth: 2
        },
        tool: {
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [0, 0],
            width: 1,
            height: 1
          },
          depth: 2
        }
      }
    );

    expect(response).toEqual({
      ok: false,
      id: "geometry_req_invalid_boolean_result",
      op: "geometry.booleanExtrudes",
      error: {
        code: "INVALID_RESULT",
        message:
          "The geometry kernel returned mesh data with inconsistent counts or invalid values."
      },
      warnings: []
    });
  });

  it("returns hole meshes from an injected factory", async () => {
    const unusedFactory = async () => {
      throw new Error("Unexpected mesh factory call.");
    };
    const factories: GeometryKernelMeshFactories = {
      createBoxMesh: unusedFactory,
      createCylinderMesh: unusedFactory,
      createSphereMesh: unusedFactory,
      createConeMesh: unusedFactory,
      createTorusMesh: unusedFactory,
      createBooleanExtrudeMesh: unusedFactory,
      createHoleMesh: async () => ({
        primitive: "hole",
        positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
        indices: new Uint32Array([0, 1, 2]),
        vertexCount: 3,
        triangleCount: 1,
        faceCount: 1
      })
    };

    const response = await executeGeometryKernelRequestWithMeshFactory(
      factories,
      {
        id: "geometry_req_injected_hole",
        version: "geometry-kernel.v1",
        op: "geometry.hole",
        target: {
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [0, 0],
            width: 2,
            height: 2
          },
          depth: 2
        },
        tool: {
          sketchPlane: "XY",
          circle: {
            kind: "circle",
            center: [0, 0],
            radius: 0.25
          },
          depthMode: "blind",
          depth: 1
        }
      }
    );

    expect(response).toEqual({
      ok: true,
      id: "geometry_req_injected_hole",
      op: "geometry.hole",
      mesh: {
        primitive: "hole",
        positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
        indices: new Uint32Array([0, 1, 2]),
        vertexCount: 3,
        triangleCount: 1,
        faceCount: 1
      },
      warnings: []
    });
  });

  it("returns edge-finish meshes from an injected factory", async () => {
    const unusedFactory = async () => {
      throw new Error("Unexpected mesh factory call.");
    };
    const factories: GeometryKernelMeshFactories = {
      createBoxMesh: unusedFactory,
      createCylinderMesh: unusedFactory,
      createSphereMesh: unusedFactory,
      createConeMesh: unusedFactory,
      createTorusMesh: unusedFactory,
      createBooleanExtrudeMesh: unusedFactory,
      createEdgeFinishMesh: async (input) => {
        expect(input).toMatchObject({
          operation: "chamfer",
          edgeStableId: "generated:edge:body:1:start:uMin",
          distance: 0.2,
          linearDeflection: 0.1
        });

        return {
          primitive: "edgeFinish",
          positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
          indices: new Uint32Array([0, 1, 2]),
          vertexCount: 3,
          triangleCount: 1,
          faceCount: 1
        };
      }
    };

    const response = await executeGeometryKernelRequestWithMeshFactory(
      factories,
      {
        id: "geometry_req_injected_edge_finish",
        version: "geometry-kernel.v1",
        op: "geometry.edgeFinish",
        operation: "chamfer",
        target: {
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [0, 0],
            width: 2,
            height: 2
          },
          depth: 2
        },
        edgeStableId: "generated:edge:body:1:start:uMin",
        distance: 0.2,
        tessellation: {
          linearDeflection: 0.1
        }
      }
    );

    expect(response).toEqual({
      ok: true,
      id: "geometry_req_injected_edge_finish",
      op: "geometry.edgeFinish",
      mesh: {
        primitive: "edgeFinish",
        positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
        indices: new Uint32Array([0, 1, 2]),
        vertexCount: 3,
        triangleCount: 1,
        faceCount: 1
      },
      warnings: []
    });
  });

  it("returns structured unavailable-binding errors when hole factory is absent", async () => {
    const unusedFactory = async () => {
      throw new Error("Unexpected mesh factory call.");
    };
    const factories: GeometryKernelMeshFactories = {
      createBoxMesh: unusedFactory,
      createCylinderMesh: unusedFactory,
      createSphereMesh: unusedFactory,
      createConeMesh: unusedFactory,
      createTorusMesh: unusedFactory,
      createBooleanExtrudeMesh: unusedFactory
    };

    const response = await executeGeometryKernelRequestWithMeshFactory(
      factories,
      {
        id: "geometry_req_unavailable_hole",
        version: "geometry-kernel.v1",
        op: "geometry.hole",
        target: {
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [0, 0],
            width: 2,
            height: 2
          },
          depth: 2
        },
        tool: {
          sketchPlane: "XY",
          circle: {
            kind: "circle",
            center: [0, 0],
            radius: 0.25
          },
          depthMode: "blind",
          depth: 1
        }
      }
    );

    expect(response).toEqual({
      ok: false,
      id: "geometry_req_unavailable_hole",
      op: "geometry.hole",
      error: {
        code: "UNAVAILABLE_BINDING",
        message: "Hole tessellation requires an OCCT hole mesh factory."
      },
      warnings: []
    });
  });

  it("returns structured unavailable-binding errors when edge-finish factory is absent", async () => {
    const unusedFactory = async () => {
      throw new Error("Unexpected mesh factory call.");
    };
    const factories: GeometryKernelMeshFactories = {
      createBoxMesh: unusedFactory,
      createCylinderMesh: unusedFactory,
      createSphereMesh: unusedFactory,
      createConeMesh: unusedFactory,
      createTorusMesh: unusedFactory,
      createBooleanExtrudeMesh: unusedFactory
    };

    const response = await executeGeometryKernelRequestWithMeshFactory(
      factories,
      {
        id: "geometry_req_unavailable_edge_finish",
        version: "geometry-kernel.v1",
        op: "geometry.edgeFinish",
        operation: "fillet",
        target: {
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [0, 0],
            width: 2,
            height: 2
          },
          depth: 2
        },
        edgeStableId: "generated:edge:body:1:end:vMax",
        radius: 0.2
      }
    );

    expect(response).toEqual({
      ok: false,
      id: "geometry_req_unavailable_edge_finish",
      op: "geometry.edgeFinish",
      error: {
        code: "UNAVAILABLE_BINDING",
        message:
          "Edge finish tessellation requires an OCCT edge-finish mesh factory."
      },
      warnings: []
    });
  });

  it("returns revolve meshes from an injected factory", async () => {
    const unusedFactory = async () => {
      throw new Error("Unexpected mesh factory call.");
    };
    const factories: GeometryKernelMeshFactories = {
      createBoxMesh: unusedFactory,
      createCylinderMesh: unusedFactory,
      createSphereMesh: unusedFactory,
      createConeMesh: unusedFactory,
      createTorusMesh: unusedFactory,
      createBooleanExtrudeMesh: unusedFactory,
      createRevolveProfileMesh: async () => ({
        primitive: "revolve",
        positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
        indices: new Uint32Array([0, 1, 2]),
        vertexCount: 3,
        triangleCount: 1,
        faceCount: 1
      })
    };

    const response = await executeGeometryKernelRequestWithMeshFactory(
      factories,
      {
        id: "geometry_req_injected_revolve",
        version: "geometry-kernel.v1",
        op: "geometry.revolveProfile",
        sketchPlane: "XY",
        profile: {
          kind: "rectangle",
          center: [1, 0],
          width: 2,
          height: 3
        },
        axis: {
          start: [0, -1],
          end: [0, 1]
        },
        angleDegrees: 90
      }
    );

    expect(response).toEqual({
      ok: true,
      id: "geometry_req_injected_revolve",
      op: "geometry.revolveProfile",
      mesh: {
        primitive: "revolve",
        positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
        indices: new Uint32Array([0, 1, 2]),
        vertexCount: 3,
        triangleCount: 1,
        faceCount: 1
      },
      warnings: []
    });
  });

  it("returns structured unavailable-binding errors when revolve factory is absent", async () => {
    const unusedFactory = async () => {
      throw new Error("Unexpected mesh factory call.");
    };
    const factories: GeometryKernelMeshFactories = {
      createBoxMesh: unusedFactory,
      createCylinderMesh: unusedFactory,
      createSphereMesh: unusedFactory,
      createConeMesh: unusedFactory,
      createTorusMesh: unusedFactory,
      createBooleanExtrudeMesh: unusedFactory
    };

    const response = await executeGeometryKernelRequestWithMeshFactory(
      factories,
      {
        id: "geometry_req_unavailable_revolve",
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
        angleDegrees: 180
      }
    );

    expect(response).toEqual({
      ok: false,
      id: "geometry_req_unavailable_revolve",
      op: "geometry.revolveProfile",
      error: {
        code: "UNAVAILABLE_BINDING",
        message:
          "Revolve profile tessellation requires an OCCT revolve mesh factory."
      },
      warnings: []
    });
  });

  it("returns exact metadata from an injected metadata factory", async () => {
    const unusedFactory = async () => {
      throw new Error("Unexpected mesh factory call.");
    };
    const factories: GeometryKernelMeshFactories = {
      createBoxMesh: unusedFactory,
      createCylinderMesh: unusedFactory,
      createSphereMesh: unusedFactory,
      createConeMesh: unusedFactory,
      createTorusMesh: unusedFactory,
      createBooleanExtrudeMesh: unusedFactory,
      createExactBodyMetadata: async (input) => ({
        sourceKind: input.source.kind,
        bounds: {
          min: [0, 0, 0],
          max: [2, 3, 4]
        },
        volume: 24,
        surfaceArea: 52,
        centroid: [1, 1.5, 2],
        topologyCounts: {
          solidCount: 1,
          faceCount: 6,
          edgeCount: 12,
          vertexCount: 8
        },
        measurementSource: "kernel-derived",
        measurementConfidence: "kernel-derived",
        diagnostics: [
          {
            code: "TEST_DIAGNOSTIC",
            message: "Metadata came from the injected test factory."
          }
        ]
      })
    };

    const response = await executeGeometryKernelRequestWithMeshFactory(
      factories,
      {
        id: "geometry_req_injected_exact_metadata",
        version: "geometry-kernel.v1",
        op: "geometry.exactBodyMetadata",
        source: {
          kind: "booleanExtrudes",
          operation: "add",
          target: {
            sketchPlane: "XY",
            profile: {
              kind: "rectangle",
              center: [0, 0],
              width: 2,
              height: 3
            },
            depth: 4
          },
          tool: {
            sketchPlane: "XY",
            profile: {
              kind: "rectangle",
              center: [1, 0],
              width: 2,
              height: 3
            },
            depth: 4
          }
        }
      }
    );

    expect(response).toEqual({
      ok: true,
      id: "geometry_req_injected_exact_metadata",
      op: "geometry.exactBodyMetadata",
      metadata: {
        sourceKind: "booleanExtrudes",
        bounds: {
          min: [0, 0, 0],
          max: [2, 3, 4]
        },
        volume: 24,
        surfaceArea: 52,
        centroid: [1, 1.5, 2],
        topologyCounts: {
          solidCount: 1,
          faceCount: 6,
          edgeCount: 12,
          vertexCount: 8
        },
        measurementSource: "kernel-derived",
        measurementConfidence: "kernel-derived",
        diagnostics: [
          {
            code: "TEST_DIAGNOSTIC",
            message: "Metadata came from the injected test factory."
          }
        ]
      },
      warnings: []
    });
    expect(getGeometryResponseTransferables(response)).toEqual([]);
  });

  it("returns exact metadata for revolve sources from an injected metadata factory", async () => {
    const unusedFactory = async () => {
      throw new Error("Unexpected mesh factory call.");
    };
    const factories: GeometryKernelMeshFactories = {
      createBoxMesh: unusedFactory,
      createCylinderMesh: unusedFactory,
      createSphereMesh: unusedFactory,
      createConeMesh: unusedFactory,
      createTorusMesh: unusedFactory,
      createBooleanExtrudeMesh: unusedFactory,
      createExactBodyMetadata: async (input) => ({
        sourceKind: input.source.kind,
        bounds: {
          min: [-2.5, -1.5, -2.5],
          max: [2.5, 1.5, 2.5]
        },
        volume: 37.7,
        surfaceArea: 100.5,
        centroid: [0, 0, 0],
        topologyCounts: {
          solidCount: 1,
          faceCount: 6,
          edgeCount: 12,
          vertexCount: 8
        },
        measurementSource: "kernel-derived",
        measurementConfidence: "kernel-derived",
        diagnostics: []
      })
    };

    const response = await executeGeometryKernelRequestWithMeshFactory(
      factories,
      {
        id: "geometry_req_injected_revolve_exact_metadata",
        version: "geometry-kernel.v1",
        op: "geometry.exactBodyMetadata",
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
      }
    );

    expect(response).toMatchObject({
      ok: true,
      id: "geometry_req_injected_revolve_exact_metadata",
      op: "geometry.exactBodyMetadata",
      metadata: {
        sourceKind: "revolve",
        volume: 37.7,
        measurementSource: "kernel-derived",
        measurementConfidence: "kernel-derived"
      },
      warnings: []
    });
  });

  it("returns exact metadata for hole sources from an injected metadata factory", async () => {
    const unusedFactory = async () => {
      throw new Error("Unexpected mesh factory call.");
    };
    const factories: GeometryKernelMeshFactories = {
      createBoxMesh: unusedFactory,
      createCylinderMesh: unusedFactory,
      createSphereMesh: unusedFactory,
      createConeMesh: unusedFactory,
      createTorusMesh: unusedFactory,
      createBooleanExtrudeMesh: unusedFactory,
      createExactBodyMetadata: async (input) => ({
        sourceKind: input.source.kind,
        bounds: {
          min: [-3, -2, 0],
          max: [3, 2, 3]
        },
        volume: 70.4,
        surfaceArea: 80.2,
        centroid: [0, 0, 1.55],
        topologyCounts: {
          solidCount: 1,
          faceCount: 8,
          edgeCount: 18,
          vertexCount: 10
        },
        measurementSource: "kernel-derived",
        measurementConfidence: "kernel-derived",
        diagnostics: []
      })
    };

    const response = await executeGeometryKernelRequestWithMeshFactory(
      factories,
      {
        id: "geometry_req_injected_hole_exact_metadata",
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
            depth: 3
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
    );

    expect(response).toMatchObject({
      ok: true,
      id: "geometry_req_injected_hole_exact_metadata",
      op: "geometry.exactBodyMetadata",
      metadata: {
        sourceKind: "hole",
        volume: 70.4,
        measurementSource: "kernel-derived",
        measurementConfidence: "kernel-derived"
      },
      warnings: []
    });
  });

  it("returns exact metadata for edge-finish sources from an injected metadata factory", async () => {
    const unusedFactory = async () => {
      throw new Error("Unexpected mesh factory call.");
    };
    const factories: GeometryKernelMeshFactories = {
      createBoxMesh: unusedFactory,
      createCylinderMesh: unusedFactory,
      createSphereMesh: unusedFactory,
      createConeMesh: unusedFactory,
      createTorusMesh: unusedFactory,
      createBooleanExtrudeMesh: unusedFactory,
      createExactBodyMetadata: async (input) => ({
        sourceKind: input.source.kind,
        bounds: {
          min: [-3, -2, 0],
          max: [3, 2, 4]
        },
        volume: 95.8,
        surfaceArea: 88.4,
        centroid: [0, 0, 2],
        topologyCounts: {
          solidCount: 1,
          faceCount: 7,
          edgeCount: 15,
          vertexCount: 10
        },
        measurementSource: "kernel-derived",
        measurementConfidence: "kernel-derived",
        diagnostics: []
      })
    };

    const response = await executeGeometryKernelRequestWithMeshFactory(
      factories,
      {
        id: "geometry_req_injected_edge_finish_exact_metadata",
        version: "geometry-kernel.v1",
        op: "geometry.exactBodyMetadata",
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
      }
    );

    expect(response).toMatchObject({
      ok: true,
      id: "geometry_req_injected_edge_finish_exact_metadata",
      op: "geometry.exactBodyMetadata",
      metadata: {
        sourceKind: "edgeFinish",
        volume: 95.8,
        measurementSource: "kernel-derived",
        measurementConfidence: "kernel-derived"
      },
      warnings: []
    });
  });

  it("returns structured unavailable-binding errors when exact metadata factory is absent", async () => {
    const unusedFactory = async () => {
      throw new Error("Unexpected mesh factory call.");
    };
    const factories: GeometryKernelMeshFactories = {
      createBoxMesh: unusedFactory,
      createCylinderMesh: unusedFactory,
      createSphereMesh: unusedFactory,
      createConeMesh: unusedFactory,
      createTorusMesh: unusedFactory,
      createBooleanExtrudeMesh: unusedFactory
    };

    const response = await executeGeometryKernelRequestWithMeshFactory(
      factories,
      {
        id: "geometry_req_unavailable_exact_metadata",
        version: "geometry-kernel.v1",
        op: "geometry.exactBodyMetadata",
        source: {
          kind: "extrude",
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [0, 0],
            width: 2,
            height: 3
          },
          depth: 4
        }
      }
    );

    expect(response).toEqual({
      ok: false,
      id: "geometry_req_unavailable_exact_metadata",
      op: "geometry.exactBodyMetadata",
      error: {
        code: "UNAVAILABLE_BINDING",
        message:
          "Exact body metadata requires an exact metadata factory with OCCT mass-property and bounds bindings."
      },
      warnings: []
    });

    const edgeFinishResponse =
      await executeGeometryKernelRequestWithMeshFactory(factories, {
        id: "geometry_req_unavailable_edge_finish_exact_metadata",
        version: "geometry-kernel.v1",
        op: "geometry.exactBodyMetadata",
        source: {
          kind: "edgeFinish",
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
          distance: 0.25
        }
      });

    expect(edgeFinishResponse).toMatchObject({
      ok: false,
      id: "geometry_req_unavailable_edge_finish_exact_metadata",
      op: "geometry.exactBodyMetadata",
      error: {
        code: "UNAVAILABLE_BINDING"
      },
      warnings: []
    });
  });

  it("returns structured validation errors for unsupported exact metadata sources", async () => {
    const response = await executeGeometryKernelRequest({
      id: "geometry_req_bad_exact_metadata",
      version: "geometry-kernel.v1",
      op: "geometry.exactBodyMetadata",
      source: {
        kind: "booleanExtrudes",
        operation: "add",
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
            height: 2
          },
          depth: 4
        }
      }
    });

    expect(response).toEqual({
      ok: false,
      id: "geometry_req_bad_exact_metadata",
      op: "geometry.exactBodyMetadata",
      error: {
        code: "INVALID_DIMENSIONS",
        message:
          "Exact body metadata requests require supported extrude, booleanExtrudes, revolve, hole, or edgeFinish source data with finite positive dimensions."
      },
      warnings: []
    });

    const rectangleTarget = {
      sketchPlane: "XY" as const,
      profile: {
        kind: "rectangle" as const,
        center: [0, 0] as const,
        width: 4,
        height: 4
      },
      depth: 4
    };
    const circleTarget = await executeGeometryKernelRequest({
      id: "geometry_req_bad_exact_edge_finish_circle_target",
      version: "geometry-kernel.v1",
      op: "geometry.exactBodyMetadata",
      source: {
        kind: "edgeFinish",
        operation: "chamfer",
        target: {
          sketchPlane: "XY",
          profile: {
            kind: "circle",
            center: [0, 0],
            radius: 2
          },
          depth: 4
        },
        edgeStableId: "generated:edge:body:1:start:circular",
        distance: 0.25
      }
    });
    const circularEdge = await executeGeometryKernelRequest({
      id: "geometry_req_bad_exact_edge_finish_circular_edge",
      version: "geometry-kernel.v1",
      op: "geometry.exactBodyMetadata",
      source: {
        kind: "edgeFinish",
        operation: "fillet",
        target: rectangleTarget,
        edgeStableId: "generated:edge:body:1:start:circular",
        radius: 0.25
      }
    });
    const tooLarge = await executeGeometryKernelRequest({
      id: "geometry_req_bad_exact_edge_finish_too_large",
      version: "geometry-kernel.v1",
      op: "geometry.exactBodyMetadata",
      source: {
        kind: "edgeFinish",
        operation: "fillet",
        target: rectangleTarget,
        edgeStableId: "generated:edge:body:1:start:uMin",
        radius: 3
      }
    });

    expect(circleTarget).toMatchObject({
      ok: false,
      id: "geometry_req_bad_exact_edge_finish_circle_target",
      op: "geometry.exactBodyMetadata",
      error: { code: "UNSUPPORTED_PROFILE" },
      warnings: []
    });
    expect(circularEdge).toMatchObject({
      ok: false,
      id: "geometry_req_bad_exact_edge_finish_circular_edge",
      op: "geometry.exactBodyMetadata",
      error: { code: "UNSUPPORTED_EDGE" },
      warnings: []
    });
    expect(tooLarge).toMatchObject({
      ok: false,
      id: "geometry_req_bad_exact_edge_finish_too_large",
      op: "geometry.exactBodyMetadata",
      error: { code: "EDGE_FINISH_TOO_LARGE" },
      warnings: []
    });
  });

  it("returns structured validation errors before calling the kernel", async () => {
    const response = await executeGeometryKernelRequest({
      id: "geometry_req_bad_dimensions",
      version: "geometry-kernel.v1",
      op: "geometry.tessellateBox",
      dimensions: {
        width: 0,
        height: 20,
        depth: 30
      }
    });

    expect(response).toEqual({
      ok: false,
      id: "geometry_req_bad_dimensions",
      op: "geometry.tessellateBox",
      error: {
        code: "INVALID_DIMENSIONS",
        message: "Box dimensions must be finite numbers greater than zero."
      },
      warnings: []
    });
  });

  it("returns structured cylinder validation errors before calling the kernel", async () => {
    const response = await executeGeometryKernelRequest({
      id: "geometry_req_bad_cylinder",
      version: "geometry-kernel.v1",
      op: "geometry.tessellateCylinder",
      dimensions: {
        radius: 0,
        height: 30
      }
    });

    expect(response).toEqual({
      ok: false,
      id: "geometry_req_bad_cylinder",
      op: "geometry.tessellateCylinder",
      error: {
        code: "INVALID_DIMENSIONS",
        message: "Cylinder dimensions must be finite numbers greater than zero."
      },
      warnings: []
    });
  });

  it("returns structured sphere validation errors before calling the kernel", async () => {
    const response = await executeGeometryKernelRequest({
      id: "geometry_req_bad_sphere",
      version: "geometry-kernel.v1",
      op: "geometry.tessellateSphere",
      dimensions: {
        radius: 0
      }
    });

    expect(response).toEqual({
      ok: false,
      id: "geometry_req_bad_sphere",
      op: "geometry.tessellateSphere",
      error: {
        code: "INVALID_DIMENSIONS",
        message: "Sphere dimensions must be finite numbers greater than zero."
      },
      warnings: []
    });
  });

  it("returns structured cone and torus validation errors before calling the kernel", async () => {
    const cone = await executeGeometryKernelRequest({
      id: "geometry_req_bad_cone",
      version: "geometry-kernel.v1",
      op: "geometry.tessellateCone",
      dimensions: {
        radius: 0,
        height: 5
      }
    });
    const torus = await executeGeometryKernelRequest({
      id: "geometry_req_bad_torus",
      version: "geometry-kernel.v1",
      op: "geometry.tessellateTorus",
      dimensions: {
        majorRadius: 1,
        minorRadius: 1
      }
    });

    expect(cone).toEqual({
      ok: false,
      id: "geometry_req_bad_cone",
      op: "geometry.tessellateCone",
      error: {
        code: "INVALID_DIMENSIONS",
        message: "Cone dimensions must be finite numbers greater than zero."
      },
      warnings: []
    });
    expect(torus).toEqual({
      ok: false,
      id: "geometry_req_bad_torus",
      op: "geometry.tessellateTorus",
      error: {
        code: "INVALID_DIMENSIONS",
        message:
          "Torus dimensions must be finite numbers greater than zero with minorRadius smaller than majorRadius."
      },
      warnings: []
    });
  });

  it("returns structured revolve validation errors before calling the kernel", async () => {
    const zeroAxis = await executeGeometryKernelRequest({
      id: "geometry_req_bad_revolve_axis",
      version: "geometry-kernel.v1",
      op: "geometry.revolveProfile",
      sketchPlane: "XY",
      profile: {
        kind: "rectangle",
        center: [1, 0],
        width: 2,
        height: 3
      },
      axis: {
        start: [0, 0],
        end: [0, 0]
      },
      angleDegrees: 90
    });
    const badAngle = await executeGeometryKernelRequest({
      id: "geometry_req_bad_revolve_angle",
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
      angleDegrees: 361
    });

    expect(zeroAxis).toEqual({
      ok: false,
      id: "geometry_req_bad_revolve_axis",
      op: "geometry.revolveProfile",
      error: {
        code: "INVALID_DIMENSIONS",
        message:
          "Revolve profile requests require a supported sketch plane, rectangle or circle profile, non-zero finite axis, and positive finite angle no greater than 360 degrees."
      },
      warnings: []
    });
    expect(badAngle).toEqual({
      ok: false,
      id: "geometry_req_bad_revolve_angle",
      op: "geometry.revolveProfile",
      error: {
        code: "INVALID_DIMENSIONS",
        message:
          "Revolve profile requests require a supported sketch plane, rectangle or circle profile, non-zero finite axis, and positive finite angle no greater than 360 degrees."
      },
      warnings: []
    });
  });
});

function getMeshBounds(positions: Float32Array): {
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
} {
  const points: Array<readonly [number, number, number]> = [];

  for (let index = 0; index < positions.length; index += 3) {
    points.push([
      cleanNumber(positions[index]),
      cleanNumber(positions[index + 1]),
      cleanNumber(positions[index + 2])
    ]);
  }

  return {
    min: [
      Math.min(...points.map((point) => point[0])),
      Math.min(...points.map((point) => point[1])),
      Math.min(...points.map((point) => point[2]))
    ],
    max: [
      Math.max(...points.map((point) => point[0])),
      Math.max(...points.map((point) => point[1])),
      Math.max(...points.map((point) => point[2]))
    ]
  };
}

function expectBooleanBounds(
  actual: {
    readonly min: readonly [number, number, number];
    readonly max: readonly [number, number, number];
  },
  expected: {
    readonly min: readonly [number, number, number];
    readonly max: readonly [number, number, number];
  },
  exactAxes: readonly number[]
): void {
  for (let index = 0; index < 3; index += 1) {
    if (exactAxes.includes(index)) {
      expect(actual.min[index]).toBeCloseTo(expected.min[index], 6);
      expect(actual.max[index]).toBeCloseTo(expected.max[index], 6);
    } else {
      expect(actual.min[index]).toBeGreaterThanOrEqual(expected.min[index]);
      expect(actual.max[index]).toBeLessThanOrEqual(expected.max[index]);
      expect(Math.abs(actual.min[index] - expected.min[index])).toBeLessThan(
        0.25
      );
      expect(Math.abs(actual.max[index] - expected.max[index])).toBeLessThan(
        0.25
      );
    }
  }
}

function cleanNumber(value: number): number {
  const rounded = Math.round(value * 1e6) / 1e6;
  return Object.is(rounded, -0) ? 0 : rounded;
}
