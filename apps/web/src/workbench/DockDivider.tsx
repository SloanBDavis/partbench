import {
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent,
  type PointerEvent
} from "react";

export interface DockDividerProps {
  readonly side: "left" | "right";
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly onResize: (width: number) => void;
  readonly label?: string;
}

export function getKeyboardDockResizeValue(
  value: number,
  key: string,
  shiftKey: boolean,
  min: number,
  max: number
): number | undefined {
  const step = shiftKey ? 32 : 8;
  const next =
    key === "ArrowLeft"
      ? value - step
      : key === "ArrowRight"
        ? value + step
        : key === "Home"
          ? min
          : key === "End"
            ? max
            : undefined;
  return next === undefined ? undefined : Math.min(max, Math.max(min, next));
}

/** Pointer and keyboard resizer for one inline dock. */
export function DockDivider({
  side,
  value,
  min,
  max,
  onResize,
  label = `${side === "left" ? "Document" : "Inspector"} dock width`
}: DockDividerProps) {
  const dragCleanupRef = useRef<(() => void) | undefined>(undefined);

  const stopDragging = useCallback(() => {
    dragCleanupRef.current?.();
    dragCleanupRef.current = undefined;
  }, []);

  useEffect(() => stopDragging, [stopDragging]);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || typeof window === "undefined") return;
    event.preventDefault();
    stopDragging();
    const startX = event.clientX;
    const startWidth = value;
    const shell = event.currentTarget.closest<HTMLElement>(
      ".pb-workbench-shell"
    );
    const property = `--pb-current-${side}-dock-width`;
    let pendingWidth = startWidth;
    let frame: number | undefined;

    const applyPreview = () => {
      frame = undefined;
      shell?.style.setProperty(property, `${pendingWidth}px`);
    };

    const schedulePreview = () => {
      if (frame !== undefined) return;
      frame = window.requestAnimationFrame(applyPreview);
    };

    const handlePointerMove = (moveEvent: globalThis.PointerEvent) => {
      const direction = side === "left" ? 1 : -1;
      const next = startWidth + (moveEvent.clientX - startX) * direction;
      pendingWidth = Math.min(max, Math.max(min, Math.round(next)));
      schedulePreview();
    };
    const finishDragging = (commit: boolean) => {
      if (frame !== undefined) {
        window.cancelAnimationFrame(frame);
        frame = undefined;
      }
      if (commit) {
        applyPreview();
      } else {
        shell?.style.setProperty(property, `${startWidth}px`);
      }
      stopDragging();
      if (commit && pendingWidth !== startWidth) onResize(pendingWidth);
    };
    const handlePointerUp = () => finishDragging(true);
    const handlePointerCancel = () => finishDragging(false);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
    window.addEventListener("pointercancel", handlePointerCancel, {
      once: true
    });
    dragCleanupRef.current = () => {
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
    };
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const physicalValue = side === "right" ? max + min - value : value;
    const nextPhysical = getKeyboardDockResizeValue(
      physicalValue,
      event.key,
      event.shiftKey,
      min,
      max
    );
    if (nextPhysical === undefined) return;
    event.preventDefault();
    onResize(side === "right" ? max + min - nextPhysical : nextPhysical);
  };

  return (
    <div
      className={`pb-dock-divider pb-dock-divider--${side}`}
      role="separator"
      aria-label={label}
      aria-orientation="vertical"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
    >
      <span aria-hidden="true" />
    </div>
  );
}
