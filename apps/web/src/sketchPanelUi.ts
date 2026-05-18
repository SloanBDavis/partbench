import type {
  SketchEntityKind,
  SketchId,
  SketchSnapshot
} from "@web-cad/cad-protocol";

export function chooseSketchPanelSelection(
  sketches: readonly SketchSnapshot[],
  currentSketchId: SketchId | undefined,
  focusedSketchId: SketchId | undefined
): SketchId | undefined {
  if (
    currentSketchId &&
    sketches.some((sketch) => sketch.id === currentSketchId)
  ) {
    return currentSketchId;
  }

  if (
    focusedSketchId &&
    sketches.some((sketch) => sketch.id === focusedSketchId)
  ) {
    return focusedSketchId;
  }

  return sketches[0]?.id;
}

export function getDefaultSketchEntityKind(
  sketch: SketchSnapshot | undefined
): SketchEntityKind {
  return sketch?.attachment && sketch.entities.length === 0
    ? "rectangle"
    : "point";
}
