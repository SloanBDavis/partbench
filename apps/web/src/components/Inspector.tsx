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
  FeatureEditabilityQueryResponse,
  FeatureHoleDepthMode,
  FeatureHoleDirection,
  CadReferenceHealthEntry,
  CadSelectionReferenceOperation,
  NamedGeneratedReferenceEntry,
  SelectionReferenceCandidatesQueryResponse
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
  type FeatureEdgeFinishForm,
  type SketchCreateOnFaceForm,
  type TransformCommandForm
} from "../cadCommands";
import {
  buildEdgeFinishForm,
  createEdgeFinishReferenceOptions,
  formatEdgeFinishOperationLabel,
  formatEdgeFinishScalarName,
  getEdgeFinishOperationStatus,
  SELECTED_EDGE_FINISH_REFERENCE_VALUE,
  selectEdgeFinishReferenceOption,
  type EdgeFinishDraft,
  type EdgeFinishOperation
} from "../edgeFinishUi";
import {
  buildSketchOnFaceForm,
  createGeneratedReferenceActionStatuses,
  createGeneratedReferenceDetailRows,
  createGeneratedReferenceMeasurementRows,
  createSketchOnFaceDefaultName,
  formatGeneratedReferenceActionStatus,
  formatGeneratedReferenceKind,
  formatGeneratedReferenceOperationLabels,
  formatNamedReferenceStatus,
  formatNamedReferenceTarget,
  formatSketchOnFaceAvailability,
  getGeneratedReferenceGroups,
  getNamedReferencesForGeneratedReference,
  getGeneratedReferenceItems,
  getSketchAttachableFaces,
  type GeneratedReferenceGroup,
  type GeneratedReferenceMeasurementDisplay
} from "../generatedReferenceUi";
import {
  createSelectedGeneratedReference,
  createSelectionReferenceCandidateSummaries,
  formatSelectionReferenceIssue,
  formatSelectionReferenceOperationLabel,
  formatSelectionReferenceStatus,
  getGeneratedReferenceSelectionState,
  getSelectionReferenceOperationStatus,
  isSelectedGeneratedReference,
  type GeneratedReferenceSelectionState,
  type SelectedGeneratedReference
} from "../generatedReferenceSelection";
import {
  createNamedReferenceRepairUiState,
  formatNamedReferenceRepairHealthStatus,
  isRepairableNamedReferenceHealth
} from "../namedReferenceRepairUi";
import {
  formatDimensions,
  formatBounds,
  formatBodyMeasurementConfidence,
  formatBodyTopologyCounts,
  formatBodyTopologyModel,
  formatBodyTopologyStatus,
  createBodyMeasurementRows,
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
  featureEditability,
  generatedReferences,
  generatedReferencesError,
  generatedReferenceMeasurements,
  measurements,
  namedReferences,
  namedReferenceHealthByName,
  namedReferenceCandidatesByName,
  object,
  referenceCandidatesByStableId,
  selectedNamedReferenceName,
  selectedGeneratedReference,
  selectionReferenceCandidates,
  units,
  onApplyDimensions,
  onApplyName,
  onApplyTransform,
  onCreateSketchOnFace,
  onCreateEdgeFinish,
  onDeleteNamedReference,
  onNameGeneratedReference,
  onRepairNamedReference,
  onInspectNamedReference,
  onSelectGeneratedReference,
  onDelete,
  onDeleteFeature,
  onUpdateExtrude,
  onUpdateRevolve,
  onUpdateHole,
  onUpdateChamfer,
  onUpdateFillet
}: {
  readonly disabled?: boolean;
  readonly body?: CadBodySnapshot;
  readonly bodyMeasurements?: BodyMeasurementsSnapshot;
  readonly bodyMeasurementsError?: string;
  readonly bodyTopology?: CadBodyTopologySnapshot;
  readonly bodyTopologyError?: string;
  readonly bodyTopologyExactMetadataStatus?: string;
  readonly feature?: CadFeatureSummary;
  readonly featureEditability?: FeatureEditabilityQueryResponse;
  readonly generatedReferences?: BodyGeneratedReferencesQueryResponse;
  readonly generatedReferencesError?: string;
  readonly generatedReferenceMeasurements?: ReadonlyMap<
    string,
    GeneratedReferenceMeasurementDisplay
  >;
  readonly measurements?: ObjectMeasurementsSnapshot;
  readonly namedReferences: readonly NamedGeneratedReferenceEntry[];
  readonly namedReferenceHealthByName?: ReadonlyMap<
    string,
    CadReferenceHealthEntry
  >;
  readonly namedReferenceCandidatesByName?: ReadonlyMap<
    string,
    SelectionReferenceCandidatesQueryResponse
  >;
  readonly object?: SceneObject;
  readonly referenceCandidatesByStableId?: ReadonlyMap<
    string,
    SelectionReferenceCandidatesQueryResponse
  >;
  readonly selectedGeneratedReference?: SelectedGeneratedReference;
  readonly selectedNamedReferenceName?: string;
  readonly selectionReferenceCandidates?: SelectionReferenceCandidatesQueryResponse;
  readonly units: DocumentUnits;
  readonly onApplyDimensions: (form: DimensionCommandForm) => void;
  readonly onApplyName: (name: string) => void;
  readonly onApplyTransform: (form: TransformCommandForm) => void;
  readonly onCreateSketchOnFace: (form: SketchCreateOnFaceForm) => void;
  readonly onCreateEdgeFinish: (
    operation: EdgeFinishOperation,
    form: FeatureEdgeFinishForm
  ) => void;
  readonly onDeleteNamedReference: (name: string) => void;
  readonly onNameGeneratedReference: (
    name: string,
    target: SelectedGeneratedReference
  ) => void;
  readonly onRepairNamedReference: (
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
  readonly onUpdateRevolve: (featureId: string, angleDegrees: number) => void;
  readonly onUpdateHole: (
    featureId: string,
    depthMode: FeatureHoleDepthMode,
    depth: number | undefined,
    direction: FeatureHoleDirection
  ) => void;
  readonly onUpdateChamfer: (featureId: string, distance: number) => void;
  readonly onUpdateFillet: (featureId: string, radius: number) => void;
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
        featureEditability,
        generatedReferences,
        generatedReferencesError,
        generatedReferenceMeasurements,
        measurements,
        namedReferences,
        namedReferenceHealthByName,
        namedReferenceCandidatesByName,
        object,
        referenceCandidatesByStableId,
        selectedNamedReferenceName,
        selectedGeneratedReference,
        selectionReferenceCandidates,
        onApplyDimensions,
        onApplyName,
        onApplyTransform,
        onCreateSketchOnFace,
        onCreateEdgeFinish,
        onDeleteNamedReference,
        onNameGeneratedReference,
        onRepairNamedReference,
        onInspectNamedReference,
        onSelectGeneratedReference,
        onDelete,
        onDeleteFeature,
        onUpdateExtrude,
        onUpdateRevolve,
        onUpdateHole,
        onUpdateChamfer,
        onUpdateFillet,
        units
      })}
      <NamedReferencesPanel
        disabled={disabled}
        candidatesByName={namedReferenceCandidatesByName}
        healthByName={namedReferenceHealthByName}
        references={namedReferences}
        selectedNamedReferenceName={selectedNamedReferenceName}
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
  readonly featureEditability?: FeatureEditabilityQueryResponse;
  readonly generatedReferences?: BodyGeneratedReferencesQueryResponse;
  readonly generatedReferencesError?: string;
  readonly generatedReferenceMeasurements?: ReadonlyMap<
    string,
    GeneratedReferenceMeasurementDisplay
  >;
  readonly measurements?: ObjectMeasurementsSnapshot;
  readonly namedReferences: readonly NamedGeneratedReferenceEntry[];
  readonly namedReferenceHealthByName?: ReadonlyMap<
    string,
    CadReferenceHealthEntry
  >;
  readonly namedReferenceCandidatesByName?: ReadonlyMap<
    string,
    SelectionReferenceCandidatesQueryResponse
  >;
  readonly object?: SceneObject;
  readonly referenceCandidatesByStableId?: ReadonlyMap<
    string,
    SelectionReferenceCandidatesQueryResponse
  >;
  readonly selectedGeneratedReference?: SelectedGeneratedReference;
  readonly selectedNamedReferenceName?: string;
  readonly selectionReferenceCandidates?: SelectionReferenceCandidatesQueryResponse;
  readonly units: DocumentUnits;
  readonly onApplyDimensions: (form: DimensionCommandForm) => void;
  readonly onApplyName: (name: string) => void;
  readonly onApplyTransform: (form: TransformCommandForm) => void;
  readonly onCreateSketchOnFace: (form: SketchCreateOnFaceForm) => void;
  readonly onCreateEdgeFinish: (
    operation: EdgeFinishOperation,
    form: FeatureEdgeFinishForm
  ) => void;
  readonly onDeleteNamedReference: (name: string) => void;
  readonly onNameGeneratedReference: (
    name: string,
    target: SelectedGeneratedReference
  ) => void;
  readonly onRepairNamedReference: (
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
  readonly onUpdateRevolve: (featureId: string, angleDegrees: number) => void;
  readonly onUpdateHole: (
    featureId: string,
    depthMode: FeatureHoleDepthMode,
    depth: number | undefined,
    direction: FeatureHoleDirection
  ) => void;
  readonly onUpdateChamfer: (featureId: string, distance: number) => void;
  readonly onUpdateFillet: (featureId: string, radius: number) => void;
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
        featureEditability={input.featureEditability}
        generatedReferences={input.generatedReferences}
        generatedReferencesError={input.generatedReferencesError}
        generatedReferenceMeasurements={input.generatedReferenceMeasurements}
        onCreateSketchOnFace={input.onCreateSketchOnFace}
        onCreateEdgeFinish={input.onCreateEdgeFinish}
        onDeleteNamedReference={input.onDeleteNamedReference}
        onNameGeneratedReference={input.onNameGeneratedReference}
        onSelectGeneratedReference={input.onSelectGeneratedReference}
        namedReferences={input.namedReferences}
        namedReferenceHealthByName={input.namedReferenceHealthByName}
        selectedNamedReferenceName={input.selectedNamedReferenceName}
        referenceCandidatesByStableId={input.referenceCandidatesByStableId}
        selectionReferenceCandidates={input.selectionReferenceCandidates}
        onDeleteFeature={input.onDeleteFeature}
        onUpdateExtrude={input.onUpdateExtrude}
        onUpdateRevolve={input.onUpdateRevolve}
        onUpdateHole={input.onUpdateHole}
        onUpdateChamfer={input.onUpdateChamfer}
        onUpdateFillet={input.onUpdateFillet}
        onRepairNamedReference={input.onRepairNamedReference}
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
  featureEditability,
  generatedReferences,
  generatedReferencesError,
  generatedReferenceMeasurements,
  measurements,
  measurementsError,
  namedReferences,
  namedReferenceHealthByName,
  onCreateSketchOnFace,
  onCreateEdgeFinish,
  onDeleteNamedReference,
  onNameGeneratedReference,
  onRepairNamedReference,
  onSelectGeneratedReference,
  onDeleteFeature,
  onUpdateExtrude,
  onUpdateRevolve,
  onUpdateHole,
  onUpdateChamfer,
  onUpdateFillet,
  selectedGeneratedReference,
  selectedNamedReferenceName,
  referenceCandidatesByStableId,
  selectionReferenceCandidates,
  topology,
  topologyExactMetadataStatus,
  topologyError,
  units
}: {
  readonly body: CadBodySnapshot;
  readonly disabled: boolean;
  readonly feature?: CadFeatureSummary;
  readonly featureEditability?: FeatureEditabilityQueryResponse;
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
  readonly namedReferenceHealthByName?: ReadonlyMap<
    string,
    CadReferenceHealthEntry
  >;
  readonly referenceCandidatesByStableId?: ReadonlyMap<
    string,
    SelectionReferenceCandidatesQueryResponse
  >;
  readonly selectionReferenceCandidates?: SelectionReferenceCandidatesQueryResponse;
  readonly onCreateSketchOnFace: (form: SketchCreateOnFaceForm) => void;
  readonly onCreateEdgeFinish: (
    operation: EdgeFinishOperation,
    form: FeatureEdgeFinishForm
  ) => void;
  readonly onDeleteNamedReference: (name: string) => void;
  readonly onNameGeneratedReference: (
    name: string,
    target: SelectedGeneratedReference
  ) => void;
  readonly onRepairNamedReference: (
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
  readonly onUpdateRevolve: (featureId: string, angleDegrees: number) => void;
  readonly onUpdateHole: (
    featureId: string,
    depthMode: FeatureHoleDepthMode,
    depth: number | undefined,
    direction: FeatureHoleDirection
  ) => void;
  readonly onUpdateChamfer: (featureId: string, distance: number) => void;
  readonly onUpdateFillet: (featureId: string, radius: number) => void;
  readonly selectedGeneratedReference?: SelectedGeneratedReference;
  readonly selectedNamedReferenceName?: string;
  readonly units: DocumentUnits;
}) {
  const [deleteArmed, setDeleteArmed] = useState(false);
  const canDeleteFeature = Boolean(feature && feature.kind !== "primitive");

  function handleDeleteFeature() {
    if (!feature || feature.kind === "primitive") {
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
      {feature && (
        <FeatureEditabilityCallout
          editability={featureEditability}
          feature={feature}
        />
      )}
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
          <dd>{feature ? formatFeatureKindLabel(feature) : body.kind}</dd>
        </div>
        {feature && renderFeatureDetailRows(feature, units)}
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
      <SelectionReferenceContractPanel
        response={selectionReferenceCandidates}
      />
      {feature?.kind === "extrude" && (
        <ExtrudeDepthEditor
          key={`${feature.id}-${feature.depth}-${feature.side}`}
          disabled={disabled}
          editability={featureEditability}
          feature={feature}
          onApply={onUpdateExtrude}
          units={units}
        />
      )}
      {feature?.kind === "revolve" && (
        <RevolveFeatureEditor
          key={`${feature.id}-${feature.angleDegrees}`}
          disabled={disabled}
          editability={featureEditability}
          feature={feature}
          onApply={onUpdateRevolve}
        />
      )}
      {feature?.kind === "hole" && (
        <HoleFeatureEditor
          key={`${feature.id}-${feature.depthMode}-${feature.depth ?? "through"}-${feature.direction}`}
          disabled={disabled}
          editability={featureEditability}
          feature={feature}
          onApply={onUpdateHole}
          units={units}
        />
      )}
      {feature?.kind === "chamfer" && (
        <EdgeFinishFeatureEditor
          key={`${feature.id}-${feature.distance}`}
          disabled={disabled}
          editability={featureEditability}
          feature={feature}
          kind="chamfer"
          onApply={onUpdateChamfer}
          units={units}
        />
      )}
      {feature?.kind === "fillet" && (
        <EdgeFinishFeatureEditor
          key={`${feature.id}-${feature.radius}`}
          disabled={disabled}
          editability={featureEditability}
          feature={feature}
          kind="fillet"
          onApply={onUpdateFillet}
          units={units}
        />
      )}
      {(generatedReferences || generatedReferencesError) && (
        <GeneratedReferencesPanel
          key={`${body.id}-${generatedReferences?.faceCount ?? 0}-${generatedReferences?.edgeCount ?? 0}-${generatedReferences?.vertexCount ?? 0}-${generatedReferences?.axisCount ?? 0}`}
          body={body}
          bodyId={body.id}
          disabled={disabled}
          error={generatedReferencesError}
          feature={feature}
          measurementByStableId={generatedReferenceMeasurements}
          namedReferences={namedReferences}
          namedReferenceHealthByName={namedReferenceHealthByName}
          onCreateEdgeFinish={onCreateEdgeFinish}
          onCreateSketchOnFace={onCreateSketchOnFace}
          onDeleteNamedReference={onDeleteNamedReference}
          onNameGeneratedReference={onNameGeneratedReference}
          onRepairNamedReference={onRepairNamedReference}
          onSelectGeneratedReference={onSelectGeneratedReference}
          references={generatedReferences}
          referenceCandidatesByStableId={referenceCandidatesByStableId}
          selectedGeneratedReference={selectedGeneratedReference}
          selectedNamedReferenceName={selectedNamedReferenceName}
          selectionReferenceCandidates={selectionReferenceCandidates}
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

function FeatureEditabilityCallout({
  editability,
  feature
}: {
  readonly editability?: FeatureEditabilityQueryResponse;
  readonly feature: CadFeatureSummary;
}) {
  const state = getFeatureEditCalloutState(editability);

  return (
    <section className={`feature-edit-callout ${state}`}>
      <div>
        <strong>{formatFeatureEditCalloutTitle(editability)}</strong>
        <span>{formatFeatureEditStatus(editability)}</span>
      </div>
      <small>{formatFeatureEditCalloutDetail(editability, feature)}</small>
    </section>
  );
}

function getFeatureEditCalloutState(
  editability: FeatureEditabilityQueryResponse | undefined
): "ready" | "pending" | "blocked" {
  if (!editability) {
    return "pending";
  }

  return editability.status === "editable" ? "ready" : "blocked";
}

function formatFeatureEditCalloutTitle(
  editability: FeatureEditabilityQueryResponse | undefined
): string {
  if (!editability) {
    return "Feature edit status";
  }

  return editability.status === "editable"
    ? "Feature edits ready"
    : "Feature parameters unavailable";
}

function formatFeatureEditCalloutDetail(
  editability: FeatureEditabilityQueryResponse | undefined,
  feature: CadFeatureSummary
): string {
  if (!editability) {
    return "Inspector needs a feature.editability query result before enabling edits.";
  }

  if (editability.status !== "editable") {
    return getFeatureEditDiagnostic(editability);
  }

  const editableFields = editability.fields.filter((field) => field.editable);
  const fieldList = formatFeatureEditFieldList(editableFields);

  return fieldList
    ? `Edit ${fieldList} below for this ${formatFeatureKindLabel(feature).toLowerCase()} feature.`
    : `This ${formatFeatureKindLabel(feature).toLowerCase()} feature is editable.`;
}

function formatFeatureEditFieldList(
  fields: FeatureEditabilityQueryResponse["fields"]
): string {
  const labels = fields.map((field) => field.label).filter(Boolean);

  if (labels.length <= 2) {
    return labels.join(" and ");
  }

  const remainingCount = labels.length - 2;
  const remainingLabel = remainingCount === 1 ? "field" : "fields";

  return `${labels.slice(0, 2).join(", ")} and ${remainingCount} more ${remainingLabel}`;
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
          {createBodyMeasurementRows(measurements, units).map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
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

function formatFeatureKindLabel(feature: CadFeatureSummary): string {
  switch (feature.kind) {
    case "extrude":
      return "Sketch extrude";
    case "revolve":
      return "Sketch revolve";
    case "hole":
      return "Hole";
    case "chamfer":
      return "Chamfer";
    case "fillet":
      return "Fillet";
    case "primitive":
      return formatObjectKind(feature.primitive);
  }
}

function formatFeatureOperationMode(mode: string): string {
  if (mode === "newBody") {
    return "New body";
  }

  return mode.charAt(0).toUpperCase() + mode.slice(1);
}

function renderFeatureDetailRows(
  feature: CadFeatureSummary,
  units: DocumentUnits
) {
  if (feature.kind === "primitive") {
    return null;
  }

  if (feature.kind === "extrude") {
    return (
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
    );
  }

  if (feature.kind === "revolve") {
    return (
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
          <dt>Axis</dt>
          <dd>{feature.axis.entityId}</dd>
        </div>
        <div>
          <dt>Operation</dt>
          <dd>{formatFeatureOperationMode(feature.operationMode)}</dd>
        </div>
        <div>
          <dt>Angle</dt>
          <dd>{feature.angleDegrees} deg</dd>
        </div>
      </>
    );
  }

  if (feature.kind === "hole") {
    return (
      <>
        <div>
          <dt>Target body</dt>
          <dd>{feature.targetBodyId}</dd>
        </div>
        <div>
          <dt>Sketch</dt>
          <dd>{feature.sketchId}</dd>
        </div>
        <div>
          <dt>Circle</dt>
          <dd>{feature.circleEntityId}</dd>
        </div>
        <div>
          <dt>Depth mode</dt>
          <dd>
            {feature.depthMode === "throughAll" ? "Through all" : "Blind"}
          </dd>
        </div>
        {feature.depth !== undefined && (
          <div>
            <dt>Depth</dt>
            <dd>
              {feature.depth} {units}
            </dd>
          </div>
        )}
        <div>
          <dt>Direction</dt>
          <dd>{feature.direction}</dd>
        </div>
      </>
    );
  }

  return (
    <>
      <div>
        <dt>Target body</dt>
        <dd>{feature.targetBodyId}</dd>
      </div>
      {(feature.edgeStableId || feature.namedReference) && (
        <div>
          <dt>Edge</dt>
          <dd>{feature.namedReference ?? feature.edgeStableId}</dd>
        </div>
      )}
      <div>
        <dt>{feature.kind === "chamfer" ? "Distance" : "Radius"}</dt>
        <dd>
          {feature.kind === "chamfer" ? feature.distance : feature.radius}{" "}
          {units}
        </dd>
      </div>
    </>
  );
}

function SelectionReferenceContractPanel({
  response
}: {
  readonly response?: SelectionReferenceCandidatesQueryResponse;
}) {
  if (!response) {
    return null;
  }

  const summaries = createSelectionReferenceCandidateSummaries(response);
  const primary = summaries[0];
  const operations =
    primary?.commandOperations.map(formatSelectionReferenceOperationLabel) ??
    [];
  const issues =
    primary && primary.issues.length > 0
      ? primary.issues
      : response.issues.map(formatSelectionReferenceIssue);

  return (
    <section className="command-card nested reference-contract">
      <div className="command-card-heading">
        <h3>Reference status</h3>
        <span>{formatSelectionReferenceStatus(response.status)}</span>
      </div>
      {primary && (
        <dl>
          <div>
            <dt>Target</dt>
            <dd>{primary.title}</dd>
          </div>
          <div>
            <dt>Commands</dt>
            <dd>{operations.length > 0 ? operations.join(", ") : "None"}</dd>
          </div>
        </dl>
      )}
      {issues.length > 0 && <p className="error-text">{issues[0]}</p>}
    </section>
  );
}

function GeneratedReferencesPanel({
  body,
  bodyId,
  disabled,
  error,
  feature,
  measurementByStableId,
  namedReferences,
  namedReferenceHealthByName,
  onCreateEdgeFinish,
  onCreateSketchOnFace,
  onDeleteNamedReference,
  onNameGeneratedReference,
  onRepairNamedReference,
  onSelectGeneratedReference,
  references,
  referenceCandidatesByStableId,
  selectedGeneratedReference,
  selectedNamedReferenceName,
  selectionReferenceCandidates,
  units
}: {
  readonly body: CadBodySnapshot;
  readonly bodyId: string;
  readonly disabled: boolean;
  readonly error?: string;
  readonly feature?: CadFeatureSummary;
  readonly measurementByStableId?: ReadonlyMap<
    string,
    GeneratedReferenceMeasurementDisplay
  >;
  readonly namedReferences: readonly NamedGeneratedReferenceEntry[];
  readonly namedReferenceHealthByName?: ReadonlyMap<
    string,
    CadReferenceHealthEntry
  >;
  readonly onCreateEdgeFinish: (
    operation: EdgeFinishOperation,
    form: FeatureEdgeFinishForm
  ) => void;
  readonly onCreateSketchOnFace: (form: SketchCreateOnFaceForm) => void;
  readonly onDeleteNamedReference: (name: string) => void;
  readonly onNameGeneratedReference: (
    name: string,
    target: SelectedGeneratedReference
  ) => void;
  readonly onRepairNamedReference: (
    name: string,
    target: SelectedGeneratedReference
  ) => void;
  readonly onSelectGeneratedReference: (
    selection: SelectedGeneratedReference
  ) => void;
  readonly references?: BodyGeneratedReferencesQueryResponse;
  readonly referenceCandidatesByStableId?: ReadonlyMap<
    string,
    SelectionReferenceCandidatesQueryResponse
  >;
  readonly selectedGeneratedReference?: SelectedGeneratedReference;
  readonly selectedNamedReferenceName?: string;
  readonly selectionReferenceCandidates?: SelectionReferenceCandidatesQueryResponse;
  readonly units: DocumentUnits;
}) {
  const faces = references?.faces ?? [];
  const sketchAttachableFaces = getSketchAttachableFaces(faces);
  const commandReadySketchAttachableFaces = sketchAttachableFaces.filter(
    (face) =>
      getSelectionReferenceOperationStatus(
        referenceCandidatesByStableId?.get(face.stableId),
        "feature.attachSketchPlane"
      ).available
  );
  const firstEligibleFace = commandReadySketchAttachableFaces[0];
  const referenceItems = references
    ? getGeneratedReferenceItems(references)
    : [];
  const referenceGroups = references
    ? getGeneratedReferenceGroups(references)
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
    commandReadySketchAttachableFaces.find(
      (face) => face.stableId === selectedFaceStableId
    ) ?? firstEligibleFace;
  const [draft, setDraft] = useState({
    id: "",
    name: firstEligibleFace
      ? createSketchOnFaceDefaultName(firstEligibleFace)
      : "Face sketch"
  });
  const [edgeFinishOperation, setEdgeFinishOperation] =
    useState<EdgeFinishOperation>("chamfer");
  const canShowEdgeFinishEditor =
    hasSelectionReferenceOperation(
      selectionReferenceCandidates,
      "feature.chamfer"
    ) ||
    hasSelectionReferenceOperation(
      selectionReferenceCandidates,
      "feature.fillet"
    );
  const sketchOnFaceForm = selectedFace
    ? buildSketchOnFaceForm(bodyId, selectedFace, draft)
    : undefined;
  const selectedFaceContractStatus = getSelectionReferenceOperationStatus(
    selectedFace
      ? referenceCandidatesByStableId?.get(selectedFace.stableId)
      : undefined,
    "feature.attachSketchPlane"
  );
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

  function selectReference(reference: CadGeneratedReference) {
    onSelectGeneratedReference(createSelectedGeneratedReference(reference));
  }

  function useFaceForSketch(face: CadGeneratedFaceReference) {
    setSelectedFaceStableId(face.stableId);
    setDraft((currentDraft) => ({
      ...currentDraft,
      name: createSketchOnFaceDefaultName(face)
    }));
    selectReference(face);
  }

  function useEdgeForFinish(
    edge: Extract<CadGeneratedReference, { readonly kind: "edge" }>,
    operation: EdgeFinishOperation
  ) {
    setEdgeFinishOperation(operation);
    selectReference(edge);
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
          {sketchAttachableFaces.length > 0 &&
            commandReadySketchAttachableFaces.length === 0 && (
              <p className="project-message">
                {getFirstUnavailableReferenceOperationMessage(
                  sketchAttachableFaces,
                  referenceCandidatesByStableId,
                  "feature.attachSketchPlane"
                ) ??
                  "No generated faces are command-ready for attached sketches."}
              </p>
            )}
          {commandReadySketchAttachableFaces.length > 0 && (
            <section className="sketch-attachment">
              <div className="command-card-heading">
                <h3>Create sketch on face</h3>
                <span>{commandReadySketchAttachableFaces.length}</span>
              </div>
              <label>
                Face
                <select
                  value={selectedFace?.stableId ?? ""}
                  disabled={disabled}
                  onChange={(event) => {
                    const nextFace = commandReadySketchAttachableFaces.find(
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
                  {commandReadySketchAttachableFaces.map((face) => (
                    <option key={face.stableId} value={face.stableId}>
                      {face.label}
                    </option>
                  ))}
                </select>
              </label>
              {selectedFace && (
                <small>
                  {selectedFaceContractStatus.available
                    ? formatSketchOnFaceAvailability(selectedFace)
                    : selectedFaceContractStatus.message}
                </small>
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
                disabled={
                  disabled ||
                  !sketchOnFaceForm ||
                  !selectedFaceContractStatus.available
                }
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
            namedReferenceHealthByName={namedReferenceHealthByName}
            onDeleteNamedReference={onDeleteNamedReference}
            onNameGeneratedReference={onNameGeneratedReference}
            onRepairNamedReference={onRepairNamedReference}
            repairReference={namedReferences.find(
              (reference) => reference.name === selectedNamedReferenceName
            )}
            selectionReferenceCandidates={selectionReferenceCandidates}
            state={selectedReferenceState}
            units={units}
          />
          {canShowEdgeFinishEditor && (
            <EdgeFinishEditor
              key={`edge-finish-${
                selectedReferenceState.status === "selected"
                  ? selectedReferenceState.reference.stableId
                  : selectedReferenceState.status
              }-${edgeFinishOperation}`}
              body={body}
              disabled={disabled}
              feature={feature}
              namedReferences={selectedNamedReferences}
              onCreateEdgeFinish={onCreateEdgeFinish}
              preferredOperation={edgeFinishOperation}
              selectionReferenceCandidates={selectionReferenceCandidates}
              state={selectedReferenceState}
            />
          )}
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
              {referenceGroups.map((group) => (
                <optgroup key={group.kind} label={group.label}>
                  {group.references.map((reference) => (
                    <option key={reference.stableId} value={reference.stableId}>
                      {reference.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <details className="generated-reference-browser">
            <summary>
              <span>Browse all generated references</span>
              <small>
                {formatReferenceBrowserSummary(referenceItems.length)}
              </small>
            </summary>
            <GeneratedReferenceGroupsList
              disabled={disabled}
              groups={referenceGroups}
              referenceCandidatesByStableId={referenceCandidatesByStableId}
              selectedGeneratedReference={selectedGeneratedReference}
              onSelectReference={selectReference}
              onUseEdgeForFinish={useEdgeForFinish}
              onUseFaceForSketch={useFaceForSketch}
            />
          </details>
        </>
      )}
    </section>
  );
}

function GeneratedReferenceGroupsList({
  disabled,
  groups,
  referenceCandidatesByStableId,
  selectedGeneratedReference,
  onSelectReference,
  onUseEdgeForFinish,
  onUseFaceForSketch
}: {
  readonly disabled: boolean;
  readonly groups: readonly GeneratedReferenceGroup[];
  readonly referenceCandidatesByStableId?: ReadonlyMap<
    string,
    SelectionReferenceCandidatesQueryResponse
  >;
  readonly selectedGeneratedReference?: SelectedGeneratedReference;
  readonly onSelectReference: (reference: CadGeneratedReference) => void;
  readonly onUseEdgeForFinish: (
    edge: Extract<CadGeneratedReference, { readonly kind: "edge" }>,
    operation: EdgeFinishOperation
  ) => void;
  readonly onUseFaceForSketch: (face: CadGeneratedFaceReference) => void;
}) {
  if (groups.length === 0) {
    return null;
  }

  return (
    <section className="generated-reference-groups">
      {groups.map((group) => (
        <details
          key={group.kind}
          className="generated-reference-group"
          open={shouldOpenGeneratedReferenceGroup(
            group.kind,
            selectedGeneratedReference?.kind
          )}
        >
          <summary>
            <span>{group.label}</span>
            <small>{group.countLabel}</small>
          </summary>
          <ul className="reference-list compact generated-reference-list">
            {group.references.map((reference) => {
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
                    <span>{formatGeneratedReferenceKind(reference.kind)}</span>
                  </div>
                  {reference.description && (
                    <small>{reference.description}</small>
                  )}
                  <GeneratedReferenceActionRow
                    disabled={disabled}
                    referenceCandidates={referenceCandidatesByStableId?.get(
                      reference.stableId
                    )}
                    reference={reference}
                    selected={isSelected}
                    onSelectReference={onSelectReference}
                    onUseEdgeForFinish={onUseEdgeForFinish}
                    onUseFaceForSketch={onUseFaceForSketch}
                  />
                  <GeneratedReferenceIdentityDetails reference={reference} />
                </li>
              );
            })}
          </ul>
        </details>
      ))}
    </section>
  );
}

function getFirstUnavailableReferenceOperationMessage(
  references: readonly CadGeneratedReference[],
  referenceCandidatesByStableId:
    | ReadonlyMap<string, SelectionReferenceCandidatesQueryResponse>
    | undefined,
  operation: CadSelectionReferenceOperation
): string | undefined {
  return references
    .map((reference) =>
      getSelectionReferenceOperationStatus(
        referenceCandidatesByStableId?.get(reference.stableId),
        operation
      )
    )
    .find((status) => !status.available)?.message;
}

function hasSelectionReferenceOperation(
  response: SelectionReferenceCandidatesQueryResponse | undefined,
  operation: CadSelectionReferenceOperation
): boolean {
  return (
    response?.candidates.some((candidate) =>
      candidate.commandOperations.includes(operation)
    ) ?? false
  );
}

function shouldOpenGeneratedReferenceGroup(
  groupKind: CadGeneratedReference["kind"],
  selectedKind: CadGeneratedReference["kind"] | undefined
): boolean {
  return selectedKind ? groupKind === selectedKind : false;
}

function formatReferenceBrowserSummary(count: number): string {
  return `${count} ${count === 1 ? "reference" : "references"}`;
}

function GeneratedReferenceActionRow({
  disabled,
  referenceCandidates,
  reference,
  selected,
  onSelectReference,
  onUseEdgeForFinish,
  onUseFaceForSketch
}: {
  readonly disabled: boolean;
  readonly referenceCandidates?: SelectionReferenceCandidatesQueryResponse;
  readonly reference: CadGeneratedReference;
  readonly selected: boolean;
  readonly onSelectReference: (reference: CadGeneratedReference) => void;
  readonly onUseEdgeForFinish: (
    edge: Extract<CadGeneratedReference, { readonly kind: "edge" }>,
    operation: EdgeFinishOperation
  ) => void;
  readonly onUseFaceForSketch: (face: CadGeneratedFaceReference) => void;
}) {
  return (
    <div className="generated-reference-actions">
      <div className="generated-reference-action">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSelectReference(reference)}
        >
          {selected ? "Selected" : "Inspect"}
        </button>
      </div>
      {createGeneratedReferenceActionStatuses(reference).map((action) => {
        if (action.id === "reference.name") {
          const contractStatus = getSelectionReferenceOperationStatus(
            referenceCandidates,
            "reference.nameGenerated"
          );
          const available = action.available && contractStatus.available;

          return (
            <div key={action.id} className="generated-reference-action">
              <button
                type="button"
                disabled={disabled || !available}
                onClick={() => onSelectReference(reference)}
              >
                Name
              </button>
              {!available && (
                <small>
                  {action.available
                    ? contractStatus.message
                    : formatGeneratedReferenceActionStatus(action)}
                </small>
              )}
            </div>
          );
        }

        if (action.id === "sketch.createOnFace" && reference.kind === "face") {
          const contractStatus = getSelectionReferenceOperationStatus(
            referenceCandidates,
            "feature.attachSketchPlane"
          );
          const available = action.available && contractStatus.available;

          return (
            <div key={action.id} className="generated-reference-action">
              <button
                type="button"
                disabled={disabled || !available}
                onClick={() => onUseFaceForSketch(reference)}
              >
                Sketch
              </button>
              {!available && (
                <small>
                  {action.available
                    ? contractStatus.message
                    : formatGeneratedReferenceActionStatus(action)}
                </small>
              )}
            </div>
          );
        }

        if (action.id === "feature.chamfer" && reference.kind === "edge") {
          const contractStatus = getSelectionReferenceOperationStatus(
            referenceCandidates,
            "feature.chamfer"
          );
          const available = action.available && contractStatus.available;

          return (
            <div key={action.id} className="generated-reference-action">
              <button
                type="button"
                disabled={disabled || !available}
                onClick={() => onUseEdgeForFinish(reference, "chamfer")}
              >
                Chamfer
              </button>
              {!available && (
                <small>
                  {action.available
                    ? contractStatus.message
                    : formatGeneratedReferenceActionStatus(action)}
                </small>
              )}
            </div>
          );
        }

        if (action.id === "feature.fillet" && reference.kind === "edge") {
          const contractStatus = getSelectionReferenceOperationStatus(
            referenceCandidates,
            "feature.fillet"
          );
          const available = action.available && contractStatus.available;

          return (
            <div key={action.id} className="generated-reference-action">
              <button
                type="button"
                disabled={disabled || !available}
                onClick={() => onUseEdgeForFinish(reference, "fillet")}
              >
                Fillet
              </button>
              {!available && (
                <small>
                  {action.available
                    ? contractStatus.message
                    : formatGeneratedReferenceActionStatus(action)}
                </small>
              )}
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}

function GeneratedReferenceIdentityDetails({
  reference
}: {
  readonly reference: CadGeneratedReference;
}) {
  return (
    <details className="advanced-options compact reference-id-details">
      <summary>Stable ID and source</summary>
      <dl className="reference-detail-list">
        {createGeneratedReferenceDetailRows(reference).map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

function SelectedGeneratedReferencePanel({
  disabled,
  namedReferences,
  namedReferenceHealthByName,
  onDeleteNamedReference,
  onNameGeneratedReference,
  onRepairNamedReference,
  repairReference,
  selectionReferenceCandidates,
  state,
  units
}: {
  readonly disabled: boolean;
  readonly namedReferences: readonly NamedGeneratedReferenceEntry[];
  readonly namedReferenceHealthByName?: ReadonlyMap<
    string,
    CadReferenceHealthEntry
  >;
  readonly onDeleteNamedReference: (name: string) => void;
  readonly onNameGeneratedReference: (
    name: string,
    target: SelectedGeneratedReference
  ) => void;
  readonly onRepairNamedReference: (
    name: string,
    target: SelectedGeneratedReference
  ) => void;
  readonly repairReference?: NamedGeneratedReferenceEntry;
  readonly selectionReferenceCandidates?: SelectionReferenceCandidatesQueryResponse;
  readonly state: GeneratedReferenceSelectionState;
  readonly units: DocumentUnits;
}) {
  const [name, setName] = useState(
    state.status === "selected" ? state.reference.label : ""
  );
  const normalizedName = name.trim();
  const nameStatus = getSelectionReferenceOperationStatus(
    selectionReferenceCandidates,
    "reference.nameGenerated"
  );
  const canNameReference =
    state.status === "selected" &&
    normalizedName.length > 0 &&
    nameStatus.available;
  const repairState = createNamedReferenceRepairUiState({
    namedReferences: repairReference ? [repairReference] : [],
    namedReferenceHealthByName,
    selectedNamedReferenceName: repairReference?.name,
    selectedGeneratedReference:
      state.status === "selected" ? state.selection : undefined,
    selectionReferenceCandidates
  });

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
          <details className="advanced-options compact reference-id-details">
            <summary>Stable ID</summary>
            <code>{state.selection.stableId}</code>
          </details>
        </>
      ) : (
        <>
          <div className="reference-heading">
            <strong>{state.reference.label}</strong>
          </div>
          {state.reference.description && <p>{state.reference.description}</p>}
          <small>
            Eligible: {formatGeneratedReferenceOperationLabels(state.reference)}
          </small>
          <GeneratedReferenceIdentityDetails reference={state.reference} />
          <SelectionReferenceContractPanel
            response={selectionReferenceCandidates}
          />
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
          {!nameStatus.available && (
            <p className="error-text">{nameStatus.message}</p>
          )}
          {repairState.status !== "none" && (
            <div className="named-reference-repair">
              <div>
                <strong>Repair {repairState.reference.name}</strong>
                <small>
                  {formatNamedReferenceRepairHealthStatus(
                    repairState.healthStatus
                  )}
                </small>
                <small>{repairState.message}</small>
                {repairState.diagnostics[0] && (
                  <small className="error-text inline">
                    {repairState.diagnostics[0].code
                      ? `${repairState.diagnostics[0].code}: `
                      : ""}
                    {repairState.diagnostics[0].message}
                  </small>
                )}
              </div>
              {repairState.status === "ready" && (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    onRepairNamedReference(
                      repairState.reference.name,
                      repairState.target
                    );
                  }}
                >
                  Repair name
                </button>
              )}
            </div>
          )}
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

function EdgeFinishEditor({
  body,
  disabled,
  feature,
  namedReferences,
  onCreateEdgeFinish,
  preferredOperation,
  selectionReferenceCandidates,
  state
}: {
  readonly body: CadBodySnapshot;
  readonly disabled: boolean;
  readonly feature?: CadFeatureSummary;
  readonly namedReferences: readonly NamedGeneratedReferenceEntry[];
  readonly onCreateEdgeFinish: (
    operation: EdgeFinishOperation,
    form: FeatureEdgeFinishForm
  ) => void;
  readonly preferredOperation: EdgeFinishOperation;
  readonly selectionReferenceCandidates?: SelectionReferenceCandidatesQueryResponse;
  readonly state: GeneratedReferenceSelectionState;
}) {
  const [operation, setOperation] =
    useState<EdgeFinishOperation>(preferredOperation);
  const [referenceValue, setReferenceValue] = useState(
    SELECTED_EDGE_FINISH_REFERENCE_VALUE
  );
  const [draft, setDraft] = useState<EdgeFinishDraft>({
    id: "",
    bodyId: "",
    name: "",
    distance: 0.2,
    radius: 0.2
  });
  const referenceOptions = createEdgeFinishReferenceOptions(
    state,
    namedReferences,
    selectionReferenceCandidates
  );
  const referenceOption = selectEdgeFinishReferenceOption(
    referenceOptions,
    referenceValue
  );
  const scalar = operation === "chamfer" ? draft.distance : draft.radius;
  const status = getEdgeFinishOperationStatus({
    body,
    feature,
    operation,
    referenceOption,
    scalar,
    selectionState: state
  });
  const contractStatus = getSelectionReferenceOperationStatus(
    selectionReferenceCandidates,
    operation === "chamfer" ? "feature.chamfer" : "feature.fillet"
  );
  const canCreateEdgeFinish = status.available && contractStatus.available;
  const form = buildEdgeFinishForm({
    draft,
    operation,
    referenceOption,
    targetBodyId: body.id
  });
  const operationLabel = formatEdgeFinishOperationLabel(operation);
  const scalarName = formatEdgeFinishScalarName(operation);

  return (
    <section className="sketch-attachment edge-finish-editor">
      <div className="command-card-heading">
        <h3>Edge finish</h3>
        <span>{operationLabel}</span>
      </div>
      <div className="button-row compact">
        <button
          type="button"
          className={operation === "chamfer" ? "selected" : undefined}
          aria-pressed={operation === "chamfer"}
          disabled={disabled}
          onClick={() => setOperation("chamfer")}
        >
          Chamfer
        </button>
        <button
          type="button"
          className={operation === "fillet" ? "selected" : undefined}
          aria-pressed={operation === "fillet"}
          disabled={disabled}
          onClick={() => setOperation("fillet")}
        >
          Fillet
        </button>
      </div>
      {referenceOptions.length > 1 && (
        <label>
          Reference
          <select
            value={referenceOption?.value ?? referenceValue}
            disabled={disabled}
            onChange={(event) => setReferenceValue(event.currentTarget.value)}
          >
            {referenceOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.kind === "generated"
                  ? option.label
                  : `${option.label}${
                      option.status === "stale" ? " (stale)" : ""
                    }`}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="field-grid two">
        <label>
          {scalarName}
          <input
            type="number"
            min="0"
            step="0.1"
            value={Number.isFinite(scalar) ? scalar : ""}
            disabled={disabled}
            onChange={(event) => {
              const value = Number(event.currentTarget.value);
              setDraft(
                operation === "chamfer"
                  ? { ...draft, distance: value }
                  : { ...draft, radius: value }
              );
            }}
          />
        </label>
        <label>
          Feature name
          <input
            type="text"
            value={draft.name}
            disabled={disabled}
            placeholder="Optional"
            onChange={(event) =>
              setDraft({ ...draft, name: event.currentTarget.value })
            }
          />
        </label>
      </div>
      <details className="advanced-options compact">
        <summary>Advanced feature options</summary>
        <div className="field-grid two">
          <label>
            Optional feature ID
            <input
              type="text"
              value={draft.id}
              disabled={disabled}
              onChange={(event) =>
                setDraft({ ...draft, id: event.currentTarget.value })
              }
            />
          </label>
          <label>
            Optional body ID
            <input
              type="text"
              value={draft.bodyId}
              disabled={disabled}
              onChange={(event) =>
                setDraft({ ...draft, bodyId: event.currentTarget.value })
              }
            />
          </label>
        </div>
      </details>
      <button
        type="button"
        disabled={disabled || !canCreateEdgeFinish || !form}
        onClick={() => {
          if (form) {
            onCreateEdgeFinish(operation, form);
          }
        }}
      >
        Create {operation}
      </button>
      {!contractStatus.available ? (
        <p className="error-text">{contractStatus.message}</p>
      ) : status.available ? (
        <small>{status.message}</small>
      ) : (
        <p className="error-text">{status.message}</p>
      )}
    </section>
  );
}

function NamedReferencesPanel({
  candidatesByName,
  disabled,
  healthByName,
  references,
  selectedNamedReferenceName,
  selectedGeneratedReference,
  onInspectNamedReference,
  onDeleteNamedReference
}: {
  readonly candidatesByName?: ReadonlyMap<
    string,
    SelectionReferenceCandidatesQueryResponse
  >;
  readonly disabled: boolean;
  readonly healthByName?: ReadonlyMap<string, CadReferenceHealthEntry>;
  readonly references: readonly NamedGeneratedReferenceEntry[];
  readonly selectedNamedReferenceName?: string;
  readonly selectedGeneratedReference?: SelectedGeneratedReference;
  readonly onInspectNamedReference: (name: string) => void;
  readonly onDeleteNamedReference: (name: string) => void;
}) {
  if (references.length === 0) {
    return null;
  }

  const repairableCount = references.filter(
    (reference) =>
      reference.status === "stale" ||
      isRepairableNamedReferenceHealth(
        healthByName?.get(reference.name)?.status
      )
  ).length;

  return (
    <section className="command-card">
      <div className="command-card-heading">
        <h3>Named references</h3>
        <span>
          {repairableCount > 0
            ? `${repairableCount} repairable`
            : references.length}
        </span>
      </div>
      <ul className="reference-list compact named-reference-list">
        {references.map((reference) => {
          const status = formatNamedReferenceStatus(reference);
          const health = healthByName?.get(reference.name);
          const contractResponse = candidatesByName?.get(reference.name);
          const contractIssues =
            contractResponse?.issues.map((issue) => issue.message) ?? [];
          const isRepairable =
            reference.status === "stale" ||
            isRepairableNamedReferenceHealth(health?.status);
          const isSelected =
            selectedNamedReferenceName === reference.name ||
            (selectedGeneratedReference?.bodyId === reference.bodyId &&
              selectedGeneratedReference.stableId === reference.stableId &&
              selectedGeneratedReference.kind === reference.kind);

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
                  status.tone === "stale" || isRepairable
                    ? "error-text inline"
                    : undefined
                }
              >
                {health
                  ? formatNamedReferenceRepairHealthStatus(health.status)
                  : status.text}
              </small>
              {health?.diagnostics[0] && (
                <small className="error-text inline">
                  {health.diagnostics[0].code}: {health.diagnostics[0].message}
                </small>
              )}
              {contractResponse && (
                <small
                  className={
                    contractResponse.status === "resolved"
                      ? undefined
                      : "error-text inline"
                  }
                >
                  {formatSelectionReferenceStatus(contractResponse.status)}
                </small>
              )}
              {contractIssues.length > 0 && (
                <small className="error-text inline">{contractIssues[0]}</small>
              )}
              {selectedNamedReferenceName === reference.name &&
                isRepairable && (
                  <small>
                    Select a replacement{" "}
                    {formatGeneratedReferenceKind(reference.kind).toLowerCase()}{" "}
                    reference, then repair the name.
                  </small>
                )}
              <div className="button-row compact">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onInspectNamedReference(reference.name)}
                >
                  {isRepairable ? "Select for repair" : "Inspect"}
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
  editability,
  feature,
  onApply,
  units
}: {
  readonly disabled: boolean;
  readonly editability?: FeatureEditabilityQueryResponse;
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
  const canEdit = isFeatureEditOperationAvailable(
    editability,
    "feature.updateExtrude"
  );
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
        <span>
          {hasChanges ? "Edited" : formatFeatureEditStatus(editability)}
        </span>
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
          disabled={disabled || !canEdit}
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
          disabled={disabled || !canEdit}
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
          disabled={disabled || !canEdit || !hasChanges || !isValid}
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
      {!canEdit && (
        <p className="error-text">{getFeatureEditDiagnostic(editability)}</p>
      )}
      {canEdit && !isValid && (
        <p className="error-text">Depth must be positive.</p>
      )}
    </section>
  );
}

function RevolveFeatureEditor({
  disabled,
  editability,
  feature,
  onApply
}: {
  readonly disabled: boolean;
  readonly editability?: FeatureEditabilityQueryResponse;
  readonly feature: Extract<CadFeatureSummary, { readonly kind: "revolve" }>;
  readonly onApply: (featureId: string, angleDegrees: number) => void;
}) {
  const [angleDegrees, setAngleDegrees] = useState(feature.angleDegrees);
  const canEdit = isFeatureEditOperationAvailable(
    editability,
    "feature.updateRevolve"
  );
  const hasChanges = angleDegrees !== feature.angleDegrees;
  const isValid =
    Number.isFinite(angleDegrees) && angleDegrees > 0 && angleDegrees <= 360;

  return (
    <section className="command-card nested">
      <div className="command-card-heading">
        <h3>Revolve feature</h3>
        <span>
          {hasChanges ? "Edited" : formatFeatureEditStatus(editability)}
        </span>
      </div>
      <label>
        Angle (deg)
        <input
          type="number"
          step="1"
          value={angleDegrees}
          disabled={disabled || !canEdit}
          onChange={(event) => {
            const nextAngle = event.currentTarget.valueAsNumber;
            setAngleDegrees(Number.isNaN(nextAngle) ? 0 : nextAngle);
          }}
        />
      </label>
      <div className="button-row">
        <button
          type="button"
          disabled={disabled || !canEdit || !hasChanges || !isValid}
          onClick={() => onApply(feature.id, angleDegrees)}
        >
          Apply revolve
        </button>
        <button
          type="button"
          disabled={disabled || !hasChanges}
          onClick={() => setAngleDegrees(feature.angleDegrees)}
        >
          Reset edits
        </button>
      </div>
      {!canEdit && (
        <p className="error-text">{getFeatureEditDiagnostic(editability)}</p>
      )}
      {canEdit && !isValid && (
        <p className="error-text">Angle must be between 0 and 360 degrees.</p>
      )}
    </section>
  );
}

function HoleFeatureEditor({
  disabled,
  editability,
  feature,
  onApply,
  units
}: {
  readonly disabled: boolean;
  readonly editability?: FeatureEditabilityQueryResponse;
  readonly feature: Extract<CadFeatureSummary, { readonly kind: "hole" }>;
  readonly onApply: (
    featureId: string,
    depthMode: FeatureHoleDepthMode,
    depth: number | undefined,
    direction: FeatureHoleDirection
  ) => void;
  readonly units: DocumentUnits;
}) {
  const [depthMode, setDepthMode] = useState<FeatureHoleDepthMode>(
    feature.depthMode
  );
  const [depth, setDepth] = useState(feature.depth ?? 1);
  const [direction, setDirection] = useState<FeatureHoleDirection>(
    feature.direction
  );
  const canEdit = isFeatureEditOperationAvailable(
    editability,
    "feature.updateHole"
  );
  const effectiveDepth = depthMode === "blind" ? depth : undefined;
  const hasChanges =
    depthMode !== feature.depthMode ||
    direction !== feature.direction ||
    (depthMode === "blind" && effectiveDepth !== feature.depth);
  const isValid =
    depthMode === "throughAll" || (Number.isFinite(depth) && depth > 0);

  return (
    <section className="command-card nested">
      <div className="command-card-heading">
        <h3>Hole feature</h3>
        <span>
          {hasChanges ? "Edited" : formatFeatureEditStatus(editability)}
        </span>
      </div>
      <label>
        Depth mode
        <select
          value={depthMode}
          disabled={disabled || !canEdit}
          onChange={(event) =>
            setDepthMode(event.currentTarget.value as FeatureHoleDepthMode)
          }
        >
          <option value="blind">Blind</option>
          <option value="throughAll">Through all</option>
        </select>
      </label>
      {depthMode === "blind" && (
        <label>
          Depth ({units})
          <input
            type="number"
            step="0.1"
            value={depth}
            disabled={disabled || !canEdit}
            onChange={(event) => {
              const nextDepth = event.currentTarget.valueAsNumber;
              setDepth(Number.isNaN(nextDepth) ? 0 : nextDepth);
            }}
          />
        </label>
      )}
      <label>
        Direction
        <select
          value={direction}
          disabled={disabled || !canEdit}
          onChange={(event) =>
            setDirection(event.currentTarget.value as FeatureHoleDirection)
          }
        >
          <option value="positive">Positive</option>
          <option value="negative">Negative</option>
        </select>
      </label>
      <div className="button-row">
        <button
          type="button"
          disabled={disabled || !canEdit || !hasChanges || !isValid}
          onClick={() =>
            onApply(feature.id, depthMode, effectiveDepth, direction)
          }
        >
          Apply hole
        </button>
        <button
          type="button"
          disabled={disabled || !hasChanges}
          onClick={() => {
            setDepthMode(feature.depthMode);
            setDepth(feature.depth ?? 1);
            setDirection(feature.direction);
          }}
        >
          Reset edits
        </button>
      </div>
      {!canEdit && (
        <p className="error-text">{getFeatureEditDiagnostic(editability)}</p>
      )}
      {canEdit && !isValid && (
        <p className="error-text">Blind hole depth must be positive.</p>
      )}
    </section>
  );
}

function EdgeFinishFeatureEditor({
  disabled,
  editability,
  feature,
  kind,
  onApply,
  units
}: {
  readonly disabled: boolean;
  readonly editability?: FeatureEditabilityQueryResponse;
  readonly feature:
    | Extract<CadFeatureSummary, { readonly kind: "chamfer" }>
    | Extract<CadFeatureSummary, { readonly kind: "fillet" }>;
  readonly kind: "chamfer" | "fillet";
  readonly onApply: (featureId: string, value: number) => void;
  readonly units: DocumentUnits;
}) {
  const currentValue =
    feature.kind === "chamfer" ? feature.distance : feature.radius;
  const [value, setValue] = useState(currentValue);
  const operation =
    feature.kind === "chamfer"
      ? "feature.updateChamfer"
      : "feature.updateFillet";
  const canEdit = isFeatureEditOperationAvailable(editability, operation);
  const hasChanges = value !== currentValue;
  const isValid = Number.isFinite(value) && value > 0;
  const label = kind === "chamfer" ? "Distance" : "Radius";

  return (
    <section className="command-card nested">
      <div className="command-card-heading">
        <h3>{kind === "chamfer" ? "Chamfer feature" : "Fillet feature"}</h3>
        <span>
          {hasChanges ? "Edited" : formatFeatureEditStatus(editability)}
        </span>
      </div>
      <label>
        {label} ({units})
        <input
          type="number"
          step="0.05"
          value={value}
          disabled={disabled || !canEdit}
          onChange={(event) => {
            const nextValue = event.currentTarget.valueAsNumber;
            setValue(Number.isNaN(nextValue) ? 0 : nextValue);
          }}
        />
      </label>
      <div className="button-row">
        <button
          type="button"
          disabled={disabled || !canEdit || !hasChanges || !isValid}
          onClick={() => onApply(feature.id, value)}
        >
          {kind === "chamfer" ? "Apply chamfer" : "Apply fillet"}
        </button>
        <button
          type="button"
          disabled={disabled || !hasChanges}
          onClick={() => setValue(currentValue)}
        >
          Reset edits
        </button>
      </div>
      {!canEdit && (
        <p className="error-text">{getFeatureEditDiagnostic(editability)}</p>
      )}
      {canEdit && !isValid && (
        <p className="error-text">{label} must be positive.</p>
      )}
    </section>
  );
}

function isFeatureEditOperationAvailable(
  editability: FeatureEditabilityQueryResponse | undefined,
  operation: string
): boolean {
  return Boolean(
    editability?.status === "editable" &&
    editability.fields.some(
      (field) => field.editable && field.commitOperation === operation
    )
  );
}

function formatFeatureEditStatus(
  editability: FeatureEditabilityQueryResponse | undefined
): string {
  if (!editability) {
    return "Unavailable";
  }

  if (editability.status === "editable") {
    return "Editable";
  }

  return editability.status === "missing"
    ? "Missing"
    : editability.status === "unsupported"
      ? "Unsupported"
      : "Not editable";
}

function getFeatureEditDiagnostic(
  editability: FeatureEditabilityQueryResponse | undefined
): string {
  return (
    editability?.diagnostics.find(
      (diagnostic) => diagnostic.severity === "blocker"
    )?.message ??
    editability?.diagnostics[0]?.message ??
    "This feature is not editable from the current source state."
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
