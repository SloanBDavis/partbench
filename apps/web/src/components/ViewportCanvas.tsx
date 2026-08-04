import {
  createDefaultCamera,
  orbitCamera,
  panCamera,
  pickExactRenderBodies,
  pickRenderScene,
  renderCanvasScene,
  type RenderCamera,
  type RenderExactPickBody,
  type RenderExactPickFilter,
  type RenderExactPickResult,
  type RenderExactVisualStateInput,
  type RenderTriangleMesh,
  type RenderPrimitive,
  type RenderVisualStateInput,
  type ViewportPoint,
  type ViewportSize
} from "@web-cad/renderer";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
  type ReactNode
} from "react";
import { UI_ACTION_AVAILABILITY_MESSAGES } from "../actions/actionRegistry";
import {
  applyViewportCameraAction,
  VIEWPORT_STANDARD_VIEWS,
  type ViewportStandardViewId
} from "../viewportCamera";
import { formatVisibleDiagnosticMessage } from "../viewportVisibleText";
import {
  createAnimationFrameCoalescer,
  getViewportBackingPixelRatio,
  shouldNotifyViewportHover,
  type AnimationFrameCoalescer
} from "./animationFrameCoalescer";
import {
  VIEWPORT_COMMAND_EVENT,
  type ViewportCommand
} from "./viewportCanvasContract";

export { VIEWPORT_COMMAND_EVENT } from "./viewportCanvasContract";
export type { ViewportCommand } from "./viewportCanvasContract";

