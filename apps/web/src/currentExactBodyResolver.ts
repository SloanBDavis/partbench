import {
  decodeWcadCanonicalCbor,
  resolveMirrorPlaneFrame,
  resolvePatternDirectionFrame,
  resolvePatternRotationAxisFrame,
  sha256Hex,
  type CadDocument,
  type CadFeatureSummary,
  type WcadTopologyCheckpointPayloadInput
} from "@web-cad/cad-core";
import {
  CAD_V21_EXACT_EXPORT_RESOURCE_LIMITS,
  type CadBodySnapshot,
  type CadBodySource,
  type CadCurrentExactResultStatus,
  type CadExactResultDiagnostic,
  type FeatureShellOpenFaceRef
} from "@web-cad/cad-protocol";

import type {
  DerivedBooleanExtrudeGeometrySource,
  DerivedExtrudeGeometrySource,
  DerivedExactBodyGeometrySource,
  DerivedGeometrySource,
  DerivedHoleGeometrySource,
  DerivedPrimitiveGeometrySource
} from "./derivedGeometry";
import {
  createDerivedExactMetadataCacheKey,
  createExactMetadataRuntimeInput,
  isExactMetadataSource,
  type DerivedExactMetadataSource,
  type DerivedImportedBodyExactMetadataSource
} from "./derivedExactMetadata";
import { createBooleanExtrudeRuntimeSource } from "./booleanExtrudeRuntimeSource";
import type {
  ExactBodyArtifactLeaf,
  ExactBodyArtifactShapePolicy,
  ExactBodyArtifactSource,
  GeometryKernelExactBodyArtifact
} from "@web-cad/geometry-worker";

export type CurrentExactBodySource =
  | DerivedExactMetadataSource
  | CurrentExactArtifactOperationSource
  | CurrentExactCheckpointBooleanSource
  | CurrentExactCheckpointHoleSource
  | CurrentExactCheckpointEdgeFinishSource;

export type CurrentExactArtifactOperationSource =
  | {
      readonly id: string;
      readonly kind: "linearPattern";
      readonly direction: readonly [number, number, number];
      readonly spacing: number;
      readonly instanceCount: number;
      readonly sourceIdentitySignature: string;
    }
  | {
      readonly id: string;
      readonly kind: "circularPattern";
      readonly axis: {
        readonly origin: readonly [number, number, number];
        readonly direction: readonly [number, number, number];
      };
      readonly totalAngleDegrees: number;
      readonly instanceCount: number;
      readonly sourceIdentitySignature: string;
    }
  | {
      readonly id: string;
      readonly kind: "mirror";
      readonly plane: {
        readonly point: readonly [number, number, number];
        readonly normal: readonly [number, number, number];
      };
      readonly includeOriginal: boolean;
      readonly sourceIdentitySignature: string;
    }
  | {
      readonly id: string;
      readonly kind: "shell";
      readonly wallThickness: number;
      readonly openFaceRefs: readonly FeatureShellOpenFaceRef[];
      readonly sourceIdentitySignature: string;
    };

export interface CurrentExactCheckpointBooleanSource {
  readonly id: string;
  readonly kind: "checkpointBoolean";
  readonly operation: "add" | "cut";
  readonly target: DerivedImportedBodyExactMetadataSource;
  readonly tool:
    | DerivedExtrudeGeometrySource
    | DerivedBooleanExtrudeGeometrySource;
  readonly sourceIdentitySignature: string;
}

export interface CurrentExactCheckpointEdgeFinishSource {
  readonly id: string;
  readonly kind: "checkpointEdgeFinish";
  readonly operation: "chamfer" | "fillet";
  readonly target: DerivedImportedBodyExactMetadataSource;
  readonly edgeReference: {
    readonly kind: "topologyAnchor";
    readonly anchorId: string;
    readonly checkpointEntityId: string;
    readonly stableId?: string;
  };
  readonly amount: number;
  readonly sourceIdentitySignature: string;
}

export interface CurrentExactCheckpointHoleSource {
  readonly id: string;
  readonly kind: "checkpointHole";
  readonly target: DerivedImportedBodyExactMetadataSource;
  readonly tool: DerivedHoleGeometrySource["tool"];
  readonly sourceIdentitySignature: string;
}

export type CurrentExactBodyResolution =
  | {
      readonly status: "ready";
      readonly bodyId: string;
      readonly sourceType: CadBodySource["type"];
      readonly sourceIdentitySignature: string;
      readonly cacheKeySha256: string;
      readonly sourceGraphNodeCount: number;
      readonly source: CurrentExactBodySource;
      readonly artifactDependency?: CurrentExactBodyArtifactDependency;
      readonly diagnostics: readonly CadExactResultDiagnostic[];
    }
  | {
      readonly status: Exclude<CadCurrentExactResultStatus, "ready">;
      readonly bodyId: string;
      readonly sourceType: CadBodySource["type"];
      readonly diagnostics: readonly CadExactResultDiagnostic[];
    };

export interface CurrentExactBodyArtifactDependency {
  readonly bodyId: string;
  readonly sourceType: CadBodySource["type"];
  readonly sourceIdentitySignature: string;
  readonly cacheKeySha256: string;
  readonly sourceGraphNodeCount: number;
  readonly source: CurrentExactBodySource;
  readonly artifactDependency?: CurrentExactBodyArtifactDependency;
}

export type CurrentExactBodyArtifactEvidence = Pick<
  GeometryKernelExactBodyArtifact,
  | "artifactVersion"
  | "bodyId"
  | "sourceType"
  | "documentSourceIdentity"
  | "bodySourceIdentitySignature"
  | "sourceCacheKeySha256"
  | "sourceGraphNodeCount"
  | "units"
  | "shapePolicy"
  | "sourceKind"
  | "brepFormat"
  | "brepWriter"
  | "brepBytes"
  | "brepByteLength"
  | "brepSha256"
  | "topologySnapshot"
  | "metadata"
  | "displayMesh"
>;

export interface CurrentExactBodyResolverInput {
  readonly document: CadDocument;
  readonly bodies: readonly CadBodySnapshot[];
  readonly features: readonly CadFeatureSummary[];
  readonly geometrySources: readonly DerivedGeometrySource[];
  readonly artifactGeometrySources?: readonly DerivedGeometrySource[];
  readonly checkpointPayloads?: readonly WcadTopologyCheckpointPayloadInput[];
  readonly sourceIdentitySignaturesByBodyId: ReadonlyMap<string, string>;
}

interface ResolverContext extends CurrentExactBodyResolverInput {
  readonly bodiesById: ReadonlyMap<string, CadBodySnapshot>;
  readonly featuresById: ReadonlyMap<string, CadFeatureSummary>;
  readonly geometrySourcesById: ReadonlyMap<string, DerivedGeometrySource>;
  readonly artifactGeometrySourcesById: ReadonlyMap<
    string,
    DerivedGeometrySource
  >;
  readonly duplicateBodyIds: ReadonlySet<string>;
  readonly duplicateFeatureBodyIds: ReadonlySet<string>;
  readonly duplicateGeometrySourceIds: ReadonlySet<string>;
  readonly duplicateArtifactGeometrySourceIds: ReadonlySet<string>;
}

