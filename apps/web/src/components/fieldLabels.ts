import type { DimensionCommandForm } from "../cadCommands";

export function formatDimensionFieldLabel(
  field: keyof DimensionCommandForm,
  unitLabel?: string
): string {
  const labels: Record<keyof DimensionCommandForm, string> = {
    width: "Width",
    height: "Height",
    depth: "Depth",
    radius: "Radius",
    majorRadius: "Major radius",
    minorRadius: "Minor radius"
  };
  const label = labels[field];

  return unitLabel ? `${label} (${unitLabel})` : label;
}
