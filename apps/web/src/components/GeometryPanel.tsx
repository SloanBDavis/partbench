import {
  getDerivedGeometryStatusLabel,
  type DerivedGeometrySnapshot
} from "../derivedGeometry";
import { formatMetricMs } from "../derivedGeometryRuntime";

export interface GeometryPanelProps {
  readonly disabled: boolean;
  readonly snapshot: DerivedGeometrySnapshot;
  readonly onRefresh: () => void;
}

export function GeometryPanel({
  disabled,
  snapshot,
  onRefresh
}: GeometryPanelProps) {
  const hasSupportedObjects = snapshot.supportedCount > 0;
  const hasPendingWork = snapshot.pendingCount > 0;
  const firstError = snapshot.entries.find((entry) => entry.status === "error");

  return (
    <section className="geometry-panel" aria-label="Geometry status">
      <h2>Geometry</h2>
      <div className="button-row">
        <button
          type="button"
          onClick={onRefresh}
          disabled={disabled || hasPendingWork || !hasSupportedObjects}
        >
          {hasPendingWork ? "Deriving meshes" : "Refresh meshes"}
        </button>
      </div>

      {snapshot.entries.length === 0 ? (
        <p className="project-message">No objects.</p>
      ) : (
        <ul className="geometry-status-list">
          {snapshot.entries.map((entry) => (
            <li key={entry.objectId} className={`geometry-${entry.status}`}>
              <div className="geometry-status-heading">
                <span>{entry.objectId}</span>
                <strong>{getDerivedGeometryStatusLabel(entry)}</strong>
              </div>
              {entry.status === "unsupported" && <p>{entry.message}</p>}
              {entry.status === "error" && (
                <p>
                  {entry.error.code} at {entry.error.stage}:{" "}
                  {entry.error.message}
                </p>
              )}
              {entry.status === "ready" && (
                <dl className="metrics-list">
                  <div>
                    <dt>Round trip</dt>
                    <dd>{formatMetricMs(entry.metrics.roundTripMs)}</dd>
                  </div>
                  <div>
                    <dt>Vertices</dt>
                    <dd>{entry.metrics.vertexCount}</dd>
                  </div>
                  <div>
                    <dt>Triangles</dt>
                    <dd>{entry.metrics.triangleCount}</dd>
                  </div>
                </dl>
              )}
            </li>
          ))}
        </ul>
      )}

      <dl className="metrics-list">
        <div>
          <dt>Supported</dt>
          <dd>{snapshot.supportedCount}</dd>
        </div>
        <div>
          <dt>Pending</dt>
          <dd>{snapshot.pendingCount}</dd>
        </div>
        <div>
          <dt>Ready</dt>
          <dd>{snapshot.readyCount}</dd>
        </div>
        <div>
          <dt>Errors</dt>
          <dd>{snapshot.errorCount}</dd>
        </div>
      </dl>
      {firstError?.status === "error" && (
        <dl className="geometry-error">
          <div>
            <dt>Code</dt>
            <dd>{firstError.error.code}</dd>
          </div>
          <div>
            <dt>Stage</dt>
            <dd>{firstError.error.stage}</dd>
          </div>
          <div>
            <dt>WASM</dt>
            <dd>{firstError.error.wasmLoadStatus}</dd>
          </div>
          <div>
            <dt>Worker</dt>
            <dd>
              {firstError.error.workerStarted ? "started" : "not started"}
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}
