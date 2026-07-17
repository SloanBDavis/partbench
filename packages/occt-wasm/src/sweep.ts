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

export interface OcctSweepPathSegment {
  readonly start: OcctSweepPoint;
  readonly end: OcctSweepPoint;
}

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
          code: "SWEEP_GEOMETRY_FAILED",
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
  assertSweepBindings(oc);
  if (input.pathSegments.length !== 1) {
    throw {
      code: "SWEEP_PATH_UNSUPPORTED",
      message: "Open CASCADE sweep currently supports one line path segment."
    };
  }

  const segment = input.pathSegments[0];
  const start = new oc.gp_Pnt_3(...segment.start);
  const end = new oc.gp_Pnt_3(...segment.end);
  const edgeBuilder = new oc.BRepBuilderAPI_MakeEdge_3(start, end);
  const edge = edgeBuilder.Edge();
  const wireBuilder = new oc.BRepBuilderAPI_MakeWire_2(edge);
  const wire = wireBuilder.Wire();
  const profileFace = makeProfileFace(
    oc,
    getSketchFrame(input.profile.sketchPlane, input.profile.placementFrame),
    input.profile.profile
  );
  const range = new oc.Message_ProgressRange_1();
  let pipe: InstanceType<typeof oc.BRepOffsetAPI_MakePipe_1> | undefined;

  try {
    pipe = new oc.BRepOffsetAPI_MakePipe_1(wire, profileFace.face);
    pipe.Build(range);
    if (!pipe.IsDone()) {
      throw {
        code: "SWEEP_GEOMETRY_FAILED",
        message: "Open CASCADE MakePipe did not produce a sweep result."
      };
    }
    const shape = pipe.Shape();
    return {
      shape,
      delete: () => {
        shape.delete();
        pipe?.delete();
        range.delete();
        profileFace.delete();
        wire.delete();
        wireBuilder.delete();
        edge.delete();
        edgeBuilder.delete();
        start.delete();
        end.delete();
      }
    };
  } catch (error) {
    pipe?.delete();
    range.delete();
    profileFace.delete();
    wire.delete();
    wireBuilder.delete();
    edge.delete();
    edgeBuilder.delete();
    start.delete();
    end.delete();
    throw error;
  }
}

function assertSweepBindings(oc: OpenCascadeInstance): void {
  const required: readonly [string, unknown][] = [
    ["BRepBuilderAPI_MakeEdge_3", oc.BRepBuilderAPI_MakeEdge_3],
    ["BRepBuilderAPI_MakeWire_2", oc.BRepBuilderAPI_MakeWire_2],
    ["BRepOffsetAPI_MakePipe_1", oc.BRepOffsetAPI_MakePipe_1],
    ["Message_ProgressRange_1", oc.Message_ProgressRange_1],
    ["gp_Pnt_3", oc.gp_Pnt_3]
  ];
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
