import { spawn } from "node:child_process";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse
} from "node:http";
import { extname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseCadAgentSessionErrorResponse,
  parseCadOpsAgentCurrentSelectionResponse
} from "@web-cad/agent-adapter";
import type {
  CadAgentSessionErrorResponse,
  CadOpsAgentCurrentSelectionRequest,
  CadOpsAgentCurrentSelectionResponse,
  CadOpsAgentQueryRequest,
  CadOpsAgentQueryResponse,
  CadOpsAgentRequest,
  CadOpsAgentResponse,
  CadOpsAgentV8ProjectSurfaceRequest,
  CadOpsAgentV8ProjectSurfaceResponse
} from "@web-cad/agent-adapter";

export const LOCAL_AGENT_TOKEN_HEADER = "x-partbench-agent-token";
export const LOCAL_AGENT_RELAY_PATH = "/__partbench/agent";

type RelayMethod =
  | "execute"
  | "query"
  | "inspectV8ProjectSurface"
  | "getCurrentSelection";

type RelayRequest =
  | RelayEnvelope<"execute", CadOpsAgentRequest>
  | RelayEnvelope<"query", CadOpsAgentQueryRequest>
  | RelayEnvelope<
      "inspectV8ProjectSurface",
      CadOpsAgentV8ProjectSurfaceRequest
    >
  | RelayEnvelope<
      "getCurrentSelection",
      CadOpsAgentCurrentSelectionRequest
    >;

interface RelayEnvelope<Method extends RelayMethod, Request> {
  readonly requestId: string;
  readonly method: Method;
  readonly request: Request;
}

type RelayResponse =
  | CadOpsAgentResponse
  | CadOpsAgentQueryResponse
  | CadOpsAgentV8ProjectSurfaceResponse
  | CadOpsAgentCurrentSelectionResponse
  | CadAgentSessionErrorResponse;

interface PendingRelayCall {
  readonly request: RelayRequest;
  readonly resolve: (response: RelayResponse) => void;
  sent: boolean;
}

export class LocalAgentRelay {
  #nextRequestNumber = 1;
  #browserClientId: string | undefined;
  #closed = false;
  readonly #pending = new Map<string, PendingRelayCall>();
  readonly #queued: RelayRequest[] = [];
  #pollResolver: ((request: RelayRequest | null) => void) | undefined;

  execute(
    request: CadOpsAgentRequest
  ): Promise<CadOpsAgentResponse | CadAgentSessionErrorResponse> {
    return this.#enqueue("execute", request);
  }

  query(
    request: CadOpsAgentQueryRequest
  ): Promise<CadOpsAgentQueryResponse | CadAgentSessionErrorResponse> {
    return this.#enqueue("query", request);
  }

  inspectV8ProjectSurface(
    request: CadOpsAgentV8ProjectSurfaceRequest
  ): Promise<CadOpsAgentV8ProjectSurfaceResponse | CadAgentSessionErrorResponse> {
    return this.#enqueue("inspectV8ProjectSurface", request);
  }

  getCurrentSelection(
    request: CadOpsAgentCurrentSelectionRequest
  ): Promise<CadOpsAgentCurrentSelectionResponse | CadAgentSessionErrorResponse> {
    return this.#enqueue("getCurrentSelection", request);
  }

  connectBrowser(clientId: string): CadAgentSessionErrorResponse | undefined {
    if (this.#closed) {
      return sessionError(
        "session",
        "AGENT_SESSION_DISCONNECTED",
        "The local agent session has disconnected."
      );
    }
    if (this.#browserClientId && this.#browserClientId !== clientId) {
      return sessionError(
        "session",
        "AGENT_SESSION_ALREADY_CONNECTED",
        "Another browser tab already owns this local agent session."
      );
    }
    this.#browserClientId = clientId;
    return undefined;
  }

  validateBrowserClient(
    clientId: string
  ): CadAgentSessionErrorResponse | undefined {
    return this.#requireBrowser(clientId);
  }

  async pollBrowser(clientId: string): Promise<RelayRequest | null> {
    const error = this.#requireBrowser(clientId);
    if (error) return null;

    const request = this.#queued.shift();
    if (request) {
      const pending = this.#pending.get(request.requestId);
      if (pending) pending.sent = true;
      return request;
    }

    this.#pollResolver?.(null);
    return new Promise((resolvePoll) => {
      this.#pollResolver = resolvePoll;
    });
  }

