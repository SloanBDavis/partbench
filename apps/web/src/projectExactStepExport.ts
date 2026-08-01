import {
  createCadProjectSourceIdentity,
  type CadEngine
} from "@web-cad/cad-core";
import {
  validateCadExactExportPlan,
  type CadExactExportPlan,
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
import type { DerivedGeometryRuntime } from "./derivedGeometryRuntime";

export interface ProjectExactStepExportExecutionInput {
  readonly engine: CadEngine;
  readonly exactExport: ProjectExactExportQueryResponse;
  readonly resolutions: readonly CurrentExactBodyResolution[];
  readonly runtime: Pick<
    DerivedGeometryRuntime,
    "exactBodyArtifact" | "executeExactStepExport"
  >;
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
  runtime
}: ProjectExactStepExportExecutionInput): Promise<ProjectExactStepExportResult> {
  const plan = requireReadyPlan(exactExport);
  assertExactExportPlanCurrent(engine, plan);
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
    }

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
