import { register } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  formatV19DimensionsConstraintsWorkflowSummary,
  runV19DimensionsConstraintsWorkflow
} from "./v19-dimensions-constraints-workflow.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));

if (args.has("--help")) {
  console.log(`Usage: node scripts/smoke-v19-dimensions-constraints-workflow.mjs [--json]

Runs the deterministic, non-browser V19 dimension target/value-source/unit/
conflict/replay matrix and the core constraint command lifecycle.`);
} else {
  register(new URL("./ts-source-loader.mjs", import.meta.url), import.meta.url);
  const cadCore = await import(
    pathToFileURL(resolve(repositoryRoot, "packages/cad-core/src/index.ts"))
      .href
  );
  const sketchSolver = await import(
    pathToFileURL(
      resolve(repositoryRoot, "packages/sketch-solver/src/index.ts")
    ).href
  );
  const result = runV19DimensionsConstraintsWorkflow(cadCore, sketchSolver);

  console.log(
    args.has("--json")
      ? JSON.stringify(result, null, 2)
      : formatV19DimensionsConstraintsWorkflowSummary(result)
  );
  process.exitCode = result.ok ? 0 : 1;
}
