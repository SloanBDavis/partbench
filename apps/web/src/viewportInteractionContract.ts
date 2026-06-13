import type {
  CadSelectionReferenceInput,
  CadSelectionReferenceIssue,
  CadSelectionReferenceOperation,
  CadSelectionReferenceStatus,
  CadViewportCommandTargetSummary,
  CadViewportHitCandidate,
  CadViewportInteractionDiagnostic,
  CadViewportInteractionDiagnosticCode,
  CadViewportInteractionStatus,
  SelectionReferenceCandidatesQuery,
  SelectionReferenceCandidatesQueryResponse
} from "@web-cad/cad-protocol";

export interface ViewportSemanticSelectionResolution {
  readonly status: CadViewportInteractionStatus;
  readonly selection?: CadSelectionReferenceInput;
  readonly query?: SelectionReferenceCandidatesQuery;
  readonly diagnostics: readonly CadViewportInteractionDiagnostic[];
}

export interface ResolveViewportHitCandidateInput {
  readonly hitCandidate?: CadViewportHitCandidate;
  readonly requiredOperation?: CadSelectionReferenceOperation;
}

export function resolveViewportHitCandidateSelection({
  hitCandidate,
  requiredOperation
}: ResolveViewportHitCandidateInput): ViewportSemanticSelectionResolution {
  if (!hitCandidate) {
    return createResolution("missing", [
      createViewportInteractionDiagnostic(
        "VIEWPORT_MISSING_HIT_TARGET",
        "missing",
        "Viewport input did not include a hit target.",
        { expected: "semantic body, generated reference, or named reference" }
      )
    ]);
  }

  if (
    (hitCandidate.instancePath && hitCandidate.instancePath.length > 0) ||
    (hitCandidate.assemblyPath && hitCandidate.assemblyPath.length > 0)
  ) {
    return createResolution("assembly-unsupported", [
      createViewportInteractionDiagnostic(
        "VIEWPORT_ASSEMBLY_INSTANCE_UNSUPPORTED",
        "assembly-unsupported",
        "Viewport hit includes assembly instance context, which is reserved for a future release.",
        { expected: "single-part semantic selection" }
      )
    ]);
  }

  if (hitCandidate.displayEntityKind === "sketchEntity") {
    return createResolution("unsupported", [
      createViewportInteractionDiagnostic(
        "VIEWPORT_UNSUPPORTED_DISPLAY_ENTITY",
        "unsupported",
        "Viewport sketch display entities are not command-ready CAD references in V9 Tranche A.",
        {
          expected:
            "body, generated face, generated edge, generated vertex, or named reference",
          received: "sketchEntity"
        }
      )
    ]);
  }

  if (!hitCandidate.semanticHint) {
    return createResolution("renderer-only", [
      createViewportInteractionDiagnostic(
        "VIEWPORT_RENDERER_ONLY_TARGET",
        "renderer-only",
        "Viewport hit target is renderer-private and has no semantic CAD selection hint.",
        { expected: "semantic selection hint" }
      )
    ]);
  }

  const compatibilityDiagnostics =
    createSemanticHintCompatibilityDiagnostics(hitCandidate);

  if (compatibilityDiagnostics.length > 0) {
    return createResolution(
      compatibilityDiagnostics[0]?.status ?? "unsupported",
      compatibilityDiagnostics
    );
  }

  const selection = createSemanticSelectionInput(hitCandidate.semanticHint);
  const query: SelectionReferenceCandidatesQuery = {
    query: "selection.referenceCandidates",
    selection,
    ...(requiredOperation ? { requiredOperation } : {})
  };

  return {
    status: "resolved",
    selection,
    query,
    diagnostics: []
  };
}

export function createViewportCommandTargetSummary(
  response: SelectionReferenceCandidatesQueryResponse
): CadViewportCommandTargetSummary {
  const primaryCandidate =
    response.candidates.find((candidate) => candidate.commandable) ??
    response.candidates[0];

  return {
    selection: response.selection,
    status: response.status,
    commandable: primaryCandidate?.commandable ?? false,
    ...(primaryCandidate?.target ? { target: primaryCandidate.target } : {}),
    ...(primaryCandidate?.label ? { label: primaryCandidate.label } : {}),
    commandOperations: primaryCandidate?.commandOperations ?? [],
    diagnostics: createViewportInteractionDiagnosticsFromCandidates(response)
  };
}

export function createViewportInteractionDiagnosticsFromCandidates(
  response: SelectionReferenceCandidatesQueryResponse
): readonly CadViewportInteractionDiagnostic[] {
  const diagnostics = response.issues.map((issue) =>
    createViewportDiagnosticFromSelectionIssue(issue)
  );

  if (diagnostics.length > 0 || response.status === "resolved") {
    return diagnostics;
  }

  return [
    createViewportInteractionDiagnostic(
      codeFromSelectionStatus(response.status),
      statusFromSelectionStatus(response.status),
      `Viewport target resolved to a ${response.status} CAD selection state.`
    )
  ];
}

