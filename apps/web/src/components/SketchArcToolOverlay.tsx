import type { Vec2 } from "@web-cad/cad-protocol";
import {
  projectPoint,
  type RenderCamera,
  type ViewportSize
} from "@web-cad/renderer";
import type { SketchDisplayFrame } from "../sketchDisplayFrames";
import { mapSketchPointToDisplayFrame } from "../sketchDisplayFrames";
import {
  getThreePointArcPreview,
  getThreePointArcToolStage,
  type ThreePointArcToolSession
} from "../v17ProductIntegration";

export function SketchArcToolOverlay({
  camera,
  displayFrame,
  session,
  size
}: {
  readonly camera: RenderCamera;
  readonly displayFrame: SketchDisplayFrame;
  readonly session: ThreePointArcToolSession;
  readonly size: ViewportSize;
}) {
  const preview = getThreePointArcPreview(session);
  const previewPoints =
    preview?.ok === true
      ? sampleArc(preview.value).map((point) =>
          toScreenPoint(point, displayFrame, camera, size)
        )
      : [];
  const controlPoints = [
    ...session.points,
    ...(session.hoverPoint ? [session.hoverPoint] : [])
  ].map((point) => toScreenPoint(point, displayFrame, camera, size));

  return (
    <div className="sketch-arc-tool-layer" aria-label="Three-point arc tool">
      <div className="sketch-arc-tool-prompt">
        <strong>Three-point arc</strong>
        <span>
          Click {formatStage(getThreePointArcToolStage(session))}. Escape cancels.
        </span>
        {preview?.ok === false && (
          <small>{preview.issues[0]?.message ?? "Arc preview is invalid."}</small>
        )}
      </div>
      <svg
        className="sketch-arc-tool-overlay"
        width={size.width}
        height={size.height}
        viewBox={`0 0 ${size.width} ${size.height}`}
      >
        {previewPoints.length > 1 && (
          <polyline
            className="sketch-arc-tool-preview"
            points={previewPoints
              .filter((point): point is NonNullable<typeof point> => Boolean(point))
              .map((point) => `${point.x},${point.y}`)
              .join(" ")}
          />
        )}
        {controlPoints.map((point, index) =>
          point ? (
            <circle
              key={`${index}:${point.x}:${point.y}`}
              className={
                index < session.points.length
                  ? "sketch-arc-tool-point"
                  : "sketch-arc-tool-point sketch-arc-tool-point-hover"
              }
              cx={point.x}
              cy={point.y}
              r={5}
            />
          ) : null
        )}
      </svg>
    </div>
  );
}

function sampleArc(arc: {
  readonly center: Vec2;
  readonly radius: number;
  readonly startAngleDegrees: number;
  readonly sweepAngleDegrees: number;
}): readonly Vec2[] {
  const count = Math.max(12, Math.ceil(Math.abs(arc.sweepAngleDegrees) / 8));
  return Array.from({ length: count + 1 }, (_, index) => {
    const angle =
      ((arc.startAngleDegrees + arc.sweepAngleDegrees * (index / count)) *
        Math.PI) /
      180;
    return [
      arc.center[0] + arc.radius * Math.cos(angle),
      arc.center[1] + arc.radius * Math.sin(angle)
    ] as Vec2;
  });
}

function toScreenPoint(
  point: Vec2,
  displayFrame: SketchDisplayFrame,
  camera: RenderCamera,
  size: ViewportSize
) {
  return projectPoint(
    mapSketchPointToDisplayFrame(displayFrame, point),
    camera,
    size
  );
}

function formatStage(stage: ReturnType<typeof getThreePointArcToolStage>) {
  return stage === "start"
    ? "the start point"
    : stage === "pointOnArc"
      ? "a point on the arc"
      : "the end point";
}
