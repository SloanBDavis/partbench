import type { CadTransactionHistoryEntry } from "@web-cad/cad-core";
import {
  formatTransactionActor,
  formatTransactionAudit,
  formatTransactionDiffSummary,
  formatTransactionOps,
  formatTransactionStatus,
  getRecentTransactions
} from "../transactionHistoryDisplay";

export interface HistoryPanelProps {
  readonly transactions: readonly CadTransactionHistoryEntry[];
  readonly limit?: number;
}

export function HistoryPanel({ transactions, limit = 6 }: HistoryPanelProps) {
  const recentTransactions = getRecentTransactions(transactions, limit);

  return (
    <section className="history-panel" aria-label="Transaction history">
      <div className="section-heading">
        <h2>History</h2>
        <span>{transactions.length}</span>
      </div>
      {recentTransactions.length === 0 ? (
        <p className="empty-state">No transactions</p>
      ) : (
        <ol className="history-list">
          {recentTransactions.map((transaction) => (
            <li
              key={transaction.id}
              className={`history-card history-${transaction.status}`}
            >
              <div className="history-card-heading">
                <code>{transaction.id}</code>
                <strong>{formatTransactionStatus(transaction.status)}</strong>
              </div>
              <p>{formatTransactionActor(transaction.actor)}</p>
              <p>{formatTransactionAudit(transaction.audit)}</p>
              <p>{formatTransactionOps(transaction.ops)}</p>
              <p className="history-diff">
                {formatTransactionDiffSummary(transaction.diff)}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
