import { createStepPreview } from "@web-cad/geometry-kernel/stepPreview";

self.onmessage = async (
  event: MessageEvent<{ bytes: Uint8Array; units: string }>
) => {
  try {
    const meshes = await createStepPreview(event.data.bytes, event.data.units);
    self.postMessage(
      { meshes },
      {
        transfer: meshes.flatMap((mesh) => [
          mesh.positions.buffer as ArrayBuffer,
          mesh.indices.buffer as ArrayBuffer
        ])
      }
    );
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : String(error)
    });
  }
};
