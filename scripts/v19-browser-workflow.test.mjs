import { describe, expect, it } from "vitest";
import {
  createV19GateBBrowserWorkflowResult,
  formatV19GateBBrowserWorkflowSummary,
  V19_GATE_B_BROWSER_REQUIRED_CHECK_IDS
} from "./v19-browser-workflow.mjs";

describe("V19 Gate B browser workflow result", () => {
  it("accepts one passing result for every stable required check", () => {
    const result = createV19GateBBrowserWorkflowResult({
      checks: V19_GATE_B_BROWSER_REQUIRED_CHECK_IDS.map((id) => ({
        id,
        passed: true
      }))
    });

    expect(result.ok).toBe(true);
    expect(result.passedCount).toBe(result.checkCount);
    expect(formatV19GateBBrowserWorkflowSummary(result)).toContain(
      "8/8 checks passed"
    );
  });

  it("reports missing, failed, duplicate, console, and page failures", () => {
    const [first, second] = V19_GATE_B_BROWSER_REQUIRED_CHECK_IDS;
    const result = createV19GateBBrowserWorkflowResult({
      checks: [
        { id: first, passed: true },
        { id: first, passed: true },
        { id: second, passed: false }
      ],
      consoleErrors: ["console exploded"],
      exceptions: ["page exploded"]
    });

    expect(result.ok).toBe(false);
    expect(result.failures).toContain(`Duplicate required check: ${first}`);
    expect(result.failures).toContain(`Failed required check: ${second}`);
    expect(result.failures).toContain("Browser console: console exploded");
    expect(result.failures).toContain("Browser exception: page exploded");
    expect(
      result.failures.some((failure) =>
        failure.startsWith("Missing required check:")
      )
    ).toBe(true);
  });
});
