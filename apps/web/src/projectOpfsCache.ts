import type {
  DocumentUnits,
  WcadDocumentSchemaVersion,
  WcadPackageCacheArtifactKind,
  WcadSourceIdentity
} from "@web-cad/cad-protocol";

export const PROJECT_OPFS_CACHE_INDEX_VERSION = "partbench.opfs-cache.v1";
export const PROJECT_OPFS_CACHE_ROOT_NAME = "partbench-v8-cache";
export const PROJECT_OPFS_CACHE_INDEX_FILE_NAME = "cache-index.json";

export type ProjectOpfsCacheIndexVersion =
  typeof PROJECT_OPFS_CACHE_INDEX_VERSION;

export type ProjectOpfsCacheEntryStatus =
  | "valid"
  | "stale"
  | "unsupported"
  | "corrupt";

export type ProjectOpfsCacheDiagnosticSeverity = "info" | "warning" | "error";

export type ProjectOpfsCacheDiagnosticCode =
  | "OPFS_UNAVAILABLE"
  | "OPFS_PERMISSION_DENIED"
  | "OPFS_HANDLE_FAILED"
  | "OPFS_INDEX_MISSING"
  | "OPFS_INDEX_INVALID"
  | "OPFS_STALE_SOURCE_IDENTITY"
  | "OPFS_UNSUPPORTED_ARTIFACT_VERSION"
  | "OPFS_BYTE_LENGTH_MISMATCH"
  | "OPFS_HASH_MISMATCH"
  | "OPFS_CLEAR_FAILED"
  | "OPFS_CACHE_IGNORED";

export interface ProjectOpfsCacheDiagnostic {
  readonly code: ProjectOpfsCacheDiagnosticCode;
  readonly severity: ProjectOpfsCacheDiagnosticSeverity;
  readonly message: string;
  readonly detail?: string;
  readonly cacheKey?: string;
  readonly artifactKind?: WcadPackageCacheArtifactKind;
}

export interface ProjectOpfsCacheKeyInput {
  readonly sourceIdentity: WcadSourceIdentity;
  readonly artifactKind: WcadPackageCacheArtifactKind;
  readonly artifactVersion: string;
  readonly documentSchemaVersion?: WcadDocumentSchemaVersion;
  readonly units?: DocumentUnits;
  readonly kernelVersion?: string;
  readonly workerVersion?: string;
  readonly settingsKey?: string;
}

export interface ProjectOpfsCacheIndexEntry extends ProjectOpfsCacheKeyInput {
  readonly cacheKey: string;
  readonly byteLength: number;
  readonly sha256: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly status: ProjectOpfsCacheEntryStatus;
}

export interface ProjectOpfsCacheIndex {
  readonly version: ProjectOpfsCacheIndexVersion;
  readonly entries: readonly ProjectOpfsCacheIndexEntry[];
  readonly updatedAt: string;
}

export type ProjectOpfsCacheStatusState =
  | "unavailable"
  | "empty"
  | "ready"
  | "invalid"
  | "cleared"
  | "error";

export interface ProjectOpfsCacheStatus {
  readonly state: ProjectOpfsCacheStatusState;
  readonly available: boolean;
  readonly indexVersion: ProjectOpfsCacheIndexVersion;
  readonly entryCount: number;
  readonly validEntryCount: number;
  readonly staleEntryCount: number;
  readonly unsupportedEntryCount: number;
  readonly corruptEntryCount: number;
  readonly diagnostics: readonly ProjectOpfsCacheDiagnostic[];
  readonly lastResult?: string;
}

export interface ProjectOpfsCacheValidationOptions {
  readonly currentSourceIdentity?: WcadSourceIdentity;
  readonly supportedArtifactVersions?: ReadonlySet<string> | readonly string[];
  readonly artifactMetadataByCacheKey?: ReadonlyMap<
    string,
    {
      readonly byteLength: number;
      readonly sha256: string;
    }
  >;
}

