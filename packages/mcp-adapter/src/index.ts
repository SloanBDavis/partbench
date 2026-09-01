import {
  parseCadAgentExactExportRequest,
  type CadAgentSessionErrorResponse,
  type CadAgentExactExportRequest,
  type CadAgentExactExportResult,
  type CadOpsAgentCurrentSelectionRequest,
  type CadOpsAgentCurrentSelectionResponse,
  CadOpsAgentAdapter,
  createCadOpsAgentAdapter,
  parseCadOpsAgentQueryRequest,
  parseCadOpsAgentRequest,
  parseCadOpsAgentV8ProjectSurfaceRequest,
  type AgentAdapterVersion,
  type CadOpsAgentProjectHandoffRequest,
  type CadOpsAgentQueryResponse,
  type CadOpsAgentResponse,
  type CadOpsAgentV8ProjectSurfaceResponse
} from "@web-cad/agent-adapter";
export {
  createV17AdapterCompositeParityFixture,
  type V17AdapterCompositeParityFixture
} from "@web-cad/agent-adapter";
import {
  WCAD_SOURCE_IDENTITY_ALGORITHM,
  validateProjectExactExportQuery
} from "@web-cad/cad-protocol";
import type {
  CadActorMetadata,
  CadBatch,
  CadBodyDerivedExactMetadataSnapshot,
  CadBodyExactMetadataSnapshot,
  CadCurrentTopologySelectionEvidence,
  CadFeatureEditProposal,
  CadGeneratedEntityKind,
  CadReferenceHealthTarget,
  CadSketchEditProposal,
  CadSelectionReferenceInput,
  CadSelectionReferenceOperation,
  CadTopologyMatchResult,
  CadTopologyMatchSnapshotInput
} from "@web-cad/cad-protocol";

const SHA256_HEX_PATTERN = "^[a-f0-9]{64}$";

export type CadMcpToolName =
  | "cad.parameter_list"
  | "cad.parameter_get"
  | "cad.project_parameter_evaluation"
  | "cad.feature_editability"
  | "cad.project_summary"
  | "cad.project_features"
  | "cad.project_structure"
  | "cad.project_health"
  | "cad.project_dependency_graph"
  | "cad.project_rebuild_plan"
  | "cad.project_topology_identity_readiness"
  | "cad.topology_match_snapshots"
  | "cad.topology_anchor_repair_candidates"
  | "cad.topology_anchor_command_readiness"
  | "cad.topology_command_target_readiness"
  | "cad.topology_anchor_creation_plan"
  | "cad.topology_anchor_repair_plan"
  | "cad.project_export_readiness"
  | "cad.project_export_exact"
  | "cad.project_request_exact_export"
  | "cad.project_package_readiness"
  | "cad.project_import_readiness"
  | "cad.v8_project_surface"
  | "cad.project_sketches"
  | "cad.object_measurements"
  | "cad.body_topology"
  | "cad.body_topology_identity"
  | "cad.body_measurements"
  | "cad.body_imported_body_status"
  | "cad.project_extents"
  | "cad.sketch_get"
  | "cad.sketch_curve_edit_readiness"
  | "cad.sketch_profile_region_candidates"
  | "cad.sketch_profile_region_validate"
  | "cad.sketch_edit_readiness"
  | "cad.sketch_solver_status"
  | "cad.sketch_evaluation"
  | "cad.sketch_dimensions"
  | "cad.sketch_dimension_get"
  | "cad.body_generated_references"
  | "cad.resolve_generated_reference"
  | "cad.generated_reference_measurements"
  | "cad.named_references"
  | "cad.resolve_named_reference"
  | "cad.reference_health"
  | "cad.selection_reference_candidates"
  | "cad.get_selection"
  | "cad.transaction_history"
  | "cad.batch";
export type McpJsonRpcId = string | number | null;

export interface McpToolDefinition {
  readonly name: CadMcpToolName;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
}

export interface CadMcpToolCallRequest {
  readonly name: string;
  readonly arguments?: unknown;
  readonly requestId?: string;
}

export interface McpTextContent {
  readonly type: "text";
  readonly text: string;
}

export type CadMcpStructuredContent =
  | CadOpsAgentQueryResponse
  | CadOpsAgentResponse
  | CadOpsAgentV8ProjectSurfaceResponse
  | CadOpsAgentCurrentSelectionResponse
  | (CadAgentExactExportResult & { readonly ok?: never })
  | CadAgentSessionErrorResponse
  | CadMcpToolErrorResponse;

export interface CadMcpToolCallResult {
  readonly toolName: string;
  readonly isError: boolean;
  readonly structuredContent: CadMcpStructuredContent;
  readonly content: readonly McpTextContent[];
}

export interface CadMcpToolErrorResponse {
  readonly ok: false;
  readonly error: CadMcpToolError;
}

export interface CadMcpToolError {
  readonly code: "UNKNOWN_TOOL" | "INVALID_ARGUMENTS";
  readonly message: string;
}

export interface McpJsonRpcRequest {
  readonly jsonrpc: "2.0";
  readonly id?: McpJsonRpcId;
  readonly method: string;
  readonly params?: unknown;
}

export type McpJsonRpcResponse = McpJsonRpcSuccess | McpJsonRpcError;

export interface McpJsonRpcSuccess {
  readonly jsonrpc: "2.0";
  readonly id: McpJsonRpcId;
  readonly result: unknown;
}

export interface McpJsonRpcError {
  readonly jsonrpc: "2.0";
  readonly id: McpJsonRpcId;
  readonly error: {
    readonly code: number;
    readonly message: string;
  };
}

export interface CadMcpServerOptions {
  readonly adapter?: CadOpsAgentAdapter;
  readonly executionPort?: CadMcpExecutionPort;
}

type CadMcpSyncExecutionPort = Pick<
  CadOpsAgentAdapter,
  "execute" | "query" | "inspectV8ProjectSurface" | "getCurrentSelection"
>;

export interface CadMcpExecutionPort {
  execute(
    request: Parameters<CadOpsAgentAdapter["execute"]>[0]
  ): Promise<CadOpsAgentResponse | CadAgentSessionErrorResponse>;
  query(
    request: Parameters<CadOpsAgentAdapter["query"]>[0]
  ): Promise<CadOpsAgentQueryResponse | CadAgentSessionErrorResponse>;
  inspectV8ProjectSurface(
    request: Parameters<CadOpsAgentAdapter["inspectV8ProjectSurface"]>[0]
  ): Promise<
    CadOpsAgentV8ProjectSurfaceResponse | CadAgentSessionErrorResponse
  >;
  getCurrentSelection(
    request: CadOpsAgentCurrentSelectionRequest
  ): Promise<
    CadOpsAgentCurrentSelectionResponse | CadAgentSessionErrorResponse
  >;
  requestExactExport(
    request: CadAgentExactExportRequest
  ): Promise<CadAgentExactExportResult | CadAgentSessionErrorResponse>;
}

const ADAPTER_VERSION: AgentAdapterVersion = "web-cad.agent-adapter.v1";
const DEFAULT_MCP_ACTOR: CadActorMetadata = {
  type: "agent",
  id: "mcp",
  name: "MCP Client"
};

export class CadMcpServer {
  #nextRequestNumber = 1;
  readonly #adapter: CadMcpSyncExecutionPort;
  readonly #executionPort?: CadMcpExecutionPort;

  constructor(options: CadMcpServerOptions = {}) {
    if (options.adapter && options.executionPort) {
      throw new Error(
        "CadMcpServer accepts either adapter or executionPort, not both."
      );
    }
    this.#executionPort = options.executionPort;
    this.#adapter = options.executionPort
      ? new DeferredCadOpsAgentAdapter()
      : (options.adapter ?? createCadOpsAgentAdapter());
  }

  listTools(): { readonly tools: readonly McpToolDefinition[] } {
    return {
      tools: CAD_MCP_TOOLS
    };
  }

  callTool(request: CadMcpToolCallRequest): CadMcpToolCallResult {
    if (request.name === "cad.parameter_list") {
      return this.#callParameterList(request);
    }

    if (request.name === "cad.parameter_get") {
      return this.#callParameterGet(request);
    }

    if (request.name === "cad.project_parameter_evaluation") {
      return this.#callProjectParameterEvaluation(request);
    }

    if (request.name === "cad.feature_editability") {
      return this.#callFeatureEditability(request);
    }

    if (request.name === "cad.project_summary") {
      return this.#callProjectSummary(request);
    }

    if (request.name === "cad.project_features") {
      return this.#callProjectFeatures(request);
    }

    if (request.name === "cad.project_structure") {
      return this.#callProjectStructure(request);
    }

    if (request.name === "cad.project_health") {
      return this.#callProjectHealth(request);
    }

    if (request.name === "cad.project_dependency_graph") {
      return this.#callProjectDependencyGraph(request);
    }

    if (request.name === "cad.project_rebuild_plan") {
      return this.#callProjectRebuildPlan(request);
    }

    if (request.name === "cad.project_topology_identity_readiness") {
      return this.#callProjectTopologyIdentityReadiness(request);
    }

    if (request.name === "cad.topology_match_snapshots") {
      return this.#callTopologyMatchSnapshots(request);
    }

    if (request.name === "cad.topology_anchor_repair_candidates") {
      return this.#callTopologyAnchorRepairCandidates(request);
    }

    if (request.name === "cad.topology_anchor_command_readiness") {
      return this.#callTopologyAnchorCommandReadiness(request);
    }

    if (request.name === "cad.topology_command_target_readiness") {
      return this.#callTopologyCommandTargetReadiness(request);
    }

    if (request.name === "cad.topology_anchor_creation_plan") {
      return this.#callTopologyAnchorCreationPlan(request);
    }

    if (request.name === "cad.topology_anchor_repair_plan") {
      return this.#callTopologyAnchorRepairPlan(request);
    }

    if (request.name === "cad.project_export_readiness") {
      return this.#callProjectExportReadiness(request);
    }

    if (request.name === "cad.project_export_exact") {
      return this.#callProjectExportExact(request);
    }

    if (request.name === "cad.project_request_exact_export") {
      return this.#callProjectRequestExactExport(request);
    }

    if (request.name === "cad.project_package_readiness") {
      return this.#callProjectPackageReadiness(request);
    }

    if (request.name === "cad.project_import_readiness") {
      return this.#callProjectImportReadiness(request);
    }

    if (request.name === "cad.v8_project_surface") {
      return this.#callV8ProjectSurface(request);
    }

    if (request.name === "cad.project_sketches") {
      return this.#callProjectSketches(request);
    }

    if (request.name === "cad.object_measurements") {
      return this.#callObjectMeasurements(request);
    }

    if (request.name === "cad.body_topology") {
      return this.#callBodyTopology(request);
    }

    if (request.name === "cad.body_topology_identity") {
      return this.#callBodyTopologyIdentity(request);
    }

    if (request.name === "cad.body_measurements") {
      return this.#callBodyMeasurements(request);
    }

    if (request.name === "cad.body_imported_body_status") {
      return this.#callBodyImportedBodyStatus(request);
    }

    if (request.name === "cad.project_extents") {
      return this.#callProjectExtents(request);
    }

    if (request.name === "cad.sketch_get") {
      return this.#callSketchGet(request);
    }

    if (request.name === "cad.sketch_curve_edit_readiness") {
      return this.#callV19SketchQuery(
        request,
        "sketch.curveEditReadiness",
        "cad.sketch_curve_edit_readiness expects arguments shaped as { proposal: SketchCurveEditProposal }."
      );
    }

