import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { hostname as readHostname } from "node:os";
import { dirname, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const KIBIBYTE = 1024;

export const V18_GEOMETRY_RELIABILITY_REQUIRED_INTERACTION_IDS = [
  "pending-document-tree",
  "pending-command-search",
  "pending-fit-all",
  "ready-document-tree",
  "ready-command-search",
  "ready-fit-all"
];

export class BrowserSmokeLeaseTimeoutError extends Error {
  constructor(lockPath, timeoutMs) {
    super(
      `Timed out after ${timeoutMs} ms waiting for browser smoke lease ${lockPath}.`
    );
    this.name = "BrowserSmokeLeaseTimeoutError";
    this.code = "BROWSER_SMOKE_LEASE_TIMEOUT";
    this.lockPath = lockPath;
    this.timeoutMs = timeoutMs;
  }
}

export function parseLinuxMeminfo(source) {
  const values = new Map();

  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_()]+):\s+(\d+)\s+kB$/);
    if (match) values.set(match[1], Number(match[2]) * KIBIBYTE);
  }

  return {
    memTotalBytes: values.get("MemTotal"),
    memAvailableBytes: values.get("MemAvailable"),
    swapTotalBytes: values.get("SwapTotal"),
    swapFreeBytes: values.get("SwapFree")
  };
}

export function parseCgroupV2Membership(source) {
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^0::(.*)$/);
    if (match) return match[1] || "/";
  }

  return undefined;
}

export function resolveCgroupV2Directory(cgroupRoot, membershipPath) {
  if (!membershipPath?.startsWith("/")) return undefined;

  const root = resolve(cgroupRoot);
  const directory = resolve(root, `.${membershipPath}`);
  return directory === root || directory.startsWith(`${root}/`)
    ? directory
    : undefined;
}

export function parseCgroupMemoryValue(source) {
  const value = source.trim();
  if (value === "max") return null;
  if (!/^\d+$/.test(value)) return undefined;

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

export function parseCgroupMemoryEvents(source) {
  const counters = {};

  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^([a-z_]+)\s+(\d+)$/);
    if (match) counters[match[1]] = Number(match[2]);
  }

  return counters;
}

export function diffMemoryEvents(before = {}, after = {}) {
  const deltas = {};
  const resetKeys = [];

  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const previous = before[key] ?? 0;
    const current = after[key] ?? 0;

    if (current < previous) {
      resetKeys.push(key);
      deltas[key] = current;
    } else {
      deltas[key] = current - previous;
    }
  }

  return { deltas, resetKeys };
}

export function haveComparableCgroupMemoryEvents(before, after) {
  return Boolean(
    before?.cgroup?.events &&
    after?.cgroup?.events &&
    before.cgroup.eventsSource &&
    before.cgroup.eventsSource === after.cgroup.eventsSource
  );
}

export function classifyFinalGeometryReliabilityRun({
  memoryBefore,
  memoryAfter,
  ...classificationInput
}) {
  if (!haveComparableCgroupMemoryEvents(memoryBefore, memoryAfter)) {
    return {
      result: classifyGeometryReliabilityRun({
        notRun: {
          code: "memory-event-accounting-unavailable",
          reason: "Comparable cgroup memory-event counters were unavailable."
        }
      }),
      memoryEvents: undefined
    };
  }

  const memoryEvents = diffMemoryEvents(
    memoryBefore.cgroup.events,
    memoryAfter.cgroup.events
  );
  return {
    result: classifyGeometryReliabilityRun({
      ...classificationInput,
      memoryEventDelta: memoryEvents.deltas,
      memoryEventResetKeys: memoryEvents.resetKeys
    }),
    memoryEvents
  };
}

export function validateWorkerJobEvidence(
  events,
  sourceId,
  commandCommittedMs,
  requiredIntents = ["display", "exact"]
) {
  if (!sourceId || !Number.isFinite(commandCommittedMs)) {
    return [
      {
        code: "worker-source-evidence-missing",
        message:
          "A committed command and correlated geometry source are required."
      }
    ];
  }

  const jobs = events
    .filter(
      (event) =>
        event.phase === "worker-job" &&
        event.timestamp >= commandCommittedMs &&
        event.job?.sourceId === sourceId
    )
    .map((event) => event.job);
  const failures = [];
  for (const intent of requiredIntents) {
    const runIds = new Set(
      jobs.filter((job) => job.intent === intent).map((job) => job.runId)
    );
    const complete = [...runIds].some((runId) => {
      const phases = new Set(
        jobs.filter((job) => job.runId === runId).map((job) => job.phase)
      );
      return (
        phases.has("queued") && phases.has("started") && phases.has("settled")
      );
    });
    if (!complete)
      failures.push({
        code: `worker-${intent}-evidence-missing`,
        message: `No queued/started/settled ${intent} worker run was correlated to ${sourceId}.`
      });
  }
  return failures;
}

