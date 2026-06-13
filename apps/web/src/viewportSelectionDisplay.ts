import type { CadBodySnapshot, SceneObject } from "@web-cad/cad-core";
import type {
  CadSelectionReferenceIssue,
  CadSelectionReferenceOperation,
  CadSelectionReferenceStatus,
  SelectionReferenceCandidatesQueryResponse
} from "@web-cad/cad-protocol";
import {
  getDerivedGeometryStatusLabel,
  type DerivedGeometryEntry,
  type DerivedGeometryStatusKind
} from "./derivedGeometry";
import { formatGeneratedReferenceKind } from "./generatedReferenceUi";
import {
  createSelectionReferenceCandidateSummaries,
  formatSelectionReferenceOperationLabel,
  formatSelectionReferenceStatus,
  getPrimarySelectionReferenceCandidate,
  type GeneratedReferenceSelectionState
} from "./generatedReferenceSelection";
import { formatObjectKind, getObjectDisplayName } from "./sceneObjectDisplay";
import type { ViewportPickIntent } from "./viewportPickIntent";

export type ViewportSelectionKind =
  | "none"
  | "object"
  | "body"
  | "generatedReference";

export type ViewportSelectionTone = "idle" | "ready" | "warning" | "blocked";

export type ViewportGeometryDisplayStatus =
  | "none"
  | "fallback"
  | DerivedGeometryStatusKind;

export interface ViewportSelectionDiagnostic {
  readonly code: CadSelectionReferenceIssue["code"];
  readonly status: CadSelectionReferenceIssue["status"];
  readonly message: string;
}

export interface ViewportSelectionDisplay {
  readonly selectionKind: ViewportSelectionKind;
  readonly title: string;
  readonly detail: string;
  readonly tone: ViewportSelectionTone;
  readonly renderTargetId?: string;
  readonly geometryStatus: ViewportGeometryDisplayStatus;
  readonly geometryDetail?: string;
  readonly referenceStatus?: CadSelectionReferenceStatus;
  readonly referenceSummary?: string;
  readonly commandOperations: readonly CadSelectionReferenceOperation[];
  readonly commandOperationLabels: readonly string[];
  readonly diagnostics: readonly ViewportSelectionDiagnostic[];
}

export interface CreateViewportSelectionDisplayInput {
  readonly derivedGeometryEnabled: boolean;
  readonly selectedBody?: CadBodySnapshot;
  readonly selectedGeneratedReferenceState: GeneratedReferenceSelectionState;
  readonly selectedGeometryEntry?: DerivedGeometryEntry;
  readonly selectedObject?: SceneObject;
  readonly selectionReferenceCandidates?: SelectionReferenceCandidatesQueryResponse;
  readonly viewportPickIntent?: ViewportPickIntent;
}

interface ReferenceCandidateDisplay {
  readonly detail: string;
  readonly tone: ViewportSelectionTone;
  readonly referenceStatus: CadSelectionReferenceStatus;
  readonly referenceSummary?: string;
  readonly commandOperations: readonly CadSelectionReferenceOperation[];
  readonly commandOperationLabels: readonly string[];
  readonly diagnostics: readonly ViewportSelectionDiagnostic[];
}

