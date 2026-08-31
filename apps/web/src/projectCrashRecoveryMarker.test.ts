import { describe, expect, it } from "vitest";
import {
  clearCrashRecoveryMarker,
  readCrashRecoveryMarker,
  writeCrashRecoveryMarker
} from "./projectCrashRecoveryMarker";
import { PROJECT_CRASH_RECOVERY_LIMITS } from "./projectCrashRecoveryLimits";

function createMemoryStorage(
  initial: Record<string, string> = {}
): Storage {
  const map = new Map(Object.entries(initial));
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key) {
      return map.has(key) ? map.get(key)! : null;
    },
    key(index) {
      return [...map.keys()][index] ?? null;
    },
    removeItem(key) {
      map.delete(key);
    },
    setItem(key, value) {
      map.set(key, value);
    }
  };
}

describe("V22 recovery local marker", () => {
  it("does not indicate recovery when the marker is absent", () => {
    expect(readCrashRecoveryMarker(createMemoryStorage())).toEqual({
      indicated: false,
      reason: "absent"
    });
    expect(readCrashRecoveryMarker(undefined)).toEqual({
      indicated: false,
      reason: "absent"
    });
  });

  it("treats oversized or corrupt markers as untrusted and not restorative", () => {
    const storage = createMemoryStorage({
      "partbench.crash-recovery.marker.v1": "not-json"
    });
    expect(readCrashRecoveryMarker(storage)).toEqual({
      indicated: false,
      reason: "corrupt"
    });
    const oversized = createMemoryStorage({
      "partbench.crash-recovery.marker.v1": "x".repeat(
        PROJECT_CRASH_RECOVERY_LIMITS.markerBytes + 1
      )
    });
    expect(readCrashRecoveryMarker(oversized)).toEqual({
      indicated: false,
      reason: "corrupt"
    });
  });

  it("writes a bounded marker that can be cleared", () => {
    const storage = createMemoryStorage();
    expect(writeCrashRecoveryMarker(storage)).toBe(true);
    expect(readCrashRecoveryMarker(storage)).toEqual({ indicated: true });
    const raw = storage.getItem("partbench.crash-recovery.marker.v1") ?? "";
    expect(raw.length).toBeLessThanOrEqual(
      PROJECT_CRASH_RECOVERY_LIMITS.markerBytes
    );
    expect(raw).not.toMatch(/g-|\.wcad|opfs|fileHandle/i);
    clearCrashRecoveryMarker(storage);
    expect(readCrashRecoveryMarker(storage)).toEqual({
      indicated: false,
      reason: "absent"
    });
  });
});
