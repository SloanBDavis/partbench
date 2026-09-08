import type { ChangeEvent } from "react";
import { EditorFieldRow } from "../../editors/FeatureEditorShell";
import { NumericInput } from "../../ui/NumericInput";

export function NumberField({
  label,
  name,
  value,
  unit,
  min,
  step = "any",
  onChange
}: {
  readonly label: string;
  readonly name: string;
  readonly value: number;
  readonly unit?: string;
  readonly min?: number;
  readonly step?: number | "any";
  readonly onChange: (value: number) => void;
}) {
  const id = `solid-${name}`;
  return (
    <EditorFieldRow label={label} htmlFor={id} unit={unit} required>
      <NumericInput
        id={id}
        className="pb-field pb-numeric"
        value={value}
        min={min}
        step={step}
        onValueChange={onChange}
      />
    </EditorFieldRow>
  );
}

export function TextField({
  label,
  name,
  value,
  disabled = false,
  onChange
}: {
  readonly label: string;
  readonly name: string;
  readonly value: string;
  readonly disabled?: boolean;
  readonly onChange: (value: string) => void;
}) {
  const id = `solid-${name}`;
  return (
    <EditorFieldRow label={label} htmlFor={id}>
      <input
        id={id}
        className="pb-field"
        type="text"
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </EditorFieldRow>
  );
}

export function SelectField({
  label,
  name,
  value,
  options,
  disabled = false,
  onChange
}: {
  readonly label: string;
  readonly name: string;
  readonly value: string;
  readonly options: readonly {
    readonly value: string;
    readonly label: string;
    readonly disabled?: boolean;
  }[];
  readonly disabled?: boolean;
  readonly onChange: (value: string) => void;
}) {
  const id = `solid-${name}`;
  return (
    <EditorFieldRow label={label} htmlFor={id}>
      <select
        id={id}
        className="pb-field"
        disabled={disabled}
        value={value}
        onChange={(event: ChangeEvent<HTMLSelectElement>) =>
          onChange(event.currentTarget.value)
        }
      >
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>
    </EditorFieldRow>
  );
}
