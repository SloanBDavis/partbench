import { useState, type ComponentProps } from "react";
import { type DrawingSheet } from "@web-cad/cad-protocol";
import { DrawingWorkspace } from "./DrawingWorkspace";
import { SheetWorkspace } from "./SheetWorkspace";
import "./sheets.css";

type Props = ComponentProps<typeof DrawingWorkspace> & {
  sheets: ReadonlyMap<string, DrawingSheet>;
};
export function DrawingLayoutWorkspace({ sheets, ...props }: Props) {
  const [active, setActive] = useState<string>();
  const sheet = active ? sheets.get(active) : undefined;
  async function add() {
    let number = sheets.size + 1;
    while (
      [...sheets.values()].some(
        (s) => s.name.trim().toLowerCase() === `sheet ${number}`
      )
    )
      number++;
    const created: DrawingSheet = {
      id: crypto.randomUUID(),
      name: `Sheet ${number}`,
      paper: { width: 210, height: 297 },
      orientation: "landscape",
      margins: { top: 10, right: 10, bottom: 10, left: 10 },
      viewports: []
    };
    if (await props.commit([{ op: "drawing.sheet.create", sheet: created }]))
      setActive(created.id);
  }
  return (
    <div className="drawing-layout-workspace">
      <nav className="sheet-tabs" aria-label="Drawing spaces">
        <button
          type="button"
          data-sheet-model
          aria-pressed={!sheet}
          onClick={() => setActive(undefined)}
        >
          Model space
        </button>
        {[...sheets.values()].map((s) => (
          <button
            type="button"
            key={s.id}
            data-sheet-tab={s.id}
            aria-pressed={sheet?.id === s.id}
            onClick={() => setActive(s.id)}
          >
            {s.name}
          </button>
        ))}
        <button
          type="button"
          data-sheet-new
          disabled={props.disabled}
          onClick={() => void add()}
        >
          New sheet
        </button>
      </nav>
      {sheet ? (
        <SheetWorkspace
          key={JSON.stringify(sheet)}
          sheet={sheet}
          sheets={sheets}
          {...props}
        />
      ) : (
        <DrawingWorkspace {...props} />
      )}
    </div>
  );
}
