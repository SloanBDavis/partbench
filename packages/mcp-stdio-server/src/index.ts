import {
  createCadMcpServer,
  type CadMcpServer,
  type McpJsonRpcError,
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
    try {
      return this.#server.handleJsonRpc(JSON.parse(message) as unknown);
    } catch {
      return createParseError();
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
