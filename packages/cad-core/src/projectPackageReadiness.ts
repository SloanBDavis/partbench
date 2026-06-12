import {
  WCAD_COMMANDS_ENTRY_PATH,
  WCAD_DOCUMENT_ENTRY_PATH,
  WCAD_MANIFEST_ENTRY_PATH,
  WCAD_PACKAGE_EXTENSION,
  WCAD_PACKAGE_VERSION,
  WCAD_SOURCE_IDENTITY_ALGORITHM,
  type CadOpsVersion,
  type DocumentUnits,
  type ProjectPackageReadinessQueryResponse,
  type WcadDocumentSchemaVersion,
  type WcadManifestV1,
  type WcadPackageCacheArtifactKind,
  type WcadPackageEntryMetadata,
  type WcadPackageEntryRole,
  type WcadPackageValidationIssue,
  type WcadPackageValidationIssueCode,
  type WcadReadinessStatus,
  type WcadSourceIdentity
} from "@web-cad/cad-protocol";

interface ProjectPackageReadinessInput {
  readonly cadOpsVersion: CadOpsVersion;
  readonly documentSchemaVersion: WcadDocumentSchemaVersion;
  readonly units: DocumentUnits;
}

export interface WcadSourceIdentityInput {
  readonly documentSchemaVersion: WcadDocumentSchemaVersion;
  readonly units: DocumentUnits;
  readonly documentBytes: Uint8Array;
  readonly commandsBytes: Uint8Array;
}

interface WcadPackageEntryBytesInput {
  readonly entry: WcadPackageEntryMetadata;
  readonly bytes: Uint8Array;
  readonly entryRole: WcadPackageEntryRole;
}

interface WcadPackageEntryMetadataInput {
  readonly path: string;
  readonly bytes: Uint8Array;
}

const SOURCE_BOUNDARY_NOTE =
  "Classified from the current authoritative project schema, units, and V8 package source entries.";
const DERIVED_BOUNDARY_NOTE =
  "No renderer, mesh, OCCT, OPFS, File System Access handle, thumbnail, export artifact, viewport, hover, or selection state is part of package source.";

const SUPPORTED_DOCUMENT_SCHEMAS = [
  "web-cad.project.v16",
  "web-cad.project.v17"
] satisfies readonly WcadDocumentSchemaVersion[];

const SUPPORTED_CACHE_ARTIFACT_KINDS = [
  "derivedMesh",
  "derivedExactMetadata",
  "thumbnail",
  "packageUnpack",
  "exportIntermediate"
] satisfies readonly WcadPackageCacheArtifactKind[];

const HEX_SHA256_PATTERN = /^[a-f0-9]{64}$/;