type BodySourceResolver = (
  body: CadBodySnapshot,
  context: ResolverContext,
  sourceIdentitySignature: string
) => CurrentExactBodySource | CurrentExactBodyResolution;

interface BodySourceResolverDefinition {
  readonly featureKind: CadFeatureSummary["kind"];
  readonly resolve: BodySourceResolver;
}

const BODY_SOURCE_RESOLVERS = {
  primitiveFeature: {
    featureKind: "primitive",
    resolve: resolvePrimitiveSource
  },
  sketchExtrudeFeature: {
    featureKind: "extrude",
    resolve: resolveExtrudeSource
  },
  sketchRevolveFeature: {
    featureKind: "revolve",
    resolve: resolveLegacyRuntimeSource
  },
  sketchHoleFeature: { featureKind: "hole", resolve: resolveHoleSource },
  edgeChamferFeature: {
    featureKind: "chamfer",
    resolve: resolveEdgeFinishSource
  },
  edgeFilletFeature: {
    featureKind: "fillet",
    resolve: resolveEdgeFinishSource
  },
  linearPatternFeature: {
    featureKind: "linearPattern",
    resolve: resolveArtifactOperationSource
  },
  circularPatternFeature: {
    featureKind: "circularPattern",
    resolve: resolveArtifactOperationSource
  },
  mirrorFeature: {
    featureKind: "mirror",
    resolve: resolveArtifactOperationSource
  },
  shellFeature: {
    featureKind: "shell",
    resolve: resolveArtifactOperationSource
  },
  sweepFeature: { featureKind: "sweep", resolve: resolveLegacyRuntimeSource },
  loftFeature: { featureKind: "loft", resolve: resolveLegacyRuntimeSource },
  importedStepBody: {
    featureKind: "importedBody",
    resolve: resolveImportedSource
  }
} satisfies Record<CadBodySource["type"], BodySourceResolverDefinition>;

export function resolveCurrentExactBodies(
  input: CurrentExactBodyResolverInput
): readonly CurrentExactBodyResolution[] {
  const bodyIndex = createUniqueIndex(input.bodies, (body) => body.id);
  const featureBodyIndex = createUniqueIndex(
    input.features,
    (feature) => feature.bodyId
  );
  const featureIndex = createUniqueIndex(
    input.features,
    (feature) => feature.id
  );
  const geometryIndex = createUniqueIndex(
    input.geometrySources,
    (source) => source.id
  );
  const artifactGeometryIndex = createUniqueIndex(
    input.artifactGeometrySources ?? input.geometrySources,
    (source) => source.id
  );
  const context: ResolverContext = {
    ...input,
    bodiesById: bodyIndex.values,
    featuresById: featureIndex.values,
    geometrySourcesById: geometryIndex.values,
    artifactGeometrySourcesById: artifactGeometryIndex.values,
    duplicateBodyIds: bodyIndex.duplicates,
    duplicateFeatureBodyIds: featureBodyIndex.duplicates,
    duplicateGeometrySourceIds: geometryIndex.duplicates,
    duplicateArtifactGeometrySourceIds: artifactGeometryIndex.duplicates
  };

  return [...input.bodies]
    .sort(compareBodyId)
    .map((body) => resolveCurrentExactBody(body, context));
}

export function getReadyRuntimeExactSources(
  resolutions: readonly CurrentExactBodyResolution[]
): readonly DerivedExactMetadataSource[] {
  return resolutions.flatMap((resolution) => {
    if (resolution.status !== "ready") return [];
    if (isArtifactOperationSource(resolution.source)) return [];
    if (
      isExactMetadataSource(resolution.source) &&
      resolution.source.kind !== "importedBody"
    ) {
      return [resolution.source];
    }
    return [
      {
        id: resolution.bodyId,
        kind: "exactBody",
        sourceIdentitySignature: resolution.sourceIdentitySignature,
        sourceCacheKeySha256: resolution.cacheKeySha256,
        source: createCurrentExactBodyArtifactSource(resolution.source)
      } satisfies DerivedExactBodyGeometrySource
    ];
  });
}

export function createCurrentExactBodyArtifactSource(
  source: CurrentExactBodySource
): ExactBodyArtifactSource {
  if (isArtifactOperationSource(source)) {
    throw new Error(
      `Exact ${source.kind} sources require their artifact dependency.`
    );
  }
  if (source.kind === "importedBody") return createCheckpointBodySource(source);
  if (source.kind === "checkpointBoolean") {
    return {
      kind: "checkpointBoolean",
      operation: source.operation,
      target: createCheckpointBodySource(source.target),
      tool: createBooleanExtrudeRuntimeSource(source.tool)
    };
  }
  if (source.kind === "checkpointHole") {
    return {
      kind: "checkpointHole",
      target: createCheckpointBodySource(source.target),
      tool: source.tool
    };
  }
  if (source.kind === "checkpointEdgeFinish") {
    return {
      kind: "checkpointEdgeFinish",
      operation: source.operation,
      target: createCheckpointBodySource(source.target),
      checkpointEntityId: source.edgeReference.checkpointEntityId,
      amount: source.amount
    };
  }
  const runtimeSource = createExactMetadataRuntimeInput(source).source;
  if (runtimeSource.kind === "importedBody") {
    throw new Error("Imported bodies require checkpoint evidence.");
  }
  return runtimeSource;
}

export function createCurrentExactArtifactOperandSource(
  source: CurrentExactBodySource,
  dependencyArtifact?:
    | GeometryKernelExactBodyArtifact
    | CurrentExactBodyArtifactEvidence,
  shellOpenFaceLocalIds?: readonly string[]
): ExactBodyArtifactSource {
  const operation = createArtifactOperationDescriptor(source);
  if (!operation) {
    return createCurrentExactBodyArtifactSource(source);
  }
  if (!dependencyArtifact) {
    throw new Error(
      `Exact artifact dependency is unavailable for ${source.kind}.`
    );
  }
  preflightCurrentExactArtifactOperandSource(
    source,
    dependencyArtifact.shapePolicy
  );
  const leaf = createCurrentExactBodyArtifactLeaf(dependencyArtifact);

  switch (operation.kind) {
    case "artifactHole":
      return { ...operation, target: leaf };
    case "artifactLinearPattern":
    case "artifactCircularPattern":
    case "artifactMirror":
      return { ...operation, seed: leaf };
    case "artifactShell": {
      const openFaceLocalIds =
        shellOpenFaceLocalIds ??
        (operation.openFaceRefs.length === 0 ? [] : undefined);
      if (
        openFaceLocalIds === undefined ||
        openFaceLocalIds.length !== operation.openFaceRefs.length ||
        openFaceLocalIds.some(
          (localId) => !/^snapshot-local:face:[1-9][0-9]*$/.test(localId)
        )
      ) {
        throw new Error(
          "Shell artifact faces require current exact topology-local references."
        );
      }
      return {
        kind: "artifactShell",
        target: leaf,
        wallThickness: operation.wallThickness,
        openFaces: openFaceLocalIds.map((localId) => ({ localId }))
      };
    }
  }
}

