import {
  CadProjectImportError,
  CURRENT_CAD_PROJECT_FORMAT_VERSION,
  formatCadProjectImportError,
  importCadProject,
  parseCadProjectJson,
  type CadProject
} from "@web-cad/cad-core";

export interface ProjectJsonSummary {
  readonly schemaVersion: string;
  readonly units: string;
  readonly objectCount: number;
  readonly objectKindSummary: string;
  readonly sketchCount: number;
  readonly sketchEntityCount: number;
  readonly authoredFeatureCount: number;
  readonly namedReferenceCount: number;
  readonly transactionCount: number;
  readonly redoTransactionCount: number;
}

export interface ProjectJsonValidationIssue {
  readonly code: string;
  readonly path: string;
  readonly message: string;
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
      readonly issues: readonly ProjectJsonValidationIssue[];
    };

export type ProjectJsonDraftSource =
  | {
      readonly kind: "empty";
    }
  | {
      readonly kind: "generatedExport";
    }
  | {
      readonly kind: "downloadedExport";
      readonly fileName: string;
    }
  | {
      readonly kind: "loadedFile";
      readonly fileName: string;
    }
  | {
      readonly kind: "edited";
    };

export interface ProjectJsonCurrentWorkflowState {
  readonly summary: ProjectJsonSummary;
  readonly sourceLabel: string;
  readonly sourceDetail: string;
}

export interface ProjectJsonDraftSourceState {
  readonly kind: ProjectJsonDraftSource["kind"];
  readonly label: string;
  readonly detail: string;
  readonly fileName?: string;
}

export type ProjectJsonSchemaWorkflowState =
  | {
      readonly status: "empty";
      readonly label: string;
      readonly detail: string;
    }
  | {
      readonly status: "current";
      readonly label: string;
      readonly detail: string;
      readonly sourceSchemaVersion: string;
      readonly normalizedSchemaVersion: string;
    }
  | {
      readonly status: "legacyMigrated";
      readonly label: string;
      readonly detail: string;
      readonly sourceSchemaVersion: string;
      readonly normalizedSchemaVersion: string;
    }
  | {
      readonly status: "invalid";
      readonly label: string;
      readonly detail: string;
      readonly sourceSchemaVersion?: string;
    };

export interface ProjectJsonImportImpact {
  readonly wouldReplaceCurrentDocument: boolean;
  readonly sameDocumentSourceAsCurrent: boolean;
  readonly restoresUndoRedoHistory: boolean;
  readonly undoTransactionCount: number;
  readonly redoTransactionCount: number;
  readonly label: string;
  readonly detail: string;
  readonly historyDetail: string;
}

export interface ProjectJsonDraftWorkflowState {
  readonly source: ProjectJsonDraftSourceState;
  readonly preview: ProjectJsonPreview;
  readonly schema: ProjectJsonSchemaWorkflowState;
  readonly impact?: ProjectJsonImportImpact;
  readonly validationIssues: readonly ProjectJsonValidationIssue[];
}

export interface ProjectJsonWorkflowState {
  readonly current: ProjectJsonCurrentWorkflowState;
  readonly draft: ProjectJsonDraftWorkflowState;
}

export function summarizeCadProject(project: CadProject): ProjectJsonSummary {
  const authoredBodyCount = project.document.features.length;

  return {
    schemaVersion: project.schemaVersion,
    units: project.document.units,
    objectCount: project.document.objects.length + authoredBodyCount,
    objectKindSummary: summarizeObjectKinds(project, authoredBodyCount),
    sketchCount: project.document.sketches.length,
    sketchEntityCount: project.document.sketches.reduce(
      (total, sketch) => total + sketch.entities.length,
      0
    ),
    authoredFeatureCount: project.document.features.length,
    namedReferenceCount: project.document.namedReferences.length,
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
      issues:
        error instanceof CadProjectImportError
          ? error.issues
          : [
              {
                code: "IMPORT_PREVIEW_ERROR",
                path: "$",
                message: formatCadProjectImportError(error)
              }
            ]
    };
  }
}

