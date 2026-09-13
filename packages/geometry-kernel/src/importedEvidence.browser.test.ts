import { expect, it, vi } from "vitest";
import {
  createOcctExactBodyDataArtifactWithInstance,
  createOcctStepExportWithInstance,
  createOcctStepImportWithLoader,
  loadOcct
} from "@web-cad/occt-wasm";
import { executeGeometryKernelRequest } from "./browser";
import type { ExactCheckpointBodyArtifactSource } from "./kernel";

const browserLoader = vi.hoisted(() => vi.fn());
vi.mock("@web-cad/occt-wasm/browser", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@web-cad/occt-wasm/browser")>()),
  loadBrowserOcct: browserLoader
}));

it("primes the same strict evidence cache in browser and headless imports before metadata and display", async () => {
  const oc = await loadOcct();
  const box = createOcctExactBodyDataArtifactWithInstance(oc, {
    source: {
      kind: "box",
      dimensions: { width: 2, height: 3, depth: 4 },
      transform: {
        translation: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1]
      }
    }
  });
  const file = createOcctStepExportWithInstance(oc, {
    units: "mm",
    bodies: [{ ...box, bodyId: "box", bodyName: "Box", brepSha256: "" }]
  });
  for (const host of ["browser", "headless"] as const) {
    let traversals = 0,
      propertyReads = 0;
    const topExp = new Proxy(oc.TopExp, {
      get(target, key) {
        if (key === "MapShapes_1")
          return (...args: Parameters<typeof oc.TopExp.MapShapes_1>) => {
            traversals++;
            return target.MapShapes_1(...args);
          };
        return Reflect.get(target, key);
      }
    });
    const properties = new Proxy(oc.BRepGProp, {
      get(target, key) {
        if (key === "VolumeProperties_1")
          return (
            ...args: Parameters<typeof oc.BRepGProp.VolumeProperties_1>
          ) => {
            propertyReads++;
            return target.VolumeProperties_1(...args);
          };
        if (key === "SurfaceProperties_1")
          return (
            ...args: Parameters<typeof oc.BRepGProp.SurfaceProperties_1>
          ) => {
            propertyReads++;
            return target.SurfaceProperties_1(...args);
          };
        return Reflect.get(target, key);
      }
    });
    // A separate instance identity gives each host a genuinely cold owned cache.
    const observed = new Proxy(oc, {
      get(target, key) {
        return key === "TopExp"
          ? topExp
          : key === "BRepGProp"
            ? properties
            : Reflect.get(target, key);
      }
    });
    browserLoader.mockResolvedValue(observed);
    const result =
      host === "headless"
        ? await createOcctStepImportWithLoader(async () => observed, {
            sourceFileName: "box.step",
            bytes: file.bytes
          })
        : await executeGeometryKernelRequest({
            id: "import",
            version: "geometry-kernel.v1",
            op: "geometry.importStep",
            sourceFileName: "box.step",
            bytes: file.bytes
          }).then((response) => {
            if (!response.ok) throw new Error(response.error.message);
            return response;
          });
    const imported = result.bodies[0]!;
    const source: ExactCheckpointBodyArtifactSource = {
      kind: "checkpointBody",
      brepBytes: imported.checkpointPayload.brepBytes.slice(),
      brepByteLength: imported.checkpointPayload.brepByteLength,
      brepSha256: Array.from(
        new Uint8Array(
          await crypto.subtle.digest(
            "SHA-256",
            imported.checkpointPayload.brepBytes.slice()
          )
        ),
        (value) => value.toString(16).padStart(2, "0")
      ).join(""),
      topologySourceKind: "importedBody",
      topologySignature: imported.topologySnapshot.signature
    };
    Object.assign(imported.metadata!, { volume: -1 });
    Object.assign(imported.topologySnapshot, { signature: "caller-mutated" });
    traversals = 0;
    propertyReads = 0;
    const metadata = await executeGeometryKernelRequest({
      id: "metadata",
      version: "geometry-kernel.v1",
      op: "geometry.exactBodyMetadata",
      source
    });
    if (!metadata.ok) throw new Error(metadata.error.message);
    expect(metadata.metadata.volume).toBeCloseTo(24, 8);
    expect(traversals, `${host} metadata topology traversals`).toBe(0);
    expect(propertyReads, `${host} metadata property recomputation`).toBe(0);
    const display = await executeGeometryKernelRequest({
      id: "display",
      version: "geometry-kernel.v1",
      op: "geometry.tessellateExactBody",
      source
    });
    expect(display.ok).toBe(true);
    expect(propertyReads, `${host} display property recomputation`).toBe(0);
    const forged = await executeGeometryKernelRequest({
      id: "forged",
      version: "geometry-kernel.v1",
      op: "geometry.exactBodyMetadata",
      source: { ...source, topologySignature: "forged-topology" }
    });
    expect(forged.ok).toBe(false);
    const forgedHash = await executeGeometryKernelRequest({
      id: "forged-hash",
      version: "geometry-kernel.v1",
      op: "geometry.exactBodyMetadata",
      source: { ...source, brepSha256: "f".repeat(64) }
    });
    expect(forgedHash.ok).toBe(false);
  }
}, 120_000);
