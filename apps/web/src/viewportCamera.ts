import {
  createDefaultCamera,
  type RenderCamera,
  type RenderPrimitive,
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
  const { scale, translation } = primitive.transform;

  if (primitive.kind === "box") {
    const halfExtents: Vec3 = [
      (primitive.dimensions.width * Math.abs(scale[0])) / 2,
      (primitive.dimensions.depth * Math.abs(scale[1])) / 2,
      (primitive.dimensions.height * Math.abs(scale[2])) / 2
    ];

    return boundsFromCenter(translation, halfExtents);
  }

  if (primitive.kind === "sphere") {
    const halfExtents: Vec3 = [
      primitive.dimensions.radius * Math.abs(scale[0]),
      primitive.dimensions.radius * Math.abs(scale[1]),
      primitive.dimensions.radius * Math.abs(scale[2])
    ];

    return boundsFromCenter(translation, halfExtents);
  }

  if (primitive.kind === "torus") {
    const outerRadius =
      primitive.dimensions.majorRadius + primitive.dimensions.minorRadius;
    const halfExtents: Vec3 = [
      outerRadius * Math.abs(scale[0]),
      outerRadius * Math.abs(scale[1]),
      primitive.dimensions.minorRadius * Math.abs(scale[2])
    ];

    return boundsFromCenter(translation, halfExtents);
  }

  const halfExtents: Vec3 = [
    primitive.dimensions.radius * Math.abs(scale[0]),
    primitive.dimensions.radius * Math.abs(scale[1]),
    (primitive.dimensions.height * Math.abs(scale[2])) / 2
  ];

  return boundsFromCenter(translation, halfExtents);
}

function getMeshBounds(
  mesh: RenderTriangleMesh
): RenderSceneBounds | undefined {
  let bounds: MutableBounds | undefined;

  for (const vertex of mesh.vertices) {
    bounds = includePoint(bounds, [
      mesh.transform.translation[0] + vertex[0] * mesh.transform.scale[0],
      mesh.transform.translation[1] + vertex[1] * mesh.transform.scale[1],
      mesh.transform.translation[2] + vertex[2] * mesh.transform.scale[2]
    ]);
  }

  return bounds;
}

function boundsFromCenter(center: Vec3, halfExtents: Vec3): RenderSceneBounds {
  return {
    min: [
      center[0] - halfExtents[0],
      center[1] - halfExtents[1],
      center[2] - halfExtents[2]
    ],
    max: [
      center[0] + halfExtents[0],
      center[1] + halfExtents[1],
      center[2] + halfExtents[2]
    ]
  };
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
