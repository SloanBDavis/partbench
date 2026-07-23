import type { CadDependencyHealthStatus } from "@web-cad/cad-protocol";

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
  /**
   * Current exact-result sources and their app-local derived states. These are
   * optional while callers migrate, but a positive source count without a
   * snapshot is still treated as pending rather than ready.
   */
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
}

/**
 * One compact result state for the Solid status bar. Command idleness alone is
 * not success: an authored result is ready only after its display derivation
 * and dependency health have also been considered.
 */
export function createModelingResultState({
  commandPending,
  commandFailed,
  derivedGeometryEnabled,
  derivedSourceCount,
  derivedGeometry,
  derivedExactMetadata,
  derivedExactSourceCount,
  projectHealthStatus
}: ModelingResultStateInput): string {
  const exactSourceCount =
    derivedExactSourceCount ?? derivedExactMetadata?.entries.length ?? 0;

  if (commandPending) return "Updating";
  if (commandFailed) return "Update failed";

  if (!derivedGeometryEnabled && derivedSourceCount > 0) {
    return "Fallback display only";
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
