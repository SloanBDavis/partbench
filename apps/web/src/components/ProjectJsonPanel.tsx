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
  createProjectExportReadinessDisplay,
  type ProjectExportReadinessRow
} from "../projectExportReadiness";

export interface ProjectJsonPanelProps {
  readonly disabled: boolean;
  readonly exportReadiness?: ProjectExportReadinessQueryResponse;
  readonly projectJson: string;
  readonly storageCapabilities: ProjectStorageCapabilityStatus;
  readonly workflow: ProjectJsonWorkflowState;
  readonly message?: string;
  readonly messageTone?: "info" | "error";
  readonly onProjectJsonChange: (projectJson: string) => void;
  readonly onProjectFileLoaded: (projectJson: string, fileName: string) => void;
  readonly onProjectFileError: (message: string) => void;
  readonly onExport: () => void;
  readonly onDownload: () => void;
  readonly onImport: () => void;
}

export function ProjectJsonPanel({
  disabled,
  exportReadiness,
  projectJson,
  message,
  messageTone = "info",
  storageCapabilities,
  workflow,
  onProjectJsonChange,
  onProjectFileLoaded,
  onProjectFileError,
  onDownload,
  onExport,
  onImport
}: ProjectJsonPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function loadProjectFile(file: File | undefined): Promise<void> {
    if (!file) {
      return;
    }

    try {
      onProjectFileLoaded(await file.text(), file.name);
    } catch {
      onProjectFileError(`Could not read ${file.name}.`);
    }
  }

  return (
    <section className="project-panel" aria-label="Project">
      <div className="section-heading">
        <h2>Project</h2>
        <span>JSON</span>
      </div>
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
        <ProjectExportReadinessStatus exportReadiness={exportReadiness} />
      )}
      <div className="button-row">
        <button type="button" onClick={onExport} disabled={disabled}>
          Generate export
        </button>
        <button
          type="button"
          onClick={onDownload}
          disabled={disabled || !storageCapabilities.jsonDownloadAvailable}
        >
          Download project
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || !storageCapabilities.jsonUploadAvailable}
        >
          Load file
        </button>
        <button
          type="button"
          onClick={onImport}
          disabled={disabled || workflow.draft.preview.status !== "valid"}
        >
          Import project
        </button>
      </div>
      <input
        ref={fileInputRef}
        className="hidden-file-input"
        type="file"
        accept="application/json,.json"
        disabled={disabled || !storageCapabilities.jsonUploadAvailable}
        onChange={(event) => {
          void loadProjectFile(event.currentTarget.files?.[0]);
          event.currentTarget.value = "";
        }}
      />
      <p className="project-import-status">
        {getProjectImportStatusText(
          workflow.draft.preview,
          workflow.draft.impact
        )}
      </p>
      <ProjectDraftWorkflow draft={workflow.draft} />
      <details
        className="advanced-options project-json-editor"
        open={
          workflow.draft.preview.status === "invalid" ||
          workflow.draft.source.kind === "edited"
        }
      >
        <summary>JSON editor</summary>
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

function ProjectExportReadinessStatus({
  exportReadiness
}: {
  readonly exportReadiness: ProjectExportReadinessQueryResponse;
}) {
  const display = createProjectExportReadinessDisplay(exportReadiness);

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
          value="Source only"
          detail={display.derivedDetail}
        />
      </dl>
      <dl className="project-capability-list" aria-label="Export formats">
        {display.formatRows.map((row) => (
          <ProjectExportReadinessRowView key={row.id} row={row} />
        ))}
      </dl>
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
        <span>{storageCapabilities.jsonImportExport.label}</span>
      </div>
      <p className="project-workflow-detail">
        Active storage mode is ordinary JSON import/export.
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
