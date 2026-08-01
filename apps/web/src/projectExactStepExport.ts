import {
  createCadProjectSourceIdentity,
  type CadEngine
} from "@web-cad/cad-core";
import {
  validateCadExactExportPlan,
  type CadExactExportPlan,
  type CadExportDiagnostic,
  type CadExportDiagnosticCode,
  type ProjectExactExportQueryResponse
} from "@web-cad/cad-protocol";
import {
  assertExactBodyArtifactAggregateWithinLimit,
  createExactStepExportWorkerRequest,
  type GeometryKernelExactBodyArtifact,
  type GeometryKernelExactStepExportArtifact
} from "@web-cad/geometry-worker/browser";

import {
  createCurrentExactBodyArtifactSource,
  getCurrentExactBodyArtifactShapePolicy,
  type CurrentExactBodyResolution
} from "./currentExactBodyResolver";
import type {
  DerivedExactMetadataSnapshot,
  DerivedExactMetadataSource
} from "./derivedExactMetadata";
import type { DerivedGeometryRuntime } from "./derivedGeometryRuntime";
import type { CurrentExactResultProjection } from "./currentExactResultProjection";
import { readProjectExactStepExport } from "./projectExactExportQueries";

export interface ProjectExactStepExportExecutionInput {
  readonly engine: CadEngine;
  readonly exactExport: ProjectExactExportQueryResponse;
  readonly resolutions: readonly CurrentExactBodyResolution[];
  readonly runtime: Pick<
    DerivedGeometryRuntime,
    "exactBodyArtifact" | "executeExactStepExport"
  >;
  readonly onProgress?: (progress: ProjectExactStepExportProgress) => void;
}

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
}

export async function runProjectExactStepExport(input: {
  readonly engine: CadEngine;
  readonly exactMetadata: DerivedExactMetadataSnapshot;
  readonly currentSources: readonly DerivedExactMetadataSource[];
  readonly projections: readonly CurrentExactResultProjection[];
  readonly resolutions: readonly CurrentExactBodyResolution[];
  readonly runtime: Pick<
    DerivedGeometryRuntime,
    "exactBodyArtifact" | "executeExactStepExport" | "resumeModelWork"
  >;
  readonly requestedBodyIds?: readonly string[];
  readonly downloadAvailable: boolean;
  readonly onJobChange: (job: ProjectExactStepExportJobState) => void;
}): Promise<ProjectExactStepExportRunOutcome> {
  const requestedBodyIds = input.requestedBodyIds
    ? [...input.requestedBodyIds]
    : undefined;
  const finish = (
    job: ProjectExactStepExportJobState,
    tone: ProjectExactStepExportRunOutcome["tone"]
  ) => {
    input.onJobChange(job);
    return { job, tone };
  };
  const failed = (message: string, totalBodyCount = 0) =>
    finish(
      {
        status: "failed",
        ...(requestedBodyIds ? { requestedBodyIds } : {}),
        completedBodyCount: 0,
        totalBodyCount,
        message,
        diagnostics: []
      },
      "error"
    );

  if (requestedBodyIds?.length === 0) {
    return failed("Choose at least one body for exact STEP export.");
  }
  if (!input.downloadAvailable) {
    return failed(
      "STEP download is unavailable in this browser runtime.",
      requestedBodyIds?.length
    );
  }
  const exactExport = readProjectExactStepExport(
    input.engine,
    input.exactMetadata,
    input.currentSources,
    input.projections,
    requestedBodyIds
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

  input.runtime.resumeModelWork();
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
      runtime: input.runtime,
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
      "info"
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

  constructor(code: CadExportDiagnosticCode, message: string) {
    super(message);
    this.name = "ProjectExactStepExportError";
    this.code = code;
  }
}

export async function executeProjectExactStepExport({
  engine,
  exactExport,
  resolutions,
  runtime,
  onProgress
}: ProjectExactStepExportExecutionInput): Promise<ProjectExactStepExportResult> {
  const plan = requireReadyPlan(exactExport);
  assertExactExportPlanCurrent(engine, plan);
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

  const artifacts: GeometryKernelExactBodyArtifact[] = [];
  try {
    for (const [index, body] of plan.bodies.entries()) {
      assertExactExportPlanCurrent(engine, plan);
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

      let result: Awaited<ReturnType<typeof runtime.exactBodyArtifact>>;
      try {
        const source = createCurrentExactBodyArtifactSource(resolution.source);
        result = await runtime.exactBodyArtifact(
          {
            id: `exact-export-artifact-${index}`,
            bodyId: body.bodyId,
            sourceType: body.sourceType,
            documentSourceIdentity: plan.sourceIdentity,
            bodySourceIdentitySignature: body.sourceIdentitySignature,
            sourceCacheKeySha256: resolution.cacheKeySha256,
            sourceGraphNodeCount: resolution.sourceGraphNodeCount,
            units: plan.units,
            shapePolicy: getCurrentExactBodyArtifactShapePolicy(source),
            source
          },
          { intent: "user" }
        );
      } catch (error) {
        if (isGeometryCancellation(error)) throw error;
        throw new ProjectExactStepExportError(
          "EXPORT_EXACT_ARTIFACT_FAILED",
          `Exact artifact build failed for body ${body.bodyId}: ${getErrorMessage(error)}`
        );
      }
      assertArtifactMatchesPlan(result.artifact, plan, body);
      artifacts.push(result.artifact);
      try {
        assertExactBodyArtifactAggregateWithinLimit(artifacts);
      } catch {
        throw new ProjectExactStepExportError(
          "EXPORT_EXACT_ARTIFACT_LIMIT_EXCEEDED",
          "Exact export artifacts exceed the 512 MiB aggregate limit."
        );
      }
      assertExactExportPlanCurrent(engine, plan);
      onProgress?.({
        phase: "building",
        completedBodyCount: artifacts.length,
        totalBodyCount: plan.bodies.length,
        bodyId: body.bodyId
      });
    }

    onProgress?.({
      phase: "writing",
      completedBodyCount: artifacts.length,
      totalBodyCount: plan.bodies.length
    });
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

function assertArtifactMatchesPlan(
  artifact: GeometryKernelExactBodyArtifact,
  plan: CadExactExportPlan,
  body: CadExactExportPlan["bodies"][number]
): void {
  if (
    artifact.bodyId !== body.bodyId ||
    artifact.sourceType !== body.sourceType ||
    artifact.documentSourceIdentity.algorithm !==
      plan.sourceIdentity.algorithm ||
    artifact.documentSourceIdentity.sha256 !== plan.sourceIdentity.sha256 ||
    artifact.bodySourceIdentitySignature !== body.sourceIdentitySignature ||
    artifact.units !== plan.units ||
    artifact.brepFormat !== "occt-brep" ||
    artifact.brepByteLength !== artifact.brepBytes.byteLength ||
    artifact.brepByteLength <= 0 ||
    !/^[0-9a-f]{64}$/.test(artifact.brepSha256)
  ) {
    throw new ProjectExactStepExportError(
      "EXPORT_EXACT_ARTIFACT_INVALID",
      `Exact artifact evidence mismatched the plan for body ${body.bodyId}.`
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

function isGeometryCancellation(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "GeometryJobGenerationError" ||
      ("code" in error && error.code === "GEOMETRY_JOB_GENERATION_CANCELLED"))
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
