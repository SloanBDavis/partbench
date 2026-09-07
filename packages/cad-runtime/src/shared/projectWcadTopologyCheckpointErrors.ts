import type { WcadPackageValidationIssue } from "@web-cad/cad-protocol";

export class ProjectWcadTopologyCheckpointPayloadError extends Error {
  readonly issues: readonly WcadPackageValidationIssue[];

  constructor(issues: readonly WcadPackageValidationIssue[]) {
    super(formatCheckpointPayloadIssues(issues));
    this.name = "ProjectWcadTopologyCheckpointPayloadError";
    this.issues = issues;
  }
}

export function isProjectWcadTopologyCheckpointPayloadError(
  error: unknown
): error is ProjectWcadTopologyCheckpointPayloadError {
  return error instanceof ProjectWcadTopologyCheckpointPayloadError;
}

function formatCheckpointPayloadIssues(
  issues: readonly WcadPackageValidationIssue[]
): string {
  if (issues.length === 0) {
    return "Could not save exact topology evidence.";
  }

  if (issues.length === 1) {
    return issues[0]?.message ?? "Could not save exact topology evidence.";
  }

  return `Could not save exact topology evidence because ${issues.length} issues were found.`;
}
