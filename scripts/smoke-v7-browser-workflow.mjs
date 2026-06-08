import { spawn } from "node:child_process";
import { mkdir, rm, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createV7BrowserWorkflowSmokeResult,
  formatV7BrowserWorkflowSmokeSummary
} from "./v7-browser-workflow.mjs";
import {
  connectToBrowser,
  findBrowserExecutable,
  getAvailablePort,
  startStaticServer
} from "./occt-smoke/browser.mjs";

/* global document, Event, HTMLDetailsElement, HTMLInputElement, HTMLSelectElement, Node */

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const appDistDir = join(repoRoot, "apps/web/dist");
const appHtmlPath = join(appDistDir, "index.html");
const smokeTimeoutMs = 30_000;

await assertAppBuildExists();

const browserExecutable = findBrowserExecutable();

if (!browserExecutable) {
  throw new Error(
    "No Chromium-compatible browser was found. Set PARTBENCH_SMOKE_BROWSER to a Chrome/Chromium executable path."
  );
}

let appServer;
let browserProcess;
let client;
const profileDir = join(
  repoRoot,
  ".metrics",
  `chrome-profile-v7-browser-workflow-${process.pid}-${Date.now()}`
);

try {
  await mkdir(dirname(profileDir), { recursive: true });
  appServer = await startStaticServer(appDistDir);
  const appUrl = `http://127.0.0.1:${appServer.port}/index.html`;
  const remoteDebuggingPort = await getAvailablePort();

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

  const result = await runV7BrowserWorkflowSmoke(
    client,
    appUrl,
    smokeTimeoutMs
  );
  console.log(formatV7BrowserWorkflowSmokeSummary(result));
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.ok ? 0 : 1;
} finally {
  await client?.close().catch(() => {});
  browserProcess?.kill();
  appServer?.close();
  await rm(profileDir, { force: true, recursive: true }).catch(() => {});
}

async function assertAppBuildExists() {
  try {
    await stat(appHtmlPath);
  } catch {
    throw new Error(
      "Web app build was not found. Run `pnpm build` before this smoke script."
    );
  }
}

async function runV7BrowserWorkflowSmoke(client, appUrl, timeoutMs) {
  const target = await client.send("Target.createTarget", {
    url: "about:blank"
  });
  const attached = await client.send("Target.attachToTarget", {
    targetId: target.targetId,
    flatten: true
  });
  const { sessionId } = attached;
  const exceptions = [];
  const consoleErrors = [];

  client.on("Runtime.exceptionThrown", (params) => {
    exceptions.push(
      params.exceptionDetails?.exception?.description ??
        params.exceptionDetails?.text ??
        "Unknown browser exception"
    );
  });
  client.on("Runtime.consoleAPICalled", (params) => {
    if (params.type !== "error") {
      return;
    }

    consoleErrors.push(
      params.args
        .map((arg) => arg.value ?? arg.description ?? arg.unserializableValue)
        .filter(Boolean)
        .join(" ") || "Unknown console error"
    );
  });
  client.on("Log.entryAdded", (params) => {
    if (params.entry?.level !== "error") {
      return;
    }

    consoleErrors.push(params.entry.text || "Unknown browser log error");
  });

  await client.send("Runtime.enable", {}, sessionId);
  await client.send("Log.enable", {}, sessionId);
  await client.send("Page.enable", {}, sessionId);
  await client.send("Page.navigate", { url: appUrl }, sessionId);

  const result = await client.send(
    "Runtime.evaluate",
    {
      awaitPromise: true,
      returnByValue: true,
      expression: `(${v7BrowserWorkflowSmoke.toString()})(${JSON.stringify({
        timeoutMs
      })})`
    },
    sessionId
  );

  if (result.exceptionDetails) {
    exceptions.push(
      result.exceptionDetails.exception?.description ??
        result.exceptionDetails.text ??
        "V7 browser workflow smoke failed."
    );
  }

  const pageResult = result.result?.value ?? {
    checks: [],
    ids: {},
    skipped: []
  };

  return createV7BrowserWorkflowSmokeResult({
    checks: pageResult.checks,
    ids: pageResult.ids,
    skipped: pageResult.skipped,
    consoleErrors,
    exceptions
  });
}

