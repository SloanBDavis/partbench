import {
  CadEngine,
  type CadDocument,
  type SceneObject
} from "@web-cad/cad-core";
import type {
  CadBatchMode,
  CadBatchResponse,
  CadOp
} from "@web-cad/cad-protocol";
import {
  createDefaultCamera,
  orbitCamera,
  panCamera,
  pickPrimitive,
  renderCanvasScene,
  type RenderCamera,
  type RenderPrimitive,
  zoomCamera
} from "@web-cad/renderer";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildBatch,
  buildCreateBoxOp,
  buildCreateCylinderOp,
  buildDeleteObjectOp,
  buildOperationFromBatchForm,
  buildUpdateTransformOp,
  transformToForm,
  type BatchOperationForm,
  type BatchOperationKind,
  type PrimitiveCommandForm,
  type TransformCommandForm
} from "./cadCommands";
import "./styles.css";

const engine = new CadEngine();

const quickBoxForm: PrimitiveCommandForm = {
  id: "",
  width: 2.4,
  height: 1.8,
  depth: 1.6,
  radius: 0.9,
  translationX: 0,
  translationY: 0,
  translationZ: 0.8
};

const quickCylinderForm: PrimitiveCommandForm = {
  id: "",
  width: 2,
  height: 2.2,
  depth: 2,
  radius: 0.9,
  translationX: 0,
  translationY: 0,
  translationZ: 1.1
};

const initialBatchForm: BatchOperationForm = {
  op: "scene.createBox",
  id: "",
  targetId: "",
  width: 2,
  height: 2,
  depth: 2,
  radius: 1,
  translationX: 0,
  translationY: 0,
  translationZ: 1,
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
  scaleX: 1,
  scaleY: 1,
  scaleZ: 1
};

