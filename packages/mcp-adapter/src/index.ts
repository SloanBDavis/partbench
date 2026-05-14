import {
  CadOpsAgentAdapter,
  createCadOpsAgentAdapter,
  parseCadOpsAgentQueryRequest,
  parseCadOpsAgentRequest,
  type AgentAdapterVersion,
  type CadOpsAgentQueryResponse,
  type CadOpsAgentResponse
} from "@web-cad/agent-adapter";
import type { CadBatch } from "@web-cad/cad-protocol";

export type CadMcpToolName = "cad.project_summary" | "cad.batch";
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
          batch: request.arguments.batch
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

function isBatchToolArguments(
  value: unknown
): value is { readonly batch: CadBatch } {
  return isRecord(value) && value.batch !== undefined;
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
