import type { CadProject } from "@web-cad/cad-core";
import type { CadQueryRequest, CadQueryResponse } from "@web-cad/cad-protocol";
import { runCleanupActions } from "./runCleanupActions";

export interface CadQueryWorkerRequest {
  readonly kind: "cad-worker.query";
  readonly id: string;
  /**
   * Required when the worker does not already hold `projectCacheKey`.
   * BrowserCadQueryWorker elides it from follow-up requests for the same
   * revision to avoid repeatedly structured-cloning a large project.
   */
  readonly project?: CadProject;
  readonly projectCacheKey?: string;
  readonly request: CadQueryRequest;
}

export interface CadQueryWorkerResponse {
  readonly id: string;
  readonly queryResponse: CadQueryResponse;
}

interface CadQueryWorkerErrorResponse {
  readonly id: string;
  readonly error: string;
}

export type CadQueryWorkerMessage =
  | CadQueryWorkerResponse
  | CadQueryWorkerErrorResponse;

export interface CadQueryExecutionOptions {
  readonly signal?: AbortSignal;
  readonly projectCacheKey?: string;
}

interface WorkerMessageEvent<T> {
  readonly data: T;
}

interface WorkerErrorEvent {
  readonly error?: unknown;
  readonly message?: string;
}

export interface CadQueryWorkerTransport {
  postMessage(message: CadQueryWorkerRequest): void;
  addEventListener(
    type: "message",
    listener: (event: WorkerMessageEvent<CadQueryWorkerMessage>) => void
  ): void;
  addEventListener(
    type: "error",
    listener: (event: WorkerErrorEvent) => void
  ): void;
  removeEventListener(
    type: "message",
    listener: (event: WorkerMessageEvent<CadQueryWorkerMessage>) => void
  ): void;
  removeEventListener(
    type: "error",
    listener: (event: WorkerErrorEvent) => void
  ): void;
  terminate(): void;
}

interface PendingQuery {
  readonly resolve: (response: CadQueryResponse) => void;
  readonly reject: (error: Error) => void;
  readonly removeAbortListener: () => void;
}

export interface CadQueryWorker {
  executeQuery(
    request: CadQueryWorkerRequest,
    options?: CadQueryExecutionOptions
  ): Promise<CadQueryResponse>;
}

export interface DisposableCadQueryWorker extends CadQueryWorker {
  dispose(): void;
}

export type DisposableCadQueryWorkerFactory = () => DisposableCadQueryWorker;

/**
 * Query-only browser worker. CAD queries are bounded synchronous work once
 * they begin, so AbortSignal cancellation physically terminates this transport
 * without sharing mutation state.
 */
export class BrowserCadQueryWorker implements CadQueryWorker {
  readonly #transport: CadQueryWorkerTransport;
  readonly #pendingQueries = new Map<string, PendingQuery>();
  #postedProjectCacheKey: string | undefined;
  #disposed = false;
  readonly #handleMessage = (
    event: WorkerMessageEvent<CadQueryWorkerMessage>
  ) => {
    const pending = this.#pendingQueries.get(event.data.id);
    if (!pending) return;

    this.#pendingQueries.delete(event.data.id);
    pending.removeAbortListener();
    if ("error" in event.data) {
      pending.reject(new Error(event.data.error));
      return;
    }
    pending.resolve(event.data.queryResponse);
  };
  readonly #handleError = (event: WorkerErrorEvent) => {
    const error =
      event.error instanceof Error
        ? event.error
        : new Error(event.message ?? "CAD command worker failed.");
    for (const pending of this.#pendingQueries.values()) {
      pending.removeAbortListener();
      pending.reject(error);
    }
    this.#pendingQueries.clear();
  };

  constructor(transport = createBrowserCadQueryWorkerTransport()) {
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

  executeQuery(
    request: CadQueryWorkerRequest,
    options: CadQueryExecutionOptions = {}
  ): Promise<CadQueryResponse> {
    if (this.#disposed) {
      return Promise.reject(
        new Error("CAD command worker has already been disposed.")
      );
    }
    if (this.#pendingQueries.has(request.id)) {
      return Promise.reject(
        new Error(`Duplicate CAD command worker request id: ${request.id}.`)
      );
    }
    if (options.signal?.aborted) {
      return Promise.reject(createQueryAbortError());
    }

    return new Promise((resolve, reject) => {
      const handleAbort = () => {
        const pending = this.#pendingQueries.get(request.id);
        if (!pending) return;
        this.#pendingQueries.delete(request.id);
        pending.removeAbortListener();
        let terminationError: Error | undefined;
        try {
          this.#transport.terminate();
        } catch (error) {
          terminationError =
            error instanceof Error
              ? error
              : new Error(
                  "CAD command worker failed to terminate a cancelled query."
                );
        }
        this.#disposed = true;
        try {
          this.#transport.removeEventListener("message", this.#handleMessage);
        } catch {
          // Preserve the cancellation result.
        }
        try {
          this.#transport.removeEventListener("error", this.#handleError);
        } catch {
          // Preserve the cancellation result.
        }
        const cancellationError = terminationError ?? createQueryAbortError();
        pending.reject(cancellationError);
        for (const other of this.#pendingQueries.values()) {
          other.removeAbortListener();
          other.reject(cancellationError);
        }
        this.#pendingQueries.clear();
      };
      const removeAbortListener = () =>
        options.signal?.removeEventListener("abort", handleAbort);
      this.#pendingQueries.set(request.id, {
        resolve,
        reject,
        removeAbortListener
      });
      options.signal?.addEventListener("abort", handleAbort, { once: true });
      try {
        const transmittedRequest =
          request.projectCacheKey &&
          request.projectCacheKey === this.#postedProjectCacheKey
            ? { ...request, project: undefined }
            : request;
        this.#transport.postMessage(transmittedRequest);
        if (request.projectCacheKey && request.project) {
          this.#postedProjectCacheKey = request.projectCacheKey;
        }
      } catch (error) {
        this.#pendingQueries.delete(request.id);
        removeAbortListener();
        reject(
          error instanceof Error
            ? error
            : new Error("CAD command worker failed to post a query.")
        );
      }
    });
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#handleError({
      message: "CAD command worker was disposed before completing a request."
    });
    runCleanupActions([
      () => this.#transport.removeEventListener("message", this.#handleMessage),
      () => this.#transport.removeEventListener("error", this.#handleError),
      () => this.#transport.terminate()
    ]);
  }
}

