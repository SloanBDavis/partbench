import type {
  OpenCascadeInstance,
  TopoDS_Edge,
  TopoDS_Shape,
  TopoDS_Vertex
} from "opencascade.js";
import {
  makeBooleanExtrudeShape,
  type OcctBooleanExtrudeSource,
  type OcctBooleanExtrudeResultSource,
  type OcctBooleanExtrudePrimitiveSource
} from "./booleanExtrudes";
import {
  readTriangulatedShape,
  type OcctMeshData
} from "./readTriangulatedShape";
import type { OcctLoader } from "./tessellateBox";

export type OcctEdgeFinishOperation = "chamfer" | "fillet";
export type OcctRectangleEdgeRole =
  | "start:uMin"
  | "start:uMax"
  | "start:vMin"
  | "start:vMax"
  | "end:uMin"
  | "end:uMax"
  | "end:vMin"
  | "end:vMax"
  | "longitudinal:uMin:vMin"
  | "longitudinal:uMin:vMax"
  | "longitudinal:uMax:vMin"
  | "longitudinal:uMax:vMax";
export type OcctCircularEdgeRole = "start:circular" | "end:circular";
export type OcctEdgeFinishEdgeRole =
  | OcctRectangleEdgeRole
  | OcctCircularEdgeRole;

export type OcctEdgeFinishInput =
  | OcctChamferEdgeFinishInput
  | OcctFilletEdgeFinishInput;

export interface OcctChamferEdgeFinishInput extends OcctEdgeFinishInputBase {
  readonly operation: "chamfer";
  readonly distance: number;
  readonly radius?: never;
}

export interface OcctFilletEdgeFinishInput extends OcctEdgeFinishInputBase {
  readonly operation: "fillet";
  readonly radius: number;
  readonly distance?: never;
}

interface OcctEdgeFinishInputBase {
  readonly target: OcctBooleanExtrudeSource;
  readonly edgeStableId: string;
  readonly linearDeflection?: number;
  readonly angularDeflection?: number;
}

interface ExtrudeFrame {
  readonly origin: readonly [number, number, number];
  readonly uAxis: readonly [number, number, number];
  readonly vAxis: readonly [number, number, number];
  readonly normalAxis: readonly [number, number, number];
}

interface EdgeEndpoints {
  readonly first: readonly [number, number, number];
  readonly last: readonly [number, number, number];
}

interface EdgeHandle {
  readonly edge: TopoDS_Edge;
  readonly delete: () => void;
}

interface GeometryKernelLikeError {
  readonly code:
    | "UNAVAILABLE_BINDING"
    | "UNSUPPORTED_PROFILE"
    | "UNSUPPORTED_EDGE"
    | "INVALID_EDGE_ROLE"
    | "EDGE_FINISH_TOO_LARGE"
    | "INVALID_DIMENSIONS"
    | "INVALID_PLACEMENT";
  readonly message: string;
}

const RECTANGLE_EDGE_ROLES = [
  "start:uMin",
  "start:uMax",
  "start:vMin",
  "start:vMax",
  "end:uMin",
  "end:uMax",
  "end:vMin",
  "end:vMax",
  "longitudinal:uMin:vMin",
  "longitudinal:uMin:vMax",
  "longitudinal:uMax:vMin",
  "longitudinal:uMax:vMax"
] satisfies readonly OcctRectangleEdgeRole[];

const CIRCULAR_EDGE_ROLES = [
  "start:circular",
  "end:circular"
] satisfies readonly OcctCircularEdgeRole[];

export async function createOcctEdgeFinishMeshWithLoader(
  loadOcct: OcctLoader,
  input: OcctEdgeFinishInput
): Promise<OcctMeshData> {
  const oc = await loadOcct();

  return createOcctEdgeFinishMeshWithInstance(oc, input);
}

export function createOcctEdgeFinishMeshWithInstance(
  oc: OpenCascadeInstance,
  input: OcctEdgeFinishInput
): OcctMeshData {
  assertEdgeFinishMeshBindings(oc);

  const linearDeflection = input.linearDeflection ?? 0.5;
  const angularDeflection = input.angularDeflection ?? 0.5;
  return withOcctEdgeFinishResultShape(oc, input, (resultShape) => {
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

      return readTriangulatedShape(oc, resultShape, "edgeFinish");
    } finally {
      mesh.delete();
    }
  });
}

