import type { OpenCascadeInstance } from "opencascade.js";
import { createOcctExactBodyArtifactWithInstance } from "./exactCheckpointPayload";
import { createOcctStepExportWithInstance } from "./exactStepExport";
import type { OcctLoader } from "./tessellateBox";

export type OcctNamedStepProbeUnit = "mm" | "cm" | "m" | "in";

export interface OcctNamedStepProbeCapability {
  readonly status: "available" | "unavailable";
  readonly namedStepAvailable: boolean;
  readonly checkedBindings: readonly string[];
  readonly availableBindings: readonly string[];
  readonly missingBindings: readonly string[];
  readonly reason: string;
}

export interface OcctNamedStepUnitProbeResult {
  readonly unit: OcctNamedStepProbeUnit;
  readonly schema: "AP242DIS";
  readonly bodyCount: 2;
  readonly names: readonly string[];
  readonly fileSchemas: readonly string[];
  readonly fileUnits: readonly string[];
  readonly nonNullShapeCount: 2;
  readonly stepByteLength: number;
  readonly brepByteLength: number;
}

export interface OcctNamedStepProbeResult {
  readonly ok: true;
  readonly capability: OcctNamedStepProbeCapability;
  readonly expectedNames: readonly [string, string];
  readonly units: readonly OcctNamedStepUnitProbeResult[];
}

export const OCCT_NAMED_STEP_PROBE_REQUIRED_BINDINGS = [
  "STEPCAFControl_Controller.Init",
  "STEPCAFControl_Writer_1",
  "STEPCAFControl_Writer.prototype.SetNameMode",
  "STEPCAFControl_Writer.prototype.Transfer_1",
  "STEPCAFControl_Writer.prototype.Write",
  "STEPCAFControl_Reader_1",
  "STEPCAFControl_Reader.prototype.SetNameMode",
  "STEPCAFControl_Reader.prototype.ReadFile",
  "STEPCAFControl_Reader.prototype.Transfer_1",
  "STEPCAFControl_Reader.prototype.Reader",
  "STEPControl_Reader.prototype.FileUnits",
  "STEPControl_Reader.prototype.StepModel",
  "APIHeaderSection_MakeHeader_2",
  "APIHeaderSection_MakeHeader.prototype.SchemaIdentifiersValue",
  "TCollection_ExtendedString_2",
  "TDocStd_Document.prototype.Main",
  "XCAFApp_Application.GetApplication",
  "TDocStd_Application.prototype.NewDocument_2",
  "TDocStd_Application.prototype.Close",
  "Handle_TDocStd_Document_1",
  "XCAFDoc_DocumentTool.ShapeTool",
  "XCAFDoc_ShapeTool.prototype.AddShape",
  "XCAFDoc_ShapeTool.prototype.GetFreeShapes",
  "XCAFDoc_ShapeTool.GetShape_2",
  "TDF_LabelSequence_1",
  "TDataStd_Name.Set_1",
  "TDataStd_Name.GetID",
  "Handle_TDF_Attribute_1",
  "TDF_Label.prototype.FindAttribute_1",
  "TDataStd_GenericExtString.prototype.Get",
  "TCollection_ExtendedString.prototype.IsEqual_2",
  "TColStd_SequenceOfAsciiString_1",
  "TCollection_AsciiString.prototype.ToCString",
  "BRepTools.Write_3",
  "BRepTools.Read_2",
  "BRepCheck_Analyzer",
  "BRep_Builder",
  "TopoDS_Shape",
  "BRepPrimAPI_MakeBox_2",
  "BRepPrimAPI_MakeCylinder_1",
  "Interface_Static.SetCVal",
  "Message_ProgressRange_1",
  "STEPControl_StepModelType.STEPControl_AsIs",
  "IFSelect_ReturnStatus.IFSelect_RetDone",
  "FS.writeFile",
  "FS.readFile",
  "FS.unlink"
] as const;

const EXPECTED_NAMES = ["Bracket Ω", "Bracket Ω"] as const;
const UNITS = ["mm", "cm", "m", "in"] as const;

export function getOcctNamedStepProbeCapabilityWithInstance(
  oc: Partial<OpenCascadeInstance>
): OcctNamedStepProbeCapability {
  const availableBindings = OCCT_NAMED_STEP_PROBE_REQUIRED_BINDINGS.filter(
    (binding) => hasBinding(oc, binding)
  );
  const missingBindings = OCCT_NAMED_STEP_PROBE_REQUIRED_BINDINGS.filter(
    (binding) => !availableBindings.includes(binding)
  );
  const namedStepAvailable = missingBindings.length === 0;

  return {
    status: namedStepAvailable ? "available" : "unavailable",
    namedStepAvailable,
    checkedBindings: OCCT_NAMED_STEP_PROBE_REQUIRED_BINDINGS,
    availableBindings,
    missingBindings,
    reason: namedStepAvailable
      ? "The browser OCCT boundary exposes named XDE AP242 transfer, authoritative STEP unit/name readback, B-rep round-trip, and cleanup bindings."
      : "The browser OCCT boundary is missing bindings required for named XDE AP242 transfer and authoritative readback."
  };
}

