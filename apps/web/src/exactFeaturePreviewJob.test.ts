import { describe, expect, it } from "vitest";
import {
  createExactFeaturePreviewJobController,
  type ExactFeaturePreviewContext,
  type ExactFeaturePreviewJobController,
  type ExactFeaturePreviewState,
  type ExactFeaturePreviewWorker
} from "./exactFeaturePreviewJob";

interface PreviewInput {
  readonly value: number;
}

interface PreviewResult {
  readonly id: string;
}

interface Deferred<T> {
  readonly promise: Promise<T>;
  resolve(value: T): void;
  reject(error: unknown): void;
}

function createDeferred<T>(): Deferred<T> {
  let resolvePromise!: (value: T) => void;
  let rejectPromise!: (error: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return {
    promise,
    resolve: resolvePromise,
    reject: rejectPromise
  };
}

async function flushPreviewCompletion(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

const context: ExactFeaturePreviewContext = {
  liveRevision: 12,
  sourceIdentity: "source:12",
  editorOwnership: "editor:extrude"
};

function createController(
  worker: ExactFeaturePreviewWorker<PreviewInput, PreviewResult>,
  isCurrent: (capturedContext: ExactFeaturePreviewContext) => boolean = () =>
    true
): {
  readonly controller: ExactFeaturePreviewJobController<
    PreviewInput,
    PreviewResult
  >;
  readonly disposed: PreviewResult[];
  readonly states: ExactFeaturePreviewState<PreviewInput, PreviewResult>[];
} {
  const disposed: PreviewResult[] = [];
  const states: ExactFeaturePreviewState<PreviewInput, PreviewResult>[] = [];
  const controller = createExactFeaturePreviewJobController({
    worker,
    isCurrent: (capturedContext) => isCurrent(capturedContext),
    disposeResult: (result) => {
      disposed.push(result);
    },
    onStateChange: (state) => {
      states.push(state);
    }
  });
  return { controller, disposed, states };
}

describe("ExactFeaturePreviewJobController", () => {
  it("publishes a successful result only after the captured context is current", async () => {
    const deferred = createDeferred<PreviewResult>();
    let receivedSignal: AbortSignal | undefined;
    let receivedRequestSequence: number | undefined;
    const worker: ExactFeaturePreviewWorker<
      PreviewInput,
      PreviewResult
    > = async (request, signal, registerAllocatedResult) => {
      receivedSignal = signal;
      receivedRequestSequence = request.sequence;
      const result = await deferred.promise;
      registerAllocatedResult(result);
      return result;
    };
    const { controller, disposed, states } = createController(worker);

    const handle = controller.start({ value: 4 }, context);

    expect(handle.sequence).toBe(1);
    expect(receivedSignal).toBeInstanceOf(AbortSignal);
    expect(receivedSignal?.aborted).toBe(false);
    expect(receivedRequestSequence).toBe(1);
    expect(controller.state.status).toBe("pending");

    const result = { id: "preview:1" };
    deferred.resolve(result);
    await expect(handle.promise).resolves.toMatchObject({
      status: "ready",
      sequence: 1,
      result,
      context
    });

    expect(controller.state).toMatchObject({
      status: "ready",
      sequence: 1,
      result
    });
    expect(disposed).toEqual([]);
    expect(states.map((state) => state.status)).toEqual(["pending", "ready"]);
  });

  it("replaces one pending job, aborts it, and disposes its late result without publishing it", async () => {
    const first = createDeferred<PreviewResult>();
    const second = createDeferred<PreviewResult>();
    const deferreds = [first, second];
    const calls: { sequence: number; signal: AbortSignal }[] = [];
    const worker: ExactFeaturePreviewWorker<
      PreviewInput,
      PreviewResult
    > = async (request, signal, registerAllocatedResult) => {
      calls.push({ sequence: request.sequence, signal });
      const result = await deferreds[request.sequence - 1]!.promise;
      registerAllocatedResult(result);
      return result;
    };
    const { controller, disposed, states } = createController(worker);

    const firstHandle = controller.start({ value: 1 }, context);
    const secondHandle = controller.start(
      { value: 2 },
      {
        ...context,
        liveRevision: 13,
        sourceIdentity: "source:13"
      }
    );

    expect(firstHandle.signal.aborted).toBe(true);
    await expect(firstHandle.promise).resolves.toMatchObject({
      status: "cancelled",
      sequence: 1,
      reason: "replaced"
    });
    expect(calls.map((call) => call.sequence)).toEqual([1, 2]);

    const firstResult = { id: "preview:first-late" };
    first.resolve(firstResult);
    await flushPreviewCompletion();
    expect(disposed).toEqual([firstResult]);
    expect(states.some((state) => state.status === "ready")).toBe(false);

    const secondResult = { id: "preview:second" };
    second.resolve(secondResult);
    await expect(secondHandle.promise).resolves.toMatchObject({
      status: "ready",
      sequence: 2,
      result: secondResult
    });
    expect(controller.state).toMatchObject({
      status: "ready",
      sequence: 2,
      result: secondResult
    });
  });

  it("rejects stale completion, releases its result, and never publishes ready", async () => {
    const deferred = createDeferred<PreviewResult>();
    const result = { id: "preview:stale" };
    const worker: ExactFeaturePreviewWorker<
      PreviewInput,
      PreviewResult
    > = async (_request, _signal, registerAllocatedResult) => {
      const value = await deferred.promise;
      registerAllocatedResult(value);
      return value;
    };
    const { controller, disposed, states } = createController(
      worker,
      () => false
    );

    const handle = controller.start({ value: 8 }, context);
    deferred.resolve(result);

    await expect(handle.promise).resolves.toMatchObject({
      status: "cancelled",
      sequence: 1,
      reason: "stale"
    });
    expect(controller.state).toMatchObject({
      status: "cancelled",
      sequence: 1,
      reason: "stale"
    });
    expect(disposed).toEqual([result]);
    expect(states.map((state) => state.status)).toEqual([
      "pending",
      "cancelled"
    ]);
  });

  it("supports explicit cancellation and disposes a result that arrives after abort", async () => {
    const deferred = createDeferred<PreviewResult>();
    const worker: ExactFeaturePreviewWorker<
      PreviewInput,
      PreviewResult
    > = async (_request, _signal, registerAllocatedResult) => {
      const result = await deferred.promise;
      registerAllocatedResult(result);
      return result;
    };
    const { controller, disposed, states } = createController(worker);

    const handle = controller.start({ value: 5 }, context);
    handle.cancel();
    handle.cancel();

    await expect(handle.promise).resolves.toMatchObject({
      status: "cancelled",
      sequence: 1,
      reason: "explicit"
    });
    expect(handle.signal.aborted).toBe(true);

    const result = { id: "preview:cancelled-late" };
    deferred.resolve(result);
    await flushPreviewCompletion();
    expect(disposed).toEqual([result]);
    expect(states.map((state) => state.status)).toEqual([
      "pending",
      "cancelled"
    ]);
  });

  it("releases an allocated result when the worker fails", async () => {
    const result = { id: "preview:failed-allocation" };
    const failure = new Error("exact preview failed");
    const worker: ExactFeaturePreviewWorker<
      PreviewInput,
      PreviewResult
    > = async (_request, _signal, registerAllocatedResult) => {
      registerAllocatedResult(result);
      throw failure;
    };
    const { controller, disposed } = createController(worker);

    const handle = controller.start({ value: 3 }, context);

    await expect(handle.promise).resolves.toMatchObject({
      status: "failed",
      sequence: 1,
      error: failure
    });
    expect(controller.state).toMatchObject({
      status: "failed",
      error: failure
    });
    expect(disposed).toEqual([result]);
  });

  it("disposes a ready result exactly once on clear and does not publish after dispose", async () => {
    const result = { id: "preview:clear" };
    const worker: ExactFeaturePreviewWorker<
      PreviewInput,
      PreviewResult
    > = async (_request, _signal, registerAllocatedResult) => {
      registerAllocatedResult(result);
      return result;
    };
    const { controller, disposed, states } = createController(worker);

    const handle = controller.start({ value: 6 }, context);
    await expect(handle.promise).resolves.toMatchObject({ status: "ready" });

    controller.clear();
    controller.clear();
    controller.dispose();
    controller.dispose();

    expect(disposed).toEqual([result]);
    expect(controller.state).toEqual({ status: "disposed" });
    expect(states.at(-1)).toEqual({ status: "disposed" });
  });
});
