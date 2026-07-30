import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));

if (args.has("--help")) {
  console.log(`Usage: node scripts/smoke-v19-profile-regions-workflow.mjs

Runs the V19 rounded-plate, flange, topology-backed multi-region-cut, and
revolved-hollow workflows through cad-core, the async geometry worker, real
OCCT, exact metadata, topology checkpoints, and STEP export.`);
} else {
  const child = spawnSync(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    [
      "exec",
      "vitest",
      "run",
      "scripts/v19-profile-regions-workflow.test.mjs",
      "--maxWorkers=1"
    ],
    {
      cwd: repositoryRoot,
      env: process.env,
      stdio: "inherit"
    }
  );
  if (child.error) console.error(child.error);
  process.exitCode = child.status ?? 1;
}
