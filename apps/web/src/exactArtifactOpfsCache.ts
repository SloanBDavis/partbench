import type {
  ExactBodyArtifactShapePolicy,
  GeometryKernelExactBodyArtifact
} from "@web-cad/geometry-worker/browser";
import {
  createProjectOpfsCacheSha256Hex,
  writeAndCloseProjectOpfsWritable,
  type ProjectOpfsCacheDirectoryHandleLike,
  type ProjectOpfsCacheTargetLike
} from "./projectOpfsCache";

export const EXACT_ARTIFACT_CACHE_NAMESPACE =
  "partbench-exact-artifact-v1" as const;
export const EXACT_ARTIFACT_CACHE_INDEX_VERSION =
  "partbench-exact-artifact-index.v1" as const;
export const EXACT_ARTIFACT_CACHE_ENTRY_VERSION =
  "partbench-exact-artifact-entry.v1" as const;
export const EXACT_ARTIFACT_CACHE_GEOMETRY_KERNEL_PROTOCOL =
  "geometry-kernel.v1" as const;
export const EXACT_ARTIFACT_CACHE_OCCT_BUILD_FINGERPRINT =
  "opencascade.js@2.0.0-beta.b5ff984" as const;
export const EXACT_ARTIFACT_CACHE_ARTIFACT_VERSION =
  "partbench.exact-body-artifact.v1" as const;
export const EXACT_ARTIFACT_CACHE_BREP_FORMAT = "occt-brep" as const;
export const EXACT_ARTIFACT_CACHE_BREP_WRITER = "BRepTools.Write_3" as const;
export const EXACT_ARTIFACT_CACHE_MAX_ENTRY_BYTES = 128 * 1024 * 1024;
export const EXACT_ARTIFACT_CACHE_MAX_TOTAL_BYTES = 512 * 1024 * 1024;
export const EXACT_ARTIFACT_CACHE_MAX_ENTRIES = 4_096;
export const EXACT_ARTIFACT_CACHE_MAX_INDEX_BYTES = 16 * 1024 * 1024;

const INDEX_FILE_NAME = "index.json";
const ARTIFACTS_DIRECTORY_NAME = "artifacts";
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;
type ExactTopologySourceKind = GeometryKernelExactBodyArtifact["sourceKind"];

const SOURCE_KINDS = new Set<ExactTopologySourceKind>([
  "box",
  "cylinder",
  "sphere",
  "cone",
  "torus",
  "extrude",
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
]);

export type ExactArtifactCacheIdentity = Pick<
  GeometryKernelExactBodyArtifact,
  | "bodyId"
  | "sourceType"
  | "documentSourceIdentity"
  | "bodySourceIdentitySignature"
  | "sourceCacheKeySha256"
  | "sourceGraphNodeCount"
  | "units"
  | "shapePolicy"
>;

export interface ExactArtifactCacheCandidate {
  readonly sourceKind: ExactTopologySourceKind;
  readonly shapePolicy: ExactBodyArtifactShapePolicy;
  readonly brepFormat: typeof EXACT_ARTIFACT_CACHE_BREP_FORMAT;
  readonly brepWriter: typeof EXACT_ARTIFACT_CACHE_BREP_WRITER;
  readonly brepBytes: Uint8Array;
  readonly brepByteLength: number;
  readonly brepSha256: string;
  readonly topologySignature: string;
}

export type ExactArtifactCacheMissReason =
  | "absent"
  | "unavailable"
  | "permission-denied"
  | "corrupt"
  | "version-mismatch"
  | "stale"
  | "storage-full"
  | "storage-error";

export type ExactArtifactCacheReadResult =
  | {
      readonly status: "hit";
      readonly artifact: GeometryKernelExactBodyArtifact;
    }
  | {
      readonly status: "miss";
      readonly reason: ExactArtifactCacheMissReason;
    };

export type ExactArtifactCacheWriteResult =
  | {
      readonly status: "stored";
      readonly evictedEntryCount: number;
      readonly entryCount: number;
      readonly byteLength: number;
    }
  | {
      readonly status: "skipped";
      readonly reason:
        | Exclude<ExactArtifactCacheMissReason, "absent">
        | "too-large";
    };

