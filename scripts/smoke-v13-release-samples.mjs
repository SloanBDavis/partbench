import { register } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  formatV13ReleaseSampleSmokeSummary,
  runV13ReleaseSampleSmoke
} from "./v13-release-samples.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const loaderPath = new URL("./ts-source-loader.mjs", import.meta.url);
const cadCorePath = pathToFileURL(
  resolve(repoRoot, "packages/cad-core/src/index.ts")
);
const args = new Set(process.argv.slice(2));

if (args.has("--help")) {
  console.log(`Usage: node scripts/smoke-v13-release-samples.mjs [--json]

Runs the V13 topology identity smoke against cad-core release fixtures. The
smoke verifies source-backed topology checkpoints and anchors, explicit
named-reference repair to topology anchors, topology-anchor command targets,
deterministic topology matching, JSON round-trip behavior, and source versus
derived/session boundary separation. Use --json for structured output.`);
  process.exitCode = 0;
} else {
  register(loaderPath, import.meta.url);

  const cadCore = await import(cadCorePath.href);
  const result = runV13ReleaseSampleSmoke(cadCore);

  if (args.has("--json")) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(formatV13ReleaseSampleSmokeSummary(result));
  }

  process.exitCode = result.ok ? 0 : 1;
}
