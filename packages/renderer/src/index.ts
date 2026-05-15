export interface PackageInfo {
  readonly name: string;
  readonly status: "ready";
}

export type Vec2 = readonly [number, number];
export type Vec3 = readonly [number, number, number];

export interface RenderTransform {
  readonly translation: Vec3;
  readonly rotation: Vec3;
  readonly scale: Vec3;
}

export interface RenderBoxPrimitive {
  readonly id: string;
  readonly kind: "box";
  readonly dimensions: {
    readonly width: number;
    readonly height: number;
    readonly depth: number;
  };
  readonly transform: RenderTransform;
}

export interface RenderCylinderPrimitive {
  readonly id: string;
  readonly kind: "cylinder";
  readonly dimensions: {
    readonly radius: number;
    readonly height: number;
  };
  readonly transform: RenderTransform;
}

export type RenderPrimitive = RenderBoxPrimitive | RenderCylinderPrimitive;

export interface RenderTriangleMesh {
  readonly id: string;
  readonly kind: "mesh";
  readonly vertices: readonly Vec3[];
  readonly indices: readonly number[];
  readonly transform: RenderTransform;
  readonly source?: string;
  readonly label?: string;
}

export interface RenderCamera {
  readonly target: Vec3;
  readonly yaw: number;
  readonly pitch: number;
  readonly distance: number;
}

export interface ViewportSize {
  readonly width: number;
  readonly height: number;
}

export interface ViewportPoint {
  readonly x: number;
  readonly y: number;
}

export interface ProjectedPoint {
  readonly x: number;
  readonly y: number;
  readonly depth: number;
}

export interface RenderSceneOptions {
  readonly primitives: readonly RenderPrimitive[];
  readonly meshes?: readonly RenderTriangleMesh[];
  readonly camera: RenderCamera;
  readonly size: ViewportSize;
  readonly selectedId?: string;
}

export const rendererPackage: PackageInfo = {
  name: "@web-cad/renderer",
  status: "ready"
};

const MIN_PITCH = -Math.PI / 2 + 0.1;
const MAX_PITCH = Math.PI / 2 - 0.1;
const MIN_DISTANCE = 2;
const MAX_DISTANCE = 500;
const FOCAL_LENGTH = 700;

export function createDefaultCamera(): RenderCamera {
  return {
    target: [0, 0, 0],
    yaw: Math.PI / 4,
    pitch: -Math.PI / 6,
    distance: 18
  };
}

export function orbitCamera(
  camera: RenderCamera,
  delta: ViewportPoint
): RenderCamera {
  return {
    ...camera,
    yaw: camera.yaw - delta.x * 0.01,
    pitch: clamp(camera.pitch - delta.y * 0.01, MIN_PITCH, MAX_PITCH)
  };
}

export function panCamera(
  camera: RenderCamera,
  delta: ViewportPoint,
  size: ViewportSize
): RenderCamera {
  const scale = camera.distance / Math.max(size.height, 1);
  const right = getCameraRight(camera);
  const up = getCameraUp(camera);
  const target = addVec3(
    camera.target,
    addVec3(scaleVec3(right, -delta.x * scale), scaleVec3(up, delta.y * scale))
  );

  return {
    ...camera,
    target
  };
}

export function zoomCamera(camera: RenderCamera, deltaY: number): RenderCamera {
  return {
    ...camera,
    distance: clamp(
      camera.distance * Math.exp(deltaY * 0.001),
      MIN_DISTANCE,
      MAX_DISTANCE
    )
  };
}

export function projectPoint(
  point: Vec3,
  camera: RenderCamera,
  size: ViewportSize
): ProjectedPoint | undefined {
  const cameraPosition = getCameraPosition(camera);
  const viewPoint = worldToCamera(point, camera, cameraPosition);
  const depth = -viewPoint[2];

  if (depth <= 0.1) {
    return undefined;
  }

  return {
    x: size.width / 2 + (viewPoint[0] * FOCAL_LENGTH) / depth,
    y: size.height / 2 - (viewPoint[1] * FOCAL_LENGTH) / depth,
    depth
  };
}

