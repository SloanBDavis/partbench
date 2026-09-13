import "@web-cad/cad-core/region-source-validation-policy";
import type { CadEngine, CadWorkerRequest } from "@web-cad/cad-core/full";
import type { CadQueryWorkerRequest } from "./browserCadQueryWorker";
import { CadCommandEngineCache } from "./cadCommandEngineCache";

type CadCommandWorkerTransportRequest =
  | CadWorkerRequest
  | CadQueryWorkerRequest;

let cachedQueryEngine: CadEngine | undefined;
let cachedQueryProjectKey: string | undefined;
const engines = new CadCommandEngineCache();

self.addEventListener(
  "message",
  (event: MessageEvent<CadCommandWorkerTransportRequest>) => {
    const request = event.data;
    if (!("batch" in request)) {
      executeQuery(request);
      return;
    }
    const engine = createEngine(request.project);
    const response = engine.executeBatch(request.batch);
    if (response.ok && request.batch.mode === "commit")
      engines.remember(engine);
    self.postMessage({
      id: request.id,
      response
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
  return engines.load(project);
}
