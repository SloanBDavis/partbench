import type { OpenCascadeInstance, TopoDS_Shape } from "opencascade.js";
import type { OcctLoader } from "./tessellateBox";
import {
  readExactTopologySnapshot,
  withOcctExactBodyShape,
  type OcctExactBodyMetadataInput,
  type OcctExactBodyMetadataSource,
  type OcctExactTopologySnapshot
} from "./exactMetadata";
import {
  makeWireExtrudeShapeWithReferences,
  withOcctWireExtrudeBuildShape,
  type OcctGeneratedReferences,
  type OcctWireExtrudeSource
} from "./wireExtrude";

export interface OcctTopologyCheckpointSignatureEntity {
  readonly localId: string;
  readonly kind: OcctExactTopologySnapshot["entities"][number]["kind"];
  readonly signature: string;
}

export interface OcctTopologyCheckpointSignaturePayload {
  readonly checkpointId: string;
  readonly signatureAlgorithm: "partbench-derived-topology-snapshot-v1";
  readonly signature: string;
  readonly entityCount: number;
  readonly entities: readonly OcctTopologyCheckpointSignatureEntity[];
}

export interface OcctExactTopologyCheckpointPayloadInput extends OcctExactBodyMetadataInput {
  readonly checkpointId: string;
  readonly bodyId: string;
}

export interface OcctExactTopologyCheckpointPayload {
  readonly checkpointId: string;
  readonly bodyId: string;
  readonly sourceKind: OcctExactBodyMetadataSource["kind"];
  readonly brepFormat: "occt-brep";
  readonly brepWriter: "BRepTools.Write_3";
  readonly brepBytes: Uint8Array;
  readonly brepByteLength: number;
  readonly topologySnapshot: OcctExactTopologySnapshot;
  readonly signaturePayload: OcctTopologyCheckpointSignaturePayload;
}

export type OcctBrepCheckpointWriterCapabilityStatus =
  | "available"
  | "unavailable";

export interface OcctBrepCheckpointWriterCapability {
  readonly format: "occt-brep";
  readonly label: "OCCT BRep checkpoint";
  readonly status: OcctBrepCheckpointWriterCapabilityStatus;
  readonly writerAvailable: boolean;
  readonly boundary: "occt-wasm";
  readonly packageName: "opencascade.js";
  readonly packageVersion: "2.0.0-beta.b5ff984";
  readonly checkedBindings: readonly string[];
  readonly availableBindings: readonly string[];
  readonly missingBindings: readonly string[];
  readonly reason: string;
}

const CHECKPOINT_WRITER_PACKAGE_VERSION = "2.0.0-beta.b5ff984";

export const OCCT_BREP_CHECKPOINT_WRITER_REQUIRED_BINDINGS = [
  "BRepTools.Write_3",
  "Message_ProgressRange_1",
  "FS.readFile",
  "FS.unlink"
] as const;

export async function createOcctExactTopologyCheckpointPayloadWithLoader(
  loadOcct: OcctLoader,
  input: OcctExactTopologyCheckpointPayloadInput
): Promise<OcctExactTopologyCheckpointPayload> {
  const oc = await loadOcct();

  return createOcctExactTopologyCheckpointPayloadWithInstance(oc, input);
}

export function createOcctExactTopologyCheckpointPayloadWithInstance(
  oc: OpenCascadeInstance,
  input: OcctExactTopologyCheckpointPayloadInput
): OcctExactTopologyCheckpointPayload {
  assertBrepCheckpointWriterBindings(oc);

  if (input.source.kind === "extrude" && input.source.profile.kind === "wire") {
    const build = makeWireExtrudeShapeWithReferences(
      oc,
      input.source as OcctWireExtrudeSource
    );
    return withOcctWireExtrudeBuildShape(build, (shape, references) =>
      createCheckpointPayload(oc, input, shape, input.source.kind, references)
    );
  }

  return withOcctExactBodyShape(oc, input.source, (shape, sourceKind) =>
    createCheckpointPayload(oc, input, shape, sourceKind)
  );
}

