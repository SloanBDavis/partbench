import { register } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  formatV15ReleaseSampleSmokeSummary,
  runV15ReleaseSampleSmoke
} from "./v15-release-samples.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const loaderPath = new URL("./ts-source-loader.mjs", import.meta.url);
const cadCorePath = pathToFileURL(
  resolve(repoRoot, "packages/cad-core/src/index.ts")
);
const args = new Set(process.argv.slice(2));

if (args.has("--help")) {
  console.log(`Usage: node scripts/smoke-v15-expressions-workflow.mjs [--json]

Runs the V15 parameter expression workflow smoke through cad-core command/query
paths. The smoke verifies expression evaluation, dependent parameter rebuild,
dimension binding source state, circular rejection, and V19 round-trips.`);
  process.exitCode = 0;
} else {
  register(loaderPath, import.meta.url);

  const cadCore = await import(cadCorePath.href);
  const fixtures = cadCore
    .listV15ReleaseSampleFixtures()
    .filter((fixture) => fixture.id === "v15-expression-chain");
  const result = await runV15ReleaseSampleSmoke(cadCore, { fixtures });

  if (args.has("--json")) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(formatV15ReleaseSampleSmokeSummary(result));
  }

  process.exitCode = result.ok ? 0 : 1;
}
