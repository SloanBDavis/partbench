/** Shared V17 sketch geometry thresholds owned by the command engine. */
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
