import { spawn } from "node:child_process";
import { mkdir, rm, stat } from "node:fs/promises";
import { register } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  createV19GateBBrowserWorkflowResult,
  formatV19GateBBrowserWorkflowSummary
} from "./v19-browser-workflow.mjs";
import {
  connectToBrowser,
  findBrowserExecutable,
  getAvailablePort,
  startStaticServer,
  stopBrowserProcess
} from "./occt-smoke/browser.mjs";
import { acquireBrowserSmokeLease } from "./v18-geometry-reliability.mjs";

/* global document, getComputedStyle, HTMLElement */

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const appDistDirectory = join(repositoryRoot, "apps/web/dist");
const appHtmlPath = join(appDistDirectory, "index.html");
const loaderUrl = new URL("./ts-source-loader.mjs", import.meta.url);
const args = new Set(process.argv.slice(2));
const timeoutMs = Number(
  process.env.PARTBENCH_V19_BROWSER_TIMEOUT_MS ?? 30_000
);

if (args.has("--help")) {
  console.log(`Usage: node scripts/smoke-v19-browser-workflow.mjs [--json]

Runs the focused V19 Gate B curve-edit workflow against the built production
App UI using trusted Chromium pointer and keyboard input.`);
  process.exit(0);
}

await assertProductionBuildExists();
const browserExecutable = findBrowserExecutable();
if (!browserExecutable) {
  throw new Error(
    "No cached Chromium-compatible browser was found. Set PARTBENCH_SMOKE_BROWSER to its executable path."
  );
}

const fixtureProjectJson = await createGateBFixtureProjectJson();
const profileDirectory = join(
  repositoryRoot,
  ".metrics",
  `chrome-profile-v19-gate-b-${process.pid}-${Date.now()}`
);
let appServer;
let browserProcess;
let browserClient;
let browserLease;

try {
  await mkdir(dirname(profileDirectory), { recursive: true });
  browserLease = await acquireBrowserSmokeLease({
    lockPath: join(repositoryRoot, ".metrics", "browser-smoke.lock")
  });
  appServer = await startStaticServer(appDistDirectory);
  const appUrl = `http://127.0.0.1:${appServer.port}/index.html`;
  const remoteDebuggingPort = await getAvailablePort();
  browserProcess = spawn(
    browserExecutable,
    [
      "--headless=new",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--no-default-browser-check",
      "--no-first-run",
      ...(isTruthy(process.env.PARTBENCH_SMOKE_BROWSER_NO_SANDBOX)
        ? ["--no-sandbox"]
        : []),
      `--remote-debugging-port=${remoteDebuggingPort}`,
      `--user-data-dir=${profileDirectory}`,
      "about:blank"
    ],
    { stdio: "ignore" }
  );
  browserClient = (await connectToBrowser(remoteDebuggingPort)).client;

  const result = await runGateBBrowserWorkflow({
    appUrl,
    client: browserClient,
    fixtureProjectJson,
    timeoutMs
  });
  console.log(
    args.has("--json")
      ? JSON.stringify(result, null, 2)
      : formatV19GateBBrowserWorkflowSummary(result)
  );
  process.exitCode = result.ok ? 0 : 1;
} finally {
  await browserClient?.close().catch(() => {});
  await stopBrowserProcess(browserProcess, 2_000).catch(() => {});
  await appServer?.close().catch(() => {});
  await rm(profileDirectory, { force: true, recursive: true }).catch(() => {});
  await browserLease?.release().catch(() => {});
}

async function assertProductionBuildExists() {
  try {
    await stat(appHtmlPath);
  } catch {
    throw new Error(
      "Web app build was not found. Run `VITE_ENABLE_DERIVED_GEOMETRY=true pnpm build` before this smoke script."
    );
  }
}

async function createGateBFixtureProjectJson() {
  register(loaderUrl, import.meta.url);
  const cadCore = await import(
    pathToFileURL(resolve(repositoryRoot, "packages/cad-core/src/index.ts"))
      .href
  );
  const engine = new cadCore.CadEngine();
  const response = engine.executeBatch({
    version: "cadops.v1",
    mode: "commit",
    ops: [
      {
        op: "sketch.create",
        id: "sketch_1",
        name: "V19 Gate B curve edits",
        plane: "XY"
      },
      {
        op: "sketch.addLine",
        sketchId: "sketch_1",
        id: "trim_target",
        start: [0, 0],
        end: [10, 0]
      },
      {
        op: "sketch.addLine",
        sketchId: "sketch_1",
        id: "trim_boundary_a",
        start: [3, -2],
        end: [3, 2]
      },
      {
        op: "sketch.addLine",
        sketchId: "sketch_1",
        id: "trim_boundary_b",
        start: [7, -2],
        end: [7, 2]
      },
      {
        op: "sketch.addLine",
        sketchId: "sketch_1",
        id: "extend_target",
        start: [0, 4],
        end: [2, 4]
      },
      {
        op: "sketch.addLine",
        sketchId: "sketch_1",
        id: "extend_boundary",
        start: [5, 3],
        end: [5, 5]
      },
      {
        op: "sketch.constraint.create",
        id: "trim_horizontal",
        name: "Trim target horizontal",
        sketchId: "sketch_1",
        entityId: "trim_target",
        kind: "horizontal"
      },
      {
        op: "sketch.dimension.create",
        id: "trim_length",
        name: "Trim target length",
        sketchId: "sketch_1",
        entityId: "trim_target",
        target: { entityKind: "line", role: "length" },
        value: 10
      }
    ]
  });
  if (!response.ok) {
    throw new Error(
      `Could not create V19 Gate B fixture: ${response.error.code}`
    );
  }
  return cadCore.exportCadProjectJson(engine);
}

