import {
  createExactShapeDisplay,
  type OcctExactShapeDisplay
} from "./exactCheckpointPayload";
import {
  checkpointSha256,
  rememberExactCheckpoint
} from "./exactCheckpointCache";
import type {
  OpenCascadeInstance,
  TopoDS_Shape,
  TDF_Label
} from "opencascade.js";
import type { OcctLoader } from "./tessellateBox";
import {
  readExactTopologySnapshot,
  readExactBodyMetadata,
  withImportedBrepShape,
  type OcctExactBodyMetadata,
  type OcctExactTopologySnapshot
} from "./exactMetadata";
import type { OcctTopologyCheckpointSignaturePayload } from "./exactCheckpointPayload";
import {
  stepAppearanceIsPartial,
  readStepName,
  readStepColor,
  stepUnitScale,
  type OcctStepAssembly,
  type OcctStepAssemblyDefinition,
  type OcctStepOccurrence,
  type OcctStepPlacement,
  type OcctStepColor
} from "./stepAssembly";
export type {
  OcctStepAssembly,
  OcctStepAssemblyDefinition,
  OcctStepOccurrence,
  OcctStepPlacement,
  OcctStepColor
} from "./stepAssembly";

export type OcctStepImportDiagnosticSeverity = "info" | "warning" | "blocking";
export type OcctStepImportDiagnosticCode =
  | "STEP_READER_AVAILABLE"
  | "STEP_TRANSFER_COMPLETE"
  | "STEP_HEALING_APPLIED"
  | "STEP_HEALING_NOT_REQUIRED"
  | "STEP_TOPOLOGY_EXTRACTED"
  | "STEP_CHECKPOINT_PAYLOAD_CREATED"
  | "STEP_APPEARANCE_PARTIAL";

export interface OcctStepImportDiagnostic {
  readonly code: OcctStepImportDiagnosticCode;
  readonly severity: OcctStepImportDiagnosticSeverity;
  readonly message: string;
}

export type OcctStepReaderCapabilityStatus = "available" | "unavailable";

export interface OcctStepReaderCapability {
  readonly format: "step";
  readonly label: "STEP";
  readonly status: OcctStepReaderCapabilityStatus;
  readonly readerAvailable: boolean;
  readonly healingAvailable: boolean;
  readonly checkpointWriterAvailable: boolean;
  readonly boundary: "occt-wasm";
  readonly packageName: "opencascade.js";
  readonly packageVersion: "2.0.0-beta.b5ff984";
  readonly checkedBindings: readonly string[];
  readonly availableBindings: readonly string[];
  readonly missingBindings: readonly string[];
  readonly reason: string;
}

export interface OcctStepImportInput {
  readonly sourceFileName: string;
  readonly bytes: Uint8Array;
  /** Maximum number of unique part definitions, not placed occurrences or solids. */
  readonly maxBodyCount?: number;
  readonly units?: "mm" | "cm" | "m" | "in";
  readonly bodyId?: string;
  readonly checkpointId?: string;
}

export interface OcctImportedBodyCheckpointPayload {
  readonly checkpointId: string;
  readonly bodyId: string;
  readonly sourceKind: "importedBody";
  readonly brepFormat: "occt-brep";
  readonly brepWriter: "BRepTools.Write_3";
  readonly brepBytes: Uint8Array;
  readonly brepByteLength: number;
  readonly topologySnapshot: OcctExactTopologySnapshot;
  readonly signaturePayload: OcctTopologyCheckpointSignaturePayload;
}

export interface OcctImportedBodyPayload {
  /** Derived display only; never included in checkpoint/native payloads. */
  readonly displayMesh?: OcctExactShapeDisplay["displayMesh"];
  readonly metadata?: OcctExactBodyMetadata;
  readonly definitionId: string;
  readonly color?: OcctStepColor;
  readonly sourceFormat: "step";
  readonly sourceFileName: string;
  readonly bodyName?: string;
  readonly shapeType: "solid" | "compound" | "assemblyLeaf";
  readonly bounds: OcctExactBodyMetadata["bounds"];
  readonly solidCount: number;
  readonly faceCount: number;
  readonly edgeCount: number;
  readonly vertexCount: number;
  readonly topologySnapshot: OcctExactTopologySnapshot;
  readonly checkpointPayload: OcctImportedBodyCheckpointPayload;
  readonly healingApplied: boolean;
  readonly diagnostics: readonly OcctStepImportDiagnostic[];
}

