import { exerciseDrawingDimensions } from "./drawing-dimensions-journey.mjs";
// bun+vite in-process; chrome via Bun.WebView
import { assertNativeCheckpointParity } from "./native-checkpoint-parity.mjs";
import {
  existsSync,
  globSync,
  mkdirSync,
  readFileSync,
  writeFileSync
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { clearTimeout } from "node:timers";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  findBrowserExecutable,
  getAvailablePort
} from "./occt-smoke/browser.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const bunInstallHint = "curl -fsSL https://bun.sh/install | bash";
const chromeHint =
  "Set PARTBENCH_SMOKE_BROWSER to a Chrome/Chromium executable path.";
const screenshotDir = join(repoRoot, ".metrics", "ui-smoke");
const readyTimeoutMs = Number(
  process.env.PARTBENCH_SMOKE_UI_TIMEOUT_MS ?? 180_000
);

const BunRuntime = globalThis.Bun;

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
function assertBunWebView() {
  if (typeof BunRuntime?.WebView !== "function") {
    throw new Error("smoke:ui missing bun webview. " + bunInstallHint + "");
  }
}

function requireChrome() {
  const chromePath = findBrowserExecutable();
  if (!chromePath) {
    throw new Error("smoke:ui missing chrome. " + chromeHint + "");
  }
  return chromePath;
}

function assertChromium(userAgent) {
  const ua = String(userAgent ?? "");
  if (!/Chrome|Chromium/i.test(ua)) {
    throw new Error("smoke:ui chrome backend required, userAgent=" + ua);
  }
}
function createChromeWebView(chromePath) {
  const argv = [
    "--disable-dev-shm-usage",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--enable-webgl"
  ];
  if (process.env.PARTBENCH_SMOKE_BROWSER_NO_SANDBOX === "1") {
    argv.push("--no-sandbox");
  }
  return new BunRuntime.WebView({
    width: 1400,
    height: 900,
    backend: {
      type: "chrome",
      path: chromePath,
      url: false,
      argv,
      stderr: "inherit"
    }
  });
}
function parseCli(argv) {
  const raw = argv.filter((arg) => arg !== "--");
  const useOnly =
    raw.includes("--use") || process.env.PARTBENCH_SMOKE_UI_USE === "1";
  const requireUse =
    raw.includes("--require-use") ||
    process.env.PARTBENCH_SMOKE_UI_REQUIRE_USE === "1";
  const filters = raw.filter(
    (arg) => arg !== "--use" && arg !== "--require-use"
  );
  return {
    useOnly,
    requireUse: requireUse || (useOnly && filters.length > 0),
    filtered: filters.length > 0,
    filters
  };
}

function delay(milliseconds) {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, milliseconds);
  });
}
function hasUse(scenario) {
  return Array.isArray(scenario.use) && scenario.use.length > 0;
}

function hasUseBreak(scenario) {
  return Array.isArray(scenario.useBreak) && scenario.useBreak.length > 0;
}

function selectScenarios(loaded, options) {
  const { useOnly, requireUse } = options;
  if (useOnly && !requireUse) {
    const withUse = loaded.filter((item) => hasUse(item.scenario));
    if (withUse.length === 0) {
      throw new Error(
        "smoke:ui-use found no scenarios with a use block. Write clicks from the workbench before close."
      );
    }
    return withUse;
  }
  if (requireUse) {
    for (const item of loaded) {
      if (!hasUse(item.scenario)) {
        throw new Error(
          item.name +
            " missing use block. Write clicks from the workbench before close. applyOps is not Use."
        );
      }
    }
  }
  return loaded;
}

function loadScenarios(filters) {
  if (filters.length === 0 && process.env.PARTBENCH_SMOKE_UI_PREFIX) {
    filters = [
      "scenarios/" + process.env.PARTBENCH_SMOKE_UI_PREFIX + "-*.json"
    ];
  }
  const requested =
    filters.length === 0
      ? globSync("scenarios/*.json", { cwd: repoRoot }).sort()
      : expandFilters(filters);
  return requested.map((relativePath) => {
    const filePath = resolve(repoRoot, relativePath);
    const scenario = JSON.parse(readFileSync(filePath, "utf8"));
    return {
      name: relativePath.replace(/\\/g, "/"),
      scenario
    };
  });
}

function expandFilters(filters) {
  const files = [];
  const all = globSync("scenarios/*.json", { cwd: repoRoot }).sort();
  for (const filter of filters) {
    const normalized = filter.replace(/\\/g, "/");
    if (normalized.includes("*") || normalized.includes("?")) {
      files.push(...globSync(normalized, { cwd: repoRoot }));
      continue;
    }
    if (existsSync(resolve(repoRoot, normalized))) {
      files.push(normalized);
      continue;
    }
    const byId = all.filter((name) => {
      const scenario = JSON.parse(
        readFileSync(resolve(repoRoot, name), "utf8")
      );
      return (
        scenario.id === filter ||
        name.endsWith("/" + filter) ||
        name.endsWith("/" + filter + ".json")
      );
    });
    if (byId.length === 0) {
      throw new Error("No scenario matched filter " + filter);
    }
    files.push(...byId);
  }
  return [...new Set(files)].sort();
}
async function startWorkbench(port) {
  const { createServer, preview } = await import(
    pathToFileURL(
      resolve(repoRoot, "apps/web/node_modules/vite/dist/node/index.js")
    ).href
  );
  if (process.env.PARTBENCH_SMOKE_UI_PRODUCTION === "1") {
    const server = await preview({
      configFile: resolve(repoRoot, "apps/web/vite.config.ts"),
      root: resolve(repoRoot, "apps/web"),
      preview: { host: "127.0.0.1", port, strictPort: true }
    });
    return {
      port,
      close: () =>
        new Promise((resolve, reject) =>
          server.httpServer.close((error) =>
            error ? reject(error) : resolve()
          )
        )
    };
  }
  const server = await createServer({
    configFile: resolve(repoRoot, "apps/web/vite.config.ts"),
    root: resolve(repoRoot, "apps/web"),
    plugins: [
      {
        name: "ui-smoke-startup-errors",
        transformIndexHtml() {
          return [
            {
              tag: "script",
              injectTo: "head-prepend",
              children:
                "window.__PARTBENCH_SMOKE_STARTUP_ERRORS__=[];addEventListener('error',e=>window.__PARTBENCH_SMOKE_STARTUP_ERRORS__.push(e.message));addEventListener('unhandledrejection',e=>window.__PARTBENCH_SMOKE_STARTUP_ERRORS__.push(String(e.reason?.stack??e.reason)));"
            }
          ];
        }
      }
    ],
    server: {
      host: "127.0.0.1",
      port,
      strictPort: true,
      watch: null,
      hmr: false
    }
  });
  await server.listen();
  return {
    port,
    close() {
      return server.close();
    }
  };
}
async function waitForHook(view) {
  const deadline = performance.now() + 60_000;
  while (performance.now() < deadline) {
    const ready = await evaluate(
      view,
      `Boolean(window.__PARTBENCH_UI_SMOKE__?.ready &&
        document.querySelector('canvas[aria-label="3D scene viewport"]')?.checkVisibility())`
    );
    if (ready) return;
    const errors = await evaluate(
      view,
      "window.__PARTBENCH_SMOKE_STARTUP_ERRORS__ ?? []"
    );
    if (errors.length)
      throw new Error("Workbench startup failed: " + errors.join("; "));
    await delay(200);
  }
  throw new Error("Timed out waiting for the live workbench smoke hook");
}

async function applyOps(view, ops) {
  return evaluate(
    view,
    "window.__PARTBENCH_UI_SMOKE__.applyOps(" + JSON.stringify(ops) + ")"
  );
}

async function getState(view) {
  return evaluate(view, "window.__PARTBENCH_UI_SMOKE__.getState()");
}

async function resetWorkbench(view) {
  await evaluate(view, "window.__PARTBENCH_UI_SMOKE__.reset()");
  const deadline = performance.now() + 30_000;
  while (performance.now() < deadline) {
    const state = await getState(view);
    if (
      !state.commandPending &&
      !state.commandError &&
      (state.bodies ? state.bodies.length : 0) === 0
    ) {
      return;
    }
    await delay(150);
  }
  throw new Error("Timed out resetting the live workbench");
}

async function evaluate(view, expression, timeoutMs = readyTimeoutMs) {
  return withDeadline(
    view.evaluate(expression),
    timeoutMs,
    "browser evaluation"
  );
}