async function runGateBBrowserWorkflow({
  appUrl,
  client,
  fixtureProjectJson,
  timeoutMs: workflowTimeoutMs
}) {
  const checks = [];
  const consoleErrors = [];
  const exceptions = [];
  const target = await client.send("Target.createTarget", {
    url: "about:blank"
  });
  const attached = await client.send("Target.attachToTarget", {
    targetId: target.targetId,
    flatten: true
  });
  const { sessionId } = attached;

  client.on("Runtime.exceptionThrown", (params, context) => {
    if (context.sessionId !== sessionId) return;
    exceptions.push(
      params.exceptionDetails?.exception?.description ??
        params.exceptionDetails?.text ??
        "Unknown browser exception"
    );
  });
  client.on("Runtime.consoleAPICalled", (params, context) => {
    if (context.sessionId !== sessionId || params.type !== "error") return;
    consoleErrors.push(
      params.args
        .map((arg) => arg.value ?? arg.description ?? arg.unserializableValue)
        .filter(Boolean)
        .join(" ") || "Unknown browser console error"
    );
  });
  client.on("Log.entryAdded", (params, context) => {
    if (context.sessionId !== sessionId || params.entry?.level !== "error")
      return;
    consoleErrors.push(params.entry.text || "Unknown browser log error");
  });

  try {
    await client.send("Runtime.enable", {}, sessionId);
    await client.send("Log.enable", {}, sessionId);
    await client.send("Page.enable", {}, sessionId);
    await client.send(
      "Page.addScriptToEvaluateOnNewDocument",
      {
        source: `
          Object.defineProperty(window, "showOpenFilePicker", {
            configurable: true,
            value: undefined
          });
          Object.defineProperty(window, "showSaveFilePicker", {
            configurable: true,
            value: undefined
          });
          window.__partbenchV19InputAudit = {
            pointerInputs: 0,
            pointerEvents: [],
            keydowns: []
          };
          for (const type of ["pointermove", "pointerdown", "mousedown", "touchstart"]) {
            window.addEventListener(type, (event) => {
              if (type !== "pointermove") {
                window.__partbenchV19InputAudit.pointerInputs += 1;
              }
              window.__partbenchV19InputAudit.pointerEvents.push({
                type,
                trusted: event.isTrusted,
                target: event.target?.getAttribute?.("aria-label") ??
                  event.target?.tagName
              });
            }, true);
          }
          window.addEventListener("keydown", (event) => {
            window.__partbenchV19InputAudit.keydowns.push({
              key: event.key,
              ctrlKey: event.ctrlKey,
              metaKey: event.metaKey,
              trusted: event.isTrusted,
              target: event.target?.getAttribute?.("aria-label") ??
                event.target?.textContent?.trim?.().slice(0, 80) ??
                event.target?.tagName
            });
          }, true);
        `
      },
      sessionId
    );
    await client.send(
      "Emulation.setDeviceMetricsOverride",
      {
        width: 2400,
        height: 1200,
        deviceScaleFactor: 1,
        mobile: false
      },
      sessionId
    );
    await client.send("Page.navigate", { url: appUrl }, sessionId);

    const browser = createBrowserKeyboardDriver(
      client,
      sessionId,
      workflowTimeoutMs
    );
    await browser.waitFor(
      `Boolean(document.querySelector('[aria-label="Partbench document header"]'))`,
      "production App shell"
    );
    await browser.selectMode("Project");
    await browser.activate({ kind: "ribbonAction", text: "Project Files" });
    await browser.waitFor(
      `Boolean(document.querySelector('.pb-project-mode-workspace textarea'))`,
      "Project Files workspace"
    );
    await browser.activate({
      kind: "summary",
      text: "Advanced Interchange"
    });
    await browser.focus({
      kind: "labelControl",
      text: "Project JSON draft"
    });
    await browser.insertText(fixtureProjectJson);
    await browser.waitFor(
      `(() => {
        const buttons = [...document.querySelectorAll('.pb-project-mode-workspace button')];
        return buttons.some((button) =>
          button.textContent.trim() === 'Import JSON' && !button.disabled
        );
      })()`,
      "valid fixture JSON"
    );
    await browser.activate({
      kind: "workspaceButton",
      text: "Import JSON"
    });
    await browser.waitFor(
      `(() => {
        const text = document.body.textContent;
        return text.includes('Imported 0 object(s), 1 sketch(es)') &&
          text.includes('5 sketch entity(ies)');
      })()`,
      "fixture import"
    );
    checks.push({
      id: "v19-gate-b-production-app",
      passed: true,
      evidence:
        "Built App imported the V22 Gate B fixture through Project Files."
    });

    await browser.selectMode("Sketch");
    await browser.activate({
      kind: "treeRow",
      text: "V19 Gate B curve edits"
    });
    await browser.waitFor(
      `document.querySelector('[aria-label="Sketch editor"]')?.textContent.includes('V19 Gate B curve edits')`,
      "focused Gate B sketch"
    );

    await browser.activate({ kind: "sketchEntity", text: "extend_target" });
    await browser.activate({ kind: "ribbonAction", text: "Split" });
    await browser.waitFor(
      `Boolean(document.querySelector('[aria-label="Split sketch geometry"]'))`,
      "Split editor for viewport collector"
    );
    await browser.hoverViewportWorldPoint([0.5, 4, 0]);
    await browser.waitFor(
      `(() => {
        const events = window.__partbenchV19InputAudit.pointerEvents;
        const editor = document.querySelector('[aria-label="Split sketch geometry"]');
        const apply = [...(editor?.querySelectorAll('button') ?? [])]
          .find((button) => button.textContent.trim() === 'Apply Split');
        return events.some((event) =>
            event.type === 'pointermove' &&
            event.trusted &&
            event.target === '3D scene viewport'
          ) &&
          editor?.textContent.includes('Ready to apply') &&
          Boolean(apply?.disabled);
      })()`,
      "query-backed trusted viewport hover preview"
    );
    await browser.clickViewportWorldPoint([0.5, 4, 0]);
    await browser.waitFor(
      `(() => {
        const editor = document.querySelector('[aria-label="Split sketch geometry"]');
        const apply = [...(editor?.querySelectorAll('button') ?? [])]
          .find((button) => button.textContent.trim() === 'Apply Split');
        return editor?.textContent.includes('Ready to apply') &&
          Boolean(apply && !apply.disabled);
      })()`,
      "viewport-collected split point"
    );
    const pointerAudit = await browser.evaluate(
      `window.__partbenchV19InputAudit`
    );
    const pointerProofPassed =
      pointerAudit.pointerInputs >= 2 &&
      pointerAudit.pointerEvents.some(
        (event) => event.type === "pointermove"
      ) &&
      pointerAudit.pointerEvents.every((event) => event.trusted);
    checks.push({
      id: "v19-gate-b-pointer-collector",
      passed: pointerProofPassed,
      evidence: {
        pointerInputs: pointerAudit.pointerInputs,
        pointerEventTypes: pointerAudit.pointerEvents.map(
          (event) => event.type
        ),
        allTrusted: pointerAudit.pointerEvents.every((event) => event.trusted)
      }
    });

    await browser.requestMode("Inspect");
    await browser.waitFor(
      `Boolean(document.querySelector('[role="dialog"][aria-labelledby="curve-edit-navigation-title"]'))`,
      "dirty navigation guard for Stay"
    );
    await browser.activate({ kind: "dialogButton", text: "Stay" });
    await browser.waitFor(
      `(() => {
        const editor = document.querySelector('[aria-label="Split sketch geometry"]');
        return !document.querySelector('[role="dialog"][aria-labelledby="curve-edit-navigation-title"]') &&
          Boolean(editor?.contains(document.activeElement));
      })()`,
      "Stay focus restoration"
    );
    const stayFocusPassed = true;

    await browser.requestMode("Inspect");
    await browser.waitFor(
      `Boolean(document.querySelector('[role="dialog"][aria-labelledby="curve-edit-navigation-title"]'))`,
      "dirty navigation guard for Discard"
    );
    await browser.activate({ kind: "dialogButton", text: "Discard" });
    await browser.waitFor(
      `(() => {
        const selected = document.querySelector(
          '[aria-label="Workbench mode"] button[aria-selected="true"]'
        );
        return selected?.textContent.trim() === 'Inspect' &&
          document.activeElement === selected &&
          !document.querySelector('[aria-label="Split sketch geometry"]');
      })()`,
      "Discard destination focus"
    );
    const discardFocusPassed = true;

    await browser.selectMode("Sketch");
    await browser.evaluate(
      `(() => {
        window.__partbenchV19InputAudit.pointerInputs = 0;
        window.__partbenchV19InputAudit.pointerEvents = [];
        window.__partbenchV19InputAudit.keydowns = [];
      })()`
    );

    await browser.activate({ kind: "sketchEntity", text: "trim_target" });
    await browser.activate({ kind: "ribbonAction", text: "Trim" });
    await browser.waitFor(
      `Boolean(document.querySelector('[aria-label="Trim sketch geometry"]'))`,
      "Trim editor"
    );
    await browser.activate({
      kind: "labelControl",
      scope: '[aria-label="Trim sketch geometry"]',
      text: "Line 2",
      key: " "
    });
    await browser.activate({
      kind: "labelControl",
      scope: '[aria-label="Trim sketch geometry"]',
      text: "Line 3",
      key: " "
    });
    await browser.waitFor(
      `document.querySelector('[aria-label="Trim sketch geometry"]')?.textContent.includes('Interval 2')`,
      "query-derived trim intervals"
    );
    await browser.activate({
      kind: "curveChoice",
      scope: '[aria-label="Trim sketch geometry"]',
      text: "Interval 2"
    });
    await browser.waitFor(
      `(() => {
        const text = document.querySelector('[aria-label="Trim sketch geometry"]')?.textContent ?? '';
        const apply = [...document.querySelectorAll('[aria-label="Trim sketch geometry"] button')]
          .find((button) => button.textContent.trim() === 'Apply Trim');
        return text.includes('Ready to apply') &&
          text.includes('Trim target horizontal: preserved') &&
          text.includes('Trim target length: must be removed') &&
          text.includes('1 invalid dimension') &&
          Boolean(apply && !apply.disabled);
      })()`,
      "constrained Trim readiness"
    );
    await browser.sendKey("Enter", { ctrlKey: true });
    await browser.waitFor(
      `!document.querySelector('[aria-label="Trim sketch geometry"]')`,
      "Trim Apply"
    );
    checks.push({
      id: "v19-gate-b-keyboard-trim",
      passed: true,
      evidence:
        "Keyboard selected both boundaries and query interval, reviewed the exact invalid dimension, and used Ctrl+Enter Apply."
    });

    await browser.activate({ kind: "sketchEntity", text: "extend_target" });
    await browser.activate({ kind: "ribbonAction", text: "Extend" });
    await browser.waitFor(
      `Boolean(document.querySelector('[aria-label="Extend sketch geometry"]'))`,
      "Extend editor"
    );
    await browser.activate({
      kind: "labelControl",
      scope: '[aria-label="Extend sketch geometry"]',
      text: "Line 4",
      key: " "
    });
    await browser.waitFor(
      `document.querySelector('[aria-label="Extend sketch geometry"]')?.textContent.includes('End endpoint → Line 4')`,
      "query-derived finite Extend hit"
    );
    await browser.activate({
      kind: "curveChoice",
      scope: '[aria-label="Extend sketch geometry"]',
      text: "End endpoint → Line 4"
    });
    await browser.waitFor(
      `(() => {
        const editor = document.querySelector('[aria-label="Extend sketch geometry"]');
        const apply = [...(editor?.querySelectorAll('button') ?? [])]
          .find((button) => button.textContent.trim() === 'Apply Extend');
        return editor?.textContent.includes('Ready to apply') &&
          editor.textContent.includes('Finite hit (5, 4)') &&
          Boolean(apply && !apply.disabled);
      })()`,
      "finite-boundary Extend readiness"
    );
    await browser.sendKey("Enter", { ctrlKey: true });
    await browser.waitFor(
      `!document.querySelector('[aria-label="Extend sketch geometry"]')`,
      "Extend Apply"
    );
    checks.push({
      id: "v19-gate-b-keyboard-extend",
      passed: true,
      evidence:
        "Keyboard selected the exact finite hit and used Ctrl+Enter Apply."
    });

    await browser.selectMode("Project");
    await browser.activate({ kind: "ribbonAction", text: "Project Files" });
    await browser.waitFor(
      `Boolean(document.querySelector('.pb-project-mode-workspace textarea'))`,
      "Project Files after curve edits"
    );
    const afterEdits = await prepareAndReadProject(browser, [5, 4]);
    const authoredEvidence = inspectAuthoredState(afterEdits);
    checks.push({
      id: "v19-gate-b-authored-state",
      passed: authoredEvidence.ok,
      evidence: authoredEvidence
    });

    await browser.activate({ kind: "ariaLabel", text: "Undo" });
    const afterUndo = await prepareAndReadProject(browser, [2, 4]);
    await browser.activate({ kind: "ariaLabel", text: "Redo" });
    const afterRedo = await prepareAndReadProject(browser, [5, 4]);
    const undoRedoPassed =
      hasLineEnd(afterUndo, "extend_target", [2, 4]) &&
      inspectTrimState(afterUndo) &&
      JSON.stringify(afterRedo.document) ===
        JSON.stringify(afterEdits.document);
    checks.push({
      id: "v19-gate-b-single-step-undo-redo",
      passed: undoRedoPassed,
      evidence: {
        undoEnd: getLine(afterUndo, "extend_target")?.end,
        redoEnd: getLine(afterRedo, "extend_target")?.end,
        trimSurvivedUndo: inspectTrimState(afterUndo)
      }
    });

    const inputAudit = await browser.evaluate(
      `window.__partbenchV19InputAudit`
    );
    const trustedKeydowns = inputAudit.keydowns.filter(
      (event) => event.trusted
    );
    const controlEnterCount = trustedKeydowns.filter(
      (event) => event.key === "Enter" && event.ctrlKey
    ).length;
    const keyboardOnlyPassed =
      inputAudit.pointerInputs === 0 &&
      controlEnterCount === 2 &&
      trustedKeydowns.filter((event) => event.key === " ").length >= 3 &&
      trustedKeydowns.length === inputAudit.keydowns.length;
    checks.push({
      id: "v19-gate-b-keyboard-only",
      passed: keyboardOnlyPassed,
      evidence: {
        pointerInputs: inputAudit.pointerInputs,
        trustedKeydownCount: trustedKeydowns.length,
        controlEnterCount
      }
    });

    await browser.selectMode("Sketch");
    await browser.activate({ kind: "sketchEntity", text: "extend_target" });
    await browser.activate({ kind: "ribbonAction", text: "Split" });
    await browser.waitFor(
      `Boolean(document.querySelector('[aria-label="Split sketch geometry"]'))`,
      "Split editor for navigation Apply"
    );
    await browser.clickViewportWorldPoint([0.5, 4, 0]);
    await browser.waitFor(
      `(() => {
        const editor = document.querySelector('[aria-label="Split sketch geometry"]');
        const apply = [...(editor?.querySelectorAll('button') ?? [])]
          .find((button) => button.textContent.trim() === 'Apply Split');
        return Boolean(apply && !apply.disabled);
      })()`,
      "ready Split before guarded Apply"
    );
    await browser.requestMode("Inspect");
    await browser.waitFor(
      `Boolean(document.querySelector('[role="dialog"][aria-labelledby="curve-edit-navigation-title"]'))`,
      "dirty navigation guard for Apply"
    );
    await browser.activate({ kind: "dialogButton", text: "Apply" });
    await browser.waitFor(
      `(() => {
        const selected = document.querySelector(
          '[aria-label="Workbench mode"] button[aria-selected="true"]'
        );
        return selected?.textContent.trim() === 'Inspect' &&
          document.activeElement === selected &&
          !document.querySelector('[role="dialog"][aria-labelledby="curve-edit-navigation-title"]');
      })()`,
      "Apply destination focus"
    );
    checks.push({
      id: "v19-gate-b-dirty-navigation-focus",
      passed: stayFocusPassed && discardFocusPassed,
      evidence: {
        stayReturnedFocusToEditor: stayFocusPassed,
        discardFocusedDestination: discardFocusPassed,
        applyFocusedDestination: true
      }
    });
  } catch (error) {
    exceptions.push(error instanceof Error ? error.message : String(error));
  }

  return createV19GateBBrowserWorkflowResult({
    checks,
    consoleErrors: [...new Set(consoleErrors)],
    exceptions: [...new Set(exceptions)]
  });
}

