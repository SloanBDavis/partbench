import type {
  GeomAbs_JoinType,
  OpenCascadeInstance,
  BRepOffset_Mode,
  TopoDS_Face,
  TopoDS_Shape
} from "opencascade.js";
import { type OcctBooleanExtrudePrimitiveSource } from "./booleanExtrudes";
import {
  withOcctPatternSeedShape,
  type OcctPatternSeedSource
} from "./pattern";
import {
  readTriangulatedShape,
  type OcctMeshData
} from "./readTriangulatedShape";
import type { OcctLoader } from "./tessellateBox";

export type OcctShellTargetSource = OcctPatternSeedSource;

export interface OcctShellInput {
  readonly target: OcctShellTargetSource;
  readonly wallThickness: number;
  readonly openFaceStableIds: readonly string[];
  readonly linearDeflection?: number;
  readonly angularDeflection?: number;
}

interface GeometryKernelLikeError {
  readonly code:
    | "SHELL_GEOMETRY_FAILED"
    | "UNAVAILABLE_BINDING"
    | "EMPTY_RESULT";
  readonly message: string;
}

interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

interface FaceCandidate {
  readonly face: TopoDS_Face;
  readonly center: Vec3;
  readonly size: Vec3;
}

type ExtrudeFaceRole =
  | "startCap"
  | "endCap"
  | "side:uMin"
  | "side:uMax"
  | "side:vMin"
  | "side:vMax"
  | "side:circular";

export async function createOcctShellMeshWithLoader(
  loadOcct: OcctLoader,
  input: OcctShellInput
): Promise<OcctMeshData> {
  const oc = await loadOcct();

  return createOcctShellMeshWithInstance(oc, input);
}

