import { CadEngine, createCadProjectSourceIdentity, type CadBodySnapshot, type CadFeatureSummary, type WcadTopologyCheckpointPayloadInput } from "@web-cad/cad-core";
import { projectCadBatch } from "@web-cad/cad-core/preview-projection";
import type { CadBatch, CadBatchErrorResponse, CadBatchSuccessResponse, CadGeneratedFaceReference, CadOp } from "@web-cad/cad-protocol";
import type { RenderTriangleMesh } from "@web-cad/renderer";
import { createRenderMeshFromSerializableMesh } from "@web-cad/renderer-mesh-bridge";

import type { DerivedGeometryRuntime } from "./derivedGeometryRuntime";
import { createDerivedGeometrySourcesFromDocument, removeConsumedDerivedGeometrySources } from "./derivedGeometrySources";
import { resolveCurrentExactBodies, type CurrentExactBodyArtifactEvidence, type CurrentExactBodyResolution } from "./currentExactBodyResolver";
import { buildCurrentExactBodyArtifacts } from "./projectExactStepExport";
import { createGeneratedFaceReferenceKey } from "./sketchDisplayFrames";

export class ExactFeaturePreviewGeometryError extends Error {
  readonly kind: "command" | "source" | "stale";
  readonly response?: CadBatchErrorResponse;
  readonly bodyId?: string;

  constructor(
    kind: "command" | "source" | "stale",
    message: string,
    options: { readonly response?: CadBatchErrorResponse; readonly bodyId?: string } = {}
  ) {
    super(message);
    this.name = "ExactFeaturePreviewGeometryError";
    this.kind = kind;
    this.response = options.response;
    this.bodyId = options.bodyId;
  }
}

export type ExactFeaturePreviewGeometryArtifact = CurrentExactBodyArtifactEvidence;

export interface ExactFeaturePreviewGeometryInput {
  readonly engine: CadEngine;
  readonly batch: CadBatch;
  readonly bodyId?: string;
  readonly operationLabel?: string;
  readonly runtime: Pick<DerivedGeometryRuntime, "exactBodyArtifact" | "getModelWorkSnapshot" | "resumeModelWork">;
  readonly checkpointPayloads?: readonly WcadTopologyCheckpointPayloadInput[];
  readonly existingArtifacts?: readonly CurrentExactBodyArtifactEvidence[];
  readonly expectedSourceAuthorityEpoch?: number;
  readonly signal?: AbortSignal;
  readonly executionIntent?: "user" | "exact";
  readonly userKind?: "preflight" | "export";
  readonly requestIdPrefix?: string;
  readonly isCurrent?: () => boolean | void;
}

