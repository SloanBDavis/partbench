import {
  readCadProjectWcad,
  type CadProject,
  type WcadPackageExportResult,
  type WcadTopologyCheckpointPayloadInput
} from "@web-cad/cad-core";
import {
  CAD_TOPOLOGY_IDENTITY_PACKAGE_VERSION,
  WCAD_PACKAGE_VERSION,
  type WcadSourceIdentity
} from "@web-cad/cad-protocol";
import {
  clearCrashRecoveryMarker,
  readCrashRecoveryMarker,
  writeCrashRecoveryMarker,
  type CrashRecoveryMarkerStorage
} from "./projectCrashRecoveryMarker";
import {
  isRecoveryGenerationFileName,
  isSafeNonNegativeInteger,
  PROJECT_CRASH_RECOVERY_GENERATION_PREFIX,
  PROJECT_CRASH_RECOVERY_GENERATION_SUFFIX,
  PROJECT_CRASH_RECOVERY_LIMITS,
  PROJECT_CRASH_RECOVERY_RECORD_FILE_NAME,
  PROJECT_CRASH_RECOVERY_RECORD_VERSION,
  PROJECT_CRASH_RECOVERY_ROOT_NAME,
  PROJECT_OPFS_DERIVED_CACHE_ROOT_NAMES
} from "./projectCrashRecoveryLimits";
import {
  createCrashRecoveryOffer,
  createIdleCrashRecoveryStatus,
  createUnavailableCrashRecoveryStatus,
  type ProjectCrashRecoveryOffer,
  type ProjectCrashRecoveryPortability,
  type ProjectCrashRecoveryStatus
} from "./projectCrashRecoveryStatus";
import { preflightRecoveryWcadZip } from "./projectCrashRecoveryZipPreflight";
import {
  createProjectOpfsCacheSha256Hex,
  writeAndCloseProjectOpfsWritable,
  type ProjectOpfsCacheDirectoryHandleLike,
  type ProjectOpfsCacheTargetLike,
  type ProjectOpfsCacheWritableLike
} from "./projectOpfsCache";
import {
  createProjectPortabilityStatus,
  createWcadTopologyCheckpointPayloadInputCache
} from "./projectWcadWorkflow";

const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;
const SOURCE_IDENTITY_ALGORITHM = "partbench-source-v1";

export interface CrashRecoveryDirectoryHandle
  extends ProjectOpfsCacheDirectoryHandleLike {
  readonly keys?: () => AsyncIterableIterator<string>;
}

export type CrashRecoveryStorageTarget = ProjectOpfsCacheTargetLike;

export interface CrashRecoveryGenerationRecord {
  readonly version: typeof PROJECT_CRASH_RECOVERY_RECORD_VERSION;
  readonly current?: CrashRecoveryGenerationMeta;
  readonly previous?: CrashRecoveryGenerationMeta;
}

export interface CrashRecoveryGenerationMeta {
  readonly fileName: string;
  readonly byteLength: number;
  readonly sha256: string;
  readonly committedAt: string;
  readonly projectName: string;
  readonly sourceIdentity: WcadSourceIdentity;
  readonly units: string;
  readonly bodyCount: number;
  readonly portability: ProjectCrashRecoveryPortability;
}

export interface CrashRecoveryInspectResult {
  readonly status: ProjectCrashRecoveryStatus;
  readonly offer?: ProjectCrashRecoveryOffer;
  readonly record: CrashRecoveryGenerationRecord;
  readonly bytes?: Uint8Array;
  readonly checkpointPayloads?: readonly WcadTopologyCheckpointPayloadInput[];
}

export interface CrashRecoveryPublishInput {
  readonly exported: WcadPackageExportResult;
  readonly project: CadProject;
  readonly projectName: string;
  readonly committedAt: string;
  readonly expectedSourceIdentity: WcadSourceIdentity;
}

