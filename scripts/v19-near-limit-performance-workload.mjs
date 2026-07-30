import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readdir, mkdir, readFile, rm, stat } from "node:fs/promises";
import { register } from "node:module";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  connectToBrowser,
  findBrowserExecutable,
  getAvailablePort,
  startStaticServer,
  stopBrowserProcess
} from "./occt-smoke/browser.mjs";
import { acquireBrowserSmokeLease } from "./v18-geometry-reliability.mjs";

export const V19_NEAR_LIMIT_PROOF_VERSION =
  "partbench.v19-near-limit-performance.v1";
export const V19_NEAR_LIMIT_CANDIDATE_COUNT = 512;
export const V19_NEAR_LIMIT_PAGE_SIZE = 100;

const WORKLOAD_TIMEOUT_MS = Number(
  process.env.PARTBENCH_V19_PERFORMANCE_TIMEOUT_MS ?? 90_000
);

function debugPerformanceProgress(message) {
  if (!isTruthy(process.env.PARTBENCH_V19_PERFORMANCE_DEBUG)) return;
  process.stderr.write(`[v19-near-limit] ${message}\n`);
}

async function debugBrowserLongTasks(browser, stage) {
  if (!isTruthy(process.env.PARTBENCH_V19_PERFORMANCE_DEBUG)) return;
  const summary = await browser.evaluate(`(() => {
    const longTasks =
      window.__partbenchV19NearLimit?.snapshot?.().longTasks ?? [];
    return {
      count: longTasks.length,
      latestMs: longTasks.at(-1) ?? 0,
      maxMs: Math.max(0, ...longTasks)
    };
  })()`);
  debugPerformanceProgress(
    `${stage}: ${summary.count} long task(s), latest ${summary.latestMs.toFixed(
      1
    )}ms, max ${summary.maxMs.toFixed(1)}ms`
  );
}

export async function runV19NearLimitPerformanceWorkload({
  repositoryRoot,
  buildHash
}) {
  const distDirectory = join(repositoryRoot, "apps/web/dist");
  await stat(join(distDirectory, "index.html")).catch(() => {
    throw new Error(
      "The production web build is missing for the V19 near-limit workload."
    );
  });
  const actualBuildHash = await hashBuild(distDirectory);
  if (actualBuildHash !== buildHash) {
    throw new Error(
      `The V19 near-limit workload received build hash ${buildHash}, but apps/web/dist hashes to ${actualBuildHash}.`
    );
  }

  const browserExecutable = findBrowserExecutable();
  if (!browserExecutable) {
    throw new Error(
      "No Chromium-compatible browser was found for the V19 near-limit workload. Set PARTBENCH_SMOKE_BROWSER."
    );
  }

  const [initialProjectJson, revisedProjectJson] =
    await createNearLimitFixtureProjects(repositoryRoot);
  debugPerformanceProgress("fixture projects ready");
  const metricsDirectory = join(repositoryRoot, ".metrics");
  const profileDirectory = join(
    metricsDirectory,
    `chrome-profile-v19-near-limit-${process.pid}-${Date.now()}`
  );
  let browserLease;
  let server;
  let browser;
  let client;
  try {
    await mkdir(profileDirectory, { recursive: true });
    browserLease = await acquireBrowserSmokeLease({
      lockPath: join(metricsDirectory, "browser-smoke.lock")
    });
    server = await startStaticServer(distDirectory);
    const port = await getAvailablePort();
    browser = spawn(
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
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${profileDirectory}`,
        "about:blank"
      ],
      { stdio: "ignore" }
    );
    ({ client } = await connectToBrowser(port));
    return await measureProductionWorkload({
      appUrl: `http://127.0.0.1:${server.port}/index.html`,
      buildHash: actualBuildHash,
      client,
      initialProjectJson,
      revisedProjectJson
    });
  } finally {
    await client?.close().catch(() => {});
    await stopBrowserProcess(browser, 2_000).catch(() => {});
    await server?.close().catch(() => {});
    await rm(profileDirectory, { force: true, recursive: true }).catch(
      () => {}
    );
    await browserLease?.release().catch(() => {});
  }
}

export function createNearLimitCircleDefinitions(
  radius,
  count = V19_NEAR_LIMIT_CANDIDATE_COUNT
) {
  if (!Number.isFinite(radius) || radius <= 0 || radius >= 1.5) {
    throw new Error(
      "Near-limit fixture radius must be finite and in (0, 1.5)."
    );
  }
  if (!Number.isInteger(count) || count < 1 || count > 512) {
    throw new Error("Near-limit fixture count must be an integer in [1, 512].");
  }
  const columns = 32;
  return Array.from({ length: count }, (_, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    return {
      id: `region_circle_${String(index).padStart(3, "0")}`,
      center: [column * 3 - 46.5, row * 3 - 22.5],
      radius
    };
  });
}

export function measureCancellationDelay(cancelledWorkers) {
  return cancelledWorkers.length
    ? Math.min(
        ...cancelledWorkers.map(
          (worker) => worker.terminatedAt - worker.cancellationRequestedAt
        )
      )
    : undefined;
}

