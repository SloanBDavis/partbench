import type {
  BodyGeneratedReferencesQueryResponse,
  CadBodySnapshot,
  CadGeneratedReference,
  CadSelectionReferenceOperation,
  SelectionReferenceCandidatesQueryResponse
} from "@web-cad/cad-protocol";
import {
  getGeneratedReferenceItems,
  formatGeneratedReferenceKind
} from "./generatedReferenceUi";
import {
  formatSelectionReferenceOperationLabel,
  getPrimarySelectionReferenceCandidate
} from "./generatedReferenceSelection";
import {
  getDerivedGeometryStatusLabel,
  type DerivedGeometryEntry
} from "./derivedGeometry";
import type { ViewportHoverState } from "./viewportHoverIntent";
import type { ViewportMeasurementOverlay } from "./viewportMeasurementOverlay";
import type { ViewportSelectionDisplay } from "./viewportSelectionDisplay";
import { redactInternalViewportIds } from "./viewportVisibleText";

export interface ViewportBaselineFixtureSnapshot {
  readonly body: {
    readonly id: string;
    readonly label: string;
    readonly geometryStatus: string;
    readonly geometryDetail: string;
  };
  readonly selection: {
    readonly title: string;
    readonly detail: string;
    readonly tone: string;
    readonly commandOperationLabels: readonly string[];
    readonly diagnostics: readonly string[];
  };
  readonly hover?: {
    readonly title: string;
    readonly detail: string;
    readonly tone: string;
    readonly commandOperationLabels: readonly string[];
    readonly diagnostics: readonly string[];
  };
  readonly measurement?: {
    readonly title: string;
    readonly detail: string;
    readonly rows: readonly string[];
    readonly error?: string;
  };
  readonly references: readonly {
    readonly kind: CadGeneratedReference["kind"];
    readonly label: string;
    readonly bodyId: string;
    readonly stableId: string;
    readonly commandable: boolean;
    readonly commandOperationLabels: readonly string[];
  }[];
}

export function createViewportBaselineFixtureSnapshot({
  body,
  geometryEntry,
  hoverState,
  measurementOverlay,
  referenceCandidatesByStableId,
  references,
  selectionDisplay
}: {
  readonly body: CadBodySnapshot;
  readonly geometryEntry?: DerivedGeometryEntry;
  readonly hoverState?: ViewportHoverState;
  readonly measurementOverlay?: ViewportMeasurementOverlay;
  readonly referenceCandidatesByStableId?: ReadonlyMap<
    string,
    SelectionReferenceCandidatesQueryResponse
  >;
  readonly references?: BodyGeneratedReferencesQueryResponse;
  readonly selectionDisplay: ViewportSelectionDisplay;
}): ViewportBaselineFixtureSnapshot {
  return {
    body: {
      id: body.id,
      label: body.name ?? body.id,
      geometryStatus: geometryEntry?.status ?? "none",
      geometryDetail: geometryEntry
        ? redactInternalViewportIds(
            getDerivedGeometryStatusLabel(geometryEntry)
          )
        : "Derived geometry unavailable"
    },
    selection: {
      title: redactInternalViewportIds(selectionDisplay.title),
      detail: redactInternalViewportIds(selectionDisplay.detail),
      tone: selectionDisplay.tone,
      commandOperationLabels: selectionDisplay.commandOperationLabels.map(
        redactInternalViewportIds
      ),
      diagnostics: selectionDisplay.diagnostics.map((diagnostic) =>
        redactInternalViewportIds(diagnostic.message)
      )
    },
    ...(hoverState && hoverState.kind !== "empty"
      ? {
          hover: {
            title: redactInternalViewportIds(hoverState.title),
            detail: redactInternalViewportIds(hoverState.detail),
            tone: hoverState.tone,
            commandOperationLabels: hoverState.commandOperationLabels.map(
              redactInternalViewportIds
            ),
            diagnostics: hoverState.diagnostics.map((diagnostic) =>
              redactInternalViewportIds(diagnostic.message)
            )
          }
        }
      : {}),
    ...(measurementOverlay
      ? {
          measurement: {
            title: redactInternalViewportIds(measurementOverlay.title),
            detail: redactInternalViewportIds(measurementOverlay.detail),
            rows: measurementOverlay.rows.map(
              (row) =>
                `${redactInternalViewportIds(row.label)}: ${redactInternalViewportIds(row.value)}`
            ),
            ...(measurementOverlay.error
              ? {
                  error: redactInternalViewportIds(measurementOverlay.error)
                }
              : {})
          }
        }
      : {}),
    references: (references ? getGeneratedReferenceItems(references) : []).map(
      (reference) =>
        createReferenceBaseline(
          reference,
          referenceCandidatesByStableId?.get(reference.stableId)
        )
    )
  };
}

function createReferenceBaseline(
  reference: CadGeneratedReference,
  candidates: SelectionReferenceCandidatesQueryResponse | undefined
): ViewportBaselineFixtureSnapshot["references"][number] {
  const candidate = candidates
    ? getPrimarySelectionReferenceCandidate(candidates)
    : undefined;
  const commandOperations: readonly CadSelectionReferenceOperation[] =
    candidate?.commandOperations ?? [];

  return {
    kind: reference.kind,
    label: `${formatGeneratedReferenceKind(reference.kind)}: ${reference.label}`,
    bodyId: reference.bodyId,
    stableId: reference.stableId,
    commandable: candidate?.commandable ?? false,
    commandOperationLabels: commandOperations.map(
      formatSelectionReferenceOperationLabel
    )
  };
}
