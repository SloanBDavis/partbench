import type {
  BodyMeasurementsSnapshot,
  CadAxisAlignedBounds,
  CadBodyTopologySnapshot,
  SceneObject
} from "@web-cad/cad-core";
import type { CadQueryError } from "@web-cad/cad-protocol";

export function formatObjectKind(kind: SceneObject["kind"]): string {
  switch (kind) {
    case "box":
      return "Box";
    case "cylinder":
      return "Cylinder";
    case "sphere":
      return "Sphere";
    case "cone":
      return "Cone";
    case "torus":
      return "Torus";
  }
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

  if (object.kind === "sphere") {
    const { radius } = object.dimensions;
    return `r ${formatNumber(radius)}${suffix}`;
  }

  if (object.kind === "cone") {
    const { height, radius } = object.dimensions;
    return `r ${formatNumber(radius)}${suffix}, h ${formatNumber(height)}${suffix}`;
  }

  if (object.kind === "torus") {
    const { majorRadius, minorRadius } = object.dimensions;
    return `R ${formatNumber(majorRadius)}${suffix}, r ${formatNumber(minorRadius)}${suffix}`;
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

export function formatArea(value: number, units?: string): string {
  const suffix = units ? ` ${units}^2` : "";
  return `${formatNumber(value)}${suffix}`;
}

export interface MeasurementDisplayRow {
  readonly label: string;
  readonly value: string;
}

export function createBodyMeasurementRows(
  measurements: BodyMeasurementsSnapshot,
  units?: string
): readonly MeasurementDisplayRow[] {
  return [
    { label: "Volume", value: formatVolume(measurements.volume, units) },
    {
      label: "Surface area",
      value: formatArea(measurements.surfaceArea, units)
    },
    {
      label: "Local bounds",
      value: formatBounds(measurements.localBounds, units)
    },
    { label: "Centroid", value: formatVector(measurements.centroid) },
    { label: "Model", value: "Source analytic" }
  ];
}

export function formatBodyMeasurementError(error: CadQueryError): string {
  if (error.code === "BODY_NOT_FOUND") {
    return `Body measurements unavailable: ${error.bodyId ?? "selected body"} was not found.`;
  }

  if (error.code === "UNSUPPORTED_BODY_MEASUREMENTS") {
    return `Body measurements unavailable for ${error.bodyId ?? "selected body"}. Authored rectangle and circle extrude bodies are supported.`;
  }

  return error.message;
}

export function formatBodyTopologyStatus(
  status: CadBodyTopologySnapshot["status"]
): string {
  switch (status) {
    case "healthy":
      return "Healthy";
    case "unsupported":
      return "Unsupported";
    case "ambiguous":
      return "Ambiguous";
    case "stale":
      return "Stale";
    case "kernel-failed":
      return "Kernel failed";
    case "unavailable-binding":
      return "Binding unavailable";
  }
}

export function formatBodyTopologyModel(
  topology: CadBodyTopologySnapshot
): string {
  if (topology.topologyModel === "semantic-source") {
    return "Semantic source";
  }

  return "Unavailable";
}

export function formatBodyTopologyCounts(
  topology: CadBodyTopologySnapshot
): string {
  if (!topology.topologyAvailable) {
    return "Unavailable";
  }

  return `${topology.faceCount ?? 0} faces, ${topology.edgeCount ?? 0} edges, ${topology.vertexCount ?? 0} vertices`;
}

export function formatBodyMeasurementConfidence(
  topology: CadBodyTopologySnapshot
): string {
  switch (topology.measurementConfidence) {
    case "source-analytic":
      return "Source analytic";
    case "kernel-derived":
      return "Kernel derived";
    case "none":
      return "Unavailable";
  }
}

export function formatBodyTopologyError(error: CadQueryError): string {
  if (error.code === "BODY_NOT_FOUND") {
    return `Body topology unavailable: ${error.bodyId ?? "selected body"} was not found.`;
  }

  if (error.code === "UNSUPPORTED_BODY_TOPOLOGY") {
    return `Body topology unavailable for ${error.bodyId ?? "selected body"}.`;
  }

  return error.message;
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
