import { register } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  formatV12ReleaseSampleSmokeSummary,
  runV12ReleaseSampleSmoke
} from "./v12-release-samples.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const loaderPath = new URL("./ts-source-loader.mjs", import.meta.url);
const cadCorePath = pathToFileURL(
  resolve(repoRoot, "packages/cad-core/src/index.ts")
);
const args = new Set(process.argv.slice(2));

if (args.has("--help")) {
  console.log(`Usage: node scripts/smoke-v12-release-samples.mjs [--json]

Runs the V12 release boolean topology smoke against a deterministic cad-core
chain. The smoke verifies rectangle cut result topology readiness, generated
face/edge references, selection/name/measure workflows, deferred edge-finish
boundaries, JSON/WCAD round-trips, and source versus derived/session boundary
separation. Use --json for structured output.`);
  process.exitCode = 0;
} else {
  register(loaderPath, import.meta.url);

  const cadCore = await import(cadCorePath.href);
  const result = await runV12ReleaseSampleSmoke(cadCore);

  if (args.has("--json")) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(formatV12ReleaseSampleSmokeSummary(result));
  }

  process.exitCode = result.ok ? 0 : 1;
}