function createBrowserKeyboardDriver(client, sessionId, workflowTimeoutMs) {
  async function evaluate(expression) {
    const response = await client.send(
      "Runtime.evaluate",
      {
        awaitPromise: true,
        returnByValue: true,
        expression
      },
      sessionId
    );
    if (response.exceptionDetails) {
      throw new Error(
        response.exceptionDetails.exception?.description ??
          response.exceptionDetails.text ??
          "Browser evaluation failed."
      );
    }
    return response.result?.value;
  }

  async function waitFor(expression, label) {
    const deadline = Date.now() + workflowTimeoutMs;
    let lastError;
    while (Date.now() < deadline) {
      try {
        if (await evaluate(`Boolean(${expression})`)) return;
      } catch (error) {
        lastError = error;
      }
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
    }
    const pageText = await evaluate(
      `document.body?.innerText?.replace(/\\s+/g, " ").trim().slice(0, 600) ?? ""`
    ).catch(() => "");
    const interactionText = await evaluate(`(() => {
      const editor = document.querySelector(
        '[aria-label$="sketch geometry"]'
      );
      return JSON.stringify({
        editorText: editor?.textContent?.replace(/\\s+/g, " ").trim().slice(0, 1200),
        activeElement: (() => {
          const active = document.activeElement;
          return active instanceof HTMLElement ? {
            tagName: active.tagName,
            text: active.textContent?.replace(/\\s+/g, " ").trim().slice(0, 200),
            ariaLabel: active.getAttribute("aria-label"),
            role: active.getAttribute("role"),
            connected: active.isConnected
          } : undefined;
        })(),
        inputs: [...(editor?.querySelectorAll('input') ?? [])].map((input) => ({
          type: input.type,
          value: input.value,
          checked: input.checked
        })),
        canvas: (() => {
          const canvas = document.querySelector('[aria-label="3D scene viewport"]');
          const rect = canvas?.getBoundingClientRect();
          return canvas && rect ? {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
            attributeWidth: canvas.width,
            attributeHeight: canvas.height,
            clientWidth: canvas.clientWidth,
            clientHeight: canvas.clientHeight
          } : undefined;
        })(),
        pointerEvents: window.__partbenchV19InputAudit?.pointerEvents?.slice(-8)
      });
    })()`).catch(() => "");
    throw new Error(
      `Timed out waiting for ${label}.${lastError ? ` ${lastError.message}` : ""}${pageText ? ` Page: ${pageText}` : ""}${interactionText ? ` Interaction: ${interactionText}` : ""}`
    );
  }

  async function focus(locator) {
    const result = await evaluate(
      `(${focusSemanticElement.toString()})(${JSON.stringify(locator)})`
    );
    if (!result?.ok) {
      throw new Error(result?.message ?? `Could not focus ${locator.kind}.`);
    }
  }

  async function sendKey(key, modifiers = {}) {
    const definition = getKeyDefinition(key);
    const modifierValue =
      (modifiers.altKey ? 1 : 0) |
      (modifiers.ctrlKey ? 2 : 0) |
      (modifiers.metaKey ? 4 : 0) |
      (modifiers.shiftKey ? 8 : 0);
    const keyEvent = {
      key: definition.key,
      code: definition.code,
      windowsVirtualKeyCode: definition.keyCode,
      nativeVirtualKeyCode: definition.keyCode,
      modifiers: modifierValue
    };
    await client.send(
      "Input.dispatchKeyEvent",
      {
        type: "rawKeyDown",
        ...keyEvent
      },
      sessionId
    );
    if (definition.text && modifierValue === 0) {
      await client.send(
        "Input.dispatchKeyEvent",
        {
          type: "char",
          ...keyEvent,
          text: definition.text,
          unmodifiedText: definition.text
        },
        sessionId
      );
    }
    await client.send(
      "Input.dispatchKeyEvent",
      { type: "keyUp", ...keyEvent },
      sessionId
    );
  }

  async function focusMode(mode) {
    const modeOrder = ["Project", "Solid", "Sketch", "Inspect"];
    const modeIndex = modeOrder.indexOf(mode);
    if (modeIndex < 0) throw new Error(`Unknown workbench mode ${mode}.`);
    await focus({ kind: "selectedMode", text: "selected mode" });
    await sendKey("Home");
    for (let index = 0; index < modeIndex; index += 1) {
      await sendKey("ArrowRight");
    }
    await waitFor(
      `document.activeElement?.textContent.trim() === ${JSON.stringify(mode)}`,
      `${mode} mode focus`
    );
  }

  async function getViewportClientPoint(worldPoint) {
    const rect = await evaluate(`(() => {
      const canvas = document.querySelector('[aria-label="3D scene viewport"]');
      if (!(canvas instanceof HTMLCanvasElement)) return undefined;
      const rect = canvas.getBoundingClientRect();
      return {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height
      };
    })()`);
    if (!rect) throw new Error("Could not resolve the viewport canvas.");
    const projected = projectDefaultCameraPoint(worldPoint, rect);
    if (!projected) {
      throw new Error(
        `Could not project viewport point ${worldPoint.join(", ")}.`
      );
    }
    return {
      x: rect.left + projected.x,
      y: rect.top + projected.y
    };
  }

  async function hoverViewportWorldPoint(worldPoint) {
    const point = await getViewportClientPoint(worldPoint);
    await client.send(
      "Input.dispatchMouseEvent",
      {
        type: "mouseMoved",
        x: point.x,
        y: point.y
      },
      sessionId
    );
  }

  async function clickViewportWorldPoint(worldPoint) {
    const point = await getViewportClientPoint(worldPoint);
    await client.send(
      "Input.dispatchMouseEvent",
      {
        type: "mouseMoved",
        x: point.x,
        y: point.y
      },
      sessionId
    );
    await client.send(
      "Input.dispatchMouseEvent",
      {
        type: "mousePressed",
        x: point.x,
        y: point.y,
        button: "left",
        buttons: 1,
        clickCount: 1
      },
      sessionId
    );
    await client.send(
      "Input.dispatchMouseEvent",
      {
        type: "mouseReleased",
        x: point.x,
        y: point.y,
        button: "left",
        buttons: 0,
        clickCount: 1
      },
      sessionId
    );
  }

  return {
    clickViewportWorldPoint,
    evaluate,
    focus,
    hoverViewportWorldPoint,
    insertText: (text) => client.send("Input.insertText", { text }, sessionId),
    async requestMode(mode) {
      await focusMode(mode);
      await sendKey("Enter");
    },
    sendKey,
    waitFor,
    async selectMode(mode) {
      await focusMode(mode);
      await sendKey("Enter");
      await waitFor(
        `document.querySelector('[aria-label="Workbench mode"] button[aria-selected="true"]')?.textContent.trim() === ${JSON.stringify(
          mode
        )}`,
        `${mode} mode`
      );
    },
    async activate(locator) {
      await focus(locator);
      await sendKey(locator.key ?? "Enter");
    }
  };
}

