import type {
  CadBodyExactTopologySnapshot,
  CadTopologyAnchorSourceRecord,
  CadTopologyCheckpointSourceRecord,
  WcadPackageEntryRole,
  WcadPackageValidationIssue,
  WcadTopologyCheckpointSignaturePayload
} from "@web-cad/cad-protocol";

import type {
  CadProject,
  WcadTopologyCheckpointPayload,
  WcadTopologyCheckpointPayloadInput
} from "./index";
import { CanonicalCborDecodeError, decodeCanonicalCbor } from "./canonicalCbor";
import { createWcadV2CheckpointEntryPaths } from "./topologyIdentitySourceContract";

type CheckpointEntryPaths = ReturnType<typeof createWcadV2CheckpointEntryPaths>;

interface DecodedWcadV2CheckpointPayload {
  readonly topologySnapshot?: CadBodyExactTopologySnapshot;
  readonly signaturePayload?: WcadTopologyCheckpointSignaturePayload;
}

interface CheckpointValidationOperations {
  readonly stringify: (value: unknown) => string;
  readonly isCadBodyExactTopologySnapshot: (
    value: unknown
  ) => value is CadBodyExactTopologySnapshot;
}

interface CheckpointSourceEntry {
  readonly checkpoint: CadTopologyCheckpointSourceRecord;
  readonly path: string;
}

interface CollectedCheckpointSources {
  readonly checkpointsById: ReadonlyMap<string, CheckpointSourceEntry>;
  readonly anchorsByCheckpointId: ReadonlyMap<
    string,
    readonly CadTopologyAnchorSourceRecord[]
  >;
  readonly issues: readonly WcadPackageValidationIssue[];
}

export function validateWcadV2CheckpointPayloadInputsForProject(
  project: CadProject,
  checkpointInputs: readonly WcadTopologyCheckpointPayloadInput[],
  operations: CheckpointValidationOperations
): readonly WcadPackageValidationIssue[] {
  const collected = collectCheckpointSources(project, operations.stringify);
  const issues = [...collected.issues];
  const inputCheckpointIds = new Set<string>();

  for (const input of checkpointInputs) {
    let paths: CheckpointEntryPaths;

    try {
      paths = createWcadV2CheckpointEntryPaths(input.checkpointId);
    } catch {
      issues.push(
        createIssue(
          "WCAD_UNSUPPORTED_CHECKPOINT_ENTRY",
          "WCAD v2 checkpoint payload input has an invalid checkpoint id.",
          "$.topologyCheckpoints.checkpointId",
          "package-safe checkpoint id",
          input.checkpointId
        )
      );
      continue;
    }

    if (inputCheckpointIds.has(input.checkpointId)) {
      issues.push(
        createIssue(
          "WCAD_DUPLICATE_ENTRY",
          "WCAD v2 checkpoint payload input duplicates a checkpoint id.",
          "$.topologyCheckpoints",
          undefined,
          input.checkpointId
        )
      );
    }
    inputCheckpointIds.add(input.checkpointId);

    const source = collected.checkpointsById.get(input.checkpointId);
    if (!source) {
      issues.push(
        createIssue(
          "WCAD_UNSUPPORTED_CHECKPOINT_ENTRY",
          "WCAD v2 checkpoint payload input has no matching topologyIdentity source checkpoint record.",
          "$.topologyCheckpoints",
          "source checkpoint record",
          input.checkpointId
        )
      );
    } else {
      validateSourceCheckpointPaths(
        source.checkpoint,
        paths,
        issues,
        source.path
      );
      if (
        input.bodyId !== source.checkpoint.bodyId ||
        input.sourceFeatureId !== source.checkpoint.sourceFeatureId
      ) {
        issues.push(
          createIssue(
            "WCAD_UNSUPPORTED_CHECKPOINT_ENTRY",
            "WCAD v2 checkpoint payload body and source feature must match the authoritative topology checkpoint source record.",
            "$.topologyCheckpoints",
            `${source.checkpoint.bodyId}:${source.checkpoint.sourceFeatureId ?? ""}`,
            `${input.bodyId}:${input.sourceFeatureId ?? ""}`
          )
        );
      }
    }

    const topologySnapshot = validateCheckpointTopologyPayload(
      input.topologyBytes,
      paths.topology,
      issues,
      operations.isCadBodyExactTopologySnapshot
    );
    const signaturePayload = validateCheckpointSignaturePayload(
      input.signatureBytes,
      paths.signature,
      issues
    );

    validateCheckpointPayloadConsistency(
      {
        checkpointId: input.checkpointId,
        topologySnapshot,
        signaturePayload,
        anchors: collected.anchorsByCheckpointId.get(input.checkpointId) ?? []
      },
      issues,
      { topology: paths.topology, signature: paths.signature }
    );
  }

  for (const [checkpointId, source] of collected.checkpointsById) {
    if (!inputCheckpointIds.has(checkpointId)) {
      issues.push(
        createIssue(
          "WCAD_MISSING_CHECKPOINT_ENTRY",
          "WCAD v2 writer requires payload bytes for every topologyIdentity source checkpoint record.",
          source.path,
          checkpointId,
          "missing"
        )
      );
    }
  }

  return issues;
}

