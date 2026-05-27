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

export type AuthoredStructureFeature = Extract<
  CadFeatureSummary,
  { readonly kind: "extrude" | "revolve" | "hole" }
>;

export function isAuthoredStructureFeature(
  feature: CadFeatureSummary
): feature is AuthoredStructureFeature {
  return (
    feature.kind === "extrude" ||
    feature.kind === "revolve" ||
    feature.kind === "hole"
  );
}

export function isAuthoredStructureBody(body: CadBodySnapshot): boolean {
  return (
    body.source.type === "sketchExtrudeFeature" ||
    body.source.type === "sketchRevolveFeature" ||
    body.source.type === "sketchHoleFeature"
  );
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
    authoredFeatureCount: input.features.filter(isAuthoredStructureFeature)
      .length,
    generatedBodyCount: input.bodies.filter(isAuthoredStructureBody).length,
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
    case "under-defined":
      return { label: "Under-defined", className: "health-under-defined" };
    case "over-defined":
      return { label: "Over-defined", className: "health-over-defined" };
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

  const dependentFeatureStatuses = health.authoredExtrudes
    .filter((entry) => entry.sketchId === sketchId)
    .map((entry) => entry.status);
  const dependentRevolveStatuses = health.authoredRevolves
    .filter((entry) => entry.sketchId === sketchId)
    .map((entry) => entry.status);
  const dependentHoleStatuses = health.authoredHoles
    .filter((entry) => entry.sketchId === sketchId)
    .map((entry) => entry.status);
  const evaluationStatuses = health.sketchEvaluations
    .filter((entry) => entry.sketchId === sketchId)
    .map((entry) => entry.status);
  const dimensionStatuses = health.sketchDimensions
    .filter((entry) => entry.sketchId === sketchId)
    .map((entry) => entry.status);
  const constraintStatuses = health.sketchConstraints
    .filter((entry) => entry.sketchId === sketchId)
    .map((entry) => entry.status);

  return combineHealthStatuses([
    ...(attachedSketch ? [attachedSketch.status] : []),
    ...dependentFeatureStatuses,
    ...dependentRevolveStatuses,
    ...dependentHoleStatuses,
    ...evaluationStatuses,
    ...dimensionStatuses,
    ...constraintStatuses
  ]);
}

export function getFeatureHealthStatus(
  health: ProjectHealthQueryResponse,
  featureId: string
): CadDependencyHealthStatus | undefined {
  return combineHealthStatuses([
    ...health.authoredExtrudes
      .filter((entry) => entry.featureId === featureId)
      .map((entry) => entry.status),
    ...health.authoredRevolves
      .filter((entry) => entry.featureId === featureId)
      .map((entry) => entry.status),
    ...health.authoredHoles
      .filter((entry) => entry.featureId === featureId)
      .map((entry) => entry.status),
    ...health.sketchEvaluations
      .filter((entry) => entry.affectedFeatureIds.includes(featureId))
      .map((entry) => entry.status),
    ...health.sketchDimensions
      .filter((entry) => entry.affectedFeatureIds.includes(featureId))
      .map((entry) => entry.status),
    ...health.sketchConstraints
      .filter((entry) => entry.affectedFeatureIds.includes(featureId))
      .map((entry) => entry.status)
  ]);
}

export function getBodyHealthStatus(
  health: ProjectHealthQueryResponse,
  bodyId: string
): CadDependencyHealthStatus | undefined {
  return combineHealthStatuses([
    ...health.authoredExtrudes
      .filter((entry) => entry.bodyId === bodyId)
      .map((entry) => entry.status),
    ...health.authoredRevolves
      .filter((entry) => entry.bodyId === bodyId)
      .map((entry) => entry.status),
    ...health.authoredHoles
      .filter((entry) => entry.bodyId === bodyId)
      .map((entry) => entry.status),
    ...health.sketchEvaluations
      .filter((entry) => entry.affectedBodyIds.includes(bodyId))
      .map((entry) => entry.status),
    ...health.sketchDimensions
      .filter((entry) => entry.affectedBodyIds.includes(bodyId))
      .map((entry) => entry.status),
    ...health.sketchConstraints
      .filter((entry) => entry.affectedBodyIds.includes(bodyId))
      .map((entry) => entry.status)
  ]);
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
    const featureIssues =
      health.authoredExtrudes
        .find((entry) => entry.featureId === target.id)
        ?.issues.map((issue) => issue.message) ?? [];
    const revolveIssues =
      health.authoredRevolves
        .find((entry) => entry.featureId === target.id)
        ?.issues.map((issue) => issue.message) ?? [];
    const holeIssues =
      health.authoredHoles
        .find((entry) => entry.featureId === target.id)
        ?.issues.map((issue) => issue.message) ?? [];
    const dimensionIssues = health.sketchDimensions
      .filter((entry) => entry.affectedFeatureIds.includes(target.id))
      .flatMap((entry) => entry.issues.map((issue) => issue.message));
    const constraintIssues = health.sketchConstraints
      .filter((entry) => entry.affectedFeatureIds.includes(target.id))
      .flatMap((entry) => entry.issues.map((issue) => issue.message));
    const evaluationIssues = health.sketchEvaluations
      .filter((entry) => entry.affectedFeatureIds.includes(target.id))
      .flatMap((entry) => entry.issues.map((issue) => issue.message));

    return [
      ...featureIssues,
      ...revolveIssues,
      ...holeIssues,
      ...evaluationIssues,
      ...dimensionIssues,
      ...constraintIssues
    ];
  }

  if (target.kind === "body") {
    const bodyIssues =
      health.authoredExtrudes
        .find((entry) => entry.bodyId === target.id)
        ?.issues.map((issue) => issue.message) ?? [];
    const revolveIssues =
      health.authoredRevolves
        .find((entry) => entry.bodyId === target.id)
        ?.issues.map((issue) => issue.message) ?? [];
    const holeIssues =
      health.authoredHoles
        .find((entry) => entry.bodyId === target.id)
        ?.issues.map((issue) => issue.message) ?? [];
    const dimensionIssues = health.sketchDimensions
      .filter((entry) => entry.affectedBodyIds.includes(target.id))
      .flatMap((entry) => entry.issues.map((issue) => issue.message));
    const constraintIssues = health.sketchConstraints
      .filter((entry) => entry.affectedBodyIds.includes(target.id))
      .flatMap((entry) => entry.issues.map((issue) => issue.message));
    const evaluationIssues = health.sketchEvaluations
      .filter((entry) => entry.affectedBodyIds.includes(target.id))
      .flatMap((entry) => entry.issues.map((issue) => issue.message));

    return [
      ...bodyIssues,
      ...revolveIssues,
      ...holeIssues,
      ...evaluationIssues,
      ...dimensionIssues,
      ...constraintIssues
    ];
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
  const revolveIssues = health.authoredRevolves
    .filter((entry) => entry.sketchId === target.id)
    .flatMap((entry) => entry.issues);
  const holeIssues = health.authoredHoles
    .filter((entry) => entry.sketchId === target.id)
    .flatMap((entry) => entry.issues);
  const evaluationIssues = health.sketchEvaluations
    .filter((entry) => entry.sketchId === target.id)
    .flatMap((entry) => entry.issues);
  const dimensionIssues = health.sketchDimensions
    .filter((entry) => entry.sketchId === target.id)
    .flatMap((entry) => entry.issues);
  const constraintIssues = health.sketchConstraints
    .filter((entry) => entry.sketchId === target.id)
    .flatMap((entry) => entry.issues);

  return [
    ...attachedIssues,
    ...featureIssues,
    ...revolveIssues,
    ...holeIssues,
    ...evaluationIssues,
    ...dimensionIssues,
    ...constraintIssues
  ].map((issue) => issue.message);
}

