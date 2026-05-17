import type { CadTransactionHistoryEntry } from "@web-cad/cad-core";
import { describe, expect, it } from "vitest";
import {
  formatTransactionActor,
  formatTransactionAudit,
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
    expect(formatTransactionAudit()).toBe("No audit source");
    expect(
      formatTransactionAudit({
        source: "mcp",
        requestId: "request-1",
        toolName: "cad.batch",
        intent: "commit",
        operationCount: 3
      })
    ).toBe(
      "source: mcp | tool: cad.batch | request: request-1 | intent: commit | ops: 3"
    );
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
    expect(
      formatTransactionDiffSummary({
        created: [],
        modified: [],
        deleted: [],
        createdCount: 0,
        modifiedCount: 0,
        deletedCount: 0,
        sketches: {
          created: [{ id: "sketch_1" }],
          modified: [],
          deleted: [],
          entitiesCreated: [
            { sketchId: "sketch_1", id: "skent_1", kind: "rectangle" }
          ],
          entitiesModified: [],
          entitiesDeleted: []
        },
        features: {
          created: [
            {
              id: "feat_1",
              kind: "extrude",
              bodyId: "body_1",
              sketchId: "sketch_1",
              entityId: "skent_1",
              profileKind: "rectangle"
            }
          ],
          modified: [],
          deleted: [],
          bodiesCreated: [{ id: "body_1", kind: "solid", featureId: "feat_1" }],
          bodiesModified: [],
          bodiesDeleted: []
        }
      })
    ).toBe(
      "1 sketch created, 1 sketch entity created, 1 feature created, 1 body created"
    );
  });

  it("formats authored feature delete IDs in history summaries", () => {
    expect(
      formatTransactionOps([
        {
          op: "feature.delete",
          label: "Delete feature feat_1 and body body_1",
          featureId: "feat_1",
          bodyId: "body_1",
          sketchId: "sketch_1",
          sketchEntityId: "rect_1"
        }
      ])
    ).toBe("Delete feature feat_1 and body body_1");
    expect(
      formatTransactionDiffSummary({
        created: [],
        modified: [],
        deleted: [],
        createdCount: 0,
        modifiedCount: 0,
        deletedCount: 0,
        features: {
          created: [],
          modified: [],
          deleted: [
            {
              id: "feat_1",
              kind: "extrude",
              bodyId: "body_1",
              sketchId: "sketch_1",
              entityId: "rect_1",
              profileKind: "rectangle"
            }
          ],
          bodiesCreated: [],
          bodiesModified: [],
          bodiesDeleted: [
            {
              id: "body_1",
              kind: "solid",
              featureId: "feat_1"
            }
          ]
        }
      })
    ).toBe("1 feature deleted (feat_1), 1 body deleted (body_1)");
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
