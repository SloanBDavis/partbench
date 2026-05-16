import { useRef } from "react";
import {
  getProjectImportStatusText,
  type ProjectJsonPreview,
  type ProjectJsonSummary
} from "../projectJson";

export interface ProjectJsonPanelProps {
  readonly disabled: boolean;
  readonly projectJson: string;
  readonly currentSummary: ProjectJsonSummary;
  readonly message?: string;
  readonly messageTone?: "info" | "error";
  readonly preview: ProjectJsonPreview;
  readonly onProjectJsonChange: (projectJson: string) => void;
  readonly onProjectFileLoaded: (projectJson: string, fileName: string) => void;
  readonly onProjectFileError: (message: string) => void;
  readonly onExport: () => void;
  readonly onDownload: () => void;
  readonly onImport: () => void;
}

export function ProjectJsonPanel({
  currentSummary,
  disabled,
  projectJson,
  message,
  messageTone = "info",
  preview,
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
      <ProjectSummary title="Current" summary={currentSummary} />
      <div className="button-row">
        <button type="button" onClick={onExport} disabled={disabled}>
          Generate export
        </button>
        <button type="button" onClick={onDownload} disabled={disabled}>
          Download project
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
        >
          Load file
        </button>
        <button
          type="button"
          onClick={onImport}
          disabled={disabled || preview.status !== "valid"}
        >
          Import project
        </button>
      </div>
      <input
        ref={fileInputRef}
        className="hidden-file-input"
        type="file"
        accept="application/json,.json"
        disabled={disabled}
        onChange={(event) => {
          void loadProjectFile(event.currentTarget.files?.[0]);
          event.currentTarget.value = "";
        }}
      />
      <p className="project-import-status">
        {getProjectImportStatusText(preview)}
      </p>
      <ProjectPreview preview={preview} />
      <textarea
        value={projectJson}
        onChange={(event) => onProjectJsonChange(event.currentTarget.value)}
        placeholder="Generate, load, or paste Web CAD project JSON"
        spellCheck={false}
      />
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

function ProjectPreview({ preview }: { readonly preview: ProjectJsonPreview }) {
  if (preview.status === "empty") {
    return <p className="empty-state compact">No import preview</p>;
  }

  if (preview.status === "valid") {
    return <ProjectSummary title="Import preview" summary={preview.summary} />;
  }

  return (
    <section
      className="project-validation"
      aria-label="Import validation errors"
    >
      <h3>Import validation</h3>
      <p className="error-text">{preview.message}</p>
      {preview.issues.length > 0 && (
        <ul>
          {preview.issues.map((issue, index) => (
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
