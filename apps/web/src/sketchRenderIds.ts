import type { SketchEntityId, SketchId } from "@web-cad/cad-protocol";

const SKETCH_RENDER_PREFIX = "sketch:";
const ENTITY_RENDER_SEPARATOR = ":entity:";

export type SketchRenderTarget =
  | { readonly kind: "sketch"; readonly sketchId: SketchId }
  | {
      readonly kind: "sketchEntity";
      readonly sketchId: SketchId;
      readonly entityId: SketchEntityId;
    };

export function createSketchSelectionId(sketchId: SketchId): string {
  return `${SKETCH_RENDER_PREFIX}${encodeRenderIdPart(sketchId)}`;
}

export function createSketchEntitySelectionId(
  sketchId: SketchId,
  entityId: SketchEntityId
): string {
  return `${createSketchSelectionId(sketchId)}${ENTITY_RENDER_SEPARATOR}${encodeRenderIdPart(entityId)}`;
}

export function parseSketchRenderId(
  renderId: string
): SketchRenderTarget | undefined {
  if (!renderId.startsWith(SKETCH_RENDER_PREFIX)) {
    return undefined;
  }

  const sketchPart = decodeRenderIdPart(renderId, SKETCH_RENDER_PREFIX.length);
  if (!sketchPart) {
    return undefined;
  }

  if (sketchPart.nextIndex === renderId.length) {
    return { kind: "sketch", sketchId: sketchPart.value };
  }

  if (!renderId.startsWith(ENTITY_RENDER_SEPARATOR, sketchPart.nextIndex)) {
    return undefined;
  }

  const entityPart = decodeRenderIdPart(
    renderId,
    sketchPart.nextIndex + ENTITY_RENDER_SEPARATOR.length
  );

  return entityPart?.nextIndex === renderId.length
    ? {
        kind: "sketchEntity",
        sketchId: sketchPart.value,
        entityId: entityPart.value
      }
    : undefined;
}

function encodeRenderIdPart(value: string): string {
  return `${value.length}:${value}`;
}

function decodeRenderIdPart(
  input: string,
  startIndex: number
): { readonly value: string; readonly nextIndex: number } | undefined {
  const separatorIndex = input.indexOf(":", startIndex);
  if (separatorIndex === -1) {
    return undefined;
  }

  const lengthText = input.slice(startIndex, separatorIndex);
  if (!/^\d+$/.test(lengthText)) {
    return undefined;
  }

  const length = Number(lengthText);
  const valueStart = separatorIndex + 1;
  const nextIndex = valueStart + length;
  if (!Number.isSafeInteger(length) || nextIndex > input.length) {
    return undefined;
  }

  return {
    value: input.slice(valueStart, nextIndex),
    nextIndex
  };
}
