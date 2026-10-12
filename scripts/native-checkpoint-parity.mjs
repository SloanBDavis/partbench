// Shared assertions for native files saved by the real engine/browser journeys.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

export async function assertNativeCheckpointParity(actualPath, baselinePath) {
  const { readCadProjectWcad } =
    await import("../packages/cad-core/src/index.ts");
  const before = await readCadProjectWcad(
    new Uint8Array(await readFile(baselinePath))
  );
  const after = await readCadProjectWcad(
    new Uint8Array(await readFile(actualPath))
  );
  assert.ok(
    before.ok && after.ok,
    "Baseline and current native files must open"
  );
  assert.equal(
    after.checkpointPayloads.length,
    before.checkpointPayloads.length
  );
  for (const payload of after.checkpointPayloads) {
    const original = before.checkpointPayloads.find(
      (item) => item.checkpointId === payload.checkpointId
    );
    assert.ok(original, `Missing baseline checkpoint ${payload.checkpointId}`);
    assert.deepEqual(
      payload.topologyBytes,
      original.topologyBytes,
      `${payload.checkpointId} canonical topology evidence changed`
    );
    assert.deepEqual(
      payload.brepBytes,
      original.brepBytes,
      `${payload.checkpointId} geometry changed`
    );
    assert.deepEqual(
      payload.signatureBytes,
      original.signatureBytes,
      `${payload.checkpointId} signature evidence changed`
    );
  }
}
