/**
 * The browser-owned lifecycle for one transient exact-feature preview.
 *
 * This deliberately stays below React and above the geometry/CAD boundaries:
 * callers provide the worker, current-context check, and result disposer.
 */

export interface ExactFeaturePreviewContext {
  readonly liveRevision: number;
  readonly sourceIdentity: string;
  readonly editorOwnership: string;
}

export interface ExactFeaturePreviewRequest<TInput> {
  readonly input: TInput;
  readonly context: ExactFeaturePreviewContext;
  readonly sequence: number;
}

export type ExactFeaturePreviewWorker<TInput, TResult> = (
  request: ExactFeaturePreviewRequest<TInput>,
  signal: AbortSignal,
  registerAllocatedResult: (result: TResult) => void
) => Promise<TResult>;

export type ExactFeaturePreviewCancelReason =
  | "replaced"
  | "explicit"
  | "cleared"
  | "stale"
  | "disposed";

export type ExactFeaturePreviewState<TInput, TResult> =
  | {
      readonly status: "idle";
    }
  | {
      readonly status: "pending";
      readonly sequence: number;
      readonly request: ExactFeaturePreviewRequest<TInput>;
    }
  | {
      readonly status: "ready";
      readonly sequence: number;
      readonly request: ExactFeaturePreviewRequest<TInput>;
      readonly result: TResult;
    }
  | {
      readonly status: "failed";
      readonly sequence: number;
      readonly request: ExactFeaturePreviewRequest<TInput>;
      readonly error: unknown;
    }
  | {
      readonly status: "cancelled";
      readonly sequence: number;
      readonly request: ExactFeaturePreviewRequest<TInput>;
      readonly reason: ExactFeaturePreviewCancelReason;
    }
  | {
      readonly status: "disposed";
    };

export type ExactFeaturePreviewJobOutcome<TResult> =
  | {
      readonly status: "ready";
      readonly sequence: number;
      readonly context: ExactFeaturePreviewContext;
      readonly result: TResult;
    }
  | {
      readonly status: "failed";
      readonly sequence: number;
      readonly context: ExactFeaturePreviewContext;
      readonly error: unknown;
    }
  | {
      readonly status: "cancelled";
      readonly sequence: number;
      readonly context: ExactFeaturePreviewContext;
      readonly reason: ExactFeaturePreviewCancelReason;
    };

export interface ExactFeaturePreviewJobHandle<TResult> {
  readonly sequence: number;
  readonly signal: AbortSignal;
  readonly promise: Promise<ExactFeaturePreviewJobOutcome<TResult>>;
  cancel(): void;
}

export interface ExactFeaturePreviewJobControllerOptions<TInput, TResult> {
  readonly worker: ExactFeaturePreviewWorker<TInput, TResult>;
  readonly isCurrent: (
    context: ExactFeaturePreviewContext,
    request: ExactFeaturePreviewRequest<TInput>
  ) => boolean;
  readonly disposeResult: (result: TResult) => void;
  readonly onStateChange?: (
    state: ExactFeaturePreviewState<TInput, TResult>
  ) => void;
}

interface AllocatedResult<TResult> {
  readonly value: TResult;
  released: boolean;
}

interface PreviewJob<TInput, TResult> {
  readonly sequence: number;
  readonly request: ExactFeaturePreviewRequest<TInput>;
  readonly abortController: AbortController;
  readonly allocations: AllocatedResult<TResult>[];
  readonly resolveOutcome: (
    outcome: ExactFeaturePreviewJobOutcome<TResult>
  ) => void;
  settled: boolean;
}

interface RetainedPreviewResult<TInput, TResult> {
  readonly job: PreviewJob<TInput, TResult>;
  readonly result: TResult;
}

export class ExactFeaturePreviewJobControllerDisposedError extends Error {
  readonly code = "EXACT_FEATURE_PREVIEW_CONTROLLER_DISPOSED";

  constructor() {
    super("The exact feature preview controller has been disposed.");
    this.name = "ExactFeaturePreviewJobControllerDisposedError";
  }
}

export class ExactFeaturePreviewJobController<TInput, TResult> {
  readonly #worker: ExactFeaturePreviewWorker<TInput, TResult>;
  readonly #isCurrent: ExactFeaturePreviewJobControllerOptions<
    TInput,
    TResult
  >["isCurrent"];
  readonly #disposeResult: (result: TResult) => void;
  readonly #listeners = new Set<
    (state: ExactFeaturePreviewState<TInput, TResult>) => void
  >();
  #state: ExactFeaturePreviewState<TInput, TResult> = { status: "idle" };
  #active: PreviewJob<TInput, TResult> | undefined;
  #retained: RetainedPreviewResult<TInput, TResult> | undefined;
  #nextSequence = 1;
  #disposed = false;

