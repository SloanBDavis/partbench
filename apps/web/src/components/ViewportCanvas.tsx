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
import { useEffect, useRef, useState, type PointerEvent } from "react";
import {
  fitCameraToRenderObject,
  fitCameraToRenderScene
} from "../viewportCamera";
import type {
  ViewportInteractionReferenceAction,
  ViewportInteractionSurface
} from "../viewportInteractionSurface";

export function ViewportCanvas({
  interactionSurface,
  meshes,
  onHover,
  onSelectGeneratedReference,
  onSelect,
  primitives,
  selectedId
}: {
  readonly interactionSurface: ViewportInteractionSurface;
  readonly meshes?: readonly RenderTriangleMesh[];
  readonly onHover?: (id: string | undefined) => void;
  readonly onSelect: (id: string | undefined) => void;
  readonly onSelectGeneratedReference?: (
    reference: ViewportInteractionReferenceAction["reference"]
  ) => void;
  readonly primitives: readonly RenderPrimitive[];
  readonly selectedId?: string;
}) {
  const { hover, referenceSection, selection } = interactionSurface;
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
  const hoveredRenderIdRef = useRef<string | undefined>(undefined);

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

  function pickEventRenderId(
    event: PointerEvent<HTMLCanvasElement>
  ): string | undefined {
    const rect = event.currentTarget.getBoundingClientRect();

    return pickRenderScene(primitives, meshes ?? [], camera, size, {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    });
  }

  function emitHover(renderId: string | undefined) {
    if (hoveredRenderIdRef.current === renderId) {
      return;
    }

    hoveredRenderIdRef.current = renderId;
    onHover?.(renderId);
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
          className={`viewport-interaction-surface viewport-interaction-surface-${selection.tone}`}
          aria-live="polite"
          aria-label="Viewport interaction summary"
          data-selection-kind={selection.selectionKind}
          data-geometry-status={selection.geometryStatus}
          data-reference-overflow-count={
            referenceSection?.overflowCount.toString() ?? "0"
          }
        >
          <section className="viewport-selection-summary">
            <div className="viewport-selection-heading">
              <strong>{selection.title}</strong>
              <span>{selection.detail}</span>
            </div>
            <div className="viewport-selection-meta">
              {selection.referenceSummary &&
                selection.referenceSummary !== selection.title && (
                  <small>{selection.referenceSummary}</small>
                )}
              {selection.commandOperationLabels.length > 0 && (
                <small>{selection.commandOperationLabels.join(", ")}</small>
              )}
              {selection.geometryDetail && (
                <small>{selection.geometryDetail}</small>
              )}
            </div>
            {selection.diagnostics.length > 0 && (
              <div
                className="viewport-selection-diagnostics"
                aria-label="Viewport selection diagnostics"
              >
                {selection.diagnostics.map((diagnostic) => (
                  <small
                    key={`${diagnostic.code}:${diagnostic.status}:${diagnostic.message}`}
                    className="viewport-selection-diagnostic"
                    data-diagnostic-code={diagnostic.code}
                    data-diagnostic-status={diagnostic.status}
                  >
                    {diagnostic.message}
                  </small>
                ))}
              </div>
            )}
            {selection.measurement && (
              <section
                className={`viewport-measurement-section viewport-measurement-section-${selection.measurement.tone}`}
                aria-label="Viewport measurements"
                data-measurement-source={selection.measurement.source}
              >
                <div className="viewport-section-heading">
                  <strong>Measurements</strong>
                  <small>{selection.measurement.title}</small>
                </div>
                <span className="viewport-section-detail">
                  {selection.measurement.detail}
                </span>
                {selection.measurement.error && (
                  <small className="viewport-measurement-error">
                    {selection.measurement.error}
                  </small>
                )}
                {selection.measurement.rows.length > 0 && (
                  <dl>
                    {selection.measurement.rows.map((row) => (
                      <div key={row.label}>
                        <dt>{row.label}</dt>
                        <dd>{row.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {selection.measurement.overflowCount > 0 && (
                  <small className="viewport-overflow-note">
                    {selection.measurement.overflowCount} more measurements
                  </small>
                )}
              </section>
            )}
          </section>

          {referenceSection && (
            <section
              className="viewport-reference-section"
              aria-label="Viewport reference candidates"
            >
              <div className="viewport-section-heading">
                <strong>{referenceSection.title}</strong>
                <small>{referenceSection.summary}</small>
              </div>
              <div className="viewport-reference-counts">
                <small>{referenceSection.commandableCount} command-ready</small>
                {referenceSection.blockedCount > 0 && (
                  <small>{referenceSection.blockedCount} blocked</small>
                )}
              </div>
              <div className="viewport-reference-groups">
                {referenceSection.groups.map((group) => (
                  <div
                    key={group.kindLabel}
                    className="viewport-reference-group"
                    data-reference-group={group.kindLabel}
                  >
                    <div className="viewport-reference-group-heading">
                      <strong>{group.kindLabel}</strong>
                      <small>
                        {group.visibleCount} of {group.totalCount}
                      </small>
                    </div>
                    <ul>
                      {group.actions.map((action) => (
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
                            data-commandable={
                              action.commandable ? "true" : "false"
                            }
                            data-reference-kind={action.reference.kind}
                            onClick={() =>
                              onSelectGeneratedReference?.(action.reference)
                            }
                          >
                            <span>{action.label}</span>
                            <strong>
                              {action.commandable ? "Command-ready" : "Blocked"}
                            </strong>
                            {action.commandOperationLabels.length > 0 && (
                              <small>
                                {action.commandOperationLabels.join(", ")}
                              </small>
                            )}
                            {action.diagnostic && (
                              <small
                                className="viewport-reference-diagnostic"
                                data-diagnostic-code={action.diagnostic.code}
                                data-diagnostic-status={
                                  action.diagnostic.status
                                }
                              >
                                {action.diagnostic.message}
                              </small>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              {referenceSection.overflowCount > 0 && (
                <small className="viewport-overflow-note">
                  {referenceSection.overflowCount} more references available in
                  the inspector
                </small>
              )}
            </section>
          )}

          {hover && (
            <section
              className={`viewport-hover-summary viewport-hover-summary-${hover.tone}`}
              aria-label="Viewport hover status"
              data-hover-kind={hover.kind}
              data-reference-status={hover.referenceStatus}
            >
              <div className="viewport-section-heading">
                <strong>Hover</strong>
                <small>{hover.title}</small>
              </div>
              <span className="viewport-section-detail">{hover.detail}</span>
              {hover.commandOperationLabels.length > 0 && (
                <small>{hover.commandOperationLabels.join(", ")}</small>
              )}
              {hover.diagnostics.length > 0 && (
                <div className="viewport-hover-diagnostics">
                  {hover.diagnostics.map((diagnostic) => (
                    <small
                      key={`${diagnostic.code}:${diagnostic.status}:${diagnostic.message}`}
                      className="viewport-hover-diagnostic"
                      data-diagnostic-code={diagnostic.code}
                      data-diagnostic-status={diagnostic.status}
                    >
                      {diagnostic.message}
                    </small>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
        <canvas
          ref={canvasRef}
          aria-label="3D scene viewport"
          tabIndex={0}
          onPointerDown={(event) => {
            emitHover(undefined);
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
              emitHover(pickEventRenderId(event));
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

            const id = pickEventRenderId(event);
            onSelect(id);
          }}
          onPointerCancel={(event) => {
            const pointer = pointerRef.current;

            if (pointer?.id === event.pointerId) {
              pointerRef.current = undefined;
              emitHover(undefined);
            }
          }}
          onPointerLeave={() => emitHover(undefined)}
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
