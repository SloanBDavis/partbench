import { spawn } from "node:child_process";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import {
  connectToBrowser,
  findBrowserExecutable,
  getAvailablePort,
  startStaticServer,
  stopBrowserProcess
} from "./occt-smoke/browser.mjs";
import {
  acquireBrowserSmokeLease,
  classifyFinalGeometryReliabilityRun,
  classifyGeometryReliabilityRun,
  computeIncrementalMemoryPeak,
  diffMemoryEvents,
  evaluateResourceAdmission,
  readLinuxMemoryEnvironment,
  validateWorkerJobEvidence
} from "./v18-geometry-reliability.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = join(repoRoot, "apps/web/dist");
const metricsDir = join(repoRoot, ".metrics");
const artifactPath = join(metricsDir, "v18-geometry-reliability.json");
const lockPath = join(metricsDir, "browser-smoke.lock");
const browserExecutable = findBrowserExecutable();
const upperBoundBytes = Number(
  process.env.PARTBENCH_BROWSER_PEAK_UPPER_BOUND_BYTES ?? 1_879_048_192
);
const reserveBytes = Number(
  process.env.PARTBENCH_BROWSER_RESERVE_BYTES ?? 268_435_456
);
let lease;
let server;
let browser;
let client;
let profileDir;
let result;
let memoryBefore;
let admission;
let memoryAtSettle;
let memoryAfterIdle;
let memoryAfterCleanup;
let monitorTargetFailures = false;
let browserShutdownVerified = true;
let heartbeat = { maxGapMs: Number.NaN };
const phases = {};
const interactionChecks = [];
const targetFailures = [];
const exceptions = [];
const consoleErrors = [];
let diagnosticEvents = [];
let targetSourceId;
const instrumentedTargets = [];
const memorySamples = [];

