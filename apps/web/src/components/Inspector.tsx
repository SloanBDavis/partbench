import type { SceneObject } from "@web-cad/cad-core";
import { useState } from "react";
import { transformToForm, type TransformCommandForm } from "../cadCommands";
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
              <dd>{object.kind}</dd>
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
  const [form, setForm] = useState<TransformCommandForm>(() =>
    transformToForm(object.transform)
  );

  return (
    <section className="command-card">
      <h3>Selected commands</h3>
      <TransformFields form={form} onChange={setForm} />
      <div className="button-row">
        <button type="button" onClick={() => onApply(form)} disabled={disabled}>
          Apply transform
        </button>
        <button
          type="button"
          className="danger"
          onClick={onDelete}
          disabled={disabled}
        >
          Delete object
        </button>
      </div>
    </section>
  );
}

function formatDimensions(object: SceneObject): string {
  if (object.kind === "box") {
    const { depth, height, width } = object.dimensions;
    return `${formatNumber(width)} x ${formatNumber(height)} x ${formatNumber(depth)}`;
  }

  const { height, radius } = object.dimensions;
  return `r ${formatNumber(radius)}, h ${formatNumber(height)}`;
}

function formatVector(vector: readonly [number, number, number]): string {
  return vector.map(formatNumber).join(", ");
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? value.toString() : value.toFixed(2);
}
