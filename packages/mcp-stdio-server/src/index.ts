import {
  createCadMcpServer,
  type CadMcpServer,
  type McpJsonRpcError,
  type McpJsonRpcId,
  type McpJsonRpcResponse
} from "@web-cad/mcp-adapter";

export {
  LOCAL_AGENT_RELAY_PATH,
  LOCAL_AGENT_TOKEN_HEADER,
  LocalAgentRelay,
  openLocalAgentBrowser,
  startLocalAgentLauncher,
  type LocalAgentLauncher
} from "./launcher.ts";

export interface McpStdioSessionOptions {
  readonly server?: CadMcpServer;
}

export class McpStdioSession {
  readonly #server: CadMcpServer;

  constructor(options: McpStdioSessionOptions = {}) {
    this.#server = options.server ?? createCadMcpServer();
  }

  handleLine(line: string): string | undefined {
    const trimmed = line.trim();

    if (trimmed.length === 0) {
      return undefined;
    }
    if (isNotification(trimmed)) return undefined;

    return JSON.stringify(this.handleMessage(trimmed));
  }

  async handleLineAsync(line: string): Promise<string | undefined> {
    const trimmed = line.trim();

    if (trimmed.length === 0) {
      return undefined;
    }
    if (isNotification(trimmed)) return undefined;

    return JSON.stringify(await this.handleMessageAsync(trimmed));
  }

  handleMessage(message: string): McpJsonRpcResponse {
    let request: unknown;

    try {
      request = JSON.parse(message) as unknown;
    } catch {
      return createParseError();
    }

    try {
      const lifecycle = handleLifecycle(request);
      if (lifecycle) return lifecycle;
      return this.#server.handleJsonRpc(request);
    } catch {
      return createInternalError(readRequestId(request));
    }
  }

  async handleMessageAsync(message: string): Promise<McpJsonRpcResponse> {
    let request: unknown;

    try {
      request = JSON.parse(message) as unknown;
    } catch {
      return createParseError();
    }

    try {
      const lifecycle = handleLifecycle(request);
      if (lifecycle) return lifecycle;
      return await this.#server.handleJsonRpcAsync(request);
    } catch {
      return createInternalError(readRequestId(request));
    }
  }
}

function isNotification(line: string): boolean {
  try {
    const request: unknown = JSON.parse(line);
    return (
      isRecord(request) &&
      request.jsonrpc === "2.0" &&
      typeof request.method === "string" &&
      !("id" in request)
    );
  } catch {
    return false;
  }
}

function handleLifecycle(request: unknown): McpJsonRpcResponse | undefined {
  if (!isRecord(request) || request.jsonrpc !== "2.0") return undefined;
  const id = readRequestId(request);
  if (request.method === "ping") return { jsonrpc: "2.0", id, result: {} };
  if (request.method !== "initialize") return undefined;
  const params = request.params;
  if (
    !isRecord(params) ||
    typeof params.protocolVersion !== "string" ||
    !isRecord(params.capabilities) ||
    !isRecord(params.clientInfo) ||
    typeof params.clientInfo.name !== "string" ||
    typeof params.clientInfo.version !== "string"
  ) {
    return {
      jsonrpc: "2.0",
      id,
      error: {
        code: -32602,
        message:
          "initialize requires protocolVersion, capabilities, and clientInfo { name, version }."
      }
    };
  }
  return {
    jsonrpc: "2.0",
    id,
    result: {
      protocolVersion: "2025-06-18",
      capabilities: { tools: {} },
      serverInfo: { name: "partbench", version: "0.0.0" },
      instructions:
        "CADOps is the modeling authority. Discover tools first; call cad.session_info when available. The cad.batch schema describes common modeling and revision operations. Inspect using project/body queries and save/export using the host's advertised tools. Use caller-supplied IDs to refer to newly created entities within one batch. Rejected batches do not change the document."
    }
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function createMcpStdioSession(
  options: McpStdioSessionOptions = {}
): McpStdioSession {
  return new McpStdioSession(options);
}

function createParseError(): McpJsonRpcError {
  return {
    jsonrpc: "2.0",
    id: null,
    error: {
      code: -32700,
      message: "Parse error."
    }
  };
}

function createInternalError(id: McpJsonRpcId): McpJsonRpcError {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code: -32603,
      message: "Internal error."
    }
  };
}

function readRequestId(request: unknown): McpJsonRpcId {
  if (typeof request !== "object" || request === null || !("id" in request)) {
    return null;
  }

  const { id } = request;
  return typeof id === "string" || typeof id === "number" || id === null
    ? id
    : null;
}
