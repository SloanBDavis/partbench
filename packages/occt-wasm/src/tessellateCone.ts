import type { OpenCascadeInstance, TopoDS_Shape } from "opencascade.js";
import {
  readTriangulatedShape,
  type OcctMeshData
} from "./readTriangulatedShape";
import type { OcctLoader } from "./tessellateBox";

export interface OcctConeInput {
  readonly radius: number;
  readonly height: number;
  readonly linearDeflection?: number;
  readonly angularDeflection?: number;
}

export async function createOcctConeMeshWithLoader(
  loadOcct: OcctLoader,
  input: OcctConeInput
): Promise<OcctMeshData> {
  const oc = await loadOcct();

  return createOcctConeMeshWithInstance(oc, input);
}

export function createOcctConeMeshWithInstance(
  oc: OpenCascadeInstance,
  input: OcctConeInput
): OcctMeshData {
  const linearDeflection = input.linearDeflection ?? 0.5;
  const angularDeflection = input.angularDeflection ?? 0.5;
  const makeCone = new oc.BRepPrimAPI_MakeCone_1(input.radius, 0, input.height);
  let shape: TopoDS_Shape | undefined;

  try {
    shape = makeCone.Shape();
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

      return readTriangulatedShape(oc, shape, "cone");
    } finally {
      mesh.delete();
    }
  } finally {
    shape?.delete();
    makeCone.delete();
  }
}
