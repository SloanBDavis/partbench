import {
  CadEngine,
  type WcadTopologyCheckpointPayloadInput
} from "@web-cad/cad-core";
import type {
  CadBatchErrorResponse,
  CadBatch,
  CadBatchSuccessResponse,
  CadExportDiagnosticCode,
  CadOp
} from "@web-cad/cad-protocol";
import type { DerivedGeometryRuntime } from "./derivedGeometryRuntime";
import {
  projectExactFeaturePreviewGeometry,
  ExactFeaturePreviewGeometryError,
  type ExactFeaturePreviewGeometryArtifact
} from "./exactFeaturePreviewGeometry";
import type { CurrentExactBodyArtifactEvidence } from "./currentExactBodyResolver";
import { formatVisibleDiagnosticMessage } from "./viewportVisibleText";

export type ExactDownstreamGeometryPreflightResult =
  | {
      readonly ok: true;
      readonly response: CadBatchSuccessResponse;
      readonly sourceAuthorityEpoch: number;
      readonly artifacts: readonly ExactFeaturePreviewGeometryArtifact[];
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

  try {
    const preview = await projectExactFeaturePreviewGeometry({
      engine,
      batch: batch ?? { version: "cadops.v1", mode: "commit", ops },
      bodyId,
      operationLabel,
      runtime,
      existingArtifacts,
      checkpointPayloads,
      expectedSourceAuthorityEpoch: sourceAuthorityEpoch,
      executionIntent: "user",
      userKind: "preflight",
      requestIdPrefix: "downstream-preflight-artifact"
    });
    return {
      ok: true,
      response: preview.response,
      sourceAuthorityEpoch: preview.sourceAuthorityEpoch,
      artifacts: preview.artifacts
    };
  } catch (error) {
    if (engine.getSourceAuthorityEpoch() !== sourceAuthorityEpoch) {
      return stalePreflight(operationLabel);
    }
    if (
      error instanceof ExactFeaturePreviewGeometryError &&
      error.kind === "stale"
    ) {
      return stalePreflight(operationLabel);
    }
    if (
      error instanceof ExactFeaturePreviewGeometryError &&
      error.kind === "command" &&
      error.response
    ) {
      return {
        ok: false,
        reason: "command",
        message: error.response.error.message,
        response: error.response
      };
    }
    if (
      error instanceof ExactFeaturePreviewGeometryError &&
      error.kind === "source"
    ) {
      return sourceFailure(error.message);
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
}

function mapPreflightDiagnostic(
  error: unknown,
  operationLabel: string
): CadExportDiagnosticCode {
  const code = readErrorCode(error);
  const message = error instanceof Error ? error.message : String(error);
  if (error instanceof Error && error.name === "AbortError") {
    return "EXPORT_CANCELLED";
  }
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
