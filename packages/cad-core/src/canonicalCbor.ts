export class CanonicalCborDecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CanonicalCborDecodeError";
  }
}

type JsonObject = { readonly [key: string]: JsonValue };
type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | JsonObject;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true });

export function encodeCanonicalCbor(value: unknown): Uint8Array {
  const bytes: number[] = [];
  encodeValue(toJsonCompatibleValue(value), bytes);

  return new Uint8Array(bytes);
}

export function decodeCanonicalCbor(bytes: Uint8Array): unknown {
  const reader = new CborReader(bytes);
  const value = reader.readValue();

  if (!reader.done) {
    throw new CanonicalCborDecodeError("CBOR payload has trailing bytes.");
  }

  return value;
}

function toJsonCompatibleValue(value: unknown): JsonValue {
  const json = JSON.stringify(value);

  if (json === undefined) {
    throw new TypeError("WCAD source payload must be JSON-compatible.");
  }

  return JSON.parse(json) as JsonValue;
}

function encodeValue(value: JsonValue, bytes: number[]): void {
  if (value === null) {
    bytes.push(0xf6);
    return;
  }

  if (typeof value === "boolean") {
    bytes.push(value ? 0xf5 : 0xf4);
    return;
  }

  if (typeof value === "number") {
    encodeNumber(value, bytes);
    return;
  }

  if (typeof value === "string") {
    const encoded = textEncoder.encode(value);
    encodeTypeAndLength(3, encoded.byteLength, bytes);
    pushBytes(bytes, encoded);
    return;
  }

  if (Array.isArray(value)) {
    encodeTypeAndLength(4, value.length, bytes);
    value.forEach((entry) => encodeValue(entry, bytes));
    return;
  }

  const objectValue = value as JsonObject;
  const keys = Object.keys(objectValue).sort();
  encodeTypeAndLength(5, keys.length, bytes);

  keys.forEach((key) => {
    encodeValue(key, bytes);
    const entry = objectValue[key];
    if (entry === undefined) {
      throw new TypeError("WCAD source payload must be JSON-compatible.");
    }
    encodeValue(entry, bytes);
  });
}

function encodeNumber(value: number, bytes: number[]): void {
  if (!Number.isFinite(value)) {
    throw new TypeError("WCAD source payload numbers must be finite.");
  }

  if (Number.isSafeInteger(value)) {
    if (value >= 0) {
      encodeTypeAndLength(0, value, bytes);
      return;
    }

    encodeTypeAndLength(1, -1 - value, bytes);
    return;
  }

  bytes.push(0xfb);
  const buffer = new ArrayBuffer(8);
  new DataView(buffer).setFloat64(0, value, false);
  pushBytes(bytes, new Uint8Array(buffer));
}

function encodeTypeAndLength(
  majorType: number,
  length: number,
  bytes: number[]
): void {
  if (!Number.isSafeInteger(length) || length < 0) {
    throw new TypeError("CBOR length must be a non-negative safe integer.");
  }

  if (length < 24) {
    bytes.push((majorType << 5) | length);
    return;
  }

  if (length <= 0xff) {
    bytes.push((majorType << 5) | 24, length);
    return;
  }

  if (length <= 0xffff) {
    bytes.push((majorType << 5) | 25, (length >>> 8) & 0xff, length & 0xff);
    return;
  }

  if (length <= 0xffffffff) {
    bytes.push((majorType << 5) | 26);
    pushUint32(bytes, length);
    return;
  }

  bytes.push((majorType << 5) | 27);
  pushUint64(bytes, length);
}

function pushBytes(target: number[], source: Uint8Array): void {
  source.forEach((byte) => target.push(byte));
}

function pushUint32(bytes: number[], value: number): void {
  bytes.push(
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff
  );
}

function pushUint64(bytes: number[], value: number): void {
  const high = Math.floor(value / 0x100000000);
  const low = value >>> 0;
  pushUint32(bytes, high);
  pushUint32(bytes, low);
}

class CborReader {
  #offset = 0;

  constructor(private readonly bytes: Uint8Array) {}

  get done(): boolean {
    return this.#offset === this.bytes.byteLength;
  }

