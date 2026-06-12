import { CadEngine, exportCadProjectWcad } from "@web-cad/cad-core";
import type { WcadSourceIdentity } from "@web-cad/cad-protocol";
import { describe, expect, it } from "vitest";
import {
  clearProjectOpfsCache,
  createProjectOpfsCacheIndex,
  createProjectOpfsCacheKey,
  readProjectOpfsCacheStatus,
  validateProjectOpfsCacheIndex,
  writeProjectOpfsCacheIndexForTest,
  type ProjectOpfsCacheDirectoryHandleLike,
  type ProjectOpfsCacheFileHandleLike,
  type ProjectOpfsCacheFileLike,
  type ProjectOpfsCacheIndexEntry,
  type ProjectOpfsCacheTargetLike,
  type ProjectOpfsCacheWritableLike
} from "./projectOpfsCache";

describe("project OPFS cache helpers", () => {
  it("creates deterministic source-identity cache keys without browser handles or paths", () => {
    const input = {
      sourceIdentity: CURRENT_SOURCE_IDENTITY,
      artifactKind: "derivedMesh",
      artifactVersion: "mesh-v1",
      documentSchemaVersion: "web-cad.project.v16",
      units: "mm",
      kernelVersion: "occt-facade-v1",
      workerVersion: "geometry-worker-v1",
      settingsKey: "tessellation:standard"
    } as const;

    const first = createProjectOpfsCacheKey(input);
    const second = createProjectOpfsCacheKey(input);

    expect(second).toBe(first);
    expect(first).toContain("partbench-source-v1");
    expect(first).toContain("derivedMesh");
    expect(first).toContain("mesh-v1");
    expect(first).not.toMatch(
      /fileHandle|localPath|opfsPath|rendererId|meshId|occtId|selectionBufferId/i
    );
  });

  it("reports OPFS unavailable without throwing", async () => {
    const status = await readProjectOpfsCacheStatus({});

    expect(status).toMatchObject({
      state: "unavailable",
      available: false,
      entryCount: 0
    });
    expect(status.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "OPFS_UNAVAILABLE" }),
        expect.objectContaining({ code: "OPFS_CACHE_IGNORED" })
      ])
    );
  });

  it("reports an empty cache when the index is missing", async () => {
    const target = createMockOpfsTarget();

    const status = await readProjectOpfsCacheStatus(target);

    expect(status).toMatchObject({
      state: "empty",
      available: true,
      entryCount: 0,
      validEntryCount: 0
    });
    expect(status.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "OPFS_INDEX_MISSING" }),
        expect.objectContaining({ code: "OPFS_CACHE_IGNORED" })
      ])
    );
  });

  it("calls navigator.storage.getDirectory with the storage receiver", async () => {
    const root = new MockDirectoryHandle();
    let calledWithStorage = false;
    const storage = {
      async getDirectory() {
        calledWithStorage = this === storage;
        return root;
      }
    };
    const target = {
      navigator: { storage }
    } satisfies ProjectOpfsCacheTargetLike;

    const status = await readProjectOpfsCacheStatus(target);

    expect(status.state).toBe("empty");
    expect(calledWithStorage).toBe(true);
  });

  it("reads a valid cache index and summarizes entry health", async () => {
    const target = createMockOpfsTarget();
    const entry = createCacheEntry({
      status: "valid",
      sourceIdentity: CURRENT_SOURCE_IDENTITY
    });
    await writeProjectOpfsCacheIndexForTest(
      target,
      createProjectOpfsCacheIndex([entry], "2026-06-12T00:00:00.000Z")
    );

    const status = await readProjectOpfsCacheStatus(target, {
      currentSourceIdentity: CURRENT_SOURCE_IDENTITY,
      supportedArtifactVersions: ["mesh-v1"]
    });

    expect(status).toMatchObject({
      state: "ready",
      available: true,
      entryCount: 1,
      validEntryCount: 1,
      staleEntryCount: 0,
      unsupportedEntryCount: 0,
      corruptEntryCount: 0
    });
    expect(status.diagnostics).toEqual([]);
  });

  it("returns structured diagnostics for stale, unsupported, and corrupt entries", () => {
    const entry = createCacheEntry({
      status: "valid",
      sourceIdentity: OTHER_SOURCE_IDENTITY,
      byteLength: 100,
      sha256: "b".repeat(64),
      artifactVersion: "mesh-v0"
    });

    const validation = validateProjectOpfsCacheIndex(
      createProjectOpfsCacheIndex([entry]),
      {
        currentSourceIdentity: CURRENT_SOURCE_IDENTITY,
        supportedArtifactVersions: ["mesh-v1"],
        artifactMetadataByCacheKey: new Map([
          [entry.cacheKey, { byteLength: 101, sha256: "c".repeat(64) }]
        ])
      }
    );

    expect(validation.index.entries[0]).toMatchObject({
      status: "corrupt"
    });
    expect(validation.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "OPFS_STALE_SOURCE_IDENTITY" }),
        expect.objectContaining({
          code: "OPFS_UNSUPPORTED_ARTIFACT_VERSION"
        }),
        expect.objectContaining({ code: "OPFS_BYTE_LENGTH_MISMATCH" }),
        expect.objectContaining({ code: "OPFS_HASH_MISMATCH" })
      ])
    );
  });

  it("reports invalid cache indexes as rebuildable cache problems", async () => {
    const target = createMockOpfsTarget();
    await writeTextToMockOpfs(target, "{not-json");

    const status = await readProjectOpfsCacheStatus(target);

    expect(status).toMatchObject({
      state: "invalid",
      available: true,
      entryCount: 0
    });
    expect(status.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "OPFS_INDEX_INVALID" }),
        expect.objectContaining({ code: "OPFS_CACHE_IGNORED" })
      ])
    );

    await writeTextToMockOpfs(target, JSON.stringify({ version: "old" }));
    const invalidStatus = await readProjectOpfsCacheStatus(target);

    expect(invalidStatus).toMatchObject({
      state: "invalid",
      available: true,
      entryCount: 0
    });
    expect(invalidStatus.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "OPFS_INDEX_INVALID" }),
        expect.objectContaining({ code: "OPFS_CACHE_IGNORED" })
      ])
    );
  });

  it("clears cache data without mutating project source identity", async () => {
    const engine = new CadEngine();
    engine.apply({
      op: "scene.createBox",
      id: "box_cache_source",
      dimensions: { width: 1, height: 1, depth: 1 }
    });

    const before = await exportCadProjectWcad(engine);
    const target = createMockOpfsTarget();
    await writeProjectOpfsCacheIndexForTest(
      target,
      createProjectOpfsCacheIndex([createCacheEntry()])
    );

    const cleared = await clearProjectOpfsCache(target);
    const after = await exportCadProjectWcad(engine);
    const status = await readProjectOpfsCacheStatus(target);

    expect(cleared).toMatchObject({
      state: "cleared",
      available: true,
      entryCount: 0
    });
    expect(status.state).toBe("empty");
    expect(after.sourceIdentity).toEqual(before.sourceIdentity);
    expect(after.manifest.document.schemaVersion).toBe("web-cad.project.v16");
    expect(JSON.stringify(after.sourceIdentity)).not.toMatch(
      /fileHandle|opfsPath|rendererId|meshId|occtId|selectionBufferId|viewport/i
    );
  });

  it("reports clear failures as structured diagnostics", async () => {
    const target = createMockOpfsTarget({
      removeError: new DOMException("Denied", "SecurityError")
    });

    const status = await clearProjectOpfsCache(target);

    expect(status).toMatchObject({
      state: "error",
      available: false
    });
    expect(status.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "OPFS_CLEAR_FAILED" }),
        expect.objectContaining({ code: "OPFS_CACHE_IGNORED" })
      ])
    );
  });
});