function focusSemanticElement(locator) {
  const normalize = (value) => (value ?? "").replace(/\s+/g, " ").trim();
  const visible = (element) =>
    Boolean(
      element &&
      !element.closest("[hidden]") &&
      element.getClientRects().length > 0 &&
      getComputedStyle(element).visibility !== "hidden"
    );
  const scope = locator.scope
    ? document.querySelector(locator.scope)
    : document;
  if (!scope) return { ok: false, message: `Missing scope ${locator.scope}` };

  let element;
  if (locator.kind === "selectedMode") {
    element = document.querySelector(
      '[aria-label="Workbench mode"] button[aria-selected="true"]'
    );
  } else if (locator.kind === "ribbonAction") {
    element = [
      ...document.querySelectorAll(
        ".pb-mode-ribbon__contents button.pb-ribbon-action"
      )
    ].find(
      (candidate) =>
        visible(candidate) &&
        normalize(candidate.textContent) === normalize(locator.text)
    );
  } else if (locator.kind === "workspaceButton") {
    element = [
      ...document.querySelectorAll(".pb-project-mode-workspace button")
    ].find(
      (candidate) =>
        visible(candidate) &&
        normalize(candidate.textContent) === normalize(locator.text)
    );
  } else if (locator.kind === "dialogButton") {
    element = [...document.querySelectorAll('[role="dialog"] button')].find(
      (candidate) =>
        visible(candidate) &&
        normalize(candidate.textContent) === normalize(locator.text)
    );
  } else if (locator.kind === "summary") {
    element = [...scope.querySelectorAll("summary")].find(
      (candidate) =>
        visible(candidate) &&
        normalize(candidate.textContent) === normalize(locator.text)
    );
  } else if (locator.kind === "labelControl") {
    const label = [...scope.querySelectorAll("label")].find(
      (candidate) =>
        visible(candidate) &&
        normalize(candidate.textContent) === normalize(locator.text)
    );
    element = label?.querySelector("input, select, textarea");
  } else if (locator.kind === "treeRow") {
    element = [
      ...document.querySelectorAll(
        '[aria-label="Document tree"] button.pb-tree-row__select'
      )
    ].find(
      (candidate) =>
        visible(candidate) &&
        normalize(
          candidate.querySelector(".pb-tree-row__label")?.textContent
        ) === normalize(locator.text)
    );
  } else if (locator.kind === "sketchEntity") {
    element = [
      ...document.querySelectorAll(
        '[aria-label="Sketch entities"] [role="option"]'
      )
    ].find(
      (candidate) =>
        visible(candidate) &&
        normalize(candidate.querySelector("small")?.textContent) ===
          normalize(locator.text)
    );
  } else if (locator.kind === "curveChoice") {
    element = [
      ...scope.querySelectorAll("button.pb-curve-edit__choice-row")
    ].find(
      (candidate) =>
        visible(candidate) &&
        normalize(candidate.textContent).includes(normalize(locator.text))
    );
  } else if (locator.kind === "ariaLabel") {
    element = [...document.querySelectorAll(`[aria-label]`)].find(
      (candidate) =>
        visible(candidate) &&
        candidate.getAttribute("aria-label") === locator.text
    );
  }

  if (!(element instanceof HTMLElement)) {
    return {
      ok: false,
      message: `Could not find ${locator.kind} "${locator.text}".`
    };
  }
  if (
    "disabled" in element &&
    (element.disabled || element.getAttribute("aria-disabled") === "true")
  ) {
    return {
      ok: false,
      message: `${locator.kind} "${locator.text}" is disabled.`
    };
  }
  element.focus();
  return {
    ok: document.activeElement === element,
    message: `Focus did not move to ${locator.kind} "${locator.text}".`
  };
}

