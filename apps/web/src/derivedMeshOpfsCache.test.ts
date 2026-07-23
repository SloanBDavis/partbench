import { CadEngine, exportCadProjectWcad } from "@web-cad/cad-core";
import type { WcadSourceIdentity } from "@web-cad/cad-protocol";
import type { RenderTriangleMesh } from "@web-cad/renderer";
import { describe, expect, it } from "vitest";
import type { DerivedGeometryResult } from "./derivedGeometryRuntime";
import {
  clearProjectOpfsCache,
  createProjectOpfsCacheIndex,
  createProjectOpfsCacheKey,
  readProjectOpfsCacheStatus,
  writeProjectOpfsCacheIndexForTest,
  type ProjectOpfsCacheDirectoryHandleLike,
  type ProjectOpfsCacheFileHandleLike,
  type ProjectOpfsCacheFileLike,
  type ProjectOpfsCacheIndexEntry,
  type ProjectOpfsCacheTargetLike,
  type ProjectOpfsCacheWritableLike
} from "./projectOpfsCache";
import {
  createDerivedMeshCacheKey,
  decodeDerivedMeshCacheArtifact,
  DERIVED_MESH_CACHE_ARTIFACT_VERSION,
  DERIVED_MESH_CACHE_KERNEL_VERSION,
  DERIVED_MESH_CACHE_SETTINGS_KEY,
  DERIVED_MESH_CACHE_WORKER_VERSION,
  encodeDerivedMeshCacheArtifact,
  readDerivedMeshOpfsCache,
  writeDerivedMeshOpfsCache,
  type DerivedMeshCacheArtifactV1,
  type DerivedMeshCacheContext
} from "./derivedMeshOpfsCache";

