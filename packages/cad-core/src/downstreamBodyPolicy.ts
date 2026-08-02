import { CAD_V21_EXACT_EXPORT_RESOURCE_LIMITS } from "@web-cad/cad-protocol";
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

export const CAD_DOWNSTREAM_BODY_POLICY = {
  primitiveFeature: DOWNSTREAM_OPERATION_SHAPE_POLICY,
  sketchExtrudeFeature: DOWNSTREAM_OPERATION_SHAPE_POLICY,
  sketchRevolveFeature: DOWNSTREAM_OPERATION_SHAPE_POLICY,
  sketchHoleFeature: DOWNSTREAM_OPERATION_SHAPE_POLICY,
  edgeChamferFeature: DOWNSTREAM_OPERATION_SHAPE_POLICY,
  edgeFilletFeature: DOWNSTREAM_OPERATION_SHAPE_POLICY,
  linearPatternFeature: DOWNSTREAM_OPERATION_SHAPE_POLICY,
  circularPatternFeature: DOWNSTREAM_OPERATION_SHAPE_POLICY,
  mirrorFeature: DOWNSTREAM_OPERATION_SHAPE_POLICY,
  shellFeature: DOWNSTREAM_OPERATION_SHAPE_POLICY,
  sweepFeature: DOWNSTREAM_OPERATION_SHAPE_POLICY,
  loftFeature: DOWNSTREAM_OPERATION_SHAPE_POLICY,
  importedStepBody: DOWNSTREAM_OPERATION_SHAPE_POLICY
} as const satisfies Record<
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
  const states = new Map<BodyId, "visiting" | "visited">();
  const stack: Array<{
    readonly bodyId: BodyId;
    dependencies?: readonly BodyId[];
    index: number;
  }> = [{ bodyId: rootBodyId, index: 0 }];
  let nodeCount = 0;

  while (stack.length > 0) {
    const frame = stack.at(-1)!;
    if (!frame.dependencies) {
      const body = bodyById.get(frame.bodyId);
      if (!body) return { status: "missing-source", cycle: false };
      nodeCount += 1;
      if (
        nodeCount > CAD_V21_EXACT_EXPORT_RESOURCE_LIMITS.maxSourceGraphNodes
      ) {
        return { status: "unsupported", cycle: false };
      }
      states.set(frame.bodyId, "visiting");
      frame.dependencies = getDirectBodyDependencies(document, body);
    }

    const dependencyId = frame.dependencies[frame.index];
    if (dependencyId === undefined) {
      states.set(frame.bodyId, "visited");
      stack.pop();
      continue;
    }
    frame.index += 1;
    const dependencyState = states.get(dependencyId);
    if (dependencyState === "visiting") {
      return { status: "missing-source", cycle: true };
    }
    if (dependencyState !== "visited") {
      stack.push({ bodyId: dependencyId, index: 0 });
    }
  }

  return { status: "healthy", cycle: false };
}

export function createCadDownstreamBodyPolicyProjection(
  input: CadDownstreamBodyPolicyInput
): CadDownstreamBodyPolicyProjection {
  const requiredShapePolicy =
    CAD_DOWNSTREAM_BODY_POLICY[input.sourceType][input.operation];
  const sourceBlocker = createSourceBlocker(input);
  if (sourceBlocker) {
    return {
      sourceEligible: false,
      readiness: {
        operation: input.operation,
        status: sourceBlocker.status,
        requiredShapePolicy,
        ...(input.shapePolicy ? { shapePolicy: input.shapePolicy } : {}),
        diagnostics: [sourceBlocker]
      }
    };
  }

  const exactStatus = input.exactStatus ?? "pending";
  if (exactStatus !== "ready") {
    const diagnostics = input.diagnostics?.filter(
      (diagnostic) => diagnostic.status === exactStatus
    );
    return {
      sourceEligible: true,
      readiness: {
        operation: input.operation,
        status: exactStatus,
        requiredShapePolicy,
        ...(input.shapePolicy ? { shapePolicy: input.shapePolicy } : {}),
        diagnostics: diagnostics?.length
          ? diagnostics
          : [
              createDiagnostic(
                input,
                exactStatus,
                exactStatus === "stale"
                  ? "EXPORT_EXACT_SOURCE_STALE"
                  : exactStatus === "failed"
                    ? "EXPORT_EXACT_ARTIFACT_FAILED"
                    : exactStatus === "unsupported"
                      ? "EXPORT_BODY_SOURCE_UNSUPPORTED"
                      : "EXPORT_EXACT_SOURCE_UNAVAILABLE",
                `Body ${input.bodyId} is not exact-ready for ${input.operation}.`
              )
            ]
      }
    };
  }

  if (!input.shapePolicy) {
    return {
      sourceEligible: true,
      readiness: {
        operation: input.operation,
        status: "pending",
        requiredShapePolicy,
        diagnostics: [
          createDiagnostic(
            input,
            "pending",
            "EXPORT_EXACT_SOURCE_UNAVAILABLE",
            `Body ${input.bodyId} has no current exact shape policy.`,
            requiredShapePolicy,
            "missing shape policy"
          )
        ]
      }
    };
  }

  if (
    requiredShapePolicy === "singleSolid" &&
    input.shapePolicy !== "singleSolid"
  ) {
    return {
      sourceEligible: true,
      readiness: {
        operation: input.operation,
        status: "unsupported",
        requiredShapePolicy,
        shapePolicy: input.shapePolicy,
        diagnostics: [
          createDiagnostic(
            input,
            "unsupported",
            "SHELL_TARGET_MULTI_SOLID_UNSUPPORTED",
            `Body ${input.bodyId} is multi-solid and cannot be used as a shell target.`,
            requiredShapePolicy,
            input.shapePolicy
          )
        ]
      }
    };
  }

  return {
    sourceEligible: true,
    readiness: {
      operation: input.operation,
      status: "ready",
      requiredShapePolicy,
      shapePolicy: input.shapePolicy,
      diagnostics: []
    }
  };
}

function getDirectBodyDependencies(
  document: Pick<CadDocument, "features">,
  body: CadBodySnapshot
): readonly BodyId[] {
  const source = body.source;
  switch (source.type) {
    case "primitiveFeature":
    case "sketchRevolveFeature":
    case "sweepFeature":
    case "loftFeature":
    case "importedStepBody":
      return [];
    case "sketchExtrudeFeature": {
      const feature = document.features.get(source.featureId);
      return feature?.kind === "extrude" && feature.targetBodyId
        ? [feature.targetBodyId]
        : [];
    }
    case "sketchHoleFeature":
    case "edgeChamferFeature":
    case "edgeFilletFeature":
    case "shellFeature":
      return [source.targetBodyId];
    case "linearPatternFeature":
    case "circularPatternFeature":
    case "mirrorFeature":
      return [source.seedBodyId];
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
