import {
  AsyncCadCommandExecutor,
  CadEngine,
  exportCadProjectJson,
  formatCadProjectImportError,
  parseCadProjectJson,
  type CadDocument,
  type ObjectMeasurementsSnapshot,
  type SceneObject
} from "@web-cad/cad-core";
import type {
  CadBatchMode,
  CadBatchResponse,
  CadOp
} from "@web-cad/cad-protocol";
import { createDerivedGeometryRuntime } from "@web-cad/derived-geometry-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildBatch,
  buildCreateBoxOp,
  buildCreateCylinderOp,
  buildDeleteObjectOp,
  buildOperationFromBatchForm,
  buildRenameObjectOp,
  buildUpdateBoxDimensionsOp,
  buildUpdateCylinderDimensionsOp,
  buildUpdateUnitsOp,
  buildUpdateTransformOp,
  WEB_UI_ACTOR,
  type BatchOperationForm,
  type DimensionCommandForm,
  type PrimitiveCommandForm,
  type TransformCommandForm
} from "./cadCommands";
import { BrowserCadCommandWorker } from "./browserCadCommandWorker";
import { BatchPanel } from "./components/BatchPanel";
import { GeometryPanel } from "./components/GeometryPanel";
import { Inspector } from "./components/Inspector";
import { ProjectJsonPanel } from "./components/ProjectJsonPanel";
import { ViewportCanvas } from "./components/ViewportCanvas";
import type { DerivedGeometryRuntime } from "./derivedGeometryRuntime";
import {
  createEmptyDerivedGeometrySnapshot,
  DerivedGeometryService,
  getDerivedGeometryStatusLabel,
  type DerivedGeometrySnapshot
} from "./derivedGeometry";
import {
  formatDimensions,
  getObjectDisplayName,
  formatObjectKind,
  formatObjectPosition,
  formatObjectScale
} from "./sceneObjectDisplay";
import { createRenderSceneInputs } from "./renderScene";
import "./styles.css";

const engine = new CadEngine();
const commandExecutor = new AsyncCadCommandExecutor(
  engine,
  new BrowserCadCommandWorker()
);
const derivedGeometryEnabled = __WEB_CAD_DERIVED_GEOMETRY_ENABLED__;

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
  scaleZ: 1,
  name: "",
  units: "mm"
};

