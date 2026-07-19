export type UserDiagnosticTone = "info" | "warning" | "error";

export interface StructuredDiagnosticInput {
  readonly code?: string;
  readonly severity?: string;
  readonly message?: string;
  readonly detail?: unknown;
  readonly context?: Readonly<Record<string, unknown>>;
}

export interface UserDiagnostic {
  readonly title: string;
  readonly description: string;
  readonly recovery?: string;
  readonly tone: UserDiagnosticTone;
}

interface DiagnosticCopy {
  readonly title: string;
  readonly description: string;
  readonly recovery?: string;
}

const COPY_BY_CODE: Readonly<Record<string, DiagnosticCopy>> = {
  SKETCH_PROFILE_OPEN: {
    title: "Profile is open.",
    description: "The selected sketch does not form a closed profile.",
    recovery: "Connect the highlighted endpoints before creating this feature."
  },
  SKETCH_PATH_JOIN_NOT_TANGENT: {
    title: "Sweep path has a sharp corner.",
    description: "The selected line and arc do not meet tangentially.",
    recovery: "Use a tangent line and arc join for this sweep."
  },
  SKETCH_PROFILE_EMPTY: {
    title: "No profile is available.",
    description: "The sketch does not contain eligible profile geometry.",
    recovery: "Create a closed profile, then select it again."
  },
  SKETCH_PROFILE_AMBIGUOUS: {
    title: "Choose a profile.",
    description: "More than one supported profile is available.",
    recovery: "Select the profile you want to use."
  },
  SKETCH_NOT_FOUND: {
    title: "Sketch is no longer available.",
    description: "The selected feature cannot find its source sketch.",
    recovery: "Select a current sketch or edit the feature's selections."
  },
  CONSUMED_SELECTION_BODY: consumedTargetCopy(),
  TARGET_BODY_CONSUMED: consumedTargetCopy(),
  BODY_CONSUMED: consumedTargetCopy(),
  STALE_NAMED_REFERENCE: staleReferenceCopy(),
  NAMED_REFERENCE_STALE: staleReferenceCopy(),
  REFERENCE_STALE: staleReferenceCopy(),
  GEOMETRY_WORKER_UNAVAILABLE: geometryUnavailableCopy(),
  GEOMETRY_WORKER_ERROR: geometryUnavailableCopy(),
  GEOMETRY_DISPLAY_UNAVAILABLE: geometryUnavailableCopy(),
  EXPORT_PROJECT_EMPTY: {
    title: "There is nothing to export.",
    description: "The document does not contain an eligible result body.",
    recovery: "Create a solid result, then review export readiness again."
  },
  EXPORT_EXACT_WRITER_UNAVAILABLE: {
    title: "STEP export is unavailable.",
    description: "An exact result cannot be written in this environment.",
    recovery:
      "Keep the document saved and retry when exact export is available."
  },
  EXPORT_WRITER_NOT_IMPLEMENTED: {
    title: "STEP export is unavailable.",
    description: "This result cannot currently be written as STEP.",
    recovery: "Save the project and use an available export format."
  }
};

/** Internal vocabulary prohibited from default visible and accessible copy. */
export const INTERNAL_TEXT_PATTERNS: readonly RegExp[] = [
  /\bCADOps\b/i,
  /\b(?:schema|checkpoint)\s*(?:version|id|hash)?\b/i,
  /\b(?:stable|source|feature|body|entity|renderer|mesh|triangle|worker|cache|gpu|selection[- ]?buffer|file[- ]?handle|opfs)[-_ ]?id\b/i,
  /\b(?:renderer|mesh|triangle|worker|cache|gpu|selection[- ]?buffer|opfs)\b/i,
  /\bgenerated:/i,
  /\bweb-cad\.project\.v\d+\b/i,
  /\bpartbench\.wcad\.v\d+\b/i,
  /\b[A-Fa-f0-9]{32,}\b/
] as const;

export function translateUserDiagnostic(
  diagnostic: StructuredDiagnosticInput
): UserDiagnostic {
  const code = normalizeCode(diagnostic.code);
  const copy = COPY_BY_CODE[code] ?? getPatternCopy(code);
  return {
    ...(copy ?? {
      title: "Operation could not be completed.",
      description: "Partbench could not complete this action.",
      recovery: "Review the current selection and values, then try again."
    }),
    tone: normalizeTone(diagnostic.severity)
  };
}

export function formatUserDiagnostic(diagnostic: UserDiagnostic): string {
  return [diagnostic.title, diagnostic.description, diagnostic.recovery]
    .filter((part): part is string => Boolean(part))
    .join(" ");
}

export function containsInternalText(value: string): boolean {
  return INTERNAL_TEXT_PATTERNS.some((pattern) => pattern.test(value));
}

function getPatternCopy(code: string): DiagnosticCopy | undefined {
  if (code.includes("CONSUMED") && code.includes("BODY")) {
    return consumedTargetCopy();
  }
  if (code.includes("REFERENCE") && code.includes("STALE")) {
    return staleReferenceCopy();
  }
  if (
    code.includes("GEOMETRY") &&
    (code.includes("UNAVAILABLE") || code.includes("WORKER"))
  ) {
    return geometryUnavailableCopy();
  }
  return undefined;
}

function normalizeCode(code: string | undefined): string {
  return code?.trim().toUpperCase() ?? "";
}

function normalizeTone(severity: string | undefined): UserDiagnosticTone {
  switch (severity?.toLowerCase()) {
    case "error":
    case "fatal":
      return "error";
    case "info":
    case "success":
      return "info";
    default:
      return "warning";
  }
}

function consumedTargetCopy(): DiagnosticCopy {
  return {
    title: "Target body is no longer available.",
    description: "A later feature has already used this result.",
    recovery: "Select a current result body."
  };
}

function staleReferenceCopy(): DiagnosticCopy {
  return {
    title: "Reference needs repair.",
    description: "The saved reference no longer resolves to current geometry.",
    recovery: "Review the suggested compatible targets."
  };
}

function geometryUnavailableCopy(): DiagnosticCopy {
  return {
    title: "Geometry display is unavailable.",
    description: "Your model source remains saved.",
    recovery: "Retry display generation."
  };
}
