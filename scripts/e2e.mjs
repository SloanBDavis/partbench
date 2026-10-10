import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";

const root = resolve(import.meta.dirname, "..");
const selected = process.argv.slice(2).filter((arg) => arg !== "--");
const journeys = selected.length
  ? [...new Set(selected)]
  : ["assembly", "interchange", "agent"];
const known = ["assembly", "interchange", "agent"];
if (journeys.some((id) => !known.includes(id))) {
  throw new Error(`Choose E2E journeys: ${known.join(", ")}`);
}
const report = { status: "running", journeys, stages: [] };
const output = resolve(root, ".metrics/e2e");
mkdirSync(output, { recursive: true });

function run(name, executable, args) {
  const start = performance.now();
  const result = spawnSync(executable, args, {
    cwd: root,
    env: process.env,
    stdio: "inherit",
    timeout: 300_000
  });
  report.stages.push({
    name,
    milliseconds: performance.now() - start,
    exitCode: result.status,
    signal: result.signal
  });
  if (result.error || result.status !== 0) {
    throw (
      result.error ??
      new Error(`${name} failed (${result.signal ?? result.status})`)
    );
  }
}

try {
  const browserScenarios = [];
  if (journeys.includes("assembly")) {
    browserScenarios.push(
      "scenarios/v26-distance-mate.json",
      "scenarios/v26-concentric-pin.json"
    );
  }
  if (journeys.includes("interchange")) {
    run("prepare nested STEP fixture", process.execPath, [
      "scripts/prepare-interchange.mjs"
    ]);
    browserScenarios.push("scenarios/editable-interchange.json");
  }
  if (browserScenarios.length) {
    // One Vite server and Chrome process; fresh tabs isolate journeys and break cases.
    run("browser journeys", "bun", [
      "scripts/smoke-ui-use.mjs",
      "--",
      ...browserScenarios
    ]);
  }
  if (journeys.includes("agent")) {
    run("build MCP executable", "pnpm", [
      "--filter",
      "@web-cad/mcp-stdio-server",
      "build"
    ]);
    run("MCP author/revise/save/reopen/STEP journey", process.execPath, [
      "scripts/smoke-agent-runtime.mjs",
      "mounting-plate"
    ]);
  }
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = error instanceof Error ? error.message : String(error);
  console.error(report.error);
  process.exitCode = 1;
} finally {
  writeFileSync(
    resolve(output, "report.json"),
    `${JSON.stringify(report, null, 2)}\n`
  );
}
