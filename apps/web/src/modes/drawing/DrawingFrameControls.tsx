import { useId, useState } from "react";
import type { DocumentUnits } from "@web-cad/cad-protocol";
import {
  parseDrawingLength,
  WORLD_DRAWING_FRAME,
  type DrawingFrame
} from "./drawingCoordinates";

interface Props {
  frame: DrawingFrame;
  units: DocumentUnits;
  disabled?: boolean;
  onChange: (frame: DrawingFrame) => void;
}

function isWorld(frame: DrawingFrame): boolean {
  return (
    frame.origin[0] === 0 &&
    frame.origin[1] === 0 &&
    frame.angleDegrees % 360 === 0
  );
}

/** Reset unapplied fields when the controlled frame or document units change. */
export function DrawingFrameControls(props: Props) {
  return (
    <details className="drawing-frame-settings">
      <summary>
        Working frame · {isWorld(props.frame) ? "World XY" : "Custom"}
      </summary>
      <FrameEditor
        key={`${JSON.stringify(props.frame)}:${props.units}`}
        {...props}
      />
    </details>
  );
}

function FrameEditor({ frame, units, disabled = false, onChange }: Props) {
  const id = useId();
  const [choice, setChoice] = useState(isWorld(frame) ? "world" : "custom");
  const [fields, setFields] = useState({
    x: String(frame.origin[0]),
    y: String(frame.origin[1]),
    angle: String(frame.angleDegrees)
  });
  const x = parseDrawingLength(fields.x, units);
  const y = parseDrawingLength(fields.y, units);
  const angleMatch = fields.angle
    .trim()
    .match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*(?:deg|°)?$/i);
  const angle = angleMatch ? Number(angleMatch[1]) : NaN;
  const errors = {
    x: x.ok ? undefined : x.error,
    y: y.ok ? undefined : y.error,
    angle: Number.isFinite(angle)
      ? undefined
      : "Enter a finite angle in degrees."
  };
  const valid = choice === "world" || (x.ok && y.ok && Number.isFinite(angle));
  const labels = {
    x: "Frame origin X",
    y: "Frame origin Y",
    angle: "Frame angle"
  };

  return (
    <form
      className="drawing-frame-controls drawing-form"
      aria-label="Working frame controls"
      onSubmit={(event) => {
        event.preventDefault();
        if (!valid || disabled) return;
        if (choice === "world") onChange(WORLD_DRAWING_FRAME);
        else if (x.ok && y.ok) {
          onChange({ origin: [x.value, y.value], angleDegrees: angle });
        }
      }}
    >
      <h3>Working frame</h3>
      <p className="drawing-muted" data-drawing-active-frame>
        {isWorld(frame)
          ? "Active: World XY · X right, Y up."
          : `Active: Custom · model origin (${frame.origin.join(", ")}) ${units}, X angle ${frame.angleDegrees}°.`}{" "}
        Frame angle is counterclockwise from World X.
      </p>
      <label htmlFor={`${id}-choice`}>
        Drawing frame
        <select
          id={`${id}-choice`}
          aria-label="Drawing frame"
          data-drawing-frame
          value={choice}
          disabled={disabled}
          onChange={(event) => setChoice(event.target.value)}
        >
          <option value="world">World XY</option>
          <option value="custom">Custom</option>
        </select>
      </label>
      {choice === "custom" && (
        <>
          {(["x", "y", "angle"] as const).map((field) => (
            <div key={field}>
              <label htmlFor={`${id}-${field}`}>
                {labels[field]}
                <input
                  id={`${id}-${field}`}
                  aria-label={labels[field]}
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  value={fields[field]}
                  disabled={disabled}
                  aria-invalid={Boolean(errors[field])}
                  aria-describedby={
                    errors[field] ? `${id}-${field}-error` : `${id}-help`
                  }
                  onChange={(event) =>
                    setFields({ ...fields, [field]: event.target.value })
                  }
                />
              </label>
              {errors[field] && (
                <p id={`${id}-${field}-error`} role="alert">
                  {errors[field]}
                </p>
              )}
            </div>
          ))}
          <p id={`${id}-help`} className="drawing-muted">
            Origin is in model space. Use mm, cm, m, or in; bare values use{" "}
            {units}. Angle rotates the frame's X axis counterclockwise in
            degrees.
          </p>
        </>
      )}
      <button
        data-drawing-frame-apply
        type="submit"
        disabled={disabled || !valid}
      >
        Apply frame
      </button>
      <p className="drawing-muted">
        Apply starts a new point sequence. Existing geometry stays in model
        space.
      </p>
    </form>
  );
}
