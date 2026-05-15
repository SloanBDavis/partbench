import type { SceneObject } from "@web-cad/cad-core";
import type { RenderPrimitive, RenderTriangleMesh } from "@web-cad/renderer";
import type { DerivedGeometryEntry } from "./derivedGeometry";

export interface RenderSceneInputs {
  readonly primitives: readonly RenderPrimitive[];
  readonly meshes: readonly RenderTriangleMesh[];
}

export function createRenderSceneInputs(
  objects: readonly SceneObject[],
  derivedGeometryByObjectId: ReadonlyMap<string, DerivedGeometryEntry>
): RenderSceneInputs {
  const primitives: RenderPrimitive[] = [];
  const meshes: RenderTriangleMesh[] = [];

  for (const object of objects) {
    const derivedGeometry = derivedGeometryByObjectId.get(object.id);

    if (derivedGeometry?.status === "ready") {
      meshes.push(derivedGeometry.mesh);
      continue;
    }

    primitives.push(toRenderPrimitive(object));
  }

  return { primitives, meshes };
}

export function toRenderPrimitive(object: SceneObject): RenderPrimitive {
  if (object.kind === "box") {
    return {
      id: object.id,
      kind: "box",
      dimensions: object.dimensions,
      transform: object.transform
    };
  }

  return {
    id: object.id,
    kind: "cylinder",
    dimensions: object.dimensions,
    transform: object.transform
  };
}
