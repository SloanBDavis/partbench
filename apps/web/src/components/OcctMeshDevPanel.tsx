import {
  formatMetricMs,
  type OcctMeshDevErrorDetails,
  type OcctMeshDevMetrics
} from "../occtMeshDev";

export interface OcctMeshDevPanelProps {
  readonly commandPending: boolean;
  readonly canTessellateSelectedBox: boolean;
  readonly meshCount: number;
  readonly pending: boolean;
  readonly message?: string;
  readonly error?: OcctMeshDevErrorDetails;
  readonly metrics?: OcctMeshDevMetrics;
  readonly onTessellateSelectedBox: () => void;
  readonly onClearMesh: () => void;
}

export function OcctMeshDevPanel({
  commandPending,
  canTessellateSelectedBox,
  meshCount,
  pending,
  message,
  error,
  metrics,
  onTessellateSelectedBox,
  onClearMesh
}: OcctMeshDevPanelProps) {
  return (
    <section className="occt-panel" aria-label="OCCT mesh dev tools">
      <h2>OCCT Mesh Dev</h2>
      <div className="button-row">
        <button
          type="button"
          onClick={onTessellateSelectedBox}
          disabled={commandPending || pending || !canTessellateSelectedBox}
        >
          {pending ? "Tessellating" : "Tessellate selected box"}
        </button>
        <button
          type="button"
          onClick={onClearMesh}
          disabled={pending || meshCount === 0}
        >
          Clear mesh
        </button>
      </div>
      {message && <p className="project-message">{message}</p>}
      {error && (
        <dl className="occt-error">
          <div>
            <dt>Code</dt>
            <dd>{error.code}</dd>
          </div>
          <div>
            <dt>Stage</dt>
            <dd>{error.stage}</dd>
          </div>
          <div>
            <dt>WASM</dt>
            <dd>{error.wasmLoadStatus}</dd>
          </div>
          <div>
            <dt>Worker</dt>
            <dd>{error.workerStarted ? "started" : "not started"}</dd>
          </div>
        </dl>
      )}
      {metrics && (
        <dl className="metrics-list">
          <div>
            <dt>Object</dt>
            <dd>{metrics.objectId}</dd>
          </div>
          <div>
            <dt>OCCT load</dt>
            <dd>{formatMetricMs(metrics.occtLoadMs)}</dd>
          </div>
          <div>
            <dt>Tessellation</dt>
            <dd>{formatMetricMs(metrics.tessellationMs)}</dd>
          </div>
          <div>
            <dt>Kernel total</dt>
            <dd>{formatMetricMs(metrics.geometryKernelMs)}</dd>
          </div>
          <div>
            <dt>Worker total</dt>
            <dd>{formatMetricMs(metrics.workerExecutionMs)}</dd>
          </div>
          <div>
            <dt>Round trip</dt>
            <dd>{formatMetricMs(metrics.roundTripMs)}</dd>
          </div>
          <div>
            <dt>Vertices</dt>
            <dd>{metrics.vertexCount}</dd>
          </div>
          <div>
            <dt>Triangles</dt>
            <dd>{metrics.triangleCount}</dd>
          </div>
        </dl>
      )}
    </section>
  );
}
