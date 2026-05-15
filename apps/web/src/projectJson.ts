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

  return `${summary.schemaVersion}, ${summary.objectCount} object(s), ${summary.transactionCount} transaction(s)${redo}`;
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
