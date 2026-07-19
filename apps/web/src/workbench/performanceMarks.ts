export const PARTBENCH_PERFORMANCE_MARKS = {
  shellReady: "partbench:shell-ready",
  pendingVisible: "partbench:pending-visible",
  modeChangeStart: "partbench:mode-change-start",
  modeChangeEnd: "partbench:mode-change-end",
  selectionStart: "partbench:selection-start",
  selectionEnd: "partbench:selection-end",
  commandSearchStart: "partbench:command-search-start",
  commandSearchResults: "partbench:command-search-results"
} as const;

export type PartbenchPerformanceMark =
  (typeof PARTBENCH_PERFORMANCE_MARKS)[keyof typeof PARTBENCH_PERFORMANCE_MARKS];

export interface PerformanceMarkTarget {
  mark(name: string): unknown;
  clearMarks?(name: string): void;
}

/** Records one current sample instead of accumulating unbounded marks. */
export function markPartbenchPerformance(
  name: PartbenchPerformanceMark,
  target: PerformanceMarkTarget | null | undefined = getPerformanceTarget()
): boolean {
  if (!target) {
    return false;
  }

  target.clearMarks?.(name);
  target.mark(name);
  return true;
}

function getPerformanceTarget(): PerformanceMarkTarget | undefined {
  return typeof performance === "undefined" ? undefined : performance;
}
