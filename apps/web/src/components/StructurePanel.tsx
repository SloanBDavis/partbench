import type {
  CadBodySnapshot,
  CadFeatureSummary,
  CadPartSnapshot,
  NamedGeneratedReferenceEntry,
  ProjectHealthQueryResponse,
  SketchSnapshot
} from "@web-cad/cad-protocol";
import type { DocumentUnits, SceneObject } from "@web-cad/cad-core";
import type { ReactNode } from "react";
import {
  formatNamedReferenceStatus,
  formatNamedReferenceTarget
} from "../generatedReferenceUi";
import {
  formatDimensions,
  formatObjectKind,
  formatObjectPosition,
  formatObjectScale,
  getObjectDisplayName
} from "../sceneObjectDisplay";
import {
  createStructureTreeSummary,
  formatBodyRole,
  formatBodyStatusLine,
  formatFeatureLine,
  formatHealthStatus,
  formatPartLine,
  getBodyHealthStatus,
  getFeatureHealthStatus,
  getHealthIssues,
  getNamedReferenceHealthStatus,
  getSketchHealthStatus
} from "../structurePanelUi";

export interface StructureGeometryStatus {
  readonly label: string;
  readonly status: string;
}

export interface StructurePanelProps {
  readonly bodies: readonly CadBodySnapshot[];
  readonly features: readonly CadFeatureSummary[];
  readonly geometryStatuses?: ReadonlyMap<string, StructureGeometryStatus>;
  readonly health: ProjectHealthQueryResponse;
  readonly namedReferences: readonly NamedGeneratedReferenceEntry[];
  readonly objects: readonly SceneObject[];
  readonly parts: readonly CadPartSnapshot[];
  readonly selectedId?: string;
  readonly sketches: readonly SketchSnapshot[];
  readonly units: DocumentUnits;
  readonly onFocusSketch: (sketchId: string) => void;
  readonly onInspectNamedReference: (name: string) => void;
  readonly onSelect: (id: string | undefined) => void;
}