export function createCurrentExactBodyArtifactLeaf(
  artifact: GeometryKernelExactBodyArtifact | CurrentExactBodyArtifactEvidence
): ExactBodyArtifactLeaf {
  return {
    kind: "bodyArtifact",
    artifactVersion: artifact.artifactVersion,
    bodyId: artifact.bodyId,
    sourceType: artifact.sourceType,
    documentSourceIdentity: artifact.documentSourceIdentity,
    bodySourceIdentitySignature: artifact.bodySourceIdentitySignature,
    sourceCacheKeySha256: artifact.sourceCacheKeySha256,
    sourceGraphNodeCount: artifact.sourceGraphNodeCount,
    units: artifact.units,
    shapePolicy: artifact.shapePolicy,
    sourceKind: artifact.sourceKind,
    brepFormat: artifact.brepFormat,
    brepWriter: artifact.brepWriter,
    brepBytes: artifact.brepBytes,
    brepByteLength: artifact.brepByteLength,
    brepSha256: artifact.brepSha256,
    topologySignature: artifact.topologySnapshot.signature
  };
}

export function preflightCurrentExactArtifactOperandSource(
  source: CurrentExactBodySource,
  dependencyShapePolicy?: ExactBodyArtifactShapePolicy
): ExactBodyArtifactShapePolicy {
  switch (source.kind) {
    case "hole":
    case "checkpointHole":
      requireArtifactDependency(source.kind, dependencyShapePolicy);
      if (!isValidHoleTool(source.tool)) {
        throw new Error(`Exact artifact ${source.kind} tool is invalid.`);
      }
      return dependencyShapePolicy!;
    case "linearPattern":
      requireArtifactDependency(source.kind, dependencyShapePolicy);
      if (
        !isUnitVector(source.direction) ||
        !isPositiveFinite(source.spacing) ||
        !isArtifactPatternCount(source.instanceCount)
      ) {
        throw new Error(
          "Exact artifact linear pattern parameters are invalid."
        );
      }
      return "singleShapeOneOrMoreSolids";
    case "circularPattern":
      requireArtifactDependency(source.kind, dependencyShapePolicy);
      if (
        !isFiniteVector(source.axis.origin) ||
        !isUnitVector(source.axis.direction) ||
        !isPositiveFinite(source.totalAngleDegrees) ||
        source.totalAngleDegrees > 360 ||
        !isArtifactPatternCount(source.instanceCount)
      ) {
        throw new Error(
          "Exact artifact circular pattern parameters are invalid."
        );
      }
      return "singleShapeOneOrMoreSolids";
    case "mirror":
      requireArtifactDependency(source.kind, dependencyShapePolicy);
      if (
        !isFiniteVector(source.plane.point) ||
        !isUnitVector(source.plane.normal)
      ) {
        throw new Error("Exact artifact mirror plane is invalid.");
      }
      return "singleShapeOneOrMoreSolids";
    case "shell":
      requireArtifactDependency(source.kind, dependencyShapePolicy);
      if (
        !isPositiveFinite(source.wallThickness) ||
        source.openFaceRefs.length >
          CAD_V21_EXACT_EXPORT_RESOURCE_LIMITS.maxSourceGraphNodes ||
        new Set(source.openFaceRefs.map((ref) => JSON.stringify(ref))).size !==
          source.openFaceRefs.length
      ) {
        throw new Error("Exact artifact shell parameters are invalid.");
      }
      return "singleSolid";
    default:
      if (dependencyShapePolicy !== undefined) {
        throw new Error(
          `Exact artifact dependency is unexpected for ${source.kind}.`
        );
      }
      return getCurrentExactBodyArtifactShapePolicy(
        createCurrentExactBodyArtifactSource(source)
      );
  }
}

export function getCurrentExactBodyArtifactShapePolicy(
  source: ExactBodyArtifactSource
): ExactBodyArtifactShapePolicy {
  switch (source.kind) {
    case "bodyArtifact":
      return source.shapePolicy;
    case "checkpointBody":
      return "singleShapeOneOrMoreSolids";
    case "artifactHole":
      return source.target.shapePolicy;
    case "linearPattern":
    case "circularPattern":
    case "mirror":
    case "artifactLinearPattern":
    case "artifactCircularPattern":
    case "artifactMirror":
      return "singleShapeOneOrMoreSolids";
    case "artifactShell":
      return "singleSolid";
    default:
      return "singleSolid";
  }
}

function createCheckpointBodySource(
  source: DerivedImportedBodyExactMetadataSource
): Extract<ExactBodyArtifactSource, { readonly kind: "checkpointBody" }> {
  if (!source.topologySignature) {
    throw new Error(
      `Checkpoint ${source.checkpointId} has no topology signature.`
    );
  }
  return {
    kind: "checkpointBody",
    brepBytes: source.brepBytes,
    brepByteLength: source.brepByteLength,
    brepSha256: source.brepSha256,
    topologySourceKind: source.topologySourceKind ?? "importedBody",
    topologySignature: source.topologySignature
  };
}

