import type {
  DocumentUnits,
  ObjectMeasurementsSnapshot,
  SceneObject
} from "@web-cad/cad-core";
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
  type TransformCommandForm
} from "../cadCommands";
import {
  formatDimensions,
  formatBounds,
  getObjectDisplayName,
  formatObjectKind,
  formatVector,
  formatVolume
} from "../sceneObjectDisplay";
import { DimensionFields, TextField, TransformFields } from "./FormFields";

export function Inspector({
  disabled = false,
  measurements,
  object,
  units,
  onApplyDimensions,
  onApplyName,
  onApplyTransform,
  onDelete
}: {
  readonly disabled?: boolean;
  readonly measurements?: ObjectMeasurementsSnapshot;
  readonly object?: SceneObject;
  readonly units: DocumentUnits;
  readonly onApplyDimensions: (form: DimensionCommandForm) => void;
  readonly onApplyName: (name: string) => void;
  readonly onApplyTransform: (form: TransformCommandForm) => void;
  readonly onDelete: () => void;
}) {
  return (
    <aside className="inspector" aria-label="Inspector">
      <h2>Inspector</h2>
      {!object ? (
        <p className="empty-state">No selection</p>
      ) : (
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
              <dd>{formatDimensions(object, units)}</dd>
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
            disabled={disabled}
            onApply={onApplyName}
          />
          <DimensionEditor
            key={`${object.id}-${JSON.stringify(object.dimensions)}`}
            object={object}
            units={units}
            disabled={disabled}
            onApply={onApplyDimensions}
          />
          <MeasurementPanel measurements={measurements} units={units} />
          <TransformEditor
            key={`${object.id}-${object.transform.translation.join(",")}-${object.transform.rotation.join(",")}-${object.transform.scale.join(",")}`}
            object={object}
            disabled={disabled}
            onApply={onApplyTransform}
            onDelete={onDelete}
          />
        </>
      )}
    </aside>
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
