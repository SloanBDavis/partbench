import type { OpenCascadeInstance } from "opencascade.js";
import {
  makeBooleanExtrudeShape,
  type OcctBooleanExtrudePrimitiveSource,
  type OcctBooleanExtrudeResultSource
} from "./booleanExtrudes";
import type { OcctLoader } from "./tessellateBox";
import {
  makeWireExtrudeShape,
  type OcctWireExtrudeSource
} from "./wireExtrude";
import {
  makeRevolveProfileShape,
  type OcctRevolveAxis,
  type OcctRevolvePlacementFrame,
  type OcctRevolveProfile,
  type OcctRevolveSketchPlane
} from "./revolveProfile";

export interface OcctStepExportRevolveSource {
  readonly kind: "revolve";
  readonly sketchPlane: OcctRevolveSketchPlane;
  readonly profile: OcctRevolveProfile;
  readonly axis: OcctRevolveAxis;
  readonly angleDegrees: number;
  readonly placementFrame?: OcctRevolvePlacementFrame;
}

export type OcctStepExportUnit = "mm" | "cm" | "m" | "in";
export type OcctStepExportSchema = "AP242DIS";

export type OcctStepExportBodySource = (
  | OcctBooleanExtrudePrimitiveSource
  | OcctBooleanExtrudeResultSource
  | OcctWireExtrudeSource
  | OcctStepExportRevolveSource
) & {
  readonly bodyId: string;
  readonly bodyName?: string;
};

export interface OcctStepExportInput {
  readonly units: OcctStepExportUnit;
  readonly schema?: OcctStepExportSchema;
  readonly bodies: readonly OcctStepExportBodySource[];
}

export interface OcctStepExportArtifact {
  readonly format: "step";
  readonly schema: OcctStepExportSchema;
  readonly units: OcctStepExportUnit;
  readonly bodyCount: number;
  readonly byteLength: number;
  readonly bytes: Uint8Array;
}

export type OcctStepExportShapeFactory = (
  oc: OpenCascadeInstance,
  body: OcctStepExportBodySource
) => {
  Shape(): InstanceType<OpenCascadeInstance["TopoDS_Shape"]>;
  delete(): void;
};

export type OcctStepWriterCapabilityStatus = "available" | "unavailable";

export interface OcctStepWriterCapability {
  readonly format: "step";
  readonly label: "STEP";
  readonly status: OcctStepWriterCapabilityStatus;
  readonly writerAvailable: boolean;
  readonly boundary: "occt-wasm";
  readonly packageName: "opencascade.js";
  readonly packageVersion: "2.0.0-beta.b5ff984";
  readonly checkedBindings: readonly string[];
  readonly availableBindings: readonly string[];
  readonly missingBindings: readonly string[];
  readonly reason: string;
}

const STEP_WRITER_PACKAGE_VERSION = "2.0.0-beta.b5ff984";
const DEFAULT_STEP_SCHEMA: OcctStepExportSchema = "AP242DIS";

export const OCCT_STEP_WRITER_REQUIRED_BINDINGS = [
  "STEPControl_Writer_1",
  "STEPControl_StepModelType.STEPControl_AsIs",
  "IFSelect_ReturnStatus.IFSelect_RetDone",
  "Interface_Static.SetCVal",
  "Message_ProgressRange_1",
  "FS.readFile",
  "FS.unlink",
  "BRepPrimAPI_MakeBox_5",
  "BRepPrimAPI_MakeCylinder_3"
] as const;

export async function createOcctStepExportWithLoader(
  loadOcct: OcctLoader,
  input: OcctStepExportInput
): Promise<OcctStepExportArtifact> {
  const oc = await loadOcct();

  return createOcctStepExportWithInstance(oc, input);
}

export function createOcctStepExportWithInstance(
  oc: OpenCascadeInstance,
  input: OcctStepExportInput
): OcctStepExportArtifact {
  return createOcctStepExportWithShapeFactory(
    oc,
    input,
    createOcctStepExportShape
  );
}