  respondFromBrowser(
    clientId: string,
    requestId: string,
    response: unknown
  ): boolean {
    if (this.#requireBrowser(clientId)) return false;
    const pending = this.#pending.get(requestId);
    if (!pending?.sent || !isValidRelayResponse(pending, response)) {
      return false;
    }
    this.#pending.delete(requestId);
    pending.resolve(response as RelayResponse);
    return true;
  }

  disconnectBrowser(clientId: string): void {
    if (clientId !== this.#browserClientId) return;
    this.#close("The connected browser session disconnected.");
  }

  close(): void {
    this.#close("The local agent launcher disconnected.");
  }

  #enqueue<
    Request extends
      | CadOpsAgentRequest
      | CadOpsAgentQueryRequest
      | CadOpsAgentV8ProjectSurfaceRequest
      | CadOpsAgentCurrentSelectionRequest,
    Response extends RelayResponse
  >(method: RelayMethod, request: Request): Promise<Response> {
    if (this.#closed) {
      return Promise.resolve(
        sessionError(
          request.requestId,
          "AGENT_SESSION_DISCONNECTED",
          "The local agent session has disconnected."
        ) as Response
      );
    }

    const relayRequest = {
      requestId: `relay_${this.#nextRequestNumber++}`,
      method,
      request
    } as RelayRequest;
    const response = new Promise<Response>((resolveResponse) => {
      this.#pending.set(relayRequest.requestId, {
        request: relayRequest,
        resolve: (value) => resolveResponse(value as Response),
        sent: false
      });
    });
    const pollResolver = this.#pollResolver;
    if (pollResolver) {
      this.#pollResolver = undefined;
      this.#pending.get(relayRequest.requestId)!.sent = true;
      pollResolver(relayRequest);
    } else {
      this.#queued.push(relayRequest);
    }
    return response;
  }

  #requireBrowser(clientId: string): CadAgentSessionErrorResponse | undefined {
    if (this.#closed) {
      return sessionError(
        "session",
        "AGENT_SESSION_DISCONNECTED",
        "The local agent session has disconnected."
      );
    }
    if (!this.#browserClientId) {
      return sessionError(
        "session",
        "AGENT_SESSION_NOT_CONNECTED",
        "No browser tab is connected to this local agent session."
      );
    }
    if (clientId !== this.#browserClientId) {
      return sessionError(
        "session",
        "AGENT_SESSION_ALREADY_CONNECTED",
        "Another browser tab already owns this local agent session."
      );
    }
    return undefined;
  }

  #close(message: string): void {
    if (this.#closed) return;
    this.#closed = true;
    this.#pollResolver?.(null);
    this.#pollResolver = undefined;
    for (const pending of this.#pending.values()) {
      pending.resolve(
        sessionError(
          pending.request.request.requestId,
          "AGENT_SESSION_DISCONNECTED",
          message
        )
      );
    }
    this.#pending.clear();
    this.#queued.length = 0;
  }
}

export interface LocalAgentLauncher {
  readonly origin: string;
  readonly launchUrl: string;
  readonly port: number;
  readonly sessionToken: string;
  readonly relay: LocalAgentRelay;
  close(): Promise<void>;
}

const DEFAULT_WEB_DIST_ROOT = fileURLToPath(
  new URL("../../../apps/web/dist", import.meta.url)
);

export function startLocalAgentLauncher(): Promise<LocalAgentLauncher> {
  return startLauncher(DEFAULT_WEB_DIST_ROOT);
}

/** @internal Focused security tests only; production has no configurable root. */
export function startLocalAgentLauncherForTest(
  staticRoot: string
): Promise<LocalAgentLauncher> {
  return startLauncher(staticRoot);
}

export function openLocalAgentBrowser(url: string): void {
  const parsedUrl = new URL(url);
  if (
    parsedUrl.protocol !== "http:" ||
    parsedUrl.hostname !== "127.0.0.1" ||
    parsedUrl.port === ""
  ) {
    throw new Error("The local agent browser URL must use loopback HTTP.");
  }
  const [command, args]: [string, string[]] =
    process.platform === "darwin"
      ? ["open", [url]]
      : process.platform === "win32"
        ? ["rundll32.exe", ["url.dll,FileProtocolHandler", url]]
        : ["xdg-open", [url]];
  const child = spawn(command, args, { detached: true, stdio: "ignore" });
  child.once("error", () => undefined);
  child.unref();
}

async function startLauncher(staticRoot: string): Promise<LocalAgentLauncher> {
  const root = await realpath(staticRoot);
  if (
    !(await stat(root)).isDirectory() ||
    !(await stat(resolve(root, "index.html"))).isFile()
  ) {
    throw new Error("The Partbench production web bundle was not found.");
  }

  const relay = new LocalAgentRelay();
  const sessionToken = randomBytes(32).toString("base64url");
  let expectedHost = "";
  const server = createServer((request, response) => {
    void handleHttpRequest({
      request,
      response,
      root,
      relay,
      sessionToken,
      expectedHost
    });
  });

  await new Promise<void>((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", rejectListen);
      resolveListen();
    });
  });
  server.on("error", () => relay.close());
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error(
      "The local agent launcher did not receive a loopback port."
    );
  }
  expectedHost = `127.0.0.1:${address.port}`;
  const origin = `http://${expectedHost}`;
  let closed = false;

  return {
    origin,
    launchUrl: `${origin}/#agentSession=${sessionToken}`,
    port: address.port,
    sessionToken,
    relay,
    async close() {
      if (closed) return;
      closed = true;
      relay.close();
      await new Promise<void>((resolveClose, rejectClose) => {
        server.close((error) =>
          error ? rejectClose(error) : resolveClose()
        );
        server.closeAllConnections();
      });
    }
  };
}