    if (request.name === "cad.sketch_profile_region_candidates") {
      return this.#callV19SketchQuery(
        request,
        "sketch.profileRegionCandidates",
        "cad.sketch_profile_region_candidates expects a sketchId and optional bounded entityIds, limit, afterCandidateKey, and sourceRevision."
      );
    }

    if (request.name === "cad.sketch_profile_region_validate") {
      return this.#callV19SketchQuery(
        request,
        "sketch.profileRegionValidate",
        "cad.sketch_profile_region_validate expects arguments shaped as { profile: SketchRegionsProfileRef }."
      );
    }

    if (request.name === "cad.sketch_edit_readiness") {
      return this.#callSketchEditReadiness(request);
    }

    if (request.name === "cad.sketch_solver_status") {
      return this.#callSketchSolverStatus(request);
    }

    if (request.name === "cad.sketch_evaluation") {
      return this.#callSketchEvaluation(request);
    }

    if (request.name === "cad.sketch_dimensions") {
      return this.#callSketchDimensions(request);
    }

    if (request.name === "cad.sketch_dimension_get") {
      return this.#callSketchDimensionGet(request);
    }

    if (request.name === "cad.body_generated_references") {
      return this.#callBodyGeneratedReferences(request);
    }

    if (request.name === "cad.resolve_generated_reference") {
      return this.#callResolveGeneratedReference(request);
    }

    if (request.name === "cad.generated_reference_measurements") {
      return this.#callGeneratedReferenceMeasurements(request);
    }

    if (request.name === "cad.named_references") {
      return this.#callNamedReferences(request);
    }

    if (request.name === "cad.resolve_named_reference") {
      return this.#callResolveNamedReference(request);
    }

    if (request.name === "cad.reference_health") {
      return this.#callReferenceHealth(request);
    }

    if (request.name === "cad.selection_reference_candidates") {
      return this.#callSelectionReferenceCandidates(request);
    }

    if (request.name === "cad.get_selection") {
      return this.#callCurrentSelection(request);
    }

    if (request.name === "cad.transaction_history") {
      return this.#callTransactionHistory(request);
    }

    if (request.name === "cad.batch") {
      return this.#callBatch(request);
    }

    return createToolResult(request.name, {
      ok: false,
      error: {
        code: "UNKNOWN_TOOL",
        message: `Unknown MCP tool: ${request.name}`
      }
    });
  }

  async callToolAsync(
    request: CadMcpToolCallRequest
  ): Promise<CadMcpToolCallResult> {
    try {
      return this.callTool(request);
    } catch (error) {
      if (!(error instanceof CadMcpExecutionPortCall) || !this.#executionPort) {
        throw error;
      }

      const response = await callExecutionPort(this.#executionPort, error);
      return createToolResult(
        request.name,
        response,
        "ok" in response
          ? !response.ok
          : response.status !== "downloadRequested"
      );
    }
  }

  handleJsonRpc(request: unknown): McpJsonRpcResponse {
    const id = getJsonRpcId(request);

    if (!isJsonRpcRequest(request)) {
      return createJsonRpcError(id, -32600, "Invalid JSON-RPC request.");
    }

    if (request.method === "tools/list") {
      return {
        jsonrpc: "2.0",
        id: request.id ?? null,
        result: this.listTools()
      };
    }

    if (request.method === "tools/call") {
      if (!isToolCallParams(request.params)) {
        return createJsonRpcError(
          request.id ?? null,
          -32602,
          "Invalid tools/call params."
        );
      }

      return {
        jsonrpc: "2.0",
        id: request.id ?? null,
        result: this.callTool({
          name: request.params.name,
          arguments: request.params.arguments,
          requestId: createRequestIdFromJsonRpcId(request.id)
        })
      };
    }

    return createJsonRpcError(
      request.id ?? null,
      -32601,
      `Unknown JSON-RPC method: ${request.method}`
    );
  }

  async handleJsonRpcAsync(request: unknown): Promise<McpJsonRpcResponse> {
    const id = getJsonRpcId(request);

    if (!isJsonRpcRequest(request)) {
      return createJsonRpcError(id, -32600, "Invalid JSON-RPC request.");
    }

    if (request.method === "tools/list") {
      return {
        jsonrpc: "2.0",
        id: request.id ?? null,
        result: this.listTools()
      };
    }

    if (request.method === "tools/call") {
      if (!isToolCallParams(request.params)) {
        return createJsonRpcError(
          request.id ?? null,
          -32602,
          "Invalid tools/call params."
        );
      }

      return {
        jsonrpc: "2.0",
        id: request.id ?? null,
        result: await this.callToolAsync({
          name: request.params.name,
          arguments: request.params.arguments,
          requestId: createRequestIdFromJsonRpcId(request.id)
        })
      };
    }

    return createJsonRpcError(
      request.id ?? null,
      -32601,
      `Unknown JSON-RPC method: ${request.method}`
    );
  }

  #callParameterList(request: CadMcpToolCallRequest): CadMcpToolCallResult {
    if (!isEmptyObjectOrUndefined(request.arguments)) {
      return createInvalidArgumentsResult(
        request.name,
        "cad.parameter_list does not accept arguments."
      );
    }

    const response = this.#adapter.query(
      parseCadOpsAgentQueryRequest({
        requestId: request.requestId ?? this.#createRequestId(),
        adapterVersion: ADAPTER_VERSION,
        query: {
          version: "cadops.v1",
          query: { query: "parameter.list" }
        }
      })
    );

    return createToolResult(request.name, response, !response.ok);
  }

  #callParameterGet(request: CadMcpToolCallRequest): CadMcpToolCallResult {
    if (!isIdToolArguments(request.arguments)) {
      return createInvalidArgumentsResult(
        request.name,
        "cad.parameter_get expects arguments shaped as { id: string }."
      );
    }

    const response = this.#adapter.query(
      parseCadOpsAgentQueryRequest({
        requestId: request.requestId ?? this.#createRequestId(),
        adapterVersion: ADAPTER_VERSION,
        query: {
          version: "cadops.v1",
          query: {
            query: "parameter.get",
            id: request.arguments.id
          }
        }
      })
    );

    return createToolResult(request.name, response, !response.ok);
  }

  #callProjectParameterEvaluation(
    request: CadMcpToolCallRequest
  ): CadMcpToolCallResult {
    if (!isEmptyObjectOrUndefined(request.arguments)) {
      return createInvalidArgumentsResult(
        request.name,
        "cad.project_parameter_evaluation does not accept arguments."
      );
    }

    const response = this.#adapter.query(
      parseCadOpsAgentQueryRequest({
        requestId: request.requestId ?? this.#createRequestId(),
        adapterVersion: ADAPTER_VERSION,
        query: {
          version: "cadops.v1",
          query: { query: "project.parameterEvaluation" }
        }
      })
    );

    return createToolResult(request.name, response, !response.ok);
  }

  #callFeatureEditability(
    request: CadMcpToolCallRequest
  ): CadMcpToolCallResult {
    if (!isFeatureEditabilityToolArguments(request.arguments)) {
      return createInvalidArgumentsResult(
        request.name,
        "cad.feature_editability expects arguments shaped as { featureId: string, proposedEdit?: supported feature edit proposal }."
      );
    }

    const response = this.#adapter.query(
      parseCadOpsAgentQueryRequest({
        requestId: request.requestId ?? this.#createRequestId(),
        adapterVersion: ADAPTER_VERSION,
        query: {
          version: "cadops.v1",
          query: {
            query: "feature.editability",
            featureId: request.arguments.featureId,
            ...(request.arguments.proposedEdit
              ? { proposedEdit: request.arguments.proposedEdit }
              : {}),
            ...(request.arguments.topologyMatchResults
              ? { topologyMatchResults: request.arguments.topologyMatchResults }
              : {})
          }
        }
      })
    );

    return createToolResult(request.name, response, !response.ok);
  }

  #callProjectSummary(request: CadMcpToolCallRequest): CadMcpToolCallResult {
    if (!isEmptyObjectOrUndefined(request.arguments)) {
      return createInvalidArgumentsResult(
        request.name,
        "cad.project_summary does not accept arguments."
      );
    }

    const response = this.#adapter.query(
      parseCadOpsAgentQueryRequest({
        requestId: request.requestId ?? this.#createRequestId(),
        adapterVersion: ADAPTER_VERSION,
        query: {
          version: "cadops.v1",
          query: { query: "project.summary" }
        }
      })
    );

    return createToolResult(request.name, response, !response.ok);
  }

  #callProjectFeatures(request: CadMcpToolCallRequest): CadMcpToolCallResult {
    if (!isEmptyObjectOrUndefined(request.arguments)) {
      return createInvalidArgumentsResult(
        request.name,
        "cad.project_features does not accept arguments."
      );
    }

    const response = this.#adapter.query(
      parseCadOpsAgentQueryRequest({
        requestId: request.requestId ?? this.#createRequestId(),
        adapterVersion: ADAPTER_VERSION,
        query: {
          version: "cadops.v1",
          query: { query: "project.features" }
        }
      })
    );

    return createToolResult(request.name, response, !response.ok);
  }

  #callProjectStructure(request: CadMcpToolCallRequest): CadMcpToolCallResult {
    if (!isEmptyObjectOrUndefined(request.arguments)) {
      return createInvalidArgumentsResult(
        request.name,
        "cad.project_structure does not accept arguments."
      );
    }

    const response = this.#adapter.query(
      parseCadOpsAgentQueryRequest({
        requestId: request.requestId ?? this.#createRequestId(),
        adapterVersion: ADAPTER_VERSION,
        query: {
          version: "cadops.v1",
          query: { query: "project.structure" }
        }
      })
    );

    return createToolResult(request.name, response, !response.ok);
  }

  #callProjectHealth(request: CadMcpToolCallRequest): CadMcpToolCallResult {
    const args = request.arguments;

    if (!isProjectExactMetadataToolArguments(args)) {
      return createInvalidArgumentsResult(
        request.name,
        "cad.project_health expects optional arguments shaped as { derivedExactMetadata?: object[] }."
      );
    }

    const response = this.#adapter.query(
      parseCadOpsAgentQueryRequest({
        requestId: request.requestId ?? this.#createRequestId(),
        adapterVersion: ADAPTER_VERSION,
        query: {
          version: "cadops.v1",
          query: {
            query: "project.health",
            ...(args?.derivedExactMetadata
              ? {
                  derivedExactMetadata: args.derivedExactMetadata
                }
              : {})
          }
        }
      })
    );

    return createToolResult(request.name, response, !response.ok);
  }

  #callProjectDependencyGraph(
    request: CadMcpToolCallRequest
  ): CadMcpToolCallResult {
    if (!isTopologyMatchContextToolArguments(request.arguments)) {
      return createInvalidArgumentsResult(
        request.name,
        "cad.project_dependency_graph expects optional topologyMatchResults."
      );
    }

    const response = this.#adapter.query(
      parseCadOpsAgentQueryRequest({
        requestId: request.requestId ?? this.#createRequestId(),
        adapterVersion: ADAPTER_VERSION,
        query: {
          version: "cadops.v1",
          query: {
            query: "project.dependencyGraph",
            ...(request.arguments?.topologyMatchResults
              ? { topologyMatchResults: request.arguments.topologyMatchResults }
              : {})
          }
        }
      })
    );

    return createToolResult(request.name, response, !response.ok);
  }

  #callProjectRebuildPlan(
    request: CadMcpToolCallRequest
  ): CadMcpToolCallResult {
    if (!isTopologyMatchContextToolArguments(request.arguments)) {
      return createInvalidArgumentsResult(
        request.name,
        "cad.project_rebuild_plan expects optional topologyMatchResults."
      );
    }

    const response = this.#adapter.query(
      parseCadOpsAgentQueryRequest({
        requestId: request.requestId ?? this.#createRequestId(),
        adapterVersion: ADAPTER_VERSION,
        query: {
          version: "cadops.v1",
          query: {
            query: "project.rebuildPlan",
            ...(request.arguments?.topologyMatchResults
              ? { topologyMatchResults: request.arguments.topologyMatchResults }
              : {})
          }
        }
      })
    );

    return createToolResult(request.name, response, !response.ok);
  }

  #callProjectTopologyIdentityReadiness(
    request: CadMcpToolCallRequest
  ): CadMcpToolCallResult {
    if (!isEmptyObjectOrUndefined(request.arguments)) {
      return createInvalidArgumentsResult(
        request.name,
        "cad.project_topology_identity_readiness does not accept arguments."
      );
    }

    const response = this.#adapter.query(
      parseCadOpsAgentQueryRequest({
        requestId: request.requestId ?? this.#createRequestId(),
        adapterVersion: ADAPTER_VERSION,
        query: {
          version: "cadops.v1",
          query: { query: "project.topologyIdentityReadiness" }
        }
      })
    );

    return createToolResult(request.name, response, !response.ok);
  }

  #callTopologyMatchSnapshots(
    request: CadMcpToolCallRequest
  ): CadMcpToolCallResult {
    if (!isTopologyMatchSnapshotsArguments(request.arguments)) {
      return createInvalidArgumentsResult(
        request.name,
        "cad.topology_match_snapshots requires previous and candidates snapshot inputs."
      );
    }

    const response = this.#adapter.query(
      parseCadOpsAgentQueryRequest({
        requestId: request.requestId ?? this.#createRequestId(),
        adapterVersion: ADAPTER_VERSION,
        query: {
          version: "cadops.v1",
          query: {
            query: "topology.matchSnapshots",
            previous: request.arguments.previous,
            candidates: request.arguments.candidates
          }
        }
      })
    );

    return createToolResult(request.name, response, !response.ok);
  }

  #callTopologyAnchorRepairCandidates(
    request: CadMcpToolCallRequest
  ): CadMcpToolCallResult {
    if (!isTopologyAnchorRepairCandidatesArguments(request.arguments)) {
      return createInvalidArgumentsResult(
        request.name,
        "cad.topology_anchor_repair_candidates requires previous and candidates snapshot inputs plus optional anchorIds."
      );
    }

    const response = this.#adapter.query(
      parseCadOpsAgentQueryRequest({
        requestId: request.requestId ?? this.#createRequestId(),
        adapterVersion: ADAPTER_VERSION,
        query: {
          version: "cadops.v1",
          query: {
            query: "topology.anchorRepairCandidates",
            previous: request.arguments.previous,
            candidates: request.arguments.candidates,
            anchorIds: request.arguments.anchorIds
          }
        }
      })
    );

    return createToolResult(request.name, response, !response.ok);
  }

  #callTopologyAnchorCommandReadiness(
    request: CadMcpToolCallRequest
  ): CadMcpToolCallResult {
    if (!isTopologyAnchorCommandReadinessArguments(request.arguments)) {
      return createInvalidArgumentsResult(
        request.name,
        "cad.topology_anchor_command_readiness expects { anchorId: string, snapshot: object, requiredOperation?: string }."
      );
    }

    const response = this.#adapter.query(
      parseCadOpsAgentQueryRequest({
        requestId: request.requestId ?? this.#createRequestId(),
        adapterVersion: ADAPTER_VERSION,
        query: {
          version: "cadops.v1",
          query: {
            query: "topology.anchorCommandReadiness",
            anchorId: request.arguments.anchorId,
            snapshot: request.arguments.snapshot,
            requiredOperation: request.arguments.requiredOperation
          }
        }
      })
    );

    return createToolResult(request.name, response, !response.ok);
  }

  #callTopologyCommandTargetReadiness(
    request: CadMcpToolCallRequest
  ): CadMcpToolCallResult {
    if (!isTopologyCommandTargetReadinessArguments(request.arguments)) {
      return createInvalidArgumentsResult(
        request.name,
        "cad.topology_command_target_readiness expects { target: selection target, desiredOperation?: string, snapshot?: object, topologyMatchResults?: array }."
      );
    }

    const response = this.#adapter.query(
      parseCadOpsAgentQueryRequest({
        requestId: request.requestId ?? this.#createRequestId(),
        adapterVersion: ADAPTER_VERSION,
        query: {
          version: "cadops.v1",
          query: {
            query: "topology.commandTargetReadiness",
            target: request.arguments.target,
            desiredOperation: request.arguments.desiredOperation,
            snapshot: request.arguments.snapshot,
            topologyMatchResults: request.arguments.topologyMatchResults
          }
        }
      })
    );

    return createToolResult(request.name, response, !response.ok);
  }

  #callTopologyAnchorCreationPlan(
    request: CadMcpToolCallRequest
  ): CadMcpToolCallResult {
    if (!isTopologyAnchorCreationPlanArguments(request.arguments)) {
      return createInvalidArgumentsResult(
        request.name,
        "cad.topology_anchor_creation_plan expects arguments shaped as { bodyId: string, stableId: string, checkpointId?: string, anchorId?: string, derivedExactMetadata?: object }."
      );
    }

    const response = this.#adapter.query(
      parseCadOpsAgentQueryRequest({
        requestId: request.requestId ?? this.#createRequestId(),
        adapterVersion: ADAPTER_VERSION,
        query: {
          version: "cadops.v1",
          query: {
            query: "topology.anchorCreationPlan",
            bodyId: request.arguments.bodyId,
            stableId: request.arguments.stableId,
            checkpointId: request.arguments.checkpointId,
            anchorId: request.arguments.anchorId,
            derivedExactMetadata: request.arguments.derivedExactMetadata
          }
        }
      })
    );

    return createToolResult(request.name, response, !response.ok);
  }

  #callTopologyAnchorRepairPlan(
    request: CadMcpToolCallRequest
  ): CadMcpToolCallResult {
    if (!isTopologyAnchorRepairPlanArguments(request.arguments)) {
      return createInvalidArgumentsResult(
        request.name,
        "cad.topology_anchor_repair_plan expects arguments shaped as { anchorId: string, derivedExactMetadata: object, replacementCheckpointId?: string, createReplacementCheckpoint?: boolean, selectedRepairCandidateId?: string, repairId?: string }, with either replacementCheckpointId or createReplacementCheckpoint=true."
      );
    }

    const response = this.#adapter.query(
      parseCadOpsAgentQueryRequest({
        requestId: request.requestId ?? this.#createRequestId(),
        adapterVersion: ADAPTER_VERSION,
        query: {
          version: "cadops.v1",
          query: {
            query: "topology.anchorRepairPlan",
            anchorId: request.arguments.anchorId,
            replacementCheckpointId: request.arguments.replacementCheckpointId,
            createReplacementCheckpoint:
              request.arguments.createReplacementCheckpoint,
            selectedRepairCandidateId:
              request.arguments.selectedRepairCandidateId,
            repairId: request.arguments.repairId,
            derivedExactMetadata: request.arguments.derivedExactMetadata
          }
        }
      })
    );

    return createToolResult(request.name, response, !response.ok);
  }

  #callProjectExportReadiness(
    request: CadMcpToolCallRequest
  ): CadMcpToolCallResult {
    if (!isEmptyObjectOrUndefined(request.arguments)) {
      return createInvalidArgumentsResult(
        request.name,
        "cad.project_export_readiness does not accept arguments."
      );
    }

    const response = this.#adapter.query(
      parseCadOpsAgentQueryRequest({
        requestId: request.requestId ?? this.#createRequestId(),
        adapterVersion: ADAPTER_VERSION,
        query: {
          version: "cadops.v1",
          query: { query: "project.exportReadiness" }
        }
      })
    );

    return createToolResult(request.name, response, !response.ok);
  }

  #callProjectExportExact(
    request: CadMcpToolCallRequest
  ): CadMcpToolCallResult {
    if (!isProjectExportExactToolArguments(request.arguments)) {
      return createInvalidArgumentsResult(
        request.name,
        "cad.project_export_exact expects arguments shaped as { format: 'step', bodyIds?: string[], sourceIdentity?: { algorithm: 'partbench-source-v1', sha256: string } }."
      );
    }

    const response = this.#adapter.query(
      parseCadOpsAgentQueryRequest({
        requestId: request.requestId ?? this.#createRequestId(),
        adapterVersion: ADAPTER_VERSION,
        query: {
          version: "cadops.v1",
          query: {
            query: "project.exportExact",
            format: "step",
            ...(request.arguments.bodyIds
              ? { bodyIds: request.arguments.bodyIds }
              : {}),
            ...(request.arguments.sourceIdentity
              ? { sourceIdentity: request.arguments.sourceIdentity }
              : {})
          }
        }
      })
    );

    return createToolResult(request.name, response, !response.ok);
  }

  #callProjectPackageReadiness(
    request: CadMcpToolCallRequest
  ): CadMcpToolCallResult {
    if (!isEmptyObjectOrUndefined(request.arguments)) {
      return createInvalidArgumentsResult(
        request.name,
        "cad.project_package_readiness does not accept arguments."
      );
    }

    const response = this.#adapter.query(
      parseCadOpsAgentQueryRequest({
        requestId: request.requestId ?? this.#createRequestId(),
        adapterVersion: ADAPTER_VERSION,
        query: {
          version: "cadops.v1",
          query: { query: "project.packageReadiness" }
        }
      })
    );

    return createToolResult(request.name, response, !response.ok);
  }

  #callProjectImportReadiness(
    request: CadMcpToolCallRequest
  ): CadMcpToolCallResult {
    if (!isEmptyObjectOrUndefined(request.arguments)) {
      return createInvalidArgumentsResult(
        request.name,
        "cad.project_import_readiness does not accept arguments."
      );
    }

    const response = this.#adapter.query(
      parseCadOpsAgentQueryRequest({
        requestId: request.requestId ?? this.#createRequestId(),
        adapterVersion: ADAPTER_VERSION,
        query: {
          version: "cadops.v1",
          query: { query: "project.importReadiness" }
        }
      })
    );

    return createToolResult(request.name, response, !response.ok);
  }

  #callV8ProjectSurface(request: CadMcpToolCallRequest): CadMcpToolCallResult {
    const args = request.arguments;

    if (!isV8ProjectSurfaceToolArguments(args)) {
      return createInvalidArgumentsResult(
        request.name,
        "cad.v8_project_surface expects optional arguments shaped as { exactExport?: { format: 'step', bodyIds?: string[], sourceIdentity?: { algorithm: 'partbench-source-v1', sha256: string } } }. It does not accept local paths, browser file handles, OPFS paths, writeFile, or artifact return arguments."
      );
    }

    const response = this.#adapter.inspectV8ProjectSurface(
      parseCadOpsAgentV8ProjectSurfaceRequest({
        requestId: request.requestId ?? this.#createRequestId(),
        adapterVersion: ADAPTER_VERSION,
        ...(args?.exactExport ? { exactExport: args.exactExport } : {})
      })
    );

    return createToolResult(request.name, response, !response.ok);
  }

  #callProjectSketches(request: CadMcpToolCallRequest): CadMcpToolCallResult {
    if (!isEmptyObjectOrUndefined(request.arguments)) {
      return createInvalidArgumentsResult(
        request.name,
        "cad.project_sketches does not accept arguments."
      );
    }

    const response = this.#adapter.query(
      parseCadOpsAgentQueryRequest({
        requestId: request.requestId ?? this.#createRequestId(),
        adapterVersion: ADAPTER_VERSION,
        query: {
          version: "cadops.v1",
          query: { query: "project.sketches" }
        }
      })
    );

    return createToolResult(request.name, response, !response.ok);
  }

  #callObjectMeasurements(
    request: CadMcpToolCallRequest
  ): CadMcpToolCallResult {
    if (!isObjectMeasurementsToolArguments(request.arguments)) {
      return createInvalidArgumentsResult(
        request.name,
        "cad.object_measurements expects arguments shaped as { id: string }."
      );
    }

    const response = this.#adapter.query(
      parseCadOpsAgentQueryRequest({
        requestId: request.requestId ?? this.#createRequestId(),
        adapterVersion: ADAPTER_VERSION,
        query: {
          version: "cadops.v1",
          query: {
            query: "object.measurements",
            id: request.arguments.id
          }
        }
      })
    );

    return createToolResult(request.name, response, !response.ok);
  }

  #callBodyMeasurements(request: CadMcpToolCallRequest): CadMcpToolCallResult {
    if (!isBodyMeasurementsToolArguments(request.arguments)) {
      return createInvalidArgumentsResult(
        request.name,
        "cad.body_measurements expects arguments shaped as { bodyId: string }."
      );
    }

    const response = this.#adapter.query(
      parseCadOpsAgentQueryRequest({
        requestId: request.requestId ?? this.#createRequestId(),
        adapterVersion: ADAPTER_VERSION,
        query: {
          version: "cadops.v1",
          query: {
            query: "body.measurements",
            bodyId: request.arguments.bodyId
          }
        }
      })
    );

    return createToolResult(request.name, response, !response.ok);
  }

  #callBodyImportedBodyStatus(
    request: CadMcpToolCallRequest
  ): CadMcpToolCallResult {
    if (!isBodyMeasurementsToolArguments(request.arguments)) {
      return createInvalidArgumentsResult(
        request.name,
        "cad.body_imported_body_status expects arguments shaped as { bodyId: string }."
      );
    }

    const response = this.#adapter.query(
      parseCadOpsAgentQueryRequest({
        requestId: request.requestId ?? this.#createRequestId(),
        adapterVersion: ADAPTER_VERSION,
        query: {
          version: "cadops.v1",
          query: {
            query: "body.importedBodyStatus",
            bodyId: request.arguments.bodyId
          }
        }
      })
    );

    return createToolResult(request.name, response, !response.ok);
  }

  #callBodyTopology(request: CadMcpToolCallRequest): CadMcpToolCallResult {
    if (!isBodyTopologyToolArguments(request.arguments)) {
      return createInvalidArgumentsResult(
        request.name,
        "cad.body_topology expects arguments shaped as { bodyId: string, derivedExactMetadata?: object }."
      );
    }

    const response = this.#adapter.query(
      parseCadOpsAgentQueryRequest({
        requestId: request.requestId ?? this.#createRequestId(),
        adapterVersion: ADAPTER_VERSION,
        query: {
          version: "cadops.v1",
          query: {
            query: "body.topology",
            bodyId: request.arguments.bodyId,
            derivedExactMetadata: request.arguments.derivedExactMetadata
          }
        }
      })
    );

    return createToolResult(request.name, response, !response.ok);
  }

  #callBodyTopologyIdentity(
    request: CadMcpToolCallRequest
  ): CadMcpToolCallResult {
    if (!isBodyTopologyIdentityToolArguments(request.arguments)) {
      return createInvalidArgumentsResult(
        request.name,
        "cad.body_topology_identity expects arguments shaped as { bodyId: string, checkpointId?: string, derivedExactMetadata?: object }."
      );
    }

    const response = this.#adapter.query(
      parseCadOpsAgentQueryRequest({
        requestId: request.requestId ?? this.#createRequestId(),
        adapterVersion: ADAPTER_VERSION,
        query: {
          version: "cadops.v1",
          query: {
            query: "body.topologyIdentity",
            bodyId: request.arguments.bodyId,
            checkpointId: request.arguments.checkpointId,
            derivedExactMetadata: request.arguments.derivedExactMetadata
          }
        }
      })
    );

    return createToolResult(request.name, response, !response.ok);
  }

  #callProjectExtents(request: CadMcpToolCallRequest): CadMcpToolCallResult {
    const args = request.arguments;

    if (!isProjectExtentsToolArguments(args)) {
      return createInvalidArgumentsResult(
        request.name,
        "cad.project_extents expects optional arguments shaped as { derivedExactMetadata?: object[] }."
      );
    }

    const response = this.#adapter.query(
      parseCadOpsAgentQueryRequest({
        requestId: request.requestId ?? this.#createRequestId(),
        adapterVersion: ADAPTER_VERSION,
        query: {
          version: "cadops.v1",
          query: {
            query: "project.extents",
            ...(args?.derivedExactMetadata
              ? {
                  derivedExactMetadata: args.derivedExactMetadata
                }
              : {})
          }
        }
      })
    );

    return createToolResult(request.name, response, !response.ok);
  }

  #callSketchGet(request: CadMcpToolCallRequest): CadMcpToolCallResult {
    if (!isSketchGetToolArguments(request.arguments)) {
      return createInvalidArgumentsResult(
        request.name,
        "cad.sketch_get expects arguments shaped as { id: string }."
      );
    }

    const response = this.#adapter.query(
      parseCadOpsAgentQueryRequest({
        requestId: request.requestId ?? this.#createRequestId(),
        adapterVersion: ADAPTER_VERSION,
        query: {
          version: "cadops.v1",
          query: {
            query: "sketch.get",
            id: request.arguments.id
          }
        }
      })
    );

    return createToolResult(request.name, response, !response.ok);
  }

  #callV19SketchQuery(
    request: CadMcpToolCallRequest,
    query:
      | "sketch.curveEditReadiness"
      | "sketch.profileRegionCandidates"
      | "sketch.profileRegionValidate",
    invalidArgumentsMessage: string
  ): CadMcpToolCallResult {
    if (
      !isRecord(request.arguments) ||
      Object.prototype.hasOwnProperty.call(request.arguments, "query")
    ) {
      return createInvalidArgumentsResult(
        request.name,
        invalidArgumentsMessage
      );
    }

    try {
      const response = this.#adapter.query(
        parseCadOpsAgentQueryRequest({
          requestId: request.requestId ?? this.#createRequestId(),
          adapterVersion: ADAPTER_VERSION,
          query: {
            version: "cadops.v1",
            query: {
              ...request.arguments,
              query
            }
          }
        })
      );

      return createToolResult(request.name, response, !response.ok);
    } catch {
      return createInvalidArgumentsResult(
        request.name,
        invalidArgumentsMessage
      );
    }
  }

  #callSketchEditReadiness(
    request: CadMcpToolCallRequest
  ): CadMcpToolCallResult {
    if (!isSketchEditReadinessToolArguments(request.arguments)) {
      return createInvalidArgumentsResult(
        request.name,
        "cad.sketch_edit_readiness expects arguments shaped as { edit: supported sketch edit readiness proposal }."
      );
    }

    const response = this.#adapter.query(
      parseCadOpsAgentQueryRequest({
        requestId: request.requestId ?? this.#createRequestId(),
        adapterVersion: ADAPTER_VERSION,
        query: {
          version: "cadops.v1",
          query: {
            query: "sketch.editReadiness",
            edit: request.arguments.edit
          }
        }
      })
    );

    return createToolResult(request.name, response, !response.ok);
  }

  #callSketchSolverStatus(
    request: CadMcpToolCallRequest
  ): CadMcpToolCallResult {
    if (!isSketchDimensionsToolArguments(request.arguments)) {
      return createInvalidArgumentsResult(
        request.name,
        "cad.sketch_solver_status expects arguments shaped as { sketchId: string }."
      );
    }

    const response = this.#adapter.query(
      parseCadOpsAgentQueryRequest({
        requestId: request.requestId ?? this.#createRequestId(),
        adapterVersion: ADAPTER_VERSION,
        query: {
          version: "cadops.v1",
          query: {
            query: "sketch.solverStatus",
            sketchId: request.arguments.sketchId
          }
        }
      })
    );

    return createToolResult(request.name, response, !response.ok);
  }

  #callSketchDimensions(request: CadMcpToolCallRequest): CadMcpToolCallResult {
    if (!isSketchDimensionsToolArguments(request.arguments)) {
      return createInvalidArgumentsResult(
        request.name,
        "cad.sketch_dimensions expects arguments shaped as { sketchId: string }."
      );
    }

    const response = this.#adapter.query(
      parseCadOpsAgentQueryRequest({
        requestId: request.requestId ?? this.#createRequestId(),
        adapterVersion: ADAPTER_VERSION,
        query: {
          version: "cadops.v1",
          query: {
            query: "sketch.dimensions",
            sketchId: request.arguments.sketchId
          }
        }
      })
    );

    return createToolResult(request.name, response, !response.ok);
  }

  #callSketchEvaluation(request: CadMcpToolCallRequest): CadMcpToolCallResult {
    if (!isSketchDimensionsToolArguments(request.arguments)) {
      return createInvalidArgumentsResult(
        request.name,
        "cad.sketch_evaluation expects arguments shaped as { sketchId: string }."
      );
    }

    const response = this.#adapter.query(
      parseCadOpsAgentQueryRequest({
        requestId: request.requestId ?? this.#createRequestId(),
        adapterVersion: ADAPTER_VERSION,
        query: {
          version: "cadops.v1",
          query: {
            query: "sketch.evaluation",
            sketchId: request.arguments.sketchId
          }
        }
      })
    );

    return createToolResult(request.name, response, !response.ok);
  }

  #callSketchDimensionGet(
    request: CadMcpToolCallRequest
  ): CadMcpToolCallResult {
    if (!isIdToolArguments(request.arguments)) {
      return createInvalidArgumentsResult(
        request.name,
        "cad.sketch_dimension_get expects arguments shaped as { id: string }."
      );
    }

    const response = this.#adapter.query(
      parseCadOpsAgentQueryRequest({
        requestId: request.requestId ?? this.#createRequestId(),
        adapterVersion: ADAPTER_VERSION,
        query: {
          version: "cadops.v1",
          query: {
            query: "sketch.dimension.get",
            id: request.arguments.id
          }
        }
      })
    );

    return createToolResult(request.name, response, !response.ok);
  }

  #callBodyGeneratedReferences(
    request: CadMcpToolCallRequest
  ): CadMcpToolCallResult {
    if (!isBodyGeneratedReferencesToolArguments(request.arguments)) {
      return createInvalidArgumentsResult(
        request.name,
        "cad.body_generated_references expects arguments shaped as { bodyId: string }."
      );
    }

    const response = this.#adapter.query(
      parseCadOpsAgentQueryRequest({
        requestId: request.requestId ?? this.#createRequestId(),
        adapterVersion: ADAPTER_VERSION,
        query: {
          version: "cadops.v1",
          query: {
            query: "body.generatedReferences",
            bodyId: request.arguments.bodyId
          }
        }
      })
    );

    return createToolResult(request.name, response, !response.ok);
  }

  #callResolveGeneratedReference(
    request: CadMcpToolCallRequest
  ): CadMcpToolCallResult {
    if (!isResolveGeneratedReferenceToolArguments(request.arguments)) {
      return createInvalidArgumentsResult(
        request.name,
        "cad.resolve_generated_reference expects arguments shaped as { bodyId: string, stableId: string }."
      );
    }

    const response = this.#adapter.query(
      parseCadOpsAgentQueryRequest({
        requestId: request.requestId ?? this.#createRequestId(),
        adapterVersion: ADAPTER_VERSION,
        query: {
          version: "cadops.v1",
          query: {
            query: "body.resolveGeneratedReference",
            bodyId: request.arguments.bodyId,
            stableId: request.arguments.stableId
          }
        }
      })
    );

    return createToolResult(request.name, response, !response.ok);
  }

  #callGeneratedReferenceMeasurements(
    request: CadMcpToolCallRequest
  ): CadMcpToolCallResult {
    if (!isResolveGeneratedReferenceToolArguments(request.arguments)) {
      return createInvalidArgumentsResult(
        request.name,
        "cad.generated_reference_measurements expects arguments shaped as { bodyId: string, stableId: string }."
      );
    }

    const response = this.#adapter.query(
      parseCadOpsAgentQueryRequest({
        requestId: request.requestId ?? this.#createRequestId(),
        adapterVersion: ADAPTER_VERSION,
        query: {
          version: "cadops.v1",
          query: {
            query: "body.generatedReferenceMeasurements",
            bodyId: request.arguments.bodyId,
            stableId: request.arguments.stableId
          }
        }
      })
    );

    return createToolResult(request.name, response, !response.ok);
  }

  #callNamedReferences(request: CadMcpToolCallRequest): CadMcpToolCallResult {
    if (!isEmptyObjectOrUndefined(request.arguments)) {
      return createInvalidArgumentsResult(
        request.name,
        "cad.named_references does not accept arguments."
      );
    }

    const response = this.#adapter.query(
      parseCadOpsAgentQueryRequest({
        requestId: request.requestId ?? this.#createRequestId(),
        adapterVersion: ADAPTER_VERSION,
        query: {
          version: "cadops.v1",
          query: { query: "reference.listNamed" }
        }
      })
    );

    return createToolResult(request.name, response, !response.ok);
  }

  #callResolveNamedReference(
    request: CadMcpToolCallRequest
  ): CadMcpToolCallResult {
    if (!isResolveNamedReferenceToolArguments(request.arguments)) {
      return createInvalidArgumentsResult(
        request.name,
        "cad.resolve_named_reference expects arguments shaped as { name: string }."
      );
    }

    const response = this.#adapter.query(
      parseCadOpsAgentQueryRequest({
        requestId: request.requestId ?? this.#createRequestId(),
        adapterVersion: ADAPTER_VERSION,
        query: {
          version: "cadops.v1",
          query: {
            query: "reference.resolveNamed",
            name: request.arguments.name
          }
        }
      })
    );

    return createToolResult(request.name, response, !response.ok);
  }

  #callReferenceHealth(request: CadMcpToolCallRequest): CadMcpToolCallResult {
    if (!isReferenceHealthToolArguments(request.arguments)) {
      return createInvalidArgumentsResult(
        request.name,
        "cad.reference_health expects optional arguments shaped as { target?: { type: 'all' } | { type: 'body', bodyId: string } | { type: 'generatedReference', bodyId: string, stableId: string, expectedKind?: 'body' | 'face' | 'edge' | 'vertex' | 'axis' } | { type: 'namedReference', name: string } }."
      );
    }

    const response = this.#adapter.query(
      parseCadOpsAgentQueryRequest({
        requestId: request.requestId ?? this.#createRequestId(),
        adapterVersion: ADAPTER_VERSION,
        query: {
          version: "cadops.v1",
          query: {
            query: "reference.health",
            ...(request.arguments?.target
              ? { target: request.arguments.target }
              : {}),
            ...(request.arguments?.topologyMatchResults
              ? { topologyMatchResults: request.arguments.topologyMatchResults }
              : {})
          }
        }
      })
    );

    return createToolResult(request.name, response, !response.ok);
  }

  #callSelectionReferenceCandidates(
    request: CadMcpToolCallRequest
  ): CadMcpToolCallResult {
    if (!isSelectionReferenceCandidatesToolArguments(request.arguments)) {
      return createInvalidArgumentsResult(
        request.name,
        "cad.selection_reference_candidates expects exactly one of selection or currentTopologyEvidence, plus optional requiredOperation and topologyMatchResults."
      );
    }

    const response = this.#adapter.query(
      parseCadOpsAgentQueryRequest({
        requestId: request.requestId ?? this.#createRequestId(),
        adapterVersion: ADAPTER_VERSION,
        query: {
          version: "cadops.v1",
          query: {
            query: "selection.referenceCandidates",
            ...(request.arguments.selection
              ? { selection: request.arguments.selection }
              : {
                  currentTopologyEvidence:
                    request.arguments.currentTopologyEvidence
                }),
            ...(request.arguments.requiredOperation
              ? { requiredOperation: request.arguments.requiredOperation }
              : {}),
            ...(request.arguments.topologyMatchResults
              ? { topologyMatchResults: request.arguments.topologyMatchResults }
              : {})
          }
        }
      })
    );

    return createToolResult(request.name, response, !response.ok);
  }

  #callCurrentSelection(request: CadMcpToolCallRequest): CadMcpToolCallResult {
    if (!isEmptyObjectOrUndefined(request.arguments)) {
      return createInvalidArgumentsResult(
        request.name,
        "cad.get_selection does not accept arguments."
      );
    }

    const response = this.#adapter.getCurrentSelection({
      requestId: request.requestId ?? this.#createRequestId(),
      adapterVersion: ADAPTER_VERSION
    });

    return createToolResult(request.name, response, !response.ok);
  }

  #callProjectRequestExactExport(
    request: CadMcpToolCallRequest
  ): CadMcpToolCallResult {
    try {
      const exactRequest = parseCadAgentExactExportRequest({
        requestId: request.requestId ?? this.#createRequestId(),
        ...(isRecord(request.arguments) ? request.arguments : {})
      });
      if (!this.#executionPort) {
        return createToolResult(request.name, {
          ok: false,
          requestId: exactRequest.requestId,
          error: {
            code: "AGENT_SESSION_NOT_CONNECTED",
            message: "No connected browser session can request the download."
          }
        });
      }
      throw new CadMcpExecutionPortCall({
        operation: "requestExactExport",
        request: exactRequest
      });
    } catch (error) {
      if (error instanceof CadMcpExecutionPortCall) throw error;
      return createInvalidArgumentsResult(request.name, getErrorMessage(error));
    }
  }

  #callTransactionHistory(
    request: CadMcpToolCallRequest
  ): CadMcpToolCallResult {
    if (!isEmptyObjectOrUndefined(request.arguments)) {
      return createInvalidArgumentsResult(
        request.name,
        "cad.transaction_history does not accept arguments."
      );
    }

    const response = this.#adapter.query(
      parseCadOpsAgentQueryRequest({
        requestId: request.requestId ?? this.#createRequestId(),
        adapterVersion: ADAPTER_VERSION,
        query: {
          version: "cadops.v1",
          query: { query: "transaction.history" }
        }
      })
    );

    return createToolResult(request.name, response, !response.ok);
  }

  #callBatch(request: CadMcpToolCallRequest): CadMcpToolCallResult {
    if (!isBatchToolArguments(request.arguments)) {
      return createInvalidArgumentsResult(
        request.name,
        "cad.batch expects arguments shaped as { batch: CadBatch }."
      );
    }

    try {
      const response = this.#adapter.execute(
        parseCadOpsAgentRequest({
          requestId: request.requestId ?? this.#createRequestId(),
          adapterVersion: ADAPTER_VERSION,
          batch: request.arguments.batch,
          actor:
            request.arguments.actor ??
            request.arguments.batch.actor ??
            DEFAULT_MCP_ACTOR,
          permissions: {
            allowCommit: request.arguments.allowCommit === true
          },
          ...(request.arguments.projectHandoff
            ? { projectHandoff: request.arguments.projectHandoff }
            : {}),
          source: {
            source: "mcp",
            toolName: request.name
          }
        })
      );

      return createToolResult(request.name, response, !response.ok);
    } catch (error) {
      if (error instanceof CadMcpExecutionPortCall) throw error;
      return createInvalidArgumentsResult(request.name, getErrorMessage(error));
    }
  }

  #createRequestId(): string {
    const id = `mcp_req_${this.#nextRequestNumber}`;
    this.#nextRequestNumber += 1;
    return id;
  }
}

