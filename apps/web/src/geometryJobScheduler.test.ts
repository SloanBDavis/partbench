import {
  createBoxTessellationWorkerRequest,
  type GeometryWorkerRequest,
  type GeometryWorkerResponse
} from "@web-cad/geometry-worker";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BrowserGeometryWorkerExecutionCallbacks } from "./browserGeometryWorker";
import {
  GeometryJobEntryTimeoutError,
  GeometryJobGenerationError,
  GeometryJobScheduler,
  GeometryJobSupersededError,
  type GeometryJobDescriptor,
  type GeometryJobSchedulerWorker
} from "./geometryJobScheduler";

interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
  readonly reject: (error: unknown) => void;
}

interface ControlledCall {
  readonly request: GeometryWorkerRequest;
  readonly callbacks: BrowserGeometryWorkerExecutionCallbacks;
  readonly deferred: Deferred<GeometryWorkerResponse>;
}

class ControlledWorker implements GeometryJobSchedulerWorker {
  readonly calls: ControlledCall[] = [];
  disposeCount = 0;

  constructor(readonly acknowledgeEntry = true) {}

  executeTracked<TPayload extends GeometryWorkerRequest["payload"]>(
    request: GeometryWorkerRequest<TPayload>,
    callbacks: BrowserGeometryWorkerExecutionCallbacks = {}
  ): Promise<GeometryWorkerResponse<TPayload>> {
    const deferred = createDeferred<GeometryWorkerResponse>();
    this.calls.push({ request, callbacks, deferred });
    if (this.acknowledgeEntry) {
      callbacks.onStarted?.();
    }
    return deferred.promise as Promise<GeometryWorkerResponse<TPayload>>;
  }

  resolve(index: number): void {
    const call = this.calls[index];
    if (!call) {
      throw new Error(`Missing controlled worker call at index ${index}.`);
    }
    call.deferred.resolve(createSuccessResponse(call.request));
  }

  resolveWith(index: number, response: GeometryWorkerResponse): void {
    const call = this.calls[index];
    if (!call)
      throw new Error(`Missing controlled worker call at index ${index}.`);
    call.deferred.resolve(response);
  }

  dispose(): void {
    this.disposeCount += 1;
  }
}

afterEach(() => {
  vi.useRealTimers();
});

