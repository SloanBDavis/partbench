/* eslint-disable @typescript-eslint/triple-slash-reference -- Exported source entry points must carry ambient WASM/upstream declarations into consuming packages. */
/// <reference path="./vite-assets.d.ts" />
/// <reference path="./occt-import-js.d.ts" />
import initialize from "occt-import-js";
import wasmUrl from "occt-import-js/dist/occt-import-js.wasm?url";

export interface StepPreviewMesh {
  readonly positions: Float32Array;
  readonly indices: Uint32Array;
  readonly name: string;
}

// A preview worker handles several bounded batches, then is terminated. Reuse
// its native module rather than compiling/initializing a kernel for every batch.
let kernel: ReturnType<typeof initialize> | undefined;

/** A short-lived OCCT display kernel. It produces no document/checkpoint data. */
export async function createStepPreview(
  bytes: Uint8Array,
  units: string
): Promise<StepPreviewMesh[]> {
  const oc = await (kernel ??= initialize({ locateFile: () => wasmUrl }));
  const result = oc.ReadStepFile(bytes, {
    linearUnit:
      (
        {
          mm: "millimeter",
          cm: "centimeter",
          m: "meter",
          in: "inch"
        } as Record<string, string>
      )[units] ?? "millimeter",
    linearDeflectionType: "absolute_value",
    linearDeflection:
      ({ mm: 1, cm: 0.1, m: 0.001, in: 1 / 25.4 } as Record<string, number>)[
        units
      ] ?? 1,
    angularDeflection: 0.8
  });
  if (!result.success) throw new Error("STEP display preview is unavailable.");
  return result.meshes
    .filter((mesh) => mesh.index.array.length > 0)
    .map((mesh) => ({
      name: mesh.name,
      positions: Float32Array.from(mesh.attributes.position.array),
      indices: Uint32Array.from(mesh.index.array)
    }));
}
