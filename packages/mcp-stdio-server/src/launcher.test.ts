import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import type {
  CadOpsAgentCurrentSelectionRequest,
  CadOpsAgentQueryRequest,
  CadOpsAgentRequest,
  CadOpsAgentV8ProjectSurfaceRequest
} from "@web-cad/agent-adapter";
import {
  LOCAL_AGENT_RELAY_PATH,
  LOCAL_AGENT_TOKEN_HEADER,
  openLocalAgentBrowser,
  startLocalAgentLauncherForTest,
  type LocalAgentLauncher
} from "./launcher";

describe("local agent launcher", () => {
  it("serves only the fixed bundle with isolation headers and WASM MIME", async () => {
    const fixture = await createStaticFixture();
    const launcher = await startLocalAgentLauncherForTest(fixture.root);

    try {
      expect(launcher.origin).toBe(`http://127.0.0.1:${launcher.port}`);
      expect(Buffer.from(launcher.sessionToken, "base64url")).toHaveLength(32);
      expect(launcher.launchUrl).toBe(
        `${launcher.origin}/#agentSession=${launcher.sessionToken}`
      );
      expect(() => openLocalAgentBrowser("https://example.com/")).toThrow(
        "loopback HTTP"
      );

      const index = await get(launcher, "/");
      expect(index).toMatchObject({
        status: 200,
        headers: {
          "cross-origin-opener-policy": "same-origin",
          "cross-origin-embedder-policy": "require-corp",
          "cross-origin-resource-policy": "same-origin"
        },
        text: "<!doctype html><title>Partbench</title>"
      });
      expect(await get(launcher, "/assets/kernel.wasm")).toMatchObject({
        status: 200,
        headers: { "content-type": "application/wasm" }
      });
      expect((await get(launcher, "/leak.txt")).status).toBe(404);
      expect((await get(launcher, "/%2e%2e/outside.txt")).status).not.toBe(
        200
      );
      expect((await get(launcher, "/assets")).status).toBe(404);
    } finally {
      await launcher.close();
      await fixture.remove();
    }
  });

  it("requires exact host, origin, and token and refuses a second tab", async () => {
    const fixture = await createStaticFixture();
    const launcher = await startLocalAgentLauncherForTest(fixture.root);

    try {
      const connectPath = `${LOCAL_AGENT_RELAY_PATH}/connect`;
      for (const [path, body] of [
        [connectPath, { clientId: "owner" }],
        [`${LOCAL_AGENT_RELAY_PATH}/poll`, { clientId: "owner" }],
        [
          `${LOCAL_AGENT_RELAY_PATH}/respond`,
          { clientId: "owner", requestId: "relay_1", response: {} }
        ],
        [`${LOCAL_AGENT_RELAY_PATH}/disconnect`, { clientId: "owner" }]
      ] as const) {
        expect(
          await post(launcher, path, body, {
            token: "x".repeat(launcher.sessionToken.length)
          })
        ).toMatchObject({
          status: 403,
          body: { error: { code: "AGENT_SESSION_TOKEN_INVALID" } }
        });
      }
      expect(
        await post(
          launcher,
          connectPath,
          { clientId: "owner" },
          { origin: "http://localhost" }
        )
      ).toMatchObject({
        status: 403,
        body: { error: { code: "AGENT_SESSION_TOKEN_INVALID" } }
      });
      expect(
        await post(
          launcher,
          connectPath,
          { clientId: "owner" },
          { host: `localhost:${launcher.port}` }
        )
      ).toMatchObject({
        status: 403,
        body: { error: { code: "AGENT_SESSION_TOKEN_INVALID" } }
      });
      expect(await post(launcher, connectPath, { clientId: "owner" })).toEqual(
        { status: 200, body: { ok: true } }
      );
      expect(
        await post(launcher, connectPath, { clientId: "second" })
      ).toMatchObject({
        status: 409,
        body: { error: { code: "AGENT_SESSION_ALREADY_CONNECTED" } }
      });
      expect(
        await post(launcher, `${LOCAL_AGENT_RELAY_PATH}/disconnect`, {
          clientId: "second"
        })
      ).toMatchObject({
        status: 403,
        body: { error: { code: "AGENT_SESSION_ALREADY_CONNECTED" } }
      });
    } finally {
      await launcher.close();
      await fixture.remove();
    }
  });

  it("relays only the four typed operations and settles pending calls on disconnect", async () => {
    const fixture = await createStaticFixture();
    const launcher = await startLocalAgentLauncherForTest(fixture.root);

    try {
      await post(launcher, `${LOCAL_AGENT_RELAY_PATH}/connect`, {
        clientId: "owner"
      });
      const calls = [
        [
          "execute",
          "execute",
          launcher.relay.execute({
            requestId: "execute"
          } as CadOpsAgentRequest)
        ],
        [
          "query",
          "query",
          launcher.relay.query({
            requestId: "query"
          } as CadOpsAgentQueryRequest)
        ],
        [
          "inspectV8ProjectSurface",
          "surface",
          launcher.relay.inspectV8ProjectSurface({
            requestId: "surface"
          } as CadOpsAgentV8ProjectSurfaceRequest)
        ],
        [
          "getCurrentSelection",
          "selection",
          launcher.relay.getCurrentSelection({
            requestId: "selection"
          } as CadOpsAgentCurrentSelectionRequest)
        ]
      ] as const;

      for (const [method, agentRequestId, result] of calls) {
        const polled = await post(
          launcher,
          `${LOCAL_AGENT_RELAY_PATH}/poll`,
          { clientId: "owner" }
        );
        expect(polled).toMatchObject({
          status: 200,
          body: { ok: true, request: { method } }
        });
        const relayRequestId = readRelayRequestId(polled.body);
        await post(launcher, `${LOCAL_AGENT_RELAY_PATH}/respond`, {
          clientId: "owner",
          requestId: relayRequestId,
          response: {
            ok: false,
            requestId: agentRequestId,
            error: {
              code: "AGENT_COMMIT_REJECTED",
              message: "test response"
            }
          }
        });
        await expect(result).resolves.toMatchObject({
          ok: false,
          error: { code: "AGENT_COMMIT_REJECTED" }
        });
      }

      const invalidResponse = launcher.relay.execute({
        requestId: "validate-response"
      } as CadOpsAgentRequest);
      const invalidPolled = await post(
        launcher,
        `${LOCAL_AGENT_RELAY_PATH}/poll`,
        { clientId: "owner" }
      );
      const invalidRelayRequestId = readRelayRequestId(invalidPolled.body);
      expect(
        await post(launcher, `${LOCAL_AGENT_RELAY_PATH}/respond`, {
          clientId: "owner",
          requestId: invalidRelayRequestId,
          response: {
            ok: false,
            requestId: "wrong-request",
            error: {
              code: "AGENT_COMMIT_REJECTED",
              message: "wrong request"
            }
          }
        })
      ).toMatchObject({ status: 400 });
      expect(
        await post(launcher, `${LOCAL_AGENT_RELAY_PATH}/respond`, {
          clientId: "owner",
          requestId: invalidRelayRequestId,
          response: {
            ok: false,
            requestId: "validate-response",
            error: {
              code: "AGENT_COMMIT_REJECTED",
              message: "extra session field"
            },
            extra: true
          }
        })
      ).toMatchObject({ status: 400 });
      await post(launcher, `${LOCAL_AGENT_RELAY_PATH}/respond`, {
        clientId: "owner",
        requestId: invalidRelayRequestId,
        response: {
          ok: false,
          requestId: "validate-response",
          error: {
            code: "AGENT_COMMIT_REJECTED",
            message: "valid session response"
          }
        }
      });
      await expect(invalidResponse).resolves.toMatchObject({
        error: { code: "AGENT_COMMIT_REJECTED" }
      });

      const selectionResponse = launcher.relay.getCurrentSelection({
        requestId: "validate-selection"
      } as CadOpsAgentCurrentSelectionRequest);
      const selectionPolled = await post(
        launcher,
        `${LOCAL_AGENT_RELAY_PATH}/poll`,
        { clientId: "owner" }
      );
      const selectionRelayRequestId = readRelayRequestId(selectionPolled.body);
      expect(
        await post(launcher, `${LOCAL_AGENT_RELAY_PATH}/respond`, {
          clientId: "owner",
          requestId: selectionRelayRequestId,
          response: {
            ok: true,
            requestId: "validate-selection",
            adapterVersion: "web-cad.agent-adapter.v1",
            selection: {
              kind: "generatedReference",
              bodyId: "body_1",
              stableId: "edge:1",
              expectedKind: "axis"
            },
            sourceIdentity: sourceIdentity()
          }
        })
      ).toMatchObject({ status: 400 });
      await post(launcher, `${LOCAL_AGENT_RELAY_PATH}/respond`, {
        clientId: "owner",
        requestId: selectionRelayRequestId,
        response: {
          ok: true,
          requestId: "validate-selection",
          adapterVersion: "web-cad.agent-adapter.v1",
          selection: { kind: "none" },
          sourceIdentity: sourceIdentity()
        }
      });
      await expect(selectionResponse).resolves.toMatchObject({
        selection: { kind: "none" }
      });

      const browserPending = launcher.relay.query({
        requestId: "browser-pending"
      } as CadOpsAgentQueryRequest);
      await post(launcher, `${LOCAL_AGENT_RELAY_PATH}/disconnect`, {
        clientId: "owner"
      });
      await expect(browserPending).resolves.toEqual({
        ok: false,
        requestId: "browser-pending",
        error: {
          code: "AGENT_SESSION_DISCONNECTED",
          message: "The connected browser session disconnected."
        }
      });
    } finally {
      await launcher.close();
      await fixture.remove();
    }

    const secondFixture = await createStaticFixture();
    const secondLauncher = await startLocalAgentLauncherForTest(
      secondFixture.root
    );
    const launcherPending = secondLauncher.relay.query({
      requestId: "launcher-pending"
    } as CadOpsAgentQueryRequest);
    await secondLauncher.close();
    await expect(launcherPending).resolves.toMatchObject({
      requestId: "launcher-pending",
      error: { code: "AGENT_SESSION_DISCONNECTED" }
    });
    await secondFixture.remove();
  });
});