async function withDeadline(promise, timeoutMs, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(
          () =>
            reject(new Error(`Timed out during ${label} after ${timeoutMs}ms`)),
          timeoutMs
        );
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function formatApplyError(error) {
  if (!error) return "unknown error";
  return error.code ? error.code + ": " + error.message : error.message;
}

function sanitizeFileToken(value) {
  return String(value).replace(/[^a-zA-Z0-9._-]+/g, "-");
}

function matches(actual, expected, exactArrays = false, numberTolerance = 0) {
  if (
    numberTolerance > 0 &&
    typeof actual === "number" &&
    typeof expected === "number"
  ) {
    return (
      Number.isFinite(actual) &&
      Number.isFinite(expected) &&
      Math.abs(actual - expected) <= numberTolerance
    );
  }
  if (expected === null || typeof expected !== "object") {
    return Object.is(actual, expected);
  }
  if (Array.isArray(expected)) {
    if (
      !Array.isArray(actual) ||
      (exactArrays
        ? actual.length !== expected.length
        : actual.length < expected.length)
    ) {
      return false;
    }
    return expected.every((item, index) =>
      matches(actual[index], item, exactArrays, numberTolerance)
    );
  }
  if (actual === null || typeof actual !== "object") {
    return false;
  }
  return Object.entries(expected).every(([key, value]) =>
    matches(actual[key], value, exactArrays, numberTolerance)
  );
}
function isExactDisplayReady(state, allowEmpty) {
  if (!state || state.commandPending) return false;
  if (state.commandError) return false;
  const applyText = String(state.applyButton?.text ?? "");
  if (/Applying/i.test(applyText)) return false;
  const rebuild = state.rebuildState ?? "";
  if (
    rebuild === "Updating" ||
    rebuild === "Building results" ||
    rebuild === "Building exact results" ||
    rebuild === "Display ready · Building exact results" ||
    /Updating/i.test(rebuild)
  ) {
    return false;
  }
  if (rebuild === "Update failed" || rebuild === "Fallback display only") {
    return false;
  }
  const bodies = state.bodies ?? [];
  if (!allowEmpty && bodies.length === 0 && !state.drawing?.entities.length)
    return false;
  const liveBodies = bodies.filter((body) => !body?.consumedByFeatureId);
  const exactResults = state.exactResults ?? [];
  const exact = state.exactStatuses ?? [];
  if (
    !allowEmpty &&
    liveBodies.length > 0 &&
    exactResults.length === 0 &&
    exact.length === 0
  ) {
    return false;
  }
  if (exactResults.length > 0) {
    // Consumed construction bodies may be blocked; every displayed final body
    // must have its own ready exact result. Unsupported is not readiness.
    for (const body of liveBodies) {
      if (
        !exactResults.some(
          (result) => result.bodyId === body.id && result.status === "ready"
        )
      ) {
        return false;
      }
    }
  } else {
    if (exact.some((status) => status !== "ready")) {
      return false;
    }
  }
  const display = state.displayStatuses ?? [];
  if (display.some((status) => status !== "ready")) {
    return false;
  }
  return true;
}

function isTerminalFailure(state) {
  const rebuild = state?.rebuildState ?? "";
  if (rebuild === "Update failed" || rebuild === "Fallback display only") {
    return true;
  }
  // Seed/use setup must not proceed on failed exact bodies.
  if (/exact result failed/i.test(rebuild)) {
    return true;
  }
  const exactResults = state?.exactResults ?? [];
  if (
    exactResults.some(
      (result) => result && result.status === "failed" && !result.consumed
    )
  ) {
    return true;
  }
  return false;
}

async function waitForReady(view, options = {}) {
  const timeoutMs = options.timeoutMs ?? readyTimeoutMs;
  const allowEmpty = options.allowEmpty ?? false;
  const startedAt = performance.now();
  const deadline = startedAt + timeoutMs;
  let last;
  let lastSig;
  let lastTimingPrint = performance.now();
  while (performance.now() < deadline) {
    last = await getState(view);
    const sig =
      (last && last.rebuildState) + "|" + ((last && last.diagnostic) || "");
    if (sig !== lastSig) {
      lastSig = sig;
      console.log("wait", sig);
      const unavailable = (last?.exactResults ?? [])
        .filter(
          (result) =>
            result.status === "unsupported" || result.status === "failed"
        )
        .map((result) => ({
          bodyId: result.bodyId,
          status: result.status,
          diagnostics: result.diagnostics
        }));
      if (unavailable.length)
        console.log("exact diagnostics", JSON.stringify(unavailable));
    }
    if (isExactDisplayReady(last, allowEmpty)) return last;
    if (
      process.env.PARTBENCH_SMOKE_UI_DIAGNOSTICS === "1" &&
      performance.now() - lastTimingPrint >= 15_000
    ) {
      lastTimingPrint = performance.now();
      console.log(
        "pending geometry timings",
        JSON.stringify(
          await evaluate(view, "window.__partbenchSmokeTimings?.splice(0)")
        )
      );
    }
    if (isTerminalFailure(last)) {
      throw new Error(
        "Workbench rebuild failed: " +
          last.rebuildState +
          ". " +
          last.diagnostic
      );
    }
    await delay(250);
  }
  throw new Error(
    "Timed out waiting for exact/display ready after " +
      Math.round(performance.now() - startedAt) +
      "ms. rebuild=" +
      (last && last.rebuildState) +
      " diagnostic=" +
      (last && last.diagnostic)
  );
}

async function assertNoErrorToast(view, label) {
  const state = await getState(view);
  if (state.commandError) {
    throw new Error(label + " error toast: " + state.commandError);
  }
  if (state.alerts && state.alerts.length) {
    throw new Error(label + " on-screen alert: " + state.alerts.join(" | "));
  }
}

async function assertScenarioQueries(view, name, step) {
  for (const queryCase of step.queries ?? []) {
    if (!queryCase.expect) continue;
    const actual = await evaluate(
      view,
      "window.__PARTBENCH_UI_SMOKE__.executeQuery(" +
        JSON.stringify(queryCase.query) +
        ")"
    );
    if (!matches(actual, queryCase.expect)) {
      throw new Error(
        name +
          " " +
          step.id +
          " query mismatch.\nexpected " +
          JSON.stringify(queryCase.expect) +
          "\nactual " +
          JSON.stringify(actual)
      );
    }
  }
}
async function waitForSelector(view, selector, timeoutMs) {
  const deadline = performance.now() + timeoutMs;
  while (performance.now() < deadline) {
    const found = await evaluate(
      view,
      "Boolean(document.querySelector(" + JSON.stringify(selector) + "))"
    );
    if (found) return;
    await delay(150);
  }
  throw new Error("Timed out waiting for " + selector);
}

async function waitForOptionalSelector(view, selector, timeoutMs) {
  try {
    await waitForSelector(view, selector, timeoutMs);
    return true;
  } catch {
    return false;
  }
}

async function clickApplyCollector(view) {
  await waitForSelector(view, '[data-action-id="solid.box"]', 15_000);
  await view.click('[data-action-id="solid.box"]');
  await waitForSelector(
    view,
    '[data-ui-smoke="apply"]:not([disabled])',
    15_000
  );
  await view.click('[data-ui-smoke="apply"]');
  await waitForReady(view, { allowEmpty: false, timeoutMs: readyTimeoutMs });
  const state = await getState(view);
  if (!state.bodies || state.bodies.length === 0) {
    throw new Error("Apply collector did not create a body in the live app.");
  }
  await resetWorkbench(view);
}

async function clickPickCollector(view) {
  const fillet = await evaluate(
    view,
    "Boolean(document.querySelector('[data-action-id=\"solid.fillet\"]'))"
  );
  if (!fillet) return;
  await view.click('[data-action-id="solid.fillet"]');
  const pickReady = await waitForOptionalSelector(
    view,
    '[data-ui-smoke="pick"]',
    8_000
  );
  if (pickReady) {
    await view.click('[data-ui-smoke="pick"]');
  }
}

async function captureFailure(view, screenshotPath, id, message) {
  let diagnostic = message;
  if (process.env.PARTBENCH_SMOKE_UI_DIAGNOSTICS === "1") {
    try {
      console.log(
        "failure geometry timings",
        JSON.stringify(
          await evaluate(view, "window.__partbenchSmokeTimings", 5_000)
        )
      );
    } catch {
      /* The renderer may be unavailable. */
    }
  }
  try {
    const state = await evaluate(
      view,
      "window.__PARTBENCH_UI_SMOKE__.getState()",
      5_000
    );
    diagnostic = [
      "scenario=" + id,
      "rebuild=" + state.rebuildState,
      "error=" + (state.commandError ?? ""),
      "notice=" + (state.commandNotice ?? ""),
      "alerts=" + (state.alerts ?? []).join(" | "),
      state.diagnostic
    ]
      .filter(Boolean)
      .join(" · ");
  } catch (error) {
    diagnostic =
      message +
      "; state unavailable (" +
      (error instanceof Error ? error.message : error) +
      ")";
  }
  try {
    const png = await withDeadline(
      view.screenshot({ encoding: "buffer" }),
      5_000,
      "failure screenshot capture"
    );
    writeFileSync(screenshotPath, png);
  } catch (error) {
    diagnostic +=
      "; screenshot failed (" +
      (error instanceof Error ? error.message : error) +
      ")";
  }
  return diagnostic;
}
async function runCadopsScenario(view, name, scenario) {
  const traceTimings = process.env.PARTBENCH_SMOKE_UI_DIAGNOSTICS === "1";
  if (traceTimings) {
    await evaluate(
      view,
      `(() => {
      const startedAt = performance.now();
      window.__partbenchSmokeTimings = [];
      addEventListener('partbench:geometry-diagnostic', event => {
        const d = event.detail;
        const events = window.__partbenchSmokeTimings;
        if (events.length >= 512) return;
        events.push({ ms: Math.round(d.timestamp - startedAt), phase: d.phase,
          ...(d.job ? { job: d.job.phase, operation: d.job.operation,
            sourceId: d.job.sourceId, executionMs: d.job.executionMs,
            queueMs: d.job.queueMs, outcome: d.job.outcome } : {}),
          ...(d.readyCount !== undefined ? { ready: d.readyCount, pending: d.pendingCount } : {}) });
      });
    })()`
    );
  }
  const printTimings = async () => {
    if (traceTimings)
      console.log(
        "geometry timings",
        JSON.stringify(
          await evaluate(view, "window.__partbenchSmokeTimings.splice(0)")
        )
      );
  };
  if (Array.isArray(scenario.seed) && scenario.seed.length > 0) {
    const seedStartedAt = performance.now();
    const seedResult = await applyOps(view, scenario.seed);
    console.log(
      name,
      "seed apply ms",
      Math.round(performance.now() - seedStartedAt)
    );
    await printTimings();
    console.log(name, "seed", JSON.stringify(seedResult));
    if (!seedResult.ok) {
      throw new Error(
        name + " seed failed: " + formatApplyError(seedResult.error)
      );
    }
    const seedBodies = seedResult.createdBodyIds ?? [];
    await waitForReady(view, {
      timeoutMs: readyTimeoutMs,
      allowEmpty: seedBodies.length === 0
    });
    console.log(
      name,
      "seed ready ms",
      Math.round(performance.now() - seedStartedAt)
    );
    await printTimings();
  }

  for (const step of scenario.steps ?? []) {
    // Persistence is covered by the Use/MCP journeys; engine replay has no export/import hook.
    if (
      step.persistRoundTrip &&
      (!Array.isArray(step.ops) || step.ops.length === 0)
    ) {
      continue;
    }
    const stepStartedAt = performance.now();
    const result = await applyOps(view, step.ops ?? []);
    console.log(
      name,
      step.id,
      "apply ms",
      Math.round(performance.now() - stepStartedAt)
    );
    if (step.expect && step.expect.error) {
      if (result.ok) {
        throw new Error(name + " " + step.id + " expected a structured error.");
      }
      if (
        step.expect.error.code &&
        result.error?.code !== step.expect.error.code
      ) {
        throw new Error(
          name +
            " " +
            step.id +
            " error code mismatch.\nexpected " +
            step.expect.error.code +
            "\nactual " +
            (result.error?.code ?? result.error?.message)
        );
      }
      if (
        step.expect.error.messageIncludes &&
        !String(result.error?.message ?? "").includes(
          step.expect.error.messageIncludes
        )
      ) {
        throw new Error(
          name +
            " " +
            step.id +
            " error message mismatch.\nexpected to include " +
            step.expect.error.messageIncludes +
            "\nactual " +
            result.error?.message
        );
      }
      continue;
    }
    if (!result.ok) {
      throw new Error(
        name +
          " " +
          step.id +
          " apply failed: " +
          formatApplyError(result.error)
      );
    }
    const createdBodies = result.createdBodyIds ?? [];
    const after = await getState(view);
    await waitForReady(view, {
      timeoutMs: readyTimeoutMs,
      allowEmpty:
        createdBodies.length === 0 && (after.bodies ?? []).length === 0
    });
    console.log(
      name,
      step.id,
      "ready ms",
      Math.round(performance.now() - stepStartedAt)
    );
    await printTimings();
    await assertNoErrorToast(view, name + " " + step.id);
    if (step.queries) {
      await assertScenarioQueries(view, name, step);
    }
  }
}

async function runPromotionScenario(view, name, scenario) {
  if (!Array.isArray(scenario.seed) || scenario.seed.length === 0) {
    throw new Error(name + " promotion scenario is missing a seed batch.");
  }
  const seedResult = await applyOps(view, scenario.seed);
  console.log(name, "seed", JSON.stringify(seedResult));
  if (!seedResult.ok) {
    throw new Error(
      name + " seed failed: " + formatApplyError(seedResult.error)
    );
  }
  await waitForReady(view, { timeoutMs: readyTimeoutMs });
  await assertNoErrorToast(view, name + " seed");
  const state = await getState(view);
  if (!state.bodies || state.bodies.length === 0) {
    throw new Error(name + " expected seeded bodies in the live workbench.");
  }
  await clickPickCollector(view);
}

async function typeField(view, selector, text) {
  const value = String(text ?? "");
  await clickVisibleControl(view, selector);
  await withDeadline(
    view.click(selector, { clickCount: 3, timeout: 5_000 }),
    7_000,
    "select field text " + selector
  );
  const focused = await evaluate(
    view,
    `document.activeElement?.matches(${JSON.stringify(selector)})`
  );
  if (!focused)
    throw new Error("Field did not receive keyboard focus: " + selector);
  await withDeadline(view.press("Backspace"), 7_000, "clear field " + selector);
  if (value)
    await withDeadline(view.type(value), 7_000, "type field " + selector);
  const actual = await evaluate(
    view,
    "document.querySelector(" + JSON.stringify(selector) + ")?.value"
  );
  if (String(actual ?? "") !== value) {
    throw new Error(
      "typed " +
        JSON.stringify(value) +
        " into " +
        selector +
        " but value is " +
        JSON.stringify(actual)
    );
  }
}

async function waitForControlState(view, selector, disabled, timeoutMs) {
  const deadline = performance.now() + timeoutMs;
  let last;
  while (performance.now() < deadline) {
    last = await evaluate(
      view,
      "(() => { const el = document.querySelector(" +
        JSON.stringify(selector) +
        "); return el ? { present: true, disabled: Boolean(el.disabled) } : { present: false, disabled: false }; })()"
    );
    if (last.present && Boolean(last.disabled) === disabled) return last;
    await delay(100);
  }
  throw new Error(
    "expected " +
      selector +
      " disabled=" +
      disabled +
      " (present=" +
      (last && last.present) +
      " disabled=" +
      (last && last.disabled) +
      ")"
  );
}

async function assertNotFrozen(view, label) {
  const ready = await evaluate(
    view,
    "Boolean(window.__PARTBENCH_UI_SMOKE__ && window.__PARTBENCH_UI_SMOKE__.ready)"
  );
  if (!ready) {
    throw new Error(label + " froze: smoke hook is gone");
  }
  const state = await getState(view);
  if (isTerminalFailure(state)) {
    throw new Error(
      label +
        " froze: rebuild=" +
        state.rebuildState +
        " " +
        (state.diagnostic ?? "")
    );
  }
}

async function writeUseScreenshot(view, name) {
  const screenshotPath = join(screenshotDir, sanitizeFileToken(name) + ".png");
  const png = await view.screenshot({ encoding: "buffer" });
  writeFileSync(screenshotPath, png);
  console.log("screenshot " + screenshotPath);
  return screenshotPath;
}

function collectorSelectSelector(spec) {
  if (spec.selector) return spec.selector;
  if (spec.smoke) return "[data-ui-smoke=" + JSON.stringify(spec.smoke) + "]";
  if (spec.label) {
    const smokeId = String(spec.label)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    return "[data-ui-smoke=" + JSON.stringify(smokeId) + "]";
  }
  throw new Error("select step needs selector, smoke, or label");
}

async function clickVisibleControl(view, selector) {
  // Exclude the ribbon's measurement-only duplicate. Open overflow via its real
  // summary control, then let Bun enforce visibility, stability and hit testing.
  const live =
    ":is(" +
    selector +
    "):not([hidden], [hidden] *, .pb-mode-ribbon__measure *)";
  await waitForSelector(view, live, 15_000);
  const overflow =
    "details.pb-ribbon-overflow:not([open]):has(" + live + ") > summary";
  if (
    await evaluate(
      view,
      "Boolean(document.querySelector(" + JSON.stringify(overflow) + "))"
    )
  ) {
    await view.click(overflow, { timeout: 5_000 });
  }
  await withDeadline(
    view.scrollTo(live, { block: "nearest", timeout: 5_000 }),
    7_000,
    "scroll to " + selector
  );
  await withDeadline(
    view.click(live, { timeout: 5_000 }),
    7_000,
    "click " + selector
  );
}

async function selectCollectorOption(view, spec) {
  const selector = collectorSelectSelector(spec);
  const option = String(spec.option ?? spec.value ?? "");
  if (!option) {
    throw new Error("select step needs option");
  }
  await view.scrollTo(selector, { block: "nearest", timeout: 5_000 });
  const deadline = performance.now() + 15_000;
  let last;
  while (performance.now() < deadline) {
    last = await evaluate(
      view,
      "(() => { const el = document.querySelector(" +
        JSON.stringify(selector) +
        "); if (!el || el.tagName !== 'SELECT') { return { ok: false, error: el ? 'not-select' : 'missing', options: [] }; } if (el.disabled || !el.checkVisibility() || !el.getClientRects().length) return { ok: false, error: 'not-actionable' }; const options = Array.from(el.options).map((item) => ({ value: item.value, text: item.textContent.replace(/\\s+/g, ' ').trim() })); const needle = " +
        JSON.stringify(option) +
        "; const match = Array.from(el.options).find((item) => item.value === needle || item.textContent.replace(/\\s+/g, ' ').trim().toLowerCase().includes(needle.toLowerCase())); if (!match) return { ok: false, error: 'no-option', options }; const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set; setter.call(el, match.value); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return { ok: true, value: el.value, options }; })()"
    );
    if (last && last.ok) return last;
    await delay(150);
  }
  throw new Error(
    "select " +
      selector +
      " option " +
      JSON.stringify(option) +
      " failed: " +
      JSON.stringify(last)
  );
}

function someMatches(actualList, expectedItem) {
  return (
    Array.isArray(actualList) &&
    actualList.some((item) => matches(item, expectedItem))
  );
}

async function applyUseSeedSetup(view, name, scenario) {
  const seed = scenario.useSeed ?? scenario.seed;
  if (!Array.isArray(seed) || seed.length === 0) {
    return;
  }
  // applyOps(seed) is workbench SETUP so Use can operate the claimed feature.
  // It is not Use. Use is the clicks/typed fields/Apply that follow.
  const seedResult = await applyOps(view, seed);
  if (!seedResult.ok)
    throw new Error(
      name + " seed failed: " + formatApplyError(seedResult.error)
    );
  await waitForReady(view, { timeoutMs: readyTimeoutMs, allowEmpty: false });
  await assertNoErrorToast(view, name + " seed");
}

// Poll the observable result, not a transient Applying state that may finish
// between samples. Exact array lengths catch duplicate mates and failed undo.
async function expectStructure(view, name, expected) {
  const deadline = performance.now() + 10_000;
  let state;
  do {
    state = await getState(view);
    if (state.commandError || isTerminalFailure(state)) {
      throw new Error(name + " failed: " + JSON.stringify(state));
    }
    if (
      isExactDisplayReady(state, false) &&
      matches(state.structureQuery, expected, true, 1e-7)
    )
      return;
    await delay(50);
  } while (performance.now() < deadline);
  throw new Error(
    name +
      " structure mismatch. Expected " +
      JSON.stringify(expected) +
      " actual " +
      JSON.stringify(state.structureQuery)
  );
}

async function assertUseOutcome(view, name, scenario, clicks) {
  const expectSpec = scenario.useExpect;
  if (!expectSpec) return;
  for (const needle of expectSpec.forbidClicks ?? []) {
    const hit = clicks.find((click) => String(click).includes(needle));
    if (hit) {
      throw new Error(
        name +
          " use clicked " +
          needle +
          " (" +
          hit +
          "). That is not this feature. Box Apply belongs on a box scenario."
      );
    }
  }
  const state = await getState(view);
  const features =
    (state.structureQuery && state.structureQuery.features) ||
    state.features ||
    [];
  const bodies =
    (state.structureQuery && state.structureQuery.bodies) || state.bodies || [];
  const assemblies =
    (state.structureQuery && state.structureQuery.assemblies) ||
    state.assemblies ||
    [];
  for (const expectedFeature of expectSpec.features ?? []) {
    if (!someMatches(features, expectedFeature)) {
      throw new Error(
        name +
          " use did not produce " +
          JSON.stringify(expectedFeature) +
          ". actual features " +
          JSON.stringify(features) +
          " bodies " +
          JSON.stringify(bodies)
      );
    }
  }
  for (const expectedAssembly of expectSpec.assemblies ?? []) {
    if (
      !assemblies.some((assembly) =>
        matches(assembly, expectedAssembly, true, 1e-7)
      )
    ) {
      throw new Error(
        name +
          " use did not produce " +
          JSON.stringify(expectedAssembly) +
          ". actual assemblies " +
          JSON.stringify(assemblies)
      );
    }
  }
  console.log(
    name,
    "use structure",
    JSON.stringify({ features, bodies, assemblies })
  );
}

async function openProjectFile(
  view,
  filePath,
  format = "wcad",
  expectedImportError,
  cancelImport = false,
  maxUsableViewMs,
  expectedPreviewSolids,
  exactSelectionBudgetMs,
  requireExactSelectionBudget = false
) {
  const beforeImport =
    cancelImport || maxUsableViewMs ? await getState(view) : undefined;
  const bytes = readFileSync(resolve(repoRoot, filePath)).toString("base64");
  const fileName = filePath.split(/[\\/]/).at(-1);
  const isStep = format === "step";
  const actionId = isStep ? "project.import-step" : "project.open";
  // Supply a file-picker result while exercising the real Open/Import STEP
  // control, reader, transaction, rebuild, and rendering path.
  await evaluate(
    view,
    "(() => { window.__pbOriginalOpenPicker = window.showOpenFilePicker; " +
      "const bytes = Uint8Array.from(atob(" +
      JSON.stringify(bytes) +
      "), c => c.charCodeAt(0)); " +
      "const file = new File([bytes], " +
      JSON.stringify(fileName) +
      "); " +
      "window.showOpenFilePicker = async () => [{ kind: 'file', name: file.name, " +
      "getFile: async () => file, queryPermission: async () => 'granted', requestPermission: async () => 'granted' }]; " +
      "return true; })()"
  );
  const startedAt = performance.now();
  let existingWorkerIds = new Set();
  let previewEvidence;
  let exactSelectionEvidence;
  let exactObserverOffset = 0;
  let previewBounds;
  const originalCamera = await evaluate(
    view,
    `document.querySelector('canvas[aria-label="3D scene viewport"]')?.dataset.camera`
  );
  try {
    if (exactSelectionBudgetMs) {
      await evaluate(
        view,
        `(() => {
        const started = performance.now();
        let seenPreview = false;
        const observer = window.__pbExactImportObserver = {};
        const sample = () => {
          const canvas = document.querySelector('canvas[aria-label="3D scene viewport"]');
          const previewCount = Number(canvas?.dataset.previewMeshCount);
          seenPreview ||= previewCount > 0;
          if (seenPreview && previewCount === 0) {
            const readiness = window.__PARTBENCH_UI_SMOKE__.getOccurrenceSelectionReadiness();
            const gpu = JSON.parse(document.querySelector('canvas[data-gpu-metrics]')?.dataset.gpuMetrics ?? '{}');
            if (readiness.ready && gpu.instances === readiness.occurrenceCount && Number(canvas.dataset.renderedAt) >= started) {
              observer.result = {...readiness, elapsedMs: performance.now() - started};
              return;
            }
          }
          if (performance.now() - started < ${readyTimeoutMs}) observer.frame = requestAnimationFrame(sample);
        };
        observer.frame = requestAnimationFrame(sample);
      })()`
      );
      // Add all host setup time through installation. This conservatively
      // includes the CDP response delay, while avoiding later polling/capture
      // delay being mistaken for product readiness.
      exactObserverOffset = performance.now() - startedAt;
    }
    if (isStep && process.env.PARTBENCH_SMOKE_PROFILE_IMPORT === "1") {
      await view.cdp("Profiler.enable");
      await view.cdp("Profiler.start");
    }
    if (isStep && process.env.PARTBENCH_SMOKE_UI_DIAGNOSTICS === "1") {
      await evaluate(
        view,
        `(() => {
        const start = performance.now();
        window.__pbImportTimings = [];
        window.__pbImportListener = event => {
          const d = event.detail;
          if (window.__pbImportTimings.length >= 512) return;
          window.__pbImportTimings.push({ms: Math.round(performance.now() - start),
            phase: d.phase, ...(d.job ? {job: d.job} : {}), ...(d.profile ? {profile: d.profile} : {}),
            ...(d.readyCount !== undefined ? {ready: d.readyCount, pending: d.pendingCount} : {})});
        };
        addEventListener('partbench:geometry-diagnostic', window.__pbImportListener);
      })()`
      );
    }
    if (cancelImport === "preparing") {
      await view.cdp("Target.setDiscoverTargets", {
        discover: true,
        filter: [{}]
      });
      const { targetInfos } = await view.cdp("Target.getTargets");
      existingWorkerIds = new Set(
        targetInfos
          .filter((target) => target.type === "worker")
          .map((target) => target.targetId)
      );
    }
    await clickVisibleControl(view, '[data-ribbon-roving-id="mode-project"]');
    await clickVisibleControl(view, '[data-action-id="' + actionId + '"]');
    if (cancelImport) {
      const selector = '.pb-status-bar__model-work button[aria-busy="true"]';
      const deadline = performance.now() + 10_000;
      while (
        !(await evaluate(
          view,
          `document.querySelector(${JSON.stringify(selector)})?.textContent === "Cancel import"`
        ))
      ) {
        if (performance.now() > deadline)
          throw new Error("Import did not expose an active Cancel control");
        await delay(25);
      }
      let checkpointWorkerIds = [];
      if (cancelImport === "preparing") {
        // Exercise cancellation after the large assembly has started its real
        // child kernels, rather than only cancelling before import enters WASM.
        const usesPool = await evaluate(
          view,
          "navigator.hardwareConcurrency >= 4 && (navigator.deviceMemory === undefined || navigator.deviceMemory >= 8)"
        );
        if (usesPool) {
          const preparationDeadline = performance.now() + readyTimeoutMs;
          while (true) {
            const state = await getState(view);
            if (
              state.stepImport?.meshCount > 0 &&
              (await evaluate(
                view,
                `Number(document.querySelector('canvas[aria-label="3D scene viewport"]').dataset.previewMeshCount) > 0`
              ))
            )
              break;
            if (performance.now() > preparationDeadline)
              throw new Error(
                "STEP display preview did not appear before cancellation"
              );
            await delay(50);
          }
          const beforeZoom = await getState(view);
          const frame = await evaluate(
            view,
            `(() => {
            const r = document.querySelector('canvas[aria-label="3D scene viewport"]').getBoundingClientRect();
            return {x: r.x + r.width / 2, y: r.y + r.height / 2,
              camera: document.querySelector('canvas[aria-label="3D scene viewport"]').dataset.camera};
          })()`
          );
          await view.cdp("Input.dispatchMouseEvent", {
            type: "mouseWheel",
            x: frame.x,
            y: frame.y,
            deltaX: 0,
            deltaY: 120
          });
          await evaluate(
            view,
            "new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))"
          );
          const zoomedCamera = await evaluate(
            view,
            `document.querySelector('canvas[aria-label="3D scene viewport"]').dataset.camera`
          );
          if (zoomedCamera === frame.camera)
            throw new Error(
              "Import preview did not respond to native zoom input"
            );
          while (true) {
            const progress = (await getState(view)).stepImport;
            if (!progress)
              throw new Error(
                "Import completed before active preparation could be cancelled"
              );
            if (progress.completed > beforeZoom.stepImport.completed) break;
            if (performance.now() > preparationDeadline)
              throw new Error("No new geometry arrived after preview zoom");
            await delay(50);
          }
          await evaluate(
            view,
            "new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))"
          );
          if (
            zoomedCamera !==
            (await evaluate(
              view,
              `document.querySelector('canvas[aria-label="3D scene viewport"]').dataset.camera`
            ))
          )
            throw new Error(
              "New import geometry overrode explicit preview zoom"
            );
          console.log(
            "STEP preview explicit zoom preserved as geometry arrived"
          );
          await writeUseScreenshot(view, "engine-import-before-cancel");
          // Supported large imports display meshes from their exact workers.
          // Seeing that preview and at least two new native workers proves
          // cancellation interrupts active native preparation.
          while (checkpointWorkerIds.length < 2) {
            const { targetInfos } = await view.cdp("Target.getTargets");
            // Chromium reports blank URLs for these dedicated worker targets.
            // The existing solid already owns its command/geometry workers;
            // track the native preparation workers by ID instead of URL.
            checkpointWorkerIds = targetInfos
              .filter(
                (target) =>
                  target.type === "worker" &&
                  !existingWorkerIds.has(target.targetId)
              )
              .map((target) => target.targetId);
            if (performance.now() > preparationDeadline)
              throw new Error("STEP import did not start checkpoint workers");
            if (checkpointWorkerIds.length < 2) await delay(100);
          }
        }
      }
      const cancelledAt = performance.now();
      if (cancelImport === "escape") {
        await withDeadline(view.press("Escape"), 3_000, "cancel STEP import");
      } else {
        await clickVisibleControl(view, selector);
      }
      while ((await getState(view)).commandPending) {
        if (performance.now() - cancelledAt > 3_000)
          throw new Error(
            "Import cancellation did not settle within 3 seconds"
          );
        await delay(25);
      }
      while (checkpointWorkerIds.length > 0) {
        const { targetInfos } = await view.cdp("Target.getTargets");
        if (
          !targetInfos.some((target) =>
            checkpointWorkerIds.includes(target.targetId)
          )
        )
          break;
        if (performance.now() - cancelledAt > 3_000)
          throw new Error(
            "Cancelled STEP import left checkpoint workers running"
          );
        await delay(25);
      }
      await evaluate(
        view,
        "new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))"
      );
      const restoredCamera = await evaluate(
        view,
        `document.querySelector('canvas[aria-label="3D scene viewport"]')?.dataset.camera`
      );
      if (originalCamera !== restoredCamera)
        throw new Error(
          "Cancelled import did not restore the previous camera: " +
            JSON.stringify({ originalCamera, restoredCamera })
        );
      const afterImport = await getState(view);
      if (afterImport.stepImport)
        throw new Error("Cancelled import left display preview state behind");
      if (
        afterImport.commandError ||
        !matches(
          afterImport.structureQuery,
          beforeImport.structureQuery,
          true,
          1e-7
        ) ||
        JSON.stringify(afterImport.viewport?.meshIds) !==
          JSON.stringify(beforeImport.viewport?.meshIds)
      ) {
        throw new Error(
          "Cancelled import changed the project or its rendered geometry: " +
            JSON.stringify({
              before: {
                structure: beforeImport.structureQuery,
                viewport: beforeImport.viewport
              },
              after: {
                error: afterImport.commandError,
                structure: afterImport.structureQuery,
                viewport: afterImport.viewport
              }
            })
        );
      }
      const message = await evaluate(
        view,
        'document.body.textContent.includes("Import cancelled. Your project is unchanged.")'
      );
      if (!message) throw new Error("Import did not report cancellation");
      console.log(
        "STEP cancellation",
        JSON.stringify({
          fileName,
          control: cancelImport === "escape" ? "Escape" : "Cancel import",
          checkpointWorkersCancelled: checkpointWorkerIds.length,
          settleMs: Math.round(performance.now() - cancelledAt)
        })
      );
      return;
    }
    if (isStep) {
      // An existing project can still be Ready while the file picker/reader
      // yields. Observe this import's pending-to-settled transition before
      // readiness; otherwise the previous model can produce a false pass.
      const deadline = performance.now() + readyTimeoutMs;
      let seenPending = false;
      while (true) {
        const state = await getState(view);
        seenPending ||= state.commandPending;
        if (maxUsableViewMs && !previewEvidence) {
          const frame = await evaluate(
            view,
            `(() => {
            const canvas = document.querySelector('canvas[aria-label="3D scene viewport"]');
            const r = canvas.getBoundingClientRect();
            return { meshCount: Number(canvas.dataset.previewMeshCount), camera: canvas.dataset.camera,
              renderer: canvas.dataset.renderer, visible: document.elementFromPoint(r.x + r.width * 0.4, r.y + r.height * 0.45) === canvas,
              x: r.x + r.width * 0.4, y: r.y + r.height * 0.45 };
          })()`
          );
          if (
            frame.meshCount > 0 &&
            frame.renderer === "webgl2" &&
            frame.visible
          ) {
            const visibleMs = Math.round(performance.now() - startedAt);
            if (
              !state.commandPending ||
              !matches(
                state.structureQuery,
                beforeImport.structureQuery,
                true,
                1e-7
              )
            )
              throw new Error(
                "Progressive preview committed partial source geometry"
              );
            if (
              !(await evaluate(
                view,
                `document.querySelector('[data-action-id="solid.box"]')?.disabled`
              ))
            )
              throw new Error(
                "Modeling controls were enabled before exact import readiness"
              );
            const orbitStarted = performance.now();
            await view.cdp("Input.dispatchMouseEvent", {
              type: "mousePressed",
              x: frame.x,
              y: frame.y,
              button: "left",
              buttons: 1,
              clickCount: 1
            });
            for (let move = 1; move <= 4; move++) {
              await view.cdp("Input.dispatchMouseEvent", {
                type: "mouseMoved",
                x: frame.x + (45 * move) / 4,
                y: frame.y + (25 * move) / 4,
                button: "left",
                buttons: 1
              });
              await evaluate(
                view,
                "new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))"
              );
            }
            await view.cdp("Input.dispatchMouseEvent", {
              type: "mouseReleased",
              x: frame.x + 45,
              y: frame.y + 25,
              button: "left",
              buttons: 0,
              clickCount: 1
            });
            await evaluate(
              view,
              "new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))"
            );
            const camera = await evaluate(
              view,
              `document.querySelector('canvas[aria-label="3D scene viewport"]').dataset.camera`
            );
            const beforeCamera = JSON.parse(frame.camera);
            const afterCamera = JSON.parse(camera);
            if (
              afterCamera.yaw === beforeCamera.yaw &&
              afterCamera.pitch === beforeCamera.pitch
            )
              throw new Error(
                "Progressive STEP view did not respond to native orbit input"
              );
            previewEvidence = {
              visibleMs,
              usableMs: Math.round(performance.now() - startedAt),
              orbitMs: Math.round(performance.now() - orbitStarted),
              firstMeshCount: frame.meshCount,
              camera: JSON.parse(camera)
            };
            console.log("STEP usable preview", JSON.stringify(previewEvidence));
            if (process.env.PARTBENCH_SMOKE_CAPTURE_IMPORT === "1")
              await writeUseScreenshot(view, "engine-first-progressive-view");
            if (previewEvidence.usableMs > maxUsableViewMs)
              throw new Error(
                "Cold usable view exceeded " +
                  maxUsableViewMs +
                  " ms: " +
                  JSON.stringify(previewEvidence)
              );
          } else if (performance.now() - startedAt > maxUsableViewMs) {
            throw new Error(
              "Cold import did not render a usable assembly within " +
                maxUsableViewMs +
                " ms"
            );
          }
        }
        if (
          previewEvidence &&
          state.stepImport?.completed === state.stepImport?.total &&
          state.stepImport?.meshCount > 0 &&
          !previewEvidence.completeViewMs &&
          (await evaluate(
            view,
            `Number(document.querySelector('canvas[aria-label="3D scene viewport"]').dataset.previewMeshCount)`
          )) === state.stepImport.meshCount
        ) {
          previewEvidence.completeViewMs = Math.round(
            performance.now() - startedAt
          );
          previewEvidence.completeMeshCount = state.stepImport.meshCount;
          previewEvidence.completeSolidCount = state.stepImport.solidCount;
          previewBounds = await evaluate(
            view,
            "window.__PARTBENCH_UI_SMOKE__.getViewportBounds()"
          );
          if (
            expectedPreviewSolids !== undefined &&
            state.stepImport.solidCount !== expectedPreviewSolids
          )
            throw new Error(
              "Progressive import omitted or duplicated solids: " +
                state.stepImport.solidCount
            );
          await evaluate(
            view,
            "new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))"
          );
          previewEvidence.completeCamera = JSON.parse(
            await evaluate(
              view,
              `document.querySelector('canvas[aria-label="3D scene viewport"]').dataset.camera`
            )
          );
          if (
            previewEvidence.completeCamera.yaw !== previewEvidence.camera.yaw ||
            previewEvidence.completeCamera.pitch !==
              previewEvidence.camera.pitch
          )
            throw new Error(
              "Progressive framing reset the user's orbit orientation"
            );
          if (process.env.PARTBENCH_SMOKE_CAPTURE_IMPORT === "1")
            await writeUseScreenshot(view, "engine-complete-progressive-view");
        }
        if (state.commandError && !state.commandPending) {
          if (
            !expectedImportError ||
            !state.commandError.includes(expectedImportError)
          )
            throw new Error("STEP import failed: " + state.commandError);
          const responsive = await evaluate(
            view,
            "Boolean(window.__PARTBENCH_UI_SMOKE__?.ready)",
            5_000
          );
          if (!responsive)
            throw new Error("Workbench did not remain responsive");
          console.log("expected STEP import error", state.commandError);
          return;
        }
        if (seenPending && !state.commandPending) break;
        if (performance.now() > deadline)
          throw new Error(
            "Import " + fileName + " did not produce a preview or error"
          );
        await delay(100);
      }
    }
    await waitForReady(view, {
      timeoutMs: readyTimeoutMs,
      allowEmpty: false
    });
    if (exactSelectionBudgetMs) {
      const readiness = await evaluate(
        view,
        "window.__PARTBENCH_UI_SMOKE__.getOccurrenceSelectionReadiness()"
      );
      await evaluate(
        view,
        "new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))"
      );
      const observed = await evaluate(
        view,
        "window.__pbExactImportObserver?.result"
      );
      if (!observed?.ready)
        throw new Error(
          "Exact import never exposed a rendered, selectable frame"
        );
      exactSelectionEvidence = {
        ...readiness,
        elapsedMs: Math.ceil(observed.elapsedMs + exactObserverOffset),
        observedHostElapsedMs: Math.round(performance.now() - startedAt),
        budgetMs: exactSelectionBudgetMs,
        withinBudget:
          observed.elapsedMs + exactObserverOffset <= exactSelectionBudgetMs
      };
      console.log(
        "STEP exact selection",
        JSON.stringify(exactSelectionEvidence)
      );
      if (
        !readiness.ready ||
        readiness.occurrenceCount !== 246 ||
        readiness.selectableCount !== 246 ||
        readiness.definitionCount !== 51
      )
        throw new Error(
          "Engine occurrences lack complete exact selection identity: " +
            JSON.stringify(readiness)
        );
      if (requireExactSelectionBudget && !exactSelectionEvidence.withinBudget)
        throw new Error(
          "Exact selection exceeded " +
            exactSelectionBudgetMs +
            " ms: " +
            exactSelectionEvidence.elapsedMs
        );
    }
    if (expectedImportError) {
      throw new Error(
        "Import " + fileName + " did not report " + expectedImportError
      );
    }
    if (maxUsableViewMs) {
      if (!previewEvidence || !previewBounds)
        throw new Error(
          "Import did not expose a complete progressive preview before exact readiness"
        );
      const finalBounds = await evaluate(
        view,
        "window.__PARTBENCH_UI_SMOKE__.getViewportBounds()"
      );
      const state = await getState(view);
      if (
        state.stepImport ||
        state.viewport.meshIds.some((id) => id.startsWith("import-preview:"))
      )
        throw new Error("Completed import retained provisional geometry");
      // The transient mesh uses 1 mm linear deflection, the exact display 0.25
      // mm. Compare placed solids against the final placed definition bounds.
      const tolerance = 1.5;
      for (const side of ["min", "max"])
        for (let axis = 0; axis < 3; axis++) {
          if (
            Math.abs(
              previewBounds.bounds[side][axis] - finalBounds.bounds[side][axis]
            ) > tolerance
          )
            throw new Error(
              "Preview/final assembly bounds disagree: " +
                JSON.stringify({
                  preview: previewBounds.bounds,
                  final: finalBounds.bounds
                })
            );
        }
      const contains = (outer, inner) =>
        [0, 1, 2].every(
          (axis) =>
            outer.min[axis] <= inner.min[axis] + tolerance &&
            outer.max[axis] >= inner.max[axis] - tolerance
        );
      if (
        !previewBounds.meshes.every((mesh) =>
          finalBounds.meshes.some((target) =>
            contains(target.bounds, mesh.bounds)
          )
        ) ||
        !finalBounds.meshes.every((mesh) =>
          previewBounds.meshes.some((source) =>
            contains(mesh.bounds, source.bounds)
          )
        )
      )
        throw new Error(
          "Preview solids do not match the final placed definitions"
        );
      const camera = JSON.parse(
        await evaluate(
          view,
          `document.querySelector('canvas[aria-label="3D scene viewport"]').dataset.camera`
        )
      );
      if (
        JSON.stringify(camera) !==
        JSON.stringify(previewEvidence.completeCamera)
      )
        throw new Error("Completing import reset the user's camera");
      previewEvidence.placedBoundsMatch = true;
      previewEvidence.cameraPreserved = true;
    }
    await assertNoErrorToast(view, "Open " + fileName);
  } finally {
    if (exactSelectionBudgetMs)
      await evaluate(
        view,
        `(() => {
      cancelAnimationFrame(window.__pbExactImportObserver?.frame);
      delete window.__pbExactImportObserver;
    })()`
      );
    if (isStep) {
      if (process.env.PARTBENCH_SMOKE_PROFILE_IMPORT === "1") {
        const { profile } = await view.cdp("Profiler.stop");
        writeFileSync(
          resolve(
            repoRoot,
            ".metrics",
            "ui-smoke",
            fileName.replace(/[^a-zA-Z0-9.-]/g, "_") +
              (cancelImport ? "-cancel" : "") +
              ".cpuprofile"
          ),
          JSON.stringify(profile)
        );
        await view.cdp("Profiler.disable");
      }
      if (process.env.PARTBENCH_SMOKE_UI_DIAGNOSTICS === "1") {
        console.log(
          "STEP stages",
          JSON.stringify(
            await evaluate(
              view,
              `(() => {
          removeEventListener('partbench:geometry-diagnostic', window.__pbImportListener);
          const timings = window.__pbImportTimings;
          delete window.__pbImportListener; delete window.__pbImportTimings;
          return timings;
        })()`
            )
          )
        );
      }

      console.log(
        "STEP import",
        JSON.stringify({
          fileName,
          elapsedMs: Math.round(performance.now() - startedAt),
          preview: previewEvidence,
          exactSelection: exactSelectionEvidence
        })
      );
    }
    await evaluate(
      view,
      "(() => { window.showOpenFilePicker = window.__pbOriginalOpenPicker; delete window.__pbOriginalOpenPicker; return true; })()"
    );
  }
}

async function saveProjectFile(view, filePath) {
  const fileName = filePath.split(/[\\/]/).at(-1);
  await evaluate(
    view,
    `(() => {
    window.__pbOriginalSavePicker=window.showSaveFilePicker;
    window.__pbSavedFile={closed:false};
    window.showSaveFilePicker=async()=>({kind:'file',name:${JSON.stringify(fileName)},queryPermission:async()=> 'granted',requestPermission:async()=> 'granted',createWritable:async()=>({
      write:async data=>{window.__pbSavedFile.bytes=new Uint8Array(data instanceof Blob?await data.arrayBuffer():data);},
      close:async()=>{window.__pbSavedFile.closed=true;}
    })});return true;
  })()`
  );
  try {
    await clickVisibleControl(view, '[data-ribbon-roving-id="mode-project"]');
    await clickVisibleControl(view, '[data-action-id="project.save-as"]');
    const deadline = performance.now() + readyTimeoutMs;
    while (!(await evaluate(view, "window.__pbSavedFile.closed"))) {
      await assertNoErrorToast(view, "Save native project");
      if (performance.now() > deadline)
        throw new Error("Native save did not complete");
      await delay(50);
    }
    const encoded = await evaluate(
      view,
      "(() => {const bytes=window.__pbSavedFile.bytes;let text='';for(let i=0;i<bytes.length;i+=32768)text+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(text);})()"
    );
    const path = resolve(repoRoot, filePath);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, Buffer.from(encoded, "base64"));
    console.log(
      "Native UI save",
      JSON.stringify({
        filePath,
        byteLength: Buffer.from(encoded, "base64").length
      })
    );
  } finally {
    await evaluate(
      view,
      "(() => {window.showSaveFilePicker=window.__pbOriginalSavePicker;delete window.__pbOriginalSavePicker;delete window.__pbSavedFile;return true;})()"
    );
  }
}

