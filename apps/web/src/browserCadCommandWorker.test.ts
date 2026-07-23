import {
  AsyncCadCommandExecutor,
  CadEngine,
  MockCadCommandWorker,
  type CadWorkerRequest,
  type CadWorkerResponse
} from "@web-cad/cad-core";
import { describe, expect, it } from "vitest";
import {
  BrowserCadCommandWorker,
  type CadCommandWorkerMessage,
  type CadCommandWorkerTransport
} from "./browserCadCommandWorker";

interface WorkerMessageEvent<T> {
  readonly data: T;
}

interface WorkerErrorEvent {
  readonly error?: unknown;
  readonly message?: string;
}

type MessageListener = (
  event: WorkerMessageEvent<CadCommandWorkerMessage>
) => void;
type ErrorListener = (event: WorkerErrorEvent) => void;

class FakeWorkerTransport implements CadCommandWorkerTransport {
  readonly requests: CadWorkerRequest[] = [];
  terminationCount = 0;
  readonly #handler: (request: CadWorkerRequest) => Promise<CadWorkerResponse>;
  readonly #messageListeners = new Set<MessageListener>();
  readonly #errorListeners = new Set<ErrorListener>();

  constructor(
    handler: (request: CadWorkerRequest) => Promise<CadWorkerResponse>
  ) {
    this.#handler = handler;
  }

  postMessage(message: CadWorkerRequest): void {
    this.requests.push(message);

    queueMicrotask(() => {
      void this.#postResponse(message);
    });
  }

  addEventListener(type: "message", listener: MessageListener): void;
  addEventListener(type: "error", listener: ErrorListener): void;
  addEventListener(
    type: "message" | "error",
    listener: MessageListener | ErrorListener
  ): void {
    if (type === "message") {
      this.#messageListeners.add(listener as MessageListener);
      return;
    }

    this.#errorListeners.add(listener as ErrorListener);
  }

  removeEventListener(type: "message", listener: MessageListener): void;
  removeEventListener(type: "error", listener: ErrorListener): void;
  removeEventListener(
    type: "message" | "error",
    listener: MessageListener | ErrorListener
  ): void {
    if (type === "message") {
      this.#messageListeners.delete(listener as MessageListener);
      return;
    }

    this.#errorListeners.delete(listener as ErrorListener);
  }

  terminate(): void {
    this.terminationCount += 1;
    this.#messageListeners.clear();
    this.#errorListeners.clear();
  }

  async #postResponse(request: CadWorkerRequest): Promise<void> {
    try {
      const response = await this.#handler(request);

      for (const listener of this.#messageListeners) {
        listener({ data: response });
      }
    } catch (error) {
      for (const listener of this.#errorListeners) {
        listener({ error });
      }
    }
  }
}

class ThrowingWorkerTransport extends FakeWorkerTransport {
  shouldThrow = true;

  constructor() {
    super(async (request) => ({
      id: request.id,
      response: {
        ok: true,
        mode: request.batch.mode,
        semanticDiff: { created: [], modified: [], deleted: [] },
        createdIds: [],
        modifiedIds: [],
        deletedIds: [],
        warnings: []
      }
    }));
  }

  override postMessage(message: CadWorkerRequest): void {
    if (this.shouldThrow) {
      throw new Error("Injected postMessage failure.");
    }
    super.postMessage(message);
  }
}

class ThrowingTerminationTransport extends FakeWorkerTransport {
  override terminate(): void {
    super.terminate();
    throw new Error("Injected terminate failure.");
  }
}

class PartialSetupFailureTransport implements CadCommandWorkerTransport {
  messageListenerRemoved = false;
  terminated = false;

  postMessage(): void {}

  addEventListener(type: "message", listener: MessageListener): void;
  addEventListener(type: "error", listener: ErrorListener): void;
  addEventListener(type: "message" | "error"): void {
    if (type === "error") {
      throw new Error("Injected listener setup failure.");
    }
  }

  removeEventListener(type: "message", listener: MessageListener): void;
  removeEventListener(type: "error", listener: ErrorListener): void;
  removeEventListener(type: "message" | "error"): void {
    if (type === "message") {
      this.messageListenerRemoved = true;
      throw new Error("Injected listener cleanup failure.");
    }
  }

  terminate(): void {
    this.terminated = true;
  }
}

