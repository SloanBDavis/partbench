import {
  prepareBrowserStepCheckpoint,
  type OcctStepCheckpoint,
  type OcctStepCheckpointProcessor
} from "@web-cad/geometry-kernel/browser";

/** Large STEP assemblies have independent, canonical part checkpoints. Process
 * the largest first with a bounded number of kernels; preserve source order in
 * the returned array so part IDs and assembly references remain deterministic.
 * These dedicated workers belong to the importing worker: terminating that
 * worker cancels its descendants too. Normal success/failure disposes the pool.
 */
export const prepareStepCheckpointsInParallel: OcctStepCheckpointProcessor =
  async (parts) => {
    const cores = globalThis.navigator?.hardwareConcurrency ?? 1;
    const memory = (
      globalThis.navigator as
        | (Navigator & { deviceMemory?: number })
        | undefined
    )?.deviceMemory;
    const count = Math.min(
      parts.length,
      2,
      Math.max(1, cores - 1),
      memory !== undefined && memory < 4 ? 1 : 2
    );
    if (count < 2 || typeof Worker === "undefined") {
      const result: OcctStepCheckpoint[] = [];
      for (const bytes of parts)
        result.push(await prepareBrowserStepCheckpoint(bytes));
      return result;
    }
    const queue = parts
      .map((bytes, index) => ({ bytes, index }))
      .sort((a, b) => b.bytes.byteLength - a.bytes.byteLength);
    const result = new Array<OcctStepCheckpoint>(parts.length);
    const workers: Worker[] = [];
    let next = 0;
    try {
      await Promise.all(
        Array.from({ length: count }, async () => {
          const worker = new Worker(
            new URL("./stepCheckpoint.worker.ts", import.meta.url),
            { type: "module" }
          );
          workers.push(worker);
          while (next < queue.length) {
            const task = queue[next++]!;
            result[task.index] = await new Promise<OcctStepCheckpoint>(
              (resolve, reject) => {
                worker.onmessage = (
                  event: MessageEvent<{
                    checkpoint?: OcctStepCheckpoint;
                    error?: string;
                  }>
                ) => {
                  if (event.data.checkpoint) resolve(event.data.checkpoint);
                  else
                    reject(
                      new Error(
                        event.data.error ?? "STEP part preparation failed."
                      )
                    );
                };
                worker.onerror = (event) => {
                  event.preventDefault();
                  reject(
                    new Error(
                      event.message || "STEP preparation worker failed."
                    )
                  );
                };
                worker.onmessageerror = () =>
                  reject(
                    new Error("STEP preparation returned an unreadable result.")
                  );
                worker.postMessage(task.bytes, [
                  task.bytes.buffer as ArrayBuffer
                ]);
              }
            );
          }
        })
      );
      return result;
    } finally {
      for (const worker of workers) worker.terminate();
    }
  };