export function computeIncrementalMemoryPeak(memoryBefore, samples) {
  const baselineCurrent = memoryBefore?.cgroup?.currentBytes;
  const baselinePeak = memoryBefore?.cgroup?.peakBytes;
  const currentValues = samples
    .map((sample) => sample?.cgroup?.currentBytes)
    .filter(Number.isFinite);
  const peakValues = samples
    .map((sample) => sample?.cgroup?.peakBytes)
    .filter(Number.isFinite);
  const sampledCurrentPeakBytes =
    currentValues.length > 0 ? Math.max(...currentValues) : undefined;
  const finalCgroupPeakBytes =
    peakValues.length > 0 ? Math.max(...peakValues) : undefined;
  const sampledCurrentIncreaseBytes =
    Number.isFinite(sampledCurrentPeakBytes) && Number.isFinite(baselineCurrent)
      ? Math.max(0, sampledCurrentPeakBytes - baselineCurrent)
      : undefined;
  const cgroupPeakIncreaseBytes =
    Number.isFinite(finalCgroupPeakBytes) && Number.isFinite(baselinePeak)
      ? Math.max(0, finalCgroupPeakBytes - baselinePeak)
      : undefined;
  const candidates = [
    sampledCurrentIncreaseBytes,
    cgroupPeakIncreaseBytes
  ].filter(Number.isFinite);

  return {
    sampledCurrentPeakBytes,
    sampledCurrentIncreaseBytes,
    finalCgroupPeakBytes,
    cgroupPeakIncreaseBytes,
    incrementalPeakBytes:
      candidates.length > 0 ? Math.max(...candidates) : undefined
  };
}

export async function readLinuxMemoryEnvironment({
  procRoot = "/proc",
  cgroupRoot = "/sys/fs/cgroup"
} = {}) {
  const meminfo = await readOptionalText(resolve(procRoot, "meminfo"));
  const membershipSource = await readOptionalText(
    resolve(procRoot, "self/cgroup")
  );
  const membershipPath = membershipSource
    ? parseCgroupV2Membership(membershipSource)
    : undefined;
  const cgroupDirectory = membershipPath
    ? resolveCgroupV2Directory(cgroupRoot, membershipPath)
    : undefined;

  const host = meminfo ? parseLinuxMeminfo(meminfo) : undefined;
  if (!cgroupDirectory) {
    return {
      host,
      cgroup: undefined,
      accountingAvailable: host?.memAvailableBytes !== undefined
    };
  }

  const [current, peak, maximum, localEvents, parentEvents] = await Promise.all(
    [
      readOptionalText(resolve(cgroupDirectory, "memory.current")),
      readOptionalText(resolve(cgroupDirectory, "memory.peak")),
      readOptionalText(resolve(cgroupDirectory, "memory.max")),
      readOptionalText(resolve(cgroupDirectory, "memory.events.local")),
      readOptionalText(resolve(cgroupDirectory, "memory.events"))
    ]
  );
  const events = localEvents ?? parentEvents;
  const currentBytes = parseOptionalCgroupMemoryValue(current);
  const peakBytes = parseOptionalCgroupMemoryValue(peak);
  const maxBytes = parseOptionalCgroupMemoryValue(maximum);
  const cgroup = {
    directory: cgroupDirectory,
    membershipPath,
    currentBytes,
    peakBytes,
    maxBytes,
    events: events ? parseCgroupMemoryEvents(events) : undefined,
    eventsSource: localEvents
      ? "memory.events.local"
      : parentEvents
        ? "memory.events"
        : undefined
  };

  return {
    host,
    cgroup,
    accountingAvailable:
      host?.memAvailableBytes !== undefined ||
      (currentBytes !== undefined && maxBytes !== undefined)
  };
}

