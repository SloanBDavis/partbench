import type {
  OpenCascadeInstance,
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

export type OcctDraftTargetSource = OcctPatternSeedSource;

export interface OcctDraftPlane {
  readonly point: readonly [number, number, number];
  readonly normal: readonly [number, number, number];
}

export interface OcctDraftInput {
  readonly target: OcctDraftTargetSource;
  readonly faceStableIds: readonly string[];
  readonly angleDegrees: number;
  readonly pullDirection: readonly [number, number, number];
  readonly neutralPlane: OcctDraftPlane;
  readonly draftedFaces?: readonly OcctDraftPlane[];
  readonly linearDeflection?: number;
  readonly angularDeflection?: number;
}

interface GeometryKernelLikeError {
  readonly code: "DRAFT_GEOMETRY_FAILED" | "UNAVAILABLE_BINDING" | "EMPTY_RESULT";
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

export async function createOcctDraftMeshWithLoader(
  loadOcct: OcctLoader,
  input: OcctDraftInput
): Promise<OcctMeshData> {
  return createOcctDraftMeshWithInstance(await loadOcct(), input);
}

export function createOcctDraftMeshWithInstance(
  oc: OpenCascadeInstance,
  input: OcctDraftInput
): OcctMeshData {
  assertDraftBindings(oc);
  const linearDeflection = input.linearDeflection ?? 0.5;
  const angularDeflection = input.angularDeflection ?? 0.5;

  return withOcctPatternSeedShape(oc, input.target, (targetShape) => {
    const resultShape = makeDraftShape(oc, targetShape, input);
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
            code: "DRAFT_GEOMETRY_FAILED",
            message: `Open CASCADE draft meshing failed with status ${mesh.GetStatusFlags()}.`
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

export function makeDraftShape(
  oc: OpenCascadeInstance,
  targetShape: TopoDS_Shape,
  input: Pick<
    OcctDraftInput,
    | "target"
    | "faceStableIds"
    | "angleDegrees"
    | "pullDirection"
    | "neutralPlane"
    | "draftedFaces"
  >
): TopoDS_Shape {
  assertDraftBindings(oc);
  if (
    !Number.isFinite(input.angleDegrees) ||
    input.angleDegrees === 0 ||
    Math.abs(input.angleDegrees) >= 89
  ) {
    throw {
      code: "DRAFT_GEOMETRY_FAILED",
      message:
        "Draft angleDegrees must be a non-zero finite number whose absolute value is less than 89°."
    } satisfies GeometryKernelLikeError;
  }
  if (!Array.isArray(input.faceStableIds) || input.faceStableIds.length === 0) {
    throw {
      code: "DRAFT_GEOMETRY_FAILED",
      message: "Draft requires at least one generated face."
    } satisfies GeometryKernelLikeError;
  }

  const selectedFaces: TopoDS_Face[] = [];
  try {
    for (const stableId of input.faceStableIds) {
      selectedFaces.push(
        findDraftFace(oc, targetShape, input.target, stableId)
      );
    }
    const drafted = makeDraftShapeWithFaces(oc, targetShape, input, selectedFaces);
    if (drafted) {
      if (isSmallerSolid(oc, targetShape, drafted)) {
        return drafted;
      }
      drafted.delete();
    }
    return cutParentWithDraftedPlanes(oc, targetShape, input);
  } finally {
    for (const face of selectedFaces) face.delete();
  }
}

function makeDraftShapeWithFaces(
  oc: OpenCascadeInstance,
  targetShape: TopoDS_Shape,
  input: Pick<
    OcctDraftInput,
    "angleDegrees" | "pullDirection" | "neutralPlane"
  >,
  selectedFaces: readonly TopoDS_Face[]
): TopoDS_Shape | undefined {
  if (!oc.BRepOffsetAPI_DraftAngle_2) return undefined;

  const angleRadians = (input.angleDegrees * Math.PI) / 180;
  for (const flag of [true, false] as const) {
    const drafted = tryDraftAngle(
      oc,
      targetShape,
      selectedFaces,
      input.pullDirection,
      input.neutralPlane,
      angleRadians,
      flag
    );
    if (drafted) return drafted;
  }
  return undefined;
}

function tryDraftAngle(
  oc: OpenCascadeInstance,
  targetShape: TopoDS_Shape,
  selectedFaces: readonly TopoDS_Face[],
  pullDirection: readonly [number, number, number],
  neutralPlane: OcctDraftPlane,
  angleRadians: number,
  flag: boolean
): TopoDS_Shape | undefined {
  let maker: InstanceType<OpenCascadeInstance["BRepOffsetAPI_DraftAngle_2"]> | undefined;
  let pull: InstanceType<OpenCascadeInstance["gp_Dir_4"]> | undefined;
  let origin: InstanceType<OpenCascadeInstance["gp_Pnt_3"]> | undefined;
  let normal: InstanceType<OpenCascadeInstance["gp_Dir_4"]> | undefined;
  let plane: InstanceType<OpenCascadeInstance["gp_Pln_3"]> | undefined;
  let range: InstanceType<OpenCascadeInstance["Message_ProgressRange_1"]> | undefined;

  try {
    maker = new oc.BRepOffsetAPI_DraftAngle_2(targetShape);
    pull = new oc.gp_Dir_4(
      pullDirection[0],
      pullDirection[1],
      pullDirection[2]
    );
    origin = new oc.gp_Pnt_3(
      neutralPlane.point[0],
      neutralPlane.point[1],
      neutralPlane.point[2]
    );
    normal = new oc.gp_Dir_4(
      neutralPlane.normal[0],
      neutralPlane.normal[1],
      neutralPlane.normal[2]
    );
    plane = new oc.gp_Pln_3(origin, normal);

    for (const face of selectedFaces) {
      maker.Add(face, pull, angleRadians, plane, flag);
      if (!maker.AddDone()) {
        return undefined;
      }
    }

    range = new oc.Message_ProgressRange_1();
    maker.Build(range);
    if (!maker.IsDone()) return undefined;

    const draftedShape = maker.Shape();
    try {
      if (draftedShape.IsNull()) return undefined;
      return copyShape(oc, draftedShape);
    } finally {
      draftedShape.delete();
    }
  } catch {
    return undefined;
  } finally {
    range?.delete();
    plane?.delete();
    normal?.delete();
    origin?.delete();
    pull?.delete();
    maker?.delete();
  }
}

function cutParentWithDraftedPlanes(
  oc: OpenCascadeInstance,
  targetShape: TopoDS_Shape,
  input: Pick<
    OcctDraftInput,
    "angleDegrees" | "pullDirection" | "neutralPlane" | "draftedFaces" | "faceStableIds"
  >
): TopoDS_Shape {
  const planes = input.draftedFaces;
  if (!planes || planes.length === 0) {
    throw {
      code: "DRAFT_GEOMETRY_FAILED",
      message:
        "Open CASCADE BRepOffsetAPI_DraftAngle failed and no drafted planes were provided for the equivalent rebuild."
    } satisfies GeometryKernelLikeError;
  }

  const bounds = readShapeBounds(oc, targetShape);
  const extent =
    Math.max(
      bounds.max.x - bounds.min.x,
      bounds.max.y - bounds.min.y,
      bounds.max.z - bounds.min.z,
      1
    ) * 8;

  let current = copyShape(oc, targetShape);
  try {
    for (const plane of planes) {
      const next = cutWithOutwardHalfSpace(oc, current, plane, extent);
      current.delete();
      current = next;
    }
    const result = current;
    current = undefined as unknown as TopoDS_Shape;
    return result;
  } catch (error) {
    current?.delete();
    throw error;
  }
}

function cutWithOutwardHalfSpace(
  oc: OpenCascadeInstance,
  targetShape: TopoDS_Shape,
  plane: OcctDraftPlane,
  extent: number
): TopoDS_Shape {
  let origin: InstanceType<OpenCascadeInstance["gp_Pnt_3"]> | undefined;
  let normal: InstanceType<OpenCascadeInstance["gp_Dir_4"]> | undefined;
  let gpPlane: InstanceType<OpenCascadeInstance["gp_Pln_3"]> | undefined;
  let faceMaker:
    | InstanceType<OpenCascadeInstance["BRepBuilderAPI_MakeFace_9"]>
    | undefined;
  let vector: InstanceType<OpenCascadeInstance["gp_Vec_4"]> | undefined;
  let prism:
    | InstanceType<OpenCascadeInstance["BRepPrimAPI_MakePrism_1"]>
    | undefined;
  let range: InstanceType<OpenCascadeInstance["Message_ProgressRange_1"]> | undefined;
  let cutter:
    | InstanceType<OpenCascadeInstance["BRepAlgoAPI_Cut_3"]>
    | undefined;
  let face: TopoDS_Face | undefined;
  let tool: TopoDS_Shape | undefined;

  try {
    origin = new oc.gp_Pnt_3(plane.point[0], plane.point[1], plane.point[2]);
    normal = new oc.gp_Dir_4(plane.normal[0], plane.normal[1], plane.normal[2]);
    gpPlane = new oc.gp_Pln_3(origin, normal);
    faceMaker = new oc.BRepBuilderAPI_MakeFace_9(
      gpPlane,
      -extent,
      extent,
      -extent,
      extent
    );
    if (!faceMaker.IsDone()) {
      throw {
        code: "DRAFT_GEOMETRY_FAILED",
        message: "Open CASCADE drafted-plane face builder failed."
      } satisfies GeometryKernelLikeError;
    }
    face = faceMaker.Face();
    vector = new oc.gp_Vec_4(
      plane.normal[0] * extent,
      plane.normal[1] * extent,
      plane.normal[2] * extent
    );
    prism = new oc.BRepPrimAPI_MakePrism_1(face, vector, false, false);
    if (!prism.IsDone()) {
      throw {
        code: "DRAFT_GEOMETRY_FAILED",
        message: "Open CASCADE drafted-plane cutting prism failed."
      } satisfies GeometryKernelLikeError;
    }
    tool = prism.Shape();
    range = new oc.Message_ProgressRange_1();
    cutter = new oc.BRepAlgoAPI_Cut_3(targetShape, tool, range);
    if (!cutter.IsDone()) {
      throw {
        code: "DRAFT_GEOMETRY_FAILED",
        message: "Open CASCADE drafted-plane boolean cut failed."
      } satisfies GeometryKernelLikeError;
    }
    const result = cutter.Shape();
    try {
      if (result.IsNull()) {
        throw {
          code: "EMPTY_RESULT",
          message: "Open CASCADE drafted-plane cut returned a null shape."
        } satisfies GeometryKernelLikeError;
      }
      return copyShape(oc, result);
    } finally {
      result.delete();
    }
  } finally {
    tool?.delete();
    cutter?.delete();
    range?.delete();
    prism?.delete();
    vector?.delete();
    face?.delete();
    faceMaker?.delete();
    gpPlane?.delete();
    normal?.delete();
    origin?.delete();
  }
}

function findDraftFace(
  oc: OpenCascadeInstance,
  shape: TopoDS_Shape,
  target: OcctDraftTargetSource,
  stableId: string
): TopoDS_Face {
  const role = parseExtrudeFaceRole(stableId);
  if (!role) {
    throw {
      code: "DRAFT_GEOMETRY_FAILED",
      message: `Draft face reference is not a supported generated extrude face: ${stableId}`
    } satisfies GeometryKernelLikeError;
  }
  const primitive = getPrimitiveExtrudeTarget(target);
  if (!primitive) {
    throw {
      code: "DRAFT_GEOMETRY_FAILED",
      message:
        "Draft face matching currently supports generated faces on primitive extrude target sources."
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
  source: OcctDraftTargetSource
): OcctBooleanExtrudePrimitiveSource | undefined {
  return source.kind === "extrude" ? source : undefined;
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
    let best: { readonly face: TopoDS_Face; readonly distance: number } | undefined;
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
        code: "DRAFT_GEOMETRY_FAILED",
        message: `Selected generated face role ${role} could not be matched on the transient OCCT target shape.`
      } satisfies GeometryKernelLikeError;
    }
    const chosen = best.face;
    for (const candidate of faces) {
      if (candidate.face !== chosen) candidate.face.delete();
    }
    return chosen;
  } catch (error) {
    for (const candidate of faces) candidate.face.delete();
    throw error;
  }
}

function getExpectedFaceCoordinates(
  source: OcctBooleanExtrudePrimitiveSource,
  role: ExtrudeFaceRole,
  normalRange: readonly [number, number]
): { readonly u: number; readonly v: number; readonly n: number } {
  const profileCenter = source.profile.center;
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
    for (const candidate of faces) candidate.face.delete();
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

function isSmallerSolid(
  oc: OpenCascadeInstance,
  original: TopoDS_Shape,
  drafted: TopoDS_Shape
): boolean {
  const originalVolume = readSolidVolume(oc, original);
  const draftedVolume = readSolidVolume(oc, drafted);
  return (
    Number.isFinite(originalVolume) &&
    Number.isFinite(draftedVolume) &&
    draftedVolume > 0 &&
    draftedVolume < originalVolume * (1 - 1e-6)
  );
}

function readSolidVolume(oc: OpenCascadeInstance, shape: TopoDS_Shape): number {
  const props = new oc.GProp_GProps_1();
  try {
    oc.BRepGProp.VolumeProperties_1(shape, props, true, false, false);
    return Math.abs(props.Mass());
  } finally {
    props.delete();
  }
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
  return { x: left.x - right.x, y: left.y - right.y, z: left.z - right.z };
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
  const vec: Vec3 =
    "x" in value
      ? { x: value.x, y: value.y, z: value.z }
      : { x: value[0], y: value[1], z: value[2] };
  const length = Math.hypot(vec.x, vec.y, vec.z);
  if (length === 0) return { x: 0, y: 0, z: 0 };
  return { x: vec.x / length, y: vec.y / length, z: vec.z / length };
}

function assertDraftBindings(oc: OpenCascadeInstance): void {
  const bindings = [
    ["BRepOffsetAPI_DraftAngle_2", oc.BRepOffsetAPI_DraftAngle_2],
    ["gp_Dir_4", oc.gp_Dir_4],
    ["gp_Pnt_3", oc.gp_Pnt_3],
    ["gp_Pln_3", oc.gp_Pln_3],
    ["BRepAlgoAPI_Cut_3", oc.BRepAlgoAPI_Cut_3],
    ["BRepBuilderAPI_MakeFace_9", oc.BRepBuilderAPI_MakeFace_9],
    ["BRepPrimAPI_MakePrism_1", oc.BRepPrimAPI_MakePrism_1],
    ["Bnd_Box_1", oc.Bnd_Box_1],
    ["BRepBndLib.AddOptimal", oc.BRepBndLib?.AddOptimal],
    ["GProp_GProps_1", oc.GProp_GProps_1],
    ["BRepGProp.VolumeProperties_1", oc.BRepGProp?.VolumeProperties_1]
  ];
  const missing = bindings
    .filter(([, value]) => typeof value === "undefined")
    .map(([name]) => name);
  if (missing.length > 0) {
    throw {
      code: "UNAVAILABLE_BINDING",
      message: `Open CASCADE draft bindings unavailable: ${missing.join(", ")}.`
    } satisfies GeometryKernelLikeError;
  }
}
