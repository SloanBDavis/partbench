import type { OpenCascadeInstance } from "opencascade.js";
import {
  readTriangulatedShape,
  type OcctMeshData
} from "./readTriangulatedShape";
import type { OcctLoader } from "./tessellateBox";

export interface OcctCylinderInput {
  readonly radius: number;
  readonly height: number;
  readonly linearDeflection?: number;
  readonly angularDeflection?: number;
}

export async function createOcctCylinderMeshWithLoader(
  loadOcct: OcctLoader,
  input: OcctCylinderInput
): Promise<OcctMeshData> {
  const oc = await loadOcct();

  return createOcctCylinderMeshWithInstance(oc, input);
}

export function createOcctCylinderMeshWithInstance(
  oc: OpenCascadeInstance,
  input: OcctCylinderInput
): OcctMeshData {
  const linearDeflection = input.linearDeflection ?? 0.5;
  const angularDeflection = input.angularDeflection ?? 0.5;
  const makeCylinder = new oc.BRepPrimAPI_MakeCylinder_1(
    input.radius,
    input.height
  );

  try {
    const shape = makeCylinder.Shape();
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

      return readTriangulatedShape(oc, shape, "cylinder");
    } finally {
      mesh.delete();
    }
  } finally {
    makeCylinder.delete();
  }
}
