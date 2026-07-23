import type { OpenCascadeInstance, TopoDS_Shape } from "opencascade.js";
import {
  getSketchFrame,
  makeProfileFace,
  type OcctRevolvePlacementFrame,
  type OcctPrimitiveRevolveProfile,
  type OcctRevolveSketchPlane
} from "./revolveProfile";
import {
  readTriangulatedShape,
  type OcctMeshData
} from "./readTriangulatedShape";
import type { OcctLoader } from "./tessellateBox";

export type OcctSweepPoint = readonly [number, number, number];

export interface OcctSweepLinePathSegment {
  readonly kind?: "line";
  readonly start: OcctSweepPoint;
  readonly end: OcctSweepPoint;
}

export interface OcctSweepArcPathSegment {
  readonly kind: "arc";
  readonly start: OcctSweepPoint;
  readonly end: OcctSweepPoint;
  readonly center: OcctSweepPoint;
  readonly normal: OcctSweepPoint;
  readonly sweepAngleDegrees: number;
}

export type OcctSweepPathSegment =
  | OcctSweepLinePathSegment
  | OcctSweepArcPathSegment;

export interface OcctSweepProfileSource {
  readonly sketchPlane: OcctRevolveSketchPlane;
  readonly profile: OcctPrimitiveRevolveProfile;
  readonly placementFrame?: OcctRevolvePlacementFrame;
}

export interface OcctSweepInput {
  readonly profile: OcctSweepProfileSource;
  readonly pathSegments: readonly OcctSweepPathSegment[];
  readonly linearDeflection?: number;
  readonly angularDeflection?: number;
}

export interface OcctSweepShapeHandle {
  readonly shape: TopoDS_Shape;
  Shape(): TopoDS_Shape;
  readonly delete: () => void;
}

export async function createOcctSweepMeshWithLoader(
  loadOcct: OcctLoader,
  input: OcctSweepInput
): Promise<OcctMeshData> {
  return createOcctSweepMeshWithInstance(await loadOcct(), input);
}

export function createOcctSweepMeshWithInstance(
  oc: OpenCascadeInstance,
  input: OcctSweepInput
): OcctMeshData {
  const handle = makeSweepShape(oc, input);
  const linearDeflection = input.linearDeflection ?? 0.5;
  const angularDeflection = input.angularDeflection ?? 0.5;
  try {
    const mesher = new oc.BRepMesh_IncrementalMesh_2(
      handle.shape,
      linearDeflection,
      false,
      angularDeflection,
      false
    );
    try {
      if (!mesher.IsDone()) {
        throw {
          code: isCurvedSweepPath(input.pathSegments)
            ? "SWEEP_CURVED_GEOMETRY_FAILED"
            : "SWEEP_GEOMETRY_FAILED",
          message: `Open CASCADE sweep meshing failed with status ${mesher.GetStatusFlags()}.`
        };
      }
      return readTriangulatedShape(oc, handle.shape, "sweep");
    } finally {
      mesher.delete();
    }
  } finally {
    handle.delete();
  }
}

