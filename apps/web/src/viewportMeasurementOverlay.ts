import type {
  BodyMeasurementsSnapshot,
  CadBodySnapshot
} from "@web-cad/cad-core";
import type {
  CadGeneratedReference,
  CadSelectionReferenceIssue,
  CadSelectionReferenceStatus,
  CadViewportInteractionDiagnostic,
  CadViewportInteractionDiagnosticCode,
  CadViewportMeasurementAuthority,
  CadViewportSingleTargetMeasureInspectTarget,
  DocumentUnits,
  GeneratedReferenceMeasurement,
  NamedGeneratedReferenceEntry,
  SelectionReferenceCandidatesQueryResponse
} from "@web-cad/cad-protocol";
import {
  createGeneratedReferenceMeasurementRows,
  formatGeneratedReferenceKind
} from "./generatedReferenceUi";
import type { GeneratedReferenceSelectionState } from "./generatedReferenceSelection";
import {
  createBodyMeasurementRows,
  formatArea,
  formatBounds,
  formatVolume,
  type MeasurementDisplayRow
} from "./sceneObjectDisplay";
import { formatVisibleDiagnosticMessage } from "./viewportVisibleText";

export type ViewportMeasurementOverlayKind = "body" | "generatedReference";
export type ViewportMeasurementOverlayTone = "ready" | "blocked";
export type ViewportMeasurementOverlaySource =
  | "body.measurements"
  | "body.generatedReferenceMeasurements"
  | "selection.referenceCandidates"
  | "unsupported";

export interface ViewportMeasureInspectDiagnostic {
  readonly code:
    | CadSelectionReferenceIssue["code"]
    | CadViewportInteractionDiagnosticCode
    | "VIEWPORT_MEASUREMENT_SOURCE_UNAVAILABLE"
    | "VIEWPORT_MEASUREMENT_TARGET_UNSUPPORTED";
  readonly status: Exclude<CadSelectionReferenceStatus, "resolved">;
  readonly message: string;
}

export interface ViewportMeasureInspectTarget extends CadViewportSingleTargetMeasureInspectTarget {
  readonly title: string;
  readonly detail: string;
  readonly authorityLabel: string;
}

export interface ViewportInspectOverlay {
  readonly title: string;
  readonly detail: string;
  readonly authority: CadViewportMeasurementAuthority;
  readonly authorityLabel: string;
  readonly rows: readonly MeasurementDisplayRow[];
  readonly commandOperationLabels: readonly string[];
  readonly diagnostics: readonly ViewportMeasureInspectDiagnostic[];
}

export interface ViewportMeasurementOverlay {
  readonly selectionKind: ViewportMeasurementOverlayKind;
  readonly title: string;
  readonly detail: string;
  readonly source: ViewportMeasurementOverlaySource;
  readonly authority: CadViewportMeasurementAuthority;
  readonly authorityLabel: string;
  readonly target: ViewportMeasureInspectTarget;
  readonly tone: ViewportMeasurementOverlayTone;
  readonly rows: readonly MeasurementDisplayRow[];
  readonly diagnostics: readonly ViewportMeasureInspectDiagnostic[];
  readonly inspect: ViewportInspectOverlay;
  readonly error?: string;
}

export interface CreateViewportMeasurementOverlayInput {
  readonly body?: CadBodySnapshot;
  readonly bodyMeasurements?: BodyMeasurementsSnapshot;
  readonly bodyMeasurementsError?: string;
  readonly namedReferences?: readonly NamedGeneratedReferenceEntry[];
  readonly selectedGeneratedReferenceState: GeneratedReferenceSelectionState;
  readonly selectionReferenceCandidates?: SelectionReferenceCandidatesQueryResponse;
  readonly units: DocumentUnits;
}

