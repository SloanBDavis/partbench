import type {
  CadBatchResponse,
  CadBatchValidationError,
  CadReferenceHealthEntry,
  CadReferenceHealthStatus,
  NamedGeneratedReferenceEntry,
  ReferenceHealthQueryResponse,
  SelectionReferenceCandidatesQueryResponse
} from "@web-cad/cad-protocol";
import { formatGeneratedReferenceKind } from "./generatedReferenceUi";
import type { SelectedGeneratedReference } from "./generatedReferenceSelection";

export type NamedReferenceRepairUiState =
  | { readonly status: "none" }
  | {
      readonly status: "blocked";
      readonly reference: NamedGeneratedReferenceEntry;
      readonly healthStatus: CadReferenceHealthStatus;
      readonly message: string;
      readonly diagnostics: readonly NamedReferenceRepairDiagnostic[];
    }
  | {
      readonly status: "ready";
      readonly reference: NamedGeneratedReferenceEntry;
      readonly target: SelectedGeneratedReference;
      readonly healthStatus: CadReferenceHealthStatus;
      readonly message: string;
      readonly diagnostics: readonly NamedReferenceRepairDiagnostic[];
    };

export interface NamedReferenceRepairDiagnostic {
  readonly code?: string;
  readonly status?: CadReferenceHealthStatus;
  readonly message: string;
  readonly source: "reference.health" | "selection.referenceCandidates";
}

export function createNamedReferenceHealthByName(
  health: ReferenceHealthQueryResponse | undefined
): ReadonlyMap<string, CadReferenceHealthEntry> {
  const healthByName = new Map<string, CadReferenceHealthEntry>();

  for (const entry of health?.referenceHealth ?? []) {
    if (entry.source === "namedReference" && entry.referenceName) {
      healthByName.set(entry.referenceName, entry);
    }
  }

  return healthByName;
}

export function createNamedReferenceRepairUiState(input: {
  readonly namedReferences: readonly NamedGeneratedReferenceEntry[];
  readonly namedReferenceHealthByName?: ReadonlyMap<
    string,
    CadReferenceHealthEntry
  >;
  readonly selectedNamedReferenceName?: string;
  readonly selectedGeneratedReference?: SelectedGeneratedReference;
  readonly selectionReferenceCandidates?: SelectionReferenceCandidatesQueryResponse;
}): NamedReferenceRepairUiState {
  if (!input.selectedNamedReferenceName) {
    return { status: "none" };
  }

  const reference = input.namedReferences.find(
    (candidate) => candidate.name === input.selectedNamedReferenceName
  );

  if (!reference || reference.status !== "stale") {
    const healthEntry = reference
      ? input.namedReferenceHealthByName?.get(reference.name)
      : undefined;

    if (!reference || !isRepairableNamedReferenceHealth(healthEntry?.status)) {
      return { status: "none" };
    }
  }

  const healthEntry = input.namedReferenceHealthByName?.get(reference.name);
  const healthStatus = healthEntry?.status ?? "stale";

  if (!isRepairableNamedReferenceHealth(healthStatus)) {
    return { status: "none" };
  }

  const diagnostics = createHealthDiagnostics(healthEntry);

  if (!input.selectedGeneratedReference) {
    return {
      status: "blocked",
      reference,
      healthStatus,
      message: `Select a replacement ${formatGeneratedReferenceKind(reference.kind).toLowerCase()} reference.`,
      diagnostics
    };
  }

  if (input.selectedGeneratedReference.kind !== reference.kind) {
    return {
      status: "blocked",
      reference,
      healthStatus,
      message: `Selected reference is a ${formatGeneratedReferenceKind(input.selectedGeneratedReference.kind).toLowerCase()}, not a ${formatGeneratedReferenceKind(reference.kind).toLowerCase()}.`,
      diagnostics
    };
  }

  const target = getQueryProvenRepairTarget(
    input.selectedGeneratedReference,
    input.selectionReferenceCandidates,
    diagnostics
  );

  if (target.status === "blocked") {
    return {
      status: "blocked",
      reference,
      healthStatus,
      message: target.message,
      diagnostics: target.diagnostics
    };
  }

  return {
    status: "ready",
    reference,
    target: target.target,
    healthStatus,
    message: `Repair ${reference.name} to the selected ${formatGeneratedReferenceKind(reference.kind).toLowerCase()}.`,
    diagnostics
  };
}

