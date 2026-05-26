import type { OpenCascadeInstance, TopoDS_Shape } from "opencascade.js";
import {
  makeBooleanExtrudeShape,
  type OcctBooleanExtrudeInput,
  type OcctBooleanExtrudeSource
} from "./booleanExtrudes";
import type { OcctLoader } from "./tessellateBox";

export type OcctExactBodyMetadataSource =
  | OcctExactExtrudeMetadataSource
  | OcctExactBooleanExtrudesMetadataSource;

export interface OcctExactExtrudeMetadataSource extends OcctBooleanExtrudeSource {
  readonly kind: "extrude";
}

export interface OcctExactBooleanExtrudesMetadataSource {
  readonly kind: "booleanExtrudes";
  readonly operation: OcctBooleanExtrudeInput["operation"];
  readonly target: OcctBooleanExtrudeSource;
  readonly tool: OcctBooleanExtrudeSource;
}

export interface OcctExactBodyMetadataInput {
  readonly source: OcctExactBodyMetadataSource;
}

export interface OcctExactBodyMetadata {
  readonly sourceKind: OcctExactBodyMetadataSource["kind"];
  readonly bounds: {
    readonly min: readonly [number, number, number];
    readonly max: readonly [number, number, number];
  };
  readonly volume: number;
  readonly surfaceArea: number;
  readonly centroid: readonly [number, number, number];
  readonly topologyCounts: {
    readonly solidCount: number;
    readonly faceCount: number;
    readonly edgeCount: number;
    readonly vertexCount: number;
  };
  readonly measurementSource: "kernel-derived";
  readonly measurementConfidence: "kernel-derived";
  readonly diagnostics: readonly {
    readonly code: string;
    readonly message: string;
  }[];
}

interface UnavailableBindingError {
  readonly code: "UNAVAILABLE_BINDING";
  readonly message: string;
}

interface EmptyResultError {
  readonly code: "EMPTY_RESULT";
  readonly message: string;
}

export async function createOcctExactBodyMetadataWithLoader(
  loadOcct: OcctLoader,
  input: OcctExactBodyMetadataInput
): Promise<OcctExactBodyMetadata> {
  const oc = await loadOcct();

  return createOcctExactBodyMetadataWithInstance(oc, input);
}

export function createOcctExactBodyMetadataWithInstance(
  oc: OpenCascadeInstance,
  input: OcctExactBodyMetadataInput
): OcctExactBodyMetadata {
  assertExactMetadataBindings(oc);

  if (input.source.kind === "extrude") {
    const shapeBuilder = makeBooleanExtrudeShape(oc, input.source);

    try {
      return readExactBodyMetadata(oc, shapeBuilder.Shape(), input.source.kind);
    } finally {
      shapeBuilder.delete();
    }
  }

  return readBooleanExactBodyMetadata(oc, input.source);
}

function readBooleanExactBodyMetadata(
  oc: OpenCascadeInstance,
  source: OcctExactBooleanExtrudesMetadataSource
): OcctExactBodyMetadata {
  const targetShape = makeBooleanExtrudeShape(oc, source.target);
  const toolShape = makeBooleanExtrudeShape(oc, source.tool);
  const range = new oc.Message_ProgressRange_1();
  let booleanOperation:
    | InstanceType<typeof oc.BRepAlgoAPI_Fuse_3>
    | InstanceType<typeof oc.BRepAlgoAPI_Cut_3>
    | undefined;

  try {
    booleanOperation =
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

    if (booleanOperation.HasErrors()) {
      throw new Error(`Open CASCADE boolean ${source.operation} failed.`);
    }

    return readExactBodyMetadata(oc, booleanOperation.Shape(), source.kind);
  } finally {
    booleanOperation?.delete();
    range.delete();
    targetShape.delete();
    toolShape.delete();
  }
}

