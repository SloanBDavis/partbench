import type { WcadPackageValidationIssue } from "@web-cad/cad-protocol";

interface ZipStoreEntry {
  readonly path: string;
  readonly bytes: Uint8Array;
}

export interface ZipStoreReadResult {
  readonly entries: ReadonlyMap<string, Uint8Array>;
  readonly issues: readonly WcadPackageValidationIssue[];
}

const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_DIRECTORY_HEADER_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const ZIP_VERSION_NEEDED = 20;
const ZIP_UTF8_FLAG = 0x0800;
const ZIP_STORE_METHOD = 0;
const DOS_DATE_1980_01_01 = 0x0021;
const DOS_TIME_MIDNIGHT = 0;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true });
const crc32Table = createCrc32Table();

export function writeZipStore(entries: readonly ZipStoreEntry[]): Uint8Array {
  const localChunks: Uint8Array[] = [];
  const centralChunks: Uint8Array[] = [];
  let offset = 0;

  entries.forEach((entry) => {
    const nameBytes = textEncoder.encode(entry.path);
    const crc32 = calculateCrc32(entry.bytes);
    const localHeader = new Uint8Array(30 + nameBytes.byteLength);
    const localView = new DataView(localHeader.buffer);

    writeUint32(localView, 0, LOCAL_FILE_HEADER_SIGNATURE);
    writeUint16(localView, 4, ZIP_VERSION_NEEDED);
    writeUint16(localView, 6, ZIP_UTF8_FLAG);
    writeUint16(localView, 8, ZIP_STORE_METHOD);
    writeUint16(localView, 10, DOS_TIME_MIDNIGHT);
    writeUint16(localView, 12, DOS_DATE_1980_01_01);
    writeUint32(localView, 14, crc32);
    writeUint32(localView, 18, entry.bytes.byteLength);
    writeUint32(localView, 22, entry.bytes.byteLength);
    writeUint16(localView, 26, nameBytes.byteLength);
    writeUint16(localView, 28, 0);
    localHeader.set(nameBytes, 30);

    localChunks.push(localHeader, entry.bytes);

    const centralHeader = new Uint8Array(46 + nameBytes.byteLength);
    const centralView = new DataView(centralHeader.buffer);

    writeUint32(centralView, 0, CENTRAL_DIRECTORY_HEADER_SIGNATURE);
    writeUint16(centralView, 4, ZIP_VERSION_NEEDED);
    writeUint16(centralView, 6, ZIP_VERSION_NEEDED);
    writeUint16(centralView, 8, ZIP_UTF8_FLAG);
    writeUint16(centralView, 10, ZIP_STORE_METHOD);
    writeUint16(centralView, 12, DOS_TIME_MIDNIGHT);
    writeUint16(centralView, 14, DOS_DATE_1980_01_01);
    writeUint32(centralView, 16, crc32);
    writeUint32(centralView, 20, entry.bytes.byteLength);
    writeUint32(centralView, 24, entry.bytes.byteLength);
    writeUint16(centralView, 28, nameBytes.byteLength);
    writeUint16(centralView, 30, 0);
    writeUint16(centralView, 32, 0);
    writeUint16(centralView, 34, 0);
    writeUint16(centralView, 36, 0);
    writeUint32(centralView, 38, 0);
    writeUint32(centralView, 42, offset);
    centralHeader.set(nameBytes, 46);

    centralChunks.push(centralHeader);
    offset += localHeader.byteLength + entry.bytes.byteLength;
  });

  const centralDirectoryOffset = offset;
  const centralDirectorySize = byteLength(centralChunks);
  const endRecord = new Uint8Array(22);
  const endView = new DataView(endRecord.buffer);

  writeUint32(endView, 0, END_OF_CENTRAL_DIRECTORY_SIGNATURE);
  writeUint16(endView, 4, 0);
  writeUint16(endView, 6, 0);
  writeUint16(endView, 8, entries.length);
  writeUint16(endView, 10, entries.length);
  writeUint32(endView, 12, centralDirectorySize);
  writeUint32(endView, 16, centralDirectoryOffset);
  writeUint16(endView, 20, 0);

  return concatUint8Arrays([...localChunks, ...centralChunks, endRecord]);
}

