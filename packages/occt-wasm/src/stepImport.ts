import type { OpenCascadeInstance, TopoDS_Shape } from "opencascade.js";
import type { OcctLoader } from "./tessellateBox";
import {
  readExactTopologySnapshot,
  type OcctExactBodyMetadata,
  type OcctExactTopologySnapshot
} from "./exactMetadata";
import type { OcctTopologyCheckpointSignaturePayload } from "./exactCheckpointPayload";

export type OcctStepImportDiagnosticSeverity = "info" | "warning" | "blocking";
export type OcctStepImportDiagnosticCode =
  | "STEP_READER_AVAILABLE"
  | "STEP_TRANSFER_COMPLETE"
  | "STEP_HEALING_APPLIED"
  | "STEP_HEALING_NOT_REQUIRED"
  | "STEP_TOPOLOGY_EXTRACTED"
  | "STEP_CHECKPOINT_PAYLOAD_CREATED";

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
  readonly maxBodyCount?: number;
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
  readonly sourceFormat: "step";
  readonly sourceFileName: string;
  readonly bodyCount: number;
  readonly bodies: readonly OcctImportedBodyPayload[];
  readonly diagnostics: readonly OcctStepImportDiagnostic[];
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
  "TopExp.MapShapes_1"
] as const;

export async function createOcctStepImportWithLoader(
  loadOcct: OcctLoader,
  input: OcctStepImportInput
): Promise<OcctStepImportResult> {
  const oc = await loadOcct();

  return createOcctStepImportWithInstance(oc, input);
}

export function createOcctStepImportWithInstance(
  oc: OpenCascadeInstance,
  input: OcctStepImportInput
): OcctStepImportResult {
  assertStepReaderBindings(oc);

  if (input.bytes.byteLength <= 0) {
    throw new Error("STEP import requires non-empty STEP bytes.");
  }

  let progress:
    | InstanceType<OpenCascadeInstance["Message_ProgressRange_1"]>
    | undefined;
  let reader:
    | InstanceType<OpenCascadeInstance["STEPControl_Reader_1"]>
    | undefined;
  const filename = `/tmp/partbench-import-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.step`;

  try {
    progress = new oc.Message_ProgressRange_1();
    reader = new oc.STEPControl_Reader_1();
    getOcctFs(oc).writeFile(filename, input.bytes);

    const readStatus = reader.ReadFile(filename);

    if (readStatus !== oc.IFSelect_ReturnStatus.IFSelect_RetDone) {
      throw new Error("Open CASCADE STEP reader could not read the file.");
    }

    const rootCount = reader.NbRootsForTransfer();
    const transferredRootCount = reader.TransferRoots(progress);
    const transferredShapeCount = reader.NbShapes();

    if (
      rootCount <= 0 ||
      transferredRootCount <= 0 ||
      transferredShapeCount <= 0
    ) {
      throw new Error("Open CASCADE STEP reader did not transfer any shapes.");
    }

    const sourceShape = reader.OneShape();
    let healedShape: TopoDS_Shape | undefined;

    try {
      const healed = healStepShape(oc, sourceShape, progress);
      healedShape = healed.shape;
      const topologySnapshot = readExactTopologySnapshot(
        oc,
        healedShape,
        "importedBody"
      );

      if (topologySnapshot.entityCounts.solidCount <= 0) {
        throw new Error("STEP import did not produce a solid body.");
      }

      if (
        input.maxBodyCount !== undefined &&
        topologySnapshot.entityCounts.solidCount > input.maxBodyCount
      ) {
        throw new Error(
          `STEP import produced ${topologySnapshot.entityCounts.solidCount} bodies, exceeding the maxBodyCount of ${input.maxBodyCount}.`
        );
      }

      const bodyId = input.bodyId ?? "body_imported_1";
      const checkpointId = input.checkpointId ?? "checkpoint_imported_1";
      const brepBytes = writeBrepCheckpointBytes(oc, healedShape);
      const checkpointPayload: OcctImportedBodyCheckpointPayload = {
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
      };
      const diagnostics: readonly OcctStepImportDiagnostic[] = [
        {
          code: "STEP_READER_AVAILABLE",
          severity: "info",
          message:
            "Open CASCADE STEPControl_Reader read transient STEP bytes through the occt-wasm boundary."
        },
        {
          code: "STEP_TRANSFER_COMPLETE",
          severity: "info",
          message: `Open CASCADE transferred ${transferredRootCount} STEP root(s) into ${transferredShapeCount} shape(s).`
        },
        {
          code: healed.healingApplied
            ? "STEP_HEALING_APPLIED"
            : "STEP_HEALING_NOT_REQUIRED",
          severity: "info",
          message: healed.healingApplied
            ? "ShapeFix_Shape reported healing changes for the transferred shape."
            : "ShapeFix_Shape ran and reported no required healing changes for the transferred shape."
        },
        {
          code: "STEP_TOPOLOGY_EXTRACTED",
          severity: "info",
          message:
            "Open CASCADE topology traversal extracted imported body topology descriptors."
        },
        {
          code: "STEP_CHECKPOINT_PAYLOAD_CREATED",
          severity: "info",
          message:
            "Open CASCADE wrote native BRep checkpoint bytes for the imported body."
        }
      ];
      const body: OcctImportedBodyPayload = {
        sourceFormat: "step",
        sourceFileName: input.sourceFileName,
        bodyName: createBodyDisplayName(input.sourceFileName),
        shapeType:
          topologySnapshot.entityCounts.solidCount === 1 ? "solid" : "compound",
        bounds: readBodyBounds(topologySnapshot),
        solidCount: topologySnapshot.entityCounts.solidCount,
        faceCount: topologySnapshot.entityCounts.faceCount,
        edgeCount: topologySnapshot.entityCounts.edgeCount,
        vertexCount: topologySnapshot.entityCounts.vertexCount,
        topologySnapshot,
        checkpointPayload,
        healingApplied: healed.healingApplied,
        diagnostics
      };

      return {
        sourceFormat: "step",
        sourceFileName: input.sourceFileName,
        bodyCount: 1,
        bodies: [body],
        diagnostics
      };
    } finally {
      healedShape?.delete();
      sourceShape.delete();
    }
  } finally {
    try {
      getOcctFs(oc).unlink(filename);
    } catch {
      // The file may not exist if STEP reader setup failed before writing.
    }

    reader?.delete();
    progress?.delete();
  }
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
      // The file may not exist if shape serialization failed before writing.
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
    default:
      return false;
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
