import {
  createCadMcpServer,
  type CadMcpServer,
  type McpJsonRpcError,
  type McpJsonRpcId,
  type McpJsonRpcResponse
} from "@web-cad/mcp-adapter";

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

    return JSON.stringify(this.handleMessage(trimmed));
  }

  handleMessage(message: string): McpJsonRpcResponse {
    let request: unknown;

    try {
      request = JSON.parse(message) as unknown;
    } catch {
      return createParseError();
    }

    try {
      return this.#server.handleJsonRpc(request);
    } catch {
      return createInternalError(readRequestId(request));
    }
  }
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
