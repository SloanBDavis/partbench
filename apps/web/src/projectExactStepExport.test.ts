import {
  CadEngine,
  createCadProjectSourceIdentity,
  createV15ReleaseSampleBatch,
  encodeWcadCanonicalCbor,
  sha256Hex,
  type CadFeatureSummary,
  type WcadTopologyCheckpointPayloadInput
} from "@web-cad/cad-core";
import type {
  CadBodyDerivedExactMetadataSnapshot,
  CadBodySnapshot,
  ProjectExactExportQueryResponse
} from "@web-cad/cad-protocol";
import type {
  GeometryKernelExactBodyArtifact,
  GeometryWorkerRequest
} from "@web-cad/geometry-worker";
import { describe, expect, it, vi } from "vitest";

import {
  resolveCurrentExactBodies,
  type CurrentExactBodyArtifactDependency
} from "./currentExactBodyResolver";
import { createDerivedGeometrySourcesFromDocument } from "./derivedGeometrySources";
import type {
  DerivedExactBodyArtifactInput,
  DerivedGeometryRuntime
} from "./derivedGeometryRuntime";
import type {
  ExactArtifactCacheCandidate,
  ExactArtifactOpfsCache
} from "./exactArtifactOpfsCache";
import {
  buildCurrentExactBodyArtifacts,
  downloadProjectExactStepArtifact,
  executeProjectExactStepExport,
  isExactExportPlanCurrent
} from "./projectExactStepExport";

type ExportRuntime = Pick<
  DerivedGeometryRuntime,
  "exactBodyArtifact" | "executeExactStepExport" | "getModelWorkSnapshot"
> & {
  readonly artifactInputs: DerivedExactBodyArtifactInput[];
  readonly writerRequests: GeometryWorkerRequest[];
};

