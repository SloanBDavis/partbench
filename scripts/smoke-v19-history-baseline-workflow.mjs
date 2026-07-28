import { register } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  formatV19HistoryBaselineWorkflowSummary,
  runV19HistoryBaselineWorkflow
} from "./v19-history-baseline-workflow.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));

if (args.has("--help")) {
  console.log(`Usage: node scripts/smoke-v19-history-baseline-workflow.mjs [--json]

Runs the deterministic, non-browser V19 D6 history-baseline workflow through
historyless parameter overwrite, JSON and WCAD CBOR round-trips, undo, and redo.`);
} else {
  register(new URL("./ts-source-loader.mjs", import.meta.url), import.meta.url);
  const cadCore = await import(
    pathToFileURL(resolve(repositoryRoot, "packages/cad-core/src/index.ts"))
      .href
  );
  const result = await runV19HistoryBaselineWorkflow(cadCore);

  console.log(
    args.has("--json")
      ? JSON.stringify(result, null, 2)
      : formatV19HistoryBaselineWorkflowSummary(result)
  );
  process.exitCode = result.ok ? 0 : 1;
}
