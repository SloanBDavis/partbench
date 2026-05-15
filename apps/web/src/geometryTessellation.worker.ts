import {
  createWorkerErrorDiagnostics,
  GeometryKernelBrowserWorker,
  type GeometryWorkerRequest
} from "@web-cad/geometry-worker/browser";

interface GeometryWorkerGlobalScope {
  addEventListener(
    type: "message",
    listener: (event: MessageEvent<GeometryWorkerRequest>) => void
  ): void;
  postMessage(message: unknown, transfer: Transferable[]): void;
}

const workerScope = self as unknown as GeometryWorkerGlobalScope;
const geometryWorker = new GeometryKernelBrowserWorker();

workerScope.addEventListener(
  "message",
  (event: MessageEvent<GeometryWorkerRequest>) => {
    void executeGeometryRequest(event.data);
  }
);

async function executeGeometryRequest(
  request: GeometryWorkerRequest
): Promise<void> {
  try {
    const response = await geometryWorker.execute(request);

    workerScope.postMessage(response, [...response.transferables]);
  } catch (error) {
    workerScope.postMessage(
      {
        id: request.id,
        error:
          error instanceof Error
            ? error.message
            : "Geometry worker failed to execute a request.",
        diagnostics: createWorkerErrorDiagnostics({
          stage: "worker",
          code: "WORKER_RUNTIME_FAILED",
          message:
            error instanceof Error
              ? error.message
              : "Geometry worker failed to execute a request."
        })
      },
      []
    );
  }
}