describe("projectExactStepExport", () => {
  it("retains validated exact artifact evidence and rechecks existing maps", async () => {
    const current = createFixture();
    const plan = current.exactExport.plan;
    const resolution = current.resolutions.find(
      (candidate) => candidate.status === "ready"
    );
    if (!plan || resolution?.status !== "ready") {
      throw new Error("Expected one ready exact artifact fixture.");
    }
    let built: GeometryKernelExactBodyArtifact | undefined;
    const runtime = createRuntime({
      mutateArtifact: (artifact) => {
        built = withViewportPickMap(artifact);
        return built;
      }
    });

    const [retained] = await buildCurrentExactBodyArtifacts({
      engine: current.engine,
      resolutions: [resolution],
      runtime,
      documentSourceIdentity: plan.sourceIdentity,
      units: plan.units,
      assertCurrent: () => undefined
    });

    if (!built?.viewportPickMap) {
      throw new Error("Expected one built exact artifact with pick evidence.");
    }
    expect(retained).toBe(built);
    expect(retained?.viewportPickMap).toMatchObject({
      topologySignature: built?.topologySnapshot.signature
    });

    const [rechecked] = await buildCurrentExactBodyArtifacts({
      engine: current.engine,
      resolutions: [resolution],
      runtime,
      documentSourceIdentity: plan.sourceIdentity,
      units: plan.units,
      assertCurrent: () => undefined,
      existingArtifacts: [
        {
          ...built,
          viewportPickMap: {
            ...built.viewportPickMap,
            topologySignature: "stale-topology"
          }
        }
      ]
    });
    expect(rechecked?.viewportPickMap).toBeUndefined();
    expect(rechecked?.viewportPickMapDowngrade).toEqual({ status: "invalid" });

    const builtWithoutPickMap = { ...built };
    delete builtWithoutPickMap.viewportPickMap;
    const resourceLimited = {
      ...builtWithoutPickMap,
      viewportPickMapDowngrade: { status: "resource-limited" as const }
    };
    const [limited] = await buildCurrentExactBodyArtifacts({
      engine: current.engine,
      resolutions: [resolution],
      runtime,
      documentSourceIdentity: plan.sourceIdentity,
      units: plan.units,
      assertCurrent: () => undefined,
      existingArtifacts: [resourceLimited]
    });
    expect(limited).toBe(resourceLimited);
  });

  it("builds artifacts and writes direct STEP bytes in selected plan order", async () => {
    const fixture = createFixture();
    const runtime = createRuntime();
    const progress = vi.fn();
    const result = await executeProjectExactStepExport({
      ...fixture,
      runtime,
      onProgress: progress
    });

    expect(result).toMatchObject({
      format: "step",
      schema: "AP242DIS",
      units: "mm",
      fileName: "partbench-export.step",
      mimeType: "model/step",
      bodyCount: 3,
      byteLength: 3
    });
    expect([...result.bytes]).toEqual([7, 8, 9]);
    expect(runtime.artifactInputs.map(({ bodyId }) => bodyId)).toEqual([
      "body:z",
      "body:n",
      "body:a"
    ]);
    const writer = runtime.writerRequests[0];
    expect(writer?.payload.op).toBe("geometry.exportStep");
    if (writer?.payload.op === "geometry.exportStep") {
      expect(
        writer.payload.bodies.map(({ bodyId, bodyName }) => ({
          bodyId,
          bodyName
        }))
      ).toEqual([
        { bodyId: "body:z", bodyName: "Bracket Ω" },
        { bodyId: "body:n", bodyName: "body:n" },
        { bodyId: "body:a", bodyName: "Bracket Ω" }
      ]);
      expect(
        writer.payload.bodies.every(
          (body) =>
            body.brepFormat === "occt-brep" &&
            !("profile" in body) &&
            !("kind" in body)
        )
      ).toBe(true);
    }
    expect(progress.mock.calls.map(([entry]) => entry)).toEqual([
      { phase: "building", completedBodyCount: 0, totalBodyCount: 3 },
      {
        phase: "building",
        completedBodyCount: 1,
        totalBodyCount: 3,
        bodyId: "body:z"
      },
      {
        phase: "building",
        completedBodyCount: 2,
        totalBodyCount: 3,
        bodyId: "body:n"
      },
      {
        phase: "building",
        completedBodyCount: 3,
        totalBodyCount: 3,
        bodyId: "body:a"
      },
      { phase: "writing", completedBodyCount: 3, totalBodyCount: 3 }
    ]);
  });

  it("cold-writes and warm-validates artifacts without rebuilding feature sources", async () => {
    const fixture = createFixture();
    const candidates = new Map<string, ExactArtifactCacheCandidate>();
    const cache: Pick<ExactArtifactOpfsCache, "read" | "write"> = {
      async read({ identity, validate }) {
        const candidate = candidates.get(identity.bodySourceIdentitySignature);
        return candidate
          ? { status: "hit", artifact: await validate(candidate) }
          : { status: "miss", reason: "absent" };
      },
      async write({ artifact }) {
        candidates.set(artifact.bodySourceIdentitySignature, {
          sourceKind: artifact.sourceKind,
          shapePolicy: artifact.shapePolicy,
          brepFormat: artifact.brepFormat,
          brepWriter: artifact.brepWriter,
          brepBytes: artifact.brepBytes,
          brepByteLength: artifact.brepByteLength,
          brepSha256: artifact.brepSha256,
          topologySignature: artifact.topologySnapshot.signature
        });
        return {
          status: "stored",
          evictedEntryCount: 0,
          entryCount: candidates.size,
          byteLength: [...candidates.values()].reduce(
            (sum, candidate) => sum + candidate.brepByteLength,
            0
          )
        };
      }
    };
    const cold = createRuntime();
    await executeProjectExactStepExport({
      ...fixture,
      runtime: cold,
      artifactCache: cache
    });
    expect(
      cold.artifactInputs.every(({ source }) => source.kind !== "bodyArtifact")
    ).toBe(true);

    const warm = createRuntime();
    await executeProjectExactStepExport({
      ...fixture,
      runtime: warm,
      artifactCache: cache
    });
    expect(warm.artifactInputs).toHaveLength(3);
    expect(
      warm.artifactInputs.every(({ source }) => source.kind === "bodyArtifact")
    ).toBe(true);
  });

  it("builds a verified artifact leaf before a downstream result", async () => {
    const engine = new CadEngine();
    engine.applyBatch(createV15ReleaseSampleBatch("v15-linear-pattern").ops);
    const structure = getStructure(engine);
    const pattern = structure.features.find(
      (feature) => feature.kind === "linearPattern"
    );
    if (!pattern) throw new Error("Expected linear pattern fixture.");
    const fixture = createFixtureForEngine(engine, [pattern.bodyId]);
    const runtime = createRuntime();

    await executeProjectExactStepExport({ ...fixture, runtime });

    expect(runtime.artifactInputs.map(({ bodyId }) => bodyId)).toEqual([
      pattern.seedBodyId,
      pattern.bodyId
    ]);
    expect(runtime.artifactInputs[1]?.source).toMatchObject({
      kind: "artifactLinearPattern",
      seed: {
        kind: "bodyArtifact",
        bodyId: pattern.seedBodyId,
        brepBytes: new Uint8Array([1])
      }
    });
    expect(runtime.artifactInputs[1]?.sourceGraphNodeCount).toBe(2);
  });

  it("resolves a named shell face against the dependency artifact topology", async () => {
    const engine = new CadEngine();
    engine.applyBatch(createV15ReleaseSampleBatch("v15-shell").ops);
    const shell = getStructure(engine).features.find(
      (feature) => feature.kind === "shell"
    );
    if (!shell) throw new Error("Expected shell fixture.");
    const stableId = `generated:face:${shell.targetBodyId}:endCap`;
    const identity = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "body.topologyIdentity", bodyId: shell.targetBodyId }
    });
    if (!identity.ok || identity.query !== "body.topologyIdentity") {
      throw new Error("Expected shell target topology identity.");
    }
    const face = identity.candidates.find(
      (candidate) => candidate.stableId === stableId
    );
    if (!face) throw new Error("Expected generated shell face candidate.");
    const fixture = createFixtureForEngine(engine, [shell.bodyId]);
    let dependencyArtifact: GeometryKernelExactBodyArtifact | undefined;
    let pickMapBefore:
      | GeometryKernelExactBodyArtifact["viewportPickMap"]
      | undefined;
    const runtime = createRuntime({
      topologyEntitiesByBodyId: new Map([
        [
          shell.targetBodyId,
          [
            {
              localId: "snapshot-local:face:4",
              kind: "face" as const,
              signature: "raw-face-signature",
              bounds: {
                min: [-50, -40, 50],
                max: [50, 40, 50]
              }
            }
          ]
        ]
      ]),
      mutateArtifact: (artifact) => {
        if (artifact.bodyId !== shell.targetBodyId) return artifact;
        dependencyArtifact = {
          ...artifact,
          viewportPickMap: {
            version: "partbench.exact-pick-map.v1",
            bodyId: artifact.bodyId,
            bodySourceIdentitySignature: artifact.bodySourceIdentitySignature,
            topologySignature: artifact.topologySnapshot.signature,
            meshVertexCount: 3,
            meshTriangleCount: 1,
            faces: [
              {
                localId: "snapshot-local:face:4",
                entitySignature: "raw-face-signature"
              }
            ],
            edges: [],
            vertices: [],
            faceTriangleRanges: new Uint32Array([0, 1]),
            edgePointRanges: new Uint32Array(),
            edgePoints: new Float64Array(),
            vertexPoints: new Float64Array()
          }
        };
        pickMapBefore = structuredClone(dependencyArtifact.viewportPickMap);
        return dependencyArtifact;
      }
    });

    await executeProjectExactStepExport({ ...fixture, runtime });

    expect(runtime.artifactInputs).toHaveLength(2);
    expect(runtime.artifactInputs[1]).toMatchObject({
      bodyId: shell.bodyId,
      source: {
        kind: "artifactShell",
        target: { bodyId: shell.targetBodyId },
        openFaces: [{ localId: "snapshot-local:face:4" }]
      }
    });
    expect(
      dependencyArtifact?.topologySnapshot.entities.find(
        ({ localId }) => localId === "snapshot-local:face:4"
      )?.signature
    ).toBe("raw-face-signature");
    expect(dependencyArtifact?.viewportPickMap).toEqual(pickMapBefore);
  });

  it("blocks a shell face missing from the current dependency topology", async () => {
    const engine = new CadEngine();
    engine.applyBatch(createV15ReleaseSampleBatch("v15-shell").ops);
    const shell = getStructure(engine).features.find(
      (feature) => feature.kind === "shell"
    );
    if (!shell) throw new Error("Expected shell fixture.");
    const fixture = createFixtureForEngine(engine, [shell.bodyId]);
    const runtime = createRuntime();

    await expect(
      executeProjectExactStepExport({ ...fixture, runtime })
    ).rejects.toMatchObject({ code: "EXPORT_EXACT_ARTIFACT_INVALID" });
    expect(runtime.artifactInputs.map(({ bodyId }) => bodyId)).toEqual([
      shell.targetBodyId
    ]);
  });

  it("resolves a topology anchor by its current checkpoint-local face id", async () => {
    const { fixture, shell } = createShellCheckpointAnchorFixture();
    const runtime = createRuntime({
      topologyEntitiesByBodyId: new Map([
        [
          shell.targetBodyId,
          [
            {
              localId: "snapshot-local:face:4",
              kind: "face" as const,
              signature: "current-shell-face"
            }
          ]
        ]
      ])
    });

    await executeProjectExactStepExport({ ...fixture, runtime });

    expect(runtime.artifactInputs[1]?.source).toMatchObject({
      kind: "artifactShell",
      openFaces: [{ localId: "snapshot-local:face:4" }]
    });
  });

  it("prefers checkpoint-local face proof when the anchor also has a semantic role", async () => {
    const { fixture, shell } = createShellCheckpointAnchorFixture(
      "active",
      true
    );
    const runtime = createRuntime({
      topologyEntitiesByBodyId: new Map([
        [
          shell.targetBodyId,
          [
            {
              localId: "snapshot-local:face:4",
              kind: "face" as const,
              signature: "imported-shell-face"
            }
          ]
        ]
      ])
    });

    await executeProjectExactStepExport({ ...fixture, runtime });

    expect(runtime.artifactInputs[1]?.source).toMatchObject({
      kind: "artifactShell",
      openFaces: [{ localId: "snapshot-local:face:4" }]
    });
  });

  it.each([
    ["missing", []],
    [
      "ambiguous",
      [
        {
          localId: "snapshot-local:face:4",
          kind: "face" as const,
          signature: "first-shell-face"
        },
        {
          localId: "snapshot-local:face:4",
          kind: "face" as const,
          signature: "second-shell-face"
        }
      ]
    ],
    [
      "non-face",
      [
        {
          localId: "snapshot-local:face:4",
          kind: "edge" as const,
          signature: "current-shell-edge"
        }
      ]
    ]
  ] as const)(
    "blocks a %s checkpoint-local shell topology anchor",
    async (_case, topologyEntities) => {
      const { fixture, shell } = createShellCheckpointAnchorFixture();
      const runtime = createRuntime({
        topologyEntitiesByBodyId: new Map([
          [shell.targetBodyId, topologyEntities]
        ])
      });

      await expect(
        executeProjectExactStepExport({ ...fixture, runtime })
      ).rejects.toMatchObject({ code: "EXPORT_EXACT_ARTIFACT_INVALID" });
      expect(runtime.artifactInputs.map(({ bodyId }) => bodyId)).toEqual([
        shell.targetBodyId
      ]);
    }
  );

  it("blocks a stale shell topology anchor", async () => {
    const { fixture, shell } = createShellCheckpointAnchorFixture("stale");
    const runtime = createRuntime({
      topologyEntitiesByBodyId: new Map([
        [
          shell.targetBodyId,
          [
            {
              localId: "snapshot-local:face:4",
              kind: "face" as const,
              signature: "current-shell-face"
            }
          ]
        ]
      ])
    });

    await expect(
      executeProjectExactStepExport({ ...fixture, runtime })
    ).rejects.toMatchObject({ code: "EXPORT_EXACT_ARTIFACT_INVALID" });
    expect(runtime.artifactInputs.map(({ bodyId }) => bodyId)).toEqual([
      shell.targetBodyId
    ]);
  });

  it("reports the shell multi-solid policy before building the result", async () => {
    const engine = new CadEngine();
    engine.applyBatch(createV15ReleaseSampleBatch("v15-shell").ops);
    const shell = getStructure(engine).features.find(
      (feature) => feature.kind === "shell"
    );
    if (!shell) throw new Error("Expected shell fixture.");
    const fixture = createFixtureForEngine(engine, [shell.bodyId]);
    const runtime = createRuntime({
      topologySolidCountByBodyId: new Map([[shell.targetBodyId, 2]])
    });

    await expect(
      executeProjectExactStepExport({ ...fixture, runtime })
    ).rejects.toMatchObject({ code: "SHELL_TARGET_MULTI_SOLID_UNSUPPORTED" });
    expect(runtime.artifactInputs.map(({ bodyId }) => bodyId)).toEqual([
      shell.targetBodyId
    ]);
  });

  it("preflights cycles and dependency limits before geometry and memoizes sharing", async () => {
    const patternEngine = new CadEngine();
    patternEngine.applyBatch(
      createV15ReleaseSampleBatch("v15-linear-pattern").ops
    );
    const patternFeature = getStructure(patternEngine).features.find(
      (feature) => feature.kind === "linearPattern"
    );
    if (!patternFeature) throw new Error("Expected linear pattern fixture.");
    const patternFixture = createFixtureForEngine(patternEngine, [
      patternFeature.bodyId
    ]);
    const patternResolution = patternFixture.resolutions.find(
      (resolution) => resolution.bodyId === patternFeature.bodyId
    );
    if (
      patternResolution?.status !== "ready" ||
      !patternResolution.artifactDependency
    ) {
      throw new Error("Expected ready pattern dependency.");
    }
    const cycle = patternResolution.artifactDependency;
    (
      cycle as CurrentExactBodyArtifactDependency & {
        artifactDependency: CurrentExactBodyArtifactDependency;
      }
    ).artifactDependency = cycle;
    const cycleRuntime = createRuntime();
    await expect(
      executeProjectExactStepExport({
        ...patternFixture,
        resolutions: [patternResolution],
        runtime: cycleRuntime
      })
    ).rejects.toMatchObject({ code: "EXPORT_EXACT_ARTIFACT_INVALID" });
    expect(cycleRuntime.artifactInputs).toEqual([]);

    const limitFixture = createFixtureForEngine(patternEngine, [
      patternFeature.bodyId
    ]);
    const limitResolution = limitFixture.resolutions.find(
      (resolution) => resolution.bodyId === patternFeature.bodyId
    );
    if (
      limitResolution?.status !== "ready" ||
      !limitResolution.artifactDependency
    ) {
      throw new Error("Expected fresh pattern dependency.");
    }
    let overLimitDependency = limitResolution.artifactDependency;
    for (let index = 0; index < 4_095; index += 1) {
      overLimitDependency = {
        ...limitResolution.artifactDependency,
        bodyId: `limit-body-${index}`,
        sourceIdentitySignature: `body-topology-source:v1:${index}`,
        cacheKeySha256: index.toString(16).padStart(64, "0"),
        artifactDependency: overLimitDependency
      };
    }
    const limitRuntime = createRuntime();
    await expect(
      executeProjectExactStepExport({
        ...limitFixture,
        resolutions: [
          { ...limitResolution, artifactDependency: overLimitDependency }
        ],
        runtime: limitRuntime
      })
    ).rejects.toMatchObject({ code: "EXPORT_EXACT_ARTIFACT_LIMIT_EXCEEDED" });
    expect(limitRuntime.artifactInputs).toEqual([]);

    const base = createFixture();
    const sharedFixture = createFixtureForEngine(base.engine, [
      "body:z",
      "body:n"
    ]);
    const dependency = sharedFixture.resolutions.find(
      (resolution) => resolution.bodyId === "body:a"
    );
    if (dependency?.status !== "ready") {
      throw new Error("Expected shared dependency fixture.");
    }
    const resolutions = sharedFixture.resolutions.map((resolution) => {
      if (
        resolution.status !== "ready" ||
        (resolution.bodyId !== "body:z" && resolution.bodyId !== "body:n")
      ) {
        return resolution;
      }
      return {
        ...resolution,
        source: {
          ...patternResolution.source,
          id: resolution.bodyId,
          sourceIdentitySignature: resolution.sourceIdentitySignature
        },
        artifactDependency: dependency
      };
    });
    const sharedRuntime = createRuntime();
    await executeProjectExactStepExport({
      ...sharedFixture,
      resolutions,
      runtime: sharedRuntime
    });
    expect(
      sharedRuntime.artifactInputs.filter(({ bodyId }) => bodyId === "body:a")
    ).toHaveLength(1);
    expect(sharedRuntime.artifactInputs.map(({ bodyId }) => bodyId)).toEqual([
      "body:a",
      "body:z",
      "body:n"
    ]);
  });

  it("rejects source changes before and during artifact construction", async () => {
    const before = createFixture();
    before.engine.apply({ op: "scene.renameObject", id: "z", name: "Changed" });
    await expect(
      executeProjectExactStepExport({ ...before, runtime: createRuntime() })
    ).rejects.toMatchObject({ code: "EXPORT_SOURCE_CHANGED" });

    const during = createFixture();
    const runtime = createRuntime({
      onArtifact(index) {
        if (index === 0) {
          during.engine.apply({
            op: "scene.renameObject",
            id: "z",
            name: "Changed during artifact"
          });
        }
      }
    });
    await expect(
      executeProjectExactStepExport({ ...during, runtime })
    ).rejects.toMatchObject({ code: "EXPORT_SOURCE_CHANGED" });
    expect(runtime.writerRequests).toEqual([]);
  });

  it("rejects source changes during STEP writing and immediately before download", async () => {
    const fixture = createFixture();
    const runtime = createRuntime({
      onWriter() {
        fixture.engine.apply({
          op: "scene.renameObject",
          id: "a",
          name: "Changed during writer"
        });
      }
    });
    await expect(
      executeProjectExactStepExport({ ...fixture, runtime })
    ).rejects.toMatchObject({ code: "EXPORT_SOURCE_CHANGED" });

    const current = createFixture();
    const result = await executeProjectExactStepExport({
      ...current,
      runtime: createRuntime()
    });
    expect(isExactExportPlanCurrent(current.engine, result.plan)).toBe(true);
    current.engine.apply({
      op: "scene.renameObject",
      id: "n",
      name: "Changed before Blob"
    });
    expect(isExactExportPlanCurrent(current.engine, result.plan)).toBe(false);
  });

  it("replans current exact output across edit, undo, and redo", async () => {
    const initial = createFixture();
    const initialSignatures = new Map(
      ["body:a", "body:n", "body:z"].map((bodyId) => [
        bodyId,
        getBodySourceIdentitySignature(initial.engine, bodyId)
      ])
    );
    initial.engine.apply({
      op: "scene.updateBoxDimensions",
      id: "z",
      dimensions: { width: 2, height: 2, depth: 3 }
    });
    expect(
      isExactExportPlanCurrent(initial.engine, initial.exactExport.plan!)
    ).toBe(false);
    expect(getBodySourceIdentitySignature(initial.engine, "body:a")).toBe(
      initialSignatures.get("body:a")
    );
    expect(getBodySourceIdentitySignature(initial.engine, "body:n")).toBe(
      initialSignatures.get("body:n")
    );
    expect(getBodySourceIdentitySignature(initial.engine, "body:z")).not.toBe(
      initialSignatures.get("body:z")
    );

    const edited = createFixtureForEngine(initial.engine);
    await expect(
      executeProjectExactStepExport({ ...edited, runtime: createRuntime() })
    ).resolves.toMatchObject({ bodyCount: 3 });

    initial.engine.undo();
    expect(
      isExactExportPlanCurrent(initial.engine, edited.exactExport.plan!)
    ).toBe(false);
    await expect(
      executeProjectExactStepExport({
        ...createFixtureForEngine(initial.engine),
        runtime: createRuntime()
      })
    ).resolves.toMatchObject({ bodyCount: 3 });

    initial.engine.redo();
    await expect(
      executeProjectExactStepExport({
        ...createFixtureForEngine(initial.engine),
        runtime: createRuntime()
      })
    ).resolves.toMatchObject({ bodyCount: 3 });
  });

  it("rejects a pending old-project export after project replacement", async () => {
    const fixture = createFixture();
    const runtime = createRuntime({
      onArtifact() {
        fixture.engine.loadProject(new CadEngine().exportProject());
      }
    });

    await expect(
      executeProjectExactStepExport({ ...fixture, runtime })
    ).rejects.toMatchObject({ code: "EXPORT_SOURCE_CHANGED" });
    expect(runtime.writerRequests).toEqual([]);
    expect(getStructure(fixture.engine).bodies).toEqual([]);
  });

  it("retains the current source when project replacement validation fails", () => {
    const fixture = createFixture();
    const sourceIdentity = createCadProjectSourceIdentity(
      fixture.engine.exportProject()
    );
    const invalidProject = {
      ...fixture.engine.exportProject(),
      schemaVersion: "web-cad.project.v999"
    } as unknown as Parameters<CadEngine["loadProject"]>[0];

    expect(() => fixture.engine.loadProject(invalidProject)).toThrow();
    expect(
      createCadProjectSourceIdentity(fixture.engine.exportProject())
    ).toEqual(sourceIdentity);
    expect(
      isExactExportPlanCurrent(fixture.engine, fixture.exactExport.plan!)
    ).toBe(true);
  });

  it("rejects mismatched artifact evidence before the writer", async () => {
    const fixture = createFixture();
    const runtime = createRuntime({
      mutateArtifact(artifact) {
        return { ...artifact, bodyId: "wrong-body" };
      }
    });
    await expect(
      executeProjectExactStepExport({ ...fixture, runtime })
    ).rejects.toMatchObject({ code: "EXPORT_EXACT_ARTIFACT_INVALID" });
    expect(runtime.writerRequests).toEqual([]);
  });

  it("preserves cancellation and structures artifact and writer failures", async () => {
    const cancelled = createFixture();
    const cancellation = new Error("Export cancelled.");
    cancellation.name = "GeometryJobGenerationError";
    await expect(
      executeProjectExactStepExport({
        ...cancelled,
        runtime: createRuntime({ artifactError: cancellation })
      })
    ).rejects.toBe(cancellation);

    const artifactFailure = createFixture();
    await expect(
      executeProjectExactStepExport({
        ...artifactFailure,
        runtime: createRuntime({ artifactError: new Error("OCCT failed") })
      })
    ).rejects.toMatchObject({ code: "EXPORT_EXACT_ARTIFACT_FAILED" });

    const writerFailure = createFixture();
    await expect(
      executeProjectExactStepExport({
        ...writerFailure,
        runtime: createRuntime({ writerError: "XDE unavailable" })
      })
    ).rejects.toMatchObject({ code: "EXPORT_EXACT_WRITER_FAILED" });

    const rejectedWriter = createFixture();
    await expect(
      executeProjectExactStepExport({
        ...rejectedWriter,
        runtime: createRuntime({ writerReject: new Error("Worker stopped") })
      })
    ).rejects.toMatchObject({ code: "EXPORT_EXACT_WRITER_FAILED" });
  });

  it("rejects invalid writer output and unavailable plans without bytes", async () => {
    const invalidWriter = createFixture();
    await expect(
      executeProjectExactStepExport({
        ...invalidWriter,
        runtime: createRuntime({ writerBodyCount: 2 })
      })
    ).rejects.toMatchObject({ code: "EXPORT_STEP_ARTIFACT_INVALID" });

    const unavailable = createFixture();
    await expect(
      executeProjectExactStepExport({
        ...unavailable,
        exactExport: { ...unavailable.exactExport, available: false },
        runtime: createRuntime()
      })
    ).rejects.toMatchObject({ code: "EXPORT_EXACT_ARTIFACT_INVALID" });
  });

  it("downloads raw STEP bytes and revokes the URL on success or browser failure", async () => {
    const append = vi.fn();
    const remove = vi.fn();
    const click = vi.fn();
    const blobs: Blob[] = [];
    const createObjectURL = vi.fn((blob: Blob) => {
      blobs.push(blob);
      return "blob:exact-step";
    });
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    vi.stubGlobal("document", {
      createElement: vi.fn(() => ({ href: "", download: "", click, remove })),
      body: { append }
    });
    const result = {
      bytes: new Uint8Array([7, 8, 9]),
      fileName: "partbench-export.step" as const,
      mimeType: "model/step" as const
    };

    try {
      downloadProjectExactStepArtifact(result);
      expect([...new Uint8Array(await blobs[0]!.arrayBuffer())]).toEqual([
        7, 8, 9
      ]);
      expect(click).toHaveBeenCalledOnce();
      expect(remove).toHaveBeenCalledOnce();
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:exact-step");

      click.mockImplementationOnce(() => {
        throw new Error("Browser download failed.");
      });
      expect(() => downloadProjectExactStepArtifact(result)).toThrow(
        "Browser download failed."
      );
      expect(remove).toHaveBeenCalledTimes(2);
      expect(revokeObjectURL).toHaveBeenCalledTimes(2);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

function createFixture(): {
  readonly engine: CadEngine;
  readonly exactExport: ProjectExactExportQueryResponse;
  readonly resolutions: ReturnType<typeof resolveCurrentExactBodies>;
} {
  const engine = new CadEngine();
  engine.applyBatch([
    {
      op: "scene.createBox",
      id: "z",
      name: "  Bracket Ω  ",
      dimensions: { width: 1, height: 2, depth: 3 }
    },
    {
      op: "scene.createSphere",
      id: "a",
      name: "Bracket Ω",
      dimensions: { radius: 2 }
    },
    {
      op: "scene.createCylinder",
      id: "n",
      dimensions: { radius: 1, height: 4 }
    }
  ]);
  return createFixtureForEngine(engine);
}

function createFixtureForEngine(
  engine: CadEngine,
  bodyIds: readonly string[] = ["body:z", "body:n", "body:a"],
  checkpointPayloads: readonly WcadTopologyCheckpointPayloadInput[] = []
): {
  readonly engine: CadEngine;
  readonly exactExport: ProjectExactExportQueryResponse;
  readonly resolutions: ReturnType<typeof resolveCurrentExactBodies>;
} {
  const structure = getStructure(engine);
  const signatures = new Map(
    structure.bodies.map((body) => [
      body.id,
      getBodySourceIdentitySignature(engine, body.id)
    ])
  );
  const exactExportResponse = engine.executeQuery({
    version: "cadops.v1",
    query: {
      query: "project.exportExact",
      format: "step",
      bodyIds,
      sourceIdentity: createCadProjectSourceIdentity(engine.exportProject()),
      derivedExactMetadata: structure.bodies.map((body) =>
        createReadyMetadata(body, signatures.get(body.id)!)
      )
    }
  });
  if (
    !exactExportResponse.ok ||
    exactExportResponse.query !== "project.exportExact"
  ) {
    throw new Error("Expected a ready exact export plan.");
  }
  const geometrySources = createDerivedGeometrySourcesFromDocument(
    engine.getDocument(),
    structure.features,
    new Map(),
    signatures
  );
  return {
    engine,
    exactExport: exactExportResponse,
    resolutions: resolveCurrentExactBodies({
      document: engine.getDocument(),
      bodies: structure.bodies,
      features: structure.features,
      geometrySources,
      artifactGeometrySources: createDerivedGeometrySourcesFromDocument(
        engine.getDocument(),
        structure.features,
        new Map(),
        signatures,
        true
      ),
      checkpointPayloads,
      sourceIdentitySignaturesByBodyId: signatures
    })
  };
}

function createShellCheckpointAnchorFixture(
  anchorState: "active" | "stale" = "active",
  withSemanticRole = false
) {
  const authoredEngine = new CadEngine();
  authoredEngine.applyBatch(createV15ReleaseSampleBatch("v15-shell").ops);
  const structure = getStructure(authoredEngine);
  const shell = structure.features.find((feature) => feature.kind === "shell");
  if (!shell) throw new Error("Expected shell fixture.");
  const targetFeature = structure.features.find(
    (feature) => feature.bodyId === shell.targetBodyId
  );
  if (!targetFeature) throw new Error("Expected shell target feature.");
  authoredEngine.applyBatch([
    {
      op: "topology.checkpoint.create",
      checkpointId: "checkpoint_shell_target",
      bodyId: shell.targetBodyId,
      sourceFeatureId: targetFeature.id,
      sourceIdentity: {
        algorithm: "partbench-source-v1",
        sha256:
          "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      },
      status: "active"
    },
    {
      op: "topology.anchor.create",
      anchorId: "anchor_shell_open_face",
      entityKind: "face",
      bodyId: shell.targetBodyId,
      checkpointId: "checkpoint_shell_target",
      checkpointEntityId: "snapshot-local:face:4",
      sourceFeatureId: targetFeature.id,
      ...(withSemanticRole ? { sourceSemanticRole: "imported:face:4" } : {})
    },
    {
      op: "feature.updateShell",
      id: shell.id,
      openFaceRefs: [
        {
          kind: "topologyAnchor",
          bodyId: shell.targetBodyId,
          anchorId: "anchor_shell_open_face"
        }
      ]
    }
  ]);
  const document = authoredEngine.getDocument();
  const topologyIdentity = document.topologyIdentity!;
  const engine =
    anchorState === "active"
      ? authoredEngine
      : new CadEngine({
          ...document,
          topologyIdentity: {
            ...topologyIdentity,
            anchors: topologyIdentity.anchors.map((anchor) => ({
              ...anchor,
              state:
                anchor.anchorId === "anchor_shell_open_face"
                  ? anchorState
                  : anchor.state
            }))
          }
        });
  const brepBytes = new Uint8Array([21, 1]);
  const checkpointPayload: WcadTopologyCheckpointPayloadInput = {
    checkpointId: "checkpoint_shell_target",
    bodyId: shell.targetBodyId,
    sourceFeatureId: targetFeature.id,
    kernel: {
      boundary: "geometry-kernel",
      snapshotAlgorithm: "partbench-derived-topology-snapshot-v1"
    },
    tolerance: {
      linearTolerance: 0.001,
      angularToleranceDegrees: 0.01
    },
    brepBytes,
    brepByteLength: brepBytes.byteLength,
    brepSha256: sha256Hex(brepBytes),
    topologyBytes: encodeWcadCanonicalCbor({
      sourceKind: "extrude",
      signature: "topology:shell-target"
    }),
    signatureBytes: encodeWcadCanonicalCbor({
      checkpointId: "checkpoint_shell_target",
      signatureAlgorithm: "partbench-derived-topology-snapshot-v1",
      signature: "topology:shell-target",
      entityCount: 0,
      entities: []
    })
  };
  return {
    fixture: createFixtureForEngine(
      engine,
      [shell.bodyId],
      [checkpointPayload]
    ),
    shell
  };
}

function getStructure(engine: CadEngine): {
  readonly bodies: readonly CadBodySnapshot[];
  readonly features: readonly CadFeatureSummary[];
} {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "project.structure" }
  });
  if (!response.ok || response.query !== "project.structure") {
    throw new Error("Expected project structure.");
  }
  return response;
}

function getBodySourceIdentitySignature(
  engine: CadEngine,
  bodyId: string
): string {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "body.topology", bodyId }
  });
  if (!response.ok || response.query !== "body.topology") {
    throw new Error(`Expected topology for ${bodyId}.`);
  }
  return response.topology.sourceIdentity.signature;
}

