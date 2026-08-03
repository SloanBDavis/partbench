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
  CadBatch,
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
  type CurrentExactBodyArtifactEvidence,
  type CurrentExactBodyResolution
} from "./currentExactBodyResolver";
import { buildCurrentExactBodyArtifacts } from "./projectExactStepExport";
import { createGeneratedFaceReferenceKey } from "./sketchDisplayFrames";
import { formatVisibleDiagnosticMessage } from "./viewportVisibleText";

export type ExactDownstreamGeometryPreflightResult =
  | {
      readonly ok: true;
      readonly response: CadBatchSuccessResponse;
      readonly sourceAuthorityEpoch: number;
      readonly artifacts: Awaited<
        ReturnType<typeof buildCurrentExactBodyArtifacts>
      >;
    }
  | {
      readonly ok: false;
      readonly reason: "command" | "source" | "runtime";
      readonly message: string;
      readonly diagnosticCode?: CadExportDiagnosticCode;
      readonly response?: CadBatchErrorResponse;
    };

export async function preflightExactDownstreamGeometryCommand({
  engine,
  ops,
  batch,
  bodyId,
  runtime,
  checkpointPayloads = [],
  existingArtifacts = [],
  expectedSourceAuthorityEpoch
}: {
  readonly engine: CadEngine;
  readonly ops: readonly CadOp[];
  readonly batch?: CadBatch;
  readonly bodyId?: string;
  readonly runtime: Pick<
    DerivedGeometryRuntime,
    "exactBodyArtifact" | "getModelWorkSnapshot" | "resumeModelWork"
  >;
  readonly checkpointPayloads?: readonly WcadTopologyCheckpointPayloadInput[];
  readonly existingArtifacts?: readonly CurrentExactBodyArtifactEvidence[];
  readonly expectedSourceAuthorityEpoch?: number;
}): Promise<ExactDownstreamGeometryPreflightResult> {
  const operationLabel = formatOperationLabel(ops);
  const sourceAuthorityEpoch =
    expectedSourceAuthorityEpoch ?? engine.getSourceAuthorityEpoch();
  if (engine.getSourceAuthorityEpoch() !== sourceAuthorityEpoch) {
    return stalePreflight(operationLabel);
  }

  const projectedEngine = CadEngine.fromProject(exportCadProject(engine));
  const response = projectedEngine.executeBatch(
    batch ?? { version: "cadops.v1", mode: "commit", ops }
  );
  if (!response.ok) {
    return {
      ok: false,
      reason: "command",
      message: response.error.message,
      response
    };
  }

  const structure = readProjectStructure(projectedEngine);
  const projectedBodyIds = resolveProjectedDownstreamBodyIds(
    bodyId,
    ops,
    structure.features,
    structure.bodies,
    response.createdBodyIds
  );
  if (projectedBodyIds.length === 0) {
    return {
      ok: true,
      response,
      sourceAuthorityEpoch,
      artifacts: []
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
          `Could not apply this ${operationLabel} because exact source ${projectedBodyId} is unavailable.`
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
      existingArtifacts,
      userKind: "preflight",
      requestIdPrefix: "downstream-preflight-artifact",
      assertCurrent: () => {
        if (
          engine.getSourceAuthorityEpoch() !== sourceAuthorityEpoch ||
          !sameSourceIdentity(
            projectedSourceIdentity,
            createCadProjectSourceIdentity(exportCadProject(projectedEngine))
          )
        ) {
          throw new Error(
            `The project changed while ${operationLabel} preflight was running.`
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
      return stalePreflight(operationLabel);
    }
  } catch (error) {
    if (engine.getSourceAuthorityEpoch() !== sourceAuthorityEpoch) {
      return stalePreflight(operationLabel);
    }
    const diagnosticCode = mapPreflightDiagnostic(error, operationLabel);
    return {
      ok: false,
      reason: "runtime",
      diagnosticCode,
      message: formatGeometryPreflightError(
        error,
        diagnosticCode,
        operationLabel
      )
    };
  }

  return {
    ok: true,
    response,
    sourceAuthorityEpoch,
    artifacts
  };
}

const EXACT_DOWNSTREAM_CREATE_OPS = new Set<CadOp["op"]>([
  "feature.hole",
  "feature.linearPattern",
  "feature.circularPattern",
  "feature.mirror",
  "feature.shell"
]);

const EXACT_DOWNSTREAM_UPDATE_OPS = new Set<CadOp["op"]>([
  "feature.updateHole",
  "feature.updateLinearPattern",
  "feature.updateCircularPattern",
  "feature.updateMirror",
  "feature.updateShell"
]);

const EXACT_DOWNSTREAM_CREATE_KIND_BY_OP = {
  "feature.hole": "hole",
  "feature.linearPattern": "linearPattern",
  "feature.circularPattern": "circularPattern",
  "feature.mirror": "mirror",
  "feature.shell": "shell"
} as const satisfies Partial<Record<CadOp["op"], CadFeatureSummary["kind"]>>;

function resolveProjectedDownstreamBodyIds(
  bodyId: string | undefined,
  ops: readonly CadOp[],
  features: readonly CadFeatureSummary[],
  bodies: readonly CadBodySnapshot[],
  createdBodyIds: readonly string[] = []
): readonly string[] {
  const changedBodyIds = new Set<string>();
  for (const op of ops) {
    if (!EXACT_DOWNSTREAM_UPDATE_OPS.has(op.op) || !("id" in op)) continue;
    const feature = features.find((candidate) => candidate.id === op.id);
    if (feature) changedBodyIds.add(feature.bodyId);
  }
  for (const createdBodyId of createdBodyIds) {
    const feature = features.find(
      (candidate) => candidate.bodyId === createdBodyId
    );
    if (
      feature &&
      ops.some(
        (op) =>
          EXACT_DOWNSTREAM_CREATE_OPS.has(op.op) &&
          EXACT_DOWNSTREAM_CREATE_KIND_BY_OP[
            op.op as keyof typeof EXACT_DOWNSTREAM_CREATE_KIND_BY_OP
          ] === feature.kind &&
          (!("id" in op) || op.id === undefined || op.id === feature.id)
      )
    ) {
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

function mapPreflightDiagnostic(
  error: unknown,
  operationLabel: string
): CadExportDiagnosticCode {
  const code = readErrorCode(error);
  const message = error instanceof Error ? error.message : String(error);
  if (code === "SHELL_TARGET_MULTI_SOLID_UNSUPPORTED") return code;
  return operationLabel === "hole" &&
    /no positive-volume intersection/i.test(message)
    ? "HOLE_TOOL_NO_INTERSECTION"
    : operationLabel === "hole" &&
        (code === "INVALID_RESULT" ||
          code === "EMPTY_RESULT" ||
          /\b(?:null|empty|invalid|non-finite|fully removed)\b/i.test(message))
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

function formatGeometryPreflightError(
  error: unknown,
  diagnosticCode: CadExportDiagnosticCode,
  operationLabel: string
): string {
  const message = error instanceof Error ? error.message : "Unknown error.";
  return formatVisibleDiagnosticMessage(
    `Could not apply this ${operationLabel} (${diagnosticCode}). ${message}`
  );
}

function sourceFailure(
  message: string
): ExactDownstreamGeometryPreflightResult {
  return { ok: false, reason: "source", message };
}

function stalePreflight(
  operationLabel: string
): ExactDownstreamGeometryPreflightResult {
  return sourceFailure(
    `The project changed while ${operationLabel} preflight was running. Retry the operation.`
  );
}

function formatOperationLabel(ops: readonly CadOp[]): string {
  const kinds = new Set(
    ops.flatMap((op) => {
      if (op.op === "feature.hole" || op.op === "feature.updateHole") {
        return ["hole"];
      }
      if (
        op.op === "feature.linearPattern" ||
        op.op === "feature.updateLinearPattern" ||
        op.op === "feature.circularPattern" ||
        op.op === "feature.updateCircularPattern"
      ) {
        return ["pattern"];
      }
      if (op.op === "feature.mirror" || op.op === "feature.updateMirror") {
        return ["mirror"];
      }
      if (op.op === "feature.shell" || op.op === "feature.updateShell") {
        return ["shell"];
      }
      return [];
    })
  );
  return kinds.size === 1 ? [...kinds][0]! : "exact operation";
}

function sameSourceIdentity(
  left: { readonly algorithm: string; readonly sha256: string },
  right: { readonly algorithm: string; readonly sha256: string }
): boolean {
  return left.algorithm === right.algorithm && left.sha256 === right.sha256;
}
