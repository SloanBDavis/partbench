import { useRef } from "react";
import type { ProjectExportReadinessQueryResponse } from "@web-cad/cad-protocol";
import {
  getProjectImportStatusText,
  type ProjectJsonDraftWorkflowState,
  type ProjectJsonImportImpact,
  type ProjectJsonSummary,
  type ProjectJsonWorkflowState
} from "../projectJson";
import {
  getProjectStorageAvailabilityLabel,
  type ProjectStorageCapabilityEntry,
  type ProjectStorageCapabilityStatus
} from "../projectStorageCapabilities";
import {
  createInitialProjectFileWorkflowState,
  formatSourceIdentityDetail,
  formatWcadValidationIssue,
  getProjectFileDirectSaveLabel,
  getProjectFileDirtyLabel,
  getProjectFileNameLabel,
  getProjectFileStorageModeLabel,
  summarizeWcadDiagnostics,
  type ProjectFileWorkflowState
} from "../projectWcadWorkflow";
import {
  createProjectExportReadinessDisplay,
  type ProjectExportReadinessRow,
  type ProjectVisualizationExportDisplayStatus
} from "../projectExportReadiness";

export interface ProjectJsonPanelProps {
  readonly disabled: boolean;
  readonly exportReadiness?: ProjectExportReadinessQueryResponse;
  readonly visualizationExport?: ProjectVisualizationExportDisplayStatus;
  readonly visualizationDownloadAvailable?: boolean;
  readonly projectJson: string;
  readonly projectFile?: ProjectFileWorkflowState;
  readonly storageCapabilities: ProjectStorageCapabilityStatus;
  readonly workflow: ProjectJsonWorkflowState;
  readonly message?: string;
  readonly messageTone?: "info" | "error";
  readonly onOpenWcad?: () => Promise<boolean>;
  readonly onOpenWcadFileLoaded?: (bytes: Uint8Array, fileName: string) => void;
  readonly onProjectJsonChange: (projectJson: string) => void;
  readonly onProjectFileLoaded: (projectJson: string, fileName: string) => void;
  readonly onProjectFileError: (message: string) => void;
  readonly onSaveWcad?: () => void;
  readonly onSaveAsWcad?: () => void;
  readonly onExport: () => void;
  readonly onDownload: () => void;
  readonly onDownloadVisualization?: () => void;
  readonly onImport: () => void;
}