describe("GeometryJobScheduler", () => {
  it("prioritizes user work and bounds display work ahead of exact work", async () => {
    const worker = new ControlledWorker();
    const scheduler = new GeometryJobScheduler({
      createWorker: () => worker,
      maxConsecutiveDisplayJobs: 4
    });
    const promises: Promise<GeometryWorkerResponse>[] = [];

    promises.push(schedule(scheduler, user("preflight"), "blocker"));
    await flushScheduler();
    promises.push(schedule(scheduler, derived("exact", "exact"), "exact"));
    for (let index = 1; index <= 5; index += 1) {
      promises.push(
        schedule(
          scheduler,
          derived("display", `display_${index}`),
          `display_${index}`
        )
      );
    }
    promises.push(schedule(scheduler, user("export"), "user_export"));

    const expectedOrder = [
      "blocker",
      "user_export",
      "display_1",
      "display_2",
      "display_3",
      "display_4",
      "exact",
      "display_5"
    ];
    for (let index = 0; index < expectedOrder.length; index += 1) {
      expect(worker.calls[index]?.request.id).toBe(expectedOrder[index]);
      worker.resolve(index);
      await flushScheduler();
    }

    await expect(Promise.all(promises)).resolves.toHaveLength(8);
    expect(worker.calls.map((call) => call.request.id)).toEqual(expectedOrder);
  });

  it("coalesces only queued derived work with the same intent and source", async () => {
    const worker = new ControlledWorker();
    const scheduler = new GeometryJobScheduler({ createWorker: () => worker });
    const blocker = schedule(scheduler, user("preflight"), "blocker");
    await flushScheduler();
    const superseded = schedule(
      scheduler,
      derived("display", "source", 1),
      "display_old"
    );
    const supersededExpectation = expect(superseded).rejects.toBeInstanceOf(
      GeometryJobSupersededError
    );
    const exact = schedule(
      scheduler,
      derived("exact", "source", 1),
      "exact_same_source"
    );
    const newest = schedule(
      scheduler,
      derived("display", "source", 2),
      "display_new"
    );

    await supersededExpectation;
    worker.resolve(0);
    await flushScheduler();
    expect(worker.calls[1]?.request.id).toBe("display_new");
    worker.resolve(1);
    await flushScheduler();
    expect(worker.calls[2]?.request.id).toBe("exact_same_source");
    worker.resolve(2);

    await expect(Promise.all([blocker, newest, exact])).resolves.toHaveLength(
      3
    );
  });

  it("cancels one generation idempotently and resumes with a fresh worker", async () => {
    const firstWorker = new ControlledWorker();
    const secondWorker = new ControlledWorker();
    let factoryCallCount = 0;
    const scheduler = new GeometryJobScheduler({
      createWorker: () =>
        factoryCallCount++ === 0 ? firstWorker : secondWorker
    });
    const inFlight = schedule(scheduler, user("preflight"), "in_flight");
    const queued = schedule(scheduler, derived("display", "queued"), "queued");
    const inFlightExpectation = expect(inFlight).rejects.toBeInstanceOf(
      GeometryJobGenerationError
    );
    const queuedExpectation = expect(queued).rejects.toBeInstanceOf(
      GeometryJobGenerationError
    );
    await flushScheduler();

    expect(scheduler.cancelGeneration("model cancelled")).toBe(2);
    expect(scheduler.cancelGeneration("duplicate cancellation")).toBe(2);
    await Promise.all([inFlightExpectation, queuedExpectation]);
    expect(firstWorker.disposeCount).toBe(1);
    expect(scheduler.getSnapshot()).toMatchObject({
      generation: 2,
      stopped: true,
      queuedDisplayCount: 0,
      cancelledUserKinds: ["preflight"]
    });

    scheduler.resumeGeneration();
    expect(scheduler.getSnapshot().cancelledUserKinds).toEqual(["preflight"]);
    const resumed = schedule(scheduler, user("preflight"), "resumed");
    expect(scheduler.getSnapshot().cancelledUserKinds).toEqual([]);
    await flushScheduler();
    expect(secondWorker.calls[0]?.request.id).toBe("resumed");
    secondWorker.resolve(0);
    await expect(resumed).resolves.toMatchObject({ id: "resumed" });
  });

  it("retains every cancelled user kind until that operation is re-invoked", async () => {
    const worker = new ControlledWorker();
    const scheduler = new GeometryJobScheduler({ createWorker: () => worker });
    const active = schedule(scheduler, user("import"), "import");
    const queuedExport = schedule(scheduler, user("export"), "export");
    const activeExpectation = expect(active).rejects.toBeInstanceOf(
      GeometryJobGenerationError
    );
    const exportExpectation = expect(queuedExport).rejects.toBeInstanceOf(
      GeometryJobGenerationError
    );
    await flushScheduler();

    scheduler.cancelGeneration();
    await Promise.all([activeExpectation, exportExpectation]);
    expect(scheduler.getSnapshot().cancelledUserKinds).toEqual([
      "import",
      "export"
    ]);

    scheduler.resumeGeneration();
    const retriedImport = schedule(scheduler, user("import"), "import_retry");
    expect(scheduler.getSnapshot().cancelledUserKinds).toEqual(["export"]);
    await flushScheduler();
    worker.resolve(1);
    await expect(retriedImport).resolves.toBeDefined();
  });

  it("does not let a late worker factory block a resumed generation", async () => {
    const lateWorker = new ControlledWorker();
    const resumedWorker = new ControlledWorker();
    const firstFactory = createDeferred<GeometryJobSchedulerWorker>();
    let factoryCallCount = 0;
    const scheduler = new GeometryJobScheduler({
      createWorker: () =>
        factoryCallCount++ === 0 ? firstFactory.promise : resumedWorker
    });
    const original = schedule(scheduler, user("preflight"), "original");
    const originalExpectation = expect(original).rejects.toBeInstanceOf(
      GeometryJobGenerationError
    );
    await flushScheduler();

    scheduler.cancelGeneration();
    scheduler.resumeGeneration();
    const resumed = schedule(scheduler, user("preflight"), "resumed");
    await flushScheduler();

    expect(factoryCallCount).toBe(2);
    expect(resumedWorker.calls[0]?.request.id).toBe("resumed");
    resumedWorker.resolve(0);
    await expect(resumed).resolves.toMatchObject({ id: "resumed" });
    await originalExpectation;

    firstFactory.resolve(lateWorker);
    await flushScheduler();
    expect(lateWorker.disposeCount).toBe(1);
    expect(resumedWorker.disposeCount).toBe(0);
  });

  it("stops and disposes a worker that never acknowledges request entry", async () => {
    vi.useFakeTimers();
    const worker = new ControlledWorker(false);
    const scheduler = new GeometryJobScheduler({
      createWorker: () => worker,
      workerEntryTimeoutMs: 25
    });
    const request = schedule(scheduler, user("preflight"), "timeout");
    const expectation = expect(request).rejects.toBeInstanceOf(
      GeometryJobEntryTimeoutError
    );
    await flushScheduler();

    await vi.advanceTimersByTimeAsync(25);

    await expectation;
    expect(worker.disposeCount).toBe(1);
    expect(scheduler.getSnapshot()).toMatchObject({
      generation: 2,
      stopped: true
    });
  });

  it("rolls the generation for fatal worker responses and drains queued work", async () => {
    const worker = new ControlledWorker();
    const scheduler = new GeometryJobScheduler({ createWorker: () => worker });
    const current = schedule(scheduler, derived("display", "body", 1), "fatal");
    await flushScheduler();
    const queued = schedule(scheduler, derived("exact", "body", 1), "queued");
    const response = createSuccessResponse(worker.calls[0]!.request);
    worker.resolveWith(0, {
      ...response,
      response: {
        ok: false,
        id: response.payloadId,
        op: "geometry.tessellateBox",
        error: { code: "KERNEL_FAILURE", message: "worker died" }
      },
      diagnostics: {
        stage: "worker",
        workerStarted: true,
        wasmLoadStatus: "loaded",
        error: { code: "WORKER_RUNTIME_FAILED", message: "worker died" }
      },
      transferables: []
    } as unknown as GeometryWorkerResponse);

    await expect(current).rejects.toThrow("worker died");
    await expect(queued).rejects.toBeInstanceOf(GeometryJobGenerationError);
    expect(worker.disposeCount).toBe(1);
    expect(scheduler.getSnapshot()).toMatchObject({
      generation: 2,
      stopped: true
    });
  });

  it("rejects stale out-of-order revisions and invalidates deleted queued work", async () => {
    const worker = new ControlledWorker();
    const scheduler = new GeometryJobScheduler({ createWorker: () => worker });
    const blocker = schedule(scheduler, user("preflight"), "blocker");
    await flushScheduler();
    const current = schedule(
      scheduler,
      derived("display", "body", 2),
      "current"
    );
    await expect(
      schedule(scheduler, derived("display", "body", 1), "stale")
    ).rejects.toBeInstanceOf(GeometryJobSupersededError);
    scheduler.invalidateDerived("display", "body", 2);
    await expect(current).rejects.toBeInstanceOf(GeometryJobSupersededError);
    worker.resolve(0);
    await expect(blocker).resolves.toBeDefined();
    await flushScheduler();
    expect(worker.calls).toHaveLength(1);
  });
});