export function withOcctEdgeFinishResultShape<T>(
  oc: OpenCascadeInstance,
  input: OcctEdgeFinishInput,
  readResult: (shape: TopoDS_Shape) => T
): T {
  assertEdgeFinishShapeBindings(oc);
  validateEdgeFinishInput(input);

  const targetShape = makeBooleanExtrudeShape(oc, input.target);
  const edge = findRectangleEdge(oc, targetShape.Shape(), input);
  const range = new oc.Message_ProgressRange_1();
  let builder:
    | InstanceType<typeof oc.BRepFilletAPI_MakeChamfer>
    | InstanceType<typeof oc.BRepFilletAPI_MakeFillet>
    | undefined;

  try {
    if (input.operation === "chamfer") {
      builder = new oc.BRepFilletAPI_MakeChamfer(targetShape.Shape());
      builder.Add_2(input.distance, edge.edge);
    } else {
      const filletShape = oc.ChFi3d_FilletShape
        .ChFi3d_Rational as ConstructorParameters<
        typeof oc.BRepFilletAPI_MakeFillet
      >[1];
      builder = new oc.BRepFilletAPI_MakeFillet(
        targetShape.Shape(),
        filletShape
      );
      builder.Add_2(input.radius, edge.edge);
    }

    builder.Build(range);

    if (!builder.IsDone()) {
      throw new Error(`Open CASCADE ${input.operation} failed.`);
    }

    const resultShape = builder.Shape();

    return readResult(resultShape);
  } finally {
    builder?.delete();
    range.delete();
    edge.delete();
    targetShape.delete();
  }
}

function validateEdgeFinishInput(input: OcctEdgeFinishInput): void {
  const amount = input.operation === "chamfer" ? input.distance : input.radius;

  if (!Number.isFinite(amount) || amount <= 0) {
    throw {
      code: "INVALID_DIMENSIONS",
      message:
        "Edge finish requests require a positive finite chamfer distance or fillet radius."
    } satisfies GeometryKernelLikeError;
  }

  const role = parseEdgeRole(input.edgeStableId);

  if (!role) {
    throw {
      code: "INVALID_EDGE_ROLE",
      message:
        "Edge finish requests require a generated rectangle edge stable ID with a supported semantic edge role."
    } satisfies GeometryKernelLikeError;
  }

  if (!isRectangleEdgeRole(role)) {
    throw {
      code: "UNSUPPORTED_EDGE",
      message:
        "Edge finish feasibility currently supports rectangle source edges and rectangle cut-wall result edges only."
    } satisfies GeometryKernelLikeError;
  }

  const edgeSource = getEdgeFinishReferenceSource(input.target, role);

  if (!edgeSource) {
    throw {
      code: "UNSUPPORTED_EDGE",
      message:
        "Edge finish feasibility currently supports rectangle source edges and rectangle cut-wall result edges only."
    } satisfies GeometryKernelLikeError;
  }

  if (isEdgeFinishAmountTooLarge(input, role, edgeSource)) {
    throw {
      code: "EDGE_FINISH_TOO_LARGE",
      message:
        "Edge finish distance or radius is too large for the selected rectangle edge in this feasibility path."
    } satisfies GeometryKernelLikeError;
  }
}

function findRectangleEdge(
  oc: OpenCascadeInstance,
  shape: TopoDS_Shape,
  input: OcctEdgeFinishInput
): EdgeHandle {
  const role = parseEdgeRole(input.edgeStableId);

  if (!role || !isRectangleEdgeRole(role)) {
    throw {
      code: "INVALID_EDGE_ROLE",
      message:
        "Edge finish requests require a generated rectangle edge stable ID with a supported semantic edge role."
    } satisfies GeometryKernelLikeError;
  }

  const edgeSource = getEdgeFinishReferenceSource(input.target, role);

  if (!edgeSource) {
    throw {
      code: "UNSUPPORTED_EDGE",
      message:
        "Edge finish feasibility currently supports rectangle source edges and rectangle cut-wall result edges only."
    } satisfies GeometryKernelLikeError;
  }

  const expected = createExpectedEdgeEndpoints(edgeSource, role);
  const tolerance = getEdgeMatchTolerance(edgeSource);
  const edgeShapeType = oc.TopAbs_ShapeEnum
    .TopAbs_EDGE as unknown as ConstructorParameters<
    typeof oc.TopExp_Explorer_2
  >[1];
  const avoidShapeType = oc.TopAbs_ShapeEnum
    .TopAbs_SHAPE as unknown as ConstructorParameters<
    typeof oc.TopExp_Explorer_2
  >[2];
  const explorer = new oc.TopExp_Explorer_2(
    shape,
    edgeShapeType,
    avoidShapeType
  );

  try {
    for (; explorer.More(); explorer.Next()) {
      const edge = oc.TopoDS.Edge_1(explorer.Current());

      if (edgeMatchesExpectedEndpoints(oc, edge, expected, tolerance)) {
        return {
          edge,
          delete: () => {
            edge.delete();
          }
        };
      }

      edge.delete();
    }
  } finally {
    explorer.delete();
  }

  throw {
    code: "INVALID_EDGE_ROLE",
    message:
      "Selected generated rectangle edge role could not be matched on the transient OCCT target shape."
  } satisfies GeometryKernelLikeError;
}