export type ExactArtifactCacheClearResult =
  | { readonly status: "cleared" }
  | {
      readonly status: "unavailable" | "failed";
      readonly reason: "unavailable" | "permission-denied" | "storage-error";
    };

export interface ExactArtifactOpfsCache {
  readonly read: (input: {
    readonly identity: ExactArtifactCacheIdentity;
    readonly isCurrent: () => boolean;
    /** Parses the candidate through OCCT and returns freshly recomputed evidence. */
    readonly validate: (
      candidate: ExactArtifactCacheCandidate
    ) => Promise<GeometryKernelExactBodyArtifact>;
  }) => Promise<ExactArtifactCacheReadResult>;
  readonly write: (input: {
    readonly artifact: GeometryKernelExactBodyArtifact;
    readonly isCurrent: () => boolean;
  }) => Promise<ExactArtifactCacheWriteResult>;
  readonly clear: () => Promise<ExactArtifactCacheClearResult>;
}

interface ExactArtifactCacheEntry {
  readonly version: typeof EXACT_ARTIFACT_CACHE_ENTRY_VERSION;
  readonly cacheKey: string;
  readonly bodySourceIdentitySignature: string;
  readonly sourceCacheKeySha256: string;
  readonly geometryKernelProtocolVersion: typeof EXACT_ARTIFACT_CACHE_GEOMETRY_KERNEL_PROTOCOL;
  readonly occtBuildFingerprint: typeof EXACT_ARTIFACT_CACHE_OCCT_BUILD_FINGERPRINT;
  readonly artifactVersion: typeof EXACT_ARTIFACT_CACHE_ARTIFACT_VERSION;
  readonly brepFormat: typeof EXACT_ARTIFACT_CACHE_BREP_FORMAT;
  readonly brepWriter: typeof EXACT_ARTIFACT_CACHE_BREP_WRITER;
  readonly shapePolicy: ExactBodyArtifactShapePolicy;
  readonly sourceKind: ExactTopologySourceKind;
  readonly topologySignature: string;
  readonly byteLength: number;
  readonly sha256: string;
  readonly lastAccess: number;
}

interface ExactArtifactCacheIndex {
  readonly version: typeof EXACT_ARTIFACT_CACHE_INDEX_VERSION;
  readonly entries: readonly ExactArtifactCacheEntry[];
}

type CacheRootResult =
  | {
      readonly ok: true;
      readonly storageRoot: ProjectOpfsCacheDirectoryHandleLike;
      readonly cacheRoot: ProjectOpfsCacheDirectoryHandleLike;
    }
  | {
      readonly ok: false;
      readonly reason: "unavailable" | "permission-denied" | "storage-error";
    };

export function createExactArtifactCacheKey(
  identity: Pick<
    ExactArtifactCacheIdentity,
    "bodySourceIdentitySignature" | "sourceCacheKeySha256" | "shapePolicy"
  >
): string {
  return [
    EXACT_ARTIFACT_CACHE_NAMESPACE,
    identity.bodySourceIdentitySignature,
    identity.sourceCacheKeySha256,
    EXACT_ARTIFACT_CACHE_GEOMETRY_KERNEL_PROTOCOL,
    EXACT_ARTIFACT_CACHE_OCCT_BUILD_FINGERPRINT,
    EXACT_ARTIFACT_CACHE_ARTIFACT_VERSION,
    EXACT_ARTIFACT_CACHE_BREP_FORMAT,
    EXACT_ARTIFACT_CACHE_BREP_WRITER,
    identity.shapePolicy
  ]
    .map(encodeURIComponent)
    .join("|");
}

export function isExactArtifactCacheEntryWithinLimit(
  byteLength: number
): boolean {
  return (
    Number.isSafeInteger(byteLength) &&
    byteLength > 0 &&
    byteLength <= EXACT_ARTIFACT_CACHE_MAX_ENTRY_BYTES
  );
}

