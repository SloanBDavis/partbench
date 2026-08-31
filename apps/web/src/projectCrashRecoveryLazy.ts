import type { CrashRecoveryMarkerStorage } from "./projectCrashRecoveryMarker";
import {
  readCrashRecoveryMarker,
  type CrashRecoveryMarkerRead
} from "./projectCrashRecoveryMarker";
import {
  createIdleCrashRecoveryStatus,
  type ProjectCrashRecoveryStatus
} from "./projectCrashRecoveryStatus";
import type { CrashRecoveryStorageTarget } from "./projectCrashRecoveryStore";

export type CrashRecoveryStoreLoader = () => Promise<
  typeof import("./projectCrashRecoveryStore")
>;

const loadStore: CrashRecoveryStoreLoader = () =>
  import("./projectCrashRecoveryStore");

export function peekCrashRecoveryMarker(
  storage?: CrashRecoveryMarkerStorage
): CrashRecoveryMarkerRead {
  return readCrashRecoveryMarker(storage);
}

export async function inspectLazyCrashRecovery(
  target: CrashRecoveryStorageTarget,
  storage?: CrashRecoveryMarkerStorage,
  load: CrashRecoveryStoreLoader = loadStore
): Promise<{
  readonly status: ProjectCrashRecoveryStatus;
  readonly openedOpfs: boolean;
}> {
  const marker = readCrashRecoveryMarker(storage);
  if (!marker.indicated) {
    return {
      status: createIdleCrashRecoveryStatus(),
      openedOpfs: false
    };
  }
  try {
    const store = await load();
    const inspected = await store.inspectCrashRecovery(target, storage);
    return { status: inspected.status, openedOpfs: true };
  } catch (error) {
    return {
      status: {
        state: "failed",
        available: true,
        lastResult:
          error instanceof Error
            ? error.message
            : "Crash recovery could not be loaded."
      },
      openedOpfs: false
    };
  }
}
