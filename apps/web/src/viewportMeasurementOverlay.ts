import type {
  BodyMeasurementsSnapshot,
  CadBodySnapshot
} from "@web-cad/cad-core";
import type { DocumentUnits } from "@web-cad/cad-protocol";
import { formatGeneratedReferenceKind } from "./generatedReferenceUi";
import type { GeneratedReferenceSelectionState } from "./generatedReferenceSelection";
import {
  createBodyMeasurementRows,
  type MeasurementDisplayRow
} from "./sceneObjectDisplay";
import { redactInternalViewportIds } from "./viewportVisibleText";

export type ViewportMeasurementOverlayKind = "body" | "generatedReference";
export type ViewportMeasurementOverlayTone = "ready" | "blocked";
export type ViewportMeasurementOverlaySource =
  | "body.measurements"
  | "body.generatedReferenceMeasurements";

export interface ViewportMeasurementOverlay {
  readonly selectionKind: ViewportMeasurementOverlayKind;
  readonly title: string;
  readonly detail: string;
  readonly source: ViewportMeasurementOverlaySource;
  readonly tone: ViewportMeasurementOverlayTone;
  readonly rows: readonly MeasurementDisplayRow[];
  readonly error?: string;
}

export interface CreateViewportMeasurementOverlayInput {
  readonly body?: CadBodySnapshot;
  readonly bodyMeasurements?: BodyMeasurementsSnapshot;
  readonly bodyMeasurementsError?: string;
  readonly selectedGeneratedReferenceState: GeneratedReferenceSelectionState;
  readonly units: DocumentUnits;
}

export function createViewportMeasurementOverlay({
  body,
  bodyMeasurements,
  bodyMeasurementsError,
  selectedGeneratedReferenceState,
  units
}: CreateViewportMeasurementOverlayInput):
  | ViewportMeasurementOverlay
  | undefined {
  if (selectedGeneratedReferenceState.status === "selected") {
    const reference = selectedGeneratedReferenceState.reference;
    const rows = selectedGeneratedReferenceState.measurementRows;
    const error = selectedGeneratedReferenceState.measurement?.error;

    return {
      selectionKind: "generatedReference",
      title: `${formatGeneratedReferenceKind(reference.kind)} measurement`,
      detail: reference.label,
      source: "body.generatedReferenceMeasurements",
      tone: rows.length > 0 && !error ? "ready" : "blocked",
      rows,
      ...(error ? { error: redactInternalViewportIds(error) } : {})
    };
  }

  if (selectedGeneratedReferenceState.status === "stale") {
    return {
      selectionKind: "generatedReference",
      title: "Reference measurement",
      detail: "Selected reference stale",
      source: "body.generatedReferenceMeasurements",
      tone: "blocked",
      rows: [],
      error: redactInternalViewportIds(selectedGeneratedReferenceState.message)
    };
  }

  if (!body) {
    return undefined;
  }

  const rows = bodyMeasurements
    ? createBodyMeasurementRows(bodyMeasurements, units)
    : [];

  if (rows.length === 0 && !bodyMeasurementsError) {
    return undefined;
  }

  return {
    selectionKind: "body",
    title: "Body measurements",
    detail: body.name ?? body.id,
    source: "body.measurements",
    tone: rows.length > 0 && !bodyMeasurementsError ? "ready" : "blocked",
    rows,
    ...(bodyMeasurementsError
      ? { error: redactInternalViewportIds(bodyMeasurementsError) }
      : {})
  };
}
