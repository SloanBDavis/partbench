import { register } from "node:module";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  formatV17SmokeSummary,
  runV17ReleaseSamples,
  runV17StorageMigrationWorkflow
} from "./v17-release-samples.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const workflow =
  process.argv
    .find((argument) => argument.startsWith("--workflow="))
    ?.slice("--workflow=".length) ?? "release-samples";
const json = process.argv.includes("--json");
const supported = new Set([
  "release-samples",
  "arcs-profiles",
  "composite-features",
  "curved-sweep",
  "storage-migration"
]);

if (!supported.has(workflow)) {
  console.error(`Unknown V17 smoke workflow: ${workflow}`);
  process.exitCode = 1;
} else {
  register(new URL("./ts-source-loader.mjs", import.meta.url), import.meta.url);
  let result;
  if (
    ["arcs-profiles", "composite-features", "curved-sweep"].includes(workflow)
  ) {
    const child = spawnSync(
      process.platform === "win32" ? "pnpm.cmd" : "pnpm",
      [
        "exec",
        "vitest",
        "run",
        "scripts/v17-geometry-workflows.test.mjs",
        "--maxWorkers=1"
      ],
      {
        cwd: repoRoot,
        env: { ...process.env, PARTBENCH_V17_SMOKE_WORKFLOW: workflow },
        stdio: "inherit"
      }
    );
    if (child.error) console.error(child.error);
    process.exitCode = child.status ?? 1;
  } else {
    const cadCore = await importSource("packages/cad-core/src/index.ts");
    if (workflow === "release-samples") {
      result = await runV17ReleaseSamples(cadCore);
    } else {
      result = await runV17StorageMigrationWorkflow(cadCore);
    }
    console.log(
      json ? JSON.stringify(result, null, 2) : formatV17SmokeSummary(result)
    );
    process.exitCode = result.ok ? 0 : 1;
  }
}

async function importSource(path) {
  return import(pathToFileURL(resolve(repoRoot, path)).href);
}
