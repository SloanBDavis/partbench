import type { StepPreviewMesh } from "@web-cad/geometry-kernel/stepPreview";
export type { StepPreviewMesh } from "@web-cad/geometry-kernel/stepPreview";
export interface StepPreviewBatch {
  meshes: StepPreviewMesh[];
  completed: number;
  total: number;
  solidCount?: number;
}

/** Cancellation terminates the coordinator and its native child workers. A
 * failed/unsupported preview falls back to the authoritative import, never to
 * a partial document. The callback is delivery only, not a modeling command. */
export function startStepPreview(
  bytes: Uint8Array,
  units: string,
  onBatch: (batch: StepPreviewBatch) => void
) {
  const worker = new Worker(
    new URL("./stepPreview.worker.ts", import.meta.url),
    { type: "module" }
  );
  let stopped = false;
  // A display failure must never prevent the original file from reaching the
  // exact reader. Keep this independent of browser animation-frame delivery.
  const timeout = globalThis.setTimeout(() => cancel(), 30_000);
  const cancel = () => {
    stopped = true;
    globalThis.clearTimeout(timeout);
    worker.terminate();
  };
  worker.onmessage = (
    event: MessageEvent<StepPreviewBatch & { error?: string }>
  ) => {
    if (stopped) return;
    if (event.data.error) {
      cancel();
      return;
    }
    onBatch(event.data);
    if (event.data.completed === event.data.total) cancel();
  };
  worker.onerror = (event) => {
    event.preventDefault();
    cancel();
  };
  worker.onmessageerror = cancel;
  const cores = globalThis.navigator?.hardwareConcurrency ?? 2;
  const memory = (globalThis.navigator as Navigator & { deviceMemory?: number })
    .deviceMemory;
  const count = Math.min(
    4,
    Math.max(1, cores - 1),
    memory !== undefined && memory < 4 ? 1 : 4
  );
  // Keep the original buffer for the authoritative import.
  worker.postMessage({ bytes, units, count });
  return { cancel };
}
