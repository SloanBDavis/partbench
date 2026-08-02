import {
  CadEngine,
  createCadProjectSourceIdentity,
  exportCadProject,
  type CadBodySnapshot,
  type CadFeatureSummary,
  type WcadTopologyCheckpointPayloadInput
} from "@web-cad/cad-core";
import type {
  CadBatchErrorResponse,
  CadBatchSuccessResponse,
  CadExportDiagnosticCode,
  CadGeneratedFaceReference,
  CadOp
} from "@web-cad/cad-protocol";
import type { DerivedGeometryRuntime } from "./derivedGeometryRuntime";
import {
  createDerivedGeometrySourcesFromDocument,
  removeConsumedDerivedGeometrySources
} from "./derivedGeometrySources";
import {
  resolveCurrentExactBodies,
  type CurrentExactBodyResolution
} from "./currentExactBodyResolver";
import { buildCurrentExactBodyArtifacts } from "./projectExactStepExport";
import { createGeneratedFaceReferenceKey } from "./sketchDisplayFrames";
import { formatVisibleDiagnosticMessage } from "./viewportVisibleText";

export type HoleGeometryPreflightResult =
  | {
      readonly ok: true;
      readonly response: CadBatchSuccessResponse;
      readonly sourceAuthorityEpoch: number;
    }
  | {
      readonly ok: false;
      readonly reason: "command" | "source" | "runtime";
      readonly message: string;
      readonly diagnosticCode?: CadExportDiagnosticCode;
      readonly response?: CadBatchErrorResponse;
    };

export async function preflightHoleGeometryCommand({
  engine,
  ops,
  bodyId,
  runtime,
  checkpointPayloads = [],
  expectedSourceAuthorityEpoch
}: {
  readonly engine: CadEngine;
  readonly ops: readonly CadOp[];
  readonly bodyId?: string;
  readonly runtime: Pick<
    DerivedGeometryRuntime,
    "exactBodyArtifact" | "getModelWorkSnapshot" | "resumeModelWork"
  >;
  readonly checkpointPayloads?: readonly WcadTopologyCheckpointPayloadInput[];
  readonly expectedSourceAuthorityEpoch?: number;
}): Promise<HoleGeometryPreflightResult> {
  const sourceAuthorityEpoch =
    expectedSourceAuthorityEpoch ?? engine.getSourceAuthorityEpoch();
  if (engine.getSourceAuthorityEpoch() !== sourceAuthorityEpoch) {
    return stalePreflight();
  }

  const projectedEngine = CadEngine.fromProject(exportCadProject(engine));
  const response = projectedEngine.executeBatch({
    version: "cadops.v1",
    mode: "commit",
    ops
  });
  if (!response.ok) {
    return {
      ok: false,
      reason: "command",
      message: response.error.message,
      response
    };
  }

  const structure = readProjectStructure(projectedEngine);
  const projectedBodyIds = resolveProjectedHoleBodyIds(
    bodyId,
    ops,
    structure.features
  );
  if (projectedBodyIds.length === 0) {
    return sourceFailure(
      "Could not apply this hole because its resulting body could not be identified."
    );
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
    checkpointPayloads,
    sourceIdentitySignaturesByBodyId
  });
  const readyResolutions: Extract<
    CurrentExactBodyResolution,
    { readonly status: "ready" }
  >[] = [];
  for (const projectedBodyId of projectedBodyIds) {
    const resolution = resolutions.find(
      (
        candidate
      ): candidate is Extract<
        CurrentExactBodyResolution,
        { readonly status: "ready" }
      > => candidate.bodyId === projectedBodyId && candidate.status === "ready"
    );
    if (!resolution) {
      const blocked = resolutions.find(
        (candidate) => candidate.bodyId === projectedBodyId
      );
      return sourceFailure(
        blocked?.diagnostics[0]?.message ??
          `Could not apply this hole because exact source ${projectedBodyId} is unavailable.`
      );
    }
    readyResolutions.push(resolution);
  }

  runtime.resumeModelWork();
  const generation = runtime.getModelWorkSnapshot().generation;
  const projectedSourceIdentity = createCadProjectSourceIdentity(
    exportCadProject(projectedEngine)
  );
  let artifacts: Awaited<ReturnType<typeof buildCurrentExactBodyArtifacts>> =
    [];
  try {
    artifacts = await buildCurrentExactBodyArtifacts({
      engine: projectedEngine,
      resolutions: readyResolutions,
      runtime,
      documentSourceIdentity: projectedSourceIdentity,
      units: projectedEngine.getDocument().units,
      generation,
      userKind: "preflight",
      requestIdPrefix: "hole-preflight-artifact",
      assertCurrent: () => {
        if (
          engine.getSourceAuthorityEpoch() !== sourceAuthorityEpoch ||
          !sameSourceIdentity(
            projectedSourceIdentity,
            createCadProjectSourceIdentity(exportCadProject(projectedEngine))
          )
        ) {
          throw new Error(
            "The project changed while hole preflight was running."
          );
        }
      }
    });
    if (
      artifacts.length !== projectedBodyIds.length ||
      artifacts.some(
        (artifact, index) => artifact.bodyId !== projectedBodyIds[index]
      ) ||
      engine.getSourceAuthorityEpoch() !== sourceAuthorityEpoch
    ) {
      return stalePreflight();
    }
  } catch (error) {
    if (engine.getSourceAuthorityEpoch() !== sourceAuthorityEpoch) {
      return stalePreflight();
    }
    const diagnosticCode = mapHolePreflightDiagnostic(error);
    return {
      ok: false,
      reason: "runtime",
      diagnosticCode,
      message: formatHoleGeometryPreflightError(error, diagnosticCode)
    };
  } finally {
    artifacts.length = 0;
  }

  return { ok: true, response, sourceAuthorityEpoch };
}