type CadMcpExecutionPortInvocation =
  | {
      readonly operation: "execute";
      readonly request: Parameters<CadOpsAgentAdapter["execute"]>[0];
    }
  | {
      readonly operation: "query";
      readonly request: Parameters<CadOpsAgentAdapter["query"]>[0];
    }
  | {
      readonly operation: "inspectV8ProjectSurface";
      readonly request: Parameters<
        CadOpsAgentAdapter["inspectV8ProjectSurface"]
      >[0];
    }
  | {
      readonly operation: "getCurrentSelection";
      readonly request: CadOpsAgentCurrentSelectionRequest;
    }
  | {
      readonly operation: "requestExactExport";
      readonly request: CadAgentExactExportRequest;
    };

class CadMcpExecutionPortCall extends Error {
  constructor(readonly invocation: CadMcpExecutionPortInvocation) {
    super(invocation.operation);
  }
}

class DeferredCadOpsAgentAdapter implements CadMcpSyncExecutionPort {
  execute(request: Parameters<CadOpsAgentAdapter["execute"]>[0]): never {
    throw new CadMcpExecutionPortCall({ operation: "execute", request });
  }

  query(request: Parameters<CadOpsAgentAdapter["query"]>[0]): never {
    throw new CadMcpExecutionPortCall({ operation: "query", request });
  }