export function createViewportMeasurementOverlay({
  body,
  bodyMeasurements,
  bodyMeasurementsError,
  namedReferences = [],
  selectedGeneratedReferenceState,
  selectionReferenceCandidates,
  units
}: CreateViewportMeasurementOverlayInput):
  | ViewportMeasurementOverlay
  | undefined {
  if (selectedGeneratedReferenceState.status === "selected") {
    const reference = selectedGeneratedReferenceState.reference;
    const measurement =
      selectedGeneratedReferenceState.measurement?.measurement;
    const measurementError = selectedGeneratedReferenceState.measurement?.error;
    const supported = isSupportedGeneratedReferenceTarget(reference);
    const authority: CadViewportMeasurementAuthority =
      supported && measurement ? "sourceAnalytic" : "unsupported";
    const target = createGeneratedReferenceTarget({
      authority,
      namedReferences,
      reference,
      selectionReferenceCandidates
    });
    const source = supported
      ? "body.generatedReferenceMeasurements"
      : "unsupported";
    const unsupportedDiagnostic = supported
      ? undefined
      : createDiagnostic(
          "VIEWPORT_MEASUREMENT_TARGET_UNSUPPORTED",
          "unsupported",
          `Viewport measurements currently support generated planar faces and generated edges, not generated ${reference.kind} targets.`
        );
    const sourceDiagnostic = measurementError
      ? createDiagnostic(
          "VIEWPORT_MEASUREMENT_SOURCE_UNAVAILABLE",
          "unsupported",
          measurementError
        )
      : supported && !measurement
        ? createDiagnostic(
            "VIEWPORT_MEASUREMENT_SOURCE_UNAVAILABLE",
            "unsupported",
            `Reference measurements are unavailable for ${reference.label}.`
          )
        : undefined;
    const diagnostics = dedupeDiagnostics([
      ...diagnosticsFromSelectionReferenceCandidates(
        selectionReferenceCandidates
      ),
      ...(unsupportedDiagnostic ? [unsupportedDiagnostic] : []),
      ...(sourceDiagnostic ? [sourceDiagnostic] : [])
    ]);
    const rows =
      supported && measurement
        ? createGeneratedReferenceViewportMeasurementRows(measurement, units)
        : [];
    const error = diagnostics[0]?.message;
    const inspect = createInspectOverlay({
      authority,
      commandOperationLabels: createCommandOperationLabels(
        selectionReferenceCandidates
      ),
      diagnostics,
      target
    });

    return {
      selectionKind: "generatedReference",
      title: `${formatGeneratedReferenceKind(reference.kind)} measurement`,
      detail: reference.label,
      source,
      authority,
      authorityLabel: formatViewportMeasurementAuthority(authority),
      target,
      tone: rows.length > 0 && diagnostics.length === 0 ? "ready" : "blocked",
      rows,
      diagnostics,
      inspect,
      ...(error ? { error: cleanText(error) } : {})
    };
  }

  if (selectedGeneratedReferenceState.status === "stale") {
    const authority: CadViewportMeasurementAuthority = "unsupported";
    const target: ViewportMeasureInspectTarget = {
      targetKind: targetKindFromSelectedReferenceKind(
        selectedGeneratedReferenceState.selection.kind
      ),
      title: "Selected reference stale",
      detail: "Generated reference target is stale",
      label: "Selected reference",
      bodyId: selectedGeneratedReferenceState.selection.bodyId,
      stableId: cleanText(selectedGeneratedReferenceState.selection.stableId),
      selection: {
        type: "generatedReference",
        bodyId: selectedGeneratedReferenceState.selection.bodyId,
        stableId: cleanText(selectedGeneratedReferenceState.selection.stableId),
        expectedKind: selectedGeneratedReferenceState.selection.kind
      },
      authority,
      authorityLabel: formatViewportMeasurementAuthority(authority),
      status: "stale",
      diagnostics: []
    };
    const diagnostics = [
      createDiagnostic(
        "STALE_SELECTION_REFERENCE",
        "stale",
        selectedGeneratedReferenceState.message
      )
    ];

    return {
      selectionKind: "generatedReference",
      title: "Reference measurement",
      detail: "Selected reference stale",
      source: "body.generatedReferenceMeasurements",
      authority,
      authorityLabel: formatViewportMeasurementAuthority(authority),
      target: {
        ...target,
        diagnostics: diagnostics.map(toViewportInteractionDiagnostic)
      },
      tone: "blocked",
      rows: [],
      diagnostics,
      inspect: createInspectOverlay({
        authority,
        commandOperationLabels: [],
        diagnostics,
        target
      }),
      error: cleanText(selectedGeneratedReferenceState.message)
    };
  }

  if (!body) {
    return undefined;
  }

  const rows = bodyMeasurements
    ? createBodyMeasurementRows(bodyMeasurements, units)
    : [];
  const authority: CadViewportMeasurementAuthority =
    bodyMeasurements && !bodyMeasurementsError
      ? "sourceAnalytic"
      : "unsupported";
  const sourceDiagnostic = bodyMeasurementsError
    ? createDiagnostic(
        "VIEWPORT_MEASUREMENT_SOURCE_UNAVAILABLE",
        "unsupported",
        bodyMeasurementsError
      )
    : undefined;
  const diagnostics = dedupeDiagnostics([
    ...diagnosticsFromSelectionReferenceCandidates(
      selectionReferenceCandidates
    ),
    ...(sourceDiagnostic ? [sourceDiagnostic] : [])
  ]);

  if (rows.length === 0 && diagnostics.length === 0) {
    return undefined;
  }

  const target = createBodyTarget({
    authority,
    body,
    selectionReferenceCandidates
  });
  const inspect = createInspectOverlay({
    authority,
    commandOperationLabels: createCommandOperationLabels(
      selectionReferenceCandidates
    ),
    diagnostics,
    target
  });

  return {
    selectionKind: "body",
    title: "Body measurement",
    detail: body.name ?? body.id,
    source: "body.measurements",
    authority,
    authorityLabel: formatViewportMeasurementAuthority(authority),
    target,
    tone: rows.length > 0 && diagnostics.length === 0 ? "ready" : "blocked",
    rows,
    diagnostics,
    inspect,
    ...(diagnostics[0]?.message ? { error: diagnostics[0].message } : {})
  };
}

