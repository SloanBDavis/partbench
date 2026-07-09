import type {
  CadExportReadinessStatus,
  DocumentUnits,
  ProjectExportReadinessQueryResponse
} from "@web-cad/cad-protocol";
import type {
  RenderTransform,
  RenderTriangleMesh,
  Vec3
} from "@web-cad/renderer";
import {
  createDerivedGeometryCacheKey,
  type DerivedGeometryEntry,
  type DerivedGeometrySnapshot,
  type DerivedGeometrySource
} from "./derivedGeometry";

export type VisualizationMeshExportFormat = "glb";

export type VisualizationMeshExportDiagnosticCode =
  | "VISUALIZATION_EXPORT_PROJECT_EMPTY"
  | "VISUALIZATION_EXPORT_SOURCE_UNSUPPORTED"
  | "VISUALIZATION_EXPORT_MESH_MISSING"
  | "VISUALIZATION_EXPORT_MESH_PENDING"
  | "VISUALIZATION_EXPORT_MESH_FAILED"
  | "VISUALIZATION_EXPORT_MESH_UNSUPPORTED"
  | "VISUALIZATION_EXPORT_MESH_STALE"
  | "VISUALIZATION_EXPORT_MESH_INVALID"
  | "VISUALIZATION_EXPORT_WRITER_FAILED";

export interface VisualizationMeshExportDiagnostic {
  readonly code: VisualizationMeshExportDiagnosticCode;
  readonly status: CadExportReadinessStatus;
  readonly message: string;
  readonly format: VisualizationMeshExportFormat;
  readonly bodyId?: string;
  readonly bodyName?: string;
  readonly expected?: string;
  readonly received?: string;
}

export interface VisualizationMeshExportStatus {
  readonly format: VisualizationMeshExportFormat;
  readonly label: string;
  readonly status: CadExportReadinessStatus;
  readonly available: boolean;
  readonly fileName: string;
  readonly mimeType: "model/gltf-binary";
  readonly units: DocumentUnits;
  readonly detail: string;
  readonly limitation: string;
  readonly nextStep: string;
  readonly candidateBodyCount: number;
  readonly exportableBodyCount: number;
  readonly skippedBodyCount: number;
  readonly vertexCount: number;
  readonly triangleCount: number;
  readonly diagnostics: readonly VisualizationMeshExportDiagnostic[];
}

export interface VisualizationMeshExportBodyMetadata {
  readonly bodyId: string;
  readonly bodyName?: string;
  readonly vertexCount: number;
  readonly triangleCount: number;
}

export interface VisualizationMeshExportMetadata {
  readonly format: VisualizationMeshExportFormat;
  readonly exportKind: "visualization";
  readonly authoritative: false;
  readonly units: DocumentUnits;
  readonly bodyCount: number;
  readonly vertexCount: number;
  readonly triangleCount: number;
  readonly byteLength: number;
  readonly jsonByteLength: number;
  readonly binaryByteLength: number;
  readonly bodySummaries: readonly VisualizationMeshExportBodyMetadata[];
}

export interface VisualizationMeshExportArtifact {
  readonly fileName: string;
  readonly mimeType: "model/gltf-binary";
  readonly bytes: Uint8Array<ArrayBuffer>;
  readonly metadata: VisualizationMeshExportMetadata;
}

export type VisualizationMeshExportResult =
  | {
      readonly ok: true;
      readonly status: VisualizationMeshExportStatus;
      readonly artifact: VisualizationMeshExportArtifact;
    }
  | {
      readonly ok: false;
      readonly status: VisualizationMeshExportStatus;
      readonly diagnostics: readonly VisualizationMeshExportDiagnostic[];
    };

interface VisualizationMeshExportInput {
  readonly exportReadiness: ProjectExportReadinessQueryResponse;
  readonly derivedGeometry: DerivedGeometrySnapshot;
  readonly derivedGeometrySources: readonly DerivedGeometrySource[];
}

interface VisualizationMeshExportPlan {
  readonly status: VisualizationMeshExportStatus;
  readonly bodies: readonly VisualizationMeshExportBody[];
}

interface VisualizationMeshExportBody {
  readonly bodyId: string;
  readonly bodyName?: string;
  readonly mesh: RenderTriangleMesh;
}

interface GlbMeshInput {
  readonly label: string;
  readonly mesh: RenderTriangleMesh;
}