  inspectV8ProjectSurface(
    request: Parameters<CadOpsAgentAdapter["inspectV8ProjectSurface"]>[0]
  ): never {
    throw new CadMcpExecutionPortCall({
      operation: "inspectV8ProjectSurface",
      request
    });
  }

  getCurrentSelection(request: CadOpsAgentCurrentSelectionRequest): never {
    throw new CadMcpExecutionPortCall({
      operation: "getCurrentSelection",
      request
    });
  }
}

function callExecutionPort(
  port: CadMcpExecutionPort,
  call: CadMcpExecutionPortCall
): Promise<CadMcpStructuredContent> {
  const { invocation } = call;
  switch (invocation.operation) {
    case "execute":
      return port.execute(invocation.request);
    case "query":
      return port.query(invocation.request);
    case "inspectV8ProjectSurface":
      return port.inspectV8ProjectSurface(invocation.request);
    case "getCurrentSelection":
      return port.getCurrentSelection(invocation.request);
    case "requestExactExport":
      return port.requestExactExport(invocation.request);
  }
}

export function createCadMcpServer(
  options: CadMcpServerOptions = {}
): CadMcpServer {
  return new CadMcpServer(options);
}

const V19_VEC2_SCHEMA = {
  type: "array",
  minItems: 2,
  maxItems: 2,
  items: { type: "number" },
  description:
    "A finite [x, y] point in sketch model space. Pixel, viewport, screenshot, and device coordinates are not accepted."
} as const;

const V19_ID_ARRAY_SCHEMA = {
  type: "array",
  minItems: 1,
  uniqueItems: true,
  items: { type: "string", minLength: 1 }
} as const;

const V19_ORIENTED_SEGMENT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["entityId", "orientation"],
  properties: {
    entityId: { type: "string", minLength: 1 },
    orientation: { enum: ["forward", "reverse"] }
  }
} as const;

const V19_LOOP_REF_SCHEMA = {
  oneOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["kind", "entityId"],
      properties: {
        kind: { const: "entity" },
        entityId: { type: "string", minLength: 1 }
      }
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["kind", "segments"],
      properties: {
        kind: { const: "wire" },
        segments: {
          type: "array",
          minItems: 2,
          maxItems: 4_096,
          items: V19_ORIENTED_SEGMENT_SCHEMA
        }
      }
    }
  ]
} as const;

const V19_CURVE_EDIT_PROPOSAL_SCHEMA = {
  oneOf: [
    {
      type: "object",
      additionalProperties: false,
      required: [
        "kind",
        "sketchId",
        "entityId",
        "boundaryEntityIds",
        "pickPoint"
      ],
      properties: {
        kind: { const: "trim" },
        sketchId: { type: "string", minLength: 1 },
        entityId: { type: "string", minLength: 1 },
        boundaryEntityIds: {
          ...V19_ID_ARRAY_SCHEMA,
          maxItems: 256
        },
        pickPoint: V19_VEC2_SCHEMA
      }
    },
    {
      type: "object",
      additionalProperties: false,
      required: [
        "kind",
        "sketchId",
        "entityId",
        "endpoint",
        "boundaryEntityIds"
      ],
      properties: {
        kind: { const: "extend" },
        sketchId: { type: "string", minLength: 1 },
        entityId: { type: "string", minLength: 1 },
        endpoint: { enum: ["start", "end"] },
        boundaryEntityIds: {
          ...V19_ID_ARRAY_SCHEMA,
          maxItems: 256
        }
      }
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["kind", "sketchId", "entityId", "splitPoints"],
      properties: {
        kind: { const: "split" },
        sketchId: { type: "string", minLength: 1 },
        entityId: { type: "string", minLength: 1 },
        splitPoints: {
          type: "array",
          minItems: 1,
          maxItems: 1_024,
          items: V19_VEC2_SCHEMA
        }
      }
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["kind", "sketchId", "entityId"],
      properties: {
        kind: { const: "explodeRectangle" },
        sketchId: { type: "string", minLength: 1 },
        entityId: { type: "string", minLength: 1 }
      }
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["kind", "sketchId", "source", "distance", "side"],
      properties: {
        kind: { const: "offset" },
        sketchId: { type: "string", minLength: 1 },
        source: {
          oneOf: [
            {
              type: "object",
              additionalProperties: false,
              required: ["kind", "entityId"],
              properties: {
                kind: { const: "entity" },
                entityId: { type: "string", minLength: 1 }
              }
            },
            {
              type: "object",
              additionalProperties: false,
              required: ["kind", "segments", "closed"],
              properties: {
                kind: { const: "chain" },
                segments: {
                  type: "array",
                  minItems: 1,
                  maxItems: 1_024,
                  items: V19_ORIENTED_SEGMENT_SCHEMA
                },
                closed: { type: "boolean" }
              }
            }
          ]
        },
        distance: { type: "number", exclusiveMinimum: 0 },
        side: { enum: ["left", "right", "inward", "outward"] },
        referencePoint: V19_VEC2_SCHEMA
      }
    }
  ]
} as const;

const V19_CURVE_EDIT_PRECONDITION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["expectedSourceRevision", "expectedSolverEvaluationIdentity"],
  properties: {
    expectedSourceRevision: {
      type: "string",
      pattern: "^partbench-source-v1:[0-9a-f]{64}$"
    },
    expectedSolverEvaluationIdentity: {
      oneOf: [
        { const: "none" },
        {
          type: "string",
          pattern: "^partbench-sketch-solver-evaluation-v1:[0-9a-f]{64}$"
        }
      ]
    }
  }
} as const;

const V19_OFFSET_SOURCE_SCHEMA = {
  oneOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["kind", "entityId"],
      properties: {
        kind: { const: "entity" },
        entityId: { type: "string", minLength: 1 }
      }
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["kind", "segments", "closed"],
      properties: {
        kind: { const: "chain" },
        segments: {
          type: "array",
          minItems: 1,
          maxItems: 1_024,
          items: V19_ORIENTED_SEGMENT_SCHEMA
        },
        closed: { type: "boolean" }
      }
    }
  ]
} as const;

const V19_NON_EMPTY_ID_SCHEMA = {
  type: "string",
  minLength: 1
} as const;

const V19_POINT_TARGET_SCHEMA = {
  oneOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["entityId", "entityKind", "role"],
      properties: {
        entityId: V19_NON_EMPTY_ID_SCHEMA,
        entityKind: { const: "point" },
        role: { const: "position" }
      }
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["entityId", "entityKind", "role"],
      properties: {
        entityId: V19_NON_EMPTY_ID_SCHEMA,
        entityKind: { const: "line" },
        role: { enum: ["start", "end"] }
      }
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["entityId", "entityKind", "role"],
      properties: {
        entityId: V19_NON_EMPTY_ID_SCHEMA,
        entityKind: { enum: ["rectangle", "circle"] },
        role: { const: "center" }
      }
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["entityId", "entityKind", "role"],
      properties: {
        entityId: V19_NON_EMPTY_ID_SCHEMA,
        entityKind: { const: "arc" },
        role: { enum: ["center", "start", "end"] }
      }
    }
  ]
} as const;

const V19_MIDPOINT_TARGET_SCHEMA = {
  oneOf: [V19_POINT_TARGET_SCHEMA.oneOf[0], V19_POINT_TARGET_SCHEMA.oneOf[2]]
} as const;

const V19_CURVE_TARGET_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["entityId", "entityKind"],
  properties: {
    entityId: V19_NON_EMPTY_ID_SCHEMA,
    entityKind: { enum: ["line", "circle", "arc"] }
  }
} as const;

const V19_LINE_CURVE_TARGET_SCHEMA = {
  ...V19_CURVE_TARGET_SCHEMA,
  properties: {
    entityId: V19_NON_EMPTY_ID_SCHEMA,
    entityKind: { const: "line" }
  }
} as const;

const V19_CIRCLE_CURVE_TARGET_SCHEMA = {
  ...V19_CURVE_TARGET_SCHEMA,
  properties: {
    entityId: V19_NON_EMPTY_ID_SCHEMA,
    entityKind: { const: "circle" }
  }
} as const;

const V19_ARC_CURVE_TARGET_SCHEMA = {
  ...V19_CURVE_TARGET_SCHEMA,
  properties: {
    entityId: V19_NON_EMPTY_ID_SCHEMA,
    entityKind: { const: "arc" }
  }
} as const;

const V19_TANGENT_TARGET_PAIR_SCHEMA = {
  oneOf: [
    {
      properties: {
        primaryTarget: V19_LINE_CURVE_TARGET_SCHEMA,
        secondaryTarget: {
          oneOf: [V19_CIRCLE_CURVE_TARGET_SCHEMA, V19_ARC_CURVE_TARGET_SCHEMA]
        }
      }
    },
    {
      properties: {
        primaryTarget: V19_CIRCLE_CURVE_TARGET_SCHEMA,
        secondaryTarget: {
          oneOf: [V19_LINE_CURVE_TARGET_SCHEMA, V19_ARC_CURVE_TARGET_SCHEMA]
        }
      }
    },
    {
      properties: {
        primaryTarget: V19_ARC_CURVE_TARGET_SCHEMA,
        secondaryTarget: {
          oneOf: [
            V19_LINE_CURVE_TARGET_SCHEMA,
            V19_CIRCLE_CURVE_TARGET_SCHEMA,
            V19_ARC_CURVE_TARGET_SCHEMA
          ]
        }
      }
    }
  ]
} as const;

const V19_RADIUS_CURVE_TARGET_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["entityId", "entityKind"],
  properties: {
    entityId: V19_NON_EMPTY_ID_SCHEMA,
    entityKind: { enum: ["circle", "arc"] }
  }
} as const;

const V19_DIMENSION_TARGET_SCHEMA = {
  oneOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["kind", "entityId", "entityKind", "role"],
      properties: {
        kind: { const: "entityScalar" },
        entityId: V19_NON_EMPTY_ID_SCHEMA,
        entityKind: { const: "rectangle" },
        role: { enum: ["width", "height"] }
      }
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["kind", "entityId", "entityKind", "role"],
      properties: {
        kind: { const: "entityScalar" },
        entityId: V19_NON_EMPTY_ID_SCHEMA,
        entityKind: { const: "line" },
        role: { const: "length" }
      }
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["kind", "entityId", "entityKind", "role"],
      properties: {
        kind: { const: "entityScalar" },
        entityId: V19_NON_EMPTY_ID_SCHEMA,
        entityKind: { const: "circle" },
        role: { enum: ["radius", "diameter"] }
      }
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["kind", "entityId", "entityKind", "role"],
      properties: {
        kind: { const: "entityScalar" },
        entityId: V19_NON_EMPTY_ID_SCHEMA,
        entityKind: { const: "arc" },
        role: { enum: ["radius", "diameter", "sweep"] }
      }
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["kind", "primary", "secondary", "measurement"],
      properties: {
        kind: { const: "pointPair" },
        primary: V19_POINT_TARGET_SCHEMA,
        secondary: V19_POINT_TARGET_SCHEMA,
        measurement: { const: "distance" }
      }
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["kind", "primary", "secondary", "measurement", "direction"],
      properties: {
        kind: { const: "pointPair" },
        primary: V19_POINT_TARGET_SCHEMA,
        secondary: V19_POINT_TARGET_SCHEMA,
        measurement: { enum: ["horizontal", "vertical"] },
        direction: { enum: ["positive", "negative"] }
      }
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["kind", "point", "lineEntityId", "side"],
      properties: {
        kind: { const: "pointLineDistance" },
        point: V19_POINT_TARGET_SCHEMA,
        lineEntityId: V19_NON_EMPTY_ID_SCHEMA,
        side: { enum: ["left", "right"] }
      }
    },
    {
      type: "object",
      additionalProperties: false,
      required: [
        "kind",
        "primaryLineEntityId",
        "secondaryLineEntityId",
        "sense"
      ],
      properties: {
        kind: { const: "lineAngle" },
        primaryLineEntityId: V19_NON_EMPTY_ID_SCHEMA,
        secondaryLineEntityId: V19_NON_EMPTY_ID_SCHEMA,
        sense: { enum: ["clockwise", "counterclockwise"] }
      }
    }
  ]
} as const;

const V19_EXACTLY_ONE_DIMENSION_VALUE_SOURCE_SCHEMA = {
  oneOf: [
    {
      required: ["value"],
      not: { required: ["parameterId"] }
    },
    {
      required: ["parameterId"],
      not: { required: ["value"] }
    }
  ]
} as const;

const V19_CONSTRAINT_CREATE_COMMON_PROPERTIES = {
  op: { const: "sketch.constraint.create" },
  id: V19_NON_EMPTY_ID_SCHEMA,
  name: V19_NON_EMPTY_ID_SCHEMA,
  sketchId: V19_NON_EMPTY_ID_SCHEMA
} as const;