export function makeSweepShape(
  oc: OpenCascadeInstance,
  input: Omit<OcctSweepInput, "linearDeflection" | "angularDeflection">
): OcctSweepShapeHandle {
  if (input.pathSegments.length === 0) {
    throw {
      code: "SWEEP_PATH_UNSUPPORTED",
      message:
        "Open CASCADE sweep requires an oriented line, arc, or open line/arc chain."
    };
  }
  assertValidSweepPath(input.pathSegments);

  const requiresCurvedFrame = isCurvedSweepPath(input.pathSegments);
  const pathFailureCode = requiresCurvedFrame
    ? "SWEEP_CURVED_PATH_UNSUPPORTED"
    : "SWEEP_PATH_UNSUPPORTED";
  const geometryFailureCode = requiresCurvedFrame
    ? "SWEEP_CURVED_GEOMETRY_FAILED"
    : "SWEEP_GEOMETRY_FAILED";
  assertSweepBindings(
    oc,
    input.pathSegments.some((segment) => segment.kind === "arc")
  );
  const pathEdges: SweepPathEdgeHandle[] = [];
  let wireBuilder:
    | InstanceType<OpenCascadeInstance["BRepBuilderAPI_MakeWire_1"]>
    | undefined;
  let wire:
    | ReturnType<
        InstanceType<OpenCascadeInstance["BRepBuilderAPI_MakeWire_1"]>["Wire"]
      >
    | undefined;
  let profileFace: ReturnType<typeof makeProfileFace> | undefined;
  let range:
    | InstanceType<OpenCascadeInstance["Message_ProgressRange_1"]>
    | undefined;
  let pipe:
    | InstanceType<typeof oc.BRepOffsetAPI_MakePipe_1>
    | InstanceType<typeof oc.BRepOffsetAPI_MakePipe_2>
    | undefined;
  let shape: TopoDS_Shape | undefined;
  let disposed = false;

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    shape?.delete();
    pipe?.delete();
    range?.delete();
    profileFace?.delete();
    wire?.delete();
    wireBuilder?.delete();
    disposePathEdges(pathEdges);
    shape = undefined;
    pipe = undefined;
    range = undefined;
    profileFace = undefined;
    wire = undefined;
    wireBuilder = undefined;
  };

  try {
    for (const segment of input.pathSegments) {
      pathEdges.push(
        segment.kind === "arc"
          ? makeArcPathEdge(oc, segment)
          : makeLinePathEdge(oc, segment)
      );
    }
    wireBuilder = new oc.BRepBuilderAPI_MakeWire_1();
    for (const pathEdge of pathEdges) wireBuilder.Add_1(pathEdge.edge);
    if (!wireBuilder.IsDone()) {
      throw {
        code: pathFailureCode,
        message:
          "Open CASCADE could not construct one connected sweep path wire."
      };
    }
    wire = wireBuilder.Wire();
    profileFace = makeProfileFace(
      oc,
      getSketchFrame(input.profile.sketchPlane, input.profile.placementFrame),
      input.profile.profile
    );
    range = new oc.Message_ProgressRange_1();
    pipe = requiresCurvedFrame
      ? new oc.BRepOffsetAPI_MakePipe_2(
          wire,
          profileFace.face,
          oc.GeomFill_Trihedron
            .GeomFill_IsCorrectedFrenet as unknown as ConstructorParameters<
            typeof oc.BRepOffsetAPI_MakePipe_2
          >[2],
          false
        )
      : new oc.BRepOffsetAPI_MakePipe_1(wire, profileFace.face);
    pipe.Build(range);
    if (!pipe.IsDone()) {
      throw {
        code: geometryFailureCode,
        message: "Open CASCADE MakePipe did not produce a sweep result."
      };
    }
    shape = pipe.Shape();
    assertValidSingleSweepSolid(oc, shape, geometryFailureCode);
    const resultShape = shape;
    return {
      shape: resultShape,
      Shape: () => {
        if (disposed || !pipe) {
          throw new Error("Open CASCADE sweep shape handle is disposed.");
        }
        return pipe.Shape();
      },
      delete: dispose
    };
  } catch (error) {
    dispose();
    throw error;
  }
}

interface SweepPathEdgeHandle {
  readonly edge: ReturnType<
    InstanceType<OpenCascadeInstance["BRepBuilderAPI_MakeEdge_3"]>["Edge"]
  >;
  readonly delete: () => void;
}

function disposePathEdges(edges: readonly SweepPathEdgeHandle[]): void {
  for (const edge of edges) {
    edge.delete();
  }
}