export function createOcctStepExportWithShapeFactory(
  oc: OpenCascadeInstance,
  input: OcctStepExportInput,
  createShape: OcctStepExportShapeFactory
): OcctStepExportArtifact {
  assertStepWriterBindings(oc);

  if (input.bodies.length === 0) {
    throw new Error("STEP export requires at least one exact body source.");
  }

  const schema = input.schema ?? DEFAULT_STEP_SCHEMA;
  let writer:
    | InstanceType<OpenCascadeInstance["STEPControl_Writer_1"]>
    | undefined;
  let progress:
    | InstanceType<OpenCascadeInstance["Message_ProgressRange_1"]>
    | undefined;
  const shapes: ReturnType<OcctStepExportShapeFactory>[] = [];
  const filename = `/tmp/partbench-step-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.step`;

  try {
    writer = new oc.STEPControl_Writer_1();
    progress = new oc.Message_ProgressRange_1();
    const asIsStepModelType = oc.STEPControl_StepModelType
      .STEPControl_AsIs as unknown as Parameters<typeof writer.Transfer>[1];

    for (const body of input.bodies) {
      shapes.push(createShape(oc, body));
    }

    setStepWriterStatic(oc, "write.step.schema", schema);
    setStepWriterStatic(oc, "write.step.unit", mapStepUnit(input.units));

    for (const shape of shapes) {
      const exactShape = shape.Shape();
      let status: ReturnType<typeof writer.Transfer>;
      try {
        status = writer.Transfer(exactShape, asIsStepModelType, true, progress);
      } finally {
        exactShape.delete();
      }

      if (status !== oc.IFSelect_ReturnStatus.IFSelect_RetDone) {
        throw new Error("Open CASCADE STEP transfer did not complete.");
      }
    }

    const writeStatus = writer.Write(filename);

    if (writeStatus !== oc.IFSelect_ReturnStatus.IFSelect_RetDone) {
      throw new Error("Open CASCADE STEP write did not complete.");
    }

    const bytes = getOcctFs(oc).readFile(filename);

    return {
      format: "step",
      schema,
      units: input.units,
      bodyCount: input.bodies.length,
      byteLength: bytes.byteLength,
      bytes
    };
  } finally {
    try {
      getOcctFs(oc).unlink(filename);
    } catch {
      // The file may not exist if transfer failed before writing.
    }

    for (const shape of shapes) {
      shape.delete();
    }

    progress?.delete();
    writer?.delete();
  }
}

function createOcctStepExportShape(
  oc: OpenCascadeInstance,
  body: OcctStepExportBodySource
): ReturnType<OcctStepExportShapeFactory> {
  if ((body as { readonly kind?: unknown }).kind === "revolve") {
    return makeRevolveProfileShape(oc, body as OcctStepExportRevolveSource);
  }
  if ((body as { readonly kind?: unknown }).kind === "booleanExtrudes") {
    return makeBooleanExtrudeShape(oc, body as OcctBooleanExtrudeResultSource);
  }
  const extrude = body as (
    | OcctBooleanExtrudePrimitiveSource
    | OcctWireExtrudeSource
  ) & { readonly bodyId: string };
  return extrude.profile.kind === "wire"
    ? makeWireExtrudeShape(oc, extrude as OcctWireExtrudeSource)
    : makeBooleanExtrudeShape(oc, extrude as OcctBooleanExtrudePrimitiveSource);
}

export function getOcctStepWriterCapabilityWithInstance(
  oc: Partial<OpenCascadeInstance>
): OcctStepWriterCapability {
  const availableBindings = OCCT_STEP_WRITER_REQUIRED_BINDINGS.filter(
    (binding) => hasStepWriterBinding(oc, binding)
  );
  const missingBindings = OCCT_STEP_WRITER_REQUIRED_BINDINGS.filter(
    (binding) => !availableBindings.includes(binding)
  );
  const writerAvailable = missingBindings.length === 0;

  return {
    format: "step",
    label: "STEP",
    status: writerAvailable ? "available" : "unavailable",
    writerAvailable,
    boundary: "occt-wasm",
    packageName: "opencascade.js",
    packageVersion: STEP_WRITER_PACKAGE_VERSION,
    checkedBindings: OCCT_STEP_WRITER_REQUIRED_BINDINGS,
    availableBindings,
    missingBindings,
    reason: writerAvailable
      ? "The current OpenCascade.js boundary exposes the STEP writer, transfer status, file-system, and supported extrude shape bindings."
      : "The current OpenCascade.js boundary does not expose every binding required for minimal exact STEP export."
  };
}