const V19_CONSTRAINT_CREATE_SCHEMA = {
  oneOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["op", "name", "sketchId", "kind", "entityId"],
      properties: {
        ...V19_CONSTRAINT_CREATE_COMMON_PROPERTIES,
        kind: { enum: ["horizontal", "vertical"] },
        entityId: V19_NON_EMPTY_ID_SCHEMA
      }
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["op", "name", "sketchId", "kind", "target"],
      properties: {
        ...V19_CONSTRAINT_CREATE_COMMON_PROPERTIES,
        kind: { const: "fixed" },
        target: V19_POINT_TARGET_SCHEMA,
        coordinate: V19_VEC2_SCHEMA
      }
    },
    {
      type: "object",
      additionalProperties: false,
      required: [
        "op",
        "name",
        "sketchId",
        "kind",
        "primaryTarget",
        "secondaryTarget"
      ],
      properties: {
        ...V19_CONSTRAINT_CREATE_COMMON_PROPERTIES,
        kind: { const: "coincident" },
        primaryTarget: V19_POINT_TARGET_SCHEMA,
        secondaryTarget: V19_POINT_TARGET_SCHEMA
      }
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["op", "name", "sketchId", "kind", "lineEntityId", "target"],
      properties: {
        ...V19_CONSTRAINT_CREATE_COMMON_PROPERTIES,
        kind: { const: "midpoint" },
        lineEntityId: V19_NON_EMPTY_ID_SCHEMA,
        target: V19_MIDPOINT_TARGET_SCHEMA
      }
    },
    {
      type: "object",
      additionalProperties: false,
      required: [
        "op",
        "name",
        "sketchId",
        "kind",
        "primaryLineEntityId",
        "secondaryLineEntityId"
      ],
      properties: {
        ...V19_CONSTRAINT_CREATE_COMMON_PROPERTIES,
        kind: { enum: ["parallel", "perpendicular", "equalLength"] },
        primaryLineEntityId: V19_NON_EMPTY_ID_SCHEMA,
        secondaryLineEntityId: V19_NON_EMPTY_ID_SCHEMA
      }
    },
    {
      type: "object",
      additionalProperties: false,
      required: [
        "op",
        "name",
        "sketchId",
        "kind",
        "primaryTarget",
        "secondaryTarget"
      ],
      properties: {
        ...V19_CONSTRAINT_CREATE_COMMON_PROPERTIES,
        kind: { const: "tangent" },
        primaryTarget: V19_CURVE_TARGET_SCHEMA,
        secondaryTarget: V19_CURVE_TARGET_SCHEMA
      },
      allOf: [V19_TANGENT_TARGET_PAIR_SCHEMA]
    },
    {
      type: "object",
      additionalProperties: false,
      required: [
        "op",
        "name",
        "sketchId",
        "kind",
        "primaryTarget",
        "secondaryTarget"
      ],
      properties: {
        ...V19_CONSTRAINT_CREATE_COMMON_PROPERTIES,
        kind: { enum: ["concentric", "equalRadius"] },
        primaryTarget: V19_RADIUS_CURVE_TARGET_SCHEMA,
        secondaryTarget: V19_RADIUS_CURVE_TARGET_SCHEMA
      }
    },
    {
      type: "object",
      additionalProperties: false,
      required: [
        "op",
        "name",
        "sketchId",
        "kind",
        "primaryTarget",
        "secondaryTarget",
        "symmetryLineEntityId"
      ],
      properties: {
        ...V19_CONSTRAINT_CREATE_COMMON_PROPERTIES,
        kind: { const: "symmetry" },
        primaryTarget: V19_POINT_TARGET_SCHEMA,
        secondaryTarget: V19_POINT_TARGET_SCHEMA,
        symmetryLineEntityId: V19_NON_EMPTY_ID_SCHEMA
      }
    }
  ]
} as const;

const V19_CONSTRAINT_DEFINITION_SCHEMA = {
  oneOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["kind", "entityId"],
      properties: {
        kind: { enum: ["horizontal", "vertical"] },
        entityId: V19_NON_EMPTY_ID_SCHEMA
      }
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["kind", "target", "coordinate"],
      properties: {
        kind: { const: "fixed" },
        target: V19_POINT_TARGET_SCHEMA,
        coordinate: V19_VEC2_SCHEMA
      }
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["kind", "primaryTarget", "secondaryTarget"],
      properties: {
        kind: { const: "coincident" },
        primaryTarget: V19_POINT_TARGET_SCHEMA,
        secondaryTarget: V19_POINT_TARGET_SCHEMA
      }
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["kind", "lineEntityId", "target"],
      properties: {
        kind: { const: "midpoint" },
        lineEntityId: V19_NON_EMPTY_ID_SCHEMA,
        target: V19_MIDPOINT_TARGET_SCHEMA
      }
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["kind", "primaryLineEntityId", "secondaryLineEntityId"],
      properties: {
        kind: {
          enum: ["parallel", "perpendicular", "equalLength"]
        },
        primaryLineEntityId: V19_NON_EMPTY_ID_SCHEMA,
        secondaryLineEntityId: V19_NON_EMPTY_ID_SCHEMA
      }
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["kind", "primaryTarget", "secondaryTarget"],
      properties: {
        kind: { const: "tangent" },
        primaryTarget: V19_CURVE_TARGET_SCHEMA,
        secondaryTarget: V19_CURVE_TARGET_SCHEMA
      },
      allOf: [V19_TANGENT_TARGET_PAIR_SCHEMA]
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["kind", "primaryTarget", "secondaryTarget"],
      properties: {
        kind: { enum: ["concentric", "equalRadius"] },
        primaryTarget: V19_RADIUS_CURVE_TARGET_SCHEMA,
        secondaryTarget: V19_RADIUS_CURVE_TARGET_SCHEMA
      }
    },
    {
      type: "object",
      additionalProperties: false,
      required: [
        "kind",
        "primaryTarget",
        "secondaryTarget",
        "symmetryLineEntityId"
      ],
      properties: {
        kind: { const: "symmetry" },
        primaryTarget: V19_POINT_TARGET_SCHEMA,
        secondaryTarget: V19_POINT_TARGET_SCHEMA,
        symmetryLineEntityId: V19_NON_EMPTY_ID_SCHEMA
      }
    },
    {
      type: "object",
      additionalProperties: false,
      required: [
        "kind",
        "primaryLineEntityId",
        "secondaryLineEntityId",
        "angleDegrees"
      ],
      properties: {
        kind: { const: "angle" },
        primaryLineEntityId: V19_NON_EMPTY_ID_SCHEMA,
        secondaryLineEntityId: V19_NON_EMPTY_ID_SCHEMA,
        angleDegrees: { type: "number" }
      }
    }
  ]
} as const;

const V19_BATCH_OP_SCHEMA = {
  oneOf: [
    {
      type: "object",
      additionalProperties: false,
      required: [
        "op",
        "sketchId",
        "precondition",
        "source",
        "distance",
        "side"
      ],
      properties: {
        op: { const: "sketch.offset" },
        sketchId: { type: "string", minLength: 1 },
        precondition: V19_CURVE_EDIT_PRECONDITION_SCHEMA,
        source: V19_OFFSET_SOURCE_SCHEMA,
        distance: { type: "number", exclusiveMinimum: 0 },
        side: { enum: ["left", "right", "inward", "outward"] },
        referencePoint: V19_VEC2_SCHEMA,
        createdEntityIds: {
          ...V19_ID_ARRAY_SCHEMA,
          maxItems: 1_024
        }
      }
    },
    {
      type: "object",
      additionalProperties: false,
      required: [
        "op",
        "sketchId",
        "centerlineStart",
        "centerlineEnd",
        "radius"
      ],
      properties: {
        op: { const: "sketch.addSlot" },
        sketchId: { type: "string", minLength: 1 },
        centerlineStart: V19_VEC2_SCHEMA,
        centerlineEnd: V19_VEC2_SCHEMA,
        radius: { type: "number", exclusiveMinimum: 0 },
        construction: { type: "boolean" },
        entityIds: {
          ...V19_ID_ARRAY_SCHEMA,
          minItems: 4,
          maxItems: 4
        },
        constraintIds: {
          ...V19_ID_ARRAY_SCHEMA,
          minItems: 9,
          maxItems: 9
        }
      }
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["op", "sketchId", "center", "width", "height", "cornerRadius"],
      properties: {
        op: { const: "sketch.addRoundedRectangle" },
        sketchId: { type: "string", minLength: 1 },
        center: V19_VEC2_SCHEMA,
        width: { type: "number", exclusiveMinimum: 0 },
        height: { type: "number", exclusiveMinimum: 0 },
        cornerRadius: { type: "number", exclusiveMinimum: 0 },
        construction: { type: "boolean" },
        entityIds: {
          ...V19_ID_ARRAY_SCHEMA,
          minItems: 8,
          maxItems: 8
        },
        constraintIds: {
          ...V19_ID_ARRAY_SCHEMA,
          minItems: 23,
          maxItems: 23
        }
      }
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["op", "name", "sketchId", "target"],
      properties: {
        op: { const: "sketch.dimension.create" },
        id: V19_NON_EMPTY_ID_SCHEMA,
        name: V19_NON_EMPTY_ID_SCHEMA,
        sketchId: V19_NON_EMPTY_ID_SCHEMA,
        target: V19_DIMENSION_TARGET_SCHEMA,
        value: { type: "number" },
        parameterId: V19_NON_EMPTY_ID_SCHEMA
      },
      ...V19_EXACTLY_ONE_DIMENSION_VALUE_SOURCE_SCHEMA,
      allOf: [
        {
          if: {
            properties: {
              target: {
                properties: { kind: { const: "lineAngle" } },
                required: ["kind"]
              }
            },
            required: ["target"]
          },
          then: {
            required: ["value"],
            not: { required: ["parameterId"] }
          }
        }
      ]
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["op", "id"],
      properties: {
        op: { const: "sketch.dimension.update" },
        id: V19_NON_EMPTY_ID_SCHEMA,
        target: V19_DIMENSION_TARGET_SCHEMA,
        value: { type: "number" },
        parameterId: V19_NON_EMPTY_ID_SCHEMA
      },
      ...V19_EXACTLY_ONE_DIMENSION_VALUE_SOURCE_SCHEMA,
      allOf: [
        {
          if: {
            properties: {
              target: {
                properties: { kind: { const: "lineAngle" } },
                required: ["kind"]
              }
            },
            required: ["target"]
          },
          then: {
            required: ["value"],
            not: { required: ["parameterId"] }
          }
        }
      ]
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["op", "id", "name"],
      properties: {
        op: { const: "sketch.dimension.rename" },
        id: V19_NON_EMPTY_ID_SCHEMA,
        name: V19_NON_EMPTY_ID_SCHEMA
      }
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["op", "id"],
      properties: {
        op: { const: "sketch.dimension.delete" },
        id: V19_NON_EMPTY_ID_SCHEMA
      }
    },
    V19_CONSTRAINT_CREATE_SCHEMA,
    {
      type: "object",
      additionalProperties: false,
      required: ["op", "id", "definition"],
      properties: {
        op: { const: "sketch.constraint.update" },
        id: V19_NON_EMPTY_ID_SCHEMA,
        definition: V19_CONSTRAINT_DEFINITION_SCHEMA
      }
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["op", "id", "name"],
      properties: {
        op: { const: "sketch.constraint.rename" },
        id: V19_NON_EMPTY_ID_SCHEMA,
        name: V19_NON_EMPTY_ID_SCHEMA
      }
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["op", "id"],
      properties: {
        op: { const: "sketch.constraint.delete" },
        id: V19_NON_EMPTY_ID_SCHEMA
      }
    },
    {
      type: "object",
      description:
        "A legacy typed CadOp whose op is not one of the schema-exact V19 sketch commands.",
      required: ["op"],
      properties: {
        op: {
          type: "string",
          not: {
            enum: [
              "sketch.offset",
              "sketch.addSlot",
              "sketch.addRoundedRectangle",
              "sketch.dimension.create",
              "sketch.dimension.update",
              "sketch.dimension.rename",
              "sketch.dimension.delete",
              "sketch.constraint.create",
              "sketch.constraint.update",
              "sketch.constraint.rename",
              "sketch.constraint.delete"
            ]
          }
        }
      },
      additionalProperties: true
    }
  ]
} as const;

