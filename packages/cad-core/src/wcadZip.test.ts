import { describe, expect, it } from "vitest";

import { readZipStore, writeZipStore } from "./wcadZip";

describe("WCAD ZIP storage", () => {
  it("round-trips an empty stored archive", () => {
    const result = readZipStore(writeZipStore([]));

    expect(result.issues).toEqual([]);
    expect([...result.entries]).toEqual([]);
  });

  it("ignores EOCD-like bytes inside a valid archive comment", () => {
    const archive = writeZipStore([
      {
        path: "document.cbor",
        bytes: new Uint8Array([1, 2, 3])
      }
    ]);
    const fakeEndRecordComment = new Uint8Array(22);
    new DataView(fakeEndRecordComment.buffer).setUint32(0, 0x06054b50, true);
    const commentedArchive = new Uint8Array(
      archive.byteLength + fakeEndRecordComment.byteLength
    );
    commentedArchive.set(archive);
    commentedArchive.set(fakeEndRecordComment, archive.byteLength);
    new DataView(commentedArchive.buffer).setUint16(
      archive.byteLength - 2,
      fakeEndRecordComment.byteLength,
      true
    );

    const result = readZipStore(commentedArchive);

    expect(result.issues).toEqual([]);
    expect(result.entries.get("document.cbor")).toEqual(
      new Uint8Array([1, 2, 3])
    );
  });

  it("rejects local entry paths that disagree with the central directory", () => {
    const archive = writeZipStore([
      {
        path: "document.cbor",
        bytes: new Uint8Array([1, 2, 3])
      }
    ]);
    archive[30] = "x".charCodeAt(0);

    const result = readZipStore(archive);

    expect(result.entries.has("document.cbor")).toBe(false);
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: "WCAD_INVALID_PACKAGE",
        entryPath: "document.cbor",
        path: "$.entries.document.cbor.localHeader.path"
      })
    ]);
  });
});
