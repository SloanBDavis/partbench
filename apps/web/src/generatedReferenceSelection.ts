import type {
  BodyGeneratedReferencesQueryResponse,
  CadGeneratedEntityKind,
  CadGeneratedReference,
  CadSelectionReferenceCandidate,
  CadSelectionReferenceIssue,
  CadSelectionReferenceOperation,
  CadSelectionReferenceStatus,
  DocumentUnits,
  SelectionReferenceCandidatesQueryResponse
} from "@web-cad/cad-protocol";
import {
  createGeneratedReferenceMeasurementRows,
  formatGeneratedReferenceKind,
  getGeneratedReferenceItems,
  type GeneratedReferenceMeasurementDisplay,
  type GeneratedReferenceMeasurementRow
} from "./generatedReferenceUi";

export interface SelectedGeneratedReference {
  readonly bodyId: string;
  readonly stableId: string;
  readonly kind: CadGeneratedEntityKind;
}

export type GeneratedReferenceSelectionState =
  | { readonly status: "none" }
  | {
      readonly status: "selected";
      readonly selection: SelectedGeneratedReference;
      readonly reference: CadGeneratedReference;
      readonly measurement?: GeneratedReferenceMeasurementDisplay;
      readonly measurementRows: readonly GeneratedReferenceMeasurementRow[];
    }
  | {
      readonly status: "stale";
      readonly selection: SelectedGeneratedReference;
      readonly message: string;
    };

export interface SelectionReferenceCandidateSummary {
  readonly tone: "ready" | "warning" | "blocked";
  readonly title: string;
  readonly detail: string;
  readonly topologyDetail?: string;
  readonly stableId?: string;
  readonly commandOperations: readonly CadSelectionReferenceOperation[];
  readonly issues: readonly string[];
}

export interface SelectionReferenceOperationStatus {
  readonly available: boolean;
  readonly message?: string;
}

export function createSelectedGeneratedReference(
  reference: CadGeneratedReference
): SelectedGeneratedReference {
  return {
    bodyId: reference.bodyId,
    stableId: reference.stableId,
    kind: reference.kind
  };
}

export function reconcileSelectedGeneratedReferenceBody(
  selection: SelectedGeneratedReference | undefined,
  bodies: readonly { readonly id: string }[]
): SelectedGeneratedReference | undefined {
  if (!selection) {
    return undefined;
  }

  return bodies.some((body) => body.id === selection.bodyId)
    ? selection
    : undefined;
}

export function getGeneratedReferenceSelectionState(
  selection: SelectedGeneratedReference | undefined,
  references: BodyGeneratedReferencesQueryResponse | undefined,
  measurements:
    | ReadonlyMap<string, GeneratedReferenceMeasurementDisplay>
    | undefined,
  units: DocumentUnits
): GeneratedReferenceSelectionState {
  if (!selection) {
    return { status: "none" };
  }

  if (!references) {
    return {
      status: "stale",
      selection,
      message:
        "Selected reference is stale because generated references are unavailable."
    };
  }

  if (references.body.bodyId !== selection.bodyId) {
    return {
      status: "stale",
      selection,
      message: `Selected reference belongs to ${selection.bodyId}.`
    };
  }

  const reference = getGeneratedReferenceItems(references).find(
    (candidate) =>
      candidate.stableId === selection.stableId &&
      candidate.kind === selection.kind
  );

  if (!reference) {
    return {
      status: "stale",
      selection,
      message: `Selected ${selection.kind} reference ${selection.stableId} is no longer available on ${selection.bodyId}.`
    };
  }

  const measurement = measurements?.get(reference.stableId);

  return {
    status: "selected",
    selection,
    reference,
    measurement,
    measurementRows: measurement?.measurement
      ? createGeneratedReferenceMeasurementRows(measurement.measurement, units)
      : []
  };
}

export function isSelectedGeneratedReference(
  selection: SelectedGeneratedReference | undefined,
  reference: CadGeneratedReference
): boolean {
  return (
    selection?.bodyId === reference.bodyId &&
    selection.stableId === reference.stableId &&
    selection.kind === reference.kind
  );
}

export function getPrimarySelectionReferenceCandidate(
  response: SelectionReferenceCandidatesQueryResponse
): CadSelectionReferenceCandidate | undefined {
  return (
    response.candidates.find((candidate) => candidate.commandable) ??
    response.candidates[0]
  );
}

export function getSelectionReferenceCandidateForOperation(
  response: SelectionReferenceCandidatesQueryResponse | undefined,
  operation: CadSelectionReferenceOperation
): CadSelectionReferenceCandidate | undefined {
  if (!response) {
    return undefined;
  }

  return (
    response.candidates.find(
      (candidate) =>
        candidate.commandable && candidate.commandOperations.includes(operation)
    ) ?? getPrimarySelectionReferenceCandidate(response)
  );
}

