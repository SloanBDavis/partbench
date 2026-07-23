import type {
  GeometryKernelGeneratedReferences,
  SerializableMeshData
} from "@web-cad/geometry-kernel";
import type { GeometryWorkerResponse } from "@web-cad/geometry-worker";
import type {
  RenderTransform,
  RenderTriangleMesh,
  Vec3
} from "@web-cad/renderer";

export type RendererMeshBridgeVersion = "renderer-mesh-bridge.v1";

export interface MeshRendererBridgeOptions {
  readonly id: string;
  readonly alignment?: "source" | "boundsCenter";
  readonly transform?: RenderTransform;
  readonly source?: string;
  readonly label?: string;
}

export interface MeshBounds {
  readonly min: Vec3;
  readonly max: Vec3;
}

export interface MeshRendererBridgeResult {
  readonly version: RendererMeshBridgeVersion;
  readonly mesh: RenderTriangleMesh;
  readonly bounds: MeshBounds;
  readonly vertexCount: number;
  readonly triangleCount: number;
  readonly generatedReferences?: GeometryKernelGeneratedReferences;
}

export function createRenderMeshFromSerializableMesh(
  mesh: SerializableMeshData,
  options: MeshRendererBridgeOptions
): MeshRendererBridgeResult {
  validateMesh(mesh);

  const sourceVertices = toVertices(mesh.positions);
  const vertices =
    options.alignment === "boundsCenter"
      ? centerVertices(sourceVertices)
      : sourceVertices;
  const indices = [...mesh.indices];

  return {
    version: "renderer-mesh-bridge.v1",
    mesh: {
      id: options.id,
      kind: "mesh",
      vertices,
      indices,
      transform: options.transform ?? createIdentityTransform(),
      ...(options.source !== undefined ? { source: options.source } : {}),
      ...(options.label !== undefined ? { label: options.label } : {})
    },
    bounds: getBounds(vertices),
    vertexCount: mesh.vertexCount,
    triangleCount: mesh.triangleCount,
    ...(mesh.generatedReferences
      ? { generatedReferences: mesh.generatedReferences }
      : {})
  };
}

export function createRenderMeshFromGeometryWorkerResponse(
  response: GeometryWorkerResponse,
  options: MeshRendererBridgeOptions
): MeshRendererBridgeResult {
  if (!response.response.ok) {
    throw new Error(response.response.error.message);
  }

  if (!("mesh" in response.response)) {
    throw new Error("Geometry worker response does not contain mesh data.");
  }

  return createRenderMeshFromSerializableMesh(response.response.mesh, {
    ...options,
    source: options.source ?? response.kind
  });
}

function validateMesh(mesh: SerializableMeshData): void {
  if (
    mesh.primitive !== "box" &&
    mesh.primitive !== "cylinder" &&
    mesh.primitive !== "sphere" &&
    mesh.primitive !== "cone" &&
    mesh.primitive !== "torus" &&
    mesh.primitive !== "extrude" &&
    mesh.primitive !== "revolve" &&
    mesh.primitive !== "boolean" &&
    mesh.primitive !== "hole" &&
    mesh.primitive !== "edgeFinish"
  ) {
    throw new Error(`Unsupported mesh primitive: ${mesh.primitive}`);
  }

  if (!Number.isInteger(mesh.vertexCount) || mesh.vertexCount < 0) {
    throw new Error("Mesh vertex count must be a non-negative integer.");
  }

  if (!Number.isInteger(mesh.triangleCount) || mesh.triangleCount < 0) {
    throw new Error("Mesh triangle count must be a non-negative integer.");
  }

  if (!Number.isInteger(mesh.faceCount) || mesh.faceCount < 0) {
    throw new Error("Mesh face count must be a non-negative integer.");
  }

  if (mesh.positions.length !== mesh.vertexCount * 3) {
    throw new Error("Mesh positions length does not match vertex count.");
  }

  if (mesh.indices.length !== mesh.triangleCount * 3) {
    throw new Error("Mesh indices length does not match triangle count.");
  }

  for (const value of mesh.positions) {
    if (!Number.isFinite(value)) {
      throw new Error("Mesh positions must contain only finite numbers.");
    }
  }

  for (const index of mesh.indices) {
    if (!Number.isInteger(index) || index < 0 || index >= mesh.vertexCount) {
      throw new Error("Mesh indices must reference existing vertices.");
    }
  }
}

function toVertices(positions: Float32Array): Vec3[] {
  const vertices: Vec3[] = [];

  for (let index = 0; index < positions.length; index += 3) {
    const x = positions[index];
    const y = positions[index + 1];
    const z = positions[index + 2];
    if (x === undefined || y === undefined || z === undefined) {
      throw new Error("Mesh positions ended before a complete vertex.");
    }
    vertices.push([x, y, z]);
  }

  return vertices;
}

function getBounds(vertices: readonly Vec3[]): MeshBounds {
  if (vertices.length === 0) {
    return {
      min: [0, 0, 0],
      max: [0, 0, 0]
    };
  }

  const xs = vertices.map((vertex) => vertex[0]);
  const ys = vertices.map((vertex) => vertex[1]);
  const zs = vertices.map((vertex) => vertex[2]);

  return {
    min: [Math.min(...xs), Math.min(...ys), Math.min(...zs)],
    max: [Math.max(...xs), Math.max(...ys), Math.max(...zs)]
  };
}

function centerVertices(vertices: readonly Vec3[]): Vec3[] {
  const bounds = getBounds(vertices);
  const center: Vec3 = [
    (bounds.min[0] + bounds.max[0]) / 2,
    (bounds.min[1] + bounds.max[1]) / 2,
    (bounds.min[2] + bounds.max[2]) / 2
  ];

  return vertices.map((vertex) => [
    vertex[0] - center[0],
    vertex[1] - center[1],
    vertex[2] - center[2]
  ]);
}

function createIdentityTransform(): RenderTransform {
  return {
    translation: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1]
  };
}
