import type { SceneObject } from "@web-cad/cad-core";
import type {
  RenderEdgeSegment,
  RenderPrimitive,
  RenderTransform,
  RenderTriangleMesh,
  Vec3
} from "@web-cad/renderer";
import type {
  DerivedExtrudeGeometrySource,
  DerivedGeometryEntry
} from "./derivedGeometry";

export interface RenderSceneInputs {
  readonly primitives: readonly RenderPrimitive[];
  readonly meshes: readonly RenderTriangleMesh[];
}

export function createRenderSceneInputs(
  objects: readonly SceneObject[],
  derivedGeometryBySourceId: ReadonlyMap<string, DerivedGeometryEntry>,
  extrudeSources: readonly DerivedExtrudeGeometrySource[] = []
): RenderSceneInputs {
  const primitives: RenderPrimitive[] = [];
  const meshes: RenderTriangleMesh[] = [];

  for (const object of objects) {
    const derivedGeometry = derivedGeometryBySourceId.get(object.id);

    if (derivedGeometry?.status === "ready") {
      meshes.push(addMeshDisplayEdges(derivedGeometry.mesh, object));
      continue;
    }

    primitives.push(toRenderPrimitive(object));
  }

  for (const source of extrudeSources) {
    const derivedGeometry = derivedGeometryBySourceId.get(source.id);

    if (derivedGeometry?.status === "ready") {
      meshes.push(addExtrudeMeshDisplayEdges(derivedGeometry.mesh, source));
      continue;
    }

    primitives.push(toExtrudeFallbackPrimitive(source));
  }

  return { primitives, meshes };
}

export function addMeshDisplayEdges(
  mesh: RenderTriangleMesh,
  object: SceneObject
): RenderTriangleMesh {
  return {
    ...mesh,
    edgeSegments: createMeshDisplayEdges(object)
  };
}

export function addExtrudeMeshDisplayEdges(
  mesh: RenderTriangleMesh,
  source: DerivedExtrudeGeometrySource
): RenderTriangleMesh {
  return {
    ...mesh,
    edgeSegments: createExtrudeDisplayEdges(source)
  };
}

export function createMeshDisplayEdges(
  object: SceneObject
): readonly RenderEdgeSegment[] {
  switch (object.kind) {
    case "box":
      return createBoxDisplayEdges(object.dimensions);
    case "cylinder":
      return createCylinderDisplayEdges(object.dimensions);
    case "sphere":
      return createSphereDisplayEdges(object.dimensions);
    case "cone":
      return createConeDisplayEdges(object.dimensions);
    case "torus":
      return createTorusDisplayEdges(object.dimensions);
  }
}

export function toRenderPrimitive(object: SceneObject): RenderPrimitive {
  if (object.kind === "box") {
    return {
      id: object.id,
      kind: "box",
      dimensions: object.dimensions,
      transform: object.transform
    };
  }

  if (object.kind === "sphere") {
    return {
      id: object.id,
      kind: "sphere",
      dimensions: object.dimensions,
      transform: object.transform
    };
  }

  if (object.kind === "cone") {
    return {
      id: object.id,
      kind: "cone",
      dimensions: object.dimensions,
      transform: object.transform
    };
  }

  if (object.kind === "torus") {
    return {
      id: object.id,
      kind: "torus",
      dimensions: object.dimensions,
      transform: object.transform
    };
  }

  return {
    id: object.id,
    kind: "cylinder",
    dimensions: object.dimensions,
    transform: object.transform
  };
}

export function toExtrudeFallbackPrimitive(
  source: DerivedExtrudeGeometrySource
): RenderPrimitive {
  if (source.profile.kind === "rectangle") {
    return toRectangleExtrudePrimitive(source);
  }

  return toCircleExtrudePrimitive(source);
}

function toRectangleExtrudePrimitive(
  source: DerivedExtrudeGeometrySource
): RenderPrimitive {
  if (source.profile.kind !== "rectangle") {
    throw new Error("Rectangle extrude source must use a rectangle profile.");
  }

  const { center, height, width } = source.profile;

  switch (source.sketchPlane) {
    case "XY":
      return {
        id: source.id,
        kind: "box",
        dimensions: { width, height, depth: source.depth },
        transform: {
          translation: [center[0], center[1], source.depth / 2],
          rotation: [0, 0, 0],
          scale: [1, 1, 1]
        }
      };
    case "XZ":
      return {
        id: source.id,
        kind: "box",
        dimensions: { width, height: source.depth, depth: height },
        transform: {
          translation: [center[0], source.depth / 2, center[1]],
          rotation: [0, 0, 0],
          scale: [1, 1, 1]
        }
      };
    case "YZ":
      return {
        id: source.id,
        kind: "box",
        dimensions: { width: source.depth, height: width, depth: height },
        transform: {
          translation: [source.depth / 2, center[0], center[1]],
          rotation: [0, 0, 0],
          scale: [1, 1, 1]
        }
      };
  }
}

