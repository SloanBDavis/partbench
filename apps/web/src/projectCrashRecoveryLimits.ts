/** Frozen V22 recovery byte/count limits. Keep in lockstep with docs/v22.md. */

const MIB = 1024 * 1024;

export const PROJECT_CRASH_RECOVERY_ROOT_NAME = "partbench-crash-recovery-v1";
export const PROJECT_CRASH_RECOVERY_RECORD_FILE_NAME = "record.json";
export const PROJECT_CRASH_RECOVERY_MARKER_STORAGE_KEY =
  "partbench.crash-recovery.marker.v1";
export const PROJECT_CRASH_RECOVERY_MARKER_VERSION =
  "partbench.crash-recovery.marker.v1";
export const PROJECT_CRASH_RECOVERY_RECORD_VERSION =
  "partbench.crash-recovery.record.v1";
export const PROJECT_CRASH_RECOVERY_GENERATION_PREFIX = "g-";
export const PROJECT_CRASH_RECOVERY_GENERATION_SUFFIX = ".wcad";

export const PROJECT_CRASH_RECOVERY_LIMITS = {
  projects: 1,
  generations: 2,
  generationBytes: 512 * MIB,
  bothGenerationsBytes: 1024 * MIB,
  zipEntryBytes: 128 * MIB,
  zipEntries: 12_300,
  recordBytes: 64 * 1024,
  markerBytes: 4 * 1024,
  coalesceMs: 400
} as const;

export const PROJECT_OPFS_DERIVED_CACHE_ROOT_NAMES = [
  "partbench-v8-cache",
  "partbench-exact-artifact-v1"
] as const;

export function isSafeNonNegativeInteger(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
  );
}

export function assertSafeBoundedCount(
  value: unknown,
  max: number,
  label: string
): number {
  if (!isSafeNonNegativeInteger(value) || value > max) {
    throw new RangeError(
      `${label} must be a safe integer between 0 and ${max}.`
    );
  }
  return value;
}

export function isRecoveryGenerationFileName(name: string): boolean {
  return (
    name.startsWith(PROJECT_CRASH_RECOVERY_GENERATION_PREFIX) &&
    name.endsWith(PROJECT_CRASH_RECOVERY_GENERATION_SUFFIX) &&
    name.length > PROJECT_CRASH_RECOVERY_GENERATION_PREFIX.length +
      PROJECT_CRASH_RECOVERY_GENERATION_SUFFIX.length &&
    !name.includes("/") &&
    !name.includes("\\")
  );
}