function resolveCurrentExactBody(
  body: CadBodySnapshot,
  context: ResolverContext
): CurrentExactBodyResolution {
  if (body.consumedByFeatureId) {
    return blocked(
      body,
      "blocked",
      "EXPORT_BODY_NOT_ACTIVE",
      `Body ${body.id} is consumed by feature ${body.consumedByFeatureId}.`
    );
  }
  if (context.duplicateBodyIds.has(body.id)) {
    return blocked(
      body,
      "blocked",
      "EXPORT_BODY_DUPLICATE",
      `Body ${body.id} has duplicate semantic ownership.`
    );
  }
  if (context.duplicateFeatureBodyIds.has(body.id)) {
    return blocked(
      body,
      "blocked",
      "EXPORT_BODY_DUPLICATE",
      `Body ${body.id} is owned by more than one feature.`
    );
  }

  const feature = context.featuresById.get(body.featureId);
  const sourceResolver = BODY_SOURCE_RESOLVERS[body.source.type];
  if (
    !feature ||
    feature.bodyId !== body.id ||
    feature.kind !== sourceResolver.featureKind
  ) {
    return blocked(
      body,
      "blocked",
      "EXPORT_EXACT_SOURCE_UNAVAILABLE",
      `Body ${body.id} does not match its authoritative ${sourceResolver.featureKind} feature.`
    );
  }

  const sourceIdentitySignature = context.sourceIdentitySignaturesByBodyId.get(
    body.id
  );
  if (!sourceIdentitySignature) {
    return blocked(
      body,
      "pending",
      "EXPORT_EXACT_SOURCE_UNAVAILABLE",
      `Body ${body.id} is waiting for current body source identity.`
    );
  }

  const resolved = sourceResolver.resolve(
    body,
    context,
    sourceIdentitySignature
  );
  if (isResolution(resolved)) return resolved;

  const dependencyBodyId = getArtifactDependencyBodyId(feature);
  const operationError = dependencyBodyId
    ? getArtifactOperationError(feature, resolved, context)
    : undefined;
  const placementError =
    !dependencyBodyId && "placementError" in resolved
      ? resolved.placementError
      : undefined;
  if (operationError || placementError) {
    return blocked(
      body,
      "blocked",
      "EXPORT_EXACT_SOURCE_UNAVAILABLE",
      operationError ?? placementError!
    );
  }
  const graph = dependencyBodyId
    ? { ok: true as const, nodeCount: 2 }
    : validateExactSourceGraph(resolved);
  if (!graph.ok) {
    return blocked(
      body,
      "blocked",
      graph.limit
        ? "EXPORT_EXACT_ARTIFACT_LIMIT_EXCEEDED"
        : "EXPORT_EXACT_SOURCE_UNAVAILABLE",
      graph.message
    );
  }

  const artifactDependency = dependencyBodyId
    ? resolveArtifactDependency(body, dependencyBodyId, context)
    : undefined;
  if (artifactDependency && !artifactDependency.ok) {
    return blocked(
      body,
      artifactDependency.status,
      artifactDependency.code,
      artifactDependency.message
    );
  }
  const cacheKeySha256 = sha256Hex(
    new TextEncoder().encode(
      JSON.stringify({
        bodyId: body.id,
        sourceType: body.source.type,
        sourceIdentitySignature,
        source:
          artifactDependency?.dependency !== undefined
            ? createArtifactOperationCacheKey(
                resolved,
                artifactDependency.dependency
              )
            : createCurrentExactSourceCacheKey(resolved)
      })
    )
  );
  return {
    status: "ready",
    bodyId: body.id,
    sourceType: body.source.type,
    sourceIdentitySignature,
    cacheKeySha256,
    sourceGraphNodeCount: graph.nodeCount,
    source: resolved,
    ...(artifactDependency
      ? { artifactDependency: artifactDependency.dependency }
      : {}),
    diagnostics: []
  };
}

function resolveArtifactDependency(
  body: CadBodySnapshot,
  dependencyBodyId: string,
  context: ResolverContext
):
  | {
      readonly ok: true;
      readonly dependency: CurrentExactBodyArtifactDependency;
    }
  | {
      readonly ok: false;
      readonly status: Exclude<CadCurrentExactResultStatus, "ready">;
      readonly code: CadExactResultDiagnostic["code"];
      readonly message: string;
    } {
  const artifactContext: ResolverContext = {
    ...context,
    geometrySourcesById: context.artifactGeometrySourcesById,
    duplicateGeometrySourceIds: context.duplicateArtifactGeometrySourceIds
  };
  const pending: {
    readonly body: CadBodySnapshot;
    readonly identity: string;
    readonly source: CurrentExactBodySource;
    readonly graphNodeCount: number;
  }[] = [];
  const visitedBodyIds = new Set([body.id]);
  let nextBodyId: string | undefined = dependencyBodyId;
  let consumingFeatureId = context.featuresById.get(body.featureId)!.id;

  while (nextBodyId) {
    if (visitedBodyIds.has(nextBodyId)) {
      return artifactDependencyError(
        "blocked",
        "EXPORT_EXACT_SOURCE_UNAVAILABLE",
        "Exact artifact dependency graph is cyclic."
      );
    }
    if (
      visitedBodyIds.size >=
      CAD_V21_EXACT_EXPORT_RESOURCE_LIMITS.maxSourceGraphNodes
    ) {
      return artifactDependencyError(
        "blocked",
        "EXPORT_EXACT_ARTIFACT_LIMIT_EXCEEDED",
        `Exact artifact dependency graph exceeds ${CAD_V21_EXACT_EXPORT_RESOURCE_LIMITS.maxSourceGraphNodes} bodies.`
      );
    }
    visitedBodyIds.add(nextBodyId);

    const dependencyBody = context.bodiesById.get(nextBodyId);
    if (!dependencyBody || context.duplicateBodyIds.has(nextBodyId)) {
      return artifactDependencyError(
        "blocked",
        "EXPORT_BODY_DUPLICATE",
        `Exact artifact dependency body ${nextBodyId} is missing or duplicated.`
      );
    }
    if (
      dependencyBody.consumedByFeatureId !== undefined &&
      dependencyBody.consumedByFeatureId !== consumingFeatureId
    ) {
      return artifactDependencyError(
        "blocked",
        "EXPORT_BODY_NOT_ACTIVE",
        `Exact artifact dependency body ${nextBodyId} is consumed by a different feature.`
      );
    }
    if (context.duplicateFeatureBodyIds.has(nextBodyId)) {
      return artifactDependencyError(
        "blocked",
        "EXPORT_BODY_DUPLICATE",
        `Exact artifact dependency body ${nextBodyId} has duplicate feature ownership.`
      );
    }

    const feature = context.featuresById.get(dependencyBody.featureId);
    const identity = context.sourceIdentitySignaturesByBodyId.get(nextBodyId);
    if (!feature || feature.bodyId !== nextBodyId || !identity) {
      return artifactDependencyError(
        identity ? "blocked" : "pending",
        "EXPORT_EXACT_SOURCE_UNAVAILABLE",
        `Exact artifact dependency body ${nextBodyId} has no current authoritative feature or source identity.`
      );
    }
    const sourceResolver = BODY_SOURCE_RESOLVERS[dependencyBody.source.type];
    if (feature.kind !== sourceResolver.featureKind) {
      return artifactDependencyError(
        "blocked",
        "EXPORT_EXACT_SOURCE_UNAVAILABLE",
        `Exact artifact dependency body ${nextBodyId} does not match its authoritative feature.`
      );
    }
    if (context.duplicateArtifactGeometrySourceIds.has(nextBodyId)) {
      return artifactDependencyError(
        "blocked",
        "EXPORT_BODY_DUPLICATE",
        `Exact artifact dependency body ${nextBodyId} has duplicate geometry sources.`
      );
    }

    const hasCheckpoint =
      context.document.topologyIdentity?.checkpoints.some(
        (checkpoint) => checkpoint.bodyId === nextBodyId
      ) ?? false;
    const checkpoint: ReturnType<typeof resolveCheckpointLeaf> | undefined =
      hasCheckpoint ? resolveCheckpointLeaf(nextBodyId, context) : undefined;
    if (checkpoint && !checkpoint.ok) return checkpoint;
    const resolved: CurrentExactBodySource | CurrentExactBodyResolution =
      checkpoint?.ok
        ? { ...checkpoint.source, sourceIdentitySignature: identity }
        : sourceResolver.resolve(dependencyBody, artifactContext, identity);
    if (isResolution(resolved)) {
      return artifactDependencyError(
        resolved.status === "ready" ? "blocked" : resolved.status,
        resolved.diagnostics[0]?.code ?? "EXPORT_EXACT_SOURCE_UNAVAILABLE",
        resolved.diagnostics[0]?.message ??
          `Exact artifact dependency body ${nextBodyId} is unavailable.`
      );
    }

    const childBodyId: string | undefined = checkpoint?.ok
      ? undefined
      : getArtifactDependencyBodyId(feature);
    const operationError = childBodyId
      ? getArtifactOperationError(feature, resolved, context)
      : undefined;
    const placementError =
      !childBodyId && "placementError" in resolved
        ? resolved.placementError
        : undefined;
    if (operationError || placementError) {
      return artifactDependencyError(
        "blocked",
        "EXPORT_EXACT_SOURCE_UNAVAILABLE",
        operationError ?? placementError!
      );
    }
    const graph = childBodyId
      ? { ok: true as const, nodeCount: 2 }
      : validateExactSourceGraph(resolved);
    if (!graph.ok) {
      return artifactDependencyError(
        "blocked",
        graph.limit
          ? "EXPORT_EXACT_ARTIFACT_LIMIT_EXCEEDED"
          : "EXPORT_EXACT_SOURCE_UNAVAILABLE",
        graph.message
      );
    }
    pending.push({
      body: dependencyBody,
      identity,
      source: resolved,
      graphNodeCount: graph.nodeCount
    });
    consumingFeatureId = feature.id;
    nextBodyId = childBodyId;
  }

  let child: CurrentExactBodyArtifactDependency | undefined;
  while (pending.length > 0) {
    const node = pending.pop()!;
    const cacheSource = child
      ? createArtifactOperationCacheKey(node.source, child)
      : createCurrentExactSourceCacheKey(node.source);
    child = {
      bodyId: node.body.id,
      sourceType: node.body.source.type,
      sourceIdentitySignature: node.identity,
      cacheKeySha256: sha256Hex(
        new TextEncoder().encode(
          JSON.stringify({
            bodyId: node.body.id,
            sourceType: node.body.source.type,
            sourceIdentitySignature: node.identity,
            source: cacheSource
          })
        )
      ),
      sourceGraphNodeCount: node.graphNodeCount,
      source: node.source,
      ...(child ? { artifactDependency: child } : {})
    };
  }
  return { ok: true, dependency: child! };
}

