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

  switch (source.sketchPlane) {
    case "XY":
      return { min: [uMin, vMin, normalMin], max: [uMax, vMax, normalMax] };
    case "XZ":
      return { min: [uMin, normalMin, vMin], max: [uMax, normalMax, vMax] };
    case "YZ":
      return { min: [normalMin, uMin, vMin], max: [normalMax, uMax, vMax] };
  }
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