export function deriveV19NearLimitProof({ buildHash, browserEvidence }) {
  const discovery = browserEvidence.regionDiscovery ?? {};
  const curveEdit = browserEvidence.curveEdit ?? {};
  const interaction = browserEvidence.interaction ?? {};
  const workers = browserEvidence.workers ?? {};
  const occtWasmRequests = browserEvidence.occtWasmRequests ?? [];
  const geometryWorkerRequests = (browserEvidence.workerUrls ?? []).filter(
    (url) => url.includes("geometryTessellation.worker-")
  );
  const regionDiscovery = {
    completed:
      discovery.status === "ready" &&
      discovery.candidateCount === V19_NEAR_LIMIT_CANDIDATE_COUNT &&
      discovery.candidateCountSource === "worker-query-response",
    candidateSetComplete:
      discovery.loadedCandidateCount === V19_NEAR_LIMIT_CANDIDATE_COUNT &&
      discovery.hasMore === false &&
      discovery.pageCount ===
        Math.ceil(V19_NEAR_LIMIT_CANDIDATE_COUNT / V19_NEAR_LIMIT_PAGE_SIZE),
    candidateCount: discovery.candidateCount,
    loadedCandidateCount: discovery.loadedCandidateCount,
    candidateLimit: V19_NEAR_LIMIT_CANDIDATE_COUNT,
    candidateCountSource: discovery.candidateCountSource,
    pageCount: discovery.pageCount,
    revisionInvalidationObserved:
      discovery.revisedStatus === "ready" &&
      discovery.revisedAreaLabel !== discovery.initialAreaLabel &&
      discovery.revisedQueryWorkerCount > discovery.initialQueryWorkerCount &&
      typeof discovery.initialSourceRevision === "string" &&
      typeof discovery.revisedSourceRevision === "string" &&
      discovery.initialSourceRevision !== discovery.revisedSourceRevision,
    cancellationObserved: workers.cancelledQueryWorkerCount > 0,
    cancelledQueryWorkerCount: workers.cancelledQueryWorkerCount,
    initialQueryWorkerCount: discovery.initialQueryWorkerCount,
    revisedQueryWorkerCount: discovery.revisedQueryWorkerCount,
    initialSourceRevision: discovery.initialSourceRevision,
    revisedSourceRevision: discovery.revisedSourceRevision,
    initialAreaLabel: discovery.initialAreaLabel,
    revisedAreaLabel: discovery.revisedAreaLabel,
    cancellationDelayMs: workers.cancellationDelayMs
  };
  const curveEditProof = {
    completed:
      curveEdit.editorClosed === true &&
      curveEdit.entityCountAfter === curveEdit.entityCountBefore + 1,
    previewObserved: curveEdit.previewObserved === true,
    applyRevalidationObserved:
      curveEdit.applyCommandOp === "sketch.split" &&
      curveEdit.revisionBoundApply === true &&
      curveEdit.commandResponseOk === true,
    applyCommandOp: curveEdit.applyCommandOp,
    revisionBoundApply: curveEdit.revisionBoundApply,
    commandResponseOk: curveEdit.commandResponseOk,
    entityCountBefore: curveEdit.entityCountBefore,
    entityCountAfter: curveEdit.entityCountAfter
  };
  const interactionProof = {
    pointerFeedbackByNextAnimationFrame:
      interaction.pointerFeedbackByNextAnimationFrame === true,
    trustedPointerFeedbackEvent:
      interaction.trustedPointerFeedbackEvent === true,
    pointerFeedbackFrameLatencyMs: interaction.pointerFeedbackFrameLatencyMs,
    frameIntervalP95Ms: interaction.frameIntervalP95Ms,
    maxLongTaskMs: interaction.maxLongTaskMs,
    longTaskObserverSupported: interaction.longTaskObserverSupported === true,
    frameSampleCount: interaction.frameSampleCount
  };
  const workerDeferral = {
    geometryWorkerRequestCount: geometryWorkerRequests.length,
    geometryWorkerRequests,
    occtWasmRequestCount: occtWasmRequests.length,
    occtWasmRequests
  };
  const failures = [];
  if (!regionDiscovery.completed)
    failures.push("near-limit region discovery did not complete at 512");
  if (!regionDiscovery.candidateSetComplete)
    failures.push("the complete 512-candidate set was not paged into the UI");
  if (!regionDiscovery.revisionInvalidationObserved)
    failures.push("relevant sketch revision invalidation was not observed");
  if (!regionDiscovery.cancellationObserved)
    failures.push("no query worker was terminated before its response");
  if (
    !Number.isFinite(regionDiscovery.cancellationDelayMs) ||
    regionDiscovery.cancellationDelayMs <= 0
  )
    failures.push("query cancellation timing was not observed");
  if (!curveEditProof.completed)
    failures.push("the near-limit curve edit did not complete");
  if (!curveEditProof.previewObserved)
    failures.push("the curve-edit preview was not observed");
  if (!curveEditProof.applyRevalidationObserved)
    failures.push(
      "revision-bound curve-edit Apply revalidation was not observed"
    );
  if (!interactionProof.pointerFeedbackByNextAnimationFrame)
    failures.push("trusted pointer feedback missed the next animation frame");
  if (!interactionProof.trustedPointerFeedbackEvent)
    failures.push("pointer feedback was not driven by a trusted browser event");
  if (!Number.isFinite(interactionProof.pointerFeedbackFrameLatencyMs))
    failures.push("trusted pointer feedback latency was not measured");
  else if (interactionProof.pointerFeedbackFrameLatencyMs > 34)
    failures.push("trusted pointer feedback latency exceeded 34ms");
  if (!interactionProof.longTaskObserverSupported)
    failures.push("the browser did not support long-task observation");
  if (
    !Number.isInteger(interactionProof.frameSampleCount) ||
    interactionProof.frameSampleCount < 60
  )
    failures.push("fewer than 60 near-limit frame samples were observed");
  if (!Number.isFinite(interactionProof.frameIntervalP95Ms))
    failures.push("frame interval p95 was not measured");
  else if (interactionProof.frameIntervalP95Ms > 34)
    failures.push("frame interval p95 exceeded 34ms");
  if (!Number.isFinite(interactionProof.maxLongTaskMs))
    failures.push("maximum long task was not measured");
  else if (interactionProof.maxLongTaskMs > 50)
    failures.push("maximum long task exceeded 50ms");
  if (workerDeferral.occtWasmRequestCount !== 0)
    failures.push("the analytic workload requested OCCT WASM");
  if (workerDeferral.geometryWorkerRequestCount !== 0)
    failures.push("the analytic workload started the geometry worker");
  failures.push(...(browserEvidence.failures ?? []));

  return {
    version: V19_NEAR_LIMIT_PROOF_VERSION,
    ok: failures.length === 0,
    buildHash,
    execution: "production-browser",
    nearLimitClass: "representative-near-limit",
    profile: {
      viewport: "1536x1024",
      dpr: 1,
      candidateLimit: V19_NEAR_LIMIT_CANDIDATE_COUNT,
      pageSize: V19_NEAR_LIMIT_PAGE_SIZE
    },
    regionDiscovery,
    curveEdit: curveEditProof,
    interaction: interactionProof,
    workerDeferral,
    failures
  };
}

