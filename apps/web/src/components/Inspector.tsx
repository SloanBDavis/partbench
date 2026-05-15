import type { SceneObject } from "@web-cad/cad-core";
import { useState } from "react";
import {
  areBoxDimensionFormsEqual,
  areCylinderDimensionFormsEqual,
  areTransformFormsEqual,
  boxDimensionsToForm,
  cylinderDimensionsToForm,
  resetTransformRotation,
  resetTransformScale,
  resetTransformTranslation,
  transformToForm,
  type DimensionCommandForm,
  type TransformCommandForm
} from "../cadCommands";
import {
  formatDimensions,
  formatObjectKind,
  formatVector
} from "../sceneObjectDisplay";
import { DimensionFields, TransformFields } from "./FormFields";

export function Inspector({
  disabled = false,
  object,
  onApplyDimensions,
  onApplyTransform,
  onDelete
}: {
  readonly disabled?: boolean;
  readonly object?: SceneObject;
  readonly onApplyDimensions: (form: DimensionCommandForm) => void;
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
              <dt>Type</dt>
              <dd>{formatObjectKind(object.kind)}</dd>
            </div>
            <div>
              <dt>Dimensions</dt>
              <dd>{formatDimensions(object)}</dd>
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
          <DimensionEditor
            key={`${object.id}-${JSON.stringify(object.dimensions)}`}
            object={object}
            disabled={disabled}
            onApply={onApplyDimensions}
          />
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

function DimensionEditor({
  disabled,
  object,
  onApply
}: {
  readonly disabled: boolean;
  readonly object: SceneObject;
  readonly onApply: (form: DimensionCommandForm) => void;
}) {
  const currentForm =
    object.kind === "box"
      ? boxDimensionsToForm(object.dimensions)
      : cylinderDimensionsToForm(object.dimensions);
  const [form, setForm] = useState<DimensionCommandForm>(() => currentForm);
  const fields =
    object.kind === "box"
      ? (["width", "height", "depth"] as const)
      : (["radius", "height"] as const);
  const hasChanges =
    object.kind === "box"
      ? !areBoxDimensionFormsEqual(form, currentForm)
      : !areCylinderDimensionFormsEqual(form, currentForm);

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