export function evaluateResourceAdmission({
  hostAvailableBytes,
  cgroupCurrentBytes,
  cgroupMaxBytes,
  perBrowserIncrementalPeakUpperBoundBytes,
  concurrency = 1,
  reserveBytes
}) {
  const invalid = [
    [
      "perBrowserIncrementalPeakUpperBoundBytes",
      perBrowserIncrementalPeakUpperBoundBytes
    ],
    ["concurrency", concurrency],
    ["reserveBytes", reserveBytes]
  ].find(([, value]) => !Number.isFinite(value) || value < 0);

  if (invalid || !Number.isInteger(concurrency) || concurrency < 1) {
    throw new TypeError(
      `${invalid?.[0] ?? "concurrency"} must be a valid non-negative resource policy value.`
    );
  }

  const hostHeadroomBytes = finiteNonNegative(hostAvailableBytes);
  const cgroupHeadroomBytes =
    cgroupMaxBytes === null
      ? undefined
      : Number.isFinite(cgroupMaxBytes) && Number.isFinite(cgroupCurrentBytes)
        ? Math.max(0, cgroupMaxBytes - cgroupCurrentBytes)
        : undefined;
  const availableCandidates = [hostHeadroomBytes, cgroupHeadroomBytes].filter(
    (value) => value !== undefined
  );
  const requiredBytes =
    perBrowserIncrementalPeakUpperBoundBytes * concurrency + reserveBytes;

  if (availableCandidates.length === 0) {
    return {
      status: "not-run",
      reasonCode: "memory-accounting-unavailable",
      reason:
        "Neither host available memory nor bounded cgroup headroom could be measured.",
      requiredBytes,
      hostHeadroomBytes,
      cgroupHeadroomBytes
    };
  }

  const usableBytes = Math.min(...availableCandidates);
  if (usableBytes < requiredBytes) {
    return {
      status: "not-run",
      reasonCode: "insufficient-memory-headroom",
      reason: `Usable memory ${formatBytes(usableBytes)} is below the required ${formatBytes(requiredBytes)}.`,
      requiredBytes,
      usableBytes,
      hostHeadroomBytes,
      cgroupHeadroomBytes
    };
  }

  return {
    status: "admitted",
    requiredBytes,
    usableBytes,
    hostHeadroomBytes,
    cgroupHeadroomBytes
  };
}

export async function acquireBrowserSmokeLease({
  lockPath,
  timeoutMs = 10 * 60 * 1000,
  pollIntervalMs = 250,
  ownerWriteGraceMs = 5_000,
  pid = process.pid,
  hostname = readHostname(),
  now = () => Date.now(),
  token = randomUUID(),
  isProcessAlive = defaultIsProcessAlive,
  signal
}) {
  if (!lockPath) throw new TypeError("lockPath is required.");
  if (!Number.isFinite(timeoutMs) || timeoutMs < 0) {
    throw new TypeError("timeoutMs must be a non-negative finite number.");
  }
  if (!Number.isFinite(pollIntervalMs) || pollIntervalMs <= 0) {
    throw new TypeError("pollIntervalMs must be a positive finite number.");
  }
  if (!Number.isFinite(ownerWriteGraceMs) || ownerWriteGraceMs < 0) {
    throw new TypeError(
      "ownerWriteGraceMs must be a non-negative finite number."
    );
  }

  const ownerPath = resolve(lockPath, "owner.json");
  const startedAt = now();
  await mkdir(dirname(lockPath), { recursive: true });

  while (true) {
    signal?.throwIfAborted();

    try {
      await mkdir(lockPath);
      const owner = { pid, hostname, token, acquiredAt: now() };

      try {
        await writeFile(ownerPath, `${JSON.stringify(owner)}\n`, {
          flag: "wx"
        });
      } catch (error) {
        await rm(lockPath, { recursive: true, force: true }).catch(() => {});
        throw error;
      }

      let released = false;
      return {
        lockPath,
        owner,
        async release() {
          if (released) return false;
          released = true;
          return releaseOwnedLease(lockPath, owner);
        }
      };
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
    }

    const reclaimed = await reclaimStaleLease({
      lockPath,
      ownerPath,
      hostname,
      now,
      ownerWriteGraceMs,
      isProcessAlive
    });
    if (reclaimed) continue;

    const elapsedMs = now() - startedAt;
    if (elapsedMs >= timeoutMs) {
      throw new BrowserSmokeLeaseTimeoutError(lockPath, timeoutMs);
    }

    await sleep(Math.min(pollIntervalMs, timeoutMs - elapsedMs), undefined, {
      signal
    });
  }
}

