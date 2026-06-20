import type {
  BodyId,
  CadBodyLifecycleEffectSummary,
  CadFeatureEditDiagnostic,
  CadFeatureSummary,
  FeatureId,
  SketchEntityId,
  SketchId
} from "@web-cad/cad-protocol";

import { createSketchProfileValidityFromSource } from "./sketchSolverStatus";
import type { SketchSolverDocument, SketchSolverSketch } from "./sketchSolver";

export type SketchProfileHealthStatus =
  | "ready"
  | "stale"
  | "unsupported"
  | "missing";

export interface SketchProfileHealthEntry {
  readonly featureId: FeatureId;
  readonly bodyId: BodyId;
  readonly sketchId: SketchId;
  readonly sketchEntityId: SketchEntityId;
  readonly status: SketchProfileHealthStatus;
  readonly featureKind: CadFeatureSummary["kind"];
  readonly profileValidityStatus?: string;
  readonly message: string;
  readonly expected: string;
  readonly received: string;
}

export interface CreateSketchProfileHealthOptions {
  readonly document: SketchProfileHealthDocument;
  readonly features: readonly CadFeatureSummary[];
}

export interface SketchProfileHealthDocument extends SketchSolverDocument {
  readonly sketches: ReadonlyMap<SketchId, SketchSolverSketch>;
}

export function createSketchProfileHealthEntries({
  document,
  features
}: CreateSketchProfileHealthOptions): readonly SketchProfileHealthEntry[] {
  return features.flatMap((feature) =>
    createFeatureProfileHealthEntry(document, feature)
  );
}

export function createSketchProfileLifecycleEffects(
  entries: readonly SketchProfileHealthEntry[]
): readonly CadBodyLifecycleEffectSummary[] {
  return entries
    .filter((entry) => entry.status !== "ready")
    .map((entry) => ({
      bodyId: entry.bodyId,
      featureId: entry.featureId,
      primaryState: entry.status === "unsupported" ? "unsupported" : "stale",
      states: [
        entry.status === "unsupported" ? "unsupported" : "stale"
      ] as const,
      diagnosticCode:
        entry.status === "unsupported"
          ? "REBUILD_BODY_UNSUPPORTED"
          : "REBUILD_SOURCE_STALE",
      message: entry.message
    }));
}

export function findSketchProfileHealthEntry(
  entries: readonly SketchProfileHealthEntry[],
  featureId: FeatureId
): SketchProfileHealthEntry | undefined {
  return entries.find((entry) => entry.featureId === featureId);
}

export function createFeatureProfileEditDiagnostic(
  entry: SketchProfileHealthEntry
): CadFeatureEditDiagnostic {
  return {
    code: "FEATURE_EDIT_UNSUPPORTED",
    severity: "blocker",
    message: entry.message,
    featureId: entry.featureId,
    bodyId: entry.bodyId,
    sketchId: entry.sketchId,
    sketchEntityId: entry.sketchEntityId,
    expected: entry.expected,
    received: entry.received
  };
}

function createFeatureProfileHealthEntry(
  document: SketchProfileHealthDocument,
  feature: CadFeatureSummary
): readonly SketchProfileHealthEntry[] {
  const source = getFeatureProfileSource(feature);

  if (!source) {
    return [];
  }

  const sketch = document.sketches.get(source.sketchId);

  if (!sketch) {
    return [
      createEntry(feature, source, {
        status: "missing",
        message: `Feature ${feature.id} source sketch is missing: ${source.sketchId}.`,
        expected: "feature-ready source sketch",
        received: "missing sketch"
      })
    ];
  }

  const entity = sketch.entities.get(source.sketchEntityId);

  if (!entity) {
    return [
      createEntry(feature, source, {
        status: "missing",
        message: `Feature ${feature.id} source sketch entity is missing: ${source.sketchEntityId}.`,
        expected: "feature-ready source sketch entity",
        received: "missing sketch entity"
      })
    ];
  }

  const profileValidity = createSketchProfileValidityFromSource({
    document,
    sketch
  });
  const candidate = profileValidity.profiles.find(
    (profile) => profile.entityId === source.sketchEntityId
  );

  if (candidate?.featureReady) {
    return [
      createEntry(feature, source, {
        status: "ready",
        profileValidityStatus: profileValidity.status,
        message: `Feature ${feature.id} source profile is feature-ready.`,
        expected: "feature-ready source sketch profile",
        received: "feature-ready"
      })
    ];
  }

  const status =
    profileValidity.status === "invalid"
      ? "stale"
      : profileValidity.status === "unsupported"
        ? "unsupported"
        : "stale";

  return [
    createEntry(feature, source, {
      status,
      profileValidityStatus: profileValidity.status,
      message: `Feature ${feature.id} source profile is ${profileValidity.status}; downstream rebuild/reference health is not command-ready.`,
      expected: "feature-ready source sketch profile",
      received: candidate
        ? `${profileValidity.status}:${candidate.profileKind}`
        : profileValidity.status
    })
  ];
}

function getFeatureProfileSource(feature: CadFeatureSummary):
  | {
      readonly sketchId: SketchId;
      readonly sketchEntityId: SketchEntityId;
    }
  | undefined {
  if (feature.kind === "extrude" || feature.kind === "revolve") {
    return { sketchId: feature.sketchId, sketchEntityId: feature.entityId };
  }

  if (feature.kind === "hole") {
    return {
      sketchId: feature.sketchId,
      sketchEntityId: feature.circleEntityId
    };
  }

  return undefined;
}

function createEntry(
  feature: CadFeatureSummary,
  source: {
    readonly sketchId: SketchId;
    readonly sketchEntityId: SketchEntityId;
  },
  values: {
    readonly status: SketchProfileHealthStatus;
    readonly profileValidityStatus?: string;
    readonly message: string;
    readonly expected: string;
    readonly received: string;
  }
): SketchProfileHealthEntry {
  return {
    featureId: feature.id,
    bodyId: feature.bodyId,
    featureKind: feature.kind,
    sketchId: source.sketchId,
    sketchEntityId: source.sketchEntityId,
    ...values
  };
}