interface GlbWriterResult {
  readonly bytes: Uint8Array<ArrayBuffer>;
  readonly jsonByteLength: number;
  readonly binaryByteLength: number;
  readonly meshMetadata: readonly {
    readonly vertexCount: number;
    readonly triangleCount: number;
  }[];
}

const GLB_FILE_NAME = "partbench-visualization.glb";
const GLB_MIME_TYPE = "model/gltf-binary";
const GLB_MAGIC = 0x46546c67;
const GLB_VERSION = 2;
const GLB_JSON_CHUNK_TYPE = 0x4e4f534a;
const GLB_BINARY_CHUNK_TYPE = 0x004e4942;
const GLTF_ARRAY_BUFFER = 34962;
const GLTF_ELEMENT_ARRAY_BUFFER = 34963;
const GLTF_UNSIGNED_INT = 5125;
const GLTF_FLOAT = 5126;
const GLTF_TRIANGLES = 4;

export function createVisualizationMeshExportStatus(
  input: VisualizationMeshExportInput
): VisualizationMeshExportStatus {
  return createVisualizationMeshExportPlan(input).status;
}

export function createVisualizationMeshExportArtifact(
  input: VisualizationMeshExportInput
): VisualizationMeshExportResult {
  const plan = createVisualizationMeshExportPlan(input);

  if (!plan.status.available) {
    return {
      ok: false,
      status: plan.status,
      diagnostics: plan.status.diagnostics
    };
  }

  try {
    const glb = createGlbFromRenderMeshes(
      plan.bodies.map((body, index) => ({
        label: body.bodyName ?? `Body ${index + 1}`,
        mesh: body.mesh
      }))
    );
    const bodySummaries = plan.bodies.map((body, index) => ({
      bodyId: body.bodyId,
      ...(body.bodyName ? { bodyName: body.bodyName } : {}),
      vertexCount: glb.meshMetadata[index].vertexCount,
      triangleCount: glb.meshMetadata[index].triangleCount
    }));

    return {
      ok: true,
      status: plan.status,
      artifact: {
        fileName: plan.status.fileName,
        mimeType: plan.status.mimeType,
        bytes: glb.bytes,
        metadata: {
          format: "glb",
          exportKind: "visualization",
          authoritative: false,
          units: plan.status.units,
          bodyCount: plan.bodies.length,
          vertexCount: plan.status.vertexCount,
          triangleCount: plan.status.triangleCount,
          byteLength: glb.bytes.byteLength,
          jsonByteLength: glb.jsonByteLength,
          binaryByteLength: glb.binaryByteLength,
          bodySummaries
        }
      }
    };
  } catch (error) {
    const diagnostic = createExportDiagnostic({
      code: "VISUALIZATION_EXPORT_WRITER_FAILED",
      status: "unavailable",
      message:
        error instanceof Error
          ? `GLB visualization writer failed: ${error.message}`
          : "GLB visualization writer failed.",
      expected: "valid display geometry",
      received: "writer failure"
    });

    return {
      ok: false,
      status: {
        ...plan.status,
        status: "unavailable",
        available: false,
        limitation: diagnostic.message,
        nextStep: "Fix the listed visualization export diagnostic.",
        diagnostics: [...plan.status.diagnostics, diagnostic]
      },
      diagnostics: [...plan.status.diagnostics, diagnostic]
    };
  }
}

