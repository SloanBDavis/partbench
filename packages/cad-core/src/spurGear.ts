import {
  CAD_V19_RESOURCE_LIMITS,
  isSpurGearInputs,
  type SpurGearInputs,
  type SpurGearValues,
  type SketchEntitySnapshot,
  type SketchRegionsProfileRef,
  type Vec2
} from "@web-cad/cad-protocol";
import { SKETCH_GEOMETRY_POLICY } from "./sketchGeometryPolicy";

export class SpurGearInputError extends Error {
  constructor(
    readonly field: string,
    message: string
  ) {
    super(message);
  }
}
const fail = (field: string, message: string): never => {
  throw new SpurGearInputError(field, message);
};
const LINEAR_TOLERANCE = SKETCH_GEOMETRY_POLICY.linearTolerance;
const ERROR_SAMPLES = 2048;
const MAX_FLANK_PIECES = 128;
const TWO_PI = 2 * Math.PI;
const clean = (value: number): number =>
  Math.abs(value) < 1e-11 ? 0 : Number(value.toPrecision(16));
const polar = (radius: number, angle: number): Vec2 => [
  radius * Math.cos(angle),
  radius * Math.sin(angle)
];
const normalize = (angle: number): number =>
  ((angle % TWO_PI) + TWO_PI) % TWO_PI;
const separation = (a: Vec2, b: Vec2): number =>
  Math.hypot(a[0] - b[0], a[1] - b[1]);

export function resolveSpurGearValues(
  inputs: SpurGearInputs,
  parameters: ReadonlyMap<string, { readonly value: number }>
): SpurGearValues {
  if (!isSpurGearInputs(inputs))
    fail(
      "inputs",
      "Expected teeth, module and faceWidth as finite literals or parameter bindings."
    );
  const value = (field: keyof SpurGearInputs, fallback?: number): number => {
    const input = inputs[field] ?? fallback;
    if (typeof input === "number") return input;
    if (!input) return fail(field, `Missing gear input: ${field}.`);
    const parameter = parameters.get(input.parameterId);
    if (!parameter)
      return fail(
        field,
        `Gear parameter does not exist: ${input.parameterId}.`
      );
    return parameter.value;
  };
  const module = value("module");
  const v: SpurGearValues = {
    teeth: value("teeth"),
    module,
    faceWidth: value("faceWidth"),
    pressureAngleDegrees: value("pressureAngleDegrees", 20),
    boreDiameter: value("boreDiameter", 0),
    backlash: value("backlash", 0),
    profileTolerance: value(
      "profileTolerance",
      Math.max(8 * LINEAR_TOLERANCE, module / 400)
    )
  };
  for (const [field, amount] of Object.entries(v))
    if (!Number.isFinite(amount))
      fail(field, "Gear dimensions must be finite.");
  if (!Number.isInteger(v.teeth) || v.teeth < 17 || v.teeth > 128)
    fail("teeth", "Spur gears require an integer tooth count from 17 to 128.");
  if (v.module <= 1e-5 || v.module * (v.teeth / 2 + 1) > 1e6)
    fail(
      "module",
      "Gear module must be positive with outer radius at most 1000000 document units."
    );
  if (v.faceWidth <= 1e-5 || v.faceWidth > 1e6)
    fail(
      "faceWidth",
      "Gear face width must be between 0.00001 and 1000000 document units."
    );
  if (v.pressureAngleDegrees < 15 || v.pressureAngleDegrees > 30)
    fail(
      "pressureAngleDegrees",
      "Pressure angle must be between 15 and 30 degrees."
    );
  if (
    v.boreDiameter < 0 ||
    v.boreDiameter >= v.module * (v.teeth - 2.5) - LINEAR_TOLERANCE * 8
  )
    fail(
      "boreDiameter",
      "Gear bore must be nonnegative and strictly inside the root circle."
    );
  if (v.backlash < 0 || v.backlash >= (Math.PI * v.module) / 2)
    fail(
      "backlash",
      "Per-gear tooth thinning must be nonnegative and less than half the circular pitch."
    );
  if (
    v.profileTolerance < 8 * LINEAR_TOLERANCE ||
    v.profileTolerance > v.module / 50
  )
    fail(
      "profileTolerance",
      "Gear profile tolerance must be at least 0.0000008 document units and at most module/50; increase module if these bounds cannot be met."
    );
  return v;
}