export function validateWcadV2CheckpointPayloadSourceLinksForProject(
  project: CadProject,
  decodedByCheckpointId: ReadonlyMap<string, DecodedWcadV2CheckpointPayload>,
  payloads: readonly WcadTopologyCheckpointPayload[],
  operations: CheckpointValidationOperations
): readonly WcadPackageValidationIssue[] {
  const collected = collectCheckpointSources(project, operations.stringify);
  const issues = [...collected.issues];
  const payloadByCheckpointId = new Map(
    payloads.map((payload) => [payload.checkpointId, payload])
  );

  for (const [checkpointId, source] of collected.checkpointsById) {
    const checkpoint = source.checkpoint;
    const decoded = decodedByCheckpointId.get(checkpointId);
    const payload = payloadByCheckpointId.get(checkpointId);
    let paths: CheckpointEntryPaths | undefined;

    try {
      paths = createWcadV2CheckpointEntryPaths(checkpointId);
      validateSourceCheckpointPaths(checkpoint, paths, issues, source.path);
    } catch {
      // Source validation reports invalid checkpoint IDs.
    }

    if (
      payload &&
      (payload.bodyId !== checkpoint.bodyId ||
        payload.sourceFeatureId !== checkpoint.sourceFeatureId)
    ) {
      issues.push(
        createIssue(
          "WCAD_UNSUPPORTED_CHECKPOINT_ENTRY",
          "WCAD v2 checkpoint manifest body and source feature must match the authoritative topology checkpoint source record.",
          "$.topologyIdentity.checkpoints",
          `${checkpoint.bodyId}:${checkpoint.sourceFeatureId ?? ""}`,
          `${payload.bodyId}:${payload.sourceFeatureId ?? ""}`
        )
      );
    }

    validateCheckpointPayloadConsistency(
      {
        checkpointId,
        topologySnapshot: decoded?.topologySnapshot,
        signaturePayload: decoded?.signaturePayload,
        anchors: collected.anchorsByCheckpointId.get(checkpointId) ?? []
      },
      issues,
      {
        topology: paths?.topology ?? checkpoint.topologyEntryPath,
        signature: paths?.signature ?? checkpoint.signatureEntryPath
      }
    );
  }

  for (const payload of payloads) {
    if (!collected.checkpointsById.has(payload.checkpointId)) {
      issues.push(
        createIssue(
          "WCAD_UNSUPPORTED_CHECKPOINT_ENTRY",
          "WCAD v2 checkpoint manifest entry has no matching current-document or history-baseline topology source record.",
          "$.topologyIdentity.checkpoints",
          "authoritative topology checkpoint source record",
          payload.checkpointId
        )
      );
    }
  }

  return issues;
}

export function validateCheckpointTopologyPayload(
  bytes: Uint8Array,
  entryPath: string,
  issues: WcadPackageValidationIssue[],
  isCadBodyExactTopologySnapshot: (
    value: unknown
  ) => value is CadBodyExactTopologySnapshot
): CadBodyExactTopologySnapshot | undefined {
  const payload = decodeCheckpointCborPayload(
    bytes,
    entryPath,
    "checkpoint-topology",
    issues
  );

  if (payload === undefined) {
    return undefined;
  }

  if (!isCadBodyExactTopologySnapshot(payload)) {
    issues.push(
      createIssue(
        "WCAD_UNSUPPORTED_CHECKPOINT_ENTRY",
        "topology.cbor must contain a compatible exact topology snapshot with valid entity descriptors.",
        "$",
        "compatible exact topology snapshot",
        "invalid",
        entryPath,
        "checkpoint-topology"
      )
    );
    return undefined;
  }

  return payload;
}