export async function createNearLimitFixtureProjects(repositoryRoot) {
  register(new URL("./ts-source-loader.mjs", import.meta.url), import.meta.url);
  const cadCore = await import(
    pathToFileURL(resolve(repositoryRoot, "packages/cad-core/src/index.ts"))
      .href
  );
  return [
    createNearLimitFixtureProjectJson(cadCore, 0.5),
    createNearLimitFixtureProjectJson(cadCore, 0.45)
  ];
}

export function createNearLimitFixtureProjectJson(cadCore, radius) {
  const fixtureCandidateCount = Number(
    process.env.PARTBENCH_V19_FIXTURE_CANDIDATE_COUNT ??
      V19_NEAR_LIMIT_CANDIDATE_COUNT
  );
  const engine = new cadCore.CadEngine();
  const response = engine.executeBatch({
    version: "cadops.v1",
    mode: "commit",
    ops: [
      {
        op: "sketch.create",
        id: "near_limit_sketch",
        name:
          radius === 0.5
            ? "V19 Gate E near-limit regions"
            : "V19 Gate E near-limit regions revised",
        plane: "XY"
      },
      {
        op: "sketch.addLine",
        sketchId: "near_limit_sketch",
        id: "perf_split_target",
        start: [-2, -28],
        end: [2, -28]
      }
    ]
  });
  if (!response.ok) {
    throw new Error(
      `Could not create the V19 near-limit fixture: ${response.error.code}`
    );
  }
  const project = cadCore.exportCadProject(engine);
  const document = {
    ...project.document,
    sketches: project.document.sketches.map((sketch) =>
      sketch.id === "near_limit_sketch"
        ? {
            ...sketch,
            entities: [
              ...sketch.entities.map((entity) => ({
                ...entity,
                construction: false
              })),
              ...createNearLimitCircleDefinitions(
                radius,
                fixtureCandidateCount
              ).map((circle) => ({
                ...circle,
                kind: "circle",
                construction: false
              }))
            ]
          }
        : sketch
    )
  };
  return JSON.stringify({
    ...project,
    schemaVersion: cadCore.CAD_PROJECT_FORMAT_VERSION_V21,
    document,
    history: [],
    redoStack: []
  });
}

