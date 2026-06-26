import type {
  DocumentUnits,
  WcadDocumentSchemaVersion,
  WcadSourceIdentity
} from "@web-cad/cad-protocol";
import type {
  RenderEdgeSegment,
  RenderTransform,
  RenderTriangleMesh,
  Vec3
} from "@web-cad/renderer";
import type {
  DerivedGeometryResult,
  DerivedGeometryMetrics
} from "./derivedGeometryRuntime";
import type { DerivedGeometryMeshCache } from "./derivedGeometry";
import {
  createProjectOpfsCacheDiagnostic,
  createProjectOpfsCacheIndex,
  createProjectOpfsCacheKey,
  createProjectOpfsCacheSha256Hex,
  getProjectOpfsCacheRoot,
  readProjectOpfsCacheStatus,
  validateProjectOpfsCacheIndex,
  writeAndCloseProjectOpfsWritable,
  type ProjectOpfsCacheDiagnostic,
  type ProjectOpfsCacheDirectoryHandleLike,
  type ProjectOpfsCacheIndex,
  type ProjectOpfsCacheIndexEntry,
  type ProjectOpfsCacheStatus,
  type ProjectOpfsCacheTargetLike
} from "./projectOpfsCache";

export const DERIVED_MESH_CACHE_ARTIFACT_VERSION = "partbench-derived-mesh.v1";
export const DERIVED_MESH_CACHE_KERNEL_VERSION = "partbench-occt-display.v1";
export const DERIVED_MESH_CACHE_WORKER_VERSION = "geometry-worker.v1";
export const DERIVED_MESH_CACHE_SETTINGS_KEY = "display-tessellation.v1";

export interface DerivedMeshCacheContext {
  readonly sourceIdentity: WcadSourceIdentity;
  readonly documentSchemaVersion: WcadDocumentSchemaVersion;
  readonly units: DocumentUnits;
}

export interface DerivedMeshOpfsCacheOptions {
  readonly target: ProjectOpfsCacheTargetLike;
  readonly getContext: () => DerivedMeshCacheContext | undefined;
  readonly onStatus?: (status: ProjectOpfsCacheStatus) => void;
}

export interface DerivedMeshCacheKeyInput extends DerivedMeshCacheContext {
  readonly sourceKey: string;
}

export interface DerivedMeshCacheArtifactV1 {
  readonly version: typeof DERIVED_MESH_CACHE_ARTIFACT_VERSION;
  readonly artifactKind: "derivedMesh";
  readonly artifactVersion: typeof DERIVED_MESH_CACHE_ARTIFACT_VERSION;
  readonly cacheKey: string;
  readonly sourceKey: string;
  readonly sourceIdentity: WcadSourceIdentity;
  readonly documentSchemaVersion: WcadDocumentSchemaVersion;
  readonly units: DocumentUnits;
  readonly mesh: RenderTriangleMesh;
  readonly metrics: DerivedGeometryMetrics;
  readonly message: string;
  readonly writtenAt: string;
}

export type DerivedMeshCacheReadResult =
  | {
      readonly ok: true;
      readonly result: DerivedGeometryResult;
      readonly entry: ProjectOpfsCacheIndexEntry;
      readonly diagnostics: readonly ProjectOpfsCacheDiagnostic[];
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly ProjectOpfsCacheDiagnostic[];
    };

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;

export function createDerivedMeshCacheKey(
  input: DerivedMeshCacheKeyInput
): string {
  return createProjectOpfsCacheKey({
    sourceIdentity: input.sourceIdentity,
    artifactKind: "derivedMesh",
    artifactVersion: DERIVED_MESH_CACHE_ARTIFACT_VERSION,
    artifactSourceKey: input.sourceKey,
    documentSchemaVersion: input.documentSchemaVersion,
    units: input.units,
    kernelVersion: DERIVED_MESH_CACHE_KERNEL_VERSION,
    workerVersion: DERIVED_MESH_CACHE_WORKER_VERSION,
    settingsKey: DERIVED_MESH_CACHE_SETTINGS_KEY
  });
}

