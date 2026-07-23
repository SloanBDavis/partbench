import type {
  CadFeatureSummary,
  SketchEntityId,
  SketchId
} from "@web-cad/cad-protocol";

export interface SketchEntityExtrudeUsage {
  readonly featureId: string;
  readonly featureKind: "extrude" | "revolve" | "hole";
  readonly bodyId: string;
  readonly featureName?: string;
  readonly role: "profile" | "axis" | "hole";
}

export function getSketchEntityExtrudeUsages(
  features: readonly CadFeatureSummary[],
  sketchId: SketchId,
  entityId: SketchEntityId
): readonly SketchEntityExtrudeUsage[] {
  return features
    .filter(
      (
        feature
      ): feature is Extract<
        CadFeatureSummary,
        { kind: "extrude" | "revolve" | "hole" }
      > => isFeatureUsingSketchEntity(feature, sketchId, entityId)
    )
    .map((feature) => ({
      featureId: feature.id,
      featureKind: feature.kind,
      bodyId: feature.bodyId,
      ...(feature.name ? { featureName: feature.name } : {}),
      role: getSketchEntityFeatureUsageRole(feature, entityId)
    }));
}

function isFeatureUsingSketchEntity(
  feature: CadFeatureSummary,
  sketchId: SketchId,
  entityId: SketchEntityId
): feature is Extract<
  CadFeatureSummary,
  { kind: "extrude" | "revolve" | "hole" }
> {
  if (
    feature.kind === "extrude" &&
    feature.sketchId === sketchId &&
    feature.entityId === entityId
  ) {
    return true;
  }

  if (feature.kind === "revolve" && feature.sketchId === sketchId) {
    return feature.entityId === entityId || feature.axis.entityId === entityId;
  }

  return (
    feature.kind === "hole" &&
    feature.sketchId === sketchId &&
    feature.circleEntityId === entityId
  );
}

function getSketchEntityFeatureUsageRole(
  feature: Extract<CadFeatureSummary, { kind: "extrude" | "revolve" | "hole" }>,
  entityId: SketchEntityId
): SketchEntityExtrudeUsage["role"] {
  if (feature.kind === "hole") {
    return "hole";
  }

  if (feature.kind === "revolve" && feature.axis.entityId === entityId) {
    return "axis";
  }

  return "profile";
}

export function formatSketchEntityUsageLabel(
  usages: readonly SketchEntityExtrudeUsage[]
): string | undefined {
  const [usage] = usages;
  if (!usage) {
    return undefined;
  }

  if (usages.length === 1) {
    const featureLabel = usage.featureName ?? usage.featureId;

    return `${formatFeatureUsageRole(usage)} ${featureLabel} -> ${usage.bodyId}`;
  }

  return `Used by ${usages.length} features`;
}

function formatFeatureUsageRole(usage: SketchEntityExtrudeUsage): string {
  if (usage.role === "axis") {
    return "Axis for";
  }

  if (usage.role === "hole") {
    return "Hole tool for";
  }

  return "Drives";
}
