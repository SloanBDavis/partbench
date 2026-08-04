import {
  createCadProjectSourceIdentity,
  exportCadProject,
  sha256Hex,
  type CadEngine
} from "@web-cad/cad-core";
import type {
  CadAgentExactExportProposal,
  CadAgentExactExportRequest,
  CadAgentExactExportResult
} from "@web-cad/agent-adapter";
import {
  CAD_V21_EXACT_EXPORT_RESOURCE_LIMITS,
  validateCadExactExportPlan,
  type CadBodyDerivedExactMetadataSnapshot,
  type CadBodyExactTopologySnapshot,
  type CadExactExportPlan,
  type CadExportDiagnostic,
  type CadExportDiagnosticCode,
  type FeatureShellOpenFaceRef,
  type ProjectExactExportQueryResponse
} from "@web-cad/cad-protocol";
import {
  assertExactBodyArtifactAggregateWithinLimit,
  createExactStepExportWorkerRequest,
  type GeometryKernelExactBodyArtifact,
  type GeometryKernelExactStepExportArtifact
} from "@web-cad/geometry-worker/browser";

import {
  createCurrentExactArtifactOperandSource,
  preflightCurrentExactArtifactOperandSource,
  type CurrentExactBodyArtifactEvidence,
  type CurrentExactBodyArtifactDependency,
  type CurrentExactBodyResolution
} from "./currentExactBodyResolver";
import {
  isExactMetadataSource,
  type DerivedExactMetadataSnapshot,
  type DerivedExactMetadataSource
} from "./derivedExactMetadata";
import type { DerivedGeometryRuntime } from "./derivedGeometryRuntime";
import type { CurrentExactResultProjection } from "./currentExactResultProjection";
import type {
  CurrentExactProjectionArtifact,
  CurrentExactProjectionFailure
} from "./currentExactPipeline";
import type {
  ExactArtifactCacheCandidate,
  ExactArtifactCacheIdentity,
  ExactArtifactOpfsCache
} from "./exactArtifactOpfsCache";
import { readProjectExactStepExport } from "./projectExactExportQueries";
import { bindGeneratedFaceTopologySnapshot } from "./projectWcadTopologyCheckpoints";

export interface ProjectExactStepExportExecutionInput {
  readonly engine: CadEngine;
  readonly exactExport: ProjectExactExportQueryResponse;
  readonly resolutions: readonly CurrentExactBodyResolution[];
  readonly runtime: Pick<
    DerivedGeometryRuntime,
    "exactBodyArtifact" | "executeExactStepExport" | "getModelWorkSnapshot"
  >;
  readonly onProgress?: (progress: ProjectExactStepExportProgress) => void;
  readonly generation?: number;
  readonly existingArtifacts?: readonly CurrentExactBodyArtifactEvidence[];
  readonly artifactCache?: Pick<ExactArtifactOpfsCache, "read" | "write">;
}

type CurrentExactArtifactNode =
  | Extract<CurrentExactBodyResolution, { readonly status: "ready" }>
  | CurrentExactBodyArtifactDependency;

export interface ProjectExactStepExportProgress {
  readonly phase: "building" | "writing";
  readonly completedBodyCount: number;
  readonly totalBodyCount: number;
  readonly bodyId?: string;
}

export interface ProjectExactStepExportJobState {
  readonly status: "idle" | "running" | "complete" | "cancelled" | "failed";
  readonly requestedBodyIds?: readonly string[];
  readonly phase?: ProjectExactStepExportProgress["phase"];
  readonly completedBodyCount: number;
  readonly totalBodyCount: number;
  readonly message?: string;
  readonly diagnostics: readonly Pick<
    CadExportDiagnostic,
    "code" | "message" | "bodyId"
  >[];
}

export interface ProjectExactStepExportResult {
  readonly format: "step";
  readonly schema: "AP242DIS";
  readonly units: CadExactExportPlan["units"];
  readonly plan: CadExactExportPlan;
  readonly fileName: "partbench-export.step";
  readonly mimeType: "model/step";
  readonly bodyCount: number;
  readonly byteLength: number;
  readonly bytes: Uint8Array;
}

export interface ProjectExactStepExportRunOutcome {
  readonly job: ProjectExactStepExportJobState;
  readonly tone: "info" | "error";
  readonly artifact?: {
    readonly selectedBodyIds: readonly string[];
    readonly selectedBodyCount: number;
    readonly schema: "AP242DIS";
    readonly units: CadExactExportPlan["units"];
    readonly planIdentity: string;
    readonly byteLength: number;
    readonly sha256: string;
  };
}

