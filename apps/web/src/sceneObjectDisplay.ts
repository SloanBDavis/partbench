import type { SceneObject } from "@web-cad/cad-core";

export function formatObjectKind(kind: SceneObject["kind"]): string {
  return kind === "box" ? "Box" : "Cylinder";
}

export function formatDimensions(object: SceneObject): string {
  if (object.kind === "box") {
    const { depth, height, width } = object.dimensions;
    return `${formatNumber(width)} x ${formatNumber(height)} x ${formatNumber(depth)}`;
  }

  const { height, radius } = object.dimensions;
  return `r ${formatNumber(radius)}, h ${formatNumber(height)}`;
}

export function formatVector(
  vector: readonly [number, number, number]
): string {
  return vector.map(formatNumber).join(", ");
}

export function formatObjectPosition(object: SceneObject): string {
  return `pos ${formatVector(object.transform.translation)}`;
}

export function formatObjectScale(object: SceneObject): string {
  return `scale ${formatVector(object.transform.scale)}`;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? value.toString() : value.toFixed(2);
}
