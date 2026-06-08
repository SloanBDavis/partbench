export function createV7BrowserWorkflowSmokeResult({
  checks = [],
  consoleErrors = [],
  exceptions = [],
  ids,
  skipped = []
}) {
  const failedChecks = checks.filter((check) => check.status === "fail");
  const ok =
    failedChecks.length === 0 &&
    consoleErrors.length === 0 &&
    exceptions.length === 0;

  return {
    ok,
    passedCount: checks.filter((check) => check.status === "pass").length,
    failedCount: failedChecks.length,
    skippedCount: skipped.length,
    ids,
    checks,
    skipped,
    consoleErrors,
    exceptions
  };
}

export function formatV7BrowserWorkflowSmokeSummary(result) {
  const lines = [
    `V7 browser workflow smoke ${result.ok ? "passed" : "failed"}`,
    `checks: ${result.passedCount} passed, ${result.failedCount} failed, ${result.skippedCount} skipped`
  ];

  for (const check of result.checks) {
    lines.push(`- ${check.status} ${check.id}: ${check.label}`);
    if (check.detail) {
      lines.push(`  ${check.detail}`);
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
