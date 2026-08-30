import type { DocumentUnits } from "@web-cad/cad-protocol";
import type { MeasurementDisplayRow } from "./sceneObjectDisplay";
import {
  bindExactInspectionTarget,
  exactInspectionIdentityKey,
  measureExactInspectionPair,
  measureExactInspectionSingle,
  type ExactInspectionArtifact,
  type ExactInspectionBindResult,
  type ExactInspectionIdentity,
  type ExactInspectionResult
} from "./exactInspectionMeasurement";

export const MAX_INSPECT_MEASUREMENT_PINS = 32;

export interface InspectMeasurementPin {
  readonly id: string;
  readonly title: string;
  readonly identities: readonly ExactInspectionIdentity[];
  readonly result: ExactInspectionResult;
  readonly stale: boolean;
}

export function pinExactInspectionResult(
  pins: readonly InspectMeasurementPin[],
  title: string,
  identities: readonly ExactInspectionIdentity[],
  result: ExactInspectionResult,
  id = `pin:${identities.map(exactInspectionIdentityKey).join("|")}:${pins.length}`
): readonly InspectMeasurementPin[] {
  if (identities.length === 0 || identities.length > 2) {
    return pins;
  }
  const next: InspectMeasurementPin = { id, title, identities, result, stale: false };
  const withoutSame = pins.filter((pin) => pin.id !== id);
  return [...withoutSame, next].slice(-MAX_INSPECT_MEASUREMENT_PINS);
}

export function clearInspectMeasurementPins(): readonly InspectMeasurementPin[] {
  return [];
}

export function refreshInspectMeasurementPins(
  pins: readonly InspectMeasurementPin[],
  artifacts: readonly ExactInspectionArtifact[],
  units: DocumentUnits
): readonly InspectMeasurementPin[] {
  return pins.map((pin) => {
    const bounds = pin.identities.map((identity) =>
      bindExactInspectionTarget(identity, artifacts)
    );
    if (bounds.some((bound) => !bound.current)) {
      return { ...pin, stale: true };
    }
    const result =
      bounds.length === 1
        ? measureExactInspectionSingle(bounds[0] as ExactInspectionBindResult, units)
        : measureExactInspectionPair(
            bounds[0] as ExactInspectionBindResult,
            bounds[1] as ExactInspectionBindResult,
            units
          );
    return result.status === "ready" ? { ...pin, result, stale: false } : { ...pin, stale: true };
  });
}

export function inspectMeasurementPinRows(
  pin: InspectMeasurementPin
): readonly MeasurementDisplayRow[] {
  return pin.stale
    ? [{ label: "Status", value: "Stale — identity no longer matches the current exact body." }]
    : pin.result.rows;
}
