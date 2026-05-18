import {
  CadOpsAgentAdapter,
  createCadOpsAgentAdapter,
  parseCadOpsAgentQueryRequest,
  parseCadOpsAgentRequest,
  type AgentAdapterVersion,
  type CadOpsAgentQueryResponse,
  type CadOpsAgentResponse
} from "@web-cad/agent-adapter";
import type { CadActorMetadata, CadBatch } from "@web-cad/cad-protocol";

export type CadMcpToolName =
  | "cad.project_summary"
  | "cad.project_features"
  | "cad.project_structure"
  | "cad.project_sketches"
  | "cad.object_measurements"
  | "cad.project_extents"
  | "cad.sketch_get"
  | "cad.body_generated_references"
  | "cad.resolve_generated_reference"
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
    if (request.name === "cad.project_summary") {
      return this.#callProjectSummary(request);
    }

    if (request.name === "cad.project_features") {
      return this.#callProjectFeatures(request);
    }

    if (request.name === "cad.project_structure") {
      return this.#callProjectStructure(request);
    }

    if (request.name === "cad.project_sketches") {
      return this.#callProjectSketches(request);
    }

    if (request.name === "cad.object_measurements") {
      return this.#callObjectMeasurements(request);
    }

    if (request.name === "cad.project_extents") {
      return this.#callProjectExtents(request);
    }

    if (request.name === "cad.sketch_get") {
      return this.#callSketchGet(request);
    }

    if (request.name === "cad.body_generated_references") {
      return this.#callBodyGeneratedReferences(request);
    }

    if (request.name === "cad.resolve_generated_reference") {
      return this.#callResolveGeneratedReference(request);
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

  #callProjectExtents(request: CadMcpToolCallRequest): CadMcpToolCallResult {
    if (!isEmptyObjectOrUndefined(request.arguments)) {
      return createInvalidArgumentsResult(
        request.name,
        "cad.project_extents does not accept arguments."
      );
    }

    const response = this.#adapter.query(
      parseCadOpsAgentQueryRequest({
        requestId: request.requestId ?? this.#createRequestId(),
        adapterVersion: ADAPTER_VERSION,
        query: {
          version: "cadops.v1",
          query: { query: "project.extents" }
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
      "Returns read-only feature summaries, including primitive-derived and authored sketch-extrude features.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {}
    }
  },
  {
    name: "cad.project_structure",
    description:
      "Returns the default part, primitive-derived features/bodies, authored sketch-extrude features/bodies, and source mappings.",
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
    name: "cad.project_extents",
    description:
      "Returns aggregate derived extents and approximate volume for the current CAD document.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {}
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
  return isRecord(value) && typeof value.id === "string" && value.id !== "";
}

function isSketchGetToolArguments(
  value: unknown
): value is { readonly id: string } {
  return isRecord(value) && typeof value.id === "string" && value.id !== "";
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
