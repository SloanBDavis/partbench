import {
  CAD_TOPOLOGY_IDENTITY_CONTRACT_VERSION,
  CAD_TOPOLOGY_IDENTITY_PACKAGE_VERSION,
  CAD_TOPOLOGY_IDENTITY_PROJECT_SCHEMA_VERSION,
  CAD_V15_PROJECT_SCHEMA_VERSION,
  CAD_V16_PROJECT_SCHEMA_VERSION,
  CAD_V17_PROJECT_SCHEMA_VERSION,
  WCAD_COMMANDS_ENTRY_PATH,
  WCAD_DOCUMENT_ENTRY_PATH,
  WCAD_SOURCE_IDENTITY_ALGORITHM,
  type CadTopologyIdentityDiagnostic,
  type CadTopologyIdentitySourceSnapshot,
  type WcadManifestV2,
  type WcadPackageEntryMetadata,
  type WcadPackageEntryRole,
  type WcadPackageValidationIssue,
  type WcadSourceIdentity
} from "@web-cad/cad-protocol";
import { SHA256_HEX_PATTERN } from "./sha256";
import { isValidWcadPackagePath } from "./wcadPackagePath";

export const WCAD_CHECKPOINT_ENTRY_PREFIX = "checkpoints";
export const WCAD_CHECKPOINT_BREP_EXTENSION = ".brep";
export const WCAD_CHECKPOINT_TOPOLOGY_EXTENSION = ".topology.cbor";
export const WCAD_CHECKPOINT_SIGNATURE_EXTENSION = ".signature.cbor";

export function createEmptyTopologyIdentitySourceSnapshot(): CadTopologyIdentitySourceSnapshot {
  return {
    schemaVersion: CAD_TOPOLOGY_IDENTITY_PROJECT_SCHEMA_VERSION,
    settings: {
      contractVersion: CAD_TOPOLOGY_IDENTITY_CONTRACT_VERSION,
      matchingPolicy: "evidence-scored-explicit-repair",
      checkpointPolicy: "required-for-topology-anchors",
      minimumAutomaticConfidence: "high",
      allowSilentRetargeting: false
    },
    checkpoints: [],
    anchors: [],
    repairs: []
  };
}

export function createWcadV2CheckpointEntryPaths(checkpointId: string): {
  readonly brep: string;
  readonly topology: string;
  readonly signature: string;
} {
  if (!isValidCheckpointId(checkpointId)) {
    throw new Error(`Invalid topology checkpoint id: ${checkpointId}.`);
  }

  return {
    brep: `${WCAD_CHECKPOINT_ENTRY_PREFIX}/${checkpointId}${WCAD_CHECKPOINT_BREP_EXTENSION}`,
    topology: `${WCAD_CHECKPOINT_ENTRY_PREFIX}/${checkpointId}${WCAD_CHECKPOINT_TOPOLOGY_EXTENSION}`,
    signature: `${WCAD_CHECKPOINT_ENTRY_PREFIX}/${checkpointId}${WCAD_CHECKPOINT_SIGNATURE_EXTENSION}`
  };
}

