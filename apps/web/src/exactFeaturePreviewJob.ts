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
  | { readonly status: "idle" }
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
  | { readonly status: "disposed" };

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

type Allocation<TResult> = [value: TResult, released: boolean];

interface PreviewJob<TInput, TResult> {
  readonly request: ExactFeaturePreviewRequest<TInput>;
  readonly controller: AbortController;
  readonly allocations: Allocation<TResult>[];
  readonly resolve: (outcome: ExactFeaturePreviewJobOutcome<TResult>) => void;
  settled: boolean;
}

interface RetainedPreviewResult<TInput, TResult> {
  readonly job: PreviewJob<TInput, TResult>;
  readonly allocation: Allocation<TResult>;
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

  constructor(options: ExactFeaturePreviewJobControllerOptions<TInput, TResult>) {
    this.#worker = options.worker;
    this.#isCurrent = options.isCurrent;
    this.#disposeResult = options.disposeResult;
    if (options.onStateChange) this.#listeners.add(options.onStateChange);
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
    return () => this.#listeners.delete(listener);
  }

  start(
    input: TInput,
    context: ExactFeaturePreviewContext
  ): ExactFeaturePreviewJobHandle<TResult> {
    if (this.#disposed) throw new ExactFeaturePreviewJobControllerDisposedError();

    this.#cancelJob(this.#active, "replaced");
    this.#dropRetained();

    const sequence = this.#nextSequence++;
    const request: ExactFeaturePreviewRequest<TInput> = {
      input,
      context: {
        liveRevision: context.liveRevision,
        sourceIdentity: context.sourceIdentity,
        editorOwnership: context.editorOwnership
      },
      sequence
    };
    const controller = new AbortController();
    let resolve!: (outcome: ExactFeaturePreviewJobOutcome<TResult>) => void;
    const promise = new Promise<ExactFeaturePreviewJobOutcome<TResult>>(
      (res) => {
        resolve = res;
      }
    );
    const job: PreviewJob<TInput, TResult> = {
      request,
      controller,
      allocations: [],
      resolve,
      settled: false
    };

    this.#active = job;
    this.#setState({ status: "pending", sequence, request });
    void this.#run(job);
    return {
      sequence,
      signal: controller.signal,
      promise,
      cancel: () => this.#cancelJob(job, "explicit")
    };
  }

  cancel(): void {
    this.#cancelJob(this.#active, "explicit");
    this.#dropRetained("explicit");
  }

  clear(): void {
    this.#cancelJob(this.#active, "cleared");
    this.#dropRetained("cleared");
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#cancelJob(this.#active, "disposed", false);
    this.#dropRetained();
    this.#disposed = true;
    this.#setState({ status: "disposed" });
    this.#listeners.clear();
  }

  async #run(job: PreviewJob<TInput, TResult>): Promise<void> {
    try {
      const result = await this.#worker(
        job.request,
        job.controller.signal,
        (allocated) => this.#track(job, allocated)
      );
      this.#track(job, result);

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
      // isCurrent is user supplied and may synchronously replace/cancel us.
      if (job.settled || this.#active !== job || this.#disposed) {
        this.#releaseAll(job);
        return;
      }

      this.#releaseExcept(job, result);
      const allocation = job.allocations.find((entry) =>
        Object.is(entry[0], result)
      )!;
      this.#active = undefined;
      this.#retained = { job, allocation };
      job.settled = true;
      job.resolve({
        status: "ready",
        sequence: job.request.sequence,
        context: job.request.context,
        result
      });
      this.#setState({
        status: "ready",
        sequence: job.request.sequence,
        request: job.request,
        result
      });
    } catch (error) {
      if (!job.settled) this.#failJob(job, error);
    }
  }

  #track(job: PreviewJob<TInput, TResult>, result: TResult): void {
    if (job.allocations.some((entry) => Object.is(entry[0], result))) return;
    const allocation: Allocation<TResult> = [result, false];
    job.allocations.push(allocation);
    if (job.settled || this.#disposed) this.#release(allocation);
  }

  #release(allocation: Allocation<TResult>): void {
    if (allocation[1]) return;
    allocation[1] = true;
    try {
      this.#disposeResult(allocation[0]);
    } catch {
      // A disposer failure must not reopen a terminal job or leak another result.
    }
  }

  #releaseAll(job: PreviewJob<TInput, TResult>): void {
    for (const allocation of job.allocations) this.#release(allocation);
  }

  #releaseExcept(job: PreviewJob<TInput, TResult>, retained: TResult): void {
    for (const allocation of job.allocations) {
      if (!Object.is(allocation[0], retained)) this.#release(allocation);
    }
  }

  #dropRetained(reason?: ExactFeaturePreviewCancelReason): void {
    const retained = this.#retained;
    if (!retained) return;
    this.#retained = undefined;
    this.#release(retained.allocation);
    if (reason) {
      this.#setState({
        status: "cancelled",
        sequence: retained.job.request.sequence,
        request: retained.job.request,
        reason
      });
    }
  }

  #cancelJob(
    job: PreviewJob<TInput, TResult> | undefined,
    reason: ExactFeaturePreviewCancelReason,
    publish = true
  ): void {
    if (!job || job.settled) return;
    this.#settle(
      job,
      {
        status: "cancelled",
        sequence: job.request.sequence,
        context: job.request.context,
        reason
      },
      publish
        ? {
            status: "cancelled",
            sequence: job.request.sequence,
            request: job.request,
            reason
          }
        : undefined,
      reason
    );
  }

  #failJob(job: PreviewJob<TInput, TResult>, error: unknown): void {
    if (job.settled) return;
    this.#settle(
      job,
      {
        status: "failed",
        sequence: job.request.sequence,
        context: job.request.context,
        error
      },
      {
        status: "failed",
        sequence: job.request.sequence,
        request: job.request,
        error
      }
    );
  }

  #settle(
    job: PreviewJob<TInput, TResult>,
    outcome: ExactFeaturePreviewJobOutcome<TResult>,
    state: ExactFeaturePreviewState<TInput, TResult> | undefined,
    abortReason?: ExactFeaturePreviewCancelReason
  ): void {
    job.settled = true;
    if (this.#active === job) this.#active = undefined;
    if (abortReason) {
      try {
        job.controller.abort(abortReason);
      } catch {
        // External abort listeners cannot prevent cleanup or cancellation.
      }
    }
    this.#releaseAll(job);
    job.resolve(outcome);
    if (state) this.#setState(state);
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
