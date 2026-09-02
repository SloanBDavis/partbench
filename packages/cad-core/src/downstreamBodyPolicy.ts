import {
  CAD_EXPORT_SOURCE_KIND_BY_BODY_SOURCE_TYPE,
  CAD_V21_EXACT_EXPORT_RESOURCE_LIMITS,
  isPatternedSeedFeatureKind
} from "@web-cad/cad-protocol";
import type {
  BodyId,
  CadBodySnapshot,
  CadBodySource,
  CadCurrentExactResultStatus,
  CadDependencyHealthStatus,
  CadExactBodyShapePolicy,
  CadExactDownstreamOperation,
  CadExactDownstreamReadinessEvidence,
  CadExactResultDiagnostic,
  FeatureId
} from "@web-cad/cad-protocol";
import type { CadDocument } from "./engine";

export const CAD_PATTERN_COMMAND_INSTANCE_LIMIT = 4_096;

const DOWNSTREAM_OPERATION_SHAPE_POLICY = {
  holeTarget: "singleShapeOneOrMoreSolids",
  patternSeed: "singleShapeOneOrMoreSolids",
  mirrorSeed: "singleShapeOneOrMoreSolids",
  shellTarget: "singleSolid"
} as const satisfies Record<
  CadExactDownstreamOperation,
  CadExactBodyShapePolicy
>;

export const CAD_DOWNSTREAM_BODY_OPERATIONS = Object.freeze(
  Object.keys(
    DOWNSTREAM_OPERATION_SHAPE_POLICY
  ) as CadExactDownstreamOperation[]
);

export const CAD_DOWNSTREAM_BODY_POLICY = Object.fromEntries(
  Object.keys(CAD_EXPORT_SOURCE_KIND_BY_BODY_SOURCE_TYPE).map((sourceType) => [
    sourceType,
    DOWNSTREAM_OPERATION_SHAPE_POLICY
  ])
) as Record<
  CadBodySource["type"],
  Record<CadExactDownstreamOperation, CadExactBodyShapePolicy>
>;

export interface CadDownstreamBodyPolicyInput {
  readonly bodyId: BodyId;
  readonly featureId?: FeatureId;
  readonly sourceType: CadBodySource["type"];
  readonly operation: CadExactDownstreamOperation;
  readonly lifecycle: "active" | "consumed";
  readonly dependencyStatus: CadDependencyHealthStatus;
  readonly dependencyCycle: boolean;
  readonly exactStatus?: CadCurrentExactResultStatus;
  readonly shapePolicy?: CadExactBodyShapePolicy;
  readonly diagnostics?: readonly CadExactResultDiagnostic[];
}

export interface CadDownstreamBodyPolicyProjection {
  readonly sourceEligible: boolean;
  readonly readiness: CadExactDownstreamReadinessEvidence;
}

export interface CadBodyDependencyEvaluation {
  readonly status: CadDependencyHealthStatus;
  readonly cycle: boolean;
}

export function evaluateCadBodyDependencies(
  document: Pick<CadDocument, "features">,
  bodies: readonly CadBodySnapshot[],
  rootBodyId: BodyId
): CadBodyDependencyEvaluation {
  const bodyById = new Map(bodies.map((body) => [body.id, body] as const));
  const visited = new Set<BodyId>();
  let bodyId: BodyId | undefined = rootBodyId;

  while (bodyId) {
    if (visited.has(bodyId)) return { status: "missing-source", cycle: true };
    if (
      visited.size >= CAD_V21_EXACT_EXPORT_RESOURCE_LIMITS.maxSourceGraphNodes
    ) {
      return { status: "unsupported", cycle: false };
    }
    visited.add(bodyId);
    const body = bodyById.get(bodyId);
    if (!body) return { status: "missing-source", cycle: false };
    const feature = body.featureId
      ? document.features.get(body.featureId)
      : undefined;
    if (
      (feature?.kind === "linearPattern" ||
        feature?.kind === "circularPattern") &&
      feature.instanceCount > CAD_PATTERN_COMMAND_INSTANCE_LIMIT
    ) {
      return { status: "unsupported", cycle: false };
    }
    bodyId = getDirectBodyDependency(document, body);
  }

  return { status: "healthy", cycle: false };
}

