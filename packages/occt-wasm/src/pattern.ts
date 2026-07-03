import type { OpenCascadeInstance, TopoDS_Shape } from "opencascade.js";
import {
  makeBooleanExtrudeShape,
  type OcctBooleanExtrudeSource,
  type OcctBooleanExtrudePrimitiveSource,
  type OcctBooleanExtrudeResultSource
} from "./booleanExtrudes";
import {
  makeRevolveProfileShape,
  type OcctRevolveAxis,
  type OcctRevolvePlacementFrame,
  type OcctRevolveProfile,
  type OcctRevolveSketchPlane
} from "./revolveProfile";
import { withOcctHoleResultShape, type OcctHoleToolSource } from "./hole";
import {
  withOcctEdgeFinishResultShape,
  type OcctChamferEdgeFinishInput,
  type OcctFilletEdgeFinishInput
} from "./edgeFinish";
import {
  readTriangulatedShape,
  type OcctMeshData
} from "./readTriangulatedShape";
import type { OcctLoader } from "./tessellateBox";

export type OcctPatternAxis = "x" | "y" | "z";

export type OcctPatternSeedSource =
  | OcctPatternSeedExtrudeSource
  | OcctPatternSeedBooleanExtrudesSource
  | OcctPatternSeedRevolveSource
  | OcctPatternSeedHoleSource
  | OcctPatternSeedEdgeFinishSource;

export interface OcctPatternSeedExtrudeSource extends OcctBooleanExtrudePrimitiveSource {
  readonly kind: "extrude";
}

export interface OcctPatternSeedBooleanExtrudesSource extends OcctBooleanExtrudeResultSource {
  readonly kind: "booleanExtrudes";
}

export interface OcctPatternSeedRevolveSource {
  readonly kind: "revolve";
  readonly sketchPlane: OcctRevolveSketchPlane;
  readonly profile: OcctRevolveProfile;
  readonly axis: OcctRevolveAxis;
  readonly angleDegrees: number;
  readonly placementFrame?: OcctRevolvePlacementFrame;
}

export interface OcctPatternSeedHoleSource {
  readonly kind: "hole";
  readonly target: OcctBooleanExtrudeSource;
  readonly tool: OcctHoleToolSource;
}

export type OcctPatternSeedEdgeFinishSource =
  | ({
      readonly kind: "edgeFinish";
    } & Omit<OcctChamferEdgeFinishInput, "linearDeflection" | "angularDeflection">)
  | ({
      readonly kind: "edgeFinish";
    } & Omit<OcctFilletEdgeFinishInput, "linearDeflection" | "angularDeflection">);

export interface OcctLinearPatternInput {
  readonly seed: OcctPatternSeedSource;
  readonly axis: OcctPatternAxis;
  readonly spacing: number;
  readonly instanceCount: number;
  readonly linearDeflection?: number;
  readonly angularDeflection?: number;
}

export interface OcctCircularPatternInput {
  readonly seed: OcctPatternSeedSource;
  readonly rotationAxis: OcctPatternAxis;
  readonly totalAngleDegrees: number;
  readonly instanceCount: number;
  readonly linearDeflection?: number;
  readonly angularDeflection?: number;
}

interface GeometryKernelLikeError {
  readonly code:
    | "UNAVAILABLE_BINDING"
    | "INVALID_DIMENSIONS"
    | "PATTERN_GEOMETRY_FAILED"
    | "EMPTY_RESULT";
  readonly message: string;
}

export async function createOcctLinearPatternMeshWithLoader(
  loadOcct: OcctLoader,
  input: OcctLinearPatternInput
): Promise<OcctMeshData> {
  const oc = await loadOcct();

  return createOcctLinearPatternMeshWithInstance(oc, input);
}

