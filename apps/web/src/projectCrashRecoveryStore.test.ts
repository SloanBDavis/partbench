import { CadEngine, exportCadProjectWcad } from "@web-cad/cad-core";
import { describe, expect, it } from "vitest";
import { PROJECT_OPFS_CACHE_ROOT_NAME } from "./projectOpfsCache";
import { EXACT_ARTIFACT_CACHE_NAMESPACE } from "./exactArtifactOpfsCache";
import {
  PROJECT_CRASH_RECOVERY_RECORD_FILE_NAME,
  PROJECT_CRASH_RECOVERY_ROOT_NAME
} from "./projectCrashRecoveryLimits";
import {
  clearCrashRecovery,
  clearCrashRecoveryIfSourceMatches,
  inspectCrashRecovery,
  publishCrashRecoveryGeneration,
  sameSourceIdentity
} from "./projectCrashRecoveryStore";
import type {
  CrashRecoveryDirectoryHandle,
  CrashRecoveryStorageTarget
} from "./projectCrashRecoveryStore";
import { writeCrashRecoveryMarker } from "./projectCrashRecoveryMarker";
import { createProjectOpfsCacheSha256Hex } from "./projectOpfsCache";
import {
  createProjectPortabilityStatus,
  createWcadTopologyCheckpointPayloadInputCache
} from "./projectWcadWorkflow";

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

class MockDirectory implements CrashRecoveryDirectoryHandle {
  readonly directories = new Map<string, MockDirectory>();
  readonly files = new Map<string, Uint8Array | string>();
  quotaError?: Error;
  denyCreate?: boolean;
  constructor(
    options: {
      readonly quotaError?: Error;
      readonly denyCreate?: boolean;
    } = {}
  ) {
    this.quotaError = options.quotaError;
    this.denyCreate = options.denyCreate;
  }

  async getDirectoryHandle(
    name: string,
    options?: { readonly create?: boolean }
  ): Promise<CrashRecoveryDirectoryHandle> {
    const existing = this.directories.get(name);
    if (existing) return existing;
    if (!options?.create) {
      throw new DOMException("Directory not found.", "NotFoundError");
    }
    if (this.denyCreate) {
      throw new DOMException("Permission denied.", "NotAllowedError");
    }
    const created = new MockDirectory({
      quotaError: this.quotaError,
      denyCreate: this.denyCreate
    });
    this.directories.set(name, created);
    return created;
  }

  async getFileHandle(
    name: string,
    options?: { readonly create?: boolean }
  ) {
    if (!this.files.has(name) && !options?.create) {
      throw new DOMException("File not found.", "NotFoundError");
    }
    if (!this.files.has(name) && options?.create) {
      this.files.set(name, new Uint8Array());
    }
    const files = this.files;
    const quotaError = this.quotaError;
    return {
      async getFile() {
        const data = files.get(name);
        if (data === undefined) {
          throw new DOMException("File not found.", "NotFoundError");
        }
        const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
        return {
          size: bytes.byteLength,
          text: async () =>
            typeof data === "string" ? data : new TextDecoder().decode(data),
          arrayBuffer: async () => bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength
          )
        };
      },
      async createWritable() {
        let next = new Uint8Array();
        return {
          write: async (data: string | Uint8Array) => {
            if (quotaError) throw quotaError;
            next =
              typeof data === "string"
                ? new TextEncoder().encode(data)
                : new Uint8Array(data);
          },
          close: async () => {
            files.set(name, next);
          },
          abort: async () => undefined
        };
      }
    };
  }

  async removeEntry(name: string): Promise<void> {
    const removedDir = this.directories.delete(name);
    const removedFile = this.files.delete(name);
    if (!removedDir && !removedFile) {
      throw new DOMException("Entry not found.", "NotFoundError");
    }
  }

  async *keys() {
    yield* this.directories.keys();
    yield* this.files.keys();
  }
}

function createTarget(root = new MockDirectory()): {
  readonly target: CrashRecoveryStorageTarget;
  readonly root: MockDirectory;
} {
  return {
    root,
    target: {
      navigator: {
        storage: {
          getDirectory: async () => root
        }
      }
    }
  };
}