export function createViewportSelectionDisplay({
  derivedGeometryEnabled,
  selectedBody,
  selectedGeneratedReferenceState,
  selectedGeometryEntry,
  selectedObject,
  selectionReferenceCandidates,
  viewportPickIntent
}: CreateViewportSelectionDisplayInput): ViewportSelectionDisplay {
  const geometry = createViewportGeometryDisplay(
    derivedGeometryEnabled,
    selectedGeometryEntry
  );

  if (selectedGeneratedReferenceState.status === "selected") {
    const candidateDisplay = selectionReferenceCandidates
      ? createReferenceCandidateDisplay(selectionReferenceCandidates)
      : undefined;

    return createDisplay({
      selectionKind: "generatedReference",
      title:
        candidateDisplay?.referenceSummary ??
        `${formatGeneratedReferenceKind(selectedGeneratedReferenceState.reference.kind)}: ${selectedGeneratedReferenceState.reference.label}`,
      detail: candidateDisplay?.detail ?? "Selected generated reference",
      tone: candidateDisplay?.tone ?? toneFromGeometryStatus(geometry.status),
      renderTargetId: selectedGeneratedReferenceState.reference.bodyId,
      geometry,
      candidateDisplay
    });
  }

  if (selectedGeneratedReferenceState.status === "stale") {
    return createDisplay({
      selectionKind: "generatedReference",
      title: "Selected reference stale",
      detail: selectedGeneratedReferenceState.message,
      tone: "blocked",
      renderTargetId: selectedGeneratedReferenceState.selection.bodyId,
      geometry,
      diagnostics: [
        {
          code: "STALE_SELECTION_REFERENCE",
          status: "stale",
          message: selectedGeneratedReferenceState.message
        }
      ]
    });
  }

  if (selectedBody) {
    const candidateDisplay = selectionReferenceCandidates
      ? createReferenceCandidateDisplay(selectionReferenceCandidates)
      : undefined;
    const consumedDiagnostics = selectedBody.consumedByFeatureId
      ? createConsumedBodyDiagnostics(
          selectedBody.id,
          selectedBody.consumedByFeatureId,
          candidateDisplay?.diagnostics ?? []
        )
      : [];

    return createDisplay({
      selectionKind: "body",
      title: selectedObject
        ? `${getObjectDisplayName(selectedObject)} (${formatObjectKind(selectedObject.kind)})`
        : `${selectedBody.name ?? selectedBody.id} (Body)`,
      detail:
        candidateDisplay?.detail ??
        consumedDiagnostics[0]?.message ??
        geometry.detail,
      tone:
        candidateDisplay?.tone ??
        (consumedDiagnostics.length > 0
          ? "warning"
          : toneFromGeometryStatus(geometry.status)),
      renderTargetId: selectedObject?.id ?? selectedBody.id,
      geometry,
      candidateDisplay,
      diagnostics: consumedDiagnostics
    });
  }

  if (selectedObject) {
    return createDisplay({
      selectionKind: "object",
      title: `${getObjectDisplayName(selectedObject)} (${formatObjectKind(selectedObject.kind)})`,
      detail: geometry.detail,
      tone: toneFromGeometryStatus(geometry.status),
      renderTargetId: selectedObject.id,
      geometry
    });
  }

  if (
    viewportPickIntent?.kind === "unsupported" ||
    viewportPickIntent?.kind === "renderer-only" ||
    viewportPickIntent?.kind === "ambiguous"
  ) {
    return createDisplay({
      selectionKind: "none",
      title: "Viewport pick unsupported",
      detail:
        viewportPickIntent.kind === "ambiguous"
          ? "Selection target ambiguous"
          : "Selection target unsupported",
      tone: "blocked",
      geometry,
      diagnostics: viewportPickIntent.issues
    });
  }

  if (viewportPickIntent?.kind === "missing") {
    return createDisplay({
      selectionKind: "none",
      title: "Viewport pick unavailable",
      detail: "Selection target missing",
      tone: "blocked",
      geometry,
      diagnostics: viewportPickIntent.issues
    });
  }

  return createDisplay({
    selectionKind: "none",
    title: "No selection",
    detail: derivedGeometryEnabled
      ? "Select an object"
      : "Primitive fallback mode",
    tone: "idle",
    geometry: {
      status: derivedGeometryEnabled ? "none" : "fallback",
      detail: derivedGeometryEnabled ? "Select an object" : "Primitive fallback"
    }
  });
}

