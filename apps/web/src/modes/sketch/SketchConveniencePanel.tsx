import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Vec2 } from "@web-cad/cad-protocol";
import type { SketchCurveEditSessionControl } from "./SketchCurveEditPanel";
import { handleSketchCurveEditWindowShortcut } from "./sketchCurveEditModel";
import {
  buildSketchConvenienceOp,
  createSketchConvenienceDraft,
  getSketchConvenienceLabel,
  isSketchConvenienceDraftDirty,
  validateSketchConvenienceDraft,
  type SketchConvenienceDraft,
  type SketchConvenienceKind,
  type SketchConvenienceOp
} from "./sketchConvenienceModel";

export interface SketchConveniencePanelProps {
  readonly disabled: boolean;
  readonly kind: SketchConvenienceKind;
  readonly sketchId: string;
  readonly keyboardSuspended?: boolean;
  readonly onApply: (
    operation: SketchConvenienceOp
  ) => boolean | Promise<boolean>;
  readonly onCancel: (restoreFocus?: boolean) => void;
  readonly onRequestEscape?: (dirty: boolean) => void;
  readonly onDirtyChange?: (dirty: boolean) => void;
  readonly onSessionControlChange?: (
    control: SketchCurveEditSessionControl | undefined
  ) => void;
}

export function SketchConveniencePanel(props: SketchConveniencePanelProps) {
  const {
    disabled,
    kind,
    sketchId,
    keyboardSuspended = false,
    onApply,
    onCancel,
    onRequestEscape,
    onDirtyChange,
    onSessionControlChange
  } = props;
  const [initialDraft] = useState(() => createSketchConvenienceDraft(kind));
  const [draft, setDraft] = useState(initialDraft);
  const [applying, setApplying] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const applyRef = useRef<
    (options?: { readonly restoreFocusOnSuccess?: boolean }) => Promise<boolean>
  >(async () => false);
  const label = getSketchConvenienceLabel(kind);
  const validation = validateSketchConvenienceDraft(draft);
  const operation = buildSketchConvenienceOp(sketchId, draft);
  const canApply = operation !== undefined && !disabled && !applying;
  const dirty = isSketchConvenienceDraftDirty(draft, initialDraft);

  async function apply(
    options: { readonly restoreFocusOnSuccess?: boolean } = {}
  ): Promise<boolean> {
    if (!operation || disabled || applying) return false;
    setApplying(true);
    try {
      if (await onApply(operation)) {
        onCancel(options.restoreFocusOnSuccess ?? true);
        return true;
      }
      return false;
    } finally {
      setApplying(false);
    }
  }
  useEffect(() => {
    applyRef.current = apply;
  });
  useEffect(() => {
    formRef.current
      ?.querySelector<HTMLElement>("[data-drawer-initial-focus]")
      ?.focus();
  }, []);
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    onSessionControlChange?.({
      apply: (options) => applyRef.current(options),
      focus: () =>
        formRef.current
          ?.querySelector<HTMLElement>("[data-drawer-initial-focus]")
          ?.focus()
    });
    return () => onSessionControlChange?.(undefined);
  }, [onSessionControlChange]);
  useEffect(() => {
    if (keyboardSuspended) return undefined;
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      handleSketchCurveEditWindowShortcut({
        event,
        suspended: keyboardSuspended,
        dirty,
        canApply,
        onApply: () => void applyRef.current(),
        onCancel: () => onCancel(true),
        onDirtyEscape: () =>
          onRequestEscape ? onRequestEscape(true) : onCancel()
      });
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canApply, dirty, keyboardSuspended, onCancel, onRequestEscape]);

  function submit(event: FormEvent) {
    event.preventDefault();
    void apply();
  }

  return (
    <form
      ref={formRef}
      className="pb-sketch-section pb-curve-edit"
      aria-label={`Create ${label}`}
      onSubmit={submit}
    >
      <div className="pb-curve-edit__scroll">
        <div className="pb-sketch-section__heading">
          <div>
            <p className="pb-sketch-eyebrow">Create</p>
            <h3>{label}</h3>
          </div>
          <span>{validation ? "needs attention" : "ready"}</span>
        </div>
        <p className="pb-curve-edit__guidance">
          Enter exact model-space inputs. Apply creates ordinary lines, arcs,
          and the documented minimal constraints in one transaction.
        </p>
        {kind === "slot" ? (
          <SlotFields draft={draft} disabled={disabled} onChange={setDraft} />
        ) : (
          <RoundedRectangleFields
            draft={draft}
            disabled={disabled}
            onChange={setDraft}
          />
        )}
        {validation ? (
          <p className="pb-field-error" role="alert">
            {validation}
          </p>
        ) : (
          <p className="pb-sketch-callout" role="status">
            Ready to create one atomic {label.toLocaleLowerCase()} command.
          </p>
        )}
      </div>
      <footer className="pb-curve-edit__footer">
        <div className="pb-sketch-actions pb-curve-edit__actions">
          <button
            type="submit"
            className="pb-button pb-button--primary"
            disabled={!canApply}
          >
            {applying ? "Applying…" : `Apply ${label}`}
          </button>
          <button
            type="button"
            className="pb-button"
            disabled={applying}
            onClick={() => onCancel(true)}
          >
            Cancel
          </button>
        </div>
        <p className="pb-curve-edit__shortcut">
          Ctrl/Cmd+Enter applies when ready. Escape cancels without changing the
          sketch and guards changed inputs.
        </p>
      </footer>
    </form>
  );
}

