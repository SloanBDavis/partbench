import { createReadStream, statSync } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { extname, join, resolve } from "node:path";
import {
  parseSmokePageError,
  parseSmokePageResult,
  SmokePageError
} from "./errors.mjs";

export async function startStaticServer(rootDir) {
  const server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
      const filePath = resolve(
        rootDir,
        pathname === "/" ? "geometry-worker-smoke.html" : pathname.slice(1)
      );

      if (!filePath.startsWith(rootDir)) {
        response.writeHead(403);
        response.end("Forbidden");
        return;
      }

      await stat(filePath);
      response.writeHead(200, {
        "Content-Type": getContentType(filePath)
      });
      createReadStream(filePath)
        .on("error", () => {
          response.destroy();
        })
        .pipe(response);
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
  });

  const port = await getAvailablePort();

  await new Promise((resolvePromise, rejectPromise) => {
    server.once("error", rejectPromise);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", rejectPromise);
      resolvePromise();
    });
  });

  return {
    port,
    close() {
      server.close();
    }
  };
}

export async function getAvailablePort() {
  const server = createNetServer();

  await new Promise((resolvePromise, rejectPromise) => {
    server.once("error", rejectPromise);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", rejectPromise);
      resolvePromise();
    });
  });

  const address = server.address();
  await new Promise((resolvePromise) => {
    server.close(resolvePromise);
  });

  if (!address || typeof address === "string") {
    throw new Error("Failed to allocate a local TCP port.");
  }

  return address.port;
}

export async function connectToBrowser(port) {
  const deadline = Date.now() + 10_000;
  let version;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      version = await response.json();
      break;
    } catch {
      await delay(100);
    }
  }

  if (!version?.webSocketDebuggerUrl) {
    throw new Error("Timed out waiting for browser remote debugging.");
  }

  return {
    client: await createCdpClient(version.webSocketDebuggerUrl),
    version
  };
}

export async function runSmokePage(client, url, timeoutMs) {
  const target = await client.send("Target.createTarget", {
    url: "about:blank"
  });
  const attached = await client.send("Target.attachToTarget", {
    targetId: target.targetId,
    flatten: true
  });
  const { sessionId } = attached;

  await client.send("Runtime.enable", {}, sessionId);
  await client.send("Page.enable", {}, sessionId);
  await client.send("Page.navigate", { url }, sessionId);

  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const state = await evaluateSmokeState(client, sessionId);

    if (state.status === "ok") {
      return parseSmokePageResult(state.text);
    }

    if (state.status === "error") {
      throw new SmokePageError(parseSmokePageError(state.text));
    }

    await delay(250);
  }

  throw new Error("Timed out waiting for geometry worker smoke result.");
}

export function findBrowserExecutable() {
  if (process.env.WEB_CAD_SMOKE_BROWSER) {
    return process.env.WEB_CAD_SMOKE_BROWSER;
  }

  const candidates = getBrowserCandidates();

  for (const candidate of candidates) {
    if (candidate.includes("/") || candidate.includes("\\")) {
      try {
        statSync(candidate);
        return candidate;
      } catch {
        continue;
      }
    }

    const found = findOnPath(candidate);

    if (found) {
      return found;
    }
  }

  return undefined;
}

function getContentType(filePath) {
  switch (extname(filePath)) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".wasm":
      return "application/wasm";
    case ".css":
      return "text/css; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

function createCdpClient(webSocketUrl) {
  const websocket = new WebSocket(webSocketUrl);
  let nextId = 1;
  const pending = new Map();
  const eventListeners = new Map();

  websocket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);

    if (message.id) {
      const request = pending.get(message.id);
      pending.delete(message.id);

      if (!request) {
        return;
      }

      if (message.error) {
        request.reject(new Error(message.error.message));
        return;
      }

      request.resolve(message.result);
      return;
    }

    const listeners = eventListeners.get(message.method);

    if (listeners) {
      for (const listener of listeners) {
        listener(message.params);
      }
    }
  });

  websocket.addEventListener("error", () => {
    for (const request of pending.values()) {
      request.reject(new Error("Browser websocket failed."));
    }

    pending.clear();
  });

  return new Promise((resolvePromise, rejectPromise) => {
    websocket.addEventListener(
      "open",
      () => {
        resolvePromise({
          send(method, params = {}, sessionId) {
            const id = nextId;
            nextId += 1;
            const message = {
              id,
              method,
              params,
              ...(sessionId ? { sessionId } : {})
            };

            return new Promise((resolveRequest, rejectRequest) => {
              pending.set(id, {
                resolve: resolveRequest,
                reject: rejectRequest
              });
              websocket.send(JSON.stringify(message));
            });
          },
          on(method, listener) {
            const listeners = eventListeners.get(method) ?? new Set();
            listeners.add(listener);
            eventListeners.set(method, listeners);
          },
          close() {
            if (websocket.readyState === WebSocket.OPEN) {
              return new Promise((resolveClose) => {
                websocket.addEventListener("close", resolveClose, {
                  once: true
                });
                websocket.close();
              });
            }

            return Promise.resolve();
          }
        });
      },
      { once: true }
    );
    websocket.addEventListener(
      "error",
      () => rejectPromise(new Error("Failed to connect to browser websocket.")),
      { once: true }
    );
  });
}

async function evaluateSmokeState(client, sessionId) {
  const result = await client.send(
    "Runtime.evaluate",
    {
      awaitPromise: true,
      returnByValue: true,
      expression: `(() => ({
        status: document.body.dataset.geometryWorkerSmoke ?? "pending",
        text: document.getElementById("geometry-worker-smoke")?.textContent ?? ""
      }))()`
    },
    sessionId
  );

  return result.result.value;
}

function getBrowserCandidates() {
  if (process.platform === "darwin") {
    return [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
    ];
  }

  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA;
    const programFiles = process.env.PROGRAMFILES;
    const programFilesX86 = process.env["PROGRAMFILES(X86)"];

    return [
      localAppData
        ? join(localAppData, "Google/Chrome/Application/chrome.exe")
        : undefined,
      programFiles
        ? join(programFiles, "Google/Chrome/Application/chrome.exe")
        : undefined,
      programFilesX86
        ? join(programFilesX86, "Google/Chrome/Application/chrome.exe")
        : undefined,
      "chrome.exe",
      "msedge.exe"
    ].filter(Boolean);
  }

  return [
    "google-chrome",
    "google-chrome-stable",
    "chromium",
    "chromium-browser",
    "microsoft-edge",
    "microsoft-edge-stable"
  ];
}

function findOnPath(command) {
  const pathEntries = (process.env.PATH ?? "").split(
    process.platform === "win32" ? ";" : ":"
  );

  for (const pathEntry of pathEntries) {
    const candidate = join(pathEntry, command);

    try {
      statSync(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  return undefined;
}

function delay(milliseconds) {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, milliseconds);
  });
}