async function measureProductionWorkload({
  appUrl,
  buildHash,
  client,
  initialProjectJson,
  revisedProjectJson
}) {
  const failures = [];
  const consoleErrors = [];
  const exceptions = [];
  const occtWasmRequests = new Set();
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
        .map((argument) =>
          String(
            argument.value ??
              argument.description ??
              argument.unserializableValue ??
              ""
          )
        )
        .filter(Boolean)
        .join(" ") || "Unknown browser console error"
    );
  });
  client.on("Network.requestWillBeSent", (params, context) => {
    if (context.sessionId !== sessionId) return;
    const url = params.request?.url ?? "";
    if (/opencascade\.full.*\.wasm/i.test(url)) occtWasmRequests.add(url);
  });

  await client.send("Runtime.enable", {}, sessionId);
  await client.send("Page.enable", {}, sessionId);
  await client.send("Network.enable", {}, sessionId);
  await client.send(
    "Network.setCacheDisabled",
    { cacheDisabled: true },
    sessionId
  );
  await client.send(
    "Emulation.setDeviceMetricsOverride",
    {
      width: 1536,
      height: 1024,
      deviceScaleFactor: 1,
      mobile: false
    },
    sessionId
  );
  await client.send(
    "Page.addScriptToEvaluateOnNewDocument",
    { source: createBrowserAuditBootstrap() },
    sessionId
  );
  await client.send("Page.navigate", { url: appUrl }, sessionId);
  const browser = createBrowserDriver(client, sessionId, WORKLOAD_TIMEOUT_MS);

  let regionDiscovery = {};
  let curveEdit = {};
  let interaction = {};
  let workers = {};
  let workerUrls = [];
  try {
    await browser.waitFor(
      `performance.getEntriesByName("partbench:shell-ready").length > 0`,
      "production shell"
    );
    debugPerformanceProgress("production shell ready");
    await importProject(browser, initialProjectJson);
    debugPerformanceProgress("initial project imported");
    await debugBrowserLongTasks(browser, "after initial import");
    await selectNearLimitSketch(browser, "V19 Gate E near-limit regions");
    await fitAllViewport(browser);
    debugPerformanceProgress("initial sketch selected and fitted");
    await debugBrowserLongTasks(browser, "after initial sketch fit");
    await browser.evaluate(`window.__partbenchV19NearLimit.startLongTasks()`);

    await browser.evaluate(
      `window.__partbenchV19NearLimit.cancelNextRegionQuery = true`
    );
    await activateRibbonAction(browser, "Material Regions");
    await browser.waitFor(
      `window.__partbenchV19NearLimit.workers.some(
        (worker) =>
          worker.queryPosted &&
          worker.cancellationRequested &&
          worker.terminated
      )`,
      "region query cancellation attempt"
    );
    await browser.waitFor(
      `!document.querySelector('[aria-label="Select sketch material regions"]')`,
      "cancelled region panel close"
    );
    debugPerformanceProgress("query cancellation observed");
    await debugBrowserLongTasks(browser, "after cancellation");

    await activateRibbonAction(browser, "Material Regions");
    await browser.waitFor(
      `document.querySelector('[aria-label="Select sketch material regions"]')
        ?.textContent.includes("ready") &&
       Number(document.querySelector(
         ".pb-region-select__candidates"
       )?.dataset.loadedCandidateCount) === 100`,
      "first near-limit candidate page"
    );
    debugPerformanceProgress("initial candidate page ready");
    await debugBrowserLongTasks(browser, "after initial candidate page");
    const initialAreaLabel = await browser.evaluate(
      `document.querySelector(".pb-region-select__candidate-title span")?.textContent`
    );
    const pageCount = await loadEveryRegionPage(browser);
    debugPerformanceProgress(`loaded ${pageCount} initial candidate pages`);
    await debugBrowserLongTasks(browser, "after initial pagination");
    const initialDiscovery = await browser.evaluate(`(() => {
      const panel = document.querySelector(
        '[aria-label="Select sketch material regions"]'
      );
      const loadedCandidateCount = Number(
        panel?.querySelector(".pb-region-select__candidates")
          ?.dataset.loadedCandidateCount ?? 0
      );
      const response = window.__partbenchV19NearLimit.workers
        .flatMap((worker) => worker.queryResponses)
        .find((candidate) =>
          candidate?.query === "sketch.profileRegionCandidates"
        );
      return {
        status: response?.status,
        candidateCount: response?.candidateCount,
        sourceRevision: response?.sourceRevision,
        loadedCandidateCount,
        hasMore: [...(panel?.querySelectorAll("button") ?? [])].some(
          (button) => button.textContent.trim() === "Load next page"
        ),
        queryWorkerCount: window.__partbenchV19NearLimit.workers.reduce(
          (count, worker) => count + worker.queryPostCount,
          0
        )
      };
    })()`);

    interaction = await measureRegionInteraction(browser);
    debugPerformanceProgress("region interaction measured");
    await debugBrowserLongTasks(browser, "after region interaction");
    await closeEditor(browser);
    await importProject(browser, revisedProjectJson);
    debugPerformanceProgress("revised project imported");
    await debugBrowserLongTasks(browser, "after revised import");
    await selectNearLimitSketch(
      browser,
      "V19 Gate E near-limit regions revised"
    );
    await activateRibbonAction(browser, "Material Regions");
    await browser.waitFor(
      `document.querySelector('[aria-label="Select sketch material regions"]')
        ?.textContent.includes("ready") &&
       Number(document.querySelector(
         ".pb-region-select__candidates"
       )?.dataset.loadedCandidateCount) === 100`,
      "revised near-limit candidate page"
    );
    debugPerformanceProgress("revised candidate page ready");
    await debugBrowserLongTasks(browser, "after revised candidate page");
    const revisedAreaLabel = await browser.evaluate(
      `document.querySelector(".pb-region-select__candidate-title span")?.textContent`
    );
    const revisedDiscovery = await browser.evaluate(`({
      ...(() => {
        const responses = window.__partbenchV19NearLimit.workers
          .flatMap((worker) => worker.queryResponses)
          .filter((candidate) =>
            candidate?.query === "sketch.profileRegionCandidates"
          );
        const response = responses.at(-1);
        return {
          status: response?.status,
          candidateCount: response?.candidateCount,
          sourceRevision: response?.sourceRevision
        };
      })(),
      queryWorkerCount: window.__partbenchV19NearLimit.workers.reduce(
        (count, worker) => count + worker.queryPostCount,
        0
      )
    })`);
    regionDiscovery = {
      status: initialDiscovery.status,
      candidateCount: initialDiscovery.candidateCount,
      candidateCountSource: "worker-query-response",
      loadedCandidateCount: initialDiscovery.loadedCandidateCount,
      hasMore: initialDiscovery.hasMore,
      pageCount,
      initialAreaLabel,
      revisedStatus: revisedDiscovery.status,
      revisedAreaLabel,
      initialQueryWorkerCount: initialDiscovery.queryWorkerCount,
      revisedQueryWorkerCount: revisedDiscovery.queryWorkerCount,
      initialSourceRevision: initialDiscovery.sourceRevision,
      revisedSourceRevision: revisedDiscovery.sourceRevision
    };

    await closeEditor(browser);
    curveEdit = await runCurveEdit(browser);
    debugPerformanceProgress("curve edit completed");
    await debugBrowserLongTasks(browser, "after curve edit");
    const finalAudit = await browser.evaluate(
      `window.__partbenchV19NearLimit.snapshot()`
    );
    const cancelledWorkers = finalAudit.workers.filter(
      (worker) =>
        worker.queryPosted === true &&
        worker.cancellationRequested === true &&
        worker.terminatedBeforeResponse === true
    );
    workers = {
      cancelledQueryWorkerCount: cancelledWorkers.length,
      cancellationDelayMs: measureCancellationDelay(cancelledWorkers)
    };
    workerUrls = finalAudit.workers.map((worker) => worker.url);
    interaction = {
      ...interaction,
      maxLongTaskMs: Math.max(0, ...finalAudit.longTasks),
      longTaskObserverSupported: finalAudit.longTaskObserverSupported
    };
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  }

  failures.push(
    ...[...new Set(consoleErrors)].map((error) => `console: ${error}`),
    ...[...new Set(exceptions)].map((error) => `exception: ${error}`)
  );
  return deriveV19NearLimitProof({
    buildHash,
    browserEvidence: {
      regionDiscovery,
      curveEdit,
      interaction,
      workers,
      workerUrls,
      occtWasmRequests: [...occtWasmRequests],
      failures
    }
  });
}