function createArtifactOperationCacheKey(
  source: CurrentExactBodySource,
  child: CurrentExactBodyArtifactDependency
): string {
  const dependency = {
    bodyId: child.bodyId,
    sourceIdentitySignature: child.sourceIdentitySignature,
    sourceCacheKeySha256: child.cacheKeySha256
  };
  const operation = createArtifactOperationDescriptor(source);
  if (!operation) return createCurrentExactSourceCacheKey(source);
  const { kind, ...parameters } = operation;
  return JSON.stringify({ kind, dependency, ...parameters });
}

function createArtifactOperationDescriptor(source: CurrentExactBodySource) {
  switch (source.kind) {
    case "hole":
    case "checkpointHole":
      return {
        kind: "artifactHole",
        tool: source.tool
      } as const;
    case "linearPattern":
      return {
        kind: "artifactLinearPattern",
        direction: source.direction,
        spacing: source.spacing,
        instanceCount: source.instanceCount
      } as const;
    case "circularPattern":
      return {
        kind: "artifactCircularPattern",
        axis: source.axis,
        totalAngleDegrees: source.totalAngleDegrees,
        instanceCount: source.instanceCount
      } as const;
    case "mirror":
      return {
        kind: "artifactMirror",
        plane: source.plane,
        includeOriginal: source.includeOriginal
      } as const;
    case "shell":
      return {
        kind: "artifactShell",
        wallThickness: source.wallThickness,
        openFaceRefs: source.openFaceRefs
      } as const;
    default:
      return undefined;
  }
}

function getArtifactOperationError(
  feature: CadFeatureSummary,
  source: CurrentExactBodySource,
  context: ResolverContext
): string | undefined {
  try {
    preflightCurrentExactArtifactOperandSource(source, "singleSolid");
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }

  switch (feature.kind) {
    case "hole": {
      if (source.kind !== "hole" && source.kind !== "checkpointHole") {
        return `Hole feature ${feature.id} has no current artifact operation source.`;
      }
      const sketch = context.document.sketches.get(feature.sketchId);
      const circle = sketch?.entities.get(feature.circleEntityId);
      if (!sketch || circle?.kind !== "circle") {
        return `Hole feature ${feature.id} has no current circle tool source.`;
      }
      if (sketch.attachment && !source.tool.placementFrame) {
        return (
          ("placementError" in source ? source.placementError : undefined) ??
          `Hole feature ${feature.id} has no current attachment frame.`
        );
      }
      return undefined;
    }
    case "linearPattern": {
      if (source.kind !== "linearPattern") {
        return `Linear pattern ${feature.id} has no current artifact operation source.`;
      }
      const frame = resolvePatternDirectionFrame(
        context.document,
        feature.direction
      );
      return frame.ok ? undefined : frame.message;
    }
    case "circularPattern": {
      if (source.kind !== "circularPattern") {
        return `Circular pattern ${feature.id} has no current artifact operation source.`;
      }
      const frame = resolvePatternRotationAxisFrame(
        context.document,
        feature.rotationAxis
      );
      return frame.ok ? undefined : frame.message;
    }
    case "mirror": {
      if (source.kind !== "mirror") {
        return `Mirror feature ${feature.id} has no current artifact operation source.`;
      }
      const frame = resolveMirrorPlaneFrame(context.document, feature.plane);
      return frame.ok ? undefined : frame.message;
    }
    case "shell":
      if (source.kind !== "shell") {
        return `Shell feature ${feature.id} has no current artifact operation source.`;
      }
      return undefined;
    default:
      return undefined;
  }
}

function artifactDependencyError(
  status: Exclude<CadCurrentExactResultStatus, "ready">,
  code: CadExactResultDiagnostic["code"],
  message: string
) {
  return { ok: false as const, status, code, message };
}

function requireArtifactDependency(
  sourceKind: string,
  dependencyShapePolicy: ExactBodyArtifactShapePolicy | undefined
): void {
  if (dependencyShapePolicy === undefined) {
    throw new Error(
      `Exact artifact dependency is unavailable for ${sourceKind}.`
    );
  }
}