export interface CrashRecoveryPublishResult {
  readonly status: ProjectCrashRecoveryStatus;
  readonly published: boolean;
}

export function sameSourceIdentity(
  left: WcadSourceIdentity,
  right: WcadSourceIdentity
): boolean {
  return left.algorithm === right.algorithm && left.sha256 === right.sha256;
}

export function countProjectBodies(project: CadProject): number {
  const objects = project.document.objects.length;
  const features = project.document.features.length;
  if (
    !isSafeNonNegativeInteger(objects) ||
    !isSafeNonNegativeInteger(features)
  ) {
    return 0;
  }
  const total = objects + features;
  return isSafeNonNegativeInteger(total) ? total : 0;
}

export async function inspectCrashRecovery(
  target: CrashRecoveryStorageTarget,
  storage?: CrashRecoveryMarkerStorage
): Promise<CrashRecoveryInspectResult> {
  const marker = readCrashRecoveryMarker(storage);
  if (!marker.indicated) {
    return {
      status: createIdleCrashRecoveryStatus(),
      record: { version: PROJECT_CRASH_RECOVERY_RECORD_VERSION }
    };
  }

  const rootResult = await getCrashRecoveryRoot(target, false);
  if (!rootResult.ok) {
    if (rootResult.code === "missing") {
      clearCrashRecoveryMarker(storage);
      return {
        status: createIdleCrashRecoveryStatus(),
        record: { version: PROJECT_CRASH_RECOVERY_RECORD_VERSION }
      };
    }
    return {
      status: createUnavailableCrashRecoveryStatus(rootResult.message),
      record: { version: PROJECT_CRASH_RECOVERY_RECORD_VERSION }
    };
  }

  try {
    await cleanupUnpublishedGenerations(rootResult.root);
    const record = await readGenerationRecord(rootResult.root);
    const current = record.current;
    if (!current) {
      clearCrashRecoveryMarker(storage);
      return {
        status: createIdleCrashRecoveryStatus(),
        record
      };
    }
    const validated = await readAndValidateGeneration(rootResult.root, current);
    if (!validated.ok) {
      return {
        status: {
          state: "failed",
          available: true,
          lastResult: validated.message
        },
        record
      };
    }
    const offer = createCrashRecoveryOffer({
      projectName: current.projectName,
      committedAt: current.committedAt,
      sourceIdentity: current.sourceIdentity,
      units: current.units,
      bodyCount: current.bodyCount,
      portability: current.portability
    });
    return {
      status: {
        state: "current",
        available: true,
        lastResult: `Last captured revision: ${offer.capturedRevisionSummary}.`,
        offer
      },
      offer,
      record,
      bytes: validated.bytes,
      checkpointPayloads: validated.checkpointPayloads
    };
  } catch (error) {
    return {
      status: {
        state: "failed",
        available: true,
        lastResult:
          error instanceof Error
            ? error.message
            : "Crash recovery data could not be read."
      },
      record: { version: PROJECT_CRASH_RECOVERY_RECORD_VERSION }
    };
  }
}

