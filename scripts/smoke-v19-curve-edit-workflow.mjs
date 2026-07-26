import { register } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  formatV19CurveEditWorkflowSummary,
  runV19CurveEditWorkflow
} from "./v19-curve-edit-workflow.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));

if (args.has("--help")) {
  console.log(`Usage: node scripts/smoke-v19-curve-edit-workflow.mjs [--json]

Runs the deterministic, non-browser V19 Slice B curve-edit workflow through
cad-core command, query, persistence, undo, and redo paths.`);
} else {
  register(new URL("./ts-source-loader.mjs", import.meta.url), import.meta.url);
  const cadCore = await import(
    pathToFileURL(resolve(repositoryRoot, "packages/cad-core/src/index.ts"))
      .href
  );
  const result = runV19CurveEditWorkflow(cadCore);

  console.log(
    args.has("--json")
      ? JSON.stringify(result, null, 2)
      : formatV19CurveEditWorkflowSummary(result)
  );
  process.exitCode = result.ok ? 0 : 1;
}
