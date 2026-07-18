import type {
  SketchEntityId,
  SketchEntitySnapshot,
  SketchId,
  SketchSnapshot,
  Vec2
} from "@web-cad/cad-protocol";
import {
  projectPoint,
  type RenderCamera,
  type ViewportPoint,
  type ViewportSize
} from "@web-cad/renderer";
import {
  createDefaultSketchDisplayFrame,
  mapSketchPointToDisplayFrame,
  type SketchDisplayFrame
} from "./sketchDisplayFrames";

export type SketchViewportDragHandleKind =
  | "point"
  | "line"
  | "lineStart"
  | "lineEnd"
  | "circleCenter"
  | "circleRadius";

export interface SketchViewportDragHandle {
  readonly id: string;
  readonly kind: SketchViewportDragHandleKind;
  readonly label: string;
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
  readonly entityKind: SketchEntitySnapshot["kind"];
  readonly sketchPoint: Vec2;
  readonly screenPoint: ViewportPoint;
}

export interface SketchViewportProjectionBasis {
  readonly origin: ViewportPoint;
  readonly uVector: ViewportPoint;
  readonly vVector: ViewportPoint;
}

export function createSketchViewportDragHandles({
  camera,
  displayFrame,
  selectedEntityId,
  size,
  sketch
}: {
  readonly camera: RenderCamera;
  readonly displayFrame?: SketchDisplayFrame;
  readonly selectedEntityId?: SketchEntityId;
  readonly size: ViewportSize;
  readonly sketch: SketchSnapshot;
}): readonly SketchViewportDragHandle[] {
  const frame = displayFrame ?? createDefaultSketchDisplayFrame(sketch.plane);
  const entities = selectedEntityId
    ? sketch.entities.filter((entity) => entity.id === selectedEntityId)
    : sketch.entities;

  return entities.flatMap((entity) =>
    createEntityDragHandles(sketch.id, entity, frame, camera, size)
  );
}

export function createSketchViewportProjectionBasis({
  camera,
  displayFrame,
  size
}: {
  readonly camera: RenderCamera;
  readonly displayFrame: SketchDisplayFrame;
  readonly size: ViewportSize;
}): SketchViewportProjectionBasis | undefined {
  const origin = projectPoint(displayFrame.origin, camera, size);
  const uPoint = projectPoint(
    [
      displayFrame.origin[0] + displayFrame.uAxis[0],
      displayFrame.origin[1] + displayFrame.uAxis[1],
      displayFrame.origin[2] + displayFrame.uAxis[2]
    ],
    camera,
    size
  );
  const vPoint = projectPoint(
    [
      displayFrame.origin[0] + displayFrame.vAxis[0],
      displayFrame.origin[1] + displayFrame.vAxis[1],
      displayFrame.origin[2] + displayFrame.vAxis[2]
    ],
    camera,
    size
  );

  if (!origin || !uPoint || !vPoint) {
    return undefined;
  }

  return {
    origin,
    uVector: { x: uPoint.x - origin.x, y: uPoint.y - origin.y },
    vVector: { x: vPoint.x - origin.x, y: vPoint.y - origin.y }
  };
}

export function mapViewportDeltaToSketchDelta(
  basis: SketchViewportProjectionBasis,
  delta: ViewportPoint
): Vec2 | undefined {
  const determinant =
    basis.uVector.x * basis.vVector.y - basis.uVector.y * basis.vVector.x;

  if (Math.abs(determinant) < 0.000001) {
    return undefined;
  }

  return cleanVec2([
    (delta.x * basis.vVector.y - delta.y * basis.vVector.x) / determinant,
    (basis.uVector.x * delta.y - basis.uVector.y * delta.x) / determinant
  ]);
}

export function mapViewportPointToSketchPoint(
  basis: SketchViewportProjectionBasis,
  point: ViewportPoint
): Vec2 | undefined {
  return mapViewportDeltaToSketchDelta(basis, {
    x: point.x - basis.origin.x,
    y: point.y - basis.origin.y
  });
}

export function applySketchViewportDrag(
  entity: SketchEntitySnapshot,
  handle: Pick<SketchViewportDragHandle, "kind" | "sketchPoint">,
  nextSketchPoint: Vec2
): SketchEntitySnapshot {
  switch (entity.kind) {
    case "point":
      return { ...entity, point: cleanVec2(nextSketchPoint) };
    case "line":
      return applyLineDrag(entity, handle, nextSketchPoint);
    case "circle":
      return applyCircleDrag(entity, handle, nextSketchPoint);
    case "rectangle":
      return entity;
    case "arc":
      return entity;
  }
}

