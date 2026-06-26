import type {
  CadTopologyIdentityCapabilityReadiness,
  ProjectTopologyIdentityReadinessQueryResponse,
  WcadReadinessStatus
} from "@web-cad/cad-protocol";
import { formatVisibleDiagnosticMessage } from "./viewportVisibleText";

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
  readonly boundaryDetail: string;
  readonly jsonWarning?: string;
  readonly capabilityRows: readonly ProjectTopologyIdentityDisplayRow[];
}

export function createProjectTopologyIdentityDisplay(
  readiness: ProjectTopologyIdentityReadinessQueryResponse
): ProjectTopologyIdentityDisplay {
  const hasSavedEvidence =
    readiness.checkpointCount > 0 || readiness.anchorCount > 0;
  const packageSummary = hasSavedEvidence
    ? "Saved with .wcad"
    : "Ready for .wcad";

  return {
    statusLabel: getTopologyIdentityStatusLabel(readiness.status),
    checkpointSummary: pluralize(
      readiness.checkpointCount,
      "shape record",
      "shape records"
    ),
    anchorSummary: pluralize(
      readiness.anchorCount,
      "saved reference",
      "saved references"
    ),
    packageSummary,
    detail: hasSavedEvidence
      ? "Saved reference identity is tracked in the project source."
      : "No saved shape evidence has been written for this project.",
    boundaryDetail:
      "Only project source and saved shape evidence are used for CAD references.",
    jsonWarning: hasSavedEvidence
      ? "Use .wcad to keep saved shape evidence intact. JSON import/export is source interchange and may omit exact shape evidence."
      : undefined,
    capabilityRows: readiness.capabilities.map(formatCapability)
  };
}

function formatCapability(
  capability: CadTopologyIdentityCapabilityReadiness
): ProjectTopologyIdentityDisplayRow {
  const firstDiagnostic = capability.diagnostics[0];

  return {
    label: formatProjectEvidenceCopy(capability.label),
    value: getTopologyIdentityStatusLabel(capability.status),
    detail: formatProjectEvidenceCopy(
      firstDiagnostic?.message ??
        (capability.available
          ? "Capability is available."
          : "Capability is not available.")
    )
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

function formatProjectEvidenceCopy(text: string): string {
  return formatVisibleDiagnosticMessage(text)
    .replace(/\bB-rep checkpoint\b/gi, "Exact shape evidence")
    .replace(/\bB-rep\b/gi, "Exact shape")
    .replace(/\btopology identity\b/gi, "saved reference identity")
    .replace(/\btopology\b/gi, "reference")
    .replace(/\bcheckpoints?\b/gi, "shape evidence")
    .replace(/\banchors?\b/gi, "saved references");
}