function edgeMatchesExpectedEndpoints(
  oc: OpenCascadeInstance,
  edge: TopoDS_Edge,
  expected: EdgeEndpoints,
  tolerance: number
): boolean {
  const actual = readEdgeEndpoints(oc, edge);

  return (
    (pointsAreClose(actual.first, expected.first, tolerance) &&
      pointsAreClose(actual.last, expected.last, tolerance)) ||
    (pointsAreClose(actual.first, expected.last, tolerance) &&
      pointsAreClose(actual.last, expected.first, tolerance))
  );
}

function readEdgeEndpoints(
  oc: OpenCascadeInstance,
  edge: TopoDS_Edge
): EdgeEndpoints {
  const firstVertex = oc.TopExp.FirstVertex(edge, true);
  const lastVertex = oc.TopExp.LastVertex(edge, true);

  try {
    const first = readVertexPoint(oc, firstVertex);
    const last = readVertexPoint(oc, lastVertex);

    return { first, last };
  } finally {
    firstVertex.delete();
    lastVertex.delete();
  }
}

function readVertexPoint(
  oc: OpenCascadeInstance,
  vertex: TopoDS_Vertex
): readonly [number, number, number] {
  const point = oc.BRep_Tool.Pnt(vertex);

  try {
    return [point.X(), point.Y(), point.Z()];
  } finally {
    point.delete();
  }
}

function createExpectedEdgeEndpoints(
  source: OcctBooleanExtrudePrimitiveSource,
  role: OcctRectangleEdgeRole
): EdgeEndpoints {
  if (source.profile.kind !== "rectangle") {
    throw {
      code: "UNSUPPORTED_PROFILE",
      message:
        "Edge finish feasibility currently supports rectangle extrude targets only."
    } satisfies GeometryKernelLikeError;
  }

  const frame = getExtrudeFrame(source);
  const [normalMin, normalMax] = getNormalRange(
    source.depth,
    source.side ?? "positive"
  );
  const uMin = source.profile.center[0] - source.profile.width / 2;
  const uMax = source.profile.center[0] + source.profile.width / 2;
  const vMin = source.profile.center[1] - source.profile.height / 2;
  const vMax = source.profile.center[1] + source.profile.height / 2;

  if (role.startsWith("longitudinal:")) {
    const [, uRole, vRole] = role.split(":") as [
      "longitudinal",
      "uMin" | "uMax",
      "vMin" | "vMax"
    ];
    const u = uRole === "uMin" ? uMin : uMax;
    const v = vRole === "vMin" ? vMin : vMax;

    return {
      first: mapFramePoint(frame, u, v, normalMin),
      last: mapFramePoint(frame, u, v, normalMax)
    };
  }

  const [capRole, profileRole] = role.split(":") as [
    "start" | "end",
    "uMin" | "uMax" | "vMin" | "vMax"
  ];
  const normal = capRole === "start" ? normalMin : normalMax;

  if (profileRole === "uMin" || profileRole === "uMax") {
    const u = profileRole === "uMin" ? uMin : uMax;

    return {
      first: mapFramePoint(frame, u, vMin, normal),
      last: mapFramePoint(frame, u, vMax, normal)
    };
  }

  const v = profileRole === "vMin" ? vMin : vMax;

  return {
    first: mapFramePoint(frame, uMin, v, normal),
    last: mapFramePoint(frame, uMax, v, normal)
  };
}

function parseEdgeRole(stableId: string): OcctEdgeFinishEdgeRole | undefined {
  if (!stableId.startsWith("generated:edge:")) {
    return undefined;
  }

  return [...RECTANGLE_EDGE_ROLES, ...CIRCULAR_EDGE_ROLES].find((role) =>
    stableId.endsWith(`:${role}`)
  );
}

function isRectangleEdgeRole(
  role: OcctEdgeFinishEdgeRole
): role is OcctRectangleEdgeRole {
  return (RECTANGLE_EDGE_ROLES as readonly string[]).includes(role);
}

function getEdgeFinishReferenceSource(
  source: OcctBooleanExtrudeSource,
  role: OcctEdgeFinishEdgeRole
): OcctBooleanExtrudePrimitiveSource | undefined {
  if (!isRectangleEdgeRole(role)) {
    return undefined;
  }

  if (!isOcctBooleanExtrudeResultSource(source)) {
    return source.profile.kind === "rectangle" ? source : undefined;
  }

  if (source.operation !== "cut") return undefined;
  if (!isPrimitiveBooleanExtrudeTool(source.tool)) return undefined;
  if (
    role.startsWith("longitudinal:") &&
    source.tool.profile.kind === "rectangle"
  ) {
    return source.tool;
  }

  return undefined;
}

function isPrimitiveBooleanExtrudeTool(
  source: OcctBooleanExtrudeResultSource["tool"]
): source is OcctBooleanExtrudePrimitiveSource {
  return source.profile.kind !== "wire";
}