function isPositiveFinite(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isFiniteVector(
  value: readonly number[]
): value is readonly [number, number, number] {
  return value.length === 3 && value.every(Number.isFinite);
}

function isUnitVector(value: readonly number[]): boolean {
  return (
    isFiniteVector(value) &&
    Math.abs(Math.hypot(value[0], value[1], value[2]) - 1) <= 1e-9
  );
}

function isArtifactPatternCount(value: number): boolean {
  return Number.isInteger(value) && value >= 2 && value <= 4_096;
}

function isValidHoleTool(tool: DerivedHoleGeometrySource["tool"]): boolean {
  const frame = tool.placementFrame;
  return (
    isPositiveFinite(tool.circle.radius) &&
    tool.circle.center.length === 2 &&
    tool.circle.center.every(Number.isFinite) &&
    (tool.depthMode === "blind"
      ? isPositiveFinite(tool.depth)
      : tool.depth === undefined) &&
    (frame === undefined ||
      (isFiniteVector(frame.origin) &&
        isFiniteVector(frame.uAxis) &&
        isFiniteVector(frame.vAxis) &&
        Math.hypot(...frame.uAxis) > 0 &&
        Math.hypot(...frame.vAxis) > 0))
  );
}

function getArtifactDependencyBodyId(
  feature: CadFeatureSummary
): string | undefined {
  switch (feature.kind) {
    case "hole":
      return feature.targetBodyId;
    case "shell":
      return feature.targetBodyId;
    case "linearPattern":
    case "circularPattern":
    case "mirror":
      return feature.seedBodyId;
    default:
      return undefined;
  }
}

function resolvePrimitiveSource(
  body: CadBodySnapshot,
  context: ResolverContext,
  sourceIdentitySignature: string
): CurrentExactBodySource | CurrentExactBodyResolution {
  if (body.source.type !== "primitiveFeature") {
    return blocked(
      body,
      "blocked",
      "EXPORT_EXACT_SOURCE_UNAVAILABLE",
      `Body ${body.id} is not backed by a primitive source.`
    );
  }
  const objectId = body.objectId ?? body.source.objectId;
  const source = context.geometrySourcesById.get(objectId);
  if (!source || !isPrimitiveSource(source) || source.kind !== body.primitive) {
    return blocked(
      body,
      "blocked",
      "EXPORT_EXACT_SOURCE_UNAVAILABLE",
      `Primitive body ${body.id} has no matching current scene object source.`
    );
  }
  return { ...source, id: body.id, sourceIdentitySignature };
}

function resolveLegacyRuntimeSource(
  body: CadBodySnapshot,
  context: ResolverContext,
  sourceIdentitySignature: string
): CurrentExactBodySource | CurrentExactBodyResolution {
  if (context.duplicateGeometrySourceIds.has(body.id)) {
    return blocked(
      body,
      "blocked",
      "EXPORT_BODY_DUPLICATE",
      `Body ${body.id} has duplicate current geometry sources.`
    );
  }
  const source = context.geometrySourcesById.get(body.id);
  if (!source || !isExactMetadataSource(source)) {
    return blocked(
      body,
      "blocked",
      "EXPORT_EXACT_SOURCE_UNAVAILABLE",
      `Body ${body.id} has no current exact geometry source.`
    );
  }
  return { ...source, sourceIdentitySignature };
}

function resolveArtifactOperationSource(
  body: CadBodySnapshot,
  context: ResolverContext,
  sourceIdentitySignature: string
): CurrentExactBodySource | CurrentExactBodyResolution {
  const feature = context.featuresById.get(body.featureId);
  if (!feature) {
    return blocked(
      body,
      "blocked",
      "EXPORT_EXACT_SOURCE_UNAVAILABLE",
      `Body ${body.id} has no current downstream operation source.`
    );
  }

  switch (feature.kind) {
    case "linearPattern": {
      const direction = resolvePatternDirectionFrame(
        context.document,
        feature.direction
      );
      return direction.ok
        ? {
            id: body.id,
            kind: "linearPattern",
            direction: direction.frame,
            spacing: feature.spacing,
            instanceCount: feature.instanceCount,
            sourceIdentitySignature
          }
        : blocked(
            body,
            "blocked",
            "EXPORT_EXACT_SOURCE_UNAVAILABLE",
            direction.message
          );
    }
    case "circularPattern": {
      const axis = resolvePatternRotationAxisFrame(
        context.document,
        feature.rotationAxis
      );
      return axis.ok
        ? {
            id: body.id,
            kind: "circularPattern",
            axis: axis.frame,
            totalAngleDegrees: feature.totalAngleDegrees,
            instanceCount: feature.instanceCount,
            sourceIdentitySignature
          }
        : blocked(
            body,
            "blocked",
            "EXPORT_EXACT_SOURCE_UNAVAILABLE",
            axis.message
          );
    }
    case "mirror": {
      const plane = resolveMirrorPlaneFrame(context.document, feature.plane);
      return plane.ok
        ? {
            id: body.id,
            kind: "mirror",
            plane: plane.frame,
            includeOriginal: feature.includeOriginal,
            sourceIdentitySignature
          }
        : blocked(
            body,
            "blocked",
            "EXPORT_EXACT_SOURCE_UNAVAILABLE",
            plane.message
          );
    }
    case "shell": {
      return {
        id: body.id,
        kind: "shell",
        wallThickness: feature.wallThickness,
        openFaceRefs: feature.openFaceRefs,
        sourceIdentitySignature
      };
    }
    default:
      return blocked(
        body,
        "blocked",
        "EXPORT_EXACT_SOURCE_UNAVAILABLE",
        `Body ${body.id} is not backed by an artifact downstream operation.`
      );
  }
}

function resolveExtrudeSource(
  body: CadBodySnapshot,
  context: ResolverContext,
  sourceIdentitySignature: string
): CurrentExactBodySource | CurrentExactBodyResolution {
  const feature = context.featuresById.get(body.featureId);
  if (
    feature?.kind !== "extrude" ||
    (feature.operationMode !== "add" && feature.operationMode !== "cut")
  ) {
    return resolveLegacyRuntimeSource(body, context, sourceIdentitySignature);
  }
  const source = context.geometrySourcesById.get(body.id);
  if (!source || source.kind !== "extrudeBoolean") {
    return resolveLegacyRuntimeSource(body, context, sourceIdentitySignature);
  }
  if (!source.placementError) return { ...source, sourceIdentitySignature };

  const target = resolveCheckpointLeaf(feature.targetBodyId ?? "", context);
  if (!target.ok)
    return blocked(body, target.status, target.code, target.message);
  if (source.tool.placementError) {
    return blocked(
      body,
      "blocked",
      "EXPORT_EXACT_SOURCE_UNAVAILABLE",
      source.tool.placementError
    );
  }
  return {
    id: body.id,
    kind: "checkpointBoolean",
    operation: feature.operationMode,
    target: target.source,
    tool: source.tool,
    sourceIdentitySignature
  };
}

function resolveEdgeFinishSource(
  body: CadBodySnapshot,
  context: ResolverContext,
  sourceIdentitySignature: string
): CurrentExactBodySource | CurrentExactBodyResolution {
  const feature = context.featuresById.get(body.featureId);
  const source = context.geometrySourcesById.get(body.id);
  if (
    !feature ||
    (feature.kind !== "chamfer" && feature.kind !== "fillet") ||
    !source ||
    source.kind !== "edgeFinish"
  ) {
    return resolveLegacyRuntimeSource(body, context, sourceIdentitySignature);
  }
  if (!source.placementError) return { ...source, sourceIdentitySignature };

  const target = resolveCheckpointLeaf(feature.targetBodyId, context);
  if (!target.ok)
    return blocked(body, target.status, target.code, target.message);
  const edgeReference = resolveCheckpointEdgeReference(
    feature,
    context.document
  );
  if (!edgeReference.ok) {
    return blocked(
      body,
      edgeReference.status,
      "EXPORT_EXACT_SOURCE_UNAVAILABLE",
      edgeReference.message
    );
  }
  return {
    id: body.id,
    kind: "checkpointEdgeFinish",
    operation: feature.kind,
    target: target.source,
    edgeReference: edgeReference.reference,
    amount: feature.kind === "chamfer" ? feature.distance : feature.radius,
    sourceIdentitySignature
  };
}

function resolveHoleSource(
  body: CadBodySnapshot,
  context: ResolverContext,
  sourceIdentitySignature: string
): CurrentExactBodySource | CurrentExactBodyResolution {
  const feature = context.featuresById.get(body.featureId);
  const source = context.geometrySourcesById.get(body.id);
  if (feature?.kind !== "hole" || !source || source.kind !== "hole") {
    return resolveLegacyRuntimeSource(body, context, sourceIdentitySignature);
  }
  return { ...source, sourceIdentitySignature };
}

function resolveImportedSource(
  body: CadBodySnapshot,
  context: ResolverContext,
  sourceIdentitySignature: string
): CurrentExactBodySource | CurrentExactBodyResolution {
  const result = resolveCheckpointLeaf(body.id, context);
  return result.ok
    ? { ...result.source, sourceIdentitySignature }
    : blocked(body, result.status, result.code, result.message);
}

function resolveCheckpointLeaf(
  bodyId: string,
  context: ResolverContext
):
  | {
      readonly ok: true;
      readonly source: DerivedImportedBodyExactMetadataSource;
    }
  | {
      readonly ok: false;
      readonly status: Exclude<CadCurrentExactResultStatus, "ready">;
      readonly code: CadExactResultDiagnostic["code"];
      readonly message: string;
    } {
  const body = context.bodiesById.get(bodyId);
  const feature = body ? context.featuresById.get(body.featureId) : undefined;
  const checkpoints =
    context.document.topologyIdentity?.checkpoints.filter(
      (checkpoint) => checkpoint.bodyId === bodyId
    ) ?? [];
  const active = checkpoints.filter(
    (checkpoint) => checkpoint.status === "active"
  );
  const checkpoint = active.length === 1 ? active[0] : undefined;
  if (!body || !feature || !checkpoint) {
    const failed = checkpoints.find(
      (candidate) => candidate.status === "failed"
    );
    const stale = checkpoints.find((candidate) => candidate.status === "stale");
    const unsupported = checkpoints.find(
      (candidate) => candidate.status === "unsupported"
    );
    return {
      ok: false,
      status: failed
        ? "failed"
        : stale
          ? "stale"
          : unsupported
            ? "unsupported"
            : "blocked",
      code: failed
        ? "EXPORT_EXACT_ARTIFACT_FAILED"
        : stale
          ? "EXPORT_EXACT_SOURCE_STALE"
          : unsupported
            ? "EXPORT_BODY_SOURCE_UNSUPPORTED"
            : "EXPORT_EXACT_SOURCE_UNAVAILABLE",
      message: `Body ${bodyId} has no unique active checkpoint source.`
    };
  }
  if (
    feature.bodyId !== body.id ||
    feature.kind !== BODY_SOURCE_RESOLVERS[body.source.type].featureKind
  ) {
    return {
      ok: false,
      status: "blocked",
      code: "EXPORT_EXACT_ARTIFACT_INVALID",
      message: `Checkpoint ${checkpoint.checkpointId} body/feature ownership is invalid.`
    };
  }
  if (
    checkpoint.sourceFeatureId !== undefined &&
    checkpoint.sourceFeatureId !== feature.id
  ) {
    return {
      ok: false,
      status: "blocked",
      code: "EXPORT_EXACT_ARTIFACT_INVALID",
      message: `Checkpoint ${checkpoint.checkpointId} does not match feature ${feature.id}.`
    };
  }
  const payloads = (context.checkpointPayloads ?? []).filter(
    (payload) => payload.checkpointId === checkpoint.checkpointId
  );
  const payload = payloads.length === 1 ? payloads[0] : undefined;
  if (
    !payload ||
    payload.bodyId !== bodyId ||
    (payload.sourceFeatureId !== undefined &&
      payload.sourceFeatureId !== feature.id)
  ) {
    return {
      ok: false,
      status: "blocked",
      code: "EXPORT_EXACT_ARTIFACT_INVALID",
      message: `Checkpoint ${checkpoint.checkpointId} has no matching body/feature payload.`
    };
  }
  const actualSha256 = sha256Hex(payload.brepBytes);
  const topologyEvidence = readCheckpointTopologyEvidence(payload);
  if (
    payload.brepByteLength === undefined ||
    payload.brepSha256 === undefined ||
    payload.brepByteLength !== payload.brepBytes.byteLength ||
    payload.brepSha256 !== actualSha256 ||
    topologyEvidence === undefined
  ) {
    return {
      ok: false,
      status: "blocked",
      code: "EXPORT_EXACT_ARTIFACT_INVALID",
      message: `Checkpoint ${checkpoint.checkpointId} B-rep length/hash evidence is missing or mismatched.`
    };
  }
  return {
    ok: true,
    source: {
      id: bodyId,
      kind: "importedBody",
      checkpointId: checkpoint.checkpointId,
      brepByteLength: payload.brepByteLength,
      brepSha256: payload.brepSha256,
      topologySourceKind: topologyEvidence.sourceKind,
      topologySignature: topologyEvidence.signature,
      brepBytes: payload.brepBytes
    }
  };
}

function resolveCheckpointEdgeReference(
  feature: Extract<CadFeatureSummary, { kind: "chamfer" | "fillet" }>,
  document: CadDocument
):
  | {
      readonly ok: true;
      readonly reference: CurrentExactCheckpointEdgeFinishSource["edgeReference"];
    }
  | {
      readonly ok: false;
      readonly status: "blocked" | "stale" | "unsupported";
      readonly message: string;
    } {
  if (feature.topologyAnchorId) {
    const anchor = document.topologyIdentity?.anchors.find(
      (candidate) => candidate.anchorId === feature.topologyAnchorId
    );
    if (!anchor || anchor.bodyId !== feature.targetBodyId) {
      return {
        ok: false,
        status: "blocked",
        message: `Topology anchor ${feature.topologyAnchorId} is unavailable on ${feature.targetBodyId}.`
      };
    }
    if (anchor.state !== "active") {
      return {
        ok: false,
        status: anchor.state === "stale" ? "stale" : "blocked",
        message: `Topology anchor ${feature.topologyAnchorId} is ${anchor.state}.`
      };
    }
    return {
      ok: true,
      reference: {
        kind: "topologyAnchor",
        anchorId: anchor.anchorId,
        checkpointEntityId: anchor.checkpointEntityId,
        ...(anchor.stableId ? { stableId: anchor.stableId } : {})
      }
    };
  }
  return {
    ok: false,
    status: "unsupported",
    message: `${feature.kind} feature ${feature.id} has no supported edge reference.`
  };
}

function readCheckpointTopologyEvidence(
  payload: WcadTopologyCheckpointPayloadInput
):
  | {
      readonly sourceKind: DerivedImportedBodyExactMetadataSource["topologySourceKind"] &
        string;
      readonly signature: string;
    }
  | undefined {
  try {
    const value = decodeWcadCanonicalCbor(payload.signatureBytes);
    const topology = decodeWcadCanonicalCbor(payload.topologyBytes);
    if (
      typeof value !== "object" ||
      value === null ||
      !("checkpointId" in value) ||
      value.checkpointId !== payload.checkpointId ||
      !("signatureAlgorithm" in value) ||
      value.signatureAlgorithm !== "partbench-derived-topology-snapshot-v1" ||
      !("signature" in value) ||
      typeof value.signature !== "string" ||
      value.signature.length === 0 ||
      typeof topology !== "object" ||
      topology === null ||
      !("sourceKind" in topology) ||
      typeof topology.sourceKind !== "string" ||
      !isCheckpointTopologySourceKind(topology.sourceKind) ||
      !("signature" in topology) ||
      topology.signature !== value.signature
    ) {
      return undefined;
    }
    return { sourceKind: topology.sourceKind, signature: value.signature };
  } catch {
    return undefined;
  }
}

function isCheckpointTopologySourceKind(
  value: string
): value is NonNullable<
  DerivedImportedBodyExactMetadataSource["topologySourceKind"]
> {
  return [
    "box",
    "cylinder",
    "sphere",
    "cone",
    "torus",
    "extrude",
    "booleanExtrudes",
    "revolve",
    "hole",
    "edgeFinish",
    "sweep",
    "loft",
    "linearPattern",
    "circularPattern",
    "mirror",
    "shell",
    "importedBody"
  ].includes(value);
}

function validateExactSourceGraph(source: CurrentExactBodySource):
  | { readonly ok: true; readonly nodeCount: number }
  | {
      readonly ok: false;
      readonly limit: boolean;
      readonly message: string;
    } {
  const states = new WeakMap<object, "visiting" | "done">();
  const owners = new Map<string, object>();
  const stack: {
    readonly source: CurrentExactBodySource;
    readonly exit: boolean;
  }[] = [{ source, exit: false }];
  let nodeCount = 0;

  while (stack.length > 0) {
    const frame = stack.pop()!;
    if (frame.exit) {
      states.set(frame.source, "done");
      continue;
    }
    const state = states.get(frame.source);
    if (state === "visiting") {
      return {
        ok: false,
        limit: false,
        message: "Exact source graph is cyclic."
      };
    }
    if (state === "done") {
      return {
        ok: false,
        limit: false,
        message: "Exact source graph contains duplicate semantic ownership."
      };
    }
    nodeCount += 1;
    if (nodeCount > CAD_V21_EXACT_EXPORT_RESOURCE_LIMITS.maxSourceGraphNodes) {
      return {
        ok: false,
        limit: true,
        message: `Exact source graph exceeds ${CAD_V21_EXACT_EXPORT_RESOURCE_LIMITS.maxSourceGraphNodes} nodes.`
      };
    }
    const owner = owners.get(frame.source.id);
    if (owner && owner !== frame.source) {
      return {
        ok: false,
        limit: false,
        message: `Exact source node ${frame.source.id} has duplicate semantic ownership.`
      };
    }
    owners.set(frame.source.id, frame.source);
    states.set(frame.source, "visiting");
    stack.push({ source: frame.source, exit: true });
    const children = getExactSourceChildren(frame.source);
    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push({ source: children[index]!, exit: false });
    }
  }
  return { ok: true, nodeCount };
}