export async function runProjectExactStepExport(input: {
  readonly engine: CadEngine;
  readonly exactMetadata: DerivedExactMetadataSnapshot;
  readonly currentSources: readonly DerivedExactMetadataSource[];
  readonly projections: readonly CurrentExactResultProjection[];
  readonly resolutions: readonly CurrentExactBodyResolution[];
  readonly existingArtifacts?: readonly CurrentExactBodyArtifactEvidence[];
  readonly artifactCache?: Pick<ExactArtifactOpfsCache, "read" | "write">;
  readonly runtime: Pick<
    DerivedGeometryRuntime,
    | "exactBodyArtifact"
    | "executeExactStepExport"
    | "getModelWorkSnapshot"
    | "resumeModelWork"
  >;
  readonly requestedBodyIds?: readonly string[];
  readonly expectedSourceIdentity?: CadExactExportPlan["sourceIdentity"];
  readonly expectedPlanIdentity?: string;
  readonly downloadAvailable: boolean;
  readonly onJobChange: (job: ProjectExactStepExportJobState) => void;
}): Promise<ProjectExactStepExportRunOutcome> {
  const requestedBodyIds = input.requestedBodyIds
    ? [...input.requestedBodyIds]
    : undefined;
  const finish = (
    job: ProjectExactStepExportJobState,
    tone: ProjectExactStepExportRunOutcome["tone"],
    artifact?: ProjectExactStepExportRunOutcome["artifact"]
  ) => {
    input.onJobChange(job);
    return { job, tone, ...(artifact ? { artifact } : {}) };
  };
  const failed = (
    message: string,
    totalBodyCount = 0,
    code?: CadExportDiagnosticCode
  ) =>
    finish(
      {
        status: "failed",
        ...(requestedBodyIds ? { requestedBodyIds } : {}),
        completedBodyCount: 0,
        totalBodyCount,
        message,
        diagnostics: code ? [{ code, message }] : []
      },
      "error"
    );

  if (requestedBodyIds?.length === 0) {
    return failed(
      "Choose at least one body for exact STEP export.",
      0,
      "EXPORT_BODY_SELECTION_INVALID"
    );
  }
  if (!input.downloadAvailable) {
    return failed(
      "STEP download is unavailable in this browser runtime.",
      requestedBodyIds?.length,
      "EXPORT_STEP_TRANSFER_FAILED"
    );
  }
  const exactExport = readProjectExactStepExport(
    input.engine,
    input.exactMetadata,
    input.currentSources,
    input.projections,
    requestedBodyIds,
    input.expectedSourceIdentity
  );
  if (!exactExport?.available) {
    const diagnostic = exactExport?.diagnostics.find(
      (entry) => entry.status !== "supported"
    );
    const message = diagnostic
      ? `STEP export is not ready: ${diagnostic.message}`
      : "STEP export needs a supported active authored body.";
    return finish(
      {
        status: "failed",
        ...(requestedBodyIds ? { requestedBodyIds } : {}),
        completedBodyCount: 0,
        totalBodyCount: exactExport?.bodyCount ?? requestedBodyIds?.length ?? 0,
        message,
        diagnostics: exactExport?.diagnostics ?? []
      },
      "error"
    );
  }
  if (
    input.expectedPlanIdentity &&
    exactExport.plan?.planIdentity !== input.expectedPlanIdentity
  ) {
    return failed(
      "The approved exact export plan changed before execution.",
      requestedBodyIds?.length,
      "EXPORT_SOURCE_CHANGED"
    );
  }

  input.runtime.resumeModelWork();
  const generation = input.runtime.getModelWorkSnapshot().generation;
  let currentJob: ProjectExactStepExportJobState = {
    status: "running",
    ...(requestedBodyIds ? { requestedBodyIds } : {}),
    phase: "building",
    completedBodyCount: 0,
    totalBodyCount: exactExport.plan?.bodies.length ?? exactExport.bodyCount,
    message: "Building exact body artifacts.",
    diagnostics: []
  };
  input.onJobChange(currentJob);
  try {
    const result = await executeProjectExactStepExport({
      engine: input.engine,
      exactExport,
      resolutions: input.resolutions,
      existingArtifacts: input.existingArtifacts,
      artifactCache: input.artifactCache,
      runtime: input.runtime,
      generation,
      onProgress: (progress) => {
        currentJob = {
          status: "running",
          ...(requestedBodyIds ? { requestedBodyIds } : {}),
          ...progress,
          message:
            progress.phase === "writing"
              ? "Writing the named AP242 STEP file."
              : `Built ${progress.completedBodyCount} of ${progress.totalBodyCount} exact body artifacts.`,
          diagnostics: []
        };
        input.onJobChange(currentJob);
      }
    });
    assertExactWorkCurrent(input.runtime, generation);
    if (!isExactExportPlanCurrent(input.engine, result.plan)) {
      throw new ProjectExactStepExportError(
        "EXPORT_SOURCE_CHANGED",
        "Project or selected body source identity changed before download."
      );
    }
    downloadProjectExactStepArtifact(result);
    const message = `Downloaded ${result.fileName}: ${result.bodyCount} exact bod${
      result.bodyCount === 1 ? "y" : "ies"
    }, ${result.byteLength} bytes.`;
    return finish(
      {
        status: "complete",
        ...(requestedBodyIds ? { requestedBodyIds } : {}),
        phase: "writing",
        completedBodyCount: result.bodyCount,
        totalBodyCount: result.bodyCount,
        message,
        diagnostics: []
      },
      "info",
      {
        selectedBodyIds: result.plan.orderedBodyIds,
        selectedBodyCount: result.bodyCount,
        schema: result.schema,
        units: result.units,
        planIdentity: result.plan.planIdentity,
        byteLength: result.byteLength,
        sha256: sha256Hex(result.bytes)
      }
    );
  } catch (error) {
    const cancelled = isGeometryCancellation(error);
    const detail =
      error instanceof Error
        ? error.message
        : "The geometry worker did not complete the export.";
    const code: CadExportDiagnosticCode = cancelled
      ? "EXPORT_CANCELLED"
      : error && typeof error === "object" && "code" in error
        ? (String(error.code) as CadExportDiagnosticCode)
        : "EXPORT_STEP_TRANSFER_FAILED";
    const message = cancelled
      ? "STEP export was cancelled. You can retry the same selection."
      : `STEP export failed: ${detail}`;
    return finish(
      {
        status: cancelled ? "cancelled" : "failed",
        ...(requestedBodyIds ? { requestedBodyIds } : {}),
        ...(currentJob.phase ? { phase: currentJob.phase } : {}),
        completedBodyCount: currentJob.completedBodyCount,
        totalBodyCount: currentJob.totalBodyCount,
        message,
        diagnostics: [{ code, message: detail }]
      },
      cancelled ? "info" : "error"
    );
  }
}

export type ProjectAgentExactExportPlanOutcome =
  | {
      readonly status: "proposal";
      readonly proposal: CadAgentExactExportProposal;
    }
  | {
      readonly status: "failed";
      readonly result: CadAgentExactExportResult;
    };