  constructor(
    options: ExactFeaturePreviewJobControllerOptions<TInput, TResult>
  ) {
    this.#worker = options.worker;
    this.#isCurrent = options.isCurrent;
    this.#disposeResult = options.disposeResult;
    if (options.onStateChange) {
      this.#listeners.add(options.onStateChange);
    }
  }

  get state(): ExactFeaturePreviewState<TInput, TResult> {
    return this.#state;
  }

  get disposed(): boolean {
    return this.#disposed;
  }

  subscribe(
    listener: (state: ExactFeaturePreviewState<TInput, TResult>) => void
  ): () => void {
    if (this.#disposed) {
      listener(this.#state);
      return () => undefined;
    }

    this.#listeners.add(listener);
    listener(this.#state);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  start(
    input: TInput,
    context: ExactFeaturePreviewContext
  ): ExactFeaturePreviewJobHandle<TResult> {
    if (this.#disposed) {
      throw new ExactFeaturePreviewJobControllerDisposedError();
    }

    this.#cancelActive("replaced");
    this.#releaseRetainedResult();

    const sequence = this.#nextSequence;
    this.#nextSequence += 1;
    const capturedContext: ExactFeaturePreviewContext = {
      liveRevision: context.liveRevision,
      sourceIdentity: context.sourceIdentity,
      editorOwnership: context.editorOwnership
    };
    const request: ExactFeaturePreviewRequest<TInput> = {
      input,
      context: capturedContext,
      sequence
    };
    const abortController = new AbortController();
    let resolveOutcome!: (
      outcome: ExactFeaturePreviewJobOutcome<TResult>
    ) => void;
    const promise = new Promise<ExactFeaturePreviewJobOutcome<TResult>>(
      (resolve) => {
        resolveOutcome = resolve;
      }
    );
    const job: PreviewJob<TInput, TResult> = {
      sequence,
      request,
      abortController,
      allocations: [],
      resolveOutcome,
      settled: false
    };

    this.#active = job;
    this.#setState({ status: "pending", sequence, request });
    void this.#run(job);

    return {
      sequence,
      signal: abortController.signal,
      promise,
      cancel: () => {
        this.#cancelJob(job, "explicit");
      }
    };
  }

  cancel(): void {
    this.#cancelActive("explicit");
    if (this.#retained) {
      const retained = this.#retained;
      this.#releaseRetainedResult();
      this.#setState({
        status: "cancelled",
        sequence: retained.job.sequence,
        request: retained.job.request,
        reason: "explicit"
      });
    }
  }