try {
  await mkdir(metricsDir, { recursive: true });
  await stat(join(distDir, "index.html"));
  if (!browserExecutable) throw new Error("No Chromium browser was found.");

  lease = await acquireBrowserSmokeLease({ lockPath });
  memoryBefore = await readLinuxMemoryEnvironment();
  recordMemorySample("before", memoryBefore);
  admission = evaluateResourceAdmission({
    hostAvailableBytes: memoryBefore.host?.memAvailableBytes,
    cgroupCurrentBytes: memoryBefore.cgroup?.currentBytes,
    cgroupMaxBytes: memoryBefore.cgroup?.maxBytes,
    perBrowserIncrementalPeakUpperBoundBytes: upperBoundBytes,
    reserveBytes
  });
  if (admission.status !== "admitted") {
    result = classifyGeometryReliabilityRun({
      notRun: { code: admission.reasonCode, reason: admission.reason }
    });
    result = { ...result, resourceAdmission: admission, memoryBefore };
  } else {
    server = await startStaticServer(distDir);
    profileDir = join(metricsDir, `chrome-profile-v18-geometry-${process.pid}`);
    await mkdir(profileDir, { recursive: true });
    const port = await getAvailablePort();
    browser = spawn(
      browserExecutable,
      [
        "--headless=new",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--no-default-browser-check",
        "--no-first-run",
        ...(process.env.PARTBENCH_SMOKE_BROWSER_NO_SANDBOX === "1"
          ? ["--no-sandbox"]
          : []),
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${profileDir}`,
        "about:blank"
      ],
      { stdio: "ignore" }
    );
    ({ client } = await connectToBrowser(port));
    const targetSessions = new Map();
    client.on("Inspector.targetCrashed", (_params, metadata) =>
      targetFailures.push({
        code: "target-crashed",
        message: `Target session ${metadata.sessionId ?? "browser"} crashed.`,
        sessionId: metadata.sessionId
      })
    );
    client.on("Runtime.exceptionThrown", ({ exceptionDetails }, metadata) =>
      exceptions.push({
        sessionId: metadata.sessionId,
        target: targetSessions.get(metadata.sessionId),
        message:
          exceptionDetails?.exception?.description ??
          exceptionDetails?.text ??
          "Uncaught browser exception."
      })
    );
    client.on("Log.entryAdded", ({ entry }, metadata) => {
      if (entry?.level === "error")
        consoleErrors.push({
          sessionId: metadata.sessionId,
          target: targetSessions.get(metadata.sessionId),
          message: entry.text
        });
    });
    client.on("Runtime.consoleAPICalled", ({ type, args }, metadata) => {
      if (type === "error")
        consoleErrors.push({
          sessionId: metadata.sessionId,
          target: targetSessions.get(metadata.sessionId),
          message: args?.map((arg) => arg.value ?? arg.description).join(" ")
        });
    });
    client.on("Target.targetCrashed", ({ targetId, status }) =>
      targetFailures.push({
        code: "target-crashed",
        message: `Target ${targetId} crashed (${status ?? "unknown"}).`
      })
    );
    client.on("Target.detachedFromTarget", ({ sessionId, targetId }) => {
      const target = targetSessions.get(sessionId);
      targetSessions.delete(sessionId);
      if (monitorTargetFailures)
        targetFailures.push({
          code: "target-detached",
          message: `Target ${targetId ?? target?.targetId ?? "unknown"} detached unexpectedly.`,
          sessionId,
          target
        });
    });
    const configureTargetSession = async (childSessionId, targetInfo) => {
      if (!childSessionId) return;
      targetSessions.set(childSessionId, targetInfo);
      await client.send("Runtime.enable", {}, childSessionId);
      await client.send("Log.enable", {}, childSessionId);
      try {
        await client.send(
          "Target.setAutoAttach",
          {
            autoAttach: true,
            waitForDebuggerOnStart: true,
            flatten: true
          },
          childSessionId
        );
        instrumentedTargets.push({ sessionId: childSessionId, ...targetInfo });
      } finally {
        await client
          .send("Runtime.runIfWaitingForDebugger", {}, childSessionId)
          .catch(() => undefined);
      }
    };
    client.on(
      "Target.attachedToTarget",
      ({ sessionId: childSessionId, targetInfo }) => {
        void configureTargetSession(childSessionId, targetInfo).catch((error) =>
          targetFailures.push({
            code: "target-instrumentation-failed",
            message: String(error),
            sessionId: childSessionId,
            target: targetInfo
          })
        );
      }
    );
    const target = await client.send("Target.createTarget", {
      url: "about:blank"
    });
    const attached = await client.send("Target.attachToTarget", {
      targetId: target.targetId,
      flatten: true
    });
    const sessionId = attached.sessionId;
    await configureTargetSession(sessionId, {
      targetId: target.targetId,
      type: "page",
      url: "about:blank"
    });
    await client.send("Page.enable", {}, sessionId);
    await client.send("Inspector.enable", {}, sessionId);
    await client.send(
      "Page.addScriptToEvaluateOnNewDocument",
      {
        source: `
          window.__partbenchReliability = { events: [], heartbeat: [], previous: 0 };
          addEventListener("partbench:geometry-diagnostic", (event) => {
            window.__partbenchReliability.events.push(event.detail);
          });
          setInterval(() => {
            const now = performance.now();
            const state = window.__partbenchReliability;
            if (state.previous) state.heartbeat.push(now - state.previous);
            state.previous = now;
          }, 100);
        `
      },
      sessionId
    );
    monitorTargetFailures = true;
    await client.send(
      "Page.navigate",
      { url: `http://127.0.0.1:${server.port}/index.html` },
      sessionId
    );
    await evaluate(
      client,
      sessionId,
      `(async () => {
        const wait = async (predicate, label, timeout = 10000) => {
          const deadline = performance.now() + timeout;
          while (!predicate()) {
            if (performance.now() > deadline) throw new Error(label);
            await new Promise((resolve) => setTimeout(resolve, 20));
          }
        };
        await wait(() => performance.getEntriesByName("partbench:shell-ready").length, "shell missing");
        const button = (text) => [...document.querySelectorAll("button")]
          .find((entry) => entry.textContent.trim() === text);
        const openTree = document.querySelector('[aria-label="Open Document tree"]');
        if (openTree) {
          openTree.click();
          await wait(
            () => document.querySelector('[aria-label="Document tree"]')?.getBoundingClientRect().height > 0,
            "Document tree warm-up failed"
          );
        }
        const openSearch = document.querySelector('[aria-label="Search commands"]');
        if (!openSearch) throw new Error("Command search warm-up action missing");
        openSearch.click();
        await wait(
          () => document.querySelector('[aria-label="Close command search"]'),
          "Command search warm-up failed"
        );
        document.querySelector('[aria-label="Close command search"]')?.click();
        await new Promise((resolve) => requestAnimationFrame(() => resolve()));
        const cylinder = button("Cylinder");
        if (!cylinder) throw new Error("Cylinder action missing");
        cylinder.click();
        const findEditor = () => [...document.querySelectorAll("section")]
          .find((section) => section.querySelector("h2")?.textContent.trim() === "Create Cylinder");
        await wait(findEditor, "Cylinder editor missing");
        const editor = findEditor();
        const setField = (label, value) => {
          const labelElement = [...editor.querySelectorAll("label")]
            .find((entry) => entry.textContent.trim().startsWith(label));
          const input = labelElement?.htmlFor
            ? document.getElementById(labelElement.htmlFor)
            : labelElement?.querySelector("input");
          if (!input) throw new Error(label + " input missing");
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, value);
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
        };
        setField("Radius", "40");
        setField("Height", "10");
        const apply = [...editor.querySelectorAll("button")]
          .find((entry) => entry.textContent.trim() === "Apply");
        if (!apply) throw new Error("Cylinder Apply action missing");
        apply.click();
      })()`
    );

    const startedAt = Date.now();
    let pendingInteractionsDone = false;
    while (Date.now() - startedAt < 65_000) {
      const snapshot = await evaluate(
        client,
        sessionId,
        `(() => ({
          events: window.__partbenchReliability?.events ?? [],
          heartbeat: window.__partbenchReliability?.heartbeat ?? []
        }))()`
      );
      diagnosticEvents = snapshot.events;
      heartbeat = { maxGapMs: Math.max(0, ...snapshot.heartbeat) };
      for (const event of snapshot.events) {
        if (event.phase === "command-committed")
          phases.commandCommittedMs ??= event.timestamp;
        if (
          event.phase === "display-snapshot" &&
          event.pendingCount > 0 &&
          Number.isFinite(phases.commandCommittedMs) &&
          event.timestamp >= phases.commandCommittedMs
        ) {
          targetSourceId ??= event.entries.find(
            (entry) => entry.status === "pending"
          )?.id;
        }
        if (
          event.phase === "display-snapshot" &&
          event.entries.some(
            (entry) => entry.id === targetSourceId && entry.status === "ready"
          )
        )
          phases.displayServiceReadyMs ??= event.timestamp;
        if (
          event.phase === "exact-snapshot" &&
          event.entries.some(
            (entry) => entry.id === targetSourceId && entry.status === "ready"
          )
        )
          phases.exactServiceReadyMs ??= event.timestamp;
      }
      if (targetSourceId && phases.pendingVisibleMs === undefined) {
        phases.pendingVisibleMs = await evaluate(
          client,
          sessionId,
          `(async () => {
            await new Promise((resolve) => requestAnimationFrame(() => resolve()));
            const sourceId = ${JSON.stringify(targetSourceId)};
            const status = document.querySelector('[aria-label="Solid status"]');
            const statusVisible = status && status.getBoundingClientRect().height > 0;
            const sourceVisible = status?.dataset.modelSourceIds?.split(" ").includes(sourceId);
            return sourceVisible && statusVisible && status.textContent.includes("Building")
              ? performance.now()
              : undefined;
          })()`
        );
      }
      if (
        targetSourceId &&
        phases.displayServiceReadyMs !== undefined &&
        phases.displayReadyMs === undefined
      ) {
        phases.displayReadyMs = await readVisibleSourceStatus(
          client,
          sessionId,
          targetSourceId,
          ["Display ready", "Ready", "result unavailable"]
        );
      }
      if (
        targetSourceId &&
        phases.exactServiceReadyMs !== undefined &&
        phases.exactReadyMs === undefined
      ) {
        phases.exactReadyMs = await readVisibleSourceStatus(
          client,
          sessionId,
          targetSourceId,
          ["Ready", "Ready with design notes"]
        );
      }
      if (phases.pendingVisibleMs !== undefined && !pendingInteractionsDone) {
        interactionChecks.push(
          ...(await exerciseShell(client, sessionId, "pending"))
        );
        pendingInteractionsDone = true;
      }
      if (
        phases.displayReadyMs !== undefined &&
        phases.exactReadyMs !== undefined
      ) {
        interactionChecks.push(
          ...(await exerciseShell(client, sessionId, "ready"))
        );
        heartbeat = { maxGapMs: Math.max(0, ...snapshot.heartbeat) };
        memoryAtSettle = await readLinuxMemoryEnvironment();
        recordMemorySample("settle", memoryAtSettle);
        await new Promise((resolvePromise) =>
          setTimeout(resolvePromise, 5_000)
        );
        memoryAfterIdle = await readLinuxMemoryEnvironment();
        recordMemorySample("idle", memoryAfterIdle);
        const memoryEvents = diffMemoryEvents(
          memoryBefore.cgroup?.events,
          memoryAfterIdle.cgroup?.events
        );
        result = {
          ...classifyGeometryReliabilityRun({
            phases,
            heartbeat,
            interactionChecks,
            targetFailures,
            exceptions: exceptions.map(formatBrowserDiagnostic),
            consoleErrors: consoleErrors.map(formatBrowserDiagnostic),
            memoryEventDelta: memoryEvents.deltas,
            memoryEventResetKeys: memoryEvents.resetKeys
          }),
          resourceAdmission: admission,
          phases,
          heartbeat,
          interactionChecks,
          memoryBefore,
          memoryAtSettle,
          memoryAfterIdle,
          memoryEvents,
          targetFailures,
          exceptions,
          consoleErrors,
          diagnosticEvents,
          workerJobSummary: summarizeWorkerJobs(diagnosticEvents),
          instrumentedTargets,
          memorySamples
        };
        break;
      }
      const memorySample = await readLinuxMemoryEnvironment();
      recordMemorySample("poll", memorySample);
      const liveAdmission = evaluateResourceAdmission({
        hostAvailableBytes: memorySample.host?.memAvailableBytes,
        cgroupCurrentBytes: memorySample.cgroup?.currentBytes,
        cgroupMaxBytes: memorySample.cgroup?.maxBytes,
        perBrowserIncrementalPeakUpperBoundBytes: 0,
        reserveBytes
      });
      if (liveAdmission.status !== "admitted") {
        result = classifyGeometryReliabilityRun({
          notRun: {
            code: "runtime-memory-headroom-lost",
            reason: liveAdmission.reason
          }
        });
        break;
      }
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
    }
    result ??= {
      ...classifyGeometryReliabilityRun({
        phases,
        heartbeat: { maxGapMs: Number.NaN },
        interactionChecks,
        targetFailures,
        exceptions: exceptions.map(formatBrowserDiagnostic),
        consoleErrors: consoleErrors.map(formatBrowserDiagnostic)
      }),
      resourceAdmission: admission,
      phases,
      heartbeat,
      interactionChecks,
      targetFailures,
      exceptions,
      consoleErrors,
      diagnosticEvents,
      workerJobSummary: summarizeWorkerJobs(diagnosticEvents),
      instrumentedTargets,
      memorySamples
    };
  }
} catch (error) {
  if (
    !(
      error instanceof Error &&
      error.message === "No Chromium browser was found."
    )
  ) {
    targetFailures.push({
      code: "harness-failure",
      message: String(error)
    });
  }
  result =
    error instanceof Error && error.message === "No Chromium browser was found."
      ? classifyGeometryReliabilityRun({
          notRun: {
            code: "browser-unavailable",
            reason: error.message
          }
        })
      : {
          status: "fail",
          ok: false,
          failures: [{ code: "harness-failure", message: String(error) }]
        };
} finally {
  monitorTargetFailures = false;
  await client?.close().catch(() => undefined);
  await stopBrowserProcess(browser).catch((error) => {
    browserShutdownVerified = false;
    targetFailures.push({
      code: "browser-shutdown-failed",
      message: String(error)
    });
  });
  await server?.close().catch((error) =>
    targetFailures.push({
      code: "server-shutdown-failed",
      message: String(error)
    })
  );
  if (profileDir && browserShutdownVerified)
    await rm(profileDir, { recursive: true, force: true });
  if (memoryBefore && admission?.status === "admitted") {
    memoryAfterCleanup = await readLinuxMemoryEnvironment();
    recordMemorySample("cleanup", memoryAfterCleanup);
    if (!instrumentedTargets.some((target) => target.type === "worker"))
      targetFailures.push({
        code: "worker-instrumentation-missing",
        message:
          "No geometry worker target completed recursive CDP instrumentation."
      });
    targetFailures.push(
      ...validateWorkerJobEvidence(
        diagnosticEvents,
        targetSourceId,
        phases.commandCommittedMs
      )
    );
    const finalMemoryClassification = classifyFinalGeometryReliabilityRun({
      memoryBefore,
      memoryAfter: memoryAfterCleanup,
      phases,
      heartbeat,
      interactionChecks,
      targetFailures,
      exceptions: exceptions.map(formatBrowserDiagnostic),
      consoleErrors: consoleErrors.map(formatBrowserDiagnostic)
    });
    if (!finalMemoryClassification.memoryEvents) {
      result = finalMemoryClassification.result;
      result = {
        ...result,
        resourceAdmission: admission,
        memoryBefore,
        memoryAtSettle,
        memoryAfterIdle,
        memoryAfterCleanup,
        phases,
        heartbeat,
        interactionChecks,
        targetFailures,
        exceptions,
        consoleErrors,
        diagnosticEvents,
        workerJobSummary: summarizeWorkerJobs(diagnosticEvents),
        instrumentedTargets,
        memorySamples
      };
    } else {
      const memoryEvents = finalMemoryClassification.memoryEvents;
      const memoryPeak = computeIncrementalMemoryPeak(
        memoryBefore,
        memorySamples.map((entry) => entry.sample)
      );
      const incrementalPeakBytes = memoryPeak.incrementalPeakBytes;
      const finalClassification = finalMemoryClassification.result;
      if (
        finalClassification.status === "not-run" ||
        result?.status !== "not-run"
      ) {
        result = finalClassification;
      }
      if (
        result?.status === "pass" &&
        incrementalPeakBytes !== undefined &&
        incrementalPeakBytes > upperBoundBytes
      )
        result = addFailure(result, {
          code: "incremental-memory-peak-exceeded",
          message: `Incremental cgroup peak ${incrementalPeakBytes} exceeded ${upperBoundBytes}.`
        });
      result = {
        ...result,
        resourceAdmission: admission,
        phases,
        heartbeat,
        interactionChecks,
        memoryBefore,
        memoryAtSettle,
        memoryAfterIdle,
        memoryAfterCleanup,
        memoryEvents,
        memoryPeak,
        memorySamples,
        incrementalPeakBytes,
        targetFailures,
        exceptions,
        consoleErrors,
        diagnosticEvents,
        workerJobSummary: summarizeWorkerJobs(diagnosticEvents),
        instrumentedTargets
      };
    }
  }
  if (browserShutdownVerified) await lease?.release().catch(() => undefined);
  await writeFile(artifactPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
  process.exitCode =
    result?.status === "pass" ? 0 : result?.status === "not-run" ? 2 : 1;
}

async function exerciseShell(client, sessionId, state) {
  const roundTripStartedAt = performance.now();
  const checks = await evaluate(
    client,
    sessionId,
    `(async () => {
      const checks = [];
      const record = async (id, operation) => {
        const startedAt = performance.now();
        try {
          await operation();
          const durationMs = performance.now() - startedAt;
          if (durationMs > 100) throw new Error(
            id + " exceeded the 100 ms interaction budget (" + durationMs.toFixed(1) + " ms)."
          );
          checks.push({ id, ok: true, durationMs });
        }
        catch (error) {
          checks.push({
            id,
            ok: false,
            durationMs: performance.now() - startedAt,
            detail: String(error)
          });
        }
      };
      const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
      const waitFor = async (predicate, label) => {
        const deadline = performance.now() + 100;
        while (!predicate()) {
          if (performance.now() > deadline) throw new Error(label);
          await nextFrame();
        }
      };
      await record("${state}-document-tree", async () => {
        let tree = document.querySelector('[aria-label="Document tree"]');
        if (!tree || tree.getBoundingClientRect().height <= 0) {
          const openTree = document.querySelector('[aria-label="Open Document tree"]');
          if (!openTree) throw new Error("tree and its opener are missing");
          openTree.click();
          await waitFor(() => {
            tree = document.querySelector('[aria-label="Document tree"]');
            return tree && tree.getBoundingClientRect().height > 0;
          }, "document tree did not open");
        }
        const firstRow = tree.querySelector('[role="treeitem"]');
        if (!firstRow) throw new Error("document tree has no rows");
        firstRow.focus();
        await nextFrame();
      });
      await record("${state}-command-search", async () => {
        const open = document.querySelector('[aria-label="Search commands"]');
        if (!open) throw new Error("search missing");
        open.click();
        await waitFor(
          () => document.querySelector('[aria-label="Close command search"]'),
          "command search did not open"
        );
        document.querySelector('[aria-label="Close command search"]')?.click();
        await nextFrame();
      });
      await record("${state}-fit-all", async () => {
        const fit = [...document.querySelectorAll("button")]
          .find((button) => button.textContent.trim() === "Fit all");
        if (!fit) throw new Error("Fit all missing");
        fit.click();
        await nextFrame();
      });
      return checks;
    })()`
  );
  const roundTripMs = performance.now() - roundTripStartedAt;
  return [
    ...checks,
    {
      id: `${state}-cdp-round-trip`,
      ok: roundTripMs <= 150,
      durationMs: roundTripMs,
      ...(roundTripMs > 150
        ? {
            detail: `The ${state} shell CDP round trip took ${roundTripMs.toFixed(1)} ms, exceeding 150 ms.`
          }
        : {})
    }
  ];
}

async function readVisibleSourceStatus(
  client,
  sessionId,
  sourceId,
  acceptedStatusText
) {
  return evaluate(
    client,
    sessionId,
    `(async () => {
      await new Promise((resolve) => requestAnimationFrame(() => resolve()));
      const sourceId = ${JSON.stringify(sourceId)};
      const status = document.querySelector('[aria-label="Solid status"]');
      const accepted = ${JSON.stringify(acceptedStatusText)};
      const sourceVisible = status?.dataset.modelSourceIds?.split(" ").includes(sourceId);
      return sourceVisible && status && status.getBoundingClientRect().height > 0 &&
        accepted.some((text) => status.textContent.includes(text))
        ? performance.now()
        : undefined;
    })()`
  );
}

function recordMemorySample(phase, sample) {
  memorySamples.push({ phase, timestamp: Date.now(), sample });
}

function formatBrowserDiagnostic(entry) {
  return `[${entry.target?.type ?? "target"}:${entry.sessionId ?? "browser"}] ${entry.message}`;
}

function summarizeWorkerJobs(events) {
  const jobs = events
    .filter((event) => event.phase === "worker-job")
    .map((event) => event.job);
  return {
    eventCount: jobs.length,
    queuedCount: jobs.filter((job) => job.phase === "queued").length,
    startedCount: jobs.filter((job) => job.phase === "started").length,
    settledCount: jobs.filter((job) => job.phase === "settled").length,
    cancelledCount: jobs.filter((job) => job.phase === "cancelled").length,
    supersededCount: jobs.filter((job) => job.phase === "superseded").length,
    jobs
  };
}

function addFailure(resultToUpdate, failure) {
  return {
    ...resultToUpdate,
    status: "fail",
    ok: false,
    failures: [...(resultToUpdate.failures ?? []), failure]
  };
}

async function evaluate(client, sessionId, expression) {
  const response = await Promise.race([
    client.send(
      "Runtime.evaluate",
      { expression, awaitPromise: true, returnByValue: true },
      sessionId
    ),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Runtime.evaluate timed out.")), 30_000)
    )
  ]);
  if (response.exceptionDetails) {
    throw new Error(
      response.exceptionDetails.exception?.description ??
        response.exceptionDetails.text ??
        "Browser evaluation failed."
    );
  }
  return response.result.value;
}