type FlankPiece =
  | { readonly kind: "line"; readonly start: Vec2; readonly end: Vec2 }
  | {
      readonly kind: "arc";
      readonly center: Vec2;
      readonly radius: number;
      readonly start: number;
      readonly sweep: number;
    };

function fitArc(
  start: Vec2,
  middle: Vec2,
  end: Vec2
): Extract<FlankPiece, { kind: "arc" }> | undefined {
  const ax = middle[0] - start[0],
    ay = middle[1] - start[1],
    bx = end[0] - start[0],
    by = end[1] - start[1];
  const determinant = 2 * (ax * by - ay * bx);
  if (
    Math.abs(determinant) <=
    Number.EPSILON * Math.hypot(ax, ay) * Math.hypot(bx, by) * 32
  )
    return undefined;
  const a2 = ax * ax + ay * ay,
    b2 = bx * bx + by * by;
  const center: Vec2 = [
    start[0] + (a2 * by - b2 * ay) / determinant,
    start[1] + (ax * b2 - bx * a2) / determinant
  ];
  const radius = separation(start, center);
  const first = Math.atan2(start[1] - center[1], start[0] - center[0]);
  const mid = Math.atan2(middle[1] - center[1], middle[0] - center[0]);
  const last = Math.atan2(end[1] - center[1], end[0] - center[0]);
  const sweep =
    normalize(mid - first) <= normalize(last - first)
      ? normalize(last - first)
      : -normalize(first - last);
  if (
    ![...center, radius, first, sweep].every(Number.isFinite) ||
    radius <= LINEAR_TOLERANCE
  )
    return undefined;
  return { kind: "arc", center, radius, start: first, sweep };
}

function pointOnArc(
  arc: Extract<FlankPiece, { kind: "arc" }>,
  fraction: number
): Vec2 {
  const local = polar(arc.radius, arc.start + fraction * arc.sweep);
  return [arc.center[0] + local[0], arc.center[1] + local[1]];
}

function pointArcDistance(
  point: Vec2,
  arc: Extract<FlankPiece, { kind: "arc" }>
): number {
  const angle = Math.atan2(point[1] - arc.center[1], point[0] - arc.center[0]);
  const within =
    arc.sweep >= 0
      ? normalize(angle - arc.start) <= arc.sweep
      : normalize(arc.start - angle) <= -arc.sweep;
  return within
    ? Math.abs(separation(point, arc.center) - arc.radius)
    : Math.min(
        separation(point, pointOnArc(arc, 0)),
        separation(point, pointOnArc(arc, 1))
      );
}

/** A bound on both directed distances, not merely a sampled error estimate. */
function approximationBound(
  arc: Extract<FlankPiece, { kind: "arc" }>,
  curve: (t: number) => Vec2,
  baseRadius: number,
  lo: number,
  hi: number
): number {
  let forward = 0,
    reverse = 0;
  for (let index = 0; index <= ERROR_SAMPLES; index++) {
    const fraction = index / ERROR_SAMPLES;
    forward = Math.max(
      forward,
      pointArcDistance(curve(lo + (hi - lo) * fraction), arc)
    );
    const point = pointOnArc(arc, fraction);
    // This need not be the nearest involute point: distance to any point on the
    // finite ideal flank is an upper bound on its nearest-point distance.
    const radialT = Math.sqrt(
      Math.max(0, (Math.hypot(...point) / baseRadius) ** 2 - 1)
    );
    reverse = Math.max(
      reverse,
      separation(point, curve(Math.max(lo, Math.min(hi, radialT))))
    );
  }
  // Distance to a fixed set is 1-Lipschitz. Between uniform samples the
  // involute travels at most rb*t*dt/2, the circular arc R*dAngle/2.
  return Math.max(
    forward + (baseRadius * hi * (hi - lo)) / (2 * ERROR_SAMPLES),
    reverse + (arc.radius * Math.abs(arc.sweep)) / (2 * ERROR_SAMPLES)
  );
}