export function createExactArtifactOpfsCache(
  target: ProjectOpfsCacheTargetLike,
  now: () => number = Date.now
): ExactArtifactOpfsCache {
  let generation = 0;

  return {
    read: ({ identity, isCurrent, validate }) =>
      withCacheLock(target, async () => {
        const operationGeneration = generation;
        if (!isValidIdentity(identity) || !isCurrent()) {
          return { status: "miss", reason: "stale" };
        }
        const cacheKey = createExactArtifactCacheKey(identity);
        const rootResult = await getCacheRoot(target);
        if (!rootResult.ok)
          return { status: "miss", reason: rootResult.reason };
        const indexResult = await readIndex(rootResult.cacheRoot);
        if (!indexResult.ok) {
          await removeCacheRoot(rootResult.storageRoot);
          return { status: "miss", reason: indexResult.reason };
        }
        const entry = indexResult.index.entries.find(
          (candidate) => candidate.cacheKey === cacheKey
        );
        if (!entry) return { status: "miss", reason: "absent" };
        if (!isCurrentOperation(operationGeneration, generation, isCurrent)) {
          return { status: "miss", reason: "stale" };
        }

        try {
          const bytes = await readArtifactBytes(
            rootResult.cacheRoot,
            cacheKey,
            entry.byteLength
          );
          if (
            bytes.byteLength !== entry.byteLength ||
            (await createProjectOpfsCacheSha256Hex(bytes)) !== entry.sha256
          ) {
            await removeEntry(rootResult.cacheRoot, indexResult.index, entry);
            return { status: "miss", reason: "corrupt" };
          }
          const artifact = await validate({
            sourceKind: entry.sourceKind,
            shapePolicy: entry.shapePolicy,
            brepFormat: entry.brepFormat,
            brepWriter: entry.brepWriter,
            brepBytes: bytes,
            brepByteLength: entry.byteLength,
            brepSha256: entry.sha256,
            topologySignature: entry.topologySignature
          });
          if (!isCurrentOperation(operationGeneration, generation, isCurrent)) {
            return { status: "miss", reason: "stale" };
          }
          if (!artifactMatchesCache(artifact, identity, entry)) {
            await removeEntry(rootResult.cacheRoot, indexResult.index, entry);
            return { status: "miss", reason: "corrupt" };
          }
          await writeIndex(rootResult.cacheRoot, {
            version: EXACT_ARTIFACT_CACHE_INDEX_VERSION,
            entries: indexResult.index.entries.map((candidate) =>
              candidate.cacheKey === cacheKey
                ? { ...candidate, lastAccess: currentTime(now) }
                : candidate
            )
          }).catch(() => undefined);
          return { status: "hit", artifact };
        } catch {
          if (!isCurrentOperation(operationGeneration, generation, isCurrent)) {
            return { status: "miss", reason: "stale" };
          }
          await removeEntry(rootResult.cacheRoot, indexResult.index, entry);
          return { status: "miss", reason: "corrupt" };
        }
      }),

    write: ({ artifact, isCurrent }) =>
      withCacheLock(target, async () => {
        const operationGeneration = generation;
        if (!isCurrentOperation(operationGeneration, generation, isCurrent)) {
          return { status: "skipped", reason: "stale" };
        }
        if (!isArtifactInternallyValid(artifact)) {
          return { status: "skipped", reason: "corrupt" };
        }
        if (!isExactArtifactCacheEntryWithinLimit(artifact.brepByteLength)) {
          return { status: "skipped", reason: "too-large" };
        }
        const actualHash = await createProjectOpfsCacheSha256Hex(
          artifact.brepBytes
        ).catch(() => undefined);
        if (!actualHash || actualHash !== artifact.brepSha256) {
          return { status: "skipped", reason: "corrupt" };
        }
        if (!isCurrentOperation(operationGeneration, generation, isCurrent)) {
          return { status: "skipped", reason: "stale" };
        }
        const rootResult = await getCacheRoot(target);
        if (!rootResult.ok)
          return { status: "skipped", reason: rootResult.reason };
        const indexResult = await readIndex(rootResult.cacheRoot);
        if (!indexResult.ok) {
          await removeCacheRoot(rootResult.storageRoot);
          return { status: "skipped", reason: indexResult.reason };
        }
        if (!isCurrentOperation(operationGeneration, generation, isCurrent)) {
          return { status: "skipped", reason: "stale" };
        }

        const cacheKey = createExactArtifactCacheKey(artifact);
        const entry: ExactArtifactCacheEntry = {
          version: EXACT_ARTIFACT_CACHE_ENTRY_VERSION,
          cacheKey,
          bodySourceIdentitySignature: artifact.bodySourceIdentitySignature,
          sourceCacheKeySha256: artifact.sourceCacheKeySha256,
          geometryKernelProtocolVersion:
            EXACT_ARTIFACT_CACHE_GEOMETRY_KERNEL_PROTOCOL,
          occtBuildFingerprint: EXACT_ARTIFACT_CACHE_OCCT_BUILD_FINGERPRINT,
          artifactVersion: EXACT_ARTIFACT_CACHE_ARTIFACT_VERSION,
          brepFormat: EXACT_ARTIFACT_CACHE_BREP_FORMAT,
          brepWriter: EXACT_ARTIFACT_CACHE_BREP_WRITER,
          shapePolicy: artifact.shapePolicy,
          sourceKind: artifact.sourceKind,
          topologySignature: artifact.topologySnapshot.signature,
          byteLength: artifact.brepByteLength,
          sha256: artifact.brepSha256,
          lastAccess: currentTime(now)
        };

        let artifactWritten = false;
        try {
          await writeArtifactBytes(
            rootResult.cacheRoot,
            cacheKey,
            artifact.brepBytes
          );
          artifactWritten = true;
          if (!isCurrentOperation(operationGeneration, generation, isCurrent)) {
            await removeArtifactBytes(rootResult.cacheRoot, cacheKey);
            return { status: "skipped", reason: "stale" };
          }
          const candidates = [
            ...indexResult.index.entries.filter(
              (candidate) => candidate.cacheKey !== cacheKey
            ),
            entry
          ];
          const retained = retainWithinLimits(candidates);
          const retainedKeys = new Set(
            retained.map(({ cacheKey }) => cacheKey)
          );
          const evicted = candidates.filter(
            (candidate) => !retainedKeys.has(candidate.cacheKey)
          );
          await Promise.all(
            evicted.map((candidate) =>
              removeArtifactBytes(rootResult.cacheRoot, candidate.cacheKey)
            )
          );
          if (!isCurrentOperation(operationGeneration, generation, isCurrent)) {
            await removeArtifactBytes(rootResult.cacheRoot, cacheKey);
            return { status: "skipped", reason: "stale" };
          }
          await writeIndex(rootResult.cacheRoot, {
            version: EXACT_ARTIFACT_CACHE_INDEX_VERSION,
            entries: retained
          });
          if (!isCurrentOperation(operationGeneration, generation, isCurrent)) {
            await removeEntry(
              rootResult.cacheRoot,
              {
                version: EXACT_ARTIFACT_CACHE_INDEX_VERSION,
                entries: retained
              },
              entry
            );
            return { status: "skipped", reason: "stale" };
          }
          return {
            status: "stored",
            evictedEntryCount: evicted.length,
            entryCount: retained.length,
            byteLength: retained.reduce(
              (sum, candidate) => sum + candidate.byteLength,
              0
            )
          };
        } catch (error) {
          if (artifactWritten) {
            await removeArtifactBytes(rootResult.cacheRoot, cacheKey);
          }
          return {
            status: "skipped",
            reason: isQuotaError(error) ? "storage-full" : "storage-error"
          };
        }
      }),

    clear: () => {
      generation += 1;
      return withCacheLock(target, async () => {
        const storageResult = await getStorageRoot(target);
        if (!storageResult.ok) {
          return {
            status:
              storageResult.reason === "unavailable" ? "unavailable" : "failed",
            reason: storageResult.reason
          };
        }
        try {
          await storageResult.root.removeEntry(EXACT_ARTIFACT_CACHE_NAMESPACE, {
            recursive: true
          });
          return { status: "cleared" as const };
        } catch (error) {
          if (isNotFoundError(error)) return { status: "cleared" as const };
          return {
            status: "failed" as const,
            reason: isPermissionError(error)
              ? ("permission-denied" as const)
              : ("storage-error" as const)
          };
        }
      });
    }
  };
}

