const INTERNAL_RENDER_ID_PATTERN =
  /\b(?:selection-buffer|mesh-triangle|occt-shape|gpu-buffer|pixel-hit|renderer-hit):[^\s,.;)]+/gi;

export function redactInternalViewportIds(text: string): string {
  return text.replace(INTERNAL_RENDER_ID_PATTERN, "internal render target");
}
