import {
  projectPointToFiniteSketchCurve,
  resolveSketchCurveEditEntity
} from "@web-cad/cad-core";
import type { SketchEntitySnapshot, Vec2 } from "@web-cad/cad-protocol";

export function projectSketchCurveEditViewportPoint(
  entity: SketchEntitySnapshot,
  point: Vec2
): Vec2 {
  if (
    entity.kind !== "line" &&
    entity.kind !== "arc" &&
    entity.kind !== "circle"
  ) {
    return point;
  }
  const resolution = resolveSketchCurveEditEntity(entity);
  if (resolution.status === "blocked") return point;
  const projection = projectPointToFiniteSketchCurve(resolution.curve, point);
  return projection.status === "ready" ? projection.projection.point : point;
}
