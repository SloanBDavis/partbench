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
  SKETCH_REGION_PROFILE_EMPTY: {
    title: "No region is selected.",
    description: "Select at least one complete region."
  },
  SKETCH_REGION_SKETCH_MISMATCH: {
    title: "Regions come from different sketches.",
    description: "Select regions from one sketch."
  },
  SKETCH_REGION_LOOP_OPEN: {
    title: "Region loop is open.",
    description: "Connect the open endpoints, then discover regions again."
  },
  SKETCH_REGION_LOOP_INTERSECTION: {
    title: "Region boundary intersects itself.",
    description: "Remove the crossing before using this region."
  },
  SKETCH_REGION_BOUNDARY_TOUCHING: {
    title: "Region boundaries touch.",
    description: "Move or resize the touching geometry."
  },
  SKETCH_REGION_HOLE_OUTSIDE: {
    title: "A hole is outside its region.",
    description: "Move or resize the inner loop."
  },
  SKETCH_REGION_HOLES_OVERLAP: {
    title: "Region holes overlap.",
    description: "Separate the overlapping loops."
  },
  SKETCH_REGION_MATERIAL_OVERLAP: {
    title: "Selected regions overlap.",
    description: "Select non-overlapping regions."
  },
  SKETCH_REGION_NESTING_UNSUPPORTED: {
    title: "Region nesting is unsupported.",
    description: "Split nested geometry into separate regions."
  },
  SKETCH_REGION_COMPLEXITY_LIMIT: {
    title: "Region is too complex.",
    description: "Simplify the sketch or narrow the selected geometry."
  },
  SKETCH_REGION_ENTITY_MISSING: {
    title: "Region geometry is missing.",
    description: "Edit the feature and select a current region."
  },
  SKETCH_REGION_ENTITY_UNSUPPORTED: {
    title: "Region geometry is unsupported.",
    description: "Use rectangles, circles, lines, or circular arcs."
  },
  SKETCH_REGION_CONSTRUCTION_ENTITY: {
    title: "Construction geometry cannot bound material.",
    description: "Use ordinary sketch geometry for the boundary."
  },
  SKETCH_REGION_ENTITY_REPEATED: {
    title: "Region boundary is repeated.",
    description: "Use each boundary curve once."
  },
  SKETCH_REGION_LOOP_AREA_TOO_SMALL: {
    title: "Region is too small.",
    description: "Increase the region size."
  },
  SKETCH_REGION_SOURCE_REVISION_STALE: {
    title: "Region selection is out of date.",
    description: "Discover and select the regions again."
  },
  SKETCH_REGION_CURSOR_INVALID: {
    title: "Region results changed.",
    description: "Restart region discovery."
  },
  SKETCH_REGION_CONSUMER_UNSUPPORTED: {
    title: "This feature cannot use the selected regions.",
    description: "Choose a compatible operation or region selection."
  },
  SKETCH_REGION_RESULT_NOT_SINGLE_SOLID: {
    title: "The result would not be one solid.",
    description: "Adjust the regions or choose a new-body operation."
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
  const copy =
    COPY_BY_CODE[code] ??
    getPatternCopy(code) ??
    getSafeUncodedCopy(diagnostic, code);
  return {
    ...(copy ?? {
      title: "Operation could not be completed.",
      description: "Partbench could not complete this action.",
      recovery: "Review the current selection and values, then try again."
    }),
    tone: normalizeTone(diagnostic.severity)
  };
}

function getSafeUncodedCopy(
  diagnostic: StructuredDiagnosticInput,
  code: string
): DiagnosticCopy | undefined {
  const message = diagnostic.message?.trim();
  return !code && message && !containsInternalText(message)
    ? {
        title: "Operation could not be completed.",
        description: message
      }
    : undefined;
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
