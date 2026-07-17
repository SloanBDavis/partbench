import type {
  CadExactExportArtifact,
  CadExactExportBodySource,
  CadExactExportBooleanResultSource,
  CadExactExportBooleanSource,
  CadExactExportPrimitiveExtrudeSource,
  CadExactExportWireExtrudeSource,
  CadExportDiagnostic,
  ProjectExactExportQueryResponse
} from "@web-cad/cad-protocol";
import { createExactStepExportWorkerRequest } from "@web-cad/geometry-worker/browser";
import type {
  BooleanExtrudePrimitiveSource,
  BooleanExtrudeResultSource,
  BooleanExtrudeSource,
  BooleanExtrudeToolSource,
  GeometryWorker,
  GeometryKernelExactStepExportArtifact,
  ResolvedPlanarWireProfile
} from "@web-cad/geometry-worker";

type ExactStepExportWorkerBody = Parameters<
  typeof createExactStepExportWorkerRequest
>[0]["bodies"][number];
type CadExactExportBooleanBodySource = Extract<
  CadExactExportBodySource,
  { readonly kind: "booleanExtrudes" }
>;

export interface ProjectExactStepExportExecutionInput {
  readonly exactExport: ProjectExactExportQueryResponse;
  readonly worker: GeometryWorker;
}

export async function executeProjectExactStepExport({
  exactExport,
  worker
}: ProjectExactStepExportExecutionInput): Promise<ProjectExactExportQueryResponse> {
  if (
    exactExport.format !== "step" ||
    !exactExport.available ||
    exactExport.exportSources.length === 0
  ) {
    return exactExport;
  }

  const workerResponse = await worker.execute(
    createExactStepExportWorkerRequest({
      id: "project-export-step",
      units: exactExport.units,
      bodies: exactExport.exportSources.map(mapExactExportSourceToWorkerBody)
    })
  );

  if (!workerResponse.response.ok) {
    const diagnostic = createExactStepExportFailureDiagnostic(
      workerResponse.response.error.message
    );
    const diagnostics = [diagnostic, ...exactExport.diagnostics];

    return {
      ...exactExport,
      status: "unavailable",
      available: false,
      canExportFile: false,
      exportableBodyCount: 0,
      diagnosticCount: diagnostics.length,
      diagnostics
    };
  }

  const artifact = await createProtocolArtifact(
    workerResponse.response.artifact
  );

  return {
    ...exactExport,
    artifact
  };
}

function mapExactExportSourceToWorkerBody(
  source: CadExactExportBodySource
): ExactStepExportWorkerBody {
  if (isCadExactExportBooleanBodySource(source)) {
    return {
      bodyId: source.bodyId,
      ...(source.bodyName ? { bodyName: source.bodyName } : {}),
      ...mapExactExportBooleanResultSource(source)
    };
  }

  if (source.profile.kind === "wire") {
    const profile: ResolvedPlanarWireProfile = source.profile;
    return {
      bodyId: source.bodyId,
      ...(source.bodyName ? { bodyName: source.bodyName } : {}),
      sketchPlane: source.sketchPlane,
      profile,
      depth: source.depth,
      side: source.side
    };
  }

  return {
    bodyId: source.bodyId,
    ...(source.bodyName ? { bodyName: source.bodyName } : {}),
    sketchPlane: source.sketchPlane,
    profile: source.profile,
    depth: source.depth,
    side: source.side,
    ...(source.placementFrame ? { placementFrame: source.placementFrame } : {})
  };
}

function mapExactExportBooleanResultSource(
  source: CadExactExportBooleanResultSource
): BooleanExtrudeResultSource {
  const target = mapExactExportBooleanSource(source.target);
  if (source.operation === "cut") {
    return {
      kind: "booleanExtrudes",
      operation: "cut",
      target,
      tool: mapExactExportBooleanTool(source.tool)
    };
  }

  return {
    kind: "booleanExtrudes",
    operation: "add",
    target,
    tool: mapExactExportBooleanTool(source.tool)
  };
}

function mapExactExportBooleanSource(
  source: CadExactExportBooleanSource
): BooleanExtrudeSource {
  return isCadExactExportBooleanResultSource(source)
    ? mapExactExportBooleanResultSource(source)
    : mapExactExportPrimitiveSource(source);
}

function mapExactExportBooleanTool(
  source: CadExactExportPrimitiveExtrudeSource | CadExactExportWireExtrudeSource
): BooleanExtrudeToolSource {
  if (isCadExactExportWireSource(source)) {
    const profile: ResolvedPlanarWireProfile = source.profile;
    return {
      sketchPlane: source.sketchPlane,
      profile,
      depth: source.depth,
      side: source.side
    };
  }

  return mapExactExportPrimitiveSource(source);
}

function mapExactExportPrimitiveSource(
  source: CadExactExportPrimitiveExtrudeSource
): BooleanExtrudePrimitiveSource {
  return {
    sketchPlane: source.sketchPlane,
    profile: source.profile,
    depth: source.depth,
    side: source.side,
    ...(source.placementFrame ? { placementFrame: source.placementFrame } : {})
  };
}

function isCadExactExportBooleanBodySource(
  source: CadExactExportBodySource
): source is CadExactExportBooleanBodySource {
  return "kind" in source && source.kind === "booleanExtrudes";
}

function isCadExactExportBooleanResultSource(
  source: CadExactExportBooleanSource
): source is CadExactExportBooleanResultSource {
  return "kind" in source && source.kind === "booleanExtrudes";
}

function isCadExactExportWireSource(
  source: CadExactExportPrimitiveExtrudeSource | CadExactExportWireExtrudeSource
): source is CadExactExportWireExtrudeSource {
  return source.profile.kind === "wire";
}

async function createProtocolArtifact(
  artifact: GeometryKernelExactStepExportArtifact
): Promise<CadExactExportArtifact> {
  return {
    format: "step",
    fileName: "partbench-export.step",
    mimeType: "model/step",
    byteLength: artifact.byteLength,
    sha256: await sha256Hex(artifact.bytes),
    bytesBase64: bytesToBase64(artifact.bytes)
  };
}

function createExactStepExportFailureDiagnostic(
  message: string
): CadExportDiagnostic {
  return {
    code: "EXPORT_EXACT_WRITER_FAILED",
    status: "unavailable",
    format: "step",
    message: `STEP exact export failed in the geometry boundary: ${message}`,
    expected: "real STEP bytes from geometry-worker export",
    received: "geometry boundary failure"
  };
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    copyBytesToArrayBuffer(bytes)
  );

  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function bytesToBase64(bytes: Uint8Array): string {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = "";

  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    const triplet = (first << 16) | ((second ?? 0) << 8) | (third ?? 0);

    output += alphabet[(triplet >> 18) & 63];
    output += alphabet[(triplet >> 12) & 63];
    output += second === undefined ? "=" : alphabet[(triplet >> 6) & 63];
    output += third === undefined ? "=" : alphabet[triplet & 63];
  }

  return output;
}

function copyBytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);

  return copy.buffer;
}
