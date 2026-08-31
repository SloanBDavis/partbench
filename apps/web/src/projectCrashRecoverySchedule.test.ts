import { CadEngine } from "@web-cad/cad-core";
import { describe, expect, it, vi } from "vitest";
import { createCrashRecoveryScheduler } from "./projectCrashRecoverySchedule";
import type { CrashRecoveryPublishResult } from "./projectCrashRecoveryStore";

function snapshot(dirty: boolean, sha = "a".repeat(64)) {
  return {
    dirty,
    project: new CadEngine().exportProject(),
    projectName: "bracket.wcad",
    sourceIdentity: {
      algorithm: "partbench-source-v1" as const,
      sha256: sha
    }
  };
}

describe("V22 recovery scheduler", () => {
  it("does not schedule a write for a clean project", async () => {
    let exported = 0;
    const scheduler = createCrashRecoveryScheduler({
      target: {},
      delayMs: 0,
      exportSnapshot: async () => {
        exported += 1;
        throw new Error("clean projects must not export");
      },
      onStatus: () => undefined,
      isCurrent: () => true
    });
    scheduler.schedule(snapshot(false));
    await scheduler.flush();
    expect(exported).toBe(0);
  });

  it("coalesces rapid dirty transactions into one publish", async () => {
    vi.useFakeTimers();
    let published = 0;
    const scheduler = createCrashRecoveryScheduler({
      target: {},
      delayMs: 400,
      exportSnapshot: async (current) =>
        ({
          bytes: new Uint8Array([1]),
          sourceIdentity: current.sourceIdentity,
          manifest: { packageVersion: "partbench.wcad.v2" }
        }) as never,
      onStatus: () => undefined,
      isCurrent: () => true,
      publish: async () => {
        published += 1;
        return {
          published: true,
          status: { state: "current", available: true }
        } satisfies CrashRecoveryPublishResult;
      }
    });
    scheduler.schedule(snapshot(true, "1".repeat(64)));
    scheduler.schedule(snapshot(true, "2".repeat(64)));
    scheduler.schedule(snapshot(true, "3".repeat(64)));
    expect(published).toBe(0);
    await vi.advanceTimersByTimeAsync(400);
    await scheduler.flush();
    expect(published).toBe(1);
    vi.useRealTimers();
  });

  it("skips a stale snapshot whose source identity is no longer current", async () => {
    let published = 0;
    const scheduler = createCrashRecoveryScheduler({
      target: {},
      delayMs: 0,
      exportSnapshot: async (current) =>
        ({
          bytes: new Uint8Array([1]),
          sourceIdentity: current.sourceIdentity
        }) as never,
      onStatus: () => undefined,
      isCurrent: (identity) => identity.sha256 === "c".repeat(64),
      publish: async () => {
        published += 1;
        return {
          published: true,
          status: { state: "current", available: true }
        } satisfies CrashRecoveryPublishResult;
      }
    });
    scheduler.schedule(snapshot(true, "s".repeat(64)));
    await scheduler.flush();
    expect(published).toBe(0);
  });
});
