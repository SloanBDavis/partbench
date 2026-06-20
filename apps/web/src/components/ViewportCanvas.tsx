import {
  createDefaultCamera,
  orbitCamera,
  panCamera,
  pickRenderScene,
  renderCanvasScene,
  type RenderCamera,
  type RenderTriangleMesh,
  type RenderPrimitive,
  type RenderVisualStateInput,
  type ViewportPoint,
  type ViewportSize
} from "@web-cad/renderer";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode
} from "react";
import {
  applyViewportCameraAction,
  getRenderObjectBounds,
  VIEWPORT_STANDARD_VIEWS,
  type ViewportStandardViewId
} from "../viewportCamera";
import { shouldCancelViewportTransientState } from "../viewportKeyboard";

export interface ViewportCanvasPick {
  readonly camera: RenderCamera;
  readonly pickedRenderId?: string;
  readonly point: ViewportPoint;
  readonly size: ViewportSize;
}

export interface ViewportCanvasStatus {
  readonly label: string;
  readonly detail: string;
  readonly tone: "idle" | "ready" | "warning" | "blocked" | "failed";
}

export function ViewportCanvas({
  contextualSurface,
  meshes,
  onHover,
  onSelect,
  onCancelTransientState,
  primitives,
  selectedId,
  sketchOverlay,
  status,
  visualStates
}: {
  readonly contextualSurface?: ReactNode;
  readonly meshes?: readonly RenderTriangleMesh[];
  readonly onHover?: (pick: ViewportCanvasPick | undefined) => void;
  readonly onSelect: (pick: ViewportCanvasPick) => void;
  readonly onCancelTransientState?: () => void;
  readonly primitives: readonly RenderPrimitive[];
  readonly selectedId?: string;
  readonly sketchOverlay?: (viewport: {
    readonly camera: RenderCamera;
    readonly size: ViewportSize;
  }) => ReactNode;
  readonly status?: ViewportCanvasStatus;
  readonly visualStates?: readonly RenderVisualStateInput[];
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [camera, setCamera] = useState<RenderCamera>(() =>
    createDefaultCamera()
  );
  const [size, setSize] = useState({ width: 900, height: 600 });
  const [hoveredId, setHoveredId] = useState<string | undefined>();
  const canFitSelected = Boolean(
    selectedId && getRenderObjectBounds(selectedId, primitives, meshes ?? [])
  );
  const frameClassName = [
    "viewport-frame",
    contextualSurface ? "viewport-frame-with-contextual" : undefined,
    status ? "viewport-frame-with-status" : undefined
  ]
    .filter(Boolean)
    .join(" ");
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
      hoveredId: visualStates ? undefined : hoveredId,
      meshes,
      size,
      selectedId,
      visualStates
    });
  }, [camera, hoveredId, meshes, primitives, selectedId, size, visualStates]);

  function fitView() {
    setCamera(
      (current) =>
        applyViewportCameraAction(
          current,
          { type: "fitAll" },
          { primitives, meshes }
        ).camera
    );
  }

  function fitSelectedView() {
    setCamera(
      (current) =>
        applyViewportCameraAction(
          current,
          { type: "fitSelection", selectedRenderId: selectedId },
          { primitives, meshes }
        ).camera
    );
  }

  function resetView() {
    setCamera(
      (current) =>
        applyViewportCameraAction(
          current,
          { type: "reset" },
          { primitives, meshes }
        ).camera
    );
  }

  function zoomIn() {
    setCamera(
      (current) =>
        applyViewportCameraAction(
          current,
          { type: "zoom", deltaY: -220 },
          { primitives, meshes }
        ).camera
    );
  }

  function zoomOut() {
    setCamera(
      (current) =>
        applyViewportCameraAction(
          current,
          { type: "zoom", deltaY: 220 },
          { primitives, meshes }
        ).camera
    );
  }

  function setStandardView(viewId: ViewportStandardViewId) {
    setCamera(
      (current) =>
        applyViewportCameraAction(
          current,
          { type: "standardView", viewId },
          { primitives, meshes }
        ).camera
    );
  }

  function getEventViewportPoint(
    event: PointerEvent<HTMLCanvasElement>
  ): ViewportPoint {
    const rect = event.currentTarget.getBoundingClientRect();

    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  return (
    <section className="viewport-panel" aria-label="3D viewport">
      <div
        ref={wrapperRef}
        className={frameClassName}
        onContextMenu={(event) => event.preventDefault()}
      >
        <div className="viewport-head">
          <div className="viewport-actions" aria-label="Viewport controls">
            <div
              className="viewport-action-group"
              aria-label="Viewport fit and zoom"
            >
              <button type="button" onClick={fitView} title="Fit all objects">
                Fit all
              </button>
              <button
                type="button"
                onClick={fitSelectedView}
                disabled={!canFitSelected}
                title={
                  canFitSelected
                    ? "Fit selected object"
                    : "Fit selected unavailable"
                }
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
            <div
              className="viewport-action-group"
              aria-label="Viewport standard views"
            >
              {VIEWPORT_STANDARD_VIEWS.map((standardView) => (
                <button
                  key={standardView.id}
                  type="button"
                  onClick={() => setStandardView(standardView.id)}
                  title={standardView.title}
                >
                  {standardView.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        {contextualSurface ? (
          <div className="viewport-contextual-slot">{contextualSurface}</div>
        ) : null}
        {status ? (
          <div
            className={`viewport-status viewport-status-${status.tone}`}
            aria-label="Viewport status"
          >
            <strong>{status.label}</strong>
            <span>{status.detail}</span>
          </div>
        ) : null}
        {sketchOverlay?.({ camera, size })}
        <canvas
          ref={canvasRef}
          aria-label="3D scene viewport"
          tabIndex={0}
          onPointerDown={(event) => {
            setCanvasPointerCapture(event.currentTarget, event.pointerId);
            setHoveredId(undefined);
            onHover?.(undefined);
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

            if (!pointer) {
              const point = getEventViewportPoint(event);
              const id = pickRenderScene(
                primitives,
                meshes ?? [],
                camera,
                size,
                point
              );
              setHoveredId(id);
              onHover?.({
                camera,
                pickedRenderId: id,
                point,
                size
              });
              return;
            }

            if (pointer.id !== event.pointerId) {
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

            releaseCanvasPointerCapture(event.currentTarget, event.pointerId);
            pointerRef.current = undefined;

            if (pointer.moved) {
              return;
            }

            const point = getEventViewportPoint(event);
            const id = pickRenderScene(
              primitives,
              meshes ?? [],
              camera,
              size,
              point
            );
            setHoveredId(id);
            onSelect({
              camera,
              pickedRenderId: id,
              point,
              size
            });
          }}
          onPointerCancel={(event) => {
            const pointer = pointerRef.current;

            if (pointer?.id === event.pointerId) {
              pointerRef.current = undefined;
            }
          }}
          onPointerLeave={() => {
            if (!pointerRef.current) {
              setHoveredId(undefined);
              onHover?.(undefined);
            }
          }}
          onWheel={(event) => {
            event.preventDefault();
            const deltaY =
              event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
            setCamera(
              (current) =>
                applyViewportCameraAction(
                  current,
                  { type: "zoom", deltaY },
                  { primitives, meshes }
                ).camera
            );
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
              return;
            }

            if (shouldCancelViewportTransientState(event)) {
              event.preventDefault();
              onCancelTransientState?.();
            }
          }}
        />
      </div>
    </section>
  );
}

function setCanvasPointerCapture(
  canvas: HTMLCanvasElement,
  pointerId: number
): void {
  try {
    canvas.setPointerCapture(pointerId);
  } catch {
    // Synthetic smoke-test events are not always capturable; real pointer input is.
  }
}

function releaseCanvasPointerCapture(
  canvas: HTMLCanvasElement,
  pointerId: number
): void {
  try {
    if (canvas.hasPointerCapture(pointerId)) {
      canvas.releasePointerCapture(pointerId);
    }
  } catch {
    // Ignore non-capturable synthetic events.
  }
}
