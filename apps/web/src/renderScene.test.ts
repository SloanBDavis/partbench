import type { BoxObject, CylinderObject } from "@web-cad/cad-core";
import type { RenderTriangleMesh } from "@web-cad/renderer";
import { describe, expect, it } from "vitest";
import type { DerivedGeometryEntry } from "./derivedGeometry";
import { createRenderSceneInputs } from "./renderScene";

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
    expect(scene.meshes).toEqual([mesh]);
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