function resolveProjectedHoleBodyIds(
  bodyId: string | undefined,
  ops: readonly CadOp[],
  features: readonly CadFeatureSummary[]
): readonly string[] {
  const bodyIds = new Set<string>();
  for (const op of ops) {
    if (op.op !== "feature.hole" && op.op !== "feature.updateHole") continue;
    const feature = features.find((candidate) => candidate.id === op.id);
    if (feature?.kind === "hole") bodyIds.add(feature.bodyId);
  }
  if (bodyIds.size === 0 && bodyId) bodyIds.add(bodyId);
  return [...bodyIds];
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

function mapHolePreflightDiagnostic(error: unknown): CadExportDiagnosticCode {
  const code = readErrorCode(error);
  const message = error instanceof Error ? error.message : String(error);
  return /no positive-volume intersection/i.test(message)
    ? "HOLE_TOOL_NO_INTERSECTION"
    : code === "INVALID_RESULT" ||
        code === "EMPTY_RESULT" ||
        /\b(?:null|empty|invalid|non-finite|fully removed)\b/i.test(message)
      ? "HOLE_RESULT_INVALID"
      : code === "CANCELLED" || code === "GEOMETRY_JOB_GENERATION_CANCELLED"
        ? "EXPORT_CANCELLED"
        : "EXPORT_EXACT_ARTIFACT_FAILED";
}

function readErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const cause = "cause" in error ? readErrorCode(error.cause) : undefined;
  if (cause) return cause;
  if (
    "details" in error &&
    typeof error.details === "object" &&
    error.details !== null &&
    "code" in error.details
  ) {
    return String(error.details.code);
  }
  return "code" in error ? String(error.code) : undefined;
}

function formatHoleGeometryPreflightError(
  error: unknown,
  diagnosticCode: CadExportDiagnosticCode
): string {
  const message = error instanceof Error ? error.message : "Unknown error.";
  return formatVisibleDiagnosticMessage(
    `Could not apply this hole (${diagnosticCode}). ${message}`
  );
}

function sourceFailure(message: string): HoleGeometryPreflightResult {
  return { ok: false, reason: "source", message };
}

function stalePreflight(): HoleGeometryPreflightResult {
  return sourceFailure(
    "The project changed while hole preflight was running. Retry the operation."
  );
}

function sameSourceIdentity(
  left: { readonly algorithm: string; readonly sha256: string },
  right: { readonly algorithm: string; readonly sha256: string }
): boolean {
  return left.algorithm === right.algorithm && left.sha256 === right.sha256;
}
