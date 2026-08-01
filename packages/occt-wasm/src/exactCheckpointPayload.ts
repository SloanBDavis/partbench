import type { OpenCascadeInstance, TopoDS_Shape } from "opencascade.js";
import type { OcctLoader } from "./tessellateBox";
import {
  readExactBodyMetadata,
  readExactTopologySnapshot,
  withImportedBrepShape,
  withOcctExactBodyShape,
  type OcctExactBodyMetadataInput,
  type OcctExactBodyMetadataSource,
  type OcctExactTopologySnapshot,
  type OcctExactTopologySourceKind
} from "./exactMetadata";
import {
  makeBooleanExtrudeToolShape,
  type OcctBooleanExtrudeToolSource,
  type OcctBooleanOperation
} from "./booleanExtrudes";
import { withOcctHoleResultOnShape, type OcctHoleToolSource } from "./hole";
import {
  withOcctCheckpointEdgeFinishResultShape,
  type OcctEdgeFinishOperation
} from "./edgeFinish";
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

export interface OcctCheckpointBodyArtifactSource {
  readonly kind: "checkpointBody";
  readonly brepBytes: Uint8Array;
  readonly brepByteLength: number;
  readonly brepSha256: string;
  readonly topologySourceKind: OcctExactTopologySourceKind;
  readonly topologySignature: string;
}

export interface OcctCheckpointBooleanArtifactSource {
  readonly kind: "checkpointBoolean";
  readonly operation: OcctBooleanOperation;
  readonly target: OcctCheckpointBodyArtifactSource;
  readonly tool: OcctBooleanExtrudeToolSource;
}

export interface OcctCheckpointHoleArtifactSource {
  readonly kind: "checkpointHole";
  readonly target: OcctCheckpointBodyArtifactSource;
  readonly tool: OcctHoleToolSource;
}

export interface OcctCheckpointEdgeFinishArtifactSource {
  readonly kind: "checkpointEdgeFinish";
  readonly operation: OcctEdgeFinishOperation;
  readonly target: OcctCheckpointBodyArtifactSource;
  readonly checkpointEntityId: string;
  readonly amount: number;
}

export type OcctExactBodyArtifactSource =
  | OcctExactBodyMetadataSource
  | OcctCheckpointBodyArtifactSource
  | OcctCheckpointBooleanArtifactSource
  | OcctCheckpointHoleArtifactSource
  | OcctCheckpointEdgeFinishArtifactSource;

export interface OcctExactBodyArtifactInput {
  readonly source: OcctExactBodyArtifactSource;
}

export interface OcctExactBodyArtifact {
  readonly sourceKind: OcctExactTopologySourceKind;
  readonly brepFormat: "occt-brep";
  readonly brepWriter: "BRepTools.Write_3";
  readonly brepBytes: Uint8Array;
  readonly brepByteLength: number;
  readonly metadata: ReturnType<typeof readExactBodyMetadata>;
  readonly topologySnapshot: OcctExactTopologySnapshot;
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
  const artifact = createOcctExactBodyArtifactWithInstance(oc, input);
  return {
    checkpointId: input.checkpointId,
    bodyId: input.bodyId,
    sourceKind: artifact.sourceKind,
    brepFormat: artifact.brepFormat,
    brepWriter: artifact.brepWriter,
    brepBytes: artifact.brepBytes,
    brepByteLength: artifact.brepByteLength,
    topologySnapshot: artifact.topologySnapshot,
    signaturePayload: createCheckpointSignaturePayload(
      input.checkpointId,
      artifact.topologySnapshot
    )
  };
}

export async function createOcctExactBodyArtifactWithLoader(
  loadOcct: OcctLoader,
  input: OcctExactBodyArtifactInput
): Promise<OcctExactBodyArtifact> {
  return createOcctExactBodyArtifactWithInstance(await loadOcct(), input);
}

export function createOcctExactBodyArtifactWithInstance(
  oc: OpenCascadeInstance,
  input: OcctExactBodyArtifactInput
): OcctExactBodyArtifact {
  assertBrepCheckpointWriterBindings(oc);

  if (
    input.source.kind === "checkpointBody" ||
    input.source.kind === "checkpointBoolean" ||
    input.source.kind === "checkpointHole" ||
    input.source.kind === "checkpointEdgeFinish"
  ) {
    return createCheckpointBackedExactBodyArtifact(oc, input.source);
  }

  if (input.source.kind === "extrude" && input.source.profile.kind === "wire") {
    const build = makeWireExtrudeShapeWithReferences(
      oc,
      input.source as OcctWireExtrudeSource
    );
    return withOcctWireExtrudeBuildShape(build, (shape, references) =>
      createExactBodyArtifact(oc, shape, "extrude", references)
    );
  }

  return withOcctExactBodyShape(oc, input.source, (shape, sourceKind) =>
    createExactBodyArtifact(oc, shape, sourceKind)
  );
}

