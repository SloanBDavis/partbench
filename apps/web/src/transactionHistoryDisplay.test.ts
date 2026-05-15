import type { CadTransactionHistoryEntry } from "@web-cad/cad-core";
import { describe, expect, it } from "vitest";
import {
  formatTransactionActor,
  formatTransactionDiffSummary,
  formatTransactionOps,
  formatTransactionStatus,
  getRecentTransactions
} from "./transactionHistoryDisplay";

describe("transaction history display helpers", () => {
  it("formats transaction status and actor metadata", () => {
    expect(formatTransactionStatus("committed")).toBe("Committed");
    expect(formatTransactionStatus("undone")).toBe("Undone");
    expect(formatTransactionActor()).toBe("Unknown actor");
    expect(
      formatTransactionActor({
        type: "agent",
        id: "agent-1",
        name: "Fixture Agent"
      })
    ).toBe("Fixture Agent [agent-1] (agent)");
  });

  it("formats operation and diff summaries compactly", () => {
    expect(
      formatTransactionOps([
        {
          op: "scene.createBox",
          label: "Create box box_1",
          objectId: "box_1",
          objectKind: "box"
        },
        {
          op: "scene.updateTransform",
          label: "Update transform for box_1",
          objectId: "box_1",
          objectKind: "box"
        }
      ])
    ).toBe("Create box box_1 + 1 more");
    expect(
      formatTransactionDiffSummary({
        created: [{ id: "box_1", kind: "box" }],
        modified: [],
        deleted: [],
        createdCount: 1,
        modifiedCount: 0,
        deletedCount: 0,
        document: {
          units: {
            before: "mm",
            after: "in",
            mode: "metadataOnly",
            scaleFactor: 1
          }
        }
      })
    ).toBe("1 created, units mm -> in (relabelled)");
  });

  it("returns recent transactions newest first", () => {
    const transactions = [
      createTransaction("txn_1"),
      createTransaction("txn_2"),
      createTransaction("txn_3")
    ];

    expect(
      getRecentTransactions(transactions, 2).map((item) => item.id)
    ).toEqual(["txn_3", "txn_2"]);
  });
});

function createTransaction(id: string): CadTransactionHistoryEntry {
  return {
    id,
    status: "committed",
    opCount: 0,
    ops: [],
    diff: {
      created: [],
      modified: [],
      deleted: [],
      createdCount: 0,
      modifiedCount: 0,
      deletedCount: 0
    }
  };
}