export function createDerivedMeshOpfsCache(
  options: DerivedMeshOpfsCacheOptions
): DerivedGeometryMeshCache {
  return {
    read: async (input) => {
      const context = options.getContext();

      if (!context) {
        return undefined;
      }

      const read = await readDerivedMeshOpfsCache({
        target: options.target,
        context,
        sourceKey: input.sourceKey
      });
      await updateStatus(options, context);

      return read.ok ? read.result : undefined;
    },
    write: async (input) => {
      const context = options.getContext();

      if (!context) {
        return;
      }

      await writeDerivedMeshOpfsCache({
        target: options.target,
        context,
        sourceKey: input.sourceKey,
        result: input.result
      });
      await updateStatus(options, context);
    }
  };
}

export function encodeDerivedMeshCacheArtifact(
  artifact: DerivedMeshCacheArtifactV1
): Uint8Array {
  return textEncoder.encode(`${JSON.stringify(artifact)}\n`);
}

export function decodeDerivedMeshCacheArtifact(
  bytes: Uint8Array
): DerivedMeshCacheArtifactV1 {
  const value = JSON.parse(textDecoder.decode(bytes)) as unknown;

  if (!isDerivedMeshCacheArtifact(value)) {
    throw new Error("Derived mesh cache artifact has invalid metadata.");
  }

  return value;
}

export async function readDerivedMeshOpfsCache(input: {
  readonly target: ProjectOpfsCacheTargetLike;
  readonly context: DerivedMeshCacheContext;
  readonly sourceKey: string;
}): Promise<DerivedMeshCacheReadResult> {
  const cacheKey = createDerivedMeshCacheKey({
    ...input.context,
    sourceKey: input.sourceKey
  });
  const rootResult = await getProjectOpfsCacheRoot(input.target);

  if (!rootResult.ok) {
    return { ok: false, diagnostics: [rootResult.diagnostic] };
  }

  const indexRead = await readIndex(rootResult.root, input.context);
  const entry = indexRead.index.entries.find(
    (candidate) => candidate.cacheKey === cacheKey
  );

  if (!entry) {
    return {
      ok: false,
      diagnostics: [
        ...indexRead.diagnostics,
        createMissingEntryDiagnostic(indexRead.index, input)
      ]
    };
  }

  if (entry.status !== "valid") {
    return {
      ok: false,
      diagnostics: [
        ...indexRead.diagnostics,
        createProjectOpfsCacheDiagnostic(
          entry.status === "stale"
            ? "OPFS_STALE_SOURCE_IDENTITY"
            : entry.status === "unsupported"
              ? "OPFS_UNSUPPORTED_ARTIFACT_VERSION"
              : "OPFS_ARTIFACT_INVALID",
          entry.status === "corrupt" ? "error" : "warning",
          undefined,
          entry.cacheKey,
          "derivedMesh"
        )
      ]
    };
  }

  if (entry.artifactVersion !== DERIVED_MESH_CACHE_ARTIFACT_VERSION) {
    return {
      ok: false,
      diagnostics: [
        createProjectOpfsCacheDiagnostic(
          "OPFS_UNSUPPORTED_ARTIFACT_VERSION",
          "warning",
          undefined,
          entry.cacheKey,
          "derivedMesh"
        )
      ]
    };
  }

  try {
    const bytes = await readArtifactBytes(rootResult.root, entry.cacheKey);
    const actualHash = await createProjectOpfsCacheSha256Hex(bytes);

    if (bytes.byteLength !== entry.byteLength) {
      await markEntryStatus(rootResult.root, indexRead.index, entry, "corrupt");
      return {
        ok: false,
        diagnostics: [
          createProjectOpfsCacheDiagnostic(
            "OPFS_BYTE_LENGTH_MISMATCH",
            "error",
            undefined,
            entry.cacheKey,
            "derivedMesh"
          )
        ]
      };
    }

    if (actualHash !== entry.sha256) {
      await markEntryStatus(rootResult.root, indexRead.index, entry, "corrupt");
      return {
        ok: false,
        diagnostics: [
          createProjectOpfsCacheDiagnostic(
            "OPFS_HASH_MISMATCH",
            "error",
            undefined,
            entry.cacheKey,
            "derivedMesh"
          )
        ]
      };
    }

    const artifact = decodeDerivedMeshCacheArtifact(bytes);

    if (
      artifact.cacheKey !== entry.cacheKey ||
      artifact.sourceKey !== input.sourceKey ||
      artifact.sourceIdentity.algorithm !==
        input.context.sourceIdentity.algorithm ||
      artifact.sourceIdentity.sha256 !== input.context.sourceIdentity.sha256
    ) {
      await markEntryStatus(rootResult.root, indexRead.index, entry, "corrupt");
      return {
        ok: false,
        diagnostics: [
          createProjectOpfsCacheDiagnostic(
            "OPFS_ARTIFACT_INVALID",
            "error",
            undefined,
            entry.cacheKey,
            "derivedMesh"
          )
        ]
      };
    }

    return {
      ok: true,
      entry,
      diagnostics: indexRead.diagnostics,
      result: {
        mesh: artifact.mesh,
        metrics: artifact.metrics,
        message: "Loaded display geometry from the local cache."
      }
    };
  } catch (error) {
    await markEntryStatus(rootResult.root, indexRead.index, entry, "corrupt");
    return {
      ok: false,
      diagnostics: [
        createProjectOpfsCacheDiagnostic(
          isNotFoundError(error)
            ? "OPFS_ARTIFACT_MISSING"
            : "OPFS_ARTIFACT_READ_FAILED",
          isNotFoundError(error) ? "warning" : "error",
          error instanceof Error ? error.message : undefined,
          entry.cacheKey,
          "derivedMesh"
        )
      ]
    };
  }
}

