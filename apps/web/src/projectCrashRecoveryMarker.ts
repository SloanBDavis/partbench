import {
  PROJECT_CRASH_RECOVERY_LIMITS,
  PROJECT_CRASH_RECOVERY_MARKER_STORAGE_KEY,
  PROJECT_CRASH_RECOVERY_MARKER_VERSION
} from "./projectCrashRecoveryLimits";

export interface CrashRecoveryMarkerStorage {
  readonly getItem: (key: string) => string | null;
  readonly setItem: (key: string, value: string) => void;
  readonly removeItem: (key: string) => void;
}

export type CrashRecoveryMarkerRead =
  | { readonly indicated: false; readonly reason: "absent" }
  | { readonly indicated: false; readonly reason: "corrupt" }
  | { readonly indicated: true };

/**
 * Untrusted local-storage hint only. Presence may justify opening OPFS.
 * Absence means do not open OPFS. The marker cannot restore a project.
 */
export function readCrashRecoveryMarker(
  storage: CrashRecoveryMarkerStorage | undefined
): CrashRecoveryMarkerRead {
  if (!storage) {
    return { indicated: false, reason: "absent" };
  }
  let raw: string | null;
  try {
    raw = storage.getItem(PROJECT_CRASH_RECOVERY_MARKER_STORAGE_KEY);
  } catch {
    return { indicated: false, reason: "corrupt" };
  }
  if (raw === null) {
    return { indicated: false, reason: "absent" };
  }
  if (
    raw.length > PROJECT_CRASH_RECOVERY_LIMITS.markerBytes ||
    !isValidMarkerJson(raw)
  ) {
    return { indicated: false, reason: "corrupt" };
  }
  return { indicated: true };
}

export function writeCrashRecoveryMarker(
  storage: CrashRecoveryMarkerStorage | undefined
): boolean {
  if (!storage) {
    return false;
  }
  const payload = JSON.stringify({
    version: PROJECT_CRASH_RECOVERY_MARKER_VERSION
  });
  if (payload.length > PROJECT_CRASH_RECOVERY_LIMITS.markerBytes) {
    return false;
  }
  try {
    storage.setItem(PROJECT_CRASH_RECOVERY_MARKER_STORAGE_KEY, payload);
    return true;
  } catch {
    return false;
  }
}

export function clearCrashRecoveryMarker(
  storage: CrashRecoveryMarkerStorage | undefined
): void {
  try {
    storage?.removeItem(PROJECT_CRASH_RECOVERY_MARKER_STORAGE_KEY);
  } catch {
    // Marker cleanup is best-effort; OPFS record remains authoritative.
  }
}

function isValidMarkerJson(raw: string): boolean {
  try {
    const parsed: unknown = JSON.parse(raw);
    return (
      typeof parsed === "object" &&
      parsed !== null &&
      (parsed as { readonly version?: unknown }).version ===
        PROJECT_CRASH_RECOVERY_MARKER_VERSION
    );
  } catch {
    return false;
  }
}
