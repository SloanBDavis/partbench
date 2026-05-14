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

describe("BrowserCadCommandWorker", () => {
  it("sends requests through a worker-like transport asynchronously", async () => {
    const transport = new FakeWorkerTransport(async (request) => ({
      id: request.id,
      response: {
        ok: true,
        mode: request.batch.mode,
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
        objects: [],
        nextObjectNumber: 1
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
      createdIds: ["obj_1"],
      modifiedIds: [],
      deletedIds: [],
      warnings: [],
      transactionId: "txn_1"
    });
    expect(engine.getDocument().objects.get("obj_1")?.kind).toBe("box");
  });
});
