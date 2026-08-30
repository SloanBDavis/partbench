import { useRef, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import type { SketchDimensionAnnotation } from "../sketchDimensionAnnotations";

export function SketchDimensionAnnotationOverlay({
  annotations,
  selectedDimensionId,
  disabled = false,
  onSelect,
  onEdit,
  onMove
}: {
  readonly annotations: readonly SketchDimensionAnnotation[];
  readonly selectedDimensionId?: string;
  readonly disabled?: boolean;
  readonly onSelect: (dimensionId: string) => void;
  readonly onEdit: (dimensionId: string) => void;
  readonly onMove: (dimensionId: string, x: number, y: number) => void;
}) {
  const drag = useRef<
    | {
        readonly dimensionId: string;
        readonly pointerId: number;
        readonly startX: number;
        readonly startY: number;
        readonly originX: number;
        readonly originY: number;
      }
    | undefined
  >(undefined);

  return (
    <div className="sketch-dimension-annotation-overlay" aria-label="Sketch dimension annotations">
      {annotations.map((annotation) => (
        <button
          key={annotation.dimensionId}
          type="button"
          className={
            annotation.dimensionId === selectedDimensionId
              ? "sketch-dimension-annotation is-selected"
              : "sketch-dimension-annotation"
          }
          style={{ left: annotation.x, top: annotation.y }}
          disabled={disabled}
          aria-label={`${annotation.familyLabel} ${annotation.valueLabel}`}
          onClick={() => onSelect(annotation.dimensionId)}
          onDoubleClick={() => onEdit(annotation.dimensionId)}
          onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onEdit(annotation.dimensionId);
            }
          }}
          onPointerDown={(event: ReactPointerEvent<HTMLButtonElement>) => {
            event.stopPropagation();
            drag.current = {
              dimensionId: annotation.dimensionId,
              pointerId: event.pointerId,
              startX: event.clientX,
              startY: event.clientY,
              originX: annotation.x,
              originY: annotation.y
            };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event: ReactPointerEvent<HTMLButtonElement>) => {
            const active = drag.current;
            if (!active || active.pointerId !== event.pointerId) return;
            onMove(
              active.dimensionId,
              active.originX + event.clientX - active.startX,
              active.originY + event.clientY - active.startY
            );
          }}
          onPointerUp={() => {
            drag.current = undefined;
          }}
        >
          <span>{annotation.valueLabel}</span>
          <small>{annotation.boundToParameter ? "Parameter" : annotation.familyLabel}</small>
        </button>
      ))}
    </div>
  );
}