export function createGlbFromRenderMeshes(
  meshes: readonly GlbMeshInput[]
): GlbWriterResult {
  if (meshes.length === 0) {
    throw new Error("At least one mesh is required.");
  }

  const bufferViews: unknown[] = [];
  const accessors: unknown[] = [];
  const gltfMeshes: unknown[] = [];
  const nodes: unknown[] = [];
  const binaryParts: Uint8Array[] = [];
  const meshMetadata: { vertexCount: number; triangleCount: number }[] = [];
  let byteOffset = 0;

  meshes.forEach((input, meshIndex) => {
    const prepared = prepareMeshForGlb(input.mesh);
    const positionBytes = float32ArrayToBytes(prepared.positions);
    const indexBytes = uint32ArrayToBytes(prepared.indices);
    const positionViewIndex = bufferViews.length;

    bufferViews.push({
      buffer: 0,
      byteOffset,
      byteLength: positionBytes.byteLength,
      target: GLTF_ARRAY_BUFFER
    });
    binaryParts.push(positionBytes);
    byteOffset += positionBytes.byteLength;

    const indexViewIndex = bufferViews.length;
    bufferViews.push({
      buffer: 0,
      byteOffset,
      byteLength: indexBytes.byteLength,
      target: GLTF_ELEMENT_ARRAY_BUFFER
    });
    binaryParts.push(indexBytes);
    byteOffset += indexBytes.byteLength;

    const positionAccessorIndex = accessors.length;
    accessors.push({
      bufferView: positionViewIndex,
      byteOffset: 0,
      componentType: GLTF_FLOAT,
      count: prepared.vertexCount,
      type: "VEC3",
      min: prepared.bounds.min,
      max: prepared.bounds.max
    });

    const indexAccessorIndex = accessors.length;
    accessors.push({
      bufferView: indexViewIndex,
      byteOffset: 0,
      componentType: GLTF_UNSIGNED_INT,
      count: prepared.indices.length,
      type: "SCALAR",
      min: [prepared.minIndex],
      max: [prepared.maxIndex]
    });

    gltfMeshes.push({
      primitives: [
        {
          attributes: { POSITION: positionAccessorIndex },
          indices: indexAccessorIndex,
          material: 0,
          mode: GLTF_TRIANGLES
        }
      ]
    });
    nodes.push({ mesh: meshIndex, name: input.label });
    meshMetadata.push({
      vertexCount: prepared.vertexCount,
      triangleCount: prepared.triangleCount
    });
  });

  const binaryChunk = concatBytes(binaryParts);
  const gltf = {
    asset: {
      version: "2.0",
      generator: "Partbench visualization GLB export"
    },
    scene: 0,
    scenes: [{ nodes: nodes.map((_, index) => index) }],
    nodes,
    meshes: gltfMeshes,
    materials: [
      {
        name: "Partbench display material",
        pbrMetallicRoughness: {
          baseColorFactor: [0.72, 0.78, 0.86, 1],
          metallicFactor: 0,
          roughnessFactor: 0.82
        }
      }
    ],
    accessors,
    bufferViews,
    buffers: [{ byteLength: binaryChunk.byteLength }],
    extras: {
      partbench: {
        exportKind: "visualization",
        authoritative: false
      }
    }
  };
  const jsonChunk = encodeJsonChunk(gltf);
  const totalLength =
    12 + 8 + jsonChunk.byteLength + 8 + binaryChunk.byteLength;
  const bytes = new Uint8Array(totalLength);
  const view = new DataView(bytes.buffer);
  let offset = 0;

  view.setUint32(offset, GLB_MAGIC, true);
  offset += 4;
  view.setUint32(offset, GLB_VERSION, true);
  offset += 4;
  view.setUint32(offset, totalLength, true);
  offset += 4;
  view.setUint32(offset, jsonChunk.byteLength, true);
  offset += 4;
  view.setUint32(offset, GLB_JSON_CHUNK_TYPE, true);
  offset += 4;
  bytes.set(jsonChunk, offset);
  offset += jsonChunk.byteLength;
  view.setUint32(offset, binaryChunk.byteLength, true);
  offset += 4;
  view.setUint32(offset, GLB_BINARY_CHUNK_TYPE, true);
  offset += 4;
  bytes.set(binaryChunk, offset);

  return {
    bytes,
    jsonByteLength: jsonChunk.byteLength,
    binaryByteLength: binaryChunk.byteLength,
    meshMetadata
  };
}