async function getStorageRoot(target: ProjectOpfsCacheTargetLike): Promise<
  | { readonly ok: true; readonly root: ProjectOpfsCacheDirectoryHandleLike }
  | {
      readonly ok: false;
      readonly reason: "unavailable" | "permission-denied" | "storage-error";
    }
> {
  const storage = target.navigator?.storage;
  if (typeof storage?.getDirectory !== "function") {
    return { ok: false, reason: "unavailable" };
  }
  try {
    return { ok: true, root: await storage.getDirectory.call(storage) };
  } catch (error) {
    return {
      ok: false,
      reason: isPermissionError(error) ? "permission-denied" : "storage-error"
    };
  }
}

function withCacheLock<T>(
  target: ProjectOpfsCacheTargetLike,
  operation: () => Promise<T>
): Promise<T> {
  return target.navigator?.locks?.request
    ? target.navigator.locks.request(EXACT_ARTIFACT_CACHE_NAMESPACE, operation)
    : operation();
}

async function getCacheRoot(
  target: ProjectOpfsCacheTargetLike
): Promise<CacheRootResult> {
  const storageResult = await getStorageRoot(target);
  if (!storageResult.ok) return storageResult;
  try {
    return {
      ok: true,
      storageRoot: storageResult.root,
      cacheRoot: await storageResult.root.getDirectoryHandle(
        EXACT_ARTIFACT_CACHE_NAMESPACE,
        { create: true }
      )
    };
  } catch (error) {
    return {
      ok: false,
      reason: isPermissionError(error) ? "permission-denied" : "storage-error"
    };
  }
}

