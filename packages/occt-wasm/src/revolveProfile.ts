import type {
  OpenCascadeInstance,
  TopoDS_Face,
  TopoDS_Shape,
  TopoDS_Wire
} from "opencascade.js";
import {
  readTriangulatedShape,
  type OcctMeshData
} from "./readTriangulatedShape";
import type { OcctLoader } from "./tessellateBox";
import {
  makeResolvedPlanarWireFace,
  type OcctResolvedPlanarWireProfile
} from "./wireExtrude";

export type OcctRevolveSketchPlane = "XY" | "XZ" | "YZ";

export interface OcctRectangleRevolveProfile {
  readonly kind: "rectangle";
  readonly center: readonly [number, number];
  readonly width: number;
  readonly height: number;
}

export interface OcctCircleRevolveProfile {
  readonly kind: "circle";
  readonly center: readonly [number, number];
  readonly radius: number;
}

export type OcctPrimitiveRevolveProfile =
  | OcctRectangleRevolveProfile
  | OcctCircleRevolveProfile;

export type OcctRevolveProfile =
  | OcctPrimitiveRevolveProfile
  | OcctResolvedPlanarWireProfile;

export interface OcctRevolveAxis {
  readonly start: readonly [number, number];
  readonly end: readonly [number, number];
}

export interface OcctRevolvePlacementFrame {
  readonly origin: readonly [number, number, number];
  readonly uAxis: readonly [number, number, number];
  readonly vAxis: readonly [number, number, number];
}

export interface OcctRevolveProfileInput {
  readonly sketchPlane: OcctRevolveSketchPlane;
  readonly profile: OcctRevolveProfile;
  readonly axis: OcctRevolveAxis;
  readonly angleDegrees: number;
  readonly placementFrame?: OcctRevolvePlacementFrame;
  readonly linearDeflection?: number;
  readonly angularDeflection?: number;
}

export interface SketchFrame {
  readonly origin: readonly [number, number, number];
  readonly uAxis: readonly [number, number, number];
  readonly vAxis: readonly [number, number, number];
  readonly normalAxis: readonly [number, number, number];
}

export interface ProfileFaceHandle {
  readonly face: TopoDS_Face;
  readonly wire: TopoDS_Wire;
  readonly delete: () => void;
}

export interface RevolveShapeHandle {
  readonly shape: TopoDS_Shape;
  Shape(): TopoDS_Shape;
  readonly delete: () => void;
}

export async function createOcctRevolveProfileMeshWithLoader(
  loadOcct: OcctLoader,
  input: OcctRevolveProfileInput
): Promise<OcctMeshData> {
  const oc = await loadOcct();

  return createOcctRevolveProfileMeshWithInstance(oc, input);
}

export function createOcctRevolveProfileMeshWithInstance(
  oc: OpenCascadeInstance,
  input: OcctRevolveProfileInput
): OcctMeshData {
  const linearDeflection = input.linearDeflection ?? 0.5;
  const angularDeflection = input.angularDeflection ?? 0.5;
  const shapeHandle = makeRevolveProfileShape(oc, input);

  try {
    const mesh = new oc.BRepMesh_IncrementalMesh_2(
      shapeHandle.shape,
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

      return readTriangulatedShape(oc, shapeHandle.shape, "revolve");
    } finally {
      mesh.delete();
    }
  } finally {
    shapeHandle.delete();
  }
}

