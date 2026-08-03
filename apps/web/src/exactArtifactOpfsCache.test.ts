import { sha256Hex } from "@web-cad/cad-core";
import type { GeometryKernelExactBodyArtifact } from "@web-cad/geometry-worker/browser";
import { describe, expect, it, vi } from "vitest";
import {
  createExactArtifactCacheKey,
  createExactArtifactOpfsCache,
  EXACT_ARTIFACT_CACHE_ENTRY_VERSION,
  EXACT_ARTIFACT_CACHE_INDEX_VERSION,
  EXACT_ARTIFACT_CACHE_MAX_ENTRY_BYTES,
  EXACT_ARTIFACT_CACHE_NAMESPACE,
  isExactArtifactCacheEntryWithinLimit,
  type ExactArtifactCacheCandidate
} from "./exactArtifactOpfsCache";
import type {
  ProjectOpfsCacheDirectoryHandleLike,
  ProjectOpfsCacheFileHandleLike,
  ProjectOpfsCacheFileLike,
  ProjectOpfsCacheTargetLike,
  ProjectOpfsCacheWritableLike
} from "./projectOpfsCache";

describe("exact artifact OPFS cache", () => {
  it("stays lazy and uses the private exact-artifact namespace", async () => {
    const target = createMemoryTarget();
    const cache = createExactArtifactOpfsCache(target);

    expect(target.getDirectory).not.toHaveBeenCalled();

    const artifact = await createArtifact(1);
    await cache.write({ artifact, isCurrent: () => true });

    expect(target.getDirectory).toHaveBeenCalledTimes(1);
    expect(target.root.hasDirectory(EXACT_ARTIFACT_CACHE_NAMESPACE)).toBe(true);
    expect(target.root.hasDirectory("partbench-v8-cache")).toBe(false);
    const index = readIndex(target);
    expect(index).toMatchObject({
      version: EXACT_ARTIFACT_CACHE_INDEX_VERSION,
      entries: [
        {
          version: EXACT_ARTIFACT_CACHE_ENTRY_VERSION,
          bodySourceIdentitySignature: artifact.bodySourceIdentitySignature,
          sourceCacheKeySha256: artifact.sourceCacheKeySha256,
          topologySignature: artifact.topologySnapshot.signature,
          byteLength: artifact.brepByteLength,
          sha256: artifact.brepSha256
        }
      ]
    });
    expect(JSON.stringify(index)).not.toMatch(
      /metadata|displayMesh|fileHandle|opfsPath|browserHandle|localPath/i
    );
  });

  it("persists only BRep identity data and rebuilds private pick evidence", async () => {
    const target = createMemoryTarget();
    const cache = createExactArtifactOpfsCache(target);
    const baseArtifact = await createArtifact(22);
    const artifact: GeometryKernelExactBodyArtifact = {
      ...baseArtifact,
      viewportPickMap: {} as NonNullable<
        GeometryKernelExactBodyArtifact["viewportPickMap"]
      >,
      viewportPickMapDowngrade: { status: "invalid" }
    };

    await cache.write({ artifact, isCurrent: () => true });

    expect(JSON.stringify(readIndex(target))).not.toMatch(
      /viewportPickMap|faceTriangleRanges|edgePointRanges|edgePoints|vertexPoints/i
    );
    expect([
      ...target.cacheRoot().directory("artifacts").readOnlyBytes()
    ]).toEqual([...artifact.brepBytes]);

    const rebuiltPickMap = {} as NonNullable<
      GeometryKernelExactBodyArtifact["viewportPickMap"]
    >;
    const validate = vi.fn(async (candidate: ExactArtifactCacheCandidate) => {
      expect(candidate).not.toHaveProperty("viewportPickMap");
      expect(candidate).not.toHaveProperty("viewportPickMapDowngrade");
      return {
        ...artifact,
        brepBytes: candidate.brepBytes,
        brepByteLength: candidate.brepByteLength,
        brepSha256: candidate.brepSha256,
        viewportPickMap: rebuiltPickMap
      };
    });
    const read = await cache.read({
      identity: artifact,
      isCurrent: () => true,
      validate
    });

    expect(validate).toHaveBeenCalledOnce();
    expect(read).toMatchObject({ status: "hit" });
    if (read.status === "hit") {
      expect(read.artifact.viewportPickMap).toBe(rebuiltPickMap);
    }
  });

  it("validates B-rep through the caller before returning a warm hit", async () => {
    const target = createMemoryTarget();
    let now = 10;
    const cache = createExactArtifactOpfsCache(target, () => now);
    const artifact = await createArtifact(2);
    expect(
      await cache.write({ artifact, isCurrent: () => true })
    ).toMatchObject({ status: "stored", entryCount: 1 });
    const validate = vi.fn(async (candidate: ExactArtifactCacheCandidate) => ({
      ...artifact,
      brepBytes: candidate.brepBytes
    }));

    now = 25;
    const read = await cache.read({
      identity: artifact,
      isCurrent: () => true,
      validate
    });

    expect(read).toMatchObject({
      status: "hit",
      artifact: { bodyId: "body-2" }
    });
    expect(validate).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceKind: "box",
        shapePolicy: "singleSolid",
        brepByteLength: artifact.brepByteLength,
        brepSha256: artifact.brepSha256,
        topologySignature: artifact.topologySnapshot.signature
      })
    );
    expect(readIndex(target).entries[0]?.lastAccess).toBe(25);
  });

  it("removes corrupt bytes and recomputed-topology mismatches", async () => {
    const target = createMemoryTarget();
    const cache = createExactArtifactOpfsCache(target);
    const artifact = await createArtifact(3);
    await cache.write({ artifact, isCurrent: () => true });
    target
      .cacheRoot()
      .directory("artifacts")
      .overwriteOnlyFile(new Uint8Array([9, 9]));

    expect(
      await cache.read({
        identity: artifact,
        isCurrent: () => true,
        validate: async () => artifact
      })
    ).toEqual({ status: "miss", reason: "corrupt" });
    expect(readIndex(target).entries).toEqual([]);

    await cache.write({ artifact, isCurrent: () => true });
    expect(
      await cache.read({
        identity: artifact,
        isCurrent: () => true,
        validate: async (candidate) => ({
          ...artifact,
          brepBytes: candidate.brepBytes,
          topologySnapshot: {
            ...artifact.topologySnapshot,
            signature: "different-topology"
          }
        })
      })
    ).toEqual({ status: "miss", reason: "corrupt" });
    expect(readIndex(target).entries).toEqual([]);
  });

  it("removes version-mismatched records and cold-falls back", async () => {
    const target = createMemoryTarget();
    const cache = createExactArtifactOpfsCache(target);
    const artifact = await createArtifact(4);
    await cache.write({ artifact, isCurrent: () => true });
    const index = readIndex(target);
    writeIndex(target, {
      ...index,
      entries: index.entries.map((entry) => ({
        ...entry,
        version: "partbench-exact-artifact-entry.v0"
      }))
    });

    expect(
      await cache.read({
        identity: artifact,
        isCurrent: () => true,
        validate: async () => artifact
      })
    ).toEqual({ status: "miss", reason: "version-mismatch" });
    expect(target.root.hasDirectory(EXACT_ARTIFACT_CACHE_NAMESPACE)).toBe(
      false
    );
  });

  it("suppresses stale writes and clear invalidates in-flight generation", async () => {
    const target = createMemoryTarget();
    const cache = createExactArtifactOpfsCache(target);
    const artifact = await createArtifact(5);
    target.root.directory("partbench-v8-cache", true);

    expect(await cache.write({ artifact, isCurrent: () => false })).toEqual({
      status: "skipped",
      reason: "stale"
    });
    expect(target.getDirectory).not.toHaveBeenCalled();

    const inFlight = cache.write({ artifact, isCurrent: () => true });
    expect(await cache.clear()).toEqual({ status: "cleared" });
    expect(await inFlight).toEqual({ status: "skipped", reason: "stale" });
    expect(target.root.hasDirectory(EXACT_ARTIFACT_CACHE_NAMESPACE)).toBe(
      false
    );
    expect(target.root.hasDirectory("partbench-v8-cache")).toBe(true);
  });

  it.each(["artifact", "index"] as const)(
    "does not retain a write that becomes stale at the %s boundary",
    async (boundary) => {
      let current = true;
      const target = createMemoryTarget({
        onClose: (name) => {
          if (
            (boundary === "artifact" && name.endsWith(".brep")) ||
            (boundary === "index" && name === "index.json")
          ) {
            current = false;
          }
        }
      });
      const cache = createExactArtifactOpfsCache(target);

      expect(
        await cache.write({
          artifact: await createArtifact(boundary === "artifact" ? 6 : 7),
          isCurrent: () => current
        })
      ).toEqual({ status: "skipped", reason: "stale" });
      if (boundary === "index") {
        expect(readIndex(target).entries).toEqual([]);
      }
      expect(target.cacheRoot().directory("artifacts").fileCount()).toBe(0);
    }
  );

  it("evicts by lastAccess then cache key and enforces fixed bounds", async () => {
    const target = createMemoryTarget();
    const cache = createExactArtifactOpfsCache(target, () => 7);
    const artifacts = await Promise.all(
      [1, 2, 3, 4, 5].map((index) => createArtifact(index + 10))
    );
    for (const artifact of artifacts.slice(0, 4)) {
      await cache.write({ artifact, isCurrent: () => true });
    }
    const index = readIndex(target);
    writeIndex(target, {
      ...index,
      entries: index.entries.map((entry) => ({
        ...entry,
        byteLength: EXACT_ARTIFACT_CACHE_MAX_ENTRY_BYTES,
        lastAccess: 7
      }))
    });
    const expectedEviction = [...index.entries].sort((left, right) =>
      left.cacheKey.localeCompare(right.cacheKey)
    )[0]!.cacheKey;

    const result = await cache.write({
      artifact: artifacts[4]!,
      isCurrent: () => true
    });

    expect(result).toMatchObject({ status: "stored", evictedEntryCount: 1 });
    expect(
      readIndex(target).entries.map(({ cacheKey }) => cacheKey)
    ).not.toContain(expectedEviction);
    expect(
      isExactArtifactCacheEntryWithinLimit(EXACT_ARTIFACT_CACHE_MAX_ENTRY_BYTES)
    ).toBe(true);
    expect(
      isExactArtifactCacheEntryWithinLimit(
        EXACT_ARTIFACT_CACHE_MAX_ENTRY_BYTES + 1
      )
    ).toBe(false);
    expect(createExactArtifactCacheKey(artifacts[0]!)).not.toBe(
      createExactArtifactCacheKey({
        ...artifacts[0]!,
        shapePolicy: "singleShapeOneOrMoreSolids"
      })
    );
  });

  it("cold-falls back when OPFS is unavailable, denied, or full", async () => {
    const artifact = await createArtifact(20);
    const unavailable = createExactArtifactOpfsCache({});
    expect(
      await unavailable.read({
        identity: artifact,
        isCurrent: () => true,
        validate: async () => artifact
      })
    ).toEqual({ status: "miss", reason: "unavailable" });

    const deniedTarget = createMemoryTarget({
      getDirectoryError: new DOMException("Denied", "SecurityError")
    });
    expect(
      await createExactArtifactOpfsCache(deniedTarget).write({
        artifact,
        isCurrent: () => true
      })
    ).toEqual({ status: "skipped", reason: "permission-denied" });

    const fullTarget = createMemoryTarget({ failWrites: true });
    expect(
      await createExactArtifactOpfsCache(fullTarget).write({
        artifact,
        isCurrent: () => true
      })
    ).toEqual({ status: "skipped", reason: "storage-full" });
  });

  it("removes bytes when the index cannot publish the write", async () => {
    const target = createMemoryTarget({ failWriteName: "index.json" });
    const result = await createExactArtifactOpfsCache(target).write({
      artifact: await createArtifact(21),
      isCurrent: () => true
    });

    expect(result).toEqual({ status: "skipped", reason: "storage-full" });
    expect(target.cacheRoot().directory("artifacts").fileCount()).toBe(0);
  });
});

