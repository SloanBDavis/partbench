import type { WcadSourceIdentity } from "@web-cad/cad-protocol";
import type { ProjectPortabilityStatus } from "@web-cad/cad-protocol";

export type ProjectCrashRecoveryState =
  | "idle"
  | "pending"
  | "current"
  | "unavailable"
  | "failed";

export type ProjectCrashRecoveryPortability =
  ProjectPortabilityStatus["status"];

export interface ProjectCrashRecoveryOffer {
  readonly projectName: string;
  readonly committedAt: string;
  readonly sourceIdentitySummary: string;
  readonly units: string;
  readonly bodyCount: number;
  readonly portabilityLabel: string;
  readonly capturedRevisionSummary: string;
}

export interface ProjectCrashRecoveryStatus {
  readonly state: ProjectCrashRecoveryState;
  readonly available: boolean;
  readonly lastResult?: string;
  readonly offer?: ProjectCrashRecoveryOffer;
}

export function createIdleCrashRecoveryStatus(
  lastResult = "No crash recovery snapshot is stored."
): ProjectCrashRecoveryStatus {
  return {
    state: "idle",
    available: true,
    lastResult
  };
}

export function createUnavailableCrashRecoveryStatus(
  lastResult: string
): ProjectCrashRecoveryStatus {
  return {
    state: "unavailable",
    available: false,
    lastResult
  };
}

export function getProjectCrashRecoveryStatusLabel(
  status: ProjectCrashRecoveryStatus
): string {
  switch (status.state) {
    case "pending":
      return "Pending";
    case "current":
      return "Current";
    case "unavailable":
      return "Unavailable";
    case "failed":
      return "Failed";
    case "idle":
      return "None";
  }
}

export function formatSourceIdentitySummary(
  identity: WcadSourceIdentity
): string {
  return `Source ${identity.sha256.slice(0, 8)}`;
}

export function formatPortabilityLabel(
  status: ProjectCrashRecoveryPortability
): string {
  switch (status) {
    case "portable-json":
      return "Portable";
    case "wcad-required":
      return "Checkpoint payloads included";
    case "payload-missing":
      return "Some checkpoint payloads missing";
  }
}

export function createCrashRecoveryOffer(input: {
  readonly projectName: string;
  readonly committedAt: string;
  readonly sourceIdentity: WcadSourceIdentity;
  readonly units: string;
  readonly bodyCount: number;
  readonly portability: ProjectCrashRecoveryPortability;
}): ProjectCrashRecoveryOffer {
  const sourceIdentitySummary = formatSourceIdentitySummary(
    input.sourceIdentity
  );
  return {
    projectName: input.projectName,
    committedAt: input.committedAt,
    sourceIdentitySummary,
    units: input.units,
    bodyCount: input.bodyCount,
    portabilityLabel: formatPortabilityLabel(input.portability),
    capturedRevisionSummary: `${input.projectName} · ${sourceIdentitySummary}`
  };
}

export function crashRecoveryVisibleText(
  status: ProjectCrashRecoveryStatus
): string {
  const parts = [
    getProjectCrashRecoveryStatusLabel(status),
    status.lastResult ?? "",
    status.offer?.projectName ?? "",
    status.offer?.sourceIdentitySummary ?? "",
    status.offer?.portabilityLabel ?? "",
    status.offer?.capturedRevisionSummary ?? ""
  ];
  return parts.join(" ");
}