function createBrowserAuditBootstrap() {
  return `(() => {
    const NativeWorker = window.Worker;
    const audit = {
      cancelNextRegionQuery: false,
      workers: [],
      longTasks: [],
      longTaskObserverSupported:
        PerformanceObserver.supportedEntryTypes.includes("longtask"),
      longTaskObserver: undefined,
      startLongTasks() {
        this.longTasks = [];
        if (!this.longTaskObserverSupported) return;
        this.longTaskObserver?.disconnect();
        this.longTaskObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) this.longTasks.push(entry.duration);
        });
        this.longTaskObserver.observe({ type: "longtask", buffered: false });
      },
      stopLongTasks() {
        for (const entry of this.longTaskObserver?.takeRecords?.() ?? []) {
          this.longTasks.push(entry.duration);
        }
        this.longTaskObserver?.disconnect();
      },
      snapshot() {
        return {
          workers: this.workers.map((worker) => ({ ...worker })),
          longTasks: [...this.longTasks],
          longTaskObserverSupported: this.longTaskObserverSupported
        };
      }
    };
    class AuditedWorker extends NativeWorker {
      constructor(url, options) {
        super(url, options);
        const record = {
          id: audit.workers.length + 1,
          url: String(url),
          queryPosted: false,
          queryPostCount: 0,
          queryResponseCountAtPost: 0,
          cancellationResponseCountAtPost: undefined,
          queryResponse: undefined,
          queryResponses: [],
          responseAt: undefined,
          cancellationRequested: false,
          cancellationRequestedAt: undefined,
          commandOps: [],
          responseCount: 0,
          commandResponseOk: false,
          terminated: false,
          terminatedAt: undefined,
          terminatedBeforeResponse: false
        };
        audit.workers.push(record);
        this.addEventListener("message", (event) => {
          record.responseCount += 1;
          record.responseAt = performance.now();
          if (event.data?.queryResponse) {
            const response = event.data.queryResponse;
            record.queryResponse = {
              query: response.query,
              ok: response.ok,
              status: response.status,
              candidateCount: response.candidateCount,
              hasMore: response.hasMore,
              sourceRevision: response.sourceRevision,
              returnedCandidateCount: response.candidates?.length
            };
            record.queryResponses.push(record.queryResponse);
          }
          if (event.data?.response?.ok === true) record.commandResponseOk = true;
        });
        this.__partbenchAuditRecord = record;
      }
      postMessage(message, transferOrOptions) {
        const record = this.__partbenchAuditRecord;
        if (message?.kind === "cad-worker.query") {
          record.queryPosted = true;
          record.queryPostCount += 1;
          record.queryResponseCountAtPost = record.responseCount;
        } else if (Array.isArray(message?.batch?.ops)) {
          record.commandOps.push(...message.batch.ops.map((operation) => ({
            op: operation.op,
            expectedSourceRevision:
              operation.precondition?.expectedSourceRevision,
            expectedSolverEvaluationIdentity:
              operation.precondition?.expectedSolverEvaluationIdentity
          })));
        }
        if (transferOrOptions === undefined) super.postMessage(message);
        else super.postMessage(message, transferOrOptions);
        if (
          message?.kind === "cad-worker.query" &&
          message?.request?.query?.query === "sketch.profileRegionCandidates" &&
          audit.cancelNextRegionQuery
        ) {
          audit.cancelNextRegionQuery = false;
          record.cancellationResponseCountAtPost = record.responseCount;
          record.cancellationRequested = true;
          record.cancellationRequestedAt = performance.now();
          const panel = document.querySelector(
            '[aria-label="Select sketch material regions"]'
          );
          const cancel = [...(panel?.querySelectorAll("button") ?? [])].find(
            (button) => button.textContent.trim() === "Cancel"
          );
          cancel?.click();
        }
      }
      terminate() {
        const record = this.__partbenchAuditRecord;
        record.terminated = true;
        record.terminatedAt = performance.now();
        record.terminatedBeforeResponse =
          record.responseCount ===
          (record.cancellationResponseCountAtPost ??
            record.queryResponseCountAtPost);
        return super.terminate();
      }
    }
    Object.defineProperty(window, "Worker", {
      configurable: true,
      writable: true,
      value: AuditedWorker
    });
    window.__partbenchV19NearLimit = audit;
  })();`;
}

