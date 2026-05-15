export interface ProjectJsonPanelProps {
  readonly disabled: boolean;
  readonly projectJson: string;
  readonly message?: string;
  readonly messageTone?: "info" | "error";
  readonly onProjectJsonChange: (projectJson: string) => void;
  readonly onExport: () => void;
  readonly onImport: () => void;
}

export function ProjectJsonPanel({
  disabled,
  projectJson,
  message,
  messageTone = "info",
  onProjectJsonChange,
  onExport,
  onImport
}: ProjectJsonPanelProps) {
  return (
    <section className="project-panel" aria-label="Project JSON">
      <h2>Project JSON</h2>
      <div className="button-row">
        <button type="button" onClick={onExport} disabled={disabled}>
          Export JSON
        </button>
        <button
          type="button"
          onClick={onImport}
          disabled={disabled || projectJson.trim().length === 0}
        >
          Import JSON
        </button>
      </div>
      <textarea
        value={projectJson}
        onChange={(event) => onProjectJsonChange(event.currentTarget.value)}
        placeholder="Export or paste Web CAD project JSON"
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
