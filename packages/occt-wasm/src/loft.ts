import type { OpenCascadeInstance, TopoDS_Shape } from "opencascade.js";
import {
  getSketchFrame,
  makeProfileFace,
  type OcctRevolvePlacementFrame,
  type OcctPrimitiveRevolveProfile,
  type OcctRevolveSketchPlane,
  type ProfileFaceHandle
} from "./revolveProfile";
import {
  readTriangulatedShape,
  type OcctMeshData
} from "./readTriangulatedShape";
import type { OcctLoader } from "./tessellateBox";

export interface OcctLoftSection {
  readonly sketchPlane: OcctRevolveSketchPlane;
  readonly profile: OcctPrimitiveRevolveProfile;
  readonly placementFrame?: OcctRevolvePlacementFrame;
}

export interface OcctLoftInput {
  readonly sections: readonly OcctLoftSection[];
  readonly linearDeflection?: number;
  readonly angularDeflection?: number;
}

export interface OcctLoftShapeHandle {
  readonly shape: TopoDS_Shape;
  readonly delete: () => void;
}

export async function createOcctLoftMeshWithLoader(
  loadOcct: OcctLoader,
  input: OcctLoftInput
): Promise<OcctMeshData> {
  return createOcctLoftMeshWithInstance(await loadOcct(), input);
}

export function createOcctLoftMeshWithInstance(
  oc: OpenCascadeInstance,
  input: OcctLoftInput
): OcctMeshData {
  const handle = makeLoftShape(oc, input);
  try {
    const mesher = new oc.BRepMesh_IncrementalMesh_2(
      handle.shape,
      input.linearDeflection ?? 0.5,
      false,
      input.angularDeflection ?? 0.5,
      false
    );
    try {
      if (!mesher.IsDone()) {
        throw {
          code: "LOFT_GEOMETRY_FAILED",
          message: `Open CASCADE loft meshing failed with status ${mesher.GetStatusFlags()}.`
        };
      }
      return readTriangulatedShape(oc, handle.shape, "loft");
    } finally {
      mesher.delete();
    }
  } finally {
    handle.delete();
  }
}

export function makeLoftShape(
  oc: OpenCascadeInstance,
  input: Omit<OcctLoftInput, "linearDeflection" | "angularDeflection">
): OcctLoftShapeHandle {
  if (input.sections.length < 2) {
    throw {
      code: "LOFT_SECTION_UNSUPPORTED",
      message: "Open CASCADE loft requires at least two profile sections."
    };
  }
  if (!oc.BRepOffsetAPI_ThruSections) {
    throw {
      code: "UNAVAILABLE_BINDING",
      message: "Open CASCADE BRepOffsetAPI_ThruSections binding is unavailable."
    };
  }

  const profiles: ProfileFaceHandle[] = [];
  const range = new oc.Message_ProgressRange_1();
  const loft = new oc.BRepOffsetAPI_ThruSections(true, false, 1e-6);
  try {
    for (const section of input.sections) {
      const profile = makeProfileFace(
        oc,
        getSketchFrame(section.sketchPlane, section.placementFrame),
        section.profile
      );
      profiles.push(profile);
      loft.AddWire(profile.wire);
    }
    loft.CheckCompatibility(true);
    loft.Build(range);
    if (!loft.IsDone()) {
      throw {
        code: "LOFT_GEOMETRY_FAILED",
        message: "Open CASCADE ThruSections did not produce a loft result."
      };
    }
    const shape = loft.Shape();
    return {
      shape,
      delete: () => {
        shape.delete();
        loft.delete();
        range.delete();
        profiles.forEach((profile) => profile.delete());
      }
    };
  } catch (error) {
    loft.delete();
    range.delete();
    profiles.forEach((profile) => profile.delete());
    throw error;
  }
}