export interface OcctStepImportResult {
  /** Worker-local derived data, removed before returning the import response. */
  readonly preparedDisplays?: readonly (OcctExactShapeDisplay | undefined)[];
  readonly assembly?: OcctStepAssembly;
  readonly sourceFormat: "step";
  readonly sourceFileName: string;
  readonly bodyCount: number;
  readonly bodies: readonly OcctImportedBodyPayload[];
  readonly diagnostics: readonly OcctStepImportDiagnostic[];
}

export interface OcctStepCheckpoint {
  readonly display?: OcctExactShapeDisplay;
  readonly brepBytes: Uint8Array;
  readonly topologySnapshot: OcctExactTopologySnapshot;
  readonly metadata: OcctExactBodyMetadata;
  readonly healingApplied: boolean;
}

export type OcctStepCheckpointProcessor = (
  parts: readonly Uint8Array[]
) => Promise<readonly OcctStepCheckpoint[]>;

export interface PreparedStepPart {
  readonly definitionId: string;
  readonly bodyName?: string;
  readonly color?: OcctStepColor;
  readonly brepBytes: Uint8Array;
  readonly placeholder?: boolean;
}
export interface PreparedStepImport {
  readonly parts: readonly PreparedStepPart[];
  readonly diagnostics: readonly OcctStepImportDiagnostic[];
  readonly assembly: OcctStepAssembly;
}

const STEP_READER_PACKAGE_VERSION = "2.0.0-beta.b5ff984";

export const OCCT_STEP_READER_REQUIRED_BINDINGS = [
  "STEPControl_Reader_1",
  "STEPControl_Reader.ReadFile",
  "STEPControl_Reader.TransferRoots",
  "STEPControl_Reader.OneShape",
  "IFSelect_ReturnStatus.IFSelect_RetDone",
  "Message_ProgressRange_1",
  "ShapeFix_Shape_1",
  "ShapeFix_Shape.Init",
  "ShapeFix_Shape.Perform",
  "ShapeFix_Shape.Shape",
  "BRepTools.Write_3",
  "FS.writeFile",
  "FS.readFile",
  "FS.unlink",
  "TopExp.MapShapes_1",
  "STEPCAFControl_Reader_1",
  "STEPCAFControl_Reader.prototype.Transfer_1",
  "STEPCAFControl_Reader.prototype.ReadFile",
  "XCAFDoc_ShapeTool.GetReferredShape",
  "XCAFDoc_ShapeTool.GetComponents",
  "XCAFDoc_DocumentTool.ShapeTool",
  "BRepCheck_Analyzer"
] as const;

export async function createOcctStepImportWithLoader(
  loadOcct: OcctLoader,
  input: OcctStepImportInput,
  processCheckpoints?: OcctStepCheckpointProcessor
): Promise<OcctStepImportResult> {
  const oc = await loadOcct();
  const prepared = readStepPartsWithInstance(oc, input);
  const checkpoints =
    processCheckpoints &&
    prepared.parts.length >= 8 &&
    prepared.parts.reduce(
      (size, part) => size + part.brepBytes.byteLength,
      0
    ) >=
      2 * 1024 * 1024
      ? await processCheckpoints(prepared.parts.map((part) => part.brepBytes))
      : prepared.parts.map((part) =>
          prepareOcctStepCheckpointWithInstance(oc, part.brepBytes)
        );
  const result = finishStepImport(input, prepared, checkpoints);
  await rememberOcctStepImport(oc, result);
  return result;
}

export function createOcctStepImportWithInstance(
  oc: OpenCascadeInstance,
  input: OcctStepImportInput
): OcctStepImportResult {
  const prepared = readStepPartsWithInstance(oc, input);
  return finishStepImport(
    input,
    prepared,
    prepared.parts.map((part) =>
      prepareOcctStepCheckpointWithInstance(oc, part.brepBytes)
    )
  );
}