// Precision drafting stays in the existing drawing/interchange browser journey.
// Inputs and mouse events exercise controls; document/DOM reads only assert results.
async function exerciseDrawingPrecision(view) {
  const coordinate = "input[data-drawing-coordinate]";
  const kinds = [
    "endpoint",
    "midpoint",
    "center",
    "quadrant",
    "intersection",
    "tangent",
    "perpendicular",
    "extension"
  ];
  const initial = (await getState(view)).drawing;
  const expect = (condition, message) => {
    if (!condition) throw new Error("Drawing precision: " + message);
  };
  const equalPoint = (actual, expected, tolerance = 1e-10) =>
    actual?.length === 2 &&
    actual.every((n, i) => Math.abs(n - expected[i]) < tolerance);
  const settle = async (count, ready = () => true) => {
    const deadline = performance.now() + 10_000;
    let state;
    do {
      state = await getState(view);
      if (state.commandError) throw new Error(state.commandError);
      if (
        !state.commandPending &&
        state.drawing.entities.length === count &&
        ready(state.drawing)
      )
        return state.drawing;
      await delay(30);
    } while (performance.now() < deadline);
    throw new Error(
      "Drawing precision count did not settle: " + JSON.stringify(state.drawing)
    );
  };
  const choose = (tool = "line") =>
    clickVisibleControl(view, `[data-drawing-tool="${tool}"]`);
  const enter = async (text) => {
    await typeField(view, coordinate, text);
    await view.press("Enter");
  };
  const undo = async (count, ready) => {
    await clickVisibleControl(view, 'button[aria-label="Undo"]');
    return settle(count, ready);
  };
  const create = async (a, b, tool = "line") => {
    const count = (await getState(view)).drawing.entities.length;
    await choose(tool);
    await enter(a);
    await enter(b);
    return (await settle(count + 1)).entities.at(-1);
  };
  const settings = 'details:has(input[aria-label="Snap endpoint"])';
  const checkbox = async (label, checked) => {
    const selector = `input[aria-label="${label}"]`;
    if (
      (await evaluate(
        view,
        `document.querySelector(${JSON.stringify(selector)})?.checked`
      )) !== checked
    )
      await clickVisibleControl(view, selector);
  };
  const onlySnap = async (kind) => {
    if (
      !(await evaluate(
        view,
        `document.querySelector(${JSON.stringify(settings)})?.open`
      ))
    )
      await clickVisibleControl(view, settings + " > summary");
    await checkbox("Object snaps", true);
    await checkbox("Object tracking", false);
    for (const value of kinds) await checkbox("Snap " + value, value === kind);
    await clickVisibleControl(view, settings + " > summary");
  };
  const hover = async (point, pixelOffset = [3, 0]) => {
    const position = await evaluate(
      view,
      `(() => {
      const svg = document.querySelector('svg[aria-label="2D drawing canvas"]');
      const p = new DOMPoint(${point[0]}, ${-point[1]}).matrixTransform(svg.getScreenCTM());
      return {x:p.x + ${pixelOffset[0]}, y:p.y + ${pixelOffset[1]}};
    })()`
    );
    await view.cdp("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      ...position
    });
    // Flush the React render before inspecting the visible preview.
    await evaluate(
      view,
      "new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))"
    );
    return position;
  };
  const readSnap = () =>
    evaluate(
      view,
      `(() => {
    const target = document.querySelector('[data-drawing-snap]');
    return target && { kind:target.dataset.drawingSnap, point:[Number(target.dataset.snapX), Number(target.dataset.snapY)], text:target.textContent };
  })()`
    );
  const snapProbe = async (
    kind,
    target,
    base = [-60, -30],
    pixelOffset = [3, 0]
  ) => {
    await onlySnap(kind);
    await choose();
    await enter(base.join(","));
    const position = await hover(target, pixelOffset);
    const preview = await readSnap();
    expect(
      preview?.kind === kind &&
        equalPoint(preview.point, target, kind === "extension" ? 1e-4 : 1e-10),
      `${kind} target ${JSON.stringify(target)}: ${JSON.stringify(preview)}`
    );
    expect(Boolean(preview.text?.trim()), kind + " needs a visible label");
    const displayedEnd = await evaluate(
      view,
      `(() => {
      const shape = document.querySelector('[data-drawing-preview]');
      return shape && [Number(shape.dataset.endX), Number(shape.dataset.endY)];
    })()`
    );
    expect(
      JSON.stringify(displayedEnd) === JSON.stringify(preview.point),
      kind + " geometry preview differs from snap marker"
    );
    const count = (await getState(view)).drawing.entities.length;
    await view.click(position.x, position.y);
    const entity = (await settle(count + 1)).entities.at(-1);
    expect(
      JSON.stringify(entity.end) === JSON.stringify(preview.point),
      kind + " preview and commit differ"
    );
    expect(equalPoint(entity.start, base), kind + " changed the typed anchor");
    await undo(count);
  };

  expect(
    (
      await evaluate(
        view,
        'document.querySelector(".drawing-workspace").textContent'
      )
    ).includes("World XY"),
    "working frame is not visible"
  );
  // Canvas Enter focuses coordinates; Enter on the Set point button still submits.
  await choose();
  const keyboardAnchor = await hover([-60, -30], [0, 0]);
  await view.click(keyboardAnchor.x, keyboardAnchor.y);
  await view.press("Enter");
  expect(
    await evaluate(
      view,
      'document.activeElement?.matches("[data-drawing-coordinate]")'
    ),
    "canvas Enter did not focus coordinate input"
  );
  await typeField(view, coordinate, "@5,5");
  await view.press("Tab");
  expect(
    await evaluate(
      view,
      'document.activeElement?.matches(".drawing-point-entry button")'
    ),
    "Tab did not reach Set point"
  );
  await view.press("Enter");
  const keyboardLine = (await settle(initial.entities.length + 1)).entities.at(
    -1
  );
  expect(
    equalPoint(keyboardLine.end, [-55, -25]),
    "keyboard Set point did not submit"
  );
  await undo(initial.entities.length);

  // Typed values override active object snaps, preserve fractions and convert units.
  for (const [a, b, start, end] of [
    [
      "0.123456789,0.987654321",
      "@2.5,-0.5",
      [0.123456789, 0.987654321],
      [2.623456789, 0.487654321]
    ],
    ["1in,2cm", "@5mm<90", [25.4, 20], [25.4, 25]],
    ["10<180", "@2.5cm<0", [-10, 0], [15, 0]],
    ["1e1mm,-2e1mm", "40.01,30.01", [10, -20], [40.01, 30.01]]
  ]) {
    const line = await create(a, b);
    expect(
      equalPoint(line.start, start) && equalPoint(line.end, end),
      "typed coordinate mismatch: " + JSON.stringify(line)
    );
    await undo(initial.entities.length);
  }

  // Rejected input must preserve a real redo stack as well as source/history.
  await choose();
  const beforeInvalid = (await getState(view)).drawing;
  for (const text of ["@5,2", "12", "1ft,2", "1e999,2", "2,", "-10<30"]) {
    await enter(text);
    expect(
      await evaluate(
        view,
        `document.querySelector(${JSON.stringify(coordinate)})?.getAttribute('aria-invalid') === 'true'`
      ),
      "missing input error for " + text
    );
    expect(
      JSON.stringify((await getState(view)).drawing) ===
        JSON.stringify(beforeInvalid),
      "invalid coordinate altered source or history: " + text
    );
  }
  await view.press("Escape");
  expect(
    !(await evaluate(
      view,
      'Boolean(document.querySelector("[data-drawing-preview]"))'
    )),
    "Escape retained a preview"
  );

  await snapProbe("endpoint", [40, 30]);
  await snapProbe("endpoint", [10, -40]);
  await snapProbe("midpoint", [20, 15]);
  await snapProbe("midpoint", [25, -20]);
  await snapProbe("center", [-30, 20]);
  await snapProbe("quadrant", [-20, 20]);
  await snapProbe("perpendicular", [12.8, 9.6], [20, 0]);
  await snapProbe("tangent", [-25, 20 + Math.sqrt(75)], [-10, 20]);
  await snapProbe("extension", [48, 36], [-60, -30], [3, 4]);

  await create("-10,15", "30,15");
  await snapProbe("intersection", [20, 15]);
  await undo(initial.entities.length);
  await create("-45,20", "-15,20");
  await snapProbe("intersection", [-40, 20]);
  await undo(initial.entities.length);
  await create("-20,20", "-10,20", "circle");
  await snapProbe("intersection", [-25, 20 + Math.sqrt(75)]);
  await undo(initial.entities.length);

  // Acquisition is measured in CSS pixels, even with viewBox letterboxing/zoom.
  await onlySnap("endpoint");
  for (const zoom of ["Zoom in drawing", "Zoom out drawing"]) {
    await clickVisibleControl(view, `button[aria-label="${zoom}"]`);
    await choose();
    await enter("-60,-30");
    await hover([40, 30], [4, 0]);
    expect(
      (await readSnap())?.kind === "endpoint",
      "endpoint not acquired within pixel tolerance after " + zoom
    );
    await hover([40, 30], [24, 0]);
    expect(
      !(await readSnap()),
      "endpoint acquired outside pixel tolerance after " + zoom
    );
  }
  await onlySnap("tangent");
  await choose();
  await enter("-30,20");
  await hover([-20, 20]);
  expect(!(await readSnap()), "tangent acquired from inside its circle");
  await choose();
  await hover([-25, 20 + Math.sqrt(75)]);
  expect(!(await readSnap()), "tangent acquired without a base point");

  // Hover + Space acquires a tracking origin through the focused canvas.
  await onlySnap("endpoint");
  await checkbox("Object tracking", true);
  await choose();
  const anchorPosition = await hover([-60, -30], [0, 0]);
  await view.click(anchorPosition.x, anchorPosition.y);
  await hover([40, 30]);
  await view.press("Space");
  const trackedPosition = await hover([60, 30], [0, 3]);
  const trackedPreview = await readSnap();
  expect(
    trackedPreview?.kind === "tracking" &&
      equalPoint(trackedPreview.point, [60, 30], 1e-4),
    "acquired point did not produce tracking guide"
  );
  await view.click(trackedPosition.x, trackedPosition.y);
  const trackedLine = (await settle(initial.entities.length + 1)).entities.at(
    -1
  );
  expect(
    JSON.stringify(trackedLine.end) === JSON.stringify(trackedPreview.point),
    "tracking preview/commit differ"
  );
  await undo(initial.entities.length);

  // Tab chooses the alternate target without moving the pointer or changing it on click.
  await onlySnap("endpoint");
  await clickVisibleControl(view, settings + " > summary");
  await checkbox("Snap extension", true);
  await clickVisibleControl(view, settings + " > summary");
  await choose();
  const cycleAnchor = await hover([-60, -30], [0, 0]);
  await view.click(cycleAnchor.x, cycleAnchor.y);
  const cyclePosition = await hover([40, 30], [3, -2]);
  const beforeCycle = await readSnap();
  expect(
    ["endpoint", "extension"].includes(beforeCycle?.kind),
    "ambiguous target did not expose endpoint or extension"
  );
  await view.press("Tab");
  const afterCycle = await readSnap();
  expect(
    ["endpoint", "extension"].includes(afterCycle?.kind) &&
      afterCycle.kind !== beforeCycle.kind &&
      JSON.stringify(afterCycle.point) !== JSON.stringify(beforeCycle.point),
    "Tab did not select the other distinct target"
  );
  const cycleEnd = await evaluate(
    view,
    `(() => {
    const shape = document.querySelector('[data-drawing-preview]');
    return shape && [Number(shape.dataset.endX), Number(shape.dataset.endY)];
  })()`
  );
  expect(
    JSON.stringify(cycleEnd) === JSON.stringify(afterCycle.point),
    "cycled target and geometry preview differ"
  );
  await view.click(cyclePosition.x, cyclePosition.y);
  const cycledLine = (await settle(initial.entities.length + 1)).entities.at(
    -1
  );
  expect(
    JSON.stringify(cycledLine.end) === JSON.stringify(afterCycle.point),
    "click did not commit the cycled target"
  );
  await undo(initial.entities.length);

  await checkbox("Object snaps", false);
  await choose();
  await hover([40, 30], [2, 0]);
  expect(!(await readSnap()), "object snaps off still displays a target");
  const unsnappedTyped = await create("40.000123,30.000456", "@0.125,0.25");
  expect(
    equalPoint(unsnappedTyped.start, [40.000123, 30.000456]) &&
      equalPoint(unsnappedTyped.end, [40.125123, 30.250456]),
    "snaps-off typed coordinates lost precision"
  );
  await undo(initial.entities.length);
  await checkbox("Object snaps", true);

  // A rotated/translated working frame affects both absolute and relative input.
  await clickVisibleControl(view, ".drawing-frame-settings > summary");
  await selectCollectorOption(view, {
    selector: 'select[aria-label="Drawing frame"]',
    option: "custom"
  });
  await typeField(view, 'input[aria-label="Frame origin X"]', "10");
  await typeField(view, 'input[aria-label="Frame origin Y"]', "20");
  await typeField(view, 'input[aria-label="Frame angle"]', "90");
  await clickVisibleControl(
    view,
    ".drawing-workspace button[data-drawing-frame-apply]"
  );
  const framed = await create("2,3", "@4,0");
  expect(
    equalPoint(framed.start, [7, 22]) && equalPoint(framed.end, [7, 26]),
    "custom frame coordinates mismatch"
  );
  await undo(initial.entities.length);
  await selectCollectorOption(view, {
    selector: 'select[aria-label="Drawing frame"]',
    option: "world"
  });
  await clickVisibleControl(view, "[data-drawing-frame-apply]");
  await clickVisibleControl(view, ".drawing-frame-settings > summary");

  // Unit-bearing scalar editing uses the same visible property fields.
  await choose("select");
  const originalCircle = initial.entities.find(
    (entity) => entity.kind === "circle"
  );
  await clickVisibleControl(
    view,
    `[data-drawing-select="${originalCircle.id}"]`
  );
  await typeField(view, '[data-drawing-field="radius"]', "1in");
  await clickVisibleControl(view, "[data-drawing-apply]");
  const editedCircle = (
    await settle(
      initial.entities.length,
      (drawing) =>
        drawing.entities.find((entity) => entity.id === originalCircle.id)
          ?.radius === 25.4
    )
  ).entities.find((entity) => entity.id === originalCircle.id);
  expect(
    editedCircle.radius === 25.4,
    "unit-bearing radius edit did not convert inches to millimeters"
  );
  expect(
    JSON.stringify(
      (
        await undo(
          initial.entities.length,
          (drawing) =>
            JSON.stringify(drawing.entities) ===
            JSON.stringify(initial.entities)
        )
      ).entities
    ) === JSON.stringify(initial.entities),
    "radius edit Undo did not restore original fixture"
  );

  // Keep an irrational tangent target and fractional anchor through real native I/O.
  await onlySnap("tangent");
  await choose();
  const preciseAnchor = [-10.125, 20.125];
  await enter(preciseAnchor.join(","));
  const dx = preciseAnchor[0] + 30,
    dy = preciseAnchor[1] - 20;
  const distance = Math.hypot(dx, dy),
    ratio = 10 / distance;
  const tangentHeight = 10 * Math.sqrt((1 - ratio) * (1 + ratio));
  const tangentTarget = [
    -30 + (dx / distance) * 10 * ratio - (dy / distance) * tangentHeight,
    20 + (dy / distance) * 10 * ratio + (dx / distance) * tangentHeight
  ];
  const precisePosition = await hover(tangentTarget);
  const precisePreview = await readSnap();
  expect(
    precisePreview?.kind === "tangent" &&
      equalPoint(precisePreview.point, tangentTarget),
    "fractional-anchor tangent preview mismatch"
  );
  await writeUseScreenshot(view, "drawing-precision-tangent-preview");
  await view.click(precisePosition.x, precisePosition.y);
  const preciseDrawing = await settle(initial.entities.length + 1);
  const preciseLine = preciseDrawing.entities.at(-1);
  expect(
    JSON.stringify(preciseLine.start) === JSON.stringify(preciseAnchor) &&
      JSON.stringify(preciseLine.end) === JSON.stringify(precisePreview.point),
    "precise line changed on commit"
  );
  const precisionFile = ".metrics/editable-interchange/precision.wcad";
  await saveProjectFile(view, precisionFile);
  await withDeadline(
    view.navigate(await evaluate(view, "location.href")),
    60_000,
    "reload precision drawing"
  );
  await waitForHook(view);
  await openProjectFile(view, precisionFile);
  await clickVisibleControl(view, '[data-ribbon-roving-id="mode-drawing"]');
  const reopenedPrecision = await settle(preciseDrawing.entities.length);
  expect(
    isDeepStrictEqual(reopenedPrecision, preciseDrawing),
    "native reopen changed precise coordinates, identity, or history: " +
      JSON.stringify({ before: preciseDrawing, after: reopenedPrecision })
  );
  const undonePrecision = await undo(initial.entities.length);
  expect(
    isDeepStrictEqual(undonePrecision.entities, initial.entities),
    "native Undo changed original geometry"
  );
  await clickVisibleControl(view, 'button[aria-label="Redo"]');
  expect(
    isDeepStrictEqual(
      await settle(preciseDrawing.entities.length),
      preciseDrawing
    ),
    "native Redo did not restore exact precise drawing"
  );

  const waitUnits = async (units) => {
    const deadline = performance.now() + 10_000;
    let drawing;
    do {
      drawing = await settle(preciseDrawing.entities.length);
      if (drawing.units === units) return drawing;
      await delay(30);
    } while (performance.now() < deadline);
    throw new Error("Drawing precision units did not settle to " + units);
  };
  await selectCollectorOption(view, {
    selector: 'select[aria-label="Drawing units"]',
    option: "cm"
  });
  const centimeters = await waitUnits("cm");
  for (const [index, entity] of centimeters.entities.entries()) {
    const original = preciseDrawing.entities[index];
    expect(entity.id === original.id, "unit conversion changed identity");
    if (entity.kind === "circle")
      expect(
        equalPoint(
          entity.center,
          original.center.map((n) => n / 10)
        ) && Math.abs(entity.radius - original.radius / 10) < 1e-10,
        "circle physical size changed"
      );
    else
      expect(
        equalPoint(
          entity.start,
          original.start.map((n) => n / 10)
        ) &&
          equalPoint(
            entity.end,
            original.end.map((n) => n / 10)
          ),
        "line/rectangle physical size changed"
      );
  }
  // Undo restores stored coordinates bit for bit, including the tangent ordinate.
  await clickVisibleControl(view, 'button[aria-label="Undo"]');
  expect(
    isDeepStrictEqual(
      (await waitUnits("mm")).entities,
      preciseDrawing.entities
    ),
    "unit Undo changed precise coordinates"
  );
  await undo(initial.entities.length);

  // Restore defaults and fixture source before the remainder of interchange.
  await choose("select");
  await clickVisibleControl(view, settings + " > summary");
  for (const kind of kinds) await checkbox("Snap " + kind, true);
  await checkbox("Object tracking", true);
  await clickVisibleControl(view, settings + " > summary");
  expect(
    isDeepStrictEqual(
      (await getState(view)).drawing.entities,
      initial.entities
    ),
    "precision probes changed original drawing fixture"
  );
  console.log(
    "Drawing precision: typed coordinates, frame, eight exact snaps, tracking, cycling, pixel tolerance, rejection/history, precise native round trip passed"
  );
}

