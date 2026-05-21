import { spawn } from "node:child_process";
import { mkdir, rm, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  connectToBrowser,
  findBrowserExecutable,
  getAvailablePort,
  startStaticServer
} from "./occt-smoke/browser.mjs";

/* global document, Event, HTMLInputElement, HTMLSelectElement, Node */

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const appDistDir = join(repoRoot, "apps/web/dist");
const appHtmlPath = join(appDistDir, "index.html");
const smokeTimeoutMs = 20_000;

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
  `chrome-profile-feature-delete-${process.pid}-${Date.now()}`
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

  const result = await runFeatureDeleteUiSmoke(client, appUrl, smokeTimeoutMs);
  console.log("Feature delete UI smoke passed");
  console.log(JSON.stringify(result, null, 2));
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

async function runFeatureDeleteUiSmoke(client, appUrl, timeoutMs) {
  const target = await client.send("Target.createTarget", {
    url: "about:blank"
  });
  const attached = await client.send("Target.attachToTarget", {
    targetId: target.targetId,
    flatten: true
  });
  const { sessionId } = attached;
  const exceptions = [];

  client.on("Runtime.exceptionThrown", (params) => {
    exceptions.push(
      params.exceptionDetails?.exception?.description ??
        params.exceptionDetails?.text ??
        "Unknown browser exception"
    );
  });

  await client.send("Runtime.enable", {}, sessionId);
  await client.send("Page.enable", {}, sessionId);
  await client.send("Page.navigate", { url: appUrl }, sessionId);

  const result = await client.send(
    "Runtime.evaluate",
    {
      awaitPromise: true,
      returnByValue: true,
      expression: `(${featureDeleteUiSmoke.toString()})(${JSON.stringify({
        timeoutMs
      })})`
    },
    sessionId
  );

  if (result.exceptionDetails) {
    throw new Error(
      result.exceptionDetails.exception?.description ??
        result.exceptionDetails.text ??
        "Feature delete UI smoke failed."
    );
  }

  if (exceptions.length > 0) {
    throw new Error(`Browser exception during smoke: ${exceptions.join("\n")}`);
  }

  return result.result.value;
}

async function featureDeleteUiSmoke({ timeoutMs }) {
  const sketchId = "smoke_sketch";
  const entityId = "smoke_rect";
  const featureId = "smoke_feature";
  const bodyId = "smoke_body";
  const checks = [];

  await waitFor(
    () => document.querySelector("h1")?.textContent?.includes("Partbench"),
    "app shell"
  );
  checks.push("app loaded");

  const sketches = getSectionByAriaLabel("Sketches");
  setFieldByLabel(sketches, "Optional ID", sketchId);
  clickButton(sketches, "Create sketch");
  await waitFor(() => getSelectedSketchId() === sketchId, "created sketch");
  checks.push("created sketch");

  const entityEditor = getSectionByAriaLabel("Sketch entity editor");
  setSelectByLabel(entityEditor, "Entity", "rectangle");
  setFieldByLabel(entityEditor, "Optional ID", entityId);
  setFieldByLabel(entityEditor, "Width", "2");
  setFieldByLabel(entityEditor, "Height", "3");
  clickButton(entityEditor, "Add entity");
  await waitFor(() => includesText(sketches, entityId), "created rectangle");
  checks.push("created sketch rectangle");

  clickButton(sketches, "Use for extrude");
  const extrudeEditor = getSectionByAriaLabel("Extrude feature");
  setFieldByLabel(extrudeEditor, "Optional feature ID", featureId);
  setFieldByLabel(extrudeEditor, "Optional body ID", bodyId);
  setFieldByLabel(extrudeEditor, "Depth", "4");
  clickButton(extrudeEditor, "Create extrude");
  await waitFor(
    () => includesText(getSectionByHeading("Bodies"), bodyId),
    "created body"
  );
  await waitFor(
    () =>
      getButtonContaining(
        getSectionByHeading("Bodies"),
        bodyId
      )?.classList.contains("selected") &&
      getViewportStatusTitle().includes(bodyId),
    "selected created body"
  );
  checks.push("extruded and selected authored body");

  clickButton(document.body, "Delete feature");
  await waitFor(
    () => Boolean(getButtonByText(document.body, "Confirm delete feature")),
    "armed feature delete"
  );
  clickButton(document.body, "Confirm delete feature");
  await waitFor(
    () =>
      !includesText(getSectionByHeading("Bodies"), bodyId) &&
      getViewportStatusTitle() === "No selection",
    "deleted authored feature"
  );
  checks.push("deleted authored feature through UI");

  clickButton(getToolbar(), "Undo");
  await waitFor(
    () => includesText(getSectionByHeading("Bodies"), bodyId),
    "undo restored body"
  );
  checks.push("undo restored body");

  clickButton(getToolbar(), "Redo");
  await waitFor(
    () => !includesText(getSectionByHeading("Bodies"), bodyId),
    "redo removed body"
  );
  checks.push("redo removed body");

  return {
    ok: true,
    checks,
    bodyId,
    featureId
  };

  async function waitFor(predicate, label) {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      if (predicate()) {
        return;
      }

      await delay(50);
    }

    throw new Error(`Timed out waiting for ${label}.`);
  }

  function delay(milliseconds) {
    return new Promise((resolvePromise) => {
      setTimeout(resolvePromise, milliseconds);
    });
  }

  function getToolbar() {
    const toolbar = document.querySelector(".app-toolbar");

    if (!toolbar) {
      throw new Error("Could not find app toolbar.");
    }

    return toolbar;
  }

  function getSectionByAriaLabel(label) {
    const section = document.querySelector(`section[aria-label="${label}"]`);

    if (!section) {
      throw new Error(`Could not find section labelled ${label}.`);
    }

    return section;
  }

  function getSectionByHeading(heading) {
    const section = [...document.querySelectorAll("section")].find(
      (candidate) =>
        normalize(candidate.querySelector("h2")?.textContent) === heading
    );

    if (!section) {
      throw new Error(`Could not find section headed ${heading}.`);
    }

    return section;
  }

  function getViewportStatusTitle() {
    return normalize(
      document.querySelector(".viewport-status strong")?.textContent
    );
  }

  function getSelectedSketchId() {
    const selectedInput = getSectionByAriaLabel("Sketches").querySelector(
      ".sketch-detail input[readonly]"
    );

    return selectedInput?.value ?? "";
  }

  function setFieldByLabel(scope, label, value) {
    const control = getControlByLabel(scope, label);

    if (!(control instanceof HTMLInputElement)) {
      throw new Error(`Label ${label} did not resolve to an input.`);
    }

    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    )?.set;
    setter?.call(control, value);
    control.dispatchEvent(new Event("input", { bubbles: true }));
    control.dispatchEvent(new Event("change", { bubbles: true }));
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
}
