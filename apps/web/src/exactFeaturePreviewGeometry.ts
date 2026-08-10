import {
  CadEngine,
  createCadProjectSourceIdentity,
  type CadBodySnapshot,
  type CadFeatureSummary,
  type WcadTopologyCheckpointPayloadInput
} from "@web-cad/cad-core";
import type {
  CadBatch,
  CadBatchErrorResponse,
  CadBatchSuccessResponse,
  CadGeneratedFaceReference,
  CadOp
} from "@web-cad/cad-protocol";
import type { RenderTriangleMesh } from "@web-cad/renderer";
import { createRenderMeshFromSerializableMesh } from "@web-cad/renderer-mesh-bridge";

import type { DerivedGeometryRuntime } from "./derivedGeometryRuntime";
import {
  createDerivedGeometrySourcesFromDocument,
  removeConsumedDerivedGeometrySources
} from "./derivedGeometrySources";
import {
  resolveCurrentExactBodies,
  type CurrentExactBodyArtifactEvidence,
  type CurrentExactBodyResolution
} from "./currentExactBodyResolver";
import { buildCurrentExactBodyArtifacts } from "./projectExactStepExport";
import { createGeneratedFaceReferenceKey } from "./sketchDisplayFrames";

/**
 * A source-only error raised while constructing a transient exact preview.
 * The error is intentionally kept in the web layer: it is not a new CAD
 * command or protocol response.
 */
export class ExactFeaturePreviewGeometryError extends Error {
  readonly kind: "command" | "source" | "stale";
  readonly response?: CadBatchErrorResponse;
  readonly bodyId?: string;

  constructor(
    kind: "command" | "source" | "stale",
    message: string,
    options: {
      readonly response?: CadBatchErrorResponse;
      readonly bodyId?: string;
    } = {}
  ) {
    super(message);
    this.name = "ExactFeaturePreviewGeometryError";
    this.kind = kind;
    this.response = options.response;
    this.bodyId = options.bodyId;
  }
}

export type ExactFeaturePreviewGeometryArtifact =
  CurrentExactBodyArtifactEvidence;

export interface ExactFeaturePreviewGeometryInput {
  readonly engine: CadEngine;
  /** The same batch Apply will submit. `mode` is normalized by projectBatch. */
  readonly batch: CadBatch;
  /** Optional explicit result body. Created-body IDs are used when omitted. */
  readonly bodyId?: string;
  readonly operationLabel?: string;
  readonly runtime: Pick<
    DerivedGeometryRuntime,
    "exactBodyArtifact" | "getModelWorkSnapshot" | "resumeModelWork"
  >;
  readonly checkpointPayloads?: readonly WcadTopologyCheckpointPayloadInput[];
  readonly existingArtifacts?: readonly CurrentExactBodyArtifactEvidence[];
  readonly expectedSourceAuthorityEpoch?: number;
  readonly signal?: AbortSignal;
  /** Preview defaults to exact; existing commit preflight may retain its user context. */
  readonly executionIntent?: "user" | "exact";
  readonly userKind?: "preflight" | "export";
  readonly requestIdPrefix?: string;
  /** Return false or throw to reject a stale preview. */
  readonly isCurrent?: () => boolean | void;
}

export interface ExactFeaturePreviewGeometryResult {
  readonly sourceAuthorityEpoch: number;
  readonly projectedSourceIdentity: ReturnType<
    typeof createCadProjectSourceIdentity
  >;
  readonly response: CadBatchSuccessResponse;
  readonly affectedBodyIds: readonly string[];
  readonly artifacts: readonly ExactFeaturePreviewGeometryArtifact[];
  readonly meshes: readonly RenderTriangleMesh[];
}

const EXACT_DOWNSTREAM_UPDATE_OPS = new Set<CadOp["op"]>([
  "feature.updateHole",
  "feature.updateLinearPattern",
  "feature.updateCircularPattern",
  "feature.updateMirror",
  "feature.updateShell"
]);

/**
 * Projects one existing CADOps batch and builds only its affected exact body
 * artifacts. The live engine, transaction history, checkpoint payloads, and
 * exact artifact cache are never written by this function.
 */
