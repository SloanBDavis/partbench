import { useCallback, useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import "../styles/viewportFeatureGrips.css";

/** Geometry-free contract between a feature editor and its viewport grips. */
export interface ViewportFeatureGripDescriptor {
  readonly id: string; readonly label: string; readonly value: number; readonly unit: string;
  readonly normalStep: number; readonly shiftStep: number; readonly min?: number; readonly max?: number;
  readonly dragDisabled?: boolean; readonly integerOnly?: boolean; readonly readOnly?: boolean; readonly routeToOwnerLabel?: string;
}

export interface ViewportFeatureGripsProps {
  readonly grips: readonly ViewportFeatureGripDescriptor[]; readonly disabled?: boolean; readonly pending?: boolean; readonly ariaLabel?: string;
  readonly onValueChange?: (id: string, value: number) => void; readonly onChange?: (id: string, value: number) => void;
  readonly onApply?: () => void; readonly onCancel?: () => void; readonly onRouteToOwner?: (id: string) => void;
}

export const VIEWPORT_FEATURE_GRIP_PIXELS_PER_STEP = 8;

function validBounds({ min, max }: ViewportFeatureGripDescriptor): boolean {
  return (min === undefined || Number.isFinite(min)) && (max === undefined || Number.isFinite(max)) && (min === undefined || max === undefined || min <= max);
}

function validValue(descriptor: ViewportFeatureGripDescriptor, value: number): boolean {
  return Number.isFinite(value) && validBounds(descriptor) && (!descriptor.integerOnly || Number.isInteger(value)) && (descriptor.min === undefined || value >= descriptor.min) && (descriptor.max === undefined || value <= descriptor.max);
}

function increment(descriptor: ViewportFeatureGripDescriptor, shift: boolean): number | undefined {
  const value = shift ? descriptor.shiftStep : descriptor.normalStep;
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function clamp(descriptor: ViewportFeatureGripDescriptor, value: number): number | undefined {
  if (!Number.isFinite(value) || !validBounds(descriptor)) return undefined;
  const bounded = Math.min(descriptor.max ?? Number.POSITIVE_INFINITY, Math.max(descriptor.min ?? Number.NEGATIVE_INFINITY, value));
  return validValue(descriptor, bounded) ? bounded : undefined;
}

/** Returns a finite, bounded typed value. */
export function parseViewportFeatureGripValue(text: string, descriptor: ViewportFeatureGripDescriptor): number | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  const value = Number(trimmed);
  return validValue(descriptor, value) ? value : undefined;
}

/** Computes one bounded keyboard increment. */
export function stepViewportFeatureGripValue(descriptor: ViewportFeatureGripDescriptor, direction: -1 | 1, shift = false, baseValue = descriptor.value): number | undefined {
  const step = increment(descriptor, shift);
  return validValue(descriptor, baseValue) && step
    ? clamp(descriptor, baseValue + direction * step)
    : undefined;
}

/** Computes the stepped value for a horizontal pointer drag. */
export function dragViewportFeatureGripValue(descriptor: ViewportFeatureGripDescriptor, startValue: number, horizontalPixels: number, shift = false): number | undefined {
  if (!Number.isFinite(horizontalPixels) || !Number.isFinite(startValue)) {
    return undefined;
  }
  const step = increment(descriptor, shift);
  const pixels = Math.trunc(horizontalPixels / VIEWPORT_FEATURE_GRIP_PIXELS_PER_STEP);
  return step && pixels
    ? clamp(descriptor, startValue + pixels * step)
    : undefined;
}

function displayValue(value: number): string {
  return Number.isFinite(value) ? String(value) : "—";
}

interface ActiveDrag { readonly id: string; readonly pointerId: number; readonly startX: number; readonly startValue: number; lastValue?: number; }

interface GripRowProps {
  readonly descriptor: ViewportFeatureGripDescriptor; readonly disabled: boolean; readonly resetKey: number;
  readonly onValueChange?: (id: string, value: number) => void; readonly onApply?: () => void; readonly onCancel: () => void; readonly onRouteToOwner?: (id: string) => void;
}

function GripRow({ descriptor, disabled, resetKey, onValueChange, onApply, onCancel, onRouteToOwner }: GripRowProps) {
  const [draft, setDraft] = useState(() => displayValue(descriptor.value));
  const editing = useRef(false);
  const active = useRef<ActiveDrag | undefined>(undefined);
  const removeListeners = useRef<(() => void) | undefined>(undefined);
  const latest = useRef({ descriptor, onValueChange, onApply, onCancel, onRouteToOwner });
  latest.current = { descriptor, onValueChange, onApply, onCancel, onRouteToOwner };

  const stopDrag = useCallback(() => { active.current = undefined; removeListeners.current?.(); removeListeners.current = undefined; }, []);

  useEffect(() => { if (!editing.current) setDraft(displayValue(descriptor.value)); }, [descriptor.id, descriptor.value]);
  useEffect(() => { editing.current = false; setDraft(displayValue(descriptor.value)); }, [resetKey]);
  useEffect(() => () => stopDrag(), [stopDrag]);

  const emit = (value: number) => { if (!Number.isFinite(value)) return; setDraft(String(value)); latest.current.onValueChange?.(latest.current.descriptor.id, value); };

  const routeToOwner = () => { if (!disabled) latest.current.onRouteToOwner?.(descriptor.id); };

  const cancelInteraction = () => { stopDrag(); editing.current = false; setDraft(displayValue(latest.current.descriptor.value)); onCancel(); };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement | HTMLInputElement>
  ) => {
    if (event.key === "Escape") {
      event.preventDefault();
      cancelInteraction();
      return;
    }
    if (descriptor.readOnly) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        routeToOwner();
      }
      return;
    }
    if (
      descriptor.dragDisabled &&
      event.currentTarget.tagName.toLowerCase() === "button"
    ) {
      return;
    }
    if (disabled) return;
    if (event.key === "Enter") {
      event.preventDefault();
      onApply?.();
      return;
    }
    const direction =
      event.key === "ArrowLeft" || event.key === "ArrowDown"
        ? -1
        : event.key === "ArrowRight" || event.key === "ArrowUp"
          ? 1
          : undefined;
    if (direction === undefined) return;
    event.preventDefault();
    const base = Number(draft);
    const value = stepViewportFeatureGripValue(
      descriptor,
      direction,
      event.shiftKey,
      Number.isFinite(base) ? base : descriptor.value
    );
    if (value !== undefined) {
      editing.current = false;
      emit(value);
    }
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const text = event.currentTarget.value;
    editing.current = true;
    setDraft(text);
    const value = parseViewportFeatureGripValue(text, descriptor);
    if (value !== undefined) emit(value);
  };

  const handleInputBlur = () => {
    editing.current = false;
    if (parseViewportFeatureGripValue(draft, descriptor) === undefined) {
      setDraft(displayValue(descriptor.value));
    }
  };

  const startDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (disabled || descriptor.readOnly || descriptor.dragDisabled) return;
    event.preventDefault();
    event.currentTarget.focus();
    stopDrag();
    const start = Number(draft);
    active.current = {
      id: descriptor.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startValue: Number.isFinite(start) ? start : descriptor.value
    };

    const remove = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", cancel);
      active.current = undefined;
      removeListeners.current = undefined;
    };
    const move = (moveEvent: PointerEvent) => {
      const drag = active.current;
      if (!drag || drag.pointerId !== moveEvent.pointerId) return;
      const value = dragViewportFeatureGripValue(
        latest.current.descriptor,
        drag.startValue,
        moveEvent.clientX - drag.startX,
        moveEvent.shiftKey
      );
      if (value === undefined || value === drag.lastValue) return;
      drag.lastValue = value;
      editing.current = false;
      emit(value);
    };
    const finish = (finishEvent: PointerEvent) => {
      if (active.current?.pointerId === finishEvent.pointerId) remove();
    };
    const cancel = (cancelEvent: PointerEvent) => {
      if (active.current?.pointerId === cancelEvent.pointerId) remove();
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", cancel);
    removeListeners.current = remove;
  };

  const { readOnly, dragDisabled } = descriptor;
  const valueText = draft;
  const invalid = parseViewportFeatureGripValue(valueText, descriptor) === undefined;
  const readOnlyLabel = descriptor.routeToOwnerLabel
    ? `${descriptor.label}; ${descriptor.routeToOwnerLabel}`
    : `${descriptor.label}; read-only, edit in the owning editor`;
  const handleLabel = readOnly
    ? readOnlyLabel
    : dragDisabled
      ? `Type ${descriptor.label} in the value editor`
      : `Drag ${descriptor.label}`;

  return (
    <div
      aria-label={descriptor.label}
      className={`viewport-feature-grip${readOnly ? " viewport-feature-grip-readonly" : ""}`}
      data-grip-id={descriptor.id}
      role="group"
    >
      <button
        aria-label={handleLabel}
        aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Shift+ArrowLeft Shift+ArrowRight Enter Escape"
        aria-readonly={readOnly || undefined}
        className="viewport-feature-grip-handle"
        disabled={disabled || dragDisabled}
        onClick={readOnly ? routeToOwner : undefined}
        onKeyDown={handleKeyDown}
        onPointerDown={startDrag}
        type="button"
      >
        <span aria-hidden="true">↔</span>
      </button>
      <input
        aria-invalid={invalid || undefined}
        aria-label={`${descriptor.label} value`}
        aria-readonly={readOnly || undefined}
        className="viewport-feature-grip-value pb-numeric"
        disabled={disabled}
        inputMode="decimal"
        max={descriptor.max}
        min={descriptor.min}
        onChange={readOnly ? undefined : handleInputChange}
        onClick={readOnly ? routeToOwner : undefined}
        onBlur={handleInputBlur}
        onKeyDown={handleKeyDown}
        readOnly={readOnly}
        step={descriptor.normalStep}
        type="text"
        value={valueText}
      />
      <span aria-label={descriptor.unit} className="viewport-feature-grip-unit">
        {descriptor.unit}
      </span>
      {readOnly ? (
        <span className="pb-visually-hidden">{readOnlyLabel}</span>
      ) : null}
      {Number.isFinite(Number(valueText)) ? null : (
        <span className="pb-visually-hidden">Value unavailable</span>
      )}
    </div>
  );
}

