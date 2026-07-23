import type { OpenCascadeInstance, TopoDS_Shape } from "opencascade.js";
import {
  makeBooleanExtrudeShape,
  type OcctBooleanExtrudeSource,
  type OcctBooleanExtrudePlacementFrame,
  type OcctSketchPlane
} from "./booleanExtrudes";
import {
  readTriangulatedShape,
  type OcctMeshData
} from "./readTriangulatedShape";
import type { OcctLoader } from "./tessellateBox";

export type OcctHoleDepthMode = "blind" | "throughAll";
export type OcctHoleDirection = "positive" | "negative";

export interface OcctHoleCircleTool {
  readonly kind: "circle";
  readonly center: readonly [number, number];
  readonly radius: number;
}

export interface OcctHoleToolSource {
  readonly sketchPlane: OcctSketchPlane;
  readonly circle: OcctHoleCircleTool;
  readonly depthMode: OcctHoleDepthMode;
  readonly depth?: number;
  readonly direction?: OcctHoleDirection;
  readonly placementFrame?: OcctBooleanExtrudePlacementFrame;
}

export interface OcctHoleInput {
  readonly target: OcctBooleanExtrudeSource;
  readonly tool: OcctHoleToolSource;
  readonly linearDeflection?: number;
  readonly angularDeflection?: number;
}

export interface OcctHoleResultShapeInput {
  readonly target: OcctBooleanExtrudeSource;
  readonly tool: OcctHoleToolSource;
}

interface SketchFrame {
  readonly origin: readonly [number, number, number];
  readonly uAxis: readonly [number, number, number];
  readonly vAxis: readonly [number, number, number];
  readonly normalAxis: readonly [number, number, number];
}

interface ShapeBounds {
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
}

interface HoleToolShapeHandle {
  readonly shape: InstanceType<
    OpenCascadeInstance["BRepPrimAPI_MakeCylinder_3"]
  >;
  readonly delete: () => void;
}

interface GeometryKernelLikeError {
  readonly code: "UNAVAILABLE_BINDING" | "INVALID_PLACEMENT" | "EMPTY_RESULT";
  readonly message: string;
}

export async function createOcctHoleMeshWithLoader(
  loadOcct: OcctLoader,
  input: OcctHoleInput
): Promise<OcctMeshData> {
  const oc = await loadOcct();

  return createOcctHoleMeshWithInstance(oc, input);
}

export function createOcctHoleMeshWithInstance(
  oc: OpenCascadeInstance,
  input: OcctHoleInput
): OcctMeshData {
  assertHoleMeshBindings(oc);

  const linearDeflection = input.linearDeflection ?? 0.5;
  const angularDeflection = input.angularDeflection ?? 0.5;

  return withOcctHoleResultShape(oc, input, (resultShape) => {
    const mesh = new oc.BRepMesh_IncrementalMesh_2(
      resultShape,
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

      return readTriangulatedShape(oc, resultShape, "hole");
    } finally {
      mesh.delete();
    }
  });
}

export function withOcctHoleResultShape<T>(
  oc: OpenCascadeInstance,
  input: OcctHoleResultShapeInput,
  readResult: (shape: TopoDS_Shape) => T
): T {
  assertHoleResultBindings(oc);

  const targetShape = makeBooleanExtrudeShape(oc, input.target);
  let target: TopoDS_Shape | undefined;
  let toolShape: HoleToolShapeHandle | undefined;
  let tool: TopoDS_Shape | undefined;
  let range:
    | InstanceType<OpenCascadeInstance["Message_ProgressRange_1"]>
    | undefined;
  let cut: InstanceType<typeof oc.BRepAlgoAPI_Cut_3> | undefined;
  let resultShape: TopoDS_Shape | undefined;

  try {
    target = targetShape.Shape();
    toolShape = makeHoleToolShape(oc, target, input.tool);
    tool = toolShape.shape.Shape();
    range = new oc.Message_ProgressRange_1();
    cut = new oc.BRepAlgoAPI_Cut_3(target, tool, range);

    if (cut.HasErrors()) {
      throw new Error("Open CASCADE hole cut failed.");
    }

    resultShape = cut.Shape();
    return readResult(resultShape);
  } finally {
    resultShape?.delete();
    cut?.delete();
    range?.delete();
    tool?.delete();
    toolShape?.delete();
    target?.delete();
    targetShape.delete();
  }
}

