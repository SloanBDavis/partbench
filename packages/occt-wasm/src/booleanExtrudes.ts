import type { OpenCascadeInstance, TopoDS_Shape } from "opencascade.js";
import {
  readTriangulatedShape,
  type OcctMeshData
} from "./readTriangulatedShape";
import type { OcctLoader } from "./tessellateBox";
import {
  makeWireExtrudeShape,
  type OcctWireExtrudeSource
} from "./wireExtrude";

export type OcctBooleanOperation = "add" | "cut";
export const MAX_OCCT_BOOLEAN_EXTRUDE_RECIPE_DEPTH = 64;
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

export type OcctBooleanExtrudeWireSource = OcctWireExtrudeSource & {
  readonly placementFrame?: never;
};

export type OcctBooleanExtrudeToolSource =
  | OcctBooleanExtrudePrimitiveSource
  | OcctBooleanExtrudeWireSource;

export interface OcctBooleanExtrudePrimitiveSource {
  readonly sketchPlane: OcctSketchPlane;
  readonly profile: OcctExtrudeProfile;
  readonly depth: number;
  readonly side?: OcctExtrudeSide;
  readonly placementFrame?: OcctBooleanExtrudePlacementFrame;
}

export type OcctBooleanExtrudeResultSource =
  | OcctBooleanExtrudeAddResultSource
  | OcctBooleanExtrudeCutResultSource;

export interface OcctBooleanExtrudeAddResultSource {
  readonly kind: "booleanExtrudes";
  readonly operation: "add";
  readonly target: OcctBooleanExtrudeSource;
  readonly tool: OcctBooleanExtrudeToolSource;
}

export interface OcctBooleanExtrudeCutResultSource {
  readonly kind: "booleanExtrudes";
  readonly operation: "cut";
  readonly target: OcctBooleanExtrudeSource;
  readonly tool: OcctBooleanExtrudePrimitiveSource;
}

export interface OcctBooleanExtrudePlacementFrame {
  readonly origin: readonly [number, number, number];
  readonly uAxis: readonly [number, number, number];
  readonly vAxis: readonly [number, number, number];
}

interface OcctBooleanExtrudeInputBase {
  readonly target: OcctBooleanExtrudeSource;
  readonly linearDeflection?: number;
  readonly angularDeflection?: number;
}

export type OcctBooleanExtrudeInput =
  | (OcctBooleanExtrudeInputBase & {
      readonly operation: "add";
      readonly tool: OcctBooleanExtrudeToolSource;
    })
  | (OcctBooleanExtrudeInputBase & {
      readonly operation: "cut";
      readonly tool: OcctBooleanExtrudePrimitiveSource;
    });

interface ExtrudeFrame {
  readonly origin: readonly [number, number, number];
  readonly uAxis: readonly [number, number, number];
  readonly vAxis: readonly [number, number, number];
  readonly normalAxis: readonly [number, number, number];
}

export interface OcctBooleanExtrudeShapeBuilder {
  Shape(): TopoDS_Shape;
  delete(): void;
}

export interface OcctBooleanExtrudeShapeFactories {
  readonly target: (
    oc: OpenCascadeInstance,
    source: OcctBooleanExtrudeSource
  ) => OcctBooleanExtrudeShapeBuilder;
  readonly tool: (
    oc: OpenCascadeInstance,
    source: OcctBooleanExtrudeToolSource
  ) => OcctBooleanExtrudeShapeBuilder;
}

interface OcctBooleanExtrudeBuildContext {
  readonly visited: WeakSet<object>;
  readonly depth: number;
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
  return createOcctBooleanExtrudeMeshWithShapeFactories(oc, input, {
    target: makeBooleanExtrudeMeshTargetShape,
    tool: makeBooleanExtrudeToolShape
  });
}