export async function publishCrashRecoveryGeneration(
  target: CrashRecoveryStorageTarget,
  input: CrashRecoveryPublishInput,
  storage?: CrashRecoveryMarkerStorage
): Promise<CrashRecoveryPublishResult> {
  const bytes = input.exported.bytes;
  if (
    !isSafeNonNegativeInteger(bytes.byteLength) ||
    bytes.byteLength > PROJECT_CRASH_RECOVERY_LIMITS.generationBytes
  ) {
    return {
      published: false,
      status: {
        state: "failed",
        available: true,
        lastResult: "Recovery package exceeds the 512 MiB generation limit."
      }
    };
  }

  const preflight = preflightRecoveryWcadZip(bytes);
  if (!preflight.ok) {
    return {
      published: false,
      status: {
        state: "failed",
        available: true,
        lastResult: preflight.message
      }
    };
  }

  if (
    !sameSourceIdentity(
      input.exported.sourceIdentity,
      input.expectedSourceIdentity
    )
  ) {
    return {
      published: false,
      status: {
        state: "failed",
        available: true,
        lastResult: "Recovery write was skipped because the project changed."
      }
    };
  }

  const rootResult = await getCrashRecoveryRoot(target, true);
  if (!rootResult.ok) {
    return {
      published: false,
      status: createUnavailableCrashRecoveryStatus(rootResult.message)
    };
  }

  const fileName = createGenerationFileName();
  let writable: ProjectOpfsCacheWritableLike | undefined;
  try {
    await cleanupUnpublishedGenerations(rootResult.root);
    const existing = await readGenerationRecord(rootResult.root);
    const sha256 = await createProjectOpfsCacheSha256Hex(bytes);
    const handle = await rootResult.root.getFileHandle(fileName, {
      create: true
    });
    if (typeof handle.createWritable !== "function") {
      throw new Error("Crash recovery storage cannot create a writable file.");
    }
    writable = await handle.createWritable();
    await writeAndCloseProjectOpfsWritable(writable, bytes);
    writable = undefined;

    const readBack = await readGenerationBytes(rootResult.root, fileName);
    const readPreflight = preflightRecoveryWcadZip(readBack);
    if (!readPreflight.ok) {
      await removeEntryQuietly(rootResult.root, fileName);
      return {
        published: false,
        status: {
          state: "failed",
          available: true,
          lastResult: readPreflight.message
        }
      };
    }
    const readHash = await createProjectOpfsCacheSha256Hex(readBack);
    if (readHash !== sha256 || readBack.byteLength !== bytes.byteLength) {
      await removeEntryQuietly(rootResult.root, fileName);
      return {
        published: false,
        status: {
          state: "failed",
          available: true,
          lastResult: "Recovery snapshot hash did not match after write."
        }
      };
    }

    const read = await readCadProjectWcad(readBack);
    if (!read.ok) {
      await removeEntryQuietly(rootResult.root, fileName);
      const issue = read.issues.find((candidate) => candidate.severity === "error");
      return {
        published: false,
        status: {
          state: "failed",
          available: true,
          lastResult: issue
            ? `${issue.code}: ${issue.message}`
            : "Recovery snapshot is not a valid .wcad package."
        }
      };
    }
    if (!isSupportedRecoveryPackageVersion(read.manifest.packageVersion)) {
      await removeEntryQuietly(rootResult.root, fileName);
      return {
        published: false,
        status: {
          state: "failed",
          available: true,
          lastResult: "Recovery snapshot is not a supported .wcad package."
        }
      };
    }
    if (
      !sameSourceIdentity(read.sourceIdentity, input.expectedSourceIdentity)
    ) {
      await removeEntryQuietly(rootResult.root, fileName);
      return {
        published: false,
        status: {
          state: "failed",
          available: true,
          lastResult: "Recovery snapshot source identity does not match the live project."
        }
      };
    }

    const portability = createProjectPortabilityStatus(
      read.project,
      createWcadTopologyCheckpointPayloadInputCache(read.checkpointPayloads)
    ).status;
    const meta: CrashRecoveryGenerationMeta = {
      fileName,
      byteLength: bytes.byteLength,
      sha256,
      committedAt: input.committedAt,
      projectName: input.projectName,
      sourceIdentity: input.expectedSourceIdentity,
      units: input.project.document.units,
      bodyCount: countProjectBodies(input.project),
      portability
    };
    const bothBytes =
      meta.byteLength + (existing.current?.byteLength ?? 0);
    if (
      !isSafeNonNegativeInteger(bothBytes) ||
      bothBytes > PROJECT_CRASH_RECOVERY_LIMITS.bothGenerationsBytes
    ) {
      await removeEntryQuietly(rootResult.root, fileName);
      return {
        published: false,
        status: {
          state: "failed",
          available: true,
          lastResult: "Recovery snapshots exceed the 1 GiB combined limit."
        }
      };
    }

    const nextRecord: CrashRecoveryGenerationRecord = {
      version: PROJECT_CRASH_RECOVERY_RECORD_VERSION,
      current: meta,
      ...(existing.current ? { previous: existing.current } : {})
    };
    await writeGenerationRecord(rootResult.root, nextRecord);
    writeCrashRecoveryMarker(storage);
    if (existing.previous && existing.previous.fileName !== meta.fileName) {
      await removeEntryQuietly(rootResult.root, existing.previous.fileName);
    }
    await cleanupUnpublishedGenerations(rootResult.root);
    const offer = createCrashRecoveryOffer({
      projectName: meta.projectName,
      committedAt: meta.committedAt,
      sourceIdentity: meta.sourceIdentity,
      units: meta.units,
      bodyCount: meta.bodyCount,
      portability: meta.portability
    });
    return {
      published: true,
      status: {
        state: "current",
        available: true,
        lastResult: `Last captured revision: ${offer.capturedRevisionSummary}.`,
        offer
      }
    };
  } catch (error) {
    try {
      await writable?.abort?.();
    } catch {
      // Preserve the original write failure.
    }
    await removeEntryQuietly(rootResult.root, fileName);
    const inspected = await inspectCrashRecovery(target, storage);
    const unavailable = isQuotaOrPermissionError(error);
    return {
      published: false,
      status: {
        state: unavailable ? "unavailable" : "failed",
        available: inspected.status.available,
        lastResult: formatWriteFailure(error, inspected),
        ...(inspected.offer ? { offer: inspected.offer } : {})
      }
    };
  }
}