async function createStaticFixture(): Promise<{
  readonly root: string;
  remove(): Promise<void>;
}> {
  const directory = await mkdtemp(join(tmpdir(), "partbench-v20-launcher-"));
  const root = join(directory, "dist");
  const outside = join(directory, "outside.txt");
  await mkdir(join(root, "assets"), { recursive: true });
  await writeFile(
    join(root, "index.html"),
    "<!doctype html><title>Partbench</title>"
  );
  await writeFile(
    join(root, "assets", "kernel.wasm"),
    Buffer.from([0, 97, 115, 109])
  );
  await writeFile(outside, "private");
  await symlink(outside, join(root, "leak.txt"));
  return {
    root,
    remove: () => rm(directory, { recursive: true, force: true })
  };
}

async function get(
  launcher: LocalAgentLauncher,
  path: string
): Promise<{
  readonly status: number;
  readonly headers: Record<string, string | string[] | undefined>;
  readonly text: string;
}> {
  return new Promise((resolveResponse, rejectResponse) => {
    const request = httpRequest(
      { host: "127.0.0.1", port: launcher.port, path, method: "GET" },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        response.on("end", () =>
          resolveResponse({
            status: response.statusCode ?? 0,
            headers: response.headers,
            text: Buffer.concat(chunks).toString("utf8")
          })
        );
      }
    );
    request.on("error", rejectResponse);
    request.end();
  });
}

