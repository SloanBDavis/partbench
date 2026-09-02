import "@web-cad/cad-core/region-source-validation-policy";
import { CadEngine, type CadWorkerRequest } from "@web-cad/cad-core/full";
import type { CadQueryWorkerRequest } from "./browserCadQueryWorker";

type CadCommandWorkerTransportRequest =
  | CadWorkerRequest
  | CadQueryWorkerRequest;

let cachedQueryEngine: CadEngine | undefined;
let cachedQueryProjectKey: string | undefined;

self.addEventListener(
  "message",
  (event: MessageEvent<CadCommandWorkerTransportRequest>) => {
    const request = event.data;
    if (!("batch" in request)) {
      executeQuery(request);
      return;
    }
    self.postMessage({
      id: request.id,
      response: createEngine(request.project).executeBatch(request.batch)
    });
  }
);

function executeQuery(request: CadQueryWorkerRequest): void {
  const engine =
    request.projectCacheKey &&
    request.projectCacheKey === cachedQueryProjectKey &&
    cachedQueryEngine
      ? cachedQueryEngine
      : createEngine(request.project);
  cachedQueryProjectKey = request.projectCacheKey;
  cachedQueryEngine = engine;
  self.postMessage({
    id: request.id,
    queryResponse: engine.executeQuery(request.request)
  });
}

function createEngine(project: CadWorkerRequest["project"]): CadEngine {
  if (!project) throw Error("No project");
  return CadEngine.fromProject(project);
}