async function createArtifact(
  index: number
): Promise<GeometryKernelExactBodyArtifact> {
  const brepBytes = new Uint8Array([index]);
  const bodyId = `body-${index}`;
  return {
    artifactVersion: "partbench.exact-body-artifact.v1",
    bodyId,
    sourceType: "primitive",
    documentSourceIdentity: {
      algorithm: "partbench-source-v1",
      sha256: "d".repeat(64)
    },
    bodySourceIdentitySignature: `source-${index}`,
    sourceCacheKeySha256: index.toString(16).padStart(64, "0"),
    sourceGraphNodeCount: 1,
    units: "mm",
    shapePolicy: "singleSolid",
    sourceKind: "box",
    brepFormat: "occt-brep",
    brepWriter: "BRepTools.Write_3",
    brepBytes,
    brepByteLength: brepBytes.byteLength,
    brepSha256: sha256Hex(brepBytes),
    metadata: {
      sourceKind: "box",
      bounds: { min: [0, 0, 0], max: [1, 1, 1] },
      volume: 1,
      surfaceArea: 6,
      centroid: [0.5, 0.5, 0.5],
      topologyCounts: {
        solidCount: 1,
        faceCount: 6,
        edgeCount: 12,
        vertexCount: 8
      },
      measurementSource: "kernel-derived",
      measurementConfidence: "kernel-derived",
      diagnostics: []
    },
    topologySnapshot: {
      sourceKind: "box",
      status: "ready",
      entityCounts: {
        bodyCount: 1,
        solidCount: 1,
        faceCount: 6,
        wireCount: 6,
        loopCount: 6,
        coedgeCount: 24,
        edgeCount: 12,
        vertexCount: 8,
        axisCount: 0
      },
      entityCount: 2,
      entities: [
        {
          localId: `body:${bodyId}`,
          kind: "body",
          signature: `body:${bodyId}`,
          source: "kernel-derived"
        },
        {
          localId: `solid:${bodyId}`,
          kind: "solid",
          signature: `solid:${bodyId}`,
          source: "kernel-derived"
        }
      ],
      unsupportedEntityKinds: [],
      adjacencyAvailable: false,
      signatureAlgorithm: "partbench-derived-topology-snapshot-v1",
      signature: `topology:${bodyId}`,
      source: "kernel-derived",
      diagnostics: []
    },
    displayMesh: {
      primitive: "box",
      positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
      indices: new Uint32Array([0, 1, 2]),
      vertexCount: 3,
      triangleCount: 1,
      faceCount: 1
    }
  };
}

