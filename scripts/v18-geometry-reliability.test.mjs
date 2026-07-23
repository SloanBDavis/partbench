import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  BrowserSmokeLeaseTimeoutError,
  acquireBrowserSmokeLease,
  classifyFinalGeometryReliabilityRun,
  classifyGeometryReliabilityRun,
  computeIncrementalMemoryPeak,
  diffMemoryEvents,
  evaluateResourceAdmission,
  formatGeometryReliabilitySummary,
  parseCgroupMemoryEvents,
  parseCgroupMemoryValue,
  parseCgroupV2Membership,
  parseLinuxMeminfo,
  readLinuxMemoryEnvironment,
  resolveCgroupV2Directory,
  validateWorkerJobEvidence
} from "./v18-geometry-reliability.mjs";

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true }))
  );
});

describe("V18 geometry reliability resource accounting", () => {
  it("requires complete post-commit display and exact worker evidence for one source", () => {
    const event = (timestamp, intent, phase, runId, sourceId = "body_1") => ({
      phase: "worker-job",
      timestamp,
      job: { intent, phase, runId, sourceId }
    });
    const events = [
      event(9, "display", "settled", 0, "stale"),
      event(11, "display", "queued", 1),
      event(12, "display", "started", 1),
      event(13, "display", "settled", 1),
      event(14, "exact", "queued", 2),
      event(15, "exact", "started", 2),
      event(16, "exact", "settled", 2)
    ];

    expect(validateWorkerJobEvidence(events, "body_1", 10)).toEqual([]);
    expect(
      validateWorkerJobEvidence(events.slice(0, -1), "body_1", 10)
    ).toEqual([
      expect.objectContaining({ code: "worker-exact-evidence-missing" })
    ]);
  });

  it("combines auditable current samples with cgroup peak growth", () => {
    expect(
      computeIncrementalMemoryPeak(
        { cgroup: { currentBytes: 100, peakBytes: 500 } },
        [
          { cgroup: { currentBytes: 140, peakBytes: 500 } },
          { cgroup: { currentBytes: 120, peakBytes: 590 } }
        ]
      )
    ).toEqual({
      sampledCurrentPeakBytes: 140,
      sampledCurrentIncreaseBytes: 40,
      finalCgroupPeakBytes: 590,
      cgroupPeakIncreaseBytes: 90,
      incrementalPeakBytes: 90
    });
  });

  it("reclassifies terminal results from comparable final memory counters", () => {
    const base = {
      cgroup: {
        eventsSource: "memory.events.local",
        events: { oom: 0, oom_kill: 0 }
      }
    };
    const classification = classifyFinalGeometryReliabilityRun({
      memoryBefore: base,
      memoryAfter: {
        cgroup: {
          eventsSource: "memory.events.local",
          events: { oom: 1, oom_kill: 0 }
        }
      },
      phases: {
        commandCommittedMs: 1,
        pendingVisibleMs: 2,
        displayReadyMs: 3,
        exactReadyMs: 4
      },
      heartbeat: { maxGapMs: 10 },
      requiredInteractionIds: []
    });

    expect(classification.result).toMatchObject({
      status: "not-run",
      reasonCode: "unattributed-memory-pressure"
    });
    expect(classification.memoryEvents?.deltas).toMatchObject({ oom: 1 });
  });

  it("rejects memory counters whose source changes during the run", () => {
    const classification = classifyFinalGeometryReliabilityRun({
      memoryBefore: {
        cgroup: {
          eventsSource: "memory.events.local",
          events: { oom: 0 }
        }
      },
      memoryAfter: {
        cgroup: { eventsSource: "memory.events", events: { oom: 0 } }
      }
    });

    expect(classification.result).toMatchObject({
      status: "not-run",
      reasonCode: "memory-event-accounting-unavailable"
    });
    expect(classification.memoryEvents).toBeUndefined();
  });

  it("parses Linux host and cgroup-v2 accounting without treating max as zero", () => {
    expect(
      parseLinuxMeminfo(`
MemTotal:       3900000 kB
MemAvailable:   2100000 kB
SwapTotal:             0 kB
SwapFree:              0 kB
`)
    ).toEqual({
      memTotalBytes: 3_993_600_000,
      memAvailableBytes: 2_150_400_000,
      swapTotalBytes: 0,
      swapFreeBytes: 0
    });
    expect(parseCgroupV2Membership("0::/runner/job\n")).toBe("/runner/job");
    expect(parseCgroupMemoryValue("max\n")).toBeNull();
    expect(parseCgroupMemoryValue("1073741824\n")).toBe(1_073_741_824);
    expect(parseCgroupMemoryValue("invalid\n")).toBeUndefined();
    expect(parseCgroupMemoryEvents("low 1\noom 2\noom_kill 1\n")).toEqual({
      low: 1,
      oom: 2,
      oom_kill: 1
    });
  });

  it("rejects cgroup paths that could escape the accounting root", () => {
    expect(resolveCgroupV2Directory("/sys/fs/cgroup", "/runner/job")).toBe(
      "/sys/fs/cgroup/runner/job"
    );
    expect(
      resolveCgroupV2Directory("/sys/fs/cgroup", "/../../etc")
    ).toBeUndefined();
    expect(
      resolveCgroupV2Directory("/sys/fs/cgroup", "runner/job")
    ).toBeUndefined();
  });

  it("reads a synthetic cgroup environment and retains unlimited limits", async () => {
    const root = await createTemporaryDirectory();
    const procRoot = join(root, "proc");
    const cgroupRoot = join(root, "cgroup");
    await import("node:fs/promises").then(async ({ mkdir, writeFile }) => {
      await mkdir(join(procRoot, "self"), { recursive: true });
      await mkdir(join(cgroupRoot, "job"), { recursive: true });
      await writeFile(
        join(procRoot, "meminfo"),
        "MemTotal: 4096 kB\nMemAvailable: 2048 kB\n"
      );
      await writeFile(join(procRoot, "self/cgroup"), "0::/job\n");
      await writeFile(join(cgroupRoot, "job/memory.current"), "1024\n");
      await writeFile(join(cgroupRoot, "job/memory.peak"), "2048\n");
      await writeFile(join(cgroupRoot, "job/memory.max"), "max\n");
      await writeFile(
        join(cgroupRoot, "job/memory.events.local"),
        "oom 0\noom_kill 0\n"
      );
    });

    await expect(
      readLinuxMemoryEnvironment({ procRoot, cgroupRoot })
    ).resolves.toMatchObject({
      accountingAvailable: true,
      host: { memAvailableBytes: 2_097_152 },
      cgroup: {
        membershipPath: "/job",
        currentBytes: 1024,
        peakBytes: 2048,
        maxBytes: null,
        events: { oom: 0, oom_kill: 0 }
      }
    });
  });

  it("uses the smaller host/cgroup headroom and the upper-bound policy", () => {
    expect(
      evaluateResourceAdmission({
        hostAvailableBytes: 5_000,
        cgroupCurrentBytes: 2_000,
        cgroupMaxBytes: 6_000,
        perBrowserIncrementalPeakUpperBoundBytes: 1_500,
        concurrency: 2,
        reserveBytes: 500
      })
    ).toMatchObject({
      status: "admitted",
      usableBytes: 4_000,
      requiredBytes: 3_500
    });

    expect(
      evaluateResourceAdmission({
        hostAvailableBytes: 5_000,
        cgroupCurrentBytes: 2_000,
        cgroupMaxBytes: 5_000,
        perBrowserIncrementalPeakUpperBoundBytes: 1_500,
        concurrency: 2,
        reserveBytes: 500
      })
    ).toMatchObject({
      status: "not-run",
      reasonCode: "insufficient-memory-headroom",
      usableBytes: 3_000
    });
  });

  it("does not admit work when memory accounting is unavailable", () => {
    expect(
      evaluateResourceAdmission({
        perBrowserIncrementalPeakUpperBoundBytes: 1_500,
        concurrency: 1,
        reserveBytes: 500
      })
    ).toMatchObject({
      status: "not-run",
      reasonCode: "memory-accounting-unavailable"
    });
  });

  it("diffs monotonic events and reports a counter reset", () => {
    expect(
      diffMemoryEvents(
        { low: 2, oom: 4, oom_kill: 2 },
        { low: 5, oom: 1, oom_kill: 3 }
      )
    ).toEqual({
      deltas: { low: 3, oom: 1, oom_kill: 1 },
      resetKeys: ["oom"]
    });
  });
});

