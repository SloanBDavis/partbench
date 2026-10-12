import { useEffect, useRef, useState, type PointerEvent } from "react";
import {
  isDrawingEntity,
  type CadOp,
  type DocumentUnits,
  type DrawingEntity,
  type Vec2
} from "@web-cad/cad-protocol";
import { DrawingDimensionControls } from "./DrawingDimensionControls";
import { DrawingDimensionGlyph } from "./DrawingDimensionGlyph";
import { resolveDrawingDimension } from "@web-cad/cad-protocol";
import { CoordinateInput } from "./CoordinateInput";
import { DrawingFrameControls } from "./DrawingFrameControls";
import {
  parseDrawingLength,
  WORLD_DRAWING_FRAME,
  type DrawingFrame
} from "./drawingCoordinates";
import {
  drawingSnapKinds,
  findDrawingSnaps,
  type DrawingSnapCandidate,
  type DrawingSnapKind
} from "./drawingSnaps";
import "./drawing.css";

type Tool = "select" | "line" | "rectangle" | "circle" | "pan" | "dimension";
type View = { x: number; y: number; width: number; height: number };
const initialView: View = { x: -100, y: -75, width: 200, height: 150 };
const titles: Record<Tool, string> = {
  select: "Select",
  line: "Line",
  rectangle: "Rectangle",
  circle: "Circle",
  dimension: "Dimension",
  pan: "Pan"
};

function fitDrawing(values: readonly DrawingEntity[]): View {
  if (!values.length) {
    return initialView;
  }
  const entities = new Map(values.map((entity) => [entity.id, entity]));
  const bounds = values.flatMap((entity) =>
    entity.kind === "dimension"
      ? (() => {
          const resolved = resolveDrawingDimension(entity, entities);
          return resolved
            ? [resolved.start, resolved.end, resolved.labelPosition].map(
                (p) => [p[0], -p[1]]
              )
            : [];
        })()
      : entity.kind === "circle"
        ? [
            [
              entity.center[0] - entity.radius,
              -entity.center[1] - entity.radius
            ],
            [
              entity.center[0] + entity.radius,
              -entity.center[1] + entity.radius
            ]
          ]
        : [
            [entity.start[0], -entity.start[1]],
            [entity.end[0], -entity.end[1]]
          ]
  );
  const minX = Math.min(...bounds.map((p) => p[0]!)),
    maxX = Math.max(...bounds.map((p) => p[0]!));
  const minY = Math.min(...bounds.map((p) => p[1]!)),
    maxY = Math.max(...bounds.map((p) => p[1]!));
  const w = Math.max(maxX - minX, 20) * 1.3,
    h = Math.max(maxY - minY, 20) * 1.3;
  return {
    x: (minX + maxX - w) / 2,
    y: (minY + maxY - h) / 2,
    width: w,
    height: h
  };
}

interface Props {
  entities: ReadonlyMap<string, DrawingEntity>;
  units: DocumentUnits;
  disabled: boolean;
  error?: string;
  commit: (ops: readonly CadOp[]) => Promise<boolean>;
  changeUnits: (units: DocumentUnits) => void;
  save: () => void;
  open: () => void;
}

