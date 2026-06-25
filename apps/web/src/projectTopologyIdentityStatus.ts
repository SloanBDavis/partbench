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
  const packageSummary =
    readiness.currentPackageVersion === readiness.plannedPackageVersion
      ? readiness.currentPackageVersion
      : `${readiness.currentPackageVersion} -> ${readiness.plannedPackageVersion}`;

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
      ? "Topology identity records are source-owned and tracked by cad-core."
      : "No topology checkpoints or anchors have been written for this project.",
    jsonWarning: hasTopologyRecords
      ? "Use .wcad for topology checkpoint payload preservation. JSON import/export may not carry checkpoint payload bytes."
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
