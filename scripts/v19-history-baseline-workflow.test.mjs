import { describe, expect, it } from "vitest";

import * as cadCore from "../packages/cad-core/src/index.ts";
import {
  formatV19HistoryBaselineWorkflowSummary,
  runV19HistoryBaselineWorkflow,
  V19_HISTORY_BASELINE_WORKFLOW_VERSION
} from "./v19-history-baseline-workflow.mjs";

describe("V19 D6 history-baseline workflow smoke", () => {
  it("proves deterministic V22 baseline authority across JSON, WCAD CBOR, undo, and redo", async () => {
    const first = await runV19HistoryBaselineWorkflow(cadCore);
    const second = await runV19HistoryBaselineWorkflow(cadCore);

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      version: V19_HISTORY_BASELINE_WORKFLOW_VERSION,
      ok: true,
      checkCount: 8,
      passedCount: 8,
      failures: [],
      summary: {
        schemaVersion: cadCore.CAD_PROJECT_FORMAT_VERSION_V22,
        baselineParameterValue: 12,
        currentParameterValue: 27.5,
        transactionCount: 1,
        transportCount: 2,
        wcadPackageVersion: "partbench.wcad.v2"
      }
    });
    expect(first.checks.map(({ id }) => id)).toEqual([
      "historyless-nonempty-source",
      "parameter-overwrite",
      "v22-history-baseline",
      "json-round-trip",
      "wcad-cbor-round-trip",
      "undo-exact-baseline",
      "redo-exact-current",
      "deterministic-source-authority"
    ]);
    expect(formatV19HistoryBaselineWorkflowSummary(first)).toBe(
      "V19 history-baseline workflow smoke passed: 8/8 checks passed across JSON and WCAD CBOR round-trips."
    );
  });

  it("reports failures as structured workflow results", async () => {
    const result = await runV19HistoryBaselineWorkflow({
      ...cadCore,
      exportCadProject() {
        throw new Error("forced history-baseline workflow failure");
      }
    });

    expect(result).toMatchObject({
      version: V19_HISTORY_BASELINE_WORKFLOW_VERSION,
      ok: false,
      checkCount: 0,
      passedCount: 0,
      checks: [],
      failures: [
        {
          message: "forced history-baseline workflow failure"
        }
      ],
      summary: {}
    });
    expect(formatV19HistoryBaselineWorkflowSummary(result)).toBe(
      "V19 history-baseline workflow smoke failed: 0/0 checks passed."
    );
  });
});
