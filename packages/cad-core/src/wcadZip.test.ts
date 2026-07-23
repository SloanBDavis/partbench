import { describe, expect, it } from "vitest";

import { readZipStore, writeZipStore } from "./wcadZip";

describe("WCAD ZIP storage", () => {
  it("rejects invalid, duplicate, and overlong entry paths before writing", () => {
    expect(() =>
      writeZipStore([{ path: "../document.cbor", bytes: new Uint8Array([1]) }])
    ).toThrow("Invalid ZIP entry path");
    expect(() =>
      writeZipStore([
        { path: "document.cbor", bytes: new Uint8Array([1]) },
        { path: "document.cbor", bytes: new Uint8Array([2]) }
      ])
    ).toThrow("Duplicate ZIP entry path");
    expect(() =>
      writeZipStore([{ path: "a".repeat(0x10000), bytes: new Uint8Array([1]) }])
    ).toThrow("ZIP entry path exceeds the 16-bit UTF-8 length limit");
  });

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

  it("rejects local entry metadata that disagrees with the central directory", () => {
    const archive = writeZipStore([
      {
        path: "document.cbor",
        bytes: new Uint8Array([1, 2, 3])
      }
    ]);
    new DataView(archive.buffer).setUint32(14, 0, true);

    const result = readZipStore(archive);

    expect(result.entries.has("document.cbor")).toBe(false);
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: "WCAD_INVALID_PACKAGE",
        entryPath: "document.cbor",
        path: "$.entries.document.cbor.localHeader"
      })
    ]);
  });
});
