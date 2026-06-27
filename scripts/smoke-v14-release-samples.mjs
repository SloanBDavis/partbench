import { register } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  formatV14ReleaseSampleSmokeSummary,
  runV14ReleaseSampleSmoke
} from "./v14-release-samples.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const loaderPath = new URL("./ts-source-loader.mjs", import.meta.url);
const cadCorePath = pathToFileURL(
  resolve(repoRoot, "packages/cad-core/src/index.ts")
);
const args = new Set(process.argv.slice(2));

if (args.has("--help")) {
  console.log(`Usage: node scripts/smoke-v14-release-samples.mjs [--json]

Runs the V14 topology-backed downstream modeling smoke against cad-core release
fixtures. The smoke verifies topology body-anchor cut/add/hole command paths,
blocked support-matrix diagnostics, result-edge finish source behavior, JSON
and .wcad round trips, and source versus renderer/session boundary separation.
Use --json for structured output.`);
  process.exitCode = 0;
} else {
  register(loaderPath, import.meta.url);

  const cadCore = await import(cadCorePath.href);
  const result = await runV14ReleaseSampleSmoke(cadCore);

  if (args.has("--json")) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(formatV14ReleaseSampleSmokeSummary(result));
  }

  process.exitCode = result.ok ? 0 : 1;
}
