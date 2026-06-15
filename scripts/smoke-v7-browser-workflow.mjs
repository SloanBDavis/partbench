import { spawn } from "node:child_process";
import { mkdir, rm, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createV7BrowserWorkflowSmokeResult,
  formatV7BrowserWorkflowSmokeSummary,
  getV7BrowserWorkflowRequiredCheckIds
} from "./v7-browser-workflow.mjs";
import {
  connectToBrowser,
  findBrowserExecutable,
  getAvailablePort,
  startStaticServer
} from "./occt-smoke/browser.mjs";

/* global Blob, clearTimeout, DataTransfer, document, Event, File, getComputedStyle, HTMLDetailsElement, HTMLInputElement, HTMLSelectElement, HTMLTextAreaElement, KeyboardEvent, MouseEvent, Node, PointerEvent, TextDecoder, window */

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const appDistDir = join(repoRoot, "apps/web/dist");
const appHtmlPath = join(appDistDir, "index.html");
const smokeTimeoutMs = 30_000;
const smokeOptions = parseSmokeOptions(process.argv.slice(2), process.env);

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
    smokeTimeoutMs,
    smokeOptions
  );
  console.log(formatV7BrowserWorkflowSmokeSummary(result));
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.ok ? 0 : 1;
} finally {
  await closeCdpClient(client);
  await stopBrowserProcess(browserProcess);
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

function parseSmokeOptions(args, env) {
  const requireGlbDownload =
    isTruthy(env.PARTBENCH_V7_BROWSER_WORKFLOW_REQUIRE_GLB) ||
    isTruthy(env.V7_BROWSER_WORKFLOW_REQUIRE_GLB);
  const requireDerivedMeshCache = isTruthy(
    env.PARTBENCH_V8_WCAD_WORKFLOW_REQUIRE_DERIVED_CACHE
  );

  let nextRequireGlbDownload = requireGlbDownload;
  let nextRequireDerivedMeshCache = requireDerivedMeshCache;

  for (const arg of args) {
    if (arg === "--require-glb" || arg === "--require-glb-download") {
      nextRequireGlbDownload = true;
      continue;
    }

    if (arg === "--no-require-glb" || arg === "--no-require-glb-download") {
      nextRequireGlbDownload = false;
      continue;
    }

    if (arg === "--require-derived-mesh-cache") {
      nextRequireDerivedMeshCache = true;
      continue;
    }

    if (arg === "--no-require-derived-mesh-cache") {
      nextRequireDerivedMeshCache = false;
      continue;
    }

    throw new Error(`Unknown option ${arg}`);
  }

  return {
    requireGlbDownload: nextRequireGlbDownload,
    requireDerivedMeshCache: nextRequireDerivedMeshCache
  };
}

function isTruthy(value) {
  return value === "true" || value === "1";
}

async function closeCdpClient(clientToClose) {
  if (!clientToClose) {
    return;
  }

  await Promise.race([clientToClose.close(), waitForMilliseconds(1_000)]).catch(
    () => {}
  );
}

async function stopBrowserProcess(processToStop) {
  if (!processToStop) {
    return;
  }

  if (processToStop.exitCode !== null || processToStop.signalCode !== null) {
    return;
  }

  processToStop.kill("SIGTERM");
  const stopped = await waitForProcessExit(processToStop, 2_000);

  if (!stopped) {
    processToStop.kill("SIGKILL");
    await waitForProcessExit(processToStop, 2_000);
  }
}

function waitForProcessExit(processToStop, timeoutMs) {
  return new Promise((resolvePromise) => {
    const timeout = setTimeout(() => {
      processToStop.off("exit", onExit);
      resolvePromise(false);
    }, timeoutMs);

    function onExit() {
      clearTimeout(timeout);
      resolvePromise(true);
    }

    processToStop.once("exit", onExit);
  });
}

function waitForMilliseconds(milliseconds) {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, milliseconds);
  });
}

async function runV7BrowserWorkflowSmoke(
  client,
  appUrl,
  timeoutMs,
  { requireGlbDownload = false, requireDerivedMeshCache = false } = {}
) {
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
        requireDerivedMeshCache,
        requireGlbDownload,
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

  const pageResultValue = result.result?.value;
  const pageResult = {
    checks: Array.isArray(pageResultValue?.checks)
      ? pageResultValue.checks
      : [],
    ids:
      pageResultValue && typeof pageResultValue.ids === "object"
        ? pageResultValue.ids
        : {},
    skipped: Array.isArray(pageResultValue?.skipped)
      ? pageResultValue.skipped
      : []
  };
  if (
    !Array.isArray(pageResultValue?.checks) &&
    pageResultValue?.ok === false
  ) {
    exceptions.push("V7 browser workflow smoke did not return check details.");
  }
  const narrowViewportResult = await runNarrowViewportSmoke(
    client,
    sessionId,
    Math.min(timeoutMs, 8_000)
  );
  pageResult.checks.push(...narrowViewportResult.checks);
  pageResult.skipped.push(...narrowViewportResult.skipped);

  return createV7BrowserWorkflowSmokeResult({
    checks: pageResult.checks,
    ids: pageResult.ids,
    skipped: pageResult.skipped,
    requiredCheckIds: getV7BrowserWorkflowRequiredCheckIds({
      requireDerivedMeshCache,
      requireGlbDownload
    }),
    consoleErrors,
    exceptions
  });
}

async function runNarrowViewportSmoke(client, sessionId, timeoutMs) {
  try {
    await client.send(
      "Emulation.setDeviceMetricsOverride",
      {
        width: 390,
        height: 740,
        deviceScaleFactor: 1,
        mobile: true
      },
      sessionId
    );

    const result = await client.send(
      "Runtime.evaluate",
      {
        awaitPromise: true,
        returnByValue: true,
        expression: `(${v7BrowserWorkflowNarrowViewportSmoke.toString()})(${JSON.stringify(
          { timeoutMs }
        )})`
      },
      sessionId
    );

    if (result.exceptionDetails) {
      return {
        checks: [
          {
            id: "viewport-narrow-layout-smoke",
            label: "narrow viewport keeps the model surface visible",
            status: "fail",
            detail:
              result.exceptionDetails.exception?.description ??
              result.exceptionDetails.text ??
              "Narrow viewport smoke failed."
          }
        ],
        skipped: []
      };
    }

    const value = result.result?.value;
    return {
      checks: Array.isArray(value?.checks) ? value.checks : [],
      skipped: Array.isArray(value?.skipped) ? value.skipped : []
    };
  } catch (error) {
    return {
      checks: [
        {
          id: "viewport-narrow-layout-smoke",
          label: "narrow viewport keeps the model surface visible",
          status: "fail",
          detail: error instanceof Error ? error.message : String(error)
        }
      ],
      skipped: []
    };
  } finally {
    await client
      .send("Emulation.clearDeviceMetricsOverride", {}, sessionId)
      .catch(() => {});
  }
}

