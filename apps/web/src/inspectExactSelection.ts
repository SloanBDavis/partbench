import type { DocumentUnits } from "@web-cad/cad-protocol";
import type { ViewportExactSelection } from "./viewportPickIntent";
import {
  bindExactInspectionTarget,
  measureExactInspectionSingle,
  toExactInspectionArtifact,
  type ExactInspectionArtifact,
  type ExactInspectionIdentity,
  type ExactInspectionResult
} from "./exactInspectionMeasurement";

export function createExactInspectionArtifacts(
  artifacts: readonly Parameters<typeof toExactInspectionArtifact>[0][]
): readonly ExactInspectionArtifact[] {
  return artifacts.map(toExactInspectionArtifact);
}

export function createExactInspectionIdentity(
  selection: ViewportExactSelection
): ExactInspectionIdentity {
  return {
    bodyId: selection.bodyId,
    bodySourceIdentitySignature: selection.bodySourceIdentitySignature,
    topologySignature: selection.topologySignature,
    entityKind: selection.entityKind,
    ...(selection.localId ? { localId: selection.localId } : {}),
    ...(selection.entitySignature
      ? { entitySignature: selection.entitySignature }
      : {})
  };
}

export function measureCurrentExactSelection(
  selection: ViewportExactSelection | undefined,
  artifacts: readonly ExactInspectionArtifact[],
  units: DocumentUnits
): ExactInspectionResult | undefined {
  if (!selection) return undefined;
  return measureExactInspectionSingle(
    bindExactInspectionTarget(
      createExactInspectionIdentity(selection),
      artifacts,
      selection.entityKind
    ),
    units
  );
}
