import { describe, expect, it } from "vitest";
import {
  inspectLazyCrashRecovery,
  peekCrashRecoveryMarker
} from "./projectCrashRecoveryLazy";
import { writeCrashRecoveryMarker } from "./projectCrashRecoveryMarker";

class MemoryStorage implements Storage {
  private readonly map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
}

describe("V22 lazy recovery inspect", () => {
  it("peeks the marker without opening OPFS", () => {
    const storage = new MemoryStorage();
    expect(peekCrashRecoveryMarker(storage)).toEqual({
      indicated: false,
      reason: "absent"
    });
    writeCrashRecoveryMarker(storage);
    expect(peekCrashRecoveryMarker(storage)).toEqual({ indicated: true });
  });

  it("does not load the recovery store when the marker is absent", async () => {
    let loaded = false;
    const result = await inspectLazyCrashRecovery(
      {},
      new MemoryStorage(),
      async () => {
        loaded = true;
        throw new Error("store should stay unloaded");
      }
    );
    expect(loaded).toBe(false);
    expect(result.openedOpfs).toBe(false);
    expect(result.status.state).toBe("idle");
  });

  it("loads the store only after the marker indicates recovery metadata", async () => {
    const storage = new MemoryStorage();
    writeCrashRecoveryMarker(storage);
    let loaded = false;
    const result = await inspectLazyCrashRecovery({}, storage, async () => {
      loaded = true;
      return {
        inspectCrashRecovery: async () => ({
          status: {
            state: "current" as const,
            available: true,
            lastResult: "Last captured revision: bracket.wcad · Source ab12cd34."
          },
          record: { version: "partbench.crash-recovery.record.v1" as const }
        })
      } as unknown as typeof import("./projectCrashRecoveryStore");
    });
    expect(loaded).toBe(true);
    expect(result.openedOpfs).toBe(true);
    expect(result.status.state).toBe("current");
  });
});
