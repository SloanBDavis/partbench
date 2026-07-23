export const PARTBENCH_GEOMETRY_DIAGNOSTIC_EVENT =
  "partbench:geometry-diagnostic";

export type GeometryDiagnosticEventDetail =
  | {
      readonly phase: "command-committed";
      readonly timestamp: number;
    }
  | {
      readonly phase: "display-snapshot" | "exact-snapshot";
      readonly timestamp: number;
      readonly supportedCount: number;
      readonly pendingCount: number;
      readonly readyCount: number;
      readonly errorCount: number;
      readonly entries: readonly {
        readonly id: string;
        readonly cacheKey: string;
        readonly status: string;
      }[];
    }
  | {
      readonly phase: "worker-job";
      readonly timestamp: number;
      readonly job: {
        readonly phase: string;
        readonly runId: number;
        readonly generation: number;
        readonly intent: string;
        readonly operation: string;
        readonly sourceId?: string;
        readonly documentRevision?: number;
        readonly cacheKey?: string;
        readonly userKind?: string;
        readonly queueMs?: number;
        readonly executionMs?: number;
        readonly outcome?: string;
      };
    };

interface GeometryDiagnosticTarget {
  dispatchEvent(event: Event): boolean;
}

export function emitGeometryDiagnosticEvent(
  detail: GeometryDiagnosticEventDetail,
  target: GeometryDiagnosticTarget | null | undefined = typeof window ===
  "undefined"
    ? undefined
    : window
): void {
  if (!target || typeof CustomEvent === "undefined") {
    return;
  }

  target.dispatchEvent(
    new CustomEvent<GeometryDiagnosticEventDetail>(
      PARTBENCH_GEOMETRY_DIAGNOSTIC_EVENT,
      { detail }
    )
  );
}