export function formatFeatureLine(
  feature: AuthoredStructureFeature,
  units: DocumentUnits
): string {
  if (feature.kind === "revolve") {
    const target =
      feature.operationMode !== "newBody" && feature.targetBodyId
        ? ` / target ${feature.targetBodyId}`
        : "";

    return `${formatRevolveOperationMode(feature.operationMode)} / ${feature.profileKind} / ${feature.angleDegrees} deg / axis ${feature.axis.entityId}${target}`;
  }

  if (feature.kind === "hole") {
    const depth =
      feature.depthMode === "blind"
        ? `${feature.depth} ${units}`
        : "through all";

    return `hole / circle / ${depth} / ${feature.direction} / target ${feature.targetBodyId}`;
  }

  const target =
    (feature.operationMode === "add" || feature.operationMode === "cut") &&
    feature.targetBodyId
      ? ` / target ${feature.targetBodyId}`
      : "";

  return `${formatExtrudeOperationMode(feature.operationMode)} / ${feature.profileKind} / ${feature.depth} ${units} / ${feature.side}${target}`;
}

export function formatFeatureSourceLine(
  feature: AuthoredStructureFeature
): string {
  const entityId =
    feature.kind === "hole" ? feature.circleEntityId : feature.entityId;

  return `Sketch ${feature.sketchId} / entity ${entityId}`;
}

export function formatBodyRole(
  body: CadBodySnapshot,
  feature: AuthoredStructureFeature | undefined
): string {
  if (body.consumedByFeatureId) {
    return "Consumed target";
  }

  if (feature?.kind === "extrude" && feature.operationMode === "add") {
    return "Add result";
  }

  if (feature?.kind === "extrude" && feature.operationMode === "cut") {
    return "Cut result";
  }

  if (feature?.kind === "hole") {
    return "Hole result";
  }

  return "Generated body";
}

export function formatBodyStatusLine(
  body: CadBodySnapshot,
  feature: AuthoredStructureFeature | undefined
): string {
  if (body.consumedByFeatureId) {
    return `Consumed by ${body.consumedByFeatureId}`;
  }

  if (
    feature?.kind === "extrude" &&
    (feature?.operationMode === "add" || feature?.operationMode === "cut") &&
    feature.targetBodyId
  ) {
    return feature.operationMode === "add"
      ? `Adds to ${feature.targetBodyId}`
      : `Cuts ${feature.targetBodyId}`;
  }

  if (feature?.kind === "hole") {
    return `Holes ${feature.targetBodyId}`;
  }

  return `Feature ${body.featureId}`;
}

export function formatFeatureKindLabel(
  feature: AuthoredStructureFeature
): string {
  if (feature.kind === "extrude") {
    return "Extrude";
  }

  if (feature.kind === "revolve") {
    return "Revolve";
  }

  return "Hole";
}

export function formatExtrudeOperationMode(
  operationMode: Extract<
    CadFeatureSummary,
    { readonly kind: "extrude" }
  >["operationMode"]
): string {
  if (operationMode === "newBody") {
    return "new body";
  }

  if (operationMode === "cut") {
    return "cut body";
  }

  if (operationMode === "add") {
    return "add to body";
  }

  return operationMode;
}

export function formatRevolveOperationMode(
  operationMode: Extract<
    CadFeatureSummary,
    { readonly kind: "revolve" }
  >["operationMode"]
): string {
  if (operationMode === "newBody") {
    return "new body";
  }

  return operationMode;
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

  if (statuses.includes("over-defined")) {
    return "over-defined";
  }

  if (statuses.includes("under-defined")) {
    return "under-defined";
  }

  return "healthy";
}