function readIndex(target: MemoryTarget): {
  readonly version: string;
  readonly entries: readonly (Record<string, unknown> & {
    readonly cacheKey: string;
    readonly lastAccess: number;
  })[];
} {
  return JSON.parse(target.cacheRoot().readText("index.json")) as ReturnType<
    typeof readIndex
  >;
}

function writeIndex(target: MemoryTarget, value: unknown): void {
  target.cacheRoot().writeText("index.json", `${JSON.stringify(value)}\n`);
}

type MemoryTarget = ProjectOpfsCacheTargetLike & {
  readonly root: MemoryDirectory;
  readonly getDirectory: ReturnType<typeof vi.fn>;
  readonly cacheRoot: () => MemoryDirectory;
};

function createMemoryTarget(
  options: {
    readonly getDirectoryError?: Error;
    readonly failWrites?: boolean;
    readonly failWriteName?: string;
    readonly onClose?: (name: string) => void;
  } = {}
): MemoryTarget {
  const root = new MemoryDirectory(options);
  const getDirectory = vi.fn(async () => {
    if (options.getDirectoryError) throw options.getDirectoryError;
    return root;
  });
  return {
    root,
    getDirectory,
    cacheRoot: () => root.directory(EXACT_ARTIFACT_CACHE_NAMESPACE),
    navigator: { storage: { getDirectory } }
  };
}