async function exerciseDrawingLayers(view) {
  const initial = (await getState(view)).drawing;
  const expect = (condition, message) => {
    if (!condition) throw new Error("Drawing layers: " + message);
  };
  const settle = async (predicate) => {
    const deadline = performance.now() + 10_000;
    do {
      const state = await getState(view);
      if (state.commandError) throw new Error(state.commandError);
      if (!state.commandPending && predicate(state.drawing))
        return state.drawing;
      await delay(30);
    } while (performance.now() < deadline);
    throw new Error("Drawing layer change did not settle");
  };
  const select = (label, option) =>
    selectCollectorOption(view, {
      selector: `select[aria-label="${label}"]`,
      option
    });
  const check = async (label, value) => {
    const selector = `input[aria-label="Layer ${label}"]`;
    if (
      (await evaluate(
        view,
        `document.querySelector(${JSON.stringify(selector)}).checked`
      )) !== value
    )
      await clickVisibleControl(view, selector);
  };
  await typeField(view, 'input[aria-label="New layer name"]', "Manufacturing");
  await clickVisibleControl(view, "[data-layer-create]");
  const created = await settle(
    (drawing) => drawing.layers.length === initial.layers.length + 1
  );
  const layerId = created.layers.find(
    (layer) => layer.name === "Manufacturing"
  ).id;
  await typeField(view, 'input[aria-label="New layer name"]', "Manufacturing");
  expect(
    await evaluate(
      view,
      'document.querySelector("[data-layer-create]").disabled'
    ),
    "duplicate name must be blocked"
  );
  await typeField(view, 'input[aria-label="New layer name"]', "");
  await typeField(view, 'input[aria-label="Layer color"]', "#ff8844");
  await typeField(view, 'input[aria-label="Layer lineweight"]', "0.7");
  await typeField(view, 'input[aria-label="Layer transparency"]', "25");
  await select("Layer linetype", "dashed");
  await check("print", false);
  await clickVisibleControl(view, "[data-layer-apply]");
  await settle(
    (drawing) =>
      drawing.layers.find((layer) => layer.id === layerId)?.color === "#ff8844"
  );
  await clickVisibleControl(view, '[data-drawing-tool="select"]');
  const entity = initial.entities[0];
  await clickVisibleControl(view, `[data-drawing-select="${entity.id}"]`);
  await select("Selected entity layer", layerId);
  await settle(
    (drawing) =>
      drawing.entities.find((item) => item.id === entity.id).layerId === layerId
  );
  const rendered = await evaluate(
    view,
    `(() => {const g=document.querySelector('[data-drawing-entity="${entity.id}"]');const shape=g.lastElementChild;return {color:shape.getAttribute('stroke'),weight:Number(shape.getAttribute('stroke-width')),dash:shape.getAttribute('stroke-dasharray'),opacity:Number(g.getAttribute('opacity')),print:g.getAttribute('data-layer-printable')};})()`
  );
  expect(
    rendered.color === "#ff8844" &&
      Math.abs(rendered.weight - (0.7 * 96) / 25.4) < 1e-8 &&
      rendered.dash === "10 5" &&
      rendered.opacity === 0.75 &&
      rendered.print === "false",
    "layer style must reach the visible entity: " + JSON.stringify(rendered)
  );
  expect(
    await evaluate(
      view,
      'document.querySelector("[data-layer-delete]").disabled'
    ),
    "assigned layer deletion must be blocked"
  );
  await view.cdp("Emulation.setEmulatedMedia", { media: "print" });
  expect(
    await evaluate(
      view,
      `getComputedStyle(document.querySelector('[data-drawing-entity="${entity.id}"]')).display === 'none'`
    ),
    "nonprinting layer must be excluded from print output"
  );
  await view.cdp("Emulation.setEmulatedMedia", { media: "screen" });
  await clickVisibleControl(view, '[data-drawing-tool="line"]');
  await typeField(view, '[data-drawing-field="x"]', "150");
  await typeField(view, '[data-drawing-field="endX"]', "170");
  await clickVisibleControl(view, "[data-drawing-apply]");
  const drawn = await settle(
    (drawing) => drawing.entities.length === initial.entities.length + 1
  );
  expect(
    drawn.entities.at(-1).layerId === layerId,
    "new geometry must use current layer"
  );
  await clickVisibleControl(view, '[data-drawing-tool="dimension"]');
  await clickVisibleControl(view, "[data-dimension-apply]");
  const dimensionDrawing = await settle(
    (drawing) => drawing.entities.length === initial.entities.length + 2
  );
  const dimension = dimensionDrawing.entities.at(-1);
  expect(
    dimension.kind === "dimension" && dimension.layerId === layerId,
    "new dimension must use current layer"
  );
  expect(
    await evaluate(
      view,
      `getComputedStyle(document.querySelector('[data-drawing-dimension="${dimension.id}"] text')).fill === 'rgb(255, 136, 68)'`
    ),
    "dimension must inherit layer color"
  );
  await clickVisibleControl(view, '[data-drawing-tool="select"]');
  await clickVisibleControl(view, `[data-drawing-select="${entity.id}"]`);
  await check("locked", true);
  await clickVisibleControl(view, "[data-layer-apply]");
  await settle(
    (drawing) => drawing.layers.find((layer) => layer.id === layerId).locked
  );
  expect(
    await evaluate(
      view,
      'document.querySelector("[data-drawing-delete]").disabled && document.querySelector("[data-drawing-apply]").disabled'
    ),
    "locked entity edit/delete must be blocked"
  );
  await clickVisibleControl(view, '[data-drawing-tool="line"]');
  expect(
    await evaluate(
      view,
      'document.querySelector("[data-drawing-apply]").disabled'
    ),
    "locked current layer creation must be blocked"
  );
  await clickVisibleControl(view, '[data-drawing-tool="select"]');
  await clickVisibleControl(view, `[data-drawing-select="${dimension.id}"]`);
  expect(
    await evaluate(
      view,
      'document.querySelector("[data-dimension-apply]").disabled && document.querySelector("[data-drawing-delete]").disabled'
    ),
    "locked dimension edit/delete must be blocked"
  );
  await check("visible", false);
  await clickVisibleControl(view, "[data-layer-apply]");
  await settle(
    (drawing) => !drawing.layers.find((layer) => layer.id === layerId).visible
  );
  expect(
    !(await evaluate(
      view,
      `Boolean(document.querySelector('[data-drawing-entity="${entity.id}"]'))`
    )),
    "hidden layer geometry must disappear"
  );
  await clickVisibleControl(view, 'button[aria-label="Undo"]');
  await settle(
    (drawing) => drawing.layers.find((layer) => layer.id === layerId).visible
  );
  expect(
    await evaluate(
      view,
      `Boolean(document.querySelector('[data-drawing-entity="${entity.id}"]'))`
    ),
    "Undo must restore visibility"
  );
  await clickVisibleControl(view, 'button[aria-label="Redo"]');
  const saved = await settle(
    (drawing) => !drawing.layers.find((layer) => layer.id === layerId).visible
  );
  const path = ".metrics/editable-interchange/layers.wcad";
  await saveProjectFile(view, path);
  await withDeadline(
    view.navigate(await evaluate(view, "location.href")),
    60_000,
    "reload layer drawing"
  );
  await waitForHook(view);
  await openProjectFile(view, path);
  await clickVisibleControl(view, '[data-ribbon-roving-id="mode-drawing"]');
  const reopened = await settle((drawing) =>
    drawing.layers.some((layer) => layer.id === layerId)
  );
  expect(
    isDeepStrictEqual(reopened, saved),
    "native reopen must preserve all properties, assignment and history"
  );
  await select("Layer properties", layerId);
  await typeField(view, 'input[aria-label="Layer transparency"]', "91");
  expect(
    await evaluate(
      view,
      'document.querySelector("[data-layer-apply]").disabled'
    ),
    "invalid transparency must be blocked"
  );
  expect(
    isDeepStrictEqual((await getState(view)).drawing, reopened),
    "invalid layer draft must preserve history"
  );
  await writeUseScreenshot(view, "drawing-layers-invalid");
  await typeField(view, 'input[aria-label="Layer transparency"]', "25");
  await check("visible", true);
  await check("locked", false);
  await clickVisibleControl(view, "[data-layer-apply]");
  await settle(
    (drawing) => !drawing.layers.find((layer) => layer.id === layerId).locked
  );
  await clickVisibleControl(view, `[data-drawing-select="${entity.id}"]`);
  await writeUseScreenshot(view, "drawing-layers-properties");
  // Undo from the reopened native history back to the shared fixture.
  while ((await getState(view)).drawing.historyCount > initial.historyCount) {
    const previous = (await getState(view)).drawing.historyCount;
    await clickVisibleControl(view, 'button[aria-label="Undo"]');
    await settle((drawing) => drawing.historyCount < previous);
  }
  const restored = (await getState(view)).drawing;
  expect(
    isDeepStrictEqual(restored.entities, initial.entities) &&
      isDeepStrictEqual(restored.layers, initial.layers),
    "Undo must restore original layers and assignments"
  );
  console.log(
    "Drawing layers UI: create, assignment, appearance, lock, visibility, print, invalid properties, Undo/Redo and native history passed"
  );
}