function createReadyMetadata(
  body: CadBodySnapshot,
  sourceIdentitySignature: string
): CadBodyDerivedExactMetadataSnapshot {
  return {
    bodyId: body.id,
    sourceIdentitySignature,
    status: "ready",
    metadata: {
      source: "kernel-derived",
      confidence: "kernel-derived",
      bounds: {
        min: [0, 0, 0],
        max: [1, 1, 1],
        size: [1, 1, 1],
        center: [0.5, 0.5, 0.5]
      },
      volume: 1,
      surfaceArea: 6,
      centroid: [0.5, 0.5, 0.5],
      topologyCounts: {
        solidCount: 1,
        faceCount: 0,
        edgeCount: 0,
        vertexCount: 0
      },
      topologySnapshot: {
        source: "kernel-derived",
        status: "ready",
        entityCounts: {
          bodyCount: 1,
          solidCount: 1,
          faceCount: 0,
          wireCount: 0,
          edgeCount: 0,
          vertexCount: 0,
          loopCount: 0,
          coedgeCount: 0,
          axisCount: 0
        },
        entityCount: 2,
        entities: [
          {
            localId: `body:${body.id}`,
            kind: "body",
            source: "kernel-derived",
            signature: `body:${body.id}`
          },
          {
            localId: `solid:${body.id}:1`,
            kind: "solid",
            source: "kernel-derived",
            signature: `solid:${body.id}:1`
          }
        ],
        unsupportedEntityKinds: [],
        adjacencyAvailable: false,
        signatureAlgorithm: "partbench-derived-topology-snapshot-v1",
        signature: `topology:${body.id}`,
        diagnostics: []
      },
      diagnostics: []
    }
  };
}

