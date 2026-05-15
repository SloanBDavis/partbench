import type { OpenCascadeInstance } from "opencascade.js";
import {
  readTriangulatedShape,
  type OcctMeshData
} from "./readTriangulatedShape";

export interface OcctBoxInput {
  readonly width: number;
  readonly height: number;
  readonly depth: number;
  readonly linearDeflection?: number;
  readonly angularDeflection?: number;
}

export type OcctLoader = () => Promise<OpenCascadeInstance>;

export async function createOcctBoxMeshWithLoader(
  loadOcct: OcctLoader,
  input: OcctBoxInput
): Promise<OcctMeshData> {
  const oc = await loadOcct();

  return createOcctBoxMeshWithInstance(oc, input);
}

export function createOcctBoxMeshWithInstance(
  oc: OpenCascadeInstance,
  input: OcctBoxInput
): OcctMeshData {
  const linearDeflection = input.linearDeflection ?? 0.5;
  const angularDeflection = input.angularDeflection ?? 0.5;
  const makeBox = new oc.BRepPrimAPI_MakeBox_2(
    input.width,
    input.height,
    input.depth
  );

  try {
    const shape = makeBox.Shape();
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

      return readTriangulatedShape(oc, shape, "box");
    } finally {
      mesh.delete();
    }
  } finally {
    makeBox.delete();
  }
}