export async function getOcctNamedStepProbeCapabilityWithLoader(
  loadOcct: OcctLoader
): Promise<OcctNamedStepProbeCapability> {
  return getOcctNamedStepProbeCapabilityWithInstance(await loadOcct());
}

export async function runOcctNamedStepProbeWithLoader(
  loadOcct: OcctLoader
): Promise<OcctNamedStepProbeResult> {
  return runOcctNamedStepProbeWithInstance(await loadOcct());
}

export function runOcctNamedStepProbeWithInstance(
  oc: OpenCascadeInstance
): OcctNamedStepProbeResult {
  const capability = getOcctNamedStepProbeCapabilityWithInstance(oc);

  if (!capability.namedStepAvailable) {
    throw new Error(
      `Open CASCADE named STEP probe bindings unavailable: ${capability.missingBindings.join(", ")}.`
    );
  }

  return {
    ok: true,
    capability,
    expectedNames: EXPECTED_NAMES,
    units: UNITS.map((unit) => runUnitProbe(oc, unit))
  };
}

function runUnitProbe(
  oc: OpenCascadeInstance,
  unit: OcctNamedStepProbeUnit
): OcctNamedStepUnitProbeResult {
  const resources: Array<{ delete(): void }> = [];
  const own = <T extends { delete(): void }>(resource: T): T => {
    resources.push(resource);
    return resource;
  };
  const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const stepFile = `/tmp/partbench-named-step-${unit}-${token}.step`;
  const fs = getOcctFs(oc);
  const applicationHandle = oc.XCAFApp_Application.GetApplication();
  const application = applicationHandle.get();
  const documents: InstanceType<
    OpenCascadeInstance["Handle_TDocStd_Document_1"]
  >[] = [];

  try {
    const artifacts = [
      createOcctExactBodyArtifactWithInstance(oc, {
        source: {
          kind: "box",
          dimensions: { width: 2, height: 3, depth: 4 },
          transform: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1]
          }
        }
      }),
      createOcctExactBodyArtifactWithInstance(oc, {
        source: {
          kind: "cylinder",
          dimensions: { radius: 1, height: 4 },
          transform: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1]
          }
        }
      })
    ];
    const step = createOcctStepExportWithInstance(oc, {
      units: unit,
      bodies: artifacts.map((artifact, index) => ({
        bodyId: `probe-body-${index + 1}`,
        bodyName: EXPECTED_NAMES[index] ?? "",
        brepFormat: artifact.brepFormat,
        brepByteLength: artifact.brepByteLength,
        brepSha256: "0".repeat(64),
        brepBytes: artifact.brepBytes
      }))
    });
    fs.writeFile(stepFile, step.bytes);
    const progress = own(new oc.Message_ProgressRange_1());
    const readStorageFormat = own(
      new oc.TCollection_ExtendedString_2("BinXCAF", false)
    );
    const readDocumentHandle = new oc.Handle_TDocStd_Document_1();
    documents.push(readDocumentHandle);
    application.NewDocument_2(readStorageFormat, readDocumentHandle);
    const reader = own(new oc.STEPCAFControl_Reader_1());
    reader.SetNameMode(true);

    if (
      reader.ReadFile(stepFile) !== oc.IFSelect_ReturnStatus.IFSelect_RetDone
    ) {
      throw new Error("Open CASCADE named STEP probe read failed.");
    }

    const fileSchemas = readFileSchemas(oc, reader);
    const fileUnits = readFileUnits(oc, reader);

    if (
      fileSchemas.length !== 1 ||
      !fileSchemas[0]?.startsWith(
        "AP242_MANAGED_MODEL_BASED_3D_ENGINEERING_MIM_LF"
      )
    ) {
      throw new Error(
        `Open CASCADE named STEP probe read unexpected schema: ${fileSchemas.join(", ")}.`
      );
    }

    if (!matchesUnit(unit, fileUnits)) {
      throw new Error(
        `Open CASCADE named STEP probe read unexpected ${unit} units: ${fileUnits.join(", ")}.`
      );
    }

    if (!reader.Transfer_1(readDocumentHandle, progress)) {
      throw new Error("Open CASCADE named STEP probe XDE transfer failed.");
    }

    const readMain = own(readDocumentHandle.get().Main());
    const readShapeToolHandle = own(
      oc.XCAFDoc_DocumentTool.ShapeTool(readMain)
    );
    const readShapeTool = readShapeToolHandle.get();
    const labels = own(new oc.TDF_LabelSequence_1());
    readShapeTool.GetFreeShapes(labels);

    if (labels.Length() !== 2) {
      throw new Error(
        `Open CASCADE named STEP probe read ${labels.Length()} bodies instead of 2.`
      );
    }

    const names: string[] = [];
    let nonNullShapeCount = 0;

    for (let index = labels.Lower(); index <= labels.Upper(); index += 1) {
      const label = own(labels.Value(index));
      const shape = own(oc.XCAFDoc_ShapeTool.GetShape_2(label));
      const nameHandle = own(new oc.Handle_TDF_Attribute_1());

      if (!shape.IsNull()) {
        nonNullShapeCount += 1;
      }

      const nameId = own(oc.TDataStd_Name.GetID());
      if (!label.FindAttribute_1(nameId, nameHandle)) {
        throw new Error("Open CASCADE named STEP probe body name is missing.");
      }

      const nameAttribute = nameHandle.get() as unknown as {
        Get(): InstanceType<
          OpenCascadeInstance["TCollection_ExtendedString_1"]
        >;
      };
      if (typeof nameAttribute.Get !== "function") {
        throw new Error(
          "Open CASCADE named STEP probe name attribute cannot be read."
        );
      }
      const name = own(nameAttribute.Get());
      const expectedName = own(
        new oc.TCollection_ExtendedString_2(
          EXPECTED_NAMES[names.length] ?? "",
          true
        )
      );
      if (!name.IsEqual_2(expectedName)) {
        throw new Error("Open CASCADE named STEP probe body name changed.");
      }
      names.push(EXPECTED_NAMES[names.length] ?? "");
    }

    if (
      nonNullShapeCount !== 2 ||
      names.length !== EXPECTED_NAMES.length ||
      names.some((name, index) => name !== EXPECTED_NAMES[index])
    ) {
      throw new Error(
        `Open CASCADE named STEP probe name/shape mismatch: ${names.join(", ")}.`
      );
    }

    return {
      unit,
      schema: "AP242DIS",
      bodyCount: 2,
      names,
      fileSchemas,
      fileUnits,
      nonNullShapeCount: 2,
      stepByteLength: step.byteLength,
      brepByteLength: artifacts[0]!.brepByteLength
    };
  } finally {
    for (const resource of resources.reverse()) {
      resource.delete();
    }
    try {
      fs.unlink(stepFile);
    } catch {
      // The probe may fail before creating the file.
    }
    for (const document of documents.reverse()) {
      application.Close(document);
    }
    for (const document of documents) {
      document.delete();
    }
    applicationHandle.delete();
  }
}