export function readZipStore(bytes: Uint8Array): ZipStoreReadResult {
  const issues: WcadPackageValidationIssue[] = [];
  const entries = new Map<string, Uint8Array>();
  const endOffset = findEndOfCentralDirectory(bytes);

  if (endOffset === -1) {
    return {
      entries,
      issues: [
        createZipIssue(
          "WCAD_INVALID_PACKAGE",
          "WCAD package is not a readable ZIP-compatible archive."
        )
      ]
    };
  }

  const view = createDataView(bytes);
  const centralEntryCount = readUint16(view, endOffset + 10);
  const centralDirectorySize = readUint32(view, endOffset + 12);
  const centralDirectoryOffset = readUint32(view, endOffset + 16);

  if (
    centralDirectoryOffset + centralDirectorySize > bytes.byteLength ||
    centralDirectoryOffset + centralDirectorySize !== endOffset
  ) {
    return {
      entries,
      issues: [
        createZipIssue(
          "WCAD_INVALID_PACKAGE",
          "WCAD package central directory is outside the archive bounds."
        )
      ]
    };
  }

  let cursor = centralDirectoryOffset;

  for (let index = 0; index < centralEntryCount; index += 1) {
    if (
      cursor + 46 > centralDirectoryOffset + centralDirectorySize ||
      cursor + 46 > bytes.byteLength
    ) {
      issues.push(
        createZipIssue(
          "WCAD_INVALID_PACKAGE",
          "WCAD package central directory ended before all entries were read.",
          `$.centralDirectory[${index}]`
        )
      );
      break;
    }

    if (readUint32(view, cursor) !== CENTRAL_DIRECTORY_HEADER_SIGNATURE) {
      issues.push(
        createZipIssue(
          "WCAD_INVALID_PACKAGE",
          "WCAD package central directory entry is malformed.",
          `$.centralDirectory[${index}]`
        )
      );
      break;
    }

    const method = readUint16(view, cursor + 10);
    const expectedCrc32 = readUint32(view, cursor + 16);
    const compressedSize = readUint32(view, cursor + 20);
    const uncompressedSize = readUint32(view, cursor + 24);
    const nameLength = readUint16(view, cursor + 28);
    const extraLength = readUint16(view, cursor + 30);
    const commentLength = readUint16(view, cursor + 32);
    const localHeaderOffset = readUint32(view, cursor + 42);
    const nameStart = cursor + 46;
    const nameEnd = nameStart + nameLength;

    if (
      nameEnd + extraLength + commentLength >
        centralDirectoryOffset + centralDirectorySize ||
      nameEnd > bytes.byteLength
    ) {
      issues.push(
        createZipIssue(
          "WCAD_INVALID_PACKAGE",
          "WCAD package central directory entry metadata is outside the archive bounds.",
          `$.centralDirectory[${index}]`
        )
      );
      break;
    }

    const path = decodeZipPath(bytes.slice(nameStart, nameEnd));

    if (!path || !isValidZipPath(path)) {
      issues.push(
        createZipIssue(
          "WCAD_INVALID_PACKAGE_PATH",
          "WCAD package entry path must be relative and must not contain traversal.",
          `$.centralDirectory[${index}].path`,
          path
        )
      );
    }

    if (path && entries.has(path)) {
      issues.push(
        createZipIssue(
          "WCAD_DUPLICATE_ENTRY",
          "WCAD package contains a duplicate entry.",
          `$.centralDirectory[${index}].path`,
          path
        )
      );
    }

    if (method !== ZIP_STORE_METHOD) {
      issues.push(
        createZipIssue(
          "WCAD_INVALID_PACKAGE",
          "WCAD package reader only supports stored ZIP entries.",
          `$.centralDirectory[${index}].compressionMethod`,
          path
        )
      );
    } else if (compressedSize !== uncompressedSize) {
      issues.push(
        createZipIssue(
          "WCAD_INVALID_PACKAGE",
          "WCAD stored ZIP entry has mismatched compressed and uncompressed sizes.",
          `$.centralDirectory[${index}].compressedSize`,
          path
        )
      );
    } else if (path && isValidZipPath(path) && !entries.has(path)) {
      const entryBytes = readLocalEntryBytes(
        bytes,
        view,
        localHeaderOffset,
        compressedSize,
        path,
        issues
      );

      if (entryBytes) {
        const actualCrc32 = calculateCrc32(entryBytes);

        if (actualCrc32 !== expectedCrc32) {
          issues.push(
            createZipIssue(
              "WCAD_INVALID_PACKAGE",
              "WCAD package entry CRC does not match the ZIP central directory.",
              `$.entries.${path}.crc32`,
              path
            )
          );
        } else {
          entries.set(path, entryBytes);
        }
      }
    }

    cursor = nameEnd + extraLength + commentLength;
  }

  return { entries, issues };
}

