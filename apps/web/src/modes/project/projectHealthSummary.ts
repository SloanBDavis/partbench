import type { ProjectHealthQueryResponse } from "@web-cad/cad-protocol";

export function formatProjectHealthSummary(
  health: ProjectHealthQueryResponse | undefined
): string {
  if (!health) return "Not checked";
  if (health.issueCount === 0) return "Healthy";
  if (health.status === "under-defined") {
    return `${health.issueCount} design ${health.issueCount === 1 ? "note" : "notes"}`;
  }
  return `${health.issueCount} ${health.issueCount === 1 ? "issue" : "issues"}`;
}
