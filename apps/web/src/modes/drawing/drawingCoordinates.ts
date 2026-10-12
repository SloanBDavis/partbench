import type { DocumentUnits, Vec2 } from "@web-cad/cad-protocol";

/** A drafting frame, expressed in document units and counterclockwise degrees. */
export interface DrawingFrame {
  readonly origin: Vec2;
  readonly angleDegrees: number;
}

export const WORLD_DRAWING_FRAME: DrawingFrame = {
  origin: [0, 0],
  angleDegrees: 0
};

export type LengthResult =
  | { readonly ok: true; readonly value: number }
  | { readonly ok: false; readonly error: string };

export type CoordinateResult =
  | { readonly ok: true; readonly point: Vec2 }
  | { readonly ok: false; readonly error: string };

const millimeters: Record<DocumentUnits, number> = {
  mm: 1,
  cm: 10,
  m: 1000,
  in: 25.4
};
const numberPattern = "[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:e[+-]?\\d+)?";
const lengthPattern = new RegExp(
  `^(${numberPattern})\\s*(mm|cm|m|in|")?$`,
  "i"
);
const anglePattern = new RegExp(`^(${numberPattern})\\s*(?:deg|°)?$`, "i");

/** Parse one whole scalar; partial numbers, expressions and nonfinite values fail. */
export function parseDrawingLength(
  input: string,
  units: DocumentUnits
): LengthResult {
  const match = input.trim().match(lengthPattern);
  if (!match) {
    return {
      ok: false,
      error: "Enter a number, optionally followed by mm, cm, m, or in."
    };
  }
  const suffix = match[2]?.toLowerCase();
  const sourceUnits =
    suffix === '"' ? "in" : (suffix as DocumentUnits | undefined);
  const value =
    Number(match[1]) * (millimeters[sourceUnits ?? units] / millimeters[units]);
  return Number.isFinite(value)
    ? { ok: true, value: Object.is(value, -0) ? 0 : value }
    : { ok: false, error: "The value is too large. Enter a finite number." };
}

function rotation(degrees: number): Vec2 {
  // Exact cardinal axes avoid tiny off-axis coordinates for typed 90° turns.
  const angle = degrees % 360;
  if (angle === 0) return [1, 0];
  if (angle === 90 || angle === -270) return [0, 1];
  if (angle === 180 || angle === -180) return [-1, 0];
  if (angle === 270 || angle === -90) return [0, -1];
  const radians = (angle * Math.PI) / 180;
  return [Math.cos(radians), Math.sin(radians)];
}

/**
 * x,y and distance<angle are absolute in the working frame. An @ prefix makes
 * either form a displacement from base, along the working frame's axes.
 * Bare lengths use document units; each component may specify its own units.
 * The returned point is always in model space, ready for ordinary drawing ops.
 */
export function parseDrawingCoordinate(
  input: string,
  {
    units,
    base,
    frame = WORLD_DRAWING_FRAME
  }: { units: DocumentUnits; base?: Vec2; frame?: DrawingFrame }
): CoordinateResult {
  const text = input.trim();
  if (!text) return { ok: false, error: "Enter a point, such as 10,20." };
  if (
    !frame.origin.every(Number.isFinite) ||
    !Number.isFinite(frame.angleDegrees)
  ) {
    return {
      ok: false,
      error: "The working frame needs a finite origin and angle."
    };
  }
  const relative = text.startsWith("@");
  if (relative && (!base || !base.every(Number.isFinite))) {
    return {
      ok: false,
      error: "Choose the first point before entering a relative coordinate."
    };
  }
  const expression = relative ? text.slice(1).trim() : text;
  let local: Vec2;
  if (expression.includes("<")) {
    const components = expression.split("<");
    if (components.length !== 2) {
      return { ok: false, error: "Use distance<angle, for example @25mm<45." };
    }
    const distance = parseDrawingLength(components[0]!, units);
    if (!distance.ok)
      return { ok: false, error: `Distance: ${distance.error}` };
    if (distance.value < 0) {
      return {
        ok: false,
        error:
          "Use a nonnegative polar distance; change the angle to reverse direction."
      };
    }
    const match = components[1]!.trim().match(anglePattern);
    if (!match || !Number.isFinite(Number(match[1]))) {
      return {
        ok: false,
        error: "Enter a finite angle in degrees, for example @25mm<45."
      };
    }
    const [cos, sin] = rotation(Number(match[1]));
    local = [distance.value * cos, distance.value * sin];
  } else {
    const components = expression.split(",");
    if (components.length !== 2) {
      return {
        ok: false,
        error: "Separate X and Y with a comma, or use distance<angle."
      };
    }
    const x = parseDrawingLength(components[0]!, units);
    if (!x.ok) return { ok: false, error: `X: ${x.error}` };
    const y = parseDrawingLength(components[1]!, units);
    if (!y.ok) return { ok: false, error: `Y: ${y.error}` };
    local = [x.value, y.value];
  }
  const origin = relative ? base! : frame.origin;
  const [cos, sin] = rotation(frame.angleDegrees);
  const point: Vec2 = [
    origin[0] + local[0] * cos - local[1] * sin,
    origin[1] + local[0] * sin + local[1] * cos
  ];
  return point.every(Number.isFinite)
    ? { ok: true, point: [point[0] || 0, point[1] || 0] }
    : {
        ok: false,
        error: "The resulting coordinate is too large. Use smaller values."
      };
}