async function v7BrowserWorkflowSmoke({
  requireDerivedMeshCache,
  requireGlbDownload,
  timeoutMs
}) {
  const ids = {
    attachedEntityId: "v7_smoke_attached_rect",
    attachedSketchId: "v7_smoke_attached_sketch",
    attachedSketchName: "V7 smoke attached face sketch",
    bodyId: "v7_smoke_body",
    bodyName: "V7 smoke rectangle body",
    circleBodyId: "v7_smoke_circle_body",
    circleBodyName: "V7 smoke circle body",
    circleEntityId: "v7_smoke_circle",
    circleFeatureId: "v7_smoke_circle_feature",
    cutBodyId: "v7_smoke_cut_body",
    cutBodyName: "V7 smoke cut result",
    cutFeatureId: "v7_smoke_cut_feature",
    entityId: "v7_smoke_rect",
    featureId: "v7_smoke_feature",
    namedReference: "v7_smoke_top_face",
    projectFileName: "v7-browser-workflow-roundtrip.json",
    wcadFileName: "v8-browser-workflow-roundtrip.wcad",
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
    () => Boolean(findDetailsBySummary(document.body, "Workspace tools")),
    "workspace tools drawer"
  );
  openDetailsBySummary(document.body, "Workspace tools");
  const advancedToolTabs = getElementByAriaLabel("Tool tabs");
  const advancedToolText = normalize(advancedToolTabs.textContent);
  const expectedToolTabs = ["Sketches", "Log"];
  const removedToolTabs = ["Batch", "Mesh", "File"];
  const missingExpectedToolTabs = expectedToolTabs.filter(
    (label) => !includesText(advancedToolTabs, label)
  );
  const visibleRemovedToolTabs = removedToolTabs.filter((label) =>
    includesText(advancedToolTabs, label)
  );

  if (missingExpectedToolTabs.length > 0 || visibleRemovedToolTabs.length > 0) {
    fail(
      "advanced-tools-cleanup",
      "Workspace tools exposes only Sketches and Log",
      [
        missingExpectedToolTabs.length > 0
          ? `missing=${missingExpectedToolTabs.join(", ")}`
          : undefined,
        visibleRemovedToolTabs.length > 0
          ? `removed-visible=${visibleRemovedToolTabs.join(", ")}`
          : undefined,
        `tabs=${advancedToolText}`
      ]
        .filter(Boolean)
        .join("; ")
    );
  } else {
    pass(
      "advanced-tools-cleanup",
      "Workspace tools hides File, Batch, and Mesh cleanup targets",
      advancedToolText
    );
  }

  const scrollability = probeUtilityPanelScrollability(
    "utility-panel-sketches"
  );
  if (scrollability.ok) {
    pass(
      "advanced-tools-scrollability",
      "Workspace tools panel content scrolls when it overflows",
      scrollability.detail
    );
  } else {
    fail(
      "advanced-tools-scrollability",
      "Workspace tools panel content scrolls when it overflows",
      scrollability.detail
    );
  }

  clickButtonContaining(advancedToolTabs, "Sketches");

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
  const entityEditor = await waitForSectionByAriaLabel(
    "Sketch entity editor",
    "rectangle entity editor"
  );
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
  setFieldByLabel(featureEditor, "Optional name", ids.bodyName);
  clickButton(featureEditor, "Create extrude");
  await waitFor(
    () =>
      includesText(getElementByAriaLabel("Model structure"), ids.bodyName) ||
      includesText(getElementByAriaLabel("Inspector"), ids.bodyId),
    "created deterministic extrude body"
  );
  pass("create-extrude", "created deterministic newBody extrude", ids.bodyId);

  clickButtonContaining(getElementByAriaLabel("Add sketch entity"), "Circle");
  const circleEntityEditor = await waitForSectionByAriaLabel(
    "Sketch entity editor",
    "circle entity editor"
  );
  setSelectByLabel(circleEntityEditor, "Entity", "circle");
  setInputByDetailsSummary(
    circleEntityEditor,
    "Optional ID",
    ids.circleEntityId
  );
  setFieldByLabel(circleEntityEditor, "Center X", "3");
  setFieldByLabel(circleEntityEditor, "Center Y", "0");
  setFieldByLabel(circleEntityEditor, "Radius", "0.5");
  clickButton(circleEntityEditor, "Add entity");
  await waitFor(
    () =>
      includesText(
        getElementByAriaLabel("Select sketch entity"),
        ids.circleEntityId
      ),
    "created deterministic circle"
  );
  pass(
    "create-circle",
    "created deterministic circle profile",
    ids.circleEntityId
  );

  const circleFeatureEditor = getSectionByAriaLabel("Create authored feature");
  setFieldByLabel(circleFeatureEditor, "Depth", "1");
  setSelectByLabel(circleFeatureEditor, "Operation", "newBody");
  setFieldByLabel(
    circleFeatureEditor,
    "Optional feature ID",
    ids.circleFeatureId
  );
  setFieldByLabel(circleFeatureEditor, "Optional body ID", ids.circleBodyId);
  setFieldByLabel(circleFeatureEditor, "Optional name", ids.circleBodyName);
  clickButton(circleFeatureEditor, "Create extrude");
  await waitFor(
    () =>
      includesText(
        getElementByAriaLabel("Model structure"),
        ids.circleBodyName
      ) || includesText(getElementByAriaLabel("Inspector"), ids.circleBodyId),
    "created deterministic circle extrude body"
  );
  pass(
    "create-circle-extrude",
    "created deterministic circle newBody extrude",
    ids.circleBodyId
  );

  openTreePanel();
  const modelStructure = getElementByAriaLabel("Model structure");
  const modeling = getSectionByAriaLabel("Modeling context");
  clickButtonContaining(modelStructure, ids.circleBodyName);
  openSelectionPanel();

  await waitForBodyCommandReady(
    ids.circleBodyId,
    "circle body command-ready reference state"
  );
  pass(
    "circle-body-reference-contract",
    "feature tree circle body selection shows command-ready semantic reference state",
    getSelectionText()
  );

  openTreePanel();
  clickButtonContaining(modelStructure, ids.bodyName);
  await waitFor(
    () => includesText(getElementByAriaLabel("Inspector"), ids.bodyId),
    "rectangle body selected before circle viewport body pick"
  );
  clickViewportWorldPoint([3, 0, 0.5]);
  await waitFor(
    () => isTreePanelOpen(),
    "circle viewport body pick preserved preferred tree tab"
  );
  openSelectionPanel();
  await waitForBodyCommandReady(
    ids.circleBodyId,
    "circle viewport body pick command-ready reference state"
  );
  pass(
    "circle-viewport-body-pick-selection-routing",
    "circle body viewport pick routes through semantic selection and remains command-ready",
    getSelectionText()
  );

  openTreePanel();
  clickViewportWorldPoint([3, 0, 1]);
  await waitFor(
    () => isTreePanelOpen(),
    "circle viewport generated face pick preserved preferred tree tab"
  );
  openSelectionPanel();
  await waitForGeneratedReferenceCommandReady(
    ids.circleBodyId,
    "circle viewport generated face pick command-ready reference state"
  );
  pass(
    "circle-viewport-generated-face-pick-selection-routing",
    "circle generated planar cap face pick routes through semantic generated-reference selection",
    getSelectionText()
  );

  openTreePanel();
  clickViewportWorldPoint([3.5, 0, 1]);
  await waitFor(
    () => isTreePanelOpen(),
    "circle viewport generated edge pick preserved preferred tree tab"
  );
  openSelectionPanel();
  await waitForGeneratedEdgeReferenceCommandReady(
    ids.circleBodyId,
    "circle viewport generated edge pick command-ready reference state"
  );
  pass(
    "circle-viewport-generated-edge-pick-selection-routing",
    "circle generated circular edge pick routes through semantic generated-reference selection",
    getSelectionText()
  );

  openTreePanel();
  clickViewportAtRatio(0.5, 0.5);
  await waitFor(
    () => isTreePanelOpen(),
    "viewport body pick preserved preferred tree tab"
  );
  openSelectionPanel();
  await waitForBodyCommandReady(
    ids.bodyId,
    "viewport body pick command-ready reference state"
  );
  pass(
    "viewport-body-pick-selection-routing",
    "viewport body pick routes through semantic selection without forcing the Selection tab",
    getSelectionText()
  );
  exerciseViewportNavigationControls();
  await waitForBodyCommandReady(
    ids.bodyId,
    "viewport body remains command-ready after camera controls"
  );
  pass(
    "viewport-navigation-camera-controls",
    "fit all, fit selected, and standard views keep viewport selection usable",
    getViewportNavigationControlsText()
  );
  await waitForViewportContextualCommands(
    ["Measure", "Inspect"],
    "viewport body contextual measure and inspect commands"
  );
  clickViewportContextualCommand("Measure");
  await waitForViewportContextualDetail(
    ["Body measurement", "Authority: source-analytic exact", "Volume"],
    "viewport body measure details"
  );
  clickViewportContextualCommand("Inspect");
  await waitForViewportContextualDetail(
    ["Inspect body", "Authority: source-analytic exact", "Commands"],
    "viewport body inspect details"
  );
  pass(
    "viewport-body-measure-inspect",
    "viewport body measure and inspect expose source-authoritative single-target details",
    getViewportContextualCommandText()
  );
  assertViewportUsableAndUnobstructed(
    "viewport-unobstructed-after-navigation-measurement",
    "navigation controls and measurement details keep the viewport unobstructed"
  );
  assertViewportResponsiveTextReadability(
    "viewport-responsive-text-readability",
    "viewport contextual and status text remains readable without overlap"
  );

  openTreePanel();
  clickViewportAtRatio(0.5, 0.5);
  await waitFor(
    () => isTreePanelOpen(),
    "viewport generated face pick preserved preferred tree tab"
  );
  openSelectionPanel();
  await waitForGeneratedReferenceCommandReady(
    ids.bodyId,
    "viewport generated face pick command-ready reference state"
  );
  pass(
    "viewport-generated-face-pick-selection-routing",
    "viewport generated planar face pick routes through semantic selection without forcing the Selection tab",
    getSelectionText()
  );
  await waitForViewportContextualCommands(
    ["Create sketch", "Name", "Measure", "Inspect"],
    "viewport generated face contextual commands"
  );
  pass(
    "viewport-generated-face-contextual-actions",
    "viewport generated planar face exposes compact command-ready contextual actions",
    getViewportContextualCommandText()
  );
  clickViewportContextualCommand("Measure");
  await waitForViewportContextualDetail(
    ["Face measurement", "Authority: source-analytic exact", "Area"],
    "viewport generated face measure details"
  );
  clickViewportContextualCommand("Inspect");
  await waitForViewportContextualDetail(
    ["Inspect target", "Face:", "Create sketch on face"],
    "viewport generated face inspect details"
  );
  pass(
    "viewport-generated-face-measure-inspect",
    "viewport generated planar face measure and inspect expose source-authoritative single-target details",
    getViewportContextualCommandText()
  );
  clickViewportContextualCommand("Measure");
  await waitForViewportContextualDetail(
    ["Two-target measure", "Start two-target"],
    "viewport two-target measure start affordance"
  );
  clickViewportContextualCommand("Start two-target");
  await waitForViewportContextualDetail(
    ["Two-target measure", "Select a second supported target", "First"],
    "viewport two-target first target session prompt"
  );

  openTreePanel();
  clickViewportWorldPoint([1, 0, 0]);
  await waitFor(
    () => isTreePanelOpen(),
    "viewport generated edge pick preserved preferred tree tab"
  );
  openSelectionPanel();
  await waitForGeneratedEdgeReferenceCommandReady(
    ids.bodyId,
    "viewport generated edge pick command-ready reference state"
  );
  pass(
    "viewport-generated-edge-pick-selection-routing",
    "viewport generated edge pick routes through semantic selection without forcing the Selection tab",
    getSelectionText()
  );
  await waitForViewportContextualCommands(
    ["Name", "Chamfer", "Fillet", "Measure", "Inspect"],
    "viewport generated edge contextual commands"
  );
  pass(
    "viewport-generated-edge-contextual-actions",
    "viewport generated edge exposes compact command-ready contextual actions",
    getViewportContextualCommandText()
  );
  clickViewportContextualCommand("Measure");
  await waitForViewportContextualDetail(
    [
      "Edge measurement",
      "Authority: source-analytic exact",
      "Length",
      "Two-target measure",
      "Distance",
      "Angle"
    ],
    "viewport generated edge measure details"
  );
  clickViewportContextualCommand("Use selected as second");
  await waitForViewportContextualDetail(
    [
      "Two-target measurement complete",
      "Distance",
      "Angle",
      "Authority: source-analytic exact"
    ],
    "viewport two-target distance and angle measure details"
  );
  pass(
    "viewport-two-target-measure",
    "viewport face-to-edge two-target measure exposes source-authoritative distance and angle",
    getViewportContextualCommandText()
  );
  clickViewportContextualCommand("Inspect");
  await waitForViewportContextualDetail(
    ["Inspect target", "Edge:", "Chamfer", "Fillet"],
    "viewport generated edge inspect details"
  );
  pass(
    "viewport-generated-edge-measure-inspect",
    "viewport generated edge measure and inspect expose source-authoritative single-target details",
    getViewportContextualCommandText()
  );
  dispatchEscapeOutsideEditable();
  await waitFor(() => {
    const viewport = getElementByAriaLabel("3D viewport");
    const surface = getViewportContextualCommandSurface(viewport);
    const text = normalize(surface.textContent);
    const detail = viewport.querySelector(
      [
        '[aria-label="Viewport inspect"]',
        '[aria-label="Viewport measure"]'
      ].join(",")
    );
    const staleSessionText =
      text.includes("Two-target:") ||
      text.includes("Two-target measurement complete") ||
      text.includes("First") ||
      text.includes("Pending");

    if (detail || staleSessionText) {
      throw new Error(
        `detail=${detail ? "visible" : "none"}; surface=${compactText(
          surface.textContent,
          320
        )}`
      );
    }

    return true;
  }, "Escape cleared viewport contextual detail and two-target session");
  pass(
    "viewport-escape-clears-transient-detail",
    "Escape outside editable controls clears active two-target measurement and contextual detail",
    getViewportContextualCommandText()
  );

  openTreePanel();
  clickButtonContaining(getElementByAriaLabel("Model structure"), ids.bodyName);
  openSelectionPanel();

  await waitForBodyCommandReady(
    ids.bodyId,
    "body command-ready reference state"
  );
  pass(
    "body-reference-contract",
    "feature tree body selection shows command-ready semantic reference state",
    getSelectionText()
  );
  assertViewportHasNoSelectionDetails();

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

  const inspector = getElementByAriaLabel("Inspector");
  const referenceSelect = getControlByLabel(inspector, "Inspect reference");
  const faceOption = [...referenceSelect.querySelectorAll("option")].find(
    (option) => option.value.includes(":face:")
  );

  if (!faceOption) {
    fail(
      "generated-reference-candidate",
      "selection tab exposes generated face reference candidate",
      normalize(referenceSelect.textContent)
    );
  } else {
    const selectedFaceLabel = normalize(faceOption.textContent);
    setSelectByLabel(inspector, "Inspect reference", faceOption.value);
    await waitFor(
      () =>
        includesText(
          getElementByAriaLabel("Inspector"),
          "Selected reference"
        ) && includesText(getElementByAriaLabel("Inspector"), "Command-ready"),
      "selected generated reference"
    );
    pass(
      "generated-reference-selection",
      "selected generated face through selection-tab reference candidates",
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

    openTreePanel();
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
        () => isTreePanelOpen(),
        "named reference selection keeps preferred tree tab"
      );
      openSelectionPanel();
      await waitFor(
        () =>
          includesText(getElementByAriaLabel("Inspector"), ids.namedReference),
        "reselected named reference"
      );
      pass(
        "named-reference-route",
        "named reference routes to command-ready generated reference without forcing the Selection tab"
      );
    }

    setFieldByLabel(inspector, "Sketch name", ids.attachedSketchName);
    setInputByDetailsSummary(
      inspector,
      "Advanced sketch options",
      ids.attachedSketchId
    );
    clickButton(inspector, "Create attached sketch");
    await waitFor(
      () =>
        includesText(getElementByAriaLabel("Model structure"), "Attached") &&
        includesText(
          getElementByAriaLabel("Model structure"),
          ids.attachedSketchName
        ),
      "created attached sketch on generated face"
    );
    pass(
      "attached-sketch-create",
      "created a sketch on a supported generated planar face",
      ids.attachedSketchId
    );

    clickButtonContaining(getElementByAriaLabel("Tool tabs"), "Sketches");
    await waitFor(() => {
      const activeSketch = getControlByLabel(
        getSectionByAriaLabel("Sketches"),
        "Active sketch"
      );

      return [...activeSketch.querySelectorAll("option")].some(
        (option) => option.value === ids.attachedSketchId
      );
    }, "attached sketch active-sketch option");
    setSelectByLabel(
      getSectionByAriaLabel("Sketches"),
      "Active sketch",
      ids.attachedSketchId
    );
    await waitFor(
      () =>
        getControlByLabel(getSectionByAriaLabel("Sketches"), "Active sketch")
          .value === ids.attachedSketchId,
      "attached sketch became active"
    );
    pass(
      "attached-sketch-active",
      "attached sketch appears in model structure and becomes active through command state",
      ids.attachedSketchName
    );

    clickButton(getElementByAriaLabel("Add sketch entity"), "Rectangle");
    const attachedEntityEditor = await waitForSectionByAriaLabel(
      "Sketch entity editor",
      "attached rectangle entity editor"
    );
    setSelectByLabel(attachedEntityEditor, "Entity", "rectangle");
    setInputByDetailsSummary(
      attachedEntityEditor,
      "Optional ID",
      ids.attachedEntityId
    );
    setFieldByLabel(attachedEntityEditor, "Width", "0.5");
    setFieldByLabel(attachedEntityEditor, "Height", "0.5");
    clickButton(attachedEntityEditor, "Add entity");
    await waitFor(
      () =>
        includesText(
          getElementByAriaLabel("Select sketch entity"),
          ids.attachedEntityId
        ),
      "created deterministic attached rectangle"
    );

    let attachedFeatureEditor = getSectionByAriaLabel(
      "Create authored feature"
    );
    setFieldByLabel(attachedFeatureEditor, "Depth", "0.5");
    setSelectByLabel(attachedFeatureEditor, "Operation", "cut");
    await waitFor(
      () =>
        Boolean(
          queryControlByLabel(
            getSectionByAriaLabel("Create authored feature"),
            "Target body"
          )
        ),
      "cut target body control"
    );
    attachedFeatureEditor = getSectionByAriaLabel("Create authored feature");
    setSelectByLabel(attachedFeatureEditor, "Target body", ids.bodyId);
    setFieldByLabel(
      attachedFeatureEditor,
      "Optional feature ID",
      ids.cutFeatureId
    );
    setFieldByLabel(attachedFeatureEditor, "Optional body ID", ids.cutBodyId);
    setFieldByLabel(attachedFeatureEditor, "Optional name", ids.cutBodyName);
    clickButton(attachedFeatureEditor, "Create extrude");
    await waitFor(
      () =>
        includesText(getElementByAriaLabel("Model structure"), ids.cutBodyName),
      "created deterministic cut result body"
    );
    pass(
      "attached-cut-create",
      "created a deterministic cut to exercise consumed-reference diagnostics",
      ids.cutBodyId
    );

    openTreePanel();
    clickButtonContaining(
      getElementByAriaLabel("Model structure"),
      ids.bodyName
    );
    openSelectionPanel();
    await waitForConsumedDiagnostic();
    pass(
      "consumed-body-diagnostic",
      "consumed body selection shows structured reference diagnostics",
      getDiagnosticText()
    );
  }

  openDetailsBySummary(document.body, "Project/File");
  const projectPanel = getSectionByAriaLabel("Project");
  await waitFor(
    () =>
      includesText(projectPanel, "Project contents") &&
      includesText(projectPanel, "Export readiness"),
    "project file panel"
  );
  const projectChecks = [
    assertIncludes(projectPanel, "web-cad.project.v16", "current-json-schema"),
    assertIncludes(projectPanel, "Untitled project", "untitled-project"),
    assertIncludes(projectPanel, "Not saved", "not-saved-state"),
    assertIncludes(projectPanel, "Open .wcad", "wcad-open-action"),
    assertIncludes(projectPanel, "Save As", "wcad-save-as-action"),
    assertIncludes(projectPanel, "Storage availability", "storage-status"),
    assertIncludes(projectPanel, "JSON import/export", "json-storage-mode"),
    assertIncludes(projectPanel, "Direct open/save", "direct-file-status"),
    assertIncludes(projectPanel, "Local mesh cache", "opfs-capability-status"),
    assertIncludes(projectPanel, "Local mesh cache", "opfs-cache-status"),
    assertIncludes(projectPanel, "Clear cache", "opfs-cache-clear-action"),
    assertIncludes(
      projectPanel,
      "Optional rebuildable cache",
      "opfs-cache-boundary"
    ),
    assertIncludes(projectPanel, ".wcad project file", "wcad-deferred-status"),
    assertIncludes(projectPanel, "STEP", "step-export-status"),
    assertIncludes(projectPanel, "Download STEP", "step-download-action"),
    assertIncludes(projectPanel, "Mesh/GLB visualization", "mesh-glb-status")
  ];
  if (projectChecks.every(Boolean)) {
    pass(
      "project-file-panel",
      "Project/File panel is primary and reports .wcad workflow, JSON debug/interchange, storage capability, and export readiness"
    );
  }

  const stepDownloadCapture = createDownloadCapture();
  stepDownloadCapture.install();
  clickButton(projectPanel, "Download STEP");
  await waitFor(() => {
    if (stepDownloadCapture.blobs.length === 0) {
      throw new Error("No STEP blob download was captured.");
    }

    if (!includesText(projectPanel, "Downloaded partbench-export.step")) {
      throw new Error(compactText(projectPanel.textContent, 520));
    }

    return true;
  }, "downloaded exact STEP artifact");
  const stepBytes = await stepDownloadCapture.readFirstBytes();
  stepDownloadCapture.restore();
  const stepText = new TextDecoder().decode(stepBytes.slice(0, 160));

  if (!stepText.includes("ISO-10303-21")) {
    throw new Error("Downloaded STEP artifact does not contain ISO-10303-21.");
  }

  pass(
    "step-download",
    "Download STEP produced a real exact STEP artifact through the geometry boundary",
    `${stepBytes.byteLength} bytes`
  );

  pass(
    "project-opfs-cache-status",
    "Project/File panel reports OPFS cache status without becoming a viewport overlay"
  );

  clickButton(projectPanel, "Clear cache");
  await waitFor(
    () =>
      includesText(projectPanel, "OPFS cache cleared") ||
      includesText(projectPanel, "OPFS cache was already empty") ||
      includesText(projectPanel, "OPFS is unavailable in this browser"),
    "cleared OPFS cache"
  );
  pass(
    "project-opfs-cache-clear",
    "cleared OPFS cache without blocking project workflow",
    compactText(projectPanel.textContent, 260)
  );

  const downloadCapture = createDownloadCapture();
  downloadCapture.install();
  clickButton(projectPanel, "Save As");
  await waitFor(() => {
    if (downloadCapture.blobs.length === 0) {
      throw new Error("No .wcad blob download was captured.");
    }

    if (!includesText(projectPanel, "Downloaded .wcad package")) {
      throw new Error(compactText(projectPanel.textContent, 520));
    }

    return true;
  }, "downloaded .wcad package through fallback Save As");
  const wcadBytes = await downloadCapture.readFirstBytes();
  downloadCapture.restore();
  pass(
    "project-wcad-save-as-download",
    "Save As .wcad produced a package through fallback download",
    `${wcadBytes.byteLength} bytes`
  );

  loadProjectWcadFileIntoInput(projectPanel, wcadBytes, ids.wcadFileName);
  await waitFor(
    () =>
      includesText(projectPanel, `Opened ${ids.wcadFileName}`) &&
      includesText(projectPanel, "Uploaded .wcad") &&
      includesText(projectPanel, "partbench.wcad.v1"),
    "opened uploaded .wcad package"
  );
  pass(
    "project-wcad-open-upload",
    "opened the saved .wcad package through upload fallback",
    ids.wcadFileName
  );

  await waitForRoundTripModelStructure();
  pass(
    "project-wcad-roundtrip-model",
    ".wcad round-trip preserves feature tree, attached sketch, and named reference",
    compactText(getElementByAriaLabel("Model structure").textContent)
  );

  const derivedMeshCacheObserved = () => {
    const text = normalize(projectPanel.textContent);
    return /Health:\s*[1-9]\d*\s+valid/.test(text);
  };

  if (derivedMeshCacheObserved()) {
    pass(
      "project-opfs-derived-mesh-cache",
      "Project/File panel reports a derived visualization mesh cache entry",
      compactText(projectPanel.textContent, 260)
    );
  } else if (requireDerivedMeshCache) {
    try {
      await waitFor(() => {
        if (!derivedMeshCacheObserved()) {
          throw new Error(compactText(projectPanel.textContent, 520));
        }

        return true;
      }, "derived mesh OPFS cache entry");
      pass(
        "project-opfs-derived-mesh-cache",
        "Project/File panel reports a derived visualization mesh cache entry",
        compactText(projectPanel.textContent, 260)
      );
    } catch (error) {
      fail(
        "project-opfs-derived-mesh-cache",
        "Project/File panel reports a derived visualization mesh cache entry",
        error instanceof Error ? error.message : String(error)
      );
    }
  } else {
    skipped.push({
      id: "project-opfs-derived-mesh-cache",
      reason:
        includesText(projectPanel, "StorageUnavailable") ||
        includesText(projectPanel, "OPFS is unavailable")
          ? "OPFS is unavailable in this browser runtime."
          : "No derived mesh cache entry was observed during the optional smoke path."
    });
  }

  const wcadViewport = getElementByAriaLabel("3D viewport");
  const wcadViewportRect = wcadViewport.getBoundingClientRect();
  if (wcadViewportRect.width > 120 && wcadViewportRect.height > 120) {
    pass(
      "project-wcad-viewport-usable",
      ".wcad round-trip leaves viewport visible and usable",
      `viewport=${Math.round(wcadViewportRect.width)}x${Math.round(
        wcadViewportRect.height
      )}`
    );
  } else {
    fail(
      "project-wcad-viewport-usable",
      ".wcad round-trip leaves viewport visible and usable",
      `viewport=${Math.round(wcadViewportRect.width)}x${Math.round(
        wcadViewportRect.height
      )}`
    );
  }
  assertViewportUsableAndUnobstructed(
    "project-roundtrip-viewport-unobstructed",
    "project round-trip keeps the viewport visible and unobstructed"
  );

  clickButton(projectPanel, "Export JSON");
  await waitFor(() => {
    const projectText = compactText(projectPanel.textContent, 520);
    const projectJson = getProjectJsonEditorValue(projectPanel);
    const ready =
      includesText(projectPanel, "Import draft") &&
      includesText(projectPanel, "No document source change detected") &&
      projectJson.trim().startsWith("{");

    if (!ready) {
      throw new Error(
        `projectPanel=${projectText}; jsonStart=${projectJson
          .trim()
          .slice(0, 120)}`
      );
    }

    return true;
  }, "generated project JSON preview");
  assertExportedProjectJsonIncludes(getProjectJsonEditorValue(projectPanel));
  pass(
    "project-json-export-preview",
    "generated project JSON preview preserves feature tree and named references",
    "web-cad.project.v16"
  );

  const exportedProjectJson = getProjectJsonEditorValue(projectPanel);
  loadProjectJsonFileIntoInput(
    projectPanel,
    exportedProjectJson,
    ids.projectFileName
  );
  await waitFor(
    () =>
      includesText(projectPanel, `Loaded ${ids.projectFileName}`) &&
      includesText(projectPanel, "Loaded file") &&
      includesText(projectPanel, "Import draft") &&
      includesText(projectPanel, "No document source change detected"),
    "loaded project JSON import preview"
  );
  pass(
    "project-json-load-preview",
    "loaded project JSON through the Project/File import preview path",
    ids.projectFileName
  );

  clickButton(projectPanel, "Import JSON");
  await waitFor(
    () =>
      includesText(projectPanel, "Imported web-cad.project.v16") &&
      includesText(getElementByAriaLabel("Model structure"), ids.bodyName),
    "imported project JSON"
  );
  pass(
    "project-json-import",
    "imported the generated project JSON through the Project/File path"
  );

  await waitForRoundTripModelStructure();
  pass(
    "project-json-roundtrip-model",
    "project JSON round-trip preserves feature tree, attached sketch, and named reference",
    compactText(getElementByAriaLabel("Model structure").textContent)
  );

  openTreePanel();
  clickButtonContaining(getElementByAriaLabel("Model structure"), ids.bodyName);
  openSelectionPanel();
  await waitForConsumedDiagnostic();
  pass(
    "project-json-roundtrip-diagnostic",
    "project JSON round-trip preserves selection/reference diagnostics",
    getDiagnosticText()
  );

  if (requireGlbDownload) {
    await waitFor(() => {
      const requiredGlbButton = getButtonByText(
        projectPanel,
        "Download visualization GLB"
      );

      if (!requiredGlbButton) {
        throw new Error("Download visualization GLB button is not present.");
      }

      if (requiredGlbButton.disabled) {
        throw new Error(
          `Download visualization GLB is disabled: ${getExportReadinessText()}`
        );
      }

      return true;
    }, "required visualization GLB download readiness");
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

  async function waitForBodyCommandReady(bodyId, label) {
    await waitFor(() => {
      const currentInspector = getElementByAriaLabel("Inspector");
      const currentModeling = getSectionByAriaLabel("Modeling context");
      const ready =
        isSelectionPanelOpen() &&
        includesText(currentInspector, bodyId) &&
        includesText(currentInspector, "Command-ready reference") &&
        includesText(currentModeling, "Reference contract") &&
        includesText(currentModeling, "Command-ready reference");

      if (!ready) {
        throw new Error(
          [
            `selectionPanelOpen=${isSelectionPanelOpen() ? "true" : "false"}`,
            `inspector=${normalize(currentInspector.textContent).slice(0, 180)}`,
            `modeling=${normalize(currentModeling.textContent).slice(0, 180)}`
          ].join("; ")
        );
      }

      return true;
    }, label);
  }

  async function waitForGeneratedReferenceCommandReady(bodyId, label) {
    await waitFor(() => {
      const currentInspector = getElementByAriaLabel("Inspector");
      const currentModeling = getSectionByAriaLabel("Modeling context");
      const ready =
        isSelectionPanelOpen() &&
        includesText(currentInspector, bodyId) &&
        includesText(currentInspector, "Selected reference") &&
        includesText(currentInspector, "Command-ready") &&
        includesText(currentModeling, "Reference contract") &&
        includesText(currentModeling, "Command-ready reference") &&
        includesText(currentModeling, "Create sketch on face");

      if (!ready) {
        throw new Error(
          [
            `selectionPanelOpen=${isSelectionPanelOpen() ? "true" : "false"}`,
            `inspector=${normalize(currentInspector.textContent).slice(0, 180)}`,
            `modeling=${normalize(currentModeling.textContent).slice(0, 180)}`
          ].join("; ")
        );
      }

      return true;
    }, label);
  }

  async function waitForGeneratedEdgeReferenceCommandReady(bodyId, label) {
    await waitFor(() => {
      const currentInspector = getElementByAriaLabel("Inspector");
      const currentModeling = getSectionByAriaLabel("Modeling context");
      const ready =
        isSelectionPanelOpen() &&
        includesText(currentInspector, bodyId) &&
        includesText(currentInspector, "Selected reference") &&
        includesText(currentInspector, "Command-ready") &&
        includesText(currentModeling, "Reference contract") &&
        includesText(currentModeling, "Command-ready reference") &&
        includesText(currentModeling, "Edge finish") &&
        includesText(currentModeling, "Chamfer") &&
        includesText(currentModeling, "Fillet");

      if (!ready) {
        throw new Error(
          [
            `selectionPanelOpen=${isSelectionPanelOpen() ? "true" : "false"}`,
            `inspector=${normalize(currentInspector.textContent).slice(0, 180)}`,
            `modeling=${normalize(currentModeling.textContent).slice(0, 180)}`
          ].join("; ")
        );
      }

      return true;
    }, label);
  }

  async function waitForConsumedDiagnostic() {
    await waitFor(() => {
      const inspector = getElementByAriaLabel("Inspector");
      const modelingContext = getSectionByAriaLabel("Modeling context");
      const ready =
        isSelectionPanelOpen() &&
        includesText(inspector, "Selection body consumed") &&
        includesText(inspector, ids.cutFeatureId) &&
        includesText(modelingContext, "Selection body consumed");

      if (!ready) {
        throw new Error(
          [
            `selectionPanelOpen=${isSelectionPanelOpen() ? "true" : "false"}`,
            `inspector=${normalize(inspector.textContent).slice(0, 180)}`,
            `modeling=${normalize(modelingContext.textContent).slice(0, 180)}`
          ].join("; ")
        );
      }

      return true;
    }, "consumed body structured diagnostics");
  }

  function assertViewportHasNoSelectionDetails() {
    const viewport = getElementByAriaLabel("3D viewport");
    const obsoleteDetailSurface = viewport.querySelector(
      [
        '[aria-label="Viewport interaction summary"]',
        '[aria-label="Viewport reference candidates"]',
        '[aria-label="Viewport selection diagnostics"]',
        ".viewport-interaction-surface"
      ].join(",")
    );

    if (obsoleteDetailSurface) {
      fail(
        "viewport-unobstructed-selection-layout",
        "selection details stay out of the viewport",
        normalize(obsoleteDetailSurface.textContent)
      );
      return;
    }

    pass(
      "viewport-unobstructed-selection-layout",
      "selection details live in the left Selection tab, not over the viewport"
    );
  }

  function assertViewportUsableAndUnobstructed(id, label) {
    const viewport = getElementByAriaLabel("3D viewport");
    const canvas = getElementByAriaLabel("3D scene viewport");
    const viewportRect = viewport.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const obsoleteDetailSurface = viewport.querySelector(
      [
        '[aria-label="Viewport interaction summary"]',
        '[aria-label="Viewport reference candidates"]',
        '[aria-label="Viewport selection diagnostics"]',
        ".viewport-interaction-surface"
      ].join(",")
    );
    const contextualSurface = viewport.querySelector(
      '[aria-label="Viewport contextual commands"]'
    );
    const contextualRect = contextualSurface?.getBoundingClientRect();
    const viewportArea = Math.max(1, viewportRect.width * viewportRect.height);
    const contextualAreaRatio = contextualRect
      ? (contextualRect.width * contextualRect.height) / viewportArea
      : 0;
    const centerElement = document.elementFromPoint(
      viewportRect.left + viewportRect.width / 2,
      viewportRect.top + viewportRect.height / 2
    );
    const issues = [];

    if (viewportRect.width <= 160 || viewportRect.height <= 160) {
      issues.push(
        `viewport=${Math.round(viewportRect.width)}x${Math.round(
          viewportRect.height
        )}`
      );
    }

    if (canvasRect.width <= 120 || canvasRect.height <= 120) {
      issues.push(
        `canvas=${Math.round(canvasRect.width)}x${Math.round(
          canvasRect.height
        )}`
      );
    }

    if (obsoleteDetailSurface) {
      issues.push(
        `obsolete-detail=${compactText(obsoleteDetailSurface.textContent, 160)}`
      );
    }

    if (contextualAreaRatio > 0.22) {
      issues.push(`contextualAreaRatio=${contextualAreaRatio.toFixed(3)}`);
    }

    if (!centerElement || !viewport.contains(centerElement)) {
      issues.push(
        `centerElement=${
          centerElement
            ? `${centerElement.tagName.toLowerCase()} ${compactText(
                centerElement.textContent,
                80
              )}`
            : "none"
        }`
      );
    }

    if (issues.length > 0) {
      fail(id, label, issues.join("; "));
      return;
    }

    pass(
      id,
      label,
      [
        `viewport=${Math.round(viewportRect.width)}x${Math.round(
          viewportRect.height
        )}`,
        `canvas=${Math.round(canvasRect.width)}x${Math.round(
          canvasRect.height
        )}`,
        `contextualAreaRatio=${contextualAreaRatio.toFixed(3)}`
      ].join("; ")
    );
  }

  function assertViewportResponsiveTextReadability(id, label) {
    const result = probeViewportResponsiveTextReadability();

    if (!result.ok) {
      fail(id, label, result.detail);
      return;
    }

    pass(id, label, result.detail);
  }

  function probeViewportResponsiveTextReadability({
    checkPageOverflow = false
  } = {}) {
    const viewport = getElementByAriaLabel("3D viewport");
    const contextualSurface = viewport.querySelector(
      '[aria-label="Viewport contextual commands"]'
    );
    const status = viewport.querySelector('[aria-label="Viewport status"]');
    const issues = [];
    const details = [];

    if (contextualSurface) {
      const contextualIssues = collectReadableTextIssues(contextualSurface, [
        ".viewport-contextual-heading strong",
        ".viewport-contextual-heading span",
        ".viewport-contextual-detail-heading strong",
        ".viewport-contextual-detail-heading span",
        ".viewport-contextual-actions button",
        ".viewport-contextual-mini-actions button",
        ".viewport-contextual-diagnostic",
        ".viewport-contextual-authority",
        ".viewport-contextual-session-status",
        ".viewport-contextual-detail dt",
        ".viewport-contextual-detail dd",
        ".viewport-contextual-reference-list button span",
        ".viewport-contextual-reference-list button strong"
      ]);
      issues.push(...contextualIssues);

      const style = getComputedStyle(contextualSurface);
      if (
        contextualSurface.scrollHeight > contextualSurface.clientHeight + 1 &&
        style.overflowY !== "auto" &&
        style.overflowY !== "scroll"
      ) {
        issues.push(
          `contextual surface overflow is not scrollable; overflow-y=${style.overflowY}`
        );
      }

      details.push(
        `contextual=${Math.round(
          contextualSurface.getBoundingClientRect().width
        )}x${Math.round(contextualSurface.getBoundingClientRect().height)}`
      );
    }

    if (status) {
      issues.push(
        ...collectReadableTextIssues(status, [
          ".viewport-status strong",
          ".viewport-status span"
        ])
      );
      details.push(
        `status=${Math.round(status.getBoundingClientRect().width)}x${Math.round(
          status.getBoundingClientRect().height
        )}`
      );
    }

    if (contextualSurface && status) {
      const overlap = getRectOverlapArea(
        contextualSurface.getBoundingClientRect(),
        status.getBoundingClientRect()
      );

      if (overlap > 1) {
        issues.push(`contextual/status overlap=${Math.round(overlap)}px^2`);
      }
    }

    if (checkPageOverflow) {
      const scrollWidth = document.documentElement.scrollWidth;
      const clientWidth = document.documentElement.clientWidth;

      if (scrollWidth > clientWidth + 2) {
        issues.push(
          `horizontal page overflow scrollWidth=${scrollWidth}, clientWidth=${clientWidth}`
        );
      }
    }

    return {
      ok: issues.length === 0,
      detail:
        issues.length > 0
          ? issues.join("; ")
          : details.length > 0
            ? details.join("; ")
            : "no contextual/status text present"
    };
  }

  function collectReadableTextIssues(root, selectors) {
    const issues = [];
    const elements = root.querySelectorAll(selectors.join(","));

    for (const element of elements) {
      const text = normalize(element.textContent);
      const rect = element.getBoundingClientRect();

      if (!text || rect.width <= 0 || rect.height <= 0) {
        continue;
      }

      const style = getComputedStyle(element);
      const clippedX =
        element.scrollWidth > element.clientWidth + 1 &&
        style.overflowX !== "visible";
      const clippedY =
        element.scrollHeight > element.clientHeight + 1 &&
        style.overflowY === "hidden";

      if (style.whiteSpace === "nowrap" || clippedX || clippedY) {
        issues.push(
          `${element.className || element.tagName.toLowerCase()} clipped or nowrap: ${compactText(
            text,
            96
          )}`
        );
      }
    }

    return issues;
  }

  function getRectOverlapArea(leftRect, rightRect) {
    const width = Math.max(
      0,
      Math.min(leftRect.right, rightRect.right) -
        Math.max(leftRect.left, rightRect.left)
    );
    const height = Math.max(
      0,
      Math.min(leftRect.bottom, rightRect.bottom) -
        Math.max(leftRect.top, rightRect.top)
    );

    return width * height;
  }

  function dispatchEscapeOutsideEditable() {
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: "Escape"
      })
    );
  }

  function exerciseViewportNavigationControls() {
    const controls = getViewportNavigationControls();
    const expectedLabels = [
      "Fit all",
      "Fit selected",
      "Reset",
      "+",
      "-",
      "Top",
      "Front",
      "Right",
      "Iso"
    ];
    const missingLabels = expectedLabels.filter(
      (label) => !includesText(controls, label)
    );

    if (missingLabels.length > 0) {
      fail(
        "viewport-navigation-camera-controls",
        "viewport exposes compact navigation and standard-view controls",
        `missing=${missingLabels.join(",")}; controls=${normalize(
          controls.textContent
        )}`
      );
      return;
    }

    clickButton(controls, "Fit all");
    clickButton(controls, "Fit selected");
    clickButton(controls, "Top");
    clickButton(controls, "Iso");
    clickButton(controls, "Reset");
  }

  function getViewportNavigationControlsText() {
    return compactText(getViewportNavigationControls().textContent, 240);
  }

  function getViewportNavigationControls() {
    return getElementByAriaLabel("Viewport controls");
  }

  async function waitForViewportContextualCommands(labels, label) {
    await waitFor(() => {
      const viewport = getElementByAriaLabel("3D viewport");
      const surface = getViewportContextualCommandSurface(viewport);
      const text = normalize(surface.textContent);
      const missingLabels = labels.filter(
        (requiredLabel) => !text.includes(requiredLabel)
      );
      const viewportRect = viewport.getBoundingClientRect();
      const surfaceRect = surface.getBoundingClientRect();
      const viewportArea = Math.max(
        1,
        viewportRect.width * viewportRect.height
      );
      const surfaceAreaRatio =
        (surfaceRect.width * surfaceRect.height) / viewportArea;

      if (missingLabels.length > 0 || surfaceAreaRatio > 0.22) {
        throw new Error(
          [
            `missing=${missingLabels.join(",") || "none"}`,
            `surfaceAreaRatio=${surfaceAreaRatio.toFixed(3)}`,
            `surface=${compactText(surface.textContent, 260)}`
          ].join("; ")
        );
      }

      return true;
    }, label);
  }

  function clickViewportContextualCommand(label) {
    const viewport = getElementByAriaLabel("3D viewport");
    const surface = getViewportContextualCommandSurface(viewport);

    clickButtonContaining(surface, label);
  }

  async function waitForViewportContextualDetail(labels, label) {
    await waitFor(() => {
      const viewport = getElementByAriaLabel("3D viewport");
      const surface = getViewportContextualCommandSurface(viewport);
      const text = normalize(surface.textContent);
      const missingLabels = labels.filter(
        (requiredLabel) => !text.includes(requiredLabel)
      );
      const viewportRect = viewport.getBoundingClientRect();
      const surfaceRect = surface.getBoundingClientRect();
      const viewportArea = Math.max(
        1,
        viewportRect.width * viewportRect.height
      );
      const surfaceAreaRatio =
        (surfaceRect.width * surfaceRect.height) / viewportArea;

      if (missingLabels.length > 0 || surfaceAreaRatio > 0.22) {
        throw new Error(
          [
            `missing=${missingLabels.join(",") || "none"}`,
            `surfaceAreaRatio=${surfaceAreaRatio.toFixed(3)}`,
            `surface=${compactText(surface.textContent, 300)}`
          ].join("; ")
        );
      }

      return true;
    }, label);
  }

  function getViewportContextualCommandText() {
    return compactText(
      getViewportContextualCommandSurface(getElementByAriaLabel("3D viewport"))
        .textContent,
      360
    );
  }

  function getViewportContextualCommandSurface(viewport) {
    const surface = viewport.querySelector(
      '[aria-label="Viewport contextual commands"]'
    );

    if (!surface) {
      throw new Error("Could not find viewport contextual commands.");
    }

    return surface;
  }

  async function waitForRoundTripModelStructure() {
    await waitFor(() => {
      const structure = getElementByAriaLabel("Model structure");
      const requiredText = [
        ids.bodyName,
        ids.circleBodyName,
        ids.attachedSketchName,
        ids.cutBodyName,
        ids.namedReference,
        "Hidden input / replaced by result"
      ];

      return requiredText.every((text) => includesText(structure, text));
    }, "round-tripped model structure");
  }

  function assertExportedProjectJsonIncludes(projectJson) {
    let project;

    try {
      project = JSON.parse(projectJson);
    } catch (error) {
      fail(
        "project-json-export-parse",
        "generated project JSON parses",
        error instanceof Error ? error.message : "Unknown JSON parse error."
      );
      return;
    }

    const requiredSnippets = [
      ids.bodyId,
      ids.circleBodyId,
      ids.attachedSketchId,
      ids.cutFeatureId,
      ids.cutBodyName,
      ids.namedReference
    ];
    const missing = requiredSnippets.filter(
      (snippet) => !projectJson.includes(snippet)
    );

    if (project.schemaVersion !== "web-cad.project.v16") {
      missing.push("schemaVersion:web-cad.project.v16");
    }

    if (missing.length > 0) {
      fail(
        "project-json-export-preview",
        "generated project JSON preview preserves feature tree and named references",
        `Missing ${missing.join(", ")}`
      );
    }
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

  function openTreePanel() {
    clickButtonContaining(getElementByAriaLabel("Model browser tabs"), "Tree");
  }

  function openSelectionPanel() {
    clickButtonContaining(
      getElementByAriaLabel("Model browser tabs"),
      "Selection"
    );
  }

  function isSelectionPanelOpen() {
    return (
      document.getElementById("model-browser-panel-selection")?.hidden === false
    );
  }

  function isTreePanelOpen() {
    return (
      document.getElementById("model-browser-panel-tree")?.hidden === false
    );
  }

  function getSelectionText() {
    return compactText(getElementByAriaLabel("Inspector").textContent, 520);
  }

  function getExportReadinessText() {
    return compactText(
      getElementByAriaLabel("Export readiness").textContent,
      520
    );
  }

  function getDiagnosticText() {
    return compactText(getElementByAriaLabel("Inspector").textContent, 360);
  }

  function clickViewportAtRatio(xRatio, yRatio) {
    const canvas = getElementByAriaLabel("3D scene viewport");
    const rect = canvas.getBoundingClientRect();
    const clientX = rect.left + rect.width * xRatio;
    const clientY = rect.top + rect.height * yRatio;

    clickViewportClientPoint(clientX, clientY);
  }

  function clickViewportWorldPoint(point) {
    const canvas = getElementByAriaLabel("3D scene viewport");
    const rect = canvas.getBoundingClientRect();
    const projected = projectDefaultCameraPoint(point, {
      width: rect.width,
      height: rect.height
    });

    if (!projected) {
      throw new Error(`Could not project viewport point ${point.join(",")}.`);
    }

    clickViewportClientPoint(rect.left + projected.x, rect.top + projected.y);
  }

  function clickViewportClientPoint(clientX, clientY) {
    const canvas = getElementByAriaLabel("3D scene viewport");
    const pointerId = 9001;

    canvas.dispatchEvent(
      createPointerEvent("pointerdown", {
        button: 0,
        buttons: 1,
        clientX,
        clientY,
        pointerId
      })
    );
    canvas.dispatchEvent(
      createPointerEvent("pointerup", {
        button: 0,
        buttons: 0,
        clientX,
        clientY,
        pointerId
      })
    );
  }

  function createPointerEvent(type, init) {
    const options = {
      bubbles: true,
      cancelable: true,
      pointerType: "mouse",
      isPrimary: true,
      ...init
    };

    return typeof PointerEvent === "function"
      ? new PointerEvent(type, options)
      : new MouseEvent(type, options);
  }

  function projectDefaultCameraPoint(point, size) {
    const focalLength = 700;
    const camera = {
      target: [0, 0, 0],
      yaw: Math.PI / 4,
      pitch: -Math.PI / 6,
      distance: 18
    };
    const cameraPosition = getDefaultCameraPosition(camera);
    const viewPoint = worldToDefaultCamera(point, camera, cameraPosition);
    const depth = -viewPoint[2];

    if (depth <= 0.1) {
      return undefined;
    }

    return {
      x: size.width / 2 + (viewPoint[0] * focalLength) / depth,
      y: size.height / 2 - (viewPoint[1] * focalLength) / depth
    };
  }

  function getDefaultCameraPosition(camera) {
    return [
      camera.target[0] +
        camera.distance * Math.cos(camera.pitch) * Math.sin(camera.yaw),
      camera.target[1] -
        camera.distance * Math.cos(camera.pitch) * Math.cos(camera.yaw),
      camera.target[2] + camera.distance * Math.sin(camera.pitch)
    ];
  }

  function worldToDefaultCamera(point, camera, cameraPosition) {
    const forward = normalizeVec3(subtractVec3(camera.target, cameraPosition));
    const right = normalizeVec3(crossVec3(forward, [0, 0, 1]));
    const up = normalizeVec3(crossVec3(right, forward));
    const relative = subtractVec3(point, cameraPosition);

    return [
      dotVec3(relative, right),
      dotVec3(relative, up),
      -dotVec3(relative, forward)
    ];
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
    return length === 0
      ? [0, 0, 0]
      : [vector[0] / length, vector[1] / length, vector[2] / length];
  }

  function getProjectJsonEditorValue(projectPanel) {
    const editor = getDetailsBySummary(
      projectPanel,
      "JSON debug/interchange"
    ).querySelector("textarea");

    if (!(editor instanceof HTMLTextAreaElement)) {
      throw new Error("Project JSON editor has no textarea.");
    }

    return editor.value;
  }

  function loadProjectJsonFileIntoInput(projectPanel, projectJson, fileName) {
    const input = projectPanel.querySelector(
      'input[type="file"][accept="application/json,.json"]'
    );

    if (!(input instanceof HTMLInputElement)) {
      throw new Error("Project JSON file input was not found.");
    }

    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(
      new File([projectJson], fileName, { type: "application/json" })
    );
    Object.defineProperty(input, "files", {
      configurable: true,
      value: dataTransfer.files
    });
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function loadProjectWcadFileIntoInput(projectPanel, bytes, fileName) {
    const input = projectPanel.querySelector(
      'input[type="file"][accept*=".wcad"]'
    );

    if (!(input instanceof HTMLInputElement)) {
      throw new Error("Project .wcad file input was not found.");
    }

    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(
      new File([bytes], fileName, {
        type: "application/vnd.partbench.wcad"
      })
    );
    Object.defineProperty(input, "files", {
      configurable: true,
      value: dataTransfer.files
    });
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function createDownloadCapture() {
    const blobs = [];
    const originalCreateObjectUrl = URL.createObjectURL.bind(URL);
    const originalRevokeObjectUrl = URL.revokeObjectURL.bind(URL);

    return {
      blobs,
      install() {
        URL.createObjectURL = (value) => {
          if (value instanceof Blob) {
            blobs.push(value);
          }

          return originalCreateObjectUrl(value);
        };
      },
      restore() {
        URL.createObjectURL = originalCreateObjectUrl;
        URL.revokeObjectURL = originalRevokeObjectUrl;
      },
      async readFirstBytes() {
        const blob = blobs[0];

        if (!(blob instanceof Blob)) {
          throw new Error("No captured download blob is available.");
        }

        return new Uint8Array(await blob.arrayBuffer());
      }
    };
  }

  async function waitForSectionByAriaLabel(label, waitLabel) {
    await waitFor(
      () => Boolean(document.querySelector(`section[aria-label="${label}"]`)),
      waitLabel
    );

    return getSectionByAriaLabel(label);
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
    const control = queryControlByLabel(scope, label);

    if (!control) {
      throw new Error(`Could not find control labelled ${label}.`);
    }

    return control;
  }

  function queryControlByLabel(scope, label) {
    const matchingLabel = [...scope.querySelectorAll("label")].find(
      (candidate) => getDirectLabelText(candidate) === label
    );

    return matchingLabel?.querySelector("input, select, textarea");
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

  function probeUtilityPanelScrollability(panelId) {
    const panel = document.getElementById(panelId);

    if (!panel) {
      return { ok: false, detail: `${panelId} was not found.` };
    }

    const { clientHeight, scrollHeight } = panel;
    const maxScrollTop = scrollHeight - clientHeight;
    const overflowY = getComputedStyle(panel).overflowY;

    if (maxScrollTop <= 4) {
      return {
        ok: true,
        detail: `${panelId} did not overflow in this viewport; overflow-y=${overflowY}, clientHeight=${clientHeight}, scrollHeight=${scrollHeight}.`
      };
    }

    const initialScrollTop = panel.scrollTop;
    panel.scrollTop = Math.min(maxScrollTop, initialScrollTop + 96);
    const nextScrollTop = panel.scrollTop;
    panel.scrollTop = initialScrollTop;

    return nextScrollTop > initialScrollTop
      ? {
          ok: true,
          detail: `${panelId} scrolled from ${initialScrollTop} to ${nextScrollTop}; overflow-y=${overflowY}, clientHeight=${clientHeight}, scrollHeight=${scrollHeight}.`
        }
      : {
          ok: false,
          detail: `${panelId} overflowed but did not scroll; overflow-y=${overflowY}, clientHeight=${clientHeight}, scrollHeight=${scrollHeight}.`
        };
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

async function v7BrowserWorkflowNarrowViewportSmoke({ timeoutMs }) {
  const checks = [];
  const skipped = [];

  try {
    await waitFor(
      () =>
        window.innerWidth <= 640 || document.documentElement.clientWidth <= 640,
      "narrow viewport metrics"
    );

    const viewport = getElementByAriaLabel("3D viewport");
    viewport.scrollIntoView({ block: "center", inline: "nearest" });
    await delay(100);

    const canvas = getElementByAriaLabel("3D scene viewport");
    const viewportRect = viewport.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const contextualSurface = viewport.querySelector(
      '[aria-label="Viewport contextual commands"]'
    );
    const contextualRect = contextualSurface?.getBoundingClientRect();
    const viewportArea = Math.max(1, viewportRect.width * viewportRect.height);
    const contextualAreaRatio = contextualRect
      ? (contextualRect.width * contextualRect.height) / viewportArea
      : 0;
    const obsoleteDetailSurface = viewport.querySelector(
      [
        '[aria-label="Viewport interaction summary"]',
        '[aria-label="Viewport reference candidates"]',
        '[aria-label="Viewport selection diagnostics"]',
        ".viewport-interaction-surface"
      ].join(",")
    );
    const centerElement = document.elementFromPoint(
      viewportRect.left + viewportRect.width / 2,
      viewportRect.top + viewportRect.height / 2
    );
    const issues = [];

    if (window.innerWidth > 640 && document.documentElement.clientWidth > 640) {
      issues.push(
        `viewport metrics did not narrow: innerWidth=${window.innerWidth}, clientWidth=${document.documentElement.clientWidth}`
      );
    }

    if (viewportRect.width < 280 || viewportRect.height < 280) {
      issues.push(
        `viewport=${Math.round(viewportRect.width)}x${Math.round(
          viewportRect.height
        )}`
      );
    }

    if (canvasRect.width < 240 || canvasRect.height < 220) {
      issues.push(
        `canvas=${Math.round(canvasRect.width)}x${Math.round(
          canvasRect.height
        )}`
      );
    }

    if (contextualAreaRatio > 0.42) {
      issues.push(`contextualAreaRatio=${contextualAreaRatio.toFixed(3)}`);
    }

    if (obsoleteDetailSurface) {
      issues.push(
        `obsolete-detail=${compactText(obsoleteDetailSurface.textContent, 160)}`
      );
    }

    if (!centerElement || !viewport.contains(centerElement)) {
      issues.push(
        `centerElement=${
          centerElement
            ? `${centerElement.tagName.toLowerCase()} ${compactText(
                centerElement.textContent,
                80
              )}`
            : "none"
        }`
      );
    }

    if (issues.length > 0) {
      fail(
        "viewport-narrow-layout-smoke",
        "narrow viewport keeps the model surface visible",
        issues.join("; ")
      );
    } else {
      pass(
        "viewport-narrow-layout-smoke",
        "narrow viewport keeps the model surface visible",
        [
          `innerWidth=${window.innerWidth}`,
          `viewport=${Math.round(viewportRect.width)}x${Math.round(
            viewportRect.height
          )}`,
          `canvas=${Math.round(canvasRect.width)}x${Math.round(
            canvasRect.height
          )}`,
          `contextualAreaRatio=${contextualAreaRatio.toFixed(3)}`
        ].join("; ")
      );
    }

    const readability = probeViewportResponsiveTextReadability({
      checkPageOverflow: true
    });

    if (readability.ok) {
      pass(
        "viewport-narrow-scroll-readability",
        "narrow viewport avoids text clipping and scroll traps",
        readability.detail
      );
    } else {
      fail(
        "viewport-narrow-scroll-readability",
        "narrow viewport avoids text clipping and scroll traps",
        readability.detail
      );
    }
  } catch (error) {
    fail(
      "viewport-narrow-layout-smoke",
      "narrow viewport keeps the model surface visible",
      error instanceof Error ? error.message : String(error)
    );
    fail(
      "viewport-narrow-scroll-readability",
      "narrow viewport avoids text clipping and scroll traps",
      error instanceof Error ? error.message : String(error)
    );
  }

  return { checks, skipped };

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
      }`
    );
  }

  function delay(milliseconds) {
    return new Promise((resolvePromise) => {
      setTimeout(resolvePromise, milliseconds);
    });
  }

  function getElementByAriaLabel(label) {
    const element = document.querySelector(`[aria-label="${label}"]`);

    if (!element) {
      throw new Error(`Could not find element labelled ${label}.`);
    }

    return element;
  }

  function probeViewportResponsiveTextReadability({
    checkPageOverflow = false
  } = {}) {
    const viewport = getElementByAriaLabel("3D viewport");
    const contextualSurface = viewport.querySelector(
      '[aria-label="Viewport contextual commands"]'
    );
    const status = viewport.querySelector('[aria-label="Viewport status"]');
    const issues = [];
    const details = [];

    if (contextualSurface) {
      issues.push(
        ...collectReadableTextIssues(contextualSurface, [
          ".viewport-contextual-heading strong",
          ".viewport-contextual-heading span",
          ".viewport-contextual-detail-heading strong",
          ".viewport-contextual-detail-heading span",
          ".viewport-contextual-actions button",
          ".viewport-contextual-mini-actions button",
          ".viewport-contextual-diagnostic",
          ".viewport-contextual-authority",
          ".viewport-contextual-session-status",
          ".viewport-contextual-detail dt",
          ".viewport-contextual-detail dd",
          ".viewport-contextual-reference-list button span",
          ".viewport-contextual-reference-list button strong"
        ])
      );

      const style = getComputedStyle(contextualSurface);
      if (
        contextualSurface.scrollHeight > contextualSurface.clientHeight + 1 &&
        style.overflowY !== "auto" &&
        style.overflowY !== "scroll"
      ) {
        issues.push(
          `contextual surface overflow is not scrollable; overflow-y=${style.overflowY}`
        );
      }

      details.push(
        `contextual=${Math.round(
          contextualSurface.getBoundingClientRect().width
        )}x${Math.round(contextualSurface.getBoundingClientRect().height)}`
      );
    }

    if (status) {
      issues.push(
        ...collectReadableTextIssues(status, [
          ".viewport-status strong",
          ".viewport-status span"
        ])
      );
      details.push(
        `status=${Math.round(status.getBoundingClientRect().width)}x${Math.round(
          status.getBoundingClientRect().height
        )}`
      );
    }

    if (contextualSurface && status) {
      const overlap = getRectOverlapArea(
        contextualSurface.getBoundingClientRect(),
        status.getBoundingClientRect()
      );

      if (overlap > 1) {
        issues.push(`contextual/status overlap=${Math.round(overlap)}px^2`);
      }
    }

    if (checkPageOverflow) {
      const scrollWidth = document.documentElement.scrollWidth;
      const clientWidth = document.documentElement.clientWidth;

      if (scrollWidth > clientWidth + 2) {
        issues.push(
          `horizontal page overflow scrollWidth=${scrollWidth}, clientWidth=${clientWidth}`
        );
      }
    }

    return {
      ok: issues.length === 0,
      detail:
        issues.length > 0
          ? issues.join("; ")
          : details.length > 0
            ? details.join("; ")
            : "no contextual/status text present"
    };
  }

  function collectReadableTextIssues(root, selectors) {
    const issues = [];
    const elements = root.querySelectorAll(selectors.join(","));

    for (const element of elements) {
      const text = normalize(element.textContent);
      const rect = element.getBoundingClientRect();

      if (!text || rect.width <= 0 || rect.height <= 0) {
        continue;
      }

      const style = getComputedStyle(element);
      const clippedX =
        element.scrollWidth > element.clientWidth + 1 &&
        style.overflowX !== "visible";
      const clippedY =
        element.scrollHeight > element.clientHeight + 1 &&
        style.overflowY === "hidden";

      if (style.whiteSpace === "nowrap" || clippedX || clippedY) {
        issues.push(
          `${element.className || element.tagName.toLowerCase()} clipped or nowrap: ${compactText(
            text,
            96
          )}`
        );
      }
    }

    return issues;
  }

  function getRectOverlapArea(leftRect, rightRect) {
    const width = Math.max(
      0,
      Math.min(leftRect.right, rightRect.right) -
        Math.max(leftRect.left, rightRect.left)
    );
    const height = Math.max(
      0,
      Math.min(leftRect.bottom, rightRect.bottom) -
        Math.max(leftRect.top, rightRect.top)
    );

    return width * height;
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
}
