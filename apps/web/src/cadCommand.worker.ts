import {
  SnapshotCadCommandWorker,
  type CadWorkerRequest
} from "@web-cad/cad-core";

const commandWorker = new SnapshotCadCommandWorker();

self.addEventListener("message", (event: MessageEvent<CadWorkerRequest>) => {
  void executeCommand(event.data);
});

async function executeCommand(request: CadWorkerRequest): Promise<void> {
  try {
    self.postMessage(await commandWorker.execute(request));
  } catch (error) {
    self.postMessage({
      id: request.id,
      error:
        error instanceof Error
          ? error.message
          : "CAD command worker failed to execute a request."
    });
  }
}