export interface ProjectOpfsCacheDirectoryHandleLike {
  readonly getDirectoryHandle: (
    name: string,
    options?: { readonly create?: boolean }
  ) => Promise<ProjectOpfsCacheDirectoryHandleLike>;
  readonly getFileHandle: (
    name: string,
    options?: { readonly create?: boolean }
  ) => Promise<ProjectOpfsCacheFileHandleLike>;
  readonly removeEntry: (
    name: string,
    options?: { readonly recursive?: boolean }
  ) => Promise<void>;
}

export interface ProjectOpfsCacheFileHandleLike {
  readonly getFile: () => Promise<ProjectOpfsCacheFileLike>;
  readonly createWritable?: () => Promise<ProjectOpfsCacheWritableLike>;
}

export interface ProjectOpfsCacheFileLike {
  readonly text: () => Promise<string>;
}

export interface ProjectOpfsCacheWritableLike {
  readonly write: (data: string | Uint8Array) => Promise<void> | void;
  readonly close: () => Promise<void> | void;
}

export interface ProjectOpfsCacheTargetLike {
  readonly navigator?: {
    readonly storage?: {
      readonly getDirectory?: () => Promise<ProjectOpfsCacheDirectoryHandleLike>;
    };
  };
}

export function createProjectOpfsCacheKey(
  input: ProjectOpfsCacheKeyInput
): string {
  return [
    "partbench-opfs-cache",
    input.sourceIdentity.algorithm,
    input.sourceIdentity.sha256,
    input.documentSchemaVersion ?? "schema:none",
    input.units ?? "units:none",
    input.artifactKind,
    input.artifactVersion,
    input.kernelVersion ?? "kernel:none",
    input.workerVersion ?? "worker:none",
    input.settingsKey ?? "settings:none"
  ]
    .map(encodeCacheKeyPart)
    .join("|");
}

export function createProjectOpfsCacheIndex(
  entries: readonly ProjectOpfsCacheIndexEntry[] = [],
  updatedAt = new Date().toISOString()
): ProjectOpfsCacheIndex {
  return {
    version: PROJECT_OPFS_CACHE_INDEX_VERSION,
    entries,
    updatedAt
  };
}

export function createInitialProjectOpfsCacheStatus(
  opfsApiDetected: boolean
): ProjectOpfsCacheStatus {
  return opfsApiDetected
    ? createProjectOpfsCacheStatus({
        state: "empty",
        available: true,
        lastResult: "OPFS cache status has not been read yet."
      })
    : createProjectOpfsCacheStatus({
        state: "unavailable",
        available: false,
        diagnostics: [
          createProjectOpfsCacheDiagnostic("OPFS_UNAVAILABLE", "info")
        ],
        lastResult: "OPFS is unavailable in this browser."
      });
}

export async function readProjectOpfsCacheStatus(
  target: ProjectOpfsCacheTargetLike,
  options: ProjectOpfsCacheValidationOptions = {}
): Promise<ProjectOpfsCacheStatus> {
  const rootResult = await getProjectOpfsCacheRoot(target);

  if (!rootResult.ok) {
    return createProjectOpfsCacheStatus({
      state:
        rootResult.diagnostic.code === "OPFS_UNAVAILABLE"
          ? "unavailable"
          : "error",
      available: false,
      diagnostics: [rootResult.diagnostic, createCacheIgnoredDiagnostic()],
      lastResult: rootResult.diagnostic.message
    });
  }

  try {
    const indexHandle = await rootResult.root.getFileHandle(
      PROJECT_OPFS_CACHE_INDEX_FILE_NAME
    );
    const indexJson = await (await indexHandle.getFile()).text();
    let parsed: unknown;

    try {
      parsed = JSON.parse(indexJson) as unknown;
    } catch (error) {
      const diagnostic = createProjectOpfsCacheDiagnostic(
        "OPFS_INDEX_INVALID",
        "error",
        getErrorDetail(error)
      );

      return createProjectOpfsCacheStatus({
        state: "invalid",
        available: true,
        diagnostics: [diagnostic, createCacheIgnoredDiagnostic()],
        lastResult: diagnostic.message
      });
    }

    const validation = validateProjectOpfsCacheIndex(parsed, options);

    return createProjectOpfsCacheStatus({
      state: validation.diagnostics.some(
        (diagnostic) => diagnostic.severity === "error"
      )
        ? "invalid"
        : validation.index.entries.length > 0
          ? "ready"
          : "empty",
      available: true,
      entries: validation.index.entries,
      diagnostics: validation.diagnostics,
      lastResult:
        validation.index.entries.length > 0
          ? "OPFS cache index read."
          : "OPFS cache index is empty."
    });
  } catch (error) {
    const diagnostic = isNotFoundError(error)
      ? createProjectOpfsCacheDiagnostic("OPFS_INDEX_MISSING", "info")
      : createProjectOpfsCacheDiagnostic(
          "OPFS_HANDLE_FAILED",
          "error",
          getErrorDetail(error)
        );

    return createProjectOpfsCacheStatus({
      state: isNotFoundError(error) ? "empty" : "error",
      available: true,
      diagnostics: [diagnostic, createCacheIgnoredDiagnostic()],
      lastResult: diagnostic.message
    });
  }
}