export function classifyGeometryReliabilityRun({
  notRun,
  phases = {},
  displaySloMs = 30_000,
  exactSloMs = 60_000,
  pendingVisibleBudgetMs = 100,
  heartbeat = {},
  heartbeatGapLimitMs = 1_000,
  interactionChecks = [],
  requiredInteractionIds = V18_GEOMETRY_RELIABILITY_REQUIRED_INTERACTION_IDS,
  targetFailures = [],
  exceptions = [],
  consoleErrors = [],
  memoryEventDelta = {},
  memoryEventResetKeys = [],
  oomAttributedToBrowser = false
} = {}) {
  if (notRun) {
    return {
      status: "not-run",
      ok: false,
      reasonCode: notRun.code,
      reason: notRun.reason,
      failures: []
    };
  }

  if (memoryEventResetKeys.length > 0) {
    return {
      status: "not-run",
      ok: false,
      reasonCode: "memory-event-counter-reset",
      reason: `Cgroup memory counters reset during the run: ${memoryEventResetKeys.join(", ")}.`,
      failures: []
    };
  }

  const oomCount = memoryEventDelta.oom ?? 0;
  const oomKillCount = memoryEventDelta.oom_kill ?? 0;
  if ((oomCount > 0 || oomKillCount > 0) && !oomAttributedToBrowser) {
    return {
      status: "not-run",
      ok: false,
      reasonCode: "unattributed-memory-pressure",
      reason:
        "The containing cgroup recorded OOM activity that was not attributed to the browser process set.",
      failures: []
    };
  }

  const failures = [];
  requirePhase(
    failures,
    phases,
    "commandCommittedMs",
    "command-commit-missing"
  );
  requirePhase(failures, phases, "pendingVisibleMs", "pending-visible-missing");
  requirePhase(failures, phases, "displayReadyMs", "display-ready-missing");
  requirePhase(failures, phases, "exactReadyMs", "exact-ready-missing");
  addPhaseOrderFailures(failures, phases);

  if (
    finiteTimestamp(phases.commandCommittedMs) &&
    finiteTimestamp(phases.pendingVisibleMs) &&
    phases.pendingVisibleMs - phases.commandCommittedMs > pendingVisibleBudgetMs
  ) {
    failures.push({
      code: "pending-visible-late",
      message: `Pending feedback took ${formatDuration(phases.pendingVisibleMs - phases.commandCommittedMs)}, exceeding ${formatDuration(pendingVisibleBudgetMs)}.`
    });
  }

  addSloFailure(
    failures,
    phases.commandCommittedMs,
    phases.displayReadyMs,
    displaySloMs,
    "display-slo-exceeded",
    "Display readiness"
  );
  addSloFailure(
    failures,
    phases.commandCommittedMs,
    phases.exactReadyMs,
    exactSloMs,
    "exact-slo-exceeded",
    "Exact readiness"
  );

  if (!Number.isFinite(heartbeat.maxGapMs)) {
    failures.push({
      code: "heartbeat-missing",
      message: "Main-thread heartbeat telemetry was not recorded."
    });
  } else if (heartbeat.maxGapMs >= heartbeatGapLimitMs) {
    failures.push({
      code: "heartbeat-gap-exceeded",
      message: `Main-thread heartbeat gap ${formatDuration(heartbeat.maxGapMs)} reached the ${formatDuration(heartbeatGapLimitMs)} limit.`
    });
  }

  for (const check of interactionChecks) {
    if (!check.ok) {
      failures.push({
        code: `interaction-${check.id}`,
        message: check.detail ?? `Interaction ${check.id} failed.`
      });
    }
  }
  for (const requiredId of requiredInteractionIds) {
    if (!interactionChecks.some((check) => check.id === requiredId)) {
      failures.push({
        code: `interaction-${requiredId}-missing`,
        message: `Required interaction ${requiredId} was not recorded.`
      });
    }
  }

  for (const failure of targetFailures) {
    failures.push({
      code: failure.code ?? "target-failure",
      message: failure.message ?? "A browser target failed."
    });
  }
  for (const message of exceptions) {
    failures.push({ code: "runtime-exception", message });
  }
  for (const message of consoleErrors) {
    failures.push({ code: "console-error", message });
  }
  if ((oomCount > 0 || oomKillCount > 0) && oomAttributedToBrowser) {
    failures.push({
      code: "browser-oom",
      message: `The browser process set was attributed new cgroup OOM activity (oom=${oomCount}, oom_kill=${oomKillCount}).`
    });
  }

  return {
    status: failures.length === 0 ? "pass" : "fail",
    ok: failures.length === 0,
    failures,
    phases,
    heartbeat,
    interactionChecks,
    memoryEventDelta
  };
}

