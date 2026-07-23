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

export interface RenderSpherePrimitive {
  readonly id: string;
  readonly kind: "sphere";
  readonly dimensions: {
    readonly radius: number;
  };
  readonly transform: RenderTransform;
}

export interface RenderConePrimitive {
  readonly id: string;
  readonly kind: "cone";
  readonly dimensions: {
    readonly radius: number;
    readonly height: number;
  };
  readonly transform: RenderTransform;
}

export interface RenderTorusPrimitive {
  readonly id: string;
  readonly kind: "torus";
  readonly dimensions: {
    readonly majorRadius: number;
    readonly minorRadius: number;
  };
  readonly transform: RenderTransform;
}

export type RenderPrimitive =
  | RenderBoxPrimitive
  | RenderCylinderPrimitive
  | RenderSpherePrimitive
  | RenderConePrimitive
  | RenderTorusPrimitive;

export interface RenderEdgeSegment {
  readonly start: Vec3;
  readonly end: Vec3;
}

export interface RenderTriangleMesh {
  readonly id: string;
  /** Optional renderer-only group used for aggregate visual state and bounds. */
  readonly parentId?: string;
  readonly kind: "mesh";
  readonly vertices: readonly Vec3[];
  readonly indices: readonly number[];
  readonly transform: RenderTransform;
  readonly edgeSegments?: readonly RenderEdgeSegment[];
  /** Use derived display edges as the pick target instead of the mesh bounds. */
  readonly pickMode?: "bounds" | "edgeSegments";
  /** Renderer-only line vocabulary; never source geometry or CAD intent. */
  readonly lineStyle?: "solid" | "construction";
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

export type RenderVisualEntityKind =
  | "body"
  | "face"
  | "edge"
  | "vertex"
  | "object"
  | "sketchEntity";

export type RenderVisualStateKind =
  | "hover"
  | "preselection"
  | "selected"
  | "commandTarget"
  | "warning"
  | "pending"
  | "failed";

export interface RenderVisualStateInput {
  readonly targetId: string;
  readonly targetKind: RenderVisualEntityKind;
  readonly state: RenderVisualStateKind;
}

export interface RenderSceneOptions {
  readonly primitives: readonly RenderPrimitive[];
  readonly meshes?: readonly RenderTriangleMesh[];
  readonly camera: RenderCamera;
  readonly size: ViewportSize;
  readonly selectedId?: string;
  readonly hoveredId?: string;
  readonly visualStates?: readonly RenderVisualStateInput[];
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
    mesh.pickMode === "edgeSegments"
      ? createEdgeSegmentPickCandidate(mesh, camera, size, point)
      : createPickCandidate(
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
  const { camera, primitives, size } = options;
  const meshes = options.meshes ?? [];
  const visualStates = createRenderVisualStateMap(options);
  context.clearRect(0, 0, size.width, size.height);
  drawGrid(context, camera, size);

  const sorted = primitives
    .map((primitive) => ({
      primitive,
      depth: getPrimitiveDepth(primitive, camera)
    }))
    .sort((left, right) => right.depth - left.depth);

  for (const { primitive } of sorted.filter(
    (entry) => !visualStates.has(entry.primitive.id)
  )) {
    drawPrimitive(context, primitive, camera, size, createEmptyVisualStyle());
  }

  for (const mesh of meshes.filter(
    (mesh) => !hasMeshVisualState(mesh, visualStates)
  )) {
    drawTriangleMesh(context, mesh, camera, size, createEmptyVisualStyle());
  }

  for (const { primitive } of sorted.filter((entry) =>
    visualStates.has(entry.primitive.id)
  )) {
    drawPrimitive(
      context,
      primitive,
      camera,
      size,
      visualStates.get(primitive.id) ?? createEmptyVisualStyle()
    );
  }

  for (const mesh of meshes.filter((mesh) =>
    hasMeshVisualState(mesh, visualStates)
  )) {
    drawTriangleMesh(
      context,
      mesh,
      camera,
      size,
      getMeshVisualStyle(mesh, visualStates)
    );
  }
}

function hasMeshVisualState(
  mesh: RenderTriangleMesh,
  visualStates: ReadonlyMap<string, RenderVisualStyle>
): boolean {
  return (
    visualStates.has(mesh.id) ||
    (mesh.parentId !== undefined && visualStates.has(mesh.parentId))
  );
}

function getMeshVisualStyle(
  mesh: RenderTriangleMesh,
  visualStates: ReadonlyMap<string, RenderVisualStyle>
): RenderVisualStyle {
  const entityStyle = visualStates.get(mesh.id);
  const parentStyle = mesh.parentId
    ? visualStates.get(mesh.parentId)
    : undefined;

  if (!entityStyle) {
    return parentStyle ?? createEmptyVisualStyle();
  }

  if (!parentStyle) {
    return entityStyle;
  }

  return {
    hover: entityStyle.hover || parentStyle.hover,
    selected: entityStyle.selected || parentStyle.selected,
    commandTarget: entityStyle.commandTarget || parentStyle.commandTarget,
    warning: entityStyle.warning || parentStyle.warning,
    pending: entityStyle.pending || parentStyle.pending,
    failed: entityStyle.failed || parentStyle.failed
  };
}

export interface RenderVisualStyle {
  readonly hover: boolean;
  readonly selected: boolean;
  readonly commandTarget: boolean;
  readonly warning: boolean;
  readonly pending: boolean;
  readonly failed: boolean;
}

export function createRenderVisualStateMap({
  hoveredId,
  selectedId,
  visualStates = []
}: Pick<
  RenderSceneOptions,
  "hoveredId" | "selectedId" | "visualStates"
>): ReadonlyMap<string, RenderVisualStyle> {
  const statesByTarget = new Map<string, RenderVisualStyle>();

  if (hoveredId) {
    addRenderVisualState(statesByTarget, hoveredId, "hover");
  }

  if (selectedId) {
    addRenderVisualState(statesByTarget, selectedId, "selected");
  }

  for (const visualState of visualStates) {
    addRenderVisualState(
      statesByTarget,
      visualState.targetId,
      visualState.state
    );
  }

  return statesByTarget;
}

function addRenderVisualState(
  statesByTarget: Map<string, RenderVisualStyle>,
  targetId: string,
  state: RenderVisualStateKind
): void {
  if (!targetId) {
    return;
  }

  const existing = statesByTarget.get(targetId) ?? createEmptyVisualStyle();

  statesByTarget.set(targetId, {
    hover: existing.hover || state === "hover" || state === "preselection",
    selected: existing.selected || state === "selected",
    commandTarget: existing.commandTarget || state === "commandTarget",
    warning: existing.warning || state === "warning",
    pending: existing.pending || state === "pending",
    failed: existing.failed || state === "failed"
  });
}

function createEmptyVisualStyle(): RenderVisualStyle {
  return {
    hover: false,
    selected: false,
    commandTarget: false,
    warning: false,
    pending: false,
    failed: false
  };
}

function drawPrimitive(
  context: CanvasRenderingContext2D,
  primitive: RenderPrimitive,
  camera: RenderCamera,
  size: ViewportSize,
  style: RenderVisualStyle
): void {
  if (primitive.kind === "box") {
    drawBox(context, primitive, camera, size, style);
  } else if (primitive.kind === "cylinder") {
    drawCylinder(context, primitive, camera, size, style);
  } else if (primitive.kind === "sphere") {
    drawSphere(context, primitive, camera, size, style);
  } else if (primitive.kind === "cone") {
    drawCone(context, primitive, camera, size, style);
  } else {
    drawTorus(context, primitive, camera, size, style);
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
  style: RenderVisualStyle
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
  context.strokeStyle = getVisualStrokeColor(style, "#2f6f97");
  context.lineWidth = getVisualLineWidth(style, 2);
  context.fillStyle = getVisualFillColor(style, "rgb(47 111 151 / 10%)");
  fillProjectedFace(context, camera, size, vertices.slice(4));

  for (const [start, end] of edges) {
    const startVertex = vertices[start];
    const endVertex = vertices[end];
    if (startVertex && endVertex) {
      strokeProjectedLine(context, camera, size, startVertex, endVertex);
    }
  }

  context.restore();
}

function drawCylinder(
  context: CanvasRenderingContext2D,
  primitive: RenderCylinderPrimitive,
  camera: RenderCamera,
  size: ViewportSize,
  style: RenderVisualStyle
): void {
  const segments = getCylinderSegments(primitive);

  context.save();
  context.strokeStyle = getVisualStrokeColor(style, "#6f8c3a");
  context.lineWidth = getVisualLineWidth(style, 2);

  const firstBottom = segments.bottom[0];
  if (!firstBottom) {
    context.restore();
    return;
  }

  forEachClosedSegment(segments.top, (topStart, topEnd, index) => {
    const bottomStart = segments.bottom[index];
    const bottomEnd = segments.bottom[index + 1] ?? firstBottom;
    if (!bottomStart) {
      return;
    }

    strokeProjectedLine(context, camera, size, topStart, topEnd);
    strokeProjectedLine(context, camera, size, bottomStart, bottomEnd);

    if (index % 4 === 0) {
      strokeProjectedLine(context, camera, size, topStart, bottomStart);
    }
  });

  context.restore();
}

function drawSphere(
  context: CanvasRenderingContext2D,
  primitive: RenderSpherePrimitive,
  camera: RenderCamera,
  size: ViewportSize,
  style: RenderVisualStyle
): void {
  const rings = getSphereSegments(primitive);

  context.save();
  context.strokeStyle = getVisualStrokeColor(style, "#8a4f9f");
  context.lineWidth = getVisualLineWidth(style, 2);

  for (const ring of [rings.xy, rings.xz, rings.yz]) {
    forEachClosedSegment(ring, (start, end) => {
      strokeProjectedLine(context, camera, size, start, end);
    });
  }

  context.restore();
}

function drawCone(
  context: CanvasRenderingContext2D,
  primitive: RenderConePrimitive,
  camera: RenderCamera,
  size: ViewportSize,
  style: RenderVisualStyle
): void {
  const segments = getConeSegments(primitive);

  context.save();
  context.strokeStyle = getVisualStrokeColor(style, "#a35f2a");
  context.lineWidth = getVisualLineWidth(style, 2);

  forEachClosedSegment(segments.base, (start, end, index) => {
    strokeProjectedLine(context, camera, size, start, end);

    if (index % 4 === 0) {
      strokeProjectedLine(context, camera, size, start, segments.apex);
    }
  });

  context.restore();
}

function drawTorus(
  context: CanvasRenderingContext2D,
  primitive: RenderTorusPrimitive,
  camera: RenderCamera,
  size: ViewportSize,
  style: RenderVisualStyle
): void {
  const rings = getTorusSegments(primitive);

  context.save();
  context.strokeStyle = getVisualStrokeColor(style, "#28756a");
  context.lineWidth = getVisualLineWidth(style, 2);

  for (const ring of [rings.center, rings.outer, rings.inner]) {
    forEachClosedSegment(ring, (start, end) => {
      strokeProjectedLine(context, camera, size, start, end);
    });
  }

  for (const crossSection of rings.crossSections) {
    forEachClosedSegment(crossSection, (start, end) => {
      strokeProjectedLine(context, camera, size, start, end);
    });
  }

  context.restore();
}

function drawTriangleMesh(
  context: CanvasRenderingContext2D,
  mesh: RenderTriangleMesh,
  camera: RenderCamera,
  size: ViewportSize,
  style: RenderVisualStyle
): void {
  const vertices = mesh.vertices.map((vertex) =>
    transformPoint(vertex, mesh.transform)
  );
  const displayEdges = mesh.edgeSegments ?? [];
  const outline =
    displayEdges.length === 0
      ? createProjectedMeshOutline(vertices, camera, size)
      : [];

  context.save();
  context.lineJoin = "round";
  context.lineCap = "round";

  if (mesh.lineStyle === "construction") {
    context.setLineDash([5, 4]);
  }

  context.fillStyle = getVisualFillColor(style, "rgba(47, 111, 151, 0.08)");
  drawMeshFaces(context, mesh.indices, vertices, camera, size);

  if (style.selected && displayEdges.length > 0) {
    context.strokeStyle = getVisualSoftStrokeColor(
      style,
      "rgba(242, 165, 65, 0.42)"
    );
    context.lineWidth = 7;
    strokeMeshEdgeSegments(context, mesh, displayEdges, camera, size);
  }

  if (displayEdges.length > 0) {
    context.strokeStyle = getVisualStrokeColor(
      style,
      mesh.lineStyle === "construction" ? "#6f7c86" : "#235f86"
    );
    context.lineWidth = getVisualLineWidth(style, 2);
    strokeMeshEdgeSegments(context, mesh, displayEdges, camera, size);
  } else if (style.selected && outline.length > 1) {
    context.strokeStyle = getVisualSoftStrokeColor(
      style,
      "rgba(242, 165, 65, 0.42)"
    );
    context.lineWidth = 7;
    strokeProjectedOutline(context, outline);

    context.strokeStyle = getVisualStrokeColor(style, "#235f86");
    context.lineWidth = getVisualLineWidth(style, 2);
    strokeProjectedOutline(context, outline);
  } else if (outline.length > 1) {
    context.strokeStyle = getVisualSoftStrokeColor(
      style,
      "rgba(53, 75, 91, 0.22)"
    );
    context.lineWidth = 1.25;
    strokeProjectedOutline(context, outline);
  }

  context.restore();
}

function forEachClosedSegment(
  points: readonly Vec3[],
  visit: (start: Vec3, end: Vec3, index: number) => void
): void {
  const first = points[0];
  if (!first) {
    return;
  }

  for (const [index, start] of points.entries()) {
    visit(start, points[index + 1] ?? first, index);
  }
}

function getVisualStrokeColor(
  style: RenderVisualStyle,
  fallback: string
): string {
  if (style.failed) {
    return "#b42318";
  }

  if (style.warning) {
    return "#b7791f";
  }

  if (style.commandTarget) {
    return "#2f855a";
  }

  if (style.selected) {
    return "#f2a541";
  }

  if (style.pending) {
    return "#8b6f2f";
  }

  if (style.hover) {
    return "#188bbf";
  }

  return fallback;
}

function getVisualSoftStrokeColor(
  style: RenderVisualStyle,
  fallback: string
): string {
  if (style.failed) {
    return "rgba(180, 35, 24, 0.32)";
  }

  if (style.warning) {
    return "rgba(183, 121, 31, 0.32)";
  }

  if (style.commandTarget) {
    return "rgba(47, 133, 90, 0.32)";
  }

  if (style.selected) {
    return "rgba(242, 165, 65, 0.34)";
  }

  if (style.pending) {
    return "rgba(139, 111, 47, 0.28)";
  }

  if (style.hover) {
    return "rgba(24, 139, 191, 0.28)";
  }

  return fallback;
}

function getVisualFillColor(
  style: RenderVisualStyle,
  fallback: string
): string {
  if (style.failed) {
    return "rgba(180, 35, 24, 0.14)";
  }

  if (style.warning) {
    return "rgba(183, 121, 31, 0.14)";
  }

  if (style.commandTarget) {
    return "rgba(47, 133, 90, 0.13)";
  }

  if (style.selected) {
    return "rgba(242, 165, 65, 0.16)";
  }

  if (style.pending) {
    return "rgba(139, 111, 47, 0.12)";
  }

  if (style.hover) {
    return "rgba(24, 139, 191, 0.12)";
  }

  return fallback;
}

function getVisualLineWidth(
  style: RenderVisualStyle,
  fallback: number
): number {
  return isVisualActive(style) ? 3 : fallback;
}

function isVisualActive(style: RenderVisualStyle): boolean {
  return (
    style.hover ||
    style.selected ||
    style.commandTarget ||
    style.warning ||
    style.pending ||
    style.failed
  );
}

function drawMeshFaces(
  context: CanvasRenderingContext2D,
  indices: readonly number[],
  vertices: readonly Vec3[],
  camera: RenderCamera,
  size: ViewportSize
): void {
  for (let index = 0; index + 2 < indices.length; index += 3) {
    const firstIndex = indices[index];
    const secondIndex = indices[index + 1];
    const thirdIndex = indices[index + 2];
    if (
      firstIndex === undefined ||
      secondIndex === undefined ||
      thirdIndex === undefined
    ) {
      continue;
    }

    const first = vertices[firstIndex];
    const second = vertices[secondIndex];
    const third = vertices[thirdIndex];
    if (first && second && third) {
      fillProjectedFace(context, camera, size, [first, second, third]);
    }
  }
}

function strokeMeshEdgeSegments(
  context: CanvasRenderingContext2D,
  mesh: RenderTriangleMesh,
  edgeSegments: readonly RenderEdgeSegment[],
  camera: RenderCamera,
  size: ViewportSize
): void {
  for (const edge of edgeSegments) {
    strokeProjectedLine(
      context,
      camera,
      size,
      transformPoint(edge.start, mesh.transform),
      transformPoint(edge.end, mesh.transform)
    );
  }
}

function createProjectedMeshOutline(
  vertices: readonly Vec3[],
  camera: RenderCamera,
  size: ViewportSize
): readonly ProjectedPoint[] {
  const projectedByLocation = new Map<string, ProjectedPoint>();

  for (const vertex of vertices) {
    const projected = projectPoint(vertex, camera, size);

    if (projected) {
      projectedByLocation.set(
        `${projected.x.toFixed(6)}:${projected.y.toFixed(6)}`,
        projected
      );
    }
  }

  const projected = [...projectedByLocation.values()].sort(
    (left, right) => left.x - right.x || left.y - right.y
  );

  if (projected.length <= 2) {
    return projected;
  }

  const lower: ProjectedPoint[] = [];
  for (const point of projected) {
    while (lower.length >= 2) {
      const origin = lower.at(-2);
      const first = lower.at(-1);
      if (!origin || !first || getProjectedTurn(origin, first, point) > 0) {
        break;
      }
      lower.pop();
    }
    lower.push(point);
  }

  const upper: ProjectedPoint[] = [];
  for (const point of [...projected].reverse()) {
    while (upper.length >= 2) {
      const origin = upper.at(-2);
      const first = upper.at(-1);
      if (!origin || !first || getProjectedTurn(origin, first, point) > 0) {
        break;
      }
      upper.pop();
    }
    upper.push(point);
  }

  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

function getProjectedTurn(
  origin: ProjectedPoint,
  first: ProjectedPoint,
  second: ProjectedPoint
): number {
  return (
    (first.x - origin.x) * (second.y - origin.y) -
    (first.y - origin.y) * (second.x - origin.x)
  );
}

function strokeProjectedOutline(
  context: CanvasRenderingContext2D,
  outline: readonly ProjectedPoint[]
): void {
  const first = outline[0];
  if (!first) {
    return;
  }

  context.beginPath();
  context.moveTo(first.x, first.y);

  for (const point of outline.slice(1)) {
    context.lineTo(point.x, point.y);
  }

  if (outline.length > 2) {
    context.closePath();
  }

  context.stroke();
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
  const first = projected[0];

  if (projected.length !== points.length || !first) {
    return;
  }

  context.beginPath();
  context.moveTo(first.x, first.y);

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

function createEdgeSegmentPickCandidate(
  mesh: RenderTriangleMesh,
  camera: RenderCamera,
  size: ViewportSize,
  point: ViewportPoint
): { id: string; depth: number } | undefined {
  let nearestDepth: number | undefined;

  for (const edge of mesh.edgeSegments ?? []) {
    const start = projectPoint(
      transformPoint(edge.start, mesh.transform),
      camera,
      size
    );
    const end = projectPoint(
      transformPoint(edge.end, mesh.transform),
      camera,
      size
    );

    if (!start || !end) {
      continue;
    }

    const closest = getClosestProjectedSegmentPoint(point, start, end);
    if (closest.distance > 6) {
      continue;
    }

    const depth = start.depth + (end.depth - start.depth) * closest.fraction;
    nearestDepth =
      nearestDepth === undefined ? depth : Math.min(nearestDepth, depth);
  }

  return nearestDepth === undefined
    ? undefined
    : { id: mesh.id, depth: nearestDepth };
}

function getClosestProjectedSegmentPoint(
  point: ViewportPoint,
  start: ProjectedPoint,
  end: ProjectedPoint
): { readonly distance: number; readonly fraction: number } {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const lengthSquared = deltaX * deltaX + deltaY * deltaY;

  if (lengthSquared === 0) {
    return {
      distance: Math.hypot(point.x - start.x, point.y - start.y),
      fraction: 0
    };
  }

  const fraction = clamp(
    ((point.x - start.x) * deltaX + (point.y - start.y) * deltaY) /
      lengthSquared,
    0,
    1
  );

  return {
    distance: Math.hypot(
      point.x - (start.x + fraction * deltaX),
      point.y - (start.y + fraction * deltaY)
    ),
    fraction
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
  const points = getPrimitiveBoundsPoints(primitive);
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

function getPrimitiveBoundsPoints(primitive: RenderPrimitive): readonly Vec3[] {
  if (primitive.kind === "box") {
    return getBoxVertices(primitive);
  }

  if (primitive.kind === "cylinder") {
    return [
      ...getCylinderSegments(primitive).top,
      ...getCylinderSegments(primitive).bottom
    ];
  }

  if (primitive.kind === "sphere") {
    const segments = getSphereSegments(primitive);
    return [...segments.xy, ...segments.xz, ...segments.yz];
  }

  if (primitive.kind === "cone") {
    const segments = getConeSegments(primitive);
    return [...segments.base, segments.apex];
  }

  const segments = getTorusSegments(primitive);
  return [
    ...segments.center,
    ...segments.outer,
    ...segments.inner,
    ...segments.crossSections.flat()
  ];
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
  const halfX = width / 2;
  const halfY = height / 2;
  const halfZ = depth / 2;
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

function getSphereSegments(primitive: RenderSpherePrimitive): {
  xy: Vec3[];
  xz: Vec3[];
  yz: Vec3[];
} {
  const segmentCount = 32;
  const radius = primitive.dimensions.radius;
  const scale = primitive.transform.scale;
  const xy: Vec3[] = [];
  const xz: Vec3[] = [];
  const yz: Vec3[] = [];

  for (let index = 0; index < segmentCount; index += 1) {
    const angle = (index / segmentCount) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    xy.push(
      transformPoint(
        [cos * radius * scale[0], sin * radius * scale[1], 0],
        primitive.transform,
        false
      )
    );
    xz.push(
      transformPoint(
        [cos * radius * scale[0], 0, sin * radius * scale[2]],
        primitive.transform,
        false
      )
    );
    yz.push(
      transformPoint(
        [0, cos * radius * scale[1], sin * radius * scale[2]],
        primitive.transform,
        false
      )
    );
  }

  return { xy, xz, yz };
}

function getConeSegments(primitive: RenderConePrimitive): {
  base: Vec3[];
  apex: Vec3;
} {
  const segmentCount = 24;
  const radius = primitive.dimensions.radius;
  const scale = primitive.transform.scale;
  const scaledRadiusX = radius * scale[0];
  const scaledRadiusY = radius * scale[1];
  const halfHeight = (primitive.dimensions.height * scale[2]) / 2;
  const base: Vec3[] = [];

  for (let index = 0; index < segmentCount; index += 1) {
    const angle = (index / segmentCount) * Math.PI * 2;
    base.push(
      transformPoint(
        [
          Math.cos(angle) * scaledRadiusX,
          Math.sin(angle) * scaledRadiusY,
          -halfHeight
        ],
        primitive.transform,
        false
      )
    );
  }

  return {
    base,
    apex: transformPoint([0, 0, halfHeight], primitive.transform, false)
  };
}

function getTorusSegments(primitive: RenderTorusPrimitive): {
  center: Vec3[];
  outer: Vec3[];
  inner: Vec3[];
  crossSections: Vec3[][];
} {
  const segmentCount = 32;
  const crossSectionCount = 16;
  const { majorRadius, minorRadius } = primitive.dimensions;
  const scale = primitive.transform.scale;
  const center: Vec3[] = [];
  const outer: Vec3[] = [];
  const inner: Vec3[] = [];
  const crossSections: Vec3[][] = [];

  for (let index = 0; index < segmentCount; index += 1) {
    const angle = (index / segmentCount) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    center.push(
      transformPoint(
        [cos * majorRadius * scale[0], sin * majorRadius * scale[1], 0],
        primitive.transform,
        false
      )
    );
    outer.push(
      transformPoint(
        [
          cos * (majorRadius + minorRadius) * scale[0],
          sin * (majorRadius + minorRadius) * scale[1],
          0
        ],
        primitive.transform,
        false
      )
    );
    inner.push(
      transformPoint(
        [
          cos * (majorRadius - minorRadius) * scale[0],
          sin * (majorRadius - minorRadius) * scale[1],
          0
        ],
        primitive.transform,
        false
      )
    );
  }

  for (const sectionAngle of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
    const cosSection = Math.cos(sectionAngle);
    const sinSection = Math.sin(sectionAngle);
    const section: Vec3[] = [];

    for (let index = 0; index < crossSectionCount; index += 1) {
      const angle = (index / crossSectionCount) * Math.PI * 2;
      const radial = majorRadius + Math.cos(angle) * minorRadius;
      section.push(
        transformPoint(
          [
            cosSection * radial * scale[0],
            sinSection * radial * scale[1],
            Math.sin(angle) * minorRadius * scale[2]
          ],
          primitive.transform,
          false
        )
      );
    }

    crossSections.push(section);
  }

  return { center, outer, inner, crossSections };
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
