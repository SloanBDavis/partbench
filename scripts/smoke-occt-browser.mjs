import { spawn } from "node:child_process";
import { createReadStream, statSync } from "node:fs";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const smokeDistDir = join(repoRoot, "apps/web/dist-geometry-worker-smoke");
const smokeHtmlPath = join(smokeDistDir, "geometry-worker-smoke.html");
const metricsDir = join(repoRoot, ".metrics");
const metricsPath = join(metricsDir, "occt-browser.jsonl");
const smokeTimeoutMs = 60_000;

const browserExecutable = findBrowserExecutable();

if (!browserExecutable) {
  throw new Error(
    "No Chromium-compatible browser was found. Set WEB_CAD_SMOKE_BROWSER to a Chrome/Chromium executable path."
  );
}

await assertSmokeBuildExists();
await mkdir(metricsDir, { recursive: true });

const appServer = await startStaticServer(smokeDistDir);
const appUrl = `http://127.0.0.1:${appServer.port}/geometry-worker-smoke.html`;
const remoteDebuggingPort = await getAvailablePort();
const profileDir = join(
  repoRoot,
  ".metrics",
  `chrome-profile-${process.pid}-${Date.now()}`
);
const browserProcess = spawn(browserExecutable, [
  "--headless=new",
  "--disable-gpu",
  "--disable-dev-shm-usage",
  "--no-default-browser-check",
  "--no-first-run",
  `--remote-debugging-port=${remoteDebuggingPort}`,
  `--user-data-dir=${profileDir}`,
  "about:blank"
]);

let client;

try {
  client = await connectToBrowser(remoteDebuggingPort);
  const smokeResult = await runSmokePage(client, appUrl);
  const assetMetrics = await getAssetMetrics(smokeDistDir);
  const gitSha = await getGitSha();
  const record = {
    schemaVersion: 1,
    timestamp: new Date().toISOString(),
    gitSha,
    nodeVersion: process.version,
    browser: {
      executable: browserExecutable,
      remoteDebuggingPort
    },
    url: appUrl,
    scenario: "box-2x3x4",
    status: "ok",
    metrics: {
      ...smokeResult.timings,
      vertexCount: smokeResult.vertexCount,
      triangleCount: smokeResult.triangleCount,
      occtWasmBytes: assetMetrics.occtWasmBytes,
      occtWasmGzipBytes: assetMetrics.occtWasmGzipBytes,
      geometryWorkerBytes: assetMetrics.geometryWorkerBytes,
      smokeBundleBytes: assetMetrics.smokeBundleBytes
    }
  };

  assertSmokeResult(record);
  await appendMetrics(record);
  printSummary(record);
} finally {
  await client?.close().catch(() => {});
  browserProcess.kill();
  appServer.close();
  await rm(profileDir, { force: true, recursive: true }).catch(() => {});
}

async function assertSmokeBuildExists() {
  try {
    await stat(smokeHtmlPath);
  } catch {
    throw new Error(
      "Geometry worker smoke build was not found. Run `pnpm build:geometry-worker` before this smoke script."
    );
  }
}

async function startStaticServer(rootDir) {
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

async function getAvailablePort() {
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

async function connectToBrowser(port) {
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

  return createCdpClient(version.webSocketDebuggerUrl);
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

async function runSmokePage(client, url) {
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

  const deadline = Date.now() + smokeTimeoutMs;

  while (Date.now() < deadline) {
    const state = await evaluateSmokeState(client, sessionId);

    if (state.status === "ok") {
      return JSON.parse(state.text);
    }

    if (state.status === "error") {
      throw new Error(state.text || "Geometry worker smoke page failed.");
    }

    await delay(250);
  }

  throw new Error("Timed out waiting for geometry worker smoke result.");
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

async function getAssetMetrics(rootDir) {
  const assetsDir = join(rootDir, "assets");
  const assets = await readDirectoryFilenames(assetsDir);
  const wasmFile = assets.find((asset) =>
    asset.startsWith("opencascade.full-")
  );
  const workerFile = assets.find((asset) =>
    asset.startsWith("geometryTessellation.worker-")
  );
  const smokeBundleFile = assets.find(
    (asset) =>
      asset.startsWith("geometry-worker-smoke-") && asset.endsWith(".js")
  );

  if (!wasmFile || !workerFile || !smokeBundleFile) {
    throw new Error("Smoke build assets are missing expected OCCT files.");
  }

  const wasmPath = join(assetsDir, wasmFile);
  const wasmBuffer = await readFile(wasmPath);

  return {
    occtWasmBytes: wasmBuffer.byteLength,
    occtWasmGzipBytes: gzipSync(wasmBuffer).byteLength,
    geometryWorkerBytes: (await stat(join(assetsDir, workerFile))).size,
    smokeBundleBytes: (await stat(join(assetsDir, smokeBundleFile))).size
  };
}

async function readDirectoryFilenames(directory) {
  const { readdir } = await import("node:fs/promises");
  return readdir(directory);
}

function assertSmokeResult(record) {
  const { metrics } = record;
  const timingKeys = [
    "occtLoadMs",
    "tessellationMs",
    "geometryKernelMs",
    "workerExecutionMs",
    "roundTripMs"
  ];

  if (metrics.vertexCount !== 24 || metrics.triangleCount !== 12) {
    throw new Error(
      `Unexpected mesh size: ${metrics.vertexCount} vertices, ${metrics.triangleCount} triangles.`
    );
  }

  for (const key of timingKeys) {
    if (!Number.isFinite(metrics[key])) {
      throw new Error(`Missing or invalid timing metric: ${key}.`);
    }
  }
}

async function appendMetrics(record) {
  await mkdir(metricsDir, { recursive: true });
  await writeFile(metricsPath, `${JSON.stringify(record)}\n`, { flag: "a" });
}

function printSummary(record) {
  const { metrics } = record;

  console.log("OCCT browser smoke passed");
  console.log(`metrics: ${metricsPath}`);
  console.log(`scenario: ${record.scenario}`);
  console.log(`OCCT load: ${formatMs(metrics.occtLoadMs)}`);
  console.log(`tessellation: ${formatMs(metrics.tessellationMs)}`);
  console.log(`worker total: ${formatMs(metrics.workerExecutionMs)}`);
  console.log(`round trip: ${formatMs(metrics.roundTripMs)}`);
  console.log(
    `mesh: ${metrics.vertexCount} vertices, ${metrics.triangleCount} triangles`
  );
  console.log(
    `OCCT WASM: ${formatBytes(metrics.occtWasmBytes)} raw, ${formatBytes(
      metrics.occtWasmGzipBytes
    )} gzip`
  );
}

async function getGitSha() {
  return new Promise((resolvePromise) => {
    const git = spawn("git", ["rev-parse", "HEAD"], { cwd: repoRoot });
    let output = "";

    git.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    git.on("close", (code) => {
      resolvePromise(code === 0 ? output.trim() : undefined);
    });
    git.on("error", () => {
      resolvePromise(undefined);
    });
  });
}

function findBrowserExecutable() {
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

function formatMs(value) {
  return `${value.toFixed(value < 10 ? 2 : 1)} ms`;
}

function formatBytes(value) {
  return `${(value / 1_000_000).toFixed(2)} MB`;
}

function delay(milliseconds) {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, milliseconds);
  });
}