function schedule(
  scheduler: GeometryJobScheduler,
  descriptor: GeometryJobDescriptor,
  id: string
): Promise<GeometryWorkerResponse> {
  return scheduler.execute(
    descriptor,
    createBoxTessellationWorkerRequest({
      id,
      payloadId: `${id}_payload`,
      width: 1,
      height: 1,
      depth: 1
    })
  );
}

function user(
  userKind: "preflight" | "import" | "export" | "checkpoint"
): GeometryJobDescriptor {
  return { intent: "user", userKind };
}

function derived(
  intent: "display" | "exact",
  sourceId: string,
  documentRevision = 1
): GeometryJobDescriptor {
  return {
    intent,
    sourceId,
    documentRevision,
    cacheKey: `${sourceId}:${documentRevision}`
  };
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

function createSuccessResponse(
  request: GeometryWorkerRequest
): GeometryWorkerResponse {
  const positions = new Float32Array([0, 0, 0]);
  const indices = new Uint32Array();
  return {
    id: request.id,
    version: request.version,
    kind: request.kind,
    payloadId: request.payload.id,
    response: {
      ok: true,
      id: request.payload.id,
      op: "geometry.tessellateBox",
      mesh: {
        primitive: "box",
        positions,
        indices,
        vertexCount: 1,
        triangleCount: 0,
        faceCount: 0
      },
      warnings: []
    },
    transferables: [positions.buffer, indices.buffer]
  };
}

async function flushScheduler(): Promise<void> {
  for (let index = 0; index < 6; index += 1) {
    await Promise.resolve();
  }
}