function createVisualizationMeshExportPlan(
  input: VisualizationMeshExportInput
): VisualizationMeshExportPlan {
  const sourceById = new Map(
    input.derivedGeometrySources.map((source) => [source.id, source])
  );
  const entryBySourceId = new Map(
    input.derivedGeometry.entries.map((entry) => [
      entry.sourceId ?? entry.objectId,
      entry
    ])
  );
  const exportableBodies: VisualizationMeshExportBody[] = [];
  const diagnostics: VisualizationMeshExportDiagnostic[] = [];

  if (input.exportReadiness.bodyCount === 0) {
    diagnostics.push(
      createExportDiagnostic({
        code: "VISUALIZATION_EXPORT_PROJECT_EMPTY",
        status: "unavailable",
        message: "Project has no candidate bodies for visualization export.",
        expected: "at least one active authored body",
        received: "empty project"
      })
    );
  }

  for (const body of input.exportReadiness.bodies) {
    const source = sourceById.get(body.bodyId);
    const entry = entryBySourceId.get(body.bodyId);

    if (body.sourceStatus === "unavailable") {
      diagnostics.push(createSourceUnsupportedDiagnostic(body));
      continue;
    }

    if (!source) {
      diagnostics.push(
        createExportDiagnostic({
          code: "VISUALIZATION_EXPORT_MESH_MISSING",
          status: "unavailable",
          message: `Body ${body.bodyId} does not have a current derived visualization source.`,
          bodyId: body.bodyId,
          bodyName: body.bodyName,
          expected: "current derived visualization source",
          received: "missing source"
        })
      );
      continue;
    }

    if (!isSupportedVisualizationSource(source)) {
      diagnostics.push(createSourceUnsupportedDiagnostic(body, source.kind));
      continue;
    }

    if (!entry) {
      diagnostics.push(
        createExportDiagnostic({
          code: "VISUALIZATION_EXPORT_MESH_MISSING",
          status: "deferred",
          message: `Body ${body.bodyId} does not have ready display geometry yet.`,
          bodyId: body.bodyId,
          bodyName: body.bodyName,
          expected: "ready display geometry",
          received: "missing display geometry"
        })
      );
      continue;
    }

    if (entry.cacheKey !== createDerivedGeometryCacheKey(source)) {
      diagnostics.push(
        createExportDiagnostic({
          code: "VISUALIZATION_EXPORT_MESH_STALE",
          status: "deferred",
          message: `Body ${body.bodyId} has outdated display geometry.`,
          bodyId: body.bodyId,
          bodyName: body.bodyName,
          expected: "current display geometry",
          received: "stale display geometry"
        })
      );
      continue;
    }

    if (entry.status !== "ready") {
      diagnostics.push(
        createEntryDiagnostic(body.bodyId, body.bodyName, entry)
      );
      continue;
    }

    const invalidMessage = getInvalidMeshMessage(entry.mesh);

    if (invalidMessage) {
      diagnostics.push(
        createExportDiagnostic({
          code: "VISUALIZATION_EXPORT_MESH_INVALID",
          status: "unavailable",
          message: `Body ${body.bodyId} has invalid display geometry: ${invalidMessage}`,
          bodyId: body.bodyId,
          bodyName: body.bodyName,
          expected: "finite vertices and triangle indices",
          received: "invalid display geometry"
        })
      );
      continue;
    }

    exportableBodies.push({
      bodyId: body.bodyId,
      ...(body.bodyName ? { bodyName: body.bodyName } : {}),
      mesh: entry.mesh
    });
  }

  const vertexCount = exportableBodies.reduce(
    (total, body) => total + body.mesh.vertices.length,
    0
  );
  const triangleCount = exportableBodies.reduce(
    (total, body) => total + body.mesh.indices.length / 3,
    0
  );
  const status = chooseVisualizationStatus(
    diagnostics,
    exportableBodies.length
  );
  const available = exportableBodies.length > 0;
  const limitation =
    diagnostics[0]?.message ??
    "Ready display geometry can be written as a transient GLB artifact.";

  return {
    bodies: exportableBodies,
    status: {
      format: "glb",
      label: "Visualization GLB",
      status,
      available,
      fileName: GLB_FILE_NAME,
      mimeType: GLB_MIME_TYPE,
      units: input.exportReadiness.units,
      detail: available
        ? "GLB visualization export is available for ready display geometry."
        : "GLB visualization export needs at least one body with ready display geometry.",
      limitation,
      nextStep: available
        ? diagnostics.length > 0
          ? "Download available visualization bodies or resolve skipped diagnostics before sharing."
          : "Download the GLB visualization artifact from the Project panel."
        : getUnavailableNextStep(diagnostics),
      candidateBodyCount: input.exportReadiness.bodyCount,
      exportableBodyCount: exportableBodies.length,
      skippedBodyCount:
        input.exportReadiness.bodyCount - exportableBodies.length,
      vertexCount,
      triangleCount,
      diagnostics
    }
  };
}

