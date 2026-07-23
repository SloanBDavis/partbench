import { Button, IconButton } from "../ui/Button";
import type { SelectionCollectorTarget } from "./selectionCollectorState";
import { formatAcceptedKinds } from "./selectionCollectorFormatting";

export interface SelectionCollectorRowProps<Value> {
  readonly label: string;
  readonly acceptedKinds: readonly string[];
  readonly targets: readonly SelectionCollectorTarget<Value>[];
  readonly collecting: boolean;
  readonly required?: boolean;
  readonly rejectedReason?: string;
  readonly onStartCollecting: () => void;
  readonly onStopCollecting: () => void;
  readonly onRemove: (value: Value) => void;
  readonly onClear: () => void;
}

export function SelectionCollectorRow<Value>({
  label,
  acceptedKinds,
  targets,
  collecting,
  required = false,
  rejectedReason,
  onStartCollecting,
  onStopCollecting,
  onRemove,
  onClear
}: SelectionCollectorRowProps<Value>) {
  return (
    <fieldset className="pb-selection-collector">
      <legend>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </legend>
      <p className="pb-selection-collector__kinds">
        {targets.length > 0 && !collecting ? "Accepts" : "Select"}{" "}
        {formatAcceptedKinds(acceptedKinds)}.
      </p>

      {targets.length > 0 ? (
        <ul className="pb-selection-collector__targets">
          {targets.map((target, index) => (
            <li key={`${target.kind}:${target.label}:${index}`}>
              <span>
                <strong>{target.label}</strong>
                <small>{target.kind}</small>
              </span>
              <IconButton
                density="dense"
                icon="close"
                label={`Remove ${target.label}`}
                onClick={() => onRemove(target.value)}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="pb-selection-collector__empty">No selection yet.</p>
      )}

      <div className="pb-selection-collector__actions">
        <Button
          density="dense"
          onClick={collecting ? onStopCollecting : onStartCollecting}
          aria-pressed={collecting}
        >
          {collecting ? "Stop selecting" : "Add selection"}
        </Button>
        {targets.length > 0 ? (
          <Button density="dense" onClick={onClear}>
            Clear
          </Button>
        ) : null}
      </div>

      {collecting ? (
        <p className="pb-selection-collector__active" role="status">
          Select in the viewport or document tree.
        </p>
      ) : null}
      {rejectedReason ? (
        <p className="pb-field-error" role="alert">
          {rejectedReason}
        </p>
      ) : null}
    </fieldset>
  );
}
