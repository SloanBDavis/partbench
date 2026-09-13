export interface SketchGeometryPolicy {
  readonly linearTolerance: number;
  readonly angularToleranceDegrees: number;
  readonly minimumProfileArea: number;
}

export const SKETCH_GEOMETRY_POLICY = Object.freeze({
  linearTolerance: 1e-7,
  angularToleranceDegrees: 0.1,
  minimumProfileArea: 1e-12
}) satisfies SketchGeometryPolicy;

/** Fixed-point residuals use the solver's componentwise linear tolerance. */
export function sketchCoordinatesWithinTolerance(
  left: readonly [number, number],
  right: readonly [number, number]
): boolean {
  return left.every(
    (value, index) =>
      Math.abs(value - right[index]!) <= SKETCH_GEOMETRY_POLICY.linearTolerance
  );
}
