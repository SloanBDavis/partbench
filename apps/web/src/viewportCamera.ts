import {
  createDefaultCamera,
  type RenderCamera,
  type RenderPrimitive,
  type RenderTransform,
  type RenderTriangleMesh,
  zoomCamera,
  type Vec3
} from "@web-cad/renderer";

export interface RenderSceneBounds {
  readonly min: Vec3;
  readonly max: Vec3;
}

export type ViewportStandardViewId = "top" | "front" | "right" | "isometric";

export interface ViewportStandardView {
  readonly id: ViewportStandardViewId;
  readonly label: string;
  readonly title: string;
  readonly yaw: number;
  readonly pitch: number;
}

export type ViewportCameraAction =
  | { readonly type: "fitAll" }
  | {
      readonly type: "fitSelection";
      readonly selectedRenderId?: string;
      readonly fallbackRenderId?: string;
    }
  | { readonly type: "reset" }
  | { readonly type: "standardView"; readonly viewId: ViewportStandardViewId }
  | { readonly type: "zoom"; readonly deltaY: number };

export type ViewportCameraActionStatus =
  | "applied"
  | "fallback-default"
  | "unchanged";

export type ViewportCameraActionSource =
  | "default"
  | "scene"
  | "selection"
  | "selectionFallback"
  | "standardView"
  | "none"
  | "zoom";

export interface ViewportCameraActionResult {
  readonly camera: RenderCamera;
  readonly status: ViewportCameraActionStatus;
  readonly source: ViewportCameraActionSource;
  readonly bounds?: RenderSceneBounds;
  readonly viewId?: ViewportStandardViewId;
}

const TOP_VIEW_PITCH = Math.PI / 2 - 0.1;

export const VIEWPORT_STANDARD_VIEWS: readonly ViewportStandardView[] = [
  {
    id: "top",
    label: "Top",
    title: "Top view",
    yaw: 0,
    pitch: TOP_VIEW_PITCH
  },
  {
    id: "front",
    label: "Front",
    title: "Front view",
    yaw: 0,
    pitch: 0
  },
  {
    id: "right",
    label: "Right",
    title: "Right view",
    yaw: Math.PI / 2,
    pitch: 0
  },
  {
    id: "isometric",
    label: "Iso",
    title: "Isometric view",
    yaw: createDefaultCamera().yaw,
    pitch: createDefaultCamera().pitch
  }
];

export function applyViewportCameraAction(
  camera: RenderCamera,
  action: ViewportCameraAction,
  scene: {
    readonly primitives: readonly RenderPrimitive[];
    readonly meshes?: readonly RenderTriangleMesh[];
  }
): ViewportCameraActionResult {
  const meshes = scene.meshes ?? [];

  if (action.type === "fitAll") {
    const bounds = getRenderSceneBounds(scene.primitives, meshes);

    if (!bounds) {
      return {
        camera: createDefaultCamera(),
        status: "fallback-default",
        source: "default"
      };
    }

    return {
      camera: fitCameraToBounds(camera, bounds),
      status: "applied",
      source: "scene",
      bounds
    };
  }

  if (action.type === "fitSelection") {
    const selectedBounds = action.selectedRenderId
      ? getRenderObjectBounds(action.selectedRenderId, scene.primitives, meshes)
      : undefined;

    if (selectedBounds) {
      return {
        camera: fitCameraToBounds(camera, selectedBounds),
        status: "applied",
        source: "selection",
        bounds: selectedBounds
      };
    }

    const fallbackBounds =
      action.fallbackRenderId &&
      action.fallbackRenderId !== action.selectedRenderId
        ? getRenderObjectBounds(
            action.fallbackRenderId,
            scene.primitives,
            meshes
          )
        : undefined;

    if (fallbackBounds) {
      return {
        camera: fitCameraToBounds(camera, fallbackBounds),
        status: "applied",
        source: "selectionFallback",
        bounds: fallbackBounds
      };
    }

    return {
      camera,
      status: "unchanged",
      source: "none"
    };
  }

  if (action.type === "reset") {
    return {
      camera: createDefaultCamera(),
      status: "applied",
      source: "default"
    };
  }

  if (action.type === "standardView") {
    const standardView = getViewportStandardView(action.viewId);

    return {
      camera: {
        ...camera,
        yaw: standardView.yaw,
        pitch: standardView.pitch
      },
      status: "applied",
      source: "standardView",
      viewId: standardView.id
    };
  }

  return {
    camera: zoomCamera(camera, action.deltaY),
    status: "applied",
    source: "zoom"
  };
}

export function getViewportStandardView(
  viewId: ViewportStandardViewId
): ViewportStandardView {
  return (
    VIEWPORT_STANDARD_VIEWS.find(
      (standardView) => standardView.id === viewId
    ) ?? VIEWPORT_STANDARD_VIEWS[VIEWPORT_STANDARD_VIEWS.length - 1]
  );
}

export function fitCameraToRenderScene(
  camera: RenderCamera,
  primitives: readonly RenderPrimitive[],
  meshes: readonly RenderTriangleMesh[] = []
): RenderCamera {
  return applyViewportCameraAction(
    camera,
    { type: "fitAll" },
    {
      primitives,
      meshes
    }
  ).camera;
}

export function fitCameraToRenderObject(
  camera: RenderCamera,
  objectId: string | undefined,
  primitives: readonly RenderPrimitive[],
  meshes: readonly RenderTriangleMesh[] = []
): RenderCamera {
  return applyViewportCameraAction(
    camera,
    { type: "fitSelection", selectedRenderId: objectId },
    { primitives, meshes }
  ).camera;
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
