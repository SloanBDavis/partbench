import type { ProjectOpfsCacheStatus } from "./projectOpfsCache";

export const PROJECT_OPFS_CACHE_INDEX_VERSION = "partbench.opfs-cache.v1";

export function createInitialProjectOpfsCacheStatus(
  opfsApiDetected: boolean
): ProjectOpfsCacheStatus {
  if (opfsApiDetected) {
    return {
      state: "empty",
      available: true,
      indexVersion: PROJECT_OPFS_CACHE_INDEX_VERSION,
      entryCount: 0,
      validEntryCount: 0,
      staleEntryCount: 0,
      unsupportedEntryCount: 0,
      corruptEntryCount: 0,
      diagnostics: [],
      lastResult: "OPFS cache status has not been read yet."
    };
  }

  return {
    state: "unavailable",
    available: false,
    indexVersion: PROJECT_OPFS_CACHE_INDEX_VERSION,
    entryCount: 0,
    validEntryCount: 0,
    staleEntryCount: 0,
    unsupportedEntryCount: 0,
    corruptEntryCount: 0,
    diagnostics: [
      {
        code: "OPFS_UNAVAILABLE",
        severity: "info",
        message: "OPFS is unavailable in this browser.",
        detail: undefined,
        cacheKey: undefined,
        artifactKind: undefined
      }
    ],
    lastResult: "OPFS is unavailable in this browser."
  };
}