export function createProjectPackageReadiness({
  cadOpsVersion,
  documentSchemaVersion,
  units
}: ProjectPackageReadinessInput): ProjectPackageReadinessQueryResponse {
  const schemaSupported = SUPPORTED_DOCUMENT_SCHEMAS.includes(
    documentSchemaVersion
  );
  const canRepresentCurrentSource =
    schemaSupported && documentSchemaVersion === "web-cad.project.v16";
  const requiresProjectSchemaMigration = !canRepresentCurrentSource;
  const requiredEntries: ProjectPackageReadinessQueryResponse["requiredEntries"] =
    [
      { role: "manifest", path: WCAD_MANIFEST_ENTRY_PATH, source: true },
      { role: "document", path: WCAD_DOCUMENT_ENTRY_PATH, source: true },
      { role: "commands", path: WCAD_COMMANDS_ENTRY_PATH, source: true }
    ];
  const optionalCacheEntries: ProjectPackageReadinessQueryResponse["optionalCacheEntries"] =
    [
      {
        role: "metadata",
        path: "metadata/cache-index.json",
        source: false
      },
      { role: "thumbnail", path: "thumbnails/*", source: false },
      { role: "cache", path: "meshes/*", source: false },
      { role: "cache", path: "edge-display/*", source: false },
      { role: "export", path: "exports/*", source: false }
    ];
  const capabilities: ProjectPackageReadinessQueryResponse["capabilities"] = [
    {
      capability: "packageContract",
      label: "Partbench WCAD package contract",
      status: "supported",
      available: true,
      sourceBoundaryNote: SOURCE_BOUNDARY_NOTE,
      derivedBoundaryNote: DERIVED_BOUNDARY_NOTE,
      diagnostics: [
        {
          code: "WCAD_PACKAGE_CONTRACT_READY",
          status: "supported",
          message:
            "V8 package version, source entry names, manifest shape, and source identity algorithm are typed."
        },
        {
          code: "WCAD_CURRENT_PROJECT_SCHEMA_SUPPORTED",
          status: schemaSupported ? "supported" : "unavailable",
          message: schemaSupported
            ? `${documentSchemaVersion} can be represented by the V8 package contract.`
            : `${documentSchemaVersion} is not supported by the V8 package contract.`,
          expected: SUPPORTED_DOCUMENT_SCHEMAS.join(" or "),
          received: documentSchemaVersion
        },
        {
          code: "WCAD_PROJECT_SCHEMA_V17_NOT_REQUIRED",
          status: canRepresentCurrentSource ? "supported" : "deferred",
          message: canRepresentCurrentSource
            ? "The current project source can be represented without web-cad.project.v17."
            : "A future source schema may be required before this source shape can be represented.",
          expected: "web-cad.project.v16",
          received: documentSchemaVersion
        }
      ]
    },
    createSupportedCapability(
      "packageReadWrite",
      "WCAD package read/write",
      "WCAD_PACKAGE_READ_WRITE_READY",
      "ZIP-compatible .wcad read/write helpers are available for the current project source."
    ),
    createSupportedCapability(
      "fileSystemAccess",
      "File System Access open/save",
      "WCAD_FILE_SYSTEM_ACCESS_READY",
      "The web app can route .wcad open/save/save-as through File System Access when the browser provides picker APIs, with upload/download fallback otherwise."
    ),
    createDeferredCapability(
      "opfsCache",
      "OPFS derived cache",
      "WCAD_OPFS_CACHE_DEFERRED",
      "App-layer OPFS cache status and clear are available, while derived artifact population remains deferred."
    ),
    createDeferredCapability(
      "stepExport",
      "STEP exact export",
      "WCAD_STEP_EXPORT_CONTRACT_READY",
      "STEP exact export contract/readiness is available; file writing remains deferred until a geometry-boundary writer exists."
    )
  ];
  const diagnostics = capabilities.flatMap(
    (capability) => capability.diagnostics
  );

  return {
    ok: true,
    query: "project.packageReadiness",
    cadOpsVersion,
    status: chooseReadinessStatus(
      capabilities.map((capability) => capability.status)
    ),
    packageVersion: WCAD_PACKAGE_VERSION,
    fileExtension: WCAD_PACKAGE_EXTENSION,
    sourceIdentityAlgorithm: WCAD_SOURCE_IDENTITY_ALGORITHM,
    documentSchemaVersion,
    canRepresentCurrentSource,
    requiresProjectSchemaMigration,
    ...(requiresProjectSchemaMigration
      ? { nextProjectSchemaVersion: "web-cad.project.v17" as const }
      : {}),
    sourceBoundaryNote: `${SOURCE_BOUNDARY_NOTE} Current units: ${units}.`,
    derivedBoundaryNote: DERIVED_BOUNDARY_NOTE,
    requiredEntryCount: requiredEntries.length,
    requiredEntries,
    optionalCacheEntryCount: optionalCacheEntries.length,
    optionalCacheEntries,
    capabilityCount: capabilities.length,
    capabilities,
    diagnosticCount: diagnostics.length,
    diagnostics
  };
}

function createSupportedCapability(
  capability: Exclude<
    ProjectPackageReadinessQueryResponse["capabilities"][number]["capability"],
    "packageContract"
  >,
  label: string,
  code: ProjectPackageReadinessQueryResponse["diagnostics"][number]["code"],
  message: string
): ProjectPackageReadinessQueryResponse["capabilities"][number] {
  return {
    capability,
    label,
    status: "supported",
    available: true,
    sourceBoundaryNote: SOURCE_BOUNDARY_NOTE,
    derivedBoundaryNote: DERIVED_BOUNDARY_NOTE,
    diagnostics: [
      {
        code,
        status: "supported",
        message
      }
    ]
  };
}