export function pickPrimitive(
  primitives: readonly RenderPrimitive[],
  camera: RenderCamera,
  size: ViewportSize,
  point: ViewportPoint
): string | undefined {
  return pickRenderScene(primitives, [], camera, size, point);
}

export function pickRenderScene(
  primitives: readonly RenderPrimitive[],
  meshes: readonly RenderTriangleMesh[],
  camera: RenderCamera,
  size: ViewportSize,
  point: ViewportPoint
): string | undefined {
  const primitiveCandidates = primitives.map((primitive) =>
    createPickCandidate(
      primitive.id,
      getProjectedPrimitiveBounds(primitive, camera, size),
      point
    )
  );
  const meshCandidates = meshes.map((mesh) =>
    createPickCandidate(
      mesh.id,
      getProjectedMeshBounds(mesh, camera, size),
      point
    )
  );

  const candidates = [...primitiveCandidates, ...meshCandidates]
    .filter((candidate): candidate is { id: string; depth: number } =>
      Boolean(candidate)
    )
    .sort((left, right) => left.depth - right.depth);

  return candidates[0]?.id;
}

export function renderCanvasScene(
  context: CanvasRenderingContext2D,
  options: RenderSceneOptions
): void {
  const { camera, primitives, selectedId, size } = options;
  const meshes = options.meshes ?? [];
  context.clearRect(0, 0, size.width, size.height);
  drawGrid(context, camera, size);

  const sorted = primitives
    .map((primitive) => ({
      primitive,
      depth: getPrimitiveDepth(primitive, camera)
    }))
    .sort((left, right) => right.depth - left.depth);

  for (const { primitive } of sorted.filter(
    (entry) => entry.primitive.id !== selectedId
  )) {
    drawPrimitive(context, primitive, camera, size, false);
  }

  for (const mesh of meshes.filter((mesh) => mesh.id !== selectedId)) {
    drawTriangleMesh(context, mesh, camera, size, mesh.id === selectedId);
  }

  for (const { primitive } of sorted.filter(
    (entry) => entry.primitive.id === selectedId
  )) {
    drawPrimitive(context, primitive, camera, size, true);
  }

  for (const mesh of meshes.filter((mesh) => mesh.id === selectedId)) {
    drawTriangleMesh(context, mesh, camera, size, true);
  }
}

function drawPrimitive(
  context: CanvasRenderingContext2D,
  primitive: RenderPrimitive,
  camera: RenderCamera,
  size: ViewportSize,
  selected: boolean
): void {
  if (primitive.kind === "box") {
    drawBox(context, primitive, camera, size, selected);
  } else {
    drawCylinder(context, primitive, camera, size, selected);
  }
}

function drawGrid(
  context: CanvasRenderingContext2D,
  camera: RenderCamera,
  size: ViewportSize
): void {
  context.save();
  context.strokeStyle = "#d8dde4";
  context.lineWidth = 1;

  for (let i = -10; i <= 10; i += 1) {
    strokeProjectedLine(context, camera, size, [i, -10, 0], [i, 10, 0]);
    strokeProjectedLine(context, camera, size, [-10, i, 0], [10, i, 0]);
  }

  context.strokeStyle = "#9aa7b5";
  strokeProjectedLine(context, camera, size, [-10, 0, 0], [10, 0, 0]);
  strokeProjectedLine(context, camera, size, [0, -10, 0], [0, 10, 0]);
  context.restore();
}