const CAD_MCP_TOOLS: readonly McpToolDefinition[] = [
  {
    name: "cad.parameter_list",
    description:
      "Returns source-of-truth document parameters in the current CAD document.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        derivedExactMetadata: {
          type: "array",
          description:
            "Optional derived exact metadata snapshots used as read-only cache input for V6 result-body health.",
          items: {
            type: "object"
          }
        }
      }
    }
  },
  {
    name: "cad.parameter_get",
    description: "Returns one source-of-truth document parameter by ID.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["id"],
      properties: {
        id: {
          type: "string",
          description: "Parameter ID to fetch."
        }
      }
    }
  },
  {
    name: "cad.project_parameter_evaluation",
    description:
      "Returns the parameter expression dependency graph, evaluation order, cycles, and diagnostics.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {}
    }
  },
  {
    name: "cad.feature_editability",
    description:
      "Returns V10 source feature editability, editable fields, rebuild readiness, dry-run status, and reference-effect diagnostics.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["featureId"],
      properties: {
        featureId: {
          type: "string",
          description: "Source feature ID to inspect."
        },
        proposedEdit: {
          type: "object",
          additionalProperties: false,
          required: ["kind"],
          properties: {
            kind: { const: "extrude" },
            depth: {
              type: "number",
              description: "Optional proposed extrude depth."
            },
            side: {
              enum: ["positive", "negative", "symmetric"],
              description: "Optional proposed extrude side."
            }
          }
        },
        topologyMatchResults: {
          type: "array",
          description:
            "Optional V13 topology.matchSnapshots results used as read-only health evidence.",
          items: {
            type: "object"
          }
        }
      }
    }
  },
  {
    name: "cad.project_summary",
    description:
      "Returns a compact V7 release summary with legacy objects plus source-derived structure, health, reference capability, export readiness, and workflow hints.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {}
    }
  },
  {
    name: "cad.project_features",
    description:
      "Returns read-only feature summaries, including primitive-derived and authored sketch feature bodies.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {}
    }
  },
  {
    name: "cad.project_structure",
    description:
      "Returns the default part, primitive-derived features/bodies, authored sketch feature bodies, and source mappings.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {}
    }
  },
  {
    name: "cad.project_health",
    description:
      "Returns read-only dependency and health status for authored sketches, features, generated bodies, and named references.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {}
    }
  },
  {
    name: "cad.project_dependency_graph",
    description:
      "Returns source-derived dependency graph nodes, edges, reference health, and optional V13 topology-anchor match diagnostics.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        topologyMatchResults: {
          type: "array",
          description:
            "Optional V13 topology.matchSnapshots results used as read-only health evidence.",
          items: {
            type: "object"
          }
        }
      }
    }
  },
  {
    name: "cad.project_rebuild_plan",
    description:
      "Returns source-derived rebuild plan and body lifecycle status, including optional V13 topology-anchor match effects.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        topologyMatchResults: {
          type: "array",
          description:
            "Optional V13 topology.matchSnapshots results used as read-only health evidence.",
          items: {
            type: "object"
          }
        }
      }
    }
  },
  {
    name: "cad.project_topology_identity_readiness",
    description:
      "Returns V13 topology identity contract readiness, planned V18/.wcad v2 boundaries, capability diagnostics, and private-ID exclusion notes.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {}
    }
  },
  {
    name: "cad.topology_match_snapshots",
    description:
      "Runs V13 non-mutating exact topology snapshot matching and returns confidence, evidence, ambiguity, split/merge, deletion, and repair diagnostics.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["previous", "candidates"],
      properties: {
        previous: { type: "object" },
        candidates: {
          type: "array",
          items: { type: "object" }
        }
      }
    }
  },
  {
    name: "cad.topology_anchor_repair_candidates",
    description:
      "Groups V13 topology match repair candidates by current topology anchors without mutating source; repair commits still go through topology.anchorRepairPlan/topology.anchor.repair.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["previous", "candidates"],
      properties: {
        previous: { type: "object" },
        candidates: {
          type: "array",
          items: { type: "object" }
        },
        anchorIds: {
          type: "array",
          items: { type: "string" },
          description:
            "Optional list of topology anchor ids to group; omitted means all current anchors that match the previous snapshot evidence."
        }
      }
    }
  },
  {
    name: "cad.topology_anchor_command_readiness",
    description:
      "Reports V13 topology-anchor command readiness from checkpoint snapshot evidence and the shared selection.referenceCandidates commandability path.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["anchorId", "snapshot"],
      properties: {
        anchorId: {
          type: "string",
          description: "Existing topology anchor source id to test."
        },
        snapshot: {
          type: "object",
          description:
            "Caller-supplied exact topology snapshot evidence for the anchor checkpoint/body."
        },
        requiredOperation: {
          type: "string",
          description:
            "Optional operation that must be command-ready, such as feature.attachSketchPlane, feature.extrudeCutTarget, feature.extrudeAddTarget, feature.holeTarget, feature.chamfer, feature.fillet, feature.measureReference, or feature.selectReference."
        }
      }
    }
  },
  {
    name: "cad.topology_command_target_readiness",
    description:
      "Reports V14 topology-backed command target readiness for a body, generated reference, named reference, or topology anchor using cad-core selection/reference/topology evidence.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["target"],
      properties: {
        target: {
          oneOf: [
            {
              type: "object",
              additionalProperties: false,
              required: ["type", "bodyId"],
              properties: {
                type: { const: "body" },
                bodyId: { type: "string" }
              }
            },
            {
              type: "object",
              additionalProperties: false,
              required: ["type", "bodyId", "stableId"],
              properties: {
                type: { const: "generatedReference" },
                bodyId: { type: "string" },
                stableId: { type: "string" },
                expectedKind: {
                  type: "string",
                  enum: ["body", "face", "edge", "vertex", "axis"]
                }
              }
            },
            {
              type: "object",
              additionalProperties: false,
              required: ["type", "name"],
              properties: {
                type: { const: "namedReference" },
                name: { type: "string" }
              }
            },
            {
              type: "object",
              additionalProperties: false,
              required: ["type", "anchorId"],
              properties: {
                type: { const: "topologyAnchor" },
                anchorId: { type: "string" }
              }
            }
          ]
        },
        desiredOperation: {
          type: "string",
          description:
            "Optional operation filter, such as feature.attachSketchPlane, feature.extrudeCutTarget, feature.extrudeAddTarget, feature.holeTarget, feature.chamfer, feature.fillet, feature.measureReference, feature.selectReference, or reference.nameGenerated."
        },
        snapshot: {
          type: "object",
          description:
            "Optional exact topology snapshot evidence used when the target is a topology anchor."
        },
        topologyMatchResults: {
          type: "array",
          description:
            "Optional topology match results used as read-only reference-health evidence.",
          items: { type: "object" }
        }
      }
    }
  },
  {
    name: "cad.topology_anchor_creation_plan",
    description:
      "Returns a non-mutating V13 plan for creating topology checkpoint and anchor CADOps from one exact-bound generated reference.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["bodyId", "stableId"],
      properties: {
        bodyId: {
          type: "string",
          description: "Body containing the generated reference candidate."
        },
        stableId: {
          type: "string",
          description:
            "Generated reference stable id to promote into a topology anchor plan."
        },
        checkpointId: {
          type: "string",
          description:
            "Optional checkpoint id to reuse or create if no matching source record exists."
        },
        anchorId: {
          type: "string",
          description: "Optional anchor id for the proposed anchor command."
        },
        derivedExactMetadata: {
          type: "object",
          description:
            "Optional exact derived topology metadata used as read-only binding evidence."
        }
      }
    }
  },
  {
    name: "cad.topology_anchor_repair_plan",
    description:
      "Returns a non-mutating V13 plan for repairing one topology anchor to one exact replacement checkpoint entity.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["anchorId", "derivedExactMetadata"],
      properties: {
        anchorId: {
          type: "string",
          description: "Existing topology anchor source id to repair."
        },
        replacementCheckpointId: {
          type: "string",
          description:
            "Existing replacement checkpoint source id. Required unless createReplacementCheckpoint is true."
        },
        createReplacementCheckpoint: {
          type: "boolean",
          description:
            "When true, cad-core may include a replacement topology.checkpoint.create op before the repair op."
        },
        selectedRepairCandidateId: {
          type: "string",
          description:
            "Optional opaque repair candidate id from a previous repair-plan response. When supplied, cad-core may plan an explicit manual repair for that candidate."
        },
        repairId: {
          type: "string",
          description: "Optional repair id for the proposed repair command."
        },
        derivedExactMetadata: {
          type: "object",
          description:
            "Exact derived topology metadata used as read-only replacement entity evidence."
        }
      }
    }
  },
  {
    name: "cad.project_export_readiness",
    description:
      "Returns read-only per-body export readiness and the current identity-bound AP242 STEP plan when connected derived evidence is available.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {}
    }
  },
  {
    name: "cad.project_export_exact",
    description:
      "Returns an all-or-nothing identity-bound AP242 STEP plan with requested body order, names, units, current per-body readiness, and diagnostics. MCP receives no geometry, file bytes, handles, or file-writing authority.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["format"],
      properties: {
        format: {
          type: "string",
          enum: ["step"],
          description:
            "Plans named STEP AP242DIS output; does not write a file."
        },
        bodyIds: {
          type: "array",
          description:
            "Optional semantic body IDs in the exact requested output order. Omit to plan all active bodies.",
          items: { type: "string" }
        },
        sourceIdentity: {
          type: "object",
          description:
            "Optional authoritative project identity guard for stale-plan detection.",
          additionalProperties: false,
          required: ["algorithm", "sha256"],
          properties: {
            algorithm: {
              type: "string",
              enum: [WCAD_SOURCE_IDENTITY_ALGORITHM]
            },
            sha256: { type: "string", pattern: SHA256_HEX_PATTERN }
          }
        }
      }
    }
  },
  {
    name: "cad.project_request_exact_export",
    description:
      "Requests one browser-owned named AP242 STEP download through the connected session approval flow. Returns bounded metadata only, never file bytes, paths, URLs, handles, or filenames.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["selection"],
      properties: {
        selection: {
          oneOf: [
            {
              type: "object",
              additionalProperties: false,
              required: ["mode"],
              properties: { mode: { const: "all" } }
            },
            {
              type: "object",
              additionalProperties: false,
              required: ["mode"],
              properties: { mode: { const: "readySubset" } }
            },
            {
              type: "object",
              additionalProperties: false,
              required: ["mode", "bodyIds"],
              properties: {
                mode: { const: "bodyIds" },
                bodyIds: {
                  type: "array",
                  minItems: 1,
                  maxItems: 256,
                  uniqueItems: true,
                  items: { type: "string", minLength: 1, maxLength: 1024 }
                }
              }
            }
          ]
        },
        expectedSourceIdentity: {
          type: "object",
          additionalProperties: false,
          required: ["algorithm", "sha256"],
          properties: {
            algorithm: { const: WCAD_SOURCE_IDENTITY_ALGORITHM },
            sha256: { type: "string", pattern: SHA256_HEX_PATTERN }
          }
        }
      }
    }
  },
  {
    name: "cad.project_package_readiness",
    description:
      "Returns read-only V8 .wcad package contract readiness, required source entries, cache/source boundary notes, and deferred storage/export implementation status.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {}
    }
  },
  {
    name: "cad.project_import_readiness",
    description:
      "Returns read-only V15 STEP import readiness, imported-body counts, diagnostic status, and source/derived boundary notes.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {}
    }
  },
  {
    name: "cad.v8_project_surface",
    description:
      "Returns a compact V8 Agent/MCP surface summary for .wcad package readiness, OPFS cache contract status, exact STEP readiness/export availability, unsupported body diagnostics, and file-writing boundaries.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        exactExport: {
          type: "object",
          additionalProperties: false,
          required: ["format"],
          properties: {
            format: { type: "string", enum: ["step"] },
            bodyIds: {
              type: "array",
              items: { type: "string" }
            },
            sourceIdentity: {
              type: "object",
              additionalProperties: false,
              required: ["algorithm", "sha256"],
              properties: {
                algorithm: {
                  type: "string",
                  enum: [WCAD_SOURCE_IDENTITY_ALGORITHM]
                },
                sha256: { type: "string", pattern: SHA256_HEX_PATTERN }
              }
            }
          }
        }
      }
    }
  },
  {
    name: "cad.project_sketches",
    description:
      "Returns source-of-truth sketches and sketch entities in the current CAD document.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {}
    }
  },
  {
    name: "cad.object_measurements",
    description:
      "Returns derived measurements and bounds for one current CAD object.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["id"],
      properties: {
        id: {
          type: "string",
          description: "Object ID to measure."
        }
      }
    }
  },
  {
    name: "cad.body_measurements",
    description:
      "Returns source-derived measurements for one authored sketch-extrude body.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["bodyId"],
      properties: {
        bodyId: {
          type: "string",
          description: "Authored sketch-extrude body ID to measure."
        }
      }
    }
  },
  {
    name: "cad.body_imported_body_status",
    description:
      "Returns read-only V15 imported-body checkpoint/topology status for one body ID.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["bodyId"],
      properties: {
        bodyId: {
          type: "string",
          description: "Body ID to inspect for imported STEP body status."
        }
      }
    }
  },
  {
    name: "cad.body_topology",
    description:
      "Returns derived exact/topology availability and status for one body.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["bodyId"],
      properties: {
        bodyId: {
          type: "string",
          description: "Body ID to inspect for exact/topology data."
        },
        derivedExactMetadata: {
          type: "object",
          description:
            "Optional derived exact metadata snapshot for this body. This is read-only cache data and is not persisted."
        }
      }
    }
  },
  {
    name: "cad.body_topology_identity",
    description:
      "Returns V13 non-mutating topology identity candidates for generated references on one body, optionally binding them to a topology checkpoint and derived exact topology snapshot.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["bodyId"],
      properties: {
        bodyId: {
          type: "string",
          description: "Body ID to inspect for topology identity candidates."
        },
        checkpointId: {
          type: "string",
          description:
            "Optional topology checkpoint source record to use as identity context."
        },
        derivedExactMetadata: {
          type: "object",
          description:
            "Optional derived exact metadata snapshot for this body. This is read-only cache evidence and is not persisted."
        }
      }
    }
  },
  {
    name: "cad.project_extents",
    description:
      "Returns aggregate derived extents and approximate volume for the current CAD document.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        derivedExactMetadata: {
          type: "array",
          description:
            "Optional derived exact metadata snapshots used as read-only cache input for V6 result body extents.",
          items: {
            type: "object"
          }
        }
      }
    }
  },
  {
    name: "cad.sketch_get",
    description: "Returns one source-of-truth sketch by ID.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["id"],
      properties: {
        id: {
          type: "string",
          description: "Sketch ID to fetch."
        }
      }
    }
  },
  {
    name: "cad.sketch_curve_edit_readiness",
    description:
      "Call this before a V19 curve edit. It prepares one typed trim, extend, split, explode-rectangle, or non-associative offset proposal and returns either full blocker diagnostics or a preparedOperation with current source/solver preconditions, generated IDs, exact constraint/dimension deletion lists, dependency impact, and a model-space preview. Submit that preparedOperation as the only operation in cad.batch. Offset results are independent ordinary sketch geometry with no persistent source link or distance constraint. Offset source input must be a typed entity ref or ordered oriented chain; pixels, screenshots, opaque tokens, scripts, and filesystem paths are never source substitutes.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["proposal"],
      properties: {
        proposal: {
          ...V19_CURVE_EDIT_PROPOSAL_SCHEMA,
          description:
            "A typed model-space SketchCurveEditProposal. pickPoint and splitPoints are model coordinates. Screenshots, pixel/viewport coordinates, opaque candidate tokens, scripts, filesystem paths, and raw OCCT selectors are not accepted."
        }
      }
    }
  },
  {
    name: "cad.sketch_profile_region_candidates",
    description:
      "Returns a bounded, revision-bound page of derived V19 whole-loop material-region candidates. Candidate records and candidate keys are discovery evidence only: they grant no mutation authority and do not become feature source until an explicit regions profile is submitted. The query accepts typed sketch/entity IDs only; screenshots, pixels, opaque mutation tokens, raw OCCT selectors, scripts, and filesystem paths are never source substitutes.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["sketchId"],
      properties: {
        sketchId: {
          type: "string",
          minLength: 1,
          description: "Source sketch ID to inspect."
        },
        entityIds: {
          type: "array",
          maxItems: 4_096,
          uniqueItems: true,
          items: { type: "string", minLength: 1 },
          description:
            "Optional source entity subset. Screenshots, selection pixels, opaque tokens, raw geometry selectors, scripts, and filesystem paths are not accepted."
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 100,
          description: "Maximum candidate summaries in this page."
        },
        afterCandidateKey: {
          type: "string",
          minLength: 1,
          description:
            "Canonical display/paging key from the preceding page; requires sourceRevision and never authorizes a mutation."
        },
        sourceRevision: {
          type: "string",
          pattern: "^partbench-source-v1:[0-9a-f]{64}$",
          description:
            "Revision identity returned with the preceding page; requires afterCandidateKey."
        }
      }
    }
  },
  {
    name: "cad.sketch_profile_region_validate",
    description:
      "Validates an explicit V19 regions profile made from typed source entity/wire loop references and returns normalized loop ordering, areas, complexity, and diagnostics. Derived candidates and candidate keys are never accepted as mutation authority; screenshots, pixels, opaque tokens, raw OCCT selectors, scripts, and filesystem paths are never source substitutes.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["profile"],
      properties: {
        profile: {
          type: "object",
          additionalProperties: false,
          required: ["kind", "sketchId", "regions"],
          properties: {
            kind: { const: "regions" },
            sketchId: { type: "string", minLength: 1 },
            regions: {
              type: "array",
              minItems: 1,
              maxItems: 256,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["outer", "holes"],
                properties: {
                  outer: V19_LOOP_REF_SCHEMA,
                  holes: {
                    type: "array",
                    maxItems: 511,
                    items: V19_LOOP_REF_SCHEMA
                  }
                },
                description: "One explicit material region."
              }
            }
          }
        }
      }
    }
  },
  {
    name: "cad.sketch_edit_readiness",
    description:
      "Returns V10 F1 sketch edit readiness, sketch health, rebuild impact, body lifecycle, and reference-effect diagnostics for one supported source-backed sketch edit proposal.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["edit"],
      properties: {
        edit: {
          type: "object",
          description:
            "Supported sketch edit proposal, such as entity.dimension.update, sketch.dimension.update/create/delete, or sketch.constraint.create/delete."
        }
      }
    }
  },
  {
    name: "cad.sketch_solver_status",
    description:
      "Returns V11 sketch solver status/readiness, current constraint and dimension descriptors, profile validity, source-contract status, and deferred solver diagnostics for one sketch.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["sketchId"],
      properties: {
        sketchId: {
          type: "string",
          description: "Sketch ID to inspect."
        }
      }
    }
  },
  {
    name: "cad.sketch_dimensions",
    description: "Returns source-of-truth driving dimensions for one sketch.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["sketchId"],
      properties: {
        sketchId: {
          type: "string",
          description: "Sketch ID whose dimensions should be listed."
        }
      }
    }
  },
  {
    name: "cad.sketch_evaluation",
    description:
      "Returns derived evaluator status for source-of-truth dimensions and constraints in one sketch.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["sketchId"],
      properties: {
        sketchId: {
          type: "string",
          description:
            "Sketch ID whose dimension and constraint evaluation should be read."
        }
      }
    }
  },
  {
    name: "cad.sketch_dimension_get",
    description: "Returns one source-of-truth sketch dimension by ID.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["id"],
      properties: {
        id: {
          type: "string",
          description: "Sketch dimension ID to fetch."
        }
      }
    }
  },
  {
    name: "cad.body_generated_references",
    description:
      "Returns read-only generated body, face, edge, vertex, and axis references for a supported source-authored body.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["bodyId"],
      properties: {
        bodyId: {
          type: "string",
          description: "Authored sketch-extrude body ID to inspect."
        }
      }
    }
  },
  {
    name: "cad.resolve_generated_reference",
    description:
      "Resolves one generated body, face, edge, vertex, or axis reference stable ID for a supported source-authored body.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["bodyId", "stableId"],
      properties: {
        bodyId: {
          type: "string",
          description: "Authored sketch-extrude body ID to inspect."
        },
        stableId: {
          type: "string",
          description: "Generated reference stable ID to resolve."
        }
      }
    }
  },
  {
    name: "cad.generated_reference_measurements",
    description:
      "Returns source-derived measurements for one generated body, face, edge, or vertex reference.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["bodyId", "stableId"],
      properties: {
        bodyId: {
          type: "string",
          description: "Authored sketch-extrude body ID to inspect."
        },
        stableId: {
          type: "string",
          description: "Generated reference stable ID to measure."
        }
      }
    }
  },
  {
    name: "cad.named_references",
    description:
      "Lists source-of-truth user/agent names assigned to generated references.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {}
    }
  },
  {
    name: "cad.resolve_named_reference",
    description:
      "Resolves one source-of-truth named generated reference by name.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["name"],
      properties: {
        name: {
          type: "string",
          description: "Named generated reference to resolve."
        }
      }
    }
  },
  {
    name: "cad.reference_health",
    description:
      "Returns source-derived reference health for all references or a body, generated reference, named reference, or topology anchor target.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        target: {
          oneOf: [
            {
              type: "object",
              additionalProperties: false,
              required: ["type"],
              properties: {
                type: { const: "all" }
              }
            },
            {
              type: "object",
              additionalProperties: false,
              required: ["type", "bodyId"],
              properties: {
                type: { const: "body" },
                bodyId: {
                  type: "string",
                  description: "Source-of-truth body ID to inspect."
                }
              }
            },
            {
              type: "object",
              additionalProperties: false,
              required: ["type", "bodyId", "stableId"],
              properties: {
                type: { const: "generatedReference" },
                bodyId: {
                  type: "string",
                  description: "Source-of-truth body ID to inspect."
                },
                stableId: {
                  type: "string",
                  description: "Semantic generated reference stable ID."
                },
                expectedKind: {
                  type: "string",
                  enum: ["body", "face", "edge", "vertex", "axis"],
                  description:
                    "Optional expected generated reference entity kind."
                }
              }
            },
            {
              type: "object",
              additionalProperties: false,
              required: ["type", "name"],
              properties: {
                type: { const: "namedReference" },
                name: {
                  type: "string",
                  description: "Source-of-truth named generated reference."
                }
              }
            },
            {
              type: "object",
              additionalProperties: false,
              required: ["type", "anchorId"],
              properties: {
                type: { const: "topologyAnchor" },
                anchorId: {
                  type: "string",
                  description: "Source-of-truth topology anchor ID."
                }
              }
            },
            {
              type: "object",
              additionalProperties: false,
              required: ["type", "anchorId"],
              properties: {
                type: { const: "topologyAnchor" },
                anchorId: {
                  type: "string",
                  description: "Source-of-truth topology anchor ID."
                }
              }
            }
          ]
        },
        topologyMatchResults: {
          type: "array",
          description:
            "Optional V13 topology.matchSnapshots results used as read-only health evidence.",
          items: {
            type: "object"
          }
        }
      }
    }
  },
  {
    name: "cad.selection_reference_candidates",
    description:
      "Returns command-ready semantic CAD reference candidates for a body, generated reference, named reference, or topology anchor selection.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      oneOf: [
        { required: ["selection"] },
        { required: ["currentTopologyEvidence"] }
      ],
      properties: {
        selection: {
          oneOf: [
            {
              type: "object",
              additionalProperties: false,
              required: ["type", "bodyId"],
              properties: {
                type: { const: "body" },
                bodyId: {
                  type: "string",
                  description: "Source-of-truth body ID to resolve."
                }
              }
            },
            {
              type: "object",
              additionalProperties: false,
              required: ["type", "bodyId", "stableId"],
              properties: {
                type: { const: "generatedReference" },
                bodyId: {
                  type: "string",
                  description: "Source-of-truth body ID to inspect."
                },
                stableId: {
                  type: "string",
                  description: "Semantic generated reference stable ID."
                },
                expectedKind: {
                  type: "string",
                  enum: ["body", "face", "edge", "vertex", "axis"],
                  description:
                    "Optional expected generated reference entity kind."
                }
              }
            },
            {
              type: "object",
              additionalProperties: false,
              required: ["type", "name"],
              properties: {
                type: { const: "namedReference" },
                name: {
                  type: "string",
                  description: "Source-of-truth named generated reference."
                }
              }
            },
            {
              type: "object",
              additionalProperties: false,
              required: ["type", "anchorId"],
              properties: {
                type: { const: "topologyAnchor" },
                anchorId: {
                  type: "string",
                  description: "Source-of-truth V13 topology anchor ID."
                }
              }
            }
          ]
        },
        currentTopologyEvidence: {
          type: "object",
          additionalProperties: false,
          required: [
            "bodyId",
            "bodySourceIdentitySignature",
            "topologySignature",
            "entityKind",
            "localId",
            "entitySignature"
          ],
          properties: {
            bodyId: { type: "string" },
            bodySourceIdentitySignature: { type: "string" },
            topologySignature: { type: "string" },
            entityKind: {
              type: "string",
              enum: ["face", "edge", "vertex"]
            },
            localId: { type: "string" },
            entitySignature: { type: "string" }
          }
        },
        requiredOperation: {
          type: "string",
          enum: [
            "reference.nameGenerated",
            "feature.attachSketchPlane",
            "feature.chamfer",
            "feature.fillet",
            "feature.shell",
            "feature.mirrorPlane",
            "feature.linearPatternDirection",
            "feature.circularPatternAxis",
            "feature.measureReference",
            "feature.selectReference"
          ],
          description:
            "Optional command operation the selected target must support."
        },
        topologyMatchResults: {
          type: "array",
          description:
            "Optional V13 topology.matchSnapshots results used as read-only anchor health evidence.",
          items: {
            type: "object"
          }
        }
      }
    }
  },
  {
    name: "cad.get_selection",
    description:
      "Returns the current primary semantic browser selection and canonical project source identity. In-memory sessions return no selection.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {}
    }
  },
  {
    name: "cad.transaction_history",
    description:
      "Returns read-only transaction history with actor, operation, and semantic diff summaries.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {}
    }
  },
  {
    name: "cad.batch",
    description:
      "Runs a structured CADOps batch in dry-run or commit mode and returns the CADOps response with semantic diff, agent review, and audit summary. For trim, extend, split, explodeRectangle, or non-associative offset, call cad.sketch_curve_edit_readiness first and submit its preparedOperation unchanged. A curve-edit batch must contain exactly that one curve-edit operation and no other operations. Direct curve-edit operations are accepted with current source/solver preconditions; any supplied deleteConstraintIds and deleteDimensionIds must exactly match the returned impact or the batch fails with the complete impact. sketch.addSlot and sketch.addRoundedRectangle accept their exact ordered caller-supplied entityIds and constraintIds through this same batch authority. V19 dimension create/update uses normalized V22 targets with exactly one literal or parameter value source; lineAngle targets are literal-only. Constraint create/update uses the exact Decision 14 target matrix, structural update cannot change kind, and legacy angle supports update/rename/delete but not new create.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["batch"],
      properties: {
        batch: {
          type: "object",
          additionalProperties: false,
          description:
            "A CadBatch with version, mode, and ops fields. Curve-edit points are model-space coordinates; never send pixels, screenshots, viewport positions, or opaque selection tokens.",
          required: ["version", "mode", "ops"],
          properties: {
            version: { const: "cadops.v1" },
            mode: { enum: ["dryRun", "commit"] },
            ops: {
              type: "array",
              description:
                "Structured CADOps. A trim/extend/split/explodeRectangle/offset batch has exactly one item. Prepared curve edits include generated output IDs plus exact deleteConstraintIds/deleteDimensionIds from readiness. Offset source refs are typed entity or ordered-chain records, never screen evidence or opaque tokens. Slot and rounded-rectangle operations may carry exact ordered entityIds and constraintIds. Normalized dimensions use entityScalar, pointPair, pointLineDistance, or lineAngle targets; lineAngle rejects parameterId. Structural constraint updates retain the stored kind, and legacy angle has no create form.",
              items: V19_BATCH_OP_SCHEMA
            },
            actor: {
              type: "object",
              additionalProperties: false,
              description:
                "Optional transaction actor metadata carried by the CadBatch.",
              required: ["type"],
              properties: {
                type: {
                  enum: ["human", "agent", "script", "system"]
                },
                id: { type: "string" },
                name: { type: "string" }
              }
            },
            audit: {
              type: "object",
              additionalProperties: false,
              description:
                "Optional transaction audit metadata carried by the CadBatch.",
              required: ["intent", "operationCount"],
              properties: {
                source: { type: "string" },
                requestId: { type: "string" },
                toolName: { type: "string" },
                intent: { enum: ["dryRun", "commit"] },
                operationCount: {
                  type: "integer",
                  minimum: 0
                }
              }
            }
          }
        },
        actor: {
          type: "object",
          additionalProperties: false,
          description: "Optional actor metadata for the committed transaction.",
          required: ["type"],
          properties: {
            type: {
              type: "string",
              enum: ["human", "agent", "script", "system"]
            },
            id: { type: "string" },
            name: { type: "string" }
          }
        },
        allowCommit: {
          type: "boolean",
          description:
            "Must be true for in-memory commits. Connected V20 sessions accept it for compatibility while the browser approval mode controls commits. Dry-runs do not require it."
        },
        projectHandoff: {
          type: "object",
          additionalProperties: false,
          description:
            "Optional Partbench JSON handoff artifact for opening the resulting project through JSON import.",
          properties: {
            includeProjectJson: {
              type: "boolean",
              description:
                "When true, successful responses include projectHandoff.projectJson."
            }
          }
        }
      }
    }
  }
];