export function createProjectJsonWorkflowState({
  currentProject,
  draftJson,
  draftSource
}: {
  readonly currentProject: CadProject;
  readonly draftJson: string;
  readonly draftSource: ProjectJsonDraftSource;
}): ProjectJsonWorkflowState {
  const currentSummary = summarizeCadProject(currentProject);
  const preview = createProjectJsonPreview(draftJson);
  const sourceSchemaVersion = readProjectSchemaVersion(draftJson);
  const schema = createProjectJsonSchemaWorkflowState(
    preview,
    sourceSchemaVersion
  );
  const impact =
    preview.status === "valid"
      ? createProjectJsonImportImpact(currentProject, preview.project)
      : undefined;

  return {
    current: {
      summary: currentSummary,
      sourceLabel: "Current project",
      sourceDetail:
        "JSON import/export carries project data plus undo and redo history only."
    },
    draft: {
      source: createProjectJsonDraftSourceState(draftSource),
      preview,
      schema,
      impact,
      validationIssues: preview.status === "invalid" ? preview.issues : []
    }
  };
}

export function createProjectJsonDraftSourceForEditorValue(
  projectJson: string
): ProjectJsonDraftSource {
  return projectJson.trim().length === 0
    ? { kind: "empty" }
    : { kind: "edited" };
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
  const features =
    summary.authoredFeatureCount > 0
      ? `, ${summary.authoredFeatureCount} authored feature(s)`
      : "";
  const namedReferences =
    summary.namedReferenceCount > 0
      ? `, ${summary.namedReferenceCount} named reference(s)`
      : "";

  return `${summary.objectCount} object(s)${objectKinds}${sketches}${features}${namedReferences}, ${summary.transactionCount} transaction(s)${redo}`;
}

export function getProjectImportStatusText(
  preview: ProjectJsonPreview,
  impact?: ProjectJsonImportImpact
): string {
  if (preview.status === "empty") {
    return "Generate, load, or paste project JSON to preview project data before import.";
  }

  if (preview.status === "invalid") {
    return "Import is blocked until the project JSON validates successfully.";
  }

  if (impact) {
    return `${impact.detail} ${impact.historyDetail}`;
  }

  return `Ready to import ${formatProjectJsonSummary(preview.summary)}. Import replaces the current document and restores available undo/redo history.`;
}

function createProjectJsonDraftSourceState(
  source: ProjectJsonDraftSource
): ProjectJsonDraftSourceState {
  if (source.kind === "empty") {
    return {
      kind: "empty",
      label: "Empty draft",
      detail: "Generate, load, or paste JSON to create an import preview."
    };
  }

  if (source.kind === "generatedExport") {
    return {
      kind: "generatedExport",
      label: "Generated export",
      detail: "Draft was generated from the current Partbench project."
    };
  }

  if (source.kind === "downloadedExport") {
    return {
      kind: "downloadedExport",
      label: "Downloaded export",
      detail: `Last saved browser download target: ${source.fileName}.`,
      fileName: source.fileName
    };
  }

  if (source.kind === "loadedFile") {
    return {
      kind: "loadedFile",
      label: "Loaded file",
      detail: `Previewing local file: ${source.fileName}.`,
      fileName: source.fileName
    };
  }

  return {
    kind: "edited",
    label: "Pasted or edited JSON",
    detail: "Draft text has been edited in the raw JSON editor."
  };
}

