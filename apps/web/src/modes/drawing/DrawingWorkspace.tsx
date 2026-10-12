import { useRef, useState, type PointerEvent } from "react";
import {
  isDrawingEntity,
  type CadOp,
  type DocumentUnits,
  type DrawingEntity,
  type Vec2
} from "@web-cad/cad-protocol";
import "./drawing.css";

type Tool = "select" | "line" | "rectangle" | "circle" | "pan";
type View = { x: number; y: number; width: number; height: number };
const initialView: View = { x: -100, y: -75, width: 200, height: 150 };
const titles: Record<Tool, string> = {
  select: "Select",
  line: "Line",
  rectangle: "Rectangle",
  circle: "Circle",
  pan: "Pan"
};

function fitDrawing(values: readonly DrawingEntity[]): View {
  if (!values.length) {
    return initialView;
  }
  const bounds = values.flatMap((entity) =>
    entity.kind === "circle"
      ? [
          [entity.center[0] - entity.radius, -entity.center[1] - entity.radius],
          [entity.center[0] + entity.radius, -entity.center[1] + entity.radius]
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
  const [selectedId, setSelectedId] = useState<string>();
  const [start, setStart] = useState<Vec2>();
  const [cursor, setCursor] = useState<Vec2>();
  const [snap, setSnap] = useState(false);
  const [view, setView] = useState(() => fitDrawing([...entities.values()]));
  const svg = useRef<SVGSVGElement>(null);
  const busy = useRef(false);
  const pan = useRef<{ x: number; y: number; view: View } | undefined>(
    undefined
  );
  const [notice, setNotice] = useState("");
  const selected = selectedId ? entities.get(selectedId) : undefined;
  const values = [...entities.values()];
  const choose = (next: Tool) => {
    setTool(next);
    setStart(undefined);
    setNotice("");
  };
  const fit = () => setView(fitDrawing(values));
  const zoom = (factor: number) =>
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
  const point = (event: PointerEvent<SVGSVGElement>): Vec2 => {
    const matrix = svg.current?.getScreenCTM()?.inverse();
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(
      matrix
    );
    return snap
      ? [Math.round(p.x), Math.round(-p.y)]
      : [Number(p.x.toFixed(4)), Number((-p.y).toFixed(4))];
  };
  const submit = async (ops: readonly CadOp[], id?: string) => {
    if (disabled || busy.current) return false;
    busy.current = true;
    try {
      const ok = await commit(ops);
      if (ok) {
        setSelectedId(id);
        setStart(undefined);
        setNotice("");
      }
      return ok;
    } finally {
      busy.current = false;
    }
  };
  const remove = () =>
    selected && void submit([{ op: "drawing.entity.delete", id: selected.id }]);
  const make = (a: Vec2, b: Vec2, id: string): DrawingEntity =>
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
  const preview = start && cursor ? make(start, cursor, "preview") : undefined;
  const hint =
    tool === "select"
      ? "Click an entity to edit its coordinates. Delete removes the selection."
      : tool === "pan"
        ? "Drag to pan. Scroll to zoom."
        : start
          ? tool === "circle"
            ? "Click a point on the circle. Esc cancels."
            : "Click the second point. Esc cancels."
          : tool === "circle"
            ? "Click the center, then a point on the circle, or enter coordinates."
            : "Click two points, or enter coordinates.";

  return (
    <section
      className="drawing-workspace"
      aria-label="Drawing workspace"
      onKeyDown={(event) => {
        if (
          (event.target as HTMLElement).closest("input,select,textarea") ||
          event.ctrlKey ||
          event.metaKey ||
          event.altKey
        )
          return;
        if (event.key === "Escape") {
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
        {(["select", "line", "rectangle", "circle", "pan"] as const).map(
          (t) => (
            <button
              key={t}
              data-drawing-tool={t}
              aria-pressed={tool === t}
              disabled={disabled}
              onClick={() => choose(t)}
              title={`${titles[t]} (${{ select: "V", line: "L", rectangle: "R", circle: "C", pan: "P" }[t]})`}
            >
              {titles[t]}
            </button>
          )
        )}
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
            onChange={(e) => setSnap(e.target.checked)}
          />{" "}
          Snap 1 {units}
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
              event.currentTarget.focus();
              if (event.button === 1 || tool === "pan") {
                pan.current = { x: event.clientX, y: event.clientY, view };
                event.currentTarget.setPointerCapture(event.pointerId);
                return;
              }
              if (disabled || busy.current) return;
              if (tool === "select") {
                const id = (event.target as Element)
                  .closest("[data-drawing-entity]")
                  ?.getAttribute("data-drawing-entity");
                setSelectedId(id ?? undefined);
                setNotice("");
                return;
              }
              const p = point(event);
              setCursor(p);
              if (!start) {
                setStart(p);
                return;
              }
              const entity = make(start, p, `drawing_${crypto.randomUUID()}`);
              if (!isDrawingEntity(entity)) {
                setNotice(
                  "Choose a different point; geometry must have nonzero size."
                );
                return;
              }
              void submit([{ op: "drawing.entity.create", entity }], entity.id);
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
              } else setCursor(point(event));
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
                <Shape entity={entity} hit />
                <Shape entity={entity} />
              </g>
            ))}
            {preview && (
              <g className="drawing-preview" pointerEvents="none">
                <Shape entity={preview} />
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
            X {cursor?.[0] ?? 0} · Y {cursor?.[1] ?? 0} {units}
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
            Esc Cancel · Delete Remove
            <br />
            Ctrl/Cmd+Z Undo
          </p>
        </aside>
      </div>
      <div className="drawing-instruction" role="status">
        {error || notice || hint}
      </div>
    </section>
  );
}

function Shape({
  entity,
  hit = false
}: {
  entity: DrawingEntity;
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
  kind: DrawingEntity["kind"];
  entity?: DrawingEntity;
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
  const candidate: DrawingEntity =
    kind === "circle"
      ? {
          id: entity?.id ?? "new",
          kind,
          center: [Number(fields.x), Number(fields.y)],
          radius: Number(fields.radius)
        }
      : {
          id: entity?.id ?? "new",
          kind,
          start: [Number(fields.x), Number(fields.y)],
          end: [Number(fields.endX), Number(fields.endY)]
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
      {fieldNames.map((key) => (
        <label key={key}>
          {labels[key]}
          <input
            aria-label={labels[key]}
            data-drawing-field={key}
            type="number"
            step="any"
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
