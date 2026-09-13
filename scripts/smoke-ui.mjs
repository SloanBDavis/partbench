// bun+vite in-process; chrome via Bun.WebView
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
  const { createServer } = await import(
    pathToFileURL(
      resolve(repoRoot, "apps/web/node_modules/vite/dist/node/index.js")
    ).href
  );
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
      "Boolean(window.__PARTBENCH_UI_SMOKE__ && window.__PARTBENCH_UI_SMOKE__.ready)"
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
  if (!allowEmpty && bodies.length === 0) return false;
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
    // Persist round-trips are proven by scenarios-run; engine smoke has no export/import hook.
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
  expectedImportError
) {
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
      (isStep
        ? "window.__pbOriginalConfirm = window.confirm; window.__pbStepImportPreview = null; " +
          "window.confirm = message => { window.__pbStepImportPreview = String(message); return true; }; "
        : "") +
      "return true; })()"
  );
  const startedAt = performance.now();
  try {
    await clickVisibleControl(view, '[data-ribbon-roving-id="mode-project"]');
    await clickVisibleControl(view, '[data-action-id="' + actionId + '"]');
    try {
      await waitForReady(view, {
        timeoutMs: readyTimeoutMs,
        allowEmpty: false
      });
    } catch (error) {
      if (!expectedImportError) throw error;
      const state = await getState(view);
      if (!state.commandError?.includes(expectedImportError)) throw error;
      // An expected import failure legitimately sets rebuild=Update failed.
      // Require responsive browser evaluation and a settled command instead.
      const responsive = await evaluate(
        view,
        "Boolean(window.__PARTBENCH_UI_SMOKE__?.ready)",
        5_000
      );
      if (!responsive || state.commandPending) throw error;
      console.log("expected STEP import error", state.commandError);
      return;
    }
    if (expectedImportError) {
      throw new Error(
        "Import " + fileName + " did not report " + expectedImportError
      );
    }
    await assertNoErrorToast(view, "Open " + fileName);
  } finally {
    if (isStep) {
      const preview = await evaluate(
        view,
        "(() => { const preview = window.__pbStepImportPreview; window.confirm = window.__pbOriginalConfirm; " +
          "delete window.__pbOriginalConfirm; delete window.__pbStepImportPreview; return preview; })()"
      );
      console.log(
        "STEP import",
        JSON.stringify({
          fileName,
          elapsedMs: Math.round(performance.now() - startedAt),
          preview
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

async function runUseSteps(view, name, steps, label) {
  let sawScreenshot = false;
  let sawBreak = false;
  const clicks = [];
  for (const step of steps) {
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
      continue;
    }
    if (step.openWcad) {
      clicks.push('[data-action-id="project.open"]');
      await openProjectFile(view, step.openWcad);
      continue;
    }
    if (step.importStep) {
      clicks.push('[data-action-id="project.import-step"]');
      await openProjectFile(
        view,
        step.importStep,
        "step",
        step.expectImportError
      );
      if (step.expectImportError) sawBreak = true;
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
