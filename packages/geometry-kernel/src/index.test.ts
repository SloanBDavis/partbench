import { describe, expect, it } from "vitest";
import {
  executeGeometryKernelRequest,
  getGeometryResponseTransferables
} from "./index";

describe("geometry-kernel facade", () => {
  it("tessellates a box through the isolated OCCT WASM adapter", async () => {
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
    expect(response.mesh.positions).toHaveLength(response.mesh.vertexCount * 3);
    expect(response.mesh.indices).toHaveLength(response.mesh.triangleCount * 3);
    expect(getGeometryResponseTransferables(response)).toEqual([
      response.mesh.positions.buffer,
      response.mesh.indices.buffer
    ]);
  });

  it("tessellates a cylinder through the isolated OCCT WASM adapter", async () => {
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
    expect(response.mesh.positions).toHaveLength(response.mesh.vertexCount * 3);
    expect(response.mesh.indices).toHaveLength(response.mesh.triangleCount * 3);
    expect(getGeometryResponseTransferables(response)).toEqual([
      response.mesh.positions.buffer,
      response.mesh.indices.buffer
    ]);
  });

  it("tessellates a sphere through the isolated OCCT WASM adapter", async () => {
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
    expect(response.mesh.positions).toHaveLength(response.mesh.vertexCount * 3);
    expect(response.mesh.indices).toHaveLength(response.mesh.triangleCount * 3);
    expect(getGeometryResponseTransferables(response)).toEqual([
      response.mesh.positions.buffer,
      response.mesh.indices.buffer
    ]);
  });

  it("tessellates cone and torus primitives through the isolated OCCT WASM adapter", async () => {
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
  });

  it("tessellates rectangle and circle extrudes through the isolated OCCT WASM adapter", async () => {
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

function cleanNumber(value: number): number {
  const rounded = Math.round(value * 1e6) / 1e6;
  return Object.is(rounded, -0) ? 0 : rounded;
}