function createEntryDiagnostic(
  bodyId: string,
  bodyName: string | undefined,
  entry: DerivedGeometryEntry
): VisualizationMeshExportDiagnostic {
  switch (entry.status) {
    case "pending":
      return createExportDiagnostic({
        code: "VISUALIZATION_EXPORT_MESH_PENDING",
        status: "deferred",
        message: `Body ${bodyId} is still building display geometry.`,
        bodyId,
        bodyName,
        expected: "ready display geometry",
        received: "pending display geometry"
      });
    case "error":
      return createExportDiagnostic({
        code: "VISUALIZATION_EXPORT_MESH_FAILED",
        status: "unavailable",
        message: `Body ${bodyId} failed to build display geometry.`,
        bodyId,
        bodyName,
        expected: "ready display geometry",
        received: "failed display geometry"
      });
    case "unsupported":
      return createExportDiagnostic({
        code: "VISUALIZATION_EXPORT_MESH_UNSUPPORTED",
        status: "unavailable",
        message: `Body ${bodyId} is not supported by the current visualization export path.`,
        bodyId,
        bodyName,
        expected: "supported visualization source",
        received: "unsupported visualization source"
      });
    case "ready":
      return createExportDiagnostic({
        code: "VISUALIZATION_EXPORT_MESH_INVALID",
        status: "unavailable",
        message: `Body ${bodyId} has invalid display geometry.`,
        bodyId,
        bodyName,
        expected: "valid display geometry",
        received: "invalid display geometry"
      });
  }
}

function chooseVisualizationStatus(
  diagnostics: readonly VisualizationMeshExportDiagnostic[],
  exportableBodyCount: number
): CadExportReadinessStatus {
  if (exportableBodyCount > 0) {
    return "supported";
  }

  return diagnostics.some((diagnostic) => diagnostic.status === "deferred")
    ? "deferred"
    : "unavailable";
}

function getUnavailableNextStep(
  diagnostics: readonly VisualizationMeshExportDiagnostic[]
): string {
  if (
    diagnostics.some(
      (diagnostic) => diagnostic.code === "VISUALIZATION_EXPORT_MESH_PENDING"
    )
  ) {
    return "Wait for display geometry to finish building.";
  }

  if (
    diagnostics.some(
      (diagnostic) =>
        diagnostic.code === "VISUALIZATION_EXPORT_MESH_MISSING" ||
        diagnostic.code === "VISUALIZATION_EXPORT_MESH_STALE"
    )
  ) {
    return "Refresh display geometry before exporting.";
  }

  return "Use an active supported body with ready display geometry.";
}

function isSupportedVisualizationSource(
  source: DerivedGeometrySource
): boolean {
  return (
    source.kind === "extrude" ||
    source.kind === "extrudeBoolean" ||
    source.kind === "revolve" ||
    source.kind === "hole" ||
    source.kind === "edgeFinish" ||
    source.kind === "linearPattern" ||
    source.kind === "circularPattern" ||
    source.kind === "mirror" ||
    source.kind === "shell"
  );
}

function createSourceUnsupportedDiagnostic(
  body: ProjectExportReadinessQueryResponse["bodies"][number],
  received: string = body.sourceKind
): VisualizationMeshExportDiagnostic {
  return createExportDiagnostic({
    code: "VISUALIZATION_EXPORT_SOURCE_UNSUPPORTED",
    status: "unavailable",
    message:
      body.diagnostics.find((diagnostic) => diagnostic.status !== "supported")
        ?.message ??
      `Body ${body.bodyId} is not supported for visualization export.`,
    bodyId: body.bodyId,
    bodyName: body.bodyName,
    expected: "active body with supported derived visualization source",
    received
  });
}

function createExportDiagnostic({
  code,
  status,
  message,
  bodyId,
  bodyName,
  expected,
  received
}: Omit<
  VisualizationMeshExportDiagnostic,
  "format"
>): VisualizationMeshExportDiagnostic {
  return {
    code,
    status,
    message,
    format: "glb",
    ...(bodyId ? { bodyId } : {}),
    ...(bodyName ? { bodyName } : {}),
    ...(expected ? { expected } : {}),
    ...(received ? { received } : {})
  };
}