export function planProjectAgentExactExport(input: {
  readonly request: CadAgentExactExportRequest;
  readonly engine: CadEngine;
  readonly exactMetadata: DerivedExactMetadataSnapshot;
  readonly currentSources: readonly DerivedExactMetadataSource[];
  readonly projections: readonly CurrentExactResultProjection[];
}): ProjectAgentExactExportPlanOutcome {
  const read = (bodyIds?: readonly string[]) =>
    readProjectExactStepExport(
      input.engine,
      input.exactMetadata,
      input.currentSources,
      input.projections,
      bodyIds,
      input.request.expectedSourceIdentity
    );
  const strict =
    input.request.selection.mode === "readySubset" ? read() : undefined;
  const bodyIds =
    input.request.selection.mode === "bodyIds"
      ? input.request.selection.bodyIds
      : input.request.selection.mode === "readySubset"
        ? strict?.readySubset?.orderedBodyIds
        : undefined;
  const exact =
    input.request.selection.mode === "readySubset" && !bodyIds?.length
      ? strict
      : read(bodyIds);
  if (exact?.available && exact.plan) {
    const warnings =
      input.request.selection.mode === "readySubset"
        ? (strict?.readySubset?.excludedBodies ?? []).map((body) =>
            `${body.bodyName} (${body.bodyId}) excluded: ${
              body.diagnostics[0]?.message ?? "exact result not ready"
            }`.slice(0, 4_096)
          )
        : [];
    return {
      status: "proposal",
      proposal: {
        requestId: input.request.requestId,
        sourceIdentity: exact.plan.sourceIdentity,
        plan: exact.plan,
        warnings
      }
    };
  }

  const selectedBodyIds =
    input.request.selection.mode === "readySubset"
      ? (bodyIds ?? [])
      : (bodyIds ?? exact?.plan?.orderedBodyIds ?? []);
  const diagnostics = (exact?.diagnostics ?? []).map(
    ({ code, message, bodyId, expected, received }) => ({
      code,
      message,
      ...(bodyId ? { bodyId } : {}),
      ...(expected ? { expected } : {}),
      ...(received ? { received } : {})
    })
  );
  if (diagnostics.length === 0) {
    diagnostics.push({
      code: "EXPORT_BODY_SELECTION_INVALID",
      message:
        input.request.selection.mode === "readySubset"
          ? "No active exact-ready body is available for the requested subset."
          : "The requested exact export plan is not ready."
    });
  }
  return {
    status: "failed",
    result: {
      requestId: input.request.requestId,
      status: "failed",
      selectedBodyIds,
      selectedBodyCount: selectedBodyIds.length,
      schema: "AP242DIS",
      units: exact?.units ?? strict?.units ?? input.engine.getDocument().units,
      ...(exact?.plan?.planIdentity
        ? { planIdentity: exact.plan.planIdentity }
        : {}),
      diagnostics
    }
  };
}

export async function runProjectAgentExactExport(input: {
  readonly proposal: CadAgentExactExportProposal;
  readonly engine: CadEngine;
  readonly exactMetadata: DerivedExactMetadataSnapshot;
  readonly currentSources: readonly DerivedExactMetadataSource[];
  readonly projections: readonly CurrentExactResultProjection[];
  readonly resolutions: readonly CurrentExactBodyResolution[];
  readonly existingArtifacts?: readonly CurrentExactBodyArtifactEvidence[];
  readonly artifactCache?: Pick<ExactArtifactOpfsCache, "read" | "write">;
  readonly runtime: Pick<
    DerivedGeometryRuntime,
    | "exactBodyArtifact"
    | "executeExactStepExport"
    | "getModelWorkSnapshot"
    | "resumeModelWork"
  >;
  readonly downloadAvailable: boolean;
  readonly onJobChange: (job: ProjectExactStepExportJobState) => void;
}): Promise<CadAgentExactExportResult> {
  const outcome = await runProjectExactStepExport({
    engine: input.engine,
    exactMetadata: input.exactMetadata,
    currentSources: input.currentSources,
    projections: input.projections,
    resolutions: input.resolutions,
    existingArtifacts: input.existingArtifacts,
    artifactCache: input.artifactCache,
    runtime: input.runtime,
    requestedBodyIds: input.proposal.plan.orderedBodyIds,
    expectedSourceIdentity: input.proposal.sourceIdentity,
    expectedPlanIdentity: input.proposal.plan.planIdentity,
    downloadAvailable: input.downloadAvailable,
    onJobChange: input.onJobChange
  });
  const artifact = outcome.artifact;
  return {
    requestId: input.proposal.requestId,
    status: artifact
      ? "downloadRequested"
      : outcome.job.status === "cancelled"
        ? "cancelled"
        : outcome.job.diagnostics.some(
              (diagnostic) => diagnostic.code === "EXPORT_SOURCE_CHANGED"
            )
          ? "stale"
          : "failed",
    selectedBodyIds: input.proposal.plan.orderedBodyIds,
    selectedBodyCount: input.proposal.plan.orderedBodyIds.length,
    schema: "AP242DIS",
    units: input.proposal.plan.units,
    planIdentity: input.proposal.plan.planIdentity,
    ...(artifact
      ? {
          artifactByteLength: artifact.byteLength,
          artifactSha256: artifact.sha256
        }
      : {}),
    diagnostics: outcome.job.diagnostics
  };
}

export function downloadProjectExactStepArtifact(
  result: Pick<ProjectExactStepExportResult, "bytes" | "fileName" | "mimeType">
): void {
  const blob = new Blob([result.bytes as Uint8Array<ArrayBuffer>], {
    type: result.mimeType
  });
  const url = URL.createObjectURL(blob);
  let link: HTMLAnchorElement | undefined;
  try {
    link = document.createElement("a");
    link.href = url;
    link.download = result.fileName;
    document.body.append(link);
    link.click();
  } finally {
    link?.remove();
    URL.revokeObjectURL(url);
  }
}

export class ProjectExactStepExportError extends Error {
  readonly code: CadExportDiagnosticCode;
  override readonly cause?: unknown;

  constructor(code: CadExportDiagnosticCode, message: string, cause?: unknown) {
    super(message);
    this.name = "ProjectExactStepExportError";
    this.code = code;
    this.cause = cause;
  }
}

export interface CurrentExactBodyArtifactBuildInput {
  readonly engine: CadEngine;
  readonly resolutions: readonly Extract<
    CurrentExactBodyResolution,
    { readonly status: "ready" }
  >[];
  readonly runtime: Pick<
    DerivedGeometryRuntime,
    "exactBodyArtifact" | "getModelWorkSnapshot"
  >;
  readonly documentSourceIdentity: CadExactExportPlan["sourceIdentity"];
  readonly units: CadExactExportPlan["units"];
  readonly assertCurrent: () => void;
  readonly generation?: number;
  readonly existingArtifacts?: readonly CurrentExactBodyArtifactEvidence[];
  readonly artifactCache?: Pick<ExactArtifactOpfsCache, "read" | "write">;
  readonly executionIntent?: "user" | "exact";
  readonly userKind?: "preflight" | "export";
  readonly requestIdPrefix?: string;
  readonly onArtifactBuilt?: (input: {
    readonly bodyId: string;
    readonly completedBodyCount: number;
    readonly totalBodyCount: number;
  }) => void;
}

