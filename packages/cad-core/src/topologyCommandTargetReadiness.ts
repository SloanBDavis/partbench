import type {
  CadOpsVersion,
  CadSelectionReferenceCandidate,
  CadSelectionReferenceIssue,
  CadSelectionReferenceOperation,
  CadSelectionReferenceStatus,
  CadTopologyCommandTargetOperationSummary,
  CadTopologyCommandTargetReadinessStatus,
  CadTopologyIdentityDiagnostic,
  TopologyAnchorCommandReadinessQueryResponse,
  TopologyCommandTargetReadinessQuery,
  TopologyCommandTargetReadinessQueryResponse
} from "@web-cad/cad-protocol";

const SOURCE_BOUNDARY_NOTE =
  "Topology-backed command target readiness is derived from authoritative document source, topology anchors/checkpoints, selection reference candidates, and reference-health state; this query does not mutate source or mint topology records.";
const DERIVED_BOUNDARY_NOTE =
  "Geometry-worker/OCCT/checkpoint evidence may be summarized through public topology abstractions only; raw OCCT handles, checkpoint-scoped topology ids, renderer ids, mesh ids, GPU ids, selection-buffer ids, viewport pixels, OPFS paths, file handles, local paths, and export artifacts are not public command targets.";

type SelectionResult = {
  readonly status: CadSelectionReferenceStatus;
  readonly candidates: readonly CadSelectionReferenceCandidate[];
  readonly issues: readonly CadSelectionReferenceIssue[];
};

export function createTopologyCommandTargetReadinessResponse(args: {
  readonly cadOpsVersion: CadOpsVersion;
  readonly query: TopologyCommandTargetReadinessQuery;
  readonly selectionResult: SelectionResult;
  readonly anchorReadiness?: TopologyAnchorCommandReadinessQueryResponse;
}): TopologyCommandTargetReadinessQueryResponse {
  const supportedOperations = createSupportedOperations(
    args.selectionResult,
    args.anchorReadiness
  );
  const commandable = isCommandable(
    args.query.desiredOperation,
    supportedOperations,
    args.selectionResult,
    args.anchorReadiness
  );
  const status = chooseReadinessStatus({
    query: args.query,
    selectionResult: args.selectionResult,
    anchorReadiness: args.anchorReadiness,
    commandable
  });
  const operationSummaries = createOperationSummaries({
    status,
    query: args.query,
    selectionResult: args.selectionResult,
    anchorReadiness: args.anchorReadiness,
    supportedOperations
  });
  const diagnostics = createDiagnostics({
    status,
    query: args.query,
    selectionResult: args.selectionResult,
    anchorReadiness: args.anchorReadiness
  });

  return {
    ok: true,
    query: "topology.commandTargetReadiness",
    cadOpsVersion: args.cadOpsVersion,
    target: args.query.target,
    ...(args.query.desiredOperation
      ? { desiredOperation: args.query.desiredOperation }
      : {}),
    status,
    selectionStatus: args.selectionResult.status,
    commandable,
    promotionRequired: status === "needs-promotion",
    checkpointEvidenceRequired: status === "needs-checkpoint-evidence",
    repairRequired: status === "needs-repair",
    supportedOperationCount: supportedOperations.length,
    supportedOperations,
    operationSummaryCount: operationSummaries.length,
    operationSummaries,
    candidateCount: args.selectionResult.candidates.length,
    candidates: args.selectionResult.candidates,
    issueCount: args.selectionResult.issues.length,
    issues: args.selectionResult.issues,
    ...(args.anchorReadiness ? { anchorReadiness: args.anchorReadiness } : {}),
    ...(args.anchorReadiness?.proof
      ? { proof: args.anchorReadiness.proof }
      : {}),
    diagnosticCount: diagnostics.length,
    diagnostics,
    sourceBoundaryNote: SOURCE_BOUNDARY_NOTE,
    derivedBoundaryNote: DERIVED_BOUNDARY_NOTE,
    mutatesSource: false,
    exposesCheckpointLocalIds: false,
    exposesPrivateIds: false,
    requiresProjectSchemaMigration: false,
    requiresPackageVersionMigration: false
  };
}

