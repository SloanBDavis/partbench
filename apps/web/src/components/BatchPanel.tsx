import type { CadBatchResponse, CadOp } from "@web-cad/cad-protocol";
import type { BatchOperationForm, BatchOperationKind } from "../cadCommands";
import { DimensionFields, TextField, TransformFields } from "./FormFields";

export function BatchPanel({
  disabled = false,
  error,
  form,
  onAddOperation,
  onChange,
  onClear,
  onCommit,
  onDryRun,
  queuedOps,
  response
}: {
  readonly disabled?: boolean;
  readonly error?: string;
  readonly form: BatchOperationForm;
  readonly onAddOperation: () => void;
  readonly onChange: (form: BatchOperationForm) => void;
  readonly onClear: () => void;
  readonly onCommit: () => void;
  readonly onDryRun: () => void;
  readonly queuedOps: readonly CadOp[];
  readonly response?: CadBatchResponse;
}) {
  return (
    <section className="batch-panel" aria-label="Batch command panel">
      <h2>Batch</h2>
      <label>
        Operation
        <select
          value={form.op}
          disabled={disabled}
          onChange={(event) =>
            onChange({
              ...form,
              op: event.currentTarget.value as BatchOperationKind
            })
          }
        >
          <option value="scene.createBox">Create box</option>
          <option value="scene.createCylinder">Create cylinder</option>
          <option value="scene.updateTransform">Update transform</option>
          <option value="scene.updateBoxDimensions">
            Update box dimensions
          </option>
          <option value="scene.updateCylinderDimensions">
            Update cylinder dimensions
          </option>
          <option value="scene.deleteObject">Delete object</option>
        </select>
      </label>

      {(form.op === "scene.createBox" ||
        form.op === "scene.createCylinder") && (
        <TextField
          label="New ID"
          value={form.id}
          placeholder="auto"
          onChange={(id) => onChange({ ...form, id })}
        />
      )}

      {(form.op === "scene.updateTransform" ||
        form.op === "scene.updateBoxDimensions" ||
        form.op === "scene.updateCylinderDimensions" ||
        form.op === "scene.deleteObject") && (
        <TextField
          label="Target ID"
          value={form.targetId}
          onChange={(targetId) => onChange({ ...form, targetId })}
        />
      )}

      {(form.op === "scene.createBox" ||
        form.op === "scene.updateBoxDimensions") && (
        <DimensionFields
          form={form}
          onChange={onChange}
          fields={["width", "height", "depth"]}
        />
      )}

      {(form.op === "scene.createCylinder" ||
        form.op === "scene.updateCylinderDimensions") && (
        <DimensionFields
          form={form}
          onChange={onChange}
          fields={["radius", "height"]}
        />
      )}

      {(form.op === "scene.createBox" ||
        form.op === "scene.createCylinder" ||
        form.op === "scene.updateTransform") && (
        <TransformFields form={form} onChange={onChange} compact />
      )}

      <div className="button-row">
        <button type="button" onClick={onAddOperation} disabled={disabled}>
          Add operation
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={disabled || queuedOps.length === 0}
        >
          Clear
        </button>
      </div>

      <ol className="batch-list">
        {queuedOps.map((op, index) => (
          <li key={`${op.op}-${index}`}>
            <code>{summarizeOp(op)}</code>
          </li>
        ))}
      </ol>

      <div className="button-row">
        <button
          type="button"
          onClick={onDryRun}
          disabled={disabled || queuedOps.length === 0}
        >
          Dry run
        </button>
        <button
          type="button"
          onClick={onCommit}
          disabled={disabled || queuedOps.length === 0}
        >
          Commit batch
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}
      {response && <BatchResponseView response={response} />}
    </section>
  );
}

function BatchResponseView({
  response
}: {
  readonly response: CadBatchResponse;
}) {
  if (!response.ok) {
    return (
      <section className="batch-response error-response">
        <h3>{response.mode} failed</h3>
        <p>{response.error.message}</p>
        <code>{response.error.code}</code>
      </section>
    );
  }

  return (
    <section className="batch-response">
      <h3>{response.mode} OK</h3>
      {response.transactionId && <p>Transaction: {response.transactionId}</p>}
      <DiffIds label="Created" ids={response.createdIds} />
      <DiffIds label="Modified" ids={response.modifiedIds} />
      <DiffIds label="Deleted" ids={response.deletedIds} />
      <DiffIds label="Warnings" ids={response.warnings} />
    </section>
  );
}

function DiffIds({
  ids,
  label
}: {
  readonly ids: readonly string[];
  readonly label: string;
}) {
  return (
    <p>
      <span>{label}:</span> {ids.length > 0 ? ids.join(", ") : "none"}
    </p>
  );
}

function summarizeOp(op: CadOp): string {
  if (op.op === "scene.createBox" || op.op === "scene.createCylinder") {
    return `${op.op}${op.id ? ` ${op.id}` : ""}`;
  }

  return `${op.op} ${op.id}`;
}
