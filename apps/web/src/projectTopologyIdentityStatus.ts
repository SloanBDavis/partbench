import type {
  CadTopologyIdentityCapabilityReadiness,
  ProjectTopologyIdentityReadinessQueryResponse,
  WcadReadinessStatus
} from "@web-cad/cad-protocol";

export interface ProjectTopologyIdentityDisplayRow {
  readonly label: string;
  readonly value: string;
  readonly detail: string;
}

export interface ProjectTopologyIdentityDisplay {
  readonly statusLabel: string;
  readonly checkpointSummary: string;
  readonly anchorSummary: string;
  readonly packageSummary: string;
  readonly detail: string;
  readonly jsonWarning?: string;
  readonly capabilityRows: readonly ProjectTopologyIdentityDisplayRow[];
}

export function createProjectTopologyIdentityDisplay(
  readiness: ProjectTopologyIdentityReadinessQueryResponse
): ProjectTopologyIdentityDisplay {
  const hasTopologyRecords =
    readiness.checkpointCount > 0 || readiness.anchorCount > 0;
  const packageSummary = hasTopologyRecords
    ? "Saved with .wcad"
    : "Ready for .wcad";

  return {
    statusLabel: getTopologyIdentityStatusLabel(readiness.status),
    checkpointSummary: pluralize(
      readiness.checkpointCount,
      "checkpoint",
      "checkpoints"
    ),
    anchorSummary: pluralize(readiness.anchorCount, "anchor", "anchors"),
    packageSummary,
    detail: hasTopologyRecords
      ? "Saved topology identity is tracked in the project source."
      : "No saved topology evidence has been written for this project.",
    jsonWarning: hasTopologyRecords
      ? "Use .wcad to keep saved topology evidence intact. JSON import/export is source interchange and may omit exact shape evidence."
      : undefined,
    capabilityRows: readiness.capabilities.map(formatCapability)
  };
}

function formatCapability(
  capability: CadTopologyIdentityCapabilityReadiness
): ProjectTopologyIdentityDisplayRow {
  const firstDiagnostic = capability.diagnostics[0];

  return {
    label: capability.label,
    value: getTopologyIdentityStatusLabel(capability.status),
    detail:
      firstDiagnostic?.message ??
      (capability.available
        ? "Capability is available."
        : "Capability is not available.")
  };
}

function getTopologyIdentityStatusLabel(status: WcadReadinessStatus): string {
  switch (status) {
    case "supported":
      return "Supported";
    case "deferred":
      return "Partial";
    case "unavailable":
      return "Unavailable";
  }
}

function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
