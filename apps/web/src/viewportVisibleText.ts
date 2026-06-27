const INTERNAL_RENDER_ID_PATTERN =
  /\b(?:selection-buffer|mesh-triangle|occt-shape|gpu-buffer|pixel-hit|renderer-hit|file-handle|fileHandle|opfs|opfs-cache|checkpoint-local|checkpointEntityId):[^\s,.;)]+/gi;

export function redactInternalViewportIds(text: string): string {
  return text.replace(INTERNAL_RENDER_ID_PATTERN, "internal render target");
}

const INTERNAL_DIAGNOSTIC_COPY_REPLACEMENTS: readonly [RegExp, string][] = [
  [
    /\bFeature\s+\S+\s+cannot be edited safely because downstream result body\s+\S+\s+is consumed by feature\s+\S+\.\s+Edit or repair that downstream feature before changing the original source\./gi,
    "This source feature cannot be edited because a downstream result depends on it. Edit or repair that downstream feature before changing the original source."
  ],
  [
    /\bFeature\s+\S+\s+cannot be edited safely because body\s+\S+\s+is consumed by feature\s+\S+\./gi,
    "This feature cannot be edited because its result already has a downstream result."
  ],
  [
    /\bFeature\s+\S+\s+cannot be edited safely through\s+\S+\s+because result body\s+\S+\s+is consumed by feature\s+\S+\./gi,
    "This feature cannot be edited because its result already has a downstream result."
  ],
  [
    /\bFeature\s+\S+\s+cannot be edited through\s+\S+\s+because downstream result body\s+\S+\s+is consumed by feature\s+\S+\./gi,
    "This feature cannot be edited because a downstream result depends on it."
  ],
  [
    /\bFeature\s+\S+\s+cannot be edited through\s+\S+\s+because its result body\s+\S+\s+is consumed by feature\s+\S+\./gi,
    "This feature cannot be edited because its result already has a downstream result."
  ],
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
  [
    /\bGeometry worker response does not contain an exact topology checkpoint payload\b/gi,
    "Display geometry evidence is incomplete"
  ],
  [/\bGeometry worker\b/gi, "Display geometry engine"],
  [/\bexact topology checkpoint payloads?\b/gi, "saved exact-shape data"],
  [/\bcheckpoint[- ]payloads?\b/gi, "saved topology data"],
  [/\bcheckpoint-local\b/gi, "internal topology"],
  [/\bcheckpointEntityId\b/gi, "internal topology id"],
  [/\bpackage[- ]contract\b/gi, "project file format"],
  [/\bOCCT[- /]WASM\b/gi, "exact geometry runtime"],
  [/\bOCCT[- ]mesh\b/gi, "display geometry"],
  [/\bOCCT\b/gi, "exact geometry"],
  [/\bWASM\b/gi, "geometry runtime"],
  [/\bdeferred\b/gi, "not ready yet"],
  [/\btranche\b/gi, "release step"],
  [/\bmilestone\b/gi, "release step"],
  [/\bdebug\b/gi, "diagnostic"]
];

export function formatVisibleDiagnosticMessage(message: string): string {
  return collapseRepeatedInternalRenderTargetLabels(
    INTERNAL_DIAGNOSTIC_COPY_REPLACEMENTS.reduce(
      (formatted, [pattern, replacement]) =>
        formatted.replace(pattern, replacement),
      redactInternalViewportIds(message)
    )
  );
}

function collapseRepeatedInternalRenderTargetLabels(text: string): string {
  return text.replace(
    /\binternal render target(?:\s+internal render target)+\b/gi,
    (match) =>
      match.includes("Internal") || match.includes("INTERNAL")
        ? "Internal render target"
        : "internal render target"
  );
}
