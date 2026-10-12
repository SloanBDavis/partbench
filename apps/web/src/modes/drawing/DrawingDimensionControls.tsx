import { useState } from "react";
import {
  drawingAnchors,
  resolveDrawingDimension,
  type DrawingAnchor,
  type DrawingDimension,
  type DrawingEntity,
  type DocumentUnits,
  type Vec2
} from "@web-cad/cad-protocol";
import { parseDrawingLength } from "./drawingCoordinates";

export function DrawingDimensionControls({
  entity,
  source,
  entities,
  units,
  disabled,
  placement,
  onPick,
  onApply
}: {
  entity?: DrawingDimension;
  source?: DrawingEntity;
  entities: ReadonlyMap<string, DrawingEntity>;
  units: DocumentUnits;
  disabled: boolean;
  placement?: Vec2;
  onPick: () => void;
  onApply: (entity: DrawingDimension) => Promise<boolean>;
}) {
  const geometry = [...entities.values()].filter((e) => e.kind !== "dimension");
  const initial = source?.kind !== "dimension" && source ? source : geometry[0];
  const anchors = initial ? drawingAnchors(initial) : [];
  const [first, setFirst] = useState<DrawingAnchor>(
    entity?.first ?? {
      entityId: initial?.id ?? "",
      point: anchors[0]?.name ?? "start"
    }
  );
  const [second, setSecond] = useState<DrawingAnchor>(
    entity?.second ?? {
      entityId: initial?.id ?? "",
      point: anchors[1]?.name ?? "end"
    }
  );
  const [type, setType] = useState<DrawingDimension["dimensionType"]>(
    entity?.dimensionType ?? "aligned"
  );
  const a = anchors[0]?.point ?? [0, 0],
    b = anchors[1]?.point ?? [20, 0];
  const [x, setX] = useState(String(entity?.placement[0] ?? (a[0] + b[0]) / 2));
  const [y, setY] = useState(
    String(entity?.placement[1] ?? (a[1] + b[1]) / 2 + 10)
  );
  const [priorPlacement, setPriorPlacement] = useState(placement);
  if (placement !== priorPlacement) {
    setPriorPlacement(placement);
    if (placement) {
      setX(String(placement[0]));
      setY(String(placement[1]));
    }
  }
  const px = parseDrawingLength(x, units),
    py = parseDrawingLength(y, units);
  const candidate: DrawingDimension = {
    ...entity,
    id: entity?.id ?? "preview",
    kind: "dimension",
    dimensionType: type,
    first,
    second,
    placement: [px.ok ? px.value : NaN, py.ok ? py.value : NaN]
  };
  const resolved = resolveDrawingDimension(candidate, entities);
  const valid = px.ok && py.ok && !!resolved;
  const anchorControl = (
    label: string,
    anchor: DrawingAnchor,
    set: (value: DrawingAnchor) => void
  ) => (
    <label>
      {label}
      <select
        aria-label={label}
        value={JSON.stringify(anchor)}
        disabled={disabled}
        onChange={(e) => set(JSON.parse(e.target.value) as DrawingAnchor)}
      >
        {!anchor.entityId && (
          <option value={JSON.stringify(anchor)}>Select geometry point</option>
        )}
        {geometry.flatMap((item, index) =>
          drawingAnchors(item).map((p) => (
            <option
              key={`${item.id}:${p.name}`}
              value={JSON.stringify({ entityId: item.id, point: p.name })}
            >
              {item.kind} {index + 1} · {p.name}
            </option>
          ))
        )}
      </select>
    </label>
  );
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
      <h3>{entity ? "Edit dimension" : "Create dimension"}</h3>
      <p className="drawing-muted">
        Choose two geometry points. Measurements follow their geometry; label
        placement stays fixed.
      </p>
      <label>
        Dimension type
        <select
          aria-label="Dimension type"
          value={type}
          disabled={disabled}
          onChange={(e) =>
            setType(e.target.value as DrawingDimension["dimensionType"])
          }
        >
          {(["aligned", "horizontal", "vertical"] as const).map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      {anchorControl("First dimension point", first, setFirst)}
      {anchorControl("Second dimension point", second, setSecond)}
      <label>
        Label X
        <input
          aria-label="Dimension label X"
          value={x}
          disabled={disabled}
          onChange={(e) => setX(e.target.value)}
        />
      </label>
      <label>
        Label Y
        <input
          aria-label="Dimension label Y"
          value={y}
          disabled={disabled}
          onChange={(e) => setY(e.target.value)}
        />
      </label>
      <button
        data-dimension-place
        type="button"
        disabled={disabled}
        onClick={onPick}
      >
        Place label on canvas
      </button>
      {valid ? (
        <output aria-label="Dimension measurement">
          {Number(resolved.value.toPrecision(10))} {units}
        </output>
      ) : (
        <p role="alert">
          Choose valid geometry points and finite label coordinates.
        </p>
      )}
      <button data-dimension-apply type="submit" disabled={!valid || disabled}>
        {entity ? "Apply dimension changes" : "Create dimension"}
      </button>
    </form>
  );
}
