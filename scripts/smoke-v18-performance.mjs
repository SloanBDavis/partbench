import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import {
  readdir,
  mkdir,
  readFile,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import {
  connectToBrowser,
  findBrowserExecutable,
  getAvailablePort,
  stopBrowserProcess
} from "./occt-smoke/browser.mjs";
import { acquireBrowserSmokeLease } from "./v18-geometry-reliability.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = join(repoRoot, "apps/web/dist");
const metricsDir = join(repoRoot, ".metrics");
const artifactPath = join(metricsDir, "v18-performance.json");
const browserExecutable = findBrowserExecutable();

if (!browserExecutable) {
  throw new Error(
    "No Chromium-compatible browser was found. Set PARTBENCH_SMOKE_BROWSER."
  );
}
await stat(join(distDir, "index.html")).catch(() => {
  throw new Error(
    "The production web build is missing. Run pnpm check:v18-bundle first."
  );
});

let browserLease;
let server;
let appUrl;
try {
  browserLease = await acquireBrowserSmokeLease({
    lockPath: join(metricsDir, "browser-smoke.lock")
  });
  server = await startCompressedStaticServer(distDir);
  appUrl = `http://127.0.0.1:${server.port}/index.html`;
  const coldRuns = [];
  for (let index = 0; index < 5; index += 1) {
    coldRuns.push(await measureColdRun(index));
  }
  const interaction = await measureInteractions();
  const shellReadyMedianMs = median(coldRuns.map((run) => run.shellReadyMs));
  const result = {
    ok: true,
    buildHash: await hashBuild(distDir),
    profile: {
      viewport: "1536x1024",
      dpr: 1,
      cpuThrottle: 4,
      downloadBitsPerSecond: 4_000_000,
      latencyMs: 20,
      coldRuns: 5
    },
    shellReadyMedianMs,
    coldRuns,
    interaction
  };
  const failures = [];
  if (shellReadyMedianMs > 2_000)
    failures.push(
      `shell-ready median ${shellReadyMedianMs.toFixed(1)}ms > 2000ms`
    );
  if (coldRuns.some((run) => run.deferredAssetRequests.length > 0))
    failures.push("an empty shell requested a worker or OCCT WASM asset");
  if (interaction.commandSearchP95Ms > 50)
    failures.push(
      `command-search p95 ${interaction.commandSearchP95Ms.toFixed(1)}ms > 50ms`
    );
  if (interaction.warmActionP95Ms > 100)
    failures.push(
      `warm-action p95 ${interaction.warmActionP95Ms.toFixed(1)}ms > 100ms`
    );
  if (interaction.frameIntervalP95Ms > 34)
    failures.push(
      `frame interval p95 ${interaction.frameIntervalP95Ms.toFixed(1)}ms > 34ms`
    );
  if (interaction.maxLongTaskMs > 50)
    failures.push(`long task ${interaction.maxLongTaskMs.toFixed(1)}ms > 50ms`);
  result.ok = failures.length === 0;
  result.failures = failures;
  await mkdir(metricsDir, { recursive: true });
  await writeFile(artifactPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
} finally {
  await server?.close();
  await browserLease?.release();
}

async function measureColdRun(index) {
  return withBrowser(`cold-${index}`, async (client, sessionId) => {
    await client.send("Network.enable", {}, sessionId);
    await client.send(
      "Network.emulateNetworkConditions",
      {
        offline: false,
        latency: 20,
        downloadThroughput: 4_000_000 / 8,
        uploadThroughput: 4_000_000 / 8,
        connectionType: "wifi"
      },
      sessionId
    );
    await client.send("Emulation.setCPUThrottlingRate", { rate: 4 }, sessionId);
    await client.send(
      "Network.setCacheDisabled",
      { cacheDisabled: true },
      sessionId
    );
    await client.send("Page.navigate", { url: appUrl }, sessionId);
    return evaluate(
      client,
      sessionId,
      `
      (async () => {
        const deadline = performance.now() + 10000;
        while (!performance.getEntriesByName("partbench:shell-ready").length) {
          if (performance.now() > deadline) throw new Error("shell-ready mark missing");
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
        const shellReadyMs = performance.getEntriesByName("partbench:shell-ready").at(-1).startTime;
        const resources = performance.getEntriesByType("resource").map((entry) => entry.name);
        return {
          shellReadyMs,
          deferredAssetRequests: resources.filter((name) =>
            /cadCommand\\.worker|geometryTessellation\\.worker|opencascade\\.full.*\\.wasm/.test(name)
          )
        };
      })()
    `
    );
  });
}

async function measureInteractions() {
  return withBrowser(
    "interactions",
    async (client, sessionId) => {
      await client.send("Page.navigate", { url: appUrl }, sessionId);
      return evaluate(
        client,
        sessionId,
        `
      (async () => {
        const wait = (predicate, label) => new Promise((resolve, reject) => {
          const deadline = performance.now() + 8000;
          const poll = () => {
            if (predicate()) return resolve();
            if (performance.now() > deadline) return reject(new Error(label));
            requestAnimationFrame(poll);
          };
          poll();
        });
        await wait(() => performance.getEntriesByName("partbench:shell-ready").length, "shell");
        const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
        const commandSearch = [];
        const queries = ["b", "bo", "box", "s", "sw", "sweep", "r", "rev", "revolve", "measure"];
        document.querySelector('[aria-label="Search commands"]')?.click();
        await wait(() => document.querySelector('[role="combobox"]'), "command search warm-up");
        document.querySelector('[aria-label="Close command search"]')?.click();
        await nextFrame();
        for (const query of [...queries, ...queries, ...queries, ...queries]) {
          document.querySelector('[aria-label="Search commands"]')?.click();
          await wait(() => document.querySelector('[role="combobox"]'), "command search");
          const input = document.querySelector('[role="combobox"]');
          const started = performance.now();
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
          setter.call(input, query);
          input.dispatchEvent(new Event("input", { bubbles: true }));
          await nextFrame();
          commandSearch.push(performance.now() - started);
          document.querySelector('[aria-label="Close command search"]')?.click();
          await nextFrame();
        }
        const warmActions = [];
        for (const mode of ["Sketch", "Inspect", "Project", "Solid", "Sketch", "Solid"]) {
          const button = [...document.querySelectorAll('[aria-label="Workbench mode"] button')]
            .find((candidate) => candidate.textContent.trim() === mode);
          const started = performance.now();
          button.click();
          await nextFrame();
          warmActions.push(performance.now() - started);
        }
        const canvas = document.querySelector('[aria-label="3D scene viewport"]');
        const frameIntervals = [];
        const longTasks = [];
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) longTasks.push(entry.duration);
        });
        try { observer.observe({ type: "longtask", buffered: false }); } catch {}
        let previous = performance.now();
        const frameDeadline = previous + 2000;
        while (performance.now() < frameDeadline) {
          canvas.dispatchEvent(new PointerEvent("pointermove", {
            bubbles: true,
            clientX: 200 + Math.random() * 300,
            clientY: 150 + Math.random() * 250
          }));
          await nextFrame();
          const now = performance.now();
          frameIntervals.push(now - previous);
          previous = now;
        }
        observer.disconnect();
        const percentile = (values, ratio) => {
          const sorted = [...values].sort((a, b) => a - b);
          return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)] || 0;
        };
        return {
          commandSearchP95Ms: percentile(commandSearch, 0.95),
          warmActionP95Ms: percentile(warmActions, 0.95),
          frameIntervalP95Ms: percentile(frameIntervals, 0.95),
          maxLongTaskMs: Math.max(0, ...longTasks),
          samples: { commandSearch, warmActions, frameIntervals: frameIntervals.length }
        };
      })()
    `
      );
    },
    2
  );
}

async function withBrowser(label, callback, dpr = 1) {
  const profileDir = join(
    metricsDir,
    `chrome-profile-v18-${label}-${process.pid}`
  );
  await mkdir(profileDir, { recursive: true });
  const port = await getAvailablePort();
  const browser = spawn(
    browserExecutable,
    [
      "--headless=new",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--no-default-browser-check",
      "--no-first-run",
      ...(process.env.PARTBENCH_SMOKE_BROWSER_NO_SANDBOX === "1"
        ? ["--no-sandbox"]
        : []),
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profileDir}`,
      "about:blank"
    ],
    { stdio: "ignore" }
  );
  let client;
  try {
    ({ client } = await connectToBrowser(port));
    const target = await client.send("Target.createTarget", {
      url: "about:blank"
    });
    const attached = await client.send("Target.attachToTarget", {
      targetId: target.targetId,
      flatten: true
    });
    const sessionId = attached.sessionId;
    await client.send("Runtime.enable", {}, sessionId);
    await client.send("Page.enable", {}, sessionId);
    await client.send(
      "Emulation.setDeviceMetricsOverride",
      { width: 1536, height: 1024, deviceScaleFactor: dpr, mobile: false },
      sessionId
    );
    return await callback(client, sessionId);
  } finally {
    await client?.close().catch(() => {});
    await stopBrowserProcess(browser);
    await rm(profileDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function startCompressedStaticServer(rootDirectory) {
  const compressedFiles = new Map();
  for (const name of await readdir(rootDirectory, { recursive: true })) {
    const path = join(rootDirectory, name);
    const info = await stat(path);
    if (!info.isFile() || !/\.(?:css|html|js|json|svg)$/.test(name)) continue;
    compressedFiles.set(path, gzipSync(await readFile(path)));
  }

  const server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
      const filePath = resolve(
        rootDirectory,
        pathname === "/" ? "index.html" : pathname.slice(1)
      );
      if (!filePath.startsWith(rootDirectory)) {
        response.writeHead(403).end("Forbidden");
        return;
      }
      const bytes = compressedFiles.get(filePath) ?? (await readFile(filePath));
      const contentType =
        {
          ".css": "text/css; charset=utf-8",
          ".html": "text/html; charset=utf-8",
          ".js": "text/javascript; charset=utf-8",
          ".json": "application/json; charset=utf-8",
          ".svg": "image/svg+xml",
          ".wasm": "application/wasm"
        }[extname(filePath)] ?? "application/octet-stream";
      response.writeHead(200, {
        "Content-Type": contentType,
        ...(compressedFiles.has(filePath)
          ? { "Content-Encoding": "gzip", Vary: "Accept-Encoding" }
          : {}),
        "Content-Length": bytes.byteLength
      });
      response.end(bytes);
    } catch {
      response.writeHead(404).end("Not found");
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
      return new Promise((resolveClose, rejectClose) => {
        server.close((error) =>
          error ? rejectClose(error) : resolveClose(undefined)
        );
      });
    }
  };
}

async function evaluate(client, sessionId, expression) {
  const response = await client.send(
    "Runtime.evaluate",
    { expression, awaitPromise: true, returnByValue: true },
    sessionId
  );
  if (response.exceptionDetails) {
    throw new Error(
      response.exceptionDetails.exception?.description ??
        response.exceptionDetails.text ??
        "Browser evaluation failed."
    );
  }
  return response.result.value;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

async function hashBuild(directory) {
  const hash = createHash("sha256");
  for (const name of (await readdir(directory, { recursive: true })).sort()) {
    const path = join(directory, name);
    const info = await stat(path);
    if (!info.isFile()) continue;
    hash.update(name);
    hash.update(await readFile(path));
  }
  return hash.digest("hex");
}