function makeHoleToolShape(
  oc: OpenCascadeInstance,
  targetShape: TopoDS_Shape,
  tool: OcctHoleToolSource
): HoleToolShapeHandle {
  const frame = getSketchFrame(tool.sketchPlane, tool.placementFrame);
  const normalAxis =
    tool.direction === "negative"
      ? negateVec3(frame.normalAxis)
      : frame.normalAxis;
  const origin = mapFramePoint(
    frame,
    tool.circle.center[0],
    tool.circle.center[1]
  );
  const depth =
    tool.depthMode === "blind"
      ? tool.depth
      : getThroughAllDepth(
          oc,
          targetShape,
          origin,
          normalAxis,
          tool.circle.radius
        );

  if (depth === undefined || !Number.isFinite(depth) || depth <= 0) {
    throw {
      code: "INVALID_PLACEMENT",
      message:
        "Hole through-all placement does not intersect the target bounds in the requested direction."
    } satisfies GeometryKernelLikeError;
  }

  const axes = createOcctAxes(oc, origin, normalAxis, frame.uAxis);
  let shape: InstanceType<typeof oc.BRepPrimAPI_MakeCylinder_3> | undefined;

  try {
    shape = new oc.BRepPrimAPI_MakeCylinder_3(
      axes.axis,
      tool.circle.radius,
      depth
    );
    const result = shape;
    let disposed = false;

    return {
      shape: result,
      delete: () => {
        if (disposed) return;
        disposed = true;
        shape?.delete();
        axes.delete();
        shape = undefined;
      }
    };
  } catch (error) {
    shape?.delete();
    axes.delete();
    throw error;
  }
}

function getThroughAllDepth(
  oc: OpenCascadeInstance,
  targetShape: TopoDS_Shape,
  origin: readonly [number, number, number],
  normalAxis: readonly [number, number, number],
  radius: number
): number {
  const bounds = readBounds(oc, targetShape);
  const distances = getBoundsCorners(bounds).map((point) =>
    dotVec3(subtractVec3(point, origin), normalAxis)
  );
  const maxDistance = Math.max(...distances);
  const diagonal = Math.hypot(
    bounds.max[0] - bounds.min[0],
    bounds.max[1] - bounds.min[1],
    bounds.max[2] - bounds.min[2]
  );
  const minimumIntersectionDistance = Math.max(diagonal * 1e-9, 1e-6);
  const margin = Math.max(diagonal * 0.05, radius * 2, 1e-3);

  if (
    !Number.isFinite(maxDistance) ||
    maxDistance <= minimumIntersectionDistance
  ) {
    throw {
      code: "INVALID_PLACEMENT",
      message:
        "Hole through-all placement does not intersect the target bounds in the requested direction."
    } satisfies GeometryKernelLikeError;
  }

  return maxDistance + margin;
}

function readBounds(oc: OpenCascadeInstance, shape: TopoDS_Shape): ShapeBounds {
  const bounds = new oc.Bnd_Box_1();

  try {
    oc.BRepBndLib.AddOptimal(shape, bounds, false, true);

    if (bounds.IsVoid()) {
      throw {
        code: "EMPTY_RESULT",
        message: "Open CASCADE returned an empty target bounds box."
      } satisfies GeometryKernelLikeError;
    }

    let min: ReturnType<typeof bounds.CornerMin> | undefined;
    let max: ReturnType<typeof bounds.CornerMax> | undefined;

    try {
      min = bounds.CornerMin();
      max = bounds.CornerMax();
      return {
        min: [min.X(), min.Y(), min.Z()],
        max: [max.X(), max.Y(), max.Z()]
      };
    } finally {
      max?.delete();
      min?.delete();
    }
  } finally {
    bounds.delete();
  }
}

function getBoundsCorners(
  bounds: ShapeBounds
): readonly (readonly [number, number, number])[] {
  return [
    [bounds.min[0], bounds.min[1], bounds.min[2]],
    [bounds.min[0], bounds.min[1], bounds.max[2]],
    [bounds.min[0], bounds.max[1], bounds.min[2]],
    [bounds.min[0], bounds.max[1], bounds.max[2]],
    [bounds.max[0], bounds.min[1], bounds.min[2]],
    [bounds.max[0], bounds.min[1], bounds.max[2]],
    [bounds.max[0], bounds.max[1], bounds.min[2]],
    [bounds.max[0], bounds.max[1], bounds.max[2]]
  ];
}

function assertHoleResultBindings(oc: OpenCascadeInstance): void {
  const bindings: readonly [string, unknown][] = [
    ["BRepPrimAPI_MakeCylinder_3", oc.BRepPrimAPI_MakeCylinder_3],
    ["BRepAlgoAPI_Cut_3", oc.BRepAlgoAPI_Cut_3],
    ["Message_ProgressRange_1", oc.Message_ProgressRange_1],
    ["BRepBndLib.AddOptimal", oc.BRepBndLib?.AddOptimal],
    ["Bnd_Box_1", oc.Bnd_Box_1],
    ["gp_Pnt_3", oc.gp_Pnt_3],
    ["gp_Dir_4", oc.gp_Dir_4],
    ["gp_Ax2_2", oc.gp_Ax2_2]
  ];
  const missing = bindings
    .filter(([, value]) => value === undefined || value === null)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw {
      code: "UNAVAILABLE_BINDING",
      message: `Open CASCADE hole bindings are unavailable: ${missing.join(", ")}.`
    } satisfies GeometryKernelLikeError;
  }
}

