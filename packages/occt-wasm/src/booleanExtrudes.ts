import type { OpenCascadeInstance } from "opencascade.js";
import {
  readTriangulatedShape,
  type OcctMeshData
} from "./readTriangulatedShape";
import type { OcctLoader } from "./tessellateBox";

export type OcctBooleanOperation = "add" | "cut";
export type OcctSketchPlane = "XY" | "XZ" | "YZ";
export type OcctExtrudeSide = "positive" | "negative" | "symmetric";

export interface OcctRectangleExtrudeProfile {
  readonly kind: "rectangle";
  readonly center: readonly [number, number];
  readonly width: number;
  readonly height: number;
}

export interface OcctCircleExtrudeProfile {
  readonly kind: "circle";
  readonly center: readonly [number, number];
  readonly radius: number;
}

export type OcctExtrudeProfile =
  | OcctRectangleExtrudeProfile
  | OcctCircleExtrudeProfile;

export type OcctBooleanExtrudeSource =
  | OcctBooleanExtrudePrimitiveSource
  | OcctBooleanExtrudeResultSource;

export interface OcctBooleanExtrudePrimitiveSource {
  readonly sketchPlane: OcctSketchPlane;
  readonly profile: OcctExtrudeProfile;
  readonly depth: number;
  readonly side?: OcctExtrudeSide;
  readonly placementFrame?: OcctBooleanExtrudePlacementFrame;
}

export interface OcctBooleanExtrudeResultSource {
  readonly kind: "booleanExtrudes";
  readonly operation: OcctBooleanOperation;
  readonly target: OcctBooleanExtrudeSource;
  readonly tool: OcctBooleanExtrudePrimitiveSource;
}

export interface OcctBooleanExtrudePlacementFrame {
  readonly origin: readonly [number, number, number];
  readonly uAxis: readonly [number, number, number];
  readonly vAxis: readonly [number, number, number];
}

export interface OcctBooleanExtrudeInput {
  readonly operation: OcctBooleanOperation;
  readonly target: OcctBooleanExtrudeSource;
  readonly tool: OcctBooleanExtrudePrimitiveSource;
  readonly linearDeflection?: number;
  readonly angularDeflection?: number;
}

interface ExtrudeFrame {
  readonly origin: readonly [number, number, number];
  readonly uAxis: readonly [number, number, number];
  readonly vAxis: readonly [number, number, number];
  readonly normalAxis: readonly [number, number, number];
}

export async function createOcctBooleanExtrudeMeshWithLoader(
  loadOcct: OcctLoader,
  input: OcctBooleanExtrudeInput
): Promise<OcctMeshData> {
  const oc = await loadOcct();

  return createOcctBooleanExtrudeMeshWithInstance(oc, input);
}

export function createOcctBooleanExtrudeMeshWithInstance(
  oc: OpenCascadeInstance,
  input: OcctBooleanExtrudeInput
): OcctMeshData {
  const linearDeflection = input.linearDeflection ?? 0.5;
  const angularDeflection = input.angularDeflection ?? 0.5;
  const targetShape = makeBooleanExtrudeShape(oc, input.target);
  const toolShape = makeBooleanExtrudeShape(oc, input.tool);
  const range = new oc.Message_ProgressRange_1();
  let booleanOperation:
    | InstanceType<typeof oc.BRepAlgoAPI_Fuse_3>
    | InstanceType<typeof oc.BRepAlgoAPI_Cut_3>
    | undefined;

  try {
    booleanOperation =
      input.operation === "add"
        ? new oc.BRepAlgoAPI_Fuse_3(
            targetShape.Shape(),
            toolShape.Shape(),
            range
          )
        : new oc.BRepAlgoAPI_Cut_3(
            targetShape.Shape(),
            toolShape.Shape(),
            range
          );

    if (booleanOperation.HasErrors()) {
      throw new Error(`Open CASCADE boolean ${input.operation} failed.`);
    }

    const resultShape = booleanOperation.Shape();
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

      return readTriangulatedShape(oc, resultShape, "boolean");
    } finally {
      mesh.delete();
    }
  } finally {
    booleanOperation?.delete();
    range.delete();
    targetShape.delete();
    toolShape.delete();
  }
}

export function makeBooleanExtrudeShape(
  oc: OpenCascadeInstance,
  source: OcctBooleanExtrudeSource
):
  | InstanceType<typeof oc.BRepPrimAPI_MakeBox_5>
  | InstanceType<typeof oc.BRepPrimAPI_MakeCylinder_3>
  | InstanceType<typeof oc.BRepAlgoAPI_Fuse_3>
  | InstanceType<typeof oc.BRepAlgoAPI_Cut_3> {
  if (isOcctBooleanExtrudeResultSource(source)) {
    return makeBooleanExtrudeResultShape(oc, source);
  }

  return makePrimitiveBooleanExtrudeShape(oc, source);
}

function isOcctBooleanExtrudeResultSource(
  source: OcctBooleanExtrudeSource
): source is OcctBooleanExtrudeResultSource {
  return (
    "kind" in source &&
    (source as { readonly kind?: unknown }).kind === "booleanExtrudes"
  );
}

function makePrimitiveBooleanExtrudeShape(
  oc: OpenCascadeInstance,
  source: OcctBooleanExtrudePrimitiveSource
):
  | InstanceType<typeof oc.BRepPrimAPI_MakeBox_5>
  | InstanceType<typeof oc.BRepPrimAPI_MakeCylinder_3> {
  switch (source.profile.kind) {
    case "rectangle":
      return makeRectangleExtrudeBox(oc, source);
    case "circle":
      return makeCircleExtrudeCylinder(oc, source);
  }
}

