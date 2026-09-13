import { expect, it } from "vitest";
import type { OpenCascadeInstance } from "opencascade.js";
import { loadOcct } from "./index";
import { createOcctExactBodyDataArtifactWithInstance } from "./exactCheckpointPayload";
import { createOcctStepExportWithInstance } from "./exactStepExport";
import { createOcctStepImportWithLoader } from "./stepImport";
import { checkpointSha256 } from "./exactCheckpointCache";

it("reuses canonical import evidence while rejecting forged hashes and isolating caller mutations", async () => {
  const oc = await loadOcct();
  const makeBox = (width: number) =>
    createOcctExactBodyDataArtifactWithInstance(oc, {
      source: {
        kind: "box",
        dimensions: { width, height: 3, depth: 4 },
        transform: {
          translation: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1]
        }
      }
    });
  const box = makeBox(2);
  const file = createOcctStepExportWithInstance(oc, {
    units: "mm",
    bodies: [{ ...box, bodyId: "box", bodyName: "Box", brepSha256: "" }]
  });
  let traversals = 0;
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
  const observed = new Proxy(oc, {
    get(target, key) {
      return key === "TopExp" ? topExp : Reflect.get(target, key);
    }
  }) as OpenCascadeInstance;
  const imported = (
    await createOcctStepImportWithLoader(async () => observed, {
      sourceFileName: "box.step",
      bytes: file.bytes
    })
  ).bodies[0]!;
  const bytes = imported.checkpointPayload.brepBytes.slice();
  const signature = imported.topologySnapshot.signature;
  const sha256 = await checkpointSha256(bytes);
  Object.assign(imported.metadata!, { volume: -1 });
  Object.assign(imported.topologySnapshot, { signature: "caller-mutated" });
  structuredClone(imported.checkpointPayload.brepBytes, {
    transfer: [imported.checkpointPayload.brepBytes.buffer]
  });
  traversals = 0;
  const source = {
    kind: "checkpointBody" as const,
    brepBytes: bytes,
    brepByteLength: bytes.byteLength,
    brepSha256: sha256,
    topologySourceKind: "importedBody" as const,
    topologySignature: signature
  };
  const restored = createOcctExactBodyDataArtifactWithInstance(observed, {
    source
  });
  expect(restored.metadata.volume).toBeCloseTo(24, 8);
  expect(restored.topologySnapshot.signature).toBe(signature);
  expect(traversals).toBe(0);
  const other = makeBox(8);
  expect(() =>
    createOcctExactBodyDataArtifactWithInstance(observed, {
      source: {
        ...source,
        brepBytes: other.brepBytes,
        brepByteLength: other.brepByteLength
      }
    })
  ).toThrow(/signature mismatched/);
  expect(traversals).toBeGreaterThan(0);
}, 120_000);