export interface ViewportCanvasPick {
  readonly additive: boolean;
  readonly camera: RenderCamera;
  readonly exactPickResult?: RenderExactPickResult;
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
  exactPickBodies = [],
  exactPickFilter = "auto",
  exactVisualStates,
  meshes,
  notifyHoverPointChanges = false,
  onHover,
  onSelect,
  onUnavailableActivate,
  primitives,
  selectedId,
  sketchOverlay,
  status,
  suspendHoverPicking = false,
  visualStates
}: {
  readonly contextualSurface?: ReactNode;
  readonly exactPickBodies?: readonly RenderExactPickBody[];
  readonly exactPickFilter?: RenderExactPickFilter;
  readonly exactVisualStates?: readonly RenderExactVisualStateInput[];
  readonly meshes?: readonly RenderTriangleMesh[];
  readonly notifyHoverPointChanges?: boolean;
  readonly onHover?: (pick: ViewportCanvasPick | undefined) => void;
  readonly onSelect: (pick: ViewportCanvasPick) => void;
  /** Surfaces blocked viewport-action reasons (e.g. Fit selected). */
  readonly onUnavailableActivate?: (reason: string) => void;
  readonly primitives: readonly RenderPrimitive[];
  readonly selectedId?: string;
  readonly sketchOverlay?: (viewport: {
    readonly camera: RenderCamera;
    readonly size: ViewportSize;
  }) => ReactNode;
  readonly status?: ViewportCanvasStatus;
  readonly suspendHoverPicking?: boolean;
  readonly visualStates?: readonly RenderVisualStateInput[];
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [camera, setCamera] = useState<RenderCamera>(() =>
    createDefaultCamera()
  );
  const [size, setSize] = useState({ width: 900, height: 600 });
  const [hoveredId, setHoveredId] = useState<string | undefined>();
  const cameraRef = useRef(camera);
  const sizeRef = useRef(size);
  const hoveredIdRef = useRef<string | undefined>(undefined);
  const hoveredPickIdentityRef = useRef<string | undefined>(undefined);
  const visualStatesIdentity = useMemo(
    () => JSON.stringify(visualStates ?? null),
    [visualStates]
  );
  const stableVisualStates = useMemo(
    () => visualStates,
    // Identity key avoids re-rendering when content is unchanged.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- visualStatesIdentity
    [visualStatesIdentity]
  );
  const hoverFrameRef = useRef<
    AnimationFrameCoalescer<ViewportPoint> | undefined
  >(undefined);
  const navigationFrameRef = useRef<
    | AnimationFrameCoalescer<{
        readonly delta: ViewportPoint;
        readonly mode: "orbit" | "pan";
      }>
    | undefined
  >(undefined);
  const resizeFrameRef = useRef<
    AnimationFrameCoalescer<ViewportSize> | undefined
  >(undefined);
  const queuedNavigationRef = useRef<
    | {
        readonly delta: ViewportPoint;
        readonly mode: "orbit" | "pan";
      }
    | undefined
  >(undefined);
  const latestInputsRef = useRef({
    exactPickBodies,
    exactPickFilter,
    meshes,
    notifyHoverPointChanges,
    onHover,
    onSelect,
    primitives,
    suspendHoverPicking
  });
  latestInputsRef.current = {
    exactPickBodies,
    exactPickFilter,
    meshes,
    notifyHoverPointChanges,
    onHover,
    onSelect,
    primitives,
    suspendHoverPicking
  };
  const canFitSelected = Boolean(
    selectedId &&
    (primitives.some((primitive) => primitive.id === selectedId) ||
      meshes?.some(
        (mesh) =>
          (mesh.id === selectedId || mesh.parentId === selectedId) &&
          (mesh.vertices.length > 0 || (mesh.edgeSegments?.length ?? 0) > 0)
      ))
  );
  const fitSelectedUnavailableReason = canFitSelected
    ? undefined
    : UI_ACTION_AVAILABILITY_MESSAGES.inspectFitSelection;
  const frameClassName = [
    "viewport-frame",
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
  const setInternalHoveredId = useCallback(
    (nextId: string | undefined): boolean => {
      if (hoveredIdRef.current === nextId) {
        return false;
      }

      hoveredIdRef.current = nextId;
      setHoveredId(nextId);
      return true;
    },
    []
  );
  const publishViewportHover = useCallback(
    (pick: ViewportCanvasPick | undefined): void => {
      const inputs = latestInputsRef.current;
      const previousId = hoveredIdRef.current;
      const nextId = pick?.pickedRenderId;
      const previousIdentity = hoveredPickIdentityRef.current;
      const nextIdentity = createViewportPickIdentity(pick);
      hoveredPickIdentityRef.current = nextIdentity;
      setInternalHoveredId(nextId);

      if (
        previousIdentity !== nextIdentity ||
        shouldNotifyViewportHover(
          previousId,
          nextId,
          Boolean(pick) && inputs.notifyHoverPointChanges
        )
      ) {
        inputs.onHover?.(pick);
      }
    },
    [setInternalHoveredId]
  );

  useEffect(() => {
    const wrapper = wrapperRef.current;

    if (!wrapper) {
      return undefined;
    }

    const requestFrame = (callback: FrameRequestCallback) =>
      window.requestAnimationFrame(callback);
    const cancelFrame = (frameId: number) =>
      window.cancelAnimationFrame(frameId);

    resizeFrameRef.current = createAnimationFrameCoalescer({
      cancelFrame,
      onFrame: (nextSize: ViewportSize) => {
        const currentSize = sizeRef.current;

        if (
          currentSize.width === nextSize.width &&
          currentSize.height === nextSize.height
        ) {
          return;
        }

        sizeRef.current = nextSize;
        setSize(nextSize);
      },
      requestFrame
    });
    hoverFrameRef.current = createAnimationFrameCoalescer({
      cancelFrame,
      onFrame: (point: ViewportPoint) => {
        const inputs = latestInputsRef.current;
        const currentCamera = cameraRef.current;
        const currentSize = sizeRef.current;
        const pick = createViewportCanvasPick(
          inputs,
          currentCamera,
          currentSize,
          point
        );
        publishViewportHover(pick);
      },
      requestFrame
    });
    navigationFrameRef.current = createAnimationFrameCoalescer({
      cancelFrame,
      onFrame: ({ delta, mode }) => {
        queuedNavigationRef.current = undefined;
        updateCamera((current) =>
          mode === "pan"
            ? panCamera(current, delta, sizeRef.current)
            : orbitCamera(current, delta)
        );
      },
      requestFrame
    });

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { height, width } = entry.contentRect;
      resizeFrameRef.current?.schedule({
        width: Math.max(width, 320),
        height: Math.max(height, 240)
      });
    });
    observer.observe(wrapper);
    return () => {
      observer.disconnect();
      hoverFrameRef.current?.cancel();
      navigationFrameRef.current?.cancel();
      resizeFrameRef.current?.cancel();
      hoverFrameRef.current = undefined;
      navigationFrameRef.current = undefined;
      resizeFrameRef.current = undefined;
      queuedNavigationRef.current = undefined;
    };
  }, [publishViewportHover]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const ratio = getViewportBackingPixelRatio(window.devicePixelRatio);
    canvas.width = Math.round(size.width * ratio);
    canvas.height = Math.round(size.height * ratio);
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const renderOptions = {
      primitives,
      camera,
      exactPickBodies,
      exactVisualStates,
      hoveredId: stableVisualStates ? undefined : hoveredId,
      meshes,
      size,
      selectedId,
      visualStates: stableVisualStates
    };
    const sceneMeshes = meshes ?? [];
    const progressiveSketchScene =
      primitives.length === 0 &&
      sceneMeshes.length > 32 &&
      sceneMeshes.every((mesh) => mesh.source === "sketch");

    if (!progressiveSketchScene) {
      renderCanvasScene(context, renderOptions);
      return undefined;
    }

    let cancelled = false;
    let cancelPaint: (() => void) | undefined;
    void import("./progressiveSketchCanvas").then(
      ({ paintProgressiveSketchCanvas }) => {
        if (!cancelled) {
          cancelPaint = paintProgressiveSketchCanvas(context, renderOptions);
        }
      }
    );
    return () => {
      cancelled = true;
      cancelPaint?.();
    };
  }, [
    camera,
    exactPickBodies,
    exactVisualStates,
    hoveredId,
    meshes,
    primitives,
    selectedId,
    size,
    stableVisualStates
  ]);

  function fitView() {
    updateCamera(
      (current) =>
        applyViewportCameraAction(
          current,
          { type: "fitAll" },
          {
            primitives,
            meshes
          }
        ).camera
    );
  }

  function fitSelectedView() {
    updateCamera(
      (current) =>
        applyViewportCameraAction(
          current,
          { type: "fitSelection", selectedRenderId: selectedId },
          { primitives, meshes }
        ).camera
    );
  }

  function resetView() {
    updateCamera(
      (current) =>
        applyViewportCameraAction(
          current,
          { type: "reset" },
          { primitives, meshes }
        ).camera
    );
  }

  function zoomIn() {
    updateCamera(
      (current) =>
        applyViewportCameraAction(
          current,
          { type: "zoom", deltaY: -220 },
          { primitives, meshes }
        ).camera
    );
  }

  function zoomOut() {
    updateCamera(
      (current) =>
        applyViewportCameraAction(
          current,
          { type: "zoom", deltaY: 220 },
          { primitives, meshes }
        ).camera
    );
  }

  function setStandardView(viewId: ViewportStandardViewId) {
    updateCamera(
      (current) =>
        applyViewportCameraAction(
          current,
          { type: "standardView", viewId },
          { primitives, meshes }
        ).camera
    );
  }

  const onViewportCommand = useEffectEvent((event: Event) => {
    const command = (event as CustomEvent<ViewportCommand>).detail;
    if (command === "fit-all") fitView();
    else if (command === "fit-selection") fitSelectedView();
    else setStandardView(command);
  });

  useEffect(() => {
    window.addEventListener(VIEWPORT_COMMAND_EVENT, onViewportCommand);
    return () =>
      window.removeEventListener(VIEWPORT_COMMAND_EVENT, onViewportCommand);
  }, []);

  function getEventViewportPoint(
    event: PointerEvent<HTMLCanvasElement>
  ): ViewportPoint {
    const rect = event.currentTarget.getBoundingClientRect();

    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  function updateCamera(
    updater: (current: RenderCamera) => RenderCamera
  ): void {
    const nextCamera = updater(cameraRef.current);
    cameraRef.current = nextCamera;
    setCamera(nextCamera);
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
                onClick={(event: MouseEvent<HTMLButtonElement>) => {
                  if (fitSelectedUnavailableReason) {
                    event.preventDefault();
                    onUnavailableActivate?.(fitSelectedUnavailableReason);
                    return;
                  }
                  fitSelectedView();
                }}
                aria-disabled={fitSelectedUnavailableReason ? true : undefined}
                title={fitSelectedUnavailableReason ?? "Fit selected object"}
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
            <span>{formatVisibleDiagnosticMessage(status.detail)}</span>
          </div>
        ) : null}
        {sketchOverlay?.({ camera, size })}
        <canvas
          ref={canvasRef}
          aria-label="3D scene viewport"
          tabIndex={0}
          onPointerDown={(event) => {
            setCanvasPointerCapture(event.currentTarget, event.pointerId);
            hoverFrameRef.current?.cancel();
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
              if (!suspendHoverPicking) {
                hoverFrameRef.current?.schedule(getEventViewportPoint(event));
              }
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
              if (!pointer.moved) {
                publishViewportHover(undefined);
              }
              pointerRef.current = {
                ...pointer,
                x: event.clientX,
                y: event.clientY,
                moved: true
              };
              const pending = queuedNavigationRef.current;
              const queuedNavigation = {
                delta: {
                  x: (pending?.delta.x ?? 0) + delta.x,
                  y: (pending?.delta.y ?? 0) + delta.y
                },
                mode: pointer.mode
              };
              queuedNavigationRef.current = queuedNavigation;
              navigationFrameRef.current?.schedule(queuedNavigation);
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
            const currentCamera = cameraRef.current;
            const currentSize = sizeRef.current;
            const inputs = latestInputsRef.current;
            const pick = createViewportCanvasPick(
              inputs,
              currentCamera,
              currentSize,
              point,
              event.shiftKey
            );
            hoveredPickIdentityRef.current = createViewportPickIdentity(pick);
            setInternalHoveredId(pick.pickedRenderId);
            inputs.onSelect(pick);
          }}
          onPointerCancel={(event) => {
            const pointer = pointerRef.current;

            if (pointer?.id === event.pointerId) {
              pointerRef.current = undefined;
            }
          }}
          onPointerLeave={() => {
            if (!pointerRef.current) {
              hoverFrameRef.current?.cancel();
              publishViewportHover(undefined);
            }
          }}
          onWheel={(event) => {
            // React registers wheel as a passive root listener, so
            // preventDefault is a no-op here; the frame is non-scrollable.
            const deltaY =
              event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
            updateCamera(
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
            }
          }}
        />
      </div>
    </section>
  );
}

