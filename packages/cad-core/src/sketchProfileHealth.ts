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
import { createSketchProfileReadinessResponse } from "./sketchProfilePathQueries";
import { getProfileEntityReferences } from "./normalizedFeatureInputs";
import type { CadDocument } from "./index";

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
  readonly diagnosticCode?: CadFeatureEditDiagnostic["code"];
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
  return (
    entries.find(
      (entry) => entry.featureId === featureId && entry.status !== "ready"
    ) ?? entries.find((entry) => entry.featureId === featureId)
  );
}

export function createFeatureProfileEditDiagnostic(
  entry: SketchProfileHealthEntry
): CadFeatureEditDiagnostic {
  return {
    code: entry.diagnosticCode ?? "FEATURE_EDIT_UNSUPPORTED",
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
  if (
    (feature.kind === "extrude" && feature.profile?.kind === "wire") ||
    ((feature.kind === "extrude" || feature.kind === "revolve") &&
      feature.profile?.kind === "regions")
  ) {
    const sourceEntityIds = getProfileEntityReferences(feature.profile).map(
      (reference) => reference.entityId
    );
    const source = {
      sketchId: feature.profile.sketchId,
      sketchEntityId: sourceEntityIds[0] ?? ""
    };
    if (!document.sketches.has(source.sketchId)) {
      return [
        createEntry(feature, source, {
          status: "missing",
          message: `Feature ${feature.id} source sketch is missing: ${source.sketchId}.`,
          expected:
            feature.profile.kind === "regions"
              ? "feature-ready region profile"
              : "feature-ready composite wire profile",
          received: "missing sketch"
        })
      ];
    }
    const readiness = createSketchProfileReadinessResponse(
      document as CadDocument,
      {
        query: "sketch.profileReadiness",
        profile: feature.profile,
        consumer:
          feature.profile.kind === "wire"
            ? { featureKind: "extrude", operationMode: "newBody" }
            : feature.kind === "extrude"
              ? feature.operationMode === "newBody"
                ? { featureKind: "extrude", operationMode: "newBody" }
                : feature.targetTopologyAnchorId
                  ? {
                      featureKind: "extrude",
                      operationMode: feature.operationMode,
                      targetTopologyAnchorId: feature.targetTopologyAnchorId
                    }
                  : {
                      featureKind: "extrude",
                      operationMode: feature.operationMode,
                      targetBodyId: feature.targetBodyId!
                    }
              : { featureKind: "revolve", operationMode: "newBody" }
      },
      "cadops.v1"
    );
    const diagnostic = readiness.diagnostics.find(
      (candidate) => candidate.severity === "blocker"
    );
    return [
      createEntry(
        feature,
        {
          ...source,
          sketchEntityId: diagnostic?.entityId ?? source.sketchEntityId
        },
        {
          status: readiness.status === "ready" ? "ready" : "stale",
          profileValidityStatus:
            readiness.status === "ready" ? "valid" : "invalid",
          diagnosticCode:
            feature.profile.kind === "regions"
              ? getRegionFeatureEditDiagnosticCode(diagnostic?.code)
              : undefined,
          message:
            readiness.status === "ready"
              ? `Feature ${feature.id} ${feature.profile.kind === "regions" ? "region" : "composite wire"} profile is feature-ready.`
              : (diagnostic?.message ??
                `Feature ${feature.id} ${feature.profile.kind === "regions" ? "region" : "composite wire"} profile is not feature-ready.`),
          expected:
            feature.profile.kind === "regions"
              ? "feature-ready region profile"
              : "feature-ready composite wire profile",
          received:
            readiness.status === "ready"
              ? "feature-ready"
              : (diagnostic?.code ?? "blocked")
        }
      )
    ];
  }
  return getFeatureProfileSources(feature).flatMap((source) =>
    createFeatureProfileSourceHealthEntry(document, feature, source)
  );
}

function createFeatureProfileSourceHealthEntry(
  document: SketchProfileHealthDocument,
  feature: CadFeatureSummary,
  source: {
    readonly sketchId: SketchId;
    readonly sketchEntityId: SketchEntityId;
  }
): readonly SketchProfileHealthEntry[] {
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

  if (entity.construction) {
    return [
      createEntry(feature, source, {
        status: "stale",
        profileValidityStatus: "invalid",
        message: `Feature ${feature.id} source profile is construction geometry; downstream rebuild/reference health is not command-ready.`,
        expected: "non-construction feature-ready source sketch profile",
        received: "construction geometry"
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

function getFeatureProfileSources(feature: CadFeatureSummary): readonly {
  readonly sketchId: SketchId;
  readonly sketchEntityId: SketchEntityId;
}[] {
  if (feature.kind === "extrude" || feature.kind === "revolve") {
    return feature.entityId
      ? [{ sketchId: feature.sketchId, sketchEntityId: feature.entityId }]
      : [];
  }

  if (feature.kind === "hole") {
    return [
      {
        sketchId: feature.sketchId,
        sketchEntityId: feature.circleEntityId
      }
    ];
  }

  if (feature.kind === "sweep") {
    return [
      {
        sketchId: feature.profileSketchId,
        sketchEntityId: feature.profileEntityId
      }
    ];
  }

  if (feature.kind === "loft") {
    return feature.sections.map((section) => ({
      sketchId: section.sketchId,
      sketchEntityId: section.entityId
    }));
  }

  return [];
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
    readonly diagnosticCode?: CadFeatureEditDiagnostic["code"];
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

function getRegionFeatureEditDiagnosticCode(
  code: string | undefined
): CadFeatureEditDiagnostic["code"] | undefined {
  switch (code) {
    case "SKETCH_REGION_LOOP_OPEN":
    case "SKETCH_REGION_LOOP_INTERSECTION":
    case "SKETCH_REGION_BOUNDARY_TOUCHING":
    case "SKETCH_REGION_HOLE_OUTSIDE":
    case "SKETCH_REGION_HOLES_OVERLAP":
    case "SKETCH_REGION_MATERIAL_OVERLAP":
    case "SKETCH_REGION_NESTING_UNSUPPORTED":
    case "SKETCH_REGION_COMPLEXITY_LIMIT":
    case "SKETCH_REGION_CONSUMER_UNSUPPORTED":
    case "SKETCH_REGION_RESULT_NOT_SINGLE_SOLID":
      return code;
    default:
      return undefined;
  }
}
