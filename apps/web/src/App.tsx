import {
  AsyncCadCommandExecutor,
  CadEngine,
  MockCadCommandWorker,
  type CadDocument,
  type SceneObject
} from "@web-cad/cad-core";
import type {
  CadBatchMode,
  CadBatchResponse,
  CadOp
} from "@web-cad/cad-protocol";
import type { RenderPrimitive } from "@web-cad/renderer";
import { useMemo, useState } from "react";
import {
  buildBatch,
  buildCreateBoxOp,
  buildCreateCylinderOp,
  buildDeleteObjectOp,
  buildOperationFromBatchForm,
  buildUpdateTransformOp,
  type BatchOperationForm,
  type PrimitiveCommandForm,
  type TransformCommandForm
} from "./cadCommands";
import { BatchPanel } from "./components/BatchPanel";
import { Inspector } from "./components/Inspector";
import { ViewportCanvas } from "./components/ViewportCanvas";
import "./styles.css";

const engine = new CadEngine();
const commandExecutor = new AsyncCadCommandExecutor(
  engine,
  new MockCadCommandWorker({ delayMs: 75 })
);

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
  const [commandError, setCommandError] = useState<string | undefined>();
  const [commandPending, setCommandPending] = useState(false);

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

  async function commitOps(
    ops: readonly CadOp[],
    getNextSelectedId: (response: CadBatchResponse) => string | undefined
  ) {
    setCommandPending(true);
    setCommandError(undefined);

    try {
      const response = await commandExecutor.executeBatch(
        buildBatch("commit", ops)
      );

      if (!response.ok) {
        setCommandError(response.error.message);
        return;
      }

      syncDocument(getNextSelectedId(response));
    } finally {
      setCommandPending(false);
    }
  }

  async function createBox() {
    const offset = document.objects.size * 2.8;
    await commitOps(
      [
        buildCreateBoxOp({
          ...quickBoxForm,
          translationX: offset
        })
      ],
      (response) => response.createdIds[0]
    );
  }

  async function createCylinder() {
    const offset = document.objects.size * 2.8;
    await commitOps(
      [
        buildCreateCylinderOp({
          ...quickCylinderForm,
          translationX: offset
        })
      ],
      (response) => response.createdIds[0]
    );
  }

  async function updateSelectedTransform(form: TransformCommandForm) {
    if (!selectedObject) {
      return;
    }

    const objectId = selectedObject.id;
    await commitOps([buildUpdateTransformOp(objectId, form)], () => objectId);
  }

  async function deleteSelectedObject() {
    if (!selectedObject) {
      return;
    }

    await commitOps([buildDeleteObjectOp(selectedObject.id)], () => undefined);
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

  async function runBatch(mode: CadBatchMode) {
    setCommandPending(true);

    try {
      const response = await commandExecutor.executeBatch(
        buildBatch(mode, queuedOps)
      );
      setBatchResponse(response);
      setBatchError(undefined);

      if (response.ok && mode === "commit") {
        syncDocument(response.createdIds[0] ?? selectedId);
      }
    } finally {
      setCommandPending(false);
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
          <p className="eyebrow">Milestone 3</p>
          <h1>Web CAD</h1>
        </div>
        <div className="toolbar-actions" aria-label="Command controls">
          {commandPending && (
            <span className="pending-status" role="status">
              Worker running
            </span>
          )}
          <button
            type="button"
            onClick={() => void createBox()}
            disabled={commandPending}
          >
            Create box
          </button>
          <button
            type="button"
            onClick={() => void createCylinder()}
            disabled={commandPending}
          >
            Create cylinder
          </button>
          <button
            type="button"
            onClick={undo}
            disabled={commandPending || engine.getTransactions().length === 0}
          >
            Undo
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={commandPending || engine.getRedoStack().length === 0}
          >
            Redo
          </button>
        </div>
        {commandError && <p className="toolbar-error">{commandError}</p>}
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
            disabled={commandPending}
            form={batchForm}
            onChange={setBatchForm}
            queuedOps={queuedOps}
            response={batchResponse}
            error={batchError}
            onAddOperation={addBatchOperation}
            onDryRun={() => void runBatch("dryRun")}
            onCommit={() => void runBatch("commit")}
            onClear={clearBatch}
          />
        </aside>

        <ViewportCanvas
          primitives={primitives}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />

        <Inspector
          disabled={commandPending}
          object={selectedObject}
          onApplyTransform={(form) => void updateSelectedTransform(form)}
          onDelete={() => void deleteSelectedObject()}
        />
      </section>
    </main>
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
