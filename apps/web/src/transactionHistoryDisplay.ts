import type {
  CadActorMetadata,
  CadOperationSummary,
  CadSemanticDiffSummary,
  CadTransactionAuditMetadata,
  CadTransactionHistoryEntry,
  CadTransactionStatus
} from "@web-cad/cad-core";

export function getRecentTransactions(
  transactions: readonly CadTransactionHistoryEntry[],
  limit: number
): readonly CadTransactionHistoryEntry[] {
  return [...transactions].slice(-Math.max(0, limit)).reverse();
}

export function formatTransactionStatus(status: CadTransactionStatus): string {
  return status === "committed" ? "Committed" : "Undone";
}

export function formatTransactionActor(actor?: CadActorMetadata): string {
  if (!actor) {
    return "Unknown actor";
  }

  const identity = actor.name ?? actor.id ?? actor.type;
  const idSuffix = actor.name && actor.id ? ` [${actor.id}]` : "";

  return `${identity}${idSuffix} (${actor.type})`;
}

export function formatTransactionAudit(
  audit?: CadTransactionAuditMetadata
): string {
  if (!audit) {
    return "No audit source";
  }

  const parts = [
    audit.source ? `source: ${audit.source}` : undefined,
    audit.toolName ? `tool: ${audit.toolName}` : undefined,
    audit.requestId ? `request: ${audit.requestId}` : undefined,
    `intent: ${audit.intent}`,
    `ops: ${audit.operationCount}`
  ].filter((part): part is string => Boolean(part));

  return parts.join(" | ");
}

export function formatTransactionOps(
  ops: readonly CadOperationSummary[]
): string {
  const firstOp = ops[0];

  if (!firstOp) {
    return "No operations";
  }

  return ops.length === 1
    ? firstOp.label
    : `${firstOp.label} + ${ops.length - 1} more`;
}

export function formatTransactionDiffSummary(
  diff: CadSemanticDiffSummary
): string {
  const parts: string[] = [];
  const referenceDiff = diff.references as
    | ReferenceDiffWithModified
    | undefined;

  if (diff.createdCount > 0) {
    parts.push(`${diff.createdCount} created`);
  }

  if (diff.modifiedCount > 0) {
    parts.push(`${diff.modifiedCount} modified`);
  }

  if (diff.deletedCount > 0) {
    parts.push(`${diff.deletedCount} deleted`);
  }

  pushCountSummary(
    parts,
    diff.sketches?.created?.length,
    "sketch created",
    "sketches created"
  );
  pushCountSummary(
    parts,
    diff.sketches?.modified?.length,
    "sketch modified",
    "sketches modified"
  );
  pushCountSummary(
    parts,
    diff.sketches?.deleted?.length,
    "sketch deleted",
    "sketches deleted"
  );
  pushCountSummary(
    parts,
    diff.sketches?.entitiesCreated?.length,
    "sketch entity created",
    "sketch entities created"
  );
  pushCountSummary(
    parts,
    diff.sketches?.entitiesModified?.length,
    "sketch entity modified",
    "sketch entities modified"
  );
  pushCountSummary(
    parts,
    diff.sketches?.entitiesDeleted?.length,
    "sketch entity deleted",
    "sketch entities deleted"
  );
  pushCountSummary(
    parts,
    diff.features?.created?.length,
    "feature created",
    "features created"
  );
  pushCountSummary(
    parts,
    diff.features?.modified?.length,
    "feature modified",
    "features modified"
  );
  pushIdSummary(
    parts,
    diff.features?.deleted?.map((feature) => feature.id),
    "feature deleted",
    "features deleted"
  );
  pushCountSummary(
    parts,
    diff.features?.bodiesCreated?.length,
    "body created",
    "bodies created"
  );
  pushCountSummary(
    parts,
    diff.features?.bodiesModified?.length,
    "body modified",
    "bodies modified"
  );
  pushIdSummary(
    parts,
    diff.features?.bodiesDeleted?.map((body) => body.id),
    "body deleted",
    "bodies deleted"
  );
  pushNamedReferenceSummary(
    parts,
    mergeReferenceRefs(referenceDiff?.namedCreated, referenceDiff?.created),
    "named reference created",
    "named references created"
  );
  pushNamedReferenceSummary(
    parts,
    mergeReferenceRefs(referenceDiff?.namedModified, referenceDiff?.modified),
    "named reference modified",
    "named references modified"
  );
  pushNamedReferenceSummary(
    parts,
    mergeReferenceRefs(referenceDiff?.namedDeleted, referenceDiff?.deleted),
    "named reference deleted",
    "named references deleted"
  );

  if (diff.document?.units) {
    const mode =
      diff.document.units.mode === "preservePhysicalSize"
        ? "converted"
        : "relabelled";
    parts.push(
      `units ${diff.document.units.before} -> ${diff.document.units.after} (${mode})`
    );
  }

  return parts.length > 0 ? parts.join(", ") : "No visible diff";
}

type NamedReferenceDiffRef = {
  readonly name: string;
};

type ReferenceDiffWithModified = NonNullable<
  CadSemanticDiffSummary["references"]
> & {
  readonly created?: readonly NamedReferenceDiffRef[];
  readonly modified?: readonly NamedReferenceDiffRef[];
  readonly deleted?: readonly NamedReferenceDiffRef[];
  readonly namedModified?: readonly NamedReferenceDiffRef[];
};

function pushCountSummary(
  parts: string[],
  count: number | undefined,
  singular: string,
  plural: string
): void {
  if (!count) {
    return;
  }

  parts.push(`${count} ${count === 1 ? singular : plural}`);
}

function pushIdSummary(
  parts: string[],
  ids: readonly string[] | undefined,
  singular: string,
  plural: string
): void {
  if (!ids?.length) {
    return;
  }

  parts.push(
    `${ids.length} ${ids.length === 1 ? singular : plural} (${ids.join(", ")})`
  );
}

function mergeReferenceRefs(
  primary: readonly NamedReferenceDiffRef[] | undefined,
  fallback: readonly NamedReferenceDiffRef[] | undefined
): readonly NamedReferenceDiffRef[] | undefined {
  return primary && primary.length > 0 ? primary : fallback;
}

function pushNamedReferenceSummary(
  parts: string[],
  refs: readonly NamedReferenceDiffRef[] | undefined,
  singular: string,
  plural: string
): void {
  if (!refs?.length) {
    return;
  }

  parts.push(
    `${refs.length} ${refs.length === 1 ? singular : plural} (${refs
      .map((ref) => ref.name)
      .join(", ")})`
  );
}