export function formatViewportMeasurementAuthority(
  authority: CadViewportMeasurementAuthority
): string {
  switch (authority) {
    case "semanticDocument":
      return "Authority: semantic document";
    case "sourceAnalytic":
      return "Authority: source-analytic exact";
    case "geometryBoundaryExact":
      return "Authority: geometry-boundary exact metadata";
    case "displayApproximation":
      return "Authority: display approximation";
    case "unsupported":
      return "Authority: unsupported";
  }
}

function createBodyTarget({
  authority,
  body,
  selectionReferenceCandidates
}: {
  readonly authority: CadViewportMeasurementAuthority;
  readonly body: CadBodySnapshot;
  readonly selectionReferenceCandidates?: SelectionReferenceCandidatesQueryResponse;
}): ViewportMeasureInspectTarget {
  const status = interactionStatusFromSelectionReferenceCandidates(
    selectionReferenceCandidates,
    authority
  );
  const diagnostics = diagnosticsFromSelectionReferenceCandidates(
    selectionReferenceCandidates
  ).map(toViewportInteractionDiagnostic);

  return {
    targetKind: "body",
    title: `${body.name ?? body.id} (Body)`,
    detail: "Semantic body target",
    label: body.name ?? body.id,
    bodyId: body.id,
    selection: { type: "body", bodyId: body.id },
    authority,
    authorityLabel: formatViewportMeasurementAuthority(authority),
    status,
    diagnostics
  };
}

function createGeneratedReferenceTarget({
  authority,
  namedReferences,
  reference,
  selectionReferenceCandidates
}: {
  readonly authority: CadViewportMeasurementAuthority;
  readonly namedReferences: readonly NamedGeneratedReferenceEntry[];
  readonly reference: CadGeneratedReference;
  readonly selectionReferenceCandidates?: SelectionReferenceCandidatesQueryResponse;
}): ViewportMeasureInspectTarget {
  const namedReference = findNamedReferenceForSelection(
    namedReferences,
    reference,
    selectionReferenceCandidates
  );
  const targetKind =
    namedReference ||
    selectionReferenceCandidates?.selection.type === "namedReference"
      ? "namedReference"
      : targetKindFromGeneratedReference(reference);
  const status = interactionStatusFromSelectionReferenceCandidates(
    selectionReferenceCandidates,
    authority
  );
  const diagnostics = diagnosticsFromSelectionReferenceCandidates(
    selectionReferenceCandidates
  ).map(toViewportInteractionDiagnostic);

  return {
    targetKind,
    title: `${formatGeneratedReferenceKind(reference.kind)}: ${reference.label}`,
    detail:
      targetKind === "namedReference"
        ? "Named reference target"
        : "Generated reference target",
    label: reference.label,
    bodyId: reference.bodyId,
    stableId: cleanText(reference.stableId),
    referenceName:
      selectionReferenceCandidates?.selection.type === "namedReference"
        ? selectionReferenceCandidates.selection.name
        : namedReference?.name,
    selection:
      selectionReferenceCandidates?.selection.type === "namedReference"
        ? {
            type: "namedReference",
            name: selectionReferenceCandidates.selection.name
          }
        : {
            type: "generatedReference",
            bodyId: reference.bodyId,
            stableId: cleanText(reference.stableId),
            expectedKind: reference.kind
          },
    authority,
    authorityLabel: formatViewportMeasurementAuthority(authority),
    status,
    diagnostics
  };
}

