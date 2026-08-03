import type { OpenCascadeInstance, TopoDS_Shape } from "opencascade.js";
import type { OcctLoader } from "./tessellateBox";
import {
  readExactBodyMetadata,
  readExactTopologySnapshot,
  withImportedBrepShape,
  withOcctExactBodyShape,
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
  makeCircularPatternShape,
  makeLinearPatternShape,
  type OcctAxisFrame,
  type OcctDirection
} from "./pattern";
import { makeMirrorShape, type OcctMirrorPlaneFrame } from "./mirror";
import { makeArtifactShellShape, type OcctTopologyFaceRef } from "./shell";
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
import {
  readTriangulatedShape,
  type OcctMeshData,
  type OcctPrimitiveKind
} from "./readTriangulatedShape";

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

export interface OcctExactTopologyCheckpointPayloadInput {
  readonly checkpointId: string;
  readonly bodyId: string;
  readonly source: OcctExactBodyArtifactSource;
}

export interface OcctExactTopologyCheckpointPayload {
  readonly checkpointId: string;
  readonly bodyId: string;
  readonly sourceKind: OcctExactTopologySourceKind;
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

export type OcctExactBodyArtifactShapePolicy =
  | "singleSolid"
  | "singleShapeOneOrMoreSolids";

export interface OcctExactBodyArtifactLeaf {
  readonly kind: "bodyArtifact";
  readonly artifactVersion: "partbench.exact-body-artifact.v1";
  readonly bodyId: string;
  readonly sourceType: string;
  readonly documentSourceIdentity: {
    readonly algorithm: "partbench-source-v1";
    readonly sha256: string;
  };
  readonly bodySourceIdentitySignature: string;
  readonly sourceCacheKeySha256: string;
  readonly sourceGraphNodeCount: number;
  readonly units: "mm" | "cm" | "m" | "in";
  readonly shapePolicy: OcctExactBodyArtifactShapePolicy;
  readonly sourceKind: OcctExactTopologySourceKind;
  readonly brepFormat: "occt-brep";
  readonly brepWriter: "BRepTools.Write_3";
  readonly brepBytes: Uint8Array;
  readonly brepByteLength: number;
  readonly brepSha256: string;
  readonly topologySignature: string;
}

export interface OcctArtifactHoleSource {
  readonly kind: "artifactHole";
  readonly target: OcctExactBodyArtifactLeaf;
  readonly tool: OcctHoleToolSource;
}

export interface OcctArtifactLinearPatternSource {
  readonly kind: "artifactLinearPattern";
  readonly seed: OcctExactBodyArtifactLeaf;
  readonly direction: OcctDirection;
  readonly spacing: number;
  readonly instanceCount: number;
}

export interface OcctArtifactCircularPatternSource {
  readonly kind: "artifactCircularPattern";
  readonly seed: OcctExactBodyArtifactLeaf;
  readonly axis: OcctAxisFrame;
  readonly totalAngleDegrees: number;
  readonly instanceCount: number;
}

export interface OcctArtifactMirrorSource {
  readonly kind: "artifactMirror";
  readonly seed: OcctExactBodyArtifactLeaf;
  readonly plane: OcctMirrorPlaneFrame;
  readonly includeOriginal: boolean;
}

export interface OcctArtifactShellSource {
  readonly kind: "artifactShell";
  readonly target: OcctExactBodyArtifactLeaf;
  readonly wallThickness: number;
  readonly openFaces: readonly OcctTopologyFaceRef[];
}

export type OcctArtifactDownstreamSource =
  | OcctArtifactHoleSource
  | OcctArtifactLinearPatternSource
  | OcctArtifactCircularPatternSource
  | OcctArtifactMirrorSource
  | OcctArtifactShellSource;

export type OcctExactBodyArtifactSource =
  | OcctExactBodyMetadataSource
  | OcctCheckpointBodyArtifactSource
  | OcctCheckpointBooleanArtifactSource
  | OcctCheckpointHoleArtifactSource
  | OcctCheckpointEdgeFinishArtifactSource
  | OcctExactBodyArtifactLeaf
  | OcctArtifactDownstreamSource;

export interface OcctExactBodyArtifactInput {
  readonly source: OcctExactBodyArtifactSource;
}

export interface OcctExactBodyMeshInput extends OcctExactBodyArtifactInput {
  readonly linearDeflection?: number;
  readonly angularDeflection?: number;
}

export interface OcctExactBodyArtifact {
  readonly sourceKind: OcctExactTopologySourceKind;
  readonly brepFormat: "occt-brep";
  readonly brepWriter: "BRepTools.Write_3";
  readonly brepBytes: Uint8Array;
  readonly brepByteLength: number;
  readonly metadata: ReturnType<typeof readExactBodyMetadata>;
  readonly topologySnapshot: OcctExactTopologySnapshot;
  readonly displayMesh: OcctMeshData;
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
  if (input.source.kind !== "bodyArtifact") {
    assertBrepCheckpointWriterBindings(oc);
  }
  return withOcctExactBodyArtifactShape(
    oc,
    input.source,
    (shape, sourceKind, generatedReferences) =>
      createExactBodyArtifact(
        oc,
        shape,
        sourceKind,
        generatedReferences,
        input.source.kind === "bodyArtifact"
          ? input.source.brepBytes
          : undefined
      )
  );
}

export async function createOcctExactBodyMeshWithLoader(
  loadOcct: OcctLoader,
  input: OcctExactBodyMeshInput
): Promise<OcctMeshData> {
  return createOcctExactBodyMeshWithInstance(await loadOcct(), input);
}

export function createOcctExactBodyMeshWithInstance(
  oc: OpenCascadeInstance,
  input: OcctExactBodyMeshInput
): OcctMeshData {
  return withOcctExactBodyArtifactShape(
    oc,
    input.source,
    (shape, sourceKind) => {
      const mesh = new oc.BRepMesh_IncrementalMesh_2(
        shape,
        input.linearDeflection ?? 0.25,
        false,
        input.angularDeflection ?? 0.5,
        false
      );
      try {
        if (!mesh.IsDone()) {
          throw new Error(
            `Open CASCADE exact-body meshing failed with status ${mesh.GetStatusFlags()}.`
          );
        }
        return readTriangulatedShape(oc, shape, toMeshPrimitive(sourceKind));
      } finally {
        mesh.delete();
      }
    }
  );
}

export function createOcctExactBodyArtifactMetadataWithInstance(
  oc: OpenCascadeInstance,
  input: OcctExactBodyArtifactInput
): ReturnType<typeof readExactBodyMetadata> {
  return withOcctExactBodyArtifactShape(
    oc,
    input.source,
    (shape, sourceKind, generatedReferences) => ({
      ...readExactBodyMetadata(oc, shape, sourceKind),
      ...(generatedReferences ? { generatedReferences } : {})
    })
  );
}

export function withOcctExactBodyArtifactShape<T>(
  oc: OpenCascadeInstance,
  source: OcctExactBodyArtifactSource,
  readResult: (
    shape: TopoDS_Shape,
    sourceKind: OcctExactTopologySourceKind,
    generatedReferences?: OcctGeneratedReferences
  ) => T
): T {
  if (
    source.kind === "bodyArtifact" ||
    source.kind === "artifactHole" ||
    source.kind === "artifactLinearPattern" ||
    source.kind === "artifactCircularPattern" ||
    source.kind === "artifactMirror" ||
    source.kind === "artifactShell"
  ) {
    return withArtifactBackedExactBodyShape(oc, source, readResult);
  }
  if (
    source.kind === "checkpointBody" ||
    source.kind === "checkpointBoolean" ||
    source.kind === "checkpointHole" ||
    source.kind === "checkpointEdgeFinish"
  ) {
    return withCheckpointBackedExactBodyShape(oc, source, readResult);
  }

  if (source.kind === "extrude" && source.profile.kind === "wire") {
    const build = makeWireExtrudeShapeWithReferences(
      oc,
      source as OcctWireExtrudeSource
    );
    return withOcctWireExtrudeBuildShape(build, (shape, references) =>
      readResult(shape, "extrude", references)
    );
  }

  return withOcctExactBodyShape(oc, source, readResult);
}

function withArtifactBackedExactBodyShape<T>(
  oc: OpenCascadeInstance,
  source: OcctExactBodyArtifactLeaf | OcctArtifactDownstreamSource,
  readResult: (
    shape: TopoDS_Shape,
    sourceKind: OcctExactTopologySourceKind
  ) => T
): T {
  const leaf =
    source.kind === "bodyArtifact"
      ? source
      : source.kind === "artifactHole" || source.kind === "artifactShell"
        ? source.target
        : source.seed;
  return withVerifiedBodyArtifactShape(oc, leaf, (operand, solidCount) => {
    if (source.kind === "bodyArtifact") {
      return readResult(operand, source.sourceKind);
    }
    if (source.kind === "artifactHole") {
      return withOcctHoleResultOnShape(oc, operand, source.tool, (shape) =>
        readResult(shape, "hole")
      );
    }
    let result: TopoDS_Shape | undefined;
    try {
      if (source.kind === "artifactLinearPattern") {
        assertArtifactPatternInput(source);
        result = makeLinearPatternShape(oc, operand, source);
        return readResult(result, "linearPattern");
      }
      if (source.kind === "artifactCircularPattern") {
        assertArtifactPatternInput(source);
        result = makeCircularPatternShape(oc, operand, source);
        return readResult(result, "circularPattern");
      }
      if (source.kind === "artifactMirror") {
        assertArtifactMirrorInput(source);
        result = makeMirrorShape(oc, operand, source);
        return readResult(result, "mirror");
      }
      if (solidCount !== 1) {
        throw {
          code: "INVALID_RESULT",
          message: "Artifact shell requires a single-solid target artifact."
        };
      }
      result = makeArtifactShellShape(oc, operand, source);
      return readResult(result, "shell");
    } finally {
      result?.delete();
    }
  });
}

function withVerifiedBodyArtifactShape<T>(
  oc: OpenCascadeInstance,
  leaf: OcctExactBodyArtifactLeaf,
  readResult: (shape: TopoDS_Shape, solidCount: number) => T
): T {
  assertBodyArtifactLeaf(leaf);
  return withImportedBrepShape(oc, leaf.brepBytes, (shape) => {
    const topology = readExactTopologySnapshot(oc, shape, leaf.sourceKind);
    if (topology.signature !== leaf.topologySignature) {
      throw {
        code: "INVALID_RESULT",
        message: "Body artifact topology signature mismatched its BRep shape."
      };
    }
    const solidCount = readExactBodyMetadata(oc, shape, leaf.sourceKind)
      .topologyCounts.solidCount;
    if (
      (leaf.shapePolicy === "singleSolid" && solidCount !== 1) ||
      (leaf.shapePolicy === "singleShapeOneOrMoreSolids" && solidCount < 1)
    ) {
      throw {
        code: "INVALID_RESULT",
        message: "Body artifact shape policy mismatched its BRep shape."
      };
    }
    return readResult(shape, solidCount);
  });
}

function assertBodyArtifactLeaf(leaf: OcctExactBodyArtifactLeaf): void {
  if (
    !leaf ||
    leaf.kind !== "bodyArtifact" ||
    leaf.artifactVersion !== "partbench.exact-body-artifact.v1" ||
    !isBoundedString(leaf.bodyId) ||
    !isBoundedString(leaf.sourceType) ||
    leaf.documentSourceIdentity?.algorithm !== "partbench-source-v1" ||
    !isSha256(leaf.documentSourceIdentity.sha256) ||
    !isBoundedString(leaf.bodySourceIdentitySignature) ||
    !isSha256(leaf.sourceCacheKeySha256) ||
    !Number.isInteger(leaf.sourceGraphNodeCount) ||
    leaf.sourceGraphNodeCount < 1 ||
    leaf.sourceGraphNodeCount > 4_096 ||
    !["mm", "cm", "m", "in"].includes(leaf.units) ||
    !["singleSolid", "singleShapeOneOrMoreSolids"].includes(leaf.shapePolicy) ||
    !isExactTopologySourceKind(leaf.sourceKind) ||
    leaf.brepFormat !== "occt-brep" ||
    leaf.brepWriter !== "BRepTools.Write_3" ||
    !(leaf.brepBytes instanceof Uint8Array) ||
    leaf.brepBytes.byteLength < 1 ||
    leaf.brepBytes.byteLength > 128 * 1024 * 1024 ||
    leaf.brepByteLength !== leaf.brepBytes.byteLength ||
    !isSha256(leaf.brepSha256) ||
    !isBoundedString(leaf.topologySignature)
  ) {
    throw {
      code: "INVALID_RESULT",
      message: "Invalid identity-bound exact body artifact leaf."
    };
  }
}

function assertArtifactPatternInput(
  source: OcctArtifactLinearPatternSource | OcctArtifactCircularPatternSource
): void {
  const vector =
    source.kind === "artifactLinearPattern"
      ? source.direction
      : source.axis.direction;
  const commonValid =
    Number.isInteger(source.instanceCount) &&
    source.instanceCount >= 2 &&
    source.instanceCount <= 4_096 &&
    isUnitVector(vector);
  const specificValid =
    source.kind === "artifactLinearPattern"
      ? Number.isFinite(source.spacing) && source.spacing > 0
      : isFiniteVector(source.axis.origin) &&
        Number.isFinite(source.totalAngleDegrees) &&
        source.totalAngleDegrees > 0 &&
        source.totalAngleDegrees <= 360;
  if (!commonValid || !specificValid) {
    throw {
      code: "INVALID_DIMENSIONS",
      message: "Invalid artifact pattern source."
    };
  }
}

function assertArtifactMirrorInput(source: OcctArtifactMirrorSource): void {
  if (
    !isFiniteVector(source.plane.point) ||
    !isUnitVector(source.plane.normal) ||
    typeof source.includeOriginal !== "boolean"
  ) {
    throw {
      code: "INVALID_DIMENSIONS",
      message: "Invalid artifact mirror source."
    };
  }
}

function isFiniteVector(
  value: unknown
): value is readonly [number, number, number] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((entry) => typeof entry === "number" && Number.isFinite(entry))
  );
}

