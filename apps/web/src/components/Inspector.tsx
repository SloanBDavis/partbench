import type { SceneObject } from "@web-cad/cad-core";
import { useState } from "react";
import {
  areTransformFormsEqual,
  resetTransformRotation,
  resetTransformScale,
  resetTransformTranslation,
  transformToForm,
  type TransformCommandForm
} from "../cadCommands";
import {
  formatDimensions,
  formatObjectKind,
  formatVector
} from "../sceneObjectDisplay";
import { TransformFields } from "./FormFields";

export function Inspector({
  disabled = false,
  object,
  onApplyTransform,
  onDelete
}: {
  readonly disabled?: boolean;
  readonly object?: SceneObject;
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