function createCheckpointPayload(
  oc: OpenCascadeInstance,
  input: OcctExactTopologyCheckpointPayloadInput,
  shape: TopoDS_Shape,
  sourceKind: OcctExactTopologyCheckpointPayload["sourceKind"],
  generatedReferences?: OcctGeneratedReferences
): OcctExactTopologyCheckpointPayload {
  const brepBytes = writeBrepCheckpointBytes(oc, shape);
  const topologySnapshot = {
    ...readExactTopologySnapshot(oc, shape, sourceKind),
    ...(generatedReferences ? { generatedReferences } : {})
  };
  const signaturePayload = createCheckpointSignaturePayload(
    input.checkpointId,
    topologySnapshot
  );

  return {
    checkpointId: input.checkpointId,
    bodyId: input.bodyId,
    sourceKind,
    brepFormat: "occt-brep",
    brepWriter: "BRepTools.Write_3",
    brepBytes,
    brepByteLength: brepBytes.byteLength,
    topologySnapshot,
    signaturePayload
  };
}

export function getOcctBrepCheckpointWriterCapabilityWithInstance(
  oc: Partial<OpenCascadeInstance>
): OcctBrepCheckpointWriterCapability {
  const availableBindings =
    OCCT_BREP_CHECKPOINT_WRITER_REQUIRED_BINDINGS.filter((binding) =>
      hasBrepCheckpointWriterBinding(oc, binding)
    );
  const missingBindings = OCCT_BREP_CHECKPOINT_WRITER_REQUIRED_BINDINGS.filter(
    (binding) => !availableBindings.includes(binding)
  );
  const writerAvailable = missingBindings.length === 0;

  return {
    format: "occt-brep",
    label: "OCCT BRep checkpoint",
    status: writerAvailable ? "available" : "unavailable",
    writerAvailable,
    boundary: "occt-wasm",
    packageName: "opencascade.js",
    packageVersion: CHECKPOINT_WRITER_PACKAGE_VERSION,
    checkedBindings: OCCT_BREP_CHECKPOINT_WRITER_REQUIRED_BINDINGS,
    availableBindings,
    missingBindings,
    reason: writerAvailable
      ? "The current OpenCascade.js boundary exposes BRepTools.Write_3 and the virtual file-system bindings required for native BRep checkpoint payload bytes."
      : "The current OpenCascade.js boundary does not expose every binding required for native BRep checkpoint payload bytes."
  };
}

export async function getOcctBrepCheckpointWriterCapabilityWithLoader(
  loadOcct: OcctLoader
): Promise<OcctBrepCheckpointWriterCapability> {
  const oc = await loadOcct();

  return getOcctBrepCheckpointWriterCapabilityWithInstance(oc);
}

function writeBrepCheckpointBytes(
  oc: OpenCascadeInstance,
  shape: TopoDS_Shape
): Uint8Array {
  const progress = new oc.Message_ProgressRange_1();
  const filename = `/tmp/partbench-checkpoint-${Date.now()}-${Math.random()
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

function assertBrepCheckpointWriterBindings(oc: OpenCascadeInstance): void {
  const capability = getOcctBrepCheckpointWriterCapabilityWithInstance(oc);

  if (!capability.writerAvailable) {
    throw new Error(
      `Open CASCADE BRep checkpoint writer bindings unavailable: ${capability.missingBindings.join(
        ", "
      )}.`
    );
  }
}

function hasBrepCheckpointWriterBinding(
  oc: Partial<OpenCascadeInstance>,
  binding: string
): boolean {
  switch (binding) {
    case "BRepTools.Write_3":
      return typeof oc.BRepTools?.Write_3 === "function";
    case "Message_ProgressRange_1":
      return typeof oc.Message_ProgressRange_1 === "function";
    case "FS.readFile":
      return typeof getOptionalOcctFs(oc)?.readFile === "function";
    case "FS.unlink":
      return typeof getOptionalOcctFs(oc)?.unlink === "function";
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