export async function writeDerivedMeshOpfsCache(input: {
  readonly target: ProjectOpfsCacheTargetLike;
  readonly context: DerivedMeshCacheContext;
  readonly sourceKey: string;
  readonly result: DerivedGeometryResult;
  readonly now?: string;
}): Promise<readonly ProjectOpfsCacheDiagnostic[]> {
  const cacheKey = createDerivedMeshCacheKey({
    ...input.context,
    sourceKey: input.sourceKey
  });
  const rootResult = await getProjectOpfsCacheRoot(input.target);

  if (!rootResult.ok) {
    return [rootResult.diagnostic];
  }

  const writtenAt = input.now ?? new Date().toISOString();
  const artifact: DerivedMeshCacheArtifactV1 = {
    version: DERIVED_MESH_CACHE_ARTIFACT_VERSION,
    artifactKind: "derivedMesh",
    artifactVersion: DERIVED_MESH_CACHE_ARTIFACT_VERSION,
    cacheKey,
    sourceKey: input.sourceKey,
    sourceIdentity: input.context.sourceIdentity,
    documentSchemaVersion: input.context.documentSchemaVersion,
    units: input.context.units,
    mesh: input.result.mesh,
    metrics: input.result.metrics,
    message: input.result.message,
    writtenAt
  };
  const bytes = encodeDerivedMeshCacheArtifact(artifact);
  const sha256 = await createProjectOpfsCacheSha256Hex(bytes);
  const indexRead = await readIndex(rootResult.root, input.context);
  const existingEntry = indexRead.index.entries.find(
    (candidate) => candidate.cacheKey === cacheKey
  );
  const entry: ProjectOpfsCacheIndexEntry = {
    cacheKey,
    sourceIdentity: input.context.sourceIdentity,
    artifactKind: "derivedMesh",
    artifactVersion: DERIVED_MESH_CACHE_ARTIFACT_VERSION,
    artifactSourceKey: input.sourceKey,
    documentSchemaVersion: input.context.documentSchemaVersion,
    units: input.context.units,
    kernelVersion: DERIVED_MESH_CACHE_KERNEL_VERSION,
    workerVersion: DERIVED_MESH_CACHE_WORKER_VERSION,
    settingsKey: DERIVED_MESH_CACHE_SETTINGS_KEY,
    byteLength: bytes.byteLength,
    sha256,
    createdAt: existingEntry?.createdAt ?? writtenAt,
    updatedAt: writtenAt,
    status: "valid"
  };

  try {
    await writeArtifactBytes(rootResult.root, cacheKey, bytes);
    const nextEntries = [
      ...indexRead.index.entries.filter(
        (candidate) => candidate.cacheKey !== cacheKey
      ),
      entry
    ];
    await writeIndex(rootResult.root, createProjectOpfsCacheIndex(nextEntries));

    return indexRead.diagnostics;
  } catch (error) {
    return [
      createProjectOpfsCacheDiagnostic(
        "OPFS_ARTIFACT_WRITE_FAILED",
        "error",
        error instanceof Error ? error.message : undefined,
        cacheKey,
        "derivedMesh"
      )
    ];
  }
}