export function DrawingWorkspace({
  entities,
  units,
  disabled,
  error,
  commit,
  changeUnits,
  save,
  open
}: Props) {
  const [tool, setTool] = useState<Tool>("select");
  const [placingDimension, setPlacingDimension] = useState(false);
  const [dimensionPlacement, setDimensionPlacement] = useState<Vec2>();
  const [selectedId, setSelectedId] = useState<string>();
  const [start, setStart] = useState<Vec2>();
  const [cursor, setCursor] = useState<Vec2>();
  const [snap, setSnap] = useState(false);
  const [objectSnaps, setObjectSnaps] = useState(true);
  const [tracking, setTracking] = useState(true);
  const [enabledKinds, setEnabledKinds] =
    useState<readonly DrawingSnapKind[]>(drawingSnapKinds);
  const [candidates, setCandidates] = useState<readonly DrawingSnapCandidate[]>(
    []
  );
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [trackingPoints, setTrackingPoints] = useState<readonly Vec2[]>([]);
  const [typedCursor, setTypedCursor] = useState<Vec2>();
  const [frame, setFrame] = useState<DrawingFrame>(WORLD_DRAWING_FRAME);
  const [inputVersion, setInputVersion] = useState(0);
  const pointerLocation = useRef<{ x: number; y: number } | undefined>(
    undefined
  );
  const [screenScale, setScreenScale] = useState(1);
  const [source, setSource] = useState({ entities, units });
  const [view, setView] = useState(() => fitDrawing([...entities.values()]));
  const svg = useRef<SVGSVGElement>(null);
  const workspace = useRef<HTMLElement>(null);
  const coordinateFocus = useRef(false);
  const busy = useRef(false);
  const pan = useRef<{ x: number; y: number; view: View } | undefined>(
    undefined
  );
  const [notice, setNotice] = useState("");
  const selected = selectedId ? entities.get(selectedId) : undefined;
  const values = [...entities.values()];
  const creating = tool === "line" || tool === "circle" || tool === "rectangle";
  const activeSnap =
    creating && objectSnaps ? candidates[candidateIndex] : undefined;
  const clearTarget = () => {
    setCursor(undefined);
    setTypedCursor(undefined);
    setCandidates([]);
    setCandidateIndex(0);
    pointerLocation.current = undefined;
  };
  // Reset transient input when source/history or units change, before rendering
  // new geometry. No draft point survives in an obsolete coordinate system.
  if (source.entities !== entities || source.units !== units) {
    setSource({ entities, units });
    setStart(undefined);
    setCursor(undefined);
    setTypedCursor(undefined);
    setCandidates([]);
    setTrackingPoints([]);
    setInputVersion(inputVersion + 1);
    if (source.units !== units) setFrame(WORLD_DRAWING_FRAME);
  }
  useEffect(() => {
    if (coordinateFocus.current)
      workspace.current
        ?.querySelector<HTMLInputElement>("[data-drawing-coordinate]")
        ?.focus();
  }, [inputVersion, tool]);
  const choose = (next: Tool) => {
    setPlacingDimension(false);
    setDimensionPlacement(undefined);
    coordinateFocus.current =
      next === "line" || next === "circle" || next === "rectangle";
    setTool(next);
    clearTarget();
    setInputVersion((v) => v + 1);
    setStart(undefined);
    setNotice("");
  };
  const fit = () => {
    clearTarget();
    setView(fitDrawing(values));
  };
  const zoom = (factor: number) => {
    clearTarget();
    setView((v) => {
      const w = Math.min(1e9, Math.max(0.01, v.width * factor)),
        h = (w * v.height) / v.width;
      return {
        x: v.x + (v.width - w) / 2,
        y: v.y + (v.height - h) / 2,
        width: w,
        height: h
      };
    });
  };
  const acquire = (event: PointerEvent<SVGSVGElement>): Vec2 => {
    // Keep the exact preview target when clicking or cycling at the same pixel.
    if (
      pointerLocation.current?.x === event.clientX &&
      pointerLocation.current?.y === event.clientY &&
      cursor
    ) {
      return activeSnap?.point ?? cursor;
    }
    const matrix = svg.current?.getScreenCTM();
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(
      matrix?.inverse()
    );
    const raw: Vec2 = [p.x, -p.y];
    if (matrix) setScreenScale(Math.hypot(matrix.a, matrix.b));
    const next =
      creating && objectSnaps && matrix
        ? findDrawingSnaps({
            entities: values,
            point: raw,
            tolerance: 10 / Math.hypot(matrix.a, matrix.b),
            base: start,
            enabled: enabledKinds.filter(
              (kind) => tracking || kind !== "tracking"
            ),
            trackingPoints: tracking ? trackingPoints : []
          })
        : [];
    const target: Vec2 =
      next[0]?.point ??
      (snap
        ? [Math.round(raw[0]), Math.round(raw[1])]
        : [Number(raw[0].toFixed(4)), Number(raw[1].toFixed(4))]);
    setCandidates(next);
    setCandidateIndex(0);
    setCursor(target);
    setTypedCursor(undefined);
    pointerLocation.current = { x: event.clientX, y: event.clientY };
    return target;
  };
  const submit = async (ops: readonly CadOp[], id?: string) => {
    if (disabled || busy.current) return false;
    busy.current = true;
    try {
      const ok = await commit(ops);
      if (ok) {
        setPlacingDimension(false);
        if (
          ops.some(
            (op) =>
              (op.op === "drawing.entity.create" ||
                op.op === "drawing.entity.update") &&
              op.entity.kind === "dimension"
          )
        )
          setTool("select");
        setSelectedId(id);
        setStart(undefined);
        clearTarget();
        setInputVersion((v) => v + 1);
        setNotice("");
      }
      return ok;
    } finally {
      busy.current = false;
    }
  };
  const remove = () =>
    selected && void submit([{ op: "drawing.entity.delete", id: selected.id }]);
  const make = (
    a: Vec2,
    b: Vec2,
    id: string
  ): Exclude<DrawingEntity, { kind: "dimension" }> =>
    tool === "circle"
      ? {
          id,
          kind: "circle",
          center: a,
          radius: Math.hypot(b[0] - a[0], b[1] - a[1])
        }
      : {
          id,
          kind: tool === "rectangle" ? "rectangle" : "line",
          start: a,
          end: b
        };
  const setPoint = async (p: Vec2) => {
    if (disabled || busy.current || !creating) return false;
    if (!start) {
      setStart(p);
      clearTarget();
      return true;
    }
    const entity = make(start, p, `drawing_${crypto.randomUUID()}`);
    if (!isDrawingEntity(entity)) {
      setNotice("Choose a different point; geometry must have nonzero size.");
      return false;
    }
    return submit([{ op: "drawing.entity.create", entity }], entity.id);
  };
  const target = typedCursor ?? activeSnap?.point ?? cursor;
  const preview = start && target ? make(start, target, "preview") : undefined;
  const markerSize = 7 / screenScale;
  const invalidateSnaps = () => {
    clearTarget();
  };

  const hint = placingDimension
    ? "Click to place the dimension label, then Apply. Esc cancels placement."
    : tool === "dimension"
      ? "Choose geometry points and a dimension type in the properties panel."
      : tool === "select"
        ? "Click an entity to edit its coordinates. Delete removes the selection."
        : tool === "pan"
          ? "Drag to pan. Scroll to zoom."
          : start
            ? tool === "circle"
              ? "Click a point on the circle. Esc cancels."
              : "Click the second point, or press Enter to type it. Esc cancels."
            : tool === "circle"
              ? "Click the center, then a point on the circle, or enter coordinates."
              : "Click two points, or press Enter to type coordinates.";

  return (
    <section
      ref={workspace}
      onFocus={(event) => {
        if ((event.target as HTMLElement).matches("[data-drawing-coordinate]"))
          coordinateFocus.current = true;
      }}
      className="drawing-workspace"
      aria-label="Drawing workspace"
      onKeyDown={(event) => {
        const fromEmptyCoordinate =
          (event.target as HTMLInputElement).matches(
            "[data-drawing-coordinate]"
          ) && (event.target as HTMLInputElement).value === "";
        const snapShortcut =
          fromEmptyCoordinate &&
          activeSnap &&
          ((event.key === "Tab" && candidates.length > 1) ||
            (event.key === " " && tracking));
        const canvasKey = event.target === svg.current || snapShortcut;
        if (snapShortcut) {
          coordinateFocus.current = false;
          svg.current?.focus();
        }
        if (
          ((event.target as HTMLElement).closest("input,select,textarea") &&
            !snapShortcut) ||
          event.ctrlKey ||
          event.metaKey ||
          event.altKey
        )
          return;
        if (event.key === "Tab" && canvasKey && candidates.length > 1) {
          const next =
            (candidateIndex + (event.shiftKey ? candidates.length - 1 : 1)) %
            candidates.length;
          setCandidateIndex(next);
          setCursor(candidates[next]!.point);
          event.preventDefault();
        } else if (event.key === " " && canvasKey && activeSnap && tracking) {
          setTrackingPoints((points) =>
            [
              ...points.filter(
                (p) =>
                  p[0] !== activeSnap.point[0] || p[1] !== activeSnap.point[1]
              ),
              activeSnap.point
            ].slice(-2)
          );
          setNotice(
            "Tracking point acquired. Move along its horizontal or vertical guide."
          );
          event.preventDefault();
        } else if (
          event.key === "Enter" &&
          creating &&
          event.target === svg.current
        ) {
          coordinateFocus.current = true;
          workspace.current
            ?.querySelector<HTMLInputElement>("[data-drawing-coordinate]")
            ?.focus();
          event.preventDefault();
        } else if (event.key === "Escape") {
          choose("select");
          event.preventDefault();
        } else if (event.key === "Delete" || event.key === "Backspace") {
          remove();
          event.preventDefault();
        } else if (event.key.toLowerCase() === "f") {
          fit();
          event.preventDefault();
        } else {
          const next = (
            {
              v: "select",
              l: "line",
              r: "rectangle",
              c: "circle",
              d: "dimension",
              p: "pan"
            } as const
          )[event.key.toLowerCase()];
          if (next) {
            choose(next);
            event.preventDefault();
          }
        }
      }}
    >
      <div
        className="drawing-toolbar"
        role="toolbar"
        aria-label="Drawing tools"
      >
        {(
          ["select", "line", "rectangle", "circle", "dimension", "pan"] as const
        ).map((t) => (
          <button
            key={t}
            data-drawing-tool={t}
            aria-pressed={tool === t}
            disabled={disabled}
            onClick={() => choose(t)}
            title={`${titles[t]} (${{ select: "V", line: "L", rectangle: "R", circle: "C", dimension: "D", pan: "P" }[t]})`}
          >
            {titles[t]}
          </button>
        ))}
        <button onClick={fit} title="Fit drawing (F)">
          Fit
        </button>
        <button aria-label="Zoom in drawing" onClick={() => zoom(0.8)}>
          ＋
        </button>
        <button aria-label="Zoom out drawing" onClick={() => zoom(1.25)}>
          −
        </button>
        <label>
          <input
            type="checkbox"
            checked={snap}
            aria-label="Grid snap"
            onChange={(e) => {
              setSnap(e.target.checked);
              invalidateSnaps();
            }}
          />{" "}
          Grid 1 {units}
        </label>
        <label>
          <input
            type="checkbox"
            aria-label="Object snaps"
            checked={objectSnaps}
            onChange={(e) => {
              setObjectSnaps(e.target.checked);
              invalidateSnaps();
            }}
          />
          Object snaps
        </label>
        <label>
          <input
            type="checkbox"
            aria-label="Object tracking"
            checked={tracking}
            onChange={(e) => {
              setTracking(e.target.checked);
              setTrackingPoints([]);
              invalidateSnaps();
            }}
          />
          Tracking
        </label>
        <span className="drawing-toolbar-spacer" />
        <button disabled={disabled} onClick={open}>
          Open .wcad
        </button>
        <button disabled={disabled} onClick={save}>
          Save drawing
        </button>
      </div>
      <div className="drawing-body">
        <div className="drawing-canvas-wrap">
          <div className="drawing-caption">
            <strong>Model space</strong>
            <span>2D drawing · {units}</span>
          </div>
          <svg
            ref={svg}
            role="application"
            aria-label="2D drawing canvas"
            tabIndex={0}
            viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
            onWheel={(e) => {
              e.preventDefault();
              zoom(e.deltaY > 0 ? 1.12 : 1 / 1.12);
            }}
            onPointerDown={(event) => {
              if (event.button !== 0 && event.button !== 1) return;
              event.preventDefault();
              coordinateFocus.current = false;
              event.currentTarget.focus();
              if (event.button === 1 || tool === "pan") {
                clearTarget();
                pan.current = { x: event.clientX, y: event.clientY, view };
                event.currentTarget.setPointerCapture(event.pointerId);
                return;
              }
              if (disabled || busy.current) return;
              if (placingDimension) {
                setDimensionPlacement(acquire(event));
                setPlacingDimension(false);
                return;
              }
              if (tool === "dimension") return;
              if (tool === "select") {
                const id = (event.target as Element)
                  .closest("[data-drawing-entity]")
                  ?.getAttribute("data-drawing-entity");
                setSelectedId(id ?? undefined);
                setNotice("");
                return;
              }
              const p = acquire(event);
              setInputVersion((v) => v + 1);
              void setPoint(p);
            }}
            onPointerMove={(event) => {
              if (pan.current) {
                const matrix = svg.current?.getScreenCTM();
                if (matrix)
                  setView({
                    ...pan.current.view,
                    x:
                      pan.current.view.x -
                      (event.clientX - pan.current.x) / matrix.a,
                    y:
                      pan.current.view.y -
                      (event.clientY - pan.current.y) / matrix.d
                  });
              } else acquire(event);
            }}
            onPointerLeave={() => {
              if (!pan.current) clearTarget();
            }}
            onPointerUp={() => {
              pan.current = undefined;
            }}
            onPointerCancel={() => {
              pan.current = undefined;
            }}
          >
            <defs>
              <pattern
                id="drawing-grid"
                width="10"
                height="10"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 10 0 L 0 0 0 10"
                  fill="none"
                  stroke="#263445"
                  strokeWidth="0.5"
                  vectorEffect="non-scaling-stroke"
                />
              </pattern>
            </defs>
            <rect
              x={view.x - view.width * 10}
              y={view.y - view.height * 10}
              width={view.width * 21}
              height={view.height * 21}
              fill="url(#drawing-grid)"
            />
            <path
              d={`M ${view.x - view.width * 10} 0 H ${view.x + view.width * 11} M 0 ${view.y - view.height * 10} V ${view.y + view.height * 11}`}
              stroke="#435166"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
            {values.map((entity, index) => (
              <g
                key={entity.id}
                data-drawing-entity={entity.id}
                aria-label={`${titles[entity.kind]} ${index + 1}`}
                className={
                  selected?.id === entity.id
                    ? "drawing-entity selected"
                    : "drawing-entity"
                }
              >
                {entity.kind === "dimension" ? (
                  <DrawingDimensionGlyph
                    entity={entity}
                    entities={entities}
                    units={units}
                    size={view.width / 65}
                  />
                ) : (
                  <>
                    <Shape entity={entity} hit />
                    <Shape entity={entity} />
                  </>
                )}
              </g>
            ))}
            {preview && (
              <g
                className="drawing-preview"
                data-drawing-preview
                data-start-x={start?.[0]}
                data-start-y={start?.[1]}
                data-end-x={target?.[0]}
                data-end-y={target?.[1]}
                pointerEvents="none"
              >
                <Shape entity={preview} />
              </g>
            )}
            {trackingPoints.map((p, i) => (
              <path
                key={i}
                className="drawing-tracking-point"
                pointerEvents="none"
                d={`M ${p[0] - markerSize} ${-p[1]} h ${markerSize * 2} M ${p[0]} ${-p[1] - markerSize} v ${markerSize * 2}`}
              />
            ))}
            {activeSnap && !typedCursor && (
              <g
                data-drawing-snap={activeSnap.kind}
                data-snap-x={activeSnap.point[0]}
                data-snap-y={activeSnap.point[1]}
                className="drawing-snap"
                pointerEvents="none"
              >
                {activeSnap.guides.map((guide, i) => (
                  <line
                    key={i}
                    className="drawing-snap-guide"
                    x1={guide.start[0]}
                    y1={-guide.start[1]}
                    x2={guide.end[0]}
                    y2={-guide.end[1]}
                  />
                ))}
                <rect
                  x={activeSnap.point[0] - markerSize}
                  y={-activeSnap.point[1] - markerSize}
                  width={markerSize * 2}
                  height={markerSize * 2}
                />
                <text
                  x={activeSnap.point[0] + markerSize * 2}
                  y={-activeSnap.point[1] - markerSize * 2}
                  fontSize={markerSize * 1.8}
                >
                  {activeSnap.description}
                  {candidates.length > 1
                    ? ` (${candidateIndex + 1}/${candidates.length} · Tab)`
                    : ""}
                </text>
              </g>
            )}
          </svg>
          {values.length === 0 && !start && (
            <div className="drawing-empty">
              <strong>Start your drawing</strong>
              <p>
                Choose Line, Rectangle, or Circle.
                <br />
                Click points on the canvas or enter exact coordinates.
              </p>
            </div>
          )}
          <div className="drawing-coordinate">
            X {Number((target?.[0] ?? 0).toPrecision(10))} · Y{" "}
            {Number((target?.[1] ?? 0).toPrecision(10))} {units}
          </div>
        </div>
        <aside className="drawing-properties" aria-label="Drawing properties">
          <h2>{tool === "select" ? "Properties" : titles[tool]}</h2>
          <label className="drawing-unit-label">
            Drawing units
            <select
              aria-label="Drawing units"
              value={units}
              disabled={disabled}
              onChange={(e) => {
                setStart(undefined);
                changeUnits(e.target.value as DocumentUnits);
              }}
            >
              {(["mm", "cm", "m", "in"] as const).map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </label>
          <p className="drawing-muted">
            Changing units preserves physical size.
          </p>
          <DrawingFrameControls
            key={units}
            units={units}
            frame={frame}
            disabled={disabled}
            onChange={(next) => {
              setFrame(next);
              setStart(undefined);
              clearTarget();
              setInputVersion((v) => v + 1);
            }}
          />
          {creating && (
            <CoordinateInput
              key={`${tool}:${units}:${inputVersion}`}
              units={units}
              base={start}
              frame={frame}
              disabled={disabled}
              label={
                start
                  ? tool === "circle"
                    ? "Point on circle"
                    : "Second point"
                  : tool === "circle"
                    ? "Center point"
                    : "First point"
              }
              onSubmit={setPoint}
              onPreview={setTypedCursor}
              onCancel={() => choose("select")}
            />
          )}
          <details className="drawing-snap-settings">
            <summary>Snap settings</summary>
            {drawingSnapKinds
              .filter((kind) => kind !== "tracking")
              .map((kind) => (
                <label key={kind}>
                  <input
                    type="checkbox"
                    aria-label={`Snap ${kind}`}
                    checked={enabledKinds.includes(kind)}
                    onChange={(e) => {
                      setEnabledKinds((previous) =>
                        e.target.checked
                          ? [...previous, kind]
                          : previous.filter((k) => k !== kind)
                      );
                      invalidateSnaps();
                    }}
                  />
                  {kind}
                </label>
              ))}
            <p className="drawing-muted">
              Within 10 pixels. Tab cycles nearby targets. Hover a snap and
              press Space to acquire up to two tracking points.
            </p>
            <button
              disabled={!trackingPoints.length}
              onClick={() => {
                setTrackingPoints([]);
                invalidateSnaps();
              }}
            >
              Clear tracking points
            </button>
          </details>
          {tool === "line" || tool === "circle" || tool === "rectangle" ? (
            <EntityForm
              key={`${tool}:${units}`}
              kind={tool}
              units={units}
              disabled={disabled}
              onApply={(entity) =>
                submit([{ op: "drawing.entity.create", entity }], entity.id)
              }
            />
          ) : tool === "dimension" || selected?.kind === "dimension" ? (
            <DrawingDimensionControls
              key={
                tool === "dimension" ? `new:${units}` : JSON.stringify(selected)
              }
              entity={
                tool === "select" && selected?.kind === "dimension"
                  ? selected
                  : undefined
              }
              source={selected}
              entities={entities}
              units={units}
              disabled={disabled}
              placement={dimensionPlacement}
              onPick={() => setPlacingDimension(true)}
              onApply={(entity) =>
                submit(
                  [
                    {
                      op:
                        tool === "select"
                          ? "drawing.entity.update"
                          : "drawing.entity.create",
                      entity
                    }
                  ],
                  entity.id
                )
              }
            />
          ) : selected ? (
            <EntityForm
              key={JSON.stringify(selected)}
              kind={selected.kind}
              entity={selected}
              units={units}
              disabled={disabled}
              onApply={(entity) =>
                submit([{ op: "drawing.entity.update", entity }], entity.id)
              }
            />
          ) : (
            <p>Select an entity to inspect and edit its coordinates.</p>
          )}
          <button
            data-drawing-delete
            disabled={!selected || disabled}
            onClick={remove}
          >
            Delete selected
          </button>
          <h3>
            Entities <span data-drawing-count>{values.length}</span>
          </h3>
          <ul className="drawing-entity-list" aria-label="Drawing entities">
            {values.map((entity, index) => (
              <li key={entity.id}>
                <button
                  aria-pressed={selected?.id === entity.id}
                  data-drawing-select={entity.id}
                  onClick={() => {
                    choose("select");
                    setSelectedId(entity.id);
                  }}
                >
                  {titles[entity.kind]} {index + 1}
                </button>
              </li>
            ))}
          </ul>
          <p className="drawing-muted">
            L Line · R Rectangle · C Circle
            <br />V Select · P Pan · F Fit
            <br />
            Enter Coordinates · Esc Cancel · Delete Remove
            <br />
            Ctrl/Cmd+Z Undo
          </p>
        </aside>
      </div>
      <div className="drawing-instruction" role="status">
        {error ||
          notice ||
          (activeSnap
            ? `${activeSnap.description} · Tab cycles nearby targets · Space acquires tracking point`
            : hint)}
      </div>
    </section>
  );
}

function Shape({
  entity,
  hit = false
}: {
  entity: Exclude<DrawingEntity, { kind: "dimension" }>;
  hit?: boolean;
}) {
  const props = {
    fill: "none",
    stroke: hit ? "transparent" : "currentColor",
    strokeWidth: hit ? 14 : 1.8,
    vectorEffect: "non-scaling-stroke" as const,
    pointerEvents: hit ? ("stroke" as const) : ("none" as const)
  };
  if (entity.kind === "circle")
    return (
      <circle
        {...props}
        cx={entity.center[0]}
        cy={-entity.center[1]}
        r={entity.radius}
      />
    );
  if (entity.kind === "rectangle")
    return (
      <rect
        {...props}
        x={Math.min(entity.start[0], entity.end[0])}
        y={-Math.max(entity.start[1], entity.end[1])}
        width={Math.abs(entity.end[0] - entity.start[0])}
        height={Math.abs(entity.end[1] - entity.start[1])}
      />
    );
  return (
    <line
      {...props}
      x1={entity.start[0]}
      y1={-entity.start[1]}
      x2={entity.end[0]}
      y2={-entity.end[1]}
    />
  );
}

function EntityForm({
  kind,
  entity,
  units,
  disabled,
  onApply
}: {
  kind: Exclude<DrawingEntity, { kind: "dimension" }>["kind"];
  entity?: Exclude<DrawingEntity, { kind: "dimension" }>;
  units: DocumentUnits;
  disabled: boolean;
  onApply: (entity: DrawingEntity) => Promise<boolean>;
}) {
  const a = entity
    ? entity.kind === "circle"
      ? entity.center
      : entity.start
    : [0, 0];
  const b = entity && entity.kind !== "circle" ? entity.end : [40, 30];
  const [fields, setFields] = useState({
    x: String(a[0]),
    y: String(a[1]),
    endX: String(b[0]),
    endY: String(b[1]),
    radius: String(entity?.kind === "circle" ? entity.radius : 10)
  });
  const length = (text: string) => {
    const result = parseDrawingLength(text, units);
    return result.ok ? result.value : NaN;
  };
  const candidate: DrawingEntity =
    kind === "circle"
      ? {
          id: entity?.id ?? "new",
          kind,
          center: [length(fields.x), length(fields.y)],
          radius: length(fields.radius)
        }
      : {
          id: entity?.id ?? "new",
          kind,
          start: [length(fields.x), length(fields.y)],
          end: [length(fields.endX), length(fields.endY)]
        };
  const fieldNames =
    kind === "circle"
      ? (["x", "y", "radius"] as const)
      : (["x", "y", "endX", "endY"] as const);
  const valid =
    fieldNames.every((key) => fields[key].trim() !== "") &&
    isDrawingEntity(candidate);
  const labels = {
    x: kind === "circle" ? "Center X" : "Start X",
    y: kind === "circle" ? "Center Y" : "Start Y",
    endX: "End X",
    endY: "End Y",
    radius: "Radius"
  };
  return (
    <form
      className="drawing-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid && !disabled)
          void onApply({
            ...candidate,
            id: entity?.id ?? `drawing_${crypto.randomUUID()}`
          });
      }}
    >
      <h3>
        {entity ? `Edit ${kind}` : `Create ${kind}`} <small>({units})</small>
      </h3>
      <p className="drawing-muted">
        Model XY coordinates. Unit suffixes accepted.
      </p>
      {fieldNames.map((key) => (
        <label key={key}>
          {labels[key]}
          <input
            aria-label={labels[key]}
            data-drawing-field={key}
            type="text"
            value={fields[key]}
            disabled={disabled}
            onChange={(e) => setFields({ ...fields, [key]: e.target.value })}
          />
        </label>
      ))}
      {!valid && (
        <p role="alert">
          Enter finite coordinates and a nonzero{" "}
          {kind === "circle"
            ? "positive radius"
            : kind === "rectangle"
              ? "width and height"
              : "length"}
          .
        </p>
      )}
      <button data-drawing-apply type="submit" disabled={!valid || disabled}>
        {entity ? "Apply changes" : `Create ${kind}`}
      </button>
    </form>
  );
}
