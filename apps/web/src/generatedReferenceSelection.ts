import type {
  BodyGeneratedReferencesQueryResponse,
  CadGeneratedEntityKind,
  CadGeneratedReference,
  DocumentUnits
} from "@web-cad/cad-protocol";
import {
  createGeneratedReferenceMeasurementRows,
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