function drawBox(
  context: CanvasRenderingContext2D,
  primitive: RenderBoxPrimitive,
  camera: RenderCamera,
  size: ViewportSize,
  selected: boolean
): void {
  const vertices = getBoxVertices(primitive);
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

  context.save();
  context.strokeStyle = selected ? "#f2a541" : "#2f6f97";
  context.lineWidth = selected ? 3 : 2;
  context.fillStyle = selected
    ? "rgb(242 165 65 / 14%)"
    : "rgb(47 111 151 / 10%)";
  fillProjectedFace(context, camera, size, [
    vertices[4],
    vertices[5],
    vertices[6],
    vertices[7]
  ]);

  for (const [start, end] of edges) {
    strokeProjectedLine(context, camera, size, vertices[start], vertices[end]);
  }

  context.restore();
}

function drawCylinder(
  context: CanvasRenderingContext2D,
  primitive: RenderCylinderPrimitive,
  camera: RenderCamera,
  size: ViewportSize,
  selected: boolean
): void {
  const segments = getCylinderSegments(primitive);

  context.save();
  context.strokeStyle = selected ? "#f2a541" : "#6f8c3a";
  context.lineWidth = selected ? 3 : 2;

  for (let index = 0; index < segments.top.length; index += 1) {
    const nextIndex = (index + 1) % segments.top.length;
    strokeProjectedLine(
      context,
      camera,
      size,
      segments.top[index],
      segments.top[nextIndex]
    );
    strokeProjectedLine(
      context,
      camera,
      size,
      segments.bottom[index],
      segments.bottom[nextIndex]
    );

    if (index % 4 === 0) {
      strokeProjectedLine(
        context,
        camera,
        size,
        segments.top[index],
        segments.bottom[index]
      );
    }
  }

  context.restore();
}

function drawTriangleMesh(
  context: CanvasRenderingContext2D,
  mesh: RenderTriangleMesh,
  camera: RenderCamera,
  size: ViewportSize,
  selected: boolean
): void {
  const vertices = mesh.vertices.map((vertex) =>
    transformPoint(vertex, mesh.transform)
  );
  const edges = getMeshEdges(mesh.indices);

  context.save();
  context.lineJoin = "round";
  context.lineCap = "round";

  if (selected) {
    context.fillStyle = "rgba(242, 165, 65, 0.16)";

    for (let index = 0; index + 2 < mesh.indices.length; index += 3) {
      const first = vertices[mesh.indices[index]];
      const second = vertices[mesh.indices[index + 1]];
      const third = vertices[mesh.indices[index + 2]];

      if (first && second && third) {
        fillProjectedFace(context, camera, size, [first, second, third]);
      }
    }

    context.strokeStyle = "rgba(242, 165, 65, 0.34)";
    context.lineWidth = 6;

    for (const [start, end] of edges) {
      strokeProjectedLine(
        context,
        camera,
        size,
        vertices[start],
        vertices[end]
      );
    }
  }

  context.strokeStyle = selected ? "#f2a541" : "#8a5a16";
  context.lineWidth = selected ? 2.5 : 1.5;

  for (const [start, end] of edges) {
    strokeProjectedLine(context, camera, size, vertices[start], vertices[end]);
  }

  context.restore();
}

function strokeProjectedLine(
  context: CanvasRenderingContext2D,
  camera: RenderCamera,
  size: ViewportSize,
  start: Vec3,
  end: Vec3
): void {
  const projectedStart = projectPoint(start, camera, size);
  const projectedEnd = projectPoint(end, camera, size);

  if (!projectedStart || !projectedEnd) {
    return;
  }

  context.beginPath();
  context.moveTo(projectedStart.x, projectedStart.y);
  context.lineTo(projectedEnd.x, projectedEnd.y);
  context.stroke();
}

function fillProjectedFace(
  context: CanvasRenderingContext2D,
  camera: RenderCamera,
  size: ViewportSize,
  points: readonly Vec3[]
): void {
  const projected = points
    .map((point) => projectPoint(point, camera, size))
    .filter((point): point is ProjectedPoint => Boolean(point));

  if (projected.length !== points.length) {
    return;
  }

  context.beginPath();
  context.moveTo(projected[0].x, projected[0].y);

  for (const point of projected.slice(1)) {
    context.lineTo(point.x, point.y);
  }

  context.closePath();
  context.fill();
}