export function makeRevolveProfileShape(
  oc: OpenCascadeInstance,
  input: Omit<OcctRevolveProfileInput, "linearDeflection" | "angularDeflection">
): RevolveShapeHandle {
  assertRevolveProfileBindings(oc);

  const frame =
    input.profile.kind === "wire"
      ? getResolvedWireFrame(input.profile)
      : getSketchFrame(input.sketchPlane, input.placementFrame);
  const angleRadians = (input.angleDegrees * Math.PI) / 180;
  let profileFace:
    | { readonly face: TopoDS_Face; readonly delete: () => void }
    | undefined;
  let revolveAxis: ReturnType<typeof createRevolveAxis> | undefined;
  let range: InstanceType<typeof oc.Message_ProgressRange_1> | undefined;
  let revolve:
    | InstanceType<typeof oc.BRepPrimAPI_MakeRevol_1>
    | InstanceType<typeof oc.BRepPrimAPI_MakeRevol_2>
    | undefined;

  try {
    profileFace =
      input.profile.kind === "wire"
        ? makeResolvedPlanarWireFace(oc, input.profile)
        : makeProfileFace(oc, frame, input.profile);
    revolveAxis = createRevolveAxis(oc, frame, input.axis);
    range = new oc.Message_ProgressRange_1();
    revolve =
      input.angleDegrees >= 360 && input.profile.kind !== "wire"
        ? new oc.BRepPrimAPI_MakeRevol_2(
            profileFace.face,
            revolveAxis.axis,
            false
          )
        : new oc.BRepPrimAPI_MakeRevol_1(
            profileFace.face,
            revolveAxis.axis,
            angleRadians,
            false
          );
    revolve.Build(range);

    if (!revolve.IsDone()) {
      throw new Error("Open CASCADE revolve failed.");
    }

    const shape = revolve.Shape();
    try {
      if (shape.IsNull()) {
        throw new Error("Open CASCADE revolve returned a null shape.");
      }
      const analyzer = new oc.BRepCheck_Analyzer(shape, true, false);
      try {
        if (!analyzer.IsValid_2()) {
          throw new Error("Open CASCADE revolve returned an invalid shape.");
        }
      } finally {
        analyzer.delete();
      }
      assertRevolveSolidResult(
        shape.ShapeType(),
        oc.TopAbs_ShapeEnum.TopAbs_SOLID,
        countSubshapes(oc, shape, oc.TopAbs_ShapeEnum.TopAbs_SOLID)
      );
    } catch (error) {
      shape.delete();
      throw error;
    }

    return {
      shape,
      Shape: () => {
        if (!revolve) {
          throw new Error("Open CASCADE revolve shape handle is disposed.");
        }
        return revolve.Shape();
      },
      delete: (() => {
        let disposed = false;
        return () => {
          if (disposed) return;
          disposed = true;
          shape.delete();
          revolve?.delete();
          range?.delete();
          revolveAxis?.delete();
          profileFace?.delete();
          revolve = undefined;
          range = undefined;
          revolveAxis = undefined;
          profileFace = undefined;
        };
      })()
    };
  } catch (error) {
    revolve?.delete();
    range?.delete();
    revolveAxis?.delete();
    profileFace?.delete();
    throw error;
  }
}

function assertRevolveProfileBindings(oc: OpenCascadeInstance): void {
  const bindings: readonly [string, unknown][] = [
    ["BRepBuilderAPI_MakePolygon_4", oc.BRepBuilderAPI_MakePolygon_4],
    ["BRepBuilderAPI_MakeEdge_8", oc.BRepBuilderAPI_MakeEdge_8],
    ["BRepBuilderAPI_MakeWire_2", oc.BRepBuilderAPI_MakeWire_2],
    ["BRepBuilderAPI_MakeFace_15", oc.BRepBuilderAPI_MakeFace_15],
    ["BRepPrimAPI_MakeRevol_1", oc.BRepPrimAPI_MakeRevol_1],
    ["BRepPrimAPI_MakeRevol_2", oc.BRepPrimAPI_MakeRevol_2],
    ["BRepCheck_Analyzer", oc.BRepCheck_Analyzer],
    ["TopExp_Explorer_2", oc.TopExp_Explorer_2],
    ["Message_ProgressRange_1", oc.Message_ProgressRange_1],
    ["gp_Pnt_3", oc.gp_Pnt_3],
    ["gp_Dir_4", oc.gp_Dir_4],
    ["gp_Ax1_2", oc.gp_Ax1_2],
    ["gp_Ax2_2", oc.gp_Ax2_2],
    ["gp_Circ_2", oc.gp_Circ_2]
  ];
  const missing = bindings
    .filter(([, value]) => value === undefined || value === null)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw {
      code: "UNAVAILABLE_BINDING",
      message: `Open CASCADE revolve bindings are unavailable: ${missing.join(", ")}.`
    };
  }
}

