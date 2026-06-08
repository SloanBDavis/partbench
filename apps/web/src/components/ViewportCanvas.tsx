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
  const selectionMetaItems = createSelectionMetaItems(selection);
  const selectionDiagnostics = selection.diagnostics.slice(0, 1);
  const hiddenSelectionDiagnosticCount = Math.max(
    0,
    selection.diagnostics.length - selectionDiagnostics.length
  );
  const referenceActions =
    referenceSection?.groups.flatMap((group) => group.actions).slice(0, 3) ??
    [];
  const hiddenReferenceActionCount = referenceSection
    ? Math.max(0, referenceSection.totalCount - referenceActions.length)
    : 0;
  const hoverDiagnostics = hover?.diagnostics.slice(0, 1) ?? [];
  const hiddenHoverDiagnosticCount = hover
    ? Math.max(0, hover.diagnostics.length - hoverDiagnostics.length)
    : 0;
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
            {selectionMetaItems.length > 0 && (
              <div className="viewport-selection-meta">
                {selectionMetaItems.map((item) => (
                  <small key={item}>{item}</small>
                ))}
              </div>
            )}
            {selectionDiagnostics.length > 0 && (
              <div
                className="viewport-selection-diagnostics"
                aria-label="Viewport selection diagnostics"
              >
                {selectionDiagnostics.map((diagnostic) => (
                  <small
                    key={`${diagnostic.code}:${diagnostic.status}:${diagnostic.message}`}
                    className="viewport-selection-diagnostic"
                    data-diagnostic-code={diagnostic.code}
                    data-diagnostic-status={diagnostic.status}
                  >
                    {diagnostic.message}
                  </small>
                ))}
                {hiddenSelectionDiagnosticCount > 0 && (
                  <small className="viewport-overflow-note">
                    {hiddenSelectionDiagnosticCount} more diagnostics in
                    inspector
                  </small>
                )}
              </div>
            )}
            {selection.measurement && selection.measurement.rows.length > 0 && (
              <section
                className={`viewport-measurement-section viewport-measurement-section-${selection.measurement.tone}`}
                aria-label={`Viewport measurements: ${selection.measurement.title}, ${selection.measurement.detail}`}
                data-measurement-source={selection.measurement.source}
              >
                {selection.measurement.rows[0] && (
                  <small className="viewport-measurement-chip">
                    {selection.measurement.rows[0].label}:{" "}
                    {selection.measurement.rows[0].value}
                  </small>
                )}
                {selection.measurement.rows.length +
                  selection.measurement.overflowCount >
                  1 && (
                  <small className="viewport-overflow-note">
                    {selection.measurement.rows.length -
                      1 +
                      selection.measurement.overflowCount}{" "}
                    more measurements in inspector
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
              <div className="viewport-reference-actions-row">
                {referenceActions.map((action) => (
                  <button
                    key={action.id}
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
                    data-reference-group={action.kindLabel}
                    aria-label={formatReferenceActionLabel(action)}
                    title={formatReferenceActionLabel(action)}
                    onClick={() =>
                      onSelectGeneratedReference?.(action.reference)
                    }
                  >
                    <span>{action.label}</span>
                    <strong>
                      {action.commandable ? "Command-ready" : "Blocked"}
                    </strong>
                    {action.diagnostic && (
                      <small
                        className="viewport-reference-diagnostic"
                        data-diagnostic-code={action.diagnostic.code}
                        data-diagnostic-status={action.diagnostic.status}
                      >
                        {action.diagnostic.message}
                      </small>
                    )}
                  </button>
                ))}
              </div>
              {hiddenReferenceActionCount > 0 && (
                <small className="viewport-overflow-note">
                  {hiddenReferenceActionCount} more references in inspector
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
              {hoverDiagnostics.length > 0 && (
                <div className="viewport-hover-diagnostics">
                  {hoverDiagnostics.map((diagnostic) => (
                    <small
                      key={`${diagnostic.code}:${diagnostic.status}:${diagnostic.message}`}
                      className="viewport-hover-diagnostic"
                      data-diagnostic-code={diagnostic.code}
                      data-diagnostic-status={diagnostic.status}
                    >
                      {diagnostic.message}
                    </small>
                  ))}
                  {hiddenHoverDiagnosticCount > 0 && (
                    <small className="viewport-overflow-note">
                      {hiddenHoverDiagnosticCount} more diagnostics in inspector
                    </small>
                  )}
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

function createSelectionMetaItems(
  selection: ViewportInteractionSurface["selection"]
): readonly string[] {
  const items: string[] = [];

  if (
    selection.referenceSummary &&
    selection.referenceSummary !== selection.title
  ) {
    items.push(selection.referenceSummary);
  }

  if (selection.commandOperationLabels.length > 0) {
    const visibleOperations = selection.commandOperationLabels.slice(0, 2);
    const hiddenOperationCount =
      selection.commandOperationLabels.length - visibleOperations.length;
    items.push(
      hiddenOperationCount > 0
        ? `${visibleOperations.join(", ")} +${hiddenOperationCount}`
        : visibleOperations.join(", ")
    );
  }

  if (selection.geometryDetail) {
    items.push(selection.geometryDetail);
  }

  return items;
}

function formatReferenceActionLabel(
  action: ViewportInteractionReferenceAction
): string {
  return [
    `${action.kindLabel}: ${action.label}`,
    action.commandable ? "Command-ready" : "Blocked",
    action.commandOperationLabels.join(", "),
    action.diagnostic?.message
  ]
    .filter((part) => part && part.length > 0)
    .join(" / ");
}
