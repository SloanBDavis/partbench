import {
  partitionStepPreview,
  type StepPreviewMesh
} from "@web-cad/geometry-kernel/stepPreview";

interface Input {
  bytes: Uint8Array;
  units: string;
  count: number;
}
self.onmessage = async (event: MessageEvent<Input>) => {
  const { bytes, units, count } = event.data;
  const send = (meshes: StepPreviewMesh[], completed: number, total: number) =>
    self.postMessage(
      { meshes, completed, total },
      {
        transfer: meshes.flatMap((mesh) => [
          mesh.positions.buffer as ArrayBuffer,
          mesh.indices.buffer as ArrayBuffer
        ])
      }
    );
  const workers: Worker[] = [];
  try {
    // Smaller jobs reduce time to useful geometry. Shortest-first scheduling
    // uses source size, never fixture names or precomputed meshes. Keep fewer
    // native workers than batches so arrivals do not require another WASM boot.
    const partitions = partitionStepPreview(
      bytes,
      count === 1 ? 1 : count * 2
    ).sort((left, right) => left.byteLength - right.byteLength);
    let completed = 0;
    let next = 0;
    await Promise.all(
      Array.from(
        { length: Math.min(3, count, partitions.length) },
        () =>
          new Promise<void>((resolve, reject) => {
            const worker = new Worker(
              new URL("./stepPreviewPart.worker.ts", import.meta.url),
              { type: "module" }
            );
            workers.push(worker);
            worker.onmessage = (
              reply: MessageEvent<{
                meshes?: StepPreviewMesh[];
                error?: string;
              }>
            ) => {
              if (!reply.data.meshes) {
                reject(new Error(reply.data.error));
                return;
              }
              send(reply.data.meshes, ++completed, partitions.length);
              dispatch();
            };
            worker.onerror = (error) => {
              error.preventDefault();
              reject(new Error(error.message));
            };
            worker.onmessageerror = () =>
              reject(new Error("STEP preview could not be read."));
            const dispatch = () => {
              if (next === partitions.length) {
                worker.terminate();
                resolve();
                return;
              }
              const partition = partitions[next++]!;
              worker.postMessage({ bytes: partition, units }, [
                partition.buffer as ArrayBuffer
              ]);
            };
            dispatch();
          })
      )
    );
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : String(error)
    });
  } finally {
    for (const worker of workers) worker.terminate();
  }
};
