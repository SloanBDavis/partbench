import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent
} from "react";
import "../styles/viewportFeatureGrips.css";

/**
 * The deliberately small, geometry-free contract between a feature editor and
 * its viewport grips.  Bounds belong to the editor because they are feature
 * and operation specific; the component only keeps interaction within them.
 */
export interface ViewportFeatureGripDescriptor {
  readonly id: string;
  readonly label: string;
  readonly value: number;
  readonly unit: string;
  readonly normalStep: number;
  readonly shiftStep: number;
  readonly min?: number;
  readonly max?: number;
  /** Prevents viewport dragging while keeping the adjacent value input live. */
  readonly dragDisabled?: boolean;
  /** Restricts typed values to whole numbers (used by pattern instance count). */
  readonly integerOnly?: boolean;
  readonly readOnly?: boolean;
  readonly routeToOwnerLabel?: string;
}

export interface ViewportFeatureGripsProps {
  readonly grips: readonly ViewportFeatureGripDescriptor[];
  readonly disabled?: boolean;
  readonly pending?: boolean;
  readonly ariaLabel?: string;
  /** `onChange` is retained as a concise alias for callers with form-style APIs. */
  readonly onValueChange?: (id: string, value: number) => void;
  readonly onChange?: (id: string, value: number) => void;
  readonly onApply?: () => void;
  readonly onCancel?: () => void;
  readonly onRouteToOwner?: (id: string) => void;
}

export const VIEWPORT_FEATURE_GRIP_PIXELS_PER_STEP = 8;

/** Returns a value only when it is finite and within the descriptor bounds. */
export function parseViewportFeatureGripValue(
  text: string,
  descriptor: ViewportFeatureGripDescriptor
): number | undefined {
  const trimmed = text.trim();
  if (trimmed === "") return undefined;
  const value = Number(trimmed);
  if (!isValidGripValue(descriptor, value)) {
    return undefined;
  }
  return value;
}

/**
 * Computes one bounded keyboard increment.  Keeping this pure makes the
 * keyboard and pointer paths share the same finite/bounded behavior.
 */
export function stepViewportFeatureGripValue(
  descriptor: ViewportFeatureGripDescriptor,
  direction: -1 | 1,
  shift = false,
  baseValue = descriptor.value
): number | undefined {
  if (!isValidGripValue(descriptor, baseValue)) {
    return undefined;
  }

  const increment = shift ? descriptor.shiftStep : descriptor.normalStep;
  if (!Number.isFinite(increment) || increment <= 0) {
    return undefined;
  }

  return clampViewportFeatureGripValue(
    descriptor,
    baseValue + direction * increment
  );
}

/** Computes the stepped value for a horizontal pointer drag. */
export function dragViewportFeatureGripValue(
  descriptor: ViewportFeatureGripDescriptor,
  startValue: number,
  horizontalPixels: number,
  shift = false
): number | undefined {
  if (!Number.isFinite(horizontalPixels) || !Number.isFinite(startValue)) {
    return undefined;
  }

  const increment = shift ? descriptor.shiftStep : descriptor.normalStep;
  if (!Number.isFinite(increment) || increment <= 0) {
    return undefined;
  }

  const steppedPixels = Math.trunc(
    horizontalPixels / VIEWPORT_FEATURE_GRIP_PIXELS_PER_STEP
  );
  if (steppedPixels === 0) {
    return undefined;
  }

  return clampViewportFeatureGripValue(
    descriptor,
    startValue + steppedPixels * increment
  );
}

function isValidBounds(descriptor: ViewportFeatureGripDescriptor): boolean {
  const { min, max } = descriptor;
  return (
    (min === undefined || Number.isFinite(min)) &&
    (max === undefined || Number.isFinite(max)) &&
    (min === undefined || max === undefined || min <= max)
  );
}

function clampViewportFeatureGripValue(
  descriptor: ViewportFeatureGripDescriptor,
  value: number
): number | undefined {
  if (!Number.isFinite(value) || !isValidBounds(descriptor)) {
    return undefined;
  }
  const bounded = Math.min(
    descriptor.max ?? Number.POSITIVE_INFINITY,
    Math.max(descriptor.min ?? Number.NEGATIVE_INFINITY, value)
  );
  return isValidGripValue(descriptor, bounded) ? bounded : undefined;
}

function isValidGripValue(
  descriptor: ViewportFeatureGripDescriptor,
  value: number
): boolean {
  return (
    Number.isFinite(value) &&
    isValidBounds(descriptor) &&
    (!descriptor.integerOnly || Number.isInteger(value)) &&
    (descriptor.min === undefined || value >= descriptor.min) &&
    (descriptor.max === undefined || value <= descriptor.max)
  );
}

function displayValue(value: number): string {
  return Number.isFinite(value) ? String(value) : "—";
}