  clear(): void {
    this.#cancelActive("cleared");
    if (this.#retained) {
      const retained = this.#retained;
      this.#releaseRetainedResult();
      this.#setState({
        status: "cancelled",
        sequence: retained.job.sequence,
        request: retained.job.request,
        reason: "cleared"
      });
    }
  }

  dispose(): void {
    if (this.#disposed) return;

    this.#cancelActive("disposed", false);
    this.#releaseRetainedResult();
    this.#disposed = true;
    this.#setState({ status: "disposed" });
    this.#listeners.clear();
  }

  async #run(job: PreviewJob<TInput, TResult>): Promise<void> {
    try {
      const result = await this.#worker(
        job.request,
        job.abortController.signal,
        (allocatedResult) => {
          this.#registerAllocatedResult(job, allocatedResult);
        }
      );
      this.#trackResult(job, result);

      if (job.settled || this.#active !== job || this.#disposed) {
        this.#releaseAll(job);
        return;
      }

      let current: boolean;
      try {
        current = this.#isCurrent(job.request.context, job.request);
      } catch (error) {
        this.#failJob(job, error);
        return;
      }

      if (!current) {
        this.#cancelJob(job, "stale");
        return;
      }

      this.#releaseExcept(job, result);
      this.#active = undefined;
      this.#retained = { job, result };
      job.settled = true;
      job.resolveOutcome({
        status: "ready",
        sequence: job.sequence,
        context: job.request.context,
        result
      });
      this.#setState({
        status: "ready",
        sequence: job.sequence,
        request: job.request,
        result
      });
    } catch (error) {
      if (job.settled) return;
      this.#failJob(job, error);
    }
  }

  #registerAllocatedResult(
    job: PreviewJob<TInput, TResult>,
    result: TResult
  ): void {
    if (job.settled || this.#disposed) {
      // Keep late registration in the same ledger as the eventual worker
      // return. This makes register(result) + return result exactly-once even
      // when cancellation won the race before the worker resumed.
      this.#trackResult(job, result);
      return;
    }
    this.#trackResult(job, result);
  }

  #trackResult(job: PreviewJob<TInput, TResult>, result: TResult): void {
    if (
      job.allocations.some((allocation) => Object.is(allocation.value, result))
    ) {
      if (job.settled) this.#disposeUntracked(job, result);
      return;
    }
    const allocation: AllocatedResult<TResult> = {
      value: result,
      released: false
    };
    job.allocations.push(allocation);
    if (job.settled || this.#disposed) {
      this.#releaseAllocation(allocation);
    }
  }

  #disposeUntracked(job: PreviewJob<TInput, TResult>, result: TResult): void {
    const existing = job.allocations.find((allocation) =>
      Object.is(allocation.value, result)
    );
    if (existing) {
      this.#releaseAllocation(existing);
      return;
    }
    try {
      this.#disposeResult(result);
    } catch {
      // Disposal is best effort; a disposer failure must not permit a stale
      // result to publish or turn a terminal cancellation into a late error.
    }
  }

  #releaseAllocation(allocation: AllocatedResult<TResult>): void {
    if (allocation.released) return;
    allocation.released = true;
    try {
      this.#disposeResult(allocation.value);
    } catch {
      // See #disposeUntracked: terminal cleanup must remain idempotent.
    }
  }

  #releaseAll(job: PreviewJob<TInput, TResult>): void {
    for (const allocation of job.allocations) {
      this.#releaseAllocation(allocation);
    }
  }

  #releaseExcept(job: PreviewJob<TInput, TResult>, retained: TResult): void {
    for (const allocation of job.allocations) {
      if (!Object.is(allocation.value, retained)) {
        this.#releaseAllocation(allocation);
      }
    }
  }

  #releaseRetainedResult(): void {
    if (!this.#retained) return;
    const retained = this.#retained;
    this.#retained = undefined;
    const allocation = retained.job.allocations.find((candidate) =>
      Object.is(candidate.value, retained.result)
    );
    if (allocation) {
      this.#releaseAllocation(allocation);
    } else {
      this.#disposeUntracked(retained.job, retained.result);
    }
  }

  #cancelActive(reason: ExactFeaturePreviewCancelReason, publish = true): void {
    if (this.#active) {
      this.#cancelJob(this.#active, reason, publish);
    }
  }

  #cancelJob(
    job: PreviewJob<TInput, TResult>,
    reason: ExactFeaturePreviewCancelReason,
    publish = true
  ): void {
    if (job.settled) return;
    job.settled = true;
    if (this.#active === job) this.#active = undefined;
    try {
      job.abortController.abort(reason);
    } catch {
      // Abort listeners are external; cleanup and state publication continue.
    }
    this.#releaseAll(job);
    job.resolveOutcome({
      status: "cancelled",
      sequence: job.sequence,
      context: job.request.context,
      reason
    });
    if (publish) {
      this.#setState({
        status: "cancelled",
        sequence: job.sequence,
        request: job.request,
        reason
      });
    }
  }

  #failJob(job: PreviewJob<TInput, TResult>, error: unknown): void {
    if (job.settled) return;
    job.settled = true;
    if (this.#active === job) this.#active = undefined;
    this.#releaseAll(job);
    job.resolveOutcome({
      status: "failed",
      sequence: job.sequence,
      context: job.request.context,
      error
    });
    this.#setState({
      status: "failed",
      sequence: job.sequence,
      request: job.request,
      error
    });
  }

  #setState(state: ExactFeaturePreviewState<TInput, TResult>): void {
    this.#state = state;
    for (const listener of [...this.#listeners]) {
      try {
        listener(state);
      } catch {
        // Observers are UI sinks; one observer cannot affect job cleanup.
      }
    }
  }
}

export function createExactFeaturePreviewJobController<TInput, TResult>(
  options: ExactFeaturePreviewJobControllerOptions<TInput, TResult>
): ExactFeaturePreviewJobController<TInput, TResult> {
  return new ExactFeaturePreviewJobController(options);
}