function createDeferredCapability(
  capability: Exclude<
    ProjectPackageReadinessQueryResponse["capabilities"][number]["capability"],
    "packageContract"
  >,
  label: string,
  code: ProjectPackageReadinessQueryResponse["diagnostics"][number]["code"],
  message: string
): ProjectPackageReadinessQueryResponse["capabilities"][number] {
  return {
    capability,
    label,
    status: "deferred",
    available: false,
    sourceBoundaryNote: SOURCE_BOUNDARY_NOTE,
    derivedBoundaryNote: DERIVED_BOUNDARY_NOTE,
    diagnostics: [
      {
        code,
        status: "deferred",
        message
      }
    ]
  };
}

function chooseReadinessStatus(
  statuses: readonly WcadReadinessStatus[]
): WcadReadinessStatus {
  if (statuses.some((status) => status === "unavailable")) {
    return "unavailable";
  }

  if (statuses.some((status) => status === "deferred")) {
    return "deferred";
  }

  return "supported";
}

export async function createWcadSourceIdentity({
  documentSchemaVersion,
  units,
  documentBytes,
  commandsBytes
}: WcadSourceIdentityInput): Promise<WcadSourceIdentity> {
  return {
    algorithm: WCAD_SOURCE_IDENTITY_ALGORITHM,
    sha256: await sha256Hex(
      joinByteParts([
        utf8(`${WCAD_SOURCE_IDENTITY_ALGORITHM}\n`),
        utf8(`packageVersion:${WCAD_PACKAGE_VERSION}\n`),
        utf8(`documentSchemaVersion:${documentSchemaVersion}\n`),
        utf8(`units:${units}\n`),
        utf8(`documentByteLength:${documentBytes.byteLength}\n`),
        documentBytes,
        utf8(`\ncommandsByteLength:${commandsBytes.byteLength}\n`),
        commandsBytes
      ])
    )
  };
}

