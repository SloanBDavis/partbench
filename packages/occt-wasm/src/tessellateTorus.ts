import type { OpenCascadeInstance, TopoDS_Shape } from "opencascade.js";
import {
  readTriangulatedShape,
  type OcctMeshData
} from "./readTriangulatedShape";
import type { OcctLoader } from "./tessellateBox";

export interface OcctTorusInput {
  readonly majorRadius: number;
  readonly minorRadius: number;
  readonly linearDeflection?: number;
  readonly angularDeflection?: number;
}

export async function createOcctTorusMeshWithLoader(
  loadOcct: OcctLoader,
  input: OcctTorusInput
): Promise<OcctMeshData> {
  const oc = await loadOcct();

  return createOcctTorusMeshWithInstance(oc, input);
}

export function createOcctTorusMeshWithInstance(
  oc: OpenCascadeInstance,
  input: OcctTorusInput
): OcctMeshData {
  const linearDeflection = input.linearDeflection ?? 0.5;
  const angularDeflection = input.angularDeflection ?? 0.5;
  const makeTorus = new oc.BRepPrimAPI_MakeTorus_1(
    input.majorRadius,
    input.minorRadius
  );
  let shape: TopoDS_Shape | undefined;

  try {
    shape = makeTorus.Shape();
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

      return readTriangulatedShape(oc, shape, "torus");
    } finally {
      mesh.delete();
    }
  } finally {
    shape?.delete();
    makeTorus.delete();
  }
}