function createToolResult(
  toolName: string,
  structuredContent: CadMcpStructuredContent,
  isError = true
): CadMcpToolCallResult {
  return {
    toolName,
    isError,
    structuredContent,
    content: [
      {
        type: "text",
        text: JSON.stringify(structuredContent, null, 2)
      }
    ]
  };
}

function createInvalidArgumentsResult(
  toolName: string,
  message: string
): CadMcpToolCallResult {
  return createToolResult(toolName, {
    ok: false,
    error: {
      code: "INVALID_ARGUMENTS",
      message
    }
  });
}

function isBatchToolArguments(value: unknown): value is {
  readonly batch: CadBatch;
  readonly actor?: CadActorMetadata;
  readonly allowCommit?: boolean;
  readonly projectHandoff?: CadOpsAgentProjectHandoffRequest;
} {
  return (
    isRecord(value) &&
    Object.keys(value).every((key) =>
      ["batch", "actor", "allowCommit", "projectHandoff"].includes(key)
    ) &&
    value.batch !== undefined &&
    (value.actor === undefined || isCadActorMetadata(value.actor)) &&
    (value.allowCommit === undefined ||
      typeof value.allowCommit === "boolean") &&
    (value.projectHandoff === undefined ||
      isProjectHandoffToolArguments(value.projectHandoff))
  );
}

function isCadActorMetadata(value: unknown): value is CadActorMetadata {
  return (
    isRecord(value) &&
    Object.keys(value).every((key) => ["type", "id", "name"].includes(key)) &&
    (value.type === "human" ||
      value.type === "agent" ||
      value.type === "script" ||
      value.type === "system") &&
    (value.id === undefined ||
      (typeof value.id === "string" && value.id !== "")) &&
    (value.name === undefined ||
      (typeof value.name === "string" && value.name !== ""))
  );
}

function isProjectHandoffToolArguments(
  value: unknown
): value is CadOpsAgentProjectHandoffRequest {
  return (
    isRecord(value) &&
    Object.keys(value).every((key) => key === "includeProjectJson") &&
    (value.includeProjectJson === undefined ||
      typeof value.includeProjectJson === "boolean")
  );
}

function isObjectMeasurementsToolArguments(
  value: unknown
): value is { readonly id: string } {
  return isIdToolArguments(value);
}

function isIdToolArguments(value: unknown): value is { readonly id: string } {
  return isRecord(value) && typeof value.id === "string" && value.id !== "";
}

function isFeatureEditabilityToolArguments(value: unknown): value is {
  readonly featureId: string;
  readonly proposedEdit?: CadFeatureEditProposal;
  readonly topologyMatchResults?: readonly CadTopologyMatchResult[];
} {
  return (
    isRecord(value) &&
    typeof value.featureId === "string" &&
    value.featureId !== "" &&
    (value.proposedEdit === undefined ||
      isCadFeatureEditProposal(value.proposedEdit)) &&
    isOptionalTopologyMatchResults(value.topologyMatchResults)
  );
}

function isSketchEditReadinessToolArguments(value: unknown): value is {
  readonly edit: CadSketchEditProposal;
} {
  return isRecord(value) && isCadSketchEditProposal(value.edit);
}

function isBodyMeasurementsToolArguments(
  value: unknown
): value is { readonly bodyId: string } {
  return (
    isRecord(value) && typeof value.bodyId === "string" && value.bodyId !== ""
  );
}

function isBodyTopologyToolArguments(value: unknown): value is {
  readonly bodyId: string;
  readonly derivedExactMetadata?: CadBodyDerivedExactMetadataSnapshot;
} {
  return (
    isRecord(value) &&
    typeof value.bodyId === "string" &&
    value.bodyId !== "" &&
    (value.derivedExactMetadata === undefined ||
      isCadBodyDerivedExactMetadataSnapshot(value.derivedExactMetadata))
  );
}

function isBodyTopologyIdentityToolArguments(value: unknown): value is {
  readonly bodyId: string;
  readonly checkpointId?: string;
  readonly derivedExactMetadata?: CadBodyDerivedExactMetadataSnapshot;
} {
  return (
    isRecord(value) &&
    typeof value.bodyId === "string" &&
    value.bodyId !== "" &&
    (value.checkpointId === undefined ||
      (typeof value.checkpointId === "string" && value.checkpointId !== "")) &&
    (value.derivedExactMetadata === undefined ||
      isCadBodyDerivedExactMetadataSnapshot(value.derivedExactMetadata))
  );
}

function isTopologyAnchorCreationPlanArguments(value: unknown): value is {
  readonly bodyId: string;
  readonly stableId: string;
  readonly checkpointId?: string;
  readonly anchorId?: string;
  readonly derivedExactMetadata?: CadBodyDerivedExactMetadataSnapshot;
} {
  return (
    isRecord(value) &&
    Object.keys(value).every((key) =>
      [
        "bodyId",
        "stableId",
        "checkpointId",
        "anchorId",
        "derivedExactMetadata"
      ].includes(key)
    ) &&
    typeof value.bodyId === "string" &&
    value.bodyId !== "" &&
    typeof value.stableId === "string" &&
    value.stableId !== "" &&
    (value.checkpointId === undefined ||
      (typeof value.checkpointId === "string" && value.checkpointId !== "")) &&
    (value.anchorId === undefined ||
      (typeof value.anchorId === "string" && value.anchorId !== "")) &&
    (value.derivedExactMetadata === undefined ||
      isCadBodyDerivedExactMetadataSnapshot(value.derivedExactMetadata))
  );
}

function isTopologyAnchorRepairPlanArguments(value: unknown): value is {
  readonly anchorId: string;
  readonly replacementCheckpointId?: string;
  readonly createReplacementCheckpoint?: boolean;
  readonly selectedRepairCandidateId?: string;
  readonly repairId?: string;
  readonly derivedExactMetadata: CadBodyDerivedExactMetadataSnapshot;
} {
  return (
    isRecord(value) &&
    Object.keys(value).every((key) =>
      [
        "anchorId",
        "replacementCheckpointId",
        "createReplacementCheckpoint",
        "selectedRepairCandidateId",
        "repairId",
        "derivedExactMetadata"
      ].includes(key)
    ) &&
    typeof value.anchorId === "string" &&
    value.anchorId !== "" &&
    (value.replacementCheckpointId === undefined ||
      (typeof value.replacementCheckpointId === "string" &&
        value.replacementCheckpointId !== "")) &&
    (value.createReplacementCheckpoint === undefined ||
      typeof value.createReplacementCheckpoint === "boolean") &&
    (typeof value.replacementCheckpointId === "string" ||
      value.createReplacementCheckpoint === true) &&
    (value.selectedRepairCandidateId === undefined ||
      (typeof value.selectedRepairCandidateId === "string" &&
        value.selectedRepairCandidateId !== "")) &&
    (value.repairId === undefined ||
      (typeof value.repairId === "string" && value.repairId !== "")) &&
    isCadBodyDerivedExactMetadataSnapshot(value.derivedExactMetadata)
  );
}

type ProjectExtentsToolArguments = {
  readonly derivedExactMetadata?: readonly CadBodyDerivedExactMetadataSnapshot[];
};

function isProjectExactMetadataToolArguments(
  value: unknown
): value is ProjectExtentsToolArguments | undefined {
  return (
    value === undefined ||
    (isRecord(value) &&
      Object.keys(value).every((key) => key === "derivedExactMetadata") &&
      (value.derivedExactMetadata === undefined ||
        (Array.isArray(value.derivedExactMetadata) &&
          value.derivedExactMetadata.every((snapshot) =>
            isCadBodyDerivedExactMetadataSnapshot(snapshot)
          ))))
  );
}

const isProjectExtentsToolArguments = isProjectExactMetadataToolArguments;

function isProjectExportExactToolArguments(value: unknown): value is {
  readonly format: "step";
  readonly bodyIds?: readonly string[];
  readonly sourceIdentity?: {
    readonly algorithm: "partbench-source-v1";
    readonly sha256: string;
  };
} {
  return (
    isRecord(value) &&
    Object.keys(value).every((key) =>
      ["format", "bodyIds", "sourceIdentity"].includes(key)
    ) &&
    validateProjectExactExportQuery({
      query: "project.exportExact",
      ...value
    }).ok
  );
}

function isV8ProjectSurfaceToolArguments(value: unknown): value is
  | {
      readonly exactExport?: {
        readonly format: "step";
        readonly bodyIds?: readonly string[];
        readonly sourceIdentity?: {
          readonly algorithm: "partbench-source-v1";
          readonly sha256: string;
        };
      };
    }
  | undefined {
  return (
    value === undefined ||
    (isRecord(value) &&
      Object.keys(value).every((key) => key === "exactExport") &&
      (value.exactExport === undefined ||
        isProjectExportExactToolArguments(value.exactExport)))
  );
}

function isSketchGetToolArguments(
  value: unknown
): value is { readonly id: string } {
  return isIdToolArguments(value);
}

function isSketchDimensionsToolArguments(
  value: unknown
): value is { readonly sketchId: string } {
  return (
    isRecord(value) &&
    typeof value.sketchId === "string" &&
    value.sketchId !== ""
  );
}

function isBodyGeneratedReferencesToolArguments(
  value: unknown
): value is { readonly bodyId: string } {
  return (
    isRecord(value) && typeof value.bodyId === "string" && value.bodyId !== ""
  );
}

function isResolveGeneratedReferenceToolArguments(
  value: unknown
): value is { readonly bodyId: string; readonly stableId: string } {
  return (
    isRecord(value) &&
    typeof value.bodyId === "string" &&
    value.bodyId !== "" &&
    typeof value.stableId === "string" &&
    value.stableId !== ""
  );
}

function isResolveNamedReferenceToolArguments(
  value: unknown
): value is { readonly name: string } {
  return isRecord(value) && typeof value.name === "string" && value.name !== "";
}

function isSelectionReferenceCandidatesToolArguments(value: unknown): value is {
  readonly selection?: CadSelectionReferenceInput;
  readonly currentTopologyEvidence?: CadCurrentTopologySelectionEvidence;
  readonly requiredOperation?: CadSelectionReferenceOperation;
  readonly topologyMatchResults?: readonly CadTopologyMatchResult[];
} {
  return (
    isRecord(value) &&
    ((isCadSelectionReferenceInput(value.selection) &&
      value.currentTopologyEvidence === undefined) ||
      (value.selection === undefined &&
        isCadCurrentTopologySelectionEvidence(
          value.currentTopologyEvidence
        ))) &&
    isOptionalTopologyMatchResults(value.topologyMatchResults) &&
    (value.requiredOperation === undefined ||
      isCadSelectionReferenceOperation(value.requiredOperation))
  );
}

