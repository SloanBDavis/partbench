import type { DerivedGeometryMeshCache } from "./derivedGeometry";
import type {
  DerivedMeshCacheContext,
  DerivedMeshOpfsCacheOptions
} from "./derivedMeshOpfsCache";

export { DERIVED_MESH_CACHE_ARTIFACT_VERSION } from "./derivedMeshOpfsCacheVersions";
export type { DerivedMeshCacheContext };

export type DerivedMeshOpfsCacheLoader = () => Promise<{
  readonly createDerivedMeshOpfsCache: (
    options: DerivedMeshOpfsCacheOptions
  ) => DerivedGeometryMeshCache;
}>;

const loadDerivedMeshOpfsCache: DerivedMeshOpfsCacheLoader = () =>
  import("./derivedMeshOpfsCache");

export function createLazyDerivedMeshOpfsCache(
  options: DerivedMeshOpfsCacheOptions,
  load: DerivedMeshOpfsCacheLoader = loadDerivedMeshOpfsCache
): DerivedGeometryMeshCache {
  let cachePromise: Promise<DerivedGeometryMeshCache> | undefined;
  const getCache = (): Promise<DerivedGeometryMeshCache> => {
    cachePromise ??= load()
      .then((module) => module.createDerivedMeshOpfsCache(options))
      .catch((error: unknown) => {
        cachePromise = undefined;
        throw error;
      });
    return cachePromise;
  };

  return {
    read: async (input) => (await getCache()).read(input),
    write: async (input) => (await getCache()).write(input)
  };
}