export function createOcctLinearPatternMeshWithInstance(
  oc: OpenCascadeInstance,
  input: OcctLinearPatternInput
): OcctMeshData {
  const linearDeflection = input.linearDeflection ?? 0.5;
  const angularDeflection = input.angularDeflection ?? 0.5;

  return withOcctPatternSeedShape(oc, input.seed, (seedShape) => {
    const resultShape = makeLinearPatternShape(oc, seedShape, input);

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
            code: "PATTERN_GEOMETRY_FAILED",
            message: `Open CASCADE linear pattern meshing failed with status ${mesh.GetStatusFlags()}.`
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

export async function createOcctCircularPatternMeshWithLoader(
  loadOcct: OcctLoader,
  input: OcctCircularPatternInput
): Promise<OcctMeshData> {
  const oc = await loadOcct();

  return createOcctCircularPatternMeshWithInstance(oc, input);
}

export function createOcctCircularPatternMeshWithInstance(
  oc: OpenCascadeInstance,
  input: OcctCircularPatternInput
): OcctMeshData {
  const linearDeflection = input.linearDeflection ?? 0.5;
  const angularDeflection = input.angularDeflection ?? 0.5;

  return withOcctPatternSeedShape(oc, input.seed, (seedShape) => {
    const resultShape = makeCircularPatternShape(oc, seedShape, input);

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
            code: "PATTERN_GEOMETRY_FAILED",
            message: `Open CASCADE circular pattern meshing failed with status ${mesh.GetStatusFlags()}.`
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

export function withOcctPatternSeedShape<T>(
  oc: OpenCascadeInstance,
  seed: OcctPatternSeedSource,
  readShape: (shape: TopoDS_Shape) => T
): T {
  if (seed.kind === "extrude" || seed.kind === "booleanExtrudes") {
    const shapeBuilder = makeBooleanExtrudeShape(oc, seed as OcctBooleanExtrudeSource);

    try {
      return readShape(shapeBuilder.Shape());
    } finally {
      shapeBuilder.delete();
    }
  }

  if (seed.kind === "revolve") {
    const shapeHandle = makeRevolveProfileShape(oc, seed);

    try {
      return readShape(shapeHandle.shape);
    } finally {
      shapeHandle.delete();
    }
  }

  if (seed.kind === "hole") {
    return withOcctHoleResultShape(oc, seed, (shape) => readShape(shape));
  }

  // edgeFinish
  return withOcctEdgeFinishResultShape(oc, seed, (shape) => readShape(shape));
}

function makeLinearPatternShape(
  oc: OpenCascadeInstance,
  seedShape: TopoDS_Shape,
  input: Pick<OcctLinearPatternInput, "axis" | "spacing" | "instanceCount">
): TopoDS_Shape {
  const { axis, spacing, instanceCount } = input;
  const axisVector = getAxisVector(axis);

  let previousShape: TopoDS_Shape | undefined;

  try {
    for (let i = 0; i < instanceCount; i++) {
      const translation = [
        axisVector[0] * spacing * i,
        axisVector[1] * spacing * i,
        axisVector[2] * spacing * i
      ] as const;
      const translatedShape = applyTranslation(oc, seedShape, translation);

      if (i === 0) {
        previousShape = translatedShape;
        continue;
      }

      try {
        const range = new oc.Message_ProgressRange_1();

        try {
          const fuse = new oc.BRepAlgoAPI_Fuse_3(
            previousShape!,
            translatedShape,
            range
          );

          if (fuse.HasErrors()) {
            fuse.delete();
            throw {
              code: "PATTERN_GEOMETRY_FAILED",
              message: `Open CASCADE linear pattern BRepAlgoAPI_Fuse failed at instance ${i}.`
            } satisfies GeometryKernelLikeError;
          }

          const fusedShape = copyShape(oc, fuse.Shape());
          fuse.delete();
          previousShape!.delete();
          translatedShape.delete();
          previousShape = fusedShape;
        } finally {
          range.delete();
        }
      } catch (error) {
        translatedShape.delete();
        throw error;
      }
    }

    if (!previousShape) {
      throw {
        code: "EMPTY_RESULT",
        message: "Open CASCADE linear pattern produced no shapes."
      } satisfies GeometryKernelLikeError;
    }

    const finalShape = previousShape;
    previousShape = undefined;
    return finalShape;
  } finally {
    previousShape?.delete();
  }
}

function makeCircularPatternShape(
  oc: OpenCascadeInstance,
  seedShape: TopoDS_Shape,
  input: Pick<
    OcctCircularPatternInput,
    "rotationAxis" | "totalAngleDegrees" | "instanceCount"
  >
): TopoDS_Shape {
  const { rotationAxis, totalAngleDegrees, instanceCount } = input;
  const axisVector = getAxisVector(rotationAxis);
  const isFullCircle = totalAngleDegrees === 360;

  let previousShape: TopoDS_Shape | undefined;

  try {
    for (let i = 0; i < instanceCount; i++) {
      const angleDeg = isFullCircle
        ? (totalAngleDegrees / instanceCount) * i
        : (totalAngleDegrees / (instanceCount - 1)) * i;
      const rotatedShape = applyRotation(oc, seedShape, axisVector, angleDeg);

      if (i === 0) {
        previousShape = rotatedShape;
        continue;
      }

      try {
        const range = new oc.Message_ProgressRange_1();

        try {
          const fuse = new oc.BRepAlgoAPI_Fuse_3(
            previousShape!,
            rotatedShape,
            range
          );

          if (fuse.HasErrors()) {
            fuse.delete();
            throw {
              code: "PATTERN_GEOMETRY_FAILED",
              message: `Open CASCADE circular pattern BRepAlgoAPI_Fuse failed at instance ${i}.`
            } satisfies GeometryKernelLikeError;
          }

          const fusedShape = copyShape(oc, fuse.Shape());
          fuse.delete();
          previousShape!.delete();
          rotatedShape.delete();
          previousShape = fusedShape;
        } finally {
          range.delete();
        }
      } catch (error) {
        rotatedShape.delete();
        throw error;
      }
    }

    if (!previousShape) {
      throw {
        code: "EMPTY_RESULT",
        message: "Open CASCADE circular pattern produced no shapes."
      } satisfies GeometryKernelLikeError;
    }

    const finalShape = previousShape;
    previousShape = undefined;
    return finalShape;
  } finally {
    previousShape?.delete();
  }
}

function applyTranslation(
  oc: OpenCascadeInstance,
  shape: TopoDS_Shape,
  translation: readonly [number, number, number]
): TopoDS_Shape {
  const vec = new oc.gp_Vec_4(translation[0], translation[1], translation[2]);
  const trsf = new oc.gp_Trsf_1();

  try {
    trsf.SetTranslation_1(vec);
    const transform = new oc.BRepBuilderAPI_Transform_2(shape, trsf, true);

    try {
      if (!transform.IsDone()) {
        throw {
          code: "PATTERN_GEOMETRY_FAILED",
          message: "Open CASCADE BRepBuilderAPI_Transform (translation) failed."
        } satisfies GeometryKernelLikeError;
      }

      return copyShape(oc, transform.Shape());
    } finally {
      transform.delete();
    }
  } finally {
    trsf.delete();
    vec.delete();
  }
}

function applyRotation(
  oc: OpenCascadeInstance,
  shape: TopoDS_Shape,
  axisDirection: readonly [number, number, number],
  angleDeg: number
): TopoDS_Shape {
  if (angleDeg === 0) {
    return copyShape(oc, shape);
  }

  const origin = new oc.gp_Pnt_3(0, 0, 0);
  const dir = new oc.gp_Dir_4(
    axisDirection[0],
    axisDirection[1],
    axisDirection[2]
  );
  const ax1 = new oc.gp_Ax1_2(origin, dir);
  const trsf = new oc.gp_Trsf_1();

  try {
    trsf.SetRotation_1(ax1, (angleDeg * Math.PI) / 180);
    const transform = new oc.BRepBuilderAPI_Transform_2(shape, trsf, true);

    try {
      if (!transform.IsDone()) {
        throw {
          code: "PATTERN_GEOMETRY_FAILED",
          message: "Open CASCADE BRepBuilderAPI_Transform (rotation) failed."
        } satisfies GeometryKernelLikeError;
      }

      return copyShape(oc, transform.Shape());
    } finally {
      transform.delete();
    }
  } finally {
    trsf.delete();
    ax1.delete();
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

function getAxisVector(
  axis: OcctPatternAxis
): readonly [number, number, number] {
  switch (axis) {
    case "x":
      return [1, 0, 0];
    case "y":
      return [0, 1, 0];
    case "z":
      return [0, 0, 1];
  }
}