function makeLinePathEdge(
  oc: OpenCascadeInstance,
  segment: OcctSweepLinePathSegment
): SweepPathEdgeHandle {
  if (segment.kind !== undefined && segment.kind !== "line") {
    throw {
      code: "SWEEP_PATH_UNSUPPORTED",
      message: "Open CASCADE sweep received an unsupported path segment."
    };
  }
  let start: InstanceType<OpenCascadeInstance["gp_Pnt_3"]> | undefined;
  let end: InstanceType<OpenCascadeInstance["gp_Pnt_3"]> | undefined;
  let builder:
    | InstanceType<OpenCascadeInstance["BRepBuilderAPI_MakeEdge_3"]>
    | undefined;
  try {
    start = new oc.gp_Pnt_3(...segment.start);
    end = new oc.gp_Pnt_3(...segment.end);
    builder = new oc.BRepBuilderAPI_MakeEdge_3(start, end);
    const edge = builder.Edge();
    let disposed = false;
    return {
      edge,
      delete: () => {
        if (disposed) return;
        disposed = true;
        edge.delete();
        builder?.delete();
        start?.delete();
        end?.delete();
        builder = undefined;
        start = undefined;
        end = undefined;
      }
    };
  } catch (error) {
    builder?.delete();
    end?.delete();
    start?.delete();
    throw error;
  }
}

function makeArcPathEdge(
  oc: OpenCascadeInstance,
  segment: OcctSweepArcPathSegment
): SweepPathEdgeHandle {
  assertValidArcPathSegment(segment);
  const radial = subtract(segment.start, segment.center);
  const radius = length(radial);
  const sense = Math.sign(segment.sweepAngleDegrees);
  let center: InstanceType<typeof oc.gp_Pnt_3> | undefined;
  let normal: InstanceType<typeof oc.gp_Dir_4> | undefined;
  let xDirection: InstanceType<typeof oc.gp_Dir_4> | undefined;
  let axes: InstanceType<typeof oc.gp_Ax2_2> | undefined;
  let circle: InstanceType<typeof oc.gp_Circ_2> | undefined;
  try {
    center = new oc.gp_Pnt_3(...segment.center);
    normal = new oc.gp_Dir_4(
      segment.normal[0] * sense,
      segment.normal[1] * sense,
      segment.normal[2] * sense
    );
    xDirection = new oc.gp_Dir_4(...radial);
    axes = new oc.gp_Ax2_2(center, normal, xDirection);
    circle = new oc.gp_Circ_2(axes, radius);
    const builder = new oc.BRepBuilderAPI_MakeEdge_9(
      circle,
      0,
      (Math.abs(segment.sweepAngleDegrees) * Math.PI) / 180
    );
    try {
      const edge = builder.Edge();
      let disposed = false;
      return {
        edge,
        delete: () => {
          if (disposed) return;
          disposed = true;
          edge.delete();
          builder.delete();
        }
      };
    } catch (error) {
      builder.delete();
      throw error;
    }
  } finally {
    circle?.delete();
    axes?.delete();
    xDirection?.delete();
    normal?.delete();
    center?.delete();
  }
}

function assertValidArcPathSegment(segment: OcctSweepArcPathSegment): void {
  const values = [
    ...segment.start,
    ...segment.end,
    ...segment.center,
    ...segment.normal,
    segment.sweepAngleDegrees
  ];
  const normalLength = length(segment.normal);
  const startRadius = subtract(segment.start, segment.center);
  const endRadius = subtract(segment.end, segment.center);
  const radius = length(startRadius);
  const tolerance = Math.max(1e-6, radius * 1e-9);
  const rotatedEnd = rotate(
    startRadius,
    segment.normal,
    (segment.sweepAngleDegrees * Math.PI) / 180
  );
  if (
    values.some((value) => !Number.isFinite(value)) ||
    Math.abs(normalLength - 1) > 1e-9 ||
    radius <= 1e-12 ||
    Math.abs(segment.sweepAngleDegrees) < 0.1 ||
    Math.abs(segment.sweepAngleDegrees) > 359.9 ||
    Math.abs(length(endRadius) - radius) > tolerance ||
    Math.abs(dot(startRadius, segment.normal)) > tolerance ||
    Math.abs(dot(endRadius, segment.normal)) > tolerance ||
    distance(rotatedEnd, endRadius) > tolerance
  ) {
    throw {
      code: "SWEEP_CURVED_PATH_UNSUPPORTED",
      message:
        "Open CASCADE sweep requires a finite analytic arc whose endpoints, center, unit normal, and signed sweep agree."
    };
  }
}