describe("BrowserCadCommandWorker", () => {
  it("cleans up partial listener setup when construction fails", () => {
    const transport = new PartialSetupFailureTransport();

    expect(() => new BrowserCadCommandWorker(transport)).toThrow(
      "Injected listener setup failure."
    );
    expect(transport.messageListenerRemoved).toBe(true);
    expect(transport.terminated).toBe(true);
  });

  it("sends requests through a worker-like transport asynchronously", async () => {
    const transport = new FakeWorkerTransport(async (request) => ({
      id: request.id,
      response: {
        ok: true,
        mode: request.batch.mode,
        semanticDiff: {
          created: [{ id: "box_1", kind: "box" }],
          modified: [],
          deleted: []
        },
        createdIds: ["box_1"],
        modifiedIds: [],
        deletedIds: [],
        warnings: []
      }
    }));
    const worker = new BrowserCadCommandWorker(transport);
    const responsePromise = worker.execute({
      id: "worker_req_1",
      document: {
        units: "mm",
        objects: [],
        sketches: [],
        parameters: [],
        sketchDimensions: [],
        sketchConstraints: [],
        features: [],
        namedReferences: [],
        nextObjectNumber: 1,
        nextSketchNumber: 1,
        nextSketchEntityNumber: 1,
        nextParameterNumber: 1,
        nextSketchDimensionNumber: 1,
        nextSketchConstraintNumber: 1,
        nextFeatureNumber: 1,
        nextBodyNumber: 1
      },
      batch: {
        version: "cadops.v1",
        mode: "dryRun",
        ops: [
          {
            op: "scene.createBox",
            id: "box_1",
            dimensions: { width: 1, height: 1, depth: 1 }
          }
        ]
      }
    });
    let isSettled = false;
    void responsePromise.then(() => {
      isSettled = true;
    });

    expect(transport.requests).toHaveLength(1);
    expect(isSettled).toBe(false);

    const response = await responsePromise;

    expect(response.id).toBe("worker_req_1");
    expect(response.response.ok).toBe(true);
    expect(isSettled).toBe(true);
  });

  it("rejects duplicate in-flight request ids without losing the first request", async () => {
    let resolveFirst: ((response: CadWorkerResponse) => void) | undefined;
    const transport = new FakeWorkerTransport(
      (request) =>
        new Promise((resolve) => {
          resolveFirst = resolve;
          expect(request.id).toBe("worker_req_duplicate");
        })
    );
    const worker = new BrowserCadCommandWorker(transport);
    const request: CadWorkerRequest = {
      id: "worker_req_duplicate",
      document: {
        units: "mm",
        objects: [],
        sketches: [],
        parameters: [],
        sketchDimensions: [],
        sketchConstraints: [],
        features: [],
        namedReferences: [],
        nextObjectNumber: 1,
        nextSketchNumber: 1,
        nextSketchEntityNumber: 1,
        nextParameterNumber: 1,
        nextSketchDimensionNumber: 1,
        nextSketchConstraintNumber: 1,
        nextFeatureNumber: 1,
        nextBodyNumber: 1
      },
      batch: {
        version: "cadops.v1",
        mode: "dryRun",
        ops: []
      }
    };

    const first = worker.execute(request);
    await expect(worker.execute(request)).rejects.toThrow(
      "Duplicate CAD command worker request id: worker_req_duplicate."
    );
    expect(transport.requests).toHaveLength(1);

    await new Promise<void>((resolve) => queueMicrotask(resolve));
    resolveFirst?.({
      id: request.id,
      response: {
        ok: true,
        mode: "dryRun",
        semanticDiff: { created: [], modified: [], deleted: [] },
        createdIds: [],
        modifiedIds: [],
        deletedIds: [],
        warnings: []
      }
    });
    await expect(first).resolves.toMatchObject({ id: request.id });
  });

  it("removes a pending request when transport dispatch throws", async () => {
    const transport = new ThrowingWorkerTransport();
    const worker = new BrowserCadCommandWorker(transport);
    const request = createTestRequest("worker_req_retry");

    await expect(worker.execute(request)).rejects.toThrow(
      "Injected postMessage failure."
    );

    transport.shouldThrow = false;
    await expect(worker.execute(request)).resolves.toMatchObject({
      id: request.id
    });
    expect(transport.requests).toEqual([request]);
  });

  it("rejects use after dispose and only terminates once", async () => {
    const transport = new FakeWorkerTransport(async (request) => ({
      id: request.id,
      response: {
        ok: true,
        mode: request.batch.mode,
        semanticDiff: { created: [], modified: [], deleted: [] },
        createdIds: [],
        modifiedIds: [],
        deletedIds: [],
        warnings: []
      }
    }));
    const worker = new BrowserCadCommandWorker(transport);

    worker.dispose();
    worker.dispose();

    await expect(
      worker.execute(createTestRequest("worker_req_disposed"))
    ).rejects.toThrow("CAD command worker has already been disposed.");
    expect(transport.requests).toHaveLength(0);
    expect(transport.terminationCount).toBe(1);
  });

  it("rejects pending work before transport cleanup can fail", async () => {
    const transport = new ThrowingTerminationTransport(
      () => new Promise<CadWorkerResponse>(() => undefined)
    );
    const worker = new BrowserCadCommandWorker(transport);
    const pending = worker.execute(createTestRequest("worker_req_cleanup"));

    expect(() => worker.dispose()).toThrow("Injected terminate failure.");
    await expect(pending).rejects.toThrow(
      "CAD command worker was disposed before completing a request."
    );
    expect(transport.terminationCount).toBe(1);
  });

  it("keeps cad-core authoritative after browser worker validation", async () => {
    const engine = new CadEngine();
    const mockWorker = new MockCadCommandWorker();
    const transport = new FakeWorkerTransport((request) =>
      mockWorker.execute(request)
    );
    const executor = new AsyncCadCommandExecutor(
      engine,
      new BrowserCadCommandWorker(transport)
    );

    const pendingResponse = executor.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "scene.createBox",
          dimensions: { width: 2, height: 3, depth: 4 }
        }
      ]
    });

    expect(engine.getDocument().objects.size).toBe(0);

    const response = await pendingResponse;

    expect(response).toEqual({
      ok: true,
      mode: "commit",
      semanticDiff: {
        created: [{ id: "obj_1", kind: "box" }],
        modified: [],
        deleted: []
      },
      createdIds: ["obj_1"],
      modifiedIds: [],
      deletedIds: [],
      warnings: [],
      transactionId: "txn_1"
    });
    expect(engine.getDocument().objects.get("obj_1")?.kind).toBe("box");
  });

  it("returns committed sketch ids through the browser worker before follow-up sketch edits", async () => {
    const engine = new CadEngine();
    const mockWorker = new MockCadCommandWorker();
    const transport = new FakeWorkerTransport((request) =>
      mockWorker.execute(request)
    );
    const executor = new AsyncCadCommandExecutor(
      engine,
      new BrowserCadCommandWorker(transport)
    );

    const createResponse = await executor.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [{ op: "sketch.create", plane: "XY", name: "Panel sketch" }]
    });

    expect(createResponse).toMatchObject({
      ok: true,
      mode: "commit",
      createdSketchIds: ["sketch_1"],
      semanticDiff: {
        sketches: {
          created: [{ id: "sketch_1" }]
        }
      }
    });

    const sketchId =
      createResponse.ok && createResponse.createdSketchIds
        ? createResponse.createdSketchIds[0]
        : undefined;

    expect(sketchId).toBe("sketch_1");

    const rectangleResponse = await executor.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "sketch.addRectangle",
          sketchId: sketchId ?? "missing_sketch",
          center: [0, 0],
          width: 6,
          height: 4
        }
      ]
    });

    expect(rectangleResponse).toMatchObject({
      ok: true,
      mode: "commit",
      createdSketchEntityIds: ["skent_1"]
    });
    expect(engine.getDocument().sketches.get("sketch_1")?.entities.size).toBe(
      1
    );
  });
});

function createTestRequest(id: string): CadWorkerRequest {
  return {
    id,
    document: {
      units: "mm",
      objects: [],
      sketches: [],
      parameters: [],
      sketchDimensions: [],
      sketchConstraints: [],
      features: [],
      namedReferences: [],
      nextObjectNumber: 1,
      nextSketchNumber: 1,
      nextSketchEntityNumber: 1,
      nextParameterNumber: 1,
      nextSketchDimensionNumber: 1,
      nextSketchConstraintNumber: 1,
      nextFeatureNumber: 1,
      nextBodyNumber: 1
    },
    batch: {
      version: "cadops.v1",
      mode: "dryRun",
      ops: []
    }
  };
}
