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
  startStaticServer,
  stopBrowserProcess
} from "./occt-smoke/browser.mjs";
import {
  assertSmokeResult,
  createFailureRecord,
  createSuccessRecord,
  printFailureSummary,
  printSummary
} from "./occt-smoke/records.mjs";
import { acquireBrowserSmokeLease } from "./v18-geometry-reliability.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const smokeDistDir = join(repoRoot, "apps/web/dist-geometry-worker-smoke");
const smokeHtmlPath = join(smokeDistDir, "geometry-worker-smoke.html");
const metricsDir = join(repoRoot, ".metrics");
const requireV21 = process.env.PARTBENCH_REQUIRE_V21 === "1";
const requireV21_1 = process.env.PARTBENCH_REQUIRE_V21_1 === "1";
const requireV22 = process.env.PARTBENCH_REQUIRE_V22 === "1";
const metricsPath = join(
  metricsDir,
  requireV22
    ? "v22-occt-browser.jsonl"
    : requireV21_1
      ? "v21-1-occt-browser.jsonl"
      : requireV21
        ? "v21-occt-browser.jsonl"
        : "occt-browser.jsonl"
);
const smokeTimeoutMs = Number(
  process.env.PARTBENCH_SMOKE_TIMEOUT_MS ??
    (requireV21_1 || requireV21 || requireV22 ? 600_000 : 60_000)
);
const scenarioName = requireV22
  ? "v22-exact-selection"
  : requireV21_1
    ? "v21-1-exact-256-interchange"
    : requireV21
      ? "v21-exact-interchange"
      : "primitive-and-boolean-meshes";

await mkdir(metricsDir, { recursive: true });
const browserExecutable = findBrowserExecutable();

if (!browserExecutable) {
  const error = new Error(
    "No Chromium-compatible browser was found. Set PARTBENCH_SMOKE_BROWSER to a Chrome/Chromium executable path."
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
let browserLease;

const profileDir = join(
  repoRoot,
  ".metrics",
  `chrome-profile-${process.pid}-${Date.now()}`
);

try {
  browserLease = await acquireBrowserSmokeLease({
    lockPath: join(metricsDir, "browser-smoke.lock")
  });
  assetMetrics = await getAssetMetrics(smokeDistDir);
  appServer = await startStaticServer(smokeDistDir);
  appUrl = `http://127.0.0.1:${appServer.port}/geometry-worker-smoke.html${requireV22 ? "?v22=1" : requireV21_1 ? "?v21_1=1" : requireV21 ? "?v21=1" : ""}`;
  remoteDebuggingPort = await getAvailablePort();
  browserProcess = spawn(browserExecutable, [
    "--headless=new",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--no-default-browser-check",
    "--no-first-run",
    ...(process.env.PARTBENCH_SMOKE_BROWSER_NO_SANDBOX === "1"
      ? ["--no-sandbox"]
      : []),
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
  if (requireV22 && !record.metrics.v22ExactSelection?.ok) {
    throw new Error(
      `V22 exact selection matrix result was missing or failed: ${JSON.stringify(record.metrics.v22ExactSelection ?? null)}`
    );
  }
  if (requireV21 && !record.metrics.v21ExactInterchange?.ok) {
    throw new Error("V21 exact interchange result was missing or failed.");
  }
  if (requireV21_1) {
    const limit = record.metrics.v21ExactInterchange?.nearLimit;
    if (
      !record.metrics.v21ExactInterchange?.ok ||
      limit?.bodyCount !== 256 ||
      limit?.retry?.exactInvariantBodyCount !== 256 ||
      !limit?.cancellation
    ) {
      throw new Error("V21.1 exact 256-body cancel/retry result failed.");
    }
  }
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
  await stopBrowserProcess(browserProcess);
  await appServer?.close();
  await rm(profileDir, { force: true, recursive: true }).catch(() => {});
  await browserLease?.release().catch(() => {});
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