function toCircleExtrudePrimitive(
  source: DerivedExtrudeGeometrySource
): RenderPrimitive {
  if (source.profile.kind !== "circle") {
    throw new Error("Circle extrude source must use a circle profile.");
  }

  const { center, radius } = source.profile;

  switch (source.sketchPlane) {
    case "XY":
      return {
        id: source.id,
        kind: "cylinder",
        dimensions: { radius, height: source.depth },
        transform: {
          translation: [center[0], center[1], source.depth / 2],
          rotation: [0, 0, 0],
          scale: [1, 1, 1]
        }
      };
    case "XZ":
      return {
        id: source.id,
        kind: "cylinder",
        dimensions: { radius, height: source.depth },
        transform: {
          translation: [center[0], source.depth / 2, center[1]],
          rotation: [-Math.PI / 2, 0, 0],
          scale: [1, 1, 1]
        }
      };
    case "YZ":
      return {
        id: source.id,
        kind: "cylinder",
        dimensions: { radius, height: source.depth },
        transform: {
          translation: [source.depth / 2, center[0], center[1]],
          rotation: [0, Math.PI / 2, 0],
          scale: [1, 1, 1]
        }
      };
  }
}

function createExtrudeDisplayEdges(
  source: DerivedExtrudeGeometrySource
): readonly RenderEdgeSegment[] {
  const primitive = toExtrudeFallbackPrimitive(source);

  if (primitive.kind === "box") {
    return transformEdges(
      createBoxDisplayEdges(primitive.dimensions),
      primitive.transform
    );
  }

  if (primitive.kind === "cylinder") {
    return transformEdges(
      createCylinderDisplayEdges(primitive.dimensions),
      primitive.transform
    );
  }

  return transformEdges([], primitive.transform);
}

function transformEdges(
  edges: readonly RenderEdgeSegment[],
  transform: RenderTransform
): readonly RenderEdgeSegment[] {
  return edges.map((edge) => ({
    start: transformPoint(edge.start, transform),
    end: transformPoint(edge.end, transform)
  }));
}

function transformPoint(point: Vec3, transform: RenderTransform): Vec3 {
  const scaled: Vec3 = [
    point[0] * transform.scale[0],
    point[1] * transform.scale[1],
    point[2] * transform.scale[2]
  ];
  const rotated = rotateEuler(scaled, transform.rotation);

  return [
    rotated[0] + transform.translation[0],
    rotated[1] + transform.translation[1],
    rotated[2] + transform.translation[2]
  ];
}

function rotateEuler(point: Vec3, rotation: Vec3): Vec3 {
  const [rx, ry, rz] = rotation;
  const cosX = Math.cos(rx);
  const sinX = Math.sin(rx);
  const cosY = Math.cos(ry);
  const sinY = Math.sin(ry);
  const cosZ = Math.cos(rz);
  const sinZ = Math.sin(rz);
  const y1 = point[1] * cosX - point[2] * sinX;
  const z1 = point[1] * sinX + point[2] * cosX;
  const x2 = point[0] * cosY + z1 * sinY;
  const z2 = -point[0] * sinY + z1 * cosY;
  const x3 = x2 * cosZ - y1 * sinZ;
  const y3 = x2 * sinZ + y1 * cosZ;

  return [x3, y3, z2];
}

function createBoxDisplayEdges(dimensions: {
  readonly width: number;
  readonly height: number;
  readonly depth: number;
}): readonly RenderEdgeSegment[] {
  const { depth, height, width } = dimensions;
  const halfX = width / 2;
  const halfY = height / 2;
  const halfZ = depth / 2;
  const vertices: readonly Vec3[] = [
    [-halfX, -halfY, -halfZ],
    [halfX, -halfY, -halfZ],
    [halfX, halfY, -halfZ],
    [-halfX, halfY, -halfZ],
    [-halfX, -halfY, halfZ],
    [halfX, -halfY, halfZ],
    [halfX, halfY, halfZ],
    [-halfX, halfY, halfZ]
  ];
  const edges = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 4],
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7]
  ] as const;

  return edges.map(([start, end]) => ({
    start: vertices[start],
    end: vertices[end]
  }));
}

