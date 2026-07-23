import type {
  GeometryWorkerDiagnostics,
  GeometryWorkerRequest,
  GeometryWorkerResponse
} from "@web-cad/geometry-worker";
import type { BrowserGeometryWorkerExecutionCallbacks } from "./browserGeometryWorker";

export type GeometryDerivedJobIntent = "display" | "exact";
export type GeometryUserJobKind =
  | "preflight"
  | "import"
  | "export"
  | "checkpoint";

export interface GeometryDerivedJobDescriptor {
  readonly intent: GeometryDerivedJobIntent;
  readonly sourceId: string;
  readonly documentRevision: number;
  readonly cacheKey: string;
}

export interface GeometryUserJobDescriptor {
  readonly intent: "user";
  readonly userKind: GeometryUserJobKind;
}

export type GeometryJobDescriptor =
  | GeometryDerivedJobDescriptor
  | GeometryUserJobDescriptor;

export interface GeometryJobSchedulerWorker {
  executeTracked<TPayload extends GeometryWorkerRequest["payload"]>(
    request: GeometryWorkerRequest<TPayload>,
    callbacks?: BrowserGeometryWorkerExecutionCallbacks
  ): Promise<GeometryWorkerResponse<TPayload>>;
  dispose(): void;
}

export type GeometryJobSchedulerWorkerFactory = () =>
  | GeometryJobSchedulerWorker
  | Promise<GeometryJobSchedulerWorker>;

export type GeometryJobEventPhase =
  | "queued"
  | "started"
  | "settled"
  | "superseded"
  | "cancelled";

export interface GeometryJobEvent {
  readonly phase: GeometryJobEventPhase;
  readonly runId: number;
  readonly generation: number;
  readonly intent: GeometryJobDescriptor["intent"];
  readonly operation: GeometryWorkerRequest["payload"]["op"];
  readonly sourceId?: string;
  readonly documentRevision?: number;
  readonly cacheKey?: string;
  readonly userKind?: GeometryUserJobKind;
  readonly queueMs?: number;
  readonly executionMs?: number;
  readonly outcome?: "ready" | "failed";
}

export interface GeometryJobSchedulerSnapshot {
  readonly generation: number;
  readonly stopped: boolean;
  readonly disposed: boolean;
  readonly queuedUserCount: number;
  readonly queuedDisplayCount: number;
  readonly queuedExactCount: number;
  readonly inFlightRunId?: number;
  readonly cancelledUserKinds: readonly GeometryUserJobKind[];
}

export interface GeometryJobSchedulerOptions {
  readonly createWorker?: GeometryJobSchedulerWorkerFactory;
  readonly maxConsecutiveDisplayJobs?: number;
  readonly workerEntryTimeoutMs?: number;
  readonly now?: () => number;
  readonly onEvent?: (event: GeometryJobEvent) => void;
}

interface PendingGeometryJob {
  readonly descriptor: GeometryJobDescriptor;
  readonly generation: number;
  readonly queuedAt: number;
  readonly request: GeometryWorkerRequest;
  readonly runId: number;
  readonly resolve: (response: GeometryWorkerResponse) => void;
  readonly reject: (error: Error) => void;
  settled: boolean;
  startedAt?: number;
}

export class GeometryJobSupersededError extends Error {
  readonly code = "GEOMETRY_JOB_SUPERSEDED";

  constructor() {
    super("A newer geometry revision superseded this queued request.");
    this.name = "GeometryJobSupersededError";
  }
}

export class GeometryJobGenerationError extends Error {
  readonly code = "GEOMETRY_JOB_GENERATION_CANCELLED";
  readonly generation: number;

  constructor(generation: number, message: string) {
    super(message);
    this.name = "GeometryJobGenerationError";
    this.generation = generation;
  }
}

export class GeometryJobEntryTimeoutError extends Error {
  readonly code = "GEOMETRY_JOB_ENTRY_TIMEOUT";

  constructor(timeoutMs: number) {
    super(
      `The geometry worker did not acknowledge the request within ${timeoutMs} ms.`
    );
    this.name = "GeometryJobEntryTimeoutError";
  }
}