export async function readCrashRecoveryCurrentBytes(
  target: CrashRecoveryStorageTarget,
  storage?: CrashRecoveryMarkerStorage
): Promise<
  | {
      readonly ok: true;
      readonly bytes: Uint8Array;
      readonly offer: ProjectCrashRecoveryOffer;
      readonly checkpointPayloads: readonly WcadTopologyCheckpointPayloadInput[];
    }
  | { readonly ok: false; readonly status: ProjectCrashRecoveryStatus }
> {
  const inspected = await inspectCrashRecovery(target, storage);
  if (!inspected.bytes || !inspected.offer || !inspected.checkpointPayloads) {
    return { ok: false, status: inspected.status };
  }
  return {
    ok: true,
    bytes: inspected.bytes,
    offer: inspected.offer,
    checkpointPayloads: inspected.checkpointPayloads
  };
}

export async function clearCrashRecovery(
  target: CrashRecoveryStorageTarget,
  storage?: CrashRecoveryMarkerStorage
): Promise<ProjectCrashRecoveryStatus> {
  const storageApi = target.navigator?.storage;
  const getDirectory = storageApi?.getDirectory;
  if (typeof getDirectory !== "function") {
    clearCrashRecoveryMarker(storage);
    return createUnavailableCrashRecoveryStatus(
      "Crash recovery is unavailable in this browser."
    );
  }
  try {
    const originRoot = (await getDirectory.call(
      storageApi
    )) as CrashRecoveryDirectoryHandle;
    await originRoot.removeEntry(PROJECT_CRASH_RECOVERY_ROOT_NAME, {
      recursive: true
    });
    await assertDerivedCachesUntouched(originRoot);
    clearCrashRecoveryMarker(storage);
    return createIdleCrashRecoveryStatus("Crash recovery data cleared.");
  } catch (error) {
    if (isNotFoundError(error)) {
      clearCrashRecoveryMarker(storage);
      return createIdleCrashRecoveryStatus("Crash recovery data cleared.");
    }
    return {
      state: "failed",
      available: true,
      lastResult:
        error instanceof Error
          ? error.message
          : "Could not clear crash recovery data."
    };
  }
}