async function readIndex(root: ProjectOpfsCacheDirectoryHandleLike): Promise<
  | { readonly ok: true; readonly index: ExactArtifactCacheIndex }
  | {
      readonly ok: false;
      readonly reason: "corrupt" | "version-mismatch";
    }
> {
  try {
    const file = await root
      .getFileHandle(INDEX_FILE_NAME)
      .then((handle) => handle.getFile());
    if (
      file.size !== undefined &&
      (!Number.isSafeInteger(file.size) ||
        file.size < 0 ||
        file.size > EXACT_ARTIFACT_CACHE_MAX_INDEX_BYTES)
    ) {
      return { ok: false, reason: "corrupt" };
    }
    const text = await file.text();
    if (
      new TextEncoder().encode(text).byteLength >
      EXACT_ARTIFACT_CACHE_MAX_INDEX_BYTES
    ) {
      return { ok: false, reason: "corrupt" };
    }
    const value = JSON.parse(text) as unknown;
    if (!isRecord(value)) return { ok: false, reason: "corrupt" };
    if (value.version !== EXACT_ARTIFACT_CACHE_INDEX_VERSION) {
      return { ok: false, reason: "version-mismatch" };
    }
    if (
      !Array.isArray(value.entries) ||
      value.entries.length > EXACT_ARTIFACT_CACHE_MAX_ENTRIES
    ) {
      return { ok: false, reason: "corrupt" };
    }
    if (value.entries.some(isVersionMismatchedEntry)) {
      return { ok: false, reason: "version-mismatch" };
    }
    if (!value.entries.every(isCacheEntry)) {
      return { ok: false, reason: "corrupt" };
    }
    const entries = value.entries as ExactArtifactCacheEntry[];
    if (
      new Set(entries.map(({ cacheKey }) => cacheKey)).size !== entries.length
    ) {
      return { ok: false, reason: "corrupt" };
    }
    const retained = retainWithinLimits(entries);
    if (retained.length !== entries.length) {
      const retainedKeys = new Set(retained.map(({ cacheKey }) => cacheKey));
      await Promise.all(
        entries
          .filter(({ cacheKey }) => !retainedKeys.has(cacheKey))
          .map(({ cacheKey }) => removeArtifactBytes(root, cacheKey))
      );
      try {
        await writeIndex(root, {
          version: EXACT_ARTIFACT_CACHE_INDEX_VERSION,
          entries: retained
        });
      } catch {
        return { ok: false, reason: "corrupt" };
      }
    }
    return {
      ok: true,
      index: { version: value.version, entries: retained }
    };
  } catch (error) {
    if (isNotFoundError(error)) {
      return {
        ok: true,
        index: { version: EXACT_ARTIFACT_CACHE_INDEX_VERSION, entries: [] }
      };
    }
    return { ok: false, reason: "corrupt" };
  }
}

