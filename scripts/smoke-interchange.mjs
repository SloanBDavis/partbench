import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, ".metrics/editable-interchange");
const report = { status: "running", stages: [], fixtureDirectory: output };
await mkdir(output, { recursive: true });

function run(name, executable, args, env = process.env) {
  const start = performance.now();
  const result = spawnSync(executable, args, {
    cwd: root,
    env,
    stdio: "inherit",
    timeout: 120_000
  });
  report.stages.push({
    name,
    milliseconds: performance.now() - start,
    exitCode: result.status,
    signal: result.signal
  });
  if (result.error || result.status !== 0)
    throw (
      result.error ??
      new Error(`${name} failed (${result.signal ?? `exit ${result.status}`}).`)
    );
}

try {
  run(
    "shared exact and sketch round trips",
    "pnpm",
    [
      "--filter",
      "@web-cad/cad-runtime",
      "exec",
      "vitest",
      "run",
      "src/interchange.test.ts",
      "src/sketchExchange.test.ts",
      "--no-file-parallelism"
    ],
    { ...process.env, PARTBENCH_INTERCHANGE_ARTIFACT_DIR: output }
  );
  run("editable interchange command scenario", process.execPath, [
    resolve(root, "scripts/scenarios-run.mjs"),
    resolve(root, "scenarios/editable-interchange.json")
  ]);
  report.status = "passed";
  console.log(`Editable interchange closer passed. Fixtures: ${output}`);
} catch (error) {
  report.status = "failed";
  report.error = error instanceof Error ? error.message : String(error);
  console.error(report.error);
  process.exitCode = 1;
} finally {
  await writeFile(
    resolve(output, "small-closer.json"),
    `${JSON.stringify(report, null, 2)}\n`
  );
}
