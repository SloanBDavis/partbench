import type {
  DocumentUnits,
  SketchDimensionEntryCurrent,
  SketchDimensionTargetV22,
  SketchEntitySnapshot
} from "@web-cad/cad-protocol";
import type { RenderCamera, ViewportSize } from "@web-cad/renderer";
import { projectPoint } from "@web-cad/renderer";
import {
  dimensionEntryToDraftV19,
  dimensionFamilyLabelV19,
  dimensionTargetToFamilyV19,
  measureDimensionTargetV19
} from "./modes/sketch/sketchIntentEditorModel";
import { formatNumber } from "./sceneObjectDisplay";
import {
  mapSketchPointToDisplayFrame,
  type SketchDisplayFrame
} from "./sketchDisplayFrames";

export interface SketchDimensionAnnotationOffset {
  readonly x: number;
  readonly y: number;
}

export interface SketchDimensionAnnotation {
  readonly dimensionId: string;
  readonly sketchId: string;
  readonly name: string;
  readonly familyLabel: string;
  readonly valueLabel: string;
  readonly boundToParameter: boolean;
  readonly parameterId?: string;
  readonly x: number;
  readonly y: number;
  readonly anchorX: number;
  readonly anchorY: number;
  readonly target: SketchDimensionTargetV22;
}

export function createSketchDimensionAnnotations({
  sketchId,
  entities,
  dimensions,
  displayFrame,
  camera,
  size,
  units,
  offsets = {}
}: {
  readonly sketchId: string;
  readonly entities: readonly SketchEntitySnapshot[];
  readonly dimensions: readonly SketchDimensionEntryCurrent[];
  readonly displayFrame: SketchDisplayFrame;
  readonly camera: RenderCamera;
  readonly size: ViewportSize;
  readonly units: DocumentUnits;
  readonly offsets?: Readonly<Record<string, SketchDimensionAnnotationOffset>>;
}): readonly SketchDimensionAnnotation[] {
  const placed: SketchDimensionAnnotation[] = [];
  const ordered = [...dimensions].sort((left, right) =>
    left.id.localeCompare(right.id)
  );
  for (const [index, dimension] of ordered.entries()) {
    const draft = dimensionEntryToDraftV19(dimension);
    const family = dimensionTargetToFamilyV19(draft.target);
    const value = dimension.effectiveValue ?? measureDimensionTargetV19(draft.target, entities);
    const anchor = dimensionAnchor(draft.target, entities);
    const world = mapSketchPointToDisplayFrame(displayFrame, anchor);
    const projected = projectPoint(world, camera, size);
    if (!projected) continue;
    const offset = offsets[dimension.id] ?? deterministicOffset(index);
    const position = avoidOverlap(
      { x: projected.x + offset.x, y: projected.y + offset.y },
      placed
    );
    placed.push({
      dimensionId: dimension.id,
      sketchId,
      name: dimension.name,
      familyLabel: dimensionFamilyLabelV19(family),
      valueLabel: formatAnnotationValue(value, family, units),
      boundToParameter: draft.valueSourceType === "parameter",
      ...(draft.valueSourceType === "parameter" ? { parameterId: draft.parameterId } : {}),
      x: position.x,
      y: position.y,
      anchorX: projected.x,
      anchorY: projected.y,
      target: draft.target
    });
  }
  return placed;
}

export function moveSketchDimensionAnnotation(
  offsets: Readonly<Record<string, SketchDimensionAnnotationOffset>>,
  dimensionId: string,
  offset: SketchDimensionAnnotationOffset
): Record<string, SketchDimensionAnnotationOffset> {
  return { ...offsets, [dimensionId]: offset };
}

function dimensionAnchor(
  target: SketchDimensionTargetV22,
  entities: readonly SketchEntitySnapshot[]
): readonly [number, number] {
  if (target.kind === "entityScalar") {
    const entity = entities.find((candidate) => candidate.id === target.entityId);
    if (!entity) return [0, 0];
    if (entity.kind === "rectangle") {
      return target.role === "width"
        ? [entity.center[0], entity.center[1] + entity.height / 2]
        : [entity.center[0] + entity.width / 2, entity.center[1]];
    }
    if (entity.kind === "line") {
      return midpoint(entity.start, entity.end);
    }
    if (entity.kind === "circle" || entity.kind === "arc") {
      return entity.center;
    }
    if (entity.kind === "point") return entity.point;
  }
  if (target.kind === "pointPair") {
    const primary = pointOnEntity(target.primary, entities);
    const secondary = pointOnEntity(target.secondary, entities);
    return primary && secondary ? midpoint(primary, secondary) : [0, 0];
  }
  if (target.kind === "pointLineDistance") {
    return pointOnEntity(target.point, entities) ?? [0, 0];
  }
  const primary = entities.find((entity) => entity.id === target.primaryLineEntityId);
  const secondary = entities.find((entity) => entity.id === target.secondaryLineEntityId);
  if (primary?.kind === "line" && secondary?.kind === "line") {
    return midpoint(midpoint(primary.start, primary.end), midpoint(secondary.start, secondary.end));
  }
  return [0, 0];
}

function pointOnEntity(
  target: { readonly entityId: string; readonly entityKind: string; readonly role: string },
  entities: readonly SketchEntitySnapshot[]
): readonly [number, number] | undefined {
  const entity = entities.find((candidate) => candidate.id === target.entityId);
  if (!entity) return undefined;
  if (entity.kind === "point") return entity.point;
  if (entity.kind === "line") {
    return target.role === "end" ? entity.end : target.role === "start" ? entity.start : midpoint(entity.start, entity.end);
  }
  if (entity.kind === "rectangle") return entity.center;
  if (entity.kind === "circle" || entity.kind === "arc") return entity.center;
  return undefined;
}

function formatAnnotationValue(
  value: number,
  family: ReturnType<typeof dimensionTargetToFamilyV19>,
  units: DocumentUnits
): string {
  if (!Number.isFinite(value)) return "—";
  if (family === "lineAngle" || family === "arcSweep") {
    return `${formatNumber(value)} deg`;
  }
  return `${formatNumber(value)} ${units}`;
}

function deterministicOffset(index: number): SketchDimensionAnnotationOffset {
  const column = index % 3;
  const row = Math.floor(index / 3);
  return { x: 18 + column * 8, y: -22 - row * 6 };
}

function avoidOverlap(
  position: { x: number; y: number },
  placed: readonly SketchDimensionAnnotation[]
): { x: number; y: number } {
  let next = position;
  for (const annotation of placed) {
    if (Math.hypot(next.x - annotation.x, next.y - annotation.y) < 28) {
      next = { x: next.x + 24, y: next.y - 16 };
    }
  }
  return next;
}

function midpoint(
  first: readonly [number, number],
  second: readonly [number, number]
): readonly [number, number] {
  return [(first[0] + second[0]) / 2, (first[1] + second[1]) / 2];
}
