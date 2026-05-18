import type {
  BodyMeasurementsSnapshot,
  CadBodySnapshot,
  CadFeatureSummary,
  DocumentUnits,
  FeatureExtrudeSide,
  ObjectMeasurementsSnapshot,
  SceneObject
} from "@web-cad/cad-core";
import type {
  BodyGeneratedReferencesQueryResponse,
  CadGeneratedFaceReference,
  CadGeneratedReference
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
  formatSketchOnFaceAvailability,
  getGeneratedReferenceItems,
  getSketchAttachableFaces,
  type GeneratedReferenceMeasurementDisplay
} from "../generatedReferenceUi";
import {
  formatDimensions,
  formatArea,
  formatBounds,
  getObjectDisplayName,
  formatObjectKind,
  formatVector,
  formatVolume
} from "../sceneObjectDisplay";
import { DimensionFields, TextField, TransformFields } from "./FormFields";

export function Inspector({
  disabled = false,
  body,
  bodyMeasurements,
  bodyMeasurementsError,
  feature,
  generatedReferences,
  generatedReferencesError,
  generatedReferenceMeasurements,
  measurements,
  object,
  units,
  onApplyDimensions,
  onApplyName,
  onApplyTransform,
  onCreateSketchOnFace,
  onDelete,
  onDeleteFeature,
  onUpdateExtrude
}: {
  readonly disabled?: boolean;
  readonly body?: CadBodySnapshot;
  readonly bodyMeasurements?: BodyMeasurementsSnapshot;
  readonly bodyMeasurementsError?: string;
  readonly feature?: CadFeatureSummary;
  readonly generatedReferences?: BodyGeneratedReferencesQueryResponse;
  readonly generatedReferencesError?: string;
  readonly generatedReferenceMeasurements?: ReadonlyMap<
    string,
    GeneratedReferenceMeasurementDisplay
  >;
  readonly measurements?: ObjectMeasurementsSnapshot;
  readonly object?: SceneObject;
  readonly units: DocumentUnits;
  readonly onApplyDimensions: (form: DimensionCommandForm) => void;
  readonly onApplyName: (name: string) => void;
  readonly onApplyTransform: (form: TransformCommandForm) => void;
  readonly onCreateSketchOnFace: (form: SketchCreateOnFaceForm) => void;
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
        disabled,
        feature,
        generatedReferences,
        generatedReferencesError,
        generatedReferenceMeasurements,
        measurements,
        object,
        onApplyDimensions,
        onApplyName,
        onApplyTransform,
        onCreateSketchOnFace,
        onDelete,
        onDeleteFeature,
        onUpdateExtrude,
        units
      })}
    </aside>
  );
}

function renderInspectorSelection(input: {
  readonly body?: CadBodySnapshot;
  readonly bodyMeasurements?: BodyMeasurementsSnapshot;
  readonly bodyMeasurementsError?: string;
  readonly disabled: boolean;
  readonly feature?: CadFeatureSummary;
  readonly generatedReferences?: BodyGeneratedReferencesQueryResponse;
  readonly generatedReferencesError?: string;
  readonly generatedReferenceMeasurements?: ReadonlyMap<
    string,
    GeneratedReferenceMeasurementDisplay
  >;
  readonly measurements?: ObjectMeasurementsSnapshot;
  readonly object?: SceneObject;
  readonly units: DocumentUnits;
  readonly onApplyDimensions: (form: DimensionCommandForm) => void;
  readonly onApplyName: (name: string) => void;
  readonly onApplyTransform: (form: TransformCommandForm) => void;
  readonly onCreateSketchOnFace: (form: SketchCreateOnFaceForm) => void;
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
        disabled={input.disabled}
        feature={input.feature}
        generatedReferences={input.generatedReferences}
        generatedReferencesError={input.generatedReferencesError}
        generatedReferenceMeasurements={input.generatedReferenceMeasurements}
        onCreateSketchOnFace={input.onCreateSketchOnFace}
        onDeleteFeature={input.onDeleteFeature}
        onUpdateExtrude={input.onUpdateExtrude}
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
  onCreateSketchOnFace,
  onDeleteFeature,
  onUpdateExtrude,
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
  readonly onCreateSketchOnFace: (form: SketchCreateOnFaceForm) => void;
  readonly onDeleteFeature: (featureId: string) => void;
  readonly onUpdateExtrude: (
    featureId: string,
    depth: number,
    side: FeatureExtrudeSide
  ) => void;
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
          onCreateSketchOnFace={onCreateSketchOnFace}
          references={generatedReferences}
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

function GeneratedReferencesPanel({
  bodyId,
  disabled,
  error,
  measurementByStableId,
  onCreateSketchOnFace,
  references,
  units
}: {
  readonly bodyId: string;
  readonly disabled: boolean;
  readonly error?: string;
  readonly measurementByStableId?: ReadonlyMap<
    string,
    GeneratedReferenceMeasurementDisplay
  >;
  readonly onCreateSketchOnFace: (form: SketchCreateOnFaceForm) => void;
  readonly references?: BodyGeneratedReferencesQueryResponse;
  readonly units: DocumentUnits;
}) {
  const faces = references?.faces ?? [];
  const sketchAttachableFaces = getSketchAttachableFaces(faces);
  const firstEligibleFace = sketchAttachableFaces[0];
  const referenceItems = references
    ? getGeneratedReferenceItems(references)
    : [];
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
              <div className="field-grid two">
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
              </div>
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
          <ul className="reference-list">
            {referenceItems.map((reference) => {
              const face = asGeneratedFaceReference(reference);
              const measurementState = measurementByStableId?.get(
                reference.stableId
              );

              return (
                <li key={reference.stableId}>
                  <div className="reference-heading">
                    <strong>{reference.label}</strong>
                    <span>{formatGeneratedReferenceKind(reference.kind)}</span>
                  </div>
                  {reference.description && <p>{reference.description}</p>}
                  <small>
                    Eligible:{" "}
                    {formatGeneratedReferenceOperationLabels(reference)}
                  </small>
                  <code>{reference.stableId}</code>
                  {reference.eligibilityNotes &&
                    reference.eligibilityNotes.length > 0 && (
                      <small>{reference.eligibilityNotes.join(" ")}</small>
                    )}
                  {face && (
                    <small>
                      Sketch attachment:{" "}
                      {canCreateSketchOnFace(face)
                        ? formatGeneratedFaceEligibility(face)
                        : "Unavailable"}
                    </small>
                  )}
                  <GeneratedReferenceMeasurementRows
                    state={measurementState}
                    units={units}
                  />
                </li>
              );
            })}
          </ul>
        </>
      )}
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
