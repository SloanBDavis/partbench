import type {
  BodyMeasurementsSnapshot,
  CadBodySnapshot,
  CadBodyTopologySnapshot,
  CadFeatureSummary,
  DocumentUnits,
  FeatureExtrudeSide,
  ObjectMeasurementsSnapshot,
  SceneObject
} from "@web-cad/cad-core";
import type {
  BodyGeneratedReferencesQueryResponse,
  CadGeneratedFaceReference,
  CadGeneratedReference,
  NamedGeneratedReferenceEntry
} from "@web-cad/cad-protocol";
import { useState } from "react";
import {
  areBoxDimensionFormsEqual,
  areConeDimensionFormsEqual,
  areCylinderDimensionFormsEqual,
  areSphereDimensionFormsEqual,
  areTorusDimensionFormsEqual,
  areTransformFormsEqual,
  boxDimensionsToForm,
  coneDimensionsToForm,
  cylinderDimensionsToForm,
  resetTransformRotation,
  resetTransformScale,
  resetTransformTranslation,
  sphereDimensionsToForm,
  torusDimensionsToForm,
  transformToForm,
  type DimensionCommandForm,
  type SketchCreateOnFaceForm,
  type TransformCommandForm
} from "../cadCommands";
import {
  buildSketchOnFaceForm,
  canCreateSketchOnFace,
  createGeneratedReferenceMeasurementRows,
  createSketchOnFaceDefaultName,
  formatGeneratedFaceEligibility,
  formatGeneratedReferenceKind,
  formatGeneratedReferenceOperationLabels,
  formatNamedReferenceStatus,
  formatNamedReferenceTarget,
  formatSketchOnFaceAvailability,
  getNamedReferencesForGeneratedReference,
  getGeneratedReferenceItems,
  getSketchAttachableFaces,
  type GeneratedReferenceMeasurementDisplay
} from "../generatedReferenceUi";
import {
  createSelectedGeneratedReference,
  getGeneratedReferenceSelectionState,
  isSelectedGeneratedReference,
  type GeneratedReferenceSelectionState,
  type SelectedGeneratedReference
} from "../generatedReferenceSelection";
import {
  formatDimensions,
  formatArea,
  formatBounds,
  formatBodyMeasurementConfidence,
  formatBodyTopologyCounts,
  formatBodyTopologyModel,
  formatBodyTopologyStatus,
  getObjectDisplayName,
  formatObjectKind,
  formatVector,
  formatVolume
} from "../sceneObjectDisplay";
import { formatExtrudeOperationMode } from "../structurePanelUi";
import { DimensionFields, TextField, TransformFields } from "./FormFields";

export function Inspector({
  disabled = false,
  body,
  bodyMeasurements,
  bodyMeasurementsError,
  bodyTopology,
  bodyTopologyError,
  bodyTopologyExactMetadataStatus,
  feature,
  generatedReferences,
  generatedReferencesError,
  generatedReferenceMeasurements,
  measurements,
  namedReferences,
  object,
  selectedGeneratedReference,
  units,
  onApplyDimensions,
  onApplyName,
  onApplyTransform,
  onCreateSketchOnFace,
  onDeleteNamedReference,
  onNameGeneratedReference,
  onInspectNamedReference,
  onSelectGeneratedReference,
  onDelete,
  onDeleteFeature,
  onUpdateExtrude
}: {
  readonly disabled?: boolean;
  readonly body?: CadBodySnapshot;
  readonly bodyMeasurements?: BodyMeasurementsSnapshot;
  readonly bodyMeasurementsError?: string;
  readonly bodyTopology?: CadBodyTopologySnapshot;
  readonly bodyTopologyError?: string;
  readonly bodyTopologyExactMetadataStatus?: string;
  readonly feature?: CadFeatureSummary;
  readonly generatedReferences?: BodyGeneratedReferencesQueryResponse;
  readonly generatedReferencesError?: string;
  readonly generatedReferenceMeasurements?: ReadonlyMap<
    string,
    GeneratedReferenceMeasurementDisplay
  >;
  readonly measurements?: ObjectMeasurementsSnapshot;
  readonly namedReferences: readonly NamedGeneratedReferenceEntry[];
  readonly object?: SceneObject;
  readonly selectedGeneratedReference?: SelectedGeneratedReference;
  readonly units: DocumentUnits;
  readonly onApplyDimensions: (form: DimensionCommandForm) => void;
  readonly onApplyName: (name: string) => void;
  readonly onApplyTransform: (form: TransformCommandForm) => void;
  readonly onCreateSketchOnFace: (form: SketchCreateOnFaceForm) => void;
  readonly onDeleteNamedReference: (name: string) => void;
  readonly onNameGeneratedReference: (
    name: string,
    target: SelectedGeneratedReference
  ) => void;
  readonly onInspectNamedReference: (name: string) => void;
  readonly onSelectGeneratedReference: (
    selection: SelectedGeneratedReference
  ) => void;
  readonly onDelete: () => void;
  readonly onDeleteFeature: (featureId: string) => void;
  readonly onUpdateExtrude: (
    featureId: string,
    depth: number,
    side: FeatureExtrudeSide
  ) => void;
}) {
  return (
    <aside className="inspector" aria-label="Inspector">
      <h2>Inspector</h2>
      {renderInspectorSelection({
        body,
        bodyMeasurements,
        bodyMeasurementsError,
        bodyTopology,
        bodyTopologyError,
        bodyTopologyExactMetadataStatus,
        disabled,
        feature,
        generatedReferences,
        generatedReferencesError,
        generatedReferenceMeasurements,
        measurements,
        namedReferences,
        object,
        selectedGeneratedReference,
        onApplyDimensions,
        onApplyName,
        onApplyTransform,
        onCreateSketchOnFace,
        onDeleteNamedReference,
        onNameGeneratedReference,
        onInspectNamedReference,
        onSelectGeneratedReference,
        onDelete,
        onDeleteFeature,
        onUpdateExtrude,
        units
      })}
      <NamedReferencesPanel
        disabled={disabled}
        references={namedReferences}
        selectedGeneratedReference={selectedGeneratedReference}
        onInspectNamedReference={onInspectNamedReference}
        onDeleteNamedReference={onDeleteNamedReference}
      />
    </aside>
  );
}