export async function getOcctStepWriterCapabilityWithLoader(
  loadOcct: OcctLoader
): Promise<OcctStepWriterCapability> {
  const oc = await loadOcct();

  return getOcctStepWriterCapabilityWithInstance(oc);
}

function assertStepWriterBindings(oc: OpenCascadeInstance): void {
  const capability = getOcctStepWriterCapabilityWithInstance(oc);

  if (!capability.writerAvailable) {
    throw new Error(
      `Open CASCADE STEP writer bindings unavailable: ${capability.missingBindings.join(
        ", "
      )}.`
    );
  }
}

function setStepWriterStatic(
  oc: OpenCascadeInstance,
  name: string,
  value: string
): void {
  if (!oc.Interface_Static.SetCVal(name, value)) {
    throw new Error(`Open CASCADE rejected STEP writer option ${name}.`);
  }
}

function mapStepUnit(unit: OcctStepExportUnit): string {
  switch (unit) {
    case "mm":
      return "MM";
    case "cm":
      return "CM";
    case "m":
      return "M";
    case "in":
      return "INCH";
  }
}

function hasStepWriterBinding(
  oc: Partial<OpenCascadeInstance>,
  binding: string
): boolean {
  switch (binding) {
    case "STEPControl_Writer_1":
      return typeof oc.STEPControl_Writer_1 === "function";
    case "STEPControl_StepModelType.STEPControl_AsIs":
      return Boolean(oc.STEPControl_StepModelType?.STEPControl_AsIs);
    case "IFSelect_ReturnStatus.IFSelect_RetDone":
      return Boolean(oc.IFSelect_ReturnStatus?.IFSelect_RetDone);
    case "Interface_Static.SetCVal":
      return typeof oc.Interface_Static?.SetCVal === "function";
    case "Message_ProgressRange_1":
      return typeof oc.Message_ProgressRange_1 === "function";
    case "FS.readFile":
      return typeof getOptionalOcctFs(oc)?.readFile === "function";
    case "FS.unlink":
      return typeof getOptionalOcctFs(oc)?.unlink === "function";
    case "BRepPrimAPI_MakeBox_5":
      return typeof oc.BRepPrimAPI_MakeBox_5 === "function";
    case "BRepPrimAPI_MakeCylinder_3":
      return typeof oc.BRepPrimAPI_MakeCylinder_3 === "function";
    default:
      return false;
  }
}

function getOcctFs(oc: OpenCascadeInstance): {
  readonly readFile: (path: string) => Uint8Array;
  readonly unlink: (path: string) => void;
} {
  const fs = getOptionalOcctFs(oc);

  if (!fs) {
    throw new Error("Open CASCADE virtual file system is unavailable.");
  }

  if (typeof fs.readFile !== "function" || typeof fs.unlink !== "function") {
    throw new Error("Open CASCADE virtual file system is incomplete.");
  }

  return {
    readFile: fs.readFile,
    unlink: fs.unlink
  };
}

function getOptionalOcctFs(oc: Partial<OpenCascadeInstance>):
  | {
      readonly readFile?: (path: string) => Uint8Array;
      readonly unlink?: (path: string) => void;
    }
  | undefined {
  return (
    oc as Partial<OpenCascadeInstance> & {
      readonly FS?: {
        readonly readFile?: (path: string) => Uint8Array;
        readonly unlink?: (path: string) => void;
      };
    }
  ).FS;
}