export async function buildCurrentExactProjectionArtifacts(input: {
  readonly engine: CadEngine;
  readonly resolutions: readonly Extract<
    CurrentExactBodyResolution,
    { readonly status: "ready" }
  >[];
  readonly runtime: Pick<
    DerivedGeometryRuntime,
    "exactBodyArtifact" | "getModelWorkSnapshot"
  >;
  readonly documentSourceIdentity: CadExactExportPlan["sourceIdentity"];
  readonly units: CadExactExportPlan["units"];
  readonly generation: number;
  readonly sourceAuthorityEpoch: number;
  readonly existingArtifacts: readonly CurrentExactProjectionArtifact[];
  readonly artifactCache?: Pick<ExactArtifactOpfsCache, "read" | "write">;
  readonly isActive: () => boolean;
  readonly onChange: (state: {
    readonly retainedArtifacts: readonly CurrentExactProjectionArtifact[];
    readonly artifacts: readonly CurrentExactProjectionArtifact[];
    readonly failures: readonly CurrentExactProjectionFailure[];
  }) => void;
}): Promise<void> {
  const assertCurrent = () => {
    const identity = createCadProjectSourceIdentity(
      exportCadProject(input.engine)
    );
    if (
      !input.isActive() ||
      input.engine.getSourceAuthorityEpoch() !== input.sourceAuthorityEpoch ||
      identity.algorithm !== input.documentSourceIdentity.algorithm ||
      identity.sha256 !== input.documentSourceIdentity.sha256
    ) {
      throw new Error("Current exact artifact source changed during build.");
    }
  };
  const retained = new Map(
    input.existingArtifacts
      .filter(
        (artifact) =>
          artifact.documentSourceIdentity.algorithm ===
            input.documentSourceIdentity.algorithm &&
          artifact.documentSourceIdentity.sha256 ===
            input.documentSourceIdentity.sha256
      )
      .map((artifact) => [artifact.bodyId, artifact] as const)
  );
  const artifacts = input.resolutions.flatMap((resolution) => {
    const artifact = retained.get(resolution.bodyId);
    return artifact &&
      artifact.bodySourceIdentitySignature ===
        resolution.sourceIdentitySignature &&
      artifact.sourceCacheKeySha256 === resolution.cacheKeySha256
      ? [artifact]
      : [];
  });
  const failures: CurrentExactProjectionFailure[] = [];
  const publish = () =>
    input.onChange({
      retainedArtifacts: [...retained.values()],
      artifacts: [...artifacts],
      failures: [...failures]
    });
  publish();

  for (const resolution of input.resolutions) {
    if (!input.isActive()) return;
    if (artifacts.some((artifact) => artifact.bodyId === resolution.bodyId)) {
      continue;
    }
    try {
      const [artifact] = await buildCurrentExactBodyArtifacts({
        engine: input.engine,
        resolutions: [resolution],
        runtime: input.runtime,
        documentSourceIdentity: input.documentSourceIdentity,
        units: input.units,
        assertCurrent,
        generation: input.generation,
        existingArtifacts: [...retained.values()],
        artifactCache: input.artifactCache,
        executionIntent: "exact",
        requestIdPrefix: "current-exact-projection"
      });
      if (artifact) {
        retained.set(artifact.bodyId, artifact);
        assertArtifactAggregateWithinLimit([...retained.values()]);
        artifacts.push(artifact);
      }
    } catch (error) {
      if (!input.isActive()) return;
      failures.push({
        bodyId: resolution.bodyId,
        sourceType: resolution.sourceType,
        cacheKeySha256: resolution.cacheKeySha256,
        status: isGeometryCancellation(error) ? "cancelled" : "error",
        error
      });
    }
    publish();
  }
}

export async function buildCurrentExactBodyArtifacts({
  engine,
  resolutions,
  runtime,
  documentSourceIdentity,
  units,
  assertCurrent,
  generation: expectedGeneration,
  existingArtifacts = [],
  artifactCache,
  executionIntent = "user",
  userKind = "export",
  requestIdPrefix = "current-exact-artifact",
  onArtifactBuilt
}: CurrentExactBodyArtifactBuildInput): Promise<
  CurrentExactBodyArtifactEvidence[]