async function importProject(browser, projectJson) {
  const sketchEntityCount =
    JSON.parse(projectJson).document.sketches[0]?.entities.length ?? 0;
  await selectMode(browser, "Project");
  await activateRibbonAction(browser, "Project Files");
  await browser.waitFor(
    `Boolean(document.querySelector(".pb-project-mode-workspace textarea"))`,
    "Project Files workspace"
  );
  await browser.evaluate(`(() => {
    const details = [...document.querySelectorAll(
      ".pb-project-mode-workspace details"
    )].find((candidate) =>
      candidate.querySelector(":scope > summary")?.textContent.trim() ===
        "Advanced Interchange"
    );
    if (details) details.open = true;
    const textarea = document.querySelector(
      ".pb-project-mode-workspace textarea"
    );
    const setter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value"
    ).set;
    setter.call(textarea, ${JSON.stringify(projectJson)});
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  })()`);
  await browser.waitFor(
    `(() => {
      const button = [...document.querySelectorAll(
        ".pb-project-mode-workspace button"
      )].find((candidate) => candidate.textContent.trim() === "Import JSON");
      return Boolean(button && !button.disabled);
    })()`,
    "valid near-limit project JSON"
  );
  await browser.evaluate(`(() => {
    [...document.querySelectorAll(".pb-project-mode-workspace button")]
      .find((button) => button.textContent.trim() === "Import JSON")
      ?.click();
  })()`);
  await browser.waitFor(
    `document.body.textContent.includes(
      ${JSON.stringify(
        `Imported 0 object(s), 1 sketch(es), ${sketchEntityCount} sketch entity(ies)`
      )}
    )`,
    "near-limit project import"
  );
}

async function selectNearLimitSketch(browser, expectedSketchName) {
  await selectMode(browser, "Sketch");
  await browser.evaluate(`(() => {
    const row = [...document.querySelectorAll(
      '[aria-label="Document tree"] button.pb-tree-row__select'
    )].find((candidate) =>
      candidate.querySelector(".pb-tree-row__label")?.textContent.trim() ===
        ${JSON.stringify(expectedSketchName)}
    );
    row?.click();
  })()`);
  await browser.waitFor(
    `document.querySelector('[aria-label="Sketch editor"]')
      ?.textContent.includes(${JSON.stringify(expectedSketchName)})`,
    "focused near-limit sketch"
  );
}

async function fitAllViewport(browser) {
  await browser.evaluate(`(() => {
    [...document.querySelectorAll(
      '[aria-label="Viewport fit and zoom"] button'
    )]
      .find((button) => button.textContent.trim() === "Fit all")
      ?.click();
  })()`);
  await browser.evaluate(
    `new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    )`
  );
}

async function loadEveryRegionPage(browser) {
  let pages = 1;
  while (
    await browser.evaluate(`(() => {
      const panel = document.querySelector(
        '[aria-label="Select sketch material regions"]'
      );
      return [...(panel?.querySelectorAll("button") ?? [])].some(
        (button) =>
          button.textContent.trim() === "Load next page" && !button.disabled
      );
    })()`)
  ) {
    const previousCount = await browser.evaluate(
      `Number(document.querySelector(
        ".pb-region-select__candidates"
      )?.dataset.loadedCandidateCount ?? 0)`
    );
    await browser.evaluate(`(() => {
      const panel = document.querySelector(
        '[aria-label="Select sketch material regions"]'
      );
      [...(panel?.querySelectorAll("button") ?? [])]
        .find((button) => button.textContent.trim() === "Load next page")
        ?.click();
    })()`);
    await browser.waitFor(
      `Number(document.querySelector(
        ".pb-region-select__candidates"
      )?.dataset.loadedCandidateCount ?? 0) > ${previousCount}`,
      `region candidate page ${pages + 1}`
    );
    pages += 1;
    if (pages > 6) throw new Error("Region pagination exceeded six pages.");
  }
  return pages;
}

