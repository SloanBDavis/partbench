import { describe, expect, it } from "vitest";
import {
  createV19GateBBrowserWorkflowResult,
  createV19GateCBrowserWorkflowResult,
  createV19GateEBrowserWorkflowResult,
  createV19BrowserWorkflowResult,
  formatV19GateBBrowserWorkflowSummary,
  formatV19GateCBrowserWorkflowSummary,
  formatV19GateEBrowserWorkflowSummary,
  formatV19BrowserWorkflowSummary,
  V19_GATE_B_BROWSER_REQUIRED_CHECK_IDS,
  V19_GATE_C_BROWSER_ACTION_IDS,
  V19_GATE_C_BROWSER_REQUIRED_CHECK_IDS,
  V19_GATE_E_BROWSER_REQUIRED_CHECK_IDS,
  V19_BROWSER_REQUIRED_CHECK_IDS
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

describe("V19 combined browser workflow result", () => {
  it("requires both gate contracts and reports one combined production run", () => {
    expect(V19_BROWSER_REQUIRED_CHECK_IDS).toEqual([
      ...V19_GATE_B_BROWSER_REQUIRED_CHECK_IDS,
      ...V19_GATE_C_BROWSER_REQUIRED_CHECK_IDS,
      ...V19_GATE_E_BROWSER_REQUIRED_CHECK_IDS
    ]);

    const result = createV19BrowserWorkflowResult({
      checks: V19_BROWSER_REQUIRED_CHECK_IDS.map((id) => ({
        id,
        passed: true
      }))
    });

    expect(result.ok).toBe(true);
    expect(result.workflowVersion).toBe("partbench.v19-browser-workflow.v3");
    expect(formatV19BrowserWorkflowSummary(result)).toContain(
      "24/24 checks passed"
    );
  });
});

describe("V19 Gate C browser workflow result", () => {
  it("freezes the three product action IDs without reusing Gate B checks", () => {
    expect(V19_GATE_C_BROWSER_ACTION_IDS).toEqual([
      "sketch.offset",
      "sketch.slot",
      "sketch.rounded-rectangle"
    ]);
    expect(
      V19_GATE_C_BROWSER_REQUIRED_CHECK_IDS.some((id) =>
        V19_GATE_B_BROWSER_REQUIRED_CHECK_IDS.includes(id)
      )
    ).toBe(false);
  });

  it("accepts one passing result for every stable required check", () => {
    const result = createV19GateCBrowserWorkflowResult({
      checks: V19_GATE_C_BROWSER_REQUIRED_CHECK_IDS.map((id) => ({
        id,
        passed: true
      }))
    });

    expect(result.ok).toBe(true);
    expect(result.workflowVersion).toBe(
      "partbench.v19-gate-c-browser-workflow.v1"
    );
    expect(result.passedCount).toBe(result.checkCount);
    expect(formatV19GateCBrowserWorkflowSummary(result)).toContain(
      "8/8 checks passed"
    );
  });

  it("reports missing, failed, duplicate, console, and page failures", () => {
    const [first, second] = V19_GATE_C_BROWSER_REQUIRED_CHECK_IDS;
    const result = createV19GateCBrowserWorkflowResult({
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

describe("V19 Gate E browser workflow result", () => {
  it("freezes selection and validation without a feature-mutation check", () => {
    expect(V19_GATE_E_BROWSER_REQUIRED_CHECK_IDS).toEqual([
      "v19-gate-e-production-action",
      "v19-gate-e-exact-candidates",
      "v19-gate-e-even-odd-surface",
      "v19-gate-e-pointer-keyboard-selection",
      "v19-gate-e-consumer-count-policy",
      "v19-gate-e-exact-validation-no-feature",
      "v19-gate-e-cancel-escape-no-mutation",
      "v19-gate-e-query-worker-occt-deferral"
    ]);
    expect(
      V19_GATE_E_BROWSER_REQUIRED_CHECK_IDS.some((id) =>
        /extrude|revolve|feature-created/.test(id)
      )
    ).toBe(false);
  });

  it("accepts one passing result for every stable required check", () => {
    const result = createV19GateEBrowserWorkflowResult({
      checks: V19_GATE_E_BROWSER_REQUIRED_CHECK_IDS.map((id) => ({
        id,
        passed: true
      }))
    });

    expect(result.ok).toBe(true);
    expect(result.workflowVersion).toBe(
      "partbench.v19-gate-e-browser-workflow.v1"
    );
    expect(result.passedCount).toBe(result.checkCount);
    expect(formatV19GateEBrowserWorkflowSummary(result)).toContain(
      "8/8 checks passed"
    );
  });

  it("reports missing, failed, duplicate, console, and page failures", () => {
    const [first, second] = V19_GATE_E_BROWSER_REQUIRED_CHECK_IDS;
    const result = createV19GateEBrowserWorkflowResult({
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
