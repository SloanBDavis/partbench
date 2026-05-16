import {
  AsyncCadCommandExecutor,
  CadEngine,
  exportCadProject,
  exportCadProjectJson,
  type CadBodySnapshot,
  type CadDocument,
  type CadFeatureSummary,
  type CadTransactionHistoryEntry,
  type ObjectMeasurementsSnapshot,
  type SceneObject,
  type SketchSnapshot
} from "@web-cad/cad-core";
import type {
  CadBatchMode,
  CadBatchResponse,
  CadOp,
  DocumentUnitUpdateMode,
  SketchEntityKind,
  SketchEntitySnapshot
} from "@web-cad/cad-protocol";
import { createDerivedGeometryRuntime } from "@web-cad/derived-geometry-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildBatch,
  buildAddSketchCircleOp,
  buildAddSketchLineOp,
  buildAddSketchPointOp,
  buildAddSketchRectangleOp,
  buildCreateSketchOp,
  buildCreateBoxOp,
  buildCreateConeOp,
  buildCreateCylinderOp,
  buildCreateSphereOp,
  buildCreateTorusOp,
  buildDeleteObjectOp,
  buildDeleteSketchEntityOp,
  buildDeleteSketchOp,
  buildFeatureExtrudeOp,
  buildOperationFromBatchForm,
  buildRenameObjectOp,
  buildRenameSketchOp,
  buildUpdateBoxDimensionsOp,
  buildUpdateConeDimensionsOp,
  buildUpdateCylinderDimensionsOp,
  buildUpdateSketchEntityOp,
  buildUpdateSphereDimensionsOp,
  buildUpdateTorusDimensionsOp,
  buildUpdateUnitsOp,
  buildUpdateTransformOp,
  WEB_UI_ACTOR,
  type BatchOperationForm,
  type DimensionCommandForm,
  type FeatureExtrudeForm,
  type PrimitiveCommandForm,
  type SketchCreateForm,
  type SketchEntityForm,
  type TransformCommandForm
} from "./cadCommands";
import { BrowserCadCommandWorker } from "./browserCadCommandWorker";
import { BatchPanel } from "./components/BatchPanel";
import { GeometryPanel } from "./components/GeometryPanel";
import { HistoryPanel } from "./components/HistoryPanel";
import { Inspector } from "./components/Inspector";
import { ProjectJsonPanel } from "./components/ProjectJsonPanel";
import { SketchPanel } from "./components/SketchPanel";
import { ViewportCanvas } from "./components/ViewportCanvas";
import type { DerivedGeometryRuntime } from "./derivedGeometryRuntime";
import {
  createEmptyDerivedGeometrySnapshot,
  createPrimitiveDerivedGeometrySource,
  DerivedGeometryService,
  getDerivedGeometryStatusLabel,
  type DerivedExtrudeGeometrySource,
  type DerivedGeometrySource,
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
import {
  createProjectJsonPreview,
  formatProjectJsonSummary,
  summarizeCadProject
} from "./projectJson";
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
  majorRadius: 1.4,
  minorRadius: 0.35,
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
  majorRadius: 1.4,
  minorRadius: 0.35,
  translationX: 0,
  translationY: 0,
  translationZ: 1.1
};

const quickSphereForm: PrimitiveCommandForm = {
  id: "",
  width: 2,
  height: 2,
  depth: 2,
  radius: 1,
  majorRadius: 1.4,
  minorRadius: 0.35,
  translationX: 0,
  translationY: 0,
  translationZ: 1
};

const quickConeForm: PrimitiveCommandForm = {
  id: "",
  width: 2,
  height: 2.4,
  depth: 2,
  radius: 1,
  majorRadius: 1.4,
  minorRadius: 0.35,
  translationX: 0,
  translationY: 0,
  translationZ: 1.2
};

