import { describe, expect, it } from "vitest";
import {
  executeGeometryKernelRequest,
  getGeometryResponseTransferables
} from "./index";

describe("geometry-kernel facade", () => {
  it("tessellates a box through the isolated OCCT spike", async () => {
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
});
