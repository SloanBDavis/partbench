import { spawn } from "node:child_process";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getAssetMetrics } from "./occt-smoke/assets.mjs";
import {
  connectToBrowser,
  findBrowserExecutable,
  getAvailablePort,
  runSmokePage,
  startStaticServer
} from "./occt-smoke/browser.mjs";
import {
  assertSmokeResult,
  createFailureRecord,
  createSuccessRecord,
  printFailureSummary,
  printSummary
} from "./occt-smoke/records.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const smokeDistDir = join(repoRoot, "apps/web/dist-geometry-worker-smoke");
const smokeHtmlPath = join(smokeDistDir, "geometry-worker-smoke.html");
const metricsDir = join(repoRoot, ".metrics");
const metricsPath = join(metricsDir, "occt-browser.jsonl");
const smokeTimeoutMs = 60_000;
const scenarioName = "box-cylinder-sphere-cone-torus";

await mkdir(metricsDir, { recursive: true });
const browserExecutable = findBrowserExecutable();

if (!browserExecutable) {
  const error = new Error(
    "No Chromium-compatible browser was found. Set WEB_CAD_SMOKE_BROWSER to a Chrome/Chromium executable path."
  );
  const record = createFailureRecord({
    error,
    scenarioName,
    browserExecutable,
    appUrl: undefined,
    remoteDebuggingPort: undefined
  });

  await appendMetrics(record);
  printFailureSummary(record, metricsPath);
  throw error;
}

await assertSmokeBuildExists();

let assetMetrics;
let appServer;
let appUrl;
let remoteDebuggingPort;
let browserVersion;
let browserProcess;
let client;

const profileDir = join(
  repoRoot,
  ".metrics",
  `chrome-profile-${process.pid}-${Date.now()}`
);

try {
  assetMetrics = await getAssetMetrics(smokeDistDir);
  appServer = await startStaticServer(smokeDistDir);
  appUrl = `http://127.0.0.1:${appServer.port}/geometry-worker-smoke.html`;
  remoteDebuggingPort = await getAvailablePort();
  browserProcess = spawn(browserExecutable, [
    "--headless=new",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--no-default-browser-check",
    "--no-first-run",
    `--remote-debugging-port=${remoteDebuggingPort}`,
    `--user-data-dir=${profileDir}`,
    "about:blank"
  ]);

  const connection = await connectToBrowser(remoteDebuggingPort);
  client = connection.client;
  browserVersion = connection.version;

  const smokeResult = await runSmokePage(client, appUrl, smokeTimeoutMs);
  const gitSha = await getGitSha();
  const record = createSuccessRecord({
    assetMetrics: {
      ...assetMetrics,
      ...appServer.getMetrics()
    },
    appUrl,
    browserExecutable,
    browserVersion,
    gitSha,
    remoteDebuggingPort,
    scenarioName,
    smokeResult
  });

  assertSmokeResult(record);
  await appendMetrics(record);
  printSummary(record, metricsPath);
} catch (error) {
  const record = createFailureRecord({
    error,
    assetMetrics: assetMetrics
      ? {
          ...assetMetrics,
          ...appServer?.getMetrics()
        }
      : undefined,
    appUrl,
    browserExecutable,
    browserVersion,
    remoteDebuggingPort,
    scenarioName
  });

  await appendMetrics(record).catch(() => {});
  printFailureSummary(record, metricsPath);
  throw error;
} finally {
  await client?.close().catch(() => {});
  browserProcess?.kill();
  appServer?.close();
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

async function appendMetrics(record) {
  await mkdir(metricsDir, { recursive: true });
  await writeFile(metricsPath, `${JSON.stringify(record)}\n`, { flag: "a" });
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