async function writeIndex(
  root: ProjectOpfsCacheDirectoryHandleLike,
  index: ExactArtifactCacheIndex
): Promise<void> {
  const handle = await root.getFileHandle(INDEX_FILE_NAME, { create: true });
  const writable = await handle.createWritable?.();
  if (!writable) throw new Error("OPFS exact cache index is not writable.");
  await writeAndCloseProjectOpfsWritable(
    writable,
    `${JSON.stringify({
      ...index,
      entries: [...index.entries].sort((left, right) =>
        compareCacheKeys(left.cacheKey, right.cacheKey)
      )
    })}\n`
  );
}

async function readArtifactBytes(
  root: ProjectOpfsCacheDirectoryHandleLike,
  cacheKey: string,
  expectedByteLength: number
): Promise<Uint8Array> {
  const artifacts = await root.getDirectoryHandle(ARTIFACTS_DIRECTORY_NAME);
  const file = await (
    await artifacts.getFileHandle(await createArtifactFileName(cacheKey))
  ).getFile();
  if (
    !isExactArtifactCacheEntryWithinLimit(expectedByteLength) ||
    (file.size !== undefined && file.size !== expectedByteLength)
  ) {
    throw new Error("OPFS exact cache artifact size is invalid.");
  }
  const buffer = await file.arrayBuffer?.();
  if (!buffer) throw new Error("OPFS exact cache artifact has no bytes.");
  if (buffer.byteLength !== expectedByteLength) {
    throw new Error("OPFS exact cache artifact size changed during read.");
  }
  return new Uint8Array(buffer);
}

async function writeArtifactBytes(
  root: ProjectOpfsCacheDirectoryHandleLike,
  cacheKey: string,
  bytes: Uint8Array
): Promise<void> {
  const artifacts = await root.getDirectoryHandle(ARTIFACTS_DIRECTORY_NAME, {
    create: true
  });
  const handle = await artifacts.getFileHandle(
    await createArtifactFileName(cacheKey),
    { create: true }
  );
  const writable = await handle.createWritable?.();
  if (!writable) throw new Error("OPFS exact cache artifact is not writable.");
  await writeAndCloseProjectOpfsWritable(writable, bytes);
}

async function removeEntry(
  root: ProjectOpfsCacheDirectoryHandleLike,
  index: ExactArtifactCacheIndex,
  entry: ExactArtifactCacheEntry
): Promise<void> {
  await removeArtifactBytes(root, entry.cacheKey);
  await writeIndex(root, {
    version: EXACT_ARTIFACT_CACHE_INDEX_VERSION,
    entries: index.entries.filter(
      (candidate) => candidate.cacheKey !== entry.cacheKey
    )
  }).catch(() => undefined);
}

async function removeArtifactBytes(
  root: ProjectOpfsCacheDirectoryHandleLike,
  cacheKey: string
): Promise<void> {
  try {
    const artifacts = await root.getDirectoryHandle(ARTIFACTS_DIRECTORY_NAME);
    await artifacts.removeEntry(await createArtifactFileName(cacheKey));
  } catch {
    // Derived cache cleanup is best effort.
  }
}

async function removeCacheRoot(
  storageRoot: ProjectOpfsCacheDirectoryHandleLike
): Promise<void> {
  await storageRoot
    .removeEntry(EXACT_ARTIFACT_CACHE_NAMESPACE, { recursive: true })
    .catch(() => undefined);
}

async function createArtifactFileName(cacheKey: string): Promise<string> {
  const digest = await createProjectOpfsCacheSha256Hex(
    new TextEncoder().encode(cacheKey)
  );
  return `${digest}.brep`;
}

