import type {
  CadGeneratedFaceReference,
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

export interface CreateViewportGeneratedPlanarFaceHitCandidateInput {
  readonly camera: RenderCamera;
  readonly faces: readonly CadGeneratedFaceReference[];
  readonly pickedRenderId?: string;
  readonly point: ViewportPoint;
  readonly targetBodyId?: string;
  readonly preferredBodyId?: string;
  readonly size: ViewportSize;
  readonly sketchDisplayFrames?: ReadonlyMap<string, SketchDisplayFrame>;
}

interface ViewportGeneratedPlanarFaceCandidate {
  readonly face: CadGeneratedFaceReference;
  readonly depth: number;
}

export function createViewportGeneratedPlanarFaceHitCandidate({
  camera,
  faces,
  point,
  targetBodyId,
  preferredBodyId,
  size,
  sketchDisplayFrames
}: CreateViewportGeneratedPlanarFaceHitCandidateInput):
  | CadViewportHitCandidate
  | undefined {
  const bodyId = targetBodyId ?? preferredBodyId;

  if (!bodyId) {
    return undefined;
  }

  const candidates = faces
    .filter((face) => face.bodyId === bodyId)
    .map((face) =>
      createViewportGeneratedPlanarFaceCandidate({
        camera,
        face,
        point,
        size,
        sketchDisplayFrames
      })
    )
    .filter(
      (candidate): candidate is ViewportGeneratedPlanarFaceCandidate =>
        candidate !== undefined
    )
    .sort((left, right) => left.depth - right.depth);

  const candidate = candidates[0];
  const face = candidate?.face;

  if (!face) {
    return undefined;
  }

  return {
    displayEntityKind: "face",
    rendererHitId: createPrivateGeneratedFaceHitId(face),
    precision: "displayApproximation",
    depth: candidate.depth,
    semanticHint: {
      type: "generatedReference",
      bodyId: face.bodyId,
      stableId: face.stableId,
      expectedKind: "face"
    }
  };
}

function createViewportGeneratedPlanarFaceCandidate({
  camera,
  face,
  point,
  size,
  sketchDisplayFrames
}: {
  readonly camera: RenderCamera;
  readonly face: CadGeneratedFaceReference;
  readonly point: ViewportPoint;
  readonly size: ViewportSize;
  readonly sketchDisplayFrames?: ReadonlyMap<string, SketchDisplayFrame>;
}): ViewportGeneratedPlanarFaceCandidate | undefined {
  const polygon = createGeneratedPlanarFacePolygon(face, sketchDisplayFrames);

  if (!polygon) {
    return undefined;
  }

  const projected = polygon
    .map((vertex) => projectPoint(vertex, camera, size))
    .filter((vertex): vertex is ProjectedPoint => Boolean(vertex));

  if (projected.length !== polygon.length) {
    return undefined;
  }

  if (!containsPointInPolygon(point, projected)) {
    return undefined;
  }

  return {
    face,
    depth:
      projected.reduce((sum, vertex) => sum + vertex.depth, 0) /
      projected.length
  };
}

function createGeneratedPlanarFacePolygon(
  face: CadGeneratedFaceReference,
  sketchDisplayFrames: ReadonlyMap<string, SketchDisplayFrame> | undefined
): readonly Vec3[] | undefined {
  const { geometricSignature } = face;

  if (geometricSignature.surfaceType !== "plane") {
    return undefined;
  }

  const { profile } = geometricSignature;

  if (!profile) {
    return undefined;
  }

  const frame =
    sketchDisplayFrames?.get(face.sourceSketchId) ??
    createDefaultSketchDisplayFrame(geometricSignature.sketchPlane);
  const depthRange = createExtrudeDepthRange(
    geometricSignature.depth,
    geometricSignature.extrudeSide
  );

  if (profile.kind === "rectangle") {
    return createRectangleFacePolygon(
      face,
      geometricSignature.sketchPlane,
      frame,
      profile.center,
      profile.width,
      profile.height,
      depthRange
    );
  }

  return createCircleFacePolygon(
    face,
    geometricSignature.sketchPlane,
    frame,
    profile.center,
    profile.radius,
    depthRange
  );
}

function createRectangleFacePolygon(
  face: CadGeneratedFaceReference,
  plane: SketchPlane,
  frame: SketchDisplayFrame,
  center: Vec2,
  width: number,
  height: number,
  depthRange: readonly [number, number]
): readonly Vec3[] | undefined {
  const uMin = center[0] - width / 2;
  const uMax = center[0] + width / 2;
  const vMin = center[1] - height / 2;
  const vMax = center[1] + height / 2;
  const start = depthRange[0];
  const end = depthRange[1];

  switch (face.role) {
    case "startCap":
      return mapFacePolygon(frame, plane, [
        [uMin, vMin, start],
        [uMax, vMin, start],
        [uMax, vMax, start],
        [uMin, vMax, start]
      ]);
    case "endCap":
      return mapFacePolygon(frame, plane, [
        [uMin, vMin, end],
        [uMax, vMin, end],
        [uMax, vMax, end],
        [uMin, vMax, end]
      ]);
    case "side:uMin":
      return mapFacePolygon(frame, plane, [
        [uMin, vMin, start],
        [uMin, vMax, start],
        [uMin, vMax, end],
        [uMin, vMin, end]
      ]);
    case "side:uMax":
      return mapFacePolygon(frame, plane, [
        [uMax, vMin, start],
        [uMax, vMax, start],
        [uMax, vMax, end],
        [uMax, vMin, end]
      ]);
    case "side:vMin":
      return mapFacePolygon(frame, plane, [
        [uMin, vMin, start],
        [uMax, vMin, start],
        [uMax, vMin, end],
        [uMin, vMin, end]
      ]);
    case "side:vMax":
      return mapFacePolygon(frame, plane, [
        [uMin, vMax, start],
        [uMax, vMax, start],
        [uMax, vMax, end],
        [uMin, vMax, end]
      ]);
    case "side:circular":
      return undefined;
  }
}

function createCircleFacePolygon(
  face: CadGeneratedFaceReference,
  plane: SketchPlane,
  frame: SketchDisplayFrame,
  center: Vec2,
  radius: number,
  depthRange: readonly [number, number]
): readonly Vec3[] | undefined {
  if (face.role !== "startCap" && face.role !== "endCap") {
    return undefined;
  }

  const normalDistance =
    face.role === "startCap" ? depthRange[0] : depthRange[1];
  const polygon: [number, number, number][] = [];

  for (let index = 0; index < 32; index += 1) {
    const angle = (index / 32) * Math.PI * 2;
    polygon.push([
      center[0] + Math.cos(angle) * radius,
      center[1] + Math.sin(angle) * radius,
      normalDistance
    ]);
  }

  return mapFacePolygon(frame, plane, polygon);
}

function mapFacePolygon(
  frame: SketchDisplayFrame,
  plane: SketchPlane,
  polygon: readonly (readonly [number, number, number])[]
): readonly Vec3[] {
  return polygon.map(([u, v, normalDistance]) =>
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

function containsPointInPolygon(
  point: ViewportPoint,
  polygon: readonly { readonly x: number; readonly y: number }[]
): boolean {
  let inside = false;

  for (
    let currentIndex = 0, previousIndex = polygon.length - 1;
    currentIndex < polygon.length;
    previousIndex = currentIndex, currentIndex += 1
  ) {
    const current = polygon[currentIndex];
    const previous = polygon[previousIndex];
    const intersects =
      current.y > point.y !== previous.y > point.y &&
      point.x <
        ((previous.x - current.x) * (point.y - current.y)) /
          (previous.y - current.y) +
          current.x;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function createPrivateGeneratedFaceHitId(
  face: CadGeneratedFaceReference
): string {
  return `renderer-hit:generated-face:${face.bodyId}:${face.stableId}`;
}
