import { DrawingDimensionGlyph } from "./DrawingDimensionGlyph";
import { useState } from "react";
import {
  drawingSheetSize,
  resolveDrawingDimension,
  isDrawingSheet,
  type CadOp,
  type DocumentUnits,
  type DrawingEntity,
  type DrawingSheet,
  type DrawingSheetViewport
} from "@web-cad/cad-protocol";

const paperSizes: Record<string, readonly [number, number]> = {
  A4: [210, 297],
  A3: [297, 420],
  Letter: [215.9, 279.4]
};

interface Props {
  sheet: DrawingSheet;
  sheets: ReadonlyMap<string, DrawingSheet>;
  entities: ReadonlyMap<string, DrawingEntity>;
  units: DocumentUnits;
  disabled: boolean;
  error?: string;
  commit: (ops: readonly CadOp[]) => Promise<boolean>;
  save: () => void;
  open: () => void;
}
function Numeric({
  label,
  value,
  onChange
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  const [source, setSource] = useState(value);
  const [text, setText] = useState(Number.isFinite(value) ? String(value) : "");
  if (!Object.is(source, value)) {
    setSource(value);
    setText(Number.isFinite(value) ? String(value) : "");
  }
  return (
    <label>
      {label}
      <input
        aria-label={label}
        type="text"
        inputMode="decimal"
        value={text}
        onChange={(event) => {
          const raw = event.target.value;
          const parsed = raw.trim() === "" ? NaN : Number(raw);
          setText(raw);
          setSource(parsed);
          onChange(parsed);
        }}
      />
    </label>
  );
}
function fittedModel(entities: ReadonlyMap<string, DrawingEntity>) {
  const points = [...entities.values()].flatMap<readonly [number, number]>(
    (e) =>
      e.kind === "dimension"
        ? (() => {
            const geometry = resolveDrawingDimension(e, entities);
            return geometry
              ? [
                  geometry.first,
                  geometry.second,
                  geometry.start,
                  geometry.end,
                  geometry.labelPosition
                ]
              : [];
          })()
        : e.kind === "circle"
          ? [
              [e.center[0] - e.radius, e.center[1] - e.radius],
              [e.center[0] + e.radius, e.center[1] + e.radius]
            ]
          : [e.start, e.end]
  );
  const xs = points.map((p) => p[0]!),
    ys = points.map((p) => p[1]!);
  const minX = points.length ? Math.min(...xs) : -50,
    maxX = points.length ? Math.max(...xs) : 50,
    minY = points.length ? Math.min(...ys) : -50,
    maxY = points.length ? Math.max(...ys) : 50;
  return {
    center: [(minX + maxX) / 2, (minY + maxY) / 2] as const,
    width: Math.max(10, maxX - minX) * 1.2,
    height: Math.max(10, maxY - minY) * 1.2
  };
}
export function SheetWorkspace({
  sheet,
  sheets,
  entities,
  units,
  disabled,
  error,
  commit,
  save,
  open
}: Props) {
  const [draft, setDraft] = useState(sheet);
  const [viewportId, setViewportId] = useState(sheet.viewports[0]?.id);
  const size = drawingSheetSize(sheet);
  const valid =
    isDrawingSheet(draft) &&
    ![...sheets.values()].some(
      (s) =>
        s.id !== sheet.id &&
        s.name.trim().toLowerCase() === draft.name.trim().toLowerCase()
    );
  const selected = draft.viewports.find((v) => v.id === viewportId);
  const changeViewport = (value: DrawingSheetViewport) =>
    setDraft({
      ...draft,
      viewports: draft.viewports.map((v) => (v.id === value.id ? value : v))
    });
  function addViewport() {
    const dimensions = drawingSheetSize(draft),
      margins = draft.margins;
    const viewport: DrawingSheetViewport = {
      id: crypto.randomUUID(),
      name: `View ${draft.viewports.length + 1}`,
      paper: {
        x: margins.left,
        y: margins.top,
        width: dimensions.width - margins.left - margins.right,
        height: dimensions.height - margins.top - margins.bottom
      },
      model: fittedModel(entities)
    };
    setDraft({ ...draft, viewports: [...draft.viewports, viewport] });
    setViewportId(viewport.id);
  }
  return (
    <section className="sheet-workspace" aria-label="Paper space">
      <div className="sheet-canvas-area">
        <div className="sheet-status">
          {sheet.name} · {size.width} × {size.height} mm · {sheet.orientation} ·{" "}
          {sheet.viewports.length} model viewports
        </div>
        <svg
          className="sheet-canvas"
          aria-label="Sheet canvas"
          role="img"
          viewBox={`-8 -8 ${size.width + 16} ${size.height + 16}`}
        >
          <rect
            className="sheet-paper"
            x="0"
            y="0"
            width={size.width}
            height={size.height}
          />
          <rect
            className="sheet-margins"
            x={sheet.margins.left}
            y={sheet.margins.top}
            width={size.width - sheet.margins.left - sheet.margins.right}
            height={size.height - sheet.margins.top - sheet.margins.bottom}
          />
          {sheet.viewports.map((v) => (
            <g key={v.id} data-sheet-viewport={v.id}>
              <title>{v.name}</title>
              <svg
                x={v.paper.x}
                y={v.paper.y}
                width={v.paper.width}
                height={v.paper.height}
                viewBox={`${v.model.center[0] - v.model.width / 2} ${-v.model.center[1] - v.model.height / 2} ${v.model.width} ${v.model.height}`}
                preserveAspectRatio="xMidYMid meet"
              >
                {[...entities.values()].map((entity) => (
                  <g
                    key={entity.id}
                    data-sheet-entity={entity.id}
                    fill="none"
                    stroke="#25344a"
                    strokeWidth="0.8"
                  >
                    {entity.kind === "dimension" ? (
                      <DrawingDimensionGlyph
                        entity={entity}
                        entities={entities}
                        units={units}
                      />
                    ) : entity.kind === "circle" ? (
                      <circle
                        cx={entity.center[0]}
                        cy={-entity.center[1]}
                        r={entity.radius}
                        vectorEffect="non-scaling-stroke"
                      />
                    ) : entity.kind === "line" ? (
                      <line
                        x1={entity.start[0]}
                        y1={-entity.start[1]}
                        x2={entity.end[0]}
                        y2={-entity.end[1]}
                        vectorEffect="non-scaling-stroke"
                      />
                    ) : (
                      <rect
                        x={Math.min(entity.start[0], entity.end[0])}
                        y={-Math.max(entity.start[1], entity.end[1])}
                        width={Math.abs(entity.end[0] - entity.start[0])}
                        height={Math.abs(entity.end[1] - entity.start[1])}
                        vectorEffect="non-scaling-stroke"
                      />
                    )}
                  </g>
                ))}
              </svg>
              <rect
                className="sheet-viewport-frame"
                x={v.paper.x}
                y={v.paper.y}
                width={v.paper.width}
                height={v.paper.height}
              />
            </g>
          ))}
        </svg>
      </div>
      <aside className="sheet-properties" aria-label="Sheet properties">
        <h2>Sheet setup</h2>
        <p>Paper and margins use millimeters. Model windows use {units}.</p>
        <fieldset disabled={disabled}>
          <label>
            Sheet name
            <input
              aria-label="Sheet name"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <label>
            Paper size
            <select
              aria-label="Paper size"
              value={
                Object.entries(paperSizes).find(
                  ([, size]) =>
                    size[0] === draft.paper.width &&
                    size[1] === draft.paper.height
                )?.[0] ?? "custom"
              }
              onChange={(e) => {
                const selectedSize = paperSizes[e.target.value];
                if (selectedSize)
                  setDraft({
                    ...draft,
                    paper: { width: selectedSize[0], height: selectedSize[1] }
                  });
              }}
            >
              <option value="custom">Custom / current</option>
              <option>A4</option>
              <option>A3</option>
              <option>Letter</option>
            </select>
          </label>
          <div className="sheet-fields">
            <Numeric
              label="Paper width"
              value={draft.paper.width}
              onChange={(width) =>
                setDraft({ ...draft, paper: { ...draft.paper, width } })
              }
            />
            <Numeric
              label="Paper height"
              value={draft.paper.height}
              onChange={(height) =>
                setDraft({ ...draft, paper: { ...draft.paper, height } })
              }
            />
          </div>
          <label>
            Orientation
            <select
              aria-label="Sheet orientation"
              value={draft.orientation}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  orientation: e.target.value as DrawingSheet["orientation"]
                })
              }
            >
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
          </label>
          <div className="sheet-fields">
            {(["top", "right", "bottom", "left"] as const).map((side) => (
              <Numeric
                key={side}
                label={`Margin ${side}`}
                value={draft.margins[side]}
                onChange={(value) =>
                  setDraft({
                    ...draft,
                    margins: { ...draft.margins, [side]: value }
                  })
                }
              />
            ))}
          </div>
          <h3>Model viewports</h3>
          <select
            aria-label="Sheet viewport"
            value={viewportId ?? ""}
            onChange={(e) => setViewportId(e.target.value)}
          >
            <option value="">Select viewport</option>
            {draft.viewports.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
          <button type="button" data-sheet-add-viewport onClick={addViewport}>
            Add model viewport
          </button>
          {selected && (
            <>
              <label>
                Viewport name
                <input
                  aria-label="Viewport name"
                  value={selected.name}
                  onChange={(e) =>
                    changeViewport({ ...selected, name: e.target.value })
                  }
                />
              </label>
              <h4>Position on paper (mm)</h4>
              <div className="sheet-fields">
                {(["x", "y", "width", "height"] as const).map((key) => (
                  <Numeric
                    key={key}
                    label={`Viewport paper ${key}`}
                    value={selected.paper[key]}
                    onChange={(n) =>
                      changeViewport({
                        ...selected,
                        paper: { ...selected.paper, [key]: n }
                      })
                    }
                  />
                ))}
              </div>
              <h4>Model window ({units})</h4>
              <div className="sheet-fields">
                <Numeric
                  label="Viewport center X"
                  value={selected.model.center[0]}
                  onChange={(x) =>
                    changeViewport({
                      ...selected,
                      model: {
                        ...selected.model,
                        center: [x, selected.model.center[1]]
                      }
                    })
                  }
                />
                <Numeric
                  label="Viewport center Y"
                  value={selected.model.center[1]}
                  onChange={(y) =>
                    changeViewport({
                      ...selected,
                      model: {
                        ...selected.model,
                        center: [selected.model.center[0], y]
                      }
                    })
                  }
                />
                {(["width", "height"] as const).map((key) => (
                  <Numeric
                    key={key}
                    label={`Viewport model ${key}`}
                    value={selected.model[key]}
                    onChange={(n) =>
                      changeViewport({
                        ...selected,
                        model: { ...selected.model, [key]: n }
                      })
                    }
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() =>
                  changeViewport({ ...selected, model: fittedModel(entities) })
                }
              >
                Fit model window
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraft({
                    ...draft,
                    viewports: draft.viewports.filter(
                      (v) => v.id !== selected.id
                    )
                  });
                  setViewportId(undefined);
                }}
              >
                Remove viewport
              </button>
            </>
          )}
          {!valid && (
            <p role="alert">
              Use a unique sheet name, positive paper/model sizes, valid
              margins, and viewports inside the margins.
            </p>
          )}
          <button
            type="button"
            data-sheet-apply
            disabled={!valid}
            onClick={() =>
              void commit([{ op: "drawing.sheet.update", sheet: draft }])
            }
          >
            Apply sheet changes
          </button>
          <button
            type="button"
            data-sheet-delete
            onClick={() =>
              void commit([{ op: "drawing.sheet.delete", id: sheet.id }])
            }
          >
            Delete sheet
          </button>
          <button type="button" onClick={save}>
            Save drawing
          </button>
          <button type="button" onClick={open}>
            Open .wcad
          </button>
        </fieldset>
        {error && <p role="alert">{error}</p>}
      </aside>
    </section>
  );
}