function createEntityDragHandles(
  sketchId: SketchId,
  entity: SketchEntitySnapshot,
  frame: SketchDisplayFrame,
  camera: RenderCamera,
  size: ViewportSize
): readonly SketchViewportDragHandle[] {
  switch (entity.kind) {
    case "point":
      return [
        createHandle(
          sketchId,
          entity,
          "point",
          "Point",
          entity.point,
          frame,
          camera,
          size
        )
      ].filter(isDefined);
    case "line":
      return [
        createHandle(
          sketchId,
          entity,
          "lineStart",
          "Start point",
          entity.start,
          frame,
          camera,
          size
        ),
        createHandle(
          sketchId,
          entity,
          "lineEnd",
          "End point",
          entity.end,
          frame,
          camera,
          size
        ),
        createHandle(
          sketchId,
          entity,
          "line",
          "Line",
          midpoint(entity.start, entity.end),
          frame,
          camera,
          size
        )
      ].filter(isDefined);
    case "circle":
      return [
        createHandle(
          sketchId,
          entity,
          "circleCenter",
          "Center",
          entity.center,
          frame,
          camera,
          size
        ),
        createHandle(
          sketchId,
          entity,
          "circleRadius",
          "Radius",
          [entity.center[0] + entity.radius, entity.center[1]],
          frame,
          camera,
          size
        )
      ].filter(isDefined);
    case "rectangle":
      return [];
    case "arc":
      return [];
  }
}

function createHandle(
  sketchId: SketchId,
  entity: SketchEntitySnapshot,
  kind: SketchViewportDragHandleKind,
  label: string,
  sketchPoint: Vec2,
  frame: SketchDisplayFrame,
  camera: RenderCamera,
  size: ViewportSize
): SketchViewportDragHandle | undefined {
  const screenPoint = projectPoint(
    mapSketchPointToDisplayFrame(frame, sketchPoint),
    camera,
    size
  );

  if (!screenPoint) {
    return undefined;
  }

  return {
    id: `${sketchId}:${entity.id}:${kind}`,
    kind,
    label,
    sketchId,
    entityId: entity.id,
    entityKind: entity.kind,
    sketchPoint,
    screenPoint: { x: screenPoint.x, y: screenPoint.y }
  };
}

function applyLineDrag(
  entity: Extract<SketchEntitySnapshot, { readonly kind: "line" }>,
  handle: Pick<SketchViewportDragHandle, "kind" | "sketchPoint">,
  nextSketchPoint: Vec2
): SketchEntitySnapshot {
  if (handle.kind === "lineStart") {
    return { ...entity, start: cleanVec2(nextSketchPoint) };
  }

  if (handle.kind === "lineEnd") {
    return { ...entity, end: cleanVec2(nextSketchPoint) };
  }

  if (handle.kind !== "line") {
    return entity;
  }

  const delta = subtractVec2(nextSketchPoint, handle.sketchPoint);

  return {
    ...entity,
    start: cleanVec2(addVec2(entity.start, delta)),
    end: cleanVec2(addVec2(entity.end, delta))
  };
}

function applyCircleDrag(
  entity: Extract<SketchEntitySnapshot, { readonly kind: "circle" }>,
  handle: Pick<SketchViewportDragHandle, "kind" | "sketchPoint">,
  nextSketchPoint: Vec2
): SketchEntitySnapshot {
  if (handle.kind === "circleCenter") {
    return { ...entity, center: cleanVec2(nextSketchPoint) };
  }

  if (handle.kind !== "circleRadius") {
    return entity;
  }

  return {
    ...entity,
    radius: cleanScalar(
      Math.max(distanceVec2(entity.center, nextSketchPoint), 0.001)
    )
  };
}

function midpoint(left: Vec2, right: Vec2): Vec2 {
  return cleanVec2([(left[0] + right[0]) / 2, (left[1] + right[1]) / 2]);
}

function addVec2(left: Vec2, right: Vec2): Vec2 {
  return [left[0] + right[0], left[1] + right[1]];
}

function subtractVec2(left: Vec2, right: Vec2): Vec2 {
  return [left[0] - right[0], left[1] - right[1]];
}

function distanceVec2(left: Vec2, right: Vec2): number {
  return Math.hypot(left[0] - right[0], left[1] - right[1]);
}

function cleanVec2(value: Vec2): Vec2 {
  return [cleanScalar(value[0]), cleanScalar(value[1])];
}

function cleanScalar(value: number): number {
  return Math.abs(value) < 0.000001 ? 0 : Number(value.toFixed(6));
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