export function ProjectJsonPanel({
  disabled,
  exportReadiness,
  visualizationExport,
  visualizationDownloadAvailable = true,
  projectJson,
  projectFile = createInitialProjectFileWorkflowState(),
  message,
  messageTone = "info",
  storageCapabilities,
  workflow,
  onOpenWcad = async () => true,
  onOpenWcadFileLoaded = () => undefined,
  onProjectJsonChange,
  onProjectFileLoaded,
  onProjectFileError,
  onSaveWcad = () => undefined,
  onSaveAsWcad = () => undefined,
  onDownload,
  onDownloadVisualization,
  onExport,
  onImport
}: ProjectJsonPanelProps) {
  const jsonFileInputRef = useRef<HTMLInputElement | null>(null);
  const wcadFileInputRef = useRef<HTMLInputElement | null>(null);

  async function loadProjectJsonFile(file: File | undefined): Promise<void> {
    if (!file) {
      return;
    }

    try {
      onProjectFileLoaded(await file.text(), file.name);
    } catch {
      onProjectFileError(`Could not read ${file.name}.`);
    }
  }

  async function loadProjectWcadFile(file: File | undefined): Promise<void> {
    if (!file) {
      return;
    }

    try {
      onOpenWcadFileLoaded(new Uint8Array(await file.arrayBuffer()), file.name);
    } catch {
      onProjectFileError(`Could not read ${file.name}.`);
    }
  }

  async function openWcad() {
    if (storageCapabilities.fileSystemAccessAvailable) {
      const handled = await onOpenWcad();

      if (handled) {
        return;
      }
    }

    wcadFileInputRef.current?.click();
  }

  return (
    <section className="project-panel" aria-label="Project">
      <div className="section-heading">
        <h2>Project</h2>
        <span>.wcad</span>
      </div>
      <ProjectFileStatus
        projectFile={projectFile}
        storageCapabilities={storageCapabilities}
      />
      <div className="button-row">
        <button
          type="button"
          onClick={() => void openWcad()}
          disabled={
            disabled ||
            (!storageCapabilities.fileSystemAccessAvailable &&
              !storageCapabilities.wcadUploadAvailable)
          }
        >
          Open .wcad
        </button>
        <button
          type="button"
          onClick={onSaveWcad}
          disabled={
            disabled ||
            (projectFile.mode !== "wcadHandle" &&
              !storageCapabilities.fileSystemAccessAvailable &&
              !storageCapabilities.wcadDownloadAvailable)
          }
        >
          Save
        </button>
        <button
          type="button"
          onClick={onSaveAsWcad}
          disabled={
            disabled ||
            (!storageCapabilities.fileSystemAccessAvailable &&
              !storageCapabilities.wcadDownloadAvailable)
          }
        >
          Save As
        </button>
      </div>
      <input
        ref={wcadFileInputRef}
        className="hidden-file-input"
        type="file"
        accept="application/vnd.partbench.wcad,application/zip,.wcad"
        disabled={disabled || !storageCapabilities.wcadUploadAvailable}
        onChange={(event) => {
          void loadProjectWcadFile(event.currentTarget.files?.[0]);
          event.currentTarget.value = "";
        }}
      />
      <section className="project-workflow-section" aria-label="Current JSON">
        <div className="project-workflow-heading">
          <h3>Current source</h3>
          <span>{workflow.current.sourceLabel}</span>
        </div>
        <p className="project-workflow-detail">
          {workflow.current.sourceDetail}
        </p>
        <ProjectSummary
          title="Current project"
          summary={workflow.current.summary}
        />
      </section>
      <ProjectStorageStatus storageCapabilities={storageCapabilities} />
      {exportReadiness && (
        <ProjectExportReadinessStatus
          disabled={disabled}
          exportReadiness={exportReadiness}
          visualizationDownloadAvailable={visualizationDownloadAvailable}
          visualizationExport={visualizationExport}
          onDownloadVisualization={onDownloadVisualization}
        />
      )}
      <input
        ref={jsonFileInputRef}
        className="hidden-file-input"
        type="file"
        accept="application/json,.json"
        disabled={disabled || !storageCapabilities.jsonUploadAvailable}
        onChange={(event) => {
          void loadProjectJsonFile(event.currentTarget.files?.[0]);
          event.currentTarget.value = "";
        }}
      />
      <details
        className="advanced-options project-json-editor"
        open={
          workflow.draft.preview.status === "invalid" ||
          workflow.draft.source.kind === "edited"
        }
      >
        <summary>JSON interchange</summary>
        <div className="button-row compact">
          <button type="button" onClick={onExport} disabled={disabled}>
            Export JSON
          </button>
          <button
            type="button"
            onClick={onDownload}
            disabled={disabled || !storageCapabilities.jsonDownloadAvailable}
          >
            Download JSON
          </button>
          <button
            type="button"
            onClick={() => jsonFileInputRef.current?.click()}
            disabled={disabled || !storageCapabilities.jsonUploadAvailable}
          >
            Load JSON
          </button>
          <button
            type="button"
            onClick={onImport}
            disabled={disabled || workflow.draft.preview.status !== "valid"}
          >
            Import JSON
          </button>
        </div>
        <p className="project-import-status">
          {getProjectImportStatusText(
            workflow.draft.preview,
            workflow.draft.impact
          )}
        </p>
        <ProjectDraftWorkflow draft={workflow.draft} />
        <textarea
          value={projectJson}
          onChange={(event) => onProjectJsonChange(event.currentTarget.value)}
          placeholder="Generate, load, or paste Partbench project JSON"
          spellCheck={false}
        />
      </details>
      {message && (
        <p
          className={`project-message ${
            messageTone === "error" ? "error-text" : ""
          }`}
        >
          {message}
        </p>
      )}
    </section>
  );
}