function createCylinderDisplayEdges(dimensions: {
  readonly radius: number;
  readonly height: number;
}): readonly RenderEdgeSegment[] {
  const segmentCount = 32;
  const halfHeight = dimensions.height / 2;
  const edges: RenderEdgeSegment[] = [];

  for (let index = 0; index < segmentCount; index += 1) {
    const nextIndex = (index + 1) % segmentCount;
    const startTop = cylinderPoint(dimensions.radius, halfHeight, index);
    const endTop = cylinderPoint(dimensions.radius, halfHeight, nextIndex);
    const startBottom = cylinderPoint(dimensions.radius, -halfHeight, index);
    const endBottom = cylinderPoint(dimensions.radius, -halfHeight, nextIndex);

    edges.push({ start: startTop, end: endTop });
    edges.push({ start: startBottom, end: endBottom });
  }

  for (const index of [0, 8, 16, 24]) {
    edges.push({
      start: cylinderPoint(dimensions.radius, halfHeight, index),
      end: cylinderPoint(dimensions.radius, -halfHeight, index)
    });
  }

  return edges;
}

function createSphereDisplayEdges(dimensions: {
  readonly radius: number;
}): readonly RenderEdgeSegment[] {
  const segmentCount = 32;
  const edges: RenderEdgeSegment[] = [];

  for (const plane of ["xy", "xz", "yz"] as const) {
    for (let index = 0; index < segmentCount; index += 1) {
      edges.push({
        start: spherePoint(dimensions.radius, plane, index),
        end: spherePoint(dimensions.radius, plane, (index + 1) % segmentCount)
      });
    }
  }

  return edges;
}

function createConeDisplayEdges(dimensions: {
  readonly radius: number;
  readonly height: number;
}): readonly RenderEdgeSegment[] {
  const segmentCount = 32;
  const halfHeight = dimensions.height / 2;
  const apex: Vec3 = [0, 0, halfHeight];
  const edges: RenderEdgeSegment[] = [];

  for (let index = 0; index < segmentCount; index += 1) {
    const nextIndex = (index + 1) % segmentCount;
    const start = cylinderPoint(dimensions.radius, -halfHeight, index);
    const end = cylinderPoint(dimensions.radius, -halfHeight, nextIndex);
    edges.push({ start, end });

    if (index % 8 === 0) {
      edges.push({ start, end: apex });
    }
  }

  return edges;
}

function createTorusDisplayEdges(dimensions: {
  readonly majorRadius: number;
  readonly minorRadius: number;
}): readonly RenderEdgeSegment[] {
  const segmentCount = 32;
  const edges: RenderEdgeSegment[] = [];

  for (const radius of [
    dimensions.majorRadius,
    dimensions.majorRadius + dimensions.minorRadius,
    dimensions.majorRadius - dimensions.minorRadius
  ]) {
    for (let index = 0; index < segmentCount; index += 1) {
      edges.push({
        start: cylinderPoint(radius, 0, index),
        end: cylinderPoint(radius, 0, (index + 1) % segmentCount)
      });
    }
  }

  for (const sectionAngle of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
    for (let index = 0; index < 16; index += 1) {
      edges.push({
        start: torusCrossSectionPoint(dimensions, sectionAngle, index),
        end: torusCrossSectionPoint(dimensions, sectionAngle, (index + 1) % 16)
      });
    }
  }

  return edges;
}

function spherePoint(
  radius: number,
  plane: "xy" | "xz" | "yz",
  index: number
): Vec3 {
  const angle = (index / 32) * Math.PI * 2;
  const first = cleanRenderNumber(Math.cos(angle) * radius);
  const second = cleanRenderNumber(Math.sin(angle) * radius);

  switch (plane) {
    case "xy":
      return [first, second, 0];
    case "xz":
      return [first, 0, second];
    case "yz":
      return [0, first, second];
  }
}

function torusCrossSectionPoint(
  dimensions: { readonly majorRadius: number; readonly minorRadius: number },
  sectionAngle: number,
  index: number
): Vec3 {
  const angle = (index / 16) * Math.PI * 2;
  const radial =
    dimensions.majorRadius + Math.cos(angle) * dimensions.minorRadius;
  return [
    cleanRenderNumber(Math.cos(sectionAngle) * radial),
    cleanRenderNumber(Math.sin(sectionAngle) * radial),
    cleanRenderNumber(Math.sin(angle) * dimensions.minorRadius)
  ];
}

function cylinderPoint(radius: number, z: number, index: number): Vec3 {
  const angle = (index / 32) * Math.PI * 2;
  return [
    cleanRenderNumber(Math.cos(angle) * radius),
    cleanRenderNumber(Math.sin(angle) * radius),
    z
  ];
}

function cleanRenderNumber(value: number): number {
  const rounded = Math.round(value * 1e12) / 1e12;
  return Object.is(rounded, -0) ? 0 : rounded;
}