function retainWithinLimits(
  entries: readonly ExactArtifactCacheEntry[]
): ExactArtifactCacheEntry[] {
  const retained = [...entries];
  let byteLength = retained.reduce((sum, entry) => sum + entry.byteLength, 0);
  const byLeastRecentlyUsed = (
    left: ExactArtifactCacheEntry,
    right: ExactArtifactCacheEntry
  ) =>
    left.lastAccess - right.lastAccess ||
    compareCacheKeys(left.cacheKey, right.cacheKey);
  while (
    retained.length > EXACT_ARTIFACT_CACHE_MAX_ENTRIES ||
    byteLength > EXACT_ARTIFACT_CACHE_MAX_TOTAL_BYTES
  ) {
    retained.sort(byLeastRecentlyUsed);
    const evicted = retained.shift();
    if (!evicted) break;
    byteLength -= evicted.byteLength;
  }
  return retained;
}

function artifactMatchesCache(
  artifact: GeometryKernelExactBodyArtifact,
  identity: ExactArtifactCacheIdentity,
  entry: ExactArtifactCacheEntry
): boolean {
  return (
    isArtifactInternallyValid(artifact) &&
    artifact.bodyId === identity.bodyId &&
    artifact.sourceType === identity.sourceType &&
    artifact.documentSourceIdentity.algorithm ===
      identity.documentSourceIdentity.algorithm &&
    artifact.documentSourceIdentity.sha256 ===
      identity.documentSourceIdentity.sha256 &&
    artifact.bodySourceIdentitySignature ===
      identity.bodySourceIdentitySignature &&
    artifact.sourceCacheKeySha256 === identity.sourceCacheKeySha256 &&
    artifact.sourceGraphNodeCount === identity.sourceGraphNodeCount &&
    artifact.units === identity.units &&
    artifact.shapePolicy === entry.shapePolicy &&
    artifact.sourceKind === entry.sourceKind &&
    artifact.brepByteLength === entry.byteLength &&
    artifact.brepSha256 === entry.sha256 &&
    artifact.topologySnapshot.signature === entry.topologySignature
  );
}

function isArtifactInternallyValid(
  artifact: GeometryKernelExactBodyArtifact
): boolean {
  return (
    artifact.artifactVersion === EXACT_ARTIFACT_CACHE_ARTIFACT_VERSION &&
    artifact.brepFormat === EXACT_ARTIFACT_CACHE_BREP_FORMAT &&
    artifact.brepWriter === EXACT_ARTIFACT_CACHE_BREP_WRITER &&
    artifact.brepByteLength === artifact.brepBytes.byteLength &&
    SHA256_HEX_PATTERN.test(artifact.brepSha256) &&
    isValidIdentity(artifact) &&
    SOURCE_KINDS.has(artifact.sourceKind) &&
    artifact.metadata.sourceKind === artifact.sourceKind &&
    artifact.topologySnapshot.sourceKind === artifact.sourceKind &&
    typeof artifact.topologySnapshot.signature === "string" &&
    artifact.topologySnapshot.signature.length > 0 &&
    artifact.metadata.topologyCounts.solidCount > 0 &&
    artifact.metadata.topologyCounts.solidCount ===
      artifact.topologySnapshot.entityCounts.solidCount &&
    (artifact.shapePolicy === "singleSolid"
      ? artifact.metadata.topologyCounts.solidCount === 1
      : artifact.metadata.topologyCounts.solidCount >= 1)
  );
}

function isValidIdentity(identity: ExactArtifactCacheIdentity): boolean {
  return (
    typeof identity.bodyId === "string" &&
    identity.bodyId.length > 0 &&
    typeof identity.sourceType === "string" &&
    identity.sourceType.length > 0 &&
    identity.documentSourceIdentity.algorithm === "partbench-source-v1" &&
    SHA256_HEX_PATTERN.test(identity.documentSourceIdentity.sha256) &&
    typeof identity.bodySourceIdentitySignature === "string" &&
    identity.bodySourceIdentitySignature.length > 0 &&
    SHA256_HEX_PATTERN.test(identity.sourceCacheKeySha256) &&
    Number.isSafeInteger(identity.sourceGraphNodeCount) &&
    identity.sourceGraphNodeCount > 0 &&
    (identity.units === "mm" ||
      identity.units === "cm" ||
      identity.units === "m" ||
      identity.units === "in") &&
    (identity.shapePolicy === "singleSolid" ||
      identity.shapePolicy === "singleShapeOneOrMoreSolids")
  );
}