export function validateWcadManifest(
  value: unknown
): readonly WcadPackageValidationIssue[] {
  if (value === undefined || value === null) {
    return [
      createValidationIssue(
        "WCAD_MISSING_MANIFEST",
        "error",
        "WCAD package is missing manifest.json.",
        "$"
      )
    ];
  }

  if (!isRecord(value)) {
    return [
      createValidationIssue(
        "WCAD_INVALID_MANIFEST",
        "error",
        "WCAD manifest must be a JSON object.",
        "$",
        "object",
        typeof value
      )
    ];
  }

  const issues: WcadPackageValidationIssue[] = [];

  if (value.packageVersion !== WCAD_PACKAGE_VERSION) {
    issues.push(
      createValidationIssue(
        "WCAD_UNSUPPORTED_PACKAGE_VERSION",
        "error",
        "WCAD package version is not supported.",
        "$.packageVersion",
        WCAD_PACKAGE_VERSION,
        typeof value.packageVersion === "string"
          ? value.packageVersion
          : typeof value.packageVersion
      )
    );
  }

  if (!isDocumentUnits(value.units)) {
    issues.push(
      createValidationIssue(
        "WCAD_INVALID_MANIFEST",
        "error",
        "WCAD manifest units must be a supported document unit.",
        "$.units",
        "mm | cm | m | in",
        typeof value.units === "string" ? value.units : typeof value.units
      )
    );
  }

  if (!isRecord(value.document)) {
    issues.push(
      createValidationIssue(
        "WCAD_MISSING_DOCUMENT",
        "error",
        "WCAD manifest is missing document.cbor metadata.",
        "$.document"
      )
    );
  } else {
    issues.push(
      ...validateEntryMetadata(value.document, "document", "$.document")
    );

    if (value.document.path !== WCAD_DOCUMENT_ENTRY_PATH) {
      issues.push(
        createValidationIssue(
          "WCAD_INVALID_PACKAGE_PATH",
          "error",
          "WCAD document entry must use document.cbor.",
          "$.document.path",
          WCAD_DOCUMENT_ENTRY_PATH,
          typeof value.document.path === "string"
            ? value.document.path
            : typeof value.document.path,
          typeof value.document.path === "string"
            ? value.document.path
            : undefined,
          "document"
        )
      );
    }

    if (!isSupportedDocumentSchema(value.document.schemaVersion)) {
      issues.push(
        createValidationIssue(
          "WCAD_UNSUPPORTED_DOCUMENT_SCHEMA",
          "error",
          "WCAD document schema is not supported.",
          "$.document.schemaVersion",
          SUPPORTED_DOCUMENT_SCHEMAS.join(" or "),
          typeof value.document.schemaVersion === "string"
            ? value.document.schemaVersion
            : typeof value.document.schemaVersion,
          undefined,
          "document"
        )
      );
    }
  }

  if (!isRecord(value.commands)) {
    issues.push(
      createValidationIssue(
        "WCAD_MISSING_COMMANDS",
        "error",
        "WCAD manifest is missing commands.cbor metadata.",
        "$.commands"
      )
    );
  } else {
    issues.push(
      ...validateEntryMetadata(value.commands, "commands", "$.commands")
    );

    if (value.commands.path !== WCAD_COMMANDS_ENTRY_PATH) {
      issues.push(
        createValidationIssue(
          "WCAD_INVALID_PACKAGE_PATH",
          "error",
          "WCAD commands entry must use commands.cbor.",
          "$.commands.path",
          WCAD_COMMANDS_ENTRY_PATH,
          typeof value.commands.path === "string"
            ? value.commands.path
            : typeof value.commands.path,
          typeof value.commands.path === "string"
            ? value.commands.path
            : undefined,
          "commands"
        )
      );
    }
  }

  if (!isRecord(value.sourceIdentity)) {
    issues.push(
      createValidationIssue(
        "WCAD_INVALID_MANIFEST",
        "error",
        "WCAD manifest is missing source identity metadata.",
        "$.sourceIdentity"
      )
    );
  } else {
    issues.push(...validateSourceIdentityObject(value.sourceIdentity));
  }

  if (value.cache !== undefined) {
    if (!isRecord(value.cache)) {
      issues.push(
        createValidationIssue(
          "WCAD_INVALID_MANIFEST",
          "error",
          "WCAD cache metadata must be an object when present.",
          "$.cache"
        )
      );
    } else if (
      value.cache.entriesPath !== undefined &&
      value.cache.entriesPath !== "metadata/cache-index.json"
    ) {
      issues.push(
        createValidationIssue(
          "WCAD_INVALID_PACKAGE_PATH",
          "error",
          "WCAD cache index must use metadata/cache-index.json.",
          "$.cache.entriesPath",
          "metadata/cache-index.json",
          typeof value.cache.entriesPath === "string"
            ? value.cache.entriesPath
            : typeof value.cache.entriesPath,
          typeof value.cache.entriesPath === "string"
            ? value.cache.entriesPath
            : undefined,
          "metadata"
        )
      );
    }
  }

  if (value.thumbnail !== undefined) {
    if (!isRecord(value.thumbnail)) {
      issues.push(
        createValidationIssue(
          "WCAD_INVALID_MANIFEST",
          "error",
          "WCAD thumbnail metadata must be an object when present.",
          "$.thumbnail"
        )
      );
    } else {
      issues.push(
        ...validateEntryMetadata(value.thumbnail, "thumbnail", "$.thumbnail")
      );
    }
  }

  return issues;
}

export async function createWcadPackageEntryMetadata({
  path,
  bytes
}: WcadPackageEntryMetadataInput): Promise<WcadPackageEntryMetadata> {
  return {
    path,
    byteLength: bytes.byteLength,
    sha256: await sha256Hex(bytes)
  };
}

export async function validateWcadPackageEntryBytes({
  entry,
  bytes,
  entryRole
}: WcadPackageEntryBytesInput): Promise<readonly WcadPackageValidationIssue[]> {
  const issues: WcadPackageValidationIssue[] = [];

  if (entry.byteLength !== bytes.byteLength) {
    issues.push(
      createValidationIssue(
        "WCAD_BYTE_LENGTH_MISMATCH",
        "error",
        "WCAD package entry byte length does not match manifest metadata.",
        undefined,
        entry.byteLength,
        bytes.byteLength,
        entry.path,
        entryRole
      )
    );
  }

  const actualHash = await sha256Hex(bytes);

  if (entry.sha256 !== actualHash) {
    issues.push(
      createValidationIssue(
        "WCAD_HASH_MISMATCH",
        "error",
        "WCAD package entry SHA-256 does not match manifest metadata.",
        undefined,
        entry.sha256,
        actualHash,
        entry.path,
        entryRole
      )
    );
  }

  return issues;
}

