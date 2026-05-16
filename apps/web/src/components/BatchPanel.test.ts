import { describe, expect, it } from "vitest";
import { formatBatchModeLabel } from "./batchDisplay";

describe("BatchPanel helpers", () => {
  it("formats batch response modes for users", () => {
    expect(formatBatchModeLabel("dryRun")).toBe("Dry run");
    expect(formatBatchModeLabel("commit")).toBe("Commit");
  });
});
