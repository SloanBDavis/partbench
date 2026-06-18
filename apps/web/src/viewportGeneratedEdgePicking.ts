import type {
  CadGeneratedEdgeReference,
  CadViewportHitCandidate,
  FeatureExtrudeSide,
  SketchPlane,
  Vec2
} from "@web-cad/cad-protocol";
import {
  projectPoint,
  type ProjectedPoint,
  type RenderCamera,
  type Vec3,
  type ViewportPoint,
  type ViewportSize
} from "@web-cad/renderer";
import {
  createDefaultSketchDisplayFrame,
  mapSketchPlanePointToDisplayFrame,
  type SketchDisplayFrame
} from "./sketchDisplayFrames";

const EDGE_PICK_TOLERANCE_PX = 10;
const CIRCLE_EDGE_SEGMENTS = 64;

export interface CreateViewportGeneratedEdgeHitCandidateInput {
  readonly camera: RenderCamera;
  readonly edges: readonly CadGeneratedEdgeReference[];
  readonly pickedRenderId?: string;
  readonly point: ViewportPoint;
  readonly targetBodyId?: string;
  readonly preferredBodyId?: string;
  readonly size: ViewportSize;
  readonly sketchDisplayFrames?: ReadonlyMap<string, SketchDisplayFrame>;
}

interface ViewportGeneratedEdgeCandidate {
  readonly edge: CadGeneratedEdgeReference;
  readonly depth: number;
  readonly distance: number;
}

export function createViewportGeneratedEdgeHitCandidate({
  camera,
  edges,
  point,
  targetBodyId,
  preferredBodyId,
  size,
  sketchDisplayFrames
}: CreateViewportGeneratedEdgeHitCandidateInput):
  | CadViewportHitCandidate
  | undefined {
  const bodyId = targetBodyId ?? preferredBodyId;

  if (!bodyId) {
    return undefined;
  }

  const candidates = edges
    .filter((edge) => edge.bodyId === bodyId)
    .map((edge) =>
      createViewportGeneratedEdgeCandidate({
        camera,
        edge,
        point,
        size,
        sketchDisplayFrames
      })
    )
    .filter(
      (candidate): candidate is ViewportGeneratedEdgeCandidate =>
        candidate !== undefined
    )
    .sort((left, right) => {
      if (left.distance !== right.distance) {
        return left.distance - right.distance;
      }

      return left.depth - right.depth;
    });

  const candidate = candidates[0];
  const edge = candidate?.edge;

  if (!edge) {
    return undefined;
  }

  return {
    displayEntityKind: "edge",
    rendererHitId: createPrivateGeneratedEdgeHitId(edge),
    precision: "displayApproximation",
    depth: candidate.depth,
    semanticHint: {
      type: "generatedReference",
      bodyId: edge.bodyId,
      stableId: edge.stableId,
      expectedKind: "edge"
    }
  };
}

function createViewportGeneratedEdgeCandidate({
  camera,
  edge,
  point,
  size,
  sketchDisplayFrames
}: {
  readonly camera: RenderCamera;
  readonly edge: CadGeneratedEdgeReference;
  readonly point: ViewportPoint;
  readonly size: ViewportSize;
  readonly sketchDisplayFrames?: ReadonlyMap<string, SketchDisplayFrame>;
}): ViewportGeneratedEdgeCandidate | undefined {
  const points = createGeneratedEdgePolyline(edge, sketchDisplayFrames);

  if (points.length < 2) {
    return undefined;
  }

  const projected = points
    .map((vertex) => projectPoint(vertex, camera, size))
    .filter((vertex): vertex is ProjectedPoint => Boolean(vertex));

  if (projected.length !== points.length) {
    return undefined;
  }

  const distance = getPolylinePointDistance(point, projected);

  if (distance > EDGE_PICK_TOLERANCE_PX) {
    return undefined;
  }

  return {
    edge,
    distance,
    depth:
      projected.reduce((sum, vertex) => sum + vertex.depth, 0) /
      projected.length
  };
}

function createGeneratedEdgePolyline(
  edge: CadGeneratedEdgeReference,
  sketchDisplayFrames: ReadonlyMap<string, SketchDisplayFrame> | undefined
): readonly Vec3[] {
  const { geometricSignature } = edge;
  const { profile } = geometricSignature;

  if (!profile) {
    return [];
  }

  const frame =
    sketchDisplayFrames?.get(edge.sourceSketchId) ??
    createDefaultSketchDisplayFrame(geometricSignature.sketchPlane);
  const depthRange = createExtrudeDepthRange(
    geometricSignature.depth,
    geometricSignature.extrudeSide
  );

  if (profile.kind === "rectangle" && geometricSignature.curveType === "line") {
    return createRectangleEdgePolyline(
      edge,
      geometricSignature.sketchPlane,
      frame,
      profile.center,
      profile.width,
      profile.height,
      depthRange
    );
  }

  if (profile.kind === "circle" && geometricSignature.curveType === "circle") {
    return createCircleEdgePolyline(
      edge,
      geometricSignature.sketchPlane,
      frame,
      profile.center,
      profile.radius,
      depthRange
    );
  }

  return [];
}