export function createCadDownstreamBodyPolicyProjection(
  input: CadDownstreamBodyPolicyInput
): CadDownstreamBodyPolicyProjection {
  const requiredShapePolicy =
    CAD_DOWNSTREAM_BODY_POLICY[input.sourceType][input.operation];
  const sourceBlocker = createSourceBlocker(input);
  let sourceEligible = true;
  let status = input.exactStatus ?? "pending";
  let diagnostics: readonly CadExactResultDiagnostic[] = [];

  if (sourceBlocker) {
    sourceEligible = false;
    status = sourceBlocker.status;
    diagnostics = [sourceBlocker];
  } else if (status !== "ready") {
    diagnostics =
      input.diagnostics?.filter((diagnostic) => diagnostic.status === status) ??
      [];
    if (diagnostics.length === 0) {
      diagnostics = [
        createDiagnostic(
          input,
          status,
          status === "stale"
            ? "EXPORT_EXACT_SOURCE_STALE"
            : status === "failed"
              ? "EXPORT_EXACT_ARTIFACT_FAILED"
              : status === "unsupported"
                ? "EXPORT_BODY_SOURCE_UNSUPPORTED"
                : "EXPORT_EXACT_SOURCE_UNAVAILABLE",
          `Body ${input.bodyId} is not exact-ready for ${input.operation}.`
        )
      ];
    }
  } else if (!input.shapePolicy) {
    status = "pending";
    diagnostics = [
      createDiagnostic(
        input,
        status,
        "EXPORT_EXACT_SOURCE_UNAVAILABLE",
        `Body ${input.bodyId} has no current exact shape policy.`,
        requiredShapePolicy,
        "missing shape policy"
      )
    ];
  } else if (
    requiredShapePolicy === "singleSolid" &&
    input.shapePolicy !== "singleSolid"
  ) {
    status = "unsupported";
    diagnostics = [
      createDiagnostic(
        input,
        status,
        "SHELL_TARGET_MULTI_SOLID_UNSUPPORTED",
        `Body ${input.bodyId} is multi-solid and cannot be used as a shell target.`,
        requiredShapePolicy,
        input.shapePolicy
      )
    ];
  }

  return {
    sourceEligible,
    readiness: {
      operation: input.operation,
      status,
      requiredShapePolicy,
      ...(input.shapePolicy ? { shapePolicy: input.shapePolicy } : {}),
      diagnostics
    }
  };
}

function getDirectBodyDependency(
  document: Pick<CadDocument, "features">,
  body: CadBodySnapshot
): BodyId | undefined {
  const source = body.source;
  switch (source.type) {
    case "primitiveFeature":
    case "sketchRevolveFeature":
    case "sweepFeature":
    case "loftFeature":
    case "importedStepBody":
      return undefined;
    case "sketchExtrudeFeature": {
      const feature = document.features.get(source.featureId);
      return feature?.kind === "extrude" && feature.targetBodyId
        ? feature.targetBodyId
        : undefined;
    }
    case "sketchHoleFeature":
    case "edgeChamferFeature":
    case "edgeFilletFeature":
    case "shellFeature":
      return source.targetBodyId;
    case "linearPatternFeature":
    case "circularPatternFeature":
      if (source.seedBodyId) return source.seedBodyId;
      if (source.seedFeatureId) {
        const seed = document.features.get(source.seedFeatureId);
        return seed && isPatternedSeedFeatureKind(seed.kind)
          ? seed.bodyId
          : undefined;
      }
      return undefined;
    case "mirrorFeature":
      return source.seedBodyId;
    case "combineFeature":
      return source.targetBodyId;
    case "offsetFeature":
      return source.targetBodyId;
    default: {
      const exhaustive: never = source;
      return exhaustive;
    }
  }
}

function createSourceBlocker(
  input: CadDownstreamBodyPolicyInput
): CadExactResultDiagnostic | undefined {
  if (input.lifecycle === "consumed") {
    return createDiagnostic(
      input,
      "blocked",
      "EXPORT_BODY_CONSUMED",
      `Body ${input.bodyId} is consumed and cannot be used as a downstream operand.`,
      "active body",
      "consumed body"
    );
  }
  if (input.dependencyCycle) {
    return createDiagnostic(
      input,
      "blocked",
      "EXPORT_EXACT_SOURCE_UNAVAILABLE",
      `Body ${input.bodyId} has a dependency cycle.`,
      "acyclic dependencies",
      "dependency cycle"
    );
  }
  if (input.dependencyStatus === "healthy") return undefined;
  const status: Exclude<CadCurrentExactResultStatus, "ready"> =
    input.dependencyStatus === "stale"
      ? "stale"
      : input.dependencyStatus === "unsupported"
        ? "unsupported"
        : "blocked";
  return createDiagnostic(
    input,
    status,
    status === "stale"
      ? "EXPORT_EXACT_SOURCE_STALE"
      : status === "unsupported"
        ? "EXPORT_BODY_SOURCE_UNSUPPORTED"
        : "EXPORT_EXACT_SOURCE_UNAVAILABLE",
    `Body ${input.bodyId} dependency status is ${input.dependencyStatus}.`,
    "healthy dependencies",
    input.dependencyStatus
  );
}

function createDiagnostic(
  input: CadDownstreamBodyPolicyInput,
  status: CadCurrentExactResultStatus,
  code: CadExactResultDiagnostic["code"],
  message: string,
  expected?: string,
  received?: string
): CadExactResultDiagnostic {
  return {
    code,
    status,
    message,
    bodyId: input.bodyId,
    sourceType: input.sourceType,
    ...(input.featureId ? { featureId: input.featureId } : {}),
    ...(expected ? { expected } : {}),
    ...(received ? { received } : {})
  };
}