async function createDirtyProject() {
  const engine = new CadEngine();
  engine.applyBatch([
    {
      op: "sketch.create",
      id: "sketch_recovery_store",
      name: "Profile",
      plane: "XY"
    },
    {
      op: "sketch.addRectangle",
      sketchId: "sketch_recovery_store",
      id: "rect_recovery_store",
      center: [0, 0],
      width: 4,
      height: 2
    },
    {
      op: "feature.extrude",
      id: "feat_recovery_store",
      bodyId: "body_recovery_store",
      sketchId: "sketch_recovery_store",
      entityId: "rect_recovery_store",
      depth: 3
    }
  ]);
  const project = engine.exportProject();
  const exported = await exportCadProjectWcad(engine, {
    createdAt: "2026-08-31T06:00:00.000Z",
    modifiedAt: "2026-08-31T06:00:00.000Z"
  });
  return { engine, project, exported };
}

describe("V22 crash recovery store", () => {
  it("does not open OPFS when the marker is absent", async () => {
    let opened = false;
    const target: CrashRecoveryStorageTarget = {
      navigator: {
        storage: {
          getDirectory: async () => {
            opened = true;
            throw new Error("OPFS should not open");
          }
        }
      }
    };
    const inspected = await inspectCrashRecovery(target, new MemoryStorage());
    expect(opened).toBe(false);
    expect(inspected.status.state).toBe("idle");
    expect(inspected.bytes).toBeUndefined();
  });

  it("publishes a validated generation only after write, close, hash, and ordinary read", async () => {
    const { root, target } = createTarget();
    const storage = new MemoryStorage();
    const { project, exported } = await createDirtyProject();
    const published = await publishCrashRecoveryGeneration(
      target,
      {
        exported,
        project,
        projectName: "bracket.wcad",
        committedAt: "2026-08-31T06:00:00.000Z",
        expectedSourceIdentity: exported.sourceIdentity
      },
      storage
    );
    expect(published.published).toBe(true);
    expect(published.status.state).toBe("current");
    expect(published.status.offer?.projectName).toBe("bracket.wcad");
    expect(published.status.offer?.units).toBe(project.document.units);
    expect(published.status.offer?.sourceIdentitySummary).toMatch(/^Source [a-f0-9]{8}$/);
    expect(JSON.stringify(published.status)).not.toMatch(
      /partbench-crash-recovery-v1|g-[0-9a-f-]{8}/i
    );
    expect(storage.getItem("partbench.crash-recovery.marker.v1")).toBeTruthy();

    writeCrashRecoveryMarker(storage);
    const inspected = await inspectCrashRecovery(target, storage);
    expect(inspected.status.state).toBe("current");
    expect(inspected.bytes?.byteLength).toBe(exported.bytes.byteLength);
    expect(inspected.offer?.portabilityLabel).toBe(
      createProjectPortabilityStatus(
        project,
        createWcadTopologyCheckpointPayloadInputCache(exported.checkpointPayloads)
      ).status === "portable-json"
        ? "Portable"
        : inspected.offer?.portabilityLabel
    );
    const recoveryRoot = root.directories.get(PROJECT_CRASH_RECOVERY_ROOT_NAME);
    expect(recoveryRoot).toBeDefined();
    const generationFiles = [...(recoveryRoot?.files.keys() ?? [])].filter(
      (name) => name !== PROJECT_CRASH_RECOVERY_RECORD_FILE_NAME
    );
    expect(generationFiles).toHaveLength(1);
    expect(generationFiles[0]).toMatch(/^g-.+\.wcad$/);
  });

  it("keeps the previous generation when a new write is interrupted before publish", async () => {
    const { root, target } = createTarget();
    const storage = new MemoryStorage();
    const first = await createDirtyProject();
    const published = await publishCrashRecoveryGeneration(
      target,
      {
        exported: first.exported,
        project: first.project,
        projectName: "first.wcad",
        committedAt: "2026-08-31T06:00:00.000Z",
        expectedSourceIdentity: first.exported.sourceIdentity
      },
      storage
    );
    expect(published.published).toBe(true);
    const recoveryRoot = root.directories.get(
      PROJECT_CRASH_RECOVERY_ROOT_NAME
    ) as MockDirectory;
    recoveryRoot.files.set(
      "g-unpublished-orphan.wcad",
      new Uint8Array([1, 2, 3, 4])
    );
    const inspected = await inspectCrashRecovery(target, storage);
    expect(inspected.status.state).toBe("current");
    expect(inspected.offer?.projectName).toBe("first.wcad");
    expect(recoveryRoot.files.has("g-unpublished-orphan.wcad")).toBe(false);
    expect(
      [...recoveryRoot.files.keys()].filter((name) => name.endsWith(".wcad"))
    ).toHaveLength(1);
  });

  it("retains at most two validated generations and drops older than the fallback", async () => {
    const { root, target } = createTarget();
    const storage = new MemoryStorage();
    const first = await createDirtyProject();
    await publishCrashRecoveryGeneration(
      target,
      {
        exported: first.exported,
        project: first.project,
        projectName: "gen-1",
        committedAt: "2026-08-31T06:00:00.000Z",
        expectedSourceIdentity: first.exported.sourceIdentity
      },
      storage
    );
    const secondEngine = new CadEngine();
    secondEngine.applyBatch([
      {
        op: "sketch.create",
        id: "sketch_recovery_store_2",
        name: "Profile",
        plane: "XY"
      },
      {
        op: "sketch.addRectangle",
        sketchId: "sketch_recovery_store_2",
        id: "rect_recovery_store_2",
        center: [0, 0],
        width: 5,
        height: 2
      },
      {
        op: "feature.extrude",
        id: "feat_recovery_store_2",
        bodyId: "body_recovery_store_2",
        sketchId: "sketch_recovery_store_2",
        entityId: "rect_recovery_store_2",
        depth: 4
      }
    ]);
    const secondProject = secondEngine.exportProject();
    const secondExported = await exportCadProjectWcad(secondEngine);
    await publishCrashRecoveryGeneration(
      target,
      {
        exported: secondExported,
        project: secondProject,
        projectName: "gen-2",
        committedAt: "2026-08-31T06:01:00.000Z",
        expectedSourceIdentity: secondExported.sourceIdentity
      },
      storage
    );
    const thirdEngine = new CadEngine();
    thirdEngine.applyBatch([
      {
        op: "sketch.create",
        id: "sketch_recovery_store_3",
        name: "Profile",
        plane: "XY"
      },
      {
        op: "sketch.addRectangle",
        sketchId: "sketch_recovery_store_3",
        id: "rect_recovery_store_3",
        center: [0, 0],
        width: 6,
        height: 2
      },
      {
        op: "feature.extrude",
        id: "feat_recovery_store_3",
        bodyId: "body_recovery_store_3",
        sketchId: "sketch_recovery_store_3",
        entityId: "rect_recovery_store_3",
        depth: 5
      }
    ]);
    const thirdProject = thirdEngine.exportProject();
    const thirdExported = await exportCadProjectWcad(thirdEngine);
    await publishCrashRecoveryGeneration(
      target,
      {
        exported: thirdExported,
        project: thirdProject,
        projectName: "gen-3",
        committedAt: "2026-08-31T06:02:00.000Z",
        expectedSourceIdentity: thirdExported.sourceIdentity
      },
      storage
    );
    const recoveryRoot = root.directories.get(
      PROJECT_CRASH_RECOVERY_ROOT_NAME
    ) as MockDirectory;
    const generationFiles = [...recoveryRoot.files.keys()].filter((name) =>
      name.endsWith(".wcad")
    );
    expect(generationFiles).toHaveLength(2);
    const inspected = await inspectCrashRecovery(target, storage);
    expect(inspected.offer?.projectName).toBe("gen-3");
  });

  it("does not publish a stale write whose source identity no longer matches", async () => {
    const { target } = createTarget();
    const first = await createDirtyProject();
    const second = await createDirtyProject();
    expect(
      sameSourceIdentity(
        first.exported.sourceIdentity,
        second.exported.sourceIdentity
      )
    ).toBe(true);
    const otherEngine = new CadEngine();
    const otherExported = await exportCadProjectWcad(otherEngine);
    const result = await publishCrashRecoveryGeneration(target, {
      exported: first.exported,
      project: first.project,
      projectName: "stale",
      committedAt: "2026-08-31T06:00:00.000Z",
      expectedSourceIdentity: otherExported.sourceIdentity
    });
    expect(result.published).toBe(false);
    expect(result.status.state).toBe("failed");
  });

  it("reports quota failure without dropping a prior valid generation", async () => {
    const root = new MockDirectory();
    const { target } = createTarget(root);
    const storage = new MemoryStorage();
    const first = await createDirtyProject();
    await publishCrashRecoveryGeneration(
      target,
      {
        exported: first.exported,
        project: first.project,
        projectName: "kept",
        committedAt: "2026-08-31T06:00:00.000Z",
        expectedSourceIdentity: first.exported.sourceIdentity
      },
      storage
    );
    const recoveryRoot = root.directories.get(
      PROJECT_CRASH_RECOVERY_ROOT_NAME
    ) as MockDirectory;
    recoveryRoot.quotaError = new DOMException(
      "The quota has been exceeded.",
      "QuotaExceededError"
    );
    const secondEngine = new CadEngine();
    secondEngine.applyBatch([
      {
        op: "sketch.create",
        id: "sketch_recovery_quota",
        name: "Profile",
        plane: "XY"
      },
      {
        op: "sketch.addRectangle",
        sketchId: "sketch_recovery_quota",
        id: "rect_recovery_quota",
        center: [0, 0],
        width: 8,
        height: 2
      },
      {
        op: "feature.extrude",
        id: "feat_recovery_quota",
        bodyId: "body_recovery_quota",
        sketchId: "sketch_recovery_quota",
        entityId: "rect_recovery_quota",
        depth: 1
      }
    ]);
    const secondProject = secondEngine.exportProject();
    const secondExported = await exportCadProjectWcad(secondEngine);
    const failed = await publishCrashRecoveryGeneration(
      target,
      {
        exported: secondExported,
        project: secondProject,
        projectName: "new",
        committedAt: "2026-08-31T06:03:00.000Z",
        expectedSourceIdentity: secondExported.sourceIdentity
      },
      storage
    );
    expect(failed.published).toBe(false);
    const inspected = await inspectCrashRecovery(target, storage);
    expect(inspected.offer?.projectName).toBe("kept");
  });

  it("does not remove derived caches when recovery is cleared", async () => {
    const { root, target } = createTarget();
    await root.getDirectoryHandle(PROJECT_OPFS_CACHE_ROOT_NAME, {
      create: true
    });
    await root.getDirectoryHandle(EXACT_ARTIFACT_CACHE_NAMESPACE, {
      create: true
    });
    const storage = new MemoryStorage();
    const first = await createDirtyProject();
    await publishCrashRecoveryGeneration(
      target,
      {
        exported: first.exported,
        project: first.project,
        projectName: "clear-me",
        committedAt: "2026-08-31T06:00:00.000Z",
        expectedSourceIdentity: first.exported.sourceIdentity
      },
      storage
    );
    const status = await clearCrashRecovery(target, storage);
    expect(status.state).toBe("idle");
    expect(root.directories.has(PROJECT_CRASH_RECOVERY_ROOT_NAME)).toBe(false);
    expect(root.directories.has(PROJECT_OPFS_CACHE_ROOT_NAME)).toBe(true);
    expect(root.directories.has(EXACT_ARTIFACT_CACHE_NAMESPACE)).toBe(true);
    expect(storage.getItem("partbench.crash-recovery.marker.v1")).toBeNull();
  });

  it("reports unavailable OPFS without throwing", async () => {
    const status = await inspectCrashRecovery({}, new MemoryStorage());
    expect(status.status.state).toBe("idle");
    writeCrashRecoveryMarker(new MemoryStorage());
    const indicated = new MemoryStorage();
    writeCrashRecoveryMarker(indicated);
    const unavailable = await inspectCrashRecovery({}, indicated);
    expect(unavailable.status.state).toBe("unavailable");
    expect(unavailable.status.lastResult?.toLowerCase()).toMatch(/unavailable/);
  });

  it("hashes published bytes with the shared SHA-256 primitive", async () => {
    const { exported } = await createDirtyProject();
    const hash = await createProjectOpfsCacheSha256Hex(exported.bytes);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("clears recovery only when the saved source identity matches", async () => {
    const { target } = createTarget();
    const storage = new MemoryStorage();
    const first = await createDirtyProject();
    await publishCrashRecoveryGeneration(
      target,
      {
        exported: first.exported,
        project: first.project,
        projectName: "saved.wcad",
        committedAt: "2026-08-31T06:00:00.000Z",
        expectedSourceIdentity: first.exported.sourceIdentity
      },
      storage
    );
    const otherExported = await exportCadProjectWcad(new CadEngine());
    const kept = await clearCrashRecoveryIfSourceMatches(
      target,
      otherExported.sourceIdentity,
      storage
    );
    expect(kept.state).toBe("current");
    expect(storage.getItem("partbench.crash-recovery.marker.v1")).toBeTruthy();
    const cleared = await clearCrashRecoveryIfSourceMatches(
      target,
      first.exported.sourceIdentity,
      storage
    );
    expect(cleared.state).toBe("idle");
    expect(storage.getItem("partbench.crash-recovery.marker.v1")).toBeNull();
  });
});