function createPickCandidate(
  id: string,
  bounds:
    | {
        minX: number;
        maxX: number;
        minY: number;
        maxY: number;
        depth: number;
      }
    | undefined,
  point: ViewportPoint
): { id: string; depth: number } | undefined {
  if (!bounds || !containsPoint(bounds, point)) {
    return undefined;
  }

  return {
    id,
    depth: bounds.depth
  };
}

function getProjectedPrimitiveBounds(
  primitive: RenderPrimitive,
  camera: RenderCamera,
  size: ViewportSize
):
  | {
      minX: number;
      maxX: number;
      minY: number;
      maxY: number;
      depth: number;
    }
  | undefined {
  const points =
    primitive.kind === "box"
      ? getBoxVertices(primitive)
      : [
          ...getCylinderSegments(primitive).top,
          ...getCylinderSegments(primitive).bottom
        ];
  const projected = points
    .map((point) => projectPoint(point, camera, size))
    .filter((point): point is ProjectedPoint => Boolean(point));

  if (projected.length === 0) {
    return undefined;
  }

  const xs = projected.map((point) => point.x);
  const ys = projected.map((point) => point.y);
  const depths = projected.map((point) => point.depth);

  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
    depth: Math.min(...depths)
  };
}

function getProjectedMeshBounds(
  mesh: RenderTriangleMesh,
  camera: RenderCamera,
  size: ViewportSize
):
  | {
      minX: number;
      maxX: number;
      minY: number;
      maxY: number;
      depth: number;
    }
  | undefined {
  const projected = mesh.vertices
    .map((point) =>
      projectPoint(transformPoint(point, mesh.transform), camera, size)
    )
    .filter((point): point is ProjectedPoint => Boolean(point));

  if (projected.length === 0) {
    return undefined;
  }

  const xs = projected.map((point) => point.x);
  const ys = projected.map((point) => point.y);
  const depths = projected.map((point) => point.depth);

  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
    depth: Math.min(...depths)
  };
}

function containsPoint(
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  point: ViewportPoint
): boolean {
  const padding = 6;
  return (
    point.x >= bounds.minX - padding &&
    point.x <= bounds.maxX + padding &&
    point.y >= bounds.minY - padding &&
    point.y <= bounds.maxY + padding
  );
}

function getPrimitiveDepth(
  primitive: RenderPrimitive,
  camera: RenderCamera
): number {
  const center = primitive.transform.translation;
  const cameraPosition = getCameraPosition(camera);
  return lengthVec3(subtractVec3(center, cameraPosition));
}

function getBoxVertices(primitive: RenderBoxPrimitive): Vec3[] {
  const { depth, height, width } = primitive.dimensions;
  const scale = primitive.transform.scale;
  const halfX = (width * scale[0]) / 2;
  const halfY = (height * scale[1]) / 2;
  const halfZ = (depth * scale[2]) / 2;
  const local: Vec3[] = [
    [-halfX, -halfY, -halfZ],
    [halfX, -halfY, -halfZ],
    [halfX, halfY, -halfZ],
    [-halfX, halfY, -halfZ],
    [-halfX, -halfY, halfZ],
    [halfX, -halfY, halfZ],
    [halfX, halfY, halfZ],
    [-halfX, halfY, halfZ]
  ];

  return local.map((point) => transformPoint(point, primitive.transform));
}

function getCylinderSegments(primitive: RenderCylinderPrimitive): {
  top: Vec3[];
  bottom: Vec3[];
} {
  const segmentCount = 24;
  const radius = primitive.dimensions.radius;
  const scale = primitive.transform.scale;
  const scaledRadiusX = radius * scale[0];
  const scaledRadiusY = radius * scale[1];
  const halfHeight = (primitive.dimensions.height * scale[2]) / 2;
  const top: Vec3[] = [];
  const bottom: Vec3[] = [];

  for (let index = 0; index < segmentCount; index += 1) {
    const angle = (index / segmentCount) * Math.PI * 2;
    const x = Math.cos(angle) * scaledRadiusX;
    const y = Math.sin(angle) * scaledRadiusY;
    top.push(transformPoint([x, y, halfHeight], primitive.transform, false));
    bottom.push(
      transformPoint([x, y, -halfHeight], primitive.transform, false)
    );
  }

  return { top, bottom };
}