async function measureRegionInteraction(browser) {
  const coordinates = await browser.evaluate(`(() => {
    const rows = [...document.querySelectorAll(
      ".pb-region-select__candidate"
    )].slice(0, 2);
    rows[0]?.scrollIntoView({ block: "center" });
    return rows.map((row) => {
      const rect = row.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    });
  })()`);
  if (coordinates.length < 2) {
    throw new Error("Two candidate rows were not available for pointer proof.");
  }
  await browser.evaluate(`(() => {
    window.__partbenchV19PointerFeedback = new Promise((resolve) => {
      const row = document.querySelector(".pb-region-select__candidate");
      const startedAt = performance.now();
      const handler = (event) => {
        row.removeEventListener("pointermove", handler);
        requestAnimationFrame(() => {
          const overlay = document.querySelector(
            ".sketch-region-cell-hovered"
          );
          resolve({
            trusted: event.isTrusted,
            byNextFrame:
              row.dataset.hovered === "true" && Boolean(overlay),
            frameLatencyMs: performance.now() - startedAt,
            rowHovered: row.dataset.hovered === "true",
            overlayHovered: Boolean(overlay),
            rowCandidateKey: row.dataset.candidateKey,
            overlayCandidateKey: overlay?.dataset.candidateKey
          });
        });
      };
      row.addEventListener("pointermove", handler);
    });
  })()`);
  await browser.movePointer(coordinates[0]);
  const pointerFeedback = await browser.evaluate(
    `window.__partbenchV19PointerFeedback`
  );
  debugPerformanceProgress(
    `pointer feedback: ${JSON.stringify(pointerFeedback)}`
  );
  const frame = await browser.evaluate(`(async () => {
    const canvas = document.querySelector('[aria-label="3D scene viewport"]');
    const intervals = [];
    let previous = performance.now();
    const deadline = previous + 2000;
    while (performance.now() < deadline) {
      canvas.dispatchEvent(new PointerEvent("pointermove", {
        bubbles: true,
        clientX: 200 + Math.random() * 300,
        clientY: 150 + Math.random() * 250
      }));
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const now = performance.now();
      intervals.push(now - previous);
      previous = now;
    }
    const sorted = [...intervals].sort((left, right) => left - right);
    const p95 =
      sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)] ??
      0;
    return { p95, sampleCount: intervals.length };
  })()`);
  return {
    pointerFeedbackByNextAnimationFrame: pointerFeedback.byNextFrame,
    trustedPointerFeedbackEvent: pointerFeedback.trusted,
    pointerFeedbackFrameLatencyMs: pointerFeedback.frameLatencyMs,
    frameIntervalP95Ms: frame.p95,
    frameSampleCount: frame.sampleCount
  };
}

async function runCurveEdit(browser) {
  const entityCountBefore = V19_NEAR_LIMIT_CANDIDATE_COUNT + 1;
  await browser.evaluate(`(() => {
    const option = [...document.querySelectorAll(
      '[aria-label="Sketch entities"] [role="option"]'
    )].find((candidate) =>
      candidate.querySelector("small")?.textContent.trim() ===
        "perf_split_target"
    );
    option?.click();
  })()`);
  await debugBrowserLongTasks(browser, "after split target selection");
  await activateRibbonAction(browser, "Split");
  await browser.waitFor(
    `Boolean(document.querySelector('[aria-label="Split sketch geometry"]'))`,
    "near-limit Split editor"
  );
  await debugBrowserLongTasks(browser, "after Split editor open");
  await browser.evaluate(`(() => {
    const editor = document.querySelector(
      '[aria-label="Split sketch geometry"]'
    );
    [...(editor?.querySelectorAll("button") ?? [])]
      .find((button) => button.textContent.trim() === "Add split point")
      ?.click();
  })()`);
  await browser.waitFor(
    `document.querySelector('[aria-label="Split sketch geometry"]')
      ?.textContent.includes("Ready to apply")`,
    "near-limit curve-edit preview"
  );
  await debugBrowserLongTasks(browser, "after Split preview");
  const previewObserved = await browser.evaluate(
    `Boolean(document.querySelector(
      '[aria-label="Split sketch geometry"] .pb-curve-edit__preview'
    ))`
  );
  const commandWorkerCountBefore = await browser.evaluate(
    `window.__partbenchV19NearLimit.workers.length`
  );
  await browser.evaluate(`(() => {
    const editor = document.querySelector(
      '[aria-label="Split sketch geometry"]'
    );
    [...(editor?.querySelectorAll("button") ?? [])]
      .find((button) => button.textContent.trim() === "Apply Split")
      ?.click();
  })()`);
  await browser.waitFor(
    `!document.querySelector('[aria-label="Split sketch geometry"]')`,
    "near-limit Split Apply"
  );
  await browser.waitFor(
    `window.__partbenchV19NearLimit.workers.some((worker) =>
      worker.commandOps.some((operation) => operation.op === "sketch.split") &&
      worker.commandResponseOk
    )`,
    "revision-bound Split command response"
  );
  await debugBrowserLongTasks(browser, "after Split Apply");
  const commandEvidence = await browser.evaluate(`(() => {
    const workers = window.__partbenchV19NearLimit.workers.slice(
      ${commandWorkerCountBefore}
    );
    for (const worker of workers) {
      const operation = worker.commandOps.find(
        (candidate) => candidate.op === "sketch.split"
      );
      if (operation) return {
        op: operation.op,
        revisionBound:
          typeof operation.expectedSourceRevision === "string" &&
          operation.expectedSourceRevision.startsWith("partbench-source-v1:") &&
          typeof operation.expectedSolverEvaluationIdentity === "string",
        responseOk: worker.commandResponseOk
      };
    }
    const existing = window.__partbenchV19NearLimit.workers.find((worker) =>
      worker.commandOps.some((operation) => operation.op === "sketch.split")
    );
    const operation = existing?.commandOps.find(
      (candidate) => candidate.op === "sketch.split"
    );
    return {
      op: operation?.op,
      revisionBound:
        typeof operation?.expectedSourceRevision === "string" &&
        operation.expectedSourceRevision.startsWith("partbench-source-v1:") &&
        typeof operation.expectedSolverEvaluationIdentity === "string",
      responseOk: existing?.commandResponseOk === true
    };
  })()`);
  await browser.evaluate(`window.__partbenchV19NearLimit.stopLongTasks()`);
  const entityCountAfter = await readExportedSketchEntityCount(browser);
  await selectMode(browser, "Sketch");
  return {
    editorClosed: true,
    previewObserved,
    applyCommandOp: commandEvidence.op,
    revisionBoundApply: commandEvidence.revisionBound,
    commandResponseOk: commandEvidence.responseOk,
    entityCountBefore,
    entityCountAfter
  };
}

