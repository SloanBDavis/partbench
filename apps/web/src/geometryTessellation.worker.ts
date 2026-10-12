import {
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
const geometryWorker = new GeometryKernelBrowserWorker({
  onStepImportProgress: (id, stepImportProgress) => {
    workerScope.postMessage(
      { id, stepImportProgress },
      stepImportProgress.phase === "native"
        ? [
            ...new Set(
              stepImportProgress.meshes.flatMap((mesh) => [
                mesh.positions.buffer as ArrayBuffer,
                mesh.indices.buffer as ArrayBuffer
              ])
            )
          ]
        : []
    );
  }
});

workerScope.addEventListener(
  "message",
  (event: MessageEvent<GeometryWorkerRequest>) => {
    void executeGeometryRequest(event.data);
  }
);

async function executeGeometryRequest(
  request: GeometryWorkerRequest
): Promise<void> {
  workerScope.postMessage([request.id], []);

  try {
    const response = await geometryWorker.execute(request);

    workerScope.postMessage(response, [...response.transferables]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    workerScope.postMessage(
      {
        id: request.id,
        error: message
      },
      []
    );
  }
}
