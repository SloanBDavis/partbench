import type {
  CadBodySnapshot,
  CadDependencyHealthStatus,
  CadFeatureSummary,
  CadPartSnapshot,
  NamedGeneratedReferenceEntry,
  ProjectHealthQueryResponse,
  SketchSnapshot
} from "@web-cad/cad-protocol";
import type { DocumentUnits } from "@web-cad/cad-core";

export interface StructureHealthDisplay {
  readonly label: string;
  readonly className: string;
}

export interface StructureTreeSummary {
  readonly partCount: number;
  readonly sketchCount: number;
  readonly authoredFeatureCount: number;
  readonly generatedBodyCount: number;
  readonly namedReferenceCount: number;
  readonly issueCount: number;
  readonly status: CadDependencyHealthStatus;
}

export function createStructureTreeSummary(input: {
  readonly parts: readonly CadPartSnapshot[];
  readonly sketches: readonly SketchSnapshot[];
  readonly features: readonly CadFeatureSummary[];
  readonly bodies: readonly CadBodySnapshot[];
  readonly namedReferences: readonly NamedGeneratedReferenceEntry[];
  readonly health: ProjectHealthQueryResponse;
}): StructureTreeSummary {
  return {
    partCount: input.parts.length,
    sketchCount: input.sketches.length,
    authoredFeatureCount: input.features.filter(
      (feature) => feature.kind === "extrude"
    ).length,
    generatedBodyCount: input.bodies.filter(
      (body) => body.source.type === "sketchExtrudeFeature"
    ).length,
    namedReferenceCount: input.namedReferences.length,
    issueCount: input.health.issueCount,
    status: input.health.status
  };
}

export function formatHealthStatus(
  status: CadDependencyHealthStatus
): StructureHealthDisplay {
  switch (status) {
    case "healthy":
      return { label: "Healthy", className: "health-healthy" };
    case "stale":
      return { label: "Stale", className: "health-stale" };
    case "missing-source":
      return { label: "Missing source", className: "health-missing-source" };
    case "unsupported":
      return { label: "Unsupported", className: "health-unsupported" };
  }
}

export function getSketchHealthStatus(
  health: ProjectHealthQueryResponse,
  sketchId: string
): CadDependencyHealthStatus | undefined {
  const attachedSketch = health.attachedSketches.find(
    (entry) => entry.sketchId === sketchId
  );

  if (attachedSketch) {
    return attachedSketch.status;
  }

  const dependentFeatureStatuses = health.authoredExtrudes
    .filter((entry) => entry.sketchId === sketchId)
    .map((entry) => entry.status);

  return combineHealthStatuses(dependentFeatureStatuses);
}

export function getFeatureHealthStatus(
  health: ProjectHealthQueryResponse,
  featureId: string
): CadDependencyHealthStatus | undefined {
  return health.authoredExtrudes.find((entry) => entry.featureId === featureId)
    ?.status;
}

export function getBodyHealthStatus(
  health: ProjectHealthQueryResponse,
  bodyId: string
): CadDependencyHealthStatus | undefined {
  return health.authoredExtrudes.find((entry) => entry.bodyId === bodyId)
    ?.status;
}

export function getNamedReferenceHealthStatus(
  health: ProjectHealthQueryResponse,
  name: string
): CadDependencyHealthStatus | undefined {
  return health.namedReferences.find((entry) => entry.name === name)?.status;
}

export function getHealthIssues(
  health: ProjectHealthQueryResponse,
  target:
    | { readonly kind: "feature"; readonly id: string }
    | { readonly kind: "sketch"; readonly id: string }
    | { readonly kind: "body"; readonly id: string }
    | { readonly kind: "namedReference"; readonly name: string }
): readonly string[] {
  if (target.kind === "feature") {
    return (
      health.authoredExtrudes
        .find((entry) => entry.featureId === target.id)
        ?.issues.map((issue) => issue.message) ?? []
    );
  }

  if (target.kind === "body") {
    return (
      health.authoredExtrudes
        .find((entry) => entry.bodyId === target.id)
        ?.issues.map((issue) => issue.message) ?? []
    );
  }

  if (target.kind === "namedReference") {
    return (
      health.namedReferences
        .find((entry) => entry.name === target.name)
        ?.issues.map((issue) => issue.message) ?? []
    );
  }

  const attachedIssues =
    health.attachedSketches.find((entry) => entry.sketchId === target.id)
      ?.issues ?? [];
  const featureIssues = health.authoredExtrudes
    .filter((entry) => entry.sketchId === target.id)
    .flatMap((entry) => entry.issues);

  return [...attachedIssues, ...featureIssues].map((issue) => issue.message);
}

export function formatFeatureLine(
  feature: Extract<CadFeatureSummary, { kind: "extrude" }>,
  units: DocumentUnits
): string {
  return `${feature.profileKind} / ${feature.depth} ${units} / ${feature.side}`;
}

export function formatPartLine(part: CadPartSnapshot): string {
  return `${part.sketchIds.length} sketches / ${part.featureIds.length} features / ${part.bodyIds.length} bodies`;
}

function combineHealthStatuses(
  statuses: readonly CadDependencyHealthStatus[]
): CadDependencyHealthStatus | undefined {
  if (statuses.length === 0) {
    return undefined;
  }

  if (statuses.includes("missing-source")) {
    return "missing-source";
  }

  if (statuses.includes("stale")) {
    return "stale";
  }

  if (statuses.includes("unsupported")) {
    return "unsupported";
  }

  return "healthy";
}