function SlotFields({
  draft,
  disabled,
  onChange
}: {
  readonly draft: SketchConvenienceDraft;
  readonly disabled: boolean;
  readonly onChange: (draft: SketchConvenienceDraft) => void;
}) {
  const form = draft.slot;
  return (
    <>
      <PointFields
        legend="Centerline start"
        prefix="Start"
        point={form.centerlineStart}
        disabled={disabled}
        initialFocus
        onChange={(centerlineStart) =>
          onChange({ ...draft, slot: { ...form, centerlineStart } })
        }
      />
      <PointFields
        legend="Centerline end"
        prefix="End"
        point={form.centerlineEnd}
        disabled={disabled}
        onChange={(centerlineEnd) =>
          onChange({ ...draft, slot: { ...form, centerlineEnd } })
        }
      />
      <NumberField
        label="Radius"
        value={form.radius}
        disabled={disabled}
        onChange={(radius) => onChange({ ...draft, slot: { ...form, radius } })}
      />
      <ConstructionField
        checked={form.construction}
        disabled={disabled}
        onChange={(construction) =>
          onChange({ ...draft, slot: { ...form, construction } })
        }
      />
    </>
  );
}

function RoundedRectangleFields({
  draft,
  disabled,
  onChange
}: {
  readonly draft: SketchConvenienceDraft;
  readonly disabled: boolean;
  readonly onChange: (draft: SketchConvenienceDraft) => void;
}) {
  const form = draft.roundedRectangle;
  return (
    <>
      <PointFields
        legend="Center"
        prefix="Center"
        point={form.center}
        disabled={disabled}
        initialFocus
        onChange={(center) =>
          onChange({ ...draft, roundedRectangle: { ...form, center } })
        }
      />
      <NumberField
        label="Width"
        value={form.width}
        disabled={disabled}
        onChange={(width) =>
          onChange({ ...draft, roundedRectangle: { ...form, width } })
        }
      />
      <NumberField
        label="Height"
        value={form.height}
        disabled={disabled}
        onChange={(height) =>
          onChange({ ...draft, roundedRectangle: { ...form, height } })
        }
      />
      <NumberField
        label="Corner radius"
        value={form.cornerRadius}
        disabled={disabled}
        onChange={(cornerRadius) =>
          onChange({
            ...draft,
            roundedRectangle: { ...form, cornerRadius }
          })
        }
      />
      <ConstructionField
        checked={form.construction}
        disabled={disabled}
        onChange={(construction) =>
          onChange({
            ...draft,
            roundedRectangle: { ...form, construction }
          })
        }
      />
    </>
  );
}

function PointFields({
  legend,
  prefix,
  point,
  disabled,
  initialFocus = false,
  onChange
}: {
  readonly legend: string;
  readonly prefix: string;
  readonly point: Vec2;
  readonly disabled: boolean;
  readonly initialFocus?: boolean;
  readonly onChange: (point: Vec2) => void;
}) {
  return (
    <fieldset className="pb-curve-edit__choices">
      <legend>{legend}</legend>
      <div className="pb-sketch-field-grid">
        <NumberField
          label={`${prefix} X`}
          value={point[0]}
          disabled={disabled}
          initialFocus={initialFocus}
          onChange={(value) => onChange([value, point[1]])}
        />
        <NumberField
          label={`${prefix} Y`}
          value={point[1]}
          disabled={disabled}
          onChange={(value) => onChange([point[0], value])}
        />
      </div>
    </fieldset>
  );
}

function NumberField({
  label,
  value,
  disabled,
  initialFocus = false,
  onChange
}: {
  readonly label: string;
  readonly value: number;
  readonly disabled: boolean;
  readonly initialFocus?: boolean;
  readonly onChange: (value: number) => void;
}) {
  return (
    <label className="pb-sketch-field">
      <span>{label}</span>
      <input
        className="pb-field"
        type="number"
        step="any"
        value={value}
        disabled={disabled}
        data-drawer-initial-focus={initialFocus ? "" : undefined}
        onChange={(event) => {
          const value = event.currentTarget.valueAsNumber;
          if (Number.isFinite(value)) onChange(value);
        }}
      />
    </label>
  );
}

function ConstructionField({
  checked,
  disabled,
  onChange
}: {
  readonly checked: boolean;
  readonly disabled: boolean;
  readonly onChange: (checked: boolean) => void;
}) {
  return (
    <label className="pb-sketch-check pb-sketch-check--boxed">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      Construction
    </label>
  );
}