function readExactBodyMetadata(
  oc: OpenCascadeInstance,
  shape: TopoDS_Shape,
  sourceKind: OcctExactBodyMetadataSource["kind"]
): OcctExactBodyMetadata {
  const bounds = readBounds(oc, shape);
  const volumeProps = new oc.GProp_GProps_1();
  const surfaceProps = new oc.GProp_GProps_1();

  try {
    oc.BRepGProp.VolumeProperties_1(shape, volumeProps, true, false, false);
    oc.BRepGProp.SurfaceProperties_1(shape, surfaceProps, false, false);

    const centroidPoint = volumeProps.CentreOfMass();

    try {
      return {
        sourceKind,
        bounds,
        volume: Math.abs(volumeProps.Mass()),
        surfaceArea: Math.abs(surfaceProps.Mass()),
        centroid: [centroidPoint.X(), centroidPoint.Y(), centroidPoint.Z()],
        topologyCounts: {
          solidCount: countSubshapes(oc, shape, "TopAbs_SOLID"),
          faceCount: countSubshapes(oc, shape, "TopAbs_FACE"),
          edgeCount: countSubshapes(oc, shape, "TopAbs_EDGE"),
          vertexCount: countSubshapes(oc, shape, "TopAbs_VERTEX")
        },
        measurementSource: "kernel-derived",
        measurementConfidence: "kernel-derived",
        diagnostics: []
      };
    } finally {
      centroidPoint.delete();
    }
  } finally {
    volumeProps.delete();
    surfaceProps.delete();
  }
}

function readBounds(
  oc: OpenCascadeInstance,
  shape: TopoDS_Shape
): OcctExactBodyMetadata["bounds"] {
  const bounds = new oc.Bnd_Box_1();

  try {
    oc.BRepBndLib.AddOptimal(shape, bounds, false, true);

    if (bounds.IsVoid()) {
      throw {
        code: "EMPTY_RESULT",
        message: "Open CASCADE returned an empty exact metadata bounds box."
      } satisfies EmptyResultError;
    }

    const min = bounds.CornerMin();
    const max = bounds.CornerMax();

    try {
      return {
        min: [min.X(), min.Y(), min.Z()],
        max: [max.X(), max.Y(), max.Z()]
      };
    } finally {
      min.delete();
      max.delete();
    }
  } finally {
    bounds.delete();
  }
}

function countSubshapes(
  oc: OpenCascadeInstance,
  shape: TopoDS_Shape,
  shapeTypeKey: "TopAbs_SOLID" | "TopAbs_FACE" | "TopAbs_EDGE" | "TopAbs_VERTEX"
): number {
  const toFind = oc.TopAbs_ShapeEnum[shapeTypeKey] as unknown as Parameters<
    typeof oc.TopExp.MapShapes_1
  >[1];
  const shapeMap = new oc.TopTools_IndexedMapOfShape_1();

  try {
    oc.TopExp.MapShapes_1(shape, toFind, shapeMap);
    return shapeMap.Size();
  } finally {
    shapeMap.delete();
  }
}

function assertExactMetadataBindings(oc: OpenCascadeInstance): void {
  const bindings: readonly [string, unknown][] = [
    ["BRepBndLib.AddOptimal", oc.BRepBndLib?.AddOptimal],
    ["BRepGProp.VolumeProperties_1", oc.BRepGProp?.VolumeProperties_1],
    ["BRepGProp.SurfaceProperties_1", oc.BRepGProp?.SurfaceProperties_1],
    ["GProp_GProps_1", oc.GProp_GProps_1],
    ["Bnd_Box_1", oc.Bnd_Box_1],
    ["TopExp.MapShapes_1", oc.TopExp?.MapShapes_1],
    ["TopTools_IndexedMapOfShape_1", oc.TopTools_IndexedMapOfShape_1],
    ["TopAbs_ShapeEnum", oc.TopAbs_ShapeEnum]
  ];
  const missing = bindings
    .filter(([, value]) => value === undefined || value === null)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw {
      code: "UNAVAILABLE_BINDING",
      message: `Open CASCADE exact metadata bindings are unavailable: ${missing.join(", ")}.`
    } satisfies UnavailableBindingError;
  }
}