function createCheckpointBackedExactBodyArtifact(
  oc: OpenCascadeInstance,
  source:
    | OcctCheckpointBodyArtifactSource
    | OcctCheckpointBooleanArtifactSource
    | OcctCheckpointHoleArtifactSource
    | OcctCheckpointEdgeFinishArtifactSource
): OcctExactBodyArtifact {
  const checkpoint = source.kind === "checkpointBody" ? source : source.target;
  return withImportedBrepShape(oc, checkpoint.brepBytes, (target) => {
    if (source.kind === "checkpointBody") {
      return createExactBodyArtifact(oc, target, checkpoint.topologySourceKind);
    }
    const topology = readExactTopologySnapshot(
      oc,
      target,
      checkpoint.topologySourceKind
    );
    if (topology.signature !== checkpoint.topologySignature) {
      throw {
        code: "INVALID_RESULT",
        message: "Checkpoint topology signature mismatched its BRep shape."
      };
    }
    if (source.kind === "checkpointHole") {
      return withOcctHoleResultOnShape(oc, target, source.tool, (shape) =>
        createExactBodyArtifact(oc, shape, "hole")
      );
    }
    if (source.kind === "checkpointEdgeFinish") {
      return withOcctCheckpointEdgeFinishResultShape(
        oc,
        {
          target,
          checkpointEntityId: source.checkpointEntityId,
          operation: source.operation,
          amount: source.amount
        },
        (shape) => createExactBodyArtifact(oc, shape, "edgeFinish")
      );
    }
    return withCheckpointBooleanResultShape(oc, target, source, (shape) =>
      createExactBodyArtifact(oc, shape, "booleanExtrudes")
    );
  });
}

function withCheckpointBooleanResultShape<T>(
  oc: OpenCascadeInstance,
  target: TopoDS_Shape,
  source: OcctCheckpointBooleanArtifactSource,
  readResult: (shape: TopoDS_Shape) => T
): T {
  const toolBuilder = makeBooleanExtrudeToolShape(oc, source.tool);
  const range = new oc.Message_ProgressRange_1();
  let tool: TopoDS_Shape | undefined;
  let operation:
    | InstanceType<typeof oc.BRepAlgoAPI_Fuse_3>
    | InstanceType<typeof oc.BRepAlgoAPI_Cut_3>
    | undefined;
  let result: TopoDS_Shape | undefined;
  try {
    tool = toolBuilder.Shape();
    operation =
      source.operation === "add"
        ? new oc.BRepAlgoAPI_Fuse_3(target, tool, range)
        : new oc.BRepAlgoAPI_Cut_3(target, tool, range);
    if (operation.HasErrors()) {
      throw new Error(`Open CASCADE checkpoint ${source.operation} failed.`);
    }
    result = operation.Shape();
    if (result.IsNull()) {
      throw new Error(`Open CASCADE checkpoint ${source.operation} was null.`);
    }
    return readResult(result);
  } finally {
    result?.delete();
    operation?.delete();
    tool?.delete();
    range.delete();
    toolBuilder.delete();
  }
}

function createExactBodyArtifact(
  oc: OpenCascadeInstance,
  shape: TopoDS_Shape,
  sourceKind: OcctExactBodyArtifact["sourceKind"],
  generatedReferences?: OcctGeneratedReferences
): OcctExactBodyArtifact {
  if (shape.IsNull()) {
    throw new Error(
      "Open CASCADE exact artifact source returned a null shape."
    );
  }
  if (!oc.BRepCheck_Analyzer) {
    throw {
      code: "UNAVAILABLE_BINDING",
      message: "Open CASCADE exact artifact validation binding is unavailable."
    };
  }
  const analyzer = new oc.BRepCheck_Analyzer(shape, true, false);
  try {
    if (!analyzer.IsValid_2()) {
      throw new Error("Open CASCADE exact artifact source is not valid.");
    }
  } finally {
    analyzer.delete();
  }
  const brepBytes = writeBrepCheckpointBytes(oc, shape);
  const metadata = {
    ...readExactBodyMetadata(oc, shape, sourceKind),
    ...(generatedReferences ? { generatedReferences } : {})
  };
  const topologySnapshot = {
    ...readExactTopologySnapshot(oc, shape, sourceKind),
    ...(generatedReferences ? { generatedReferences } : {})
  };

  return {
    sourceKind,
    brepFormat: "occt-brep",
    brepWriter: "BRepTools.Write_3",
    brepBytes,
    brepByteLength: brepBytes.byteLength,
    metadata,
    topologySnapshot
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