function createRectangleEdgePolyline(
  edge: CadGeneratedEdgeReference,
  plane: SketchPlane,
  frame: SketchDisplayFrame,
  center: Vec2,
  width: number,
  height: number,
  depthRange: readonly [number, number]
): readonly Vec3[] {
  const uMin = center[0] - width / 2;
  const uMax = center[0] + width / 2;
  const vMin = center[1] - height / 2;
  const vMax = center[1] + height / 2;
  const start = depthRange[0];
  const end = depthRange[1];

  switch (edge.role) {
    case "start:uMin":
      return mapEdgePolyline(frame, plane, [
        [uMin, vMin, start],
        [uMin, vMax, start]
      ]);
    case "start:uMax":
      return mapEdgePolyline(frame, plane, [
        [uMax, vMin, start],
        [uMax, vMax, start]
      ]);
    case "start:vMin":
      return mapEdgePolyline(frame, plane, [
        [uMin, vMin, start],
        [uMax, vMin, start]
      ]);
    case "start:vMax":
      return mapEdgePolyline(frame, plane, [
        [uMin, vMax, start],
        [uMax, vMax, start]
      ]);
    case "end:uMin":
      return mapEdgePolyline(frame, plane, [
        [uMin, vMin, end],
        [uMin, vMax, end]
      ]);
    case "end:uMax":
      return mapEdgePolyline(frame, plane, [
        [uMax, vMin, end],
        [uMax, vMax, end]
      ]);
    case "end:vMin":
      return mapEdgePolyline(frame, plane, [
        [uMin, vMin, end],
        [uMax, vMin, end]
      ]);
    case "end:vMax":
      return mapEdgePolyline(frame, plane, [
        [uMin, vMax, end],
        [uMax, vMax, end]
      ]);
    case "longitudinal:uMin:vMin":
      return mapEdgePolyline(frame, plane, [
        [uMin, vMin, start],
        [uMin, vMin, end]
      ]);
    case "longitudinal:uMin:vMax":
      return mapEdgePolyline(frame, plane, [
        [uMin, vMax, start],
        [uMin, vMax, end]
      ]);
    case "longitudinal:uMax:vMin":
      return mapEdgePolyline(frame, plane, [
        [uMax, vMin, start],
        [uMax, vMin, end]
      ]);
    case "longitudinal:uMax:vMax":
      return mapEdgePolyline(frame, plane, [
        [uMax, vMax, start],
        [uMax, vMax, end]
      ]);
    case "start:circular":
    case "end:circular":
      return [];
  }
}

function createCircleEdgePolyline(
  edge: CadGeneratedEdgeReference,
  plane: SketchPlane,
  frame: SketchDisplayFrame,
  center: Vec2,
  radius: number,
  depthRange: readonly [number, number]
): readonly Vec3[] {
  if (edge.role !== "start:circular" && edge.role !== "end:circular") {
    return [];
  }

  const normalDistance =
    edge.role === "start:circular" ? depthRange[0] : depthRange[1];
  const polyline: [number, number, number][] = [];

  for (let index = 0; index <= CIRCLE_EDGE_SEGMENTS; index += 1) {
    const angle = (index / CIRCLE_EDGE_SEGMENTS) * Math.PI * 2;
    polyline.push([
      center[0] + Math.cos(angle) * radius,
      center[1] + Math.sin(angle) * radius,
      normalDistance
    ]);
  }

  return mapEdgePolyline(frame, plane, polyline);
}

function mapEdgePolyline(
  frame: SketchDisplayFrame,
  plane: SketchPlane,
  polyline: readonly (readonly [number, number, number])[]
): readonly Vec3[] {
  return polyline.map(([u, v, normalDistance]) =>
    mapSketchPlanePointToDisplayFrame(
      frame,
      plane,
      createSketchPlanePoint(plane, u, v, normalDistance)
    )
  );
}

function createSketchPlanePoint(
  plane: SketchPlane,
  u: number,
  v: number,
  normalDistance: number
): Vec3 {
  switch (plane) {
    case "XY":
      return [u, v, normalDistance];
    case "XZ":
      return [u, normalDistance, v];
    case "YZ":
      return [normalDistance, u, v];
  }
}

function createExtrudeDepthRange(
  depth: number,
  side: FeatureExtrudeSide
): readonly [number, number] {
  switch (side) {
    case "positive":
      return [0, depth];
    case "negative":
      return [0, -depth];
    case "symmetric":
      return [-depth / 2, depth / 2];
  }
}

function getPolylinePointDistance(
  point: ViewportPoint,
  polyline: readonly ProjectedPoint[]
): number {
  let distance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < polyline.length - 1; index += 1) {
    distance = Math.min(
      distance,
      getPointSegmentDistance(point, polyline[index], polyline[index + 1])
    );
  }

  return distance;
}

function getPointSegmentDistance(
  point: ViewportPoint,
  start: ViewportPoint,
  end: ViewportPoint
): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared
    )
  );
  const closest = {
    x: start.x + t * dx,
    y: start.y + t * dy
  };

  return Math.hypot(point.x - closest.x, point.y - closest.y);
}

function createPrivateGeneratedEdgeHitId(
  edge: CadGeneratedEdgeReference
): string {
  return `renderer-hit:generated-edge:${edge.bodyId}:${edge.stableId}`;
}
