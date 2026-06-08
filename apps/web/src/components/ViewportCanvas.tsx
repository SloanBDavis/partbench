import {
  createDefaultCamera,
  orbitCamera,
  panCamera,
  pickRenderScene,
  renderCanvasScene,
  type RenderCamera,
  type RenderTriangleMesh,
  type RenderPrimitive,
  zoomCamera
} from "@web-cad/renderer";
import { useEffect, useRef, useState } from "react";
import {
  fitCameraToRenderObject,
  fitCameraToRenderScene
} from "../viewportCamera";
import type { ViewportReferenceAction } from "../viewportReferenceActions";
import type { ViewportSelectionDisplay } from "../viewportSelectionDisplay";

export function ViewportCanvas({
  meshes,
  onSelectGeneratedReference,
  onSelect,
  primitives,
  referenceActions = [],
  selectedId,
  selectionDisplay
}: {
  readonly meshes?: readonly RenderTriangleMesh[];
  readonly onSelect: (id: string | undefined) => void;
  readonly onSelectGeneratedReference?: (
    reference: ViewportReferenceAction["reference"]
  ) => void;
  readonly primitives: readonly RenderPrimitive[];
  readonly referenceActions?: readonly ViewportReferenceAction[];
  readonly selectionDisplay: ViewportSelectionDisplay;
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
      meshes,
      size,
      selectedId
    });
  }, [camera, meshes, primitives, selectedId, size]);

  function fitView() {
    setCamera((current) =>
      fitCameraToRenderScene(current, primitives, meshes ?? [])
    );
  }

  function fitSelectedView() {
    setCamera((current) =>
      fitCameraToRenderObject(current, selectedId, primitives, meshes ?? [])
    );
  }

  function resetView() {
    setCamera(createDefaultCamera());
  }

  function zoomIn() {
    setCamera((current) => zoomCamera(current, -220));
  }

  function zoomOut() {
    setCamera((current) => zoomCamera(current, 220));
  }

  return (
    <section className="viewport-panel" aria-label="3D viewport">
      <div
        ref={wrapperRef}
        className="viewport-frame"
        onContextMenu={(event) => event.preventDefault()}
      >
        <div className="viewport-head">
          <div className="viewport-actions" aria-label="Viewport controls">
            <button type="button" onClick={fitView} title="Fit all objects">
              Fit all
            </button>
            <button
              type="button"
              onClick={fitSelectedView}
              disabled={!selectedId}
              title="Fit selected object"
            >
              Fit selected
            </button>
            <button type="button" onClick={resetView} title="Reset view">
              Reset
            </button>
            <button type="button" onClick={zoomIn} title="Zoom in">
              +
            </button>
            <button type="button" onClick={zoomOut} title="Zoom out">
              -
            </button>
          </div>
        </div>
        <div
          className={`viewport-status viewport-status-${selectionDisplay.tone}`}
          aria-live="polite"
          data-selection-kind={selectionDisplay.selectionKind}
          data-geometry-status={selectionDisplay.geometryStatus}
        >
          <strong>{selectionDisplay.title}</strong>
          <span>{selectionDisplay.detail}</span>
          {selectionDisplay.referenceSummary &&
            selectionDisplay.referenceSummary !== selectionDisplay.title && (
              <small>{selectionDisplay.referenceSummary}</small>
            )}
          {selectionDisplay.commandOperationLabels.length > 0 && (
            <small>{selectionDisplay.commandOperationLabels.join(", ")}</small>
          )}
          {selectionDisplay.diagnostics[0] && (
            <small className="viewport-status-diagnostic">
              {selectionDisplay.diagnostics[0].message}
            </small>
          )}
          {selectionDisplay.geometryDetail && (
            <small>{selectionDisplay.geometryDetail}</small>
          )}
        </div>
        {referenceActions.length > 0 && (
          <div
            className="viewport-reference-actions"
            aria-label="Viewport reference candidates"
          >
            <div className="viewport-reference-actions-header">
              <strong>References</strong>
              <small>{referenceActions.length}</small>
            </div>
            <ul>
              {referenceActions.map((action) => (
                <li key={action.id}>
                  <button
                    type="button"
                    className={
                      action.selected
                        ? "viewport-reference-action selected"
                        : action.commandable
                          ? "viewport-reference-action"
                          : "viewport-reference-action blocked"
                    }
                    aria-pressed={action.selected}
                    data-commandable={action.commandable ? "true" : "false"}
                    data-reference-kind={action.reference.kind}
                    onClick={() =>
                      onSelectGeneratedReference?.(action.reference)
                    }
                  >
                    <span>
                      {action.kindLabel}: {action.label}
                    </span>
                    <strong>
                      {action.commandable ? "Command-ready" : "Blocked"}
                    </strong>
                    {action.commandOperationLabels.length > 0 && (
                      <small>{action.commandOperationLabels.join(", ")}</small>
                    )}
                    {action.diagnostic && (
                      <small className="viewport-reference-diagnostic">
                        {action.diagnostic.message}
                      </small>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <canvas
          ref={canvasRef}
          aria-label="3D scene viewport"
          tabIndex={0}
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
            const id = pickRenderScene(primitives, meshes ?? [], camera, size, {
              x: event.clientX - rect.left,
              y: event.clientY - rect.top
            });
            onSelect(id);
          }}
          onPointerCancel={(event) => {
            const pointer = pointerRef.current;

            if (pointer?.id === event.pointerId) {
              pointerRef.current = undefined;
            }
          }}
          onWheel={(event) => {
            event.preventDefault();
            const deltaY =
              event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
            setCamera((current) => zoomCamera(current, deltaY));
          }}
          onKeyDown={(event) => {
            if (event.key === "+" || event.key === "=") {
              event.preventDefault();
              zoomIn();
              return;
            }

            if (event.key === "-") {
              event.preventDefault();
              zoomOut();
              return;
            }

            if (event.key === "0") {
              event.preventDefault();
              resetView();
            }
          }}
        />
      </div>
    </section>
  );
}
