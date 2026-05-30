import { describe, expect, it } from "vitest";
import {
  createOcctBooleanExtrudeMesh,
  createOcctBoxMesh,
  createOcctConeMesh,
  createOcctCylinderMesh,
  createOcctExactBodyMetadata,
  createOcctRevolveProfileMesh,
  createOcctSphereMesh,
  createOcctTorusMesh
} from "./index";

const OCCT_WASM_TEST_TIMEOUT_MS = 120_000;

describe("occt-wasm", () => {
  it(
    "creates and tessellates a box through Open CASCADE WASM",
    async () => {
      const mesh = await createOcctBoxMesh({
        width: 10,
        height: 20,
        depth: 30
      });

      expect(mesh.primitive).toBe("box");
      expect(mesh.faceCount).toBe(6);
      expect(mesh.vertexCount).toBe(24);
      expect(mesh.triangleCount).toBe(12);
      expect(mesh.positions).toBeInstanceOf(Float32Array);
      expect(mesh.indices).toBeInstanceOf(Uint32Array);
      expect(mesh.positions).toHaveLength(mesh.vertexCount * 3);
      expect(mesh.indices).toHaveLength(mesh.triangleCount * 3);
      expect(Math.max(...mesh.positions)).toBe(30);
      expect(Math.min(...mesh.positions)).toBe(0);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "creates and tessellates a cylinder through Open CASCADE WASM",
    async () => {
      const mesh = await createOcctCylinderMesh({
        radius: 10,
        height: 30
      });

      expect(mesh.primitive).toBe("cylinder");
      expect(mesh.faceCount).toBeGreaterThanOrEqual(3);
      expect(mesh.vertexCount).toBeGreaterThan(0);
      expect(mesh.triangleCount).toBeGreaterThan(0);
      expect(mesh.positions).toBeInstanceOf(Float32Array);
      expect(mesh.indices).toBeInstanceOf(Uint32Array);
      expect(mesh.positions).toHaveLength(mesh.vertexCount * 3);
      expect(mesh.indices).toHaveLength(mesh.triangleCount * 3);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "creates and tessellates a sphere through Open CASCADE WASM",
    async () => {
      const mesh = await createOcctSphereMesh({
        radius: 10
      });

      expect(mesh.primitive).toBe("sphere");
      expect(mesh.faceCount).toBeGreaterThan(0);
      expect(mesh.vertexCount).toBeGreaterThan(0);
      expect(mesh.triangleCount).toBeGreaterThan(0);
      expect(mesh.positions).toBeInstanceOf(Float32Array);
      expect(mesh.indices).toBeInstanceOf(Uint32Array);
      expect(mesh.positions).toHaveLength(mesh.vertexCount * 3);
      expect(mesh.indices).toHaveLength(mesh.triangleCount * 3);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "creates and tessellates cone and torus primitives through Open CASCADE WASM",
    async () => {
      const cone = await createOcctConeMesh({
        radius: 2,
        height: 5
      });
      const torus = await createOcctTorusMesh({
        majorRadius: 3,
        minorRadius: 0.5
      });

      expect(cone.primitive).toBe("cone");
      expect(cone.vertexCount).toBeGreaterThan(0);
      expect(cone.triangleCount).toBeGreaterThan(0);
      expect(torus.primitive).toBe("torus");
      expect(torus.vertexCount).toBeGreaterThan(0);
      expect(torus.triangleCount).toBeGreaterThan(0);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "creates a circle-target rectangle-tool boolean cut through Open CASCADE WASM",
    async () => {
      const mesh = await createOcctBooleanExtrudeMesh({
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

      expect(mesh.primitive).toBe("boolean");
      expect(mesh.faceCount).toBeGreaterThan(0);
      expect(mesh.vertexCount).toBeGreaterThan(0);
      expect(mesh.triangleCount).toBeGreaterThan(0);
      expect(mesh.positions).toHaveLength(mesh.vertexCount * 3);
      expect(mesh.indices).toHaveLength(mesh.triangleCount * 3);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "creates and tessellates rectangle and circle revolve profiles through Open CASCADE WASM",
    async () => {
      const rectangle = await createOcctRevolveProfileMesh({
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
      });
      const circle = await createOcctRevolveProfileMesh({
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

      expect(rectangle.primitive).toBe("revolve");
      expect(rectangle.faceCount).toBeGreaterThan(0);
      expect(rectangle.vertexCount).toBeGreaterThan(0);
      expect(rectangle.triangleCount).toBeGreaterThan(0);
      expect(rectangle.positions).toHaveLength(rectangle.vertexCount * 3);
      expect(rectangle.indices).toHaveLength(rectangle.triangleCount * 3);
      expect(circle.primitive).toBe("revolve");
      expect(circle.faceCount).toBeGreaterThan(0);
      expect(circle.vertexCount).toBeGreaterThan(0);
      expect(circle.triangleCount).toBeGreaterThan(0);
      expect(circle.positions).toHaveLength(circle.vertexCount * 3);
      expect(circle.indices).toHaveLength(circle.triangleCount * 3);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "returns exact rectangle extrude metadata through Open CASCADE WASM",
    async () => {
      const metadata = await createOcctExactBodyMetadata({
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

      expect(metadata.sourceKind).toBe("extrude");
      expect(metadata.bounds.min[0]).toBeCloseTo(-1, 6);
      expect(metadata.bounds.min[1]).toBeCloseTo(0.5, 6);
      expect(metadata.bounds.min[2]).toBeCloseTo(0, 6);
      expect(metadata.bounds.max[0]).toBeCloseTo(3, 6);
      expect(metadata.bounds.max[1]).toBeCloseTo(3.5, 6);
      expect(metadata.bounds.max[2]).toBeCloseTo(5, 6);
      expect(metadata.volume).toBeCloseTo(60, 6);
      expect(metadata.surfaceArea).toBeCloseTo(94, 6);
      expect(metadata.centroid).toEqual([1, 2, 2.5]);
      expect(metadata.topologyCounts).toEqual({
        solidCount: 1,
        faceCount: 6,
        edgeCount: 12,
        vertexCount: 8
      });
      expect(metadata.measurementSource).toBe("kernel-derived");
      expect(metadata.measurementConfidence).toBe("kernel-derived");
      expect(metadata.diagnostics).toEqual([]);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "returns exact boolean extrude metadata through Open CASCADE WASM",
    async () => {
      const metadata = await createOcctExactBodyMetadata({
        source: {
          kind: "booleanExtrudes",
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
              center: [0, 0],
              width: 2,
              height: 2
            },
            depth: 4
          }
        }
      });

      expect(metadata.sourceKind).toBe("booleanExtrudes");
      expect(metadata.volume).toBeCloseTo(48, 6);
      expect(metadata.surfaceArea).toBeGreaterThan(0);
      expect(metadata.centroid[0]).toBeCloseTo(0, 6);
      expect(metadata.centroid[1]).toBeCloseTo(0, 6);
      expect(metadata.centroid[2]).toBeCloseTo(2, 6);
      expect(metadata.topologyCounts.solidCount).toBe(1);
      expect(metadata.topologyCounts.faceCount).toBeGreaterThan(0);
      expect(metadata.measurementSource).toBe("kernel-derived");
      expect(metadata.measurementConfidence).toBe("kernel-derived");
      expect(metadata.diagnostics).toEqual([]);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "returns exact revolve metadata through Open CASCADE WASM",
    async () => {
      const metadata = await createOcctExactBodyMetadata({
        source: {
          kind: "revolve",
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
        }
      });

      expect(metadata.sourceKind).toBe("revolve");
      expect(metadata.bounds.min[0]).toBeCloseTo(-2.5, 6);
      expect(metadata.bounds.max[0]).toBeCloseTo(2.5, 6);
      expect(metadata.bounds.min[1]).toBeCloseTo(-1.5, 6);
      expect(metadata.bounds.max[1]).toBeCloseTo(1.5, 6);
      expect(metadata.bounds.min[2]).toBeCloseTo(-2.5, 6);
      expect(metadata.bounds.max[2]).toBeCloseTo(2.5, 6);
      expect(metadata.volume).toBeCloseTo(12 * Math.PI, 6);
      expect(metadata.surfaceArea).toBeCloseTo(32 * Math.PI, 6);
      expect(metadata.centroid[0]).toBeCloseTo(0, 6);
      expect(metadata.centroid[1]).toBeCloseTo(0, 6);
      expect(metadata.centroid[2]).toBeCloseTo(0, 6);
      expect(metadata.topologyCounts.solidCount).toBe(1);
      expect(metadata.topologyCounts.faceCount).toBeGreaterThan(0);
      expect(metadata.measurementSource).toBe("kernel-derived");
      expect(metadata.measurementConfidence).toBe("kernel-derived");
      expect(metadata.diagnostics).toEqual([]);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "returns exact hole metadata through Open CASCADE WASM",
    async () => {
      const metadata = await createOcctExactBodyMetadata({
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

      expect(metadata.sourceKind).toBe("hole");
      expect(metadata.bounds.min[0]).toBeCloseTo(-3, 6);
      expect(metadata.bounds.max[0]).toBeCloseTo(3, 6);
      expect(metadata.bounds.min[1]).toBeCloseTo(-2, 6);
      expect(metadata.bounds.max[1]).toBeCloseTo(2, 6);
      expect(metadata.bounds.min[2]).toBeCloseTo(0, 6);
      expect(metadata.bounds.max[2]).toBeCloseTo(3, 6);
      expect(metadata.volume).toBeCloseTo(72 - Math.PI * 0.5, 5);
      expect(metadata.surfaceArea).toBeGreaterThan(0);
      expect(metadata.centroid[2]).toBeGreaterThan(1.5);
      expect(metadata.topologyCounts.solidCount).toBe(1);
      expect(metadata.topologyCounts.faceCount).toBeGreaterThan(0);
      expect(metadata.measurementSource).toBe("kernel-derived");
      expect(metadata.measurementConfidence).toBe("kernel-derived");
      expect(metadata.diagnostics).toEqual([]);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );
});
