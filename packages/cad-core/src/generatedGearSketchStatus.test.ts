import { describe, expect, it } from "vitest";
import { CadEngine } from "./index";
import { evaluateSketch } from "./sketchSolver";
import { createSketchSolverStatusResponse } from "./sketchSolverStatus";
import { runSketchSolverPackageProbe } from "./sketchSolverPackageMapping";
import { createProjectHealth } from "./projectHealth";

function seed() {
  const engine = new CadEngine();
  engine.applyBatch([
    { op: "parameter.create", id: "teeth", name: "teeth", value: 20 },
    {
      op: "feature.spurGear",
      id: "gear",
      bodyId: "gear_body",
      sketchId: "profile",
      teeth: { parameterId: "teeth" },
      module: 1.5,
      faceWidth: 10,
      boreDiameter: 8
    }
  ]);
  return engine;
}

describe("native generated gear sketch definition", () => {
  it("reports a verified recipe as fully defined without a fabricated numerical solve", () => {
    const engine = seed();
    const document = engine.getDocument();
    const sketch = document.sketches.get("profile")!;
    const evaluation = evaluateSketch(document, sketch);
    expect(evaluation.status).toBe("healthy");
    expect(evaluation.issues).toEqual([]);
    expect(evaluation.drivenEntityIds).toHaveLength(sketch.entities.size);
    expect(evaluation.solverProbe).toMatchObject({
      modelBuilt: false,
      solverRan: false
    });
    expect(evaluation.solverProbe.result).toBeUndefined();
    const status = createSketchSolverStatusResponse({
      cadOpsVersion: "cadops.v1",
      document,
      sketch,
      currentProjectSchemaVersion: "web-cad.project.v22"
    });
    expect(status).toMatchObject({
      status: "fully-defined",
      readiness: "ready",
      solver: {
        definitionMode: "generated-spur-gear",
        modelBuilt: false,
        solverRan: false,
        numericalSolverStatus: "not-run"
      },
      profileValidity: {
        status: "valid",
        profileCount: 1,
        validProfileCount: 1,
        profiles: [],
        generatedProfiles: [
          {
            kind: "spurGear",
            featureId: "gear",
            closed: true,
            featureReady: true
          }
        ]
      }
    });
    expect(status.solver.degreesOfFreedomEstimate).toBeUndefined();
    expect(
      status.diagnostics.filter(
        (diagnostic) =>
          diagnostic.severity === "blocker" || diagnostic.severity === "warning"
      )
    ).toEqual([]);
    const health = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "project.health" }
    });
    expect(health).toMatchObject({
      ok: true,
      sketchEvaluations: [
        { sketchId: "profile", status: "healthy", issues: [] }
      ]
    });
  });

  it.each(["drift", "values", "missing-parameter", "constraint"] as const)(
    "preserves invalid generated source diagnostics for %s in standalone callers",
    (failure) => {
      const engine = seed();
      const document = engine.getDocument();
      const original = document.sketches.get("profile")!;
      const entities = new Map(original.entities);
      const first = [...entities.values()].find(
        (entity) => entity.kind === "line"
      )!;
      if (failure === "drift" && first.kind === "line")
        entities.set(first.id, {
          ...first,
          start: [first.start[0] + 0.01, first.start[1]]
        });
      const sketch = {
        ...original,
        entities,
        ...(failure === "values"
          ? {
              spurGear: {
                ...original.spurGear!,
                values: { ...original.spurGear!.values, module: 2 }
              }
            }
          : {})
      };
      const parameters = new Map(document.parameters);
      if (failure === "missing-parameter") parameters.delete("teeth");
      const sketchConstraints = new Map(document.sketchConstraints);
      if (failure === "constraint")
        sketchConstraints.set("extra", {
          id: "extra",
          name: "Extra",
          sketchId: sketch.id,
          entityId: first.id,
          kind: "horizontal"
        });
      const changed = {
        ...document,
        sketches: new Map([[sketch.id, sketch]]),
        parameters,
        sketchConstraints
      };
      const evaluation = evaluateSketch(changed, sketch);
      expect(evaluation.status).not.toBe("healthy");
      expect(evaluation.issues[0]!.code).toBe(
        failure === "missing-parameter"
          ? "PARAMETER_NOT_FOUND"
          : "INVALID_VALUE"
      );
      expect(
        runSketchSolverPackageProbe(changed, sketch).generatedSource!.issues
          .length
      ).toBeGreaterThan(0);
      const status = createSketchSolverStatusResponse({
        cadOpsVersion: "cadops.v1",
        document: changed,
        sketch,
        currentProjectSchemaVersion: "web-cad.project.v22"
      });
      expect(status.solver.definitionMode).toBeUndefined();
      expect(status.profileValidity).toMatchObject({
        status: "invalid",
        validProfileCount: 0,
        generatedProfiles: [{ featureReady: false }]
      });
      expect(
        status.diagnostics.some(
          (diagnostic) => diagnostic.severity === "blocker"
        )
      ).toBe(true);
      const health = createProjectHealth({
        cadOpsVersion: "cadops.v1",
        document: changed,
        ownerPartId: "part:default",
        units: changed.units,
        bodyExists: (id) => id === "gear_body"
      });
      expect(health.sketchEvaluations[0]!.status).not.toBe("healthy");
      expect(health.sketchEvaluations[0]!.issues[0]!.message).toContain(
        failure === "missing-parameter"
          ? "does not exist"
          : failure === "constraint"
            ? "cannot have"
            : "differ"
      );
    }
  );
});