const CURRENT_SOURCE_IDENTITY: WcadSourceIdentity = {
  algorithm: "partbench-source-v1",
  sha256: "a".repeat(64)
};

const OTHER_SOURCE_IDENTITY: WcadSourceIdentity = {
  algorithm: "partbench-source-v1",
  sha256: "0".repeat(64)
};

function createCacheEntry(
  overrides: Partial<ProjectOpfsCacheIndexEntry> = {}
): ProjectOpfsCacheIndexEntry {
  const sourceIdentity = overrides.sourceIdentity ?? CURRENT_SOURCE_IDENTITY;
  const artifactKind = overrides.artifactKind ?? "derivedMesh";
  const artifactVersion = overrides.artifactVersion ?? "mesh-v1";
  const keyInput = {
    sourceIdentity,
    artifactKind,
    artifactVersion,
    documentSchemaVersion: "web-cad.project.v16",
    units: "mm",
    kernelVersion: "occt-facade-v1",
    workerVersion: "geometry-worker-v1",
    settingsKey: "tessellation:standard"
  } as const;

  return {
    ...keyInput,
    cacheKey: createProjectOpfsCacheKey(keyInput),
    byteLength: 12,
    sha256: "b".repeat(64),
    createdAt: "2026-06-12T00:00:00.000Z",
    updatedAt: "2026-06-12T00:00:00.000Z",
    status: "valid",
    ...overrides
  };
}

