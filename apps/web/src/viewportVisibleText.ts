const INTERNAL_RENDER_ID_PATTERN =
  /\b(?:selection-buffer|mesh-triangle|occt-shape|gpu-buffer|pixel-hit|renderer-hit|file-handle|fileHandle|opfs|opfs-cache):[^\s,.;)]+/gi;

export function redactInternalViewportIds(text: string): string {
  return text.replace(INTERNAL_RENDER_ID_PATTERN, "internal render target");
}

const INTERNAL_DIAGNOSTIC_COPY_REPLACEMENTS: readonly [RegExp, string][] = [
  [
    /\bdoes not expose command-ready semantic generated references\b/gi,
    "does not expose saved faces or edges for modeling actions"
  ],
  [
    /\bSelect a command-ready result face or edge\b/g,
    "Select a ready result face or edge"
  ],
  [
    /\bselect a command-ready result face or edge\b/g,
    "select a ready result face or edge"
  ],
  [/\bcommand-ready CAD body\b/gi, "CAD body available for modeling"],
  [/\bcommand-ready generated-reference targets\b/gi, "ready saved references"],
  [/\bcommand-ready generated references\b/gi, "ready saved references"],
  [/\bcommand-ready references\b/gi, "ready references"],
  [/\bcommand-ready reference\b/gi, "ready reference"],
  [/\bcommand-ready\b/gi, "ready"],
  [/\bcad-core\b/gi, "modeling engine"],
  [/\bcheckpoint[- ]payloads?\b/gi, "saved topology data"],
  [/\bpackage[- ]contract\b/gi, "project file format"],
  [/\bOCCT[- ]mesh\b/gi, "display geometry"],
  [/\bdeferred\b/gi, "not ready yet"],
  [/\btranche\b/gi, "release step"],
  [/\bmilestone\b/gi, "release step"],
  [/\bdebug\b/gi, "diagnostic"]
];

export function formatVisibleDiagnosticMessage(message: string): string {
  return INTERNAL_DIAGNOSTIC_COPY_REPLACEMENTS.reduce(
    (formatted, [pattern, replacement]) =>
      formatted.replace(pattern, replacement),
    redactInternalViewportIds(message)
  );
}
