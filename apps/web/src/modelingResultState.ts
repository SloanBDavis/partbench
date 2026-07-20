import type { CadDependencyHealthStatus } from "@web-cad/cad-protocol";

export interface ModelingResultStateInput {
  readonly commandPending: boolean;
  readonly commandFailed: boolean;
  readonly derivedGeometryEnabled: boolean;
  readonly derivedSourceCount: number;
  readonly derivedGeometry: {
    readonly entries: readonly {
      readonly status: "unsupported" | "pending" | "ready" | "error";
    }[];
    readonly errorCount: number;
    readonly pendingCount: number;
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
  projectHealthStatus
}: ModelingResultStateInput): string {
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

  if (projectHealthStatus === "under-defined") {
    return "Ready with design notes";
  }
  if (projectHealthStatus !== "healthy") return "Needs attention";
  return "Ready";
}

function plural(count: number, singular: string, pluralForm: string): string {
  return count === 1 ? singular : pluralForm;
}
