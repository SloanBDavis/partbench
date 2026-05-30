import {
  CadOpsAgentAdapter,
  createCadOpsAgentAdapter,
  parseCadOpsAgentQueryRequest,
  parseCadOpsAgentRequest,
  type AgentAdapterVersion,
  type CadOpsAgentQueryResponse,
  type CadOpsAgentResponse
} from "@web-cad/agent-adapter";
import type {
  CadActorMetadata,
  CadBatch,
  CadBodyDerivedExactMetadataSnapshot,
  CadBodyExactMetadataSnapshot
} from "@web-cad/cad-protocol";

export type CadMcpToolName =
  | "cad.parameter_list"
  | "cad.parameter_get"
  | "cad.project_summary"
  | "cad.project_features"
  | "cad.project_structure"
  | "cad.project_health"
  | "cad.project_sketches"
  | "cad.object_measurements"
  | "cad.body_topology"
  | "cad.body_measurements"
  | "cad.project_extents"
  | "cad.sketch_get"
  | "cad.sketch_evaluation"
  | "cad.sketch_dimensions"
  | "cad.sketch_dimension_get"
  | "cad.body_generated_references"
  | "cad.resolve_generated_reference"
  | "cad.generated_reference_measurements"
  | "cad.named_references"
  | "cad.resolve_named_reference"
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
}

const ADAPTER_VERSION: AgentAdapterVersion = "web-cad.agent-adapter.v1";
const DEFAULT_MCP_ACTOR: CadActorMetadata = {
  type: "agent",
  id: "mcp",
  name: "MCP Client"
};

export class CadMcpServer {
  #nextRequestNumber = 1;
  readonly #adapter: CadOpsAgentAdapter;

  constructor(options: CadMcpServerOptions = {}) {
    this.#adapter = options.adapter ?? createCadOpsAgentAdapter();
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

    if (request.name === "cad.project_sketches") {
      return this.#callProjectSketches(request);
    }

    if (request.name === "cad.object_measurements") {
      return this.#callObjectMeasurements(request);
    }

    if (request.name === "cad.body_topology") {
      return this.#callBodyTopology(request);
    }

    if (request.name === "cad.body_measurements") {
      return this.#callBodyMeasurements(request);
    }

    if (request.name === "cad.project_extents") {
      return this.#callProjectExtents(request);
    }

    if (request.name === "cad.sketch_get") {
      return this.#callSketchGet(request);
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
          source: {
            source: "mcp",
            toolName: request.name
          }
        })
      );

      return createToolResult(request.name, response, !response.ok);
    } catch (error) {
      return createInvalidArgumentsResult(request.name, getErrorMessage(error));
    }
  }

  #createRequestId(): string {
    const id = `mcp_req_${this.#nextRequestNumber}`;
    this.#nextRequestNumber += 1;
    return id;
  }
}

export function createCadMcpServer(
  options: CadMcpServerOptions = {}
): CadMcpServer {
  return new CadMcpServer(options);
}

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
    name: "cad.project_summary",
    description: "Returns a structured summary of the current CAD document.",
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
      "Returns read-only generated body, face, edge, and vertex references for an authored sketch-extrude body.",
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
      "Resolves one generated reference stable ID for an authored sketch-extrude body.",
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
      "Runs a structured CADOps batch in dry-run or commit mode and returns the CADOps response.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["batch"],
      properties: {
        batch: {
          type: "object",
          description: "A CadBatch with version, mode, and ops fields."
        },
        actor: {
          type: "object",
          description: "Optional actor metadata for the committed transaction."
        },
        allowCommit: {
          type: "boolean",
          description:
            "Must be true to allow a CadBatch with mode=commit. Dry-runs do not require this flag."
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
} {
  return isRecord(value) && value.batch !== undefined;
}

function isObjectMeasurementsToolArguments(
  value: unknown
): value is { readonly id: string } {
  return isIdToolArguments(value);
}

function isIdToolArguments(value: unknown): value is { readonly id: string } {
  return isRecord(value) && typeof value.id === "string" && value.id !== "";
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
    typeof value.sourceIdentityCacheKey !== "string" ||
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