class MemoryDirectory implements ProjectOpfsCacheDirectoryHandleLike {
  private readonly directories = new Map<string, MemoryDirectory>();
  private readonly files = new Map<string, Uint8Array>();

  constructor(
    private readonly options: {
      readonly failWrites?: boolean;
      readonly failWriteName?: string;
      readonly onClose?: (name: string) => void;
    } = {}
  ) {}

  async getDirectoryHandle(
    name: string,
    options?: { readonly create?: boolean }
  ): Promise<ProjectOpfsCacheDirectoryHandleLike> {
    return this.directory(name, options?.create);
  }

  async getFileHandle(
    name: string,
    options?: { readonly create?: boolean }
  ): Promise<ProjectOpfsCacheFileHandleLike> {
    if (!this.files.has(name) && !options?.create) notFound();
    return new MemoryFileHandle(name, this.files, this.options);
  }

  async removeEntry(name: string): Promise<void> {
    if (!this.directories.delete(name) && !this.files.delete(name)) notFound();
  }

  directory(name: string, create = false): MemoryDirectory {
    const existing = this.directories.get(name);
    if (existing) return existing;
    if (!create) notFound();
    const directory = new MemoryDirectory(this.options);
    this.directories.set(name, directory);
    return directory;
  }

  hasDirectory(name: string): boolean {
    return this.directories.has(name);
  }

