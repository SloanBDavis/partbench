import { useId, useRef, useState } from "react";
import type { DocumentUnits, Vec2 } from "@web-cad/cad-protocol";
import {
  parseDrawingCoordinate,
  WORLD_DRAWING_FRAME,
  type DrawingFrame
} from "./drawingCoordinates";

interface Props {
  units: DocumentUnits;
  base?: Vec2;
  frame?: DrawingFrame;
  label?: string;
  disabled?: boolean;
  onSubmit: (point: Vec2) => Promise<boolean> | boolean;
  onPreview?: (point: Vec2 | undefined) => void;
  onCancel?: () => void;
}

/** Key by active tool/frame/point stage when the parent starts a new input. */
export function CoordinateInput({
  units,
  base,
  frame = WORLD_DRAWING_FRAME,
  label = "Point coordinate",
  disabled = false,
  onSubmit,
  onPreview,
  onCancel
}: Props) {
  const id = useId();
  const [text, setText] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const result = parseDrawingCoordinate(text, { units, base, frame });
  const error =
    !result.ok && (text.trim() !== "" || attempted) ? result.error : undefined;

  return (
    <form
      className="drawing-point-input"
      aria-label="Precise coordinate input"
      onSubmit={async (event) => {
        event.preventDefault();
        setAttempted(true);
        if (!result.ok || disabled || busy.current) return;
        busy.current = true;
        setPending(true);
        try {
          if (await onSubmit(result.point)) {
            setText("");
            setAttempted(false);
            onPreview?.(undefined);
          }
        } finally {
          busy.current = false;
          setPending(false);
        }
      }}
    >
      <label htmlFor={id}>{label}</label>
      <div className="drawing-point-entry">
        <input
          id={id}
          data-drawing-coordinate
          type="text"
          autoComplete="off"
          spellCheck={false}
          placeholder={base ? "@25mm<45" : "10,20"}
          value={text}
          disabled={disabled}
          readOnly={pending}
          aria-invalid={Boolean(error)}
          aria-describedby={`${id}-help ${id}-frame${error ? ` ${id}-error` : ""}`}
          onChange={(event) => {
            const next = event.target.value;
            setText(next);
            setAttempted(false);
            const preview = parseDrawingCoordinate(next, {
              units,
              base,
              frame
            });
            onPreview?.(preview.ok ? preview.point : undefined);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              setText("");
              setAttempted(false);
              onPreview?.(undefined);
              onCancel?.();
            }
          }}
        />
        <button type="submit" disabled={disabled || pending}>
          Set point
        </button>
      </div>
      <p id={`${id}-frame`} className="drawing-muted">
        Frame origin ({frame.origin.join(", ")}) {units} · X angle{" "}
        {frame.angleDegrees}°
        {base
          ? ` · Relative base (${base.join(", ")}) ${units}`
          : " · Choose a first point for relative input"}
      </p>
      <p id={`${id}-help`} className="drawing-muted">
        X,Y · @dX,dY · distance&lt;degrees · @distance&lt;degrees
        <br />
        Units: mm, cm, m, in. Bare values use {units}. Enter sets the point. Esc
        cancels.
      </p>
      {result.ok && (
        <output className="drawing-point-result" aria-live="polite">
          Model X {result.point[0]} · Y {result.point[1]} {units}
        </output>
      )}
      {error && (
        <p id={`${id}-error`} role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
