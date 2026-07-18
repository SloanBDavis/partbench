import { spawn } from "node:child_process";
import { mkdir, rm, stat } from "node:fs/promises";
import { register } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
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
const loaderPath = new URL("./ts-source-loader.mjs", import.meta.url);
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
  const requireV10Workflow = isTruthy(
    env.PARTBENCH_V10_BROWSER_WORKFLOW_REQUIRED
  );
  const requireV12Workflow = isTruthy(
    env.PARTBENCH_V12_BROWSER_WORKFLOW_REQUIRED
  );
  const requireV13Workflow = isTruthy(
    env.PARTBENCH_V13_BROWSER_WORKFLOW_REQUIRED
  );
  const requireV14Workflow = isTruthy(
    env.PARTBENCH_V14_BROWSER_WORKFLOW_REQUIRED
  );
  const requireV17Workflow = isTruthy(
    env.PARTBENCH_V17_BROWSER_WORKFLOW_REQUIRED
  );

  let nextRequireGlbDownload = requireGlbDownload;
  let nextRequireDerivedMeshCache = requireDerivedMeshCache;
  let nextRequireV10Workflow = requireV10Workflow;
  let nextRequireV12Workflow = requireV12Workflow;
  let nextRequireV13Workflow = requireV13Workflow;
  let nextRequireV14Workflow = requireV14Workflow;
  let nextRequireV17Workflow = requireV17Workflow;

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

    if (arg === "--require-v10-workflow") {
      nextRequireV10Workflow = true;
      continue;
    }

    if (arg === "--no-require-v10-workflow") {
      nextRequireV10Workflow = false;
      continue;
    }

    if (arg === "--require-v12-workflow") {
      nextRequireV12Workflow = true;
      continue;
    }

    if (arg === "--no-require-v12-workflow") {
      nextRequireV12Workflow = false;
      continue;
    }

    if (arg === "--require-v13-workflow") {
      nextRequireV13Workflow = true;
      continue;
    }

    if (arg === "--no-require-v13-workflow") {
      nextRequireV13Workflow = false;
      continue;
    }

    if (arg === "--require-v14-workflow") {
      nextRequireV14Workflow = true;
      continue;
    }

    if (arg === "--no-require-v14-workflow") {
      nextRequireV14Workflow = false;
      continue;
    }

    if (arg === "--require-v17-workflow") {
      nextRequireV17Workflow = true;
      continue;
    }

    if (arg === "--no-require-v17-workflow") {
      nextRequireV17Workflow = false;
      continue;
    }

    throw new Error(`Unknown option ${arg}`);
  }

  return {
    requireGlbDownload: nextRequireGlbDownload,
    requireDerivedMeshCache: nextRequireDerivedMeshCache,
    requireV10Workflow: nextRequireV10Workflow,
    requireV12Workflow: nextRequireV12Workflow,
    requireV13Workflow: nextRequireV13Workflow,
    requireV14Workflow: nextRequireV14Workflow,
    requireV17Workflow: nextRequireV17Workflow
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
  {
    requireGlbDownload = false,
    requireDerivedMeshCache = false,
    requireV10Workflow = false,
    requireV12Workflow = false,
    requireV13Workflow = false,
    requireV14Workflow = false,
    requireV17Workflow = false
  } = {}
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
  const v10C2ProjectJson = requireV10Workflow
    ? await createV10C2ReleaseSampleProjectJson()
    : undefined;
  const v13ProjectJson = requireV13Workflow
    ? await createV13ReleaseSampleProjectJson()
    : undefined;
  const v14ProjectJson = requireV14Workflow
    ? await createV14ResultFaceFixtureProjectJson()
    : undefined;

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
      `
    },
    sessionId
  );
  await client.send(
    "Emulation.setDeviceMetricsOverride",
    {
      width: 1280,
      height: 720,
      deviceScaleFactor: 1,
      mobile: false
    },
    sessionId
  );
  await client.send("Page.navigate", { url: appUrl }, sessionId);

  const result = await client.send(
    "Runtime.evaluate",
    {
      awaitPromise: true,
      returnByValue: true,
      expression: `(${v7BrowserWorkflowSmoke.toString()})(${JSON.stringify({
        requireDerivedMeshCache,
        requireGlbDownload,
        requireV10Workflow,
        requireV12Workflow,
        requireV13Workflow,
        requireV14Workflow,
        requireV17Workflow,
        v10C2ProjectJson,
        v13ProjectJson,
        v14ProjectJson,
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
      requireGlbDownload,
      requireV10Workflow,
      requireV12Workflow,
      requireV13Workflow,
      requireV14Workflow,
      requireV17Workflow
    }),
    consoleErrors,
    exceptions
  });
}

async function createV10C2ReleaseSampleProjectJson() {
  register(loaderPath, import.meta.url);
  const cadCorePath = pathToFileURL(
    resolve(repoRoot, "packages/cad-core/src/index.ts")
  );
  const cadCore = await import(cadCorePath.href);
  const engine = new cadCore.CadEngine();
  const response = engine.executeBatch(
    cadCore.createV10ReleaseSampleBatch("v10-c2-feature-lifecycle-edits")
  );

  if (!response.ok) {
    throw new Error("Could not build V10 C2 release sample project JSON.");
  }

  return cadCore.exportCadProjectJson(engine);
}

async function createV13ReleaseSampleProjectJson() {
  register(loaderPath, import.meta.url);
  const cadCorePath = pathToFileURL(
    resolve(repoRoot, "packages/cad-core/src/index.ts")
  );
  const cadCore = await import(cadCorePath.href);
  const engine = new cadCore.CadEngine();
  const response = engine.executeBatch(
    cadCore.createV13ReleaseSampleBatch(
      "v13-topology-anchor-repair-command-chain"
    )
  );

  if (!response.ok) {
    throw new Error("Could not build V13 release sample project JSON.");
  }

  return cadCore.exportCadProjectJson(engine);
}

