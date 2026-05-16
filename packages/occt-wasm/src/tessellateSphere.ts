import type { OpenCascadeInstance } from "opencascade.js";
import {
  readTriangulatedShape,
  type OcctMeshData
} from "./readTriangulatedShape";
import type { OcctLoader } from "./tessellateBox";

export interface OcctSphereInput {
  readonly radius: number;
  readonly linearDeflection?: number;
  readonly angularDeflection?: number;
}

export async function createOcctSphereMeshWithLoader(
  loadOcct: OcctLoader,
  input: OcctSphereInput
): Promise<OcctMeshData> {
  const oc = await loadOcct();

  return createOcctSphereMeshWithInstance(oc, input);
}

export function createOcctSphereMeshWithInstance(
  oc: OpenCascadeInstance,
  input: OcctSphereInput
): OcctMeshData {
  const linearDeflection = input.linearDeflection ?? 0.5;
  const angularDeflection = input.angularDeflection ?? 0.5;
  const makeSphere = new oc.BRepPrimAPI_MakeSphere_1(input.radius);

  try {
    const shape = makeSphere.Shape();
    const mesh = new oc.BRepMesh_IncrementalMesh_2(
      shape,
      linearDeflection,
      false,
      angularDeflection,
      false
    );

    try {
      if (!mesh.IsDone()) {
        throw new Error(
          `Open CASCADE meshing failed with status ${mesh.GetStatusFlags()}.`
        );
      }

      return readTriangulatedShape(oc, shape, "sphere");
    } finally {
      mesh.delete();
    }
  } finally {
    makeSphere.delete();
  }
}
