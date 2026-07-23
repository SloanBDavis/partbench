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
