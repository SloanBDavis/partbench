import { CAD_V21_EXACT_EXPORT_RESOURCE_LIMITS } from "@web-cad/cad-protocol";
import type {
  ExactBodyArtifactLeaf,
  ExactBodyArtifactSource,
  GeometryWorker,
  GeometryWorkerDiagnostics,
  GeometryWorkerRequest,
  GeometryWorkerResponse
} from "@web-cad/geometry-worker";
import {
  createWorkerErrorDiagnostics,
  getExactViewportPickMapDowngrade,
  getExactBodyArtifactSourceLeaf,
  getGeometryWorkerRequestTransferables
} from "@web-cad/geometry-worker/browser";
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
  postMessage(message: GeometryWorkerRequest, transfer?: Transferable[]): void;
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

    pending.resolve(sanitizeReceivedExactBodyArtifactResponse(event.data));
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
        const transmittedRequest = createTransferOwnedRequest(request);
        this.#transport.postMessage(transmittedRequest, [
          ...getGeometryWorkerRequestTransferables(transmittedRequest)
        ]);
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

function createTransferOwnedRequest<
  TPayload extends GeometryWorkerRequest["payload"]
>(request: GeometryWorkerRequest<TPayload>): GeometryWorkerRequest<TPayload> {
  if (request.payload.op !== "geometry.exactBodyArtifact") return request;
  const leaf = getExactBodyArtifactSourceLeaf(request.payload.source);
  if (!leaf) return request;
  if (
    leaf.brepByteLength !== leaf.brepBytes.byteLength ||
    leaf.brepBytes.byteLength >
      CAD_V21_EXACT_EXPORT_RESOURCE_LIMITS.maxBrepArtifactBytes
  ) {
    throw new Error("Exact body artifact leaf bytes exceed transport limits.");
  }
  const source = replaceExactBodyArtifactSourceLeaf(request.payload.source, {
    ...leaf,
    brepBytes: leaf.brepBytes.slice()
  });
  return {
    ...request,
    payload: { ...request.payload, source }
  } as GeometryWorkerRequest<TPayload>;
}

function replaceExactBodyArtifactSourceLeaf(
  source: ExactBodyArtifactSource,
  leaf: ExactBodyArtifactLeaf
): ExactBodyArtifactSource {
  switch (source.kind) {
    case "bodyArtifact":
      return leaf;
    case "artifactHole":
    case "artifactShell":
      return { ...source, target: leaf };
    case "artifactLinearPattern":
    case "artifactCircularPattern":
    case "artifactMirror":
      return { ...source, seed: leaf };
    default:
      return source;
  }
}

function sanitizeReceivedExactBodyArtifactResponse(
  response: GeometryWorkerResponse
): GeometryWorkerResponse {
  if (
    !response.response.ok ||
    response.response.op !== "geometry.exactBodyArtifact" ||
    !("artifact" in response.response)
  ) {
    return response;
  }

  const { artifact } = response.response;
  const pickMap = artifact.viewportPickMap;
  if (!pickMap) return response;

  const baseTransferables = [
    artifact.brepBytes.buffer,
    artifact.displayMesh.positions.buffer,
    artifact.displayMesh.indices.buffer
  ] as ArrayBuffer[];
  const downgrade = getExactViewportPickMapDowngrade(pickMap, artifact);
  if (
    !downgrade &&
    hasMatchingTransferables(response.transferables, [
      ...baseTransferables,
      pickMap.faceTriangleRanges.buffer,
      pickMap.edgePointRanges.buffer,
      pickMap.edgePoints.buffer,
      pickMap.vertexPoints.buffer
    ])
  ) {
    return response;
  }

  const artifactWithoutPickMap = { ...artifact };
  delete artifactWithoutPickMap.viewportPickMap;
  return {
    ...response,
    response: {
      ...response.response,
      artifact: {
        ...artifactWithoutPickMap,
        viewportPickMapDowngrade: downgrade ?? { status: "invalid" }
      }
    },
    transferables: baseTransferables
  };
}

function hasMatchingTransferables(
  actual: readonly ArrayBuffer[],
  expected: readonly ArrayBufferLike[]
): boolean {
  return (
    actual.length === expected.length &&
    actual.every((buffer, index) => buffer === expected[index])
  );
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