export function StructurePanel({
  bodies,
  features,
  geometryStatuses,
  health,
  namedReferences,
  objects,
  parts,
  selectedId,
  sketches,
  units,
  onFocusSketch,
  onInspectNamedReference,
  onSelect
}: StructurePanelProps) {
  const authoredFeatures = features.filter(
    (feature): feature is Extract<CadFeatureSummary, { kind: "extrude" }> =>
      feature.kind === "extrude"
  );
  const authoredBodies = bodies.filter(
    (body) => body.source.type === "sketchExtrudeFeature"
  );
  const summary = createStructureTreeSummary({
    parts,
    sketches,
    features,
    bodies,
    namedReferences,
    health
  });
  const summaryHealth = formatHealthStatus(summary.status);

  return (
    <aside className="object-tree model-browser" aria-label="Model structure">
      <div className="model-browser-header">
        <div>
          <h2>Structure</h2>
          <small>
            {summary.partCount} part / {summary.sketchCount} sketches /{" "}
            {summary.generatedBodyCount} bodies
          </small>
        </div>
        <span
          className={`health-pill ${summaryHealth.className}`}
          title={
            summary.issueCount > 0
              ? `${summary.issueCount} dependency issues`
              : "No dependency issues"
          }
        >
          {summaryHealth.label}
        </span>
      </div>

      <div className="structure-browser-sections">
        <StructureGroup title="Part" count={parts.length} open>
          {parts.length === 0 ? (
            <p className="empty-state compact">No parts</p>
          ) : (
            <ul>
              {parts.map((part) => (
                <li key={part.id}>
                  <div className="structure-row readonly">
                    <span className="object-id">{part.name}</span>
                    <strong>Part</strong>
                    <small>{formatPartLine(part)}</small>
                    <small>{part.id}</small>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </StructureGroup>

        <StructureGroup title="Objects" count={objects.length} open>
          {objects.length === 0 ? (
            <p className="empty-state compact">No primitive objects</p>
          ) : (
            <ul>
              {objects.map((object) => (
                <li key={object.id}>
                  <button
                    type="button"
                    className={object.id === selectedId ? "selected" : ""}
                    onClick={() => onSelect(object.id)}
                  >
                    <span className="object-id">
                      {getObjectDisplayName(object)}
                    </span>
                    <strong>{formatObjectKind(object.kind)}</strong>
                    {object.name && (
                      <small className="object-meta">ID {object.id}</small>
                    )}
                    <small className="object-meta">
                      {formatDimensions(object, units)}
                    </small>
                    <small className="object-meta">
                      {formatObjectPosition(object)}
                    </small>
                    <small className="object-meta">
                      {formatObjectScale(object)}
                    </small>
                    <GeometryStatus status={geometryStatuses?.get(object.id)} />
                    {object.id === selectedId && (
                      <small className="selected-status">Selected</small>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </StructureGroup>

        <StructureGroup title="Sketches" count={sketches.length} open>
          {sketches.length === 0 ? (
            <p className="empty-state compact">No sketches</p>
          ) : (
            <ul>
              {sketches.map((sketch) => {
                const status = getSketchHealthStatus(health, sketch.id);
                const issues = getHealthIssues(health, {
                  kind: "sketch",
                  id: sketch.id
                });

                return (
                  <li key={sketch.id}>
                    <button
                      type="button"
                      onClick={() => onFocusSketch(sketch.id)}
                    >
                      <span className="object-id">{sketch.name}</span>
                      <strong>
                        {sketch.attachment ? "Attached" : sketch.plane}
                      </strong>
                      <small>
                        {sketch.entities.length} entities
                        {sketch.attachment
                          ? ` / ${sketch.attachment.faceRole}`
                          : ""}
                      </small>
                      <small>{sketch.id}</small>
                      <HealthStatus status={status} />
                      <HealthIssues issues={issues} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </StructureGroup>

        <StructureGroup title="Features" count={authoredFeatures.length} open>
          {authoredFeatures.length === 0 ? (
            <p className="empty-state compact">No authored features</p>
          ) : (
            <ul>
              {authoredFeatures.map((feature) => {
                const status = getFeatureHealthStatus(health, feature.id);
                const issues = getHealthIssues(health, {
                  kind: "feature",
                  id: feature.id
                });

                return (
                  <li key={feature.id}>
                    <button
                      type="button"
                      className={
                        feature.bodyId === selectedId ? "selected" : ""
                      }
                      onClick={() => onSelect(feature.bodyId)}
                    >
                      <span className="object-id">
                        {feature.name ?? feature.id}
                      </span>
                      <strong>Extrude</strong>
                      <small>{formatFeatureLine(feature, units)}</small>
                      <small>
                        Sketch {feature.sketchId} / entity {feature.entityId}
                      </small>
                      <small>Body {feature.bodyId}</small>
                      <HealthStatus status={status} />
                      <HealthIssues issues={issues} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </StructureGroup>

        <StructureGroup title="Bodies" count={authoredBodies.length} open>
          {authoredBodies.length === 0 ? (
            <p className="empty-state compact">No generated bodies</p>
          ) : (
            <ul>
              {authoredBodies.map((body) => {
                const feature = authoredFeatures.find(
                  (candidate) => candidate.id === body.featureId
                );
                const status = getBodyHealthStatus(health, body.id);
                const issues = getHealthIssues(health, {
                  kind: "body",
                  id: body.id
                });

                return (
                  <li key={body.id}>
                    <button
                      type="button"
                      className={body.id === selectedId ? "selected" : ""}
                      onClick={() => onSelect(body.id)}
                    >
                      <span className="object-id">{body.name ?? body.id}</span>
                      <strong>{formatBodyRole(body, feature)}</strong>
                      <small>{formatBodyStatusLine(body, feature)}</small>
                      {feature && (
                        <small>{formatFeatureLine(feature, units)}</small>
                      )}
                      <GeometryStatus status={geometryStatuses?.get(body.id)} />
                      <HealthStatus status={status} />
                      <HealthIssues issues={issues} />
                      {body.id === selectedId && (
                        <small className="selected-status">Selected</small>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </StructureGroup>

        <StructureGroup
          title="Named refs"
          count={namedReferences.length}
          open={namedReferences.length > 0}
        >
          {namedReferences.length === 0 ? (
            <p className="empty-state compact">No named references</p>
          ) : (
            <ul>
              {namedReferences.map((reference) => {
                const status = getNamedReferenceHealthStatus(
                  health,
                  reference.name
                );
                const namedStatus = formatNamedReferenceStatus(reference);
                const issues = getHealthIssues(health, {
                  kind: "namedReference",
                  name: reference.name
                });

                return (
                  <li key={reference.name}>
                    <button
                      type="button"
                      disabled={reference.status !== "resolved"}
                      onClick={() => onInspectNamedReference(reference.name)}
                    >
                      <span className="object-id">{reference.name}</span>
                      <strong>{reference.kind}</strong>
                      <small>{formatNamedReferenceTarget(reference)}</small>
                      <small>{namedStatus.text}</small>
                      <HealthStatus status={status} />
                      <HealthIssues issues={issues} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </StructureGroup>
      </div>
    </aside>
  );
}

function StructureGroup({
  children,
  count,
  open,
  title
}: {
  readonly children: ReactNode;
  readonly count: number;
  readonly open?: boolean;
  readonly title: string;
}) {
  return (
    <details className="structure-group" open={open}>
      <summary>
        <span>{title}</span>
        <strong>{count}</strong>
      </summary>
      {children}
    </details>
  );
}

function GeometryStatus({
  status
}: {
  readonly status?: StructureGeometryStatus;
}) {
  if (!status) {
    return null;
  }

  return (
    <small className={`mesh-status geometry-${status.status}`}>
      {status.label}
    </small>
  );
}

function HealthStatus({
  status
}: {
  readonly status: ReturnType<typeof getFeatureHealthStatus>;
}) {
  if (!status) {
    return null;
  }

  const display = formatHealthStatus(status);

  return (
    <small className={`health-pill ${display.className}`}>
      {display.label}
    </small>
  );
}

function HealthIssues({ issues }: { readonly issues: readonly string[] }) {
  if (issues.length === 0) {
    return null;
  }

  return <small className="error-text inline">{issues[0]}</small>;
}
