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
  const argv = ["--disable-dev-shm-usage"];
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
    server: {
      host: "127.0.0.1",
      port,
      strictPort: true
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
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const ready = await evaluate(
      view,
      "Boolean(window.__PARTBENCH_UI_SMOKE__ && window.__PARTBENCH_UI_SMOKE__.ready)"
    );
    if (ready) return;
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
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
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

async function evaluate(view, expression) {
  return view.evaluate(expression);
}

function formatApplyError(error) {
  if (!error) return "unknown error";
  return error.code ? error.code + ": " + error.message : error.message;
}

function sanitizeFileToken(value) {
  return String(value).replace(/[^a-zA-Z0-9._-]+/g, "-");
}

function matches(actual, expected, exactArrays = false) {
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
      matches(actual[index], item, exactArrays)
    );
  }
  if (actual === null || typeof actual !== "object") {
    return false;
  }
  return Object.entries(expected).every(([key, value]) =>
    matches(actual[key], value, exactArrays)
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
    for (const result of exactResults) {
      if (
        result.status === "pending" ||
        result.status === "stale" ||
        result.status === "failed"
      ) {
        return false;
      }
    }
  } else {
    if (
      exact.some(
        (status) =>
          status === "pending" || status === "stale" || status === "failed"
      )
    ) {
      return false;
    }
  }
  const display = state.displayStatuses ?? [];
  if (display.some((status) => status === "pending")) {
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
  const deadline = Date.now() + timeoutMs;
  let last;
  let lastSig;
  while (Date.now() < deadline) {
    last = await getState(view);
    const sig =
      (last && last.rebuildState) + "|" + ((last && last.diagnostic) || "");
    if (sig !== lastSig) {
      lastSig = sig;
      console.log("wait", sig);
    }
    if (isExactDisplayReady(last, allowEmpty)) return last;
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
    "Timed out waiting for exact/display ready. rebuild=" +
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
  const state = await getState(view);
  for (const queryCase of step.queries ?? []) {
    if (queryCase.query?.query !== "project.structure" || !queryCase.expect) {
      continue;
    }
    const actual = state.structureQuery ?? {
      ok: true,
      query: "project.structure",
      features: state.features,
      bodies: state.bodies
    };
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
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
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
  try {
    const state = await getState(view);
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
    const png = await view.screenshot({ encoding: "buffer" });
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
  if (Array.isArray(scenario.seed) && scenario.seed.length > 0) {
    const seedResult = await applyOps(view, scenario.seed);
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
  }

  for (const step of scenario.steps ?? []) {
    // Persist round-trips are proven by scenarios-run; engine smoke has no export/import hook.
    if (
      step.persistRoundTrip &&
      (!Array.isArray(step.ops) || step.ops.length === 0)
    ) {
      continue;
    }
    const result = await applyOps(view, step.ops ?? []);
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
  await view.click(selector, { clickCount: 3, timeout: 5_000 });
  await view.press("Backspace");
  if (value) await view.type(value);
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
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
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
  await view.scrollTo(live, { block: "nearest", timeout: 5_000 });
  await view.click(live, { timeout: 5_000 });
}

async function selectCollectorOption(view, spec) {
  const selector = collectorSelectSelector(spec);
  const option = String(spec.option ?? spec.value ?? "");
  if (!option) {
    throw new Error("select step needs option");
  }
  await view.scrollTo(selector, { block: "nearest", timeout: 5_000 });
  const deadline = Date.now() + 15_000;
  let last;
  while (Date.now() < deadline) {
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
  if (!Array.isArray(scenario.seed) || scenario.seed.length === 0) {
    return;
  }
  // applyOps(seed) is workbench SETUP so Use can operate the claimed feature.
  // It is not Use. Use is the clicks/typed fields/Apply that follow.
  const seedResult = await applyOps(view, scenario.seed);
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
  const deadline = Date.now() + 10_000;
  let state;
  do {
    state = await getState(view);
    if (state.commandError || isTerminalFailure(state)) {
      throw new Error(name + " failed: " + JSON.stringify(state));
    }
    if (
      isExactDisplayReady(state, false) &&
      matches(state.structureQuery, expected, true)
    )
      return;
    await delay(50);
  } while (Date.now() < deadline);
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
    if (!someMatches(assemblies, expectedAssembly)) {
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

async function openNativeProject(view, filePath) {
  const bytes = readFileSync(resolve(repoRoot, filePath)).toString("base64");
  const fileName = filePath.split(/[\\/]/).at(-1);
  // Supply a deterministic file-picker result while exercising the real Open
  // control, native reader, project replacement, rebuild, and rendering path.
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
      "getFile: async () => file, queryPermission: async () => 'granted', requestPermission: async () => 'granted' }]; return true; })()"
  );
  try {
    await clickVisibleControl(view, '[data-ribbon-roving-id="mode-project"]');
    await clickVisibleControl(view, '[data-action-id="project.open"]');
    await waitForReady(view, { timeoutMs: readyTimeoutMs, allowEmpty: false });
    await assertNoErrorToast(view, "Open " + fileName);
  } finally {
    await evaluate(
      view,
      "(() => { window.showOpenFilePicker = window.__pbOriginalOpenPicker; delete window.__pbOriginalOpenPicker; return true; })()"
    );
  }
}

async function runUseSteps(view, name, steps, label) {
  let sawScreenshot = false;
  let sawBreak = false;
  const clicks = [];
  for (const step of steps) {
    if (step.openWcad) {
      clicks.push('[data-action-id="project.open"]');
      await openNativeProject(view, step.openWcad);
      continue;
    }
    if (step.expectText) {
      const { selector, text } = step.expectText;
      const deadline = Date.now() + 10_000;
      let actual;
      do {
        actual = await evaluate(
          view,
          "document.querySelector(" +
            JSON.stringify(selector) +
            ")?.textContent?.trim()"
        );
        if (actual === text) break;
        await delay(50);
      } while (Date.now() < deadline);
      if (actual !== text)
        throw new Error(
          name +
            " expected text " +
            JSON.stringify(text) +
            ", got " +
            JSON.stringify(actual)
        );
      continue;
    }
    if (step.expectExactVolume) {
      const { bodyId, volume } = step.expectExactVolume;
      const deadline = Date.now() + 10_000;
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
      } while (Date.now() < deadline);
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
    await view.navigate(appUrl);
    await waitForHook(view);
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