export function formatNamedReferenceRepairHealthStatus(
  status: CadReferenceHealthStatus
): string {
  switch (status) {
    case "active":
      return "Active";
    case "replaced":
      return "Replaced";
    case "stale":
      return "Stale";
    case "consumed":
      return "Consumed";
    case "ambiguous":
      return "Ambiguous";
    case "missing":
      return "Missing";
    case "unsupported":
      return "Unsupported";
    case "repair-needed":
      return "Repair needed";
    case "deleted":
      return "Deleted";
  }
}

export function formatNamedReferenceRepairBatchMessage(
  response: CadBatchResponse,
  referenceName: string
): string {
  if (response.ok) {
    return response.mode === "dryRun"
      ? `Repair dry-run passed for ${referenceName}.`
      : `Repaired named reference ${referenceName}.`;
  }

  return formatNamedReferenceRepairBatchError(response.error);
}

export function formatNamedReferenceRepairBatchError(
  error: CadBatchValidationError
): string {
  const details =
    error.expected || error.received
      ? ` Expected ${error.expected ?? "valid repair target"}; received ${
          error.received ?? "unknown"
        }.`
      : "";

  return `${error.code}: ${error.message}${details}`;
}

export function isRepairableNamedReferenceHealth(
  status: CadReferenceHealthStatus | undefined
): boolean {
  return (
    status === "stale" || status === "missing" || status === "repair-needed"
  );
}

function getQueryProvenRepairTarget(
  selected: SelectedGeneratedReference,
  response: SelectionReferenceCandidatesQueryResponse | undefined,
  diagnostics: readonly NamedReferenceRepairDiagnostic[]
):
  | {
      readonly status: "ready";
      readonly target: SelectedGeneratedReference;
    }
  | {
      readonly status: "blocked";
      readonly message: string;
      readonly diagnostics: readonly NamedReferenceRepairDiagnostic[];
    } {
  if (!response) {
    return {
      status: "blocked",
      message:
        "Selected reference has not been checked by selection.referenceCandidates.",
      diagnostics: [
        ...diagnostics,
        {
          source: "selection.referenceCandidates",
          message:
            "Repair targets must be proven command-ready by the shared reference query."
        }
      ]
    };
  }

  const candidate = response.candidates.find(
    (entry) =>
      entry.commandable &&
      entry.commandOperations.includes("feature.selectReference") &&
      entry.target.type === "generatedReference" &&
      entry.target.bodyId === selected.bodyId &&
      entry.target.stableId === selected.stableId &&
      entry.target.kind === selected.kind
  );

  if (candidate) {
    return {
      status: "ready",
      target: {
        bodyId: candidate.target.bodyId,
        stableId: candidate.target.stableId,
        kind: candidate.target.kind
      }
    };
  }

  const issue = response.candidates.flatMap((entry) => entry.issues)[0];
  const message =
    issue?.message ??
    response.issues[0]?.message ??
    (response.status === "resolved"
      ? "Selected reference is not command-ready for repair."
      : `Selected reference is ${response.status}.`);

  return {
    status: "blocked",
    message,
    diagnostics: [
      ...diagnostics,
      ...(issue
        ? [
            {
              code: issue.code,
              source: "selection.referenceCandidates" as const,
              message: issue.message
            }
          ]
        : response.issues.map((entry) => ({
            code: entry.code,
            source: "selection.referenceCandidates" as const,
            message: entry.message
          })))
    ]
  };
}

function createHealthDiagnostics(
  entry: CadReferenceHealthEntry | undefined
): readonly NamedReferenceRepairDiagnostic[] {
  return (entry?.diagnostics ?? []).map((diagnostic) => ({
    code: diagnostic.code,
    status: diagnostic.status,
    message: diagnostic.message,
    source: "reference.health" as const
  }));
}