  readValue(): unknown {
    const initial = this.#readUint8();
    const majorType = initial >> 5;
    const additionalInfo = initial & 0x1f;

    switch (majorType) {
      case 0:
        return this.#readLength(additionalInfo);
      case 1:
        return -1 - this.#readLength(additionalInfo);
      case 2:
        return this.#readBytes(this.#readLength(additionalInfo));
      case 3:
        return this.#readText(this.#readLength(additionalInfo));
      case 4:
        return this.#readArray(this.#readLength(additionalInfo));
      case 5:
        return this.#readMap(this.#readLength(additionalInfo));
      case 6:
        throw new CanonicalCborDecodeError("CBOR tags are not supported.");
      case 7:
        return this.#readSimpleValue(additionalInfo);
      default:
        throw new CanonicalCborDecodeError("Unsupported CBOR major type.");
    }
  }

  #readLength(additionalInfo: number): number {
    if (additionalInfo < 24) {
      return additionalInfo;
    }

    if (additionalInfo === 24) {
      return this.#readUint8();
    }

    if (additionalInfo === 25) {
      return this.#readUint16();
    }

    if (additionalInfo === 26) {
      return this.#readUint32();
    }

    if (additionalInfo === 27) {
      return this.#readUint64();
    }

    throw new CanonicalCborDecodeError(
      "Indefinite-length CBOR values are not supported."
    );
  }

  #readSimpleValue(additionalInfo: number): unknown {
    if (additionalInfo === 20) {
      return false;
    }

    if (additionalInfo === 21) {
      return true;
    }

    if (additionalInfo === 22) {
      return null;
    }

    if (additionalInfo === 27) {
      const value = this.#readFloat64();

      if (!Number.isFinite(value)) {
        throw new CanonicalCborDecodeError(
          "Non-finite CBOR floating-point values are not supported."
        );
      }

      return value;
    }

    throw new CanonicalCborDecodeError("Unsupported CBOR simple value.");
  }

  #readArray(length: number): unknown[] {
    this.#assertCollectionCanFit(length, 1);
    const value: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      value.push(this.readValue());
    }
    return value;
  }

  #readMap(length: number): Record<string, unknown> {
    this.#assertCollectionCanFit(length, 2);
    const value: Record<string, unknown> = {};

    for (let index = 0; index < length; index += 1) {
      const key = this.readValue();

      if (typeof key !== "string") {
        throw new CanonicalCborDecodeError("CBOR map keys must be strings.");
      }

      if (Object.prototype.hasOwnProperty.call(value, key)) {
        throw new CanonicalCborDecodeError("CBOR map contains duplicate keys.");
      }

      value[key] = this.readValue();
    }

    return value;
  }

  #readText(length: number): string {
    try {
      return textDecoder.decode(this.#readBytes(length));
    } catch (error) {
      throw new CanonicalCborDecodeError(
        error instanceof Error ? error.message : "CBOR text is not valid UTF-8."
      );
    }
  }

  #readBytes(length: number): Uint8Array {
    this.#assertAvailable(length);
    const value = this.bytes.slice(this.#offset, this.#offset + length);
    this.#offset += length;
    return value;
  }

  #readUint8(): number {
    const value = this.#readDataView(1).getUint8(0);
    this.#offset += 1;
    return value;
  }

  #readUint16(): number {
    const value = this.#readDataView(2).getUint16(0, false);
    this.#offset += 2;
    return value;
  }

  #readUint32(): number {
    const value = this.#readDataView(4).getUint32(0, false);
    this.#offset += 4;
    return value;
  }

  #readUint64(): number {
    const high = this.#readUint32();
    const low = this.#readUint32();
    const value = high * 0x100000000 + low;

    if (!Number.isSafeInteger(value)) {
      throw new CanonicalCborDecodeError(
        "CBOR integer exceeds JavaScript safe integer range."
      );
    }

    return value;
  }

  #readFloat64(): number {
    const value = this.#readDataView(8).getFloat64(0, false);
    this.#offset += 8;
    return value;
  }

  #readDataView(length: number): DataView {
    this.#assertAvailable(length);
    return new DataView(
      this.bytes.buffer,
      this.bytes.byteOffset + this.#offset,
      length
    );
  }

  #assertCollectionCanFit(
    itemCount: number,
    minimumBytesPerItem: number
  ): void {
    const remainingBytes = this.bytes.byteLength - this.#offset;
    if (itemCount > Math.floor(remainingBytes / minimumBytesPerItem)) {
      throw new CanonicalCborDecodeError("CBOR payload ended unexpectedly.");
    }
  }

  #assertAvailable(length: number): void {
    if (this.#offset + length > this.bytes.byteLength) {
      throw new CanonicalCborDecodeError("CBOR payload ended unexpectedly.");
    }
  }
}
