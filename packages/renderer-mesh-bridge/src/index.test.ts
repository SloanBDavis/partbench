import {
  createBoxTessellationWorkerRequest,
  createCylinderTessellationWorkerRequest,
  createSphereTessellationWorkerRequest,
  GeometryKernelWorker
} from "@web-cad/geometry-worker";
import { describe, expect, it } from "vitest";
import {
  createRenderMeshFromGeometryWorkerResponse,
  createRenderMeshFromSerializableMesh
} from "./index";

describe("renderer mesh bridge", () => {
  it("converts serializable mesh positions and indices into a render mesh", () => {
    const result = createRenderMeshFromSerializableMesh(
      {
        primitive: "box",
        positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
        indices: new Uint32Array([0, 1, 2]),
        vertexCount: 3,
        triangleCount: 1,
        faceCount: 1
      },
      {
        id: "mesh_box_1",
        label: "Tessellated box"
      }
    );

    expect(result).toMatchObject({
      version: "renderer-mesh-bridge.v1",
      vertexCount: 3,
      triangleCount: 1,
      bounds: {
        min: [0, 0, 0],
        max: [1, 1, 0]
      },
      mesh: {
        id: "mesh_box_1",
        kind: "mesh",
        indices: [0, 1, 2],
        label: "Tessellated box"
      }
    });
    expect(result.mesh.vertices).toEqual([
      [0, 0, 0],
      [1, 0, 0],
      [0, 1, 0]
    ]);
  });

  it("adapts a tessellated box response from the geometry worker", async () => {
    const worker = new GeometryKernelWorker();
    const response = await worker.execute(
      createBoxTessellationWorkerRequest({
        id: "mesh_bridge_req_box",
        width: 2,
        height: 4,
        depth: 6
      })
    );
    const result = createRenderMeshFromGeometryWorkerResponse(response, {
      id: "mesh_box_from_worker"
    });

    expect(result.mesh.id).toBe("mesh_box_from_worker");
    expect(result.mesh.kind).toBe("mesh");
    expect(result.vertexCount).toBe(24);
    expect(result.triangleCount).toBe(12);
    expect(result.bounds).toEqual({
      min: [0, 0, 0],
      max: [2, 4, 6]
    });
  });

  it("adapts a tessellated cylinder response from the geometry worker", async () => {
    const worker = new GeometryKernelWorker();
    const response = await worker.execute(
      createCylinderTessellationWorkerRequest({
        id: "mesh_bridge_req_cylinder",
        radius: 2,
        height: 6
      })
    );
    const result = createRenderMeshFromGeometryWorkerResponse(response, {
      id: "mesh_cylinder_from_worker"
    });

    expect(result.mesh.id).toBe("mesh_cylinder_from_worker");
    expect(result.mesh.kind).toBe("mesh");
    expect(result.vertexCount).toBeGreaterThan(0);
    expect(result.triangleCount).toBeGreaterThan(0);
    expect(result.bounds.min[0]).toBeLessThanOrEqual(-2);
    expect(result.bounds.max[0]).toBeGreaterThanOrEqual(2);
    expect(result.bounds.min[2]).toBe(0);
    expect(result.bounds.max[2]).toBe(6);
  });

  it("adapts a tessellated sphere response from the geometry worker", async () => {
    const worker = new GeometryKernelWorker();
    const response = await worker.execute(
      createSphereTessellationWorkerRequest({
        id: "mesh_bridge_req_sphere",
        radius: 2
      })
    );
    const result = createRenderMeshFromGeometryWorkerResponse(response, {
      id: "mesh_sphere_from_worker"
    });

    expect(result.mesh.id).toBe("mesh_sphere_from_worker");
    expect(result.mesh.kind).toBe("mesh");
    expect(result.vertexCount).toBeGreaterThan(0);
    expect(result.triangleCount).toBeGreaterThan(0);
    expect(result.bounds.min[0]).toBeLessThan(-1.9);
    expect(result.bounds.max[0]).toBeGreaterThan(1.9);
  });

  it("can center corner-origin box meshes for the current primitive renderer", async () => {
    const worker = new GeometryKernelWorker();
    const response = await worker.execute(
      createBoxTessellationWorkerRequest({
        id: "mesh_bridge_req_centered_box",
        width: 2,
        height: 4,
        depth: 6
      })
    );
    const result = createRenderMeshFromGeometryWorkerResponse(response, {
      id: "centered_mesh_box",
      alignment: "boundsCenter"
    });

    expect(result.bounds).toEqual({
      min: [-1, -2, -3],
      max: [1, 2, 3]
    });
  });

  it("rejects malformed mesh data before it reaches the renderer", () => {
    expect(() =>
      createRenderMeshFromSerializableMesh(
        {
          primitive: "box",
          positions: new Float32Array([0, 0, 0]),
          indices: new Uint32Array([0, 1, 2]),
          vertexCount: 1,
          triangleCount: 1,
          faceCount: 1
        },
        { id: "bad_mesh" }
      )
    ).toThrow("Mesh indices must reference existing vertices.");
  });
});