export function assertRevolveSolidResult(
  shapeType: unknown,
  solidShapeType: unknown,
  solidCount: number
): void {
  if (shapeType !== solidShapeType || solidCount !== 1) {
    throw new Error("Open CASCADE revolve must return exactly one solid.");
  }
}

export function makeProfileFace(
  oc: OpenCascadeInstance,
  frame: SketchFrame,
  profile: OcctPrimitiveRevolveProfile
): ProfileFaceHandle {
  switch (profile.kind) {
    case "rectangle":
      return makeRectangleProfileFace(oc, frame, profile);
    case "circle":
      return makeCircleProfileFace(oc, frame, profile);
  }
}

function makeRectangleProfileFace(
  oc: OpenCascadeInstance,
  frame: SketchFrame,
  profile: OcctRectangleRevolveProfile
): ProfileFaceHandle {
  const uMin = profile.center[0] - profile.width / 2;
  const uMax = profile.center[0] + profile.width / 2;
  const vMin = profile.center[1] - profile.height / 2;
  const vMax = profile.center[1] + profile.height / 2;
  const points = [
    createPoint(oc, mapFramePoint(frame, uMin, vMin)),
    createPoint(oc, mapFramePoint(frame, uMax, vMin)),
    createPoint(oc, mapFramePoint(frame, uMax, vMax)),
    createPoint(oc, mapFramePoint(frame, uMin, vMax))
  ] as const;
  const polygon = new oc.BRepBuilderAPI_MakePolygon_4(
    points[0],
    points[1],
    points[2],
    points[3],
    true
  );
  const wire = polygon.Wire();
  const faceMaker = new oc.BRepBuilderAPI_MakeFace_15(wire, true);
  const face = faceMaker.Face();

  if (!polygon.IsDone() || !faceMaker.IsDone()) {
    throw new Error("Open CASCADE failed to create a rectangle revolve face.");
  }

  return {
    face,
    wire,
    delete: () => {
      face.delete();
      faceMaker.delete();
      wire.delete();
      polygon.delete();
      points.forEach((point) => point.delete());
    }
  };
}

function makeCircleProfileFace(
  oc: OpenCascadeInstance,
  frame: SketchFrame,
  profile: OcctCircleRevolveProfile
): ProfileFaceHandle {
  const center = createPoint(
    oc,
    mapFramePoint(frame, profile.center[0], profile.center[1])
  );
  const axes = createOcctAxes(oc, center, frame.normalAxis, frame.uAxis);
  const circle = new oc.gp_Circ_2(axes.axis, profile.radius);
  const edgeMaker = new oc.BRepBuilderAPI_MakeEdge_8(circle);
  const edge = edgeMaker.Edge();
  const wireMaker = new oc.BRepBuilderAPI_MakeWire_2(edge);
  const wire = wireMaker.Wire();
  const faceMaker = new oc.BRepBuilderAPI_MakeFace_15(wire, true);
  const face = faceMaker.Face();

  if (!edgeMaker.IsDone() || !wireMaker.IsDone() || !faceMaker.IsDone()) {
    throw new Error("Open CASCADE failed to create a circle revolve face.");
  }

  return {
    face,
    wire,
    delete: () => {
      face.delete();
      faceMaker.delete();
      wire.delete();
      wireMaker.delete();
      edge.delete();
      edgeMaker.delete();
      circle.delete();
      axes.delete();
      center.delete();
    }
  };
}

