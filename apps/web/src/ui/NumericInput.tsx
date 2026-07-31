import { useEffect, useRef, type FocusEventHandler } from "react";

export interface NumericInputProps {
  readonly value: number;
  readonly onValueChange: (value: number) => void;
  readonly id?: string;
  readonly name?: string;
  readonly className?: string;
  readonly min?: number | string;
  readonly max?: number | string;
  readonly step?: number | "any" | string;
  readonly disabled?: boolean;
  readonly required?: boolean;
  readonly onBlur?: FocusEventHandler<HTMLInputElement>;
  readonly "aria-describedby"?: string;
  readonly "aria-invalid"?: boolean;
  readonly "data-drawer-initial-focus"?: string;
}

/**
 * Leaves number editing native so transient values such as "-", ".", and an
 * empty field survive until the browser can report a complete number.
 */
export function NumericInput({
  value,
  onValueChange,
  onBlur,
  ...props
}: NumericInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (input && input.ownerDocument.activeElement !== input) {
      input.value = Number.isFinite(value) ? String(value) : "";
    }
  }, [value]);

  const handleBlur: FocusEventHandler<HTMLInputElement> = (event) => {
    reconcileNumericInputOnBlur(event.currentTarget, value);
    onBlur?.(event);
  };

  return (
    <input
      {...props}
      ref={inputRef}
      type="number"
      defaultValue={Number.isFinite(value) ? value : ""}
      onChange={(event) => onValueChange(event.currentTarget.valueAsNumber)}
      onBlur={handleBlur}
    />
  );
}

export function reconcileNumericInputOnBlur(
  input: Pick<HTMLInputElement, "value">,
  value: number
): void {
  input.value = Number.isFinite(value) ? String(value) : "";
}
