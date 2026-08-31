import {
  PROJECT_CRASH_RECOVERY_LIMITS,
  isSafeNonNegativeInteger
} from "./projectCrashRecoveryLimits";

const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_DIRECTORY_HEADER_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const EOCD_MIN_BYTES = 22;
const CENTRAL_HEADER_MIN_BYTES = 46;

export type RecoveryZipPreflightCode =
  | "RECOVERY_PACKAGE_TOO_LARGE"
  | "RECOVERY_ZIP_ENTRY_TOO_LARGE"
  | "RECOVERY_ZIP_ENTRY_COUNT"
  | "RECOVERY_ZIP_INVALID";

export interface RecoveryZipPreflightFailure {
  readonly ok: false;
  readonly code: RecoveryZipPreflightCode;
  readonly message: string;
}

export interface RecoveryZipPreflightSuccess {
  readonly ok: true;
  readonly entryCount: number;
  readonly byteLength: number;
}

export type RecoveryZipPreflightResult =
  | RecoveryZipPreflightSuccess
  | RecoveryZipPreflightFailure;

/**
 * V22 byte/count ZIP preflight. Runs before the ordinary `.wcad` reader so
 * oversized or corrupt recovery packages never reach full ZIP inflation.
 */
export function preflightRecoveryWcadZip(
  bytes: Uint8Array
): RecoveryZipPreflightResult {
  const byteLength = bytes.byteLength;
  if (
    !isSafeNonNegativeInteger(byteLength) ||
    byteLength > PROJECT_CRASH_RECOVERY_LIMITS.generationBytes
  ) {
    return fail(
      "RECOVERY_PACKAGE_TOO_LARGE",
      "Recovery package exceeds the 512 MiB generation limit."
    );
  }
  if (byteLength < EOCD_MIN_BYTES) {
    return fail(
      "RECOVERY_ZIP_INVALID",
      "Recovery package is too small to be a ZIP archive."
    );
  }

  const endOffset = findEndOfCentralDirectory(bytes);
  if (endOffset === -1) {
    return fail(
      "RECOVERY_ZIP_INVALID",
      "Recovery package is not a readable ZIP archive."
    );
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const entryCount = view.getUint16(endOffset + 10, true);
  const centralDirectorySize = view.getUint32(endOffset + 12, true);
  const centralDirectoryOffset = view.getUint32(endOffset + 16, true);

  if (
    !isSafeNonNegativeInteger(entryCount) ||
    entryCount > PROJECT_CRASH_RECOVERY_LIMITS.zipEntries
  ) {
    return fail(
      "RECOVERY_ZIP_ENTRY_COUNT",
      "Recovery package has too many ZIP entries."
    );
  }
  if (
    !isSafeNonNegativeInteger(centralDirectorySize) ||
    !isSafeNonNegativeInteger(centralDirectoryOffset) ||
    centralDirectoryOffset + centralDirectorySize > byteLength ||
    centralDirectoryOffset + centralDirectorySize !== endOffset
  ) {
    return fail(
      "RECOVERY_ZIP_INVALID",
      "Recovery package central directory is outside the archive bounds."
    );
  }

  let cursor = centralDirectoryOffset;
  const centralEnd = centralDirectoryOffset + centralDirectorySize;
  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + CENTRAL_HEADER_MIN_BYTES > centralEnd) {
      return fail(
        "RECOVERY_ZIP_INVALID",
        "Recovery package central directory ended before all entries were read."
      );
    }
    if (view.getUint32(cursor, true) !== CENTRAL_DIRECTORY_HEADER_SIGNATURE) {
      return fail(
        "RECOVERY_ZIP_INVALID",
        "Recovery package central directory entry is malformed."
      );
    }
    const compressedSize = view.getUint32(cursor + 20, true);
    const uncompressedSize = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localHeaderOffset = view.getUint32(cursor + 42, true);
    if (
      exceedsZipEntryLimit(compressedSize) ||
      exceedsZipEntryLimit(uncompressedSize)
    ) {
      return fail(
        "RECOVERY_ZIP_ENTRY_TOO_LARGE",
        "A recovery ZIP entry exceeds the 128 MiB limit."
      );
    }
    if (
      !isSafeNonNegativeInteger(localHeaderOffset) ||
      localHeaderOffset + 30 > byteLength
    ) {
      return fail(
        "RECOVERY_ZIP_INVALID",
        "Recovery package local file header is outside the archive bounds."
      );
    }
    if (view.getUint32(localHeaderOffset, true) !== LOCAL_FILE_HEADER_SIGNATURE) {
      return fail(
        "RECOVERY_ZIP_INVALID",
        "Recovery package local file header is malformed."
      );
    }
    cursor +=
      CENTRAL_HEADER_MIN_BYTES + nameLength + extraLength + commentLength;
    if (cursor > centralEnd) {
      return fail(
        "RECOVERY_ZIP_INVALID",
        "Recovery package central directory entry overruns the directory."
      );
    }
  }

  return { ok: true, entryCount, byteLength };
}

function exceedsZipEntryLimit(size: number): boolean {
  return (
    !isSafeNonNegativeInteger(size) ||
    size > PROJECT_CRASH_RECOVERY_LIMITS.zipEntryBytes
  );
}

function findEndOfCentralDirectory(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const maxComment = Math.min(0xffff, bytes.byteLength - EOCD_MIN_BYTES);
  for (let comment = 0; comment <= maxComment; comment += 1) {
    const offset = bytes.byteLength - EOCD_MIN_BYTES - comment;
    if (view.getUint32(offset, true) === END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
      if (view.getUint16(offset + 20, true) === comment) {
        return offset;
      }
    }
  }
  return -1;
}

function fail(
  code: RecoveryZipPreflightCode,
  message: string
): RecoveryZipPreflightFailure {
  return { ok: false, code, message };
}