export function readStepPartsWithInstance(
  oc: OpenCascadeInstance,
  input: OcctStepImportInput,
  allowPlaceholders = false
): PreparedStepImport {
  assertStepReaderBindings(oc);
  if (input.bytes.byteLength <= 0)
    throw new Error("STEP import requires non-empty STEP bytes.");
  if (
    input.maxBodyCount !== undefined &&
    (!Number.isInteger(input.maxBodyCount) || input.maxBodyCount < 1)
  ) {
    throw new Error("STEP maxBodyCount must be a positive integer.");
  }
  const resources: Array<{ delete(): void }> = [];
  const own = <T extends { delete(): void }>(value: T): T => {
    resources.push(value);
    return value;
  };
  const filename = `/tmp/partbench-import-${Date.now()}-${Math.random().toString(36).slice(2)}.step`;
  let applicationHandle:
    | ReturnType<OpenCascadeInstance["XCAFApp_Application"]["GetApplication"]>
    | undefined;
  let documentHandle:
    | InstanceType<OpenCascadeInstance["Handle_TDocStd_Document_1"]>
    | undefined;
  let documentOpened = false;
  try {
    const progress = own(new oc.Message_ProgressRange_1());
    const reader = own(new oc.STEPCAFControl_Reader_1());
    reader.SetNameMode(true);
    reader.SetColorMode(true);
    // Product metadata and annotation are not geometry and need not slow transfer.
    reader.SetGDTMode(false);
    reader.SetViewMode(false);
    getOcctFs(oc).writeFile(filename, input.bytes);
    if (
      reader.ReadFile(filename) !== oc.IFSelect_ReturnStatus.IFSelect_RetDone
    ) {
      throw new Error("Open CASCADE STEP reader could not read the file.");
    }
    const underlyingReader = own(reader.ChangeReader());
    underlyingReader.SetSystemLengthUnit(stepUnitScale(input.units ?? "mm"));
    applicationHandle = oc.XCAFApp_Application.GetApplication();
    documentHandle = new oc.Handle_TDocStd_Document_1();
    const format = own(new oc.TCollection_ExtendedString_2("BinXCAF", false));
    applicationHandle.get().NewDocument_2(format, documentHandle);
    documentOpened = true;
    oc.XCAFDoc_DocumentTool.SetLengthUnit_2(
      documentHandle,
      stepUnitScale(input.units ?? "mm"),
      oc.UnitsMethods_LengthUnit
        .UnitsMethods_LengthUnit_Millimeter as Parameters<
        typeof oc.XCAFDoc_DocumentTool.SetLengthUnit_2
      >[2]
    );
    if (!reader.Transfer_1(documentHandle, progress)) {
      throw new Error("Open CASCADE STEP reader did not transfer any shapes.");
    }
    const main = own(documentHandle.get().Main());
    const toolHandle = own(oc.XCAFDoc_DocumentTool.ShapeTool(main));
    const tool = toolHandle.get();
    const colorToolHandle = own(oc.XCAFDoc_DocumentTool.ColorTool(main));
    const colorTool = colorToolHandle.get();
    const free = own(new oc.TDF_LabelSequence_1());
    tool.GetFreeShapes(free);
    if (free.Length() === 0)
      throw new Error("Open CASCADE STEP reader did not transfer any shapes.");

    const leafLabels = new Map<string, TDF_Label>();
    const definitions = new Map<string, OcctStepAssemblyDefinition>();
    const visiting = new Set<string>();
    const partialAppearance = new Set<string>();
    let occurrenceSerial = 0;
    const visit = (label: TDF_Label): OcctStepOccurrence => {
      const referred = own(new oc.TDF_Label());
      const isReference = oc.XCAFDoc_ShapeTool.GetReferredShape(
        label,
        referred
      );
      const definitionLabel = isReference ? referred : label;
      const definitionId = labelKey(definitionLabel);
      const name =
        readStepName(oc, definitionLabel) ??
        createBodyDisplayName(input.sourceFileName) ??
        definitionId;
      const color = readStepColor(oc, colorTool, definitionLabel);
      if (
        stepAppearanceIsPartial(oc, colorTool, definitionLabel) ||
        (isReference && stepAppearanceIsPartial(oc, colorTool, label))
      )
        partialAppearance.add(name);
      if (visiting.has(definitionId))
        throw new Error(
          "STEP assembly contains a circular component reference."
        );
      if (oc.XCAFDoc_ShapeTool.IsAssembly(definitionLabel)) {
        if (!definitions.has(definitionId)) {
          visiting.add(definitionId);
          const labels = own(new oc.TDF_LabelSequence_1());
          oc.XCAFDoc_ShapeTool.GetComponents(definitionLabel, labels, false);
          const components: OcctStepOccurrence[] = [];
          for (let index = 1; index <= labels.Length(); index++)
            components.push(visit(own(labels.Value(index))));
          definitions.set(definitionId, {
            id: definitionId,
            name,
            components,
            ...(color ? { color } : {})
          });
          visiting.delete(definitionId);
        }
      } else if (!leafLabels.has(definitionId)) {
        leafLabels.set(definitionId, definitionLabel);
      }
      const location = own(oc.XCAFDoc_ShapeTool.GetLocation(label));
      const transform = own(location.Transformation());
      const values: number[] = [];
      for (let row = 1; row <= 3; row++)
        for (let column = 1; column <= 4; column++)
          values.push(transform.Value(row, column));
      const occurrenceColor = readStepColor(oc, colorTool, label);
      return {
        id: `occurrence_${++occurrenceSerial}`,
        definitionId,
        name: readStepName(oc, label) ?? name,
        transform: values as unknown as OcctStepPlacement,
        ...(occurrenceColor ? { color: occurrenceColor } : {})
      };
    };
    const roots: OcctStepOccurrence[] = [];
    for (let index = 1; index <= free.Length(); index++)
      roots.push(visit(own(free.Value(index))));
    if (
      input.maxBodyCount !== undefined &&
      leafLabels.size > input.maxBodyCount
    ) {
      throw new Error(
        `STEP import produced ${leafLabels.size} part definitions, exceeding the maxBodyCount of ${input.maxBodyCount}.`
      );
    }
    const diagnostics: OcctStepImportDiagnostic[] = [
      {
        code: "STEP_READER_AVAILABLE",
        severity: "info",
        message:
          "Open CASCADE STEPCAFControl_Reader read STEP geometry and assembly structure."
      },
      {
        code: "STEP_TRANSFER_COMPLETE",
        severity: "info",
        message: `Transferred ${leafLabels.size} unique part definitions and ${definitions.size} assembly definitions.`
      }
    ];
    if (partialAppearance.size > 0)
      diagnostics.push({
        code: "STEP_APPEARANCE_PARTIAL",
        severity: "warning",
        message: `Imported body and occurrence RGB colors. Per-face/edge colors or transparency on ${partialAppearance.size} named definition(s) are not preserved: ${[...partialAppearance].slice(0, 8).join(", ")}${partialAppearance.size > 8 ? ", …" : ""}.`
      });
    const parts: PreparedStepPart[] = [];
    for (const [definitionId, label] of leafLabels) {
      const shape = oc.XCAFDoc_ShapeTool.GetShape_2(label);
      try {
        if (shape.IsNull())
          throw new Error(`STEP part ${definitionId} has no geometry.`);
        const color = readStepColor(oc, colorTool, label);
        parts.push({
          definitionId,
          bodyName:
            readStepName(oc, label) ??
            createBodyDisplayName(input.sourceFileName),
          ...(color ? { color } : {}),
          brepBytes: writeBrepCheckpointBytes(oc, shape),
          ...(allowPlaceholders
            ? { placeholder: isPointPlaceholder(oc, shape) }
            : {})
        });
      } finally {
        shape.delete();
      }
    }
    const countLeaves = (occurrences: readonly OcctStepOccurrence[]): number =>
      occurrences.reduce((total, occurrence) => {
        const definition = definitions.get(occurrence.definitionId);
        return total + (definition ? countLeaves(definition.components) : 1);
      }, 0);
    return {
      parts,
      diagnostics,
      assembly: {
        definitions: [...definitions.values()],
        roots,
        occurrenceCount: countLeaves(roots)
      }
    };
  } finally {
    for (const resource of resources.reverse()) resource.delete();
    if (documentOpened && documentHandle && applicationHandle)
      applicationHandle.get().Close(documentHandle);
    documentHandle?.delete();
    applicationHandle?.delete();
    try {
      getOcctFs(oc).unlink(filename);
    } catch {
      /* The reader may fail before file creation. */
    }
  }
}