export function validateTopologyIdentitySourceSnapshot(
  value: unknown
): readonly CadTopologyIdentityDiagnostic[] {
  if (!isRecord(value)) {
    return [
      createTopologyDiagnostic(
        "TOPOLOGY_SOURCE_CONTRACT_INVALID",
        "error",
        "Topology identity source contract must be an object."
      )
    ];
  }

  const issues: CadTopologyIdentityDiagnostic[] = [];

  if (value.schemaVersion !== CAD_TOPOLOGY_IDENTITY_PROJECT_SCHEMA_VERSION) {
    issues.push(
      createTopologyDiagnostic(
        "TOPOLOGY_SOURCE_CONTRACT_INVALID",
        "error",
        "Topology identity source contract must use web-cad.project.v18.",
        {
          expected: CAD_TOPOLOGY_IDENTITY_PROJECT_SCHEMA_VERSION,
          received:
            typeof value.schemaVersion === "string"
              ? value.schemaVersion
              : typeof value.schemaVersion
        }
      )
    );
  }

  if (!isRecord(value.settings)) {
    issues.push(
      createTopologyDiagnostic(
        "TOPOLOGY_SOURCE_CONTRACT_INVALID",
        "error",
        "Topology identity source settings are required."
      )
    );
  } else {
    if (
      value.settings.contractVersion !== CAD_TOPOLOGY_IDENTITY_CONTRACT_VERSION
    ) {
      issues.push(
        createTopologyDiagnostic(
          "TOPOLOGY_SOURCE_CONTRACT_INVALID",
          "error",
          "Topology identity settings use an unsupported contract version.",
          {
            expected: CAD_TOPOLOGY_IDENTITY_CONTRACT_VERSION,
            received:
              typeof value.settings.contractVersion === "string"
                ? value.settings.contractVersion
                : typeof value.settings.contractVersion
          }
        )
      );
    }

    if (value.settings.allowSilentRetargeting !== false) {
      issues.push(
        createTopologyDiagnostic(
          "TOPOLOGY_SOURCE_CONTRACT_INVALID",
          "error",
          "Topology identity source settings must forbid silent retargeting."
        )
      );
    }
  }

  validateRecordArray(value.checkpoints, "checkpoint", issues);
  validateRecordArray(value.anchors, "anchor", issues);
  validateRecordArray(value.repairs, "repair", issues);
  if (Array.isArray(value.checkpoints)) {
    value.checkpoints.forEach((checkpoint) =>
      validateCheckpointSourceRecord(checkpoint, issues)
    );
  }
  validateTopologyIdentitySourceLinks(value, issues);

  return issues;
}

