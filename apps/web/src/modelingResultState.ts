import type { CadDependencyHealthStatus } from "@web-cad/cad-protocol";
import type { CurrentExactResultProjection } from "./currentExactResultProjection";

export interface ModelingResultStateInput {
  readonly commandPending: boolean;
  readonly commandFailed: boolean;
  readonly derivedGeometryEnabled: boolean;
  readonly derivedSourceCount: number;
  readonly derivedGeometry: {
    readonly entries: readonly {
      readonly status:
        | "unsupported"
        | "pending"
        | "ready"
        | "error"
        | "cancelled";
    }[];
    readonly errorCount: number;
    readonly pendingCount: number;
    readonly cancelledCount?: number;
  };
  readonly derivedExactSourceCount?: number;
  readonly derivedExactMetadata?: {
    readonly entries: readonly {
      readonly status:
        | "unsupported"
        | "pending"
        | "ready"
        | "error"
        | "cancelled";
    }[];
    readonly errorCount: number;
    readonly pendingCount: number;
    readonly cancelledCount?: number;
  };
  readonly projectHealthStatus: CadDependencyHealthStatus;
  readonly currentExactResults?: readonly Pick<
    CurrentExactResultProjection,
    "status"
  >[];
}

export function createModelingResultState({
  commandPending,
  commandFailed,
  derivedGeometryEnabled,
  derivedSourceCount,
  derivedGeometry,
  derivedExactMetadata,
  derivedExactSourceCount,
  projectHealthStatus,
  currentExactResults
}: ModelingResultStateInput): string {
  const exactSourceCount =
    derivedExactSourceCount ?? derivedExactMetadata?.entries.length ?? 0;

  if (commandPending) return "Updating";
  if (commandFailed) return "Update failed";

  if (!derivedGeometryEnabled && derivedSourceCount > 0) {
    return "Fallback display only";
  }

  if (currentExactResults?.length) {
    const count = (status: CurrentExactResultProjection["status"]) =>
      currentExactResults.filter((result) => result.status === status).length;
    const failed = count("failed");
    if (failed > 0)
      return `${failed} exact ${plural(failed, "result", "results")} failed`;
    const unsupported = count("unsupported");
    if (unsupported > 0) {
      return `${unsupported} exact ${plural(unsupported, "result", "results")} unavailable`;
    }
    const needsAttention = count("blocked") + count("stale");
    if (needsAttention > 0) {
      return `${needsAttention} exact ${plural(needsAttention, "result needs", "results need")} attention`;
    }
    if (count("pending") > 0) return "Building exact results";
  }

  if (derivedGeometry.errorCount > 0) {
    return `${derivedGeometry.errorCount} ${plural(
      derivedGeometry.errorCount,
      "result",
      "results"
    )} failed`;
  }

  const displayCancelledCount = Math.max(
    derivedGeometry.cancelledCount ?? 0,
    derivedGeometry.entries.filter((entry) => entry.status === "cancelled")
      .length
  );
  if (displayCancelledCount > 0) {
    return `${displayCancelledCount} display ${plural(
      displayCancelledCount,
      "result",
      "results"
    )} cancelled`;
  }

  const unsupportedCount = derivedGeometry.entries.filter(
    (entry) => entry.status === "unsupported"
  ).length;
  if (unsupportedCount > 0) {
    return `${unsupportedCount} ${plural(
      unsupportedCount,
      "result",
      "results"
    )} unavailable`;
  }

  if (
    derivedGeometry.pendingCount > 0 ||
    derivedGeometry.entries.length < derivedSourceCount
  ) {
    return "Building results";
  }

  if (derivedExactMetadata?.errorCount) {
    return `${derivedExactMetadata.errorCount} exact ${plural(
      derivedExactMetadata.errorCount,
      "result",
      "results"
    )} failed`;
  }

  const exactCancelledCount = Math.max(
    derivedExactMetadata?.cancelledCount ?? 0,
    derivedExactMetadata?.entries.filter(
      (entry) => entry.status === "cancelled"
    ).length ?? 0
  );
  if (exactCancelledCount > 0) {
    return `${exactCancelledCount} exact ${plural(
      exactCancelledCount,
      "result",
      "results"
    )} cancelled`;
  }

  const exactUnsupportedCount =
    derivedExactMetadata?.entries.filter(
      (entry) => entry.status === "unsupported"
    ).length ?? 0;
  if (exactUnsupportedCount > 0) {
    return `${exactUnsupportedCount} exact ${plural(
      exactUnsupportedCount,
      "result",
      "results"
    )} unavailable`;
  }

  if (
    (derivedExactMetadata?.pendingCount ?? 0) > 0 ||
    (derivedExactMetadata?.entries.length ?? 0) < exactSourceCount
  ) {
    return "Display ready · Building exact results";
  }

  if (projectHealthStatus === "under-defined") {
    return "Ready with design notes";
  }
  if (projectHealthStatus !== "healthy") return "Needs attention";
  return "Ready";
}

function plural(count: number, singular: string, pluralForm: string): string {
  return count === 1 ? singular : pluralForm;
}