export function validateWcadManifestSourceIdentity(
  manifest: WcadManifestV1,
  computed: WcadSourceIdentity
): readonly WcadPackageValidationIssue[] {
  if (
    manifest.sourceIdentity.algorithm === computed.algorithm &&
    manifest.sourceIdentity.sha256 === computed.sha256
  ) {
    return [];
  }

  return [
    createValidationIssue(
      "WCAD_SOURCE_IDENTITY_MISMATCH",
      "error",
      "WCAD manifest source identity does not match the computed source identity.",
      "$.sourceIdentity.sha256",
      computed.sha256,
      manifest.sourceIdentity.sha256
    )
  ];
}

export function validateWcadPackageCacheEntries(
  entries: readonly unknown[],
  currentSourceIdentity: WcadSourceIdentity
): readonly WcadPackageValidationIssue[] {
  const issues: WcadPackageValidationIssue[] = [];

  entries.forEach((entry, index) => {
    const path = `$.entries[${index}]`;

    if (!isRecord(entry)) {
      issues.push(
        createValidationIssue(
          "WCAD_UNSUPPORTED_CACHE_ENTRY",
          "warning",
          "WCAD cache entry must be an object.",
          path
        )
      );
      return;
    }

    issues.push(...validateEntryMetadata(entry, "cache", path));

    if (!isSupportedCacheArtifactKind(entry.artifactKind)) {
      issues.push(
        createValidationIssue(
          "WCAD_UNSUPPORTED_CACHE_ENTRY",
          "warning",
          "WCAD cache entry artifact kind is not supported by V8.",
          `${path}.artifactKind`,
          SUPPORTED_CACHE_ARTIFACT_KINDS.join(" | "),
          typeof entry.artifactKind === "string"
            ? entry.artifactKind
            : typeof entry.artifactKind,
          typeof entry.path === "string" ? entry.path : undefined,
          "cache"
        )
      );
    }

    if (!isRecord(entry.sourceIdentity)) {
      issues.push(
        createValidationIssue(
          "WCAD_STALE_CACHE_ENTRY",
          "warning",
          "WCAD cache entry is missing source identity metadata.",
          `${path}.sourceIdentity`,
          currentSourceIdentity.sha256,
          "missing",
          typeof entry.path === "string" ? entry.path : undefined,
          "cache"
        )
      );
      return;
    }

    const cacheIdentityAlgorithm = entry.sourceIdentity.algorithm;
    const cacheIdentitySha256 = entry.sourceIdentity.sha256;

    if (
      cacheIdentityAlgorithm !== currentSourceIdentity.algorithm ||
      cacheIdentitySha256 !== currentSourceIdentity.sha256
    ) {
      issues.push(
        createValidationIssue(
          "WCAD_STALE_CACHE_ENTRY",
          "warning",
          "WCAD cache entry source identity does not match the current project source identity.",
          `${path}.sourceIdentity.sha256`,
          currentSourceIdentity.sha256,
          typeof cacheIdentitySha256 === "string"
            ? cacheIdentitySha256
            : typeof cacheIdentitySha256,
          typeof entry.path === "string" ? entry.path : undefined,
          "cache"
        )
      );
    }
  });

  return issues;
}

function validateEntryMetadata(
  value: Record<string, unknown>,
  role: WcadPackageEntryRole,
  path: string
): readonly WcadPackageValidationIssue[] {
  const issues: WcadPackageValidationIssue[] = [];
  const byteLength = value.byteLength;

  if (typeof value.path !== "string" || !isValidWcadPackagePath(value.path)) {
    issues.push(
      createValidationIssue(
        "WCAD_INVALID_PACKAGE_PATH",
        "error",
        "WCAD package entry path must be a relative package path without traversal.",
        `${path}.path`,
        "relative package path",
        typeof value.path === "string" ? value.path : typeof value.path,
        typeof value.path === "string" ? value.path : undefined,
        role
      )
    );
  }

  if (
    typeof byteLength !== "number" ||
    !Number.isSafeInteger(byteLength) ||
    byteLength < 0
  ) {
    issues.push(
      createValidationIssue(
        "WCAD_INVALID_MANIFEST",
        "error",
        "WCAD package entry byteLength must be a non-negative safe integer.",
        `${path}.byteLength`,
        "non-negative safe integer",
        typeof byteLength === "number" ? byteLength : typeof byteLength,
        typeof value.path === "string" ? value.path : undefined,
        role
      )
    );
  }

  if (
    typeof value.sha256 !== "string" ||
    !HEX_SHA256_PATTERN.test(value.sha256)
  ) {
    issues.push(
      createValidationIssue(
        "WCAD_INVALID_MANIFEST",
        "error",
        "WCAD package entry sha256 must be a lowercase SHA-256 hex digest.",
        `${path}.sha256`,
        "64 lowercase hex characters",
        typeof value.sha256 === "string" ? value.sha256 : typeof value.sha256,
        typeof value.path === "string" ? value.path : undefined,
        role
      )
    );
  }

  return issues;
}