function labelKey(label: TDF_Label): string {
  const tags = [label.Tag()];
  let parent = label.Father();
  try {
    while (!parent.IsNull()) {
      tags.push(parent.Tag());
      const next = parent.Father();
      parent.delete();
      parent = next;
    }
  } finally {
    parent.delete();
  }
  return `definition_${tags.reverse().join("_")}`;
}

export function getOcctStepReaderCapabilityWithInstance(
  oc: Partial<OpenCascadeInstance>
): OcctStepReaderCapability {
  const availableBindings = OCCT_STEP_READER_REQUIRED_BINDINGS.filter(
    (binding) => hasStepReaderBinding(oc, binding)
  );
  const missingBindings = OCCT_STEP_READER_REQUIRED_BINDINGS.filter(
    (binding) => !availableBindings.includes(binding)
  );
  const readerAvailable = missingBindings.length === 0;

  return {
    format: "step",
    label: "STEP",
    status: readerAvailable ? "available" : "unavailable",
    readerAvailable,
    healingAvailable:
      availableBindings.includes("ShapeFix_Shape_1") &&
      availableBindings.includes("ShapeFix_Shape.Perform"),
    checkpointWriterAvailable:
      availableBindings.includes("BRepTools.Write_3") &&
      availableBindings.includes("FS.readFile"),
    boundary: "occt-wasm",
    packageName: "opencascade.js",
    packageVersion: STEP_READER_PACKAGE_VERSION,
    checkedBindings: OCCT_STEP_READER_REQUIRED_BINDINGS,
    availableBindings,
    missingBindings,
    reason: readerAvailable
      ? "The current OpenCascade.js boundary exposes STEP reader, healing, topology traversal, and BRep checkpoint writer bindings."
      : "The current OpenCascade.js boundary does not expose every binding required for STEP import."
  };
}