function renderInspectorSelection(input: {
  readonly body?: CadBodySnapshot;
  readonly bodyMeasurements?: BodyMeasurementsSnapshot;
  readonly bodyMeasurementsError?: string;
  readonly bodyTopology?: CadBodyTopologySnapshot;
  readonly bodyTopologyError?: string;
  readonly bodyTopologyExactMetadataStatus?: string;
  readonly disabled: boolean;
  readonly feature?: CadFeatureSummary;
  readonly generatedReferences?: BodyGeneratedReferencesQueryResponse;
  readonly generatedReferencesError?: string;
  readonly generatedReferenceMeasurements?: ReadonlyMap<
    string,
    GeneratedReferenceMeasurementDisplay
  >;
  readonly measurements?: ObjectMeasurementsSnapshot;
  readonly namedReferences: readonly NamedGeneratedReferenceEntry[];
  readonly object?: SceneObject;
  readonly selectedGeneratedReference?: SelectedGeneratedReference;
  readonly units: DocumentUnits;
  readonly onApplyDimensions: (form: DimensionCommandForm) => void;
  readonly onApplyName: (name: string) => void;
  readonly onApplyTransform: (form: TransformCommandForm) => void;
  readonly onCreateSketchOnFace: (form: SketchCreateOnFaceForm) => void;
  readonly onDeleteNamedReference: (name: string) => void;
  readonly onNameGeneratedReference: (
    name: string,
    target: SelectedGeneratedReference
  ) => void;
  readonly onInspectNamedReference: (name: string) => void;
  readonly onSelectGeneratedReference: (
    selection: SelectedGeneratedReference
  ) => void;
  readonly onDelete: () => void;
  readonly onDeleteFeature: (featureId: string) => void;
  readonly onUpdateExtrude: (
    featureId: string,
    depth: number,
    side: FeatureExtrudeSide
  ) => void;
}) {
  if (input.body) {
    return (
      <BodyInspector
        body={input.body}
        measurements={input.bodyMeasurements}
        measurementsError={input.bodyMeasurementsError}
        topologyExactMetadataStatus={input.bodyTopologyExactMetadataStatus}
        topology={input.bodyTopology}
        topologyError={input.bodyTopologyError}
        disabled={input.disabled}
        feature={input.feature}
        generatedReferences={input.generatedReferences}
        generatedReferencesError={input.generatedReferencesError}
        generatedReferenceMeasurements={input.generatedReferenceMeasurements}
        onCreateSketchOnFace={input.onCreateSketchOnFace}
        onDeleteNamedReference={input.onDeleteNamedReference}
        onNameGeneratedReference={input.onNameGeneratedReference}
        onSelectGeneratedReference={input.onSelectGeneratedReference}
        namedReferences={input.namedReferences}
        onDeleteFeature={input.onDeleteFeature}
        onUpdateExtrude={input.onUpdateExtrude}
        selectedGeneratedReference={input.selectedGeneratedReference}
        units={input.units}
      />
    );
  }

  if (!input.object) {
    return <p className="empty-state">No selection</p>;
  }

  const object = input.object;

  return (
    <>
      <dl>
        <div>
          <dt>ID</dt>
          <dd>{object.id}</dd>
        </div>
        <div>
          <dt>Name</dt>
          <dd>{getObjectDisplayName(object)}</dd>
        </div>
        <div>
          <dt>Type</dt>
          <dd>{formatObjectKind(object.kind)}</dd>
        </div>
        <div>
          <dt>Dimensions</dt>
          <dd>{formatDimensions(object, input.units)}</dd>
        </div>
        <div>
          <dt>Translation</dt>
          <dd>{formatVector(object.transform.translation)}</dd>
        </div>
        <div>
          <dt>Rotation</dt>
          <dd>{formatVector(object.transform.rotation)}</dd>
        </div>
        <div>
          <dt>Scale</dt>
          <dd>{formatVector(object.transform.scale)}</dd>
        </div>
      </dl>
      <NameEditor
        key={`${object.id}-${object.name ?? ""}`}
        object={object}
        disabled={input.disabled}
        onApply={input.onApplyName}
      />
      <DimensionEditor
        key={`${object.id}-${JSON.stringify(object.dimensions)}`}
        object={object}
        units={input.units}
        disabled={input.disabled}
        onApply={input.onApplyDimensions}
      />
      <MeasurementPanel measurements={input.measurements} units={input.units} />
      <TransformEditor
        key={`${object.id}-${object.transform.translation.join(",")}-${object.transform.rotation.join(",")}-${object.transform.scale.join(",")}`}
        object={object}
        disabled={input.disabled}
        onApply={input.onApplyTransform}
        onDelete={input.onDelete}
      />
    </>
  );
}