export async function projectExactFeaturePreviewGeometry(
  input: ExactFeaturePreviewGeometryInput
): Promise<ExactFeaturePreviewGeometryResult> {
  const sourceAuthorityEpoch =
    input.expectedSourceAuthorityEpoch ??
    input.engine.getSourceAuthorityEpoch();
  const operationLabel = input.operationLabel ?? "exact feature";
  const assertCurrent = () => {
    throwIfAborted(input.signal);
    if (input.engine.getSourceAuthorityEpoch() !== sourceAuthorityEpoch) {
      throw new ExactFeaturePreviewGeometryError(
        "stale",
        `The project changed while ${operationLabel} preview was running.`
      );
    }
    const current = input.isCurrent?.();
    if (current === false) {
      throw new ExactFeaturePreviewGeometryError(
        "stale",
        `The project changed while ${operationLabel} preview was running.`
      );
    }
  };

  // This is deliberately checked before and after the synchronous projection
  // call. projectBatch owns the detached clone and its dry-run/commit pair.
  assertCurrent();
  const projected = input.engine.projectBatch(input.batch);
  assertCurrent();
  if (!projected.ok) {
    throw new ExactFeaturePreviewGeometryError(
      "command",
      projected.response.error.message,
      { response: projected.response }
    );
  }

  // projectBatch owns the detached clone and returns that exact engine. Keep
  // all downstream query/resolver work on the same projected state; do not
  // rehydrate it or execute the batch a second time.
  const projectedEngine = projected.projectedEngine;
  assertCurrent();
  const structure = readProjectStructure(projectedEngine);
  const affectedBodyIds = resolveProjectedAffectedBodyIds(
    input.bodyId,
    input.batch.ops,
    structure.features,
    structure.bodies,
    projected.response.createdBodyIds
  );
  if (affectedBodyIds.length === 0) {
    assertCurrent();
    return {
      sourceAuthorityEpoch,
      projectedSourceIdentity: projected.sourceIdentity,
      response: projected.response,
      affectedBodyIds,
      artifacts: [],
      meshes: []
    };
  }

  const sourceIdentitySignaturesByBodyId = readBodySourceIdentitySignatures(
    projectedEngine,
    structure.bodies
  );
  const generatedFacesByKey = readGeneratedFaceReferencesByKey(
    projectedEngine,
    structure.bodies.filter(
      (body) => body.source.type === "sketchExtrudeFeature"
    )
  );
  const artifactGeometrySources = createDerivedGeometrySourcesFromDocument(
    projectedEngine.getDocument(),
    structure.features,
    generatedFacesByKey,
    sourceIdentitySignaturesByBodyId,
    true
  );
  const resolutions = resolveCurrentExactBodies({
    document: projectedEngine.getDocument(),
    bodies: structure.bodies,
    features: structure.features,
    geometrySources: removeConsumedDerivedGeometrySources(
      artifactGeometrySources,
      structure.features
    ),
    artifactGeometrySources,
    checkpointPayloads: input.checkpointPayloads,
    sourceIdentitySignaturesByBodyId
  });
  const readyResolutions: Extract<
    CurrentExactBodyResolution,
    { readonly status: "ready" }
  >[] = [];
  for (const affectedBodyId of affectedBodyIds) {
    const resolution = resolutions.find(
      (
        candidate
      ): candidate is Extract<
        CurrentExactBodyResolution,
        { readonly status: "ready" }
      > => candidate.bodyId === affectedBodyId && candidate.status === "ready"
    );
    if (!resolution) {
      const blocked = resolutions.find(
        (candidate) => candidate.bodyId === affectedBodyId
      );
      throw new ExactFeaturePreviewGeometryError(
        "source",
        blocked?.diagnostics[0]?.message ??
          `Could not apply this ${operationLabel} because exact source ${affectedBodyId} is unavailable.`,
        { bodyId: affectedBodyId }
      );
    }
    readyResolutions.push(resolution);
  }

  input.runtime.resumeModelWork();
  assertCurrent();
  const generation = input.runtime.getModelWorkSnapshot().generation;
  // No artifactCache is passed: preview artifacts are transient and cannot
  // enter the V21.1 derived cache. Existing evidence remains an input seam.
  const artifacts = await buildCurrentExactBodyArtifacts({
    engine: projectedEngine,
    resolutions: readyResolutions,
    runtime: input.runtime,
    documentSourceIdentity: projected.sourceIdentity,
    units: projectedEngine.getDocument().units,
    generation,
    existingArtifacts: input.existingArtifacts,
    executionIntent: input.executionIntent ?? "exact",
    ...(input.userKind ? { userKind: input.userKind } : {}),
    requestIdPrefix: input.requestIdPrefix ?? "feature-preview-artifact",
    assertCurrent
  });
  assertCurrent();
  if (
    artifacts.length !== affectedBodyIds.length ||
    artifacts.some(
      (artifact, index) => artifact.bodyId !== affectedBodyIds[index]
    )
  ) {
    throw new ExactFeaturePreviewGeometryError(
      "stale",
      `The projected ${operationLabel} result changed before preview completion.`
    );
  }

  const meshes = artifacts.map((artifact) => {
    const bridge = createRenderMeshFromSerializableMesh(artifact.displayMesh, {
      id: `preview:${artifact.bodyId}`,
      alignment: "source",
      source: artifact.bodyId,
      label: `${artifact.bodyId} preview`
    });
    return {
      ...bridge.mesh,
      presentation: "preview" as const
    };
  });
  assertCurrent();

  return {
    sourceAuthorityEpoch,
    projectedSourceIdentity: projected.sourceIdentity,
    response: projected.response,
    affectedBodyIds,
    artifacts,
    meshes
  };
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (!signal?.aborted) return;
  const error = new Error("Exact feature preview was cancelled.");
  error.name = "AbortError";
  throw error;
}