export function getSelectionReferenceOperationStatus(
  response: SelectionReferenceCandidatesQueryResponse | undefined,
  operation: CadSelectionReferenceOperation
): SelectionReferenceOperationStatus {
  if (!response) {
    return {
      available: false,
      message: `${formatSelectionReferenceOperationLabel(operation)} requires a command-ready reference query.`
    };
  }

  const candidate = getSelectionReferenceCandidateForOperation(
    response,
    operation
  );

  if (
    candidate?.commandable &&
    candidate.commandOperations.includes(operation)
  ) {
    return { available: true };
  }

  const issue =
    candidate?.issues[0] ??
    response.issues[0] ??
    (candidate && !candidate.commandable ? candidate.issues[0] : undefined);

  if (issue) {
    return {
      available: false,
      message: formatSelectionReferenceIssue(issue)
    };
  }

  if (response.status !== "resolved") {
    return {
      available: false,
      message: formatSelectionReferenceStatus(response.status)
    };
  }

  return {
    available: false,
    message: `${formatSelectionReferenceOperationLabel(operation)} is not command-ready for this selection.`
  };
}

export function formatSelectionReferenceOperationLabel(
  operation: CadSelectionReferenceOperation
): string {
  switch (operation) {
    case "reference.nameGenerated":
      return "Name reference";
    case "feature.attachSketchPlane":
      return "Create sketch on face";
    case "feature.chamfer":
      return "Chamfer";
    case "feature.fillet":
      return "Fillet";
    case "feature.measureReference":
      return "Measure reference";
    case "feature.selectReference":
      return "Inspect reference";
  }
}

export function createSelectionReferenceCandidateSummaries(
  response: SelectionReferenceCandidatesQueryResponse
): readonly SelectionReferenceCandidateSummary[] {
  if (response.candidates.length === 0) {
    return [
      {
        tone: "blocked",
        title: formatSelectionReferenceStatus(response.status),
        detail: response.issues.map(formatSelectionReferenceIssue).join(" "),
        topologyDetail: undefined,
        commandOperations: [],
        issues: response.issues.map(formatSelectionReferenceIssue)
      }
    ];
  }

  return response.candidates.map(createSelectionReferenceCandidateSummary);
}

export function createSelectionReferenceCandidateSummary(
  candidate: CadSelectionReferenceCandidate
): SelectionReferenceCandidateSummary {
  const issueMessages = candidate.issues.map(formatSelectionReferenceIssue);

  return {
    tone: candidate.commandable
      ? "ready"
      : candidate.issues.some((issue) => issue.status === "consumed")
        ? "warning"
        : "blocked",
    title: `${formatGeneratedReferenceKind(candidate.reference.kind)}: ${candidate.label}`,
    detail:
      issueMessages[0] ??
      `${candidate.commandOperations.length} command-ready operation${candidate.commandOperations.length === 1 ? "" : "s"}`,
    topologyDetail: createSelectionReferenceTopologyDetail(candidate),
    stableId: candidate.target.stableId,
    commandOperations: candidate.commandOperations,
    issues: issueMessages
  };
}

export function createSelectionReferenceTopologyDetail(
  candidate: CadSelectionReferenceCandidate
): string | undefined {
  const usesTopologyAnchor =
    candidate.source === "topologyAnchorSelection" ||
    candidate.target.topologyAnchorId !== undefined;

  if (!usesTopologyAnchor) {
    return undefined;
  }

  if (candidate.target.checkpointId) {
    return "Topology anchor-backed target with checkpoint evidence.";
  }

  return "Topology anchor-backed target.";
}

export function formatSelectionReferenceStatus(
  status: CadSelectionReferenceStatus
): string {
  switch (status) {
    case "resolved":
      return "Command-ready reference";
    case "missing":
      return "Selection target missing";
    case "stale":
      return "Selection target stale";
    case "unsupported":
      return "Selection target unsupported";
    case "ambiguous":
      return "Selection topology ambiguous";
    case "consumed":
      return "Selection body consumed";
    case "non-commandable":
      return "Selection is not commandable";
  }
}

export function formatSelectionReferenceIssue(
  issue: CadSelectionReferenceIssue
): string {
  switch (issue.code) {
    case "MISSING_SELECTION_TARGET":
      return issue.message;
    case "STALE_SELECTION_REFERENCE":
      return issue.message;
    case "UNSUPPORTED_SELECTION_TARGET":
      return issue.message;
    case "AMBIGUOUS_SELECTION_TOPOLOGY":
      return issue.message;
    case "CONSUMED_SELECTION_BODY":
      return issue.message;
    case "NON_COMMANDABLE_SELECTION_TARGET":
      return issue.message;
    case "SELECTION_KIND_MISMATCH":
      return issue.message;
  }
}