function getExactSourceChildren(
  source: CurrentExactBodySource
): readonly CurrentExactBodySource[] {
  if (isArtifactOperationSource(source)) return [];
  if (source.kind === "extrudeBoolean") return [source.target, source.tool];
  if (source.kind === "hole" || source.kind === "edgeFinish") {
    return [source.target];
  }
  if (source.kind === "checkpointBoolean") return [source.target, source.tool];
  if (source.kind === "checkpointHole") return [source.target];
  if (source.kind === "checkpointEdgeFinish") return [source.target];
  return [];
}

function createCurrentExactSourceCacheKey(
  source: CurrentExactBodySource
): string {
  if (isArtifactOperationSource(source)) return JSON.stringify(source);
  if (isExactMetadataSource(source)) {
    return createDerivedExactMetadataCacheKey(source);
  }
  if (source.kind === "checkpointBoolean") {
    return JSON.stringify({
      kind: source.kind,
      operation: source.operation,
      target: createDerivedExactMetadataCacheKey(source.target),
      tool: createDerivedExactMetadataCacheKey(source.tool),
      sourceIdentitySignature: source.sourceIdentitySignature
    });
  }
  if (source.kind === "checkpointHole") {
    return JSON.stringify({
      kind: source.kind,
      target: createDerivedExactMetadataCacheKey(source.target),
      tool: source.tool,
      sourceIdentitySignature: source.sourceIdentitySignature
    });
  }
  return JSON.stringify({
    kind: source.kind,
    operation: source.operation,
    target: createDerivedExactMetadataCacheKey(source.target),
    edgeReference: source.edgeReference,
    amount: source.amount,
    sourceIdentitySignature: source.sourceIdentitySignature
  });
}

