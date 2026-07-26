import type {
  CadSketchSolverStatus,
  SketchDimensionEntry,
  SketchSolverStatusQueryResponse
} from "@web-cad/cad-protocol";

export function formatSketchSolverStatus(
  status: SketchSolverStatusQueryResponse | undefined
): string {
  if (!status) {
    return "Solver status unavailable";
  }

  const profileText = formatSketchProfileValidity(status);
  const solverText = status.solver.solverRan
    ? `Numerical ${formatSketchNumericalSolverStatus(
        status.solver.numericalSolverStatus
      )}`
    : "Numerical solver not run";

  if (
    status.status === "solved" ||
    status.status === "fully-defined" ||
    status.status === "under-defined"
  ) {
    return `${solverText} · ${profileText}`;
  }

  return `${getSketchSolverStatusLabel(status.status)} · ${
    status.diagnosticCount
  } diagnostic${status.diagnosticCount === 1 ? "" : "s"} · ${profileText}`;
}

export function formatSketchProfileValidity(
  status: SketchSolverStatusQueryResponse
): string {
  const profile = status.profileValidity;
  const profileLabel =
    profile.status === "valid"
      ? "feature-ready"
      : profile.status === "invalid"
        ? "invalid"
        : profile.status === "not-evaluated"
          ? "not evaluated"
          : "unsupported";

  return `${profile.validProfileCount}/${profile.profileCount} ${profileLabel} ${
    profile.profileCount === 1 ? "profile" : "profiles"
  }`;
}

export function getSketchSolverStatusLabel(
  status: CadSketchSolverStatus
): string {
  switch (status) {
    case "not-run":
      return "Not run";
    case "solved":
      return "Solved";
    case "fully-defined":
      return "Fully defined";
    case "under-defined":
      return "Under-defined";
    case "over-defined":
      return "Over-defined";
    case "conflicting":
      return "Conflicting";
    case "redundant":
      return "Redundant";
    case "failed":
      return "Failed";
    case "unsupported":
      return "Unsupported";
    case "missing-target":
      return "Missing target";
  }
}

export function getParameterDimensionUsageCount(
  parameterId: string,
  dimensions: readonly SketchDimensionEntry[]
): number {
  return dimensions.filter(
    (dimension) =>
      dimension.valueSource.type === "parameter" &&
      dimension.valueSource.parameterId === parameterId
  ).length;
}

function formatSketchNumericalSolverStatus(
  status: SketchSolverStatusQueryResponse["solver"]["numericalSolverStatus"]
): string {
  switch (status) {
    case "converged":
      return "converged";
    case "under-defined":
      return "under-defined";
    case "over-defined":
      return "over-defined";
    case "conflicting":
      return "conflicting";
    case "failed":
      return "failed";
    case "unsupported":
      return "unsupported";
    case "deferred":
      return "not ready";
    case "not-run":
      return "not run";
  }
}