function createInspectOverlay({
  authority,
  commandOperationLabels,
  diagnostics,
  target
}: {
  readonly authority: CadViewportMeasurementAuthority;
  readonly commandOperationLabels: readonly string[];
  readonly diagnostics: readonly ViewportMeasureInspectDiagnostic[];
  readonly target: ViewportMeasureInspectTarget;
}): ViewportInspectOverlay {
  const [diagnostic] = diagnostics;
  return {
    title: `Inspect ${target.targetKind === "body" ? "body" : "target"}`,
    detail: diagnostic
      ? diagnostic.message
      : commandOperationLabels.length > 0
        ? "Ready target"
        : "Single semantic target",
    authority,
    authorityLabel: formatViewportMeasurementAuthority(authority),
    rows: createInspectRows(target, commandOperationLabels),
    commandOperationLabels,
    diagnostics
  };
}

function createInspectRows(
  target: ViewportMeasureInspectTarget,
  commandOperationLabels: readonly string[]
): readonly MeasurementDisplayRow[] {
  const rows: MeasurementDisplayRow[] = [
    { label: "Target", value: target.title },
    { label: "Authority", value: target.authorityLabel },
    {
      label: "Commands",
      value:
        commandOperationLabels.length > 0
          ? commandOperationLabels.join(", ")
          : "None"
    }
  ];

  if (target.referenceName) {
    rows.splice(1, 0, {
      label: "Name",
      value: target.referenceName
    });
  }

  return rows.map((row) => ({
    label: cleanText(row.label),
    value: cleanText(row.value)
  }));
}

function createGeneratedReferenceViewportMeasurementRows(
  measurement: GeneratedReferenceMeasurement,
  units: DocumentUnits
): readonly MeasurementDisplayRow[] {
  if (measurement.kind === "body") {
    return [
      { label: "Volume", value: formatVolume(measurement.volume, units) },
      { label: "Bounds", value: formatBounds(measurement.bounds, units) },
      {
        label: "Centroid",
        value: measurement.centroid
          .map((value) => `${formatNumber(value)} ${units}`)
          .join(", ")
      }
    ];
  }

  if (measurement.kind === "face") {
    return [
      { label: "Area", value: formatArea(measurement.area, units) },
      { label: "Center", value: formatPoint(measurement.center, units) },
      {
        label: "Surface",
        value: measurement.surfaceType === "plane" ? "plane" : "unsupported"
      },
      ...(measurement.normal
        ? [
            {
              label: "Normal",
              value: measurement.normal.map(formatNumber).join(", ")
            }
          ]
        : [])
    ];
  }

  if (measurement.kind === "edge") {
    return [
      {
        label: "Length",
        value: `${formatNumber(measurement.length)} ${units}`
      },
      { label: "Curve", value: measurement.curveType },
      ...(measurement.radius !== undefined
        ? [
            {
              label: "Radius",
              value: `${formatNumber(measurement.radius)} ${units}`
            },
            {
              label: "Diameter",
              value: `${formatNumber(measurement.radius * 2)} ${units}`
            }
          ]
        : [])
    ];
  }

  return createGeneratedReferenceMeasurementRows(measurement, units);
}

function isSupportedGeneratedReferenceTarget(
  reference: CadGeneratedReference
): boolean {
  if (reference.kind === "edge") {
    return true;
  }

  if (reference.kind !== "face") {
    return false;
  }

  return reference.geometricSignature.surfaceType === "plane";
}

function targetKindFromGeneratedReference(
  reference: CadGeneratedReference
): ViewportMeasureInspectTarget["targetKind"] {
  if (reference.kind === "body") {
    return "body";
  }

  if (reference.kind === "edge") {
    return "generatedEdge";
  }

  if (
    reference.kind === "face" &&
    reference.geometricSignature.surfaceType === "plane"
  ) {
    return "generatedPlanarFace";
  }

  return "unsupportedGeneratedReference";
}

function targetKindFromSelectedReferenceKind(
  kind: CadGeneratedReference["kind"]
): ViewportMeasureInspectTarget["targetKind"] {
  if (kind === "body") {
    return "body";
  }

  if (kind === "edge") {
    return "generatedEdge";
  }

  if (kind === "face") {
    return "generatedPlanarFace";
  }

  return "unsupportedGeneratedReference";
}

