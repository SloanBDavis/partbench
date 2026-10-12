import { useState } from "react";
import {
  DEFAULT_DRAWING_LAYER,
  isDrawingLayer,
  type CadOp,
  type DrawingEntity,
  type DrawingLayer
} from "@web-cad/cad-protocol";

export function DrawingLayerControls({
  layers,
  entities,
  activeId,
  setActiveId,
  selected,
  disabled,
  commit
}: {
  layers: ReadonlyMap<string, DrawingLayer>;
  entities: ReadonlyMap<string, DrawingEntity>;
  activeId: string;
  setActiveId: (id: string) => void;
  selected?: DrawingEntity;
  disabled: boolean;
  commit: (ops: readonly CadOp[]) => Promise<boolean>;
}) {
  const [editingId, setEditingId] = useState("0");
  const [name, setName] = useState("");
  const editing = layers.get(editingId) ?? layers.get("0")!;
  const duplicate = [...layers.values()].some(
    (layer) => layer.name.toLowerCase() === name.trim().toLowerCase()
  );
  const options = [...layers.values()].map((layer) => (
    <option key={layer.id} value={layer.id}>
      {layer.name}
      {layer.locked ? " (locked)" : ""}
      {!layer.visible ? " (hidden)" : ""}
    </option>
  ));
  return (
    <details className="drawing-layers" open>
      <summary>Layers</summary>
      <label>
        Current layer
        <select
          aria-label="Current layer"
          value={activeId}
          disabled={disabled}
          onChange={(event) => setActiveId(event.target.value)}
        >
          {options}
        </select>
      </label>
      {layers.get(activeId)?.locked && (
        <p role="status">
          Current layer is locked. Unlock it or choose another layer to draw.
        </p>
      )}
      {selected && (
        <label>
          Selected entity layer
          <select
            aria-label="Selected entity layer"
            value={selected.layerId ?? "0"}
            disabled={disabled || layers.get(selected.layerId ?? "0")?.locked}
            onChange={(event) =>
              void commit([
                {
                  op: "drawing.entity.update",
                  entity: { ...selected, layerId: event.target.value }
                }
              ])
            }
          >
            {options}
          </select>
        </label>
      )}
      <label>
        New layer name
        <input
          aria-label="New layer name"
          value={name}
          disabled={disabled}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <button
        data-layer-create
        disabled={disabled || !name.trim() || duplicate}
        onClick={async () => {
          const id = `layer_${crypto.randomUUID()}`;
          if (
            await commit([
              {
                op: "drawing.layer.create",
                layer: { ...DEFAULT_DRAWING_LAYER, id, name: name.trim() }
              }
            ])
          ) {
            setName("");
            setEditingId(id);
            setActiveId(id);
          }
        }}
      >
        Create layer
      </button>
      {duplicate && <p role="alert">A layer with this name already exists.</p>}
      <label>
        Layer properties
        <select
          aria-label="Layer properties"
          value={editing.id}
          onChange={(event) => setEditingId(event.target.value)}
        >
          {options}
        </select>
      </label>
      <LayerProperties
        key={JSON.stringify(editing)}
        layer={editing}
        layers={layers}
        disabled={disabled}
        commit={commit}
      />
      <button
        data-layer-delete
        disabled={
          disabled ||
          editing.id === "0" ||
          [...entities.values()].some(
            (entity) => (entity.layerId ?? "0") === editing.id
          )
        }
        onClick={() =>
          void commit([{ op: "drawing.layer.delete", id: editing.id }])
        }
      >
        Delete empty layer
      </button>
    </details>
  );
}
function LayerProperties({
  layer,
  layers,
  disabled,
  commit
}: {
  layer: DrawingLayer;
  layers: ReadonlyMap<string, DrawingLayer>;
  disabled: boolean;
  commit: (ops: readonly CadOp[]) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState(layer);
  const [weight, setWeight] = useState(String(layer.lineWeight));
  const [transparency, setTransparency] = useState(String(layer.transparency));
  const candidate = {
    ...draft,
    lineWeight: Number(weight),
    transparency: Number(transparency)
  };
  const valid =
    Boolean(weight.trim() && transparency.trim()) &&
    isDrawingLayer(candidate) &&
    ![...layers.values()].some(
      (other) =>
        other.id !== layer.id &&
        other.name.trim().toLowerCase() === draft.name.trim().toLowerCase()
    );
  return (
    <fieldset disabled={disabled}>
      <label>
        Name
        <input
          aria-label="Layer name"
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
        />
      </label>
      <label>
        Color
        <input
          aria-label="Layer color"
          value={draft.color}
          onChange={(event) =>
            setDraft({ ...draft, color: event.target.value })
          }
        />
      </label>
      <label>
        Linetype
        <select
          aria-label="Layer linetype"
          value={draft.lineType}
          onChange={(event) =>
            setDraft({
              ...draft,
              lineType: event.target.value as DrawingLayer["lineType"]
            })
          }
        >
          <option value="continuous">Continuous</option>
          <option value="dashed">Dashed</option>
          <option value="dotted">Dotted</option>
          <option value="center">Center</option>
        </select>
      </label>
      <label>
        Lineweight (mm)
        <input
          aria-label="Layer lineweight"
          type="number"
          min="0"
          max="2.11"
          step="0.05"
          value={weight}
          onChange={(event) => setWeight(event.target.value)}
        />
      </label>
      <label>
        Transparency (%)
        <input
          aria-label="Layer transparency"
          type="number"
          min="0"
          max="90"
          value={transparency}
          onChange={(event) => setTransparency(event.target.value)}
        />
      </label>
      {(
        [
          ["locked", "Locked"],
          ["visible", "Visible"],
          ["printable", "Print"]
        ] as const
      ).map(([key, label]) => (
        <label className="drawing-layer-toggle" key={key}>
          <input
            type="checkbox"
            aria-label={`Layer ${label.toLowerCase()}`}
            checked={draft[key]}
            onChange={(event) =>
              setDraft({ ...draft, [key]: event.target.checked })
            }
          />
          {label}
        </label>
      ))}
      {!valid && (
        <p role="alert">
          Use a unique name, #RRGGBB color, lineweight 0–2.11 mm and
          transparency 0–90%.
        </p>
      )}
      <button
        data-layer-apply
        disabled={!valid}
        onClick={() =>
          void commit([{ op: "drawing.layer.update", layer: candidate }])
        }
      >
        Apply layer changes
      </button>
    </fieldset>
  );
}
