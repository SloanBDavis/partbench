import { describe, expect, it } from "vitest";
import { createSketchSolverStatusResponse } from "./sketchSolverStatus";

describe("empty sketch solver status", () => {
  it("reports not-run without a false solver failure", () => {
    const sketch = {
      id: "sketch_empty",
      name: "Empty",
      plane: "XY" as const,
      entities: new Map()
    };
    const response = createSketchSolverStatusResponse({
      cadOpsVersion: "cadops.v1",
      document: {
        sketches: new Map([[sketch.id, sketch]]),
        parameters: new Map(),
        sketchDimensions: new Map(),
        sketchConstraints: new Map()
      },
      sketch,
      currentProjectSchemaVersion: "web-cad.project.v22"
    });

    expect(response).toMatchObject({
      status: "not-run",
      readiness: "deferred",
      solver: { numericalSolverStatus: "not-run" }
    });
    expect(response.diagnostics).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "SKETCH_SOLVER_FAILED" })
      ])
    );
  });
});