async function handleHttpRequest({
  request,
  response,
  root,
  relay,
  sessionToken,
  expectedHost
}: {
  readonly request: IncomingMessage;
  readonly response: ServerResponse;
  readonly root: string;
  readonly relay: LocalAgentRelay;
  readonly sessionToken: string;
  readonly expectedHost: string;
}): Promise<void> {
  try {
    if (request.headers.host !== expectedHost) {
      writeSessionHttpError(response, 403, "AGENT_SESSION_TOKEN_INVALID");
      return;
    }
    const url = new URL(request.url ?? "/", `http://${expectedHost}`);
    if (request.method === "POST") {
      await handleRelayPost(
        request,
        response,
        url.pathname,
        relay,
        sessionToken,
        `http://${expectedHost}`
      );
      return;
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { Allow: "GET, HEAD, POST" }).end();
      return;
    }
    await serveStaticFile(request, response, root, url.pathname);
  } catch {
    if (!response.headersSent) response.writeHead(500);
    response.end();
  }
}

async function handleRelayPost(
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
  relay: LocalAgentRelay,
  sessionToken: string,
  expectedOrigin: string
): Promise<void> {
  if (
    !pathname.startsWith(`${LOCAL_AGENT_RELAY_PATH}/`) ||
    request.headers.origin !== expectedOrigin ||
    !tokensMatch(request.headers[LOCAL_AGENT_TOKEN_HEADER], sessionToken)
  ) {
    writeSessionHttpError(response, 403, "AGENT_SESSION_TOKEN_INVALID");
    return;
  }

  if (
    request.headers["content-type"]?.split(";", 1)[0] !== "application/json"
  ) {
    writeSessionHttpError(response, 400, "AGENT_SESSION_TOKEN_INVALID");
    return;
  }
  let body: unknown;
  try {
    body = await readJsonBody(request);
  } catch {
    writeSessionHttpError(response, 400, "AGENT_SESSION_TOKEN_INVALID");
    return;
  }
  if (!isRecord(body) || !isClientId(body.clientId)) {
    writeSessionHttpError(response, 400, "AGENT_SESSION_TOKEN_INVALID");
    return;
  }

  if (pathname === `${LOCAL_AGENT_RELAY_PATH}/connect`) {
    if (!hasExactKeys(body, ["clientId"])) {
      writeSessionHttpError(response, 400, "AGENT_SESSION_TOKEN_INVALID");
      return;
    }
    const error = relay.connectBrowser(body.clientId);
    if (error) {
      writeJson(response, 409, error);
    } else {
      writeJson(response, 200, { ok: true });
    }
    return;
  }

  if (pathname === `${LOCAL_AGENT_RELAY_PATH}/poll`) {
    if (!hasExactKeys(body, ["clientId"])) {
      writeSessionHttpError(response, 400, "AGENT_SESSION_TOKEN_INVALID");
      return;
    }
    const clientId = body.clientId;
    const error = relay.validateBrowserClient(clientId);
    if (error) {
      writeJson(
        response,
        error.error.code === "AGENT_SESSION_NOT_CONNECTED" ? 409 : 403,
        error
      );
      return;
    }
    let completed = false;
    response.on("close", () => {
      if (!completed) relay.disconnectBrowser(clientId);
    });
    const nextRequest = await relay.pollBrowser(clientId);
    completed = true;
    writeJson(response, 200, { ok: true, request: nextRequest });
    return;
  }

  if (pathname === `${LOCAL_AGENT_RELAY_PATH}/respond`) {
    if (
      !hasExactKeys(body, ["clientId", "requestId", "response"]) ||
      typeof body.requestId !== "string" ||
      body.requestId === ""
    ) {
      writeSessionHttpError(response, 400, "AGENT_SESSION_TOKEN_INVALID");
      return;
    }
    const error = relay.validateBrowserClient(body.clientId);
    if (error) {
      writeJson(response, 403, error);
      return;
    }
    if (
      !relay.respondFromBrowser(body.clientId, body.requestId, body.response)
    ) {
      writeSessionHttpError(response, 400, "AGENT_SESSION_TOKEN_INVALID");
      return;
    }
    writeJson(response, 200, { ok: true });
    return;
  }

  if (pathname === `${LOCAL_AGENT_RELAY_PATH}/disconnect`) {
    if (!hasExactKeys(body, ["clientId"])) {
      writeSessionHttpError(response, 400, "AGENT_SESSION_TOKEN_INVALID");
      return;
    }
    const error = relay.validateBrowserClient(body.clientId);
    if (error) {
      writeJson(response, 403, error);
      return;
    }
    relay.disconnectBrowser(body.clientId);
    writeJson(response, 200, { ok: true });
    return;
  }

  response.writeHead(404).end();
}

