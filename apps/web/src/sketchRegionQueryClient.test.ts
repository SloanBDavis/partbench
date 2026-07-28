import {
  CadEngine,
  exportCadProject,
  exportCadProjectJson,
  type CadProject
} from "@web-cad/cad-core";
import type {
  CadQueryResponse,
  SketchProfileRegionCandidatesQueryResponse
} from "@web-cad/cad-protocol";
import { describe, expect, it, vi } from "vitest";
import type {
  CadQueryExecutionOptions,
  CadQueryWorker,
  CadQueryWorkerRequest,
  DisposableCadQueryWorker
} from "./browserCadQueryWorker";
import {
  SketchRegionCandidateCache,
  SketchRegionQueryClient,
  createSketchRegionRelevantProjectionKey
} from "./sketchRegionQueryClient";
import { CancellableBrowserCadQueryWorker } from "./browserCadQueryWorker";

class ExactEngineQueryWorker implements CadQueryWorker {
  readonly requests: CadQueryWorkerRequest[] = [];

  async executeQuery(
    request: CadQueryWorkerRequest,
    options?: CadQueryExecutionOptions
  ): Promise<CadQueryResponse> {
    this.requests.push(request);
    if (options?.signal?.aborted) {
      const error = new Error("cancelled");
      error.name = "AbortError";
      throw error;
    }
    return CadEngine.fromProject(request.project!).executeQuery(
      request.request
    );
  }
}

class DeferredExactEngineQueryWorker implements CadQueryWorker {
  readonly requests: CadQueryWorkerRequest[] = [];
  readonly completions: Array<() => void> = [];

  executeQuery(request: CadQueryWorkerRequest): Promise<CadQueryResponse> {
    this.requests.push(request);
    return new Promise((resolve) => {
      this.completions.push(() =>
        resolve(
          CadEngine.fromProject(request.project!).executeQuery(request.request)
        )
      );
    });
  }
}

const candidatesRequest = {
  version: "cadops.v1",
  query: {
    query: "sketch.profileRegionCandidates",
    sketchId: "sketch_1"
  }
} as const;

