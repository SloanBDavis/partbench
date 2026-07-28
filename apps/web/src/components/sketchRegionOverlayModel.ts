import type {
  SketchEntitySnapshot,
  SketchLoopRef,
  SketchProfileRegionCandidate,
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
  mapSketchPointToDisplayFrame,
  type SketchDisplayFrame
} from "../sketchDisplayFrames";

export function createRegionScreenPath(
  candidate: SketchProfileRegionCandidate,
  sketch: SketchSnapshot,
  displayFrame: SketchDisplayFrame,
  camera: RenderCamera,
  size: ViewportSize
): string | undefined {
  return createRegionScreenPathFromEntityIndex(
    candidate,
    createSketchRegionEntityIndex(sketch),
    displayFrame,
    camera,
    size
  );
}

export function createSketchRegionEntityIndex(
  sketch: SketchSnapshot
): ReadonlyMap<string, SketchEntitySnapshot> {
  return new Map(sketch.entities.map((entity) => [entity.id, entity]));
}

export function createRegionScreenPaths(
  candidates: readonly SketchProfileRegionCandidate[],
  sketch: SketchSnapshot,
  displayFrame: SketchDisplayFrame,
  camera: RenderCamera,
  size: ViewportSize
): ReadonlyMap<string, string> {
  const entities = createSketchRegionEntityIndex(sketch);
  const paths = new Map<string, string>();
  for (const candidate of candidates) {
    if (candidate.status !== "valid") continue;
    const path = createRegionScreenPathFromEntityIndex(
      candidate,
      entities,
      displayFrame,
      camera,
      size
    );
    if (path) paths.set(candidate.candidateKey, path);
  }
  return paths;
}

export function createRegionScreenPathFromEntityIndex(
  candidate: SketchProfileRegionCandidate,
  entities: ReadonlyMap<string, SketchEntitySnapshot>,
  displayFrame: SketchDisplayFrame,
  camera: RenderCamera,
  size: ViewportSize
): string | undefined {
  const loops = [candidate.region.outer, ...candidate.region.holes];
  const projected = loops.map((loop) =>
    sampleLoop(loop, entities).map((point) =>
      projectPoint(
        mapSketchPointToDisplayFrame(displayFrame, point),
        camera,
        size
      )
    )
  );
  if (
    projected.some(
      (points) => points.length < 3 || points.some((point) => !point)
    )
  ) {
    return undefined;
  }
  return projected
    .map((points) => createClosedScreenSubpath(points as ViewportPoint[]))
    .join(" ");
}

function sampleLoop(
  loop: SketchLoopRef,
  entities: ReadonlyMap<string, SketchEntitySnapshot>
): readonly Vec2[] {
  if (loop.kind === "entity") {
    const entity = entities.get(loop.entityId);
    return entity ? sampleEntityLoop(entity) : [];
  }

  const points: Vec2[] = [];
  for (const segment of loop.segments) {
    const entity = entities.get(segment.entityId);
    if (!entity || (entity.kind !== "line" && entity.kind !== "arc")) {
      return [];
    }
    const segmentPoints =
      entity.kind === "line"
        ? segment.orientation === "forward"
          ? [entity.start, entity.end]
          : [entity.end, entity.start]
        : sampleArcEntity(entity, segment.orientation);
    points.push(
      ...(points.length === 0 ? segmentPoints : segmentPoints.slice(1))
    );
  }
  return removeClosingDuplicate(points);
}

function sampleEntityLoop(entity: SketchEntitySnapshot): readonly Vec2[] {
  if (entity.kind === "rectangle") {
    const halfWidth = entity.width / 2;
    const halfHeight = entity.height / 2;
    return [
      [entity.center[0] - halfWidth, entity.center[1] - halfHeight],
      [entity.center[0] + halfWidth, entity.center[1] - halfHeight],
      [entity.center[0] + halfWidth, entity.center[1] + halfHeight],
      [entity.center[0] - halfWidth, entity.center[1] + halfHeight]
    ];
  }
  if (entity.kind === "circle") {
    return sampleCircle(entity.center, entity.radius);
  }
  return [];
}

function sampleCircle(center: Vec2, radius: number): readonly Vec2[] {
  const count = 32;
  return Array.from({ length: count }, (_, index) => {
    const angle = (2 * Math.PI * index) / count;
    return [
      center[0] + radius * Math.cos(angle),
      center[1] + radius * Math.sin(angle)
    ] as Vec2;
  });
}

function sampleArcEntity(
  entity: Extract<SketchEntitySnapshot, { readonly kind: "arc" }>,
  orientation: "forward" | "reverse"
): readonly Vec2[] {
  const start =
    orientation === "forward"
      ? entity.startAngleDegrees
      : entity.startAngleDegrees + entity.sweepAngleDegrees;
  const sweep =
    orientation === "forward"
      ? entity.sweepAngleDegrees
      : -entity.sweepAngleDegrees;
  const count = Math.max(4, Math.ceil(Math.abs(sweep) / 8));
  return Array.from({ length: count + 1 }, (_, index) => {
    const angle = ((start + sweep * (index / count)) * Math.PI) / 180;
    return [
      entity.center[0] + entity.radius * Math.cos(angle),
      entity.center[1] + entity.radius * Math.sin(angle)
    ] as Vec2;
  });
}

function removeClosingDuplicate(points: readonly Vec2[]): readonly Vec2[] {
  if (points.length < 2) return points;
  const first = points[0]!;
  const last = points.at(-1)!;
  return first[0] === last[0] && first[1] === last[1]
    ? points.slice(0, -1)
    : points;
}

function createClosedScreenSubpath(points: readonly ViewportPoint[]): string {
  return `${points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${formatCoordinate(point.x)} ${formatCoordinate(point.y)}`
    )
    .join(" ")} Z`;
}

function formatCoordinate(value: number): string {
  return Number(value.toFixed(3)).toString();
}
