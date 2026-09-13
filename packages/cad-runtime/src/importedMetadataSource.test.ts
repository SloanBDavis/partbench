import { expect, it } from "vitest";
import { createExactMetadataRuntimeInput } from "./shared/derivedExactMetadata";

it("retains import checkpoint verification evidence in the standalone metadata request", () => {
  const bytes = new Uint8Array([1, 2, 3]);
  expect(
    createExactMetadataRuntimeInput({
      id: "body",
      kind: "importedBody",
      checkpointId: "checkpoint",
      brepBytes: bytes,
      brepByteLength: bytes.length,
      brepSha256: "a".repeat(64),
      topologySourceKind: "importedBody",
      topologySignature: "verified-signature"
    })
  ).toEqual({
    id: "body",
    source: {
      kind: "checkpointBody",
      brepBytes: bytes,
      brepByteLength: bytes.length,
      brepSha256: "a".repeat(64),
      topologySourceKind: "importedBody",
      topologySignature: "verified-signature"
    }
  });
});