export async function clearProjectOpfsCache(
  target: ProjectOpfsCacheTargetLike
): Promise<ProjectOpfsCacheStatus> {
  const storage = target.navigator?.storage;
  const directory = storage?.getDirectory;

  if (typeof directory !== "function") {
    const diagnostic = createProjectOpfsCacheDiagnostic(
      "OPFS_UNAVAILABLE",
      "info"
    );

    return createProjectOpfsCacheStatus({
      state: "unavailable",
      available: false,
      diagnostics: [diagnostic, createCacheIgnoredDiagnostic()],
      lastResult: diagnostic.message
    });
  }

  try {
    const root = await directory.call(storage);
    await root.removeEntry(PROJECT_OPFS_CACHE_ROOT_NAME, { recursive: true });

    return createProjectOpfsCacheStatus({
      state: "cleared",
      available: true,
      lastResult: "OPFS cache cleared."
    });
  } catch (error) {
    if (isNotFoundError(error)) {
      return createProjectOpfsCacheStatus({
        state: "cleared",
        available: true,
        lastResult: "OPFS cache was already empty."
      });
    }

    const diagnostic = createProjectOpfsCacheDiagnostic(
      "OPFS_CLEAR_FAILED",
      "error",
      getErrorDetail(error)
    );

    return createProjectOpfsCacheStatus({
      state: "error",
      available: false,
      diagnostics: [diagnostic, createCacheIgnoredDiagnostic()],
      lastResult: diagnostic.message
    });
  }
}

export async function writeProjectOpfsCacheIndexForTest(
  target: ProjectOpfsCacheTargetLike,
  index: ProjectOpfsCacheIndex
): Promise<void> {
  const rootResult = await getProjectOpfsCacheRoot(target);

  if (!rootResult.ok) {
    throw new Error(rootResult.diagnostic.message);
  }

  const handle = await rootResult.root.getFileHandle(
    PROJECT_OPFS_CACHE_INDEX_FILE_NAME,
    { create: true }
  );
  const writable = await handle.createWritable?.();

  if (!writable) {
    throw new Error("OPFS file handle cannot create a writable stream.");
  }

  await writable.write(JSON.stringify(index, null, 2));
  await writable.close();
}