async function post(
  launcher: LocalAgentLauncher,
  path: string,
  body: unknown,
  overrides: {
    readonly token?: string;
    readonly origin?: string;
    readonly host?: string;
  } = {}
): Promise<{ readonly status: number; readonly body: unknown }> {
  const bytes = Buffer.from(JSON.stringify(body));
  return new Promise((resolveResponse, rejectResponse) => {
    const request = httpRequest(
      {
        host: "127.0.0.1",
        port: launcher.port,
        path,
        method: "POST",
        headers: {
          Host: overrides.host ?? `127.0.0.1:${launcher.port}`,
          Origin: overrides.origin ?? launcher.origin,
          [LOCAL_AGENT_TOKEN_HEADER]: overrides.token ?? launcher.sessionToken,
          "Content-Type": "application/json",
          "Content-Length": bytes.byteLength
        }
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        response.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          resolveResponse({
            status: response.statusCode ?? 0,
            body: text ? (JSON.parse(text) as unknown) : undefined
          });
        });
      }
    );
    request.on("error", rejectResponse);
    request.end(bytes);
  });
}

function readRelayRequestId(body: unknown): string {
  if (
    typeof body !== "object" ||
    body === null ||
    !("request" in body) ||
    typeof body.request !== "object" ||
    body.request === null ||
    !("requestId" in body.request) ||
    typeof body.request.requestId !== "string"
  ) {
    throw new Error("Expected a relay request ID.");
  }
  return body.request.requestId;
}

function sourceIdentity() {
  return {
    algorithm: "partbench-source-v1",
    sha256: "a".repeat(64)
  } as const;
}