interface ActiveDrag {
  readonly id: string;
  readonly pointerId: number;
  readonly startX: number;
  readonly startValue: number;
  lastValue?: number;
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
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(grips.map((grip) => [grip.id, displayValue(grip.value)]))
  );
  const editingIdsRef = useRef(new Set<string>());
  const activeDragRef = useRef<ActiveDrag | undefined>(undefined);
  const removeDragListenersRef = useRef<(() => void) | undefined>(undefined);
  const latestInputsRef = useRef({ grips, onValueChange, onChange });

  useEffect(() => {
    latestInputsRef.current = { grips, onValueChange, onChange };
  }, [grips, onChange, onValueChange]);

  useEffect(() => {
    setDrafts((current) => {
      const next: Record<string, string> = {};
      for (const grip of grips) {
        next[grip.id] = editingIdsRef.current.has(grip.id)
          ? (current[grip.id] ?? displayValue(grip.value))
          : displayValue(grip.value);
      }
      return next;
    });
  }, [grips]);

  const stopDrag = useCallback(() => {
    activeDragRef.current = undefined;
    const removeListeners = removeDragListenersRef.current;
    removeDragListenersRef.current = undefined;
    removeListeners?.();
  }, []);

  const emitValue = useCallback(
    (descriptor: ViewportFeatureGripDescriptor, value: number) => {
      if (!Number.isFinite(value)) return;
      setDrafts((current) => ({ ...current, [descriptor.id]: String(value) }));
      const inputs = latestInputsRef.current;
      (inputs.onValueChange ?? inputs.onChange)?.(descriptor.id, value);
    },
    []
  );

  const cancelInteraction = useCallback(() => {
    stopDrag();
    editingIdsRef.current.clear();
    setDrafts(
      Object.fromEntries(
        latestInputsRef.current.grips.map((grip) => [
          grip.id,
          displayValue(grip.value)
        ])
      )
    );
    onCancel?.();
  }, [onCancel, stopDrag]);

  useEffect(() => {
    return () => {
      // A pointer can be released outside the app or while React unmounts.
      // Always leave the window free of the drag listeners in either case.
      stopDrag();
    };
  }, [stopDrag]);

  const routeToOwner = useCallback(
    (descriptor: ViewportFeatureGripDescriptor) => {
      if (!disabled && !pending) {
        onRouteToOwner?.(descriptor.id);
      }
    },
    [disabled, onRouteToOwner, pending]
  );

  const handleKeyDown = useCallback(
    (
      event: KeyboardEvent<HTMLButtonElement | HTMLInputElement>,
      descriptor: ViewportFeatureGripDescriptor
    ) => {
      if (event.key === "Escape") {
        event.preventDefault();
        cancelInteraction();
        return;
      }

      if (descriptor.readOnly) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          routeToOwner(descriptor);
        }
        return;
      }

      // A typed-only descriptor deliberately leaves its input's keyboard path
      // available.  Only the viewport handle is prevented from changing it.
      if (
        descriptor.dragDisabled &&
        event.currentTarget.tagName.toLowerCase() === "button"
      ) {
        return;
      }

      if (disabled || pending) {
        return;
      }

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
      const base = Number(drafts[descriptor.id]);
      const value = stepViewportFeatureGripValue(
        descriptor,
        direction,
        event.shiftKey,
        Number.isFinite(base) ? base : descriptor.value
      );
      if (value !== undefined) {
        editingIdsRef.current.delete(descriptor.id);
        emitValue(descriptor, value);
      }
    },
    [
      cancelInteraction,
      disabled,
      drafts,
      emitValue,
      onApply,
      pending,
      routeToOwner
    ]
  );

  const handleInputChange = useCallback(
    (
      event: ChangeEvent<HTMLInputElement>,
      descriptor: ViewportFeatureGripDescriptor
    ) => {
      const text = event.currentTarget.value;
      editingIdsRef.current.add(descriptor.id);
      setDrafts((current) => ({ ...current, [descriptor.id]: text }));
      const value = parseViewportFeatureGripValue(text, descriptor);
      if (value !== undefined) {
        emitValue(descriptor, value);
      }
    },
    [emitValue]
  );

  const handleInputBlur = useCallback(
    (descriptor: ViewportFeatureGripDescriptor) => {
      editingIdsRef.current.delete(descriptor.id);
      if (
        parseViewportFeatureGripValue(
          drafts[descriptor.id] ?? "",
          descriptor
        ) === undefined
      ) {
        setDrafts((current) => ({
          ...current,
          [descriptor.id]: displayValue(descriptor.value)
        }));
      }
    },
    [drafts]
  );

  const startDrag = useCallback(
    (
      event: ReactPointerEvent<HTMLButtonElement>,
      descriptor: ViewportFeatureGripDescriptor
    ) => {
      if (disabled || pending || descriptor.readOnly || descriptor.dragDisabled)
        return;
      event.preventDefault();
      event.currentTarget.focus();
      stopDrag();

      const draftValue = Number(drafts[descriptor.id]);
      const startValue = Number.isFinite(draftValue)
        ? draftValue
        : descriptor.value;

      const activeDrag: ActiveDrag = {
        id: descriptor.id,
        pointerId: event.pointerId,
        startX: event.clientX,
        startValue
      };
      activeDragRef.current = activeDrag;

      const move = (moveEvent: PointerEvent) => {
        const current = activeDragRef.current;
        if (!current || current.pointerId !== moveEvent.pointerId) return;
        const grip = latestInputsRef.current.grips.find(
          (candidate) => candidate.id === current.id
        );
        if (!grip) return;
        const value = dragViewportFeatureGripValue(
          grip,
          current.startValue,
          moveEvent.clientX - current.startX,
          moveEvent.shiftKey
        );
        if (value === undefined || value === current.lastValue) return;
        current.lastValue = value;
        editingIdsRef.current.delete(grip.id);
        emitValue(grip, value);
      };
      const finish = (finishEvent: PointerEvent) => {
        if (activeDragRef.current?.pointerId !== finishEvent.pointerId) return;
        removeListeners();
      };
      const cancel = (cancelEvent: PointerEvent) => {
        if (activeDragRef.current?.pointerId !== cancelEvent.pointerId) return;
        removeListeners();
      };
      const removeListeners = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", finish);
        window.removeEventListener("pointercancel", cancel);
        activeDragRef.current = undefined;
        removeDragListenersRef.current = undefined;
      };

      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", finish);
      window.addEventListener("pointercancel", cancel);
      removeDragListenersRef.current = removeListeners;
    },
    [disabled, drafts, emitValue, pending, stopDrag]
  );

  if (grips.length === 0) return null;

  const interactionDisabled = disabled || pending;
  const instructionsId = "viewport-feature-grips-instructions";

  return (
    <div
      aria-busy={pending || undefined}
      aria-describedby={instructionsId}
      aria-label={ariaLabel}
      className={`viewport-feature-grips${pending ? " viewport-feature-grips-pending" : ""}`}
      role="group"
    >
      <p className="pb-visually-hidden" id={instructionsId}>
        Drag a handle horizontally to change its value. Use arrow keys for a
        normal step, or hold Shift for a larger step. Enter applies and Escape
        cancels.
      </p>
      {pending ? (
        <p className="viewport-feature-grips-status" role="status">
          Preview pending; current values remain available.
        </p>
      ) : null}
      {grips.map((descriptor) => {
        const valueText =
          drafts[descriptor.id] ?? displayValue(descriptor.value);
        const value = Number(valueText);
        const invalid =
          parseViewportFeatureGripValue(valueText, descriptor) === undefined;
        const readOnlyLabel = descriptor.routeToOwnerLabel
          ? `${descriptor.label}; ${descriptor.routeToOwnerLabel}`
          : `${descriptor.label}; read-only, edit in the owning editor`;

        return (
          <div
            aria-label={descriptor.label}
            className={`viewport-feature-grip${descriptor.readOnly ? " viewport-feature-grip-readonly" : ""}`}
            data-grip-id={descriptor.id}
            key={descriptor.id}
            role="group"
          >
            <button
              aria-label={
                descriptor.readOnly
                  ? readOnlyLabel
                  : descriptor.dragDisabled
                    ? `Type ${descriptor.label} in the value editor`
                    : `Drag ${descriptor.label}`
              }
              aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Shift+ArrowLeft Shift+ArrowRight Enter Escape"
              aria-readonly={descriptor.readOnly || undefined}
              className="viewport-feature-grip-handle"
              disabled={interactionDisabled || descriptor.dragDisabled}
              onClick={
                descriptor.readOnly ? () => routeToOwner(descriptor) : undefined
              }
              onKeyDown={(event) => handleKeyDown(event, descriptor)}
              onPointerDown={(event) => startDrag(event, descriptor)}
              type="button"
            >
              <span aria-hidden="true">↔</span>
            </button>
            <input
              aria-invalid={invalid || undefined}
              aria-label={`${descriptor.label} value`}
              aria-readonly={descriptor.readOnly || undefined}
              className="viewport-feature-grip-value pb-numeric"
              disabled={interactionDisabled}
              inputMode="decimal"
              max={descriptor.max}
              min={descriptor.min}
              onChange={(event) =>
                descriptor.readOnly
                  ? undefined
                  : handleInputChange(event, descriptor)
              }
              onClick={
                descriptor.readOnly ? () => routeToOwner(descriptor) : undefined
              }
              onBlur={() => handleInputBlur(descriptor)}
              onKeyDown={(event) => handleKeyDown(event, descriptor)}
              readOnly={descriptor.readOnly}
              step={descriptor.normalStep}
              type="text"
              value={valueText}
            />
            <span
              aria-label={descriptor.unit}
              className="viewport-feature-grip-unit"
            >
              {descriptor.unit}
            </span>
            {descriptor.readOnly ? (
              <span className="pb-visually-hidden">{readOnlyLabel}</span>
            ) : null}
            {!Number.isFinite(value) ? (
              <span className="pb-visually-hidden">Value unavailable</span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