function assertValidSweepPath(segments: readonly OcctSweepPathSegment[]): void {
  const tolerance = 1e-7;
  const minimumCosine = Math.cos((0.1 * Math.PI) / 180);
  const pathFailureCode = isCurvedSweepPath(segments)
    ? "SWEEP_CURVED_PATH_UNSUPPORTED"
    : "SWEEP_PATH_UNSUPPORTED";
  for (const segment of segments) {
    if (segment.kind === "arc") {
      assertValidArcPathSegment(segment);
    } else if (
      (segment.kind !== undefined && segment.kind !== "line") ||
      [...segment.start, ...segment.end].some(
        (value) => !Number.isFinite(value)
      ) ||
      distance(segment.start, segment.end) <= 1e-12
    ) {
      throw {
        code: pathFailureCode,
        message:
          "Open CASCADE sweep requires finite non-degenerate path segments."
      };
    }
  }
  for (let index = 1; index < segments.length; index += 1) {
    const previous = segments[index - 1]!;
    const current = segments[index]!;
    if (
      distance(previous.end, current.start) > tolerance ||
      dot(pathTangent(previous, "end"), pathTangent(current, "start")) <
        minimumCosine
    ) {
      throw {
        code: pathFailureCode,
        message:
          "Open CASCADE sweep requires an ordered connected path with G1 internal joins."
      };
    }
  }
  if (distance(segments[0]!.start, segments.at(-1)!.end) <= tolerance) {
    throw {
      code: pathFailureCode,
      message: "Closed sweep paths are unsupported in V17."
    };
  }
}

function isCurvedSweepPath(segments: readonly OcctSweepPathSegment[]): boolean {
  return (
    segments.length > 1 || segments.some((segment) => segment.kind === "arc")
  );
}

function pathTangent(
  segment: OcctSweepPathSegment,
  endpoint: "start" | "end"
): OcctSweepPoint {
  if (segment.kind !== "arc") {
    return normalize(subtract(segment.end, segment.start));
  }
  const radius = subtract(
    endpoint === "start" ? segment.start : segment.end,
    segment.center
  );
  const sign = Math.sign(segment.sweepAngleDegrees);
  return normalize([
    sign * (segment.normal[1] * radius[2] - segment.normal[2] * radius[1]),
    sign * (segment.normal[2] * radius[0] - segment.normal[0] * radius[2]),
    sign * (segment.normal[0] * radius[1] - segment.normal[1] * radius[0])
  ]);
}

function normalize(vector: OcctSweepPoint): OcctSweepPoint {
  const magnitude = length(vector);
  return [vector[0] / magnitude, vector[1] / magnitude, vector[2] / magnitude];
}

function assertValidSingleSweepSolid(
  oc: OpenCascadeInstance,
  shape: TopoDS_Shape,
  errorCode:
    | "SWEEP_GEOMETRY_FAILED"
    | "SWEEP_CURVED_GEOMETRY_FAILED" = "SWEEP_GEOMETRY_FAILED"
): void {
  if (shape.IsNull()) {
    assertSweepSolidResult(
      true,
      false,
      shape.ShapeType(),
      oc.TopAbs_ShapeEnum.TopAbs_SOLID,
      0,
      errorCode
    );
  }
  const analyzer = new oc.BRepCheck_Analyzer(shape, true, false);
  let isValid: boolean;
  try {
    isValid = analyzer.IsValid_2();
  } finally {
    analyzer.delete();
  }
  const solidCount = countSubshapes(
    oc,
    shape,
    oc.TopAbs_ShapeEnum.TopAbs_SOLID
  );
  assertSweepSolidResult(
    false,
    isValid,
    shape.ShapeType(),
    oc.TopAbs_ShapeEnum.TopAbs_SOLID,
    solidCount,
    errorCode
  );
}