  readText(name: string): string {
    const bytes = this.files.get(name);
    if (!bytes) notFound();
    return new TextDecoder().decode(bytes);
  }

  writeText(name: string, value: string): void {
    this.files.set(name, new TextEncoder().encode(value));
  }

  overwriteOnlyFile(bytes: Uint8Array): void {
    const names = [...this.files.keys()];
    if (names.length !== 1 || !names[0]) {
      throw new Error("Expected one artifact file.");
    }
    this.files.set(names[0], new Uint8Array(bytes));
  }

  fileCount(): number {
    return this.files.size;
  }

  readOnlyBytes(): Uint8Array {
    const entries = [...this.files.values()];
    if (entries.length !== 1 || !entries[0]) {
      throw new Error("Expected one artifact file.");
    }
    return entries[0].slice();
  }
}

class MemoryFileHandle implements ProjectOpfsCacheFileHandleLike {
  constructor(
    private readonly name: string,
    private readonly files: Map<string, Uint8Array>,
    private readonly options: {
      readonly failWrites?: boolean;
      readonly failWriteName?: string;
      readonly onClose?: (name: string) => void;
    }
  ) {}

  async getFile(): Promise<ProjectOpfsCacheFileLike> {
    const bytes = this.files.get(this.name);
    if (!bytes) notFound();
    return {
      size: bytes.byteLength,
      text: async () => new TextDecoder().decode(bytes),
      arrayBuffer: async () => bytes.slice().buffer
    };
  }

  async createWritable(): Promise<ProjectOpfsCacheWritableLike> {
    let bytes = new Uint8Array();
    return {
      write: (data) => {
        if (
          this.options.failWrites ||
          this.options.failWriteName === this.name
        ) {
          throw new DOMException("Full", "QuotaExceededError");
        }
        bytes =
          typeof data === "string"
            ? new TextEncoder().encode(data)
            : new Uint8Array(data);
      },
      close: () => {
        this.files.set(this.name, bytes);
        this.options.onClose?.(this.name);
      }
    };
  }
}

function notFound(): never {
  throw new DOMException("Not found", "NotFoundError");
}