describe("V18 browser smoke shared lease", () => {
  it("excludes a second live owner and reports a structured timeout", async () => {
    const lockPath = join(await createTemporaryDirectory(), "browser.lock");
    const first = await acquireBrowserSmokeLease({
      lockPath,
      hostname: "test-host",
      pid: 101,
      token: "owner-one"
    });

    await expect(
      acquireBrowserSmokeLease({
        lockPath,
        hostname: "test-host",
        pid: 202,
        token: "owner-two",
        timeoutMs: 5,
        pollIntervalMs: 1,
        isProcessAlive: () => true
      })
    ).rejects.toMatchObject({
      name: "BrowserSmokeLeaseTimeoutError",
      code: "BROWSER_SMOKE_LEASE_TIMEOUT"
    });
    expect(await first.release()).toBe(true);
    expect(await first.release()).toBe(false);
  });

  it("reclaims a dead local owner but never a live or remote owner", async () => {
    const root = await createTemporaryDirectory();
    const deadPath = join(root, "dead.lock");
    await acquireBrowserSmokeLease({
      lockPath: deadPath,
      hostname: "test-host",
      pid: 101,
      token: "dead-owner"
    });
    const replacement = await acquireBrowserSmokeLease({
      lockPath: deadPath,
      hostname: "test-host",
      pid: 202,
      token: "replacement",
      timeoutMs: 20,
      pollIntervalMs: 1,
      isProcessAlive: (pid) => pid !== 101
    });
    expect(
      JSON.parse(await readFile(join(deadPath, "owner.json"), "utf8"))
    ).toMatchObject({ pid: 202, token: "replacement" });
    await replacement.release();

    const remotePath = join(root, "remote.lock");
    await acquireBrowserSmokeLease({
      lockPath: remotePath,
      hostname: "remote-host",
      pid: 303,
      token: "remote-owner"
    });
    await expect(
      acquireBrowserSmokeLease({
        lockPath: remotePath,
        hostname: "test-host",
        pid: 404,
        token: "local-owner",
        timeoutMs: 2,
        pollIntervalMs: 1,
        isProcessAlive: () => false
      })
    ).rejects.toBeInstanceOf(BrowserSmokeLeaseTimeoutError);
  });
});