describe("SketchRegionQueryClient", () => {
  it("executes exact engine queries through the query worker", async () => {
    const engine = createRegionEngine();
    const project = exportCadProject(engine);
    const worker = new ExactEngineQueryWorker();
    const client = new SketchRegionQueryClient(worker);

    const response = await client.queryCandidates(project, candidatesRequest);
    const expected =
      CadEngine.fromProject(project).executeQuery(candidatesRequest);

    expect(response).toEqual(expected);
    expect(response).toMatchObject({
      ok: true,
      query: "sketch.profileRegionCandidates",
      status: "ready",
      candidateCount: 4
    });
    expect(worker.requests).toHaveLength(1);
    expect(worker.requests[0]).toMatchObject({
      kind: "cad-worker.query",
      project,
      request: candidatesRequest
    });
  });

  it("reuses relevant-sketch results across unrelated authoritative changes", async () => {
    const engine = createRegionEngine();
    const worker = new ExactEngineQueryWorker();
    const client = new SketchRegionQueryClient(worker);

    const first = await client.queryCandidates(
      exportCadProject(engine),
      candidatesRequest
    );
    engine.applyBatch([
      {
        op: "scene.createBox",
        id: "unrelated_box",
        dimensions: { width: 2, height: 3, depth: 4 }
      }
    ]);
    const second = await client.queryCandidates(
      exportCadProject(engine),
      candidatesRequest
    );

    expect(second).toBe(first);
    expect(worker.requests).toHaveLength(1);
  });

  it("invalidates every page for relevant geometry and construction changes", async () => {
    const engine = createRegionEngine();
    const worker = new ExactEngineQueryWorker();
    const cache = new SketchRegionCandidateCache();
    const client = new SketchRegionQueryClient(worker, { cache });

    const first = await expectCandidateResponse(
      client.queryCandidates(exportCadProject(engine), candidatesRequest)
    );
    engine.applyBatch([
      {
        op: "sketch.updateEntity",
        sketchId: "sketch_1",
        entity: {
          id: "outer",
          kind: "rectangle",
          center: [0, 0],
          width: 24,
          height: 20
        }
      }
    ]);
    const geometryEdited = await expectCandidateResponse(
      client.queryCandidates(exportCadProject(engine), candidatesRequest)
    );
    engine.applyBatch([
      {
        op: "sketch.setEntityConstruction",
        sketchId: "sketch_1",
        entityId: "hole",
        construction: true
      }
    ]);
    const constructionEdited = await expectCandidateResponse(
      client.queryCandidates(exportCadProject(engine), candidatesRequest)
    );

    expect(geometryEdited.sourceRevision).not.toBe(first.sourceRevision);
    expect(constructionEdited.sourceRevision).not.toBe(
      geometryEdited.sourceRevision
    );
    expect(worker.requests).toHaveLength(3);
    expect(cache.size).toBe(1);
  });

  it("binds cache entries to narrowing and exact returned source revisions", async () => {
    const project = exportCadProject(createRegionEngine());
    const worker = new ExactEngineQueryWorker();
    const cache = new SketchRegionCandidateCache();
    const client = new SketchRegionQueryClient(worker, { cache });
    const narrowedRequest = {
      ...candidatesRequest,
      query: {
        ...candidatesRequest.query,
        entityIds: ["other", "outer"]
      }
    };

    const complete = await expectCandidateResponse(
      client.queryCandidates(project, candidatesRequest)
    );
    const narrowed = await expectCandidateResponse(
      client.queryCandidates(project, narrowedRequest)
    );
    await expect(
      client.queryCandidates(project, candidatesRequest)
    ).resolves.toBe(complete);
    await expect(
      client.queryCandidates(project, narrowedRequest)
    ).resolves.toBe(narrowed);

    expect(narrowed.sourceRevision).not.toBe(complete.sourceRevision);
    expect(worker.requests).toHaveLength(2);
    expect(cache.size).toBe(2);
  });

  it("caches later pages by their revision-bound cursor envelope", async () => {
    const project = exportCadProject(createRegionEngine());
    const worker = new ExactEngineQueryWorker();
    const client = new SketchRegionQueryClient(worker);
    const firstRequest = {
      ...candidatesRequest,
      query: { ...candidatesRequest.query, limit: 1 }
    };
    const first = await expectCandidateResponse(
      client.queryCandidates(project, firstRequest)
    );
    expect(first.nextAfterCandidateKey).toBeDefined();
    const nextRequest = {
      ...firstRequest,
      query: {
        ...firstRequest.query,
        afterCandidateKey: first.nextAfterCandidateKey!,
        sourceRevision: first.sourceRevision
      }
    };

    const next = await expectCandidateResponse(
      client.queryCandidates(project, nextRequest)
    );
    await expect(client.queryCandidates(project, nextRequest)).resolves.toBe(
      next
    );

    expect(next.candidates[0]?.candidateKey).not.toBe(
      first.candidates[0]?.candidateKey
    );
    expect(worker.requests).toHaveLength(2);
  });

  it("keeps stale revisions and unknown cursors isolated from valid pages", async () => {
    const project = exportCadProject(createRegionEngine());
    const worker = new ExactEngineQueryWorker();
    const client = new SketchRegionQueryClient(worker);
    const first = await expectCandidateResponse(
      client.queryCandidates(project, {
        ...candidatesRequest,
        query: { ...candidatesRequest.query, limit: 1 }
      })
    );
    const staleRequest = {
      ...candidatesRequest,
      query: {
        ...candidatesRequest.query,
        limit: 1,
        afterCandidateKey: first.nextAfterCandidateKey!,
        sourceRevision: `partbench-source-v1:${"0".repeat(64)}`
      }
    };
    const invalidCursorRequest = {
      ...candidatesRequest,
      query: {
        ...candidatesRequest.query,
        limit: 1,
        afterCandidateKey: "not-a-candidate",
        sourceRevision: first.sourceRevision
      }
    };

    const stale = await expectCandidateResponse(
      client.queryCandidates(project, staleRequest)
    );
    const invalidCursor = await expectCandidateResponse(
      client.queryCandidates(project, invalidCursorRequest)
    );
    const validAgain = await expectCandidateResponse(
      client.queryCandidates(project, {
        ...candidatesRequest,
        query: { ...candidatesRequest.query, limit: 1 }
      })
    );

    expect(stale).toMatchObject({
      status: "blocked",
      diagnostics: [{ code: "SKETCH_REGION_SOURCE_REVISION_STALE" }]
    });
    expect(invalidCursor).toMatchObject({
      status: "blocked",
      diagnostics: [{ code: "SKETCH_REGION_CURSOR_INVALID" }]
    });
    expect(validAgain).toBe(first);
    expect(worker.requests).toHaveLength(3);
  });

  it("evicts the least-recently-used candidate page at the configured bound", async () => {
    const project = exportCadProject(createRegionEngine());
    const worker = new ExactEngineQueryWorker();
    const cache = new SketchRegionCandidateCache({ maxPages: 2 });
    const client = new SketchRegionQueryClient(worker, { cache });
    const requestFor = (entityIds: readonly string[]) => ({
      ...candidatesRequest,
      query: { ...candidatesRequest.query, entityIds }
    });
    const outer = requestFor(["outer"]);
    const hole = requestFor(["hole"]);
    const other = requestFor(["other"]);

    await client.queryCandidates(project, outer);
    await client.queryCandidates(project, hole);
    await client.queryCandidates(project, outer);
    await client.queryCandidates(project, other);
    await client.queryCandidates(project, hole);

    expect(cache.size).toBe(2);
    expect(worker.requests).toHaveLength(4);
  });

  it("does not let an older source completion evict a newer cached revision", async () => {
    const engine = createRegionEngine();
    const oldProject = exportCadProject(engine);
    const worker = new DeferredExactEngineQueryWorker();
    const cache = new SketchRegionCandidateCache();
    const client = new SketchRegionQueryClient(worker, { cache });
    const oldPending = client.queryCandidates(oldProject, candidatesRequest);
    engine.applyBatch([
      {
        op: "sketch.updateEntity",
        sketchId: "sketch_1",
        entity: {
          id: "outer",
          kind: "rectangle",
          center: [0, 0],
          width: 24,
          height: 20
        }
      }
    ]);
    const newProject = exportCadProject(engine);
    const newPending = client.queryCandidates(newProject, candidatesRequest);

    worker.completions[1]?.();
    const newer = await expectCandidateResponse(newPending);
    worker.completions[0]?.();
    const older = await expectCandidateResponse(oldPending);
    const cachedNewer = await expectCandidateResponse(
      client.queryCandidates(newProject, candidatesRequest)
    );

    expect(newer.sourceRevision).not.toBe(older.sourceRevision);
    expect(cachedNewer).toBe(newer);
    expect(worker.requests).toHaveLength(2);
  });

  it("never lets a cache hit bypass strict query-envelope validation", async () => {
    const project = exportCadProject(createRegionEngine());
    const worker = new ExactEngineQueryWorker();
    const cache = new SketchRegionCandidateCache();
    const client = new SketchRegionQueryClient(worker, { cache });
    const validRequest = {
      ...candidatesRequest,
      query: {
        ...candidatesRequest.query,
        entityIds: ["outer"]
      }
    };
    const duplicateIdRequest = {
      ...candidatesRequest,
      query: {
        ...candidatesRequest.query,
        entityIds: ["outer", "outer"]
      }
    };

    await expectCandidateResponse(
      client.queryCandidates(project, validRequest)
    );
    const invalid = await client.queryCandidates(project, duplicateIdRequest);

    expect(invalid).toMatchObject({
      ok: false,
      query: "sketch.profileRegionCandidates"
    });
    expect(worker.requests).toHaveLength(2);
    expect(cache.size).toBe(1);
  });

  it.each([
    [
      "null limit",
      {
        ...candidatesRequest,
        query: { ...candidatesRequest.query, limit: null }
      }
    ],
    [
      "unknown query field",
      {
        ...candidatesRequest,
        query: { ...candidatesRequest.query, unexpected: true }
      }
    ],
    ["unknown envelope field", { ...candidatesRequest, unexpected: true }]
  ])(
    "does not alias a cached first page for a malformed %s",
    async (_label, malformed) => {
      const project = exportCadProject(createRegionEngine());
      const worker = new ExactEngineQueryWorker();
      const cache = new SketchRegionCandidateCache();
      const client = new SketchRegionQueryClient(worker, { cache });

      await expectCandidateResponse(
        client.queryCandidates(project, candidatesRequest)
      );
      const invalid = await client.queryCandidates(
        project,
        malformed as unknown as typeof candidatesRequest
      );

      expect(invalid).toMatchObject({
        ok: false,
        query: "sketch.profileRegionCandidates",
        error: { code: "INVALID_QUERY" }
      });
      expect(worker.requests).toHaveLength(2);
      expect(cache.size).toBe(1);
    }
  );

  it("does not cache an explicit narrowing across unsupported-to-missing changes", async () => {
    const engine = createRegionEngine();
    engine.applyBatch([
      {
        op: "sketch.addPoint",
        sketchId: "sketch_1",
        id: "narrowed_point",
        point: [100, 100]
      }
    ]);
    const worker = new ExactEngineQueryWorker();
    const client = new SketchRegionQueryClient(worker);
    const request = {
      ...candidatesRequest,
      query: {
        ...candidatesRequest.query,
        entityIds: ["narrowed_point"]
      }
    };
    const unsupported = await expectCandidateResponse(
      client.queryCandidates(exportCadProject(engine), request)
    );
    engine.applyBatch([
      {
        op: "sketch.deleteEntity",
        sketchId: "sketch_1",
        entityId: "narrowed_point"
      }
    ]);
    const missing = await expectCandidateResponse(
      client.queryCandidates(exportCadProject(engine), request)
    );

    expect(
      unsupported.diagnostics.map((diagnostic) => diagnostic.code)
    ).toContain("SKETCH_REGION_ENTITY_UNSUPPORTED");
    expect(missing.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "SKETCH_REGION_ENTITY_MISSING"
    );
    expect(missing).not.toBe(unsupported);
    expect(worker.requests).toHaveLength(2);
  });

  it("does not invalidate on sketch names, points, other sketches, history, or redo", () => {
    const base = exportCadProject(createRegionEngine());
    const renamed: CadProject = {
      ...base,
      history: [{ ...base.history[0]!, id: "display_only_history" }],
      redoStack: base.history.slice(0, 1),
      document: {
        ...base.document,
        sketches: [
          {
            ...base.document.sketches[0]!,
            name: "Renamed",
            entities: [
              ...base.document.sketches[0]!.entities,
              {
                id: "point_only",
                kind: "point",
                point: [999, 999],
                construction: false
              }
            ]
          },
          {
            id: "sketch_other",
            name: "Other",
            plane: "XY",
            entities: [
              {
                id: "other_rect",
                kind: "rectangle",
                center: [500, 500],
                width: 10,
                height: 10,
                construction: false
              }
            ]
          }
        ]
      }
    };

    expect(createSketchRegionRelevantProjectionKey(base, "sketch_1")).toBe(
      createSketchRegionRelevantProjectionKey(renamed, "sketch_1")
    );
  });

  it("keeps candidates and cache state out of project persistence", async () => {
    const engine = createRegionEngine();
    const project = exportCadProject(engine);
    const projectBefore = JSON.stringify(project);
    const exportedBefore = exportCadProjectJson(engine);
    const cache = new SketchRegionCandidateCache();
    const client = new SketchRegionQueryClient(new ExactEngineQueryWorker(), {
      cache
    });

    const candidates = await expectCandidateResponse(
      client.queryCandidates(project, candidatesRequest)
    );
    const selected = candidates.candidates[0];
    expect(selected).toBeDefined();
    const validation = await client.validateProfile(project, {
      version: "cadops.v1",
      query: {
        query: "sketch.profileRegionValidate",
        profile: {
          kind: "regions",
          sketchId: "sketch_1",
          regions: [selected!.region]
        }
      }
    });

    expect(validation).toMatchObject({
      ok: true,
      query: "sketch.profileRegionValidate",
      status: "ready"
    });
    expect(cache.size).toBe(1);
    expect(JSON.stringify(project)).toBe(projectBefore);
    expect(exportCadProjectJson(engine)).toBe(exportedBefore);
    expect(exportedBefore).not.toContain("candidateKey");
    expect(exportedBefore).not.toContain("sourceFingerprint");
  });

  it("terminates the dedicated command-worker transport when cancelled", async () => {
    const controller = new AbortController();
    const dispose = vi.fn();
    const executeQuery = vi.fn(
      (_request: CadQueryWorkerRequest, options?: CadQueryExecutionOptions) =>
        new Promise<CadQueryResponse>((_resolve, reject) => {
          options?.signal?.addEventListener(
            "abort",
            () => {
              const error = new Error("cancelled");
              error.name = "AbortError";
              reject(error);
            },
            { once: true }
          );
        })
    );
    const worker = {
      executeQuery,
      dispose
    } satisfies DisposableCadQueryWorker;
    const cancellable = new CancellableBrowserCadQueryWorker(() => worker);
    const pending = cancellable.executeQuery(
      {
        kind: "cad-worker.query",
        id: "cancel_me",
        project: exportCadProject(createRegionEngine()),
        request: candidatesRequest
      },
      { signal: controller.signal }
    );

    controller.abort();

    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(dispose).toHaveBeenCalledTimes(1);
  });
});

function createRegionEngine(): CadEngine {
  const engine = new CadEngine();
  engine.applyBatch([
    {
      op: "sketch.create",
      id: "sketch_1",
      name: "Regions",
      plane: "XY"
    },
    {
      op: "sketch.addRectangle",
      sketchId: "sketch_1",
      id: "outer",
      center: [0, 0],
      width: 20,
      height: 20
    },
    {
      op: "sketch.addCircle",
      sketchId: "sketch_1",
      id: "hole",
      center: [0, 0],
      radius: 4
    },
    {
      op: "sketch.addCircle",
      sketchId: "sketch_1",
      id: "island",
      center: [0, 0],
      radius: 1
    },
    {
      op: "sketch.addCircle",
      sketchId: "sketch_1",
      id: "other",
      center: [30, 0],
      radius: 2
    }
  ]);
  return engine;
}

async function expectCandidateResponse(
  responsePromise: Promise<
    SketchProfileRegionCandidatesQueryResponse | { readonly ok: false }
  >
): Promise<SketchProfileRegionCandidatesQueryResponse> {
  const response = await responsePromise;
  expect(response.ok).toBe(true);
  if (!response.ok) {
    throw new Error("Expected region candidates query success.");
  }
  return response;
}