function createSupportedOperations(
  selectionResult: SelectionResult,
  anchorReadiness: TopologyAnchorCommandReadinessQueryResponse | undefined
): readonly CadSelectionReferenceOperation[] {
  return [
    ...new Set([
      ...selectionResult.candidates.flatMap(
        (candidate) => candidate.commandOperations
      ),
      ...(anchorReadiness?.commandOperations ?? [])
    ])
  ];
}

function isCommandable(
  desiredOperation: CadSelectionReferenceOperation | undefined,
  supportedOperations: readonly CadSelectionReferenceOperation[],
  selectionResult: SelectionResult,
  anchorReadiness: TopologyAnchorCommandReadinessQueryResponse | undefined
): boolean {
  const targetResolved =
    selectionResult.status === "resolved" &&
    selectionResult.candidates.some((candidate) => candidate.commandable);
  const anchorResolved =
    anchorReadiness?.status === "ready" && anchorReadiness.commandable;

  if (!targetResolved && !anchorResolved) {
    return false;
  }

  return desiredOperation
    ? supportedOperations.includes(desiredOperation)
    : supportedOperations.length > 0;
}

function chooseReadinessStatus(input: {
  readonly query: TopologyCommandTargetReadinessQuery;
  readonly selectionResult: SelectionResult;
  readonly anchorReadiness?: TopologyAnchorCommandReadinessQueryResponse;
  readonly commandable: boolean;
}): CadTopologyCommandTargetReadinessStatus {
  if (input.commandable) {
    return "ready";
  }

  if (input.anchorReadiness) {
    return statusFromAnchorReadiness(input.anchorReadiness.status);
  }

  if (input.selectionResult.issues.some(issueRequiresRepair)) {
    return "needs-repair";
  }

  if (
    input.query.target.type === "topologyAnchor" &&
    input.query.snapshot === undefined &&
    input.selectionResult.status !== "missing" &&
    input.selectionResult.status !== "stale"
  ) {
    return "needs-checkpoint-evidence";
  }

  if (
    input.query.target.type === "body" &&
    isBooleanBodyTargetOperation(input.query.desiredOperation) &&
    input.selectionResult.status === "non-commandable"
  ) {
    return "needs-promotion";
  }

  if (
    input.selectionResult.issues.some(
      (issue) => issue.code === "AMBIGUOUS_SELECTION_TOPOLOGY"
    )
  ) {
    return "needs-promotion";
  }

  return statusFromSelectionStatus(input.selectionResult.status);
}

function statusFromAnchorReadiness(
  status: TopologyAnchorCommandReadinessQueryResponse["status"]
): CadTopologyCommandTargetReadinessStatus {
  if (status === "ready") {
    return "ready";
  }

  if (status === "missing") {
    return "missing";
  }

  if (status === "stale") {
    return "stale";
  }

  if (status === "non-commandable" || status === "partial") {
    return "non-commandable";
  }

  return "unsupported";
}

function statusFromSelectionStatus(
  status: CadSelectionReferenceStatus
): CadTopologyCommandTargetReadinessStatus {
  if (status === "resolved") {
    return "blocked";
  }

  return status;
}

function isBooleanBodyTargetOperation(
  operation: CadSelectionReferenceOperation | undefined
): boolean {
  return (
    operation === "feature.extrudeCutTarget" ||
    operation === "feature.extrudeAddTarget" ||
    operation === "feature.holeTarget"
  );
}

function issueRequiresRepair(issue: CadSelectionReferenceIssue): boolean {
  return (
    issue.status === "stale" ||
    issue.received === "repair-needed" ||
    issue.received === "replaced" ||
    issue.received === "deleted" ||
    issue.message.toLowerCase().includes("repair")
  );
}