export async function clearCrashRecoveryIfSourceMatches(
  target: CrashRecoveryStorageTarget,
  liveIdentity: WcadSourceIdentity,
  storage?: CrashRecoveryMarkerStorage
): Promise<ProjectCrashRecoveryStatus> {
  const inspected = await inspectCrashRecovery(target, storage);
  const current = inspected.record.current;
  if (!current) {
    return inspected.status;
  }
  if (!sameSourceIdentity(current.sourceIdentity, liveIdentity)) {
    return inspected.status;
  }
  return clearCrashRecovery(target, storage);
}

async function getCrashRecoveryRoot(
  target: CrashRecoveryStorageTarget,
  create: boolean
): Promise<
  | { readonly ok: true; readonly root: CrashRecoveryDirectoryHandle }
  | {
      readonly ok: false;
      readonly code: "unavailable" | "missing" | "denied" | "failed";
      readonly message: string;
    }
> {
  const storage = target.navigator?.storage;
  const getDirectory = storage?.getDirectory;
  if (typeof getDirectory !== "function") {
    return {
      ok: false,
      code: "unavailable",
      message: "Crash recovery is unavailable in this browser."
    };
  }
  try {
    const originRoot = (await getDirectory.call(
      storage
    )) as CrashRecoveryDirectoryHandle;
    const root = (await originRoot.getDirectoryHandle(
      PROJECT_CRASH_RECOVERY_ROOT_NAME,
      { create }
    )) as CrashRecoveryDirectoryHandle;
    return { ok: true, root };
  } catch (error) {
    if (!create && isNotFoundError(error)) {
      return {
        ok: false,
        code: "missing",
        message: "No crash recovery snapshot is stored."
      };
    }
    if (isPermissionError(error)) {
      return {
        ok: false,
        code: "denied",
        message: "Crash recovery storage permission was denied."
      };
    }
    if (isQuotaOrPermissionError(error)) {
      return {
        ok: false,
        code: "denied",
        message: "Crash recovery storage is full."
      };
    }
    return {
      ok: false,
      code: "failed",
      message:
        error instanceof Error
          ? error.message
          : "Crash recovery storage could not be opened."
    };
  }
}

async function readGenerationRecord(
  root: CrashRecoveryDirectoryHandle
): Promise<CrashRecoveryGenerationRecord> {
  try {
    const handle = await root.getFileHandle(
      PROJECT_CRASH_RECOVERY_RECORD_FILE_NAME
    );
    const file = await handle.getFile();
    const text = await file.text();
    if (text.length > PROJECT_CRASH_RECOVERY_LIMITS.recordBytes) {
      return { version: PROJECT_CRASH_RECOVERY_RECORD_VERSION };
    }
    const parsed: unknown = JSON.parse(text);
    return parseGenerationRecord(parsed);
  } catch {
    return { version: PROJECT_CRASH_RECOVERY_RECORD_VERSION };
  }
}

async function writeGenerationRecord(
  root: CrashRecoveryDirectoryHandle,
  record: CrashRecoveryGenerationRecord
): Promise<void> {
  const json = JSON.stringify(record);
  if (json.length > PROJECT_CRASH_RECOVERY_LIMITS.recordBytes) {
    throw new RangeError("Recovery generation record exceeds 64 KiB.");
  }
  const handle = await root.getFileHandle(
    PROJECT_CRASH_RECOVERY_RECORD_FILE_NAME,
    { create: true }
  );
  if (typeof handle.createWritable !== "function") {
    throw new Error("Crash recovery storage cannot create a writable file.");
  }
  const writable = await handle.createWritable();
  await writeAndCloseProjectOpfsWritable(writable, json);
}

async function readAndValidateGeneration(
  root: CrashRecoveryDirectoryHandle,
  meta: CrashRecoveryGenerationMeta
): Promise<
  | {
      readonly ok: true;
      readonly bytes: Uint8Array;
      readonly checkpointPayloads: readonly WcadTopologyCheckpointPayloadInput[];
    }
  | { readonly ok: false; readonly message: string }