function diagnosticsFromSelectionReferenceCandidates(
  response: SelectionReferenceCandidatesQueryResponse | undefined
): readonly ViewportMeasureInspectDiagnostic[] {
  if (!response) {
    return [];
  }

  return dedupeDiagnostics([
    ...response.issues.map(diagnosticFromSelectionIssue),
    ...response.candidates.flatMap((candidate) =>
      candidate.issues.map(diagnosticFromSelectionIssue)
    )
  ]);
}

function diagnosticFromSelectionIssue(
  issue: CadSelectionReferenceIssue
): ViewportMeasureInspectDiagnostic {
  return createDiagnostic(issue.code, issue.status, issue.message);
}

function createDiagnostic(
  code: ViewportMeasureInspectDiagnostic["code"],
  status: ViewportMeasureInspectDiagnostic["status"],
  message: string
): ViewportMeasureInspectDiagnostic {
  return {
    code,
    status,
    message: cleanText(message)
  };
}

function toViewportInteractionDiagnostic(
  diagnostic: ViewportMeasureInspectDiagnostic
): CadViewportInteractionDiagnostic {
  return {
    code:
      diagnostic.code === "MISSING_SELECTION_TARGET"
        ? "VIEWPORT_MISSING_HIT_TARGET"
        : diagnostic.code === "STALE_SELECTION_REFERENCE"
          ? "VIEWPORT_STALE_SEMANTIC_HINT"
          : diagnostic.code === "AMBIGUOUS_SELECTION_TOPOLOGY"
            ? "VIEWPORT_AMBIGUOUS_HIT_CANDIDATE"
            : diagnostic.code === "CONSUMED_SELECTION_BODY"
              ? "VIEWPORT_CONSUMED_TARGET"
              : diagnostic.code === "NON_COMMANDABLE_SELECTION_TARGET"
                ? "VIEWPORT_NON_COMMANDABLE_TARGET"
                : "VIEWPORT_UNSUPPORTED_DISPLAY_ENTITY",
    status: diagnostic.status,
    message: diagnostic.message
  };
}

function createCommandOperationLabels(
  response: SelectionReferenceCandidatesQueryResponse | undefined
): readonly string[] {
  const candidate =
    response?.candidates.find((entry) => entry.commandable) ??
    response?.candidates[0];

  return (
    candidate?.commandOperations
      .map(formatCommandOperationLabel)
      .map(cleanText) ?? []
  );
}

function formatCommandOperationLabel(operation: string): string {
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
    default:
      return operation;
  }
}

function interactionStatusFromSelectionReferenceCandidates(
  response: SelectionReferenceCandidatesQueryResponse | undefined,
  authority: CadViewportMeasurementAuthority
): ViewportMeasureInspectTarget["status"] {
  if (response) {
    return response.status === "resolved" ? "resolved" : response.status;
  }

  return authority === "unsupported" ? "unsupported" : "resolved";
}

function findNamedReferenceForSelection(
  namedReferences: readonly NamedGeneratedReferenceEntry[],
  reference: CadGeneratedReference,
  response: SelectionReferenceCandidatesQueryResponse | undefined
): NamedGeneratedReferenceEntry | undefined {
  const selection = response?.selection;

  if (selection?.type === "namedReference") {
    return namedReferences.find(
      (candidate) => candidate.name === selection.name
    );
  }

  return namedReferences.find(
    (candidate) =>
      candidate.status === "resolved" &&
      candidate.bodyId === reference.bodyId &&
      candidate.stableId === reference.stableId &&
      candidate.kind === reference.kind
  );
}

function dedupeDiagnostics(
  diagnostics: readonly ViewportMeasureInspectDiagnostic[]
): readonly ViewportMeasureInspectDiagnostic[] {
  const seen = new Set<string>();
  const deduped: ViewportMeasureInspectDiagnostic[] = [];

  for (const diagnostic of diagnostics) {
    const key = `${diagnostic.code}:${diagnostic.status}:${diagnostic.message}`;

    if (seen.has(key)) {
      continue;
    }

    deduped.push(diagnostic);
    seen.add(key);
  }

  return deduped;
}

function formatPoint(
  point: readonly [number, number, number],
  units: DocumentUnits
): string {
  return point.map((value) => `${formatNumber(value)} ${units}`).join(", ");
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? value.toString() : value.toFixed(2);
}

function cleanText(text: string): string {
  return formatVisibleDiagnosticMessage(text);
}