> {
  const generation =
    expectedGeneration ?? runtime.getModelWorkSnapshot().generation;
  assertExactWorkCurrent(runtime, generation);
  assertCurrent();
  if (
    new Set(resolutions.map(({ bodyId }) => bodyId)).size !== resolutions.length
  ) {
    throw new ProjectExactStepExportError(
      "EXPORT_EXACT_ARTIFACT_INVALID",
      "Exact artifact resolution ownership is duplicated."
    );
  }

  const artifactKeysByBodyId = new Map<string, string>();
  const nodesByKey = new Map<string, CurrentExactArtifactNode>();
  const shapePoliciesByKey = new Map<
    string,
    GeometryKernelExactBodyArtifact["shapePolicy"]
  >();
  const consumerCounts = new Map<string, number>();
  const selectedKeys = new Set(resolutions.map(createArtifactNodeKey));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  for (const root of resolutions) {
    const stack: {
      readonly node: CurrentExactArtifactNode;
      readonly expanded: boolean;
    }[] = [{ node: root, expanded: false }];
    while (stack.length > 0) {
      const { node, expanded } = stack.pop()!;
      const key = createArtifactNodeKey(node);
      if (expanded) {
        const dependencyPolicy = node.artifactDependency
          ? shapePoliciesByKey.get(
              createArtifactNodeKey(node.artifactDependency)
            )
          : undefined;
        try {
          shapePoliciesByKey.set(
            key,
            preflightCurrentExactArtifactOperandSource(
              node.source,
              dependencyPolicy
            )
          );
        } catch (error) {
          throw new ProjectExactStepExportError(
            "EXPORT_EXACT_ARTIFACT_INVALID",
            `Exact dependency ${node.bodyId} is invalid: ${getErrorMessage(error)}`
          );
        }
        visiting.delete(key);
        visited.add(key);
        continue;
      }

      const existing = artifactKeysByBodyId.get(node.bodyId);
      if (existing && existing !== key) {
        throw new ProjectExactStepExportError(
          "EXPORT_EXACT_ARTIFACT_INVALID",
          `Exact dependency ${node.bodyId} has conflicting current identities.`
        );
      }
      if (visiting.has(key)) {
        throw new ProjectExactStepExportError(
          "EXPORT_EXACT_ARTIFACT_INVALID",
          "Exact artifact dependency graph is cyclic."
        );
      }
      if (visited.has(key)) continue;
      if (!existing) {
        artifactKeysByBodyId.set(node.bodyId, key);
        nodesByKey.set(key, node);
        if (
          artifactKeysByBodyId.size >
          CAD_V21_EXACT_EXPORT_RESOURCE_LIMITS.maxSourceGraphNodes
        ) {
          throw new ProjectExactStepExportError(
            "EXPORT_EXACT_ARTIFACT_LIMIT_EXCEEDED",
            `Exact dependency plan exceeds ${CAD_V21_EXACT_EXPORT_RESOURCE_LIMITS.maxSourceGraphNodes} bodies.`
          );
        }
        if (node.artifactDependency) {
          const childKey = createArtifactNodeKey(node.artifactDependency);
          consumerCounts.set(childKey, (consumerCounts.get(childKey) ?? 0) + 1);
        }
      }
      visiting.add(key);
      stack.push({ node, expanded: true });
      if (node.artifactDependency) {
        stack.push({ node: node.artifactDependency, expanded: false });
      }
    }
  }
  for (const node of nodesByKey.values()) {
    assertExactWorkCurrent(runtime, generation);
    assertBodySourceIdentityCurrent(
      engine,
      node.bodyId,
      node.sourceIdentitySignature
    );
  }
  assertCurrent();

  const artifacts: CurrentExactBodyArtifactEvidence[] = [];
  const artifactsByKey = new Map<string, CurrentExactBodyArtifactEvidence>();
  for (const existingArtifact of existingArtifacts) {
    const key = artifactKeysByBodyId.get(existingArtifact.bodyId);
    const node = key ? nodesByKey.get(key) : undefined;
    const shapePolicy = key ? shapePoliciesByKey.get(key) : undefined;
    if (!key || !node || !shapePolicy || artifactsByKey.has(key)) continue;
    assertArtifactMatchesIdentity(existingArtifact, {
      bodyId: node.bodyId,
      sourceType: node.sourceType,
      sourceIdentitySignature: node.sourceIdentitySignature,
      sourceCacheKeySha256: node.cacheKeySha256,
      sourceGraphNodeCount: node.artifactDependency
        ? 2
        : node.sourceGraphNodeCount,
      shapePolicy,
      units,
      ...(selectedKeys.has(key) ? { documentSourceIdentity } : {})
    });
    const evidence = existingArtifact;
    assertArtifactAggregateWithinLimit([...artifactsByKey.values(), evidence]);
    artifactsByKey.set(key, evidence);
  }
  const buildArtifact = async (
    root: CurrentExactArtifactNode
  ): Promise<CurrentExactBodyArtifactEvidence> => {
    const pending: CurrentExactArtifactNode[] = [];
    for (
      let node: CurrentExactArtifactNode | undefined = root;
      node && !artifactsByKey.has(createArtifactNodeKey(node));
      node = node.artifactDependency
    ) {
      pending.push(node);
    }

    while (pending.length > 0) {
      const node = pending.pop()!;
      const key = createArtifactNodeKey(node);
      const dependencyArtifact = node.artifactDependency
        ? artifactsByKey.get(createArtifactNodeKey(node.artifactDependency))
        : undefined;
      assertExactWorkCurrent(runtime, generation);
      assertCurrent();
      assertBodySourceIdentityCurrent(
        engine,
        node.bodyId,
        node.sourceIdentitySignature
      );
      const shellOpenFaceLocalIds =
        node.source.kind === "shell" && dependencyArtifact
          ? resolveCurrentShellArtifactFaceLocalIds(
              engine,
              node.source.openFaceRefs,
              dependencyArtifact,
              node.artifactDependency &&
                isExactMetadataSource(node.artifactDependency.source)
                ? node.artifactDependency.source
                : undefined
            )
          : undefined;
      const source = createCurrentExactArtifactOperandSource(
        node.source,
        dependencyArtifact,
        shellOpenFaceLocalIds
      );
      const sourceGraphNodeCount = dependencyArtifact
        ? 2
        : node.sourceGraphNodeCount;
      const shapePolicy = shapePoliciesByKey.get(key);
      if (!shapePolicy) {
        throw new ProjectExactStepExportError(
          "EXPORT_EXACT_ARTIFACT_INVALID",
          `Exact dependency ${node.bodyId} was not preflighted.`
        );
      }
      const identity: ExactArtifactCacheIdentity = {
        bodyId: node.bodyId,
        sourceType: node.sourceType,
        documentSourceIdentity,
        bodySourceIdentitySignature: node.sourceIdentitySignature,
        sourceCacheKeySha256: node.cacheKeySha256,
        sourceGraphNodeCount,
        shapePolicy,
        units
      };
      const context =
        executionIntent === "user"
          ? ({ intent: "user", userKind } as const)
          : ({
              sourceId: node.bodyId,
              cacheKey: key,
              documentRevision: generation
            } as const);
      const isCacheCurrent = () => {
        try {
          assertExactWorkCurrent(runtime, generation);
          assertCurrent();
          assertBodySourceIdentityCurrent(
            engine,
            node.bodyId,
            node.sourceIdentitySignature
          );
          return true;
        } catch {
          return false;
        }
      };
      const validateCachedArtifact = async (
        candidate: ExactArtifactCacheCandidate
      ): Promise<GeometryKernelExactBodyArtifact> =>
        (
          await runtime.exactBodyArtifact(
            {
              id: `${requestIdPrefix}-cache-${artifactsByKey.size}`,
              ...identity,
              source: {
                kind: "bodyArtifact",
                artifactVersion: "partbench.exact-body-artifact.v1",
                ...identity,
                ...candidate
              }
            },
            context
          )
        ).artifact;
      const cached = artifactCache
        ? await artifactCache.read({
            identity,
            isCurrent: isCacheCurrent,
            validate: validateCachedArtifact
          })
        : undefined;
      const built =
        cached?.status === "hit"
          ? cached.artifact
          : (
              await runtime.exactBodyArtifact(
                {
                  id: `${requestIdPrefix}-${artifactsByKey.size}`,
                  ...identity,
                  source
                },
                context
              )
            ).artifact;
      assertArtifactMatchesIdentity(built, {
        bodyId: node.bodyId,
        sourceType: node.sourceType,
        sourceIdentitySignature: node.sourceIdentitySignature,
        sourceCacheKeySha256: node.cacheKeySha256,
        sourceGraphNodeCount,
        shapePolicy,
        units,
        documentSourceIdentity
      });
      assertExactWorkCurrent(runtime, generation);
      assertCurrent();
      assertBodySourceIdentityCurrent(
        engine,
        node.bodyId,
        node.sourceIdentitySignature
      );
      if (artifactCache && cached?.status !== "hit") {
        await artifactCache.write({
          artifact: built,
          isCurrent: isCacheCurrent
        });
      }
      const evidence = built;
      assertArtifactAggregateWithinLimit([
        ...artifactsByKey.values(),
        evidence
      ]);
      artifactsByKey.set(key, evidence);
      if (node.artifactDependency) {
        const childKey = createArtifactNodeKey(node.artifactDependency);
        const remaining = (consumerCounts.get(childKey) ?? 1) - 1;
        consumerCounts.set(childKey, remaining);
        if (remaining === 0 && !selectedKeys.has(childKey)) {
          artifactsByKey.delete(childKey);
        }
      }
    }
    const artifact = artifactsByKey.get(createArtifactNodeKey(root));
    if (!artifact) {
      throw new ProjectExactStepExportError(
        "EXPORT_EXACT_ARTIFACT_INVALID",
        `Exact artifact ${root.bodyId} was released before its consumer.`
      );
    }
    return artifact;
  };

  let complete = false;
  try {
    for (const resolution of resolutions) {
      assertExactWorkCurrent(runtime, generation);
      assertCurrent();

      let artifact: CurrentExactBodyArtifactEvidence;
      try {
        artifact = await buildArtifact(resolution);
      } catch (error) {
        if (
          isGeometryCancellation(error) ||
          error instanceof ProjectExactStepExportError
        )
          throw error;
        throw new ProjectExactStepExportError(
          "EXPORT_EXACT_ARTIFACT_FAILED",
          `Exact artifact build failed for body ${resolution.bodyId}: ${getErrorMessage(error)}`,
          error
        );
      }
      artifacts.push(artifact);
      assertExactWorkCurrent(runtime, generation);
      assertCurrent();
      onArtifactBuilt?.({
        bodyId: resolution.bodyId,
        completedBodyCount: artifacts.length,
        totalBodyCount: resolutions.length
      });
    }
    complete = true;
    return artifacts;
  } finally {
    artifactsByKey.clear();
    nodesByKey.clear();
    shapePoliciesByKey.clear();
    artifactKeysByBodyId.clear();
    consumerCounts.clear();
    selectedKeys.clear();
    if (!complete) artifacts.length = 0;
  }
}