function makeBooleanExtrudeResultShape(
  oc: OpenCascadeInstance,
  source: OcctBooleanExtrudeResultSource
):
  | InstanceType<typeof oc.BRepAlgoAPI_Fuse_3>
  | InstanceType<typeof oc.BRepAlgoAPI_Cut_3> {
  const targetShape = makeBooleanExtrudeShape(oc, source.target);
  const toolShape = makePrimitiveBooleanExtrudeShape(oc, source.tool);
  const range = new oc.Message_ProgressRange_1();

  try {
    const operation =
      source.operation === "add"
        ? new oc.BRepAlgoAPI_Fuse_3(
            targetShape.Shape(),
            toolShape.Shape(),
            range
          )
        : new oc.BRepAlgoAPI_Cut_3(
            targetShape.Shape(),
            toolShape.Shape(),
            range
          );

    if (operation.HasErrors()) {
      operation.delete();
      throw new Error(`Open CASCADE boolean ${source.operation} failed.`);
    }

    return operation;
  } finally {
    range.delete();
    targetShape.delete();
    toolShape.delete();
  }
}

function makeRectangleExtrudeBox(
  oc: OpenCascadeInstance,
  source: OcctBooleanExtrudePrimitiveSource
): InstanceType<typeof oc.BRepPrimAPI_MakeBox_5> {
  if (source.profile.kind !== "rectangle") {
    throw new Error(
      "Boolean extrude feasibility currently supports rectangle sources only."
    );
  }

  const { normalMin, normalMax } = getExtrudeNormalRange(source);
  const frame = getExtrudeFrame(source);
  const origin = mapFramePoint(
    frame,
    source.profile.center[0] - source.profile.width / 2,
    source.profile.center[1] - source.profile.height / 2,
    normalMin
  );
  const axes = createOcctAxes(oc, origin, frame.normalAxis, frame.uAxis);

  try {
    return new oc.BRepPrimAPI_MakeBox_5(
      axes.axis,
      source.profile.width,
      source.profile.height,
      normalMax - normalMin
    );
  } finally {
    axes.delete();
  }
}

function makeCircleExtrudeCylinder(
  oc: OpenCascadeInstance,
  source: OcctBooleanExtrudePrimitiveSource
): InstanceType<typeof oc.BRepPrimAPI_MakeCylinder_3> {
  if (source.profile.kind !== "circle") {
    throw new Error(
      "Boolean extrude feasibility currently supports circle sources only."
    );
  }

  const { normalMin, normalMax } = getExtrudeNormalRange(source);
  const frame = getExtrudeFrame(source);
  const origin = mapFramePoint(
    frame,
    source.profile.center[0],
    source.profile.center[1],
    normalMin
  );
  const axes = createOcctAxes(oc, origin, frame.normalAxis, frame.uAxis);

  try {
    return new oc.BRepPrimAPI_MakeCylinder_3(
      axes.axis,
      source.profile.radius,
      normalMax - normalMin
    );
  } finally {
    axes.delete();
  }
}

function getExtrudeNormalRange(source: OcctBooleanExtrudePrimitiveSource): {
  readonly normalMin: number;
  readonly normalMax: number;
} {
  const [normalMin, normalMax] = getNormalRange(
    source.depth,
    source.side ?? "positive"
  );

  return { normalMin, normalMax };
}

function getExtrudeFrame(
  source: OcctBooleanExtrudePrimitiveSource
): ExtrudeFrame {
  if (source.placementFrame) {
    const uAxis = normalizeVec3(source.placementFrame.uAxis);
    const vAxis = normalizeVec3(source.placementFrame.vAxis);

    return {
      origin: source.placementFrame.origin,
      uAxis,
      vAxis,
      normalAxis: normalizeVec3(crossVec3(uAxis, vAxis))
    };
  }

  switch (source.sketchPlane) {
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
  frame: ExtrudeFrame,
  u: number,
  v: number,
  normalDistance: number
): readonly [number, number, number] {
  return [
    frame.origin[0] +
      frame.uAxis[0] * u +
      frame.vAxis[0] * v +
      frame.normalAxis[0] * normalDistance,
    frame.origin[1] +
      frame.uAxis[1] * u +
      frame.vAxis[1] * v +
      frame.normalAxis[1] * normalDistance,
    frame.origin[2] +
      frame.uAxis[2] * u +
      frame.vAxis[2] * v +
      frame.normalAxis[2] * normalDistance
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
  const point = new oc.gp_Pnt_3(origin[0], origin[1], origin[2]);
  const normal = new oc.gp_Dir_4(normalAxis[0], normalAxis[1], normalAxis[2]);
  const xDirection = new oc.gp_Dir_4(uAxis[0], uAxis[1], uAxis[2]);
  const axis = new oc.gp_Ax2_2(point, normal, xDirection);

  return {
    axis,
    delete: () => {
      axis.delete();
      xDirection.delete();
      normal.delete();
      point.delete();
    }
  };
}

function getNormalRange(
  depth: number,
  side: OcctExtrudeSide
): readonly [number, number] {
  switch (side) {
    case "positive":
      return [0, depth];
    case "negative":
      return [-depth, 0];
    case "symmetric":
      return [-depth / 2, depth / 2];
  }
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
    throw new Error("Boolean extrude placement frame axes must be non-zero.");
  }

  return [vector[0] / length, vector[1] / length, vector[2] / length];
}