export function createOcctBooleanExtrudeMeshWithShapeFactories(
  oc: OpenCascadeInstance,
  input: OcctBooleanExtrudeInput,
  factories: OcctBooleanExtrudeShapeFactories
): OcctMeshData {
  assertSupportedBooleanInput(input);
  assertBooleanExtrudeRecipeWithinLimit(input.target, {
    visited: new WeakSet<object>(),
    depth: 1
  });
  const linearDeflection = input.linearDeflection ?? 0.5;
  const angularDeflection = input.angularDeflection ?? 0.5;
  let targetShape: OcctBooleanExtrudeShapeBuilder | undefined;
  let toolShape: OcctBooleanExtrudeShapeBuilder | undefined;
  let range:
    | InstanceType<OpenCascadeInstance["Message_ProgressRange_1"]>
    | undefined;
  let booleanOperation:
    | InstanceType<typeof oc.BRepAlgoAPI_Fuse_3>
    | InstanceType<typeof oc.BRepAlgoAPI_Cut_3>
    | undefined;

  try {
    targetShape = factories.target(oc, input.target);
    toolShape = factories.tool(oc, input.tool);
    range = new oc.Message_ProgressRange_1();
    let target: TopoDS_Shape | undefined;
    let tool: TopoDS_Shape | undefined;
    try {
      target = targetShape.Shape();
      tool = toolShape.Shape();
      booleanOperation =
        input.operation === "add"
          ? new oc.BRepAlgoAPI_Fuse_3(target, tool, range)
          : new oc.BRepAlgoAPI_Cut_3(target, tool, range);
    } finally {
      tool?.delete();
      target?.delete();
    }

    assertBooleanBuilderCompleted(booleanOperation, input.operation);

    let resultShape: TopoDS_Shape | undefined;
    let mesh:
      | InstanceType<OpenCascadeInstance["BRepMesh_IncrementalMesh_2"]>
      | undefined;

    try {
      resultShape = booleanOperation.Shape();
      assertValidBooleanResult(oc, resultShape, input.operation);
      mesh = new oc.BRepMesh_IncrementalMesh_2(
        resultShape,
        linearDeflection,
        false,
        angularDeflection,
        false
      );
      if (!mesh.IsDone()) {
        throw new Error(
          `Open CASCADE meshing failed with status ${mesh.GetStatusFlags()}.`
        );
      }

      return readTriangulatedShape(oc, resultShape, "boolean");
    } finally {
      mesh?.delete();
      resultShape?.delete();
    }
  } finally {
    booleanOperation?.delete();
    range?.delete();
    toolShape?.delete();
    targetShape?.delete();
  }
}

function assertSupportedBooleanInput(input: OcctBooleanExtrudeInput): void {
  const tool = input.tool as OcctBooleanExtrudeToolSource;
  if (input.operation === "cut" && tool.profile.kind === "wire") {
    throw new Error(
      "Composite wire boolean cut is not enabled in this geometry slice."
    );
  }
  if (tool.profile.kind === "wire" && tool.placementFrame !== undefined) {
    throw new Error(
      "Composite wire boolean tools use their resolved profile frame and cannot also provide placementFrame."
    );
  }
}

export function makeBooleanExtrudeShape(
  oc: OpenCascadeInstance,
  source: OcctBooleanExtrudeSource
): OcctBooleanExtrudeShapeBuilder {
  return makeBooleanExtrudeShapeWithContext(oc, source, {
    visited: new WeakSet<object>(),
    depth: 0
  });
}

function makeBooleanExtrudeMeshTargetShape(
  oc: OpenCascadeInstance,
  source: OcctBooleanExtrudeSource
): OcctBooleanExtrudeShapeBuilder {
  return makeBooleanExtrudeShapeWithContext(oc, source, {
    visited: new WeakSet<object>(),
    depth: 1
  });
}

function assertBooleanExtrudeRecipeWithinLimit(
  source: OcctBooleanExtrudeSource,
  context: OcctBooleanExtrudeBuildContext
): void {
  if (!isOcctBooleanExtrudeResultSource(source)) return;
  if (
    context.depth >= MAX_OCCT_BOOLEAN_EXTRUDE_RECIPE_DEPTH ||
    context.visited.has(source)
  ) {
    throw new Error(
      `Open CASCADE boolean recipe is cyclic or exceeds ${MAX_OCCT_BOOLEAN_EXTRUDE_RECIPE_DEPTH} result nodes.`
    );
  }
  context.visited.add(source);
  assertBooleanExtrudeRecipeWithinLimit(source.target, {
    visited: context.visited,
    depth: context.depth + 1
  });
}

function makeBooleanExtrudeShapeWithContext(
  oc: OpenCascadeInstance,
  source: OcctBooleanExtrudeSource,
  context: OcctBooleanExtrudeBuildContext
): OcctBooleanExtrudeShapeBuilder {
  if (isOcctBooleanExtrudeResultSource(source)) {
    if (
      context.depth >= MAX_OCCT_BOOLEAN_EXTRUDE_RECIPE_DEPTH ||
      context.visited.has(source)
    ) {
      throw new Error(
        `Open CASCADE boolean recipe is cyclic or exceeds ${MAX_OCCT_BOOLEAN_EXTRUDE_RECIPE_DEPTH} result nodes.`
      );
    }
    context.visited.add(source);
    return makeBooleanExtrudeResultShape(oc, source, context);
  }

  return makePrimitiveBooleanExtrudeShape(oc, source);
}