function validateSourceIdentityObject(
  value: Record<string, unknown>
): readonly WcadPackageValidationIssue[] {
  const issues: WcadPackageValidationIssue[] = [];

  if (value.algorithm !== WCAD_SOURCE_IDENTITY_ALGORITHM) {
    issues.push(
      createValidationIssue(
        "WCAD_SOURCE_IDENTITY_MISMATCH",
        "error",
        "WCAD source identity algorithm is not supported.",
        "$.sourceIdentity.algorithm",
        WCAD_SOURCE_IDENTITY_ALGORITHM,
        typeof value.algorithm === "string"
          ? value.algorithm
          : typeof value.algorithm
      )
    );
  }

  if (
    typeof value.sha256 !== "string" ||
    !HEX_SHA256_PATTERN.test(value.sha256)
  ) {
    issues.push(
      createValidationIssue(
        "WCAD_INVALID_MANIFEST",
        "error",
        "WCAD source identity sha256 must be a lowercase SHA-256 hex digest.",
        "$.sourceIdentity.sha256",
        "64 lowercase hex characters",
        typeof value.sha256 === "string" ? value.sha256 : typeof value.sha256
      )
    );
  }

  return issues;
}

function isValidWcadPackagePath(path: string): boolean {
  if (
    path.length === 0 ||
    path.startsWith("/") ||
    path.startsWith("\\") ||
    path.includes("\\")
  ) {
    return false;
  }

  return path
    .split("/")
    .every((part) => part !== "" && part !== "." && part !== "..");
}

function isSupportedDocumentSchema(
  value: unknown
): value is WcadDocumentSchemaVersion {
  return (
    typeof value === "string" &&
    SUPPORTED_DOCUMENT_SCHEMAS.includes(value as WcadDocumentSchemaVersion)
  );
}

function isSupportedCacheArtifactKind(
  value: unknown
): value is WcadPackageCacheArtifactKind {
  return (
    typeof value === "string" &&
    SUPPORTED_CACHE_ARTIFACT_KINDS.includes(
      value as WcadPackageCacheArtifactKind
    )
  );
}

function isDocumentUnits(value: unknown): value is DocumentUnits {
  return value === "mm" || value === "cm" || value === "m" || value === "in";
}

function createValidationIssue(
  code: WcadPackageValidationIssueCode,
  severity: WcadPackageValidationIssue["severity"],
  message: string,
  path?: string,
  expected?: string | number,
  received?: string | number,
  entryPath?: string,
  entryRole?: WcadPackageEntryRole
): WcadPackageValidationIssue {
  return {
    code,
    severity,
    message,
    ...(path ? { path } : {}),
    ...(entryPath ? { entryPath } : {}),
    ...(entryRole ? { entryRole } : {}),
    ...(expected !== undefined ? { expected } : {}),
    ...(received !== undefined ? { received } : {})
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function utf8(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function joinByteParts(parts: readonly Uint8Array[]): Uint8Array {
  const byteLength = parts.reduce((total, part) => total + part.byteLength, 0);
  const joined = new Uint8Array(byteLength);
  let offset = 0;

  for (const part of parts) {
    joined.set(part, offset);
    offset += part.byteLength;
  }

  return joined;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const crypto = globalThis.crypto?.subtle;

  if (!crypto) {
    throw new Error("SHA-256 digest support is unavailable in this runtime.");
  }

  const digestInput = new Uint8Array(bytes);
  const digest = await crypto.digest("SHA-256", digestInput.buffer);

  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