const quickTorusForm: PrimitiveCommandForm = {
  id: "",
  width: 2,
  height: 2,
  depth: 2,
  radius: 1,
  majorRadius: 1.4,
  minorRadius: 0.35,
  translationX: 0,
  translationY: 0,
  translationZ: 0
};

const initialBatchForm: BatchOperationForm = {
  op: "scene.createBox",
  id: "",
  targetId: "",
  width: 2,
  height: 2,
  depth: 2,
  radius: 1,
  majorRadius: 1.4,
  minorRadius: 0.35,
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
  units: "mm",
  unitUpdateMode: "metadataOnly"
};

function readTransactionHistory(): readonly CadTransactionHistoryEntry[] {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "transaction.history" }
  });

  return response.ok && response.query === "transaction.history"
    ? response.transactions
    : [];
}

function readProjectStructure(): {
  readonly features: readonly CadFeatureSummary[];
  readonly bodies: readonly CadBodySnapshot[];
} {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "project.structure" }
  });

  return response.ok && response.query === "project.structure"
    ? { features: response.features, bodies: response.bodies }
    : { features: [], bodies: [] };
}

function createDerivedGeometrySourcesFromDocument(
  document: CadDocument,
  features: readonly CadFeatureSummary[]
): readonly DerivedGeometrySource[] {
  const sketches = [...document.sketches.values()].map((sketch) => ({
    id: sketch.id,
    name: sketch.name,
    plane: sketch.plane,
    entities: [...sketch.entities.values()]
  }));

  return [
    ...[...document.objects.values()].map(createPrimitiveDerivedGeometrySource),
    ...createExtrudeDerivedGeometrySources(features, sketches)
  ];
}

