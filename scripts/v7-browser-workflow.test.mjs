import { describe, expect, it } from "vitest";
import {
  createV7BrowserWorkflowSmokeResult,
  formatV7BrowserWorkflowSmokeSummary
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
      skippedCount: 1
    });
    expect(formatV7BrowserWorkflowSmokeSummary(result)).toBe(
      [
        "V7 browser workflow smoke failed",
        "checks: 1 passed, 1 failed, 1 skipped",
        "- pass app-load: app loaded",
        "- fail reference-contract: semantic reference contract visible",
        "  Reference contract was not visible.",
        "- skip glb-download: Download visualization GLB is disabled.",
        "- console-error console error",
        "- exception runtime exception"
      ].join("\n")
    );
  });
});
