import type {
  GeometryWorker,
  GeometryWorkerDiagnostics,
  GeometryWorkerRequest,
  GeometryWorkerResponse
} from "@web-cad/geometry-worker";
import { createWorkerErrorDiagnostics } from "@web-cad/geometry-worker/browser";
import { runCleanupActions } from "./runCleanupActions";

export type GeometryWorkerMessage =
  | GeometryWorkerResponse
  | GeometryWorkerErrorResponse
  | GeometryWorkerStartedMessage;

export type GeometryWorkerStartedMessage = readonly [id: string];

export interface GeometryWorkerErrorResponse {
  readonly id: string;
  readonly error: string;
  readonly diagnostics?: GeometryWorkerDiagnostics;
}

interface WorkerMessageEvent<T> {
  readonly data: T;
}

interface WorkerErrorEvent {
  readonly error?: unknown;
  readonly message?: string;
}

export interface GeometryWorkerTransport {
  postMessage(message: GeometryWorkerRequest): void;
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
  readonly resolve: (response: GeometryWorkerResponse) => void;
  readonly reject: (error: BrowserGeometryWorkerError) => void;
  readonly onStarted?: () => void;
  started: boolean;
}

export interface BrowserGeometryWorkerExecutionCallbacks {
  readonly onStarted?: () => void;
}

export class BrowserGeometryWorkerError extends Error {
  readonly diagnostics: GeometryWorkerDiagnostics;

  constructor(diagnostics: GeometryWorkerDiagnostics) {
    super(diagnostics.error?.message ?? "Geometry worker failed.");
    this.name = "BrowserGeometryWorkerError";
    this.diagnostics = diagnostics;
  }
}

export class BrowserGeometryWorker implements GeometryWorker {
  readonly #transport: GeometryWorkerTransport;
  readonly #pendingRequests = new Map<string, PendingRequest>();
  #disposed = false;
  readonly #handleMessage = (
    event: WorkerMessageEvent<GeometryWorkerMessage>
  ) => {
    const requestId = isGeometryWorkerStartedMessage(event.data)
      ? event.data[0]
      : event.data.id;
    const pending = this.#pendingRequests.get(requestId);

    if (!pending) {
      return;
    }

    if (isGeometryWorkerStartedMessage(event.data)) {
      if (!pending.started) {
        pending.started = true;
        pending.onStarted?.();
      }
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
    try {
      this.#transport.addEventListener("error", this.#handleError);
    } catch (error) {
      try {
        this.#transport.removeEventListener("message", this.#handleMessage);
      } catch {
        // Preserve the listener setup failure.
      }
      try {
        this.#transport.terminate();
      } catch {
        // Preserve the listener setup failure.
      }
      throw error;
    }
  }

  execute<TPayload extends GeometryWorkerRequest["payload"]>(
    request: GeometryWorkerRequest<TPayload>
  ): Promise<GeometryWorkerResponse<TPayload>> {
    return this.executeTracked(request);
  }

  executeTracked<TPayload extends GeometryWorkerRequest["payload"]>(
    request: GeometryWorkerRequest<TPayload>,
    callbacks: BrowserGeometryWorkerExecutionCallbacks = {}
  ): Promise<GeometryWorkerResponse<TPayload>> {
    if (this.#disposed) {
      return Promise.reject(
        new BrowserGeometryWorkerError(
          createWorkerErrorDiagnostics({
            stage: "transport",
            code: "WORKER_TRANSPORT_FAILED",
            message: "Geometry worker has already been disposed.",
            workerStarted: false
          })
        )
      );
    }

    if (this.#pendingRequests.has(request.id)) {
      return Promise.reject(
        new BrowserGeometryWorkerError(
          createWorkerErrorDiagnostics({
            stage: "transport",
            code: "WORKER_TRANSPORT_FAILED",
            message: `Duplicate geometry worker request id: ${request.id}.`,
            workerStarted: false
          })
        )
      );
    }

    return new Promise<GeometryWorkerResponse<TPayload>>((resolve, reject) => {
      this.#pendingRequests.set(request.id, {
        resolve,
        reject,
        started: false,
        ...(callbacks.onStarted ? { onStarted: callbacks.onStarted } : {})
      });

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
    if (this.#disposed) return;
    this.#disposed = true;
    this.#handleError({
      message: "Geometry worker was disposed before completing a request."
    });
    runCleanupActions([
      () => this.#transport.removeEventListener("message", this.#handleMessage),
      () => this.#transport.removeEventListener("error", this.#handleError),
      () => this.#transport.terminate()
    ]);
  }
}

function isGeometryWorkerStartedMessage(
  message: GeometryWorkerMessage
): message is GeometryWorkerStartedMessage {
  return Array.isArray(message);
}

function createBrowserGeometryWorkerTransport(): GeometryWorkerTransport {
  return new Worker(
    new URL("./geometryTessellation.worker.ts", import.meta.url),
    {
      type: "module"
    }
  ) as GeometryWorkerTransport;
}