async function v7BrowserWorkflowSmoke({ timeoutMs }) {
  const ids = {
    bodyId: "v7_smoke_body",
    entityId: "v7_smoke_rect",
    featureId: "v7_smoke_feature",
    namedReference: "v7_smoke_top_face",
    sketchId: "v7_smoke_sketch"
  };
  const checks = [];
  const skipped = [];

  await waitFor(
    () => document.querySelector("h1")?.textContent?.includes("Partbench"),
    "app shell"
  );
  pass("app-load", "app loaded without runtime exceptions");

  await waitFor(
    () => Boolean(findDetailsBySummary(document.body, "Advanced tools")),
    "advanced tools drawer"
  );
  openDetailsBySummary(document.body, "Advanced tools");
  clickButtonContaining(getElementByAriaLabel("Tool tabs"), "Sketches");

  const sketches = getSectionByAriaLabel("Sketches");
  setInputByDetailsSummary(sketches, "Advanced sketch options", ids.sketchId);
  clickButton(sketches, "Create sketch");
  await waitFor(
    () =>
      getControlByLabel(getSectionByAriaLabel("Sketches"), "Active sketch")
        .value === ids.sketchId,
    "created deterministic sketch"
  );
  pass("create-sketch", "created deterministic sketch", ids.sketchId);

  clickButton(getElementByAriaLabel("Add sketch entity"), "Rectangle");
  const entityEditor = getSectionByAriaLabel("Sketch entity editor");
  setSelectByLabel(entityEditor, "Entity", "rectangle");
  setInputByDetailsSummary(entityEditor, "Optional ID", ids.entityId);
  setFieldByLabel(entityEditor, "Width", "2");
  setFieldByLabel(entityEditor, "Height", "1");
  clickButton(entityEditor, "Add entity");
  await waitFor(
    () =>
      includesText(getElementByAriaLabel("Select sketch entity"), ids.entityId),
    "created deterministic rectangle"
  );
  pass(
    "create-rectangle",
    "created deterministic rectangle profile",
    ids.entityId
  );

  const featureEditor = getSectionByAriaLabel("Create authored feature");
  setFieldByLabel(featureEditor, "Depth", "1.5");
  setSelectByLabel(featureEditor, "Operation", "newBody");
  setFieldByLabel(featureEditor, "Optional feature ID", ids.featureId);
  setFieldByLabel(featureEditor, "Optional body ID", ids.bodyId);
  clickButton(featureEditor, "Create extrude");
  await waitFor(
    () =>
      includesText(getElementByAriaLabel("Model structure"), ids.bodyId) ||
      includesText(getElementByAriaLabel("Inspector"), ids.bodyId),
    "created deterministic extrude body"
  );
  pass("create-extrude", "created deterministic newBody extrude", ids.bodyId);

  clickButtonContaining(getElementByAriaLabel("Tool tabs"), "Details");
  const modelStructure = getElementByAriaLabel("Model structure");
  const modeling = getSectionByAriaLabel("Modeling context");
  getButtonContaining(modelStructure, "Result body")?.click();

  await waitFor(() => {
    const currentViewportSummary = getElementByAriaLabel(
      "Viewport interaction summary"
    );
    const currentInspector = getElementByAriaLabel("Inspector");
    const ready =
      currentViewportSummary.dataset.selectionKind === "body" &&
      includesText(currentViewportSummary, "Command-ready") &&
      includesText(currentInspector, ids.bodyId) &&
      includesText(currentInspector, "Command-ready reference");

    if (!ready) {
      throw new Error(
        [
          `viewportKind=${currentViewportSummary.dataset.selectionKind ?? ""}`,
          `viewport=${normalize(currentViewportSummary.textContent).slice(0, 180)}`,
          `inspector=${normalize(currentInspector.textContent).slice(0, 180)}`
        ].join("; ")
      );
    }

    return true;
  }, "body command-ready reference state");
  const viewportSummary = getElementByAriaLabel("Viewport interaction summary");
  pass(
    "body-reference-contract",
    "feature tree body selection shows command-ready semantic reference state",
    getViewportSelectionText()
  );

  const modelingChecks = [
    assertIncludes(
      modeling,
      "Reference contract",
      "modeling-reference-contract"
    ),
    assertIncludes(
      modeling,
      "Command-ready reference",
      "modeling-reference-status"
    )
  ];
  if (modelingChecks.every(Boolean)) {
    pass(
      "modeling-reference-status",
      "modeling workflow consumes selection.referenceCandidates status"
    );
  }

  const viewportReferences = getElementByAriaLabel(
    "Viewport reference candidates"
  );
  const faceAction = [
    ...viewportReferences.querySelectorAll(
      'button[data-commandable="true"][data-reference-kind="face"]'
    )
  ][0];

  if (!faceAction) {
    fail(
      "generated-reference-candidate",
      "viewport exposes generated face reference candidate",
      normalize(viewportReferences.textContent)
    );
  } else {
    const selectedFaceLabel = normalize(
      faceAction.querySelector("span")?.textContent
    );
    faceAction.click();
    await waitFor(
      () =>
        viewportSummary.dataset.selectionKind === "generatedReference" &&
        includesText(viewportSummary, "Command-ready") &&
        includesText(getElementByAriaLabel("Inspector"), "Selected reference"),
      "selected generated reference"
    );
    pass(
      "generated-reference-selection",
      "selected generated face through viewport/status reference candidates",
      selectedFaceLabel
    );

    const generatedReferenceChecks = [
      assertIncludes(
        getElementByAriaLabel("Inspector"),
        "Reference contract",
        "selected-generated-reference-contract"
      ),
      assertIncludes(
        modeling,
        "Name reference",
        "generated-reference-workflow"
      ),
      assertIncludes(modeling, "Create sketch on face", "face-command-workflow")
    ];
    if (generatedReferenceChecks.every(Boolean)) {
      pass(
        "generated-reference-contract",
        "inspector and modeling surface generated-reference command-ready state"
      );
    }

    setFieldByLabel(modeling, "Reference name", ids.namedReference);
    clickButton(modeling, "Save name");
    await waitFor(
      () => includesText(modelStructure, ids.namedReference),
      "created named reference"
    );
    pass(
      "named-reference-create",
      "named generated reference appears in model structure",
      ids.namedReference
    );

    const namedReferenceButton = getButtonContaining(
      modelStructure,
      ids.namedReference
    );
    if (!namedReferenceButton) {
      fail(
        "named-reference-route",
        "named reference routes back to generated reference selection",
        "Named reference button was not found."
      );
    } else {
      namedReferenceButton.click();
      await waitFor(
        () =>
          viewportSummary.dataset.selectionKind === "generatedReference" &&
          includesText(viewportSummary, "Command-ready") &&
          includesText(getElementByAriaLabel("Inspector"), ids.namedReference),
        "reselected named reference"
      );
      pass(
        "named-reference-route",
        "named reference routes to command-ready generated reference"
      );
    }
  }

  openDetailsBySummary(document.body, "Advanced tools");
  clickButtonContaining(getElementByAriaLabel("Tool tabs"), "File");
  const projectPanel = getSectionByAriaLabel("Project");
  await waitFor(
    () =>
      includesText(projectPanel, "Current source") &&
      includesText(projectPanel, "Export readiness"),
    "project file panel"
  );
  const projectChecks = [
    assertIncludes(projectPanel, "web-cad.project.v16", "current-json-schema"),
    assertIncludes(projectPanel, "Save/open status", "storage-status"),
    assertIncludes(projectPanel, "JSON import/export", "json-storage-mode"),
    assertIncludes(
      projectPanel,
      "Direct browser file handles",
      "direct-file-status"
    ),
    assertIncludes(projectPanel, "OPFS browser cache", "opfs-deferred-status"),
    assertIncludes(
      projectPanel,
      "Native .wcad package",
      "wcad-deferred-status"
    ),
    assertIncludes(projectPanel, "STEP", "step-export-status"),
    assertIncludes(
      projectPanel,
      "STEP file export is not implemented yet",
      "step-deferred-limitation"
    ),
    assertIncludes(projectPanel, "Mesh/GLB visualization", "mesh-glb-status")
  ];
  if (projectChecks.every(Boolean)) {
    pass(
      "project-file-panel",
      "Project/File panel reports JSON, storage capability, and export readiness"
    );
  }

  const glbButton = getButtonByText(projectPanel, "Download visualization GLB");
  if (!glbButton) {
    skipped.push({
      id: "glb-download",
      reason: "Download visualization GLB button is not present."
    });
  } else if (glbButton.disabled) {
    skipped.push({
      id: "glb-download",
      reason: `Download visualization GLB is disabled: ${getExportReadinessText()}`
    });
  } else {
    glbButton.click();
    await waitFor(
      () =>
        includesText(projectPanel, "Downloaded partbench-visualization.glb"),
      "visualization GLB download message"
    );
    pass(
      "glb-download",
      "ready derived visualization mesh exported as transient GLB"
    );
  }

  return { checks, ids, skipped };

  function pass(id, label, detail) {
    checks.push({
      id,
      label,
      status: "pass",
      ...(detail ? { detail } : {})
    });
  }

  function fail(id, label, detail) {
    checks.push({
      id,
      label,
      status: "fail",
      ...(detail ? { detail } : {})
    });
  }

  async function waitFor(predicate, label) {
    const deadline = Date.now() + timeoutMs;
    let lastError;

    while (Date.now() < deadline) {
      try {
        if (predicate()) {
          return;
        }
      } catch (error) {
        lastError = error;
      }

      await delay(50);
    }

    throw new Error(
      `Timed out waiting for ${label}.${
        lastError instanceof Error ? ` Last error: ${lastError.message}` : ""
      } Visible text: ${getVisibleTextSnapshot()}`
    );
  }

  function delay(milliseconds) {
    return new Promise((resolvePromise) => {
      setTimeout(resolvePromise, milliseconds);
    });
  }

  function getViewportSelectionText() {
    return compactText(
      getElementByAriaLabel("Viewport interaction summary").textContent
    );
  }

  function getExportReadinessText() {
    return compactText(
      getElementByAriaLabel("Export readiness").textContent,
      520
    );
  }

  function getSectionByAriaLabel(label) {
    const section = document.querySelector(`section[aria-label="${label}"]`);

    if (!section) {
      throw new Error(`Could not find section labelled ${label}.`);
    }

    return section;
  }

  function getElementByAriaLabel(label) {
    const element = document.querySelector(`[aria-label="${label}"]`);

    if (!element) {
      throw new Error(`Could not find element labelled ${label}.`);
    }

    return element;
  }

  function openDetailsBySummary(scope, summaryText) {
    const details = getDetailsBySummary(scope, summaryText);

    if (!(details instanceof HTMLDetailsElement)) {
      throw new Error(`Summary ${summaryText} did not resolve to details.`);
    }

    details.open = true;
    return details;
  }

  function getDetailsBySummary(scope, summaryText) {
    const details = findDetailsBySummary(scope, summaryText);

    if (!details) {
      throw new Error(`Could not find details summary ${summaryText}.`);
    }

    return details;
  }

  function findDetailsBySummary(scope, summaryText) {
    return [...scope.querySelectorAll("details")].find((candidate) =>
      [...candidate.children].some(
        (child) =>
          child.tagName.toLowerCase() === "summary" &&
          summaryMatches(child.textContent, summaryText)
      )
    );
  }

  function summaryMatches(value, summaryText) {
    const normalized = normalize(value);

    return normalized === summaryText || normalized.startsWith(summaryText);
  }

  function setInputByDetailsSummary(scope, summaryText, value) {
    const details = openDetailsBySummary(scope, summaryText);
    const input = details.querySelector("input");

    if (!(input instanceof HTMLInputElement)) {
      throw new Error(`Details summary ${summaryText} has no input.`);
    }

    setInputValue(input, value);
  }

  function setFieldByLabel(scope, label, value) {
    const control = getControlByLabel(scope, label);

    if (!(control instanceof HTMLInputElement)) {
      throw new Error(`Label ${label} did not resolve to an input.`);
    }

    setInputValue(control, value);
  }

  function setInputValue(input, value) {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    )?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function setSelectByLabel(scope, label, value) {
    const control = getControlByLabel(scope, label);

    if (!(control instanceof HTMLSelectElement)) {
      throw new Error(`Label ${label} did not resolve to a select.`);
    }

    const setter = Object.getOwnPropertyDescriptor(
      HTMLSelectElement.prototype,
      "value"
    )?.set;
    setter?.call(control, value);
    control.dispatchEvent(new Event("input", { bubbles: true }));
    control.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function getControlByLabel(scope, label) {
    const matchingLabel = [...scope.querySelectorAll("label")].find(
      (candidate) => getDirectLabelText(candidate) === label
    );

    const control = matchingLabel?.querySelector("input, select, textarea");

    if (!control) {
      throw new Error(`Could not find control labelled ${label}.`);
    }

    return control;
  }

  function clickButton(scope, text) {
    const button = getButtonByText(scope, text);

    if (!button) {
      throw new Error(`Could not find button ${text}.`);
    }

    clickEnabledButton(button, text);
  }

  function clickButtonContaining(scope, text) {
    const button = getButtonContaining(scope, text);

    if (!button) {
      throw new Error(`Could not find button containing ${text}.`);
    }

    clickEnabledButton(button, text);
  }

  function clickEnabledButton(button, text) {
    if (button.disabled) {
      throw new Error(`Button ${text} is disabled.`);
    }

    button.click();
  }

  function getButtonByText(scope, text) {
    return [...scope.querySelectorAll("button")].find(
      (button) => normalize(button.textContent) === text
    );
  }

  function getButtonContaining(scope, text) {
    return [...scope.querySelectorAll("button")].find((button) =>
      normalize(button.textContent).includes(text)
    );
  }

  function assertIncludes(scope, text, label) {
    if (!includesText(scope, text)) {
      fail(label, `expected ${label}`, `${text} was not visible.`);
      return false;
    }

    return true;
  }

  function includesText(scope, text) {
    return normalize(scope.textContent).includes(text);
  }

  function getDirectLabelText(label) {
    return normalize(
      [...label.childNodes]
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent)
        .join(" ")
    );
  }

  function normalize(value) {
    return (value ?? "").replace(/\s+/g, " ").trim();
  }

  function compactText(value, maxLength = 420) {
    const normalized = normalize(value);

    if (normalized.length <= maxLength) {
      return normalized;
    }

    return `${normalized.slice(0, maxLength)}...`;
  }

  function getVisibleTextSnapshot() {
    return normalize(document.body.textContent).slice(0, 1000);
  }
}