function readFileSchemas(
  oc: OpenCascadeInstance,
  reader: InstanceType<OpenCascadeInstance["STEPCAFControl_Reader_1"]>
): readonly string[] {
  const model = reader.Reader().StepModel();
  const header = new oc.APIHeaderSection_MakeHeader_2(model);

  try {
    if (!header.IsDone() || !header.HasFs()) {
      throw new Error(
        "Open CASCADE named STEP probe schema header is missing."
      );
    }
    const schemas: string[] = [];
    for (let index = 1; index <= header.NbSchemaIdentifiers(); index += 1) {
      const identifier = header.SchemaIdentifiersValue(index);
      try {
        if (!identifier.IsNull()) {
          schemas.push(String(identifier.get().ToCString()));
        }
      } finally {
        identifier.delete();
      }
    }
    return schemas;
  } finally {
    header.delete();
    model.delete();
  }
}

function readFileUnits(
  oc: OpenCascadeInstance,
  reader: InstanceType<OpenCascadeInstance["STEPCAFControl_Reader_1"]>
): readonly string[] {
  const lengths = new oc.TColStd_SequenceOfAsciiString_1();
  const angles = new oc.TColStd_SequenceOfAsciiString_1();
  const solidAngles = new oc.TColStd_SequenceOfAsciiString_1();

  try {
    reader.Reader().FileUnits(lengths, angles, solidAngles);
    const values: string[] = [];
    for (let index = lengths.Lower(); index <= lengths.Upper(); index += 1) {
      const value = lengths.Value(index);
      try {
        values.push(String(value.ToCString()));
      } finally {
        value.delete();
      }
    }
    return values;
  } finally {
    solidAngles.delete();
    angles.delete();
    lengths.delete();
  }
}

function matchesUnit(
  unit: OcctNamedStepProbeUnit,
  fileUnits: readonly string[]
): boolean {
  const value = fileUnits.join(" ").toLowerCase();
  switch (unit) {
    case "mm":
      return /milli.*met/.test(value);
    case "cm":
      return /centi.*met/.test(value);
    case "m":
      return /(^|\s)(metre|meter|m)(\s|$)/.test(value);
    case "in":
      return /inch/.test(value);
  }
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
  readonly writeFile: (path: string, bytes: Uint8Array) => void;
  readonly readFile: (path: string) => Uint8Array;
  readonly unlink: (path: string) => void;
} {
  const fs = (
    oc as OpenCascadeInstance & {
      readonly FS?: {
        readonly writeFile?: (path: string, bytes: Uint8Array) => void;
        readonly readFile?: (path: string) => Uint8Array;
        readonly unlink?: (path: string) => void;
      };
    }
  ).FS;

  if (!fs?.writeFile || !fs.readFile || !fs.unlink) {
    throw new Error(
      "Open CASCADE named STEP probe file system is unavailable."
    );
  }

  return {
    writeFile: fs.writeFile,
    readFile: fs.readFile,
    unlink: fs.unlink
  };
}