async function readIndex(
  root: ProjectOpfsCacheDirectoryHandleLike,
  context: DerivedMeshCacheContext
): Promise<{
  readonly index: ProjectOpfsCacheIndex;
  readonly diagnostics: readonly ProjectOpfsCacheDiagnostic[];
}> {
  try {
    const handle = await root.getFileHandle("cache-index.json");
    const text = await (await handle.getFile()).text();
    const parsed = JSON.parse(text) as unknown;
    const validation = validateProjectOpfsCacheIndex(parsed, {
      currentSourceIdentity: context.sourceIdentity,
      supportedArtifactVersions: [DERIVED_MESH_CACHE_ARTIFACT_VERSION]
    });

    return validation;
  } catch (error) {
    if (isNotFoundError(error)) {
      return {
        index: createProjectOpfsCacheIndex(),
        diagnostics: [
          createProjectOpfsCacheDiagnostic("OPFS_INDEX_MISSING", "info")
        ]
      };
    }

    return {
      index: createProjectOpfsCacheIndex(),
      diagnostics: [
        createProjectOpfsCacheDiagnostic(
          "OPFS_INDEX_INVALID",
          "error",
          error instanceof Error ? error.message : undefined
        )
      ]
    };
  }
}

async function writeIndex(
  root: ProjectOpfsCacheDirectoryHandleLike,
  index: ProjectOpfsCacheIndex
): Promise<void> {
  const handle = await root.getFileHandle("cache-index.json", { create: true });
  const writable = await handle.createWritable?.();

  if (!writable) {
    throw new Error("OPFS cache index handle cannot create a writable stream.");
  }

  await writeAndCloseProjectOpfsWritable(
    writable,
    `${JSON.stringify(index, null, 2)}\n`
  );
}

async function markEntryStatus(
  root: ProjectOpfsCacheDirectoryHandleLike,
  index: ProjectOpfsCacheIndex,
  entry: ProjectOpfsCacheIndexEntry,
  status: ProjectOpfsCacheIndexEntry["status"]
): Promise<void> {
  try {
    await writeIndex(
      root,
      createProjectOpfsCacheIndex(
        index.entries.map((candidate) =>
          candidate.cacheKey === entry.cacheKey
            ? {
                ...candidate,
                status,
                updatedAt: new Date().toISOString()
              }
            : candidate
        )
      )
    );
  } catch {
    // Corrupt-cache status is best-effort and must not block regeneration.
  }
}

async function readArtifactBytes(
  root: ProjectOpfsCacheDirectoryHandleLike,
  cacheKey: string
): Promise<Uint8Array> {
  const artifacts = await root.getDirectoryHandle("artifacts", {
    create: false
  });
  const handle = await artifacts.getFileHandle(
    await createArtifactFileName(cacheKey)
  );
  const file = await handle.getFile();
  const buffer = await file.arrayBuffer?.();

  if (!buffer) {
    throw new Error("OPFS artifact file cannot provide bytes.");
  }

  return new Uint8Array(buffer);
}

async function writeArtifactBytes(
  root: ProjectOpfsCacheDirectoryHandleLike,
  cacheKey: string,
  bytes: Uint8Array
): Promise<void> {
  const artifacts = await root.getDirectoryHandle("artifacts", {
    create: true
  });
  const handle = await artifacts.getFileHandle(
    await createArtifactFileName(cacheKey),
    { create: true }
  );
  const writable = await handle.createWritable?.();

  if (!writable) {
    throw new Error("OPFS artifact handle cannot create a writable stream.");
  }

  await writeAndCloseProjectOpfsWritable(writable, bytes);
}

async function createArtifactFileName(cacheKey: string): Promise<string> {
  const digest = await createProjectOpfsCacheSha256Hex(
    textEncoder.encode(cacheKey)
  );

  return `${digest}.derived-mesh.json`;
}