export function validateCheckpointSignaturePayload(
  bytes: Uint8Array,
  entryPath: string,
  issues: WcadPackageValidationIssue[]
): WcadTopologyCheckpointSignaturePayload | undefined {
  const payload = decodeCheckpointCborPayload(
    bytes,
    entryPath,
    "checkpoint-signature",
    issues
  );

  if (payload === undefined) {
    return undefined;
  }

  if (!isWcadTopologyCheckpointSignaturePayload(payload)) {
    issues.push(
      createIssue(
        "WCAD_UNSUPPORTED_CHECKPOINT_ENTRY",
        "signature.cbor must contain a checkpoint signature payload matching the V13 package contract.",
        "$",
        "checkpoint signature payload",
        "invalid",
        entryPath,
        "checkpoint-signature"
      )
    );
    return undefined;
  }

  return payload;
}

export function validateCheckpointPayloadConsistency(
  input: {
    readonly checkpointId: string;
    readonly topologySnapshot?: CadBodyExactTopologySnapshot;
    readonly signaturePayload?: WcadTopologyCheckpointSignaturePayload;
    readonly anchors: readonly CadTopologyAnchorSourceRecord[];
  },
  issues: WcadPackageValidationIssue[],
  entryPaths: {
    readonly topology: string;
    readonly signature: string;
  }
): void {
  const { topologySnapshot, signaturePayload } = input;

  if (!topologySnapshot || !signaturePayload) {
    return;
  }

  if (signaturePayload.checkpointId !== input.checkpointId) {
    issues.push(
      createIssue(
        "WCAD_UNSUPPORTED_CHECKPOINT_ENTRY",
        "Checkpoint signature payload checkpointId must match the checkpoint entry.",
        "$.checkpointId",
        input.checkpointId,
        signaturePayload.checkpointId,
        entryPaths.signature,
        "checkpoint-signature"
      )
    );
  }

  if (signaturePayload.signature !== topologySnapshot.signature) {
    issues.push(
      createIssue(
        "WCAD_UNSUPPORTED_CHECKPOINT_ENTRY",
        "Checkpoint signature payload must match topology.cbor snapshot signature.",
        "$.signature",
        topologySnapshot.signature,
        signaturePayload.signature,
        entryPaths.signature,
        "checkpoint-signature"
      )
    );
  }

  if (signaturePayload.entityCount !== topologySnapshot.entityCount) {
    issues.push(
      createIssue(
        "WCAD_UNSUPPORTED_CHECKPOINT_ENTRY",
        "Checkpoint signature payload entityCount must match topology.cbor.",
        "$.entityCount",
        topologySnapshot.entityCount,
        signaturePayload.entityCount,
        entryPaths.signature,
        "checkpoint-signature"
      )
    );
  }

  validateCheckpointSignatureEntities(
    topologySnapshot,
    signaturePayload,
    issues,
    entryPaths.signature
  );
  validateCheckpointAnchorPayloadEntities(
    input.anchors,
    topologySnapshot,
    issues,
    entryPaths.topology
  );
}

function decodeCheckpointCborPayload(
  bytes: Uint8Array,
  entryPath: string,
  entryRole: Extract<
    WcadPackageEntryRole,
    "checkpoint-topology" | "checkpoint-signature"
  >,
  issues: WcadPackageValidationIssue[]
): unknown | undefined {
  try {
    return decodeCanonicalCbor(bytes);
  } catch (error) {
    issues.push(
      createIssue(
        "WCAD_UNSUPPORTED_CHECKPOINT_ENTRY",
        error instanceof Error
          ? `${entryPath} could not be decoded: ${error.message}`
          : `${entryPath} could not be decoded.`,
        "$",
        "canonical CBOR checkpoint payload",
        error instanceof CanonicalCborDecodeError ? error.message : "invalid",
        entryPath,
        entryRole
      )
    );
    return undefined;
  }
}