function createRuntime(
  options: {
    readonly artifactError?: Error;
    readonly writerError?: string;
    readonly writerReject?: unknown;
    readonly writerBodyCount?: number;
    readonly onArtifact?: (index: number) => void;
    readonly onWriter?: () => void;
    readonly topologyEntitiesByBodyId?: ReadonlyMap<
      string,
      readonly {
        readonly localId: string;
        readonly kind: "face" | "edge";
        readonly signature: string;
        readonly bounds?: {
          readonly min: readonly [number, number, number];
          readonly max: readonly [number, number, number];
        };
      }[]
    >;
    readonly topologySolidCountByBodyId?: ReadonlyMap<string, number>;
    readonly mutateArtifact?: (
      artifact: GeometryKernelExactBodyArtifact
    ) => GeometryKernelExactBodyArtifact;
  } = {}
): ExportRuntime {
  const artifactInputs: DerivedExactBodyArtifactInput[] = [];
  const writerRequests: GeometryWorkerRequest[] = [];
  return {
    artifactInputs,
    writerRequests,
    getModelWorkSnapshot() {
      return {
        generation: 1,
        stopped: false,
        active: false,
        queuedCount: 0,
        cancelledUserKinds: []
      };
    },
    async exactBodyArtifact(input, context) {
      expect(context).toEqual({ intent: "user", userKind: "export" });
      const index = artifactInputs.length;
      artifactInputs.push(input);
      await Promise.resolve();
      if (options.artifactError) throw options.artifactError;
      options.onArtifact?.(index);
      const sourceKind =
        input.source.kind === "bodyArtifact"
          ? input.source.sourceKind
          : input.source.kind;
      const brepBytes =
        input.source.kind === "bodyArtifact"
          ? input.source.brepBytes
          : new Uint8Array([index + 1]);
      const topologyEntities =
        options.topologyEntitiesByBodyId?.get(input.bodyId) ?? [];
      const solidCount =
        options.topologySolidCountByBodyId?.get(input.bodyId) ?? 1;
      const artifactTopologyEntities = [
        {
          localId: `body:${input.bodyId}`,
          kind: "body" as const,
          signature: `body:${input.bodyId}`,
          source: "kernel-derived" as const
        },
        ...Array.from({ length: solidCount }, (_, solidIndex) => ({
          localId: `solid:${input.bodyId}:${solidIndex + 1}`,
          kind: "solid" as const,
          signature: `solid:${input.bodyId}:${solidIndex + 1}`,
          source: "kernel-derived" as const
        })),
        ...topologyEntities.map((entity) => ({
          ...entity,
          source: "kernel-derived" as const
        }))
      ];
      const artifact = {
        artifactVersion: "partbench.exact-body-artifact.v1",
        bodyId: input.bodyId,
        sourceType: input.sourceType,
        documentSourceIdentity: input.documentSourceIdentity,
        bodySourceIdentitySignature: input.bodySourceIdentitySignature,
        sourceCacheKeySha256: input.sourceCacheKeySha256,
        sourceGraphNodeCount: input.sourceGraphNodeCount,
        units: input.units,
        shapePolicy: input.shapePolicy,
        sourceKind,
        brepFormat: "occt-brep",
        brepWriter: "BRepTools.Write_3",
        brepBytes,
        brepByteLength: brepBytes.byteLength,
        brepSha256: sha256Hex(brepBytes),
        metadata: {
          sourceKind,
          bounds: { min: [0, 0, 0], max: [1, 1, 1] },
          volume: 1,
          surfaceArea: 6,
          centroid: [0.5, 0.5, 0.5],
          topologyCounts: {
            solidCount,
            faceCount: topologyEntities.filter(({ kind }) => kind === "face")
              .length,
            edgeCount: topologyEntities.filter(({ kind }) => kind === "edge")
              .length,
            vertexCount: 0
          },
          measurementSource: "kernel-derived",
          measurementConfidence: "kernel-derived",
          diagnostics: []
        },
        topologySnapshot: {
          sourceKind,
          status: "ready",
          entityCounts: {
            bodyCount: 1,
            solidCount,
            faceCount: topologyEntities.filter(({ kind }) => kind === "face")
              .length,
            wireCount: 0,
            loopCount: 0,
            coedgeCount: 0,
            edgeCount: topologyEntities.filter(({ kind }) => kind === "edge")
              .length,
            vertexCount: 0,
            axisCount: 0
          },
          entityCount: artifactTopologyEntities.length,
          entities: artifactTopologyEntities,
          unsupportedEntityKinds: [],
          adjacencyAvailable: false,
          signatureAlgorithm: "partbench-derived-topology-snapshot-v1",
          signature:
            input.source.kind === "bodyArtifact"
              ? input.source.topologySignature
              : `topology:${input.bodyId}`,
          source: "kernel-derived",
          diagnostics: []
        } as GeometryKernelExactBodyArtifact["topologySnapshot"],
        displayMesh: {
          primitive: "extrude",
          positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
          indices: new Uint32Array([0, 1, 2]),
          vertexCount: 3,
          triangleCount: 1,
          faceCount: 1
        }
      } as GeometryKernelExactBodyArtifact;
      return {
        artifact: options.mutateArtifact?.(artifact) ?? artifact,
        metrics: { objectId: input.id, roundTripMs: 1 },
        message: `Built ${input.bodyId}`
      };
    },
    async executeExactStepExport(request) {
      writerRequests.push(request);
      await Promise.resolve();
      options.onWriter?.();
      if (options.writerReject) throw options.writerReject;
      if (options.writerError) {
        return {
          id: request.id,
          version: request.version,
          kind: request.kind,
          payloadId: request.payload.id,
          response: {
            ok: false,
            id: request.payload.id,
            op: "geometry.exportStep",
            error: { code: "KERNEL_FAILURE", message: options.writerError },
            warnings: []
          },
          transferables: []
        };
      }
      const bytes = new Uint8Array([7, 8, 9]);
      return {
        id: request.id,
        version: request.version,
        kind: request.kind,
        payloadId: request.payload.id,
        response: {
          ok: true,
          id: request.payload.id,
          op: "geometry.exportStep",
          artifact: {
            format: "step",
            schema: "AP242DIS",
            units: request.payload.units,
            bodyCount: options.writerBodyCount ?? request.payload.bodies.length,
            byteLength: bytes.byteLength,
            bytes
          },
          warnings: []
        },
        transferables: [bytes.buffer]
      };
    }
  };
}

function withViewportPickMap(
  artifact: GeometryKernelExactBodyArtifact
): GeometryKernelExactBodyArtifact {
  return {
    ...artifact,
    displayMesh: {
      ...artifact.displayMesh,
      positions: new Float32Array(),
      indices: new Uint32Array(),
      vertexCount: 0,
      triangleCount: 0,
      faceCount: 0
    },
    viewportPickMap: {
      version: "partbench.exact-pick-map.v1",
      bodyId: artifact.bodyId,
      bodySourceIdentitySignature: artifact.bodySourceIdentitySignature,
      topologySignature: artifact.topologySnapshot.signature,
      meshVertexCount: 0,
      meshTriangleCount: 0,
      faces: [],
      edges: [],
      vertices: [],
      faceTriangleRanges: new Uint32Array(),
      edgePointRanges: new Uint32Array(),
      edgePoints: new Float64Array(),
      vertexPoints: new Float64Array()
    }
  };
}
