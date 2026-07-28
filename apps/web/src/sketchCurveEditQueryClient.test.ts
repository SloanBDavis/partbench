import {
  CadEngine,
  exportCadProject,
  type CadProject
} from "@web-cad/cad-core";
import type {
  CadQueryResponse,
  SketchCurveEditProposal
} from "@web-cad/cad-protocol";
import { describe, expect, it, vi } from "vitest";
import type {
  CadQueryExecutionOptions,
  CadQueryWorker,
  CadQueryWorkerRequest
} from "./browserCadQueryWorker";
import { SketchCurveEditQueryClient } from "./sketchCurveEditQueryClient";

const proposal = {
  kind: "split",
  sketchId: "sketch_1",
  entityId: "line_1",
  splitPoints: [[5, 0]]
} satisfies SketchCurveEditProposal;

describe("SketchCurveEditQueryClient", () => {
  it("executes exact readiness through the query-only worker", async () => {
    const { project, response } = createProjectAndResponse();
    const executeQuery = vi.fn(
      async (request: CadQueryWorkerRequest): Promise<CadQueryResponse> =>
        CadEngine.fromProject(request.project!).executeQuery(request.request)
    );
    const client = new SketchCurveEditQueryClient({ executeQuery });

    await expect(client.queryReadiness(project, proposal)).resolves.toEqual(
      response
    );
    expect(executeQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "cad-worker.query",
        request: {
          version: "cadops.v1",
          query: { query: "sketch.curveEditReadiness", proposal }
        }
      }),
      {}
    );
  });

  it("forwards cancellation to an in-flight dedicated query", async () => {
    const { project } = createProjectAndResponse();
    const controller = new AbortController();
    const executeQuery = vi.fn(
      (_request: CadQueryWorkerRequest, options?: CadQueryExecutionOptions) =>
        new Promise<CadQueryResponse>((_resolve, reject) => {
          options?.signal?.addEventListener(
            "abort",
            () => reject(createAbortError()),
            { once: true }
          );
        })
    );
    const worker = { executeQuery } satisfies CadQueryWorker;
    const pending = new SketchCurveEditQueryClient(worker).queryReadiness(
      project,
      proposal,
      { signal: controller.signal }
    );

    controller.abort();

    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(executeQuery).toHaveBeenCalledTimes(1);
  });

  it("does not create work for an already-cancelled request", async () => {
    const { project } = createProjectAndResponse();
    const controller = new AbortController();
    controller.abort();
    const executeQuery = vi.fn();
    const client = new SketchCurveEditQueryClient({ executeQuery });

    await expect(
      client.queryReadiness(project, proposal, { signal: controller.signal })
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(executeQuery).not.toHaveBeenCalled();
  });
});

function createProjectAndResponse(): {
  readonly project: CadProject;
  readonly response: CadQueryResponse;
} {
  const engine = new CadEngine();
  engine.applyBatch([
    { op: "sketch.create", id: "sketch_1", name: "Sketch", plane: "XY" },
    {
      op: "sketch.addLine",
      sketchId: "sketch_1",
      id: "line_1",
      start: [0, 0],
      end: [10, 0]
    }
  ]);
  const project = exportCadProject(engine);
  return {
    project,
    response: CadEngine.fromProject(project).executeQuery({
      version: "cadops.v1",
      query: { query: "sketch.curveEditReadiness", proposal }
    })
  };
}

function createAbortError(): Error {
  const error = new Error("cancelled");
  error.name = "AbortError";
  return error;
}