function ProjectFileStatus({
  projectFile,
  storageCapabilities
}: {
  readonly projectFile: ProjectFileWorkflowState;
  readonly storageCapabilities: ProjectStorageCapabilityStatus;
}) {
  const diagnosticsSummary = summarizeWcadDiagnostics(
    projectFile.diagnostics,
    "No package diagnostics."
  );

  return (
    <section className="project-workflow-section" aria-label="Project file">
      <div className="project-workflow-heading">
        <h3>{getProjectFileNameLabel(projectFile)}</h3>
        <span>{getProjectFileDirtyLabel(projectFile.dirty)}</span>
      </div>
      <dl className="project-workflow-grid">
        <ProjectWorkflowRow
          label="Storage"
          value={getProjectFileStorageModeLabel(projectFile.mode)}
          detail={
            projectFile.lastResult?.message ??
            "Open or Save As to create a .wcad project file."
          }
        />
        <ProjectWorkflowRow
          label="Direct save"
          value={getProjectFileDirectSaveLabel(
            projectFile,
            storageCapabilities.fileSystemAccessAvailable
          )}
          detail={
            storageCapabilities.fileSystemAccessAvailable
              ? "Browser file handles are app-only permission state."
              : "Open/save uses .wcad upload and download fallback."
          }
        />
        <ProjectWorkflowRow
          label="Package"
          value={projectFile.packageVersion ?? "No package"}
          detail={
            projectFile.documentSchemaVersion
              ? `Document ${projectFile.documentSchemaVersion}`
              : "No .wcad package has been opened or saved yet."
          }
        />
        <ProjectWorkflowRow
          label="Source"
          value={
            projectFile.sourceIdentity
              ? formatSourceIdentityDetail(projectFile.sourceIdentity)
              : "No identity"
          }
          detail={diagnosticsSummary}
        />
      </dl>
      {projectFile.diagnostics.length > 0 && (
        <details className="advanced-options compact">
          <summary>Package diagnostics</summary>
          <ul className="compact-list">
            {projectFile.diagnostics.map((issue, index) => (
              <li key={`${issue.code}-${issue.entryPath ?? index}`}>
                {formatWcadValidationIssue(issue)}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function ProjectExportReadinessStatus({
  disabled,
  exportReadiness,
  visualizationDownloadAvailable,
  visualizationExport,
  onDownloadVisualization
}: {
  readonly disabled: boolean;
  readonly exportReadiness: ProjectExportReadinessQueryResponse;
  readonly visualizationDownloadAvailable: boolean;
  readonly visualizationExport?: ProjectVisualizationExportDisplayStatus;
  readonly onDownloadVisualization?: () => void;
}) {
  const display = createProjectExportReadinessDisplay(
    exportReadiness,
    visualizationExport
  );

  return (
    <section className="project-workflow-section" aria-label="Export readiness">
      <div className="project-workflow-heading">
        <h3>Export readiness</h3>
        <span>{display.statusLabel}</span>
      </div>
      <p className="project-workflow-detail">{display.detail}</p>
      <dl className="project-workflow-grid">
        <ProjectWorkflowRow
          label="Source bodies"
          value={display.bodySummary}
          detail={display.sourceDetail}
        />
        <ProjectWorkflowRow
          label="Boundary"
          value={visualizationExport ? "Source + display" : "Source only"}
          detail={display.derivedDetail}
        />
      </dl>
      <dl className="project-capability-list" aria-label="Export formats">
        {display.formatRows.map((row) => (
          <ProjectExportReadinessRowView key={row.id} row={row} />
        ))}
      </dl>
      {visualizationExport && (
        <div className="button-row compact">
          <button
            type="button"
            onClick={onDownloadVisualization}
            disabled={
              disabled ||
              !visualizationExport.available ||
              !visualizationDownloadAvailable ||
              !onDownloadVisualization
            }
          >
            Download visualization GLB
          </button>
        </div>
      )}
      {display.bodyRows.length > 0 ? (
        <dl className="project-capability-list" aria-label="Export body status">
          {display.bodyRows.map((row) => (
            <ProjectExportReadinessRowView key={row.id} row={row} />
          ))}
        </dl>
      ) : (
        <p className="empty-state compact">No candidate export bodies</p>
      )}
    </section>
  );
}

function ProjectExportReadinessRowView({
  row
}: {
  readonly row: ProjectExportReadinessRow;
}) {
  return (
    <div className={`project-capability-item ${row.status}`}>
      <dt>
        <span>{row.label}</span>
        <strong>{row.statusLabel}</strong>
      </dt>
      <dd>
        <span>{row.detail}</span>
        <span>{row.limitation}</span>
        <span>{row.nextStep}</span>
      </dd>
    </div>
  );
}

function ProjectStorageStatus({
  storageCapabilities
}: {
  readonly storageCapabilities: ProjectStorageCapabilityStatus;
}) {
  return (
    <section className="project-workflow-section" aria-label="Save/open status">
      <div className="project-workflow-heading">
        <h3>Save/open status</h3>
        <span>{storageCapabilities.wcadPackage.label}</span>
      </div>
      <p className="project-workflow-detail">
        Active storage mode is .wcad package workflow; JSON remains
        interchange/debug.
      </p>
      <dl className="project-capability-list">
        {storageCapabilities.entries.map((entry) => (
          <ProjectStorageCapabilityRow key={entry.mode} entry={entry} />
        ))}
      </dl>
    </section>
  );
}

function ProjectStorageCapabilityRow({
  entry
}: {
  readonly entry: ProjectStorageCapabilityEntry;
}) {
  return (
    <div className={`project-capability-item ${entry.availability}`}>
      <dt>
        <span>{entry.label}</span>
        <strong>
          {getProjectStorageAvailabilityLabel(entry.availability)}
        </strong>
      </dt>
      <dd>
        <span>{entry.detail}</span>
        <span>{entry.limitation}</span>
        <span>{entry.nextStep}</span>
      </dd>
    </div>
  );
}

function ProjectDraftWorkflow({
  draft
}: {
  readonly draft: ProjectJsonDraftWorkflowState;
}) {
  return (
    <section className="project-workflow-section" aria-label="Import draft">
      <div className="project-workflow-heading">
        <h3>Import draft</h3>
        <span>{getDraftStatusLabel(draft)}</span>
      </div>
      <dl className="project-workflow-grid">
        <ProjectWorkflowRow
          label="Source"
          value={draft.source.label}
          detail={draft.source.detail}
        />
        <ProjectWorkflowRow
          label="Schema"
          value={draft.schema.label}
          detail={draft.schema.detail}
        />
        <ProjectWorkflowRow
          label="Impact"
          value={draft.impact?.label ?? "Import blocked"}
          detail={
            draft.impact?.detail ??
            "A valid project draft is required before import."
          }
        />
        <ProjectWorkflowRow
          label="History"
          value={getHistoryImpactLabel(draft.impact)}
          detail={
            draft.impact?.historyDetail ??
            "Undo and redo history will be inspected after validation."
          }
        />
      </dl>
      <ProjectPreview draft={draft} />
    </section>
  );
}

function ProjectWorkflowRow({
  detail,
  label,
  value
}: {
  readonly detail: string;
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        <strong>{value}</strong>
        <span>{detail}</span>
      </dd>
    </div>
  );
}

function ProjectSummary({
  summary,
  title
}: {
  readonly summary: ProjectJsonSummary;
  readonly title: string;
}) {
  return (
    <section className="project-summary" aria-label={`${title} project`}>
      <h3>{title}</h3>
      <dl className="project-summary-grid">
        <div>
          <dt>Schema</dt>
          <dd>{summary.schemaVersion}</dd>
        </div>
        <div>
          <dt>Units</dt>
          <dd>{summary.units}</dd>
        </div>
        <div>
          <dt>Objects</dt>
          <dd>{summary.objectCount}</dd>
        </div>
        <div>
          <dt>Sketches</dt>
          <dd>{summary.sketchCount}</dd>
        </div>
        <div>
          <dt>Sketch entities</dt>
          <dd>{summary.sketchEntityCount}</dd>
        </div>
        <div>
          <dt>Types</dt>
          <dd>{summary.objectKindSummary}</dd>
        </div>
        <div>
          <dt>Transactions</dt>
          <dd>{summary.transactionCount}</dd>
        </div>
        <div>
          <dt>Redo</dt>
          <dd>{summary.redoTransactionCount}</dd>
        </div>
      </dl>
    </section>
  );
}

function ProjectPreview({
  draft
}: {
  readonly draft: ProjectJsonDraftWorkflowState;
}) {
  const preview = draft.preview;

  if (preview.status === "empty") {
    return <p className="empty-state compact">No import preview</p>;
  }

  if (preview.status === "valid") {
    return <ProjectSummary title="Preview source" summary={preview.summary} />;
  }

  return (
    <section
      className="project-validation"
      aria-label="Import validation errors"
    >
      <h3>Import validation</h3>
      <p className="error-text">{preview.message}</p>
      {draft.validationIssues.length > 0 && (
        <ul>
          {draft.validationIssues.map((issue, index) => (
            <li key={`${issue.path}:${issue.code}:${index}`}>
              <code>{issue.code}</code>
              <span>{issue.path}</span>
              <p>{issue.message}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function getDraftStatusLabel(draft: ProjectJsonDraftWorkflowState): string {
  if (draft.preview.status === "valid") {
    return "Valid";
  }

  if (draft.preview.status === "invalid") {
    return "Invalid";
  }

  return "Empty";
}

function getHistoryImpactLabel(
  impact: ProjectJsonImportImpact | undefined
): string {
  if (!impact) {
    return "Pending validation";
  }

  return impact.restoresUndoRedoHistory
    ? "Restores history"
    : "No history in draft";
}
