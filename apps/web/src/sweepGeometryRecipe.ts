import type { CadExactExportResolvedWireSegment } from "@web-cad/cad-protocol";

import type { DerivedGeometrySweepPathSegment } from "./derivedGeometryRuntime";
import {
  createSketchDisplayFrameNormal,
  mapSketchPointToDisplayFrame,
  type SketchDisplayFrame
} from "./sketchDisplayFrames";

/**
 * Resolves an already traversal-oriented planar path segment into the one
 * world-space recipe shared by display, metadata, checkpoints, and STEP.
 */
export function mapResolvedSweepPathSegmentToWorld(
  segment: CadExactExportResolvedWireSegment,
  frame: SketchDisplayFrame
): DerivedGeometrySweepPathSegment {
  if (segment.kind === "line") {
    return {
      kind: "line",
      start: mapSketchPointToDisplayFrame(frame, segment.start),
      end: mapSketchPointToDisplayFrame(frame, segment.end)
    };
  }

  const start = pointOnSketchArc(
    segment.center,
    segment.radius,
    segment.startAngleDegrees
  );
  const end = pointOnSketchArc(
    segment.center,
    segment.radius,
    segment.startAngleDegrees + segment.sweepAngleDegrees
  );

  return {
    kind: "arc",
    start: mapSketchPointToDisplayFrame(frame, start),
    end: mapSketchPointToDisplayFrame(frame, end),
    center: mapSketchPointToDisplayFrame(frame, segment.center),
    normal: createSketchDisplayFrameNormal(frame),
    sweepAngleDegrees: segment.sweepAngleDegrees
  };
}

function pointOnSketchArc(
  center: readonly [number, number],
  radius: number,
  angleDegrees: number
): readonly [number, number] {
  const angleRadians = (angleDegrees * Math.PI) / 180;
  const cosine = canonicalUnitCircleValue(Math.cos(angleRadians));
  const sine = canonicalUnitCircleValue(Math.sin(angleRadians));
  return [
    center[0] + radius * cosine,
    center[1] + radius * sine
  ];
}

function canonicalUnitCircleValue(value: number): number {
  if (Math.abs(value) <= Number.EPSILON * 4) return 0;
  if (Math.abs(value - 1) <= Number.EPSILON * 4) return 1;
  if (Math.abs(value + 1) <= Number.EPSILON * 4) return -1;
  return value;
}
