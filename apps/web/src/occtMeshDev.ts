import type { GeometryWorkerSpikeResponse } from "@web-cad/geometry-worker-spike";
import type { MeshRendererBridgeResult } from "@web-cad/renderer-mesh-bridge";
import type { RenderTransform, RenderTriangleMesh } from "@web-cad/renderer";

export interface OcctMeshDevBoxInput {
  readonly id: string;
  readonly dimensions: {
    readonly width: number;
    readonly height: number;
    readonly depth: number;
  };
  readonly transform: RenderTransform;
}

export interface OcctMeshDevMetrics {
  readonly objectId: string;
  readonly occtLoadMs?: number;
  readonly tessellationMs?: number;
  readonly geometryKernelMs?: number;
  readonly workerExecutionMs?: number;
  readonly roundTripMs: number;
  readonly vertexCount: number;
  readonly triangleCount: number;
}

export interface OcctMeshDevResult {
  readonly mesh: RenderTriangleMesh;
  readonly metrics: OcctMeshDevMetrics;
  readonly message: string;
}

export interface OcctMeshDevRuntime {
  tessellateBox(input: OcctMeshDevBoxInput): Promise<OcctMeshDevResult>;
  dispose(): void;
}

export function createOcctMeshDevMetrics(input: {
  readonly objectId: string;
  readonly response: GeometryWorkerSpikeResponse;
  readonly bridgeResult: MeshRendererBridgeResult;
  readonly roundTripMs: number;
}): OcctMeshDevMetrics {
  return {
    objectId: input.objectId,
    occtLoadMs: input.response.timings?.occtLoadMs,
    tessellationMs: input.response.timings?.tessellationMs,
    geometryKernelMs: input.response.timings?.geometryKernelMs,
    workerExecutionMs: input.response.timings?.workerExecutionMs,
    roundTripMs: input.roundTripMs,
    vertexCount: input.bridgeResult.vertexCount,
    triangleCount: input.bridgeResult.triangleCount
  };
}

export function formatMetricMs(value: number | undefined): string {
  if (value === undefined) {
    return "n/a";
  }

  const safeValue = Math.max(0, value);
  return `${safeValue.toFixed(safeValue < 10 ? 2 : 1)} ms`;
}