function validateCheckpointSignatureEntities(
  topologySnapshot: CadBodyExactTopologySnapshot,
  signaturePayload: WcadTopologyCheckpointSignaturePayload,
  issues: WcadPackageValidationIssue[],
  entryPath: string
): void {
  const topologyEntitiesById = new Map(
    topologySnapshot.entities.map((entity) => [entity.localId, entity])
  );

  for (const entity of signaturePayload.entities ?? []) {
    const topologyEntity = topologyEntitiesById.get(entity.localId);
    if (!topologyEntity) {
      issues.push(
        createIssue(
          "WCAD_UNSUPPORTED_CHECKPOINT_ENTRY",
          "Checkpoint signature payload entity must exist in topology.cbor.",
          "$.entities",
          "topology entity localId",
          entity.localId,
          entryPath,
          "checkpoint-signature"
        )
      );
    } else if (
      topologyEntity.kind !== entity.kind ||
      topologyEntity.signature !== entity.signature
    ) {
      issues.push(
        createIssue(
          "WCAD_UNSUPPORTED_CHECKPOINT_ENTRY",
          "Checkpoint signature payload entity kind/signature must match topology.cbor.",
          "$.entities",
          `${topologyEntity.kind}:${topologyEntity.signature}`,
          `${entity.kind}:${entity.signature}`,
          entryPath,
          "checkpoint-signature"
        )
      );
    }
  }
}

function validateCheckpointAnchorPayloadEntities(
  anchors: readonly CadTopologyAnchorSourceRecord[],
  topologySnapshot: CadBodyExactTopologySnapshot,
  issues: WcadPackageValidationIssue[],
  entryPath: string
): void {
  const topologyEntitiesById = new Map(
    topologySnapshot.entities.map((entity) => [entity.localId, entity])
  );

  for (const anchor of anchors) {
    const topologyEntity = topologyEntitiesById.get(anchor.checkpointEntityId);
    if (!topologyEntity) {
      issues.push(
        createIssue(
          "WCAD_UNSUPPORTED_CHECKPOINT_ENTRY",
          "Topology anchor source record points to a checkpoint entity missing from topology.cbor.",
          "$.document.topologyIdentity.anchors.checkpointEntityId",
          "checkpoint topology entity",
          anchor.checkpointEntityId,
          entryPath,
          "checkpoint-topology"
        )
      );
    } else if (topologyEntity.kind !== anchor.entityKind) {
      issues.push(
        createIssue(
          "WCAD_UNSUPPORTED_CHECKPOINT_ENTRY",
          "Topology anchor source record entityKind must match topology.cbor entity kind.",
          "$.document.topologyIdentity.anchors.entityKind",
          topologyEntity.kind,
          anchor.entityKind,
          entryPath,
          "checkpoint-topology"
        )
      );
    }
  }
}

function isWcadTopologyCheckpointSignaturePayload(
  value: unknown
): value is WcadTopologyCheckpointSignaturePayload {
  if (
    !isRecord(value) ||
    typeof value.checkpointId !== "string" ||
    value.checkpointId.trim().length === 0 ||
    value.signatureAlgorithm !== "partbench-derived-topology-snapshot-v1" ||
    typeof value.signature !== "string" ||
    value.signature.trim().length === 0 ||
    !isNonNegativeInteger(value.entityCount)
  ) {
    return false;
  }

  if (
    value.entities !== undefined &&
    (!Array.isArray(value.entities) ||
      value.entities.length !== value.entityCount ||
      !value.entities.every(isWcadTopologyCheckpointSignatureEntity) ||
      new Set(value.entities.map((entity) => entity.localId)).size !==
        value.entities.length)
  ) {
    return false;
  }

  return true;
}

function isWcadTopologyCheckpointSignatureEntity(
  value: unknown
): value is NonNullable<
  WcadTopologyCheckpointSignaturePayload["entities"]
>[number] {
  return (
    isRecord(value) &&
    typeof value.localId === "string" &&
    value.localId.trim().length > 0 &&
    isCadBodyExactTopologyEntityKind(value.kind) &&
    typeof value.signature === "string" &&
    value.signature.trim().length > 0
  );
}

