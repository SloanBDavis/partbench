import type { SceneObject } from "@web-cad/cad-core";
import type {
  RenderEdgeSegment,
  RenderPrimitive,
  RenderTriangleMesh,
  Vec3
} from "@web-cad/renderer";
import type { DerivedGeometryEntry } from "./derivedGeometry";

export interface RenderSceneInputs {
  readonly primitives: readonly RenderPrimitive[];
  readonly meshes: readonly RenderTriangleMesh[];
}

export function createRenderSceneInputs(
  objects: readonly SceneObject[],
  derivedGeometryByObjectId: ReadonlyMap<string, DerivedGeometryEntry>
): RenderSceneInputs {
  const primitives: RenderPrimitive[] = [];
  const meshes: RenderTriangleMesh[] = [];

  for (const object of objects) {
    const derivedGeometry = derivedGeometryByObjectId.get(object.id);

    if (derivedGeometry?.status === "ready") {
      meshes.push(addMeshDisplayEdges(derivedGeometry.mesh, object));
      continue;
    }

    primitives.push(toRenderPrimitive(object));
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

  return {
    id: object.id,
    kind: "cylinder",
    dimensions: object.dimensions,
    transform: object.transform
  };
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