function isOcctBooleanExtrudeResultSource(
  source: OcctBooleanExtrudeSource
): source is OcctBooleanExtrudeResultSource {
  return (
    "kind" in source &&
    (source as { readonly kind?: unknown }).kind === "booleanExtrudes"
  );
}

function isEdgeFinishAmountTooLarge(
  input: OcctEdgeFinishInput,
  role: OcctRectangleEdgeRole,
  target: OcctBooleanExtrudePrimitiveSource
): boolean {
  const maxAmount = getRectangleEdgeFinishMaximumAmount(target, role);
  const amount = input.operation === "chamfer" ? input.distance : input.radius;

  return amount >= maxAmount;
}

function getRectangleEdgeFinishMaximumAmount(
  target: OcctBooleanExtrudePrimitiveSource,
  role: OcctRectangleEdgeRole
): number {
  if (target.profile.kind !== "rectangle") {
    return 0;
  }

  const profileWidth = target.profile.width;
  const profileHeight = target.profile.height;
  const depth = target.depth;

  if (role.startsWith("longitudinal:")) {
    return Math.min(profileWidth, profileHeight) / 2;
  }

  const [, profileEdgeRole] = role.split(":") as [
    "start" | "end",
    "uMin" | "uMax" | "vMin" | "vMax"
  ];

  return profileEdgeRole === "uMin" || profileEdgeRole === "uMax"
    ? Math.min(profileWidth, depth) / 2
    : Math.min(profileHeight, depth) / 2;
}

function getEdgeMatchTolerance(
  source: OcctBooleanExtrudePrimitiveSource
): number {
  if (source.profile.kind !== "rectangle") {
    return 1e-7;
  }

  return (
    Math.max(source.profile.width, source.profile.height, source.depth, 1) *
    1e-7
  );
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

function getNormalRange(
  depth: number,
  side: OcctBooleanExtrudePrimitiveSource["side"]
): readonly [number, number] {
  switch (side) {
    case "negative":
      return [-depth, 0];
    case "symmetric":
      return [-depth / 2, depth / 2];
    case "positive":
    case undefined:
      return [0, depth];
  }
}

function pointsAreClose(
  left: readonly [number, number, number],
  right: readonly [number, number, number],
  tolerance: number
): boolean {
  return (
    Math.abs(left[0] - right[0]) <= tolerance &&
    Math.abs(left[1] - right[1]) <= tolerance &&
    Math.abs(left[2] - right[2]) <= tolerance
  );
}

function assertEdgeFinishMeshBindings(oc: OpenCascadeInstance): void {
  assertEdgeFinishShapeBindings(oc);

  const bindings: readonly [string, unknown][] = [
    ["BRepMesh_IncrementalMesh_2", oc.BRepMesh_IncrementalMesh_2]
  ];
  const missing = bindings
    .filter(([, value]) => value === undefined || value === null)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw {
      code: "UNAVAILABLE_BINDING",
      message: `Open CASCADE edge finish mesh bindings are unavailable: ${missing.join(", ")}.`
    } satisfies GeometryKernelLikeError;
  }
}

function assertEdgeFinishShapeBindings(oc: OpenCascadeInstance): void {
  const bindings: readonly [string, unknown][] = [
    ["BRepPrimAPI_MakeBox_5", oc.BRepPrimAPI_MakeBox_5],
    ["BRepFilletAPI_MakeChamfer", oc.BRepFilletAPI_MakeChamfer],
    ["BRepFilletAPI_MakeFillet", oc.BRepFilletAPI_MakeFillet],
    [
      "ChFi3d_FilletShape.ChFi3d_Rational",
      oc.ChFi3d_FilletShape?.ChFi3d_Rational
    ],
    ["Message_ProgressRange_1", oc.Message_ProgressRange_1],
    ["TopExp_Explorer_2", oc.TopExp_Explorer_2],
    ["TopAbs_ShapeEnum.TopAbs_EDGE", oc.TopAbs_ShapeEnum?.TopAbs_EDGE],
    ["TopoDS.Edge_1", oc.TopoDS?.Edge_1],
    ["TopExp.FirstVertex", oc.TopExp?.FirstVertex],
    ["TopExp.LastVertex", oc.TopExp?.LastVertex],
    ["BRep_Tool.Pnt", oc.BRep_Tool?.Pnt],
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
      message: `Open CASCADE edge finish shape bindings are unavailable: ${missing.join(", ")}.`
    } satisfies GeometryKernelLikeError;
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
    throw {
      code: "INVALID_PLACEMENT",
      message: "Edge finish placement frame axes must be non-zero."
    } satisfies GeometryKernelLikeError;
  }

  return [vector[0] / length, vector[1] / length, vector[2] / length];
}
