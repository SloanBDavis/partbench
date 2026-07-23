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

export type OcctDirection = readonly [number, number, number];
export interface OcctAxisFrame {
  readonly origin: OcctDirection;
  readonly direction: OcctDirection;
}

export type OcctPatternSeedSource =
  | OcctPatternSeedExtrudeSource
  | OcctPatternSeedBooleanExtrudesSource
  | OcctPatternSeedRevolveSource
  | OcctPatternSeedHoleSource
  | OcctPatternSeedEdgeFinishSource;

export interface OcctPatternSeedExtrudeSource extends OcctBooleanExtrudePrimitiveSource {
  readonly kind: "extrude";
}

export type OcctPatternSeedBooleanExtrudesSource =
  OcctBooleanExtrudeResultSource;

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
    } & Omit<
      OcctChamferEdgeFinishInput,
      "linearDeflection" | "angularDeflection"
    >)
  | ({
      readonly kind: "edgeFinish";
    } & Omit<
      OcctFilletEdgeFinishInput,
      "linearDeflection" | "angularDeflection"
    >);

export interface OcctLinearPatternInput {
  readonly seed: OcctPatternSeedSource;
  readonly direction: OcctDirection;
  readonly spacing: number;
  readonly instanceCount: number;
  readonly linearDeflection?: number;
  readonly angularDeflection?: number;
}

export interface OcctCircularPatternInput {
  readonly seed: OcctPatternSeedSource;
  readonly axis: OcctAxisFrame;
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

        return readPatternMesh(oc, resultShape);
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

        return readPatternMesh(oc, resultShape);
      } finally {
        mesh.delete();
      }
    } finally {
      resultShape.delete();
    }
  });
}

function readPatternMesh(
  oc: OpenCascadeInstance,
  resultShape: TopoDS_Shape
): OcctMeshData {
  const mesh = readTriangulatedShape(oc, resultShape, "boolean");
  const solidCount = countSolids(oc, resultShape);

  return {
    ...mesh,
    ...(solidCount > 1 ? { warnings: ["PATTERN_MULTI_SOLID_RESULT"] } : {})
  };
}

function countSolids(oc: OpenCascadeInstance, shape: TopoDS_Shape): number {
  const solidShapeType = oc.TopAbs_ShapeEnum
    .TopAbs_SOLID as unknown as ConstructorParameters<
    typeof oc.TopExp_Explorer_2
  >[1];
  const avoidShapeType = oc.TopAbs_ShapeEnum
    .TopAbs_SHAPE as unknown as ConstructorParameters<
    typeof oc.TopExp_Explorer_2
  >[2];
  const explorer = new oc.TopExp_Explorer_2(
    shape,
    solidShapeType,
    avoidShapeType
  );
  let solidCount = 0;

  try {
    for (; explorer.More(); explorer.Next()) {
      solidCount += 1;
    }
  } finally {
    explorer.delete();
  }

  return solidCount;
}