export function ViewportFeatureGrips({
  grips,
  disabled = false,
  pending = false,
  ariaLabel = "Feature parameter grips",
  onValueChange,
  onChange,
  onApply,
  onCancel,
  onRouteToOwner
}: ViewportFeatureGripsProps) {
  const [resetKey, setResetKey] = useState(0);
  if (grips.length === 0) return null;

  const interactionDisabled = disabled || pending;
  const cancel = () => {
    setResetKey((value) => value + 1);
    onCancel?.();
  };

  return (
    <div
      aria-busy={pending || undefined}
      aria-describedby="viewport-feature-grips-instructions"
      aria-label={ariaLabel}
      className={`viewport-feature-grips${pending ? " viewport-feature-grips-pending" : ""}`}
      role="group"
    >
      <p className="pb-visually-hidden" id="viewport-feature-grips-instructions">
        Drag a handle horizontally to change its value. Use arrow keys for a
        normal step, or hold Shift for a larger step. Enter applies and Escape
        cancels.
      </p>
      {pending ? (
        <p className="viewport-feature-grips-status" role="status">
          Preview pending; current values remain available.
        </p>
      ) : null}
      {grips.map((descriptor) => (
        <GripRow
          key={descriptor.id}
          descriptor={descriptor}
          disabled={interactionDisabled}
          resetKey={resetKey}
          onValueChange={(id, value) =>
            (onValueChange ?? onChange)?.(id, value)
          }
          onApply={onApply}
          onCancel={cancel}
          onRouteToOwner={(id) => {
            if (!interactionDisabled) onRouteToOwner?.(id);
          }}
        />
      ))}
    </div>
  );
}

export default ViewportFeatureGrips;