function createMissingEntryDiagnostic(
  index: ProjectOpfsCacheIndex,
  input: {
    readonly context: DerivedMeshCacheContext;
    readonly sourceKey: string;
  }
): ProjectOpfsCacheDiagnostic {
  const related = index.entries.find(
    (entry) =>
      entry.artifactKind === "derivedMesh" &&
      entry.artifactSourceKey === input.sourceKey
  );

  if (
    related &&
    (related.sourceIdentity.algorithm !==
      input.context.sourceIdentity.algorithm ||
      related.sourceIdentity.sha256 !== input.context.sourceIdentity.sha256)
  ) {
    return createProjectOpfsCacheDiagnostic(
      "OPFS_STALE_SOURCE_IDENTITY",
      "warning",
      undefined,
      related.cacheKey,
      "derivedMesh"
    );
  }

  if (
    related &&
    related.artifactVersion !== DERIVED_MESH_CACHE_ARTIFACT_VERSION
  ) {
    return createProjectOpfsCacheDiagnostic(
      "OPFS_UNSUPPORTED_ARTIFACT_VERSION",
      "warning",
      undefined,
      related.cacheKey,
      "derivedMesh"
    );
  }

  return createProjectOpfsCacheDiagnostic(
    "OPFS_ARTIFACT_MISSING",
    "info",
    undefined,
    undefined,
    "derivedMesh"
  );
}

async function updateStatus(
  options: DerivedMeshOpfsCacheOptions,
  context: DerivedMeshCacheContext
): Promise<void> {
  if (!options.onStatus) {
    return;
  }

  options.onStatus(
    await readProjectOpfsCacheStatus(options.target, {
      currentSourceIdentity: context.sourceIdentity,
      supportedArtifactVersions: [DERIVED_MESH_CACHE_ARTIFACT_VERSION]
    })
  );
}

function isDerivedMeshCacheArtifact(
  value: unknown
): value is DerivedMeshCacheArtifactV1 {
  return (
    isRecord(value) &&
    value.version === DERIVED_MESH_CACHE_ARTIFACT_VERSION &&
    value.artifactKind === "derivedMesh" &&
    value.artifactVersion === DERIVED_MESH_CACHE_ARTIFACT_VERSION &&
    typeof value.cacheKey === "string" &&
    typeof value.sourceKey === "string" &&
    isSourceIdentity(value.sourceIdentity) &&
    (value.documentSchemaVersion === "web-cad.project.v16" ||
      value.documentSchemaVersion === "web-cad.project.v17") &&
    (value.units === "mm" ||
      value.units === "cm" ||
      value.units === "m" ||
      value.units === "in") &&
    isRenderTriangleMesh(value.mesh) &&
    isDerivedGeometryMetrics(value.metrics) &&
    typeof value.message === "string" &&
    typeof value.writtenAt === "string"
  );
}

function isRenderTriangleMesh(value: unknown): value is RenderTriangleMesh {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    value.kind === "mesh" &&
    Array.isArray(value.vertices) &&
    value.vertices.every(isVec3) &&
    Array.isArray(value.indices) &&
    value.indices.every((index) => Number.isSafeInteger(index) && index >= 0) &&
    isRenderTransform(value.transform) &&
    (value.edgeSegments === undefined ||
      (Array.isArray(value.edgeSegments) &&
        value.edgeSegments.every(isRenderEdgeSegment))) &&
    (value.source === undefined || typeof value.source === "string") &&
    (value.label === undefined || typeof value.label === "string")
  );
}

function isRenderTransform(value: unknown): value is RenderTransform {
  return (
    isRecord(value) &&
    isVec3(value.translation) &&
    isVec3(value.rotation) &&
    isVec3(value.scale)
  );
}

function isRenderEdgeSegment(value: unknown): value is RenderEdgeSegment {
  return isRecord(value) && isVec3(value.start) && isVec3(value.end);
}

function isVec3(value: unknown): value is Vec3 {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((coordinate) => typeof coordinate === "number")
  );
}

function isDerivedGeometryMetrics(
  value: unknown
): value is DerivedGeometryMetrics {
  return (
    isRecord(value) &&
    typeof value.objectId === "string" &&
    typeof value.roundTripMs === "number" &&
    typeof value.vertexCount === "number" &&
    typeof value.triangleCount === "number"
  );
}

function isSourceIdentity(value: unknown): value is WcadSourceIdentity {
  return (
    isRecord(value) &&
    value.algorithm === "partbench-source-v1" &&
    typeof value.sha256 === "string" &&
    SHA256_HEX_PATTERN.test(value.sha256)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNotFoundError(error: unknown): boolean {
  return (
    typeof DOMException !== "undefined" &&
    error instanceof DOMException &&
    error.name === "NotFoundError"
  );
}
