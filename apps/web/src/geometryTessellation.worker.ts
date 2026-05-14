import {
  GeometryKernelBrowserWorkerSpike,
  type GeometryWorkerSpikeRequest
} from "@web-cad/geometry-worker-spike/browser";

interface GeometryWorkerGlobalScope {
  addEventListener(
    type: "message",
    listener: (event: MessageEvent<GeometryWorkerSpikeRequest>) => void
  ): void;
  postMessage(message: unknown, transfer: Transferable[]): void;
}

const workerScope = self as unknown as GeometryWorkerGlobalScope;
const geometryWorker = new GeometryKernelBrowserWorkerSpike();

workerScope.addEventListener(
  "message",
  (event: MessageEvent<GeometryWorkerSpikeRequest>) => {
    void executeGeometryRequest(event.data);
  }
);

async function executeGeometryRequest(
  request: GeometryWorkerSpikeRequest
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
            : "Geometry worker failed to execute a request."
      },
      []
    );
  }
}
