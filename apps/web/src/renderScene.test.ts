import type {
  BoxObject,
  ConeObject,
  CylinderObject,
  SphereObject,
  TorusObject
} from "@web-cad/cad-core";
import type { RenderTriangleMesh } from "@web-cad/renderer";
import { describe, expect, it } from "vitest";
import type { DerivedGeometryEntry } from "./derivedGeometry";
import { createMeshDisplayEdges, createRenderSceneInputs } from "./renderScene";

describe("renderScene", () => {
  it("prefers a ready derived mesh over the primitive fallback", () => {
    const box = createBoxObject("box_1");
    const mesh = createMesh("box_1");
    const scene = createRenderSceneInputs(
      [box],
      new Map([
        [
          box.id,
          {
            objectId: box.id,
            objectKind: "box",
            cacheKey: "box-ready",
            status: "ready",
            mesh,
            metrics: {
              objectId: box.id,
              roundTripMs: 1,
              vertexCount: 4,
              triangleCount: 2
            }
          }
        ]
      ])
    );

    expect(scene.primitives).toEqual([]);
    expect(scene.meshes).toEqual([
      {
        ...mesh,
        edgeSegments: createMeshDisplayEdges(box)
      }
    ]);
    expect(scene.meshes[0].edgeSegments).toHaveLength(12);
  });

  it("keeps renderable IDs stable for primitive and mesh selection", () => {
    const box = createBoxObject("selected_box");
    const cylinder = createCylinderObject("selected_cylinder");
    const mesh = createMesh(box.id);
    const scene = createRenderSceneInputs(
      [box, cylinder],
      new Map([
        [
          box.id,
          {
            objectId: box.id,
            objectKind: "box",
            cacheKey: "box-ready",
            status: "ready",
            mesh,
            metrics: {
              objectId: box.id,
              roundTripMs: 1,
              vertexCount: 4,
              triangleCount: 2
            }
          }
        ]
      ])
    );

    expect(scene.meshes.map((renderable) => renderable.id)).toEqual([
      "selected_box"
    ]);
    expect(scene.meshes[0].edgeSegments).toHaveLength(12);
    expect(scene.primitives.map((renderable) => renderable.id)).toEqual([
      "selected_cylinder"
    ]);
  });

  it("adds cylinder display edges to ready derived meshes", () => {
    const cylinder = createCylinderObject("cylinder_1");
    const mesh = createMesh(cylinder.id);
    const scene = createRenderSceneInputs(
      [cylinder],
      new Map([
        [
          cylinder.id,
          {
            objectId: cylinder.id,
            objectKind: "cylinder",
            cacheKey: "cylinder-ready",
            status: "ready",
            mesh,
            metrics: {
              objectId: cylinder.id,
              roundTripMs: 1,
              vertexCount: 4,
              triangleCount: 2
            }
          }
        ]
      ])
    );

    expect(scene.primitives).toEqual([]);
    expect(scene.meshes[0].edgeSegments).toHaveLength(68);
    expect(scene.meshes[0].edgeSegments?.slice(-4)).toEqual([
      {
        start: [1, 0, 1],
        end: [1, 0, -1]
      },
      {
        start: [0, 1, 1],
        end: [0, 1, -1]
      },
      {
        start: [-1, 0, 1],
        end: [-1, 0, -1]
      },
      {
        start: [0, -1, 1],
        end: [0, -1, -1]
      }
    ]);
  });

  it("adds sphere display edges to ready derived meshes", () => {
    const sphere = createSphereObject("sphere_1");
    const mesh = createMesh(sphere.id);
    const scene = createRenderSceneInputs(
      [sphere],
      new Map([
        [
          sphere.id,
          {
            objectId: sphere.id,
            objectKind: "sphere",
            cacheKey: "sphere-ready",
            status: "ready",
            mesh,
            metrics: {
              objectId: sphere.id,
              roundTripMs: 1,
              vertexCount: 4,
              triangleCount: 2
            }
          }
        ]
      ])
    );

    expect(scene.primitives).toEqual([]);
    expect(scene.meshes[0].edgeSegments).toHaveLength(96);
    expect(scene.meshes[0].edgeSegments?.[0]).toEqual({
      start: [1, 0, 0],
      end: [0.980785280403, 0.195090322016, 0]
    });
  });

  it("adds cone and torus display edges to ready derived meshes", () => {
    const cone = createConeObject("cone_1");
    const torus = createTorusObject("torus_1");
    const scene = createRenderSceneInputs(
      [cone, torus],
      new Map([
        [
          cone.id,
          {
            objectId: cone.id,
            objectKind: "cone",
            cacheKey: "cone-ready",
            status: "ready",
            mesh: createMesh(cone.id),
            metrics: {
              objectId: cone.id,
              roundTripMs: 1,
              vertexCount: 4,
              triangleCount: 2
            }
          }
        ],
        [
          torus.id,
          {
            objectId: torus.id,
            objectKind: "torus",
            cacheKey: "torus-ready",
            status: "ready",
            mesh: createMesh(torus.id),
            metrics: {
              objectId: torus.id,
              roundTripMs: 1,
              vertexCount: 4,
              triangleCount: 2
            }
          }
        ]
      ])
    );

    expect(scene.primitives).toEqual([]);
    expect(scene.meshes[0].edgeSegments?.length).toBeGreaterThan(32);
    expect(scene.meshes[1].edgeSegments?.length).toBeGreaterThan(96);
  });

  it("keeps primitive fallback when derived geometry is unavailable", () => {
    const box = createBoxObject("box_1");
    const cylinder = createCylinderObject("cylinder_1");
    const scene = createRenderSceneInputs([box, cylinder], new Map());

    expect(scene.primitives.map((primitive) => primitive.id)).toEqual([
      "box_1",
      "cylinder_1"
    ]);
    expect(scene.meshes).toEqual([]);
  });

  it("keeps primitive fallback for pending, unsupported, and error entries", () => {
    const box = createBoxObject("box_pending");
    const cylinder = createCylinderObject("cylinder_error");
    const unsupportedBox = createBoxObject("box_unsupported");
    const entries = new Map<string, DerivedGeometryEntry>([
      [
        box.id,
        {
          objectId: box.id,
          objectKind: "box",
          cacheKey: "box-pending",
          status: "pending"
        }
      ],
      [
        cylinder.id,
        {
          objectId: cylinder.id,
          objectKind: "cylinder",
          cacheKey: "cylinder-error",
          status: "error",
          error: {
            code: "UNKNOWN_DERIVED_GEOMETRY_ERROR",
            message: "worker failed",
            stage: "unknown",
            wasmLoadStatus: "unknown",
            workerStarted: false
          }
        }
      ],
      [
        unsupportedBox.id,
        {
          objectId: unsupportedBox.id,
          objectKind: "box",
          cacheKey: "unsupported",
          status: "unsupported",
          message: "Unsupported."
        }
      ]
    ]);
    const scene = createRenderSceneInputs(
      [box, cylinder, unsupportedBox],
      entries
    );

    expect(scene.primitives.map((primitive) => primitive.id)).toEqual([
      "box_pending",
      "cylinder_error",
      "box_unsupported"
    ]);
    expect(scene.meshes).toEqual([]);
  });
});

