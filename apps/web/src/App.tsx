import {
  AsyncCadCommandExecutor,
  CadEngine,
  exportCadProjectJson,
  parseCadProjectJson,
  type CadDocument,
  type SceneObject
} from "@web-cad/cad-core";
import type {
  CadBatchMode,
  CadBatchResponse,
  CadOp
} from "@web-cad/cad-protocol";
import { createOcctMeshDevRuntime } from "@web-cad/occt-mesh-dev-runtime";
import type { RenderPrimitive, RenderTriangleMesh } from "@web-cad/renderer";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { BrowserCadCommandWorker } from "./browserCadCommandWorker";
import { BatchPanel } from "./components/BatchPanel";
import { Inspector } from "./components/Inspector";
import { ViewportCanvas } from "./components/ViewportCanvas";
import {
  createOcctMeshDevErrorDetails,
  formatMetricMs,
  formatOcctMeshDevError,
  type OcctMeshDevErrorDetails,
  type OcctMeshDevMetrics,
  type OcctMeshDevRuntime
} from "./occtMeshDev";
import "./styles.css";

const engine = new CadEngine();
const commandExecutor = new AsyncCadCommandExecutor(
  engine,
  new BrowserCadCommandWorker()
);
const occtMeshDevEnabled = __WEB_CAD_OCCT_MESH_DEV__;

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
  const occtMeshDevRuntimeRef = useRef<OcctMeshDevRuntime | undefined>(
    undefined
  );
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
  const [projectJson, setProjectJson] = useState("");
  const [projectMessage, setProjectMessage] = useState<string | undefined>();
  const [occtMeshes, setOcctMeshes] = useState<readonly RenderTriangleMesh[]>(
    []
  );
  const [occtPending, setOcctPending] = useState(false);
  const [occtMessage, setOcctMessage] = useState<string | undefined>();
  const [occtError, setOcctError] = useState<
    OcctMeshDevErrorDetails | undefined
  >();
  const [occtMetrics, setOcctMetrics] = useState<
    OcctMeshDevMetrics | undefined
  >();

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
  const canTessellateSelectedBox =
    Boolean(selectedObject) && selectedObject?.kind === "box";

  useEffect(() => {
    return () => {
      occtMeshDevRuntimeRef.current?.dispose();
      occtMeshDevRuntimeRef.current = undefined;
    };
  }, []);

  function syncDocument(nextSelectedId = selectedId) {
    const nextDocument = engine.getDocument();
    resetOcctDerivedMesh();
    setDocument(nextDocument);
    setSelectedId(
      nextSelectedId && nextDocument.objects.has(nextSelectedId)
        ? nextSelectedId
        : undefined
    );
  }

  function resetOcctDerivedMesh() {
    setOcctMeshes([]);
    setOcctMetrics(undefined);
    setOcctMessage(undefined);
    setOcctError(undefined);
  }

  function clearOcctDerivedMesh() {
    setOcctMeshes([]);
    setOcctMetrics(undefined);
    setOcctError(undefined);
    setOcctMessage("Cleared derived OCCT mesh.");
  }

  function selectObject(objectId: string | undefined) {
    if (objectId !== selectedId) {
      resetOcctDerivedMesh();
    }

    setSelectedId(objectId);
  }

  function getOcctMeshDevRuntime(): OcctMeshDevRuntime {
    if (!occtMeshDevRuntimeRef.current) {
      occtMeshDevRuntimeRef.current = createOcctMeshDevRuntime();
    }

    return occtMeshDevRuntimeRef.current;
  }

  async function tessellateSelectedBoxWithOcct() {
    if (!selectedObject) {
      setOcctMessage("Select a box before running OCCT tessellation.");
      return;
    }

    if (selectedObject.kind !== "box") {
      setOcctMessage("OCCT tessellation is currently wired for boxes only.");
      return;
    }

    setOcctPending(true);
    setOcctMessage(undefined);
    setOcctError(undefined);

    try {
      const result = await getOcctMeshDevRuntime().tessellateBox({
        id: selectedObject.id,
        dimensions: selectedObject.dimensions,
        transform: selectedObject.transform
      });

      setOcctMeshes([result.mesh]);
      setOcctMetrics(result.metrics);
      setOcctMessage(result.message);
    } catch (error) {
      const details = createOcctMeshDevErrorDetails(error);

      setOcctMeshes([]);
      setOcctMetrics(undefined);
      setOcctError(details);
      setOcctMessage(formatOcctMeshDevError(details));
    } finally {
      setOcctPending(false);
    }
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

  function exportProjectJson() {
    setProjectJson(exportCadProjectJson(engine));
    setProjectMessage("Exported current project JSON.");
  }

  function importProjectJson() {
    try {
      engine.loadProject(parseCadProjectJson(projectJson));
      setQueuedOps([]);
      setBatchResponse(undefined);
      setBatchError(undefined);
      setCommandError(undefined);
      setProjectMessage("Imported project JSON.");
      syncDocument(undefined);
    } catch (error) {
      setProjectMessage(
        error instanceof Error ? error.message : "Invalid project JSON."
      );
    }
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
                      onClick={() => selectObject(object.id)}
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

          <section className="project-panel" aria-label="Project JSON">
            <h2>Project JSON</h2>
            <div className="button-row">
              <button
                type="button"
                onClick={exportProjectJson}
                disabled={commandPending}
              >
                Export JSON
              </button>
              <button
                type="button"
                onClick={importProjectJson}
                disabled={commandPending || projectJson.trim().length === 0}
              >
                Import JSON
              </button>
            </div>
            <textarea
              value={projectJson}
              onChange={(event) => setProjectJson(event.currentTarget.value)}
              placeholder="Export or paste Web CAD project JSON"
              spellCheck={false}
            />
            {projectMessage && (
              <p className="project-message">{projectMessage}</p>
            )}
          </section>

          {occtMeshDevEnabled && (
            <section className="occt-panel" aria-label="OCCT mesh dev tools">
              <h2>OCCT Mesh Dev</h2>
              <div className="button-row">
                <button
                  type="button"
                  onClick={() => void tessellateSelectedBoxWithOcct()}
                  disabled={
                    commandPending || occtPending || !canTessellateSelectedBox
                  }
                >
                  {occtPending ? "Tessellating" : "Tessellate selected box"}
                </button>
                <button
                  type="button"
                  onClick={clearOcctDerivedMesh}
                  disabled={occtPending || occtMeshes.length === 0}
                >
                  Clear mesh
                </button>
              </div>
              {occtMessage && <p className="project-message">{occtMessage}</p>}
              {occtError && (
                <dl className="occt-error">
                  <div>
                    <dt>Code</dt>
                    <dd>{occtError.code}</dd>
                  </div>
                  <div>
                    <dt>Stage</dt>
                    <dd>{occtError.stage}</dd>
                  </div>
                  <div>
                    <dt>WASM</dt>
                    <dd>{occtError.wasmLoadStatus}</dd>
                  </div>
                  <div>
                    <dt>Worker</dt>
                    <dd>
                      {occtError.workerStarted ? "started" : "not started"}
                    </dd>
                  </div>
                </dl>
              )}
              {occtMetrics && (
                <dl className="metrics-list">
                  <div>
                    <dt>Object</dt>
                    <dd>{occtMetrics.objectId}</dd>
                  </div>
                  <div>
                    <dt>OCCT load</dt>
                    <dd>{formatMetricMs(occtMetrics.occtLoadMs)}</dd>
                  </div>
                  <div>
                    <dt>Tessellation</dt>
                    <dd>{formatMetricMs(occtMetrics.tessellationMs)}</dd>
                  </div>
                  <div>
                    <dt>Kernel total</dt>
                    <dd>{formatMetricMs(occtMetrics.geometryKernelMs)}</dd>
                  </div>
                  <div>
                    <dt>Worker total</dt>
                    <dd>{formatMetricMs(occtMetrics.workerExecutionMs)}</dd>
                  </div>
                  <div>
                    <dt>Round trip</dt>
                    <dd>{formatMetricMs(occtMetrics.roundTripMs)}</dd>
                  </div>
                  <div>
                    <dt>Vertices</dt>
                    <dd>{occtMetrics.vertexCount}</dd>
                  </div>
                  <div>
                    <dt>Triangles</dt>
                    <dd>{occtMetrics.triangleCount}</dd>
                  </div>
                </dl>
              )}
            </section>
          )}
        </aside>

        <ViewportCanvas
          primitives={primitives}
          meshes={occtMeshes}
          selectedId={selectedId}
          onSelect={selectObject}
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