async function runUseSteps(view, name, steps, label) {
  let sawScreenshot = false;
  let sawBreak = false;
  const clicks = [];
  let rememberedDrawingIds;
  for (const step of steps) {
    if (step.drawingDimensions) {
      await exerciseDrawingDimensions(view, {
        evaluate,
        getState,
        delay,
        clickVisibleControl,
        typeField,
        selectCollectorOption,
        saveProjectFile,
        openProjectFile,
        waitForHook,
        writeUseScreenshot
      });
      clicks.push("Associative drawing dimension controls");
      continue;
    }
    if (step.drawingLayers) {
      await exerciseDrawingLayers(view);
      clicks.push("Drawing layer controls");
      continue;
    }
    if (step.drawingPrecision) {
      await exerciseDrawingPrecision(view);
      clicks.push("Drawing precision controls");
      continue;
    }
    if (step.press) {
      await withDeadline(
        view.press(step.press),
        7_000,
        "keyboard " + step.press
      );
      continue;
    }
    if (step.clickDrawing) {
      const [x, y] = step.clickDrawing;
      const position = await evaluate(
        view,
        `(() => { const canvas = document.querySelector('svg[aria-label="2D drawing canvas"]'); const p = new DOMPoint(${x}, ${-y}).matrixTransform(canvas.getScreenCTM()); return {x:p.x,y:p.y}; })()`
      );
      await view.click(position.x, position.y);
      clicks.push("2D drawing canvas");
      continue;
    }
    if (step.rememberDrawingIds) {
      rememberedDrawingIds = (await getState(view)).drawing.entities.map(
        (entity) => entity.id
      );
      continue;
    }
    if (step.expectDrawing) {
      const deadline = performance.now() + 10_000;
      let state;
      let visible;
      do {
        state = await getState(view);
        visible = await evaluate(
          view,
          'document.querySelectorAll("svg [data-drawing-entity]").length'
        );
        if (state.commandError)
          throw new Error("Drawing command failed: " + state.commandError);
        if (
          !state.commandPending &&
          visible === state.drawing.entities.length &&
          matches(state.drawing, step.expectDrawing, true, 1e-6)
        )
          break;
        await delay(50);
      } while (performance.now() < deadline);
      if (!matches(state.drawing, step.expectDrawing, true, 1e-6))
        throw new Error("Drawing mismatch: " + JSON.stringify(state.drawing));
      if (
        step.sameDrawingIds &&
        JSON.stringify(state.drawing.entities.map((entity) => entity.id)) !==
          JSON.stringify(rememberedDrawingIds)
      )
        throw new Error(
          "Drawing entity identity changed after history/native round trip"
        );
      if (visible !== state.drawing.entities.length)
        throw new Error("Drawing entities are missing from the visible canvas");
      continue;
    }
    if (process.env.PARTBENCH_SMOKE_UI_DIAGNOSTICS === "1")
      console.log(name + " " + label + " step", JSON.stringify(step));
    if (step.reload) {
      await withDeadline(
        view.navigate(await evaluate(view, "location.href")),
        60_000,
        "reopen workbench"
      );
      await waitForHook(view);
      continue;
    }
    if (step.saveWcad) {
      await saveProjectFile(view, step.saveWcad);
      if (step.compareNative) {
        await assertNativeCheckpointParity(
          resolve(repoRoot, step.saveWcad),
          resolve(repoRoot, step.compareNative)
        );
        console.log("Native checkpoint parity", step.compareNative);
      }
      continue;
    }
    if (step.openWcad) {
      clicks.push('[data-action-id="project.open"]');
      await openProjectFile(view, step.openWcad);
      continue;
    }
    if (step.expectOccurrenceSelection) {
      const state = await getState(view);
      if (!state.selectedOccurrence?.exactReady)
        throw new Error(
          "The canvas did not select an occurrence with ready exact identity"
        );
      console.log(
        "exact occurrence selected",
        JSON.stringify(state.selectedOccurrence)
      );
      continue;
    }
    if (step.importStep) {
      clicks.push('[data-action-id="project.import-step"]');
      await openProjectFile(
        view,
        step.importStep,
        "step",
        step.expectImportError,
        step.cancelImport,
        step.maxUsableViewMs,
        step.expectPreviewSolids,
        step.maxExactSelectionMs ?? step.exactSelectionBudgetMs,
        step.maxExactSelectionMs !== undefined ||
          process.env.PARTBENCH_SMOKE_REQUIRE_EXACT_BUDGET === "1"
      );
      if (step.expectImportError || step.cancelImport) sawBreak = true;
      continue;
    }
    if (step.expectText) {
      const { selector, text, includes } = step.expectText;
      const textMatches = (actual) =>
        typeof includes === "string"
          ? typeof actual === "string" && actual.includes(includes)
          : actual === text;
      const deadline = performance.now() + 10_000;
      let actual;
      do {
        actual = await evaluate(
          view,
          "document.querySelector(" +
            JSON.stringify(selector) +
            ")?.textContent?.trim()"
        );
        if (textMatches(actual)) break;
        await delay(50);
      } while (performance.now() < deadline);
      if (!textMatches(actual))
        throw new Error(
          name +
            " expected text " +
            JSON.stringify(includes ?? text) +
            ", got " +
            JSON.stringify(actual)
        );
      continue;
    }
    if (step.expectExactVolume) {
      const { bodyId, volume } = step.expectExactVolume;
      const deadline = performance.now() + 10_000;
      let actual;
      let matched = false;
      do {
        const state = await getState(view);
        if (state.commandError || isTerminalFailure(state))
          throw new Error(name + " exact result failed: " + state.diagnostic);
        actual = state.exactMeasurements?.find(
          (body) => body.bodyId === bodyId
        )?.volume;
        if (
          isExactDisplayReady(state, false) &&
          Number.isFinite(actual) &&
          Math.abs(actual - volume) <= 1e-6
        ) {
          matched = true;
          break;
        }
        await delay(50);
      } while (performance.now() < deadline);
      if (!matched)
        throw new Error(
          name +
            " expected exact volume " +
            volume +
            " for " +
            bodyId +
            ", got " +
            actual
        );
      continue;
    }
    if (step.orbit) {
      await waitForReady(view, {
        timeoutMs: readyTimeoutMs,
        allowEmpty: false
      });
      const rect = await evaluate(
        view,
        `(() => {
        const canvas=document.querySelector('canvas[aria-label="3D scene viewport"]');
        const r=canvas.getBoundingClientRect();
        const monitor={times:[],active:true,frame:0,uploads:JSON.parse(document.querySelector('[data-render-layer="solid"]').dataset.gpuMetrics).uploads};
        const sample=t=>{if(!monitor.active)return;monitor.times.push(t);monitor.frame=requestAnimationFrame(sample);};
        monitor.frame=requestAnimationFrame(sample);window.__pbOrbitMonitor=monitor;
        return {x:r.x+r.width*0.4,y:r.y+r.height*0.45,width:r.width,height:r.height};
      })()`
      );
      const dispatch = (params) =>
        withDeadline(
          view.cdp("Input.dispatchMouseEvent", params),
          7_000,
          "viewport orbit input"
        );
      await dispatch({
        type: "mousePressed",
        x: rect.x,
        y: rect.y,
        button: "left",
        buttons: 1,
        clickCount: 1
      });
      for (let i = 1; i <= 18; i++) {
        await dispatch({
          type: "mouseMoved",
          x: rect.x + (rect.width * 0.25 * i) / 18,
          y: rect.y + (rect.height * 0.15 * i) / 18,
          button: "left",
          buttons: 1
        });
        await evaluate(
          view,
          "new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))"
        );
      }
      await dispatch({
        type: "mouseReleased",
        x: rect.x + rect.width * 0.25,
        y: rect.y + rect.height * 0.15,
        button: "left",
        buttons: 0,
        clickCount: 1
      });
      const evidence = await evaluate(
        view,
        `(() => {
        const m=window.__pbOrbitMonitor;m.active=false;cancelAnimationFrame(m.frame);delete window.__pbOrbitMonitor;
        const intervals=m.times.slice(1).map((t,i)=>t-m.times[i]).sort((a,b)=>a-b);
        const metrics=JSON.parse(document.querySelector('[data-render-layer="solid"]').dataset.gpuMetrics);
        return {frames:m.times.length,medianFrameIntervalMs:intervals[Math.floor(intervals.length/2)],p95FrameIntervalMs:intervals[Math.floor(intervals.length*0.95)],uploadsBefore:m.uploads,metrics};
      })()`
      );
      if (
        evidence.frames < 18 ||
        evidence.uploadsBefore !== evidence.metrics.uploads
      )
        throw new Error(
          "Orbit rebuilt geometry or did not produce frames: " +
            JSON.stringify(evidence)
        );
      console.log(name + " native orbit " + JSON.stringify(evidence));
      clicks.push("canvas orbit");
      continue;
    }
    if (step.clickCanvas) {
      await waitForReady(view, {
        timeoutMs: readyTimeoutMs,
        allowEmpty: false
      });
      const rect = await evaluate(
        view,
        "(() => {const r=document.querySelector('canvas[aria-label=\"3D scene viewport\"]').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};})()"
      );
      const { x, y } = step.clickCanvas;
      if (
        !Number.isFinite(x) ||
        !Number.isFinite(y) ||
        x < 0 ||
        x > 1 ||
        y < 0 ||
        y > 1
      )
        throw new Error("clickCanvas needs normalized x/y in [0,1]");
      await view.click(rect.x + rect.width * x, rect.y + rect.height * y);
      clicks.push('canvas[aria-label="3D scene viewport"]');
      continue;
    }
    if (step.click) {
      clicks.push(step.click);
      await clickVisibleControl(view, step.click);
      continue;
    }
    if (step.wait) {
      await waitForSelector(view, step.wait, 15_000);
      continue;
    }
    if (step.select) {
      const spec =
        typeof step.select === "string"
          ? { selector: step.select }
          : step.select;
      const result = await selectCollectorOption(view, spec);
      console.log(name + " " + label + " select", JSON.stringify(result));
      continue;
    }
    if (step.type) {
      const selector =
        typeof step.type === "string" ? step.type : step.type.selector;
      const text = typeof step.type === "string" ? "" : (step.type.text ?? "");
      await waitForSelector(view, selector, 15_000);
      await typeField(view, selector, text);
      continue;
    }
    if (step.apply) {
      const selector =
        typeof step.apply === "string" ? step.apply : '[data-ui-smoke="apply"]';
      await waitForSelector(view, selector + ":not([disabled])", 15_000);
      await clickVisibleControl(view, selector);
      continue;
    }
    if (step.expectNoPreview) {
      // Flush the editor's React effects before checking that a non-feature
      // draft neither schedules an exact preview nor reports a preview error.
      await evaluate(
        view,
        "new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))"
      );
      await assertNoErrorToast(view, name + " " + label);
      const message = await evaluate(
        view,
        "document.querySelector('.pb-feature-editor .pb-solid-field-note[aria-live]')?.textContent?.trim()"
      );
      if (message !== "")
        throw new Error(
          name + " unexpected preview feedback: " + JSON.stringify(message)
        );
      continue;
    }
    if (step.expectStructure) {
      await expectStructure(view, name + " " + label, step.expectStructure);
      continue;
    }
    if (step.expectViewport) {
      await waitForReady(view, {
        timeoutMs: readyTimeoutMs,
        allowEmpty: false
      });
      const deadline = performance.now() + 10_000;
      let state;
      do {
        state = await getState(view);
        if (state.commandError || isTerminalFailure(state))
          throw new Error(name + " viewport failed: " + state.diagnostic);
        if (
          isExactDisplayReady(state, false) &&
          matches(state.viewport, step.expectViewport, true)
        )
          break;
        await delay(50);
      } while (performance.now() < deadline);
      if (
        !isExactDisplayReady(state, false) ||
        !matches(state.viewport, step.expectViewport, true)
      )
        throw new Error(
          name + " viewport mismatch: " + JSON.stringify(state.viewport)
        );
      continue;
    }
    if (step.beginExactStability) {
      await waitForReady(view, {
        timeoutMs: readyTimeoutMs,
        allowEmpty: false
      });
      await evaluate(
        view,
        `(() => {
        const api=window.__PARTBENCH_UI_SMOKE__;
        if(!api.getDisplayState)throw new Error('Display continuity hook unavailable');
        const initial=api.getDisplayState();
        const monitor={initial,samples:0,drops:[],active:true,frame:0};
        const inspect=()=>{
          if(!monitor.active)return;
          const current=api.getDisplayState();monitor.samples++;
          const ready=new Set(current.exactResults.filter(x=>x.status==='ready').map(x=>x.bodyId));
          const missing=initial.exactResults.filter(x=>x.status==='ready'&&!ready.has(x.bodyId)).map(x=>x.bodyId);
          if(missing.length||JSON.stringify(current.meshIds)!==JSON.stringify(initial.meshIds)||current.displayStatuses.some(s=>s!=='ready')) {
            if(monitor.drops.length<5)monitor.drops.push({sample:monitor.samples,missing,display:current.displayStatuses,meshIds:current.meshIds});
          }
          monitor.frame=requestAnimationFrame(inspect);
        };
        window.__PARTBENCH_EXACT_MONITOR__=monitor;inspect();return true;
      })()`
      );
      continue;
    }
    if (step.expectExactStability) {
      const result = await evaluate(
        view,
        `(() => {
        const monitor=window.__PARTBENCH_EXACT_MONITOR__;
        if(!monitor)throw new Error('Display continuity monitor was not started');
        monitor.active=false;cancelAnimationFrame(monitor.frame);delete window.__PARTBENCH_EXACT_MONITOR__;
        return {samples:monitor.samples,drops:monitor.drops};
      })()`
      );
      if (result.samples < 2 || result.drops.length)
        throw new Error(
          name + " exact display continuity failed: " + JSON.stringify(result)
        );
      console.log(
        name +
          " exact display continuity: " +
          result.samples +
          " frames, zero drops"
      );
      continue;
    }
    if (step.waitReady) {
      await waitForReady(view, {
        timeoutMs: readyTimeoutMs,
        allowEmpty: step.waitReady === "empty"
      });
      if (step.waitReady !== "empty") {
        const state = await getState(view);
        if (!state.bodies || state.bodies.length === 0) {
          throw new Error(
            name + " " + label + " did not create a visible solid."
          );
        }
      }
      continue;
    }
    if (step.expectGpu) {
      await waitForReady(view, {
        timeoutMs: readyTimeoutMs,
        allowEmpty: false
      });
      const gpu = await evaluate(
        view,
        `(() => {const canvas=document.querySelector('[data-render-layer="solid"]');return {backend:document.querySelector('canvas[aria-label="3D scene viewport"]')?.dataset.renderer,metrics:JSON.parse(canvas?.dataset.gpuMetrics??'null'),error:canvas?.dataset.gpuError};})()`
      );
      if (
        gpu.backend !== "webgl2" ||
        !gpu.metrics ||
        !matches(gpu.metrics, step.expectGpu, true)
      )
        throw new Error(name + " GPU display mismatch: " + JSON.stringify(gpu));
      console.log(name + " GPU display " + JSON.stringify(gpu));
      continue;
    }
    if (step.screenshot) {
      if (label === "use") await assertNoErrorToast(view, name + " " + label);
      await writeUseScreenshot(view, step.screenshot);
      sawScreenshot = true;
      continue;
    }
    if (step.expectDisabled) {
      await waitForControlState(view, step.expectDisabled, true, 8_000);
      await assertNotFrozen(view, name + " " + label);
      sawBreak = true;
      console.log(
        name + " " + label + " blocked control " + step.expectDisabled
      );
      continue;
    }
    if (step.expectBlocked) {
      const selector =
        typeof step.expectBlocked === "string"
          ? step.expectBlocked
          : '[data-ui-smoke="apply"]';
      await waitForControlState(view, selector, true, 8_000);
      await assertNotFrozen(view, name + " " + label);
      sawBreak = true;
      console.log(name + " " + label + " blocked control " + selector);
      continue;
    }
    throw new Error(
      name + " " + label + " unknown use step " + JSON.stringify(step)
    );
  }
  return { sawScreenshot, sawBreak, clicks };
}

