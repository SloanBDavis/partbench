import type {
  CadOpsAgentSuccessResponse,
  CadOpsAgentWorkflowReview
} from "@web-cad/agent-adapter";
import type { SemanticDiff } from "@web-cad/cad-protocol";

const ID_FIELDS = [
  "createdIds",
  "modifiedIds",
  "deletedIds",
  "createdSketchIds",
  "modifiedSketchIds",
  "deletedSketchIds",
  "createdDatumIds",
  "modifiedDatumIds",
  "deletedDatumIds",
  "createdSketchEntityIds",
  "modifiedSketchEntityIds",
  "deletedSketchEntityIds",
  "createdParameterIds",
  "modifiedParameterIds",
  "deletedParameterIds",
  "createdSketchDimensionIds",
  "modifiedSketchDimensionIds",
  "deletedSketchDimensionIds",
  "createdSketchConstraintIds",
  "modifiedSketchConstraintIds",
  "deletedSketchConstraintIds",
  "createdFeatureIds",
  "modifiedFeatureIds",
  "deletedFeatureIds",
  "createdBodyIds",
  "modifiedBodyIds",
  "deletedBodyIds"
] as const satisfies readonly (keyof CadOpsAgentSuccessResponse)[];
const SAMPLE_LIMIT = 8;

export interface CadMcpIdSample {
  readonly total: number;
  readonly ids: readonly string[];
  readonly truncated: boolean;
}

export interface CadMcpBatchSummary extends Pick<
  CadOpsAgentSuccessResponse,
  | "ok"
  | "requestId"
  | "adapterVersion"
  | "cadOpsVersion"
  | "mode"
  | "transactionId"
  | "actor"
  | "audit"
  | "warnings"
> {
  readonly responseDetail: "summary";
  readonly sampleLimit: number;
  readonly idChanges: Partial<
    Record<(typeof ID_FIELDS)[number], CadMcpIdSample>
  >;
  readonly diffCounts: Readonly<
    Record<string, number | Readonly<Record<string, number>>>
  >;
  readonly document?: SemanticDiff["document"];
  readonly review: CadOpsAgentWorkflowReview & {
    readonly operationsTotal: number;
    readonly operationsTruncated: boolean;
  };
}

/** Projection only: the complete canonical result and audit remain unchanged. */
export function createCadMcpBatchSummary(
  response: CadOpsAgentSuccessResponse
): CadMcpBatchSummary {
  const idChanges: CadMcpBatchSummary["idChanges"] = {};
  for (const field of ID_FIELDS) {
    const ids = response[field];
    if (ids === undefined) continue;
    idChanges[field] = {
      total: ids.length,
      ids: ids.slice(0, SAMPLE_LIMIT),
      truncated: ids.length > SAMPLE_LIMIT
    };
  }
  // Only count the immediate diff arrays. Never traverse or copy geometry records.
  const diffCounts: Record<string, number | Record<string, number>> = {};
  for (const [section, value] of Object.entries(response.semanticDiff)) {
    if (Array.isArray(value)) diffCounts[section] = value.length;
    else if (section !== "document" && value && typeof value === "object") {
      diffCounts[section] = Object.fromEntries(
        Object.entries(value)
          .filter(([, records]) => Array.isArray(records))
          .map(([field, records]) => [
            field,
            (records as readonly unknown[]).length
          ])
      );
    }
  }
  return {
    ok: true,
    responseDetail: "summary",
    requestId: response.requestId,
    adapterVersion: response.adapterVersion,
    cadOpsVersion: response.cadOpsVersion,
    mode: response.mode,
    ...(response.transactionId
      ? { transactionId: response.transactionId }
      : {}),
    ...(response.actor ? { actor: response.actor } : {}),
    ...(response.audit ? { audit: response.audit } : {}),
    warnings: response.warnings,
    sampleLimit: SAMPLE_LIMIT,
    idChanges,
    diffCounts,
    ...(response.semanticDiff.document
      ? { document: response.semanticDiff.document }
      : {}),
    review: {
      ...response.review,
      operations: response.review.operations.slice(0, SAMPLE_LIMIT),
      operationsTotal: response.review.operations.length,
      operationsTruncated: response.review.operations.length > SAMPLE_LIMIT
    }
  };
}