describe("V18 geometry reliability result classification", () => {
  const passingInput = {
    phases: {
      commandCommittedMs: 100,
      pendingVisibleMs: 116,
      displayReadyMs: 3_000,
      exactReadyMs: 5_000
    },
    heartbeat: { maxGapMs: 32 },
    interactionChecks: [
      { id: "pending-document-tree", ok: true },
      { id: "pending-command-search", ok: true },
      { id: "pending-fit-all", ok: true },
      { id: "ready-document-tree", ok: true },
      { id: "ready-command-search", ok: true },
      { id: "ready-fit-all", ok: true }
    ]
  };

  it("passes only a complete, responsive, terminal run", () => {
    const result = classifyGeometryReliabilityRun(passingInput);
    expect(result).toMatchObject({ status: "pass", ok: true, failures: [] });
    expect(formatGeometryReliabilitySummary(result)).toContain(
      "V18 geometry reliability smoke passed"
    );
  });

  it("fails missing phases, SLOs, heartbeat, interactions, and browser-attributed OOM", () => {
    const result = classifyGeometryReliabilityRun({
      phases: {
        commandCommittedMs: 0,
        pendingVisibleMs: 250,
        displayReadyMs: 31_000
      },
      exactSloMs: 10_000,
      heartbeat: { maxGapMs: 1_000 },
      interactionChecks: [
        { id: "pending-search", ok: false, detail: "Search timed out." }
      ],
      targetFailures: [{ code: "page-crash", message: "Page crashed." }],
      memoryEventDelta: { oom: 1 },
      oomAttributedToBrowser: true
    });

    expect(result.status).toBe("fail");
    expect(result.failures.map((failure) => failure.code)).toEqual(
      expect.arrayContaining([
        "exact-ready-missing",
        "pending-visible-late",
        "display-slo-exceeded",
        "heartbeat-gap-exceeded",
        "interaction-pending-search",
        "page-crash",
        "browser-oom"
      ])
    );
    expect(formatGeometryReliabilitySummary(result)).toContain(
      "- fail browser-oom:"
    );
  });

  it("classifies unattributed OOM pressure and explicit admission skips as not run", () => {
    expect(
      classifyGeometryReliabilityRun({
        ...passingInput,
        memoryEventDelta: { oom_kill: 1 }
      })
    ).toMatchObject({
      status: "not-run",
      ok: false,
      reasonCode: "unattributed-memory-pressure"
    });

    const result = classifyGeometryReliabilityRun({
      notRun: {
        code: "insufficient-memory-headroom",
        reason: "Only 1 GiB is available."
      }
    });
    expect(result).toMatchObject({ status: "not-run", ok: false });
    expect(formatGeometryReliabilitySummary(result)).toBe(
      [
        "V18 geometry reliability smoke NOT RUN",
        "- insufficient-memory-headroom: Only 1 GiB is available."
      ].join("\n")
    );
  });

  it("rejects missing heartbeat, interactions, invalid phase order, and reset counters", () => {
    const failed = classifyGeometryReliabilityRun({
      phases: {
        commandCommittedMs: 100,
        pendingVisibleMs: 90,
        displayReadyMs: 80,
        exactReadyMs: 200
      }
    });
    expect(failed.failures.map((failure) => failure.code)).toEqual(
      expect.arrayContaining([
        "heartbeat-missing",
        "pendingVisibleMs-before-command-commit",
        "displayReadyMs-before-command-commit",
        "display-ready-before-pending",
        "interaction-pending-document-tree-missing",
        "interaction-ready-fit-all-missing"
      ])
    );

    expect(
      classifyGeometryReliabilityRun({
        ...passingInput,
        memoryEventResetKeys: ["oom"]
      })
    ).toMatchObject({
      status: "not-run",
      reasonCode: "memory-event-counter-reset"
    });
  });
});

async function createTemporaryDirectory() {
  const directory = await mkdtemp(join(tmpdir(), "partbench-v18-geometry-"));
  temporaryDirectories.push(directory);
  return directory;
}
