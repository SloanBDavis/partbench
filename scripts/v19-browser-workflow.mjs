export const V19_GATE_B_BROWSER_WORKFLOW_VERSION =
  "partbench.v19-gate-b-browser-workflow.v1";

export const V19_GATE_B_BROWSER_REQUIRED_CHECK_IDS = Object.freeze([
  "v19-gate-b-production-app",
  "v19-gate-b-pointer-collector",
  "v19-gate-b-keyboard-trim",
  "v19-gate-b-keyboard-extend",
  "v19-gate-b-authored-state",
  "v19-gate-b-single-step-undo-redo",
  "v19-gate-b-keyboard-only",
  "v19-gate-b-dirty-navigation-focus"
]);

export function createV19GateBBrowserWorkflowResult({
  checks = [],
  consoleErrors = [],
  exceptions = [],
  requiredCheckIds = V19_GATE_B_BROWSER_REQUIRED_CHECK_IDS
} = {}) {
  const normalizedChecks = checks.map((check) => ({
    id: String(check.id),
    passed: check.passed === true,
    ...(check.evidence === undefined ? {} : { evidence: check.evidence })
  }));
  const checkIds = normalizedChecks.map((check) => check.id);
  const duplicateCheckIds = [
    ...new Set(checkIds.filter((id, index) => checkIds.indexOf(id) !== index))
  ];
  const missingCheckIds = requiredCheckIds.filter(
    (id) => !checkIds.includes(id)
  );
  const failedCheckIds = normalizedChecks
    .filter((check) => !check.passed)
    .map((check) => check.id);
  const failures = [
    ...duplicateCheckIds.map((id) => `Duplicate required check: ${id}`),
    ...missingCheckIds.map((id) => `Missing required check: ${id}`),
    ...failedCheckIds.map((id) => `Failed required check: ${id}`),
    ...consoleErrors.map((error) => `Browser console: ${error}`),
    ...exceptions.map((error) => `Browser exception: ${error}`)
  ];

  return {
    workflowVersion: V19_GATE_B_BROWSER_WORKFLOW_VERSION,
    ok: failures.length === 0,
    checkCount: normalizedChecks.length,
    passedCount: normalizedChecks.filter((check) => check.passed).length,
    checks: normalizedChecks,
    failures
  };
}

export function formatV19GateBBrowserWorkflowSummary(result) {
  const lines = [
    `V19 Gate B browser workflow: ${result.passedCount}/${result.checkCount} checks passed.`
  ];
  for (const check of result.checks) {
    lines.push(`- ${check.passed ? "pass" : "fail"} ${check.id}`);
  }
  for (const failure of result.failures) {
    lines.push(`- error ${failure}`);
  }
  return lines.join("\n");
}
