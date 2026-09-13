import { describe, expect, it } from "vitest";

import {
  CanonicalCborDecodeError,
  decodeCanonicalCbor,
  encodeCanonicalCbor
} from "./canonicalCbor";

describe("canonical CBOR", () => {
  it("round-trips JSON-compatible values with deterministic object keys", () => {
    const first = encodeCanonicalCbor({ z: 1, a: { y: 2, x: 3 } });
    const second = encodeCanonicalCbor({ a: { x: 3, y: 2 }, z: 1 });

    expect(first).toEqual(second);
    expect(decodeCanonicalCbor(first)).toEqual({
      a: { x: 3, y: 2 },
      z: 1
    });
  });

  it("preserves canonical scalar bytes and UTF-8 across chunk boundaries", () => {
    expect([
      ...encodeCanonicalCbor([null, true, false, -1, 23, 24, 256, 1.5])
    ]).toEqual([
      0x88, 0xf6, 0xf5, 0xf4, 0x20, 0x17, 0x18, 0x18, 0x19, 0x01, 0x00, 0xfb,
      0x3f, 0xf8, 0, 0, 0, 0, 0, 0
    ]);
    const value = {
      first: "a".repeat(65529) + "⚙",
      second: "b".repeat(8 * 1024 * 1024),
      last: [1.5, 0x100000000]
    };
    const bytes = encodeCanonicalCbor(value);
    expect(bytes.length).toBeGreaterThan(value.second.length);
    expect(decodeCanonicalCbor(bytes)).toEqual(value);
  });

  it.each([
    new Uint8Array(),
    new Uint8Array([0x18]),
    new Uint8Array([0x19, 0]),
    new Uint8Array([0x1a, 0, 0, 0]),
    new Uint8Array([0x1b, 0, 0, 0, 0, 0, 0, 0]),
    new Uint8Array([0xfb, 0, 0, 0, 0, 0, 0, 0])
  ])("rejects truncated scalar payloads with a decode error", (bytes) => {
    expect(() => decodeCanonicalCbor(bytes)).toThrowError(
      CanonicalCborDecodeError
    );
  });

  it.each([
    new Uint8Array([0x9a, 0xff, 0xff, 0xff, 0xff]),
    new Uint8Array([0xba, 0xff, 0xff, 0xff, 0xff])
  ])(
    "rejects impossible collection lengths before allocating or iterating",
    (bytes) => {
      expect(() => decodeCanonicalCbor(bytes)).toThrowError(
        new CanonicalCborDecodeError("CBOR payload ended unexpectedly.")
      );
    }
  );
});
