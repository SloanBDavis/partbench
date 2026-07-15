import type {
  CadBodySnapshot,
  CadFeatureSummary,
  FeaturePatternAxis,
  PatternDirectionRef,
  PatternRotationAxisRef
} from "@web-cad/cad-protocol";

export const PATTERN_AXIS_OPTIONS: readonly FeaturePatternAxis[] = [
  "x",
  "y",
  "z"
];

export type PatternPanelState =
  | {
      readonly mode: "create";
      readonly seedBodyId: string;
      readonly seedLabel: string;
    }
  | {
      readonly mode: "editLinear";
      readonly featureId: string;
      readonly seedBodyId: string;
      readonly seedLabel: string;
      readonly direction: PatternDirectionRef;
      readonly spacing: number;
      readonly instanceCount: number;
    }
  | {
      readonly mode: "editCircular";
      readonly featureId: string;
      readonly seedBodyId: string;
      readonly seedLabel: string;
      readonly rotationAxis: PatternRotationAxisRef;
      readonly totalAngleDegrees: number;
      readonly instanceCount: number;
    }
  | {
      readonly mode: "unavailable";
      readonly reason: string;
    };

export function getPatternPanelState(
  body: CadBodySnapshot,
  feature: CadFeatureSummary | undefined
): PatternPanelState {
  if (feature?.kind === "linearPattern") {
    return {
      mode: "editLinear",
      featureId: feature.id,
      seedBodyId: feature.seedBodyId,
      seedLabel: feature.seedBodyId,
      direction: feature.direction,
      spacing: feature.spacing,
      instanceCount: feature.instanceCount
    };
  }

  if (feature?.kind === "circularPattern") {
    return {
      mode: "editCircular",
      featureId: feature.id,
      seedBodyId: feature.seedBodyId,
      seedLabel: feature.seedBodyId,
      rotationAxis: feature.rotationAxis,
      totalAngleDegrees: feature.totalAngleDegrees,
      instanceCount: feature.instanceCount
    };
  }

  if (!feature || feature.kind === "primitive") {
    return {
      mode: "unavailable",
      reason: "Primitive-derived bodies cannot seed a pattern."
    };
  }

  if (body.consumedByFeatureId) {
    return {
      mode: "unavailable",
      reason: `Body ${body.id} is consumed by feature ${body.consumedByFeatureId} and cannot seed a pattern.`
    };
  }

  return {
    mode: "create",
    seedBodyId: body.id,
    seedLabel: body.name ?? body.id
  };
}

export function formatPatternAxisLabel(axis: FeaturePatternAxis): string {
  return axis.toUpperCase();
}

export function createLinearPatternDefaultName(
  seedLabel: string,
  directionLabel: string
): string {
  return `Linear pattern ${seedLabel} along ${normalizeAxisLabel(directionLabel)}`;
}

export function createCircularPatternDefaultName(
  seedLabel: string,
  axisLabel: string
): string {
  return `Circular pattern ${seedLabel} around ${normalizeAxisLabel(axisLabel)}`;
}

function normalizeAxisLabel(label: string): string {
  return label === "x" || label === "y" || label === "z"
    ? formatPatternAxisLabel(label)
    : label;
}