export async function getOcctStepReaderCapabilityWithLoader(
  loadOcct: OcctLoader
): Promise<OcctStepReaderCapability> {
  const oc = await loadOcct();

  return getOcctStepReaderCapabilityWithInstance(oc);
}

export function finishStepImport(
  input: OcctStepImportInput,
  prepared: PreparedStepImport,
  checkpoints: readonly OcctStepCheckpoint[]
): OcctStepImportResult {
  if (checkpoints.length !== prepared.parts.length)
    throw new Error(
      "STEP checkpoint preparation returned an incomplete assembly."
    );
  const bodies: OcctImportedBodyPayload[] = [];
  for (const [partIndex, part] of prepared.parts.entries()) {
    const definitionId = part.definitionId;
    const { brepBytes, topologySnapshot, metadata, healingApplied } =
      checkpoints[partIndex]!;
    if (topologySnapshot.entityCounts.solidCount <= 0) {
      throw new Error(
        `STEP part ${part.bodyName ?? definitionId} is not a solid. Surface and curve imports are not yet supported.`
      );
    }
    const index = bodies.length + 1;
    const bodyId = input.bodyId
      ? index === 1
        ? input.bodyId
        : `${input.bodyId}_${index}`
      : `body_imported_${index}`;
    const checkpointId = input.checkpointId
      ? index === 1
        ? input.checkpointId
        : `${input.checkpointId}_${index}`
      : `checkpoint_imported_${index}`;
    const bodyDiagnostics: OcctStepImportDiagnostic[] = [
      {
        code: healingApplied
          ? "STEP_HEALING_APPLIED"
          : "STEP_HEALING_NOT_REQUIRED",
        severity: "info",
        message: healingApplied
          ? "Repaired invalid part geometry with ShapeFix_Shape."
          : "Part geometry passed validation without repair."
      },
      {
        code: "STEP_TOPOLOGY_EXTRACTED",
        severity: "info",
        message: "Extracted unique part topology once."
      },
      {
        code: "STEP_CHECKPOINT_PAYLOAD_CREATED",
        severity: "info",
        message: "Created native BRep checkpoint for the part definition."
      }
    ];
    const color = part.color;
    bodies.push({
      ...(checkpoints[partIndex]?.display
        ? { displayMesh: checkpoints[partIndex]!.display!.displayMesh }
        : {}),
      definitionId,
      metadata,
      sourceFormat: "step",
      sourceFileName: input.sourceFileName,
      bodyName: part.bodyName,
      ...(color ? { color } : {}),
      shapeType:
        topologySnapshot.entityCounts.solidCount === 1 ? "solid" : "compound",
      bounds: readBodyBounds(topologySnapshot),
      solidCount: topologySnapshot.entityCounts.solidCount,
      faceCount: topologySnapshot.entityCounts.faceCount,
      edgeCount: topologySnapshot.entityCounts.edgeCount,
      vertexCount: topologySnapshot.entityCounts.vertexCount,
      topologySnapshot,
      checkpointPayload: {
        checkpointId,
        bodyId,
        sourceKind: "importedBody",
        brepFormat: "occt-brep",
        brepWriter: "BRepTools.Write_3",
        brepBytes,
        brepByteLength: brepBytes.byteLength,
        topologySnapshot,
        signaturePayload: createCheckpointSignaturePayload(
          checkpointId,
          topologySnapshot
        )
      },
      healingApplied,
      diagnostics: bodyDiagnostics
    });
  }
  return {
    sourceFormat: "step",
    sourceFileName: input.sourceFileName,
    bodyCount: bodies.length,
    bodies,
    assembly: prepared.assembly,
    diagnostics: [
      ...prepared.diagnostics,
      {
        code: "STEP_TOPOLOGY_EXTRACTED",
        severity: "info",
        message: `Extracted topology for ${bodies.length} unique parts.`
      },
      {
        code: "STEP_CHECKPOINT_PAYLOAD_CREATED",
        severity: "info",
        message: `Created ${bodies.length} native part checkpoints.`
      }
    ]
  };
}