function assertHoleMeshBindings(oc: OpenCascadeInstance): void {
  assertHoleResultBindings(oc);

  if (!oc.BRepMesh_IncrementalMesh_2) {
    throw {
      code: "UNAVAILABLE_BINDING",
      message:
        "Open CASCADE hole mesh bindings are unavailable: BRepMesh_IncrementalMesh_2."
    } satisfies GeometryKernelLikeError;
  }
}

function getSketchFrame(
  sketchPlane: OcctSketchPlane,
  placementFrame: OcctBooleanExtrudePlacementFrame | undefined
): SketchFrame {
  if (placementFrame) {
    const uAxis = normalizeVec3(placementFrame.uAxis);
    const vAxis = normalizeVec3(placementFrame.vAxis);

    return {
      origin: placementFrame.origin,
      uAxis,
      vAxis,
      normalAxis: normalizeVec3(crossVec3(uAxis, vAxis))
    };
  }

  switch (sketchPlane) {
    case "XY":
      return {
        origin: [0, 0, 0],
        uAxis: [1, 0, 0],
        vAxis: [0, 1, 0],
        normalAxis: [0, 0, 1]
      };
    case "XZ":
      return {
        origin: [0, 0, 0],
        uAxis: [1, 0, 0],
        vAxis: [0, 0, 1],
        normalAxis: [0, 1, 0]
      };
    case "YZ":
      return {
        origin: [0, 0, 0],
        uAxis: [0, 1, 0],
        vAxis: [0, 0, 1],
        normalAxis: [1, 0, 0]
      };
  }
}

function mapFramePoint(
  frame: SketchFrame,
  u: number,
  v: number
): readonly [number, number, number] {
  return [
    frame.origin[0] + frame.uAxis[0] * u + frame.vAxis[0] * v,
    frame.origin[1] + frame.uAxis[1] * u + frame.vAxis[1] * v,
    frame.origin[2] + frame.uAxis[2] * u + frame.vAxis[2] * v
  ];
}

function createOcctAxes(
  oc: OpenCascadeInstance,
  origin: readonly [number, number, number],
  normalAxis: readonly [number, number, number],
  uAxis: readonly [number, number, number]
): {
  readonly axis: InstanceType<typeof oc.gp_Ax2_2>;
  readonly delete: () => void;
} {
  let point: InstanceType<typeof oc.gp_Pnt_3> | undefined;
  let normal: InstanceType<typeof oc.gp_Dir_4> | undefined;
  let xDirection: InstanceType<typeof oc.gp_Dir_4> | undefined;
  let axis: InstanceType<typeof oc.gp_Ax2_2> | undefined;

  try {
    point = new oc.gp_Pnt_3(origin[0], origin[1], origin[2]);
    normal = new oc.gp_Dir_4(normalAxis[0], normalAxis[1], normalAxis[2]);
    xDirection = new oc.gp_Dir_4(uAxis[0], uAxis[1], uAxis[2]);
    axis = new oc.gp_Ax2_2(point, normal, xDirection);
    const handles = { axis, xDirection, normal, point };

    return {
      axis: handles.axis,
      delete: () => {
        handles.axis.delete();
        handles.xDirection.delete();
        handles.normal.delete();
        handles.point.delete();
      }
    };
  } catch (error) {
    axis?.delete();
    xDirection?.delete();
    normal?.delete();
    point?.delete();
    throw error;
  }
}

function subtractVec3(
  left: readonly [number, number, number],
  right: readonly [number, number, number]
): readonly [number, number, number] {
  return [left[0] - right[0], left[1] - right[1], left[2] - right[2]];
}

function dotVec3(
  left: readonly [number, number, number],
  right: readonly [number, number, number]
): number {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

function negateVec3(
  vector: readonly [number, number, number]
): readonly [number, number, number] {
  return [-vector[0], -vector[1], -vector[2]];
}

function crossVec3(
  left: readonly [number, number, number],
  right: readonly [number, number, number]
): readonly [number, number, number] {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0]
  ];
}

function normalizeVec3(
  vector: readonly [number, number, number]
): readonly [number, number, number] {
  const length = Math.hypot(vector[0], vector[1], vector[2]);

  if (length === 0) {
    throw {
      code: "INVALID_PLACEMENT",
      message: "Hole placement frame axes must be non-zero."
    } satisfies GeometryKernelLikeError;
  }

  return [vector[0] / length, vector[1] / length, vector[2] / length];
}
