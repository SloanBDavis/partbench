import {
  CadProjectImportError,
  formatCadProjectImportError,
  importCadProject,
  parseCadProjectJson,
  type CadProject,
  type CadProjectImportIssue
} from "@web-cad/cad-core";

export interface ProjectJsonSummary {
  readonly schemaVersion: string;
  readonly units: string;
  readonly objectCount: number;
  readonly objectKindSummary: string;
  readonly sketchCount: number;
  readonly sketchEntityCount: number;
  readonly transactionCount: number;
  readonly redoTransactionCount: number;
}

export type ProjectJsonPreview =
  | {
      readonly status: "empty";
    }
  | {
      readonly status: "valid";
      readonly project: CadProject;
      readonly summary: ProjectJsonSummary;
    }
  | {
      readonly status: "invalid";
      readonly message: string;
      readonly issues: readonly CadProjectImportIssue[];
    };

export function summarizeCadProject(project: CadProject): ProjectJsonSummary {
  return {
    schemaVersion: project.schemaVersion,
    units: project.document.units,
    objectCount: project.document.objects.length,
    objectKindSummary: summarizeObjectKinds(project),
    sketchCount: project.document.sketches.length,
    sketchEntityCount: project.document.sketches.reduce(
      (total, sketch) => total + sketch.entities.length,
      0
    ),
    transactionCount: project.history.length,
    redoTransactionCount: project.redoStack.length
  };
}

export function createProjectJsonPreview(json: string): ProjectJsonPreview {
  if (json.trim().length === 0) {
    return { status: "empty" };
  }

  try {
    const project = parseCadProjectJson(json);
    importCadProject(project);

    return {
      status: "valid",
      project,
      summary: summarizeCadProject(project)
    };
  } catch (error) {
    return {
      status: "invalid",
      message: formatCadProjectImportError(error),
      issues: error instanceof CadProjectImportError ? error.issues : []
    };
  }
}

export function formatProjectJsonSummary(summary: ProjectJsonSummary): string {
  const redo =
    summary.redoTransactionCount > 0
      ? `, ${summary.redoTransactionCount} redo`
      : "";
  const objectKinds =
    summary.objectCount > 0 ? ` (${summary.objectKindSummary})` : "";
  const sketches =
    summary.sketchCount > 0
      ? `, ${summary.sketchCount} sketch(es), ${summary.sketchEntityCount} sketch entity(ies)`
      : "";

  return `${summary.schemaVersion}, ${summary.objectCount} object(s)${objectKinds}${sketches}, ${summary.transactionCount} transaction(s)${redo}`;
}

export function getProjectImportStatusText(
  preview: ProjectJsonPreview
): string {
  if (preview.status === "empty") {
    return "Generate, load, or paste project JSON to preview source-of-truth data before import.";
  }

  if (preview.status === "invalid") {
    return "Import is blocked until the project JSON validates successfully.";
  }

  return `Ready to import ${formatProjectJsonSummary(preview.summary)}. Import replaces the current document and restores available undo/redo history.`;
}

function summarizeObjectKinds(project: CadProject): string {
  const counts = new Map<string, number>();

  for (const object of project.document.objects) {
    counts.set(object.kind, (counts.get(object.kind) ?? 0) + 1);
  }

  if (counts.size === 0) {
    return "none";
  }

  const orderedKinds = ["box", "cylinder", "sphere", "cone", "torus"];

  return orderedKinds
    .filter((kind) => counts.has(kind))
    .map((kind) => `${kind} ${counts.get(kind)}`)
    .join(", ");
}