function isUnitVector(value: unknown): boolean {
  return (
    isFiniteVector(value) &&
    Math.abs(Math.hypot(value[0], value[1], value[2]) - 1) <= 1e-9
  );
}

function isBoundedString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 256;
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

function isExactTopologySourceKind(
  value: unknown
): value is OcctExactTopologySourceKind {
  return (
    typeof value === "string" &&
    [
      "extrude",
      "box",
      "cylinder",
      "sphere",
      "cone",
      "torus",
      "booleanExtrudes",
      "revolve",
      "hole",
      "edgeFinish",
      "sweep",
      "loft",
      "linearPattern",
      "circularPattern",
      "mirror",
      "shell",
      "importedBody"
    ].includes(value)
  );
}

function withCheckpointBackedExactBodyShape<T>(
  oc: OpenCascadeInstance,
  source:
    | OcctCheckpointBodyArtifactSource
    | OcctCheckpointBooleanArtifactSource
    | OcctCheckpointHoleArtifactSource
    | OcctCheckpointEdgeFinishArtifactSource,
  readResult: (
    shape: TopoDS_Shape,
    sourceKind: OcctExactTopologySourceKind
  ) => T
): T {
  const checkpoint = source.kind === "checkpointBody" ? source : source.target;
  return withImportedBrepShape(oc, checkpoint.brepBytes, (target) => {
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
    if (source.kind === "checkpointBody") {
      return readResult(target, checkpoint.topologySourceKind);
    }
    if (source.kind === "checkpointHole") {
      return withOcctHoleResultOnShape(oc, target, source.tool, (shape) =>
        readResult(shape, "hole")
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
        (shape) => readResult(shape, "edgeFinish")
      );
    }
    return withCheckpointBooleanResultShape(oc, target, source, (shape) =>
      readResult(shape, "booleanExtrudes")
    );
  });
}