function createRevolveAxis(
  oc: OpenCascadeInstance,
  frame: SketchFrame,
  axis: OcctRevolveAxis
): {
  readonly axis: InstanceType<typeof oc.gp_Ax1_2>;
  readonly delete: () => void;
} {
  const start = mapFramePoint(frame, axis.start[0], axis.start[1]);
  const end = mapFramePoint(frame, axis.end[0], axis.end[1]);
  const direction = normalizeVec3([
    end[0] - start[0],
    end[1] - start[1],
    end[2] - start[2]
  ]);
  let point: InstanceType<typeof oc.gp_Pnt_3> | undefined;
  let dir: InstanceType<typeof oc.gp_Dir_4> | undefined;
  let ax1: InstanceType<typeof oc.gp_Ax1_2> | undefined;
  try {
    point = createPoint(oc, start);
    dir = new oc.gp_Dir_4(direction[0], direction[1], direction[2]);
    ax1 = new oc.gp_Ax1_2(point, dir);
    const result = ax1;
    let disposed = false;
    return {
      axis: result,
      delete: () => {
        if (disposed) return;
        disposed = true;
        ax1?.delete();
        dir?.delete();
        point?.delete();
        ax1 = undefined;
        dir = undefined;
        point = undefined;
      }
    };
  } catch (error) {
    ax1?.delete();
    dir?.delete();
    point?.delete();
    throw error;
  }
}

function createOcctAxes(
  oc: OpenCascadeInstance,
  origin: InstanceType<typeof oc.gp_Pnt_3>,
  normalAxis: readonly [number, number, number],
  uAxis: readonly [number, number, number]
): {
  readonly axis: InstanceType<typeof oc.gp_Ax2_2>;
  readonly delete: () => void;
} {
  let normal: InstanceType<typeof oc.gp_Dir_4> | undefined;
  let xDirection: InstanceType<typeof oc.gp_Dir_4> | undefined;
  let axis: InstanceType<typeof oc.gp_Ax2_2> | undefined;
  try {
    normal = new oc.gp_Dir_4(normalAxis[0], normalAxis[1], normalAxis[2]);
    xDirection = new oc.gp_Dir_4(uAxis[0], uAxis[1], uAxis[2]);
    axis = new oc.gp_Ax2_2(origin, normal, xDirection);
    const result = axis;
    let disposed = false;
    return {
      axis: result,
      delete: () => {
        if (disposed) return;
        disposed = true;
        axis?.delete();
        xDirection?.delete();
        normal?.delete();
        axis = undefined;
        xDirection = undefined;
        normal = undefined;
      }
    };
  } catch (error) {
    axis?.delete();
    xDirection?.delete();
    normal?.delete();
    throw error;
  }
}

export function getSketchFrame(
  sketchPlane: OcctRevolveSketchPlane,
  placementFrame?: OcctRevolvePlacementFrame
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

function getResolvedWireFrame(
  profile: OcctResolvedPlanarWireProfile
): SketchFrame {
  const uAxis = normalizeVec3(profile.frame.uAxis);
  const vAxis = normalizeVec3(profile.frame.vAxis);
  return {
    origin: profile.frame.origin,
    uAxis,
    vAxis,
    normalAxis: normalizeVec3(crossVec3(uAxis, vAxis))
  };
}

function countSubshapes(
  oc: OpenCascadeInstance,
  shape: TopoDS_Shape,
  kind: unknown
): number {
  const explorer = new oc.TopExp_Explorer_2(
    shape,
    kind as ConstructorParameters<typeof oc.TopExp_Explorer_2>[1],
    oc.TopAbs_ShapeEnum.TopAbs_SHAPE as ConstructorParameters<
      typeof oc.TopExp_Explorer_2
    >[2]
  );
  let count = 0;
  try {
    for (; explorer.More(); explorer.Next()) count += 1;
    return count;
  } finally {
    explorer.delete();
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

function createPoint(
  oc: OpenCascadeInstance,
  point: readonly [number, number, number]
): InstanceType<typeof oc.gp_Pnt_3> {
  return new oc.gp_Pnt_3(point[0], point[1], point[2]);
}

function normalizeVec3(
  vector: readonly [number, number, number]
): readonly [number, number, number] {
  const length = Math.hypot(vector[0], vector[1], vector[2]);

  if (length === 0) {
    throw new Error("Revolve axis must be non-zero.");
  }

  return [vector[0] / length, vector[1] / length, vector[2] / length];
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