function approximateFlank(
  baseRadius: number,
  baseHalf: number,
  lo: number,
  hi: number,
  tolerance: number,
  maximum: number
): readonly FlankPiece[] {
  const curve = (t: number): Vec2 =>
    polar(baseRadius * Math.sqrt(1 + t * t), -baseHalf + t - Math.atan(t));
  const pieces: FlankPiece[] = [];
  const pending: { lo: number; hi: number }[] = [{ lo, hi }];
  while (pending.length > 0) {
    const interval = pending.pop()!;
    const start = curve(interval.lo),
      end = curve(interval.hi);
    const arc = fitArc(start, curve((interval.lo + interval.hi) / 2), end);
    const arcAngle = arc ? (Math.abs(arc.sweep) * 180) / Math.PI : 0;
    const safeTolerance = tolerance - 2 * LINEAR_TOLERANCE;
    if (
      arc &&
      arcAngle >= SKETCH_GEOMETRY_POLICY.angularToleranceDegrees &&
      arcAngle <= 360 - SKETCH_GEOMETRY_POLICY.angularToleranceDegrees &&
      approximationBound(arc, curve, baseRadius, interval.lo, interval.hi) <=
        safeTolerance
    ) {
      pieces.push(arc);
    } else {
      // Linear interpolation has symmetric error <= max|p''|*dt²/8. This also
      // handles intervals too small for the existing canonical arc policy.
      const lineBound =
        (baseRadius *
          Math.sqrt(1 + interval.hi ** 2) *
          (interval.hi - interval.lo) ** 2) /
        8;
      if (lineBound <= safeTolerance) pieces.push({ kind: "line", start, end });
      else {
        if (pieces.length + pending.length + 2 > maximum)
          fail(
            "profileTolerance",
            "Requested gear profile tolerance exceeds the bounded 4096-entity/subdivision budget; increase profileTolerance or reduce tooth count."
          );
        const middle = (interval.lo + interval.hi) / 2;
        pending.push(
          { lo: middle, hi: interval.hi },
          { lo: interval.lo, hi: middle }
        );
      }
    }
  }
  return pieces;
}