function toMeshPrimitive(
  sourceKind: OcctExactTopologySourceKind
): OcctPrimitiveKind {
  switch (sourceKind) {
    case "box":
    case "cylinder":
    case "sphere":
    case "cone":
    case "torus":
    case "extrude":
    case "revolve":
    case "hole":
    case "edgeFinish":
    case "sweep":
    case "loft":
      return sourceKind;
    default:
      return "boolean";
  }
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
  generatedReferences?: OcctGeneratedReferences,
  retainedBrepBytes?: Uint8Array
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
  const brepBytes = retainedBrepBytes ?? writeBrepCheckpointBytes(oc, shape);
  const metadata = {
    ...readExactBodyMetadata(oc, shape, sourceKind),
    ...(generatedReferences ? { generatedReferences } : {})
  };
  const topologySnapshot = {
    ...readExactTopologySnapshot(oc, shape, sourceKind),
    ...(generatedReferences ? { generatedReferences } : {})
  };
  const mesher = new oc.BRepMesh_IncrementalMesh_2(
    shape,
    0.25,
    false,
    0.5,
    false
  );
  let displayMesh: OcctMeshData;
  try {
    if (!mesher.IsDone()) {
      throw new Error(
        `Open CASCADE exact artifact display meshing failed with status ${mesher.GetStatusFlags()}.`
      );
    }
    displayMesh = readTriangulatedShape(oc, shape, toMeshPrimitive(sourceKind));
  } finally {
    mesher.delete();
  }

  return {
    sourceKind,
    brepFormat: "occt-brep",
    brepWriter: "BRepTools.Write_3",
    brepBytes,
    brepByteLength: brepBytes.byteLength,
    metadata,
    topologySnapshot,
    displayMesh
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