function projectDefaultCameraPoint(point, size) {
  const focalLength = 700;
  const camera = {
    target: [0, 0, 0],
    yaw: Math.PI / 4,
    pitch: -Math.PI / 6,
    distance: 18
  };
  const cameraPosition = [
    camera.target[0] +
      camera.distance * Math.cos(camera.pitch) * Math.sin(camera.yaw),
    camera.target[1] -
      camera.distance * Math.cos(camera.pitch) * Math.cos(camera.yaw),
    camera.target[2] + camera.distance * Math.sin(camera.pitch)
  ];
  const forward = normalizeVec3(subtractVec3(camera.target, cameraPosition));
  const right = normalizeVec3(crossVec3(forward, [0, 0, 1]));
  const up = normalizeVec3(crossVec3(right, forward));
  const relative = subtractVec3(point, cameraPosition);
  const viewPoint = [
    dotVec3(relative, right),
    dotVec3(relative, up),
    -dotVec3(relative, forward)
  ];
  const depth = -viewPoint[2];
  if (depth <= 0.1) return undefined;
  return {
    x: size.width / 2 + (viewPoint[0] * focalLength) / depth,
    y: size.height / 2 - (viewPoint[1] * focalLength) / depth
  };
}

function subtractVec3(left, right) {
  return [left[0] - right[0], left[1] - right[1], left[2] - right[2]];
}

