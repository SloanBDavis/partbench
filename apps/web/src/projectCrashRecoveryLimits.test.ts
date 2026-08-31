import { describe, expect, it } from "vitest";
import {
  PROJECT_CRASH_RECOVERY_LIMITS,
  PROJECT_CRASH_RECOVERY_ROOT_NAME,
  PROJECT_OPFS_DERIVED_CACHE_ROOT_NAMES,
  isSafeNonNegativeInteger
} from "./projectCrashRecoveryLimits";

const MIB = 1024 * 1024;

describe("V22 recovery frozen limits", () => {
  it("freezes one project, two generations, and the published byte/count caps", () => {
    expect(PROJECT_CRASH_RECOVERY_LIMITS.projects).toBe(1);
    expect(PROJECT_CRASH_RECOVERY_LIMITS.generations).toBe(2);
    expect(PROJECT_CRASH_RECOVERY_LIMITS.generationBytes).toBe(512 * MIB);
    expect(PROJECT_CRASH_RECOVERY_LIMITS.bothGenerationsBytes).toBe(1024 * MIB);
    expect(PROJECT_CRASH_RECOVERY_LIMITS.zipEntryBytes).toBe(128 * MIB);
    expect(PROJECT_CRASH_RECOVERY_LIMITS.zipEntries).toBe(12_300);
    expect(PROJECT_CRASH_RECOVERY_LIMITS.recordBytes).toBe(64 * 1024);
    expect(PROJECT_CRASH_RECOVERY_LIMITS.markerBytes).toBe(4 * 1024);
    expect(
      Object.values(PROJECT_CRASH_RECOVERY_LIMITS).every(isSafeNonNegativeInteger)
    ).toBe(true);
  });

  it("keeps recovery in a third OPFS namespace distinct from both derived caches", () => {
    expect(PROJECT_OPFS_DERIVED_CACHE_ROOT_NAMES).toEqual([
      "partbench-v8-cache",
      "partbench-exact-artifact-v1"
    ]);
    expect(PROJECT_CRASH_RECOVERY_ROOT_NAME).toBe("partbench-crash-recovery-v1");
    expect(PROJECT_OPFS_DERIVED_CACHE_ROOT_NAMES).not.toContain(
      PROJECT_CRASH_RECOVERY_ROOT_NAME
    );
  });
});