async function createV14ResultFaceFixtureProjectJson() {
  register(loaderPath, import.meta.url);
  const cadCorePath = pathToFileURL(
    resolve(repoRoot, "packages/cad-core/src/index.ts")
  );
  const cadCore = await import(cadCorePath.href);
  const engine = new cadCore.CadEngine();

  engine.applyBatch([
    {
      op: "sketch.create",
      id: "v14_smoke_rect_source_sketch",
      name: "V14 smoke rectangle source",
      plane: "XY"
    },
    {
      op: "sketch.addRectangle",
      sketchId: "v14_smoke_rect_source_sketch",
      id: "v14_smoke_rect_source_profile",
      center: [3, 0],
      width: 1.5,
      height: 1
    },
    {
      op: "feature.extrude",
      id: "v14_smoke_rect_source_feature",
      bodyId: "v14_smoke_rect_source_body",
      sketchId: "v14_smoke_rect_source_sketch",
      entityId: "v14_smoke_rect_source_profile",
      depth: 1.5,
      operationMode: "newBody",
      name: "V14 smoke rectangle source body"
    },
    {
      op: "sketch.create",
      id: "v14_smoke_rect_result_cut_sketch",
      name: "V14 smoke rectangle result cut profile",
      plane: "XY"
    },
    {
      op: "sketch.addRectangle",
      sketchId: "v14_smoke_rect_result_cut_sketch",
      id: "v14_smoke_rect_result_cut_rect",
      center: [3, 0],
      width: 0.5,
      height: 0.5
    },
    {
      op: "feature.extrude",
      id: "v14_smoke_rect_result_cut_feature",
      bodyId: "v14_smoke_rect_result_target_body",
      sketchId: "v14_smoke_rect_result_cut_sketch",
      entityId: "v14_smoke_rect_result_cut_rect",
      depth: 0.75,
      operationMode: "cut",
      targetBodyId: "v14_smoke_rect_source_body",
      name: "V14 smoke rectangle result target"
    },
    {
      op: "sketch.create",
      id: "v14_smoke_source_sketch",
      name: "V14 smoke circle source",
      plane: "XY"
    },
    {
      op: "sketch.addCircle",
      sketchId: "v14_smoke_source_sketch",
      id: "v14_smoke_source_circle",
      center: [0, 0],
      radius: 1
    },
    {
      op: "feature.extrude",
      id: "v14_smoke_source_feature",
      bodyId: "v14_smoke_source_body",
      sketchId: "v14_smoke_source_sketch",
      entityId: "v14_smoke_source_circle",
      depth: 3,
      operationMode: "newBody",
      name: "V14 smoke source cylinder"
    },
    {
      op: "sketch.create",
      id: "v14_smoke_result_cut_sketch",
      name: "V14 smoke result cut profile",
      plane: "XY"
    },
    {
      op: "sketch.addRectangle",
      sketchId: "v14_smoke_result_cut_sketch",
      id: "v14_smoke_result_cut_rect",
      center: [0, 0],
      width: 0.5,
      height: 0.5
    },
    {
      op: "feature.extrude",
      id: "v14_smoke_result_cut_feature",
      bodyId: "v14_smoke_result_target_body",
      sketchId: "v14_smoke_result_cut_sketch",
      entityId: "v14_smoke_result_cut_rect",
      depth: 1,
      operationMode: "cut",
      targetBodyId: "v14_smoke_source_body",
      name: "V14 smoke result target"
    }
  ]);

  return cadCore.exportCadProjectJson(engine);
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
  requireV10Workflow,
  requireV12Workflow,
  v10C2ProjectJson,
  requireV13Workflow,
  requireV14Workflow,
  requireV17Workflow,
  v13ProjectJson,
  v14ProjectJson,
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
    v10RepairBodyId: "v10_smoke_repair_body",
    v10RepairBodyName: "V10 smoke repair replacement body",
    v10RepairEntityId: "v10_smoke_repair_rect",
    v10RepairFeatureId: "v10_smoke_repair_feature",
    v10RepairReferenceName: "v10_smoke_repaired_face",
    v10StaleBodyId: "v10_smoke_stale_body",
    v10StaleBodyName: "V10 smoke stale source body",
    v10StaleEntityId: "v10_smoke_stale_rect",
    v10StaleFeatureId: "v10_smoke_stale_feature",
    v12AddBodyId: "v12_smoke_add_body",
    v12AddBodyName: "V12 smoke add result",
    v12AddCapSketchId: "v12_smoke_add_cap_sketch",
    v12AddCapSketchName: "V12 smoke add cap sketch",
    v12AddFeatureId: "v12_smoke_add_feature",
    v12AddRepairReferenceName: "v12_smoke_repaired_add_edge",
    v12AddRepairStaleBodyId: "v12_smoke_stale_add_edge_body",
    v12AddRepairStaleBodyName: "V12 smoke stale add edge source",
    v12AddRepairStaleEntityId: "v12_smoke_stale_add_edge_rect",
    v12AddRepairStaleFeatureId: "v12_smoke_stale_add_edge_feature",
    v12AddTargetBodyId: "v12_smoke_add_target_body",
    v12AddTargetBodyName: "V12 smoke add target body",
    v12AddTargetEntityId: "v12_smoke_add_target_rect",
    v12AddTargetFeatureId: "v12_smoke_add_target_feature",
    v12AddToolEntityId: "v12_smoke_add_tool_rect",
    v12AddToolSketchId: "v12_smoke_add_tool_sketch",
    v12AddToolSketchName: "V12 smoke add tool sketch",
    v12CircleAddBodyId: "v12_smoke_circle_add_body",
    v12CircleAddBodyName: "V12 smoke circle add result",
    v12CircleAddFeatureId: "v12_smoke_circle_add_feature",
    v12CircleAddTargetBodyId: "v12_smoke_circle_add_target_body",
    v12CircleAddTargetBodyName: "V12 smoke circle add target body",
    v12CircleAddTargetEntityId: "v12_smoke_circle_add_target_rect",
    v12CircleAddTargetFeatureId: "v12_smoke_circle_add_target_feature",
    v12CircleAddToolEntityId: "v12_smoke_circle_add_tool",
    v12CircleAddToolSketchId: "v12_smoke_circle_add_tool_sketch",
    v12CircleAddToolSketchName: "V12 smoke circle add tool sketch",
    v12CircleCutBodyId: "v12_smoke_circle_cut_body",
    v12CircleCutBodyName: "V12 smoke circle cut result",
    v12CircleCutFeatureId: "v12_smoke_circle_cut_feature",
    v12CircleCutTargetBodyId: "v12_smoke_circle_cut_target_body",
    v12CircleCutTargetBodyName: "V12 smoke circle cut target body",
    v12CircleCutTargetEntityId: "v12_smoke_circle_cut_target_rect",
    v12CircleCutTargetFeatureId: "v12_smoke_circle_cut_target_feature",
    v12CircleCutToolEntityId: "v12_smoke_circle_cut_tool",
    v12CircleCutToolSketchId: "v12_smoke_circle_cut_tool_sketch",
    v12CircleCutToolSketchName: "V12 smoke circle cut tool sketch",
    v12CutWallSketchId: "v12_smoke_cut_wall_sketch",
    v12CutWallSketchName: "V12 smoke cut wall sketch",
    v12RepairReferenceName: "v12_smoke_repaired_cut_face",
    v12RepairStaleBodyId: "v12_smoke_stale_repair_body",
    v12RepairStaleBodyName: "V12 smoke stale repair source",
    v12RepairStaleEntityId: "v12_smoke_stale_repair_rect",
    v12RepairStaleFeatureId: "v12_smoke_stale_repair_feature",
    v13CutBodyId: "v13_cut_body",
    v13CutBodyName: "V13 anchored cut",
    v13CutFeatureId: "v13_cut_feature",
    v13ProjectFileName: "v13-browser-fixture.json",
    v13RepairBodyId: "v13_repair_body",
    v13RepairBodyName: "V13 repair body",
    v13RepairReferenceName: "V13 repair face",
    v13RepairTopologyAnchorId: "v13_anchor_repair_face",
    v13ExplicitStableFaceId: "generated:face:v13_repair_body:side:uMin",
    v13TargetBodyAnchorId: "v13_anchor_target_body",
    v13TargetBodyId: "v13_target_body",
    v13TargetBodyName: "V13 anchored target body",
    v14AddBodyId: "v14_smoke_result_rect_add_body",
    v14AddBodyName: "V14 smoke result rectangle add",
    v14AddFeatureId: "v14_smoke_result_rect_add_feature",
    v14AddRectangleEntityId: "v14_smoke_result_rect_add_profile",
    v14AddSketchId: "v14_smoke_result_rect_add_sketch",
    v14AddSketchName: "V14 smoke result add sketch",
    v14AddTargetBodyId: "v14_smoke_rect_result_target_body",
    v14AddTargetBodyName: "V14 smoke rectangle result target",
    v14CircleAddBodyId: "v14_smoke_circle_result_add_body",
    v14CircleAddBodyName: "V14 smoke circle result add",
    v14CircleAddCircleEntityId: "v14_smoke_circle_result_add_profile",
    v14CircleAddFeatureId: "v14_smoke_circle_result_add_feature",
    v14CircleAddSketchId: "v14_smoke_circle_result_add_sketch",
    v14CircleAddSketchName: "V14 smoke circle result add sketch",
    v14RectangleCutBodyId: "v14_smoke_rect_result_second_cut_body",
    v14RectangleCutBodyName: "V14 smoke rectangle result second cut",
    v14RectangleCutFeatureId: "v14_smoke_rect_result_second_cut_feature",
    v14RectangleCutRectangleEntityId:
      "v14_smoke_rect_result_second_cut_profile",
    v14RectangleCutSketchId: "v14_smoke_rect_result_second_cut_sketch",
    v14RectangleCutSketchName: "V14 smoke rectangle result second cut sketch",
    v14CutBodyId: "v14_smoke_result_rect_cut_body",
    v14CutBodyName: "V14 smoke result rectangle cut",
    v14CutFeatureId: "v14_smoke_result_rect_cut_feature",
    v14CutRectangleEntityId: "v14_smoke_result_rect_cut_profile",
    v14CutSketchId: "v14_smoke_result_rect_cut_sketch",
    v14CutSketchName: "V14 smoke result cut sketch",
    v14CylinderSideHoleBodyId: "v14_smoke_cylinder_side_hole_body",
    v14CylinderSideHoleBodyName: "V14 smoke cylinder side hole",
    v14CylinderSideHoleCircleEntityId: "v14_smoke_cylinder_side_hole_circle",
    v14CylinderSideHoleFeatureId: "v14_smoke_cylinder_side_hole_feature",
    v14CylinderSideHoleSketchId: "v14_smoke_cylinder_side_hole_sketch",
    v14CylinderSideHoleSketchName: "V14 smoke cylinder side hole sketch",
    v14EdgeChamferName: "V14 smoke result cut-wall chamfer",
    v14EdgeFilletName: "V14 smoke result cut-wall fillet",
    v14EdgeFilletReferenceName: "V14 smoke result cut-wall fillet edge",
    v14EdgeReferenceName: "V14 smoke result cut-wall edge",
    v14SelectedEdgeChamferName: "V14 smoke selected result-edge chamfer",
    v14SelectedEdgeFilletName: "V14 smoke selected result-edge fillet",
    v14ProjectFileName: "v14-browser-fixture.json",
    v14HoleBodyId: "v14_smoke_result_hole_body",
    v14HoleBodyName: "V14 smoke result hole",
    v14HoleCircleEntityId: "v14_smoke_hole_circle",
    v14HoleFeatureId: "v14_smoke_result_hole_feature",
    v14HoleSketchId: "v14_smoke_result_face_sketch",
    v14HoleSketchName: "V14 smoke result face sketch",
    v14SourceBodyId: "v14_smoke_source_body",
    v14SourceBodyName: "V14 smoke source cylinder",
    v14SourceFeatureId: "v14_smoke_source_feature",
    v14TargetBodyId: "v14_smoke_result_target_body",
    v14TargetBodyName: "V14 smoke result target",
    v14WcadFileName: "v14-browser-workflow-roundtrip.wcad",
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

  const primaryTools = getElementByAriaLabel("Project and modeling tools");
  if (document.querySelector('[aria-label="Context and advanced tools"]')) {
    fail(
      "primary-tools-language",
      "primary right rail uses product workflow language",
      "Old Context and advanced tools label is still present."
    );
  } else {
    pass(
      "primary-tools-language",
      "primary right rail uses product workflow language",
      compactText(primaryTools.textContent, 180)
    );
  }

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
    assertIncludes(modeling, "Reference status", "modeling-reference-heading"),
    assertIncludes(modeling, "Ready reference", "modeling-reference-status")
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
        ) &&
        includesText(getElementByAriaLabel("Inspector"), "Ready reference"),
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
        "Reference status",
        "selected-generated-reference-status"
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

    const attachedSketchInspector = getElementByAriaLabel("Inspector");
    setFieldByLabel(
      attachedSketchInspector,
      "Sketch name",
      ids.attachedSketchName
    );
    setInputByDetailsSummary(
      attachedSketchInspector,
      "Advanced sketch options",
      ids.attachedSketchId
    );
    clickButton(attachedSketchInspector, "Create attached sketch");
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

    if (requireV12Workflow) {
      await runV12CutResultReferenceWorkflowSmoke();
      await runV12AddResultReferenceWorkflowSmoke();
      await runV12CircleCutResultReferenceWorkflowSmoke();
      await runV12CircleAddResultReferenceWorkflowSmoke();
    }

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

    if (requireV10Workflow) {
      await runV10EditRepairWorkflowSmoke();
    }
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
    assertIncludes(projectPanel, "Partbench project", "current-project-format"),
    assertIncludes(projectPanel, "Untitled project", "untitled-project"),
    assertIncludes(projectPanel, "Not saved", "not-saved-state"),
    assertIncludes(projectPanel, "Open .wcad", "wcad-open-action"),
    assertIncludes(projectPanel, "Save As", "wcad-save-as-action"),
    assertIncludes(projectPanel, "Storage availability", "storage-status"),
    assertIncludes(projectPanel, "JSON import/export", "json-storage-mode"),
    assertIncludes(projectPanel, "Direct open/save", "direct-file-status"),
    assertIncludes(
      projectPanel,
      "Local display cache",
      "opfs-capability-status"
    ),
    assertIncludes(projectPanel, "Local display cache", "opfs-cache-status"),
    assertIncludes(projectPanel, "Clear cache", "opfs-cache-clear-action"),
    assertIncludes(
      projectPanel,
      "Optional rebuildable cache",
      "opfs-cache-boundary"
    ),
    assertIncludes(projectPanel, ".wcad project file", "wcad-deferred-status"),
    assertIncludes(projectPanel, "STEP", "step-export-status"),
    assertIncludes(projectPanel, "Download STEP", "step-download-action"),
    assertIncludes(projectPanel, "Visualization GLB", "mesh-glb-status")
  ];
  if (projectChecks.every(Boolean)) {
    pass(
      "project-file-panel",
      "Project/File panel is primary and reports .wcad workflow, JSON import/export, storage capability, and export readiness"
    );
  }

  const projectFileReachability = probeProjectFileActionReachability([
    "Download STEP",
    "Clear cache",
    "Export JSON",
    "Download JSON",
    ...(getButtonByText(projectPanel, "Download visualization GLB")
      ? ["Download visualization GLB"]
      : [])
  ]);
  if (projectFileReachability.ok) {
    pass(
      "project-file-action-reachability",
      "Project/File export and cache actions are reachable inside the right rail",
      projectFileReachability.detail
    );
  } else {
    fail(
      "project-file-action-reachability",
      "Project/File export and cache actions are reachable inside the right rail",
      projectFileReachability.detail
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
  if (requireV10Workflow) {
    openTreePanel();
    const repairedReferenceButton = getButtonContaining(
      getElementByAriaLabel("Model structure"),
      ids.v10RepairReferenceName
    );
    if (!repairedReferenceButton) {
      fail(
        "v10-repaired-reference-wcad-roundtrip",
        "repaired named reference survives .wcad save/open and remains command-ready",
        "Repaired named reference button was not found after .wcad round-trip."
      );
    } else {
      repairedReferenceButton.click();
      await waitFor(
        () => isTreePanelOpen(),
        "repaired named reference selection keeps preferred tree tab after .wcad round-trip"
      );
      openSelectionPanel();
      await waitForGeneratedReferenceCommandReady(
        ids.v10RepairBodyId,
        "repaired named reference remains command-ready after .wcad round-trip"
      );
      pass(
        "v10-repaired-reference-wcad-roundtrip",
        "repaired named reference survives .wcad save/open and remains command-ready",
        getSelectionText()
      );
    }
  }

  const derivedMeshCacheObserved = () => {
    const text = normalize(projectPanel.textContent);
    return /Health:\s*[1-9]\d*\s+valid/.test(text);
  };

  if (derivedMeshCacheObserved()) {
    pass(
      "project-opfs-derived-mesh-cache",
      "Project/File panel reports a derived display cache entry",
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
        "Project/File panel reports a derived display cache entry",
        compactText(projectPanel.textContent, 260)
      );
    } catch (error) {
      fail(
        "project-opfs-derived-mesh-cache",
        "Project/File panel reports a derived display cache entry",
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
          : "No derived display cache entry was observed during the optional smoke path."
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
      includesText(projectPanel, "Imported ") &&
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

  if (requireV10Workflow) {
    await runV10C2InspectorFeatureEditSmoke(v10C2ProjectJson);
  }

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
    pass("glb-download", "ready display geometry exported as transient GLB");
  }

  if (requireV13Workflow) {
    await runV13TopologyIdentityBrowserWorkflowSmoke(v13ProjectJson);
  }

  if (requireV14Workflow) {
    await runV14TopologyBackedBrowserWorkflowSmoke(v14ProjectJson);
  }

  if (requireV17Workflow) {
    await runV17MustBrowserWorkflowSmoke();
  }

  return { checks, ids, skipped };

  async function runV17MustBrowserWorkflowSmoke() {
    clickButtonContaining(getElementByAriaLabel("Tool tabs"), "Sketches");
    let sketches = getSectionByAriaLabel("Sketches");
    setSelectByLabel(sketches, "Active sketch", ids.sketchId);
    await waitFor(
      () =>
        getControlByLabel(getSectionByAriaLabel("Sketches"), "Active sketch")
          .value === ids.sketchId,
      "V17 source sketch selection"
    );

    const beforeArcProject = await readV17ProjectJson(
      "V17 project before arc authoring"
    );
    const beforeArcEntities = getV17Sketch(beforeArcProject, ids.sketchId)
      .entities;
    const firstArcRatios = [
      [0.44, 0.56],
      [0.5, 0.44],
      [0.56, 0.56]
    ];
    await authorV17ThreePointArc(firstArcRatios, "first V17 three-point arc");
    let project = await waitForV17Project(
      (candidate) =>
        getV17Sketch(candidate, ids.sketchId).entities.filter(
          (entity) => entity.kind === "arc"
        ).length >
        beforeArcEntities.filter((entity) => entity.kind === "arc").length,
      "first V17 arc persisted"
    );
    const firstArc = getV17Sketch(project, ids.sketchId).entities.find(
      (entity) =>
        entity.kind === "arc" &&
        !beforeArcEntities.some((before) => before.id === entity.id)
    );
    if (!firstArc || firstArc.kind !== "arc") {
      throw new Error("The viewport-authored V17 arc was not in the project.");
    }
    pass(
      "v17-three-point-arc-authoring-browser",
      "three viewport picks create a document-model arc",
      `radius ${firstArc.radius}; signed sweep ${firstArc.sweepAngleDegrees}`
    );

    clickButtonContaining(getElementByAriaLabel("Tool tabs"), "Sketches");
    sketches = getSectionByAriaLabel("Sketches");
    selectV17SketchEntity(sketches, firstArc.id);
    await waitFor(
      () => Boolean(getButtonByText(getSectionByAriaLabel("Sketches"), "Make construction")),
      "V17 selected arc construction action"
    );
    clickButton(sketches, "Make construction");
    await waitFor(
      () => includesText(getSectionByAriaLabel("Sketches"), "Construction geometry"),
      "V17 construction state"
    );
    project = await waitForV17Project(
      (candidate) =>
        getV17Sketch(candidate, ids.sketchId).entities.find(
          (entity) => entity.id === firstArc.id
        )?.construction === true,
      "V17 construction persisted"
    );
    clickButton(getSectionByAriaLabel("Sketches"), "Use as profile");
    await waitForV17Project(
      (candidate) =>
        getV17Sketch(candidate, ids.sketchId).entities.find(
          (entity) => entity.id === firstArc.id
        )?.construction === false,
      "V17 profile state restored"
    );
    pass(
      "v17-construction-toggle-browser",
      "selected arc toggles between construction and profile geometry"
    );

    await authorV17ThreePointArc(
      [firstArcRatios[2], [0.5, 0.68], firstArcRatios[0]],
      "second V17 three-point arc"
    );
    project = await waitForV17Project(
      (candidate) =>
        getV17Sketch(candidate, ids.sketchId).entities.filter(
          (entity) => entity.kind === "arc"
        ).length >=
        beforeArcEntities.filter((entity) => entity.kind === "arc").length + 2,
      "second V17 arc persisted"
    );
    const authoredArcs = getV17Sketch(project, ids.sketchId).entities.filter(
      (entity) =>
        entity.kind === "arc" &&
        !beforeArcEntities.some((before) => before.id === entity.id)
    );
    const secondArc = authoredArcs.find((entity) => entity.id !== firstArc.id);
    if (!secondArc || secondArc.kind !== "arc") {
      throw new Error("The closing V17 arc was not in the project.");
    }

    const sweepProfileId = "v17_sweep_profile";
    const arcStart = v17ArcEndpoint(firstArc, false);
    clickButtonContaining(getElementByAriaLabel("Tool tabs"), "Sketches");
    sketches = getSectionByAriaLabel("Sketches");
    clickButton(getElementByAriaLabel("Add sketch entity"), "Circle");
    const circleEditor = await waitForSectionByAriaLabel(
      "Sketch entity editor",
      "V17 sweep profile editor"
    );
    setSelectByLabel(circleEditor, "Entity", "circle");
    setInputByDetailsSummary(circleEditor, "Optional ID", sweepProfileId);
    setFieldByLabel(circleEditor, "Center X", String(arcStart[0]));
    setFieldByLabel(circleEditor, "Center Y", String(arcStart[1]));
    setFieldByLabel(
      circleEditor,
      "Radius",
      String(Math.max(0.02, Math.min(0.15, firstArc.radius / 5)))
    );
    clickButton(circleEditor, "Add entity");
    await waitFor(
      () =>
        includesText(
          getElementByAriaLabel("Select sketch entity"),
          sweepProfileId
        ),
      "V17 sweep profile persisted"
    );

    const composite = getSectionByAriaLabel("Composite features");
    setSelectByLabel(composite, "Profile sketch", ids.sketchId);
    await selectV17Candidate(composite, "Profile candidate", {
      includes: [firstArc.id, secondArc.id]
    });
    await waitFor(
      () => includesText(composite, "Ready") && includesText(composite, "healthy joins"),
      "V17 composite profile candidate ready"
    );
    const beforeCompositeFeatureCount = project.document.features.length;
    clickButton(composite, "Create extrude");
    project = await waitForV17Project(
      (candidate) =>
        candidate.document.features.length > beforeCompositeFeatureCount &&
        candidate.document.features.some(
          (feature) =>
            feature.kind === "extrude" &&
            feature.profile?.kind === "wire" &&
            v17WireEntityIds(feature.profile).includes(firstArc.id) &&
            v17WireEntityIds(feature.profile).includes(secondArc.id)
        ),
      "V17 composite extrude created"
    );
    pass(
      "v17-composite-feature-create-browser",
      "explicit two-arc profile candidate creates a composite extrude"
    );

    clickButton(composite, "Sweep");
    await waitFor(
      () => Boolean(queryControlByLabel(composite, "Path sketch")),
      "V17 sweep authoring controls"
    );
    setSelectByLabel(composite, "Profile sketch", ids.sketchId);
    await selectV17Candidate(composite, "Profile candidate", {
      includes: [sweepProfileId]
    });
    setSelectByLabel(composite, "Path sketch", ids.sketchId);
    await selectV17Candidate(composite, "Path candidate", {
      includes: [firstArc.id],
      excludes: [secondArc.id]
    });
    await waitFor(
      () =>
        includesText(getElementByAriaLabel("Profile candidate health"), "Ready") &&
        includesText(getElementByAriaLabel("Path candidate health"), "Ready"),
      "V17 explicit profile and path candidates ready"
    );
    pass(
      "v17-profile-path-candidates-browser",
      "explicit query-returned profile and curved path candidates are selected"
    );
    const beforeSweepFeatureCount = project.document.features.length;
    clickButton(composite, "Create sweep");
    project = await waitForV17Project(
      (candidate) =>
        candidate.document.features.length > beforeSweepFeatureCount &&
        candidate.document.features.some(
          (feature) =>
            feature.kind === "sweep" &&
            feature.profile?.entityId === sweepProfileId &&
            v17PathEntityIds(feature.path).includes(firstArc.id)
        ),
      "V17 curved sweep created"
    );
    const sweepFeature = project.document.features.find(
      (feature) =>
        feature.kind === "sweep" &&
        feature.profile?.entityId === sweepProfileId &&
        v17PathEntityIds(feature.path).includes(firstArc.id)
    );
    if (!sweepFeature?.bodyId) {
      throw new Error("V17 curved sweep has no result body identity.");
    }
    pass(
      "v17-curved-sweep-create-browser",
      "explicit curved arc path creates a normalized sweep feature"
    );

    await waitForV17BodyDisplayReady(
      sweepFeature.bodyId,
      "initial V17 curved sweep display geometry"
    );
    const editedArc = createV17EndpointPreservingArcEdit(firstArc);
    clickButtonContaining(getElementByAriaLabel("Tool tabs"), "Sketches");
    sketches = getSectionByAriaLabel("Sketches");
    setSelectByLabel(sketches, "Active sketch", ids.sketchId);
    selectV17SketchEntity(sketches, firstArc.id);
    await waitFor(
      () => Boolean(getButtonByText(getSectionByAriaLabel("Sketches"), "Edit source")),
      "V17 selected referenced arc edit action"
    );
    clickButton(sketches, "Edit source");
    const arcEditor = await waitForSectionByAriaLabel(
      "Sketch entity editor",
      "V17 referenced arc editor"
    );
    setFieldByLabel(arcEditor, "Center X", String(editedArc.center[0]));
    setFieldByLabel(arcEditor, "Center Y", String(editedArc.center[1]));
    setFieldByLabel(arcEditor, "Radius", String(editedArc.radius));
    setFieldByLabel(
      arcEditor,
      "Start angle (deg)",
      String(editedArc.startAngleDegrees)
    );
    setFieldByLabel(
      arcEditor,
      "Signed sweep (deg)",
      String(editedArc.sweepAngleDegrees)
    );
    clickButton(arcEditor, "Update entity");
    project = await waitForV17Project(
      (candidate) => {
        const arc = getV17Sketch(candidate, ids.sketchId).entities.find(
          (entity) => entity.id === firstArc.id
        );
        const sweep = candidate.document.features.find(
          (feature) => feature.bodyId === sweepFeature.bodyId
        );
        return (
          arc?.kind === "arc" &&
          Math.abs(arc.radius - editedArc.radius) < 1e-7 &&
          sweep?.kind === "sweep" &&
          v17PathEntityIds(sweep.path).includes(firstArc.id)
        );
      },
      "V17 referenced arc edit persisted"
    );
    await waitForV17BodyDisplayReady(
      sweepFeature.bodyId,
      "rebuilt V17 curved sweep display geometry"
    );
    pass(
      "v17-referenced-arc-edit-rebuild-browser",
      "endpoint-preserving arc edit keeps the dependent sweep current and display-ready",
      `body ${sweepFeature.bodyId}`
    );

    const canvas = getElementByAriaLabel("3D scene viewport");
    if (
      canvas instanceof HTMLCanvasElement &&
      canvas.width > 0 &&
      canvas.height > 0
    ) {
      pass(
        "v17-derived-geometry-browser",
        "V17 authored features finish with active derived display geometry",
        `${canvas.width}x${canvas.height}`
      );
    } else {
      fail(
        "v17-derived-geometry-browser",
        "V17 authored features finish with active derived display geometry",
        "The derived build did not expose a sized 3D scene viewport canvas."
      );
    }
  }

  async function authorV17ThreePointArc(ratios, label) {
    clickButtonContaining(getElementByAriaLabel("Tool tabs"), "Sketches");
    const sketches = getSectionByAriaLabel("Sketches");
    setSelectByLabel(sketches, "Active sketch", ids.sketchId);
    clickButton(getElementByAriaLabel("Add sketch entity"), "Arc (3 point)");
    await waitFor(
      () =>
        includesText(
          getElementByAriaLabel("Three-point arc tool"),
          "the start point"
        ),
      `${label} start prompt`
    );
    clickViewportAtRatio(ratios[0][0], ratios[0][1]);
    await waitFor(
      () =>
        includesText(
          getElementByAriaLabel("Three-point arc tool"),
          "a point on the arc"
        ),
      `${label} middle prompt`
    );
    clickViewportAtRatio(ratios[1][0], ratios[1][1]);
    await waitFor(
      () =>
        includesText(
          getElementByAriaLabel("Three-point arc tool"),
          "the end point"
        ),
      `${label} end prompt`
    );
    clickViewportAtRatio(ratios[2][0], ratios[2][1]);
    await waitFor(
      () => !document.querySelector('[aria-label="Three-point arc tool"]'),
      `${label} commit`
    );
  }

  async function readV17ProjectJson(label) {
    openDetailsBySummary(document.body, "Project/File");
    const projectPanel = getSectionByAriaLabel("Project");
    const exportButton = getButtonByText(projectPanel, "Export JSON");
    if (!exportButton || exportButton.disabled) {
      throw new Error(
        `${label}: JSON export is unavailable (${compactText(
          projectPanel.textContent,
          360
        )}).`
      );
    }
    exportButton.click();
    await delay(50);
    await waitFor(() => {
      const value = getProjectJsonEditorValue(projectPanel);
      if (!value.trim()) throw new Error(`${label}: JSON preview is empty.`);
      JSON.parse(value);
      return true;
    }, label);
    return JSON.parse(getProjectJsonEditorValue(projectPanel));
  }

  async function waitForV17Project(predicate, label) {
    const deadline = Date.now() + timeoutMs;
    let lastError;
    while (Date.now() < deadline) {
      try {
        const project = await readV17ProjectJson(label);
        if (predicate(project)) return project;
        lastError = new Error(`${label}: project predicate is not ready.`);
      } catch (error) {
        lastError = error;
      }
      await delay(100);
    }
    throw new Error(
      `Timed out waiting for ${label}. Last error: ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }`
    );
  }

  function getV17Sketch(project, sketchId) {
    const sketch = project?.document?.sketches?.find(
      (candidate) => candidate.id === sketchId
    );
    if (!sketch) throw new Error(`V17 sketch ${sketchId} is unavailable.`);
    return sketch;
  }

  function selectV17SketchEntity(sketches, entityId) {
    const entityList = getElementByAriaLabel("Select sketch entity");
    const button = getButtonContaining(entityList, entityId);
    if (!button) {
      throw new Error(`V17 sketch entity ${entityId} is not selectable.`);
    }
    clickEnabledButton(button, `sketch entity ${entityId}`);
  }

  async function selectV17Candidate(
    scope,
    label,
    { includes = [], excludes = [] }
  ) {
    let option;
    await waitFor(() => {
      const select = getControlByLabel(scope, label);
      if (!(select instanceof HTMLSelectElement)) {
        throw new Error(`${label} is not a select.`);
      }
      option = [...select.options].find((candidate) => {
        const text = normalize(candidate.textContent);
        return (
          candidate.value &&
          includes.every((value) => text.includes(value)) &&
          excludes.every((value) => !text.includes(value))
        );
      });
      if (!option) {
        throw new Error(
          `${label} has no requested option: ${compactText(
            select.textContent,
            520
          )}`
        );
      }
      return true;
    }, `${label} option`);
    setSelectByLabel(scope, label, option.value);
  }

  function v17WireEntityIds(profile) {
    return profile?.kind === "wire"
      ? profile.segments.map((segment) => segment.entityId)
      : [];
  }

  function v17PathEntityIds(path) {
    if (!path) return [];
    return path.kind === "chain"
      ? path.segments.map((segment) => segment.entityId)
      : [path.entityId];
  }

  function v17ArcEndpoint(arc, end) {
    const angle =
      ((arc.startAngleDegrees + (end ? arc.sweepAngleDegrees : 0)) *
        Math.PI) /
      180;
    return [
      arc.center[0] + arc.radius * Math.cos(angle),
      arc.center[1] + arc.radius * Math.sin(angle)
    ];
  }

  function createV17EndpointPreservingArcEdit(arc) {
    const start = v17ArcEndpoint(arc, false);
    const end = v17ArcEndpoint(arc, true);
    const chord = [end[0] - start[0], end[1] - start[1]];
    const chordLength = Math.hypot(chord[0], chord[1]);
    const radius = Math.max(arc.radius * 1.12, chordLength * 0.525);
    const midpoint = [
      (start[0] + end[0]) / 2,
      (start[1] + end[1]) / 2
    ];
    const normal = [-chord[1] / chordLength, chord[0] / chordLength];
    const height = Math.sqrt(
      Math.max(0, radius * radius - (chordLength * chordLength) / 4)
    );
    const centers = [
      [midpoint[0] + normal[0] * height, midpoint[1] + normal[1] * height],
      [midpoint[0] - normal[0] * height, midpoint[1] - normal[1] * height]
    ];
    const center = centers.sort(
      (left, right) =>
        Math.hypot(left[0] - arc.center[0], left[1] - arc.center[1]) -
        Math.hypot(right[0] - arc.center[0], right[1] - arc.center[1])
    )[0];
    const startAngleDegrees =
      (Math.atan2(start[1] - center[1], start[0] - center[0]) * 180) /
      Math.PI;
    const endAngleDegrees =
      (Math.atan2(end[1] - center[1], end[0] - center[0]) * 180) /
      Math.PI;
    const positiveSweep =
      ((endAngleDegrees - startAngleDegrees) % 360 + 360) % 360;
    const sweepAngleDegrees =
      arc.sweepAngleDegrees >= 0 ? positiveSweep : positiveSweep - 360;
    return {
      center,
      radius,
      startAngleDegrees,
      sweepAngleDegrees
    };
  }

  async function waitForV17BodyDisplayReady(bodyId, label) {
    await waitFor(() => {
      const rows = [
        ...document.querySelectorAll(
          '[data-testid="model-story-result-body"]'
        )
      ];
      const row = rows.at(-1);
      if (!row || !includesText(row, "Display geometry ready")) {
        throw new Error(
          `${label} (${bodyId}): ${compactText(
            row?.textContent ?? "body row missing",
            360
          )}`
        );
      }
      return true;
    }, label, 120_000);
  }

  async function runV14TopologyBackedBrowserWorkflowSmoke(projectJson) {
    if (!projectJson) {
      fail(
        "v14-result-face-attached-sketch-browser",
        "V14 topology fixture imports before result-face sketch creation",
        "V13 topology release sample project JSON was not available."
      );
      return;
    }

    verifyV14ProjectFileUserFacingCopy();

    await importV14TopologyBrowserFixture(
      projectJson,
      "V14 topology browser fixture for cylinder side-plane hole"
    );
    await runV14CylinderSidePlaneHoleWorkflowSmoke();
    await verifyV14CylinderSidePlaneHoleProjectJsonSource(
      "V14 cylinder side-plane hole source JSON"
    );

    await importV14TopologyBrowserFixture(
      projectJson,
      "V14 topology browser fixture for selected result-edge chamfer"
    );
    await runV14SelectedResultCutWallEdgeFinishWorkflowSmoke({
      operation: "chamfer",
      featureName: ids.v14SelectedEdgeChamferName,
      passLabel:
        "V14 selected rectangle cut-wall result edge creates a chamfer directly"
    });
    await verifyV14SelectedResultCutWallEdgeFinishProjectJsonSource(
      "V14 selected result cut-wall chamfer source JSON",
      {
        operation: "chamfer",
        featureName: ids.v14SelectedEdgeChamferName,
        passLabel:
          "V14 selected result-edge chamfer JSON keeps public selected-edge source"
      }
    );

    await importV14TopologyBrowserFixture(
      projectJson,
      "V14 topology browser fixture for selected result-edge fillet"
    );
    await runV14SelectedResultCutWallEdgeFinishWorkflowSmoke({
      operation: "fillet",
      featureName: ids.v14SelectedEdgeFilletName,
      passLabel:
        "V14 selected rectangle cut-wall result edge creates a fillet directly"
    });
    await verifyV14SelectedResultCutWallEdgeFinishProjectJsonSource(
      "V14 selected result cut-wall fillet source JSON",
      {
        operation: "fillet",
        featureName: ids.v14SelectedEdgeFilletName,
        passLabel:
          "V14 selected result-edge fillet JSON keeps public selected-edge source"
      }
    );

    await importV14TopologyBrowserFixture(
      projectJson,
      "V14 topology browser fixture for result-edge chamfer"
    );
    await runV14ResultCutWallEdgeFinishWorkflowSmoke({
      operation: "chamfer",
      featureName: ids.v14EdgeChamferName,
      referenceName: ids.v14EdgeReferenceName
    });
    await verifyV14ResultEdgeUpstreamEditBlocked();
    await verifyV14ResultEdgeUndoRedoEditability();
    await verifyV14ResultCutWallEdgeFinishProjectJsonSource(
      "V14 result cut-wall chamfer source JSON",
      {
        operation: "chamfer",
        featureName: ids.v14EdgeChamferName,
        passId: "v14-result-cut-wall-edge-finish-source-json-browser",
        passLabel:
          "V14 cut-wall result-edge chamfer JSON keeps public named-edge source",
        referenceName: ids.v14EdgeReferenceName
      }
    );

    await importV14TopologyBrowserFixture(
      projectJson,
      "V14 topology browser fixture for result-edge fillet"
    );
    await runV14ResultCutWallEdgeFinishWorkflowSmoke({
      operation: "fillet",
      featureName: ids.v14EdgeFilletName,
      referenceName: ids.v14EdgeFilletReferenceName
    });
    await verifyV14ResultEdgeUpstreamEditBlocked({ operation: "fillet" });
    await verifyV14ResultEdgeUndoRedoEditability({ operation: "fillet" });
    await verifyV14ResultCutWallEdgeFinishProjectJsonSource(
      "V14 result cut-wall fillet source JSON",
      {
        operation: "fillet",
        featureName: ids.v14EdgeFilletName,
        passId: "v14-result-cut-wall-edge-fillet-source-json-browser",
        passLabel:
          "V14 cut-wall result-edge fillet JSON keeps public named-edge source",
        referenceName: ids.v14EdgeFilletReferenceName
      }
    );

    await importV14TopologyBrowserFixture(
      projectJson,
      "V14 topology browser fixture for result-face rectangle add"
    );
    await runV14TopologyBackedResultExtrudeAddWorkflowSmoke();
    await verifyV14ResultAddProjectJsonSource(
      "V14 result-face rectangle add topology source JSON"
    );

    await importV14TopologyBrowserFixture(
      projectJson,
      "V14 topology browser fixture for circle-result circle add"
    );
    await runV14TopologyBackedCircleResultExtrudeAddWorkflowSmoke();
    await verifyV14CircleResultAddProjectJsonSource(
      "V14 circle-result circle add topology source JSON"
    );

    await importV14TopologyBrowserFixture(
      projectJson,
      "V14 topology browser fixture for rectangle-result rectangle cut"
    );
    await runV14TopologyBackedRectangleResultExtrudeCutWorkflowSmoke();
    await verifyV14RectangleResultCutProjectJsonSource(
      "V14 rectangle-result rectangle cut topology source JSON"
    );

    await importV14TopologyBrowserFixture(
      projectJson,
      "V14 topology browser fixture for result-face rectangle cut"
    );
    await runV14TopologyBackedResultExtrudeCutWorkflowSmoke();
    await verifyV14ResultCutProjectJsonSource(
      "V14 result-face rectangle cut topology source JSON"
    );

    await importV14TopologyBrowserFixture(
      projectJson,
      "V14 topology browser fixture for result-face hole"
    );
    await runV14TopologyBackedResultHoleWorkflowSmoke();
    await verifyV14ResultHoleProjectJsonSource(
      "V14 pre-round-trip topology source JSON"
    );
    await verifyV14ResultHoleWcadRoundTrip();
    await verifyV14ResultHoleUpstreamEditBlocked();

    openDetailsBySummary(document.body, "Project/File");
    const projectPanel = getSectionByAriaLabel("Project");
    clickButton(projectPanel, "Export JSON");
    await waitFor(() => {
      const projectJsonPreview = getProjectJsonEditorValue(projectPanel);
      const ready =
        includesText(projectPanel, "Import draft") &&
        projectJsonPreview.includes("web-cad.project.v18") &&
        projectJsonPreview.includes(ids.v14HoleFeatureId);

      if (!ready) {
        throw new Error(
          [
            `project=${compactText(projectPanel.textContent, 420)}`,
            `json=${projectJsonPreview.trim().slice(0, 240)}`
          ].join("; ")
        );
      }

      return true;
    }, "V14 exported topology source JSON preview");
    assertV14ResultHoleProjectJson(getProjectJsonEditorValue(projectPanel));
    pass(
      "v14-result-hole-topology-source-json-browser",
      "V14 result-body hole JSON keeps only public topology sketch and target proof",
      ids.v14HoleFeatureId
    );
    verifyV14NormalSurfaceUserFacingCopy();
  }

  function verifyV14ProjectFileUserFacingCopy() {
    const checkId = "v14-project-file-user-facing-json-copy-browser";
    openDetailsBySummary(document.body, "Project/File");
    const projectPanel = getSectionByAriaLabel("Project");
    const text = compactText(projectPanel.textContent, 1200);

    if (!assertIncludes(projectPanel, "JSON import/export", checkId)) {
      return;
    }

    if (
      /\b(debug|tranche|milestone|deferred|command-ready|cad-core|checkpoint-local|package contract|checkpoint payload|mesh error|topology error)\b/i.test(
        text
      ) ||
      /\bMesh\/GLB\b/i.test(text)
    ) {
      fail(
        "v14-project-file-user-facing-json-copy-browser",
        "V14 Project/File copy avoids internal labels in user-facing workflow",
        text
      );
      return;
    }

    pass(
      "v14-project-file-user-facing-json-copy-browser",
      "V14 Project/File copy avoids internal labels in user-facing workflow"
    );
  }

  function verifyV14NormalSurfaceUserFacingCopy() {
    const forbiddenPattern =
      /\b(debug|tranche|milestone|deferred|command-ready|cad-core|checkpoint-local|checkpoint|checkpoints|topology|package contract|checkpoint payloads?|mesh error|topology error|OCCT-mesh)\b/i;
    const surfaces = [
      ["Model structure", getElementByAriaLabel("Model structure")],
      ["Inspector", getElementByAriaLabel("Inspector")],
      ["Modeling context", getSectionByAriaLabel("Modeling context")],
      ["Sketches", getSectionByAriaLabel("Sketches")],
      ["3D viewport", getElementByAriaLabel("3D viewport")],
      ["Project/File", getSectionByAriaLabel("Project")]
    ];
    const leaks = surfaces
      .map(([label, surface]) => {
        const text = compactText(surface.textContent, 1200);
        const match = text.match(forbiddenPattern);

        return match ? `${label}: ${match[0]} in ${text}` : undefined;
      })
      .filter(Boolean);

    if (leaks.length > 0) {
      fail(
        "v14-normal-surfaces-user-facing-copy-browser",
        "V14 normal app surfaces avoid internal topology/debug labels",
        leaks.join(" | ")
      );
      return;
    }

    pass(
      "v14-normal-surfaces-user-facing-copy-browser",
      "V14 normal app surfaces avoid internal topology/debug labels"
    );
  }

  async function importV14TopologyBrowserFixture(projectJson, waitLabel) {
    openDetailsBySummary(document.body, "Project/File");
    let projectPanel = getSectionByAriaLabel("Project");
    loadProjectJsonFileIntoInput(
      projectPanel,
      projectJson,
      ids.v14ProjectFileName
    );
    await waitFor(
      () =>
        includesText(
          getSectionByAriaLabel("Project"),
          `Loaded ${ids.v14ProjectFileName}`
        ) && includesText(getSectionByAriaLabel("Project"), "Ready to import"),
      "loaded V14 topology browser fixture JSON"
    );
    projectPanel = getSectionByAriaLabel("Project");
    clickButton(projectPanel, "Import JSON");
    await waitFor(() => {
      const structure = getElementByAriaLabel("Model structure");
      const ready =
        includesText(structure, ids.v14TargetBodyName) &&
        includesText(structure, ids.v14AddTargetBodyName) &&
        includesText(structure, "V14 smoke source cylinder");

      if (!ready) {
        throw new Error(compactText(structure.textContent, 520));
      }

      return true;
    }, waitLabel);
  }

  async function verifyV14CylinderSidePlaneHoleProjectJsonSource(waitLabel) {
    openDetailsBySummary(document.body, "Project/File");
    const projectPanel = getSectionByAriaLabel("Project");
    await waitFor(() => {
      const exportButton = getButtonByText(projectPanel, "Export JSON");

      if (!exportButton || exportButton.disabled) {
        throw new Error(compactText(projectPanel.textContent, 520));
      }

      return true;
    }, "V14 cylinder side-plane hole export ready");
    clickButton(projectPanel, "Export JSON");
    await waitFor(() => {
      const projectJsonPreview = getProjectJsonEditorValue(projectPanel);
      const ready =
        includesText(projectPanel, "Import draft") &&
        projectJsonPreview.includes("web-cad.project.v18") &&
        projectJsonPreview.includes(ids.v14CylinderSideHoleFeatureId);

      if (!ready) {
        throw new Error(
          [
            `project=${compactText(projectPanel.textContent, 420)}`,
            `json=${projectJsonPreview.trim().slice(0, 240)}`
          ].join("; ")
        );
      }

      return true;
    }, waitLabel);
    assertV14CylinderSidePlaneHoleProjectJson(
      getProjectJsonEditorValue(projectPanel)
    );
    pass(
      "v14-cylinder-side-plane-hole-source-json-browser",
      "V14 cylinder side-plane hole JSON keeps public sketch plane and topology target proof",
      ids.v14CylinderSideHoleFeatureId
    );
  }

  async function verifyV14ResultCutWallEdgeFinishProjectJsonSource(
    waitLabel,
    { operation, featureName, passId, passLabel, referenceName }
  ) {
    openDetailsBySummary(document.body, "Project/File");
    const projectPanel = getSectionByAriaLabel("Project");
    await waitFor(() => {
      const exportButton = getButtonByText(projectPanel, "Export JSON");

      if (!exportButton || exportButton.disabled) {
        throw new Error(compactText(projectPanel.textContent, 520));
      }

      return true;
    }, "V14 result cut-wall edge-finish export ready");
    clickButton(projectPanel, "Export JSON");
    await waitFor(() => {
      const projectJsonPreview = getProjectJsonEditorValue(projectPanel);
      const ready =
        includesText(projectPanel, "Import draft") &&
        projectJsonPreview.includes(featureName);

      if (!ready) {
        throw new Error(
          [
            `project=${compactText(projectPanel.textContent, 420)}`,
            `json=${projectJsonPreview.trim().slice(0, 240)}`
          ].join("; ")
        );
      }

      return true;
    }, waitLabel);
    assertV14ResultCutWallEdgeFinishProjectJson(
      getProjectJsonEditorValue(projectPanel),
      { operation, featureName, referenceName }
    );
    if (passId === "v14-result-cut-wall-edge-finish-source-json-browser") {
      pass(
        "v14-result-cut-wall-edge-finish-source-json-browser",
        passLabel,
        featureName
      );
    } else {
      pass(
        "v14-result-cut-wall-edge-fillet-source-json-browser",
        passLabel,
        featureName
      );
    }
  }

  async function verifyV14SelectedResultCutWallEdgeFinishProjectJsonSource(
    waitLabel,
    { operation, featureName, passLabel }
  ) {
    openDetailsBySummary(document.body, "Project/File");
    const projectPanel = getSectionByAriaLabel("Project");
    await waitFor(() => {
      const exportButton = getButtonByText(projectPanel, "Export JSON");

      if (!exportButton || exportButton.disabled) {
        throw new Error(compactText(projectPanel.textContent, 520));
      }

      return true;
    }, "V14 selected result cut-wall edge-finish export ready");
    clickButton(projectPanel, "Export JSON");
    await waitFor(() => {
      const projectJsonPreview = getProjectJsonEditorValue(projectPanel);
      const ready =
        includesText(projectPanel, "Import draft") &&
        projectJsonPreview.includes(featureName);

      if (!ready) {
        throw new Error(
          [
            `project=${compactText(projectPanel.textContent, 420)}`,
            `json=${projectJsonPreview.trim().slice(0, 240)}`
          ].join("; ")
        );
      }

      return true;
    }, waitLabel);
    assertV14SelectedResultCutWallEdgeFinishProjectJson(
      getProjectJsonEditorValue(projectPanel),
      { operation, featureName }
    );
    passV14SelectedResultCutWallEdgeFinishSourceCheck({
      featureName,
      operation,
      passLabel
    });
  }

  async function verifyV14ResultHoleProjectJsonSource(waitLabel) {
    openDetailsBySummary(document.body, "Project/File");
    const projectPanel = getSectionByAriaLabel("Project");
    clickButton(projectPanel, "Export JSON");
    await waitFor(() => {
      const projectJsonPreview = getProjectJsonEditorValue(projectPanel);
      const ready =
        includesText(projectPanel, "Import draft") &&
        projectJsonPreview.includes("web-cad.project.v18") &&
        projectJsonPreview.includes(ids.v14HoleFeatureId);

      if (!ready) {
        throw new Error(
          [
            `project=${compactText(projectPanel.textContent, 420)}`,
            `json=${projectJsonPreview.trim().slice(0, 240)}`
          ].join("; ")
        );
      }

      return true;
    }, waitLabel);
    assertV14ResultHoleProjectJson(getProjectJsonEditorValue(projectPanel));
  }

  async function verifyV14ResultCutProjectJsonSource(waitLabel) {
    openDetailsBySummary(document.body, "Project/File");
    const projectPanel = getSectionByAriaLabel("Project");
    clickButton(projectPanel, "Export JSON");
    await waitFor(() => {
      const projectJsonPreview = getProjectJsonEditorValue(projectPanel);
      const ready =
        includesText(projectPanel, "Import draft") &&
        projectJsonPreview.includes("web-cad.project.v18") &&
        projectJsonPreview.includes(ids.v14CutFeatureId);

      if (!ready) {
        throw new Error(
          [
            `project=${compactText(projectPanel.textContent, 420)}`,
            `json=${projectJsonPreview.trim().slice(0, 240)}`
          ].join("; ")
        );
      }

      return true;
    }, waitLabel);
    assertV14ResultCutProjectJson(getProjectJsonEditorValue(projectPanel));
    pass(
      "v14-result-cut-topology-source-json-browser",
      "V14 result-body rectangle cut JSON keeps topology sketch and target proof",
      ids.v14CutFeatureId
    );
  }

  async function verifyV14ResultAddProjectJsonSource(waitLabel) {
    openDetailsBySummary(document.body, "Project/File");
    const projectPanel = getSectionByAriaLabel("Project");
    clickButton(projectPanel, "Export JSON");
    await waitFor(() => {
      const projectJsonPreview = getProjectJsonEditorValue(projectPanel);
      const ready =
        includesText(projectPanel, "Import draft") &&
        projectJsonPreview.includes("web-cad.project.v18") &&
        projectJsonPreview.includes(ids.v14AddFeatureId);

      if (!ready) {
        throw new Error(
          [
            `project=${compactText(projectPanel.textContent, 420)}`,
            `json=${projectJsonPreview.trim().slice(0, 240)}`
          ].join("; ")
        );
      }

      return true;
    }, waitLabel);
    assertV14ResultAddProjectJson(getProjectJsonEditorValue(projectPanel));
    pass(
      "v14-result-add-topology-source-json-browser",
      "V14 result-body rectangle add JSON keeps topology sketch and target proof",
      ids.v14AddFeatureId
    );
  }

  async function verifyV14CircleResultAddProjectJsonSource(waitLabel) {
    openDetailsBySummary(document.body, "Project/File");
    const projectPanel = getSectionByAriaLabel("Project");
    await waitFor(() => {
      const exportButton = getButtonByText(projectPanel, "Export JSON");

      if (!exportButton || exportButton.disabled) {
        throw new Error(compactText(projectPanel.textContent, 520));
      }

      return true;
    }, "V14 circle-result add export ready");
    clickButton(projectPanel, "Export JSON");
    await waitFor(() => {
      const projectJsonPreview = getProjectJsonEditorValue(projectPanel);
      const ready =
        includesText(projectPanel, "Import draft") &&
        projectJsonPreview.includes("web-cad.project.v18") &&
        projectJsonPreview.includes(ids.v14CircleAddFeatureId);

      if (!ready) {
        throw new Error(
          [
            `project=${compactText(projectPanel.textContent, 420)}`,
            `json=${projectJsonPreview.trim().slice(0, 240)}`
          ].join("; ")
        );
      }

      return true;
    }, waitLabel);
    assertV14TopologyBackedAddProjectJson({
      projectJson: getProjectJsonEditorValue(projectPanel),
      targetBodyId: ids.v14TargetBodyId,
      sketchId: ids.v14CircleAddSketchId,
      featureId: ids.v14CircleAddFeatureId,
      label: "V14 circle-origin result add"
    });
    pass(
      "v14-circle-result-add-topology-source-json-browser",
      "V14 circle-origin result-body add JSON keeps topology sketch and target proof",
      ids.v14CircleAddFeatureId
    );
  }

  async function verifyV14RectangleResultCutProjectJsonSource(waitLabel) {
    openDetailsBySummary(document.body, "Project/File");
    const projectPanel = getSectionByAriaLabel("Project");
    await waitFor(() => {
      const exportButton = getButtonByText(projectPanel, "Export JSON");

      if (!exportButton || exportButton.disabled) {
        throw new Error(compactText(projectPanel.textContent, 520));
      }

      return true;
    }, "V14 rectangle-result cut export ready");
    clickButton(projectPanel, "Export JSON");
    await waitFor(() => {
      const projectJsonPreview = getProjectJsonEditorValue(projectPanel);
      const ready =
        includesText(projectPanel, "Import draft") &&
        projectJsonPreview.includes("web-cad.project.v18") &&
        projectJsonPreview.includes(ids.v14RectangleCutFeatureId);

      if (!ready) {
        throw new Error(
          [
            `project=${compactText(projectPanel.textContent, 420)}`,
            `json=${projectJsonPreview.trim().slice(0, 240)}`
          ].join("; ")
        );
      }

      return true;
    }, waitLabel);
    assertV14RectangleResultCutProjectJson(
      getProjectJsonEditorValue(projectPanel)
    );
    pass(
      "v14-rectangle-result-cut-topology-source-json-browser",
      "V14 rectangle-family result-body cut JSON keeps topology sketch and target proof",
      ids.v14RectangleCutFeatureId
    );
  }

  async function runV14CylinderSidePlaneHoleWorkflowSmoke() {
    const bodyStableId = `generated:body:${ids.v14TargetBodyId}`;

    openTreePanel();
    clickButtonContaining(
      getElementByAriaLabel("Model structure"),
      ids.v14TargetBodyName
    );
    openSelectionPanel();
    await selectGeneratedReferenceByStableId(bodyStableId);
    await saveSelectedTopologyReference(
      "V14 cylinder side-plane hole body topology target",
      bodyStableId
    );

    clickButtonContaining(getElementByAriaLabel("Tool tabs"), "Sketches");
    const sketches = getSectionByAriaLabel("Sketches");
    setFieldByLabel(sketches, "Name", ids.v14CylinderSideHoleSketchName);
    setSelectByLabel(sketches, "Plane", "XZ");
    setInputByDetailsSummary(
      sketches,
      "Advanced sketch options",
      ids.v14CylinderSideHoleSketchId
    );
    clickButton(sketches, "Create sketch");
    await waitFor(
      () =>
        getControlByLabel(getSectionByAriaLabel("Sketches"), "Active sketch")
          .value === ids.v14CylinderSideHoleSketchId,
      "created V14 cylinder side-plane hole sketch"
    );

    clickButton(getElementByAriaLabel("Add sketch entity"), "Circle");
    const entityEditor = await waitForSectionByAriaLabel(
      "Sketch entity editor",
      "V14 cylinder side-plane circle entity editor"
    );
    setSelectByLabel(entityEditor, "Entity", "circle");
    setInputByDetailsSummary(
      entityEditor,
      "Optional ID",
      ids.v14CylinderSideHoleCircleEntityId
    );
    setFieldByLabel(entityEditor, "Center X", "0");
    setFieldByLabel(entityEditor, "Center Y", "1.5");
    setFieldByLabel(entityEditor, "Radius", "0.2");
    clickButton(entityEditor, "Add entity");
    await waitFor(
      () =>
        includesText(
          getElementByAriaLabel("Select sketch entity"),
          ids.v14CylinderSideHoleCircleEntityId
        ),
      "created V14 cylinder side-plane hole circle"
    );
    pass(
      "v14-cylinder-side-plane-circle-entity-browser",
      "V14 XZ sketch accepts a circle profile for a cylinder side hole",
      ids.v14CylinderSideHoleCircleEntityId
    );

    const featureEditor = getSectionByAriaLabel("Create authored feature");
    clickButton(featureEditor, "Hole");
    await waitFor(
      () =>
        Boolean(
          queryControlByLabel(
            getSectionByAriaLabel("Create authored feature"),
            "Target body"
          )
        ),
      "V14 cylinder side-plane hole target body control"
    );
    setSelectByLabel(
      getSectionByAriaLabel("Create authored feature"),
      "Target body",
      ids.v14TargetBodyId
    );
    setSelectByLabel(
      getSectionByAriaLabel("Create authored feature"),
      "Depth mode",
      "throughAll"
    );
    setSelectByLabel(
      getSectionByAriaLabel("Create authored feature"),
      "Direction",
      "positive"
    );
    openDetailsBySummary(
      getSectionByAriaLabel("Create authored feature"),
      "Advanced hole options"
    );
    setFieldByLabel(
      getSectionByAriaLabel("Create authored feature"),
      "Optional feature ID",
      ids.v14CylinderSideHoleFeatureId
    );
    setFieldByLabel(
      getSectionByAriaLabel("Create authored feature"),
      "Optional body ID",
      ids.v14CylinderSideHoleBodyId
    );
    setFieldByLabel(
      getSectionByAriaLabel("Create authored feature"),
      "Optional name",
      ids.v14CylinderSideHoleBodyName
    );
    await waitFor(() => {
      const nextFeatureEditor = getSectionByAriaLabel(
        "Create authored feature"
      );
      const createHoleButton = getButtonByText(
        nextFeatureEditor,
        "Create hole"
      );
      const ready =
        createHoleButton &&
        !createHoleButton.disabled &&
        includesText(
          nextFeatureEditor,
          "side hole through the circular target"
        );

      if (!ready) {
        throw new Error(compactText(nextFeatureEditor.textContent, 720));
      }

      return true;
    }, "V14 cylinder side-plane hole command enabled");
    clickButton(
      getSectionByAriaLabel("Create authored feature"),
      "Create hole"
    );
    await waitFor(
      () =>
        includesText(
          getElementByAriaLabel("Model structure"),
          ids.v14CylinderSideHoleBodyName
        ),
      "created V14 cylinder side-plane hole"
    );
    pass(
      "v14-cylinder-side-plane-hole-browser",
      "V14 XZ circle profile creates a side hole in a topology-backed circular result body",
      ids.v14CylinderSideHoleBodyId
    );
    await verifyV14DisplayGeometryReady({
      bodyName: ids.v14CylinderSideHoleBodyName,
      issueLabels: ["Hole mesh error", "Hole display geometry issue"]
    });
    pass(
      "v14-cylinder-side-plane-hole-display-ready-browser",
      "V14 cylinder side-plane hole reaches display geometry ready without a display geometry issue",
      ids.v14CylinderSideHoleBodyName
    );
  }

  async function runV14SelectedResultCutWallEdgeFinishWorkflowSmoke({
    operation,
    featureName,
    passLabel
  }) {
    const edgeStableId = `generated:edge:${ids.v14TargetBodyId}:longitudinal:uMin:vMin`;
    const operationLabel = operation === "chamfer" ? "chamfer" : "fillet";
    const operationTitle = operation === "chamfer" ? "Chamfer" : "Fillet";

    openTreePanel();
    clickButtonContaining(
      getElementByAriaLabel("Model structure"),
      ids.v14TargetBodyName
    );
    openSelectionPanel();
    await selectGeneratedReferenceByStableId(edgeStableId);
    await waitForGeneratedEdgeReferenceCommandReady(
      ids.v14TargetBodyId,
      `V14 selected result cut-wall edge command-ready for ${operationLabel}`
    );

    if (operation === "fillet") {
      clickButton(getSectionByAriaLabel("Modeling context"), "Fillet");
      await waitFor(() => {
        const currentModeling = getSectionByAriaLabel("Modeling context");
        const radiusInput = getControlByLabel(currentModeling, "Radius");
        const createButton = getButtonByText(currentModeling, "Create fillet");

        if (!(radiusInput instanceof HTMLInputElement) || !createButton) {
          throw new Error(compactText(currentModeling.textContent, 720));
        }

        return true;
      }, "V14 selected result cut-wall edge fillet form selected");
    }
    setFieldByLabel(
      getSectionByAriaLabel("Modeling context"),
      operation === "chamfer" ? "Distance" : "Radius",
      operation === "chamfer" ? "0.15" : "0.12"
    );
    setFieldByLabel(
      getSectionByAriaLabel("Modeling context"),
      "Name",
      featureName
    );
    await waitFor(() => {
      const currentModeling = getSectionByAriaLabel("Modeling context");
      const createButton = getButtonByText(
        currentModeling,
        `Create ${operationLabel}`
      );
      const referenceSelect = queryControlByLabel(currentModeling, "Reference");
      const ready =
        createButton &&
        !createButton.disabled &&
        includesText(currentModeling, "Edge finish") &&
        includesText(currentModeling, operationTitle) &&
        (!referenceSelect ||
          referenceSelect.value === "__selected_generated_edge__");

      if (!ready) {
        throw new Error(compactText(currentModeling.textContent, 720));
      }

      return true;
    }, `V14 selected result cut-wall edge ${operationLabel} command enabled`);
    clickButton(
      getSectionByAriaLabel("Modeling context"),
      `Create ${operationLabel}`
    );
    await waitFor(
      () => includesText(getElementByAriaLabel("Model structure"), featureName),
      `created V14 selected result cut-wall ${operationLabel}`
    );
    passV14SelectedResultCutWallEdgeFinishWorkflowCheck({
      featureName,
      operation,
      passLabel
    });
    await verifyV14DisplayGeometryReady({
      bodyName: featureName,
      issueLabels: [
        "Edge finish mesh error",
        "Edge finish display geometry issue"
      ]
    });
    passV14SelectedResultCutWallEdgeFinishDisplayReadyCheck({
      featureName,
      operation
    });
  }

  function passV14SelectedResultCutWallEdgeFinishWorkflowCheck({
    featureName,
    operation,
    passLabel
  }) {
    if (operation === "chamfer") {
      pass(
        "v14-result-cut-wall-selected-edge-chamfer-browser",
        passLabel,
        featureName
      );
      return;
    }

    pass(
      "v14-result-cut-wall-selected-edge-fillet-browser",
      passLabel,
      featureName
    );
  }

  function passV14SelectedResultCutWallEdgeFinishDisplayReadyCheck({
    featureName,
    operation
  }) {
    if (operation === "chamfer") {
      pass(
        "v14-result-cut-wall-selected-edge-chamfer-display-ready-browser",
        "V14 selected result-edge chamfer reaches display geometry ready without an edge-finish display issue",
        featureName
      );
      return;
    }

    pass(
      "v14-result-cut-wall-selected-edge-fillet-display-ready-browser",
      "V14 selected result-edge fillet reaches display geometry ready without an edge-finish display issue",
      featureName
    );
  }

  function passV14SelectedResultCutWallEdgeFinishSourceCheck({
    featureName,
    operation,
    passLabel
  }) {
    if (operation === "chamfer") {
      pass(
        "v14-result-cut-wall-selected-edge-source-json-browser",
        passLabel,
        featureName
      );
      return;
    }

    pass(
      "v14-result-cut-wall-selected-edge-fillet-source-json-browser",
      passLabel,
      featureName
    );
  }

  async function runV14ResultCutWallEdgeFinishWorkflowSmoke({
    operation,
    featureName,
    referenceName
  }) {
    const edgeStableId = `generated:edge:${ids.v14TargetBodyId}:longitudinal:uMin:vMin`;
    const operationLabel = operation === "chamfer" ? "chamfer" : "fillet";
    const operationTitle = operation === "chamfer" ? "Chamfer" : "Fillet";

    openTreePanel();
    clickButtonContaining(
      getElementByAriaLabel("Model structure"),
      ids.v14TargetBodyName
    );
    openSelectionPanel();
    await selectGeneratedReferenceByStableId(edgeStableId);
    await waitForGeneratedEdgeReferenceCommandReady(
      ids.v14TargetBodyId,
      "V14 result cut-wall edge command-ready for edge finish"
    );

    const modeling = getSectionByAriaLabel("Modeling context");
    setFieldByLabel(modeling, "Reference name", referenceName);
    clickButton(modeling, "Save name");
    await waitFor(() => {
      const currentModeling = getSectionByAriaLabel("Modeling context");
      const referenceSelect = getControlByLabel(currentModeling, "Reference");
      const namedOption = [...referenceSelect.options].find(
        (option) => option.value === `named:${referenceName}`
      );

      if (!namedOption || !includesText(currentModeling, referenceName)) {
        throw new Error(compactText(currentModeling.textContent, 720));
      }

      return true;
    }, "V14 result cut-wall edge named reference became selectable");
    setSelectByLabel(
      getSectionByAriaLabel("Modeling context"),
      "Reference",
      `named:${referenceName}`
    );
    await waitFor(
      () =>
        getControlByLabel(
          getSectionByAriaLabel("Modeling context"),
          "Reference"
        ).value === `named:${referenceName}`,
      "V14 result cut-wall edge named reference selected"
    );
    if (operation === "chamfer") {
      pass(
        "v14-result-cut-wall-named-edge-reference-browser",
        "V14 rectangle cut-wall result edge can be named and selected for edge finish",
        referenceName
      );
    }

    const namedModeling = getSectionByAriaLabel("Modeling context");
    if (operation === "fillet") {
      clickButton(namedModeling, "Fillet");
      await waitFor(() => {
        const currentModeling = getSectionByAriaLabel("Modeling context");
        const radiusInput = getControlByLabel(currentModeling, "Radius");
        const createButton = getButtonByText(currentModeling, "Create fillet");

        if (!(radiusInput instanceof HTMLInputElement) || !createButton) {
          throw new Error(compactText(currentModeling.textContent, 720));
        }

        return true;
      }, "V14 result cut-wall edge fillet form selected");
    }
    setFieldByLabel(
      getSectionByAriaLabel("Modeling context"),
      operation === "chamfer" ? "Distance" : "Radius",
      operation === "chamfer" ? "0.15" : "0.12"
    );
    setFieldByLabel(
      getSectionByAriaLabel("Modeling context"),
      "Name",
      featureName
    );
    await waitFor(() => {
      const currentModeling = getSectionByAriaLabel("Modeling context");
      const createButton = getButtonByText(
        currentModeling,
        `Create ${operationLabel}`
      );
      const ready =
        createButton &&
        !createButton.disabled &&
        includesText(currentModeling, "Edge finish") &&
        includesText(currentModeling, operationTitle);

      if (!ready) {
        throw new Error(compactText(currentModeling.textContent, 720));
      }

      return true;
    }, `V14 result cut-wall edge ${operationLabel} command enabled`);
    clickButton(
      getSectionByAriaLabel("Modeling context"),
      `Create ${operationLabel}`
    );
    await waitFor(
      () => includesText(getElementByAriaLabel("Model structure"), featureName),
      `created V14 result cut-wall ${operationLabel}`
    );
    if (operation === "chamfer") {
      pass(
        "v14-result-cut-wall-edge-chamfer-browser",
        "V14 rectangle cut-wall result edge creates a chamfer through a named reference",
        featureName
      );
    } else {
      pass(
        "v14-result-cut-wall-edge-fillet-browser",
        "V14 rectangle cut-wall result edge creates a fillet through a named reference",
        featureName
      );
    }
  }

  async function selectV14SourceBodyInInspector() {
    openTreePanel();
    clickV14SourceBodyRow();
    await waitFor(() => {
      const inspector = getElementByAriaLabel("Inspector");
      const ready = isV14SourceBodySelectedInInspector(inspector);

      if (!ready) {
        throw new Error(compactText(inspector.textContent, 900));
      }

      return true;
    }, "V14 source body selected in Inspector");
  }

  function isV14SourceBodySelectedInInspector(inspector) {
    return (
      includesText(inspector, ids.v14SourceFeatureId) &&
      includesText(inspector, ids.v14SourceBodyId)
    );
  }

  function clickV14SourceBodyRow() {
    clickModelStructureBodyRow({
      bodyName: ids.v14SourceBodyName,
      bodyStatus: "Used by later feature"
    });
  }

  function clickModelStructureBodyRow({ bodyName, bodyStatus }) {
    const structure = getElementByAriaLabel("Model structure");
    const bodyButton = [
      ...structure.querySelectorAll("button.model-story-row.body")
    ]
      .filter((button) => {
        const text = normalize(button.textContent);

        return (
          text.includes("Body") &&
          text.includes(bodyName) &&
          text.includes(bodyStatus)
        );
      })
      .sort(
        (left, right) =>
          normalize(left.textContent).length -
          normalize(right.textContent).length
      )[0];

    if (!bodyButton) {
      throw new Error(
        `Could not find body row ${bodyName}: ${compactText(
          structure.textContent,
          900
        )}`
      );
    }

    clickEnabledButton(bodyButton, bodyName);
  }

  function clickHistoryControl(text) {
    clickButton(getElementByAriaLabel("Command controls"), text);
  }

  async function verifyV14ResultEdgeUpstreamEditBlocked({
    operation = "chamfer",
    passCheck = true
  } = {}) {
    await selectV14SourceBodyInInspector();
    const operationLabel = operation === "fillet" ? "fillet" : "chamfer";

    await waitFor(() => {
      const inspector = getElementByAriaLabel("Inspector");
      if (!isV14SourceBodySelectedInInspector(inspector)) {
        openTreePanel();
        clickV14SourceBodyRow();
        throw new Error(compactText(inspector.textContent, 900));
      }

      const depthControl = queryControlByLabel(inspector, "Depth (mm)");
      const applyButton = getButtonByText(inspector, "Apply extrude");
      const text = compactText(inspector.textContent, 1200);
      const downstreamEditGuidance =
        "This source feature cannot be edited because a downstream result depends on it.";
      const ready =
        depthControl instanceof HTMLInputElement &&
        depthControl.disabled &&
        applyButton?.disabled === true &&
        includesText(inspector, "Feature parameters unavailable") &&
        includesText(inspector, downstreamEditGuidance) &&
        includesText(
          inspector,
          "Edit or repair that downstream feature before changing the original source."
        ) &&
        !/\b(tranche|milestone|debug|deferred)\b/i.test(text);

      if (!ready) {
        throw new Error(text);
      }

      return true;
    }, `V14 upstream source edit blocked by downstream ${operationLabel}`);

    if (passCheck) {
      passV14ResultEdgeUpstreamEditBlocked({ operation });
    }
  }

  function passV14ResultEdgeUpstreamEditBlocked({ operation }) {
    if (operation === "fillet") {
      pass(
        "v14-result-edge-fillet-upstream-edit-blocked-browser",
        "V14 upstream source edit is blocked with an action-oriented downstream fillet diagnostic",
        ids.v14SourceFeatureId
      );
      return;
    }

    pass(
      "v14-result-edge-upstream-edit-blocked-browser",
      "V14 upstream source edit is blocked with an action-oriented downstream chamfer diagnostic",
      ids.v14SourceFeatureId
    );
  }

  function passV14ResultEdgeUndoEditable({ operation }) {
    if (operation === "fillet") {
      pass(
        "v14-result-edge-fillet-undo-editable-browser",
        "V14 Undo removes the result-edge fillet blocker and restores source edit controls",
        ids.v14SourceFeatureId
      );
      return;
    }

    pass(
      "v14-result-edge-undo-editable-browser",
      "V14 Undo removes the result-edge chamfer blocker and restores source edit controls",
      ids.v14SourceFeatureId
    );
  }

  function passV14ResultEdgeRedoBlocked({ operation }) {
    if (operation === "fillet") {
      pass(
        "v14-result-edge-fillet-redo-blocked-browser",
        "V14 Redo restores the result-edge fillet blocker with action-oriented guidance",
        ids.v14SourceFeatureId
      );
      return;
    }

    pass(
      "v14-result-edge-redo-blocked-browser",
      "V14 Redo restores the result-edge chamfer blocker with action-oriented guidance",
      ids.v14SourceFeatureId
    );
  }

  async function verifyV14ResultHoleUpstreamEditBlocked() {
    await selectV14SourceBodyInInspector();

    await waitFor(() => {
      const inspector = getElementByAriaLabel("Inspector");
      const depthControl = queryControlByLabel(inspector, "Depth (mm)");
      const applyButton = getButtonByText(inspector, "Apply extrude");
      const text = compactText(inspector.textContent, 1200);
      const downstreamEditGuidance =
        "This source feature cannot be edited because a downstream result depends on it.";
      const ready =
        depthControl instanceof HTMLInputElement &&
        depthControl.disabled &&
        applyButton?.disabled === true &&
        includesText(inspector, "Feature parameters unavailable") &&
        includesText(inspector, downstreamEditGuidance) &&
        includesText(
          inspector,
          "Edit or repair that downstream feature before changing the original source."
        ) &&
        !/\b(tranche|milestone|debug|deferred)\b/i.test(text);

      if (!ready) {
        throw new Error(text);
      }

      return true;
    }, "V14 upstream source edit blocked by downstream result-body hole");

    pass(
      "v14-result-hole-upstream-edit-blocked-browser",
      "V14 upstream source edit is blocked with an action-oriented downstream hole diagnostic",
      ids.v14SourceFeatureId
    );
  }

  async function verifyV14ResultEdgeUndoRedoEditability({
    operation = "chamfer"
  } = {}) {
    const operationLabel = operation === "fillet" ? "fillet" : "chamfer";

    clickHistoryControl("Undo");
    await selectV14SourceBodyInInspector();

    await waitFor(() => {
      const inspector = getElementByAriaLabel("Inspector");
      const depthControl = queryControlByLabel(inspector, "Depth (mm)");
      const sideControl = queryControlByLabel(inspector, "Side");
      const text = compactText(inspector.textContent, 1200);
      const ready =
        depthControl instanceof HTMLInputElement &&
        sideControl instanceof HTMLSelectElement &&
        !depthControl.disabled &&
        !sideControl.disabled &&
        includesText(inspector, "Feature edits ready") &&
        includesText(inspector, "Edit Depth and Side below") &&
        !includesText(inspector, "Feature parameters unavailable") &&
        !includesText(
          inspector,
          "Edit or repair that downstream feature before changing the original source."
        ) &&
        !/\b(tranche|milestone|debug|deferred)\b/i.test(text);

      if (!ready) {
        throw new Error(text);
      }

      return true;
    }, `V14 result-edge ${operationLabel} undo restores source editability`);

    passV14ResultEdgeUndoEditable({ operation });

    clickHistoryControl("Redo");
    await verifyV14ResultEdgeUpstreamEditBlocked({
      operation,
      passCheck: false
    });

    passV14ResultEdgeRedoBlocked({ operation });
  }

  async function createV14TopologyBackedResultFaceSketch({
    sketchName,
    targetBodyId = ids.v14TargetBodyId,
    targetBodyName = ids.v14TargetBodyName,
    passId,
    passLabel
  }) {
    const faceStableId = `generated:face:${targetBodyId}:side:uMin`;

    openTreePanel();
    clickButtonContaining(
      getElementByAriaLabel("Model structure"),
      targetBodyName
    );
    openSelectionPanel();
    const bodyStableId = `generated:body:${targetBodyId}`;
    await selectGeneratedReferenceByStableId(bodyStableId);
    await saveSelectedTopologyReference(
      "V14 result body saved topology target",
      bodyStableId
    );
    await selectGeneratedReferenceByStableId(faceStableId);
    await saveSelectedTopologyReference(
      "V14 result face saved topology reference",
      faceStableId
    );
    await waitFor(() => {
      const modeling = getSectionByAriaLabel("Modeling context");
      const createSketchButton = getButtonByText(
        modeling,
        "Create sketch on face"
      );
      const ready =
        isSelectionPanelOpen() &&
        includesText(modeling, "Ready reference") &&
        includesText(modeling, "Attached sketch") &&
        createSketchButton !== undefined &&
        !createSketchButton.disabled;

      if (!ready) {
        throw new Error(compactText(modeling.textContent, 520));
      }

      return true;
    }, "V14 result face command-ready modeling action");

    const modeling = getSectionByAriaLabel("Modeling context");
    setFieldByLabel(modeling, "Sketch name", sketchName);
    clickButton(modeling, "Create sketch on face");
    await waitFor(
      () => includesText(getElementByAriaLabel("Model structure"), sketchName),
      "V14 result face attached sketch"
    );
    const sketchesAfterCreate = getSectionByAriaLabel("Sketches");
    const sketchId = getControlByLabel(
      sketchesAfterCreate,
      "Active sketch"
    ).value;

    if (passId && passLabel) {
      pass(passId, passLabel, sketchId);
    }

    return sketchId;
  }

  async function runV14TopologyBackedResultExtrudeCutWorkflowSmoke() {
    await runV14TopologyBackedRectangleCutFromResultFace({
      targetBodyId: ids.v14TargetBodyId,
      targetBodyName: ids.v14TargetBodyName,
      sketchIdKey: "v14CutSketchId",
      sketchName: ids.v14CutSketchName,
      rectangleEntityId: ids.v14CutRectangleEntityId,
      featureId: ids.v14CutFeatureId,
      bodyId: ids.v14CutBodyId,
      bodyName: ids.v14CutBodyName,
      passEntityCheck: passV14ResultFaceRectangleEntityBrowser,
      passCutCheck: passV14ResultFaceRectangleCutBrowser,
      passCutDisplayReadyCheck:
        passV14ResultFaceRectangleCutDisplayReadyBrowser,
      waitLabelPrefix: "V14 result-face rectangle cut"
    });
  }

  async function runV14TopologyBackedRectangleResultExtrudeCutWorkflowSmoke() {
    await runV14TopologyBackedRectangleCutFromResultFace({
      targetBodyId: ids.v14AddTargetBodyId,
      targetBodyName: ids.v14AddTargetBodyName,
      sketchIdKey: "v14RectangleCutSketchId",
      sketchName: ids.v14RectangleCutSketchName,
      rectangleEntityId: ids.v14RectangleCutRectangleEntityId,
      featureId: ids.v14RectangleCutFeatureId,
      bodyId: ids.v14RectangleCutBodyId,
      bodyName: ids.v14RectangleCutBodyName,
      passEntityCheck: passV14RectangleResultFaceRectangleEntityBrowser,
      passCutCheck: passV14RectangleResultFaceRectangleCutBrowser,
      passCutDisplayReadyCheck:
        passV14RectangleResultFaceRectangleCutDisplayReadyBrowser,
      waitLabelPrefix: "V14 rectangle-family result-face rectangle cut"
    });
  }

  function passV14ResultFaceRectangleEntityBrowser(detail) {
    pass(
      "v14-result-face-rectangle-entity-browser",
      "V14 result-face attached sketch accepts a rectangle cut profile",
      detail
    );
  }

  function passV14ResultFaceRectangleCutBrowser(detail) {
    pass(
      "v14-result-face-rectangle-cut-browser",
      "V14 result-face rectangle profile cuts the topology-backed result body",
      detail
    );
  }

  function passV14ResultFaceRectangleCutDisplayReadyBrowser(detail) {
    pass(
      "v14-result-face-rectangle-cut-display-ready-browser",
      "V14 result-face rectangle cut reaches display geometry ready without a Boolean display issue",
      detail
    );
  }

  function passV14RectangleResultFaceRectangleEntityBrowser(detail) {
    pass(
      "v14-rectangle-result-face-rectangle-entity-browser",
      "V14 rectangle-family result-face sketch accepts a rectangle cut profile",
      detail
    );
  }

  function passV14RectangleResultFaceRectangleCutBrowser(detail) {
    pass(
      "v14-rectangle-result-face-rectangle-cut-browser",
      "V14 rectangle-family result body accepts a second rectangle cut",
      detail
    );
  }

  function passV14RectangleResultFaceRectangleCutDisplayReadyBrowser(detail) {
    pass(
      "v14-rectangle-result-face-rectangle-cut-display-ready-browser",
      "V14 rectangle-family result-body cut reaches display geometry ready without a Boolean display issue",
      detail
    );
  }

  async function runV14TopologyBackedRectangleCutFromResultFace({
    targetBodyId,
    targetBodyName,
    sketchIdKey,
    sketchName,
    rectangleEntityId,
    featureId,
    bodyId,
    bodyName,
    passEntityCheck,
    passCutCheck,
    passCutDisplayReadyCheck,
    waitLabelPrefix
  }) {
    ids[sketchIdKey] = await createV14TopologyBackedResultFaceSketch({
      sketchName,
      targetBodyId,
      targetBodyName
    });

    clickButtonContaining(getElementByAriaLabel("Tool tabs"), "Sketches");
    const sketches = getSectionByAriaLabel("Sketches");
    setSelectByLabel(sketches, "Active sketch", ids[sketchIdKey]);
    await waitFor(
      () =>
        getControlByLabel(getSectionByAriaLabel("Sketches"), "Active sketch")
          .value === ids[sketchIdKey],
      `${waitLabelPrefix} sketch became active`
    );
    clickButton(getElementByAriaLabel("Add sketch entity"), "Rectangle");
    const entityEditor = await waitForSectionByAriaLabel(
      "Sketch entity editor",
      `${waitLabelPrefix} entity editor`
    );
    setSelectByLabel(entityEditor, "Entity", "rectangle");
    setInputByDetailsSummary(entityEditor, "Optional ID", rectangleEntityId);
    setFieldByLabel(entityEditor, "Center X", "0");
    setFieldByLabel(entityEditor, "Center Y", "0");
    setFieldByLabel(entityEditor, "Width", "0.25");
    setFieldByLabel(entityEditor, "Height", "0.25");
    clickButton(entityEditor, "Add entity");
    await waitFor(
      () =>
        includesText(
          getElementByAriaLabel("Select sketch entity"),
          rectangleEntityId
        ),
      `created ${waitLabelPrefix} rectangle`
    );
    passEntityCheck(rectangleEntityId);

    const featureEditor = getSectionByAriaLabel("Create authored feature");
    setFieldByLabel(featureEditor, "Depth", "0.25");
    setSelectByLabel(featureEditor, "Operation", "cut");
    await waitFor(
      () =>
        Boolean(
          queryControlByLabel(
            getSectionByAriaLabel("Create authored feature"),
            "Target body"
          )
        ),
      `${waitLabelPrefix} target body control`
    );
    setSelectByLabel(featureEditor, "Target body", targetBodyId);
    setFieldByLabel(featureEditor, "Optional feature ID", featureId);
    setFieldByLabel(featureEditor, "Optional body ID", bodyId);
    setFieldByLabel(featureEditor, "Optional name", bodyName);
    await waitFor(() => {
      const nextFeatureEditor = getSectionByAriaLabel(
        "Create authored feature"
      );
      const createExtrudeButton = getButtonByText(
        nextFeatureEditor,
        "Create extrude"
      );

      if (!createExtrudeButton || createExtrudeButton.disabled) {
        throw new Error(compactText(nextFeatureEditor.textContent, 520));
      }

      return true;
    }, `${waitLabelPrefix} command enabled`);
    clickButton(
      getSectionByAriaLabel("Create authored feature"),
      "Create extrude"
    );
    await waitFor(
      () => includesText(getElementByAriaLabel("Model structure"), bodyName),
      `created ${waitLabelPrefix}`
    );
    passCutCheck(bodyId);
    await verifyV14DisplayGeometryReady({
      bodyName,
      issueLabels: ["Boolean display geometry issue"]
    });
    passCutDisplayReadyCheck(bodyName);
  }

  async function runV14TopologyBackedResultExtrudeAddWorkflowSmoke() {
    const targetBodyId = ids.v14AddTargetBodyId;
    ids.v14AddSketchId = await createV14TopologyBackedResultFaceSketch({
      sketchName: ids.v14AddSketchName,
      targetBodyId,
      targetBodyName: ids.v14AddTargetBodyName
    });

    clickButtonContaining(getElementByAriaLabel("Tool tabs"), "Sketches");
    const sketches = getSectionByAriaLabel("Sketches");
    setSelectByLabel(sketches, "Active sketch", ids.v14AddSketchId);
    await waitFor(
      () =>
        getControlByLabel(getSectionByAriaLabel("Sketches"), "Active sketch")
          .value === ids.v14AddSketchId,
      "V14 result-face rectangle add sketch became active"
    );
    clickButton(getElementByAriaLabel("Add sketch entity"), "Rectangle");
    const entityEditor = await waitForSectionByAriaLabel(
      "Sketch entity editor",
      "V14 result-face add rectangle entity editor"
    );
    setSelectByLabel(entityEditor, "Entity", "rectangle");
    setInputByDetailsSummary(
      entityEditor,
      "Optional ID",
      ids.v14AddRectangleEntityId
    );
    setFieldByLabel(entityEditor, "Center X", "0");
    setFieldByLabel(entityEditor, "Center Y", "0");
    setFieldByLabel(entityEditor, "Width", "0.25");
    setFieldByLabel(entityEditor, "Height", "0.25");
    clickButton(entityEditor, "Add entity");
    await waitFor(
      () =>
        includesText(
          getElementByAriaLabel("Select sketch entity"),
          ids.v14AddRectangleEntityId
        ),
      "created V14 result-face add rectangle"
    );
    pass(
      "v14-result-face-add-rectangle-entity-browser",
      "V14 result-face attached sketch accepts a rectangle add profile",
      ids.v14AddRectangleEntityId
    );

    const featureEditor = getSectionByAriaLabel("Create authored feature");
    setFieldByLabel(featureEditor, "Depth", "0.25");
    setSelectByLabel(featureEditor, "Operation", "add");
    await waitFor(
      () =>
        Boolean(
          queryControlByLabel(
            getSectionByAriaLabel("Create authored feature"),
            "Target body"
          )
        ),
      "V14 result-face add target body control"
    );
    setSelectByLabel(featureEditor, "Target body", targetBodyId);
    setFieldByLabel(featureEditor, "Optional feature ID", ids.v14AddFeatureId);
    setFieldByLabel(featureEditor, "Optional body ID", ids.v14AddBodyId);
    setFieldByLabel(featureEditor, "Optional name", ids.v14AddBodyName);
    await waitFor(() => {
      const nextFeatureEditor = getSectionByAriaLabel(
        "Create authored feature"
      );
      const createExtrudeButton = getButtonByText(
        nextFeatureEditor,
        "Create extrude"
      );

      if (!createExtrudeButton || createExtrudeButton.disabled) {
        throw new Error(compactText(nextFeatureEditor.textContent, 520));
      }

      return true;
    }, "V14 result-face rectangle add command enabled");
    clickButton(
      getSectionByAriaLabel("Create authored feature"),
      "Create extrude"
    );
    await waitFor(
      () =>
        includesText(
          getElementByAriaLabel("Model structure"),
          ids.v14AddBodyName
        ),
      "created V14 result-body rectangle add"
    );
    pass(
      "v14-result-face-rectangle-add-browser",
      "V14 result-face rectangle profile adds to the topology-backed result body",
      ids.v14AddBodyId
    );
    await verifyV14DisplayGeometryReady({
      bodyName: ids.v14AddBodyName,
      issueLabels: ["Boolean display geometry issue"]
    });
    pass(
      "v14-result-face-rectangle-add-display-ready-browser",
      "V14 result-face rectangle add reaches display geometry ready without a Boolean display issue",
      ids.v14AddBodyName
    );
  }

  async function runV14TopologyBackedCircleResultExtrudeAddWorkflowSmoke() {
    const targetBodyId = ids.v14TargetBodyId;
    ids.v14CircleAddSketchId = await createV14TopologyBackedResultFaceSketch({
      sketchName: ids.v14CircleAddSketchName,
      targetBodyId,
      targetBodyName: ids.v14TargetBodyName
    });

    clickButtonContaining(getElementByAriaLabel("Tool tabs"), "Sketches");
    const sketches = getSectionByAriaLabel("Sketches");
    setSelectByLabel(sketches, "Active sketch", ids.v14CircleAddSketchId);
    await waitFor(
      () =>
        getControlByLabel(getSectionByAriaLabel("Sketches"), "Active sketch")
          .value === ids.v14CircleAddSketchId,
      "V14 circle-result add sketch became active"
    );
    clickButton(getElementByAriaLabel("Add sketch entity"), "Circle");
    const entityEditor = await waitForSectionByAriaLabel(
      "Sketch entity editor",
      "V14 circle-result add circle entity editor"
    );
    setSelectByLabel(entityEditor, "Entity", "circle");
    setInputByDetailsSummary(
      entityEditor,
      "Optional ID",
      ids.v14CircleAddCircleEntityId
    );
    setFieldByLabel(entityEditor, "Center X", "0");
    setFieldByLabel(entityEditor, "Center Y", "0");
    setFieldByLabel(entityEditor, "Radius", "0.15");
    clickButton(entityEditor, "Add entity");
    await waitFor(
      () =>
        includesText(
          getElementByAriaLabel("Select sketch entity"),
          ids.v14CircleAddCircleEntityId
        ),
      "created V14 circle-result add circle"
    );
    pass(
      "v14-circle-result-face-add-circle-entity-browser",
      "V14 circle-origin result-face attached sketch accepts a circle add profile",
      ids.v14CircleAddCircleEntityId
    );

    const featureEditor = getSectionByAriaLabel("Create authored feature");
    setFieldByLabel(featureEditor, "Depth", "0.25");
    setSelectByLabel(featureEditor, "Operation", "add");
    await waitFor(
      () =>
        Boolean(
          queryControlByLabel(
            getSectionByAriaLabel("Create authored feature"),
            "Target body"
          )
        ),
      "V14 circle-result add target body control"
    );
    setSelectByLabel(featureEditor, "Target body", targetBodyId);
    setFieldByLabel(
      featureEditor,
      "Optional feature ID",
      ids.v14CircleAddFeatureId
    );
    setFieldByLabel(featureEditor, "Optional body ID", ids.v14CircleAddBodyId);
    setFieldByLabel(featureEditor, "Optional name", ids.v14CircleAddBodyName);
    await waitFor(() => {
      const nextFeatureEditor = getSectionByAriaLabel(
        "Create authored feature"
      );
      const createExtrudeButton = getButtonByText(
        nextFeatureEditor,
        "Create extrude"
      );

      if (!createExtrudeButton || createExtrudeButton.disabled) {
        throw new Error(compactText(nextFeatureEditor.textContent, 520));
      }

      return true;
    }, "V14 circle-result add command enabled");
    clickButton(
      getSectionByAriaLabel("Create authored feature"),
      "Create extrude"
    );
    await waitFor(
      () =>
        includesText(
          getElementByAriaLabel("Model structure"),
          ids.v14CircleAddBodyName
        ),
      "created V14 circle-result add"
    );
    pass(
      "v14-circle-result-face-circle-add-browser",
      "V14 circle-origin result-face circle profile adds to the topology-backed result body",
      ids.v14CircleAddBodyId
    );
    await verifyV14DisplayGeometryReady({
      bodyName: ids.v14CircleAddBodyName,
      issueLabels: ["Boolean display geometry issue"]
    });
    pass(
      "v14-circle-result-face-circle-add-display-ready-browser",
      "V14 circle-origin result-face circle add reaches display geometry ready without a Boolean display issue",
      ids.v14CircleAddBodyName
    );
  }

  async function runV14TopologyBackedResultHoleWorkflowSmoke() {
    const targetBodyId = ids.v14TargetBodyId;
    ids.v14HoleSketchId = await createV14TopologyBackedResultFaceSketch({
      sketchName: ids.v14HoleSketchName,
      passId: "v14-result-face-attached-sketch-browser",
      passLabel:
        "V14 result-body planar face creates an attached sketch through the browser UI"
    });

    clickButtonContaining(getElementByAriaLabel("Tool tabs"), "Sketches");
    const sketches = getSectionByAriaLabel("Sketches");
    setSelectByLabel(sketches, "Active sketch", ids.v14HoleSketchId);
    await waitFor(
      () =>
        getControlByLabel(getSectionByAriaLabel("Sketches"), "Active sketch")
          .value === ids.v14HoleSketchId,
      "V14 result-face sketch became active"
    );
    clickButton(getElementByAriaLabel("Add sketch entity"), "Circle");
    const entityEditor = await waitForSectionByAriaLabel(
      "Sketch entity editor",
      "V14 result-face circle entity editor"
    );
    setSelectByLabel(entityEditor, "Entity", "circle");
    setInputByDetailsSummary(
      entityEditor,
      "Optional ID",
      ids.v14HoleCircleEntityId
    );
    setFieldByLabel(entityEditor, "Center X", "0");
    setFieldByLabel(entityEditor, "Center Y", "0");
    setFieldByLabel(entityEditor, "Radius", "0.2");
    clickButton(entityEditor, "Add entity");
    await waitFor(
      () =>
        includesText(
          getElementByAriaLabel("Select sketch entity"),
          ids.v14HoleCircleEntityId
        ),
      "created V14 result-face hole circle"
    );
    pass(
      "v14-result-face-circle-entity-browser",
      "V14 result-face attached sketch accepts a circle hole profile",
      ids.v14HoleCircleEntityId
    );

    const featureEditor = getSectionByAriaLabel("Create authored feature");
    clickButton(featureEditor, "Hole");
    await waitFor(
      () =>
        Boolean(
          queryControlByLabel(
            getSectionByAriaLabel("Create authored feature"),
            "Target body"
          )
        ),
      "V14 hole target body control"
    );
    setSelectByLabel(featureEditor, "Target body", targetBodyId);
    setSelectByLabel(featureEditor, "Depth mode", "throughAll");
    setSelectByLabel(featureEditor, "Direction", "positive");
    openDetailsBySummary(featureEditor, "Advanced hole options");
    setFieldByLabel(featureEditor, "Optional feature ID", ids.v14HoleFeatureId);
    setFieldByLabel(featureEditor, "Optional body ID", ids.v14HoleBodyId);
    setFieldByLabel(featureEditor, "Optional name", ids.v14HoleBodyName);
    await waitFor(() => {
      const nextFeatureEditor = getSectionByAriaLabel(
        "Create authored feature"
      );
      const createHoleButton = getButtonByText(
        nextFeatureEditor,
        "Create hole"
      );

      if (!createHoleButton || createHoleButton.disabled) {
        throw new Error(compactText(nextFeatureEditor.textContent, 520));
      }

      return true;
    }, "V14 result-face hole command enabled");
    clickButton(
      getSectionByAriaLabel("Create authored feature"),
      "Create hole"
    );
    await waitFor(
      () =>
        includesText(
          getElementByAriaLabel("Model structure"),
          ids.v14HoleBodyName
        ),
      "created V14 result-body hole"
    );
    pass(
      "v14-result-face-circle-hole-browser",
      "V14 result-face circle profile creates a hole in the topology-backed result body",
      ids.v14HoleBodyId
    );
    await verifyV14DisplayGeometryReady({
      bodyName: ids.v14HoleBodyName,
      issueLabels: ["Hole mesh error", "Hole display geometry issue"]
    });
    pass(
      "v14-result-face-circle-hole-display-ready-browser",
      "V14 result-face circle hole reaches display geometry ready without a display geometry issue",
      ids.v14HoleBodyName
    );
  }

  async function verifyV14DisplayGeometryReady({ bodyName, issueLabels }) {
    await waitFor(() => {
      if (
        issueLabels.some((issueLabel) =>
          includesText(document.body, issueLabel)
        )
      ) {
        throw new Error(
          `${issueLabels.join(" or ")} is visible after creating ${bodyName}.`
        );
      }

      const structure = getElementByAriaLabel("Model structure");
      const ready = [...structure.querySelectorAll("button")].some(
        (button) =>
          includesText(button, bodyName) &&
          includesText(button, "Display geometry ready")
      );

      if (!ready) {
        throw new Error(compactText(structure.textContent, 1200));
      }

      return true;
    }, `${bodyName} display geometry ready`);
  }

  async function saveSelectedTopologyReference(waitLabel, expectedStableId) {
    await waitFor(() => {
      const inspector = getElementByAriaLabel("Inspector");
      const referenceSelect = getControlByLabel(inspector, "Inspect reference");
      const ready =
        (!expectedStableId || referenceSelect.value === expectedStableId) &&
        includesText(inspector, "Saved reference") &&
        (includesText(inspector, "Save reference") ||
          includesText(inspector, "Saved reference active"));

      if (!ready) {
        throw new Error(compactText(inspector.textContent, 520));
      }

      return true;
    }, `${waitLabel} action`);

    const inspector = getElementByAriaLabel("Inspector");
    const saveButton = getButtonByText(inspector, "Save reference");

    if (saveButton && !saveButton.disabled) {
      saveButton.click();
    } else if (!includesText(inspector, "Saved reference active")) {
      throw new Error(compactText(inspector.textContent, 520));
    }

    await waitFor(() => {
      const nextInspector = getElementByAriaLabel("Inspector");
      const referenceSelect = getControlByLabel(
        nextInspector,
        "Inspect reference"
      );
      const ready =
        (!expectedStableId || referenceSelect.value === expectedStableId) &&
        includesText(nextInspector, "Saved reference active");

      if (!ready) {
        throw new Error(compactText(nextInspector.textContent, 520));
      }

      return true;
    }, waitLabel);
  }

  async function verifyV14ResultHoleWcadRoundTrip() {
    openDetailsBySummary(document.body, "Project/File");
    let projectPanel = await waitForSectionByAriaLabel(
      "Project",
      "V14 Project/File panel"
    );
    await waitFor(
      () =>
        includesText(projectPanel, "Project contents") &&
        includesText(projectPanel, "Save As"),
      "V14 Project/File save controls"
    );
    const v14DownloadCapture = createDownloadCapture();
    v14DownloadCapture.install();
    let wcadBytes;

    try {
      clickButton(projectPanel, "Save As");
      await waitFor(
        () => {
          if (v14DownloadCapture.blobs.length === 0) {
            throw new Error(
              `No V14 .wcad blob download was captured. Project panel: ${compactText(projectPanel.textContent, 720)}`
            );
          }

          if (!includesText(projectPanel, "Downloaded .wcad package")) {
            throw new Error(compactText(projectPanel.textContent, 520));
          }

          return true;
        },
        "downloaded V14 result-hole .wcad package",
        Math.max(timeoutMs, 60_000)
      );
      wcadBytes = await v14DownloadCapture.readFirstBytes();
    } finally {
      v14DownloadCapture.restore();
    }

    projectPanel = getSectionByAriaLabel("Project");
    loadProjectWcadFileIntoInput(projectPanel, wcadBytes, ids.v14WcadFileName);
    await waitFor(() => {
      openDetailsBySummary(document.body, "Project/File");
      const currentProjectPanel = getSectionByAriaLabel("Project");
      const ready =
        includesText(currentProjectPanel, ids.v14WcadFileName) &&
        includesText(currentProjectPanel, "Uploaded .wcad");

      if (!ready) {
        throw new Error(compactText(currentProjectPanel.textContent, 520));
      }

      return true;
    }, "opened V14 result-hole .wcad package");
    await waitFor(() => {
      const structure = getElementByAriaLabel("Model structure");
      const ready =
        includesText(structure, ids.v14HoleSketchName) &&
        includesText(structure, ids.v14HoleBodyName);

      if (!ready) {
        throw new Error(compactText(structure.textContent, 520));
      }

      return true;
    }, "V14 result hole survived .wcad round-trip");
    pass(
      "v14-result-hole-wcad-roundtrip-browser",
      "V14 result-body attached sketch and hole survive .wcad save/open",
      ids.v14HoleBodyId
    );
  }

  function assertV14ResultHoleProjectJson(projectJson) {
    const targetBodyId = ids.v14TargetBodyId;
    const parsed = JSON.parse(projectJson);
    const sketch = findObjectById(parsed, ids.v14HoleSketchId);
    const holeFeature = findObjectById(parsed, ids.v14HoleFeatureId);

    if (!sketch || sketch.attachment?.kind !== "topologyAnchorFace") {
      const sketches = Array.isArray(parsed.document?.sketches)
        ? parsed.document.sketches.map((candidate) => ({
            id: candidate.id,
            name: candidate.name,
            attachmentKind: candidate.attachment?.kind,
            topologyAnchorId: candidate.attachment?.topologyAnchorId,
            bodyId: candidate.attachment?.bodyId,
            faceStableId: candidate.attachment?.faceStableId
          }))
        : [];
      const features = Array.isArray(parsed.document?.features)
        ? parsed.document.features.map((candidate) => ({
            id: candidate.id,
            kind: candidate.kind,
            bodyId: candidate.bodyId,
            operationMode: candidate.operationMode,
            targetBodyId: candidate.targetBodyId,
            targetTopologyAnchorId: candidate.targetTopologyAnchorId
          }))
        : [];
      throw new Error(
        `V14 attached sketch lost topologyAnchorFace source for ${ids.v14HoleSketchId}: sketches=${JSON.stringify(sketches)} features=${JSON.stringify(features)}`
      );
    }

    if (sketch.attachment.bodyId !== targetBodyId) {
      throw new Error(
        `V14 attached sketch target body mismatch: ${sketch.attachment.bodyId}`
      );
    }

    if (
      !holeFeature ||
      holeFeature.kind !== "hole" ||
      holeFeature.targetBodyId !== targetBodyId ||
      typeof holeFeature.targetTopologyAnchorId !== "string" ||
      holeFeature.targetTopologyAnchorId.length === 0
    ) {
      throw new Error("V14 hole feature lost its topology target source.");
    }

    const sourceBoundaryText = JSON.stringify({
      attachment: sketch.attachment,
      feature: holeFeature
    });
    const privateIdPattern =
      /(renderer|meshId|occt|viewport|opfs|fileHandle|checkpointEntityId)/i;

    if (privateIdPattern.test(sourceBoundaryText)) {
      throw new Error(
        `V14 topology source leaked a private ID: ${sourceBoundaryText}`
      );
    }
  }

  function assertV14CylinderSidePlaneHoleProjectJson(projectJson) {
    const parsed = JSON.parse(projectJson);
    const sketch = findObjectById(parsed, ids.v14CylinderSideHoleSketchId);
    const holeFeature = findObjectById(
      parsed,
      ids.v14CylinderSideHoleFeatureId
    );

    if (!sketch || sketch.plane !== "XZ" || sketch.attachment) {
      throw new Error(
        `V14 cylinder side-plane hole sketch did not remain a public XZ sketch: ${JSON.stringify(sketch)}`
      );
    }

    if (
      !holeFeature ||
      holeFeature.kind !== "hole" ||
      holeFeature.targetBodyId !== ids.v14TargetBodyId ||
      typeof holeFeature.targetTopologyAnchorId !== "string" ||
      holeFeature.targetTopologyAnchorId.length === 0 ||
      holeFeature.sketchId !== ids.v14CylinderSideHoleSketchId ||
      holeFeature.circleEntityId !== ids.v14CylinderSideHoleCircleEntityId
    ) {
      throw new Error(
        `V14 cylinder side-plane hole lost its public topology target source: ${JSON.stringify(holeFeature)}`
      );
    }

    const sourceBoundaryText = JSON.stringify({
      sketch,
      feature: holeFeature
    });
    const privateIdPattern =
      /(renderer|meshId|occt|viewport|opfs|fileHandle|checkpointEntityId)/i;

    if (privateIdPattern.test(sourceBoundaryText)) {
      throw new Error(
        `V14 cylinder side-plane hole source leaked a private ID: ${sourceBoundaryText}`
      );
    }
  }

  function assertV14ResultCutWallEdgeFinishProjectJson(
    projectJson,
    { operation, featureName, referenceName }
  ) {
    const edgeStableId = `generated:edge:${ids.v14TargetBodyId}:longitudinal:uMin:vMin`;
    const parsed = JSON.parse(projectJson);
    const features = Array.isArray(parsed.document?.features)
      ? parsed.document.features
      : [];
    const namedReferences = Array.isArray(parsed.document?.namedReferences)
      ? parsed.document.namedReferences
      : [];
    const edgeFinishFeature = features.find(
      (candidate) =>
        candidate?.kind === operation && candidate.name === featureName
    );
    const namedReference = namedReferences.find(
      (candidate) => candidate?.name === referenceName
    );

    if (
      !namedReference ||
      namedReference.bodyId !== ids.v14TargetBodyId ||
      namedReference.stableId !== edgeStableId ||
      namedReference.kind !== "edge"
    ) {
      throw new Error(
        `V14 result cut-wall edge name lost its public generated-edge target: ${JSON.stringify(namedReference)}`
      );
    }

    if (
      !edgeFinishFeature ||
      edgeFinishFeature.targetBodyId !== ids.v14TargetBodyId ||
      edgeFinishFeature.namedReference !== referenceName ||
      typeof edgeFinishFeature.edgeStableId === "string"
    ) {
      throw new Error(
        `V14 result cut-wall edge ${operation} lost its public named-edge source: ${JSON.stringify(edgeFinishFeature)}`
      );
    }

    const sourceBoundaryText = JSON.stringify({
      feature: edgeFinishFeature,
      namedReference
    });
    const privateIdPattern =
      /(renderer|meshId|occt|viewport|opfs|fileHandle|checkpointEntityId)/i;

    if (privateIdPattern.test(sourceBoundaryText)) {
      throw new Error(
        `V14 result cut-wall edge ${operation} source leaked a private ID: ${sourceBoundaryText}`
      );
    }
  }

  function assertV14SelectedResultCutWallEdgeFinishProjectJson(
    projectJson,
    { operation, featureName }
  ) {
    const edgeStableId = `generated:edge:${ids.v14TargetBodyId}:longitudinal:uMin:vMin`;
    const parsed = JSON.parse(projectJson);
    const features = Array.isArray(parsed.document?.features)
      ? parsed.document.features
      : [];
    const edgeFinishFeature = features.find(
      (candidate) =>
        candidate?.kind === operation && candidate.name === featureName
    );
    const usesSelectedGeneratedEdge =
      edgeFinishFeature?.edgeStableId === edgeStableId;
    const usesSelectedTopologyAnchor =
      typeof edgeFinishFeature?.topologyAnchorId === "string" &&
      edgeFinishFeature.topologyAnchorId.length > 0;

    if (
      !edgeFinishFeature ||
      edgeFinishFeature.targetBodyId !== ids.v14TargetBodyId ||
      (!usesSelectedGeneratedEdge && !usesSelectedTopologyAnchor) ||
      typeof edgeFinishFeature.namedReference === "string"
    ) {
      throw new Error(
        `V14 selected result cut-wall edge ${operation} lost its public selected-edge source: ${JSON.stringify(edgeFinishFeature)}`
      );
    }

    const sourceBoundaryText = JSON.stringify({
      feature: edgeFinishFeature
    });
    const privateIdPattern =
      /(renderer|meshId|occt|viewport|opfs|fileHandle|checkpointEntityId)/i;

    if (privateIdPattern.test(sourceBoundaryText)) {
      throw new Error(
        `V14 selected result cut-wall edge ${operation} source leaked a private ID: ${sourceBoundaryText}`
      );
    }
  }

  function assertV14ResultCutProjectJson(projectJson) {
    assertV14TopologyBackedRectangleCutProjectJson({
      projectJson,
      targetBodyId: ids.v14TargetBodyId,
      sketchId: ids.v14CutSketchId,
      featureId: ids.v14CutFeatureId,
      label: "V14 rectangle cut"
    });
  }

  function assertV14RectangleResultCutProjectJson(projectJson) {
    assertV14TopologyBackedRectangleCutProjectJson({
      projectJson,
      targetBodyId: ids.v14AddTargetBodyId,
      sketchId: ids.v14RectangleCutSketchId,
      featureId: ids.v14RectangleCutFeatureId,
      label: "V14 rectangle-family result cut"
    });
  }

  function assertV14TopologyBackedRectangleCutProjectJson({
    projectJson,
    targetBodyId,
    sketchId,
    featureId,
    label
  }) {
    const parsed = JSON.parse(projectJson);
    const sketch = findObjectById(parsed, sketchId);
    const cutFeature = findObjectById(parsed, featureId);

    if (!sketch || sketch.attachment?.kind !== "topologyAnchorFace") {
      throw new Error(
        `${label} sketch lost topologyAnchorFace source for ${sketchId}.`
      );
    }

    if (sketch.attachment.bodyId !== targetBodyId) {
      throw new Error(
        `${label} sketch target body mismatch: ${sketch.attachment.bodyId}`
      );
    }

    if (
      !cutFeature ||
      cutFeature.kind !== "extrude" ||
      cutFeature.operationMode !== "cut" ||
      cutFeature.targetBodyId !== targetBodyId ||
      typeof cutFeature.targetTopologyAnchorId !== "string" ||
      cutFeature.targetTopologyAnchorId.length === 0
    ) {
      throw new Error(`${label} feature lost its topology target source.`);
    }

    const sourceBoundaryText = JSON.stringify({
      attachment: sketch.attachment,
      feature: cutFeature
    });
    const privateIdPattern =
      /(renderer|meshId|occt|viewport|opfs|fileHandle|checkpointEntityId)/i;

    if (privateIdPattern.test(sourceBoundaryText)) {
      throw new Error(
        `${label} source leaked a private ID: ${sourceBoundaryText}`
      );
    }
  }

  function assertV14ResultAddProjectJson(projectJson) {
    assertV14TopologyBackedAddProjectJson({
      projectJson,
      targetBodyId: ids.v14AddTargetBodyId,
      sketchId: ids.v14AddSketchId,
      featureId: ids.v14AddFeatureId,
      label: "V14 rectangle add"
    });
  }

  function assertV14TopologyBackedAddProjectJson({
    projectJson,
    targetBodyId,
    sketchId,
    featureId,
    label
  }) {
    const parsed = JSON.parse(projectJson);
    const sketch = findObjectById(parsed, sketchId);
    const addFeature = findObjectById(parsed, featureId);

    if (!sketch || sketch.attachment?.kind !== "topologyAnchorFace") {
      throw new Error(
        `${label} sketch lost topologyAnchorFace source for ${sketchId}.`
      );
    }

    if (sketch.attachment.bodyId !== targetBodyId) {
      throw new Error(
        `${label} sketch target body mismatch: ${sketch.attachment.bodyId}`
      );
    }

    if (
      !addFeature ||
      addFeature.kind !== "extrude" ||
      addFeature.operationMode !== "add" ||
      addFeature.targetBodyId !== targetBodyId ||
      typeof addFeature.targetTopologyAnchorId !== "string" ||
      addFeature.targetTopologyAnchorId.length === 0
    ) {
      throw new Error(`${label} feature lost its topology target source.`);
    }

    const sourceBoundaryText = JSON.stringify({
      attachment: sketch.attachment,
      feature: addFeature
    });
    const privateIdPattern =
      /(renderer|meshId|occt|viewport|opfs|fileHandle|checkpointEntityId)/i;

    if (privateIdPattern.test(sourceBoundaryText)) {
      throw new Error(
        `${label} source leaked a private ID: ${sourceBoundaryText}`
      );
    }
  }

  function findObjectById(value, id) {
    if (!value || typeof value !== "object") {
      return undefined;
    }

    if (!Array.isArray(value) && value.id === id) {
      return value;
    }

    for (const child of Object.values(value)) {
      const match = findObjectById(child, id);

      if (match) {
        return match;
      }
    }

    return undefined;
  }

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

  async function runV13TopologyIdentityBrowserWorkflowSmoke(projectJson) {
    if (!projectJson) {
      fail(
        "v13-project-json-import",
        "V13 topology release fixture imports through Project/File",
        "V13 release sample project JSON was not available."
      );
      return;
    }

    openDetailsBySummary(document.body, "Project/File");
    let projectPanel = getSectionByAriaLabel("Project");
    loadProjectJsonFileIntoInput(
      projectPanel,
      projectJson,
      ids.v13ProjectFileName
    );
    await waitFor(
      () =>
        includesText(
          getSectionByAriaLabel("Project"),
          `Loaded ${ids.v13ProjectFileName}`
        ) && includesText(getSectionByAriaLabel("Project"), "Ready to import"),
      "loaded V13 topology browser fixture JSON"
    );
    projectPanel = getSectionByAriaLabel("Project");
    clickButton(projectPanel, "Import JSON");
    await waitFor(() => {
      const project = getSectionByAriaLabel("Project");
      const structure = getElementByAriaLabel("Model structure");
      const ready =
        includesText(project, "Imported web-cad.project.v18") &&
        includesText(structure, ids.v13RepairBodyName) &&
        includesText(structure, ids.v13RepairReferenceName) &&
        includesText(structure, ids.v13TargetBodyName) &&
        includesText(structure, ids.v13CutBodyName);

      if (!ready) {
        throw new Error(
          [
            `project=${compactText(project.textContent, 360)}`,
            `structure=${compactText(structure.textContent, 360)}`
          ].join("; ")
        );
      }

      return true;
    }, "imported V13 topology browser fixture JSON");
    pass(
      "v13-project-json-import",
      "V13 topology release fixture imports through Project/File",
      compactText(getElementByAriaLabel("Model structure").textContent, 420)
    );

    projectPanel = getSectionByAriaLabel("Project");
    const topologyStatus = getElementByAriaLabel("Topology identity status");
    const topologyStatusChecks = [
      assertIncludes(topologyStatus, "Topology identity", "v13-topology-title"),
      assertIncludes(topologyStatus, "3 checkpoints", "v13-checkpoint-count"),
      assertIncludes(topologyStatus, "3 anchors", "v13-anchor-count"),
      assertIncludes(topologyStatus, "partbench.wcad.v2", "v13-wcad-v2"),
      assertIncludes(topologyStatus, "Use .wcad", "v13-json-warning")
    ];

    if (topologyStatusChecks.every(Boolean)) {
      pass(
        "v13-project-topology-status",
        "Project/File reports compact V13 topology checkpoint and anchor status",
        compactText(topologyStatus.textContent, 420)
      );
    }

    await runV13CheckpointedWcadSaveAsSmoke(projectPanel);

    async function runV13CheckpointedWcadSaveAsSmoke(projectPanelForSave) {
      const v13DownloadCapture = createDownloadCapture();
      v13DownloadCapture.install();

      try {
        clickButton(projectPanelForSave, "Save As");
        await waitFor(
          () => {
            if (v13DownloadCapture.blobs.length === 0) {
              throw new Error("No V13 .wcad blob download was captured.");
            }

            if (
              !includesText(projectPanelForSave, "Downloaded .wcad package")
            ) {
              throw new Error(
                compactText(projectPanelForSave.textContent, 520)
              );
            }

            return true;
          },
          "downloaded V13 checkpointed .wcad package through fallback Save As",
          Math.max(timeoutMs, 60_000)
        );
        const v13WcadBytes = await v13DownloadCapture.readFirstBytes();
        const v13WcadText = decodeBytesForSearch(v13WcadBytes);
        const v13CheckpointPackageReady =
          v13WcadText.includes('"packageVersion": "partbench.wcad.v2"') &&
          v13WcadText.includes("checkpoints/v13_checkpoint_repair_body.brep") &&
          v13WcadText.includes(
            "checkpoints/v13_checkpoint_repair_body.topology.cbor"
          ) &&
          v13WcadText.includes(
            "checkpoints/v13_checkpoint_repair_body.signature.cbor"
          ) &&
          v13WcadText.includes("checkpoints/v13_checkpoint_target_body.brep") &&
          v13WcadText.includes(
            "checkpoints/v13_checkpoint_target_body.topology.cbor"
          ) &&
          v13WcadText.includes(
            "checkpoints/v13_checkpoint_target_body.signature.cbor"
          ) &&
          v13WcadText.includes("CASCADE Topology");

        if (v13CheckpointPackageReady) {
          pass(
            "v13-wcad-save-as-checkpoint-payloads",
            "V13 Save As .wcad attaches generated checkpoint payload entries",
            `${v13WcadBytes.byteLength} bytes`
          );
        } else {
          fail(
            "v13-wcad-save-as-checkpoint-payloads",
            "V13 Save As .wcad attaches generated checkpoint payload entries",
            compactText(v13WcadText, 520)
          );
        }
      } catch (error) {
        projectPanel = getSectionByAriaLabel("Project");
        fail(
          "v13-wcad-save-as-checkpoint-payloads",
          "V13 Save As .wcad attaches generated checkpoint payload entries",
          [
            error instanceof Error ? error.message : String(error),
            compactText(projectPanel.textContent, 520)
          ].join("; ")
        );
      } finally {
        v13DownloadCapture.restore();
      }
    }

    openTreePanel();
    clickButtonContaining(
      getElementByAriaLabel("Model structure"),
      ids.v13RepairReferenceName
    );
    await waitFor(
      () => isTreePanelOpen(),
      "V13 repaired named reference selection keeps preferred tree tab"
    );
    openSelectionPanel();
    await waitForGeneratedReferenceCommandReady(
      ids.v13RepairBodyId,
      "V13 topology-repaired named reference is command-ready"
    );
    pass(
      "v13-repaired-reference-command-ready",
      "V13 repaired named reference resolves to a command-ready topology-anchored face",
      getSelectionText()
    );

    await waitFor(() => {
      const inspector = getElementByAriaLabel("Inspector");
      const modeling = getSectionByAriaLabel("Modeling context");
      const ready =
        includesText(inspector, "Ready reference") &&
        includesText(inspector, ids.v13RepairReferenceName) &&
        includesText(modeling, "Ready reference") &&
        includesText(modeling, "Create sketch on face");

      if (!ready) {
        throw new Error(
          [
            `inspector=${compactText(inspector.textContent, 360)}`,
            `modeling=${compactText(modeling.textContent, 300)}`
          ].join("; ")
        );
      }

      return true;
    }, "V13 topology-anchor provenance is visible");
    pass(
      "v13-repaired-reference-topology-provenance",
      "Selection and Modeling show the repaired topology-backed face as command-ready without debug copy",
      getSelectionText()
    );

    await runV13ExplicitStableReferenceActionSmoke();

    openTreePanel();
    clickButtonContaining(
      getElementByAriaLabel("Model structure"),
      ids.v13TargetBodyName
    );
    await waitFor(
      () => isTreePanelOpen(),
      "V13 topology target body selection keeps preferred tree tab"
    );
    openSelectionPanel();
    await waitFor(() => {
      const inspector = getElementByAriaLabel("Inspector");
      const modeling = getSectionByAriaLabel("Modeling context");
      const ready =
        isSelectionPanelOpen() &&
        includesText(inspector, ids.v13TargetBodyId) &&
        includesText(inspector, "Selection body consumed") &&
        includesText(inspector, ids.v13CutFeatureId) &&
        includesText(modeling, "Selection body consumed");

      if (!ready) {
        throw new Error(
          [
            `selectionPanelOpen=${isSelectionPanelOpen() ? "true" : "false"}`,
            `inspector=${compactText(inspector.textContent, 360)}`,
            `modeling=${compactText(modeling.textContent, 260)}`
          ].join("; ")
        );
      }

      return true;
    }, "V13 target body consumed diagnostic after anchored downstream cut");
    pass(
      "v13-target-body-consumed-diagnostic",
      "V13 topology-anchored target body remains selectable with structured consumed diagnostics",
      getSelectionText()
    );

    const userVisibleTopologyText = [
      getRenderedText(topologyStatus),
      getRenderedText(getElementByAriaLabel("Inspector")),
      getRenderedText(getSectionByAriaLabel("Modeling context"))
    ].join(" ");
    const privateLeak = findPrivateTopologyUiLeak(userVisibleTopologyText);
    if (privateLeak) {
      fail(
        "v13-no-private-topology-ui-leak",
        "Topology UI avoids private renderer, kernel, and checkpoint-local ids",
        privateLeak
      );
    } else {
      pass(
        "v13-no-private-topology-ui-leak",
        "Topology UI avoids private renderer, kernel, and checkpoint-local ids",
        compactText(userVisibleTopologyText, 420)
      );
    }

    openTreePanel();
    clickButtonContaining(
      getElementByAriaLabel("Model structure"),
      ids.v13CutBodyName
    );
    await waitFor(
      () =>
        includesText(getElementByAriaLabel("Inspector"), ids.v13CutBodyId) ||
        includesText(
          getSectionByAriaLabel("Modeling context"),
          ids.v13CutBodyName
        ),
      "V13 anchored cut result body is selectable"
    );

    openDetailsBySummary(document.body, "Project/File");
    projectPanel = getSectionByAriaLabel("Project");
    clickButton(projectPanel, "Export JSON");
    await waitFor(() => {
      const projectJsonPreview = getProjectJsonEditorValue(projectPanel);
      const ready =
        includesText(projectPanel, "Import draft") &&
        projectJsonPreview.includes("web-cad.project.v18") &&
        projectJsonPreview.includes(ids.v13TargetBodyAnchorId) &&
        projectJsonPreview.includes(ids.v13RepairTopologyAnchorId) &&
        projectJsonPreview.includes(ids.v13CutFeatureId);

      if (!ready) {
        throw new Error(
          [
            `project=${compactText(projectPanel.textContent, 420)}`,
            `json=${projectJsonPreview.trim().slice(0, 240)}`
          ].join("; ")
        );
      }

      return true;
    }, "V13 exported topology source JSON preview");
    assertV13ExportedProjectJsonIncludes(
      getProjectJsonEditorValue(projectPanel)
    );
    pass(
      "v13-downstream-anchor-cut-export",
      "V13 downstream cut keeps its topology-anchor target through Project/File JSON export",
      "web-cad.project.v18"
    );
  }

  async function runV13ExplicitStableReferenceActionSmoke() {
    openTreePanel();
    clickButtonContaining(
      getElementByAriaLabel("Model structure"),
      ids.v13RepairBodyName
    );
    openSelectionPanel();
    await waitForBodyCommandReady(
      ids.v13RepairBodyId,
      "V13 repair body selected before explicit stable-reference action"
    );
    const selectedLabel = await selectGeneratedReferenceByStableId(
      ids.v13ExplicitStableFaceId
    );
    await waitFor(() => {
      const inspector = getElementByAriaLabel("Inspector");
      const button = getButtonByText(inspector, "Create stable reference");
      const ready =
        includesText(inspector, "Stable topology reference") &&
        includesText(
          inspector,
          "Creates a saved topology reference for this selected entity."
        ) &&
        button &&
        !button.disabled;

      if (!ready) {
        throw new Error(compactText(inspector.textContent, 520));
      }

      return true;
    }, "V13 explicit stable-reference action available");
    clickButton(getElementByAriaLabel("Inspector"), "Create stable reference");
    await waitFor(() => {
      const status = getElementByAriaLabel("Topology identity status");
      const ready =
        includesText(document.body, "Created stable topology reference.") &&
        includesText(status, "4 anchors");

      if (!ready) {
        throw new Error(
          [
            `status=${compactText(status.textContent, 420)}`,
            `page=${compactText(document.body.textContent, 420)}`
          ].join("; ")
        );
      }

      return true;
    }, "V13 explicit stable-reference action committed");
    pass(
      "v13-explicit-stable-reference-action",
      "Inspector creates a stable topology reference only after an explicit user action",
      selectedLabel
    );

    await waitFor(() => {
      const inspector = getElementByAriaLabel("Inspector");
      const button = getButtonByText(inspector, "Repair stable reference");
      const ready =
        includesText(inspector, "Stable reference active") &&
        button &&
        !button.disabled;

      if (!ready) {
        throw new Error(compactText(inspector.textContent, 520));
      }

      return true;
    }, "V13 stable topology repair action available");
    clickButton(getElementByAriaLabel("Inspector"), "Check repair candidates");
    await waitFor(() => {
      const inspector = getElementByAriaLabel("Inspector");
      const preview = inspector.querySelector(".repair-candidate-preview");
      const previewText = preview ? getRenderedText(preview) : "";
      const normalizedPreviewText = normalize(previewText).toLowerCase();
      const privateLeak = findPrivateTopologyUiLeak(previewText);
      const button = getButtonByText(inspector, "Repair selected candidate");
      const ready =
        normalizedPreviewText.includes(
          normalize(
            "1 candidate · Ready · manual choice required"
          ).toLowerCase()
        ) &&
        normalizedPreviewText.includes(
          normalize(
            "Candidate 1: Face · Replaced · Exact confidence · Manual repair plan"
          ).toLowerCase()
        ) &&
        button &&
        !button.disabled &&
        !includesText(document.body, "Repaired stable topology reference.") &&
        !privateLeak;

      if (!ready) {
        throw new Error(
          [
            `preview=${compactText(previewText, 420)}`,
            privateLeak,
            `page=${compactText(document.body.textContent, 420)}`
          ]
            .filter(Boolean)
            .join("; ")
        );
      }

      return true;
    }, "V13 stable topology repair candidate preview available");
    pass(
      "v13-stable-reference-repair-candidate-preview",
      "Inspector previews manual stable topology repair candidates without committing or leaking private topology ids",
      getRenderedText(getElementByAriaLabel("Inspector"))
    );
    clickButton(
      getElementByAriaLabel("Inspector"),
      "Repair selected candidate"
    );
    await waitFor(() => {
      const status = getElementByAriaLabel("Topology identity status");
      const ready =
        includesText(document.body, "Repaired stable topology reference.") &&
        includesText(status, "4 checkpoints") &&
        includesText(status, "4 anchors");

      if (!ready) {
        throw new Error(
          [
            `status=${compactText(status.textContent, 420)}`,
            `page=${compactText(document.body.textContent, 420)}`
          ].join("; ")
        );
      }

      return true;
    }, "V13 stable topology repair action committed");
    pass(
      "v13-stable-reference-repair-action",
      "Inspector repairs a stable topology reference through a cad-core plan and explicit CADOps commit",
      getRenderedText(getElementByAriaLabel("Topology identity status"))
    );

    openDetailsBySummary(document.body, "Project/File");
    const projectPanelForSave = getSectionByAriaLabel("Project");
    await waitFor(() => {
      const status = getElementByAriaLabel("Topology identity status");

      if (
        !includesText(status, "4 checkpoints") ||
        !includesText(status, "4 anchors")
      ) {
        throw new Error(compactText(status.textContent, 420));
      }

      return true;
    }, "V13 topology identity status reflects explicit anchor creation");

    const explicitDownloadCapture = createDownloadCapture();
    explicitDownloadCapture.install();

    try {
      clickButton(projectPanelForSave, "Save As");
      await waitFor(
        () => {
          if (explicitDownloadCapture.blobs.length === 0) {
            throw new Error(
              "No V13 explicit stable-reference .wcad blob download was captured."
            );
          }

          if (!includesText(projectPanelForSave, "Downloaded .wcad package")) {
            throw new Error(compactText(projectPanelForSave.textContent, 520));
          }

          return true;
        },
        "downloaded V13 explicit stable-reference .wcad package through fallback Save As",
        Math.max(timeoutMs, 60_000)
      );
      const explicitWcadBytes = await explicitDownloadCapture.readFirstBytes();
      const explicitWcadText = decodeBytesForSearch(explicitWcadBytes);
      const ready =
        explicitWcadText.includes('"packageVersion": "partbench.wcad.v2"') &&
        explicitWcadText.includes(ids.v13ExplicitStableFaceId) &&
        explicitWcadText.includes(
          "checkpoints/v13_checkpoint_repair_body.brep"
        ) &&
        explicitWcadText.includes(
          "checkpoints/v13_checkpoint_repair_body.topology.cbor"
        ) &&
        explicitWcadText.includes(
          "checkpoints/v13_checkpoint_repair_body.signature.cbor"
        ) &&
        explicitWcadText.includes("CASCADE Topology");

      if (ready) {
        pass(
          "v13-explicit-stable-reference-wcad",
          "Explicitly created stable topology references persist through Save As .wcad",
          `${explicitWcadBytes.byteLength} bytes`
        );
      } else {
        fail(
          "v13-explicit-stable-reference-wcad",
          "Explicitly created stable topology references persist through Save As .wcad",
          compactText(explicitWcadText, 520)
        );
      }
    } catch (error) {
      fail(
        "v13-explicit-stable-reference-wcad",
        "Explicitly created stable topology references persist through Save As .wcad",
        [
          error instanceof Error ? error.message : String(error),
          compactText(projectPanelForSave.textContent, 520)
        ].join("; ")
      );
    } finally {
      explicitDownloadCapture.restore();
    }
  }

  async function runV10EditRepairWorkflowSmoke() {
    await createV10RectangleNewBody({
      bodyId: ids.v10StaleBodyId,
      bodyName: ids.v10StaleBodyName,
      centerX: "5",
      entityId: ids.v10StaleEntityId,
      featureId: ids.v10StaleFeatureId
    });
    await createV10RectangleNewBody({
      bodyId: ids.v10RepairBodyId,
      bodyName: ids.v10RepairBodyName,
      centerX: "7",
      entityId: ids.v10RepairEntityId,
      featureId: ids.v10RepairFeatureId
    });

    openTreePanel();
    clickButtonContaining(
      getElementByAriaLabel("Model structure"),
      ids.v10StaleBodyName
    );
    openSelectionPanel();
    await waitForBodyCommandReady(
      ids.v10StaleBodyId,
      "selected V10 stale-source body before naming"
    );
    const staleFaceLabel = selectFirstGeneratedFaceFromInspector(
      ids.v10StaleBodyId
    );
    await waitForGeneratedReferenceCommandReady(
      ids.v10StaleBodyId,
      "V10 stale-source generated face command-ready before naming"
    );
    const staleInspector = getElementByAriaLabel("Inspector");
    setFieldByLabel(
      staleInspector,
      "Name this reference",
      ids.v10RepairReferenceName
    );
    clickButton(staleInspector, "Save name");
    await waitFor(
      () =>
        includesText(
          getElementByAriaLabel("Inspector"),
          "Names for this reference"
        ) &&
        includesText(
          getElementByAriaLabel("Inspector"),
          ids.v10RepairReferenceName
        ),
      "named V10 stale-source generated face"
    );

    openTreePanel();
    clickButtonContaining(
      getElementByAriaLabel("Model structure"),
      ids.v10StaleBodyName
    );
    openSelectionPanel();
    await waitForBodyCommandReady(
      ids.v10StaleBodyId,
      "selected V10 stale-source body before supported edit"
    );
    const editInspector = getElementByAriaLabel("Inspector");
    setFieldByLabel(editInspector, "Depth (mm)", "1.25");
    clickButton(editInspector, "Apply extrude");
    await waitFor(() => {
      const currentInspector = getElementByAriaLabel("Inspector");
      const depthControl = getControlByLabel(currentInspector, "Depth (mm)");
      const ready =
        depthControl instanceof HTMLInputElement &&
        depthControl.value === "1.25" &&
        includesText(currentInspector, "Ready reference") &&
        includesText(currentInspector, "1.25 mm");

      if (!ready) {
        throw new Error(compactText(currentInspector.textContent, 520));
      }

      return true;
    }, "V10 extra supported extrude edit committed and rebuilt");
    pass(
      "v10-feature-edit-commit",
      "supported extrude depth edit commits through the browser workflow and rebuilds source state",
      getSelectionText()
    );

    openTreePanel();
    const editedReferenceButton = getButtonContaining(
      getElementByAriaLabel("Model structure"),
      ids.v10RepairReferenceName
    );
    if (!editedReferenceButton) {
      fail(
        "v10-reference-health-after-edit",
        "named reference remains routable after supported feature edit",
        "Named reference button was not found after V10 edit."
      );
    } else {
      editedReferenceButton.click();
      await waitFor(
        () => isTreePanelOpen(),
        "V10 edited named reference selection keeps preferred tree tab"
      );
      openSelectionPanel();
      await waitForGeneratedReferenceCommandReady(
        ids.v10StaleBodyId,
        "V10 edited named reference remains command-ready"
      );
      pass(
        "v10-reference-health-after-edit",
        "named reference remains active and command-ready after supported feature edit",
        staleFaceLabel
      );
    }

    openTreePanel();
    clickButtonContaining(
      getElementByAriaLabel("Model structure"),
      ids.v10StaleBodyName
    );
    openSelectionPanel();
    await waitForBodyCommandReady(
      ids.v10StaleBodyId,
      "selected V10 stale-source body before feature delete"
    );
    const deleteInspector = getElementByAriaLabel("Inspector");
    clickButton(deleteInspector, "Delete feature");
    await waitFor(
      () =>
        Boolean(
          getButtonByText(
            getElementByAriaLabel("Inspector"),
            "Confirm delete feature"
          )
        ),
      "armed V10 source feature delete confirmation"
    );
    clickButton(getElementByAriaLabel("Inspector"), "Confirm delete feature");
    await waitFor(() => {
      const structure = getElementByAriaLabel("Model structure");
      const ready =
        !includesText(structure, ids.v10StaleBodyName) &&
        includesText(structure, ids.v10RepairReferenceName);

      if (!ready) {
        throw new Error(compactText(structure.textContent, 520));
      }

      return true;
    }, "V10 named reference became stale after deleting its source feature");

    openTreePanel();
    clickButtonContaining(
      getElementByAriaLabel("Model structure"),
      ids.v10RepairBodyName
    );
    openSelectionPanel();
    await waitForBodyCommandReady(
      ids.v10RepairBodyId,
      "selected V10 repair replacement body"
    );
    const replacementLabel = selectFirstGeneratedFaceFromInspector(
      ids.v10RepairBodyId
    );
    await waitForGeneratedReferenceCommandReady(
      ids.v10RepairBodyId,
      "V10 replacement generated face command-ready before repair"
    );
    await waitFor(() => {
      const currentInspector = getElementByAriaLabel("Inspector");
      const currentModeling = getSectionByAriaLabel("Modeling context");
      const ready =
        includesText(
          currentInspector,
          `Repair ${ids.v10RepairReferenceName}`
        ) &&
        includesText(currentInspector, "Repair name") &&
        includesText(currentModeling, `Repair ${ids.v10RepairReferenceName}`) &&
        includesText(currentModeling, "Repair name");

      if (!ready) {
        throw new Error(
          [
            `inspector=${compactText(currentInspector.textContent, 300)}`,
            `modeling=${compactText(currentModeling.textContent, 300)}`
          ].join("; ")
        );
      }

      return true;
    }, "V10 named reference repair affordance for replacement face");
    clickButton(getElementByAriaLabel("Inspector"), "Repair name");
    await waitFor(() => {
      const currentInspector = getElementByAriaLabel("Inspector");
      const ready =
        includesText(currentInspector, "Names for this reference") &&
        includesText(currentInspector, ids.v10RepairReferenceName) &&
        !includesText(currentInspector, `Repair ${ids.v10RepairReferenceName}`);

      if (!ready) {
        throw new Error(compactText(currentInspector.textContent, 420));
      }

      return true;
    }, "V10 named reference repaired to active generated face");
    pass(
      "v10-named-reference-repair-browser",
      "stale named reference is repaired through the browser workflow",
      replacementLabel
    );
  }

  async function runV10C2InspectorFeatureEditSmoke(projectJson) {
    if (!projectJson) {
      fail(
        "v10-c2-inspector-feature-edits",
        "revolve, hole, chamfer, and fillet feature edits commit through Inspector controls",
        "V10 C2 release sample project JSON was not available."
      );
      return;
    }

    openDetailsBySummary(document.body, "Project/File");
    let projectPanel = getSectionByAriaLabel("Project");
    loadProjectJsonFileIntoInput(
      projectPanel,
      projectJson,
      "v10-c2-browser-fixture.json"
    );
    await waitFor(
      () =>
        includesText(
          getSectionByAriaLabel("Project"),
          "Loaded v10-c2-browser-fixture.json"
        ) && includesText(getSectionByAriaLabel("Project"), "Ready to import"),
      "loaded V10 C2 browser fixture JSON"
    );
    projectPanel = getSectionByAriaLabel("Project");
    clickButton(projectPanel, "Import JSON");
    await waitFor(
      () =>
        includesText(
          getElementByAriaLabel("Model structure"),
          "V10 C2 revolve body"
        ) &&
        includesText(
          getElementByAriaLabel("Model structure"),
          "V10 C2 hole result"
        ) &&
        includesText(
          getElementByAriaLabel("Model structure"),
          "V10 C2 chamfer result"
        ) &&
        includesText(
          getElementByAriaLabel("Model structure"),
          "V10 C2 fillet result"
        ),
      "imported V10 C2 browser fixture"
    );

    await selectC2ImportedBody("V10 C2 hole result", "Hole feature");
    await waitFor(() => {
      const inspector = getElementByAriaLabel("Inspector");
      const modeling = getSectionByAriaLabel("Modeling context");
      const ready =
        includesText(inspector, "Generated references") &&
        includesText(inspector, "Hole wall face") &&
        includesText(inspector, "Hole start rim edge") &&
        includesText(inspector, "Hole axis") &&
        !includesText(
          modeling,
          "Generated references are unavailable for the selected body"
        );

      if (!ready) {
        throw new Error(
          [
            `inspector=${compactText(inspector.textContent, 360)}`,
            `modeling=${compactText(modeling.textContent, 240)}`
          ].join("; ")
        );
      }

      return true;
    }, "V10 C2 non-extrude generated references in Inspector");
    pass(
      "v10-non-extrude-generated-reference-routing",
      "hole generated references route from cad-core into Inspector and Modeling surfaces",
      compactText(getElementByAriaLabel("Inspector").textContent, 280)
    );

    await selectC2ImportedBody("V10 C2 revolve body", "Revolve feature");
    await waitForEditorControlEnabled("Revolve feature", "Angle (deg)");
    const revolveEditor = getInspectorCommandCardByHeading("Revolve feature");
    setFieldByLabel(revolveEditor, "Angle (deg)", "180");
    await clickEnabledButtonInScope(revolveEditor, "Apply revolve");
    await waitFor(() => {
      const editor = getInspectorCommandCardByHeading("Revolve feature");
      const control = getControlByLabel(editor, "Angle (deg)");
      const ready =
        control instanceof HTMLInputElement &&
        !control.disabled &&
        control.value === "180" &&
        includesText(getElementByAriaLabel("Inspector"), "180 deg");

      if (!ready) {
        throw new Error(compactText(editor.textContent, 420));
      }

      return true;
    }, "V10 C2 revolve Inspector edit committed");

    await selectC2ImportedBody("V10 C2 hole result", "Hole feature");
    await waitForEditorControlEnabled("Hole feature", "Depth mode");
    await waitForEditorControlEnabled("Hole feature", "Direction");
    const holeEditor = getInspectorCommandCardByHeading("Hole feature");
    setSelectByLabel(holeEditor, "Depth mode", "throughAll");
    setSelectByLabel(holeEditor, "Direction", "positive");
    await clickEnabledButtonInScope(holeEditor, "Apply hole");
    await waitFor(() => {
      const editor = getInspectorCommandCardByHeading("Hole feature");
      const depthMode = getControlByLabel(editor, "Depth mode");
      const direction = getControlByLabel(editor, "Direction");
      const ready =
        depthMode instanceof HTMLSelectElement &&
        direction instanceof HTMLSelectElement &&
        !depthMode.disabled &&
        !direction.disabled &&
        depthMode.value === "throughAll" &&
        direction.value === "positive" &&
        includesText(getElementByAriaLabel("Inspector"), "Through all");

      if (!ready) {
        throw new Error(compactText(editor.textContent, 420));
      }

      return true;
    }, "V10 C2 hole Inspector edit committed");

    await selectC2ImportedBody("V10 C2 chamfer result", "Chamfer feature");
    await waitForEditorControlEnabled("Chamfer feature", "Distance (mm)");
    const chamferEditor = getInspectorCommandCardByHeading("Chamfer feature");
    setFieldByLabel(chamferEditor, "Distance (mm)", "0.55");
    await clickEnabledButtonInScope(chamferEditor, "Apply chamfer");
    await waitFor(() => {
      const editor = getInspectorCommandCardByHeading("Chamfer feature");
      const control = getControlByLabel(editor, "Distance (mm)");
      const ready =
        control instanceof HTMLInputElement &&
        !control.disabled &&
        control.value === "0.55" &&
        includesText(getElementByAriaLabel("Inspector"), "0.55 mm");

      if (!ready) {
        throw new Error(compactText(editor.textContent, 420));
      }

      return true;
    }, "V10 C2 chamfer Inspector edit committed");

    await selectC2ImportedBody("V10 C2 fillet result", "Fillet feature");
    await waitForEditorControlEnabled("Fillet feature", "Radius (mm)");
    const filletEditor = getInspectorCommandCardByHeading("Fillet feature");
    setFieldByLabel(filletEditor, "Radius (mm)", "0.5");
    await clickEnabledButtonInScope(filletEditor, "Apply fillet");
    await waitFor(() => {
      const editor = getInspectorCommandCardByHeading("Fillet feature");
      const control = getControlByLabel(editor, "Radius (mm)");
      const ready =
        control instanceof HTMLInputElement &&
        !control.disabled &&
        control.value === "0.5" &&
        includesText(getElementByAriaLabel("Inspector"), "0.5 mm");

      if (!ready) {
        throw new Error(compactText(editor.textContent, 420));
      }

      return true;
    }, "V10 C2 fillet Inspector edit committed");

    pass(
      "v10-c2-inspector-feature-edits",
      "revolve, hole, chamfer, and fillet feature edits commit through Inspector controls",
      compactText(getElementByAriaLabel("Model structure").textContent, 300)
    );
  }

  async function selectC2ImportedBody(bodyName, editorTitle) {
    openTreePanel();
    clickModelStoryBodyRowByTitle(bodyName);
    await waitFor(() => {
      const button = queryModelStoryBodyRowByTitle(bodyName);

      if (!button?.classList.contains("selected")) {
        throw new Error(`Body row ${bodyName} is not selected.`);
      }

      return true;
    }, `selected model story body row ${bodyName}`);
    openSelectionPanel();
    await waitFor(() => {
      getInspectorCommandCardByHeading(editorTitle);

      return true;
    }, `selected ${bodyName}`);
  }

  function clickModelStoryBodyRowByTitle(title) {
    const button = queryModelStoryBodyRowByTitle(title);

    if (!button) {
      throw new Error(`Could not find model story body row titled ${title}.`);
    }

    clickEnabledButton(button, title);
  }

  function queryModelStoryBodyRowByTitle(title) {
    const structure = getElementByAriaLabel("Model structure");
    return [...structure.querySelectorAll("button.model-story-row.body")].find(
      (candidate) =>
        normalize(
          candidate.querySelector(".model-story-title")?.textContent
        ) === title
    );
  }

  async function waitForEditorControlEnabled(editorTitle, label) {
    await waitFor(() => {
      const editor = getInspectorCommandCardByHeading(editorTitle);
      const control = getControlByLabel(editor, label);

      if (
        (control instanceof HTMLInputElement ||
          control instanceof HTMLSelectElement ||
          control instanceof HTMLTextAreaElement) &&
        control.disabled
      ) {
        throw new Error(
          `${editorTitle} ${label} is disabled. scope=${compactText(
            editor.textContent,
            360
          )}`
        );
      }

      return true;
    }, `${editorTitle} ${label} enabled`);
  }

  async function clickEnabledButtonInScope(scope, text) {
    await waitFor(() => {
      const button = getButtonByText(scope, text);

      if (!button || button.disabled) {
        throw new Error(
          `${text} is not enabled. scope=${compactText(scope.textContent, 420)}`
        );
      }

      return true;
    }, `${text} enabled`);
    clickButton(scope, text);
  }

  function getInspectorCommandCardByHeading(heading) {
    const inspector = getElementByAriaLabel("Inspector");
    const card = [...inspector.querySelectorAll(".command-card")].find(
      (candidate) => getCommandCardOwnHeading(candidate) === heading
    );

    if (!card) {
      throw new Error(`Could not find Inspector card ${heading}.`);
    }

    return card;
  }

  function getCommandCardOwnHeading(card) {
    const heading = [...card.children]
      .find((child) => child.classList.contains("command-card-heading"))
      ?.querySelector("h3");

    return heading ? normalize(heading.textContent) : undefined;
  }

  async function createV10RectangleNewBody({
    bodyId,
    bodyName,
    centerX,
    entityId,
    featureId
  }) {
    clickButtonContaining(getElementByAriaLabel("Tool tabs"), "Sketches");
    const sketches = getSectionByAriaLabel("Sketches");
    setSelectByLabel(sketches, "Active sketch", ids.sketchId);
    await waitFor(
      () => getControlByLabel(sketches, "Active sketch").value === ids.sketchId,
      `activated base sketch before creating ${bodyName}`
    );
    clickButton(getElementByAriaLabel("Add sketch entity"), "Rectangle");
    const entityEditor = await waitForSectionByAriaLabel(
      "Sketch entity editor",
      `${bodyName} rectangle entity editor`
    );
    setSelectByLabel(entityEditor, "Entity", "rectangle");
    setInputByDetailsSummary(entityEditor, "Optional ID", entityId);
    setFieldByLabel(entityEditor, "Center X", centerX);
    setFieldByLabel(entityEditor, "Center Y", "0");
    setFieldByLabel(entityEditor, "Width", "0.75");
    setFieldByLabel(entityEditor, "Height", "0.75");
    clickButton(entityEditor, "Add entity");
    await waitFor(
      () =>
        includesText(getElementByAriaLabel("Select sketch entity"), entityId),
      `created ${bodyName} source rectangle`
    );

    const featureEditor = getSectionByAriaLabel("Create authored feature");
    setFieldByLabel(featureEditor, "Depth", "1");
    setSelectByLabel(featureEditor, "Operation", "newBody");
    setFieldByLabel(featureEditor, "Optional feature ID", featureId);
    setFieldByLabel(featureEditor, "Optional body ID", bodyId);
    setFieldByLabel(featureEditor, "Optional name", bodyName);
    clickButton(featureEditor, "Create extrude");
    await waitFor(
      () => includesText(getElementByAriaLabel("Model structure"), bodyName),
      `created ${bodyName} extrude body`
    );
  }

  async function waitForBodyCommandReady(bodyId, label) {
    await waitFor(() => {
      const currentInspector = getElementByAriaLabel("Inspector");
      const currentModeling = getSectionByAriaLabel("Modeling context");
      const ready =
        isSelectionPanelOpen() &&
        includesText(currentInspector, bodyId) &&
        includesText(currentInspector, "Ready reference") &&
        includesText(currentModeling, "Reference status") &&
        includesText(currentModeling, "Ready reference");

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
        includesText(currentInspector, "Ready reference") &&
        includesText(currentModeling, "Reference status") &&
        includesText(currentModeling, "Ready reference") &&
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
        includesText(currentInspector, "Ready reference") &&
        includesText(currentModeling, "Reference status") &&
        includesText(currentModeling, "Ready reference") &&
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
      const consumedGuidance = "Selected body already has a downstream result.";
      const ready =
        isSelectionPanelOpen() &&
        includesText(inspector, "Selection body consumed") &&
        includesText(inspector, consumedGuidance) &&
        includesText(modelingContext, "Selection body consumed") &&
        includesText(modelingContext, consumedGuidance);

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

  async function runV12CutResultReferenceWorkflowSmoke() {
    const faceStableId = `generated:face:${ids.cutBodyId}:side:uMin`;
    const edgeStableId = `generated:edge:${ids.cutBodyId}:longitudinal:uMin:vMin`;

    openTreePanel();
    clickButtonContaining(
      getElementByAriaLabel("Model structure"),
      ids.cutBodyName
    );
    openSelectionPanel();

    await selectGeneratedReferenceByStableId(faceStableId);
    await waitForV12CutResultFaceCommandReady(faceStableId);
    pass(
      "v12-cut-result-face-command-ready-browser",
      "V12 cut-result face is command-ready in Selection and Modeling",
      getSelectionText()
    );

    await waitForViewportContextualCommands(
      ["Create sketch", "Name", "Measure", "Inspect"],
      "V12 cut-result face contextual commands"
    );
    pass(
      "v12-cut-result-face-contextual-actions",
      "V12 cut-result face exposes compact create-sketch/name/measure/inspect actions",
      getViewportContextualCommandText()
    );

    const inspector = getElementByAriaLabel("Inspector");
    setSelectByLabel(inspector, "Face", faceStableId);
    setFieldByLabel(inspector, "Sketch name", ids.v12CutWallSketchName);
    setInputByDetailsSummary(
      inspector,
      "Advanced sketch options",
      ids.v12CutWallSketchId
    );
    clickButton(inspector, "Create attached sketch");
    await waitFor(
      () =>
        includesText(
          getElementByAriaLabel("Model structure"),
          ids.v12CutWallSketchName
        ),
      "V12 cut-result face attached sketch"
    );
    pass(
      "v12-cut-result-face-attached-sketch",
      "V12 cut-result face creates an attached sketch through the browser UI",
      ids.v12CutWallSketchId
    );

    openTreePanel();
    clickButtonContaining(
      getElementByAriaLabel("Model structure"),
      ids.cutBodyName
    );
    openSelectionPanel();
    await selectGeneratedReferenceByStableId(edgeStableId);
    await waitForV12ResultEdgeCommandReady({
      bodyId: ids.cutBodyId,
      stableId: edgeStableId,
      label: "Cut wall profile edge uMin/vMin"
    });
    pass(
      "v12-cut-result-edge-command-ready-browser",
      "V12 cut-result edge is command-ready for naming, measurement, and inspect",
      getSelectionText()
    );

    await waitForViewportContextualCommands(
      ["Name", "Measure", "Inspect"],
      "V12 cut-result edge contextual commands"
    );
    assertViewportContextualCommandsAbsent(["Chamfer", "Fillet"]);
    pass(
      "v12-cut-result-edge-contextual-actions",
      "V12 cut-result edge exposes compact name/measure/inspect actions",
      getViewportContextualCommandText()
    );

    const selectionText = getSelectionText();
    const deferredVisible =
      selectionText.includes("Edge finish") ||
      selectionText.includes("Chamfer") ||
      selectionText.includes("Fillet");

    if (deferredVisible) {
      fail(
        "v12-cut-result-edge-no-deferred-finish",
        "V12 cut-result edge hides deferred edge-finish affordances",
        selectionText
      );
    } else {
      pass(
        "v12-cut-result-edge-no-deferred-finish",
        "V12 cut-result edge hides deferred edge-finish affordances",
        selectionText
      );
    }

    await runV12NamedReferenceRepairSmoke(faceStableId);
  }

  async function runV12NamedReferenceRepairSmoke(faceStableId) {
    await createV10RectangleNewBody({
      bodyId: ids.v12RepairStaleBodyId,
      bodyName: ids.v12RepairStaleBodyName,
      centerX: "9",
      entityId: ids.v12RepairStaleEntityId,
      featureId: ids.v12RepairStaleFeatureId
    });

    openTreePanel();
    clickButtonContaining(
      getElementByAriaLabel("Model structure"),
      ids.v12RepairStaleBodyName
    );
    openSelectionPanel();
    await waitForBodyCommandReady(
      ids.v12RepairStaleBodyId,
      "selected V12 stale repair-source body before naming"
    );
    selectFirstGeneratedFaceFromInspector(ids.v12RepairStaleBodyId);
    await waitForGeneratedReferenceCommandReady(
      ids.v12RepairStaleBodyId,
      "V12 stale repair-source generated face command-ready before naming"
    );
    const staleInspector = getElementByAriaLabel("Inspector");
    setFieldByLabel(
      staleInspector,
      "Name this reference",
      ids.v12RepairReferenceName
    );
    clickButton(staleInspector, "Save name");
    await waitFor(
      () =>
        includesText(
          getElementByAriaLabel("Inspector"),
          "Names for this reference"
        ) &&
        includesText(
          getElementByAriaLabel("Inspector"),
          ids.v12RepairReferenceName
        ),
      "named V12 stale-source generated face"
    );

    openTreePanel();
    clickButtonContaining(
      getElementByAriaLabel("Model structure"),
      ids.v12RepairStaleBodyName
    );
    openSelectionPanel();
    await waitForBodyCommandReady(
      ids.v12RepairStaleBodyId,
      "selected V12 stale repair-source body before feature delete"
    );
    const deleteInspector = getElementByAriaLabel("Inspector");
    clickButton(deleteInspector, "Delete feature");
    await waitFor(
      () =>
        Boolean(
          getButtonByText(
            getElementByAriaLabel("Inspector"),
            "Confirm delete feature"
          )
        ),
      "armed V12 stale repair-source feature delete confirmation"
    );
    clickButton(getElementByAriaLabel("Inspector"), "Confirm delete feature");
    await waitFor(() => {
      const structure = getElementByAriaLabel("Model structure");
      const ready =
        !includesText(structure, ids.v12RepairStaleBodyName) &&
        includesText(structure, ids.v12RepairReferenceName);

      if (!ready) {
        throw new Error(compactText(structure.textContent, 520));
      }

      return true;
    }, "V12 named reference became missing after deleting its source feature");

    openTreePanel();
    clickButtonContaining(
      getElementByAriaLabel("Model structure"),
      ids.cutBodyName
    );
    openSelectionPanel();
    await selectGeneratedReferenceByStableId(faceStableId);
    await waitForV12CutResultFaceCommandReady(faceStableId);
    openTreePanel();
    clickButtonContaining(
      getElementByAriaLabel("Model structure"),
      ids.v12RepairReferenceName
    );
    await waitFor(
      () => isTreePanelOpen(),
      "V12 missing named reference selection keeps preferred tree tab"
    );
    openSelectionPanel();
    await waitFor(() => {
      const currentInspector = getElementByAriaLabel("Inspector");
      const currentModeling = getSectionByAriaLabel("Modeling context");
      const ready =
        includesText(
          currentInspector,
          `Repair ${ids.v12RepairReferenceName}`
        ) &&
        includesText(currentInspector, "Repair name") &&
        includesText(currentModeling, `Repair ${ids.v12RepairReferenceName}`) &&
        includesText(currentModeling, "Repair name");

      if (!ready) {
        throw new Error(
          [
            `inspector=${compactText(currentInspector.textContent, 360)}`,
            `modeling=${compactText(currentModeling.textContent, 300)}`
          ].join("; ")
        );
      }

      return true;
    }, "V12 named reference repair affordance for cut-result face");
    clickButton(getElementByAriaLabel("Inspector"), "Repair name");
    await waitFor(() => {
      const currentInspector = getElementByAriaLabel("Inspector");
      const ready =
        includesText(currentInspector, "Names for this reference") &&
        includesText(currentInspector, ids.v12RepairReferenceName) &&
        !includesText(currentInspector, `Repair ${ids.v12RepairReferenceName}`);

      if (!ready) {
        throw new Error(compactText(currentInspector.textContent, 520));
      }

      return true;
    }, "V12 named reference repaired to active cut-result face");
    pass(
      "v12-named-reference-repair-browser",
      "missing named reference is repaired to a command-ready V12 cut-result face",
      getSelectionText()
    );
  }

  async function runV12AddResultReferenceWorkflowSmoke() {
    await createV10RectangleNewBody({
      bodyId: ids.v12AddTargetBodyId,
      bodyName: ids.v12AddTargetBodyName,
      centerX: "-3",
      entityId: ids.v12AddTargetEntityId,
      featureId: ids.v12AddTargetFeatureId
    });

    openTreePanel();
    clickButtonContaining(
      getElementByAriaLabel("Model structure"),
      ids.v12AddTargetBodyName
    );
    openSelectionPanel();
    await selectGeneratedReferenceByStableId(
      `generated:face:${ids.v12AddTargetBodyId}:endCap`
    );

    const targetInspector = getElementByAriaLabel("Inspector");
    setSelectByLabel(
      targetInspector,
      "Face",
      `generated:face:${ids.v12AddTargetBodyId}:endCap`
    );
    setFieldByLabel(targetInspector, "Sketch name", ids.v12AddToolSketchName);
    setInputByDetailsSummary(
      targetInspector,
      "Advanced sketch options",
      ids.v12AddToolSketchId
    );
    clickButton(targetInspector, "Create attached sketch");
    await waitFor(
      () =>
        includesText(
          getElementByAriaLabel("Model structure"),
          ids.v12AddToolSketchName
        ),
      "V12 add target attached tool sketch"
    );

    clickButtonContaining(getElementByAriaLabel("Tool tabs"), "Sketches");
    const sketches = getSectionByAriaLabel("Sketches");
    setSelectByLabel(sketches, "Active sketch", ids.v12AddToolSketchId);
    await waitFor(
      () =>
        getControlByLabel(getSectionByAriaLabel("Sketches"), "Active sketch")
          .value === ids.v12AddToolSketchId,
      "V12 add tool sketch became active"
    );
    clickButton(getElementByAriaLabel("Add sketch entity"), "Rectangle");
    const entityEditor = await waitForSectionByAriaLabel(
      "Sketch entity editor",
      "V12 add tool rectangle entity editor"
    );
    setSelectByLabel(entityEditor, "Entity", "rectangle");
    setInputByDetailsSummary(
      entityEditor,
      "Optional ID",
      ids.v12AddToolEntityId
    );
    setFieldByLabel(entityEditor, "Width", "0.5");
    setFieldByLabel(entityEditor, "Height", "0.5");
    clickButton(entityEditor, "Add entity");
    await waitFor(
      () =>
        includesText(
          getElementByAriaLabel("Select sketch entity"),
          ids.v12AddToolEntityId
        ),
      "created V12 add tool rectangle"
    );

    let featureEditor = getSectionByAriaLabel("Create authored feature");
    setFieldByLabel(featureEditor, "Depth", "0.5");
    setSelectByLabel(featureEditor, "Operation", "add");
    await waitFor(
      () =>
        Boolean(
          queryControlByLabel(
            getSectionByAriaLabel("Create authored feature"),
            "Target body"
          )
        ),
      "add target body control"
    );
    featureEditor = getSectionByAriaLabel("Create authored feature");
    setSelectByLabel(featureEditor, "Target body", ids.v12AddTargetBodyId);
    setFieldByLabel(featureEditor, "Optional feature ID", ids.v12AddFeatureId);
    setFieldByLabel(featureEditor, "Optional body ID", ids.v12AddBodyId);
    setFieldByLabel(featureEditor, "Optional name", ids.v12AddBodyName);
    clickButton(featureEditor, "Create extrude");
    await waitFor(
      () =>
        includesText(
          getElementByAriaLabel("Model structure"),
          ids.v12AddBodyName
        ),
      "created V12 add result body"
    );
    pass(
      "v12-add-result-create",
      "created a deterministic add result for V12 browser reference checks",
      ids.v12AddBodyId
    );

    const capStableId = `generated:face:${ids.v12AddBodyId}:endCap`;
    const wallStableId = `generated:face:${ids.v12AddBodyId}:side:uMin`;
    const edgeStableId = `generated:edge:${ids.v12AddBodyId}:end:uMin`;

    openTreePanel();
    clickButtonContaining(
      getElementByAriaLabel("Model structure"),
      ids.v12AddBodyName
    );
    openSelectionPanel();
    await selectGeneratedReferenceByStableId(capStableId);
    await waitForV12AddResultFaceCommandReady({
      stableId: capStableId,
      label: "Added cap face"
    });
    pass(
      "v12-add-result-cap-command-ready-browser",
      "V12 add-result cap face is command-ready in Selection and Modeling",
      getSelectionText()
    );

    await waitForViewportContextualCommands(
      ["Create sketch", "Name", "Measure", "Inspect"],
      "V12 add-result cap contextual commands"
    );
    assertViewportContextualCommandsAbsent(["Chamfer", "Fillet"]);
    pass(
      "v12-add-result-cap-contextual-actions",
      "V12 add-result cap face exposes compact create-sketch/name/measure/inspect actions",
      getViewportContextualCommandText()
    );

    const addInspector = getElementByAriaLabel("Inspector");
    setSelectByLabel(addInspector, "Face", capStableId);
    setFieldByLabel(addInspector, "Sketch name", ids.v12AddCapSketchName);
    setInputByDetailsSummary(
      addInspector,
      "Advanced sketch options",
      ids.v12AddCapSketchId
    );
    clickButton(addInspector, "Create attached sketch");
    await waitFor(
      () =>
        includesText(
          getElementByAriaLabel("Model structure"),
          ids.v12AddCapSketchName
        ),
      "V12 add-result cap attached sketch"
    );
    pass(
      "v12-add-result-cap-attached-sketch",
      "V12 add-result cap face creates an attached sketch through the browser UI",
      ids.v12AddCapSketchId
    );

    openTreePanel();
    clickButtonContaining(
      getElementByAriaLabel("Model structure"),
      ids.v12AddBodyName
    );
    openSelectionPanel();
    await selectGeneratedReferenceByStableId(wallStableId);
    await waitForV12AddResultFaceCommandReady({
      stableId: wallStableId,
      label: "Added wall face uMin"
    });
    pass(
      "v12-add-result-wall-command-ready-browser",
      "V12 add-result wall face is command-ready in Selection and Modeling",
      getSelectionText()
    );

    await waitForViewportContextualCommands(
      ["Create sketch", "Name", "Measure", "Inspect"],
      "V12 add-result wall contextual commands"
    );
    assertViewportContextualCommandsAbsent(["Chamfer", "Fillet"]);
    pass(
      "v12-add-result-wall-contextual-actions",
      "V12 add-result wall face exposes compact create-sketch/name/measure/inspect actions",
      getViewportContextualCommandText()
    );

    openTreePanel();
    clickButtonContaining(
      getElementByAriaLabel("Model structure"),
      ids.v12AddBodyName
    );
    openSelectionPanel();
    await selectGeneratedReferenceByStableId(edgeStableId);
    await waitForV12ResultEdgeCommandReady({
      bodyId: ids.v12AddBodyId,
      stableId: edgeStableId,
      label: "Added cap profile edge uMin"
    });
    pass(
      "v12-add-result-edge-command-ready-browser",
      "V12 add-result cap edge is command-ready for naming, measurement, and inspect",
      getSelectionText()
    );

    await waitForViewportContextualCommands(
      ["Name", "Measure", "Inspect"],
      "V12 add-result edge contextual commands"
    );
    assertViewportContextualCommandsAbsent(["Chamfer", "Fillet"]);
    pass(
      "v12-add-result-edge-contextual-actions",
      "V12 add-result cap edge exposes compact name/measure/inspect actions",
      getViewportContextualCommandText()
    );

    const selectionText = getSelectionText();
    const deferredVisible =
      selectionText.includes("Edge finish") ||
      selectionText.includes("Chamfer") ||
      selectionText.includes("Fillet");

    if (deferredVisible) {
      fail(
        "v12-add-result-edge-no-deferred-finish",
        "V12 add-result cap edge hides deferred edge-finish affordances",
        selectionText
      );
    } else {
      pass(
        "v12-add-result-edge-no-deferred-finish",
        "V12 add-result cap edge hides deferred edge-finish affordances",
        selectionText
      );
    }

    await runV12AddResultEdgeRepairSmoke(edgeStableId);
  }

  async function runV12AddResultEdgeRepairSmoke(edgeStableId) {
    const staleEdgeStableId = `generated:edge:${ids.v12AddRepairStaleBodyId}:start:uMin`;

    await createV10RectangleNewBody({
      bodyId: ids.v12AddRepairStaleBodyId,
      bodyName: ids.v12AddRepairStaleBodyName,
      centerX: "-6",
      entityId: ids.v12AddRepairStaleEntityId,
      featureId: ids.v12AddRepairStaleFeatureId
    });

    openTreePanel();
    clickButtonContaining(
      getElementByAriaLabel("Model structure"),
      ids.v12AddRepairStaleBodyName
    );
    openSelectionPanel();
    await selectGeneratedReferenceByStableId(staleEdgeStableId);
    await waitFor(() => {
      const inspector = getElementByAriaLabel("Inspector");
      const ready =
        includesText(inspector, ids.v12AddRepairStaleBodyId) &&
        includesText(inspector, staleEdgeStableId) &&
        includesText(inspector, "Ready reference") &&
        includesText(inspector, "Name reference");

      if (!ready) {
        throw new Error(compactText(inspector.textContent, 420));
      }

      return true;
    }, "V12 stale add-edge source selected before naming");

    const staleInspector = getElementByAriaLabel("Inspector");
    setFieldByLabel(
      staleInspector,
      "Name this reference",
      ids.v12AddRepairReferenceName
    );
    clickButton(staleInspector, "Save name");
    await waitFor(
      () =>
        includesText(
          getElementByAriaLabel("Inspector"),
          ids.v12AddRepairReferenceName
        ) &&
        includesText(
          getElementByAriaLabel("Inspector"),
          "Names for this reference"
        ),
      "named V12 stale add-edge source"
    );

    openTreePanel();
    clickButtonContaining(
      getElementByAriaLabel("Model structure"),
      ids.v12AddRepairStaleBodyName
    );
    openSelectionPanel();
    await waitForBodyCommandReady(
      ids.v12AddRepairStaleBodyId,
      "selected V12 stale add-edge repair source before feature delete"
    );
    const deleteInspector = getElementByAriaLabel("Inspector");
    clickButton(deleteInspector, "Delete feature");
    await waitFor(
      () =>
        Boolean(
          getButtonByText(
            getElementByAriaLabel("Inspector"),
            "Confirm delete feature"
          )
        ),
      "armed V12 stale add-edge source feature delete confirmation"
    );
    clickButton(getElementByAriaLabel("Inspector"), "Confirm delete feature");
    await waitFor(() => {
      const structure = getElementByAriaLabel("Model structure");
      const ready =
        !includesText(structure, ids.v12AddRepairStaleBodyName) &&
        includesText(structure, ids.v12AddRepairReferenceName);

      if (!ready) {
        throw new Error(compactText(structure.textContent, 520));
      }

      return true;
    }, "V12 add-edge named reference became missing after deleting source");

    openTreePanel();
    clickButtonContaining(
      getElementByAriaLabel("Model structure"),
      ids.v12AddBodyName
    );
    openSelectionPanel();
    await selectGeneratedReferenceByStableId(edgeStableId);
    await waitForV12ResultEdgeCommandReady({
      bodyId: ids.v12AddBodyId,
      stableId: edgeStableId,
      label: "Added cap profile edge uMin"
    });
    openTreePanel();
    clickButtonContaining(
      getElementByAriaLabel("Model structure"),
      ids.v12AddRepairReferenceName
    );
    await waitFor(
      () => isTreePanelOpen(),
      "V12 add-edge missing named reference selection keeps preferred tree tab"
    );
    openSelectionPanel();
    await waitFor(() => {
      const currentInspector = getElementByAriaLabel("Inspector");
      const currentModeling = getSectionByAriaLabel("Modeling context");
      const ready =
        includesText(
          currentInspector,
          `Repair ${ids.v12AddRepairReferenceName}`
        ) &&
        includesText(currentInspector, "Repair name") &&
        includesText(
          currentModeling,
          `Repair ${ids.v12AddRepairReferenceName}`
        ) &&
        includesText(currentModeling, "Repair name");

      if (!ready) {
        throw new Error(
          [
            `inspector=${compactText(currentInspector.textContent, 360)}`,
            `modeling=${compactText(currentModeling.textContent, 300)}`
          ].join("; ")
        );
      }

      return true;
    }, "V12 named reference repair affordance for add-result edge");
    clickButton(getElementByAriaLabel("Inspector"), "Repair name");
    await waitFor(() => {
      const currentInspector = getElementByAriaLabel("Inspector");
      const ready =
        includesText(currentInspector, "Names for this reference") &&
        includesText(currentInspector, ids.v12AddRepairReferenceName) &&
        !includesText(
          currentInspector,
          `Repair ${ids.v12AddRepairReferenceName}`
        );

      if (!ready) {
        throw new Error(compactText(currentInspector.textContent, 520));
      }

      return true;
    }, "V12 named reference repaired to active add-result edge");
    pass(
      "v12-add-result-edge-repair-browser",
      "missing named reference is repaired to a command-ready V12 add-result edge",
      getSelectionText()
    );
  }

  async function runV12CircleCutResultReferenceWorkflowSmoke() {
    await createV10RectangleNewBody({
      bodyId: ids.v12CircleCutTargetBodyId,
      bodyName: ids.v12CircleCutTargetBodyName,
      centerX: "-12",
      entityId: ids.v12CircleCutTargetEntityId,
      featureId: ids.v12CircleCutTargetFeatureId
    });

    openTreePanel();
    clickButtonContaining(
      getElementByAriaLabel("Model structure"),
      ids.v12CircleCutTargetBodyName
    );
    openSelectionPanel();
    await selectGeneratedReferenceByStableId(
      `generated:face:${ids.v12CircleCutTargetBodyId}:endCap`
    );

    const targetInspector = getElementByAriaLabel("Inspector");
    setSelectByLabel(
      targetInspector,
      "Face",
      `generated:face:${ids.v12CircleCutTargetBodyId}:endCap`
    );
    setFieldByLabel(
      targetInspector,
      "Sketch name",
      ids.v12CircleCutToolSketchName
    );
    setInputByDetailsSummary(
      targetInspector,
      "Advanced sketch options",
      ids.v12CircleCutToolSketchId
    );
    clickButton(targetInspector, "Create attached sketch");
    await waitFor(
      () =>
        includesText(
          getElementByAriaLabel("Model structure"),
          ids.v12CircleCutToolSketchName
        ),
      "V12 circle cut target attached tool sketch"
    );

    clickButtonContaining(getElementByAriaLabel("Tool tabs"), "Sketches");
    const sketches = getSectionByAriaLabel("Sketches");
    setSelectByLabel(sketches, "Active sketch", ids.v12CircleCutToolSketchId);
    await waitFor(
      () =>
        getControlByLabel(getSectionByAriaLabel("Sketches"), "Active sketch")
          .value === ids.v12CircleCutToolSketchId,
      "V12 circle cut tool sketch became active"
    );
    clickButton(getElementByAriaLabel("Add sketch entity"), "Circle");
    const entityEditor = await waitForSectionByAriaLabel(
      "Sketch entity editor",
      "V12 circle cut tool circle entity editor"
    );
    setSelectByLabel(entityEditor, "Entity", "circle");
    setInputByDetailsSummary(
      entityEditor,
      "Optional ID",
      ids.v12CircleCutToolEntityId
    );
    setFieldByLabel(entityEditor, "Center X", "0");
    setFieldByLabel(entityEditor, "Center Y", "0");
    setFieldByLabel(entityEditor, "Radius", "0.35");
    clickButton(entityEditor, "Add entity");
    await waitFor(
      () =>
        includesText(
          getElementByAriaLabel("Select sketch entity"),
          ids.v12CircleCutToolEntityId
        ),
      "created V12 circle cut tool circle"
    );

    let featureEditor = getSectionByAriaLabel("Create authored feature");
    setFieldByLabel(featureEditor, "Depth", "0.5");
    setSelectByLabel(featureEditor, "Operation", "cut");
    setSelectByLabel(featureEditor, "Side", "negative");
    await waitFor(
      () =>
        Boolean(
          queryControlByLabel(
            getSectionByAriaLabel("Create authored feature"),
            "Target body"
          )
        ),
      "circle cut target body control"
    );
    featureEditor = getSectionByAriaLabel("Create authored feature");
    setSelectByLabel(
      featureEditor,
      "Target body",
      ids.v12CircleCutTargetBodyId
    );
    setFieldByLabel(
      featureEditor,
      "Optional feature ID",
      ids.v12CircleCutFeatureId
    );
    setFieldByLabel(featureEditor, "Optional body ID", ids.v12CircleCutBodyId);
    setFieldByLabel(featureEditor, "Optional name", ids.v12CircleCutBodyName);
    clickButton(featureEditor, "Create extrude");
    await waitFor(
      () =>
        includesText(
          getElementByAriaLabel("Model structure"),
          ids.v12CircleCutBodyName
        ),
      "created V12 circle cut result body"
    );
    pass(
      "v12-circle-cut-result-create",
      "created a deterministic circle-tool cut result through the browser UI",
      ids.v12CircleCutBodyId
    );

    const wallStableId = `generated:face:${ids.v12CircleCutBodyId}:side:circular`;
    const startRimStableId = `generated:edge:${ids.v12CircleCutBodyId}:start:circular`;
    const terminalRimStableId = `generated:edge:${ids.v12CircleCutBodyId}:end:circular`;

    openTreePanel();
    clickButtonContaining(
      getElementByAriaLabel("Model structure"),
      ids.v12CircleCutBodyName
    );
    openSelectionPanel();
    await selectGeneratedReferenceByStableId(wallStableId);
    await waitForV12ResultMeasureOnlyReferenceCommandReady({
      bodyId: ids.v12CircleCutBodyId,
      stableId: wallStableId,
      label: "Cut circular wall face"
    });
    pass(
      "v12-circle-cut-result-wall-command-ready-browser",
      "V12 circle cut-result cylindrical wall is command-ready for name/measure/inspect",
      getSelectionText()
    );
    await waitForViewportContextualCommands(
      ["Name", "Measure", "Inspect"],
      "V12 circle cut-result wall contextual commands"
    );
    assertViewportContextualCommandsAbsent([
      "Create sketch",
      "Chamfer",
      "Fillet"
    ]);
    pass(
      "v12-circle-cut-result-wall-no-sketch",
      "V12 circle cut-result cylindrical wall hides unsupported sketch and edge-finish actions",
      getViewportContextualCommandText()
    );

    openTreePanel();
    clickButtonContaining(
      getElementByAriaLabel("Model structure"),
      ids.v12CircleCutBodyName
    );
    openSelectionPanel();
    await selectGeneratedReferenceByStableId(terminalRimStableId);
    await waitForV12ResultEdgeCommandReady({
      bodyId: ids.v12CircleCutBodyId,
      stableId: terminalRimStableId,
      label: "Cut terminal circular rim edge"
    });
    pass(
      "v12-circle-cut-result-rim-command-ready-browser",
      "V12 circle cut-result terminal rim edge is command-ready for naming, measurement, and inspect",
      getSelectionText()
    );

    const rimSelect = getControlByLabel(
      getElementByAriaLabel("Inspector"),
      "Inspect reference"
    );
    const hasStartRim = [...rimSelect.querySelectorAll("option")].some(
      (option) => option.value === startRimStableId
    );

    if (!hasStartRim) {
      fail(
        "v12-circle-cut-result-rim-options-browser",
        "V12 circle cut-result exposes both start and terminal rim edge options",
        compactText(rimSelect.textContent, 520)
      );
    } else {
      pass(
        "v12-circle-cut-result-rim-options-browser",
        "V12 circle cut-result exposes both start and terminal rim edge options",
        compactText(rimSelect.textContent, 520)
      );
    }

    await waitForViewportContextualCommands(
      ["Name", "Measure", "Inspect"],
      "V12 circle cut-result rim contextual commands"
    );
    assertViewportContextualCommandsAbsent([
      "Create sketch",
      "Chamfer",
      "Fillet"
    ]);
    const selectionText = getViewportContextualCommandText();
    const deferredVisible =
      selectionText.includes("Edge finish") ||
      selectionText.includes("Chamfer") ||
      selectionText.includes("Fillet");

    if (deferredVisible) {
      fail(
        "v12-circle-cut-result-rim-no-deferred-finish",
        "V12 circle cut-result rim edges hide deferred edge-finish affordances",
        selectionText
      );
    } else {
      pass(
        "v12-circle-cut-result-rim-no-deferred-finish",
        "V12 circle cut-result rim edges hide deferred edge-finish affordances",
        selectionText
      );
    }
  }

  async function runV12CircleAddResultReferenceWorkflowSmoke() {
    await createV10RectangleNewBody({
      bodyId: ids.v12CircleAddTargetBodyId,
      bodyName: ids.v12CircleAddTargetBodyName,
      centerX: "-9",
      entityId: ids.v12CircleAddTargetEntityId,
      featureId: ids.v12CircleAddTargetFeatureId
    });

    openTreePanel();
    clickButtonContaining(
      getElementByAriaLabel("Model structure"),
      ids.v12CircleAddTargetBodyName
    );
    openSelectionPanel();
    await selectGeneratedReferenceByStableId(
      `generated:face:${ids.v12CircleAddTargetBodyId}:endCap`
    );

    const targetInspector = getElementByAriaLabel("Inspector");
    setSelectByLabel(
      targetInspector,
      "Face",
      `generated:face:${ids.v12CircleAddTargetBodyId}:endCap`
    );
    setFieldByLabel(
      targetInspector,
      "Sketch name",
      ids.v12CircleAddToolSketchName
    );
    setInputByDetailsSummary(
      targetInspector,
      "Advanced sketch options",
      ids.v12CircleAddToolSketchId
    );
    clickButton(targetInspector, "Create attached sketch");
    await waitFor(
      () =>
        includesText(
          getElementByAriaLabel("Model structure"),
          ids.v12CircleAddToolSketchName
        ),
      "V12 circle add target attached tool sketch"
    );

    clickButtonContaining(getElementByAriaLabel("Tool tabs"), "Sketches");
    const sketches = getSectionByAriaLabel("Sketches");
    setSelectByLabel(sketches, "Active sketch", ids.v12CircleAddToolSketchId);
    await waitFor(
      () =>
        getControlByLabel(getSectionByAriaLabel("Sketches"), "Active sketch")
          .value === ids.v12CircleAddToolSketchId,
      "V12 circle add tool sketch became active"
    );
    clickButton(getElementByAriaLabel("Add sketch entity"), "Circle");
    const entityEditor = await waitForSectionByAriaLabel(
      "Sketch entity editor",
      "V12 circle add tool circle entity editor"
    );
    setSelectByLabel(entityEditor, "Entity", "circle");
    setInputByDetailsSummary(
      entityEditor,
      "Optional ID",
      ids.v12CircleAddToolEntityId
    );
    setFieldByLabel(entityEditor, "Center X", "0");
    setFieldByLabel(entityEditor, "Center Y", "0");
    setFieldByLabel(entityEditor, "Radius", "0.35");
    clickButton(entityEditor, "Add entity");
    await waitFor(
      () =>
        includesText(
          getElementByAriaLabel("Select sketch entity"),
          ids.v12CircleAddToolEntityId
        ),
      "created V12 circle add tool circle"
    );

    let featureEditor = getSectionByAriaLabel("Create authored feature");
    setFieldByLabel(featureEditor, "Depth", "0.5");
    setSelectByLabel(featureEditor, "Operation", "add");
    await waitFor(
      () =>
        Boolean(
          queryControlByLabel(
            getSectionByAriaLabel("Create authored feature"),
            "Target body"
          )
        ),
      "circle add target body control"
    );
    featureEditor = getSectionByAriaLabel("Create authored feature");
    setSelectByLabel(
      featureEditor,
      "Target body",
      ids.v12CircleAddTargetBodyId
    );
    setFieldByLabel(
      featureEditor,
      "Optional feature ID",
      ids.v12CircleAddFeatureId
    );
    setFieldByLabel(featureEditor, "Optional body ID", ids.v12CircleAddBodyId);
    setFieldByLabel(featureEditor, "Optional name", ids.v12CircleAddBodyName);
    clickButton(featureEditor, "Create extrude");
    await waitFor(
      () =>
        includesText(
          getElementByAriaLabel("Model structure"),
          ids.v12CircleAddBodyName
        ),
      "created V12 circle add result body"
    );
    pass(
      "v12-circle-add-result-create",
      "created a deterministic circle-tool add result through the browser UI",
      ids.v12CircleAddBodyId
    );

    const capStableId = `generated:face:${ids.v12CircleAddBodyId}:endCap`;
    const wallStableId = `generated:face:${ids.v12CircleAddBodyId}:side:circular`;
    const edgeStableId = `generated:edge:${ids.v12CircleAddBodyId}:end:circular`;

    openTreePanel();
    clickButtonContaining(
      getElementByAriaLabel("Model structure"),
      ids.v12CircleAddBodyName
    );
    openSelectionPanel();
    await selectGeneratedReferenceByStableId(capStableId);
    await waitForV12AddResultFaceCommandReady({
      bodyId: ids.v12CircleAddBodyId,
      stableId: capStableId,
      label: "Added cap face"
    });
    pass(
      "v12-circle-add-result-cap-command-ready-browser",
      "V12 circle add-result cap face is command-ready for sketch/name/measure/inspect",
      getSelectionText()
    );

    openTreePanel();
    clickButtonContaining(
      getElementByAriaLabel("Model structure"),
      ids.v12CircleAddBodyName
    );
    openSelectionPanel();
    await selectGeneratedReferenceByStableId(wallStableId);
    await waitForV12ResultMeasureOnlyReferenceCommandReady({
      bodyId: ids.v12CircleAddBodyId,
      stableId: wallStableId,
      label: "Added circular wall face"
    });
    pass(
      "v12-circle-add-result-wall-command-ready-browser",
      "V12 circle add-result cylindrical wall is command-ready for name/measure/inspect",
      getSelectionText()
    );
    await waitForViewportContextualCommands(
      ["Name", "Measure", "Inspect"],
      "V12 circle add-result wall contextual commands"
    );
    assertViewportContextualCommandsAbsent([
      "Create sketch",
      "Chamfer",
      "Fillet"
    ]);
    pass(
      "v12-circle-add-result-wall-no-sketch",
      "V12 circle add-result cylindrical wall hides unsupported sketch and edge-finish actions",
      getViewportContextualCommandText()
    );

    openTreePanel();
    clickButtonContaining(
      getElementByAriaLabel("Model structure"),
      ids.v12CircleAddBodyName
    );
    openSelectionPanel();
    await selectGeneratedReferenceByStableId(edgeStableId);
    await waitForV12ResultEdgeCommandReady({
      bodyId: ids.v12CircleAddBodyId,
      stableId: edgeStableId,
      label: "Added cap circular edge"
    });
    pass(
      "v12-circle-add-result-edge-command-ready-browser",
      "V12 circle add-result cap edge is command-ready for naming, measurement, and inspect",
      getSelectionText()
    );

    await waitForViewportContextualCommands(
      ["Name", "Measure", "Inspect"],
      "V12 circle add-result edge contextual commands"
    );
    assertViewportContextualCommandsAbsent([
      "Create sketch",
      "Chamfer",
      "Fillet"
    ]);
    const selectionText = getViewportContextualCommandText();
    const deferredVisible =
      selectionText.includes("Edge finish") ||
      selectionText.includes("Chamfer") ||
      selectionText.includes("Fillet");

    if (deferredVisible) {
      fail(
        "v12-circle-add-result-edge-no-deferred-finish",
        "V12 circle add-result cap edge hides deferred edge-finish affordances",
        selectionText
      );
    } else {
      pass(
        "v12-circle-add-result-edge-no-deferred-finish",
        "V12 circle add-result cap edge hides deferred edge-finish affordances",
        selectionText
      );
    }
  }

  async function waitForV12CutResultFaceCommandReady(stableId) {
    await waitFor(() => {
      const inspector = getElementByAriaLabel("Inspector");
      const modelingContext = getSectionByAriaLabel("Modeling context");
      const ready =
        isSelectionPanelOpen() &&
        includesText(inspector, ids.cutBodyId) &&
        includesText(inspector, "Cut wall face uMin") &&
        includesText(inspector, stableId) &&
        includesText(inspector, "Ready reference") &&
        includesText(inspector, "Create sketch on face") &&
        includesText(modelingContext, "Reference status") &&
        includesText(modelingContext, "Create sketch on face");

      if (!ready) {
        throw new Error(
          [
            `selectionPanelOpen=${isSelectionPanelOpen() ? "true" : "false"}`,
            `inspector=${normalize(inspector.textContent).slice(0, 260)}`,
            `modeling=${normalize(modelingContext.textContent).slice(0, 180)}`
          ].join("; ")
        );
      }

      return true;
    }, "V12 cut-result face command-ready state");
  }

  async function waitForV12AddResultFaceCommandReady({
    bodyId = ids.v12AddBodyId,
    stableId,
    label
  }) {
    await waitFor(() => {
      const inspector = getElementByAriaLabel("Inspector");
      const modelingContext = getSectionByAriaLabel("Modeling context");
      const referenceSelect = getControlByLabel(inspector, "Inspect reference");
      const modelingText = normalize(modelingContext.textContent);
      const ready =
        isSelectionPanelOpen() &&
        stableId.includes(bodyId) &&
        referenceSelect.value === stableId &&
        modelingText.includes(label) &&
        modelingText.includes("Ready reference");

      if (!ready) {
        throw new Error(
          [
            `selectionPanelOpen=${isSelectionPanelOpen() ? "true" : "false"}`,
            `referenceSelect=${referenceSelect.value}`,
            `inspector=${normalize(inspector.textContent).slice(0, 320)}`,
            `modeling=${modelingText.slice(0, 220)}`
          ].join("; ")
        );
      }

      return true;
    }, `V12 add-result face command-ready state ${stableId}`);
  }

  async function waitForV12ResultMeasureOnlyReferenceCommandReady({
    bodyId,
    stableId,
    label
  }) {
    await waitFor(() => {
      const inspector = getElementByAriaLabel("Inspector");
      const modelingContext = getSectionByAriaLabel("Modeling context");
      const referenceSelect = getControlByLabel(inspector, "Inspect reference");
      const inspectorText = normalize(inspector.textContent);
      const modelingText = normalize(modelingContext.textContent);
      const ready =
        isSelectionPanelOpen() &&
        stableId.includes(bodyId) &&
        referenceSelect.value === stableId &&
        modelingText.includes(label) &&
        modelingText.includes("Ready reference");

      if (!ready) {
        throw new Error(
          [
            `selectionPanelOpen=${isSelectionPanelOpen() ? "true" : "false"}`,
            `referenceSelect=${referenceSelect.value}`,
            `inspector=${inspectorText.slice(0, 320)}`,
            `modeling=${modelingText.slice(0, 220)}`
          ].join("; ")
        );
      }

      return true;
    }, `V12 result measure-only reference command-ready state ${stableId}`);
  }

  async function waitForV12ResultEdgeCommandReady({ bodyId, stableId, label }) {
    await waitFor(() => {
      const inspector = getElementByAriaLabel("Inspector");
      const modelingContext = getSectionByAriaLabel("Modeling context");
      const referenceSelect = getControlByLabel(inspector, "Inspect reference");
      const inspectorText = normalize(inspector.textContent);
      const modelingText = normalize(modelingContext.textContent);
      const ready =
        isSelectionPanelOpen() &&
        stableId.includes(bodyId) &&
        referenceSelect.value === stableId &&
        modelingText.includes(label) &&
        modelingText.includes("Ready reference");

      if (!ready) {
        throw new Error(
          [
            `selectionPanelOpen=${isSelectionPanelOpen() ? "true" : "false"}`,
            `referenceSelect=${referenceSelect.value}`,
            `inspector=${inspectorText.slice(0, 320)}`,
            `modeling=${modelingText.slice(0, 220)}`
          ].join("; ")
        );
      }

      return true;
    }, `V12 result edge command-ready state ${stableId}`);
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

  function assertViewportContextualCommandsAbsent(labels) {
    const surface = getViewportContextualCommandSurface(
      getElementByAriaLabel("3D viewport")
    );
    const text = normalize(surface.textContent);
    const presentLabels = labels.filter((label) => text.includes(label));

    if (presentLabels.length > 0) {
      throw new Error(
        `Unexpected contextual command labels: ${presentLabels.join(", ")} in ${compactText(
          surface.textContent,
          260
        )}`
      );
    }
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

  function assertV13ExportedProjectJsonIncludes(projectJson) {
    let project;

    try {
      project = JSON.parse(projectJson);
    } catch (error) {
      fail(
        "v13-downstream-anchor-cut-export",
        "V13 exported project JSON parses",
        error instanceof Error ? error.message : "Unknown JSON parse error."
      );
      return;
    }

    const topology = project.document?.topologyIdentity;
    const anchors = Array.isArray(topology?.anchors) ? topology.anchors : [];
    const checkpoints = Array.isArray(topology?.checkpoints)
      ? topology.checkpoints
      : [];
    const repairs = Array.isArray(topology?.repairs) ? topology.repairs : [];
    const features = Array.isArray(project.document?.features)
      ? project.document.features
      : [];
    const namedReferences = Array.isArray(project.document?.namedReferences)
      ? project.document.namedReferences
      : [];
    const missing = [];

    if (project.schemaVersion !== "web-cad.project.v18") {
      missing.push("schemaVersion:web-cad.project.v18");
    }

    if (topology?.schemaVersion !== "web-cad.project.v18") {
      missing.push("topologyIdentity.schemaVersion:web-cad.project.v18");
    }

    if (checkpoints.length !== 4) {
      missing.push("topologyIdentity.checkpoints:4");
    }

    if (anchors.length !== 4) {
      missing.push("topologyIdentity.anchors:4");
    }

    if (
      !anchors.some(
        (anchor) =>
          anchor.anchorId === ids.v13RepairTopologyAnchorId &&
          anchor.entityKind === "face" &&
          anchor.bodyId === ids.v13RepairBodyId &&
          anchor.state === "active"
      )
    ) {
      missing.push(ids.v13RepairTopologyAnchorId);
    }

    if (
      !anchors.some(
        (anchor) =>
          anchor.anchorId === ids.v13TargetBodyAnchorId &&
          anchor.entityKind === "body" &&
          anchor.bodyId === ids.v13TargetBodyId &&
          anchor.state === "active"
      )
    ) {
      missing.push(ids.v13TargetBodyAnchorId);
    }

    if (
      !anchors.some(
        (anchor) =>
          anchor.entityKind === "face" &&
          anchor.bodyId === ids.v13RepairBodyId &&
          anchor.stableId === ids.v13ExplicitStableFaceId &&
          typeof anchor.checkpointId === "string" &&
          anchor.checkpointId.startsWith("topology_checkpoint_repair_") &&
          anchor.state === "active"
      )
    ) {
      missing.push(`${ids.v13ExplicitStableFaceId}:topologyAnchor`);
    }

    if (
      !repairs.some(
        (repair) =>
          typeof repair.replacementCheckpointId === "string" &&
          repair.replacementCheckpointId.startsWith(
            "topology_checkpoint_repair_"
          ) &&
          repair.confidence === "exact"
      )
    ) {
      missing.push(`${ids.v13ExplicitStableFaceId}:topologyRepair`);
    }

    if (
      !namedReferences.some(
        (reference) =>
          reference.name === ids.v13RepairReferenceName &&
          reference.topologyAnchorId === ids.v13RepairTopologyAnchorId &&
          reference.stableId === `generated:face:${ids.v13RepairBodyId}:endCap`
      )
    ) {
      missing.push(`${ids.v13RepairReferenceName}:topologyAnchorId`);
    }

    if (
      !features.some(
        (feature) =>
          feature.id === ids.v13CutFeatureId &&
          feature.operationMode === "cut" &&
          feature.targetBodyId === ids.v13TargetBodyId &&
          feature.targetTopologyAnchorId === ids.v13TargetBodyAnchorId &&
          feature.bodyId === ids.v13CutBodyId
      )
    ) {
      missing.push(`${ids.v13CutFeatureId}:targetTopologyAnchorId`);
    }

    if (missing.length > 0) {
      fail(
        "v13-downstream-anchor-cut-export",
        "V13 downstream cut keeps its topology-anchor target through Project/File JSON export",
        `Missing ${missing.join(", ")}`
      );
    }
  }

  function findPrivateTopologyUiLeak(text) {
    const match = normalize(text).match(
      /\b(?:checkpointEntityId|checkpoint-local|rendererId|renderer id|meshId|mesh id|occtId|occt id|gpuId|gpu id|selection-buffer|selectionBufferId|pixelId|pixel id|opfsPath|opfs path|fileHandle|file handle|viewport state)\b/i
    );

    return match ? `Private UI token leaked: ${match[0]}` : "";
  }

  async function waitFor(predicate, label, waitTimeoutMs = timeoutMs) {
    const deadline = Date.now() + waitTimeoutMs;
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

  function selectFirstGeneratedFaceFromInspector(bodyId) {
    const inspector = getElementByAriaLabel("Inspector");
    const referenceSelect = getControlByLabel(inspector, "Inspect reference");
    const faceOption = [...referenceSelect.querySelectorAll("option")].find(
      (option) =>
        option.value.includes(":face:") && option.value.includes(bodyId)
    );

    if (!faceOption) {
      throw new Error(
        `Could not find generated face option for ${bodyId}: ${compactText(
          referenceSelect.textContent,
          420
        )}`
      );
    }

    setSelectByLabel(inspector, "Inspect reference", faceOption.value);
    return normalize(faceOption.textContent);
  }

  async function selectGeneratedReferenceByStableId(stableId) {
    let optionLabel = "";

    await waitFor(() => {
      const inspector = getElementByAriaLabel("Inspector");
      const referenceSelect = getControlByLabel(inspector, "Inspect reference");
      const option = [...referenceSelect.querySelectorAll("option")].find(
        (candidate) => candidate.value === stableId
      );

      if (!option) {
        throw new Error(
          `Could not find generated reference option ${stableId}: ${compactText(
            referenceSelect.textContent,
            520
          )}`
        );
      }

      optionLabel = normalize(option.textContent);
      setSelectByLabel(inspector, "Inspect reference", stableId);
      return true;
    }, `generated reference option ${stableId}`);

    await waitFor(() => {
      const inspector = getElementByAriaLabel("Inspector");
      const referenceSelect = getControlByLabel(inspector, "Inspect reference");

      if (referenceSelect.value !== stableId) {
        throw new Error(
          `Selected ${referenceSelect.value || "none"}, expected ${stableId}.`
        );
      }

      return true;
    }, `selected generated reference ${stableId}`);

    return optionLabel;
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
      "JSON import/export"
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

  function decodeBytesForSearch(bytes) {
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
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
    const normalizedLabel = normalizeControlLabel(label);
    const matchingLabel = [...scope.querySelectorAll("label")].find(
      (candidate) =>
        normalizeControlLabel(getDirectLabelText(candidate)) === normalizedLabel
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

  function probeProjectFileActionReachability(actionLabels) {
    const scrollContainer = document.querySelector(
      ".project-file-drawer .project-panel"
    );
    const viewport = document.querySelector(".viewport-frame");

    if (!scrollContainer) {
      return { ok: false, detail: "Project panel scroll container not found." };
    }

    const issues = [];
    const details = [];
    const initialScrollTop = scrollContainer.scrollTop;
    const initialWindowScrollX = window.scrollX;
    const initialWindowScrollY = window.scrollY;
    const overflowY = getComputedStyle(scrollContainer).overflowY;
    const usesPanelScroll = overflowY === "auto" || overflowY === "scroll";
    const desktopRailLayout = window.matchMedia("(min-width: 981px)").matches;

    if (desktopRailLayout && !usesPanelScroll) {
      issues.push(`project panel overflow-y=${overflowY}`);
    }

    for (const label of actionLabels) {
      const button = getButtonByText(scrollContainer, label);

      if (!button) {
        issues.push(`${label} button missing`);
        continue;
      }

      button.scrollIntoView({ block: "center", inline: "nearest" });

      const buttonRect = button.getBoundingClientRect();
      const panelRect = scrollContainer.getBoundingClientRect();
      const withinPanel = usesPanelScroll
        ? buttonRect.top >= panelRect.top - 1 &&
          buttonRect.bottom <= panelRect.bottom + 1 &&
          buttonRect.left >= panelRect.left - 1 &&
          buttonRect.right <= panelRect.right + 1
        : buttonRect.top >= 0 &&
          buttonRect.bottom <= window.innerHeight + 1 &&
          buttonRect.left >= 0 &&
          buttonRect.right <= window.innerWidth + 1;

      if (!withinPanel) {
        issues.push(
          `${label} not reachable after scroll: button=${Math.round(
            buttonRect.top
          )}-${Math.round(buttonRect.bottom)}, panel=${Math.round(
            panelRect.top
          )}-${Math.round(panelRect.bottom)}`
        );
      } else {
        details.push(`${label}@${Math.round(buttonRect.top)}`);
      }
    }

    scrollContainer.scrollTop = initialScrollTop;
    window.scrollTo(initialWindowScrollX, initialWindowScrollY);

    if (viewport) {
      const viewportRect = viewport.getBoundingClientRect();
      if (viewportRect.width < 240 || viewportRect.height < 240) {
        issues.push(
          `viewport too small after Project/File scroll: ${Math.round(
            viewportRect.width
          )}x${Math.round(viewportRect.height)}`
        );
      }
    } else {
      issues.push("viewport frame missing");
    }

    return {
      ok: issues.length === 0,
      detail:
        issues.length > 0
          ? issues.join("; ")
          : `${details.join("; ")}; projectPanel=${Math.round(
              scrollContainer.clientHeight
            )}/${Math.round(
              scrollContainer.scrollHeight
            )}; overflow-y=${overflowY}`
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

  function normalizeControlLabel(value) {
    return normalize(value).replace(/\(\s+/g, "(").replace(/\s+\)/g, ")");
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

  function getRenderedText(element) {
    return normalize(element.innerText ?? element.textContent);
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