export function withOcctPatternSeedShape<T>(
  oc: OpenCascadeInstance,
  seed: OcctPatternSeedSource,
  readShape: (shape: TopoDS_Shape) => T
): T {
  if (seed.kind === "extrude" || seed.kind === "booleanExtrudes") {
    const shapeBuilder = makeBooleanExtrudeShape(
      oc,
      seed as OcctBooleanExtrudeSource
    );

    try {
      const shape = shapeBuilder.Shape();
      try {
        return readShape(shape);
      } finally {
        shape.delete();
      }
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

export function makeLinearPatternShape(
  oc: OpenCascadeInstance,
  seedShape: TopoDS_Shape,
  input: Pick<OcctLinearPatternInput, "direction" | "spacing" | "instanceCount">
): TopoDS_Shape {
  const { direction, spacing, instanceCount } = input;

  let previousShape: TopoDS_Shape | undefined;

  try {
    for (let i = 0; i < instanceCount; i++) {
      const translation = [
        direction[0] * spacing * i,
        direction[1] * spacing * i,
        direction[2] * spacing * i
      ] as const;
      const translatedShape = applyTranslation(oc, seedShape, translation);

      if (i === 0) {
        previousShape = translatedShape;
        continue;
      }

      const accumulatedShape = previousShape;
      if (!accumulatedShape) {
        translatedShape.delete();
        throw {
          code: "EMPTY_RESULT",
          message:
            "Open CASCADE linear pattern lost its accumulated result shape."
        } satisfies GeometryKernelLikeError;
      }

      try {
        const fusedShape = fusePatternShapes(
          oc,
          accumulatedShape,
          translatedShape,
          `Open CASCADE linear pattern BRepAlgoAPI_Fuse failed at instance ${i}.`
        );
        accumulatedShape.delete();
        translatedShape.delete();
        previousShape = fusedShape;
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

export function makeCircularPatternShape(
  oc: OpenCascadeInstance,
  seedShape: TopoDS_Shape,
  input: Pick<
    OcctCircularPatternInput,
    "axis" | "totalAngleDegrees" | "instanceCount"
  >
): TopoDS_Shape {
  const { axis, totalAngleDegrees, instanceCount } = input;
  const isFullCircle = totalAngleDegrees === 360;

  let previousShape: TopoDS_Shape | undefined;

  try {
    for (let i = 0; i < instanceCount; i++) {
      const angleDeg = isFullCircle
        ? (totalAngleDegrees / instanceCount) * i
        : (totalAngleDegrees / (instanceCount - 1)) * i;
      const rotatedShape = applyRotation(
        oc,
        seedShape,
        axis.origin,
        axis.direction,
        angleDeg
      );

      if (i === 0) {
        previousShape = rotatedShape;
        continue;
      }

      const accumulatedShape = previousShape;
      if (!accumulatedShape) {
        rotatedShape.delete();
        throw {
          code: "EMPTY_RESULT",
          message:
            "Open CASCADE circular pattern lost its accumulated result shape."
        } satisfies GeometryKernelLikeError;
      }

      try {
        const fusedShape = fusePatternShapes(
          oc,
          accumulatedShape,
          rotatedShape,
          `Open CASCADE circular pattern BRepAlgoAPI_Fuse failed at instance ${i}.`
        );
        accumulatedShape.delete();
        rotatedShape.delete();
        previousShape = fusedShape;
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

function fusePatternShapes(
  oc: OpenCascadeInstance,
  accumulatedShape: TopoDS_Shape,
  instanceShape: TopoDS_Shape,
  failureMessage: string
): TopoDS_Shape {
  const range = new oc.Message_ProgressRange_1();
  let fuse: InstanceType<OpenCascadeInstance["BRepAlgoAPI_Fuse_3"]> | undefined;

  try {
    fuse = new oc.BRepAlgoAPI_Fuse_3(accumulatedShape, instanceShape, range);
    if (fuse.HasErrors()) {
      throw {
        code: "PATTERN_GEOMETRY_FAILED",
        message: failureMessage
      } satisfies GeometryKernelLikeError;
    }
    return copyBuilderShape(oc, fuse);
  } finally {
    fuse?.delete();
    range.delete();
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

      return copyBuilderShape(oc, transform);
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
  axisOrigin: readonly [number, number, number],
  axisDirection: readonly [number, number, number],
  angleDeg: number
): TopoDS_Shape {
  if (angleDeg === 0) {
    return copyShape(oc, shape);
  }

  const origin = new oc.gp_Pnt_3(axisOrigin[0], axisOrigin[1], axisOrigin[2]);
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

      return copyBuilderShape(oc, transform);
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

function copyBuilderShape(
  oc: OpenCascadeInstance,
  builder: { Shape(): TopoDS_Shape }
): TopoDS_Shape {
  const shape = builder.Shape();

  try {
    return copyShape(oc, shape);
  } finally {
    shape.delete();
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