export async function executeProjectExactStepExport({
  engine,
  exactExport,
  resolutions,
  runtime,
  onProgress,
  generation: expectedGeneration,
  existingArtifacts,
  artifactCache
}: ProjectExactStepExportExecutionInput): Promise<ProjectExactStepExportResult> {
  const plan = requireReadyPlan(exactExport);
  assertExactExportPlanCurrent(engine, plan);
  const generation =
    expectedGeneration ?? runtime.getModelWorkSnapshot().generation;
  assertExactWorkCurrent(runtime, generation);
  onProgress?.({
    phase: "building",
    completedBodyCount: 0,
    totalBodyCount: plan.bodies.length
  });
  const resolutionsByBodyId = new Map(
    resolutions.map((resolution) => [resolution.bodyId, resolution] as const)
  );
  if (resolutionsByBodyId.size !== resolutions.length) {
    throw new ProjectExactStepExportError(
      "EXPORT_EXACT_ARTIFACT_INVALID",
      "Exact export body resolution ownership is duplicated."
    );
  }

  const selectedNodes = plan.bodies.map((body) => {
    const resolution = resolutionsByBodyId.get(body.bodyId);
    if (
      !resolution ||
      resolution.status !== "ready" ||
      resolution.sourceType !== body.sourceType ||
      resolution.sourceIdentitySignature !== body.sourceIdentitySignature
    ) {
      throw new ProjectExactStepExportError(
        "EXPORT_SOURCE_CHANGED",
        `Body ${body.bodyId} no longer matches the exact export plan.`
      );
    }
    return resolution;
  });

  let artifacts: CurrentExactBodyArtifactEvidence[] = [];
  try {
    artifacts = await buildCurrentExactBodyArtifacts({
      engine,
      resolutions: selectedNodes,
      runtime,
      documentSourceIdentity: plan.sourceIdentity,
      units: plan.units,
      assertCurrent: () => assertExactExportPlanCurrent(engine, plan),
      generation,
      existingArtifacts,
      artifactCache,
      requestIdPrefix: "exact-export-artifact",
      onArtifactBuilt: ({ bodyId, completedBodyCount, totalBodyCount }) =>
        onProgress?.({
          phase: "building",
          completedBodyCount,
          totalBodyCount,
          bodyId
        })
    });

    onProgress?.({
      phase: "writing",
      completedBodyCount: artifacts.length,
      totalBodyCount: plan.bodies.length
    });
    assertExactWorkCurrent(runtime, generation);
    const request = createExactStepExportWorkerRequest({
      id: `exact-step-${plan.planIdentity.slice(0, 16)}`,
      units: plan.units,
      bodies: artifacts.map((artifact, index) => ({
        bodyId: plan.bodies[index]!.bodyId,
        bodyName: plan.bodies[index]!.bodyName,
        brepFormat: artifact.brepFormat,
        brepByteLength: artifact.brepByteLength,
        brepSha256: artifact.brepSha256,
        brepBytes: artifact.brepBytes
      }))
    });
    let response: Awaited<ReturnType<typeof runtime.executeExactStepExport>>;
    try {
      response = await runtime.executeExactStepExport(request);
    } catch (error) {
      if (isGeometryCancellation(error)) throw error;
      throw new ProjectExactStepExportError(
        "EXPORT_EXACT_WRITER_FAILED",
        `Named AP242 writer failed: ${getErrorMessage(error)}`
      );
    }
    if (!response.response.ok) {
      throw new ProjectExactStepExportError(
        "EXPORT_EXACT_WRITER_FAILED",
        `Named AP242 writer failed: ${response.response.error.message}`
      );
    }
    const step = response.response.artifact;
    assertStepArtifactMatchesPlan(step, plan);
    assertExactWorkCurrent(runtime, generation);
    assertExactExportPlanCurrent(engine, plan);

    return {
      format: "step",
      schema: "AP242DIS",
      units: plan.units,
      plan,
      fileName: "partbench-export.step",
      mimeType: "model/step",
      bodyCount: step.bodyCount,
      byteLength: step.byteLength,
      bytes: step.bytes
    };
  } finally {
    artifacts.length = 0;
  }
}

