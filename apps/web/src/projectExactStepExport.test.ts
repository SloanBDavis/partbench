import {
  CadEngine,
  createCadProjectSourceIdentity,
  type CadFeatureSummary
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

import { resolveCurrentExactBodies } from "./currentExactBodyResolver";
import { createDerivedGeometrySourcesFromDocument } from "./derivedGeometrySources";
import type {
  DerivedExactBodyArtifactInput,
  DerivedGeometryRuntime
} from "./derivedGeometryRuntime";
import {
  downloadProjectExactStepArtifact,
  executeProjectExactStepExport,
  isExactExportPlanCurrent
} from "./projectExactStepExport";

type ExportRuntime = Pick<
  DerivedGeometryRuntime,
  "exactBodyArtifact" | "executeExactStepExport"
> & {
  readonly artifactInputs: DerivedExactBodyArtifactInput[];
  readonly writerRequests: GeometryWorkerRequest[];
};

describe("projectExactStepExport", () => {
  it("builds artifacts and writes direct STEP bytes in selected plan order", async () => {
    const fixture = createFixture();
    const runtime = createRuntime();
    const result = await executeProjectExactStepExport({
      ...fixture,
      runtime
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

function createFixtureForEngine(engine: CadEngine): {
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
      bodyIds: ["body:z", "body:n", "body:a"],
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
      sourceIdentitySignaturesByBodyId: signatures
    })
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
        faceCount: 6,
        edgeCount: 12,
        vertexCount: 8
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
    async exactBodyArtifact(input, context) {
      expect(context).toEqual({ intent: "user" });
      const index = artifactInputs.length;
      artifactInputs.push(input);
      await Promise.resolve();
      if (options.artifactError) throw options.artifactError;
      options.onArtifact?.(index);
      const brepBytes = new Uint8Array([index + 1]);
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
        sourceKind: input.source.kind,
        brepFormat: "occt-brep",
        brepWriter: "BRepTools.Write_3",
        brepBytes,
        brepByteLength: brepBytes.byteLength,
        brepSha256: String(index + 1).repeat(64),
        metadata: {} as GeometryKernelExactBodyArtifact["metadata"],
        topologySnapshot:
          {} as GeometryKernelExactBodyArtifact["topologySnapshot"]
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