function healStepShape(
  oc: OpenCascadeInstance,
  shape: TopoDS_Shape,
  progress: InstanceType<OpenCascadeInstance["Message_ProgressRange_1"]>
): {
  readonly shape: TopoDS_Shape;
  readonly healingApplied: boolean;
} {
  const fixer = new oc.ShapeFix_Shape_1();

  try {
    fixer.Init(shape);

    return {
      healingApplied: Boolean(fixer.Perform(progress)),
      shape: fixer.Shape()
    };
  } finally {
    fixer.delete();
  }
}

/** Validate the durable, round-tripped shape once. Previously the transient
 * exchange shape was also fully checked even though no caller consumed it.
 * Invalid canonical shapes still get repaired, serialized again and validated
 * before any document data is returned. */
export function prepareOcctStepCheckpointWithInstance(
  oc: OpenCascadeInstance,
  sourceBytes: Uint8Array,
  prepareDisplay = false
): OcctStepCheckpoint {
  const progress = new oc.Message_ProgressRange_1();
  let brepBytes = sourceBytes;
  let healingApplied = false;
  const readCanonical = (
    shape: TopoDS_Shape,
    allowRepair: boolean
  ): {
    topologySnapshot: OcctExactTopologySnapshot;
    metadata: OcctExactBodyMetadata;
    display?: OcctExactShapeDisplay;
  } => {
    const analyzer = new oc.BRepCheck_Analyzer(shape, true, false);
    let valid: boolean;
    try {
      valid = analyzer.IsValid_2();
    } finally {
      analyzer.delete();
    }
    if (!valid) {
      if (!allowRepair)
        throw new Error(
          "STEP checkpoint serialization did not retain a valid solid."
        );
      const repaired = healStepShape(oc, shape, progress);
      try {
        healingApplied = repaired.healingApplied;
        brepBytes = writeBrepCheckpointBytes(oc, repaired.shape);
        return withImportedBrepShape(oc, brepBytes, (canonical) =>
          readCanonical(canonical, false)
        );
      } finally {
        repaired.shape.delete();
      }
    }
    const topologySnapshot = readExactTopologySnapshot(
      oc,
      shape,
      "importedBody"
    );
    return {
      topologySnapshot,
      ...(prepareDisplay
        ? {
            display: createExactShapeDisplay(
              oc,
              shape,
              "importedBody",
              topologySnapshot,
              false
            )
          }
        : {}),
      metadata: readExactBodyMetadata(
        oc,
        shape,
        "importedBody",
        topologySnapshot
      )
    };
  };
  try {
    const evidence = withImportedBrepShape(oc, brepBytes, (shape) =>
      readCanonical(shape, true)
    );
    return { brepBytes, ...evidence, healingApplied };
  } finally {
    progress.delete();
  }
}

function writeBrepCheckpointBytes(
  oc: OpenCascadeInstance,
  shape: TopoDS_Shape
): Uint8Array {
  const progress = new oc.Message_ProgressRange_1();
  const filename = `/tmp/partbench-import-checkpoint-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.brep`;

  try {
    const written = oc.BRepTools.Write_3(shape, filename, progress);

    if (!written) {
      throw new Error("Open CASCADE BRep checkpoint write did not complete.");
    }

    return getOcctFs(oc).readFile(filename);
  } finally {
    try {
      getOcctFs(oc).unlink(filename);
    } catch {
      // The file may not exist.
    }

    progress.delete();
  }
}

function createCheckpointSignaturePayload(
  checkpointId: string,
  topologySnapshot: OcctExactTopologySnapshot
): OcctTopologyCheckpointSignaturePayload {
  return {
    checkpointId,
    signatureAlgorithm: topologySnapshot.signatureAlgorithm,
    signature: topologySnapshot.signature,
    entityCount: topologySnapshot.entityCount,
    entities: topologySnapshot.entities.map((entity) => ({
      localId: entity.localId,
      kind: entity.kind,
      signature: entity.signature
    }))
  };
}

