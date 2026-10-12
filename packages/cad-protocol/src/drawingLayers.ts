/** Layer line weights are physical millimeters, independent of document units. */
export interface DrawingLayer {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly lineType: "continuous" | "dashed" | "dotted" | "center";
  readonly lineWeight: number;
  readonly transparency: number;
  readonly locked: boolean;
  readonly visible: boolean;
  readonly printable: boolean;
}
export const DEFAULT_DRAWING_LAYER: DrawingLayer = {
  id: "0",
  name: "0",
  color: "#e1eaf6",
  lineType: "continuous",
  lineWeight: 0.35,
  transparency: 0,
  locked: false,
  visible: true,
  printable: true
};
export type DrawingLayerOp =
  | { readonly op: "drawing.layer.create"; readonly layer: DrawingLayer }
  | { readonly op: "drawing.layer.update"; readonly layer: DrawingLayer }
  | { readonly op: "drawing.layer.delete"; readonly id: string };
export interface DrawingLayerSemanticDiff {
  readonly created: readonly DrawingLayer[];
  readonly modified: readonly DrawingLayer[];
  readonly deleted: readonly DrawingLayer[];
}
export function isDrawingLayer(value: unknown): value is DrawingLayer {
  if (!value || typeof value !== "object") return false;
  const layer = value as Record<string, unknown>;
  return (
    typeof layer.id === "string" &&
    Boolean(layer.id.trim()) &&
    typeof layer.name === "string" &&
    Boolean(layer.name.trim()) &&
    typeof layer.color === "string" &&
    /^#[0-9a-f]{6}$/i.test(layer.color) &&
    ["continuous", "dashed", "dotted", "center"].includes(
      String(layer.lineType)
    ) &&
    typeof layer.lineWeight === "number" &&
    Number.isFinite(layer.lineWeight) &&
    layer.lineWeight >= 0 &&
    layer.lineWeight <= 2.11 &&
    typeof layer.transparency === "number" &&
    Number.isFinite(layer.transparency) &&
    layer.transparency >= 0 &&
    layer.transparency <= 90 &&
    typeof layer.locked === "boolean" &&
    typeof layer.visible === "boolean" &&
    typeof layer.printable === "boolean"
  );
}
export function isDrawingLayerOp(value: unknown): value is DrawingLayerOp {
  if (!value || typeof value !== "object") return false;
  const op = value as Record<string, unknown>;
  return op.op === "drawing.layer.delete"
    ? typeof op.id === "string" && Boolean(op.id.trim())
    : (op.op === "drawing.layer.create" || op.op === "drawing.layer.update") &&
        isDrawingLayer(op.layer);
}
export function getDrawingLayer(
  layers: ReadonlyMap<string, DrawingLayer>,
  entity: { readonly layerId?: string }
): DrawingLayer {
  return layers.get(entity.layerId ?? "0") ?? DEFAULT_DRAWING_LAYER;
}
export function drawingLayerAppearance(layer: DrawingLayer) {
  return {
    stroke: layer.color,
    strokeWidth: Math.max(0.5, (layer.lineWeight * 96) / 25.4),
    strokeDasharray: {
      continuous: undefined,
      dashed: "10 5",
      dotted: "2 4",
      center: "14 4 3 4"
    }[layer.lineType],
    opacity: 1 - layer.transparency / 100
  };
}