export function validateWcadManifestV2Contract(
  value: unknown
): readonly WcadPackageValidationIssue[] {
  if (!isRecord(value)) {
    return [
      createWcadIssue(
        "WCAD_INVALID_MANIFEST",
        "error",
        "WCAD v2 manifest must be an object.",
        "$",
        "object",
        typeof value
      )
    ];
  }

  const issues: WcadPackageValidationIssue[] = [];

  if (value.packageVersion !== CAD_TOPOLOGY_IDENTITY_PACKAGE_VERSION) {
    issues.push(
      createWcadIssue(
        "WCAD_UNSUPPORTED_PACKAGE_VERSION",
        "error",
        "WCAD v2 manifest must use partbench.wcad.v2.",
        "$.packageVersion",
        CAD_TOPOLOGY_IDENTITY_PACKAGE_VERSION,
        typeof value.packageVersion === "string"
          ? value.packageVersion
          : typeof value.packageVersion
      )
    );
  }

  if (!isRecord(value.document)) {
    issues.push(
      createWcadIssue(
        "WCAD_MISSING_DOCUMENT",
        "error",
        "WCAD v2 manifest is missing document.cbor metadata.",
        "$.document"
      )
    );
  } else {
    issues.push(
      ...validateEntryMetadata(value.document, "document", "$.document")
    );

    if (value.document.path !== WCAD_DOCUMENT_ENTRY_PATH) {
      issues.push(
        createWcadIssue(
          "WCAD_INVALID_PACKAGE_PATH",
          "error",
          "WCAD v2 document entry must use document.cbor.",
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

    if (
      value.document.schemaVersion !==
        CAD_TOPOLOGY_IDENTITY_PROJECT_SCHEMA_VERSION &&
      value.document.schemaVersion !== CAD_V15_PROJECT_SCHEMA_VERSION &&
      value.document.schemaVersion !== CAD_V16_PROJECT_SCHEMA_VERSION &&
      value.document.schemaVersion !== CAD_V17_PROJECT_SCHEMA_VERSION
    ) {
      issues.push(
        createWcadIssue(
          "WCAD_UNSUPPORTED_DOCUMENT_SCHEMA",
          "error",
          "WCAD v2 checkpointed projects must use web-cad.project.v18, web-cad.project.v19, web-cad.project.v20, or web-cad.project.v21.",
          "$.document.schemaVersion",
          `${CAD_TOPOLOGY_IDENTITY_PROJECT_SCHEMA_VERSION}, ${CAD_V15_PROJECT_SCHEMA_VERSION}, ${CAD_V16_PROJECT_SCHEMA_VERSION}, or ${CAD_V17_PROJECT_SCHEMA_VERSION}`,
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
      createWcadIssue(
        "WCAD_MISSING_COMMANDS",
        "error",
        "WCAD v2 manifest is missing commands.cbor metadata.",
        "$.commands"
      )
    );
  } else {
    issues.push(
      ...validateEntryMetadata(value.commands, "commands", "$.commands")
    );

    if (value.commands.path !== WCAD_COMMANDS_ENTRY_PATH) {
      issues.push(
        createWcadIssue(
          "WCAD_INVALID_PACKAGE_PATH",
          "error",
          "WCAD v2 commands entry must use commands.cbor.",
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

  if (!isWcadSourceIdentity(value.sourceIdentity)) {
    issues.push(
      createWcadIssue(
        "WCAD_INVALID_MANIFEST",
        "error",
        "WCAD v2 manifest is missing source identity metadata.",
        "$.sourceIdentity"
      )
    );
  }

  if (!isRecord(value.topologyIdentity)) {
    issues.push(
      createWcadIssue(
        "WCAD_INVALID_MANIFEST",
        "error",
        "WCAD v2 manifest is missing topology identity metadata.",
        "$.topologyIdentity"
      )
    );
    return issues;
  }

  const topologyIdentity = value.topologyIdentity;

  if (
    topologyIdentity.contractVersion !== CAD_TOPOLOGY_IDENTITY_CONTRACT_VERSION
  ) {
    issues.push(
      createWcadIssue(
        "WCAD_INVALID_MANIFEST",
        "error",
        "WCAD v2 topology identity metadata uses an unsupported contract version.",
        "$.topologyIdentity.contractVersion",
        CAD_TOPOLOGY_IDENTITY_CONTRACT_VERSION,
        typeof topologyIdentity.contractVersion === "string"
          ? topologyIdentity.contractVersion
          : typeof topologyIdentity.contractVersion
      )
    );
  }

  if (
    topologyIdentity.projectSchemaVersion !==
    CAD_TOPOLOGY_IDENTITY_PROJECT_SCHEMA_VERSION
  ) {
    issues.push(
      createWcadIssue(
        "WCAD_UNSUPPORTED_DOCUMENT_SCHEMA",
        "error",
        "WCAD v2 topology identity metadata must target web-cad.project.v18.",
        "$.topologyIdentity.projectSchemaVersion",
        CAD_TOPOLOGY_IDENTITY_PROJECT_SCHEMA_VERSION,
        typeof topologyIdentity.projectSchemaVersion === "string"
          ? topologyIdentity.projectSchemaVersion
          : typeof topologyIdentity.projectSchemaVersion
      )
    );
  }

  if (!Array.isArray(topologyIdentity.checkpoints)) {
    issues.push(
      createWcadIssue(
        "WCAD_INVALID_MANIFEST",
        "error",
        "WCAD v2 topology identity checkpoints must be an array.",
        "$.topologyIdentity.checkpoints"
      )
    );
    return issues;
  }

  if (
    topologyIdentity.checkpointCount !== topologyIdentity.checkpoints.length
  ) {
    issues.push(
      createWcadIssue(
        "WCAD_INVALID_MANIFEST",
        "error",
        "WCAD v2 topology identity checkpointCount must match checkpoints length.",
        "$.topologyIdentity.checkpointCount",
        topologyIdentity.checkpoints.length,
        typeof topologyIdentity.checkpointCount === "number"
          ? topologyIdentity.checkpointCount
          : typeof topologyIdentity.checkpointCount
      )
    );
  }

  const sourceIdentity = isWcadSourceIdentity(value.sourceIdentity)
    ? value.sourceIdentity
    : undefined;

  topologyIdentity.checkpoints.forEach((checkpoint, index) => {
    validateCheckpointManifestEntry(
      checkpoint,
      `$.topologyIdentity.checkpoints[${index}]`,
      sourceIdentity,
      issues
    );
  });

  return issues;
}

export function collectWcadV2CheckpointSourceEntries(
  manifest: WcadManifestV2
): readonly WcadPackageEntryMetadata[] {
  return manifest.topologyIdentity.checkpoints.flatMap((checkpoint) => [
    toPackageEntryMetadata(checkpoint.brep),
    toPackageEntryMetadata(checkpoint.topology),
    toPackageEntryMetadata(checkpoint.signature)
  ]);
}

function toPackageEntryMetadata(
  entry: WcadPackageEntryMetadata
): WcadPackageEntryMetadata {
  return {
    path: entry.path,
    byteLength: entry.byteLength,
    sha256: entry.sha256
  };
}

function validateCheckpointManifestEntry(
  value: unknown,
  path: string,
  manifestSourceIdentity: WcadSourceIdentity | undefined,
  issues: WcadPackageValidationIssue[]
): void {
  if (!isRecord(value)) {
    issues.push(
      createWcadIssue(
        "WCAD_UNSUPPORTED_CHECKPOINT_ENTRY",
        "error",
        "WCAD v2 checkpoint entries must be objects.",
        path
      )
    );
    return;
  }

  if (
    typeof value.checkpointId !== "string" ||
    !isValidCheckpointId(value.checkpointId)
  ) {
    issues.push(
      createWcadIssue(
        "WCAD_UNSUPPORTED_CHECKPOINT_ENTRY",
        "error",
        "WCAD v2 checkpoint id must be a package-safe identifier.",
        `${path}.checkpointId`,
        "package-safe checkpoint id",
        typeof value.checkpointId === "string"
          ? value.checkpointId
          : typeof value.checkpointId
      )
    );
    return;
  }

  const expectedPaths = createWcadV2CheckpointEntryPaths(value.checkpointId);

  validateCheckpointPayloadEntry(
    value.brep,
    `${path}.brep`,
    "checkpoint-brep",
    expectedPaths.brep,
    value.checkpointId,
    manifestSourceIdentity,
    issues
  );
  validateCheckpointPayloadEntry(
    value.topology,
    `${path}.topology`,
    "checkpoint-topology",
    expectedPaths.topology,
    value.checkpointId,
    manifestSourceIdentity,
    issues
  );
  validateCheckpointPayloadEntry(
    value.signature,
    `${path}.signature`,
    "checkpoint-signature",
    expectedPaths.signature,
    value.checkpointId,
    manifestSourceIdentity,
    issues
  );
}

function validateCheckpointPayloadEntry(
  value: unknown,
  path: string,
  role: Extract<
    WcadPackageEntryRole,
    "checkpoint-brep" | "checkpoint-topology" | "checkpoint-signature"
  >,
  expectedPath: string,
  checkpointId: string,
  manifestSourceIdentity: WcadSourceIdentity | undefined,
  issues: WcadPackageValidationIssue[]
): void {
  if (!isRecord(value)) {
    issues.push(
      createWcadIssue(
        "WCAD_MISSING_CHECKPOINT_ENTRY",
        "error",
        "WCAD v2 checkpoint payload entry is missing.",
        path,
        "entry metadata",
        "missing",
        expectedPath,
        role
      )
    );
    return;
  }

  issues.push(...validateEntryMetadata(value, role, path));

  if (value.path !== expectedPath) {
    issues.push(
      createWcadIssue(
        "WCAD_INVALID_PACKAGE_PATH",
        "error",
        "WCAD v2 checkpoint payload path must match its checkpoint id and role.",
        `${path}.path`,
        expectedPath,
        typeof value.path === "string" ? value.path : typeof value.path,
        typeof value.path === "string" ? value.path : undefined,
        role
      )
    );
  }

  if (value.checkpointId !== checkpointId) {
    issues.push(
      createWcadIssue(
        "WCAD_UNSUPPORTED_CHECKPOINT_ENTRY",
        "error",
        "WCAD v2 checkpoint payload checkpointId must match its parent checkpoint.",
        `${path}.checkpointId`,
        checkpointId,
        typeof value.checkpointId === "string"
          ? value.checkpointId
          : typeof value.checkpointId,
        typeof value.path === "string" ? value.path : expectedPath,
        role
      )
    );
  }

  if (value.source !== true) {
    issues.push(
      createWcadIssue(
        "WCAD_UNSUPPORTED_CHECKPOINT_ENTRY",
        "error",
        "WCAD v2 checkpoint payloads must be authoritative source entries.",
        `${path}.source`,
        "true",
        typeof value.source === "boolean"
          ? String(value.source)
          : typeof value.source,
        typeof value.path === "string" ? value.path : expectedPath,
        role
      )
    );
  }

  if (!isWcadSourceIdentity(value.sourceIdentity)) {
    issues.push(
      createWcadIssue(
        "WCAD_CHECKPOINT_SOURCE_IDENTITY_MISMATCH",
        "error",
        "WCAD v2 checkpoint payload is missing source identity metadata.",
        `${path}.sourceIdentity`,
        manifestSourceIdentity?.sha256,
        "missing",
        typeof value.path === "string" ? value.path : expectedPath,
        role
      )
    );
    return;
  }

  if (
    manifestSourceIdentity &&
    (value.sourceIdentity.algorithm !== manifestSourceIdentity.algorithm ||
      value.sourceIdentity.sha256 !== manifestSourceIdentity.sha256)
  ) {
    issues.push(
      createWcadIssue(
        "WCAD_CHECKPOINT_SOURCE_IDENTITY_MISMATCH",
        "error",
        "WCAD v2 checkpoint payload source identity must match the manifest source identity.",
        `${path}.sourceIdentity.sha256`,
        manifestSourceIdentity.sha256,
        value.sourceIdentity.sha256,
        typeof value.path === "string" ? value.path : expectedPath,
        role
      )
    );
  }
}

function validateRecordArray(
  value: unknown,
  label: string,
  issues: CadTopologyIdentityDiagnostic[]
): void {
  if (!Array.isArray(value)) {
    issues.push(
      createTopologyDiagnostic(
        "TOPOLOGY_SOURCE_CONTRACT_INVALID",
        "error",
        `Topology identity source ${label} records must be an array.`
      )
    );
  }
}

function validateTopologyIdentitySourceLinks(
  value: Record<string, unknown>,
  issues: CadTopologyIdentityDiagnostic[]
): void {
  if (
    !Array.isArray(value.checkpoints) ||
    !Array.isArray(value.anchors) ||
    !Array.isArray(value.repairs) ||
    !value.checkpoints.every(isRecord) ||
    !value.anchors.every(isRecord) ||
    !value.repairs.every(isRecord)
  ) {
    return;
  }

  const checkpointIds = collectUniqueTopologyIds({
    records: value.checkpoints,
    field: "checkpointId",
    label: "checkpoint",
    issues
  });
  const anchorIds = collectUniqueTopologyIds({
    records: value.anchors,
    field: "anchorId",
    label: "anchor",
    issues
  });
  collectUniqueTopologyIds({
    records: value.repairs,
    field: "repairId",
    label: "repair",
    issues
  });

  for (const anchor of value.anchors) {
    const checkpointId = anchor.checkpointId;
    if (typeof checkpointId === "string" && !checkpointIds.has(checkpointId)) {
      issues.push(
        createTopologyDiagnostic(
          "TOPOLOGY_SOURCE_CONTRACT_INVALID",
          "error",
          `Topology anchor ${String(anchor.anchorId)} targets missing checkpoint ${checkpointId}.`,
          {
            checkpointId,
            anchorId:
              typeof anchor.anchorId === "string" ? anchor.anchorId : undefined,
            expected: "existing checkpoint id",
            received: checkpointId
          }
        )
      );
    }
  }

  for (const repair of value.repairs) {
    const anchorId = repair.anchorId;
    if (typeof anchorId === "string" && !anchorIds.has(anchorId)) {
      issues.push(
        createTopologyDiagnostic(
          "TOPOLOGY_SOURCE_CONTRACT_INVALID",
          "error",
          `Topology repair ${String(repair.repairId)} targets missing anchor ${anchorId}.`,
          {
            anchorId,
            expected: "existing anchor id",
            received: anchorId
          }
        )
      );
    }

    for (const field of [
      "previousCheckpointId",
      "replacementCheckpointId"
    ] as const) {
      const checkpointId = repair[field];
      if (
        typeof checkpointId === "string" &&
        !checkpointIds.has(checkpointId)
      ) {
        issues.push(
          createTopologyDiagnostic(
            "TOPOLOGY_SOURCE_CONTRACT_INVALID",
            "error",
            `Topology repair ${String(repair.repairId)} targets missing ${field} ${checkpointId}.`,
            {
              checkpointId,
              anchorId: typeof anchorId === "string" ? anchorId : undefined,
              expected: "existing checkpoint id",
              received: checkpointId
            }
          )
        );
      }
    }
  }
}

function validateCheckpointSourceRecord(
  value: unknown,
  issues: CadTopologyIdentityDiagnostic[]
): void {
  if (!isRecord(value)) {
    issues.push(
      createTopologyDiagnostic(
        "TOPOLOGY_SOURCE_CONTRACT_INVALID",
        "error",
        "Topology checkpoint source record must be an object."
      )
    );
    return;
  }

  const checkpointId =
    typeof value.checkpointId === "string" ? value.checkpointId : undefined;

  if (!checkpointId || !isValidCheckpointId(checkpointId)) {
    issues.push(
      createTopologyDiagnostic(
        "TOPOLOGY_SOURCE_CONTRACT_INVALID",
        "error",
        "Topology checkpoint source record id must be package-safe.",
        {
          checkpointId,
          expected: "package-safe checkpoint id",
          received: typeof value.checkpointId
        }
      )
    );
    return;
  }

  if (typeof value.bodyId !== "string" || value.bodyId.length === 0) {
    issues.push(
      createTopologyDiagnostic(
        "TOPOLOGY_SOURCE_CONTRACT_INVALID",
        "error",
        `Topology checkpoint ${checkpointId} must target an existing source body id.`,
        {
          checkpointId,
          expected: "body id",
          received: typeof value.bodyId
        }
      )
    );
  }

  if (
    value.sourceFeatureId !== undefined &&
    (typeof value.sourceFeatureId !== "string" ||
      value.sourceFeatureId.length === 0)
  ) {
    issues.push(
      createTopologyDiagnostic(
        "TOPOLOGY_SOURCE_CONTRACT_INVALID",
        "error",
        `Topology checkpoint ${checkpointId} sourceFeatureId must be a non-empty string when present.`,
        {
          checkpointId,
          expected: "feature id",
          received: typeof value.sourceFeatureId
        }
      )
    );
  }

  if (!isWcadSourceIdentity(value.sourceIdentity)) {
    issues.push(
      createTopologyDiagnostic(
        "TOPOLOGY_SOURCE_CONTRACT_INVALID",
        "error",
        `Topology checkpoint ${checkpointId} must include a valid source identity.`,
        {
          checkpointId,
          expected: WCAD_SOURCE_IDENTITY_ALGORITHM,
          received: typeof value.sourceIdentity
        }
      )
    );
  }

  if (value.packageVersion !== CAD_TOPOLOGY_IDENTITY_PACKAGE_VERSION) {
    issues.push(
      createTopologyDiagnostic(
        "TOPOLOGY_SOURCE_CONTRACT_INVALID",
        "error",
        `Topology checkpoint ${checkpointId} must use the topology package version.`,
        {
          checkpointId,
          expected: CAD_TOPOLOGY_IDENTITY_PACKAGE_VERSION,
          received:
            typeof value.packageVersion === "string"
              ? value.packageVersion
              : typeof value.packageVersion
        }
      )
    );
  }

  if (
    value.projectSchemaVersion !== CAD_TOPOLOGY_IDENTITY_PROJECT_SCHEMA_VERSION
  ) {
    issues.push(
      createTopologyDiagnostic(
        "TOPOLOGY_SOURCE_CONTRACT_INVALID",
        "error",
        `Topology checkpoint ${checkpointId} must target web-cad.project.v18.`,
        {
          checkpointId,
          expected: CAD_TOPOLOGY_IDENTITY_PROJECT_SCHEMA_VERSION,
          received:
            typeof value.projectSchemaVersion === "string"
              ? value.projectSchemaVersion
              : typeof value.projectSchemaVersion
        }
      )
    );
  }

  const expectedPaths = createWcadV2CheckpointEntryPaths(checkpointId);
  validateCheckpointSourcePath(
    value.brepEntryPath,
    expectedPaths.brep,
    checkpointId,
    issues
  );
  validateCheckpointSourcePath(
    value.topologyEntryPath,
    expectedPaths.topology,
    checkpointId,
    issues
  );
  validateCheckpointSourcePath(
    value.signatureEntryPath,
    expectedPaths.signature,
    checkpointId,
    issues
  );

  if (!isCheckpointSourceStatus(value.status)) {
    issues.push(
      createTopologyDiagnostic(
        "TOPOLOGY_SOURCE_CONTRACT_INVALID",
        "error",
        `Topology checkpoint ${checkpointId} has an invalid source status.`,
        {
          checkpointId,
          expected: "active, stale, missing, failed, or unsupported",
          received:
            typeof value.status === "string"
              ? value.status
              : typeof value.status
        }
      )
    );
  }

  if (!Array.isArray(value.diagnostics)) {
    issues.push(
      createTopologyDiagnostic(
        "TOPOLOGY_SOURCE_CONTRACT_INVALID",
        "error",
        `Topology checkpoint ${checkpointId} diagnostics must be an array.`,
        {
          checkpointId,
          expected: "diagnostic array",
          received: typeof value.diagnostics
        }
      )
    );
  }
}

function validateCheckpointSourcePath(
  value: unknown,
  expected: string,
  checkpointId: string,
  issues: CadTopologyIdentityDiagnostic[]
): void {
  if (value !== expected) {
    issues.push(
      createTopologyDiagnostic(
        "TOPOLOGY_SOURCE_CONTRACT_INVALID",
        "error",
        `Topology checkpoint ${checkpointId} source path must match its checkpoint id.`,
        {
          checkpointId,
          expected,
          received: typeof value === "string" ? value : typeof value
        }
      )
    );
  }
}

function isCheckpointSourceStatus(value: unknown): boolean {
  return (
    value === "active" ||
    value === "stale" ||
    value === "missing" ||
    value === "failed" ||
    value === "unsupported"
  );
}

function collectUniqueTopologyIds(args: {
  readonly records: readonly Record<string, unknown>[];
  readonly field: string;
  readonly label: string;
  readonly issues: CadTopologyIdentityDiagnostic[];
}): ReadonlySet<string> {
  const ids = new Set<string>();

  for (const record of args.records) {
    const id = record[args.field];
    if (typeof id !== "string" || id.length === 0) {
      args.issues.push(
        createTopologyDiagnostic(
          "TOPOLOGY_SOURCE_CONTRACT_INVALID",
          "error",
          `Topology identity ${args.label} record is missing ${args.field}.`,
          {
            expected: "non-empty string",
            received: typeof id
          }
        )
      );
      continue;
    }

    if (ids.has(id)) {
      args.issues.push(
        createTopologyDiagnostic(
          "TOPOLOGY_SOURCE_CONTRACT_INVALID",
          "error",
          `Duplicate topology identity ${args.label} id: ${id}.`,
          {
            expected: "unique id",
            received: id
          }
        )
      );
    }

    ids.add(id);
  }

  return ids;
}

function validateEntryMetadata(
  value: Record<string, unknown>,
  role: WcadPackageEntryRole,
  path: string
): readonly WcadPackageValidationIssue[] {
  const issues: WcadPackageValidationIssue[] = [];

  if (typeof value.path !== "string" || !isValidWcadPackagePath(value.path)) {
    issues.push(
      createWcadIssue(
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
    typeof value.byteLength !== "number" ||
    !Number.isSafeInteger(value.byteLength) ||
    value.byteLength < 0
  ) {
    issues.push(
      createWcadIssue(
        "WCAD_INVALID_MANIFEST",
        "error",
        "WCAD package entry byteLength must be a non-negative safe integer.",
        `${path}.byteLength`,
        "non-negative safe integer",
        typeof value.byteLength === "number"
          ? value.byteLength
          : typeof value.byteLength,
        typeof value.path === "string" ? value.path : undefined,
        role
      )
    );
  }

  if (
    typeof value.sha256 !== "string" ||
    !SHA256_HEX_PATTERN.test(value.sha256)
  ) {
    issues.push(
      createWcadIssue(
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

function createTopologyDiagnostic(
  code: CadTopologyIdentityDiagnostic["code"],
  severity: CadTopologyIdentityDiagnostic["severity"],
  message: string,
  details: Pick<
    CadTopologyIdentityDiagnostic,
    "anchorId" | "checkpointId" | "expected" | "received"
  > = {}
): CadTopologyIdentityDiagnostic {
  return {
    code,
    status: severity === "error" ? "unavailable" : "supported",
    severity,
    message,
    ...details
  };
}

function createWcadIssue(
  code: WcadPackageValidationIssue["code"],
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

function isWcadSourceIdentity(value: unknown): value is WcadSourceIdentity {
  return (
    isRecord(value) &&
    value.algorithm === WCAD_SOURCE_IDENTITY_ALGORITHM &&
    typeof value.sha256 === "string" &&
    SHA256_HEX_PATTERN.test(value.sha256)
  );
}

function isValidCheckpointId(checkpointId: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(checkpointId);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