export function createOcctShellMeshWithInstance(
  oc: OpenCascadeInstance,
  input: OcctShellInput
): OcctMeshData {
  assertShellBindings(oc);

  if (!Number.isFinite(input.wallThickness) || input.wallThickness <= 0) {
    throw {
      code: "SHELL_GEOMETRY_FAILED",
      message: "Shell wallThickness must be a positive finite number."
    } satisfies GeometryKernelLikeError;
  }

  const linearDeflection = input.linearDeflection ?? 0.5;
  const angularDeflection = input.angularDeflection ?? 0.5;

  return withOcctPatternSeedShape(oc, input.target, (targetShape) => {
    const resultShape = makeShellShape(oc, targetShape, input);

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
            code: "SHELL_GEOMETRY_FAILED",
            message: `Open CASCADE shell meshing failed with status ${mesh.GetStatusFlags()}.`
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

export function makeShellShape(
  oc: OpenCascadeInstance,
  targetShape: TopoDS_Shape,
  input: Pick<OcctShellInput, "target" | "wallThickness" | "openFaceStableIds">
): TopoDS_Shape {
  let maker:
    | InstanceType<OpenCascadeInstance["BRepOffsetAPI_MakeThickSolid"]>
    | undefined;
  let closingFaces:
    | InstanceType<OpenCascadeInstance["TopTools_ListOfShape_1"]>
    | undefined;
  let range:
    | InstanceType<OpenCascadeInstance["Message_ProgressRange_1"]>
    | undefined;
  const selectedFaces: TopoDS_Face[] = [];

  try {
    maker = new oc.BRepOffsetAPI_MakeThickSolid();
    closingFaces = new oc.TopTools_ListOfShape_1();
    range = new oc.Message_ProgressRange_1();

    for (const stableId of input.openFaceStableIds) {
      const face = findOpenFace(oc, targetShape, input.target, stableId);
      selectedFaces.push(face);
      closingFaces.Append_1(face);
    }

    maker.MakeThickSolidByJoin(
      targetShape,
      closingFaces,
      -input.wallThickness,
      1e-4,
      oc.BRepOffset_Mode.BRepOffset_Skin as BRepOffset_Mode,
      false,
      false,
      oc.GeomAbs_JoinType.GeomAbs_Arc as GeomAbs_JoinType,
      true,
      range
    );
    maker.Build(range);

    if (!maker.IsDone()) {
      throw {
        code: "SHELL_GEOMETRY_FAILED",
        message: "Open CASCADE BRepOffsetAPI_MakeThickSolid failed."
      } satisfies GeometryKernelLikeError;
    }

    const shellShape = maker.Shape();
    try {
      return copyShape(oc, shellShape);
    } finally {
      shellShape.delete();
    }
  } finally {
    for (const face of selectedFaces) {
      face.delete();
    }
    range?.delete();
    closingFaces?.delete();
    maker?.delete();
  }
}

function findOpenFace(
  oc: OpenCascadeInstance,
  shape: TopoDS_Shape,
  target: OcctShellTargetSource,
  stableId: string
): TopoDS_Face {
  const role = parseExtrudeFaceRole(stableId);

  if (!role) {
    throw {
      code: "SHELL_GEOMETRY_FAILED",
      message: `Shell open face reference is not a supported generated extrude face: ${stableId}`
    } satisfies GeometryKernelLikeError;
  }

  const primitive = getPrimitiveExtrudeTarget(target);

  if (!primitive) {
    throw {
      code: "SHELL_GEOMETRY_FAILED",
      message:
        "Shell open face matching currently supports generated faces on primitive extrude target sources."
    } satisfies GeometryKernelLikeError;
  }

  return findPrimitiveExtrudeFace(oc, shape, primitive, role);
}

function parseExtrudeFaceRole(stableId: string): ExtrudeFaceRole | undefined {
  const parts = stableId.split(":");
  const role = parts.slice(3).join(":");

  switch (role) {
    case "startCap":
    case "endCap":
    case "side:uMin":
    case "side:uMax":
    case "side:vMin":
    case "side:vMax":
    case "side:circular":
      return role;
    default:
      return undefined;
  }
}

function getPrimitiveExtrudeTarget(
  source: OcctShellTargetSource
): OcctBooleanExtrudePrimitiveSource | undefined {
  if (source.kind === "extrude") {
    return source;
  }

  return undefined;
}

function findPrimitiveExtrudeFace(
  oc: OpenCascadeInstance,
  shape: TopoDS_Shape,
  source: OcctBooleanExtrudePrimitiveSource,
  role: ExtrudeFaceRole
): TopoDS_Face {
  const frame = getExtrudeFrame(source);
  const normalRange = getNormalRange(source.depth, source.side ?? "positive");
  const expected = getExpectedFaceCoordinates(source, role, normalRange);
  const faces = collectFaces(oc, shape);

  try {
    let best:
      | { readonly face: TopoDS_Face; readonly distance: number }
      | undefined;

    for (const candidate of faces) {
      const projected = {
        u: dot(subtract(candidate.center, frame.origin), frame.uAxis),
        v: dot(subtract(candidate.center, frame.origin), frame.vAxis),
        n: dot(subtract(candidate.center, frame.origin), frame.normalAxis)
      };
      const distance = Math.hypot(
        projected.u - expected.u,
        projected.v - expected.v,
        projected.n - expected.n
      );

      if (!best || distance < best.distance) {
        best = { face: candidate.face, distance };
      }
    }

    const tolerance = Math.max(
      1e-5,
      Math.abs(source.depth) * 1e-4,
      source.profile.kind === "rectangle"
        ? Math.max(source.profile.width, source.profile.height) * 1e-4
        : source.profile.radius * 1e-4
    );

    if (!best || best.distance > tolerance) {
      throw {
        code: "SHELL_GEOMETRY_FAILED",
        message: `Selected generated face role ${role} could not be matched on the transient OCCT target shape.`
      } satisfies GeometryKernelLikeError;
    }

    return copyFace(oc, best.face);
  } finally {
    for (const candidate of faces) {
      candidate.face.delete();
    }
  }
}

function getExpectedFaceCoordinates(
  source: OcctBooleanExtrudePrimitiveSource,
  role: ExtrudeFaceRole,
  normalRange: readonly [number, number]
): { readonly u: number; readonly v: number; readonly n: number } {
  const profileCenter =
    source.profile.kind === "rectangle"
      ? source.profile.center
      : source.profile.center;
  const [normalMin, normalMax] = normalRange;
  const normalMid = (normalMin + normalMax) / 2;

  if (role === "startCap") {
    return {
      u: profileCenter[0],
      v: profileCenter[1],
      n: (source.side ?? "positive") === "negative" ? normalMax : normalMin
    };
  }

  if (role === "endCap") {
    return {
      u: profileCenter[0],
      v: profileCenter[1],
      n: (source.side ?? "positive") === "negative" ? normalMin : normalMax
    };
  }

  if (source.profile.kind === "circle") {
    return { u: profileCenter[0], v: profileCenter[1], n: normalMid };
  }

  switch (role) {
    case "side:uMin":
      return {
        u: source.profile.center[0] - source.profile.width / 2,
        v: source.profile.center[1],
        n: normalMid
      };
    case "side:uMax":
      return {
        u: source.profile.center[0] + source.profile.width / 2,
        v: source.profile.center[1],
        n: normalMid
      };
    case "side:vMin":
      return {
        u: source.profile.center[0],
        v: source.profile.center[1] - source.profile.height / 2,
        n: normalMid
      };
    case "side:vMax":
      return {
        u: source.profile.center[0],
        v: source.profile.center[1] + source.profile.height / 2,
        n: normalMid
      };
    case "side:circular":
      return {
        u: source.profile.center[0],
        v: source.profile.center[1],
        n: normalMid
      };
  }
}

function collectFaces(
  oc: OpenCascadeInstance,
  shape: TopoDS_Shape
): readonly FaceCandidate[] {
  const faceShapeType = oc.TopAbs_ShapeEnum
    .TopAbs_FACE as unknown as ConstructorParameters<
    typeof oc.TopExp_Explorer_2
  >[1];
  const avoidShapeType = oc.TopAbs_ShapeEnum
    .TopAbs_SHAPE as unknown as ConstructorParameters<
    typeof oc.TopExp_Explorer_2
  >[2];
  const explorer = new oc.TopExp_Explorer_2(
    shape,
    faceShapeType,
    avoidShapeType
  );
  const faces: FaceCandidate[] = [];

  try {
    for (; explorer.More(); explorer.Next()) {
      const current = explorer.Current();
      let face: TopoDS_Face;
      try {
        face = oc.TopoDS.Face_1(current);
      } finally {
        current.delete();
      }

      let bounds: ReturnType<typeof readShapeBounds>;
      try {
        bounds = readShapeBounds(oc, face);
      } catch (error) {
        face.delete();
        throw error;
      }
      faces.push({
        face,
        center: {
          x: (bounds.min.x + bounds.max.x) / 2,
          y: (bounds.min.y + bounds.max.y) / 2,
          z: (bounds.min.z + bounds.max.z) / 2
        },
        size: {
          x: bounds.max.x - bounds.min.x,
          y: bounds.max.y - bounds.min.y,
          z: bounds.max.z - bounds.min.z
        }
      });
    }
  } catch (error) {
    for (const candidate of faces) {
      candidate.face.delete();
    }
    throw error;
  } finally {
    explorer.delete();
  }

  return faces;
}

function readShapeBounds(
  oc: OpenCascadeInstance,
  shape: TopoDS_Shape
): { readonly min: Vec3; readonly max: Vec3 } {
  const box = new oc.Bnd_Box_1();

  try {
    oc.BRepBndLib.AddOptimal(shape, box, false, true);
    let min: ReturnType<typeof box.CornerMin> | undefined;
    let max: ReturnType<typeof box.CornerMax> | undefined;

    try {
      min = box.CornerMin();
      max = box.CornerMax();
      return {
        min: { x: min.X(), y: min.Y(), z: min.Z() },
        max: { x: max.X(), y: max.Y(), z: max.Z() }
      };
    } finally {
      max?.delete();
      min?.delete();
    }
  } finally {
    box.delete();
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

function copyFace(oc: OpenCascadeInstance, face: TopoDS_Face): TopoDS_Face {
  return oc.TopoDS.Face_1(copyShape(oc, face));
}

function getNormalRange(
  depth: number,
  side: OcctBooleanExtrudePrimitiveSource["side"] = "positive"
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

function getExtrudeFrame(source: OcctBooleanExtrudePrimitiveSource): {
  readonly origin: Vec3;
  readonly uAxis: Vec3;
  readonly vAxis: Vec3;
  readonly normalAxis: Vec3;
} {
  if (source.placementFrame) {
    const uAxis = normalize(source.placementFrame.uAxis);
    const vAxis = normalize(source.placementFrame.vAxis);

    return {
      origin: toVec3(source.placementFrame.origin),
      uAxis,
      vAxis,
      normalAxis: normalize(cross(uAxis, vAxis))
    };
  }

  switch (source.sketchPlane) {
    case "XY":
      return {
        origin: { x: 0, y: 0, z: 0 },
        uAxis: { x: 1, y: 0, z: 0 },
        vAxis: { x: 0, y: 1, z: 0 },
        normalAxis: { x: 0, y: 0, z: 1 }
      };
    case "XZ":
      return {
        origin: { x: 0, y: 0, z: 0 },
        uAxis: { x: 1, y: 0, z: 0 },
        vAxis: { x: 0, y: 0, z: 1 },
        normalAxis: { x: 0, y: 1, z: 0 }
      };
    case "YZ":
      return {
        origin: { x: 0, y: 0, z: 0 },
        uAxis: { x: 0, y: 1, z: 0 },
        vAxis: { x: 0, y: 0, z: 1 },
        normalAxis: { x: 1, y: 0, z: 0 }
      };
  }
}

function toVec3(value: readonly [number, number, number]): Vec3 {
  return { x: value[0], y: value[1], z: value[2] };
}

function subtract(left: Vec3, right: Vec3): Vec3 {
  return {
    x: left.x - right.x,
    y: left.y - right.y,
    z: left.z - right.z
  };
}

function dot(left: Vec3, right: Vec3): number {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}

function cross(left: Vec3, right: Vec3): Vec3 {
  return {
    x: left.y * right.z - left.z * right.y,
    y: left.z * right.x - left.x * right.z,
    z: left.x * right.y - left.y * right.x
  };
}

function normalize(value: readonly [number, number, number] | Vec3): Vec3 {
  const vec = toVec3Like(value);
  const length = Math.hypot(vec.x, vec.y, vec.z);

  if (length === 0) {
    return { x: 0, y: 0, z: 0 };
  }

  return {
    x: vec.x / length,
    y: vec.y / length,
    z: vec.z / length
  };
}

function toVec3Like(value: readonly [number, number, number] | Vec3): Vec3 {
  return isVec3Tuple(value)
    ? { x: value[0], y: value[1], z: value[2] }
    : { x: value.x, y: value.y, z: value.z };
}

function isVec3Tuple(
  value: readonly [number, number, number] | Vec3
): value is readonly [number, number, number] {
  return Array.isArray(value);
}

function assertShellBindings(oc: OpenCascadeInstance): void {
  const bindings = [
    ["BRepOffsetAPI_MakeThickSolid", oc.BRepOffsetAPI_MakeThickSolid],
    ["TopTools_ListOfShape_1", oc.TopTools_ListOfShape_1],
    ["BRepOffset_Mode.BRepOffset_Skin", oc.BRepOffset_Mode?.BRepOffset_Skin],
    ["GeomAbs_JoinType.GeomAbs_Arc", oc.GeomAbs_JoinType?.GeomAbs_Arc],
    ["Bnd_Box_1", oc.Bnd_Box_1],
    ["BRepBndLib.AddOptimal", oc.BRepBndLib?.AddOptimal]
  ];
  const missing = bindings
    .filter(([, value]) => typeof value === "undefined")
    .map(([name]) => name);

  if (missing.length > 0) {
    throw {
      code: "UNAVAILABLE_BINDING",
      message: `Open CASCADE shell bindings unavailable: ${missing.join(", ")}.`
    } satisfies GeometryKernelLikeError;
  }
}