export function isExactExportPlanCurrent(
  engine: CadEngine,
  plan: CadExactExportPlan
): boolean {
  const sourceIdentity = createCadProjectSourceIdentity(engine.exportProject());
  if (
    sourceIdentity.algorithm !== plan.sourceIdentity.algorithm ||
    sourceIdentity.sha256 !== plan.sourceIdentity.sha256
  ) {
    return false;
  }
  return plan.bodies.every((body) => {
    const response = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "body.topology", bodyId: body.bodyId }
    });
    return (
      response.ok &&
      response.query === "body.topology" &&
      response.topology.sourceIdentity.signature ===
        body.sourceIdentitySignature
    );
  });
}

function requireReadyPlan(
  exactExport: ProjectExactExportQueryResponse
): CadExactExportPlan {
  const validation = validateCadExactExportPlan(exactExport.plan);
  if (
    exactExport.format !== "step" ||
    !exactExport.available ||
    !validation.ok ||
    validation.value.bodies.length === 0 ||
    validation.value.bodies.some((body) => body.status !== "ready")
  ) {
    throw new ProjectExactStepExportError(
      "EXPORT_EXACT_ARTIFACT_INVALID",
      "Exact STEP export requires one current all-ready AP242 plan."
    );
  }
  return validation.value;
}

function assertExactExportPlanCurrent(
  engine: CadEngine,
  plan: CadExactExportPlan
): void {
  if (!isExactExportPlanCurrent(engine, plan)) {
    throw new ProjectExactStepExportError(
      "EXPORT_SOURCE_CHANGED",
      "Project or selected body source identity changed during exact export."
    );
  }
}

function assertArtifactMatchesIdentity(
  artifact: GeometryKernelExactBodyArtifact,
  expected: {
    readonly bodyId: string;
    readonly sourceType: string;
    readonly sourceIdentitySignature: string;
    readonly sourceCacheKeySha256: string;
    readonly sourceGraphNodeCount: number;
    readonly shapePolicy: GeometryKernelExactBodyArtifact["shapePolicy"];
    readonly units: CadExactExportPlan["units"];
    readonly documentSourceIdentity?: CadExactExportPlan["sourceIdentity"];
  }
): void {
  if (
    artifact.bodyId !== expected.bodyId ||
    artifact.sourceType !== expected.sourceType ||
    (expected.documentSourceIdentity !== undefined &&
      (artifact.documentSourceIdentity.algorithm !==
        expected.documentSourceIdentity.algorithm ||
        artifact.documentSourceIdentity.sha256 !==
          expected.documentSourceIdentity.sha256)) ||
    artifact.bodySourceIdentitySignature !== expected.sourceIdentitySignature ||
    artifact.sourceCacheKeySha256 !== expected.sourceCacheKeySha256 ||
    artifact.sourceGraphNodeCount !== expected.sourceGraphNodeCount ||
    artifact.shapePolicy !== expected.shapePolicy ||
    artifact.units !== expected.units ||
    artifact.artifactVersion !== "partbench.exact-body-artifact.v1" ||
    artifact.brepFormat !== "occt-brep" ||
    artifact.brepWriter !== "BRepTools.Write_3" ||
    artifact.brepByteLength !== artifact.brepBytes.byteLength ||
    artifact.brepByteLength <= 0 ||
    !/^[0-9a-f]{64}$/.test(artifact.brepSha256) ||
    sha256Hex(artifact.brepBytes) !== artifact.brepSha256 ||
    artifact.metadata.topologyCounts.solidCount <= 0 ||
    artifact.metadata.topologyCounts.solidCount !==
      artifact.topologySnapshot.entityCounts.solidCount ||
    !artifact.topologySnapshot.signature
  ) {
    throw new ProjectExactStepExportError(
      "EXPORT_EXACT_ARTIFACT_INVALID",
      `Exact artifact evidence mismatched the plan for body ${expected.bodyId}.`
    );
  }
}

function createArtifactNodeKey(node: CurrentExactArtifactNode): string {
  return `${node.bodyId}\u0000${node.sourceIdentitySignature}\u0000${node.cacheKeySha256}`;
}

