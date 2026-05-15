import type {
  CadActorMetadata,
  CadOperationSummary,
  CadSemanticDiffSummary,
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

  if (diff.createdCount > 0) {
    parts.push(`${diff.createdCount} created`);
  }

  if (diff.modifiedCount > 0) {
    parts.push(`${diff.modifiedCount} modified`);
  }

  if (diff.deletedCount > 0) {
    parts.push(`${diff.deletedCount} deleted`);
  }

  if (diff.document?.units) {
    parts.push(
      `units ${diff.document.units.before} -> ${diff.document.units.after}`
    );
  }

  return parts.length > 0 ? parts.join(", ") : "No visible diff";
}