function getMeshEdges(
  indices: readonly number[]
): readonly (readonly [number, number])[] {
  const edges = new Map<string, readonly [number, number]>();

  for (let index = 0; index + 2 < indices.length; index += 3) {
    addMeshEdge(edges, indices[index], indices[index + 1]);
    addMeshEdge(edges, indices[index + 1], indices[index + 2]);
    addMeshEdge(edges, indices[index + 2], indices[index]);
  }

  return [...edges.values()];
}

function addMeshEdge(
  edges: Map<string, readonly [number, number]>,
  start: number,
  end: number
): void {
  const min = Math.min(start, end);
  const max = Math.max(start, end);
  const key = `${min}:${max}`;

  if (!edges.has(key)) {
    edges.set(key, [min, max]);
  }
}

function transformPoint(
  point: Vec3,
  transform: RenderTransform,
  includeScale = true
): Vec3 {
  const scaled: Vec3 = includeScale
    ? [
        point[0] * transform.scale[0],
        point[1] * transform.scale[1],
        point[2] * transform.scale[2]
      ]
    : point;
  return addVec3(
    rotateEuler(scaled, transform.rotation),
    transform.translation
  );
}

function getCameraPosition(camera: RenderCamera): Vec3 {
  const x =
    camera.target[0] +
    camera.distance * Math.cos(camera.pitch) * Math.sin(camera.yaw);
  const y =
    camera.target[1] -
    camera.distance * Math.cos(camera.pitch) * Math.cos(camera.yaw);
  const z = camera.target[2] + camera.distance * Math.sin(camera.pitch);
  return [x, y, z];
}

function worldToCamera(
  point: Vec3,
  camera: RenderCamera,
  cameraPosition: Vec3
): Vec3 {
  const forward = normalizeVec3(subtractVec3(camera.target, cameraPosition));
  const right = normalizeVec3(crossVec3(forward, [0, 0, 1]));
  const up = normalizeVec3(crossVec3(right, forward));
  const relative = subtractVec3(point, cameraPosition);
  return [
    dotVec3(relative, right),
    dotVec3(relative, up),
    -dotVec3(relative, forward)
  ];
}

function getCameraRight(camera: RenderCamera): Vec3 {
  const position = getCameraPosition(camera);
  const forward = normalizeVec3(subtractVec3(camera.target, position));
  return normalizeVec3(crossVec3(forward, [0, 0, 1]));
}

function getCameraUp(camera: RenderCamera): Vec3 {
  const position = getCameraPosition(camera);
  const forward = normalizeVec3(subtractVec3(camera.target, position));
  const right = getCameraRight(camera);
  return normalizeVec3(crossVec3(right, forward));
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

function addVec3(left: Vec3, right: Vec3): Vec3 {
  return [left[0] + right[0], left[1] + right[1], left[2] + right[2]];
}

function subtractVec3(left: Vec3, right: Vec3): Vec3 {
  return [left[0] - right[0], left[1] - right[1], left[2] - right[2]];
}

function scaleVec3(vector: Vec3, scale: number): Vec3 {
  return [vector[0] * scale, vector[1] * scale, vector[2] * scale];
}

function dotVec3(left: Vec3, right: Vec3): number {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

function crossVec3(left: Vec3, right: Vec3): Vec3 {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0]
  ];
}

function lengthVec3(vector: Vec3): number {
  return Math.hypot(vector[0], vector[1], vector[2]);
}

function normalizeVec3(vector: Vec3): Vec3 {
  const length = lengthVec3(vector);

  if (length === 0) {
    return [0, 0, 0];
  }

  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
