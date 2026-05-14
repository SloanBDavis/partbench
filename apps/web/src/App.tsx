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
