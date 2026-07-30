import type { CadProject } from "@web-cad/cad-core";
import type {
  CadQueryResponse,
  SketchCurveEditProposal,
  SketchCurveEditReadinessQueryResponse
} from "@web-cad/cad-protocol";
import {
  getSharedBrowserCadQueryWorker,
  type CadQueryExecutionOptions,
  type CadQueryWorker
} from "./browserCadQueryWorker";

export class SketchCurveEditQueryClient {
  readonly #worker: CadQueryWorker;
  #nextRequestNumber = 1;

  constructor(worker: CadQueryWorker = getSharedBrowserCadQueryWorker()) {
    this.#worker = worker;
  }

  async queryReadiness(
    project: CadProject,
    proposal: SketchCurveEditProposal,
    options: CadQueryExecutionOptions = {}
  ): Promise<SketchCurveEditReadinessQueryResponse> {
    throwIfAborted(options.signal);
    const response = await this.#worker.executeQuery(
      {
        kind: "cad-worker.query",
        id: `curve_edit_readiness_${this.#nextRequestNumber++}`,
        project,
        ...(options.projectCacheKey
          ? { projectCacheKey: options.projectCacheKey }
          : {}),
        request: {
          version: "cadops.v1",
          query: { query: "sketch.curveEditReadiness", proposal }
        }
      },
      options
    );
    return requireCurveEditReadinessResponse(response);
  }
}

function requireCurveEditReadinessResponse(
  response: CadQueryResponse
): SketchCurveEditReadinessQueryResponse {
  if (response.ok && response.query === "sketch.curveEditReadiness") {
    return response;
  }
  throw new Error(
    `CAD query worker returned ${response.query} instead of sketch.curveEditReadiness.`
  );
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (!signal?.aborted) return;
  const error = new Error("Curve-edit readiness query was cancelled.");
  error.name = "AbortError";
  throw error;
}