function isReferenceHealthToolArguments(value: unknown): value is
  | {
      readonly target?: CadReferenceHealthTarget;
      readonly topologyMatchResults?: readonly CadTopologyMatchResult[];
    }
  | undefined {
  return (
    value === undefined ||
    (isRecord(value) &&
      Object.keys(value).every((key) =>
        ["target", "topologyMatchResults"].includes(key)
      ) &&
      (value.target === undefined ||
        isCadReferenceHealthTarget(value.target)) &&
      isOptionalTopologyMatchResults(value.topologyMatchResults))
  );
}

function isCadFeatureEditProposal(
  value: unknown
): value is CadFeatureEditProposal {
  if (!isRecord(value) || typeof value.kind !== "string") {
    return false;
  }

  if (value.kind === "extrude") {
    return (
      Object.keys(value).every((key) =>
        ["kind", "depth", "side"].includes(key)
      ) &&
      (value.depth === undefined || typeof value.depth === "number") &&
      (value.side === undefined ||
        value.side === "positive" ||
        value.side === "negative" ||
        value.side === "symmetric")
    );
  }

  if (value.kind === "revolve") {
    return (
      Object.keys(value).every((key) =>
        ["kind", "angleDegrees"].includes(key)
      ) &&
      (value.angleDegrees === undefined ||
        typeof value.angleDegrees === "number")
    );
  }

  if (value.kind === "hole") {
    return (
      Object.keys(value).every((key) =>
        ["kind", "depthMode", "depth", "direction"].includes(key)
      ) &&
      (value.depthMode === undefined ||
        value.depthMode === "blind" ||
        value.depthMode === "throughAll") &&
      (value.depth === undefined || typeof value.depth === "number") &&
      (value.direction === undefined ||
        value.direction === "positive" ||
        value.direction === "negative")
    );
  }

  if (value.kind === "chamfer") {
    return (
      Object.keys(value).every((key) => ["kind", "distance"].includes(key)) &&
      (value.distance === undefined || typeof value.distance === "number")
    );
  }

  if (value.kind === "fillet") {
    return (
      Object.keys(value).every((key) => ["kind", "radius"].includes(key)) &&
      (value.radius === undefined || typeof value.radius === "number")
    );
  }

  return false;
}

function isCadSketchEditProposal(
  value: unknown
): value is CadSketchEditProposal {
  if (!isRecord(value) || typeof value.editKind !== "string") {
    return false;
  }

  if (value.editKind === "entity.dimension.update") {
    return (
      typeof value.sketchId === "string" &&
      typeof value.entityId === "string" &&
      isSketchDimensionTarget(value.target) &&
      typeof value.value === "number"
    );
  }

  if (value.editKind === "sketch.dimension.create") {
    return (
      (value.id === undefined || typeof value.id === "string") &&
      typeof value.name === "string" &&
      typeof value.sketchId === "string" &&
      typeof value.entityId === "string" &&
      isSketchDimensionTarget(value.target) &&
      ((typeof value.value === "number" && value.parameterId === undefined) ||
        (value.value === undefined && typeof value.parameterId === "string"))
    );
  }

  if (value.editKind === "sketch.dimension.update") {
    return (
      typeof value.id === "string" &&
      ((typeof value.value === "number" && value.parameterId === undefined) ||
        (value.value === undefined && typeof value.parameterId === "string"))
    );
  }

  if (value.editKind === "sketch.dimension.delete") {
    return typeof value.id === "string";
  }

  if (value.editKind === "sketch.constraint.create") {
    return isSketchConstraintCreateEditProposal(value);
  }

  if (value.editKind === "sketch.constraint.delete") {
    return typeof value.id === "string";
  }

  return false;
}

function isSketchConstraintCreateEditProposal(
  value: Record<string, unknown>
): boolean {
  if (
    typeof value.name !== "string" ||
    typeof value.sketchId !== "string" ||
    typeof value.kind !== "string" ||
    (value.id !== undefined && typeof value.id !== "string")
  ) {
    return false;
  }

  if (value.kind === "horizontal" || value.kind === "vertical") {
    return typeof value.entityId === "string";
  }

  if (value.kind === "fixed") {
    return (
      isSketchPointTarget(value.target) &&
      (value.coordinate === undefined || isVec2(value.coordinate))
    );
  }

  if (value.kind === "coincident") {
    return (
      isSketchPointTarget(value.primaryTarget) &&
      isSketchPointTarget(value.secondaryTarget)
    );
  }

  if (value.kind === "midpoint") {
    return (
      typeof value.lineEntityId === "string" &&
      isSketchPointTarget(value.target)
    );
  }

  if (value.kind === "parallel" || value.kind === "perpendicular") {
    return (
      typeof value.primaryLineEntityId === "string" &&
      typeof value.secondaryLineEntityId === "string"
    );
  }

  return false;
}

function isCadCurrentTopologySelectionEvidence(
  value: unknown
): value is CadCurrentTopologySelectionEvidence {
  const fields = [
    "bodyId",
    "bodySourceIdentitySignature",
    "topologySignature",
    "entityKind",
    "localId",
    "entitySignature"
  ] as const;
  return (
    isRecord(value) &&
    Object.keys(value).length === 6 &&
    fields.every((field) => field in value) &&
    typeof value.bodyId === "string" &&
    value.bodyId !== "" &&
    typeof value.bodySourceIdentitySignature === "string" &&
    value.bodySourceIdentitySignature !== "" &&
    typeof value.topologySignature === "string" &&
    value.topologySignature !== "" &&
    (value.entityKind === "face" ||
      value.entityKind === "edge" ||
      value.entityKind === "vertex") &&
    typeof value.localId === "string" &&
    value.localId !== "" &&
    typeof value.entitySignature === "string" &&
    value.entitySignature !== ""
  );
}

function isCadSelectionReferenceInput(
  value: unknown
): value is CadSelectionReferenceInput {
  if (!isRecord(value) || typeof value.type !== "string") {
    return false;
  }

  switch (value.type) {
    case "body":
      return typeof value.bodyId === "string" && value.bodyId !== "";
    case "generatedReference":
      return (
        typeof value.bodyId === "string" &&
        value.bodyId !== "" &&
        typeof value.stableId === "string" &&
        value.stableId !== "" &&
        (value.expectedKind === undefined ||
          isGeneratedEntityKind(value.expectedKind))
      );
    case "namedReference":
      return typeof value.name === "string" && value.name !== "";
    case "topologyAnchor":
      return typeof value.anchorId === "string" && value.anchorId !== "";
    default:
      return false;
  }
}

function isCadReferenceHealthTarget(
  value: unknown
): value is CadReferenceHealthTarget {
  if (!isRecord(value) || typeof value.type !== "string") {
    return false;
  }

  switch (value.type) {
    case "all":
      return Object.keys(value).length === 1;
    case "body":
      return typeof value.bodyId === "string" && value.bodyId !== "";
    case "generatedReference":
      return (
        typeof value.bodyId === "string" &&
        value.bodyId !== "" &&
        typeof value.stableId === "string" &&
        value.stableId !== "" &&
        (value.expectedKind === undefined ||
          isGeneratedEntityKind(value.expectedKind))
      );
    case "namedReference":
      return typeof value.name === "string" && value.name !== "";
    case "topologyAnchor":
      return typeof value.anchorId === "string" && value.anchorId !== "";
    default:
      return false;
  }
}

function isCadSelectionReferenceOperation(
  value: unknown
): value is CadSelectionReferenceOperation {
  return (
    value === "reference.nameGenerated" ||
    value === "feature.extrudeCutTarget" ||
    value === "feature.extrudeAddTarget" ||
    value === "feature.holeTarget" ||
    value === "feature.attachSketchPlane" ||
    value === "feature.chamfer" ||
    value === "feature.fillet" ||
    value === "feature.shell" ||
    value === "feature.mirrorPlane" ||
    value === "feature.linearPatternDirection" ||
    value === "feature.circularPatternAxis" ||
    value === "feature.measureReference" ||
    value === "feature.selectReference"
  );
}

function isGeneratedEntityKind(
  value: unknown
): value is CadGeneratedEntityKind {
  return (
    value === "body" ||
    value === "face" ||
    value === "edge" ||
    value === "vertex" ||
    value === "axis"
  );
}

function isEmptyObjectOrUndefined(value: unknown): boolean {
  return (
    value === undefined || (isRecord(value) && Object.keys(value).length === 0)
  );
}

function isToolCallParams(
  value: unknown
): value is { readonly name: string; readonly arguments?: unknown } {
  return isRecord(value) && typeof value.name === "string";
}

function isJsonRpcRequest(value: unknown): value is McpJsonRpcRequest {
  return (
    isRecord(value) &&
    value.jsonrpc === "2.0" &&
    typeof value.method === "string" &&
    (value.id === undefined ||
      value.id === null ||
      typeof value.id === "string" ||
      typeof value.id === "number")
  );
}

function createRequestIdFromJsonRpcId(
  id: McpJsonRpcId | undefined
): string | undefined {
  if (typeof id === "number") {
    return `mcp_jsonrpc_${id}`;
  }

  if (typeof id === "string" && id !== "") {
    return `mcp_jsonrpc_${id}`;
  }

  return undefined;
}

function getJsonRpcId(value: unknown): McpJsonRpcId {
  if (!isRecord(value)) {
    return null;
  }

  const { id } = value;

  if (id === null || typeof id === "string" || typeof id === "number") {
    return id;
  }

  return null;
}

function createJsonRpcError(
  id: McpJsonRpcId,
  code: number,
  message: string
): McpJsonRpcError {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message
    }
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Invalid MCP tool arguments.";
}

function isCadBodyDerivedExactMetadataSnapshot(
  value: unknown
): value is CadBodyDerivedExactMetadataSnapshot {
  if (
    !isRecord(value) ||
    typeof value.bodyId !== "string" ||
    typeof value.sourceIdentitySignature !== "string" ||
    !isCadBodyDerivedExactMetadataStatus(value.status)
  ) {
    return false;
  }

  return (
    (value.metadata === undefined ||
      isCadBodyExactMetadataSnapshotWithoutStatus(value.metadata)) &&
    (value.error === undefined || isCadBodyExactMetadataDiagnostic(value.error))
  );
}

function isCadBodyDerivedExactMetadataStatus(
  value: unknown
): value is CadBodyDerivedExactMetadataSnapshot["status"] {
  return (
    value === "ready" ||
    value === "unsupported" ||
    value === "stale" ||
    value === "kernel-failed" ||
    value === "unavailable-binding"
  );
}

function isCadBodyExactMetadataSnapshotWithoutStatus(
  value: unknown
): value is Omit<CadBodyExactMetadataSnapshot, "status"> {
  return (
    isRecord(value) &&
    value.source === "kernel-derived" &&
    value.confidence === "kernel-derived" &&
    (value.bounds === undefined || isCadAxisAlignedBounds(value.bounds)) &&
    (value.volume === undefined ||
      (typeof value.volume === "number" && Number.isFinite(value.volume))) &&
    (value.surfaceArea === undefined ||
      (typeof value.surfaceArea === "number" &&
        Number.isFinite(value.surfaceArea))) &&
    (value.centroid === undefined || isVec3(value.centroid)) &&
    (value.topologyCounts === undefined ||
      isCadBodyExactMetadataTopologyCounts(value.topologyCounts)) &&
    Array.isArray(value.diagnostics) &&
    value.diagnostics.every(isCadBodyExactMetadataDiagnostic)
  );
}

function isCadAxisAlignedBounds(value: unknown): boolean {
  return (
    isRecord(value) &&
    isVec3(value.min) &&
    isVec3(value.max) &&
    isVec3(value.size) &&
    isVec3(value.center)
  );
}

function isCadBodyExactMetadataTopologyCounts(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.solidCount === "number" &&
    Number.isInteger(value.solidCount) &&
    value.solidCount >= 0 &&
    typeof value.faceCount === "number" &&
    Number.isInteger(value.faceCount) &&
    value.faceCount >= 0 &&
    typeof value.edgeCount === "number" &&
    Number.isInteger(value.edgeCount) &&
    value.edgeCount >= 0 &&
    typeof value.vertexCount === "number" &&
    Number.isInteger(value.vertexCount) &&
    value.vertexCount >= 0
  );
}

function isCadBodyExactMetadataDiagnostic(
  value: unknown
): value is { readonly code: string; readonly message: string } {
  return (
    isRecord(value) &&
    typeof value.code === "string" &&
    typeof value.message === "string"
  );
}

function isVec3(value: unknown): value is readonly [number, number, number] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((item) => typeof item === "number" && Number.isFinite(item))
  );
}

function isVec2(value: unknown): value is readonly [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((item) => typeof item === "number" && Number.isFinite(item))
  );
}

function isSketchDimensionTarget(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  if (value.entityKind === "rectangle") {
    return value.role === "width" || value.role === "height";
  }

  if (value.entityKind === "circle") {
    return value.role === "radius";
  }

  if (value.entityKind === "line") {
    return value.role === "length";
  }

  return false;
}

function isSketchPointTarget(value: unknown): value is {
  readonly entityId: string;
  readonly role: "position" | "start" | "end" | "center";
} {
  return (
    isRecord(value) &&
    typeof value.entityId === "string" &&
    (value.role === "position" ||
      value.role === "start" ||
      value.role === "end" ||
      value.role === "center")
  );
}

function isTopologyMatchSnapshotsArguments(value: unknown): value is {
  readonly previous: CadTopologyMatchSnapshotInput;
  readonly candidates: readonly CadTopologyMatchSnapshotInput[];
} {
  return (
    isRecord(value) &&
    isTopologyMatchSnapshotInputShape(value.previous) &&
    Array.isArray(value.candidates) &&
    value.candidates.every(isTopologyMatchSnapshotInputShape)
  );
}

function isTopologyAnchorRepairCandidatesArguments(value: unknown): value is {
  readonly previous: CadTopologyMatchSnapshotInput;
  readonly candidates: readonly CadTopologyMatchSnapshotInput[];
  readonly anchorIds?: readonly string[];
} {
  return (
    isRecord(value) &&
    isTopologyMatchSnapshotInputShape(value.previous) &&
    Array.isArray(value.candidates) &&
    value.candidates.every(isTopologyMatchSnapshotInputShape) &&
    (value.anchorIds === undefined ||
      (Array.isArray(value.anchorIds) &&
        value.anchorIds.every((anchorId) => typeof anchorId === "string")))
  );
}

function isTopologyAnchorCommandReadinessArguments(value: unknown): value is {
  readonly anchorId: string;
  readonly snapshot: CadTopologyMatchSnapshotInput;
  readonly requiredOperation?: CadSelectionReferenceOperation;
} {
  return (
    isRecord(value) &&
    typeof value.anchorId === "string" &&
    value.anchorId !== "" &&
    isTopologyMatchSnapshotInputShape(value.snapshot) &&
    (value.requiredOperation === undefined ||
      isCadSelectionReferenceOperation(value.requiredOperation))
  );
}

function isTopologyCommandTargetReadinessArguments(value: unknown): value is {
  readonly target: CadSelectionReferenceInput;
  readonly desiredOperation?: CadSelectionReferenceOperation;
  readonly snapshot?: CadTopologyMatchSnapshotInput;
  readonly topologyMatchResults?: readonly CadTopologyMatchResult[];
} {
  return (
    isRecord(value) &&
    Object.keys(value).every((key) =>
      [
        "target",
        "desiredOperation",
        "snapshot",
        "topologyMatchResults"
      ].includes(key)
    ) &&
    isCadSelectionReferenceInput(value.target) &&
    (value.desiredOperation === undefined ||
      isCadSelectionReferenceOperation(value.desiredOperation)) &&
    (value.snapshot === undefined ||
      isTopologyMatchSnapshotInputShape(value.snapshot)) &&
    isOptionalTopologyMatchResults(value.topologyMatchResults)
  );
}

function isTopologyMatchContextToolArguments(value: unknown): value is
  | {
      readonly topologyMatchResults?: readonly CadTopologyMatchResult[];
    }
  | undefined {
  return (
    value === undefined ||
    (isRecord(value) &&
      Object.keys(value).every((key) => key === "topologyMatchResults") &&
      isOptionalTopologyMatchResults(value.topologyMatchResults))
  );
}

function isOptionalTopologyMatchResults(value: unknown): boolean {
  return value === undefined || (Array.isArray(value) && value.every(isRecord));
}

function isTopologyMatchSnapshotInputShape(value: unknown): boolean {
  return (
    isRecord(value) &&
    (value.snapshotId === undefined || typeof value.snapshotId === "string") &&
    (value.checkpointId === undefined ||
      typeof value.checkpointId === "string") &&
    typeof value.bodyId === "string" &&
    (value.sourceFeatureId === undefined ||
      typeof value.sourceFeatureId === "string") &&
    isRecord(value.topologySnapshot)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