async function writeTextToMockOpfs(
  target: ProjectOpfsCacheTargetLike,
  text: string
): Promise<void> {
  const root = await target.navigator?.storage?.getDirectory?.();

  if (!root) {
    throw new Error("Missing mock OPFS root.");
  }

  const cacheRoot = await root.getDirectoryHandle("partbench-v8-cache", {
    create: true
  });
  const handle = await cacheRoot.getFileHandle("cache-index.json", {
    create: true
  });
  const writable = await handle.createWritable?.();

  if (!writable) {
    throw new Error("Missing mock OPFS writable.");
  }

  await writable.write(text);
  await writable.close();
}

function createMockOpfsTarget(options: { readonly removeError?: Error } = {}) {
  const root = new MockDirectoryHandle(options);

  return {
    navigator: {
      storage: {
        getDirectory: async () => root
      }
    }
  } satisfies ProjectOpfsCacheTargetLike;
}

class MockDirectoryHandle implements ProjectOpfsCacheDirectoryHandleLike {
  private readonly directories = new Map<string, MockDirectoryHandle>();
  private readonly files = new Map<string, string>();

  constructor(
    private readonly options: { readonly removeError?: Error } = {}
  ) {}

  async getDirectoryHandle(
    name: string,
    options?: { readonly create?: boolean }
  ): Promise<ProjectOpfsCacheDirectoryHandleLike> {
    const existing = this.directories.get(name);

    if (existing) {
      return existing;
    }

    if (!options?.create) {
      throw new DOMException("Directory not found.", "NotFoundError");
    }

    const created = new MockDirectoryHandle(this.options);
    this.directories.set(name, created);
    return created;
  }

  async getFileHandle(
    name: string,
    options?: { readonly create?: boolean }
  ): Promise<ProjectOpfsCacheFileHandleLike> {
    if (!this.files.has(name) && !options?.create) {
      throw new DOMException("File not found.", "NotFoundError");
    }

    return new MockFileHandle(name, this.files);
  }

  async removeEntry(name: string): Promise<void> {
    if (this.options.removeError) {
      throw this.options.removeError;
    }

    const removedDirectory = this.directories.delete(name);
    const removedFile = this.files.delete(name);

    if (!removedDirectory && !removedFile) {
      throw new DOMException("Entry not found.", "NotFoundError");
    }
  }
}

class MockFileHandle implements ProjectOpfsCacheFileHandleLike {
  constructor(
    private readonly name: string,
    private readonly files: Map<string, string>
  ) {}

  async getFile(): Promise<ProjectOpfsCacheFileLike> {
    const text = this.files.get(this.name);

    if (text === undefined) {
      throw new DOMException("File not found.", "NotFoundError");
    }

    return {
      text: async () => text
    };
  }

  async createWritable(): Promise<ProjectOpfsCacheWritableLike> {
    let nextText = "";

    return {
      write: (data: string | Uint8Array) => {
        nextText =
          typeof data === "string" ? data : new TextDecoder().decode(data);
      },
      close: () => {
        this.files.set(this.name, nextText);
      }
    };
  }
}
