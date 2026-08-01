import type { OpenCascadeInstance } from "opencascade.js";
import { withImportedBrepShape } from "./exactMetadata";
import type { OcctLoader } from "./tessellateBox";

export type OcctStepExportUnit = "mm" | "cm" | "m" | "in";
export type OcctStepExportSchema = "AP242DIS";

export interface OcctStepExportArtifactBody {
  readonly bodyId: string;
  readonly bodyName: string;
  readonly brepFormat: "occt-brep";
  readonly brepByteLength: number;
  readonly brepSha256: string;
  readonly brepBytes: Uint8Array;
}

export interface OcctStepExportInput {
  readonly units: OcctStepExportUnit;
  readonly schema?: OcctStepExportSchema;
  readonly bodies: readonly OcctStepExportArtifactBody[];
}

export interface OcctStepExportArtifact {
  readonly format: "step";
  readonly schema: OcctStepExportSchema;
  readonly units: OcctStepExportUnit;
  readonly bodyCount: number;
  readonly byteLength: number;
  readonly bytes: Uint8Array;
}

export interface OcctStepWriterCapability {
  readonly format: "step";
  readonly label: "STEP";
  readonly status: "available" | "unavailable";
  readonly writerAvailable: boolean;
  readonly namedWriterAvailable: boolean;
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

export const OCCT_BASIC_STEP_WRITER_REQUIRED_BINDINGS = [
  "STEPControl_Writer_1",
  "STEPControl_StepModelType.STEPControl_AsIs",
  "IFSelect_ReturnStatus.IFSelect_RetDone",
  "Interface_Static.SetCVal",
  "Message_ProgressRange_1",
  "FS.readFile",
  "FS.unlink"
] as const;

export const OCCT_NAMED_STEP_WRITER_REQUIRED_BINDINGS = [
  "STEPCAFControl_Controller.Init",
  "STEPCAFControl_Writer_1",
  "STEPCAFControl_Writer.prototype.SetNameMode",
  "STEPCAFControl_Writer.prototype.Transfer_1",
  "STEPCAFControl_Writer.prototype.Write",
  "TCollection_ExtendedString_2",
  "TDocStd_Document.prototype.Main",
  "XCAFApp_Application.GetApplication",
  "TDocStd_Application.prototype.NewDocument_2",
  "TDocStd_Application.prototype.Close",
  "Handle_TDocStd_Document_1",
  "XCAFDoc_DocumentTool.ShapeTool",
  "XCAFDoc_ShapeTool.prototype.AddShape",
  "TDataStd_Name.Set_1",
  "BRepTools.Read_2",
  "BRep_Builder",
  "TopoDS_Shape",
  "FS.writeFile"
] as const;

export const OCCT_STEP_WRITER_REQUIRED_BINDINGS = [
  ...OCCT_BASIC_STEP_WRITER_REQUIRED_BINDINGS,
  ...OCCT_NAMED_STEP_WRITER_REQUIRED_BINDINGS
] as const;

export async function createOcctStepExportWithLoader(
  loadOcct: OcctLoader,
  input: OcctStepExportInput
): Promise<OcctStepExportArtifact> {
  return createOcctStepExportWithInstance(await loadOcct(), input);
}

export function createOcctStepExportWithInstance(
  oc: OpenCascadeInstance,
  input: OcctStepExportInput
): OcctStepExportArtifact {
  assertStepWriterBindings(oc);
  if (input.bodies.length === 0) {
    throw new Error("STEP export requires at least one exact body artifact.");
  }

  const resources: Array<{ delete(): void }> = [];
  const own = <T extends { delete(): void }>(resource: T): T => {
    resources.push(resource);
    return resource;
  };
  const schema = input.schema ?? DEFAULT_STEP_SCHEMA;
  const filename = `/tmp/partbench-step-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.step`;
  const fs = getOcctFs(oc);
  const applicationHandle = oc.XCAFApp_Application.GetApplication();
  const application = applicationHandle.get();
  const documentHandle = new oc.Handle_TDocStd_Document_1();
  let documentOpened = false;

  try {
    const storageFormat = own(
      new oc.TCollection_ExtendedString_2("BinXCAF", false)
    );
    application.NewDocument_2(storageFormat, documentHandle);
    documentOpened = true;
    const main = own(documentHandle.get().Main());
    const shapeToolHandle = own(oc.XCAFDoc_DocumentTool.ShapeTool(main));
    const shapeTool = shapeToolHandle.get();

    for (const body of input.bodies) {
      withImportedBrepShape(oc, body.brepBytes, (shape) => {
        const label = own(shapeTool.AddShape(shape, false, false));
        const bodyName = body.bodyName.trim() || body.bodyId;
        const name = own(new oc.TCollection_ExtendedString_2(bodyName, true));
        own(oc.TDataStd_Name.Set_1(label, name));
      });
    }

    if (!oc.STEPCAFControl_Controller.Init()) {
      throw new Error("Open CASCADE STEPCAF controller initialization failed.");
    }
    setStepWriterStatic(oc, "write.step.schema", schema);
    setStepWriterStatic(oc, "write.step.unit", mapStepUnit(input.units));

    const progress = own(new oc.Message_ProgressRange_1());
    const writer = own(new oc.STEPCAFControl_Writer_1());
    writer.SetNameMode(true);
    const asIsStepModelType = oc.STEPControl_StepModelType
      .STEPControl_AsIs as unknown as Parameters<typeof writer.Transfer_1>[1];
    if (
      !writer.Transfer_1(
        documentHandle,
        asIsStepModelType,
        null as unknown as string,
        progress
      )
    ) {
      throw new Error("Open CASCADE named STEP transfer did not complete.");
    }
    if (writer.Write(filename) !== oc.IFSelect_ReturnStatus.IFSelect_RetDone) {
      throw new Error("Open CASCADE named STEP write did not complete.");
    }

    const bytes = fs.readFile(filename);
    if (bytes.byteLength === 0) {
      throw new Error("Open CASCADE named STEP write returned empty bytes.");
    }
    return {
      format: "step",
      schema,
      units: input.units,
      bodyCount: input.bodies.length,
      byteLength: bytes.byteLength,
      bytes
    };
  } finally {
    for (const resource of resources.reverse()) resource.delete();
    if (documentOpened) application.Close(documentHandle);
    documentHandle.delete();
    applicationHandle.delete();
    try {
      fs.unlink(filename);
    } catch {
      // The write may fail before the file exists.
    }
  }
}

export function getOcctStepWriterCapabilityWithInstance(
  oc: Partial<OpenCascadeInstance>
): OcctStepWriterCapability {
  const availableBindings = OCCT_STEP_WRITER_REQUIRED_BINDINGS.filter(
    (binding) => hasBinding(oc, binding)
  );
  const missingBindings = OCCT_STEP_WRITER_REQUIRED_BINDINGS.filter(
    (binding) => !availableBindings.includes(binding)
  );
  const writerAvailable = OCCT_BASIC_STEP_WRITER_REQUIRED_BINDINGS.every(
    (binding) => availableBindings.includes(binding)
  );
  const namedWriterAvailable = OCCT_NAMED_STEP_WRITER_REQUIRED_BINDINGS.every(
    (binding) => availableBindings.includes(binding)
  );

  return {
    format: "step",
    label: "STEP",
    status:
      writerAvailable && namedWriterAvailable ? "available" : "unavailable",
    writerAvailable,
    namedWriterAvailable,
    boundary: "occt-wasm",
    packageName: "opencascade.js",
    packageVersion: STEP_WRITER_PACKAGE_VERSION,
    checkedBindings: OCCT_STEP_WRITER_REQUIRED_BINDINGS,
    availableBindings,
    missingBindings,
    reason:
      writerAvailable && namedWriterAvailable
        ? "The current OpenCascade.js boundary exposes basic STEP transfer and named XDE AP242 artifact writing."
        : "The current OpenCascade.js boundary is missing bindings required for basic STEP transfer or named XDE AP242 artifact writing."
  };
}

export async function getOcctStepWriterCapabilityWithLoader(
  loadOcct: OcctLoader
): Promise<OcctStepWriterCapability> {
  return getOcctStepWriterCapabilityWithInstance(await loadOcct());
}

function assertStepWriterBindings(oc: OpenCascadeInstance): void {
  const capability = getOcctStepWriterCapabilityWithInstance(oc);
  if (capability.status === "unavailable") {
    throw new Error(
      `Open CASCADE named STEP writer bindings unavailable: ${capability.missingBindings.join(
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
  return unit === "in" ? "INCH" : unit.toUpperCase();
}

function hasBinding(
  root: Partial<OpenCascadeInstance>,
  binding: string
): boolean {
  let value: unknown = root;
  for (const part of binding.split(".")) {
    if ((typeof value !== "object" && typeof value !== "function") || !value) {
      return false;
    }
    value = (value as Record<string, unknown>)[part];
  }
  return value !== undefined && value !== null;
}

function getOcctFs(oc: OpenCascadeInstance): {
  readonly readFile: (path: string) => Uint8Array;
  readonly unlink: (path: string) => void;
} {
  const fs = oc.FS;
  if (!fs?.readFile || !fs.unlink) {
    throw new Error("Open CASCADE STEP writer file system is unavailable.");
  }
  return { readFile: fs.readFile, unlink: fs.unlink };
}
