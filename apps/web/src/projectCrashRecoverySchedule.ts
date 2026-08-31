import type { CadProject } from "@web-cad/cad-core";
import type { WcadSourceIdentity } from "@web-cad/cad-protocol";
import type { CrashRecoveryMarkerStorage } from "./projectCrashRecoveryMarker";
import { PROJECT_CRASH_RECOVERY_LIMITS } from "./projectCrashRecoveryLimits";
import type { ProjectCrashRecoveryStatus } from "./projectCrashRecoveryStatus";
import type {
  CrashRecoveryPublishInput,
  CrashRecoveryStorageTarget
} from "./projectCrashRecoveryStore";

export interface CrashRecoveryScheduleSnapshot {
  readonly dirty: boolean;
  readonly project: CadProject;
  readonly projectName: string;
  readonly sourceIdentity: WcadSourceIdentity;
}

export interface CrashRecoveryScheduler {
  readonly schedule: (snapshot: CrashRecoveryScheduleSnapshot) => void;
  readonly cancel: () => void;
  readonly flush: () => Promise<void>;
}

export function createCrashRecoveryScheduler(input: {
  readonly target: CrashRecoveryStorageTarget;
  readonly storage?: CrashRecoveryMarkerStorage;
  readonly now?: () => Date;
  readonly delayMs?: number;
  readonly scheduleTimer?: (callback: () => void, delayMs: number) => number;
  readonly cancelTimer?: (id: number) => void;
  readonly exportSnapshot: (
    snapshot: CrashRecoveryScheduleSnapshot
  ) => Promise<CrashRecoveryPublishInput["exported"]>;
  readonly onStatus: (status: ProjectCrashRecoveryStatus) => void;
  readonly isCurrent: (sourceIdentity: WcadSourceIdentity) => boolean;
  readonly publish?: typeof import("./projectCrashRecoveryStore").publishCrashRecoveryGeneration;
}): CrashRecoveryScheduler {
  const delayMs = input.delayMs ?? PROJECT_CRASH_RECOVERY_LIMITS.coalesceMs;
  const scheduleTimer =
    input.scheduleTimer ??
    ((callback, delay) => globalThis.setTimeout(callback, delay) as unknown as number);
  const cancelTimer =
    input.cancelTimer ??
    ((id) => globalThis.clearTimeout(id as unknown as ReturnType<typeof setTimeout>));
  let timer: number | undefined;
  let pending: CrashRecoveryScheduleSnapshot | undefined;
  let writing: Promise<void> | undefined;

  const run = async (): Promise<void> => {
    const snapshot = pending;
    pending = undefined;
    timer = undefined;
    if (!snapshot || !snapshot.dirty) {
      return;
    }
    if (!input.isCurrent(snapshot.sourceIdentity)) {
      return;
    }
    input.onStatus({
      state: "pending",
      available: true,
      lastResult: "Saving a crash-recovery snapshot…"
    });
    try {
      const exported = await input.exportSnapshot(snapshot);
      if (!input.isCurrent(snapshot.sourceIdentity)) {
        return;
      }
      const publish =
        input.publish ??
        (await import("./projectCrashRecoveryStore")).publishCrashRecoveryGeneration;
      const result = await publish(
        input.target,
        {
          exported,
          project: snapshot.project,
          projectName: snapshot.projectName,
          committedAt: (input.now ?? (() => new Date()))().toISOString(),
          expectedSourceIdentity: snapshot.sourceIdentity
        },
        input.storage
      );
      if (!input.isCurrent(snapshot.sourceIdentity) && result.published) {
        return;
      }
      input.onStatus(result.status);
    } catch (error) {
      input.onStatus({
        state: "failed",
        available: true,
        lastResult:
          error instanceof Error
            ? error.message
            : "Crash recovery write failed."
      });
    }
  };

  return {
    schedule(snapshot) {
      if (!snapshot.dirty) {
        return;
      }
      pending = snapshot;
      if (timer !== undefined) {
        cancelTimer(timer);
      }
      timer = scheduleTimer(() => {
        writing = run();
      }, delayMs);
    },
    cancel() {
      if (timer !== undefined) {
        cancelTimer(timer);
        timer = undefined;
      }
      pending = undefined;
    },
    async flush() {
      if (timer !== undefined) {
        cancelTimer(timer);
        timer = undefined;
        writing = run();
      }
      await writing;
    }
  };
}
