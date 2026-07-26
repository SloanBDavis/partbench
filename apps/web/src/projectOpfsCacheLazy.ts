import type {
  ProjectOpfsCacheStatus,
  ProjectOpfsCacheTargetLike,
  ProjectOpfsCacheValidationOptions
} from "./projectOpfsCache";
import { PROJECT_OPFS_CACHE_INDEX_VERSION } from "./projectOpfsCacheInitial";

export type ProjectOpfsCacheLoader = () => Promise<{
  readonly clearProjectOpfsCache: (
    target: ProjectOpfsCacheTargetLike
  ) => Promise<ProjectOpfsCacheStatus>;
  readonly readProjectOpfsCacheStatus: (
    target: ProjectOpfsCacheTargetLike,
    options?: ProjectOpfsCacheValidationOptions
  ) => Promise<ProjectOpfsCacheStatus>;
}>;

const loadProjectOpfsCache: ProjectOpfsCacheLoader = () =>
  import("./projectOpfsCache");

export async function readLazyProjectOpfsCacheStatus(
  target: ProjectOpfsCacheTargetLike,
  options: ProjectOpfsCacheValidationOptions = {},
  load: ProjectOpfsCacheLoader = loadProjectOpfsCache
): Promise<ProjectOpfsCacheStatus> {
  try {
    const cache = await load();
    return await cache.readProjectOpfsCacheStatus(target, options);
  } catch (error) {
    return createProjectOpfsCacheLoadFailureStatus("read", error);
  }
}

export async function clearLazyProjectOpfsCache(
  target: ProjectOpfsCacheTargetLike,
  load: ProjectOpfsCacheLoader = loadProjectOpfsCache
): Promise<ProjectOpfsCacheStatus> {
  try {
    const cache = await load();
    return await cache.clearProjectOpfsCache(target);
  } catch (error) {
    return createProjectOpfsCacheLoadFailureStatus("clear", error);
  }
}

function createProjectOpfsCacheLoadFailureStatus(
  operation: "read" | "clear",
  error: unknown
): ProjectOpfsCacheStatus {
  const isRead = operation === "read";
  const message = isRead
    ? "OPFS cache status could not be loaded."
    : "OPFS cache clear could not be loaded.";

  return {
    state: "error",
    available: false,
    indexVersion: PROJECT_OPFS_CACHE_INDEX_VERSION,
    entryCount: 0,
    validEntryCount: 0,
    staleEntryCount: 0,
    unsupportedEntryCount: 0,
    corruptEntryCount: 0,
    diagnostics: [
      {
        code: isRead ? "OPFS_HANDLE_FAILED" : "OPFS_CLEAR_FAILED",
        severity: "error",
        message: isRead
          ? "OPFS handle access failed."
          : "OPFS cache clear failed.",
        detail: error instanceof Error ? error.message : String(error)
      }
    ],
    lastResult: message
  };
}