function createExtrudeDerivedGeometrySources(
  features: readonly CadFeatureSummary[],
  sketches: readonly SketchSnapshot[]
): readonly DerivedExtrudeGeometrySource[] {
  return features
    .filter(
      (feature): feature is Extract<CadFeatureSummary, { kind: "extrude" }> =>
        feature.kind === "extrude"
    )
    .flatMap((feature) => {
      const sketch = sketches.find(
        (candidate) => candidate.id === feature.sketchId
      );
      const entity = sketch?.entities.find(
        (candidate) => candidate.id === feature.entityId
      );

      if (!sketch || !entity) {
        return [];
      }

      if (entity.kind === "rectangle") {
        const source: DerivedExtrudeGeometrySource = {
          id: feature.bodyId,
          kind: "extrude",
          sketchPlane: sketch.plane,
          profile: {
            kind: entity.kind,
            center: entity.center,
            width: entity.width,
            height: entity.height
          },
          depth: feature.depth
        };

        return [source];
      }

      if (entity.kind === "circle") {
        const source: DerivedExtrudeGeometrySource = {
          id: feature.bodyId,
          kind: "extrude",
          sketchPlane: sketch.plane,
          profile: {
            kind: entity.kind,
            center: entity.center,
            radius: entity.radius
          },
          depth: feature.depth
        };

        return [source];
      }

      return [];
    });
}

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
  const [unitUpdateMode, setUnitUpdateMode] =
    useState<DocumentUnitUpdateMode>("metadataOnly");
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
  const sketches = useMemo(
    () =>
      [...document.sketches.values()].map((sketch) => ({
        id: sketch.id,
        name: sketch.name,
        plane: sketch.plane,
        entities: [...sketch.entities.values()]
      })),
    [document]
  );
  const projectStructure = readProjectStructure();
  const sketchExtrudeBodies = useMemo(
    () =>
      projectStructure.bodies.filter(
        (body) => body.source.type === "sketchExtrudeFeature"
      ),
    [projectStructure.bodies]
  );
  const extrudeSources = useMemo(
    () =>
      createExtrudeDerivedGeometrySources(projectStructure.features, sketches),
    [projectStructure.features, sketches]
  );
  const derivedGeometrySources = useMemo<readonly DerivedGeometrySource[]>(
    () => [
      ...sceneObjects.map(createPrimitiveDerivedGeometrySource),
      ...extrudeSources
    ],
    [extrudeSources, sceneObjects]
  );
  const selectedObject = selectedId
    ? document.objects.get(selectedId)
    : undefined;
  const selectedBody = selectedId
    ? projectStructure.bodies.find((body) => body.id === selectedId)
    : undefined;
  const selectedFeature = selectedBody
    ? projectStructure.features.find(
        (feature) => feature.id === selectedBody.featureId
      )
    : undefined;
  const transactionHistory = readTransactionHistory();
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
  const derivedGeometryBySourceId = useMemo(
    () =>
      new Map(
        derivedGeometry.entries.map((entry) => [
          entry.sourceId ?? entry.objectId,
          entry
        ])
      ),
    [derivedGeometry]
  );
  const selectedGeometryEntry = selectedId
    ? derivedGeometryBySourceId.get(selectedId)
    : undefined;
  const viewportStatusTitle = selectedObject
    ? `${getObjectDisplayName(selectedObject)} (${formatObjectKind(selectedObject.kind)})`
    : selectedBody
      ? `${selectedBody.name ?? selectedBody.id} (Body)`
      : "No selection";
  const viewportStatusDetail =
    selectedObject || selectedBody
      ? derivedGeometryEnabled
        ? getDerivedGeometryStatusLabel(selectedGeometryEntry)
        : "Primitive fallback"
      : derivedGeometryEnabled
        ? "Select an object"
        : "Primitive fallback mode";
  const renderScene = useMemo(
    () =>
      createRenderSceneInputs(
        sceneObjects,
        derivedGeometryBySourceId,
        extrudeSources,
        sketches
      ),
    [derivedGeometryBySourceId, extrudeSources, sceneObjects, sketches]
  );
  const currentProjectSummary = summarizeCadProject(exportCadProject(engine));
  const projectJsonPreview = useMemo(
    () => createProjectJsonPreview(projectJson),
    [projectJson]
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

    getDerivedGeometryService().reconcile(derivedGeometrySources);
  }, [derivedGeometrySources, getDerivedGeometryService]);

  function syncDocument(nextSelectedId = selectedId) {
    const nextDocument = engine.getDocument();
    const nextStructure = readProjectStructure();
    reconcileDerivedGeometry(nextDocument, nextStructure.features);
    setDocument(nextDocument);
    setSelectedId(
      nextSelectedId &&
        (nextDocument.objects.has(nextSelectedId) ||
          nextStructure.bodies.some((body) => body.id === nextSelectedId))
        ? nextSelectedId
        : undefined
    );
  }

  function selectObject(objectId: string | undefined) {
    setSelectedId(objectId);
  }

  function reconcileDerivedGeometry(
    nextDocument: CadDocument,
    nextFeatures = readProjectStructure().features
  ) {
    if (!derivedGeometryEnabled) {
      return;
    }

    getDerivedGeometryService().reconcile(
      createDerivedGeometrySourcesFromDocument(nextDocument, nextFeatures)
    );
  }

  function refreshDerivedGeometry() {
    if (!derivedGeometryEnabled) {
      return;
    }

    getDerivedGeometryService().refresh(derivedGeometrySources);
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

  async function createSphere() {
    const offset = document.objects.size * 2.8;
    await commitOps(
      [
        buildCreateSphereOp({
          ...quickSphereForm,
          translationX: offset
        })
      ],
      (response) => response.createdIds[0]
    );
  }

  async function createCone() {
    const offset = document.objects.size * 2.8;
    await commitOps(
      [
        buildCreateConeOp({
          ...quickConeForm,
          translationX: offset
        })
      ],
      (response) => response.createdIds[0]
    );
  }

  async function createTorus() {
    const offset = document.objects.size * 2.8;
    await commitOps(
      [
        buildCreateTorusOp({
          ...quickTorusForm,
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

    await commitOps(
      [buildUpdateUnitsOp(units, unitUpdateMode)],
      () => selectedId
    );
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
        : selectedObject.kind === "cylinder"
          ? buildUpdateCylinderDimensionsOp(objectId, form)
          : selectedObject.kind === "sphere"
            ? buildUpdateSphereDimensionsOp(objectId, form)
            : selectedObject.kind === "cone"
              ? buildUpdateConeDimensionsOp(objectId, form)
              : buildUpdateTorusDimensionsOp(objectId, form);

    await commitOps([op], () => objectId);
  }

  async function deleteSelectedObject() {
    if (!selectedObject) {
      return;
    }

    await commitOps([buildDeleteObjectOp(selectedObject.id)], () => undefined);
  }

  async function createSketch(form: SketchCreateForm) {
    await commitOps([buildCreateSketchOp(form)], () => selectedId);
  }

  async function renameSketch(sketchId: string, name: string) {
    await commitOps([buildRenameSketchOp(sketchId, name)], () => selectedId);
  }

  async function deleteSketch(sketchId: string) {
    await commitOps([buildDeleteSketchOp(sketchId)], () => selectedId);
  }

  async function addSketchEntity(
    sketchId: string,
    kind: SketchEntityKind,
    form: SketchEntityForm
  ) {
    const op =
      kind === "point"
        ? buildAddSketchPointOp(sketchId, form)
        : kind === "line"
          ? buildAddSketchLineOp(sketchId, form)
          : kind === "rectangle"
            ? buildAddSketchRectangleOp(sketchId, form)
            : buildAddSketchCircleOp(sketchId, form);

    await commitOps([op], () => selectedId);
  }

  async function updateSketchEntity(
    sketchId: string,
    entity: SketchEntitySnapshot
  ) {
    await commitOps(
      [buildUpdateSketchEntityOp(sketchId, entity)],
      () => selectedId
    );
  }

  async function deleteSketchEntity(sketchId: string, entityId: string) {
    await commitOps(
      [buildDeleteSketchEntityOp(sketchId, entityId)],
      () => selectedId
    );
  }

  async function extrudeSketchEntity(
    sketchId: string,
    entityId: string,
    form: FeatureExtrudeForm
  ) {
    await commitOps(
      [buildFeatureExtrudeOp(sketchId, entityId, form)],
      (response) => response.createdBodyIds?.[0] ?? selectedId
    );
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
    setProjectMessage(
      `Generated ${formatProjectJsonSummary(currentProjectSummary)}.`
    );
    setProjectMessageTone("info");
  }

  function downloadProjectJson() {
    const projectJson = exportCadProjectJson(engine);
    const blob = new Blob([projectJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement("a");
    link.href = url;
    link.download = "web-cad-project.json";
    window.document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setProjectJson(projectJson);
    setProjectMessage(
      `Downloaded ${formatProjectJsonSummary(currentProjectSummary)}.`
    );
    setProjectMessageTone("info");
  }

  function loadProjectFile(projectJson: string, fileName: string) {
    setProjectJson(projectJson);
    setProjectMessage(`Loaded ${fileName} for import preview.`);
    setProjectMessageTone("info");
  }

  function importProjectJson() {
    const preview = createProjectJsonPreview(projectJson);

    if (preview.status !== "valid") {
      setProjectMessage(
        preview.status === "invalid"
          ? preview.message
          : "Load or paste valid project JSON before importing."
      );
      setProjectMessageTone("error");
      return;
    }

    engine.loadProject(preview.project);
    setQueuedOps([]);
    setBatchResponse(undefined);
    setBatchError(undefined);
    setCommandError(undefined);
    setProjectMessage(`Imported ${formatProjectJsonSummary(preview.summary)}.`);
    setProjectMessageTone("info");
    syncDocument(undefined);
  }

  function renderObjectButton(object: SceneObject) {
    const geometryEntry = derivedGeometryBySourceId.get(object.id);

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

  function renderBodyButton(body: CadBodySnapshot) {
    const geometryEntry = derivedGeometryBySourceId.get(body.id);
    const feature = projectStructure.features.find(
      (candidate) => candidate.id === body.featureId
    );

    return (
      <button
        type="button"
        className={body.id === selectedId ? "selected" : ""}
        onClick={() => selectObject(body.id)}
      >
        <span className="object-id">{body.name ?? body.id}</span>
        <strong>{feature?.kind === "extrude" ? "Extrude body" : "Body"}</strong>
        <small className="object-meta">Feature {body.featureId}</small>
        {feature?.kind === "extrude" && (
          <small className="object-meta">
            {feature.profileKind} / depth {feature.depth} {document.units}
          </small>
        )}
        {derivedGeometryEnabled && (
          <small
            className={`mesh-status geometry-${geometryEntry?.status ?? "idle"}`}
          >
            {getDerivedGeometryStatusLabel(geometryEntry)}
          </small>
        )}
        {body.id === selectedId && (
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
          <label className="toolbar-field wide">
            Unit change
            <select
              value={unitUpdateMode}
              disabled={commandPending}
              onChange={(event) =>
                setUnitUpdateMode(
                  event.currentTarget.value as DocumentUnitUpdateMode
                )
              }
            >
              <option value="metadataOnly">Relabel values</option>
              <option value="preservePhysicalSize">Convert size</option>
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
            onClick={() => void createSphere()}
            disabled={commandPending}
          >
            Create sphere
          </button>
          <button
            type="button"
            onClick={() => void createCone()}
            disabled={commandPending}
          >
            Create cone
          </button>
          <button
            type="button"
            onClick={() => void createTorus()}
            disabled={commandPending}
          >
            Create torus
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
            {!derivedGeometryEnabled && sceneObjects.length > 0 && (
              <p className="project-message">
                Showing primitive fallback geometry.
              </p>
            )}
          </section>

          <section>
            <div className="section-heading">
              <h2>Bodies</h2>
              <span>{sketchExtrudeBodies.length}</span>
            </div>
            {sketchExtrudeBodies.length === 0 ? (
              <p className="empty-state">No bodies</p>
            ) : (
              <ul>
                {sketchExtrudeBodies.map((body) => (
                  <li key={body.id}>{renderBodyButton(body)}</li>
                ))}
              </ul>
            )}
          </section>

          <SketchPanel
            disabled={commandPending}
            sketches={sketches}
            onCreateSketch={(form) => void createSketch(form)}
            onRenameSketch={(sketchId, name) =>
              void renameSketch(sketchId, name)
            }
            onDeleteSketch={(sketchId) => void deleteSketch(sketchId)}
            onAddEntity={(sketchId, kind, form) =>
              void addSketchEntity(sketchId, kind, form)
            }
            onUpdateEntity={(sketchId, entity) =>
              void updateSketchEntity(sketchId, entity)
            }
            onDeleteEntity={(sketchId, entityId) =>
              void deleteSketchEntity(sketchId, entityId)
            }
            onExtrudeEntity={(sketchId, entityId, form) =>
              void extrudeSketchEntity(sketchId, entityId, form)
            }
          />

          <HistoryPanel transactions={transactionHistory} />

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
            currentSummary={currentProjectSummary}
            message={projectMessage}
            messageTone={projectMessageTone}
            preview={projectJsonPreview}
            onProjectJsonChange={(value) => {
              setProjectJson(value);
              setProjectMessage(undefined);
            }}
            onProjectFileLoaded={loadProjectFile}
            onProjectFileError={(message) => {
              setProjectMessage(message);
              setProjectMessageTone("error");
            }}
            onExport={exportProjectJson}
            onDownload={downloadProjectJson}
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
          statusDetail={viewportStatusDetail}
          statusTitle={viewportStatusTitle}
          onSelect={selectObject}
        />

        <Inspector
          disabled={commandPending}
          measurements={selectedMeasurements}
          body={selectedBody}
          feature={selectedFeature}
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