export class GeometryJobScheduler {
  readonly #createWorker: GeometryJobSchedulerWorkerFactory;
  readonly #maxConsecutiveDisplayJobs: number;
  readonly #workerEntryTimeoutMs: number | undefined;
  readonly #now: () => number;
  readonly #onEvent: ((event: GeometryJobEvent) => void) | undefined;
  readonly #listeners = new Set<() => void>();
  readonly #latestDerived = new Map<string, GeometryDerivedJobDescriptor>();
  readonly #queues: Record<
    GeometryJobDescriptor["intent"],
    PendingGeometryJob[]
  > = {
    user: [],
    display: [],
    exact: []
  };
  #generation = 1;
  #nextRunId = 1;
  #consecutiveDisplayJobs = 0;
  #inFlight: PendingGeometryJob | undefined;
  #worker: GeometryJobSchedulerWorker | undefined;
  #workerPromise:
    | {
        generation: number;
        promise: Promise<GeometryJobSchedulerWorker>;
      }
    | undefined;
  #stopped = false;
  #disposed = false;
  readonly #cancelledUserKinds = new Set<GeometryUserJobKind>();

  constructor(options: GeometryJobSchedulerOptions = {}) {
    this.#createWorker = options.createWorker ?? createBrowserWorker;
    this.#maxConsecutiveDisplayJobs = Math.max(
      1,
      Math.floor(options.maxConsecutiveDisplayJobs ?? 4)
    );
    this.#workerEntryTimeoutMs = normalizeTimeout(options.workerEntryTimeoutMs);
    this.#now = options.now ?? (() => performance.now());
    this.#onEvent = options.onEvent;
  }

  execute<TPayload extends GeometryWorkerRequest["payload"]>(
    descriptor: GeometryJobDescriptor,
    request: GeometryWorkerRequest<TPayload>
  ): Promise<GeometryWorkerResponse<TPayload>> {
    if (this.#disposed) {
      return Promise.reject(
        new GeometryJobGenerationError(
          this.#generation,
          "The geometry scheduler has been disposed."
        )
      );
    }

    if (this.#stopped) {
      return Promise.reject(
        new GeometryJobGenerationError(
          this.#generation,
          "The geometry worker is stopped until model results are retried."
        )
      );
    }

    if (descriptor.intent !== "user") {
      const key = `${descriptor.intent}:${descriptor.sourceId}`;
      const latest = this.#latestDerived.get(key);
      if (
        latest &&
        (descriptor.documentRevision < latest.documentRevision ||
          (descriptor.documentRevision === latest.documentRevision &&
            descriptor.cacheKey !== latest.cacheKey))
      ) {
        return Promise.reject(new GeometryJobSupersededError());
      }
      this.#latestDerived.set(key, descriptor);
    } else if (this.#cancelledUserKinds.delete(descriptor.userKind)) {
      this.#notify();
    }

    return new Promise<GeometryWorkerResponse<TPayload>>((resolve, reject) => {
      const job: PendingGeometryJob = {
        descriptor,
        generation: this.#generation,
        queuedAt: this.#now(),
        request,
        runId: this.#nextRunId,
        resolve: (response) =>
          resolve(response as GeometryWorkerResponse<TPayload>),
        reject,
        settled: false
      };
      this.#nextRunId += 1;

      this.#coalesceQueuedDerivedJob(job);
      this.#queues[descriptor.intent].push(job);
      this.#emit(job, "queued");
      this.#notify();
      this.#drain();
    });
  }

  cancelGeneration(message = "Geometry model work was cancelled."): number {
    if (this.#disposed || this.#stopped) {
      return this.#generation;
    }

    const cancelledGeneration = this.#generation;
    const error = new GeometryJobGenerationError(cancelledGeneration, message);
    const cancelledJobs = [
      ...(this.#inFlight ? [this.#inFlight] : []),
      ...this.#queues.user,
      ...this.#queues.display,
      ...this.#queues.exact
    ];
    for (const job of cancelledJobs) {
      if (job.descriptor.intent === "user") {
        this.#cancelledUserKinds.add(job.descriptor.userKind);
      }
    }
    this.#generation += 1;
    this.#stopped = true;
    this.#consecutiveDisplayJobs = 0;

    if (this.#inFlight) {
      this.#emit(this.#inFlight, "cancelled", { outcome: "failed" });
      settleRejected(this.#inFlight, error);
      this.#inFlight = undefined;
    }

    for (const queue of Object.values(this.#queues)) {
      for (const job of queue.splice(0)) {
        this.#emit(job, "cancelled", { outcome: "failed" });
        settleRejected(job, error);
      }
    }

    this.#disposeWorker();
    this.#notify();
    return this.#generation;
  }

  resumeGeneration(): number {
    if (this.#disposed) {
      throw new GeometryJobGenerationError(
        this.#generation,
        "The geometry scheduler has been disposed."
      );
    }

    if (this.#stopped) {
      this.#stopped = false;
      this.#notify();
      this.#drain();
    }

    return this.#generation;
  }

  invalidateDerived(
    intent: GeometryDerivedJobIntent,
    sourceId: string,
    documentRevision = 0
  ): void {
    const key = `${intent}:${sourceId}`;
    const latest = this.#latestDerived.get(key);
    if (!latest || latest.documentRevision <= documentRevision) {
      this.#latestDerived.set(key, {
        intent,
        sourceId,
        documentRevision,
        cacheKey: "invalidated"
      });
    }
    const queue = this.#queues[intent];
    for (let index = queue.length - 1; index >= 0; index -= 1) {
      const job = queue[index];
      if (
        job?.descriptor.intent !== intent ||
        job.descriptor.sourceId !== sourceId
      )
        continue;
      queue.splice(index, 1);
      this.#emit(job, "superseded", { outcome: "failed" });
      settleRejected(job, new GeometryJobSupersededError());
    }
    this.#notify();
  }

  getSnapshot(): GeometryJobSchedulerSnapshot {
    return {
      generation: this.#generation,
      stopped: this.#stopped,
      disposed: this.#disposed,
      queuedUserCount: this.#queues.user.length,
      queuedDisplayCount: this.#queues.display.length,
      queuedExactCount: this.#queues.exact.length,
      cancelledUserKinds: [...this.#cancelledUserKinds],
      ...(this.#inFlight ? { inFlightRunId: this.#inFlight.runId } : {})
    };
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  dispose(): void {
    if (this.#disposed) {
      return;
    }

    this.cancelGeneration("The geometry scheduler was disposed.");
    this.#disposed = true;
    this.#listeners.clear();
  }

  #coalesceQueuedDerivedJob(next: PendingGeometryJob): void {
    if (next.descriptor.intent === "user") {
      return;
    }

    const queue = this.#queues[next.descriptor.intent];
    for (let index = queue.length - 1; index >= 0; index -= 1) {
      const candidate = queue[index];
      if (
        candidate?.descriptor.intent === next.descriptor.intent &&
        candidate.descriptor.sourceId === next.descriptor.sourceId
      ) {
        queue.splice(index, 1);
        this.#emit(candidate, "superseded", { outcome: "failed" });
        settleRejected(candidate, new GeometryJobSupersededError());
      }
    }
  }

  #drain(): void {
    if (this.#disposed || this.#stopped || this.#inFlight !== undefined) {
      return;
    }

    const job = this.#takeNextJob();
    if (!job) {
      return;
    }

    this.#inFlight = job;
    this.#notify();
    void this.#run(job);
  }

  #takeNextJob(): PendingGeometryJob | undefined {
    const user = this.#queues.user.shift();
    if (user) {
      return user;
    }

    if (
      this.#queues.exact.length > 0 &&
      (this.#queues.display.length === 0 ||
        this.#consecutiveDisplayJobs >= this.#maxConsecutiveDisplayJobs)
    ) {
      this.#consecutiveDisplayJobs = 0;
      return this.#queues.exact.shift();
    }

    const display = this.#queues.display.shift();
    if (display) {
      this.#consecutiveDisplayJobs += 1;
      return display;
    }

    this.#consecutiveDisplayJobs = 0;
    return this.#queues.exact.shift();
  }

  async #run(job: PendingGeometryJob): Promise<void> {
    let entryTimer: ReturnType<typeof setTimeout> | undefined;

    try {
      const worker = await this.#getWorker(job.generation);
      if (!this.#canPublish(job)) {
        return;
      }

      let started = false;
      if (this.#workerEntryTimeoutMs !== undefined) {
        entryTimer = setTimeout(() => {
          if (started || !this.#canPublish(job)) {
            return;
          }

          const timeout = new GeometryJobEntryTimeoutError(
            this.#workerEntryTimeoutMs!
          );
          this.#cancelForFailure(job, timeout);
        }, this.#workerEntryTimeoutMs);
      }

      const response = await worker.executeTracked(job.request, {
        onStarted: () => {
          if (started || !this.#canPublish(job)) {
            return;
          }
          started = true;
          job.startedAt = this.#now();
          if (entryTimer !== undefined) {
            clearTimeout(entryTimer);
            entryTimer = undefined;
          }
          this.#emit(job, "started", {
            queueMs: Math.max(0, job.startedAt - job.queuedAt)
          });
        }
      });

      if (!this.#canPublish(job)) {
        return;
      }

      if (
        !response.response.ok &&
        isFatalWorkerDiagnostics(response.diagnostics)
      ) {
        this.#cancelForFailure(job, new Error(response.response.error.message));
        return;
      }

      this.#emit(job, "settled", {
        outcome: response.response.ok ? "ready" : "failed",
        ...(job.startedAt !== undefined
          ? { executionMs: Math.max(0, this.#now() - job.startedAt) }
          : {})
      });
      settleResolved(job, response);
    } catch (error) {
      if (!this.#canPublish(job)) {
        return;
      }

      const normalized = normalizeError(error);
      this.#emit(job, "settled", {
        outcome: "failed",
        ...(job.startedAt !== undefined
          ? { executionMs: Math.max(0, this.#now() - job.startedAt) }
          : {})
      });

      if (job.startedAt === undefined || isFatalWorkerError(error)) {
        this.#cancelForFailure(job, normalized);
      } else {
        settleRejected(job, normalized);
      }
    } finally {
      if (entryTimer !== undefined) {
        clearTimeout(entryTimer);
      }
      if (this.#inFlight === job) {
        this.#inFlight = undefined;
      }
      this.#notify();
      this.#drain();
    }
  }

  async #getWorker(generation: number): Promise<GeometryJobSchedulerWorker> {
    if (this.#worker) {
      return this.#worker;
    }

    if (!this.#workerPromise || this.#workerPromise.generation !== generation) {
      const promise = Promise.resolve(this.#createWorker()).then((worker) => {
        if (
          this.#disposed ||
          this.#stopped ||
          generation !== this.#generation
        ) {
          worker.dispose();
          throw new GeometryJobGenerationError(
            generation,
            "The geometry worker generation ended during startup."
          );
        }
        this.#worker = worker;
        return worker;
      });
      this.#workerPromise = { generation, promise };
    }

    const workerPromise = this.#workerPromise.promise;
    try {
      return await workerPromise;
    } finally {
      if (this.#workerPromise?.promise === workerPromise) {
        this.#workerPromise = undefined;
      }
    }
  }

  #cancelForFailure(job: PendingGeometryJob, error: Error): void {
    if (!this.#canPublish(job)) {
      return;
    }

    settleRejected(job, error);
    this.cancelGeneration(error.message);
  }

  #canPublish(job: PendingGeometryJob): boolean {
    return (
      !job.settled &&
      !this.#disposed &&
      !this.#stopped &&
      job.generation === this.#generation &&
      this.#inFlight === job
    );
  }

  #disposeWorker(): void {
    this.#worker?.dispose();
    this.#worker = undefined;
  }

  #emit(
    job: PendingGeometryJob,
    phase: GeometryJobEventPhase,
    details: Pick<GeometryJobEvent, "executionMs" | "outcome" | "queueMs"> = {}
  ): void {
    if (!this.#onEvent) {
      return;
    }

    const descriptor = job.descriptor;
    this.#onEvent({
      phase,
      runId: job.runId,
      generation: job.generation,
      intent: descriptor.intent,
      operation: job.request.payload.op,
      ...(descriptor.intent === "user"
        ? { userKind: descriptor.userKind }
        : {
            sourceId: descriptor.sourceId,
            documentRevision: descriptor.documentRevision,
            cacheKey: descriptor.cacheKey
          }),
      ...details
    });
  }

  #notify(): void {
    for (const listener of this.#listeners) {
      listener();
    }
  }
}