/** Bounded involute approximation using ordinary canonical line/arc source. */
export function createSpurGearGeometry(
  sketchId: string,
  v: SpurGearValues
): {
  entities: readonly SketchEntitySnapshot[];
  profile: SketchRegionsProfileRef;
} {
  const pitch = (v.module * v.teeth) / 2,
    tip = pitch + v.module,
    root = pitch - 1.25 * v.module;
  const alpha = (v.pressureAngleDegrees * Math.PI) / 180,
    base = pitch * Math.cos(alpha);
  const half = Math.PI / (2 * v.teeth) - v.backlash / (2 * pitch),
    baseHalf = half + Math.tan(alpha) - alpha;
  const lo = Math.sqrt((Math.max(base, root) / base) ** 2 - 1),
    hi = Math.sqrt((tip / base) ** 2 - 1);
  const rootHalf = baseHalf - lo + Math.atan(lo),
    tipHalf = baseHalf - hi + Math.atan(hi);
  if (rootHalf <= 0 || rootHalf >= Math.PI / v.teeth || tipHalf <= 0)
    fail(
      "backlash",
      "These tooth dimensions produce an overlapping root or missing tip; reduce backlash or choose a different tooth count/pressure angle."
    );
  const radial = base - root > LINEAR_TOLERANCE;
  const allowance =
    CAD_V19_RESOURCE_LIMITS.maxSketchEntitiesPerEditedSketch -
    (v.boreDiameter > 0 ? 1 : 0);
  const maxPieces = Math.min(
    MAX_FLANK_PIECES,
    Math.floor((Math.floor(allowance / v.teeth) - 2 - (radial ? 2 : 0)) / 2)
  );
  const pieces = approximateFlank(
    base,
    baseHalf,
    lo,
    hi,
    v.profileTolerance,
    maxPieces
  );
  const entities: SketchEntitySnapshot[] = [];
  const transform = (p: Vec2, angle: number, mirror = false): Vec2 => {
    const y = mirror ? -p[1] : p[1];
    return [
      clean(p[0] * Math.cos(angle) - y * Math.sin(angle)),
      clean(p[0] * Math.sin(angle) + y * Math.cos(angle))
    ];
  };
  const addLine = (start: Vec2, end: Vec2) =>
    entities.push({
      id: `${sketchId}:edge:${entities.length}`,
      kind: "line",
      construction: false,
      start,
      end
    });
  const addArc = (
    center: Vec2,
    radius: number,
    start: number,
    sweep: number
  ) => {
    if (
      (Math.abs(sweep) * 180) / Math.PI <
      SKETCH_GEOMETRY_POLICY.angularToleranceDegrees
    ) {
      if (
        radius * (1 - Math.cos(sweep / 2)) >
        v.profileTolerance - 2 * LINEAR_TOLERANCE
      )
        fail(
          "profileTolerance",
          "A gear boundary arc is below the canonical angular limit and cannot meet profileTolerance as a chord."
        );
      const p = polar(radius, start),
        q = polar(radius, start + sweep);
      addLine(
        [clean(center[0] + p[0]), clean(center[1] + p[1])],
        [clean(center[0] + q[0]), clean(center[1] + q[1])]
      );
    } else
      entities.push({
        id: `${sketchId}:edge:${entities.length}`,
        kind: "arc",
        construction: false,
        center: [clean(center[0]), clean(center[1])],
        radius: clean(radius),
        startAngleDegrees: clean((normalize(start) * 180) / Math.PI),
        sweepAngleDegrees: clean((sweep * 180) / Math.PI)
      });
  };
  const addPiece = (piece: FlankPiece, angle: number, mirror: boolean) => {
    if (piece.kind === "line")
      addLine(
        transform(mirror ? piece.end : piece.start, angle, mirror),
        transform(mirror ? piece.start : piece.end, angle, mirror)
      );
    else
      addArc(
        transform(piece.center, angle, mirror),
        piece.radius,
        angle + (mirror ? -piece.start - piece.sweep : piece.start),
        piece.sweep
      );
  };
  for (let tooth = 0; tooth < v.teeth; tooth++) {
    const angle = (TWO_PI * tooth) / v.teeth;
    if (radial)
      addLine(
        transform(polar(root, -rootHalf), angle),
        transform(polar(base, -baseHalf), angle)
      );
    for (const piece of pieces) addPiece(piece, angle, false);
    addArc([0, 0], tip, angle - tipHalf, 2 * tipHalf);
    for (const piece of [...pieces].reverse()) addPiece(piece, angle, true);
    if (radial)
      addLine(
        transform(polar(base, baseHalf), angle),
        transform(polar(root, rootHalf), angle)
      );
    addArc([0, 0], root, angle + rootHalf, TWO_PI / v.teeth - 2 * rootHalf);
  }
  if (entities.length > allowance)
    fail(
      "profileTolerance",
      "Gear sampling exceeds 4096 sketch entities; increase profileTolerance."
    );
  const segments = entities.map((entity) => ({
    entityId: entity.id,
    orientation: "forward" as const
  }));
  if (v.boreDiameter > 0)
    entities.push({
      id: `${sketchId}:bore`,
      kind: "circle",
      construction: false,
      center: [0, 0],
      radius: v.boreDiameter / 2
    });
  return {
    entities,
    profile: {
      kind: "regions",
      sketchId,
      regions: [
        {
          outer: { kind: "wire", segments },
          holes:
            v.boreDiameter > 0
              ? [{ kind: "entity", entityId: `${sketchId}:bore` }]
              : []
        }
      ]
    }
  };
}