function createProjectJsonSchemaWorkflowState(
  preview: ProjectJsonPreview,
  sourceSchemaVersion: string | undefined
): ProjectJsonSchemaWorkflowState {
  if (preview.status === "empty") {
    return {
      status: "empty",
      label: "No format info",
      detail: "No draft JSON is available to inspect."
    };
  }

  if (preview.status === "invalid") {
    const schemaIssue = preview.issues.find(
      (issue) => issue.path === "$.schemaVersion"
    );

    return {
      status: "invalid",
      label: "Format not recognized",
      detail:
        schemaIssue?.message ??
        "Format status is unavailable until validation succeeds.",
      ...(sourceSchemaVersion ? { sourceSchemaVersion } : {})
    };
  }

  const normalizedSchemaVersion = preview.project.schemaVersion;
  const rawSchemaVersion = sourceSchemaVersion ?? normalizedSchemaVersion;

  if (rawSchemaVersion === normalizedSchemaVersion) {
    return {
      status: "current",
      label:
        rawSchemaVersion === CURRENT_CAD_PROJECT_FORMAT_VERSION
          ? "Current format"
          : "Supported format",
      detail: `${rawSchemaVersion} imports without migration.`,
      sourceSchemaVersion: rawSchemaVersion,
      normalizedSchemaVersion
    };
  }

  return {
    status: "legacyMigrated",
    label: "Older format accepted",
    detail: `${rawSchemaVersion} will be updated to ${normalizedSchemaVersion} during import.`,
    sourceSchemaVersion: rawSchemaVersion,
    normalizedSchemaVersion
  };
}

function createProjectJsonImportImpact(
  currentProject: CadProject,
  draftProject: CadProject
): ProjectJsonImportImpact {
  const summary = summarizeCadProject(draftProject);
  const sameDocumentSourceAsCurrent =
    stableStringifyProjectSource(currentProject) ===
    stableStringifyProjectSource(draftProject);
  const restoresUndoRedoHistory =
    summary.transactionCount > 0 || summary.redoTransactionCount > 0;
  const historyDetail = restoresUndoRedoHistory
    ? `Restores ${summary.transactionCount} undo transaction(s) and ${summary.redoTransactionCount} redo transaction(s).`
    : "Draft contains no undo or redo history.";

  if (sameDocumentSourceAsCurrent) {
    return {
      wouldReplaceCurrentDocument: false,
      sameDocumentSourceAsCurrent,
      restoresUndoRedoHistory,
      undoTransactionCount: summary.transactionCount,
      redoTransactionCount: summary.redoTransactionCount,
      label: "No document source change detected",
      detail:
        "Draft project data matches the current project; import is available and may still restore undo/redo history.",
      historyDetail
    };
  }

  return {
    wouldReplaceCurrentDocument: true,
    sameDocumentSourceAsCurrent,
    restoresUndoRedoHistory,
    undoTransactionCount: summary.transactionCount,
    redoTransactionCount: summary.redoTransactionCount,
    label: "Will replace current document",
    detail: `Ready to import ${formatProjectJsonSummary(summary)}. Import replaces the current project with the draft project data.`,
    historyDetail
  };
}

function summarizeObjectKinds(
  project: CadProject,
  authoredBodyCount = 0
): string {
  const counts = new Map<string, number>();

  if (authoredBodyCount > 0) {
    counts.set("body", authoredBodyCount);
  }

  for (const object of project.document.objects) {
    counts.set(object.kind, (counts.get(object.kind) ?? 0) + 1);
  }

  if (counts.size === 0) {
    return "none";
  }

  const orderedKinds = ["body", "box", "cylinder", "sphere", "cone", "torus"];

  return orderedKinds
    .filter((kind) => counts.has(kind))
    .map((kind) => `${kind} ${counts.get(kind)}`)
    .join(", ");
}

function readProjectSchemaVersion(projectJson: string): string | undefined {
  if (projectJson.trim().length === 0) {
    return undefined;
  }

  try {
    const value = JSON.parse(projectJson) as unknown;

    return isRecord(value) && typeof value.schemaVersion === "string"
      ? value.schemaVersion
      : undefined;
  } catch {
    return undefined;
  }
}

function stableStringifyProjectSource(project: CadProject): string {
  return JSON.stringify(stabilizePlainJson(project.document));
}

function stabilizePlainJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stabilizePlainJson);
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stabilizePlainJson(value[key])])
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