async function createBrowserWorker(): Promise<GeometryJobSchedulerWorker> {
  const { BrowserGeometryWorker } = await import("./browserGeometryWorker");
  return new BrowserGeometryWorker();
}

function normalizeTimeout(value: number | undefined): number | undefined {
  return value !== undefined && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

function settleResolved(
  job: PendingGeometryJob,
  response: GeometryWorkerResponse
): void {
  if (job.settled) {
    return;
  }
  job.settled = true;
  job.resolve(response);
}

function settleRejected(job: PendingGeometryJob, error: Error): void {
  if (job.settled) {
    return;
  }
  job.settled = true;
  job.reject(error);
}

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error("Geometry worker failed.");
}

function isFatalWorkerError(
  error: unknown
): error is { readonly diagnostics: GeometryWorkerDiagnostics } {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const diagnostics = (error as { readonly diagnostics?: unknown }).diagnostics;
  if (typeof diagnostics !== "object" || diagnostics === null) {
    return false;
  }

  const stage = (diagnostics as GeometryWorkerDiagnostics).stage;
  return stage === "transport" || stage === "worker";
}

function isFatalWorkerDiagnostics(
  diagnostics: GeometryWorkerDiagnostics | undefined
): boolean {
  return diagnostics?.stage === "transport" || diagnostics?.stage === "worker";
}
