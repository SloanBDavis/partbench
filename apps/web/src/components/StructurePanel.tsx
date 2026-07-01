import type {
  BodyGeneratedReferencesQueryResponse,
  CadBodySnapshot,
  CadFeatureSummary,
  CadGeneratedReference,
  CadPartSnapshot,
  FeatureEditabilityQueryResponse,
  NamedGeneratedReferenceEntry,
  ProjectHealthQueryResponse,
  SelectionReferenceCandidatesQueryResponse,
  SketchEntitySnapshot,
  SketchSnapshot
} from "@web-cad/cad-protocol";
import type { DocumentUnits, SceneObject } from "@web-cad/cad-core";
import type { ReactNode } from "react";
import {
  formatNamedReferenceStatus,
  formatNamedReferenceTarget
} from "../generatedReferenceUi";
import {
  createSelectionReferenceCandidateSummaries,
  formatSelectionReferenceIssue,
  formatSelectionReferenceStatus
} from "../generatedReferenceSelection";
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
  formatHealthStatus,
  getBodyHealthStatus,
  getFeatureHealthStatus,
  getHealthIssues,
  getNamedReferenceHealthStatus,
  getSketchHealthStatus,
  type StructureLineageFeatureNode,
  type StructureLineagePartNode,
  type StructureLineageTargetNode
} from "../structurePanelUi";
import { formatVisibleDiagnosticMessage } from "../viewportVisibleText";

export interface StructureGeometryStatus {
  readonly label: string;
  readonly status: string;
}

export interface StructureSelectionOptions {
  readonly panel?: "tree" | "selection";
}

export interface StructurePanelProps {
  readonly bodies: readonly CadBodySnapshot[];
  readonly features: readonly CadFeatureSummary[];
  readonly focusedSketchId?: string;
  readonly featureEditability?: FeatureEditabilityQueryResponse;
  readonly geometryStatuses?: ReadonlyMap<string, StructureGeometryStatus>;
  readonly health: ProjectHealthQueryResponse;
  readonly generatedReferences?: BodyGeneratedReferencesQueryResponse;
  readonly referenceCandidatesByStableId?: ReadonlyMap<
    string,
    SelectionReferenceCandidatesQueryResponse
  >;
  readonly namedReferenceCandidatesByName?: ReadonlyMap<
    string,
    SelectionReferenceCandidatesQueryResponse
  >;
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
  readonly onSelect: (
    id: string | undefined,
    options?: StructureSelectionOptions
  ) => void;
  readonly onSelectGeneratedReference?: (
    reference: CadGeneratedReference
  ) => void;
}

