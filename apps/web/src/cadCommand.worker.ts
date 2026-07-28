import {
  CadEngine,
  SnapshotCadCommandWorker,
  type CadWorkerRequest
} from "@web-cad/cad-core/full";
import type { CadQueryWorkerRequest } from "./browserCadQueryWorker";

type CadCommandWorkerTransportRequest =
  | CadWorkerRequest
  | CadQueryWorkerRequest;

const commandWorker = new SnapshotCadCommandWorker();
let cachedQueryEngine: CadEngine | undefined;
let cachedQueryProjectKey: string | undefined;

self.addEventListener(
  "message",
  (event: MessageEvent<CadCommandWorkerTransportRequest>) => {
    const request = event.data;
    if (isQueryRequest(request)) {
      executeQuery(request);
      return;
    }
    void executeCommand(request);
  }
);

function executeQuery(request: CadQueryWorkerRequest): void {
  try {
    const engine =
      request.projectCacheKey &&
      request.projectCacheKey === cachedQueryProjectKey &&
      cachedQueryEngine
        ? cachedQueryEngine
        : request.project
          ? CadEngine.fromProject(request.project)
          : (() => {
              throw new Error(
                "CAD query worker cache missed a request without a project."
              );
            })();
    if (request.projectCacheKey) {
      cachedQueryProjectKey = request.projectCacheKey;
      cachedQueryEngine = engine;
    }
    const queryResponse = engine.executeQuery(request.request);
    self.postMessage({ id: request.id, queryResponse });
  } catch (error) {
    postWorkerError(request.id, error, "query");
  }
}

function isQueryRequest(
  request: CadCommandWorkerTransportRequest
): request is CadQueryWorkerRequest {
  return "kind" in request && request.kind === "cad-worker.query";
}

async function executeCommand(request: CadWorkerRequest): Promise<void> {
  try {
    self.postMessage(await commandWorker.execute(request));
  } catch (error) {
    postWorkerError(request.id, error, "command");
  }
}

function postWorkerError(
  id: string,
  error: unknown,
  operation: "command" | "query"
): void {
  self.postMessage({
    id,
    error:
      error instanceof Error
        ? error.message
        : `CAD command worker failed to execute a ${operation} request.`
  });
}
