import type {
  DimensionCommandForm,
  TransformCommandForm
} from "../cadCommands";

export function DimensionFields<TForm extends DimensionCommandForm>({
  disabled = false,
  fields,
  form,
  onChange,
  unitLabel
}: {
  readonly disabled?: boolean;
  readonly fields: readonly ("width" | "height" | "depth" | "radius")[];
  readonly form: TForm;
  readonly onChange: (form: TForm) => void;
  readonly unitLabel?: string;
}) {
  return (
    <div className="field-grid two">
      {fields.map((field) => (
        <NumberField
          key={field}
          label={unitLabel ? `${field} (${unitLabel})` : field}
          disabled={disabled}
          value={form[field]}
          onChange={(value) => onChange({ ...form, [field]: value })}
        />
      ))}
    </div>
  );
}

export function TransformFields<TForm extends TransformCommandForm>({
  compact = false,
  disabled = false,
  form,
  onChange
}: {
  readonly compact?: boolean;
  readonly disabled?: boolean;
  readonly form: TForm;
  readonly onChange: (form: TForm) => void;
}) {
  return (
    <div className={compact ? "transform-fields compact" : "transform-fields"}>
      <fieldset>
        <legend>Translation</legend>
        <VectorFields
          keys={["translationX", "translationY", "translationZ"]}
          disabled={disabled}
          form={form}
          onChange={onChange}
        />
      </fieldset>
      <fieldset>
        <legend>Rotation</legend>
        <VectorFields
          keys={["rotationX", "rotationY", "rotationZ"]}
          disabled={disabled}
          form={form}
          onChange={onChange}
        />
      </fieldset>
      <fieldset>
        <legend>Scale</legend>
        <VectorFields
          keys={["scaleX", "scaleY", "scaleZ"]}
          disabled={disabled}
          form={form}
          onChange={onChange}
        />
      </fieldset>
    </div>
  );
}

export function TextField({
  disabled = false,
  label,
  onChange,
  placeholder,
  value
}: {
  readonly disabled?: boolean;
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
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </label>
  );
}

function VectorFields<TForm extends TransformCommandForm>({
  disabled,
  form,
  keys,
  onChange
}: {
  readonly disabled: boolean;
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
          disabled={disabled}
          value={form[key]}
          onChange={(value) => onChange({ ...form, [key]: value })}
        />
      ))}
    </div>
  );
}

function NumberField({
  disabled = false,
  label,
  onChange,
  value
}: {
  readonly disabled?: boolean;
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
        disabled={disabled}
        step="0.1"
        onChange={(event) => onChange(event.currentTarget.valueAsNumber || 0)}
      />
    </label>
  );
}