export function StructurePanel({
  bodies,
  features,
  featureEditability,
  focusedSketchId,
  generatedReferences,
  geometryStatuses,
  health,
  namedReferenceCandidatesByName,
  namedReferences,
  objects,
  parts,
  referenceCandidatesByStableId,
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
  const hasModelStory = lineage.parts.some(
    (partNode) =>
      partNode.sketchNodes.length > 0 || partNode.directFeatureNodes.length > 0
  );

  return (
    <div className="object-tree model-browser" aria-label="Model structure">
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
            {summary.issueCount > 0 ? ` / ${summary.issueCount}` : ""}
          </span>
        )}
      </div>

      <div className="structure-browser-sections model-story-scroll">
        {hasModelStory ? (
          lineage.parts.map((partNode) => (
            <ModelStoryPart
              key={partNode.part.id}
              generatedReferences={generatedReferences}
              geometryStatuses={geometryStatuses}
              featureEditability={featureEditability}
              health={health}
              focusedSketchId={focusedSketchId}
              referenceCandidatesByStableId={referenceCandidatesByStableId}
              node={partNode}
              selectedGeneratedReference={selectedGeneratedReference}
              selectedId={selectedId}
              units={units}
              onFocusSketch={onFocusSketch}
              onSelect={onSelect}
              onSelectGeneratedReference={onSelectGeneratedReference}
            />
          ))
        ) : (
          <p className="empty-state compact model-tree-empty">
            Start with a sketch or a primitive.
          </p>
        )}

        {objects.length > 0 && (
          <UtilitySection title="Primitives" count={objects.length} open>
            <ul className="model-story-utility-list">
              {objects.map((object) => (
                <li key={object.id}>
                  <button
                    type="button"
                    className={
                      object.id === selectedId
                        ? "model-story-utility-row selected"
                        : "model-story-utility-row"
                    }
                    onClick={() => onSelect(object.id)}
                  >
                    <span className="model-story-title">
                      {getObjectDisplayName(object)}
                    </span>
                    <strong>{formatObjectKind(object.kind)}</strong>
                    <small>{formatDimensions(object, units)}</small>
                    <small>{formatObjectPosition(object)}</small>
                    <small>{formatObjectScale(object)}</small>
                    <GeometryStatus status={geometryStatuses?.get(object.id)} />
                    {object.id === selectedId && (
                      <small className="selected-status">Selected</small>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </UtilitySection>
        )}

        {namedReferences.length > 0 && (
          <UtilitySection
            title="Named references"
            count={namedReferences.length}
          >
            <ul className="model-story-utility-list">
              {namedReferences.map((reference) => {
                const status = getNamedReferenceHealthStatus(
                  health,
                  reference.name
                );
                const namedStatus = formatNamedReferenceStatus(reference);
                const contractResponse = namedReferenceCandidatesByName?.get(
                  reference.name
                );
                const issues = getHealthIssues(health, {
                  kind: "namedReference",
                  name: reference.name
                });

                return (
                  <li key={reference.name}>
                    <button
                      type="button"
                      className="model-story-utility-row"
                      onClick={() => onInspectNamedReference(reference.name)}
                    >
                      <span className="model-story-title">
                        {reference.name}
                      </span>
                      <strong>{reference.kind}</strong>
                      <small>{formatNamedReferenceTarget(reference)}</small>
                      <small>{namedStatus.text}</small>
                      {contractResponse && (
                        <small
                          className={
                            contractResponse.status === "resolved"
                              ? undefined
                              : "error-text inline"
                          }
                        >
                          {formatSelectionReferenceStatus(
                            contractResponse.status
                          )}
                        </small>
                      )}
                      {contractResponse?.issues[0] && (
                        <small className="error-text inline">
                          {formatSelectionReferenceIssue(
                            contractResponse.issues[0]
                          )}
                        </small>
                      )}
                      {reference.status === "stale" && (
                        <small>Select for repair</small>
                      )}
                      <HealthStatus status={status} />
                      <HealthIssues issues={issues} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </UtilitySection>
        )}
      </div>
    </div>
  );
}

function ModelStoryPart({
  focusedSketchId,
  generatedReferences,
  geometryStatuses,
  featureEditability,
  health,
  node,
  referenceCandidatesByStableId,
  selectedGeneratedReference,
  selectedId,
  units,
  onFocusSketch,
  onSelect,
  onSelectGeneratedReference
}: {
  readonly focusedSketchId?: string;
  readonly generatedReferences?: BodyGeneratedReferencesQueryResponse;
  readonly geometryStatuses?: ReadonlyMap<string, StructureGeometryStatus>;
  readonly featureEditability?: FeatureEditabilityQueryResponse;
  readonly health: ProjectHealthQueryResponse;
  readonly node: StructureLineagePartNode;
  readonly referenceCandidatesByStableId?: ReadonlyMap<
    string,
    SelectionReferenceCandidatesQueryResponse
  >;
  readonly selectedGeneratedReference?: {
    readonly bodyId: string;
    readonly stableId: string;
  };
  readonly selectedId?: string;
  readonly units: DocumentUnits;
  readonly onFocusSketch: (sketchId: string, entityId?: string) => void;
  readonly onSelect: (
    id: string | undefined,
    options?: StructureSelectionOptions
  ) => void;
  readonly onSelectGeneratedReference?: (
    reference: CadGeneratedReference
  ) => void;
}) {
  const stepNumbers = createModelStoryStepNumbers(node);

  return (
    <section className="model-story" aria-label={node.part.name}>
      <div className="model-story-part">
        <div className="model-story-part-main">
          <span>{node.part.name}</span>
        </div>
      </div>

      <div className="model-story-flow">
        {node.sketchNodes.map((sketchNode) => {
          const sketch = sketchNode.sketch;
          const status = getSketchHealthStatus(health, sketch.id);
          const issues = getHealthIssues(health, {
            kind: "sketch",
            id: sketch.id
          });

          return (
            <details
              key={sketch.id}
              className="model-story-sketch-block"
              open={isSketchNodeOpen(
                sketchNode,
                focusedSketchId,
                selectedId,
                selectedGeneratedReference
              )}
            >
              <summary className="model-story-row sketch">
                <StoryIndex value={stepNumbers.sketches.get(sketch.id) ?? 0} />
                <span className="model-story-kind">
                  {sketch.attachment ? "Attached" : "Sketch"}
                </span>
                <span className="model-story-title">{sketch.name}</span>
                <small>{formatSketchDetail(sketch)}</small>
                <button
                  type="button"
                  className="model-story-inline-action"
                  onClick={(event) => {
                    event.preventDefault();
                    onFocusSketch(sketch.id);
                  }}
                >
                  Open
                </button>
                <HealthStatus status={status} />
                <HealthIssues issues={issues} />
              </summary>

              {sketchNode.entityNodes.length > 0 ? (
                <div className="model-story-entities">
                  {sketchNode.entityNodes.map((entityNode) => {
                    const entity = sketch.entities.find(
                      (candidate) => candidate.id === entityNode.entityId
                    );

                    return (
                      <section
                        key={entityNode.entityId}
                        className="model-story-entity-block"
                      >
                        {entityNode.missing || !entity ? (
                          <div className="model-story-row entity missing">
                            <span className="model-story-spacer" />
                            <span className="model-story-kind">Missing</span>
                            <span className="model-story-title">
                              Source profile
                            </span>
                            <small>Referenced by a feature</small>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="model-story-row entity"
                            onClick={() =>
                              onFocusSketch(sketch.id, entityNode.entityId)
                            }
                          >
                            <span className="model-story-spacer" />
                            <span className="model-story-kind">
                              {formatEntityRole(entity)}
                            </span>
                            <span className="model-story-title">
                              {formatEntityTitle(entity)}
                            </span>
                            <small>{formatEntityDetail(entity, units)}</small>
                          </button>
                        )}

                        {entityNode.featureNodes.length > 0 && (
                          <div className="model-story-feature-chain">
                            {entityNode.featureNodes.map((featureNode) => (
                              <ModelStoryFeature
                                key={featureNode.feature.id}
                                generatedReferences={generatedReferences}
                                geometryStatuses={geometryStatuses}
                                featureEditability={featureEditability}
                                health={health}
                                node={featureNode}
                                referenceCandidatesByStableId={
                                  referenceCandidatesByStableId
                                }
                                selectedGeneratedReference={
                                  selectedGeneratedReference
                                }
                                selectedId={selectedId}
                                step={
                                  stepNumbers.features.get(
                                    featureNode.feature.id
                                  ) ?? 0
                                }
                                units={units}
                                onSelect={onSelect}
                                onSelectGeneratedReference={
                                  onSelectGeneratedReference
                                }
                              />
                            ))}
                          </div>
                        )}
                      </section>
                    );
                  })}
                </div>
              ) : (
                <p className="empty-state compact model-story-empty">
                  No profiles yet.
                </p>
              )}
            </details>
          );
        })}

        {node.directFeatureNodes.length > 0 && (
          <section className="model-story-direct-features">
            {node.directFeatureNodes.map((featureNode) => (
              <ModelStoryFeature
                key={featureNode.feature.id}
                generatedReferences={generatedReferences}
                geometryStatuses={geometryStatuses}
                featureEditability={featureEditability}
                health={health}
                node={featureNode}
                referenceCandidatesByStableId={referenceCandidatesByStableId}
                selectedGeneratedReference={selectedGeneratedReference}
                selectedId={selectedId}
                step={stepNumbers.features.get(featureNode.feature.id) ?? 0}
                units={units}
                onSelect={onSelect}
                onSelectGeneratedReference={onSelectGeneratedReference}
              />
            ))}
          </section>
        )}
      </div>
    </section>
  );
}

function createModelStoryStepNumbers(node: StructureLineagePartNode): {
  readonly sketches: ReadonlyMap<string, number>;
  readonly features: ReadonlyMap<string, number>;
} {
  const sketches = new Map<string, number>();
  const features = new Map<string, number>();
  let next = 1;

  for (const sketchNode of node.sketchNodes) {
    sketches.set(sketchNode.sketch.id, next);
    next += 1;

    for (const entityNode of sketchNode.entityNodes) {
      for (const featureNode of entityNode.featureNodes) {
        features.set(featureNode.feature.id, next);
        next += 1;
      }
    }
  }

  for (const featureNode of node.directFeatureNodes) {
    features.set(featureNode.feature.id, next);
    next += 1;
  }

  return { sketches, features };
}

function isSketchNodeOpen(
  sketchNode: StructureLineagePartNode["sketchNodes"][number],
  focusedSketchId: string | undefined,
  selectedId: string | undefined,
  selectedGeneratedReference: { readonly bodyId: string } | undefined
): boolean {
  if (sketchNode.sketch.id === focusedSketchId) {
    return true;
  }

  return sketchNode.entityNodes.some((entityNode) =>
    entityNode.featureNodes.some((featureNode) =>
      isFeatureNodeInSelectedPath(
        featureNode,
        selectedId,
        selectedGeneratedReference
      )
    )
  );
}

function isFeatureNodeInSelectedPath(
  featureNode: StructureLineageFeatureNode,
  selectedId: string | undefined,
  selectedGeneratedReference: { readonly bodyId: string } | undefined
): boolean {
  const selectedBodyId = selectedGeneratedReference?.bodyId ?? selectedId;

  if (!selectedBodyId) {
    return false;
  }

  return (
    featureNode.feature.bodyId === selectedBodyId ||
    featureNode.resultBody?.id === selectedBodyId ||
    featureNode.target?.bodyId === selectedBodyId
  );
}

function ModelStoryFeature({
  generatedReferences,
  geometryStatuses,
  featureEditability,
  health,
  node,
  referenceCandidatesByStableId,
  selectedGeneratedReference,
  selectedId,
  step,
  units,
  onSelect,
  onSelectGeneratedReference
}: {
  readonly generatedReferences?: BodyGeneratedReferencesQueryResponse;
  readonly geometryStatuses?: ReadonlyMap<string, StructureGeometryStatus>;
  readonly featureEditability?: FeatureEditabilityQueryResponse;
  readonly health: ProjectHealthQueryResponse;
  readonly node: StructureLineageFeatureNode;
  readonly referenceCandidatesByStableId?: ReadonlyMap<
    string,
    SelectionReferenceCandidatesQueryResponse
  >;
  readonly selectedGeneratedReference?: {
    readonly bodyId: string;
    readonly stableId: string;
  };
  readonly selectedId?: string;
  readonly step: number;
  readonly units: DocumentUnits;
  readonly onSelect: (
    id: string | undefined,
    options?: StructureSelectionOptions
  ) => void;
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
  const editCue = createFeatureEditCue(feature, selectedId, featureEditability);

  return (
    <section className="model-story-feature">
      <button
        type="button"
        className={`model-story-row feature${
          feature.bodyId === selectedId ? " selected" : ""
        }`}
        onClick={() => onSelect(feature.bodyId, { panel: "selection" })}
      >
        <StoryIndex value={step} />
        <span className="model-story-kind">Feature</span>
        <span className="model-story-title">
          {formatFeatureStoryTitle(feature)}
        </span>
        <small>{formatFeatureStoryDetail(feature, units)}</small>
        {editCue && (
          <small className={`feature-edit-cue ${editCue.status}`}>
            {editCue.message}
          </small>
        )}
        <HealthStatus status={status} />
        <HealthIssues issues={issues} />
      </button>

      <div className="model-story-result-chain">
        {node.target && (
          <ModelStoryTarget
            health={health}
            selectedId={selectedId}
            target={node.target}
            onSelect={onSelect}
          />
        )}
        <ModelStoryResultBody
          feature={feature}
          generatedReferences={generatedReferences}
          geometryStatuses={geometryStatuses}
          health={health}
          referenceCandidatesByStableId={referenceCandidatesByStableId}
          resultBody={node.resultBody}
          selectedGeneratedReference={selectedGeneratedReference}
          selectedId={selectedId}
          onSelect={onSelect}
          onSelectGeneratedReference={onSelectGeneratedReference}
        />
      </div>
    </section>
  );
}

function ModelStoryTarget({
  health,
  selectedId,
  target,
  onSelect
}: {
  readonly health: ProjectHealthQueryResponse;
  readonly selectedId?: string;
  readonly target: StructureLineageTargetNode;
  readonly onSelect: (
    id: string | undefined,
    options?: StructureSelectionOptions
  ) => void;
}) {
  const body = target.body;
  const status = body ? getBodyHealthStatus(health, body.id) : undefined;
  const issues = body
    ? getHealthIssues(health, { kind: "body", id: body.id })
    : [];
  const content = (
    <>
      <span className="model-story-spacer" />
      <span className="model-story-kind">Input</span>
      <span className="model-story-title">{body?.name ?? "Target body"}</span>
      <small>{formatTargetStoryDetail(target)}</small>
      <HealthStatus status={status} />
      <HealthIssues issues={issues} />
    </>
  );

  if (!body) {
    return <div className="model-story-row target missing">{content}</div>;
  }

  return (
    <button
      type="button"
      className={`model-story-row target${
        body.id === selectedId ? " selected" : ""
      }`}
      onClick={() => onSelect(body.id)}
    >
      {content}
    </button>
  );
}

function ModelStoryResultBody({
  feature,
  generatedReferences,
  geometryStatuses,
  health,
  referenceCandidatesByStableId,
  resultBody,
  selectedGeneratedReference,
  selectedId,
  onSelect,
  onSelectGeneratedReference
}: {
  readonly feature: StructureLineageFeatureNode["feature"];
  readonly generatedReferences?: BodyGeneratedReferencesQueryResponse;
  readonly geometryStatuses?: ReadonlyMap<string, StructureGeometryStatus>;
  readonly health: ProjectHealthQueryResponse;
  readonly referenceCandidatesByStableId?: ReadonlyMap<
    string,
    SelectionReferenceCandidatesQueryResponse
  >;
  readonly resultBody?: CadBodySnapshot;
  readonly selectedGeneratedReference?: {
    readonly bodyId: string;
    readonly stableId: string;
  };
  readonly selectedId?: string;
  readonly onSelect: (
    id: string | undefined,
    options?: StructureSelectionOptions
  ) => void;
  readonly onSelectGeneratedReference?: (
    reference: CadGeneratedReference
  ) => void;
}) {
  if (!resultBody) {
    return (
      <div className="model-story-row body missing">
        <span className="model-story-spacer" />
        <span className="model-story-kind">Missing result</span>
        <span className="model-story-title">Result body</span>
        <small>Feature result body is unavailable.</small>
      </div>
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
    <div className="model-story-body-block">
      <button
        type="button"
        className={`model-story-row body${
          resultBody.id === selectedId ? " selected" : ""
        }`}
        onClick={() => onSelect(resultBody.id)}
      >
        <span className="model-story-spacer" />
        <span className="model-story-kind">Body</span>
        <span className="model-story-title">
          {resultBody.name ?? formatResultBodyTitle(resultBody, feature)}
        </span>
        <small>
          {formatBodyMetaLine(
            resultBody,
            feature,
            geometryStatuses?.get(resultBody.id)
          )}
        </small>
        <HealthStatus status={status} />
        <HealthIssues issues={issues} />
      </button>

      {referencesForBody && (
        <ModelStoryReferences
          references={referencesForBody}
          referenceCandidatesByStableId={referenceCandidatesByStableId}
          selectedGeneratedReference={selectedGeneratedReference}
          onSelectGeneratedReference={onSelectGeneratedReference}
        />
      )}
    </div>
  );
}

function ModelStoryReferences({
  references,
  referenceCandidatesByStableId,
  selectedGeneratedReference,
  onSelectGeneratedReference
}: {
  readonly references: BodyGeneratedReferencesQueryResponse;
  readonly referenceCandidatesByStableId?: ReadonlyMap<
    string,
    SelectionReferenceCandidatesQueryResponse
  >;
  readonly selectedGeneratedReference?: {
    readonly bodyId: string;
    readonly stableId: string;
  };
  readonly onSelectGeneratedReference?: (
    reference: CadGeneratedReference
  ) => void;
}) {
  const groups = [
    { label: "Body", references: [references.body] },
    { label: "Faces", references: references.faces },
    { label: "Edges", references: references.edges },
    { label: "Vertices", references: references.vertices },
    { label: "Axes", references: references.axes }
  ];
  const total =
    1 +
    references.faceCount +
    references.edgeCount +
    references.vertexCount +
    references.axisCount;

  return (
    <details
      className="model-story-references"
      open={selectedGeneratedReference?.bodyId === references.body.bodyId}
    >
      <summary className="model-story-references-header">
        <span>References</span>
        <strong>{total}</strong>
      </summary>
      {groups.map((group) => {
        if (group.references.length === 0) {
          return null;
        }

        const selectedInGroup = group.references.some(
          (reference) =>
            selectedGeneratedReference?.bodyId === reference.bodyId &&
            selectedGeneratedReference.stableId === reference.stableId
        );

        return (
          <details
            key={group.label}
            className="model-story-reference-group"
            open={group.label === "Body" || selectedInGroup}
          >
            <summary>
              <span>{group.label}</span>
              <strong>{group.references.length}</strong>
            </summary>
            <ul>
              {group.references.map((reference) => {
                const isSelected =
                  selectedGeneratedReference?.bodyId === reference.bodyId &&
                  selectedGeneratedReference.stableId === reference.stableId;
                const contractResponse = referenceCandidatesByStableId?.get(
                  reference.stableId
                );

                return (
                  <li key={reference.stableId}>
                    <button
                      type="button"
                      className={`model-story-reference-row ${
                        reference.kind
                      }${isSelected ? " selected" : ""}`}
                      onClick={() => onSelectGeneratedReference?.(reference)}
                    >
                      <span className="model-story-title">
                        {reference.label}
                      </span>
                      <strong>
                        {formatGeneratedReferenceKindLabel(reference)}
                      </strong>
                      <small>
                        {formatStructureReferenceCandidateLine(
                          reference,
                          contractResponse
                        )}
                      </small>
                      {contractResponse &&
                        contractResponse.status !== "resolved" && (
                          <small className="error-text inline">
                            {contractResponse.issues[0]
                              ? formatSelectionReferenceIssue(
                                  contractResponse.issues[0]
                                )
                              : formatSelectionReferenceStatus(
                                  contractResponse.status
                                )}
                          </small>
                        )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </details>
        );
      })}
    </details>
  );
}

function StoryIndex({ value }: { readonly value: number }) {
  return (
    <span className="model-story-index" aria-hidden="true">
      {value.toString().padStart(2, "0")}
    </span>
  );
}

function UtilitySection({
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
    <details className="model-story-utility" open={open}>
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

function createFeatureEditCue(
  feature: StructureLineageFeatureNode["feature"],
  selectedId: string | undefined,
  editability: FeatureEditabilityQueryResponse | undefined
):
  | {
      readonly message: string;
      readonly status: "ready" | "blocked";
    }
  | undefined {
  if (feature.bodyId !== selectedId) {
    return undefined;
  }

  if (!editability || editability.featureId !== feature.id) {
    return {
      status: "blocked",
      message: "Inspector edit status unavailable"
    };
  }

  if (editability.status === "editable") {
    const editableFields = editability.fields.filter((field) => field.editable);
    const fieldList = formatFeatureEditFieldList(editableFields);

    return {
      status: "ready",
      message: fieldList
        ? `Edit in Inspector - ${fieldList}`
        : "Edit in Inspector"
    };
  }

  return {
    status: "blocked",
    message: `Edit unavailable - ${getFeatureEditDiagnostic(editability)}`
  };
}

function formatFeatureEditFieldList(
  fields: FeatureEditabilityQueryResponse["fields"]
): string {
  const labels = fields.map((field) => field.label).filter(Boolean);

  if (labels.length <= 2) {
    return labels.join(", ");
  }

  return `${labels.slice(0, 2).join(", ")} +${labels.length - 2}`;
}

function getFeatureEditDiagnostic(
  editability: FeatureEditabilityQueryResponse
): string {
  const message =
    editability.diagnostics.find(
      (diagnostic) => diagnostic.severity === "blocker"
    )?.message ??
    editability.diagnostics[0]?.message ??
    "Feature edit is not available.";

  return formatVisibleDiagnosticMessage(message);
}

function formatSketchDetail(sketch: SketchSnapshot): string {
  const entityCount = `${sketch.entities.length} ${
    sketch.entities.length === 1 ? "entity" : "entities"
  }`;

  if (sketch.attachment) {
    if (sketch.attachment.kind === "topologyAnchorFace") {
      return `${sketch.plane} · ${entityCount} · on stable face`;
    }

    return `${sketch.plane} · ${entityCount} · on ${formatFaceRole(
      sketch.attachment.faceRole
    )}`;
  }

  return `${sketch.plane} · ${entityCount}`;
}

function formatFaceRole(role: string): string {
  return role
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll(":", " ")
    .toLowerCase();
}

function formatEntityTitle(entity: SketchEntitySnapshot): string {
  switch (entity.kind) {
    case "point":
      return "Point";
    case "line":
      return "Line";
    case "rectangle":
      return "Rectangle";
    case "circle":
      return "Circle";
  }
}

function formatEntityRole(entity: SketchEntitySnapshot): string {
  switch (entity.kind) {
    case "line":
      return "Axis";
    case "point":
      return "Point";
    case "rectangle":
    case "circle":
      return "Profile";
  }
}

function formatEntityDetail(
  entity: SketchEntitySnapshot,
  units: DocumentUnits
): string {
  switch (entity.kind) {
    case "point":
      return `point ${formatVec2(entity.point, units)}`;
    case "line":
      return `${formatNumber(distance(entity.start, entity.end))} ${units}`;
    case "rectangle":
      return `${formatNumber(entity.width)} x ${formatNumber(
        entity.height
      )} ${units}`;
    case "circle":
      return `radius ${formatNumber(entity.radius)} ${units}`;
  }
}

function formatFeatureStoryTitle(
  feature: StructureLineageFeatureNode["feature"]
): string {
  if (feature.name) {
    return feature.name;
  }

  if (feature.kind === "extrude") {
    if (feature.operationMode === "cut") {
      return "Cut";
    }

    if (feature.operationMode === "add") {
      return "Add";
    }

    return "Extrude";
  }

  if (feature.kind === "revolve") {
    return "Revolve";
  }

  if (feature.kind === "hole") {
    return "Hole";
  }

  if (feature.kind === "chamfer") {
    return "Chamfer";
  }

  return "Fillet";
}

function formatFeatureStoryDetail(
  feature: StructureLineageFeatureNode["feature"],
  units: DocumentUnits
): string {
  if (feature.kind === "chamfer") {
    return `${formatNumber(feature.distance)} ${units}`;
  }

  if (feature.kind === "fillet") {
    return `${formatNumber(feature.radius)} ${units}`;
  }

  if (feature.kind === "revolve") {
    return `${formatOperationLabel(feature.operationMode)} · ${
      feature.profileKind
    } · axis line · ${formatNumber(feature.angleDegrees)} deg`;
  }

  if (feature.kind === "hole") {
    const depth =
      feature.depthMode === "blind"
        ? feature.depth !== undefined
          ? `${formatNumber(feature.depth)} ${units}`
          : "missing depth"
        : "through all";

    return `circle · ${depth} · ${feature.direction}`;
  }

  return `${formatOperationLabel(feature.operationMode)} · ${
    feature.profileKind
  } · ${formatNumber(feature.depth)} ${units} · ${feature.side}`;
}

function formatOperationLabel(
  operationMode: Extract<
    CadFeatureSummary,
    { readonly kind: "extrude" | "revolve" }
  >["operationMode"]
): string {
  if (operationMode === "add") {
    return "add";
  }

  if (operationMode === "cut") {
    return "cut";
  }

  return "new body";
}

function formatTargetStoryDetail(target: StructureLineageTargetNode): string {
  if (!target.body) {
    return "Missing";
  }

  if (target.consumedByThisFeature) {
    return "Hidden input / replaced by result";
  }

  if (target.consumedByFeatureId) {
    return "Hidden input / used by another feature";
  }

  return "Target";
}

function formatBodyMetaLine(
  body: CadBodySnapshot,
  feature: StructureLineageFeatureNode["feature"],
  geometryStatus: StructureGeometryStatus | undefined
): string {
  const values: string[] = [];

  if (body.consumedByFeatureId) {
    values.push("Used by later feature");
  } else if (
    (feature.kind === "extrude" || feature.kind === "revolve") &&
    feature.operationMode === "add"
  ) {
    values.push("Fused result");
  } else if (
    (feature.kind === "extrude" || feature.kind === "revolve") &&
    feature.operationMode === "cut"
  ) {
    values.push("Cut result");
  } else if (feature.kind === "hole") {
    values.push("Hole result");
  } else if (feature.kind === "chamfer") {
    values.push("Chamfer result");
  } else if (feature.kind === "fillet") {
    values.push("Fillet result");
  } else {
    values.push("Created");
  }

  if (geometryStatus) {
    values.push(geometryStatus.label);
  }

  return values.join(" · ");
}

function formatResultBodyTitle(
  body: CadBodySnapshot,
  feature: StructureLineageFeatureNode["feature"]
): string {
  const role = formatBodyRole(body, feature);

  if (role === "Generated body") {
    return "Result body";
  }

  return role;
}

function formatGeneratedReferenceKindLabel(
  reference: CadGeneratedReference
): string {
  switch (reference.kind) {
    case "body":
      return "Body";
    case "face":
      return "Face";
    case "edge":
      return "Edge";
    case "vertex":
      return "Vertex";
    case "axis":
      return "Axis";
  }
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

function formatStructureReferenceCandidateLine(
  reference: CadGeneratedReference,
  response: SelectionReferenceCandidatesQueryResponse | undefined
): string {
  if (!response) {
    return formatGeneratedReferenceOperationLine(reference);
  }

  if (response.status !== "resolved") {
    return formatSelectionReferenceStatus(response.status);
  }

  const summary = createSelectionReferenceCandidateSummaries(response)[0];
  const commandCount = summary?.commandOperations.length ?? 0;

  if (commandCount === 0) {
    return "Ready reference";
  }

  return `Ready reference / ${commandCount} available action${
    commandCount === 1 ? "" : "s"
  }`;
}

function formatVec2(point: readonly [number, number], units: DocumentUnits) {
  return `(${formatNumber(point[0])}, ${formatNumber(point[1])}) ${units}`;
}

function formatNumber(value: number): string {
  if (Number.isInteger(value)) {
    return value.toString();
  }

  return Number.isFinite(value) ? value.toFixed(3).replace(/0+$/, "") : "n/a";
}

function distance(
  start: readonly [number, number],
  end: readonly [number, number]
): number {
  return Math.hypot(end[0] - start[0], end[1] - start[1]);
}