export function makeBooleanExtrudeToolShape(
  oc: OpenCascadeInstance,
  source: OcctBooleanExtrudeToolSource
): OcctBooleanExtrudeShapeBuilder {
  return isOcctBooleanExtrudeWireSource(source)
    ? makeWireExtrudeShape(oc, source)
    : makePrimitiveBooleanExtrudeShape(oc, source);
}

function isOcctBooleanExtrudeWireSource(
  source: OcctBooleanExtrudeToolSource
): source is OcctBooleanExtrudeWireSource {
  return source.profile.kind === "wire";
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
  source: OcctBooleanExtrudeResultSource,
  context: OcctBooleanExtrudeBuildContext
): OcctBooleanExtrudeShapeBuilder {
  assertSupportedBooleanInput(source);
  let targetShape: OcctBooleanExtrudeShapeBuilder | undefined;
  let toolShape: OcctBooleanExtrudeShapeBuilder | undefined;
  let range:
    | InstanceType<OpenCascadeInstance["Message_ProgressRange_1"]>
    | undefined;
  let operation:
    | InstanceType<typeof oc.BRepAlgoAPI_Fuse_3>
    | InstanceType<typeof oc.BRepAlgoAPI_Cut_3>
    | undefined;

  try {
    targetShape = makeBooleanExtrudeShapeWithContext(oc, source.target, {
      visited: context.visited,
      depth: context.depth + 1
    });
    toolShape = makeBooleanExtrudeToolShape(oc, source.tool);
    range = new oc.Message_ProgressRange_1();
    let target: TopoDS_Shape | undefined;
    let tool: TopoDS_Shape | undefined;
    try {
      target = targetShape.Shape();
      tool = toolShape.Shape();
      operation =
        source.operation === "add"
          ? new oc.BRepAlgoAPI_Fuse_3(target, tool, range)
          : new oc.BRepAlgoAPI_Cut_3(target, tool, range);
    } finally {
      tool?.delete();
      target?.delete();
    }

    assertBooleanBuilderCompleted(operation, source.operation);

    const result = operation.Shape();
    try {
      assertValidBooleanResult(oc, result, source.operation);
    } finally {
      result.delete();
    }

    return operation;
  } catch (error) {
    operation?.delete();
    throw error;
  } finally {
    range?.delete();
    toolShape?.delete();
    targetShape?.delete();
  }
}

function assertBooleanBuilderCompleted(
  operation:
    | InstanceType<OpenCascadeInstance["BRepAlgoAPI_Fuse_3"]>
    | InstanceType<OpenCascadeInstance["BRepAlgoAPI_Cut_3"]>,
  kind: OcctBooleanOperation
): void {
  if (!operation.IsDone()) {
    throw new Error(`Open CASCADE boolean ${kind} builder did not complete.`);
  }
  if (operation.HasErrors()) {
    throw new Error(`Open CASCADE boolean ${kind} failed.`);
  }
}

function assertValidBooleanResult(
  oc: OpenCascadeInstance,
  shape: TopoDS_Shape,
  operation: OcctBooleanOperation
): void {
  if (shape.IsNull()) {
    throw new Error(`Open CASCADE boolean ${operation} returned a null shape.`);
  }
  const analyzer = new oc.BRepCheck_Analyzer(shape, true, false);
  try {
    if (!analyzer.IsValid_2()) {
      throw new Error(
        `Open CASCADE boolean ${operation} returned an invalid shape.`
      );
    }
  } finally {
    analyzer.delete();
  }
  if (operation === "add") {
    assertBooleanAddSolidCount(countSolids(oc, shape));
  }
}

export function assertBooleanAddSolidCount(solidCount: number): void {
  if (solidCount !== 1) {
    throw new Error(
      `Open CASCADE boolean add must return exactly one solid; received ${solidCount}.`
    );
  }
}

function countSolids(oc: OpenCascadeInstance, shape: TopoDS_Shape): number {
  const explorer = new oc.TopExp_Explorer_2(
    shape,
    oc.TopAbs_ShapeEnum.TopAbs_SOLID as ConstructorParameters<
      typeof oc.TopExp_Explorer_2
    >[1],
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