async function serveStaticFile(
  request: IncomingMessage,
  response: ServerResponse,
  root: string,
  pathname: string
): Promise<void> {
  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    response.writeHead(400).end();
    return;
  }
  const parts = decodedPath.split(/[\\/]+/);
  if (decodedPath.includes("\0") || parts.includes("..")) {
    response.writeHead(403).end("Forbidden");
    return;
  }
  const filePath = resolve(
    root,
    decodedPath === "/" ? "index.html" : decodedPath.replace(/^[/\\]+/, "")
  );
  if (!isWithinRoot(root, filePath)) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  try {
    const realFilePath = await realpath(filePath);
    const info = await stat(realFilePath);
    if (!info.isFile() || !isWithinRoot(root, realFilePath)) throw new Error();
    const bytes = await readFile(realFilePath);
    response.writeHead(200, {
      "Content-Type": contentType(realFilePath),
      "Content-Length": bytes.byteLength,
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Resource-Policy": "same-origin",
      "X-Content-Type-Options": "nosniff"
    });
    response.end(request.method === "HEAD" ? undefined : bytes);
  } catch {
    response.writeHead(404).end("Not found");
  }
}

function isWithinRoot(root: string, path: string): boolean {
  const child = relative(root, path);
  return child === "" || (!child.startsWith(`..${sep}`) && child !== "..");
}

function contentType(path: string): string {
  return (
    {
      ".css": "text/css; charset=utf-8",
      ".html": "text/html; charset=utf-8",
      ".ico": "image/x-icon",
      ".js": "text/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".png": "image/png",
      ".svg": "image/svg+xml",
      ".wasm": "application/wasm",
      ".woff2": "font/woff2"
    }[extname(path)] ?? "application/octet-stream"
  );
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  // ponytail: 8 MiB bounds local JSON; stream/chunk only if real responses exceed it.
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.byteLength;
    if (size > 8 * 1024 * 1024) throw new Error("Relay request too large.");
    chunks.push(bytes);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

function writeJson(response: ServerResponse, status: number, value: unknown) {
  const bytes = Buffer.from(JSON.stringify(value));
  response
    .writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Length": bytes.byteLength,
      "Cache-Control": "no-store"
    })
    .end(bytes);
}

function writeSessionHttpError(
  response: ServerResponse,
  status: number,
  code: CadAgentSessionErrorResponse["error"]["code"]
): void {
  writeJson(
    response,
    status,
    sessionError("session", code, "Local agent session request rejected.")
  );
}

function sessionError(
  requestId: string,
  code: CadAgentSessionErrorResponse["error"]["code"],
  message: string
): CadAgentSessionErrorResponse {
  return { ok: false, requestId, error: { code, message } };
}

function isValidRelayResponse(
  pending: PendingRelayCall,
  value: unknown
): value is RelayResponse {
  if (
    !isRecord(value) ||
    value.requestId !== pending.request.request.requestId ||
    typeof value.ok !== "boolean"
  ) {
    return false;
  }

  if (
    value.ok === false &&
    isRecord(value.error) &&
    typeof value.error.code === "string" &&
    value.error.code.startsWith("AGENT_")
  ) {
    return parses(() => parseCadAgentSessionErrorResponse(value));
  }

  if (pending.request.method === "getCurrentSelection") {
    return parses(() => parseCadOpsAgentCurrentSelectionResponse(value));
  }

  return (
    value.adapterVersion === "web-cad.agent-adapter.v1" &&
    (value.ok === true ||
      (isRecord(value.error) &&
        typeof value.error.code === "string" &&
        typeof value.error.message === "string"))
  );
}

function parses(parse: () => unknown): boolean {
  try {
    parse();
    return true;
  } catch {
    return false;
  }
}

function tokensMatch(
  received: string | readonly string[] | undefined,
  expected: string
): boolean {
  if (typeof received !== "string" || received.length !== expected.length) {
    return false;
  }
  const receivedBytes = Buffer.from(received);
  const expectedBytes = Buffer.from(expected);
  return (
    receivedBytes.byteLength === expectedBytes.byteLength &&
    timingSafeEqual(receivedBytes, expectedBytes)
  );
}

function hasExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[]
): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => key in value);
}

function isClientId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