export function App() {
  const [document, setDocument] = useState<CadDocument>(() =>
    engine.getDocument()
  );
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [batchForm, setBatchForm] =
    useState<BatchOperationForm>(initialBatchForm);
  const [queuedOps, setQueuedOps] = useState<readonly CadOp[]>([]);
  const [batchResponse, setBatchResponse] = useState<
    CadBatchResponse | undefined
  >();
  const [batchError, setBatchError] = useState<string | undefined>();

  const sceneObjects = useMemo(
    () => [...document.objects.values()],
    [document]
  );
  const primitives = useMemo(
    () => sceneObjects.map(toRenderPrimitive),
    [sceneObjects]
  );
  const selectedObject = selectedId
    ? document.objects.get(selectedId)
    : undefined;

  function syncDocument(nextSelectedId = selectedId) {
    const nextDocument = engine.getDocument();
    setDocument(nextDocument);
    setSelectedId(
      nextSelectedId && nextDocument.objects.has(nextSelectedId)
        ? nextSelectedId
        : undefined
    );
  }

  function createBox() {
    const offset = document.objects.size * 2.8;
    const result = engine.apply(
      buildCreateBoxOp({
        ...quickBoxForm,
        translationX: offset
      })
    );
    syncDocument(result.transaction.diff.created[0]?.id);
  }

  function createCylinder() {
    const offset = document.objects.size * 2.8;
    const result = engine.apply(
      buildCreateCylinderOp({
        ...quickCylinderForm,
        translationX: offset
      })
    );
    syncDocument(result.transaction.diff.created[0]?.id);
  }

  function updateSelectedTransform(form: TransformCommandForm) {
    if (!selectedObject) {
      return;
    }

    engine.apply(buildUpdateTransformOp(selectedObject.id, form));
    syncDocument(selectedObject.id);
  }

  function deleteSelectedObject() {
    if (!selectedObject) {
      return;
    }

    engine.apply(buildDeleteObjectOp(selectedObject.id));
    syncDocument(undefined);
  }

  function undo() {
    engine.undo();
    syncDocument();
  }

  function redo() {
    const result = engine.redo();
    syncDocument(result?.transaction.diff.created[0]?.id ?? selectedId);
  }

  function addBatchOperation() {
    try {
      const op = buildOperationFromBatchForm(batchForm);
      setQueuedOps((ops) => [...ops, op]);
      setBatchResponse(undefined);
      setBatchError(undefined);
    } catch (error) {
      setBatchError(
        error instanceof Error ? error.message : "Invalid command."
      );
    }
  }

  function runBatch(mode: CadBatchMode) {
    const response = engine.executeBatch(buildBatch(mode, queuedOps));
    setBatchResponse(response);
    setBatchError(undefined);

    if (response.ok && mode === "commit") {
      syncDocument(response.createdIds[0] ?? selectedId);
    }
  }

  function clearBatch() {
    setQueuedOps([]);
    setBatchResponse(undefined);
    setBatchError(undefined);
  }

  return (
    <main className="app-shell">
      <header className="app-toolbar">
        <div>
          <p className="eyebrow">Milestone 2</p>
          <h1>Web CAD</h1>
        </div>
        <div className="toolbar-actions" aria-label="Command controls">
          <button type="button" onClick={createBox}>
            Create box
          </button>
          <button type="button" onClick={createCylinder}>
            Create cylinder
          </button>
          <button
            type="button"
            onClick={undo}
            disabled={engine.getTransactions().length === 0}
          >
            Undo
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={engine.getRedoStack().length === 0}
          >
            Redo
          </button>
        </div>
      </header>

      <section className="workspace" aria-label="CAD workspace">
        <aside className="object-tree" aria-label="Scene objects">
          <section>
            <h2>Objects</h2>
            {sceneObjects.length === 0 ? (
              <p className="empty-state">No objects</p>
            ) : (
              <ul>
                {sceneObjects.map((object) => (
                  <li key={object.id}>
                    <button
                      type="button"
                      className={object.id === selectedId ? "selected" : ""}
                      onClick={() => setSelectedId(object.id)}
                    >
                      <span>{object.id}</span>
                      <strong>{object.kind}</strong>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <BatchPanel
            form={batchForm}
            onChange={setBatchForm}
            queuedOps={queuedOps}
            response={batchResponse}
            error={batchError}
            onAddOperation={addBatchOperation}
            onDryRun={() => runBatch("dryRun")}
            onCommit={() => runBatch("commit")}
            onClear={clearBatch}
          />
        </aside>

        <ViewportCanvas
          primitives={primitives}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />

        <Inspector
          object={selectedObject}
          onApplyTransform={updateSelectedTransform}
          onDelete={deleteSelectedObject}
        />
      </section>
    </main>
  );
}

function BatchPanel({
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
        form.op === "scene.deleteObject") && (
        <TextField
          label="Target ID"
          value={form.targetId}
          onChange={(targetId) => onChange({ ...form, targetId })}
        />
      )}

      {form.op === "scene.createBox" && (
        <DimensionFields
          form={form}
          onChange={onChange}
          fields={["width", "height", "depth"]}
        />
      )}

      {form.op === "scene.createCylinder" && (
        <DimensionFields
          form={form}
          onChange={onChange}
          fields={["radius", "height"]}
        />
      )}

      {form.op !== "scene.deleteObject" && (
        <TransformFields form={form} onChange={onChange} compact />
      )}

      <div className="button-row">
        <button type="button" onClick={onAddOperation}>
          Add operation
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={queuedOps.length === 0}
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
          disabled={queuedOps.length === 0}
        >
          Dry run
        </button>
        <button
          type="button"
          onClick={onCommit}
          disabled={queuedOps.length === 0}
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

function ViewportCanvas({
  onSelect,
  primitives,
  selectedId
}: {
  readonly onSelect: (id: string | undefined) => void;
  readonly primitives: readonly RenderPrimitive[];
  readonly selectedId?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [camera, setCamera] = useState<RenderCamera>(() =>
    createDefaultCamera()
  );
  const [size, setSize] = useState({ width: 900, height: 600 });
  const pointerRef = useRef<
    | {
        readonly id: number;
        readonly x: number;
        readonly y: number;
        readonly mode: "orbit" | "pan";
        readonly moved: boolean;
      }
    | undefined
  >(undefined);

  useEffect(() => {
    const wrapper = wrapperRef.current;

    if (!wrapper) {
      return undefined;
    }

    const observer = new ResizeObserver(([entry]) => {
      const { height, width } = entry.contentRect;
      setSize({
        width: Math.max(width, 320),
        height: Math.max(height, 240)
      });
    });
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(size.width * ratio);
    canvas.height = Math.round(size.height * ratio);
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    renderCanvasScene(context, {
      primitives,
      camera,
      size,
      selectedId
    });
  }, [camera, primitives, selectedId, size]);

  return (
    <section className="viewport-panel" aria-label="3D viewport">
      <div
        ref={wrapperRef}
        className="viewport-frame"
        onContextMenu={(event) => event.preventDefault()}
      >
        <canvas
          ref={canvasRef}
          aria-label="3D scene viewport"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            pointerRef.current = {
              id: event.pointerId,
              x: event.clientX,
              y: event.clientY,
              mode:
                event.shiftKey || event.button === 1 || event.button === 2
                  ? "pan"
                  : "orbit",
              moved: false
            };
          }}
          onPointerMove={(event) => {
            const pointer = pointerRef.current;

            if (!pointer || pointer.id !== event.pointerId) {
              return;
            }

            const delta = {
              x: event.clientX - pointer.x,
              y: event.clientY - pointer.y
            };

            if (Math.abs(delta.x) + Math.abs(delta.y) > 2) {
              pointerRef.current = {
                ...pointer,
                x: event.clientX,
                y: event.clientY,
                moved: true
              };
              setCamera((current) =>
                pointer.mode === "pan"
                  ? panCamera(current, delta, size)
                  : orbitCamera(current, delta)
              );
            }
          }}
          onPointerUp={(event) => {
            const pointer = pointerRef.current;

            if (!pointer || pointer.id !== event.pointerId) {
              return;
            }

            event.currentTarget.releasePointerCapture(event.pointerId);
            pointerRef.current = undefined;

            if (pointer.moved) {
              return;
            }

            const rect = event.currentTarget.getBoundingClientRect();
            const id = pickPrimitive(primitives, camera, size, {
              x: event.clientX - rect.left,
              y: event.clientY - rect.top
            });
            onSelect(id);
          }}
          onWheel={(event) => {
            event.preventDefault();
            setCamera((current) => zoomCamera(current, event.deltaY));
          }}
        />
      </div>
    </section>
  );
}

function Inspector({
  object,
  onApplyTransform,
  onDelete
}: {
  readonly object?: SceneObject;
  readonly onApplyTransform: (form: TransformCommandForm) => void;
  readonly onDelete: () => void;
}) {
  return (
    <aside className="inspector" aria-label="Inspector">
      <h2>Inspector</h2>
      {!object ? (
        <p className="empty-state">No selection</p>
      ) : (
        <>
          <dl>
            <div>
              <dt>ID</dt>
              <dd>{object.id}</dd>
            </div>
            <div>
              <dt>Type</dt>
              <dd>{object.kind}</dd>
            </div>
            <div>
              <dt>Dimensions</dt>
              <dd>{formatDimensions(object)}</dd>
            </div>
            <div>
              <dt>Translation</dt>
              <dd>{formatVector(object.transform.translation)}</dd>
            </div>
            <div>
              <dt>Rotation</dt>
              <dd>{formatVector(object.transform.rotation)}</dd>
            </div>
            <div>
              <dt>Scale</dt>
              <dd>{formatVector(object.transform.scale)}</dd>
            </div>
          </dl>
          <TransformEditor
            key={`${object.id}-${object.transform.translation.join(",")}-${object.transform.rotation.join(",")}-${object.transform.scale.join(",")}`}
            object={object}
            onApply={onApplyTransform}
            onDelete={onDelete}
          />
        </>
      )}
    </aside>
  );
}

function TransformEditor({
  object,
  onApply,
  onDelete
}: {
  readonly object: SceneObject;
  readonly onApply: (form: TransformCommandForm) => void;
  readonly onDelete: () => void;
}) {
  const [form, setForm] = useState<TransformCommandForm>(() =>
    transformToForm(object.transform)
  );

  return (
    <section className="command-card">
      <h3>Selected commands</h3>
      <TransformFields form={form} onChange={setForm} />
      <div className="button-row">
        <button type="button" onClick={() => onApply(form)}>
          Apply transform
        </button>
        <button type="button" className="danger" onClick={onDelete}>
          Delete object
        </button>
      </div>
    </section>
  );
}

function DimensionFields<TForm extends BatchOperationForm>({
  fields,
  form,
  onChange
}: {
  readonly fields: readonly ("width" | "height" | "depth" | "radius")[];
  readonly form: TForm;
  readonly onChange: (form: TForm) => void;
}) {
  return (
    <div className="field-grid two">
      {fields.map((field) => (
        <NumberField
          key={field}
          label={field}
          value={form[field]}
          onChange={(value) => onChange({ ...form, [field]: value })}
        />
      ))}
    </div>
  );
}

function TransformFields<TForm extends TransformCommandForm>({
  compact = false,
  form,
  onChange
}: {
  readonly compact?: boolean;
  readonly form: TForm;
  readonly onChange: (form: TForm) => void;
}) {
  return (
    <div className={compact ? "transform-fields compact" : "transform-fields"}>
      <fieldset>
        <legend>Translation</legend>
        <VectorFields
          keys={["translationX", "translationY", "translationZ"]}
          form={form}
          onChange={onChange}
        />
      </fieldset>
      <fieldset>
        <legend>Rotation</legend>
        <VectorFields
          keys={["rotationX", "rotationY", "rotationZ"]}
          form={form}
          onChange={onChange}
        />
      </fieldset>
      <fieldset>
        <legend>Scale</legend>
        <VectorFields
          keys={["scaleX", "scaleY", "scaleZ"]}
          form={form}
          onChange={onChange}
        />
      </fieldset>
    </div>
  );
}

function VectorFields<TForm extends TransformCommandForm>({
  form,
  keys,
  onChange
}: {
  readonly form: TForm;
  readonly keys: readonly (keyof TransformCommandForm)[];
  readonly onChange: (form: TForm) => void;
}) {
  return (
    <div className="field-grid three">
      {keys.map((key) => (
        <NumberField
          key={key}
          label={key.toString().slice(-1).toUpperCase()}
          value={form[key]}
          onChange={(value) => onChange({ ...form, [key]: value })}
        />
      ))}
    </div>
  );
}

function TextField({
  label,
  onChange,
  placeholder,
  value
}: {
  readonly label: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly value: string;
}) {
  return (
    <label>
      {label}
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </label>
  );
}

function NumberField({
  label,
  onChange,
  value
}: {
  readonly label: string;
  readonly onChange: (value: number) => void;
  readonly value: number;
}) {
  return (
    <label>
      {label}
      <input
        type="number"
        value={value}
        step="0.1"
        onChange={(event) => onChange(event.currentTarget.valueAsNumber || 0)}
      />
    </label>
  );
}

function toRenderPrimitive(object: SceneObject): RenderPrimitive {
  if (object.kind === "box") {
    return {
      id: object.id,
      kind: "box",
      dimensions: object.dimensions,
      transform: object.transform
    };
  }

  return {
    id: object.id,
    kind: "cylinder",
    dimensions: object.dimensions,
    transform: object.transform
  };
}

function summarizeOp(op: CadOp): string {
  if (op.op === "scene.createBox" || op.op === "scene.createCylinder") {
    return `${op.op}${op.id ? ` ${op.id}` : ""}`;
  }

  return `${op.op} ${op.id}`;
}

function formatDimensions(object: SceneObject): string {
  if (object.kind === "box") {
    const { depth, height, width } = object.dimensions;
    return `${formatNumber(width)} x ${formatNumber(height)} x ${formatNumber(depth)}`;
  }

  const { height, radius } = object.dimensions;
  return `r ${formatNumber(radius)}, h ${formatNumber(height)}`;
}

function formatVector(vector: readonly [number, number, number]): string {
  return vector.map(formatNumber).join(", ");
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? value.toString() : value.toFixed(2);
}