function dotVec3(left, right) {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

function crossVec3(left, right) {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0]
  ];
}

function normalizeVec3(vector) {
  const length = Math.hypot(vector[0], vector[1], vector[2]);
  return length === 0 ? [0, 0, 0] : vector.map((value) => value / length);
}

function getKeyDefinition(key) {
  switch (key) {
    case "Home":
      return { key: "Home", code: "Home", keyCode: 36 };
    case "ArrowRight":
      return { key: "ArrowRight", code: "ArrowRight", keyCode: 39 };
    case "Enter":
      return {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        text: "\r"
      };
    case " ":
      return { key: " ", code: "Space", keyCode: 32, text: " " };
    default:
      throw new Error(`Unsupported smoke key ${key}`);
  }
}

async function prepareAndReadProject(browser, expectedExtendEnd) {
  const detailsOpen = await browser.evaluate(
    `Boolean([...document.querySelectorAll('.pb-project-mode-workspace details')]
      .find((details) => details.querySelector(':scope > summary')?.textContent.trim() === 'Advanced Interchange')?.open)`
  );
  if (!detailsOpen) {
    await browser.activate({
      kind: "summary",
      text: "Advanced Interchange"
    });
  }
  await browser.activate({ kind: "workspaceButton", text: "Prepare JSON" });
  let project;
  await browser.waitFor(
    `(() => {
      try {
        const value = document.querySelector('.pb-project-mode-workspace textarea')?.value;
        const project = JSON.parse(value);
        const sketch = project.document.sketches.find((item) => item.id === 'sketch_1');
        const target = sketch?.entities.find((item) => item.id === 'extend_target');
        return JSON.stringify(target?.end) === ${JSON.stringify(
          JSON.stringify(expectedExtendEnd)
        )};
      } catch {
        return false;
      }
    })()`,
    `exported project with Extend end ${expectedExtendEnd.join(", ")}`
  );
  project = await browser.evaluate(
    `JSON.parse(document.querySelector('.pb-project-mode-workspace textarea').value)`
  );
  return project;
}

