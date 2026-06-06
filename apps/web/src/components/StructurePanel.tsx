import type {
  BodyGeneratedReferencesQueryResponse,
  CadBodySnapshot,
  CadFeatureSummary,
  CadGeneratedReference,
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
  readonly generatedReferences?: BodyGeneratedReferencesQueryResponse;
  readonly namedReferences: readonly NamedGeneratedReferenceEntry[];
  readonly objects: readonly SceneObject[];
  readonly parts: readonly CadPartSnapshot[];
  readonly selectedId?: string;
  readonly selectedGeneratedReference?: {
    readonly bodyId: string;
    readonly stableId: string;
  };
  readonly sketches: readonly SketchSnapshot[];
  readonly units: DocumentUnits;
  readonly onFocusSketch: (sketchId: string, entityId?: string) => void;
  readonly onInspectNamedReference: (name: string) => void;
  readonly onSelect: (id: string | undefined) => void;
  readonly onSelectGeneratedReference?: (
    reference: CadGeneratedReference
  ) => void;
}

export function StructurePanel({
  bodies,
  features,
  generatedReferences,
  geometryStatuses,
  health,
  namedReferences,
  objects,
  parts,
  selectedId,
  selectedGeneratedReference,
  sketches,
  units,
  onFocusSketch,
  onInspectNamedReference,
  onSelect,
  onSelectGeneratedReference
}: StructurePanelProps) {
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
    summary.status !== "healthy" && summary.status !== "under-defined";

  return (
    <aside className="object-tree model-browser" aria-label="Model structure">
      <div className="model-browser-header">
        <div>
          <h2>Model</h2>
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

      <div className="structure-browser-sections model-tree-scroll">
        {lineage.parts.length === 0 ? (
          <p className="empty-state compact model-tree-empty">
            Start with a sketch or a primitive.
          </p>
        ) : (
          <ul className="structure-lineage-tree model-tree-root">
            {lineage.parts.map((partNode) => (
              <LineagePartNode
                key={partNode.part.id}
                geometryStatuses={geometryStatuses}
                health={health}
                node={partNode}
                selectedId={selectedId}
                selectedGeneratedReference={selectedGeneratedReference}
                units={units}
                generatedReferences={generatedReferences}
                onFocusSketch={onFocusSketch}
                onSelect={onSelect}
                onSelectGeneratedReference={onSelectGeneratedReference}
              />
            ))}
          </ul>
        )}

        {objects.length > 0 && (
          <StructureGroup title="Primitives" count={objects.length} open>
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
          </StructureGroup>
        )}

        {namedReferences.length > 0 && (
          <StructureGroup
            title="Named references"
            count={namedReferences.length}
          >
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
          </StructureGroup>
        )}
      </div>
    </aside>
  );
}

