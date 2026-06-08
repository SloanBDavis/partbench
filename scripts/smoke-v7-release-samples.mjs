import { register } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  formatV7ReleaseSampleSmokeSummary,
  runV7ReleaseSampleSmoke
} from "./v7-release-samples.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const loaderPath = new URL("./ts-source-loader.mjs", import.meta.url);
const cadCorePath = pathToFileURL(
  resolve(repoRoot, "packages/cad-core/src/index.ts")
);
const args = new Set(process.argv.slice(2));

if (args.has("--help")) {
  console.log(`Usage: node scripts/smoke-v7-release-samples.mjs [--json]

Runs the V7 release sample acceptance smoke against cad-core source fixtures.
The default output is a deterministic human-readable summary. Use --json for
the same structured result on stdout.`);
  process.exitCode = 0;
} else {
  register(loaderPath, import.meta.url);

  const cadCore = await import(cadCorePath.href);
  const result = runV7ReleaseSampleSmoke(cadCore);

  if (args.has("--json")) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(formatV7ReleaseSampleSmokeSummary(result));
  }

  process.exitCode = result.ok ? 0 : 1;
}