function readLocalEntryBytes(
  bytes: Uint8Array,
  view: DataView,
  localHeaderOffset: number,
  size: number,
  path: string,
  issues: WcadPackageValidationIssue[]
): Uint8Array | undefined {
  if (
    localHeaderOffset + 30 > bytes.byteLength ||
    readUint32(view, localHeaderOffset) !== LOCAL_FILE_HEADER_SIGNATURE
  ) {
    issues.push(
      createZipIssue(
        "WCAD_INVALID_PACKAGE",
        "WCAD package local file header is missing or malformed.",
        `$.entries.${path}.localHeader`,
        path
      )
    );
    return undefined;
  }

  const nameLength = readUint16(view, localHeaderOffset + 26);
  const extraLength = readUint16(view, localHeaderOffset + 28);
  const dataStart = localHeaderOffset + 30 + nameLength + extraLength;
  const dataEnd = dataStart + size;

  if (dataEnd > bytes.byteLength) {
    issues.push(
      createZipIssue(
        "WCAD_INVALID_PACKAGE",
        "WCAD package entry data is outside the archive bounds.",
        `$.entries.${path}`,
        path
      )
    );
    return undefined;
  }

  return bytes.slice(dataStart, dataEnd);
}

function findEndOfCentralDirectory(bytes: Uint8Array): number {
  const minimumRecordLength = 22;
  const maximumCommentLength = 0xffff;
  const minimumOffset = Math.max(
    0,
    bytes.byteLength - minimumRecordLength - maximumCommentLength
  );
  const view = createDataView(bytes);

  for (
    let offset = bytes.byteLength - minimumRecordLength;
    offset >= minimumOffset;
    offset -= 1
  ) {
    if (isEndOfCentralDirectoryAt(view, bytes.byteLength, offset)) {
      return offset;
    }
  }

  return -1;
}

function isEndOfCentralDirectoryAt(
  view: DataView,
  archiveLength: number,
  offset: number
): boolean {
  if (readUint32(view, offset) !== END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
    return false;
  }

  const diskNumber = readUint16(view, offset + 4);
  const centralDirectoryDisk = readUint16(view, offset + 6);
  const diskEntryCount = readUint16(view, offset + 8);
  const totalEntryCount = readUint16(view, offset + 10);
  const centralDirectorySize = readUint32(view, offset + 12);
  const centralDirectoryOffset = readUint32(view, offset + 16);
  const commentLength = readUint16(view, offset + 20);

  return (
    diskNumber === 0 &&
    centralDirectoryDisk === 0 &&
    diskEntryCount === totalEntryCount &&
    centralDirectoryOffset + centralDirectorySize === offset &&
    offset + 22 + commentLength === archiveLength
  );
}

function decodeZipPath(bytes: Uint8Array): string | undefined {
  try {
    return textDecoder.decode(bytes);
  } catch {
    return undefined;
  }
}

function isValidZipPath(path: string): boolean {
  return (
    path.length > 0 &&
    !path.startsWith("/") &&
    !path.startsWith("\\") &&
    !path.includes("\\") &&
    path
      .split("/")
      .every((part) => part !== "" && part !== "." && part !== "..")
  );
}

function createZipIssue(
  code: WcadPackageValidationIssue["code"],
  message: string,
  path?: string,
  entryPath?: string
): WcadPackageValidationIssue {
  return {
    code,
    severity: "error",
    message,
    ...(path ? { path } : {}),
    ...(entryPath ? { entryPath } : {})
  };
}

function calculateCrc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;

  bytes.forEach((byte) => {
    crc = (crc >>> 8) ^ crc32Table[(crc ^ byte) & 0xff];
  });

  return (crc ^ 0xffffffff) >>> 0;
}

function createCrc32Table(): Uint32Array {
  const table = new Uint32Array(256);

  for (let index = 0; index < table.length; index += 1) {
    let crc = index;

    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }

    table[index] = crc >>> 0;
  }

  return table;
}

function byteLength(chunks: readonly Uint8Array[]): number {
  return chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
}

function concatUint8Arrays(chunks: readonly Uint8Array[]): Uint8Array {
  const result = new Uint8Array(byteLength(chunks));
  let offset = 0;

  chunks.forEach((chunk) => {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  });

  return result;
}

function createDataView(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function readUint16(view: DataView, offset: number): number {
  return view.getUint16(offset, true);
}

function readUint32(view: DataView, offset: number): number {
  return view.getUint32(offset, true);
}

function writeUint16(view: DataView, offset: number, value: number): void {
  view.setUint16(offset, value, true);
}

function writeUint32(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value, true);
}
