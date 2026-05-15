import {
  createDefaultCamera,
  orbitCamera,
  panCamera,
  pickPrimitive,
  renderCanvasScene,
  type RenderCamera,
  type RenderTriangleMesh,
  type RenderPrimitive,
  zoomCamera
} from "@web-cad/renderer";
import { useEffect, useRef, useState } from "react";
import { fitCameraToRenderScene } from "../viewportCamera";

export function ViewportCanvas({
  meshes,
  onSelect,
  primitives,
  selectedId
}: {
  readonly meshes?: readonly RenderTriangleMesh[];
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
            <button type="button" onClick={fitView} title="Fit view">
              Fit
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
            const id = pickPrimitive(primitives, camera, size, {
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
