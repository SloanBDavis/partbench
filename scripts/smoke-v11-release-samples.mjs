import { register } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  formatV11ReleaseSampleSmokeSummary,
  runV11ReleaseSampleSmoke
} from "./v11-release-samples.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const loaderPath = new URL("./ts-source-loader.mjs", import.meta.url);
const cadCorePath = pathToFileURL(
  resolve(repoRoot, "packages/cad-core/src/index.ts")
);
const args = new Set(process.argv.slice(2));

if (args.has("--help")) {
  console.log(`Usage: node scripts/smoke-v11-release-samples.mjs [--json]

Runs the V11 release sketch solver smoke against deterministic cad-core chains.
The smoke verifies source-backed sketch constraints and dimensions, solver
status, dry-run non-mutation, rebuild/reference queries, V17 advanced solver
source records, JSON/WCAD round-trips, and source versus derived/session
boundary separation. Use --json for structured output.`);
  process.exitCode = 0;
} else {
  register(loaderPath, import.meta.url);

  const cadCore = await import(cadCorePath.href);
  const result = await runV11ReleaseSampleSmoke(cadCore);

  if (args.has("--json")) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(formatV11ReleaseSampleSmokeSummary(result));
  }

  process.exitCode = result.ok ? 0 : 1;
}
