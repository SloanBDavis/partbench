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
  "v10-repaired-reference-wcad-roundtrip",
  "v10-non-extrude-generated-reference-routing",
  "v10-c2-inspector-feature-edits"
]);
export const V12_BROWSER_WORKFLOW_CHECK_IDS = Object.freeze([
  "v12-cut-result-face-command-ready-browser",
  "v12-cut-result-face-contextual-actions",
  "v12-cut-result-face-attached-sketch",
  "v12-cut-result-edge-command-ready-browser",
  "v12-cut-result-edge-contextual-actions",
  "v12-cut-result-edge-no-deferred-finish",
  "v12-named-reference-repair-browser",
  "v12-add-result-create",
  "v12-add-result-cap-command-ready-browser",
  "v12-add-result-cap-contextual-actions",
  "v12-add-result-cap-attached-sketch",
  "v12-add-result-wall-command-ready-browser",
  "v12-add-result-wall-contextual-actions",
  "v12-add-result-edge-command-ready-browser",
  "v12-add-result-edge-contextual-actions",
  "v12-add-result-edge-no-deferred-finish",
  "v12-add-result-edge-repair-browser",
  "v12-circle-cut-result-create",
  "v12-circle-cut-result-wall-command-ready-browser",
  "v12-circle-cut-result-wall-no-sketch",
  "v12-circle-cut-result-rim-command-ready-browser",
  "v12-circle-cut-result-rim-options-browser",
  "v12-circle-cut-result-rim-no-deferred-finish",
  "v12-circle-add-result-create",
  "v12-circle-add-result-cap-command-ready-browser",
  "v12-circle-add-result-wall-command-ready-browser",
  "v12-circle-add-result-wall-no-sketch",
  "v12-circle-add-result-edge-command-ready-browser",
  "v12-circle-add-result-edge-no-deferred-finish"
]);
export const V13_BROWSER_WORKFLOW_CHECK_IDS = Object.freeze([
  "v13-project-json-import",
  "v13-project-topology-status",
  "v13-wcad-save-as-checkpoint-payloads",
  "v13-repaired-reference-command-ready",
  "v13-repaired-reference-topology-provenance",
  "v13-explicit-stable-reference-action",
  "v13-stable-reference-repair-candidate-preview",
  "v13-stable-reference-repair-action",
  "v13-explicit-stable-reference-wcad",
  "v13-target-body-consumed-diagnostic",
  "v13-downstream-anchor-cut-export",
  "v13-no-private-topology-ui-leak"
]);
export const V14_BROWSER_WORKFLOW_CHECK_IDS = Object.freeze([
  "v14-project-file-user-facing-json-copy-browser",
  "v14-result-face-add-rectangle-entity-browser",
  "v14-result-face-rectangle-add-browser",
  "v14-result-add-topology-source-json-browser",
  "v14-circle-result-face-add-circle-entity-browser",
  "v14-circle-result-face-circle-add-browser",
  "v14-circle-result-add-topology-source-json-browser",
  "v14-rectangle-result-face-rectangle-entity-browser",
  "v14-rectangle-result-face-rectangle-cut-browser",
  "v14-rectangle-result-cut-topology-source-json-browser",
  "v14-result-face-attached-sketch-browser",
  "v14-result-face-rectangle-entity-browser",
  "v14-result-face-rectangle-cut-browser",
  "v14-result-cut-topology-source-json-browser",
  "v14-cylinder-side-plane-circle-entity-browser",
  "v14-cylinder-side-plane-hole-browser",
  "v14-cylinder-side-plane-hole-display-ready-browser",
  "v14-cylinder-side-plane-hole-source-json-browser",
  "v14-result-cut-wall-selected-edge-chamfer-browser",
  "v14-result-cut-wall-selected-edge-chamfer-display-ready-browser",
  "v14-result-cut-wall-selected-edge-source-json-browser",
  "v14-result-cut-wall-selected-edge-fillet-browser",
  "v14-result-cut-wall-selected-edge-fillet-display-ready-browser",
  "v14-result-cut-wall-selected-edge-fillet-source-json-browser",
  "v14-result-cut-wall-named-edge-reference-browser",
  "v14-result-cut-wall-edge-chamfer-browser",
  "v14-result-cut-wall-edge-finish-source-json-browser",
  "v14-result-cut-wall-edge-fillet-browser",
  "v14-result-cut-wall-edge-fillet-source-json-browser",
  "v14-result-edge-upstream-edit-blocked-browser",
  "v14-result-edge-undo-editable-browser",
  "v14-result-edge-redo-blocked-browser",
  "v14-result-face-circle-entity-browser",
  "v14-result-face-circle-hole-browser",
  "v14-result-face-circle-hole-display-ready-browser",
  "v14-result-hole-wcad-roundtrip-browser",
  "v14-result-hole-upstream-edit-blocked-browser",
  "v14-result-hole-topology-source-json-browser",
  "v14-normal-surfaces-user-facing-copy-browser"
]);

export function getV7BrowserWorkflowRequiredCheckIds({
  requireGlbDownload = false,
  requireDerivedMeshCache = false,
  requireV10Workflow = false,
  requireV12Workflow = false,
  requireV13Workflow = false,
  requireV14Workflow = false
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

  if (requireV12Workflow) {
    for (const id of V12_BROWSER_WORKFLOW_CHECK_IDS) {
      if (!requiredCheckIds.includes(id)) {
        requiredCheckIds.push(id);
      }
    }
  }

  if (requireV13Workflow) {
    for (const id of V13_BROWSER_WORKFLOW_CHECK_IDS) {
      if (!requiredCheckIds.includes(id)) {
        requiredCheckIds.push(id);
      }
    }
  }

  if (requireV14Workflow) {
    for (const id of V14_BROWSER_WORKFLOW_CHECK_IDS) {
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