function inspectAuthoredState(project) {
  const sketch = project.document.sketches.find(
    (candidate) => candidate.id === "sketch_1"
  );
  const trimTarget = getLine(project, "trim_target");
  const secondTrimResult = sketch?.entities.find(
    (entity) =>
      entity.kind === "line" &&
      pointsEqual(entity.start, [7, 0]) &&
      pointsEqual(entity.end, [10, 0])
  );
  const trimTransaction = project.history.find(
    (transaction) => transaction.ops[0]?.op === "sketch.trim"
  );
  const extendTransaction = project.history.find(
    (transaction) => transaction.ops[0]?.op === "sketch.extend"
  );
  const trimDeletionRecorded =
    trimTransaction?.ops[0]?.deleteDimensionIds?.includes("trim_length") ===
    true;
  const trimDiffRecorded =
    trimTransaction?.diff?.sketches?.curveEdits?.[0]?.operation === "trim";
  const extendDiffRecorded =
    extendTransaction?.diff?.sketches?.curveEdits?.[0]?.operation === "extend";
  const ok =
    pointsEqual(trimTarget?.start, [0, 0]) &&
    pointsEqual(trimTarget?.end, [3, 0]) &&
    Boolean(secondTrimResult) &&
    hasLineEnd(project, "extend_target", [5, 4]) &&
    !project.document.sketchDimensions.some(
      (dimension) => dimension.id === "trim_length"
    ) &&
    project.document.sketchConstraints.some(
      (constraint) => constraint.id === "trim_horizontal"
    ) &&
    trimDeletionRecorded &&
    trimDiffRecorded &&
    extendDiffRecorded;
  return {
    ok,
    trimTarget: trimTarget
      ? { start: trimTarget.start, end: trimTarget.end }
      : undefined,
    secondTrimResultId: secondTrimResult?.id,
    extendEnd: getLine(project, "extend_target")?.end,
    dimensionRemoved: !project.document.sketchDimensions.some(
      (dimension) => dimension.id === "trim_length"
    ),
    constraintPreserved: project.document.sketchConstraints.some(
      (constraint) => constraint.id === "trim_horizontal"
    ),
    trimDeletionRecorded,
    trimDiffRecorded,
    extendDiffRecorded
  };
}

function inspectTrimState(project) {
  const sketch = project.document.sketches.find(
    (candidate) => candidate.id === "sketch_1"
  );
  return (
    hasLineEnd(project, "trim_target", [3, 0]) &&
    sketch?.entities.some(
      (entity) =>
        entity.kind === "line" &&
        pointsEqual(entity.start, [7, 0]) &&
        pointsEqual(entity.end, [10, 0])
    ) === true &&
    !project.document.sketchDimensions.some(
      (dimension) => dimension.id === "trim_length"
    )
  );
}

function getLine(project, entityId) {
  return project.document.sketches
    .flatMap((sketch) => sketch.entities)
    .find((entity) => entity.id === entityId && entity.kind === "line");
}

function hasLineEnd(project, entityId, end) {
  return pointsEqual(getLine(project, entityId)?.end, end);
}

function pointsEqual(left, right) {
  return (
    Array.isArray(left) &&
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function isTruthy(value) {
  return value === "true" || value === "1";
}
