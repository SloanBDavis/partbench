import { register } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  formatV10ReleaseSampleSmokeSummary,
  runV10ReleaseSampleSmoke
} from "./v10-release-samples.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const loaderPath = new URL("./ts-source-loader.mjs", import.meta.url);
const cadCorePath = pathToFileURL(
  resolve(repoRoot, "packages/cad-core/src/index.ts")
);
const args = new Set(process.argv.slice(2));

if (args.has("--help")) {
  console.log(`Usage: node scripts/smoke-v10-release-samples.mjs [--json]

Runs the V10 release edit/rebuild/reference smoke against cad-core release
fixtures. The smoke verifies feature editability, dry-run non-mutation,
committed rebuild lifecycle effects, dependency/reference health, explicit
named-reference repair, JSON/WCAD round-trips, and source versus derived/session
boundary separation. The default output is deterministic human-readable text.
Use --json for the same structured result on stdout.`);
  process.exitCode = 0;
} else {
  register(loaderPath, import.meta.url);

  const cadCore = await import(cadCorePath.href);
  const result = await runV10ReleaseSampleSmoke(cadCore);

  if (args.has("--json")) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(formatV10ReleaseSampleSmokeSummary(result));
  }

  process.exitCode = result.ok ? 0 : 1;
}
