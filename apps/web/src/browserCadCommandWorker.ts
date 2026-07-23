import type {
  CadCommandWorker,
  CadWorkerRequest,
  CadWorkerResponse
} from "@web-cad/cad-core";

export type CadCommandWorkerMessage =
  | CadWorkerResponse
  | CadWorkerErrorResponse;

export interface CadWorkerErrorResponse {
  readonly id: string;
  readonly error: string;
}

interface WorkerMessageEvent<T> {
  readonly data: T;
}

interface WorkerErrorEvent {
  readonly error?: unknown;
  readonly message?: string;
}

export interface CadCommandWorkerTransport {
  postMessage(message: CadWorkerRequest): void;
  addEventListener(
    type: "message",
    listener: (event: WorkerMessageEvent<CadCommandWorkerMessage>) => void
  ): void;
  addEventListener(
    type: "error",
    listener: (event: WorkerErrorEvent) => void
  ): void;
  removeEventListener(
    type: "message",
    listener: (event: WorkerMessageEvent<CadCommandWorkerMessage>) => void
  ): void;
  removeEventListener(
    type: "error",
    listener: (event: WorkerErrorEvent) => void
  ): void;
  terminate(): void;
}

interface PendingRequest {
  readonly resolve: (response: CadWorkerResponse) => void;
  readonly reject: (error: Error) => void;
}

export class BrowserCadCommandWorker implements CadCommandWorker {
  readonly #transport: CadCommandWorkerTransport;
  readonly #pendingRequests = new Map<string, PendingRequest>();
  readonly #handleMessage = (
    event: WorkerMessageEvent<CadCommandWorkerMessage>
  ) => {
    const pending = this.#pendingRequests.get(event.data.id);

    if (!pending) {
      return;
    }

    this.#pendingRequests.delete(event.data.id);

    if ("error" in event.data) {
      pending.reject(new Error(event.data.error));
      return;
    }

    pending.resolve(event.data);
  };
  readonly #handleError = (event: WorkerErrorEvent) => {
    const error =
      event.error instanceof Error
        ? event.error
        : new Error(event.message ?? "CAD command worker failed.");

    for (const pending of this.#pendingRequests.values()) {
      pending.reject(error);
    }

    this.#pendingRequests.clear();
  };

  constructor(transport = createBrowserCadCommandWorkerTransport()) {
    this.#transport = transport;
    this.#transport.addEventListener("message", this.#handleMessage);
    this.#transport.addEventListener("error", this.#handleError);
  }

  execute(request: CadWorkerRequest): Promise<CadWorkerResponse> {
    if (this.#pendingRequests.has(request.id)) {
      return Promise.reject(
        new Error(`Duplicate CAD command worker request id: ${request.id}.`)
      );
    }

    return new Promise((resolve, reject) => {
      this.#pendingRequests.set(request.id, { resolve, reject });
      this.#transport.postMessage(request);
    });
  }

  dispose(): void {
    this.#transport.removeEventListener("message", this.#handleMessage);
    this.#transport.removeEventListener("error", this.#handleError);
    this.#transport.terminate();
    this.#handleError({
      message: "CAD command worker was disposed before completing a request."
    });
  }
}

function createBrowserCadCommandWorkerTransport(): CadCommandWorkerTransport {
  return new Worker(new URL("./cadCommand.worker.ts", import.meta.url), {
    type: "module"
  }) as CadCommandWorkerTransport;
}
