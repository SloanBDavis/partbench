import { describe, expect, it } from "vitest";
import {
  createV7BrowserWorkflowSmokeResult,
  formatV7BrowserWorkflowSmokeSummary,
  V7_BROWSER_WORKFLOW_REQUIRED_CHECK_IDS
} from "./v7-browser-workflow.mjs";

describe("V7 browser workflow smoke summary", () => {
  it("formats passed, failed, and skipped checks deterministically", () => {
    const result = createV7BrowserWorkflowSmokeResult({
      ids: {
        bodyId: "v7_smoke_body",
        entityId: "v7_smoke_rect",
        featureId: "v7_smoke_feature",
        namedReference: "v7_smoke_top_face",
        sketchId: "v7_smoke_sketch"
      },
      checks: [
        {
          id: "app-load",
          label: "app loaded",
          status: "pass"
        },
        {
          detail: "Reference contract was not visible.",
          id: "reference-contract",
          label: "semantic reference contract visible",
          status: "fail"
        }
      ],
      requiredCheckIds: [
        "app-load",
        "reference-contract",
        "project-json-roundtrip-model"
      ],
      skipped: [
        {
          id: "glb-download",
          reason: "Download visualization GLB is disabled."
        }
      ],
      consoleErrors: ["console error"],
      exceptions: ["runtime exception"]
    });

    expect(result).toMatchObject({
      ok: false,
      passedCount: 1,
      failedCount: 1,
      missingRequiredCount: 1,
      skippedCount: 1
    });
    expect(formatV7BrowserWorkflowSmokeSummary(result)).toBe(
      [
        "V7 browser workflow smoke failed",
        "checks: 1 passed, 1 failed, 1 skipped, 1 missing required",
        "- pass app-load: app loaded",
        "- fail reference-contract: semantic reference contract visible",
        "  Reference contract was not visible.",
        "- missing project-json-roundtrip-model",
        "- skip glb-download: Download visualization GLB is disabled.",
        "- console-error console error",
        "- exception runtime exception"
      ].join("\n")
    );
  });

  it("tracks the expanded G6 release checklist checks as required", () => {
    expect(V7_BROWSER_WORKFLOW_REQUIRED_CHECK_IDS).toEqual(
      expect.arrayContaining([
        "create-circle-extrude",
        "circle-body-reference-contract",
        "attached-sketch-create",
        "consumed-body-diagnostic",
        "project-json-load-preview",
        "project-json-roundtrip-diagnostic"
      ])
    );

    const result = createV7BrowserWorkflowSmokeResult({
      checks: V7_BROWSER_WORKFLOW_REQUIRED_CHECK_IDS.map((id) => ({
        id,
        label: id,
        status: "pass"
      })),
      ids: {},
      skipped: []
    });

    expect(result.ok).toBe(true);
    expect(result.missingRequiredChecks).toEqual([]);
    expect(result.passedCount).toBe(
      V7_BROWSER_WORKFLOW_REQUIRED_CHECK_IDS.length
    );
  });
});
