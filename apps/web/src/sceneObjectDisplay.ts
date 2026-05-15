import type { CadAxisAlignedBounds, SceneObject } from "@web-cad/cad-core";

export function formatObjectKind(kind: SceneObject["kind"]): string {
  return kind === "box" ? "Box" : "Cylinder";
}

export function getObjectDisplayName(object: SceneObject): string {
  return object.name ?? object.id;
}

export function formatDimensions(object: SceneObject, units?: string): string {
  const suffix = units ? ` ${units}` : "";

  if (object.kind === "box") {
    const { depth, height, width } = object.dimensions;
    return `${formatNumber(width)} x ${formatNumber(height)} x ${formatNumber(depth)}${suffix}`;
  }

  const { height, radius } = object.dimensions;
  return `r ${formatNumber(radius)}${suffix}, h ${formatNumber(height)}${suffix}`;
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

export function formatBounds(
  bounds: CadAxisAlignedBounds,
  units?: string
): string {
  const suffix = units ? ` ${units}` : "";
  return `min ${formatVectorWithSuffix(bounds.min, suffix)}; max ${formatVectorWithSuffix(bounds.max, suffix)}; size ${formatVectorWithSuffix(bounds.size, suffix)}`;
}

export function formatVolume(value: number, units?: string): string {
  const suffix = units ? ` ${units}^3` : "";
  return `${formatNumber(value)}${suffix}`;
}

function formatVectorWithSuffix(
  vector: readonly [number, number, number],
  suffix: string
): string {
  return vector.map((value) => `${formatNumber(value)}${suffix}`).join(", ");
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? value.toString() : value.toFixed(2);
}