> {
  try {
    const bytes = await readGenerationBytes(root, meta.fileName);
    if (bytes.byteLength !== meta.byteLength) {
      return {
        ok: false,
        message: "Stored recovery snapshot length does not match its record."
      };
    }
    const preflight = preflightRecoveryWcadZip(bytes);
    if (!preflight.ok) {
      return { ok: false, message: preflight.message };
    }
    const sha256 = await createProjectOpfsCacheSha256Hex(bytes);
    if (sha256 !== meta.sha256) {
      return {
        ok: false,
        message: "Stored recovery snapshot hash does not match its record."
      };
    }
    const read = await readCadProjectWcad(bytes);
    if (!read.ok) {
      const issue = read.issues.find(
        (candidate) => candidate.severity === "error"
      );
      return {
        ok: false,
        message: issue
          ? `${issue.code}: ${issue.message}`
          : "Stored recovery snapshot is not a valid .wcad package."
      };
    }
    if (
      !isSupportedRecoveryPackageVersion(read.manifest.packageVersion) ||
      !sameSourceIdentity(read.sourceIdentity, meta.sourceIdentity)
    ) {
      return {
        ok: false,
        message: "Stored recovery snapshot failed source or package validation."
      };
    }
    return {
      ok: true,
      bytes,
      checkpointPayloads: createWcadTopologyCheckpointPayloadInputCache(
        read.checkpointPayloads
      )
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Stored recovery snapshot could not be read."
    };
  }
}

async function readGenerationBytes(
  root: CrashRecoveryDirectoryHandle,
  fileName: string
): Promise<Uint8Array> {
  const handle = await root.getFileHandle(fileName);
  const file = await handle.getFile();
  if (typeof file.arrayBuffer === "function") {
    return new Uint8Array(await file.arrayBuffer());
  }
  const text = await file.text();
  return new TextEncoder().encode(text);
}

async function cleanupUnpublishedGenerations(
  root: CrashRecoveryDirectoryHandle
): Promise<void> {
  const record = await readGenerationRecord(root);
  const keep = new Set(
    [record.current?.fileName, record.previous?.fileName].filter(
      (name): name is string => typeof name === "string"
    )
  );
  keep.add(PROJECT_CRASH_RECOVERY_RECORD_FILE_NAME);
  const names = await listDirectoryNames(root);
  for (const name of names) {
    if (keep.has(name)) {
      continue;
    }
    if (
      name === PROJECT_CRASH_RECOVERY_RECORD_FILE_NAME ||
      isRecoveryGenerationFileName(name)
    ) {
      await removeEntryQuietly(root, name);
    }
  }
}

async function listDirectoryNames(
  root: CrashRecoveryDirectoryHandle
): Promise<readonly string[]> {
  if (typeof root.keys !== "function") {
    const record = await readGenerationRecord(root);
    return [
      PROJECT_CRASH_RECOVERY_RECORD_FILE_NAME,
      ...(record.current ? [record.current.fileName] : []),
      ...(record.previous ? [record.previous.fileName] : [])
    ];
  }
  const names: string[] = [];
  for await (const name of root.keys()) {
    names.push(name);
  }
  return names;
}

async function removeEntryQuietly(
  root: CrashRecoveryDirectoryHandle,
  name: string
): Promise<void> {
  try {
    await root.removeEntry(name);
  } catch {
    // Unpublished or already-removed files are not fatal.
  }
}

async function assertDerivedCachesUntouched(
  originRoot: CrashRecoveryDirectoryHandle
): Promise<void> {
  for (const name of PROJECT_OPFS_DERIVED_CACHE_ROOT_NAMES) {
    try {
      await originRoot.getDirectoryHandle(name);
    } catch {
      // Absence is fine; presence must remain after recovery clear.
    }
  }
}