export function formatGeometryReliabilitySummary(result) {
  if (result.status === "not-run") {
    return [
      "V18 geometry reliability smoke NOT RUN",
      `- ${result.reasonCode}: ${result.reason}`
    ].join("\n");
  }

  const lines = [
    `V18 geometry reliability smoke ${result.status === "pass" ? "passed" : "failed"}`
  ];
  if (result.phases?.commandCommittedMs !== undefined) {
    lines.push(
      `- display ${formatElapsed(result.phases.commandCommittedMs, result.phases.displayReadyMs)}`,
      `- exact ${formatElapsed(result.phases.commandCommittedMs, result.phases.exactReadyMs)}`
    );
  }
  if (Number.isFinite(result.heartbeat?.maxGapMs)) {
    lines.push(
      `- heartbeat max gap ${formatDuration(result.heartbeat.maxGapMs)}`
    );
  }
  for (const failure of result.failures ?? []) {
    lines.push(`- fail ${failure.code}: ${failure.message}`);
  }
  return lines.join("\n");
}

async function reclaimStaleLease({
  lockPath,
  ownerPath,
  hostname,
  now,
  ownerWriteGraceMs,
  isProcessAlive
}) {
  const owner = await readLeaseOwner(ownerPath);
  if (!owner) {
    const info = await stat(lockPath).catch(() => undefined);
    if (!info || now() - info.mtimeMs < ownerWriteGraceMs) return false;
  } else {
    if (owner.hostname !== hostname || isProcessAlive(owner.pid)) return false;
  }

  const stalePath = `${lockPath}.stale-${randomUUID()}`;
  try {
    await rename(lockPath, stalePath);
  } catch (error) {
    if (error?.code === "ENOENT") return true;
    return false;
  }
  await rm(stalePath, { recursive: true, force: true });
  return true;
}

async function releaseOwnedLease(lockPath, owner) {
  const currentOwner = await readLeaseOwner(resolve(lockPath, "owner.json"));
  if (currentOwner?.token !== owner.token) return false;

  const releasedPath = `${lockPath}.released-${randomUUID()}`;
  try {
    await rename(lockPath, releasedPath);
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
  await rm(releasedPath, { recursive: true, force: true });
  return true;
}

async function readLeaseOwner(ownerPath) {
  try {
    const value = JSON.parse(await readFile(ownerPath, "utf8"));
    return Number.isInteger(value.pid) &&
      typeof value.hostname === "string" &&
      typeof value.token === "string"
      ? value
      : undefined;
  } catch {
    return undefined;
  }
}

function defaultIsProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

function parseOptionalCgroupMemoryValue(source) {
  return source === undefined ? undefined : parseCgroupMemoryValue(source);
}

async function readOptionalText(path) {
  try {
    return await readFile(path, "utf8");
  } catch {
    return undefined;
  }
}

function finiteNonNegative(value) {
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

function requirePhase(failures, phases, key, code) {
  if (!finiteTimestamp(phases[key])) {
    failures.push({ code, message: `Required phase ${key} was not recorded.` });
  }
}

function addPhaseOrderFailures(failures, phases) {
  const committedAt = phases.commandCommittedMs;
  if (!finiteTimestamp(committedAt)) return;

  for (const [key, label] of [
    ["pendingVisibleMs", "Pending feedback"],
    ["displayReadyMs", "Display readiness"],
    ["exactReadyMs", "Exact readiness"]
  ]) {
    if (finiteTimestamp(phases[key]) && phases[key] < committedAt) {
      failures.push({
        code: `${key}-before-command-commit`,
        message: `${label} was recorded before command commit.`
      });
    }
  }

  if (
    finiteTimestamp(phases.pendingVisibleMs) &&
    finiteTimestamp(phases.displayReadyMs) &&
    phases.displayReadyMs < phases.pendingVisibleMs
  ) {
    failures.push({
      code: "display-ready-before-pending",
      message: "Display readiness was recorded before pending feedback."
    });
  }
}

function finiteTimestamp(value) {
  return Number.isFinite(value) && value >= 0;
}

function addSloFailure(failures, startedAt, completedAt, limitMs, code, label) {
  if (!finiteTimestamp(startedAt) || !finiteTimestamp(completedAt)) return;
  const elapsedMs = completedAt - startedAt;
  if (elapsedMs > limitMs) {
    failures.push({
      code,
      message: `${label} took ${formatDuration(elapsedMs)}, exceeding ${formatDuration(limitMs)}.`
    });
  }
}

function formatElapsed(startedAt, completedAt) {
  return finiteTimestamp(completedAt)
    ? formatDuration(completedAt - startedAt)
    : "not recorded";
}

function formatDuration(value) {
  return `${Number(value).toFixed(1)} ms`;
}

function formatBytes(value) {
  return `${(value / (1024 * 1024)).toFixed(1)} MiB`;
}
