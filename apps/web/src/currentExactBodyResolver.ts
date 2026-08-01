import {
  V21_EXACT_BODY_SOURCE_POLICY,
  decodeWcadCanonicalCbor,
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
  type CadExactResultDiagnostic
} from "@web-cad/cad-protocol";

import type {
  DerivedBooleanExtrudeGeometrySource,
  DerivedExtrudeGeometrySource,
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
import type { ExactBodyArtifactSource } from "@web-cad/geometry-worker";

export type CurrentExactBodySource =
  | DerivedExactMetadataSource
  | CurrentExactCheckpointBooleanSource
  | CurrentExactCheckpointHoleSource
  | CurrentExactCheckpointEdgeFinishSource;

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
      readonly diagnostics: readonly CadExactResultDiagnostic[];
    }
  | {
      readonly status: Exclude<CadCurrentExactResultStatus, "ready">;
      readonly bodyId: string;
      readonly sourceType: CadBodySource["type"];
      readonly diagnostics: readonly CadExactResultDiagnostic[];
    };

export interface CurrentExactBodyResolverInput {
  readonly document: CadDocument;
  readonly bodies: readonly CadBodySnapshot[];
  readonly features: readonly CadFeatureSummary[];
  readonly geometrySources: readonly DerivedGeometrySource[];
  readonly checkpointPayloads?: readonly WcadTopologyCheckpointPayloadInput[];
  readonly sourceIdentitySignaturesByBodyId: ReadonlyMap<string, string>;
}

interface ResolverContext extends CurrentExactBodyResolverInput {
  readonly bodiesById: ReadonlyMap<string, CadBodySnapshot>;
  readonly featuresById: ReadonlyMap<string, CadFeatureSummary>;
  readonly geometrySourcesById: ReadonlyMap<string, DerivedGeometrySource>;
  readonly duplicateBodyIds: ReadonlySet<string>;
  readonly duplicateFeatureBodyIds: ReadonlySet<string>;
  readonly duplicateGeometrySourceIds: ReadonlySet<string>;
}

type BodySourceResolver = (
  body: CadBodySnapshot,
  context: ResolverContext,
  sourceIdentitySignature: string
) => CurrentExactBodySource | CurrentExactBodyResolution;

const BODY_SOURCE_RESOLVERS = {
  primitiveFeature: resolvePrimitiveSource,
  sketchExtrudeFeature: resolveExtrudeSource,
  sketchRevolveFeature: resolveLegacyRuntimeSource,
  sketchHoleFeature: resolveHoleSource,
  edgeChamferFeature: resolveEdgeFinishSource,
  edgeFilletFeature: resolveEdgeFinishSource,
  linearPatternFeature: resolveLegacyRuntimeSource,
  circularPatternFeature: resolveLegacyRuntimeSource,
  mirrorFeature: resolveLegacyRuntimeSource,
  shellFeature: resolveLegacyRuntimeSource,
  sweepFeature: resolveLegacyRuntimeSource,
  loftFeature: resolveLegacyRuntimeSource,
  importedStepBody: resolveImportedSource
} satisfies Record<
  keyof typeof V21_EXACT_BODY_SOURCE_POLICY,
  BodySourceResolver
>;

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
  const context: ResolverContext = {
    ...input,
    bodiesById: bodyIndex.values,
    featuresById: featureIndex.values,
    geometrySourcesById: geometryIndex.values,
    duplicateBodyIds: bodyIndex.duplicates,
    duplicateFeatureBodyIds: featureBodyIndex.duplicates,
    duplicateGeometrySourceIds: geometryIndex.duplicates
  };

  return [...input.bodies]
    .sort(compareBodyId)
    .map((body) => resolveCurrentExactBody(body, context));
}

export function getReadyRuntimeExactSources(
  resolutions: readonly CurrentExactBodyResolution[]
): readonly DerivedExactMetadataSource[] {
  return resolutions.flatMap((resolution) =>
    resolution.status === "ready" && isExactMetadataSource(resolution.source)
      ? [resolution.source]
      : []
  );
}

export function createCurrentExactBodyArtifactSource(
  source: CurrentExactBodySource
): ExactBodyArtifactSource {
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
  const policy = V21_EXACT_BODY_SOURCE_POLICY[body.source.type];
  if (
    !feature ||
    feature.bodyId !== body.id ||
    feature.kind !== policy.featureKind
  ) {
    return blocked(
      body,
      "blocked",
      "EXPORT_EXACT_SOURCE_UNAVAILABLE",
      `Body ${body.id} does not match its authoritative ${policy.featureKind} feature.`
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

  const resolved = BODY_SOURCE_RESOLVERS[body.source.type](
    body,
    context,
    sourceIdentitySignature
  );
  if (isResolution(resolved)) return resolved;

  const placementError =
    "placementError" in resolved ? resolved.placementError : undefined;
  if (placementError) {
    return blocked(
      body,
      "blocked",
      "EXPORT_EXACT_SOURCE_UNAVAILABLE",
      placementError
    );
  }
  const graph = validateExactSourceGraph(resolved);
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

  const cacheKeySha256 = sha256Hex(
    new TextEncoder().encode(
      JSON.stringify({
        bodyId: body.id,
        sourceType: body.source.type,
        sourceIdentitySignature,
        source: createCurrentExactSourceCacheKey(resolved)
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
    diagnostics: []
  };
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
  if (!source.placementError) return { ...source, sourceIdentitySignature };

  const targetBody = context.bodiesById.get(feature.targetBodyId);
  if (targetBody?.source.type === "importedStepBody") {
    return blocked(
      body,
      "unsupported",
      "EXPORT_BODY_SOURCE_UNSUPPORTED",
      "Imported-body holes are outside the completed V21 exact matrix."
    );
  }
  const target = resolveCheckpointLeaf(feature.targetBodyId, context);
  return target.ok
    ? {
        id: body.id,
        kind: "checkpointHole",
        target: target.source,
        tool: source.tool,
        sourceIdentitySignature
      }
    : blocked(body, target.status, target.code, target.message);
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
    feature.kind !== V21_EXACT_BODY_SOURCE_POLICY[body.source.type].featureKind
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
  if (source.kind === "extrudeBoolean") return [source.target, source.tool];
  if (source.kind === "hole" || source.kind === "edgeFinish") {
    return [source.target];
  }
  if (
    source.kind === "linearPattern" ||
    source.kind === "circularPattern" ||
    source.kind === "mirror"
  ) {
    return [source.seed];
  }
  if (source.kind === "shell") return [source.target];
  if (source.kind === "checkpointBoolean") return [source.target, source.tool];
  if (source.kind === "checkpointHole") return [source.target];
  if (source.kind === "checkpointEdgeFinish") return [source.target];
  return [];
}

function createCurrentExactSourceCacheKey(
  source: CurrentExactBodySource
): string {
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
