export const V7_BROWSER_WORKFLOW_REQUIRED_CHECK_IDS = Object.freeze([
  "app-load",
  "create-sketch",
  "create-rectangle",
  "create-extrude",
  "create-circle",
  "create-circle-extrude",
  "primary-tools-language",
  "advanced-tools-cleanup",
  "advanced-tools-scrollability",
  "circle-body-reference-contract",
  "circle-viewport-body-pick-selection-routing",
  "circle-viewport-generated-face-pick-selection-routing",
  "circle-viewport-generated-edge-pick-selection-routing",
  "viewport-body-pick-selection-routing",
  "viewport-navigation-camera-controls",
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
  "body-reference-contract",
  "viewport-unobstructed-selection-layout",
  "modeling-reference-status",
  "generated-reference-selection",
  "generated-reference-contract",
  "named-reference-create",
  "named-reference-route",
  "attached-sketch-create",
  "attached-sketch-active",
  "attached-cut-create",
  "consumed-body-diagnostic",
  "project-file-panel",
  "step-download",
  "project-opfs-cache-status",
  "project-opfs-cache-clear",
  "project-wcad-save-as-download",
  "project-wcad-open-upload",
  "project-wcad-roundtrip-model",
  "project-wcad-viewport-usable",
  "project-roundtrip-viewport-unobstructed",
  "project-json-export-preview",
  "project-json-load-preview",
  "project-json-import",
  "project-json-roundtrip-model",
  "project-json-roundtrip-diagnostic",
  "viewport-narrow-layout-smoke",
  "viewport-narrow-scroll-readability"
]);

export const V7_BROWSER_WORKFLOW_GLB_DOWNLOAD_CHECK_ID = "glb-download";
export const V8_WCAD_WORKFLOW_DERIVED_MESH_CACHE_CHECK_ID =
  "project-opfs-derived-mesh-cache";
export const V10_BROWSER_WORKFLOW_CHECK_IDS = Object.freeze([
  "v10-feature-edit-commit",
  "v10-reference-health-after-edit",
  "v10-named-reference-repair-browser",
  "v10-repaired-reference-wcad-roundtrip"
]);

export function getV7BrowserWorkflowRequiredCheckIds({
  requireGlbDownload = false,
  requireDerivedMeshCache = false,
  requireV10Workflow = false
} = {}) {
  const requiredCheckIds = [...V7_BROWSER_WORKFLOW_REQUIRED_CHECK_IDS];

  if (
    requireGlbDownload &&
    !requiredCheckIds.includes(V7_BROWSER_WORKFLOW_GLB_DOWNLOAD_CHECK_ID)
  ) {
    requiredCheckIds.push(V7_BROWSER_WORKFLOW_GLB_DOWNLOAD_CHECK_ID);
  }

  if (
    requireDerivedMeshCache &&
    !requiredCheckIds.includes(V8_WCAD_WORKFLOW_DERIVED_MESH_CACHE_CHECK_ID)
  ) {
    requiredCheckIds.push(V8_WCAD_WORKFLOW_DERIVED_MESH_CACHE_CHECK_ID);
  }

  if (requireV10Workflow) {
    for (const id of V10_BROWSER_WORKFLOW_CHECK_IDS) {
      if (!requiredCheckIds.includes(id)) {
        requiredCheckIds.push(id);
      }
    }
  }

  return requiredCheckIds;
}

export function createV7BrowserWorkflowSmokeResult({
  checks = [],
  consoleErrors = [],
  exceptions = [],
  ids,
  requiredCheckIds = getV7BrowserWorkflowRequiredCheckIds(),
  skipped = []
}) {
  const failedChecks = checks.filter((check) => check.status === "fail");
  const observedCheckIds = new Set(checks.map((check) => check.id));
  const missingRequiredChecks = requiredCheckIds.filter(
    (id) => !observedCheckIds.has(id)
  );
  const ok =
    failedChecks.length === 0 &&
    missingRequiredChecks.length === 0 &&
    consoleErrors.length === 0 &&
    exceptions.length === 0;

  return {
    ok,
    passedCount: checks.filter((check) => check.status === "pass").length,
    failedCount: failedChecks.length,
    missingRequiredCount: missingRequiredChecks.length,
    skippedCount: skipped.length,
    ids,
    checks,
    missingRequiredChecks,
    skipped,
    consoleErrors,
    exceptions
  };
}

export function formatV7BrowserWorkflowSmokeSummary(result) {
  const lines = [
    `V7 browser workflow smoke ${result.ok ? "passed" : "failed"}`,
    `checks: ${result.passedCount} passed, ${result.failedCount} failed, ${result.skippedCount} skipped, ${result.missingRequiredCount} missing required`
  ];

  for (const check of result.checks) {
    lines.push(`- ${check.status} ${check.id}: ${check.label}`);
    if (check.detail) {
      lines.push(`  ${check.detail}`);
    }
  }

  for (const missing of result.missingRequiredChecks) {
    const skipped = result.skipped.find((skip) => skip.id === missing);

    if (skipped) {
      lines.push(`- missing required ${missing}: skipped (${skipped.reason})`);
    } else {
      lines.push(`- missing required ${missing}`);
    }
  }

  for (const skipped of result.skipped) {
    lines.push(`- skip ${skipped.id}: ${skipped.reason}`);
  }

  for (const error of result.consoleErrors) {
    lines.push(`- console-error ${error}`);
  }

  for (const exception of result.exceptions) {
    lines.push(`- exception ${exception}`);
  }

  return lines.join("\n");
}