async function readExportedSketchEntityCount(browser) {
  await selectMode(browser, "Project");
  await activateRibbonAction(browser, "Project Files");
  await browser.waitFor(
    `Boolean(document.querySelector(".pb-project-mode-workspace textarea"))`,
    "Project Files after curve edit"
  );
  await browser.evaluate(`(() => {
    const details = [...document.querySelectorAll(
      ".pb-project-mode-workspace details"
    )].find((candidate) =>
      candidate.querySelector(":scope > summary")?.textContent.trim() ===
        "Advanced Interchange"
    );
    if (details) details.open = true;
    [...document.querySelectorAll(".pb-project-mode-workspace button")]
      .find((button) => button.textContent.trim() === "Prepare JSON")
      ?.click();
  })()`);
  await browser.waitFor(
    `(() => {
      try {
        const project = JSON.parse(document.querySelector(
          ".pb-project-mode-workspace textarea"
        ).value);
        return project.history?.at(-1)?.ops?.at(-1)?.op === "sketch.split";
      } catch {
        return false;
      }
    })()`,
    "exported Split project"
  );
  return browser.evaluate(`(() => {
    const project = JSON.parse(document.querySelector(
      ".pb-project-mode-workspace textarea"
    ).value);
    return project.document.sketches.find(
      (sketch) => sketch.id === "near_limit_sketch"
    ).entities.length;
  })()`);
}

async function closeEditor(browser) {
  await browser.evaluate(`(() => {
    const editor =
      document.querySelector('[aria-label="Select sketch material regions"]') ??
      document.querySelector('[aria-label$="sketch geometry"]');
    [...(editor?.querySelectorAll("button") ?? [])]
      .find((button) => button.textContent.trim() === "Cancel")
      ?.click();
  })()`);
  await browser.waitFor(
    `!document.querySelector('[aria-label="Select sketch material regions"]')`,
    "region panel close"
  );
}

async function selectMode(browser, mode) {
  await browser.evaluate(`(() => {
    [...document.querySelectorAll('[aria-label="Workbench mode"] button')]
      .find((button) => button.textContent.trim() === ${JSON.stringify(mode)})
      ?.click();
  })()`);
  await browser.waitFor(
    `document.querySelector(
      '[aria-label="Workbench mode"] button[aria-selected="true"]'
    )?.textContent.trim() === ${JSON.stringify(mode)}`,
    `${mode} mode`
  );
}

async function activateRibbonAction(browser, label) {
  await browser.evaluate(`(() => {
    [...document.querySelectorAll(
      ".pb-mode-ribbon__contents button.pb-ribbon-action"
    )].find((button) =>
      button.getClientRects().length > 0 &&
      button.textContent.trim() === ${JSON.stringify(label)}
    )?.click();
  })()`);
}

function createBrowserDriver(client, sessionId, timeoutMs) {
  async function evaluate(expression) {
    const response = await client.send(
      "Runtime.evaluate",
      { expression, awaitPromise: true, returnByValue: true },
      sessionId
    );
    if (response.exceptionDetails) {
      throw new Error(
        response.exceptionDetails.exception?.description ??
          response.exceptionDetails.text ??
          "Browser evaluation failed."
      );
    }
    return response.result.value;
  }
  return {
    evaluate,
    async movePointer({ x, y }) {
      await client.send(
        "Input.dispatchMouseEvent",
        { type: "mouseMoved", x, y },
        sessionId
      );
    },
    async waitFor(expression, label) {
      const deadline = Date.now() + timeoutMs;
      let lastError;
      while (Date.now() < deadline) {
        try {
          if (await evaluate(`Boolean(${expression})`)) return;
        } catch (error) {
          lastError = error;
        }
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
      }
      const page = await evaluate(
        `document.body?.innerText?.replace(/\\s+/g, " ").trim().slice(0, 900) ?? ""`
      ).catch(() => "");
      throw new Error(
        `Timed out waiting for ${label}.${lastError ? ` ${lastError.message}` : ""}${page ? ` Page: ${page}` : ""}`
      );
    }
  };
}

async function hashBuild(directory) {
  const hash = createHash("sha256");
  for (const name of (await readdir(directory, { recursive: true })).sort()) {
    const path = join(directory, name);
    const info = await stat(path);
    if (!info.isFile()) continue;
    hash.update(name);
    hash.update(await readFile(path));
  }
  return hash.digest("hex");
}

function isTruthy(value) {
  return value === "1" || value === "true" || value === "yes";
}