function resolveProjectedAffectedBodyIds(
  bodyId: string | undefined,
  ops: readonly CadOp[],
  features: readonly CadFeatureSummary[],
  bodies: readonly CadBodySnapshot[],
  createdBodyIds: readonly string[] = []
): readonly string[] {
  const changedBodyIds = new Set<string>();
  for (const op of ops) {
    if (
      (!EXACT_DOWNSTREAM_UPDATE_OPS.has(op.op) &&
        !op.op.startsWith("feature.update")) ||
      !("id" in op)
    ) {
      continue;
    }
    const feature = features.find((candidate) => candidate.id === op.id);
    if (feature) changedBodyIds.add(feature.bodyId);
  }
  // Body IDs in a successful projection are authoritative for create rows.
  // They are already bounded by CadEngine's response and are resolved to the
  // active descendant below.
  for (const createdBodyId of createdBodyIds) {
    if (bodies.some((body) => body.id === createdBodyId)) {
      changedBodyIds.add(createdBodyId);
    }
  }
  if (changedBodyIds.size === 0 && bodyId) changedBodyIds.add(bodyId);

  const bodiesById = new Map(bodies.map((body) => [body.id, body]));
  const featuresById = new Map(
    features.map((feature) => [feature.id, feature])
  );
  const activeBodyIds = new Set<string>();
  for (const changedBodyId of changedBodyIds) {
    let current = bodiesById.get(changedBodyId);
    const visited = new Set<string>();
    while (current?.consumedByFeatureId && !visited.has(current.id)) {
      visited.add(current.id);
      const consumer = featuresById.get(current.consumedByFeatureId);
      current = consumer ? bodiesById.get(consumer.bodyId) : undefined;
    }
    if (current && !current.consumedByFeatureId) activeBodyIds.add(current.id);
  }
  return [...activeBodyIds];
}

function readProjectStructure(engine: CadEngine): {
  readonly features: readonly CadFeatureSummary[];
  readonly bodies: readonly CadBodySnapshot[];
} {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "project.structure" }
  });
  return response.ok && response.query === "project.structure"
    ? { features: response.features, bodies: response.bodies }
    : { features: [], bodies: [] };
}

function readBodySourceIdentitySignatures(
  engine: CadEngine,
  bodies: readonly CadBodySnapshot[]
): ReadonlyMap<string, string> {
  const signatures = new Map<string, string>();
  for (const body of bodies) {
    const response = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "body.topology", bodyId: body.id }
    });
    if (response.ok && response.query === "body.topology") {
      signatures.set(body.id, response.topology.sourceIdentity.signature);
    }
  }
  return signatures;
}

function readGeneratedFaceReferencesByKey(
  engine: CadEngine,
  bodies: readonly CadBodySnapshot[]
): ReadonlyMap<string, CadGeneratedFaceReference> {
  const facesByKey = new Map<string, CadGeneratedFaceReference>();
  for (const body of bodies) {
    const response = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "body.generatedReferences", bodyId: body.id }
    });
    if (!response.ok || response.query !== "body.generatedReferences") continue;
    for (const face of response.faces) {
      facesByKey.set(
        createGeneratedFaceReferenceKey(face.bodyId, face.stableId),
        face
      );
    }
  }
  return facesByKey;
}
