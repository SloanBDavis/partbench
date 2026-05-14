import type { BatchOperationForm, TransformCommandForm } from "../cadCommands";

export function DimensionFields<TForm extends BatchOperationForm>({
  fields,
  form,
  onChange
}: {
  readonly fields: readonly ("width" | "height" | "depth" | "radius")[];
  readonly form: TForm;
  readonly onChange: (form: TForm) => void;
}) {
  return (
    <div className="field-grid two">
      {fields.map((field) => (
        <NumberField
          key={field}
          label={field}
          value={form[field]}
          onChange={(value) => onChange({ ...form, [field]: value })}
        />
      ))}
    </div>
  );
}

export function TransformFields<TForm extends TransformCommandForm>({
  compact = false,
  form,
  onChange
}: {
  readonly compact?: boolean;
  readonly form: TForm;
  readonly onChange: (form: TForm) => void;
}) {
  return (
    <div className={compact ? "transform-fields compact" : "transform-fields"}>
      <fieldset>
        <legend>Translation</legend>
        <VectorFields
          keys={["translationX", "translationY", "translationZ"]}
          form={form}
          onChange={onChange}
        />
      </fieldset>
      <fieldset>
        <legend>Rotation</legend>
        <VectorFields
          keys={["rotationX", "rotationY", "rotationZ"]}
          form={form}
          onChange={onChange}
        />
      </fieldset>
      <fieldset>
        <legend>Scale</legend>
        <VectorFields
          keys={["scaleX", "scaleY", "scaleZ"]}
          form={form}
          onChange={onChange}
        />
      </fieldset>
    </div>
  );
}

export function TextField({
  label,
  onChange,
  placeholder,
  value
}: {
  readonly label: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly value: string;
}) {
  return (
    <label>
      {label}
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </label>
  );
}

function VectorFields<TForm extends TransformCommandForm>({
  form,
  keys,
  onChange
}: {
  readonly form: TForm;
  readonly keys: readonly (keyof TransformCommandForm)[];
  readonly onChange: (form: TForm) => void;
}) {
  return (
    <div className="field-grid three">
      {keys.map((key) => (
        <NumberField
          key={key}
          label={key.toString().slice(-1).toUpperCase()}
          value={form[key]}
          onChange={(value) => onChange({ ...form, [key]: value })}
        />
      ))}
    </div>
  );
}

function NumberField({
  label,
  onChange,
  value
}: {
  readonly label: string;
  readonly onChange: (value: number) => void;
  readonly value: number;
}) {
  return (
    <label>
      {label}
      <input
        type="number"
        value={value}
        step="0.1"
        onChange={(event) => onChange(event.currentTarget.valueAsNumber || 0)}
      />
    </label>
  );
}
