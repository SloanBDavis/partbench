/** Shared V17 sketch geometry thresholds owned by the command engine. */
export interface SketchGeometryPolicy {
  readonly linearTolerance: 1e-7;
  readonly angularToleranceDegrees: 0.1;
  readonly minimumProfileArea: 1e-12;
}

export const SKETCH_GEOMETRY_POLICY = Object.freeze({
  linearTolerance: 1e-7,
  angularToleranceDegrees: 0.1,
  minimumProfileArea: 1e-12
}) satisfies SketchGeometryPolicy;
