const INTERNAL_RENDER_ID_PATTERN =
  /\b(?:selection-buffer|mesh-triangle|occt-shape|gpu-buffer|pixel-hit|renderer-hit|file-handle|fileHandle|opfs|opfs-cache|checkpoint-local|checkpointEntityId):[^\s,.;)]+/gi;

export function redactInternalViewportIds(text: string): string {
  return text.replace(INTERNAL_RENDER_ID_PATTERN, "internal render target");
}

const INTERNAL_DIAGNOSTIC_TERMS: Record<string, string> = {
  "command ready": "ready",
  "command ready cad body": "CAD body available for modeling",
  "command ready generated reference targets": "ready saved references",
  "command ready generated references": "ready saved references",
  "cad core": "modeling engine",
  "geometry worker response does not contain an exact topology checkpoint payload":
    "Display geometry evidence is incomplete",
  "geometry worker": "Display geometry engine",
  "exact topology checkpoint payload": "saved exact-shape data",
  "checkpoint payload": "saved topology data",
  "checkpoint local": "internal topology",
  checkpointentityid: "internal topology id",
  "package contract": "project file format",
  "occt wasm": "exact geometry runtime",
  "occt mesh": "display geometry",
  occt: "exact geometry",
  wasm: "geometry runtime",
  deferred: "not ready yet",
  tranche: "release step",
  milestone: "release step",
  debug: "diagnostic"
};

const INTERNAL_DIAGNOSTIC_TERM_PATTERN =
  /\b(?:Geometry worker response does not contain an exact topology checkpoint payload|command-ready generated(?:-reference targets| references)|command-ready CAD body|Geometry worker|exact topology checkpoint payloads?|checkpoint[- ]payloads?|checkpoint-local|checkpointEntityId|package[- ]contract|OCCT[- /]WASM|OCCT[- ]mesh|command-ready|cad-core|OCCT|WASM|deferred|tranche|milestone|debug)\b/gi;

export function formatVisibleDiagnosticMessage(message: string): string {
  return collapseRepeatedInternalRenderTargetLabels(
    redactInternalViewportIds(message)
      .replace(
        /\bFeature\s+\S+\s+cannot be edited(?: safely)?(?: through\s+\S+)? because (?:downstream |its )?(?:result )?body\s+\S+\s+is consumed by feature\s+\S+\.(?:\s+Edit or repair that downstream feature before changing the original source\.)?/gi,
        "This feature cannot be edited because a downstream result depends on it."
      )
      .replace(
        /\b(?:Selected body(?:\s+\S+)? is consumed by feature|Body\s+\S+\s+was consumed by)\s+\S+\./gi,
        "Selected body already has a downstream result."
      )
      .replace(
        /\bBody\s+\S+\s+does not expose stable command-ready generated references yet\./gi,
        "This solid is complete, but its faces and edges are not available to downstream modeling tools."
      )
      .replace(
        INTERNAL_DIAGNOSTIC_TERM_PATTERN,
        (term) =>
          INTERNAL_DIAGNOSTIC_TERMS[
            term
              .toLowerCase()
              .replace(/[-/]/g, " ")
              .replace("payloads", "payload")
          ] ?? term
      )
  );
}

export function dedupeVisibleDiagnostics<
  T extends {
    readonly code: string;
    readonly status: string;
    readonly message: string;
  }
>(
  diagnostics: readonly T[]
): readonly Pick<T, "code" | "status" | "message">[] {
  return dedupeDiagnostics(
    diagnostics.map((diagnostic) => ({
      code: diagnostic.code,
      status: diagnostic.status,
      message: formatVisibleDiagnosticMessage(diagnostic.message)
    }))
  );
}

export function dedupeDiagnostics<
  T extends {
    readonly code: string;
    readonly status: string;
    readonly message: string;
  }
>(diagnostics: readonly T[]): readonly T[] {
  const seen = new Set<string>();
  return diagnostics.flatMap((diagnostic) => {
    const key = `${diagnostic.code}:${diagnostic.status}:${diagnostic.message}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [diagnostic];
  });
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
