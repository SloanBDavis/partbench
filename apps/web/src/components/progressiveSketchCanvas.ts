import {
  renderCanvasScene,
  type RenderSceneOptions,
  type RenderTriangleMesh
} from "@web-cad/renderer";

interface CachedSketchBase {
  readonly canvas: HTMLCanvasElement;
  readonly camera: RenderSceneOptions["camera"];
  readonly meshes: RenderSceneOptions["meshes"];
  readonly primitives: RenderSceneOptions["primitives"];
  readonly width: number;
  readonly height: number;
}

const cachedBases = new WeakMap<HTMLCanvasElement, CachedSketchBase>();
const COARSE_MESH_LIMIT = 32;
const COARSE_EDGE_LIMIT = 4;

export function paintProgressiveSketchCanvas(
  context: CanvasRenderingContext2D,
  options: RenderSceneOptions
): () => void {
  const targets = new Set(options.visualStates?.map((state) => state.targetId));
  if (options.selectedId) targets.add(options.selectedId);
  if (!options.visualStates && options.hoveredId)
    targets.add(options.hoveredId);
  const isStyled = (mesh: RenderTriangleMesh) =>
    targets.has(mesh.id) ||
    (mesh.parentId !== undefined && targets.has(mesh.parentId));
  const meshes = options.meshes ?? [];
  const styledMeshes = meshes.filter(isStyled);
  const cached = cachedBases.get(context.canvas);
  if (
    cached?.camera === options.camera &&
    cached.meshes === options.meshes &&
    cached.primitives === options.primitives &&
    cached.width === options.size.width &&
    cached.height === options.size.height
  ) {
    commitSketchFrame(context, cached.canvas, options, styledMeshes);
    return () => undefined;
  }

  renderCanvasScene(context, {
    ...options,
    meshes: createCoarseSketchMeshes(meshes, isStyled)
  });

  const buffer = context.canvas.ownerDocument.createElement("canvas");
  buffer.width = context.canvas.width;
  buffer.height = context.canvas.height;
  const bufferContext = buffer.getContext("2d");
  if (!bufferContext) return () => undefined;
  const ratio = context.canvas.width / Math.max(1, options.size.width);
  bufferContext.setTransform(ratio, 0, 0, ratio, 0, 0);
  const baseOptions: RenderSceneOptions = {
    ...options,
    hoveredId: undefined,
    selectedId: undefined,
    visualStates: undefined
  };
  renderCanvasScene(bufferContext, { ...baseOptions, meshes: [] });

  let meshOffset = 0;
  let edgeOffset = 0;
  let frameId = 0;
  const renderNext = () => {
    for (
      let chunks = 0;
      chunks < 2 && meshOffset < meshes.length;
      chunks += 1
    ) {
      const mesh = meshes[meshOffset]!;
      const edges = mesh.edgeSegments ?? [];
      const nextEdgeOffset = Math.min(edgeOffset + 32, edges.length);
      renderCanvasScene(bufferContext, {
        ...baseOptions,
        primitives: [],
        preserveDrawingBuffer: true,
        meshes: [
          edges.length > 32
            ? { ...mesh, edgeSegments: edges.slice(edgeOffset, nextEdgeOffset) }
            : mesh
        ]
      });
      if (nextEdgeOffset < edges.length) {
        edgeOffset = nextEdgeOffset;
      } else {
        meshOffset += 1;
        edgeOffset = 0;
      }
    }
    if (meshOffset < meshes.length) {
      frameId = window.requestAnimationFrame(renderNext);
    } else {
      cachedBases.set(context.canvas, {
        canvas: buffer,
        camera: options.camera,
        meshes: options.meshes,
        primitives: options.primitives,
        width: options.size.width,
        height: options.size.height
      });
      commitSketchFrame(context, buffer, options, styledMeshes);
    }
  };
  frameId = window.requestAnimationFrame(renderNext);
  return () => window.cancelAnimationFrame(frameId);
}

function createCoarseSketchMeshes(
  meshes: readonly RenderTriangleMesh[],
  isStyled: (mesh: RenderTriangleMesh) => boolean
): readonly RenderTriangleMesh[] {
  const meshStep = Math.max(1, Math.ceil(meshes.length / COARSE_MESH_LIMIT));
  return meshes
    .filter((mesh, index) => index % meshStep === 0 || isStyled(mesh))
    .map((mesh) => {
      const edges = mesh.edgeSegments ?? [];
      if (edges.length <= COARSE_EDGE_LIMIT) return mesh;
      const edgeStep = Math.ceil(edges.length / COARSE_EDGE_LIMIT);
      return {
        ...mesh,
        edgeSegments: Array.from(
          { length: Math.ceil(edges.length / edgeStep) },
          (_, index) => {
            const start = index * edgeStep;
            return {
              start: edges[start]!.start,
              end: edges[Math.min(start + edgeStep - 1, edges.length - 1)]!.end
            };
          }
        )
      };
    });
}

function commitSketchFrame(
  context: CanvasRenderingContext2D,
  base: HTMLCanvasElement,
  options: RenderSceneOptions,
  styledMeshes: readonly RenderTriangleMesh[]
): void {
  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, context.canvas.width, context.canvas.height);
  context.drawImage(base, 0, 0);
  context.restore();
  if (styledMeshes.length > 0) {
    renderCanvasScene(context, {
      ...options,
      meshes: styledMeshes,
      primitives: [],
      preserveDrawingBuffer: true
    });
  }
}