function createOperationSummaries(input: {
  readonly status: CadTopologyCommandTargetReadinessStatus;
  readonly query: TopologyCommandTargetReadinessQuery;
  readonly selectionResult: SelectionResult;
  readonly anchorReadiness?: TopologyAnchorCommandReadinessQueryResponse;
  readonly supportedOperations: readonly CadSelectionReferenceOperation[];
}): readonly CadTopologyCommandTargetOperationSummary[] {
  const operations = [
    ...new Set([
      ...input.supportedOperations,
      ...(input.query.desiredOperation ? [input.query.desiredOperation] : [])
    ])
  ];

  return operations.map((operation) => {
    const selectionCandidate = input.selectionResult.candidates.find(
      (candidate) => candidate.commandOperations.includes(operation)
    );
    const source =
      input.anchorReadiness?.commandOperations.includes(operation) &&
      !selectionCandidate
        ? "topology.anchorCommandReadiness"
        : "selection.referenceCandidates";
    const commandable = input.supportedOperations.includes(operation);
    const status = commandable ? "ready" : input.status;

    return {
      operation,
      status,
      commandable,
      source,
      ...(selectionCandidate ? { target: selectionCandidate.target } : {}),
      requiresPromotion: status === "needs-promotion",
      requiresCheckpointEvidence: status === "needs-checkpoint-evidence",
      requiresRepair: status === "needs-repair"
    };
  });
}

function createDiagnostics(input: {
  readonly status: CadTopologyCommandTargetReadinessStatus;
  readonly query: TopologyCommandTargetReadinessQuery;
  readonly selectionResult: SelectionResult;
  readonly anchorReadiness?: TopologyAnchorCommandReadinessQueryResponse;
}): readonly CadTopologyIdentityDiagnostic[] {
  if (input.anchorReadiness) {
    return input.anchorReadiness.diagnostics;
  }

  if (input.status === "ready") {
    return [
      createDiagnostic({
        code: "TOPOLOGY_COMMAND_ELIGIBILITY_READY",
        status: "supported",
        severity: "info",
        message: "Selected target has command-ready semantic operations.",
        expected: input.query.desiredOperation ?? "supported modeling command",
        received: input.query.desiredOperation ?? "supported operation"
      })
    ];
  }

  if (input.selectionResult.issues.length === 0) {
    return [
      createDiagnostic({
        code: "TOPOLOGY_COMMAND_NOT_ELIGIBLE",
        status: "deferred",
        severity: "warning",
        message:
          "Selected target is not command-ready for the requested operation.",
        expected: input.query.desiredOperation ?? "supported modeling command",
        received: input.status
      })
    ];
  }

  return input.selectionResult.issues.map((issue) =>
    createDiagnostic({
      code: diagnosticCodeFromIssue(input.status, issue),
      status: diagnosticReadinessStatus(input.status, issue),
      severity: diagnosticSeverity(input.status, issue),
      message: issue.message,
      bodyId: issue.bodyId,
      featureId: issue.featureId,
      checkpointId: issue.checkpointId,
      anchorId: issue.topologyAnchorId,
      expected: issue.expected ?? input.query.desiredOperation,
      received: issue.received ?? issue.status
    })
  );
}

function diagnosticCodeFromIssue(
  status: CadTopologyCommandTargetReadinessStatus,
  issue: CadSelectionReferenceIssue
): CadTopologyIdentityDiagnostic["code"] {
  if (status === "needs-promotion") {
    return "TOPOLOGY_ANCHOR_PERSISTENCE_DEFERRED";
  }

  if (status === "needs-repair") {
    return "TOPOLOGY_COMMAND_ELIGIBILITY_DEFERRED";
  }

  if (status === "ambiguous" || issue.status === "ambiguous") {
    return "TOPOLOGY_MATCH_AMBIGUOUS";
  }

  if (status === "missing" || issue.status === "missing") {
    return "TOPOLOGY_ENTITY_MISSING";
  }

  return "TOPOLOGY_COMMAND_NOT_ELIGIBLE";
}

function diagnosticReadinessStatus(
  status: CadTopologyCommandTargetReadinessStatus,
  issue: CadSelectionReferenceIssue
): CadTopologyIdentityDiagnostic["status"] {
  if (status === "missing" || issue.status === "missing") {
    return "unavailable";
  }

  return "deferred";
}

function diagnosticSeverity(
  status: CadTopologyCommandTargetReadinessStatus,
  issue: CadSelectionReferenceIssue
): CadTopologyIdentityDiagnostic["severity"] {
  if (status === "missing" || issue.status === "missing") {
    return "error";
  }

  return "warning";
}

function createDiagnostic(
  diagnostic: CadTopologyIdentityDiagnostic
): CadTopologyIdentityDiagnostic {
  return diagnostic;
}