function parseGenerationRecord(value: unknown): CrashRecoveryGenerationRecord {
  if (!isRecord(value) || value.version !== PROJECT_CRASH_RECOVERY_RECORD_VERSION) {
    return { version: PROJECT_CRASH_RECOVERY_RECORD_VERSION };
  }
  const current = parseGenerationMeta(value.current);
  const previous = parseGenerationMeta(value.previous);
  return {
    version: PROJECT_CRASH_RECOVERY_RECORD_VERSION,
    ...(current ? { current } : {}),
    ...(previous ? { previous } : {})
  };
}

function parseGenerationMeta(value: unknown): CrashRecoveryGenerationMeta | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const sourceIdentity = value.sourceIdentity;
  if (
    typeof value.fileName !== "string" ||
    !isRecoveryGenerationFileName(value.fileName) ||
    !isSafeNonNegativeInteger(value.byteLength) ||
    value.byteLength > PROJECT_CRASH_RECOVERY_LIMITS.generationBytes ||
    typeof value.sha256 !== "string" ||
    !SHA256_HEX_PATTERN.test(value.sha256) ||
    typeof value.committedAt !== "string" ||
    typeof value.projectName !== "string" ||
    !isSourceIdentity(sourceIdentity) ||
    typeof value.units !== "string" ||
    !isSafeNonNegativeInteger(value.bodyCount) ||
    !isPortability(value.portability)
  ) {
    return undefined;
  }
  return {
    fileName: value.fileName,
    byteLength: value.byteLength,
    sha256: value.sha256,
    committedAt: value.committedAt,
    projectName: value.projectName,
    sourceIdentity,
    units: value.units,
    bodyCount: value.bodyCount,
    portability: value.portability
  };
}

function isSupportedRecoveryPackageVersion(value: unknown): boolean {
  return (
    value === CAD_TOPOLOGY_IDENTITY_PACKAGE_VERSION ||
    value === WCAD_PACKAGE_VERSION
  );
}

function isSourceIdentity(value: unknown): value is WcadSourceIdentity {
  return (
    isRecord(value) &&
    value.algorithm === SOURCE_IDENTITY_ALGORITHM &&
    typeof value.sha256 === "string" &&
    SHA256_HEX_PATTERN.test(value.sha256)
  );
}

function isPortability(value: unknown): value is ProjectCrashRecoveryPortability {
  return (
    value === "portable-json" ||
    value === "wcad-required" ||
    value === "payload-missing"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function createGenerationFileName(): string {
  const id =
    globalThis.crypto && typeof globalThis.crypto.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
  return `${PROJECT_CRASH_RECOVERY_GENERATION_PREFIX}${id}${PROJECT_CRASH_RECOVERY_GENERATION_SUFFIX}`;
}

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { readonly name?: unknown }).name === "NotFoundError"
  );
}

function isPermissionError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { readonly name?: unknown }).name === "NotAllowedError"
  );
}

function isQuotaOrPermissionError(error: unknown): boolean {
  if (isPermissionError(error)) {
    return true;
  }
  const name =
    typeof error === "object" && error !== null && "name" in error
      ? (error as { readonly name?: unknown }).name
      : undefined;
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return (
    name === "QuotaExceededError" ||
    message.includes("quota") ||
    message.includes("permission")
  );
}

function formatWriteFailure(
  error: unknown,
  inspected: CrashRecoveryInspectResult
): string {
  if (isQuotaOrPermissionError(error)) {
    return inspected.offer
      ? "Crash recovery could not be updated. The previous snapshot remains."
      : "Crash recovery is unavailable because browser storage is full or denied.";
  }
  return inspected.offer
    ? "Crash recovery write failed. The previous snapshot remains."
    : error instanceof Error
      ? error.message
      : "Crash recovery write failed.";
}