function isCacheEntry(value: unknown): value is ExactArtifactCacheEntry {
  if (!isRecord(value)) return false;
  return (
    value.version === EXACT_ARTIFACT_CACHE_ENTRY_VERSION &&
    typeof value.cacheKey === "string" &&
    value.cacheKey ===
      createExactArtifactCacheKey({
        bodySourceIdentitySignature: String(
          value.bodySourceIdentitySignature ?? ""
        ),
        sourceCacheKeySha256: String(value.sourceCacheKeySha256 ?? ""),
        shapePolicy: value.shapePolicy as ExactBodyArtifactShapePolicy
      }) &&
    typeof value.bodySourceIdentitySignature === "string" &&
    value.bodySourceIdentitySignature.length > 0 &&
    typeof value.sourceCacheKeySha256 === "string" &&
    SHA256_HEX_PATTERN.test(value.sourceCacheKeySha256) &&
    value.geometryKernelProtocolVersion ===
      EXACT_ARTIFACT_CACHE_GEOMETRY_KERNEL_PROTOCOL &&
    value.occtBuildFingerprint ===
      EXACT_ARTIFACT_CACHE_OCCT_BUILD_FINGERPRINT &&
    value.artifactVersion === EXACT_ARTIFACT_CACHE_ARTIFACT_VERSION &&
    value.brepFormat === EXACT_ARTIFACT_CACHE_BREP_FORMAT &&
    value.brepWriter === EXACT_ARTIFACT_CACHE_BREP_WRITER &&
    (value.shapePolicy === "singleSolid" ||
      value.shapePolicy === "singleShapeOneOrMoreSolids") &&
    SOURCE_KINDS.has(value.sourceKind as ExactTopologySourceKind) &&
    typeof value.topologySignature === "string" &&
    value.topologySignature.length > 0 &&
    isExactArtifactCacheEntryWithinLimit(value.byteLength as number) &&
    typeof value.sha256 === "string" &&
    SHA256_HEX_PATTERN.test(value.sha256) &&
    typeof value.lastAccess === "number" &&
    Number.isSafeInteger(value.lastAccess) &&
    value.lastAccess >= 0
  );
}

function isVersionMismatchedEntry(value: unknown): boolean {
  return (
    isRecord(value) &&
    (value.version !== EXACT_ARTIFACT_CACHE_ENTRY_VERSION ||
      value.geometryKernelProtocolVersion !==
        EXACT_ARTIFACT_CACHE_GEOMETRY_KERNEL_PROTOCOL ||
      value.occtBuildFingerprint !==
        EXACT_ARTIFACT_CACHE_OCCT_BUILD_FINGERPRINT ||
      value.artifactVersion !== EXACT_ARTIFACT_CACHE_ARTIFACT_VERSION ||
      value.brepFormat !== EXACT_ARTIFACT_CACHE_BREP_FORMAT ||
      value.brepWriter !== EXACT_ARTIFACT_CACHE_BREP_WRITER)
  );
}

function isCurrentOperation(
  operationGeneration: number,
  generation: number,
  isCurrent: () => boolean
): boolean {
  return operationGeneration === generation && isCurrent();
}

function currentTime(now: () => number): number {
  const value = now();
  return Number.isSafeInteger(value) && value >= 0 ? value : Date.now();
}

function compareCacheKeys(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPermissionError(error: unknown): boolean {
  return (
    typeof DOMException !== "undefined" &&
    error instanceof DOMException &&
    (error.name === "SecurityError" || error.name === "NotAllowedError")
  );
}

function isQuotaError(error: unknown): boolean {
  return (
    typeof DOMException !== "undefined" &&
    error instanceof DOMException &&
    error.name === "QuotaExceededError"
  );
}

function isNotFoundError(error: unknown): boolean {
  return (
    typeof DOMException !== "undefined" &&
    error instanceof DOMException &&
    error.name === "NotFoundError"
  );
}