function BodyInspector({
  body,
  disabled,
  feature,
  generatedReferences,
  generatedReferencesError,
  generatedReferenceMeasurements,
  measurements,
  measurementsError,
  namedReferences,
  onCreateSketchOnFace,
  onDeleteNamedReference,
  onNameGeneratedReference,
  onSelectGeneratedReference,
  onDeleteFeature,
  onUpdateExtrude,
  selectedGeneratedReference,
  topology,
  topologyExactMetadataStatus,
  topologyError,
  units
}: {
  readonly body: CadBodySnapshot;
  readonly disabled: boolean;
  readonly feature?: CadFeatureSummary;
  readonly generatedReferences?: BodyGeneratedReferencesQueryResponse;
  readonly generatedReferencesError?: string;
  readonly generatedReferenceMeasurements?: ReadonlyMap<
    string,
    GeneratedReferenceMeasurementDisplay
  >;
  readonly measurements?: BodyMeasurementsSnapshot;
  readonly measurementsError?: string;
  readonly topology?: CadBodyTopologySnapshot;
  readonly topologyExactMetadataStatus?: string;
  readonly topologyError?: string;
  readonly namedReferences: readonly NamedGeneratedReferenceEntry[];
  readonly onCreateSketchOnFace: (form: SketchCreateOnFaceForm) => void;
  readonly onDeleteNamedReference: (name: string) => void;
  readonly onNameGeneratedReference: (
    name: string,
    target: SelectedGeneratedReference
  ) => void;
  readonly onSelectGeneratedReference: (
    selection: SelectedGeneratedReference
  ) => void;
  readonly onDeleteFeature: (featureId: string) => void;
  readonly onUpdateExtrude: (
    featureId: string,
    depth: number,
    side: FeatureExtrudeSide
  ) => void;
  readonly selectedGeneratedReference?: SelectedGeneratedReference;
  readonly units: DocumentUnits;
}) {
  const [deleteArmed, setDeleteArmed] = useState(false);
  const canDeleteFeature = feature?.kind === "extrude";

  function handleDeleteFeature() {
    if (feature?.kind !== "extrude") {
      return;
    }

    if (!deleteArmed) {
      setDeleteArmed(true);
      return;
    }

    onDeleteFeature(feature.id);
  }

  return (
    <section className="command-card">
      <div className="command-card-heading">
        <h3>Body</h3>
      </div>
      <dl>
        <div>
          <dt>ID</dt>
          <dd>{body.id}</dd>
        </div>
        <div>
          <dt>Feature</dt>
          <dd>{body.featureId}</dd>
        </div>
        <div>
          <dt>Type</dt>
          <dd>{feature?.kind === "extrude" ? "Sketch extrude" : body.kind}</dd>
        </div>
        {feature?.kind === "extrude" && (
          <>
            <div>
              <dt>Profile</dt>
              <dd>{feature.profileKind}</dd>
            </div>
            <div>
              <dt>Sketch</dt>
              <dd>{feature.sketchId}</dd>
            </div>
            <div>
              <dt>Entity</dt>
              <dd>{feature.entityId}</dd>
            </div>
            <div>
              <dt>Side</dt>
              <dd>{feature.side}</dd>
            </div>
            <div>
              <dt>Operation</dt>
              <dd>{formatExtrudeOperationMode(feature.operationMode)}</dd>
            </div>
            {feature.targetBodyId && (
              <div>
                <dt>Target body</dt>
                <dd>{feature.targetBodyId}</dd>
              </div>
            )}
            <div>
              <dt>Depth</dt>
              <dd>
                {feature.depth} {units}
              </dd>
            </div>
          </>
        )}
      </dl>
      <BodyMeasurementPanel
        error={measurementsError}
        measurements={measurements}
        units={units}
      />
      <BodyTopologyPanel
        error={topologyError}
        exactMetadataStatus={topologyExactMetadataStatus}
        topology={topology}
      />
      {feature?.kind === "extrude" && (
        <ExtrudeDepthEditor
          key={`${feature.id}-${feature.depth}-${feature.side}`}
          disabled={disabled}
          feature={feature}
          onApply={onUpdateExtrude}
          units={units}
        />
      )}
      {feature?.kind === "extrude" && (
        <GeneratedReferencesPanel
          key={`${body.id}-${generatedReferences?.faceCount ?? 0}-${generatedReferences?.edgeCount ?? 0}-${generatedReferences?.vertexCount ?? 0}`}
          bodyId={body.id}
          disabled={disabled}
          error={generatedReferencesError}
          measurementByStableId={generatedReferenceMeasurements}
          namedReferences={namedReferences}
          onCreateSketchOnFace={onCreateSketchOnFace}
          onDeleteNamedReference={onDeleteNamedReference}
          onNameGeneratedReference={onNameGeneratedReference}
          onSelectGeneratedReference={onSelectGeneratedReference}
          references={generatedReferences}
          selectedGeneratedReference={selectedGeneratedReference}
          units={units}
        />
      )}
      {canDeleteFeature && (
        <div className="button-row">
          <button
            type="button"
            className="danger"
            disabled={disabled}
            onClick={handleDeleteFeature}
          >
            {deleteArmed ? "Confirm delete feature" : "Delete feature"}
          </button>
          {deleteArmed && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => setDeleteArmed(false)}
            >
              Cancel delete
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function BodyMeasurementPanel({
  error,
  measurements,
  units
}: {
  readonly error?: string;
  readonly measurements?: BodyMeasurementsSnapshot;
  readonly units: DocumentUnits;
}) {
  if (!measurements && !error) {
    return null;
  }

  return (
    <section className="command-card nested">
      <div className="command-card-heading">
        <h3>Measurements</h3>
      </div>
      {error && <p className="error-text">{error}</p>}
      {measurements && (
        <dl>
          <div>
            <dt>Volume</dt>
            <dd>{formatVolume(measurements.volume, units)}</dd>
          </div>
          <div>
            <dt>Surface area</dt>
            <dd>{formatArea(measurements.surfaceArea, units)}</dd>
          </div>
          <div>
            <dt>Local bounds</dt>
            <dd>{formatBounds(measurements.localBounds, units)}</dd>
          </div>
          <div>
            <dt>Centroid</dt>
            <dd>{formatVector(measurements.centroid)}</dd>
          </div>
          <div>
            <dt>Model</dt>
            <dd>Source analytic</dd>
          </div>
        </dl>
      )}
    </section>
  );
}

function BodyTopologyPanel({
  error,
  exactMetadataStatus,
  topology
}: {
  readonly error?: string;
  readonly exactMetadataStatus?: string;
  readonly topology?: CadBodyTopologySnapshot;
}) {
  if (!topology && !error && !exactMetadataStatus) {
    return null;
  }

  return (
    <section className="command-card nested">
      <div className="command-card-heading">
        <h3>Topology</h3>
      </div>
      {error && <p className="error-text">{error}</p>}
      {topology && (
        <dl>
          <div>
            <dt>Status</dt>
            <dd>{formatBodyTopologyStatus(topology.status)}</dd>
          </div>
          <div>
            <dt>Model</dt>
            <dd>{formatBodyTopologyModel(topology)}</dd>
          </div>
          <div>
            <dt>Entities</dt>
            <dd>{formatBodyTopologyCounts(topology)}</dd>
          </div>
          <div>
            <dt>Measurements</dt>
            <dd>{formatBodyMeasurementConfidence(topology)}</dd>
          </div>
          {exactMetadataStatus && (
            <div>
              <dt>Kernel metadata</dt>
              <dd>{exactMetadataStatus}</dd>
            </div>
          )}
          {topology.issues.length > 0 && (
            <div>
              <dt>Issue</dt>
              <dd>{topology.issues[0]?.message}</dd>
            </div>
          )}
        </dl>
      )}
    </section>
  );
}

function GeneratedReferencesPanel({
  bodyId,
  disabled,
  error,
  measurementByStableId,
  namedReferences,
  onCreateSketchOnFace,
  onDeleteNamedReference,
  onNameGeneratedReference,
  onSelectGeneratedReference,
  references,
  selectedGeneratedReference,
  units
}: {
  readonly bodyId: string;
  readonly disabled: boolean;
  readonly error?: string;
  readonly measurementByStableId?: ReadonlyMap<
    string,
    GeneratedReferenceMeasurementDisplay
  >;
  readonly namedReferences: readonly NamedGeneratedReferenceEntry[];
  readonly onCreateSketchOnFace: (form: SketchCreateOnFaceForm) => void;
  readonly onDeleteNamedReference: (name: string) => void;
  readonly onNameGeneratedReference: (
    name: string,
    target: SelectedGeneratedReference
  ) => void;
  readonly onSelectGeneratedReference: (
    selection: SelectedGeneratedReference
  ) => void;
  readonly references?: BodyGeneratedReferencesQueryResponse;
  readonly selectedGeneratedReference?: SelectedGeneratedReference;
  readonly units: DocumentUnits;
}) {
  const faces = references?.faces ?? [];
  const sketchAttachableFaces = getSketchAttachableFaces(faces);
  const firstEligibleFace = sketchAttachableFaces[0];
  const referenceItems = references
    ? getGeneratedReferenceItems(references)
    : [];
  const selectedReferenceState = getGeneratedReferenceSelectionState(
    selectedGeneratedReference,
    references,
    measurementByStableId,
    units
  );
  const [selectedFaceStableId, setSelectedFaceStableId] = useState<
    string | undefined
  >(firstEligibleFace?.stableId);
  const selectedFace =
    sketchAttachableFaces.find(
      (face) => face.stableId === selectedFaceStableId
    ) ?? firstEligibleFace;
  const [draft, setDraft] = useState({
    id: "",
    name: firstEligibleFace
      ? createSketchOnFaceDefaultName(firstEligibleFace)
      : "Face sketch"
  });
  const sketchOnFaceForm = selectedFace
    ? buildSketchOnFaceForm(bodyId, selectedFace, draft)
    : undefined;
  const hasValidName = draft.name.trim().length > 0;
  const selectedReferenceValue =
    selectedReferenceState.status === "selected"
      ? selectedReferenceState.reference.stableId
      : "";
  const selectedNamedReferences =
    selectedReferenceState.status === "selected"
      ? getNamedReferencesForGeneratedReference(
          namedReferences,
          selectedReferenceState.reference
        )
      : [];

  function createOnSelectedFace() {
    if (!sketchOnFaceForm) {
      return;
    }

    onCreateSketchOnFace(sketchOnFaceForm);
  }

  return (
    <section className="command-card nested">
      <div className="command-card-heading">
        <h3>Generated references</h3>
        <span>{referenceItems.length}</span>
      </div>
      {error && <p className="error-text">{error}</p>}
      {referenceItems.length === 0 && !error ? (
        <p className="empty-state compact">No generated references</p>
      ) : (
        <>
          {faces.length > 0 && sketchAttachableFaces.length === 0 && (
            <p className="project-message">
              No planar generated faces are available for attached sketches.
            </p>
          )}
          {sketchAttachableFaces.length > 0 && (
            <section className="sketch-attachment">
              <div className="command-card-heading">
                <h3>Create sketch on face</h3>
                <span>{sketchAttachableFaces.length}</span>
              </div>
              <label>
                Face
                <select
                  value={selectedFace?.stableId ?? ""}
                  disabled={disabled}
                  onChange={(event) => {
                    const nextFace = sketchAttachableFaces.find(
                      (face) => face.stableId === event.currentTarget.value
                    );

                    setSelectedFaceStableId(event.currentTarget.value);
                    if (nextFace) {
                      setDraft({
                        ...draft,
                        name: createSketchOnFaceDefaultName(nextFace)
                      });
                    }
                  }}
                >
                  {sketchAttachableFaces.map((face) => (
                    <option key={face.stableId} value={face.stableId}>
                      {face.label}
                    </option>
                  ))}
                </select>
              </label>
              {selectedFace && (
                <small>{formatSketchOnFaceAvailability(selectedFace)}</small>
              )}
              <div className="field-grid">
                <label>
                  Sketch name
                  <input
                    type="text"
                    value={draft.name}
                    disabled={disabled}
                    onChange={(event) =>
                      setDraft({ ...draft, name: event.currentTarget.value })
                    }
                  />
                </label>
              </div>
              <details className="advanced-options compact">
                <summary>Advanced sketch options</summary>
                <label>
                  Optional sketch ID
                  <input
                    type="text"
                    value={draft.id}
                    disabled={disabled}
                    onChange={(event) =>
                      setDraft({ ...draft, id: event.currentTarget.value })
                    }
                  />
                </label>
              </details>
              <button
                type="button"
                disabled={disabled || !sketchOnFaceForm}
                onClick={createOnSelectedFace}
              >
                Create attached sketch
              </button>
              {!hasValidName && (
                <p className="error-text">Sketch name is required.</p>
              )}
            </section>
          )}
          <SelectedGeneratedReferencePanel
            key={
              selectedReferenceState.status === "selected"
                ? selectedReferenceState.reference.stableId
                : selectedReferenceState.status
            }
            disabled={disabled}
            namedReferences={selectedNamedReferences}
            onDeleteNamedReference={onDeleteNamedReference}
            onNameGeneratedReference={onNameGeneratedReference}
            state={selectedReferenceState}
            units={units}
          />
          <label>
            Inspect reference
            <select
              value={selectedReferenceValue}
              disabled={disabled}
              onChange={(event) => {
                const reference = referenceItems.find(
                  (item) => item.stableId === event.currentTarget.value
                );

                if (reference) {
                  onSelectGeneratedReference(
                    createSelectedGeneratedReference(reference)
                  );
                }
              }}
            >
              <option value="">Choose reference</option>
              {referenceItems.map((reference) => (
                <option key={reference.stableId} value={reference.stableId}>
                  {formatGeneratedReferenceKind(reference.kind)} /{" "}
                  {reference.label}
                </option>
              ))}
            </select>
          </label>
          <details className="advanced-options">
            <summary>Reference index</summary>
            <ul className="reference-list compact">
              {referenceItems.map((reference) => {
                const face = asGeneratedFaceReference(reference);
                const isSelected = isSelectedGeneratedReference(
                  selectedGeneratedReference,
                  reference
                );

                return (
                  <li
                    key={reference.stableId}
                    className={isSelected ? "reference-selected" : ""}
                  >
                    <div className="reference-heading">
                      <strong>{reference.label}</strong>
                      <span>
                        {formatGeneratedReferenceKind(reference.kind)}
                      </span>
                    </div>
                    <small>
                      Eligible:{" "}
                      {formatGeneratedReferenceOperationLabels(reference)}
                    </small>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() =>
                        onSelectGeneratedReference(
                          createSelectedGeneratedReference(reference)
                        )
                      }
                    >
                      {isSelected ? "Selected" : "Select"}
                    </button>
                    {face && (
                      <small>
                        Sketch attachment:{" "}
                        {canCreateSketchOnFace(face)
                          ? formatGeneratedFaceEligibility(face)
                          : "Unavailable"}
                      </small>
                    )}
                  </li>
                );
              })}
            </ul>
          </details>
        </>
      )}
    </section>
  );
}

function SelectedGeneratedReferencePanel({
  disabled,
  namedReferences,
  onDeleteNamedReference,
  onNameGeneratedReference,
  state,
  units
}: {
  readonly disabled: boolean;
  readonly namedReferences: readonly NamedGeneratedReferenceEntry[];
  readonly onDeleteNamedReference: (name: string) => void;
  readonly onNameGeneratedReference: (
    name: string,
    target: SelectedGeneratedReference
  ) => void;
  readonly state: GeneratedReferenceSelectionState;
  readonly units: DocumentUnits;
}) {
  const [name, setName] = useState(
    state.status === "selected" ? state.reference.label : ""
  );
  const normalizedName = name.trim();
  const canNameReference =
    state.status === "selected" && normalizedName.length > 0;

  if (state.status === "none") {
    return null;
  }

  return (
    <section className="sketch-attachment selected-reference-detail">
      <div className="command-card-heading">
        <h3>Selected reference</h3>
        <span>
          {state.status === "selected"
            ? formatGeneratedReferenceKind(state.reference.kind)
            : "Stale"}
        </span>
      </div>
      {state.status === "stale" ? (
        <>
          <p className="error-text">{state.message}</p>
          <code>{state.selection.stableId}</code>
        </>
      ) : (
        <>
          <div className="reference-heading">
            <strong>{state.reference.label}</strong>
            <span>{formatGeneratedReferenceKind(state.reference.kind)}</span>
          </div>
          {state.reference.description && <p>{state.reference.description}</p>}
          <small>
            Eligible: {formatGeneratedReferenceOperationLabels(state.reference)}
          </small>
          <code>{state.reference.stableId}</code>
          {state.reference.eligibilityNotes &&
            state.reference.eligibilityNotes.length > 0 && (
              <small>{state.reference.eligibilityNotes.join(" ")}</small>
            )}
          <GeneratedReferenceMeasurementRows
            state={state.measurement}
            units={units}
          />
          <div className="named-reference-editor">
            <label>
              Name this reference
              <input
                type="text"
                value={name}
                disabled={disabled}
                onChange={(event) => setName(event.currentTarget.value)}
              />
            </label>
            <button
              type="button"
              disabled={disabled || !canNameReference}
              onClick={() => {
                if (state.status === "selected") {
                  onNameGeneratedReference(normalizedName, state.selection);
                }
              }}
            >
              Save name
            </button>
          </div>
          {namedReferences.length > 0 && (
            <div className="named-reference-matches">
              <strong>Names for this reference</strong>
              <ul className="reference-list compact">
                {namedReferences.map((reference) => (
                  <li key={reference.name}>
                    <div className="reference-heading">
                      <strong>{reference.name}</strong>
                      <span>{formatNamedReferenceStatus(reference).text}</span>
                    </div>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => onDeleteNamedReference(reference.name)}
                    >
                      Delete name
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function NamedReferencesPanel({
  disabled,
  references,
  selectedGeneratedReference,
  onInspectNamedReference,
  onDeleteNamedReference
}: {
  readonly disabled: boolean;
  readonly references: readonly NamedGeneratedReferenceEntry[];
  readonly selectedGeneratedReference?: SelectedGeneratedReference;
  readonly onInspectNamedReference: (name: string) => void;
  readonly onDeleteNamedReference: (name: string) => void;
}) {
  if (references.length === 0) {
    return null;
  }

  const staleCount = references.filter(
    (reference) => reference.status === "stale"
  ).length;

  return (
    <section className="command-card">
      <div className="command-card-heading">
        <h3>Named references</h3>
        <span>
          {staleCount > 0 ? `${staleCount} stale` : references.length}
        </span>
      </div>
      <ul className="reference-list compact named-reference-list">
        {references.map((reference) => {
          const status = formatNamedReferenceStatus(reference);
          const isSelected =
            selectedGeneratedReference?.bodyId === reference.bodyId &&
            selectedGeneratedReference.stableId === reference.stableId &&
            selectedGeneratedReference.kind === reference.kind;

          return (
            <li
              key={reference.name}
              className={isSelected ? "reference-selected" : ""}
            >
              <div className="reference-heading">
                <strong>{reference.name}</strong>
                <span>{formatGeneratedReferenceKind(reference.kind)}</span>
              </div>
              <small>{formatNamedReferenceTarget(reference)}</small>
              <small
                className={
                  status.tone === "stale" ? "error-text inline" : undefined
                }
              >
                {status.text}
              </small>
              <div className="button-row compact">
                <button
                  type="button"
                  disabled={disabled || reference.status !== "resolved"}
                  onClick={() => onInspectNamedReference(reference.name)}
                >
                  Inspect
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onDeleteNamedReference(reference.name)}
                >
                  Delete name
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function asGeneratedFaceReference(
  reference: CadGeneratedReference
): CadGeneratedFaceReference | undefined {
  return reference.kind === "face" ? reference : undefined;
}

function GeneratedReferenceMeasurementRows({
  state,
  units
}: {
  readonly state?: GeneratedReferenceMeasurementDisplay;
  readonly units: DocumentUnits;
}) {
  if (!state) {
    return <small>Measurements unavailable</small>;
  }

  if (state.error) {
    return <small>{state.error}</small>;
  }

  if (!state.measurement) {
    return <small>Measurements unavailable</small>;
  }

  return (
    <dl className="reference-measurements">
      {createGeneratedReferenceMeasurementRows(state.measurement, units).map(
        (row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        )
      )}
    </dl>
  );
}

function ExtrudeDepthEditor({
  disabled,
  feature,
  onApply,
  units
}: {
  readonly disabled: boolean;
  readonly feature: Extract<CadFeatureSummary, { readonly kind: "extrude" }>;
  readonly onApply: (
    featureId: string,
    depth: number,
    side: FeatureExtrudeSide
  ) => void;
  readonly units: DocumentUnits;
}) {
  const [depth, setDepth] = useState(feature.depth);
  const [side, setSide] = useState<FeatureExtrudeSide>(feature.side);
  const hasChanges = depth !== feature.depth || side !== feature.side;
  const isValid = Number.isFinite(depth) && depth > 0;

  function resetEdits() {
    setDepth(feature.depth);
    setSide(feature.side);
  }

  function handleApply() {
    if (hasChanges && isValid) {
      onApply(feature.id, depth, side);
    }
  }

  return (
    <section className="command-card nested">
      <div className="command-card-heading">
        <h3>Extrude feature</h3>
        {hasChanges && <span>Edited</span>}
      </div>
      <label>
        Operation
        <input
          type="text"
          value={formatExtrudeOperationMode(feature.operationMode)}
          readOnly
        />
      </label>
      <label>
        Depth ({units})
        <input
          type="number"
          step="0.1"
          value={depth}
          disabled={disabled}
          onChange={(event) => {
            const nextDepth = event.currentTarget.valueAsNumber;
            setDepth(Number.isNaN(nextDepth) ? 0 : nextDepth);
          }}
        />
      </label>
      <label>
        Side
        <select
          value={side}
          disabled={disabled}
          onChange={(event) =>
            setSide(event.currentTarget.value as FeatureExtrudeSide)
          }
        >
          <option value="positive">Positive</option>
          <option value="negative">Negative</option>
          <option value="symmetric">Symmetric</option>
        </select>
      </label>
      <div className="button-row">
        <button
          type="button"
          onClick={handleApply}
          disabled={disabled || !hasChanges || !isValid}
        >
          Apply extrude
        </button>
        <button
          type="button"
          onClick={resetEdits}
          disabled={disabled || !hasChanges}
        >
          Reset edits
        </button>
      </div>
      {!isValid && <p className="error-text">Depth must be positive.</p>}
    </section>
  );
}

function MeasurementPanel({
  measurements,
  units
}: {
  readonly measurements?: ObjectMeasurementsSnapshot;
  readonly units: DocumentUnits;
}) {
  if (!measurements) {
    return null;
  }

  return (
    <section className="command-card">
      <div className="command-card-heading">
        <h3>Measurements</h3>
      </div>
      <dl>
        <div>
          <dt>Approx volume</dt>
          <dd>{formatVolume(measurements.approximateVolume, units)}</dd>
        </div>
        <div>
          <dt>Local bounds</dt>
          <dd>{formatBounds(measurements.localBounds, units)}</dd>
        </div>
        <div>
          <dt>World bounds</dt>
          <dd>{formatBounds(measurements.worldBounds, units)}</dd>
        </div>
      </dl>
    </section>
  );
}

function NameEditor({
  disabled,
  object,
  onApply
}: {
  readonly disabled: boolean;
  readonly object: SceneObject;
  readonly onApply: (name: string) => void;
}) {
  const currentName = object.name ?? object.id;
  const [name, setName] = useState(currentName);
  const normalizedName = name.trim();
  const hasChanges = normalizedName !== currentName;
  const isValid = normalizedName.length > 0;

  function resetEdits() {
    setName(currentName);
  }

  function handleApply() {
    if (hasChanges && isValid) {
      onApply(normalizedName);
    }
  }

  return (
    <section className="command-card">
      <div className="command-card-heading">
        <h3>Name</h3>
        {hasChanges && <span>Edited</span>}
      </div>
      <TextField
        disabled={disabled}
        label="Display name"
        value={name}
        onChange={setName}
      />
      <div className="button-row">
        <button
          type="button"
          onClick={handleApply}
          disabled={disabled || !hasChanges || !isValid}
        >
          Rename object
        </button>
        <button
          type="button"
          onClick={resetEdits}
          disabled={disabled || !hasChanges}
        >
          Reset edits
        </button>
      </div>
      {!isValid && <p className="error-text">Name is required.</p>}
    </section>
  );
}

function DimensionEditor({
  disabled,
  object,
  units,
  onApply
}: {
  readonly disabled: boolean;
  readonly object: SceneObject;
  readonly units: DocumentUnits;
  readonly onApply: (form: DimensionCommandForm) => void;
}) {
  const currentForm = dimensionsToForm(object);
  const [form, setForm] = useState<DimensionCommandForm>(() => currentForm);
  const fields = getDimensionFields(object);
  const hasChanges = !areDimensionFormsEqual(object, form, currentForm);

  function resetEdits() {
    setForm(currentForm);
  }

  function handleApply() {
    if (hasChanges) {
      onApply(form);
    }
  }

  return (
    <section className="command-card">
      <div className="command-card-heading">
        <h3>Dimensions</h3>
        {hasChanges && <span>Edited</span>}
      </div>
      <DimensionFields
        disabled={disabled}
        fields={fields}
        form={form}
        onChange={setForm}
        unitLabel={units}
      />
      <div className="button-row">
        <button
          type="button"
          onClick={handleApply}
          disabled={disabled || !hasChanges}
        >
          Apply dimensions
        </button>
        <button
          type="button"
          onClick={resetEdits}
          disabled={disabled || !hasChanges}
        >
          Reset edits
        </button>
      </div>
    </section>
  );
}

function dimensionsToForm(object: SceneObject): DimensionCommandForm {
  switch (object.kind) {
    case "box":
      return boxDimensionsToForm(object.dimensions);
    case "cylinder":
      return cylinderDimensionsToForm(object.dimensions);
    case "sphere":
      return sphereDimensionsToForm(object.dimensions);
    case "cone":
      return coneDimensionsToForm(object.dimensions);
    case "torus":
      return torusDimensionsToForm(object.dimensions);
  }
}

function getDimensionFields(
  object: SceneObject
): readonly (keyof DimensionCommandForm)[] {
  switch (object.kind) {
    case "box":
      return ["width", "height", "depth"];
    case "cylinder":
      return ["radius", "height"];
    case "sphere":
      return ["radius"];
    case "cone":
      return ["radius", "height"];
    case "torus":
      return ["majorRadius", "minorRadius"];
  }
}

function areDimensionFormsEqual(
  object: SceneObject,
  left: DimensionCommandForm,
  right: DimensionCommandForm
): boolean {
  switch (object.kind) {
    case "box":
      return areBoxDimensionFormsEqual(left, right);
    case "cylinder":
      return areCylinderDimensionFormsEqual(left, right);
    case "sphere":
      return areSphereDimensionFormsEqual(left, right);
    case "cone":
      return areConeDimensionFormsEqual(left, right);
    case "torus":
      return areTorusDimensionFormsEqual(left, right);
  }
}

function TransformEditor({
  disabled,
  object,
  onApply,
  onDelete
}: {
  readonly disabled: boolean;
  readonly object: SceneObject;
  readonly onApply: (form: TransformCommandForm) => void;
  readonly onDelete: () => void;
}) {
  const currentForm = transformToForm(object.transform);
  const [form, setForm] = useState<TransformCommandForm>(() => currentForm);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const hasChanges = !areTransformFormsEqual(form, currentForm);

  function updateForm(nextForm: TransformCommandForm) {
    setForm(nextForm);
    setDeleteArmed(false);
  }

  function resetEdits() {
    updateForm(currentForm);
  }

  function handleApply() {
    if (hasChanges) {
      onApply(form);
    }
  }

  function handleDelete() {
    if (!deleteArmed) {
      setDeleteArmed(true);
      return;
    }

    onDelete();
  }

  return (
    <section className="command-card">
      <div className="command-card-heading">
        <h3>Transform</h3>
        {hasChanges && <span>Edited</span>}
      </div>
      <TransformFields disabled={disabled} form={form} onChange={updateForm} />
      <div className="button-row compact">
        <button
          type="button"
          onClick={() => updateForm(resetTransformTranslation(form))}
          disabled={disabled}
        >
          Clear position
        </button>
        <button
          type="button"
          onClick={() => updateForm(resetTransformRotation(form))}
          disabled={disabled}
        >
          Clear rotation
        </button>
        <button
          type="button"
          onClick={() => updateForm(resetTransformScale(form))}
          disabled={disabled}
        >
          Reset scale
        </button>
        <button
          type="button"
          onClick={resetEdits}
          disabled={disabled || !hasChanges}
        >
          Reset edits
        </button>
      </div>
      <div className="button-row">
        <button
          type="button"
          onClick={handleApply}
          disabled={disabled || !hasChanges}
        >
          Apply transform
        </button>
        <button
          type="button"
          className="danger"
          onClick={handleDelete}
          disabled={disabled}
        >
          {deleteArmed ? "Confirm delete" : "Delete object"}
        </button>
        {deleteArmed && (
          <button
            type="button"
            onClick={() => setDeleteArmed(false)}
            disabled={disabled}
          >
            Cancel delete
          </button>
        )}
      </div>
    </section>
  );
}
