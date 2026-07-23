import {
  createBoxTessellationWorkerRequest,
  createConeTessellationWorkerRequest,
  createCylinderTessellationWorkerRequest,
  createSphereTessellationWorkerRequest,
  createTorusTessellationWorkerRequest,
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
    expect(result.mesh).not.toHaveProperty("source");
  });

  it("preserves generated-reference evidence without adding it to render meshes", () => {
    const generatedReferences = {
      status: "ready" as const,
      sourceIdentity: "wire:sketch_1:line_1,arc_1",
      faces: [
        {
          role: "side" as const,
          sourceEntityId: "arc_1",
          surfaceClass: "cylinder" as const,
          evidence: "kernel-builder" as const
        }
      ],
      edges: []
    };
    const result = createRenderMeshFromSerializableMesh(
      {
        primitive: "extrude",
        positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
        indices: new Uint32Array([0, 1, 2]),
        vertexCount: 3,
        triangleCount: 1,
        faceCount: 1,
        generatedReferences
      },
      { id: "mesh_wire_extrude" }
    );

    expect(result.generatedReferences).toEqual(generatedReferences);
    expect(result.mesh).not.toHaveProperty("generatedReferences");
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
  }, 30000);

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
  }, 30000);

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
  }, 30000);

  it("adapts tessellated cone and torus responses from the geometry worker", async () => {
    const worker = new GeometryKernelWorker();
    const coneResponse = await worker.execute(
      createConeTessellationWorkerRequest({
        id: "mesh_bridge_req_cone",
        radius: 2,
        height: 5
      })
    );
    const torusResponse = await worker.execute(
      createTorusTessellationWorkerRequest({
        id: "mesh_bridge_req_torus",
        majorRadius: 3,
        minorRadius: 0.5
      })
    );
    const cone = createRenderMeshFromGeometryWorkerResponse(coneResponse, {
      id: "mesh_cone_from_worker"
    });
    const torus = createRenderMeshFromGeometryWorkerResponse(torusResponse, {
      id: "mesh_torus_from_worker"
    });

    expect(cone.mesh.id).toBe("mesh_cone_from_worker");
    expect(cone.vertexCount).toBeGreaterThan(0);
    expect(cone.triangleCount).toBeGreaterThan(0);
    expect(torus.mesh.id).toBe("mesh_torus_from_worker");
    expect(torus.vertexCount).toBeGreaterThan(0);
    expect(torus.triangleCount).toBeGreaterThan(0);
  }, 30000);

  it("adapts boolean mesh responses from the geometry worker", () => {
    const result = createRenderMeshFromGeometryWorkerResponse(
      {
        id: "mesh_bridge_req_boolean",
        version: "geometry-worker.v1",
        kind: "geometry-worker.booleanFeature",
        payloadId: "mesh_bridge_boolean_payload",
        response: {
          ok: true,
          id: "mesh_bridge_boolean_payload",
          op: "geometry.booleanExtrudes",
          mesh: {
            primitive: "boolean",
            positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
            indices: new Uint32Array([0, 1, 2]),
            vertexCount: 3,
            triangleCount: 1,
            faceCount: 1
          },
          warnings: []
        },
        transferables: []
      },
      { id: "mesh_boolean_from_worker", alignment: "source" }
    );

    expect(result).toMatchObject({
      vertexCount: 3,
      triangleCount: 1,
      bounds: {
        min: [0, 0, 0],
        max: [1, 1, 0]
      },
      mesh: {
        id: "mesh_boolean_from_worker",
        kind: "mesh",
        indices: [0, 1, 2],
        source: "geometry-worker.booleanFeature"
      }
    });
  });

  it("adapts hole mesh responses from the geometry worker", () => {
    const result = createRenderMeshFromGeometryWorkerResponse(
      {
        id: "mesh_bridge_req_hole",
        version: "geometry-worker.v1",
        kind: "geometry-worker.booleanFeature",
        payloadId: "mesh_bridge_hole_payload",
        response: {
          ok: true,
          id: "mesh_bridge_hole_payload",
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
        },
        transferables: []
      },
      { id: "mesh_hole_from_worker", alignment: "source" }
    );

    expect(result).toMatchObject({
      vertexCount: 3,
      triangleCount: 1,
      mesh: {
        id: "mesh_hole_from_worker",
        kind: "mesh",
        indices: [0, 1, 2],
        source: "geometry-worker.booleanFeature"
      }
    });
  });

  it("adapts revolve mesh responses from the geometry worker", () => {
    const result = createRenderMeshFromGeometryWorkerResponse(
      {
        id: "mesh_bridge_req_revolve",
        version: "geometry-worker.v1",
        kind: "geometry-worker.tessellateFeature",
        payloadId: "mesh_bridge_revolve_payload",
        response: {
          ok: true,
          id: "mesh_bridge_revolve_payload",
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
        },
        transferables: []
      },
      { id: "mesh_revolve_from_worker", alignment: "source" }
    );

    expect(result).toMatchObject({
      vertexCount: 3,
      triangleCount: 1,
      mesh: {
        id: "mesh_revolve_from_worker",
        kind: "mesh",
        indices: [0, 1, 2],
        source: "geometry-worker.tessellateFeature"
      }
    });
  });

  it("adapts edge-finish mesh responses from the geometry worker", () => {
    const result = createRenderMeshFromGeometryWorkerResponse(
      {
        id: "mesh_bridge_req_edge_finish",
        version: "geometry-worker.v1",
        kind: "geometry-worker.edgeFinishFeature",
        payloadId: "mesh_bridge_edge_finish_payload",
        response: {
          ok: true,
          id: "mesh_bridge_edge_finish_payload",
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
        },
        transferables: []
      },
      { id: "mesh_edge_finish_from_worker", alignment: "source" }
    );

    expect(result).toMatchObject({
      vertexCount: 3,
      triangleCount: 1,
      mesh: {
        id: "mesh_edge_finish_from_worker",
        kind: "mesh",
        indices: [0, 1, 2],
        source: "geometry-worker.edgeFinishFeature"
      }
    });
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
  }, 30000);

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

  it("rejects invalid mesh counts before decoding numeric buffers", () => {
    const createInvalidMesh = (
      counts: Partial<{
        vertexCount: number;
        triangleCount: number;
        faceCount: number;
      }>
    ) => ({
      primitive: "box" as const,
      positions: new Float32Array(),
      indices: new Uint32Array(),
      vertexCount: 0,
      triangleCount: 0,
      faceCount: 0,
      ...counts
    });

    expect(() =>
      createRenderMeshFromSerializableMesh(
        createInvalidMesh({ vertexCount: 0.5 }),
        { id: "fractional_vertex_count" }
      )
    ).toThrow("Mesh vertex count must be a non-negative integer.");
    expect(() =>
      createRenderMeshFromSerializableMesh(
        createInvalidMesh({ triangleCount: -1 }),
        { id: "negative_triangle_count" }
      )
    ).toThrow("Mesh triangle count must be a non-negative integer.");
    expect(() =>
      createRenderMeshFromSerializableMesh(
        createInvalidMesh({ faceCount: Number.NaN }),
        { id: "invalid_face_count" }
      )
    ).toThrow("Mesh face count must be a non-negative integer.");
  });
});
