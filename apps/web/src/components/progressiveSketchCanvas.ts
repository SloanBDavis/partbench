import {
  renderCanvasScene,
  type RenderSceneOptions,
  type RenderTriangleMesh
} from "@web-cad/renderer";

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
  const ordered = [
    ...meshes.filter((mesh) => !isStyled(mesh)),
    ...meshes.filter(isStyled)
  ];
  let meshOffset = 0;
  let edgeOffset = 0;
  let frameId = 0;
  const renderNext = () => {
    const mesh = ordered[meshOffset]!;
    const edges = mesh.edgeSegments ?? [];
    const nextEdgeOffset = Math.min(edgeOffset + 32, edges.length);
    renderCanvasScene(context, {
      ...options,
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
    if (meshOffset < ordered.length) {
      frameId = window.requestAnimationFrame(renderNext);
    }
  };
  frameId = window.requestAnimationFrame(renderNext);
  return () => window.cancelAnimationFrame(frameId);
}