export function validateProjectOpfsCacheIndex(
  value: unknown,
  options: ProjectOpfsCacheValidationOptions = {}
): {
  readonly index: ProjectOpfsCacheIndex;
  readonly diagnostics: readonly ProjectOpfsCacheDiagnostic[];
} {
  const diagnostics: ProjectOpfsCacheDiagnostic[] = [];

  if (!isRecord(value)) {
    return invalidIndex("Cache index must be an object.");
  }

  if (value.version !== PROJECT_OPFS_CACHE_INDEX_VERSION) {
    return invalidIndex("Cache index has an unsupported version.");
  }

  if (!Array.isArray(value.entries)) {
    return invalidIndex("Cache index entries must be an array.");
  }

  const supportedArtifactVersions = normalizeVersionSet(
    options.supportedArtifactVersions
  );
  const entries: ProjectOpfsCacheIndexEntry[] = [];

  value.entries.forEach((entryValue, index) => {
    const entry = parseProjectOpfsCacheIndexEntry(entryValue, index);

    if (!entry.ok) {
      diagnostics.push(entry.diagnostic);
      return;
    }

    const actual = options.artifactMetadataByCacheKey?.get(
      entry.entry.cacheKey
    );
    let status = entry.entry.status;

    if (
      options.currentSourceIdentity &&
      !isSameSourceIdentity(
        entry.entry.sourceIdentity,
        options.currentSourceIdentity
      )
    ) {
      status = "stale";
      diagnostics.push(
        createProjectOpfsCacheDiagnostic(
          "OPFS_STALE_SOURCE_IDENTITY",
          "warning",
          undefined,
          entry.entry.cacheKey,
          entry.entry.artifactKind
        )
      );
    }

    if (
      supportedArtifactVersions &&
      !supportedArtifactVersions.has(entry.entry.artifactVersion)
    ) {
      status = "unsupported";
      diagnostics.push(
        createProjectOpfsCacheDiagnostic(
          "OPFS_UNSUPPORTED_ARTIFACT_VERSION",
          "warning",
          undefined,
          entry.entry.cacheKey,
          entry.entry.artifactKind
        )
      );
    }

    if (actual && actual.byteLength !== entry.entry.byteLength) {
      status = "corrupt";
      diagnostics.push(
        createProjectOpfsCacheDiagnostic(
          "OPFS_BYTE_LENGTH_MISMATCH",
          "error",
          undefined,
          entry.entry.cacheKey,
          entry.entry.artifactKind
        )
      );
    }

    if (actual && actual.sha256 !== entry.entry.sha256) {
      status = "corrupt";
      diagnostics.push(
        createProjectOpfsCacheDiagnostic(
          "OPFS_HASH_MISMATCH",
          "error",
          undefined,
          entry.entry.cacheKey,
          entry.entry.artifactKind
        )
      );
    }

    entries.push({ ...entry.entry, status });
  });

  return {
    index: createProjectOpfsCacheIndex(
      entries,
      typeof value.updatedAt === "string"
        ? value.updatedAt
        : new Date(0).toISOString()
    ),
    diagnostics
  };
}

export function formatProjectOpfsCacheDiagnostic(
  diagnostic: ProjectOpfsCacheDiagnostic
): string {
  return diagnostic.detail
    ? `${diagnostic.code}: ${diagnostic.message} ${diagnostic.detail}`
    : `${diagnostic.code}: ${diagnostic.message}`;
}

export function getProjectOpfsCacheStatusLabel(
  status: ProjectOpfsCacheStatus
): string {
  switch (status.state) {
    case "ready":
      return "Ready";
    case "empty":
      return status.available ? "Empty" : "Unavailable";
    case "cleared":
      return "Cleared";
    case "invalid":
      return "Invalid";
    case "error":
      return "Error";
    case "unavailable":
      return "Unavailable";
  }
}

export function getProjectOpfsCacheHealthLabel(
  status: ProjectOpfsCacheStatus
): string {
  if (!status.available) {
    return "Unavailable";
  }

  if (status.entryCount === 0) {
    return "No entries";
  }

  if (status.corruptEntryCount > 0) {
    return `${status.corruptEntryCount} corrupt`;
  }

  if (status.unsupportedEntryCount > 0) {
    return `${status.unsupportedEntryCount} unsupported`;
  }

  if (status.staleEntryCount > 0) {
    return `${status.staleEntryCount} stale`;
  }

  return `${status.validEntryCount} valid`;
}

function createProjectOpfsCacheStatus({
  state,
  available,
  entries = [],
  diagnostics = [],
  lastResult
}: {
  readonly state: ProjectOpfsCacheStatusState;
  readonly available: boolean;
  readonly entries?: readonly ProjectOpfsCacheIndexEntry[];
  readonly diagnostics?: readonly ProjectOpfsCacheDiagnostic[];
  readonly lastResult?: string;
}): ProjectOpfsCacheStatus {
  return {
    state,
    available,
    indexVersion: PROJECT_OPFS_CACHE_INDEX_VERSION,
    entryCount: entries.length,
    validEntryCount: entries.filter((entry) => entry.status === "valid").length,
    staleEntryCount: entries.filter((entry) => entry.status === "stale").length,
    unsupportedEntryCount: entries.filter(
      (entry) => entry.status === "unsupported"
    ).length,
    corruptEntryCount: entries.filter((entry) => entry.status === "corrupt")
      .length,
    diagnostics,
    lastResult
  };
}

