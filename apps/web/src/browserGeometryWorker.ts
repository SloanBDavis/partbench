import type {
  GeometryWorkerSpike,
  GeometryWorkerSpikeDiagnostics,
  GeometryWorkerSpikeRequest,
  GeometryWorkerSpikeResponse
} from "@web-cad/geometry-worker-spike";
import { createWorkerErrorDiagnostics } from "@web-cad/geometry-worker-spike/browser";

export type GeometryWorkerMessage =
  | GeometryWorkerSpikeResponse
  | GeometryWorkerErrorResponse;

export interface GeometryWorkerErrorResponse {
  readonly id: string;
  readonly error: string;
  readonly diagnostics?: GeometryWorkerSpikeDiagnostics;
}

interface WorkerMessageEvent<T> {
  readonly data: T;
}

interface WorkerErrorEvent {
  readonly error?: unknown;
  readonly message?: string;
}

export interface GeometryWorkerTransport {
  postMessage(message: GeometryWorkerSpikeRequest): void;
  addEventListener(
    type: "message",
    listener: (event: WorkerMessageEvent<GeometryWorkerMessage>) => void
  ): void;
  addEventListener(
    type: "error",
    listener: (event: WorkerErrorEvent) => void
  ): void;
  removeEventListener(
    type: "message",
    listener: (event: WorkerMessageEvent<GeometryWorkerMessage>) => void
  ): void;
  removeEventListener(
    type: "error",
    listener: (event: WorkerErrorEvent) => void
  ): void;
  terminate(): void;
}

interface PendingRequest {
  readonly resolve: (response: GeometryWorkerSpikeResponse) => void;
  readonly reject: (error: BrowserGeometryWorkerError) => void;
}

export class BrowserGeometryWorkerError extends Error {
  readonly diagnostics: GeometryWorkerSpikeDiagnostics;

  constructor(diagnostics: GeometryWorkerSpikeDiagnostics) {
    super(diagnostics.error?.message ?? "Geometry worker failed.");
    this.name = "BrowserGeometryWorkerError";
    this.diagnostics = diagnostics;
  }
}

export class BrowserGeometryWorker implements GeometryWorkerSpike {
  readonly #transport: GeometryWorkerTransport;
  readonly #pendingRequests = new Map<string, PendingRequest>();
  readonly #handleMessage = (
    event: WorkerMessageEvent<GeometryWorkerMessage>
  ) => {
    const pending = this.#pendingRequests.get(event.data.id);

    if (!pending) {
      return;
    }

    this.#pendingRequests.delete(event.data.id);

    if ("error" in event.data) {
      pending.reject(
        new BrowserGeometryWorkerError(
          event.data.diagnostics ??
            createWorkerErrorDiagnostics({
              stage: "worker",
              code: "WORKER_RUNTIME_FAILED",
              message: event.data.error
            })
        )
      );
      return;
    }

    pending.resolve(event.data);
  };
  readonly #handleError = (event: WorkerErrorEvent) => {
    const error = new BrowserGeometryWorkerError(
      createWorkerErrorDiagnostics({
        stage: "transport",
        code: "WORKER_TRANSPORT_FAILED",
        message:
          event.error instanceof Error
            ? event.error.message
            : (event.message ?? "Geometry worker transport failed."),
        workerStarted: false
      })
    );

    for (const pending of this.#pendingRequests.values()) {
      pending.reject(error);
    }

    this.#pendingRequests.clear();
  };

  constructor(transport = createBrowserGeometryWorkerTransport()) {
    this.#transport = transport;
    this.#transport.addEventListener("message", this.#handleMessage);
    this.#transport.addEventListener("error", this.#handleError);
  }

  execute(
    request: GeometryWorkerSpikeRequest
  ): Promise<GeometryWorkerSpikeResponse> {
    return new Promise((resolve, reject) => {
      this.#pendingRequests.set(request.id, { resolve, reject });

      try {
        this.#transport.postMessage(request);
      } catch (error) {
        this.#pendingRequests.delete(request.id);
        reject(
          new BrowserGeometryWorkerError(
            createWorkerErrorDiagnostics({
              stage: "transport",
              code: "WORKER_TRANSPORT_FAILED",
              message:
                error instanceof Error
                  ? error.message
                  : "Geometry worker transport failed to post a request.",
              workerStarted: false
            })
          )
        );
      }
    });
  }

  dispose(): void {
    this.#transport.removeEventListener("message", this.#handleMessage);
    this.#transport.removeEventListener("error", this.#handleError);
    this.#transport.terminate();
    this.#handleError({
      message: "Geometry worker was disposed before completing a request."
    });
  }
}

function createBrowserGeometryWorkerTransport(): GeometryWorkerTransport {
  return new Worker(
    new URL("./geometryTessellation.worker.ts", import.meta.url),
    {
      type: "module"
    }
  ) as GeometryWorkerTransport;
}