function createBoxObject(id: string): BoxObject {
  return {
    id,
    kind: "box",
    dimensions: {
      width: 2,
      height: 3,
      depth: 4
    },
    transform: {
      translation: [0, 0, 2],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    }
  };
}

function createCylinderObject(id: string): CylinderObject {
  return {
    id,
    kind: "cylinder",
    dimensions: {
      radius: 1,
      height: 2
    },
    transform: {
      translation: [0, 0, 1],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    }
  };
}

function createSphereObject(id: string): SphereObject {
  return {
    id,
    kind: "sphere",
    dimensions: {
      radius: 1
    },
    transform: {
      translation: [0, 0, 1],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    }
  };
}

function createConeObject(id: string): ConeObject {
  return {
    id,
    kind: "cone",
    dimensions: {
      radius: 1,
      height: 2
    },
    transform: {
      translation: [0, 0, 1],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    }
  };
}

function createTorusObject(id: string): TorusObject {
  return {
    id,
    kind: "torus",
    dimensions: {
      majorRadius: 2,
      minorRadius: 0.4
    },
    transform: {
      translation: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    }
  };
}

function createMesh(id: string): RenderTriangleMesh {
  return {
    id,
    kind: "mesh",
    vertices: [
      [-1, -1, 0],
      [1, -1, 0],
      [1, 1, 0],
      [-1, 1, 0]
    ],
    indices: [0, 1, 2, 0, 2, 3],
    transform: {
      translation: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    }
  };
}
