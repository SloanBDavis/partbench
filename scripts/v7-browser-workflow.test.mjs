import { describe, expect, it } from "vitest";
import {
  createV7BrowserWorkflowSmokeResult,
  formatV7BrowserWorkflowSmokeSummary,
  getV7BrowserWorkflowRequiredCheckIds,
  V7_BROWSER_WORKFLOW_GLB_DOWNLOAD_CHECK_ID,
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
        "- missing required project-json-roundtrip-model",
        "- skip glb-download: Download visualization GLB is disabled.",
        "- console-error console error",
        "- exception runtime exception"
      ].join("\n")
    );
  });

  it("tracks the expanded G6 release QA checks as required", () => {
    expect(V7_BROWSER_WORKFLOW_REQUIRED_CHECK_IDS).toEqual(
      expect.arrayContaining([
        "create-circle-extrude",
        "advanced-tools-cleanup",
        "advanced-tools-scrollability",
        "circle-body-reference-contract",
        "viewport-unobstructed-selection-layout",
        "attached-sketch-create",
        "consumed-body-diagnostic",
        "project-wcad-save-as-download",
        "project-wcad-open-upload",
        "project-wcad-roundtrip-model",
        "project-wcad-viewport-usable",
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

  it("keeps GLB optional by default but required in derived smoke mode", () => {
    expect(getV7BrowserWorkflowRequiredCheckIds()).not.toContain(
      V7_BROWSER_WORKFLOW_GLB_DOWNLOAD_CHECK_ID
    );
    expect(
      getV7BrowserWorkflowRequiredCheckIds({ requireGlbDownload: true })
    ).toEqual(
      expect.arrayContaining([V7_BROWSER_WORKFLOW_GLB_DOWNLOAD_CHECK_ID])
    );
  });

  it("fails clearly when required GLB download is skipped", () => {
    const result = createV7BrowserWorkflowSmokeResult({
      checks: [
        {
          id: "app-load",
          label: "app loaded",
          status: "pass"
        }
      ],
      ids: {},
      requiredCheckIds: ["app-load", V7_BROWSER_WORKFLOW_GLB_DOWNLOAD_CHECK_ID],
      skipped: [
        {
          id: V7_BROWSER_WORKFLOW_GLB_DOWNLOAD_CHECK_ID,
          reason: "Download visualization GLB is disabled."
        }
      ]
    });

    expect(result.ok).toBe(false);
    expect(result.missingRequiredChecks).toEqual([
      V7_BROWSER_WORKFLOW_GLB_DOWNLOAD_CHECK_ID
    ]);
    expect(formatV7BrowserWorkflowSmokeSummary(result)).toContain(
      "- missing required glb-download: skipped (Download visualization GLB is disabled.)"
    );
  });

  it("passes when required GLB download passes", () => {
    const result = createV7BrowserWorkflowSmokeResult({
      checks: [
        {
          id: "app-load",
          label: "app loaded",
          status: "pass"
        },
        {
          id: V7_BROWSER_WORKFLOW_GLB_DOWNLOAD_CHECK_ID,
          label: "ready derived visualization mesh exported as transient GLB",
          status: "pass"
        }
      ],
      ids: {},
      requiredCheckIds: ["app-load", V7_BROWSER_WORKFLOW_GLB_DOWNLOAD_CHECK_ID],
      skipped: []
    });

    expect(result.ok).toBe(true);
    expect(result.missingRequiredChecks).toEqual([]);
    expect(result.passedCount).toBe(2);
  });
});
