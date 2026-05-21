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

export interface OcctBooleanExtrudeSource {
  readonly sketchPlane: OcctSketchPlane;
  readonly profile: OcctExtrudeProfile;
  readonly depth: number;
  readonly side?: OcctExtrudeSide;
  readonly placementFrame?: OcctBooleanExtrudePlacementFrame;
}

export interface OcctBooleanExtrudePlacementFrame {
  readonly origin: readonly [number, number, number];
  readonly uAxis: readonly [number, number, number];
  readonly vAxis: readonly [number, number, number];
}

export interface OcctBooleanExtrudeInput {
  readonly operation: OcctBooleanOperation;
  readonly target: OcctBooleanExtrudeSource;
  readonly tool: OcctBooleanExtrudeSource;
  readonly linearDeflection?: number;
  readonly angularDeflection?: number;
}

interface BoxBounds {
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
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
  const targetBox = makeRectangleExtrudeBox(oc, input.target);
  const toolBox = makeRectangleExtrudeBox(oc, input.tool);
  const range = new oc.Message_ProgressRange_1();
  let booleanOperation:
    | InstanceType<typeof oc.BRepAlgoAPI_Fuse_3>
    | InstanceType<typeof oc.BRepAlgoAPI_Cut_3>
    | undefined;

  try {
    booleanOperation =
      input.operation === "add"
        ? new oc.BRepAlgoAPI_Fuse_3(targetBox.Shape(), toolBox.Shape(), range)
        : new oc.BRepAlgoAPI_Cut_3(targetBox.Shape(), toolBox.Shape(), range);

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
    targetBox.delete();
    toolBox.delete();
  }
}

function makeRectangleExtrudeBox(
  oc: OpenCascadeInstance,
  source: OcctBooleanExtrudeSource
): InstanceType<typeof oc.BRepPrimAPI_MakeBox_4> {
  if (source.profile.kind !== "rectangle") {
    throw new Error(
      "Boolean extrude feasibility currently supports rectangle sources only."
    );
  }

  const bounds = getRectangleExtrudeBounds(source);
  const minPoint = new oc.gp_Pnt_3(bounds.min[0], bounds.min[1], bounds.min[2]);
  const maxPoint = new oc.gp_Pnt_3(bounds.max[0], bounds.max[1], bounds.max[2]);

  try {
    return new oc.BRepPrimAPI_MakeBox_4(minPoint, maxPoint);
  } finally {
    minPoint.delete();
    maxPoint.delete();
  }
}

function getRectangleExtrudeBounds(
  source: OcctBooleanExtrudeSource
): BoxBounds {
  if (source.profile.kind !== "rectangle") {
    throw new Error("Only rectangle extrude bounds are supported.");
  }

  const [uMin, uMax] = getCenteredRange(
    source.profile.center[0],
    source.profile.width
  );
  const [vMin, vMax] = getCenteredRange(
    source.profile.center[1],
    source.profile.height
  );
  const [normalMin, normalMax] = getNormalRange(
    source.depth,
    source.side ?? "positive"
  );

  return createBounds(
    (
      [
        [uMin, vMin, normalMin],
        [uMax, vMin, normalMin],
        [uMax, vMax, normalMin],
        [uMin, vMax, normalMin],
        [uMin, vMin, normalMax],
        [uMax, vMin, normalMax],
        [uMax, vMax, normalMax],
        [uMin, vMax, normalMax]
      ] as const
    ).map((point) => mapSketchPlanePointToBooleanFrame(source, point))
  );
}

function getCenteredRange(
  center: number,
  size: number
): readonly [number, number] {
  return [center - size / 2, center + size / 2];
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

function mapSketchPlanePointToBooleanFrame(
  source: OcctBooleanExtrudeSource,
  point: readonly [number, number, number]
): readonly [number, number, number] {
  if (!source.placementFrame) {
    return mapPlanePoint(source.sketchPlane, point[0], point[1], point[2]);
  }

  const [u, v, normalDistance] = point;
  const frame = source.placementFrame;
  const normal = crossVec3(frame.uAxis, frame.vAxis);

  return [
    frame.origin[0] +
      frame.uAxis[0] * u +
      frame.vAxis[0] * v +
      normal[0] * normalDistance,
    frame.origin[1] +
      frame.uAxis[1] * u +
      frame.vAxis[1] * v +
      normal[1] * normalDistance,
    frame.origin[2] +
      frame.uAxis[2] * u +
      frame.vAxis[2] * v +
      normal[2] * normalDistance
  ];
}

function mapPlanePoint(
  plane: OcctSketchPlane,
  u: number,
  v: number,
  normal: number
): readonly [number, number, number] {
  switch (plane) {
    case "XY":
      return [u, v, normal];
    case "XZ":
      return [u, normal, v];
    case "YZ":
      return [normal, u, v];
  }
}

function createBounds(
  points: readonly (readonly [number, number, number])[]
): BoxBounds {
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const zs = points.map((point) => point[2]);

  return {
    min: [Math.min(...xs), Math.min(...ys), Math.min(...zs)],
    max: [Math.max(...xs), Math.max(...ys), Math.max(...zs)]
  };
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