/**
 * Gives every expensive browser query a dedicated transport. Cancelling one
 * query can therefore terminate its worker without disrupting command
 * mutation state or another in-flight query.
 */
export class CancellableBrowserCadQueryWorker implements CadQueryWorker {
  readonly #createWorker: DisposableCadQueryWorkerFactory;

  constructor(
    createWorker: DisposableCadQueryWorkerFactory = () =>
      new BrowserCadQueryWorker()
  ) {
    this.#createWorker = createWorker;
  }

  async executeQuery(
    request: CadQueryWorkerRequest,
    options?: CadQueryExecutionOptions
  ): Promise<CadQueryResponse> {
    const worker = this.#createWorker();
    try {
      return await worker.executeQuery(request, options);
    } finally {
      worker.dispose();
    }
  }
}

/**
 * Reuses one query-only transport after successful requests. An abort still
 * physically terminates that transport; the next request gets a fresh worker.
 * Region and curve-edit clients share this instance so paging and follow-up
 * readiness checks do not repeatedly parse the command worker bundle.
 */
export class RecoverableBrowserCadQueryWorker implements CadQueryWorker {
  readonly #createWorker: DisposableCadQueryWorkerFactory;
  #worker?: DisposableCadQueryWorker;

  constructor(
    createWorker: DisposableCadQueryWorkerFactory = () =>
      new BrowserCadQueryWorker()
  ) {
    this.#createWorker = createWorker;
  }

  async executeQuery(
    request: CadQueryWorkerRequest,
    options?: CadQueryExecutionOptions
  ): Promise<CadQueryResponse> {
    const worker = (this.#worker ??= this.#createWorker());
    try {
      return await worker.executeQuery(request, options);
    } catch (error) {
      if (this.#worker === worker) {
        this.#worker = undefined;
        worker.dispose();
      }
      throw error;
    }
  }

  dispose(): void {
    this.#worker?.dispose();
    this.#worker = undefined;
  }
}

let sharedBrowserCadQueryWorker: RecoverableBrowserCadQueryWorker | undefined;

export function getSharedBrowserCadQueryWorker(): CadQueryWorker {
  if (!sharedBrowserCadQueryWorker) {
    sharedBrowserCadQueryWorker = new RecoverableBrowserCadQueryWorker();
    window.addEventListener("pagehide", disposeSharedBrowserCadQueryWorker);
  }
  return sharedBrowserCadQueryWorker;
}

function disposeSharedBrowserCadQueryWorker(): void {
  sharedBrowserCadQueryWorker?.dispose();
  sharedBrowserCadQueryWorker = undefined;
}

function createBrowserCadQueryWorkerTransport(): CadQueryWorkerTransport {
  return new Worker(new URL("./cadCommand.worker.ts", import.meta.url), {
    type: "module"
  }) as CadQueryWorkerTransport;
}

function createQueryAbortError(): Error {
  const error = new Error("CAD command worker query was cancelled.");
  error.name = "AbortError";
  return error;
}
