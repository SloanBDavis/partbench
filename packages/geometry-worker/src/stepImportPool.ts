import {
  loadBrowserOcctModule,
  partitionStepImport,
  mergeOcctStepPartitions,
  type OcctStepPartitionResult,
  type OcctStepImportInput
} from "@web-cad/geometry-kernel/browser";
import type { StepImportProgress } from "./protocol";

export async function importStepInParallel(
  input: OcctStepImportInput,
  onProgress: (progress: StepImportProgress) => void
) {
  const cores = globalThis.navigator?.hardwareConcurrency ?? 1;
  const memory = (globalThis.navigator as Navigator & { deviceMemory?: number })
    ?.deviceMemory;
  const fallback = () => {
    onProgress({ phase: "fallback" });
    return undefined;
  };
  if (
    cores < 4 ||
    (memory !== undefined && memory < 8) ||
    typeof Worker === "undefined"
  )
    return fallback();
  const started = performance.now();
  const count = Math.min(6, cores);
  const divided = partitionStepImport(input.bytes, count * 2, true);
  if (!divided) return fallback();
  const partitionMs = performance.now() - started;
  const partitions = divided.partitions;
  const results: OcctStepPartitionResult[] = [];
  let next = 0;
  const workers: Worker[] = [];
  let completed = 0,
    solidCount = 0,
    closed = false;
  let queuedMeshes: Extract<
    StepImportProgress,
    { phase: "native" }
  >["meshes"][number][] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastPublished = 0;
  const flush = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    if (closed || !queuedMeshes.length) return;
    const meshes = queuedMeshes;
    queuedMeshes = [];
    lastPublished = performance.now();
    onProgress({
      phase: "native",
      meshes,
      completed,
      total: divided.definitionCount,
      solidCount
    });
  };
  onProgress({
    phase: "native",
    meshes: [],
    completed,
    total: divided.definitionCount,
    solidCount
  });
  let releasePool: (() => void) | undefined;
  try {
    const compiledModule = await loadBrowserOcctModule();
    // Start the small visible definition first. Its real import initializes the
    // shared native code before the rest of the pool competes for startup CPU.
    const firstPartReady = new Promise<void>((resolve) => {
      releasePool = resolve;
    });
    await Promise.all(
      Array.from({ length: count }, async (_, index) => {
        if (index > 0) await firstPartReady;
        if (closed) return;
        return new Promise<void>((resolve, reject) => {
          const worker = new Worker(
            new URL("./stepImportPart.worker.ts", import.meta.url),
            { type: "module" }
          );
          workers.push(worker);
          worker.onmessage = (
            event: MessageEvent<{
              result?: OcctStepPartitionResult;
              progress?: {
                meshes: Extract<
                  StepImportProgress,
                  { phase: "native" }
                >["meshes"];
                solidCount: number;
              };
              error?: string;
            }>
          ) => {
            if (closed) return;
            if (event.data.progress) {
              const progress = event.data.progress;
              completed++;
              solidCount += progress.solidCount;
              queuedMeshes.push(...progress.meshes);
              // First geometry arrives immediately. Coalesce subsequent small
              // parts at a steady cadence so repeated uploads/fits leave CPU for
              // exact preparation. Navigation still renders independently.
              if (!lastPublished || completed === divided.definitionCount)
                flush();
              else if (timer === undefined)
                timer = setTimeout(
                  flush,
                  Math.max(0, 500 - (performance.now() - lastPublished))
                );
            } else if (event.data.result) {
              results[jobIndex] = event.data.result;
              if (jobIndex === 0) releasePool?.();
              dispatch();
            } else
              reject(new Error(event.data.error ?? "STEP transfer failed."));
          };
          worker.onerror = (event) => {
            event.preventDefault();
            reject(new Error(event.message || "STEP transfer worker failed."));
          };
          worker.onmessageerror = () =>
            reject(new Error("STEP transfer returned an unreadable result."));
          let jobIndex = -1;
          const dispatch = () => {
            if (next === partitions.length) {
              worker.terminate();
              resolve();
              return;
            }
            jobIndex = next++;
            const bytes = partitions[jobIndex]!;
            try {
              worker.postMessage({ ...input, bytes, compiledModule }, [
                bytes.buffer as ArrayBuffer
              ]);
            } catch (error) {
              reject(error);
            }
          };
          dispatch();
        });
      })
    );
    flush();
    const merging = performance.now();
    const merged = mergeOcctStepPartitions(
      input,
      results,
      divided.definitionCount
    );
    onProgress({
      phase: "profile",
      partitionMs,
      mergeMs: performance.now() - merging,
      elapsedMs: performance.now() - started,
      workers: results.flatMap((result) =>
        result.timings ? [result.timings] : []
      )
    });
    return merged ?? fallback();
  } catch {
    // A preview never authorizes a partial document. Unsupported native graphs
    // and worker failures use the unchanged complete-file reader.
    return fallback();
  } finally {
    closed = true;
    releasePool?.();
    if (timer !== undefined) clearTimeout(timer);
    for (const worker of workers) worker.terminate();
  }
}
