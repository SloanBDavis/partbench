import { useEffect, useMemo, useRef, useState } from "react";
import {
  createAssemblyBom,
  exportAssemblyBomCsv
} from "@web-cad/cad-core/browser";
import {
  bomDefinitionKey,
  type AssemblySnapshot,
  type CadBodySnapshot,
  type BomCatalog,
  type BomItemUpdateOp,
  type BomMode,
  type BomRow
} from "@web-cad/cad-protocol";
import "./billOfMaterials.css";

export function BillOfMaterialsDialog({
  assemblies,
  bodies,
  catalog,
  pending,
  onCommit,
  onClose
}: {
  assemblies: readonly AssemblySnapshot[];
  bodies: readonly CadBodySnapshot[];
  catalog?: BomCatalog;
  pending: boolean;
  onCommit: (op: BomItemUpdateOp) => Promise<boolean>;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [assemblyId, setAssemblyId] = useState(() => {
    const nested = new Set(
      assemblies.flatMap((a) =>
        a.instances.flatMap((i) =>
          i.definition.kind === "assembly" ? [i.definition.assemblyId] : []
        )
      )
    );
    return (
      assemblies.find((a) => !nested.has(a.id) && a.instances.length > 0)?.id ??
      assemblies.find((a) => !nested.has(a.id))?.id ??
      assemblies[0]?.id ??
      ""
    );
  });
  const [mode, setMode] = useState<BomMode>("hierarchical");
  const [selectedKey, setSelectedKey] = useState<string>();
  const [message, setMessage] = useState("");
  const result = useMemo(() => {
    try {
      return {
        bom: createAssemblyBom({
          assemblyId,
          mode,
          assemblies,
          bodies,
          catalog
        })
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "BOM is unavailable."
      };
    }
  }, [assemblyId, mode, assemblies, bodies, catalog]);
  const selected = result.bom?.rows.find(
    (row) => bomDefinitionKey(row.definition) === selectedKey
  );
  useEffect(() => {
    const prior = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => prior?.focus();
  }, []);
  const download = async () => {
    if (!result.bom) return;
    setMessage("");
    try {
      const text = exportAssemblyBomCsv(result.bom);
      const name = `${result.bom.assemblyName.replace(/[^\p{L}\p{N} _-]/gu, "_") || "assembly"}-${mode}-bom.csv`;
      const picker = (
        window as unknown as {
          showSaveFilePicker?: (options: unknown) => Promise<{
            createWritable: () => Promise<{
              write: (content: string) => Promise<void>;
              close: () => Promise<void>;
            }>;
          }>;
        }
      ).showSaveFilePicker;
      if (picker) {
        const file = await picker.call(window, {
          suggestedName: name,
          types: [
            {
              description: "Bill of materials CSV",
              accept: { "text/csv": [".csv"] }
            }
          ]
        });
        const writable = await file.createWritable();
        await writable.write(text);
        await writable.close();
      } else {
        const url = URL.createObjectURL(
          new Blob([text], { type: "text/csv;charset=utf-8" })
        );
        const link = document.createElement("a");
        link.href = url;
        link.download = name;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      setMessage("CSV exported.");
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError"))
        setMessage(
          error instanceof Error ? error.message : "CSV export failed."
        );
    }
  };
  return (
    <dialog
      ref={dialog}
      className="pb-bom"
      aria-labelledby="bom-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onClose();
      }}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <header>
        <div>
          <h2 id="bom-title">Bill of materials</h2>
          <p>
            Quantities follow the assembly. Item numbers stay with each
            definition.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          aria-label="Close bill of materials"
        >
          Close
        </button>
      </header>
      <div className="pb-bom__toolbar">
        <label>
          Assembly
          <select
            aria-label="BOM assembly"
            value={assemblyId}
            disabled={pending}
            onChange={(event) => {
              setAssemblyId(event.target.value);
              setSelectedKey(undefined);
            }}
          >
            {assemblies.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          View
          <select
            aria-label="BOM view"
            value={mode}
            onChange={(event) => setMode(event.target.value as BomMode)}
          >
            <option value="hierarchical">Hierarchical</option>
            <option value="flattened">Flattened parts</option>
          </select>
        </label>
        <button
          type="button"
          data-bom-export
          disabled={!result.bom?.rows.length || pending}
          onClick={() => void download()}
        >
          Export CSV
        </button>
      </div>
      {result.error ? (
        <p role="alert">{result.error}</p>
      ) : (
        <>
          <p className="pb-bom__hint">
            {mode === "hierarchical"
              ? "Quantity is per parent; total quantity includes repeated subassemblies."
              : "Each part appears once, with quantities summed across all nested occurrences."}{" "}
            Select a row to edit its part details.
          </p>
          <div className="pb-bom__table">
            <table aria-label="Bill of materials">
              <thead>
                <tr>
                  {[
                    "Item",
                    "Name",
                    "Part number",
                    "Description",
                    "Material",
                    "Quantity",
                    "Total"
                  ].map((label) => (
                    <th key={label} scope="col">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.bom?.rows.map((row) => (
                  <tr
                    key={row.rowId}
                    data-bom-definition={bomDefinitionKey(row.definition)}
                    data-bom-item={row.itemNumber}
                    data-bom-quantity={row.quantity}
                    data-bom-total={row.totalQuantity}
                    aria-selected={
                      selectedKey === bomDefinitionKey(row.definition)
                    }
                  >
                    <td>{row.itemNumber}</td>
                    <td style={{ paddingLeft: 12 + row.depth * 18 }}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedKey(bomDefinitionKey(row.definition));
                          setMessage("");
                        }}
                      >
                        {row.definition.kind === "assembly" ? "▸ " : ""}
                        {row.name}
                      </button>
                    </td>
                    <td>{row.partNumber || "—"}</td>
                    <td>{row.description || "—"}</td>
                    <td>{row.material || "—"}</td>
                    <td>{row.quantity}</td>
                    <td>{row.totalQuantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!result.bom?.rows.length && (
              <p>This assembly has no components yet.</p>
            )}
          </div>
          {selected && (
            <BomItemForm
              key={`${selectedKey}:${selected.partNumber}:${selected.description}:${selected.material}`}
              row={selected}
              pending={pending}
              save={onCommit}
            />
          )}
        </>
      )}
      <p role="status">{message}</p>
    </dialog>
  );
}
function BomItemForm({
  row,
  pending,
  save
}: {
  row: BomRow;
  pending: boolean;
  save: (op: BomItemUpdateOp) => Promise<boolean>;
}) {
  const [metadata, setMetadata] = useState({
    partNumber: row.partNumber,
    description: row.description,
    material: row.material
  });
  const [error, setError] = useState("");
  const changed =
    metadata.partNumber !== row.partNumber ||
    metadata.description !== row.description ||
    metadata.material !== row.material;
  return (
    <form
      className="pb-bom__editor"
      onSubmit={(event) => {
        event.preventDefault();
        setError("");
        void save({
          op: "assembly.bom.updateItem",
          definition: row.definition,
          metadata
        })
          .then((ok) => {
            if (!ok)
              setError(
                "Could not save part details. Review the command error and retry."
              );
          })
          .catch((reason) =>
            setError(
              reason instanceof Error
                ? reason.message
                : "Could not save part details."
            )
          );
      }}
    >
      <h3>
        Item {row.itemNumber} · {row.name}
      </h3>
      <p>These details apply to every occurrence of this definition.</p>
      <div>
        {(
          [
            ["partNumber", "Part number"],
            ["description", "Description"],
            ["material", "Material"]
          ] as const
        ).map(([key, label]) => (
          <label key={key}>
            {label}
            <input
              aria-label={`BOM ${label.toLowerCase()}`}
              maxLength={500}
              value={metadata[key]}
              disabled={pending}
              onChange={(event) =>
                setMetadata({ ...metadata, [key]: event.target.value })
              }
            />
          </label>
        ))}
      </div>
      <button type="submit" data-bom-save disabled={pending || !changed}>
        Save part details
      </button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
