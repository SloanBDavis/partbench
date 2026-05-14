import {
  CadEngine,
  type CadDocument,
  type SceneObject
} from "@web-cad/cad-core";
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
import "./styles.css";

const engine = new CadEngine();

export function App() {
  const [document, setDocument] = useState<CadDocument>(() =>
    engine.getDocument()
  );
  const [selectedId, setSelectedId] = useState<string | undefined>();

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
    const result = engine.apply({
      op: "scene.createBox",
      name: "Box",
      dimensions: { width: 2.4, height: 1.8, depth: 1.6 },
      transform: {
        translation: [offset, 0, 0.8]
      }
    });
    syncDocument(result.transaction.diff.created[0]?.id);
  }

  function createCylinder() {
    const offset = document.objects.size * 2.8;
    const result = engine.apply({
      op: "scene.createCylinder",
      name: "Cylinder",
      dimensions: { radius: 0.9, height: 2.2 },
      transform: {
        translation: [offset, 0, 1.1]
      }
    });
    syncDocument(result.transaction.diff.created[0]?.id);
  }

  function undo() {
    engine.undo();
    syncDocument();
  }

  function redo() {
    const result = engine.redo();
    syncDocument(result?.transaction.diff.created[0]?.id ?? selectedId);
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
        </aside>

        <ViewportCanvas
          primitives={primitives}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />

        <Inspector object={selectedObject} />
      </section>
    </main>
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

function Inspector({ object }: { readonly object?: SceneObject }) {
  return (
    <aside className="inspector" aria-label="Inspector">
      <h2>Inspector</h2>
      {!object ? (
        <p className="empty-state">No selection</p>
      ) : (
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
      )}
    </aside>
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