function createDisplay({
  candidateDisplay,
  detail,
  diagnostics = [],
  geometry,
  renderTargetId,
  selectionKind,
  title,
  tone
}: {
  readonly candidateDisplay?: ReferenceCandidateDisplay;
  readonly detail: string;
  readonly diagnostics?: readonly ViewportSelectionDiagnostic[];
  readonly geometry: {
    readonly status: ViewportGeometryDisplayStatus;
    readonly detail: string;
  };
  readonly renderTargetId?: string;
  readonly selectionKind: ViewportSelectionKind;
  readonly title: string;
  readonly tone: ViewportSelectionTone;
}): ViewportSelectionDisplay {
  return {
    selectionKind,
    title,
    detail,
    tone,
    ...(renderTargetId ? { renderTargetId } : {}),
    geometryStatus: geometry.status,
    geometryDetail: geometry.detail,
    referenceStatus: candidateDisplay?.referenceStatus,
    referenceSummary: candidateDisplay?.referenceSummary,
    commandOperations: candidateDisplay?.commandOperations ?? [],
    commandOperationLabels: candidateDisplay?.commandOperationLabels ?? [],
    diagnostics: dedupeDiagnostics([
      ...(candidateDisplay?.diagnostics ?? []),
      ...diagnostics
    ])
  };
}

function createReferenceCandidateDisplay(
  response: SelectionReferenceCandidatesQueryResponse
): ReferenceCandidateDisplay {
  const primary = createSelectionReferenceCandidateSummaries(response)[0];
  const primaryCandidate = getPrimarySelectionReferenceCandidate(response);
  const commandOperations = primary?.commandOperations ?? [];
  const commandOperationLabels = commandOperations.map(
    formatSelectionReferenceOperationLabel
  );
  const diagnostics = dedupeDiagnostics([
    ...(primaryCandidate?.issues ?? []),
    ...response.issues
  ]);

  return {
    detail: formatSelectionReferenceStatus(response.status),
    tone: primary?.tone ?? toneFromReferenceStatus(response.status),
    referenceStatus: response.status,
    referenceSummary: primary?.title,
    commandOperations,
    commandOperationLabels,
    diagnostics
  };
}

function createViewportGeometryDisplay(
  derivedGeometryEnabled: boolean,
  selectedGeometryEntry: DerivedGeometryEntry | undefined
): {
  readonly status: ViewportGeometryDisplayStatus;
  readonly detail: string;
} {
  if (!derivedGeometryEnabled) {
    return { status: "fallback", detail: "Primitive fallback" };
  }

  if (!selectedGeometryEntry) {
    return { status: "none", detail: "Derived geometry unavailable" };
  }

  return {
    status: selectedGeometryEntry.status,
    detail: getDerivedGeometryStatusLabel(selectedGeometryEntry)
  };
}

function createConsumedBodyDiagnostics(
  bodyId: string,
  featureId: string,
  existingDiagnostics: readonly ViewportSelectionDiagnostic[]
): readonly ViewportSelectionDiagnostic[] {
  if (
    existingDiagnostics.some(
      (diagnostic) => diagnostic.code === "CONSUMED_SELECTION_BODY"
    )
  ) {
    return [];
  }

  return [
    {
      code: "CONSUMED_SELECTION_BODY",
      status: "consumed",
      message: `Selected body ${bodyId} is consumed by feature ${featureId}.`
    }
  ];
}

function toneFromReferenceStatus(
  status: CadSelectionReferenceStatus
): ViewportSelectionTone {
  if (status === "resolved") {
    return "ready";
  }

  if (status === "consumed") {
    return "warning";
  }

  return "blocked";
}

function toneFromGeometryStatus(
  status: ViewportGeometryDisplayStatus
): ViewportSelectionTone {
  if (status === "error") {
    return "blocked";
  }

  if (status === "pending") {
    return "warning";
  }

  return "idle";
}

function dedupeDiagnostics(
  issues: readonly (CadSelectionReferenceIssue | ViewportSelectionDiagnostic)[]
): readonly ViewportSelectionDiagnostic[] {
  const diagnostics: ViewportSelectionDiagnostic[] = [];
  const seen = new Set<string>();

  for (const issue of issues) {
    const diagnostic = {
      code: issue.code,
      status: issue.status,
      message: issue.message
    };
    const key = `${diagnostic.code}:${diagnostic.status}:${diagnostic.message}`;

    if (!seen.has(key)) {
      diagnostics.push(diagnostic);
      seen.add(key);
    }
  }

  return diagnostics;
}
