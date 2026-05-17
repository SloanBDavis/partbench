import {
  createDefaultCamera,
  type RenderCamera,
  type RenderPrimitive,
  type RenderTransform,
  type RenderTriangleMesh,
  type Vec3
} from "@web-cad/renderer";

export interface RenderSceneBounds {
  readonly min: Vec3;
  readonly max: Vec3;
}

export function fitCameraToRenderScene(
  camera: RenderCamera,
  primitives: readonly RenderPrimitive[],
  meshes: readonly RenderTriangleMesh[] = []
): RenderCamera {
  const bounds = getRenderSceneBounds(primitives, meshes);

  if (!bounds) {
    return createDefaultCamera();
  }

  return fitCameraToBounds(camera, bounds);
}

export function fitCameraToRenderObject(
  camera: RenderCamera,
  objectId: string | undefined,
  primitives: readonly RenderPrimitive[],
  meshes: readonly RenderTriangleMesh[] = []
): RenderCamera {
  if (!objectId) {
    return camera;
  }

  const bounds = getRenderObjectBounds(objectId, primitives, meshes);

  return bounds ? fitCameraToBounds(camera, bounds) : camera;
}

export function getRenderObjectBounds(
  objectId: string,
  primitives: readonly RenderPrimitive[],
  meshes: readonly RenderTriangleMesh[] = []
): RenderSceneBounds | undefined {
  for (const primitive of primitives) {
    if (primitive.id === objectId) {
      return getPrimitiveBounds(primitive);
    }
  }

  for (const mesh of meshes) {
    if (mesh.id === objectId) {
      return getMeshBounds(mesh);
    }
  }

  return undefined;
}

function fitCameraToBounds(
  camera: RenderCamera,
  bounds: RenderSceneBounds
): RenderCamera {
  const center: Vec3 = [
    (bounds.min[0] + bounds.max[0]) / 2,
    (bounds.min[1] + bounds.max[1]) / 2,
    (bounds.min[2] + bounds.max[2]) / 2
  ];
  const extents: Vec3 = [
    bounds.max[0] - bounds.min[0],
    bounds.max[1] - bounds.min[1],
    bounds.max[2] - bounds.min[2]
  ];
  const radius = Math.hypot(extents[0], extents[1], extents[2]) / 2;

  return {
    ...camera,
    target: center,
    distance: Math.max(6, radius * 3.2)
  };
}

export function getRenderSceneBounds(
  primitives: readonly RenderPrimitive[],
  meshes: readonly RenderTriangleMesh[] = []
): RenderSceneBounds | undefined {
  let bounds: MutableBounds | undefined;

  for (const primitive of primitives) {
    bounds = includeBounds(bounds, getPrimitiveBounds(primitive));
  }

  for (const mesh of meshes) {
    const meshBounds = getMeshBounds(mesh);

    if (meshBounds) {
      bounds = includeBounds(bounds, meshBounds);
    }
  }

  return bounds;
}

function getPrimitiveBounds(primitive: RenderPrimitive): RenderSceneBounds {
  if (primitive.kind === "box") {
    return getTransformedExtentsBounds(primitive.transform, [
      primitive.dimensions.width / 2,
      primitive.dimensions.height / 2,
      primitive.dimensions.depth / 2
    ]);
  }

  if (primitive.kind === "sphere") {
    return getTransformedExtentsBounds(primitive.transform, [
      primitive.dimensions.radius,
      primitive.dimensions.radius,
      primitive.dimensions.radius
    ]);
  }

  if (primitive.kind === "torus") {
    const outerRadius =
      primitive.dimensions.majorRadius + primitive.dimensions.minorRadius;
    return getTransformedExtentsBounds(primitive.transform, [
      outerRadius,
      outerRadius,
      primitive.dimensions.minorRadius
    ]);
  }

  return getTransformedExtentsBounds(primitive.transform, [
    primitive.dimensions.radius,
    primitive.dimensions.radius,
    primitive.dimensions.height / 2
  ]);
}

function getMeshBounds(
  mesh: RenderTriangleMesh
): RenderSceneBounds | undefined {
  let bounds: MutableBounds | undefined;

  for (const vertex of mesh.vertices) {
    bounds = includePoint(bounds, transformPoint(vertex, mesh.transform));
  }

  for (const segment of mesh.edgeSegments ?? []) {
    bounds = includePoint(
      bounds,
      transformPoint(segment.start, mesh.transform)
    );
    bounds = includePoint(bounds, transformPoint(segment.end, mesh.transform));
  }

  return bounds;
}

function getTransformedExtentsBounds(
  transform: RenderTransform,
  halfExtents: Vec3
): RenderSceneBounds {
  let bounds: MutableBounds | undefined;

  for (const x of [-halfExtents[0], halfExtents[0]]) {
    for (const y of [-halfExtents[1], halfExtents[1]]) {
      for (const z of [-halfExtents[2], halfExtents[2]]) {
        bounds = includePoint(bounds, transformPoint([x, y, z], transform));
      }
    }
  }

  return bounds ?? { min: transform.translation, max: transform.translation };
}

interface MutableBounds {
  min: Vec3;
  max: Vec3;
}

function includeBounds(
  target: MutableBounds | undefined,
  bounds: RenderSceneBounds
): MutableBounds {
  return includePoint(includePoint(target, bounds.min), bounds.max);
}

function includePoint(
  bounds: MutableBounds | undefined,
  point: Vec3
): MutableBounds {
  if (!bounds) {
    return {
      min: point,
      max: point
    };
  }

  return {
    min: [
      Math.min(bounds.min[0], point[0]),
      Math.min(bounds.min[1], point[1]),
      Math.min(bounds.min[2], point[2])
    ],
    max: [
      Math.max(bounds.max[0], point[0]),
      Math.max(bounds.max[1], point[1]),
      Math.max(bounds.max[2], point[2])
    ]
  };
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