function resolveCurrentShellArtifactFaceLocalIds(
  engine: CadEngine,
  refs: readonly FeatureShellOpenFaceRef[],
  artifact: CurrentExactBodyArtifactEvidence,
  source?: DerivedExactMetadataSource
): readonly string[] {
  if (artifact.topologySnapshot.entityCounts.solidCount !== 1) {
    throw new ProjectExactStepExportError(
      "SHELL_TARGET_MULTI_SOLID_UNSUPPORTED",
      `Shell target ${artifact.bodyId} must contain exactly one solid.`
    );
  }
  if (refs.length === 0) return [];

  const document = engine.getDocument();
  let topologySnapshot: CadBodyExactTopologySnapshot =
    artifact.topologySnapshot;
  if (source) {
    const currentIdentity = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "body.topologyIdentity", bodyId: artifact.bodyId }
    });
    if (
      currentIdentity.ok &&
      currentIdentity.query === "body.topologyIdentity"
    ) {
      for (const ref of refs) {
        const named =
          ref.kind === "namedReference"
            ? document.namedReferences.get(ref.name)
            : undefined;
        const stableId =
          ref.kind === "generatedFace"
            ? ref.stableId
            : named?.kind === "face" && named.bodyId === artifact.bodyId
              ? named.stableId
              : undefined;
        if (!stableId) continue;
        const candidate = currentIdentity.candidates.find(
          (entry) => entry.stableId === stableId
        );
        if (!candidate?.geometrySignature) continue;
        topologySnapshot =
          bindGeneratedFaceTopologySnapshot({
            topologySnapshot,
            source,
            stableId,
            geometrySignature: candidate.geometrySignature
          }) ?? topologySnapshot;
      }
    }
  }

  const derivedExactMetadata: CadBodyDerivedExactMetadataSnapshot = {
    bodyId: artifact.bodyId,
    sourceIdentitySignature: artifact.bodySourceIdentitySignature,
    status: "ready",
    metadata: {
      source: "kernel-derived",
      confidence: "kernel-derived",
      topologySnapshot,
      diagnostics: topologySnapshot.diagnostics
    }
  };
  const identity = engine.executeQuery({
    version: "cadops.v1",
    query: {
      query: "body.topologyIdentity",
      bodyId: artifact.bodyId,
      derivedExactMetadata
    }
  });
  if (!identity.ok || identity.query !== "body.topologyIdentity") {
    throw new ProjectExactStepExportError(
      "EXPORT_EXACT_ARTIFACT_INVALID",
      identity.ok
        ? `Body ${artifact.bodyId} returned ${identity.query} while resolving shell faces.`
        : identity.error.message
    );
  }
  return refs.map((ref) => {
    let label: string;
    let matches: typeof identity.candidates;
    if (ref.kind === "generatedFace") {
      label = ref.stableId;
      matches =
        ref.bodyId === artifact.bodyId
          ? identity.candidates.filter(
              (candidate) => candidate.stableId === ref.stableId
            )
          : [];
    } else if (ref.kind === "namedReference") {
      const named = document.namedReferences.get(ref.name);
      label = ref.name;
      matches =
        named?.kind === "face" && named.bodyId === artifact.bodyId
          ? identity.candidates.filter(
              (candidate) => candidate.stableId === named.stableId
            )
          : [];
    } else {
      const anchor = document.topologyIdentity?.anchors.find(
        (candidate) => candidate.anchorId === ref.anchorId
      );
      label = ref.anchorId;
      if (
        !anchor ||
        anchor.state !== "active" ||
        anchor.entityKind !== "face" ||
        anchor.bodyId !== artifact.bodyId ||
        ref.bodyId !== artifact.bodyId
      ) {
        throw new ProjectExactStepExportError(
          "EXPORT_EXACT_ARTIFACT_INVALID",
          `Shell topology face ${ref.anchorId} is ${anchor?.state ?? "missing"} on ${artifact.bodyId}.`
        );
      }
      const checkpointEntities = artifact.topologySnapshot.entities.filter(
        (entity) => entity.localId === anchor.checkpointEntityId
      );
      if (
        checkpointEntities.length === 1 &&
        checkpointEntities[0]?.kind === "face"
      ) {
        return checkpointEntities[0].localId;
      }
      if (checkpointEntities.length > 0) {
        throw new ProjectExactStepExportError(
          "EXPORT_EXACT_ARTIFACT_INVALID",
          `Shell topology face ${ref.anchorId} does not identify one face on ${artifact.bodyId}.`
        );
      }
      matches = anchor.stableId
        ? identity.candidates.filter(
            (candidate) => candidate.stableId === anchor.stableId
          )
        : anchor.sourceSemanticRole
          ? identity.candidates.filter(
              (candidate) =>
                candidate.sourceSemanticRole === anchor.sourceSemanticRole
            )
          : [];
    }
    const candidate = matches.length === 1 ? matches[0] : undefined;
    if (
      !candidate ||
      candidate.status !== "bound" ||
      candidate.kind !== "face" ||
      !candidate.checkpointEntityId
    ) {
      throw new ProjectExactStepExportError(
        "EXPORT_EXACT_ARTIFACT_INVALID",
        `Shell face ${label} on ${artifact.bodyId} is ${
          candidate?.status ?? (matches.length > 1 ? "ambiguous" : "missing")
        } in the current exact topology.`
      );
    }
    const entity = artifact.topologySnapshot.entities.find(
      (entry) => entry.localId === candidate.checkpointEntityId
    );
    if (!entity || entity.kind !== "face") {
      throw new ProjectExactStepExportError(
        "EXPORT_EXACT_ARTIFACT_INVALID",
        `Shell face ${label} does not resolve to a current exact topology face on ${artifact.bodyId}.`
      );
    }
    return entity.localId;
  });
}

function assertArtifactAggregateWithinLimit(
  artifacts: readonly Pick<GeometryKernelExactBodyArtifact, "brepByteLength">[]
): void {
  try {
    assertExactBodyArtifactAggregateWithinLimit(artifacts);
  } catch {
    throw new ProjectExactStepExportError(
      "EXPORT_EXACT_ARTIFACT_LIMIT_EXCEEDED",
      "Exact export artifacts exceed the 512 MiB aggregate limit."
    );
  }
}

function assertBodySourceIdentityCurrent(
  engine: CadEngine,
  bodyId: string,
  sourceIdentitySignature: string
): void {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "body.topology", bodyId }
  });
  if (
    !response.ok ||
    response.query !== "body.topology" ||
    response.topology.sourceIdentity.signature !== sourceIdentitySignature
  ) {
    throw new ProjectExactStepExportError(
      "EXPORT_SOURCE_CHANGED",
      `Body ${bodyId} source identity changed during exact dependency construction.`
    );
  }
}

function assertExactWorkCurrent(
  runtime: Pick<DerivedGeometryRuntime, "getModelWorkSnapshot">,
  generation: number
): void {
  const snapshot = runtime.getModelWorkSnapshot();
  if (snapshot.stopped || snapshot.generation !== generation) {
    throw new ProjectExactStepExportError(
      "EXPORT_CANCELLED",
      "Exact dependency construction was cancelled or replaced."
    );
  }
}

function assertStepArtifactMatchesPlan(
  artifact: GeometryKernelExactStepExportArtifact,
  plan: CadExactExportPlan
): void {
  if (
    artifact.format !== "step" ||
    artifact.schema !== "AP242DIS" ||
    artifact.units !== plan.units ||
    artifact.bodyCount !== plan.bodies.length ||
    artifact.byteLength !== artifact.bytes.byteLength ||
    artifact.byteLength <= 0
  ) {
    throw new ProjectExactStepExportError(
      "EXPORT_STEP_ARTIFACT_INVALID",
      "Named AP242 writer returned an artifact that mismatched the exact export plan."
    );
  }
}

export function isGeometryCancellation(error: unknown): boolean {
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : error &&
          typeof error === "object" &&
          "details" in error &&
          error.details &&
          typeof error.details === "object" &&
          "code" in error.details
        ? String(error.details.code)
        : undefined;
  return (
    error instanceof Error &&
    (error.name === "GeometryJobGenerationError" ||
      code === "GEOMETRY_JOB_GENERATION_CANCELLED" ||
      code === "EXPORT_CANCELLED")
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