function validateSourceCheckpointPaths(
  checkpoint: CadTopologyCheckpointSourceRecord,
  paths: CheckpointEntryPaths,
  issues: WcadPackageValidationIssue[],
  sourcePath = "$.document.topologyIdentity.checkpoints"
): void {
  for (const [property, label, expected, entryRole] of [
    ["brepEntryPath", "B-rep", paths.brep, "checkpoint-brep"],
    ["topologyEntryPath", "topology", paths.topology, "checkpoint-topology"],
    ["signatureEntryPath", "signature", paths.signature, "checkpoint-signature"]
  ] as const) {
    if (checkpoint[property] !== expected) {
      issues.push(
        createIssue(
          "WCAD_INVALID_PACKAGE_PATH",
          `Topology checkpoint source record ${label} path must match its checkpoint id.`,
          `${sourcePath}.${property}`,
          expected,
          checkpoint[property],
          checkpoint[property],
          entryRole
        )
      );
    }
  }
}

function collectCheckpointSources(
  project: CadProject,
  stringify: (value: unknown) => string
): CollectedCheckpointSources {
  const checkpointsById = new Map<string, CheckpointSourceEntry>();
  const anchorsByCheckpointId = new Map<
    string,
    CadTopologyAnchorSourceRecord[]
  >();
  const issues: WcadPackageValidationIssue[] = [];
  const sources = [
    {
      path: "$.document.topologyIdentity",
      snapshot: project.document.topologyIdentity
    },
    {
      path: "$.historyBaseline.topologyIdentity",
      snapshot: project.historyBaseline?.topologyIdentity
    }
  ];

  for (const source of sources) {
    if (!source.snapshot) {
      continue;
    }

    for (const checkpoint of source.snapshot.checkpoints) {
      const existing = checkpointsById.get(checkpoint.checkpointId);
      if (
        existing &&
        stringify(checkpointMetadata(existing.checkpoint)) !==
          stringify(checkpointMetadata(checkpoint))
      ) {
        issues.push(
          createIssue(
            "WCAD_UNSUPPORTED_CHECKPOINT_ENTRY",
            "Current document and history baseline checkpoint records with the same id must have matching package, path, body, feature, and source metadata.",
            `${source.path}.checkpoints`,
            stringify(checkpointMetadata(existing.checkpoint)),
            stringify(checkpointMetadata(checkpoint))
          )
        );
      } else if (!existing) {
        checkpointsById.set(checkpoint.checkpointId, {
          checkpoint,
          path: `${source.path}.checkpoints`
        });
      }
    }

    for (const anchor of source.snapshot.anchors) {
      const anchors = anchorsByCheckpointId.get(anchor.checkpointId) ?? [];
      anchors.push(anchor);
      anchorsByCheckpointId.set(anchor.checkpointId, anchors);
    }
  }

  return { checkpointsById, anchorsByCheckpointId, issues };
}

function checkpointMetadata(
  checkpoint: CadTopologyCheckpointSourceRecord
): Omit<CadTopologyCheckpointSourceRecord, "status" | "diagnostics"> {
  const {
    status: _status,
    diagnostics: _diagnostics,
    ...metadata
  } = checkpoint;
  void _status;
  void _diagnostics;
  return metadata;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isCadBodyExactTopologyEntityKind(value: unknown): boolean {
  return (
    value === "body" ||
    value === "solid" ||
    value === "face" ||
    value === "wire" ||
    value === "edge" ||
    value === "vertex" ||
    value === "loop" ||
    value === "coedge" ||
    value === "axis"
  );
}

function createIssue(
  code: WcadPackageValidationIssue["code"],
  message: string,
  path?: string,
  expected?: string | number,
  received?: string | number,
  entryPath?: string,
  entryRole?: WcadPackageEntryRole
): WcadPackageValidationIssue {
  return {
    code,
    severity: "error",
    message,
    ...(path ? { path } : {}),
    ...(entryPath ? { entryPath } : {}),
    ...(entryRole ? { entryRole } : {}),
    ...(expected !== undefined ? { expected } : {}),
    ...(received !== undefined ? { received } : {})
  };
}
