import type { SelectionFilter, WorkbenchMode } from "./types";

interface CommonStatus {
  readonly mode: WorkbenchMode;
  readonly pendingLabel?: string;
  readonly modelSourceIds?: readonly string[];
  readonly modelWorkControl?: {
    readonly label: string;
    readonly actionLabel: string;
    readonly disabled?: boolean;
    readonly busy?: boolean;
    readonly onAction: () => void;
  };
}

export interface SketchStatus extends CommonStatus {
  readonly mode: "sketch";
  readonly instruction: string;
  readonly coordinates?: string;
  readonly zoom: string;
  readonly units: string;
  readonly solver: string;
}

export interface SolidStatus extends CommonStatus {
  readonly mode: "solid";
  readonly instruction: string;
  readonly selectionFilter: SelectionFilter;
  readonly onSelectionFilterChange?: (filter: SelectionFilter) => void;
  readonly coordinates?: string;
  readonly zoom: string;
  readonly units: string;
  readonly rebuildState: string;
}

export interface InspectStatus extends CommonStatus {
  readonly mode: "inspect";
  readonly instruction: string;
  readonly selectionFilter: SelectionFilter;
  readonly onSelectionFilterChange?: (filter: SelectionFilter) => void;
  readonly zoom: string;
  readonly units: string;
}

export interface ProjectStatus extends CommonStatus {
  readonly mode: "project";
  readonly fileState: string;
  readonly saveState: string;
  readonly readiness: string;
}

export type StatusBarProps =
  | SketchStatus
  | SolidStatus
  | InspectStatus
  | ProjectStatus;

export function StatusBar(props: StatusBarProps) {
  return (
    <footer
      className={`pb-status-bar pb-status-bar--${props.mode}`}
      role="status"
      aria-label={`${formatMode(props.mode)} status`}
      aria-live="polite"
      data-model-source-ids={props.modelSourceIds?.join(" ") || undefined}
    >
      {renderModeStatus(props)}
      {props.pendingLabel ? (
        <span className="pb-status-bar__pending" aria-busy="true">
          {props.pendingLabel}
        </span>
      ) : null}
      {props.modelWorkControl ? (
        <span className="pb-status-bar__model-work">
          <span>{props.modelWorkControl.label}</span>
          <button
            type="button"
            disabled={props.modelWorkControl.disabled}
            aria-busy={props.modelWorkControl.busy || undefined}
            onClick={props.modelWorkControl.onAction}
          >
            {props.modelWorkControl.actionLabel}
          </button>
        </span>
      ) : null}
    </footer>
  );
}

function renderModeStatus(props: StatusBarProps) {
  switch (props.mode) {
    case "sketch":
      return (
        <>
          <StatusInstruction text={props.instruction} />
          {props.coordinates ? (
            <PassiveValue label="Pointer" value={props.coordinates} />
          ) : null}
          <PassiveValue label="Zoom" value={props.zoom} />
          <PassiveValue label="Units" value={props.units} />
          <PassiveValue label="Solver" value={props.solver} />
        </>
      );
    case "solid":
      return (
        <>
          <StatusInstruction text={props.instruction} />
          <FilterControl
            value={props.selectionFilter}
            onChange={props.onSelectionFilterChange}
          />
          {props.coordinates ? (
            <PassiveValue label="Pointer" value={props.coordinates} />
          ) : null}
          <PassiveValue label="Zoom" value={props.zoom} />
          <PassiveValue label="Units" value={props.units} />
          <PassiveValue label="Rebuild" value={props.rebuildState} />
        </>
      );
    case "inspect":
      return (
        <>
          <StatusInstruction text={props.instruction} />
          <FilterControl
            value={props.selectionFilter}
            onChange={props.onSelectionFilterChange}
          />
          <PassiveValue label="Zoom" value={props.zoom} />
          <PassiveValue label="Units" value={props.units} />
        </>
      );
    case "project":
      return (
        <>
          <PassiveValue label="File" value={props.fileState} primary />
          <PassiveValue label="Save state" value={props.saveState} />
          <PassiveValue label="Readiness" value={props.readiness} />
        </>
      );
  }
}

function StatusInstruction({ text }: { readonly text: string }) {
  return (
    <span className="pb-status-bar__instruction" title={text}>
      {text}
    </span>
  );
}

function PassiveValue({
  label,
  value,
  primary = false
}: {
  readonly label: string;
  readonly value: string;
  readonly primary?: boolean;
}) {
  return (
    <span
      className={primary ? "pb-status-bar__primary" : "pb-status-bar__value"}
    >
      <span className="pb-visually-hidden">{label}: </span>
      {value}
    </span>
  );
}

function FilterControl({
  value,
  onChange
}: {
  readonly value: SelectionFilter;
  readonly onChange?: (filter: SelectionFilter) => void;
}) {
  if (!onChange)
    return <PassiveValue label="Selection filter" value={formatMode(value)} />;
  return (
    <label className="pb-status-bar__filter">
      <span className="pb-visually-hidden">Selection filter</span>
      <select
        value={value}
        onChange={(event) =>
          onChange(event.currentTarget.value as SelectionFilter)
        }
      >
        <option value="body">Body</option>
        <option value="face">Face</option>
        <option value="edge">Edge</option>
      </select>
    </label>
  );
}

function formatMode(value: string): string {
  return value[0].toUpperCase() + value.slice(1);
}