function createProjectOpfsCacheDiagnostic(
  code: ProjectOpfsCacheDiagnosticCode,
  severity: ProjectOpfsCacheDiagnosticSeverity,
  detail?: string,
  cacheKey?: string,
  artifactKind?: WcadPackageCacheArtifactKind
): ProjectOpfsCacheDiagnostic {
  return {
    code,
    severity,
    message: getDiagnosticMessage(code),
    detail,
    cacheKey,
    artifactKind
  };
}

function createCacheIgnoredDiagnostic(): ProjectOpfsCacheDiagnostic {
  return createProjectOpfsCacheDiagnostic("OPFS_CACHE_IGNORED", "info");
}

async function getProjectOpfsCacheRoot(
  target: ProjectOpfsCacheTargetLike
): Promise<
  | { readonly ok: true; readonly root: ProjectOpfsCacheDirectoryHandleLike }
  | { readonly ok: false; readonly diagnostic: ProjectOpfsCacheDiagnostic }
> {
  const storage = target.navigator?.storage;
  const directory = storage?.getDirectory;

  if (typeof directory !== "function") {
    return {
      ok: false,
      diagnostic: createProjectOpfsCacheDiagnostic("OPFS_UNAVAILABLE", "info")
    };
  }

  try {
    const root = await directory.call(storage);
    const cacheRoot = await root.getDirectoryHandle(
      PROJECT_OPFS_CACHE_ROOT_NAME,
      { create: true }
    );

    return { ok: true, root: cacheRoot };
  } catch (error) {
    return {
      ok: false,
      diagnostic: createProjectOpfsCacheDiagnostic(
        isPermissionError(error)
          ? "OPFS_PERMISSION_DENIED"
          : "OPFS_HANDLE_FAILED",
        "error",
        getErrorDetail(error)
      )
    };
  }
}

function parseProjectOpfsCacheIndexEntry(
  value: unknown,
  index: number
):
  | { readonly ok: true; readonly entry: ProjectOpfsCacheIndexEntry }
  | { readonly ok: false; readonly diagnostic: ProjectOpfsCacheDiagnostic } {
  if (!isRecord(value)) {
    return {
      ok: false,
      diagnostic: createProjectOpfsCacheDiagnostic(
        "OPFS_INDEX_INVALID",
        "error",
        `Entry ${index} must be an object.`
      )
    };
  }

  const sourceIdentity = value.sourceIdentity;

  if (
    typeof value.cacheKey !== "string" ||
    !isSourceIdentity(sourceIdentity) ||
    !isArtifactKind(value.artifactKind) ||
    typeof value.artifactVersion !== "string" ||
    typeof value.byteLength !== "number" ||
    !Number.isSafeInteger(value.byteLength) ||
    value.byteLength < 0 ||
    typeof value.sha256 !== "string" ||
    !isIsoLikeString(value.createdAt) ||
    !isIsoLikeString(value.updatedAt) ||
    !isCacheEntryStatus(value.status)
  ) {
    return {
      ok: false,
      diagnostic: createProjectOpfsCacheDiagnostic(
        "OPFS_INDEX_INVALID",
        "error",
        `Entry ${index} has invalid cache metadata.`
      )
    };
  }

  return {
    ok: true,
    entry: {
      cacheKey: value.cacheKey,
      sourceIdentity,
      artifactKind: value.artifactKind,
      artifactVersion: value.artifactVersion,
      documentSchemaVersion: isDocumentSchemaVersion(
        value.documentSchemaVersion
      )
        ? value.documentSchemaVersion
        : undefined,
      units: isDocumentUnits(value.units) ? value.units : undefined,
      kernelVersion:
        typeof value.kernelVersion === "string"
          ? value.kernelVersion
          : undefined,
      workerVersion:
        typeof value.workerVersion === "string"
          ? value.workerVersion
          : undefined,
      settingsKey:
        typeof value.settingsKey === "string" ? value.settingsKey : undefined,
      byteLength: value.byteLength,
      sha256: value.sha256,
      createdAt: value.createdAt,
      updatedAt: value.updatedAt,
      status: value.status
    }
  };
}