function readBodyBounds(
  topologySnapshot: OcctExactTopologySnapshot
): OcctExactBodyMetadata["bounds"] {
  const body = topologySnapshot.entities.find(
    (entity) => entity.kind === "body"
  );

  if (!body?.bounds) {
    throw new Error(
      "STEP import topology snapshot did not include body bounds."
    );
  }

  return body.bounds;
}

function createBodyDisplayName(sourceFileName: string): string | undefined {
  const trimmed = sourceFileName.trim();

  if (trimmed.length === 0) {
    return undefined;
  }

  return trimmed.replace(/\.(step|stp)$/i, "");
}

function assertStepReaderBindings(oc: OpenCascadeInstance): void {
  const capability = getOcctStepReaderCapabilityWithInstance(oc);

  if (!capability.readerAvailable) {
    throw new Error(
      `Open CASCADE STEP reader bindings unavailable: ${capability.missingBindings.join(
        ", "
      )}.`
    );
  }
}

function hasStepReaderBinding(
  oc: Partial<OpenCascadeInstance>,
  binding: string
): boolean {
  switch (binding) {
    case "STEPControl_Reader_1":
      return typeof oc.STEPControl_Reader_1 === "function";
    case "STEPControl_Reader.ReadFile":
      return typeof oc.STEPControl_Reader?.prototype?.ReadFile === "function";
    case "STEPControl_Reader.TransferRoots":
      return (
        typeof oc.STEPControl_Reader?.prototype?.TransferRoots === "function"
      );
    case "STEPControl_Reader.OneShape":
      return typeof oc.STEPControl_Reader?.prototype?.OneShape === "function";
    case "IFSelect_ReturnStatus.IFSelect_RetDone":
      return Boolean(oc.IFSelect_ReturnStatus?.IFSelect_RetDone);
    case "Message_ProgressRange_1":
      return typeof oc.Message_ProgressRange_1 === "function";
    case "ShapeFix_Shape_1":
      return typeof oc.ShapeFix_Shape_1 === "function";
    case "ShapeFix_Shape.Init":
      return typeof oc.ShapeFix_Shape?.prototype?.Init === "function";
    case "ShapeFix_Shape.Perform":
      return typeof oc.ShapeFix_Shape?.prototype?.Perform === "function";
    case "ShapeFix_Shape.Shape":
      return typeof oc.ShapeFix_Shape?.prototype?.Shape === "function";
    case "BRepTools.Write_3":
      return typeof oc.BRepTools?.Write_3 === "function";
    case "FS.writeFile":
      return typeof getOptionalOcctFs(oc)?.writeFile === "function";
    case "FS.readFile":
      return typeof getOptionalOcctFs(oc)?.readFile === "function";
    case "FS.unlink":
      return typeof getOptionalOcctFs(oc)?.unlink === "function";
    case "TopExp.MapShapes_1":
      return typeof oc.TopExp?.MapShapes_1 === "function";
    default: {
      let value: unknown = oc;
      for (const part of binding.split(".")) {
        if (
          !value ||
          (typeof value !== "object" && typeof value !== "function")
        )
          return false;
        value = (value as Record<string, unknown>)[part];
      }
      return value !== undefined && value !== null;
    }
  }
}

function getOcctFs(oc: OpenCascadeInstance): {
  readonly writeFile: (path: string, data: Uint8Array) => void;
  readonly readFile: (path: string) => Uint8Array;
  readonly unlink: (path: string) => void;
} {
  const fs = getOptionalOcctFs(oc);

  if (!fs) {
    throw new Error("Open CASCADE virtual file system is unavailable.");
  }

  if (
    typeof fs.writeFile !== "function" ||
    typeof fs.readFile !== "function" ||
    typeof fs.unlink !== "function"
  ) {
    throw new Error("Open CASCADE virtual file system is incomplete.");
  }

  return {
    writeFile: fs.writeFile,
    readFile: fs.readFile,
    unlink: fs.unlink
  };
}

function getOptionalOcctFs(oc: Partial<OpenCascadeInstance>):
  | {
      readonly writeFile?: (path: string, data: Uint8Array) => void;
      readonly readFile?: (path: string) => Uint8Array;
      readonly unlink?: (path: string) => void;
    }
  | undefined {
  return (
    oc as Partial<OpenCascadeInstance> & {
      readonly FS?: {
        readonly writeFile?: (path: string, data: Uint8Array) => void;
        readonly readFile?: (path: string) => Uint8Array;
        readonly unlink?: (path: string) => void;
      };
    }
  ).FS;
}

