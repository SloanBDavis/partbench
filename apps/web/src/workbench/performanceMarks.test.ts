import { describe, expect, it, vi } from "vitest";
import {
  markPartbenchPerformance,
  PARTBENCH_PERFORMANCE_MARKS
} from "./performanceMarks";

describe("workbench performance marks", () => {
  it("replaces the prior sample before recording the current one", () => {
    const target = { mark: vi.fn(), clearMarks: vi.fn() };

    expect(
      markPartbenchPerformance(PARTBENCH_PERFORMANCE_MARKS.shellReady, target)
    ).toBe(true);
    expect(target.clearMarks).toHaveBeenCalledWith("partbench:shell-ready");
    expect(target.mark).toHaveBeenCalledWith("partbench:shell-ready");
  });

  it("is safe when the Performance API is unavailable", () => {
    expect(
      markPartbenchPerformance(PARTBENCH_PERFORMANCE_MARKS.pendingVisible, null)
    ).toBe(false);
  });
});
