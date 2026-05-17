import type {
  CadFeatureSummary,
  SketchEntityId,
  SketchId
} from "@web-cad/cad-protocol";

export interface SketchEntityExtrudeUsage {
  readonly featureId: string;
  readonly bodyId: string;
  readonly featureName?: string;
}

export function getSketchEntityExtrudeUsages(
  features: readonly CadFeatureSummary[],
  sketchId: SketchId,
  entityId: SketchEntityId
): readonly SketchEntityExtrudeUsage[] {
  return features
    .filter(
      (feature): feature is Extract<CadFeatureSummary, { kind: "extrude" }> =>
        feature.kind === "extrude" &&
        feature.sketchId === sketchId &&
        feature.entityId === entityId
    )
    .map((feature) => ({
      featureId: feature.id,
      bodyId: feature.bodyId,
      ...(feature.name ? { featureName: feature.name } : {})
    }));
}

export function formatSketchEntityUsageLabel(
  usages: readonly SketchEntityExtrudeUsage[]
): string | undefined {
  if (usages.length === 0) {
    return undefined;
  }

  if (usages.length === 1) {
    const usage = usages[0];
    const featureLabel = usage.featureName ?? usage.featureId;

    return `Drives ${featureLabel} -> ${usage.bodyId}`;
  }

  return `Drives ${usages.length} extrudes`;
}