function createSemanticHintCompatibilityDiagnostics(
  hitCandidate: CadViewportHitCandidate
): readonly CadViewportInteractionDiagnostic[] {
  const { semanticHint } = hitCandidate;

  if (!semanticHint) {
    return [];
  }

  if (
    semanticHint.type === "body" &&
    hitCandidate.displayEntityKind !== "body"
  ) {
    return [
      createViewportInteractionDiagnostic(
        "VIEWPORT_AMBIGUOUS_HIT_CANDIDATE",
        "ambiguous",
        "Viewport hit target is not specific enough to map a non-body display entity to a body selection.",
        {
          expected: "body display entity",
          received: hitCandidate.displayEntityKind
        }
      )
    ];
  }

  if (
    semanticHint.type === "generatedReference" &&
    semanticHint.expectedKind &&
    semanticHint.expectedKind !== hitCandidate.displayEntityKind
  ) {
    return [
      createViewportInteractionDiagnostic(
        "VIEWPORT_UNSUPPORTED_DISPLAY_ENTITY",
        "unsupported",
        "Viewport hit display kind does not match the generated reference semantic hint.",
        {
          expected: semanticHint.expectedKind,
          received: hitCandidate.displayEntityKind
        }
      )
    ];
  }

  return [];
}

function createSemanticSelectionInput(
  selection: CadSelectionReferenceInput
): CadSelectionReferenceInput {
  switch (selection.type) {
    case "body":
      return { type: "body", bodyId: selection.bodyId };
    case "generatedReference":
      return {
        type: "generatedReference",
        bodyId: selection.bodyId,
        stableId: selection.stableId,
        ...(selection.expectedKind
          ? { expectedKind: selection.expectedKind }
          : {})
      };
    case "namedReference":
      return { type: "namedReference", name: selection.name };
  }
}

function createViewportDiagnosticFromSelectionIssue(
  issue: CadSelectionReferenceIssue
): CadViewportInteractionDiagnostic {
  return createViewportInteractionDiagnostic(
    codeFromSelectionIssue(issue),
    statusFromSelectionStatus(issue.status),
    issue.message,
    {
      ...(issue.expected ? { expected: issue.expected } : {}),
      ...(issue.received ? { received: issue.received } : {})
    }
  );
}

function codeFromSelectionIssue(
  issue: CadSelectionReferenceIssue
): CadViewportInteractionDiagnosticCode {
  switch (issue.code) {
    case "MISSING_SELECTION_TARGET":
      return "VIEWPORT_MISSING_HIT_TARGET";
    case "STALE_SELECTION_REFERENCE":
      return "VIEWPORT_STALE_SEMANTIC_HINT";
    case "AMBIGUOUS_SELECTION_TOPOLOGY":
      return "VIEWPORT_AMBIGUOUS_HIT_CANDIDATE";
    case "NON_COMMANDABLE_SELECTION_TARGET":
    case "CONSUMED_SELECTION_BODY":
      return "VIEWPORT_NON_COMMANDABLE_TARGET";
    case "SELECTION_KIND_MISMATCH":
    case "UNSUPPORTED_SELECTION_TARGET":
      return "VIEWPORT_UNSUPPORTED_DISPLAY_ENTITY";
  }
}

function codeFromSelectionStatus(
  status: Exclude<CadSelectionReferenceStatus, "resolved">
): CadViewportInteractionDiagnosticCode {
  switch (status) {
    case "missing":
      return "VIEWPORT_MISSING_HIT_TARGET";
    case "stale":
      return "VIEWPORT_STALE_SEMANTIC_HINT";
    case "ambiguous":
      return "VIEWPORT_AMBIGUOUS_HIT_CANDIDATE";
    case "consumed":
    case "non-commandable":
      return "VIEWPORT_NON_COMMANDABLE_TARGET";
    case "unsupported":
      return "VIEWPORT_UNSUPPORTED_DISPLAY_ENTITY";
  }
}

function statusFromSelectionStatus(
  status: Exclude<CadSelectionReferenceStatus, "resolved">
): CadViewportInteractionDiagnostic["status"] {
  switch (status) {
    case "missing":
      return "missing";
    case "stale":
      return "stale";
    case "ambiguous":
      return "ambiguous";
    case "consumed":
    case "non-commandable":
      return "non-commandable";
    case "unsupported":
      return "unsupported";
  }
}

function createResolution(
  status: ViewportSemanticSelectionResolution["status"],
  diagnostics: readonly CadViewportInteractionDiagnostic[]
): ViewportSemanticSelectionResolution {
  return {
    status,
    diagnostics
  };
}

function createViewportInteractionDiagnostic(
  code: CadViewportInteractionDiagnosticCode,
  status: CadViewportInteractionDiagnostic["status"],
  message: string,
  details: {
    readonly expected?: string;
    readonly received?: string;
  } = {}
): CadViewportInteractionDiagnostic {
  return {
    code,
    status,
    message,
    ...(details.expected ? { expected: details.expected } : {}),
    ...(details.received ? { received: details.received } : {})
  };
}
