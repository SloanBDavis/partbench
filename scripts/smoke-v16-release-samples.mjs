import { register } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
register(new URL("./ts-source-loader.mjs", import.meta.url), import.meta.url);
const cadCore = await import(
  pathToFileURL(resolve(repoRoot, "packages/cad-core/src/index.ts")).href
);
const requested = process.argv
  .find((argument) => argument.startsWith("--workflow="))
  ?.slice("--workflow=".length);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function createProfileEngine() {
  const engine = new cadCore.CadEngine();
  engine.applyBatch([
    { op: "sketch.create", id: "base", name: "Base", plane: "XY" },
    {
      op: "sketch.addRectangle",
      sketchId: "base",
      id: "rectangle",
      center: [0, 0],
      width: 4,
      height: 2
    }
  ]);
  engine.apply({
    op: "feature.extrude",
    id: "pedestal_feature",
    bodyId: "pedestal",
    sketchId: "base",
    entityId: "rectangle",
    depth: 5
  });
  return engine;
}

const workflows = {
  "sweep-loft"() {
    const engine = createProfileEngine();
    engine.applyBatch([
      { op: "sketch.create", id: "path", name: "Path", plane: "XZ" },
      {
        op: "sketch.addLine",
        sketchId: "path",
        id: "line",
        start: [0, 0],
        end: [0, 8]
      }
    ]);
    engine.apply({
      op: "feature.sweep",
      id: "sweep",
      bodyId: "sweep_body",
      profileSketchId: "base",
      profileEntityId: "rectangle",
      pathSketchId: "path",
      pathEntityIds: ["line"]
    });
    engine.apply({
      op: "sketch.createOnFace",
      id: "top",
      name: "Top",
      bodyId: "pedestal",
      faceStableId: "generated:face:pedestal:endCap"
    });
    engine.apply({
      op: "sketch.addCircle",
      sketchId: "top",
      id: "circle",
      center: [0, 0],
      radius: 1
    });
    engine.apply({
      op: "feature.loft",
      id: "loft",
      bodyId: "loft_body",
      sections: [
        { sketchId: "base", entityId: "rectangle" },
        { sketchId: "top", entityId: "circle" }
      ]
    });
    const restored = cadCore.importCadProject(cadCore.exportCadProject(engine));
    assert(
      restored.getDocument().features.has("sweep"),
      "Sweep did not round-trip."
    );
    assert(
      restored.getDocument().features.has("loft"),
      "Loft did not round-trip."
    );
  },

  "pattern-depth"() {
    const engine = createProfileEngine();
    engine.apply({
      op: "feature.linearPattern",
      id: "pattern",
      bodyId: "pattern_body",
      seedBodyId: "pedestal",
      direction: { kind: "globalAxis", axis: "x" },
      spacing: 6,
      instanceCount: 4
    });
    const response = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "body.patternInstances", bodyId: "pattern_body" }
    });
    assert(
      response.ok && response.instanceCount === 4,
      "Pattern instances unavailable."
    );
    assert(
      response.ok && response.instances.length === 4,
      "Pattern transforms unavailable."
    );
  },

  "expressions-v2"() {
    const engine = new cadCore.CadEngine();
    engine.applyBatch([
      { op: "parameter.create", id: "angle", name: "angle", value: 30 },
      {
        op: "parameter.create",
        id: "height",
        name: "height",
        value: 0
      }
    ]);
    engine.apply({
      op: "parameter.setExpression",
      id: "height",
      expression: "if(angle >= 30, 10 * sin(angle), 0)"
    });
    const response = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "project.parameterEvaluation" }
    });
    assert(
      response.ok && response.status === "valid",
      `V2 expression did not resolve: ${JSON.stringify(response)}`
    );
    const height = response.ok
      ? response.nodes.find((node) => node.parameterId === "height")
      : undefined;
    assert(
      typeof height?.value === "number" && Math.abs(height.value - 5) < 1e-9,
      "Degree-first trig or conditional evaluation failed."
    );
  },

  "mass-properties"() {
    const engine = createProfileEngine();
    const topology = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "body.topology", bodyId: "pedestal" }
    });
    assert(topology.ok, "Body topology identity unavailable.");
    const response = engine.executeQuery({
      version: "cadops.v1",
      query: {
        query: "body.massProperties",
        bodyId: "pedestal",
        density: 2,
        derivedExactMetadata: {
          bodyId: "pedestal",
          sourceIdentitySignature: topology.topology.sourceIdentity.signature,
          status: "ready",
          metadata: {
            source: "kernel-derived",
            confidence: "kernel-derived",
            volume: 40,
            surfaceArea: 76,
            centroid: [0, 0, 2.5],
            diagnostics: []
          }
        }
      }
    });
    assert(
      response.ok && response.massProperties.mass === 80,
      "Mass projection failed."
    );
  }
};

const selected = requested
  ? [[requested, workflows[requested]]]
  : Object.entries(workflows);
const results = [];
for (const [name, workflow] of selected) {
  if (!workflow) throw new Error(`Unknown V16 workflow: ${name}`);
  try {
    workflow();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({
      name,
      ok: false,
      message: error instanceof Error ? error.message : String(error)
    });
  }
}

const result = { ok: results.every((entry) => entry.ok), results };
if (process.argv.includes("--json"))
  console.log(JSON.stringify(result, null, 2));
else {
  for (const entry of results)
    console.log(
      `${entry.ok ? "PASS" : "FAIL"} ${entry.name}${entry.message ? `: ${entry.message}` : ""}`
    );
}
process.exitCode = result.ok ? 0 : 1;