function createViewportCanvasPick(
  inputs: {
    readonly exactPickBodies: readonly RenderExactPickBody[];
    readonly exactPickFilter: RenderExactPickFilter;
    readonly meshes?: readonly RenderTriangleMesh[];
    readonly primitives: readonly RenderPrimitive[];
  },
  camera: RenderCamera,
  size: ViewportSize,
  point: ViewportPoint,
  additive = false
): ViewportCanvasPick {
  const exactPickResult =
    inputs.exactPickBodies.length > 0
      ? pickExactRenderBodies(
          inputs.exactPickBodies,
          camera,
          size,
          point,
          inputs.exactPickFilter
        )
      : undefined;
  const exactCandidate = exactPickResult?.candidates[0];
  const fallbackId = exactCandidate
    ? undefined
    : pickRenderScene(
        inputs.primitives,
        inputs.meshes ?? [],
        camera,
        size,
        point
      );
  const suppressExactBoundsFallback =
    exactPickResult?.status === "ready" &&
    fallbackId !== undefined &&
    inputs.exactPickBodies.some(({ pickMap }) => pickMap.bodyId === fallbackId);

  return {
    additive,
    camera,
    ...(exactPickResult ? { exactPickResult } : {}),
    ...(exactCandidate?.bodyId
      ? { pickedRenderId: exactCandidate.bodyId }
      : !suppressExactBoundsFallback && fallbackId
        ? { pickedRenderId: fallbackId }
        : {}),
    point,
    size
  };
}

export function createViewportPickIdentity(
  pick: ViewportCanvasPick | undefined
): string | undefined {
  const candidate = pick?.exactPickResult?.candidates[0];
  return candidate
    ? `${candidate.bodyId}\0${candidate.bodySourceIdentitySignature}\0${candidate.topologySignature}\0${candidate.entityKind}\0${candidate.localId ?? ""}\0${candidate.entitySignature ?? ""}`
    : pick?.pickedRenderId;
}

function setCanvasPointerCapture(
  canvas: HTMLCanvasElement,
  pointerId: number
): void {
  try {
    canvas.setPointerCapture(pointerId);
  } catch {
    // Synthetic events may not support pointer capture.
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
    // Synthetic events may not support pointer capture.
  }
}