/** Only vertex-only placeholders are ignored. An unexpected wire, face or empty
 * shape must pass through canonical validation and reject as in whole import. */
function isPointPlaceholder(
  oc: OpenCascadeInstance,
  shape: TopoDS_Shape
): boolean {
  const kind = shape.ShapeType();
  if (kind === oc.TopAbs_ShapeEnum.TopAbs_VERTEX) return true;
  if (kind !== oc.TopAbs_ShapeEnum.TopAbs_COMPOUND) return false;
  const iterator = new oc.TopoDS_Iterator_2(shape, true, true);
  try {
    while (iterator.More()) {
      const child = iterator.Value();
      try {
        if (!isPointPlaceholder(oc, child)) return false;
      } finally {
        child.delete();
      }
      iterator.Next();
    }
    return true;
  } finally {
    iterator.delete();
  }
}

export interface OcctStepPartitionResult {
  readonly timings?: {
    readonly loadMs?: number;
    readonly readMs: number;
    readonly totalMs: number;
    readonly parts: readonly { name: string; milliseconds: number }[];
  };
  readonly prepared: PreparedStepImport;
  readonly checkpoints: readonly (OcctStepCheckpoint | null)[];
}
export function prepareOcctStepPartitionWithInstance(
  oc: OpenCascadeInstance,
  input: OcctStepImportInput,
  onPart?: (
    part: PreparedStepPart,
    checkpoint: OcctStepCheckpoint,
    assembly: OcctStepAssembly
  ) => void
): OcctStepPartitionResult {
  const started = performance.now();
  const prepared = readStepPartsWithInstance(oc, input, true);
  const readMs = performance.now() - started;
  const parts: { name: string; milliseconds: number }[] = [];
  const checkpoints = prepared.parts.map((part) => {
    if (part.placeholder) return null;
    try {
      const partStarted = performance.now();
      const checkpoint = prepareOcctStepCheckpointWithInstance(
        oc,
        part.brepBytes,
        true
      );
      parts.push({
        name: part.bodyName ?? part.definitionId,
        milliseconds: performance.now() - partStarted
      });
      onPart?.(part, checkpoint, prepared.assembly);
      return checkpoint;
    } catch (error) {
      throw new Error(
        `STEP part ${part.bodyName ?? part.definitionId}: ${String((error as { message?: string }).message ?? error)}`
      );
    }
  });
  return {
    prepared,
    checkpoints,
    timings: { readMs, totalMs: performance.now() - started, parts }
  };
}
export function mergeOcctStepPartitions(
  input: OcctStepImportInput,
  results: readonly OcctStepPartitionResult[],
  definitionCount: number
): OcctStepImportResult | undefined {
  const first = results[0]?.prepared;
  if (!first || first.parts.length !== definitionCount) return;
  const identity = (prepared: PreparedStepImport) =>
    JSON.stringify({
      assembly: prepared.assembly,
      parts: prepared.parts.map(({ definitionId, bodyName }) => ({
        definitionId,
        bodyName
      }))
    });
  const expected = identity(first);
  if (results.some((result) => identity(result.prepared) !== expected)) return;
  const checkpoints: OcctStepCheckpoint[] = [];
  const parts: PreparedStepPart[] = [];
  for (let i = 0; i < first.parts.length; i++) {
    const found = results.flatMap((result) =>
      result.checkpoints[i] ? [result.checkpoints[i]!] : []
    );
    if (found.length !== 1) return;
    checkpoints.push(found[0]!);
    parts.push(
      results.find((result) => result.checkpoints[i])!.prepared.parts[i]!
    );
  }
  const diagnostics = [
    ...new Map(
      results
        .flatMap((result) => result.prepared.diagnostics)
        .map((diagnostic) => [JSON.stringify(diagnostic), diagnostic])
    ).values()
  ];
  return {
    ...finishStepImport(input, { ...first, parts, diagnostics }, checkpoints),
    preparedDisplays: checkpoints.map((checkpoint) => checkpoint.display)
  };
}

export async function rememberOcctStepImport(
  oc: OpenCascadeInstance,
  result: OcctStepImportResult
): Promise<void> {
  for (const [index, body] of result.bodies.entries()) {
    if (body.metadata)
      rememberExactCheckpoint(
        oc,
        await checkpointSha256(body.checkpointPayload.brepBytes),
        body.checkpointPayload.brepBytes,
        {
          topology: body.topologySnapshot,
          metadata: body.metadata,
          display: result.preparedDisplays?.[index]
        }
      );
  }
}