export function assertSweepSolidResult(
  shapeIsNull: boolean,
  shapeIsValid: boolean,
  shapeType: unknown,
  solidShapeType: unknown,
  solidCount: number,
  errorCode:
    | "SWEEP_GEOMETRY_FAILED"
    | "SWEEP_CURVED_GEOMETRY_FAILED" = "SWEEP_GEOMETRY_FAILED"
): void {
  if (shapeIsNull) {
    throw {
      code: errorCode,
      message: "Open CASCADE sweep returned a null shape."
    };
  }
  if (!shapeIsValid) {
    throw {
      code: errorCode,
      message: "Open CASCADE sweep returned an invalid shape."
    };
  }
  if (shapeType !== solidShapeType || solidCount !== 1) {
    throw {
      code: errorCode,
      message: `Open CASCADE sweep must return exactly one solid; received ${solidCount}.`
    };
  }
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

function subtract(left: OcctSweepPoint, right: OcctSweepPoint): OcctSweepPoint {
  return [left[0] - right[0], left[1] - right[1], left[2] - right[2]];
}

function length(vector: OcctSweepPoint): number {
  return Math.hypot(vector[0], vector[1], vector[2]);
}

function dot(left: OcctSweepPoint, right: OcctSweepPoint): number {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

function distance(left: OcctSweepPoint, right: OcctSweepPoint): number {
  return length(subtract(left, right));
}

function rotate(
  vector: OcctSweepPoint,
  axis: OcctSweepPoint,
  angleRadians: number
): OcctSweepPoint {
  const cosine = Math.cos(angleRadians);
  const sine = Math.sin(angleRadians);
  const projectionScale = dot(vector, axis) * (1 - cosine);
  const cross: OcctSweepPoint = [
    axis[1] * vector[2] - axis[2] * vector[1],
    axis[2] * vector[0] - axis[0] * vector[2],
    axis[0] * vector[1] - axis[1] * vector[0]
  ];
  return [
    vector[0] * cosine + cross[0] * sine + axis[0] * projectionScale,
    vector[1] * cosine + cross[1] * sine + axis[1] * projectionScale,
    vector[2] * cosine + cross[2] * sine + axis[2] * projectionScale
  ];
}

function assertSweepBindings(
  oc: OpenCascadeInstance,
  requiresArc: boolean
): void {
  const base: readonly [string, unknown][] = [
    ["BRepBuilderAPI_MakeEdge_3", oc.BRepBuilderAPI_MakeEdge_3],
    ["BRepBuilderAPI_MakeWire_1", oc.BRepBuilderAPI_MakeWire_1],
    ["BRepOffsetAPI_MakePipe_1", oc.BRepOffsetAPI_MakePipe_1],
    ["BRepCheck_Analyzer", oc.BRepCheck_Analyzer],
    ["TopExp_Explorer_2", oc.TopExp_Explorer_2],
    ["Message_ProgressRange_1", oc.Message_ProgressRange_1],
    ["gp_Pnt_3", oc.gp_Pnt_3]
  ];
  const arc: readonly [string, unknown][] = [
    ["BRepBuilderAPI_MakeEdge_9", oc.BRepBuilderAPI_MakeEdge_9],
    ["BRepOffsetAPI_MakePipe_2", oc.BRepOffsetAPI_MakePipe_2],
    ["gp_Dir_4", oc.gp_Dir_4],
    ["gp_Ax2_2", oc.gp_Ax2_2],
    ["gp_Circ_2", oc.gp_Circ_2],
    [
      "GeomFill_Trihedron.GeomFill_IsCorrectedFrenet",
      oc.GeomFill_Trihedron?.GeomFill_IsCorrectedFrenet
    ]
  ];
  const required = requiresArc ? [...base, ...arc] : base;
  const missing = required
    .filter(([, binding]) => binding === undefined || binding === null)
    .map(([name]) => name);
  if (missing.length > 0) {
    throw {
      code: "UNAVAILABLE_BINDING",
      message: `Open CASCADE sweep bindings are unavailable: ${missing.join(", ")}.`
    };
  }
}
