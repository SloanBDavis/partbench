import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  createV7BrowserWorkflowSmokeResult,
  formatV7BrowserWorkflowSmokeSummary,
  getV7BrowserWorkflowRequiredCheckIds,
  V10_BROWSER_WORKFLOW_CHECK_IDS,
  V12_BROWSER_WORKFLOW_CHECK_IDS,
  V8_WCAD_WORKFLOW_DERIVED_MESH_CACHE_CHECK_ID,
  V7_BROWSER_WORKFLOW_GLB_DOWNLOAD_CHECK_ID,
  V7_BROWSER_WORKFLOW_REQUIRED_CHECK_IDS
} from "./v7-browser-workflow.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

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
          detail: "Reference status was not visible.",
          id: "reference-status",
          label: "semantic reference status visible",
          status: "fail"
        }
      ],
      requiredCheckIds: [
        "app-load",
        "reference-status",
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
        "- fail reference-status: semantic reference status visible",
        "  Reference status was not visible.",
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
        "primary-tools-language",
        "advanced-tools-cleanup",
        "advanced-tools-scrollability",
        "circle-body-reference-contract",
        "circle-viewport-body-pick-selection-routing",
        "circle-viewport-generated-face-pick-selection-routing",
        "circle-viewport-generated-edge-pick-selection-routing",
        "viewport-body-pick-selection-routing",
        "viewport-body-measure-inspect",
        "viewport-unobstructed-after-navigation-measurement",
        "viewport-responsive-text-readability",
        "viewport-generated-face-pick-selection-routing",
        "viewport-generated-face-contextual-actions",
        "viewport-generated-face-measure-inspect",
        "viewport-generated-edge-pick-selection-routing",
        "viewport-generated-edge-contextual-actions",
        "viewport-generated-edge-measure-inspect",
        "viewport-two-target-measure",
        "viewport-escape-clears-transient-detail",
        "viewport-unobstructed-selection-layout",
        "attached-sketch-create",
        "consumed-body-diagnostic",
        "project-wcad-save-as-download",
        "project-wcad-open-upload",
        "project-wcad-roundtrip-model",
        "project-wcad-viewport-usable",
        "project-roundtrip-viewport-unobstructed",
        "project-json-load-preview",
        "project-json-roundtrip-diagnostic",
        "viewport-narrow-layout-smoke",
        "viewport-narrow-scroll-readability"
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

  it("keeps the V8 derived mesh cache check optional unless required", () => {
    expect(getV7BrowserWorkflowRequiredCheckIds()).not.toContain(
      V8_WCAD_WORKFLOW_DERIVED_MESH_CACHE_CHECK_ID
    );
    expect(
      getV7BrowserWorkflowRequiredCheckIds({ requireDerivedMeshCache: true })
    ).toEqual(
      expect.arrayContaining([V8_WCAD_WORKFLOW_DERIVED_MESH_CACHE_CHECK_ID])
    );
  });

  it("keeps V10 browser workflow checks optional unless required", () => {
    expect(getV7BrowserWorkflowRequiredCheckIds()).not.toEqual(
      expect.arrayContaining(V10_BROWSER_WORKFLOW_CHECK_IDS)
    );
    expect(
      getV7BrowserWorkflowRequiredCheckIds({ requireV10Workflow: true })
    ).toEqual(expect.arrayContaining(V10_BROWSER_WORKFLOW_CHECK_IDS));
  });

  it("emits every required V10 browser workflow check from the smoke runner", async () => {
    const smokeSource = await readFile(
      resolve(repoRoot, "scripts/smoke-v7-browser-workflow.mjs"),
      "utf8"
    );
    const emittedCheckIds = new Set(
      [...smokeSource.matchAll(/\b(?:pass|fail)\(\s*"([^"]+)"/g)].map(
        (match) => match[1]
      )
    );

    for (const id of V10_BROWSER_WORKFLOW_CHECK_IDS) {
      expect(emittedCheckIds).toContain(id);
    }
  });

  it("keeps V12 browser workflow checks optional unless required", () => {
    expect(getV7BrowserWorkflowRequiredCheckIds()).not.toEqual(
      expect.arrayContaining(V12_BROWSER_WORKFLOW_CHECK_IDS)
    );
    expect(
      getV7BrowserWorkflowRequiredCheckIds({ requireV12Workflow: true })
    ).toEqual(expect.arrayContaining(V12_BROWSER_WORKFLOW_CHECK_IDS));
  });

  it("emits every required V12 browser workflow check from the smoke runner", async () => {
    const smokeSource = await readFile(
      resolve(repoRoot, "scripts/smoke-v7-browser-workflow.mjs"),
      "utf8"
    );
    const emittedCheckIds = new Set(
      [...smokeSource.matchAll(/\b(?:pass|fail)\(\s*"([^"]+)"/g)].map(
        (match) => match[1]
      )
    );

    for (const id of V12_BROWSER_WORKFLOW_CHECK_IDS) {
      expect(emittedCheckIds).toContain(id);
    }
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

  it("keeps release package smoke aliases on the compatibility browser runner", async () => {
    const packageJson = JSON.parse(
      await readFile(resolve(repoRoot, "package.json"), "utf8")
    );
    const compatibilityBrowserRunner =
      "VITE_ENABLE_DERIVED_GEOMETRY=true pnpm build && node scripts/smoke-v7-browser-workflow.mjs";
    const v10BrowserRunner =
      "VITE_ENABLE_DERIVED_GEOMETRY=true pnpm build && node scripts/smoke-v7-browser-workflow.mjs --require-v10-workflow --require-derived-mesh-cache";
    const v12BrowserRunner =
      "VITE_ENABLE_DERIVED_GEOMETRY=true pnpm build && node scripts/smoke-v7-browser-workflow.mjs --require-v12-workflow";

    expect(packageJson.scripts["smoke:v8-wcad-workflow"]).toBe(
      compatibilityBrowserRunner
    );
    expect(packageJson.scripts["smoke:v9-viewport-workflow"]).toBe(
      compatibilityBrowserRunner
    );
    expect(packageJson.scripts["smoke:v10-browser-workflow"]).toBe(
      v10BrowserRunner
    );
    expect(packageJson.scripts["smoke:v12-browser-workflow"]).toBe(
      v12BrowserRunner
    );
  });
});
