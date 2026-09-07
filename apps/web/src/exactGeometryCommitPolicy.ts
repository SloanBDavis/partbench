import {
  isCadExactDownstreamGeometryOp,
  type CadBodySnapshot,
  type CadFeatureSummary,
  type CadOp
} from "@web-cad/cad-protocol";

/** Source extrusion edits must validate the finished descendant before committing. */
export function requiresExactGeometryCommitPreflight(
  ops: readonly CadOp[],
  features: readonly Pick<CadFeatureSummary, "id" | "bodyId">[],
  bodies: readonly Pick<CadBodySnapshot, "id" | "consumedByFeatureId">[]
): boolean {
  return ops.some((op) => {
    if (isCadExactDownstreamGeometryOp(op)) return true;
    if (op.op !== "feature.updateExtrude") return false;
    const feature = features.find((candidate) => candidate.id === op.id);
    return (
      feature !== undefined &&
      bodies.some(
        (body) =>
          body.id === feature.bodyId && body.consumedByFeatureId !== undefined
      )
    );
  });
}
