import type { CadBatchResponse } from "@web-cad/cad-protocol";

export function formatBatchModeLabel(mode: CadBatchResponse["mode"]): string {
  return mode === "dryRun" ? "Dry run" : "Commit";
}