async function runUsePath(view, name, scenario, freshPage) {
  if (!hasUse(scenario)) {
    throw new Error(
      name +
        " missing use block. Write clicks from the workbench before close. applyOps is not Use."
    );
  }
  if (!hasUseBreak(scenario)) {
    throw new Error(
      name +
        " missing useBreak. Close needs a break case (blocked control or structured fail, not a freeze)."
    );
  }
  await resetWorkbench(view);
  await applyUseSeedSetup(view, name, scenario);
  const success = await runUseSteps(view, name, scenario.use, "use");
  if (!success.sawScreenshot) {
    throw new Error(name + " use path needs a success screenshot.");
  }
  await assertUseOutcome(view, name, scenario, success.clicks);
  view = await freshPage();
  await applyUseSeedSetup(view, name, scenario);
  const broken = await runUseSteps(view, name, scenario.useBreak, "useBreak");
  if (!broken.sawBreak) {
    throw new Error(
      name +
        " useBreak must assert a blocked control or structured fail, not a freeze."
    );
  }
}

async function runScenario(view, loaded, useOnly, freshPage) {
  const { scenario, name } = loaded;
  if (useOnly) {
    await runUsePath(view, name, scenario, freshPage);
    return;
  }
  await resetWorkbench(view);
  if (Array.isArray(scenario.steps)) {
    await runCadopsScenario(view, name, scenario);
    return;
  }
  await runPromotionScenario(view, name, scenario);
}
async function main() {
  assertBunWebView();
  const chromePath = requireChrome();
  const cli = parseCli(process.argv.slice(2));
  const scenarios = selectScenarios(loadScenarios(cli.filters), cli);
  if (scenarios.length === 0) {
    throw new Error("No scenarios matched the smoke:ui filter.");
  }

  mkdirSync(screenshotDir, { recursive: true });
  const port = await getAvailablePort();
  const app = await startWorkbench(port);
  const appUrl = "http://127.0.0.1:" + port + "/?ui-smoke=1";
  let view;
  let passed = 0;
  const freshPage = async () => {
    if (view) view.close();
    view = createChromeWebView(chromePath);
    console.log("Opening workbench " + appUrl);
    try {
      await withDeadline(
        view.navigate(appUrl),
        60_000,
        "initial workbench navigation"
      );
      await view.cdp("Page.bringToFront");
      await waitForHook(view);
    } catch (error) {
      try {
        console.error(
          "Startup document",
          await evaluate(view, "document.body?.innerText?.slice(0, 4000)", 5000)
        );
      } catch {
        /* Startup may have failed before a document was available. */
      }
      await captureFailure(
        view,
        join(screenshotDir, "startup-failure.png"),
        "startup",
        String(error)
      );
      throw error;
    }
    return view;
  };

  try {
    await freshPage();
    const userAgent = await evaluate(view, "navigator.userAgent");
    assertChromium(userAgent);
    console.log("chrome " + chromePath);
    console.log("backend chrome (" + userAgent + ")");
    console.log("app " + appUrl);
    console.log("mode " + (cli.useOnly ? "use" : "engine"));
    console.log("scenarios " + scenarios.length);

    if (!cli.useOnly) {
      await clickApplyCollector(view);
    }

    for (const [index, loaded] of scenarios.entries()) {
      const id = loaded.scenario.id ?? loaded.name;
      const started = performance.now();
      try {
        if (index > 0) await freshPage();
        await runScenario(view, loaded, cli.useOnly, freshPage);
        console.log(
          "pass " +
            loaded.name +
            " " +
            id +
            " (" +
            ((performance.now() - started) / 1000).toFixed(1) +
            "s)"
        );
        passed += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const screenshotPath = join(
          screenshotDir,
          sanitizeFileToken(id) + ".png"
        );
        const diagnostic = await captureFailure(
          view,
          screenshotPath,
          id,
          message
        );
        console.error("fail " + loaded.name + " " + id);
        console.error(message);
        console.error("screenshot " + screenshotPath);
        console.error("diagnostic " + diagnostic);
        process.exitCode = 1;
      }
    }
  } finally {
    if (view) view.close();
    await app.close();
  }

  console.log(
    (cli.useOnly ? "ui-use" : "ui-smoke") +
      " passed " +
      passed +
      "/" +
      scenarios.length +
      " Chromium (not WebKit)"
  );
}