function blocked(
  body: CadBodySnapshot,
  status: Exclude<CadCurrentExactResultStatus, "ready">,
  code: CadExactResultDiagnostic["code"],
  message: string
): CurrentExactBodyResolution {
  return {
    status,
    bodyId: body.id,
    sourceType: body.source.type,
    diagnostics: [
      {
        code,
        status,
        message,
        bodyId: body.id,
        sourceType: body.source.type,
        featureId: body.featureId
      }
    ]
  };
}

function isResolution(
  value: CurrentExactBodySource | CurrentExactBodyResolution
): value is CurrentExactBodyResolution {
  return "status" in value;
}

function isArtifactOperationSource(
  source: CurrentExactBodySource
): source is CurrentExactArtifactOperationSource {
  return (
    source.kind === "linearPattern" ||
    source.kind === "circularPattern" ||
    source.kind === "mirror" ||
    source.kind === "shell"
  );
}

function isPrimitiveSource(
  source: DerivedGeometrySource
): source is DerivedPrimitiveGeometrySource {
  return (
    source.kind === "box" ||
    source.kind === "cylinder" ||
    source.kind === "sphere" ||
    source.kind === "cone" ||
    source.kind === "torus"
  );
}

function createUniqueIndex<T>(
  values: readonly T[],
  keyOf: (value: T) => string
): {
  readonly values: ReadonlyMap<string, T>;
  readonly duplicates: ReadonlySet<string>;
} {
  const index = new Map<string, T>();
  const duplicates = new Set<string>();
  for (const value of values) {
    const key = keyOf(value);
    if (index.has(key)) duplicates.add(key);
    else index.set(key, value);
  }
  return { values: index, duplicates };
}

function compareBodyId(left: CadBodySnapshot, right: CadBodySnapshot): number {
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}