function LineagePartNode({
  geometryStatuses,
  generatedReferences,
  health,
  node,
  selectedId,
  selectedGeneratedReference,
  units,
  onFocusSketch,
  onSelect,
  onSelectGeneratedReference
}: {
  readonly geometryStatuses?: ReadonlyMap<string, StructureGeometryStatus>;
  readonly generatedReferences?: BodyGeneratedReferencesQueryResponse;
  readonly health: ProjectHealthQueryResponse;
  readonly node: StructureLineagePartNode;
  readonly selectedId?: string;
  readonly selectedGeneratedReference?: {
    readonly bodyId: string;
    readonly stableId: string;
  };
  readonly units: DocumentUnits;
  readonly onFocusSketch: (sketchId: string, entityId?: string) => void;
  readonly onSelect: (id: string | undefined) => void;
  readonly onSelectGeneratedReference?: (
    reference: CadGeneratedReference
  ) => void;
}) {
  const hasChildren =
    node.sketchNodes.length > 0 || node.directFeatureNodes.length > 0;

  return (
    <li className="lineage-item lineage-part">
      <div className="structure-row readonly lineage-node part">
        <span className="object-id">{node.part.name}</span>
        <strong>Part</strong>
        <small>{formatPartLine(node.part)}</small>
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
                        {entityNode.missing ? (
                          <div className="structure-row readonly lineage-node entity missing">
                            <span className="object-id">
                              {entityNode.entityId}
                            </span>
                            <strong>Missing entity</strong>
                            <small>
                              {entityNode.featureNodes.length} features
                            </small>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="lineage-node entity"
                            onClick={() =>
                              onFocusSketch(sketch.id, entityNode.entityId)
                            }
                          >
                            <span className="object-id">
                              {formatEntityNodeTitle(entityNode)}
                            </span>
                            <strong>Entity</strong>
                            <small>
                              {entityNode.featureNodes.length} features /{" "}
                              {entityNode.entityId}
                            </small>
                          </button>
                        )}
                        {entityNode.featureNodes.length > 0 && (
                          <ul className="lineage-children">
                            {entityNode.featureNodes.map((featureNode) => (
                              <LineageFeatureNode
                                key={featureNode.feature.id}
                                generatedReferences={generatedReferences}
                                geometryStatuses={geometryStatuses}
                                health={health}
                                node={featureNode}
                                selectedId={selectedId}
                                selectedGeneratedReference={
                                  selectedGeneratedReference
                                }
                                units={units}
                                onSelect={onSelect}
                                onSelectGeneratedReference={
                                  onSelectGeneratedReference
                                }
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
              generatedReferences={generatedReferences}
              geometryStatuses={geometryStatuses}
              health={health}
              node={featureNode}
              selectedId={selectedId}
              selectedGeneratedReference={selectedGeneratedReference}
              units={units}
              onSelect={onSelect}
              onSelectGeneratedReference={onSelectGeneratedReference}
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
  generatedReferences,
  geometryStatuses,
  health,
  node,
  selectedId,
  selectedGeneratedReference,
  units,
  onSelect,
  onSelectGeneratedReference
}: {
  readonly generatedReferences?: BodyGeneratedReferencesQueryResponse;
  readonly geometryStatuses?: ReadonlyMap<string, StructureGeometryStatus>;
  readonly health: ProjectHealthQueryResponse;
  readonly node: StructureLineageFeatureNode;
  readonly selectedId?: string;
  readonly selectedGeneratedReference?: {
    readonly bodyId: string;
    readonly stableId: string;
  };
  readonly units: DocumentUnits;
  readonly onSelect: (id: string | undefined) => void;
  readonly onSelectGeneratedReference?: (
    reference: CadGeneratedReference
  ) => void;
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
          generatedReferences={generatedReferences}
          geometryStatuses={geometryStatuses}
          health={health}
          resultBody={node.resultBody}
          selectedId={selectedId}
          selectedGeneratedReference={selectedGeneratedReference}
          units={units}
          onSelect={onSelect}
          onSelectGeneratedReference={onSelectGeneratedReference}
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
  generatedReferences,
  geometryStatuses,
  health,
  resultBody,
  selectedId,
  selectedGeneratedReference,
  units,
  onSelect,
  onSelectGeneratedReference
}: {
  readonly feature: StructureLineageFeatureNode["feature"];
  readonly generatedReferences?: BodyGeneratedReferencesQueryResponse;
  readonly geometryStatuses?: ReadonlyMap<string, StructureGeometryStatus>;
  readonly health: ProjectHealthQueryResponse;
  readonly resultBody?: CadBodySnapshot;
  readonly selectedId?: string;
  readonly selectedGeneratedReference?: {
    readonly bodyId: string;
    readonly stableId: string;
  };
  readonly units: DocumentUnits;
  readonly onSelect: (id: string | undefined) => void;
  readonly onSelectGeneratedReference?: (
    reference: CadGeneratedReference
  ) => void;
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
  const referencesForBody =
    generatedReferences?.body.bodyId === resultBody.id
      ? generatedReferences
      : undefined;

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
      {referencesForBody && (
        <LineageReferencesNode
          references={referencesForBody}
          selectedGeneratedReference={selectedGeneratedReference}
          onSelectGeneratedReference={onSelectGeneratedReference}
        />
      )}
    </li>
  );
}

function LineageReferencesNode({
  references,
  selectedGeneratedReference,
  onSelectGeneratedReference
}: {
  readonly references: BodyGeneratedReferencesQueryResponse;
  readonly selectedGeneratedReference?: {
    readonly bodyId: string;
    readonly stableId: string;
  };
  readonly onSelectGeneratedReference?: (
    reference: CadGeneratedReference
  ) => void;
}) {
  const items = flattenGeneratedReferences(references);

  return (
    <details
      className="lineage-references"
      open={selectedGeneratedReference?.bodyId === references.body.bodyId}
    >
      <summary>
        <span>References</span>
        <strong>{items.length}</strong>
      </summary>
      <ul className="lineage-children references-list">
        {items.map((reference) => {
          const isSelected =
            selectedGeneratedReference?.bodyId === reference.bodyId &&
            selectedGeneratedReference.stableId === reference.stableId;

          return (
            <li key={reference.stableId} className="lineage-item">
              <button
                type="button"
                className={`lineage-node reference ${reference.kind}${
                  isSelected ? " selected" : ""
                }`}
                onClick={() => onSelectGeneratedReference?.(reference)}
              >
                <span className="object-id">{reference.label}</span>
                <strong>{formatGeneratedReferenceKindLabel(reference)}</strong>
                <small>
                  {formatGeneratedReferenceOperationLine(reference)}
                </small>
                {isSelected && (
                  <small className="selected-status">Selected</small>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

function flattenGeneratedReferences(
  references: BodyGeneratedReferencesQueryResponse
): readonly CadGeneratedReference[] {
  return [
    references.body,
    ...references.faces,
    ...references.edges,
    ...references.vertices
  ];
}

function formatGeneratedReferenceKindLabel(
  reference: CadGeneratedReference
): string {
  switch (reference.kind) {
    case "body":
      return "Body reference";
    case "face":
      return "Face";
    case "edge":
      return "Edge";
    case "vertex":
      return "Vertex";
  }
}

function formatEntityNodeTitle(node: {
  readonly entityKind?: string;
  readonly entityId: string;
}): string {
  if (!node.entityKind) {
    return node.entityId;
  }

  return node.entityKind.charAt(0).toUpperCase() + node.entityKind.slice(1);
}

function formatGeneratedReferenceOperationLine(
  reference: CadGeneratedReference
): string {
  const labels: string[] = [];

  if (reference.eligibleOperations.includes("feature.attachSketchPlane")) {
    labels.push("Sketch plane");
  }

  if (reference.eligibleOperations.includes("feature.chamfer")) {
    labels.push("Chamfer");
  }

  if (reference.eligibleOperations.includes("feature.fillet")) {
    labels.push("Fillet");
  }

  if (reference.eligibleOperations.includes("feature.measureReference")) {
    labels.push("Measure");
  }

  if (reference.eligibleOperations.includes("feature.selectReference")) {
    labels.push("Inspect");
  }

  return labels.length > 0 ? labels.join(" / ") : "Reference";
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
  if (!status || status === "healthy" || status === "under-defined") {
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
  const visibleIssues = issues.filter(
    (issue) =>
      !issue.toLowerCase().includes("under-defined") &&
      !issue.toLowerCase().includes("degrees are constrained")
  );

  if (visibleIssues.length === 0) {
    return null;
  }

  return <small className="error-text inline">{visibleIssues[0]}</small>;
}