describe("derived mesh OPFS cache", () => {
  it("serializes and validates derived mesh artifacts", () => {
    const artifact = createArtifact();
    const bytes = encodeDerivedMeshCacheArtifact(artifact);
    const decoded = decodeDerivedMeshCacheArtifact(bytes);

    expect(decoded).toEqual(artifact);
    expect(() =>
      decodeDerivedMeshCacheArtifact(new TextEncoder().encode('{"bad":true}'))
    ).toThrow("Derived mesh cache artifact has invalid metadata.");
    expect(() =>
      decodeDerivedMeshCacheArtifact(
        encodeDerivedMeshCacheArtifact(
          createArtifact({
            sourceIdentity: {
              algorithm: "partbench-source-v1",
              sha256: "not-a-sha"
            }
          })
        )
      )
    ).toThrow("Derived mesh cache artifact has invalid metadata.");
  });

  it("writes and reads a valid derived visualization mesh artifact", async () => {
    const target = createMockOpfsTarget();
    const sourceKey = "derived-source:box_1";

    const diagnostics = await writeDerivedMeshOpfsCache({
      target,
      context: CURRENT_CONTEXT,
      sourceKey,
      result: createResult("box_1"),
      now: "2026-06-12T00:00:00.000Z"
    });
    const read = await readDerivedMeshOpfsCache({
      target,
      context: CURRENT_CONTEXT,
      sourceKey
    });
    const status = await readProjectOpfsCacheStatus(target, {
      currentSourceIdentity: CURRENT_CONTEXT.sourceIdentity,
      supportedArtifactVersions: [DERIVED_MESH_CACHE_ARTIFACT_VERSION]
    });

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "OPFS_INDEX_MISSING" })
      ])
    );
    expect(read).toMatchObject({
      ok: true,
      result: {
        mesh: { id: "box_1", kind: "mesh" },
        metrics: { objectId: "box_1" }
      }
    });
    expect(status).toMatchObject({
      state: "ready",
      entryCount: 1,
      validEntryCount: 1
    });
  });

  it("round-trips composite generated-reference evidence", async () => {
    const target = createMockOpfsTarget();
    const sourceKey = "derived-source:wire-extrude";
    const context: DerivedMeshCacheContext = {
      ...CURRENT_CONTEXT,
      documentSchemaVersion: "web-cad.project.v21"
    };
    const generatedReferences = {
      status: "ready" as const,
      sourceIdentity: "wire-profile-identity",
      faces: [
        {
          role: "side" as const,
          sourceEntityId: "arc_1",
          surfaceClass: "cylinder" as const,
          evidence: "kernel-builder" as const
        }
      ],
      edges: [
        {
          role: "longitudinal" as const,
          adjacentSourceEntityIds: ["line_1", "arc_1"] as const,
          evidence: "kernel-builder" as const
        }
      ]
    };

    await writeDerivedMeshOpfsCache({
      target,
      context,
      sourceKey,
      result: { ...createResult("body_wire"), generatedReferences }
    });
    const read = await readDerivedMeshOpfsCache({
      target,
      context,
      sourceKey
    });

    expect(read).toMatchObject({
      ok: true,
      result: { generatedReferences }
    });
  });

  it("returns structured diagnostics and marks corrupt artifacts", async () => {
    const target = createMockOpfsTarget();
    const sourceKey = "derived-source:box_1";
    await writeDerivedMeshOpfsCache({
      target,
      context: CURRENT_CONTEXT,
      sourceKey,
      result: createResult("box_1")
    });
    target.cacheRootForTest
      .directoryForTest("artifacts")
      .overwriteOnlyFileForTest(new TextEncoder().encode('{"corrupt":true}'));

    const read = await readDerivedMeshOpfsCache({
      target,
      context: CURRENT_CONTEXT,
      sourceKey
    });
    const status = await readProjectOpfsCacheStatus(target, {
      currentSourceIdentity: CURRENT_CONTEXT.sourceIdentity,
      supportedArtifactVersions: [DERIVED_MESH_CACHE_ARTIFACT_VERSION]
    });

    expect(read).toMatchObject({
      ok: false,
      diagnostics: [
        expect.objectContaining({ code: "OPFS_BYTE_LENGTH_MISMATCH" })
      ]
    });
    expect(status).toMatchObject({
      state: "ready",
      entryCount: 1,
      corruptEntryCount: 1
    });
  });

  it("reports stale, unsupported, unavailable, and denied cache paths", async () => {
    const target = createMockOpfsTarget();
    const sourceKey = "derived-source:box_1";
    await writeDerivedMeshOpfsCache({
      target,
      context: CURRENT_CONTEXT,
      sourceKey,
      result: createResult("box_1")
    });

    const stale = await readDerivedMeshOpfsCache({
      target,
      context: OTHER_CONTEXT,
      sourceKey
    });
    expect(stale.ok).toBe(false);
    expect(stale.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "OPFS_STALE_SOURCE_IDENTITY" })
      ])
    );

    const unsupportedEntry = createCacheEntry({
      sourceIdentity: CURRENT_CONTEXT.sourceIdentity,
      artifactSourceKey: "unsupported-source",
      artifactVersion: "partbench-derived-mesh.v0"
    });
    await writeProjectOpfsCacheIndexForTest(
      target,
      createProjectOpfsCacheIndex([unsupportedEntry])
    );
    const unsupported = await readDerivedMeshOpfsCache({
      target,
      context: CURRENT_CONTEXT,
      sourceKey: "unsupported-source"
    });
    expect(unsupported.ok).toBe(false);
    expect(unsupported.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "OPFS_UNSUPPORTED_ARTIFACT_VERSION"
        })
      ])
    );

    const unavailable = await readDerivedMeshOpfsCache({
      target: {},
      context: CURRENT_CONTEXT,
      sourceKey
    });
    expect(unavailable).toMatchObject({
      ok: false,
      diagnostics: [expect.objectContaining({ code: "OPFS_UNAVAILABLE" })]
    });

    const denied = await readDerivedMeshOpfsCache({
      target: createMockOpfsTarget({
        getDirectoryError: new DOMException("Denied", "SecurityError")
      }),
      context: CURRENT_CONTEXT,
      sourceKey
    });
    expect(denied).toMatchObject({
      ok: false,
      diagnostics: [expect.objectContaining({ code: "OPFS_PERMISSION_DENIED" })]
    });
  });

  it("keeps cache keys and source identity free of browser and renderer internals", async () => {
    const engine = new CadEngine();
    engine.apply({
      op: "scene.createBox",
      id: "box_cache_source",
      dimensions: { width: 1, height: 1, depth: 1 }
    });
    const before = await exportCadProjectWcad(engine);
    const target = createMockOpfsTarget();
    const context: DerivedMeshCacheContext = {
      sourceIdentity: before.sourceIdentity,
      documentSchemaVersion: before.manifest.document.schemaVersion,
      units: engine.getDocument().units
    };
    const sourceKey = "derived-source:box_cache_source";

    await writeDerivedMeshOpfsCache({
      target,
      context,
      sourceKey,
      result: createResult("box_cache_source")
    });
    await clearProjectOpfsCache(target);
    const after = await exportCadProjectWcad(engine);
    const cacheKey = createDerivedMeshCacheKey({ ...context, sourceKey });

    expect(after.sourceIdentity).toEqual(before.sourceIdentity);
    expect(after.manifest.document.schemaVersion).toBe("web-cad.project.v16");
    expect(
      JSON.stringify({ cacheKey, sourceIdentity: after.sourceIdentity })
    ).not.toMatch(
      /fileHandle|localPath|opfsPath|rendererId|meshBufferId|occtId|viewport|selectionBufferId/i
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

const CURRENT_CONTEXT: DerivedMeshCacheContext = {
  sourceIdentity: CURRENT_SOURCE_IDENTITY,
  documentSchemaVersion: "web-cad.project.v16",
  units: "mm"
};

const OTHER_CONTEXT: DerivedMeshCacheContext = {
  ...CURRENT_CONTEXT,
  sourceIdentity: OTHER_SOURCE_IDENTITY
};

function createArtifact(
  overrides: Partial<DerivedMeshCacheArtifactV1> = {}
): DerivedMeshCacheArtifactV1 {
  const sourceKey = overrides.sourceKey ?? "derived-source:box_1";
  const cacheKey =
    overrides.cacheKey ??
    createDerivedMeshCacheKey({ ...CURRENT_CONTEXT, sourceKey });

  return {
    version: DERIVED_MESH_CACHE_ARTIFACT_VERSION,
    artifactKind: "derivedMesh",
    artifactVersion: DERIVED_MESH_CACHE_ARTIFACT_VERSION,
    cacheKey,
    sourceKey,
    sourceIdentity: CURRENT_CONTEXT.sourceIdentity,
    documentSchemaVersion: CURRENT_CONTEXT.documentSchemaVersion,
    units: CURRENT_CONTEXT.units,
    mesh: createMesh("box_1"),
    metrics: createResult("box_1").metrics,
    message: "Displayed derived OCCT mesh for box_1.",
    writtenAt: "2026-06-12T00:00:00.000Z",
    ...overrides
  };
}

function createResult(id: string): DerivedGeometryResult {
  return {
    mesh: createMesh(id),
    metrics: {
      objectId: id,
      roundTripMs: 1,
      vertexCount: 4,
      triangleCount: 2
    },
    message: `Displayed derived OCCT mesh for ${id}.`
  };
}

function createMesh(id: string): RenderTriangleMesh {
  return {
    id,
    kind: "mesh",
    vertices: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 1, 0],
      [0, 1, 0]
    ],
    indices: [0, 1, 2, 0, 2, 3],
    edgeSegments: [
      {
        start: [0, 0, 0],
        end: [1, 0, 0]
      }
    ],
    transform: {
      translation: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    },
    source: "derived",
    label: id
  };
}

function createCacheEntry(
  overrides: Partial<ProjectOpfsCacheIndexEntry> = {}
): ProjectOpfsCacheIndexEntry {
  const sourceIdentity = overrides.sourceIdentity ?? CURRENT_SOURCE_IDENTITY;
  const artifactKind = overrides.artifactKind ?? "derivedMesh";
  const artifactVersion =
    overrides.artifactVersion ?? DERIVED_MESH_CACHE_ARTIFACT_VERSION;
  const artifactSourceKey = overrides.artifactSourceKey ?? "derived-source";
  const keyInput = {
    sourceIdentity,
    artifactKind,
    artifactVersion,
    artifactSourceKey,
    documentSchemaVersion: "web-cad.project.v16",
    units: "mm",
    kernelVersion: DERIVED_MESH_CACHE_KERNEL_VERSION,
    workerVersion: DERIVED_MESH_CACHE_WORKER_VERSION,
    settingsKey: DERIVED_MESH_CACHE_SETTINGS_KEY
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

function createMockOpfsTarget(
  options: {
    readonly getDirectoryError?: Error;
    readonly removeError?: Error;
  } = {}
): ProjectOpfsCacheTargetLike & {
  readonly cacheRootForTest: MockDirectoryHandle;
} {
  const root = new MockDirectoryHandle(options);

  return {
    cacheRootForTest: root.directoryForTest("partbench-v8-cache", true),
    navigator: {
      storage: {
        getDirectory: async () => {
          if (options.getDirectoryError) {
            throw options.getDirectoryError;
          }

          return root;
        }
      }
    }
  };
}

class MockDirectoryHandle implements ProjectOpfsCacheDirectoryHandleLike {
  private readonly directories = new Map<string, MockDirectoryHandle>();
  private readonly files = new Map<string, Uint8Array>();

  constructor(
    private readonly options: {
      readonly getDirectoryError?: Error;
      readonly removeError?: Error;
    } = {}
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

    return this.directoryForTest(name, true);
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

  directoryForTest(name: string, create = false): MockDirectoryHandle {
    const existing = this.directories.get(name);

    if (existing) {
      return existing;
    }

    if (!create) {
      throw new DOMException("Directory not found.", "NotFoundError");
    }

    const created = new MockDirectoryHandle(this.options);
    this.directories.set(name, created);
    return created;
  }

  overwriteOnlyFileForTest(bytes: Uint8Array): void {
    const names = [...this.files.keys()];
    const [name] = names;

    if (names.length !== 1 || !name) {
      throw new Error("Expected exactly one mock file.");
    }

    this.files.set(name, new Uint8Array(bytes));
  }
}

class MockFileHandle implements ProjectOpfsCacheFileHandleLike {
  constructor(
    private readonly name: string,
    private readonly files: Map<string, Uint8Array>
  ) {}

  async getFile(): Promise<ProjectOpfsCacheFileLike> {
    const bytes = this.files.get(this.name);

    if (!bytes) {
      throw new DOMException("File not found.", "NotFoundError");
    }

    return {
      text: async () => new TextDecoder().decode(bytes),
      arrayBuffer: async () => {
        const buffer = new ArrayBuffer(bytes.byteLength);
        new Uint8Array(buffer).set(bytes);
        return buffer;
      }
    };
  }

  async createWritable(): Promise<ProjectOpfsCacheWritableLike> {
    let nextBytes = new Uint8Array();

    return {
      write: (data: string | Uint8Array) => {
        nextBytes =
          typeof data === "string"
            ? new TextEncoder().encode(data)
            : new Uint8Array(data);
      },
      close: () => {
        this.files.set(this.name, nextBytes);
      }
    };
  }
}