export interface ExactFeaturePreviewGeometryResult {
  readonly sourceAuthorityEpoch: number;
  readonly projectedSourceIdentity: ReturnType<typeof createCadProjectSourceIdentity>;
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

export async function projectExactFeaturePreviewGeometry(
  input: ExactFeaturePreviewGeometryInput
): Promise<ExactFeaturePreviewGeometryResult> {
  const sourceAuthorityEpoch = input.expectedSourceAuthorityEpoch ?? input.engine.getSourceAuthorityEpoch();
  const operationLabel = input.operationLabel ?? "exact feature";
  const stale = (): never => {
    throw new ExactFeaturePreviewGeometryError("stale", `The project changed while ${operationLabel} preview was running.`);
  };
  const assertCurrent = () => {
    throwIfAborted(input.signal);
    if (input.engine.getSourceAuthorityEpoch() !== sourceAuthorityEpoch || input.isCurrent?.() === false) stale();
  };

  assertCurrent();
  const projected = projectCadBatch(input.engine, input.batch);
  assertCurrent();
  if (!projected.ok) {
    throw new ExactFeaturePreviewGeometryError("command", projected.response.error.message, { response: projected.response });
  }

  const projectedEngine = projected.projectedEngine;
  assertCurrent();
  const state = readProjectedState(projectedEngine);
  const affectedBodyIds = resolveProjectedAffectedBodyIds(
    input.bodyId,
    input.batch.ops,
    state.features,
    state.bodies,
    projected.response.createdBodyIds
  );
  if (affectedBodyIds.length === 0) {
    assertCurrent();
    return { sourceAuthorityEpoch, projectedSourceIdentity: projected.sourceIdentity, response: projected.response, affectedBodyIds, artifacts: [], meshes: [] };
  }

  const artifactGeometrySources = createDerivedGeometrySourcesFromDocument(
    projectedEngine.getDocument(),
    state.features,
    state.generatedFacesByKey,
    state.sourceIdentitySignaturesByBodyId,
    true
  );
  const resolutions = resolveCurrentExactBodies({
    document: projectedEngine.getDocument(),
    bodies: state.bodies,
    features: state.features,
    geometrySources: removeConsumedDerivedGeometrySources(artifactGeometrySources, state.features),
    artifactGeometrySources,
    checkpointPayloads: input.checkpointPayloads,
    sourceIdentitySignaturesByBodyId: state.sourceIdentitySignaturesByBodyId
  });
  const readyResolutions: Extract<CurrentExactBodyResolution, { readonly status: "ready" }>[] = [];
  for (const bodyId of affectedBodyIds) {
    const ready = resolutions.find((candidate): candidate is Extract<CurrentExactBodyResolution, { readonly status: "ready" }> => candidate.bodyId === bodyId && candidate.status === "ready");
    if (!ready) {
      const blocked = resolutions.find((candidate) => candidate.bodyId === bodyId);
      throw new ExactFeaturePreviewGeometryError(
        "source",
        blocked?.diagnostics[0]?.message ?? `Could not apply this ${operationLabel} because exact source ${bodyId} is unavailable.`,
        { bodyId }
      );
    }
    readyResolutions.push(ready);
  }

  input.runtime.resumeModelWork();
  assertCurrent();
  const artifacts = await buildCurrentExactBodyArtifacts({
    engine: projectedEngine,
    resolutions: readyResolutions,
    runtime: input.runtime,
    documentSourceIdentity: projected.sourceIdentity,
    units: projectedEngine.getDocument().units,
    generation: input.runtime.getModelWorkSnapshot().generation,
    existingArtifacts: input.existingArtifacts,
    executionIntent: input.executionIntent ?? "exact",
    ...(input.userKind ? { userKind: input.userKind } : {}),
    requestIdPrefix: input.requestIdPrefix ?? "feature-preview-artifact",
    assertCurrent
  });
  assertCurrent();
  if (artifacts.length !== affectedBodyIds.length || artifacts.some((artifact, index) => artifact.bodyId !== affectedBodyIds[index])) {
    throw new ExactFeaturePreviewGeometryError("stale", `The projected ${operationLabel} result changed before preview completion.`);
  }

  const meshes = artifacts.map(({ bodyId, displayMesh }) => {
    const bridge = createRenderMeshFromSerializableMesh(displayMesh, {
      id: `preview:${bodyId}`,
      alignment: "source",
      source: bodyId,
      label: `${bodyId} preview`
    });
    return { ...bridge.mesh, presentation: "preview" as const };
  });
  assertCurrent();
  return { sourceAuthorityEpoch, projectedSourceIdentity: projected.sourceIdentity, response: projected.response, affectedBodyIds, artifacts, meshes };
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
    if ((!EXACT_DOWNSTREAM_UPDATE_OPS.has(op.op) && !op.op.startsWith("feature.update")) || !("id" in op)) continue;
    const feature = features.find((candidate) => candidate.id === op.id);
    if (feature) changedBodyIds.add(feature.bodyId);
  }
  for (const id of createdBodyIds) if (bodies.some((body) => body.id === id)) changedBodyIds.add(id);
  if (changedBodyIds.size === 0 && bodyId) changedBodyIds.add(bodyId);

  const bodiesById = new Map(bodies.map((body) => [body.id, body]));
  const featuresById = new Map(features.map((feature) => [feature.id, feature]));
  const activeBodyIds = new Set<string>();
  for (const changedBodyId of changedBodyIds) {
    let body = bodiesById.get(changedBodyId);
    const visited = new Set<string>();
    while (body?.consumedByFeatureId && !visited.has(body.id)) {
      visited.add(body.id);
      const consumer = featuresById.get(body.consumedByFeatureId);
      body = consumer ? bodiesById.get(consumer.bodyId) : undefined;
    }
    if (body && !body.consumedByFeatureId) activeBodyIds.add(body.id);
  }
  return [...activeBodyIds];
}

interface ProjectedState {
  readonly features: readonly CadFeatureSummary[];
  readonly bodies: readonly CadBodySnapshot[];
  readonly sourceIdentitySignaturesByBodyId: ReadonlyMap<string, string>;
  readonly generatedFacesByKey: ReadonlyMap<string, CadGeneratedFaceReference>;
}

function readProjectedState(engine: CadEngine): ProjectedState {
  const response = engine.executeQuery({ version: "cadops.v1", query: { query: "project.structure" } });
  const features = response.ok && response.query === "project.structure" ? response.features : [];
  const bodies = response.ok && response.query === "project.structure" ? response.bodies : [];
  const sourceIdentitySignaturesByBodyId = new Map<string, string>();
  const generatedFacesByKey = new Map<string, CadGeneratedFaceReference>();
  for (const body of bodies) {
    const topology = engine.executeQuery({ version: "cadops.v1", query: { query: "body.topology", bodyId: body.id } });
    if (topology.ok && topology.query === "body.topology") sourceIdentitySignaturesByBodyId.set(body.id, topology.topology.sourceIdentity.signature);
    if (body.source.type !== "sketchExtrudeFeature") continue;
    const references = engine.executeQuery({ version: "cadops.v1", query: { query: "body.generatedReferences", bodyId: body.id } });
    if (!references.ok || references.query !== "body.generatedReferences") continue;
    for (const face of references.faces) generatedFacesByKey.set(createGeneratedFaceReferenceKey(face.bodyId, face.stableId), face);
  }
  return { features, bodies, sourceIdentitySignaturesByBodyId, generatedFacesByKey };
}