export function App() {
  const derivedGeometryRuntimeRef = useRef<DerivedGeometryRuntime | undefined>(
    undefined
  );
  const derivedGeometryServiceRef = useRef<DerivedGeometryService | undefined>(
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
  const [projectMessageTone, setProjectMessageTone] = useState<
    "info" | "error"
  >("info");
  const [derivedGeometry, setDerivedGeometry] =
    useState<DerivedGeometrySnapshot>(() =>
      createEmptyDerivedGeometrySnapshot()
    );
  const getDerivedGeometryRuntime = useCallback((): DerivedGeometryRuntime => {
    if (!derivedGeometryRuntimeRef.current) {
      derivedGeometryRuntimeRef.current = createDerivedGeometryRuntime();
    }

    return derivedGeometryRuntimeRef.current;
  }, []);
  const getDerivedGeometryService = useCallback((): DerivedGeometryService => {
    if (!derivedGeometryServiceRef.current) {
      derivedGeometryServiceRef.current = new DerivedGeometryService({
        runtime: getDerivedGeometryRuntime(),
        onChange: setDerivedGeometry
      });
    }

    return derivedGeometryServiceRef.current;
  }, [getDerivedGeometryRuntime]);

  const sceneObjects = useMemo(
    () => [...document.objects.values()],
    [document]
  );
  const selectedObject = selectedId
    ? document.objects.get(selectedId)
    : undefined;
  const selectedMeasurements = useMemo<
    ObjectMeasurementsSnapshot | undefined
  >(() => {
    if (!selectedObject) {
      return undefined;
    }

    const response = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "object.measurements", id: selectedObject.id }
    });

    return response.ok && response.query === "object.measurements"
      ? response.measurements
      : undefined;
  }, [selectedObject]);
  const derivedGeometryByObjectId = useMemo(
    () =>
      new Map(derivedGeometry.entries.map((entry) => [entry.objectId, entry])),
    [derivedGeometry]
  );
  const renderScene = useMemo(
    () => createRenderSceneInputs(sceneObjects, derivedGeometryByObjectId),
    [derivedGeometryByObjectId, sceneObjects]
  );

  useEffect(() => {
    return () => {
      derivedGeometryServiceRef.current?.dispose();
      derivedGeometryServiceRef.current = undefined;
      derivedGeometryRuntimeRef.current = undefined;
    };
  }, []);

  useEffect(() => {
    if (!derivedGeometryEnabled) {
      return;
    }

    getDerivedGeometryService().reconcile(sceneObjects);
  }, [getDerivedGeometryService, sceneObjects]);

  function syncDocument(nextSelectedId = selectedId) {
    const nextDocument = engine.getDocument();
    reconcileDerivedGeometry(nextDocument);
    setDocument(nextDocument);
    setSelectedId(
      nextSelectedId && nextDocument.objects.has(nextSelectedId)
        ? nextSelectedId
        : undefined
    );
  }

  function selectObject(objectId: string | undefined) {
    setSelectedId(objectId);
  }

  function reconcileDerivedGeometry(nextDocument: CadDocument) {
    if (!derivedGeometryEnabled) {
      return;
    }

    getDerivedGeometryService().reconcile([...nextDocument.objects.values()]);
  }

  function refreshDerivedGeometry() {
    if (!derivedGeometryEnabled) {
      return;
    }

    getDerivedGeometryService().refresh(sceneObjects);
  }

  async function commitOps(
    ops: readonly CadOp[],
    getNextSelectedId: (response: CadBatchResponse) => string | undefined
  ) {
    setCommandPending(true);
    setCommandError(undefined);

    try {
      const response = await commandExecutor.executeBatch(
        buildBatch("commit", ops, WEB_UI_ACTOR)
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

  async function updateDocumentUnits(units: CadDocument["units"]) {
    if (units === document.units) {
      return;
    }

    await commitOps([buildUpdateUnitsOp(units)], () => selectedId);
  }

  async function renameSelectedObject(name: string) {
    if (!selectedObject) {
      return;
    }

    const objectId = selectedObject.id;
    await commitOps([buildRenameObjectOp(objectId, name)], () => objectId);
  }

  async function updateSelectedTransform(form: TransformCommandForm) {
    if (!selectedObject) {
      return;
    }

    const objectId = selectedObject.id;
    await commitOps([buildUpdateTransformOp(objectId, form)], () => objectId);
  }

  async function updateSelectedDimensions(form: DimensionCommandForm) {
    if (!selectedObject) {
      return;
    }

    const objectId = selectedObject.id;
    const op =
      selectedObject.kind === "box"
        ? buildUpdateBoxDimensionsOp(objectId, form)
        : buildUpdateCylinderDimensionsOp(objectId, form);

    await commitOps([op], () => objectId);
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
        buildBatch(mode, queuedOps, WEB_UI_ACTOR)
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
    setProjectMessageTone("info");
  }

  function importProjectJson() {
    try {
      engine.loadProject(parseCadProjectJson(projectJson));
      setQueuedOps([]);
      setBatchResponse(undefined);
      setBatchError(undefined);
      setCommandError(undefined);
      setProjectMessage("Imported project JSON.");
      setProjectMessageTone("info");
      syncDocument(undefined);
    } catch (error) {
      setProjectMessage(formatCadProjectImportError(error));
      setProjectMessageTone("error");
    }
  }

  function renderObjectButton(object: SceneObject) {
    const geometryEntry = derivedGeometryByObjectId.get(object.id);

    return (
      <button
        type="button"
        className={object.id === selectedId ? "selected" : ""}
        onClick={() => selectObject(object.id)}
      >
        <span className="object-id">{getObjectDisplayName(object)}</span>
        <strong>{formatObjectKind(object.kind)}</strong>
        {object.name && <small className="object-meta">ID {object.id}</small>}
        <small className="object-meta">
          {formatDimensions(object, document.units)}
        </small>
        <small className="object-meta">{formatObjectPosition(object)}</small>
        <small className="object-meta">{formatObjectScale(object)}</small>
        {derivedGeometryEnabled && (
          <small
            className={`mesh-status geometry-${geometryEntry?.status ?? "idle"}`}
          >
            {getDerivedGeometryStatusLabel(geometryEntry)}
          </small>
        )}
        {object.id === selectedId && (
          <small className="selected-status">Selected</small>
        )}
      </button>
    );
  }

  return (
    <main className="app-shell">
      <header className="app-toolbar">
        <div>
          <h1>Web CAD</h1>
        </div>
        <div className="toolbar-actions" aria-label="Command controls">
          {commandPending && (
            <span className="pending-status" role="status">
              Worker running
            </span>
          )}
          <label className="toolbar-field">
            Units
            <select
              value={document.units}
              disabled={commandPending}
              onChange={(event) =>
                void updateDocumentUnits(
                  event.currentTarget.value as CadDocument["units"]
                )
              }
            >
              <option value="mm">mm</option>
              <option value="cm">cm</option>
              <option value="m">m</option>
              <option value="in">in</option>
            </select>
          </label>
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
            <div className="section-heading">
              <h2>Objects</h2>
              <span>{sceneObjects.length}</span>
            </div>
            {sceneObjects.length === 0 ? (
              <p className="empty-state">No objects</p>
            ) : (
              <ul>
                {sceneObjects.map((object) => (
                  <li key={object.id}>{renderObjectButton(object)}</li>
                ))}
              </ul>
            )}
          </section>

          <BatchPanel
            disabled={commandPending}
            form={batchForm}
            onChange={setBatchForm}
            units={document.units}
            queuedOps={queuedOps}
            response={batchResponse}
            error={batchError}
            onAddOperation={addBatchOperation}
            onDryRun={() => void runBatch("dryRun")}
            onCommit={() => void runBatch("commit")}
            onClear={clearBatch}
          />

          <ProjectJsonPanel
            disabled={commandPending}
            projectJson={projectJson}
            message={projectMessage}
            messageTone={projectMessageTone}
            onProjectJsonChange={setProjectJson}
            onExport={exportProjectJson}
            onImport={importProjectJson}
          />

          {derivedGeometryEnabled && (
            <GeometryPanel
              disabled={commandPending}
              snapshot={derivedGeometry}
              onRefresh={refreshDerivedGeometry}
            />
          )}
        </aside>

        <ViewportCanvas
          primitives={renderScene.primitives}
          meshes={renderScene.meshes}
          selectedId={selectedId}
          onSelect={selectObject}
        />

        <Inspector
          disabled={commandPending}
          measurements={selectedMeasurements}
          object={selectedObject}
          units={document.units}
          onApplyDimensions={(form) => void updateSelectedDimensions(form)}
          onApplyName={(name) => void renameSelectedObject(name)}
          onApplyTransform={(form) => void updateSelectedTransform(form)}
          onDelete={() => void deleteSelectedObject()}
        />
      </section>
    </main>
  );
}