function invalidIndex(detail: string): {
  readonly index: ProjectOpfsCacheIndex;
  readonly diagnostics: readonly ProjectOpfsCacheDiagnostic[];
} {
  return {
    index: createProjectOpfsCacheIndex([], new Date(0).toISOString()),
    diagnostics: [
      createProjectOpfsCacheDiagnostic("OPFS_INDEX_INVALID", "error", detail),
      createCacheIgnoredDiagnostic()
    ]
  };
}

function normalizeVersionSet(
  versions: ProjectOpfsCacheValidationOptions["supportedArtifactVersions"]
): ReadonlySet<string> | undefined {
  if (!versions) {
    return undefined;
  }

  return versions instanceof Set ? versions : new Set(versions);
}

function isSameSourceIdentity(
  left: WcadSourceIdentity,
  right: WcadSourceIdentity
): boolean {
  return left.algorithm === right.algorithm && left.sha256 === right.sha256;
}

function encodeCacheKeyPart(part: string): string {
  return encodeURIComponent(part);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSourceIdentity(value: unknown): value is WcadSourceIdentity {
  return (
    isRecord(value) &&
    value.algorithm === "partbench-source-v1" &&
    typeof value.sha256 === "string" &&
    value.sha256.length > 0
  );
}

function isArtifactKind(value: unknown): value is WcadPackageCacheArtifactKind {
  return (
    value === "derivedMesh" ||
    value === "derivedExactMetadata" ||
    value === "thumbnail" ||
    value === "packageUnpack" ||
    value === "exportIntermediate"
  );
}

function isDocumentSchemaVersion(
  value: unknown
): value is WcadDocumentSchemaVersion {
  return value === "web-cad.project.v16" || value === "web-cad.project.v17";
}

function isDocumentUnits(value: unknown): value is DocumentUnits {
  return value === "mm" || value === "cm" || value === "m" || value === "in";
}

function isCacheEntryStatus(
  value: unknown
): value is ProjectOpfsCacheEntryStatus {
  return (
    value === "valid" ||
    value === "stale" ||
    value === "unsupported" ||
    value === "corrupt"
  );
}

function isIsoLikeString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isPermissionError(error: unknown): boolean {
  return (
    typeof DOMException !== "undefined" &&
    error instanceof DOMException &&
    (error.name === "SecurityError" || error.name === "NotAllowedError")
  );
}

function isNotFoundError(error: unknown): boolean {
  return (
    typeof DOMException !== "undefined" &&
    error instanceof DOMException &&
    error.name === "NotFoundError"
  );
}

function getErrorDetail(error: unknown): string | undefined {
  return error instanceof Error ? error.message : undefined;
}

function getDiagnosticMessage(code: ProjectOpfsCacheDiagnosticCode): string {
  switch (code) {
    case "OPFS_UNAVAILABLE":
      return "OPFS is unavailable in this browser.";
    case "OPFS_PERMISSION_DENIED":
      return "OPFS permission or handle access was denied.";
    case "OPFS_HANDLE_FAILED":
      return "OPFS handle access failed.";
    case "OPFS_INDEX_MISSING":
      return "OPFS cache index is missing.";
    case "OPFS_INDEX_INVALID":
      return "OPFS cache index is invalid.";
    case "OPFS_STALE_SOURCE_IDENTITY":
      return "OPFS cache entry belongs to a stale source identity.";
    case "OPFS_UNSUPPORTED_ARTIFACT_VERSION":
      return "OPFS cache entry uses an unsupported artifact version.";
    case "OPFS_BYTE_LENGTH_MISMATCH":
      return "OPFS cache entry byte length does not match artifact metadata.";
    case "OPFS_HASH_MISMATCH":
      return "OPFS cache entry hash does not match artifact metadata.";
    case "OPFS_CLEAR_FAILED":
      return "OPFS cache clear failed.";
    case "OPFS_CACHE_IGNORED":
      return "Project load ignores OPFS cache and rebuilds derived artifacts when needed.";
  }
}
