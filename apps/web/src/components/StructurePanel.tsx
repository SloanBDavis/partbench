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
  createStructureLineage,
  createStructureTreeSummary,
  formatBodyRole,
  formatBodyStatusLine,
  formatFeatureLine,
  formatFeatureKindLabel,
  formatFeatureSourceLine,
  formatHealthStatus,
  formatLineageTargetLine,
  formatLineageTargetRole,
  formatPartLine,
  getBodyHealthStatus,
  getFeatureHealthStatus,
  getHealthIssues,
  getNamedReferenceHealthStatus,
  getSketchHealthStatus,
  isAuthoredStructureBody,
  isAuthoredStructureFeature,
  type StructureLineageFeatureNode,
  type StructureLineagePartNode,
  type StructureLineageTargetNode
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
  const authoredFeatures = features.filter(isAuthoredStructureFeature);
  const authoredBodies = bodies.filter(isAuthoredStructureBody);
  const lineage = createStructureLineage({
    parts,
    sketches,
    features,
    bodies
  });
  const summary = createStructureTreeSummary({
    parts,
    sketches,
    features,
    bodies,
    namedReferences,
    health
  });
  const summaryHealth = formatHealthStatus(summary.status);
  const shouldShowSummaryHealth =
    summary.status !== "healthy" || summary.issueCount > 0;

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
        {shouldShowSummaryHealth && (
          <span
            className={`health-text ${summaryHealth.className}`}
            title={
              summary.issueCount > 0
                ? `${summary.issueCount} dependency issues`
                : summaryHealth.label
            }
          >
            {summaryHealth.label}
            {summary.issueCount > 0 ? ` · ${summary.issueCount}` : ""}
          </span>
        )}
      </div>

      <div className="structure-browser-sections">
        <StructureGroup
          title="Lineage"
          count={lineage.featureNodeCount}
          open
          className="lineage-group"
        >
          {lineage.parts.length === 0 ? (
            <p className="empty-state compact">
              Create a sketch or primitive to start model lineage.
            </p>
          ) : (
            <ul className="structure-lineage-tree">
              {lineage.parts.map((partNode) => (
                <LineagePartNode
                  key={partNode.part.id}
                  geometryStatuses={geometryStatuses}
                  health={health}
                  node={partNode}
                  selectedId={selectedId}
                  units={units}
                  onFocusSketch={onFocusSketch}
                  onSelect={onSelect}
                />
              ))}
            </ul>
          )}
        </StructureGroup>

        <StructureGroup title="Part" count={parts.length}>
          {parts.length === 0 ? (
            <p className="empty-state compact">No parts yet</p>
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

        <StructureGroup title="Objects" count={objects.length}>
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

        <StructureGroup title="Sketches" count={sketches.length}>
          {sketches.length === 0 ? (
            <p className="empty-state compact">No sketches yet</p>
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

        <StructureGroup title="Features" count={authoredFeatures.length}>
          {authoredFeatures.length === 0 ? (
            <p className="empty-state compact">No authored features yet</p>
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
                      <strong>{formatFeatureKindLabel(feature)}</strong>
                      <small>{formatFeatureLine(feature, units)}</small>
                      <small>{formatFeatureSourceLine(feature)}</small>
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

        <StructureGroup title="Bodies" count={authoredBodies.length}>
          {authoredBodies.length === 0 ? (
            <p className="empty-state compact">No generated bodies yet</p>
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
            <p className="empty-state compact">No named references yet</p>
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

function LineagePartNode({
  geometryStatuses,
  health,
  node,
  selectedId,
  units,
  onFocusSketch,
  onSelect
}: {
  readonly geometryStatuses?: ReadonlyMap<string, StructureGeometryStatus>;
  readonly health: ProjectHealthQueryResponse;
  readonly node: StructureLineagePartNode;
  readonly selectedId?: string;
  readonly units: DocumentUnits;
  readonly onFocusSketch: (sketchId: string) => void;
  readonly onSelect: (id: string | undefined) => void;
}) {
  const hasChildren =
    node.sketchNodes.length > 0 || node.directFeatureNodes.length > 0;

  return (
    <li className="lineage-item lineage-part">
      <div className="structure-row readonly lineage-node part">
        <span className="object-id">{node.part.name}</span>
        <strong>Part</strong>
        <small>{formatPartLine(node.part)}</small>
        <small>{node.part.id}</small>
      </div>
      {hasChildren ? (
        <ul className="lineage-children">
          {node.sketchNodes.map((sketchNode) => {
            const sketch = sketchNode.sketch;
            const status = getSketchHealthStatus(health, sketch.id);
            const issues = getHealthIssues(health, {
              kind: "sketch",
              id: sketch.id
            });

            return (
              <li key={sketch.id} className="lineage-item lineage-sketch">
                <button
                  type="button"
                  className="lineage-node sketch"
                  onClick={() => onFocusSketch(sketch.id)}
                >
                  <span className="object-id">{sketch.name}</span>
                  <strong>
                    {sketch.attachment ? "Attached sketch" : "Sketch"}
                  </strong>
                  <small>
                    {sketch.entities.length} entities / {sketch.plane}
                  </small>
                  <small>{sketch.id}</small>
                  <HealthStatus status={status} />
                  <HealthIssues issues={issues} />
                </button>
                {sketchNode.entityNodes.length > 0 ? (
                  <ul className="lineage-children">
                    {sketchNode.entityNodes.map((entityNode) => (
                      <li
                        key={entityNode.entityId}
                        className="lineage-item lineage-entity"
                      >
                        <div
                          className={`structure-row readonly lineage-node entity${
                            entityNode.missing ? " missing" : ""
                          }`}
                        >
                          <span className="object-id">
                            {entityNode.entityId}
                          </span>
                          <strong>
                            {entityNode.missing
                              ? "Missing entity"
                              : entityNode.entityKind ?? "Entity"}
                          </strong>
                          <small>
                            {entityNode.featureNodes.length} features
                          </small>
                        </div>
                        {entityNode.featureNodes.length > 0 && (
                          <ul className="lineage-children">
                            {entityNode.featureNodes.map((featureNode) => (
                              <LineageFeatureNode
                                key={featureNode.feature.id}
                                geometryStatuses={geometryStatuses}
                                health={health}
                                node={featureNode}
                                selectedId={selectedId}
                                units={units}
                                onSelect={onSelect}
                              />
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="empty-state compact lineage-empty">
                    No sketch entities yet.
                  </p>
                )}
              </li>
            );
          })}
          {node.directFeatureNodes.map((featureNode) => (
            <LineageFeatureNode
              key={featureNode.feature.id}
              geometryStatuses={geometryStatuses}
              health={health}
              node={featureNode}
              selectedId={selectedId}
              units={units}
              onSelect={onSelect}
            />
          ))}
        </ul>
      ) : (
        <p className="empty-state compact lineage-empty">
          No sketches or authored features yet.
        </p>
      )}
    </li>
  );
}

function LineageFeatureNode({
  geometryStatuses,
  health,
  node,
  selectedId,
  units,
  onSelect
}: {
  readonly geometryStatuses?: ReadonlyMap<string, StructureGeometryStatus>;
  readonly health: ProjectHealthQueryResponse;
  readonly node: StructureLineageFeatureNode;
  readonly selectedId?: string;
  readonly units: DocumentUnits;
  readonly onSelect: (id: string | undefined) => void;
}) {
  const { feature } = node;
  const status = getFeatureHealthStatus(health, feature.id);
  const issues = getHealthIssues(health, {
    kind: "feature",
    id: feature.id
  });

  return (
    <li className="lineage-item lineage-feature">
      <button
        type="button"
        className={`lineage-node feature${
          feature.bodyId === selectedId ? " selected" : ""
        }`}
        onClick={() => onSelect(feature.bodyId)}
      >
        <span className="object-id">{feature.name ?? feature.id}</span>
        <strong>{formatFeatureKindLabel(feature)}</strong>
        <small>{formatFeatureLine(feature, units)}</small>
        <small>{formatFeatureSourceLine(feature)}</small>
        <HealthStatus status={status} />
        <HealthIssues issues={issues} />
      </button>
      <ul className="lineage-children result-chain">
        {node.target && (
          <LineageTargetRow
            geometryStatuses={geometryStatuses}
            health={health}
            selectedId={selectedId}
            target={node.target}
            onSelect={onSelect}
          />
        )}
        <LineageResultBodyRow
          feature={feature}
          geometryStatuses={geometryStatuses}
          health={health}
          resultBody={node.resultBody}
          selectedId={selectedId}
          units={units}
          onSelect={onSelect}
        />
      </ul>
    </li>
  );
}

function LineageTargetRow({
  geometryStatuses,
  health,
  selectedId,
  target,
  onSelect
}: {
  readonly geometryStatuses?: ReadonlyMap<string, StructureGeometryStatus>;
  readonly health: ProjectHealthQueryResponse;
  readonly selectedId?: string;
  readonly target: StructureLineageTargetNode;
  readonly onSelect: (id: string | undefined) => void;
}) {
  const body = target.body;
  const status = body ? getBodyHealthStatus(health, body.id) : undefined;
  const issues = body
    ? getHealthIssues(health, { kind: "body", id: body.id })
    : [];
  const rowContent = (
    <>
      <span className="object-id">{body?.name ?? target.bodyId}</span>
      <strong>{formatLineageTargetRole(target)}</strong>
      <small>{formatLineageTargetLine(target)}</small>
      {body && <GeometryStatus status={geometryStatuses?.get(body.id)} />}
      <HealthStatus status={status} />
      <HealthIssues issues={issues} />
      {body?.id === selectedId && (
        <small className="selected-status">Selected</small>
      )}
    </>
  );

  return (
    <li className="lineage-item lineage-target">
      {body ? (
        <button
          type="button"
          className={`lineage-node target${
            body.id === selectedId ? " selected" : ""
          }`}
          onClick={() => onSelect(body.id)}
        >
          {rowContent}
        </button>
      ) : (
        <div className="structure-row readonly lineage-node target missing">
          {rowContent}
        </div>
      )}
    </li>
  );
}

function LineageResultBodyRow({
  feature,
  geometryStatuses,
  health,
  resultBody,
  selectedId,
  units,
  onSelect
}: {
  readonly feature: StructureLineageFeatureNode["feature"];
  readonly geometryStatuses?: ReadonlyMap<string, StructureGeometryStatus>;
  readonly health: ProjectHealthQueryResponse;
  readonly resultBody?: CadBodySnapshot;
  readonly selectedId?: string;
  readonly units: DocumentUnits;
  readonly onSelect: (id: string | undefined) => void;
}) {
  if (!resultBody) {
    return (
      <li className="lineage-item lineage-result">
        <div className="structure-row readonly lineage-node body missing">
          <span className="object-id">{feature.bodyId}</span>
          <strong>Missing result</strong>
          <small>Feature result body is unavailable.</small>
        </div>
      </li>
    );
  }

  const status = getBodyHealthStatus(health, resultBody.id);
  const issues = getHealthIssues(health, {
    kind: "body",
    id: resultBody.id
  });

  return (
    <li className="lineage-item lineage-result">
      <button
        type="button"
        className={`lineage-node body${
          resultBody.id === selectedId ? " selected" : ""
        }`}
        onClick={() => onSelect(resultBody.id)}
      >
        <span className="object-id">{resultBody.name ?? resultBody.id}</span>
        <strong>{formatBodyRole(resultBody, feature)}</strong>
        <small>{formatBodyStatusLine(resultBody, feature)}</small>
        <small>{formatFeatureLine(feature, units)}</small>
        <GeometryStatus status={geometryStatuses?.get(resultBody.id)} />
        <HealthStatus status={status} />
        <HealthIssues issues={issues} />
        {resultBody.id === selectedId && (
          <small className="selected-status">Selected</small>
        )}
      </button>
    </li>
  );
}

function StructureGroup({
  className,
  children,
  count,
  open,
  title
}: {
  readonly className?: string;
  readonly children: ReactNode;
  readonly count: number;
  readonly open?: boolean;
  readonly title: string;
}) {
  return (
    <details
      className={className ? `structure-group ${className}` : "structure-group"}
      open={open}
    >
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
  if (!status || status === "healthy") {
    return null;
  }

  const display = formatHealthStatus(status);

  return (
    <small className={`health-text ${display.className}`}>
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
