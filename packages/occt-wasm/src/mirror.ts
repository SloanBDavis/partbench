import type { OpenCascadeInstance, TopoDS_Shape } from "opencascade.js";
import {
  withOcctPatternSeedShape,
  type OcctPatternSeedSource
} from "./pattern";
import {
  readTriangulatedShape,
  type OcctMeshData
} from "./readTriangulatedShape";
import type { OcctLoader } from "./tessellateBox";

export type OcctMirrorPlane = "XY" | "XZ" | "YZ";

export type OcctMirrorSeedSource = OcctPatternSeedSource;

export interface OcctMirrorInput {
  readonly seed: OcctMirrorSeedSource;
  readonly mirrorPlane: OcctMirrorPlane;
  readonly includeOriginal: boolean;
  readonly linearDeflection?: number;
  readonly angularDeflection?: number;
}

interface GeometryKernelLikeError {
  readonly code:
    | "MIRROR_GEOMETRY_FAILED"
    | "UNAVAILABLE_BINDING"
    | "EMPTY_RESULT";
  readonly message: string;
}

export async function createOcctMirrorMeshWithLoader(
  loadOcct: OcctLoader,
  input: OcctMirrorInput
): Promise<OcctMeshData> {
  const oc = await loadOcct();

  return createOcctMirrorMeshWithInstance(oc, input);
}

export function createOcctMirrorMeshWithInstance(
  oc: OpenCascadeInstance,
  input: OcctMirrorInput
): OcctMeshData {
  const linearDeflection = input.linearDeflection ?? 0.5;
  const angularDeflection = input.angularDeflection ?? 0.5;

  return withOcctPatternSeedShape(oc, input.seed, (seedShape) => {
    const resultShape = makeMirrorShape(oc, seedShape, input);

    try {
      const mesh = new oc.BRepMesh_IncrementalMesh_2(
        resultShape,
        linearDeflection,
        false,
        angularDeflection,
        false
      );

      try {
        if (!mesh.IsDone()) {
          throw {
            code: "MIRROR_GEOMETRY_FAILED",
            message: `Open CASCADE mirror meshing failed with status ${mesh.GetStatusFlags()}.`
          } satisfies GeometryKernelLikeError;
        }

        return readTriangulatedShape(oc, resultShape, "boolean");
      } finally {
        mesh.delete();
      }
    } finally {
      resultShape.delete();
    }
  });
}

function makeMirrorShape(
  oc: OpenCascadeInstance,
  seedShape: TopoDS_Shape,
  input: Pick<OcctMirrorInput, "mirrorPlane" | "includeOriginal">
): TopoDS_Shape {
  const { mirrorPlane, includeOriginal } = input;

  const mirroredShape = applyMirror(oc, seedShape, mirrorPlane);

  if (!includeOriginal) {
    return mirroredShape;
  }

  // includeOriginal === true: fuse seed + mirrored
  try {
    const range = new oc.Message_ProgressRange_1();

    try {
      const fuse = new oc.BRepAlgoAPI_Fuse_3(seedShape, mirroredShape, range);

      if (fuse.HasErrors()) {
        fuse.delete();
        throw {
          code: "MIRROR_GEOMETRY_FAILED",
          message: "Open CASCADE mirror BRepAlgoAPI_Fuse failed."
        } satisfies GeometryKernelLikeError;
      }

      const fusedShape = copyShape(oc, fuse.Shape());
      fuse.delete();
      mirroredShape.delete();
      return fusedShape;
    } finally {
      range.delete();
    }
  } catch (error) {
    mirroredShape.delete();
    throw error;
  }
}

function applyMirror(
  oc: OpenCascadeInstance,
  shape: TopoDS_Shape,
  mirrorPlane: OcctMirrorPlane
): TopoDS_Shape {
  const origin = new oc.gp_Pnt_3(0, 0, 0);
  const normalDirection = getMirrorPlaneNormal(mirrorPlane);
  const dir = new oc.gp_Dir_4(
    normalDirection[0],
    normalDirection[1],
    normalDirection[2]
  );
  const ax2 = new oc.gp_Ax2_3(origin, dir);
  const trsf = new oc.gp_Trsf_1();

  try {
    trsf.SetMirror_3(ax2);
    const transform = new oc.BRepBuilderAPI_Transform_2(shape, trsf, true);

    try {
      if (!transform.IsDone()) {
        throw {
          code: "MIRROR_GEOMETRY_FAILED",
          message: "Open CASCADE BRepBuilderAPI_Transform (mirror) failed."
        } satisfies GeometryKernelLikeError;
      }

      return copyShape(oc, transform.Shape());
    } finally {
      transform.delete();
    }
  } finally {
    trsf.delete();
    ax2.delete();
    dir.delete();
    origin.delete();
  }
}

function copyShape(oc: OpenCascadeInstance, shape: TopoDS_Shape): TopoDS_Shape {
  const copy = new oc.BRepBuilderAPI_Copy_2(shape, true, false);

  try {
    return copy.Shape();
  } finally {
    copy.delete();
  }
}

function getMirrorPlaneNormal(
  plane: OcctMirrorPlane
): readonly [number, number, number] {
  switch (plane) {
    case "XY":
      return [0, 0, 1]; // Z is normal to XY plane
    case "XZ":
      return [0, 1, 0]; // Y is normal to XZ plane
    case "YZ":
      return [1, 0, 0]; // X is normal to YZ plane
  }
}