function prepareMeshForGlb(mesh: RenderTriangleMesh) {
  const invalidMessage = getInvalidMeshMessage(mesh);

  if (invalidMessage) {
    throw new Error(invalidMessage);
  }

  const positions = new Float32Array(mesh.vertices.length * 3);

  mesh.vertices.forEach((vertex, index) => {
    const transformed = transformPoint(vertex, mesh.transform);
    positions[index * 3] = transformed[0];
    positions[index * 3 + 1] = transformed[1];
    positions[index * 3 + 2] = transformed[2];
  });

  const indices = Uint32Array.from(mesh.indices);
  const bounds = getBounds(positions);

  return {
    positions,
    indices,
    bounds,
    vertexCount: mesh.vertices.length,
    triangleCount: mesh.indices.length / 3,
    minIndex: Math.min(...mesh.indices),
    maxIndex: Math.max(...mesh.indices)
  };
}

function getInvalidMeshMessage(mesh: RenderTriangleMesh): string | undefined {
  if (mesh.vertices.length === 0) {
    return "mesh has no vertices";
  }

  if (mesh.indices.length === 0 || mesh.indices.length % 3 !== 0) {
    return "mesh indices must describe complete triangles";
  }

  for (const vertex of mesh.vertices) {
    if (vertex.length !== 3 || !vertex.every(Number.isFinite)) {
      return "mesh vertices must contain finite 3D points";
    }
  }

  for (const value of [
    ...mesh.transform.translation,
    ...mesh.transform.rotation,
    ...mesh.transform.scale
  ]) {
    if (!Number.isFinite(value)) {
      return "mesh transform must contain finite values";
    }
  }

  for (const index of mesh.indices) {
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= mesh.vertices.length
    ) {
      return "mesh indices must reference existing vertices";
    }
  }

  return undefined;
}

function getBounds(positions: Float32Array): {
  readonly min: Vec3;
  readonly max: Vec3;
} {
  const min: [number, number, number] = [
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY
  ];
  const max: [number, number, number] = [
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY
  ];

  for (let index = 0; index < positions.length; index += 3) {
    min[0] = Math.min(min[0], positions[index]);
    min[1] = Math.min(min[1], positions[index + 1]);
    min[2] = Math.min(min[2], positions[index + 2]);
    max[0] = Math.max(max[0], positions[index]);
    max[1] = Math.max(max[1], positions[index + 1]);
    max[2] = Math.max(max[2], positions[index + 2]);
  }

  return { min, max };
}

function transformPoint(point: Vec3, transform: RenderTransform): Vec3 {
  const scaled: Vec3 = [
    point[0] * transform.scale[0],
    point[1] * transform.scale[1],
    point[2] * transform.scale[2]
  ];
  const rotated = rotateEuler(scaled, transform.rotation);

  return [
    rotated[0] + transform.translation[0],
    rotated[1] + transform.translation[1],
    rotated[2] + transform.translation[2]
  ];
}

function rotateEuler(point: Vec3, rotation: Vec3): Vec3 {
  const [rx, ry, rz] = rotation;
  const cosX = Math.cos(rx);
  const sinX = Math.sin(rx);
  const cosY = Math.cos(ry);
  const sinY = Math.sin(ry);
  const cosZ = Math.cos(rz);
  const sinZ = Math.sin(rz);
  const y1 = point[1] * cosX - point[2] * sinX;
  const z1 = point[1] * sinX + point[2] * cosX;
  const x2 = point[0] * cosY + z1 * sinY;
  const z2 = -point[0] * sinY + z1 * cosY;
  const x3 = x2 * cosZ - y1 * sinZ;
  const y3 = x2 * sinZ + y1 * cosZ;

  return [x3, y3, z2];
}

function float32ArrayToBytes(values: Float32Array): Uint8Array {
  return new Uint8Array(values.buffer, values.byteOffset, values.byteLength);
}

function uint32ArrayToBytes(values: Uint32Array): Uint8Array {
  return new Uint8Array(values.buffer, values.byteOffset, values.byteLength);
}

function encodeJsonChunk(value: unknown): Uint8Array {
  const encoded = new TextEncoder().encode(JSON.stringify(value));
  const padded = new Uint8Array(padToFourByteBoundary(encoded.byteLength));

  padded.set(encoded);
  padded.fill(0x20, encoded.byteLength);

  return padded;
}

function concatBytes(parts: readonly Uint8Array[]): Uint8Array {
  const totalLength = parts.reduce((total, part) => total + part.byteLength, 0);
  const bytes = new Uint8Array(padToFourByteBoundary(totalLength));
  let offset = 0;

  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.byteLength;
  }

  return bytes;
}

function padToFourByteBoundary(byteLength: number): number {
  return Math.ceil(byteLength / 4) * 4;
}
